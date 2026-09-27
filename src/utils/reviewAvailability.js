// src/utils/reviewAvailability.js
//
// THE HUB CONTRACT (Film Room → Command Center hub), spec
// docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md §11, BA-17. The Film
// Room owns this interface; the hub imports it and never computes readiness
// itself, and never reads `dailyReviews`, the tape or any Film Room record.
//
//   getReviewAvailability(battle) → Promise<{ ready, target, availability }>
//
// EXACTLY those three keys (invariant 8 — "ready or not, one availability
// word, and where"): no stage, no reason, no score, no content, no result.
//
//   target        the existing Film Room route — the App screen id 'filmRoom'
//                 (src/App.jsx) — for any battle; null only for no battle.
//                 The hub opens it only when `ready`.
//   availability  'ready' | 'pending' | 'unavailable'. `pending` is said only
//                 when a scheduled process will actually produce the review;
//                 otherwise `unavailable` — never a promise nothing keeps.
//
// STAGE 1 (FILM_ROOM_V2_ENABLED off — today, whatever the writer flag says):
// synchronous from the battle document, NO read. ready = completed AND the
// legacy review exists (`dailyReviews[]` non-empty — presence only, never
// content). pending = completed, no review yet, and `reviewPending === true`
// (the queue flag completion sets and the batch-review cron drains,
// api/cron/agent-batch-review.js). Stated honestly: the legacy review arrives
// on that cron's schedule (H-2 unchanged).
//
// STAGE 3 (FILM_ROOM_V2_ENABLED on — after A2): ONE bounded read of
// `agentBattles/{id}/tape/{finalEtDate}` (finalEtDate = the last
// `timing.tradingDays`). ready = completed AND that tape's
// `passes.close.status === 'written'`. pending = not ready, the battle
// completed TODAY (ET) and tonight's close pass is still to run for it (the
// writer flag on, before `15 2 * * 2-6` UTC plus its maxDuration). Otherwise
// unavailable — a pre-backfill battle is never "pending". Stage 3 guarantees a
// written close pass, not candles: the hub's copy is "Open battle tape".
//
// Both flags are read at CALL time. The Stage 3 reader is injectable (tests)
// and the Firebase client SDK is imported lazily, only on that branch.

import { FILM_ROOM_V2_ENABLED, FILM_TAPE_WRITE_ENABLED } from '../config/featureFlags';
import {
  FILM_ROOM_ROUTE, TAPE_SUBCOLLECTION, CLOSE_PASS_UTC_HOUR, CLOSE_PASS_UTC_MINUTE, CLOSE_PASS_MAX_DURATION_S,
} from '../constants/filmTape';

/** The bound on the Stage 3 tape read. */
export const TAPE_READ_TIMEOUT_MS = 4_000;

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const ET_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });

function toMs(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v) { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') return toMs(v.toMillis());
  return null;
}
const etDateOf = (ms) => ET_DATE.format(new Date(ms));

const result = (ready, target, availability) => ({ ready, target, availability });

/** Stage 1 — the legacy review, from the battle document alone. */
function stageOne(battle, target) {
  const completed = battle.status === 'completed';
  const hasReview = Array.isArray(battle.dailyReviews) && battle.dailyReviews.length > 0;
  if (completed && hasReview) return result(true, target, 'ready');
  if (completed && battle.reviewPending === true) return result(false, target, 'pending');
  return result(false, target, 'unavailable');
}

/**
 * Is tonight's close pass still to run for a battle that completed at
 * `completedMs`? The pass for ET date D fires at 02:15 UTC on the next UTC
 * calendar day (`15 2 * * 2-6` — 22:15 EDT / 21:15 EST of D itself) and may
 * run for its full maxDuration. Only a weekday completion is on a pass night.
 */
export function closePassStillScheduled(completedMs, nowMs) {
  if (completedMs === null || nowMs === null) return false;
  const day = etDateOf(completedMs);
  if (day !== etDateOf(nowMs)) return false;
  const weekday = ET_WEEKDAY.format(new Date(completedMs));
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const [y, m, d] = day.split('-').map(Number);
  const passEndMs = Date.UTC(y, m - 1, d + 1, CLOSE_PASS_UTC_HOUR, CLOSE_PASS_UTC_MINUTE, 0) + CLOSE_PASS_MAX_DURATION_S * 1000;
  return nowMs < passEndMs;
}

/** The default Stage 3 reader: one client getDoc, bounded. Never throws — a failed or denied read is "no tape". */
async function defaultReadTape(battleId, etDate) {
  const [{ doc, getDoc }, { db }] = await Promise.all([import('firebase/firestore'), import('../firebase/config')]);
  let timer = null;
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'agentBattles', battleId, TAPE_SUBCOLLECTION, etDate)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('tape_read_timeout')), TAPE_READ_TIMEOUT_MS); }),
    ]);
    return snap && snap.exists() ? snap.data() : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Stage 3 — the final-day tape's close pass, one bounded read. */
async function stageThree(battle, target, { readTape, nowMs }) {
  if (battle.status !== 'completed') return result(false, target, 'unavailable');
  const days = Array.isArray(battle.timing?.tradingDays) ? battle.timing.tradingDays.filter((d) => typeof d === 'string') : [];
  const finalEtDate = days.length ? days[days.length - 1] : null;
  let tape = null;
  if (finalEtDate && typeof battle.id === 'string') {
    try { tape = await readTape(battle.id, finalEtDate); } catch { tape = null; }
  }
  if (tape && tape.passes && tape.passes.close && tape.passes.close.status === 'written') return result(true, target, 'ready');
  if (FILM_TAPE_WRITE_ENABLED && closePassStillScheduled(toMs(battle.completedAt), nowMs)) return result(false, target, 'pending');
  return result(false, target, 'unavailable');
}

/**
 * @param {object} battle   the agentBattles document (with its `id`)
 * @param {object} [opts]   test seams: `readTape(battleId, etDate)`, `now` (ms)
 * @returns {Promise<{ ready: boolean, target: string|null, availability: 'ready'|'pending'|'unavailable' }>}
 */
export async function getReviewAvailability(battle, { readTape = defaultReadTape, now = Date.now } = {}) {
  if (!battle || typeof battle !== 'object') return result(false, null, 'unavailable');
  const target = typeof battle.id === 'string' && battle.id ? FILM_ROOM_ROUTE : null;
  if (!target) return result(false, null, 'unavailable');
  if (!FILM_ROOM_V2_ENABLED) return stageOne(battle, target);
  return stageThree(battle, target, { readTape, nowMs: typeof now === 'function' ? now() : toMs(now) });
}

export default getReviewAvailability;
