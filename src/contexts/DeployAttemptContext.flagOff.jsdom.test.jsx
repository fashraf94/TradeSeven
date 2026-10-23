// @vitest-environment jsdom
//
// src/contexts/DeployAttemptContext.flagOff.jsdom.test.jsx
//
// Command Center slice S2b, ruling R-S2b-1 and spec V1.2 §4: with the hub flag
// false the deploy provider is a stable pass-through — its children and nothing
// else. No reducer work, no subscription, timer or listener, no ceremony, no
// bridge call. App's own wiring is pinned from source: the provider wraps the
// screen router in the unified return, hands it App's callbacks, and App reads
// the hub flag exactly as before (once, through the accessor, in the pick).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const h = vi.hoisted(() => ({ subscribes: 0, ceremonies: 0 }));
vi.mock('../services/authIdentity', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, subscribeAuthIdentity: (...args) => { h.subscribes += 1; return real.subscribeAuthIdentity(...args); } };
});
vi.mock('../components/Dashboard/deployCeremony/DeployCeremony', () => ({ default: () => { h.ceremonies += 1; return null; } }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: () => () => {} }));

import { COMMAND_CENTER_HUB_ENABLED } from '../config/featureFlags';
import { DeployAttemptProvider, useDeployAttempt } from './DeployAttemptContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(path.join(HERE, '../App.jsx'), 'utf8').replace(/\r\n/g, '\n');

let container;
let root;
let seen;

function Child() {
  seen.push(useDeployAttempt());
  return <p data-child="">the screen</p>;
}

const bridge = () => ({
  onCreateAgentBattle: vi.fn(),
  onEnterBattle: vi.fn(),
  onOpenBattle: vi.fn(),
  refreshActiveBattles: vi.fn(),
  clearCeremonyStash: vi.fn(),
  userName: 'flash',
});

beforeEach(() => {
  h.subscribes = 0;
  h.ceremonies = 0;
  seen = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('flag off: the provider is a pass-through (spec §4; R-S2b-1)', () => {
  it('the shipped flag is false, so App\'s provider reads it as off', () => {
    expect(COMMAND_CENTER_HUB_ENABLED).toBe(false);
  });

  it.each([['the flag itself (App passes nothing)', undefined], ['an injected false', false]])(
    '%s: the children render alone — no subscription, timer or listener, no context, no ceremony, no bridge call',
    (_name, hubEnabled) => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      const addWindow = vi.spyOn(window, 'addEventListener');
      const addDocument = vi.spyOn(document, 'addEventListener');
      const b = bridge();
      act(() => { root.render(<DeployAttemptProvider hubEnabled={hubEnabled} {...b}><Child /></DeployAttemptProvider>); });
      act(() => { root.render(<DeployAttemptProvider hubEnabled={hubEnabled} {...b}><Child /></DeployAttemptProvider>); });
      expect(container.innerHTML).toBe('<p data-child="">the screen</p>');
      expect(seen.every((v) => v === null)).toBe(true);
      expect(h.subscribes).toBe(0);
      expect(h.ceremonies).toBe(0);
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(setIntervalSpy).not.toHaveBeenCalled();
      expect(addWindow).not.toHaveBeenCalled();
      expect(addDocument).not.toHaveBeenCalled();
      for (const fn of Object.values(b)) if (typeof fn === 'function') expect(fn).not.toHaveBeenCalled();
    },
  );

  it('the flag is read once, at mount: a later true does not start a provider (no live toggle exists)', () => {
    act(() => { root.render(<DeployAttemptProvider hubEnabled={false}><Child /></DeployAttemptProvider>); });
    act(() => { root.render(<DeployAttemptProvider hubEnabled><Child /></DeployAttemptProvider>); });
    expect(seen.every((v) => v === null)).toBe(true);
    expect(h.subscribes).toBe(0);
  });

  it('the control: an injected true does start one — the context is there and the identity is subscribed', () => {
    act(() => { root.render(<DeployAttemptProvider hubEnabled><Child /></DeployAttemptProvider>); });
    expect(seen.at(-1)).not.toBeNull();
    expect(h.subscribes).toBe(1);
  });
});

describe('App\'s wiring, from source (R-S2b-1)', () => {
  const body = (() => {
    const start = APP.indexOf('// UNIFIED RETURN');
    expect(start).toBeGreaterThan(-1);
    return APP.slice(start, APP.indexOf('DESKTOP SIDEBAR', start));
  })();

  it('the unified return wraps the screen router — and only it — in the provider, with App\'s callbacks as the bridge', () => {
    expect(body).toMatch(/<DeployAttemptProvider\s+onCreateAgentBattle=\{handleCreateAgentTrainingBattle\}\s+onEnterBattle=\{handleEnterCeremonyBattle\}\s+onOpenBattle=\{handleOpenAgentBattle\}\s+refreshActiveBattles=\{refreshActiveBattles\}\s+clearCeremonyStash=\{clearCeremonyStash\}\s+userName=\{user\?\.username\}\s*>\s*\{screenContent\}\s*<\/DeployAttemptProvider>/);
    expect(APP.match(/<DeployAttemptProvider\b/g)).toHaveLength(1);
    expect(APP).toContain("import { DeployAttemptProvider } from './contexts/DeployAttemptContext';");
  });

  it('App hands it no flag: the provider reads the accessor itself, so App\'s one read stays the pick\'s', () => {
    expect(body).not.toMatch(/hubEnabled=/);
    expect(APP.match(/\bisCommandCenterHubOn\(\)/g)).toHaveLength(1);
  });

  it('the stash release App adds takes only that battle\'s stash', () => {
    expect(APP).toMatch(/const clearCeremonyStash = \(battleId\) => \{\n\s+if \(!battleId \|\| pendingCeremonyBattleRef\.current\?\.id !== battleId\) return;\n\s+pendingCeremonyBattleRef\.current = null;\n\s+pendingCeremonyOwnerRef\.current = null;\n\s+\};/);
  });
});
