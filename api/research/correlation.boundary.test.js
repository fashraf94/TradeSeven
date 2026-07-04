/**
 * Correlation Intelligence — END-TO-END BOUNDARY TEST (Build Spec V1.2, the
 * pinned deliverable). One synthetic fixture runs the REAL handler + the REAL
 * fetchDriverSeries (global fetch stubbed at the wire) and catches the four
 * bug classes pure-math unit tests structurally cannot see:
 *   (1) reversal-at-the-boundary happening zero or twice (flips the lead sign),
 *   (2) lead-lag sign convention errors,
 *   (3) calendar-alignment bugs (the driver-only date must be inner-joined away),
 *   (4) closeIndex/eventDate anchoring errors (episode + forward returns).
 *
 * Fixture design (deterministic — Lehmer LCG, no Math.random):
 *   • P20: a ±1 pattern with zero sum and zero cyclic autocorrelation at lag 2
 *     (guard-asserted below), so the engineered +2-day lead is unambiguous.
 *   • driver returns rd[t] = 0.01·P20[t mod 20]; group returns
 *     rg[t] = s(t)·(0.5·rd[t] + 0.8·rd[t−2]) + 0.0008·q7[t mod 7], with
 *     s = −1 on t ∈ [320, 325] — a 6-day engineered correlation breakdown
 *     (the ONLY event; pre-event max |d| sits far below the 0.25 floor).
 *   • two members rA/rB = rg ± w so the equal-weight composite is exactly rg —
 *     the composite path is exercised while staying hand-computable.
 *   • 361 weekday dates; the equities skip W[200]; the driver additionally
 *     carries W[200] with a POISON close (10× its neighbor) — silent under a
 *     correct inner join, loudly detonating every downstream number otherwise.
 *   • wire rows are served NEWEST-FIRST (order=d idiom) and frozen, so an
 *     in-place reversal throws.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
// Pure helpers imported directly to cross-check divergence.latest.score against
// the SAME scorer the endpoint uses (single-source SDS; BUILD_RULES §4) and to
// assert the into-break floor the endpoint applies per episode. Build 4 adds
// pearson — the independent side-correlation reference for the conditional
// block's end-to-end cross-check.
import { standardizedDivergenceScore, trailingReturnInto, pearson } from '../_utils/correlationMath.js';
// Build 3.1 — the deep-dive gauge inherits the shared tension mapping: assert
// the endpoint stamps divergence.latest.state via this exact helper.
import { tensionStateFrom } from './correlationAssembly.js';

// ==================== HOISTED MOCK STATE ====================
const { authReturnValue, labFlag } = vi.hoisted(() => ({
  authReturnValue: { current: { uid: 'test-user' } },
  labFlag: { on: true }, // default ON so the flag guard doesn't 404 the behavior tests
}));

let activeFirestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => activeFirestore,
}));

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));

vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (authReturnValue.current === null) {
      res.status(401).json({ error: 'auth required' });
      return null;
    }
    return authReturnValue.current;
  },
}));

// Live getter so a test can flip CORRELATION_LAB_ENABLED; real flags preserved.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CORRELATION_LAB_ENABLED() { return labFlag.on; },
}));

// BUILD_RULES §4 dependency-surface guard: correlation.js imports
// src/config/featureFlags.js (an api→src import). This real handler import —
// and the featureFlags vi.mock's importOriginal() above — load that module for
// real in the Node/vitest env, so a browser-only dep entering the graph
// explodes here. NEVER replace this with a mocked handler; the boundary test
// also only means something if the actual handler, fetchDriverSeries,
// correlationMath, and serverCache run for real. Build 4: buildConditionMasks
// is a named export of the same handler file (single-driver-endpoint logic),
// unit-tested here where the mocks already exist.
const { default: handler, buildConditionMasks } = await import('./correlation.js');

// ==================== Deterministic fixture ====================

function lehmer(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// ±1, zero-sum, zero cyclic autocorrelation at lag 2 (guard-asserted in a test).
const P20 = [-1, -1, -1, -1, -1, 1, 1, 1, -1, 1, 1, 1, -1, -1, 1, -1, 1, 1, -1, 1];
const Q7 = [1, -2, 3, -1, 2, -3, 0];

const N_RETURNS = 359; // 360 joined closes
const EVENT_START = 320; // return-index range of the engineered breakdown
const EVENT_END = 325;

const rd = (t) => 0.01 * P20[t % 20];
const rdLag2 = (t) => 0.01 * P20[(((t - 2) % 20) + 20) % 20];
const sFlip = (t) => (t >= EVENT_START && t <= EVENT_END ? -1 : 1);

const gen = lehmer(20260702);
const wNoise = Array.from({ length: N_RETURNS }, () => (gen() - 0.5) * 0.002);

const driverReturns = Array.from({ length: N_RETURNS }, (_, t) => rd(t));
const groupReturns = Array.from(
  { length: N_RETURNS },
  (_, t) => sFlip(t) * (0.5 * rd(t) + 0.8 * rdLag2(t)) + 0.0008 * Q7[t % 7]
);
const memberAReturns = groupReturns.map((v, t) => v + wNoise[t]);
const memberBReturns = groupReturns.map((v, t) => v - wNoise[t]);

function compound(start, returns) {
  const closes = [start];
  for (const r of returns) closes.push(closes[closes.length - 1] * (1 + r));
  return closes;
}
const driverCloses = compound(50, driverReturns); // 360
const memberACloses = compound(30, memberAReturns);
const memberBCloses = compound(70, memberBReturns);

// 361 consecutive weekday date strings starting Mon 2024-01-01.
function makeWeekdays(n, startUtcMs = Date.UTC(2024, 0, 1)) {
  const out = [];
  let ms = startUtcMs;
  while (out.length < n) {
    const day = new Date(ms).getUTCDay();
    if (day !== 0 && day !== 6) out.push(new Date(ms).toISOString().slice(0, 10));
    ms += 86400000;
  }
  return out;
}
const W = makeWeekdays(361);
const DROPPED_DATE = W[200]; // the commodity-only session the join must drop
const eqDates = [...W.slice(0, 200), ...W.slice(201)]; // 360 equity dates

/** NEWEST-FIRST frozen wire rows from OLDEST-FIRST closes/dates. */
function toWire(closes, dates, extraRow = null) {
  const asc = closes.map((close, i) => ({ date: dates[i], adjusted_close: close }));
  if (extraRow) {
    const at = asc.findIndex((r) => r.date > extraRow.date);
    asc.splice(at === -1 ? asc.length : at, 0, extraRow);
  }
  const wire = asc.reverse();
  wire.forEach((r) => Object.freeze(r));
  return Object.freeze(wire);
}

