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
// correlationMath, and serverCache run for real.
const { default: handler } = await import('./correlation.js');

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
  if (symbol === 'BZ.COMM') return DRIVER_WIRE;
  if (symbol === 'AAA.US') return MEMBER_A_WIRE;
  if (symbol === 'BBB.US') return MEMBER_B_WIRE;
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

describe('response contract details', () => {
  it('headline beta is the LATEST rolling entry (never a separately-computed number)', () => {
    const lastBeta = out.series.beta40[out.series.beta40.length - 1];
    expect(out.beta.window).toBe(40);
    expect(out.beta.latest.beta).toBe(lastBeta.beta);
    expect(out.beta.latest.r).toBe(lastBeta.r);
    expect(out.beta.latest.eventDate).toBe(eqDates[359]);
    expect(out.beta.interpretation).toBe('group % move per 1% Brent move');
    expect(out.beta.unit).toBe('% change');
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
    const { req, res } = makeReqRes({ group: ['AAA'], driver: 'WTI' }); // CL.COMM not on the wire
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

  it('accepts dotted/hyphenated tickers (BRK.B idiom) at the validation layer', async () => {
    const { req, res } = makeReqRes({ group: ['BRK.B'], driver: 'BRENT' });
    await handler(req, res);
    expect(res.statusCode).toBe(422); // passes validation; fails only at the (unmocked) fetch
    expect(res.body.error).toBe('group_unavailable');
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
