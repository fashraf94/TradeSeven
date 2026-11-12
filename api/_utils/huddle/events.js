// api/_utils/huddle/events.js
//
// Huddle S1 — DETERMINISTIC EVENT IDS AND THEIR FIXED LABELS (spec V1.1 §4.3, Astra
// AR-1; Amendment C V1.2 §C11). An event a plan line may name is built by code from
// the structured calendar objects, never from a model label:
//   macro:{kind}:{etDate}:{HHmm}       from the macro calendar module's event objects
//                                      (api/_utils/macroCalendar.js MacroEvent)
//   earn:{SYMBOL}:{etDate}:{bmo|amc}   from the earnings parser (evidence/earnings.js),
//                                      keyed by the ANNOUNCEMENT date (report_date, C11)
// An untimed event (a macro event with no parseable time; an earnings row with no
// BMO/AMC label) has no id at all and is never eligible for NO_ADDS_BEFORE. Labels
// come from fixed formatters over code-owned fields: "the 10:00 AM ET ISM
// Manufacturing data", "AAA's report after the close". Pure; ZERO imports.
//
// EARNINGS NEVER FREEZE THE BOOK (Amendment E §E2). NO_ADDS_BEFORE is eligible only for
// an event whose time falls INSIDE today's regular session — an intraday macro print such
// as a 10:00 AM ET release — by the session's own window (an early close included); the
// open is inside, the close is not. Earnings, before the open or after the close, are never
// eligible: a line naming one drops with `event_outside_session`. A name that reports after
// today's close or before the next session's open is what the new line
// NO_ADDS_TO_BEFORE_REPORT names (`reportTickers`; untimed rows are ineligible).

/** The fixed words for each macro category (macroCalendar.js header). A category not listed has no event. */
export const MACRO_KIND = Object.freeze({
  FOMC: Object.freeze({ kind: 'fomc', label: 'FOMC decision' }),
  NFP: Object.freeze({ kind: 'nfp', label: 'jobs report' }),
  CPI: Object.freeze({ kind: 'cpi', label: 'CPI data' }),
  PPI: Object.freeze({ kind: 'ppi', label: 'PPI data' }),
  PCE: Object.freeze({ kind: 'pce', label: 'PCE data' }),
  'Retail Sales': Object.freeze({ kind: 'retail_sales', label: 'retail sales data' }),
  GDP: Object.freeze({ kind: 'gdp', label: 'GDP data' }),
  Productivity: Object.freeze({ kind: 'productivity', label: 'productivity data' }),
  JOLTS: Object.freeze({ kind: 'jolts', label: 'JOLTS data' }),
  'ISM Manufacturing': Object.freeze({ kind: 'ism_manufacturing', label: 'ISM manufacturing data' }),
  'ISM Services': Object.freeze({ kind: 'ism_services', label: 'ISM services data' }),
  'Consumer Confidence': Object.freeze({ kind: 'consumer_confidence', label: 'consumer confidence data' }),
  'Jobless Claims': Object.freeze({ kind: 'jobless_claims', label: 'jobless claims data' }),
});

