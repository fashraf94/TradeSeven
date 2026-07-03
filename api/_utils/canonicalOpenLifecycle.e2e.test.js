// api/_utils/canonicalOpenLifecycle.e2e.test.js
//
// Phase 6 Deliverable 1 — THE LIVE INVARIANT PROOF. Walks ONE canonical_open
// round through its whole lifecycle across SIMULATED time, driving the REAL
// modules end-to-end (no fenced/scorer edit, no copied logic): the post-open
// capture sweep, the banking settlement, the UI settlement-state derivation, and
// the close-only claim guard. It asserts at runtime what the unit tests proved in
// pieces:
//
//   create → PENDING → (pre-open: no capture) → CAPTURED/estimated →
//   banked == captured (immune to a vendor open revision at banking) →
//   the terminal void contributes nothing with NO composite re-weight →
//   an in-hours claim is rejected and writes no leg.
//
// The REAL imports below are also the dependency-surface guard (BUILD_RULES §4):
// the sweep + banking + client star meter loading clean in one Node test proves
// the whole span stays node-clean and the scorer is reached, never copied.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The pinned vendor source — controllable per lifecycle phase.
const fetchBatchQuotes = vi.fn();
vi.mock('./tournamentPrices.js', () => ({ fetchBatchQuotes: (...a) => fetchBatchQuotes(...a) }));

// place-claim's server deps (only the claims step exercises these).
const h = vi.hoisted(() => ({ db: null, user: { uid: 'u1' } }));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));
vi.mock('./authMiddleware.js', () => ({
  requireAuth: async (req, res) => { if (h.user) return h.user; res.status(401).json({ error: 'auth' }); return null; },
}));

import { runCanonicalOpenSweep } from './canonicalOpenSweep.js';
import { computeBankingUpdate } from './tournamentBanking.js';
import { readUserStars } from '../../src/utils/leagueStarMeter.js';
import placeClaimHandler from '../tournament/place-claim.js';
import { calculateAssetScoreV3 } from '../../src/utils/baggerBombUtils.js';
import {
  GROUP_STATUS, BASELINE_POLICY, BASELINE_SOURCE, CAPTURE_STATE, computeComposite, round2,
} from '../../src/constants/leagueTournament.js';

// ── simulated instants (Thu 2026-07-02, America/New_York = EDT, UTC-4) ──
const PRE_OPEN = new Date('2026-07-02T12:00:00Z');   // 08:00 ET — market CLOSED (pre-open)
const POST_OPEN = new Date('2026-07-02T15:00:00Z');  // 11:00 ET — market OPEN
const BANK_ISO = '2026-07-02T20:30:00.000Z';         // 16:30 ET — after the close
const ET_DATE = '2026-07-02';

