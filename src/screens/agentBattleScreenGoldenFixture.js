// src/screens/agentBattleScreenGoldenFixture.js
//
// The fixture behind the flag-off golden (Phase A, A4.2 — rulings §3.7).
// Plain data, no JSX, so the SAME module is imported by the capture run in a
// worktree of the pre-build commit (eaf2a0e2) and by the golden test in this
// tree: one fixture, two trees, byte-identical output or a red test.
//
// It is deliberately RICH — every flag-off branch the Phase A build touched
// under the flag-off path is exercised: TacticalRow / ProximityLabel (the
// ATR branch, the dollar branch via `dailyLevels`, a crypto side, a cash
// slot, an empty slot), the closed trades, the Film Room banner, the day
// label, the trade count, the watchlist chip, the status dot, the tab dots
// (a feed the player has not seen; a bookmark), and — for the chat golden —
// directive cards, trade events joined to trades[], an unanswered proposal
// before the first auto-debrief, the grading cards after the last one.
//
// Everything is pinned: the clock, the prices (no fetch runs on the server
// paint), the doc. Nothing here is a claim about the product; it is a
// photograph's subject.

export const PINNED_NOW = '2026-09-01T17:00:00.000Z'; // Tue 1:00 PM ET, mid-session

const T_SWAP_1 = '2026-09-01T15:02:00.000Z'; // 11:02 AM ET
const T_SWAP_2 = '2026-09-01T16:17:00.000Z'; // 12:17 PM ET
const T_FILED_1 = '2026-09-01T15:31:00.000Z'; // 11:31 AM ET
const T_FILED_2 = '2026-09-01T16:58:00.000Z'; // 12:58 PM ET
const T_DEBRIEF = '2026-08-31T21:30:00.000Z'; // the previous evening's review

