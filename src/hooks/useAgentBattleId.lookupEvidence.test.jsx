// @vitest-environment jsdom
//
// src/hooks/useAgentBattleId.lookupEvidence.test.jsx
//
// Shadow vs CPU quote integrity — lookup identity (spec
// SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §3.1 C-2, B-4, B-5, B-6, C-4;
// ON-ID rows 1–13 at hook level; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The REAL hook, with Firestore mocked at the module boundary: the mock
// records every onSnapshot call (its arity and its options object, if any)
// and every unsubscribe, and hands the test the listener's callbacks so the
// SDK-observed sequences (companion note, S1–S6) can be replayed.
//
// ON-ID (9), flag-off parity: the legacy fields (agentBattleId, loading,
// error) per commit, the listener count and the subscribe/unsubscribe order
// were captured at the pre-build SHA (SHADOW_OFF_CAPTURE_DIR) and are asserted
// here. The one difference C-2 makes necessary is stated where it occurs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useLayoutEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `lookupHook.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

// ── Firestore at the module boundary ─────────────────────────────────────────
const fsBox = vi.hoisted(() => ({ listeners: [], log: [], extraCalls: [] }));
const authBox = vi.hoisted(() => ({ currentUser: { uid: 'owner-1' } }));
vi.mock('firebase/firestore', () => ({
  collection: (db, name) => ({ kind: 'collection', name }),
  where: (field, op, value) => ({ kind: 'where', field, op, value }),
  limit: (n) => ({ kind: 'limit', n }),
  query: (coll, ...constraints) => ({ kind: 'query', coll, constraints }),
  onSnapshot: (...args) => {
    const id = fsBox.listeners.length;
    const hasOptions = args.length === 4;
    const listener = {
      id,
      arity: args.length,
      query: args[0],
      options: hasOptions ? args[1] : undefined,
      next: hasOptions ? args[2] : args[1],
      error: hasOptions ? args[3] : args[2],
      active: true,
    };
    fsBox.listeners.push(listener);
    fsBox.log.push(['subscribe', id, args.length]);
    return () => { listener.active = false; fsBox.log.push(['unsubscribe', id]); };
  },
  // Anything else the hook might reach for is a contract violation (C-4: no
  // getDocs / getDocsFromServer). Recorded so a row can assert none happened.
  getDocs: (...a) => { fsBox.extraCalls.push(['getDocs', a.length]); return Promise.resolve({ empty: true, docs: [] }); },
  getDocsFromServer: (...a) => { fsBox.extraCalls.push(['getDocsFromServer', a.length]); return Promise.resolve({ empty: true, docs: [] }); },
}));
vi.mock('../firebase/config', () => ({ db: { name: 'db' }, auth: authBox }));