const DRIVER_WIRE = toWire(driverCloses, eqDates, {
  date: DROPPED_DATE,
  adjusted_close: driverCloses[200] * 10, // poison: only a broken join lets it in
});
const MEMBER_A_WIRE = toWire(memberACloses, eqDates);
const MEMBER_B_WIRE = toWire(memberBCloses, eqDates);

// ==================== fetch stub + request plumbing ====================

const fetchCalls = { count: 0, symbols: [] };

function wireFor(symbol) {
  if (symbol === 'BNO.US') return DRIVER_WIRE; // BRENT's registry symbol (Fix 1: BNO ETF proxy)
  if (symbol === 'XLE.US') return DRIVER_WIRE; // V2: a sector-driver registry symbol
  if (symbol === 'TNX.INDX') return DRIVER_WIRE; // Build 4: the diff-mode direction-label fixture
  if (symbol === 'AAA.US') return MEMBER_A_WIRE;
  if (symbol === 'BBB.US') return MEMBER_B_WIRE;
  // EODHD wire forms for the symbol-normalization test: app-form BRK.B must
  // arrive here as BRK-B.US (dot→hyphen), user-entered SPY.US as SPY.US (one
  // suffix). The un-normalized forms (BRK.B.US / SPY.US.US) have no wire.
  // V2 pair mode reuses these as the CUSTOM DRIVER wire (brk.b→BRK-B.US,
  // spy.us→SPY.US), which is why they double as both member and driver fixtures.
  if (symbol === 'BRK-B.US') return MEMBER_A_WIRE;
  if (symbol === 'SPY.US') return MEMBER_B_WIRE;
  return null;
}

vi.stubGlobal('fetch', async (url) => {
  const match = String(url).match(/\/eod\/([^?]+)\?/);
  const symbol = match ? decodeURIComponent(match[1]) : '';
  fetchCalls.count += 1;
  fetchCalls.symbols.push(symbol);
  const wire = wireFor(symbol);
  if (!wire) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => wire };
});

vi.stubEnv('EODHD_API_KEY', 'test-key');

function makeFakeFirestore() {
  const docs = new Map();
  const setCalls = [];
  return {
    setCalls,
    docs,
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const data = docs.get(`${name}/${id}`);
          return { exists: data !== undefined, data: () => data };
        },
        set: async (data) => {
          setCalls.push({ collection: name, id, data });
          docs.set(`${name}/${id}`, data);
        },
      }),
    }),
  };
}

function makeReqRes(body) {
  const req = { method: 'POST', body, headers: { authorization: 'Bearer x' } };
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return { req, res };
}

const BASE_REQUEST = { group: ['AAA', 'BBB'], driver: 'BRENT', lookbackDays: 400 };

// ==================== The single end-to-end run ====================

let out; // response body of the canonical run
let store; // fake Firestore for the canonical run

beforeAll(async () => {
  store = makeFakeFirestore();
  activeFirestore = store;
  const { req, res } = makeReqRes({ ...BASE_REQUEST, forceRefresh: true });
  await handler(req, res);
  expect(res.statusCode).toBe(200);
  out = res.body;
});

describe('boundary fixture guards (the fixture itself stays honest)', () => {
  it('P20 is zero-sum with zero cyclic autocorrelation at lag 2', () => {
    expect(P20.reduce((a, b) => a + b, 0)).toBe(0);
    const acorr2 = P20.reduce((acc, v, i) => acc + v * P20[(i + 2) % 20], 0) / 20;
    expect(acorr2).toBe(0);
  });

  it('the engineered event is the only large divergence source (pre-event |d| stays far below the floor)', () => {
    // Structural guard, cheap version: before the event the group tracks
    // 0.5·rd + 0.8·rdLag2 exactly, so corr(group, driver) is stably positive —
    // asserted via the payload's own pre-event corr20 series staying > 0.
    const preEvent = out.series.corr20.filter((e) => e.eventDate < eqDates[EVENT_START]);
    expect(preEvent.length).toBeGreaterThan(250);
    for (const e of preEvent) expect(e.value).toBeGreaterThan(0);
  });
});

describe('required assert 1 — the NEWEST-FIRST wire was reversed exactly once', () => {
  it('rolling-series eventDates ascend chronologically from the first full window to the last close', () => {
    const dates20 = out.series.corr20.map((e) => e.eventDate);
    expect(dates20[0]).toBe(eqDates[20]);
    expect(dates20[dates20.length - 1]).toBe(eqDates[359]);
    for (let i = 1; i < dates20.length; i++) {
      expect(dates20[i] > dates20[i - 1]).toBe(true);
    }
    expect(out.series.corr20).toHaveLength(340); // 359 returns − 20 + 1
    expect(out.series.corr60).toHaveLength(300);
    expect(out.series.beta40).toHaveLength(320);
  });

  it('the +2 lead sign is positive — a zero or double reversal would flip it to −2', () => {
    expect(out.leadLag.bestLag).toBe(2);
  });
});

