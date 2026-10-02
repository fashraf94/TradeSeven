// @vitest-environment jsdom
//
// src/hooks/useAgentBattle.quoteSnapshot.test.jsx
//
// Shadow vs CPU quote integrity — the atomic snapshot envelope (spec
// SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §3.2; ON-F4b; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The REAL hook with Firestore mocked at the module boundary. The envelope is
// optional evidence from the EXISTING single subscription, enabled only by
// the gate's option; without it the hook's return shape, values, effects and
// listener calls are exactly the pre-build ones (references captured at the
// pre-build SHA with SHADOW_OFF_CAPTURE_DIR).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useLayoutEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `battleHook.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

const fsBox = vi.hoisted(() => ({ listeners: [], log: [] }));
vi.mock('firebase/firestore', () => ({
  doc: (db, coll, id) => ({ kind: 'doc', coll, id }),
  onSnapshot: (...args) => {
    const id = fsBox.listeners.length;
    const listener = { id, arity: args.length, ref: args[0], next: args[1], error: args[2], active: true };
    fsBox.listeners.push(listener);
    fsBox.log.push(['subscribe', id, args.length, args[0]?.id ?? null]);
    return () => { listener.active = false; fsBox.log.push(['unsubscribe', id]); };
  },
}));
vi.mock('../firebase/config', () => ({ db: { name: 'db' } }));

import useAgentBattle from './useAgentBattle';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let commits;
beforeEach(() => {
  fsBox.listeners.length = 0;
  fsBox.log.length = 0;
  commits = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
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

function Probe({ battleId, options }) {
  const r = useAgentBattle(battleId, options);
  useLayoutEffect(() => { commits.push(r); });
  return null;
}
const render = (battleId, { options, strict = false } = {}) => act(() => {
  const el = <Probe battleId={battleId} options={options} />;
  root.render(strict ? <StrictMode>{el}</StrictMode> : el);
});
const docSnap = (id, data) => ({ id, exists: () => data !== null, data: () => (data === null ? undefined : JSON.parse(JSON.stringify(data))) });
const active = () => fsBox.listeners.filter((l) => l.active);
const current = () => active()[active().length - 1];
const deliver = (s, listener = current()) => act(() => { listener.next(s); });
const fail = (err, listener = current()) => act(() => { listener.error(err); });

/** The legacy return, exactly the keys the hook returned before the build. */
const LEGACY_KEYS = ['battle', 'statusFeed', 'executionMode', 'pendingProposal', 'strategyPreset', 'gameplanMeeting', 'chatExchanges', 'chatBudgetUsed', 'feedBookmarks', 'loading', 'error'];
const legacyView = (r) => ({
  keys: Object.keys(r),
  values: Object.fromEntries(LEGACY_KEYS.map((k) => [k, r[k] === undefined ? '__undefined__' : r[k]])),
});

const DOC_A = { gameMode: 'baggerbomb_agent', status: 'active', statusFeed: [{ action: 'hold' }], chatExchanges: [], opponent: { odUserId: 'cpu' } };
const DOC_B = { gameMode: 'baggerbomb_agent', status: 'active', executionMode: 'autopilot', chatBudgetUsed: 2 };

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (3 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "idField": [
  {
   "keys": [
    "battle",
    "statusFeed",
    "executionMode",
    "pendingProposal",
    "strategyPreset",
    "gameplanMeeting",
    "chatExchanges",
    "chatBudgetUsed",
    "feedBookmarks",
    "loading",
    "error"
   ],
   "values": {
    "battle": {
     "chatExchanges": [],
     "gameMode": "baggerbomb_agent",
     "id": "spoofed",
     "opponent": {
      "odUserId": "cpu"
     },
     "status": "active",
     "statusFeed": [
      {
       "action": "hold"
      }
     ]
    },
    "chatBudgetUsed": 0,
    "chatExchanges": [],
    "error": null,
    "executionMode": "copilot",
    "feedBookmarks": [],
    "gameplanMeeting": null,
    "loading": false,
    "pendingProposal": null,
    "statusFeed": [
     {
      "action": "hold"
     }
    ],
    "strategyPreset": "balanced"
   }
  }
 ],
 "lifecycle": {
  "commits": [
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": null,
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": true,
     "pendingProposal": null,
     "statusFeed": [],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": null,
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": "permission-denied",
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": "permission-denied",
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": "permission-denied",
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": true,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatBudgetUsed": 2,
      "executionMode": "autopilot",
      "gameMode": "baggerbomb_agent",
      "id": "battle-B",
      "status": "active"
     },
     "chatBudgetUsed": 2,
     "chatExchanges": [],
     "error": null,
     "executionMode": "autopilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatBudgetUsed": 2,
      "executionMode": "autopilot",
      "gameMode": "baggerbomb_agent",
      "id": "battle-B",
      "status": "active"
     },
     "chatBudgetUsed": 2,
     "chatExchanges": [],
     "error": null,
     "executionMode": "autopilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": null,
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [],
     "strategyPreset": "balanced"
    }
   }
  ],
  "listeners": 2,
  "log": [
   [
    "subscribe",
    0,
    3,
    "battle-A"
   ],
   [
    "unsubscribe",
    0
   ],
   [
    "subscribe",
    1,
    3,
    "battle-B"
   ],
   [
    "unsubscribe",
    1
   ]
  ]
 },
 "strictMode": {
  "commits": [
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": null,
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": true,
     "pendingProposal": null,
     "statusFeed": [],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": null,
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": true,
     "pendingProposal": null,
     "statusFeed": [],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": false,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   },
   {
    "keys": [
     "battle",
     "statusFeed",
     "executionMode",
     "pendingProposal",
     "strategyPreset",
     "gameplanMeeting",
     "chatExchanges",
     "chatBudgetUsed",
     "feedBookmarks",
     "loading",
     "error"
    ],
    "values": {
     "battle": {
      "chatExchanges": [],
      "gameMode": "baggerbomb_agent",
      "id": "battle-A",
      "opponent": {
       "odUserId": "cpu"
      },
      "status": "active",
      "statusFeed": [
       {
        "action": "hold"
       }
      ]
     },
     "chatBudgetUsed": 0,
     "chatExchanges": [],
     "error": null,
     "executionMode": "copilot",
     "feedBookmarks": [],
     "gameplanMeeting": null,
     "loading": true,
     "pendingProposal": null,
     "statusFeed": [
      {
       "action": "hold"
      }
     ],
     "strategyPreset": "balanced"
    }
   }
  ],
  "log": [
   [
    "subscribe",
    0,
    3,
    "battle-A"
   ],
   [
    "unsubscribe",
    0
   ],
   [
    "subscribe",
    1,
    3,
    "battle-A"
   ],
   [
    "unsubscribe",
    1
   ],
   [
    "subscribe",
    2,
    3,
    "battle-B"
   ]
  ]
 }
};
// END GENERATED OFF REFERENCES

