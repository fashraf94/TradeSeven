// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHubGate.jsdom.test.jsx
//
// Command Center hub, slice S0 — the lazy gate (spec V1.2 §4, §11.3 "rejected
// import shows correct legacy shell"). Every row drives a gate built by
// createCommandCenterHubGate() over an import this file controls, so a row can
// hold the chunk in flight, reject it or resolve it at will.
//
// The legacy shells are stand-ins built the way App.jsx builds them at its two
// sites (CommandDashboardDesktop inside the sidebar offset, the other three
// bare; the desktop gate framed by that same offset). Which shell a row expects
// comes from pickDashboardShell with the hub OFF, so the fallback is checked
// against the flag-off render itself, not against a table written here. That
// App really builds them this way is pinned by commandCenterHub.mount.guard.test.js.
//
// The render root wraps the gate in the real house ErrorBoundary named
// "Dashboard", inside StrictMode, as App's root and dashboard sites do.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.setConfig({ testTimeout: 30_000 });

// The house error log (ErrorBoundary.jsx logErrorToFirebase) writes through
// these; recording the writes lets a row see what was reported, and by whom.
const errorLog = vi.hoisted(() => ({ writes: [] }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(async (_ref, data) => { errorLog.writes.push(data); }),
}));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));

import ErrorBoundary from '../ErrorBoundary';
import {
  createCommandCenterHubGate,
  createHubLoader,
  HubLoadError,
  isHubLoadError,
} from './CommandCenterHubGate';
import { HUB_GATE_COPY } from './hubGateCopy';
import { pickDashboardShell, DASHBOARD_SHELLS as S } from './pickDashboardShell';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GATE_REPORT = 'Command Center hub (chunk load)';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** An import function whose every call returns a promise this file settles. */
function controlledImport() {
  const calls = [];
  const fn = vi.fn(() => {
    const d = deferred();
    calls.push(d);
    return d.promise;
  });
  return { fn, calls };
}

const HUB_MODULE = { default: function TestHub() { return <section data-hub="test-hub">hub</section>; } };

const Shell = ({ name }) => <div data-shell={name} />;
const sidebarOffset = (node) => <div data-frame="sidebar-offset">{node}</div>;

/** The legacy element for a shell key, as App.jsx builds it at its site. */
function legacyFor(key) {
  return key === S.COMMAND_DASHBOARD_DESKTOP ? sidebarOffset(<Shell name={key} />) : <Shell name={key} />;
}

/** The gate's props at a site, as App.jsx passes them: desktop adds the sidebar frame. */
function siteProps(isMobile, pick) {
  return isMobile
    ? { legacy: legacyFor(pick.legacyShell) }
    : { legacy: legacyFor(pick.legacyShell), frame: sidebarOffset };
}

let host;
let root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  errorLog.writes.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
  vi.restoreAllMocks();
});

async function render(element) {
  await act(async () => {
    root.render(
      <StrictMode>
        <ErrorBoundary name="Dashboard">
          <div data-container="app">{element}</div>
        </ErrorBoundary>
      </StrictMode>,
    );
  });
}

/** Let React finish whatever a settled import set off. */
async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

async function rejectCall(call, error = new Error('Failed to fetch dynamically imported module')) {
  await act(async () => { call.reject(error); });
  await settle();
}

async function resolveCall(call, module = HUB_MODULE) {
  await act(async () => { call.resolve(module); });
  await settle();
}

const q = (selector) => host.querySelector(selector);
const shellsShown = () => [...host.querySelectorAll('[data-shell]')].map((n) => n.dataset.shell);
const gateReports = () => errorLog.writes.filter((w) => w.screen === GATE_REPORT);
const button = (label) => [...host.querySelectorAll('button')].find((b) => b.textContent === label);

describe('the chunk is requested only by rendering the gate', () => {
  it('building a gate calls no import; rendering it calls the import once, StrictMode included', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    expect(imp.fn).not.toHaveBeenCalled();
    await render(<Gate legacy={<Shell name="legacy" />} />);
    expect(imp.fn).toHaveBeenCalledTimes(1);
  });

  it('once loaded, a later mount renders the hub at once: no second import, no skeleton', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await resolveCall(imp.calls[0]);
    await act(async () => { root.render(<div />); });
    expect(q('[data-hub="test-hub"]')).toBeNull();
    await render(<Gate legacy={<Shell name="legacy" />} />);
    expect(q('[data-hub="test-hub"]')).not.toBeNull();
    expect(q('[data-hub-gate="loading"]')).toBeNull();
    expect(imp.fn).toHaveBeenCalledTimes(1);
  });
});

