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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const { flagState } = vi.hoisted(() => ({ flagState: { on: false } }));

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

// PRE-OPEN PHASE: stub ONLY the gate, so the real usePreOpenPhase and the real
// tuple compare run under a fake clock.
vi.mock('../../../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isPreOpenPhaseRoutingOn: () => flagState.on };
});

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

  it('EXPIRED (Training-Pod P0 R2) renders honest terminal copy — "Pod closed", never the "waiting for the next market open" line', () => {
    const saved = { isComplete: STATE.isComplete, finalStatus: STATE.finalStatus };
    STATE.isComplete = true;
    STATE.finalStatus = 'expired'; // GROUP_STATUS.EXPIRED
    try {
      const html = renderToString(<DraftBoardRoom user={{ uid: 'u1' }} groupId="g1" mode="training" />);
      expect(html).toContain('Pod closed');
      expect(html).not.toContain('waiting for the next market open');
    } finally {
      STATE.isComplete = saved.isComplete;
      STATE.finalStatus = saved.finalStatus;
    }
  });
});

// ── PRE-OPEN PHASE (PREOPEN_PHASE_ROUTING_ENABLED) ───────────────────────────
// The Mon 08:45 ranked slot is timed so a draft completes BEFORE the 9:30 open by
// construction (liveDraftSlots.js:28-30), which made this completion card the
// first thing a drafter saw — telling them the battle had begun ~40 minutes early.
describe('DraftBoardRoom completion card — pre-open phase', () => {
  const ANCHOR = '2026-08-31';                    // Mon
  const PRE_OPEN = '2026-08-31T12:50:00.000Z';    // ET 08:50 — the slot pod's real window
  const AFTER_BELL = '2026-08-31T13:30:00.000Z';  // ET 09:30

  const withCompleteBattlePod = (fn) => {
    const saved = { isComplete: STATE.isComplete, finalStatus: STATE.finalStatus, group: STATE.group };
    STATE.isComplete = true;
    STATE.finalStatus = 'battle'; // GROUP_STATUS.BATTLE
    STATE.group = { seatNames: {}, status: 'battle', startAnchor: { anchorEtDate: ANCHOR } };
    try { return fn(); } finally { Object.assign(STATE, saved); }
  };
  const render = () => renderToString(<DraftBoardRoom user={{ uid: 'u1' }} groupId="g1" mode="competitive" />);

  beforeEach(() => { vi.useFakeTimers(); flagState.on = false; });
  afterEach(() => { vi.useRealTimers(); });

  it('flag OFF: a pre-open completion still claims the battle has begun (byte-equivalent to today)', () => {
    vi.setSystemTime(new Date(PRE_OPEN));
    const html = withCompleteBattlePod(render);
    expect(html).toContain('Your pod is live');
  });

  it('flag ON: the same completion reads "waiting for the next market open"', () => {
    flagState.on = true;
    vi.setSystemTime(new Date(PRE_OPEN));
    const html = withCompleteBattlePod(render);
    expect(html).toContain('waiting for the next market open');
    expect(html).not.toContain('Your pod is live');
  });

  it('flag ON: once the bell rings the same pod reads live', () => {
    flagState.on = true;
    vi.setSystemTime(new Date(AFTER_BELL));
    expect(withCompleteBattlePod(render)).toContain('Your pod is live');
  });

  it('anti-vacuous: the flag is what changes the copy', () => {
    vi.setSystemTime(new Date(PRE_OPEN));
    flagState.on = false;
    const off = withCompleteBattlePod(render);
    flagState.on = true;
    const on = withCompleteBattlePod(render);
    expect(off).not.toBe(on);
  });
});
