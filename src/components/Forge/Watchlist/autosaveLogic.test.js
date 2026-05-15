// src/components/Forge/Watchlist/autosaveLogic.test.js
//
// Sprint 6 Phase 4B — pure-logic coverage for the auto-save decision rules.

import { describe, it, expect } from 'vitest';
import {
  fieldsEqual,
  mergePending,
  pruneTimestamps,
  canSaveNow,
  nextSaveState,
} from './autosaveLogic';

describe('fieldsEqual — no-op skip', () => {
  it('is true when every pending field matches the confirmed state', () => {
    const confirmed = { name: 'AI plays', notes: 'n', tickers: [{ symbol: 'AAPL' }] };
    expect(fieldsEqual({ name: 'AI plays' }, confirmed)).toBe(true);
    expect(fieldsEqual({ tickers: [{ symbol: 'AAPL' }] }, confirmed)).toBe(true);
    expect(fieldsEqual(null, confirmed)).toBe(true);
  });

  it('is false when a pending field differs, including array fields', () => {
    const confirmed = { name: 'AI plays', tickers: [{ symbol: 'AAPL' }] };
    expect(fieldsEqual({ name: 'changed' }, confirmed)).toBe(false);
    expect(fieldsEqual({ tickers: [{ symbol: 'AAPL' }, { symbol: 'NVDA' }] }, confirmed)).toBe(false);
    expect(fieldsEqual({ tickers: [{ symbol: 'NVDA' }] }, confirmed)).toBe(false);
  });
});

describe('mergePending — debounce coalescing', () => {
  it('merges successive edits with the later edit winning', () => {
    const a = mergePending(null, { name: 'first' });
    const b = mergePending(a, { notes: 'hello' });
    const c = mergePending(b, { name: 'second' });
    expect(c).toEqual({ name: 'second', notes: 'hello' });
  });
});

describe('pruneTimestamps + canSaveNow — rate-limit guard', () => {
  it('prunes timestamps outside the window', () => {
    const now = 100_000;
    const kept = pruneTimestamps([10_000, 50_000, 99_000], now, 60_000);
    expect(kept).toEqual([50_000, 99_000]);
  });

  it('allows a save under the limit and blocks one at the limit', () => {
    const now = 100_000;
    const opts = { limit: 3, windowMs: 60_000 };
    expect(canSaveNow([99_000, 98_000], now, opts)).toBe(true);
    expect(canSaveNow([99_000, 98_000, 97_000], now, opts)).toBe(false);
    // Old timestamps outside the window do not count.
    expect(canSaveNow([10_000, 20_000, 30_000, 99_000], now, opts)).toBe(true);
  });
});

describe('nextSaveState — indicator state machine', () => {
  it('moves through flush_start / success / error', () => {
    expect(nextSaveState('idle', 'flush_start')).toBe('saving');
    expect(nextSaveState('saving', 'success')).toBe('saved');
    expect(nextSaveState('saving', 'error')).toBe('error');
  });

  it('fades a saved badge to idle but never overrides a newer save', () => {
    expect(nextSaveState('saved', 'fade')).toBe('idle');
    expect(nextSaveState('saving', 'fade')).toBe('saving');
    expect(nextSaveState('error', 'fade')).toBe('error');
  });
});
