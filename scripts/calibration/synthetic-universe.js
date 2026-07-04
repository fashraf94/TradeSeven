// scripts/calibration/synthetic-universe.js
// Knob Calibration Task B — Phase B2: synthetic universe generator.
//
// Deterministic, seeded price-path generator that feeds the gate-replay harness.
// Every value is reproducible from (preset, seed) — the PRNG below is seeded and
// pure; there is NO Math.random and NO Date. Same inputs → byte-identical output,
// so golden-fixture tests are stable.
//
// MODEL. Forced rotation targets a HELD name that has gone quiet (the stagnation
// counter climbs) and is a laggard on the day, while the BENCH offers replacement
// candidates. So held symbols always use a "stagnant" motion (tiny per-tick moves
// → stagnation fires, flat day → not a winner), and the PRESET shapes the BENCH's
// opportunity landscape:
//   - trend    : bench rising with dispersion (easy clears, loud enough to wake → low starvation)
//   - chop      : bench oscillates around the open, mild dispersion (moderate clears; small-margin
//                 clears that don't wake → the 8C wake-starvation shows here)
//   - flatline  : bench also flat (few clears → high veto / hurdle-rejection)
//   - stress    : bench volatile with wide dispersion + faster ATR drift (the stress replay)
//
// Each symbol carries a per-tick atrPercentile that DRIFTS, so the fresh
// (current-tick) ATR differs from the frozen (entry-tick) ATR — that gap is what
// A1's resolveHurdleAtr acts on, and the harness measures the fresh-vs-frozen delta.

// mulberry32 — small fast deterministic PRNG. Returns a fn producing [0,1).
export function makePrng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PRESETS = ['trend', 'chop', 'flatline', 'stress'];
export const NORMAL_PRESETS = ['trend', 'chop', 'flatline']; // "not stress" — for the stress-worsening comparison

const round4 = (x) => Math.round(x * 1e4) / 1e4;
const pad = (i) => String(i).padStart(2, '0');

function stepFor(kind, u, bias, driftFromOpen) {
  switch (kind) {
    case 'stagnant':
      return 0.0004 * u; // tiny per-tick moves → stagnation accrues; day stays ~flat
    case 'trend':
      return 0.0035 + 0.0015 * bias + 0.0015 * u; // rising, dispersed
    case 'chop':
      return 0.0015 * bias + 0.006 * u - 0.02 * driftFromOpen; // oscillate, pull back to open
    case 'flatline':
      return 0.0004 * u; // bench also flat
    case 'stress':
      return 0.004 * bias + 0.02 * u; // large swings, wide dispersion
    default:
      return 0.001 * u;
  }
}

function genPath(prng, symbol, kind, nTicks) {
  const entryPrice = 100;
  let price = entryPrice;
  let atrPct = 0.2 + prng() * 0.6; // 0.2..0.8
  const bias = (prng() - 0.5) * 2; // per-symbol idiosyncratic drift, [-1,1)
  const ticks = [];
  for (let t = 0; t < nTicks; t++) {
    const u = (prng() - 0.5) * 2;
    price *= 1 + stepFor(kind, u, bias, price / entryPrice - 1);
    const atrJitter = (kind === 'stress' ? 0.03 : 0.008) * ((prng() - 0.5) * 2);
    atrPct = Math.min(0.95, Math.max(0.05, atrPct + atrJitter));
    ticks.push({
      price: round4(price),
      dailyPct: round4((price - entryPrice) / entryPrice), // FRACTION (e.g. 0.01 = +1%)
      atrPercentile: round4(atrPct), // 0..1 → baseATR = atrPercentile * 8 (percent)
    });
  }
  return { symbol, entryPrice, ticks };
}

// Build a full universe: nHeld stagnant held names + nBench preset-driven bench
// candidates. nTicks default 26 ≈ one RTH session at ~4 ticks/hour.
export function genUniverse({ preset = 'chop', seed = 1, nHeld = 3, nBench = 9, nTicks = 26 } = {}) {
  if (!PRESETS.includes(preset)) throw new Error(`unknown preset '${preset}' (expected ${PRESETS.join('/')})`);
  const prng = makePrng(seed);
  const held = [];
  for (let i = 0; i < nHeld; i++) held.push(genPath(prng, `H${pad(i)}`, 'stagnant', nTicks));
  const bench = [];
  for (let i = 0; i < nBench; i++) bench.push(genPath(prng, `B${pad(i)}`, preset, nTicks));
  return { preset, seed, nHeld, nBench, nTicks, held, bench, symbols: [...held, ...bench] };
}
