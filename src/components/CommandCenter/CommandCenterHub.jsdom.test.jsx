// @vitest-environment jsdom
//
// Command Center hub, slice S1 — the shell at the four test shells, with the
// S1 production state and the layout fixtures (prompt §5: composition,
// defaults, the strip only on the mobile site, Deploy above Games on tablet
// and stacked, keyboard, the strip's clearance, the History sheet).
//
// jsdom has no layout: __fixtures__/hubTestKit.js gives the hub root, the
// strip and a stand-in BottomNav their boxes and fires the ResizeObservers.
// These rows prove composition, order and the clearance arithmetic. The real
// geometry — the first viewport, the strip's 63–69 px, the sticky tab row —
// is measured in headless Edge for the S1 build report, not here.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState, motionState } = vi.hoisted(() => ({
  userState: { user: { displayName: 'Flash', username: 'flash' } },
  motionState: { reduced: false },
}));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => motionState.reduced };
});

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { HUB_LAYERS } from './hub/hubStyle';
import { HUB_LAYOUT_FIXTURES, HUB_LAYOUT_FIXTURE_NAMES, HUB_TEST_SHELLS, SIDEBAR } from './__fixtures__/hubLayoutFixtures';
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
  vi.useRealTimers();
  userState.user = { displayName: 'Flash', username: 'flash' };
  motionState.reduced = false;
});

const hubRoot = () => document.querySelector('[data-hub="shell"]');
const composition = () => hubRoot()?.getAttribute('data-hub-composition');

function renderHub({ site, hubWidth, sections }) {
  layout.state.hubWidth = hubWidth;
  const m = mount(<CommandCenterHub site={site} sections={sections} />);
  mounted.push(m);
  return m;
}

const fixture = (name) => HUB_LAYOUT_FIXTURES[name].sections;
const selectedTabs = (scope) => byRole(scope, 'tab').filter((t) => t.getAttribute('aria-selected') === 'true');
const sectionOrder = (scope) => [...scope.querySelectorAll('[data-hub-section]')].map((el) => el.getAttribute('data-hub-section'));

/** The hub content width App hands the hub for a shell: the window, less the sidebar on the desktop site. */
const SHELL_CASES = [
  { name: 'Phone S 360', site: 'mobile', hubWidth: HUB_TEST_SHELLS['Phone S'].width, expected: 'phone' },
  { name: 'Phone 390', site: 'mobile', hubWidth: HUB_TEST_SHELLS.Phone.width, expected: 'phone' },
  { name: 'Tablet 834 · sidebar collapsed (770)', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Tablet.width - SIDEBAR.collapsed, expected: 'tablet' },
  { name: 'Tablet 834 · sidebar expanded (614)', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Tablet.width - SIDEBAR.expanded, expected: 'stacked' },
  { name: 'Desktop 1280 · sidebar collapsed (1216)', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Desktop.width - SIDEBAR.collapsed, expected: 'desktop' },
  { name: 'Desktop 1280 · sidebar expanded (1060)', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Desktop.width - SIDEBAR.expanded, expected: 'tablet' },
];

const FIXTURE_SHELLS = HUB_LAYOUT_FIXTURE_NAMES.flatMap((name) => SHELL_CASES.map((shell) => ({ fixtureName: name, ...shell })));

