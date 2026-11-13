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
//   · the player's retire reads the one open predicate and Amendment A's player rule: an unparked `tested` card retires,
//     a `testing` one does not (CA-1); a parked card,
//     an installed one and a retired one do not.
// Over the tape suites' in-memory Firestore (real optimistic transactions).

import { describe, it, expect, vi, afterEach } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): cardStore.js imports src/data/cardStages.js and, through
// practiceFieldSeam.js, api/_utils/marketSchedule.js → src/utils/marketCalendar.js; this import of the store, never
// mocked, is the runtime guard that they stay Node-clean.
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
import {
  createCard, retireCard, readCards, applyServerTransition, parkCard, nominateCard, isOpen, isInstant, nominationRecordDefectOf, SERVER_TRANSITIONS, PLAYS_SUBCOLLECTION,
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
/** Amendment A CA-12: the owner's idea book, active, for the agent — what the nominate and Offer transactions re-read. */
const BOOK_DOC = Object.freeze({ userId: UID, kind: 'idea_book', status: 'active', attributionAgentId: AGENT });
const fresh = (agent = agentDoc()) => makeTapeDb({ [`agents/${AGENT}`]: agent, [`mandates/${BOOK}`]: BOOK_DOC });
const playPath = (id) => `agents/${AGENT}/${PLAYS_SUBCOLLECTION}/${id}`;
const playWrites = (t) => t.writeLog.filter((w) => w.path.includes(`/${PLAYS_SUBCOLLECTION}/`));
const code = async (p) => { try { await p; return null; } catch (e) { return e.cardRoute ? { status: e.status, code: e.code, extra: e.extra } : { thrown: String(e) }; } };
/** C1 fix round F1: nominate's source verifier — the route's (api/film-room/card.js) is exercised through the handler; here, a pass. */
const SOURCE_OK = async () => {};

/** A card filed, then put at `nominated` with its nomination beside it (as the C1 nominate op leaves it) — planted here, the op is item 3's. */
async function nominated(t, id = 'c1') {
  const { card } = await createCard(t.db, { uid: UID, agentId: AGENT, opId: id, payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
  const at = { ...card, stage: 'nominated', stageAt: NOW, nomination: { bookId: BOOK, nominationId: `nom_${id}`, state: 'queued' }, version: 2, stageHistory: [...card.stageHistory, { stage: 'nominated', at: NOW, by: 'player', opId: `n_${id}` }] };
  t.store.set(playPath(id), at);
  return at;
}
const move = (t, over) => applyServerTransition(t.db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', nowIso: LATER, ...over });
// Amendment A CA-4: an accepted copy names the idea it became (required); `testing` is bound to it (CA-11)
const NOMINATION = { bookId: BOOK, nominationId: 'nom_c1', state: 'accepted', ideaId: 'idea-9', reason: 'The exit came early; I will test holding through one more check.', consideredAt: '2026-11-12T14:58:00.000Z' };
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
    // Amendment A CA-3: open OUTRIGHT at card and testing; nominated and tested are decided by isOpenStage
    expect(OPEN_STAGES).toEqual(['card', 'testing']);
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

  it('C1 review C-1: a v1 entry at card (B2\'s, no stageVocabVersion) nominated by the player keeps no stageVocabVersion (the mutant: nominate rewriting a v1 entry)', async () => {
    const t = fresh();
    const { card } = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    const v1 = { ...card };
    delete v1.stageVocabVersion;
    t.store.set(playPath('c1'), v1);
    const r = await nominateCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'n1', expectedVersion: 1, nowIso: LATER, book: { bookId: BOOK, status: 'active' }, verifySource: SOURCE_OK });
    expect(r.card.stage).toBe('nominated');
    expect('stageVocabVersion' in t.store.get(playPath('c1'))).toBe(false);
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
      offered: ['tested', 'tested', 'offer'],   // Amendment A CA-5: no stage move
      installed: ['tested', 'installed', 'offer'],
      retired: ['tested', 'retired', 'offer'],
    });
    // CA-22: tested alone may also come straight from nominated (with the Practice Field's noFill fact)
    expect(Object.entries(SERVER_TRANSITIONS).filter(([, v]) => v.directFrom).map(([k, v]) => [k, v.directFrom])).toEqual([['tested', 'nominated']]);
  });

  it('nomination: copies { state, reason, consideredAt, bookId, nominationId } onto the entry, the stage stays nominated, a server row names the writer, the version moves — and nothing else changes', async () => {
    const t = fresh();
    const before = await nominated(t);
    const r = await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, stray: 'never copied' } });
    expect(r.idempotent).toBe(false);
    const after = t.store.get(playPath('c1'));
    expect(after).toEqual(r.entry);
    expect(after.nomination).toEqual({ bookId: BOOK, nominationId: 'nom_c1', state: 'accepted', reason: NOMINATION.reason, consideredAt: NOMINATION.consideredAt, ideaId: 'idea-9', thesis: null });
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
    // Amendment A CA-5 / CA-14: the offer is made first (`offered`), and `installed` names the idea and that offer
    await move(t, { to: 'offered', opId: 's3b', payload: { ideaId: 'idea-9', offerId: 'offer-1', state: 'offered' }, nowIso: LATEST });
    const c = await move(t, { to: 'installed', opId: 's4', payload: { ideaId: 'idea-9', offerId: 'offer-1', state: 'accepted' }, nowIso: LATEST });
    expect(c.entry).toMatchObject({ stage: 'installed', offer: { ideaId: 'idea-9', offerId: 'offer-1', state: 'accepted' } });
    const stored = t.store.get(playPath('c1'));
    expect(stored.stageHistory.map((h) => [h.stage, h.by, h.writer ?? null, h.event ?? null])).toEqual([
      ['card', 'player', null, null], ['nominated', 'player', null, null], ['nominated', 'server', 'practice_field', 'nomination'],
      ['testing', 'server', 'practice_field', null], ['tested', 'server', 'practice_field', null], ['tested', 'server', 'practice_field', 'offered'], ['installed', 'server', 'practice_field', null],
    ]);
    expect(stored.version).toBe(before.version + 5);
    expect(untouched(stored)).toEqual(untouched(before));
    expect('stageVocabVersion' in stored && stored.stageVocabVersion).toBe(2);   // written once at create, never again
  });

  it('retired by the server from tested, with the offer\'s state (or none)', async () => {
    const t = fresh();
    await tested(t);
    const r = await move(t, { to: 'retired', opId: 's4', payload: { ideaId: 'idea-9', offerId: null, state: 'no_offer' } });
    expect(r.entry).toMatchObject({ stage: 'retired', offer: { ideaId: 'idea-9', offerId: null, state: 'no_offer' } });
  });

  it('THE ORDER (the mutant: skipping the order check): every out-of-order move → 409 illegal_transition naming the stage; nothing written', async () => {
    const t = fresh();
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    const writes = playWrites(t).length;
    // from `card`: no server transition (the player's nominate moves it, item 3)
    expect(await code(move(t, { to: 'nomination', opId: 'x1', payload: NOMINATION }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'card' } });
    expect(await code(move(t, { to: 'testing', opId: 'x2', payload: IDEA }))).toMatchObject({ code: 'illegal_transition' });
    expect(playWrites(t).length).toBe(writes);
    const u = fresh();
    await nominated(u);
    const uWrites = playWrites(u).length;
    expect(await code(move(u, { to: 'tested', opId: 'x3', payload: RESULT }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'nominated' } });
    expect(await code(move(u, { to: 'installed', opId: 'x4', payload: { ideaId: 'idea-9', offerId: 'o', state: 'accepted' } }))).toMatchObject({ code: 'illegal_transition' });
    expect(await code(move(u, { to: 'retired', opId: 'x5', payload: { ideaId: 'idea-9', state: 'no_offer' } }))).toMatchObject({ code: 'illegal_transition' });
    expect(await code(move(u, { to: 'offered', opId: 'x5b', payload: { ideaId: 'idea-9', offerId: 'o', state: 'offered' } }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'nominated' } });
    expect(playWrites(u).length).toBe(uWrites);
    await move(u, { to: 'nomination', opId: 's1', payload: NOMINATION });   // CA-11: testing needs the accepted copy
    await move(u, { to: 'testing', opId: 's2', payload: IDEA });
    const afterTesting = playWrites(u).length;
    expect(await code(move(u, { to: 'installed', opId: 'x6', payload: { ideaId: 'idea-9', offerId: 'o', state: 'accepted' } }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'testing' } });
    expect(await code(move(u, { to: 'retired', opId: 'x7', payload: { ideaId: 'idea-9', state: 'no_offer' } }))).toMatchObject({ code: 'illegal_transition' });
    expect(await code(move(u, { to: 'nomination', opId: 'x8', payload: NOMINATION }))).toMatchObject({ code: 'illegal_transition' });
    expect(playWrites(u).length).toBe(afterTesting);
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
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });   // CA-11: testing needs the accepted copy
    expect(await code(move(t, { to: 'testing', opId: 'x4', payload: { ...IDEA, bookId: 'book-other' } }))).toMatchObject({ code: 'nomination_mismatch' });
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
      [{ to: 'installed', payload: { ideaId: 'i', offerId: 'o' } }, 'offer'],
      [{ to: 'installed', payload: { offerId: 'o', state: 'accepted' } }, 'ideaId'],
      [{ to: 'retired', payload: { offerId: null, state: 'no_offer' } }, 'ideaId'],
      [{ to: 'offered', payload: { ideaId: 'i', offerId: 'o', state: 'accepted' } }, 'offer'],
      [{ to: 'tested', payload: { ...RESULT, noFill: 'yes' } }, 'noFill'],
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
  it('an unparked tested card retires; a testing card does not (Amendment A CA-1, its own rows below); a parked card and an installed one are no transition (409 illegal_transition)', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    const { entry } = await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: entry.version, nowIso: LATEST }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'testing' } });
    const u = fresh();
    const done = await tested(u);
    expect((await retireCard(u.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: done.entry.version, nowIso: LATEST })).card.stage).toBe('retired');
    const p = fresh();
    const parked = await tested(p);
    p.store.set(playPath('c1'), { ...parked.entry, parkedAt: LATEST });
    expect(await code(retireCard(p.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: parked.entry.version, nowIso: LATEST }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'tested' } });
    const q = fresh();
    await tested(q);
    await applyServerTransition(q.db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', to: 'offered', opId: 's3b', payload: { ideaId: 'idea-9', offerId: 'o', state: 'offered' }, nowIso: LATEST });
    const { entry: installed } = await applyServerTransition(q.db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', to: 'installed', opId: 's4', payload: { ideaId: 'idea-9', offerId: 'o', state: 'accepted' }, nowIso: LATEST });
    expect(await code(retireCard(q.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: installed.version, nowIso: LATEST }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'installed' } });
  });
});

