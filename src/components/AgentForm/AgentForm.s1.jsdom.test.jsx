// @vitest-environment jsdom
//
// src/components/AgentForm/AgentForm.s1.jsdom.test.jsx
//
// Build S1 — the wrapper's new options, with the engine replaced by a recording stand-in (as AgentForm.jsdom.test.jsx):
// a change of archetype after mount is the engine's swap (only with `equipOnChange`, never at mount); `paused`; `clip`;
// a form under 40 px drawn as a still (ruling R12); the pixel ratio re-read on a window resize; `label={null}`.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({ load: null, mounts: [] }));
vi.mock('./loadEngine', () => ({ loadAgentFormEngine: (...a) => engine.load(...a) }));

import AgentForm from './AgentForm';
import { LIVE_MIN_PX, rateForSize } from './agentFormSpec';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fakeEngineModule() {
  return {
    getAgentFormEngine: () => ({
      mount(els, spec, options, cb) {
        const view = { els, spec, options, calls: [] };
        engine.mounts.push(view);
        cb.onStatus('live', { still: false });
        return {
          update: (p) => view.calls.push(['update', p]),
          swap: (p) => view.calls.push(['swap', p]),
          setOptions: (o) => view.calls.push(['setOptions', o]),
          equip: (on) => view.calls.push(['equip', on]),
          unmount: () => view.calls.push(['unmount']),
        };
      },
    }),
  };
}

let root, host, hadGL, dprDesc;
const render = (el) => act(() => { root.render(el); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const q = (sel) => host.querySelector(sel);
const kinds = (view, verb) => view.calls.filter(([v]) => v === verb).map(([, p]) => p.kind);

beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  engine.mounts = []; engine.load = vi.fn(async () => fakeEngineModule());
  hadGL = Object.hasOwn(globalThis, 'WebGL2RenderingContext');
  globalThis.WebGL2RenderingContext = function WebGL2RenderingContext() {};
  dprDesc = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  if (!hadGL) delete globalThis.WebGL2RenderingContext;
  if (dprDesc) Object.defineProperty(globalThis, 'devicePixelRatio', dprDesc); else delete globalThis.devicePixelRatio;
});

describe('a change of archetype after mount is the engine\'s swap, with equipOnChange (build S1)', () => {
  it('mounts at the current archetype fully on — never a swap at mount — then swaps on each change of form', async () => {
    render(<AgentForm archetype="degen" size={200} equipOnChange />);
    await flush();
    const [v] = engine.mounts;
    expect(v.spec).toMatchObject({ kind: 'spec', fit: 1, unfit: false });
    expect(kinds(v, 'swap')).toEqual([]);
    render(<AgentForm archetype="guardian" size={200} equipOnChange />);
    render(<AgentForm archetype="unknown" size={200} equipOnChange />);
    expect(kinds(v, 'swap')).toEqual(['preserve', 'none']);
    expect(engine.mounts).toHaveLength(1);
  });

  it('a mood, stage or size change with the same form is update(), not a swap', async () => {
    render(<AgentForm archetype="degen" size={200} equipOnChange />);
    await flush();
    const [v] = engine.mounts;
    render(<AgentForm archetype="degen" mood="researching" size={200} equipOnChange />);
    render(<AgentForm archetype="degen" mood="researching" size={260} equipOnChange />);
    expect(kinds(v, 'swap')).toEqual([]);
    expect(kinds(v, 'update')).toEqual(['spec', 'spec']);
  });

  it('without equipOnChange, a change of archetype is update(): the new form at once (the lab\'s behaviour)', async () => {
    render(<AgentForm archetype="degen" size={200} />);
    await flush();
    const [v] = engine.mounts;
    render(<AgentForm archetype="analyst" size={200} />);
    expect(kinds(v, 'swap')).toEqual([]);
    expect(kinds(v, 'update')).toEqual(['fund']);
  });

  it('a change while the engine chunk is still loading is no swap: the view mounts at the latest archetype', async () => {
    render(<AgentForm archetype="degen" size={200} equipOnChange />);
    render(<AgentForm archetype="contrarian" size={200} equipOnChange />);
    await flush();
    const [v] = engine.mounts;
    expect(v.spec.kind).toBe('contra');
    expect(kinds(v, 'swap')).toEqual([]);
    render(<AgentForm archetype="diversifier" size={200} equipOnChange />);
    expect(kinds(v, 'swap')).toEqual(['divers']);
  });
});

