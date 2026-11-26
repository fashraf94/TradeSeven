// api/_utils/practiceField/b4GroupBooks.test.js
//
// Practice Field build B4 — THE FIRST GROUP'S BOOKS, on the in-memory harness (no real Firestore, model or vendor call):
//   • the player list (B4-1): unset, empty and whitespace admit nobody; a listed uid is admitted for creation and admission;
//     a uid on the cockpit's list alone is admitted for neither; 'on' and 'off' unchanged (the screen: book.players.test.js);
//   • create_book_for (B4-2, B4-3): founder only, a listed owner only, the owner's own ranked agent, the agent's archetype or
//     the one named (checked), idempotent on the request key, never mistaken for create_book, one key never two owners;
//   • the founder's reach (B4-4): pause, resume, wind_down and resolve_hold on a listed player's book and on a removed
//     player's; admit_fixture and create_book take no owner; no open book is `no_open_book`; no quarterly book or other
//     document is reachable; a replay never moves; a request naming no owner keeps the fingerprint it had before B4;
//   • the cap (B4-6): the twelfth book is created, the thirteenth refused, and a closed book frees its place;
//   • the seam (B4-5): a listed player with an open book gets null at 'allowlist' (no read); a founder gets the answer.
//
// This file's import of mode.js is the dependency-surface guard for the api → src/config flag import (BUILD_RULES §4):
// never mocked.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests, practiceFieldAdmits, practiceFieldSeamAdmits } from './mode.js';
import { PRACTICE_FIELD_PLAYER_ENV, PRACTICE_FIELD_FOUNDER_ENV } from './playerList.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';
import {
  runFounderAction, founderRequestFingerprint, createForOpIdOf, validOwnerUid, OWNER_ACTIONS, FOUNDER_ACTIONS,
} from './founderControls.js';
import { createIdeaBook, ideaBookIdFor } from './ideaBook.js';
import { admitIdea } from './admission.js';
import { bookForOwner } from './bookStore.js';
import { canonicalContentHash } from '../canonicalHash.js';
import { PRACTICE_FIELD_SLOTS } from '../../../src/data/practiceFieldSlots.js';
import {
  makeMandateFakeDb, contractOf, etIso, ADMIT_ISO, DAYS, getBook, getIdea, dumpStore, admitAndEnter, closeOn, seedBook,
} from './__testsupport__/fixtures.js';

const FOUNDER = 'founder-1';
const P = (n) => `player-${n}`;
const REGISTRY = 'practiceFieldBooks/_registry';
/** An owner's agents: one ranked, one casual clone, one training clone; `second` adds a second ranked agent. */
const agentsFor = (uid, { archetype = 'momentum_chaser', second = false } = {}) => ({
  [`agents/agent-${uid}`]: { ownerId: uid, archetype, name: 'Ranked' },
  [`agents/casual-agent-${uid}`]: { ownerId: uid, archetype, isCasualClone: true, rankedAgentId: `agent-${uid}` },
  [`agents/training-${uid}`]: { ownerId: uid, archetype: 'degen', isTrainingClone: true },
  ...(second ? { [`agents/agent2-${uid}`]: { ownerId: uid, archetype: 'degen', name: 'Second' } } : {}),
});
const seed = (...uids) => Object.assign({}, ...uids.map((u) => agentsFor(u)));
const act = (db, body, { uid = FOUNDER, nowIso = ADMIT_ISO } = {}) => runFounderAction(db, { uid, body, nowIso });
const createFor = (db, owner, requestKey, extra = {}, opts) => act(db, { action: 'create_book_for', requestKey, ownerUid: owner, ...extra }, opts);
/** A db that fails the row on ANY read or transaction. */
const untouchable = new Proxy({}, { get() { throw new Error('the database was touched'); } });
const setList = (uids) => vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, uids.join(','));

let restoreMode;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('allowlist');
  vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, FOUNDER);
  setList([FOUNDER, P(1), P(2)]);
  vi.stubEnv(COCKPIT_ALLOWLIST_ENV, '');
});
afterEach(() => { restoreMode(); vi.unstubAllEnvs(); });

// ── THE PLAYER LIST (B4-1) ──────────────────────────────────────────────────────────────────────────────────────────────

