// src/screens/leagueTrainingBattleFraming.test.js
//
// Unit coverage for the Slice-5a training battle-view framing helpers. Pure
// logic only — the integrated render (Flat6BattleView + ClaimFlipWindow +
// playback) is covered by the Vercel preview smoke, since this repo has no
// React component-render test convention (jsdom only, no testing-library).

import { describe, it, expect } from 'vitest';
import { trainingStatusFraming, deriveCompositeContext } from './leagueTrainingBattleFraming';
import { GROUP_STATUS, TOURNAMENT_TUNING } from '../constants/leagueTournament';

describe('trainingStatusFraming', () => {
  it('frames AWAITING_OPEN as a locked-in, pre-open practice pod', () => {
    const f = trainingStatusFraming(GROUP_STATUS.AWAITING_OPEN);
    expect(f.label).toBe('Practice pod · awaiting open');
    expect(f.sub).toMatch(/next market open/i);
  });

  it('frames BATTLE as a live practice pod', () => {
    expect(trainingStatusFraming(GROUP_STATUS.BATTLE).label).toBe('Practice pod · live');
  });

  it('frames COMPLETE as banked, no-stakes', () => {
    const f = trainingStatusFraming(GROUP_STATUS.COMPLETE);
    expect(f.label).toBe('Practice pod · complete');
    expect(f.sub).toMatch(/leaderboard or the bracket/i);
  });

  it('frames EXPIRED as a retired-pre-battle practice pod (Training-Pod P0 R2)', () => {
    expect(trainingStatusFraming(GROUP_STATUS.EXPIRED).label).toBe('Practice pod · expired');
  });

  it('falls back to a generic practice label for an unknown/forming status', () => {
    expect(trainingStatusFraming('forming').label).toBe('Practice pod');
    expect(trainingStatusFraming(undefined).label).toBe('Practice pod');
  });
});

describe('deriveCompositeContext', () => {
  const uid = 'u1';
  const podWith = (closeScores) => ({
    status: GROUP_STATUS.BATTLE,
    dailyScores: { day1: { closeScores }, day2: { closeScores } },
  });

  it('returns null without a pod or a uid', () => {
    expect(deriveCompositeContext(null, uid)).toBeNull();
    expect(deriveCompositeContext(podWith({}), null)).toBeNull();
  });

  it('reads the stored compositePoints + totalPoints from the latest banked day', () => {
    const pod = podWith({ [uid]: { totalPoints: 10, agentPoints: 4, compositePoints: 19 } });
    expect(deriveCompositeContext(pod, uid)).toEqual({ composite: 19, userPoints: 10 });
  });

  it('degrades to computeComposite (agent + k×user) when compositePoints is absent', () => {
    const pod = podWith({ [uid]: { totalPoints: 8, agentPoints: 5 } });
    const expected = 5 + TOURNAMENT_TUNING.USER_LAYER_K * 8; // 5 + 1.5*8 = 17
    expect(deriveCompositeContext(pod, uid)).toEqual({ composite: expected, userPoints: 8 });
  });

  it('returns zeros before the first banking (no dailyScores)', () => {
    expect(deriveCompositeContext({ status: GROUP_STATUS.AWAITING_OPEN }, uid)).toEqual({ composite: 0, userPoints: 0 });
  });
});
