// api/_utils/filmRoom/cardStore.test.js
//
// Film Room B2 item 4 — the plays ledger's store (Build B spec §4; shared
// contract §5; Amendment G RG-8). The hypothesisRecords/store.js pattern:
// one transaction per write, idempotent by op id, expected-version checks;
// the open-card cap (S9) counting only cards that are neither shelved nor
// retired; shelving COMPUTED at read, never written (ruling 5; contract
// acceptance D). Over the tape suites' in-memory Firestore (real optimistic
// transactions, so the cap's race is a row, not a comment).

import { describe, it, expect } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): cardStore.js imports src/data/cardSlots.js; this import of the store is the runtime
// guard that the slots module stays Node-clean — never mocked.
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
import {
  createCard, retireCard, readCards, buildCardDoc, isShelved, isOpen, openCardCount, withShelving, stageForRoute,
  OPEN_CARD_CAP, CARD_ROUTES, CARD_STAGES, OPEN_STAGES, CARD_ROUTE_COPY, PLAYS_SUBCOLLECTION, CARD_SCHEMA_VERSION,
} from './cardStore.js';
import { CARD_SLOTS } from '../../../src/data/cardSlots.js';

const UID = 'owner-1';
const AGENT = 'agent-1';
const NOW = '2026-10-21T21:00:00.000Z';
const LATER = '2026-10-21T21:05:00.000Z';
const agentDoc = (over = {}) => ({ ownerId: UID, name: 'Aurora', archetype: 'momentum_chaser', ...over });
const payload = (over = {}) => ({
  archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2,
  battleId: 'b-1', etDate: '2026-10-20', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5,
  questionId: 'stalled.want', questionVersion: 1, note: 'Let it go sooner.', route: 'watch', ...over,
});
const fresh = (agent = agentDoc()) => makeTapeDb({ [`agents/${AGENT}`]: agent });
const playPath = (id) => `agents/${AGENT}/${PLAYS_SUBCOLLECTION}/${id}`;
const playWrites = (t) => t.writeLog.filter((w) => w.path.includes(`/${PLAYS_SUBCOLLECTION}/`));
const code = async (p) => { try { await p; return null; } catch (e) { return e.cardRoute ? { status: e.status, code: e.code, extra: e.extra, message: e.message } : { thrown: String(e) }; } };

