// src/screens/AgentBattleScreen.paneOff.golden.test.jsx
//
// Phase A3 — PANE-OFF IS THE A2 CONTROLLER SCREEN, BYTE FOR BYTE.
//
// The sibling AgentBattleScreen.flagOff.golden.test.jsx photographs the SHIPPED
// TABBED screen (controller off). That golden still matters as the rollback
// path, but it is no longer what A3 puts at risk: the controller flipped live
// on September 4 2026 (PR #815), so the render every player now sees is the A2
// controller layout — the desktop PeekStrip column and the mobile three-detent
// ChatSheet — and NOTHING photographed it.
//
// A3 branches six sites in AgentBattleScreen as `paneOn ? <the pane> : <the A2
// JSX as merged>` (Phase 0 §2.1). The claim those branches make is that the
// else-arm is untouched. This file is the instrument for that claim: the
// golden was captured from a git worktree of the PRE-BUILD commit 8e63ea65
// (the controller flip merge, the base of every A3 commit) through
// __golden__/captureControllerOnGolden.test.jsx — not from this tree with the
// pane off, which would compare the tree with itself.
//
//   source commit  8e63ea65 (= origin/main at the A3 branch point)
//   sha256         47cf687e638870f9fb10679ea754a48a5907450c343ab2b4aeb98faa50ed0b6a
//   determinism    captured twice into separate directories and `cmp`-identical
//
// HAZARD 46. The photograph is the MOBILE first paint and can only ever be
// that: `useIsDesktop` reads window.innerWidth at MOUNT and renderToString runs
// in node with no window, so the desktop shell is structurally unphotographable
// here. Read `data-layout="mobile"` in the contract row below as a statement of
// that limit, not as a choice. The desktop shell's own guarantees live in
// AgentBattleScreen.layout.jsdom.test.jsx.
//
// The pane flag is mocked FALSE rather than left to its default. It ships false
// today, so the mock is redundant now — and it is the whole point of the file
// on the day the founder flips it, when the default stops being false and this
// row must keep asserting the FALLBACK render rather than quietly following the
// flag to the pane.
//
// Regenerate ONLY when the controller-on / pane-off render is MEANT to change,
// by re-running the capture in a worktree of the commit whose output is the new
// truth — never by pasting this tree's output into the file.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { PINNED_NOW, BATTLE } from './agentBattleScreenGoldenFixture';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));
vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../hooks/useAgentBattleId', () => ({ default: () => ({ agentBattleId: null, loading: false }) }));
vi.mock('../hooks/useWebSocketPrices', () => ({ useWebSocketPrices: () => ({ prices: {}, status: 'disconnected' }) }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
  isMatchupsBackdropOn: () => false,
  // THE CONTROLLER ON, THE PANE OFF — the fallback A3 must not disturb.
  isBattleViewControllerOn: () => true,
  isCharacterPaneOn: () => false,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));
vi.mock('../hooks/useAgentBattle', async () => {
  const { HOOK_RESULT: result } = await import('./agentBattleScreenGoldenFixture');
  return { default: () => result };
});

import AgentBattleScreen from './AgentBattleScreen';
import AgentChat from '../components/Agent/AgentChat';
import { CHAT_PROPS } from './agentBattleScreenGoldenFixture';

// THE ONE NORMALISATION, stated (review lens 3). "Byte for byte" below means
// byte for byte MODULO React's `<!-- -->` text-node separators — 62 of them in
// this page — which are stripped from the render AND were stripped at capture.
// They are hydration boundaries: moving one changes the shipped HTML without
// reddening this file. Everything else, including every attribute, every space
// and every generated id, is compared exactly.
const strip = (h) => h.replace(/<!-- -->/g, '');
const golden = () => readFileSync(new URL('./__golden__/agentBattleScreen.controllerOn.paneOff.html', import.meta.url), 'utf8');

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(PINNED_NOW)); });
afterEach(() => { vi.useRealTimers(); });

