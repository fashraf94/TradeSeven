// src/components/AgentForm/engine/vocab.test.js
//
// Build S0 — the engine's pure vocabulary (Node): the states, growth tables and stills as the design ships
// them (docs/design/agent-identity-v2/af3-standalone.js.txt:19-44, :380), the fit stagger, and the equip
// tween on board 2's five keys (agent-boards-v2.jsx.txt:74-87).

import { describe, expect, it } from 'vitest';
import {
  STATES, MOODS, CORE, ARMOR, KINDS, FORM_ORDER, META, rng, hash, fitK, stillT, viewT0,
  EQUIP_KEYS, UNEQUIP_KEYS, EQUIP_MS, UNEQUIP_MS, fitAtMs, msAtFit, startTween, tweenFit,
  FRAME_SCALE, FRAME_SHIFT, frameScale, frameShift, swapProgress, swapScale, swapShift, responseLift, RESPONSE_MS, RESPONSE_PEAK,
} from './vocab.js';

describe('the design vocabulary, as shipped', () => {
  it('six moods, three core and three armor stages, six sets, bare Shadow first in the build order', () => {
    expect(MOODS).toEqual(['idle', 'researching', 'confident', 'worried', 'waiting', 'celebrating']);
    expect(STATES.worried).toEqual({ speed: .65, coh: .4, bright: .68, lean: -1, spread: 1.22, signals: .5, bloom: 0, beacon: 0, open: -1, lift: 0, scan: 0 });
    expect(STATES.celebrating.bloom).toBe(4);
    expect(CORE.map((c) => c.loops)).toEqual([5, 7, 9]);
    expect(ARMOR.map((a) => a.etch)).toEqual([0, 1, 2]);
    expect(KINDS).toEqual(['trend', 'contra', 'spec', 'preserve', 'divers', 'fund']);
    expect(FORM_ORDER).toEqual(['none', ...KINDS]);
    expect(Object.keys(META)).toEqual(FORM_ORDER);
  });

  it('stillT: the designed moment per form, plus stage, seed and celebration offsets', () => {
    expect(stillT({ kind: 'fund' })).toBeCloseTo(8.4, 12);
    expect(stillT({ kind: 'trend', core: 2, armor: 1, seed: 1, state: 'celebrating' })).toBeCloseTo(7.7 + 1.4 + .4 + .31 + .6, 12);
    expect(stillT({ kind: 'not-a-form' })).toBeCloseTo(META.none.still, 12);
    expect(viewT0({ seed: 1, core: 1, armor: 2 })).toBeCloseTo((1.37 + 2.1 + 1.8) % 10, 12);
  });

  it('rng and hash are pure: the same seed gives the same sequence, every time', () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 50; i += 1) expect(a()).toBe(b());
    expect(hash(3, 7, 11)).toBe(hash(3, 7, 11));
    expect(hash(3, 7, 11)).not.toBe(hash(3, 7, 12));
    expect(rng(0)()).toBe(rng(1)()); // seed 0 runs as 1, as the design's
  });

  it('fitK: facet `order` starts at fit = st·order/(1+st) and seats over 1/(1+st) of the travel (board 2: 0.47·order and 53 % for st 0.9)', () => {
    expect(fitK(.9 * .5 / 1.9, .5, .9)).toBeCloseTo(0, 12);
    expect(fitK(.9 * .5 / 1.9 + 1 / 1.9, .5, .9)).toBeCloseTo(1, 12);
    expect(fitK(0, 0)).toBe(0);
    expect(fitK(1, 1)).toBe(1);
    expect(fitK(2, 0)).toBe(1);
  });
});

describe('the equip tween — board 2\'s keys, piecewise-linear', () => {
  it('equip runs 900 ms through 0 / .28 / .55 / .8 / 1, unequip 700 ms through 1 / .72 / .45 / .18 / 0', () => {
    expect(EQUIP_MS).toBe(900); expect(UNEQUIP_MS).toBe(700);
    for (const [ms, fit] of EQUIP_KEYS) expect(fitAtMs(EQUIP_KEYS, ms)).toBeCloseTo(fit, 12);
    for (const [ms, fit] of UNEQUIP_KEYS) expect(fitAtMs(UNEQUIP_KEYS, ms)).toBeCloseTo(fit, 12);
    expect(EQUIP_KEYS.map(([ms]) => ms)).toEqual([0, 220, 450, 700, 900]);
    expect(UNEQUIP_KEYS.map(([ms]) => ms)).toEqual([0, 180, 350, 550, 700]);
  });

  it('between keys it interpolates linearly; outside the timeline it holds the ends', () => {
    expect(fitAtMs(EQUIP_KEYS, 110)).toBeCloseTo(.14, 12);
    expect(fitAtMs(EQUIP_KEYS, 335)).toBeCloseTo(.415, 12);
    expect(fitAtMs(UNEQUIP_KEYS, 625)).toBeCloseTo(.09, 12);
    expect(fitAtMs(EQUIP_KEYS, -50)).toBe(0);
    expect(fitAtMs(EQUIP_KEYS, 5000)).toBe(1);
    expect(fitAtMs(UNEQUIP_KEYS, 5000)).toBe(0);
  });

  it('msAtFit inverts the timeline, so a reversal mid-tween continues from where the plates are (no jump)', () => {
    for (const f of [0, .1, .28, .4, .55, .7, .8, .95, 1]) {
      expect(fitAtMs(EQUIP_KEYS, msAtFit(EQUIP_KEYS, f))).toBeCloseTo(f, 12);
      expect(fitAtMs(UNEQUIP_KEYS, msAtFit(UNEQUIP_KEYS, f))).toBeCloseTo(f, 12);
    }
    // Unequip pressed at fit .45 (its 350 ms key): 200 ms later the plates are at the 550 ms key, .18.
    const t = startTween(false, 10000, .45);
    expect(tweenFit(t, 10000).fit).toBeCloseTo(.45, 12);
    expect(tweenFit(t, 10000 + (550 - 350)).fit).toBeCloseTo(.18, 12);
    // Equip pressed at .55 continues up from .55.
    const u = startTween(true, 0, .55);
    expect(tweenFit(u, 0).fit).toBeCloseTo(.55, 12);
    expect(tweenFit(u, 250).fit).toBeCloseTo(.8, 12);
  });

  it('tweenFit reports done exactly at the timeline\'s end', () => {
    const on = startTween(true, 0, 0);
    expect(tweenFit(on, 899).done).toBe(false);
    expect(tweenFit(on, 900)).toEqual({ fit: 1, done: true });
    const off = startTween(false, 0, 1);
    expect(tweenFit(off, 700)).toEqual({ fit: 0, done: true });
  });
});

