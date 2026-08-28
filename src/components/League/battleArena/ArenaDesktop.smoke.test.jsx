// src/components/League/battleArena/ArenaDesktop.smoke.test.jsx
//
// Render smoke for the desktop arena. The repo ships no jsdom/RTL setup, but
// react-dom/server renders the full component tree WITHOUT a DOM (effects don't
// run, so ResizeObserver / rAF / matchMedia are never touched) — enough to catch
// a runtime throw on mount across every state × mode, which the build + lint
// cannot. Asserts the surface actually composed (key copy + substantial output).

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ArenaDesktop } from './ArenaDesktop';

describe('ArenaDesktop render smoke', () => {
  for (const state of ['awaiting', 'live', 'complete']) {
    for (const mode of ['training', 'ranked']) {
      it(`mounts in ${state} / ${mode} without throwing`, () => {
        const html = renderToString(<ArenaDesktop state={state} mode={mode} onBack={() => {}} />);
        expect(html).toContain('Your three');     // the your-three dock composed
        expect(html).toContain('watch-only');      // the agent-six dock composed
        expect(html.length).toBeGreaterThan(2000); // real surface, not an early bail
      });
    }
  }

  // the real-data path (data != null) must also compose (still no DOM —
  // renderToString only). Mirrors the buildArenaModel output shape.
  const DATA = {
    seats: [
      { id: 'you', name: 'You', kind: 'you', you: true, color: '#5EEAD4', arch: 'Speculator' },
      { id: 'cpu-1', name: 'CPU — Trend Follower', kind: 'cpu', you: false, arch: undefined },
      { id: 'r', name: 'Riva', kind: 'human', you: false, owner: 'Riva', arch: undefined },
      { id: 'cpu-2', name: 'CPU — Contrarian', kind: 'cpu', you: false, arch: undefined },
    ],
    climb: { you: [-1.2, 1.4], 'cpu-1': [2.1, 3.0], r: [3.2, 5.8], 'cpu-2': [0.4, -0.8] },
    youId: 'you',
    agentStars: [{ tk: 'NVDA', tier: 'star', dir: 'long', mult: 0.7, banked: 0, points: 0, badge: null, state: 'heating', justIn: false }],
    userStars: [{ tk: 'GE', tier: 'support', dir: 'long', mult: 0.6, banked: 0, points: 0, badge: null, state: 'heating', justIn: false }],
    beats: [],
    voice: { arch: 'Speculator', greet: { kind: 'greeting', text: 'hi' }, wait: { kind: 'anticipation', text: 'wait' }, live: [] },
    pod: { day: 2, days: 5, watchers: 47, toOpen: null, nextClose: null },
    wire: { open: true, closes: 600, claimsUsed: 0, claimsTotal: 3 },
    youRank: 3, headline: 'mult', compositeContext: { composite: 1.4, userPoints: 0.5 },
    claim: { picks: [{ symbol: 'GE' }], poolNames: ['NVDA'], claimsUsed: 0, claimsTotal: 3, open: true },
    agentMove: null, ask: [],
  };
  it('composes the data-fed (real) path without throwing', () => {
    const html = renderToString(<ArenaDesktop state="live" mode="ranked" data={DATA} onBack={null} />);
    expect(html).toContain('Your three');
    expect(html).toContain('NVDA'); // a real agent star rendered
    expect(html.length).toBeGreaterThan(2000);
  });

  // L-A follow-up (B) — a VOIDED cohort suppresses BOTH the placement interstitial
  // (DockStatePanel) AND the hero board's standings signifiers (crown/rank/cut/
  // scores), stating the void instead. Film Room stays (review only). Uses the
  // spread-score DATA so the NON-voided render actually carries the cut, making the
  // suppression a real mutation check, not a vacuous absence.
  // PINS MOVED BY THE FLIP, DELIBERATELY. These two rows asserted the cut through
  // ClimbArena's copy ("CUT · TOP 2 ADVANCE"). The CONTRACT under test — a voided
  // cohort suppresses the placement claim on the hero board — is unchanged; only
  // the board that expresses it is. FuseHero draws the cut as a `data-fh-cut`
  // group (gold dashed line + make-it band), gated on the same `!voided`, so the
  // rows now read the live board's own marker. ClimbArena keeps its own copy pin
  // in ClimbArena.test.jsx, where it belongs while it remains the rollback path.
  it('a VOIDED complete run shows no placement/standings and states the void', () => {
    const html = renderToString(<ArenaDesktop state="complete" mode="ranked" data={DATA} voided onBack={() => {}} />);
    expect(html).not.toContain('of four');        // no placement ordinal
    expect(html).not.toContain('You advanced');    // no advanced framing
    expect(html).not.toContain('Run ended');       // no eliminated framing
    expect(html).not.toContain('data-fh-cut');     // no cut/standings on the board
    expect(html).toContain('No result recorded');   // the verdict states the void
    expect(html).toContain('Film Room');            // kept for review only
    expect(html.length).toBeGreaterThan(2000);
  });

  it('the SAME complete run WITHOUT voided DOES show placement + cut (suppression is real)', () => {
    const html = renderToString(<ArenaDesktop state="complete" mode="ranked" data={DATA} onBack={() => {}} />);
    expect(html).toContain('of four');        // placement present when not voided
    expect(html).toContain('data-fh-cut');    // the cut/standings present when not voided
  });
});
