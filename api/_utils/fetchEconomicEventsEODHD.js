// api/_utils/fetchEconomicEventsEODHD.js
// Recap Restoration mini-arc (spec V1.1, rulings R-B1 / R-A1) — the
// deterministic econ OPERAND source for Neta's recap seam.
//
// Division of authority (R-A1, R-B1a note):
//   • macroCalendar.js arrays OWN the Tier-1 set and the release dates/times
//     — membership in the array set IS the recap classification.
//   • This module supplies NUMBERS ONLY (actual / estimate / previous) for
//     known array events, from EODHD /economic-events, matched per category.
//   • Sonar is NOT consulted on the recap path (R-B1: deterministic
//     end-to-end); it remains on the preview path only.
//
// Matching: EODHD identifies releases by a free-text `type` string plus a
// `comparison` axis (mom/qoq/yoy). ECON_CATEGORY_MATCHERS binds each
// macroCalendar category to required keywords, disqualifying keywords
// (core/ex-autos variants), and a preferred comparison, so one array event
// selects at most one operand row — date-equality with the array event is
// always required. The founder's capture run (api/scripts/
// capture-econ-events-eodhd.js) validates this table against live rows
// before the seam goes live; unknown `type` strings simply never match.
//
// Operands are returned RAW (number-or-string, as EODHD sent them) — the
// single parse authority is econPrintVerifier.parseEconOperand (R2), so the
// fetch can never smuggle an unparsed representation past the verifier.
//
// Failure contract mirrors fetchEarningsCalendarEODHD.js: hard failures
// throw; the caller maps a throw to the `fetch_failed` skip-taxonomy code
// (R-B6). An empty rows array is a legitimate quiet window, not a failure.

const LOG_PREFIX = '[EconEventsEODHD]';

// R-B1a(ii): econ recap eligibility = release time + one cron tick, letting
// initial-posting revisions settle. The recap cron runs every 30 minutes.
export const SETTLE_DELAY_MINUTES = 30;

// Category → EODHD `type` matcher. `match`: at least one must appear in the
// lowercased type string. `avoid`: none may appear (filters core/ex-autos
// sibling prints); if EVERY date-matched row is avoid-listed, the match
// fails closed (no operands) rather than silently substituting a sibling
// series — that substitution is exactly the mis-mapping class the R-B1a
// plausibility band exists to catch.
export const ECON_CATEGORY_MATCHERS = Object.freeze({
  'FOMC': Object.freeze({
    match: Object.freeze(['interest rate decision', 'fed funds']),
    avoid: Object.freeze([]),
    preferComparison: null,
  }),
  'CPI': Object.freeze({
    match: Object.freeze(['inflation rate', 'consumer price', 'cpi']),
    avoid: Object.freeze(['core']),
    preferComparison: 'mom',
  }),
  'PPI': Object.freeze({
    match: Object.freeze(['producer price', 'ppi']),
    avoid: Object.freeze(['core']),
    preferComparison: 'mom',
  }),
  'PCE': Object.freeze({
    match: Object.freeze(['pce price', 'personal consumption']),
    avoid: Object.freeze(['core']),
    preferComparison: 'mom',
  }),
  'Retail Sales': Object.freeze({
    match: Object.freeze(['retail sales']),
    avoid: Object.freeze(['ex ', 'ex-']),
    preferComparison: 'mom',
  }),
  'GDP': Object.freeze({
    match: Object.freeze(['gdp growth rate', 'gdp']),
    avoid: Object.freeze(['price index', 'deflator']),
    preferComparison: 'qoq',
  }),
  'Productivity': Object.freeze({
    match: Object.freeze(['productivity']),
    avoid: Object.freeze([]),
    preferComparison: 'qoq',
  }),
  'NFP': Object.freeze({
    match: Object.freeze(['non farm payrolls', 'nonfarm payrolls', 'non-farm payrolls']),
    avoid: Object.freeze(['private', 'manufacturing']),
    preferComparison: null,
  }),
  'JOLTS': Object.freeze({
    match: Object.freeze(['jolts', 'job openings']),
    avoid: Object.freeze(['quits', 'layoffs']),
    preferComparison: null,
  }),
  'ISM Manufacturing': Object.freeze({
    // 'non manufacturing' is the SERVICES release's older official name —
    // it contains 'manufacturing', so it is avoid-listed here (the
    // wireIdentity ECON_ALIAS_TABLE ordering lesson, applied as data).
    match: Object.freeze(['ism manufacturing']),
    avoid: Object.freeze(['non manufacturing', 'non-manufacturing', 'new orders', 'employment', 'prices']),
    preferComparison: null,
  }),
  'ISM Services': Object.freeze({
    match: Object.freeze(['ism services', 'ism non manufacturing', 'ism non-manufacturing']),
    avoid: Object.freeze(['new orders', 'employment', 'prices']),
    preferComparison: null,
  }),
  'Consumer Confidence': Object.freeze({
    match: Object.freeze(['cb consumer confidence', 'consumer confidence']),
    avoid: Object.freeze([]),
    preferComparison: null,
  }),
  'Jobless Claims': Object.freeze({
    match: Object.freeze(['initial jobless claims']),
    avoid: Object.freeze(['continuing', '4-week', '4 week']),
    preferComparison: null,
  }),
});

