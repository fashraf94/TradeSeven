// src/screens/activeNavigation.shelvedSurfaces.test.jsx
//
// Active-containment — SHELVED-SURFACE NON-EXPOSURE.
//
// The live product routes only two battle families from navigation: agent
// battles (Compete tab → command dashboard → Deploy/Open) and league battles
// (League tab). Every BaggerBomb-PvP view (V2/V3/V4 connected + training +
// redesign) and the snake-draft view are SHELVED — present in the repo but with
// no live navigation entry. This suite locks two invariants that keep them
// shelved:
//
//   1. The ACTIVE command dashboards (CommandDashboard / CommandDashboardDesktop,
//      selected by COMMAND_DASHBOARD*_ENABLED) wire ONLY agent entry points and
//      none of the legacy PvP / snake-draft / training launchers that the
//      flag-off fallback dashboards (DashboardLoop / DashboardDesktop) still
//      carry. Proven by contrast so the absence is meaningful, not vacuous.
//
//   2. BattleViewScreen dispatches an agent battle to AgentBattleScreen even when
//      the battle also carries legacy shape markers (_v:3/4, isTraining) — the
//      `agentDeployed` branch (BattleViewScreen.jsx:43) is matched BEFORE every
//      _v/isTraining branch, so the active agent entry can never leak into a
//      shelved view.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  COMMAND_DASHBOARD_ENABLED,
  COMMAND_DASHBOARD_DESKTOP_ENABLED,
} from '../config/featureFlags';
import BattleViewScreen from './BattleViewScreen';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(SRC, rel), 'utf-8');

// Real triggers wired by the SHELVED fallback dashboards — the ways a user
// would reach a legacy PvP / snake-draft / BaggerBomb-training flow.
const LEGACY_LAUNCHERS = [
  'setShowBaggerBombModal',
  'setShowSnakeDraftModal',
  'setShowBaggerBombTrainingConfirm',
  'PendingLobbiesSection',
  "setScreen('draftBattle')",
];

const ACTIVE_DASHBOARDS = [
  'components/Dashboard/CommandDashboard.jsx',
  'components/Dashboard/CommandDashboardDesktop.jsx',
];
const SHELVED_FALLBACK_DASHBOARDS = [
  'components/Dashboard/DashboardLoop.jsx',
  'components/Dashboard/DashboardDesktop.jsx',
];

describe('active navigation — the agent command dashboards are the live surface', () => {
  it('COMMAND_DASHBOARD flags select the agent dashboards, not the legacy fallbacks', () => {
    expect(COMMAND_DASHBOARD_ENABLED).toBe(true);
    expect(COMMAND_DASHBOARD_DESKTOP_ENABLED).toBe(true);
  });
});

describe('active command dashboards expose no shelved-mode entry points', () => {
  // Non-vacuous guard: the launcher tokens are REAL and present in the shelved
  // fallbacks, so their absence in the active dashboards is a genuine signal.
  it('the shelved fallback dashboards DO wire the legacy launchers (guard)', () => {
    for (const rel of SHELVED_FALLBACK_DASHBOARDS) {
      const src = read(rel);
      const wired = LEGACY_LAUNCHERS.filter((t) => src.includes(t));
      expect(wired.length, `${rel} should still wire legacy launchers`).toBeGreaterThanOrEqual(3);
    }
  });

  it('the ACTIVE dashboards wire NONE of the legacy launchers', () => {
    for (const rel of ACTIVE_DASHBOARDS) {
      const src = read(rel);
      const leaked = LEGACY_LAUNCHERS.filter((t) => src.includes(t));
      expect(leaked, `${rel} must not expose shelved entry points`).toEqual([]);
    }
  });

  it('the ACTIVE dashboards wire the agent entry points (positive control)', () => {
    for (const rel of ACTIVE_DASHBOARDS) {
      const src = read(rel);
      expect(src, `${rel} should drive agent battles`).toContain('onCreateAgentBattle');
      expect(src).toContain('onOpenAgentBattle');
    }
  });
});

// ---- BattleViewScreen dispatch: an agent battle never opens a shelved view ----

const AGENT = 'AGENT_SCREEN_STUB';
const V3_TRAINING = 'V3_TRAINING_STUB';
const V4_TRAINING = 'V4_TRAINING_STUB';
const V4_PVP = 'V4_PVP_STUB';
const V23_PVP = 'V23_PVP_STUB';
const REDESIGN = 'REDESIGN_STUB';

const baseProps = {
  containerStyle: {},
  isDesktop: true,
  user: { uid: 'u1', username: 'u1' },
  battlePrices: {},
  battleTimer: { formatTimeRemaining: () => '' },
  onBack: () => {},
  onOpenFilmRoom: () => {},
  ActiveRiskChallengeIndicator: () => null,
  LoadingFallback: () => React.createElement('div', null, 'LOADING'),
  AgentBattleScreen: () => React.createElement('div', null, AGENT),
  BaggerBombTrainingBattleViewV3: () => React.createElement('div', null, V3_TRAINING),
  BaggerBombTrainingBattleViewV4: () => React.createElement('div', null, V4_TRAINING),
  BaggerBombBattleViewConnectedV4: () => React.createElement('div', null, V4_PVP),
  BaggerBombBattleViewConnected: () => React.createElement('div', null, V23_PVP),
  BaggerBombBattleViewRedesign: () => React.createElement('div', null, REDESIGN),
  LeagueBattleViewConnected: () => null,
};

const render = (currentBattle) =>
  renderToString(React.createElement(BattleViewScreen, { ...baseProps, currentBattle }));

const SHELVED_STUBS = [V3_TRAINING, V4_TRAINING, V4_PVP, V23_PVP, REDESIGN];

describe('BattleViewScreen — an active agent battle never opens a shelved view', () => {
  it('agentDeployed + _v:3 + isTraining still opens AgentBattleScreen (not V3 training)', () => {
    const html = render({ id: 'b1', agentDeployed: true, _v: 3, isTraining: true });
    expect(html).toContain(AGENT);
    for (const stub of SHELVED_STUBS) expect(html).not.toContain(stub);
  });

  it('agentDeployed + _v:4 still opens AgentBattleScreen (not the V4 PvP/training views)', () => {
    const html = render({ id: 'b2', agentDeployed: true, _v: 4, isTraining: true });
    expect(html).toContain(AGENT);
    for (const stub of SHELVED_STUBS) expect(html).not.toContain(stub);
  });

  it('a standalone agent deploy (no legacy markers) opens AgentBattleScreen', () => {
    const html = render({ id: 'b3', agentDeployed: true });
    expect(html).toContain(AGENT);
    for (const stub of SHELVED_STUBS) expect(html).not.toContain(stub);
  });
});