import useAgentBattleId from './useAgentBattleId';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let commits;
beforeEach(() => {
  fsBox.listeners.length = 0;
  fsBox.log.length = 0;
  fsBox.extraCalls.length = 0;
  authBox.currentUser = { uid: 'owner-1' };
  commits = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

/** Records the hook's return on EVERY commit (a layout effect with no deps). */
function Probe({ agentId, options }) {
  const r = useAgentBattleId(agentId, options);
  useLayoutEffect(() => { commits.push(r); });
  return null;
}
const render = (agentId, { options, strict = false } = {}) => act(() => {
  const el = <Probe agentId={agentId} options={options} />;
  root.render(strict ? <StrictMode>{el}</StrictMode> : el);
});

const snap = (ids, { fromCache = false } = {}) => ({
  empty: ids.length === 0,
  docs: ids.map((id) => ({ id })),
  metadata: { fromCache, hasPendingWrites: false },
});
const active = () => fsBox.listeners.filter((l) => l.active);
const current = () => active()[active().length - 1];
const deliver = (s, listener = current()) => act(() => { listener.next(s); });
const fail = (err, listener = current()) => act(() => { listener.error(err); });

const legacy = (r) => ({ agentBattleId: r.agentBattleId, loading: r.loading, error: r.error });
const legacyCommits = () => commits.map(legacy);

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (7 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "abaReturn": {
  "commits": [
   {
    "agentBattleId": null,
    "error": null,
    "loading": true
   },
   {
    "agentBattleId": "battle-1",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-1",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-2",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-2",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-1",
    "error": null,
    "loading": false
   }
  ],
  "listeners": 3,
  "log": [
   [
    "subscribe",
    0,
    3
   ],
   [
    "unsubscribe",
    0
   ],
   [
    "subscribe",
    1,
    3
   ],
   [
    "unsubscribe",
    1
   ],
   [
    "subscribe",
    2,
    3
   ]
  ]
 },
 "errorFirst": {
  "commits": [
   {
    "agentBattleId": null,
    "error": null,
    "loading": true
   },
   {
    "agentBattleId": null,
    "error": "unavailable",
    "loading": false
   },
   {
    "agentBattleId": null,
    "error": "unavailable",
    "loading": false
   },
   {
    "agentBattleId": "battle-9",
    "error": null,
    "loading": false
   }
  ],
  "listeners": 2,
  "log": [
   [
    "subscribe",
    0,
    3
   ],
   [
    "unsubscribe",
    0
   ],
   [
    "subscribe",
    1,
    3
   ]
  ]
 },
 "lifecycle": {
  "commits": [
   {
    "agentBattleId": null,
    "error": null,
    "loading": true
   },
   {
    "agentBattleId": "battle-1",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-1",
    "error": "permission-denied",
    "loading": false
   },
   {
    "agentBattleId": "battle-2",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-2",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-3",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-3",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": null,
    "error": null,
    "loading": false
   }
  ],
  "listeners": 2,
  "log": [
   [
    "subscribe",
    0,
    3
   ],
   [
    "unsubscribe",
    0
   ],
   [
    "subscribe",
    1,
    3
   ],
   [
    "unsubscribe",
    1
   ]
  ]
 },
 "noAuth": {
  "commits": [
   {
    "agentBattleId": null,
    "error": null,
    "loading": true
   },
   {
    "agentBattleId": null,
    "error": null,
    "loading": false
   }
  ],
  "listeners": 0,
  "log": []
 },
 "nullToNull": {
  "commits": [
   {
    "agentBattleId": null,
    "error": null,
    "loading": true
   },
   {
    "agentBattleId": null,
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": null,
    "error": null,
    "loading": false
   }
  ],
  "listeners": 2,
  "log": [
   [
    "subscribe",
    0,
    3
   ],
   [
    "unsubscribe",
    0
   ],
   [
    "subscribe",
    1,
    3
   ]
  ]
 },
 "queryShape": {
  "arity": 3,
  "query": {
   "coll": {
    "kind": "collection",
    "name": "agentBattles"
   },
   "constraints": [
    {
     "field": "agentId",
     "kind": "where",
     "op": "==",
     "value": "agent-A"
    },
    {
     "field": "ownerId",
     "kind": "where",
     "op": "==",
     "value": "owner-1"
    },
    {
     "field": "status",
     "kind": "where",
     "op": "==",
     "value": "active"
    },
    {
     "kind": "limit",
     "n": 1
    }
   ],
   "kind": "query"
  }
 },
 "strictMode": {
  "commits": [
   {
    "agentBattleId": null,
    "error": null,
    "loading": true
   },
   {
    "agentBattleId": null,
    "error": null,
    "loading": true
   },
   {
    "agentBattleId": "battle-1",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-1",
    "error": null,
    "loading": false
   },
   {
    "agentBattleId": "battle-3",
    "error": null,
    "loading": false
   }
  ],
  "listeners": 3,
  "log": [
   [
    "subscribe",
    0,
    3
   ],
   [
    "unsubscribe",
    0
   ],
   [
    "subscribe",
    1,
    3
   ],
   [
    "unsubscribe",
    1
   ],
   [
    "subscribe",
    2,
    3
   ]
  ]
 }
};
// END GENERATED OFF REFERENCES

describe('ON-ID (9) — flag-off parity of the legacy fields, listeners and order', () => {
  it('OFF lifecycle: snapshot → repeated identical snapshot → error keeps the ID → recovery → agent change → no agent', () => {
    render('agent-A');
    deliver(snap(['battle-1']));
    deliver(snap(['battle-1'])); // a doc-data change re-raises the same result
    fail({ message: 'permission-denied', code: 'permission-denied' });
    deliver(snap(['battle-2']));
    render('agent-B');
    deliver(snap(['battle-3']));
    render(null);
    offReference('lifecycle', { commits: legacyCommits(), log: fsBox.log, listeners: fsBox.listeners.length }, OFF.lifecycle);
  });

  it('OFF strictMode: the dev double-effect subscribes, unsubscribes and resubscribes exactly as before', () => {
    render('agent-A', { strict: true });
    deliver(snap(['battle-1']));
    render('agent-B', { strict: true });
    deliver(snap(['battle-3']));
    offReference('strictMode', { commits: legacyCommits(), log: fsBox.log, listeners: fsBox.listeners.length }, OFF.strictMode);
  });

  it('OFF abaReturn: A→B→A ending on the original ID', () => {
    render('agent-A');
    deliver(snap(['battle-1']));
    render('agent-B');
    deliver(snap(['battle-2']));
    render('agent-A');
    deliver(snap(['battle-1']));
    offReference('abaReturn', { commits: legacyCommits(), log: fsBox.log, listeners: fsBox.listeners.length }, OFF.abaReturn);
  });

  it('OFF errorFirst: an error before any snapshot leaves the null ID and no loading re-arm on agent change', () => {
    render('agent-A');
    fail({ message: 'unavailable', code: 'unavailable' });
    render('agent-B');
    deliver(snap(['battle-9']));
    offReference('errorFirst', { commits: legacyCommits(), log: fsBox.log, listeners: fsBox.listeners.length }, OFF.errorFirst);
  });

  it('OFF nullToNull: agent P settles empty, then agent Q settles empty (legacy values never change)', () => {
    render('agent-P');
    deliver(snap([]));
    render('agent-Q');
    deliver(snap([]));
    const actual = { commits: legacyCommits(), log: fsBox.log, listeners: fsBox.listeners.length };
    if (CAPTURE_DIR) { offReference('nullToNull', actual, OFF.nullToNull); return; }
    // THE ONE STATED DIFFERENCE (C-2 + ON-ID row 3): Q's empty result arrives
    // with the legacy values unchanged, so the pre-build hook never committed
    // it. Settling the CURRENT generation needs that commit — exactly one, at
    // the end, with legacy values identical to the commit before it. Listener
    // count and subscribe/unsubscribe order are unchanged.
    const ref = OFF.nullToNull;
    expect(actual.log).toEqual(ref.log);
    expect(actual.listeners).toBe(ref.listeners);
    expect(actual.commits).toEqual([...ref.commits, ref.commits[ref.commits.length - 1]]);
    expect(commits[commits.length - 1].lookup).toMatchObject({ agentId: 'agent-Q', generation: 2, status: 'empty' });
  });

  it('OFF noAuth: no signed-in user runs no query', () => {
    authBox.currentUser = null;
    render('agent-A');
    offReference('noAuth', { commits: legacyCommits(), log: fsBox.log, listeners: fsBox.listeners.length }, OFF.noAuth);
  });

  it('OFF queryShape: the exact query the listener is opened on', () => {
    render('agent-A');
    offReference('queryShape', { query: fsBox.listeners[0].query, arity: fsBox.listeners[0].arity }, OFF.queryShape);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ON-ID rows 1–13 at hook level (C-2, B-4, B-5, B-6, C-4). Rows 10–13 replay
// the SDK-OBSERVED sequences from the companion verification note (pinned
// firebase 12.6.0 / @firebase/firestore 4.9.2 against a local emulator):
//   S2  offline start, server confirms the same empty: default listener gets
//       `empty fromCache:true` and NOTHING after; the metadata listener then
//       gets `empty fromCache:false`.
//   S3/S4  a later non-empty result arrives under both options.
//   S5  confirmed empty, then offline: only the metadata listener gets
//       `empty fromCache:true`.
// ─────────────────────────────────────────────────────────────────────────────

const last = () => commits[commits.length - 1];
const lookups = () => commits.map((r) => r.lookup);

describe('ON-ID — lookup evidence on the existing listener', () => {
  it('(1) A→B→A ending on the original ID: pending until generation 3 settles; generation 1\'s same ID never settles it', () => {
    render('agent-A');
    deliver(snap(['battle-1']));
    expect(last().lookup).toMatchObject({ agentId: 'agent-A', generation: 1, status: 'success', battleId: 'battle-1' });
    const genOneListener = current();
    render('agent-B');
    expect(last().lookup).toMatchObject({ agentId: 'agent-B', generation: 2, status: 'pending', battleId: null });
    render('agent-A');
    expect(last().lookup).toMatchObject({ agentId: 'agent-A', generation: 3, status: 'pending' });
    // The legacy field still says battle-1 — the very thing C-2 refuses to trust.
    expect(last().agentBattleId).toBe('battle-1');
    // A queued callback from the generation-1 listener carries the same ID: ignored.
    act(() => { genOneListener.next(snap(['battle-1'])); });
    expect(last().lookup).toMatchObject({ generation: 3, status: 'pending' });
    deliver(snap(['battle-1']));
    expect(last().lookup).toMatchObject({ agentId: 'agent-A', generation: 3, status: 'success', battleId: 'battle-1' });
  });

  it('(2) an unchanged successful result stays settled: no pending flash, no resubscribe', () => {
    render('agent-A');
    deliver(snap(['battle-1']));
    const before = commits.length;
    deliver(snap(['battle-1']));
    deliver(snap(['battle-1']));
    expect(commits.length).toBe(before);
    expect(lookups().slice(1).every((l) => l.status !== 'pending')).toBe(true);
    expect(fsBox.log).toEqual([['subscribe', 0, 3]]);
  });

  it('(3) null→null: pending until Q\'s OWN empty arrives — never settled from P\'s evidence', () => {
    render('agent-P');
    deliver(snap([]));
    expect(last().lookup).toMatchObject({ agentId: 'agent-P', status: 'empty' });
    render('agent-Q');
    expect(last().lookup).toMatchObject({ agentId: 'agent-Q', generation: 2, status: 'pending' });
    deliver(snap([]));
    expect(last().lookup).toMatchObject({ agentId: 'agent-Q', generation: 2, status: 'empty', battleId: null, fromCache: false });
  });

  it('(4) late success, empty or error from a retired generation — including one queued before unsubscribe — is ignored', () => {
    render('agent-A');
    const retired = current();
    render('agent-B');
    for (const late of [() => retired.next(snap(['battle-9'])), () => retired.next(snap([])), () => retired.error({ message: 'boom', code: 'internal' })]) {
      act(late);
      expect(last().lookup).toMatchObject({ agentId: 'agent-B', generation: 2, status: 'pending', error: null, battleId: null });
    }
  });

  it('(5) error identity: the current generation\'s error, never a retired one\'s', () => {
    render('agent-A');
    fail({ message: 'permission-denied', code: 'permission-denied' });
    expect(last().lookup).toMatchObject({ status: 'error', error: { code: 'permission-denied', message: 'permission-denied' } });
    render('agent-B');
    expect(last().lookup.status).toBe('pending');
    expect(last().lookup.error).toBeNull();
    // …while the legacy field still carries A's error (no re-arm, by design).
    expect(last().error).toBe('permission-denied');
    fail({ message: 'unavailable', code: 'unavailable' });
    expect(last().lookup.error).toEqual({ code: 'unavailable', message: 'unavailable' });
  });

  it('(6) [B-4] no auth → error { code: "no-auth" } (never empty); no agent → idle', () => {
    authBox.currentUser = null;
    render('agent-A');
    expect(last().lookup).toMatchObject({ status: 'error', error: { code: 'no-auth' }, battleId: null });
    expect(fsBox.listeners).toHaveLength(0);
    authBox.currentUser = { uid: 'owner-1' };
    render(null);
    expect(last().lookup).toMatchObject({ agentId: null, status: 'idle' });
  });

  it('(7) direct-ID route: the screen calls the hook with null → idle, no listener', () => {
    render(null);
    expect(last().lookup).toMatchObject({ status: 'idle', agentId: null });
    expect(fsBox.listeners).toHaveLength(0);
  });

  it('(9) StrictMode: one agent change advances the generation by exactly one', () => {
    render('agent-A', { strict: true });
    deliver(snap(['battle-1']));
    render('agent-B', { strict: true });
    expect(last().lookup.generation).toBe(2);
    deliver(snap(['battle-2']));
    expect(last().lookup).toMatchObject({ generation: 2, status: 'success', battleId: 'battle-2' });
  });

  it('(9) [B-6] an agent change adds a render pass but no commit, effect or subscription change', () => {
    let passes = 0;
    function Counting({ agentId }) {
      passes += 1;
      const r = useAgentBattleId(agentId);
      useLayoutEffect(() => { commits.push(r); });
      return null;
    }
    act(() => { root.render(<Counting agentId="agent-A" />); });
    const passesBefore = passes;
    const commitsBefore = commits.length;
    act(() => { root.render(<Counting agentId="agent-B" />); });
    expect(commits.length - commitsBefore).toBe(1); // the parent's own prop commit only
    expect(passes - passesBefore).toBe(2); // + the render-time adjustment pass
    expect(fsBox.log).toEqual([['subscribe', 0, 3], ['unsubscribe', 0], ['subscribe', 1, 3]]);
  });

  it('(10) [B-5/C-4] S2: empty fromCache:true → unconfirmed-empty → empty fromCache:false (metadata event) → confirmed empty', () => {
    render('agent-A', { options: { confirmCache: true } });
    deliver(snap([], { fromCache: true }));
    expect(last().lookup).toMatchObject({ status: 'error', error: { code: 'unconfirmed-empty' }, fromCache: true });
    deliver(snap([], { fromCache: false }));
    expect(last().lookup).toMatchObject({ status: 'empty', battleId: null, fromCache: false, error: null });
  });

  it('(11) S3/S4: empty fromCache:true → non-empty fromCache:false → success', () => {
    render('agent-A', { options: { confirmCache: true } });
    deliver(snap([], { fromCache: true }));
    deliver(snap(['battle-7'], { fromCache: false }));
    expect(last().lookup).toMatchObject({ status: 'success', battleId: 'battle-7', fromCache: false });
  });

  it('(12) S5: a confirmed empty is STICKY — a later fromCache:true metadata event does not downgrade it', () => {
    render('agent-A', { options: { confirmCache: true } });
    deliver(snap([], { fromCache: false }));
    const before = commits.length;
    deliver(snap([], { fromCache: true }));
    expect(last().lookup).toMatchObject({ status: 'empty', fromCache: false });
    expect(commits.length).toBe(before); // identical evidence: no render forced
    // Only a non-empty snapshot, an error, or a new generation changes it.
    deliver(snap(['battle-8'], { fromCache: true }));
    expect(last().lookup).toMatchObject({ status: 'success', battleId: 'battle-8', fromCache: true });
  });

  it('success is never downgraded by fromCache; a later empty-from-cache after success is unconfirmed (not sticky)', () => {
    render('agent-A', { options: { confirmCache: true } });
    deliver(snap(['battle-1'], { fromCache: true }));
    expect(last().lookup).toMatchObject({ status: 'success', fromCache: true });
    deliver(snap([], { fromCache: true }));
    expect(last().lookup).toMatchObject({ status: 'error', error: { code: 'unconfirmed-empty' } });
  });

  it('the sticky rule is per generation: a new agent\'s unconfirmed empty is unconfirmed', () => {
    render('agent-A', { options: { confirmCache: true } });
    deliver(snap([], { fromCache: false }));
    render('agent-B', { options: { confirmCache: true } });
    deliver(snap([], { fromCache: true }));
    expect(last().lookup).toMatchObject({ agentId: 'agent-B', status: 'error', error: { code: 'unconfirmed-empty' } });
  });

  it('(13) listener shape: flag on → onSnapshot(q, { includeMetadataChanges: true }, next, error); off → onSnapshot(q, next, error)', () => {
    render('agent-A', { options: { confirmCache: true } });
    expect(fsBox.listeners[0].arity).toBe(4);
    expect(fsBox.listeners[0].options).toEqual({ includeMetadataChanges: true });
    act(() => root.unmount());
    root = createRoot(container);
    fsBox.listeners.length = 0;
    for (const options of [undefined, {}, { confirmCache: false }, { confirmCache: 'yes' }]) {
      render(`agent-${JSON.stringify(options)}`, { options });
    }
    expect(fsBox.listeners.map((l) => [l.arity, l.options])).toEqual([[3, undefined], [3, undefined], [3, undefined], [3, undefined]]);
    // Never a second listener, getDocs, getDocsFromServer or timer.
    expect(fsBox.extraCalls).toEqual([]);
  });

  it('(13) one listener per generation and no timers, with metadata events on', () => {
    vi.useFakeTimers();
    try {
      render('agent-A', { options: { confirmCache: true } });
      deliver(snap([], { fromCache: true }));
      expect(vi.getTimerCount()).toBe(0);
      expect(active()).toHaveLength(1);
      expect(fsBox.extraCalls).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('metadata-only events with the flag on re-run the legacy setters with identical values', () => {
    render('agent-A', { options: { confirmCache: true } });
    deliver(snap(['battle-1'], { fromCache: false }));
    const before = commits.length;
    deliver(snap(['battle-1'], { fromCache: false })); // a metadata-only re-raise
    expect(commits.length).toBe(before);
    expect(legacy(last())).toEqual({ agentBattleId: 'battle-1', loading: false, error: null });
  });
});
