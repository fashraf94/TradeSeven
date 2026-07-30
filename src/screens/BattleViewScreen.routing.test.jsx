// src/screens/BattleViewScreen.routing.test.jsx
//
// League Battleview Routing (Spec V1.1, Phase A) — the discriminator + dispatch
// with the flag ON. The repo ships no jsdom/RTL, so we renderToString the screen
// with the child views injected as STUB props (BattleViewScreen already takes them
// as props) and assert which stub rendered. Effects never run, so the wrapper's
// Firestore subscription is never touched — we only prove the routing decision.
//
// The flag is mocked ON here so the new league branch is live; the dark
// (flag-OFF) fall-through is proven in BattleViewScreen.routing.dark.test.jsx.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  LEAGUE_BATTLEVIEW_ROUTING_ENABLED: true,
}));

// Imported AFTER the mock is registered (vi.mock is hoisted, so this is fine).
import BattleViewScreen from './BattleViewScreen';
import { isLeagueBattle } from './battleViewRouting';

const AGENT = 'AGENT_BATTLE_SCREEN_STUB';
const LEAGUE = 'LEAGUE_ARENA_STUB';

const baseProps = {
  containerStyle: {},
  isDesktop: true,
  user: { uid: 'u1' },
  battlePrices: {},
  battleTimer: { formatTimeRemaining: () => '' },
  onBack: () => {},
  onOpenFilmRoom: () => {},
  ActiveRiskChallengeIndicator: () => null,
  LoadingFallback: () => React.createElement('div', null, 'LOADING'),
  BaggerBombBattleViewRedesign: () => null,
  BaggerBombBattleViewConnected: () => null,
  BaggerBombTrainingBattleViewV3: () => null,
  BaggerBombBattleViewConnectedV4: () => null,
  BaggerBombTrainingBattleViewV4: () => null,
  AgentBattleScreen: () => React.createElement('div', null, AGENT),
  LeagueBattleViewConnected: () => React.createElement('div', null, LEAGUE),
};

const render = (currentBattle) =>
  renderToString(React.createElement(BattleViewScreen, { ...baseProps, currentBattle }));

describe('isLeagueBattle (pure discriminator)', () => {
  it('is true only for the flat-6 tournament gameMode', () => {
    expect(isLeagueBattle({ gameMode: 'baggerbomb_tournament' })).toBe(true);
  });
  it('is false for a BaggerBomb agent gameMode', () => {
    expect(isLeagueBattle({ gameMode: 'baggerbomb_agent' })).toBe(false);
  });
  it('is false when gameMode is absent (standalone agent deploy)', () => {
    expect(isLeagueBattle({ agentDeployed: true })).toBe(false);
  });
  it('is false for null/undefined', () => {
    expect(isLeagueBattle(null)).toBe(false);
    expect(isLeagueBattle(undefined)).toBe(false);
  });
});

describe('BattleViewScreen routing — flag ON', () => {
  it('AC1: a flat-6 league battle (also agentDeployed:true) opens the League Arena, not BaggerBomb', () => {
    const html = render({ id: 'b1', gameMode: 'baggerbomb_tournament', agentDeployed: true });
    expect(html).toContain(LEAGUE);
    expect(html).not.toContain(AGENT);
  });

  it('AC2: a BaggerBomb agent battle still opens AgentBattleScreen (no regression)', () => {
    const html = render({ id: 'b2', gameMode: 'baggerbomb_agent', agentDeployed: true });
    expect(html).toContain(AGENT);
    expect(html).not.toContain(LEAGUE);
  });

  it('a standalone agent deploy (no gameMode) still opens AgentBattleScreen', () => {
    const html = render({ id: 'b3', agentDeployed: true });
    expect(html).toContain(AGENT);
    expect(html).not.toContain(LEAGUE);
  });
});