const renderScreen = () => strip(renderToString(
  <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={() => {}} />,
));

describe('pane-off is the A2 controller screen, byte for byte (D-93)', () => {
  it("the controller-on first paint equals the 8e63ea65 photograph", () => {
    const html = renderScreen();
    expect(html.length).toBeGreaterThan(20000);
    expect(html).toBe(golden());
  });

  it('the photograph is of the A2 controller render, not the tabbed screen', () => {
    // Guards the golden's own provenance: a regeneration from the wrong commit
    // (or from the tabbed screen) would still pass the equality row above, which
    // is exactly the failure mode the A4 review flagged as unprotectable by
    // machinery. These are the A2 markers the tabbed screen does not carry.
    const html = golden();
    expect(html).toContain('data-chat-layout="controller"');
    expect(html).toContain('data-turn-state=');      // the turn line (A1)
    expect(html).toContain('data-this-turn');        // the This turn strip (A3 of Phase A)
    expect(html).toContain('data-why-book-toggle');  // the book tap surface (D-89)
    expect(html).toContain('data-peek-line');        // the peek line the pane's bubble replaces
    expect(html).toContain('data-chat-sheet="peek"');
    // Hazard 46 restated as an assertion: this can only be the mobile paint.
    expect(html).toContain('data-layout="mobile"');
    // The tabbed screen's own furniture is absent — this is not that golden.
    expect(html).not.toContain('>Matchups<');
    expect(html).not.toContain('>Command Center<');
  });

  it('the photograph carries the header furniture A3.4 / A3.5 remove', () => {
    // The three things the declutter takes out from under the pane. Their
    // PRESENCE here is what makes the equality row above able to catch a leak:
    // gate one of them unconditionally instead of on paneOn and this file reds.
    const html = golden();
    expect(html).toContain('data-game-tape-link');
    expect(html).toContain('Watchlist:');
    expect(html).toContain('Game Tape');
  });

  it('no character-pane markup reaches the pane-off render', () => {
    // The forward-looking half. Every A3 surface stamps its own data attribute;
    // none of them may appear on this path at any point in the build. A branch
    // written `<CharacterPane/>` instead of `paneOn ? <CharacterPane/> : …`
    // fails HERE with a name, before it fails the byte comparison with a diff
    // nobody can read.
    const html = renderScreen();
    for (const attr of [
      'data-arena-header',
      'data-character-avatar',
      'data-character-bubble',
      'data-character-pane',
      'data-pane-section',
      'data-pane-overflow',
    ]) {
      expect(html, `${attr} leaked into the pane-off render`).not.toContain(attr);
    }
  });
});

describe('pane-off is A2 in the states the first paint cannot photograph', () => {
  it('the scope chip carries no pane-only styling in its A2 position', () => {
    // Review lens 3 F1 / lens 5 F8. A3.2 hoisted the chip so one element could
    // serve two homes, and carried `flex-shrink: 0` — a property the A2 chip
    // never had — into BOTH. The golden photographs an UNSCOPED first paint, so
    // it could not see it, and pane-off quietly stopped being byte-identical
    // the moment a player scoped the stream.
    const scoped = (scopeInComposer) => strip(renderToString(
      <AgentChat
        {...CHAT_PROPS}
        controllerLayout
        controllerCopy
        tapeEntries={[]}
        scopeSymbol="SLB"
        onClearScope={() => {}}
        scopeInComposer={scopeInComposer}
      />,
    ));
    const a2 = scoped(false);
    const pane = scoped(true);
    // The chip renders on both paths…
    expect(a2).toContain('data-tape-scope="SLB"');
    expect(pane).toContain('data-tape-scope="SLB"');
    // …and only the pane's carries the property.
    const chipStyle = (html) => {
      const at = html.indexOf('data-tape-scope="SLB"');
      return html.slice(at, html.indexOf('>', at));
    };
    expect(chipStyle(a2)).not.toContain('flex-shrink');
    expect(chipStyle(pane)).toContain('flex-shrink:0');
  });
});
