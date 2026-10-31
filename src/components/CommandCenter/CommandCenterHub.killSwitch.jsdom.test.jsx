// @vitest-environment jsdom
//
// src/components/CommandCenter/CommandCenterHub.killSwitch.jsdom.test.jsx
//
// The hub's kill switch (founder ruling F2, Oct 30, 2026). AGENT_FORM_HUB_ENABLED stays in the code so one line rolls the
// hero back, and that only holds while the old path works. So: with the flag false, the real hub draws ShadowCanvas where
// the hero is, at its sizes and tiers, with its labels and its response, and the screen around it still works. The rest
// of ShadowCanvas's contract is its own suites' (ShadowCanvas.jsdom.test.jsx, ShadowCanvas.contract.jsdom.test.jsx); what
// the hub hands the hero is CommandCenterHub.s7.jsdom.test.jsx.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ reduced: false }));

vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_HUB_ENABLED: false }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../hooks/useDailyRegimeBrief', () => ({
  default: function useDailyRegimeBrief() {
    return { dailyBrief: null, forDate: null, generatedAt: null, isStale: false, loading: true, error: null, refetch: () => {} };
  },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { displayName: 'Flash', username: 'flash' } }) }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => h.reduced }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_LAYOUT_FIXTURES } from './__fixtures__/hubLayoutFixtures';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav } from './__fixtures__/hubTestKit';
import { installFakeCanvas } from './__fixtures__/shadowCanvasKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let layout, removeTokens, removeNav, kit;
let mounted = [];

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  h.reduced = false;
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
  kit = installFakeCanvas();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
  kit.restore();
  vi.restoreAllMocks();
});

const fixture = (name) => HUB_LAYOUT_FIXTURES[name].sections;
const box = () => document.querySelector('[data-shadow-box]');
const label = () => box().getAttribute('data-shadow-status');
const status = () => document.querySelector('[data-hub-status]').textContent;
const strokes = () => kit.log.frames.at(-1).strokes;
const tick = (n = 1) => { for (let i = 0; i < n; i += 1) kit.tick(16); };

function renderFrame({ site, hubWidth, sections = fixture('returning') }) {
  layout.state.hubWidth = hubWidth;
  const m = mount(<CommandCenterHub site={site} sections={sections} />);
  mounted.push(m);
  return m;
}

/** The runs of consecutive frames that draw the center bloom's glow (radius R × 0.3, R = size / 2.5): one run per response. */
function bloomRuns(size) {
  const { log } = kit.contexts.at(-1);
  const glow = (size / 2.5) * 0.3;
  let offset = 0;
  const present = log.frames.map((f) => {
    const arcs = log.arcs.slice(offset, offset + f.arcs);
    offset += f.arcs;
    return arcs.some(([, , r]) => Math.abs(r - glow) < 1e-9);
  });
  return present.filter((p, i) => p && !present[i - 1]).length;
}

describe('flag off: the hub draws ShadowCanvas again', () => {
  it.each([[1216, 340, 126], [770, 260, 126], [614, 260, 126]])('the wide site, a %i px hub: the canvas at %i px, tier mid, and no armored hero', (hubWidth, size, count) => {
    renderFrame({ site: 'desktop', hubWidth });
    expect(box().hasAttribute('data-shadow-canvas')).toBe(true);
    expect(box().hasAttribute('data-hub-agent-form')).toBe(false);
    expect(box().style.width).toBe(`${size}px`);
    expect(strokes()).toBe(count);
  });

  it.each([[390, 200], [360, 196]])('the phone at %i px: the canvas at %i px, tier low', (hubWidth, size) => {
    renderFrame({ site: 'mobile', hubWidth });
    expect(box().hasAttribute('data-shadow-canvas')).toBe(true);
    expect(box().style.width).toBe(`${size}px`);
    expect(strokes()).toBe(30);
  });

  it('labels the state and the selected area on the canvas, as it always has', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216 });
    expect(document.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient; Equipped Archetype selected');
    expect(label()).toBe('ambient');
  });

  it('a submitting deployment draws processing', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216, sections: { ...fixture('returning'), deploy: { displayState: 'submitting', canStart: false } } });
    expect(label()).toBe('processing');
    expect(status()).toBe(COPY.shadow.statusSubmitting);
  });

  it('reduced motion draws the still, and no canvas context is ever asked for', () => {
    h.reduced = true;
    renderFrame({ site: 'desktop', hubWidth: 1216 });
    expect(document.querySelector('canvas')).toBeNull();
    expect(box().querySelector('svg')).not.toBeNull();
    expect(box().getAttribute('data-shadow-reduced-motion')).toBe('true');
    expect(label()).toBe('still');
    expect(kit.contexts).toHaveLength(0);
  });

  it('with no canvas context, the still, labelled "still"', () => {
    kit.state.context = 'null';
    renderFrame({ site: 'desktop', hubWidth: 1216 });
    expect(document.querySelector('canvas')).toBeNull();
    expect(label()).toBe('still');
  });

  it('a new area blooms once; the same area again does not', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216 });
    const tabs = () => [...document.querySelectorAll('[data-hub-slot="stage"] [role="tab"]')];
    tick(3);
    expect(bloomRuns(340)).toBe(0);
    click(tabs().find((t) => t.getAttribute('aria-selected') === 'false'));
    tick(80);
    expect(bloomRuns(340)).toBe(1);
    click(tabs().find((t) => t.getAttribute('aria-selected') === 'true'));
    tick(80);
    expect(bloomRuns(340)).toBe(1);
  });
});

describe('flag off: the screen around it still works', () => {
  it('the status line is the one live region, and it speaks', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216 });
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(status()).toBe('Idle · nothing running');
  });

  it('the wide hub has its stage, its Deploy card and its sheets', () => {
    renderFrame({ site: 'desktop', hubWidth: 1216 });
    expect(document.querySelector('[data-hub-stage="desktop"]')).not.toBeNull();
    expect(document.querySelector('[data-hub-deploy]')).not.toBeNull();
    click(byRole(document, 'button', COPY.games.history)[0]);
    expect(document.querySelector('[data-hub-sheet-overlay]')).not.toBeNull();
  });

  it('the phone has its stage and its tabs, and a tab relabels Shadow', () => {
    renderFrame({ site: 'mobile', hubWidth: 390 });
    expect(document.querySelector('[data-hub-stage="phone"]')).not.toBeNull();
    expect(document.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient');
    click(byRole(document, 'tab', COPY.phoneTabs.research)[0]);
    expect(document.querySelector('canvas').getAttribute('aria-label')).toBe('Shadow — ambient; Shared Research selected');
  });
});
