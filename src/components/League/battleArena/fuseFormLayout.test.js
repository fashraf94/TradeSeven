// src/components/League/battleArena/fuseFormLayout.test.js
//
// Agent form build S2, arena fit (the founder's iPhone run, Oct 30, 2026) — where the forms sit, to the pixel. The anchor
// rule, the bunched rule (order and least movement), the plot's top against the scope toggle, the headroom a bunch at an
// edge makes, and the phone hero's floor. The rendered side is leagueAgentForm.sites.jsdom.test.jsx.
// This file's import is the dependency-surface guard for fuseFormLayout.js: it must stay node-clean.

import { describe, expect, it } from 'vitest';
import { fuseFrame, makeScale } from './fuseGeometry';
import { MOBILE_DOCK_ROW, MOBILE_HERO_MAX, mobileHeroHeight } from './mobileHeroHeight';
import {
  FUSE_FORM_HERO_MAX, FUSE_FORM_HERO_RESERVE, FUSE_FORM_PIN_ROOM, FUSE_FORM_PX, anchorFigures, fuseFormFrame, fuseFormHeroBox,
  fuseFormHeroMin, fuseFormPinTop, fuseFormPx, fuseFormScale, fuseFormStackPx,
} from './fuseFormLayout';

const YOU = FUSE_FORM_PX.compact.you;
const RIVAL = FUSE_FORM_PX.compact.rival;
const seats = (ys) => Object.entries(ys).map(([id, y]) => ({ id, y, size: id === 'you' ? YOU : RIVAL }));
const inOrder = (centres, ys) => Object.keys(ys).sort((a, b) => ys[a] - ys[b]).map((id) => centres[id]);
const offsets = (centres, ys) => Object.fromEntries(Object.keys(ys).map((id) => [id, centres[id] - ys[id]]));
const sumSquares = (o) => Object.values(o).reduce((sum, v) => sum + v * v, 0);

