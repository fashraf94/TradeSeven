// @vitest-environment jsdom
//
// src/components/AgentForm/AgentForm.armory.jsdom.test.jsx
//
// Agent form build A1 — the wrapper's two looks for a set on its hook (board 6; Phase 0 armory report §7.2), with
// AGENT_FORM_ARMORY_ENABLED held on here: `coreStage: SET_ALONE` draws the set alone (the engine's `brain: false`), and
// `allegiance: UNLIT` draws it pewter (the engine's `pal: 'unlit'`). Both are values of props the wrapper already takes,
// so flag-off nothing changes (agentFormSpec.armoryOff.test.js; agentForm.flagOffBundle.test.js reads the bundle). The
// engine is the recording stand-in AgentForm.jsdom.test.jsx uses.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({ load: null, mounts: [] }));
vi.mock('./loadEngine', () => ({ loadAgentFormEngine: (...a) => engine.load(...a) }));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_ARMORY_ENABLED: true }));

import AgentForm from './AgentForm';
import { SET_ALONE, UNLIT, agentFormSpec } from './agentFormSpec';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fakeEngineModule() {
  return {
    getAgentFormEngine: () => ({
      mount(els, spec, options, cb) {
        const view = { spec, options, updates: [], swaps: [], optionSets: [] };
        engine.mounts.push(view);
        cb.onStatus('live', { still: false });
        return { update: (p) => view.updates.push(p), swap: (p) => view.swaps.push(p), setOptions: (o) => view.optionSets.push(o), equip() {}, respond() {}, unmount() {} };
      },
    }),
  };
}

let root, host, hadGL;
const render = (el) => act(() => { root.render(el); });
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  engine.mounts = []; engine.load = vi.fn(async () => fakeEngineModule());
  hadGL = Object.hasOwn(globalThis, 'WebGL2RenderingContext');
  globalThis.WebGL2RenderingContext = function WebGL2RenderingContext() {};
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  if (!hadGL) delete globalThis.WebGL2RenderingContext;
});

describe('agentFormSpec with the armory on: the two looks', () => {
  it('SET_ALONE is the set with no brain; any other stage keeps the brain (no key at all)', () => {
    expect(SET_ALONE).toBe(0);
    expect(agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE }).brain).toBe(false);
    for (const coreStage of [1, 2, 3, undefined]) expect('brain' in agentFormSpec({ archetype: 'contrarian', coreStage }), String(coreStage)).toBe(false);
    // a set alone is still drawn at stage 1's core index (the armor builders read its radius)
    expect(agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE }).core).toBe(0);
  });

  it('UNLIT is the pewter palette; the player stays teal and the opponent copper', () => {
    expect(UNLIT).toBe('unlit');
    expect(agentFormSpec({ archetype: 'degen', allegiance: UNLIT }).pal).toBe('unlit');
    expect(agentFormSpec({ archetype: 'degen', allegiance: 'player' }).pal).toBe('teal');
    expect(agentFormSpec({ archetype: 'degen', allegiance: 'opponent' }).pal).toBe('copper');
    // pewter is not a side: it looks the player's way
    expect(agentFormSpec({ archetype: 'degen', allegiance: UNLIT }).face).toBe(1);
  });

  it('a set alone keeps the tight framing\'s zoom when that is asked for too', () => {
    expect(agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE, framing: 'tight' })).toMatchObject({ brain: false, zoom: 0.95 });
    expect('zoom' in agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE })).toBe(false);
  });
});

describe('the wrapper hands the engine both looks', () => {
  it('at mount: the set alone, pewter, at the still rate', async () => {
    render(<AgentForm archetype="guardian" coreStage={SET_ALONE} allegiance={UNLIT} size={48} rate="still" label={null} />);
    await flush();
    const [view] = engine.mounts;
    expect(view.spec).toMatchObject({ kind: 'preserve', brain: false, pal: 'unlit', size: 48 });
    expect(view.options.rate).toBe('still');
  });

  it('an equip lights the set: the palette changes on the running view, which is not remounted', async () => {
    render(<AgentForm archetype="guardian" coreStage={SET_ALONE} allegiance={UNLIT} size={112} rate="still" label={null} />);
    await flush();
    render(<AgentForm archetype="guardian" coreStage={SET_ALONE} allegiance="player" size={112} rate="still" label={null} />);
    await flush();
    expect(engine.mounts).toHaveLength(1);
    expect(engine.mounts[0].updates.at(-1)).toMatchObject({ kind: 'preserve', pal: 'teal' });
  });

  it('a hover makes it live and back: a rate flip on the same view', async () => {
    render(<AgentForm archetype="analyst" coreStage={SET_ALONE} allegiance={UNLIT} size={112} rate="still" label={null} />);
    await flush();
    render(<AgentForm archetype="analyst" coreStage={SET_ALONE} allegiance={UNLIT} size={112} rate="live" label={null} />);
    render(<AgentForm archetype="analyst" coreStage={SET_ALONE} allegiance={UNLIT} size={112} rate="still" label={null} />);
    expect(engine.mounts).toHaveLength(1);
    expect(engine.mounts[0].optionSets.map((o) => o.rate)).toEqual(['live', 'still']);
  });

  it('R12 holds: a set drawn under 40 px is a still, whatever it is asked', async () => {
    render(<AgentForm archetype="analyst" coreStage={SET_ALONE} allegiance={UNLIT} size={36} rate="live" label={null} />);
    await flush();
    expect(engine.mounts[0].options.rate).toBe('still');
  });
});
