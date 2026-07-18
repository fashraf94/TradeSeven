// src/components/League/LeagueLobbyDesktop.smoke.test.jsx
//
// Render smoke for the desktop League lobby + the Training Pod addition. Uses
// react-dom/server (no DOM, so effects/listeners never run) — enough to catch a
// runtime throw on mount and assert the surface actually composed, which build +
// lint cannot. Data + auth + signal deps are mocked so the fixtures path is
// deterministic and no Firestore listener is opened.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { leagueState } from './leagueFixtures';
import { GROUP_STATUS } from '../../constants/leagueTournament';

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
