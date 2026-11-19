// src/components/Research/ChartRead/placeMarks.js
//
// The Chart view's read — WHERE EACH MARK SITS (MK-5; spec docs/specs/CHART_READ_SPEC_V1.md). A mark carries the
// record's own date; this finds the chart's bar for it. 1D: the bar of that day. 1W: the week bar holding that
// day (the StockChart record-pin rule). Mark 3 (the 50-day five sessions ago) sits five sessions before the
// record's day, counted on the daily series' own dates — the same count on 1D and 1W. A date with no bar on the
// chart draws nothing (never a nearest guess). Positions only: no value is read or changed here. Pure.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A daily/weekly chart time is a local-midnight parse of a calendar date (chartUtils.formatTime); this recovers it. */
export const calendarDateOf = (time) => {
  const d = new Date(time * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The Monday (YYYY-MM-DD) of the week holding a date. */
export const weekStartOf = (dateKey) => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/** The date `back` sessions before `day` on the daily series (newest first), or null. */
export function sessionsBefore(day, back, dailyDates) {
  if (!Array.isArray(dailyDates)) return null;
  const i = dailyDates.indexOf(day);
  if (i < 0 || i + back >= dailyDates.length) return null;
  const d = dailyDates[i + back];
  return typeof d === 'string' && DATE_RE.test(d) ? d : null;
}

/**
 * The scene for the chart's primitive: each SHOWN mark placed on its bar, lit or not.
 * @param {{ marks: object[], shown: number[], lit: number[], barTimes: number[], timeframe: '1D'|'1W', dailyDates?: string[]|null }} p
 * @returns {Array<{ n, id, kind, time, value, lit, times? }>}
 */
export function placeMarks({ marks, shown, lit, barTimes, timeframe, dailyDates = null }) {
  if (timeframe !== '1D' && timeframe !== '1W') return [];
  const times = Array.isArray(barTimes) ? barTimes : [];
  const byDay = new Map();
  const byWeek = new Map();
  for (const t of times) {
    const day = calendarDateOf(t);
    byDay.set(day, t);
    if (!byWeek.has(weekStartOf(day))) byWeek.set(weekStartOf(day), t);
  }
  const barOf = (day) => {
    if (typeof day !== 'string' || !DATE_RE.test(day)) return null;
    return (timeframe === '1W' ? byWeek.get(weekStartOf(day)) : byDay.get(day)) ?? null;
  };
  const show = new Set(shown || []);
  const on = new Set(lit || []);
  const out = [];
  for (const m of marks || []) {
    if (!show.has(m.n)) continue;
    const day = m.sessionsBack ? sessionsBefore(m.day, m.sessionsBack, dailyDates) : m.day;
    const time = barOf(day);
    if (time == null) continue;
    const item = { n: m.n, id: m.id, kind: m.kind, time, value: m.value, lit: on.has(m.n) };
    if (m.kind === 'bracket') {
      const ts = (m.days || []).map(barOf);
      if (ts.length !== 3 || ts.some((t) => t == null)) continue;
      item.times = ts;
    }
    out.push(item);
  }
  return out;
}