describe('createCard — written once, as spec §4 lists it', () => {
  it('writes the entry at agents/{agentId}/plays/{opId} with exactly the spec\'s fields and the envelope; version 1; the stage from the route', async () => {
    const t = fresh();
    const r = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: NOW });
    expect(r.idempotent).toBe(false);
    expect(r).toMatchObject({ open: 1, cap: OPEN_CARD_CAP });
    const stored = t.store.get(playPath('op_1'));
    expect(stored).toEqual(r.card);
    expect(Object.keys(stored)).toEqual(['schemaVersion', 'entryId', 'ownerId', 'agentId', 'createdAt', 'archetypeCodeId', 'situationId', 'situationVersion', 'source', 'questionId', 'questionVersion', 'note', 'route', 'slotsVersion', 'stage', 'stageAt', 'stageHistory', 'version', 'opId', 'opFingerprint']);
    expect(stored).toMatchObject({
      schemaVersion: CARD_SCHEMA_VERSION, entryId: 'op_1', ownerId: UID, agentId: AGENT, createdAt: NOW, archetypeCodeId: 'momentum_chaser',
      situationId: 'stalled', situationVersion: 2, source: { battleId: 'b-1', etDate: '2026-10-20', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 },
      questionId: 'stalled.want', questionVersion: 1, note: 'Let it go sooner.', route: 'watch', stage: 'card', stageAt: NOW, version: 1, opId: 'op_1',
    });
    expect(stored.stageHistory).toEqual([{ stage: 'card', at: NOW, by: 'player', opId: 'op_1' }]);
    expect(typeof stored.opFingerprint).toBe('string');
    expect('shelved' in stored).toBe(false);   // never written
    expect(playWrites(t).map((w) => w.op)).toEqual(['tx.create']);
  });

  it('the stage by route: Watch and Set file a `card`; Practice (`drill`) files a `nominated` entry', async () => {
    expect(CARD_ROUTES).toEqual(['watch', 'drill', 'set']);
    expect(CARD_STAGES).toEqual(['card', 'nominated', 'retired']);
    expect(OPEN_STAGES).toEqual(['card', 'nominated']);
    expect(['watch', 'drill', 'set'].map(stageForRoute)).toEqual(['card', 'nominated', 'card']);
    const t = fresh();
    for (const [i, route] of CARD_ROUTES.entries()) {
      const r = await createCard(t.db, { uid: UID, agentId: AGENT, opId: `op_${i}`, payload: payload({ route }), nowIso: NOW });
      expect(r.card.stage).toBe(stageForRoute(route));
    }
  });

  it('idempotent by op id: the same op id with the same request is the entry again, and nothing is written twice', async () => {
    const t = fresh();
    const a = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: NOW });
    const b = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: LATER });
    expect(b).toEqual({ idempotent: true, card: a.card, open: 1, cap: OPEN_CARD_CAP });
    expect(playWrites(t)).toHaveLength(1);
  });

  it('the same op id with a DIFFERENT request → 409 op_conflict; nothing written', async () => {
    const t = fresh();
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: NOW });
    expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload({ note: 'Another note.' }), nowIso: LATER }))).toMatchObject({ status: 409, code: 'op_conflict' });
    expect(playWrites(t)).toHaveLength(1);
  });

  it('ownership: another user → 403 forbidden; a missing agent → 404; an agent with no archetype → 409 agent_unresolved — nothing written', async () => {
    const t = fresh();
    expect(await code(createCard(t.db, { uid: 'intruder', agentId: AGENT, opId: 'op_x', payload: payload(), nowIso: NOW }))).toMatchObject({ status: 403, code: 'forbidden' });
    expect(await code(createCard(t.db, { uid: UID, agentId: 'nope', opId: 'op_x', payload: payload(), nowIso: NOW }))).toMatchObject({ status: 404, code: 'agent_not_found' });
    const u = fresh(agentDoc({ archetype: null }));
    expect(await code(createCard(u.db, { uid: UID, agentId: AGENT, opId: 'op_x', payload: payload(), nowIso: NOW }))).toMatchObject({ status: 409, code: 'agent_unresolved' });
    expect(playWrites(t)).toEqual([]);
    expect(playWrites(u)).toEqual([]);
  });
});

describe('the open-card cap (S9) — only cards that are neither shelved nor retired count', () => {
  const fill = async (t, n, over = {}) => { for (let i = 0; i < n; i += 1) await createCard(t.db, { uid: UID, agentId: AGENT, opId: `fill_${i}`, payload: payload(over), nowIso: NOW }); };

  it('S9 is the slots module\'s value (5); the sixth open card is refused with the cap named', async () => {
    expect(OPEN_CARD_CAP).toBe(CARD_SLOTS.S9.openCardsPerAgent);
    expect(OPEN_CARD_CAP).toBe(5);
    const t = fresh();
    await fill(t, 5);
    const r = await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_6', payload: payload(), nowIso: NOW }));
    expect(r).toMatchObject({ status: 409, code: 'cap_reached', extra: { cap: 5, open: 5 } });
    expect(r.message).toBe(CARD_ROUTE_COPY.cap_reached);
    expect(t.store.has(playPath('op_6'))).toBe(false);
  });

  it('a RETIRED card does not count: retire one of five, and the sixth files', async () => {
    const t = fresh();
    await fill(t, 5);
    await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'fill_0', opId: 'ret_0', expectedVersion: 1, nowIso: LATER });
    const r = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_6', payload: payload(), nowIso: LATER });
    expect(r).toMatchObject({ idempotent: false, open: 5 });
  });

  it('a SHELVED card does not count: five cards under another archetype leave the cap untouched (the mutant: the cap counting a shelved card)', async () => {
    const t = fresh(agentDoc({ archetype: 'guardian' }));
    await fill(t, 5, { archetypeCodeId: 'guardian' });
    // the agent changes archetype: the five are shelved — no write to any card
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'momentum_chaser' }));
    const before = playWrites(t).length;
    const r = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_6', payload: payload({ archetypeCodeId: 'momentum_chaser' }), nowIso: LATER });
    expect(r).toMatchObject({ idempotent: false, open: 1, cap: 5 });
    expect(playWrites(t).length).toBe(before + 1);
    // …and a nominated card counts like a card
    const u = fresh();
    await fill(u, 5, { route: 'drill' });
    expect(await code(createCard(u.db, { uid: UID, agentId: AGENT, opId: 'op_6', payload: payload(), nowIso: NOW }))).toMatchObject({ code: 'cap_reached', extra: { open: 5 } });
  });

  it('the cap is race-safe: a card landed between a creating transaction\'s read and its commit is counted on the retry', async () => {
    let armed = false;
    let landed = false;
    const t = makeTapeDb({ [`agents/${AGENT}`]: agentDoc() }, {
      hooks: {
        afterTxRead: async (label, db) => {
          if (!armed || landed || !label.startsWith('tx:agents/agent-1/plays')) return;
          landed = true;
          // a concurrent request's card commits now (its own transaction)
          await createCard(db, { uid: UID, agentId: AGENT, opId: 'concurrent', payload: payload(), nowIso: NOW });
        },
      },
    });
    await fill(t, 4);
    armed = true;
    const r = await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_late', payload: payload(), nowIso: LATER }));
    expect(r).toMatchObject({ status: 409, code: 'cap_reached', extra: { cap: 5, open: 5 } });
    expect(t.db.txRetries).toBeGreaterThan(0);
    expect(t.store.has(playPath('concurrent'))).toBe(true);
    expect(t.store.has(playPath('op_late'))).toBe(false);
  });

  it('openCardCount / isOpen / isShelved — the pure readers', () => {
    const cards = [
      { stage: 'card', archetypeCodeId: 'a' }, { stage: 'nominated', archetypeCodeId: 'a' }, { stage: 'retired', archetypeCodeId: 'a' },
      { stage: 'card', archetypeCodeId: 'b' }, { stage: 'drilled', archetypeCodeId: 'a' },
    ];
    expect(cards.map((c) => isShelved(c, 'a'))).toEqual([false, false, false, true, false]);
    expect(cards.map((c) => isOpen(c, 'a'))).toEqual([true, true, false, false, false]);
    expect(openCardCount(cards, 'a')).toBe(2);
    expect(openCardCount(cards, 'b')).toBe(1);
    expect(withShelving(cards, 'b').map((c) => c.shelved)).toEqual([true, true, true, false, true]);
  });
});

