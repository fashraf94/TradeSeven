// src/data/characterState.test.js
//
// Release 3 (Character tab) — tests for the pure state resolver. This file's
// REAL import of characterState.js (→ api/_utils/leanRevalidation.js +
// tempoDialClamp.js → src/data/archetypeAdjustments.js) is the BUILD_RULES §4
// dependency-surface guard — never mock it. If a browser-only dep ever entered
// that graph, this suite would explode in the Node test env.

import { describe, it, expect } from 'vitest';
import { resolveCharacterState, CHARACTER_STATES } from './characterState.js';
import { revalidateStandingLeans, LEAN_INVALIDATION_REASONS } from '../../api/_utils/leanRevalidation.js';

// Real guardian menu ids (CP-*, all canonicalTextVersion 1); TF-01 belongs to
// momentum_chaser, so it is not_in_menu for guardian.
const VALID = { adjustmentId: 'CP-01', version: 1, equippedAt: 't1' };
const CROSS_ARCHETYPE = { adjustmentId: 'TF-01', version: 1, equippedAt: 't2' }; // not_in_menu on guardian
const STALE_VERSION = { adjustmentId: 'CP-01', version: 99, equippedAt: 't3' }; // deprecated_version

const live = (over = {}) => resolveCharacterState({
  leansEnabled: true,
  dialEnabled: true,
  activeBattleId: null,
  archetype: 'guardian',
  standingLeans: [],
  tempo: 'standard',
  ...over,
});

describe('resolveCharacterState — the six states', () => {
  it('EMPTY: no leans, standard tempo, controls live, no battle', () => {
    const r = live();
    expect(r.state).toBe(CHARACTER_STATES.EMPTY);
    expect(r.leans.valid).toHaveLength(0);
    expect(r.tempo.effective).toBe('standard');
    expect(r.isBattleLocked).toBe(false);
  });

  it('LIVE: a valid equipped lean, controls live, no battle', () => {
    const r = live({ standingLeans: [VALID] });
    expect(r.state).toBe(CHARACTER_STATES.LIVE);
    expect(r.leans.valid.map((l) => l.adjustmentId)).toEqual(['CP-01']);
    expect(r.leans.invalidated).toHaveLength(0);
  });

  it('LIVE: no leans but a non-standard tempo is set', () => {
    const r = live({ tempo: 'aggressive' });
    expect(r.state).toBe(CHARACTER_STATES.LIVE);
    expect(r.tempo.effective).toBe('aggressive');
    expect(r.tempo.suppressed).toBe(false);
  });

  it('BATTLE: an active battle freezes the loadout (view-only)', () => {
    const r = live({ standingLeans: [VALID], activeBattleId: 'battle_123' });
    expect(r.state).toBe(CHARACTER_STATES.BATTLE);
    expect(r.isBattleLocked).toBe(true);
  });

  it('CHANGED: an equipped lean does not apply to the current archetype (not_in_menu)', () => {
    const r = live({ standingLeans: [CROSS_ARCHETYPE] });
    expect(r.state).toBe(CHARACTER_STATES.CHANGED);
    expect(r.leans.invalidated).toContainEqual(
      expect.objectContaining({ adjustmentId: 'TF-01', reason: LEAN_INVALIDATION_REASONS.NOT_IN_MENU })
    );
  });

  it('RECONFIRM: an equipped lean pins a stale version (deprecated_version)', () => {
    const r = live({ standingLeans: [STALE_VERSION] });
    expect(r.state).toBe(CHARACTER_STATES.RECONFIRM);
    expect(r.leans.invalidated).toContainEqual(
      expect.objectContaining({ adjustmentId: 'CP-01', reason: LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION })
    );
  });

  it('PREACTIVATION: the standing-leans control is dark', () => {
    const r = live({ leansEnabled: false, standingLeans: [VALID] });
    expect(r.state).toBe(CHARACTER_STATES.PREACTIVATION);
    expect(r.pending.leans).toBe(true);
    expect(r.pending.tempo).toBe(false);
  });

  it('PREACTIVATION: the tempo dial is dark → desired kept, effective fails closed to standard with reason', () => {
    const r = live({ dialEnabled: false, tempo: 'aggressive' });
    expect(r.state).toBe(CHARACTER_STATES.PREACTIVATION);
    expect(r.pending.tempo).toBe(true);
    expect(r.tempo.desired).toBe('aggressive');
    expect(r.tempo.effective).toBe('standard');
    expect(r.tempo.suppressed).toBe(true);
    expect(r.tempo.suppressionReason).toBe('dial_disabled');
  });
});

describe('resolveCharacterState — priority ordering', () => {
  it('preactivation outranks battle (a suppressed control is never shown as live)', () => {
    const r = live({ leansEnabled: false, activeBattleId: 'battle_1', standingLeans: [VALID] });
    expect(r.state).toBe(CHARACTER_STATES.PREACTIVATION);
  });

  it('battle outranks changed/reconfirm/empty/live', () => {
    const r = live({ activeBattleId: 'battle_1', standingLeans: [CROSS_ARCHETYPE] });
    expect(r.state).toBe(CHARACTER_STATES.BATTLE);
  });

  it('changed outranks reconfirm when both an out-of-menu and a stale lean are present', () => {
    const r = live({ standingLeans: [STALE_VERSION, CROSS_ARCHETYPE] });
    expect(r.state).toBe(CHARACTER_STATES.CHANGED);
  });
});

describe('resolveCharacterState — single-source (no drift with the server kernel)', () => {
  it('lean valid/invalidated split equals revalidateStandingLeans directly', () => {
    const standingLeans = [VALID, CROSS_ARCHETYPE, STALE_VERSION];
    const r = resolveCharacterState({ leansEnabled: true, dialEnabled: true, archetype: 'guardian', standingLeans, tempo: 'standard' });
    const kernel = revalidateStandingLeans({ standingLeans, archetypeCodeId: 'guardian' });
    expect(r.leans.valid).toEqual(kernel.valid);
    expect(r.leans.invalidated).toEqual(kernel.invalidated);
  });

  it('tempo effective equals the desired when the dial is live', () => {
    for (const tempo of ['measured', 'standard', 'aggressive']) {
      const r = live({ tempo });
      expect(r.tempo.effective).toBe(tempo);
      expect(r.tempo.suppressed).toBe(false);
      expect(r.tempo.suppressionReason).toBeNull();
    }
  });
});
