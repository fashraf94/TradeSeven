// @vitest-environment jsdom
//
// src/hooks/useCockpitRecords.jsdom.test.jsx
//
// Cockpit Build 2a — THE CLIENT READERS (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §4): each reader gates INSIDE its effect,
// opens nothing while off, orders by ONE field (no composite index), tears its
// listener down, returns null while off; C-5 at the boundary (only records
// minted under 'on'); the declarations record's list leaves as `symbols`
// whichever source C-1 filled it from; one getDoc for an observation.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const fs = vi.hoisted(() => {
  const state = { listeners: [], docs: {}, gets: [], unsubs: 0 };
  return {
    state,
    collection: vi.fn((db, ...path) => ({ path: path.join('/') })),
    query: vi.fn((ref, ...cs) => ({ path: ref.path, constraints: cs })),
    orderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
    limit: vi.fn((n) => ({ type: 'limit', n })),
    onSnapshot: vi.fn((q, next, error) => {
      const entry = { q, next, error };
      state.listeners.push(entry);
      const docs = state.docs[q.path];
      if (docs) next({ docs: docs.map((d) => ({ id: d.id, data: () => ({ ...d }) })) });
      return () => { state.unsubs += 1; };
    }),
    doc: vi.fn((db, ...path) => ({ path: path.join('/') })),
    getDoc: vi.fn(async (ref) => {
      state.gets.push(ref.path);
      const data = state.docs[ref.path];
      return { exists: () => Boolean(data), data: () => data };
    }),
  };
});
vi.mock('firebase/firestore', () => ({
  collection: fs.collection, query: fs.query, orderBy: fs.orderBy, limit: fs.limit,
  onSnapshot: fs.onSnapshot, doc: fs.doc, getDoc: fs.getDoc,
}));
vi.mock('../firebase/config', () => ({ db: { name: 'db' } }));