describe('retireCard — a compare-and-set on the version the caller saw', () => {
  const seeded = async () => { const t = fresh(); await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW }); return t; };

  it('moves the stage to retired, appends the stage row with its op id, and bumps the version — once', async () => {
    const t = await seeded();
    const r = await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 1, nowIso: LATER });
    expect(r.idempotent).toBe(false);
    const stored = t.store.get(playPath('c1'));
    expect(stored).toEqual(r.card);
    expect(stored).toMatchObject({ stage: 'retired', stageAt: LATER, version: 2, note: 'Let it go sooner.', route: 'watch', createdAt: NOW });
    expect(stored.stageHistory.map((h) => [h.stage, h.at, h.by, h.opId])).toEqual([['card', NOW, 'player', 'c1'], ['retired', LATER, 'player', 'r1']]);
    expect('shelved' in stored).toBe(false);
    expect(playWrites(t).map((w) => w.op)).toEqual(['tx.create', 'tx.update']);
  });

  it('idempotent: the same retire op id again is the entry as retired, with no second write; a different request under that op id → op_conflict', async () => {
    const t = await seeded();
    const a = await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 1, nowIso: LATER });
    const b = await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 1, nowIso: '2026-10-21T22:00:00.000Z' });
    expect(b).toEqual({ idempotent: true, card: a.card });
    expect(playWrites(t)).toHaveLength(2);
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 2, nowIso: LATER }))).toMatchObject({ status: 409, code: 'op_conflict' });
  });

  it('the version does not match → 409 version_conflict naming the current version; nothing written', async () => {
    const t = await seeded();
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 2, nowIso: LATER }))).toMatchObject({ status: 409, code: 'version_conflict', extra: { currentVersion: 1 } });
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 0, nowIso: LATER }))).toMatchObject({ code: 'version_conflict' });
    expect(playWrites(t)).toHaveLength(1);
  });

  it('a SHELVED card cannot move stage → 409 shelved; it moves again once the archetype returns (no write in between)', async () => {
    const t = await seeded();
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'guardian' }));
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 1, nowIso: LATER }))).toMatchObject({ status: 409, code: 'shelved', extra: { archetypeCodeId: 'momentum_chaser' } });
    expect(playWrites(t)).toHaveLength(1);
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'momentum_chaser' }));
    expect((await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 1, nowIso: LATER })).card.stage).toBe('retired');
  });

  it('retired → retired is no transition (409 illegal_transition under a new op id); a missing entry → 404; another user → 403', async () => {
    const t = await seeded();
    await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r1', expectedVersion: 1, nowIso: LATER });
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'c1', opId: 'r2', expectedVersion: 2, nowIso: LATER }))).toMatchObject({ status: 409, code: 'illegal_transition', extra: { stage: 'retired' } });
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'nope', opId: 'r3', expectedVersion: 1, nowIso: LATER }))).toMatchObject({ status: 404, code: 'not_found' });
    expect(await code(retireCard(t.db, { uid: 'intruder', agentId: AGENT, entryId: 'c1', opId: 'r4', expectedVersion: 2, nowIso: LATER }))).toMatchObject({ status: 403, code: 'forbidden' });
  });
});

