// src/constants/backingApproach.test.js
//
// Backing Beta PR 5 carry-in — the backing-safe approach lines (DOM-2 in the
// PR 4 review record). Every entry passes the lexicon it exists to satisfy;
// the resolver prefers the canonical line whenever it is clean; and the table
// names exactly the archetypes whose canonical line is not.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BACKING_SAFE_APPROACH, backingSafeApproach } from './backingApproach';
import { findForbiddenTerm } from './backingLexicon';
import { ARCHETYPE_IDENTITY } from '../data/archetypeIdentity';

describe('BACKING_SAFE_APPROACH — the twins of the canonical lines that fail the lexicon', () => {
  it('every safe line passes the backing lexicon, is a sentence, and names no other archetype', () => {
    expect(Object.keys(BACKING_SAFE_APPROACH).length).toBeGreaterThan(0);
    for (const [key, line] of Object.entries(BACKING_SAFE_APPROACH)) {
      expect(findForbiddenTerm(line), `${key}: ${line}`).toBeNull();
      expect(line).toMatch(/^[A-Z].*\.$/);
      expect(line.length).toBeLessThan(120);
    }
  });

  it('is keyed by archetypes whose CANONICAL disposition fails the lexicon — and by no other', () => {
    const failing = Object.entries(ARCHETYPE_IDENTITY).filter(([, id]) => findForbiddenTerm(id.disposition) != null).map(([k]) => k).sort();
    expect(failing).toEqual(['diversifier']);
    expect(Object.keys(BACKING_SAFE_APPROACH).sort()).toEqual(failing);
  });

  it('the Diversifier twin says the same thing in the lexicon\'s words', () => {
    expect(ARCHETYPE_IDENTITY.diversifier.disposition).toMatch(/\bbets\b/);
    expect(BACKING_SAFE_APPROACH.diversifier).toBe('Keeps the portfolio spread across many sectors so no single one can sink you.');
    expect(BACKING_SAFE_APPROACH.diversifier).toMatch(/sink you/);
  });

  it('C4 / D-ai: the Diversifier line IS the founder-approved wording, character for character, as the committed Amendment C states it — twice', () => {
    const amendment = fs.readFileSync(path.resolve(__dirname, '../../docs/FANTASYTRADES_BACKING_BETA_SPEC_V1_3_AMENDMENT_C.md'), 'utf8');
    const approved = amendment.match(/^Approved: \*"([^"]+)"\*/m)?.[1];
    const ruled = amendment.match(/^\| D-ai \| Diversifier line \| "([^"]+)" \|$/m)?.[1];
    expect(approved).toBe(BACKING_SAFE_APPROACH.diversifier);
    expect(ruled).toBe(BACKING_SAFE_APPROACH.diversifier);
  });
});

describe('backingSafeApproach — canonical when clean, the twin when not, nothing otherwise', () => {
  it('prefers a clean canonical line, whatever the archetype', () => {
    const clean = 'Goes where the momentum is — and leaves the moment it fades.';
    expect(backingSafeApproach('momentum_chaser', clean)).toBe(clean);
    expect(backingSafeApproach('diversifier', clean)).toBe(clean);
    expect(backingSafeApproach(null, clean)).toBe(clean);
  });

  it('falls back to the twin for a canonical line that fails, and to nothing when no twin exists', () => {
    expect(backingSafeApproach('diversifier', ARCHETYPE_IDENTITY.diversifier.disposition)).toBe(BACKING_SAFE_APPROACH.diversifier);
    expect(backingSafeApproach('analyst', 'Plays the odds.')).toBeNull();
    expect(backingSafeApproach('diversifier', null)).toBe(BACKING_SAFE_APPROACH.diversifier);
    expect(backingSafeApproach(null, null)).toBeNull();
    expect(backingSafeApproach('unknown_archetype', '')).toBeNull();
  });
});
