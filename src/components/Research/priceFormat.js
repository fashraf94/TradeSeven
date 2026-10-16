// Per-asset price precision for the research modal: one rule for the prices it
// prints (the header, the Technical tab's "Current", level and range rows) and
// for the chart's price labels. The asset's shown price picks the band, and all
// of its prices print with that band's decimals, as the chart's axis does.
//   $1 and up        → 2 decimals    ($475.60)
//   $0.01 up to $1   → 4 decimals    ($0.2049)
//   below $0.01      → 4 significant figures ($0.00001234), at most 10 decimals
// At two decimals every DOGE-class level reads "$0.20", and a sub-cent asset
// reads "$0.00". The cap: the chart library mislabels a precision of 11 and
// throws past 16, and no listed asset trades below $0.0000001.
const MAX_DECIMALS = 10;

/** The decimal places a price prints with; 2 when there is no price to size.
 *  The band is read from the price as rounded for the band below it, so a
 *  price that rounds up into the next band prints in it (0.99996 → "1.00"). */
export function priceDecimals(price) {
  const p = Math.abs(Number(price));
  if (!Number.isFinite(p) || p === 0) return 2;
  if (Number(p.toFixed(4)) >= 1) return 2;
  if (Number(p.toPrecision(4)) >= 0.01) return 4;
  // Four significant figures: three places past the first significant digit,
  // read from the exponent (toPrecision would switch to "1.234e-7").
  return Math.min(MAX_DECIMALS, 3 - Number(p.toExponential(3).split('e')[1]));
}

/** The price's digits, without the currency sign: "475.60", "0.2049",
 *  "0.00001234" — with the asset's `decimals` when given, else the price's own.
 *  Absent (null/undefined) stays absent, like `price?.toFixed(2)`. */
export function priceText(price, decimals = priceDecimals(price)) {
  if (price == null) return undefined;
  return Number(price).toFixed(decimals);
}
