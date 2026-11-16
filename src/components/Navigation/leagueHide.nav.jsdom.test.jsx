// @vitest-environment jsdom
//
// League hide (direction note BB-1; founder ruling Q5, Nov 15, 2026) — the nav slot, phone and desktop. With
// LEAGUE_HIDE_ENABLED on, the retired Agent Hub's slot reads "BaggerBomb" with a bomb icon and still sets the 'league'
// screen id, which App's route renders as the BaggerBomb page. With it off (as shipped) the slot is today's: "League" with
// the trophy, behind TOURNAMENT_TAB_ENABLED, and absent when that is off.
//
// Both navs build their item list at module load, so each state is a fresh import of the real module (`vi.resetModules`)
// under a mocked flag module that holds the real values for every other flag. The constant is never asserted here (the pin
// is src/config/leagueHideFlag.test.js).

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ hide: false, tab: true }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get LEAGUE_HIDE_ENABLED() { return h.hide; },
  get TOURNAMENT_TAB_ENABLED() { return h.tab; },
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    tokens: {
      bgCard: '#111', bgApp: '#000', borderDefault: '#222', teal: '#0ff', glowTealNav: 'none', textMuted: '#999', textPrimary: '#fff',
      textFaint: '#888', borderDivider: '#333', bgInput: '#111', red: '#f00', green: '#0f0',
    },
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
let host = null;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  host.remove();
  vi.resetModules();
});

/** The real navs, imported afresh under this state of the two flags. */
async function load({ hide, tab }) {
  h.hide = hide;
  h.tab = tab;
  vi.resetModules();
  const [{ default: BottomNav }, { default: DesktopSidebar }] = await Promise.all([
    import('./BottomNav'),
    import('./DesktopSidebar'),
  ]);
  return { BottomNav, DesktopSidebar };
}

function mount(element) {
  root = createRoot(host);
  act(() => root.render(element));
  return host;
}
const labels = (scope) => [...scope.querySelectorAll('button')].map((b) => b.textContent.trim());
const buttonNamed = (scope, name) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === name) || null;
/** The lucide icon an item drew: lucide stamps its icon name on the svg's class. */
const iconOf = (button) => [...(button.querySelector('svg')?.classList ?? [])].find((c) => /^lucide-(?!svg$)/.test(c)) ?? null;

describe('league hide, nav — phone bottom nav', () => {
  it('ON: the slot is "BaggerBomb" with a bomb icon, "League" is gone, and it sets the league screen id', async () => {
    const { BottomNav } = await load({ hide: true, tab: true });
    const setScreen = vi.fn();
    const nav = mount(<BottomNav screen="dashboard" setScreen={setScreen} setShowForge={vi.fn()} showForge={false} />);
    expect(labels(nav)).toEqual(['Compete', 'News', 'BaggerBomb', 'Forge', 'Search']);
    const slot = buttonNamed(nav, 'BaggerBomb');
    expect(iconOf(slot)).toBe('lucide-bomb');
    act(() => slot.click());
    expect(setScreen.mock.calls).toEqual([['league']]);
  });

  it('ON: the slot is there even with TOURNAMENT_TAB_ENABLED off (the hide, not the old tab flag, decides)', async () => {
    const { BottomNav } = await load({ hide: true, tab: false });
    const nav = mount(<BottomNav screen="dashboard" setScreen={vi.fn()} setShowForge={vi.fn()} showForge={false} />);
    expect(labels(nav)).toContain('BaggerBomb');
    expect(labels(nav)).not.toContain('League');
  });

  it('ON: the slot is the active item while the league screen id is showing', async () => {
    const { BottomNav } = await load({ hide: true, tab: true });
    const nav = mount(<BottomNav screen="league" setScreen={vi.fn()} setShowForge={vi.fn()} showForge={false} />);
    expect(buttonNamed(nav, 'BaggerBomb').querySelector('span').style.fontWeight).toBe('600');
    expect(buttonNamed(nav, 'Compete').querySelector('span').style.fontWeight).toBe('400');
  });

  it('OFF, tab on (as shipped): "League" with the trophy, never "BaggerBomb"', async () => {
    const { BottomNav } = await load({ hide: false, tab: true });
    const setScreen = vi.fn();
    const nav = mount(<BottomNav screen="dashboard" setScreen={setScreen} setShowForge={vi.fn()} showForge={false} />);
    expect(labels(nav)).toEqual(['Compete', 'News', 'League', 'Forge', 'Search']);
    expect(iconOf(buttonNamed(nav, 'League'))).toBe('lucide-trophy');
    act(() => buttonNamed(nav, 'League').click());
    expect(setScreen.mock.calls).toEqual([['league']]);
  });

  it('OFF, tab off: the slot is absent, as before', async () => {
    const { BottomNav } = await load({ hide: false, tab: false });
    const nav = mount(<BottomNav screen="dashboard" setScreen={vi.fn()} setShowForge={vi.fn()} showForge={false} />);
    expect(labels(nav)).toEqual(['Compete', 'News', 'Forge', 'Search']);
  });
});

describe('league hide, nav — desktop sidebar', () => {
  const props = (over = {}) => ({
    screen: 'dashboard', setScreen: vi.fn(), setShowForge: vi.fn(), showForge: false, user: { wins: 3, losses: 1 },
    unreadCount: 0, collapsed: false, onToggleCollapse: vi.fn(), onLogout: vi.fn(), ...over,
  });

  it('ON: the slot is "BaggerBomb" with a bomb icon, "League" is gone, and it sets the league screen id', async () => {
    const { DesktopSidebar } = await load({ hide: true, tab: true });
    const p = props();
    const side = mount(<DesktopSidebar {...p} />);
    expect(buttonNamed(side, 'BaggerBomb')).not.toBeNull();
    expect(buttonNamed(side, 'League')).toBeNull();
    expect(iconOf(buttonNamed(side, 'BaggerBomb'))).toBe('lucide-bomb');
    act(() => buttonNamed(side, 'BaggerBomb').click());
    expect(p.setScreen.mock.calls).toEqual([['league']]);
    expect(p.setShowForge.mock.calls).toEqual([[false]]);
  });

  it('ON: the slot is there even with TOURNAMENT_TAB_ENABLED off', async () => {
    const { DesktopSidebar } = await load({ hide: true, tab: false });
    const side = mount(<DesktopSidebar {...props()} />);
    expect(buttonNamed(side, 'BaggerBomb')).not.toBeNull();
    expect(buttonNamed(side, 'League')).toBeNull();
  });

  it('OFF, tab on (as shipped): "League" with the trophy, never "BaggerBomb"', async () => {
    const { DesktopSidebar } = await load({ hide: false, tab: true });
    const side = mount(<DesktopSidebar {...props()} />);
    expect(buttonNamed(side, 'League')).not.toBeNull();
    expect(buttonNamed(side, 'BaggerBomb')).toBeNull();
    expect(iconOf(buttonNamed(side, 'League'))).toBe('lucide-trophy');
  });

  it('OFF, tab off: the slot is absent, as before', async () => {
    const { DesktopSidebar } = await load({ hide: false, tab: false });
    const side = mount(<DesktopSidebar {...props()} />);
    expect(buttonNamed(side, 'League')).toBeNull();
    expect(buttonNamed(side, 'BaggerBomb')).toBeNull();
  });
});
