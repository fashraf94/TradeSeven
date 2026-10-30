// @vitest-environment jsdom
//
// src/components/CommandCenter/HubAgentForm.jsdom.test.jsx
//
// Agent form build S1 (Scope A) — the hub's armored hero, with the wrapper replaced by a recording stand-in (the
// wrapper's own rows are AgentForm.s1.jsdom.test.jsx; the engine's swap is engine.lifecycle.jsdom.test.js). What the
// hero hands the form: the agent read's archetype, the suit-up only between two READY reads of the SAME agent (the
// form is remounted — so drawn at once — on the first answer, an agent or account switch and a remount), the mood,
// the rate (rulings R1, R6d), growth stage 1 (R7), teal (R11), batched (R2), the CSS glow clipped at the box (R3),
// the pause (R-S7-5), and the accessible name (R10). And the box the stage measures is exactly size × size.

import React, { Component, act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ renders: [], mounts: 0, unmounts: 0 }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    componentDidMount() { seen.mounts += 1; }
    componentWillUnmount() { seen.unmounts += 1; }
    render() { seen.renders.push(this.props); return null; }
  },
}));

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import HubAgentForm, { HubAgentFormContext, hubFormRate, hubFormRead, hubResponsePart } from './HubAgentForm';
import { FLASH_MS } from './ShadowCanvas';
import { HUB_AREAS } from './hub/composition';
import { BLOOM_SECONDS } from './hub/shadowCanvas';
import { RESPONSE_FLASH_LIFT, RESPONSE_FLASH_MS, RESPONSE_MS } from '../AgentForm/engine/vocab';
import { AGENT_FORM_PHONE } from './hub/hubFlags';
import { HUB_COPY } from './hub/hubCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const here = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), name);

let root, host;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.renders = []; seen.mounts = 0; seen.unmounts = 0; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const ready = (id, archetype) => ({ status: 'ready', agent: { id, archetype } });
function show(read, props = {}) {
  act(() => {
    root.render(
      <HubAgentFormContext.Provider value={read}>
        <HubAgentForm size={340} status="ambient" {...props} />
      </HubAgentFormContext.Provider>,
    );
  });
  return seen.renders.at(-1);
}

describe('the read: what the form shows, and the key its suit-ups are kept under', () => {
  it('hubFormRead: nothing until the read is ready; then the archetype and the agent\'s key', () => {
    expect(hubFormRead(null)).toEqual({ archetype: undefined, key: 'pending' });
    expect(hubFormRead({ status: 'loading', agent: null })).toEqual({ archetype: undefined, key: 'pending' });
    expect(hubFormRead({ status: 'error', agent: { id: 'a1', archetype: 'degen' } })).toEqual({ archetype: undefined, key: 'pending' });
    expect(hubFormRead(ready('a1', 'degen'))).toEqual({ archetype: 'degen', key: 'agent:a1' });
    expect(hubFormRead({ status: 'ready', agent: null })).toEqual({ archetype: undefined, key: 'agent:none' });
  });

  it('the suit-up plays only between two ready reads of the same agent: every other change remounts the form', () => {
    show({ status: 'loading', agent: null });
    expect(seen.mounts).toBe(1);
    // the first answer: a remount, so the armored form simply shows (the engine never plays a change at mount)
    expect(show(ready('a1', 'degen')).archetype).toBe('degen');
    expect(seen.mounts).toBe(2);
    // the same agent changes archetype: the same mounted form, told to play the change
    const p = show(ready('a1', 'guardian'));
    expect(seen.mounts).toBe(2);
    expect(p.archetype).toBe('guardian');
    expect(p.equipOnChange).toBe(true);
    // another agent (an account switch): a remount, drawn at once
    show(ready('b2', 'analyst'));
    expect(seen.mounts).toBe(3);
    // a read that fails, then answers again: two remounts, no suit-up
    show({ status: 'error', agent: null });
    show(ready('b2', 'contrarian'));
    expect(seen.mounts).toBe(5);
    // the stage remounting the hero (a width change, a return to the hub) mounts it afresh
    act(() => root.unmount()); root = createRoot(host);
    show(ready('b2', 'contrarian'));
    expect(seen.mounts).toBe(6);
  });

  it('no read at all (an unconnected hub, the S1 frames): bare Shadow', () => {
    act(() => { root.render(<HubAgentForm size={260} />); });
    expect(seen.renders.at(-1).archetype).toBeUndefined();
  });
});

