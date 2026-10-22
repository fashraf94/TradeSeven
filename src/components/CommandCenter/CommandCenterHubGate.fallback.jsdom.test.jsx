// @vitest-environment jsdom
//
// Command Center hub, slice S5 — the gate's fallback signal (ruling R-S5-7: the
// floating bug button and the season banner are withheld "whenever the hub is the
// rendered dashboard"; review E1-1, found by three lenses).
//
// With the hub flag on and the hub chunk failing to load, the gate shows the legacy
// shell, which has no bug control of its own. The gate therefore tells App
// (`onFallback`, hub/hubFallbackSignal.jsx) while that shell is what is on screen, and
// App's `hidden` follows. The model below is App's own wiring in miniature: ONE
// `useState(false)` handed to the REAL gate as `onFallback`, and the floating button's
// `hidden` computed with the REAL hubOwnsDashboard. (That App really is wired this way
// is pinned as source text in commandCenterHub.mount.guard.test.js.)
//
// Every transition: loading, loaded, rejected, Retry that works, Retry that fails, Dismiss,
// navigation away and back, the Forge opening over the dashboard, a breakpoint flip, a hub
// that loads and then throws, and a gate with no `onFallback` at all.

import React, { StrictMode, act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
vi.mock('firebase/firestore', () => ({ collection: vi.fn(() => ({})), doc: vi.fn(() => ({})), setDoc: vi.fn(async () => {}) }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));

import ErrorBoundary from '../ErrorBoundary';
import { createCommandCenterHubGate } from './CommandCenterHubGate';
import { hubOwnsDashboard } from './hubChrome';
import { HUB_GATE_COPY } from './hubGateCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const HUB_MODULE = { default: function TestHub() { return <section data-hub="test-hub">hub</section>; } };

let host;
let root;
const api = { current: null };
let fallbackCalls = [];

function Legacy() { return <div data-shell="legacy" />; }

function MiniApp({ Gate, withSignal = true }) {
  const [screen, setScreen] = useState('dashboard');
  const [showForge, setShowForge] = useState(false);
  const [site, setSite] = useState('mobile');
  const [hubFallback, setRaw] = useState(false);
  // A stable function, as a state setter is; it records what the gate tells it.
  const setHubFallback = useRef((value) => { fallbackCalls.push(value); setRaw(value); }).current;
  const hidden = hubOwnsDashboard({ screen, showForge, hubFailed: hubFallback, hubOn: true });
  api.current = { setScreen, setShowForge, setSite };
  return (
    <>
      <div data-clashbot data-hidden={String(hidden)} data-fb={String(hubFallback)} />
      <ErrorBoundary name="Dashboard">
        {screen === 'dashboard' && !showForge && (
          <Gate
            site={site}
            legacy={<Legacy />}
            frame={site === 'desktop' ? (node) => <div data-frame="desktop">{node}</div> : undefined}
            onFallback={withSignal ? setHubFallback : undefined}
          />
        )}
      </ErrorBoundary>
    </>
  );
}

const settle = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); }); };
const attr = (name) => host.querySelector('[data-clashbot]').getAttribute(name);
const hiddenNow = () => attr('data-hidden') === 'true';
const fallbackNow = () => attr('data-fb') === 'true';
const q = (selector) => host.querySelector(selector);
const button = (label) => [...host.querySelectorAll('button')].find((b) => b.textContent === label || b.getAttribute('aria-label') === label);
const click = async (label) => { await act(async () => { button(label).click(); }); };

async function mount(strict, controlled, props) {
  const Gate = createCommandCenterHubGate(controlled.fn);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const element = <MiniApp Gate={Gate} {...props} />;
  await act(async () => { root.render(strict ? <StrictMode>{element}</StrictMode> : element); });
}
function controlledImport() {
  const calls = [];
  const fn = vi.fn(() => { const d = deferred(); calls.push(d); return d.promise; });
  return { fn, calls };
}
const reject = async (call) => { await act(async () => { call.reject(new Error('Failed to fetch dynamically imported module')); }); await settle(); };
const resolve = async (call, module = HUB_MODULE) => { await act(async () => { call.resolve(module); }); await settle(); };

beforeEach(() => { fallbackCalls = []; vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
  vi.restoreAllMocks();
});

