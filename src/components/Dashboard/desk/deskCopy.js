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

const ET_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format ET WALL-CLOCK FIELDS (not an instant) as "Tue 9:30 AM".
 *
 * getMarketState()'s nextOpenTime / nextCloseTime are Dates whose LOCAL fields
 * are the ET wall clock but whose epoch is shifted by the viewer's offset, so
 * they must be formatted from their fields. Running their epoch through Intl
 * renders a wrong time — and, far enough east, a wrong day — for every viewer
 * outside ET. The adapter carries them as {weekdayIndex, hour, minute} for
 * exactly this reason; see etWallClock() in baggerbombAdapter.js.
 */
export function etWallClockLabel(wc) {
  if (!wc || typeof wc.hour !== 'number' || typeof wc.minute !== 'number') return null;
  const day = ET_WEEKDAYS[wc.weekdayIndex];
  if (!day) return null;
  const suffix = wc.hour >= 12 ? 'PM' : 'AM';
  const hour12 = wc.hour % 12 === 0 ? 12 : wc.hour % 12;
  return `${day} ${hour12}:${String(wc.minute).padStart(2, '0')} ${suffix}`;
}

/** "Fri 3:45 PM ET" — the as-of stamp's shape. Takes a TRUE instant. */
export function etStamp(iso) {
  const day = etWeekday(iso);
  const time = etTime(iso);
  if (!day || !time) return null;
  return `${day} ${time} ET`;
}

export const DESK_COPY = Object.freeze({
  // ── Desk identity (F-1) ────────────────────────────────────────────────────
  // The Desk says WHICH battle it describes. Before F-1 it was unlabelled and
  // selected by index, so with a ranked battle and a casual clone live together
  // it could describe one while sitting above the other. Both halves come from
  // the adapter's `game`, which derives them from the same classification the
  // Manage card labels from — so the two can never disagree (BUILD_RULES §9).
  deskEyebrow: (agentName, modeLabel) => {
    if (!agentName && !modeLabel) return null;
    if (!agentName) return modeLabel;
    if (!modeLabel) return agentName;
    return `${agentName} · ${modeLabel}`;
  },

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
  // F-5: "9:30 AM ET", matching the closed-state strings ("next check Mon 9:30
  // AM ET", "Resumes Tue 9:30 AM ET"). One format across every phase; a bare
  // "9:30 ET" beside them read as a different kind of time.
  posturePreOpen: 'First check at 9:30 AM ET',

  // LIVE, and the due check has not landed (Phase A, D-62 / handover lock #5).
  // Still discrete: the last check that DID run, and the one that WAS due —
  // past tense, tilde kept, because the cron is not a metronome and "was due"
  // is a fact about the schedule, not a claim about what the agent is doing.
  // Consumed by the Battle View turn line only; the Desk's LIVE line keeps
  // postureLive (its `next` goes null when past, which reads as `Checked {t}`).
  postureLate: (lastIso, dueIso) => {
    const last = etTime(lastIso);
    const due = etTime(dueIso);
    if (!last) return DESK_COPY.postureFirstCheckComing;
    return due ? `Last check ${last} · next was due ~${due}` : `Last check ${last}`;
  },

  // LIVE_CLOSED. "Market closed" is a market fact; the last check is the as-of
  // stamp (handover lock #5 — it stays visible in closed phases); the next
  // check is the next open. No verb about the agent at all — it is not doing
  // anything. ONE string on both surfaces (D-62): the Desk and the Battle View
  // turn line render this same sentence, so they cannot disagree.
  //
  // With no last check at all the cell keeps the shipped `next check {day}
  // {t} ET` (A4.0 copy ruling 3 — the word "check" was dropped when the
  // two-fact form landed; restored). The two-fact cell is unchanged.
  postureClosed: (nextOpenEt, lastIso) => {
    const label = etWallClockLabel(nextOpenEt);
    const last = etTime(lastIso);
    const parts = ['Market closed'];
    if (last) parts.push(`last check ${last}`);
    if (label) parts.push(last ? `next ${label} ET` : `next check ${label} ET`);
    return parts.join(' · ');
  },

  // POST_CLOSE — the battle is over; there is no next check.
  postureComplete: 'Battle complete',

  // ── Score proximity (spec §8 item 2) ───────────────────────────────────────
  // Scoreboard language. The direction WORD comes from the data, never from
  // sign math in the UI, and the tier named is a scoring tier — not a trade.
  proximityRow: (symbol, atrAway, direction) =>
    `${symbol} · ${atrAway} ATR from next ${direction === 'negative' ? 'bust' : 'bonus'} tier`,

  /**
   * One decimal, but never a bare "0.0" for a distance that is not zero.
   * detectRedZone only admits positions within the last stretch before a
   * threshold, so sub-0.05 distances are common — and "0.0 ATR from next bonus
   * tier" reads as "it has arrived" for a position that has not crossed
   * anything. "<0.1" is the honest rendering of a real, tiny gap.
   */
  distance1dp: (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (value === 0) return '0.0';
    return value < 0.05 ? '<0.1' : value.toFixed(1);
  },

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

  // ── Latest feed line (spec §8 item 4) ──────────────────────────────────────
  // When that entry was written. Deliberately NOT the "as of" wording used for
  // proximity: they are different facts, and one label for two facts is how a
  // display starts disagreeing with itself (BUILD_RULES §9).
  feedStamp: (iso) => etStamp(iso),

  // ── Manage rail (spec §7) ──────────────────────────────────────────────────
  // Replaces the unconditional "is trading". Off-hours the agent is not
  // trading, and the card said so anyway before this pass.
  manageLive: (agentName) => `${agentName} is trading`,
  manageClosed: 'Market closed',
  // The resume time rides the ACTIVITY line, not the right rail, so it never
  // displaces the expiry countdown. A crypto fullday battle expires at 8:00 PM
  // ET, four hours after the market closes — for that window the battle is
  // LIVE_CLOSED and still counting down to an end the next open never reaches.
  // Replacing "3h left" with "Resumes Tue 9:30 AM" there discarded the truer
  // of the two facts.
  manageClosedResuming: (nextOpenEt) => {
    const label = etWallClockLabel(nextOpenEt);
    return label ? `Market closed · resumes ${label} ET` : 'Market closed';
  },
  manageResumes: (nextOpenEt) => {
    const label = etWallClockLabel(nextOpenEt);
    return label ? `Resumes ${label} ET` : 'Resumes at next open';
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
