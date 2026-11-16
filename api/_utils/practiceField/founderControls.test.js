// api/_utils/practiceField/founderControls.test.js
//
// Practice Field T1a-2b-1 §6 — THE FOUNDER'S CONTROLS, through the dispatcher the endpoint calls (founderControls.js):
// authorization (the mode, the allowlist read at call time), each action and its replay, and the two lifecycles the
// build prompt names — a wind-down with ideas running, which settle and then close the book; a paused book still valued
// and settled. The endpoint's own HTTP wiring (no token, a body uid) is api/practice-field/founder.test.js.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import {
  runFounderAction, isPracticeFieldFounder, founderAllowlist, planControl, FOUNDER_ACTIONS, founderRequestFingerprint,
} from './founderControls.js';
import { founderAllowlist as mandateFounderAllowlist } from '../../mandate/create.js';
import { runIdeaBookEvalPass, readIdeaBookPresence, ideaCloseLeftUnclosed } from './sweep.js';
import { assertReconciled } from './reconcile.js';
import { roundUsd } from '../mandateRounding.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';
import {
  makeMandateFakeDb, seedBook, contractOf, closeOn, storeTickSnapshot, storeCloseSnapshot, tickOf, slotNowOf, etIso, ADMIT_ISO, getBook, getIdea, dumpStore,
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

  it('MANDATE_FOUNDER_UIDS is parsed exactly as the Mandate founder endpoint parses it (one list; review A7)', () => {
    for (const raw of [undefined, '', ' , ', 'a', ' a , b ,, c ', 'a,a', '\ta\n,b']) {
      if (raw === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = raw;
      expect(founderAllowlist(), String(raw)).toEqual(mandateFounderAllowlist());
    }
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
    expect(db._get(`practiceFieldBooks/${UID}/founderOps/create-1`)).toMatchObject({ action: 'create_book', state: 'done', target: { attributionAgentId: `agent-${UID}`, archetypeCodeId: 'momentum_chaser' }, response: { status: 201 } });
    const bytes = dumpStore(db);
    expect(await act(db, 'create_book', 'create-1')).toMatchObject({ status: 200, body: { bookId, idempotentReplay: true } });
    expect(dumpStore(db)).toBe(bytes);
    // A second key meets the open book: refused, and that refusal is recorded under its key (a replay answers it).
    expect(await act(db, 'create_book', 'create-2')).toMatchObject({ status: 409, body: { error: 'open_book_exists', bookId } });
    const after = JSON.parse(dumpStore(db));
    expect(Object.keys(after).filter((p) => !(p in JSON.parse(bytes)))).toEqual([`practiceFieldBooks/${UID}/founderOps/create-2`]);
    expect(await act(db, 'create_book', 'create-2')).toMatchObject({ status: 409, body: { error: 'open_book_exists', idempotentReplay: true } });
  });

  it('C4 — a replay is answered from its record BEFORE the agent is resolved again: changing the agent\'s archetype or adding a ranked agent does not change the answer', async () => {
    const db = makeMandateFakeDb(agents());
    const created = await act(db, 'create_book', 'create-1');
    db._store.set(`agents/agent-${UID}`, { data: { ownerId: UID, archetype: 'degen' }, version: 9 });
    db._store.set('agents/agent-second', { data: { ownerId: UID, archetype: 'contrarian' }, version: 1 });
    expect(await act(db, 'create_book', 'create-1')).toMatchObject({ status: 200, body: { bookId: created.body.bookId, archetypeCodeId: 'momentum_chaser', idempotentReplay: true } });
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
    // The refused request answers the same on a replay (its key is recorded); a new request succeeds.
    expect(await act(db, 'create_book', 'c-1')).toEqual({ status: 403, body: { ok: false, error: 'mode_not_admitted', idempotentReplay: true } });
    expect((await act(db, 'create_book', 'c-2')).status).toBe(201);
  });
});

