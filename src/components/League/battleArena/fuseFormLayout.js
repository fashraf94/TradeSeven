// src/components/League/battleArena/fuseFormLayout.js
//
// Agent form build S2, arena fit — where the fuse hero's forms sit with AGENT_FORM_LEAGUE_ENABLED on. Pure and node-clean,
// beside fuseGeometry.js, and read only inside the flag's ternaries, so with the flag off none of it ships and today's
// heads keep today's geometry (spreadLabels, FH, the 180-384 px hero).
//
// The founder's iPhone run (Oct 30, 2026): the figures were not near their line points, and the ruling is that the arena
// grows and the figures do not shrink. So:
//   anchorFigures   each figure's centre on its own line's end point; bunched points part by the least amount, around
//                   their points, and never change order (a replacement for the old push-down stack, which moved every
//                   figure once one reached its top bound).
//   fuseFormFrame   a plot whose top clears the head row, so the highest figure, its crown and its value stay below the
//                   Today / The week toggle (the padT ticket in fuseGeometry.js, fixed here for the flag-on arena only).
//   fuseFormScale   the y-scale, with room made inside the plot when a bunch sits against its top or its floor: a bunch
//                   parts around its points only if there is room on both sides of them.
//   fuseFormHeroBox the phone hero's height, inline because a rule in battleArena.css would ship with the flag off.

import { fuseFrame, makeScale } from './fuseGeometry';
import { dial } from '../../../screens/smokeFormScale'; // SMOKE ONLY, NEVER MERGE: the size dial

/**
 * The fuse hero's tips (CSS px): the player a size up, as the heads have always been. Four seats stack here, so S1's
 * header sizes do not fit; these are the largest that keep the value beside the head inside the reserved gutter
 * (fuseGeometry.js TIPROOM) and every seat live (ruling R12's 40 px floor). Measured at 320, 360, 390 and 1280 px.
 */
export const FUSE_FORM_PX = { compact: { you: 50, rival: 44 }, desktop: { you: 64, rival: 56 } };
/** A tip's form, `you` or a rival's. */
export function fuseFormPx(you, compact) {
  const px = FUSE_FORM_PX[compact ? 'compact' : 'desktop'];
  return dial(you ? px.you : px.rival);
}

/** Air between two neighbouring figures' boxes, so forms never quite touch. */
const FIGURE_AIR = 2;
/**
 * The bottom of the head row, in the hero's own px. Measured in headless Edge with the app's stylesheet, which forces every
 * button to 16 px: 3 px below fuseGeometry.js's padT note, which was measured without it. The font was Segoe UI, the
 * stack's tallest (Inter is not installed on the machine that measured it): the crown clears the toggle by 2 px on Windows
 * and by 3-4 px in phone fonts.
 */
const HEAD_ROW_BOTTOM = { compact: 46, desktop: 52 };
/** How far the crown stands above its form's box (FuseHero.jsx FhTip). */
const CROWN_RISE = { compact: 9, desktop: 12 };
/** Clear of the toggle by this much, once the row, the crown and the form are stacked. */
const TOGGLE_CLEARANCE = 1;
/** The hero's room below the floor: fuseGeometry.js FH.compact's padB + LABEL_ROOM. */
const COMPACT_BELOW_FLOOR = 48;

/** The room between two neighbouring figures' centres. */
const figureGap = (a, b) => (a + b) / 2 + FIGURE_AIR;

/**
 * Each figure's centre, by seat: on its own point, unless points sit closer than their figures. A run of bunched points
 * then parts by the least squared distance, which spreads the run around the mean of its points. Order is the points'
 * order (a tie keeps the seats' order), and the bounds, when given, hold the whole stack in.
 *
 * Isotonic regression: take away the room the figures above each one need, and what is left has to run in order, so runs
 * out of order pool at their mean.
 * @param {Array<{id: string, y: number, size: number}>} items  y is the point, size the figure
 */
