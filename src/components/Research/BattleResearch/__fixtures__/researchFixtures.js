// Battle Research Slice 1 — test fixtures: the research sheet's measured six-stock book
// (Sheet/__fixtures__/sheetBattles.js measuredBookBattle: EQIX the weakest at −0.4 rungs, the
// 12:45 check) with the two groups filled in, the platform rankings doc and the route's body.
// Every number, lock and timestamp here is test data.

import { measuredBookBattle } from '../../Sheet/__fixtures__/sheetBattles.js';

const MIN = 60_000;

/** A second check at 2:15 PM ET in which KO drops to −0.69 rungs and becomes the weakest. */
export const KO_WEAKEST_CHECKS = Object.freeze([
  { at: '2026-10-14T16:45:40.000Z', quoteAt: Date.parse('2026-10-14T16:45:31.000Z') / 1000, quotes: {} },
  { at: '2026-10-14T18:15:40.000Z', quoteAt: Date.parse('2026-10-14T18:15:31.000Z') / 1000, quotes: { KO: 59.5 } },
]);
/** Wed Oct 14, 2026, 1:45 PM ET (EDT, UTC−4). The book's check is 12:45 PM. */
export const TAKEN_AT = Date.parse('2026-10-14T17:45:00.000Z');
export const RANKS_AT = Date.parse('2026-10-14T17:01:00.000Z'); // 1:01 PM ET
export const OPEN = Date.parse('2026-10-14T13:30:00.000Z');

/**
 * The battle: the measured book; the persisted bench MSFT, NVDA (locked until Thu 10:00 AM ET),
 * ORCL and a bench crypto; the hot bench PLTR and MSFT (MSFT on both groups); the equipped list
 * NOW (equipped only) and AAPL (held — left out).
 */
export async function researchBattle(over = {}, bookOpts = {}) {
  const b = await measuredBookBattle(bookOpts);
  b.portfolio.bench = {
    stocks: [{ symbol: 'MSFT', name: 'Microsoft', baseATR: 3 }, { symbol: 'NVDA', baseATR: 3.5, cooldownUntil: '2026-10-15T14:00:00.000Z' }, { symbol: 'ORCL', baseATR: 2.8 }],
    crypto: { symbol: 'SOL-USD.CC', name: 'Solana', isCrypto: true },
  };
  b.watchlist = { hotBench: ['PLTR', 'MSFT'], lastRefreshed: '2026-10-14T13:00:00.000Z' };
  b.agentContext = { ...b.agentContext, equippedWatchlist: { tickers: ['NOW', 'AAPL'] } };
  b.id = 'stock-battle';
  return { ...b, ...over };
}

const row = (symbol, technicalRank, sectorName, sectorTechnicalRank, sectorTechnicalTotal, atrPercent, extra = {}) => ({
  symbol, technicalRank, technicalScore: 100 - technicalRank / 3, sectorName, sectorTechnicalRank, sectorTechnicalTotal, techRaw: { atrPercent },
  arch_scores: { momentum_chaser: 90 - technicalRank / 4 }, ...extra,
});

/** The rankings doc as Firestore holds it (Timestamps), 228 ranked. NOW is not ranked. */
export function rankingsDoc(over = {}) {
  return {
    computedAt: { toMillis: () => RANKS_AT, seconds: RANKS_AT / 1000 },
    expiresAt: { toMillis: () => RANKS_AT + 75 * MIN, seconds: (RANKS_AT + 75 * MIN) / 1000 },
    mode: 'intraday',
    totalTechStocks: 228,
    stocks: [
      row('PLTR', 5, 'Technology', 2, 21, 4.06),
      row('NVDA', 12, 'Technology', 3, 21, 3.46),
      row('AAPL', 30, 'Technology', 6, 21, 2.1),
      row('MSFT', 40, 'Technology', 8, 21, 1.94),
      row('ORCL', 75, 'Technology', 12, 21, 2.83),
      row('KO', 100, 'Consumer Staples', 5, 18, 1.1),
      row('EQIX', 140, 'Real Estate', 9, 17, 1.02),
      row('JPM', 60, 'Financials', 4, 25, 1.6),
      row('XOM', 80, 'Energy', 3, 12, 2.2),
      row('CAT', 90, 'Industrials', 7, 20, 1.8),
      row('ZZZ', 200, 'Utilities', 9, 9, 1.0), // a ranked name outside the battle
    ],
    ...over,
  };
}

const quote = (changePercent, ageMin, over = {}) => ({ price: 100 + changePercent, previousClose: 100, changePercent, priceAsOf: TAKEN_AT - ageMin * MIN, sessionEtDate: '2026-10-14', collectionStalled: false, ...over });

/** The route's body at 1:45 PM: every battle name quoted 1–3 minutes ago, crypto included. */
export function quotesBody(over = {}) {
  return {
    servedAt: TAKEN_AT,
    snapshot: { sweepId: 'sweep-1', sweepAt: TAKEN_AT - 30_000, lastSuccessfulSweepAt: TAKEN_AT - 30_000 },
    quotes: {
      MSFT: quote(1.24, 2),
      NVDA: quote(-0.42, 1),
      ORCL: quote(2.05, 3),
      PLTR: quote(0.31, 2),
      NOW: quote(0.9, 2),
      'SOL-USD.CC': quote(3.3, 1),
      EQIX: quote(-0.81, 2),
      AAPL: quote(0.5, 2),
      ...over,
    },
  };
}
