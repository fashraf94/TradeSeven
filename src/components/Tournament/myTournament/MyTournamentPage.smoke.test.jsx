// src/components/Tournament/myTournament/MyTournamentPage.smoke.test.jsx
//
// Render smoke for the "My Tournament" page in each of its three states. Uses
// react-dom/server (no DOM, so effects/subscriptions never run) — the page is
// pure and takes resolved data as props, so a fixture per state is enough to
// catch a runtime throw on mount and assert the surface actually composed with
// the spec corrections applied (single-shot draft, honest-empty bracket
// decorations, real tier, no fabricated percentile/topology).

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MyTournamentPage } from './MyTournamentPage';

const base = { title: 'Week of Jul 6', meta: 'Ranked · Weekly', compact: false };

describe('MyTournamentPage — awaiting', () => {
  const html = renderToString(
    <MyTournamentPage
      {...base}
      state="awaiting"
      awaiting={{
        segments: { past: false, d: 2, h: 4, m: 12 },
        lockLabel: 'Draft runs Monday morning · ET',
        pips: { human: 2, cpu: 1, open: 1, total: 4 },
        loadout: { archLabel: 'Momentum Hunter', watchlistName: 'Semis Momentum', tickers: ['NVDA', 'AMD'] },
        seatSub: 'Your group is set — locks at the Monday draft',
      }}
    />,
  );

  it('composes the countdown + fill + loadout + held seat', () => {
    expect(html).toContain('Draft countdown');
    expect(html).toContain('DAYS');                 // the segmented countdown
    expect(html).toContain('Tournament fill');
    expect(html).toContain('Your loadout');
    expect(html).toContain('Semis Momentum');       // real equipped watchlist
    expect(html).toContain('Your seat is held');
    expect(html.length).toBeGreaterThan(3000);
  });

  it('uses honest framing — no fabricated bracket topology', () => {
    expect(html).not.toContain('16 → 8 → 4');
    expect(html).toContain('Ranked · Weekly');
  });
});

describe('MyTournamentPage — drafting (single-shot resolution)', () => {
  const html = renderToString(
    <MyTournamentPage
      {...base}
      state="drafting"
      draft={{ yourPicks: ['NVDA', 'VST', 'COIN'], agentPicks: [] }}
    />,
  );

  it('shows the resolution beat + your three picks', () => {
    expect(html).toContain('Drafting your lineup');
    expect(html).toContain('Your three');
    expect(html).toContain('NVDA');
    expect(html.length).toBeGreaterThan(2500);
  });

  it('is NOT an interactive draft — no draft-board button', () => {
    expect(html).not.toContain('Go to the draft');
    expect(html).not.toContain('Your turn');
  });
});

describe('MyTournamentPage — bracket live', () => {
  const html = renderToString(
    <MyTournamentPage
      {...base}
      state="bracket"
      bracket={{
        seed: { n: 2, m: 12 },
        rank: { rp: 900, floorRp: 750 },   // → Associate, climbing toward Strategist
        standing: { composite: 4.3, podRank: 2 },
        pod: {
          name: 'East',
          seats: [
            { id: 'you', name: 'Atlas', kind: 'human', you: true, color: '#33B4C4', pscore: 4.3, arch: 'Momentum Hunter' },
            { id: 'vela', name: 'Vela', kind: 'human', color: '#5B8DEF', owner: '@dpark', pscore: 6.1, arch: 'Mean Reverter' },
            { id: 'helios', name: 'Helios', kind: 'cpu', color: '#9A8CE0', pscore: -0.8 },
            { id: 'ember', name: 'Ember', kind: 'cpu', color: '#9A8CE0', pscore: 1.0 },
          ],
        },
        battleDayLabel: 'Day 2 of 5',
      }}
      onOpenBattle={() => {}}
    />,
  );

  it('composes the seed hero, battle launch, pod, and path', () => {
    expect(html).toContain('Open my battle');   // the hero action
    expect(html).toContain('Seed · this field'); // seed identity
    expect(html).toContain('12');               // M = human field count (React SSR splits "of {m}")
    expect(html).toContain('Associate');        // real career tier (RANK_TIERS)
    expect(html).toContain('Atlas');            // real pod member
    expect(html.length).toBeGreaterThan(3500);
  });

  it('shows the REAL tier with NO fabricated percentile', () => {
    expect(html).not.toContain('top 12%');
    expect(html).not.toMatch(/top \d+%/i);
    expect(html).toContain('Climbing toward'); // next-tier progress (SSR splits the tier name off)
    expect(html).toContain('Strategist');
  });

  it('honest-empties the ranked-only bracket decorations', () => {
    expect(html).toContain('Advancement activates in the monthly bracket'); // pod advance-line
    expect(html).toContain('Activates in the monthly bracket');             // your-path funnel
    expect(html).not.toContain('CUT LINE');
    expect(html).not.toContain('TOP 2 ADVANCE');
  });
});
