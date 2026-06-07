// src/data/traitFamilies.test.js
//
// Phase 1A — the presentation-only family overlay. Locks the locked V2.2 mapping
// and the "unknown family fails closed" guarantee (acceptance #10), and proves
// family is INDEPENDENT of the mechanical dnaGroup (families must not leak into
// slots/seeding). Pure vitest.

import { describe, it, expect } from 'vitest';
import {
  TRAIT_FAMILIES,
  FAMILY_ORDER,
  getTraitFamily,
  isArchetypeAligned,
  getFamilyMeta,
  groupTraitsByFamily,
} from './traitFamilies';
import { TRAIT_LIBRARY } from './traitLibrary';

describe('family mapping (locked V2.2)', () => {
  it('every library trait maps to a known family', () => {
    for (const t of TRAIT_LIBRARY) {
      expect(FAMILY_ORDER, t.id).toContain(getTraitFamily(t.id));
    }
  });

  it('splits 8 temperament / 7 play / 1 preview', () => {
    const counts = TRAIT_LIBRARY.reduce((acc, t) => {
      const f = getTraitFamily(t.id);
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ temperament: 8, play: 7, preview: 1 });
  });

  it('Sector Rotator is a Play card and Score Adaptor is Preview', () => {
    expect(getTraitFamily('trait-sector-rotator')).toBe('play');
    expect(getTraitFamily('trait-score-adaptor')).toBe('preview');
  });

  it('Iron Discipline stays ONE temperament card (not split across axes)', () => {
    expect(getTraitFamily('trait-iron-discipline')).toBe('temperament');
    expect(TRAIT_LIBRARY.filter((t) => t.id === 'trait-iron-discipline')).toHaveLength(1);
  });
});

describe('family is independent of dnaGroup (no leak into mechanics)', () => {
  it('Sector Rotator: family=play but dnaGroup stays strategy', () => {
    const sr = TRAIT_LIBRARY.find((t) => t.id === 'trait-sector-rotator');
    expect(getTraitFamily(sr.id)).toBe('play');
    expect(sr.dnaGroup).toBe('strategy');
  });

  it('Score Adaptor: family=preview but dnaGroup stays strategy', () => {
    const sa = TRAIT_LIBRARY.find((t) => t.id === 'trait-score-adaptor');
    expect(getTraitFamily(sa.id)).toBe('preview');
    expect(sa.dnaGroup).toBe('strategy');
  });
});

describe('unknown family fails closed (acceptance #10)', () => {
  it('an unmapped traitId resolves to the neutral preview bucket, never crashes', () => {
    expect(getTraitFamily('totally-unknown')).toBe('preview');
    expect(getTraitFamily(undefined)).toBe('preview');
  });

  it('getFamilyMeta resolves unknown family ids to preview meta', () => {
    expect(getFamilyMeta('nope')).toBe(TRAIT_FAMILIES.preview);
    expect(getFamilyMeta('play')).toBe(TRAIT_FAMILIES.play);
  });

  it('groupTraitsByFamily routes an unmapped card into preview without dropping it', () => {
    const groups = groupTraitsByFamily([{ id: 'trait-iron-discipline' }, { id: 'mystery-card' }]);
    const preview = groups.find((g) => g.family === 'preview');
    expect(preview.traits.map((t) => t.id)).toContain('mystery-card');
  });
});

describe('archetype-aligned tag', () => {
  it('only Trend Rider and Bargain Hunter are archetype-aligned', () => {
    expect(isArchetypeAligned('trait-trend-rider')).toBe(true);
    expect(isArchetypeAligned('trait-bargain-hunter')).toBe(true);
    expect(isArchetypeAligned('trait-smart-money-tracker')).toBe(false);
    expect(isArchetypeAligned('trait-iron-discipline')).toBe(false);
  });
});

describe('groupTraitsByFamily ordering', () => {
  it('returns families in FAMILY_ORDER and drops empty buckets', () => {
    const groups = groupTraitsByFamily(TRAIT_LIBRARY);
    expect(groups.map((g) => g.family)).toEqual(['temperament', 'play', 'preview']);
  });

  it('drops a family with no members', () => {
    const groups = groupTraitsByFamily([{ id: 'trait-trend-rider' }]); // play only
    expect(groups.map((g) => g.family)).toEqual(['play']);
  });
});
