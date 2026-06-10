// src/utils/equipSlots.test.js
//
// Unit tests for the canonical Equip-bench slot array. Plain vitest, no
// rendering — matches the convention in traitSlotSummary.test.js. Assertions
// branch on TRAIT_SLOT_ENABLED so they hold under an uncommitted flag flip.

import { describe, it, expect } from 'vitest';
import { getEquipSlots, getEquipSlotCounts } from './equipSlots.js';
import { TRAIT_SLOT_ENABLED } from '../config/featureFlags.js';

describe('getEquipSlots', () => {
  it('renders the traits slot only behind TRAIT_SLOT_ENABLED', () => {
    const slots = getEquipSlots({});
    expect(slots).toHaveLength(TRAIT_SLOT_ENABLED ? 3 : 2);
    expect(slots.some((s) => s.id === 'traits')).toBe(TRAIT_SLOT_ENABLED);
  });

  it('always leads with a filled archetype slot, then watchlist', () => {
    const slots = getEquipSlots(null);
    expect(slots[0]).toEqual({ id: 'archetype', filled: true });
    expect(slots[1]).toEqual({ id: 'watchlist', filled: false });
  });

  it('fills the watchlist slot from equippedWatchlistId', () => {
    expect(getEquipSlots({ equippedWatchlistId: 'wl_1' })[1].filled).toBe(true);
    expect(getEquipSlots({ equippedWatchlistId: null })[1].filled).toBe(false);
  });

  it('fills the traits slot from equippedTraits when the flag is on', () => {
    if (!TRAIT_SLOT_ENABLED) return;
    const traits = (agent) => getEquipSlots(agent).find((s) => s.id === 'traits');
    expect(traits({ equippedTraits: [{ traitId: 't1' }] }).filled).toBe(true);
    expect(traits({ equippedTraits: [] }).filled).toBe(false);
  });
});

describe('getEquipSlotCounts', () => {
  it('derives filled/total from the slot array, never a literal', () => {
    const agent = { equippedWatchlistId: 'wl_1', equippedTraits: [{ traitId: 't1' }] };
    const slots = getEquipSlots(agent);
    expect(getEquipSlotCounts(agent)).toEqual({
      filled: slots.filter((s) => s.filled).length,
      total: slots.length,
    });
  });

  it('counts a fresh agent as archetype-only', () => {
    expect(getEquipSlotCounts({})).toEqual({ filled: 1, total: TRAIT_SLOT_ENABLED ? 3 : 2 });
  });
});