describe('while the chunk is in flight, then loaded', () => {
  it('desktop: the skeleton, then the hub, each inside App\'s sidebar offset; no legacy shell, no notice', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    const pick = pickDashboardShell({ hubOn: true, isMobile: false, mobileDashboardOn: true, desktopDashboardOn: false });
    await render(<Gate {...siteProps(false, pick)} />);

    const skeleton = q('[data-container="app"] > [data-frame="sidebar-offset"] > [data-hub-gate="loading"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton.getAttribute('role')).toBe('status');
    expect(skeleton.textContent).toBe(HUB_GATE_COPY.loading);
    expect(shellsShown()).toEqual([]);
    expect(q('[data-hub-gate="load-error"]')).toBeNull();

    await resolveCall(imp.calls[0]);
    expect(q('[data-container="app"] > [data-frame="sidebar-offset"] > [data-hub="test-hub"]')).not.toBeNull();
    expect(q('[data-hub-gate="loading"]')).toBeNull();
    expect(shellsShown()).toEqual([]);
    expect(gateReports()).toEqual([]);
  });

  it('mobile: the skeleton, then the hub, unframed', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    const pick = pickDashboardShell({ hubOn: true, isMobile: true, mobileDashboardOn: true, desktopDashboardOn: true });
    await render(<Gate {...siteProps(true, pick)} />);
    expect(q('[data-container="app"] > [data-hub-gate="loading"]')).not.toBeNull();
    await resolveCall(imp.calls[0]);
    expect(q('[data-container="app"] > [data-hub="test-hub"]')).not.toBeNull();
    expect(q('[data-frame]')).toBeNull();
  });
});

// [isMobile, mobileDashboardOn, desktopDashboardOn] — every site and flag state.
const SITES = [
  [true, true, true],
  [true, true, false],
  [true, false, true],
  [true, false, false],
  [false, true, true],
  [false, false, true],
  [false, true, false],
  [false, false, false],
];

describe('a rejected import renders the hub-off legacy shell for the width and flags', () => {
  it.each(SITES)('isMobile=%s mobileDashboardOn=%s desktopDashboardOn=%s', async (isMobile, mobileDashboardOn, desktopDashboardOn) => {
    const on = pickDashboardShell({ hubOn: true, isMobile, mobileDashboardOn, desktopDashboardOn });
    const off = pickDashboardShell({ hubOn: false, isMobile, mobileDashboardOn, desktopDashboardOn });
    expect(on.shell).toBe(S.HUB);

    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    await render(<Gate {...siteProps(isMobile, on)} />);
    await rejectCall(imp.calls[0]);

    // Exactly the shell the flag-off site renders — and nothing of the hub.
    expect(shellsShown()).toEqual([off.shell]);
    expect(q('[data-hub-gate="loading"]')).toBeNull();
    expect(q('[data-hub="test-hub"]')).toBeNull();
    // Not the outer Dashboard boundary's error screen.
    expect(host.textContent).not.toContain('encountered an error');

    // The notice comes first, framed exactly as the hub would have been.
    const container = q('[data-container="app"]');
    const notice = q('[data-hub-gate="load-error"]');
    expect(notice.getAttribute('role')).toBe('alert');
    expect(notice.textContent).toContain(HUB_GATE_COPY.loadFailed);
    expect(container.firstElementChild.contains(notice)).toBe(true);
    if (isMobile) {
      expect(notice.parentElement).toBe(container);
    } else {
      expect(notice.parentElement.dataset.frame).toBe('sidebar-offset');
      expect(notice.parentElement.parentElement).toBe(container);
    }

    // The legacy shell carries its own App wrapper and nothing more: the gate's
    // frame never lands on it, so DashboardDesktop is not offset twice.
    let depth = 0;
    for (let n = q('[data-shell]').parentElement; n !== container; n = n.parentElement) {
      expect(n.dataset.frame).toBe('sidebar-offset');
      depth += 1;
    }
    expect(depth).toBe(off.shell === S.COMMAND_DASHBOARD_DESKTOP ? 1 : 0);
  });
});

