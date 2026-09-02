// @vitest-environment jsdom
//
// src/hooks/useDeployTargetProgress.test.jsx
//
// The deploy-target subscription contract (PR 1 §4/§7.2). The defect this hook
// exists for was invisible to every existing test because it was a WRONG-DOCUMENT
// bug, not a wrong-value bug: the ceremony read deployProgress off the ranked
// agent doc while the server wrote it to agents/{cloneId}. So the rows here
// assert WHICH id is subscribed, and that no payload is ever attributed to a
// target it did not come from.
//
// Live-behaviour suite (createRoot + act): renderToString never runs effects, so
// it cannot see a subscription at all.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';

const { subscribeMock } = vi.hoisted(() => ({ subscribeMock: vi.fn() }));
vi.mock('../services/agentService', () => ({ subscribeToAgentDoc: subscribeMock }));

const { default: useDeployTargetProgress } = await import('./useDeployTargetProgress.js');

const RANKED = 'agent-ranked-1';
const CLONE = 'casual-agent-uid1';

let container; let root; let seen;
// One entry per subscribe() call: the id it was given, its callback, and whether
// its unsubscribe has run.
let subs;

function Probe({ targetAgentId }) { seen = useDeployTargetProgress(targetAgentId); return null; }
const render = (targetAgentId) => act(() => { root.render(<Probe targetAgentId={targetAgentId} />); });
// Deliver a snapshot on a given subscription, the way onSnapshot would.
const deliver = (sub, doc) => act(() => { sub.cb(doc); });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  subs = [];
  seen = undefined;
  subscribeMock.mockReset();
  subscribeMock.mockImplementation((id, cb) => {
    const sub = { id, cb, unsubscribed: false };
    subs.push(sub);
    return () => { sub.unsubscribed = true; };
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useDeployTargetProgress — which document it watches', () => {
  it('subscribes to NOTHING while the target is unresolved', () => {
    render(null);
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(seen.targetKnown).toBe(false);
    expect(seen.deployProgress).toBeNull();
    expect(seen.lastDeployedAt).toBeNull();
  });

  it('subscribes to the CLONE id it is handed, not the ranked agent (§7.2)', () => {
    render(CLONE);
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subs[0].id).toBe(CLONE);
    expect(subs.map((s) => s.id)).not.toContain(RANKED);
  });

  it('surfaces deployProgress / lastDeployedAt / lastDecision off the target doc', () => {
    render(CLONE);
    deliver(subs[0], {
      id: CLONE,
      deployProgress: { deployId: 'd-1', stage: 'strategy_complete' },
      lastDeployedAt: '2026-09-02T14:00:00.000Z',
      lastDecision: { portfolio: { star: [{ symbol: 'NVDA' }] } },
    });
    expect(seen.deployProgress).toEqual({ deployId: 'd-1', stage: 'strategy_complete' });
    expect(seen.lastDeployedAt).toBe('2026-09-02T14:00:00.000Z');
    expect(seen.lastDecision.portfolio.star[0].symbol).toBe('NVDA');
    expect(seen.targetKnown).toBe(true);
  });

  // The row that fails if targetKnown is weakened to "an id exists". A baseline
  // captured in this window would be taken from nulls, which is precisely what
  // lets the first real payload's (possibly stale) deployId get pinned as ours.
  it('reports targetKnown FALSE until a snapshot for the target actually lands', () => {
    render(CLONE);
    expect(subs[0].id).toBe(CLONE);      // subscribed…
    expect(seen.targetKnown).toBe(false); // …but nothing observed yet
    expect(seen.deployProgress).toBeNull();
    deliver(subs[0], { id: CLONE, deployProgress: { deployId: 'd-1' } });
    expect(seen.targetKnown).toBe(true);
  });

  it('treats an empty/unreadable target doc as a real observation, not a hang', () => {
    render(CLONE);
    deliver(subs[0], null); // the error path in subscribeToAgentDoc calls back null
    expect(seen.targetKnown).toBe(true);
    expect(seen.deployProgress).toBeNull();
  });
});

describe('useDeployTargetProgress — target changes', () => {
  it('tears the old subscription down and re-subscribes on a new target id', () => {
    render(RANKED);
    deliver(subs[0], { id: RANKED, deployProgress: { deployId: 'old' } });
    expect(seen.deployProgress.deployId).toBe('old');

    render(CLONE);
    expect(subs[0].unsubscribed).toBe(true);
    expect(subs).toHaveLength(2);
    expect(subs[1].id).toBe(CLONE);
    // The previous target's payload must not survive the switch.
    expect(seen.deployProgress).toBeNull();
    expect(seen.targetKnown).toBe(false);
  });

  it('ignores a late payload from the PREVIOUS target', () => {
    render(RANKED);
    render(CLONE);
    deliver(subs[0], { id: RANKED, deployProgress: { deployId: 'stale-ranked' } });
    expect(seen.deployProgress).toBeNull();
    expect(seen.targetKnown).toBe(false);

    deliver(subs[1], { id: CLONE, deployProgress: { deployId: 'ours' } });
    expect(seen.deployProgress.deployId).toBe('ours');
  });

  it('drops the subscription when the target goes back to null', () => {
    render(CLONE);
    render(null);
    expect(subs[0].unsubscribed).toBe(true);
    expect(seen.targetKnown).toBe(false);
  });
});

describe('useDeployTargetProgress — keyed on the passed id only', () => {
  // Structural guard, not a behavioural one: reading ambient auth is the shared
  // root of the useActiveDeployments / useAgentBattleId standing bugs, and a
  // behavioural test cannot see the difference until the race actually fires.
  it('never reads auth.currentUser', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'useDeployTargetProgress.js'), 'utf8');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/currentUser/);
    expect(code).not.toMatch(/from ['"].*authService['"]/);
    expect(code).not.toMatch(/getAuth\s*\(/);
  });
});