describe('OFF — flag-off parity of the legacy return, effects and listener', () => {
  it('OFF lifecycle: ready → missing → error keeps the prior battle → recovery → id change → null', () => {
    render('battle-A');
    deliver(docSnap('battle-A', DOC_A));
    deliver(docSnap('battle-A', null));
    deliver(docSnap('battle-A', DOC_A));
    fail({ message: 'permission-denied', code: 'permission-denied' });
    render('battle-B');
    deliver(docSnap('battle-B', DOC_B));
    render(null);
    offReference('lifecycle', { commits: commits.map(legacyView), log: fsBox.log, listeners: fsBox.listeners.length }, OFF.lifecycle);
  });

  it('OFF idField: a data field named `id` overrides the document id in the legacy object (unchanged)', () => {
    render('battle-A');
    deliver(docSnap('battle-A', { ...DOC_A, id: 'spoofed' }));
    offReference('idField', commits.map(legacyView).slice(-1), OFF.idField);
  });

  it('OFF strictMode: listener subscribe/unsubscribe order under the dev double effect', () => {
    render('battle-A', { strict: true });
    deliver(docSnap('battle-A', DOC_A));
    render('battle-B', { strict: true });
    offReference('strictMode', { commits: commits.map(legacyView), log: fsBox.log }, OFF.strictMode);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ON — the envelope, enabled only by the gate's option (§3.2, ON-F4b).
// ─────────────────────────────────────────────────────────────────────────────

const ON = { integrity: true };
const env = () => commits[commits.length - 1].integrity;

describe('ON — the atomic envelope from the existing subscription', () => {
  it('carries the authoritative snapshot.id separately from data — a data field `id` cannot spoof it', () => {
    render('battle-A', { options: ON });
    deliver(docSnap('battle-A', { ...DOC_A, id: 'spoofed' }));
    expect(env()).toMatchObject({ requestedId: 'battle-A', generation: 1, status: 'ready', snapshotId: 'battle-A', error: null });
    expect(env().data.id).toBe('spoofed');
    expect(env().data.gameMode).toBe('baggerbomb_agent');
    // The legacy object keeps its legacy (spoofable) shape, unchanged.
    expect(commits[commits.length - 1].battle.id).toBe('spoofed');
  });

  it('A→B: pending with NO data until B\'s own snapshot — never B\'s id with A\'s data — while legacy still shows A', () => {
    render('battle-A', { options: ON });
    deliver(docSnap('battle-A', DOC_A));
    const retired = current();
    render('battle-B', { options: ON });
    expect(env()).toMatchObject({ requestedId: 'battle-B', generation: 2, status: 'pending', snapshotId: null, data: null });
    expect(commits[commits.length - 1].battle.id).toBe('battle-A'); // the legacy hazard, kept
    act(() => { retired.next(docSnap('battle-A', { ...DOC_A, status: 'completed' })); });
    act(() => { retired.error({ message: 'late', code: 'internal' }); });
    expect(env()).toMatchObject({ requestedId: 'battle-B', status: 'pending', data: null, error: null });
    deliver(docSnap('battle-B', DOC_B));
    expect(env()).toMatchObject({ requestedId: 'battle-B', generation: 2, status: 'ready', snapshotId: 'battle-B' });
    expect(env().data.executionMode).toBe('autopilot');
  });

  it('a retired subscription\'s queued callback AFTER the new battle\'s first snapshot changes nothing — B is never knocked back to pending', () => {
    // Review round (mutation pass): the row above delivers the retired
    // callbacks BEFORE B's snapshot, so B's snapshot would hide an overwrite.
    // Here they arrive after it: dropping the `active` guard would overwrite
    // B's envelope with A's generation-1 write and the screen would fall back
    // to the pending shell until B's next snapshot.
    render('battle-A', { options: ON });
    deliver(docSnap('battle-A', DOC_A));
    const retired = current();
    render('battle-B', { options: ON });
    deliver(docSnap('battle-B', DOC_B));
    const ready = { requestedId: 'battle-B', generation: 2, status: 'ready', snapshotId: 'battle-B', error: null };
    expect(env()).toMatchObject(ready);
    act(() => { retired.next(docSnap('battle-A', { ...DOC_A, status: 'completed' })); });
    expect(env()).toMatchObject(ready);
    act(() => { retired.error({ message: 'late', code: 'internal' }); });
    expect(env()).toMatchObject(ready);
    expect(env().data.executionMode).toBe('autopilot');
  });

  it('A→B→A: generation 3 waits for its own snapshot; generation 1\'s evidence never counts', () => {
    render('battle-A', { options: ON });
    deliver(docSnap('battle-A', DOC_A));
    render('battle-B', { options: ON });
    render('battle-A', { options: ON });
    expect(env()).toMatchObject({ requestedId: 'battle-A', generation: 3, status: 'pending', data: null });
    deliver(docSnap('battle-A', DOC_A));
    expect(env()).toMatchObject({ generation: 3, status: 'ready' });
  });

  it('missing document and subscription errors are their own states, with error identity; null is idle', () => {
    render('battle-A', { options: ON });
    deliver(docSnap('battle-A', null));
    expect(env()).toMatchObject({ status: 'missing', snapshotId: 'battle-A', data: null });
    deliver(docSnap('battle-A', DOC_A));
    expect(env().status).toBe('ready');
    fail({ message: 'permission-denied', code: 'permission-denied' });
    expect(env()).toMatchObject({ status: 'error', data: null, error: { code: 'permission-denied', message: 'permission-denied' } });
    // The legacy battle survives the error (unchanged); the envelope does not.
    expect(commits[commits.length - 1].battle).not.toBeNull();
    render(null, { options: ON });
    expect(env()).toMatchObject({ requestedId: null, status: 'idle', data: null });
  });

  it('one listener, same call shape (doc ref, next, error), same subscribe order as without the option', () => {
    render('battle-A', { options: ON });
    render('battle-B', { options: ON });
    expect(fsBox.log).toEqual([['subscribe', 0, 3, 'battle-A'], ['unsubscribe', 0], ['subscribe', 1, 3, 'battle-B']]);
  });

  it('StrictMode: an id change advances the generation exactly once', () => {
    render('battle-A', { options: ON, strict: true });
    deliver(docSnap('battle-A', DOC_A));
    render('battle-B', { options: ON, strict: true });
    expect(env().generation).toBe(2);
    deliver(docSnap('battle-B', DOC_B));
    expect(env()).toMatchObject({ generation: 2, status: 'ready' });
  });

  it('without the option there is no `integrity` key at all (legacy return shape)', () => {
    render('battle-A');
    deliver(docSnap('battle-A', DOC_A));
    expect(Object.keys(commits[commits.length - 1])).not.toContain('integrity');
    expect(Object.keys(commits[commits.length - 1])).toEqual(LEGACY_KEYS);
  });
});
