// api/_utils/filmTape/closePass.js
//
// Film Room tape — THE CLOSE PASS and THE BACKFILL (spec §5, BA-15). The cron
// handler (api/cron/film-tape-close.js) is auth + flag + wiring; everything
// here takes its database and clock as arguments so the runs are testable.
//
// SELECTION (§5): agentBattles with `status == 'active'`, plus those with
// `completedAt` on the ET date (a single-field range — no composite index;
// status is filtered here). A battle gets a tape for the date only when the
// date is one of its trading days (`timing.tradingDays`); a battle that
// completed tonight after its last session gets its final day re-merged so the
// final-day tape records the completion. flat6/tournament battles get the
// BA-3 `skipped_mode` document. BA-35: a target date that is not a session of
// the calendar (a malformed final day such as 2026-02-30, a weekend) is
// counted in `invalid` before anything reads or writes it — never a failure
// record under a malformed tape id.
//
// BUDGET: a remaining-time floor (30 s) checked before each battle, and an
// isolating try/catch per battle — a failed battle writes its failure record
// (writeTapeDay.js markCloseFailed) or, when even that fails, a console line;
// the next battle proceeds.
//
// BACKFILL (BA-15): the same writer over a date range, admin-only (the handler
// checks the secret), the same budget, RESUMABLE: the queue flag is the tape
// document's own `passes.close.status` — the only store the tape may write
// (BA-1) — so a pair already `written` (or `skipped_mode`) is skipped and a
// re-invocation of the same range continues where the last one stopped.
//
// REFRESH (BA-29 amended): the same entry with `refresh` re-merges the WRITTEN
// days in the range through writeTapeDay instead of skipping them — the
// founder's repair path for a written day whose sources grew. It is
// merge-monotone and idempotent: a day whose sources did not change writes
// nothing and is listed `unchanged`; one that changed is listed `refreshed`.
// It reopens no candle work outside the candle window: writeTapeDay's merge
// expires such a day's written candle pass and labels its output instead
// (BA-25 amended). The default backfill is
// unchanged. A refresh re-reads every written day of its range, so a refresh
// stopped by the time floor resumes by naming a range that starts at its
// `resumeFrom` date.
//
// LATE-FILED MEETINGS (Film Room B1.1, Amendment C RC-3): a meeting is filed
// into the battle's history at the check AFTER it resolves, so one created
// late on session P can reach the history only on the next session D, after
// P's tape was written. After a battle's day D is handled, the pass looks at
// P, D's previous session in the battle's validated timeline: from the battle
// document alone (buildMeetings over P's bounds — no read) it lists the
// meetings now created on P; only when there is one does it read P's tape,
// and only when a listed meeting's key is missing from P's stored `meetings`
// does it re-merge P with the same writer (writeTapeDay: merge-monotone). The
// re-merge reopens no candle pass — a meeting-only symbol is outside the
// candle input fingerprint, so a written pass stays written and a late
// meeting's legs get no bars (RB-2); only a pass that was still to retry
// anyway fetches them, best effort, on its next attempt. The re-merge is
// a whole re-merge of P, as a refresh of P is: any other source of P that
// grew since P's night is copied too (the build report names them). It runs
// only above the pass's time floor. A write the writer acknowledged is listed
// `remerged`, from the writer's own outcome, and nothing reads P after it
// (Build B Amendment F RF-2). A failed re-merge is caught and counted:
// it never marks P failed and leaves D's write as it was. P is either as it
// was or holds exactly the whole re-merge this pass intended (the transaction
// commits whole or not at all): a commit with an unknown outcome can leave P
// re-merged beside a `remergeFailed` row, or beside `writer_unchanged` when
// the SDK's own retry re-reads the applied write (review X3-9).

import { findActiveAgentBattles } from '../agentBattleService.js';
import { FILM_TAPE_WRITE_ENABLED } from '../../../src/config/featureFlags.js';
import { writeTapeDay, markCloseFailed, isTieredBattle } from './writeTapeDay.js';
import { resolveBattleResult } from './battleResult.js';
import { buildBattleBlock, buildMeetings } from './tapeAssemble.js';
import { stableStringify } from './tapeMerge.js';
import { errorTextOf } from './errorClass.js';
import { readEvalRunsForDay, readTape, tapeRef } from './tapeSources.js';
import { etDayBounds, etDateOf, sessionDatesBetween, sessionFor, nextCalendarDate } from './tapeTime.js';
import { isBattleDay, completionsSinceMs, tapeDateFor, isEtDate, isSessionDate, tradingTimeline } from '../../../src/utils/tapeSchedule.js';

export const TIME_FLOOR_MS = 30_000;
/** The longest range one backfill request may name (sessions). */
export const BACKFILL_MAX_SESSIONS = 60;

