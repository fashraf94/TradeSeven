// src/screens/__golden__/captureFlagOffGolden.test.jsx
//
// THE CAPTURE HARNESS for the flag-off goldens beside this file — committed so
// a regeneration is reproducible from a NAMED commit rather than from "this
// tree" (A4 review L4-M17: nothing executable can protect a golden's
// provenance; the procedure can at least be the same every time).
//
// It is SKIPPED unless GOLDEN_OUT_DIR is set, so the normal suite never
// writes a golden. To regenerate (only when the flag-off render is meant to
// change — a flag-off PR such as bug 1 / bug 2):
//
//   1. `git worktree add ../golden-src <the commit whose flag-off output is the new truth>`
//   2. copy THIS file and ../agentBattleScreenGoldenFixture.js into the
//      worktree at the same paths if that commit predates them
//   3. in the worktree: `GOLDEN_OUT_DIR=/abs/path/out node_modules/.bin/vitest run src/screens/__golden__/captureFlagOffGolden.test.jsx`
//   4. run it TWICE and `cmp` the two outputs (determinism), then copy them
//      over the two .html files here and record the source commit and the
//      files' sha256 in the PR
//
// Same mocks, same pinned clock, same `strip` as AgentBattleScreen.flagOff.golden.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { PINNED_NOW, HOOK_RESULT, BATTLE, CHAT_PROPS } from '../agentBattleScreenGoldenFixture';

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
  isBattleViewControllerOn: () => false,
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
import AgentChat from '../../components/Agent/AgentChat';

const OUT = process.env.GOLDEN_OUT_DIR;
const strip = (h) => h.replace(/<!-- -->/g, '');

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(PINNED_NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe.skipIf(!OUT)('capture the flag-off goldens (GOLDEN_OUT_DIR set)', () => {
  it('writes agentBattleScreen.tabbed.html and agentChat.tabbed.html', () => {
    mkdirSync(OUT, { recursive: true });
    const screen = strip(renderToString(
      <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={() => {}} />,
    ));
    const chat = strip(renderToString(<AgentChat {...CHAT_PROPS} />));
    writeFileSync(`${OUT}/agentBattleScreen.tabbed.html`, screen);
    writeFileSync(`${OUT}/agentChat.tabbed.html`, chat);
    expect(screen.length).toBeGreaterThan(20000);
    expect(chat.length).toBeGreaterThan(5000);
  });
});
