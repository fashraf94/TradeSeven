// @vitest-environment jsdom
// src/hooks/useMyBacking.test.jsx
//
// useMyBacking — the viewer's own backing, and (the pre-flip cleanup, Amendment
// C §C1, D-af) the SERVER's names for its pods' teams: `labelsById`, from GET
// /api/backing/team-labels, asked for once per backed-pod set, again when a
// pool settles, in chunks of the route's ceiling — and never anything composed
// from an id on the client.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const svc = vi.hoisted(() => ({
  fetchTeamLabels: null,
  stakes: [],
  pools: {},
  stakeListeners: [],
  poolListeners: {},
}));
vi.mock('../services/backingService', () => ({
  fetchTeamLabels: (...a) => svc.fetchTeamLabels(...a),
  subscribeMyStakes: (_uid, _key, cb) => { svc.stakeListeners.push(cb); cb(svc.stakes); return () => {}; },
  subscribePool: (groupId, cb) => { (svc.poolListeners[groupId] ??= []).push(cb); cb(svc.pools[groupId] ?? null); return () => {}; },
}));
vi.mock('../services/tournamentGroupService', () => ({
  subscribeGroup: (_groupId, cb) => { cb(null); return () => {}; },
}));

const { default: useMyBacking, fetchLabelsFor } = await import('./useMyBacking');
const { TEAM_LABELS_MAX_PODS } = await import('../constants/backing');

let latest = null;
function Probe({ uid, keys }) {
  latest = useMyBacking(uid, keys, true);
  return null;
}
let roots = [];
async function mount(props) {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => { root.render(<Probe {...props} />); });
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  roots.push(root);
}

beforeEach(() => {
  latest = null;
  svc.stakes = [
    { id: 's1', groupId: 'g1', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' },
    { id: 's2', groupId: 'g2', teamOdUserId: 'od-b', amount: 100, status: 'live', weekKey: '2026-W39' },
  ];
  svc.pools = { g1: { status: 'closed' }, g2: { status: 'closed' } };
  svc.stakeListeners = [];
  svc.poolListeners = {};
  svc.fetchTeamLabels = vi.fn(async (ids) => ({ pods: Object.fromEntries(ids.map((g) => [g, { 'od-a': { label: 'Shadow', secondary: 'Mira' } }])) }));
});
afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount());
  roots = [];
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

  it('a failed names read leaves an EMPTY map — the surfaces read the neutral name, never an id', async () => {
    svc.fetchTeamLabels = vi.fn(async () => { throw Object.assign(new Error('nope'), { code: 'server_error' }); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount({ uid: 'viewer-1', keys: ['2026-W39'] });
    expect(latest.labelsById).toEqual({});
    warn.mockRestore();
  });
});