describe('Build C §4 — the store refuses an Offer card without an open book, and never writes `drill`', () => {
  it('createCard with route offer and no book, or a book not active → 409 book_not_open, nothing written (the mutant: an Offer create with no book writing the entry); with an open book both halves land', async () => {
    const t = fresh();
    for (const book of [null, { bookId: 'b', status: 'closed' }, { bookId: '', status: 'active' }, { status: 'active' }]) {
      expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'o1', payload: payload({ route: 'offer' }), nowIso: NOW, battleArchetype: 'momentum_chaser', book })), JSON.stringify(book)).toMatchObject({ status: 409, code: 'book_not_open' });
    }
    expect(t.writeLog).toEqual([]);
    const r = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'o1', payload: payload({ route: 'offer' }), nowIso: NOW, battleArchetype: 'momentum_chaser', book: { bookId: BOOK, status: 'active' } });
    expect(r.card).toMatchObject({ stage: 'nominated', nomination: { bookId: BOOK, nominationId: 'o1', state: 'queued' } });
    expect(t.writeLog.map((w) => [w.op, w.path])).toEqual([['tx.create', playPath('o1')], ['tx.set', `mandates/${BOOK}/nominations/o1`]]);
  });
  it('createCard with route drill → 400 invalid_route, whatever the caller parsed; nothing written', async () => {
    const t = fresh();
    expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'd1', payload: payload({ route: 'drill' }), nowIso: NOW, battleArchetype: 'momentum_chaser', book: { bookId: BOOK, status: 'active' } }))).toMatchObject({ status: 400, code: 'invalid_route' });
    expect(t.writeLog).toEqual([]);
  });
});

describe('C1 item 7 — park (refinement R-C1-2; acceptance C-PARK)', () => {
  const park = (t, over = {}) => parkCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'p1', nowIso: LATEST, ...over });

  it('a tested card parks: parkedAt set, version + 1, a player row (event parked, the stage unchanged) — and nothing else of the card; it counts open no more', async () => {
    const t = fresh();
    const { entry } = await tested(t);
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(1);
    const r = await park(t, { expectedVersion: entry.version });
    expect(r.idempotent).toBe(false);
    const after = t.store.get(playPath('c1'));
    expect(after).toEqual(r.card);
    expect(after.parkedAt).toBe(LATEST);
    expect(after.stage).toBe('tested');
    expect(after.stageAt).toBe(entry.stageAt);
    expect(after.version).toBe(entry.version + 1);
    expect(after.stageHistory.at(-1)).toEqual({ stage: 'tested', event: 'parked', at: LATEST, by: 'player', opId: 'p1', opFingerprint: expect.any(String) });
    const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(entry[k])).sort();
    expect(changed).toEqual(['parkedAt', 'stageHistory', 'version']);
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(0);
  });

  it('idempotent by op id; another request under it → op_conflict; it cannot be parked twice (409 illegal_transition)', async () => {
    const t = fresh();
    const { entry } = await tested(t);
    const a = await park(t, { expectedVersion: entry.version });
    const writes = playWrites(t).length;
    expect(await park(t, { expectedVersion: entry.version })).toEqual({ idempotent: true, card: a.card });
    expect(playWrites(t).length).toBe(writes);
    expect(await code(park(t, { expectedVersion: entry.version + 1 }))).toMatchObject({ status: 409, code: 'op_conflict' });
    expect(await code(park(t, { opId: 'p2', expectedVersion: entry.version + 1 }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'tested' } });
    expect(playWrites(t).length).toBe(writes);
  });

  it('an open card cannot be parked (the mutant: park on an open card) — card, nominated, testing → 409 illegal_transition; a stale version → version_conflict; another owner → 403; nothing written', async () => {
    const t = fresh();
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    expect(await code(park(t, { expectedVersion: 1 }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'card' } });
    expect(t.writeLog.filter((w) => w.op === 'tx.update')).toEqual([]);
    const u = fresh();
    const at = await nominated(u);
    expect(await code(park(u, { expectedVersion: at.version }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'nominated' } });
    await move(u, { to: 'nomination', opId: 's1', payload: NOMINATION });
    const { entry } = await move(u, { to: 'testing', opId: 's2', payload: IDEA });
    const uUpdates = u.writeLog.filter((w) => w.op === 'tx.update').length;
    expect(await code(park(u, { expectedVersion: entry.version }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'testing' } });
    expect(await code(park(u, { expectedVersion: 1 }))).toMatchObject({ code: 'version_conflict' });
    expect(await code(park(u, { uid: 'intruder', expectedVersion: entry.version }))).toMatchObject({ status: 403, code: 'forbidden' });
    expect(u.writeLog.filter((w) => w.op === 'tx.update').length).toBe(uUpdates);
  });

  it('a shelved tested card parks (parking moves no stage); it stays shelved', async () => {
    const t = fresh();
    const { entry } = await tested(t);
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'guardian' }));
    await park(t, { expectedVersion: entry.version });
    const read = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(read.cards[0]).toMatchObject({ entryId: 'c1', shelved: true, parkedAt: LATEST });
  });
});

// ── the C1 review's fixes (docs/audits/20261112_BUILD_FILM_ROOM_C1_CHAIN.md §6) ─────────────────────────────────────
describe('C1 review — the helper\'s guards and the replay namespaces', () => {
  it('A-1: a `to` that is not a string — an array, a String object — is refused 400 invalid_transition, nothing read (it would coerce to a key and miss every branch)', async () => {
    const t = fresh();
    await nominated(t);
    const reads = t.readLog.length;
    for (const to of [['nomination'], ['testing'], new String('tested')]) {
      expect(await code(move(t, { to, opId: 'z1', payload: { state: 'x' } })), String(to)).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why: 'to' } });
    }
    expect(t.readLog.length).toBe(reads);
    expect(t.store.get(playPath('c1')).nomination).toEqual({ bookId: BOOK, nominationId: 'nom_c1', state: 'queued' });
  });

  it('A-10: the ids that build the path are held to the forge-id class (no slash, no reserved __id__); the instant must be one', async () => {
    const t = fresh();
    await nominated(t);
    for (const over of [{ entryId: 'c1/deeper' }, { entryId: '__c1__' }, { agentId: 'agent-1/x' }]) {
      expect(await code(move(t, { ...over, to: 'nomination', opId: 'z2', payload: NOMINATION })), JSON.stringify(over)).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why: 'ids' } });
    }
    for (const nowIso of [12345, 'later', null]) expect(await code(move(t, { nowIso, to: 'nomination', opId: 'z3', payload: NOMINATION })), String(nowIso)).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why: 'nowIso' } });
  });

  it('A-5: a replay is its own writer\'s — a server op id equal to the player\'s nominate op id (the nomination id) is no replay and transitions; a player park under a server row\'s op id is no replay either', async () => {
    const t = fresh();
    const at = await nominated(t);
    const playerOp = at.stageHistory.at(-1).opId;   // the player's nominate op id
    const r = await move(t, { to: 'nomination', opId: playerOp, payload: NOMINATION });
    expect(r.idempotent).toBe(false);
    expect(r.entry.nomination.state).toBe('accepted');
    await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    const done = await move(t, { to: 'tested', opId: 'srv-4', payload: RESULT });
    // the player's park under the op id a server row holds: parks, a player row of its own
    const parked = await parkCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'srv-4', expectedVersion: done.entry.version, nowIso: LATEST });
    expect(parked.idempotent).toBe(false);
    expect(parked.card.parkedAt).toBe(LATEST);
    // and each replays as its own writer's
    expect((await parkCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'srv-4', expectedVersion: done.entry.version, nowIso: LATEST })).idempotent).toBe(true);
    expect((await move(t, { to: 'tested', opId: 'srv-4', payload: RESULT })).idempotent).toBe(true);
  });
});

// ── the mutating lens's survivors (report §6), each with the row that kills it ─────────────────────────────────────
describe('C1 review — the mutating lens\'s survivors', () => {
  it('D-M09: a reason of exactly NOMINATION_REASON_MAX code points is kept (2000 emoji — code points, not UTF-16 units); one more is refused', async () => {
    const t = fresh();
    await nominated(t);
    const r = await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, reason: '😀'.repeat(2000) } });
    expect([...r.entry.nomination.reason]).toHaveLength(2000);
    const u = fresh();
    await nominated(u);
    expect(await code(move(u, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, reason: 'x'.repeat(2001) } }))).toMatchObject({ status: 400, extra: { why: 'reason' } });
  });

  it('D-M08: the writer is part of the request — the same transition under the same op id from ANOTHER writer is 409 op_conflict, not a replay', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    expect(await code(move(t, { by: 'practice_field.t2', to: 'nomination', opId: 's1', payload: NOMINATION }))).toMatchObject({ status: 409, code: 'op_conflict' });
    expect((await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION })).idempotent).toBe(true);
  });
});