describe('required assert 2 — lead-lag', () => {
  it('reports the driver leading by 2 days with the engineered strength', () => {
    expect(out.leadLag.verdict).toBe('driver_leads');
    expect(out.leadLag.bestLag).toBe(2);
    expect(out.leadLag.corrAtBestLag).toBeCloseTo(0.8, 1);
    expect(out.leadLag.lag0Corr).toBeGreaterThan(0.3); // coincident 0.5·rd term
    expect(out.leadLag.corrAtBestLag - out.leadLag.lag0Corr).toBeGreaterThan(0.05); // beats the lag-0 margin
    const row2 = out.leadLag.table.find((r) => r.lag === 2);
    expect(row2.n).toBe(N_RETURNS - 2);
  });
});

describe('required assert 3 — date alignment (inner join)', () => {
  it('drops the commodity-only session and reports the correct joinedCloses', () => {
    expect(out.meta.joinedCloses).toBe(360);
    expect(out.meta.partial).toBe(false);
    expect(out.meta.droppedSymbols).toEqual([]);
    const everyDate = [
      ...out.series.corr20.map((e) => e.eventDate),
      ...out.series.corr60.map((e) => e.eventDate),
      ...out.series.beta40.map((e) => e.eventDate),
      ...(out.inflections ?? []).flatMap((ep) => [ep.startDate, ep.endDate]),
    ];
    expect(everyDate).not.toContain(DROPPED_DATE); // the poison row never leaks
  });
});

describe('required assert 4 — inflection episode anchoring', () => {
  it('detects exactly one weakening episode anchored at closeIndex 325 = the 5th event day', () => {
    expect(out.suppressed).toEqual({});
    expect(out.inflections).toHaveLength(1);
    const ep = out.inflections[0];
    expect(ep.direction).toBe('weakening');
    expect(ep.startCloseIndex).toBe(325);
    expect(ep.startDate).toBe(eqDates[325]); // closeIndex ↔ eventDate consistency
    expect(ep.score).toBeLessThan(-3.5); // fired via the single-day emergency path
    expect(ep.endCloseIndex).toBe(343); // released when |SDS| < 1.0; rebound absorbed by hysteresis
    expect(ep.endDate).toBe(eqDates[343]);
    expect(ep.corr20AtFlag).toBeLessThan(ep.corr60AtFlag); // d < 0 at flag
  });

  it('meta.firstEligibleInflectionDate is the first observation with a full 120-obs SDS baseline', () => {
    // corr60 first exists at closeIndex 60 → divergence obs 120 is closeIndex 180.
    expect(out.meta.firstEligibleInflectionDate).toBe(eqDates[180]);
  });
});

describe('required assert 5 — forward returns to the cent', () => {
  // The test rebuilds the composite levels INDEPENDENTLY from its own rg —
  // matching values prove the endpoint's composite/levels/anchoring pipeline.
  const testLevels = compound(100, groupReturns);

  it.each([[5], [10], [20]])('group + driver forward returns at h=%i match hand-computed values', (h) => {
    const g = out.baseRates.group[h];
    const d = out.baseRates.driver[h];
    expect(g.eligibleCount).toBe(1);
    expect(g.independentCount).toBe(1);
    expect(g.details[0].startCloseIndex).toBe(325);
    expect(g.details[0].fwdReturn).toBeCloseTo(testLevels[325 + h] / testLevels[325] - 1, 12);
    expect(g.details[0].exitDate).toBe(eqDates[325 + h]);
    expect(d.eligibleCount).toBe(1);
    expect(d.details[0].fwdReturn).toBeCloseTo(driverCloses[325 + h] / driverCloses[325] - 1, 12);
  });
});

describe('V1.1 Change F — divergence.latest tension gauge', () => {
  it('matches the final divergence observation (d, eventDate, and SDS to precision)', () => {
    expect(out.divergence).toBeDefined();
    expect(out.divergence.latest).not.toBeNull();
    // Last divergence obs = closeIndex 359 = the last joined close.
    expect(out.divergence.latest.eventDate).toBe(eqDates[359]);
    // d = corr20 − corr60 at the last obs = the two headline byWindow values.
    expect(out.divergence.latest.d).toBeCloseTo(
      out.byWindow.corr20.value - out.byWindow.corr60.value,
      12
    );
    // Score: rebuild the endpoint's divergence series from the payload and run
    // the SAME scorer over its last observation.
    const byDate60 = new Map(out.series.corr60.map((e) => [e.eventDate, e.value]));
    const divSeries = out.series.corr20
      .filter((e) => byDate60.has(e.eventDate) && e.value != null && byDate60.get(e.eventDate) != null)
      .map((e) => ({ d: e.value - byDate60.get(e.eventDate) }));
    const expectedScore = standardizedDivergenceScore(divSeries, divSeries.length - 1);
    expect(expectedScore).not.toBeNull(); // the last obs has a full 120-obs baseline
    expect(out.divergence.latest.score).toBeCloseTo(expectedScore, 10);
  });

  it('stamps a coherent tension state via the shared helper (Build 3.1 coherence)', () => {
    const { d, score, state } = out.divergence.latest;
    // The endpoint's state IS the shared helper applied to its OWN d/score, so
    // the deep-dive gauge and the scan chips render one mapping (BUILD_RULES §4
    // single-source) and the gauge can't claim a state the flag logic refuses.
    expect(state).toBe(tensionStateFrom({ score, d }));
    expect(['calm', 'elevated', 'stretched', 'break']).toContain(state);
  });
});

describe('V1.1 Change G — per-episode into-break returns', () => {
  // Independent rebuild of the composite levels (== the endpoint's groupLevels).
  const testLevels = compound(100, groupReturns);

  it('the engineered episode (closeIndex 325) carries the hand-computed 5-session move into the break', () => {
    expect(out.inflections).toHaveLength(1);
    const ep = out.inflections[0];
    expect(ep.startCloseIndex).toBe(325);
    // Trailing 5d INTO the flag: levels[325] / levels[320] − 1.
    expect(ep.groupInto5d).toBeCloseTo(testLevels[325] / testLevels[320] - 1, 12);
    expect(ep.driverInto5d).toBeCloseTo(driverCloses[325] / driverCloses[320] - 1, 12);
  });

  it('a c < 5 anchor yields null into-break returns (no trailing window)', () => {
    // The fixture has no c<5 episode, so assert the pure trailing helper's floor
    // directly — the endpoint uses exactly this function for both columns.
    expect(trailingReturnInto(testLevels, 3, 5)).toBeNull();
    expect(trailingReturnInto(testLevels, 5, 5)).toBeCloseTo(testLevels[5] / testLevels[0] - 1, 12);
  });
});

