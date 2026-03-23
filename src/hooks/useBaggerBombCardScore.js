// useBaggerBombCardScore — lightweight client-side score computation for dashboard cards.
// Polls prices every 5s and computes BaggerBomb scores without Firebase writes,
// WebSocket, swap mode, or celebrations.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { calculateAssetScoreV3, flattenPortfolio } from '../utils/baggerBombUtils';
import { getBankedScoreTotal } from '../services/dailyScoringV4Service';

const CARD_POLL_INTERVAL = 5000; // 5 seconds
const SCORE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const scoreCache = new Map(); // battleId -> { my, opp, timestamp }

const CRYPTO_LIST = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'XRP', 'DOGE', 'SHIB', 'LTC', 'AAVE', 'ATOM', 'ALGO', 'XLM'];
const isCrypto = (symbol) =>
  CRYPTO_LIST.includes(symbol) || symbol?.endsWith('-USD') || POPULAR_CRYPTO.some(c => c.symbol === symbol);

function computePortfolioScore(portfolio, prices, openPriceMap, battleThresholds, prevClosePrices) {
  if (!portfolio || portfolio.length === 0) {
    return 0;
  }

  let totalBasePoints = 0;
  let totalBonusPoints = 0;

  portfolio.forEach((asset) => {
    if (!asset || asset.isCash) return;

    const assetOpenPrice = asset.swapPrice || openPriceMap[asset.symbol] || prices[asset.symbol] || 0;
    const currentPrice = prices[asset.symbol] || assetOpenPrice;
    const resolvedBaseATR = battleThresholds?.[asset.symbol]?.threshold || asset.baseATR || 2.5;

    if (!assetOpenPrice || assetOpenPrice === 0) return;

    const priceChange = ((currentPrice - assetOpenPrice) / assetOpenPrice) * 100;

    const prevClose = prevClosePrices[asset.symbol] || assetOpenPrice;
    const thresholdPriceChange = prevClose > 0
      ? ((currentPrice - prevClose) / prevClose) * 100
      : null;

    // No history or extremes on dashboard — pass empty objects
    const score = calculateAssetScoreV3({ ...asset, baseATR: resolvedBaseATR }, priceChange, {}, {}, thresholdPriceChange);

    totalBasePoints += score.basePoints;
    totalBonusPoints += score.bonusPoints;
  });

  return Math.round(totalBasePoints + totalBonusPoints);
}

