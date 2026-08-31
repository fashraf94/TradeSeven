// src/components/League/LeagueLobbyDesktop.smoke.test.jsx
//
// Render smoke for the desktop League lobby + the Training Pod addition. Uses
// react-dom/server (no DOM, so effects/listeners never run) — enough to catch a
// runtime throw on mount and assert the surface actually composed, which build +
// lint cannot. Data + auth + signal deps are mocked so the fixtures path is
// deterministic and no Firestore listener is opened.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { leagueState } from './leagueFixtures';
import { GROUP_STATUS } from '../../constants/leagueTournament';

const { flagState } = vi.hoisted(() => ({ flagState: { on: false } }));

vi.mock('../../hooks/useLeagueState', () => ({
  default: () => ({ state: leagueState('open'), loading: false, isFixtures: true }),
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: null }) }));
vi.mock('../../services/tournamentGroupService', () => ({ subscribeMyGroup: () => () => {}, subscribeMyTrainingPod: () => () => {} }));
vi.mock('../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
// These transitively import the Firebase client (env-gated at module eval); stub
// them so the render smoke stays pure. The start path is exercised in app, not here.
vi.mock('../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => {}, mapLobbyError: () => 'error' }));
// SlotCenter (the no-game center) transitively imports the slot actions, whose
// fetchWithAuth pulls the env-gated Firebase client — stub like liveDraft.smoke.
vi.mock('../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }),
  claimSlot: () => Promise.resolve({}),
  releaseSlot: () => Promise.resolve({}),
  mapSlotActionError: () => 'error',
}));
vi.mock('./LoadoutChooserSheet', () => ({ default: () => null }));

// PRE-OPEN PHASE: only the gate is stubbed, so the REAL usePreOpenPhase and the
// REAL isPreOpenOnBattleDay tuple compare run under a fake system clock.
vi.mock('../../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isPreOpenPhaseRoutingOn: () => flagState.on };
});

const LeagueLobbyDesktop = (await import('./LeagueLobbyDesktop')).default;
const { DeskTrainingPanel, ActiveTrainingGameCard } = await import('./LeagueDeskParts');

describe('LeagueLobbyDesktop render smoke', () => {
  it('composes the no-game entry center (slot picker + Auto-draft + footnote) + leaderboard', () => {
    // SSR runs no effects, so activeGroup stays null → the no-game center: the
    // slot picker IS the entry, Auto-draft below, the bracket line a footnote.
    const html = renderToString(<LeagueLobbyDesktop onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={null} />);
    expect(html).toContain('Pick a draft slot');            // the picker center
    expect(html).toContain('Auto-draft');                   // the fallback lane below the slots
    expect(html).toContain('opens when the season locks');  // the demoted footnote (copy preserved)
    expect(html).toContain('Leaderboard');                  // the right-rail default
    expect(html).not.toContain('Enter tournament');         // stub CTA retired (P3)
    expect(html).not.toContain('Pick your mode');           // stub modal retired (P3)
    expect(html.length).toBeGreaterThan(3000);              // real surface, not an early bail
  });

  it('renders the Training Pod tab when the flag is on (default)', () => {
    const html = renderToString(<LeagueLobbyDesktop onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={null} />);
    expect(html).toContain('Training Pod');                 // the purple Ranked|Training tab
  });
});

describe('Training Pod panel render smoke', () => {
  it('cold-start shows the practice CTA', () => {
    const html = renderToString(<DeskTrainingPanel onOpenTrainingPod={() => {}} activeTrainingPod={null} hasAgent agentLoadout={null} />);
    expect(html).toContain('Practice the League format');
    expect(html).toContain('Start a training pod');
    expect(html).toContain('Every seat here is a CPU');     // the no-stakes note
  });

  it('re-entry replaces the CTA with the Active Training Game card (drafting)', () => {
    const pod = { id: 'tp1', status: GROUP_STATUS.DRAFTING };
    const html = renderToString(<DeskTrainingPanel onOpenTrainingPod={() => {}} activeTrainingPod={pod} hasAgent agentLoadout={null} />);
    expect(html).toContain('Resume your draft');
    expect(html).toContain('Training');                     // the practice badge
    expect(html).not.toContain('Start a training pod');     // CTA is replaced, not stacked
  });

  it('Active Training Game card surfaces a live training battle', () => {
    const pod = { id: 'tp2', status: GROUP_STATUS.BATTLE };
    const html = renderToString(<ActiveTrainingGameCard pod={pod} onResume={() => {}} />);
    expect(html).toContain('Return to your training pod');
    expect(html).toContain('LIVE');
  });
});

// ── PRE-OPEN PHASE (PREOPEN_PHASE_ROUTING_ENABLED) ───────────────────────────
// A training pod is BATTLE from its anchor date's midnight while the market is
// shut. The card already owns honest awaiting copy — a pre-open pod must reach it
// rather than showing the pulsing LIVE heartbeat.
describe('ActiveTrainingGameCard — pre-open phase', () => {
  const ANCHOR = '2026-08-27';
  const PRE_OPEN = '2026-08-27T12:00:00.000Z'; // ET 08:00
  const AFTER_BELL = '2026-08-27T13:30:00.000Z'; // ET 09:30
  const preOpenPod = { id: 'tp3', status: GROUP_STATUS.BATTLE, startAnchor: { anchorEtDate: ANCHOR } };
  const render = (pod) => renderToString(<ActiveTrainingGameCard pod={pod} onResume={() => {}} />);

  beforeEach(() => { vi.useFakeTimers(); flagState.on = false; });
  afterEach(() => { vi.useRealTimers(); });

  it('flag OFF: an anchored pod pre-open still reads LIVE (byte-equivalent to today)', () => {
    vi.setSystemTime(new Date(PRE_OPEN));
    const html = render(preOpenPod);
    expect(html).toContain('LIVE');
    expect(html).not.toContain('AWAITING OPEN');
  });

  it('flag ON: the same pod at the same instant reads AWAITING OPEN', () => {
    flagState.on = true;
    vi.setSystemTime(new Date(PRE_OPEN));
    const html = render(preOpenPod);
    expect(html).toContain('AWAITING OPEN');
    expect(html).not.toContain('>LIVE<');
  });

  it('flag ON: the same pod reads LIVE once the bell has rung', () => {
    flagState.on = true;
    vi.setSystemTime(new Date(AFTER_BELL));
    expect(render(preOpenPod)).toContain('LIVE');
  });

  it('flag ON: a pod with NO startAnchor is untouched — it still reads LIVE', () => {
    // The single-shot base-layer shape: no anchor, so the derivation cannot fire.
    flagState.on = true;
    vi.setSystemTime(new Date(PRE_OPEN));
    expect(render({ id: 'tp4', status: GROUP_STATUS.BATTLE })).toContain('LIVE');
  });

  it('flag ON: an AWAITING_OPEN pod keeps its existing label', () => {
    flagState.on = true;
    vi.setSystemTime(new Date(PRE_OPEN));
    expect(render({ id: 'tp5', status: GROUP_STATUS.AWAITING_OPEN })).toContain('AWAITING OPEN');
  });

  it('anti-vacuous: the flag is what changes the answer', () => {
    vi.setSystemTime(new Date(PRE_OPEN));
    flagState.on = false;
    const off = render(preOpenPod);
    flagState.on = true;
    const on = render(preOpenPod);
    expect(off).not.toBe(on);
  });
});
