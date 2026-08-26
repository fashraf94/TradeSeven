// src/components/League/battleArena/fuseReviewCases.js
//
// ⚠️ A REVIEW INSTRUMENT — NOT A FEATURE. ⚠️
//
// Four deliberately adversarial fixture pods for the founder visual review
// (Amendment C §C4). Every one of these cases is proven correct in unit tests
// and is unlikely to occur in a live pod in any given week — which is exactly
// why they need eyes on them, and why "wait for a real pod to produce one" is
// not a plan.
//
// REACHABILITY: only from the already-non-live fixtures preview
// (`?battleViewV2=1`), only with the fuse gate on (`?fuseHero=1`), and only
// when a case is named explicitly (`?fuseCase=<key>`). No production path
// imports this module — LeagueBattleArena is the sole consumer, and it is the
// dev preview host. No new flag: it rides FUSE_HERO_ON like everything else.
//
// DELETION: this module goes with the review. It has no dependents once the
// board is signed off; drop it in the same cleanup PR that removes ClimbArena,
// or sooner. Nothing else will notice.
//
// EACH CASE FORCES ITS OWN SCOPE (D2). underwater and extremes previously
// opened in Today, where `outlier = !DAY && ...` disables the compression they
// exist to show — a reviewer following the banner would have reported "looks
// fine" about a case that never ran. The forced scope only SEEDS the toggle, so
// switching scope by hand still works.
//
// The trails below are built through the REAL appendTrailSnapshot — the same
// accumulator production uses — so what the reviewer sees is the actual
// carry-forward and shared-clock behaviour, not a hand-drawn shape. Timestamps
// are fixed literals (a known ET session), never Date.now().

import { emptyTrail, appendTrailSnapshot } from './useSessionCompositeTrail';

const IDS = ['vela', 'atlas', 'helios', 'ember'];
const OPEN = Date.parse('2026-08-26T13:30:00Z'); // 9:30 ET — a real session start
const MIN = 60_000;

// Shared-clock ticks, as MINUTES AFTER THE OPEN.
//
// D1 FIX: these were three ticks five minutes apart, so every fuse rendered
// inside the leftmost ~4% of a 390-minute axis while the labels spanned
// OPEN→CLOSE. The renderer was right — `seatDaySeries` has always placed a
// sample at `sessionFraction(s.t)` — the FIXTURES were wrong. These now span
// 9:35 → 14:15, so a case fills the board the way a real afternoon session does.
//
// Deliberately NON-UNIFORM: the 45-minute step between 125 and 170 exists so a
// reviewer can SEE that a gap renders as a gap. Under the index mapping D1
// suspected, that step would be indistinguishable from a 30-minute one.
const TICKS_MIN = Object.freeze([5, 35, 65, 95, 125, 170, 215, 245, 275, 285]);

/** Zip hand-authored per-seat value paths against TICKS_MIN and walk them
 *  through the REAL accumulator. A `null` in a path is a DROPPED POLL for that
 *  seat at that tick — seatLive false — so the trail carries its last observed
 *  value forward, exactly as production would. */
function trailFrom(seeds, paths) {
  let t = emptyTrail({ ...seeds });
  TICKS_MIN.forEach((mins, i) => {
    const row = Object.fromEntries(IDS.map((id) => [id, paths[id][i]]));
    t = appendTrailSnapshot(t, {
      ids: IDS,
      scoresAtLast: row,
      seatLive: Object.fromEntries(IDS.map((id) => [id, row[id] != null])),
      t: OPEN + mins * MIN,
    });
  });
  return t;
}

const lastOf = (climb) => Object.fromEntries(IDS.map((id) => [id, climb[id][climb[id].length - 1]]));

// ── 1. A seat deep underwater — the labelled basement, week scope ───────────
const UNDERWATER_CLIMB = {
  vela: [8, 14, 19, 24, 31],
  atlas: [2, 5, 9, 12, 16],
  helios: [1, 3, 6, 8, 11],
  ember: [-20, -45, -78, -110, -142], // |LO| 142 ≫ 0.3 × 31 → compression engages
};
const UNDERWATER_PATH = {
  vela: [32, 33, 35, 34, 36, 38, 37, 39, 40, 41],
  atlas: [17, 16, 18, 15, 19, 20, 22, 21, 23, 24],
  helios: [12, 13, 12, 14, 15, 14, 16, 17, 16, 18],
  ember: [-148, -152, -161, -158, -170, -176, -181, -179, -188, -194],
};

