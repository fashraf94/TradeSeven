// src/screens/__golden__/captureControllerOnGolden.test.jsx
//
// THE CAPTURE HARNESS for the CONTROLLER-ON / PANE-OFF golden beside this file
// — the A3 fallback photograph. Sibling of captureFlagOffGolden.test.jsx, which
// captures the two flag-off (tabbed-screen) goldens; that one mocks the
// controller OFF, this one mocks it ON and the character pane OFF.
//
// WHY A SECOND GOLDEN. The flag-off goldens photograph the SHIPPED tabbed
// screen, which the controller flip made unreachable for players. A3 branches
// six sites in AgentBattleScreen as `paneOn ? <the pane> : <the A2 JSX as
// merged>`, so the thing at risk is no longer the tabbed screen — it is the A2
// controller render, which nothing photographs. This file is that photograph.
//
// It is SKIPPED unless GOLDEN_OUT_DIR is set, so the normal suite never writes
// a golden. To regenerate (only when the controller-on / pane-off render is
// MEANT to change):
//
//   1. `git worktree add ../golden-src <the commit whose output is the new truth>`
//   2. copy THIS file and ../agentBattleScreenGoldenFixture.js into the
//      worktree at the same paths if that commit predates them
//   3. in the worktree: `GOLDEN_OUT_DIR=/abs/path/out node_modules/.bin/vitest run src/screens/__golden__/captureControllerOnGolden.test.jsx`
//   4. run it TWICE and `cmp` the two outputs (determinism), then copy over the
//      .html file here and record the source commit and its sha256 in the PR
//
// THE MOCK SET IS DELIBERATELY IDENTICAL in a pre-pane tree and in this one:
// `isCharacterPaneOn` is mocked here even though the commit this golden was
// captured from (8e63ea65) does not export it. A mock factory that adds a key
// the module never had is inert — the screen at that commit never calls it —
// and keeping one mock set means the capture and the comparison
// (AgentBattleScreen.paneOff.golden.test.jsx) cannot drift apart.
//
// HAZARD 46, stated so nobody reads more into this file than it holds: the
// photograph is the MOBILE first paint. `useIsDesktop` reads window.innerWidth
// at MOUNT, and renderToString runs in node with no window, so the desktop
// shell cannot be photographed this way at all. The desktop layout stays
// covered by the jsdom suites (AgentBattleScreen.layout.jsdom.test.jsx).
//
// Same fixture, same pinned clock, same `strip` as the flag-off pair.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { PINNED_NOW, BATTLE } from '../agentBattleScreenGoldenFixture';

vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../../hooks/useAgentBattleId', () => ({ default: () => ({ agentBattleId: null, loading: false }) }));
vi.mock('../../hooks/useWebSocketPrices', () => ({ useWebSocketPrices: () => ({ prices: {}, status: 'disconnected' }) }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
  isMatchupsBackdropOn: () => false,
  // THE CONTROLLER ON, THE PANE OFF — the whole point of this file.
  isBattleViewControllerOn: () => true,
  isCharacterPaneOn: () => false,
}));
vi.mock('../../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));
vi.mock('../../hooks/useAgentBattle', async () => {
  const { HOOK_RESULT: result } = await import('../agentBattleScreenGoldenFixture');
  return { default: () => result };
});

import AgentBattleScreen from '../AgentBattleScreen';

const OUT = process.env.GOLDEN_OUT_DIR;
const strip = (h) => h.replace(/<!-- -->/g, '');

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(PINNED_NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe.skipIf(!OUT)('capture the controller-on / pane-off golden (GOLDEN_OUT_DIR set)', () => {
  it('writes agentBattleScreen.controllerOn.paneOff.html', () => {
    mkdirSync(OUT, { recursive: true });
    const screen = strip(renderToString(
      <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={() => {}} />,
    ));
    writeFileSync(`${OUT}/agentBattleScreen.controllerOn.paneOff.html`, screen);
    expect(screen.length).toBeGreaterThan(20000);
  });
});
