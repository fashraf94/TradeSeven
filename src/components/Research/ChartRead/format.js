// src/components/Research/ChartRead/format.js
//
// The Chart view's read — THE PRINTED NUMBERS AND DATES (build prompt RD-6; spec
// docs/specs/CHART_READ_SPEC_V1.md). One formatter per kind of number, used by the read's line, its sheet
// and the chart's marks alike, so a mark's price, the wording's price and the sheet's are one string by
// construction (BUILD_RULES §9). Pure and Node-clean: no React, no clock.
//
// A price is printed to the cent from the record's own value: the shortest decimal that round-trips the
// stored double (String(v)), rounded half up at the second decimal in exact decimal arithmetic — never
// v.toFixed(2), whose binary rounding prints 141.105 as 141.10.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** A finite number rounded half up (away from zero) to `places` decimals, as a string; null when not a number. */
export function decimalString(v, places) {
  if (!isNum(v)) return null;
  const neg = v < 0;
  const s = String(Math.abs(v));
  if (!/^\d+(\.\d+)?$/.test(s)) return (neg ? '-' : '') + Math.abs(v).toFixed(places); // exponent form: tiny or huge, never a price here
  const [int, frac = ''] = s.split('.');
  if (frac.length <= places) return (neg ? '-' : '') + (places ? `${int}.${frac.padEnd(places, '0')}` : int);
  let digits = BigInt(int + frac.slice(0, places));
  if (frac.charCodeAt(places) >= 53) digits += 1n; // the next digit is 5 or more: half up
  const str = digits.toString().padStart(places + 1, '0');
  const out = places ? `${str.slice(0, -places)}.${str.slice(-places)}` : str;
  return (neg && /[1-9]/.test(out) ? '-' : '') + out;
}

/** A price, to the cent, with its dollar sign: 141.105 → "$141.11". Null when not a number. */
export function formatPrice(v) {
  const s = decimalString(v, 2);
  return s === null ? null : `$${s}`;
}

/** A price to the cent without the sign (the chart's axis label). */
export function formatPriceBare(v) {
  return decimalString(v, 2);
}

/** A ratio to one decimal (the breakout's volume over its average): 2.0999 → "2.1". Null when not a number. */
export function formatRatio(v) {
  return decimalString(v, 1);
}

const VOLUME_UNITS = Object.freeze([[1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']]);
/** At most three significant figures; trailing zeros dropped only after a decimal point (review L1-1: 150K, never 15K). */
const shortFigure = (n) => {
  const s = decimalString(n, n >= 100 ? 0 : n >= 10 ? 1 : 2);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};
/**
 * A share count, short: 4,123,456 → "4.12M"; 150,000 → "150K"; 950 → "950". The unit follows the rounding
 * (999,600 → "1M", never "1000K"). Null when not a number.
 */
export function formatVolume(v) {
  if (!isNum(v) || v < 0) return null;
  for (let i = 0; i < VOLUME_UNITS.length; i++) {
    const [size, unit] = VOLUME_UNITS[i];
    if (v < size && size > 1) continue;
    const s = shortFigure(v / size);
    if (Number(s) >= 1000 && i > 0) return `${shortFigure(v / VOLUME_UNITS[i - 1][0])}${VOLUME_UNITS[i - 1][1]}`;
    return `${s}${unit}`;
  }
  return null;
}

const parts = (date, opts) => {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).formatToParts(d).map((p) => [p.type, p.value]));
};

/** A session date as the read prints it: '2026-11-17' → "Tue Nov 17". Null when not a date. */
export function dayLabel(date) {
  const p = parts(date, { weekday: 'short', month: 'short', day: 'numeric' });
  return p ? `${p.weekday} ${p.month} ${p.day}` : null;
}

/** The weekday, short: '2026-11-16' → "Mon". */
export function weekdayShort(date) {
  const p = parts(date, { weekday: 'short' });
  return p ? p.weekday : null;
}

/** The weekday, in full: '2026-11-17' → "Tuesday". */
export function weekdayLong(date) {
  const p = parts(date, { weekday: 'long' });
  return p ? p.weekday : null;
}

/** A date inside a sheet's side label: '2026-11-06' → "Nov 6". */
export function monthDay(date) {
  const p = parts(date, { month: 'short', day: 'numeric' });
  return p ? `${p.month} ${p.day}` : null;
}

const ET_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
/** An instant as an ET time with its weekday: "Wed 1:44 PM ET". Null when not an instant. */
export function etTimeLabel(ms) {
  if (!isNum(ms)) return null;
  const p = Object.fromEntries(ET_TIME.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.hour}:${p.minute} ${p.dayPeriod} ET`;
}

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
/** The ET calendar date of an instant (YYYY-MM-DD). */
export function etDateOf(ms) {
  return ET_DATE.format(new Date(ms));
}
