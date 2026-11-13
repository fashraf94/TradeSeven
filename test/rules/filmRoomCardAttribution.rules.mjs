// test/rules/filmRoomCardAttribution.rules.mjs
//
// Film Room B2.1 rulings — Build B Amendment K RK-1 (the ledger belongs to the
// player's agent, not the casual clone) AGAINST THE REAL FIRESTORE EMULATOR.
// Not a security-rules test: the card route (api/film-room/card.js), the
// store (cardStore.js) and the counter (cardCounter.js), run through the
// Admin SDK as in production over a tape day the REAL close pass wrote (the
// B1 acceptance day, copied into the emulator), so it rides the emulator
// runner — `npm run test:rules` (firebase emulators:exec sets
// FIRESTORE_EMULATOR_HOST), outside the default suite (no `.test.` in the
// name). The filmRoomCardReplayOwner.rules.mjs precedent. The default suite
// carries the same rows over the in-memory store (api/film-room/card.test.js,
// api/_utils/filmRoom/cardCounter.test.js), for CI.
//   · a casual clone's battle files under the parent (the clone's
//     rankedAgentId); a ranked battle under itself;
//   · a clone with no rankedAgentId, and one whose parent another owner
//     holds, → 503 attribution_unavailable, nothing written;
//   · the counter lists a clone day's recurrence for a parent-filed card; the
//     clone's unavailable day counts under the parent; another owner's clone
//     never counts;
//   · the cap counts the parent's cards across clone and ranked battles;
//   · the archetype checks read the parent (both directions) with per-game
//     loadouts off; with them on (Build A2's R4), the battle's own archetype;
//   · the replay and the retire are keyed on the parent.
// Every row works under ids unique to the run; afterAll deletes them.
//
// Only the Admin handle (the emulator's), the security and auth middleware and
// the three flags are doubled.

import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// The armory flip (Nov 7, 2026). The per-game flag is held here, not read live, so a rollback reddens only its pin (the
// default suite's api/film-room/card.test.js pattern). The row in KILL_SWITCH_ROWS runs with it held OFF and keeps
// guarding the rule a rollback restores: a card is checked against the attribution agent's current archetype. With
// per-game loadouts on (A2's R4) a card is checked against its battle's own archetype, which the two "flag on" rows hold
// on the emulator. Every other row runs with it ON, the shipped state.
const flip = vi.hoisted(() => ({ on: true }));
vi.mock('../../src/config/perGameLoadoutFlags.js', () => ({ get PER_GAME_LOADOUT_ENABLED() { return flip.on; } }));
const KILL_SWITCH_ROWS = new Set([
  "RK-1 on the real emulator — the card is filed under the battle's attribution agent > the archetype checks read the parent: the clone on the tape's archetype, the parent on another → 409 archetype_changed, nothing written; the clone stale, the parent on the tape's → files",
]);

