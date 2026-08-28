// src/components/League/battleArena/mobileHeroHeight.js
//
// Phase 6 / C5 / Amendment G — how tall the mobile fuse hero is allowed to be.
//
// ── G1: USABLE VIEWPORT GOVERNS ────────────────────────────────────────────
// Device height is the wrong denominator. An iPhone SE is a 667px slab but
// ~553px of glass once Safari's chrome is showing, and a hero sized to 667
// leaves nothing for the dock on one of the most common phones in use.
//
// ── G2: svh, NOT dvh, NOT vh ───────────────────────────────────────────────
// The unit matters more than the ratio, and none of the three behaves the way
// the naive reading suggests:
//   vh  → resolves against the LARGE viewport (chrome collapsed), so a ratio
//         picked for 553 quietly computes off 667 and passes by accident.
//   dvh → chrome-aware but DYNAMIC: a sticky hero sized in dvh resizes while
//         the user scrolls the dock beneath it. Worse than the problem.
//   svh → the SMALL viewport (chrome visible). Stable, worst-case, no
//         resize-on-scroll. Correct for a sticky element that must never clip.
// Applied via an @supports probe, scoped to the hero only. The app-wide 100vh
// usage is a real latent issue and is NOT this arc's work (ticketed separately).
//
// ── G3: THE CONSTANTS ARE MEASURED, NOT ESTIMATED ──────────────────────────
// Measured in headless Chromium at 390×553 against the real ArenaMobile tree,
// because the reported approximations were off by ±12 in opposite directions
// and a 13px margin does not survive that:
//
//   sticky padding-top          14   (declared)
//   ArenaTopStrip (compact)     32   (MEASURED — the report guessed ~44)
//   hero margin-top             10   (declared)
//   tab bar                     54   (MEASURED — the report guessed ~44)
//   ──────────────────────────────
//   non-hero sticky chrome     110
//
//   a dock row (user pick card) 129  (MEASURED — the report guessed ~64;
//                                     this is the number that changes the answer)
export const MOBILE_STICKY_CHROME = 110;
export const MOBILE_DOCK_ROW = 129;

/** The tallest the hero may ever be (today's fixed value stays the ceiling). */
export const MOBILE_HERO_MAX = 384;

// ── G4: THE FLOOR, DERIVED FROM WHAT RENDERING ACTUALLY SHOWED ────────────
// A first pass derived a floor of 190 from spreadLabels' bounds arithmetic and
// concluded two full dock rows were infeasible. RENDERING REFUTED IT, which is
// the whole reason G4 asks for render evidence rather than arithmetic.
//
// Measured in Chromium across 160→384px, four bunched seats: the head stack is
// IDENTICAL AT EVERY HEIGHT — same positions, same 0.5px between boxes, bottom
// always at 151.5. spreadLabels pushes a tight cluster to the compact minimum
// gap and clamps it to the TOP bound (plotT + 14), and neither term depends on
// h. Hero height does not govern four-seat de-collision at all.
//
// So the floor is what must physically fit: the head stack (bottom 151.5) plus
// the compact x-label band (padB 26) ⇒ 177.5, rounded to 180.
//
// CONSEQUENCE: the two-full-rows requirement is SATISFIABLE. On a 553 usable
// viewport it yields 185, above this floor, and the fuse renders there with
// heads inside the box, labels fitting their gutter and the cut drawing. No
// relaxation to a partial second row is needed.
//
// SEPARATE FINDING, not fixed here: those 0.5px head gaps are a compact
// `headGap` (30px) versus compact head size (25–30px) problem. It is present at
// EVERY height including today's 384, so it is neither caused nor curable by
// this phase. Reported for its own tasking.
export const MOBILE_HERO_MIN = 180;

/**
 * The hero height for a given usable viewport.
 *
 * On the shortest usable viewport (553) this yields 553 − 110 − 2×129 = 185,
 * above the 180 floor — so the clamp does NOT bind, two full dock rows are
 * visible, and the fuse still renders correctly there (verified in Chromium,
 * mobileHero.bounds.browser.test.jsx). The requirement holds as written.
 *
 * H1 RULED: two rows. `rows` is a fixed 2, not a tuning knob. The founder
 * compared 185 / 237 / 314 on a real phone — the instrument that made that
 * comparison possible (a `?heroRows=` override feeding a `--fh-reserve` custom
 * property) was deleted the moment the ruling landed, so the shipped budget is
 * a literal in ONE place (battleArena.css) mirrored by mobileHeroCss here.
 * 185 reads fine as a chart; the head stack taking ~82% of it is the separate
 * compact-headGap finding below, not a reason to give the dock less room.
 */
export function mobileHeroHeight({
  usableVh, rows = 2, chrome = MOBILE_STICKY_CHROME, row = MOBILE_DOCK_ROW,
  min = MOBILE_HERO_MIN, max = MOBILE_HERO_MAX,
}) {
  if (!Number.isFinite(usableVh)) return max;
  return Math.max(min, Math.min(max, usableVh - chrome - rows * row));
}

/** How many dock rows actually fit once the hero has taken its height. */
export function dockRowsVisible({ usableVh, heroH, chrome = MOBILE_STICKY_CHROME, row = MOBILE_DOCK_ROW }) {
  return (usableVh - chrome - heroH) / row;
}

/**
 * The CSS height for the hero: an svh ratio, floored and ceilinged, with a vh
 * fallback for engines without svh. Expressed as a clamp() so the browser does
 * the arithmetic against the live small viewport rather than a value captured
 * once at mount (which would be stale after a rotate).
 */
export function mobileHeroCss({ rows = 2, chrome = MOBILE_STICKY_CHROME, row = MOBILE_DOCK_ROW,
  min = MOBILE_HERO_MIN, max = MOBILE_HERO_MAX } = {}) {
  const reserved = chrome + rows * row;
  return {
    fallback: `clamp(${min}px, calc(100vh - ${reserved}px), ${max}px)`,
    preferred: `clamp(${min}px, calc(100svh - ${reserved}px), ${max}px)`,
  };
}

