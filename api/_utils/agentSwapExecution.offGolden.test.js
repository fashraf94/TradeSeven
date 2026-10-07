// api/_utils/agentSwapExecution.offGolden.test.js
//
// Pilot P6 — THE EXECUTOR-LEVEL OFF GOLDEN (acceptance A7; Phase 0
// docs/audits/20261007_PHASE0_PILOT_P6_SWAP_IDENTITY.md §6.1, §8.2).
//
// At SWAP_IDENTITY_MODE 'off' the executor computes nothing: for every shape
// below — every write path and every refusal it had before P6 — the update
// object it hands the transaction, the value it returns, the message it throws
// and the Guard 3 fetches it makes are byte-identical to a FROZEN fixture.
//
// THE FIXTURE (api/_utils/__fixtures__/swapExecutorOffGolden.json) IS CAPTURED
// FROM THE UNTOUCHED EXECUTOR: this same file (every line but the SHA pin
// below) run with GENERATE_SWAP_OFF_GOLDEN=1 in an LF checkout of origin/main
// @ 3f784e8d — a private Linux clone, detached, before any P6 source existed.
// Its SHA-256 (over LF bytes) is pinned below.
// Regenerate it ONLY from such a tree, never to make this suite green after a
// change, then move the pin in the same commit. The generating run fails on
// purpose after writing, and refuses CI.
//
// THE FOUR WAYS IN — each must reproduce the fixture exactly:
//   1. the pre-P6 call: ten arguments, the flag's own 'off' (the fixture's way);
//   2. 'off' named explicitly WITH a belief that would mismatch every slot —
//      'off' compares nothing, so the belief changes nothing;
//   3. an unknown mode ('ENFORCE') — resolves to 'off';
//   4. the seams: the clock and the Guard 3 fetch INJECTED, with the system
//      clock left REAL — the injected instant reproduces the frozen one, so a
//      clock read that bypassed the seam would move a stamp, and the injected
//      fetch must see exactly the calls the fixture recorded (the module's own
//      fetch is never touched).
//
// `executeSwapServer` is imported under another name so the literal call
// string never appears here (the repo-level census in agent-evaluate.test.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('./marketDataCache.js', () => ({ getStockAnalysisData: fetchMock }));

import { executeSwapServer as executeSwap } from './agentSwapExecution.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '__fixtures__/swapExecutorOffGolden.json');
/** SHA-256 of the fixture's LF bytes, as captured from origin/main @ 3f784e8d. */
const GOLDEN_SHA256 = 'b7de67bcc464c821d58125fac573fb89a9c3eebe4b8dfe9de03a5c424e4c8266';
const ENV = globalThis.process?.env || {};
const GENERATE = ENV.GENERATE_SWAP_OFF_GOLDEN === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_SWAP_OFF_GOLDEN is a local, deliberate act — never on CI');

const FROZEN = '2026-10-07T15:00:00.000Z'; // Wed 7 Oct 2026, 11:00 ET — day 3 of a Monday battle
const BATTLE_ID = 'battle-golden-1';

const DAILY = Object.freeze([
  { date: '2026-10-02', rawClose: 118.4, close: 118.4, high: 119.9, low: 117.2 },
  { date: '2026-10-05', rawClose: 119.6, close: 119.6, high: 121.1, low: 118.5 },
  { date: '2026-10-06', rawClose: 120.2, close: 120.2, high: 121.4, low: 119.3 },
]);
const fetchAnswer = async () => ({ daily: DAILY.map((d) => ({ ...d })), price: { current: 121 } });