const state = vi.hoisted(() => ({ db: null, uid: null }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { return 'on'; },
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));
vi.mock('../../api/_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../../api/_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: state.uid }) }));
vi.mock('../../api/_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));

const { initializeApp, deleteApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { default: handler } = await import('../../api/film-room/card.js');
const { buildCounter } = await import('../../api/_utils/filmRoom/cardCounter.js');
const { createCard, CARD_ROUTE_COPY } = await import('../../api/_utils/filmRoom/cardStore.js');
const { setPracticeFieldSeam, resetPracticeFieldSeam } = await import('../../api/_utils/filmRoom/practiceFieldSeam.js');
const { writeTapeDay } = await import('../../api/_utils/filmTape/writeTapeDay.js');
const { makeTapeDb } = await import('../../api/_utils/filmTape/__fixtures__/tapeFirestore.js');
const { seedDay } = await import('../../api/_utils/filmTape/__fixtures__/tapeFixtures.js');
const { stalledDay } = await import('../../api/_utils/filmTape/__fixtures__/tagFixtures.js');

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const RUN = Date.now().toString(36);
const UID = `rk1-owner-${RUN}`;
const OTHER = `rk1-other-${RUN}`;
const PARENT = `rk1-parent-${RUN}`;
const FOREIGN_PARENT = `rk1-foreign-parent-${RUN}`;
const CLONE = `casual-agent-${UID}`;
const FOREIGN_CLONE = `casual-agent-${OTHER}`;
const D = '2026-09-24';
const D2 = '2026-09-25';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const COUNTER_NOW = Date.parse('2026-09-26T00:00:00.000Z');
const ENV_BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;
const MOMENT = { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 };

let app;
let db;
let fixture;
let n = 0;
const docs = [];
const battles = [];

/**
 * A fresh battle id for this run, over a copy of the real day. `agentId` is what the battle and its tape record.
 * `agentContext` replaces the battle's own (the tape keeps the day's archetype as the close pass wrote it).
 */
async function battleFor(row, agentId, { ownerId = UID, etDate = D, tags = null, agentContext = null } = {}) {
  const id = `rk1-${row}-${RUN}-${(n += 1)}`;
  battles.push(id);
  await db.doc(`agentBattles/${id}`).set({ ...fixture.battle, id, ownerId, agentId, ...(agentContext ? { agentContext } : {}) });
  const tape = { ...fixture.tape, battleId: id, ownerId, agentId, etDate };
  if (tags === 'unavailable') tape.coverage = { ...tape.coverage, tags: { ...tape.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } };
  await db.doc(`agentBattles/${id}/tape/${etDate}`).set(tape);
  return id;
}
async function agentDoc(id, data) {
  if (!docs.includes(id)) docs.push(id);
  if (data === null) await db.doc(`agents/${id}`).delete(); else await db.doc(`agents/${id}`).set(data);
}
const parentAt = (over = {}) => ({ ownerId: UID, name: 'Aurora', archetype: 'momentum_chaser', ...over });
const cloneAt = (over = {}) => ({ ownerId: UID, name: 'Aurora (casual)', archetype: 'momentum_chaser', rankedAgentId: PARENT, ...over });

const mkRes = () => ({
  statusCode: null, body: null, headers: {},
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const post = async (body) => { const res = mkRes(); await handler({ method: 'POST', headers: {}, body }, res); return res; };
const create = (battleId, agentId, over = {}) => ({ op: 'create', opId: `op_${(n += 1)}`, battleId, etDate: D, agentId, moment: MOMENT, questionId: 'stalled.want', note: 'Let it go sooner.', route: 'watch', ...over });
const plays = async (agentId) => (await db.collection(`agents/${agentId}/plays`).get()).docs.map((d) => d.data());

beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  // only ever the local emulator
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`filmRoomCardAttribution needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `film-room-card-attribution-${RUN}`);
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  state.db = db;
  state.uid = UID;
  // the day, written once by the real close pass over the in-memory store, then copied into the emulator per battle
  const fx = await stalledDay({ battleId: 'b-attr', noTriggerSeqs: [3, 4], meetingSeqs: [5], exitSeq: 6, recordStagnation: true, etDate: D });
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay('b-attr', D, { db: t.db, now: NIGHT });
  const tape = t.store.get(`agentBattles/b-attr/tape/${D}`);
  expect(tape.tags.items.map((i) => [i.symbol, i.tickSeq])).toEqual([['ACN', 4], ['ACN', 5]]);
  expect(tape.coverage.tags.status).toBe('complete');
  // the day records the battle's own archetype (tapeTags.js tagInputs reads battle.agentContext.archetype)
  expect(fx.battle.agentContext.archetype).toBe('momentum_chaser');
  expect(tape.tags.inputs.archetypeCodeId).toBe('momentum_chaser');
  fixture = { battle: fx.battle, tape };
});
beforeEach(async () => {
  flip.on = !KILL_SWITCH_ROWS.has(expect.getState().currentTestName);
  process.env.COCKPIT_ALLOWLIST_UIDS = UID;
  state.uid = UID;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // every row starts from the parent and the owner's clone as a legit pair, with no card
  for (const id of [PARENT, CLONE]) await db.recursiveDelete(db.doc(`agents/${id}`));
  await agentDoc(PARENT, parentAt());
  await agentDoc(CLONE, cloneAt());
});
afterAll(async () => {
  vi.restoreAllMocks();
  if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE;
  if (db) {
    for (const id of docs) await db.recursiveDelete(db.doc(`agents/${id}`));
    for (const id of battles) await db.recursiveDelete(db.doc(`agentBattles/${id}`));
  }
  if (app) await deleteApp(app);
});

describe('RK-1 on the real emulator — the card is filed under the battle\'s attribution agent', () => {
  it('a casual clone\'s battle files under the parent: the entry at agents/{parent}/plays, its agentId the parent; nothing under the clone', async () => {
    const b = await battleFor('clone', CLONE);
    const res = await post(create(b, CLONE));
    expect(res.statusCode).toBe(200);
    expect(res.body.card).toMatchObject({ ownerId: UID, agentId: PARENT, source: { battleId: b, etDate: D, symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 } });
    expect((await db.doc(`agents/${PARENT}/plays/${res.body.card.entryId}`).get()).data()).toEqual(res.body.card);
    expect(await plays(CLONE)).toEqual([]);
  });

  it('a ranked battle files under itself', async () => {
    const b = await battleFor('ranked', PARENT);
    const res = await post(create(b, PARENT));
    expect(res.statusCode).toBe(200);
    expect(res.body.card.agentId).toBe(PARENT);
    expect(await plays(PARENT)).toHaveLength(1);
    expect(await plays(CLONE)).toEqual([]);
  });

  it('a clone with no rankedAgentId, and one whose parent another owner holds → 503 attribution_unavailable; nothing written anywhere', async () => {
    await agentDoc(FOREIGN_PARENT, { ownerId: OTHER, name: 'Theirs', archetype: 'momentum_chaser' });
    for (const [label, clone] of [['no rankedAgentId', cloneAt({ rankedAgentId: null })], ['a parent another owner holds', cloneAt({ rankedAgentId: FOREIGN_PARENT })]]) {
      await agentDoc(CLONE, clone);
      const b = await battleFor('fallback', CLONE);
      const res = await post(create(b, CLONE));
      expect(res.statusCode, label).toBe(503);
      expect(res.body, label).toEqual({ error: 'attribution_unavailable', message: CARD_ROUTE_COPY.attribution_unavailable, agentId: CLONE });
      expect(await plays(CLONE), label).toEqual([]);
      expect(await plays(PARENT), label).toEqual([]);
      expect(await plays(FOREIGN_PARENT), label).toEqual([]);
    }
  });

  it('the archetype checks read the parent: the clone on the tape\'s archetype, the parent on another → 409 archetype_changed, nothing written; the clone stale, the parent on the tape\'s → files', async () => {
    const b = await battleFor('archetype', CLONE);
    await agentDoc(PARENT, parentAt({ archetype: 'guardian' }));
    const drifted = await post(create(b, CLONE));
    expect(drifted.statusCode).toBe(409);
    expect(drifted.body.error).toBe('archetype_changed');
    expect(await plays(PARENT)).toEqual([]);
    await agentDoc(PARENT, parentAt());
    await agentDoc(CLONE, cloneAt({ archetype: 'guardian' }));
    const filed = await post(create(b, CLONE));
    expect(filed.statusCode).toBe(200);
    expect(filed.body.card).toMatchObject({ agentId: PARENT, archetypeCodeId: 'momentum_chaser' });
    // shelving reads the parent too: the parent leaves the archetype → the card reads shelved; the clone's own archetype moves nothing
    await agentDoc(CLONE, cloneAt({ archetype: 'momentum_chaser' }));
    await agentDoc(PARENT, parentAt({ archetype: 'guardian' }));
    const counter = await buildCounter(db, { uid: UID, agentId: CLONE, nowMs: COUNTER_NOW });
    expect(counter.cards.map((c) => [c.agentId, c.shelved])).toEqual([[PARENT, true]]);
    expect(counter.open).toBe(0);
  });

  it('flag on (A2\'s R4 and R6): the tape day\'s archetype is the battle\'s own → the card files under the parent although the parent wears another; it reads shelved at once and the cap does not count it', async () => {
    const b = await battleFor('battle-own', CLONE);
    await agentDoc(PARENT, parentAt({ archetype: 'guardian' }));
    const res = await post(create(b, CLONE));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ idempotent: false, open: 0, cap: 5 });
    expect(res.body.card).toMatchObject({ ownerId: UID, agentId: PARENT, archetypeCodeId: 'momentum_chaser' });
    expect((await db.doc(`agents/${PARENT}/plays/${res.body.card.entryId}`).get()).data()).toEqual(res.body.card);
    expect(await plays(CLONE)).toEqual([]);
    // R6: neither loadout wears the day's archetype (the parent has no BaggerBomb slot, so both are its League one)
    const counter = await buildCounter(db, { uid: UID, agentId: CLONE, nowMs: COUNTER_NOW });
    expect(counter.cards.map((c) => [c.agentId, c.archetypeCodeId, c.shelved])).toEqual([[PARENT, 'momentum_chaser', true]]);
    expect(counter.open).toBe(0);
  });

  it('flag on (A2\'s R4): a tape day whose archetype is not the battle\'s own → 409 archetype_changed naming the battle\'s, nothing written, though the parent and the clone wear the day\'s', async () => {
    const b = await battleFor('battle-other', CLONE, { agentContext: { ...fixture.battle.agentContext, archetype: 'guardian' } });
    const res = await post(create(b, CLONE));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'archetype_changed', message: CARD_ROUTE_COPY.archetype_changed, archetypeCodeId: 'momentum_chaser', current: 'guardian' });
    expect(await plays(PARENT)).toEqual([]);
    expect(await plays(CLONE)).toEqual([]);
  });

  it('the replay and the retire are keyed on the parent: a lost answer re-tapped after the day turned unavailable replays the one card; the clone\'s id retires the parent\'s card', async () => {
    const b = await battleFor('replay', CLONE);
    const body = create(b, CLONE);
    const first = await post(body);
    expect(first.statusCode).toBe(200);
    const tape = (await db.doc(`agentBattles/${b}/tape/${D}`).get()).data();
    await db.doc(`agentBattles/${b}/tape/${D}`).set({ ...tape, coverage: { ...tape.coverage, tags: { ...tape.coverage.tags, status: 'unavailable', note: 'stalled unavailable: planted' } } });
    const again = await post(body);
    expect(again.statusCode).toBe(200);
    expect(again.body).toMatchObject({ idempotent: true, card: first.body.card });
    expect(await plays(PARENT)).toHaveLength(1);
    const retired = await post({ op: 'retire', opId: `r_${RUN}`, agentId: CLONE, entryId: first.body.card.entryId, expectedVersion: 1 });
    expect(retired.statusCode).toBe(200);
    expect(retired.body.card).toMatchObject({ agentId: PARENT, stage: 'retired', version: 2 });
    expect((await db.doc(`agents/${PARENT}/plays/${first.body.card.entryId}`).get()).data().stage).toBe('retired');
  });

  it('the cap counts the parent\'s cards across clone and ranked battles: three from a clone battle, two from a ranked one → the sixth refused at 5; the counter reads 5 of 5 asked by either agent', async () => {
    const cb = await battleFor('cap-clone', CLONE);
    const rb = await battleFor('cap-ranked', PARENT);
    for (const req of [create(cb, CLONE), create(cb, CLONE), create(cb, CLONE), create(rb, PARENT), create(rb, PARENT)]) expect((await post(req)).statusCode).toBe(200);
    const sixth = await post(create(cb, CLONE));
    expect(sixth.statusCode).toBe(409);
    expect(sixth.body).toMatchObject({ error: 'cap_reached', cap: 5, open: 5 });
    expect(await plays(PARENT)).toHaveLength(5);
    for (const asked of [CLONE, PARENT]) expect(await buildCounter(db, { uid: UID, agentId: asked, nowMs: COUNTER_NOW })).toMatchObject({ attributionAgentId: PARENT, open: 5, cap: 5 });
  });
});

describe('RK-1 on the real emulator — the counter answers for the attribution agent', () => {
  // the rows above leave their tape days under this owner: the counter rows start from none
  beforeAll(async () => { for (const id of battles.splice(0)) await db.recursiveDelete(db.doc(`agentBattles/${id}`)); });

  it('a parent-filed Watch card lists a clone day\'s recurrence; the clone\'s unavailable day counts under the parent; another owner\'s clone never counts — asked by the clone or the parent', async () => {
    const ranked = await battleFor('src', PARENT);
    const cloneDay = await battleFor('recur', CLONE);
    await battleFor('unread', CLONE, { etDate: D2, tags: 'unavailable' });
    // another owner's clone, on tape days the owner owns: its document names this owner's parent (the shape a mutant would count)
    await agentDoc(FOREIGN_CLONE, { ownerId: OTHER, name: 'Theirs (casual)', archetype: 'momentum_chaser', rankedAgentId: PARENT });
    const foreign = await battleFor('foreign', FOREIGN_CLONE);
    await battleFor('foreign-unread', FOREIGN_CLONE, { etDate: D2, tags: 'unavailable' });
    // the Watch card, filed under the parent from the ranked battle's day before any of the days above, with the
    // battle's own archetype handed in as the route hands it (api/film-room/card.js: battle?.agentContext?.archetype ?? null)
    const rankedBattle = (await db.doc(`agentBattles/${ranked}`).get()).data();
    const card = await createCard(db, {
      uid: UID, agentId: PARENT, opId: `w_${RUN}`, nowIso: '2026-09-20T02:00:00.000Z',
      payload: { archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: fixture.tape.tags.items[0].version, battleId: ranked, etDate: '2026-09-18', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Watch it.', route: 'watch' },
      battleArchetype: rankedBattle?.agentContext?.archetype ?? null,
    });
    for (const asked of [CLONE, PARENT]) {
      const out = await buildCounter(db, { uid: UID, agentId: asked, nowMs: COUNTER_NOW });
      expect(out).toMatchObject({ agentId: asked, attributionAgentId: PARENT, open: 1 });
      const battlesListed = out.recurrences[card.card.entryId].map((r) => r.battleId);
      expect(battlesListed).toContain(cloneDay);
      expect(battlesListed).toContain(ranked);
      expect(battlesListed).not.toContain(foreign);
      expect(out.unavailableDays[PARENT]).toBe(1);
      expect(out.unavailableDays[FOREIGN_CLONE]).toBe(1);
      expect(Object.keys(out.unavailableDays)).not.toContain(CLONE);
    }
  });

  it('the owner\'s clone the resolver cannot resolve — no rankedAgentId, or a parent another owner holds — → 503 attribution_unavailable; no clone ledger is read or answered', async () => {
    await agentDoc(FOREIGN_PARENT, { ownerId: OTHER, name: 'Theirs', archetype: 'momentum_chaser' });
    for (const clone of [cloneAt({ rankedAgentId: null }), cloneAt({ rankedAgentId: FOREIGN_PARENT })]) {
      await agentDoc(CLONE, clone);
      await expect(buildCounter(db, { uid: UID, agentId: CLONE, nowMs: COUNTER_NOW })).rejects.toMatchObject({ cardRoute: true, status: 503, code: 'attribution_unavailable', extra: { agentId: CLONE } });
    }
  });
});

// ── Film Room C1 (Build C spec V1 §4; acceptance C-NOMINATE, C-NOBOOK, C-OWNER) — nominate on the real emulator ──────
// The Practice Field's bookForOwner is injected through the seam (T1a's helper does not exist yet): a REAL read of a
// synthetic book document — `mandates/{bookId}` with the owner's `userId`, `kind: 'idea_book'`, the manager agent
// and its status — so the card endpoint's one transaction writes the nomination record into a real book path.
describe('C1 on the real emulator — nominate and the Offer route, through an injected seam against a synthetic book', () => {
  const BOOK_ID = `c1-book-${RUN}`;
  const book = (over = {}) => ({ userId: UID, kind: 'idea_book', managerAgentId: PARENT, status: 'active', ...over });
  const asked = [];
  beforeEach(async () => {
    asked.length = 0;
    await db.doc(`mandates/${BOOK_ID}`).set(book());
    setPracticeFieldSeam({
      bookForOwner: async (handle, { uid, attributionAgentId }) => {
        asked.push(attributionAgentId);
        const snap = await handle.collection('mandates').where('userId', '==', uid).where('kind', '==', 'idea_book').where('managerAgentId', '==', attributionAgentId).limit(1).get();
        const d = snap.docs[0];
        return d ? { bookId: d.id, status: d.data().status } : null;
      },
    });
  });
  afterEach(() => resetPracticeFieldSeam());
  afterAll(async () => { if (db) await db.recursiveDelete(db.doc(`mandates/${BOOK_ID}`)); });
  const nominationAt = async (id) => (await db.doc(`mandates/${BOOK_ID}/nominations/${id}`).get());

  it('C-OWNER: a casual clone\'s battle files an Offer card under the PARENT, in the parent\'s book — the entry at nominated and its record, one transaction; the seam asked for the parent, never the clone', async () => {
    const b = await battleFor('c1-offer', CLONE);
    const res = await post(create(b, CLONE, { route: 'offer' }));
    expect(res.statusCode).toBe(200);
    const id = res.body.card.entryId;
    expect(res.body.card).toMatchObject({ agentId: PARENT, stage: 'nominated', nomination: { bookId: BOOK_ID, nominationId: id, state: 'queued' }, stageVocabVersion: 2 });
    const rec = await nominationAt(id);
    expect(rec.exists).toBe(true);
    expect(rec.data()).toMatchObject({ state: 'queued', source: { kind: 'film_room_card', entryId: id, situationId: 'stalled', questionId: 'stalled.want', questionVersion: 1 } });
    expect(asked).toEqual([PARENT]);
    expect(await plays(CLONE)).toEqual([]);
  });

  it('C-NOMINATE: a card-stage entry nominates — the record and the entry together; a replay answers the same; a second nominate → 409 illegal_transition', async () => {
    const b = await battleFor('c1-nominate', PARENT);
    const filed = await post(create(b, PARENT));
    const id = filed.body.card.entryId;
    const body = { op: 'nominate', opId: `nom_${RUN}`, agentId: PARENT, entryId: id, expectedVersion: 1 };
    const res = await post(body);
    expect(res.statusCode).toBe(200);
    expect((await db.doc(`agents/${PARENT}/plays/${id}`).get()).data()).toMatchObject({ stage: 'nominated', version: 2, nomination: { bookId: BOOK_ID, nominationId: `nom_${RUN}`, state: 'queued' } });
    expect((await nominationAt(`nom_${RUN}`)).data()).toMatchObject({ state: 'queued', source: { entryId: id } });
    expect(await post(body)).toMatchObject({ statusCode: 200, body: { idempotent: true } });
    expect(await post({ ...body, opId: `nom2_${RUN}`, expectedVersion: 2 })).toMatchObject({ statusCode: 409, body: { error: 'illegal_transition' } });
    expect((await nominationAt(`nom2_${RUN}`)).exists).toBe(false);
  });

  it('C-NOBOOK: a book not active, and no book at all (the seam\'s default) → 409 book_not_open, the body naming no book; nothing written under plays or the book', async () => {
    const b = await battleFor('c1-nobook', PARENT);
    // the book's nominations as the rows above left them: this row adds none
    const records = (await db.collection(`mandates/${BOOK_ID}/nominations`).get()).size;
    await db.doc(`mandates/${BOOK_ID}`).set(book({ status: 'paused' }));
    const offer = await post(create(b, PARENT, { route: 'offer' }));
    expect(offer.statusCode).toBe(409);
    expect(offer.body).toEqual({ error: 'book_not_open', message: CARD_ROUTE_COPY.book_not_open });
    resetPracticeFieldSeam();
    const again = await post(create(b, PARENT, { route: 'offer' }));
    expect(again.body.error).toBe('book_not_open');
    expect(await plays(PARENT)).toEqual([]);
    expect((await db.collection(`mandates/${BOOK_ID}/nominations`).get()).size).toBe(records);
  });

  // ── C1 fix round, Astra F1 — a NEW nomination re-checks its filed source, on the real emulator ──────────────────
  const tapePathOf = (b) => `agentBattles/${b}/tape/${D}`;
  const nominateBody = (id, opId) => ({ op: 'nominate', opId, agentId: PARENT, entryId: id, expectedVersion: 1 });
  /** Neither half: no record under the op id, the entry still the filed card at version 1. */
  const neitherHalf = async (id, opId, where) => {
    expect((await nominationAt(opId)).exists, where).toBe(false);
    const e = (await db.doc(`agents/${PARENT}/plays/${id}`).get()).data();
    expect(e, where).toMatchObject({ stage: 'card', version: 1 });
    expect(e, where).not.toHaveProperty('nomination');
  };
  const withoutAcn = (tape) => ({ ...tape, tags: { ...tape.tags, items: tape.tags.items.filter((i) => i.symbol !== 'ACN') } });

  it('F1: each change to the filed source refuses a NEW nomination with the route\'s source error — the moment removed, the moment moved, the day unavailable, the tape deleted, a foreign battle — and neither half is written', async () => {
    const changes = [
      ['moment removed', async (b) => { const tp = (await db.doc(tapePathOf(b)).get()).data(); await db.doc(tapePathOf(b)).set(withoutAcn(tp)); }, 409, 'moment_not_found'],
      ['moment moved', async (b) => { const tp = (await db.doc(tapePathOf(b)).get()).data(); await db.doc(tapePathOf(b)).set({ ...tp, tags: { ...tp.tags, items: tp.tags.items.map((i) => (i.symbol === 'ACN' ? { ...i, tickSeq: i.tickSeq + 1 } : i)) } }); }, 409, 'moment_not_found'],
      ['day unavailable', async (b) => { await db.doc(tapePathOf(b)).update({ 'coverage.tags.status': 'unavailable' }); }, 409, 'tags_unavailable'],
      ['tape deleted', async (b) => { await db.doc(tapePathOf(b)).delete(); }, 404, 'tape_not_found'],
      ['foreign battle', async (b) => { await db.doc(`agentBattles/${b}`).update({ ownerId: OTHER }); }, 403, 'forbidden'],
    ];
    for (const [name, change, status, error] of changes) {
      const b = await battleFor(`f1-${name.replace(/\s+/g, '-')}`, PARENT);
      const filed = await post(create(b, PARENT));
      expect(filed.statusCode, name).toBe(200);
      const id = filed.body.card.entryId;
      await change(b);
      const opId = `f1n_${(n += 1)}_${RUN}`;
      const res = await post(nominateBody(id, opId));
      expect(res.statusCode, name).toBe(status);
      expect(res.body.error, name).toBe(error);
      await neitherHalf(id, opId, name);
    }
  });

  it('F1: the replay after a change — a nomination that committed answers its lost-answer replay after the tape is deleted (200 idempotent), nothing more written', async () => {
    const b = await battleFor('f1-replay', PARENT);
    const id = (await post(create(b, PARENT))).body.card.entryId;
    const opId = `f1r_${RUN}`;
    const first = await post(nominateBody(id, opId));
    expect(first.statusCode).toBe(200);
    await db.doc(tapePathOf(b)).delete();
    const again = await post(nominateBody(id, opId));
    expect(again).toMatchObject({ statusCode: 200, body: { idempotent: true } });
    expect((await db.doc(`agents/${PARENT}/plays/${id}`).get()).data()).toMatchObject({ stage: 'nominated', version: 2 });
  });

  it("F1: the tape is in the nominate transaction's read set — a write to it begun after the transaction has read it (the moment then removed) is held until the transaction ends, never landed under it: the nomination commits over the moment as it stood, and the removal lands after (the emulator locks what a transaction reads; the in-memory suite's retry row judges the changed tape again)", async () => {
    const b = await battleFor('f1-race', PARENT);
    const id = (await post(create(b, PARENT))).body.card.entryId;
    const real = state.db;
    let strike = true;
    const at = {};
    // the handle the route uses: the real one, whose transaction begins the tape change after its callback has done
    // every read, then holds the callback open for a while before it returns (and so before the commit)
    state.db = new Proxy(real, {
      get(target, prop) {
        if (prop !== 'runTransaction') { const v = Reflect.get(target, prop); return typeof v === 'function' ? v.bind(target) : v; }
        return (fn, opts) => target.runTransaction(async (tx) => {
          const out = await fn(tx);
          if (strike) {
            strike = false;
            const tp = (await real.doc(tapePathOf(b)).get()).data();
            at.write = real.doc(tapePathOf(b)).set(withoutAcn(tp)).then(() => { at.written = Date.now(); });
            await new Promise((r) => { setTimeout(r, 1500); });
            at.callbackEnd = Date.now();
          }
          return out;
        }, opts);
      },
    });
    try {
      const opId = `f1x_${RUN}`;
      const res = await post(nominateBody(id, opId));
      at.answered = Date.now();
      await at.write;
      expect(res.statusCode).toBe(200);
      // the write waited for the transaction: it landed after the callback was done, not inside its 1.5 s window
      expect(at.written).toBeGreaterThanOrEqual(at.callbackEnd);
      expect((await nominationAt(opId)).exists).toBe(true);
      // and it did land, after: the moment is gone now, so a NEW nomination of another card from that day is refused
      expect((await db.doc(tapePathOf(b)).get()).data().tags.items.filter((i) => i.symbol === 'ACN')).toEqual([]);
    } finally {
      state.db = real;
    }
  });

  // ── Amendment A CA-2 — retiring a nominated card withdraws it, on the real emulator ────────────────────────────
  const retireBody = (id, opId, expectedVersion = 1) => ({ op: 'retire', opId, agentId: PARENT, entryId: id, expectedVersion });
  const offerCard = async (row) => {
    const b = await battleFor(row, PARENT);
    const res = await post(create(b, PARENT, { route: 'offer' }));
    expect(res.statusCode).toBe(200);
    return res.body.card.entryId;
  };

  it('CA-2: a queued record — the retire withdraws it and retires the entry in ONE transaction: the record withdrawn (its history row by the player), the entry retired with its copy withdrawn, version 2', async () => {
    const id = await offerCard('ca2-queued');
    const res = await post(retireBody(id, `ca2r_${(n += 1)}_${RUN}`));
    expect(res.statusCode).toBe(200);
    const rec = (await nominationAt(id)).data();
    expect(rec).toMatchObject({ state: 'withdrawn', withdrawnAt: res.body.card.stageAt, source: { kind: 'film_room_card', entryId: id } });
    expect(rec.stateHistory.at(-1)).toEqual({ state: 'withdrawn', at: res.body.card.stageAt, by: 'player' });
    expect((await db.doc(`agents/${PARENT}/plays/${id}`).get()).data()).toMatchObject({ stage: 'retired', version: 2, nomination: { state: 'withdrawn' } });
  });

  it('CA-2: an accepted record → 409 illegal_transition { stage: nominated, nominationState: accepted }; neither the record nor the entry is written', async () => {
    const id = await offerCard('ca2-accepted');
    await db.doc(`mandates/${BOOK_ID}/nominations/${id}`).update({ state: 'accepted' });
    const res = await post(retireBody(id, `ca2a_${(n += 1)}_${RUN}`));
    expect(res).toMatchObject({ statusCode: 409, body: { error: 'illegal_transition', stage: 'nominated', nominationState: 'accepted' } });
    expect((await nominationAt(id)).data().state).toBe('accepted');
    expect((await db.doc(`agents/${PARENT}/plays/${id}`).get()).data()).toMatchObject({ stage: 'nominated', version: 1, nomination: { state: 'queued' } });
  });

  it('CA-2: a declined record behind a copy still queued → the entry retires, its copy declined; the record untouched. No record at all → the entry retires, nothing written to the book', async () => {
    const id = await offerCard('ca2-declined');
    await db.doc(`mandates/${BOOK_ID}/nominations/${id}`).update({ state: 'declined', reason: 'Not for this book.' });
    const before = (await nominationAt(id)).data();
    expect((await post(retireBody(id, `ca2d_${(n += 1)}_${RUN}`))).statusCode).toBe(200);
    expect((await db.doc(`agents/${PARENT}/plays/${id}`).get()).data()).toMatchObject({ stage: 'retired', nomination: { state: 'declined' } });
    expect((await nominationAt(id)).data()).toEqual(before);
    const gone = await offerCard('ca2-gone');
    await db.doc(`mandates/${BOOK_ID}/nominations/${gone}`).delete();
    expect((await post(retireBody(gone, `ca2g_${(n += 1)}_${RUN}`))).statusCode).toBe(200);
    expect((await nominationAt(gone)).exists).toBe(false);
    expect((await db.doc(`agents/${PARENT}/plays/${gone}`).get()).data()).toMatchObject({ stage: 'retired', nomination: { state: 'queued' } });
  });

  it('CA-2: a record whose state the store does not know → 503 nomination_unavailable; nothing written, the card not retired', async () => {
    const id = await offerCard('ca2-unknown');
    await db.doc(`mandates/${BOOK_ID}/nominations/${id}`).update({ state: 'misfiled' });
    expect(await post(retireBody(id, `ca2u_${(n += 1)}_${RUN}`))).toMatchObject({ statusCode: 503, body: { error: 'nomination_unavailable' } });
    expect((await db.doc(`agents/${PARENT}/plays/${id}`).get()).data()).toMatchObject({ stage: 'nominated', version: 1 });
    expect((await nominationAt(id)).data().state).toBe('misfiled');
  });
});
