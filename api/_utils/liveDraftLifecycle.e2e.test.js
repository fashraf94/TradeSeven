// api/_utils/liveDraftLifecycle.e2e.test.js
//
// Phase 5 Deliverable 1 — THE BYTE-IDENTITY PROOF for Competitive Live Draft.
// Walks ONE slot pod through its WHOLE lifecycle across SIMULATED time, driving
// the REAL modules end-to-end — no fenced edit, no copied logic:
//
//   claim → 2nd human joins (count rises) → slot fires (CPU-fill from the shared
//   counter → DRAFTING, snake + deadline) → one human pick (fresh clock) →
//   abandonment → ONE drive pass completes every overdue turn → AWAITING_OPEN
//   (startAnchor = battleStartWeek) → the EXISTING Monday flip → BATTLE.
//
// THEN it asserts the crown jewel: from BATTLE onward the pod is byte-identical
// to a SINGLE-SHOT-formed pod. An independently-constructed control pod holding
// the SAME picks per seat is placed beside it and the REAL canonical-open sweep
// captures both baselines identically, and the REAL nightly banking scores both
// identically. The scorer never notices how the pod was born.
//
// Plus the structural guarantees at the integration level (not just their units):
//   • a zero-claim slot never materializes a group; the last human's release
//     deletes it (structural expiry);
//   • a Monday-8:45 pre-open abandoned draft completes INLINE to BATTLE before
//     9:30 (re-assert, don't re-derive);
//   • a fired-LATE pod re-anchors to the next Monday in the full-lifecycle path
//     (the Addition-2 stale-anchor guard, exercised end-to-end).
//
// REAL imports (BUILD_RULES §4 dependency-surface guard): the whole live-draft
// span + the canonical sweep + banking loading clean in one Node test proves the
// api/ -> src/ surface stays Node-clean and the scorer is REACHED, never copied.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The pinned vendor source for the canonical-open sweep — stubbed per phase.
const fetchBatchQuotes = vi.fn();
vi.mock('./tournamentPrices.js', () => ({ fetchBatchQuotes: (...a) => fetchBatchQuotes(...a) }));

import {
  claimSlotSeat,
  releaseSlotSeat,
  getSlotOccupancy,
  slotGroupId,
} from './liveDraftFormation.js';
import {
  fireCompetitiveSlotDraft,
  driveSlotDraftAutopick,
  applyCompetitivePick,
  findDueSlotGroups,
} from './liveDraftLifecycle.js';
import { flipAwaitingOpenPods } from './trainingLifecycle.js';
import { runCanonicalOpenSweep } from './canonicalOpenSweep.js';
import { computeBankingUpdate } from './tournamentBanking.js';
import {
  GROUP_STATUS,
  GROUP_SIZE,
  PICKS_PER_PLAYER,
  BASELINE_SOURCE,
  BASELINE_POLICY,
  CAPTURE_STATE,
  cpuAgentDocId,
  createPickState,
  TOURNAMENT_GROUPS_COLLECTION,
} from '../../src/constants/leagueTournament.js';

beforeEach(() => {
  fetchBatchQuotes.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ─────────────────────────── in-memory Firestore ───────────────────────────
// The path-based makeDb idiom shared by the live-draft unit batteries: auto-ids,
// where(), nested sub-collections, and a transaction with get/set/update/delete.
function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
}
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  let autoSeq = 0;
  function makeDocRef(path) {
    return {
      path, id: path.split('/').pop(),
      get: async () => ({ exists: store.has(path), id: path.split('/').pop(), data: () => structuredClone(store.get(path)) }),
      set: async (data) => { store.set(path, structuredClone(data)); },
      update: async (u) => { const d = store.get(path); if (d === undefined) throw new Error(`update missing ${path}`); applyDotPathUpdate(d, u); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function topLevelDocs(prefix) {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  }
  const snapshotOf = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) });
  function makeCollection(prefix) {
    const filtered = (field, op, value) => topLevelDocs(prefix).filter((d) => {
      const fv = d.data()[field];
      return op === 'array-contains' ? (Array.isArray(fv) && fv.includes(value)) : fv === value;
    });
    return {
      doc: (id) => makeDocRef(`${prefix}/${id ?? `auto-${++autoSeq}`}`),
      where: (field, op, value) => ({ get: async () => snapshotOf(filtered(field, op, value)) }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
  }
  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); },
      update: (ref, u) => { const d = store.get(ref.path); if (d === undefined) throw new Error(`tx.update missing ${ref.path}`); applyDotPathUpdate(d, u); },
      delete: (ref) => { store.delete(ref.path); },
    }),
  };
  return { db, store };
}

