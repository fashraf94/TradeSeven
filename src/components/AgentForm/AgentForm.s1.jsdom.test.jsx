// @vitest-environment jsdom
//
// src/components/AgentForm/AgentForm.s1.jsdom.test.jsx
//
// Build S1 — the wrapper's new options, with the engine replaced by a recording stand-in (as AgentForm.jsdom.test.jsx):
// a change of archetype after mount is the engine's swap (only with `equipOnChange`, never at mount); `paused`; `clip`;
// a form under 40 px drawn as a still (ruling R12); the pixel ratio re-read on a window resize; `label={null}`. And the
// S1 size follow-up's tight framing: only the battle form asks for it, and without it the spec carries no zoom.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engine = vi.hoisted(() => ({ load: null, mounts: [] }));
vi.mock('./loadEngine', () => ({ loadAgentFormEngine: (...a) => engine.load(...a) }));

import AgentForm from './AgentForm';
import { LIVE_MIN_PX, rateForSize, agentFormSpec } from './agentFormSpec';

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
          respond: (part) => view.calls.push(['respond', part]),
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

describe('the tight framing: the battle views\' option, and theirs alone (the S1 size follow-up)', () => {
  const CODE = { none: undefined, trend: 'momentum_chaser', contra: 'contrarian', spec: 'degen', preserve: 'guardian', divers: 'diversifier', fund: 'analyst' };

  it('agentFormSpec: no zoom unless the tight framing is asked for; then the measured table, per form', () => {
    for (const archetype of Object.values(CODE)) {
      for (const allegiance of ['player', 'opponent']) {
        for (const framing of [undefined, 'design', 'TIGHT', true]) expect(agentFormSpec({ archetype, allegiance, framing })).not.toHaveProperty('zoom');
      }
    }
    expect(Object.fromEntries(Object.entries(CODE).map(([k, archetype]) => [k, agentFormSpec({ archetype, framing: 'tight' }).zoom])))
      .toEqual({ none: .9, trend: 1, contra: .95, spec: 1, preserve: 1, divers: 1, fund: .95 });
    expect(agentFormSpec({ archetype: 'contrarian', allegiance: 'opponent', framing: 'tight' })).toMatchObject({ kind: 'contra', pal: 'copper', face: -1, zoom: .95 });
  });

  it('the wrapper: tight mounts and patches with the form\'s zoom; without it the mount has none and every patch the engine\'s own 1', async () => {
    render(<AgentForm archetype="contrarian" size={60} framing="tight" />);
    await flush();
    const [tight] = engine.mounts;
    expect(tight.spec.zoom).toBe(.95);
    render(<AgentForm archetype="degen" size={60} framing="tight" />);
    expect(tight.calls.filter(([c]) => c === 'update').at(-1)[1]).toMatchObject({ kind: 'spec', zoom: 1 });
    render(<AgentForm size={60} framing="tight" />);
    expect(tight.calls.filter(([c]) => c === 'update').at(-1)[1]).toMatchObject({ kind: 'none', zoom: .9 });
    act(() => root.unmount()); root = createRoot(host);

    render(<AgentForm archetype="contrarian" size={340} />);
    await flush();
    const plain = engine.mounts[1];
    expect(plain.spec).not.toHaveProperty('zoom');
    render(<AgentForm size={340} mood="researching" />);
    const patches = plain.calls.filter(([c]) => c === 'update').map(([, p]) => p);
    expect(patches.length).toBeGreaterThan(0);
    for (const p of patches) expect(p.zoom).toBe(1);
  });

  it('of the files that draw the wrapper, only the battle and League forms ask for a framing: the hub, the lab and S0\'s stills keep the design\'s', () => {
    const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const files = [];
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (statSync(abs).isDirectory()) { if (name !== 'node_modules') walk(abs); } else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) files.push(abs);
      }
    }(SRC));
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');
    const ASKS = /\bframing\s*[=:]/g;
    const draws = files.filter((f) => /from '([^']*\/AgentForm\/|\.\/)AgentForm'/.test(readFileSync(f, 'utf8')) && !f.endsWith(`${path.sep}AgentForm.jsx`));
    const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');
    expect(draws.map(rel).sort()).toEqual(['components/CommandCenter/HubAgentForm.jsx', 'components/League/battleArena/LeagueAgentForm.jsx', 'screens/AgentFormLab.jsx', 'screens/battleView/BattleAgentForm.jsx']);
    const asks = Object.fromEntries(draws.map((f) => [rel(f), (strip(readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).match(ASKS) || []).length]));
    expect(asks).toEqual({ 'components/CommandCenter/HubAgentForm.jsx': 0, 'components/League/battleArena/LeagueAgentForm.jsx': 1, 'screens/AgentFormLab.jsx': 0, 'screens/battleView/BattleAgentForm.jsx': 1 });
    expect(readFileSync(path.join(SRC, 'screens/battleView/BattleAgentForm.jsx'), 'utf8')).toContain('framing="tight"');
    // The scan sees a planted ask, as a prop and as a key.
    expect(strip('<AgentForm framing="tight" />\nconst p = { framing: \'tight\' };').match(ASKS)).toHaveLength(2);
  }, 30000); // every file under src/ is read: the repo's idiom for a whole-tree scan, so a loaded suite cannot time it out
});

// Build S2: the response (ruling R19) and a layout's facing (ruling R14).
describe('build S2: the wrapper', () => {
  it('a new response key asks the view for that part; the key it mounted with does not, nor a re-render', async () => {
    const asked = (view) => view.calls.filter(([verb]) => verb === 'respond').map(([, part]) => part);
    render(<AgentForm archetype="degen" size={200} responseKey={3} responsePart="core" />);
    await flush();
    const [v] = engine.mounts;
    expect(asked(v)).toEqual([]);
    render(<AgentForm archetype="degen" size={200} responseKey={3} responsePart="core" mood="worried" />);
    expect(asked(v)).toEqual([]);
    render(<AgentForm archetype="degen" size={200} responseKey={4} responsePart="armor" />);
    expect(asked(v)).toEqual(['armor']);
  });

  it('a key that moves before the engine has loaded is the past: nothing plays when the view appears', async () => {
    render(<AgentForm archetype="degen" size={200} responseKey={1} />);
    render(<AgentForm archetype="degen" size={200} responseKey={2} responsePart="core" />);
    await flush();
    expect(engine.mounts[0].calls.filter(([verb]) => verb === 'respond')).toEqual([]);
  });

  it('facing overrides the mirror, for either allegiance; without it the player looks right and the opponent left', () => {
    expect(agentFormSpec({ allegiance: 'player' }).face).toBe(1);
    expect(agentFormSpec({ allegiance: 'opponent' }).face).toBe(-1);
    expect(agentFormSpec({ allegiance: 'opponent', facing: 'right' }).face).toBe(1);
    expect(agentFormSpec({ allegiance: 'player', facing: 'left' }).face).toBe(-1);
    expect(agentFormSpec({ allegiance: 'opponent', facing: 'sideways' }).face).toBe(-1);
    expect(agentFormSpec({ allegiance: 'opponent', facing: 'right' }).pal).toBe('copper');
  });
});