// The selection rule — isBattleDay, completionsSinceMs, tapeDateFor — is the
// shared module's (src/utils/tapeSchedule.js), the ONE rule the hub helper
// also answers `pending` by (BA-28); re-exported here.
export { isBattleDay, completionsSinceMs, tapeDateFor };

/** Does this stored tape already record the battle block the battle has now? */
export function completionRecorded(stored, battle) {
  if (!stored || battle?.status !== 'completed') return false;
  return stableStringify(stored.battle ?? null) === stableStringify(buildBattleBlock({ battle, resolveResult: resolveBattleResult }));
}

async function completedBetween(db, fromIso, toIso) {
  const snap = await db.collection('agentBattles')
    .where('completedAt', '>=', fromIso).where('completedAt', '<', toIso).get();
  return (snap?.docs || []).map((d) => ({ id: d.id, ...(typeof d.data === 'function' ? d.data() : d.data) }))
    .filter((b) => b.status === 'completed');
}

/**
 * The session for `etDate` — or a loud `calendar_missing` when the market
 * calendar is not maintained for its year (marketSchedule.js:165-166: callers
 * exit with calendar_missing, never a quiet "no session"; review L3-F7).
 */
function sessionOrMissing(etDate) {
  const s = sessionFor(etDate);
  if (!s) console.error(`[film-tape-close] calendar_missing: the market calendar has no entry for ${etDate} — nothing is taped until it is maintained`);
  return s;
}

const elapsedFrom = (startMs, clock) => clock() - startMs;

async function safeMarkFailed(db, battle, etDate, err, clock, summary) {
  const reason = errorTextOf(err).slice(0, 300);
  summary.failed.push({ battleId: battle.id, etDate, reason });
  try {
    await markCloseFailed(db, battle, etDate, reason, { now: clock() });
  } catch (markErr) {
    console.error(`[film-tape-close] battle ${battle.id} ${etDate} failed (${reason}) and its failure record could not be written: ${markErr?.message || markErr}`);
  }
}

/** RC-3 — the session before `etDate` in the battle's validated timeline (tradingTimeline), or null: its first day, or a timeline that does not validate. */
export function previousTapeDay(battle, etDate) {
  const days = tradingTimeline(battle);
  const i = days ? days.indexOf(etDate) : -1;
  return i > 0 ? days[i - 1] : null;
}

/** RC-3 — the keys of the meetings the battle's history now holds as created on `etDate`, from the battle document alone (the writer's own builder over that day's bounds). */
export function meetingKeysOn(battle, etDate) {
  return buildMeetings({ battle, bounds: etDayBounds(etDate) }).rows.map((m) => m.key);
}

/**
 * RC-3 — after day D of `battle` is handled: re-merge its previous session P
 * when a meeting created on P has since been filed and P's tape lacks it.
 * Never throws; every outcome is one summary row (counted in the log line).
 * `remergeUnchanged` rows say why P was left as it was: `already_copied`
 * (P's stored meetings hold every key), `not_written` (P has no written tape
 * to merge into — the backfill is that day's path), `time_floor` (the pass
 * is below its time floor), `writer_unchanged` (the writer found nothing to
 * change). A `remerged` row says whether P now holds every candidate meeting
 * (`meetingsStored`, from the meeting keys of the document the writer
 * committed — Amendment F RF-2: an acknowledged write is a re-merge that
 * happened, and nothing reads P after it): the size budget (RB-6) can drop
 * P's meetings while the re-merge still writes P. `remergeFailed` is a
 * re-merge that failed before the writer acknowledged a write: an
 * unreadable P, or a write that failed (criterion 5).
 */
async function remergePreviousDay({ db, battle, etDate, clock, write, summary, startMs, budgetMs }) {
  let P = null;
  try {
    if (!isTieredBattle(battle)) return;
    P = previousTapeDay(battle, etDate);
    if (!P || !isEtDate(P) || !isSessionDate(P)) return;
    const keys = meetingKeysOn(battle, P);
    if (!keys.length) return;                                   // no candidate: P is never read
    // the pass's own floor (review X3-6): a re-merge is a second write for the battle
    if (budgetMs - elapsedFrom(startMs, clock) < TIME_FLOOR_MS) { summary.remergeUnchanged.push({ battleId: battle.id, etDate: P, reason: 'time_floor' }); return; }
    // read directly, not through readTape (which reads a failed read as no tape): an unreadable P is a failed re-merge, never `not_written`
    const snap = await tapeRef(db, battle.id, P).get();
    const stored = snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    if (stored?.passes?.close?.status !== 'written') { summary.remergeUnchanged.push({ battleId: battle.id, etDate: P, reason: 'not_written' }); return; }
    const have = (Array.isArray(stored.meetings) ? stored.meetings : []).map((m) => m?.key);
    if (keys.every((k) => have.includes(k))) { summary.remergeUnchanged.push({ battleId: battle.id, etDate: P, reason: 'already_copied' }); return; }
    const r = await write(battle.id, P, { db, now: clock(), battle });
    if (r.status !== 'written') { summary.remergeUnchanged.push({ battleId: battle.id, etDate: P, reason: 'writer_unchanged' }); return; }
    // review X3-4: what the write produced, not only that it wrote. Amendment F RF-2 (Astra's
    // B1.1 review F2): from the writer's own outcome — the committed document's meeting keys —
    // never a second read of P, whose failure would report an acknowledged write as failed.
    const kept = Array.isArray(r.meetingKeys) ? r.meetingKeys : [];
    summary.remerged.push({ battleId: battle.id, etDate: P, bytes: r.bytes, meetingsStored: keys.every((k) => kept.includes(k)) });
  } catch (err) {
    // Counted, never marked: no failure record is written for P, and D's write stands.
    summary.remergeFailed.push({ battleId: battle.id, etDate: P, reason: String(err?.message || err).slice(0, 300) });
  }
}

