// api/_utils/practiceField/founderControls.b6.test.js
//
// Practice Field build B6 — two of the six small fixes, on the in-memory store:
//   B6-6  a creation whose book was already made is answered with that book, even after the player has left the list
//         (Astra B4-A01) — at 'allowlist', her two rows; nothing else about creation changes;
//   B6-7  one malformed entry in the player list does not switch the list off (Astra B4-A02, ruled): the gate is unchanged,
//         pinned on `fixture-player,bad/path`.
// This file's import of mode.js is the dependency-surface guard for the api → src/config flag import (BUILD_RULES §4):
// never mock it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests, practiceFieldAdmits } from './mode.js';
import { PRACTICE_FIELD_PLAYER_ENV, PRACTICE_FIELD_FOUNDER_ENV, readPracticeFieldPlayerList } from './playerList.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';
import { runFounderAction, founderRequestFingerprint, createForOpIdOf, validOwnerUid } from './founderControls.js';
import { createIdeaBook, ideaBookIdFor, isOwnCreation, madeIdeaBookOf } from './ideaBook.js';
import { FIRST_EPOCH_ID } from './constants.js';
import { makeMandateFakeDb, ADMIT_ISO, dumpStore } from './__testsupport__/fixtures.js';

const FOUNDER = 'founder-1';
const OWNER = 'player-3';
const AGENT = `agent-${OWNER}`;
const agentsOf = (uid) => ({ [`agents/agent-${uid}`]: { ownerId: uid, archetype: 'momentum_chaser', name: 'Ranked' } });
const act = (db, body) => runFounderAction(db, { uid: FOUNDER, body, nowIso: ADMIT_ISO });
const setList = (uids) => vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, uids.join(','));
const body = (requestKey) => ({ action: 'create_book_for', requestKey, ownerUid: OWNER });
/** The founder's request as an interruption leaves it: recorded `pending`, with its target, while the owner was listed. */
const pending = (requestKey, target = {}) => ({
  action: 'create_book_for', requestKey, uid: FOUNDER, fingerprint: founderRequestFingerprint('create_book_for', body(requestKey)), state: 'pending',
  target: { ownerUid: OWNER, attributionAgentId: AGENT, archetypeCodeId: 'momentum_chaser', archetypeNamed: false, ...target }, createdAt: ADMIT_ISO,
});
const opPath = (requestKey) => `practiceFieldBooks/${FOUNDER}/founderOps/${requestKey}`;

let restoreMode;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('allowlist');
  vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, FOUNDER);
  vi.stubEnv(COCKPIT_ALLOWLIST_ENV, '');
  setList([FOUNDER, OWNER]);
});
afterEach(() => { restoreMode(); vi.unstubAllEnvs(); });

/** The interruption: the book committed (its transaction ran while the owner was listed), its request still `pending`. */
async function interruptedAfterTheBook(requestKey) {
  const db = makeMandateFakeDb({ ...agentsOf(FOUNDER), ...agentsOf(OWNER) });
  const made = await createIdeaBook(db, { uid: OWNER, attributionAgentId: AGENT, archetypeCodeId: 'momentum_chaser', opId: createForOpIdOf(FOUNDER, requestKey), nowIso: ADMIT_ISO });
  expect(made).toMatchObject({ ok: true, idempotentReplay: false });
  db._store.set(opPath(requestKey), { data: pending(requestKey), version: 1 });
  return { db, made };
}

