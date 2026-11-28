// src/components/CommandCenter/hub/bookTabs.test.js
//
// The portfolio hub's slice 3 — the book layout's tabs, pure (hub/bookTabs.js; spec 20261126 §2, §4 slice 3; Amendment A PH-25,
// PH-28): their order and ids, where the layout opens from today's selection, a desk row's tab, and the parts' layout from the hub's
// composition and width.

import { describe, expect, it } from 'vitest';
import { BOOK_PARTS_P320_BELOW, BOOK_SHEETS, BOOK_TAB_ORDER, BOOK_TABS, bookPartsLayoutOf, bookTabForDesk, bookTabOf } from './bookTabs';
import { HUB_AREAS, HUB_COMPOSITIONS, PHONE_TABS } from './composition';
import { HUB_SHEETS } from './useHubSheets';
import { layoutOfWidth } from '../../PracticeField/ideaBookCopy';

describe('the four tabs', () => {
  it('Overview · Ideas · Setups · Partnership, in the design\'s order and ids; Loadout is not a tab (PH-17)', () => {
    expect(BOOK_TAB_ORDER).toEqual(['overview', 'ideas', 'setups', 'partnership']);
    expect(Object.values(BOOK_TABS).sort()).toEqual([...BOOK_TAB_ORDER].sort());
    expect(BOOK_TAB_ORDER).not.toContain(PHONE_TABS.LOADOUT);
    expect(Object.isFrozen(BOOK_TABS) && Object.isFrozen(BOOK_TAB_ORDER)).toBe(true);
  });
});

describe('where the book layout opens: today\'s selection when the decision arrives (PH-9)', () => {
  it.each([
    ['the phone\'s Overview', PHONE_TABS.OVERVIEW, 'overview'],
    ['the phone\'s Research', PHONE_TABS.RESEARCH, 'ideas'],
    ['the phone\'s Partnership', PHONE_TABS.PARTNERSHIP, 'partnership'],
    ['the phone\'s Loadout (no tab here)', PHONE_TABS.LOADOUT, 'overview'],
    ['the wide Partnership area', HUB_AREAS.PARTNERSHIP, 'partnership'],
    ['the wide Shared Research area', HUB_AREAS.RESEARCH, 'ideas'],
    ['the wide Equipped Archetype area (the wide default)', HUB_AREAS.ARCHETYPE, 'overview'],
    ['nothing', undefined, 'overview'],
    ['a value of no kind', 'ideas-ish', 'overview'],
  ])('%s → %s', (_, selection, expected) => {
    expect(bookTabOf(selection)).toBe(expected);
  });
});

describe('a desk row\'s tab', () => {
  it('the archetype\'s desk opens Setups; the agent\'s opens Ideas; an unknown desk opens Ideas', () => {
    expect(bookTabForDesk('archetype')).toBe(BOOK_TABS.SETUPS);
    expect(bookTabForDesk('shadow')).toBe(BOOK_TABS.IDEAS);
    expect(bookTabForDesk(undefined)).toBe(BOOK_TABS.IDEAS);
  });
});

describe('the parts\' layout from the hub\'s composition and width (PH-28)', () => {
  it.each([
    [HUB_COMPOSITIONS.PHONE, 320, 'p320'],
    [HUB_COMPOSITIONS.PHONE, 359, 'p320'],
    [HUB_COMPOSITIONS.PHONE, 360, 'p390'],
    [HUB_COMPOSITIONS.PHONE, 390, 'p390'],
    [HUB_COMPOSITIONS.PHONE, null, 'p390'],
    [HUB_COMPOSITIONS.PHONE, 0, 'p390'],
    [HUB_COMPOSITIONS.DESKTOP, 1216, 'desk'],
    [HUB_COMPOSITIONS.DESKTOP, null, 'desk'],
    [HUB_COMPOSITIONS.TABLET, 834, 'p390'],
    [HUB_COMPOSITIONS.STACKED, 614, 'p390'],
    [HUB_COMPOSITIONS.STACKED, 320, 'p390'],
  ])('%s at %s → %s', (composition, width, expected) => {
    expect(bookPartsLayoutOf(composition, width)).toBe(expected);
  });

  it('the phone\'s 320 edge is the parts\' own (ideaBookCopy.js layoutOfWidth), so the two cannot drift apart', () => {
    expect(layoutOfWidth(BOOK_PARTS_P320_BELOW - 1)).toBe('p320');
    expect(layoutOfWidth(BOOK_PARTS_P320_BELOW)).toBe('p390');
  });
});

describe('the book layout\'s sheet keys', () => {
  it('the loadout\'s and the phone armory\'s are their own, beside the hub\'s sheet table, and collide with none of it (review S3W-2)', () => {
    expect(BOOK_SHEETS).toEqual({ LOADOUT: 'loadout', ARMORY: 'bookArmory' });
    for (const key of Object.values(BOOK_SHEETS)) expect(Object.values(HUB_SHEETS)).not.toContain(key);
    expect(BOOK_SHEETS.ARMORY).not.toBe(HUB_SHEETS.ARCHETYPE);
  });
});
