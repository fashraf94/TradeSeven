// src/screens/BattleViewScreen.routing.dark.test.jsx
//
// League Battleview Routing (Spec V1.1, Phase A) — the merge-DARK safety property.
// With LEAGUE_BATTLEVIEW_ROUTING_ENABLED OFF, a flat-6 league battle must fall
// through to the existing agentDeployed→AgentBattleScreen branch, byte-identical to
// today (the mis-route stays, but dark). The flag is mocked OFF explicitly so this
// stays valid after the separate flip PR turns the real flag on.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  LEAGUE_BATTLEVIEW_ROUTING_ENABLED: false,
}));

import BattleViewScreen from './BattleViewScreen';

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

describe('BattleViewScreen routing — flag OFF (dark)', () => {
  it('a flat-6 league battle falls through to AgentBattleScreen (byte-identical to today)', () => {
    const html = render({ id: 'b1', gameMode: 'baggerbomb_tournament', agentDeployed: true });
    expect(html).toContain(AGENT);
    expect(html).not.toContain(LEAGUE);
  });
});
