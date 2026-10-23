// src/components/CommandCenter/hub/useHubCompletedBattles.js
//
// Command Center hub, slice S3 (rulings R-S3-5, R-S3-6; spec V1.2 §3, §6) —
// the hub's ten-game window and its Film Room reviews: the thin hook over the
// pure scheduler (./reviewScheduler.js). ONE source for Games, History and the
// review states, and for S4's Activity and next action.
//
//   useHubCompletedBattles(10) → {
//     battles,           null until a read succeeds; then the retained window
//     status,            the latest read's: 'loading' | 'ready' | 'error'
//     error, ownerUid, ownerEpoch, lastSuccessfulAt, generation,
//     refresh(reason),   an explicit refresh (the scheduler's rate cap holds)
//     reviews,           { [battleId]: { state, result, nextAt } }
//     checking, refreshing, nextAttemptAt,
//     carried            true while the window is the one kept from an earlier
//                        mount of this owner and epoch, not yet read again
//                        (spec §6 as amended, Q-S3-2 A+); shown "as of" its time
//   }
//
// It reads only while the hub is mounted, for the signed-in owner and epoch of
// the one identity source (services/authIdentity.js): a new owner or epoch
// disposes the scheduler and starts a fresh one, and a result of another owner
// or epoch is dropped in render, before any effect runs (spec §3). A failed
// read never becomes an empty window: `battles` stays the last good one, or
// null. The rate ledger outlives a mount: one per owner and epoch, so a return
// to the hub inside the 120 s window queues at the permitted time instead of
// reading again (spec §6; review T0-3). So does the last successful window,
// by the founder's amendment of §6's unmount list (Q-S3-2, A+): a return shows
// it at once "as of" its time and it is read again at the next permitted slot;
// an owner or epoch change clears it with the ledger.
//
// Amendment B (S4; founder rulings Q-S3-9, Q-S3-10): a FIRST read that succeeds
// after the hub unmounted is kept in that owner and epoch's record (the
// scheduler's `onLate`), never in another's; and the kept window also holds its
// rows' READY review answers, so a return opens "Open battle tape" at once.
// Pending, unavailable, timed-out and queued answers are not kept.
//
// Its activity — the real clock's timers, the page's visibility and focus
// listeners, the effect that owns the scheduler — is listed in the hub mount
// guard's allowances. The review helper is getReviewAvailability, unmodified,
// handed each battle document as it came from the read.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthIdentity } from '../../../services/authIdentity';
import { fetchRecentCompletedAgentBattles } from '../../../services/completedAgentBattles';
import { getReviewAvailability } from '../../../utils/reviewAvailability';
import { REVIEW_TRIGGERS, carriedState, createReviewScheduler } from './reviewScheduler';

/**
 * What outlives one mount, per owner and epoch: the rate ledger (spec §6: one completed query and ten helper starts
 * per rolling 120 s "for the same mounted uid/epoch. Every trigger shares this budget") and, by the founder's
 * amendment of §6's unmount list (Q-S3-2, A+), the last successful window — its documents, generation and as-of
 * time. Only the current key is kept, so a new owner or epoch starts afresh, with neither.
 */
const OWNERS = new Map();
function ownerRecord(uid, epoch) {
  const key = `${uid}:${epoch}`;
  let record = OWNERS.get(key);
  if (!record) {
    OWNERS.clear();
    record = { ledger: { queries: [], helpers: [] }, window: null };
    OWNERS.set(key, record);
  }
  return record;
}
/** The kept window of this owner and epoch, if any. */
const keptWindowOf = (uid, epoch) => (uid ? OWNERS.get(`${uid}:${epoch}`)?.window ?? null : null);
/**
 * The ready review answers a state holds (Amendment B, Q-S3-10): a row whose review the helper says is ready, with that
 * answer. Pending, unavailable, timed-out, queued and checking rows are not kept: they are asked again.
 */
function readyAnswersOf(state) {
  const ready = {};
  for (const battle of state.battles) {
    const review = state.reviews?.[battle.id];
    if (review && review.state === 'ready' && review.result && review.result.ready === true) ready[battle.id] = review.result;
  }
  return ready;
}

/**
 * Keep the latest successful window of this owner and epoch (a failed read keeps the one before: `battles` holds it),
 * with its rows' ready review answers. A record that does not exist — another owner's or epoch's window, or a signed-out
 * hub, whose records were dropped — is never written: that is how a late answer is kept for the owner and epoch it was
 * read for, and for no other.
 */
