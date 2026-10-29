// @vitest-environment jsdom
//
// src/components/AgentForm/AgentForm.jsdom.test.jsx
//
// Build S0 — the AgentForm wrapper's routing, with the engine replaced by a recording stand-in (the real
// engine under the wrapper is AgentForm.engine.jsdom.test.jsx). No WebGL → the still, and the engine chunk is
// never requested; a lost context → the form's cached still, or the fallback still when none was cached;
// mood, stage, allegiance and size update the running view; only the draw path remounts it.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({ load: null, mounts: [], views: [] }));
vi.mock('./loadEngine', () => ({ loadAgentFormEngine: (...a) => engine.load(...a) }));

import AgentForm from './AgentForm';
import { formForArchetype, agentFormSpec, ARCHETYPE_CODE_IDS, stageIndex } from './agentFormSpec';
import { getAgentGrowth } from './agentGrowth';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fakeEngineModule() {
  return {
    getAgentFormEngine: () => ({
      mount(els, spec, options, cb, theme) {
        const view = { els, spec, options, cb, theme, updates: [], optionSets: [], equips: [], unmounts: 0 };
        engine.mounts.push(view);
        const handle = { update: (p) => view.updates.push(p), setOptions: (o) => view.optionSets.push(o), equip: (on) => view.equips.push(on), unmount: () => { view.unmounts += 1; } };
        engine.views.push(handle);
        cb.onStatus('live', { still: false });
        return handle;
      },
    }),
  };
}

let root, host, hadGL;
function render(el) { act(() => { root.render(el); }); }
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
const q = (sel) => host.querySelector(sel);
const shown = (sel) => q(sel) && q(sel).style.visibility !== 'hidden' && q(sel).style.display !== 'none';

beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  engine.mounts = []; engine.views = []; engine.load = vi.fn(async () => fakeEngineModule());
  hadGL = Object.hasOwn(globalThis, 'WebGL2RenderingContext');
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  if (!hadGL) delete globalThis.WebGL2RenderingContext;
});
const withWebGL = () => { globalThis.WebGL2RenderingContext = function WebGL2RenderingContext() {}; };

describe('no WebGL → the still, and no engine', () => {
  it('jsdom has no WebGL: the box shows the fallback still, carries the label, and the engine chunk is never requested', async () => {
    render(<AgentForm archetype="momentum_chaser" size={200} />);
    await flush();
    expect(q('[data-agent-form]').getAttribute('data-agent-form-status')).toBe('unavailable');
    expect(q('[data-agent-form]').getAttribute('role')).toBe('img');
    expect(q('[data-agent-form]').getAttribute('aria-label')).toBe('Shadow, armored — idle');
    expect(q('[data-agent-form-placeholder]')).not.toBeNull();
    expect(host.querySelectorAll('canvas')).toHaveLength(0);
    expect(engine.load).not.toHaveBeenCalled();
    expect(q('[data-agent-form]').style.width).toBe('200px');
  });
});