/**
 * The nightly pass for `etDate` (default: the ET date at `clock()`).
 *
 * @param {object} p
 * @param {object} p.db
 * @param {() => number} p.clock        epoch ms now
 * @param {number} p.startMs            handler start
 * @param {number} p.budgetMs           the handler's hard ceiling (maxDuration)
 * @param {string} [p.etDate]
 */
export async function runClosePass({ db, clock = Date.now, startMs = clock(), budgetMs = 300_000, etDate = null, write = writeTapeDay }) {
  // The writer flag at CALL time, here too (review L3-F4) — before any read.
  if (!FILM_TAPE_WRITE_ENABLED) throw new Error('film_tape_write_disabled');
  const date = etDate ?? etDateOf(clock());
  const session = sessionOrMissing(date);
  if (!session) return { skipped: true, reason: 'calendar_missing', etDate: date };
  if (!session.isTradingDay) return { skipped: true, reason: 'not_a_trading_day', etDate: date };
  // Never tape a session in progress: its record is not whole yet (review L1-F11).
  if (clock() < session.closeMs) return { skipped: true, reason: 'session_not_closed', etDate: date };
  const bounds = etDayBounds(date);
  const sinceMs = completionsSinceMs(date);
  const runsRead = await readEvalRunsForDay(db, bounds);
  const [active, completed] = await Promise.all([findActiveAgentBattles(db), completedBetween(db, new Date(sinceMs).toISOString(), bounds.endIso)]);
  const byId = new Map();
  for (const b of [...active, ...completed]) if (b?.id && !byId.has(b.id)) byId.set(b.id, b);
  const battles = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

  const summary = {
    etDate: date, battles: battles.length, written: [], unchanged: [], skippedMode: [], notBattleDay: [], invalid: [], failed: [], notReached: [],
    // RC-3: the previous sessions this pass re-merged for a late-filed meeting, left as they were, or failed to re-merge
    remerged: [], remergeUnchanged: [], remergeFailed: [],
  };
  for (const [i, battle] of battles.entries()) {
    if (budgetMs - elapsedFrom(startMs, clock) < TIME_FLOOR_MS) {
      summary.notReached = battles.slice(i).map((b) => b.id);
      console.error(`[film-tape-close] time floor reached: ${summary.notReached.length} battle(s) not taped for ${date} — the backfill entry is their only path`);
      break;
    }
    const target = tapeDateFor(battle, date, { completedSinceMs: sinceMs });
    if (!target) { summary.notBattleDay.push(battle.id); continue; }
    // BA-35: the target must be a session of the calendar before writeTapeDay
    // or markCloseFailed — an invalid one is counted, and nothing is written.
    if (!isEtDate(target) || !isSessionDate(target)) {
      summary.invalid.push({ battleId: battle.id, etDate: String(target) });
      console.error(`[film-tape-close] battle ${battle.id}: its tape date ${String(target)} is not a session of the calendar — nothing written (BA-35)`);
      continue;
    }
    try {
      if (target !== date && completionRecorded(await readTape(db, battle.id, target), battle)) {
        // A final-day re-merge whose completion the tape already records.
        summary.unchanged.push(battle.id);
      } else {
        const r = await write(battle.id, target, { db, now: clock(), battle, runsRead: target === date ? runsRead : undefined });
        if (r.status === 'skipped_mode') summary.skippedMode.push(battle.id);
        else if (r.status === 'unchanged') summary.unchanged.push(battle.id);
        else summary.written.push({ battleId: battle.id, etDate: target, bytes: r.bytes });
      }
    } catch (err) {
      await safeMarkFailed(db, battle, target, err, clock, summary);
    }
    // RC-3: day D is handled — its previous session may owe a late-filed meeting (never throws).
    await remergePreviousDay({ db, battle, etDate: target, clock, write, summary, startMs, budgetMs });
  }
  return summary;
}

