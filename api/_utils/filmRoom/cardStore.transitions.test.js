// api/_utils/filmRoom/cardStore.transitions.test.js
//
// Film Room Build C (spec docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md §3) — THE STAGE VOCABULARY v2 in the
// store, and THE LEDGER'S TRANSITION HELPER the Practice Field writes through (applyServerTransition):
//   · every entry written from C1 on records `stageVocabVersion: 2`; a v1 entry (no field) reads and counts as before,
//     and no write — the player's retire, the server's transitions — ever adds the field to it;
//   · the helper checks the entry's owner and agent, the legal order (`nominated → testing → tested → installed`,
//     `tested → retired`), is idempotent by op id, appends a `by: 'server'` row with the writer named, bumps the
//     version, sets ONE field, and never touches `note`, `questionId`, `route` or `source`;
//   · a shelved entry still transitions (contract V2 §7);
//   · the player's retire reads the one open predicate: `testing` and an unparked `tested` card retire; a parked card,
//     an installed one and a retired one do not.
// Over the tape suites' in-memory Firestore (real optimistic transactions).

import { describe, it, expect } from 'vitest';
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
import {
  createCard, retireCard, readCards, applyServerTransition, isOpen, SERVER_TRANSITIONS, PLAYS_SUBCOLLECTION,
  CARD_STAGE_VOCAB_VERSION, CARD_STAGES, OPEN_STAGES, isOpenStage,
} from './cardStore.js';
import * as stages from '../../../src/data/cardStages.js';

const UID = 'owner-1';
const AGENT = 'agent-1';
const NOW = '2026-11-12T15:00:00.000Z';
const LATER = '2026-11-12T15:05:00.000Z';
const LATEST = '2026-11-12T15:10:00.000Z';
const BOOK = 'book-1';
const agentDoc = (over = {}) => ({ ownerId: UID, name: 'Aurora', archetype: 'momentum_chaser', ...over });
const payload = (over = {}) => ({
  archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2,
  battleId: 'b-1', etDate: '2026-11-11', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5,
  questionId: 'stalled.want', questionVersion: 1, note: 'Let it go sooner.', route: 'watch', ...over,
});
const fresh = (agent = agentDoc()) => makeTapeDb({ [`agents/${AGENT}`]: agent });
const playPath = (id) => `agents/${AGENT}/${PLAYS_SUBCOLLECTION}/${id}`;
const playWrites = (t) => t.writeLog.filter((w) => w.path.includes(`/${PLAYS_SUBCOLLECTION}/`));
const code = async (p) => { try { await p; return null; } catch (e) { return e.cardRoute ? { status: e.status, code: e.code, extra: e.extra } : { thrown: String(e) }; } };

