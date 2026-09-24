// @vitest-environment jsdom
// src/hooks/useMyBacking.test.jsx
//
// useMyBacking — the viewer's own backing, and (the pre-flip cleanup, Amendment
// C §C1, D-af) the SERVER's names for its pods' teams: `labelsById`, from GET
// /api/backing/team-labels — asked for ONCE every backed pod's snapshots have
// landed, again when a pod's team set moves or its pool settles, in chunks of
// the route's ceiling, retried once, never cleared by a failure — and never
// anything composed from an id on the client (this build's review record,
// WIRING-4/5/6/8, WIRING-R-1).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// React's act() warns unless the environment says it supports it.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const svc = vi.hoisted(() => ({
  fetchTeamLabels: null,
  stakes: [],
  pools: {},
  groups: {},
  deferPools: false,
  stakeListeners: [],
  poolListeners: {},
  groupListeners: {},
}));
vi.mock('../services/backingService', () => ({
  fetchTeamLabels: (...a) => svc.fetchTeamLabels(...a),
  subscribeMyStakes: (_uid, key, cb) => { svc.stakeListeners.push({ key, cb }); cb(svc.stakes.filter((s) => s.weekKey === key)); return () => {}; },
  subscribePool: (groupId, cb) => { (svc.poolListeners[groupId] ??= []).push(cb); if (!svc.deferPools) cb(svc.pools[groupId] ?? null); return () => {}; },
}));
vi.mock('../services/tournamentGroupService', () => ({
  subscribeGroup: (groupId, cb) => { (svc.groupListeners[groupId] ??= []).push(cb); cb(svc.groups[groupId] ?? null); return () => {}; },
}));

const { default: useMyBacking, fetchLabelsFor, LABELS_RETRY_MS } = await import('./useMyBacking');
const { TEAM_LABELS_MAX_PODS } = await import('../constants/backing');

let latest = null;
function Probe({ uid, keys }) {
  latest = useMyBacking(uid, keys, true);
  return null;
}
let roots = [];
async function flush() { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); }
async function mount(props) {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => { root.render(<Probe {...props} />); });
  await flush();
  roots.push(root);
  return root;
}
const emit = async (listeners, value) => { await act(async () => { for (const cb of listeners) cb(value); }); await flush(); };

beforeEach(() => {
  latest = null;
  svc.stakes = [
    { id: 's1', groupId: 'g1', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' },
    { id: 's2', groupId: 'g2', teamOdUserId: 'od-b', amount: 100, status: 'live', weekKey: '2026-W39' },
  ];
  svc.pools = { g1: { status: 'closed' }, g2: { status: 'closed' } };
  svc.groups = {};
  svc.deferPools = false;
  svc.stakeListeners = [];
  svc.poolListeners = {};
  svc.groupListeners = {};
  svc.fetchTeamLabels = vi.fn(async (ids) => ({ pods: Object.fromEntries(ids.map((g) => [g, { 'od-a': { label: 'Shadow', secondary: 'Mira' } }])) }));
});
afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount());
  roots = [];
  vi.useRealTimers();
});

describe('fetchLabelsFor — the server\'s names, in requests the route admits', () => {
  it('chunks a set larger than the route\'s ceiling and merges the answers', async () => {
    const ids = Array.from({ length: TEAM_LABELS_MAX_PODS + 3 }, (_, i) => `g${String(i).padStart(2, '0')}`);
    const pods = await fetchLabelsFor([...ids, ids[0]]);
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);
    for (const [chunk] of svc.fetchTeamLabels.mock.calls) expect(chunk.length).toBeLessThanOrEqual(TEAM_LABELS_MAX_PODS);
    expect(Object.keys(pods)).toHaveLength(ids.length);
  });

  it('asks for nothing when there is nothing to name', async () => {
    expect(await fetchLabelsFor([])).toEqual({});
    expect(svc.fetchTeamLabels).not.toHaveBeenCalled();
  });
});

