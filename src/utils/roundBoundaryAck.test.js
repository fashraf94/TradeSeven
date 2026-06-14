// src/utils/roundBoundaryAck.test.js
//
// P7 (C) — the client-only acknowledgement. Locks: idempotent ack + remember
// roundtrip when storage works, AND the safe-degrade when storage is
// unavailable (reads → "not acknowledged" so the interstitial SHOWS; writes
// no-op; never throws).

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  isRoundBoundaryAcknowledged,
  acknowledgeRoundBoundary,
  rememberBracketGameId,
  getRememberedBracketGameId,
} from './roundBoundaryAck';

const realStorage = globalThis.localStorage;
afterEach(() => {
  if (realStorage) globalThis.localStorage = realStorage;
  else delete globalThis.localStorage;
  vi.restoreAllMocks();
});

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe('roundBoundaryAck — storage available', () => {
  it('acknowledge is idempotent and readable', () => {
    globalThis.localStorage = memStorage();
    expect(isRoundBoundaryAcknowledged('B-r1-g1')).toBe(false);
    acknowledgeRoundBoundary('B-r1-g1');
    acknowledgeRoundBoundary('B-r1-g1'); // idempotent
    expect(isRoundBoundaryAcknowledged('B-r1-g1')).toBe(true);
    expect(isRoundBoundaryAcknowledged('B-r2-g1')).toBe(false); // per-game
  });

  it('remembers the last bracket game id (eliminated-path recovery)', () => {
    globalThis.localStorage = memStorage();
    expect(getRememberedBracketGameId()).toBeNull();
    rememberBracketGameId('B-r1-g1');
    expect(getRememberedBracketGameId()).toBe('B-r1-g1');
  });

  it('ignores empty ids', () => {
    globalThis.localStorage = memStorage();
    expect(isRoundBoundaryAcknowledged('')).toBe(false);
    acknowledgeRoundBoundary(''); // no-op
    rememberBracketGameId(null);  // no-op
    expect(getRememberedBracketGameId()).toBeNull();
  });
});

describe('roundBoundaryAck — storage UNAVAILABLE (safe degrade)', () => {
  it('reads → not acknowledged (interstitial shows), writes never throw', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('storage disabled'); },
      setItem: () => { throw new Error('storage disabled'); },
    };
    expect(isRoundBoundaryAcknowledged('B-r1-g1')).toBe(false); // shows, not suppressed
    expect(() => acknowledgeRoundBoundary('B-r1-g1')).not.toThrow();
    expect(getRememberedBracketGameId()).toBeNull();
    expect(() => rememberBracketGameId('B-r1-g1')).not.toThrow();
  });
});
