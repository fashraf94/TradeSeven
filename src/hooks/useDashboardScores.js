// useDashboardScores — Centralized score polling for dashboard secondary battles.
// Reads prices from cacheService synchronously (no new API calls per tick).
// One-time bootstrap fetch seeds the cache for all battle symbols on mount.

import { useState, useEffect, useRef, useCallback } from 'react';
import cacheService from '../services/cacheService';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { calculateAssetScoreV3, flattenPortfolio } from '../utils/baggerBombUtils';
import { getBankedScoreTotal } from '../services/dailyScoringV4Service';
import { usePageVisibility } from './usePageVisibility';
import { buildDraftStandings } from '../components/Dashboard/ClashCard';

const POLL_INTERVAL = 5000; // 5 seconds
const LOG_EVERY_N_TICKS = 3; // log every 3rd tick = 15s

const CRYPTO_LIST = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'XRP', 'DOGE', 'SHIB', 'LTC', 'AAVE', 'ATOM', 'ALGO', 'XLM'];
const isCrypto = (symbol) =>
  CRYPTO_LIST.includes(symbol) || symbol?.endsWith('-USD') || POPULAR_CRYPTO.some(c => c.symbol === symbol);

// ─── Cache readers (synchronous, never trigger API calls) ──────────────────

function getCachedPrice(symbol) {
  const stock = cacheService.get('prices', symbol);
  if (stock?.price) return stock.price;
  const crypto = cacheService.get('crypto', symbol);
  return crypto?.price ?? null;
}

function getCachedPreviousClose(symbol) {
  const stock = cacheService.get('prices', symbol);
  if (stock?.previousClose) return stock.previousClose;
  const crypto = cacheService.get('crypto', symbol);
  return crypto?.previousClose ?? null;
}

// ─── Portfolio score computation (mirrors useBaggerBombCardScore) ───────────

function computePortfolioScore(portfolio, openPriceMap, battleThresholds, prevClosePrices) {
  if (!portfolio || portfolio.length === 0) return 0;

  let totalBasePoints = 0;
  let totalBonusPoints = 0;

  portfolio.forEach((asset) => {
    if (!asset || asset.isCash) return;

    const symbol = asset.symbol;
    const assetOpenPrice = asset.swapPrice || openPriceMap[symbol] || getCachedPrice(symbol) || 0;
    const currentPrice = getCachedPrice(symbol) || assetOpenPrice;
    const resolvedBaseATR = battleThresholds?.[symbol]?.threshold || asset.baseATR || 2.5;

    // Guards
    if (assetOpenPrice <= 0 || !isFinite(assetOpenPrice)) return;
    if (currentPrice <= 0 || !isFinite(currentPrice)) return;

    const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;

    const prevClose = prevClosePrices[symbol] || assetOpenPrice;
    const thresholdPriceChange = prevClose > 0
      ? ((currentPrice - prevClose) / prevClose) * 100
      : null;

    // No history or extremes on dashboard — pass empty objects
    const score = calculateAssetScoreV3(
      { ...asset, baseATR: resolvedBaseATR },
      priceChange,
      {},
      {},
      thresholdPriceChange,
    );

    totalBasePoints += score.basePoints;
    totalBonusPoints += score.bonusPoints;
  });

  return Math.round(totalBasePoints + totalBonusPoints);
}

// ─── Single battle score computation ───────────────────────────────────────

