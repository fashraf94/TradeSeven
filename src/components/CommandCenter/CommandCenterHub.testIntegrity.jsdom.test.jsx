// @vitest-environment jsdom
//
// Command Center hub, slice S1 — rows from the §2 review's mutating lens (L5,
// test integrity; S1 build report §7.3). Each row pins a behaviour that a
// mutant changed while every earlier row stayed green: focus return from the
// real History sheet, reduced motion on every motion site, observer cleanup,
// the strip and phone layout contracts, the S1 static states per section and
// site, the ET date at a day boundary, and the Shadow and its connector as
// drawn. Same harness as CommandCenterHub.jsdom.test.jsx; rows assert outcomes
// (a focused element, an inline style, a drawn path), not the tree's shape.

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

import CommandCenterHub, { shadowSizeFor } from './CommandCenterHub';
import ShadowStill from './ShadowStill';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { deployDisplay } from './hub/deployDisplay';
import { formatHubDate } from './hub/hubDate';
import { stillPaths } from './hub/shadowGeometry';
import { readToken } from '../../theme/cssTokens';
import { HUB_LAYOUT_FIXTURES, HUB_LAYOUT_FIXTURE_NAMES } from './__fixtures__/hubLayoutFixtures';
import { byRole, click, injectTokens, installFakeLayout, mount, mountFakeBottomNav, press } from './__fixtures__/hubTestKit';

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
  unmountAll();
  removeNav();
  layout.restore();
  userState.user = { displayName: 'Flash', username: 'flash' };
  motionState.reduced = false;
});

const fixture = (name) => HUB_LAYOUT_FIXTURES[name].sections;
const hubRoot = () => document.querySelector('[data-hub="shell"]');
const section = (name) => document.querySelector(`[data-hub-section="${name}"]`);
const selectedArea = () => document.querySelector('[role="tab"][aria-selected="true"][data-hub-area]')?.getAttribute('data-hub-area');
const historyLink = () => byRole(section('games'), 'button', COPY.games.history)[0];

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

/** A keydown that reports whether a handler took it. */
function keydown(el, key, init = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  React.act(() => { el.dispatchEvent(event); });
  return event;
}

/** Elements under `scope` that start a fade (framer-motion writes the initial opacity inline). */
const fadingIn = (scope) => [...scope.querySelectorAll('*')].filter((el) => el.style.opacity === '0');

