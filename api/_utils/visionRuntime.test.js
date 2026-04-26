// api/_utils/visionRuntime.test.js
// Spec A Phase 2a: tests for filterActiveConstraints.

import { describe, it, expect } from 'vitest';
import { filterActiveConstraints } from './visionRuntime.js';

// ==================== FIXTURES ====================

function makeConstraint({
  id = 'c1',
  type = 'user_carveout',
  source = 'user',
  payload = { statement: 'no tech', tags: { tickers: [], sectors: [], behaviors: [] } },
  createdAt = { seconds: 0 },
  expiresAt = null,
  lifecycleBinding = 'vision',
  createdBy = 'user',
} = {}) {
  return { id, type, source, payload, createdAt, expiresAt, lifecycleBinding, createdBy };
}

const NOW_MS = 1_700_000_000_000; // arbitrary fixed epoch
const PAST_TS  = { seconds: Math.floor((NOW_MS - 60_000) / 1000) };  // 1 min ago
const FUTURE_TS = { seconds: Math.floor((NOW_MS + 60_000) / 1000) }; // 1 min from now

// ==================== TESTS ====================

describe('filterActiveConstraints', () => {
  it('returns empty array for empty input', () => {
    expect(filterActiveConstraints([], 'active', NOW_MS)).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(filterActiveConstraints(null, 'active', NOW_MS)).toEqual([]);
    expect(filterActiveConstraints(undefined, 'active', NOW_MS)).toEqual([]);
  });

  it('filters out time-expired constraints', () => {
    const expired = makeConstraint({ id: 'expired', expiresAt: PAST_TS });
    const live = makeConstraint({ id: 'live', expiresAt: FUTURE_TS });
    const result = filterActiveConstraints([expired, live], 'active', NOW_MS);
    expect(result.map(c => c.id)).toEqual(['live']);
  });

  it('keeps constraints with no time expiry as long as lifecycleBinding is alive', () => {
    const c = makeConstraint({ expiresAt: null, lifecycleBinding: 'battle' });
    expect(filterActiveConstraints([c], 'active', NOW_MS)).toHaveLength(1);
  });

  it('filters out lifecycleBinding=vision constraints when state is retired', () => {
    const visionBound = makeConstraint({ id: 'v', lifecycleBinding: 'vision' });
    const battleBound = makeConstraint({ id: 'b', lifecycleBinding: 'battle' });
    const result = filterActiveConstraints([visionBound, battleBound], 'retired', NOW_MS);
    expect(result.map(c => c.id)).toEqual(['b']);
  });

  it('keeps lifecycleBinding=vision constraints across all non-retired states', () => {
    const c = makeConstraint({ lifecycleBinding: 'vision' });
    for (const state of ['unformed', 'proposed', 'active', 'under_debate', 'stale']) {
      expect(filterActiveConstraints([c], state, NOW_MS)).toHaveLength(1);
    }
  });

  it('keeps lifecycleBinding=battle while battle is running', () => {
    const c = makeConstraint({ lifecycleBinding: 'battle' });
    expect(filterActiveConstraints([c], 'active', NOW_MS)).toHaveLength(1);
  });

  it('keeps lifecycleBinding=event constraints (cleaned by event handler)', () => {
    const c = makeConstraint({ lifecycleBinding: 'event' });
    expect(filterActiveConstraints([c], 'active', NOW_MS)).toHaveLength(1);
  });

  it('keeps lifecycleBinding=explicit constraints (never auto-expires)', () => {
    const c = makeConstraint({ lifecycleBinding: 'explicit' });
    expect(filterActiveConstraints([c], 'active', NOW_MS)).toHaveLength(1);
    // Even when retired, explicit constraints persist
    expect(filterActiveConstraints([c], 'retired', NOW_MS)).toHaveLength(1);
  });

  it('fails closed for unknown lifecycleBinding', () => {
    const c = makeConstraint({ lifecycleBinding: 'unknown_binding' });
    expect(filterActiveConstraints([c], 'active', NOW_MS)).toHaveLength(0);
  });

  it('union-of-death: time-expiry OR lifecycle-expiry kills the constraint', () => {
    // Time-expired but lifecycle still alive: dead
    const a = makeConstraint({ id: 'a', expiresAt: PAST_TS, lifecycleBinding: 'battle' });
    // Time-alive but lifecycle dead: dead
    const b = makeConstraint({ id: 'b', expiresAt: FUTURE_TS, lifecycleBinding: 'vision' });
    // Both alive: alive
    const c = makeConstraint({ id: 'c', expiresAt: FUTURE_TS, lifecycleBinding: 'battle' });
    const result = filterActiveConstraints([a, b, c], 'retired', NOW_MS);
    expect(result.map(x => x.id)).toEqual(['c']);
  });

  it('handles Firestore Timestamp objects with toMillis() method', () => {
    const expiredFs = {
      ...makeConstraint({ id: 'expired' }),
      expiresAt: { toMillis: () => NOW_MS - 1000 },
    };
    const liveFs = {
      ...makeConstraint({ id: 'live' }),
      expiresAt: { toMillis: () => NOW_MS + 1000 },
    };
    const result = filterActiveConstraints([expiredFs, liveFs], 'active', NOW_MS);
    expect(result.map(c => c.id)).toEqual(['live']);
  });
});
