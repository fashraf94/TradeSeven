// @vitest-environment jsdom
//
// Command Center hub, slice S1 — rows for the §2 review's fixes (S1 build
// report §6): accessibility (L3) and design fidelity (L1). Same harness as
// CommandCenterHub.jsdom.test.jsx: __fixtures__/hubTestKit.js stands in for
// layout; the real geometry is measured in headless Edge for the report.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_LAYOUT_FIXTURES, HUB_LAYOUT_FIXTURE_NAMES } from './__fixtures__/hubLayoutFixtures';
import { byRole, byText, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let layout;
let removeTokens;
let removeNav;
let mounted = [];

beforeAll(() => { removeTokens = injectTokens(); });
afterAll(() => { removeTokens(); });
beforeEach(() => {
  layout = installFakeLayout();
  removeNav = mountFakeBottomNav();
});
afterEach(() => {
  for (const m of mounted) m.unmount();
  mounted = [];
  removeNav();
  layout.restore();
});

const hubRoot = () => document.querySelector('[data-hub="shell"]');
const fixture = (name) => HUB_LAYOUT_FIXTURES[name].sections;
const selectedTabs = (scope) => byRole(scope, 'tab').filter((t) => t.getAttribute('aria-selected') === 'true');

function renderHub({ site, hubWidth, sections }) {
  layout.state.hubWidth = hubWidth;
  const m = mount(<CommandCenterHub site={site} sections={sections} />);
  mounted.push(m);
  return m;
}

function unmountAll() {
  for (const m of mounted) m.unmount();
  mounted = [];
}

const SHELLS = [['mobile', 360], ['mobile', 390], ['desktop', 770], ['desktop', 614], ['desktop', 1216], ['desktop', 1060]];

describe('S1 review fixes — accessibility (L3)', () => {
  it('L3-1: a width change that switches the composition keeps keyboard focus on the same area tab', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    const tab = selectedTabs(host)[0];
    const id = tab.id;
    tab.focus();
    for (const width of [960, 614, 770, 1216]) {
      layout.resize({ hubWidth: width });
      expect(document.activeElement?.id, `after ${width}`).toBe(id);
    }
  });

  it('L3-1: a focused element with no id lands on the hub root, not on <body>', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    const [loadoutLink] = byRole(host.querySelector('[data-hub-deploy]'), 'button', COPY.deploy.loadoutLink);
    loadoutLink.focus();
    layout.resize({ hubWidth: 770 });
    expect(document.activeElement).toBe(hubRoot());
  });

  it('L3-1: focus that had left the hub is not pulled back by a later switch', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    selectedTabs(host)[0].focus();
    outside.focus();
    layout.resize({ hubWidth: 770 });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('L3-4: both tabpanels take a tab stop', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(document.querySelector('[role="tabpanel"]').tabIndex).toBe(0);
    unmountAll();
    renderHub({ site: 'mobile', hubWidth: 390 });
    expect(document.querySelector('[role="tabpanel"]').tabIndex).toBe(0);
  });

  it('L3-5: the phone pane keeps focused rows clear of the sticky tab row and of the strip and nav', () => {
    layout.state.navHeight = 64;
    layout.state.stripHeight = 66;
    renderHub({ site: 'mobile', hubWidth: 390 });
    expect(hubRoot().style.scrollPaddingTop).toBe('56px');
    expect(hubRoot().style.scrollPaddingBottom).toBe('130px');
  });

  it('L3-6: the hold is named by its instruction while it offers the hold, and by its label once it reports a phase', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(byRole(document.querySelector('[data-hub-deploy]'), 'button', COPY.deploy.holdLabel)).toHaveLength(1);
    unmountAll();
    renderHub({ site: 'desktop', hubWidth: 1216, sections: { ...fixture('returning'), deploy: { displayState: 'submitting', canStart: false } } });
    const [hold] = byRole(document.querySelector('[data-hub-deploy]'), 'button', COPY.deploy.holdSubmitting);
    expect(hold.textContent).toContain(COPY.deploy.holdSubmitting);
  });

  it('L3-7: "Later" is named by its own word', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    const [later] = byRole(host.querySelector('[data-hub-next-action]'), 'button', COPY.nextAction.later);
    expect(later.hasAttribute('aria-label')).toBe(false);
  });

  it('L3-8: a game row\'s name carries its review and its detail line', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    const names = byRole(host.querySelector('[data-hub-section="games"]'), 'button').map((b) => b.getAttribute('aria-label') || '');
    expect(names.find((n) => /Contrarian/.test(n))).toBe('Open game record: BaggerBomb vs CPU — Contrarian, Lost −101, review available, Oct 3');
  });

  it('L3-9: a modified arrow belongs to the browser — neither tablist moves', () => {
    let { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    let tabs = byRole(host, 'tab');
    tabs[2].focus();
    for (const mod of ['altKey', 'ctrlKey', 'metaKey']) press(tabs[2], 'ArrowDown', { [mod]: true });
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    unmountAll();
    ({ host } = renderHub({ site: 'mobile', hubWidth: 390 }));
    tabs = byRole(host, 'tab');
    tabs[0].focus();
    for (const mod of ['altKey', 'ctrlKey', 'metaKey']) press(tabs[0], 'ArrowLeft', { [mod]: true });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it.each(SHELLS)('L3-10: no block element inside a button (%s site at %i px), in the S1 state and every fixture', (site, hubWidth) => {
    for (const name of [null, ...HUB_LAYOUT_FIXTURE_NAMES]) {
      renderHub({ site, hubWidth, sections: name ? fixture(name) : undefined });
      const blocks = [...document.querySelectorAll('[data-hub="shell"] button, [data-hub-strip] button')]
        .flatMap((b) => [...b.querySelectorAll('div, p, section, h1, h2, h3, ul, ol, li')].map((el) => `${name}: ${el.tagName} in ${b.textContent.slice(0, 30)}`));
      expect(blocks).toEqual([]);
      unmountAll();
    }
  });

  it('L3-14: a disabled control keeps its text legible — the secondary ink at full opacity, never the design\'s half opacity', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    const disabled = [...host.querySelectorAll('button:disabled')];
    expect(disabled.length).toBeGreaterThan(3);
    for (const b of disabled) expect(['', '1'], b.textContent).toContain(b.style.opacity);
    const [forge] = byRole(host, 'button', COPY.loadout.changeInForge);
    expect(forge.style.color).toBe('var(--ft-ink-2)');
    const [archetype] = byRole(host, 'button', COPY.loadout.changeArchetype);
    expect(archetype.style.color).toBe('var(--ft-ink-2)');
  });

  it('the strip\'s status button names both lines without a doubled stop', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    const name = byRole(host.querySelector('[data-hub-strip]'), 'button').map((b) => b.getAttribute('aria-label') || '').find((n) => /Open loadout$/.test(n));
    expect(name).toBe('Checking eligibility. Checking your loadout. Open loadout');
  });
});