function book(overrides = {}) {
  return {
    status: 'active',
    gameMode: 'baggerbomb_agent',
    activatedAt: '2026-10-05T13:30:00.000Z',
    portfolio: {
      star: [
        { symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false, sector: 'Technology', swapPrice: 100, swappedInAt: '2026-10-06T15:00:00.000Z', swappedInDay: 2 },
        { symbol: 'TSLA', name: 'Tesla', baseATR: 4, isCrypto: false, sector: 'Consumer Cyclical' },
      ],
      core: [
        { symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.1, isCrypto: false, sector: 'Technology' },
      ],
      support: [
        { symbol: 'KO', name: 'Coca-Cola', baseATR: 1.1, isCrypto: false, sector: 'Consumer Defensive', previousSwapPrice: 61, swappedInAt: '2026-10-05T16:00:00.000Z', previousSwapDay: 1 },
        { symbol: 'BTC', name: 'Bitcoin', baseATR: 5, isCrypto: true, sector: 'Crypto', direction: 'short', swapPrice: 64000, swappedInAt: '2026-10-06T14:00:00.000Z', swappedInDay: 2 },
      ],
      bench: {
        stocks: [
          { symbol: 'AMD', name: 'AMD', baseATR: 3.4, isCrypto: false, sector: 'Technology' },
          { symbol: 'JPM', name: 'JPMorgan', baseATR: 1.6, isCrypto: false, sector: 'Financial Services' },
        ],
        crypto: { symbol: 'ETH', name: 'Ethereum', baseATR: 6, isCrypto: true, direction: 'short' },
      },
      startingPrices: { MU: 95, TSLA: 250, NVDA: 120, KO: 62, BTC: 67000, AMD: 160, JPM: 199, ETH: 3100 },
    },
    scoring: { thresholds: { NVDA: { threshold: 3.0 }, AMD: { threshold: 3.6 } } },
    thresholdHistory: {
      MU: { maxMultiplier: 1, minMultiplier: 0, badges: ['spark'] },
      NVDA: { maxMultiplier: 0, minMultiplier: -1, badges: [] },
    },
    trades: [{ symbolOut: 'PG', symbolIn: 'KO', lockedPoints: 1.5, swappedOutAt: '2026-10-05T16:00:00.000Z' }],
    scoreState: { tradeCount: 4 },
    livePriceBeacon: null,
    ...overrides,
  };
}
const withPortfolio = (patch) => {
  const b = book();
  return { ...b, portfolio: { ...b.portfolio, ...patch } };
};
const PRICES = {
  MU: { current: 110, previousClose: 108 },
  TSLA: { current: 251, previousClose: 249 },
  NVDA: { current: 121, previousClose: 160 }, // a glitched previousClose — Guard 3 substitutes the reference
  KO: { current: 63, previousClose: 62.5 },
  BTC: { current: 62000, previousClose: 63000 },
  AMD: { current: 150, previousClose: 149 },
  JPM: { current: 200, previousClose: 198 },
  ETH: { current: 3050, previousClose: 3075 },
};
const META = (id) => ({ id, action: 'SWAP', trigger: 'golden', rationale: 'golden row', hypothesis: null, evaluationId: `golden_${id}`, tradingDay: 3, exitReason: 'golden' });
const SNAPSHOT = { symbolOut: { symbol: 'X', capturedAt: FROZEN }, symbolIn: { symbol: 'Y', capturedAt: FROZEN } };
const bench = (b, symbol) => b.portfolio.bench.stocks.find((s) => s.symbol === symbol) || (b.portfolio.bench.crypto?.symbol === symbol ? b.portfolio.bench.crypto : null);

