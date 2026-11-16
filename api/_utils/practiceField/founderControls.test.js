// api/_utils/practiceField/founderControls.test.js
//
// Practice Field T1a-2b-1 §6 — THE FOUNDER'S CONTROLS, through the dispatcher the endpoint calls (founderControls.js):
// authorization (the mode, the allowlist read at call time), each action and its replay, and the two lifecycles the
// build prompt names — a wind-down with ideas running, which settle and then close the book; a paused book still valued
// and settled. The endpoint's own HTTP wiring (no token, a body uid) is api/practice-field/founder.test.js.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { runFounderAction, isPracticeFieldFounder, founderAllowlist, planControl, FOUNDER_ACTIONS } from './founderControls.js';
import { runIdeaBookEvalPass, readIdeaBookPresence } from './sweep.js';
import { assertReconciled } from './reconcile.js';
import { roundUsd } from '../mandateRounding.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';
import {
  makeMandateFakeDb, seedBook, contractOf, closeOn, storeTickSnapshot, tickOf, slotNowOf, etIso, ADMIT_ISO, getBook, getIdea, dumpStore,
} from './__testsupport__/fixtures.js';

const UID = 'founder-1';
const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03'];
const BASE = { AAPL: 231.47, MSFT: 418.13, SPY: 597.31 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12 };
const quotes = (over = {}) => Object.fromEntries(Object.entries({ ...BASE, ...over }).map(([s, v]) => [s, CAPS[s] && typeof v === 'number' ? { price: v, marketCap: CAPS[s] } : v]));
const agents = (uid = UID) => ({
  [`agents/agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', name: 'Ranked' },
  [`agents/casual-agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', isCasualClone: true, rankedAgentId: `agent-${uid}` },
  [`agents/training-${uid}`]: { ownerId: uid, archetype: 'degen', isTrainingClone: true },
});
const act = (db, action, requestKey, extra = {}, { uid = UID, nowIso = ADMIT_ISO } = {}) => runFounderAction(db, { uid, body: { action, requestKey, ...extra }, nowIso });

let restoreMode;
let prevEnv;
let prevCockpit;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  prevEnv = process.env.MANDATE_FOUNDER_UIDS;
  prevCockpit = process.env[COCKPIT_ALLOWLIST_ENV];
  process.env.MANDATE_FOUNDER_UIDS = ` other-founder , ${UID} `;
});
afterEach(() => {
  restoreMode();
  if (prevEnv === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = prevEnv;
  if (prevCockpit === undefined) delete process.env[COCKPIT_ALLOWLIST_ENV]; else process.env[COCKPIT_ALLOWLIST_ENV] = prevCockpit;
});

describe('authorization — the mode AND the founder allowlist, both, read at call time', () => {
  it('a founder at \'on\' is authorized; a non-founder is not; a founder at \'off\' is not; an unset or empty list authorizes nobody', async () => {
    expect(founderAllowlist()).toEqual(['other-founder', UID]);
    expect(isPracticeFieldFounder(UID)).toBe(true);
    expect(isPracticeFieldFounder('someone-else')).toBe(false);
    expect(isPracticeFieldFounder('')).toBe(false);
    expect(isPracticeFieldFounder(undefined)).toBe(false);
    setPracticeFieldModeForTests('off');
    expect(isPracticeFieldFounder(UID)).toBe(false);
    setPracticeFieldModeForTests('allowlist');
    expect(isPracticeFieldFounder(UID)).toBe(true);
    setPracticeFieldModeForTests('on');
    process.env.MANDATE_FOUNDER_UIDS = '';
    expect(isPracticeFieldFounder(UID)).toBe(false);
    delete process.env.MANDATE_FOUNDER_UIDS;
    expect(isPracticeFieldFounder(UID)).toBe(false);
    process.env.MANDATE_FOUNDER_UIDS = UID; // read NOW: no cache
    expect(isPracticeFieldFounder(UID)).toBe(true);
  });

  it('the dispatcher checks it again: a non-founder, or a founder at \'off\', writes nothing for any action', async () => {
    for (const action of FOUNDER_ACTIONS) {
      const db = makeMandateFakeDb(agents());
      await seedBook({ db, uid: UID, attributionAgentId: `agent-${UID}` });
      const before = dumpStore(db);
      expect(await act(db, action, 'k-1', {}, { uid: 'not-a-founder' }), action).toEqual({ status: 403, body: { error: 'forbidden' } });
      setPracticeFieldModeForTests('off');
      expect(await act(db, action, 'k-1'), action).toEqual({ status: 403, body: { error: 'forbidden' } });
      setPracticeFieldModeForTests('on');
      expect(dumpStore(db), action).toBe(before);
    }
  });

  it('an unknown action and a bad request key are refused before anything is read', async () => {
    const untouchable = { collection: () => { throw new Error('a read was made'); }, runTransaction: () => { throw new Error('a transaction was opened'); } };
    expect(await act(untouchable, 'delete_book', 'k-1')).toMatchObject({ status: 400, body: { error: 'unknown_action' } });
    for (const key of [undefined, '', 'has/slash', '.', '__x__'.replace(/^/, '/'), 'x'.repeat(201), 42]) {
      expect(await runFounderAction(untouchable, { uid: UID, body: { action: 'pause', requestKey: key }, nowIso: ADMIT_ISO }), String(key)).toMatchObject({ status: 400, body: { error: 'request_key_invalid' } });
    }
  });
});

describe('create_book — for the caller and their RANKED agent', () => {
  it('creates the book for the token\'s uid and the caller\'s one ranked agent (never a clone); a replay finds it; a second key meets the open book', async () => {
    const db = makeMandateFakeDb(agents());
    const created = await act(db, 'create_book', 'create-1');
    expect(created).toMatchObject({ status: 201, body: { ok: true, action: 'create_book', attributionAgentId: `agent-${UID}`, archetypeCodeId: 'momentum_chaser', idempotentReplay: false } });
    const { bookId } = created.body;
    expect(getBook(db, bookId)).toMatchObject({ userId: UID, attributionAgentId: `agent-${UID}`, kind: 'idea_book', status: 'active', drafting: 'on' });
    expect(db._get(`practiceFieldBooks/${UID}`)).toMatchObject({ bookId, status: 'active' });
    expect(Object.keys(db._get('practiceFieldBooks/_registry').openBooks)).toEqual([bookId]);
    const bytes = dumpStore(db);
    expect(await act(db, 'create_book', 'create-1')).toMatchObject({ status: 200, body: { bookId, idempotentReplay: true } });
    expect(dumpStore(db)).toBe(bytes);
    expect(await act(db, 'create_book', 'create-2')).toMatchObject({ status: 409, body: { error: 'open_book_exists', bookId } });
    expect(dumpStore(db)).toBe(bytes);
  });

  it('two ranked agents: ambiguous unless the body names one of the CALLER\'s; another owner\'s agent, or none, is not found', async () => {
    const db = makeMandateFakeDb({ ...agents(), 'agents/agent-second': { ownerId: UID, archetype: 'degen' }, 'agents/agent-stranger': { ownerId: 'stranger', archetype: 'degen' } });
    expect(await act(db, 'create_book', 'c-1')).toEqual({ status: 409, body: { error: 'ranked_agent_ambiguous', agentIds: [`agent-${UID}`, 'agent-second'] } });
    expect(await act(db, 'create_book', 'c-1', { agentId: 'agent-stranger' })).toEqual({ status: 404, body: { error: 'ranked_agent_not_found' } });
    expect(await act(db, 'create_book', 'c-1', { agentId: `casual-agent-${UID}` })).toEqual({ status: 404, body: { error: 'ranked_agent_not_found' } });
    expect(await act(db, 'create_book', 'c-1', { agentId: 'agent-second' })).toMatchObject({ status: 201, body: { attributionAgentId: 'agent-second', archetypeCodeId: 'degen' } });
    expect(await act(makeMandateFakeDb({ 'agents/casual-agent-x': { ownerId: UID, isCasualClone: true } }), 'create_book', 'c-1')).toEqual({ status: 404, body: { error: 'ranked_agent_not_found' } });
  });

  it('at \'allowlist\' the owner must ALSO be on the cockpit\'s server-side allowlist (createIdeaBook\'s own gate — a second list)', async () => {
    const db = makeMandateFakeDb(agents());
    setPracticeFieldModeForTests('allowlist');
    process.env[COCKPIT_ALLOWLIST_ENV] = 'someone-else';
    expect(await act(db, 'create_book', 'c-1')).toEqual({ status: 403, body: { ok: false, error: 'mode_not_admitted' } });
    process.env[COCKPIT_ALLOWLIST_ENV] = UID;
    expect((await act(db, 'create_book', 'c-1')).status).toBe(201);
  });
});

describe('admit_fixture — on the caller\'s own book, the origin forced to a founder fixture', () => {
  it('admits the body\'s contract with origin { founder_fixture, agent } whatever the body says; a replay finds it; a refusal names every check', async () => {
    const db = makeMandateFakeDb(agents());
    expect(await act(db, 'admit_fixture', 'a-1', { contract: contractOf() })).toEqual({ status: 404, body: { error: 'no_open_book' } });
    const { body: { bookId } } = await act(db, 'create_book', 'create-1');
    const { origin: _o, ...bare } = contractOf();
    const admitted = await act(db, 'admit_fixture', 'a-1', { contract: { ...bare, origin: { kind: 'signaldrop', initiatedBy: 'player' } } });
    expect(admitted).toMatchObject({ status: 201, body: { ok: true, action: 'admit_fixture', bookId, status: 'accepted', startSession: S[0], idempotentReplay: false } });
    const idea = getIdea(db, bookId, admitted.body.ideaId);
    expect(idea.contract.origin).toEqual({ kind: 'founder_fixture', initiatedBy: 'agent' });
    expect(db._get(`mandates/${bookId}/ideas/${admitted.body.ideaId}/evidence/admission`).contract.origin).toEqual({ kind: 'founder_fixture', initiatedBy: 'agent' });
    expect(await act(db, 'admit_fixture', 'a-1', { contract: { ...bare } })).toMatchObject({ status: 200, body: { ideaId: admitted.body.ideaId, idempotentReplay: true } });
    // The existing checks: the slot is taken, and a malformed contract names its faults.
    const { origin: _o2, ...msft } = contractOf({ names: ['MSFT'] });
    const refused = await act(db, 'admit_fixture', 'a-2', { contract: msft });
    expect(refused).toMatchObject({ status: 422, body: { ok: false, error: 'admission_refused' } });
    expect(refused.body.refusals.map((r) => r.code)).toEqual(['slot_occupied']);
    const bad = await act(db, 'admit_fixture', 'a-3', { contract: { ...bare, slot: 'forever', capitalUsd: -1 } });
    expect(bad.body.refusals.map((r) => r.code)).toEqual(expect.arrayContaining(['slot_invalid', 'capital_invalid']));
    expect(await act(db, 'admit_fixture', 'a-1', { contract: { ...bare, names: ['NVDA'] } })).toMatchObject({ status: 409, body: { error: 'op_id_conflict' } });
    expect(await act(db, 'admit_fixture', 'a-4', {})).toEqual({ status: 400, body: { ok: false, error: 'contract_required' } });
  });

  it('a claim that names a book the caller does not own (or no idea book) is not the caller\'s book', async () => {
    const db = makeMandateFakeDb(agents());
    const victim = await seedBook({ db, uid: 'victim', opId: 'v' });
    db._store.set(`practiceFieldBooks/${UID}`, { data: { bookId: victim.bookId, status: 'active' }, version: 1 });
    const before = dumpStore(db);
    for (const action of ['admit_fixture', 'pause', 'resume', 'wind_down']) {
      expect(await act(db, action, `k-${action}`, { contract: contractOf() }), action).toEqual({ status: 404, body: { error: 'no_open_book' } });
    }
    expect(dumpStore(db)).toBe(before);
  });
});

describe('pause, resume and wind_down — recorded once, nothing else changes', () => {
  async function bookWith(db = makeMandateFakeDb(agents())) {
    const { body } = await act(db, 'create_book', 'create-1');
    return { db, bookId: body.bookId, bookRef: db.collection('mandates').doc(body.bookId) };
  }
  const withoutControls = (b) => { const { drafting: _d, status: _s, windDown: _w, ...rest } = b; return JSON.stringify(rest); };

  it('pause sets drafting \'paused\' and resume \'on\' — no other field of the book moves, no clock, no revision; a replay answers and changes nothing', async () => {
    const ctx = await bookWith();
    const before = getBook(ctx.db, ctx.bookId);
    expect(await act(ctx.db, 'pause', 'p-1')).toEqual({ status: 200, body: { ok: true, action: 'pause', bookId: ctx.bookId, outcome: 'paused', status: 'active', drafting: 'paused', idempotentReplay: false } });
    const paused = getBook(ctx.db, ctx.bookId);
    expect(paused.drafting).toBe('paused');
    expect(withoutControls(paused)).toBe(withoutControls(before));
    expect(ctx.db._get(`mandates/${ctx.bookId}/controlOps/p-1`)).toMatchObject({ action: 'pause', uid: UID, outcome: 'paused', before: { drafting: 'on' }, after: { drafting: 'paused' } });
    const bytes = dumpStore(ctx.db);
    expect(await act(ctx.db, 'pause', 'p-1')).toMatchObject({ status: 200, body: { outcome: 'paused', idempotentReplay: true } });
    expect(dumpStore(ctx.db)).toBe(bytes);
    expect(await act(ctx.db, 'pause', 'p-2')).toMatchObject({ status: 200, body: { outcome: 'unchanged', drafting: 'paused' } });
    expect(await act(ctx.db, 'resume', 'r-1')).toMatchObject({ status: 200, body: { outcome: 'resumed', drafting: 'on' } });
    // Replaying the first PAUSE after the resume does not pause the book again.
    expect(await act(ctx.db, 'pause', 'p-1')).toMatchObject({ status: 200, body: { outcome: 'paused', idempotentReplay: true } });
    expect(getBook(ctx.db, ctx.bookId).drafting).toBe('on');
    // One key, two actions: refused.
    expect(await act(ctx.db, 'resume', 'p-1')).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'pause' } });
    expect(withoutControls(getBook(ctx.db, ctx.bookId))).toBe(withoutControls(before));
  });

  it('wind_down sets the book draining with its request, moves the claim\'s status in the same transaction, keeps it on the registry; a replay and a second key change nothing', async () => {
    const ctx = await bookWith();
    const before = getBook(ctx.db, ctx.bookId);
    expect(await act(ctx.db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[0], 17, 0) })).toMatchObject({ status: 200, body: { outcome: 'draining', status: 'draining', drafting: 'on' } });
    const book = getBook(ctx.db, ctx.bookId);
    expect(book).toMatchObject({ status: 'draining', windDown: { requestedAt: etIso(S[0], 17, 0), requestKey: 'w-1', requestedBy: UID } });
    expect(withoutControls(book)).toBe(withoutControls(before));
    expect(ctx.db._get(`practiceFieldBooks/${UID}`)).toMatchObject({ bookId: ctx.bookId, status: 'draining' });
    expect(Object.keys(ctx.db._get('practiceFieldBooks/_registry').openBooks)).toEqual([ctx.bookId]);
    expect(await readIdeaBookPresence(ctx.db)).toEqual({ known: true, ideaBooks: true });
    const bytes = dumpStore(ctx.db);
    expect(await act(ctx.db, 'wind_down', 'w-1')).toMatchObject({ status: 200, body: { idempotentReplay: true } });
    expect(dumpStore(ctx.db)).toBe(bytes);
    expect(await act(ctx.db, 'wind_down', 'w-2')).toMatchObject({ status: 200, body: { outcome: 'already_draining' } });
    expect(getBook(ctx.db, ctx.bookId).windDown.requestKey).toBe('w-1');
  });

  it('planControl: a book that is not open takes no control', () => {
    for (const action of ['pause', 'resume', 'wind_down']) {
      expect(planControl(action, { status: 'closed', drafting: 'on' }, { requestKey: 'k', uid: UID, nowIso: 'N' })).toEqual({ patch: null, outcome: 'refused', error: 'book_not_open' });
    }
  });
});