describe('S1 production state — every section in its loading state (ruling R-S1-4)', () => {
  it('the phone: Overview selected, the strip checking eligibility with the hold disabled', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    expect(composition()).toBe('phone');
    const [overview] = byRole(host, 'tab', COPY.phoneTabs.overview);
    expect(overview.getAttribute('aria-selected')).toBe('true');
    const strip = host.querySelector('[data-hub-strip]');
    expect(strip.getAttribute('role')).toBe('region');
    expect(strip.getAttribute('aria-label')).toBe(COPY.strip.regionLabel);
    expect(strip.getAttribute('data-hub-strip')).toBe('checking');
    expect(byText(strip, COPY.deploy.states.checking)).not.toBeNull();
    expect(byText(strip, COPY.loadout.lineLoading)).not.toBeNull();
    const [hold] = byRole(strip, 'button', COPY.deploy.holdLabel);
    expect(hold.disabled).toBe(true);
    expect(byText(host, COPY.games.loading)).not.toBeNull();
    expect(byText(host, COPY.activity.loading)).not.toBeNull();
    expect(byText(host, COPY.brief.loading)).not.toBeNull();
  });

  it('the desktop: Equipped Archetype selected, the Deploy card checking with the spec helper lines', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(composition()).toBe('desktop');
    expect(selectedTabs(host).map((t) => t.getAttribute('data-hub-area'))).toEqual(['2']);
    expect(host.querySelector('[data-hub-strip]')).toBeNull();
    const card = host.querySelector('[data-hub-deploy]');
    expect(card.getAttribute('data-hub-deploy')).toBe('checking');
    expect(byText(card, COPY.deploy.title)).not.toBeNull();
    expect(byText(card, COPY.deploy.states.checking)).not.toBeNull();
    expect(byText(card, COPY.deploy.pointerHelp)).not.toBeNull();
    expect(byText(card, COPY.deploy.keyboardHelp)).not.toBeNull();
    expect(byRole(card, 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
  });

  it.each(SHELL_CASES)('nothing is fabricated at $name: no next action, no game or activity row, no review, no count', ({ site, hubWidth }) => {
    const { host } = renderHub({ site, hubWidth });
    expect(host.querySelector('[data-hub-next-action]')).toBeNull();
    expect(host.querySelector('[data-hub-game-row]')).toBeNull();
    expect(host.querySelector('[data-hub-activity-row]')).toBeNull();
    expect(byText(host, COPY.games.history)).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).not.toMatch(/\d+ (live|completed)/);
  });

  it('the hold renders disabled with no completion: pressing it does nothing and never locks in', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    const [hold] = byRole(host, 'button', COPY.deploy.holdLabel);
    hold.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    press(hold, 'Enter');
    expect(hold.disabled).toBe(true);
    expect(hold.textContent).not.toMatch(/Locked in/);
  });

  it('a ready deploy with no handler (S1 wires none) still renders every hold disabled: the card, the strip, the first-deploy action', () => {
    for (const [site, hubWidth] of [['desktop', 1216], ['mobile', 390]]) {
      const m = renderHub({ site, hubWidth, sections: fixture('first') });
      const holds = byRole(m.host, 'button', COPY.deploy.holdLabel);
      // Desktop: the first-deploy action and the Deploy card; phone: the first-deploy action and the strip.
      expect(holds.length, site).toBe(2);
      for (const hold of holds) expect(hold.disabled, site).toBe(true);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });

  it('the hub scopes border-box to its own three roots (the app ships no global box-sizing rule)', () => {
    renderHub({ site: 'mobile', hubWidth: 390 });
    const rules = [...document.querySelectorAll('style[data-hub-box-model]')].map((s) => s.textContent);
    expect(rules).toHaveLength(1);
    for (const root of ['[data-hub="shell"]', '[data-hub-strip]', '[data-hub-sheet-overlay]']) {
      expect(rules[0]).toContain(`${root} *`);
    }
    expect(rules[0]).toMatch(/\{ box-sizing: border-box; \}$/);
  });

  it('every later-slice action renders disabled: the Forge actions, the pickers and the profile', () => {
    const phone = renderHub({ site: 'mobile', hubWidth: 390 });
    const profile = phone.host.querySelector('[data-hub-profile]');
    expect(profile.disabled).toBe(true);
    expect(profile.getAttribute('aria-label')).toBe(COPY.header.profile);
    phone.unmount();
    mounted = [];
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    for (const label of [COPY.loadout.changeArchetype, COPY.loadout.changeWatchlist, COPY.loadout.changeInForge]) {
      expect(byRole(host, 'button', label)[0]?.disabled, label).toBe(true);
    }
    click(byRole(host, 'tab', new RegExp(COPY.areas.names[1]))[0]);
    expect(byRole(host, 'button', COPY.research.openForge)[0].disabled).toBe(true);
    expect(byText(host, COPY.research.loading)).not.toBeNull();
  });
});

