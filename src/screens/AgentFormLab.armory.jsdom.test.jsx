// @vitest-environment jsdom
//
// src/screens/AgentFormLab.armory.jsdom.test.jsx
//
// Agent form build A1 — the lab's four armory presets (FD-9 is decided on the founder's phone with them), with the
// wrapper replaced by a recording stand-in so each view's props can be read (jsdom has no WebGL, so the real wrapper
// draws only its still). The mixed presets: one live view and six stills; the all-live presets: seven at the Rate
// control's rate. The first view is Shadow in the Form control's set; the six after it are the sets alone, pewter but
// for the one Shadow wears.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ props: new Map() }));
vi.mock('../components/AgentForm/AgentForm', () => ({
  default: function AgentFormProbe(props) { seen.props.set(props.onStatus, props); return null; },
}));

import AgentFormLab from './AgentFormLab';
import { ARCHETYPE_CODE_IDS, SET_ALONE, UNLIT } from '../components/AgentForm/agentFormSpec';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
beforeEach(() => { seen.props = new Map(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); act(() => root.render(<AgentFormLab />)); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const button = (text) => [...host.querySelectorAll('button')].find((b) => b.textContent === text);
const click = (text) => act(() => { seen.props = new Map(); button(text).click(); });
const views = () => [...seen.props.values()];

describe('the armory presets (build A1, FD-9)', () => {
  it.each([
    ['Armory phone: 1 live at 160 + 6 stills at 48', 160, 48, 'still'],
    ['Armory desktop: 1 live at 300 + 6 stills at 112', 300, 112, 'still'],
    ['Armory phone, all live: 160 + 6 at 48', 160, 48, 'live'],
    ['Armory desktop, all live: 300 + 6 at 112', 300, 112, 'live'],
  ])('%s', (label, centre, set, setRate) => {
    click(label);
    const v = views();
    expect(v).toHaveLength(7);
    const [shadow, ...sets] = v;
    expect(shadow).toMatchObject({ size: centre, rate: 'live', coreStage: 1, allegiance: 'player', archetype: 'momentum_chaser' });
    expect(sets.map((p) => p.archetype)).toEqual([...ARCHETYPE_CODE_IDS]);
    for (const p of sets) {
      expect(p.size).toBe(set);
      expect(p.rate).toBe(setRate);
      expect(p.coreStage).toBe(SET_ALONE);
      expect(p.allegiance).toBe(p.archetype === 'momentum_chaser' ? 'player' : UNLIT);
    }
    expect(host.textContent).toContain(`armory sets ${setRate === 'still' ? 'stills' : 'live'}`);
  });

  it('a custom layout leaves the armory: every view is Shadow again, at the one rate', () => {
    click('Armory phone: 1 live at 160 + 6 stills at 48');
    click('1 hero at 200');
    expect(views()).toHaveLength(1);
    expect(views()[0]).toMatchObject({ size: 200, coreStage: 1, rate: 'live' });
    expect(host.textContent).toContain('armory sets none');
  });
});