describe('what the form is handed', () => {
  it('the hub\'s look: teal, stage 1, batched, the CSS glow clipped at the box, the size, idle; researching while a hub deploy submits', () => {
    const p = show(ready('a1', 'degen'));
    expect(p).toMatchObject({ allegiance: 'player', coreStage: 1, armorStage: 1, batched: true, bloom: 'css', clip: true, size: 340, mood: 'idle', rate: 'live', paused: false, reducedMotion: false });
    // The design's framing: the battle views' tight framing (the S1 size follow-up) is never asked for here.
    expect(p.framing).toBeUndefined();
    expect(show(ready('a1', 'degen'), { status: 'processing' }).mood).toBe('researching');
  });

  it('the rate: the phone\'s one constant, live on every wider stage — nothing measured picks it (R1, R6d)', () => {
    expect(hubFormRate(true)).toBe(AGENT_FORM_PHONE);
    expect(hubFormRate(false)).toBe('live');
    expect(show(ready('a1', 'degen'), { phone: true, size: 200 }).rate).toBe(AGENT_FORM_PHONE);
  });

  it('the hub\'s one reduced-motion source and its pause reach the form', () => {
    const p = show(ready('a1', 'degen'), { reducedMotion: true, paused: true });
    expect(p.reducedMotion).toBe(true);
    expect(p.paused).toBe(true);
  });
});

describe('the accessible name (R10): "Shadow wearing <archetype>", with the state and the selected area', () => {
  const names = HUB_COPY.areas.names;
  it('armored: the archetype\'s display name; still until the form reports live, then ambient or processing', () => {
    expect(show(ready('a1', 'degen')).label).toBe('Shadow wearing Speculator — still');
    act(() => { seen.renders.at(-1).onStatus('live'); });
    expect(seen.renders.at(-1).label).toBe('Shadow wearing Speculator — ambient');
    expect(show(ready('a1', 'degen'), { status: 'processing', selectedArea: 2 }).label).toBe(`Shadow wearing Speculator — processing; ${names[2]} selected`);
    expect(show(ready('a1', 'degen'), { reducedMotion: true }).label).toBe('Shadow wearing Speculator — still');
    act(() => { seen.renders.at(-1).onStatus('lost'); });
    expect(seen.renders.at(-1).label).toBe('Shadow wearing Speculator — still');
  });

  it('a re-keyed form starts again from "still": the label waits for the new form to report itself live (BUILD_RULES §9)', () => {
    show(ready('a1', 'degen'));
    act(() => { seen.renders.at(-1).onStatus('live'); });
    expect(seen.renders.at(-1).label).toBe('Shadow wearing Speculator — ambient');
    // another agent: a new form, whose placeholder shows until it reports
    expect(show(ready('b2', 'analyst')).label).toBe('Shadow wearing Fundamental Investor — still');
    act(() => { seen.renders.at(-1).onStatus('live'); });
    expect(seen.renders.at(-1).label).toBe('Shadow wearing Fundamental Investor — ambient');
  });

  it('bare Shadow (no archetype, "unknown", a legacy key) keeps Shadow\'s own label — never "wearing Unknown"', () => {
    for (const archetype of [undefined, 'unknown', 'momentum']) {
      const label = show(ready('a1', archetype)).label;
      expect(label, String(archetype)).toBe(HUB_COPY.shadow.imageLabel('still', null));
      expect(label).not.toMatch(/wearing/);
    }
  });
});

describe('the box the stage measures', () => {
  it('is one size × size element, handed back through boxRef, holding the form', () => {
    const boxRef = createRef();
    show(ready('a1', 'degen'), { boxRef, size: 260 });
    expect(boxRef.current).toBe(host.querySelector('[data-hub-agent-form]'));
    expect(boxRef.current.style.width).toBe('260px');
    expect(boxRef.current.style.height).toBe('260px');
    expect(boxRef.current.getAttribute('data-shadow-box')).toBe('');
  });
});

