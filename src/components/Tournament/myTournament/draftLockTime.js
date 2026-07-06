// src/components/Tournament/myTournament/draftLockTime.js
//
// "My Tournament" — the draft-countdown target, derived from the group's
// `baseLayerWeek` (Build Spec: no stored `draftLockAt` exists). The Monday lock
// instant is computed client-side from the ISO-week key, then the countdown
// hero segments the remaining time into days / hours / minutes.
//
// The exact minute is COSMETIC: the real forming→battle flip is the Monday
// orchestrator sweep (api/_utils/tournamentOrchestrator.js — the ET-morning
// duty, MORNING_END_MIN = noon ET; vercel.json crons at UTC 11-14 on Mondays).
// We target DRAFT_LOCK_UTC_HOUR on that Monday — a point inside the real cron
// window year-round (13:00 UTC = 9am EDT / 8am EST, both before the ET-noon end)
// so no DST offset math is needed for a purely cosmetic clock. Pure: the caller
// supplies `now`; this module never reads a clock.

// The Monday lock instant, as a UTC hour inside the real ET-morning cron window
// (UTC 11-14 Mon). Cosmetic countdown target, not cron truth.
export const DRAFT_LOCK_UTC_HOUR = 13;

/**
 * The Monday (00:00 UTC) of an ISO-8601 week key 'YYYY-Www' — the inverse of
 * isoWeekString (constants/leagueTournament.js). Returns null for a malformed
 * key. ISO 8601: Jan 4 is always in week 1, and week 1's Monday is the Monday
 * on or before Jan 4.
 */
export function mondayOfIsoWeek(baseLayerWeek) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(baseLayerWeek || ''));
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!(week >= 1 && week <= 53)) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7; // Mon=1..Sun=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

/**
 * The draft-lock instant (epoch ms) for a base-layer week — that week's Monday
 * at DRAFT_LOCK_UTC_HOUR. Null for a malformed week key.
 */
export function draftLockInstant(baseLayerWeek) {
  const monday = mondayOfIsoWeek(baseLayerWeek);
  if (!monday) return null;
  monday.setUTCHours(DRAFT_LOCK_UTC_HOUR, 0, 0, 0);
  return monday.getTime();
}

/**
 * Segment a positive ms remainder into { d, h, m }. A non-positive remainder —
 * the draft moment has passed (e.g. a FORMING group lingering past its Monday) —
 * returns { past: true } so the hero reads "resolving…", never a negative clock.
 *
 * @returns {{ past: boolean, d: number, h: number, m: number }}
 */
export function countdownSegments(msRemaining) {
  if (!(msRemaining > 0)) return { past: true, d: 0, h: 0, m: 0 };
  const totalMin = Math.floor(msRemaining / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return { past: false, d, h, m };
}
