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

// ── PRE-OPEN PHASE (PREOPEN_PHASE_ROUTING_ENABLED) ───────────────────────────
// The header binds to the SAME derivation the body routes on (BUILD_RULES §9):
// a pod on its battle day but before the bell reads "awaiting open", never "live".
describe('trainingStatusFraming — pre-open phase', () => {
  it('frames a BATTLE pod as awaiting-open while preOpen is true', () => {
    const f = trainingStatusFraming(GROUP_STATUS.BATTLE, { preOpen: true });
    expect(f.label).toBe('Practice pod · awaiting open');
    expect(f.sub).toMatch(/next market open/i);
  });

  it('frames the SAME pod as live once preOpen goes false at the bell', () => {
    const f = trainingStatusFraming(GROUP_STATUS.BATTLE, { preOpen: false });
    expect(f.label).toBe('Practice pod · live');
  });

  it('is byte-identical to the old one-arg call when the option is omitted (flag-off arm)', () => {
    for (const s of [
      GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.BATTLE, GROUP_STATUS.COMPLETE,
      GROUP_STATUS.EXPIRED, GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING, undefined,
    ]) {
      expect(trainingStatusFraming(s)).toEqual(trainingStatusFraming(s, { preOpen: false }));
    }
  });

  it('preOpen never rewrites a non-BATTLE status (it is a BATTLE-only phase)', () => {
    // COMPLETE/EXPIRED must stay terminal even if a caller passed preOpen true —
    // the derivation is BATTLE-only, so this can only be defensive, never routing.
    expect(trainingStatusFraming(GROUP_STATUS.COMPLETE, { preOpen: true }).label).toBe('Practice pod · complete');
    expect(trainingStatusFraming(GROUP_STATUS.EXPIRED, { preOpen: true }).label).toBe('Practice pod · expired');
    expect(trainingStatusFraming(GROUP_STATUS.AWAITING_OPEN, { preOpen: true }).label).toBe('Practice pod · awaiting open');
  });

  it('anti-vacuous: preOpen is what changes the answer for a BATTLE pod', () => {
    const off = trainingStatusFraming(GROUP_STATUS.BATTLE, { preOpen: false }).label;
    const on = trainingStatusFraming(GROUP_STATUS.BATTLE, { preOpen: true }).label;
    expect(off).not.toBe(on);
  });
});
