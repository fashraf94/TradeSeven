// api/_utils/explore/documentDate.js
//
// Explore publish step — A DOCUMENT'S OWN DATE, as recorded in `match.documentDate` (build prompt K-6). Pure, no I/O.
// Never the author's `dated`, and never this machine's time zone (review H9): a date and time that names its zone is
// recorded as an ISO instant; a date, or a date and time with no zone, as its calendar date (YYYY-MM-DD); anything
// else as null. Nothing is invented: a PDF date with no day is null, not the first of a month.

/** A real calendar date "YYYY-MM-DD", or null. */
export function calendarDateOf(y, m, d) {
  const iso = `${y}-${m}-${d}`;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * A page's date as recorded (see the header): an ISO 8601 date and time WITH a zone → the ISO instant; a date, or a
 * date and time without a zone → "YYYY-MM-DD"; anything else → null.
 */
export function documentDateOf(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!m) return null;
  const date = calendarDateOf(m[1], m[2], m[3]);
  if (!date) return null;
  if (m[4] === undefined || m[7] === undefined) return date;
  const zone = /^z$/i.test(m[7]) ? 'Z' : m[7].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  const t = Date.parse(`${date}T${m[4]}:${m[5]}:${m[6] ?? '00'}${zone}`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * A PDF date ("D:20260929083012-04'00'") as recorded: with its time and zone → the ISO instant; with a day but no
 * zone or no time → "YYYY-MM-DD"; with no day (a year, a month) → null.
 */
export function pdfDateOf(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(?:D:)?(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?(?:([Zz])|([+-])(\d{2})'?(\d{2})?'?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00', z, sign, oh, om = '00'] = m;
  if (h === undefined || (!z && !sign)) return calendarDateOf(y, mo, d);
  return documentDateOf(`${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : `${sign}${oh}:${om}`}`);
}