describe('S1 compositions and defaults at the four shells (rulings R-S1-3, R-S1-5)', () => {
  it.each(SHELL_CASES)('$name → $expected, opening on its default', ({ site, hubWidth, expected }) => {
    const { host } = renderHub({ site, hubWidth });
    expect(composition()).toBe(expected);
    const selected = selectedTabs(host);
    if (expected === 'phone') expect(selected.map((t) => t.getAttribute('data-hub-phone-tab'))).toEqual(['overview']);
    else expect(selected.map((t) => t.getAttribute('data-hub-area'))).toEqual(['2']);
  });

  it.each(FIXTURE_SHELLS)('fixture $fixtureName at $name: composition, the strip only on the mobile site, Deploy above Games but on the desktop', ({ fixtureName, site, hubWidth, expected }) => {
    const { host } = renderHub({ site, hubWidth, sections: fixture(fixtureName) });
    expect(composition()).toBe(expected);
    expect(Boolean(host.querySelector('[data-hub-strip]'))).toBe(site === 'mobile');
    if (expected === 'phone') return;
    const order = sectionOrder(host);
    const deployAt = order.indexOf('deploy');
    const gamesAt = order.indexOf('games');
    expect(deployAt).toBeGreaterThan(-1);
    if (expected === 'desktop') expect(gamesAt).toBeLessThan(deployAt);
    else expect(deployAt).toBeLessThan(gamesAt);
  });

  it('the desktop keeps the design\'s side order; tablet and stacked put Deploy first', () => {
    let m = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    expect(sectionOrder(m.host)).toEqual(['games', 'deploy', 'activity', 'brief']);
    m.unmount();
    mounted = [];
    m = renderHub({ site: 'desktop', hubWidth: 770, sections: fixture('long') });
    expect(sectionOrder(m.host)).toEqual(['deploy', 'games', 'activity', 'brief']);
    m.unmount();
    mounted = [];
    m = renderHub({ site: 'desktop', hubWidth: 614, sections: fixture('long') });
    const all = [...m.host.querySelectorAll('[data-hub-next-action], [data-hub-stage], [data-hub-area-panel], [data-hub-section]')]
      .map((el) => el.getAttribute('data-hub-section') || (el.hasAttribute('data-hub-stage') ? 'stage' : el.hasAttribute('data-hub-area-panel') ? 'panel' : 'next'));
    expect(all).toEqual(['next', 'stage', 'panel', 'deploy', 'games', 'activity', 'brief']);
  });

  it('width changes within the desktop site keep the selected area (R-S1-5)', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    click(byRole(host, 'tab', new RegExp(COPY.areas.names[0]))[0]);
    expect(selectedTabs(host).map((t) => t.getAttribute('data-hub-area'))).toEqual(['0']);
    for (const [width, expected] of [[614, 'stacked'], [770, 'tablet'], [1216, 'desktop']]) {
      layout.resize({ hubWidth: width });
      expect(composition()).toBe(expected);
      expect(selectedTabs(host).map((t) => t.getAttribute('data-hub-area'))).toEqual(['0']);
    }
  });

  it('crossing App\'s split remounts at the other site, which starts from its own default (R-S1-5)', () => {
    const m = renderHub({ site: 'mobile', hubWidth: 390 });
    click(byRole(m.host, 'tab', COPY.phoneTabs.partnership)[0]);
    expect(selectedTabs(m.host).map((t) => t.getAttribute('data-hub-phone-tab'))).toEqual(['partnership']);
    layout.state.hubWidth = 1216;
    m.rerender(<CommandCenterHub site="desktop" />);
    expect(composition()).toBe('desktop');
    expect(selectedTabs(m.host).map((t) => t.getAttribute('data-hub-area'))).toEqual(['2']);
    m.rerender(<CommandCenterHub site="mobile" />);
    expect(selectedTabs(m.host).map((t) => t.getAttribute('data-hub-phone-tab'))).toEqual(['overview']);
  });

  it('a hub handed no site takes the desktop site\'s rows — never the phone and its strip', () => {
    const m = mount(<CommandCenterHub />);
    mounted.push(m);
    expect(hubRoot().getAttribute('data-hub-site')).toBe('desktop');
    expect(m.host.querySelector('[data-hub-strip]')).toBeNull();
  });
});