function computeBattleScores(battle, type, userId) {
  // Draft battles
  if (type === 'draft' || type === 'trainingDraft') {
    try {
      const { myPoints, leaderPoints } = buildDraftStandings(battle, userId);
      return { myScore: myPoints ?? 0, oppScore: leaderPoints ?? 0 };
    } catch {
      return null;
    }
  }

  // Only compute for V3+ active battles
  const battleVersion = Number(battle?._v) || 0;
  if (battleVersion < 3 || battle?.state?.status !== 'active') return null;

  // Determine roles
  const isCreator =
    (battle.creator?.odUserId || battle.creator?.uid) === userId ||
    battle.creator?.username === userId;
  const myRole = isCreator ? 'creator' : 'opponent';
  const oppRole = isCreator ? 'opponent' : 'creator';

  const myPortfolio = flattenPortfolio(battle[myRole]?.portfolio);
  const oppPortfolio = flattenPortfolio(battle[oppRole]?.portfolio);

  if (myPortfolio.length === 0 && oppPortfolio.length === 0) return null;

  const openPrices = battle.state?.startingPrices || {};
  const battleThresholds = battle.thresholds || {};

  // Build previous close map (for threshold detection)
  const prevClosePrices = { ...(openPrices || {}) };

  // Calendar day gate — use previousClosePrices if battle spans multiple days
  const activationDate = battle.timing?.actualStart || battle.state?.activatedAt;
  const isNewCalendarDay = (() => {
    if (!activationDate) return false;
    try {
      const actDate = new Date(
        typeof activationDate === 'object' && activationDate.toDate
          ? activationDate.toDate()
          : activationDate,
      );
      const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const actET = new Date(actDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      return nowET.toDateString() !== actET.toDateString();
    } catch {
      return false;
    }
  })();

  if (isNewCalendarDay) {
    const fbPrevClose = battle.state?.previousClosePrices;
    if (fbPrevClose && typeof fbPrevClose === 'object') {
      Object.entries(fbPrevClose).forEach(([sym, price]) => {
        if (price > 0) prevClosePrices[sym] = price;
      });
    }
    // Overlay cached previousClose values
    const allSymbols = [...new Set([...myPortfolio, ...oppPortfolio].map(a => a.symbol).filter(Boolean))];
    allSymbols.forEach((sym) => {
      const cached = getCachedPreviousClose(sym);
      if (cached > 0) prevClosePrices[sym] = cached;
    });
  }

  // Handle dailyLevels baselines (cron-based, mirrors useBaggerBombCardScore)
  const dailyLevels = battle.state?.dailyLevels;
  let thresholdBaselines = prevClosePrices;
  if (dailyLevels?.date && dailyLevels?.assets && Object.keys(dailyLevels.assets).length > 0) {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (dailyLevels.date === todayET) {
      thresholdBaselines = { ...(openPrices || {}) };
      Object.entries(dailyLevels.assets).forEach(([sym, levels]) => {
        if (levels.baseline > 0) thresholdBaselines[sym] = levels.baseline;
      });
    }
  }

  // Banked scores
  const bankedMy = getBankedScoreTotal(battle.state?.dailyScores, myRole);
  const bankedOpp = getBankedScoreTotal(battle.state?.dailyScores, oppRole);

  // Closed trade points
  const closedMy = (() => {
    const trades = battle[myRole]?.closedTrades;
    return Array.isArray(trades) ? trades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0) : 0;
  })();
  const closedOpp = (() => {
    const trades = battle[oppRole]?.closedTrades;
    return Array.isArray(trades) ? trades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0) : 0;
  })();

  const myActive = computePortfolioScore(myPortfolio, openPrices, battleThresholds, thresholdBaselines);
  const oppActive = computePortfolioScore(oppPortfolio, openPrices, battleThresholds, thresholdBaselines);

  return {
    myScore: Math.round(bankedMy + myActive + closedMy),
    oppScore: Math.round(bankedOpp + oppActive + closedOpp),
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDashboardScores(activeBattles, userId) {
  const [scores, setScores] = useState(() => new Map());
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const isVisible = usePageVisibility();
  const tickRef = useRef(0);
  const hasLoggedStart = useRef(false);
  const prevSymbolsKey = useRef('');

  // ─── Bootstrap: one-time batch fetch to seed cache ─────────────────────
  const collectAllSymbols = useCallback(() => {
    if (!activeBattles || activeBattles.length === 0) return [];
    const symbolSet = new Set();
    activeBattles.forEach(({ battle }) => {
      ['creator', 'opponent'].forEach((role) => {
        const portfolio = flattenPortfolio(battle[role]?.portfolio);
        portfolio.forEach((a) => {
          if (a?.symbol && !a.isCash) symbolSet.add(a.symbol);
        });
      });
      // Draft battles: check players array
      if (battle.players) {
        battle.players.forEach((p) => {
          const portfolio = flattenPortfolio(p?.portfolio);
          portfolio.forEach((a) => {
            if (a?.symbol && !a.isCash) symbolSet.add(a.symbol);
          });
        });
      }
    });
    return [...symbolSet];
  }, [activeBattles]);

  useEffect(() => {
    if (!activeBattles || activeBattles.length === 0) {
      setBootstrapDone(true);
      return;
    }

    const symbols = collectAllSymbols();
    const symbolsKey = symbols.sort().join(',');

    // Skip if symbols haven't changed
    if (symbolsKey === prevSymbolsKey.current && bootstrapDone) return;
    prevSymbolsKey.current = symbolsKey;

    if (symbols.length === 0) {
      setBootstrapDone(true);
      return;
    }

    const stockSymbols = symbols.filter((s) => !isCrypto(s));
    const cryptoSymbols = symbols.filter((s) => isCrypto(s));

    let cancelled = false;

    (async () => {
      try {
        await Promise.all([
          stockSymbols.length > 0 ? stockAPI.getMultipleStockPrices(stockSymbols) : Promise.resolve({}),
          cryptoSymbols.length > 0 ? stockAPI.getMultipleCryptoPrices(cryptoSymbols) : Promise.resolve({}),
        ]);
      } catch (err) {
        console.warn('[DashboardScores] Bootstrap fetch failed:', err.message);
      }
      if (!cancelled) setBootstrapDone(true);
    })();

    return () => { cancelled = true; };
  }, [activeBattles, collectAllSymbols, bootstrapDone]);

  // ─── Polling interval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!bootstrapDone || !activeBattles || activeBattles.length === 0) return;

    const computeAll = () => {
      // Pause when tab is hidden
      if (document.hidden) return;

      try {
        const newMap = new Map();

        activeBattles.forEach(({ battle, type }) => {
          const id = battle?.id;
          if (!id) return;

          const result = computeBattleScores(battle, type, userId);
          if (result) {
            newMap.set(id, result);
          }
        });

        setScores(newMap);

        // Diagnostic logging
        tickRef.current += 1;
        if (!hasLoggedStart.current && newMap.size > 0) {
          console.log('[DashboardScores] Polling started for', activeBattles.length, 'battles');
          hasLoggedStart.current = true;
        }
        if (tickRef.current % LOG_EVERY_N_TICKS === 0) {
          console.log('[DashboardScores] Updated scores for', newMap.size, 'battles');
        }
      } catch (err) {
        console.warn('[DashboardScores] Tick error:', err.message);
      }
    };

    // Compute immediately, then poll
    computeAll();
    const interval = setInterval(computeAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [bootstrapDone, activeBattles, userId, isVisible]);

  return scores;
}