// ── Amendment A CA-3 — a declined or expired nomination closes the card ─────────────────────────────────────────────
describe('Amendment A CA-3 — the open predicate: a nominated card closes when the agent did not take it', () => {
  const STATES = ['queued', 'considered', 'accepted', 'deferred', 'declined', 'expired', 'withdrawn'];
  it('THE PREDICATE, exhaustively: every stage × parked/unparked, and nominated × every copy state and none (v1) — open outright at card and testing; nominated unless declined/expired/withdrawn; tested until parked (the mutants: a declined or expired card counted open)', () => {
    const open = (e) => isOpenStage(e);
    expect(CARD_STAGES.map((stage) => [stage, open({ stage }), open({ stage, parkedAt: NOW })])).toEqual([
      ['card', true, true], ['nominated', true, true], ['testing', true, true], ['tested', true, false], ['installed', false, false], ['retired', false, false],
    ]);
    expect(STATES.map((state) => [state, open({ stage: 'nominated', nomination: { state } })])).toEqual([
      ['queued', true], ['considered', true], ['accepted', true], ['deferred', true], ['declined', false], ['expired', false], ['withdrawn', false],
    ]);
    // a v1 entry at nominated (no copy) stays open; the copy's state closes only `nominated` — never another stage
    expect(open({ stage: 'nominated' })).toBe(true);
    expect(open({ stage: 'card', nomination: { state: 'declined' } })).toBe(true);
    expect(open({ stage: 'testing', nomination: { state: 'expired' } })).toBe(true);
    expect(stages.NOT_TAKEN_STATES).toEqual(['declined', 'expired', 'withdrawn']);
    expect(STATES.map((state) => stages.isNotTaken({ stage: 'nominated', nomination: { state } }))).toEqual([false, false, false, false, true, true, true]);
    expect(stages.isNotTaken({ stage: 'retired', nomination: { state: 'withdrawn' } })).toBe(false);
  });

  it('shelving is judged beside it: a shelved card is never open; an unshelved not-taken card is not open either', () => {
    const e = (over) => ({ stage: 'nominated', archetypeCodeId: 'momentum_chaser', nomination: { state: 'queued' }, ...over });
    expect(isOpen(e(), 'momentum_chaser')).toBe(true);
    expect(isOpen(e(), 'guardian')).toBe(false);
    expect(isOpen(e({ nomination: { state: 'declined' } }), 'momentum_chaser')).toBe(false);
    expect(isOpen(e({ nomination: { state: 'expired' } }), ['guardian', 'momentum_chaser'])).toBe(false);
  });

  for (const state of ['declined', 'expired']) {
    it(`through the real writers: a copy ${state} closes the card — the open count drops, the cap admits a new card WITHOUT retiring it, and the player cannot retire it (it is not open)`, async () => {
      const t = fresh();
      await nominated(t);
      for (let i = 0; i < 4; i += 1) await createCard(t.db, { uid: UID, agentId: AGENT, opId: `w${i}`, payload: payload({ note: `Watch ${i}.` }), nowIso: NOW, battleArchetype: 'momentum_chaser' });
      expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(5);
      expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'w9', payload: payload({ note: 'One more.' }), nowIso: NOW, battleArchetype: 'momentum_chaser' }))).toMatchObject({ status: 409, code: 'cap_reached' });
      const { entry } = await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, state, reason: state === 'declined' ? 'Not for this book.' : null } });
      expect(entry).toMatchObject({ stage: 'nominated', nomination: { state } });
      expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(4);
      expect((await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'w9', payload: payload({ note: 'One more.' }), nowIso: NOW, battleArchetype: 'momentum_chaser' })).open).toBe(5);
      // the not-taken card itself was never retired, and cannot be
      expect(t.store.get(playPath('c1')).stage).toBe('nominated');
      expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: entry.version, nowIso: LATEST }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated' } });
    });
  }

  it('deferred stays open; a v1 drill entry with no copy stays open and retirable', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, state: 'deferred', reason: 'Later.' } });
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(1);
    const u = fresh();
    const { card } = await createCard(u.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    const v1 = { ...card, route: 'drill', stage: 'nominated' };
    delete v1.stageVocabVersion;
    u.store.set(playPath('c1'), v1);
    expect((await readCards(u.db, { uid: UID, agentId: AGENT })).open).toBe(1);
    expect((await retireCard(u.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 1, nowIso: LATEST })).card.stage).toBe('retired');
  });
});

