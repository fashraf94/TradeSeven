// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyWatchdogExisting.test.jsx
//
// Command Center slice S2b, live change (a) — ruling R-S2b-9a, R1 Fable review
// FR-1: the REAL stage machine, a fake clock. An existing answer that arrives
// after the 90 s watchdog, while the verification it started is still running,
// used to end on "Couldn't confirm the deploy" (tone lost_contact) and stay
// there; the resolution step now re-reads the client's own result and commits
// the `existing` terminal before any tone is computed. The RACE rows fail on the
// code before S2b (the failing-first log is in the S2b report §6).
//
// The CONTROL rows pin what must not move: the recovery admission (a 500 after
// the POST, a battle found → the recovered reveal), a refusal that is not
// admitted (a 429 → error), an existing answer before the watchdog, and the
// ordinary reveal.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useCeremonyStageMachine from './useCeremonyStageMachine';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TARGET = 'casual-agent-uid-1';
const OURS = 'deploy-ours';
let nowMs;
let container;
let root;
let machine;
let phases;
let verifyCalls;
let pendingVerify;

function Harness(props) {
  machine = useCeremonyStageMachine(props);
  return null;
}

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

const verifyBattle = () => {
  verifyCalls += 1;
  pendingVerify = deferred();
  return pendingVerify.promise;
};

const baseProps = {
  targetKnown: true,
  targetAgentId: TARGET,
  verifyBattle,
  onPhaseChange: (n) => { phases.push(n.phase); },
};

const render = (props) => act(() => { root.render(<Harness {...baseProps} {...props} />); });
const step = (ms) => act(() => { nowMs += ms; vi.advanceTimersByTime(ms); });
const flush = async () => { await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); }); };

/** Mount clean, then our deploy's first checkpoint: the baseline, then OURS pinned. */
function startOurs() {
  render({ stage: null, deployId: null, updatedAt: null, deployStatus: 'pending' });
  render({ stage: 'strategy_running', deployId: OURS, updatedAt: 'u1', deployStatus: 'pending' });
  step(200);
}

/**
 * No checkpoint for 90 s: the watchdog starts a verification, which the row then holds open. The clock jumps
 * 90 s but only one 100 ms interval tick runs, so the check's own 2 s budget is still pending when the row answers.
 */
function watchdogFires() {
  act(() => { nowMs += 90000; vi.advanceTimersByTime(100); });
  expect(machine.phase).toBe('verifying');
  expect(machine.errorKind).toBe('timeout');
  expect(verifyCalls).toBe(1);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  nowMs = 1_000_000;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  phases = [];
  verifyCalls = 0;
  pendingVerify = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const EXISTING = { deployStatus: 'existing', deployHttpStatus: 200, deployPostIssued: true, deployBattleId: null };

describe('FR-1 — an existing answer behind the watchdog (fails before S2b)', () => {
  it('RACE: the answer lands while the watchdog\'s check runs, the check finds the running battle → the existing terminal', async () => {
    startOurs();
    watchdogFires();
    render({ stage: 'strategy_running', deployId: OURS, updatedAt: 'u1', ...EXISTING });
    act(() => { nowMs += 1000; vi.advanceTimersByTime(1000); });
    pendingVerify.resolve({ found: true, battle: { id: 'battle-running' } });
    await flush();
    expect(machine.phase).toBe('existing');
    expect(machine.errorTone).toBeNull();
    expect(machine.recoveredBattle).toBeNull();
    expect(phases.at(-1)).toBe('existing');
  });

  it('RACE: …and when the check comes back empty, still the existing terminal — never "Couldn\'t confirm"', async () => {
    startOurs();
    watchdogFires();
    render({ stage: 'strategy_running', deployId: OURS, updatedAt: 'u1', ...EXISTING });
    pendingVerify.resolve({ found: false, battle: null });
    await flush();
    // The check's second look (it retries an empty answer once, 400 ms later) is empty too.
    act(() => { nowMs += 400; vi.advanceTimersByTime(400); });
    await flush();
    expect(verifyCalls).toBe(2);
    pendingVerify.resolve({ found: false, battle: null });
    await flush();
    expect(machine.phase).toBe('existing');
    expect(machine.errorTone).toBeNull();
  });

  it('RACE: the existing terminal holds — a later checkpoint changes nothing', async () => {
    startOurs();
    watchdogFires();
    render({ stage: 'strategy_running', deployId: OURS, updatedAt: 'u1', ...EXISTING });
    pendingVerify.resolve({ found: true, battle: { id: 'battle-running' } });
    await flush();
    render({ stage: 'complete', deployId: OURS, updatedAt: 'u2', ...EXISTING });
    step(5000);
    expect(machine.phase).toBe('existing');
  });
});

describe('FR-1 — what must not move: the admission and the reveal (byte-identical branches)', () => {
  it('CONTROL: a 500 after the POST lands during the same check, a battle found → the recovered reveal, as before', async () => {
    startOurs();
    watchdogFires();
    render({ stage: 'strategy_running', deployId: OURS, updatedAt: 'u1', deployStatus: 'error', deployHttpStatus: 500, deployPostIssued: true, deployBattleId: null });
    pendingVerify.resolve({ found: true, battle: { id: 'battle-found' } });
    await flush();
    expect(machine.phase).toBe('reveal');
    expect(machine.recoveredBattle).toEqual({ id: 'battle-found' });
  });

  it('CONTROL: a 429 refusal during the check is not admitted: the error terminal, lost contact, as before', async () => {
    startOurs();
    watchdogFires();
    render({ stage: 'strategy_running', deployId: OURS, updatedAt: 'u1', deployStatus: 'error', deployHttpStatus: 429, deployPostIssued: true, deployBattleId: null });
    pendingVerify.resolve({ found: true, battle: { id: 'battle-other' } });
    await flush();
    expect(machine.phase).toBe('error');
    expect(machine.errorTone).toBe('lost_contact');
    expect(machine.recoveredBattle).toBeNull();
  });

  it('CONTROL: an existing answer before any watchdog commits straight from evaluate, with no check', () => {
    startOurs();
    render({ stage: 'complete', deployId: OURS, updatedAt: 'u2', ...EXISTING });
    step(200);
    expect(machine.phase).toBe('existing');
    expect(verifyCalls).toBe(0);
  });

  it('CONTROL: a success with its checkpoints reveals, with no check', () => {
    startOurs();
    render({ stage: 'strategy_complete', deployId: OURS, updatedAt: 'u2', deployStatus: 'pending' });
    step(2600);
    render({ stage: 'portfolio_running', deployId: OURS, updatedAt: 'u3', deployStatus: 'pending' });
    step(2600);
    render({ stage: 'complete', deployId: OURS, updatedAt: 'u4', deployStatus: 'success' });
    for (let i = 0; i < 6; i += 1) step(2600);
    expect(machine.phase).toBe('reveal');
    expect(verifyCalls).toBe(0);
    expect(machine.recoveredBattle).toBeNull();
  });
});
