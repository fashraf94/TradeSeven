// src/components/League/battleArena/ClimbArena.test.jsx
//
// Focused render checks for the two Day-0 / mobile cleanups:
//   1) the cut label is suppressed while the climb is "at rest" (no spread — Day 0,
//      every seat tied) so it can't draw through the base-camp orb band, and it
//      returns once scores separate;
//   2) the under-orb name row is DESKTOP-only — the compact (mobile) climb drops it.
// renderToString with no DOM, mirroring the ArenaDesktop/ArenaMobile smokes (effects
// don't run; this catches a throw on mount + locks the conditional chrome).

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ClimbArena } from './ClimbArena';

const SEATS = [
  { id: 'you', name: 'Atlas', kind: 'you', you: true, color: '#5EEAD4', arch: 'Speculator' },
  { id: 'vela', name: 'Vela', kind: 'human', you: false, color: '#F2C14E' },
  { id: 'helios', name: 'Helios', kind: 'cpu', you: false, color: '#B79CED' },
  { id: 'ember', name: 'Ember', kind: 'cpu', you: false, color: '#E8924A' },
];
const SPREAD = { you: [0, 0.5], vela: [0, 3], helios: [0, 2], ember: [0, 1] }; // dayIdx 1: separated
const FLAT = { you: [0, 0], vela: [0, 0], helios: [0, 0], ember: [0, 0] };     // Day 0: every seat tied

const render = (props) => renderToString(
  <ClimbArena state="live" mode="ranked" seats={SEATS} youId="you" w={1200} h={384} dayIdx={1} {...props} />,
);

describe('ClimbArena — cut label vs the at-rest (Day-0) state', () => {
  it('suppresses the cut label + climb trails while every seat is tied (Day 0)', () => {
    const html = render({ climb: FLAT });
    expect(html).not.toContain('CUT');     // no cut label across the base-camp orbs
    expect(html).not.toContain('bv2cl');   // no climb-trail gradients floating from the zero line
  });
  it('renders the cut label + trails once scores spread', () => {
    const html = render({ climb: SPREAD });
    expect(html).toContain('CUT · TOP 2 ADVANCE');
    expect(html).toContain('bv2cl');
  });
  it('treats a non-zero tie as CLIMBED (not at-rest) — trails stay, only all-zero rests', () => {
    // every seat tied at the same NON-zero altitude has separated from the start;
    // it must plot at altitude (trails drawn), not collapse to base camp.
    const tiedHigh = { you: [0, 5], vela: [0, 5], helios: [0, 5], ember: [0, 5] };
    expect(render({ climb: tiedHigh })).toContain('bv2cl');
  });
});

describe('ClimbArena — youLiveScore overrides the your-seat orb (Branch 1)', () => {
  it('renders your LIVE composite in the orb instead of the banked value', () => {
    const banked = render({ climb: FLAT });                    // banked: you at 0
    const live = render({ climb: FLAT, youLiveScore: 6.5 });   // your live intraday composite
    // Anchor to the orb's TEXT node (>6.5<) — the seeded atmosphere sprays decimals
    // into style attributes, but never as element text.
    expect(live).toContain('>6.5<');       // the live number is on your orb
    expect(banked).not.toContain('>6.5<'); // the banked orb never showed it
  });
  it('lifts your orb off the Day-0 base camp — a live you-score separates the field', () => {
    // FLAT banked = every seat tied at 0 (at rest, no trails). A live you-score
    // means only YOUR current point moved, so the field separates and trails draw.
    expect(render({ climb: FLAT })).not.toContain('bv2cl');
    expect(render({ climb: FLAT, youLiveScore: 6.5 })).toContain('bv2cl');
  });
  it('leaves rival orbs on the banked series (youLiveScore touches only the you-seat)', () => {
    // rivals keep their banked spread → the cut still computes from their series.
    expect(render({ climb: SPREAD, youLiveScore: 99 })).toContain('CUT · TOP 2 ADVANCE');
  });
  it('fills your trail — your last banked close becomes a dot when the live orb lifts off it (Item C)', () => {
    // Trail dots render at r="2.2". When your orb goes live it leaves scores[lastIdx];
    // that banked close is now drawn as a dot, so the live render has exactly one more.
    const dots = (html) => (html.match(/r="2.2"/g) || []).length;
    expect(dots(render({ climb: SPREAD, youLiveScore: 6.5 }))).toBe(dots(render({ climb: SPREAD })) + 1);
  });
});

describe('ClimbArena — under-orb name row is desktop-only', () => {
  it('shows seat names on the desktop climb', () => {
    const html = render({ climb: SPREAD, compact: false });
    expect(html).toContain('Vela');
    expect(html).toContain('Helios');
  });
  it('drops the name row entirely on the compact (mobile) climb', () => {
    const html = render({ climb: SPREAD, compact: true });
    expect(html).not.toContain('Vela');
    expect(html).not.toContain('Helios');
  });
});
