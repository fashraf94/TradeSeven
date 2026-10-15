// src/components/CommandCenter/hub/composition.test.js
//
// Command Center hub, slice S1 — the width → composition function, the
// defaults, the roving keys and the section orders (founder rulings R-S1-3,
// R-S1-5; spec V1.2 §1, §10). Pure: no DOM.

import { describe, expect, it } from 'vitest';
import {
  AREA_FOR_PHONE_TAB,
  DEFAULT_AREA,
  DEFAULT_PHONE_TAB,
  DESKTOP_MAIN_ORDER,
  DESKTOP_MIN_WIDTH,
  DESKTOP_SIDE_ORDER,
  HUB_AREA_ORDER,
  HUB_AREAS,
  PHONE_TAB_ORDER,
  STACKED_ORDER,
  TABLET_MIN_WIDTH,
  TABLET_SIDE_ORDER,
  TABLET_TOP_ORDER,
  composeHub,
  rovingIndex,
} from './composition';

describe('composeHub — the site and the hub\'s own width (ruling R-S1-3)', () => {
  it('pins the band edges at 1080 and 700 px of hub width', () => {
    expect(DESKTOP_MIN_WIDTH).toBe(1080);
    expect(TABLET_MIN_WIDTH).toBe(700);
  });

  it.each([
    [1440, 'desktop'], [1216, 'desktop'], [1080, 'desktop'],
    [1079, 'tablet'], [1060, 'tablet'], [770, 'tablet'], [700, 'tablet'],
    [699, 'stacked'], [614, 'stacked'], [549, 'stacked'], [320, 'stacked'],
  ])('desktop site at %i px → %s', (width, expected) => {
    expect(composeHub({ site: 'desktop', width })).toBe(expected);
  });

  it.each([360, 390, 614, 768, 1280, null])('mobile site at %s px → phone, whatever the width', (width) => {
    expect(composeHub({ site: 'mobile', width })).toBe('phone');
  });

  it.each([null, undefined, NaN, Infinity, '1280'])('an unmeasured or invalid width (%s) on the desktop site → stacked, the one column', (width) => {
    expect(composeHub({ site: 'desktop', width })).toBe('stacked');
  });

  it('an absent or unknown site never yields the phone composition (its strip assumes BottomNav)', () => {
    expect(composeHub({ width: 390 })).toBe('stacked');
    expect(composeHub({ site: 'tablet', width: 1280 })).toBe('desktop');
    expect(composeHub({ site: 'MOBILE', width: 390 })).toBe('stacked');
  });

  it('the four test shells land on all four compositions (window less the sidebar on the desktop site)', () => {
    expect(composeHub({ site: 'mobile', width: 360 })).toBe('phone');
    expect(composeHub({ site: 'mobile', width: 390 })).toBe('phone');
    expect(composeHub({ site: 'desktop', width: 834 - 64 })).toBe('tablet');
    expect(composeHub({ site: 'desktop', width: 834 - 220 })).toBe('stacked');
    expect(composeHub({ site: 'desktop', width: 1280 - 64 })).toBe('desktop');
    expect(composeHub({ site: 'desktop', width: 1280 - 220 })).toBe('tablet');
  });
});

describe('defaults and the area / tab vocabulary (spec §1, §8.3)', () => {
  it('the phone opens on Overview; the wider compositions on the Equipped Archetype area', () => {
    expect(DEFAULT_PHONE_TAB).toBe('overview');
    expect(DEFAULT_AREA).toBe(HUB_AREAS.ARCHETYPE);
    expect(DEFAULT_AREA).toBe(2);
  });

  it('Partnership is never a default', () => {
    expect(DEFAULT_AREA).not.toBe(HUB_AREAS.PARTNERSHIP);
    expect(DEFAULT_PHONE_TAB).not.toBe('partnership');
  });

  it('keeps the design\'s orders: areas Partnership · Research · Archetype; tabs Overview · Research · Partnership · Loadout', () => {
    expect(HUB_AREA_ORDER).toEqual([0, 1, 2]);
    expect(PHONE_TAB_ORDER).toEqual(['overview', 'research', 'partnership', 'loadout']);
    expect(AREA_FOR_PHONE_TAB).toEqual({ overview: null, research: 1, partnership: 0, loadout: 2 });
  });
});

describe('rovingIndex — Arrow / Home / End', () => {
  it('moves right and left with wrap-around', () => {
    expect(rovingIndex('ArrowRight', 0, 4)).toBe(1);
    expect(rovingIndex('ArrowRight', 3, 4)).toBe(0);
    expect(rovingIndex('ArrowLeft', 0, 4)).toBe(3);
    expect(rovingIndex('ArrowLeft', 2, 4)).toBe(1);
  });

  it('Home and End go to the ends', () => {
    expect(rovingIndex('Home', 2, 3)).toBe(0);
    expect(rovingIndex('End', 0, 3)).toBe(2);
  });

  it('Up and Down move only a vertical list', () => {
    expect(rovingIndex('ArrowDown', 0, 3)).toBeNull();
    expect(rovingIndex('ArrowUp', 1, 3)).toBeNull();
    expect(rovingIndex('ArrowDown', 0, 3, { vertical: true })).toBe(1);
    expect(rovingIndex('ArrowDown', 2, 3, { vertical: true })).toBe(0);
    expect(rovingIndex('ArrowUp', 0, 3, { vertical: true })).toBe(2);
  });

  it('any other key is not a roving key', () => {
    expect(rovingIndex('Enter', 0, 3)).toBeNull();
    expect(rovingIndex('Tab', 0, 3, { vertical: true })).toBeNull();
  });
});

describe('section orders (ruling R-S1-3; spec §10)', () => {
  const before = (order, a, b) => order.indexOf(a) < order.indexOf(b);

  it('desktop keeps the design\'s order: [stage, panel] | [next, Games, Deploy, Activity, Brief]', () => {
    expect(DESKTOP_MAIN_ORDER).toEqual(['stage', 'panel']);
    expect(DESKTOP_SIDE_ORDER).toEqual(['next', 'games', 'deploy', 'activity', 'brief']);
  });

  it('tablet: next action → stage, then [panel | Deploy above Games]', () => {
    expect(TABLET_TOP_ORDER).toEqual(['next', 'stage']);
    expect(TABLET_SIDE_ORDER).toEqual(['deploy', 'games', 'activity', 'brief']);
  });

  it('stacked: the founder\'s order, Deploy above Games', () => {
    expect(STACKED_ORDER).toEqual(['next', 'stage', 'panel', 'deploy', 'games', 'activity', 'brief']);
    expect(before(STACKED_ORDER, 'deploy', 'games')).toBe(true);
    expect(before(TABLET_SIDE_ORDER, 'deploy', 'games')).toBe(true);
  });

  it('every composition places each of the seven parts exactly once', () => {
    const parts = ['activity', 'brief', 'deploy', 'games', 'next', 'panel', 'stage'];
    expect([...DESKTOP_MAIN_ORDER, ...DESKTOP_SIDE_ORDER].sort()).toEqual(parts);
    expect([...TABLET_TOP_ORDER, 'panel', ...TABLET_SIDE_ORDER].sort()).toEqual(parts);
    expect([...STACKED_ORDER].sort()).toEqual(parts);
  });
});