describe('readCards — shelving is computed at read, never written (ruling 5; contract acceptance D)', () => {
  it('an archetype change shelves the entries; changing back restores them; no play document is written in between, and none ever holds `shelved`', async () => {
    const t = fresh();
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW });
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c2', payload: payload({ route: 'drill' }), nowIso: LATER });
    const writesBefore = playWrites(t).length;
    const a = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(a).toMatchObject({ agentId: AGENT, archetypeCodeId: 'momentum_chaser', open: 2, cap: 5 });
    expect(a.cards.map((c) => [c.entryId, c.shelved])).toEqual([['c2', false], ['c1', false]]);   // newest first
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'guardian' }));
    const b = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(b.cards.map((c) => [c.entryId, c.shelved])).toEqual([['c2', true], ['c1', true]]);
    expect(b.open).toBe(0);
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'momentum_chaser' }));
    const c = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(c.cards.map((x) => x.shelved)).toEqual([false, false]);
    expect(c.open).toBe(2);
    expect(playWrites(t).length).toBe(writesBefore);
    for (const [p, d] of t.store.entries()) if (p.includes('/plays/')) expect('shelved' in d, p).toBe(false);
  });

  it('reads the owner\'s own entries only, and refuses another user or a missing agent', async () => {
    const t = fresh();
    await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'c1', payload: payload(), nowIso: NOW });
    // an entry planted under the agent naming another owner is not the owner's
    t.store.set(playPath('planted'), { ...buildCardDoc({ entryId: 'planted', uid: 'intruder', agentId: AGENT, opId: 'planted', opFingerprint: 'x', nowIso: NOW, payload: payload() }) });
    const r = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(r.cards.map((c) => c.entryId)).toEqual(['c1']);
    expect(await code(readCards(t.db, { uid: 'intruder', agentId: AGENT }))).toMatchObject({ status: 403, code: 'forbidden' });
    expect(await code(readCards(t.db, { uid: UID, agentId: 'nope' }))).toMatchObject({ status: 404, code: 'agent_not_found' });
    expect(playWrites(t)).toHaveLength(1);
  });
});

// ── the review's rows (docs/audits/20261021_BUILD_FILM_ROOM_B2_CARD.md §9) ──
describe('review L1-1 / L5-1 — a day taped under another archetype than the agent\'s current one files no card (it would be shelved at birth)', () => {
  it('six creates under the tape\'s archetype while the agent is on another: every one 409 archetype_changed, nothing written, the cap never bypassed; the same creates file once the agent returns', async () => {
    const t = fresh(agentDoc({ archetype: 'guardian' }));
    for (let i = 0; i < 6; i += 1) {
      const r = await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: `born_${i}`, payload: payload({ archetypeCodeId: 'momentum_chaser' }), nowIso: NOW }));
      expect(r, String(i)).toMatchObject({ status: 409, code: 'archetype_changed', extra: { archetypeCodeId: 'momentum_chaser', current: 'guardian' } });
    }
    expect(playWrites(t)).toEqual([]);
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).cards).toEqual([]);
    t.store.set(`agents/${AGENT}`, agentDoc({ archetype: 'momentum_chaser' }));
    for (let i = 0; i < 5; i += 1) expect((await createCard(t.db, { uid: UID, agentId: AGENT, opId: `born_${i}`, payload: payload(), nowIso: NOW })).card.stage).toBe('card');
    expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'born_5', payload: payload(), nowIso: NOW }))).toMatchObject({ code: 'cap_reached', extra: { open: 5 } });
    // a card under the agent's current archetype files; the refusal is about the DAY's archetype, not the agent's
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).cards.every((c) => c.shelved === false)).toBe(true);
  });
});