describe('S1 review fixes — design fidelity (L1)', () => {
  it('L1-1: every label sizes its own span (index.css forces <button> to 16 px !important)', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    expect(host.querySelector('[data-hub-phone-tab="overview"] span').style.fontSize).toBe('12.5px');
    const [hold] = byRole(host.querySelector('[data-hub-strip]'), 'button', COPY.deploy.holdLabel);
    expect([...hold.querySelectorAll('span')].some((s) => s.style.fontSize === '14px' && s.textContent === COPY.deploy.holdShort)).toBe(true);
    click(host.querySelector('[data-hub-phone-tab="research"]'));
    const [forge] = byRole(host, 'button', COPY.research.openForge);
    // A small button: 13 px, as the design's FfBtn small (still a 44 px target on the phone).
    expect([...forge.querySelectorAll('span')].some((s) => s.style.fontSize === '13px' && s.textContent === COPY.research.openForge)).toBe(true);
  });

  it('L1-1: links size their own span too (12.5 px; the brief\'s More at 13)', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    const [loadout] = byRole(host.querySelector('[data-hub-deploy]'), 'button', COPY.deploy.loadoutLink);
    expect(loadout.querySelector('span').style.fontSize).toBe('12.5px');
    const [more] = byRole(host.querySelector('[data-hub-section="brief"]'), 'button', COPY.brief.more);
    expect(more.querySelector('span').style.fontSize).toBe('13px');
    const [hold] = byRole(host.querySelector('[data-hub-deploy]'), 'button', COPY.deploy.holdLabel);
    expect([...hold.querySelectorAll('span')].some((s) => s.style.fontSize === '15px' && s.textContent === COPY.deploy.hold)).toBe(true);
  });

  it('L1-2: the phone\'s Reviews available leaves out the next action\'s own game', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390, sections: fixture('returning') });
    const reviews = host.querySelector(`section[aria-label="${COPY.games.reviewsAvailable}"]`);
    const rows = [...reviews.querySelectorAll('[data-hub-game-row]')].map((r) => r.textContent);
    expect(rows.some((n) => /Contrarian/.test(n))).toBe(false);
    expect(rows.some((n) => /Diversifier/.test(n))).toBe(true);
  });

  it('L1-3: the phone Overview links to all activity when it shows fewer rows than it holds (disabled until S4)', () => {
    renderHub({ site: 'mobile', hubWidth: 390, sections: fixture('long') });
    const [all] = byRole(document.querySelector('[data-hub="shell"]'), 'button', COPY.activity.all(10));
    expect(all.disabled).toBe(true);
    unmountAll();
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    expect(byRole(document.querySelector('[data-hub="shell"]'), 'button', COPY.activity.all(10))).toHaveLength(0);
  });

  it('L1-4: the Forge line keeps the design\'s words: the locked variant in a live game, and its tail', () => {
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('active') });
    let panel = document.querySelector('[data-hub-panel="loadout"]');
    expect(panel.textContent).toContain(COPY.loadout.nextDeployLocked);
    expect(panel.textContent).toContain(COPY.loadout.neverRewrites.trim());
    unmountAll();
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('returning') });
    panel = document.querySelector('[data-hub-panel="loadout"]');
    expect(panel.textContent).toContain(COPY.loadout.nextDeploy);
    expect(panel.textContent).not.toContain(COPY.loadout.nextDeployLocked);
  });

  it('L1-7: Research keeps the design\'s header row — the eyebrow and the action above the content', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    click(byRole(host, 'tab', new RegExp(COPY.areas.names[1]))[0]);
    const text = host.querySelector('[data-hub-panel="research"]').textContent;
    expect(text.indexOf(COPY.research.ideas)).toBe(0);
    expect(text.indexOf(COPY.research.openForge)).toBeLessThan(text.indexOf(COPY.research.loading));
  });

  it('L1-8: the phone Overview shows the design\'s empty note when games resolve empty with no next action', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390, sections: { ...fixture('first'), nextAction: { status: 'ready', candidate: null } } });
    expect(byText(host, COPY.games.empty)).not.toBeNull();
    expect(byText(host, COPY.games.emptySubPhone)).not.toBeNull();
  });

  it('L1-10: Games shows "0 completed" once its read resolves empty', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('first') });
    expect(byText(host.querySelector('[data-hub-section="games"]'), COPY.games.completedCount(0))).not.toBeNull();
  });
});