describe.each([['plain', false], ['StrictMode', true]])('the gate\'s fallback signal, %s', (_label, strict) => {
  it('loading, then loaded: the hub owns the screen the whole time — skeleton included, so the button never flickers — and the signal is never raised', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    expect(q('[data-hub-gate="loading"]')).not.toBeNull();
    expect(hiddenNow()).toBe(true);
    await resolve(imp.calls[0]);
    expect(q('[data-hub="test-hub"]')).not.toBeNull();
    expect(hiddenNow()).toBe(true);
    expect(fallbackCalls).toEqual([]);
  });

  it('rejected: the legacy shell shows and the floating button is given back', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    await reject(imp.calls[0]);
    expect(q('[data-shell="legacy"]')).not.toBeNull();
    expect(q('[data-hub-gate="load-error"]')).not.toBeNull();
    expect(fallbackNow()).toBe(true);
    expect(hiddenNow()).toBe(false);
  });

  it('Retry that succeeds: the signal falls, the hub is on screen, the button is withheld again', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    await reject(imp.calls[0]);
    await click(HUB_GATE_COPY.retry);
    expect(hiddenNow()).toBe(false);
    await resolve(imp.calls[1]);
    expect(q('[data-hub="test-hub"]')).not.toBeNull();
    expect(q('[data-shell]')).toBeNull();
    expect(fallbackNow()).toBe(false);
    expect(hiddenNow()).toBe(true);
  });

  it('Retry that fails, and Dismiss, leave it raised: the legacy shell is still what the player has', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    await reject(imp.calls[0]);
    await click(HUB_GATE_COPY.retry);
    await reject(imp.calls[1]);
    expect(fallbackNow()).toBe(true);
    expect(hiddenNow()).toBe(false);
    await click(HUB_GATE_COPY.dismiss);
    expect(q('[data-hub-gate="load-error"]')).toBeNull();
    expect(q('[data-shell="legacy"]')).not.toBeNull();
    expect(fallbackNow()).toBe(true);
    expect(hiddenNow()).toBe(false);
  });

  it('navigation away unmounts the gate and lowers the signal; back on the dashboard the cached failure raises it again, without a second import', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    await reject(imp.calls[0]);
    await act(async () => { api.current.setScreen('profile'); });
    await settle();
    expect(q('[data-shell]')).toBeNull();
    expect(fallbackNow()).toBe(false);
    await act(async () => { api.current.setScreen('dashboard'); });
    await settle();
    expect(q('[data-shell="legacy"]')).not.toBeNull();
    expect(fallbackNow()).toBe(true);
    expect(hiddenNow()).toBe(false);
    expect(imp.fn).toHaveBeenCalledTimes(1);
  });

  it('the Forge opening over the dashboard (App renders the Forge INSTEAD of it) lowers the signal, and closing it raises it again', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    await reject(imp.calls[0]);
    await act(async () => { api.current.setShowForge(true); });
    await settle();
    expect(fallbackNow()).toBe(false);
    await act(async () => { api.current.setShowForge(false); });
    await settle();
    expect(fallbackNow()).toBe(true);
  });

  it('a breakpoint flip while the fallback shows (the same gate, the site and its frame change): the signal stays raised and is not re-sent', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    await reject(imp.calls[0]);
    fallbackCalls = [];
    await act(async () => { api.current.setSite('desktop'); });
    await settle();
    expect(q('[data-shell="legacy"]')).not.toBeNull();
    expect(fallbackNow()).toBe(true);
    expect(fallbackCalls).toEqual([]);
  });

  it('a hub that loads after a Retry and then throws in render: the Dashboard boundary takes over and the signal is not left raised', async () => {
    const imp = controlledImport();
    await mount(strict, imp);
    await reject(imp.calls[0]);
    await click(HUB_GATE_COPY.retry);
    await resolve(imp.calls[1], { default: function BrokenHub() { throw new Error('hub render bug'); } });
    expect(host.textContent).toContain('Dashboard encountered an error');
    expect(fallbackNow()).toBe(false);
  });
});

describe('the gate without `onFallback` (every caller before S5, the gate\'s own suites)', () => {
  it('shows the fallback and calls nothing', async () => {
    const imp = controlledImport();
    await mount(false, imp, { withSignal: false });
    await reject(imp.calls[0]);
    expect(q('[data-shell="legacy"]')).not.toBeNull();
    expect(fallbackCalls).toEqual([]);
    expect(fallbackNow()).toBe(false);
  });
});

describe('the signal stays out of every state but the fallback', () => {
  it('while the hub renders no signal is ever raised: the hub chunk resolves at once', async () => {
    const imp = controlledImport();
    await mount(false, imp);
    await resolve(imp.calls[0]);
    await act(async () => { api.current.setSite('desktop'); });
    await settle();
    await act(async () => { api.current.setSite('mobile'); });
    await settle();
    expect(fallbackCalls).toEqual([]);
    expect(hiddenNow()).toBe(true);
  });
});
