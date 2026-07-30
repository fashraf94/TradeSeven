// src/screens/leagueBattleViewRender.gate.test.jsx
//
// League Battleview Routing (Spec V1.2, Correction 1 / D1b) — the Arena-gate
// fallback. With ARENA_LIVE_ON OFF, the card path must fall back to the classic
// Flat6BattleView, exactly as the League tab does — never render the Arena on one
// surface while the tab shows classic on the other. The two views are stubbed so
// we can tell which rendered; arenaLiveGate is mocked OFF.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../components/League/battleArena/arenaLiveGate', () => ({ ARENA_LIVE_ON: false }));
vi.mock('../components/Tournament/Flat6BattleView', () => ({
  default: () => React.createElement('div', null, 'FLAT6_CLASSIC_STUB'),
}));
vi.mock('../components/League/battleArena/LeagueBattleArenaLive', () => ({
  default: () => React.createElement('div', null, 'ARENA_STUB'),
}));

import LeagueBattleViewRender from './leagueBattleViewRender';

const props = {
  group: { id: 'g1' },
  battle: { id: 'b1' },
  mode: 'ranked',
  uid: 'u1',
  compositeContext: { composite: 10, userPoints: 4 },
  isDesktop: true,
  onBack: () => {},
};

describe('LeagueBattleViewRender — Arena gate OFF (Correction 1 / D1b)', () => {
  it('falls back to classic Flat6BattleView, not the Arena, when ARENA_LIVE_ON is false', () => {
    const html = renderToString(React.createElement(LeagueBattleViewRender, props));
    expect(html).toContain('FLAT6_CLASSIC_STUB');
    expect(html).not.toContain('ARENA_STUB');
  });
});
