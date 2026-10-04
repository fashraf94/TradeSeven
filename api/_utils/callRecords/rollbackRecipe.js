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

//
// Cockpit Build 2a — THE LIVE ROLLBACK CHECK (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-9; founder ruling R2A-19), reported
// under the read script's --rollback-check, over the ALLOWLISTED owners'
// battles only (the server-side allowlist, allowlist.js). Its own window, not
// the recipe's (review L1-1):
//   Window     the last FIVE regular ET sessions BY THE CALENDAR, ending at the
//              run's own ET date — never "the last five with data", which can
//              reach back any distance.
//   Floor      no session before ROLLBACK_CHECK.notBefore — the first session
//              after the shadow era (CALL_RECORDS_MODE 'shadow' from the flip
//              64ecd855 to the rollback 4d8c498f, 2026-10-01), whose entries
//              carry `declarationsPhase` from the SHADOW tool text; and, with
//              --since, no entry before that instant (the flip's deploy).
//   Membership the recipe's (`declarationsPhase` present, a finite `callMs`).
// It TRIPS only when all three hold:
//   1. total ≥ 150 calls-enabled model calls (a minimum sample);
//   2. rate > 3 %;
//   3. one-sided Fisher exact p < 0.05 against round 3's off baseline — arm A,
//      3 invalid of 386 (docs/audits/20261002_DECLARATIONS_WORDING_ROUND3.md §5.4).
// Read-only: it prints the verdict and the counts; it takes no action. An
// unset allowlist is its own verdict (NO ALLOWLIST), never "no data".

import { getSessionForDate } from '../marketSchedule.js';
import { etDateOf } from './horizon.js';

export const ROLLBACK_SESSIONS = 5;
export const ROLLBACK_TRIP_RATE = 0.03;
export const EVALUATIONS_RETENTION_CAP = 150;

/** The live check's three bars (S-9), its baseline — round 3's arm A (the off text) — and its floor. */
export const ROLLBACK_CHECK = Object.freeze({
  minTotal: 150,
  tripRate: 0.03,
  alpha: 0.05,
  baseline: Object.freeze({ invalid: 3, total: 386, label: "round 3's off arm (A), 3 of 386" }),
  // The first regular ET session after the shadow era (the rollback 4d8c498f
  // landed 2026-10-01): earlier entries carry `declarationsPhase` from the
  // shadow tool and never count toward the live 'on' text's rate.
  notBefore: '2026-10-02',
});

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

// ---------------------------------------------------------------------------
// The live rollback check (Build 2a S-9).

const logFactTable = [0];
const logFact = (n) => {
  for (let i = logFactTable.length; i <= n; i += 1) logFactTable[i] = logFactTable[i - 1] + Math.log(i);
  return logFactTable[n];
};
const logChoose = (n, k) => logFact(n) - logFact(k) - logFact(n - k);

/**
 * One-sided Fisher exact test — P(live invalid ≥ observed) under the
 * hypergeometric null, for the 2×2 table [live invalid, live valid; baseline
 * invalid, baseline valid]. The same tail round 3 computed
 * (scripts/declarations-wording-experiment.mjs fisherOneSidedGreater;
 * rollbackRecipe.test.js holds the two equal on a grid). Integers only.
 */
export function fisherOneSidedGreater(liveBad, liveN, refBad, refN) {
  for (const v of [liveBad, liveN, refBad, refN]) {
    if (!Number.isInteger(v) || v < 0) throw new Error('fisherOneSidedGreater: counts must be non-negative integers');
  }
  if (liveBad > liveN || refBad > refN) throw new Error('fisherOneSidedGreater: a count exceeds its total');
  const K = liveBad + refBad;
  const N = liveN + refN;
  let p = 0;
  for (let k = liveBad; k <= Math.min(K, liveN); k += 1) p += Math.exp(logChoose(K, k) + logChoose(N - K, liveN - k) - logChoose(N, liveN));
  return Math.min(1, p);
}

/** The calendar date before an ET date string — date arithmetic only, no clock. */
function previousDate(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
}

/**
 * The last `sessions` regular ET sessions BY THE CALENDAR, ending at the ET
 * date of `nowMs` (inclusive when it is a session), oldest first. A walk of
 * at most 40 days (a calendar outside its maintained years yields fewer).
 */
export function lastRegularSessions(nowMs, sessions = ROLLBACK_SESSIONS) {
  if (!finite(nowMs)) return [];
  const days = [];
  let day = etDateOf(nowMs);
  for (let i = 0; i < 40 && days.length < sessions; i += 1) {
    if (isRegularSessionDate(day)) days.unshift(day);
    day = previousDate(day);
  }
  return days;
}

/**
 * The live check over the allowlisted owners' battles. Pure.
 *
 * @param {object[]|Map} battles   `{ id, ownerId, evaluations }` (or a Map id → data)
 * @param {object} p
 * @param {string[]} p.allowlist   the admitted owner uids (allowlist.js readCockpitAllowlist())
 * @param {number} [p.nowMs]       the run's instant — the window ends at its ET date
 * @param {number|null} [p.sinceMs] --since: no entry before this instant (the flip's deploy)
 * @param {string} [p.notBefore]   no session before this ET date (default: the end of the shadow era)
 * @returns {{ owners: number, battles: number, window: object, total: number, invalid: number, rate: number|null,
 *            p: number|null, bars: { minSample: boolean, rate: boolean, significant: boolean }, tripped: boolean,
 *            verdict: 'TRIP'|'NO TRIP'|'NO DATA'|'NO ALLOWLIST' }}
 */
