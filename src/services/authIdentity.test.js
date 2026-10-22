// src/services/authIdentity.test.js
//
// Command Center slice S3 (ruling R-S3-2) — the one identity source:
// { resolved, uid, authEpoch }, the epoch up by one on every identity change
// (A→B→A and sign-out included), one auth listener, no Firestore read and no
// timer.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const auth = vi.hoisted(() => ({ listeners: [], starts: 0, throws: false }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((instance, callback) => {
    if (auth.throws) throw new Error('auth unreadable');
    auth.starts += 1;
    auth.listeners.push(callback);
    return () => {};
  }),
}));
vi.mock('../firebase/config', () => ({ auth: { name: 'the-app-auth' }, db: {} }));

const {
  readAuthIdentity, subscribeAuthIdentity, isCurrentIdentity, resetAuthIdentityForTests,
} = await import('./authIdentity');
const { onAuthStateChanged } = await import('firebase/auth');

const fire = (user) => { for (const cb of auth.listeners) cb(user); };

beforeEach(() => {
  resetAuthIdentityForTests();
  auth.listeners = [];
  auth.starts = 0;
  auth.throws = false;
  onAuthStateChanged.mockClear();
});

describe('the identity snapshot', () => {
  it('starts unresolved — not known yet, never "signed out" — at epoch 0', () => {
    expect(readAuthIdentity()).toEqual({ resolved: false, uid: null, authEpoch: 0 });
    expect(Object.isFrozen(readAuthIdentity())).toBe(true);
  });

  it('the first answer resolves it and is an identity change (epoch 1), signed in or out', () => {
    subscribeAuthIdentity(() => {});
    fire({ uid: 'uid-A' });
    expect(readAuthIdentity()).toEqual({ resolved: true, uid: 'uid-A', authEpoch: 1 });
    resetAuthIdentityForTests();
    auth.listeners = [];
    subscribeAuthIdentity(() => {});
    fire(null);
    expect(readAuthIdentity()).toEqual({ resolved: true, uid: null, authEpoch: 1 });
  });

  it('every identity change goes up by one: A→B, sign-out, sign-in, and A→B→A', () => {
    subscribeAuthIdentity(() => {});
    const epochs = [];
    for (const user of [{ uid: 'A' }, { uid: 'B' }, null, { uid: 'A' }, { uid: 'B' }, { uid: 'A' }]) {
      fire(user);
      epochs.push([readAuthIdentity().uid, readAuthIdentity().authEpoch]);
    }
    expect(epochs).toEqual([['A', 1], ['B', 2], [null, 3], ['A', 4], ['B', 5], ['A', 6]]);
  });

  it('the same identity again changes nothing: no new snapshot, no notification', () => {
    const notified = vi.fn();
    subscribeAuthIdentity(notified);
    fire({ uid: 'A' });
    const first = readAuthIdentity();
    fire({ uid: 'A', displayName: 'a token refresh' });
    expect(readAuthIdentity()).toBe(first);
    expect(notified).toHaveBeenCalledTimes(1);
    fire(null);
    fire(undefined);
    expect(readAuthIdentity().authEpoch).toBe(2);
    expect(notified).toHaveBeenCalledTimes(2);
  });

  it('a user without a real uid is signed out', () => {
    subscribeAuthIdentity(() => {});
    for (const user of [{}, { uid: '' }, { uid: 42 }]) {
      fire({ uid: 'A' });
      fire(user);
      expect(readAuthIdentity().uid).toBeNull();
    }
  });
});

describe('the listener', () => {
  it('one auth listener, on the app\'s auth instance, started by the first subscriber', () => {
    expect(auth.starts).toBe(0);
    const offA = subscribeAuthIdentity(() => {});
    subscribeAuthIdentity(() => {});
    offA();
    subscribeAuthIdentity(() => {});
    expect(auth.starts).toBe(1);
    expect(onAuthStateChanged.mock.calls[0][0]).toEqual({ name: 'the-app-auth' });
  });

  it('every subscriber hears each change; an unsubscribed one does not', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeAuthIdentity(a);
    subscribeAuthIdentity(b);
    fire({ uid: 'A' });
    offA();
    fire({ uid: 'B' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('an auth listener that cannot start leaves the identity unresolved, never a throw', () => {
    auth.throws = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => subscribeAuthIdentity(() => {})).not.toThrow();
    expect(readAuthIdentity().resolved).toBe(false);
    err.mockRestore();
  });
});

describe('isCurrentIdentity — a capture stays current only within its epoch', () => {
  it('current until the next change, and never again after it — A→B→A cannot revive it', () => {
    subscribeAuthIdentity(() => {});
    fire({ uid: 'A' });
    const capture = readAuthIdentity();
    expect(isCurrentIdentity(capture)).toBe(true);
    fire({ uid: 'B' });
    expect(isCurrentIdentity(capture)).toBe(false);
    fire({ uid: 'A' });
    expect(readAuthIdentity().uid).toBe(capture.uid);
    expect(isCurrentIdentity(capture)).toBe(false);
    expect(isCurrentIdentity(null)).toBe(false);
  });
});

describe('no Firestore read and no timer (R-S3-2)', () => {
  it('the module imports no Firestore and starts no timer', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const code = readFileSync(path.join(here, 'authIdentity.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/firebase\/firestore|getDoc|onSnapshot|\bquery\s*\(/);
    expect(code).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
    expect([...code.matchAll(/\bonAuthStateChanged\s*\(/g)]).toHaveLength(1);
  });
});