describe('the player list (B4-1): at \'allowlist\', creating a book and admitting an idea admit by PRACTICE_FIELD_PLAYER_UIDS alone', () => {
  it.each([['unset', undefined], ['empty', ''], ['whitespace', '   '], ['commas and spaces', ' , ,, ']])('%s admits nobody — creation refused before any read, admission refused', async (_label, raw) => {
    if (raw === undefined) vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, undefined); else vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, raw);
    expect(practiceFieldAdmits(P(1))).toBe(false);
    expect(await createIdeaBook(untouchable, { uid: P(1), attributionAgentId: `agent-${P(1)}`, archetypeCodeId: 'momentum_chaser', opId: 'c-1', nowIso: ADMIT_ISO })).toEqual({ ok: false, code: 'mode_not_admitted' });
    const restore = setPracticeFieldModeForTests('on');
    const { db, bookId } = await seedBook({ uid: P(1) });
    restore();
    const res = await admitIdea(db, { bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO });
    expect(res.ok).toBe(false);
    expect(res.refusals.map((r) => r.code)).toEqual(['mode_not_admitted']);
  });

  it('a listed uid is admitted for creation and admission (the screen: book.players.test.js)', async () => {
    expect(practiceFieldAdmits(P(1))).toBe(true);
    const { db, bookId } = await seedBook({ uid: P(1) });
    expect(getBook(db, bookId).userId).toBe(P(1));
    expect((await admitIdea(db, { bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO })).ok).toBe(true);
  });

  it('a uid on the cockpit\'s list ALONE is admitted for neither: the cockpit\'s list decides nothing in the idea book', async () => {
    vi.stubEnv(COCKPIT_ALLOWLIST_ENV, P(3));
    expect(practiceFieldAdmits(P(3))).toBe(false);
    expect(await createIdeaBook(untouchable, { uid: P(3), attributionAgentId: `agent-${P(3)}`, archetypeCodeId: 'momentum_chaser', opId: 'c-1', nowIso: ADMIT_ISO })).toEqual({ ok: false, code: 'mode_not_admitted' });
    const restore = setPracticeFieldModeForTests('on');
    const { db, bookId } = await seedBook({ uid: P(3) });
    restore();
    expect((await admitIdea(db, { bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO })).refusals.map((r) => r.code)).toEqual(['mode_not_admitted']);
  });

  it('\'on\' and \'off\' are unchanged: \'on\' admits every non-empty uid whatever the lists say; \'off\' admits nobody, listed or not', () => {
    setPracticeFieldModeForTests('on');
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, '');
    expect(practiceFieldAdmits(P(9))).toBe(true);
    expect(practiceFieldAdmits('')).toBe(false);
    expect(practiceFieldAdmits(null)).toBe(false);
    setPracticeFieldModeForTests('off');
    setList([P(1)]);
    expect(practiceFieldAdmits(P(1))).toBe(false);
  });
});

// ── create_book_for (B4-2, B4-3) ────────────────────────────────────────────────────────────────────────────────────────

