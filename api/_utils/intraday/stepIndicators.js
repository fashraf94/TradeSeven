// api/_utils/intraday/stepIndicators.js
//
// Intraday Data — Build 1, contract §6.5: RECURSIVE step functions with batch
// parity. PURE, ZERO IMPORTS, no Date.now(), no I/O. Every state is a plain
// JSON object (it is persisted as `stateJson`, contract §7.1), and every
// function returns a NEW state — inputs are never mutated.
//
// Why these exist (Addenda item 6): `calculateRSI` / `calculateMACD` /
// `calculateEMA` in ../technicalCalculations.js are batch, latest-only,
// SMA-seeded and stateless. Driven one bar at a time they would recompute
// from a rolling window, and Wilder RSI is path-dependent — a 15-bar window
// and a 200-bar window ending on the same bar give DIFFERENT numbers. So each
// step function below copies the batch SEED PHASE exactly and then recurses:
//
//   stepEma       SMA of the first `period` closes, then
//                 ema = (x − prev) · 2/(period+1) + prev      (:165, :169-179)
//   stepWilderRsi first `period` changes → mean gain / mean loss, then
//                 avg = (avg · (period−1) + x) / period          (:76-86)
//   stepMacd      fast/slow stepEma; the signal EMA is seeded on the VALID
//                 MACD subsequence — its SMA seed starts at the first bar
//                 where both EMAs are defined, never at bar 9      (:214-219)
//   stepSma       mean of the last `period` closes (calculate5minSMA20)
//
// Parity with the batch functions is asserted at N ∈ {35, 61, 120} to 1e-9
// in stepIndicators.test.js, on the raw values; the batch functions' own
// rounding primitives (toFixed(2) for RSI, toFixed(4) for the rest) are
// applied in the test so the rounded comparison is EXACT.
//
// `value()` honours the batch guards: calculateMACD returns null below 35
// closes even though the signal EMA is defined at 34, so stepMacd reports
// null until its 35th close (WARMUP_BARS.macd5m). Readiness in the bucket
// layer (§6.4) is measured on contiguous completed buckets against the same
// numbers.

export const RSI_PERIOD = 14;
export const SMA_PERIOD = 20;
export const MACD_FAST = 12;
export const MACD_SLOW = 26;
export const MACD_SIGNAL = 9;