// Build S1 (ruling R5): the swap's size step.
describe('the framing scales and the swap\'s size step (build S1, ruling R5)', () => {
  // Five frames are the design's (af3-standalone.js.txt:192, :213, :238, :258, :287, :314, :361). Ruling R18 (build S2)
  // gives two sets their own, on purpose, because the design's cut them off at the box's edge at every size: the design's
  // Trend Follower was .74 and its Diversifier .95. So this row, and every still compared against the design for those
  // two sets, differ from the design by that ruling. builders.test.js holds the new frames inside the box.
  it('each form\'s framing scale: the design\'s, but for the two sets of ruling R18; unknown is bare Shadow\'s', () => {
    expect(FRAME_SCALE).toEqual({ none: 1.25, trend: .65, contra: .95, spec: .9, preserve: .95, divers: .9, fund: .95 });
    expect(frameScale('spec')).toBe(.9);
    expect(frameScale('unknown')).toBe(1.25);
    expect(frameScale(undefined)).toBe(1.25);
    expect(frameScale('toString')).toBe(1.25);
  });

  it('only the Trend Follower\'s frame is shifted; anything else, unknown forms and names on Object.prototype included, is 0', () => {
    expect(FRAME_SHIFT).toEqual({ trend: .27 });
    expect(frameShift('trend')).toBe(.27);
    for (const kind of ['none', 'contra', 'spec', 'preserve', 'divers', 'fund', 'unknown', undefined, 'toString']) expect(frameShift(kind)).toBe(0);
  });

  it('a swap\'s shift travels with its scale: from the one last drawn, ending exactly on the new form\'s', () => {
    const on = { on: true, fit0: 0, shiftFrom: 0, shiftTo: .27 };
    expect(swapShift(on, 0)).toBe(0);
    expect(swapShift(on, .5)).toBeCloseTo(.135, 12);
    expect(swapShift(on, 1)).toBe(.27);
    const off = { on: false, fit0: .8, shiftFrom: .27, shiftTo: 0 };
    expect(swapShift(off, .8)).toBe(.27);
    expect(swapShift(off, 0)).toBe(0);
  });

  it('progress is the share of the travel since the tween began: 0 at its start, 1 at its end, either way', () => {
    expect(swapProgress(true, 0, 0)).toBe(0);
    expect(swapProgress(true, 0, .55)).toBeCloseTo(.55, 12);
    expect(swapProgress(true, 0, 1)).toBe(1);
    expect(swapProgress(true, .5, .5)).toBe(0);
    expect(swapProgress(true, .5, .75)).toBeCloseTo(.5, 12);
    expect(swapProgress(false, 1, 1)).toBe(0);
    expect(swapProgress(false, 1, .45)).toBeCloseTo(.55, 12);
    expect(swapProgress(false, .6, 0)).toBe(1);
    expect(swapProgress(true, 1, 1)).toBe(1);
    expect(swapProgress(false, 0, 0)).toBe(1);
  });

  it('the scale starts at the one last drawn and ends exactly on the new form\'s', () => {
    const on = { on: true, fit0: 0, from: 1.25, to: .74 };
    expect(swapScale(on, 0)).toBe(1.25);
    expect(swapScale(on, 1)).toBe(.74);
    expect(swapScale(on, .5)).toBeCloseTo(.995, 12);
    const off = { on: false, fit0: .8, from: .95, to: 1.25 };
    expect(swapScale(off, .8)).toBe(.95);
    expect(swapScale(off, 0)).toBe(1.25);
  });
});

// Build S2 (ruling R19): the response's curve, S7's sin(π p) over its 1.2 s. The hub's rows hold the numbers equal to S7's.
describe('the response\'s curve (build S2, ruling R19)', () => {
  it('starts and ends on the form as the mood draws it, and peaks half way', () => {
    expect(responseLift(0)).toBe(1);
    expect(responseLift(RESPONSE_MS / 2)).toBeCloseTo(1 + RESPONSE_PEAK, 12);
    expect(responseLift(RESPONSE_MS)).toBeCloseTo(1, 12);
    expect(responseLift(RESPONSE_MS * 2)).toBeCloseTo(1, 12);
  });

  it('rises and falls smoothly', () => {
    for (let ms = 0; ms < RESPONSE_MS; ms += 16) expect(Math.abs(responseLift(ms + 16) - responseLift(ms))).toBeLessThan(.05);
  });
});