describe('paused, clip and the decorative label (build S1)', () => {
  it('paused reaches the engine at mount and on change', async () => {
    render(<AgentForm archetype="degen" size={200} paused />);
    await flush();
    const [v] = engine.mounts;
    expect(v.options.paused).toBe(true);
    render(<AgentForm archetype="degen" size={200} />);
    expect(v.calls.filter(([c]) => c === 'setOptions').at(-1)[1].paused).toBe(false);
  });

  it('clip contains the box\'s paint (the glow stops at its edge); without it the box only isolates', async () => {
    render(<AgentForm archetype="degen" size={200} clip />);
    expect(q('[data-agent-form]').style.contain).toBe('paint');
    expect(q('[data-agent-form]').style.isolation).toBe('isolate');
    render(<AgentForm archetype="degen" size={200} />);
    expect(q('[data-agent-form]').style.contain).toBe('');
  });

  it('label={null} is decorative: no role, no name, hidden from assistive tech; any other label names it', () => {
    render(<AgentForm archetype="degen" size={200} label={null} />);
    expect(q('[data-agent-form]').getAttribute('role')).toBeNull();
    expect(q('[data-agent-form]').getAttribute('aria-label')).toBeNull();
    expect(q('[data-agent-form]').getAttribute('aria-hidden')).toBe('true');
    render(<AgentForm archetype="degen" size={200} label="Shadow wearing Speculator — ambient" />);
    expect(q('[data-agent-form]').getAttribute('role')).toBe('img');
    expect(q('[data-agent-form]').getAttribute('aria-label')).toBe('Shadow wearing Speculator — ambient');
    expect(q('[data-agent-form]').getAttribute('aria-hidden')).toBeNull();
  });
});

describe('under 40 px a form is a still, whatever the rate (ruling R12)', () => {
  it('rateForSize: below LIVE_MIN_PX → still; at or above it the caller\'s rate', () => {
    expect(LIVE_MIN_PX).toBe(40);
    expect(rateForSize('live', 39)).toBe('still');
    expect(rateForSize('half', 24)).toBe('still');
    expect(rateForSize('live', 40)).toBe('live');
    expect(rateForSize('half', 200)).toBe('half');
    expect(rateForSize('live', undefined)).toBe('live');
  });

  it('the wrapper hands the engine the still rate under 40 px, and the live one again at 40', async () => {
    render(<AgentForm archetype="degen" size={36} />);
    await flush();
    const [v] = engine.mounts;
    expect(v.options.rate).toBe('still');
    render(<AgentForm archetype="degen" size={40} />);
    expect(v.calls.filter(([c]) => c === 'setOptions').at(-1)[1].rate).toBe('live');
  });
});

describe('the pixel ratio is re-read on a window resize (the S0 review\'s carry-over §5)', () => {
  it('a resize after a ratio change hands the engine the new ratio; the listener is gone after unmount', async () => {
    Object.defineProperty(globalThis, 'devicePixelRatio', { value: 2, configurable: true, writable: true });
    render(<AgentForm archetype="degen" size={200} />);
    await flush();
    const [v] = engine.mounts;
    expect(v.options.dpr).toBe(2);
    globalThis.devicePixelRatio = 3;
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(v.calls.filter(([c]) => c === 'setOptions').at(-1)[1].dpr).toBe(3);
    const remove = vi.spyOn(window, 'removeEventListener');
    act(() => root.unmount());
    expect(remove.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
    remove.mockRestore();
    root = createRoot(host);
  });
});