/** A card filed, then put at `nominated` with its nomination beside it (as the C1 nominate op leaves it) — planted here, the op is item 3's. */
async function nominated(t, id = 'c1') {
  const { card } = await createCard(t.db, { uid: UID, agentId: AGENT, opId: id, payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
  const at = { ...card, stage: 'nominated', stageAt: NOW, nomination: { bookId: BOOK, nominationId: `nom_${id}`, state: 'queued' }, version: 2, stageHistory: [...card.stageHistory, { stage: 'nominated', at: NOW, by: 'player', opId: `n_${id}` }] };
  t.store.set(playPath(id), at);
  return at;
}
const move = (t, over) => applyServerTransition(t.db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', nowIso: LATER, ...over });
const NOMINATION = { bookId: BOOK, nominationId: 'nom_c1', state: 'accepted', reason: 'The exit came early; I will test holding through one more check.', consideredAt: '2026-11-12T14:58:00.000Z' };
const IDEA = { bookId: BOOK, ideaId: 'idea-9' };
const RESULT = { ideaId: 'idea-9', resultRef: 'mandates/book-1/ideas/idea-9/results/r1', contractCondition: 'met', economicResult: 'within band' };
/** The entry carried to `tested` through the helper. */
async function tested(t) {
  await nominated(t);
  await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
  await move(t, { to: 'testing', opId: 's2', payload: IDEA });
  return move(t, { to: 'tested', opId: 's3', payload: RESULT });
}
/** The fields a transition may never touch. */
const untouched = (e) => ({ note: e.note, questionId: e.questionId, questionVersion: e.questionVersion, route: e.route, source: e.source, createdAt: e.createdAt, ownerId: e.ownerId, agentId: e.agentId, archetypeCodeId: e.archetypeCodeId });

describe('Build C §3 — the stage vocabulary v2, one export', () => {
  it('the six stages and the open set, and the store re-exports the one module whole', () => {
    expect(CARD_STAGE_VOCAB_VERSION).toBe(2);
    expect(CARD_STAGES).toEqual(['card', 'nominated', 'testing', 'tested', 'installed', 'retired']);
    expect(OPEN_STAGES).toEqual(['card', 'nominated', 'testing']);
    // the same objects, not copies: one export
    expect(CARD_STAGES).toBe(stages.CARD_STAGES);
    expect(OPEN_STAGES).toBe(stages.OPEN_STAGES);
    expect(isOpenStage).toBe(stages.isOpenStage);
    // drilled / drafted / proven were never written: not in the vocabulary
    for (const gone of ['drilled', 'drafted', 'proven']) expect(CARD_STAGES).not.toContain(gone);
    expect(['card', 'nominated', 'testing', 'tested', 'installed', 'retired'].map((stage) => isOpenStage({ stage }))).toEqual([true, true, true, true, false, false]);
    expect(isOpenStage({ stage: 'tested', parkedAt: NOW })).toBe(false);
  });

  it('a new entry records stageVocabVersion 2; a v1 entry (no field) reads and counts as before and is never rewritten by a retire (the mutant: a v1 entry rewritten with stageVocabVersion)', async () => {
    const t = fresh();
    const { card } = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'v2', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    expect(card.stageVocabVersion).toBe(2);
    // a v1 entry, as B2 wrote it: no stageVocabVersion
    const v1 = { ...card, entryId: 'v1', opId: 'v1' };
    delete v1.stageVocabVersion;
    t.store.set(playPath('v1'), v1);
    const read = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(read.open).toBe(2);
    expect(read.cards.find((c) => c.entryId === 'v1')).not.toHaveProperty('stageVocabVersion');
    await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'v1', opId: 'r1', expectedVersion: 1, nowIso: LATER });
    const after = t.store.get(playPath('v1'));
    expect(after.stage).toBe('retired');
    expect('stageVocabVersion' in after).toBe(false);
  });

  it('a v1 `nominated` entry (B2\'s Practice route, no nomination record) counts open as before, and the helper copies nothing onto it (409 nomination_mismatch)', async () => {
    const t = fresh();
    const { card } = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    const v1 = { ...card, route: 'drill', stage: 'nominated' };
    delete v1.stageVocabVersion;
    t.store.set(playPath('c1'), v1);
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(1);
    expect(await code(move(t, { to: 'nomination', opId: 's1', payload: NOMINATION }))).toMatchObject({ status: 409, code: 'nomination_mismatch' });
    expect(t.store.get(playPath('c1'))).toEqual(v1);
  });
});

describe('Build C §3 — applyServerTransition, the Practice Field\'s one way in', () => {
  it('the table: the legal order and the one field each transition sets', () => {
    expect(Object.fromEntries(Object.entries(SERVER_TRANSITIONS).map(([k, v]) => [k, [v.from, v.to, v.field]]))).toEqual({
      nomination: ['nominated', 'nominated', 'nomination'],
      testing: ['nominated', 'testing', 'idea'],
      tested: ['testing', 'tested', 'result'],
      installed: ['tested', 'installed', 'offer'],
      retired: ['tested', 'retired', 'offer'],
    });
  });

  it('nomination: copies { state, reason, consideredAt, bookId, nominationId } onto the entry, the stage stays nominated, a server row names the writer, the version moves — and nothing else changes', async () => {
    const t = fresh();
    const before = await nominated(t);
    const r = await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, stray: 'never copied' } });
    expect(r.idempotent).toBe(false);
    const after = t.store.get(playPath('c1'));
    expect(after).toEqual(r.entry);
    expect(after.nomination).toEqual({ bookId: BOOK, nominationId: 'nom_c1', state: 'accepted', reason: NOMINATION.reason, consideredAt: NOMINATION.consideredAt });
    expect(after.stage).toBe('nominated');
    expect(after.stageAt).toBe(before.stageAt);
    expect(after.version).toBe(before.version + 1);
    expect(after.stageHistory.at(-1)).toMatchObject({ stage: 'nominated', event: 'nomination', state: 'accepted', at: LATER, by: 'server', writer: 'practice_field', opId: 's1' });
    expect(untouched(after)).toEqual(untouched(before));
    // exactly the fields the transition names changed (the mutant: touching the note)
    const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])).sort();
    expect(changed).toEqual(['nomination', 'stageHistory', 'version']);
    expect(playWrites(t).at(-1).op).toBe('tx.update');
  });

  it('testing → tested → installed: each sets its one field and moves the stage at its instant; the chain is in stageHistory, by: server', async () => {
    const t = fresh();
    const before = await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    const a = await move(t, { to: 'testing', opId: 's2', payload: IDEA, nowIso: LATER });
    expect(a.entry).toMatchObject({ stage: 'testing', stageAt: LATER, idea: IDEA });
    const b = await move(t, { to: 'tested', opId: 's3', payload: RESULT, nowIso: LATEST });
    expect(b.entry).toMatchObject({ stage: 'tested', stageAt: LATEST, result: RESULT });
    const c = await move(t, { to: 'installed', opId: 's4', payload: { offerId: 'offer-1', state: 'accepted' }, nowIso: LATEST });
    expect(c.entry).toMatchObject({ stage: 'installed', offer: { offerId: 'offer-1', state: 'accepted' } });
    const stored = t.store.get(playPath('c1'));
    expect(stored.stageHistory.map((h) => [h.stage, h.by, h.writer ?? null, h.event ?? null])).toEqual([
      ['card', 'player', null, null], ['nominated', 'player', null, null], ['nominated', 'server', 'practice_field', 'nomination'],
      ['testing', 'server', 'practice_field', null], ['tested', 'server', 'practice_field', null], ['installed', 'server', 'practice_field', null],
    ]);
    expect(stored.version).toBe(before.version + 4);
    expect(untouched(stored)).toEqual(untouched(before));
    expect('stageVocabVersion' in stored && stored.stageVocabVersion).toBe(2);   // written once at create, never again
  });

  it('retired by the server from tested, with the offer\'s state (or none)', async () => {
    const t = fresh();
    await tested(t);
    const r = await move(t, { to: 'retired', opId: 's4', payload: { offerId: null, state: 'no_offer' } });
    expect(r.entry).toMatchObject({ stage: 'retired', offer: { offerId: null, state: 'no_offer' } });
  });

  it('THE ORDER (the mutant: skipping the order check): every out-of-order move → 409 illegal_transition naming the stage; nothing written', async () => {
    const t = fresh();
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    const writes = playWrites(t).length;
    // from `card`: no server transition (the player's nominate moves it, item 3)
    expect(await code(move(t, { to: 'nomination', opId: 'x1', payload: NOMINATION }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'card' } });
    expect(await code(move(t, { to: 'testing', opId: 'x2', payload: IDEA }))).toMatchObject({ code: 'illegal_transition' });
    const u = fresh();
    await nominated(u);
    expect(await code(move(u, { to: 'tested', opId: 'x3', payload: RESULT }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'nominated' } });
    expect(await code(move(u, { to: 'installed', opId: 'x4', payload: { offerId: 'o', state: 'accepted' } }))).toMatchObject({ code: 'illegal_transition' });
    expect(await code(move(u, { to: 'retired', opId: 'x5', payload: { state: 'no_offer' } }))).toMatchObject({ code: 'illegal_transition' });
    await move(u, { to: 'testing', opId: 's2', payload: IDEA });
    expect(await code(move(u, { to: 'installed', opId: 'x6', payload: { offerId: 'o', state: 'accepted' } }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'testing' } });
    expect(await code(move(u, { to: 'retired', opId: 'x7', payload: { state: 'no_offer' } }))).toMatchObject({ code: 'illegal_transition' });
    expect(await code(move(u, { to: 'nomination', opId: 'x8', payload: NOMINATION }))).toMatchObject({ code: 'illegal_transition' });
    expect(playWrites(t).length).toBe(writes);
  });

  it('THE OWNER (the mutant: skipping the owner check): another owner, another agent on the entry, or a missing entry → refused; nothing written', async () => {
    const t = fresh();
    await nominated(t);
    const writes = playWrites(t).length;
    expect(await code(move(t, { ownerId: 'intruder', to: 'nomination', opId: 'x1', payload: NOMINATION }))).toMatchObject({ status: 403, code: 'forbidden' });
    // an entry under the path whose own agentId names another agent
    t.store.set(playPath('c1'), { ...t.store.get(playPath('c1')), agentId: 'agent-other' });
    expect(await code(move(t, { to: 'nomination', opId: 'x2', payload: NOMINATION }))).toMatchObject({ status: 403, code: 'forbidden' });
    expect(await code(move(t, { entryId: 'nope', to: 'nomination', opId: 'x3', payload: NOMINATION }))).toMatchObject({ status: 404, code: 'not_found' });
    expect(playWrites(t).length).toBe(writes);
  });

  it('idempotent by op id: the same transition again is the entry, no second write; another transition under that op id → op_conflict', async () => {
    const t = fresh();
    await nominated(t);
    const a = await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    const writes = playWrites(t).length;
    const b = await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION, nowIso: LATEST });
    expect(b).toEqual({ idempotent: true, entry: a.entry });
    expect(playWrites(t).length).toBe(writes);
    expect(await code(move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, state: 'declined' } }))).toMatchObject({ status: 409, code: 'op_conflict' });
    expect(playWrites(t).length).toBe(writes);
  });

  it('bound to the entry\'s own records: another nomination, another book, another idea → 409 nomination_mismatch; nothing written', async () => {
    const t = fresh();
    await nominated(t);
    expect(await code(move(t, { to: 'nomination', opId: 'x1', payload: { ...NOMINATION, nominationId: 'nom_other' } }))).toMatchObject({ status: 409, code: 'nomination_mismatch' });
    expect(await code(move(t, { to: 'testing', opId: 'x2', payload: { ...IDEA, bookId: 'book-other' } }))).toMatchObject({ code: 'nomination_mismatch' });
    await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    expect(await code(move(t, { to: 'tested', opId: 'x3', payload: { ...RESULT, ideaId: 'idea-other' } }))).toMatchObject({ code: 'nomination_mismatch' });
    expect(t.store.get(playPath('c1')).stage).toBe('testing');
  });

  it('a payload or a transition the ledger does not take → 400 invalid_transition, before any read', async () => {
    const t = fresh();
    await nominated(t);
    const reads = t.readLog.length;
    for (const [over, why] of [
      [{ to: 'drilled', payload: {} }, 'to'],
      [{ to: 'card', payload: {} }, 'to'],
      [{ to: 'nomination', payload: { ...NOMINATION, state: 'queued' } }, 'state'],
      [{ to: 'nomination', payload: { ...NOMINATION, state: 'validated' } }, 'state'],
      [{ to: 'nomination', payload: { ...NOMINATION, reason: 'x'.repeat(2001) } }, 'reason'],
      [{ to: 'nomination', payload: { ...NOMINATION, consideredAt: 'yesterday' } }, 'consideredAt'],
      [{ to: 'tested', payload: { ...RESULT, contractCondition: '' } }, 'result'],
      [{ to: 'installed', payload: { offerId: 'o' } }, 'offer'],
      [{ to: 'nomination', payload: NOMINATION, by: '' }, 'by'],
      [{ to: 'nomination', payload: NOMINATION, by: 'two words' }, 'by'],
    ]) expect(await code(move(t, { opId: 'x', ...over })), JSON.stringify(over).slice(0, 60)).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why } });
    expect(t.readLog.length).toBe(reads);
  });

  it('a SHELVED entry still transitions (contract V2 §7): the agent on another archetype, the idea reaches tested — and the card stays shelved, so not open', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'guardian' }));
    const r = await move(t, { to: 'tested', opId: 's3', payload: RESULT });
    expect(r.entry.stage).toBe('tested');
    const read = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(read.cards[0]).toMatchObject({ entryId: 'c1', stage: 'tested', shelved: true });
    expect(read.open).toBe(0);
    expect(isOpen(read.cards[0], 'guardian')).toBe(false);
    expect(isOpen(read.cards[0], 'momentum_chaser')).toBe(true);
  });

  it('a v1 entry moved by the server keeps no stageVocabVersion (no writer adds it)', async () => {
    const t = fresh();
    const at = await nominated(t);
    const v1 = { ...at };
    delete v1.stageVocabVersion;
    t.store.set(playPath('c1'), v1);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    expect('stageVocabVersion' in t.store.get(playPath('c1'))).toBe(false);
  });
});

describe('Build C §3 — the player\'s retire reads the one open predicate', () => {
  it('testing and an unparked tested card retire; a parked card and an installed one are no transition (409 illegal_transition)', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    const { entry } = await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    expect((await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: entry.version, nowIso: LATEST })).card.stage).toBe('retired');
    const u = fresh();
    const done = await tested(u);
    expect((await retireCard(u.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: done.entry.version, nowIso: LATEST })).card.stage).toBe('retired');
    const p = fresh();
    const parked = await tested(p);
    p.store.set(playPath('c1'), { ...parked.entry, parkedAt: LATEST });
    expect(await code(retireCard(p.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: parked.entry.version, nowIso: LATEST }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'tested' } });
    const q = fresh();
    await tested(q);
    const { entry: installed } = await applyServerTransition(q.db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', to: 'installed', opId: 's4', payload: { offerId: 'o', state: 'accepted' }, nowIso: LATEST });
    expect(await code(retireCard(q.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: installed.version, nowIso: LATEST }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'installed' } });
  });
});
