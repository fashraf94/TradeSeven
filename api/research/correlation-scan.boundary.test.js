/**
 * Correlation-scan — END-TO-END BOUNDARY TEST (V2 Build 2, the pinned
 * deliverable). Mocked wire, REAL handler + fetchEodCloses + correlationAssembly
 * + correlationMath + serverCache. Serves a fixture series for EVERY registry
 * symbol via registry-driven iteration (future registry growth lands in the
 * zero-correlation block automatically and cannot break this file), plus
 * engineered series for three drivers to pin the spec's asserts:
 *   (a) ranking order by |corr20| (head pins + a full sortedness walk),
 *   (b) tier assignment straddling the 0.20 floor (HYG 0.25 signal, GOLD 0.15 weak),
 *   (c) a 7-day-calendar driver (BTC) whose row joins DOWN to the equity calendar,
 *   (d) one failing driver → droppedDrivers row + no cache write,
 *   (e) clean run → exactly one Firestore write,
 *   (f) summary null when nothing clears the floor (second fixture group),
 *   (g) flag-404.
 *
 * Fixture design (deterministic — no Math.random): four ±1 period-20 patterns
 * P, Q, S, T — each zero-sum, all four MUTUALLY orthogonal over the cycle
 * (guard-asserted). Group composite returns follow P (canonical), S (the
 * no-signal group), or T (the change-guard group); every driver is built as
 * d[t] = 0.01·(ρ_c·base + √(1−ρ_c²)·Q) with a per-cycle ρ_c, so over the
 * cycle-complete corr windows (every contiguous 20/60-return window covers
 * each residue exactly 1×/3×) the sample correlation is EXACTLY the ρ mix:
 *   • XLE: ρ = 0.4 (cycles 0–15) then 0.9 (16–17) → corr20 = 0.9,
 *     corr60 = (0.4+0.9+0.9)/3 = 0.7333 → summary change 'tightened';
 *   • HYG: ρ = 0.25 flat → signal tier; GOLD: ρ = 0.15 flat → weak tier;
 *   • every other driver: ρ = 0 (pure Q) → corr exactly 0, one shared wire →
 *     bit-identical values → the key-asc tie-break is exercised;
 *   • TNX gets a purpose-built LEVEL wire whose scaled (×0.1) first
 *     differences equal 0.001·Q — diff-mode corr 0 without trusting pct math;
 *   • USMV is served FLAT closes → zero-variance → null corr → ranked last;
 *   • BTC carries ~100 weekend rows with POISON closes (10×) — silent under a
 *     correct inner join, loudly detonating the exact-zero corr otherwise.
 * The second group (CCC/DDD) follows S — orthogonal to BOTH P and Q, so every
 * driver's corr is exactly 0 and nothing clears the floor.
 *
 * V2 Build 3 rider fixture: a fifth mutually-orthogonal pattern U carries the
 * display/tier-agreement group (III/JJJ); IWM is re-wired to a flat ρ = 0.196
 * mix on the U axis — a raw corr BELOW the 0.20 floor that DISPLAYS as
 * "+0.20" (toFixed(2)). Orthogonality keeps IWM at exact 0 against the P/S/T
 * composites, so every pre-Build-3 assert (zero block membership, ranking,
 * tiers, summaries) is untouched.
 */
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'crypto';
import { CORRELATION_DRIVERS } from './driverRegistry.js';
import { tensionStateFromScore } from './correlationAssembly.js';

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

// BUILD_RULES §4 dependency-surface guard: correlation-scan.js imports
// src/config/featureFlags.js AND src/components/Research/correlationVerdict.js
// (api→src imports). This real handler import — and the featureFlags
// vi.mock's importOriginal() above — load those modules for real in the
// Node/vitest env, so a browser-only dep entering either graph explodes here.
// NEVER replace this with a mocked handler; correlationVerdict is deliberately
// NOT mocked (strengthBand runs for real).
const { default: handler } = await import('./correlation-scan.js');

// ==================== Deterministic fixture ====================