/**
 * `YYYY-MM-DD..YYYY-MM-DD` → the session dates in it, or an error word. With
 * `nowMs`, a range reaching a session that has not closed yet is refused
 * (`range_not_closed`): that day has no record to tape, and an empty tape for
 * it would read as a day without activity (BA-20).
 */
export function parseBackfillRange(value, { nowMs = null } = {}) {
  const m = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(String(value || '').trim());
  if (!m) return { error: 'invalid_range' };
  const [, from, to] = m;
  if (from > to) return { error: 'invalid_range' };
  // Every calendar date in the range must be in the maintained market calendar
  // — otherwise "no sessions" would be a guess (review L3-F7).
  for (let d = from; d <= to; d = nextCalendarDate(d)) if (!sessionFor(d)) return { error: 'calendar_missing' };
  const dates = sessionDatesBetween(from, to);
  if (!dates.length) return { error: 'no_sessions_in_range' };
  if (dates.length > BACKFILL_MAX_SESSIONS) return { error: 'range_too_long' };
  if (nowMs !== null && dates.some((d) => !(sessionFor(d)?.closeMs <= nowMs))) return { error: 'range_not_closed' };
  return { from, to, dates };
}

/** Battles that may have traded on `etDate`: still active, or completed on/after it. */
async function candidatesFor(db, bounds) {
  const col = db.collection('agentBattles');
  const [activeSnap, laterSnap] = await Promise.all([
    col.where('status', '==', 'active').get(),
    col.where('completedAt', '>=', bounds.startIso).get(),
  ]);
  const byId = new Map();
  for (const snap of [activeSnap, laterSnap]) {
    for (const d of snap?.docs || []) if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...(typeof d.data === 'function' ? d.data() : d.data) });
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * The admin backfill (BA-15): every battle-day in the range, oldest first,
 * skipping pairs already written. Stops at the time floor and names where to
 * resume; the same request resumes by the queue flag alone. With `refresh`
 * (BA-29 amended), a written pair is re-merged instead of skipped, and listed
 * `refreshed` when that changed it, `unchanged` when it did not.
 */
export async function runBackfill({ db, clock = Date.now, startMs = clock(), budgetMs = 300_000, dates, write = writeTapeDay, refresh = false }) {
  if (!FILM_TAPE_WRITE_ENABLED) throw new Error('film_tape_write_disabled');
  const summary = {
    dates, written: [], alreadyDone: [], skippedMode: [], unchanged: [], failed: [], complete: true, resumeFrom: null,
    ...(refresh ? { refresh: true, refreshed: [] } : {}),
  };
  for (const date of dates) {
    const bounds = etDayBounds(date);
    const runsRead = await readEvalRunsForDay(db, bounds);
    const battles = (await candidatesFor(db, bounds)).filter((b) => isBattleDay(b, date));
    for (const battle of battles) {
      if (budgetMs - elapsedFrom(startMs, clock) < TIME_FLOOR_MS) {
        summary.complete = false;
        summary.resumeFrom = { etDate: date, battleId: battle.id };
        return summary;
      }
      const stored = await readTape(db, battle.id, date);
      const closeStatus = stored?.passes?.close?.status;
      const days = battle?.timing?.tradingDays;
      const isFinalDay = Array.isArray(days) && days.length > 0 && days[days.length - 1] === date;
      // The queue flag — except a completed battle's FINAL day whose tape was
      // written before the completion: the backfill is its repair path too.
      const owesCompletion = isFinalDay && battle.status === 'completed' && closeStatus === 'written' && !completionRecorded(stored, battle);
      // BA-29 amended: refresh re-merges a written day instead of skipping it.
      const reMerge = refresh && closeStatus === 'written';
      if (['written', 'skipped_mode'].includes(closeStatus) && !owesCompletion && !reMerge) { summary.alreadyDone.push({ battleId: battle.id, etDate: date }); continue; }
      try {
        const r = await write(battle.id, date, { db, now: clock(), battle, runsRead });
        if (r.status === 'skipped_mode') summary.skippedMode.push({ battleId: battle.id, etDate: date });
        else if (r.status === 'unchanged') summary.unchanged.push({ battleId: battle.id, etDate: date });
        else if (reMerge) summary.refreshed.push({ battleId: battle.id, etDate: date, bytes: r.bytes });
        else summary.written.push({ battleId: battle.id, etDate: date, bytes: r.bytes });
      } catch (err) {
        await safeMarkFailed(db, battle, date, err, clock, summary);
      }
    }
  }
  return summary;
}