describe('review L1-4 — the create fingerprint hashes the client\'s request, not the server-resolved payload', () => {
  it('the same request after a re-tag moved the stored items\' version label (situationVersion 2 → 3 in the payload) is the idempotent success, not op_conflict', async () => {
    const t = fresh();
    const request = { battleId: 'b-1', etDate: '2026-10-20', agentId: AGENT, moment: { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', questionVersion: null, note: 'Let it go sooner.', route: 'watch' };
    const a = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload({ situationVersion: 2 }), nowIso: NOW, request });
    const b = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload({ situationVersion: 3 }), nowIso: LATER, request });
    expect(b).toMatchObject({ idempotent: true, card: a.card });
    expect(b.card.situationVersion).toBe(2);   // the entry keeps the version it was written under
    // a DIFFERENT request under the same op id is still a conflict
    expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: LATER, request: { ...request, note: 'Another.' } }))).toMatchObject({ code: 'op_conflict' });
    expect(playWrites(t)).toHaveLength(1);
  });
});

// ── Astra's B2 review (docs/audits/20261022_ASTRA_REVIEW_FILM_ROOM_B2_CARD.md), as Amendment I rules it ──
describe('Amendment I RI-1 (Astra F1) — a create replay answers only the entry\'s own owner; the cap counts only the caller\'s entries', () => {
  // the refusal a foreign op id gets: the code, its sentence and the caller's own op id — no field of the stored entry
  const REFUSAL = { status: 409, code: 'op_conflict', extra: { entryId: 'op_1' }, message: CARD_ROUTE_COPY.op_conflict };
  const withoutOwner = (doc) => { const rest = { ...doc }; delete rest.ownerId; return rest; };

  it('Astra\'s repro: the entry under the caller\'s agent carries another user\'s ownerId, nothing else changed — the same op id and request → 409 op_conflict, nothing of the entry, nothing written', async () => {
    const t = fresh();
    const a = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: NOW });
    t.store.set(playPath('op_1'), { ...a.card, ownerId: 'someone-else' });
    const r = await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: LATER }));
    expect(r).toEqual(REFUSAL);
    expect(JSON.stringify(r)).not.toMatch(/someone-else|Let it go sooner|opFingerprint/);
    expect(playWrites(t)).toHaveLength(1);
    expect(t.store.get(playPath('op_1'))).toEqual({ ...a.card, ownerId: 'someone-else' });
  });

  it('a missing ownerId is refused the same way; the same owner\'s replay stays the idempotent success (the control)', async () => {
    const t = fresh();
    const a = await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: NOW });
    t.store.set(playPath('op_1'), withoutOwner(a.card));
    expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: LATER }))).toEqual(REFUSAL);
    t.store.set(playPath('op_1'), a.card);
    expect(await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'op_1', payload: payload(), nowIso: LATER })).toEqual({ idempotent: true, card: a.card, open: 1, cap: OPEN_CARD_CAP });
    expect(playWrites(t)).toHaveLength(1);
  });

  it('the cap ignores an open entry under the caller\'s agent owned by another user or by no one: four own + those two → the fifth own card files, the sixth is refused at 5 (the mutant: the cap counting them)', async () => {
    const t = fresh();
    for (let i = 0; i < 4; i += 1) await createCard(t.db, { uid: UID, agentId: AGENT, opId: `own_${i}`, payload: payload(), nowIso: NOW });
    const own = t.store.get(playPath('own_0'));
    t.store.set(playPath('foreign'), { ...own, entryId: 'foreign', opId: 'foreign', ownerId: 'someone-else' });
    t.store.set(playPath('ownerless'), withoutOwner({ ...own, entryId: 'ownerless', opId: 'ownerless' }));
    expect(await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'own_4', payload: payload(), nowIso: LATER })).toMatchObject({ idempotent: false, open: 5, cap: 5 });
    expect(await code(createCard(t.db, { uid: UID, agentId: AGENT, opId: 'own_5', payload: payload(), nowIso: LATER }))).toMatchObject({ status: 409, code: 'cap_reached', extra: { cap: 5, open: 5 } });
    // a replay's count is the caller's own too
    expect(await createCard(t.db, { uid: UID, agentId: AGENT, opId: 'own_0', payload: payload(), nowIso: LATER })).toMatchObject({ idempotent: true, open: 5 });
    expect((await readCards(t.db, { uid: UID, agentId: AGENT })).open).toBe(5);
  });
});