// ── 2. Compressed EXTREME range — 44,000 up, −18,000 down ───────────────────
const EXTREME_CLIMB = {
  vela: [12000, 26000, 33000, 40000, 44000],
  atlas: [300, 900, 1500, 2100, 2600],
  helios: [-200, -500, -700, -850, -900],
  ember: [-2000, -6000, -11000, -15000, -18000], // |LO| 18000 > 0.3 × 44000
};
const EXTREME_PATH = {
  vela: [44900, 45400, 46100, 45600, 47000, 48200, 47800, 49100, 49800, 50400],
  atlas: [2800, 3050, 3300, 3150, 3600, 3900, 4200, 4050, 4400, 4700],
  helios: [-940, -905, -880, -915, -860, -830, -845, -800, -780, -760],
  ember: [-18600, -19200, -19850, -19500, -20400, -21100, -21600, -21300, -22200, -22800],
};

// ── 3. Four seats inside a couple of points — the elbow connectors ──────────
const BUNCHED_CLIMB = {
  vela: [3.1, 6.2, 8.9, 11.4, 12.3],
  atlas: [3.0, 6.0, 8.8, 11.5, 12.1],
  helios: [2.9, 6.1, 9.0, 11.3, 12.2],
  ember: [3.2, 5.9, 8.7, 11.6, 12.0],
};
const BUNCHED_PATH = {
  vela: [12.4, 12.5, 12.6, 12.5, 12.7, 12.8, 12.7, 12.9, 13.0, 13.1],
  atlas: [12.2, 12.4, 12.5, 12.6, 12.6, 12.7, 12.8, 12.8, 12.9, 13.0],
  // helios drops a poll at the 170-minute tick — its fuse holds its last
  // observed value across the gap instead of diving to the banked floor.
  helios: [12.3, 12.4, 12.4, 12.5, 12.5, null, 12.7, 12.8, 12.8, 12.9],
  ember: [12.1, 12.3, 12.4, 12.4, 12.6, 12.6, 12.6, 12.7, 12.8, 12.9],
};

// ── 4. Cold mount — no trail at all: the flat spine + live tip (R3) ─────────
const RELOAD_CLIMB = {
  vela: [3.2, 5.8, 5.1, 7.9, 9.4],
  atlas: [-1.2, 1.4, 4.6, 4.1, 8.7],
  helios: [2.1, 3.0, 4.9, 5.2, 5.0],
  ember: [0.4, -0.8, -1.6, 1.2, 2.3],
};

export const FUSE_REVIEW_CASES = Object.freeze({
  underwater: {
    label: 'Underwater · basement',
    scope: 'week', // basement compression is week-only by construction
    look: 'Does the compressed negative read as "in the hole" rather than as a rendering fault? Is BASEMENT · COMPRESSED legible?',
    climb: UNDERWATER_CLIMB,
    trail: trailFrom(lastOf(UNDERWATER_CLIMB), UNDERWATER_PATH),
  },
  extremes: {
    label: 'Extreme range · compressed',
    scope: 'week', // the 44,000 / −18,000 TOTALS live here; day shows deltas
    look: 'Y labels at 44,000 / −18,000: do they thin cleanly and never overprint? Does the axis stay readable?',
    climb: EXTREME_CLIMB,
    trail: trailFrom(lastOf(EXTREME_CLIMB), EXTREME_PATH),
  },
  bunched: {
    label: 'Four seats bunched · elbows',
    scope: 'day', // the clock axis + the tightest tip cluster
    look: 'Four tips within ~0.4 pts: do the de-collided heads read, and do the elbow connectors track back to the right fuse?',
    climb: BUNCHED_CLIMB,
    trail: trailFrom(lastOf(BUNCHED_CLIMB), BUNCHED_PATH),
  },
  reload: {
    label: 'Cold mount · reload state',
    scope: 'day', // the live state a user lands in
    look: 'The state most users see most often (R3): flat spine at the last close plus the live tip. Does it look deliberate rather than broken?',
    climb: RELOAD_CLIMB,
    trail: null, // no accumulated history — exactly a fresh tab
  },
});

export const FUSE_REVIEW_KEYS = Object.freeze(Object.keys(FUSE_REVIEW_CASES));

/** The overlay for a named case, or null when the key is unknown/absent (→ the
 *  ordinary fixtures preview, unchanged). */
export function fuseReviewOverlay(key) {
  const c = FUSE_REVIEW_CASES[key];
  if (!c) return null;
  // F3 nit: the shared fixture pod chrome reads "Day 2 of 5" while these cases
  // carry five banked closes. Overridden here so the header agrees with the
  // data a reviewer is looking at.
  const days = Math.max(...Object.values(c.climb).map((a) => a.length), 1);
  return { climb: c.climb, trail: c.trail, scope: c.scope, label: c.label, look: c.look, day: days, days };
}