/** Fixed-seed pseudo-random, so a failure replays. */
function randoms(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

describe('the anchor rule: a figure\'s centre is its own point', () => {
  it('points a figure\'s height or more apart stay exactly where they are', () => {
    const ys = { you: 100, a: 150, b: 200, c: 250 };
    expect(anchorFigures(seats(ys))).toEqual(ys);
  });

  it('holds to the pixel at the gap itself: 49 px around the player, 46 px between rivals', () => {
    const ys = { a: 100, you: 149, b: 198, c: 244 };
    expect(anchorFigures(seats(ys))).toEqual(ys);
  });

  it('one seat alone, and no seats at all', () => {
    expect(anchorFigures(seats({ you: 123.5 }))).toEqual({ you: 123.5 });
    expect(anchorFigures([])).toEqual({});
  });
});

describe('the bunched rule: order and the least movement', () => {
  it('two points part symmetrically, each by half of what they lack', () => {
    const ys = { a: 200, b: 210 };
    const out = anchorFigures(seats(ys));
    expect(out.a).toBe(200 - 18);
    expect(out.b).toBe(210 + 18);
  });

  it('a bunch of four spreads around the mean of its points: its offsets sum to zero', () => {
    const ys = { a: 200, you: 202, b: 204, c: 206 };
    const offs = offsets(anchorFigures(seats(ys)), ys);
    expect(Object.values(offs).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 8);
    // The player's wider gap sits on one side of the middle, so the two ends differ by that much and no more.
    expect(Math.abs(offs.a + offs.c)).toBeLessThanOrEqual(3);
  });

  it('seats clear of a bunch do not move, and the bunch does not push them', () => {
    const ys = { a: 100, you: 300, b: 305, c: 500 };
    const out = anchorFigures(seats(ys));
    expect(out.a).toBe(100);
    expect(out.c).toBe(500);
    expect(out.you).toBeCloseTo(278, 8);
    expect(out.b).toBeCloseTo(327, 8);
  });

  it('a chain joins up: one pair parting into the next takes them all along, still around their mean', () => {
    const ys = { a: 100, b: 130, c: 160 };
    const out = anchorFigures(seats(ys));
    expect(out.b).toBeCloseTo(130, 8);
    expect(out.a).toBeCloseTo(84, 8);
    expect(out.c).toBeCloseTo(176, 8);
  });

  it('order never flips and no two figures sit closer than the gap, over 2,000 boards', () => {
    const r = randoms(7);
    for (let n = 0; n < 2000; n += 1) {
      const span = 20 + r() * 400;
      const ys = { a: r() * span, you: r() * span, b: r() * span, c: r() * span };
      const order = Object.keys(ys).sort((x, y) => ys[x] - ys[y]);
      const out = anchorFigures(seats(ys));
      for (let i = 1; i < 4; i += 1) {
        const [upper, lower] = [order[i - 1], order[i]];
        const need = ((upper === 'you' ? YOU : RIVAL) + (lower === 'you' ? YOU : RIVAL)) / 2 + 2;
        expect(out[lower] - out[upper]).toBeGreaterThanOrEqual(need - 1e-9);
      }
    }
  });

  it('it is the least movement: no legal stack of the same order moves the seats less', () => {
    const r = randoms(11);
    for (let n = 0; n < 300; n += 1) {
      const ys = { a: r() * 120, you: r() * 120, b: r() * 120, c: r() * 120 };
      const order = Object.keys(ys).sort((x, y) => ys[x] - ys[y]);
      const out = anchorFigures(seats(ys));
      const best = sumSquares(offsets(out, ys));
      // Nudge any one seat, and everything below it, either way: what stays legal costs more.
      for (const nudge of [-3, -1, 1, 3]) for (let from = 0; from < 4; from += 1) {
        const moved = { ...out };
        for (let i = from; i < 4; i += 1) moved[order[i]] += nudge;
        const legal = order.every((id, i) => i === 0 || moved[id] - moved[order[i - 1]] >= ((id === 'you' ? YOU : RIVAL) + (order[i - 1] === 'you' ? YOU : RIVAL)) / 2 + 2 - 1e-9);
        if (legal) expect(sumSquares(offsets(moved, ys))).toBeGreaterThanOrEqual(best - 1e-6);
      }
    }
  });

  it('a tie keeps the seats\' own order', () => {
    const ys = { a: 200, b: 200, c: 200 };
    const out = anchorFigures(seats(ys));
    expect(out.a).toBeLessThan(out.b);
    expect(out.b).toBeLessThan(out.c);
  });

  it('bounds hold the whole stack in, keeping its order', () => {
    const ys = { a: 90, you: 92, b: 94, c: 96 };
    const out = anchorFigures(seats(ys), 90, 400);
    expect(out.a).toBe(90);
    expect(inOrder(out, ys)).toEqual([...inOrder(out, ys)].sort((a, b) => a - b));
    const low = anchorFigures(seats({ a: 390, you: 392, b: 394, c: 396 }), 90, 400);
    expect(low.c).toBe(400);
  });
});

describe('the plot\'s top against the Today / The week toggle', () => {
  it('the highest point\'s figure, its crown and its value all clear the head row, phone and desktop', () => {
    // Measured with the app's stylesheet: the row ends at 46 px on the phone, 52 on the desktop's stage. The crown stands 9
    // and 12 px over the form, and the leader's value column (37 px) sits inside the form's own height.
    expect(fuseFormFrame({ w: 364, h: 356, compact: true }).plotT - YOU / 2 - 9).toBeGreaterThanOrEqual(46);
    expect(fuseFormFrame({ w: 1316, h: 420 }).plotT - FUSE_FORM_PX.desktop.you / 2 - 12).toBeGreaterThanOrEqual(52);
    expect(37 / 2).toBeLessThan(YOU / 2);
  });

  it('only the top moves: the plot\'s floor, its sides and today\'s frame stay as they are', () => {
    const today = fuseFrame({ w: 364, h: 356, compact: true });
    const forms = fuseFormFrame({ w: 364, h: 356, compact: true });
    expect(forms).toMatchObject({ floorY: today.floorY, plotB: today.plotB, plotR: today.plotR, padL: today.padL });
    expect(forms.plotT).toBeGreaterThan(today.plotT);
    expect(forms.spanY).toBe(forms.floorY - forms.plotT);
    expect(today.plotT).toBe(34);
  });

  it('the plain scale puts the highest point on the plot\'s top: the frame\'s clearance is the highest figure\'s', () => {
    const frame = fuseFormFrame({ w: 364, h: 356, compact: true });
    const { Y } = makeScale({ values: [0, 10], day: true, plotT: frame.plotT, floorY: frame.floorY });
    expect(Y(10)).toBe(frame.plotT);
  });
});

describe('the scale makes room for a bunch at an edge', () => {
  const frame = fuseFormFrame({ w: 364, h: 356, compact: true });
  const board = (vs) => {
    const tips = Object.entries(vs).map(([id, v]) => ({ id, v, size: id === 'you' ? YOU : RIVAL }));
    const values = [0, ...Object.values(vs)];
    const scale = fuseFormScale({ values, day: true, frame, tips });
    const ys = Object.fromEntries(tips.map((t) => [t.id, scale.Y(t.v)]));
    return { scale, ys, centres: anchorFigures(seats(ys), frame.plotT, frame.floorY) };
  };

  it('a spread board takes the plain scale, untouched', () => {
    const vs = { a: 8.84, you: 6.3, b: 3.78, c: 1.28 };
    const { scale } = board(vs);
    const plain = makeScale({ values: [0, ...Object.values(vs)], day: true, plotT: frame.plotT, floorY: frame.floorY });
    for (const v of [0, 1.28, 3.78, 6.3, 8.84]) expect(scale.Y(v)).toBe(plain.Y(v));
  });

  it('four seats bunched at the top part around their points, not down from them', () => {
    const vs = { a: 8.84, you: 8.8, b: 8.76, c: 8.72 };
    const { ys, centres } = board(vs);
    const offs = Object.values(offsets(centres, ys));
    expect(Math.min(...offs)).toBeLessThan(-60);
    expect(Math.max(...offs)).toBeGreaterThan(60);
    expect(offs.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 0);
    expect(Math.max(...offs.map(Math.abs))).toBeLessThan(fuseFormStackPx(true) / 2 + 2);
    expect(Math.min(...Object.values(centres))).toBeGreaterThanOrEqual(frame.plotT - 0.5);
  });

  it('a bunch at the floor does the same, and stays inside the plot', () => {
    const { ys, centres } = board({ a: 2.1, you: -8.7, b: -8.8, c: -8.9 });
    const low = ['you', 'b', 'c'].map((id) => centres[id] - ys[id]);
    expect(low.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 0);
    expect(Math.min(...low)).toBeLessThan(-40);
    expect(Math.max(...low)).toBeGreaterThan(40);
    expect(Math.max(...Object.values(centres))).toBeLessThanOrEqual(frame.floorY + 0.5);
    expect(centres.a).toBeCloseTo(ys.a, 5);
  });

  it('every seat level at the open: the stack sits around the open line', () => {
    const { scale, centres } = board({ a: 0, you: 0, b: 0, c: 0 });
    const line = scale.Y(0);
    expect(Math.min(...Object.values(centres))).toBeLessThan(line);
    expect(Math.max(...Object.values(centres))).toBeGreaterThan(line);
    expect(Math.max(...Object.values(centres))).toBeLessThanOrEqual(frame.floorY + 0.5);
  });

  it('the week\'s basement scale takes the same room, through the real makeScale', () => {
    const tips = [{ id: 'a', v: 100, size: RIVAL }, { id: 'you', v: 99.5, size: YOU }, { id: 'b', v: 99, size: RIVAL }, { id: 'c', v: -60, size: RIVAL }];
    const scale = fuseFormScale({ values: tips.map((t) => t.v), day: false, frame, tips });
    expect(scale.basement).toBeGreaterThan(0);
    const ys = Object.fromEntries(tips.map((t) => [t.id, scale.Y(t.v)]));
    const centres = anchorFigures(seats(ys), frame.plotT, frame.floorY);
    const offs = ['a', 'you', 'b'].map((id) => centres[id] - ys[id]);
    expect(Math.abs(offs.reduce((a, b) => a + b, 0))).toBeLessThan(1);
    expect(Math.min(...offs)).toBeLessThan(-30);
    expect(Math.max(...offs)).toBeGreaterThan(30);
  });

  it('a seat sliding through another: nothing jumps as a bunch forms and breaks up', () => {
    let previous = null;
    let widest = 0;
    let widestTop = 0;
    for (let v = 0; v <= 12; v += 0.02) {
      const { scale, centres } = board({ a: 9, you: 6, b: 3, c: v });
      if (previous) {
        for (const id of ['a', 'you', 'b', 'c']) widest = Math.max(widest, Math.abs(centres[id] - previous.centres[id]));
        widestTop = Math.max(widestTop, Math.abs(scale.Y(12) - previous.scale.Y(12)));
      }
      previous = { scale, centres };
    }
    // A 0.02-point step is a third of a px of plot; the crossing itself swaps two figures' places, and is the one real step.
    expect(widestTop).toBeLessThan(4);
    expect(widest).toBeLessThan(60);
  });
});

describe('the phone hero', () => {
  it('its floor fits four figures: the plot\'s top, the tallest stack, the room below the floor', () => {
    const frame = fuseFormFrame({ w: 364, h: fuseFormHeroMin(), compact: true });
    expect(frame.floorY - frame.plotT).toBeGreaterThanOrEqual(fuseFormStackPx(true));
    expect(fuseFormStackPx(true)).toBe(2 * ((YOU + RIVAL) / 2 + 2) + (RIVAL + 2));
    const shorter = fuseFormFrame({ w: 364, h: fuseFormHeroMin() - 1, compact: true });
    expect(shorter.floorY - shorter.plotT).toBeLessThan(fuseFormStackPx(true));
  });

  it('at the floor every bunch stays inside the plot, however it falls', () => {
    const r = randoms(23);
    const h = fuseFormHeroMin();
    const frame = fuseFormFrame({ w: 364, h, compact: true });
    for (let n = 0; n < 500; n += 1) {
      const hi = 1 + r() * 50;
      const tips = ['a', 'you', 'b', 'c'].map((id) => ({ id, v: hi * (r() * 1.4 - 0.4), size: id === 'you' ? YOU : RIVAL }));
      const scale = fuseFormScale({ values: [0, ...tips.map((t) => t.v)], day: true, frame, tips });
      const ys = Object.fromEntries(tips.map((t) => [t.id, scale.Y(t.v)]));
      const out = Object.values(anchorFigures(seats(ys), frame.plotT, frame.floorY));
      expect(Math.min(...out)).toBeGreaterThanOrEqual(frame.plotT - 1e-6);
      expect(Math.max(...out)).toBeLessThanOrEqual(frame.floorY + 1e-6);
    }
  });

  it('its height is the floor, the screen less one and a half dock rows and the chrome, or the ceiling, inline', () => {
    const { minHeight, height } = fuseFormHeroBox();
    expect(minHeight).toBe(fuseFormHeroMin());
    expect(height).toBe(`clamp(${fuseFormHeroMin()}px, calc(100svh - ${FUSE_FORM_HERO_RESERVE}px), ${FUSE_FORM_HERO_MAX}px)`);
    expect(FUSE_FORM_HERO_RESERVE).toBe(Math.round(110 + 1.5 * MOBILE_DOCK_ROW));
  });

  it('the plot only grows: at every usable height the span beats today\'s, with today\'s hero and today\'s frame', () => {
    for (let vh = 480; vh <= 1000; vh += 5) {
      const today = mobileHeroHeight({ usableVh: vh });
      const forms = Math.max(fuseFormHeroMin(), Math.min(FUSE_FORM_HERO_MAX, vh - FUSE_FORM_HERO_RESERVE));
      const before = fuseFrame({ w: 364, h: today, compact: true }).spanY;
      const after = fuseFormFrame({ w: 364, h: forms, compact: true }).spanY;
      expect(after, `usable ${vh}`).toBeGreaterThanOrEqual(before + 17);
    }
    expect(FUSE_FORM_HERO_MAX).toBeGreaterThan(MOBILE_HERO_MAX);
  });

  it('the sticky block pins above the screen\'s top by what it lacks, so a dock row always shows', () => {
    expect(fuseFormPinTop()).toBe(`min(0px, calc(100svh - clamp(${fuseFormHeroMin()}px, calc(100svh - ${FUSE_FORM_HERO_RESERVE}px), ${FUSE_FORM_HERO_MAX}px) - ${FUSE_FORM_PIN_ROOM}px))`);
    expect(FUSE_FORM_PIN_ROOM).toBeGreaterThanOrEqual(245 + MOBILE_DOCK_ROW);
  });

  it('every seat keeps its size: the arena grew, the figures did not shrink (the founder\'s ruling)', () => {
    expect([fuseFormPx(true, true), fuseFormPx(false, true), fuseFormPx(true, false), fuseFormPx(false, false)]).toEqual([50, 44, 64, 56]);
  });
});
