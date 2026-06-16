// src/components/Forge/workshop/forgeStatus.test.js
//
// Unit tests for the Forge shelf-status mapping + overview tally counters.
// Locks the honest-count semantics: traits are EXCLUDED from the "ready to
// equip / in progress" aggregate (an equipped trait is in-use, not ready, and
// there is no trait draft lifecycle) — they are surfaced as their own equipped
// count instead. (The helper was previously untested — see the Phase 0 audit §10.)

import { describe, it, expect } from 'vitest';
import {
  SHELF_DRAFT,
  SHELF_READY,
  watchlistShelfStatus,
  bundleShelfStatus,
  bundlePillStatus,
  countWatchlists,
  countBundles,
  countTraits,
  countForgeAggregate,
} from './forgeStatus';

const watchlist = (overrides = {}) => ({ watchlistId: 'wl', status: 'draft', ...overrides });
const bundle = (overrides = {}) => ({ id: 'b', status: 'draft', ...overrides });
const trait = (overrides = {}) => ({ traitId: 't', name: 'Trait', ...overrides });

describe('SHELF_* constants', () => {
  it('expose the two shared shelf states', () => {
    expect(SHELF_DRAFT).toBe('draft');
    expect(SHELF_READY).toBe('ready');
  });
});

describe('watchlistShelfStatus', () => {
  it('maps committed -> ready', () => {
    expect(watchlistShelfStatus(watchlist({ status: 'committed' }))).toBe(SHELF_READY);
  });
  it('maps draft (or anything else) -> draft', () => {
    expect(watchlistShelfStatus(watchlist({ status: 'draft' }))).toBe(SHELF_DRAFT);
    expect(watchlistShelfStatus(watchlist({ status: 'whatever' }))).toBe(SHELF_DRAFT);
  });
  it('treats a nullish watchlist as draft', () => {
    expect(watchlistShelfStatus(null)).toBe(SHELF_DRAFT);
    expect(watchlistShelfStatus(undefined)).toBe(SHELF_DRAFT);
  });
});

describe('bundleShelfStatus', () => {
  it('maps forged and equipped -> ready', () => {
    expect(bundleShelfStatus(bundle({ status: 'forged' }))).toBe(SHELF_READY);
    expect(bundleShelfStatus(bundle({ status: 'equipped' }))).toBe(SHELF_READY);
  });
  it('maps draft -> draft', () => {
    expect(bundleShelfStatus(bundle({ status: 'draft' }))).toBe(SHELF_DRAFT);
  });
  it('treats a nullish bundle as draft', () => {
    expect(bundleShelfStatus(null)).toBe(SHELF_DRAFT);
  });
});

describe('bundlePillStatus', () => {
  it('distinguishes equipped from plain ready', () => {
    expect(bundlePillStatus(bundle({ status: 'equipped' }))).toBe('equipped');
    expect(bundlePillStatus(bundle({ status: 'forged' }))).toBe(SHELF_READY);
    expect(bundlePillStatus(bundle({ status: 'draft' }))).toBe(SHELF_DRAFT);
  });
});

describe('countWatchlists', () => {
  it('tallies ready (committed) vs draft', () => {
    expect(countWatchlists([
      watchlist({ watchlistId: 'a', status: 'committed' }),
      watchlist({ watchlistId: 'b', status: 'draft' }),
      watchlist({ watchlistId: 'c', status: 'committed' }),
    ])).toEqual({ ready: 2, draft: 1, total: 3 });
  });
  it('defaults to an empty tally', () => {
    expect(countWatchlists([])).toEqual({ ready: 0, draft: 0, total: 0 });
    expect(countWatchlists(undefined)).toEqual({ ready: 0, draft: 0, total: 0 });
  });
});

describe('countBundles', () => {
  it('tallies ready (forged/equipped) vs draft', () => {
    expect(countBundles([
      bundle({ id: 'a', status: 'forged' }),
      bundle({ id: 'b', status: 'draft' }),
      bundle({ id: 'c', status: 'equipped' }),
    ])).toEqual({ ready: 2, draft: 1, total: 3 });
  });
  it('defaults to an empty tally', () => {
    expect(countBundles([])).toEqual({ ready: 0, draft: 0, total: 0 });
    expect(countBundles(undefined)).toEqual({ ready: 0, draft: 0, total: 0 });
  });
});

describe('countTraits', () => {
  it('counts equipped traits as ready with no draft lifecycle', () => {
    expect(countTraits([trait({ traitId: 't1' }), trait({ traitId: 't2' })]))
      .toEqual({ ready: 2, draft: 0, total: 2 });
  });
  it('defaults to an empty tally', () => {
    expect(countTraits([])).toEqual({ ready: 0, draft: 0, total: 0 });
    expect(countTraits(undefined)).toEqual({ ready: 0, draft: 0, total: 0 });
  });
});

describe('countForgeAggregate (the overview "ready / in progress" tiles)', () => {
  it('sums Watchlists + Rule bundles only', () => {
    const watchlists = [
      watchlist({ watchlistId: 'a', status: 'committed' }), // ready
      watchlist({ watchlistId: 'b', status: 'draft' }),     // draft
    ];
    const bundles = [
      bundle({ id: 'x', status: 'forged' }),   // ready
      bundle({ id: 'y', status: 'equipped' }), // ready
      bundle({ id: 'z', status: 'draft' }),    // draft
    ];
    expect(countForgeAggregate(watchlists, bundles)).toEqual({ ready: 3, draft: 2 });
  });

  it('EXCLUDES equipped traits — the aggregate does not depend on traits at all', () => {
    const watchlists = [watchlist({ status: 'committed' })];
    const bundles = [bundle({ status: 'forged' })];
    // Same inputs, regardless of how many traits are equipped, yield the same total.
    expect(countForgeAggregate(watchlists, bundles)).toEqual({ ready: 2, draft: 0 });
  });

  it('defaults to a zero aggregate', () => {
    expect(countForgeAggregate()).toEqual({ ready: 0, draft: 0 });
    expect(countForgeAggregate([], [])).toEqual({ ready: 0, draft: 0 });
  });
});