describe('create_book_for (B4-2, B4-3): a book for a listed player, by the founder only', () => {
  it('a caller who is not a founder is refused 403 — a listed player included — and nothing is read or written', async () => {
    expect(await createFor(untouchable, P(1), 'k-1', {}, { uid: P(1) })).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(await createFor(untouchable, P(2), 'k-1', {}, { uid: P(1) })).toEqual({ status: 403, body: { error: 'forbidden' } });
  });

  it('an owner who is not on the player list is refused, and NOTHING is recorded: once listed, the same key creates the book', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(3)));
    const before = dumpStore(db);
    expect(await createFor(db, P(3), 'k-1')).toEqual({ status: 403, body: { ok: false, error: 'owner_not_on_player_list', ownerUid: P(3) } });
    expect(dumpStore(db)).toBe(before);
    setList([FOUNDER, P(3)]);
    expect((await createFor(db, P(3), 'k-1')).status).toBe(201);
  });

  it('the book is THE OWNER\'s, for the owner\'s own ranked agent and its archetype; the request is the founder\'s, its target names the owner', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1)));
    const res = await createFor(db, P(1), 'k-1');
    const bookId = ideaBookIdFor(P(1), createForOpIdOf(FOUNDER, 'k-1'));
    expect(res).toEqual({
      status: 201,
      body: { ok: true, action: 'create_book_for', ownerUid: P(1), bookId, epochId: 'epoch-0001', attributionAgentId: `agent-${P(1)}`, archetypeCodeId: 'momentum_chaser', idempotentReplay: false },
    });
    expect(getBook(db, bookId)).toMatchObject({ kind: 'idea_book', userId: P(1), attributionAgentId: `agent-${P(1)}`, archetypeCodeId: 'momentum_chaser', status: 'active' });
    expect(getBook(db, bookId).createOpId).toBe(createForOpIdOf(FOUNDER, 'k-1'));
    expect(createForOpIdOf(FOUNDER, 'k-1')).toMatch(/^for#[0-9a-f]{40}$/);
    expect(db._get(`practiceFieldBooks/${P(1)}`)).toMatchObject({ bookId, attributionAgentId: `agent-${P(1)}`, status: 'active' });
    expect(db._get(`practiceFieldBooks/${FOUNDER}`)).toBeUndefined(); // the founder has no book of his own from it
    expect(db._get(`practiceFieldBooks/${FOUNDER}/founderOps/k-1`)).toMatchObject({
      action: 'create_book_for', uid: FOUNDER, state: 'done',
      target: { ownerUid: P(1), attributionAgentId: `agent-${P(1)}`, archetypeCodeId: 'momentum_chaser', archetypeNamed: false },
    });
    expect([...db._store.keys()].filter((p) => p.startsWith(`practiceFieldBooks/${P(1)}/`))).toEqual([]); // no record on the owner's side
    expect(db._get(REGISTRY).openBooks).toEqual({ [bookId]: P(1) });
  });

  it('never the founder\'s agent and never a clone: an owner with no ranked agent of their own is refused, nothing recorded', async () => {
    const db = makeMandateFakeDb({
      ...agentsFor(FOUNDER),
      [`agents/casual-agent-${P(1)}`]: { ownerId: P(1), archetype: 'momentum_chaser', isCasualClone: true, rankedAgentId: 'x' },
      [`agents/training-${P(1)}`]: { ownerId: P(1), archetype: 'degen', isTrainingClone: true },
    });
    const before = dumpStore(db);
    expect(await createFor(db, P(1), 'k-1')).toEqual({ status: 404, body: { error: 'ranked_agent_not_found', ownerUid: P(1) } });
    expect(await createFor(db, P(1), 'k-2', { agentId: `agent-${FOUNDER}` })).toEqual({ status: 404, body: { error: 'ranked_agent_not_found', ownerUid: P(1) } });
    expect(dumpStore(db)).toBe(before);
  });

  it('an owner with two ranked agents needs one named; the named agent\'s own archetype is the book\'s', async () => {
    const db = makeMandateFakeDb({ ...agentsFor(FOUNDER), ...agentsFor(P(1), { second: true }) });
    expect(await createFor(db, P(1), 'k-1')).toEqual({ status: 409, body: { error: 'ranked_agent_ambiguous', agentIds: [`agent-${P(1)}`, `agent2-${P(1)}`], ownerUid: P(1) } });
    const res = await createFor(db, P(1), 'k-2', { agentId: `agent2-${P(1)}` });
    expect(res.body).toMatchObject({ ok: true, attributionAgentId: `agent2-${P(1)}`, archetypeCodeId: 'degen' });
  });

  it('B4-3: an archetype the founder names is the book\'s (and its epoch\'s), not the agent\'s; an unknown one is refused before anything is recorded', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1), P(2)));
    const before = dumpStore(db);
    expect(await createFor(db, P(1), 'k-1', { archetypeCodeId: 'nobody' })).toEqual({ status: 400, body: { ok: false, error: 'unknown_archetype', ownerUid: P(1) } });
    expect(await createFor(db, P(1), 'k-1', { archetypeCodeId: '' })).toEqual({ status: 400, body: { ok: false, error: 'unknown_archetype', ownerUid: P(1) } });
    expect(dumpStore(db)).toBe(before);
    const res = await createFor(db, P(1), 'k-2', { archetypeCodeId: 'diversifier' });
    expect(res.body).toMatchObject({ ok: true, attributionAgentId: `agent-${P(1)}`, archetypeCodeId: 'diversifier' });
    expect(getBook(db, res.body.bookId).archetypeCodeId).toBe('diversifier');
    expect(db._get(`mandates/${res.body.bookId}/epochs/epoch-0001`)).toMatchObject({ archetypeCodeId: 'diversifier' });
    expect(db._get(`practiceFieldBooks/${FOUNDER}/founderOps/k-2`).target).toMatchObject({ archetypeCodeId: 'diversifier', archetypeNamed: true });
    // The agent's own archetype is untouched: a game loadout and the book are separate choices (IP-3).
    expect(db._get(`agents/agent-${P(1)}`).archetype).toBe('momentum_chaser');
  });

  it('a replay answers the stored response and writes nothing', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1)));
    const first = await createFor(db, P(1), 'k-1');
    const before = dumpStore(db);
    const again = await createFor(db, P(1), 'k-1', {}, { nowIso: etIso(DAYS.d1, 9, 0) });
    expect(again).toEqual({ status: 200, body: { ...first.body, idempotentReplay: true } });
    expect(dumpStore(db)).toBe(before);
  });

  it('one key can never create books for two owners: the second owner under the same key is a conflict, and no book is made for them', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1), P(2)));
    expect((await createFor(db, P(1), 'k-1')).status).toBe(201);
    expect(await createFor(db, P(2), 'k-1')).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'create_book_for' } });
    expect(db._get(`practiceFieldBooks/${P(2)}`)).toBeUndefined();
    // …nor one owner with another agent or archetype under it.
    expect((await createFor(db, P(1), 'k-1', { archetypeCodeId: 'degen' })).body).toMatchObject({ error: 'request_key_conflict' });
  });

  it('never mistaken for create_book: the founder\'s own create_book is unchanged, and the two never share a key or a book', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1)));
    const own = await act(db, { action: 'create_book', requestKey: 'k-1' });
    expect(own).toEqual({
      status: 201,
      body: { ok: true, action: 'create_book', bookId: ideaBookIdFor(FOUNDER, 'k-1'), epochId: 'epoch-0001', attributionAgentId: `agent-${FOUNDER}`, archetypeCodeId: 'momentum_chaser', idempotentReplay: false },
    });
    // The same key asking for another owner's book — or the founder's own, by the other action — is a conflict.
    expect(await createFor(db, P(1), 'k-1')).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'create_book' } });
    expect(await createFor(db, FOUNDER, 'k-1')).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'create_book' } });
    expect(db._get(`practiceFieldBooks/${P(1)}`)).toBeUndefined();
  });

  it('never mistaken for the OWNER\'s own create_book either: the engine\'s operation is of its own namespace, so the owner\'s create_book under the same key is not a replay of it', async () => {
    vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, `${FOUNDER},${P(1)}`); // the owner is a founder too
    const db = makeMandateFakeDb(seed(FOUNDER, P(1)));
    const made = await createFor(db, P(1), 'k-1');
    expect(made.status).toBe(201);
    const ownTry = await act(db, { action: 'create_book', requestKey: 'k-1' }, { uid: P(1) });
    expect(ownTry).toEqual({ status: 409, body: { ok: false, error: 'open_book_exists', bookId: made.body.bookId } });
    expect(ideaBookIdFor(P(1), 'k-1')).not.toBe(made.body.bookId);
  });

  it('createIdeaBook\'s own rules still hold: one open book per owner', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1)));
    const first = await createFor(db, P(1), 'k-1');
    expect(await createFor(db, P(1), 'k-2')).toEqual({ status: 409, body: { ok: false, error: 'open_book_exists', ownerUid: P(1), bookId: first.body.bookId } });
  });

  it('the owner is checked before any read: missing on create_book_for, refused on create_book and admit_fixture, and an unsafe id refused', async () => {
    expect(await act(untouchable, { action: 'create_book_for', requestKey: 'k-1' })).toEqual({ status: 400, body: { ok: false, error: 'owner_uid_required' } });
    expect(await act(untouchable, { action: 'create_book', requestKey: 'k-1', ownerUid: P(1) })).toEqual({ status: 400, body: { ok: false, error: 'owner_not_accepted', action: 'create_book' } });
    expect(await act(untouchable, { action: 'admit_fixture', requestKey: 'k-1', ownerUid: P(1), contract: contractOf() })).toEqual({ status: 400, body: { ok: false, error: 'owner_not_accepted', action: 'admit_fixture' } });
    for (const bad of ['', 'a/b', '_registry', '__name__', '.', '..', ' p1', 'p 1', 'p\n1', 'x'.repeat(129), 42, {}, ['p1']]) {
      expect(validOwnerUid(bad), JSON.stringify(bad)).toBe(false);
      expect(await createFor(untouchable, bad, 'k-1'), JSON.stringify(bad)).toEqual({ status: 400, body: { ok: false, error: 'owner_uid_invalid' } });
      for (const action of ['pause', 'resume', 'wind_down']) {
        expect(await act(untouchable, { action, requestKey: 'k-1', ownerUid: bad }), `${action} ${JSON.stringify(bad)}`).toEqual({ status: 400, body: { ok: false, error: 'owner_uid_invalid' } });
      }
    }
    expect(validOwnerUid('x'.repeat(128))).toBe(true);
    expect(validOwnerUid('Ab3dEf9GhIjKlMnOpQrStUvWx1Y2')).toBe(true); // a Firebase uid's shape
  });

  it('a reading of B4-2: the owner must be on the list at every mode — at \'on\' too, where createIdeaBook alone would admit anyone', async () => {
    setPracticeFieldModeForTests('on');
    const db = makeMandateFakeDb(seed(FOUNDER, P(3)));
    expect((await createFor(db, P(3), 'k-1')).body).toMatchObject({ error: 'owner_not_on_player_list' });
    expect((await createFor(db, P(1), 'k-1')).status).toBe(404); // listed; P(1) has no agents in this store
  });

  it('the action list: create_book_for joined; the owner actions are exactly the four plus create_book_for', () => {
    expect(FOUNDER_ACTIONS).toEqual(['create_book', 'admit_fixture', 'pause', 'resume', 'wind_down', 'resolve_hold', 'create_book_for']);
    expect(OWNER_ACTIONS).toEqual(['create_book_for', 'pause', 'resume', 'wind_down', 'resolve_hold']);
  });
});