describe('the failure is reported, and Retry and Reload work', () => {
  it('reports once, through the house error log and the console', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await rejectCall(imp.calls[0], new Error('chunk 404'));
    expect(gateReports()).toHaveLength(1);
    expect(gateReports()[0].message).toContain('chunk 404');
    expect(console.error.mock.calls.some((args) => String(args[0]).startsWith('[CommandCenterHubGate]'))).toBe(true);
  });

  it('Retry imports the chunk again and, when it loads, the hub replaces the notice and the legacy shell', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await rejectCall(imp.calls[0]);
    expect(shellsShown()).toEqual(['legacy']);

    await act(async () => { button(HUB_GATE_COPY.retry).click(); });
    expect(imp.fn).toHaveBeenCalledTimes(2);
    expect(q('[data-hub-gate="loading"]')).not.toBeNull();
    expect(shellsShown()).toEqual([]);

    await resolveCall(imp.calls[1]);
    expect(q('[data-hub="test-hub"]')).not.toBeNull();
    expect(q('[data-hub-gate="load-error"]')).toBeNull();
    expect(shellsShown()).toEqual([]);
    expect(gateReports()).toHaveLength(1);
  });

  it('a Retry that fails again lands on the legacy shell and the notice again, reported again', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await rejectCall(imp.calls[0]);
    await act(async () => { button(HUB_GATE_COPY.retry).click(); });
    await rejectCall(imp.calls[1]);
    expect(shellsShown()).toEqual(['legacy']);
    expect(q('[data-hub-gate="load-error"]')).not.toBeNull();
    expect(imp.fn).toHaveBeenCalledTimes(2);
    expect(gateReports()).toHaveLength(2);
  });

  it('Reload reloads the page and imports nothing', async () => {
    const imp = controlledImport();
    const reload = vi.fn();
    const Gate = createCommandCenterHubGate(imp.fn, { reload });
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await rejectCall(imp.calls[0]);
    await act(async () => { button(HUB_GATE_COPY.reload).click(); });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(imp.fn).toHaveBeenCalledTimes(1);
  });

  it('without Retry, a later mount still shows the legacy shell — a failed chunk is not re-requested on its own', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await rejectCall(imp.calls[0]);
    await act(async () => { root.render(<div />); });
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await settle();
    expect(shellsShown()).toEqual(['legacy']);
    expect(imp.fn).toHaveBeenCalledTimes(1);
  });

  it('an import that throws synchronously is a rejected import too', async () => {
    const Gate = createCommandCenterHubGate(() => { throw new Error('import() unavailable'); });
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await settle();
    expect(shellsShown()).toEqual(['legacy']);
    expect(gateReports()).toHaveLength(1);
  });
});

describe('only a rejected import falls back', () => {
  it('a hub that loads and then throws reaches the Dashboard boundary — no legacy shell hides it', async () => {
    const imp = controlledImport();
    const Gate = createCommandCenterHubGate(imp.fn);
    await render(<Gate legacy={<Shell name="legacy" />} />);
    await resolveCall(imp.calls[0], { default: function BrokenHub() { throw new Error('hub render bug'); } });

    expect(host.textContent).toContain('Dashboard encountered an error');
    expect(shellsShown()).toEqual([]);
    expect(q('[data-hub-gate="load-error"]')).toBeNull();
    expect(gateReports()).toEqual([]);
    expect(errorLog.writes.some((w) => w.screen === 'Dashboard' && w.message === 'hub render bug')).toBe(true);
  });
});

describe('the loader', () => {
  it('tags a rejection as HubLoadError, keeping its cause', async () => {
    const cause = new Error('net::ERR_FAILED');
    const error = new HubLoadError(cause);
    expect(isHubLoadError(error)).toBe(true);
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('net::ERR_FAILED');
    expect(isHubLoadError(cause)).toBe(false);
  });

  it('retry() swaps in a fresh lazy component; current() is stable between retries', () => {
    const loader = createHubLoader(() => Promise.resolve(HUB_MODULE));
    const first = loader.current();
    expect(loader.current()).toBe(first);
    loader.retry();
    expect(loader.current()).not.toBe(first);
  });
});
