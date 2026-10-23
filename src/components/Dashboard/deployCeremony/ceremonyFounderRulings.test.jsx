// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/ceremonyFounderRulings.test.jsx
//
// Command Center slice S2b — the founder's rulings on the S2b report's
// questions, where they reach the shipped ceremony (today's shells use it too):
//
//   Q-S2b-2  every definitive refusal's eyebrow reads "Deployment refused", and
//            the in-progress refusal's subtext is the founder's. Each row names
//            the line before and after.
//   Q-S2b-5  the existing terminal's Retry goes through the hub provider's owned
//            read when it is given one (`ownedRead`), with that read's wait; the
//            shells pass nothing and their terminal is as it was.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot } from 'react-dom/client';

const h = vi.hoisted(() => ({ uid: 'uid-1', verify: null }));
vi.mock('../../../services/deployIdentity', () => ({ signedInUid: () => h.uid }));
vi.mock('../../../services/agentBattleVerify', () => ({ findActiveBattleForAgent: (...args) => h.verify(...args) }));

import CeremonyError from './CeremonyError';
import CeremonyExisting, { EXISTING_COPY } from './CeremonyExisting';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

const RUNNING = 'battle-running';
const OURS = () => ({ id: RUNNING, ownerId: 'uid-1', status: 'active' });

let container;
let root;

