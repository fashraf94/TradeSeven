// src/screens/AgentBattleScreen.restFallback.test.jsx
//
// Containment B1 — AgentBattleScreen (the flagship ACTIVE battle screen: Compete
// tab → command dashboard → Deploy/Open → BattleViewScreen(agentDeployed) →
// here) must still compose and show its held symbols when the browser WebSocket
// transport is disabled.
//
// The repo ships no jsdom/RTL, so we renderToString the screen (react-dom/server;
// effects DON'T run). That is exactly the B1 first paint: with no effects,
// useWebSocketPrices returns its initial { prices:{}, status:'disconnected' } —
// identical to the permanently-disabled steady state — so the matchup view is
// driven by the `battle` prop's portfolios + startingPrices, NOT by the socket.
// This proves the screen does not blank or throw without WS; the REST *poll* that
// refreshes those prices every 60s is characterized behaviorally (identical
// idiom, same stockAPI.getMultipleStockPrices) in
// useArenaPriceContext.restFallback.test.jsx and Flat6BattleView shares it too.
//
// Only the data hooks (Firestore), theme, market-data service, and the two
// canvas/presence feature flags are stubbed; the real matchup render tree runs.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Neutralize the Firebase config module (throws at import without env vars).
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
// tokens: a Proxy returning a valid hex for any key — mirrors the full token map
// a real ThemeProvider supplies, so color helpers (e.g. DebateModal's hexToRgba)
// work without enumerating every key.
vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: null,
    statusFeed: [],
    executionMode: 'copilot',
    pendingProposal: null,
    strategyPreset: 'balanced',
    gameplanMeeting: null,
    chatExchanges: [],
    feedBookmarks: [],
    loading: false,
  }),
}));
vi.mock('../hooks/useAgentBattleId', () => ({
  default: () => ({ agentBattleId: null, loading: false }),
}));
// Flags OFF → no canvas backdrop, no presence face (both would touch the DOM).
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
  isMatchupsBackdropOn: () => false,
}));
// Market-data service: never hit in SSR (poll is an effect), but stub the module
// so no real network/cache graph loads.
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));

import AgentBattleScreen from './AgentBattleScreen';

// A training/deploy battle: held symbols + starting prices come from the prop.
const BATTLE = {
  agentId: 'agent-1',
  agentBattleId: 'ab-1',
  creator: {
    portfolio: {
      star: [{ symbol: 'AAPL' }],
      core: [{ symbol: 'NVDA' }],
      support: [],
    },
  },
  opponent: {
    portfolio: {
      star: [{ symbol: 'MSFT' }],
      core: [],
      support: [],
    },
  },
  state: { startingPrices: { AAPL: 150, NVDA: 900, MSFT: 400 } },
};

describe('AgentBattleScreen — composes with WS disabled (B1 first paint)', () => {
  it('mounts on the matchups tab without throwing and renders held symbols', () => {
    const html = renderToString(
      <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />,
    );
    // Held symbols surface from the battle prop, independent of the socket.
    expect(html).toContain('AAPL');
    expect(html).toContain('NVDA');
    // Real surface composed, not an early bail.
    expect(html.length).toBeGreaterThan(1000);
  });

  it('renders no vendor WebSocket URL or token in the produced markup', () => {
    const html = renderToString(
      <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />,
    );
    expect(html).not.toMatch(/api_token/i);
    expect(html).not.toMatch(/wss:\/\//i);
    expect(html).not.toMatch(/eodhistoricaldata/i);
  });
});