/** Per-indicator warmup, contract §6.4: RSI-14: 15; SMA20: 20; MACD: 35. */
export const WARMUP_BARS = Object.freeze({
  rsi5m: RSI_PERIOD + 1,
  sma20_5m: SMA_PERIOD,
  macd5m: MACD_SLOW + MACD_SIGNAL,
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// EMA
// ---------------------------------------------------------------------------

export const stepEma = {
  /**
   * @param {number[]} closes oldest-first (may be empty)
   * @param {{period: number}} opts
   */
  init(closes = [], { period } = {}) {
    if (!Number.isInteger(period) || period < 1) throw new Error('stepEma.init: period required');
    let state = { period, seed: [], value: null, count: 0 };
    for (const c of Array.isArray(closes) ? closes : []) state = stepEma.step(state, c);
    return state;
  },
  step(state, close) {
    if (!isNum(close)) throw new Error('stepEma.step: close must be a finite number');
    const { period } = state;
    if (state.value === null) {
      const seed = [...state.seed, close];
      if (seed.length < period) return { ...state, seed, count: state.count + 1 };
      const sma = seed.reduce((a, b) => a + b, 0) / period;
      return { ...state, seed: [], value: sma, count: state.count + 1 };
    }
    const k = 2 / (period + 1);
    return { ...state, value: (close - state.value) * k + state.value, count: state.count + 1 };
  },
  value(state) { return state && isNum(state.value) ? state.value : null; },
};

// ---------------------------------------------------------------------------
// SMA
// ---------------------------------------------------------------------------

export const stepSma = {
  init(closes = [], { period = SMA_PERIOD } = {}) {
    if (!Number.isInteger(period) || period < 1) throw new Error('stepSma.init: period required');
    let state = { period, window: [], value: null, count: 0 };
    for (const c of Array.isArray(closes) ? closes : []) state = stepSma.step(state, c);
    return state;
  },
  step(state, close) {
    if (!isNum(close)) throw new Error('stepSma.step: close must be a finite number');
    const window = [...state.window, close].slice(-state.period);
    const value = window.length === state.period ? window.reduce((a, b) => a + b, 0) / state.period : null;
    return { ...state, window, value, count: state.count + 1 };
  },
  value(state) { return state && isNum(state.value) ? state.value : null; },
};

// ---------------------------------------------------------------------------
// Wilder RSI
// ---------------------------------------------------------------------------

export const stepWilderRsi = {
  init(closes = [], { period = RSI_PERIOD } = {}) {
    if (!Number.isInteger(period) || period < 1) throw new Error('stepWilderRsi.init: period required');
    let state = { period, prevClose: null, seedGains: [], seedLosses: [], avgGain: null, avgLoss: null, count: 0 };
    for (const c of Array.isArray(closes) ? closes : []) state = stepWilderRsi.step(state, c);
    return state;
  },
  step(state, close) {
    if (!isNum(close)) throw new Error('stepWilderRsi.step: close must be a finite number');
    const { period } = state;
    if (state.prevClose === null) return { ...state, prevClose: close, count: state.count + 1 };
    const change = close - state.prevClose;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    if (state.avgGain === null) {
      // Seed phase — copies technicalCalculations.js:76-81: the simple mean of
      // the first `period` gains and of the first `period` losses.
      const seedGains = [...state.seedGains, gain];
      const seedLosses = [...state.seedLosses, loss];
      if (seedGains.length < period) {
        return { ...state, prevClose: close, seedGains, seedLosses, count: state.count + 1 };
      }
      return {
        ...state,
        prevClose: close,
        seedGains: [],
        seedLosses: [],
        avgGain: seedGains.reduce((a, b) => a + b, 0) / period,
        avgLoss: seedLosses.reduce((a, b) => a + b, 0) / period,
        count: state.count + 1,
      };
    }
    // Wilder smoothing — technicalCalculations.js:83-86.
    return {
      ...state,
      prevClose: close,
      avgGain: (state.avgGain * (period - 1) + gain) / period,
      avgLoss: (state.avgLoss * (period - 1) + loss) / period,
      count: state.count + 1,
    };
  },
  /** Raw RSI (unrounded); the batch returns Number(v.toFixed(2)). */
  value(state) {
    if (!state || state.avgGain === null) return null;
    if (state.avgLoss === 0) return 100;
    const rs = state.avgGain / state.avgLoss;
    return 100 - (100 / (1 + rs));
  },
};

// ---------------------------------------------------------------------------
// MACD
// ---------------------------------------------------------------------------

const signOf = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export const stepMacd = {
  /**
   * @param {number[]} closes oldest-first
   * @param {{fast?: number, slow?: number, signal?: number, barKeys?: (number|string|null)[]}} opts
   *   `barKeys` (optional, parallel to `closes`) lets an init from seeded
   *   buckets carry the event bar key; absent → keys are null.
   */
  init(closes = [], { fast = MACD_FAST, slow = MACD_SLOW, signal = MACD_SIGNAL, barKeys } = {}) {
    let state = {
      fast: stepEma.init([], { period: fast }),
      slow: stepEma.init([], { period: slow }),
      signal: stepEma.init([], { period: signal }),
      minBars: slow + signal,
      line: null,
      signalValue: null,
      hist: null,
      lastNonZeroSign: null,
      event: false,
      eventBarKey: null,
      barKey: null,
      count: 0,
    };
    const list = Array.isArray(closes) ? closes : [];
    for (let i = 0; i < list.length; i++) {
      state = stepMacd.step(state, list[i], Array.isArray(barKeys) ? barKeys[i] ?? null : null);
    }
    return state;
  },
  /**
   * @param {object} state
   * @param {number} close
   * @param {number|string|null} barKey the completed bucket's key (§6.1)
   */
  step(state, close, barKey = null) {
    if (!isNum(close)) throw new Error('stepMacd.step: close must be a finite number');
    const fast = stepEma.step(state.fast, close);
    const slow = stepEma.step(state.slow, close);
    const count = state.count + 1;
    let { signal, line, signalValue, hist, lastNonZeroSign } = state;
    let event = false;
    let eventBarKey = state.eventBarKey;
    if (fast.value !== null && slow.value !== null) {
      // The MACD line is defined; the signal EMA consumes ONLY these values
      // (technicalCalculations.js:214-219 — seeded on the valid subsequence).
      line = fast.value - slow.value;
      signal = stepEma.step(state.signal, line);
      if (signal.value !== null) {
        signalValue = signal.value;
        hist = line - signalValue;
        const s = signOf(hist);
        // `event` is set iff the sign of (line − signal) changed between the
        // last two completed buckets; `eventBarKey` is that bucket's key. A
        // zero histogram neither sets nor clears the carried sign.
        if (s !== 0) {
          if (lastNonZeroSign !== null && s !== lastNonZeroSign) {
            event = true;
            eventBarKey = barKey;
          }
          lastNonZeroSign = s;
        }
      }
    }
    return { ...state, fast, slow, signal, line, signalValue, hist, lastNonZeroSign, event, eventBarKey, barKey, count };
  },
  /**
   * `{ line, signal, hist, event, eventBarKey }` once the batch guard is met
   * (≥ slow + signal closes, calculateMACD:195), else null.
   */
  value(state) {
    if (!state || state.count < state.minBars || state.signalValue === null) return null;
    return {
      line: state.line,
      signal: state.signalValue,
      hist: state.hist,
      event: state.event === true,
      eventBarKey: state.eventBarKey ?? null,
    };
  },
};

/** Round with the batch functions' own primitive (Number(v.toFixed(dp))). */
export function roundLikeBatch(v, dp) {
  return v == null ? null : Number(v.toFixed(dp));
}
