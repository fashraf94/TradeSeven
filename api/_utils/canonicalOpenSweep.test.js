// api/_utils/canonicalOpenSweep.test.js
//
// Phase 2 — the canonical-open capture sweep. Uses a STATEFUL Firestore stand-in
// (tx.update actually mutates the store, incl. dot-path canonicalOpens.SYM) so
// idempotency and snapshot-immutability are exercised for real. The vendor
// (fetchBatchQuotes) is the only mock; fetchCanonicalOpens / writeCanonicalOpenSnapshot
// / settleLegsFromSweep / runCanonicalOpenSweep are all REAL. The real imports
// are also the dependency-surface guard (BUILD_RULES §4).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchBatchQuotes = vi.fn();
vi.mock('./tournamentPrices.js', () => ({
  fetchBatchQuotes: (...a) => fetchBatchQuotes(...a),
}));

import { runCanonicalOpenSweep, settleLegsFromSweep } from './canonicalOpenSweep.js';
import {
  GROUP_STATUS, BASELINE_POLICY, BASELINE_SOURCE, CAPTURE_STATE,
} from '../../src/constants/leagueTournament.js';

const NOW_ISO = '2026-07-02T14:00:00.000Z';
const OPEN_NOW = new Date('2026-07-02T15:00:00Z');   // Thu, 11:00 ET (EDT) — session OPEN
const CLOSED_NOW = new Date('2026-07-02T02:00:00Z'); // 22:00 ET prior day — session CLOSED

