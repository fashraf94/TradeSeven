// src/components/League/draft/DraftBoardRoom.smoke.test.jsx
//
// Render smoke for the Phase-4 DraftBoardRoom genericization (one room, both
// modes). Uses react-dom/server (no DOM, so effects never run) — enough to prove
// the room composes in each mode and, crucially, that:
//   • TRAINING mode is byte-identical copy ("Training Draft", "practice — no
//     stakes", "three CPU agents") — the reuse-not-fork green gate; and
//   • COMPETITIVE mode leaks NONE of that training copy ("Live Draft", "your
//     pod", no "practice"/"no stakes"/"CPU agents only") — the label sweep.
// The draft hook is mocked to a forming-intro state (the clearest copy divergence
// surface); tournamentActions is stubbed so the Firebase client never evals.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const STATE = {
  group: { seatNames: {} },
  poolRows: [], humanArchetype: 'analyst', events: [], snakeOrder: [0, 1, 2, 3],
  members: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'], currentUserId: 'u1', myPicks: [],
  seats: [
    { odUserId: 'u1', seatIndex: 0, isYou: true, isCpu: false, onClock: true, picks: [] },
    { odUserId: 'cpu-1', seatIndex: 1, isYou: false, isCpu: true, onClock: false, picks: [] },
    { odUserId: 'cpu-2', seatIndex: 2, isYou: false, isCpu: true, onClock: false, picks: [] },
    { odUserId: 'cpu-3', seatIndex: 3, isYou: false, isCpu: true, onClock: false, picks: [] },
  ],
  isDrafting: true, isMyTurn: true, isComplete: false, finalStatus: null, universe: [],
  currentPickIndex: 0, totalPicks: 12, round: 1, pickClock: 20, clockTotalSec: 20,
  submitting: false, error: null, submitPick: () => {},
  draft: { status: 'drafting', pool: [], snakeOrder: [0, 1, 2, 3], currentPickIndex: 0, taken: [], picksByUser: {} },
  onClockSeatIdx: 0,
};

vi.mock('../../../hooks/useTrainingDraft', () => ({ useTrainingDraft: () => STATE, default: () => STATE }));
vi.mock('../../../services/tournamentActions', () => ({ makeLiveDraftPick: () => {} }));
// Stub the Firebase client (env-gated at module eval) so the render smoke stays pure.
vi.mock('../../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../draft/AssetResearchModal', () => ({ default: () => null }));

const DraftBoardRoom = (await import('./DraftBoardRoom')).default;

describe('DraftBoardRoom genericization — render smoke', () => {
  it('TRAINING mode renders unchanged copy (byte-identity gate)', () => {
    const html = renderToString(<DraftBoardRoom user={{ uid: 'u1' }} groupId="g1" mode="training" />);
    expect(html).toContain('Training Draft');
    expect(html).toContain('practice — no stakes');
    expect(html).toContain('three CPU agents');
  });

  it('COMPETITIVE mode renders honest copy with NO training leakage (label sweep)', () => {
    const html = renderToString(<DraftBoardRoom user={{ uid: 'u1' }} groupId="g1" mode="competitive" />);
    expect(html).toContain('Live Draft');
    expect(html).toContain('your pod');
    expect(html).not.toContain('practice — no stakes');
    expect(html).not.toContain('three CPU agents');
    expect(html).not.toMatch(/PRACTICE/);
  });

  it('defaults to training when mode is omitted (byte-identical default)', () => {
    const html = renderToString(<DraftBoardRoom user={{ uid: 'u1' }} groupId="g1" />);
    expect(html).toContain('Training Draft');
    expect(html).not.toContain('Live Draft');
  });
});
