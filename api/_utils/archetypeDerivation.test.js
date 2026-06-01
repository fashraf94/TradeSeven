// api/_utils/archetypeDerivation.test.js
//
// Locks ARCHETYPE_IDENTITY_CONTRACT_V1.md §3 precedence. The headline guarantee
// the contract makes — and the reason it replaced the old quiz — is that ALL
// SIX archetypes are reachable from the three temperament answers. The prior
// buy-signal-only quiz could reach only four (it could never produce guardian
// or diversifier). These tests prove all six are reachable and that the
// precedence ordering holds.

import { describe, it, expect } from 'vitest';
import { deriveArchetypeFromAnswers } from './archetypeDerivation.js';
import { VALID_ARCHETYPES } from './agentArchetypeConfig.js';

describe('deriveArchetypeFromAnswers — §3 precedence', () => {
  it('1. protect-first dominates and overrides the buy signal', () => {
    // Even a textbook trend-following buy signal yields guardian when the user
    // chose protect-first. This is the anchor separating guardian from diversifier.
    expect(deriveArchetypeFromAnswers('protect', 'trending', 'concentrate')).toBe('guardian');
    expect(deriveArchetypeFromAnswers('protect', 'volatile', 'spread')).toBe('guardian');
  });

  it('2. broad mix (Q2) or spread-wide (Q3) → diversifier (when not protect-first)', () => {
    expect(deriveArchetypeFromAnswers('balanced', 'broad_mix', 'concentrate')).toBe('diversifier');
    // Spread wins over an otherwise-routing buy signal.
    expect(deriveArchetypeFromAnswers('aggressive', 'trending', 'spread')).toBe('diversifier');
  });

  it('3. routes by buy signal when concentrating and not protect-first', () => {
    expect(deriveArchetypeFromAnswers('aggressive', 'trending', 'concentrate')).toBe('momentum_chaser');
    expect(deriveArchetypeFromAnswers('balanced', 'beaten_down', 'concentrate')).toBe('contrarian');
    expect(deriveArchetypeFromAnswers('balanced', 'fundamentals', 'concentrate')).toBe('analyst');
    expect(deriveArchetypeFromAnswers('aggressive', 'volatile', 'concentrate')).toBe('degen');
  });

  it('all six archetypes are reachable', () => {
    const reached = new Set([
      deriveArchetypeFromAnswers('protect', 'fundamentals', 'concentrate'), // guardian
      deriveArchetypeFromAnswers('balanced', 'broad_mix', 'concentrate'),   // diversifier
      deriveArchetypeFromAnswers('aggressive', 'trending', 'concentrate'),  // momentum_chaser
      deriveArchetypeFromAnswers('balanced', 'beaten_down', 'concentrate'), // contrarian
      deriveArchetypeFromAnswers('balanced', 'fundamentals', 'concentrate'),// analyst
      deriveArchetypeFromAnswers('aggressive', 'volatile', 'concentrate'),  // degen
    ]);
    expect(reached.size).toBe(6);
    expect([...reached].sort()).toEqual([...VALID_ARCHETYPES].sort());
  });

  it('tolerates freeform text (keyword-based)', () => {
    expect(deriveArchetypeFromAnswers('I want to protect my capital', 'anything', 'concentrate')).toBe('guardian');
    expect(deriveArchetypeFromAnswers('balanced', "it's beaten down", 'concentrate')).toBe('contrarian');
    expect(deriveArchetypeFromAnswers('balanced', 'strong fundamentals', 'concentrate')).toBe('analyst');
  });

  it('defaults to analyst on empty / unrecognized input', () => {
    expect(deriveArchetypeFromAnswers('', '', '')).toBe('analyst');
    expect(deriveArchetypeFromAnswers(null, undefined, null)).toBe('analyst');
  });

  it('only ever returns a valid archetype code-id', () => {
    const samples = ['aggressive', 'balanced', 'protect', 'gibberish', ''];
    const signals = ['trending', 'beaten_down', 'fundamentals', 'volatile', 'broad_mix', 'gibberish', ''];
    const conc = ['concentrate', 'spread', ''];
    for (const a of samples) {
      for (const b of signals) {
        for (const c of conc) {
          expect(VALID_ARCHETYPES).toContain(deriveArchetypeFromAnswers(a, b, c));
        }
      }
    }
  });
});
