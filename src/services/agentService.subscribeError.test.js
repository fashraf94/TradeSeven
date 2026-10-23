// src/services/agentService.subscribeError.test.js
//
// Command Center slice S3 (ruling R-S3-4) — subscribeToUserAgent's optional
// error callback. Without it a subscription error reads as "no agent"
// (callback(null)), exactly as before; with it the error goes to the caller and
// no null answer stands in for it.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fs = vi.hoisted(() => ({ next: null, fail: null, unsubscribe: null }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, name) => ({ name })),
  query: vi.fn((col, ...clauses) => ({ col, clauses })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  doc: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), serverTimestamp: vi.fn(), arrayUnion: vi.fn(), arrayRemove: vi.fn(),
  onSnapshot: vi.fn((q, next, fail) => { fs.next = next; fs.fail = fail; fs.unsubscribe = vi.fn(); return fs.unsubscribe; }),
}));
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn() }));

const { subscribeToUserAgent } = await import('./agentService.js');

let err;
beforeEach(() => {
  err = vi.spyOn(console, 'error').mockImplementation(() => {});
  return () => err.mockRestore();
});

const snapshot = (docs) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });

describe('subscribeToUserAgent — the error path', () => {
  it('without an error callback: the error reads as no agent and is logged, exactly as before', () => {
    const callback = vi.fn();
    subscribeToUserAgent('uid-A', callback);
    const failure = new Error('permission-denied');
    fs.fail(failure);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
    expect(err).toHaveBeenCalledWith('Agent subscription error:', failure);
  });

  it('with one: the caller gets the error, and no null answer stands in for it', () => {
    const callback = vi.fn();
    const onError = vi.fn();
    subscribeToUserAgent('uid-A', callback, onError);
    const failure = new Error('unavailable');
    fs.fail(failure);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(callback).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith('Agent subscription error:', failure);
  });

  it('the success path is unchanged either way: the ranked agent, clones excluded, or null when there is none', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToUserAgent('uid-A', callback, vi.fn());
    fs.next(snapshot([{ id: 'clone', isTrainingClone: true }, { id: 'casual', isCasualClone: true }, { id: 'ranked', name: 'Aurora' }]));
    fs.next(snapshot([{ id: 'clone', isTrainingClone: true }]));
    expect(callback.mock.calls).toEqual([[{ id: 'ranked', name: 'Aurora' }], [null]]);
    expect(unsubscribe).toBe(fs.unsubscribe);
  });

  it('a non-function error callback is ignored: the old null answer', () => {
    const callback = vi.fn();
    subscribeToUserAgent('uid-A', callback, 'not a function');
    fs.fail(new Error('x'));
    expect(callback).toHaveBeenCalledWith(null);
  });
});
