// src/components/League/battleArena/arenaStateMap.test.js
//
// Pure-function tests for the design-string ↔ server-enum mapper. The import of
// arenaStateMap (→ leagueTournament constants) loading clean in Node is the
// dependency-surface guard (never mocked).

import { describe, it, expect } from 'vitest';
import { GROUP_STATUS } from '../../../constants/leagueTournament';
import {
  ARENA_STATES, ARENA_MODES, deriveArenaState, deriveArenaTerminalKind, normalizeArenaMode, deriveArenaFrame, frameDayIdx,
} from './arenaStateMap';

describe('deriveArenaState', () => {
  it('maps battle → live, complete → complete, expired → complete (terminal)', () => {
    expect(deriveArenaState({ status: GROUP_STATUS.BATTLE })).toBe('live');
    expect(deriveArenaState({ status: GROUP_STATUS.COMPLETE })).toBe('complete');
    // Training-Pod P0 R2: a pod retired pre-BATTLE reads terminal, not 'awaiting'.
    expect(deriveArenaState({ status: GROUP_STATUS.EXPIRED })).toBe('complete');
    // L-A: a voided cohort reads terminal (no LIVE badge / ticking), same state
    // as complete — the DISTINCT "voided" surfacing is deriveArenaTerminalKind's job.
    expect(deriveArenaState({ status: GROUP_STATUS.VOIDED })).toBe('complete');
  });
  it('maps every pre-bell status (forming / drafting / awaiting_open) → awaiting', () => {
    expect(deriveArenaState({ status: GROUP_STATUS.FORMING })).toBe('awaiting');
    expect(deriveArenaState({ status: GROUP_STATUS.DRAFTING })).toBe('awaiting');
    expect(deriveArenaState({ status: GROUP_STATUS.AWAITING_OPEN })).toBe('awaiting');
  });
  it('defaults unknown / missing to awaiting (the rest state)', () => {
    expect(deriveArenaState({ status: 'wat' })).toBe('awaiting');
    expect(deriveArenaState(null)).toBe('awaiting');
    expect(deriveArenaState(undefined)).toBe('awaiting');
  });
  it('only ever returns a known arena state', () => {
    for (const s of Object.values(GROUP_STATUS)) {
      expect(ARENA_STATES).toContain(deriveArenaState({ status: s }));
    }
  });
});

describe('deriveArenaTerminalKind', () => {
  it('distinguishes a VOIDED cohort (no result) from a legitimately finished battle', () => {
    expect(deriveArenaTerminalKind({ status: GROUP_STATUS.VOIDED })).toBe('voided');
    expect(deriveArenaTerminalKind({ status: GROUP_STATUS.COMPLETE })).toBe('final');
    expect(deriveArenaTerminalKind({ status: GROUP_STATUS.EXPIRED })).toBe('final');
  });
  it('returns null for every non-terminal state (and missing input)', () => {
    expect(deriveArenaTerminalKind({ status: GROUP_STATUS.BATTLE })).toBeNull();
    expect(deriveArenaTerminalKind({ status: GROUP_STATUS.FORMING })).toBeNull();
    expect(deriveArenaTerminalKind({ status: GROUP_STATUS.DRAFTING })).toBeNull();
    expect(deriveArenaTerminalKind({ status: GROUP_STATUS.AWAITING_OPEN })).toBeNull();
    expect(deriveArenaTerminalKind({ status: 'wat' })).toBeNull();
    expect(deriveArenaTerminalKind(null)).toBeNull();
    expect(deriveArenaTerminalKind(undefined)).toBeNull();
  });
  it('only ever surfaces "voided" when the arena state is terminal (complete)', () => {
    // The client only consults terminal-kind in the done branch; guard the invariant.
    for (const s of Object.values(GROUP_STATUS)) {
      const kind = deriveArenaTerminalKind({ status: s });
      if (kind !== null) expect(deriveArenaState({ status: s })).toBe('complete');
    }
  });
});

describe('normalizeArenaMode', () => {
  it('passes through known modes and defaults the rest to ranked', () => {
    expect(normalizeArenaMode('training')).toBe('training');
    expect(normalizeArenaMode('ranked')).toBe('ranked');
    expect(normalizeArenaMode('nonsense')).toBe('ranked');
    expect(normalizeArenaMode(undefined)).toBe('ranked');
    expect(ARENA_MODES).toContain(normalizeArenaMode(null));
  });
});

describe('deriveArenaFrame', () => {
  it('combines a group state with a host-supplied mode', () => {
    expect(deriveArenaFrame({ group: { status: GROUP_STATUS.BATTLE }, mode: 'training' }))
      .toEqual({ state: 'live', mode: 'training' });
    expect(deriveArenaFrame({})).toEqual({ state: 'awaiting', mode: 'ranked' });
  });
});

describe('frameDayIdx', () => {
  it('awaiting = start line, live = mid, complete = the close', () => {
    expect(frameDayIdx('awaiting')).toBe(0);
    expect(frameDayIdx('live')).toBe(1);
    expect(frameDayIdx('complete')).toBe(4);
  });
});