describe('with WebGL', () => {
  beforeEach(withWebGL);

  it('shows the fallback still while the engine loads, then mounts one view with the mapped spec and the canvas', async () => {
    render(<AgentForm archetype="guardian" mood="worried" coreStage={2} armorStage={3} allegiance="opponent" size={230} bloom="css" rate="half" batched />);
    expect(q('[data-agent-form-placeholder]')).not.toBeNull();
    await flush();
    expect(engine.mounts).toHaveLength(1);
    const m = engine.mounts[0];
    expect(m.spec).toMatchObject({ kind: 'preserve', state: 'worried', core: 1, armor: 2, pal: 'copper', face: -1, size: 230, fit: 1, unfit: false });
    expect(m.options).toMatchObject({ path: 'shared', bloom: 'css', rate: 'half', batched: true, reducedMotion: false });
    expect(Object.keys(m.els).sort()).toEqual(['box', 'canvas', 'overlay', 'slot', 'stillCanvas']);
    expect(m.theme.palettes.teal).toBeDefined();
    expect(q('[data-agent-form]').getAttribute('data-agent-form-status')).toBe('live');
    expect(shown('[data-agent-form-canvas]')).toBe(true);
    expect(q('[data-agent-form-placeholder]')).toBeNull();
    // The box is its own stacking context, so the bloom overlay's plus-lighter blend reaches the form's canvas only
    // and never the page behind the box (review SR-1).
    expect(q('[data-agent-form]').style.isolation).toBe('isolate');
  });

  it('mood, stage, allegiance and size update the running view; options go to setOptions; nothing remounts', async () => {
    render(<AgentForm archetype="degen" size={200} />);
    await flush();
    render(<AgentForm archetype="degen" mood="celebrating" coreStage={3} armorStage={2} allegiance="opponent" size={260} />);
    render(<AgentForm archetype="degen" mood="celebrating" coreStage={3} armorStage={2} allegiance="opponent" size={260} reducedMotion bloom="webgl" />);
    expect(engine.mounts).toHaveLength(1);
    expect(engine.mounts[0].updates.at(-1)).toMatchObject({ kind: 'spec', state: 'celebrating', core: 2, armor: 1, pal: 'copper', face: -1, size: 260 });
    expect(engine.mounts[0].optionSets.at(-1)).toMatchObject({ reducedMotion: true, bloom: 'webgl' });
    expect(engine.mounts[0].unmounts).toBe(0);
  });

  it('equipped false → true plays unequip then equip; the first render plays nothing', async () => {
    render(<AgentForm archetype="analyst" equipped />);
    await flush();
    render(<AgentForm archetype="analyst" equipped={false} />);
    render(<AgentForm archetype="analyst" equipped />);
    expect(engine.mounts[0].equips).toEqual([false, true]);
  });

  it('mounted unequipped, the view starts at fit 0 on the unequip curve', async () => {
    render(<AgentForm archetype="analyst" equipped={false} />);
    await flush();
    expect(engine.mounts[0].spec).toMatchObject({ fit: 0, unfit: true });
  });

  it('only the draw path remounts the view (the direct path gets a fresh canvas from the engine)', async () => {
    render(<AgentForm archetype="contrarian" />);
    await flush();
    render(<AgentForm archetype="contrarian" drawPath="direct" />);
    await flush();
    expect(engine.mounts).toHaveLength(2);
    expect(engine.mounts[0].unmounts).toBe(1);
    expect(engine.mounts[1].options.path).toBe('direct');
    expect(shown('[data-agent-form-direct]')).toBe(true);
    expect(shown('[data-agent-form-canvas]')).toBe(false);
  });

  it('a lost context shows the form\'s cached still; without one, the fallback still; restore shows the live canvas again', async () => {
    render(<AgentForm archetype="diversifier" />);
    await flush();
    const cb = engine.mounts[0].cb;
    act(() => cb.onStatus('lost', { still: true }));
    expect(shown('[data-agent-form-still]')).toBe(true);
    expect(shown('[data-agent-form-canvas]')).toBe(false);
    expect(shown('[data-agent-form-overlay]')).toBe(false);
    expect(q('[data-agent-form-placeholder]')).toBeNull();
    act(() => cb.onStatus('lost', { still: false }));
    expect(shown('[data-agent-form-still]')).toBe(false);
    expect(q('[data-agent-form-placeholder]')).not.toBeNull();
    act(() => cb.onStatus('live', { still: true }));
    expect(shown('[data-agent-form-canvas]')).toBe(true);
    expect(q('[data-agent-form-placeholder]')).toBeNull();
    // A view whose frame threw is 'unavailable' too: with a cached still, the still shows, not the fallback (review SR-2).
    act(() => cb.onStatus('unavailable', { still: true }));
    expect(shown('[data-agent-form-still]')).toBe(true);
    expect(shown('[data-agent-form-canvas]')).toBe(false);
    expect(q('[data-agent-form-placeholder]')).toBeNull();
  });

  it('an engine chunk that fails to load leaves the fallback still', async () => {
    engine.load = vi.fn(async () => { throw new Error('chunk failed'); });
    render(<AgentForm archetype="diversifier" />);
    await flush();
    expect(q('[data-agent-form]').getAttribute('data-agent-form-status')).toBe('unavailable');
    expect(q('[data-agent-form-placeholder]')).not.toBeNull();
  });

  it('unmounting the component unmounts its view, once; a view that loaded after unmount is never mounted', async () => {
    render(<AgentForm archetype="analyst" />);
    await flush();
    act(() => root.render(null));
    expect(engine.mounts[0].unmounts).toBe(1);
    let resolve; engine.load = vi.fn(() => new Promise((r) => { resolve = r; }));
    render(<AgentForm archetype="analyst" />);
    act(() => root.render(null));
    await act(async () => { resolve(fakeEngineModule()); await Promise.resolve(); });
    expect(engine.mounts).toHaveLength(1);
  });

  it('onStatus hears each status', async () => {
    const heard = [];
    render(<AgentForm archetype="analyst" onStatus={(s) => heard.push(s)} />);
    await flush();
    act(() => engine.mounts[0].cb.onStatus('lost', { still: true }));
    expect(heard).toEqual(['live', 'lost']);
  });
});

