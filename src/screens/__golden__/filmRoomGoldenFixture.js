// src/screens/__golden__/filmRoomGoldenFixture.js
//
// The legacy Film Room's golden fixture (Film Room A2, Amendment E BA-40): a
// completed two-day battle shaped the way the legacy screen reads it — daily
// reviews, trades, an auto-debrief, an anticipation line and a review-chat
// turn (FilmRoomChat renders mode 'review' only). The photograph is the
// screen's default view (the last day); day 1's review is not selected, and
// the theme mock maps every token to one colour, so a token swap inside a
// legacy component would not show — byte-identity of the legacy subtree also
// rests on its files being untouched (review A2L2-4). Invented ids and words
// only; no production data.

export const PINNED_NOW = '2026-09-26T15:00:00.000Z';

/** The battle App hands the route (currentBattle). */
export const BATTLE_PROP = Object.freeze({ id: 'golden-film-battle', agentBattleId: 'golden-film-battle', status: 'completed', ownerId: 'golden-owner' });

const D1 = '2026-09-24';
const D2 = '2026-09-25';

export const AGENT_BATTLE = {
  id: 'golden-film-battle',
  ownerId: 'golden-owner',
  agentId: 'golden-agent',
  status: 'completed',
  gameMode: 'baggerbomb_agent',
  completedAt: '2026-09-25T20:05:00.000Z',
  reviewBudgetUsed: 1,
  timing: { tradingDays: [D1, D2], currentTradingDay: 2, timezone: 'America/New_York' },
  agentContext: { agentName: 'Golden Agent', archetype: 'momentum' },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }],
    core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
    support: [{ symbol: 'KO' }, { symbol: 'PEP' }],
  },
  scoreState: { currentScore: 24.5, opponentScore: 11.25, activeScore: 20.5, bankedScore: 4 },
  dailyScores: [{ day: 1, score: 12.5 }, { day: 2, score: 24.5 }],
  trades: [
    { symbolOut: 'AMD', symbolIn: 'TSLA', tier: 'core', entryPrice: 150, exitPrice: 144.2, lockedPoints: -12.5, swappedOutAt: '2026-09-24T14:30:10.000Z', swapDay: 1, evalId: 'golden-e5' },
    { symbolOut: 'MSFT', symbolIn: 'NFLX', tier: 'star', entryPrice: 420, exitPrice: 423.1, lockedPoints: 8.25, swappedOutAt: '2026-09-25T16:30:05.000Z', swapDay: 2, evalId: 'golden-e12' },
  ],
  dailyReviews: [
    {
      tradingDay: 1, date: D1, createdAt: '2026-09-25T01:00:00.000Z',
      daySummary: 'Held the book through a choppy open and rotated out of AMD after the risk exit.',
      selfGrade: 'B', selfGradeRationale: 'Held positions as planned.',
      lessonLearned: 'Watch the opening range.',
      proposedRules: [{ text: 'Tighten stops into the close.' }],
    },
    {
      tradingDay: 2, date: D2, createdAt: '2026-09-26T01:00:00.000Z',
      daySummary: 'Rotated MSFT into NFLX on the breakout and held into the close.',
      selfGrade: 'A', selfGradeRationale: 'The rotation worked.',
      lessonLearned: 'Breakouts on volume held.',
      proposedRules: [],
    },
  ],
};

export const CHAT_EXCHANGES = [
  { userMessage: null, agentResponse: 'Watching NFLX for a breakout above 700.', messageType: 'anticipation', anticipationSource: 'haiku', timestamp: '2026-09-25T15:00:00.000Z', mode: 'battle' },
  { userMessage: null, agentResponse: 'Day 2 debrief: the NFLX rotation carried the score.', isAutoDebrief: true, messageType: 'auto_debrief', timestamp: '2026-09-26T01:05:00.000Z', mode: 'filmroom' },
  { userMessage: 'What happened with MSFT?', agentResponse: 'MSFT stalled while NFLX broke out on volume.', timestamp: '2026-09-26T02:00:00.000Z', mode: 'review' },
];

export const HOOK_RESULT = Object.freeze({ battle: AGENT_BATTLE, chatExchanges: CHAT_EXCHANGES, loading: false });
