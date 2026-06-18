// api/_utils/trainingLoadoutSpec.test.js
//
// League Training Slice 5b-ii: the loadout-chooser whitelist (the security
// boundary). These tests pin the Tier-1 scope — ONLY archetype +
// equippedWatchlistId may be overridden — and the null/absent-watchlist contract.
//
// This file's real import of trainingLoadoutSpec.js (which imports the fenced
// VALID_ARCHETYPES) is the dependency-surface guard for that edge.

import { describe, it, expect } from 'vitest';
import { validateLoadoutSpecShape, LOADOUT_SPEC_ALLOWED_KEYS } from './trainingLoadoutSpec.js';

describe('validateLoadoutSpecShape', () => {
  it('treats undefined/null as a valid no-override (the fast-start path → pure inherit)', () => {
    expect(validateLoadoutSpecShape(undefined)).toEqual({ valid: true, value: null });
    expect(validateLoadoutSpecShape(null)).toEqual({ valid: true, value: null });
  });

  it('accepts archetype + equippedWatchlistId and normalizes', () => {
    const res = validateLoadoutSpecShape({ archetype: 'guardian', equippedWatchlistId: 'wl1' });
    expect(res.valid).toBe(true);
    expect(res.value).toEqual({ archetype: 'guardian', equippedWatchlistId: 'wl1' });
  });

  it('accepts archetype-only — a null/absent watchlist is valid ("no watchlist")', () => {
    expect(validateLoadoutSpecShape({ archetype: 'analyst' }))
      .toEqual({ valid: true, value: { archetype: 'analyst', equippedWatchlistId: null } });
    expect(validateLoadoutSpecShape({ archetype: 'analyst', equippedWatchlistId: null }))
      .toEqual({ valid: true, value: { archetype: 'analyst', equippedWatchlistId: null } });
  });

  it('trims a whitespace-padded watchlist id', () => {
    const res = validateLoadoutSpecShape({ archetype: 'degen', equippedWatchlistId: '  wl2  ' });
    expect(res.value).toEqual({ archetype: 'degen', equippedWatchlistId: 'wl2' });
  });

  it('REJECTS archetype outside the canonical set', () => {
    expect(validateLoadoutSpecShape({ archetype: 'wizard' })).toEqual({ valid: false, reason: 'bad_archetype' });
    expect(validateLoadoutSpecShape({ equippedWatchlistId: 'wl1' }).valid).toBe(false); // archetype required
  });

  it('REJECTS the deferred Tier-2 keys (traits/bundles) — guards the subcollection hazard', () => {
    expect(validateLoadoutSpecShape({ archetype: 'analyst', equippedTraits: ['x'] }).valid).toBe(false);
    expect(validateLoadoutSpecShape({ archetype: 'analyst', equippedBundleIds: ['b1'] }).valid).toBe(false);
  });

  it('REJECTS the inert config field and identity/cosmetic keys', () => {
    expect(validateLoadoutSpecShape({ archetype: 'analyst', config: { risk: 90 } }).valid).toBe(false);
    expect(validateLoadoutSpecShape({ archetype: 'analyst', name: 'Hacker' }).valid).toBe(false);
    expect(validateLoadoutSpecShape({ archetype: 'analyst', avatarColors: ['#fff'] }).valid).toBe(false);
    // server-derived only — a client-sent name is an unknown key
    expect(validateLoadoutSpecShape({ archetype: 'analyst', equippedWatchlistName: 'Spoof' }).valid).toBe(false);
  });

  it('REJECTS non-objects, arrays, and bad watchlist-id types', () => {
    expect(validateLoadoutSpecShape('archetype').valid).toBe(false);
    expect(validateLoadoutSpecShape(['archetype']).valid).toBe(false);
    expect(validateLoadoutSpecShape({ archetype: 'analyst', equippedWatchlistId: 123 }).valid).toBe(false);
    expect(validateLoadoutSpecShape({ archetype: 'analyst', equippedWatchlistId: '  ' }).valid).toBe(false);
  });

  it('the whitelist is exactly the two Tier-1 keys', () => {
    expect(LOADOUT_SPEC_ALLOWED_KEYS).toEqual(['archetype', 'equippedWatchlistId']);
  });
});
