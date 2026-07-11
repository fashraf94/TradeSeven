/**
 * Correlation Intelligence Phase 2 — the NARRATION TEST CORPUS (Change 6).
 *
 * The single source of the 8 deep-dive contract CLASSES, built through the REAL
 * buildDeepDiveContract so every fixture is a schema-valid contract (never a
 * hand-authored shape that could drift from the builder). Imported by both the
 * plan-builder and conformance suites so the golden classes are defined once.
 *
 * NOT a *.test file — it exports helpers/fixtures and must not run as a suite.
 */
import { buildDeepDiveContract } from './summaryContract.js';

export const DRIVER_LABEL = '10Y Yield';

// A realistic solid/standard deep-dive input (mirrors summaryContract.test.js's
// deepInput); overrides steer it into each class.
export function deepInput(overrides = {}) {
  return {
    generatedAt: '2026-07-10T20:10:00.000Z',
    dataAsOf: '2026-07-10',
    observationTradingDay: '2026-07-10',
    lookbackDays: 504,
    group: ['XLE', 'CVX', 'XOM'],
    groupType: 'manual',
    driverId: 'TNX',
    driverType: 'registry',
    driverSymbol: 'TNX.INDX',
    corr20: 0.62,
    corr60: 0.55,
    partial: {
      w20: { raw: 0.62, adjusted: 0.41, n: 20, suppressed: null },
      w60: { raw: 0.55, adjusted: 0.38, n: 60, suppressed: null },
    },
    selfPercentile: { corr20: { percentile: 73.4, n: 480, latest: 0.62 }, corr60: { percentile: 61.2, n: 440, latest: 0.55 } },
    stability: { aboveFraction: 0.82, signPersistence: 0.9, n: 460, sign: 'positive', threshold: 0.15 },
    cohesion: { c20: { value: 0.66, pairsUsed: 3, pairsTotal: 3 }, c60: { value: 0.6, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 },
    contribution: {
      full: { corr: 0.62, beta: 1.1 },
      members: [
        { index: 0, corrDelta: 0.05, betaDelta: 0.1 },
        { index: 1, corrDelta: 0.03, betaDelta: 0.05 },
        { index: 2, corrDelta: 0.02, betaDelta: 0.03 },
      ],
      window: 60,
      n: 60,
      memberSymbols: ['CVX', 'XOM', 'XLE'],
      breadthStatus: 'broad_based',
    },
    captureAsymmetry: {
      minObs: 60,
      down: { beta: 1.3, alpha: 0, r: 0.6, n: 120 },
      up: { beta: 0.9, alpha: 0, r: 0.5, n: 130 },
      comparison: { asymmetric: true, direction: 'down', betaDown: 1.3, betaUp: 0.9, nDown: 120, nUp: 130 },
      counts: { down: 120, up: 130 },
    },
    tail: {
      worst: { n: 24, tailPct: 10, coMoveCount: 18, groupMedian: -0.0123 },
      best: { n: 24, tailPct: 10, coMoveCount: 16, groupMedian: 0.0111 },
      sampleN: 240,
    },
    driverContext: { trailingReturn: -0.0234, vol: { percentile: 55.5, n: 480, latest: 0.01 } },
    tensionLatest: { d: 0.07, score: 0.8, state: 'calm' },
    memberCount: 3,
    joinedCloses: 480,
    inflections: [{ startDate: '2026-05-02', startCloseIndex: 300 }, { startDate: '2026-06-15', startCloseIndex: 360 }],
    ...overrides,
  };
}

export const deepContract = (overrides) => buildDeepDiveContract(deepInput(overrides));

// Shared override fragments.
const DRIVER_IS_MARKET = {
  partial: {
    w20: { raw: 0.62, adjusted: null, n: 20, suppressed: 'driver_is_market' },
    w60: { raw: 0.55, adjusted: null, n: 60, suppressed: 'driver_is_market' },
  },
};
const COHESION_FAILS = { cohesion: { c20: { value: 0.3, pairsUsed: 3, pairsTotal: 3 }, c60: { value: 0.3, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 } };
const SYMMETRIC_CAPTURE = {
  captureAsymmetry: {
    minObs: 60, down: { beta: 1.05, alpha: 0, r: 0.6, n: 120 }, up: { beta: 1.0, alpha: 0, r: 0.5, n: 130 },
    comparison: { asymmetric: false, direction: null, betaDown: 1.05, betaUp: 1.0, nDown: 120, nUp: 130 }, counts: { down: 120, up: 130 },
  },
};
const NO_TAIL = { tail: { worst: null, best: null, sampleN: 0 } };
// broad_based fails (single member carries the link) without touching cohesion —
// makes the read fragile so driver_context can be the selected supporting claim.
const SINGLE_DRIVER = {
  contribution: {
    full: { corr: 0.62, beta: 1.1 },
    members: [{ index: 0, corrDelta: 0.2, betaDelta: 0.1 }, { index: 1, corrDelta: 0.02, betaDelta: 0.05 }, { index: 2, corrDelta: 0.01, betaDelta: 0.03 }],
    window: 60, n: 60, memberSymbols: ['CVX', 'XOM', 'XLE'], breadthStatus: 'single_driver',
  },
};

// ── The 8 classes (+ a thin-solid case for the D1 rule) ──────────────────────
export const CLASSES = {
  // 1. solid / standard — headline + 2 supporting (capture, tail).
  solidStandard: () => deepContract(),
  // 2. fragile / standard — group_coheres fails.
  fragileStandard: () => deepContract({ ...COHESION_FAILS }),
  // 3. limited / standard (small-n) — adequate_sample fails (joinedCloses < 300).
  limitedStandard: () => deepContract({ joinedCloses: 250 }),
  // 4. in_flux / standard — tension broke.
  inFluxStandard: () => deepContract({ tensionLatest: { d: 0.3, score: 2.5, state: 'break' } }),
  // 5. solid / market_proxy — driver is the market itself.
  solidMarketProxy: () => deepContract({ ...DRIVER_IS_MARKET }),
  // 6. fragile / market_proxy (suppression-heavy) — proxy + a failing criterion.
  fragileMarketProxy: () => deepContract({ ...DRIVER_IS_MARKET, ...COHESION_FAILS }),
  // 7. in_flux + market_proxy — exercises the position-2 proxy disclosure.
  inFluxMarketProxy: () => deepContract({ ...DRIVER_IS_MARKET, tensionLatest: { d: 0.3, score: 2.5, state: 'break' } }),
  // 8. solid / standard with MANY notable supports — exercises the ≤2 cap
  //    (percentile_extreme + capture win by priority; tail + driver_context drop).
  solidStandardTwoStrong: () => deepContract({
    selfPercentile: { corr20: { percentile: 73.4, n: 480, latest: 0.62 }, corr60: { percentile: 95, n: 440, latest: 0.55 } },
    driverContext: { trailingReturn: -0.0234, vol: { percentile: 90, n: 480, latest: 0.01 } },
  }),
  // (D1) thin solid / standard — no notable support → routes to template.
  thinSolidStandard: () => deepContract({ ...SYMMETRIC_CAPTURE, ...NO_TAIL }),
  // TNX driver_context (diff-mode) — a fragile read (broad_based fails) whose ONLY
  // supporting claim is driver_context, so the trailing-move span renders from the
  // envelope's own unit (return_fraction → fmtPct) over the past 20 sessions.
  tnxDriverContext: () => deepContract({
    ...SINGLE_DRIVER, ...SYMMETRIC_CAPTURE, ...NO_TAIL,
    driverContext: { trailingReturn: 0.12, vol: { percentile: 55, n: 480, latest: 0.01 } },
  }),
};
