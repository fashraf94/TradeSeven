// src/utils/traitSlotSummary.test.js
//
// Unit tests for the pure Traits-slot display helper. Plain vitest, no rendering —
// matches the convention in watchlistEquipUI.test.js / traitEnforcement.test.js.

import { describe, it, expect } from 'vitest';
import { getTraitSlotSummary } from './traitSlotSummary.js';

describe('getTraitSlotSummary', () => {
  it('is empty for an agent with no equipped traits', () => {
    expect(getTraitSlotSummary({ equippedTraits: [] })).toMatchObject({
      equipped: false, count: 0, summary: '', name: 'Add traits', sub: 'Optional · shapes your agent',
    });
  });

  it('handles a null agent / missing field', () => {
    expect(getTraitSlotSummary(null)).toMatchObject({ equipped: false, count: 0, name: 'Add traits' });
    expect(getTraitSlotSummary({})).toMatchObject({ equipped: false, count: 0, name: 'Add traits' });
  });

  it('uses the singular "1 trait" for one', () => {
    expect(getTraitSlotSummary({ equippedTraits: [{ traitId: 'trait-trend-rider' }] }))
      .toMatchObject({ equipped: true, count: 1, name: '1 trait', sub: 'Trend Rider' });
  });

  it('uses the plural and joins the first two names', () => {
    const s = getTraitSlotSummary({ equippedTraits: [
      { traitId: 'trait-trend-rider' }, { traitId: 'trait-diversifier' },
    ] });
    expect(s).toMatchObject({ equipped: true, count: 2, name: '2 traits', summary: 'Trend Rider · Diversifier' });
    expect(s.sub).toBe('Trend Rider · Diversifier');
  });

  it('adds a " +N" overflow tail beyond the first two', () => {
    const s = getTraitSlotSummary({ equippedTraits: [
      { traitId: 'trait-trend-rider' }, { traitId: 'trait-diversifier' }, { traitId: 'trait-sector-rotator' },
    ] });
    expect(s).toMatchObject({ count: 3, name: '3 traits', summary: 'Trend Rider · Diversifier +1' });
  });

  it('skips unknown trait ids when building names (count stays raw)', () => {
    const s = getTraitSlotSummary({ equippedTraits: [
      { traitId: 'trait-trend-rider' }, { traitId: 'totally-unknown' },
    ] });
    expect(s.count).toBe(2);
    expect(s.names).toEqual(['Trend Rider']);
    expect(s.summary).toBe('Trend Rider');
  });
});