describe('the archetype → form table (a local literal), allegiance and stages', () => {
  it('maps the six app code ids to the six sets', () => {
    expect(Object.fromEntries(ARCHETYPE_CODE_IDS.map((id) => [id, formForArchetype(id)]))).toEqual({ momentum_chaser: 'trend', contrarian: 'contra', degen: 'spec', guardian: 'preserve', diversifier: 'divers', analyst: 'fund' });
  });

  it('anything else is bare Shadow: missing, the battle doc\'s "unknown", legacy strings, display names, prototype keys, non-strings', () => {
    for (const x of [undefined, null, '', 'unknown', 'momentum', 'Trend Follower', 'MOMENTUM_CHASER', '__proto__', 'toString', 'constructor', 42, {}, ['degen']]) expect(formForArchetype(x)).toBe('none');
  });

  it('allegiance is fixed light: the player teal, everyone else copper and mirrored — never a player colour', () => {
    expect(agentFormSpec({ allegiance: 'player' })).toMatchObject({ pal: 'teal', face: 1 });
    expect(agentFormSpec({ allegiance: 'opponent' })).toMatchObject({ pal: 'copper', face: -1 });
    for (const a of [undefined, 'teal', '#ff00aa', 'gold']) expect(agentFormSpec({ allegiance: a }).pal).toBe('teal');
  });

  it('stages are 1-based (1–3) and anything else is stage 1; moods outside the six are idle', () => {
    expect([1, 2, 3, 0, 4, 2.5, '2', undefined].map(stageIndex)).toEqual([0, 1, 2, 0, 0, 0, 0, 0]);
    expect(agentFormSpec({ mood: 'furious' }).state).toBe('idle');
    expect(agentFormSpec({ size: -5 }).size).toBe(200);
  });

  it('growth is stage 1 on both tracks for every agent until a real source exists (Phase 0 §7)', () => {
    expect(getAgentGrowth('agent-1')).toEqual({ coreStage: 1, armorStage: 1, sources: { core: [], armor: [] } });
    expect(getAgentGrowth('agent-1', { core: [{ a: 1 }], armor: [{ b: 2 }, { c: 3 }] })).toEqual({ coreStage: 1, armorStage: 1, sources: { core: [{ a: 1 }], armor: [{ b: 2 }, { c: 3 }] } });
    expect(getAgentGrowth('agent-1', { core: 'nope', armor: 7 }).sources).toEqual({ core: [], armor: [] });
  });
});

void React;
