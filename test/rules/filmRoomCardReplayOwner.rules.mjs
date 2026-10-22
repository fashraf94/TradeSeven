// test/rules/filmRoomCardReplayOwner.rules.mjs
//
// Film Room B2 — Amendment I RI-1 (Astra's B2 review, F1, criterion 4) AGAINST
// THE REAL FIRESTORE EMULATOR. Not a security-rules test: the card store's
// create transaction (api/_utils/filmRoom/cardStore.js createCard), run
// through the Admin SDK as in production, so it rides the emulator runner —
// `npm run test:rules` (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST),
// outside the default suite (no `.test.` in the name). The
// filmTapeSizeBudget.rules.mjs precedent.
//
// Astra's repro: a card filed under an agent the caller owns, then — in
// synthetic Admin setup only — that entry's `ownerId` changed and NOTHING
// else; the create replayed with the same op id and request.
//   · another user's ownerId → 409 op_conflict, the refusal a foreign op id
//     gets, holding no field of the entry; the entry untouched;
//   · no ownerId at all (FieldValue.delete()) → the same refusal;
//   · the control: the owner restored, the same replay is the idempotent
//     success, the entry as stored;
//   · the cap: four own open cards and two open entries under the same agent
//     owned by another user and by no one → the fifth own card files and the
//     sixth is refused at 5 (the cap counts the caller's own, as readCards).
// Each row works under its own agent id; afterAll deletes them.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createCard, readCards, CARD_ROUTE_COPY } from '../../api/_utils/filmRoom/cardStore.js';

const UID = 'replay-owner-1';
const NOW = '2026-10-22T14:00:00.000Z';
const LATER = '2026-10-22T14:05:00.000Z';
const RUN = Date.now().toString(36);
const payload = () => ({
  archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2,
  battleId: 'b-replay', etDate: '2026-10-21', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5,
  questionId: 'stalled.want', questionVersion: 1, note: 'Let it go sooner.', route: 'watch',
});
const request = (agentId) => ({ battleId: 'b-replay', etDate: '2026-10-21', agentId, moment: { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', questionVersion: null, note: 'Let it go sooner.', route: 'watch' });
const refusal = (opId) => ({ status: 409, code: 'op_conflict', extra: { entryId: opId }, message: CARD_ROUTE_COPY.op_conflict });
/** A typed refusal as the route would send it, or the success. */
const outcome = async (p) => { try { return { ok: await p }; } catch (e) { return e.cardRoute ? { status: e.status, code: e.code, extra: e.extra, message: e.message } : { thrown: String(e) }; } };

let app;
let db;
const agents = [];
beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  // only ever the local emulator
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`filmRoomCardReplayOwner needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `film-room-card-replay-${RUN}`);
  db = getFirestore(app);
});
afterAll(async () => {
  if (db) for (const id of agents) await db.recursiveDelete(db.doc(`agents/${id}`));
  if (app) await deleteApp(app);
});

/** A fresh agent the caller owns, on the card's archetype. */
async function agentFor(row) {
  const id = `agent-ri1-${row}-${RUN}`;
  agents.push(id);
  await db.doc(`agents/${id}`).set({ ownerId: UID, name: 'Aurora', archetype: 'momentum_chaser' });
  return id;
}
const file = (agentId, opId, nowIso = NOW) => createCard(db, { uid: UID, agentId, opId, payload: payload(), nowIso, request: request(agentId) });
const entry = async (agentId, opId) => (await db.doc(`agents/${agentId}/plays/${opId}`).get()).data();

describe('Amendment I RI-1 (Astra F1) — a create replay answers only the entry\'s own owner, on the real emulator', () => {
  it('another user\'s ownerId, nothing else changed → 409 op_conflict with no field of the entry; the entry untouched', async () => {
    const agentId = await agentFor('foreign');
    const first = await file(agentId, 'op_1');
    expect(first.idempotent).toBe(false);
    await db.doc(`agents/${agentId}/plays/op_1`).update({ ownerId: 'someone-else' });
    const stored = await entry(agentId, 'op_1');
    expect(stored).toEqual({ ...first.card, ownerId: 'someone-else' });
    const r = await outcome(file(agentId, 'op_1', LATER));
    expect(r).toEqual(refusal('op_1'));
    expect(JSON.stringify(r)).not.toMatch(/someone-else|Let it go sooner|opFingerprint/);
    expect(await entry(agentId, 'op_1')).toEqual(stored);
  });

  it('no ownerId at all → the same refusal; the owner restored, the same replay is the idempotent success (the control)', async () => {
    const agentId = await agentFor('missing');
    const first = await file(agentId, 'op_1');
    await db.doc(`agents/${agentId}/plays/op_1`).update({ ownerId: FieldValue.delete() });
    expect('ownerId' in (await entry(agentId, 'op_1'))).toBe(false);
    expect(await outcome(file(agentId, 'op_1', LATER))).toEqual(refusal('op_1'));
    await db.doc(`agents/${agentId}/plays/op_1`).update({ ownerId: UID });
    const again = await outcome(file(agentId, 'op_1', LATER));
    expect(again).toEqual({ ok: { idempotent: true, card: first.card, open: 1, cap: 5 } });
    const all = await db.collection(`agents/${agentId}/plays`).get();
    expect(all.size).toBe(1);
  });

  it('the cap counts the caller\'s own entries: four own + one foreign-owned + one ownerless open entry → the fifth own card files, the sixth is refused at 5', async () => {
    const agentId = await agentFor('cap');
    for (let i = 0; i < 4; i += 1) await file(agentId, `own_${i}`);
    const own = await entry(agentId, 'own_0');
    await db.doc(`agents/${agentId}/plays/foreign`).set({ ...own, entryId: 'foreign', opId: 'foreign', ownerId: 'someone-else' });
    const ownerless = { ...own, entryId: 'ownerless', opId: 'ownerless' };
    delete ownerless.ownerId;
    await db.doc(`agents/${agentId}/plays/ownerless`).set(ownerless);
    expect(await outcome(file(agentId, 'own_4', LATER))).toMatchObject({ ok: { idempotent: false, open: 5, cap: 5 } });
    expect(await outcome(file(agentId, 'own_5', LATER))).toMatchObject({ status: 409, code: 'cap_reached', extra: { cap: 5, open: 5 } });
    const read = await readCards(db, { uid: UID, agentId });
    expect(read.open).toBe(5);
    expect(read.cards.map((c) => c.entryId).sort()).toEqual(['own_0', 'own_1', 'own_2', 'own_3', 'own_4']);
  });
});
