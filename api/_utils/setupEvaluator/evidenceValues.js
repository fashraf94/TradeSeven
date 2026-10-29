// api/_utils/setupEvaluator/evidenceValues.js
//
// Measured Trend Evidence, slice 1 (P3) — the fix round after Astra's review
// of PR #1001 (F1 and the metadata hardening). Pure value helpers that the
// daily-bars adapter and the evaluator share. No imports, no clock, no I/O.
//
// EXACT DECIMALS FOR THE DERIVED THRESHOLDS (the numerical policy, named in
// SEMANTICS_NOTES and the build report §21). The approved rules define their
// boundaries in decimal: the extension guard SMA_fast + 2.0 × ATR, the breakout
// volume floor 1.5 × V_avg, and the split heuristic's "1 − min / max exceeds
// 0.10". Floating point misses those boundaries: 100 + 2 × 4.77 is
// 109.53999999999999, 1.5 × 2.2 is 3.3000000000000003, and 1 − 0.72 / 0.8 is
// 0.10000000000000009. Here every operand is read as the shortest decimal that
// round-trips to its double, which is exactly the decimal its source wrote for
// any input of at most 15 significant digits; a 4-decimal SMA or ATR is its
// 4-decimal value. Sums, differences, products and terminating quotients are
// then exact integer (BigInt) arithmetic. No tolerance is used anywhere.
//
// A decimal is { m: bigint, e: number }, the value m × 10^e. `toNumber` returns
// the correctly rounded double of an exact decimal (JavaScript's own decimal
// parse), so a threshold recorded on a check is the double nearest its exact
// value, and the shared strict comparison of the recorded operands gives the
// recorded result.
//
// OWNED COPIES OF CALLER METADATA: `copyData` copies plain objects and arrays
// recursively, keeping keys whose value is undefined and reproducing shared or
// cyclic references inside the copy, and returns every other value as it is.
// Only JSON-like metadata is supported; nothing is refused.

const DECIMAL_FORM = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/;
const pow10 = (k) => 10n ** BigInt(k);

/** The exact decimal of a finite number (its shortest round-trip form), or null for anything else. */
export function toDecimal(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  const parts = DECIMAL_FORM.exec(String(x));
  if (!parts) throw new Error(`evidenceValues: unexpected number form ${String(x)}`); // unreachable: String() of a finite number always matches
  const [, sign, int, frac = '', exp = '0'] = parts;
  return { m: BigInt(`${sign}${int}${frac}`), e: Number(exp) - frac.length };
}

function align(a, b) {
  const e = Math.min(a.e, b.e);
  return [a.m * pow10(a.e - e), b.m * pow10(b.e - e), e];
}

export function addDecimal(a, b) {
  const [x, y, e] = align(a, b);
  return { m: x + y, e };
}

export function subtractDecimal(a, b) {
  const [x, y, e] = align(a, b);
  return { m: x - y, e };
}

export function multiplyDecimal(a, b) {
  return { m: a.m * b.m, e: a.e + b.e };
}

/** −1, 0 or 1 as a is below, equal to or above b, exactly. */
export function compareDecimal(a, b) {
  const [x, y] = align(a, b);
  if (x < y) return -1;
  return x > y ? 1 : 0;
}

/**
 * a / n for a positive integer n: exact whenever the quotient terminates, as it
 * always does for n = 2^i · 5^j (volumeAverageLength is 20 under tf-setup-v1);
 * otherwise rounded half away from zero at 30 fractional digits beyond a's own.
 */
export function divideByInteger(a, n) {
  const N = BigInt(n);
  for (let p = 0; p <= 30; p++) {
    const scaled = a.m * pow10(p);
    if (scaled % N === 0n) return { m: scaled / N, e: a.e - p };
  }
  const twice = (a.m * pow10(30) * 2n) / N;
  return { m: (twice + (twice >= 0n ? 1n : -1n)) / 2n, e: a.e - 30 };
}

/** The correctly rounded double of an exact decimal. */
export function toNumber(d) {
  return Number(`${d.m}e${d.e}`);
}

function copyInto(value, seen) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (const item of value) out.push(copyInto(item, seen));
    return out;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value; // not JSON-like: carried as it is (unsupported, never refused)
  const out = {};
  seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = copyInto(value[key], seen);
  return out;
}

/**
 * An owned deep copy of JSON-like data: plain objects and arrays at every depth.
 * The adapter and the evaluator call it on `{ ...sourceMeta }`, so the top level
 * stays exactly what the earlier shallow copy made (a fresh object of the
 * caller's own enumerable keys) and only the nested values gain ownership.
 */
export function copyData(value) {
  return copyInto(value, new Map());
}
