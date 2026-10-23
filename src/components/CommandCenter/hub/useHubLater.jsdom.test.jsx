// @vitest-environment jsdom
//
// Command Center hub, slice S4 (ruling R-S4-3; spec V1.2 §8.2, review IR-12) — Later's store: keys in sessionStorage under
// cc.later.{uid}; they survive a remount, accumulate, clear on an actual identity change (and never on a frame where the identity
// has not answered), and with storage unavailable Later still works for the mount.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useHubLater, { laterStorageKey } from './useHubLater';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const A = Object.freeze({ signedIn: true, uid: 'uid-A', authEpoch: 1 });
const B = Object.freeze({ signedIn: true, uid: 'uid-B', authEpoch: 2 });
const SIGNED_OUT = Object.freeze({ signedIn: false });

let host;
let root;
let seen;
function Probe({ auth }) {
  seen.push(useHubLater(auth));
  return null;
}
const last = () => seen[seen.length - 1];
const stored = (uid) => JSON.parse(sessionStorage.getItem(laterStorageKey(uid)) || 'null');

function mount(auth) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  seen = [];
  act(() => { root.render(<Probe auth={auth} />); });
}
const rerender = (auth) => act(() => { root.render(<Probe auth={auth} />); });
const unmount = () => { act(() => root.unmount()); host.remove(); };

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => {
  try { unmount(); } catch { /* already unmounted */ }
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('the store', () => {
  it('is sessionStorage under cc.later.{uid}, a JSON list of the keys', () => {
    mount(A);
    act(() => last().dismiss('openGame:g1'));
    expect(laterStorageKey('uid-A')).toBe('cc.later.uid-A');
    expect(stored('uid-A')).toEqual(['openGame:g1']);
    expect([...last().dismissed]).toEqual(['openGame:g1']);
  });

  it('survives a remount in the same tab: the item stays dismissed', () => {
    mount(A);
    act(() => last().dismiss('review:done_1'));
    unmount();
    mount(A);
    expect(last().dismissed.has('review:done_1')).toBe(true);
    expect(seen[0].dismissed.has('review:done_1'), 'from the very first render').toBe(true);
  });

  it('accumulates: two Laters both stay, across a remount too', () => {
    mount(A);
    act(() => last().dismiss('openGame:g1'));
    act(() => last().dismiss('review:done_1'));
    expect([...last().dismissed].sort()).toEqual(['openGame:g1', 'review:done_1']);
    unmount();
    mount(A);
    expect([...last().dismissed].sort()).toEqual(['openGame:g1', 'review:done_1']);
    expect(stored('uid-A').sort()).toEqual(['openGame:g1', 'review:done_1']);
  });

  it('two Laters in one tick both stay: the second starts from the first, not from the render before it', () => {
    mount(A);
    const { dismiss } = last();
    act(() => { dismiss('openGame:g1'); dismiss('openGame:g2'); });
    expect([...last().dismissed].sort()).toEqual(['openGame:g1', 'openGame:g2']);
    expect(stored('uid-A').sort()).toEqual(['openGame:g1', 'openGame:g2']);
  });

  it('the same key twice is one key', () => {
    mount(A);
    act(() => last().dismiss('deploy:first'));
    act(() => last().dismiss('deploy:first'));
    expect(stored('uid-A')).toEqual(['deploy:first']);
  });

  it('a key that is not a non-empty string is ignored; a malformed store reads as empty', () => {
    sessionStorage.setItem(laterStorageKey('uid-A'), '{not json');
    mount(A);
    expect(last().dismissed.size).toBe(0);
    act(() => { last().dismiss(''); last().dismiss(null); last().dismiss(42); });
    expect(last().dismissed.size).toBe(0);
    unmount();
    sessionStorage.setItem(laterStorageKey('uid-A'), JSON.stringify(['ok', 3, null, '', { a: 1 }]));
    mount(A);
    expect([...last().dismissed]).toEqual(['ok']);
    unmount();
    sessionStorage.setItem(laterStorageKey('uid-A'), JSON.stringify({ openGame: true }));
    mount(A);
    expect(last().dismissed.size).toBe(0);
  });
});

describe('an actual identity change clears it (IR-12)', () => {
  it('account A to account B: A\'s set is gone from the store and from the hub, and B starts empty', () => {
    mount(A);
    act(() => last().dismiss('openGame:g1'));
    rerender(B);
    expect(last().dismissed.size).toBe(0);
    expect(stored('uid-A')).toBeNull();
    act(() => last().dismiss('review:done_9'));
    expect(stored('uid-B')).toEqual(['review:done_9']);
    expect(stored('uid-A')).toBeNull();
  });

  // A sign-out the MOUNTED hub sees. App's own logout (`logout(); setScreen('home')`) unmounts the dashboard first, so there a same-uid
  // sign-in in the same tab finds its Laters (next row); the ruling clears them on an actual uid change.
  it('a sign-out the mounted hub sees clears it, and signing back in as the same uid starts empty', () => {
    mount(A);
    act(() => last().dismiss('openGame:g1'));
    rerender(SIGNED_OUT);
    expect(last().dismissed.size).toBe(0);
    expect(stored('uid-A')).toBeNull();
    rerender(A);
    expect(last().dismissed.size).toBe(0);
  });

  it('a same-uid sign-in after a logout that unmounted the hub finds its Laters: the uid did not change, and they go with the tab (N-4)', () => {
    mount(A);
    act(() => last().dismiss('openGame:g1'));
    unmount();
    mount({ signedIn: true, uid: 'uid-A', authEpoch: 3 });
    expect(last().dismissed.has('openGame:g1')).toBe(true);
  });

  it('a frame where the identity has not answered (auth null) clears nothing — every cold mount has one', () => {
    mount(A);
    act(() => last().dismiss('openGame:g1'));
    rerender(null);
    expect(last().dismissed.has('openGame:g1')).toBe(true);
    expect(stored('uid-A')).toEqual(['openGame:g1']);
    rerender(A);
    expect(last().dismissed.has('openGame:g1')).toBe(true);
  });

  it('the identity answering for the first time is not a change: a mount that begins unresolved keeps the stored set', () => {
    sessionStorage.setItem(laterStorageKey('uid-A'), JSON.stringify(['openGame:g1']));
    mount(null);
    expect(last().dismissed.size).toBe(0);
    rerender(A);
    expect(last().dismissed.has('openGame:g1')).toBe(true);
    expect(stored('uid-A')).toEqual(['openGame:g1']);
  });

  it('a hub that mounts for another account finds the former account\'s key and drops it', () => {
    sessionStorage.setItem(laterStorageKey('uid-A'), JSON.stringify(['openGame:g1']));
    sessionStorage.setItem('cc.other', 'keep');
    mount(B);
    expect(last().dismissed.size).toBe(0);
    expect(stored('uid-A')).toBeNull();
    expect(sessionStorage.getItem('cc.other'), 'only Later\'s own keys').toBe('keep');
  });

  it('at a change the new account\'s set is read from the store as it stands (one written for B after A mounted is B\'s), not cleared', () => {
    mount(A);
    sessionStorage.setItem(laterStorageKey('uid-B'), JSON.stringify(['review:done_2']));
    rerender(B);
    expect(last().dismissed.has('review:done_2')).toBe(true);
    expect(stored('uid-B')).toEqual(['review:done_2']);
  });
});

describe('with storage unavailable, Later still works for the mount (R-S4-3)', () => {
  const denied = () => { throw new Error('SecurityError: the operation is insecure'); };

  it('every call throws: reads are empty, a Later still sets the item aside, nothing is thrown', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'key').mockImplementation(denied);
    expect(() => mount(A)).not.toThrow();
    expect(last().dismissed.size).toBe(0);
    expect(() => act(() => last().dismiss('openGame:g1'))).not.toThrow();
    expect(last().dismissed.has('openGame:g1')).toBe(true);
    act(() => last().dismiss('openGame:g2'));
    expect([...last().dismissed].sort()).toEqual(['openGame:g1', 'openGame:g2']);
  });

  it('the sweep for another account\'s key survives a store whose length or key() throws (a hub mounting with others\' keys about)', () => {
    vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(denied);
    expect(() => mount(A)).not.toThrow();
    act(() => last().dismiss('openGame:g1'));
    expect(last().dismissed.has('openGame:g1')).toBe(true);
    vi.restoreAllMocks();
    sessionStorage.setItem(laterStorageKey('uid-A'), JSON.stringify(['x']));
    unmount();
    vi.spyOn(Storage.prototype, 'key').mockImplementation(denied);
    expect(() => mount(B)).not.toThrow();
  });

  it('an identity change with storage down still empties the set for the new account', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);
    mount(A);
    act(() => last().dismiss('openGame:g1'));
    expect(() => rerender(B)).not.toThrow();
    expect(last().dismissed.size).toBe(0);
  });

  it('only writes fail (a full store): the mount keeps its set from memory', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('QuotaExceededError'); });
    mount(A);
    act(() => last().dismiss('review:done_1'));
    expect(last().dismissed.has('review:done_1')).toBe(true);
    expect(stored('uid-A')).toBeNull();
  });
});