describe('S1 keyboard — tablist / tab / tabpanel with a roving tab stop (spec §10)', () => {
  it('the area controls: Arrow keys, Home and End move the selection and the focus; the panel follows', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    const tabs = byRole(host, 'tab');
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, -1, 0]);
    tabs[2].focus();
    press(tabs[2], 'ArrowDown');
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('[data-hub-area-panel]').getAttribute('data-hub-area-panel')).toBe('0');
    press(tabs[0], 'ArrowUp');
    expect(document.activeElement).toBe(tabs[2]);
    press(tabs[2], 'Home');
    expect(document.activeElement).toBe(tabs[0]);
    press(tabs[0], 'End');
    expect(document.activeElement).toBe(tabs[2]);
    press(tabs[2], 'ArrowLeft');
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('the area panel is the selected control\'s tabpanel', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    const panel = host.querySelector('[role="tabpanel"]');
    const [selected] = selectedTabs(host);
    expect(selected.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(selected.id);
    expect(panel.querySelector('h2').textContent).toBe(COPY.areas.names[2]);
  });

  it('the phone tabs: Left / Right / Home / End, and the panel follows', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    const tabs = byRole(host, 'tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Overview', 'Research', 'Partnership', 'Loadout']);
    tabs[0].focus();
    press(tabs[0], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[1]);
    expect(host.querySelector('[data-hub-phone-panel]').getAttribute('data-hub-phone-panel')).toBe('research');
    press(tabs[1], 'End');
    expect(document.activeElement).toBe(tabs[3]);
    press(tabs[3], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[0]);
    press(tabs[0], 'ArrowLeft');
    expect(document.activeElement).toBe(tabs[3]);
    press(tabs[3], 'ArrowDown');
    expect(document.activeElement).toBe(tabs[3]);
    const panel = host.querySelector('[role="tabpanel"]');
    expect(tabs[3].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[3].id);
    // The panel's heading follows the control: the phone says Loadout.
    expect(panel.querySelector('h2').textContent).toBe(COPY.phoneTabs.loadout);
  });
});

describe('S1 Partnership — the reserved panel only (spec §8.3)', () => {
  it.each([['desktop', 1216], ['mobile', 390]])('at the %s site: exactly the reserved line, and no control, link or count', (site, hubWidth) => {
    const { host } = renderHub({ site, hubWidth });
    const tab = site === 'mobile' ? byRole(host, 'tab', COPY.phoneTabs.partnership)[0] : byRole(host, 'tab', new RegExp(COPY.areas.names[0]))[0];
    click(tab);
    const panel = host.querySelector('[data-hub-panel="partnership"]');
    expect(panel.textContent).toBe("Partnership isn't part of this release. A preference will only ever stand once you confirm it.");
    expect(panel.querySelectorAll('button, a, input')).toHaveLength(0);
    const tabpanel = panel.closest('[role="tabpanel"]');
    expect(tabpanel.querySelectorAll('button, a, input')).toHaveLength(0);
  });
});

describe('S1 the mobile strip — placed on the measured nav, outside the tab panel (spec §10)', () => {
  it('sits fixed on the nav\'s measured height at z 40, and the scroll area clears nav + strip', () => {
    layout.state.navHeight = 64;
    layout.state.stripHeight = 66;
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    const strip = host.querySelector('[data-hub-strip]');
    expect(strip.style.position).toBe('fixed');
    expect(Number(strip.style.zIndex)).toBe(HUB_LAYERS.strip);
    expect(HUB_LAYERS.strip).toBe(40);
    expect(strip.style.bottom).toBe('64px');
    expect(hubRoot().style.paddingBottom).toBe('130px');
    expect(strip.closest('[role="tabpanel"]')).toBeNull();
  });

  it('follows a resize of either: a taller nav (a safe-area inset) and a two-line strip', () => {
    renderHub({ site: 'mobile', hubWidth: 390 });
    const strip = document.querySelector('[data-hub-strip]');
    layout.resize({ navHeight: 98, stripHeight: 69 });
    expect(strip.style.bottom).toBe('98px');
    expect(hubRoot().style.paddingBottom).toBe('167px');
  });

  it('with no nav on screen it sits at the bottom and pads the inset itself', () => {
    removeNav();
    removeNav = () => {};
    renderHub({ site: 'mobile', hubWidth: 390 });
    const strip = document.querySelector('[data-hub-strip]');
    expect(strip.style.bottom).toBe('0px');
    expect(strip.style.paddingBottom).toMatch(/safe-area-inset-bottom/);
  });

  it('a nav that appears after the hub is picked up on the next render', () => {
    removeNav();
    const m = renderHub({ site: 'mobile', hubWidth: 390 });
    expect(document.querySelector('[data-hub-strip]').style.bottom).toBe('0px');
    removeNav = mountFakeBottomNav();
    m.rerender(<CommandCenterHub site="mobile" />);
    expect(document.querySelector('[data-hub-strip]').style.bottom).toBe('64px');
  });

  it('stays outside the panel on every tab, and its status button opens the Loadout tab', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    for (const key of ['research', 'partnership', 'loadout', 'overview']) {
      click(host.querySelector(`[data-hub-phone-tab="${key}"]`));
      expect(host.querySelectorAll('[data-hub-strip]')).toHaveLength(1);
    }
    const open = byRole(host.querySelector('[data-hub-strip]'), 'button').find((b) => /Open loadout$/.test(b.getAttribute('aria-label') || ''));
    click(open);
    expect(selectedTabs(host).map((t) => t.getAttribute('data-hub-phone-tab'))).toEqual(['loadout']);
  });

  it.each([
    ['active', 'blocked', true, false],
    ['rankedLive', 'ready', true, true],
    ['checking', 'checking', false, true],
  ])('fixture %s: state %s, Open game %s, hold %s', (name, state, openGame, hold) => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390, sections: fixture(name) });
    const strip = host.querySelector('[data-hub-strip]');
    expect(strip.getAttribute('data-hub-strip')).toBe(state);
    expect(byRole(strip, 'button', COPY.deploy.openGame).length > 0).toBe(openGame);
    expect(byRole(strip, 'button', COPY.deploy.holdLabel).length > 0).toBe(hold);
  });
});

