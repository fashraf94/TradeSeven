// @vitest-environment jsdom
//
// src/hooks/useRecentCompletedAgentBattles.jsdom.test.jsx
//
// Command Center slice S3 (ruling R-S3-5) — the legacy hook keeps its array
// return for its two callers (CommandDashboard, CommandDashboardDesktop) while
// sharing its read with the hub: an array from the first render, one read per
// uid and max, the read's list on success, and a failure swallowed into the
// list it already had (an empty Review section) — exactly as before.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const env = vi.hoisted(() => ({ auth: { currentUser: { uid: 'uid-A' } }, reads: [], answer: null }));
vi.mock('../firebase/config', () => ({ auth: env.auth, db: {} }));
vi.mock('../services/completedAgentBattles', () => ({
  fetchRecentCompletedAgentBattles: vi.fn(async (uid, max) => { env.reads.push([uid, max]); return env.answer(uid, max); }),
}));

import useRecentCompletedAgentBattles from './useRecentCompletedAgentBattles';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
let seen;
function DefaultProbe() {
  seen.push(useRecentCompletedAgentBattles());
  return null;
}
function MaxProbe({ max }) {
  seen.push(useRecentCompletedAgentBattles(max));
  return null;
}
const render = async (max) => {
  await act(async () => { root.render(max === undefined ? <DefaultProbe /> : <MaxProbe max={max} />); });
};
const last = () => seen[seen.length - 1];

let err;
beforeEach(() => {
  env.auth.currentUser = { uid: 'uid-A' };
  env.reads = [];
  env.answer = async () => [{ id: 'done_1' }, { id: 'done_2' }];
  seen = [];
  err = vi.spyOn(console, 'error').mockImplementation(() => {});
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  err.mockRestore();
});

describe('useRecentCompletedAgentBattles — the array its callers read', () => {
  it('an empty array first, then the read\'s list; the default max is 3', async () => {
    await render();
    expect(seen[0]).toEqual([]);
    expect(Array.isArray(last())).toBe(true);
    expect(last().map((b) => b.id)).toEqual(['done_1', 'done_2']);
    expect(env.reads).toEqual([['uid-A', 3]]);
  });

  it('a failed read keeps the list it had — an empty Review, never an error object — and logs it', async () => {
    env.answer = async () => { throw new Error('failed-precondition'); };
    await render(3);
    expect(last()).toEqual([]);
    expect(err).toHaveBeenCalledWith('[useRecentCompletedAgentBattles] fetch failed:', 'failed-precondition');
  });

  it('one read per uid and max: a re-render reads nothing new; a new max reads again', async () => {
    await render(3);
    await render(3);
    expect(env.reads).toEqual([['uid-A', 3]]);
    await render(5);
    expect(env.reads).toEqual([['uid-A', 3], ['uid-A', 5]]);
  });

  it('no signed-in uid: no read, and the empty array', async () => {
    env.auth.currentUser = null;
    await render(3);
    expect(env.reads).toEqual([]);
    expect(last()).toEqual([]);
  });

  it('an answer that lands after unmount sets nothing', async () => {
    let release;
    env.answer = () => new Promise((resolve) => { release = resolve; });
    await render(3);
    act(() => root.unmount());
    const count = seen.length;
    await act(async () => { release([{ id: 'late' }]); });
    expect(seen).toHaveLength(count);
    root = createRoot(host);
  });
});
