// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHubGate.chunk.jsdom.test.jsx
//
// Command Center hub, slice S0 — the REAL gate over the REAL hub module. The
// sibling suite drives gates over imports it controls; this one checks the
// default export App renders: that importing it evaluates no hub module (App
// imports the gate statically, so this is what happens on every page load with
// the flag off), and that rendering it resolves `import('./CommandCenterHub')`
// to the S0 scaffold — one labelled placeholder.
//
// The mock below passes the real hub module through and only counts how many
// times it is evaluated.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import CommandCenterHubGate from './CommandCenterHubGate';
import { HUB_COPY } from './hub/hubCopy';

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
    expect(hubModule.evaluations).toBe(0);
  });

  it('rendering it loads the scaffold: one labelled placeholder, and not the legacy shell', async () => {
    await act(async () => {
      root.render(<StrictMode><CommandCenterHubGate legacy={<div data-shell="legacy" />} /></StrictMode>);
    });
    for (let i = 0; i < 50 && !host.querySelector('[data-hub="placeholder"]'); i += 1) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    const hub = host.querySelector('[data-hub="placeholder"]');
    expect(hub).not.toBeNull();
    expect(hub.tagName).toBe('SECTION');
    expect(hub.getAttribute('aria-label')).toBe(HUB_COPY.regionLabel);
    expect(hub.querySelector('h1').textContent).toBe(HUB_COPY.placeholderTitle);
    expect(hub.querySelector('p').textContent).toBe(HUB_COPY.placeholderBody);
    expect(host.querySelector('[data-shell]')).toBeNull();
    expect(host.querySelector('[data-hub-gate]')).toBeNull();
    expect(hubModule.evaluations).toBe(1);
  });
});