// ── THE FOUNDER'S REACH (B4-4) ──────────────────────────────────────────────────────────────────────────────────────────

describe('the founder\'s reach (B4-4): pause, resume, wind_down and resolve_hold on a player\'s book', () => {
  async function playerBook(owner = P(1), extraSeed = {}) {
    const db = makeMandateFakeDb({ ...seed(FOUNDER, P(1), P(2)), ...extraSeed });
    const own = await act(db, { action: 'create_book', requestKey: 'own-1' }); // the founder's own book, which must not move
    const made = await createFor(db, owner, `for-${owner}`);
    expect(made.status).toBe(201);
    return { db, bookId: made.body.bookId, ownBookId: own.body.bookId };
  }

  /** The suspicion scenario (corporateActionFinish.test.js): AAPL entered at $100, then $50 with no row — a gap-screen record. */
  async function playerWithSuspicion(owner = P(1)) {
    const restore = setPracticeFieldModeForTests('on');
    const { db, bookId } = await seedBook({ uid: owner, attributionAgentId: `agent-${owner}` });
    restore();
    const Q = { AAPL: { price: 100, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: 500 };
    const e = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: Q });
    await closeOn(db, bookId, DAYS.d1, Q);
    await closeOn(db, bookId, DAYS.d2, { ...Q, AAPL: 50 });
    const recordId = `suspected_split_AAPL_${DAYS.d2}`;
    expect(getIdea(db, bookId, e.ideaId).ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: DAYS.d2 });
    return { db, bookId, ideaId: e.ideaId, recordId };
  }

  it('each action on a LISTED player\'s book: the owner\'s book moves, the founder\'s own does not; who acted is the founder; the record names the owner and the book', async () => {
    const { db, bookId, ownBookId } = await playerBook();
    const ownBefore = JSON.stringify(getBook(db, ownBookId));
    const nowIso = etIso(DAYS.d1, 8, 0);
    expect(await act(db, { action: 'pause', requestKey: 'p-1', ownerUid: P(1) }, { nowIso })).toEqual({
      status: 200, body: { ok: true, action: 'pause', ownerUid: P(1), bookId, outcome: 'paused', status: 'active', drafting: 'paused', idempotentReplay: false },
    });
    expect(getBook(db, bookId).drafting).toBe('paused');
    expect((await act(db, { action: 'resume', requestKey: 'r-1', ownerUid: P(1) }, { nowIso })).body).toMatchObject({ ok: true, ownerUid: P(1), bookId, outcome: 'resumed', drafting: 'on' });
    expect((await act(db, { action: 'wind_down', requestKey: 'w-1', ownerUid: P(1) }, { nowIso })).body).toMatchObject({ ok: true, ownerUid: P(1), bookId, outcome: 'draining', status: 'draining' });
    expect(getBook(db, bookId)).toMatchObject({ status: 'draining', windDown: { requestedAt: nowIso, requestKey: 'w-1', requestedBy: FOUNDER } });
    expect(db._get(`practiceFieldBooks/${P(1)}`)).toMatchObject({ bookId, status: 'draining' });
    for (const k of ['p-1', 'r-1', 'w-1']) {
      expect(db._get(`practiceFieldBooks/${FOUNDER}/founderOps/${k}`)).toMatchObject({ uid: FOUNDER, target: { ownerUid: P(1), bookId } });
    }
    expect(JSON.stringify(getBook(db, ownBookId))).toBe(ownBefore);
    expect(db._get(`practiceFieldBooks/${FOUNDER}`)).toMatchObject({ bookId: ownBookId, status: 'active' });
  });

  it('resolve_hold on a LISTED player\'s idea: the ruling is written on THAT idea, `by` the founder; the record names the owner, the book and the idea', async () => {
    const ctx = await playerWithSuspicion();
    const nowIso = etIso(DAYS.d3, 8, 0);
    const res = await act(ctx.db, { action: 'resolve_hold', requestKey: 'rule-1', ownerUid: P(1), ideaId: ctx.ideaId, kind: 'suspicion', recordId: ctx.recordId, decision: 'price_move' }, { nowIso });
    expect(res).toMatchObject({ status: 200, body: { ok: true, action: 'resolve_hold', ownerUid: P(1), bookId: ctx.bookId, ideaId: ctx.ideaId, kind: 'suspicion', recordId: ctx.recordId, decision: 'price_move' } });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).founderRulings).toEqual([expect.objectContaining({ requestKey: 'rule-1', recordId: ctx.recordId, by: FOUNDER, at: nowIso, appliedOn: null })]);
    expect(ctx.db._get(`practiceFieldBooks/${FOUNDER}/founderOps/rule-1`)).toMatchObject({ uid: FOUNDER, target: { ownerUid: P(1), bookId: ctx.bookId, ideaId: ctx.ideaId } });
    // Without the owner, the founder's own book is looked for — he has none here: no_open_book, nothing written.
    expect(await act(ctx.db, { action: 'resolve_hold', requestKey: 'rule-2', ideaId: ctx.ideaId, kind: 'suspicion', recordId: ctx.recordId, decision: 'price_move' }, { nowIso })).toEqual({ status: 404, body: { error: 'no_open_book' } });
  });

  it('the same four on a REMOVED player\'s book: the owner need not still be on the list', async () => {
    const ctx = await playerWithSuspicion(P(2));
    setList([FOUNDER, P(1)]); // P(2) removed
    expect(practiceFieldAdmits(P(2))).toBe(false);
    const nowIso = etIso(DAYS.d3, 8, 0);
    expect((await act(ctx.db, { action: 'pause', requestKey: 'p-1', ownerUid: P(2) }, { nowIso })).body).toMatchObject({ ok: true, outcome: 'paused', ownerUid: P(2), bookId: ctx.bookId });
    expect((await act(ctx.db, { action: 'resume', requestKey: 'r-1', ownerUid: P(2) }, { nowIso })).body).toMatchObject({ ok: true, outcome: 'resumed' });
    expect((await act(ctx.db, { action: 'resolve_hold', requestKey: 'rule-1', ownerUid: P(2), ideaId: ctx.ideaId, kind: 'suspicion', recordId: ctx.recordId, decision: 'price_move' }, { nowIso })).body).toMatchObject({ ok: true, ownerUid: P(2) });
    expect((await act(ctx.db, { action: 'wind_down', requestKey: 'w-1', ownerUid: P(2) }, { nowIso })).body).toMatchObject({ ok: true, outcome: 'draining', ownerUid: P(2) });
    expect(getBook(ctx.db, ctx.bookId)).toMatchObject({ status: 'draining', windDown: { requestedBy: FOUNDER } });
  });

  it('an owner with no open book is no_open_book, for each action, writing nothing', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1)));
    const before = dumpStore(db);
    for (const action of ['pause', 'resume', 'wind_down']) {
      expect(await act(db, { action, requestKey: `${action}-1`, ownerUid: P(1) }), action).toEqual({ status: 404, body: { error: 'no_open_book' } });
    }
    expect(await act(db, { action: 'resolve_hold', requestKey: 'rule-1', ownerUid: P(1), ideaId: 'idea_x', kind: 'suspicion', recordId: 'r', decision: 'price_move' })).toEqual({ status: 404, body: { error: 'no_open_book' } });
    expect(dumpStore(db)).toBe(before);
  });

  it('no action can reach a quarterly book, another owner\'s book or any other document — the owner\'s claim is a pointer, checked as ownBookOf checks it', async () => {
    const { db, bookId: p1Book } = await playerBook();
    // P(3)'s claim names a QUARTERLY book of P(3)'s; P(4)'s claim names P(1)'s idea book; P(5)'s claim names a missing book.
    db._store.set('mandates/quarterly-3', { data: { userId: P(3), status: 'active', archetype: 'analyst' }, version: 1 });
    db._store.set(`practiceFieldBooks/${P(3)}`, { data: { bookId: 'quarterly-3', status: 'active' }, version: 1 });
    db._store.set(`practiceFieldBooks/${P(4)}`, { data: { bookId: p1Book, status: 'active' }, version: 1 });
    db._store.set(`practiceFieldBooks/${P(5)}`, { data: { bookId: 'nowhere', status: 'active' }, version: 1 });
    const before = dumpStore(db);
    for (const owner of [P(3), P(4), P(5)]) {
      for (const action of ['pause', 'resume', 'wind_down']) {
        expect(await act(db, { action, requestKey: `${action}-${owner}`, ownerUid: owner }), `${action} ${owner}`).toEqual({ status: 404, body: { error: 'no_open_book' } });
      }
      expect(await act(db, { action: 'resolve_hold', requestKey: `rule-${owner}`, ownerUid: owner, ideaId: 'idea_x', kind: 'suspicion', recordId: 'r', decision: 'price_move' })).toEqual({ status: 404, body: { error: 'no_open_book' } });
    }
    expect(dumpStore(db)).toBe(before);
    // The registry is not an owner: refused as an id before any read.
    expect(await act(untouchable, { action: 'pause', requestKey: 'p-x', ownerUid: '_registry' })).toEqual({ status: 400, body: { ok: false, error: 'owner_uid_invalid' } });
  });

  it('a replay never moves to another book: a wind_down replayed after the player\'s book closed and a new one opened answers its stored response and leaves the new book alone', async () => {
    const { db, bookId } = await playerBook();
    const nowIso = etIso(DAYS.d1, 8, 0);
    const first = await act(db, { action: 'wind_down', requestKey: 'w-1', ownerUid: P(1) }, { nowIso });
    // The close that completes the wind-down (the book has nothing open): closed, off the registry, the claim released.
    const out = await closeOn(db, bookId, DAYS.d1, { AAPL: 230.17, SPY: 600.1 });
    expect(out).toMatchObject({ closed: true, bookClosed: true });
    const next = await createFor(db, P(1), 'for-again');
    expect(next.status).toBe(201);
    expect(next.body.bookId).not.toBe(bookId);
    const before = dumpStore(db);
    expect(await act(db, { action: 'wind_down', requestKey: 'w-1', ownerUid: P(1) }, { nowIso: etIso(DAYS.d2, 8, 0) })).toEqual({ status: 200, body: { ...first.body, idempotentReplay: true } });
    expect(dumpStore(db)).toBe(before);
    expect(getBook(db, next.body.bookId)).toMatchObject({ status: 'active', windDown: null });
  });

  it('one key never acts for two owners: the same key naming another owner — or naming none — is a conflict', async () => {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1), P(2)));
    await act(db, { action: 'create_book', requestKey: 'own-1' });
    await createFor(db, P(1), 'for-1');
    await createFor(db, P(2), 'for-2');
    expect((await act(db, { action: 'pause', requestKey: 'p-1', ownerUid: P(1) })).status).toBe(200);
    expect(await act(db, { action: 'pause', requestKey: 'p-1', ownerUid: P(2) })).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'pause' } });
    expect(await act(db, { action: 'pause', requestKey: 'p-1' })).toEqual({ status: 409, body: { ok: false, error: 'request_key_conflict', action: 'pause' } });
    expect(db._get(`mandates/${ideaBookIdFor(FOUNDER, 'own-1')}`).drafting).toBe('on');
  });

  it('a request naming no owner keeps the fingerprint it had BEFORE B4, and a record stored in main\'s shape still replays', async () => {
    // main's founderRequestFingerprint, written out (as at 22b01810).
    const mainFingerprint = (action, body) => canonicalContentHash({
      action,
      agentId: action === 'create_book' ? (body?.agentId ?? null) : null,
      contract: action === 'admit_fixture' ? (body?.contract ?? null) : null,
      ...(action === 'resolve_hold' ? { resolve: {
        ideaId: body?.ideaId ?? null, kind: body?.kind ?? null, recordId: body?.recordId ?? null, decision: body?.decision ?? null,
        ratio: body?.ratio ?? null, payload: body?.payload ?? null, actionId: body?.actionId ?? null,
      } } : {}),
    });
    const bodies = [
      ['create_book', {}], ['create_book', { agentId: 'agent-x' }], ['admit_fixture', { contract: contractOf() }],
      ['pause', {}], ['resume', {}], ['wind_down', {}], ['pause', { ownerUid: undefined }], ['resume', { ownerUid: null }],
      ['resolve_hold', { ideaId: 'idea_1', kind: 'suspicion', recordId: 'r', decision: 'price_move' }],
      ['resolve_hold', { ideaId: 'idea_1', kind: 'coverage_gap', recordId: 'g', decision: 'row', payload: { ratio: 2 } }],
    ];
    for (const [action, body] of bodies) expect(founderRequestFingerprint(action, body), `${action} ${JSON.stringify(body)}`).toBe(mainFingerprint(action, body));
    // …and naming an owner changes it, so the two can never share a stored answer.
    expect(founderRequestFingerprint('pause', { ownerUid: P(1) })).not.toBe(mainFingerprint('pause', {}));
    expect(founderRequestFingerprint('pause', { ownerUid: P(1) })).not.toBe(founderRequestFingerprint('pause', { ownerUid: P(2) }));
    // A pause the founder sent before B4, recorded as main recorded it, replays on this build.
    const db = makeMandateFakeDb(seed(FOUNDER));
    const own = await act(db, { action: 'create_book', requestKey: 'own-1' });
    const stored = { status: 200, body: { ok: true, action: 'pause', bookId: own.body.bookId, outcome: 'paused', status: 'active', drafting: 'paused', idempotentReplay: false } };
    db._store.set(`practiceFieldBooks/${FOUNDER}/founderOps/pause-main`, {
      data: { action: 'pause', requestKey: 'pause-main', uid: FOUNDER, fingerprint: mainFingerprint('pause', {}), state: 'done', target: { bookId: own.body.bookId }, createdAt: ADMIT_ISO, completedAt: ADMIT_ISO, outcome: 'paused', response: stored },
      version: 1,
    });
    expect(await act(db, { action: 'pause', requestKey: 'pause-main' })).toEqual({ status: 200, body: { ...stored.body, idempotentReplay: true } });
  });
});