// ── Amendment A CA-1, CA-2, CA-5 (retire side) — the player's retire and the withdrawal ─────────────────────────────
const seam = await import('./practiceFieldSeam.js');
describe('Amendment A CA-1 / CA-2 / CA-5 — what the player may retire, and the withdrawal the record decides', () => {
  const RECORD_PATH = `mandates/${BOOK}/nominations/nom_c1`;
  const freshWith = (hooks) => makeTapeDb({ [`agents/${AGENT}`]: agentDoc(), [`mandates/${BOOK}`]: BOOK_DOC }, { hooks });
  /** The book's record for the planted nomination (`nom_c1`), the default builder's shape, at `state`. */
  const withRecord = (t, state, over = {}) => {
    const rec = seam.PRACTICE_FIELD_SEAM_DEFAULTS.buildNominationDoc({ entryId: 'c1', situationId: 'stalled', questionId: 'stalled.want', questionVersion: 1, nowIso: NOW, expiresAfterSessions: 10 });
    t.store.set(RECORD_PATH, { ...rec, state, ...over });
    return t.store.get(RECORD_PATH);
  };
  const retire = (t, over = {}) => retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', nowIso: LATEST, ...over });
  const bookWrites = (t) => t.writeLog.filter((w) => w.path.startsWith('mandates/'));
  afterEach(() => seam.resetPracticeFieldSeam());

  it('CA-1: a testing card\'s retire → 409 illegal_transition with { stage: \'testing\' } and nothing else; nothing written; the server\'s tested still lands (the mutant: a testing retire accepted)', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    const { entry } = await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    const writes = t.writeLog.length;
    expect(await code(retire(t, { expectedVersion: entry.version }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'testing' } });
    expect(t.writeLog.length).toBe(writes);
    expect((await move(t, { to: 'tested', opId: 's3', payload: RESULT })).entry.stage).toBe('tested');
    expect(stages.isRetirableByPlayer({ stage: 'testing' })).toBe(false);
  });

  it('CA-1: the refusal comes after the owner, replay, version and shelving checks — a stale version, another owner and a shelved testing card answer their own refusals; a successful retire\'s replay still answers', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    const { entry } = await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    expect(await code(retire(t, { expectedVersion: 1 }))).toMatchObject({ code: 'version_conflict' });
    expect(await code(retire(t, { uid: 'intruder', expectedVersion: entry.version }))).toMatchObject({ code: 'forbidden' });
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'guardian' }));
    expect(await code(retire(t, { expectedVersion: entry.version }))).toMatchObject({ code: 'shelved' });
    // a successful retire, replayed after its card moved on: the replay answers first
    const u = fresh();
    const done = await tested(u);
    const first = await retire(u, { expectedVersion: done.entry.version });
    expect(first.card.stage).toBe('retired');
    expect(await retire(u, { expectedVersion: done.entry.version })).toEqual({ idempotent: true, card: first.card });
  });

  it('CA-5 (retire side): a tested card with an offer waiting → 409 { stage: \'tested\', offerState: \'offered\' }; parking is unaffected', async () => {
    const t = fresh();
    const { entry } = await tested(t);
    t.store.set(playPath('c1'), { ...entry, offer: { ideaId: 'idea-9', offerId: 'offer-1', state: 'offered' } });
    expect(await code(retire(t, { expectedVersion: entry.version }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'tested', offerState: 'offered' } });
    expect((await parkCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'p1', expectedVersion: entry.version, nowIso: LATEST })).card.parkedAt).toBe(LATEST);
  });

  it('isRetirableByPlayer (pure), every stage and copy state: card yes; nominated with no copy (v1) or a copy queued, considered, deferred yes — accepted, declined, expired, withdrawn no; testing no; tested unparked with no offer yes, with an offer no; parked, installed, retired no', () => {
    const r = stages.isRetirableByPlayer;
    expect(r({ stage: 'card' })).toBe(true);
    expect(r({ stage: 'nominated' })).toBe(true);
    expect(['queued', 'considered', 'accepted', 'deferred', 'declined', 'expired', 'withdrawn', 'weird'].map((state) => r({ stage: 'nominated', nomination: { state } }))).toEqual([true, true, false, true, false, false, false, false]);
    expect(r({ stage: 'testing' })).toBe(false);
    expect(r({ stage: 'tested' })).toBe(true);
    expect(r({ stage: 'tested', offer: { state: 'offered' } })).toBe(false);
    expect(r({ stage: 'tested', parkedAt: NOW })).toBe(false);
    expect(r({ stage: 'installed' })).toBe(false);
    expect(r({ stage: 'retired' })).toBe(false);
  });

  for (const state of ['queued', 'considered', 'deferred']) {
    it(`CA-2: the record ${state} → the record WITHDRAWN (the seam's buildWithdrawal) and the entry retired, its copy withdrawn — one transaction, version + 1 once (the mutant: a withdrawal that leaves the record queued)`, async () => {
      const t = fresh();
      const at = await nominated(t);
      if (state !== 'queued') await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, state, reason: 'Not yet.' } });
      const before = t.store.get(playPath('c1'));
      const rec = withRecord(t, state);
      const r = await retire(t, { expectedVersion: before.version });
      expect(r.idempotent).toBe(false);
      const after = t.store.get(playPath('c1'));
      expect(after).toEqual(r.card);
      expect(after).toMatchObject({ stage: 'retired', stageAt: LATEST, version: before.version + 1, nomination: { ...before.nomination, state: 'withdrawn' } });
      expect(after.stageHistory.at(-1)).toMatchObject({ stage: 'retired', at: LATEST, by: 'player', opId: 'r1' });
      expect(t.store.get(RECORD_PATH)).toEqual({ ...rec, state: 'withdrawn', withdrawnAt: LATEST, stateHistory: [...rec.stateHistory, { state: 'withdrawn', at: LATEST, by: 'player' }] });
      expect(t.writeLog.slice(-2).map((w) => [w.op, w.path])).toEqual([['tx.set', RECORD_PATH], ['tx.update', playPath('c1')]]);
      expect(at.nomination.nominationId).toBe('nom_c1');
    });
  }

  it('CA-2: the record ACCEPTED while the copy lags at queued → 409 { stage: \'nominated\', nominationState: \'accepted\' }; nothing written (the mutant: a retire with an accepted record but a queued copy accepted)', async () => {
    const t = fresh();
    const at = await nominated(t);
    withRecord(t, 'accepted');
    const writes = t.writeLog.length;
    expect(await code(retire(t, { expectedVersion: at.version }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated', nominationState: 'accepted' } });
    expect(t.writeLog.length).toBe(writes);
    expect(t.store.get(RECORD_PATH).state).toBe('accepted');
  });

  it('CA-2: the copy itself accepted → refused on the copy\'s side with the same words, the record never read', async () => {
    const t = fresh();
    await nominated(t);
    const { entry } = await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    withRecord(t, 'accepted');
    const reads = t.readLog.length;
    expect(await code(retire(t, { expectedVersion: entry.version }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated', nominationState: 'accepted' } });
    expect(t.readLog.slice(reads).filter((l) => l.includes('mandates/'))).toEqual([]);
  });

  for (const state of ['declined', 'expired', 'withdrawn']) {
    it(`CA-2: the record ${state} while the copy lags at queued → the entry retires, its copy ${state}; nothing written to the book`, async () => {
      const t = fresh();
      const at = await nominated(t);
      const rec = withRecord(t, state);
      const r = await retire(t, { expectedVersion: at.version });
      expect(r.card).toMatchObject({ stage: 'retired', version: at.version + 1, nomination: { ...at.nomination, state } });
      expect(bookWrites(t)).toEqual([]);
      expect(t.store.get(RECORD_PATH)).toEqual(rec);
    });
  }

  it('CA-2: no record document → the entry retires, its copy as it was; nothing written to the book; a v1 entry with no nomination reads no record', async () => {
    const t = fresh();
    const at = await nominated(t);
    const r = await retire(t, { expectedVersion: at.version });
    expect(r.card).toMatchObject({ stage: 'retired', nomination: at.nomination });
    expect(bookWrites(t)).toEqual([]);
    const u = fresh();
    const { card } = await createCard(u.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    const v1 = { ...card, route: 'drill', stage: 'nominated' };
    delete v1.stageVocabVersion;
    u.store.set(playPath('c1'), v1);
    const reads = u.readLog.length;
    expect((await retire(u, { expectedVersion: 1 })).card.stage).toBe('retired');
    expect(u.readLog.slice(reads).filter((l) => l.includes('mandates/'))).toEqual([]);
  });

  it('CA-2 fails closed: a record read that fails, a record state not in NOMINATION_STATES → 503 nomination_unavailable, nothing written, the card not retired (the mutant: a failed record read that retires anyway)', async () => {
    let failRead = false;
    const t = freshWith({ beforeRead: (label) => { if (failRead && label === `tx:${RECORD_PATH}`) throw new Error('record read failed'); } });
    const at = await nominated(t);
    withRecord(t, 'queued');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    failRead = true;
    const writes = t.writeLog.length;
    expect(await code(retire(t, { expectedVersion: at.version }))).toMatchObject({ status: 503, code: 'nomination_unavailable' });
    failRead = false;
    withRecord(t, 'weird');
    expect(await code(retire(t, { expectedVersion: at.version }))).toMatchObject({ status: 503, code: 'nomination_unavailable' });
    expect(t.writeLog.length).toBe(writes);
    expect(t.store.get(playPath('c1')).stage).toBe('nominated');
    expect(errors.mock.calls.some((c) => String(c.join(' ')).includes('record read failed'))).toBe(true);
    errors.mockRestore();
  });

  it('CA-2: a contention abort (gRPC ABORTED) on the record read is rethrown as it came — never mapped to nomination_unavailable (the mutant: ABORTED swallowed)', async () => {
    const t = freshWith({ beforeRead: (label) => { if (label === `tx:${RECORD_PATH}`) { const e = new Error('ABORTED: contention'); e.code = 10; throw e; } } });
    const at = await nominated(t);
    withRecord(t, 'queued');
    const err = await retire(t, { expectedVersion: at.version }).then(() => null, (e) => e);
    expect(err).toMatchObject({ code: 10, message: 'ABORTED: contention' });
    expect(err.cardRoute).toBeUndefined();
    expect(t.store.get(playPath('c1')).stage).toBe('nominated');
  });

  const MALFORMED = [
    ['the builder throws', () => { throw new Error('no shape'); }],
    ['an array', (rec) => [rec]],
    ['a class instance', (rec) => Object.assign(new (class W {})(), rec, { state: 'withdrawn' })],
    ['state queued', (rec) => ({ ...rec, state: 'queued' })],
    ['no state', (rec) => { const o = { ...rec }; delete o.state; return o; }],
    ['another entry\'s source', (rec) => ({ ...rec, state: 'withdrawn', source: { ...rec.source, entryId: 'other' } })],
    ['no source', (rec) => { const o = { ...rec, state: 'withdrawn' }; delete o.source; return o; }],
  ];
  for (const [name, build] of MALFORMED) {
    it(`CA-2 fails closed — the withdrawal builder: ${name} → 503 nomination_unavailable, nothing written, the card not retired`, async () => {
      const t = fresh();
      const at = await nominated(t);
      withRecord(t, 'queued');
      seam.setPracticeFieldSeam({ buildWithdrawal: build });
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const writes = t.writeLog.length;
      expect(await code(retire(t, { expectedVersion: at.version })), name).toMatchObject({ status: 503, code: 'nomination_unavailable' });
      expect(t.writeLog.length).toBe(writes);
      expect(t.store.get(RECORD_PATH).state).toBe('queued');
      errors.mockRestore();
    });
  }

  it('CA-2: a withdrawal\'s replay answers after the record and the book are gone (the replay is judged first); a second retire is no transition', async () => {
    const t = fresh();
    const at = await nominated(t);
    withRecord(t, 'queued');
    const first = await retire(t, { expectedVersion: at.version });
    t.store.delete(RECORD_PATH);
    t.store.delete(`mandates/${BOOK}`);
    const writes = t.writeLog.length;
    expect(await retire(t, { expectedVersion: at.version })).toEqual({ idempotent: true, card: first.card });
    expect(await code(retire(t, { opId: 'r2', expectedVersion: first.card.version }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'retired' } });
    expect(t.writeLog.length).toBe(writes);
  });

  it('CA-2 concurrency — the retire first, the Practice Field\'s copy after: the copy finds the entry retired and is refused (no resurrection); the record stays withdrawn', async () => {
    const t = fresh();
    const at = await nominated(t);
    withRecord(t, 'queued');
    await retire(t, { expectedVersion: at.version });
    expect(await code(move(t, { to: 'nomination', opId: 's1', payload: NOMINATION }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'retired' } });
    expect(t.store.get(playPath('c1')).stage).toBe('retired');
    expect(t.store.get(RECORD_PATH).state).toBe('withdrawn');
  });

  it('CA-2 concurrency — the Practice Field accepts (record and copy) BETWEEN the retire\'s record read and its commit: the retire\'s commit conflicts, is retried, and is refused accepted; the record stays accepted, the entry nominated', async () => {
    let strike = false;
    const t = freshWith({
      afterTxRead: async (label, db) => {
        if (!strike || label !== RECORD_PATH) return;
        strike = false;
        await db.collection('mandates').doc(BOOK).collection('nominations').doc('nom_c1').set({ ...t.store.get(RECORD_PATH), state: 'accepted' });
        await applyServerTransition(db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', to: 'nomination', opId: 's1', payload: NOMINATION, nowIso: LATER });
      },
    });
    const at = await nominated(t);
    withRecord(t, 'queued');
    strike = true;
    const retries = t.db.txRetries;
    expect(await code(retire(t, { expectedVersion: at.version }))).toMatchObject({ status: 409, code: 'version_conflict' });
    expect(t.db.txRetries).toBeGreaterThan(retries);
    expect(t.store.get(RECORD_PATH).state).toBe('accepted');
    expect(t.store.get(playPath('c1'))).toMatchObject({ stage: 'nominated', nomination: { state: 'accepted' } });
    // and with the version the player now sees: refused on the copy's side
    expect(await code(retire(t, { opId: 'r2', expectedVersion: at.version + 1 }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated', nominationState: 'accepted' } });
  });

  it('CA-2 concurrency — the record alone accepted between the retire\'s read and its commit (the copy not yet delivered): retried, the record now decides — refused accepted, nothing written', async () => {
    let strike = false;
    const t = freshWith({
      afterTxRead: async (label, db) => {
        if (!strike || label !== RECORD_PATH) return;
        strike = false;
        await db.collection('mandates').doc(BOOK).collection('nominations').doc('nom_c1').set({ ...t.store.get(RECORD_PATH), state: 'accepted' });
      },
    });
    const at = await nominated(t);
    withRecord(t, 'queued');
    strike = true;
    expect(await code(retire(t, { expectedVersion: at.version }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated', nominationState: 'accepted' } });
    expect(t.store.get(RECORD_PATH).state).toBe('accepted');
    expect(t.store.get(playPath('c1')).stage).toBe('nominated');
  });

  it('CA-1 concurrency — the idea reaches testing between the retire\'s reads and its commit: retried, refused { stage: \'testing\' }; and the retire first, then testing: testing is refused (no idea runs on a retired card)', async () => {
    let strike = false;
    const t = freshWith({
      afterTxRead: async (label, db) => {
        if (!strike || label !== RECORD_PATH) return;
        strike = false;
        await db.collection('mandates').doc(BOOK).collection('nominations').doc('nom_c1').set({ ...t.store.get(RECORD_PATH), state: 'accepted' });
        await applyServerTransition(db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', to: 'nomination', opId: 's1', payload: NOMINATION, nowIso: LATER });
        await applyServerTransition(db, { entryId: 'c1', ownerId: UID, agentId: AGENT, by: 'practice_field', to: 'testing', opId: 's2', payload: IDEA, nowIso: LATER });
      },
    });
    const at = await nominated(t);
    withRecord(t, 'queued');
    strike = true;
    expect(await code(retire(t, { expectedVersion: at.version }))).toMatchObject({ code: 'version_conflict' });
    const now = t.store.get(playPath('c1'));
    expect(now.stage).toBe('testing');
    expect(await code(retire(t, { opId: 'r2', expectedVersion: now.version }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'testing' } });
    // the other order
    const u = fresh();
    const at2 = await nominated(u);
    withRecord(u, 'queued');
    await retire(u, { expectedVersion: at2.version });
    expect(await code(move(u, { to: 'testing', opId: 's2', payload: IDEA }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'retired' } });
  });

  it('CA-2: the transition helper never copies `withdrawn` (400 invalid_transition, before any read)', async () => {
    const t = fresh();
    await nominated(t);
    const reads = t.readLog.length;
    expect(await code(move(t, { to: 'nomination', opId: 'x', payload: { ...NOMINATION, state: 'withdrawn' } }))).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why: 'state' } });
    expect(t.readLog.length).toBe(reads);
    expect(stages.NOMINATION_STATES).toContain('withdrawn');
  });
});

// ── Amendment A CA-11 and CA-4 — the nomination order, the accepted idea, and the agent's words with their own times ─
describe('Amendment A CA-11 — the nomination order, judged against the entry\'s copy', () => {
  const COPYABLE = ['considered', 'accepted', 'deferred', 'declined', 'expired'];
  const ORDER = { queued: ['considered', 'accepted', 'deferred', 'declined', 'expired'], considered: ['accepted', 'deferred', 'declined'], deferred: ['considered', 'accepted', 'declined'] };
  /** The planted nominated entry with its copy at `from`. */
  const at = async (t, from) => {
    const e = await nominated(t);
    t.store.set(playPath('c1'), { ...e, nomination: { ...e.nomination, state: from } });
    return t.store.get(playPath('c1'));
  };
  const copyOf = (state, over = {}) => ({ bookId: BOOK, nominationId: 'nom_c1', state, reason: `Reason ${state}.`, consideredAt: '2026-11-12T14:58:00.000Z', ...(state === 'accepted' ? { ideaId: 'idea-9' } : {}), ...over });

  it('the table is the one export\'s, exactly as ruled', () => {
    expect(JSON.parse(JSON.stringify(stages.NOMINATION_ORDER))).toEqual(ORDER);
  });

  it('EXHAUSTIVE from × to: every copy state × every copyable state — allowed exactly where the table says; anything else 409 illegal_transition { nominationState }, nothing written (the mutants: "declined, then testing"; "deferred, then expired")', async () => {
    for (const from of stages.NOMINATION_STATES) {
      for (const to of COPYABLE) {
        const t = fresh();
        const e = await at(t, from);
        const writes = playWrites(t).length;
        const r = await code(move(t, { to: 'nomination', opId: `x_${from}_${to}`, payload: copyOf(to) }));
        if ((ORDER[from] ?? []).includes(to)) {
          expect(r, `${from} → ${to}`).toBeNull();
          expect(t.store.get(playPath('c1')).nomination.state, `${from} → ${to}`).toBe(to);
          expect(t.store.get(playPath('c1')).version).toBe(e.version + 1);
        } else {
          expect(r, `${from} → ${to}`).toEqual({ status: 409, code: 'illegal_transition', extra: { nominationState: from } });
          expect(playWrites(t).length, `${from} → ${to}`).toBe(writes);
        }
      }
    }
  });

  it('a replay is judged before the order: an accepted copy\'s own op again is the idempotent answer, though accepted moves nowhere', async () => {
    const t = fresh();
    await nominated(t);
    const a = await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    expect(await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION })).toEqual({ idempotent: true, entry: a.entry });
    expect(await code(move(t, { to: 'nomination', opId: 's9', payload: { ...NOMINATION, state: 'declined' } }))).toMatchObject({ code: 'illegal_transition', extra: { nominationState: 'accepted' } });
  });

  it('a copy delivered late, after a later state, is refused; a lost copy does not block the next (queued answers directly)', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's2', payload: copyOf('accepted') });   // considered never arrived
    expect(await code(move(t, { to: 'nomination', opId: 's1', payload: copyOf('considered') }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { nominationState: 'accepted' } });
    expect(t.store.get(playPath('c1')).nomination.state).toBe('accepted');
  });

  it('testing needs the ACCEPTED copy, bound to its ideaId and its book: from queued, considered, deferred, declined → 409 nomination_mismatch; another idea → 409 nomination_mismatch; the copy\'s own idea → testing', async () => {
    for (const from of ['queued', 'considered', 'deferred', 'declined']) {
      const t = fresh();
      if (from === 'queued') await nominated(t);
      else { await nominated(t); await move(t, { to: 'nomination', opId: 's1', payload: copyOf(from) }); }
      expect(await code(move(t, { to: 'testing', opId: 's2', payload: IDEA })), from).toMatchObject({ status: 409, code: 'nomination_mismatch' });
      expect(t.store.get(playPath('c1')).stage, from).toBe('nominated');
    }
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    expect(await code(move(t, { to: 'testing', opId: 's2', payload: { ...IDEA, ideaId: 'idea-other' } }))).toMatchObject({ code: 'nomination_mismatch' });
    expect(await code(move(t, { to: 'testing', opId: 's3', payload: { ...IDEA, bookId: 'book-other' } }))).toMatchObject({ code: 'nomination_mismatch' });
    expect((await move(t, { to: 'testing', opId: 's4', payload: IDEA })).entry).toMatchObject({ stage: 'testing', idea: IDEA });
    // the state itself is judged, not the idea's presence alone: a copy that names the idea but says declined (planted —
    // no writer leaves one) is no acceptance
    for (const from of ['declined', 'deferred', 'expired', 'withdrawn']) {
      const u = fresh();
      const e = await nominated(u);
      u.store.set(playPath('c1'), { ...e, nomination: { ...e.nomination, state: from, ideaId: 'idea-9' } });
      expect(await code(move(u, { to: 'testing', opId: 's2', payload: IDEA })), from).toMatchObject({ status: 409, code: 'nomination_mismatch' });
    }
  });

  it('history keeps every answer: deferred → considered → accepted, each row with its own state, reason and consideredAt; the copy holds the last; an accepted row keeps its idea and thesis', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: copyOf('deferred', { reason: 'Not this week.', consideredAt: '2026-11-12T15:01:00.000Z' }), nowIso: '2026-11-12T15:02:00.000Z' });
    await move(t, { to: 'nomination', opId: 's2', payload: copyOf('considered', { reason: null, consideredAt: '2026-11-12T15:03:00.000Z' }), nowIso: '2026-11-12T15:04:00.000Z' });
    await move(t, { to: 'nomination', opId: 's3', payload: copyOf('accepted', { reason: 'Taking it now.', thesis: 'One more check pays.', consideredAt: '2026-11-12T15:05:00.000Z' }), nowIso: '2026-11-12T15:06:00.000Z' });
    const e = t.store.get(playPath('c1'));
    expect(e.stageHistory.filter((h) => h.event === 'nomination').map((h) => [h.state, h.reason, h.consideredAt, h.at, h.thesis ?? null])).toEqual([
      ['deferred', 'Not this week.', '2026-11-12T15:01:00.000Z', '2026-11-12T15:02:00.000Z', null],
      ['considered', null, '2026-11-12T15:03:00.000Z', '2026-11-12T15:04:00.000Z', null],
      ['accepted', 'Taking it now.', '2026-11-12T15:05:00.000Z', '2026-11-12T15:06:00.000Z', 'One more check pays.'],
    ]);
    expect(e.stageHistory.at(-1).ideaId).toBe('idea-9');
    expect(e.nomination).toEqual({ bookId: BOOK, nominationId: 'nom_c1', state: 'accepted', reason: 'Taking it now.', consideredAt: '2026-11-12T15:05:00.000Z', ideaId: 'idea-9', thesis: 'One more check pays.' });
  });
});

describe('Amendment A CA-4 — the thesis and the closing note: their fields, their bounds, their own times', () => {
  const astral = (n) => '😀'.repeat(n);
  it('an accepted copy without ideaId → 400 invalid_transition (ideaId); a non-accepted copy carries neither idea nor thesis', async () => {
    const t = fresh();
    await nominated(t);
    const reads = t.readLog.length;
    const { ideaId: _gone, ...noIdea } = NOMINATION;
    expect(await code(move(t, { to: 'nomination', opId: 'x', payload: noIdea }))).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why: 'ideaId' } });
    expect(t.readLog.length).toBe(reads);
    const { entry } = await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, state: 'deferred', thesis: 'never copied' } });
    expect(entry.nomination).not.toHaveProperty('ideaId');
    expect(entry.nomination).not.toHaveProperty('thesis');
  });

  it('the thesis: 400 code points kept exactly (astral characters counted once); 401 refused (the mutant: a 401-code-point thesis stored); a thesis needs consideredAt, an instant', async () => {
    const t = fresh();
    await nominated(t);
    const { entry } = await move(t, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, thesis: astral(400) } });
    expect(entry.nomination.thesis).toBe(astral(400));
    for (const [over, why] of [
      [{ thesis: astral(401) }, 'thesis'],
      [{ thesis: 'x'.repeat(401) }, 'thesis'],
      [{ thesis: '' }, 'thesis'],
      [{ thesis: 7 }, 'thesis'],
      [{ thesis: 'A thesis.', consideredAt: null }, 'consideredAt'],
      [{ thesis: 'A thesis.', consideredAt: 'later' }, 'consideredAt'],
    ]) {
      const u = fresh();
      await nominated(u);
      const writes = playWrites(u).length;
      expect(await code(move(u, { to: 'nomination', opId: 'x', payload: { ...NOMINATION, ...over } })), JSON.stringify(over).slice(0, 40)).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why } });
      expect(playWrites(u).length).toBe(writes);
    }
  });

  it('the closing note: 600 code points kept exactly; 601 refused; a note needs its closingNoteAt, an instant; the note never truncated', async () => {
    const t = fresh();
    await nominated(t);
    await move(t, { to: 'nomination', opId: 's1', payload: NOMINATION });
    await move(t, { to: 'testing', opId: 's2', payload: IDEA });
    for (const [over, why] of [
      [{ closingNote: astral(601), closingNoteAt: LATER }, 'closingNote'],
      [{ closingNote: '', closingNoteAt: LATER }, 'closingNote'],
      [{ closingNote: 'Held one check too long.' }, 'closingNoteAt'],
      [{ closingNote: 'Held one check too long.', closingNoteAt: 'yesterday' }, 'closingNoteAt'],
    ]) expect(await code(move(t, { to: 'tested', opId: 'x', payload: { ...RESULT, ...over } })), JSON.stringify(over).slice(0, 40)).toMatchObject({ status: 400, code: 'invalid_transition', extra: { why } });
    expect(t.store.get(playPath('c1')).stage).toBe('testing');
    const { entry } = await move(t, { to: 'tested', opId: 's3', payload: { ...RESULT, closingNote: astral(600), closingNoteAt: '2026-11-12T15:07:00.000Z' }, nowIso: LATEST });
    expect(entry.result).toEqual({ ...RESULT, closingNote: astral(600), closingNoteAt: '2026-11-12T15:07:00.000Z' });
  });

  it('with no note, the result carries no closing-note fields (nothing quoted)', async () => {
    const { entry } = await tested(fresh());
    expect(entry.result).toEqual(RESULT);
  });
});