import { useCalls, useMonitoring, useCallEvents, useCallObservation, CALLS_LIMIT, CALL_EVENTS_LIMIT } from './useCockpitRecords';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let out;
function Probe({ battleId, enabled, callId = null, observe = false }) {
  out = {
    calls: useCalls(battleId, enabled),
    monitoring: useMonitoring(battleId, enabled),
    events: useCallEvents(battleId, enabled),
    observation: useCallObservation(battleId, callId, observe),
  };
  return null;
}
// The readers import firebase lazily (a dynamic import resolves on the module
// loader, not in a microtask), so settling waits real turns of the loop.
const settle = async () => { for (let i = 0; i < 10; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const render = async (props) => { await act(async () => { root.render(<Probe {...props} />); }); await settle(); };

beforeEach(() => {
  fs.state.listeners = [];
  fs.state.docs = {};
  fs.state.gets = [];
  fs.state.unsubs = 0;
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  out = null;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('off — no listener, no read, null out', () => {
  it('disabled: nothing is opened and every reader returns null', async () => {
    await render({ battleId: 'ab-1', enabled: false, callId: 'c1', observe: false });
    expect(fs.onSnapshot).not.toHaveBeenCalled();
    expect(fs.getDoc).not.toHaveBeenCalled();
    expect(out).toEqual({ calls: null, monitoring: null, events: null, observation: null });
  });
});

describe('on — one field ordered, limited, live; C-5 at the boundary', () => {
  it('calls: orderBy(mintedAt, desc), limit(60); only mintedMode === "on" leaves the reader', async () => {
    fs.state.docs['agentBattles/ab-1/calls'] = [
      { id: 'c1', callId: 'c1', mintedMode: 'on' },
      { id: 'c2', callId: 'c2', mintedMode: 'shadow' },
      { id: 'c3', callId: 'c3' },
    ];
    await render({ battleId: 'ab-1', enabled: true });
    const callsQuery = fs.state.listeners.find((l) => l.q.path === 'agentBattles/ab-1/calls').q;
    expect(callsQuery.constraints).toEqual([{ type: 'orderBy', field: 'mintedAt', dir: 'desc' }, { type: 'limit', n: CALLS_LIMIT }]);
    expect(CALLS_LIMIT).toBe(60);
    expect(out.calls.map((c) => c.callId)).toEqual(['c1']);
  });

  it('callEvents: orderBy(at, desc), limit(150), every event kept (the model groups them)', async () => {
    fs.state.docs['agentBattles/ab-1/callEvents'] = [{ id: 'e1', kind: 'heard', callIds: ['c1'] }];
    await render({ battleId: 'ab-1', enabled: true });
    const q = fs.state.listeners.find((l) => l.q.path === 'agentBattles/ab-1/callEvents').q;
    expect(q.constraints).toEqual([{ type: 'orderBy', field: 'at', dir: 'desc' }, { type: 'limit', n: CALL_EVENTS_LIMIT }]);
    expect(CALL_EVENTS_LIMIT).toBe(150);
    expect(out.events).toEqual([{ id: 'e1', kind: 'heard', callIds: ['c1'] }]);
  });

  it('every query orders by exactly one field (no composite index)', async () => {
    await render({ battleId: 'ab-1', enabled: true });
    expect(fs.state.listeners).toHaveLength(3);
    for (const { q } of fs.state.listeners) expect(q.constraints.filter((c) => c.type === 'orderBy')).toHaveLength(1);
  });

  it('teardown unsubscribes every listener; turning off returns null', async () => {
    fs.state.docs['agentBattles/ab-1/calls'] = [{ id: 'c1', callId: 'c1', mintedMode: 'on' }];
    await render({ battleId: 'ab-1', enabled: true });
    expect(out.calls).toHaveLength(1);
    await render({ battleId: 'ab-1', enabled: false });
    expect(fs.state.unsubs).toBe(3);
    expect(out.calls).toBeNull();
  });

  it('a listener error reads as nothing — never a guess', async () => {
    await render({ battleId: 'ab-1', enabled: true });
    const callsListener = fs.state.listeners.find((l) => l.q.path === 'agentBattles/ab-1/calls');
    await act(async () => { callsListener.next({ docs: [{ id: 'c1', data: () => ({ callId: 'c1', mintedMode: 'on' }) }] }); });
    expect(out.calls).toHaveLength(1);
    await act(async () => { callsListener.error(new Error('permission-denied')); });
    expect(out.calls).toBeNull();
  });
});

describe('Monitoring — the newest declarations record, from either source (C-1)', () => {
  it('orderBy(evalSeq, desc), limit(1); the list leaves as `symbols` when the block filled it', async () => {
    fs.state.docs['agentBattles/ab-1/declarations'] = [{ id: 'd1', evalId: 'eval_011', mintedAt: 5, mintedMode: 'on', watching: ['AMD', 'JPM'], watchingSource: 'block' }];
    await render({ battleId: 'ab-1', enabled: true });
    const q = fs.state.listeners.find((l) => l.q.path === 'agentBattles/ab-1/declarations').q;
    expect(q.constraints).toEqual([{ type: 'orderBy', field: 'evalSeq', dir: 'desc' }, { type: 'limit', n: 1 }]);
    expect(out.monitoring).toEqual({ symbols: ['AMD', 'JPM'], evalId: 'eval_011', mintedAt: 5 });
  });

  it('…and the same when the top-level field filled it', async () => {
    fs.state.docs['agentBattles/ab-1/declarations'] = [{ id: 'd2', evalId: 'eval_012', mintedAt: 6, mintedMode: 'on', watching: ['NVDA'], watchingSource: 'top_level' }];
    await render({ battleId: 'ab-1', enabled: true });
    expect(out.monitoring).toEqual({ symbols: ['NVDA'], evalId: 'eval_012', mintedAt: 6 });
  });

  it('the record\'s own field name never leaves the reader; a record minted at shadow or before the amendment → null', async () => {
    fs.state.docs['agentBattles/ab-1/declarations'] = [{ id: 'd3', evalId: 'eval_013', mintedMode: 'shadow', watching: ['NVDA'] }];
    await render({ battleId: 'ab-1', enabled: true });
    expect(out.monitoring).toBeNull();
    fs.state.docs['agentBattles/ab-2/declarations'] = [{ id: 'd4', evalId: 'eval_013', watching: ['NVDA'] }];
    await render({ battleId: 'ab-2', enabled: true });
    expect(out.monitoring).toBeNull();
    fs.state.docs['agentBattles/ab-3/declarations'] = [{ id: 'd5', evalId: 'eval_013', mintedMode: 'on', watching: ['NVDA', '', 7] }];
    await render({ battleId: 'ab-3', enabled: true });
    expect(Object.keys(out.monitoring)).toEqual(['symbols', 'evalId', 'mintedAt']);
    expect(out.monitoring.symbols).toEqual(['NVDA']);
  });
});

describe('the observation — ONE get, only when asked', () => {
  it('reads callObservations/{callId} once when enabled; nothing otherwise', async () => {
    fs.state.docs['agentBattles/ab-1/callObservations/c1'] = { px: 609.8, observedAtMs: 1 };
    await render({ battleId: 'ab-1', enabled: true, callId: 'c1', observe: false });
    expect(fs.getDoc).not.toHaveBeenCalled();
    await render({ battleId: 'ab-1', enabled: true, callId: 'c1', observe: true });
    expect(fs.state.gets).toEqual(['agentBattles/ab-1/callObservations/c1']);
    expect(out.observation).toEqual({ px: 609.8, observedAtMs: 1 });
    expect(fs.onSnapshot.mock.calls.some(([q]) => String(q.path).includes('callObservations'))).toBe(false);
  });
  it('a missing document → null', async () => {
    await render({ battleId: 'ab-1', enabled: true, callId: 'c9', observe: true });
    expect(out.observation).toBeNull();
  });
});