function lehmer(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Four ±1 zero-sum period-20 patterns, mutually orthogonal over the cycle
// (guard-asserted below). P is the V0 boundary test's pattern; Q, S, and T
// were constructed by balancing the (P,Q,S) sign cells.
const P20 = [-1, -1, -1, -1, -1, 1, 1, 1, -1, 1, 1, 1, -1, -1, 1, -1, 1, 1, -1, 1];
const Q20 = [1, 1, 1, 1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
const S20 = [1, 1, 1, -1, -1, 1, 1, -1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, -1, -1];
const T20 = [1, -1, -1, 1, -1, 1, -1, 1, 1, 1, -1, 1, -1, 1, 1, 1, -1, -1, -1, -1];
// Build 3 rider axis — orthogonal to P, Q, S, AND T (guard-asserted below).
const U20 = [-1, 1, -1, -1, 1, -1, 1, 1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1];

const N_RETURNS = 360; // 361 joined closes; 18 complete 20-return cycles
const N_CLOSES = N_RETURNS + 1;

// Per-cycle ρ mixes (see header): index = Math.floor(t / 20).
const XLE_RHO = [...Array.from({ length: 16 }, () => 0.4), 0.9, 0.9];
const HYG_RHO = Array.from({ length: 18 }, () => 0.25);
const GOLD_RHO = Array.from({ length: 18 }, () => 0.15);
// TLT keys on T (the THIRD group's axis): flat 0 then 0.3 on the final cycle
// → vs the T-composite corr20 = 0.3 (signal) but corr60 = 0.1 (sub-band) —
// the change-word attachment-guard fixture. Vs P- and S-composites: exact 0.
const TLT_RHO = [...Array.from({ length: 17 }, () => 0), 0.3];
// Build 3 rider: IWM keys on U at a flat ρ = 0.196 — raw corr20/corr60 land
// UNDER the 0.20 floor while toFixed(2) displays "+0.20". Vs every other
// composite (P/S/T): exact 0, so IWM stays in their zero blocks.
const IWM_RHO = Array.from({ length: 18 }, () => 0.196);

/** driver returns d[t] = 0.01·(ρ_c·base[t%20] + √(1−ρ_c²)·Q[t%20]) */
function mixReturns(rhoByCycle, base = P20) {
  return Array.from({ length: N_RETURNS }, (_, t) => {
    const rho = rhoByCycle[Math.floor(t / 20)];
    return 0.01 * (rho * base[t % 20] + Math.sqrt(1 - rho * rho) * Q20[t % 20]);
  });
}

const groupReturns = Array.from({ length: N_RETURNS }, (_, t) => 0.01 * P20[t % 20]);
const group2Returns = Array.from({ length: N_RETURNS }, (_, t) => 0.01 * S20[t % 20]);
const group3Returns = Array.from({ length: N_RETURNS }, (_, t) => 0.01 * T20[t % 20]);
const group4Returns = Array.from({ length: N_RETURNS }, (_, t) => 0.01 * U20[t % 20]); // Build 3 rider
const defaultDriverReturns = mixReturns(Array.from({ length: 18 }, () => 0)); // pure Q → corr 0

const gen = lehmer(20260703);
const wNoise = Array.from({ length: N_RETURNS }, () => (gen() - 0.5) * 0.002);

function compound(start, returns) {
  const closes = [start];
  for (const r of returns) closes.push(closes[closes.length - 1] * (1 + r));
  return closes;
}

// 361 consecutive weekday date strings starting Mon 2024-01-01 (equity calendar).
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
const EQ_DATES = makeWeekdays(N_CLOSES);

// Weekend dates inside the equity range — BTC's 7-day calendar surplus.
function makeWeekends(untilDate, startUtcMs = Date.UTC(2024, 0, 1)) {
  const out = [];
  let ms = startUtcMs;
  for (;;) {
    const d = new Date(ms);
    const iso = d.toISOString().slice(0, 10);
    if (iso >= untilDate) break;
    const day = d.getUTCDay();
    if (day === 0 || day === 6) out.push(iso);
    ms += 86400000;
  }
  return out;
}
const WEEKEND_DATES = makeWeekends(EQ_DATES[N_CLOSES - 1]);

/** NEWEST-FIRST frozen wire from OLDEST-FIRST closes on the equity calendar,
 *  plus optional extra rows (merged by date) — the order=d idiom. */
function toWire(closes, extraRows = []) {
  const asc = closes.map((close, i) => ({ date: EQ_DATES[i], adjusted_close: close }));
  const merged = [...asc, ...extraRows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const wire = merged.reverse();
  wire.forEach((r) => Object.freeze(r));
  return Object.freeze(wire);
}

// ── Members: two per group, composite == the exact pattern series ──
const MEMBER_A_WIRE = toWire(compound(30, groupReturns.map((v, t) => v + wNoise[t])));
const MEMBER_B_WIRE = toWire(compound(70, groupReturns.map((v, t) => v - wNoise[t])));
const MEMBER_C_WIRE = toWire(compound(45, group2Returns.map((v, t) => v + wNoise[t])));
const MEMBER_D_WIRE = toWire(compound(55, group2Returns.map((v, t) => v - wNoise[t])));
const MEMBER_G_WIRE = toWire(compound(35, group3Returns.map((v, t) => v + wNoise[t])));
const MEMBER_H_WIRE = toWire(compound(65, group3Returns.map((v, t) => v - wNoise[t])));
const MEMBER_I_WIRE = toWire(compound(40, group4Returns.map((v, t) => v + wNoise[t]))); // Build 3 rider group
const MEMBER_J_WIRE = toWire(compound(60, group4Returns.map((v, t) => v - wNoise[t])));

// ── Drivers ──
const DEFAULT_WIRE = toWire(compound(25, defaultDriverReturns)); // shared by all ρ=0 drivers
const XLE_WIRE = toWire(compound(50, mixReturns(XLE_RHO)));
const HYG_WIRE = toWire(compound(80, mixReturns(HYG_RHO)));
const GOLD_WIRE = toWire(compound(180, mixReturns(GOLD_RHO)));
const TLT_WIRE = toWire(compound(95, mixReturns(TLT_RHO, T20)));
const FLAT_WIRE = toWire(Array.from({ length: N_CLOSES }, () => 100)); // USMV: zero variance → null corr

// TNX: level wire whose SCALED (×0.1) first differences are exactly 0.001·Q —
// exercises the diff+scale registry path with an engineered exact-zero corr.
const tnxCloses = (() => {
  const scaled = [4.0];
  for (let t = 0; t < N_RETURNS; t++) scaled.push(scaled[scaled.length - 1] + 0.001 * Q20[t % 20]);
  return scaled.map((s) => s * 10); // wire is yield × 10 (the TNX.INDX idiom)
})();
const TNX_WIRE = toWire(tnxCloses);

// BTC: default series on equity days + POISON weekend rows (close × 10). A
// correct inner join drops every weekend silently; a broken one detonates the
// exact-zero corr and the joinedCloses pin.
const btcEquityCloses = compound(25, defaultDriverReturns);
const BTC_WIRE = toWire(
  btcEquityCloses,
  WEEKEND_DATES.map((date) => ({ date, adjusted_close: btcEquityCloses[100] * 10 }))
);

// ==================== fetch stub + request plumbing ====================

// Registry-driven wire map: EVERY registry symbol serves DEFAULT_WIRE unless
// engineered — a 26th driver added later just joins the zero block.
const registryWires = new Map(
  Object.values(CORRELATION_DRIVERS).map((d) => [d.symbol, DEFAULT_WIRE])
);
registryWires.set(CORRELATION_DRIVERS.XLE.symbol, XLE_WIRE);
registryWires.set(CORRELATION_DRIVERS.HYG.symbol, HYG_WIRE);
registryWires.set(CORRELATION_DRIVERS.GOLD.symbol, GOLD_WIRE);
registryWires.set(CORRELATION_DRIVERS.USMV.symbol, FLAT_WIRE);
registryWires.set(CORRELATION_DRIVERS.TNX.symbol, TNX_WIRE);
registryWires.set(CORRELATION_DRIVERS.BTC.symbol, BTC_WIRE);
// TLT is T-keyed: exactly 0 vs the P- and S-composites (it stays in their
// zero blocks) and 0.3/0.1 vs the T-composite (the change-guard fixture).
registryWires.set(CORRELATION_DRIVERS.TLT.symbol, TLT_WIRE);
// IWM is U-keyed (Build 3 rider): 0.196/0.196 vs the U-composite, exact 0
// vs P/S/T — it stays in every pre-Build-3 zero block.
registryWires.set(CORRELATION_DRIVERS.IWM.symbol, toWire(compound(85, mixReturns(IWM_RHO, U20))));

const memberWires = new Map([
  ['AAA.US', MEMBER_A_WIRE],
  ['BBB.US', MEMBER_B_WIRE],
  ['CCC.US', MEMBER_C_WIRE],
  ['DDD.US', MEMBER_D_WIRE],
  ['GGG.US', MEMBER_G_WIRE],
  ['HHH.US', MEMBER_H_WIRE],
  ['III.US', MEMBER_I_WIRE],
  ['JJJ.US', MEMBER_J_WIRE],
]);

const failSet = new Set(); // wire symbols forced to 404 for the dropped-driver phase
const truncSet = new Set(); // wire symbols served a 1-row body (fetch OK, nothing computable)
const fetchCalls = { count: 0, symbols: [] };

function wireFor(symbol) {
  if (failSet.has(symbol)) return null;
  const wire = memberWires.get(symbol) ?? registryWires.get(symbol) ?? null;
  if (wire && truncSet.has(symbol)) return Object.freeze([wire[0]]); // newest row only
  return wire;
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

const BASE_REQUEST = { group: ['AAA', 'BBB'], lookbackDays: 400 };
const REGISTRY_KEYS = Object.keys(CORRELATION_DRIVERS);
const ENGINEERED = ['XLE', 'HYG', 'GOLD', 'USMV'];
// Registry salt mirror (Build 2.1 decision #3): sorted key:symbol pairs.
// Registry-driven on purpose — ANY registry mutation (key add/remove/rename
// or a proxy symbol swap) changes this string, and the docId pins below prove
// the endpoint's cache ids move with it (old cached scans orphan).
const REGISTRY_SALT = [...REGISTRY_KEYS]
  .sort()
  .map((k) => `${k}:${CORRELATION_DRIVERS[k].symbol}`)
  .join(',');

/**
 * Run the handler under vitest fake timers so the real 300ms chunk-throttle
 * sleeps collapse to zero wall time (the file measured >90% pure setTimeout
 * before this). Wire-level realism lives in the REAL handler + fetch stub +
 * chunk ordering, not in the waits. Fake timers pin Date at the current real
 * time, so the two-sided TTL math still yields a future expiresAt.
 */
async function runScanRequest(body) {
  const { req, res } = makeReqRes(body);
  vi.useFakeTimers();
  try {
    const pending = handler(req, res);
    await vi.runAllTimersAsync();
    await pending;
  } finally {
    vi.useRealTimers();
  }
  return res;
}

const store = makeFakeFirestore();
activeFirestore = store;

// The single canonical clean run every describe below reads from.
const canonicalRes = await runScanRequest({ ...BASE_REQUEST, forceRefresh: true });
const out = canonicalRes.body;

describe('boundary fixture guards (the fixture itself stays honest)', () => {
  it('P/Q/S are ±1, zero-sum, and mutually orthogonal over the 20-cycle', () => {
    for (const pat of [P20, Q20, S20]) {
      expect(pat).toHaveLength(20);
      expect(pat.every((v) => v === 1 || v === -1)).toBe(true);
      expect(pat.reduce((a, b) => a + b, 0)).toBe(0);
    }
    const dot = (a, b) => a.reduce((acc, v, i) => acc + v * b[i], 0);
    expect(dot(P20, Q20)).toBe(0);
    expect(dot(P20, S20)).toBe(0);
    expect(dot(Q20, S20)).toBe(0);
  });

  it('the corr windows are cycle-complete (360 returns = 18 full cycles; windows cover each residue evenly)', () => {
    expect(N_RETURNS % 20).toBe(0);
    expect(XLE_RHO).toHaveLength(18);
  });

  it('the canonical run returned 200', () => {
    expect(canonicalRes.statusCode).toBe(200);
  });

  it('P/Q/S/T orthogonality extends to T (the third group axis)', () => {
    expect(T20).toHaveLength(20);
    expect(T20.every((v) => v === 1 || v === -1)).toBe(true);
    expect(T20.reduce((a, b) => a + b, 0)).toBe(0);
    const dot = (a, b) => a.reduce((acc, v, i) => acc + v * b[i], 0);
    expect(dot(T20, P20)).toBe(0);
    expect(dot(T20, Q20)).toBe(0);
    expect(dot(T20, S20)).toBe(0);
  });

  it('U20 (the Build 3 rider axis) is ±1, zero-sum, and orthogonal to P/Q/S/T', () => {
    expect(U20).toHaveLength(20);
    expect(U20.every((v) => v === 1 || v === -1)).toBe(true);
    expect(U20.reduce((a, b) => a + b, 0)).toBe(0);
    const dot = (a, b) => a.reduce((acc, v, i) => acc + v * b[i], 0);
    expect(dot(U20, P20)).toBe(0);
    expect(dot(U20, Q20)).toBe(0);
    expect(dot(U20, S20)).toBe(0);
    expect(dot(U20, T20)).toBe(0);
  });
});

describe('coverage honesty — every registry driver is a row or a droppedDriver, never omitted', () => {
  it('rows ∪ droppedDrivers === the registry key set exactly (registry-driven)', () => {
    const seen = [...out.rows.map((r) => r.driver), ...out.droppedDrivers.map((d) => d.driver)];
    expect([...seen].sort()).toEqual([...REGISTRY_KEYS].sort());
    expect(out.droppedDrivers).toEqual([]); // canonical run is fully clean
    expect(out.rows).toHaveLength(REGISTRY_KEYS.length);
  });

  it('each row carries the pinned shape and its registry label/category verbatim', () => {
    for (const row of out.rows) {
      expect(Object.keys(row).sort()).toEqual(
        ['category', 'corr20', 'corr60', 'd', 'driver', 'identity', 'joinedCloses', 'label', 'score', 'tensionState', 'tier'].sort()
      );
      expect(row.label).toBe(CORRELATION_DRIVERS[row.driver].label);
      expect(row.category).toBe(CORRELATION_DRIVERS[row.driver].category);
      expect(row.identity).toBe(false); // no canonical member is a driver proxy
    }
  });

  it('fetches the deduped symbol universe exactly once per symbol (members + all drivers)', () => {
    // The canonical run is the first traffic on the wire: 2 members + 25
    // registry symbols, no symbol fetched twice.
    const firstRun = fetchCalls.symbols.slice(0, REGISTRY_KEYS.length + 2);
    expect(new Set(firstRun).size).toBe(REGISTRY_KEYS.length + 2);
    expect(firstRun).toContain('AAA.US');
    expect(firstRun).toContain('BTC-USD.CC'); // registry symbol verbatim, never re-normalized
    expect(firstRun).toContain('TNX.INDX');
  });
});

describe('required assert (a) — ranking by |corr20|', () => {
  it('head pins: XLE (0.9) > HYG (0.25) > GOLD (0.15); null-corr USMV ranks dead last', () => {
    expect(out.rows[0].driver).toBe('XLE');
    expect(out.rows[1].driver).toBe('HYG');
    expect(out.rows[2].driver).toBe('GOLD');
    expect(out.rows[out.rows.length - 1].driver).toBe('USMV');
  });

  it('the full row order satisfies the pinned comparator (|corr20| desc, nulls last, key asc on ties)', () => {
    const rank = (r) => (r.corr20 == null ? -1 : Math.abs(r.corr20));
    for (let i = 1; i < out.rows.length; i++) {
      const prev = out.rows[i - 1];
      const cur = out.rows[i];
      const pr = rank(prev);
      const cr = rank(cur);
      expect(pr >= cr).toBe(true);
      if (pr === cr) expect(prev.driver < cur.driver).toBe(true);
    }
  });

  it('the zero block is exactly the non-engineered drivers, each with |corr20| ≈ 0', () => {
    const zeroBlock = out.rows.slice(3, out.rows.length - 1);
    const expectedKeys = REGISTRY_KEYS.filter((k) => !ENGINEERED.includes(k)).sort();
    expect(zeroBlock.map((r) => r.driver).sort()).toEqual(expectedKeys);
    for (const row of zeroBlock) {
      expect(Math.abs(row.corr20)).toBeLessThan(1e-8); // exact-0 engineering + fp dust only
    }
  });
});

describe('engineered correlation values land exactly (cycle-orthogonal construction)', () => {
  const rowOf = (key) => out.rows.find((r) => r.driver === key);

  it('XLE: corr20 = 0.9, corr60 = (0.4+0.9+0.9)/3, d = the gap, change-worthy', () => {
    const xle = rowOf('XLE');
    expect(xle.corr20).toBeCloseTo(0.9, 6);
    expect(xle.corr60).toBeCloseTo((0.4 + 0.9 + 0.9) / 3, 6);
    expect(xle.d).toBeCloseTo(0.9 - (0.4 + 0.9 + 0.9) / 3, 6);
  });

  it('HYG: flat 0.25 in both windows; GOLD: flat 0.15 in both windows', () => {
    expect(rowOf('HYG').corr20).toBeCloseTo(0.25, 6);
    expect(rowOf('HYG').corr60).toBeCloseTo(0.25, 6);
    expect(rowOf('GOLD').corr20).toBeCloseTo(0.15, 6);
    expect(rowOf('GOLD').corr60).toBeCloseTo(0.15, 6);
  });

  it('TNX exercises the diff+scale registry path and lands exactly 0 (level wire, scaled diffs = Q)', () => {
    expect(Math.abs(rowOf('TNX').corr20)).toBeLessThan(1e-8);
    expect(Math.abs(rowOf('TNX').corr60)).toBeLessThan(1e-8);
  });

  it('USMV (flat closes): zero-variance windows → null corr20/corr60/d/score/tension, weak tier', () => {
    const usmv = rowOf('USMV');
    expect(usmv.corr20).toBeNull();
    expect(usmv.corr60).toBeNull();
    expect(usmv.d).toBeNull();
    expect(usmv.score).toBeNull();
    expect(usmv.tensionState).toBeNull();
    expect(usmv.tier).toBe('weak');
    expect(usmv.joinedCloses).toBe(N_CLOSES);
  });
});

describe('required assert (b) — tier assignment straddles the 0.20 floor', () => {
  it('XLE and HYG clear BOTH windows → established; GOLD (0.15) is weak; the zero block is weak', () => {
    const byKey = new Map(out.rows.map((r) => [r.driver, r]));
    expect(byKey.get('XLE').tier).toBe('established'); // 0.9 / 0.733 — both ≥ 0.20
    expect(byKey.get('HYG').tier).toBe('established'); // 0.25 / 0.25 — both ≥ 0.20
    expect(byKey.get('GOLD').tier).toBe('weak');
    for (const row of out.rows.slice(3)) expect(row.tier).toBe('weak');
  });
});

describe('required assert (c) — BTC joins DOWN to the equity calendar', () => {
  it('BTC row joinedCloses equals the equity close count; weekend poison never leaks', () => {
    const btc = out.rows.find((r) => r.driver === 'BTC');
    expect(WEEKEND_DATES.length).toBeGreaterThan(90); // the wire really carried a 7-day surplus
    expect(btc.joinedCloses).toBe(N_CLOSES); // joined DOWN — weekend sessions dropped
    expect(Math.abs(btc.corr20)).toBeLessThan(1e-8); // a leaked 10× poison close detonates this
  });

  it('every row reports its own joinedCloses (all equity-calendar in this fixture)', () => {
    for (const row of out.rows) expect(row.joinedCloses).toBe(N_CLOSES);
  });
});

describe('divergence read + tension states (the Divergence Watch parity contract)', () => {
  it('XLE: d equals corr20 − corr60; score is null here (81 zero-d baseline obs → MAD 0 → unscoreable)', () => {
    const xle = out.rows.find((r) => r.driver === 'XLE');
    expect(xle.d).toBeCloseTo(xle.corr20 - xle.corr60, 12);
    expect(xle.score).toBeNull();
    expect(xle.tensionState).toBeNull();
  });

  it('row invariant: a null score NEVER carries a tension state', () => {
    for (const row of out.rows) {
      if (row.score == null) expect(row.tensionState).toBeNull();
    }
  });

  it('tensionStateFromScore pins the Divergence Watch boundaries (|s|<1 calm, <2 elevated, else break)', () => {
    expect(tensionStateFromScore(null)).toBeNull();
    expect(tensionStateFromScore(undefined)).toBeNull();
    expect(tensionStateFromScore(0)).toBe('calm');
    expect(tensionStateFromScore(-0.99)).toBe('calm');
    expect(tensionStateFromScore(1)).toBe('elevated');
    expect(tensionStateFromScore(-1.5)).toBe('elevated');
    expect(tensionStateFromScore(2)).toBe('break');
    expect(tensionStateFromScore(-3.7)).toBe('break');
  });
});

describe('summary — deterministic one-liner input from the top signal row', () => {
  it('names XLE with band strong, positive direction, and the V1.1 signed change word', () => {
    expect(out.summary).toEqual({
      driver: 'XLE',
      label: 'Energy sector (XLE)',
      band: 'strong', // strengthBand(0.9) — real import, not a mock
      direction: 'positive',
      change: 'tightened', // corr60 ≥ 0, corr20 − corr60 = +0.167 ≥ 0.15
    });
  });

  it('meta echoes the request contract (canonical group, clean, uncached fresh compute)', () => {
    expect(out.meta.group).toEqual(['AAA', 'BBB']);
    expect(out.meta.droppedSymbols).toEqual([]);
    expect(out.meta.partial).toBe(false);
    expect(out.meta.lookbackDays).toBe(400);
    expect(out.meta.cached).toBe(false);
    expect(typeof out.meta.computedAt).toBe('string');
  });
});

describe('required assert (e) — clean run caching', () => {
  it('wrote exactly one Firestore doc, at the registry-salted SCAN docId, with the dual-freshness shape', () => {
    expect(store.setCalls).toHaveLength(1);
    const write = store.setCalls[0];
    expect(write.collection).toBe('correlationIntelligence');
    const expectedId = createHash('sha1').update(`AAA,BBB|SCAN|400|${REGISTRY_SALT}`).digest('hex');
    expect(write.id).toBe(expectedId);
    // Salt-invalidation pin: the unsalted (pre-2.1) id must NOT match — a
    // registry change re-keys every scan doc instead of serving stale rows.
    expect(write.id).not.toBe(createHash('sha1').update('AAA,BBB|SCAN|400').digest('hex'));
    expect(write.data.payload.rows).toHaveLength(REGISTRY_KEYS.length);
    expect(typeof write.data.computedAt).toBe('string');
    expect(write.data.expiresAt).toBeGreaterThan(Date.now());
    expect(write.data.ttlMs).toBeGreaterThan(0);
  });

  it('a second identical request (no forceRefresh) serves cached with zero new fetches or writes', async () => {
    const fetchesBefore = fetchCalls.count;
    const res = await runScanRequest({ ...BASE_REQUEST });
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.cached).toBe(true);
    expect(res.body.rows).toHaveLength(REGISTRY_KEYS.length);
    expect(fetchCalls.count).toBe(fetchesBefore); // L1 hit — the wire was never touched
    expect(store.setCalls).toHaveLength(1);
  });

  it('canonicalization reaches the same cache key: aaa.us + BBB hits the AAA,BBB entry', async () => {
    const fetchesBefore = fetchCalls.count;
    const res = await runScanRequest({ group: ['aaa.us', 'BBB'], lookbackDays: 400 });
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.cached).toBe(true);
    expect(fetchCalls.count).toBe(fetchesBefore);
  });
});

describe('required assert (d) — a failing driver is reported, never cached, never silent', () => {
  const dirtyBody = { group: ['AAA'], lookbackDays: 400 }; // fresh cache key (group of one)

  it('XLB wire failure → droppedDrivers row, 24 computed rows, and NO cache write', async () => {
    failSet.add(CORRELATION_DRIVERS.XLB.symbol);
    const setsBefore = store.setCalls.length;
    const res = await runScanRequest(dirtyBody);
    expect(res.statusCode).toBe(200);
    expect(res.body.droppedDrivers).toEqual([{ driver: 'XLB', label: 'Materials (XLB)' }]);
    expect(res.body.rows).toHaveLength(REGISTRY_KEYS.length - 1);
    expect(res.body.rows.some((r) => r.driver === 'XLB')).toBe(false);
    expect(res.body.meta.partial).toBe(false); // member side is intact — partial is a MEMBER contract
    expect(res.body.meta.cached).toBe(false);
    expect(store.setCalls).toHaveLength(setsBefore); // no Firestore write in either layer
  });

  it('the dirty run was not L1-cached either: an identical re-run refetches the wire', async () => {
    const fetchesBefore = fetchCalls.count;
    const res = await runScanRequest(dirtyBody);
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.cached).toBe(false);
    expect(fetchCalls.count).toBeGreaterThan(fetchesBefore);
    failSet.clear(); // restore the wire for the phases below
  });

  it('a driver whose fetch SUCCEEDS with a truncated body → null-stat row (not dropped) and NO cache write', async () => {
    // The poisoned-cache guard one stage later than a failed fetch: a 200
    // with a 1-row body is uncomputable (no_overlapping_history) — the row
    // reports it honestly and the run must NOT bake into either cache layer.
    truncSet.add(CORRELATION_DRIVERS.XLU.symbol);
    try {
      const setsBefore = store.setCalls.length;
      const res = await runScanRequest(dirtyBody);
      expect(res.statusCode).toBe(200);
      expect(res.body.droppedDrivers).toEqual([]); // fetch did not fail
      const xlu = res.body.rows.find((r) => r.driver === 'XLU');
      expect(xlu.corr20).toBeNull();
      expect(xlu.joinedCloses).toBe(1); // one wire row joined against the member calendar
      expect(xlu.tier).toBe('weak');
      // Both null-corr rows sort last, tie broken key-asc: USMV then XLU.
      const tail = res.body.rows.slice(-2).map((r) => r.driver);
      expect(tail).toEqual(['USMV', 'XLU']);
      expect(store.setCalls).toHaveLength(setsBefore); // error rows poison the cache gate
    } finally {
      truncSet.clear();
    }
  });

  it('a failing group MEMBER keeps the V0 partial contract: 200, partial, computed over survivors, uncached', async () => {
    const setsBefore = store.setCalls.length;
    const res = await runScanRequest({ group: ['AAA', 'NOPE'], lookbackDays: 400 });
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.partial).toBe(true);
    expect(res.body.meta.droppedSymbols).toEqual(['NOPE']);
    expect(res.body.rows).toHaveLength(REGISTRY_KEYS.length); // survivors still scan every driver
    expect(store.setCalls).toHaveLength(setsBefore);
  });

  it('ALL group members failing → 422 group_unavailable, WITHOUT spending the driver universe (members-first fetch)', async () => {
    const fetchesBefore = fetchCalls.count;
    const res = await runScanRequest({ group: ['ZZZ'] });
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('group_unavailable');
    expect(res.body.droppedSymbols).toEqual(['ZZZ']);
    // The guaranteed-fail request must cost the member fetch ONLY — never the
    // ~25-driver quota burn (code-review fix).
    expect(fetchCalls.count).toBe(fetchesBefore + 1);
  });
});

