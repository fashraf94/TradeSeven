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

// Category → feed `type` mapping — EXACT-equality positive rules, founder-
// ruled against the Jul 30 2026 capture artifacts (docs/
// ECON_CAPTURE_FINDINGS_AND_MATCHER_RULINGS_JUL30_2026.md §1; artifacts at
// api/_utils/__fixtures__/econCapture*.json). The original substring/
// avoid-list mechanism is retired: a row matches only when its cleaned
// `type` EQUALS an accepted name AND (where the category's conventional
// unit requires it, memo §3.1) its `comparison` equals the required axis —
// so sibling prints (Core CPI, Retail Sales Ex Autos, ISM sub-indices,
// index-level CPI/PPI rows, Fed speeches) are structurally excluded, not
// filtered. The negative rules live as tests against the literal observed
// strings (fetchEconomicEventsEODHD.test.js).
//
// Comparison keying (memo §3.1; duplicate `type` rows differ only by
// `comparison` — e.g. Inflation Rate mom/yoy, CPI index-level cmp=null):
//   CPI → 'Inflation Rate' @ yoy   (founder-ruled: the YoY headline % is
//                                   the figure "CPI came in at X%" means)
//   PPI → 'Producer Price Index' @ yoy — the observed mom row carries NO
//         estimate (capture, Jul 15: mom a=-0.3 e=null; yoy a=5.5 e=6.2),
//         so yoy is the verifiable print, consistent with CPI's ruling
//   PCE → 'PCE Price Index' @ mom · GDP → 'GDP Growth Rate' @ qoq ·
//   Retail Sales → 'Retail Sales' @ mom  (the conventional prints)
//
// Absent categories (memo §2): JOLTS is DROPPED from the Tier-1 arrays
// (macroCalendar.js carries the reason) and has no entry here.
// Productivity keeps its array entry but is deliberately UNMAPPED until an
// August-window capture confirms its feed representation — unmapped means
// operands never match, so the category cannot mis-fire while unverified.
export const ECON_CATEGORY_MATCHERS = Object.freeze({
  'FOMC': Object.freeze({
    types: Object.freeze(['fed interest rate decision']), requiredComparison: null,
  }),
  'CPI': Object.freeze({
    types: Object.freeze(['inflation rate']), requiredComparison: 'yoy',
  }),
  'PPI': Object.freeze({
    types: Object.freeze(['producer price index']), requiredComparison: 'yoy',
  }),
  'PCE': Object.freeze({
    types: Object.freeze(['pce price index']), requiredComparison: 'mom',
  }),
  'GDP': Object.freeze({
    types: Object.freeze(['gdp growth rate']), requiredComparison: 'qoq',
  }),
  'Retail Sales': Object.freeze({
    types: Object.freeze(['retail sales']), requiredComparison: 'mom',
  }),
  'NFP': Object.freeze({
    types: Object.freeze(['non farm payrolls']), requiredComparison: null,
  }),
  // ISM Services is ONE survey under TWO feed labels (memo §3.3) — accept
  // either; types[] order is the preference when a day carries both, and
  // selection returns exactly one row so the survey is never double-counted.
  'ISM Manufacturing': Object.freeze({
    types: Object.freeze(['ism manufacturing pmi']), requiredComparison: null,
  }),
  'ISM Services': Object.freeze({
    types: Object.freeze(['ism services pmi', 'ism non manufacturing pmi']), requiredComparison: null,
  }),
  'Consumer Confidence': Object.freeze({
    types: Object.freeze(['cb consumer confidence']), requiredComparison: null,
  }),
  'Jobless Claims': Object.freeze({
    types: Object.freeze(['initial jobless claims']), requiredComparison: null,
  }),
});

/** Lowercase, hyphens→spaces, collapse whitespace — the equality basis
 *  ('ISM Non-Manufacturing PMI' ≡ 'ism non manufacturing pmi'). */
function cleanType(typeStr) {
  return String(typeStr || '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Feed timestamps are timezone-naive UTC strings ('2026-07-29 18:00:00' =
 * 2:00 PM ET FOMC — capture memo §0). Parse AS UTC, never local: the UTC
 * calendar date is taken from the string itself (position-fixed, machine-
 * TZ-independent by construction), and every Tier-1 release hour
 * (8:30 AM–4:30 PM ET) keeps the UTC and ET calendar dates equal, so the
 * date-equality join against the ET-dated arrays is sound.
 */
export function rowDateOnly(row) {
  const m = /^(\d{4}-\d{2}-\d{2})([T ]|$)/.exec(String(row?.date || ''));
  return m ? m[1] : null;
}

/**
 * Select the operand row for ONE macroCalendar event from the fetched rows.
 * Date equality with the array event is mandatory (R-A1: arrays own dates);
 * then cleaned-`type` EXACT equality against the accepted names, and
 * `comparison` equality where the category keys on it. Deterministic:
 * survivors order by types[] preference (the ISM dual-name rule), first
 * wins — exactly one row per event, never a double count.
 *
 * @returns {{ row: object|null, matchedType: string|null }}
 */
export function selectOperandRow(macroEvent, rows) {
  const matcher = ECON_CATEGORY_MATCHERS[macroEvent.category];
  if (!matcher || !Array.isArray(rows)) return { row: null, matchedType: null };

  const candidates = rows.filter((r) =>
    rowDateOnly(r) === macroEvent.date
    && matcher.types.includes(cleanType(r.type))
    && (matcher.requiredComparison === null
      || cleanType(r.comparison) === matcher.requiredComparison));
  if (candidates.length === 0) return { row: null, matchedType: null };

  candidates.sort((a, b) =>
    matcher.types.indexOf(cleanType(a.type)) - matcher.types.indexOf(cleanType(b.type)));
  const row = candidates[0];
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