describe('S1 the History sheet — the HubSheet primitive\'s one use, from fixtures only', () => {
  it('the desktop: History opens a dialog with the completed rows and the career caption; Escape returns focus', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    const [history] = byRole(host, 'button', COPY.games.history);
    history.focus();
    click(history);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('data-hub-sheet')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(COPY.history.label);
    expect(dialog.querySelectorAll('[data-hub-game-row="completed"]')).toHaveLength(4);
    expect(byText(dialog, COPY.history.careerCaption)).not.toBeNull();
    expect(document.activeElement).toBe(dialog.querySelector('[data-hub-sheet-close]'));
    press(dialog, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(history);
  });

  it('the phone: the Game history row opens a bottom sheet', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390, sections: fixture('returning') });
    const [row] = byRole(host, 'button', COPY.history.rowLabel(3));
    click(row);
    expect(document.querySelector('[role="dialog"]').getAttribute('data-hub-sheet')).toBe('bottom');
  });

  it('desktop Games shows the live rows and at most two completed rows (spec §8.2)', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    const games = host.querySelector('[data-hub-section="games"]');
    expect(games.querySelectorAll('[data-hub-game-row="completed"]')).toHaveLength(2);
  });
});

describe('S1 header and status', () => {
  it('the eyebrow is today\'s date in ET and the player\'s name; no name, the date alone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T02:00:00Z'));
    const m = renderHub({ site: 'desktop', hubWidth: 1216 });
    const eyebrow = m.host.querySelector('header div div');
    expect(eyebrow.textContent).toBe('Thursday, October 15 · Flash');
    expect(m.host.querySelector('h1').textContent).toBe('Command Center');
    m.unmount();
    mounted = [];
    userState.user = null;
    const n = renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(n.host.querySelector('header div div').textContent).toBe('Thursday, October 15');
    expect(n.host.textContent).not.toMatch(/Tester/);
  });

  it('the status line is the one live region and says the idle words', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    const live = host.querySelectorAll('[aria-live]');
    expect(live).toHaveLength(1);
    expect(live[0].getAttribute('role')).toBe('status');
    expect(live[0].getAttribute('aria-live')).toBe('polite');
    expect(live[0].textContent).toBe(COPY.shadow.statusIdle);
  });

  it('a submitting deployment (fixture) turns the status line and Shadow\'s label to processing', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216, sections: { ...fixture('returning'), deploy: { displayState: 'submitting', canStart: false } } });
    expect(host.querySelector('[data-hub-status]').textContent).toBe(COPY.shadow.statusSubmitting);
    expect(host.querySelector('[data-shadow-box]').getAttribute('data-shadow-status')).toBe('processing');
  });

  it('Shadow draws low on the phone (200 px, 196 under 375) and mid elsewhere (340 desktop, 260 tablet and stacked)', () => {
    const cases = [['mobile', 390, 200, 15], ['mobile', 360, 196, 15], ['desktop', 1216, 340, 21], ['desktop', 770, 260, 21], ['desktop', 614, 260, 21]];
    for (const [site, hubWidth, size, strands] of cases) {
      const m = renderHub({ site, hubWidth });
      const box = m.host.querySelector('[data-shadow-box]');
      expect(box.style.width, `${site} ${hubWidth}`).toBe(`${size}px`);
      expect(box.querySelectorAll('[data-shadow-strand]'), `${site} ${hubWidth}`).toHaveLength(strands);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });

  it('OS reduced motion reaches Shadow (the same still, flagged)', () => {
    motionState.reduced = true;
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(host.querySelector('[data-shadow-box]').getAttribute('data-shadow-reduced-motion')).toBe('true');
  });
});
