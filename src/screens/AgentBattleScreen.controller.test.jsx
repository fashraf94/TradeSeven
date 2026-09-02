// src/screens/AgentBattleScreen.controller.test.jsx
//
// Phase A of the Battle View controller (BATTLE_VIEW_CONTROLLER_ENABLED, dark).
// Two things are proved here, both on the first paint (renderToString; effects
// do not run — the same harness as AgentBattleScreen.restFallback.test.jsx):
//
//   1. UNDER THE FLAG the score header carries the turn line, derived from the
//      subscribed doc through the SAME adapter arithmetic the Desk ships, and
//      the Matchups rows read the subscribed doc — `agentBattle.portfolio` —
//      not the frozen `battle` prop (D-59). The fixture plants a symbol the
//      agent swapped IN after the screen's prop was built (SLB) and the stale
//      one the prop still carries (MU): under the flag SLB renders and MU does
//      not; flag-off it is the other way round, exactly as shipped.
//
//   2. FLAG-OFF renders no turn line and no controller markup at all — the
//      controller's data attributes are absent from the html.
//
// The clock is pinned (the ManageStation.sync.render.test.jsx precedent):
// getMarketState() reads the wall clock, so the phase — and therefore the
// posture string — would otherwise depend on when the suite runs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const flagState = vi.hoisted(() => ({ on: true }));

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../hooks/useAgentBattleId', () => ({
  default: () => ({ agentBattleId: null, loading: false }),
}));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
  isMatchupsBackdropOn: () => false,
  // Read at render time by the screen, so one module can be toggled per test.
  isBattleViewControllerOn: () => flagState.on,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));

// The subscribed doc — the live source under the flag. The agent swapped MU
// out for SLB at 11:02 ET; the prop below was built before that.
const LIVE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: 'Aurora' },
  scoreState: {
    currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5,
    lastScoredAt: '2026-09-01T16:47:00.000Z', // 12:47 PM ET
  },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, swappedInAt: '2026-09-01T15:02:00.000Z' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
  },
  // The CPU side is static from deploy; the fixture's PROP carries a different
  // CPU symbol (MSFT) than the doc (AMD) so the CPU half of D-59 can fail (T1).
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [
    { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', rationale: 'Held SLB.', downgraded: false },
  ],
  trades: [],
  statusFeed: [],
  chatExchanges: [
    {
      userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true,
      directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
      directiveThreadId: 't-1', timestamp: '2026-09-01T15:31:00.000Z', // 11:31 AM ET
    },
  ],
  // createdAt in a DIFFERENT minute from the exchange (11:33 vs 11:31), so a
  // strip reading directive.createdAt is caught (T7).
  directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: '2026-09-01T15:33:00.000Z' },
};

vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: LIVE_DOC,
    statusFeed: [],
    executionMode: 'copilot',
    pendingProposal: null,
    strategyPreset: 'balanced',
    gameplanMeeting: null,
    // The real hook extracts these from the doc (useAgentBattle.js:54); the
    // mock must agree with the doc it hands back.
    chatExchanges: LIVE_DOC.chatExchanges,
    feedBookmarks: [],
    loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';

// The frozen prop: built when the battle was opened, before the MU → SLB swap.
const BATTLE = {
  agentId: 'agent-1',
  agentBattleId: 'ab-1',
  creator: {
    portfolio: {
      star: [{ symbol: 'AAPL' }, { symbol: 'MU' }],
      core: [{ symbol: 'NVDA' }],
      support: [],
    },
  },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900, MU: 90 } },
};

const PINNED_NOW = new Date('2026-09-01T17:00:00.000Z'); // Tue 1:00 PM ET, mid-session
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(PINNED_NOW); });
afterEach(() => { vi.useRealTimers(); });

const render = () => renderToString(
  <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />,
);