// ── Amendment A CA-5, CA-14, CA-22 — the server's later moves, bound to the idea and the offer ───────────────────────
describe('Amendment A CA-5 — the `offered` move: an offer waits at tested, bound to the idea, one per card', () => {
  const OFFER = { ideaId: 'idea-9', offerId: 'offer-1', state: 'offered' };
  it('from tested: sets `offer` { ideaId, offerId, state: offered }, the stage and its instant unchanged, the result unchanged, one `event: offered` row, version + 1', async () => {
    const t = fresh();
    const { entry } = await tested(t);
    const r = await move(t, { to: 'offered', opId: 's4', payload: OFFER, nowIso: '2026-11-12T15:20:00.000Z' });
    expect(r.entry).toMatchObject({ stage: 'tested', stageAt: entry.stageAt, result: entry.result, offer: OFFER, version: entry.version + 1 });
    expect(r.entry.stageHistory.at(-1)).toMatchObject({ stage: 'tested', event: 'offered', ideaId: 'idea-9', offerId: 'offer-1', at: '2026-11-12T15:20:00.000Z', by: 'server', writer: 'practice_field', opId: 's4' });
    expect(r.entry.stageHistory.filter((h) => h.stage === 'tested' && h.event === undefined)).toHaveLength(1);
    const changed = Object.keys(r.entry).filter((k) => JSON.stringify(r.entry[k]) !== JSON.stringify(entry[k])).sort();
    expect(changed).toEqual(['offer', 'stageHistory', 'version']);
  });

  it('bound to the idea: another idea → 409 nomination_mismatch; an entry holding no idea never passes (undefined === undefined)', async () => {
    const t = fresh();
    const { entry } = await tested(t);
    expect(await code(move(t, { to: 'offered', opId: 'x', payload: { ...OFFER, ideaId: 'idea-other' } }))).toMatchObject({ status: 409, code: 'nomination_mismatch' });
    const noIdea = { ...entry };
    delete noIdea.idea;
    t.store.set(playPath('c1'), noIdea);
    expect(await code(move(t, { to: 'offered', opId: 'y', payload: OFFER }))).toMatchObject({ status: 409, code: 'nomination_mismatch' });
  });

  it('one offer per card: a replay is idempotent; the same op with another offer → op_conflict; ANOTHER op while one waits → 409 illegal_transition { offerState } (the mutant: a second offer replacing a waiting one)', async () => {
    const t = fresh();
    await tested(t);
    const a = await move(t, { to: 'offered', opId: 's4', payload: OFFER });
    const writes = playWrites(t).length;
    expect(await move(t, { to: 'offered', opId: 's4', payload: OFFER })).toEqual({ idempotent: true, entry: a.entry });
    expect(await code(move(t, { to: 'offered', opId: 's4', payload: { ...OFFER, offerId: 'offer-2' } }))).toMatchObject({ status: 409, code: 'op_conflict' });
    expect(await code(move(t, { to: 'offered', opId: 's5', payload: { ...OFFER, offerId: 'offer-2' } }))).toEqual({ status: 409, code: 'illegal_transition', extra: { offerState: 'offered' } });
    expect(await code(move(t, { to: 'offered', opId: 's6', payload: OFFER }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { offerState: 'offered' } });
    expect(playWrites(t).length).toBe(writes);
    expect(t.store.get(playPath('c1')).offer.offerId).toBe('offer-1');
  });

  it('while an offer waits the player cannot retire (CA-5), and parking is unaffected — before the offer or after it', async () => {
    const t = fresh();
    await tested(t);
    const { entry } = await move(t, { to: 'offered', opId: 's4', payload: OFFER });
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: entry.version, nowIso: LATEST }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'tested', offerState: 'offered' } });
    expect((await parkCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'p1', expectedVersion: entry.version, nowIso: LATEST })).card).toMatchObject({ parkedAt: LATEST, offer: OFFER });
    const u = fresh();
    const done = await tested(u);
    await parkCard(u.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'p1', expectedVersion: done.entry.version, nowIso: LATEST });
    expect((await move(u, { to: 'offered', opId: 's4', payload: OFFER })).entry).toMatchObject({ parkedAt: LATEST, offer: OFFER });
  });
});