describe('S1 review fixes — the History sheet as the hub opens it (L5-10)', () => {
  it('opened by a click on the link\'s label with nothing focused first (Safari), focus returns to the link', () => {
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    const link = historyLink();
    expect(document.activeElement).toBe(document.body);
    click(link.querySelector('span'));
    keydown(document.querySelector('[role="dialog"]'), 'Escape');
    expect(document.activeElement).toBe(link);
  });

  it('with its opener gone by the time it closes, focus goes to the hub root, never <body>', () => {
    const m = renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    const link = historyLink();
    click(link);
    m.rerender(<CommandCenterHub site="desktop" sections={fixture('blocked')} />);
    expect(link.isConnected).toBe(false);
    keydown(document.querySelector('[role="dialog"]'), 'Escape');
    expect(document.activeElement).toBe(hubRoot());
  });

  it('its rows are disabled, so Tab from Close stays in the dialog', () => {
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    click(historyLink());
    const close = document.querySelector('[data-hub-sheet-close]');
    expect(document.activeElement).toBe(close);
    expect(keydown(close, 'Tab').defaultPrevented).toBe(true);
    expect(keydown(close, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
  });

  it('Escape closes it without reaching the app behind it', () => {
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    click(historyLink());
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    keydown(document.querySelector('[role="dialog"]'), 'Escape');
    document.removeEventListener('keydown', seen);
    expect(seen).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('S1 review fixes — reduced motion at every motion site (L5-11)', () => {
  it('the area panel switches with no fade-in', () => {
    motionState.reduced = true;
    renderHub({ site: 'desktop', hubWidth: 1216 });
    click(byRole(document, 'tab', new RegExp(COPY.areas.names[0]))[0]);
    expect(fadingIn(document.querySelector('[data-hub-area-panel]'))).toEqual([]);
  });

  it('the phone tab panel switches with no fade-in', () => {
    motionState.reduced = true;
    renderHub({ site: 'mobile', hubWidth: 390 });
    click(document.querySelector('[data-hub-phone-tab="research"]'));
    expect(fadingIn(document.querySelector('[data-hub-phone-panel]'))).toEqual([]);
  });

  it('the History sheet opens with no fade', () => {
    motionState.reduced = true;
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('long') });
    click(historyLink());
    expect(fadingIn(document.querySelector('[data-hub-sheet-overlay]').parentElement)).toEqual([]);
  });

  it('control: with motion on, the same switch does fade in (so the rows above can fail)', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    click(byRole(document, 'tab', new RegExp(COPY.areas.names[0]))[0]);
    expect(fadingIn(document.querySelector('[data-hub-area-panel]')).length).toBeGreaterThan(0);
  });
});

describe('S1 review fixes — cleanup, layout contracts and static states (L5-12, L5-13, L5-14)', () => {
  it.each([['mobile', 390], ['desktop', 1216]])('unmounting the %s hub disconnects every ResizeObserver it made (spec §10 cleanup)', (site, hubWidth) => {
    const m = renderHub({ site, hubWidth });
    expect(layout.observers.size).toBeGreaterThan(0);
    m.unmount();
    mounted = [];
    expect(layout.observers.size).toBe(0);
  });

  it('the strip counts the safe area once: none of its own over a measured nav, its own with no nav', () => {
    renderHub({ site: 'mobile', hubWidth: 390 });
    expect(document.querySelector('[data-hub-strip]').style.paddingBottom).not.toContain('safe-area');
    unmountAll();
    removeNav();
    removeNav = () => {};
    renderHub({ site: 'mobile', hubWidth: 390 });
    // jsdom reserializes env() oddly ("env(0px * , * safe-area-inset-bottom)"), so only the inset's name is checked.
    expect(document.querySelector('[data-hub-strip]').style.paddingBottom).toContain('safe-area-inset-bottom');
  });

  it('the phone pane scrolls itself and the tab row sticks to its top', () => {
    renderHub({ site: 'mobile', hubWidth: 390 });
    expect(hubRoot().style.height).toBe('100dvh');
    expect(hubRoot().style.overflowY).toBe('auto');
    const row = document.querySelector('[data-hub-phone-tabs]');
    expect(row.style.position).toBe('sticky');
    expect(row.style.top).toBe('0px');
  });

  it('every phone control is at least 44 px tall, on every tab, in the S1 state and with rows', () => {
    for (const name of [null, 'returning', 'long', 'rankedLive']) {
      const m = renderHub({ site: 'mobile', hubWidth: 390, sections: name ? fixture(name) : undefined });
      for (const tab of ['overview', 'research', 'partnership', 'loadout']) {
        click(document.querySelector(`[data-hub-phone-tab="${tab}"]`));
        const short = [...document.querySelectorAll('[data-hub="shell"] button, [data-hub-strip] button')]
          .filter((b) => !(parseFloat(b.style.minHeight || b.style.height) >= 44))
          .map((b) => `${name ?? 'S1'}/${tab}: ${b.textContent.slice(0, 24)} (${b.style.minHeight || b.style.height || 'none'})`);
        expect(short).toEqual([]);
      }
      m.unmount();
      mounted = [];
    }
  });

  it.each([['mobile', 390], ['desktop', 1216]])('the %s hub carries the scoped box-model and focus style, once', (site, hubWidth) => {
    renderHub({ site, hubWidth });
    expect(document.querySelectorAll('style[data-hub-css]')).toHaveLength(1);
  });

  it('the desktop Games and Brief sections say their own loading words; the area controls their S1 summaries', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(section('games').textContent).toContain(COPY.games.loading);
    expect(section('brief').textContent).toContain(COPY.brief.loading);
    const tabs = [...document.querySelectorAll('[role="tab"][data-hub-area]')];
    expect(tabs.map((t) => t.textContent)).toEqual([
      `${COPY.areas.names[0]}${COPY.partnership.summary}`,
      `${COPY.areas.names[1]}${COPY.research.summaryLoading}`,
      `${COPY.areas.names[2]}${COPY.loadout.summaryLoading}`,
    ]);
  });

  it('the phone stage highlights the selected tab\'s area line', () => {
    renderHub({ site: 'mobile', hubWidth: 390 });
    click(document.querySelector('[data-hub-phone-tab="research"]'));
    const color = (a) => document.querySelector(`[data-hub-summary="${a}"]`).style.color;
    expect([color(0), color(1), color(2)]).toEqual(['var(--ft-ink-2)', 'var(--ft-ink)', 'var(--ft-ink-2)']);
  });

  it('S1\'s checking state shows the secondary-ink dot on the strip', () => {
    renderHub({ site: 'mobile', hubWidth: 390 });
    expect(document.querySelector('[data-hub-strip-dot]').getAttribute('data-hub-strip-dot')).toBe('ink-2');
  });

  it('with no brief body (S1) the More link and the phone row are present but inert', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    expect(byRole(section('brief'), 'button', COPY.brief.more)[0].disabled).toBe(true);
    unmountAll();
    renderHub({ site: 'mobile', hubWidth: 390 });
    expect(section('brief').querySelector('button').disabled).toBe(true);
  });

  it('the Deploy card\'s Loadout link — one of S1\'s few live desktop actions — selects the Equipped Archetype area', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    click(byRole(document, 'tab', new RegExp(COPY.areas.names[0]))[0]);
    expect(selectedArea()).toBe('0');
    click(byRole(document.querySelector('[data-hub-deploy]'), 'button', COPY.deploy.loadoutLink)[0]);
    expect(selectedArea()).toBe('2');
  });
});

