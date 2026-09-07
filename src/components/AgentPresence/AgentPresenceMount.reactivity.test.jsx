// @vitest-environment jsdom
//
// src/components/AgentPresence/AgentPresenceMount.reactivity.test.jsx
//
// Battle View A3 (D-91, hazard 41) — the mount's own promise, tested on the
// mount rather than on a mock of it.
//
// Review lens 4 F6: ArenaHeader's "mounts the presence face static, with its
// events withheld" asserts on a MOCK of this component, so it proves the CALLER
// passes the right props and nothing about what the mount does with them.
// Passing events through for a static face — the exact hazard-41 defect —
// survived 78 rows including both presence suites and a 975-row broad set,
// because this file had no test at all.
//
// The rule it guards: `reactivityLevel="static"` means STILL and DEAF. The two
// are one decision, wired together here so a caller cannot get one without the
// other — a static face has no loop to play a reaction into, and the duel
// binding's events are the raw statusFeed whose feed-only actions the tape is
// forbidden to render (D-88).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// The face itself is a canvas stage; this file is about the props that reach it.
const seen = [];
vi.mock('./AgentPresence', () => ({
  default: (props) => { seen.push(props); return null; },
}));

import AgentPresenceMount from './AgentPresenceMount';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const AGENT = { agentContext: { archetype: 'degen' } };
// `statusFeedToEvents` only emits for the SWAP_ACTIONS set (presenceBinding.js:156),
// so this fixture uses an action that really produces an event — otherwise the
// "withholds them even when there is something to give" row would pass because
// there was nothing to give, which is the failure mode this whole file exists
// to close.
const DUEL = {
  playerScore: 12,
  opponentScore: 3,
  statusFeed: [{ action: 'swap', symbolOut: 'GILD', symbolIn: 'MOS', timestamp: '2026-09-01T15:00:00.000Z' }],
};

let container;
let root;
beforeEach(() => {
  seen.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (props) => act(() => {
  root.render(<AgentPresenceMount surface="duel" agent={AGENT} duel={DUEL} {...props} />);
});

describe('reactivityLevel — the prop the character pane needed', () => {
  it('defaults to reactive, and passes the surface\'s events through', () => {
    mount({});
    expect(seen).toHaveLength(1);
    expect(seen[0].reactivityLevel).toBe('reactive');
    expect(Array.isArray(seen[0].events)).toBe(true);
  });

  it('STATIC WITHHOLDS EVENTS — the two are one decision (hazard 41)', () => {
    // The mutation this row exists to kill: `events={events}` for a static face.
    mount({ reactivityLevel: 'static' });
    expect(seen).toHaveLength(1);
    expect(seen[0].reactivityLevel).toBe('static');
    expect(seen[0].events).toBeNull();
  });

  it('withholds them even when the surface has a feed to give', () => {
    // The duel binding turns statusFeed into events, so this is the case that
    // matters: there IS something to pass, and it must not be passed.
    mount({ reactivityLevel: 'reactive' });
    const reactiveEvents = seen[0].events;
    expect(reactiveEvents.length).toBeGreaterThan(0);
    seen.length = 0;
    mount({ reactivityLevel: 'static' });
    expect(seen[0].events).toBeNull();
  });

  it('passes the rest through unchanged either way', () => {
    mount({ reactivityLevel: 'static', size: 44, enableEnvironment: false });
    expect(seen[0].size).toBe(44);
    expect(seen[0].enableEnvironment).toBe(false);
    expect(typeof seen[0].accent).toBe('string');
    expect(typeof seen[0].standing).toBe('number');
  });
});
