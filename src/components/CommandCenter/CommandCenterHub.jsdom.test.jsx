// @vitest-environment jsdom
//
// Command Center hub, slice S1 — the shell at the four test shells, with the
// S1 production state and the layout fixtures (prompt §5: composition,
// defaults, the strip only on the mobile site, Deploy above Games on tablet
// and stacked, keyboard, the History sheet).
//
// jsdom has no layout: __fixtures__/hubTestKit.js gives the hub root, the
// strip and a stand-in BottomNav their boxes and fires the ResizeObservers.
// These rows prove composition, order and the clearance arithmetic; the real
// geometry (first viewport, the strip's 63–69 px) is measured in a headless
// browser for the build report.

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { userState } = vi.hoisted(() => ({ userState: { user: { displayName: 'Flash', username: 'flash' } } }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => userState }));

import CommandCenterHub from './CommandCenterHub';
import { HUB_COPY as COPY } from './hub/hubCopy';
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
  userState.user = { displayName: 'Flash', username: 'flash' };
});

const hubRoot = () => document.querySelector('[data-hub="shell"]');
const composition = () => hubRoot()?.getAttribute('data-hub-composition');

function renderHub({ site, hubWidth, sections }) {
  layout.state.hubWidth = hubWidth;
  const m = mount(<CommandCenterHub site={site} sections={sections} />);
  mounted.push(m);
  return m;
}

/** The hub content width App hands the hub for a shell: the window, less the sidebar on the desktop site. */
const SHELL_CASES = [
  { name: 'Phone S 360', site: 'mobile', hubWidth: HUB_TEST_SHELLS['Phone S'].width, expected: 'phone' },
  { name: 'Phone 390', site: 'mobile', hubWidth: HUB_TEST_SHELLS.Phone.width, expected: 'phone' },
  { name: 'Tablet 834 · sidebar collapsed', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Tablet.width - SIDEBAR.collapsed, expected: 'tablet' },
  { name: 'Tablet 834 · sidebar expanded (614)', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Tablet.width - SIDEBAR.expanded, expected: 'stacked' },
  { name: 'Desktop 1280 · sidebar collapsed', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Desktop.width - SIDEBAR.collapsed, expected: 'desktop' },
  { name: 'Desktop 1280 · sidebar expanded', site: 'desktop', hubWidth: HUB_TEST_SHELLS.Desktop.width - SIDEBAR.expanded, expected: 'tablet' },
];

describe('S1 production state — every section in its loading state (ruling R-S1-4)', () => {
  it('the phone: Overview selected, the strip checking eligibility with the hold disabled', () => {
    const { host } = renderHub({ site: 'mobile', hubWidth: 390 });
    expect(composition()).toBe('phone');
    const [overview] = byRole(host, 'tab', COPY.phoneTabs.overview);
    expect(overview.getAttribute('aria-selected')).toBe('true');
    const strip = host.querySelector('[data-hub-strip]');
    expect(strip.getAttribute('role')).toBe('region');
    expect(strip.getAttribute('data-hub-strip')).toBe('checking');
    expect(byText(strip, COPY.deploy.states.checking)).not.toBeNull();
    const [hold] = byRole(strip, 'button', COPY.deploy.holdLabel);
    expect(hold.disabled).toBe(true);
    expect(byText(host, COPY.games.loading)).not.toBeNull();
    expect(host.querySelector('[data-hub-next-action]')).toBeNull();
  });

  it('the desktop: Equipped Archetype selected, the Deploy card checking with the spec helper lines', () => {
    const { host } = renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(composition()).toBe('desktop');
    const selected = byRole(host, 'tab').filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected.map((t) => t.getAttribute('data-hub-area'))).toEqual(['2']);
    expect(host.querySelector('[data-hub-strip]')).toBeNull();
    const card = host.querySelector('[data-hub-deploy]');
    expect(card.getAttribute('data-hub-deploy')).toBe('checking');
    expect(byText(card, COPY.deploy.states.checking)).not.toBeNull();
    expect(byText(card, COPY.deploy.pointerHelp)).not.toBeNull();
    expect(byText(card, COPY.deploy.keyboardHelp)).not.toBeNull();
    expect(byRole(card, 'button', COPY.deploy.holdLabel)[0].disabled).toBe(true);
  });
});

describe('S1 compositions at the four shells', () => {
  it.each(SHELL_CASES)('$name → $expected', ({ site, hubWidth, expected }) => {
    renderHub({ site, hubWidth });
    expect(composition()).toBe(expected);
  });

  it.each(HUB_LAYOUT_FIXTURE_NAMES)('fixture %s renders at every shell', (name) => {
    for (const shell of SHELL_CASES) {
      const m = renderHub({ site: shell.site, hubWidth: shell.hubWidth, sections: HUB_LAYOUT_FIXTURES[name].sections });
      expect(composition(), `${name} at ${shell.name}`).toBe(shell.expected);
      m.unmount();
      mounted = mounted.filter((x) => x !== m);
    }
  });
});