describe('Amendment A CA-14 — `installed` and the server\'s `retired` are bound to the idea and the offer', () => {
  const OFFER = { ideaId: 'idea-9', offerId: 'offer-1', state: 'offered' };
  const offered = async (t) => { await tested(t); return move(t, { to: 'offered', opId: 's4', payload: OFFER }); };

  it('installed: needs the waiting offer by its id and the entry\'s own idea — no offer, another offer, another idea, no idea → 409 nomination_mismatch, nothing written (the mutants: installed with no offer; installed with no idea passing)', async () => {
    const t = fresh();
    await tested(t);
    const w0 = playWrites(t).length;
    expect(await code(move(t, { to: 'installed', opId: 'x1', payload: { ideaId: 'idea-9', offerId: 'offer-1', state: 'accepted' } }))).toMatchObject({ status: 409, code: 'nomination_mismatch' });
    expect(playWrites(t).length).toBe(w0);
    const u = fresh();
    const { entry } = await offered(u);
    expect(await code(move(u, { to: 'installed', opId: 'x2', payload: { ideaId: 'idea-9', offerId: 'offer-2', state: 'accepted' } }))).toMatchObject({ code: 'nomination_mismatch' });
    expect(await code(move(u, { to: 'installed', opId: 'x3', payload: { ideaId: 'idea-other', offerId: 'offer-1', state: 'accepted' } }))).toMatchObject({ code: 'nomination_mismatch' });
    const noIdea = { ...entry };
    delete noIdea.idea;
    u.store.set(playPath('c1'), noIdea);
    expect(await code(move(u, { to: 'installed', opId: 'x4', payload: { ideaId: 'idea-9', offerId: 'offer-1', state: 'accepted' } }))).toMatchObject({ code: 'nomination_mismatch' });
  });

  it('installed after offered: the stage moves once, the offer becomes the installed one, version + 1 exactly; its replay is idempotent, another request under its op id op_conflict', async () => {
    const t = fresh();
    const { entry } = await offered(t);
    const payload = { ideaId: 'idea-9', offerId: 'offer-1', state: 'accepted' };
    const r = await move(t, { to: 'installed', opId: 's5', payload });
    expect(r.entry).toMatchObject({ stage: 'installed', offer: payload, version: entry.version + 1 });
    expect(await move(t, { to: 'installed', opId: 's5', payload })).toEqual({ idempotent: true, entry: r.entry });
    expect(await code(move(t, { to: 'installed', opId: 's5', payload: { ...payload, state: 'adopted' } }))).toMatchObject({ code: 'op_conflict' });
  });

  it('the server\'s retire: with no offer, offerId null (and only null); with an offer, its own id (never null, never another); always the entry\'s own idea (the mutant: the server retired with no idea passing)', async () => {
    const cases = [
      ['no offer, null id', false, { offerId: null }, null],
      ['no offer, an id', false, { offerId: 'offer-1' }, 'nomination_mismatch'],
      ['an offer, null id', true, { offerId: null }, 'nomination_mismatch'],
      ['an offer, another id', true, { offerId: 'offer-2' }, 'nomination_mismatch'],
      ['an offer, its id', true, { offerId: 'offer-1' }, null],
      ['another idea', false, { offerId: null, ideaId: 'idea-other' }, 'nomination_mismatch'],
    ];
    for (const [name, withOffer, over, error] of cases) {
      const t = fresh();
      if (withOffer) await offered(t); else await tested(t);
      const r = await code(move(t, { to: 'retired', opId: 'x', payload: { ideaId: 'idea-9', state: 'declined', ...over } }));
      if (error) expect(r, name).toMatchObject({ status: 409, code: error });
      else { expect(r, name).toBeNull(); expect(t.store.get(playPath('c1')).stage, name).toBe('retired'); }
    }
    const u = fresh();
    const { entry } = await tested(u);
    const noIdea = { ...entry };
    delete noIdea.idea;
    u.store.set(playPath('c1'), noIdea);
    expect(await code(move(u, { to: 'retired', opId: 'x', payload: { ideaId: 'idea-9', offerId: null, state: 'no_offer' } }))).toMatchObject({ code: 'nomination_mismatch' });
  });
});