export function useBaggerBombCardScore(battle, user) {
  const [currentPrices, setCurrentPrices] = useState({});
  const [previousClosePrices, setPreviousClosePrices] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const battleVersion = Number(battle?._v) || 0;
  const isApplicable = battleVersion >= 3 && battle?.state?.status === 'active';

  const userId = user?.odUserId || user?.username;
  const isCreator = useMemo(() => {
    if (!battle || !userId) return true;
    return (battle.creator?.odUserId || battle.creator?.uid) === userId ||
      battle.creator?.username === user?.username;
  }, [battle?.creator, userId, user?.username]);

  const myRole = isCreator ? 'creator' : 'opponent';
  const oppRole = isCreator ? 'opponent' : 'creator';

  const myPortfolio = useMemo(
    () => isApplicable ? flattenPortfolio(battle?.[myRole]?.portfolio) : [],
    [isApplicable, battle?.[myRole]?.portfolio],
  );
  const oppPortfolio = useMemo(
    () => isApplicable ? flattenPortfolio(battle?.[oppRole]?.portfolio) : [],
    [isApplicable, battle?.[oppRole]?.portfolio],
  );

  const openPrices = useMemo(() => battle?.state?.startingPrices || {}, [battle?.state?.startingPrices]);
  const battleThresholds = useMemo(() => battle?.thresholds || {}, [battle?.thresholds]);

  // Calendar day gate for previousClosePriceMap (mirrors V4 hook logic)
  const previousClosePriceMap = useMemo(() => {
    const map = { ...(openPrices || {}) };

    const activationDate = battle?.timing?.actualStart || battle?.state?.activatedAt;
    const isNewCalendarDay = (() => {
      if (!activationDate) return false;
      const actDate = new Date(typeof activationDate === 'object' && activationDate.toDate
        ? activationDate.toDate()
        : activationDate);
      const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const actET = new Date(actDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      return nowET.toDateString() !== actET.toDateString();
    })();

    if (isNewCalendarDay) {
      const fbPrevClose = battle?.state?.previousClosePrices;
      if (fbPrevClose && typeof fbPrevClose === 'object') {
        Object.entries(fbPrevClose).forEach(([sym, price]) => {
          if (price > 0) map[sym] = price;
        });
      }
      if (previousClosePrices && typeof previousClosePrices === 'object') {
        Object.entries(previousClosePrices).forEach(([sym, price]) => {
          if (price > 0) map[sym] = price;
        });
      }
    }

    return map;
  }, [openPrices, battle?.timing?.actualStart, battle?.state?.activatedAt, battle?.state?.previousClosePrices, previousClosePrices]);

  // Cron dailyLevels: when available and matching today (ET), use cron baselines
  // for threshold detection instead of EODHD previousClose. Mirrors V4 hook logic.
  const dailyLevels = battle?.state?.dailyLevels;
  const useCronLevels = useMemo(() => {
    if (!dailyLevels?.date || !dailyLevels?.assets) return false;
    if (Object.keys(dailyLevels.assets).length === 0) return false;
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    return dailyLevels.date === todayET;
  }, [dailyLevels?.date, dailyLevels?.assets]);

  const thresholdBaselines = useMemo(() => {
    if (!useCronLevels) return previousClosePriceMap;
    const map = { ...(openPrices || {}) };
    Object.entries(dailyLevels.assets).forEach(([sym, levels]) => {
      if (levels.baseline > 0) map[sym] = levels.baseline;
    });
    return map;
  }, [useCronLevels, dailyLevels?.assets, previousClosePriceMap, openPrices]);

  // Banked scores + closed trade points (static from battle document)
  const bankedMy = useMemo(() => getBankedScoreTotal(battle?.state?.dailyScores, myRole), [battle?.state?.dailyScores, myRole]);
  const bankedOpp = useMemo(() => getBankedScoreTotal(battle?.state?.dailyScores, oppRole), [battle?.state?.dailyScores, oppRole]);

  const closedMy = useMemo(() => {
    const trades = battle?.[myRole]?.closedTrades;
    return Array.isArray(trades) ? trades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0) : 0;
  }, [battle?.[myRole]?.closedTrades]);

  const closedOpp = useMemo(() => {
    const trades = battle?.[oppRole]?.closedTrades;
    return Array.isArray(trades) ? trades.reduce((sum, t) => sum + (t.lockedPoints || 0), 0) : 0;
  }, [battle?.[oppRole]?.closedTrades]);

  const fetchPrices = useCallback(async () => {
    const allAssets = [...myPortfolio, ...oppPortfolio].filter(Boolean);
    if (allAssets.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const symbols = [...new Set(allAssets.map(a => a.symbol))];
      const stockSymbols = symbols.filter(s => !isCrypto(s));
      const cryptoSymbols = symbols.filter(s => isCrypto(s));

      const [stockData, cryptoData] = await Promise.all([
        stockSymbols.length > 0 ? stockAPI.getMultipleStockPrices(stockSymbols) : {},
        cryptoSymbols.length > 0 ? stockAPI.getMultipleCryptoPrices(cryptoSymbols) : {},
      ]);

      const newPrices = {};
      const newPrevCloses = {};

      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.price) newPrices[symbol] = data.price;
        if (data?.previousClose) newPrevCloses[symbol] = data.previousClose;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.price) newPrices[symbol] = data.price;
        if (data?.previousClose) newPrevCloses[symbol] = data.previousClose;
      });

      if (Object.keys(newPrices).length > 0) {
        setCurrentPrices(prev => ({ ...prev, ...newPrices }));
      }
      if (Object.keys(newPrevCloses).length > 0) {
        setPreviousClosePrices(prev => ({ ...prev, ...newPrevCloses }));
      }
    } catch (err) {
      console.warn('[CardScore] price fetch failed:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [myPortfolio, oppPortfolio]);

  // Non-applicable battles: stop loading immediately
  useEffect(() => {
    if (!isApplicable) {
      setIsLoading(false);
    }
  }, [isApplicable]);

  // Immediate fetch when battle data is available
  useEffect(() => {
    if (!isApplicable) return;
    fetchPrices();
  }, [isApplicable, fetchPrices]);

  // Poll prices every 30s
  useEffect(() => {
    if (!isApplicable) return;
    const interval = setInterval(fetchPrices, CARD_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isApplicable, fetchPrices]);

  // Cache last valid scores so they persist across remounts / brief non-applicable gaps
  const battleId = battle?.id;
  const cached = battleId ? scoreCache.get(battleId) : null;
  const cacheValid = cached && (Date.now() - cached.timestamp < SCORE_CACHE_TTL);
  const lastScores = useRef(cacheValid ? { my: cached.my, opp: cached.opp } : { my: 0, opp: 0 });

  // Compute final scores
  const myScore = useMemo(() => {
    if (!isApplicable || Object.keys(currentPrices).length === 0) return lastScores.current.my;
    const active = computePortfolioScore(myPortfolio, currentPrices, openPrices, battleThresholds, thresholdBaselines);
    const score = Math.round(bankedMy + active + closedMy);
    lastScores.current.my = score;
    if (battleId) {
      const prev = scoreCache.get(battleId) || { my: 0, opp: 0, timestamp: Date.now() };
      scoreCache.set(battleId, { ...prev, my: score, timestamp: Date.now() });
    }
    return score;
  }, [isApplicable, myPortfolio, currentPrices, openPrices, battleThresholds, thresholdBaselines, bankedMy, closedMy, battleId]);

  const oppScore = useMemo(() => {
    if (!isApplicable || Object.keys(currentPrices).length === 0) return lastScores.current.opp;
    const active = computePortfolioScore(oppPortfolio, currentPrices, openPrices, battleThresholds, thresholdBaselines);
    const score = Math.round(bankedOpp + active + closedOpp);
    lastScores.current.opp = score;
    if (battleId) {
      const prev = scoreCache.get(battleId) || { my: 0, opp: 0, timestamp: Date.now() };
      scoreCache.set(battleId, { ...prev, opp: score, timestamp: Date.now() });
    }
    return score;
  }, [isApplicable, oppPortfolio, currentPrices, openPrices, battleThresholds, thresholdBaselines, bankedOpp, closedOpp, battleId]);

  return { myScore, oppScore, isLoading };
}
