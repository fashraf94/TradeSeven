// @vitest-environment jsdom
//
// src/components/AgentForm/AgentForm.engine.jsdom.test.jsx
//
// Build S0 — AgentForm over the REAL engine, loaded through the wrapper's own import(), with only the GPU
// module replaced (engine/__mocks__/glPlatform.js). Unmounting the last form releases everything the engine
// made (the dispose census, complete by construction) and every renderer, observer, listener and frame; a
// lost context shows the form's own cached still, and restore brings the live canvas back.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installCanvasKit, disposeCensus } from './__fixtures__/agentFormKit.js';

vi.mock('./engine/glPlatform.js');

// The real engine chunk loads through the wrapper's own import() and the rows build four forms and run frames in
// jsdom, so they wait in real time; vitest's default row timeout is 5 s, which a loaded 8-worker runner can
// exceed. The waits below stay under this budget so a failure reports the count seen, not a bare timeout (SR-8).
vi.setConfig({ testTimeout: 30000 });

import AgentForm from './AgentForm';
import { made } from './engine/glPlatform.js';
import { icosaCached } from './engine/armor.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const HERE = path.dirname(fileURLToPath(import.meta.url));

let kit, root, host, style, census;
beforeAll(() => {
  style = document.createElement('style');
  style.textContent = readFileSync(path.join(HERE, '..', '..', 'theme', 'tokens.css'), 'utf8');
  document.head.append(style);
  globalThis.WebGL2RenderingContext = function WebGL2RenderingContext() {};
  kit = installCanvasKit();
  census = disposeCensus();
});
afterAll(() => { census.restore(); kit.restore(); style.remove(); delete globalThis.WebGL2RenderingContext; });
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); made.renderers.length = 0; made.environments.length = 0; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

/** Wait (real time) until `n` forms report `status` — the engine chunk loads through the wrapper's own import(). */
async function settle(n, status = 'live') {
  await vi.waitFor(async () => { await act(async () => { await Promise.resolve(); }); expect(host.querySelectorAll(`[data-agent-form-status="${status}"]`)).toHaveLength(n); }, { timeout: 20000, interval: 20 });
}
const frames = (n) => { for (let i = 0; i < n; i += 1) kit.tick(16, (f) => act(f)); };

describe('the wrapper over the real engine', () => {
  it('the last form unmounting releases everything the engine made, and every renderer, observer, listener and frame', async () => {
    census.open();
    const listenersBefore = { ...kit.listeners }, observersBefore = kit.observers.length;
    act(() => root.render(<>
      <AgentForm archetype="momentum_chaser" size={200} coreStage={2} armorStage={3} batched bloom="webgl" />
      <AgentForm archetype="guardian" size={72} allegiance="opponent" />
      <AgentForm archetype="analyst" size={200} drawPath="direct" bloom="css" />
    </>));
    await settle(3);
    frames(5);
    act(() => root.render(<AgentForm archetype="contrarian" size={200} mood="celebrating" />));
    await settle(1);
    frames(3);
    act(() => root.render(null));
    census.close();

    const report = census.report();
    expect(report.geometry.made).toBeGreaterThan(300);
    expect(report.material.made).toBeGreaterThan(100);
    for (const k of ['geometry', 'material', 'texture', 'target']) expect(report[k].bad, k).toEqual([]);
    expect(made.renderers).toHaveLength(2); // the shared renderer and the direct view's
    for (const r of made.renderers) { expect(r.record.filter((x) => x === 'dispose')).toHaveLength(1); expect(r.record.filter((x) => x === 'forceContextLoss')).toHaveLength(1); }
    expect(kit.observers.length - observersBefore).toBe(1);
    expect(kit.observers.at(-1).disconnected).toBe(1);
    expect(kit.listeners.added - listenersBefore.added).toBe(1);
    expect(kit.listeners.removed - listenersBefore.removed).toBe(1);
    expect(kit.raf.queue).toHaveLength(0);
    expect(icosaCached()).toBe(false);
  });

  it('a lost context: the form shows its own cached still; restore: the live canvas again, on a rebuilt studio', async () => {
    act(() => root.render(<AgentForm archetype="analyst" size={200} />));
    await settle(1);
    frames(2);
    const box = host.querySelector('[data-agent-form]'), r = made.renderers[0];
    act(() => { r.domElement.dispatchEvent(new Event('webglcontextlost')); });
    expect(box.getAttribute('data-agent-form-status')).toBe('lost');
    expect(host.querySelector('[data-agent-form-still]').style.visibility).toBe('visible');
    expect(host.querySelector('[data-agent-form-canvas]').style.visibility).toBe('hidden');
    expect(host.querySelector('[data-agent-form-placeholder]')).toBeNull();
    // The still canvas holds the engine's stillT frame: it was drawn from the renderer's canvas at mount.
    expect(kit.logOf(host.querySelector('[data-agent-form-still]')).draws.some((d) => d.src === r.domElement)).toBe(true);
    act(() => { r.domElement.dispatchEvent(new Event('webglcontextrestored')); });
    expect(box.getAttribute('data-agent-form-status')).toBe('live');
    expect(host.querySelector('[data-agent-form-canvas]').style.visibility).toBe('visible');
    expect(made.environments).toHaveLength(2);
    act(() => root.render(null));
  });
});

void React;
