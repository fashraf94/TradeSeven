// src/screens/AgentBattleScreen.flagOff.golden.test.jsx
//
// Phase A (A4.2) — FLAG-OFF IS THE SHIPPED SCREEN, BYTE FOR BYTE.
//
// The two goldens under ./__golden__ were captured from a git worktree of the
// PRE-BUILD commit eaf2a0e2 (the D-58 docs merge, the base of every Phase A
// commit) — not from this tree with the flag off — because ProximityLabel,
// TacticalRow and AgentChat all changed under flag-off during A1 → A3
// (output-identical by test, which is exactly the claim a golden should carry
// rather than assume). The capture ran this same fixture module, under this
// same pinned clock, with these same mocks, through renderToString in that
// worktree, and wrote the html here. This test renders the CURRENT tree with
// the controller off and asserts string equality with the photograph
// (the ManageStation.sync.render.test.jsx precedent — the repo has no
// snapshot idiom).
//
// Regenerate ONLY when the flag-off render is meant to change (a flag-off PR
// such as bug 1 / bug 2), by re-running the capture in a worktree of the
// commit whose output is the new truth — never by pasting this tree's output
// into the file, which would make the test compare the tree with itself.
//
// The sanctioned flag-off change of Phase A (D-62 — the Desk's closed-phase
// string) lives on the dashboard Desk, which this screen never renders, so no
// row here needs excluding by name; the golden is the whole page.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { PINNED_NOW, HOOK_RESULT, BATTLE, CHAT_PROPS } from './agentBattleScreenGoldenFixture';

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
  // THE CONTROLLER OFF — the whole point of this file.
  isBattleViewControllerOn: () => false,
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

const strip = (h) => h.replace(/<!-- -->/g, '');
const golden = (name) => readFileSync(new URL(`./__golden__/${name}`, import.meta.url), 'utf8');

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(PINNED_NOW)); });
afterEach(() => { vi.useRealTimers(); });

const renderScreen = () => strip(renderToString(
  <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={() => {}} />,
));
const renderChat = () => strip(renderToString(<AgentChat {...CHAT_PROPS} />));

describe('flag-off is the pre-build screen, byte for byte (rulings §3.7)', () => {
  it('the tabbed screen\'s first paint equals the eaf2a0e2 photograph', () => {
    const html = renderScreen();
    expect(html.length).toBeGreaterThan(20000);
    expect(html).toBe(golden('agentBattleScreen.tabbed.html'));
  });

  it('the chat (the Command Center tab\'s body) equals the eaf2a0e2 photograph', () => {
    const html = renderChat();
    expect(html.length).toBeGreaterThan(5000);
    expect(html).toBe(golden('agentChat.tabbed.html'));
  });

  it('the photograph is of the shipped screen: tabs, the promise copy, no controller markup', () => {
    const screen = golden('agentBattleScreen.tabbed.html');
    const chat = golden('agentChat.tabbed.html');
    expect(screen).toContain('>Matchups<');
    expect(screen).toContain('>Command Center<');
    expect(screen).toContain('>Game Tape<');
    expect(screen).toContain('Day 2 of 3');
    expect(screen).toContain('Watchlist: Energy leaders');
    expect(screen).toContain('💣 5.6% to Bagger'); // the dollar branch (NVDA's cron levels)
    expect(screen).toContain('CASH');
    for (const attr of ['data-layout', 'data-chat-sheet', 'data-turn-state', 'data-this-turn', 'data-why-', 'data-game-tape']) {
      expect(screen).not.toContain(attr);
      expect(chat).not.toContain(attr);
    }
    expect(chat).toContain('DIRECTIVE LOCKED IN');
    expect(chat).toContain('Executing on next evaluation window');
    expect(chat).toContain('↳ from directive');
    expect(chat).toContain('You didn&#x27;t respond to this proposal'); // SSR escapes the apostrophe
    expect(chat).not.toContain('data-receipt');
    expect(chat).not.toContain('>Directive<');
  });
});
