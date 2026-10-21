// src/hooks/holdClaim.test.js
//
// Command Center repair R2, ruling R-R2-1 — the app-wide hold slot, as a pure
// module. The gesture rows that drive it through the real button are in
// useHoldToDeploy.r2.jsdom.test.jsx; these pin the slot's own contract.

import { describe, it, expect, beforeEach } from 'vitest';
import { claimHold, commitHold, releaseHold, currentHold, __resetHoldClaim } from './holdClaim';

beforeEach(() => { __resetHoldClaim(); });

describe('claimHold — only an empty slot grants a token', () => {
  it('an empty slot grants an opaque string token and reads back as charging', () => {
    expect(currentHold()).toBeNull();
    const token = claimHold('card');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(currentHold()).toEqual({ controlId: 'card', holdToken: token, phase: 'charging' });
  });

  it('a held slot denies every other claim — another control, and a second input on the same one', () => {
    const token = claimHold('card');
    expect(claimHold('strip')).toBeNull();
    expect(claimHold('card')).toBeNull();
    expect(currentHold().holdToken).toBe(token);
  });

  it('a locked slot denies claims too', () => {
    const token = claimHold('card');
    commitHold(token);
    expect(claimHold('strip')).toBeNull();
  });

  it('a claim with no control id is denied and leaves the slot empty (fails closed)', () => {
    for (const id of [undefined, null, '']) {
      expect(claimHold(id), String(id)).toBeNull();
      expect(currentHold()).toBeNull();
    }
  });

  it('every grant is a fresh token, across releases and across the test reset', () => {
    const seen = new Set();
    for (let i = 0; i < 5; i += 1) {
      const token = claimHold('card');
      expect(seen.has(token)).toBe(false);
      seen.add(token);
      releaseHold(token);
    }
    __resetHoldClaim();
    expect(seen.has(claimHold('card'))).toBe(false);
  });
});

describe('commitHold — the atomic commitment check', () => {
  it('the current charging token commits once and locks the slot', () => {
    const token = claimHold('card');
    expect(commitHold(token)).toBe(true);
    expect(currentHold()).toEqual({ controlId: 'card', holdToken: token, phase: 'locked' });
    expect(commitHold(token)).toBe(false); // locked is not charging
  });

  it('a competitor, a stale or a missing token cannot commit, and the slot is untouched', () => {
    const stale = claimHold('strip');
    releaseHold(stale);
    const token = claimHold('card');
    for (const other of [stale, `${token}x`, null, undefined]) {
      expect(commitHold(other), String(other)).toBe(false);
    }
    expect(currentHold().phase).toBe('charging');
  });

  it('an empty slot commits nothing', () => {
    expect(commitHold('anything')).toBe(false);
    expect(currentHold()).toBeNull();
  });
});

describe('releaseHold — only its own token empties the slot', () => {
  it('the owner releases from charging and from locked', () => {
    const a = claimHold('card');
    expect(releaseHold(a)).toBe(true);
    expect(currentHold()).toBeNull();
    const b = claimHold('card');
    commitHold(b);
    expect(releaseHold(b)).toBe(true);
    expect(currentHold()).toBeNull();
  });

  it('a stale token cannot release a newer holder', () => {
    const old = claimHold('card');
    releaseHold(old);
    const current = claimHold('strip');
    expect(releaseHold(old)).toBe(false);
    expect(releaseHold(null)).toBe(false);
    expect(currentHold().holdToken).toBe(current);
  });

  it('after a release a second control can claim', () => {
    const a = claimHold('card');
    releaseHold(a);
    expect(claimHold('strip')).not.toBeNull();
  });
});

describe('currentHold — a frozen snapshot for readers', () => {
  it('is frozen, and is a copy: a reader cannot change the slot', () => {
    const token = claimHold('card');
    const snap = currentHold();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(() => { snap.phase = 'locked'; }).toThrow(TypeError);
    expect(commitHold(token)).toBe(true); // still charging underneath
    expect(snap.phase).toBe('charging');  // the earlier snapshot does not move
  });
});
