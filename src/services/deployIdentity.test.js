// src/services/deployIdentity.test.js
//
// Command Center repair R1 (ruling R-R1-4) — the one reader of the signed-in
// uid the deploy, App's handoff and the existing-battle terminal compare.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { current } = vi.hoisted(() => ({ current: { user: null, throws: false } }));
vi.mock('../firebase/authService', () => ({
  getCurrentUser: () => { if (current.throws) throw new Error('auth unreadable'); return current.user; },
}));

const { signedInUid } = await import('./deployIdentity');

beforeEach(() => { current.user = null; current.throws = false; });

describe('signedInUid', () => {
  it('the signed-in user\'s uid', () => {
    current.user = { uid: 'uid-A' };
    expect(signedInUid()).toBe('uid-A');
  });
  it.each([
    ['nobody signed in', null],
    ['a user with no uid', {}],
    ['an empty uid', { uid: '' }],
    ['a non-string uid', { uid: 42 }],
  ])('%s → null', (_label, user) => {
    current.user = user;
    expect(signedInUid()).toBeNull();
  });
  it('an unreadable auth → null, never a throw', () => {
    current.throws = true;
    expect(signedInUid()).toBeNull();
  });
});