describe('required assert (f) — summary null when nothing clears the floor (second fixture group)', () => {
  let out2;

  it('the S-pattern group (orthogonal to P and Q) puts every driver under the floor', async () => {
    const res = await runScanRequest({ group: ['CCC', 'DDD'], lookbackDays: 400, forceRefresh: true });
    expect(res.statusCode).toBe(200);
    out2 = res.body;
    expect(out2.summary).toBeNull();
    for (const row of out2.rows) {
      expect(row.tier).toBe('weak');
      if (row.corr20 != null) expect(Math.abs(row.corr20)).toBeLessThan(0.2);
    }
  });

  it('a no-signal scan is still a CLEAN scan — it caches (second Firestore write)', () => {
    const write = store.setCalls[store.setCalls.length - 1];
    expect(store.setCalls.length).toBe(2);
    expect(write.id).toBe(createHash('sha1').update(`CCC,DDD|SCAN|400|${REGISTRY_SALT}`).digest('hex'));
    expect(write.data.payload.summary).toBeNull();
  });
});

describe('Build 2.1 — emerging-tier straddle + summary rule (emerging never headlines)', () => {
  it('T-group: TLT at corr20 0.3 / corr60 0.1 is EMERGING (20d-only evidence) and the summary is null', async () => {
    // The tier straddle on the corr60 side of the floor: HYG (0.25/0.25) is
    // established in the canonical run; TLT here clears corr20 but not
    // corr60 → 'emerging' — and emerging rows never carry the summary, so
    // the top-ranked row yields summary null (the UI renders the
    // nothing-established copy). This fixture doubles as the change-word
    // attachment-guard scenario from the Build 2 review: pre-2.1 the guard
    // kept this summary from reading "tightened"; post-2.1 the established
    // requirement subsumes it (|corr60| ≥ 0.20 ⇒ base band exists).
    const res = await runScanRequest({ group: ['GGG', 'HHH'], lookbackDays: 400, forceRefresh: true });
    expect(res.statusCode).toBe(200);
    const tlt = res.body.rows.find((r) => r.driver === 'TLT');
    expect(tlt.corr20).toBeCloseTo(0.3, 6);
    expect(tlt.corr60).toBeCloseTo((0 + 0 + 0.3) / 3, 6); // 0.1 — below the floor
    expect(tlt.tier).toBe('emerging');
    expect(tlt.identity).toBe(false);
    expect(res.body.rows[0].driver).toBe('TLT'); // rank 1 by |corr20| — ranking is current strength
    expect(res.body.rows.filter((r) => r.tier === 'established')).toEqual([]); // nothing clears both windows
    expect(res.body.summary).toBeNull(); // emerging never headlines
  });
});