/** Lowercase-and-collapse for matcher comparison. */
function cleanType(typeStr) {
  return String(typeStr || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 'YYYY-MM-DD HH:MM:SS' | 'YYYY-MM-DD' → 'YYYY-MM-DD' (or null). */
function rowDateOnly(row) {
  const d = String(row?.date || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * Select the operand row for ONE macroCalendar event from the fetched rows.
 * Date equality with the array event is mandatory (R-A1: arrays own dates);
 * the matcher then narrows by keywords / avoid-list / preferred comparison.
 * Deterministic: survivors sort by (preferred comparison first, then
 * shortest type string — headline before decorated variants), first wins.
 *
 * @returns {{ row: object|null, matchedType: string|null }}
 */
export function selectOperandRow(macroEvent, rows) {
  const matcher = ECON_CATEGORY_MATCHERS[macroEvent.category];
  if (!matcher || !Array.isArray(rows)) return { row: null, matchedType: null };

  const dated = rows.filter((r) => rowDateOnly(r) === macroEvent.date);
  const matched = dated.filter((r) => {
    const t = cleanType(r.type);
    return t && matcher.match.some((kw) => t.includes(kw));
  });
  const clean = matched.filter((r) => {
    const t = cleanType(r.type);
    return !matcher.avoid.some((kw) => t.includes(kw));
  });
  // Fail closed when only avoid-listed siblings matched (see header).
  if (clean.length === 0) return { row: null, matchedType: null };

  clean.sort((a, b) => {
    const prefA = matcher.preferComparison && cleanType(a.comparison) === matcher.preferComparison ? 0 : 1;
    const prefB = matcher.preferComparison && cleanType(b.comparison) === matcher.preferComparison ? 0 : 1;
    if (prefA !== prefB) return prefA - prefB;
    return cleanType(a.type).length - cleanType(b.type).length;
  });
  const row = clean[0];
  return { row, matchedType: String(row.type || '') };
}

/**
 * Join macroCalendar events to their EODHD operand rows.
 * @returns {Array<{ event: object, operands: {actual, estimate, previous}|null, matchedType: string|null }>}
 *   `operands` carries EODHD's RAW values (number-or-string; parse authority
 *   is econPrintVerifier). null when no row matched.
 */
export function joinOperandsToEvents(macroEvents, rows) {
  return macroEvents.map((event) => {
    const { row, matchedType } = selectOperandRow(event, rows);
    if (!row) return { event, operands: null, matchedType: null };
    return {
      event,
      matchedType,
      operands: {
        actual: row.actual ?? null,
        estimate: row.estimate ?? null,
        previous: row.previous ?? null,
      },
    };
  });
}

// ── Release-time settle gate (R-B1a ii) ──────────────────────────────────

/** '8:30 AM ET' → minutes since ET midnight (510). null when unparseable. */
export function parseEtTimeToMinutes(timeStr) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET$/i.exec(String(timeStr || '').trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(m[2]);
}

/** Minutes since ET midnight for an instant (Intl, America/New_York — §6). */
export function etMinutesOfDay(instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return (get('hour') % 24) * 60 + get('minute');
}

/**
 * Has this event's release settled (release time + SETTLE_DELAY_MINUTES)?
 * Prior-day events are always settled; an event whose `time` cannot be
 * parsed falls back to settled-if-released (the actual-present data gate
 * still applies upstream).
 */
export function isSettled(macroEvent, instant, todayET) {
  if (macroEvent.date < todayET) return true;
  if (macroEvent.date > todayET) return false;
  const releaseMin = parseEtTimeToMinutes(macroEvent.time);
  if (releaseMin === null) return true;
  return etMinutesOfDay(instant) >= releaseMin + SETTLE_DELAY_MINUTES;
}

// ── The fetch ────────────────────────────────────────────────────────────

/**
 * Fetch raw EODHD economic-events rows for [fromDate, toDate] (inclusive,
 * YYYY-MM-DD, US only). Throws on hard failure — the caller maps a throw to
 * the `fetch_failed` skip code (R-B6). Returns [] on a quiet window.
 */
export async function fetchEconomicEventsEODHD({ fromDate, toDate }) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error('EODHD_API_KEY not configured');
  }
  const url =
    `https://eodhd.com/api/economic-events?api_token=${apiKey}` +
    `&fmt=json&country=US&from=${fromDate}&to=${toDate}&limit=1000`;
  const response = await fetch(url);
  if (!response.ok) {
    // 402/403/404 here is the R-B1 plan-availability contingency surfacing
    // at runtime — same taxonomy code, loud status for the log grep.
    throw new Error(`EODHD economic-events responded HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('EODHD economic-events response is not an array');
  }
  return data;
}
