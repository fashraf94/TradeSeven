// Per-asset price precision for the research modal: one rule for the prices it
// prints (the header, the Technical tab's "Current", level and range rows) and
// for the chart's price labels.
//   $1 and up        → 2 decimals    ($475.60)
//   $0.01 up to $1   → 4 decimals    ($0.2049)
//   below $0.01      → 4 significant figures ($0.00001234)
// At two decimals every DOGE-class level reads "$0.20", and a sub-cent asset
// reads "$0.00".

/** The decimal places a price prints with; 2 when there is no price to size. */
export function priceDecimals(price) {
  const p = Math.abs(Number(price));
  if (!Number.isFinite(p) || p === 0 || p >= 1) return 2;
  if (p >= 0.01) return 4;
  // Four significant figures: three places past the first significant digit,
  // read from the exponent (toPrecision would switch to "1.234e-7").
  return 3 - Number(p.toExponential(3).split('e')[1]);
}

/** The price's digits, without the currency sign: "475.60", "0.2049",
 *  "0.00001234". Absent (null/undefined) stays absent, like `price?.toFixed(2)`. */
export function priceText(price) {
  if (price == null) return undefined;
  return Number(price).toFixed(priceDecimals(price));
}
