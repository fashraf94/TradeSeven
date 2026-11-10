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

/**
 * The session's eligible events: every TIMED event dated `etDate`, by id. A plan line's
 * eventId must be a key of this map (else `event_unknown`); an untimed one is never in it
 * (`event_untimed` is reported by the validator from the strip list).
 *
 * @param {{ etDate: string, macroEvents?: object[], earnings?: object[] }} p
 * @returns {{ eligible: Map<string, object>, strip: object[], untimedIds: Set<string> }}
 */
export function buildSessionEvents({ etDate, macroEvents = [], earnings = [] }) {
  const strip = [
    ...(Array.isArray(macroEvents) ? macroEvents : []).map(macroEventOf),
    ...(Array.isArray(earnings) ? earnings : []).map(earningsEventOf),
  ].filter((e) => e && e.etDate === etDate);
  strip.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  const eligible = new Map();
  for (const e of strip) if (e.timed && e.eventId) eligible.set(e.eventId, e);
  // An untimed event's would-be id, so a line naming one is told it is untimed, not unknown.
  const untimedIds = new Set();
  for (const e of strip) {
    if (e.timed) continue;
    if (e.source === 'earnings') {
      untimedIds.add(`earn:${e.symbol}:${e.etDate}:bmo`);
      untimedIds.add(`earn:${e.symbol}:${e.etDate}:amc`);
    }
  }
  return { eligible, strip, untimedIds };
}
