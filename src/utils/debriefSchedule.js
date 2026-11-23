// src/utils/debriefSchedule.js
//
// Film Room D2 — WHEN THE AGENT'S WORDS ARE WRITTEN (D2 spec §7): the nightly job's one schedule, read by the job's
// tests (equal to vercel.json's entry) and by the front's not-yet line. Pure, Node-clean, browser-clean: the screen and
// the server both import it.
//   DEBRIEF_SCHEDULE      '45 3 * * 2-6' (UTC): 10:45 PM EST / 11:45 PM EDT — the same ET evening as the session it
//                         reads, after the close pass (`15 2 * * 2-6`, at most 300 s) has finished
//   nextDebriefRunMs(t)   the first run strictly after the instant `t` (the tape's own writtenAt), or null
//   debriefNotYet(t, now) the front's "words arrive by the next morning" window: now before that run plus 30 minutes

import { instantMs } from './filmRoomSubject.js';
import { etDateOf } from './tapeSchedule.js';

/** §6: the record's collection, beside the tape: agentBattles/{battleId}/debriefs/{etDate}. */
export const DEBRIEFS_SUBCOLLECTION = 'debriefs';
/** The cron entry's schedule, exactly as vercel.json holds it. */
export const DEBRIEF_SCHEDULE = '45 3 * * 2-6';
export const DEBRIEF_CRON_PATH = '/api/cron/film-room-debrief';
export const DEBRIEF_UTC_HOUR = 3;
export const DEBRIEF_UTC_MINUTE = 45;
/** The UTC weekdays it runs on (cron's 2-6: Tuesday to Saturday — the nights after Monday's to Friday's sessions). */
export const DEBRIEF_UTC_WEEKDAYS = Object.freeze([2, 3, 4, 5, 6]);
/** §7: the front shows the not-yet line until this long after the next run. */
export const DEBRIEF_NOT_YET_GRACE_MS = 30 * 60_000;

/** The first scheduled run strictly after `writtenAt` (a strict instant), in epoch ms; null for anything else. */
export function nextDebriefRunMs(writtenAt) {
  const t = instantMs(writtenAt);
  if (t === null) return null;
  const d = new Date(t);
  for (let k = 0; k <= 8; k += 1) {
    const run = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + k, DEBRIEF_UTC_HOUR, DEBRIEF_UTC_MINUTE, 0, 0);
    if (run > t && DEBRIEF_UTC_WEEKDAYS.includes(new Date(run).getUTCDay())) return run;
  }
  return null;
}

/**
 * §7: is a day with no record yet still in its not-yet window — now before the next run after its tape was written,
 * plus 30 minutes — AND is that run one that processes this day (the review's R6: a tape first written after its own
 * night's run, by a backfill or a late re-run, is never processed — one date per run, no catch-up — so "by the next
 * morning" would promise words that never come; §7 says the line shows ONLY while now is before that run plus 30 minutes).
 */
export function debriefNotYet(tapeWrittenAt, etDate, nowMs) {
  const until = debriefNotYetUntilMs(tapeWrittenAt, etDate);
  return until !== null && Number.isFinite(nowMs) && nowMs < until;
}

/**
 * The not-yet window's cutoff (Amendment F DF-10): the instant the line stops showing — the next run that processes
 * this day, plus 30 minutes — or null when no run ever does (the line never shows). The screen's display-only timer
 * hides the line at this instant on a page left open; nothing is read again.
 */
export function debriefNotYetUntilMs(tapeWrittenAt, etDate) {
  const run = nextDebriefRunMs(tapeWrittenAt);
  return run !== null && typeof etDate === 'string' && debriefEtDateOfRun(run) === etDate ? run + DEBRIEF_NOT_YET_GRACE_MS : null;
}

/** The ET date a run at `nowMs` processes (§7: the ET date of the run). */
export const debriefEtDateOfRun = (nowMs) => etDateOf(nowMs);
