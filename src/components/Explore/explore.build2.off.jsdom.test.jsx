// @vitest-environment jsdom
//
// Explore Build 2 — DARK MEANS IDENTICAL (build prompt K-2; spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md
// §8 check 19). With EXPLORE_MODE 'off' the Search page renders and requests what main does: its heading "Discover",
// its tab row, its search bar, no Explore tab, no research read, no stories read — and none of Build 2's own modules
// (the chain, the shelf, the jump row) is ever loaded, on any tab. Its own file: a module once loaded stays loaded for
// a file's life, so no row at 'on' may share it.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/exploreFlags', () => ({ EXPLORE_MODES: ['off', 'allowlist', 'on'], EXPLORE_MODE: 'off', exploreMode: () => 'off', EXPLORE_COMPARE_ROUTE: false, exploreCompareRoute: () => false }));
const read = vi.hoisted(() => vi.fn());
vi.mock('../../services/sharedResearchService', () => ({ readExploreInvestigations: read }));
vi.mock('../../firebase/config', () => ({ db: {} }));
const loaded = vi.hoisted(() => ({ chain: 0, shelf: 0, jump: 0, runtime: 0, tab: 0 }));
vi.mock('./ExploreChain', async (importOriginal) => { loaded.chain += 1; return importOriginal(); });
vi.mock('./ExploreShelf', async (importOriginal) => { loaded.shelf += 1; return importOriginal(); });
vi.mock('./ExploreJumpRow', async (importOriginal) => { loaded.jump += 1; return importOriginal(); });
vi.mock('./ExploreRuntime', async (importOriginal) => { loaded.runtime += 1; return importOriginal(); });
vi.mock('./ExploreTab', async (importOriginal) => { loaded.tab += 1; return importOriginal(); });
vi.mock('../Search/ExploreView', () => ({ default: function MarketsStub() { return <div data-stub="markets" />; } }));
vi.mock('../Search/RankingsView', () => ({ default: function RankingsStub() { return <div data-stub="rankings" />; } }));
vi.mock('../Search/InstitutionalView', () => ({ default: function InstitutionalStub() { return <div data-stub="institutional" />; } }));
vi.mock('../Search/ScreenerView', () => ({ default: function ScreenerStub() { return <div data-stub="screen" />; } }));
vi.mock('../draft/AssetResearchModal', () => ({ default: function AssetStub() { return null; } }));

const { default: SearchDiscover } = await import('../Search/SearchDiscover');
const { fixtureSources, mount, flush, click, $, $$, buttonNamed, until } = await import('./__fixtures__/exploreKit');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.setConfig({ testTimeout: 15_000 });

describe("K-2: at 'off' nothing of Build 2 renders or loads", () => {
  it('the heading and the tab row are today\'s on every tab; no Explore module — Build 2\'s chain, shelf and jump row included — is ever loaded; nothing is read', async () => {
    const sources = fixtureSources();
    const m = mount(<SearchDiscover user={{ uid: 'u-off' }} isMobile isDesktop={false} setScreen={vi.fn()} stocksData={[]} sidebarCollapsed={false} />, { sources });
    try {
      await flush();
      expect($('h1').textContent).toBe('Discover');
      for (const label of ['Rankings', 'Institutional', 'Screen', 'Explore']) {
        click(buttonNamed(label));
        await until(() => buttonNamed(label), label);
        await flush();
        expect($('h1').textContent, label).toBe('Discover');
        expect($$('button').filter((b) => b.style.borderRadius === '24px').length, label).toBeGreaterThan(0);
      }
      expect($('[data-explore-tab]')).toBeNull();
      expect(loaded).toEqual({ chain: 0, shelf: 0, jump: 0, runtime: 0, tab: 0 });
      expect(read).not.toHaveBeenCalled();
      expect(sources.calls).toEqual([]);
    } finally {
      m.unmount();
    }
  });
});
