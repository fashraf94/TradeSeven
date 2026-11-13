// src/components/Research/Sheet/battleChart.js
//
// THE BATTLE CHART (build prompt of Nov 13, 2026, BC2-1 – BC2-5; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md §12). PURE.
//
// The research sheet's record (packs.recordPinsOf: the entry, the calls, the
// answers, the check) used to sit on the DAILY chart, placed by day, so a
// one-day battle piled every dot onto today's bar. The Battle pill draws the
// battle's own trading sessions in intraday bars and places each marker on the
// bar that holds its instant.
//
//   battleSpecOf     the battle's sessions (timing.tradingDays, ET dates) up to
//                    today, and the bar size: one trading day → 5-minute bars,
//                    two or more → 30-minute bars (💣's series, the same request)
//   battleCandlesOf  the provider's bars (newest-first) → the regular-session
//                    bars of those sessions up to now, oldest-first
//   barTimeOf        the bar that holds an instant: the last bar starting at or
//                    before it; an instant before the first bar (an overnight
//                    entry, its fill quote's time) → the first bar
//   dayMarkersOf     1D / 1W: one marker per day, with its count

import { etDate, etWeekday } from '../BombMode/checkClock.js';
import { getSessionForDate } from '../../../utils/marketCalendar.js';
import { rungShown } from '../BombMode/ladder.js';
import { priceDecimals } from '../priceFormat.js';
import { SHEET_COPY } from './sheetCopy.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => finite(v) && v > 0;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The bar sizes and the days each request asks for (a fixed `days`: the server's cache key is symbol|timeframe|days). */
export const BATTLE_BARS = Object.freeze({
  // One session: five calendar days back covers a Monday after a weekend and a holiday.
  '5m': Object.freeze({ timeframe: '5m', days: 5, minutes: 5 }),
  // 💣's own request (useResearchData: timeframe '30m', bombDays 20) — the same client and server cache.
  '30m': Object.freeze({ timeframe: '30m', days: 20, minutes: 30 }),
});

/** The regular session, in ET minutes after midnight: 9:30 to 16:00 (bars starting in [570, 960)). */
export const SESSION_OPEN_MIN = 570;
export const SESSION_CLOSE_MIN = 960;

/** ET minutes after midnight of an instant. */
export function etMinutesOf(ms) {
  if (!finite(ms)) return null;
  const [h, m] = etClock24(ms).split(':').map(Number);
  return h * 60 + m;
}
const ET_24 = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function etClock24(ms) {
  return ET_24.format(new Date(ms));
}

/**
 * The Battle pill's spec, or null when the battle names no sessions (no pill).
 * @returns {{ days: string[], barSize: '5m'|'30m', bars: object }|null}
 */
export function battleSpecOf(battle, nowMs) {
  const all = Array.isArray(battle?.timing?.tradingDays) ? battle.timing.tradingDays.filter((d) => typeof d === 'string' && ISO_DAY.test(d)) : [];
  if (!all.length || !finite(nowMs)) return null;
  const today = etDate(nowMs);
  const days = [...new Set(all)].sort().filter((d) => d <= today);
  if (!days.length) return null;
  const barSize = new Set(all).size <= 1 ? '5m' : '30m';
  return { days, barSize, bars: BATTLE_BARS[barSize] };
}

