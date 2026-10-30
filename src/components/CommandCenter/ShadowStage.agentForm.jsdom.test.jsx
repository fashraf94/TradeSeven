// @vitest-environment jsdom
//
// src/components/CommandCenter/ShadowStage.agentForm.jsdom.test.jsx
//
// Agent form build S1 (Scope A) — both stage sites with AGENT_FORM_HUB_ENABLED driven per row: on, the armored hero
// (HubAgentForm) where ShadowCanvas was, in the same box the connector measures; off, today's ShadowCanvas. The hero's
// own rows are HubAgentForm.jsdom.test.jsx; the wrapper is a recording stand-in here. And the one scope that hands the
// hero the hub's agent read is the readers' read, the one the Loadout shows (display agreement, BUILD_RULES §9).

import React, { Component, act } from 'react';
import { readFileSync } from 'node:fs';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectTokens } from './__fixtures__/hubTestKit';

const flags = vi.hoisted(() => ({ hub: false }));
const seen = vi.hoisted(() => ({ forms: [] }));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), get AGENT_FORM_HUB_ENABLED() { return flags.hub; } }));
// The stage reads the deploy provider's progress store, whose module loads the Firebase client (the reviewFixes suite's stand-in).
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class AgentFormProbe extends Component {
    render() { seen.forms.push(this.props); return <i data-test-form="1" />; }
  },
}));

const { PhoneStage, ShadowStage } = await import('./ShadowStage');
const { AGENT_FORM_PHONE } = await import('./hub/hubFlags');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root, host;
beforeEach(() => { injectTokens(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); seen.forms = []; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const SUMMARIES = ['Not in this release', 'Loading', 'Speculator'];
const wide = (props = {}) => act(() => { root.render(<ShadowStage composition="desktop" size={340} tier="mid" status="ambient" processing={false} words="Idle" selectedArea={2} onSelectArea={() => {}} summaries={SUMMARIES} idBase="hubt" reducedMotion={false} {...props} />); });
const phone = (props = {}) => act(() => { root.render(<PhoneStage size={200} tier="low" status="ambient" processing={false} words="Idle" selectedArea={2} summaries={SUMMARIES} reducedMotion={false} {...props} />); });

describe('flag on: the armored hero at both sites', () => {
  beforeEach(() => { flags.hub = true; });

  it('the wide stage: the hero in Shadow\'s box (340), no ShadowCanvas, live rate', () => {
    wide();
    expect(host.querySelector('[data-hub-agent-form]')).not.toBeNull();
    expect(host.querySelector('[data-shadow-canvas]')).toBeNull();
    expect(seen.forms.at(-1)).toMatchObject({ size: 340, rate: 'live' });
    const box = host.querySelector('[data-shadow-box]');
    expect(box.style.width).toBe('340px');
  });

  it('the phone stage: the hero at 200, at the phone\'s one rate', () => {
    phone();
    expect(host.querySelector('[data-hub-agent-form]')).not.toBeNull();
    expect(host.querySelector('[data-shadow-canvas]')).toBeNull();
    expect(seen.forms.at(-1)).toMatchObject({ size: 200, rate: AGENT_FORM_PHONE });
  });

  it('the stage\'s status, selection, reduced motion and pause reach the hero', () => {
    wide({ status: 'processing', reducedMotion: true, paused: true });
    expect(seen.forms.at(-1)).toMatchObject({ mood: 'researching', reducedMotion: true, paused: true });
  });
});

describe('flag off: today\'s ShadowCanvas at both sites', () => {
  beforeEach(() => { flags.hub = false; });

  it('no hero, no form', () => {
    wide();
    phone();
    expect(host.querySelector('[data-hub-agent-form]')).toBeNull();
    expect(seen.forms).toHaveLength(0);
  });
});

describe('the hero\'s read is the readers\' agent read — the one the Loadout shows', () => {
  it('CommandCenterHub provides readers.agent, the same read handed to both shells as agentRead', () => {
    const hub = readFileSync('src/components/CommandCenter/CommandCenterHub.jsx', 'utf8').replace(/\r\n/g, '\n');
    expect(hub).toContain('<HubAgentFormContext.Provider value={readers.agent}>');
    expect(hub.match(/agentRead=\{readers\.agent\}/g)).toHaveLength(4);
  });
});