/** Every write path and every pre-P6 refusal, by name. */
const SCENARIOS = {
  star_swapped_in_position: () => { const b = book(); return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t1'), snapshot: SNAPSHOT }; },
  core_held_from_start_guard3_fetch: () => { const b = book(); return { battle: b, tier: 'core', slot: 0, incoming: bench(b, 'JPM'), day: 3, prices: PRICES, meta: META('t2'), snapshot: null }; },
  activation_day_starting_price_no_fetch: () => { const b = book({ activatedAt: '2026-10-07T13:30:00.000Z' }); return { battle: b, tier: 'core', slot: 0, incoming: bench(b, 'JPM'), day: 1, prices: PRICES, meta: META('t3'), snapshot: null }; },
  no_activated_at: () => { const b = book({ activatedAt: undefined }); return { battle: b, tier: 'star', slot: 1, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t4'), snapshot: null }; },
  crypto_short_round_trip: () => { const b = book(); return { battle: b, tier: 'support', slot: 1, incoming: bench(b, 'ETH'), day: 3, prices: PRICES, meta: META('t5'), snapshot: SNAPSHOT }; },
  bench_replace_existing_entry: () => {
    const b = withPortfolio({ bench: { stocks: [{ symbol: 'AMD', name: 'AMD', baseATR: 3.4, isCrypto: false }, { symbol: 'KO', name: 'Coca-Cola', baseATR: 1.1, isCrypto: false, cooldownUntil: '2026-10-01T00:00:00.000Z' }], crypto: null } });
    return { battle: b, tier: 'support', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t6'), snapshot: null };
  },
  fresh_beacon_preferred: () => { const b = book({ livePriceBeacon: { updatedAt: '2026-10-07T14:59:30.000Z', prices: { MU: 111.5, AMD: 149.25 } } }); return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t7'), snapshot: null }; },
  stale_beacon_ignored: () => { const b = book({ livePriceBeacon: { updatedAt: '2026-10-07T14:55:00.000Z', prices: { MU: 111.5, AMD: 149.25 } } }); return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t8'), snapshot: null }; },
  flat6_tournament_mode: () => { const b = book({ gameMode: 'baggerbomb_tournament' }); return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t9'), snapshot: null }; },
  trades_capped_at_fifty: () => {
    const trades = Array.from({ length: 50 }, (_, i) => ({ symbolOut: `S${i}`, symbolIn: `T${i}`, lockedPoints: i }));
    const b = book({ trades });
    return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t10'), snapshot: null };
  },
  no_evaluation_metadata: () => { const b = book(); return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: undefined, snapshot: undefined }; },
  refuses_self_swap: () => { const b = book(); return { battle: b, tier: 'star', slot: 0, incoming: { symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false }, day: 3, prices: PRICES, meta: META('t11'), snapshot: null }; },
  refuses_duplicate_incoming: () => { const b = book(); return { battle: b, tier: 'star', slot: 0, incoming: { symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.1, isCrypto: false }, day: 3, prices: PRICES, meta: META('t12'), snapshot: null }; },
  refuses_empty_slot: () => { const b = book(); return { battle: b, tier: 'core', slot: 3, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t13'), snapshot: null }; },
  refuses_no_incoming_price: () => { const b = book(); return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: { ...PRICES, AMD: { current: 0 } }, meta: META('t14'), snapshot: null }; },
  refuses_missing_battle: () => { const b = book(); return { battle: b, tier: 'star', slot: 0, incoming: bench(b, 'AMD'), day: 3, prices: PRICES, meta: META('t15'), snapshot: null, missing: true }; },
};

/** The transaction double: the live doc is the battle the caller passed; the update is captured, never applied. */
function makeDb(liveData, { missing = false } = {}) {
  const log = { updates: [], gets: 0 };
  const ref = { path: `agentBattles/${BATTLE_ID}` };
  const db = {
    collection: (col) => ({ doc: (id) => ({ ...ref, col, id }) }),
    runTransaction: async (fn) => fn({
      get: async () => { log.gets += 1; return { exists: !missing, data: () => (missing ? undefined : structuredClone(liveData)) }; },
      update: (_ref, updates) => { log.updates.push(structuredClone(updates)); },
    }),
  };
  return { db, log };
}

/** Run one scenario one way; return what the fixture compares. */
async function run(name, extraArgs = [], { fetchCalls = () => fetchMock.mock.calls } = {}) {
  const s = SCENARIOS[name]();
  const { db, log } = makeDb(s.battle, { missing: s.missing });
  const args = [db, BATTLE_ID, s.battle, s.tier, s.slot, s.incoming, s.day, s.prices];
  if (s.meta !== undefined || s.snapshot !== undefined || extraArgs.length) args.push(s.meta, s.snapshot);
  let returned = null;
  let thrown = null;
  try {
    returned = await executeSwap(...args, ...extraArgs);
  } catch (err) {
    thrown = String(err?.message || err);
  }
  return JSON.parse(JSON.stringify({ updates: log.updates, returned, thrown, fetchCalls: fetchCalls().map((c) => c) }));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(fetchAnswer);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const lf = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

describe('the executor at SWAP_IDENTITY_MODE off — byte-identical to the frozen pre-P6 fixture (A7)', () => {
  it('GENERATE (local only) or load the frozen fixture', async () => {
    if (!GENERATE) {
      expect(existsSync(GOLDEN_PATH), 'frozen fixture missing — it is captured once, from the pre-P6 tree').toBe(true);
      return;
    }
    const scenarios = {};
    for (const name of Object.keys(SCENARIOS)) {
      fetchMock.mockClear();
      scenarios[name] = await run(name);
    }
    writeFileSync(GOLDEN_PATH, `${JSON.stringify({
      capturedFrom: 'an LF checkout of origin/main @ 3f784e8d (a private Linux clone, detached; before any P6 source) running this file with GENERATE_SWAP_OFF_GOLDEN=1',
      frozenNow: FROZEN,
      scenarios,
    }, null, 2)}\n`);
    throw new Error(`frozen fixture written to ${GOLDEN_PATH} — this generating run fails on purpose; re-run WITHOUT GENERATE_SWAP_OFF_GOLDEN to verify`);
  });

  const golden = existsSync(GOLDEN_PATH) ? JSON.parse(lf(GOLDEN_PATH)) : null;

  it('the fixture file is exactly the one captured from the pre-P6 tree (SHA-256 of its LF bytes)', () => {
    expect(createHash('sha256').update(lf(GOLDEN_PATH)).digest('hex')).toBe(GOLDEN_SHA256);
  });

  it('the fixture is not vacuous: every scenario is present, the write paths wrote, the refusals refused, the fetch path fetched', () => {
    expect(Object.keys(golden.scenarios).sort()).toEqual(Object.keys(SCENARIOS).sort());
    for (const [name, snap] of Object.entries(golden.scenarios)) {
      if (name.startsWith('refuses_')) {
        expect(snap.thrown, name).toBeTruthy();
        expect(snap.updates, name).toEqual([]);
      } else {
        expect(snap.thrown, name).toBeNull();
        expect(snap.updates, name).toHaveLength(1);
        expect(snap.returned.closedTrade.swappedOutAt, name).toBe(FROZEN);
      }
    }
    expect(golden.scenarios.core_held_from_start_guard3_fetch.fetchCalls).toHaveLength(1);
    expect(golden.scenarios.activation_day_starting_price_no_fetch.fetchCalls).toEqual([]);
    expect(golden.scenarios.star_swapped_in_position.fetchCalls).toEqual([]);
    // The beacon rows really diverge, so the seam row below can tell a beacon read against the real clock.
    expect(golden.scenarios.fresh_beacon_preferred.returned.incomingAsset.swapPrice).toBe(149.25);
    expect(golden.scenarios.stale_beacon_ignored.returned.incomingAsset.swapPrice).toBe(150);
    // No trade row carries a verification at off.
    expect(JSON.stringify(golden)).not.toContain('verification');
  });

  for (const name of Object.keys(SCENARIOS)) {
    describe(name, () => {
      it('1 — the pre-P6 call (ten arguments, the flag\'s own value)', async () => {
        expect(JSON.stringify(await run(name))).toBe(JSON.stringify(golden.scenarios[name]));
      });

      it("2 — 'off' named explicitly, with a belief that matches nothing", async () => {
        const out = await run(name, [{ identityMode: 'off', expectedOut: { symbol: 'NOPE', swappedInAt: '1999-01-01T00:00:00.000Z' } }]);
        expect(JSON.stringify(out)).toBe(JSON.stringify(golden.scenarios[name]));
      });

      it("3 — an unknown mode ('ENFORCE') resolves to off", async () => {
        const out = await run(name, [{ identityMode: 'ENFORCE', expectedOut: { symbol: 'NOPE' } }]);
        expect(JSON.stringify(out)).toBe(JSON.stringify(golden.scenarios[name]));
      });

      it('4 — the seams injected, the system clock REAL: the same bytes, the same fetches, through the injected fetch only', async () => {
        vi.useRealTimers();
        const seamFetch = vi.fn(fetchAnswer);
        const clock = vi.fn(() => new Date(FROZEN));
        const out = await run(name, [{ now: clock, fetchDailyReference: seamFetch }], { fetchCalls: () => seamFetch.mock.calls });
        expect(JSON.stringify(out)).toBe(JSON.stringify(golden.scenarios[name]));
        expect(fetchMock).not.toHaveBeenCalled();
        // One reading before the transaction, one per attempt (missing-battle: the attempt ends before its reading).
        expect(clock).toHaveBeenCalledTimes(SCENARIOS[name]().missing ? 1 : 2);
      });
    });
  }
});
