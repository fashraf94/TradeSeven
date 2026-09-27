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
// BA-3 `skipped_mode` document.
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

import { findActiveAgentBattles } from '../agentBattleService.js';
import { writeTapeDay, markCloseFailed } from './writeTapeDay.js';
import { readEvalRunsForDay, readTape } from './tapeSources.js';
import { etDayBounds, etDateOf, isSessionDate, sessionDatesBetween } from './tapeTime.js';

export const TIME_FLOOR_MS = 30_000;
/** The longest range one backfill request may name (sessions). */
export const BACKFILL_MAX_SESSIONS = 60;

/** Is `etDate` one of the battle's trading days? */
export function isBattleDay(battle, etDate) {
  const days = battle?.timing?.tradingDays;
  if (Array.isArray(days) && days.length) return days.includes(etDate);
  // Legacy documents without the list: active from the activation date through completion.
  const from = etDateOf(battle?.activatedAt ?? battle?.createdAt);
  const to = battle?.completedAt ? etDateOf(battle.completedAt) : null;
  return Boolean(from && from <= etDate && (!to || to >= etDate));
}

/** The date a battle's tape is written for on the pass for `etDate`, or null. */
export function tapeDateFor(battle, etDate) {
  if (isBattleDay(battle, etDate)) return etDate;
  const days = battle?.timing?.tradingDays;
  if (battle?.status === 'completed' && etDateOf(battle.completedAt) === etDate && Array.isArray(days) && days.length) {
    const finalDay = days[days.length - 1];
    if (finalDay < etDate) return finalDay;
  }
  return null;
}

async function completedOn(db, bounds) {
  const snap = await db.collection('agentBattles')
    .where('completedAt', '>=', bounds.startIso).where('completedAt', '<', bounds.endIso).get();
  return (snap?.docs || []).map((d) => ({ id: d.id, ...(typeof d.data === 'function' ? d.data() : d.data) }))
    .filter((b) => b.status === 'completed');
}

const elapsedFrom = (startMs, clock) => clock() - startMs;

async function safeMarkFailed(db, battle, etDate, err, clock, summary) {
  const reason = String(err?.message || err).slice(0, 300);
  summary.failed.push({ battleId: battle.id, etDate, reason });
  try {
    await markCloseFailed(db, battle, etDate, reason, { now: clock() });
  } catch (markErr) {
    console.error(`[film-tape-close] battle ${battle.id} ${etDate} failed (${reason}) and its failure record could not be written: ${markErr?.message || markErr}`);
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
  const date = etDate ?? etDateOf(clock());
  if (!isSessionDate(date)) return { skipped: true, reason: 'not_a_trading_day', etDate: date };
  const bounds = etDayBounds(date);
  const runsRead = await readEvalRunsForDay(db, bounds);
  const [active, completed] = await Promise.all([findActiveAgentBattles(db), completedOn(db, bounds)]);
  const byId = new Map();
  for (const b of [...active, ...completed]) if (b?.id && !byId.has(b.id)) byId.set(b.id, b);
  const battles = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

  const summary = { etDate: date, battles: battles.length, written: [], unchanged: [], skippedMode: [], notBattleDay: [], failed: [], notReached: [] };
  for (const [i, battle] of battles.entries()) {
    if (budgetMs - elapsedFrom(startMs, clock) < TIME_FLOOR_MS) {
      summary.notReached = battles.slice(i).map((b) => b.id);
      console.error(`[film-tape-close] time floor reached: ${summary.notReached.length} battle(s) not taped for ${date} — the backfill entry is their only path`);
      break;
    }
    const target = tapeDateFor(battle, date);
    if (!target) { summary.notBattleDay.push(battle.id); continue; }
    try {
      const r = await write(battle.id, target, { db, now: clock(), battle, runsRead: target === date ? runsRead : undefined });
      if (r.status === 'skipped_mode') summary.skippedMode.push(battle.id);
      else if (r.status === 'unchanged') summary.unchanged.push(battle.id);
      else summary.written.push({ battleId: battle.id, etDate: target, bytes: r.bytes });
    } catch (err) {
      await safeMarkFailed(db, battle, target, err, clock, summary);
    }
  }
  return summary;
}

/** `YYYY-MM-DD..YYYY-MM-DD` → the session dates in it, or an error word. */
export function parseBackfillRange(value) {
  const m = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(String(value || '').trim());
  if (!m) return { error: 'invalid_range' };
  const [, from, to] = m;
  if (from > to) return { error: 'invalid_range' };
  const dates = sessionDatesBetween(from, to);
  if (!dates.length) return { error: 'no_sessions_in_range' };
  if (dates.length > BACKFILL_MAX_SESSIONS) return { error: 'range_too_long' };
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
 * resume; the same request resumes by the queue flag alone.
 */
export async function runBackfill({ db, clock = Date.now, startMs = clock(), budgetMs = 300_000, dates, write = writeTapeDay }) {
  const summary = { dates, written: [], alreadyDone: [], skippedMode: [], unchanged: [], failed: [], complete: true, resumeFrom: null };
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
      if (['written', 'skipped_mode'].includes(stored?.passes?.close?.status)) { summary.alreadyDone.push({ battleId: battle.id, etDate: date }); continue; }
      try {
        const r = await write(battle.id, date, { db, now: clock(), battle, runsRead });
        if (r.status === 'skipped_mode') summary.skippedMode.push({ battleId: battle.id, etDate: date });
        else if (r.status === 'unchanged') summary.unchanged.push({ battleId: battle.id, etDate: date });
        else summary.written.push({ battleId: battle.id, etDate: date, bytes: r.bytes });
      } catch (err) {
        await safeMarkFailed(db, battle, date, err, clock, summary);
      }
    }
  }
  return summary;
}

