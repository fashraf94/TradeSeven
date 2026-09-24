// src/services/tournamentGroupService.subscribeGroup.test.js
//
// subscribeGroup's two answers to a listener ERROR (WIRE-D1, the pre-flip
// fixes 2 review record): a caller that passes `onError` gets the error — so
// "the read failed" is never "the pod is gone" (Your Backing's cancelled pod) —
// and is never told "gone" by the local cache (WIRE-R-3); every other caller
// keeps the `callback(null)` it has always had.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({ next: null, error: null }));
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, collection, id) => ({ path: `${collection}/${id}` }),
  onSnapshot: (_ref, next, error) => { fs.next = next; fs.error = error; return () => {}; },
  getDoc: vi.fn(), collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), getDocs: vi.fn(),
}));

const { subscribeGroup } = await import('./tournamentGroupService');

beforeEach(() => { fs.next = null; fs.error = null; vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('subscribeGroup — a listener error, told apart from a missing document on request (WIRE-D1)', () => {
  it('with `onError`: the error goes there, never `callback(null)`; a missing document is still `callback(null)`', () => {
    const callback = vi.fn();
    const onError = vi.fn();
    subscribeGroup('g1', callback, onError);
    const err = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    fs.error(err);
    expect(onError).toHaveBeenCalledWith(err);
    expect(callback).not.toHaveBeenCalled();
    fs.next({ exists: () => false });
    expect(callback).toHaveBeenCalledWith(null);
    fs.next({ exists: () => true, id: 'g1', data: () => ({ status: 'battle' }) });
    expect(callback).toHaveBeenLastCalledWith({ id: 'g1', status: 'battle' });
  });

  it('WIRE-R-3 — with `onError`, a "missing" from the local CACHE (offline, nothing cached) is not an answer: only the server\'s says the pod is gone', () => {
    const callback = vi.fn();
    subscribeGroup('g1', callback, vi.fn());
    fs.next({ exists: () => false, metadata: { fromCache: true } });
    expect(callback).not.toHaveBeenCalled();
    // A cached DOCUMENT is still the pod.
    fs.next({ exists: () => true, id: 'g1', data: () => ({ status: 'battle' }), metadata: { fromCache: true } });
    expect(callback).toHaveBeenLastCalledWith({ id: 'g1', status: 'battle' });
    fs.next({ exists: () => false, metadata: { fromCache: false } });
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  it('without it: every other caller\'s answer is unchanged — an error is `callback(null)`, and so is a cached "missing"', () => {
    const callback = vi.fn();
    subscribeGroup('g1', callback);
    fs.error(new Error('unavailable'));
    expect(callback).toHaveBeenCalledWith(null);
    callback.mockClear();
    fs.next({ exists: () => false, metadata: { fromCache: true } });
    expect(callback).toHaveBeenCalledWith(null);
  });
});