/** A provider bar's start instant in ms (its unix `timestamp`, else its ISO date). */
function barMs(c) {
  if (finite(c?.timestamp)) return c.timestamp * 1000;
  const s = c?.datetime || c?.date;
  if (typeof s !== 'string' || !s.includes('T')) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The provider's bars → the Battle chart's: regular session, the battle's sessions only, started by now,
 * oldest-first, in the research chart's bar shape ({ date (ISO), timestamp (s), open, high, low, close, volume }).
 * A bar with no time of day (a daily fallback) is never one of them.
 */
export function battleCandlesOf(raw, { days, nowMs }) {
  if (!Array.isArray(raw) || !Array.isArray(days) || !days.length || !finite(nowMs)) return [];
  // Each day's own session from the market calendar (an early close ends at 1:00 PM ET — PR 2 review A3);
  // the fixed 9:30–16:00 where the calendar does not cover the year.
  const sessions = new Map(days.map((d) => [d, getSessionForDate(d)]));
  const out = [];
  for (const c of raw) {
    const ms = barMs(c);
    if (ms === null || ms > nowMs) continue;
    const day = etDate(ms);
    if (!sessions.has(day)) continue;
    const s = sessions.get(day);
    if (s && s.isTradingDay && finite(s.openMs) && finite(s.closeMs)) {
      if (ms < s.openMs || ms >= s.closeMs) continue;
    } else {
      const min = etMinutesOf(ms);
      if (min === null || min < SESSION_OPEN_MIN || min >= SESSION_CLOSE_MIN) continue;
    }
    const [open, high, low, close] = [c.open, c.high, c.low, c.close].map(Number);
    if (![open, high, low, close].every(positive)) continue;
    out.push({ date: new Date(ms).toISOString(), timestamp: Math.floor(ms / 1000), open, high, low, close, volume: Number(c.volume) || 0 });
  }
  out.sort((a, b) => a.timestamp - b.timestamp);
  return out.filter((c, i) => i === 0 || c.timestamp !== out[i - 1].timestamp);
}

/**
 * BC2-3 — the bar that holds an instant, as the chart's time (seconds): the last bar starting at or
 * before it (an instant after the close, or between two sessions, sits on the last bar before it); an
 * instant before the first bar sits on the first. `barTimes` ascending seconds. Null with no bars.
 */
export function barTimeOf(atMs, barTimes) {
  if (!finite(atMs) || !Array.isArray(barTimes) || !barTimes.length) return null;
  const t = Math.floor(atMs / 1000);
  let lo = 0;
  let hi = barTimes.length - 1;
  if (t < barTimes[0]) return barTimes[0];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (barTimes[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return barTimes[lo];
}

/** "Fri" — the ET weekday of an ET date 'YYYY-MM-DD' (noon UTC is that date in ET). */
export function weekdayOfDay(day) {
  return typeof day === 'string' && ISO_DAY.test(day) ? etWeekday(Date.parse(`${day}T16:00:00Z`)) : null;
}

/**
 * BC2-3 — 1D and 1W: a day's markers merge into one, with its count. Each { day, count, ids, latestId }:
 * `ids` the merged markers' ids, `latestId` the day's latest marker (the one a single-marker day shows).
 * Days in time order.
 */
export function dayMarkersOf(markers) {
  const byDay = new Map();
  for (const m of Array.isArray(markers) ? markers : []) {
    if (!m || typeof m.day !== 'string' || !finite(m.atMs)) continue;
    const g = byDay.get(m.day) ?? { day: m.day, count: 0, ids: [], latestId: null, latestMs: -Infinity };
    g.count += 1;
    g.ids.push(m.id);
    if (m.atMs >= g.latestMs) { g.latestMs = m.atMs; g.latestId = m.id; }
    byDay.set(m.day, g);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)).map(({ latestMs, ...g }) => g);
}

/**
 * BC2-5 — the next rung each way as price lines on Battle, at Bomb mode's DISPLAYED prices
 * (ladder.rungShown at the live price's decimals — the strings 💣 prints, BUILD_RULES §9), for a held
 * measured stock's ladder only (the caller passes null for a preview, legacy or crypto).
 * @returns {Array<{ id, kind, price, label, group: 'rung' }>}
 */
export function rungLinesOf(ladder, live) {
  if (!ladder || ladder.status !== 'ok' || ladder.kind !== 'held' || ladder.model !== 'measured' || !positive(live)) return [];
  const d = priceDecimals(live);
  const out = [];
  if (ladder.next) {
    const price = rungShown(ladder.next, d);
    if (positive(price)) out.push({ id: 'rung_up', kind: 'rung_up', price, label: SHEET_COPY.lineRungUp(ladder.next.points, price, d), group: 'rung' });
  }
  if (ladder.nextDown) {
    const price = rungShown(ladder.nextDown, d);
    if (positive(price)) out.push({ id: 'rung_down', kind: 'rung_down', price, label: SHEET_COPY.lineRungDown(ladder.nextDown.label, ladder.nextDown.points, price, d), group: 'rung' });
  }
  return out;
}