describe('admit_fixture — on the caller\'s own book, the origin forced to a founder fixture', () => {
  it('admits the body\'s contract with origin { founder_fixture, agent } whatever the body says; a replay finds it; a refusal names every check', async () => {
    const db = makeMandateFakeDb(agents());
    expect(await act(db, 'admit_fixture', 'a-1', { contract: contractOf() })).toEqual({ status: 404, body: { error: 'no_open_book' } });
    const { body: { bookId } } = await act(db, 'create_book', 'create-1');
    const { origin: _o, ...bare } = contractOf();
    const asked = { ...bare, origin: { kind: 'signaldrop', initiatedBy: 'player' } };
    const admitted = await act(db, 'admit_fixture', 'a-1', { contract: asked });
    expect(admitted).toMatchObject({ status: 201, body: { ok: true, action: 'admit_fixture', bookId, status: 'accepted', startSession: S[0], idempotentReplay: false } });
    const idea = getIdea(db, bookId, admitted.body.ideaId);
    expect(idea.contract.origin).toEqual({ kind: 'founder_fixture', initiatedBy: 'agent' });
    expect(db._get(`mandates/${bookId}/ideas/${admitted.body.ideaId}/evidence/admission`).contract.origin).toEqual({ kind: 'founder_fixture', initiatedBy: 'agent' });
    expect(await act(db, 'admit_fixture', 'a-1', { contract: asked })).toMatchObject({ status: 200, body: { ideaId: admitted.body.ideaId, idempotentReplay: true } });
    // The existing checks: the slot is taken, and a malformed contract names its faults.
    const { origin: _o2, ...msft } = contractOf({ names: ['MSFT'] });
    const refused = await act(db, 'admit_fixture', 'a-2', { contract: msft });
    expect(refused).toMatchObject({ status: 422, body: { ok: false, error: 'admission_refused' } });
    expect(refused.body.refusals.map((r) => r.code)).toEqual(['slot_occupied']);
    const bad = await act(db, 'admit_fixture', 'a-3', { contract: { ...bare, slot: 'forever', capitalUsd: -1 } });
    expect(bad.body.refusals.map((r) => r.code)).toEqual(expect.arrayContaining(['slot_invalid', 'capital_invalid']));
    // The same key asking for something else is not a replay (C3): refused, with the action it was recorded for.
    expect(await act(db, 'admit_fixture', 'a-1', { contract: { ...bare, names: ['NVDA'] } })).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'admit_fixture' } });
    expect(await act(db, 'admit_fixture', 'a-4', {})).toEqual({ status: 400, body: { ok: false, error: 'contract_required' } });
  });

  it('a claim that names a book the caller does not own, or a book that is not an idea book, is not the caller\'s book (review A5)', async () => {
    const db = makeMandateFakeDb(agents());
    const victim = await seedBook({ db, uid: 'victim', opId: 'v' });
    db._store.set(`practiceFieldBooks/${UID}`, { data: { bookId: victim.bookId, status: 'active' }, version: 1 });
    const before = dumpStore(db);
    for (const action of ['admit_fixture', 'pause', 'resume', 'wind_down']) {
      expect(await act(db, action, `k-${action}`, { contract: contractOf() }), action).toEqual({ status: 404, body: { error: 'no_open_book' } });
    }
    expect(dumpStore(db)).toBe(before);
    // The caller's own QUARTERLY book named by the claim: not an idea book.
    db._store.set('mandates/q-own', { data: { userId: UID, status: 'active', portfolio: { cash: 1e5, positions: {} } }, version: 1 });
    db._store.set(`practiceFieldBooks/${UID}`, { data: { bookId: 'q-own', status: 'active' }, version: 2 });
    const before2 = dumpStore(db);
    for (const action of ['admit_fixture', 'pause', 'resume', 'wind_down']) {
      expect(await act(db, action, `q-${action}`, { contract: contractOf() }), action).toEqual({ status: 404, body: { error: 'no_open_book' } });
    }
    expect(dumpStore(db)).toBe(before2);
  });
});