describe('Build 2.1 — identity rows (a scanned member that IS a driver proxy)', () => {
  let idOut;

  it('group [XLE]: the XLE driver row is identity-annotated at corr 1.0, ranked first, tier established', async () => {
    const res = await runScanRequest({ group: ['XLE'], lookbackDays: 400, forceRefresh: true });
    expect(res.statusCode).toBe(200);
    idOut = res.body;
    const xle = idOut.rows[0];
    expect(xle.driver).toBe('XLE'); // |corr| = 1.0 outranks everything
    expect(xle.identity).toBe(true);
    expect(xle.corr20).toBeCloseTo(1, 6);
    expect(xle.corr60).toBeCloseTo(1, 6);
    expect(xle.tier).toBe('established'); // truthful — the tier is computed, the annotation contextualizes
    expect(idOut.rows.filter((r) => r.identity)).toHaveLength(1); // only the self-match
  });

  it('the summary EXCLUDES the identity row and headlines the top established external driver (HYG)', () => {
    // Every driver shares the Q̂ component with the XLE series, so several
    // externals are established here; the top by |corr20| is HYG:
    // corr20 = 0.9·0.25 + √0.19·√0.9375 ≈ 0.647 (band 'moderate'),
    // corr60 ≈ (0.987 + 0.647 + 0.647)/3 ≈ 0.760 → gap ≈ 0.11 < 0.15 → no change word.
    const hyg = idOut.rows.find((r) => r.driver === 'HYG');
    expect(hyg.corr20).toBeCloseTo(0.9 * 0.25 + Math.sqrt(0.19) * Math.sqrt(0.9375), 6);
    expect(hyg.tier).toBe('established');
    expect(idOut.summary).toEqual({
      driver: 'HYG',
      label: 'High-yield credit (HYG)',
      band: 'moderate', // strengthBand(≈0.647) — real import, not a mock
      direction: 'positive',
      change: null, // |corr20 − corr60| ≈ 0.11 — below the 0.15 gap
    });
  });
});

