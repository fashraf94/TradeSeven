// src/components/League/TrainingClimbPreview.smoke.test.jsx
//
// Render smoke for the Training-tab climb preview — proves it composes the REAL
// climb from a live pod doc (via buildArenaModel → ClimbArena), not fixtures, and
// doesn't throw on mount. renderToString with no DOM (effects/listeners don't run,
// so no Firestore read + no ResizeObserver), mirroring the ClimbArena/ArenaDesktop
// smokes. fetchDisplayNames is stubbed so the module import stays Firebase-free.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GROUP_STATUS } from '../../constants/leagueTournament';

vi.mock('../../services/tournamentGroupService', () => ({
  fetchDisplayNames: () => Promise.resolve({}),
}));

const TrainingClimbPreview = (await import('./TrainingClimbPreview')).default;

// A live training pod (tournamentGroups doc shape) — four seats, two banked
// closes that SEPARATE the field, so the climb draws real trails.
const battlePod = {
  id: 'g1',
  status: GROUP_STATUS.BATTLE,
  players: [
    { odUserId: 'u1', isCpu: false, picks: [{ symbol: 'AAPL' }] },
    { odUserId: 'cpu_0002', isCpu: true, picks: [] },
    { odUserId: 'cpu_0003', isCpu: true, picks: [] },
    { odUserId: 'cpu_0004', isCpu: true, picks: [] },
  ],
  dailyScores: {
    day1: { closeScores: { u1: { compositePoints: 0 }, cpu_0002: { compositePoints: 0 }, cpu_0003: { compositePoints: 0 }, cpu_0004: { compositePoints: 0 } } },
    day2: { closeScores: { u1: { compositePoints: 0.5 }, cpu_0002: { compositePoints: 3 }, cpu_0003: { compositePoints: 2 }, cpu_0004: { compositePoints: 1 } } },
  },
};

describe('TrainingClimbPreview render smoke', () => {
  it('composes the real-data climb hero + the enter affordance for a BATTLE pod', () => {
    const html = renderToString(
      <TrainingClimbPreview pod={battlePod} uid="u1" onOpen={() => {}} viewport="desktop" />,
    );
    expect(html).toContain('The climb · your training pod');          // the preview eyebrow
    expect(html).toContain('Tap the climb to enter your training battle'); // the tap affordance
    expect(html).toContain('bv2cl');                                   // ClimbArena drew real trails (separated field)
    expect(html.length).toBeGreaterThan(1500);                         // a real composition, not an early bail
  });

  it('renders the compact (mobile) climb without throwing', () => {
    const html = renderToString(
      <TrainingClimbPreview pod={battlePod} uid="u1" onOpen={() => {}} viewport="mobile" />,
    );
    expect(html).toContain('The climb · your training pod');
    expect(html).toContain('bv2cl');
  });
});