// ─────────────────────────── fixtures ───────────────────────────
const SYMBOLS = Array.from({ length: 40 }, (_, i) => `SYM${String(i).padStart(2, '0')}`);
const STOCKS = SYMBOLS.map((symbol, i) => ({ symbol, sectorName: 'Technology', fundamentalScore: 95 - i, technicalScore: 95 - i, baggerBombFit: 95 - i, atrPercentile: 0.5 }));
const humanAgent = (ownerId) => ({ ownerId, isCpu: false, name: ownerId, archetype: 'analyst', config: { risk: 50, concentration: 50, momentum: 50 }, personality: { traits: [] }, consolidatedInsight: '', evolutionCycle: 0 });

/** A db seeded with the ranking universe (fire needs a board) + one agent doc
 *  per human (fire reads the human archetype). No group yet — claim creates it. */
function seededDb(humanIds) {
  const seed = { 'indexIntelligence/stockRankings': { stocks: STOCKS } };
  for (const id of humanIds) seed[`agents/${id}`] = humanAgent(id);
  return makeDb(seed);
}
const groupPath = (id) => `${TOURNAMENT_GROUPS_COLLECTION}/${id}`;
const readGroup = (store, id) => store.get(groupPath(id));

// Build a pick the way the SINGLE-SHOT resolver does — the SAME createPickState
// factory + the SAME args the shared handoff passes (trainingLifecycle.js:317:
// DRAFT_RESOLUTION source, null baseline). `openedAt` is threaded from the live
// pod so a byte-for-byte deepEqual is exact (openedAt is the completion instant).
const resolverPick = (symbol, openedAt) => createPickState({ symbol, baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION, baselinePrice: null, openedAt });

/** A SINGLE-SHOT-formed control pod holding the same picks, per seat, as a driven
 *  live-draft pod — seeded from the live pod's actual seat→symbols and its own
 *  openedAt, so the two books are compared like-for-like. baselinePolicy
 *  CANONICAL_OPEN is the one field the capture flag adds (identical to
 *  formGroupFromLobby / liveDraftFormation.js:255). */
function singleShotControl(livePlayers, openedAt) {
  return {
    status: GROUP_STATUS.BATTLE, roundNumber: 1, baseLayerWeek: '2026-W29',
    baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN,
    groupMembers: livePlayers.filter((p) => p.isCpu !== true).map((p) => p.odUserId),
    players: livePlayers.map((p) => ({
      odUserId: p.odUserId,
      ...(p.isCpu === true ? { isCpu: true } : {}),
      picks: p.picks.map((pk) => resolverPick(pk.symbol, openedAt)),
    })),
    userPool: [], canonicalOpens: {}, dailyScores: {},
    createdAt: '2026-07-13T13:00:00.000Z', updatedAt: '2026-07-13T13:00:00.000Z',
  };
}

const stubOpens = (symbols, open = 100) => fetchBatchQuotes.mockResolvedValue(
  Object.fromEntries(symbols.map((s) => [s, { open, close: open, current: open, previousClose: open, timestamp: 1721070000 }])),
);
// Post-sweep leg fields the scorer/banker actually read (the birth-agnostic view).
const capturedShape = (players) => players.map((p) => ({
  odUserId: p.odUserId,
  picks: p.picks.map((pk) => ({
    symbol: pk.symbol,
    baselinePrice: pk.legs[0].baselinePrice,
    baselineSource: pk.legs[0].baselineSource,
    captureState: pk.legs[0].captureState,
  })),
}));

