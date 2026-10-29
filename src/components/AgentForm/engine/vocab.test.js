// src/components/AgentForm/engine/vocab.test.js
//
// Build S0 — the engine's pure vocabulary (Node): the states, growth tables and stills as the design ships
// them (docs/design/agent-identity-v2/af3-standalone.js.txt:19-44, :380), the fit stagger, and the equip
// tween on board 2's five keys (agent-boards-v2.jsx.txt:74-87).

import { describe, expect, it } from 'vitest';
import {
  STATES, MOODS, CORE, ARMOR, KINDS, FORM_ORDER, META, rng, hash, fitK, stillT, viewT0,
  EQUIP_KEYS, UNEQUIP_KEYS, EQUIP_MS, UNEQUIP_MS, fitAtMs, msAtFit, startTween, tweenFit,
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