describe('V2 Build 3 — break context (technical state at the flag) + conditioned base rates', () => {
  // Independent rebuild of the composite levels (== the endpoint's groupLevels),
  // plus TEST-LOCAL chronological reference SMA/RSI — the endpoint's
  // chronological→newest-first order adapter is proven by agreement with a
  // reference that never reverses anything (test-local reference
  // implementations are sanctioned; production copies are not).
  const testLevels = compound(100, groupReturns);

  function refSMA(levels, endIdx, period) {
    if (endIdx + 1 < period) return null;
    let s = 0;
    for (let i = endIdx - period + 1; i <= endIdx; i++) s += levels[i];
    return s / period;
  }

  function refRSI(levels, endIdx, period = 14) {
    if (endIdx + 1 < period + 1) return null;
    const changes = [];
    for (let i = 1; i <= endIdx; i++) changes.push(levels[i] - levels[i - 1]);
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      const ch = changes[i];
      if (ch > 0) avgGain += ch;
      else avgLoss += -ch;
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period; i < changes.length; i++) {
      const ch = changes[i];
      avgGain = (avgGain * (period - 1) + (ch > 0 ? ch : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (ch < 0 ? -ch : 0)) / period;
    }
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  }

  it('the engineered episode (c=325 ≥ 50) carries contextAtFlag matching the chronological reference', () => {
    const ep = out.inflections[0];
    expect(ep.startCloseIndex).toBe(325); // deep history — every stamp computable
    const ref50 = refSMA(testLevels, 325, 50);
    // Reference-derived side, then the hand-determined side for THIS fixture
    // (the composite sits ~7% above its 50DMA at the flag) — the second
    // assert guards the first against a degenerate always-equal fixture.
    expect(ep.contextAtFlag.vs50DMA).toBe(
      testLevels[325] > Number(ref50.toFixed(4)) ? 'above' : 'below'
    );
    expect(ep.contextAtFlag.vs50DMA).toBe('above');
    const refR = refRSI(testLevels, 325, 14);
    expect(ep.contextAtFlag.rsi14).toBeCloseTo(refR, 1); // production rounds to 2dp
    expect(refR).toBeGreaterThan(71); // fixture guard: decisively clear of the 70 zone edge
    expect(ep.contextAtFlag.rsiZone).toBe('overbought');
  });

  it('baseRates.byCondition partitions by the episode\'s own stamp with the <3-independent stat gate', () => {
    expect(out.baseRates.byCondition).toBeDefined();
    for (const h of [5, 10, 20]) {
      const above = out.baseRates.byCondition.above50DMA[h];
      const below = out.baseRates.byCondition.below50DMA[h];
      // The single 'above' episode lands in the above partition only…
      expect(above.eligibleCount).toBe(1);
      expect(above.independentCount).toBe(1);
      // …and 1 independent is below the tier gate: counts render, stats are
      // NULL (never a one-episode "median").
      expect(above.mean).toBeNull();
      expect(above.median).toBeNull();
      expect(above.hitRate).toBeNull();
      // The pinned conditioned shape: exactly the five aggregate fields.
      expect(Object.keys(above).sort()).toEqual(
        ['eligibleCount', 'hitRate', 'independentCount', 'mean', 'median'].sort()
      );
      // The other side is an honest zero-count block — never a guessed member.
      expect(below).toEqual({
        eligibleCount: 0,
        independentCount: 0,
        mean: null,
        median: null,
        hitRate: null,
      });
    }
  });
});

describe('response contract details', () => {
  it('headline beta is the LATEST rolling entry (never a separately-computed number)', () => {
    const lastBeta = out.series.beta40[out.series.beta40.length - 1];
    expect(out.beta.window).toBe(40);
    expect(out.beta.latest.beta).toBe(lastBeta.beta);
    expect(out.beta.latest.r).toBe(lastBeta.r);
    expect(out.beta.latest.eventDate).toBe(eqDates[359]);
    expect(out.beta.interpretation).toBe('group % move per 1% move in BNO (Brent oil ETF proxy)');
    expect(out.beta.unit).toBe('% change of BNO ETF');
  });

  it('byWindow carries the latest rolling values (and only the 20/60 pair — no corr120 anywhere)', () => {
    expect(out.byWindow.corr20.value).toBe(out.series.corr20[339].value);
    expect(out.byWindow.corr60.value).toBe(out.series.corr60[299].value);
    expect(out.byWindow.corr120).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('corr120');
  });

  it('wrote the dual-freshness cache doc to correlationIntelligence (non-partial run)', () => {
    expect(store.setCalls).toHaveLength(1);
    const write = store.setCalls[0];
    expect(write.collection).toBe('correlationIntelligence');
    expect(write.data.payload.meta.joinedCloses).toBe(360);
    expect(typeof write.data.computedAt).toBe('string');
    expect(write.data.expiresAt).toBeGreaterThan(Date.now());
    expect(write.data.ttlMs).toBeGreaterThan(0);
  });
});