beforeEach(() => {
  h.uid = 'uid-1';
  h.verify = vi.fn(async () => ({ found: false, battle: null }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
/** The elements whose whole text is exactly `text` (a leaf line, not a parent that contains it). */
const lines = (text) => [...container.querySelectorAll('*')].filter((el) => el.textContent === text && [...el.children].every((c) => c.textContent !== text));
const primary = () => container.querySelectorAll('button')[0];

describe('Q-S2b-2 — the ceremony\'s refusal words, each line before and after', () => {
  const renderError = (props) => act(() => { root.render(<CeremonyError agentName="Nova" {...props} />); });

  it('the eyebrow of every definitive refusal (the confirmed tone, every kind): before "Deployment failed", after "Deployment refused"; each headline keeps its words', () => {
    const HEADLINES = {
      deploy: 'Deployment failed — no battle was created.',
      server: 'Deployment failed — no battle was created.',
      server_post: 'Nova made its picks, but the battle couldn’t be created.',
      timeout: 'Deployment timed out — no battle was created.',
    };
    for (const [errorKind, headline] of Object.entries(HEADLINES)) {
      renderError({ errorTone: 'confirmed', errorKind });
      expect(lines('Deployment refused'), errorKind).toHaveLength(1);
      expect(lines('Deployment failed'), errorKind).toHaveLength(0);
      expect(lines(headline), errorKind).toHaveLength(1);
      expect(container.textContent).toContain('Your agent is safe. Nothing is stuck — you can try again shortly.');
    }
  });

  it('the in-progress refusal: the subtext before "…If the deploy already running creates a battle, it will appear on your hub.", after the founder\'s line; the headline and the eyebrow kept', () => {
    renderError({ errorTone: 'confirmed', inProgress: true });
    expect(lines('Another deploy for your agent is still being set up. If it creates a battle, it will show up with your games.')).toHaveLength(1);
    expect(container.textContent).not.toContain('If the deploy already running creates a battle, it will appear on your hub.');
    expect(lines('A deploy is already in progress.')).toHaveLength(1);
    expect(lines('Deployment refused')).toHaveLength(1);
  });

  it('what the ruling leaves alone: lost contact keeps "Deployment unconfirmed", its headline and its subtext', () => {
    renderError({ errorTone: 'lost_contact', errorKind: 'server' });
    expect(lines('Deployment unconfirmed')).toHaveLength(1);
    expect(lines('Deployment refused')).toHaveLength(0);
    expect(lines('Couldn’t confirm the deploy.')).toHaveLength(1);
    expect(container.textContent).toContain('If the battle was created it will appear on your hub — check there before deploying again.');
  });
});

describe('Q-S2b-5 — the existing terminal\'s Retry, with and without the provider\'s owned read', () => {
  const renderExisting = (props = {}) => act(() => {
    root.render(<CeremonyExisting agentName="Nova" existingBattleId={RUNNING} liveBattles={[]} verifyBattle={() => h.verify('casual-agent-uid-1')} onOpenBattle={props.onOpenBattle ?? vi.fn()} onDismiss={vi.fn()} {...props} />);
  });

  it('without `ownedRead` (today\'s shells): Retry reads the verifier again and nothing else, and the button is as it was', async () => {
    renderExisting();
    await flush();
    expect(lines(EXISTING_COPY.unavailable)).toHaveLength(1);
    const button = primary();
    expect(button.textContent.trim()).toBe('Retry');
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(button.style.cursor).toBe('pointer');
    expect(button.style.background).not.toBe('transparent');
    expect(h.verify).toHaveBeenCalledTimes(1);
    act(() => { button.click(); });
    await flush();
    expect(h.verify).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('Retry available');
  });

  it('with `ownedRead`: Retry goes through it, never the verifier, and the battle it returns opens', async () => {
    const onOpenBattle = vi.fn();
    const ownedRead = { retry: vi.fn(async () => ({ status: 'found', battle: OURS() })), retryAt: null };
    renderExisting({ ownedRead, onOpenBattle });
    await flush();
    act(() => { primary().click(); });
    await flush();
    expect(ownedRead.retry).toHaveBeenCalledTimes(1);
    expect(h.verify).toHaveBeenCalledTimes(1);
    expect(primary().textContent.trim()).toBe(EXISTING_COPY.open);
    act(() => { primary().click(); });
    expect(onOpenBattle).toHaveBeenCalledWith(OURS());
  });

  it('with `ownedRead`: during the read\'s wait the button counts down and its press reads nothing; once the wait is over Retry reads', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(1_800_000_000_000);
    const ownedRead = { retry: vi.fn(async () => ({ status: 'unavailable', battle: null })), retryAt: Date.now() + 30_000 };
    renderExisting({ ownedRead });
    await flush();
    expect(primary().textContent.trim()).toBe('Retry available in 30s');
    expect(primary().getAttribute('aria-disabled')).toBe('true');
    // The waiting look: CeremonyError's disabled Retry (no fill, the plain cursor).
    expect(primary().style.background).toBe('transparent');
    expect(primary().style.cursor).toBe('default');
    act(() => { primary().click(); });
    await flush();
    expect(ownedRead.retry).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(12_000); });
    expect(primary().textContent.trim()).toBe('Retry available in 18s');
    await act(async () => { vi.advanceTimersByTime(18_000); });
    expect(primary().textContent.trim()).toBe('Retry');
    expect(primary().style.cursor).toBe('pointer');
    act(() => { primary().click(); });
    await flush();
    expect(ownedRead.retry).toHaveBeenCalledTimes(1);
    expect(h.verify).toHaveBeenCalledTimes(1);
  });

  it('with `ownedRead`: a wait that ends mid-second opens the Retry at its end, not on the next whole-second tick (review RL-3)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(1_800_000_000_000);
    const ownedRead = { retry: vi.fn(async () => ({ status: 'unavailable', battle: null })), retryAt: Date.now() + 30_500 };
    renderExisting({ ownedRead });
    await flush();
    expect(primary().textContent.trim()).toBe('Retry available in 31s');
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(primary().textContent.trim()).toBe('Retry available in 1s');
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(primary().textContent.trim()).toBe('Retry');
    expect(primary().getAttribute('aria-disabled')).toBeNull();
    // The countdown stops once the wait is over: no timer is left running (mutating lens X3).
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('with `ownedRead`: an owned read a newer read overtook sets nothing (mutating lens X7, X12)', async () => {
    let answer;
    const ownedRead = { retry: vi.fn(() => new Promise((r) => { answer = r; })), retryAt: null };
    renderExisting({ ownedRead });
    await flush();
    act(() => { primary().click(); });
    expect(lines(EXISTING_COPY.checking)).toHaveLength(1);
    // The live list now holds the battle and the verifier changed: the R1 read runs again and finds it.
    act(() => {
      root.render(<CeremonyExisting agentName="Nova" existingBattleId={RUNNING} liveBattles={[OURS()]} verifyBattle={() => h.verify('casual-agent-uid-1', 'again')} onOpenBattle={vi.fn()} onDismiss={vi.fn()} ownedRead={ownedRead} />);
    });
    await flush();
    expect(primary().textContent.trim()).toBe(EXISTING_COPY.open);
    await act(async () => { answer({ status: 'unavailable', battle: null }); });
    await flush();
    expect(primary().textContent.trim()).toBe(EXISTING_COPY.open);
    expect(lines(EXISTING_COPY.unavailable)).toHaveLength(0);
  });

  it('with `ownedRead`: a battle that is not the server\'s, or not the signed-in owner\'s, stays unavailable — and a read that throws too', async () => {
    for (const answer of [
      async () => ({ status: 'found', battle: { id: 'battle-other', ownerId: 'uid-1' } }),
      async () => ({ status: 'found', battle: { id: RUNNING, ownerId: 'uid-2' } }),
      async () => { throw new Error('denied'); },
    ]) {
      const ownedRead = { retry: vi.fn(answer), retryAt: null };
      renderExisting({ ownedRead });
      await flush();
      act(() => { primary().click(); });
      await flush();
      expect(ownedRead.retry).toHaveBeenCalledTimes(1);
      expect(lines(EXISTING_COPY.unavailable)).toHaveLength(1);
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('the two shells never hand the ceremony `ownedRead`; only the hub\'s root ceremony does, with the provider\'s owned read', () => {
    for (const shell of ['src/components/Dashboard/CommandDashboard.jsx', 'src/components/Dashboard/CommandDashboardDesktop.jsx']) {
      expect(read(shell), shell).toMatch(/<DeployCeremony\b/);
      expect(read(shell), shell).not.toMatch(/ownedRead/);
    }
    expect(read('src/contexts/DeployAttemptContext.jsx')).toMatch(/ownedRead=\{\{ retry: rt\.retryExistingRead, retryAt \}\}/);
    expect(read('src/components/Dashboard/deployCeremony/DeployCeremony.jsx')).toMatch(/ownedRead=\{ownedRead\}/);
  });
});