describe('the hook\'s labelsById (D-af)', () => {
  it('asks ONCE for the backed pods, and hands the surfaces the server\'s names', async () => {
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(1);
    expect(svc.fetchTeamLabels.mock.calls[0][0]).toEqual(['g1', 'g2']);
    expect(latest.labelsById.g1['od-a']).toEqual({ label: 'Shadow', secondary: 'Mira' });
  });

  it('asks AGAIN when a pool settles — a settled team is named by the agent settlement recorded', async () => {
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(1);
    await act(async () => { for (const cb of svc.poolListeners.g1) cb({ status: 'resolved' }); });
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);
    // …and a pool snapshot that settles nothing asks nothing.
    await act(async () => { for (const cb of svc.poolListeners.g2) cb({ status: 'closed', updatedAt: 'x' }); });
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);
  });

  it('a names read that fails TWICE (the one retry) answers every pod EMPTY — the surfaces read the neutral name, never an id, never "pending" for ever', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    svc.fetchTeamLabels = vi.fn(async () => { throw Object.assign(new Error('nope'), { code: 'server_error' }); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(1);
    expect(latest.labelsById).toEqual({});                                  // pending while the retry waits
    await act(async () => { vi.advanceTimersByTime(LABELS_RETRY_MS); });
    await flush();
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);
    expect(latest.labelsById).toEqual({ g1: {}, g2: {} });
    warn.mockRestore();
  });
});

describe('the names\' lifecycle — this build\'s review record (WIRING-4/5/6/8, WIRING-R-1)', () => {
  const settle = () => ({ status: 'resolved' });

  it('WIRING-5: a failed read is RETRIED once — a cold start or a blip is not "no names"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const ok = svc.fetchTeamLabels;
    svc.fetchTeamLabels = vi.fn().mockRejectedValueOnce(new Error('blip')).mockImplementation(ok);
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    await act(async () => { vi.advanceTimersByTime(LABELS_RETRY_MS); });
    await flush();
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);
    expect(latest.labelsById.g1['od-a']).toEqual({ label: 'Shadow', secondary: 'Mira' });
  });

  it('WIRING-R-1: a FAILED re-read keeps the names already on screen — a failure is not "no name"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(latest.labelsById.g1['od-a'].label).toBe('Shadow');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    svc.fetchTeamLabels = vi.fn(async () => { throw new Error('down'); });
    await emit(svc.poolListeners.g1, settle());                               // re-asked: the pool settled
    await act(async () => { vi.advanceTimersByTime(LABELS_RETRY_MS); });
    await flush();
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);                     // the re-read and its retry, both failed
    expect(latest.labelsById.g1['od-a']).toEqual({ label: 'Shadow', secondary: 'Mira' });
    warn.mockRestore();
  });

  it('WIRING-6: ONE request at mount — the names wait until every backed pod\'s snapshots have landed, however they trickle in', async () => {
    svc.deferPools = true;
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(svc.fetchTeamLabels).not.toHaveBeenCalled();                      // no pool snapshot yet
    await emit(svc.poolListeners.g1, settle());
    expect(svc.fetchTeamLabels).not.toHaveBeenCalled();                      // g2's has not landed
    await emit(svc.poolListeners.g2, settle());
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(1);
  });

  it('WIRING-4: a backed pod\'s SEATS change (a seat joins, CPUs added at fire) → the names are asked again; a snapshot that moves no seat asks nothing', async () => {
    svc.groups = { g1: { players: [{ odUserId: 'od-a' }] } };
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(1);
    await emit(svc.groupListeners.g1, { players: [{ odUserId: 'od-a' }, { odUserId: 'od-c' }, { odUserId: 'cpu-3', isCpu: true }] });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);
    await emit(svc.groupListeners.g1, { players: [{ odUserId: 'od-a' }, { odUserId: 'od-c' }, { odUserId: 'cpu-3', isCpu: true }], updatedAt: 'x' });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(2);
  });

  it('WIRING-8: a reply that lands AFTER its request was superseded is dropped — the newer names stand', async () => {
    const replies = [];
    svc.fetchTeamLabels = vi.fn(() => new Promise((resolve) => { replies.push(resolve); }));
    const reply = (tag) => ({ pods: { g1: { 'od-a': { label: tag, secondary: null } }, g2: {} } });
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    await emit(svc.poolListeners.g1, settle());                               // a second request supersedes the first
    expect(replies).toHaveLength(2);
    await act(async () => { replies[1](reply('newer')); });
    await flush();
    await act(async () => { replies[0](reply('older')); });                   // the superseded reply lands late
    await flush();
    expect(latest.labelsById.g1['od-a'].label).toBe('newer');
  });

  it('a week key ADDED (the pod list lands) prunes rather than resets — the backed pods and their names stay, nothing is re-asked', async () => {
    const root = await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(1);
    await act(async () => { root.render(<Probe uid="viewer-1" keys={['2026-W39', '2026-W40']} />); });
    await flush();
    expect(latest.labelsById.g1['od-a'].label).toBe('Shadow');
    expect(svc.fetchTeamLabels).toHaveBeenCalledTimes(1);
  });
});