// ── THE CAP (B4-6) ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the cap (B4-6): twelve books', () => {
  const players = Array.from({ length: 13 }, (_, i) => P(i + 1));

  it('B8 is 12: the twelfth book is created, the thirteenth refused founder_cap_reached; a closed book frees its place', async () => {
    expect(PRACTICE_FIELD_SLOTS.B8_FOUNDER_BOOK_CAP).toBe(12);
    setList([FOUNDER, ...players]);
    const db = makeMandateFakeDb(seed(FOUNDER, ...players));
    const books = [];
    for (const p of players.slice(0, 12)) {
      const res = await createFor(db, p, `for-${p}`);
      expect(res.status, p).toBe(201);
      books.push(res.body.bookId);
    }
    expect(Object.keys(db._get(REGISTRY).openBooks)).toHaveLength(12);
    const thirteenth = await createFor(db, players[12], 'for-13');
    expect(thirteenth).toEqual({ status: 409, body: { ok: false, error: 'founder_cap_reached', ownerUid: players[12] } });
    expect(db._get(`practiceFieldBooks/${players[12]}`)).toBeUndefined();
    // The founder winds one player's book down; the close that finds it with nothing open closes it and frees its place.
    expect((await act(db, { action: 'wind_down', requestKey: 'w-1', ownerUid: players[0] }, { nowIso: etIso(DAYS.d1, 8, 0) })).status).toBe(200);
    expect(await closeOn(db, books[0], DAYS.d1, { AAPL: 230.17, SPY: 600.1 })).toMatchObject({ closed: true, bookClosed: true });
    expect(Object.keys(db._get(REGISTRY).openBooks)).toHaveLength(11);
    // The refused request answers its stored refusal on a replay; a new request now takes the freed place.
    expect((await createFor(db, players[12], 'for-13')).body).toMatchObject({ error: 'founder_cap_reached', idempotentReplay: true });
    const freed = await createFor(db, players[12], 'for-13-again');
    expect(freed.status).toBe(201);
    expect(Object.keys(db._get(REGISTRY).openBooks)).toHaveLength(12);
    expect(db._get(REGISTRY).cap).toBe(12);
  });
});