// Build S2 (ruling R19): S7's response on the armored hero. ShadowCanvas's own rows (CommandCenterHub.s7.jsdom.test.jsx)
// pin the triggers on today's Shadow; these hold the hero to the same ones, and the engine's rows to the same numbers.
describe('the response: S7\'s triggers and timing, and board 5\'s parts', () => {
  const D = ready('a1', 'degen');
  const answers = () => seen.renders.at(-1).responseKey;

  it('holds the numbers equal to S7\'s: the bloom\'s 1.2 s, the still\'s 420 ms and ×1.25', () => {
    expect(RESPONSE_MS).toBe(BLOOM_SECONDS * 1000);
    expect(RESPONSE_FLASH_MS).toBe(FLASH_MS);
    expect(RESPONSE_FLASH_LIFT).toBe(1.25);
    expect(readFileSync(here('ShadowStill.jsx'), 'utf8')).toContain('flash ? 1.25 : 1');
  });

  it('a trigger already there at mount is the past', () => {
    show(D, { areaEvent: 4, createdAttemptId: 'attempt-1', selectedArea: 0 });
    expect(answers()).toBe(0);
  });

  it('a new area selection answers once; the same selection re-rendered does not', () => {
    show(D, { areaEvent: 0, selectedArea: 0 });
    show(D, { areaEvent: 1, selectedArea: 1 });
    expect(answers()).toBe(1);
    show(D, { areaEvent: 1, selectedArea: 1 });
    expect(answers()).toBe(1);
    show(D, { areaEvent: 2, selectedArea: 2 });
    expect(answers()).toBe(2);
  });

  it('a created terminal answers once per attempt id; its absence is nothing', () => {
    show(D, { createdAttemptId: null });
    show(D, { createdAttemptId: 'attempt-1' });
    expect(answers()).toBe(1);
    show(D, { createdAttemptId: 'attempt-1' });
    expect(answers()).toBe(1);
    show(D, { createdAttemptId: null });
    expect(answers()).toBe(1);
    show(D, { createdAttemptId: 'attempt-2' });
    expect(answers()).toBe(2);
  });

  it('a remount of the form does not read its triggers as new: the memo is above the key', () => {
    show(D, { areaEvent: 0, selectedArea: 0 });
    show(D, { areaEvent: 1, selectedArea: 1 });
    const mounts = seen.mounts;
    show(ready('a2', 'degen'), { areaEvent: 1, selectedArea: 1 });
    expect(seen.mounts).toBe(mounts + 1);
    expect(answers()).toBe(1);
  });

  it('board 5 says what lights: Equipped Archetype the armor, Partnership and Shared Research the core', () => {
    show(D, { areaEvent: 0, selectedArea: 0 });
    show(D, { areaEvent: 1, selectedArea: HUB_AREAS.ARCHETYPE });
    expect(seen.renders.at(-1).responsePart).toBe('armor');
    show(D, { areaEvent: 2, selectedArea: HUB_AREAS.PARTNERSHIP });
    expect(seen.renders.at(-1).responsePart).toBe('core');
    show(D, { areaEvent: 3, selectedArea: HUB_AREAS.RESEARCH });
    expect(seen.renders.at(-1).responsePart).toBe('core');
  });

  it('board 5 is silent on a deploy and on bare Shadow\'s armor: those light the whole form', () => {
    expect(hubResponsePart({ created: true, area: HUB_AREAS.ARCHETYPE, armored: true })).toBe('all');
    expect(hubResponsePart({ created: true, area: HUB_AREAS.PARTNERSHIP, armored: true })).toBe('all');
    expect(hubResponsePart({ created: false, area: HUB_AREAS.ARCHETYPE, armored: false })).toBe('all');
    expect(hubResponsePart({ created: false, area: HUB_AREAS.PARTNERSHIP, armored: false })).toBe('core');
    expect(hubResponsePart({ created: false, area: null, armored: true })).toBe('all');
    show(D, { selectedArea: 2 });
    show(D, { selectedArea: 2, createdAttemptId: 'attempt-1' });
    expect(seen.renders.at(-1).responsePart).toBe('all');
  });

  it('the hero holds no effect or timer for it: the timing, the pause and reduced motion are the engine\'s', () => {
    expect(readFileSync(here('HubAgentForm.jsx'), 'utf8').replace(/\/\/.*$/gm, '')).not.toMatch(/useEffect|setTimeout|matchMedia/);
  });
});