/** "8:30 AM ET" → { hhmm: '0830', clock: '8:30 AM ET' }; anything else → null (untimed). */
export function parseEtClock(time) {
  if (typeof time !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET$/.exec(time.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (m[3] === 'PM' && hour !== 12) hour += 12;
  if (m[3] === 'AM' && hour === 12) hour = 0;
  return {
    hhmm: `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`,
    clock: `${Number(m[1])}:${m[2]} ${m[3]} ET`,
  };
}

/** A macro calendar object → the strip event (with its id when timed), or null for a category with no fixed words. */
export function macroEventOf(ev) {
  if (!ev || typeof ev !== 'object' || typeof ev.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) return null;
  const words = Object.prototype.hasOwnProperty.call(MACRO_KIND, ev.category) ? MACRO_KIND[ev.category] : null;
  if (!words) return null;
  const clock = parseEtClock(ev.time);
  return {
    eventId: clock ? `macro:${words.kind}:${ev.date}:${clock.hhmm}` : null,
    source: 'macro',
    etDate: ev.date,
    timed: clock !== null,
    sortKey: clock ? clock.hhmm : '9999',
    label: clock ? `the ${clock.clock} ${words.label}` : `the ${words.label}`,
    impact: ev.impact === 'high' || ev.impact === 'medium' ? ev.impact : null,
  };
}

/** A parsed earnings record (evidence/earnings.js) → the strip event (with its id when BMO/AMC), keyed by reportDate. */
export function earningsEventOf(rec) {
  if (!rec || typeof rec !== 'object' || typeof rec.symbol !== 'string' || typeof rec.reportDate !== 'string') return null;
  const timed = rec.timing === 'bmo' || rec.timing === 'amc';
  return {
    eventId: timed ? `earn:${rec.symbol}:${rec.reportDate}:${rec.timing}` : null,
    source: 'earnings',
    symbol: rec.symbol,
    etDate: rec.reportDate,
    timed,
    // before the open sorts first, after the close last, an untimed report in between
    sortKey: rec.timing === 'bmo' ? '0000' : rec.timing === 'amc' ? '2359' : '9998',
    label: rec.timing === 'bmo' ? `${rec.symbol}'s report before the open`
      : rec.timing === 'amc' ? `${rec.symbol}'s report after the close`
        : `${rec.symbol}'s report (time not listed)`,
    impact: null,
  };
}

/** A macro event id's ET clock ("0930"), or null (E2: its time against the session window). */
export function hhmmOfMacroId(eventId) {
  const m = /^macro:[a-z_]+:\d{4}-\d{2}-\d{2}:(\d{4})$/.exec(typeof eventId === 'string' ? eventId : '');
  return m ? m[1] : null;
}

/** E2: is an ET clock "HHmm" inside the regular session [open, close)? No window known → false (fail closed). */
export function insideSession(hhmm, window) {
  if (typeof hhmm !== 'string' || !/^\d{4}$/.test(hhmm)) return false;
  if (!window || typeof window.open !== 'string' || typeof window.close !== 'string') return false;
  return hhmm >= window.open && hhmm < window.close;
}

const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
/** "2026-11-10" → "Tuesday" (a calendar date's own weekday; no time zone involved). */
export function weekdayOfEtDate(etDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof etDate === 'string' ? etDate : '');
  if (!m) return null;
  return WEEKDAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
}

/**
 * The session's events (E2):
 *   eligible           NO_ADDS_BEFORE's events: TIMED macro events dated `etDate` INSIDE the session window, by id;
 *   outsideSessionIds  every other timed event dated `etDate` (macro outside the window, every earnings report);
 *   untimedIds         the would-be ids of untimed earnings rows (`event_untimed`);
 *   reportTickers      NO_ADDS_TO_BEFORE_REPORT's names: a report after today's close (amc on `etDate`) or before the
 *                      next session's open (bmo on `nextEtDate`), symbol → its event;
 *   untimedReportTickers  names whose only report on those days is untimed;
 *   strip              today's events in time order, then the next session's before-the-open reports.
 *
 * @param {{ etDate: string, macroEvents?: object[], earnings?: object[], window?: { open: string, close: string }|null, nextEtDate?: string|null }} p
 */
export function buildSessionEvents({ etDate, macroEvents = [], earnings = [], window = null, nextEtDate = null }) {
  const all = [
    ...(Array.isArray(macroEvents) ? macroEvents : []).map(macroEventOf),
    ...(Array.isArray(earnings) ? earnings : []).map(earningsEventOf),
  ].filter(Boolean);
  const order = (a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
  const today = all.filter((e) => e.etDate === etDate).sort(order);
  const nextDay = weekdayOfEtDate(nextEtDate);
  const nextOpen = all.filter((e) => typeof nextEtDate === 'string' && e.source === 'earnings' && e.etDate === nextEtDate && e.eventId && e.eventId.endsWith(':bmo'))
    .map((e) => ({ ...e, label: nextDay ? `${e.symbol}'s report before ${nextDay}'s open` : `${e.symbol}'s report before the next open`, next: true }))
    .sort(order);
  const strip = [...today, ...nextOpen];
  const eligible = new Map();
  const outsideSessionIds = new Set();
  for (const e of today) {
    if (!e.timed || !e.eventId) continue;
    if (e.source === 'macro' && insideSession(e.sortKey, window)) eligible.set(e.eventId, e);
    else outsideSessionIds.add(e.eventId);
  }
  const reportTickers = new Map();
  const untimedReportTickers = new Set();
  for (const e of all) {
    if (e.source !== 'earnings') continue;
    const afterTodaysClose = e.etDate === etDate && e.timed && e.eventId.endsWith(':amc');
    const beforeNextOpen = typeof nextEtDate === 'string' && e.etDate === nextEtDate && e.timed && e.eventId.endsWith(':bmo');
    if (afterTodaysClose || beforeNextOpen) reportTickers.set(e.symbol, e);
    else if (!e.timed && (e.etDate === etDate || e.etDate === nextEtDate)) untimedReportTickers.add(e.symbol);
  }
  for (const sym of reportTickers.keys()) untimedReportTickers.delete(sym);
  // An untimed event's would-be id, so a line naming one is told it is untimed, not unknown.
  const untimedIds = new Set();
  for (const e of today) {
    if (e.timed) continue;
    if (e.source === 'earnings') {
      untimedIds.add(`earn:${e.symbol}:${e.etDate}:bmo`);
      untimedIds.add(`earn:${e.symbol}:${e.etDate}:amc`);
    }
  }
  return { eligible, strip, untimedIds, outsideSessionIds, reportTickers, untimedReportTickers };
}