describe('the lifecycles', () => {
  const recon = (db, bookId) => { const b = getBook(db, bookId); assertReconciled(b, b.openIdeaIds.map((id) => getIdea(db, bookId, id))); };
  const pass = async (db, bookId, date, over = {}) => {
    await storeTickSnapshot(db, date, 'open30', quotes(over));
    const out = await runIdeaBookEvalPass(db, { tick: tickOf(date), now: slotNowOf(date), ownerToken: 'owner-token' });
    recon(db, bookId);
    return out;
  };
  const close = async (db, bookId, date, over = {}) => { const out = await closeOn(db, bookId, date, quotes(over)); recon(db, bookId); return out; };

  it('a WIND-DOWN with ideas running: no new admission or entry; the running idea\'s line exit and settlement go on; when it has resulted, that close sets the book closed, off the registry, its claim closed', async () => {
    const db = makeMandateFakeDb(agents());
    const { body: { bookId } } = await act(db, 'create_book', 'create-1');
    const { body: { ideaId } } = await act(db, 'admit_fixture', 'a-1', { contract: contractOf({ names: ['AAPL', 'MSFT'] }) });
    const pending = await act(db, 'admit_fixture', 'a-2', { contract: contractOf({ slot: 'medium', names: ['JPM'], capitalUsd: 25000 }) }, { nowIso: etIso(S[0], 11, 0) });
    expect(pending.body).toMatchObject({ startSession: S[1] });
    expect((await pass(db, bookId, S[0])).entered).toBe(1);
    const level = getIdea(db, bookId, ideaId).lines.find((l) => l.symbol === 'MSFT').level;
    await close(db, bookId, S[0], { MSFT: roundUsd(level - 0.02) });
    // Wound down after S[0]'s close.
    expect((await act(db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[0], 18, 0) })).body.outcome).toBe('draining');
    expect(await act(db, 'admit_fixture', 'a-3', { contract: contractOf({ slot: 'long', names: ['NVDA'] }) }, { nowIso: etIso(S[0], 19, 0) }))
      .toMatchObject({ status: 422, body: { refusals: expect.arrayContaining([expect.objectContaining({ code: 'book_not_active' })]) } });
    // S[1]: the line exit sells; the pending idea takes no entry, and times out at S[1]'s close.
    const p1 = await pass(db, bookId, S[1], { MSFT: roundUsd(level - 0.4) });
    expect(p1).toMatchObject({ sold: 1, entered: 0 });
    await close(db, bookId, S[1]);
    expect(getIdea(db, bookId, pending.body.ideaId)).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout' } });
    for (let i = 2; i < 10; i += 1) { await pass(db, bookId, S[i]); expect((await close(db, bookId, S[i])).bookClosed, S[i]).toBeUndefined(); }
    // S[10], the due session: the endpoint and the result; the book stays draining while AAPL waits to be sold.
    await pass(db, bookId, S[10]);
    await close(db, bookId, S[10], { AAPL: 236.4 });
    expect(getIdea(db, bookId, ideaId).status).toBe('settled');
    expect(db._get(`mandates/${bookId}/ideas/${ideaId}/evidence/result`)).toBeDefined();
    expect(getBook(db, bookId).status).toBe('draining');
    // S[11]: the settlement sale; the idea is resulted; THAT close finds nothing open and closes the book.
    expect(await pass(db, bookId, S[11], { AAPL: 236.1 })).toMatchObject({ sold: 1, resulted: 1 });
    expect(getBook(db, bookId).status).toBe('draining'); // not by the sale — only a close completes the wind-down
    const last = await close(db, bookId, S[11]);
    expect(last).toMatchObject({ closed: true, bookClosed: true });
    const book = getBook(db, bookId);
    expect(book).toMatchObject({ status: 'closed', closedOn: S[11], openIdeaIds: [], slots: { short: null, medium: null, long: null }, portfolio: { positions: {} } });
    expect(book.treasury.unreservedCash).toBe(book.portfolio.cash);
    expect(db._get('practiceFieldBooks/_registry').openBooks).toEqual({});
    expect(db._get(`practiceFieldBooks/${UID}`)).toMatchObject({ bookId: null, status: 'closed', closedBookId: bookId });
    expect(await readIdeaBookPresence(db)).toEqual({ known: true, ideaBooks: false });
    // A closed book takes no control, and the founder may open a new book.
    expect(await act(db, 'pause', 'p-late')).toEqual({ status: 404, body: { error: 'no_open_book' } });
    expect((await act(db, 'create_book', 'create-2')).status).toBe(201);
  });

  it('a PAUSED book is still valued and settled: its rows, its line exit, its endpoint and its settlement sale all happen; the pause moved no clock', async () => {
    const db = makeMandateFakeDb(agents());
    const { body: { bookId } } = await act(db, 'create_book', 'create-1');
    const { body: { ideaId, dueSession } } = await act(db, 'admit_fixture', 'a-1', { contract: contractOf({ names: ['AAPL', 'MSFT'] }) });
    await pass(db, bookId, S[0]);
    expect((await act(db, 'pause', 'p-1', {}, { nowIso: etIso(S[0], 12, 0) })).body.drafting).toBe('paused');
    const level = getIdea(db, bookId, ideaId).lines.find((l) => l.symbol === 'MSFT').level;
    await close(db, bookId, S[0], { MSFT: roundUsd(level - 0.02) });
    expect(db._get(`mandates/${bookId}/ideas/${ideaId}/rows/${S[0]}`)).toMatchObject({ basis: 'mark', fullQuality: true });
    expect((await pass(db, bookId, S[1], { MSFT: roundUsd(level - 0.4) })).sold).toBe(1);
    for (let i = 1; i <= 10; i += 1) { if (i > 1) await pass(db, bookId, S[i]); await close(db, bookId, S[i]); }
    const idea = getIdea(db, bookId, ideaId);
    expect(idea.contract.schedule.dueSession).toBe(dueSession);
    expect(dueSession).toBe(S[10]);
    expect(idea).toMatchObject({ status: 'settled', result: { endpointSession: S[10], endpointKind: 'due_session' } });
    expect(await pass(db, bookId, S[11])).toMatchObject({ sold: 1, resulted: 1 });
    expect(getBook(db, bookId)).toMatchObject({ status: 'active', drafting: 'paused', openIdeaIds: [] });
  });
});