describe('Amendment A CA-22 — an idea that ends before its first fill: `tested` straight from `nominated`, with the no-fill fact', () => {
  const ENDED = { ideaId: 'idea-9', resultRef: 'mandates/book-1/ideas/idea-9/results/r1', contractCondition: 'unobserved', economicResult: 'unmeasurable', noFill: true };
  const accepted = async (t) => { await nominated(t); return move(t, { to: 'nomination', opId: 's1', payload: NOMINATION }); };

  for (const terminal of [{ contractCondition: 'unobserved', economicResult: 'unmeasurable' }, { contractCondition: 'abandoned', economicResult: 'inconclusive' }]) {
    it(`accepted → tested directly (${terminal.contractCondition} / ${terminal.economicResult}): one transaction sets the idea from the accepted copy and the result with noFill, one row (noFill), version + 1 once; identity untouched; the stage at tested`, async () => {
      const t = fresh();
      const { entry } = await accepted(t);
      const r = await move(t, { to: 'tested', opId: 's3', payload: { ...ENDED, ...terminal }, nowIso: LATEST });
      expect(r.entry).toMatchObject({ stage: 'tested', stageAt: LATEST, idea: { bookId: BOOK, ideaId: 'idea-9' }, result: { ...ENDED, ...terminal }, version: entry.version + 1 });
      expect(r.entry.stageHistory.length).toBe(entry.stageHistory.length + 1);
      expect(r.entry.stageHistory.at(-1)).toMatchObject({ stage: 'tested', noFill: true, by: 'server', opId: 's3' });
      expect(r.entry.stageHistory.some((h) => h.stage === 'testing')).toBe(false);
      expect(untouched(r.entry)).toEqual(untouched(entry));
      const changed = Object.keys(r.entry).filter((k) => JSON.stringify(r.entry[k]) !== JSON.stringify(entry[k])).sort();
      expect(changed).toEqual(['idea', 'result', 'stage', 'stageAt', 'stageHistory', 'version']);
      // its replay
      expect(await move(t, { to: 'tested', opId: 's3', payload: { ...ENDED, ...terminal }, nowIso: LATEST })).toEqual({ idempotent: true, entry: r.entry });
    });
  }

  it('refused: from nominated WITHOUT noFill → 409 illegal_transition (the mutant: tested from nominated without noFill); noFill FROM TESTING → 409 illegal_transition; from nominated with a copy not accepted → 409 illegal_transition naming it; another idea → 409 nomination_mismatch; nothing written', async () => {
    const t = fresh();
    await accepted(t);
    const w = playWrites(t).length;
    const { noFill: _n, ...plain } = ENDED;
    expect(await code(move(t, { to: 'tested', opId: 'x1', payload: plain }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated' } });
    expect(await code(move(t, { to: 'tested', opId: 'x1b', payload: { ...ENDED, noFill: false } }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated' } });
    expect(await code(move(t, { to: 'tested', opId: 'x2', payload: { ...ENDED, ideaId: 'idea-other' } }))).toMatchObject({ status: 409, code: 'nomination_mismatch' });
    expect(playWrites(t).length).toBe(w);
    for (const from of ['queued', 'deferred', 'declined']) {
      const u = fresh();
      if (from === 'queued') await nominated(u); else { await nominated(u); await move(u, { to: 'nomination', opId: 's1', payload: { ...NOMINATION, state: from } }); }
      expect(await code(move(u, { to: 'tested', opId: 'x3', payload: ENDED })), from).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'nominated', nominationState: from } });
    }
    const v = fresh();
    await accepted(v);
    await move(v, { to: 'testing', opId: 's2', payload: IDEA });
    expect(await code(move(v, { to: 'tested', opId: 'x4', payload: ENDED }))).toEqual({ status: 409, code: 'illegal_transition', extra: { stage: 'testing' } });
    expect((await move(v, { to: 'tested', opId: 's3', payload: plain })).entry.result).not.toHaveProperty('noFill');
  });

  it('after it, the card is tested like any other: open until parked, parkable, retirable (no offer), and the offer moves bind to the idea it set; a shelved entry receives it too', async () => {
    const t = fresh();
    await accepted(t);
    const { entry } = await move(t, { to: 'tested', opId: 's3', payload: ENDED });
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(1);
    expect((await move(t, { to: 'offered', opId: 's4', payload: { ideaId: 'idea-9', offerId: 'o1', state: 'offered' } })).entry.offer.offerId).toBe('o1');
    const p = fresh();
    await accepted(p);
    const pe = (await move(p, { to: 'tested', opId: 's3', payload: ENDED })).entry;
    expect((await parkCard(p.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'p1', expectedVersion: pe.version, nowIso: LATEST })).card.parkedAt).toBe(LATEST);
    const r = fresh();
    await accepted(r);
    const re = (await move(r, { to: 'tested', opId: 's3', payload: ENDED })).entry;
    expect((await retireCard(r.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: re.version, nowIso: LATEST })).card.stage).toBe('retired');
    const s = fresh();
    await accepted(s);
    s.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'guardian' }));
    expect((await move(s, { to: 'tested', opId: 's3', payload: ENDED })).entry.stage).toBe('tested');
    expect(entry.idea).toEqual({ bookId: BOOK, ideaId: 'idea-9' });
  });
});