describe('cache + partial-failure contracts', () => {
  it('a second identical request (no forceRefresh) is served cached with zero new fetches or writes', async () => {
    const fetchesBefore = fetchCalls.count;
    const setsBefore = store.setCalls.length;
    const { req, res } = makeReqRes({ ...BASE_REQUEST });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.cached).toBe(true);
    expect(res.body.meta.joinedCloses).toBe(360);
    expect(fetchCalls.count).toBe(fetchesBefore); // L1 hit — the wire was never touched
    expect(store.setCalls.length).toBe(setsBefore);
  });

  it('a failing group member → 200 with meta.partial + droppedSymbols, computed over survivors, and NO cache write in either layer', async () => {
    const setsBefore = store.setCalls.length;
    const partialBody = { group: ['AAA', 'CCC'], driver: 'BRENT', lookbackDays: 400 };
    const { req, res } = makeReqRes(partialBody);
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.partial).toBe(true);
    expect(res.body.meta.droppedSymbols).toEqual(['CCC']);
    expect(res.body.meta.joinedCloses).toBe(360); // survivors (AAA) still compute
    expect(store.setCalls.length).toBe(setsBefore); // no Firestore write
    // No L1 write either: the identical request recomputes from the wire.
    const fetchesBefore = fetchCalls.count;
    const second = makeReqRes(partialBody);
    await handler(second.req, second.res);
    expect(second.res.statusCode).toBe(200);
    expect(second.res.body.meta.cached).toBe(false);
    expect(fetchCalls.count).toBeGreaterThan(fetchesBefore);
  });

  it('driver fetch failure → 422 driver_unavailable', async () => {
    const { req, res } = makeReqRes({ group: ['AAA'], driver: 'WTI' }); // USO.US not on the wire
    await handler(req, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('driver_unavailable');
  });

  it('ALL group members failing → 422 group_unavailable', async () => {
    const { req, res } = makeReqRes({ group: ['ZZZ'], driver: 'BRENT' });
    await handler(req, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('group_unavailable');
    expect(res.body.droppedSymbols).toEqual(['ZZZ']);
  });
});

