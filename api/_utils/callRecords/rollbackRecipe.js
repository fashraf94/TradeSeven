// api/_utils/callRecords/rollbackRecipe.js
//
// Cockpit Build 1a — THE ROLLBACK RECIPE (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md
// §12; Astra B1R-6 / B1R2 §4 "Rollback measurement"), the pure measurement the
// read script (scripts/shadow-read-call-records.mjs --calls-enabled-window)
// reports. Read-only; the founder decides.
//
//   Window     the last FIVE regular ET sessions that carry calls-enabled model
//              calls (ET dates that are trading days per the calendar, with at
//              least one qualifying entry; weekend crypto checks fall on
//              non-trading dates and are excluded).
//   Membership an evaluation entry with `declarationsPhase` PRESENT (the check
//              ran at shadow / on) AND a finite `callMs` (a model request was
//              actually dispatched — the stamp alone also lands on budget /
//              no-model entries).
//   Numerator  `haikuError.failureClass === 'invalid_tool_result'`.
//   Trip       rate > 3 %. Zero data → no trip. The retained-window coverage
//              is reported: a battle whose evaluations[] is at the 150-entry
//              cap has a truncated history, so the window may undercount.

import { getSessionForDate } from '../marketSchedule.js';
import { etDateOf } from './horizon.js';

export const ROLLBACK_SESSIONS = 5;
export const ROLLBACK_TRIP_RATE = 0.03;
export const EVALUATIONS_RETENTION_CAP = 150;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Does this evaluation entry count as a calls-enabled model call? */
export function isCallsEnabledModelCall(entry) {
  return !!entry && typeof entry === 'object' && 'declarationsPhase' in entry && entry.declarationsPhase !== undefined && finite(entry.callMs);
}

/** The entry's instant: the stamped timestamp, else its promptBuiltAt. */
function entryMs(entry) {
  for (const v of [entry?.timestamp, entry?.promptBuiltAt]) {
    if (typeof v === 'number' && finite(v)) return v;
    if (typeof v === 'string') { const ms = Date.parse(v); if (finite(ms)) return ms; }
    if (v && typeof v.toMillis === 'function') return v.toMillis();
  }
  return null;
}

/** Is the ET date a regular trading session? (A calendar outside its maintained years says null → not counted.) */
export function isRegularSessionDate(etDate) {
  const s = getSessionForDate(etDate);
  return !!s && s.isTradingDay === true;
}

/**
 * The recipe over a set of battles (`{ id, evaluations }` objects, a Map of
 * them, or an array). Pure.
 *
 * @returns {{ sessions: number, days: string[], modelCalls: number, invalid: number, rate: number|null, tripped: boolean, zeroData: boolean,
 *            perDay: Array<{ day: string, modelCalls: number, invalid: number }>, coverage: { battles: number, battlesInWindow: number, truncatedBattles: string[] } }}
 */
export function computeCallsEnabledWindow(battles, { sessions = ROLLBACK_SESSIONS, tripRate = ROLLBACK_TRIP_RATE } = {}) {
  const list = battles instanceof Map ? [...battles.entries()].map(([id, b]) => ({ id, ...b })) : (Array.isArray(battles) ? battles : []);
  const perDay = new Map(); // etDate → { modelCalls, invalid, battles: Set }
  const truncated = [];
  for (const b of list) {
    const evaluations = Array.isArray(b?.evaluations) ? b.evaluations : [];
    if (evaluations.length >= EVALUATIONS_RETENTION_CAP) truncated.push(b.id ?? '?');
    for (const e of evaluations) {
      if (!isCallsEnabledModelCall(e)) continue;
      const ms = entryMs(e);
      if (ms === null) continue;
      const day = etDateOf(ms);
      if (!isRegularSessionDate(day)) continue;
      const row = perDay.get(day) ?? { day, modelCalls: 0, invalid: 0, battles: new Set() };
      row.modelCalls += 1;
      if (e?.haikuError?.failureClass === 'invalid_tool_result') row.invalid += 1;
      row.battles.add(b.id ?? '?');
      perDay.set(day, row);
    }
  }
  const days = [...perDay.keys()].sort().slice(-sessions);
  const rows = days.map((d) => perDay.get(d));
  const modelCalls = rows.reduce((s, r) => s + r.modelCalls, 0);
  const invalid = rows.reduce((s, r) => s + r.invalid, 0);
  const zeroData = modelCalls === 0;
  const rate = zeroData ? null : invalid / modelCalls;
  const battlesInWindow = new Set(rows.flatMap((r) => [...r.battles])).size;
  return {
    sessions,
    days,
    modelCalls,
    invalid,
    rate,
    tripped: !zeroData && rate > tripRate,
    zeroData,
    perDay: rows.map((r) => ({ day: r.day, modelCalls: r.modelCalls, invalid: r.invalid })),
    coverage: { battles: list.length, battlesInWindow, truncatedBattles: truncated },
  };
}

/** The recipe's lines for the read script's Markdown report. */
export function renderCallsEnabledWindow(result) {
  const pct = (v) => (v === null ? 'n/a' : `${(100 * v).toFixed(2)}%`);
  const lines = [
    `- Window: the last ${result.sessions} regular ET sessions with calls-enabled model calls — ${result.days.length ? result.days.join(', ') : 'none'}.`,
    `- Membership: entries with \`declarationsPhase\` present AND a finite \`callMs\` (a dispatched model request).`,
    `- Model calls ${result.modelCalls}; \`invalid_tool_result\` ${result.invalid}; rate ${pct(result.rate)}; trip at > 3 %: **${result.zeroData ? 'NO DATA (no trip)' : result.tripped ? 'TRIPPED' : 'PASS'}**.`,
    `- Coverage: ${result.coverage.battlesInWindow} of ${result.coverage.battles} battles in the window; ${result.coverage.truncatedBattles.length} at the 150-entry retention cap${result.coverage.truncatedBattles.length ? ` (${result.coverage.truncatedBattles.join(', ')})` : ''} — a truncated history may undercount.`,
  ];
  return lines.join('\n');
}