// ── stateful Firestore stand-in (single collection: tournamentGroups) ──
function applyUpdate(doc, data) {
  for (const [k, v] of Object.entries(data)) {
    if (k.includes('.')) {
      const parts = k.split('.');
      let o = doc;
      for (let i = 0; i < parts.length - 1; i++) { o[parts[i] ?? ''] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = v;
    } else {
      doc[k] = v;
    }
  }
}
function makeDb(groups = {}) {
  const store = JSON.parse(JSON.stringify(groups)); // { id: groupDoc }
  const refFor = (id) => ({
    __id: id,
    get: async () => ({ exists: store[id] != null, id, data: () => store[id] }),
    set: async (d) => { store[id] = d; },
  });
  const db = {
    collection: () => ({
      doc: (id) => refFor(id),
      where: (field, _op, val) => ({
        get: async () => ({
          forEach: (cb) => Object.entries(store)
            .filter(([, d]) => d && d[field] === val)
            .forEach(([id, d]) => cb({ id, data: () => d })),
        }),
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

function leg(over = {}) {
  return {
    direction: 'long', baselinePrice: null, baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION,
    openedAt: NOW_ISO, thresholdHistory: [],
    baselineCapturedAt: null, baselinePriceTimestamp: null, captureJobId: null,
    baselineSession: null, instrumentId: null, captureState: null, ...over,
  };
}
const pick = (symbol, legs) => ({ symbol, legs, flipCountToday: 0 });
function group(over = {}) {
  return {
    status: GROUP_STATUS.BATTLE, roundNumber: 1, baseLayerWeek: '2026-W27',
    baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN,
    groupMembers: ['u1', 'u2', 'u3', 'u4'],
    players: [
      { odUserId: 'u1', picks: [pick('LLY', [leg()])] },
      { odUserId: 'u2', picks: [] },
      { odUserId: 'u3', picks: [] },
      { odUserId: 'u4', picks: [] },
    ],
    userPool: [], canonicalOpens: {}, dailyScores: {}, createdAt: NOW_ISO, updatedAt: NOW_ISO,
    ...over,
  };
}
const stubOpens = (m) => fetchBatchQuotes.mockResolvedValue(
  Object.fromEntries(Object.entries(m).map(([s, open]) => [s, { open, close: open, current: open, previousClose: open, timestamp: 1719927000 }])),
);

beforeEach(() => { fetchBatchQuotes.mockReset(); });

describe('runCanonicalOpenSweep — session gate + selection', () => {
  it('session CLOSED → clean no-op, no vendor call', async () => {
    const { db } = makeDb({ g1: group() });
    const r = await runCanonicalOpenSweep(db, { now: CLOSED_NOW });
    expect(r).toMatchObject({ skipped: true, reason: 'market_closed' });
    expect(fetchBatchQuotes).not.toHaveBeenCalled();
  });

  it('anti-cohort-mixing: a LEGACY (absent-stamp) round is UNTOUCHED and never fetched', async () => {
    const legacy = group({ baselinePolicy: undefined });
    delete legacy.baselinePolicy;
    const { db, store } = makeDb({ g1: legacy });
    const before = JSON.parse(JSON.stringify(store.g1.players));
    const r = await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    expect(r).toMatchObject({ skipped: false, reason: 'no_canonical_rounds', groups: 0 });
    expect(store.g1.players).toEqual(before); // byte-identical
    expect(fetchBatchQuotes).not.toHaveBeenCalled();
  });
});

describe('runCanonicalOpenSweep — capture / pending / fairness / idempotency', () => {
  it('CAPTURES a null-baseline leg from the canonical open + writes the immutable snapshot', async () => {
    stubOpens({ LLY: 812.5 });
    const { db, store } = makeDb({ g1: group() });
    const r = await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    expect(r).toMatchObject({ groups: 1, captured: 1, pending: 0, snapshots: 1 });
    const settled = store.g1.players[0].picks[0].legs[0];
    expect(settled.baselinePrice).toBe(812.5);
    expect(settled.baselineSource).toBe(BASELINE_SOURCE.CANONICAL_OPEN_CAPTURE);
    expect(settled.captureState).toBe(CAPTURE_STATE.CAPTURED);
    expect(settled.baselineSession).toBe('2026-07-02');
    expect(settled.baselineCapturedAt).toBe(OPEN_NOW.toISOString());
    expect(store.g1.canonicalOpens.LLY.open).toBe(812.5); // snapshot persisted
  });

  it('FAIRNESS: two players holding the same symbol settle from the SAME open', async () => {
    stubOpens({ NVDA: 130 });
    const g = group();
    g.players[0].picks = [pick('NVDA', [leg()])];
    g.players[1].picks = [pick('NVDA', [leg()])];
    const { db, store } = makeDb({ g1: g });
    await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    expect(store.g1.players[0].picks[0].legs[0].baselinePrice).toBe(130);
    expect(store.g1.players[1].picks[0].legs[0].baselinePrice).toBe(130);
    expect(Object.keys(store.g1.canonicalOpens)).toEqual(['NVDA']); // one shared snapshot
  });

  it('FAIL-CLOSED: a null open → leg stays null, captureState PENDING_OPEN, audit entry written', async () => {
    stubOpens({ LLY: null });
    const { db, store } = makeDb({ g1: group() });
    const r = await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    expect(r).toMatchObject({ captured: 0, pending: 1 });
    const l = store.g1.players[0].picks[0].legs[0];
    expect(l.baselinePrice).toBeNull();
    expect(l.captureState).toBe(CAPTURE_STATE.PENDING_OPEN);
    // never fail-invisible: a matching audit entry exists
    const log = store.g1.canonicalCaptureLog || [];
    expect(log.some((e) => e.symbol === 'LLY' && e.reason === 'no_eligible_open')).toBe(true);
  });

  it('an IN-HOURS FLIP leg (non-null baseline) is left untouched', async () => {
    stubOpens({ LLY: 999 });
    const g = group();
    g.players[0].picks[0].legs[0] = leg({ baselinePrice: 500, baselineSource: BASELINE_SOURCE.FLIP_MARKET_OPEN });
    const { db, store } = makeDb({ g1: g });
    await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    expect(store.g1.players[0].picks[0].legs[0].baselinePrice).toBe(500); // unchanged
    expect(store.g1.players[0].picks[0].legs[0].captureState).toBeNull();
    expect(fetchBatchQuotes).not.toHaveBeenCalled(); // no null legs → nothing to fetch
  });

  it('IDEMPOTENT: a second sweep captures nothing new and does not overwrite the snapshot', async () => {
    stubOpens({ LLY: 812.5 });
    const { db, store } = makeDb({ g1: group() });
    await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    fetchBatchQuotes.mockClear();
    const r2 = await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    expect(r2).toMatchObject({ captured: 0, pending: 0, snapshots: 0 });
    expect(fetchBatchQuotes).not.toHaveBeenCalled(); // no null legs remain → no fetch
    expect(store.g1.players[0].picks[0].legs[0].baselinePrice).toBe(812.5);
  });

  it('SNAPSHOT IMMUTABILITY: an existing snapshot is never overwritten; legs settle from it', async () => {
    // Pre-existing snapshot from an earlier arm; the vendor now reports a
    // DIFFERENT open — the sweep must ignore it and settle from the frozen one.
    const g = group();
    g.canonicalOpens = { LLY: { open: 800, capturedAt: '2026-07-02T13:40:00.000Z', priceTimestamp: 1, captureJobId: 'earlier', session: '2026-07-02', instrumentId: null } };
    stubOpens({ LLY: 900 }); // vendor drifted — must be ignored (symbol already has a snapshot → not fetched)
    const { db, store } = makeDb({ g1: g });
    await runCanonicalOpenSweep(db, { now: OPEN_NOW });
    expect(store.g1.canonicalOpens.LLY.open).toBe(800); // immutable
    expect(store.g1.players[0].picks[0].legs[0].baselinePrice).toBe(800); // settled from the frozen snapshot
    expect(fetchBatchQuotes).not.toHaveBeenCalled(); // symbol already had a snapshot
  });
});

describe('settleLegsFromSweep — a re-marked PENDING leg does not double-audit', () => {
  it('already-PENDING leg stays pending with no new audit on the next arm', async () => {
    const g = group();
    g.players[0].picks[0].legs[0] = leg({ captureState: CAPTURE_STATE.PENDING_OPEN });
    g.canonicalCaptureLog = [{ ts: 'earlier', session: '2026-07-02', symbol: 'LLY', reason: 'no_eligible_open', nextRetry: 'next_sweep_arm', captureJobId: 'earlier' }];
    const { db, store } = makeDb({ g1: g });
    const res = await settleLegsFromSweep(db, 'g1', { LLY: null }, { capturedAt: NOW_ISO, captureJobId: 'j2', session: '2026-07-02' });
    expect(res.changed).toBe(false);
    expect(store.g1.canonicalCaptureLog.length).toBe(1); // no new entry
  });
});