describe('S1 review fixes — the draw chip (L1-10)', () => {
  it('a recorded draw wears the tinted ink-2 chip; "No result" the dim one', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    const [history] = byRole(host, 'button', COPY.games.history);
    click(history);
    const dialog = document.querySelector('[role="dialog"]');
    const tagOf = (text) => [...dialog.querySelectorAll('[data-hub-tag]')].find((s) => s.textContent === text);
    expect(tagOf('Draw −8').getAttribute('data-hub-tag')).toBe('ink-2');
    expect(tagOf('No result').getAttribute('data-hub-tag')).toBe('dim');
  });
});

describe('S1 review fixes — layout (L4)', () => {
  it('L4-4: the nav and the strip are observed by their border box, so a padding change (an inset arriving late) is seen', () => {
    renderHub({ site: 'mobile', hubWidth: 390 });
    const nav = document.querySelector('[data-ft-bottom-nav]');
    const strip = document.querySelector('[data-hub-strip]');
    const watching = [...layout.observers].find((o) => o.targets.has(nav));
    expect(watching.options.get(nav)).toEqual({ box: 'border-box' });
    expect(watching.options.get(strip)).toEqual({ box: 'border-box' });
  });

  it('L4-5: the loadout cards\' header rows wrap, so the Equipped tag never clips in a narrow card', () => {
    renderHub({ site: 'desktop', hubWidth: 770, sections: fixture('returning') });
    const tag = [...document.querySelectorAll('[data-hub-panel="loadout"] [data-hub-tag]')].find((t) => t.textContent === COPY.loadout.equipped);
    expect(tag.parentElement.style.flexWrap).toBe('wrap');
  });

  it('L4-6: the connector is measured from the overlay\'s origin (the stage\'s padding box), not the stage\'s border box', async () => {
    const { connectorPath } = await import('./ShadowStage');
    const box = { left: 120, right: 460, top: 100, height: 340, width: 340 };
    const glyph = { left: 560, top: 250, height: 22, width: 22 };
    const path = connectorPath({ left: 101, top: 51 }, box, glyph);
    expect(path.sx).toBe(359);
    expect(path.sy).toBe(219);
    expect(path.d.endsWith('457.0 210.0')).toBe(true);
  });
});
