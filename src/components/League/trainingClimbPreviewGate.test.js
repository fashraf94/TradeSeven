// src/components/League/trainingClimbPreviewGate.test.js
//
// The pure show/hide decision for the Training-tab climb preview. Node-clean —
// this import IS the dependency-surface guard (no DOM, no browser deps).

import { describe, it, expect } from 'vitest';
import { shouldPreviewClimb, climbPreviewEnabled } from './trainingClimbPreviewGate';
import { GROUP_STATUS } from '../../constants/leagueTournament';
import { LEAGUE_TRAINING_CLIMB_PREVIEW_ENABLED } from '../../config/featureFlags';

const battlePod = (extra = {}) => ({ status: GROUP_STATUS.BATTLE, players: [{ odUserId: 'u1' }], ...extra });

describe('shouldPreviewClimb', () => {
  it('shows the climb for a seated BATTLE pod when the gate is enabled', () => {
    expect(shouldPreviewClimb(battlePod(), true)).toBe(true);
  });

  it('hides the climb when the gate is disabled — even for a BATTLE pod (flag-off is byte-unchanged)', () => {
    expect(shouldPreviewClimb(battlePod(), false)).toBe(false);
  });

  it('hides the climb for pre-bell pods (DRAFTING / AWAITING_OPEN) even when enabled — they keep the re-entry card', () => {
    expect(shouldPreviewClimb({ status: GROUP_STATUS.DRAFTING, players: [{ odUserId: 'u1' }] }, true)).toBe(false);
    expect(shouldPreviewClimb({ status: GROUP_STATUS.AWAITING_OPEN, players: [{ odUserId: 'u1' }] }, true)).toBe(false);
  });

  it('hides the climb for a COMPLETE pod and a null pod (the cold-start surface)', () => {
    expect(shouldPreviewClimb({ status: GROUP_STATUS.COMPLETE, players: [{ odUserId: 'u1' }] }, true)).toBe(false);
    expect(shouldPreviewClimb(null, true)).toBe(false);
    expect(shouldPreviewClimb(undefined, true)).toBe(false);
  });

  it('hides the climb for a seatless BATTLE pod (malformed doc) — falls back to the card, never a hollow climb', () => {
    expect(shouldPreviewClimb({ status: GROUP_STATUS.BATTLE, players: [] }, true)).toBe(false);
    expect(shouldPreviewClimb({ status: GROUP_STATUS.BATTLE }, true)).toBe(false);
  });

  it('requires the gate to be strictly true (a truthy non-boolean does not enable it)', () => {
    expect(shouldPreviewClimb(battlePod(), 1)).toBe(false);
  });
});

describe('climbPreviewEnabled', () => {
  it('resolves to the flag value with no window (SSR / node) — the dev param cannot participate', () => {
    // In the node test env there is no window, so the ?trainingClimbPreview param
    // can't flip it: climbPreviewEnabled() === the compile-time flag. Robust to
    // the flag being flipped on/off (no brittle literal to update each flip).
    expect(climbPreviewEnabled()).toBe(LEAGUE_TRAINING_CLIMB_PREVIEW_ENABLED);
  });
});
