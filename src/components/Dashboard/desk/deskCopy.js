// src/components/Dashboard/desk/deskCopy.js
//
// EVERY user-visible string the Command Center Sync surfaces render lives here.
// No inline copy in the Desk JSX (Pass 1 spec §9). One file means the honesty
// rules below are enforceable by a test that reads this module plus the Desk
// sources, rather than by reviewer memory.
//
// THE COPY RULES (framework §5.1-5.2), and why each exists:
//
//   1. SCOREBOARD LANGUAGE ONLY. The Desk measures the scoreboard, not the
//      agent's mind. "PLTR is 0.4 ATR from its next bonus tier" is an
//      observable game fact. "PLTR is close to a trade" is a causal promise
//      the system cannot keep — a position can sit 0.2 ATR from a bonus tier
//      and the agent may hold straight through it. The proximity object
//      measures distance to the next SCORING threshold, never distance to
//      agent action.
//
//   2. NO AGENT VERBS. No "watching", "thinking", "analyzing", "eyeing",
//      "considering", "about to". Those imply continuous attention. The system
//      checks every 15 minutes and does nothing in between, so any word
//      implying it is awake between checks is a fabrication.
//
//   3. DISCRETE, NEVER CONTINUOUS. The posture line names the last check and
//      the next one. The `~` on "next" is REQUIRED: the cron is not a
//      metronome and the next tick is approximate.
//
//   4. NEVER A FABRICATED TIME. With no eval landed yet, the copy says a check
//      is coming — it does not invent when.
//
// The only action-relevant leg is the swap lock, and it is rendered as a
// CONSTRAINT ("locked · 1.2% from unlock") — a fact about what cannot happen,
// not a forecast of what will.

/**
 * Format an ISO instant as an ET wall-clock time, e.g. "9:47 AM".
 * Intl with America/New_York — never a hand-rolled offset (BUILD_RULES §6).
 */
export function etTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/** Format an ISO instant as an ET weekday, e.g. "Mon". */
export function etWeekday(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  }).format(d);
}

/** "Fri 3:45 PM ET" — the as-of stamp's shape. */
export function etStamp(iso) {
  const day = etWeekday(iso);
  const time = etTime(iso);
  if (!day || !time) return null;
  return `${day} ${time} ET`;
}

export const DESK_COPY = Object.freeze({
  // ── Posture line (spec §8 item 1) ──────────────────────────────────────────
  // LIVE. Discrete by construction: a last check and an approximate next one.
  postureLive: (lastIso, nextIso) => {
    const last = etTime(lastIso);
    const next = etTime(nextIso);
    if (!last) return DESK_COPY.postureFirstCheckComing;
    return next ? `Checked ${last} · next ~${next}` : `Checked ${last}`;
  },

  // No eval has landed yet in a LIVE battle. Never invent a time.
  postureFirstCheckComing: 'First check coming up',

  // PRE_OPEN — the market has not opened, so the first check is scheduled, not
  // guessed: 9:30 ET is the market open, a fact.
  posturePreOpen: 'First check at 9:30 ET',

  // LIVE_CLOSED. "Market closed" is a market fact; the next check is the next
  // open. No verb about the agent at all — it is not doing anything.
  postureClosed: (nextOpenIso) => {
    const day = etWeekday(nextOpenIso);
    const time = etTime(nextOpenIso);
    if (!day || !time) return 'Market closed';
    return `Market closed · next check ${day} ${time} ET`;
  },

  // POST_CLOSE — the battle is over; there is no next check.
  postureComplete: 'Battle complete',

  // ── Score proximity (spec §8 item 2) ───────────────────────────────────────
  // Scoreboard language. The direction WORD comes from the data, never from
  // sign math in the UI, and the tier named is a scoring tier — not a trade.
  proximityRow: (symbol, atrAway, direction) =>
    `${symbol} · ${atrAway} ATR from next ${direction === 'negative' ? 'bust' : 'bonus'} tier`,

  proximityHeading: 'Scoring proximity',

  // Withheld during LIVE when the cache is stale. Never stale numbers dressed
  // as current ones.
  proximityUpdating: 'Proximity updating…',

  // Off-hours the numbers are legitimately current-as-of-close, and the stamp
  // is what makes that honest rather than implied.
  proximityAsOf: (iso) => {
    const stamp = etStamp(iso);
    return stamp ? `as of ${stamp}` : null;
  },

  // ── Swap locks (spec §8 item 3) ────────────────────────────────────────────
  // A constraint, not a forecast: what cannot happen, not what will.
  swapLockRow: (symbol, distancePercent) =>
    distancePercent == null
      ? `${symbol} locked`
      : `${symbol} locked · ${distancePercent}% from unlock`,

  swapLockHeading: 'Swap locks',

  // ── Manage rail (spec §7) ──────────────────────────────────────────────────
  // Replaces the unconditional "is trading". Off-hours the agent is not
  // trading, and the card said so anyway before this pass.
  manageLive: (agentName) => `${agentName} is trading`,
  manageClosed: 'Market closed',
  manageResumes: (nextOpenIso) => {
    const day = etWeekday(nextOpenIso);
    const time = etTime(nextOpenIso);
    return day && time ? `Resumes ${day} ${time} ET` : 'Resumes at next open';
  },
  managePreOpen: 'Waiting for the open',

  // ── POST_CLOSE (spec §7, P-6) ──────────────────────────────────────────────
  // Promises no time: batch-review runs 20:25/21:25 weekdays, so a battle that
  // completes after the last run waits for the next one. "Shortly" would be a
  // claim the cron cannot honor.
  debriefPending: 'Debrief on the way.',
  debriefReady: 'Debrief ready',
});

export default DESK_COPY;