// ── Amendment A CA-12 — the book re-read inside the nominate and Offer transactions ────────────────────────────────
describe('Amendment A CA-12 — the book is re-read in the transaction: the owner\'s active idea book, for the agent', () => {
  const OPEN = { bookId: BOOK, status: 'active' };
  const BOOK_PATH = `mandates/${BOOK}`;
  const nominateIt = (t, over = {}) => nominateCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'n1', expectedVersion: 1, nowIso: LATER, book: OPEN, verifySource: SOURCE_OK, ...over });
  const offerIt = (t, over = {}) => createCard(t.db, { uid: UID, agentId: AGENT, opId: 'o1', payload: payload({ route: 'offer' }), nowIso: NOW, battleArchetype: 'momentum_chaser', book: OPEN, ...over });
  const filed = async (t) => createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW, battleArchetype: 'momentum_chaser' });
  const bookWrites = (t) => t.writeLog.filter((w) => w.path.startsWith('mandates/'));
  afterEach(() => seam.resetPracticeFieldSeam());

  const DEFECTS = [
    ['no book document', (t) => t.store.delete(BOOK_PATH)],
    ['another owner\'s book', (t) => t.store.set(BOOK_PATH, { ...BOOK_DOC, userId: 'someone-else' })],
    ['a portfolio book', (t) => t.store.set(BOOK_PATH, { ...BOOK_DOC, kind: 'portfolio' })],
    ['a book with no kind', (t) => { const { kind: _k, ...rest } = BOOK_DOC; t.store.set(BOOK_PATH, rest); }],
    ['a closed book (the pre-read said active)', (t) => t.store.set(BOOK_PATH, { ...BOOK_DOC, status: 'closed' })],
    ['a draining book', (t) => t.store.set(BOOK_PATH, { ...BOOK_DOC, status: 'draining' })],
    ['another agent\'s book', (t) => t.store.set(BOOK_PATH, { ...BOOK_DOC, attributionAgentId: 'agent-other' })],
    ['a book naming no agent', (t) => { const { attributionAgentId: _a, ...rest } = BOOK_DOC; t.store.set(BOOK_PATH, rest); }],
    ['a predicate that throws', () => seam.setPracticeFieldSeam({ bookIsForAgent: () => { throw new Error('no field'); } })],
    ['a predicate answering a truthy non-true', () => seam.setPracticeFieldSeam({ bookIsForAgent: () => 'yes' })],
  ];
  for (const [name, defect] of DEFECTS) {
    it(`${name} → 409 book_not_open on BOTH paths, nothing written, the body naming no book (the mutants: the book re-read skipped; a closed book accepted)`, async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const t = fresh();
      await filed(t);
      defect(t);
      const writes = t.writeLog.length;
      const a = await code(nominateIt(t));
      expect(a, name).toEqual({ status: 409, code: 'book_not_open', extra: {} });
      expect(await code(offerIt(t)), name).toEqual({ status: 409, code: 'book_not_open', extra: {} });
      expect(t.writeLog.length, name).toBe(writes);
      expect(bookWrites(t), name).toEqual([]);
      errors.mockRestore();
    });
  }

  it('the control: the owner\'s active idea book for the agent → both paths write their two halves; a T1a predicate over its own field is honoured', async () => {
    const t = fresh();
    await filed(t);
    expect((await nominateIt(t)).card.stage).toBe('nominated');
    expect((await offerIt(t)).card.stage).toBe('nominated');
    const u = fresh();
    await filed(u);
    u.store.set(BOOK_PATH, { ...BOOK_DOC, attributionAgentId: undefined, managerAgentId: AGENT });
    seam.setPracticeFieldSeam({ bookIsForAgent: (doc, id) => doc.managerAgentId === id });
    expect((await nominateIt(u)).card.stage).toBe('nominated');
  });

  it('the book changed BETWEEN the transaction\'s read and its commit: the commit conflicts, is retried, and the closed book refuses — nothing written; an unchanged rewrite is judged again and lands', async () => {
    let strike = null;
    const t = makeTapeDb({ [`agents/${AGENT}`]: agentDoc(), [BOOK_PATH]: BOOK_DOC }, { hooks: { afterTxRead: async (label, db) => { if (!strike || label !== BOOK_PATH) return; const next = strike; strike = null; await db.collection('mandates').doc(BOOK).set(next); } } });
    await filed(t);
    strike = { ...BOOK_DOC, status: 'closed' };
    const retries = t.db.txRetries;
    expect(await code(nominateIt(t))).toMatchObject({ status: 409, code: 'book_not_open' });
    expect(t.db.txRetries).toBeGreaterThan(retries);
    expect(bookWrites(t).filter((w) => w.path.includes('/nominations/'))).toEqual([]);
    t.store.set(BOOK_PATH, BOOK_DOC);
    strike = { ...BOOK_DOC };
    expect((await nominateIt(t)).card.stage).toBe('nominated');
  });

  it('a book re-read that fails is 409 book_not_open (never 500), with a trace; a contention abort is rethrown as it came', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = null;
    const t = makeTapeDb({ [`agents/${AGENT}`]: agentDoc(), [BOOK_PATH]: BOOK_DOC }, { hooks: { beforeRead: (label) => { if (fail && label === `tx:${BOOK_PATH}`) throw fail; } } });
    await filed(t);
    fail = new Error('book read failed');
    expect(await code(nominateIt(t))).toEqual({ status: 409, code: 'book_not_open', extra: {} });
    expect(await code(offerIt(t))).toEqual({ status: 409, code: 'book_not_open', extra: {} });
    expect(errors.mock.calls.some((c) => String(c.join(' ')).includes('book read failed'))).toBe(true);
    fail = Object.assign(new Error('ABORTED'), { code: 10 });
    const err = await nominateIt(t).then(() => null, (e) => e);
    expect(err).toMatchObject({ code: 10 });
    expect(err.cardRoute).toBeUndefined();
    errors.mockRestore();
  });

  it('THE ORDER is unchanged (CA-12): a replay returns before any re-read (the book closed since); an already-nominated card with no book → illegal_transition; another owner → forbidden; a stale version → version_conflict; an op id the book already holds, with the book closed → book_not_open (the book before the id); at the cap with the book closed → book_not_open (the book before the cap) (the mutant: a successful replay refused after the book closed)', async () => {
    const t = fresh();
    await filed(t);
    const first = await nominateIt(t);
    t.store.set(BOOK_PATH, { ...BOOK_DOC, status: 'closed' });
    const reads = t.readLog.length;
    expect(await nominateIt(t)).toEqual({ idempotent: true, card: first.card });
    expect(t.readLog.slice(reads).filter((l) => l.includes(BOOK_PATH))).toEqual([]);
    expect(await code(nominateIt(t, { opId: 'n2', expectedVersion: 2, book: null }))).toMatchObject({ code: 'illegal_transition', extra: { stage: 'nominated' } });
    expect(await code(nominateIt(t, { opId: 'n3', uid: 'intruder', book: null }))).toMatchObject({ code: 'forbidden' });
    expect(await code(nominateIt(t, { opId: 'n4', expectedVersion: 1 }))).toMatchObject({ code: 'version_conflict' });
    const u = fresh();
    await filed(u);
    u.store.set(`mandates/${BOOK}/nominations/n1`, { state: 'queued' });
    u.store.set(BOOK_PATH, { ...BOOK_DOC, status: 'closed' });
    expect(await code(nominateIt(u))).toMatchObject({ code: 'book_not_open' });
    const v = fresh();
    for (let i = 0; i < 5; i += 1) await createCard(v.db, { uid: UID, agentId: AGENT, opId: `w${i}`, payload: payload({ note: `Watch ${i}.` }), nowIso: NOW, battleArchetype: 'momentum_chaser' });
    v.store.set(BOOK_PATH, { ...BOOK_DOC, status: 'closed' });
    expect(await code(offerIt(v))).toMatchObject({ code: 'book_not_open' });
    v.store.set(BOOK_PATH, BOOK_DOC);
    expect(await code(offerIt(v))).toMatchObject({ code: 'cap_reached' });
  });

  it('the withdrawal never reads the book (CA-12): a nominated card in a closed or deleted book still withdraws', async () => {
    const t = fresh();
    await filed(t);
    await nominateIt(t);
    t.store.set(BOOK_PATH, { ...BOOK_DOC, status: 'closed' });
    const reads = t.readLog.length;
    const r = await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 2, nowIso: LATEST });
    expect(r.card).toMatchObject({ stage: 'retired', nomination: { state: 'withdrawn' } });
    expect(t.readLog.slice(reads).filter((l) => l === `tx:${BOOK_PATH}`)).toEqual([]);
  });
});

// ── C1 fix round, backlog §5 (Astra) — the helper's instant guard ───────────────────────────────────────────────────
describe('C1 fix round — the helper\'s instant check takes only a full ISO 8601 instant with a time and an offset', () => {
  const ACCEPTED = ['2026-11-12T15:00:00.000Z', '2026-11-12T15:00:00Z', '2026-11-12T15:00Z', '2026-11-12T10:00:00-05:00', '2026-11-12T20:30:00.123456+05:30', '2028-02-29T00:00:00Z'];
  const REFUSED = ['2026-11-12', '2026-11-12T15:00:00', '2026-11-12T15:00:00.000', '2026-02-30T00:00:00Z', '2027-02-29T00:00:00Z', '2026-11-12T24:00:00Z', '2026-11-12T15:60:00Z', '2026-11-12T15:00:60Z', '2026-13-01T00:00:00Z', '2026-11-12T15:00:00+24:00', 'Nov 12 2026 15:00 GMT', '2026-11-12 15:00:00Z', ' 2026-11-12T15:00:00Z', 12345, null, undefined, ''];

  it('isInstant: the accepted and refused forms (the mutant: Date.parse alone — a date-only string accepted)', () => {
    for (const v of ACCEPTED) expect(isInstant(v), String(v)).toBe(true);
    for (const v of REFUSED) expect(isInstant(v), String(v)).toBe(false);
    // the cases Astra reproduced: Date.parse reads them, the guard does not
    for (const v of ['2026-11-12', '2026-11-12T15:00:00', '2026-02-30T00:00:00Z']) expect(Number.isFinite(Date.parse(v))).toBe(true);
  });

  it('every instant the helper takes is held to it: nowIso, consideredAt, closingNoteAt — a date-only or zone-less one refused 400 invalid_transition before any read', async () => {
    const t = fresh();
    await nominated(t);
    const reads = t.readLog.length;
    for (const nowIso of ['2026-11-12', '2026-11-12T15:05:00']) expect(await code(move(t, { nowIso, to: 'nomination', opId: 'z1', payload: NOMINATION })), nowIso).toMatchObject({ status: 400, extra: { why: 'nowIso' } });
    for (const consideredAt of ['2026-11-12', '2026-11-12T14:58:00']) expect(await code(move(t, { to: 'nomination', opId: 'z2', payload: { ...NOMINATION, consideredAt } })), consideredAt).toMatchObject({ status: 400, extra: { why: 'consideredAt' } });
    expect(await code(move(t, { to: 'tested', opId: 'z3', payload: { ...RESULT, closingNote: 'A note.', closingNoteAt: '2026-11-12' } }))).toMatchObject({ status: 400, extra: { why: 'closingNoteAt' } });
    expect(t.readLog.length).toBe(reads);
  });

  it('the builder\'s record (F2) is held to it too: a date-only queuedAt or a zone-less expiresAt is malformed — nothing written', () => {
    const given = { entryId: 'e', situationId: 's', questionId: 'q', questionVersion: 1 };
    const record = { state: 'queued', source: { kind: 'film_room_card', ...given }, queuedAt: '2026-11-12T15:00:00.000Z', expiresAt: '2026-11-26T21:00:00.000Z', stateHistory: [] };
    expect(nominationRecordDefectOf(record, given)).toBeNull();
    expect(nominationRecordDefectOf({ ...record, queuedAt: '2026-11-12' }, given)).toBe('queuedAt');
    expect(nominationRecordDefectOf({ ...record, expiresAt: '2026-11-26T21:00:00' }, given)).toBe('expiresAt');
  });
});
