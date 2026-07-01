// api/_utils/directiveIdentity.test.js
//
// Phase C tests. The import of ./directiveIdentity.js IS the BUILD_RULES §4
// dependency-surface guard (runs in the Node/vitest env). NEVER mock it.

import { describe, it, expect } from 'vitest';
import getEffectiveArchetypeDefault, { getEffectiveArchetype } from './directiveIdentity.js';

const battleWith = (archetype) => ({ agentContext: { archetype } });
const agentWith = (archetype) => ({ archetype });

describe('getEffectiveArchetype', () => {
  it('returns the battle snapshot archetype when present', () => {
    expect(getEffectiveArchetype(battleWith('guardian'), agentWith('degen'))).toBe('guardian');
  });

  it('falls back to agent.archetype when the battle snapshot is absent', () => {
    expect(getEffectiveArchetype(undefined, agentWith('contrarian'))).toBe('contrarian');
    expect(getEffectiveArchetype({}, agentWith('contrarian'))).toBe('contrarian'); // no agentContext
    expect(getEffectiveArchetype({ agentContext: {} }, agentWith('contrarian'))).toBe('contrarian');
  });

  it('returns null when neither source has an archetype (never "analyst")', () => {
    expect(getEffectiveArchetype(undefined, undefined)).toBeNull();
    expect(getEffectiveArchetype({}, {})).toBeNull();
    expect(getEffectiveArchetype(null, null)).toBeNull();
    expect(getEffectiveArchetype(battleWith(null), agentWith(null))).toBeNull();
  });

  it('CF-1 guarantee: when battle snapshot and agent agree (the live-battle case), returns that shared value', () => {
    // During a battle, change-archetype.js:77 guarantees these are equal.
    expect(getEffectiveArchetype(battleWith('momentum_chaser'), agentWith('momentum_chaser')))
      .toBe('momentum_chaser');
  });

  it('prefers the frozen battle snapshot even if agent.archetype diverges (robust to the agent-doc edge paths)', () => {
    // The latent endpoint-only-lock gap + decide.js lock-window can only touch
    // agent.archetype, never the frozen snapshot. Preferring the snapshot makes
    // mechanics follow the battle's frozen identity deterministically.
    expect(getEffectiveArchetype(battleWith('diversifier'), agentWith('degen'))).toBe('diversifier');
  });

  it('passes a stored "unknown" snapshot through verbatim (gate #4 handles it downstream)', () => {
    // agentBattleService.js:152 stores 'unknown' when the agent had no archetype.
    expect(getEffectiveArchetype(battleWith('unknown'), agentWith('guardian'))).toBe('unknown');
  });

  it('does not throw on missing/empty arguments', () => {
    expect(() => getEffectiveArchetype()).not.toThrow();
    expect(getEffectiveArchetype()).toBeNull();
  });

  it('default export is the same function', () => {
    expect(getEffectiveArchetypeDefault).toBe(getEffectiveArchetype);
  });
});
