// __previewBattle.js — THROWAWAY dev fixture for the ?preview=baggerbomb gate.
//
// Not part of the product. Feeds a static, self-contained V2 battle object to
// BaggerBombBattleViewRedesign so the legacy BaggerBomb battle view can be
// eyeballed on a Vercel preview without creating a real battle, route, or flag.
// Shape mirrors the V2 `trainingBattle` template in App.jsx (the one the comment
// there calls "V2 structure … for BaggerBombBattleViewRedesign compatibility").
//
// To remove the whole preview: delete this file, the `?preview=baggerbomb`
// mount effect in App.jsx, and the `screen === 'baggerBombPreview'` block.

// A creator lineup of 6 assets. amount/1,000,000*100 = allocation% → multiplier
// chip (≥20% ⭐2x, ≥15% 💎1.5x, else 🛡️1x). price doubles as the starting price.
const CREATOR_PORTFOLIO = [
  { symbol: 'NVDA',  name: 'NVIDIA Corp',        price: 172.40, amount: 200000 },
  { symbol: 'AAPL',  name: 'Apple Inc',          price: 231.20, amount: 200000 },
  { symbol: 'MSFT',  name: 'Microsoft Corp',     price: 442.10, amount: 150000 },
  { symbol: 'AMD',   name: 'Advanced Micro Dev',  price: 166.85, amount: 150000 },
  { symbol: 'GOOGL', name: 'Alphabet Inc',       price: 182.55, amount: 150000 },
  { symbol: 'META',  name: 'Meta Platforms',     price: 561.30, amount: 150000 },
];

const OPPONENT_PORTFOLIO = [
  { symbol: 'TSLA', name: 'Tesla Inc',          price: 248.90, amount: 200000 },
  { symbol: 'AMZN', name: 'Amazon.com Inc',     price: 186.70, amount: 200000 },
  { symbol: 'AVGO', name: 'Broadcom Inc',       price: 164.30, amount: 150000 },
  { symbol: 'CRM',  name: 'Salesforce Inc',     price: 267.40, amount: 150000 },
  { symbol: 'NFLX', name: 'Netflix Inc',        price: 702.10, amount: 150000 },
  { symbol: 'COIN', name: 'Coinbase Global',    price: 241.55, amount: 150000 },
];

// Starting prices = each asset's base price. If live price polling succeeds on
// the preview, the cards animate real movement vs these; off-hours/offline they
// simply render at 0% — the layout is the point either way.
const startingPrices = {};
[...CREATOR_PORTFOLIO, ...OPPONENT_PORTFOLIO].forEach((a) => { startingPrices[a.symbol] = a.price; });

// Per-symbol thresholds in the shape getAssetProgress expects ({ threshold, … }).
// Varied a little so the "X% toward Y% threshold" labels aren't all identical.
const thresholds = {};
[...CREATOR_PORTFOLIO, ...OPPONENT_PORTFOLIO].forEach((a, i) => {
  const base = [2.0, 2.5, 3.0, 3.5][i % 4];
  thresholds[a.symbol] = { threshold: base, rallyThreshold: base * 1.5, moonshotThreshold: base * 2.0 };
});

// Fixed timestamps (no Date.now — keep the fixture deterministic).
const CREATED_AT = '2026-07-23T13:30:00.000Z';
const START_AT = '2026-07-23T13:30:00.000Z';
const END_AT = '2026-07-24T00:00:00.000Z';

export const PREVIEW_USER = { uid: 'preview', odUserId: 'preview', username: 'preview' };

export const PREVIEW_BATTLE = {
  id: 'preview_baggerbomb',
  challengeCode: 'PREVIEW',
  _v: 2, // BaggerBomb Scoring version marker → routes to BaggerBombBattleViewRedesign

  creator: {
    uid: 'preview',
    odUserId: 'preview',
    username: 'preview',
    portfolioName: 'Preview Lineup',
    portfolio: CREATOR_PORTFOLIO,
    bench: [],
    portfolioType: 'baggerbomb',
    cryptoAllocation: 10,
    avatar: '🧑‍💻',
  },

  opponent: {
    uid: 'cpu',
    odUserId: 'cpu',
    username: 'CPU Opponent',
    portfolioName: 'CPU BaggerBomb Strategy',
    portfolio: OPPONENT_PORTFOLIO,
    bench: [],
    portfolioType: 'baggerbomb',
    cryptoAllocation: 10,
    avatar: '🤖',
  },

  timeline: { createdAt: CREATED_AT, startDate: START_AT, endDate: END_AT, completedAt: null },

  state: {
    status: 'active',
    currentSession: '',
    completedSessions: [],
    startingPrices,
  },

  sessionPrices: {
    MORNING_BELL: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
    MIDDAY: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
    POWER_HOUR: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
    NIGHT_GAME: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
  },

  thresholds,
  breakouts: { creator: [], opponent: [] },
  substitutions: [],
  sessionScores: {
    MORNING_BELL: { creator: 0, opponent: 0, winner: '' },
    MIDDAY: { creator: 0, opponent: 0, winner: '' },
    POWER_HOUR: { creator: 0, opponent: 0, winner: '' },
    NIGHT_GAME: { creator: 0, opponent: 0, winner: '' },
  },

  // Legacy/classic-view compatibility fields (in case of fallthrough)
  creatorPortfolio: CREATOR_PORTFOLIO,
  opponentPortfolio: OPPONENT_PORTFOLIO,
  portfolioType: 'baggerbomb',
  status: 'active',
  startDate: START_AT,
  endDate: END_AT,
  startingPrices,
  isTraining: false,
  isTrainingBattle: false,
  createdAt: CREATED_AT,
};