describe('under the flag — the controller', () => {
  beforeEach(() => { flagState.on = true; });

  it('the score header carries the turn line, from the adapter arithmetic the Desk ships', () => {
    const html = render();
    expect(html).toContain('Checked 12:47 PM · next ~1:02 PM');
    expect(html).toContain('data-turn-state="live"');
  });

  it('"decided" is keyed to the evaluations[] entry (>= the scoring stamp), not to the stamp', () => {
    expect(render()).toContain('data-decided="true"');
  });

  it('the rows read the SUBSCRIBED doc, not the frozen prop (D-59)', () => {
    const html = render();
    expect(html).toContain('SLB'); // swapped in after the prop was built
    expect(html).not.toContain('>MU<'); // the prop's stale symbol is gone
    expect(html).toContain('>AMD<'); // CPU rows from agentBattle.opponent.portfolio…
    expect(html).not.toContain('>MSFT<'); // …not from the prop's opponent
  });

  it('the label text is the row-computed proximity — the same math the label computed before the lift (T2)', () => {
    // No live price → priceChange 0 → distance = baseATR (2.5 by default) → `💣 2.5% to Bagger`.
    const html = render();
    expect((html.match(/💣 2\.5% to Bagger/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('every player row carries the visible Why? affordance; the CPU side does not (L5-F9)', () => {
    const html = render();
    expect((html.match(/data-why-label="1"/g) || []).length).toBe(3);
    expect((html.match(/>Why\?</g) || []).length).toBe(3);
  });

  it('shows no countdown and no agent verb', () => {
    const html = render();
    expect(html).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
    for (const term of ['watching', 'thinking', 'analyzing', 'about to', 'considering']) {
      expect(html.toLowerCase()).not.toContain(term);
    }
  });

  it('This turn sits above the board: the current directive, filed at the EXCHANGE time (A3)', () => {
    const html = render();
    expect(html).toContain('data-this-turn="filed"');
    expect(html).toContain('Filed 11:31 AM');
    expect(html).not.toContain('11:33');
    expect(html).toContain('Protect the lead into the close');
    // No promise about the next check rides the strip (hazard 3).
    expect(html).not.toContain('for the ~');
    // ...and it renders before the first tier header.
    expect(html.indexOf('data-this-turn')).toBeLessThan(html.indexOf('Star Picks'));
  });

  it('every player row is a Why? tap surface (role=button, collapsed); the CPU side never is (A2)', () => {
    const html = render();
    // Three held player pieces (AAPL, SLB, NVDA) → three collapsed buttons on
    // the left; the score header adds one for the book.
    const buttons = html.match(/role="button" tabindex="0" aria-expanded="false"/g) || [];
    expect(buttons.length).toBe(4);
    // Nothing is open on first paint — no panel in the tree.
    expect(html).not.toContain('data-why-kind');
  });
});

describe('flag-off — the shipped tabbed screen', () => {
  beforeEach(() => { flagState.on = false; });

  it('renders no turn line and no controller markup', () => {
    const html = render();
    expect(html).not.toContain('Checked 12:47 PM');
    expect(html).not.toContain('data-turn-state');
    expect(html).not.toContain('data-decided');
  });

  it('the rows read the prop, exactly as shipped (the freeze is bug 1, fixed separately)', () => {
    const html = render();
    expect(html).toContain('>MU<');
    expect(html).not.toContain('SLB');
    expect(html).toContain('>MSFT<');
    expect(html).not.toContain('>AMD<');
  });

  it('the label text is unchanged flag-off (T2)', () => {
    const html = render();
    expect((html.match(/💣 2\.5% to Bagger/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain('data-why-label');
  });

  it('no Why? tap surface, no panel (A2 is flag-only)', () => {
    const html = render();
    expect(html).not.toContain('aria-expanded');
    expect(html).not.toContain('data-why-kind');
  });

  it('no This turn strip (A3 is flag-only)', () => {
    const html = render();
    expect(html).not.toContain('data-this-turn');
    expect(html).not.toContain('Filed 11:31 AM');
  });
});