describe('V2 Build 3 rider — tier assignment uses the 2dp-ROUNDED corr (display and tier agree)', () => {
  let riderOut;

  it('an engineered raw 0.196 (below the raw floor) displays "+0.20" and tiers established — never "+0.20 weak/none"', async () => {
    const res = await runScanRequest({ group: ['III', 'JJJ'], lookbackDays: 400, forceRefresh: true });
    expect(res.statusCode).toBe(200);
    riderOut = res.body;
    const iwm = riderOut.rows.find((r) => r.driver === 'IWM');
    expect(iwm.corr20).toBeCloseTo(0.196, 6);
    expect(iwm.corr60).toBeCloseTo(0.196, 6);
    expect(Math.abs(iwm.corr20)).toBeLessThan(0.2); // the raw value genuinely sits under the floor…
    expect(iwm.corr20.toFixed(2)).toBe('0.20'); // …but the UI displays it as 0.20 (fmtCorr = toFixed(2))
    expect(iwm.tier).toBe('established'); // both windows round to 0.20 → the tier follows the display
    expect(riderOut.rows[0].driver).toBe('IWM'); // every other driver is exactly 0 vs the U-composite
  });

  it('whole-table agreement sweep: a computed row is weak IFF its displayed 20d magnitude is under 0.20', () => {
    // The founder-smoke property in test form, over the rider run AND the
    // canonical run: no row may display a corr20 that contradicts its tier.
    for (const row of [...riderOut.rows, ...out.rows]) {
      if (row.corr20 == null) {
        expect(row.tier).toBe('weak');
        continue;
      }
      const displayedMagnitude = Math.abs(Number(row.corr20.toFixed(2)));
      expect(row.tier === 'weak').toBe(displayedMagnitude < 0.2);
    }
  });
});

