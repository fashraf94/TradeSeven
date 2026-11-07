// api/_utils/activationEvidence/scope.test.js
//
// ID-1 Build 2 — scope (contract §2, ruling Q-ID1-1).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): scope.js imports two src/ constants
// modules; this file imports scope.js unmocked, so a browser-only dependency
// entering that graph fails here. Never mock it.

import { describe, it, expect } from 'vitest';
import { scopeOf } from './scope.js';
import { legacyBattle } from './__fixtures__/activationBattles.js';

describe('scope', () => {
  it('in scope: a tiered Trend Follower battle, with gameMode baggerbomb_agent or no gameMode at all, a casual clone included', () => {
    expect(scopeOf(legacyBattle())).toEqual({ inScope: true, excludedBy: null });
    const noMode = legacyBattle(); delete noMode.gameMode;
    expect(scopeOf(noMode)).toEqual({ inScope: true, excludedBy: null });
    expect(scopeOf(legacyBattle({ gameMode: null }))).toEqual({ inScope: true, excludedBy: null });
    expect(scopeOf(legacyBattle({ agentId: 'casual-agent-u1' }))).toEqual({ inScope: true, excludedBy: null });
  });
  it.each([
    ['a tournament battle', { gameMode: 'baggerbomb_tournament', groupId: 'g1' }, 'game_mode'],
    ['an unknown mode', { gameMode: 'something_else' }, 'game_mode'],
    ['a CPU side', { isCpu: true }, 'cpu'],
    ['a training clone', { agentId: 'training-agent-g1-u1' }, 'training_clone'],
    ['another archetype', { agentContext: { archetype: 'contrarian' } }, 'archetype'],
    ['no archetype', { agentContext: {} }, 'archetype'],
  ])('excluded: %s', (_l, patch, reason) => {
    expect(scopeOf(legacyBattle(patch))).toEqual({ inScope: false, excludedBy: reason });
  });
  it('several exclusions count ONCE, under the first in the order game mode, CPU, training clone, archetype', () => {
    const all = { gameMode: 'baggerbomb_tournament', isCpu: true, agentId: 'training-agent-x', agentContext: { archetype: 'degen' } };
    expect(scopeOf(legacyBattle(all)).excludedBy).toBe('game_mode');
    expect(scopeOf(legacyBattle({ ...all, gameMode: 'baggerbomb_agent' })).excludedBy).toBe('cpu');
    expect(scopeOf(legacyBattle({ ...all, gameMode: 'baggerbomb_agent', isCpu: false })).excludedBy).toBe('training_clone');
    expect(scopeOf(legacyBattle({ ...all, gameMode: 'baggerbomb_agent', isCpu: false, agentId: 'agent-1' })).excludedBy).toBe('archetype');
  });
});
