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
//   · the archetype checks read the parent (both directions);
//   · the replay and the retire are keyed on the parent.
// Every row works under ids unique to the run; afterAll deletes them.
//
// Only the Admin handle (the emulator's), the security and auth middleware and
// the two flags are doubled.

import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

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

/** A fresh battle id for this run, over a copy of the real day. `agentId` is what the battle and its tape record. */
async function battleFor(row, agentId, { ownerId = UID, etDate = D, tags = null } = {}) {
  const id = `rk1-${row}-${RUN}-${(n += 1)}`;
  battles.push(id);
  await db.doc(`agentBattles/${id}`).set({ ...fixture.battle, id, ownerId, agentId });
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
  fixture = { battle: fx.battle, tape };
});
beforeEach(async () => {
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
    // the Watch card, filed under the parent from the ranked battle's day before any of the days above
    const card = await createCard(db, {
      uid: UID, agentId: PARENT, opId: `w_${RUN}`, nowIso: '2026-09-20T02:00:00.000Z',
      payload: { archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: fixture.tape.tags.items[0].version, battleId: ranked, etDate: '2026-09-18', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, questionId: 'stalled.want', questionVersion: 1, note: 'Watch it.', route: 'watch' },
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