describe('required assert (g) — flag-404 + validation & config guards', () => {
  it('404s while CORRELATION_LAB_ENABLED is false, before auth or any fetch', async () => {
    labFlag.on = false;
    try {
      const fetchesBefore = fetchCalls.count;
      const res = await runScanRequest(BASE_REQUEST);
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'not_found' });
      expect(fetchCalls.count).toBe(fetchesBefore); // nothing fetched, nothing revealed
    } finally {
      labFlag.on = true;
    }
  });

  it.each([
    [{ group: [] }, 'invalid_group'],
    [{ group: Array.from({ length: 11 }, (_, i) => `S${i}`) }, 'invalid_group'],
    [{ group: ['aa$a'] }, 'invalid_symbol'],
    [{ group: ['1AAA'] }, 'invalid_symbol'],
    [{ group: ['AAA'], lookbackDays: 'abc' }, 'invalid_lookback'],
  ])('400s on bad input: %j → %s', async (body, expectedError) => {
    const res = await runScanRequest(body);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(expectedError);
  });

  it('clamps lookbackDays to the [150, 1260] ceiling and echoes the clamp', async () => {
    const res = await runScanRequest({ group: ['AAA', 'BBB'], lookbackDays: 5000, forceRefresh: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.lookbackDays).toBe(1260);
    expect(res.body.rows.find((r) => r.driver === 'XLE').joinedCloses).toBe(N_CLOSES); // fixture depth, unclamped by the deeper ask
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
