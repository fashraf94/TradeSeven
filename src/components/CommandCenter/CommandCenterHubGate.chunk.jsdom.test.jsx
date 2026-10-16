// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHubGate.chunk.jsdom.test.jsx
//
// Command Center hub, slices S0 and S1 — the REAL gate over the REAL hub
// module. The sibling suite drives gates over imports it controls; this one
// checks the default export App renders: that importing it evaluates no hub
// module (App imports the gate statically, so this is what happens on every
// page load with the flag off), and that rendering it resolves
// `import('./CommandCenterHub')` to the S1 shell, handed the site App named.
//
// The mock below passes the real hub module through and only counts how many
// times it is evaluated.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React, { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.setConfig({ testTimeout: 30_000 });

const hubModule = vi.hoisted(() => ({ evaluations: 0 }));
vi.mock('./CommandCenterHub', async (importOriginal) => {
  hubModule.evaluations += 1;
  return importOriginal();
});
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(async () => {}) }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
// The hub reads the signed-in user for its header (S1); App's UserProvider is not mounted here.
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash' } }) }));

import CommandCenterHubGate from './CommandCenterHubGate';
import { HUB_COPY } from './hub/hubCopy';

// The count right after the imports, read before any row renders the gate, so
// the row below holds in any order (S1 review L5-9: under --sequence.shuffle it
// ran after a render and saw 1). The wait lets an eager import() — the defect
// the row exists for — settle and be counted.
let evaluationsAtImport = null;
beforeAll(async () => {
  await vi.dynamicImportSettled();
  evaluationsAtImport = hubModule.evaluations;
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
});

describe('the real gate and the real hub chunk', () => {
  it('importing the gate (what App does on every load) evaluates no hub module', () => {
    expect(evaluationsAtImport).toBe(0);
  });

  it.each([
    ['mobile', undefined],
    ['desktop', (node) => <div data-frame="sidebar-offset">{node}</div>],
  ])('rendering it at the %s site loads the S1 shell for that site, and not the legacy shell', async (site, frame) => {
    await act(async () => {
      root.render(<StrictMode><CommandCenterHubGate site={site} legacy={<div data-shell="legacy" />} frame={frame} /></StrictMode>);
    });
    for (let i = 0; i < 50 && !host.querySelector('[data-hub="shell"]'); i += 1) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    const hub = host.querySelector('[data-hub="shell"]');
    expect(hub).not.toBeNull();
    expect(hub.tagName).toBe('SECTION');
    expect(hub.getAttribute('aria-label')).toBe(HUB_COPY.regionLabel);
    expect(hub.getAttribute('data-hub-site')).toBe(site);
    expect(hub.querySelector('h1').textContent).toBe(HUB_COPY.header.title);
    expect(host.querySelector('[data-shell]')).toBeNull();
    expect(host.querySelector('[data-hub-gate]')).toBeNull();
    if (frame) expect(hub.closest('[data-frame="sidebar-offset"]')).not.toBeNull();
    expect(hubModule.evaluations).toBe(1);
  });
});