export function anchorFigures(items, top = -Infinity, bottom = Infinity) {
  const seats = [...items].sort((a, b) => a.y - b.y);
  const rooms = [];
  const runs = [];
  seats.forEach((seat, i) => {
    rooms[i] = i === 0 ? 0 : rooms[i - 1] + figureGap(seats[i - 1].size, seat.size);
    let run = { sum: seat.y - rooms[i], seats: [i] };
    while (runs.length > 0 && runs.at(-1).sum / runs.at(-1).seats.length >= run.sum / run.seats.length) {
      const before = runs.pop();
      run = { sum: before.sum + run.sum, seats: [...before.seats, ...run.seats] };
    }
    runs.push(run);
  });
  const lowest = Math.max(top, bottom - (rooms.at(-1) ?? 0));
  const centres = {};
  for (const run of runs) {
    const level = Math.min(lowest, Math.max(top, run.sum / run.seats.length));
    for (const i of run.seats) centres[seats[i].id] = level + rooms[i];
  }
  return centres;
}

/** The fuse frame with the plot's top below the head row, by the player's half-height and the crown above it. */
export function fuseFormFrame({ w, h, compact = false }) {
  const key = compact ? 'compact' : 'desktop';
  const frame = fuseFrame({ w, h, compact });
  const plotT = HEAD_ROW_BOTTOM[key] + TOGGLE_CLEARANCE + CROWN_RISE[key] + fuseFormPx(true, compact) / 2;
  return { ...frame, padT: plotT, plotT, spanY: frame.floorY - plotT };
}

// Six passes settle every board tried: a bunch's room is a share of the plot, so each pass leaves a fraction of the last.
const SCALE_PASSES = 6;

/**
 * The y-scale for a board of forms: makeScale over the frame's plot, or, when a bunch reaches past the plot's top or floor,
 * over a plot drawn in by the difference, so the bunch can part on both sides of its points and stay inside the frame. Only
 * the scale moves. The frame's chrome stays where it is. Spread boards take the plain scale, and it returns to it smoothly
 * as a bunch breaks up.
 * @param {{ values: number[], day: boolean, frame: object, tips: Array<{id: string, v: number, size: number}> }} args
 */
export function fuseFormScale({ values, day, frame, tips }) {
  let plotT = frame.plotT;
  let floorY = frame.floorY;
  let scale = makeScale({ values, day, plotT, floorY });
  for (let pass = 0; pass < SCALE_PASSES; pass += 1) {
    const centres = Object.values(anchorFigures(tips.map((t) => ({ id: t.id, y: scale.Y(t.v), size: t.size }))));
    const over = frame.plotT - Math.min(...centres);
    const under = Math.max(...centres) - frame.floorY;
    if (over <= 0.25 && under <= 0.25) break;
    plotT += Math.max(0, over);
    floorY -= Math.max(0, under);
    if (floorY - plotT < 1) break;
    scale = makeScale({ values, day, plotT, floorY });
  }
  return scale;
}

/** The tallest four seats can stack: the player in the middle, so two of the three gaps are the wider one. */
export function fuseFormStackPx(compact) {
  const you = fuseFormPx(true, compact);
  const rival = fuseFormPx(false, compact);
  return 2 * figureGap(you, rival) + figureGap(rival, rival);
}

/** The shortest phone hero four figures fit in: the plot's top, the stack, and the room below the floor. */
export function fuseFormHeroMin() {
  return fuseFormFrame({ w: 0, h: 0, compact: true }).plotT + fuseFormStackPx(true) + COMPACT_BELOW_FLOOR;
}

/** What the phone keeps for everything else: the sticky chrome (110) and one and a half dock rows (129), replacing two. */
export const FUSE_FORM_HERO_RESERVE = 304;
/** The ceiling: today's 384, plus the 47 px the plot's top moved down, plus 17 px of plot. */
export const FUSE_FORM_HERO_MAX = 448;
/**
 * The phone hero's height, as an inline style. `minHeight` holds in an engine with no svh too, where `height` is dropped.
 * Below the floor the hero keeps its height and the page scrolls.
 */
export function fuseFormHeroBox() {
  const min = fuseFormHeroMin();
  return { minHeight: min, height: `clamp(${min}px, calc(100svh - ${FUSE_FORM_HERO_RESERVE}px), ${FUSE_FORM_HERO_MAX}px)` };
}