describe('V2 Build 1 — registry expansion (sector driver)', () => {
  it('a sector driver (XLE) fetches its registry-driven wire symbol and carries the registry label/unit', async () => {
    const before = fetchCalls.symbols.length;
    const { req, res } = makeReqRes({
      group: ['AAA', 'BBB'],
      driver: 'XLE',
      lookbackDays: 400,
      forceRefresh: true,
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const wireSymbols = fetchCalls.symbols.slice(before);
    expect(wireSymbols).toContain('XLE.US'); // registry symbol, fetched verbatim (never re-normalized)
    expect(res.body.meta.driver).toBe('XLE');
    expect(res.body.meta.driverLabel).toBe('Energy sector (XLE)');
    expect(res.body.meta.driverUnit).toBe('% change');
    expect(res.body.beta.interpretation).toBe('group % move per 1% move in Energy sector (XLE)');
    expect(res.body.beta.unit).toBe('% change');
    expect(res.body.meta.joinedCloses).toBe(360); // the poison driver-only session inner-joined away
  });
});

describe('V2 Build 1 — pair mode (CUSTOM synthetic driver)', () => {
  it('normalizes customSymbol brk.b → wire BRK-B.US and carries the synthetic label/interpretation', async () => {
    const before = fetchCalls.symbols.length;
    const { req, res } = makeReqRes({
      group: ['AAA', 'BBB'],
      driver: 'CUSTOM',
      customSymbol: 'brk.b',
      lookbackDays: 400,
      forceRefresh: true,
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const wireSymbols = fetchCalls.symbols.slice(before);
    expect(wireSymbols).toContain('BRK-B.US'); // dot→hyphen + exactly one .US suffix
    expect(wireSymbols).not.toContain('BRK.B.US');
    expect(wireSymbols).not.toContain('BRK.B');
    expect(res.body.meta.driver).toBe('CUSTOM');
    expect(res.body.meta.driverLabel).toBe('BRK.B'); // synthetic label = raw ticker (canonical app form)
    expect(res.body.meta.driverUnit).toBe('% change');
    expect(res.body.beta.interpretation).toBe('group % move per 1% move in BRK.B');
    expect(res.body.beta.unit).toBe('% change');
  });

  it('two CUSTOM runs with different symbols write two distinct cache docs (cache key incorporates customSymbol)', async () => {
    const setsBefore = store.setCalls.length;
    const runCustom = async (customSymbol) => {
      const { req, res } = makeReqRes({
        group: ['AAA', 'BBB'],
        driver: 'CUSTOM',
        customSymbol,
        lookbackDays: 400,
        forceRefresh: true,
      });
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.meta.partial).toBe(false);
    };
    await runCustom('brk.b'); // driver wire BRK-B.US (MEMBER_A_WIRE)
    await runCustom('spy.us'); // driver wire SPY.US (MEMBER_B_WIRE)
    const newWrites = store.setCalls.slice(setsBefore);
    expect(newWrites).toHaveLength(2); // two Firestore writes, not one collision
    expect(newWrites.every((w) => w.collection === 'correlationIntelligence')).toBe(true);
    expect(newWrites[0].id).not.toBe(newWrites[1].id); // distinct docIds → distinct cache keys
  });

  it('self-correlation (customSymbol == a group member) → 400 custom_symbol_in_group', async () => {
    const { req, res } = makeReqRes({ group: ['AAA', 'BBB'], driver: 'CUSTOM', customSymbol: 'AAA' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('custom_symbol_in_group');
  });

  it('self-correlation guard is canonicalization-aware (aaa.us == group member AAA) → 400', async () => {
    const { req, res } = makeReqRes({ group: ['AAA', 'BBB'], driver: 'CUSTOM', customSymbol: 'aaa.us' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('custom_symbol_in_group');
  });

  it('self-correlation guard is wire-form aware: BRK.B in group vs custom BRK-B (identical EODHD series) → 400', async () => {
    // BRK.B and BRK-B both normalize to the wire symbol BRK-B.US, so they are
    // the SAME underlying series — the guard must catch it and never fabricate
    // a corr=1 / beta=1 self-correlation (presentation-honesty).
    const forward = makeReqRes({ group: ['BRK.B', 'AAPL'], driver: 'CUSTOM', customSymbol: 'BRK-B' });
    await handler(forward.req, forward.res);
    expect(forward.res.statusCode).toBe(400);
    expect(forward.res.body.error).toBe('custom_symbol_in_group');
    // ...and the reverse (group holds the hyphen form, custom uses the dot form).
    const reverse = makeReqRes({ group: ['BRK-B', 'AAPL'], driver: 'CUSTOM', customSymbol: 'brk.b' });
    await handler(reverse.req, reverse.res);
    expect(reverse.res.statusCode).toBe(400);
    expect(reverse.res.body.error).toBe('custom_symbol_in_group');
  });

  it.each([
    [{ group: ['AAA'], driver: 'CUSTOM' }, 'CUSTOM without a customSymbol'],
    [{ group: ['AAA'], driver: 'CUSTOM', customSymbol: '   ' }, 'CUSTOM with a blank customSymbol'],
    [{ group: ['AAA'], driver: 'CUSTOM', customSymbol: 'aa$a' }, 'CUSTOM with an invalid customSymbol'],
    [{ group: ['AAA'], driver: 'BRENT', customSymbol: 'AAPL' }, 'customSymbol with a non-CUSTOM driver'],
  ])('400 invalid_custom_symbol: %s', async (body) => {
    const { req, res } = makeReqRes(body);
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_custom_symbol');
  });
});

describe('validation + config guards', () => {
  it.each([
    [{ group: ['AAA'], driver: 'NOPE' }, 'invalid_driver'],
    [{ group: [], driver: 'BRENT' }, 'invalid_group'],
    [{ group: Array.from({ length: 11 }, (_, i) => `S${i}`), driver: 'BRENT' }, 'invalid_group'],
    [{ group: ['aa$a'], driver: 'BRENT' }, 'invalid_symbol'],
    [{ group: ['1AAA'], driver: 'BRENT' }, 'invalid_symbol'], // must start with a letter
    [{ group: ['AAA'], driver: 'BRENT', lookbackDays: 'abc' }, 'invalid_lookback'],
  ])('400s on bad input: %j → %s', async (body, expectedError) => {
    const { req, res } = makeReqRes(body);
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(expectedError);
  });

  it('accepts dotted/hyphenated tickers (BF.B idiom) at the validation layer', async () => {
    const { req, res } = makeReqRes({ group: ['BF.B'], driver: 'BRENT' });
    await handler(req, res);
    expect(res.statusCode).toBe(422); // passes validation; fails only at the (unmocked BF-B.US) fetch
    expect(res.body.error).toBe('group_unavailable');
    expect(res.body.droppedSymbols).toEqual(['BF.B']); // reported in app form, not wire form
  });

  it('normalizes symbols for EODHD: BRK.B fetches as BRK-B.US and a user-entered SPY.US canonicalizes (never BRK.B.US / SPY.US.US)', async () => {
    const before = fetchCalls.symbols.length;
    const { req, res } = makeReqRes({
      group: ['BRK.B', 'SPY.US'],
      driver: 'BRENT',
      lookbackDays: 400,
      forceRefresh: true,
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.partial).toBe(false);
    expect(res.body.meta.droppedSymbols).toEqual([]);
    expect(res.body.meta.group).toEqual(['BRK.B', 'SPY']); // canonical app form: dots kept, trailing .US stripped
    expect(res.body.meta.joinedCloses).toBe(360);
    const wireSymbols = fetchCalls.symbols.slice(before);
    expect(wireSymbols).toContain('BRK-B.US'); // repo-standard dot→hyphen class-share form
    expect(wireSymbols).toContain('SPY.US'); // exactly one suffix
    expect(wireSymbols).toContain('BNO.US');
    expect(wireSymbols).not.toContain('BRK.B.US');
    expect(wireSymbols).not.toContain('SPY.US.US');
  });

  it('clamps lookbackDays to the [150, 1260] ceiling and echoes the clamp', async () => {
    const { req, res } = makeReqRes({ ...BASE_REQUEST, lookbackDays: 5000, forceRefresh: true });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.lookbackDays).toBe(1260);
    expect(res.body.meta.joinedCloses).toBe(360); // fixture depth, unclamped by the deeper ask
  });

  it('404s while CORRELATION_LAB_ENABLED is false (merge-dark defense-in-depth), before auth or any fetch', async () => {
    labFlag.on = false;
    try {
      const fetchesBefore = fetchCalls.count;
      const { req, res } = makeReqRes(BASE_REQUEST);
      await handler(req, res);
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'not_found' });
      expect(fetchCalls.count).toBe(fetchesBefore); // nothing fetched, nothing revealed
    } finally {
      labFlag.on = true;
    }
  });

  it('non-POST → 405; missing EODHD_API_KEY → 500 API not configured', async () => {
    const { req, res } = makeReqRes(BASE_REQUEST);
    req.method = 'GET';
    await handler(req, res);
    expect(res.statusCode).toBe(405);

    vi.stubEnv('EODHD_API_KEY', '');
    try {
      const second = makeReqRes(BASE_REQUEST);
      await handler(second.req, second.res);
      expect(second.res.statusCode).toBe(500);
      expect(second.res.body.error).toBe('API not configured');
    } finally {
      vi.stubEnv('EODHD_API_KEY', 'test-key');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// V2 Build 4 — conditional correlation ("when does the link hold?")
// ═════════════════════════════════════════════════════════════════════════════

describe('V2 Build 4 — condition masks (unit, hand fixtures — the index-space surface)', () => {
  const mkDates = (n) => makeWeekdays(n);

  it('vol regime: a known high-vol half assigns high/calm around the sample median; the first 19 return days join neither side', () => {
    // 30 calm returns (±0.1%) then 30 loud ones (±1%): every full-calm window
    // (j = 19..29) must read calm, every full-loud window (j = 49..59) high.
    const returns = Array.from({ length: 60 }, (_, t) => (t % 2 === 0 ? 1 : -1) * (t < 30 ? 0.001 : 0.01));
    const masks = buildConditionMasks({
      driverReturns: returns,
      groupReturns: returns,
      groupLevels: compound(100, returns),
      joinedDates: mkDates(61),
    });
    for (let i = 0; i < 19; i++) {
      expect(masks.volHigh[i], `i=${i}`).toBe(false); // first-19 exclusion (no reading)
      expect(masks.volCalm[i], `i=${i}`).toBe(false);
    }
    for (let j = 19; j <= 29; j++) expect(masks.volCalm[j], `j=${j}`).toBe(true); // the calm half
    for (let j = 49; j <= 59; j++) expect(masks.volHigh[j], `j=${j}`).toBe(true); // the high-vol half
    // Every day with a reading joins EXACTLY one side; excluded days join none.
    let readings = 0;
    for (let j = 19; j < 60; j++) {
      expect(masks.volHigh[j] && masks.volCalm[j], `j=${j}`).toBe(false);
      if (masks.volHigh[j] || masks.volCalm[j]) readings += 1;
    }
    expect(readings).toBe(60 - 19);
  });

  it('driver direction: exactly-zero returns are excluded from BOTH sides', () => {
    const driverReturns = [0.01, 0, -0.01, 0.02, 0, -0.02];
    const masks = buildConditionMasks({
      driverReturns,
      groupReturns: driverReturns,
      groupLevels: compound(100, driverReturns),
      joinedDates: mkDates(7),
    });
    expect(masks.driverUp).toEqual([true, false, false, true, false, false]);
    expect(masks.driverDown).toEqual([false, false, true, false, false, true]);
  });

  it('trend state: return day i reads the composite state at close index i + 1 (the offset pin)', () => {
    // Strictly increasing levels: the state is 'up' from the FIRST close with a
    // full inclusive 50-window (close index 49) — so the first masked RETURN
    // day is i = 48, not 49 (an unshifted mask) and not 47 (a double shift).
    const returns = Array.from({ length: 60 }, () => 0.001);
    const masks = buildConditionMasks({
      driverReturns: returns,
      groupReturns: returns,
      groupLevels: Array.from({ length: 61 }, (_, c) => 100 + c),
      joinedDates: mkDates(61),
    });
    for (let i = 0; i < 48; i++) expect(masks.trendUp[i], `i=${i}`).toBe(false);
    expect(masks.trendUp[48]).toBe(true);
    expect(masks.trendUp[59]).toBe(true);
    expect(masks.trendDown.every((v) => v === false)).toBe(true); // never 'down' on a strict ramp
  });
});

describe('V2 Build 4 — conditional block end-to-end on the engineered fixture', () => {
  // Independent reference: masks + side correlations rebuilt from the test's
  // OWN fixture CLOSES (never through the endpoint), pearson from the pure
  // leaf. The returns are recovered from the closes exactly the way the
  // pipeline recovers them (ratio − 1, then the two-member mean) rather than
  // reusing the pre-compounding formula arrays: the fixture's periodic
  // pattern makes many 20d windows IDENTICAL, so the vol series carries exact
  // ties at the median and a last-ulp float difference between "formula
  // returns" and "closes-round-trip returns" flips tied days across the
  // median boundary. Same-op-order recovery makes the reference bit-exact.
  //
  // The fixture happens to exercise ALL THREE verdict shapes at once:
  //   • driverDirection — the fixture driver's returns are EXACTLY ±1%, so
  //     each sign class is constant → degenerate subsets → null sides WITH
  //     ≥ 60-day counts (the honest "couldn't measure" corner);
  //   • volRegime — two real sides whose gap sits under the 0.15 floor
  //     ("no meaningful difference");
  //   • trendState — a real ≥ 0.15 asymmetry pointing at downtrend days.
  const rtReturns = (closes) => closes.slice(1).map((c, i) => c / closes[i] - 1);
  const refDriver = rtReturns(driverCloses);
  const refA = rtReturns(memberACloses);
  const refB = rtReturns(memberBCloses);
  const refGroup = refA.map((r, i) => (r + refB[i]) / 2); // the endpoint's equal-weight mean, same op order
  const testLevels = compound(100, refGroup); // == the endpoint's synthetic groupLevels, bit-exact

  const refMasked = (mask) => {
    const g = [];
    const d = [];
    mask.forEach((m, i) => {
      if (m) {
        g.push(refGroup[i]);
        d.push(refDriver[i]);
      }
    });
    return { corr: pearson(g, d), n: g.length };
  };
  const refStd = (arr) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    let ss = 0;
    for (const v of arr) ss += (v - m) * (v - m);
    return Math.sqrt(ss / (arr.length - 1));
  };
  const refSMA50 = (lv, c) => {
    if (c + 1 < 50) return null;
    let s = 0;
    for (let i = c - 49; i <= c; i++) s += lv[i];
    return s / 50;
  };

  it('carries the additive block with the pinned shape (and the old asserts never saw it — additive-field safety)', () => {
    expect(out.conditional).toBeDefined();
    expect(out.conditional.minObs).toBe(60);
    expect(Object.keys(out.conditional).sort()).toEqual(
      ['driverDirection', 'minObs', 'trendState', 'volRegime'].sort()
    );
    for (const key of ['driverDirection', 'trendState']) {
      expect(Object.keys(out.conditional[key]).sort()).toEqual(
        ['asymmetric', 'counts', 'direction', 'down', 'labels', 'sides', 'up'].sort()
      );
      // The ordered side-key pair is SERVER-owned (review fix: the UI renders
      // whatever arrives here, so a side-key rename can never strand a client
      // mirror into a confidently-wrong insufficiency verdict).
      expect(out.conditional[key].sides).toEqual(['up', 'down']);
    }
    expect(Object.keys(out.conditional.volRegime).sort()).toEqual(
      ['asymmetric', 'calm', 'counts', 'direction', 'high', 'labels', 'sides'].sort()
    );
    expect(out.conditional.volRegime.sides).toEqual(['high', 'calm']);
  });

  it('driverDirection: registry-derived labels; constant-magnitude sign classes are honestly unmeasurable (null sides, real counts)', () => {
    const dd = out.conditional.driverDirection;
    expect(dd.labels).toEqual({
      up: 'days Brent Crude (BNO proxy) rose',
      down: 'days Brent Crude (BNO proxy) fell',
    });
    const upCount = driverReturns.filter((r) => r > 0).length;
    expect(dd.counts).toEqual({ up: upCount, down: N_RETURNS - upCount }); // no exact zeros in the fixture
    expect(dd.counts.up).toBeGreaterThanOrEqual(60);
    expect(dd.counts.down).toBeGreaterThanOrEqual(60);
    // Each sign class of the ±1%-exact driver is CONSTANT → zero driver
    // variance in the subset → null, never a fabricated number (and the
    // reference agrees the subsets are degenerate).
    expect(refMasked(driverReturns.map((r) => r > 0)).corr).toBeNull();
    expect(dd.up).toBeNull();
    expect(dd.down).toBeNull();
    expect(dd.asymmetric).toBeNull(); // no comparison without two sides
    expect(dd.direction).toBeNull();
  });

  it('volRegime: sides match the independent 20d-std/median reference and sit under the floor → not asymmetric', () => {
    const vr = out.conditional.volRegime;
    expect(vr.labels).toEqual({ high: 'high-vol days', calm: 'calm days' });
    // Reference masks: sample std of the 20 returns ENDING at j vs the median.
    const sds = [];
    for (let j = 19; j < N_RETURNS; j++) sds.push({ j, sd: refStd(refGroup.slice(j - 19, j + 1)) });
    const sorted = sds.map((v) => v.sd).sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const refHigh = new Array(N_RETURNS).fill(false);
    const refCalm = new Array(N_RETURNS).fill(false);
    for (const { j, sd } of sds) {
      if (sd > median) refHigh[j] = true;
      else refCalm[j] = true;
    }
    const expHigh = refMasked(refHigh);
    const expCalm = refMasked(refCalm);
    expect(vr.counts).toEqual({ high: expHigh.n, calm: expCalm.n });
    expect(vr.counts.high + vr.counts.calm).toBe(N_RETURNS - 19); // first-19 exclusion, end to end
    expect(vr.high.n).toBe(expHigh.n);
    expect(vr.calm.n).toBe(expCalm.n);
    expect(vr.high.corr).toBeCloseTo(expHigh.corr, 10);
    expect(vr.calm.corr).toBeCloseTo(expCalm.corr, 10);
    // This fixture's two sides differ by ~0.05 — noise-class under the floor.
    expect(Math.abs(vr.high.corr - vr.calm.corr)).toBeLessThan(0.15);
    expect(vr.asymmetric).toBe(false);
    expect(vr.direction).toBeNull();
  });

  it('trendState: sides match the vs-50DMA reference and the fixture is genuinely asymmetric toward downtrend days', () => {
    const ts = out.conditional.trendState;
    expect(ts.labels).toEqual({ up: 'uptrend days', down: 'downtrend days' });
    const refUp = new Array(N_RETURNS).fill(false);
    const refDown = new Array(N_RETURNS).fill(false);
    for (let i = 0; i < N_RETURNS; i++) {
      const c = i + 1; // the return's own close
      const sma = refSMA50(testLevels, c);
      if (sma == null) continue;
      if (testLevels[c] > Number(sma.toFixed(4))) refUp[i] = true; // production's 4dp SMA rounding
      else refDown[i] = true;
    }
    const expUp = refMasked(refUp);
    const expDown = refMasked(refDown);
    expect(ts.counts).toEqual({ up: expUp.n, down: expDown.n });
    expect(ts.counts.up + ts.counts.down).toBe(N_RETURNS - 48); // first 48 return days have no 50-level window
    expect(ts.up.corr).toBeCloseTo(expUp.corr, 10);
    expect(ts.down.corr).toBeCloseTo(expDown.corr, 10);
    // The engineered breakdown fired while the composite sat below its 50DMA,
    // so this fixture's link is decisively tighter on downtrend days.
    expect(ts.down.corr - ts.up.corr).toBeGreaterThanOrEqual(0.15);
    expect(ts.asymmetric).toBe(true);
    expect(ts.direction).toBe('down');
  });

  it('the conditional read is independent of the episode gate: a short-history run still carries the block', async () => {
    // 160 joined closes (< MIN_CLOSES_FOR_INFLECTIONS = 300) suppresses the
    // regime-break section but must NOT suppress conditional — its sides
    // self-null under the 60-observation floor instead.
    const { req, res } = makeReqRes({ ...BASE_REQUEST, lookbackDays: 160, forceRefresh: true });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.suppressed.inflections).toBeDefined();
    expect(res.body.conditional).toBeDefined();
    const dd = res.body.conditional.driverDirection;
    expect(dd.counts.up + dd.counts.down).toBe(159); // still the full joined return space
    const ts = res.body.conditional.trendState;
    expect(ts.counts.up + ts.counts.down).toBe(159 - 48);
  });
});

describe('V2 Build 4 — TNX direction labels (diff mode: the mask is the Δ sign, the copy is the yield)', () => {
  it('labels read "days the 10Y yield rose/fell" and the up-side count is the count of positive yield changes', async () => {
    const { req, res } = makeReqRes({
      group: ['AAA', 'BBB'],
      driver: 'TNX',
      lookbackDays: 400,
      forceRefresh: true,
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    const dd = res.body.conditional.driverDirection;
    expect(dd.labels).toEqual({
      up: 'days the 10Y yield rose',
      down: 'days the 10Y yield fell',
    });
    // Diff mode: up means the (scaled) yield LEVEL rose. The fixture's driver
    // closes move ±1% a day, so the Δ sign equals the pct-return sign —
    // hand-count it from the wire's own closes.
    const upCount = driverCloses.slice(1).filter((c, i) => c - driverCloses[i] > 0).length;
    expect(dd.counts).toEqual({ up: upCount, down: N_RETURNS - upCount });
    // Unlike the pct fixture, diff magnitudes vary with the level — both sides
    // are measurable and real numbers print.
    expect(dd.up).not.toBeNull();
    expect(dd.down).not.toBeNull();
    expect(dd.up.n).toBe(upCount);
    expect(dd.down.n).toBe(N_RETURNS - upCount);
  });
});