// ══════════════════════════════════════════════════════════════════════════
describe('Competitive Live Draft — full-lifecycle capstone (the byte-identity proof)', () => {
  it('claim → join → fire → pick → abandon → AWAITING_OPEN → Monday flip → BATTLE, then byte-identical to single-shot from BATTLE onward', async () => {
    const humanIds = ['human-1', 'human-2'];
    const { db, store } = seededDb(humanIds);
    const NOW0 = new Date('2026-07-06T12:00:00.000Z'); // Mon 8am EDT, before the Wed slot
    const WED_ID = slotGroupId('wed-1900', '2026-07-08');

    // ── 1) CLAIM lazily creates the FORMING slot group; a 2nd human joins ──
    const c1 = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'human-1', displayName: 'Ada', now: NOW0 });
    expect(c1).toMatchObject({ groupId: WED_ID, created: true, joined: false, humanCount: 1 });
    expect(c1.scheduledDraftAt).toBe('2026-07-08T23:00:00.000Z');
    expect(c1.battleStartWeek.mondayEtDate).toBe('2026-07-13'); // Wed → the following Monday

    const c2 = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'human-2', displayName: 'Bo', now: NOW0 });
    expect(c2).toMatchObject({ groupId: WED_ID, created: false, joined: true, humanCount: 2 });

    // occupancy feed rises with the join
    const occ = await getSlotOccupancy(db, NOW0);
    expect(occ.find((r) => r.slotId === 'wed-1900')).toMatchObject({ humanCount: 2, isFull: false });

    // FORMING + isLiveDraft: humans-only, invisible to the ranked pipeline
    const forming = readGroup(store, WED_ID);
    expect(forming).toMatchObject({ status: GROUP_STATUS.FORMING, isLiveDraft: true });
    expect(forming.isTraining).toBeUndefined();
    expect('baselinePolicy' in forming).toBe(false); // capture flag off → byte-identical omission

    // ── 2) FIRE the due slot → DRAFTING, CPU-filled from the shared counter ──
    const FIRE = new Date('2026-07-08T23:00:00.000Z'); // Wed 7pm EDT
    expect((await findDueSlotGroups(db, FIRE)).map((d) => d.id)).toContain(WED_ID);

    const fired = await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE });
    expect(fired).toMatchObject({ status: GROUP_STATUS.DRAFTING, fired: true });
    const drafting = readGroup(store, WED_ID);
    expect(drafting.players).toHaveLength(GROUP_SIZE);
    expect(drafting.players.filter((p) => p.isCpu === true)).toHaveLength(2); // 2 humans + 2 CPUs
    expect(drafting.userPool.length).toBe(SYMBOLS.length); // fresh board stamped at fire
    expect(store.has(`agents/${cpuAgentDocId(1)}`)).toBe(true);
    const state0 = store.get(`${groupPath(WED_ID)}/draft/state`);
    expect(state0.status).toBe('drafting');
    expect(state0.snakeOrder).toHaveLength(GROUP_SIZE * PICKS_PER_PLAYER);

    // ── 3) one HUMAN pick, then abandon → ONE drive pass completes it ──
    const chosen = state0.pool[0];
    const picked = await applyCompetitivePick(db, WED_ID, { odUserId: 'human-1', symbol: chosen, now: new Date(FIRE.getTime() + 5000) });
    expect(picked.complete).toBe(false);

    const drive = await driveSlotDraftAutopick(db, WED_ID, { now: new Date(FIRE.getTime() + 20 * 60 * 1000) });
    expect(drive).toMatchObject({ complete: true, status: GROUP_STATUS.AWAITING_OPEN });

    const awaiting = readGroup(store, WED_ID);
    expect(awaiting.status).toBe(GROUP_STATUS.AWAITING_OPEN); // Wed pod → parks until Monday
    expect(awaiting.startAnchor).toEqual({ anchorEtDate: '2026-07-13', anchorIso: '2026-07-13T13:30:00.000Z' });
    expect(awaiting.players.find((p) => p.odUserId === 'human-1').picks.map((pk) => pk.symbol)).toContain(chosen.toUpperCase());
    // still NOT 'battle' → invisible to the sweep / banking / scorers (the firewall)
    expect(awaiting.status).not.toBe(GROUP_STATUS.BATTLE);
    // every seat holds a full, resolver-shaped book: DRAFT_RESOLUTION, null baseline
    for (const p of awaiting.players) {
      expect(p.picks).toHaveLength(PICKS_PER_PLAYER);
      for (const pk of p.picks) {
        expect(pk.legs[0]).toMatchObject({
          baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION,
          baselinePrice: null,
          captureState: null,
          direction: 'long',
        });
      }
    }

    // ── 4) MONDAY FLIP — the EXISTING flipAwaitingOpenPods carries it to BATTLE ──
    const MON_PREOPEN = new Date('2026-07-13T12:00:00.000Z'); // Mon 8am EDT — anchor date reached, pre-open
    const flip = await flipAwaitingOpenPods(db, { now: MON_PREOPEN });
    expect(flip).toMatchObject({ flipped: 1 }); // the live-draft pod is picked up (not training-excluded)
    const battle = readGroup(store, WED_ID);
    expect(battle.status).toBe(GROUP_STATUS.BATTLE);

    // ── 5) BYTE-IDENTITY from BATTLE onward ────────────────────────────────
    // Model "born under the capture flag": stamp the one field liveDraftFormation
    // .js:255 adds under LEAGUE_CANONICAL_OPEN_CAPTURE (identical to formGroupFrom
    // Lobby). Then place an INDEPENDENT single-shot control holding the same picks
    // per seat beside it, and drive the REAL sweep + REAL banking over both.
    await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(WED_ID).update({ baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN });
    const CTRL_ID = 'ctrl_single_shot';
    const openedAt = battle.players[0].picks[0].legs[0].openedAt; // the completion instant
    store.set(groupPath(CTRL_ID), singleShotControl(battle.players, openedAt));

    const liveSymbols = battle.players.flatMap((p) => p.picks.map((pk) => pk.symbol));
    const ctrlPlayers = store.get(groupPath(CTRL_ID)).players;
    expect(ctrlPlayers.flatMap((p) => p.picks.map((pk) => pk.symbol))).toEqual(liveSymbols); // same picks, same seats

    // FORMATION PARITY (pre-sweep): every seat's book is BYTE-IDENTICAL to the
    // single-shot resolver's createPickState output — same provenance, same leg
    // fields, not a look-alike. This is what makes "born differently" the ONLY
    // variable left for the sweep/banking parity below to rule out.
    expect(battle.players.map((p) => p.picks)).toEqual(ctrlPlayers.map((p) => p.picks));
    // …and the cohort WEEK matches the single-shot pod's: the Wed-claimed pod is
    // filed under its next-Monday battle week (2026-W29), not the claim week
    // (finding #1 fixed — baseLayerWeek derives from battleStartWeek).
    expect(readGroup(store, WED_ID).baseLayerWeek).toBe('2026-W29');
    expect(readGroup(store, WED_ID).baseLayerWeek).toBe(store.get(groupPath(CTRL_ID)).baseLayerWeek);

    // (A) PRE-OPEN: the sweep is a clean session-gated no-op for BOTH pods.
    const preRun = await runCanonicalOpenSweep(db, { now: new Date('2026-07-13T12:00:00.000Z') });
    expect(preRun).toMatchObject({ skipped: true });
    expect(fetchBatchQuotes).not.toHaveBeenCalled();

    // (B) POST-OPEN SWEEP — captures each pod's baseline at the SAME open, identically.
    stubOpens([...new Set(liveSymbols)], 100);
    const sweep = await runCanonicalOpenSweep(db, { now: new Date('2026-07-13T15:00:00.000Z') }); // Mon 11am EDT
    expect(sweep).toMatchObject({ groups: 2 }); // both battle pods swept in one pass
    expect(sweep.captured).toBeGreaterThan(0);  // non-vacuous: the sweep actually captured baselines

    const liveB = readGroup(store, WED_ID);
    const ctrlB = readGroup(store, CTRL_ID);
    // each captured leg took the frozen open as its baseline, DRAFT_RESOLUTION → CAPTURE
    for (const p of liveB.players) for (const pk of p.picks) {
      expect(pk.legs[0].baselinePrice).toBe(100);
      expect(pk.legs[0].baselineSource).toBe(BASELINE_SOURCE.CANONICAL_OPEN_CAPTURE);
      expect(pk.legs[0].captureState).toBe(CAPTURE_STATE.CAPTURED);
    }
    // THE ASSERTION: the sweep's view of the live-draft pod == its view of the
    // single-shot pod. The capture is birth-agnostic.
    expect(Object.keys(liveB.canonicalOpens).length).toBeGreaterThan(0); // non-vacuous
    expect(capturedShape(liveB.players)).toEqual(capturedShape(ctrlB.players));
    expect(liveB.canonicalOpens).toEqual(ctrlB.canonicalOpens);

    // (C) NIGHTLY BANKING — identical inputs → identical composite standings.
    const bankArgs = {
      nowIso: '2026-07-13T20:30:00.000Z', etDate: '2026-07-13', atrPercentiles: null, recordedBy: 'e2e',
      agentScores: Object.fromEntries(battle.players.map((p, i) => [p.odUserId, 50 - i * 5])),
    };
    const quotes = Object.fromEntries([...new Set(liveSymbols)].map((s) => [s, { open: 100, current: 106, previousClose: 99, timestamp: 1 }]));
    const bankLive = computeBankingUpdate(readGroup(store, WED_ID), quotes, bankArgs);
    const bankCtrl = computeBankingUpdate(readGroup(store, CTRL_ID), quotes, bankArgs);

    // banked baselines held the captured snapshot on BOTH; the day's standings match.
    for (const p of bankLive.players) for (const pk of p.picks) expect(pk.legs[0].baselinePrice).toBe(100);
    // non-vacuous: the human actually scored on the +6% move, and it composited in.
    const liveHuman = bankLive.dayEntry.closeScores['human-1'];
    expect(liveHuman.totalPoints).toBeGreaterThan(0);
    expect(liveHuman.compositePoints).toBe(bankCtrl.dayEntry.closeScores['human-1'].compositePoints);
    expect(Object.keys(bankLive.dayEntry.closeScores)).toEqual(Object.keys(bankCtrl.dayEntry.closeScores));
    expect(bankLive.dayEntry.closeScores).toEqual(bankCtrl.dayEntry.closeScores); // ← the crown jewel
  });

  // ── structural expiry — a slot with no humans never becomes a pod ──
  it('a zero-claim slot never materializes a group; the last human release deletes it', async () => {
    const { db, store } = seededDb(['human-1']);
    const WED_ID = slotGroupId('wed-1900', '2026-07-08');
    const NOW0 = new Date('2026-07-06T12:00:00.000Z');

    // nothing claimed → no group exists, nothing due to fire, occupancy reads zero
    expect(store.has(groupPath(WED_ID))).toBe(false);
    expect(await findDueSlotGroups(db, new Date('2026-07-08T23:05:00.000Z'))).toEqual([]);
    const occ0 = await getSlotOccupancy(db, NOW0);
    for (const row of occ0) expect(row).toMatchObject({ humanCount: 0, seats: [] });

    // claim then release the last seat → the group is deleted (structural expiry)
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'human-1', now: NOW0 });
    expect(store.has(groupPath(WED_ID))).toBe(true);
    const rel = await releaseSlotSeat(db, WED_ID, { odUserId: 'human-1', now: NOW0 });
    expect(rel).toMatchObject({ released: true, deleted: true, humanCount: 0 });
    expect(store.has(groupPath(WED_ID))).toBe(false);
    // a released slot is once again not due to fire
    expect(await findDueSlotGroups(db, new Date('2026-07-08T23:05:00.000Z'))).toEqual([]);
  });

  // ── the Monday-8:45 margin — an abandoned pre-open draft is in BATTLE by 9:30 ──
  it('a Monday-8:45 pre-open abandoned draft completes INLINE to BATTLE (before the 9:30 open)', async () => {
    const { db, store } = seededDb(['human-1']);
    const MON_ID = slotGroupId('mon-0845', '2026-07-13');
    // claim the Monday slot the morning of; anchor is that same Monday
    const c = await claimSlotSeat(db, { slotId: 'mon-0845', odUserId: 'human-1', now: new Date('2026-07-13T12:30:00.000Z') });
    expect(c.battleStartWeek.anchorEtDate).toBe('2026-07-13'); // same-Monday anchor
    expect(c.groupId).toBe(MON_ID);

    const FIRE = new Date('2026-07-13T12:45:00.000Z'); // Mon 8:45am EDT
    await fireCompetitiveSlotDraft(db, MON_ID, { now: FIRE });
    // abandoned; the very next drive pass (8:47) completes it INLINE to BATTLE
    const r = await driveSlotDraftAutopick(db, MON_ID, { now: new Date('2026-07-13T12:47:00.000Z') });
    expect(r).toMatchObject({ complete: true, status: GROUP_STATUS.BATTLE });
    expect(readGroup(store, MON_ID).status).toBe(GROUP_STATUS.BATTLE);
    // 8:47 ET << 9:30 ET open — the margin holds end-to-end
  });

  // ── the stale-anchor guard (Addition 2), exercised through the lifecycle ──
  it('a fired-LATE pod re-anchors to the NEXT Monday end-to-end (never a stale mid-week battle)', async () => {
    const { db, store } = seededDb(['human-1']);
    const WED_ID = slotGroupId('wed-1900', '2026-07-08');
    // claimed for the 2026-07-08 Wed occurrence → stamped Monday 2026-07-13
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'human-1', now: new Date('2026-07-06T12:00:00.000Z') });
    expect(readGroup(store, WED_ID).battleStartWeek.anchorEtDate).toBe('2026-07-13');

    // …but the fire cron lags a full week: firing Wed 2026-07-15, the 07-13 Monday is past.
    const FIRE_LATE = new Date('2026-07-15T23:00:00.000Z');
    await fireCompetitiveSlotDraft(db, WED_ID, { now: FIRE_LATE });
    expect(readGroup(store, WED_ID).battleStartWeek.anchorEtDate).toBe('2026-07-20'); // re-derived at fire

    const r = await driveSlotDraftAutopick(db, WED_ID, { now: new Date(FIRE_LATE.getTime() + 20 * 60 * 1000) });
    expect(r).toMatchObject({ complete: true, status: GROUP_STATUS.AWAITING_OPEN }); // future Monday → waits
    expect(readGroup(store, WED_ID).startAnchor.anchorEtDate).toBe('2026-07-20'); // not the stale 07-13

    // and the flip does NOT fire it early: on the stale Monday it stays put…
    const staleFlip = await flipAwaitingOpenPods(db, { now: new Date('2026-07-13T12:00:00.000Z') });
    expect(staleFlip.flipped).toBe(0);
    expect(readGroup(store, WED_ID).status).toBe(GROUP_STATUS.AWAITING_OPEN);
    // …only on the re-derived Monday (07-20) does it reach BATTLE.
    const realFlip = await flipAwaitingOpenPods(db, { now: new Date('2026-07-20T12:00:00.000Z') });
    expect(realFlip.flipped).toBe(1);
    expect(readGroup(store, WED_ID).status).toBe(GROUP_STATUS.BATTLE);
  });
});