export function computeRollbackCheck(battles, {
  allowlist, nowMs = Date.now(), sinceMs = null, notBefore = ROLLBACK_CHECK.notBefore, sessions = ROLLBACK_SESSIONS, check = ROLLBACK_CHECK,
} = {}) {
  const owners = new Set((Array.isArray(allowlist) ? allowlist : []).filter((u) => typeof u === 'string' && u.length > 0));
  const list = battles instanceof Map ? [...battles.entries()].map(([id, b]) => ({ id, ...b })) : (Array.isArray(battles) ? battles : []);
  const admitted = list.filter((b) => typeof b?.ownerId === 'string' && owners.has(b.ownerId));
  const days = lastRegularSessions(nowMs, sessions).filter((d) => typeof notBefore !== 'string' || d >= notBefore);
  const perDay = new Map(days.map((d) => [d, { day: d, modelCalls: 0, invalid: 0 }]));
  const floorMs = finite(sinceMs) ? sinceMs : -Infinity;
  const truncatedBattles = [];
  for (const b of admitted) {
    const evaluations = Array.isArray(b?.evaluations) ? b.evaluations : [];
    if (evaluations.length >= EVALUATIONS_RETENTION_CAP) truncatedBattles.push(b.id ?? '?');
    for (const e of evaluations) {
      if (!isCallsEnabledModelCall(e)) continue;
      const ms = entryMs(e);
      if (ms === null || ms < floorMs || ms > nowMs) continue;
      const row = perDay.get(etDateOf(ms));
      if (!row) continue;
      row.modelCalls += 1;
      if (e?.haikuError?.failureClass === 'invalid_tool_result') row.invalid += 1;
    }
  }
  const rows = days.map((d) => perDay.get(d));
  const window = {
    days, notBefore, sinceMs: finite(sinceMs) ? sinceMs : null,
    perDay: rows,
    coverage: { battles: admitted.length, truncatedBattles },
  };
  const total = rows.reduce((s, r) => s + r.modelCalls, 0);
  const invalid = rows.reduce((s, r) => s + r.invalid, 0);
  const rate = total > 0 ? invalid / total : null;
  const p = total > 0 ? fisherOneSidedGreater(invalid, total, check.baseline.invalid, check.baseline.total) : null;
  const bars = {
    minSample: total >= check.minTotal,
    rate: rate !== null && rate > check.tripRate,
    significant: p !== null && p < check.alpha,
  };
  const tripped = bars.minSample && bars.rate && bars.significant;
  return {
    owners: owners.size,
    battles: admitted.length,
    window,
    total,
    invalid,
    rate,
    p,
    bars,
    tripped,
    verdict: owners.size === 0 ? 'NO ALLOWLIST' : (total === 0 ? 'NO DATA' : (tripped ? 'TRIP' : 'NO TRIP')),
  };
}

/** The live check's plain lines (the verdict first, then every count and bar). */
export function renderRollbackCheck(result, { check = ROLLBACK_CHECK } = {}) {
  const pct = (v) => (v === null ? 'n/a' : `${(100 * v).toFixed(2)}%`);
  const yes = (b) => (b ? 'met' : 'not met');
  // A Vercel environment change reaches only NEW deployments: removing the uid
  // takes effect when production is redeployed (review L1-2).
  const action = {
    TRIP: ' — remove the uid from COCKPIT_ALLOWLIST_UIDS, redeploy production, and report (spec §10.4).',
    'NO ALLOWLIST': ' — COCKPIT_ALLOWLIST_UIDS is not set in this shell or .env.local; nothing was measured.',
  }[result.verdict] ?? '';
  const floor = `not before ${result.window.notBefore ?? '—'}${result.window.sinceMs !== null && result.window.sinceMs !== undefined ? `, since ${new Date(result.window.sinceMs).toISOString()}` : ''}`;
  return [
    `- Verdict: **${result.verdict}**${action}`,
    `- Allowlisted owners ${result.owners}; their battles ${result.battles}; window ${result.window.days.length ? result.window.days.join(', ') : 'none'} (the last ${ROLLBACK_SESSIONS} regular sessions by the calendar, ${floor}).`,
    `- invalid_tool_result ${result.invalid} of ${result.total} calls-enabled model calls (rate ${pct(result.rate)}).`,
    `- Bars (all three must hold to trip): total ≥ ${check.minTotal} — ${yes(result.bars.minSample)}; rate > ${(100 * check.tripRate).toFixed(0)} % — ${yes(result.bars.rate)}; one-sided Fisher p < ${check.alpha} against ${check.baseline.label} — ${yes(result.bars.significant)} (p = ${result.p === null ? 'n/a' : result.p.toFixed(4)}).`,
    `- Coverage: ${result.window.coverage.truncatedBattles.length} of the allowlisted battles at the 150-entry retention cap — a truncated history may undercount.`,
  ].join('\n');
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
