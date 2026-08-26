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
// The trails below are built through the REAL appendTrailSnapshot — the same
// accumulator production uses — so what the reviewer sees is the actual
// carry-forward and shared-clock behaviour, not a hand-drawn shape. Timestamps
// are fixed literals (a known ET session), never Date.now().

import { emptyTrail, appendTrailSnapshot } from './useSessionCompositeTrail';

const IDS = ['vela', 'atlas', 'helios', 'ember'];
const OPEN = Date.parse('2026-08-26T13:30:00Z'); // 9:30 ET — a real session start
const MIN = 60_000;

/** Build a trail by walking per-seat value rows through the real accumulator.
 *  `rows` = [{ vela, atlas, helios, ember }, …], one row per shared-clock tick. */
function trailFrom(seeds, rows) {
  let t = emptyTrail({ ...seeds });
  rows.forEach((row, i) => {
    t = appendTrailSnapshot(t, {
      ids: IDS,
      scoresAtLast: row,
      seatLive: Object.fromEntries(IDS.map((id) => [id, row[id] != null])),
      t: OPEN + (i + 1) * 5 * MIN,
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

// ── 2. Compressed EXTREME range — 44,000 up, −18,000 down ───────────────────
const EXTREME_CLIMB = {
  vela: [12000, 26000, 33000, 40000, 44000],
  atlas: [300, 900, 1500, 2100, 2600],
  helios: [-200, -500, -700, -850, -900],
  ember: [-2000, -6000, -11000, -15000, -18000], // |LO| 18000 > 0.3 × 44000
};

// ── 3. Four seats inside a couple of points — the elbow connectors ──────────
const BUNCHED_CLIMB = {
  vela: [3.1, 6.2, 8.9, 11.4, 12.3],
  atlas: [3.0, 6.0, 8.8, 11.5, 12.1],
  helios: [2.9, 6.1, 9.0, 11.3, 12.2],
  ember: [3.2, 5.9, 8.7, 11.6, 12.0],
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
    look: 'Does the compressed negative read as "in the hole" rather than as a rendering fault? Is BASEMENT · COMPRESSED legible?',
    climb: UNDERWATER_CLIMB,
    trail: trailFrom(lastOf(UNDERWATER_CLIMB), [
      { vela: 33, atlas: 17, helios: 12, ember: -150 },
      { vela: 35, atlas: 15, helios: 13, ember: -166 },
      { vela: 34, atlas: 19, helios: 14, ember: -181 },
    ]),
  },
  extremes: {
    label: 'Extreme range · compressed',
    look: 'Y labels at 44,000 / −18,000: do they thin cleanly and never overprint? Does the axis stay readable?',
    climb: EXTREME_CLIMB,
    trail: trailFrom(lastOf(EXTREME_CLIMB), [
      { vela: 44900, atlas: 2800, helios: -940, ember: -18600 },
      { vela: 45400, atlas: 3050, helios: -905, ember: -19200 },
      { vela: 46100, atlas: 3300, helios: -880, ember: -19850 },
    ]),
  },
  bunched: {
    label: 'Four seats bunched · elbows',
    look: 'Four tips within ~0.4 pts: do the de-collided heads read, and do the elbow connectors track back to the right fuse?',
    climb: BUNCHED_CLIMB,
    trail: trailFrom(lastOf(BUNCHED_CLIMB), [
      { vela: 12.4, atlas: 12.2, helios: 12.3, ember: 12.1 },
      { vela: 12.5, atlas: 12.4, helios: 12.4, ember: 12.3 },
      { vela: 12.6, atlas: 12.5, helios: 12.5, ember: 12.4 },
    ]),
  },
  reload: {
    label: 'Cold mount · reload state',
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
  return { climb: c.climb, trail: c.trail, label: c.label, look: c.look };
}