function keepWindow(uid, epoch, state) {
  const record = OWNERS.get(`${uid}:${epoch}`);
  if (!record || state.battles === null || state.lastSuccessfulAt === null) return;
  // Never back to an older window (review MR-11): the generation decides first (it only grows within an owner and
  // epoch, so a backward clock step cannot reorder it), then the as-of time.
  const kept = record.window;
  if (kept && (state.generation < kept.generation || (state.generation === kept.generation && state.lastSuccessfulAt < kept.lastSuccessfulAt))) return;
  // A ready answer stays for as long as its row is in the window (the scheduler's own ready cache does the same).
  const ready = {};
  for (const battle of state.battles) if (kept?.ready && Object.hasOwn(kept.ready, battle.id)) ready[battle.id] = kept.ready[battle.id];
  Object.assign(ready, readyAnswersOf(state));
  record.window = { battles: state.battles, generation: state.generation, lastSuccessfulAt: state.lastSuccessfulAt, ready };
}

/** Tests only: forget every owner's ledger and kept window. */
export function resetHubLedgersForTests() {
  OWNERS.clear();
}

/** The window's size (spec §8.2: the ten most recent completed records). */
export const HUB_COMPLETED_WINDOW = 10;

const REAL_CLOCK = Object.freeze({
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle),
});

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/** Nothing has resolved for this owner yet. */
function unresolved(identity) {
  return Object.freeze({
    ownerUid: null,
    ownerEpoch: null,
    status: 'loading',
    battles: null,
    generation: 0,
    lastSuccessfulAt: null,
    error: null,
    checking: false,
    refreshing: false,
    inFlight: 0,
    nextAttemptAt: null,
    carried: false,
    reviews: Object.freeze({}),
    signedIn: Boolean(identity?.resolved && identity.uid),
  });
}

/**
 * @param {number} [max] the window's size, 10 by default
 * @param {{ queryCompleted?, checkReview?, clock? }} [seams] test seams only
 */
export default function useHubCompletedBattles(max = HUB_COMPLETED_WINDOW, seams = {}) {
  const identity = useAuthIdentity();
  const uid = identity.resolved && identity.uid ? identity.uid : null;
  const epoch = identity.authEpoch;
  const [state, setState] = useState(null);
  const schedulerRef = useRef(null);
  const seamsRef = useRef(seams);
  seamsRef.current = seams;

  useEffect(() => {
    if (!uid) {
      // Signed out (or not yet answered): nothing is read, and no owner's ledger or kept window is held any longer —
      // dropped here at once while the hub is mounted, at its next mount otherwise (review MR-5).
      OWNERS.clear();
      return undefined;
    }
    const s = seamsRef.current;
    const clock = s.clock || REAL_CLOCK;
    const record = ownerRecord(uid, epoch);
    const scheduler = createReviewScheduler({
      owner: { uid, authEpoch: epoch },
      max,
      ledger: record.ledger,
      retained: record.window,
      clock,
      queryCompleted: s.queryCompleted || fetchRecentCompletedAgentBattles,
      // Amendment B (Q-S3-9): a first read that succeeds after this hub unmounted is kept for THIS owner and epoch.
      onLate: (late) => keepWindow(uid, epoch, { ...late, reviews: {} }),
      // The helper, unmodified: the document as it came, and nothing else.
      checkReview: s.checkReview || ((battle) => getReviewAvailability(battle)),
      onChange: (next) => {
        keepWindow(uid, epoch, next);
        setState(next);
      },
      visible: pageVisible(),
    });
    schedulerRef.current = scheduler;
    const onVisibility = () => {
      const visible = pageVisible();
      scheduler.setVisible(visible);
    };
    const onFocus = () => scheduler.trigger(REVIEW_TRIGGERS.FOCUS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    // A tick late: React's development double effect (StrictMode) mounts, unmounts and mounts again at once, and the
    // discarded effect must not spend the owner's shared slot.
    const mountTimer = clock.setTimer(() => scheduler.trigger(REVIEW_TRIGGERS.MOUNT), 0);
    return () => {
      clock.clearTimer(mountTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      scheduler.dispose();
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
    };
  }, [uid, epoch, max]);

  const refresh = useCallback((reason = REVIEW_TRIGGERS.MANUAL) => {
    schedulerRef.current?.trigger(reason);
  }, []);

  // Another owner's or epoch's window is dropped here, in render (spec §3). Before this mount's scheduler has changed
  // anything, a window kept for this owner and epoch shows "as of" its time (Q-S3-2, A+).
  const current = state && uid && state.ownerUid === uid && state.ownerEpoch === epoch ? state : null;
  // A mounted scheduler that holds no window yet (a first read still out) gives way to a window kept for this owner and
  // epoch — a first read of an earlier mount that landed after it unmounted (Amendment B, Q-S3-9).
  const kept = uid && (!current || current.battles === null) ? carriedState({ uid, authEpoch: epoch }, keptWindowOf(uid, epoch)) : null;
  const owned = kept || current || unresolved(identity);
  return { ...owned, refresh };
}