describe('S1 review fixes — the smaller contracts (L5-15 … L5-18)', () => {
  it('04:30 UTC on Oct 16 is already Friday in New York (EDT) — not Central time, not a fixed −5', () => {
    expect(formatHubDate(new Date('2026-10-16T04:30:00Z'))).toBe('Friday, October 16');
  });

  it('Shadow redraws its paths when the selected area changes (R-S1-1\'s selectedArea prop)', () => {
    const m = mount(<ShadowStill size={200} tier="mid" selectedArea={2} />);
    mounted.push(m);
    m.rerender(<ShadowStill size={200} tier="mid" selectedArea={0} />);
    const drawn = [...m.host.querySelectorAll('[data-shadow-strand] path:last-child')].map((p) => p.getAttribute('d'));
    expect(drawn).toEqual(stillPaths('mid', 0).map((p) => p.d));
  });

  it('the display states the fixtures reach: blocked keeps the strip hold, confirmed reads Deployed with the positive dot', () => {
    expect(deployDisplay({ displayState: 'blocked', canStart: false, reason: 'x' }).strip.hold).toEqual({ label: COPY.deploy.hold, secondary: false });
    expect(deployDisplay({ displayState: 'confirmed', canStart: false }).cardHoldLabel).toBe(COPY.deploy.holdDeployed);
    expect(deployDisplay({ displayState: 'confirmed', canStart: false }).dot).toBe('pos');
    expect(deployDisplay({ displayState: 'checking', canStart: false }).dot).toBe('ink-2');
  });

  it('on the phone a live game that is the next action is not listed again as a row', () => {
    renderHub({ site: 'mobile', hubWidth: 390, sections: fixture('active') });
    const panel = document.querySelector('[data-hub-phone-panel]');
    expect(panel.querySelectorAll('[data-hub-next-action="openGame"]')).toHaveLength(1);
    expect(panel.querySelectorAll('[data-hub-game-row="live"]')).toHaveLength(0);
  });

  it('exactly two completed games: no History link (the desktop shows both already)', () => {
    renderHub({ site: 'desktop', hubWidth: 1216, sections: fixture('blocked') });
    expect(byRole(section('games'), 'button', COPY.games.history)).toHaveLength(0);
  });

  it('the Shadow is 196 px under 375 px and 200 px from 375 px', () => {
    expect(shadowSizeFor('phone', 374)).toBe(196);
    expect(shadowSizeFor('phone', 375)).toBe(200);
  });

  it('the phone account circle shows the capital initial of a lowercase username', () => {
    userState.user = { username: 'flash' };
    renderHub({ site: 'mobile', hubWidth: 390 });
    expect(document.querySelector('[data-hub-profile]').textContent).toBe('F');
  });

  it('the vertical area tablist takes ArrowRight and ArrowLeft as well as Up and Down', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    const tabs = byRole(document, 'tab');
    tabs[2].focus();
    press(tabs[2], 'ArrowRight');
    expect(selectedArea()).toBe('0');
    press(document.activeElement, 'ArrowLeft');
    expect(selectedArea()).toBe('2');
  });
});