export const CHAT_EXCHANGES = [
  {
    messageType: 'first_message',
    userMessage: null,
    agentResponse: "Agent's live. MU and CRM in Star, DVN in Core as the energy hedge.",
    suggestedActions: null,
    timestamp: '2026-08-31T13:35:00.000Z',
  },
  {
    messageType: 'auto_debrief', isAutoDebrief: true, mode: 'review',
    userMessage: '__REVIEW_START__',
    agentResponse: 'Day one: held the book through the afternoon; one swap.',
    timestamp: T_DEBRIEF,
  },
  {
    userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true,
    directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
    directiveThreadId: 't-1', timestamp: T_FILED_1,
    suggestedActions: null,
  },
  {
    userMessage: 'actually lean into tech', agentResponse: 'Understood — leaning into tech strength.', hasDirective: true,
    directive: { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2' },
    directiveThreadId: 't-2', timestamp: T_FILED_2,
    suggestedActions: ['What changed?', 'Hold everything'],
  },
];

export const TRADES = [
  {
    symbolOut: 'MU', symbolIn: 'SLB', tier: 'star', swappedOutAt: T_SWAP_1,
    entryPrice: 90, exitPrice: 91.1, lockedPoints: 4, lockedGainPct: 1.22,
    exitReason: 'haiku_decision', rationale: 'MU rolled over; SLB leads energy.', evaluationId: 'eval_003',
  },
  {
    symbolOut: 'CRM', symbolIn: 'DVN', tier: 'core', swappedOutAt: T_SWAP_2,
    entryPrice: 250, exitPrice: 247.5, lockedPoints: -3, lockedGainPct: -1.0,
    exitReason: 'guardrail_stopLoss', rationale: 'CRM broke its level; DVN holds the trend.', evaluationId: 'eval_007',
  },
];

export const STATUS_FEED = [
  { action: 'swap', symbolOut: 'MU', symbolIn: 'SLB', message: 'Swapped MU for SLB — energy leadership.', timestamp: T_SWAP_1, evalId: 'eval_003', directiveThreadId: null, citedForgeRules: [] },
  { action: 'hold', message: 'Holding the book into the afternoon.', timestamp: '2026-09-01T15:47:00.000Z' },
  { action: 'swap', symbolOut: 'CRM', symbolIn: 'DVN', message: 'Swapped CRM for DVN on the directive.', timestamp: T_SWAP_2, evalId: 'eval_007', directiveThreadId: 't-1', regime: 'trending' },
  { action: 'hold', message: 'Holding.', timestamp: '2026-09-01T16:47:00.000Z' },
];

export const LIVE_DOC = {
  id: 'ab-1',
  agentId: 'agent-1',
  status: 'active',
  gameMode: 'baggerbomb',
  createdAt: '2026-08-31T13:00:00.000Z',
  activatedAt: '2026-08-31T13:30:00.000Z',
  agentContext: { agentName: 'Aurora', equippedWatchlist: { id: 'wl-1', name: 'Energy leaders' } },
  timing: { tradingDays: ['2026-08-31', '2026-09-01', '2026-09-02'], currentTradingDay: 2 },
  scoreState: {
    currentScore: 12, opponentScore: 3, tradeCount: 2, evaluationCount: 9,
    lastScoredAt: '2026-09-01T16:47:00.000Z',
  },
  scoring: { thresholds: { AAPL: { threshold: 1.8 }, NVDA: { threshold: 3.2 }, SLB: { threshold: 2.1 }, 'BTC-USD': { threshold: 4.0 } } },
  thresholdHistory: { AAPL: { maxMultiplier: 1.2, minMultiplier: 0 }, NVDA: { maxMultiplier: 0, minMultiplier: -0.4 } },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, swappedInAt: T_SWAP_1 }],
    core: [{ symbol: 'NVDA' }, { symbol: 'DVN', swapPrice: 41.2, swappedInAt: T_SWAP_2 }],
    support: [{ symbol: 'ITW' }, { symbol: 'BTC-USD', isCrypto: true, direction: 'long' }],
    startingPrices: { AAPL: 150, NVDA: 900, ITW: 240, 'BTC-USD': 60000 },
  },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }, { symbol: 'IBM' }], core: [{ symbol: 'CI' }, { symbol: 'MAR' }], support: [{ symbol: 'NOW' }, { symbol: 'ETH-USD', isCrypto: true, direction: 'long' }] } },
  evaluations: [
    { evalId: 'eval_009', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', downgraded: false, rationale: 'Held the book.', haikuError: null },
  ],
  trades: TRADES,
  statusFeed: STATUS_FEED,
  dailyReviews: [{ date: '2026-08-31', selfGrade: 'B', summary: 'Held the line.' }],
  chatExchanges: CHAT_EXCHANGES,
  directive: { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2', createdAt: T_FILED_2 },
  proposalHistory: [{ proposalId: 'p-1', resolution: 'lapsed', symbolOut: 'AAPL', symbolIn: 'MSFT' }],
  dailyGrades: {},
  chatBudgetUsed: 3,
  reviewBudgetUsed: 1,
  feedBookmarks: [{ evalId: 'eval_003' }],
};

/** What useAgentBattle hands the screen (useAgentBattle.js:49-58). */
export const HOOK_RESULT = {
  battle: LIVE_DOC,
  statusFeed: STATUS_FEED,
  executionMode: 'copilot',
  pendingProposal: null,
  strategyPreset: 'balanced',
  gameplanMeeting: null,
  chatExchanges: CHAT_EXCHANGES,
  chatBudgetUsed: 3,
  feedBookmarks: LIVE_DOC.feedBookmarks,
  loading: false,
};

/** The frozen `battle` PROP the flag-off rows read (DashboardDesktop.jsx:79-93). */
export const BATTLE = {
  agentId: 'agent-1',
  agentBattleId: 'ab-1',
  creator: {
    portfolio: {
      star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, swappedInAt: T_SWAP_1 }],
      // NVDA carries cron dollar levels → the label's dollar branch.
      core: [{ symbol: 'NVDA', dailyLevels: { baggerBomb: 950, doubleBagger: 1000, bust: 870 } }, { symbol: 'DVN', swapPrice: 41.2, swappedInAt: T_SWAP_2 }],
      // A crypto side, and a cash slot (V5 dormant rendering); the third
      // support slot is left empty on the CPU side.
      support: [{ symbol: 'ITW' }, { symbol: 'BTC-USD', isCrypto: true, direction: 'long' }, { isCash: true, symbol: 'CASH', previousAsset: 'MAR' }],
    },
  },
  opponent: {
    portfolio: {
      star: [{ symbol: 'MSFT' }, { symbol: 'IBM' }],
      core: [{ symbol: 'CI' }, { symbol: 'MAR' }],
      support: [{ symbol: 'NOW' }, { symbol: 'ETH-USD', isCrypto: true, direction: 'short' }],
    },
  },
  state: { startingPrices: { AAPL: 150, NVDA: 900, ITW: 240, 'BTC-USD': 60000, MSFT: 400, IBM: 180, CI: 320, MAR: 210, NOW: 700, 'ETH-USD': 3000 } },
};

/** AgentChat's props for the chat golden (the screen's own wiring, flag-off). */
export const CHAT_PROPS = {
  battleId: 'ab-1',
  agentId: 'agent-1',
  agentName: 'Aurora',
  chatExchanges: CHAT_EXCHANGES,
  battleStatus: 'active',
  statusFeed: STATUS_FEED,
  trades: TRADES,
  knownTickers: new Set(['AAPL', 'SLB', 'NVDA', 'DVN', 'ITW', 'BTC-USD']),
  dailyGrades: {},
  chatBudgetUsed: 3,
  reviewBudgetUsed: 1,
  proposalHistory: LIVE_DOC.proposalHistory,
};