// ── THE SEAM (B4-5) ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the Film Room\'s seam (B4-5): no nomination opens for players', () => {
  async function twoBooks() {
    const db = makeMandateFakeDb(seed(FOUNDER, P(1)));
    const own = await act(db, { action: 'create_book', requestKey: 'own-1' });
    const p1 = await createFor(db, P(1), 'for-1');
    return { db, own: own.body.bookId, p1: p1.body.bookId };
  }
  const ask = (db, uid) => bookForOwner(db, { uid, attributionAgentId: `agent-${uid}` });

  it('at \'allowlist\': a listed player WITH an open book gets null, without a read; the founder gets the answer he gets today', async () => {
    const { db, own } = await twoBooks();
    expect(await ask(untouchable, P(1))).toBeNull();
    expect(await ask(db, P(1))).toBeNull();
    expect(await ask(db, FOUNDER)).toEqual({ bookId: own, status: 'active' });
  });

  it('a reading of B4-5: a founder must be on the player list too (the seam narrows the mode\'s own gate; it never widens it)', async () => {
    const { db } = await twoBooks();
    setList([P(1)]);
    expect(await ask(untouchable, FOUNDER)).toBeNull();
  });

  it('\'on\' and \'off\' unchanged: at \'on\' the player gets their book; at \'off\' nobody, without a read', async () => {
    const { db, p1 } = await twoBooks();
    setPracticeFieldModeForTests('on');
    expect(await ask(db, P(1))).toEqual({ bookId: p1, status: 'active' });
    setPracticeFieldModeForTests('off');
    expect(await ask(untouchable, FOUNDER)).toBeNull();
  });

  it('practiceFieldSeamAdmits is its own small gate: the matrix', () => {
    const cases = [
      // mode, players, founders, uid → admitted
      ['allowlist', [P(1), FOUNDER], [FOUNDER], P(1), false],
      ['allowlist', [P(1), FOUNDER], [FOUNDER], FOUNDER, true],
      ['allowlist', [P(1)], [FOUNDER], FOUNDER, false],
      ['allowlist', [], [FOUNDER], FOUNDER, false],
      ['on', [], [], P(1), true],
      ['on', [], [], '', false],
      ['off', [P(1), FOUNDER], [FOUNDER], FOUNDER, false],
    ];
    for (const [mode, players, founders, uid, want] of cases) {
      setPracticeFieldModeForTests(mode);
      setList(players);
      vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, founders.join(','));
      expect(practiceFieldSeamAdmits(uid), JSON.stringify({ mode, players, founders, uid })).toBe(want);
    }
  });
});