// ── stateful Firestore stand-in (dot-path aware) for the sweep ──
function applyUpdate(doc, data) {
  for (const [k, v] of Object.entries(data)) {
    if (k.includes('.')) {
      const parts = k.split('.'); let o = doc;
      for (let i = 0; i < parts.length - 1; i++) { o[parts[i] ?? ''] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = v;
    } else { doc[k] = v; }
  }
}
function makeDb(groups = {}) {
  const store = JSON.parse(JSON.stringify(groups));
  const refFor = (id) => ({
    __id: id,
    get: async () => ({ exists: store[id] != null, id, data: () => store[id] }),
    set: async (d) => { store[id] = d; },
  });
  const db = {
    collection: () => ({
      doc: (id) => refFor(id),
      where: (field, _op, val) => ({
        get: async () => ({ forEach: (cb) => Object.entries(store).filter(([, d]) => d && d[field] === val).forEach(([id, d]) => cb({ id, data: () => d })) }),
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (ref, data) => { if (store[ref.__id] == null) throw new Error(`no doc ${ref.__id}`); applyUpdate(store[ref.__id], data); },
      set: (ref, d) => { store[ref.__id] = d; },
    }),
  };
  return { db, store };
}

const leg = () => ({
  direction: 'long', baselinePrice: null, baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION,
  openedAt: '2026-07-02T13:00:00.000Z', thresholdHistory: [],
  baselineCapturedAt: null, baselinePriceTimestamp: null, captureJobId: null,
  baselineSession: null, instrumentId: null, captureState: null,
});
const pick = (symbol) => ({ symbol, legs: [leg()], flipCountToday: 0 });
// A freshly-created canonical round: u1 holds LLY (will capture) + NOCAP (never
// gets an eligible open → voids). u2..u4 empty (GROUP_SIZE = 4).
const canonicalRound = () => ({
  status: GROUP_STATUS.BATTLE, roundNumber: 1, baseLayerWeek: '2026-W27',
  baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN,
  groupMembers: ['u1', 'u2', 'u3', 'u4'],
  players: [
    { odUserId: 'u1', picks: [pick('LLY'), pick('NOCAP')] },
    { odUserId: 'u2', picks: [] }, { odUserId: 'u3', picks: [] }, { odUserId: 'u4', picks: [] },
  ],
  userPool: [], canonicalOpens: {}, dailyScores: {}, createdAt: '2026-07-02T13:00:00.000Z', updatedAt: '2026-07-02T13:00:00.000Z',
});
const stubOpens = (m) => fetchBatchQuotes.mockResolvedValue(
  Object.fromEntries(Object.entries(m).map(([s, open]) => [s, { open, close: open, current: open, previousClose: open, timestamp: 1719927000 }])),
);
const settleStates = (player) => Object.fromEntries(
  readUserStars(player, { LLY: { current: 106 }, NOCAP: { current: 55 } }, { canonicalPolicy: true, dayBanked: false })
    .map((r) => [r.tk, r.settleState]),
);

describe('canonical-open lifecycle — the live invariant proof (Phases 1-5 compose)', () => {
  beforeEach(() => fetchBatchQuotes.mockReset());

  it('walks create → pending → capture(estimated) → banked==captured, with the void carrying no re-weight', async () => {
    const { db, store } = makeDb({ g1: canonicalRound() });

    // 1) CREATE — user legs null-baseline, and the UI reads `pending`.
    expect(store.g1.players[0].picks[0].legs[0].baselinePrice).toBeNull();
    expect(settleStates(store.g1.players[0])).toEqual({ LLY: 'pending', NOCAP: 'pending' });

    // 2) PRE-OPEN — the sweep is a clean no-op (session gated); legs untouched.
    const preRun = await runCanonicalOpenSweep(db, { now: PRE_OPEN });
    expect(preRun).toMatchObject({ skipped: true, reason: 'market_closed' });
    expect(fetchBatchQuotes).not.toHaveBeenCalled();
    expect(store.g1.players[0].picks[0].legs[0].baselinePrice).toBeNull();
    expect(settleStates(store.g1.players[0])).toEqual({ LLY: 'pending', NOCAP: 'pending' });

    // 3) POST-OPEN SWEEP — LLY captures from the canonical open (frozen at 100);
    //    NOCAP has no eligible open → stays PENDING_OPEN (audited).
    stubOpens({ LLY: 100, NOCAP: null });
    const run = await runCanonicalOpenSweep(db, { now: POST_OPEN });
    expect(run).toMatchObject({ groups: 1, captured: 1, pending: 1, snapshots: 1 });
    const lly = store.g1.players[0].picks[0].legs[0];
    expect(lly.baselinePrice).toBe(100);
    expect(lly.baselineSource).toBe(BASELINE_SOURCE.CANONICAL_OPEN_CAPTURE);
    expect(lly.captureState).toBe(CAPTURE_STATE.CAPTURED);
    expect(store.g1.canonicalOpens.LLY.open).toBe(100); // the frozen snapshot
    const nocap = store.g1.players[0].picks[1].legs[0];
    expect(nocap.captureState).toBe(CAPTURE_STATE.PENDING_OPEN);
    // UI: the captured leg is now an ESTIMATE; the un-captured one stays pending.
    expect(settleStates(store.g1.players[0])).toEqual({ LLY: 'estimated', NOCAP: 'pending' });

    // The pre-bank ESTIMATE for LLY (baseline 100 → 106 = +6%, ATR 2.5).
    const estimated = readUserStars(store.g1.players[0], { LLY: { current: 106 } }, { canonicalPolicy: true })
      .find((r) => r.tk === 'LLY');
    const expectedPts = calculateAssetScoreV3({ symbol: 'LLY', baseATR: 2.5, direction: 'long' }, 6, {}, {}, null).totalPoints;
    expect(estimated.points).toBe(expectedPts);

    // 4) BANK — the vendor REVISES LLY's open to 101 at banking time. The leg
    //    still banks against the STORED snapshot (100), so banked == captured ==
    //    the estimate; the 101 is never consulted.
    const bankingQuotes = {
      LLY: { open: 101, current: 106, previousClose: 99, timestamp: 1 },   // vendor drift — must be ignored
      NOCAP: { open: 50, current: 55, previousClose: 50, timestamp: 1 },   // present but NOCAP has no snapshot
    };
    const update = computeBankingUpdate(store.g1, bankingQuotes, {
      nowIso: BANK_ISO, etDate: ET_DATE, atrPercentiles: null, recordedBy: 'e2e', agentScores: { u1: 50 },
    });

    const bankedLly = update.players[0].picks[0].legs[0];
    expect(bankedLly.baselinePrice).toBe(100); // banked baseline == captured snapshot, NOT the revised 101
    const u1 = update.dayEntry.closeScores.u1;
    expect(u1.totalPoints).toBe(expectedPts);          // banked == captured == estimate
    const wrongIf101 = calculateAssetScoreV3({ symbol: 'LLY', baseATR: 2.5, direction: 'long' }, ((106 - 101) / 101) * 100, {}, {}, null).totalPoints;
    expect(u1.totalPoints).not.toBe(wrongIf101);       // the revision changed nothing

    // 5) VOID — NOCAP never got an eligible open → terminal NO_ELIGIBLE_OPEN,
    //    baseline stays null, contributes 0. The composite is agent + 1.5 × the
    //    sum of SETTLED legs only — NO re-weight for the missing slot.
    const bankedNocap = update.players[0].picks[1].legs[0];
    expect(bankedNocap.captureState).toBe(CAPTURE_STATE.NO_ELIGIBLE_OPEN);
    expect(bankedNocap.baselinePrice).toBeNull();
    expect(u1.totalPoints).toBe(expectedPts);          // void added nothing to the sum
    expect(u1.compositePoints).toBe(round2(computeComposite(50, expectedPts))); // 50 + 1.5×sum-of-settled
    expect(u1.compositePoints).toBe(round2(50 + 1.5 * expectedPts));            // not re-normalized by settled count
  });
});

// ── 6) CLAIMS BLOCKED IN-HOURS — the real place-claim handler under sim time ──
// The ET claim window (4pm→9:24am) and market hours are disjoint, so the guard's
// meaningful entry is the admin window-bypass at a market-open instant: the
// exposure contract holds even when the window is waived. A closed-market claim
// proceeds normally. (place-claim.test.js harness shape, canonical group.)
function pickState(symbol) {
  return { symbol, legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }], flipCountToday: 0 };
}
function claimGroup(over = {}) {
  return {
    status: 'battle', baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN, groupMembers: ['u1', 'u2', 'u3', 'u4'],
    players: [
      { odUserId: 'u1', picks: [pickState('NVDA'), pickState('AMD'), pickState('TSLA')] },
      { odUserId: 'u2', picks: [] }, { odUserId: 'u3', picks: [] }, { odUserId: 'u4', picks: [] },
    ],
    userPool: ['COIN', 'PLTR', 'SHOP'], dailyScores: {},
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] }, ...over,
  };
}
function claimDb({ groupDoc }) {
  const captured = { added: [] };
  const claimsQ = { where: () => claimsQ, get: async () => ({ size: 0, forEach: () => {} }), doc: () => ({ id: 'claim-1' }) };
  const groupRef = { get: async () => ({ exists: groupDoc != null, data: () => groupDoc }), collection: () => claimsQ };
  const db = {
    collection: () => ({ doc: () => groupRef }),
    runTransaction: async (fn) => fn({ get: async (q) => q.get(), set: (_r, doc) => { captured.added.push(doc); } }),
  };
  return { db, captured };
}
function reqRes(body = {}, headers = {}) {
  const req = { method: 'POST', headers, body: { groupId: 'group-1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 1, ...body } };
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.body = p; return res; };
  return { req, res };
}
const SECRET = 'e2e-admin-secret';

describe('canonical-open lifecycle — claims are close-only (step 6)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubEnv('ADMIN_SECRET', SECRET); h.user = { uid: 'u1' }; });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('rejects an in-hours claim in a canonical round (no leg written); a closed-market claim proceeds', async () => {
    // IN-HOURS (admin bypasses the window; the exposure guard still fires).
    vi.setSystemTime(POST_OPEN); // 11:00 ET — market OPEN
    const inHours = claimDb({ groupDoc: claimGroup() });
    h.db = inHours.db;
    const a = reqRes({ devBypassWindow: true }, { 'x-admin-secret': SECRET });
    await placeClaimHandler(a.req, a.res);
    expect(a.res.statusCode).toBe(403);
    expect(a.res.body.error).toBe('claims_closed_during_market_hours');
    expect(inHours.captured.added).toHaveLength(0); // authoritative — no leg/claim created

    // CLOSED MARKET (17:00 ET — window open, market closed) → proceeds to a write.
    vi.setSystemTime(new Date('2026-07-02T21:00:00Z'));
    const closed = claimDb({ groupDoc: claimGroup() });
    h.db = closed.db;
    const b = reqRes();
    await placeClaimHandler(b.req, b.res);
    expect(b.res.statusCode).toBe(200);
    expect(closed.captured.added).toHaveLength(1);
  });
});