describe('S1 review fixes — the Shadow\'s connector and SVG paint, as drawn (L5-5)', () => {
  // jsdom gives every element a zero box, so the connector never draws in the
  // other suites. Here the stage, Shadow's box and the area rings get boxes.
  const rect = (left, top, width, height) => ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON() { return this; } });
  let kitRect;
  beforeEach(() => {
    kitRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.matches('[data-hub-stage="desktop"]')) return rect(0, 0, 900, 420);
      if (this.matches('[data-shadow-box]')) return rect(26, 60, 340, 340);
      const button = this.parentElement;
      if (button?.matches('button[data-hub-area]') && button.firstElementChild === this) {
        return rect(500, 100 + Number(button.getAttribute('data-hub-area')) * 84, 22, 22);
      }
      return kitRect.call(this);
    };
  });
  afterEach(() => { Element.prototype.getBoundingClientRect = kitRect; });

  it('runs from the middle of Shadow\'s box\'s right edge to the selected ring (R-S1-1), in a computed hex (hazard H8)', () => {
    renderHub({ site: 'desktop', hubWidth: 1216 });
    const path = document.querySelector('[data-hub-connector] path');
    expect(path).not.toBeNull();
    // Box right 366, middle 60 + 170 = 230; the Equipped Archetype ring's left 500 − 2, middle 100 + 168 + 11 = 279.
    expect(path.getAttribute('d')).toBe('M366.0 230.0 C432.0 230.0, 432.0 279.0, 498.0 279.0');
    expect(path.getAttribute('stroke')).toBe(readToken('gold'));
    expect(path.getAttribute('stroke')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('every SVG paint the hub draws, at both sites and in every state, is a hex, none, currentColor or a url(#…) — never a var()', () => {
    const PAINT = /^(?:#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?|none|currentColor|url\(#[\w-]+\))$/;
    const bad = [];
    let painted = 0;
    for (const [site, hubWidth] of [['desktop', 1216], ['mobile', 390]]) {
      for (const name of [null, ...HUB_LAYOUT_FIXTURE_NAMES]) {
        renderHub({ site, hubWidth, sections: name ? fixture(name) : undefined });
        for (const el of document.querySelectorAll('svg, svg *')) {
          for (const attr of ['fill', 'stroke', 'stop-color']) {
            const value = el.getAttribute(attr);
            if (value == null) continue;
            painted += 1;
            if (!PAINT.test(value)) bad.push(`${site}/${name ?? 'S1'} <${el.tagName.toLowerCase()} ${attr}="${value}">`);
          }
        }
        unmountAll();
      }
    }
    expect(painted).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });
});