describe('B6-6 — a creation already made is answered with that book (Astra B4-A01), at \'allowlist\'', () => {
  it('her first row: pending, already made, owner removed → 200, the original book id, replay true — stored so, and so on every replay', async () => {
    const { db, made } = await interruptedAfterTheBook('k-made');
    setList([FOUNDER]); // the owner removed before the re-run
    expect(practiceFieldAdmits(OWNER)).toBe(false);
    const want = { status: 200, body: { ok: true, action: 'create_book_for', ownerUid: OWNER, bookId: made.bookId, epochId: FIRST_EPOCH_ID, attributionAgentId: AGENT, archetypeCodeId: 'momentum_chaser', idempotentReplay: true } };
    expect(await act(db, body('k-made'))).toEqual(want);
    // The request is done, with that answer — never a refusal stored for good.
    expect(db._get(opPath('k-made'))).toMatchObject({ state: 'done', response: { status: 200, body: { ok: true, bookId: made.bookId } } });
    expect(await act(db, body('k-made'))).toEqual(want);
    // The answer is the one the engine's own replay gives where the mode admits anyone (B4's recovery row, at 'on').
    restoreMode();
    restoreMode = setPracticeFieldModeForTests('on');
    const { db: db2 } = await interruptedAfterTheBook('k-made');
    expect(await act(db2, body('k-made'))).toEqual(want);
  });

  it('her second row: pending, never made, owner removed → 403, and no book', async () => {
    const db = makeMandateFakeDb({ ...agentsOf(FOUNDER), ...agentsOf(OWNER) });
    db._store.set(opPath('k-none'), { data: pending('k-none'), version: 1 });
    setList([FOUNDER]);
    expect(await act(db, body('k-none'))).toEqual({ status: 403, body: { ok: false, error: 'owner_not_on_player_list', ownerUid: OWNER } });
    expect(db._get(`mandates/${ideaBookIdFor(OWNER, createForOpIdOf(FOUNDER, 'k-none'))}`)).toBeUndefined();
    expect(db._get(`practiceFieldBooks/${OWNER}`)).toBeUndefined();
    expect([...db._store.keys()].filter((p) => p.startsWith('mandates/'))).toEqual([]);
  });

  it('the identity is checked against the RECORDED target: a book at that id made for another agent or archetype is a conflict, never answered', async () => {
    for (const target of [{ attributionAgentId: 'agent-other' }, { archetypeCodeId: 'analyst' }]) {
      const { db, made } = await interruptedAfterTheBook('k-x');
      db._store.set(opPath('k-x'), { data: pending('k-x', target), version: 1 });
      setList([FOUNDER]);
      expect(await act(db, body('k-x')), JSON.stringify(target)).toEqual({ status: 409, body: { ok: false, error: 'op_id_conflict', ownerUid: OWNER, bookId: made.bookId } });
      setList([FOUNDER, OWNER]);
    }
  });

  it('nothing else about creation changes: a NEW request for an unlisted owner is refused before anything is recorded; a listed owner\'s is made', async () => {
    const db = makeMandateFakeDb({ ...agentsOf(FOUNDER), ...agentsOf(OWNER) });
    setList([FOUNDER]);
    const before = dumpStore(db);
    expect(await act(db, body('k-new'))).toEqual({ status: 403, body: { ok: false, error: 'owner_not_on_player_list', ownerUid: OWNER } });
    expect(dumpStore(db)).toBe(before);
    setList([FOUNDER, OWNER]);
    expect(await act(db, body('k-new'))).toMatchObject({ status: 201, body: { ok: true, ownerUid: OWNER, idempotentReplay: false } });
  });

  it('the one identity test: createIdeaBook\'s replay and madeIdeaBookOf agree, field by field', async () => {
    const { db, made } = await interruptedAfterTheBook('k-i');
    const opId = createForOpIdOf(FOUNDER, 'k-i');
    const doc = db._get(`mandates/${made.bookId}`);
    const who = { uid: OWNER, opId, attributionAgentId: AGENT, archetypeCodeId: 'momentum_chaser' };
    expect(isOwnCreation(doc, who)).toBe(true);
    for (const [k, v] of [['uid', 'someone'], ['opId', 'for#other'], ['attributionAgentId', 'agent-other'], ['archetypeCodeId', 'analyst']]) expect(isOwnCreation(doc, { ...who, [k]: v }), k).toBe(false);
    expect(isOwnCreation(null, who)).toBe(false);
    expect(await madeIdeaBookOf(db, who)).toEqual({ ok: true, bookId: made.bookId, epochId: FIRST_EPOCH_ID, idempotentReplay: true });
    expect(await madeIdeaBookOf(db, { ...who, opId: 'for#never' })).toBeNull();
    expect(await createIdeaBook(db, { ...who, nowIso: ADMIT_ISO })).toEqual({ ok: true, bookId: made.bookId, epochId: FIRST_EPOCH_ID, idempotentReplay: true });
    expect(await createIdeaBook(db, { ...who, attributionAgentId: 'agent-other', nowIso: ADMIT_ISO })).toEqual({ ok: false, code: 'op_id_conflict', bookId: made.bookId });
  });
});

describe('B6-7 — one malformed entry does not switch the player list off (Astra B4-A02, ruled): the gate is unchanged', () => {
  it('`fixture-player,bad/path` admits fixture-player, and no other owner a book can be made for', () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, 'fixture-player,bad/path');
    expect(readPracticeFieldPlayerList()).toEqual(['fixture-player', 'bad/path']); // the parser keeps both, as built
    expect(practiceFieldAdmits('fixture-player')).toBe(true);
    for (const other of ['someone-else', 'fixture', 'fixture-player2', 'bad', 'path', FOUNDER, '']) expect(practiceFieldAdmits(other), other).toBe(false);
    // The malformed entry matches only itself, a uid the door's own owner rule refuses — no book can be made for it.
    expect(validOwnerUid('bad/path')).toBe(false);
  });

  it('the malformed entry admits nobody through the door: create_book_for naming it is refused before any read', async () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, 'fixture-player,bad/path');
    const untouchable = new Proxy({}, { get() { throw new Error('the database was touched'); } });
    expect(await runFounderAction(untouchable, { uid: FOUNDER, body: { action: 'create_book_for', requestKey: 'k-bad', ownerUid: 'bad/path' }, nowIso: ADMIT_ISO }))
      .toEqual({ status: 400, body: { ok: false, error: 'owner_uid_invalid' } });
  });
});
