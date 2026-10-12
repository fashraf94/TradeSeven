// Independent verification arithmetic. NEVER import into application runtime.
// Rational decimal inputs; separate adjustment/TR implementation, no calculator import.
class Rational {
  constructor(n, d = 1n) {
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n;
    let b = d;
    while (b) { const remainder = a % b; a = b; b = remainder; }
    this.n = n / a; this.d = d / a;
  }
  static parse(value) {
    const text = String(value).toLowerCase();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/.test(text)) throw new TypeError('Reference numeric input');
    const [mantissa, exp = '0'] = text.split('e');
    const scale = (mantissa.split('.')[1]?.length || 0) - Number(exp);
    const n = BigInt(mantissa.replace('.', ''));
    return scale >= 0 ? new Rational(n, 10n ** BigInt(scale)) : new Rational(n * 10n ** BigInt(-scale));
  }
  add(b) { return new Rational(this.n * b.d + b.n * this.d, this.d * b.d); }
  sub(b) { return new Rational(this.n * b.d - b.n * this.d, this.d * b.d); }
  mul(b) { return new Rational(this.n * b.n, this.d * b.d); }
  div(b) { if (b.n === 0n) throw new TypeError('Reference division by zero'); return new Rational(this.n * b.d, this.d * b.n); }
  abs() { return new Rational(this.n < 0n ? -this.n : this.n, this.d); }
  greater(b) { return this.n * b.d > b.n * this.d; }
  number() { return Number(this.n) / Number(this.d); }
}
export function independentReference(rawRows, sourceSession) {
  const rows = [...rawRows].filter(row => row.date <= sourceSession).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  if (rows.length !== 15) throw new TypeError('Reference requires fifteen bars');
  const bars = rows.map(row => {
    const factor = Rational.parse(row.adjusted_close).div(Rational.parse(row.close));
    return { high: Rational.parse(row.high).mul(factor), low: Rational.parse(row.low).mul(factor), close: Rational.parse(row.adjusted_close) };
  });
  let total = new Rational(0n);
  for (let i = 1; i < bars.length; i++) {
    const candidates = [bars[i].high.sub(bars[i].low), bars[i].high.sub(bars[i - 1].close).abs(), bars[i].low.sub(bars[i - 1].close).abs()];
    total = total.add(candidates.reduce((max, value) => value.greater(max) ? value : max));
  }
  const atr = total.div(new Rational(14n));
  return { atr14Dollars: atr.number(), measuredPct: atr.div(bars.at(-1).close).mul(new Rational(100n)).number(), orderedDates: rows.map(row => row.date), implementation: 'independent_decimal_rational_v1' };
}