describe('C1, C3 — a request key is the OWNER\'s: a replay never lands on another book, and one key is one request', () => {
  it('after book A closes and book B opens, replaying A\'s wind_down, pause and admit_fixture answers what they answered and leaves B untouched', async () => {
    const db = makeMandateFakeDb(agents());
    const { body: { bookId: a } } = await act(db, 'create_book', 'create-1');
    const { origin: _o, ...contract } = contractOf();
    const admitted = await act(db, 'admit_fixture', 'a-1', { contract }, { nowIso: ADMIT_ISO });
    const paused = await act(db, 'pause', 'p-1');
    const wound = await act(db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[0], 8, 0) });
    expect([admitted.status, paused.status, wound.status]).toEqual([201, 200, 200]);
    // A's only idea never enters: at its start session's close it times out, and that close completes the wind-down.
    expect(await closeOn(db, a, S[0], quotes())).toMatchObject({ closed: true, bookClosed: true });
    const { body: { bookId: b } } = await act(db, 'create_book', 'create-2');
    expect(b).not.toBe(a);
    const before = JSON.stringify([getBook(db, b), db._get(`mandates/${b}`)]);
    expect(await act(db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[1], 9, 0) })).toEqual({ status: 200, body: { ...wound.body, idempotentReplay: true } });
    expect(await act(db, 'pause', 'p-1')).toEqual({ status: 200, body: { ...paused.body, idempotentReplay: true } });
    expect(await act(db, 'admit_fixture', 'a-1', { contract })).toEqual({ status: 200, body: { ...admitted.body, idempotentReplay: true } });
    expect(JSON.stringify([getBook(db, b), db._get(`mandates/${b}`)])).toBe(before);
    expect(getBook(db, b)).toMatchObject({ status: 'active', drafting: 'on', openIdeaIds: [] });
    // …and the create of A, replayed after A closed, answers what it answered.
    expect(await act(db, 'create_book', 'create-1')).toMatchObject({ status: 200, body: { bookId: a, idempotentReplay: true } });
  });

  it('one key across action families is refused request_key_conflict — create, admit and the controls alike', async () => {
    const db = makeMandateFakeDb(agents());
    expect((await act(db, 'create_book', 'K')).status).toBe(201);
    const { origin: _o, ...contract } = contractOf();
    for (const [action, extra] of [['admit_fixture', { contract }], ['pause', {}], ['resume', {}], ['wind_down', {}]]) {
      expect(await act(db, action, 'K', extra), action).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'create_book' } });
    }
    expect((await act(db, 'pause', 'P')).status).toBe(200);
    expect(await act(db, 'create_book', 'P')).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'pause' } });
    expect(getBook(db, db._get(`practiceFieldBooks/${UID}`).bookId)).toMatchObject({ status: 'active', drafting: 'paused', openIdeaIds: [] });
  });

  it('a create or admit interrupted after its request was recorded re-runs against its RECORDED target', async () => {
    const db = makeMandateFakeDb(agents());
    const { body: { bookId } } = await act(db, 'create_book', 'create-1');
    const { origin: _o, ...contract } = contractOf();
    // The request recorded, its run lost (the process died between the two).
    db._store.set(`practiceFieldBooks/${UID}/founderOps/a-9`, { data: { action: 'admit_fixture', requestKey: 'a-9', uid: UID, fingerprint: founderRequestFingerprint('admit_fixture', { contract }), state: 'pending', target: { bookId }, createdAt: ADMIT_ISO }, version: 1 });
    const out = await act(db, 'admit_fixture', 'a-9', { contract });
    expect(out).toMatchObject({ status: 201, body: { bookId, idempotentReplay: false } });
    expect(db._get(`practiceFieldBooks/${UID}/founderOps/a-9`)).toMatchObject({ state: 'done', response: { status: 201 } });
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
    expect(ctx.db._get(`practiceFieldBooks/${UID}/founderOps/p-1`)).toMatchObject({ action: 'pause', uid: UID, state: 'done', target: { bookId: ctx.bookId }, outcome: 'paused', before: { drafting: 'on' }, after: { drafting: 'paused' } });
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

  /** A book with no idea, closed on S[0]. */
  async function emptyBookClosedOnS0(db = makeMandateFakeDb(agents())) {
    const { body: { bookId } } = await act(db, 'create_book', 'create-1');
    await close(db, bookId, S[0]);
    return { db, bookId, bookRef: db.collection('mandates').doc(bookId) };
  }
  const windowPass = async (db, date) => {
    await storeTickSnapshot(db, date, 'open30', quotes());
    return runIdeaBookEvalPass(db, { tick: tickOf(date), now: slotNowOf(date), ownerToken: 'owner-token' });
  };

  it('C5 — a CATCH-UP that completes the wind-down: the window that ran it is complete with no error, writes no window row and no stamp on the closed book; the close call answers book_closed, not "left unclosed"', async () => {
    // Through the window.
    const one = await emptyBookClosedOnS0();
    await act(one.db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[1], 9, 0) }); // before S[1]'s close
    await storeCloseSnapshot(one.db, S[1], quotes()); // S[1]'s close fire never ran
    const errors = []; const original = console.error; console.error = (...x) => errors.push(x.join(' '));
    let pass1;
    try { pass1 = await windowPass(one.db, S[2]); } finally { console.error = original; }
    expect(pass1).toMatchObject({ books: 1, served: 0, caughtUp: 1, errors: 0 });
    expect(getBook(one.db, one.bookId)).toMatchObject({ status: 'closed', closedOn: S[1] });
    expect(getBook(one.db, one.bookId).execState.lastIdeaTickKey ?? null).toBeNull();
    expect(one.db._get(`mandates/${one.bookId}/windows/${S[2]}_open30`)).toBeUndefined();
    expect(one.db._get(`mandates/${one.bookId}/windows/${S[1]}_close`)).toMatchObject({ code: { bookClosed: true, caughtUpSession: true } });
    // Through the close call.
    const two = await emptyBookClosedOnS0();
    await act(two.db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[1], 9, 0) });
    await storeCloseSnapshot(two.db, S[1], quotes());
    const out = await closeOn(two.db, two.bookId, S[2], quotes());
    expect(out).toMatchObject({ closed: false, skipped: 'book_closed', bookClosed: true, caughtUp: [{ date: S[1], observed: true }] });
    expect(ideaCloseLeftUnclosed(out)).toBe(false);
    expect(getBook(two.db, two.bookId)).toMatchObject({ status: 'closed', closedOn: S[1], execState: { lastCloseKey: S[1] } });
  });

  it('C2 — a caught-up session that ended BEFORE the wind-down was requested is closed as the active session it was: the wind-down completes at a later session, and no active session loses its rows', async () => {
    // Requested on S[2] at 09:00, with S[1]'s close missed: S[1] closes active; S[2]'s close completes the wind-down.
    const a = await emptyBookClosedOnS0();
    await storeCloseSnapshot(a.db, S[1], quotes());
    await act(a.db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[2], 9, 0) });
    const original = console.error; console.error = () => {};
    let p;
    try { p = await windowPass(a.db, S[2]); } finally { console.error = original; }
    expect(p).toMatchObject({ served: 1, caughtUp: 1, errors: 0 });
    expect(getBook(a.db, a.bookId)).toMatchObject({ status: 'draining', execState: { lastCloseKey: S[1] } });
    expect(a.db._get(`mandates/${a.bookId}/windows/${S[1]}_close`)).toMatchObject({ code: { bookClosed: false } });
    expect(await close(a.db, a.bookId, S[2])).toMatchObject({ closed: true, bookClosed: true });
    expect(getBook(a.db, a.bookId)).toMatchObject({ status: 'closed', closedOn: S[2] });
    // Requested on S[2] at 18:00 — after S[2]'s close — with S[1] and S[2] both missed: both close active, and S[3]'s
    // close completes it. Every session keeps its daily row and its close row.
    const b = await emptyBookClosedOnS0();
    await storeCloseSnapshot(b.db, S[1], quotes());
    await storeCloseSnapshot(b.db, S[2], quotes());
    await act(b.db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[2], 18, 0) });
    console.error = () => {};
    try { expect(await windowPass(b.db, S[3])).toMatchObject({ served: 1, caughtUp: 2, errors: 0 }); } finally { console.error = original; }
    expect(getBook(b.db, b.bookId).status).toBe('draining');
    expect(await close(b.db, b.bookId, S[3])).toMatchObject({ closed: true, bookClosed: true });
    expect(getBook(b.db, b.bookId)).toMatchObject({ status: 'closed', closedOn: S[3] });
    for (const d of [S[0], S[1], S[2], S[3]]) {
      expect(b.db._get(`mandates/${b.bookId}/dailyRows/${d}`), d).toBeDefined();
      expect(b.db._get(`mandates/${b.bookId}/windows/${d}_close`), d).toBeDefined();
    }
  });

  it('N1 — a fire whose listing still shows a book that has CLOSED since writes nothing to it', async () => {
    const { db, bookId } = await emptyBookClosedOnS0();
    await act(db, 'wind_down', 'w-1', {}, { nowIso: etIso(S[1], 9, 0) });
    const stale = (await db.collection('mandates').where('status', '==', 'draining').where('kind', '==', 'idea_book').limit(25).get()).docs;
    expect(stale.map((d) => d.id)).toEqual([bookId]);
    await close(db, bookId, S[1]); // another fire closed it
    expect(getBook(db, bookId).status).toBe('closed');
    const staleDb = { ...db, collection: (c) => (c !== 'mandates' ? db.collection(c) : { ...db.collection(c), where: (f, op, status) => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: status === 'draining' ? stale : [] }) }) }) }) }) };
    await storeTickSnapshot(db, S[2], 'open30', quotes());
    const before = JSON.stringify(getBook(db, bookId));
    const out = await runIdeaBookEvalPass(staleDb, { tick: tickOf(S[2]), now: slotNowOf(S[2]), ownerToken: 'owner-token' });
    expect(out).toMatchObject({ books: 1, served: 0, errors: 0 });
    const after = getBook(db, bookId);
    const { lease: _l1, ...b1 } = JSON.parse(before);
    const { lease: _l2, ...b2 } = after;
    expect(JSON.stringify(b2)).toBe(JSON.stringify(b1)); // only the engine's lease bookkeeping touched it
    expect(db._get(`mandates/${bookId}/windows/${S[2]}_open30`)).toBeUndefined();
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
