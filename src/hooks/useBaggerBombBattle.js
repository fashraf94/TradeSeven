import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';

// ==================== CONSTANTS ====================

const PRICE_POLL_INTERVAL = 60000; // 60 seconds

const SESSIONS = {
  MORNING_BELL: {
    id: 'MORNING_BELL',
    label: 'Morning Bell',
    shortLabel: 'Morning',
    startHour: 9.5,   // 9:30 AM ET
    endHour: 11.5,    // 11:30 AM ET
    allowsStocks: true,
    allowsCrypto: true,
    color: '#fbbf24'
  },
  MIDDAY: {
    id: 'MIDDAY',
    label: 'Midday',
    shortLabel: 'Midday',
    startHour: 11.5,  // 11:30 AM ET
    endHour: 14,      // 2:00 PM ET
    allowsStocks: true,
    allowsCrypto: true,
    color: '#f97316'
  },
  POWER_HOUR: {
    id: 'POWER_HOUR',
    label: 'Power Hour',
    shortLabel: 'Power Hour',
    startHour: 14,    // 2:00 PM ET
    endHour: 16,      // 4:00 PM ET
    allowsStocks: true,
    allowsCrypto: true,
    color: '#8b5cf6'
  },
  NIGHT_GAME: {
    id: 'NIGHT_GAME',
    label: 'Night Game',
    shortLabel: 'Night',
    startHour: 16,    // 4:00 PM ET
    endHour: 20,      // 8:00 PM ET
    allowsStocks: false,
    allowsCrypto: true,
    color: '#3b82f6'
  }
};

const SESSION_ORDER = ['MORNING_BELL', 'MIDDAY', 'POWER_HOUR', 'NIGHT_GAME'];

// Scoring constants
const POINTS_PER_PERCENT = 10;

const CONVICTION_TIERS = [
  { min: 15.1, max: 100, multiplier: 1.30 },
  { min: 10.1, max: 15, multiplier: 1.15 },
  { min: 0, max: 10, multiplier: 1.00 }
];

const BREAKOUT_BONUSES = {
  BREAKOUT: { threshold: 1.0, points: 15, label: 'BaggerBomb', emoji: '💣' },
  RALLY: { threshold: 1.5, points: 30, label: 'Double Bagger', emoji: '💣💣' },
  MOONSHOT: { threshold: 2.0, points: 50, label: 'TenBagger', emoji: '🚀💣' }
};

const BUST_PENALTIES = {
  BUST: { threshold: 1.0, points: -10, label: 'Bust', emoji: '📉' },
  CRASH: { threshold: 1.5, points: -20, label: 'Crash', emoji: '💥' },
  MELTDOWN: { threshold: 2.0, points: -35, label: 'Meltdown', emoji: '🔥' }
};

const SESSION_BONUSES = {
  SESSION_WIN: 10,
  GREEN_SWEEP: 20,  // All assets positive
  CLEAN_SWEEP: 30   // Win all 4 sessions
};

// ==================== HELPER FUNCTIONS ====================

const isCrypto = (symbol) => {
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'XRP', 'DOGE', 'SHIB', 'LTC', 'AAVE', 'ATOM', 'ALGO', 'XLM'];
  return cryptoSymbols.includes(symbol) || symbol?.endsWith('-USD') || POPULAR_CRYPTO.some(c => c.symbol === symbol);
};

const getCurrentSession = () => {
  const now = new Date();
  // Convert to ET (UTC-5, simplified - doesn't account for DST)
  const etOffset = -5;
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const etHour = (utcHour + etOffset + 24) % 24;
  const time = etHour + utcMinute / 60;

  for (const [id, session] of Object.entries(SESSIONS)) {
    if (time >= session.startHour && time < session.endHour) {
      return { ...session, id };
    }
  }

  // Outside market hours - return first session for testing/demo
  return { ...SESSIONS.MORNING_BELL, id: 'MORNING_BELL' };
};

const getSessionTimeRemaining = (session) => {
  if (!session) return null;

  const now = new Date();
  const etOffset = -5;
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcSecond = now.getUTCSeconds();
  const etTime = (utcHour + etOffset + 24) % 24 + utcMinute / 60 + utcSecond / 3600;

  const remainingHours = session.endHour - etTime;
  if (remainingHours <= 0) return { hours: 0, minutes: 0, seconds: 0 };

  const hours = Math.floor(remainingHours);
  const minutes = Math.floor((remainingHours - hours) * 60);
  const seconds = Math.floor(((remainingHours - hours) * 60 - minutes) * 60);

  return { hours, minutes, seconds };
};

const getConvictionMultiplier = (allocationPercent) => {
  for (const tier of CONVICTION_TIERS) {
    if (allocationPercent >= tier.min && allocationPercent <= tier.max) {
      return tier.multiplier;
    }
  }
  return 1.0;
};

// ==================== SCORING FUNCTIONS ====================

/**
 * Calculate score for a single asset
 * FIXES THE NEGATIVE MOVEMENT BUG - properly handles negative percentages
 */
const calculateAssetScore = (asset, openPrice, currentPrice, threshold, totalPortfolioValue = 1000000) => {
  if (!openPrice || openPrice === 0) {
    return {
      symbol: asset.symbol,
      basePoints: 0,
      breakoutBonus: 0,
      bustPenalty: 0,
      convictionMultiplier: 1,
      totalPoints: 0,
      percentChange: 0,
      progress: 0,
      progressDirection: 'positive',
      allocationPercent: 0,
      threshold: threshold?.threshold || 2.0,
      openPrice: 0,
      currentPrice: 0
    };
  }

  const percentChange = ((currentPrice - openPrice) / openPrice) * 100;
  const allocationPercent = (asset.amount / totalPortfolioValue) * 100;
  const convictionMultiplier = getConvictionMultiplier(allocationPercent);

  // Base points: 10 points per 1% change (can be negative!)
  const basePoints = percentChange * POINTS_PER_PERCENT;

  // Threshold values
  const baseThreshold = threshold?.threshold || (isCrypto(asset.symbol) ? 5.0 : 2.0);
  const rallyThreshold = threshold?.rallyThreshold || baseThreshold * 1.5;
  const moonshotThreshold = threshold?.moonshotThreshold || baseThreshold * 2.0;

  let breakoutBonus = 0;
  let bustPenalty = 0;
  let breakoutType = null;
  let bustType = null;

  // POSITIVE MOVEMENT - Check for breakouts (bonuses stack!)
  if (percentChange > 0) {
    if (percentChange >= moonshotThreshold) {
      breakoutBonus = BREAKOUT_BONUSES.BREAKOUT.points + BREAKOUT_BONUSES.RALLY.points + BREAKOUT_BONUSES.MOONSHOT.points;
      breakoutType = 'MOONSHOT';
    } else if (percentChange >= rallyThreshold) {
      breakoutBonus = BREAKOUT_BONUSES.BREAKOUT.points + BREAKOUT_BONUSES.RALLY.points;
      breakoutType = 'RALLY';
    } else if (percentChange >= baseThreshold) {
      breakoutBonus = BREAKOUT_BONUSES.BREAKOUT.points;
      breakoutType = 'BREAKOUT';
    }
  }

  // NEGATIVE MOVEMENT - Check for busts (penalties stack!)
  if (percentChange < 0) {
    const absChange = Math.abs(percentChange);
    if (absChange >= moonshotThreshold) {
      bustPenalty = BUST_PENALTIES.BUST.points + BUST_PENALTIES.CRASH.points + BUST_PENALTIES.MELTDOWN.points;
      bustType = 'MELTDOWN';
    } else if (absChange >= rallyThreshold) {
      bustPenalty = BUST_PENALTIES.BUST.points + BUST_PENALTIES.CRASH.points;
      bustType = 'CRASH';
    } else if (absChange >= baseThreshold) {
      bustPenalty = BUST_PENALTIES.BUST.points;
      bustType = 'BUST';
    }
  }

  // Apply conviction multiplier to base points and bonuses
  const adjustedBasePoints = basePoints * convictionMultiplier;
  const adjustedBreakoutBonus = breakoutBonus * convictionMultiplier;
  // Penalties are NOT multiplied (you don't get punished more for conviction)

  const totalPoints = adjustedBasePoints + adjustedBreakoutBonus + bustPenalty;

  return {
    symbol: asset.symbol,
    percentChange,
    basePoints: adjustedBasePoints,
    breakoutBonus: adjustedBreakoutBonus,
    bustPenalty,
    breakoutType,
    bustType,
    convictionMultiplier,
    allocationPercent,
    totalPoints,
    openPrice,
    currentPrice,
    threshold: baseThreshold,
    // Progress toward threshold (works for both positive and negative)
    progress: Math.min(100, (Math.abs(percentChange) / baseThreshold) * 100),
    progressDirection: percentChange >= 0 ? 'positive' : 'negative'
  };
};

/**
 * Calculate total score for a portfolio
 */
const calculatePortfolioScore = (portfolio, openPrices, currentPrices, thresholds) => {
  let totalScore = 0;
  const assetScores = [];
  const breakouts = [];
  const busts = [];

  portfolio.forEach(asset => {
    const openPrice = openPrices[asset.symbol] || asset.price;
    const currentPrice = currentPrices[asset.symbol] || openPrice;
    const threshold = thresholds[asset.symbol];

    const score = calculateAssetScore(asset, openPrice, currentPrice, threshold);
    assetScores.push(score);
    totalScore += score.totalPoints;

    if (score.breakoutType) {
      breakouts.push({
        symbol: asset.symbol,
        type: score.breakoutType,
        points: score.breakoutBonus,
        percentChange: score.percentChange,
        timestamp: Date.now()
      });
    }

    if (score.bustType) {
      busts.push({
        symbol: asset.symbol,
        type: score.bustType,
        points: score.bustPenalty,
        percentChange: score.percentChange,
        timestamp: Date.now()
      });
    }
  });

  // Check for green sweep (all assets positive)
  const allPositive = assetScores.every(s => s.percentChange >= 0);
  const greenSweepBonus = allPositive && assetScores.length > 0 ? SESSION_BONUSES.GREEN_SWEEP : 0;

  return {
    totalScore: Math.round(totalScore + greenSweepBonus),
    assetScores,
    breakouts,
    busts,
    greenSweepBonus,
    allPositive
  };
};

// ==================== THE HOOK ====================

export const useBaggerBombBattle = (battleId, userId) => {
  // State
  const [battle, setBattle] = useState(null);
  const [currentPrices, setCurrentPrices] = useState({});
  const [thresholds, setThresholds] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSession, setCurrentSession] = useState(getCurrentSession());
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(null);

  // Derived state
  const isCreator = useMemo(() => {
    if (!battle || !userId) return true;
    const creatorId = battle?.creator?.odUserId || battle?.creator?.uid;
    return creatorId === userId;
  }, [battle, userId]);

  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;
  const myPortfolio = myData?.portfolio || [];
  const oppPortfolio = oppData?.portfolio || [];

  // Get open prices for current session
  const openPrices = useMemo(() => {
    if (!battle || !currentSession) return battle?.state?.startingPrices || {};
    return battle?.sessionPrices?.[currentSession.id]?.open || battle?.state?.startingPrices || {};
  }, [battle, currentSession]);

  // Calculate scores
  const myScoreData = useMemo(() => {
    if (myPortfolio.length === 0 || Object.keys(currentPrices).length === 0) {
      return { totalScore: 0, assetScores: [], breakouts: [], busts: [] };
    }
    return calculatePortfolioScore(myPortfolio, openPrices, currentPrices, thresholds);
  }, [myPortfolio, openPrices, currentPrices, thresholds]);

  const oppScoreData = useMemo(() => {
    if (oppPortfolio.length === 0 || Object.keys(currentPrices).length === 0) {
      return { totalScore: 0, assetScores: [], breakouts: [], busts: [] };
    }
    return calculatePortfolioScore(oppPortfolio, openPrices, currentPrices, thresholds);
  }, [oppPortfolio, openPrices, currentPrices, thresholds]);

  // Add completed session scores
  const myTotalScore = useMemo(() => {
    let total = myScoreData.totalScore;
    const sessionScores = battle?.sessionScores || {};
    const completedSessions = battle?.state?.completedSessions || [];

    completedSessions.forEach(sessionId => {
      const score = sessionScores[sessionId]?.[isCreator ? 'creator' : 'opponent'] || 0;
      total += score;
    });

    return Math.round(total);
  }, [myScoreData, battle, isCreator]);

  const oppTotalScore = useMemo(() => {
    let total = oppScoreData.totalScore;
    const sessionScores = battle?.sessionScores || {};
    const completedSessions = battle?.state?.completedSessions || [];

    completedSessions.forEach(sessionId => {
      const score = sessionScores[sessionId]?.[isCreator ? 'opponent' : 'creator'] || 0;
      total += score;
    });

    return Math.round(total);
  }, [oppScoreData, battle, isCreator]);

  // Session status for timeline
  const sessionStatuses = useMemo(() => {
    const statuses = {};
    const completedSessions = battle?.state?.completedSessions || [];
    const sessionScores = battle?.sessionScores || {};

    SESSION_ORDER.forEach((sessionId) => {
      if (completedSessions.includes(sessionId)) {
        const myScore = sessionScores[sessionId]?.[isCreator ? 'creator' : 'opponent'] || 0;
        const oppScore = sessionScores[sessionId]?.[isCreator ? 'opponent' : 'creator'] || 0;
        statuses[sessionId] = {
          status: 'completed',
          myScore,
          oppScore,
          winner: myScore > oppScore ? 'you' : myScore < oppScore ? 'opponent' : 'tie'
        };
      } else if (currentSession?.id === sessionId) {
        statuses[sessionId] = { status: 'active' };
      } else {
        statuses[sessionId] = { status: 'upcoming' };
      }
    });

    return statuses;
  }, [battle, currentSession, isCreator]);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    if (myPortfolio.length === 0 && oppPortfolio.length === 0) return;

    try {
      const allSymbols = [...new Set([
        ...myPortfolio.map(a => a.symbol),
        ...oppPortfolio.map(a => a.symbol)
      ])];

      const stockSymbols = allSymbols.filter(s => !isCrypto(s));
      const cryptoSymbols = allSymbols.filter(s => isCrypto(s));

      const newPrices = {};

      // Fetch stock prices
      for (const symbol of stockSymbols) {
        try {
          const data = await stockAPI.getStockPrice(symbol);
          if (data?.price) {
            newPrices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`Failed to fetch price for ${symbol}:`, err);
        }
      }

      // Fetch crypto prices
      for (const symbol of cryptoSymbols) {
        try {
          const data = await stockAPI.getCryptoPrice(symbol);
          if (data?.price) {
            newPrices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`Failed to fetch crypto price for ${symbol}:`, err);
        }
      }

      if (Object.keys(newPrices).length > 0) {
        setCurrentPrices(prev => ({ ...prev, ...newPrices }));
      }
    } catch (err) {
      console.error('Error fetching prices:', err);
      // Use starting prices as fallback
      if (battle?.state?.startingPrices) {
        setCurrentPrices(battle.state.startingPrices);
      }
    }
  }, [myPortfolio, oppPortfolio, battle]);

  // Fetch thresholds
  const fetchThresholds = useCallback(async () => {
    if (myPortfolio.length === 0 && oppPortfolio.length === 0) return;

    // Use battle's stored thresholds if available
    if (battle?.thresholds && Object.keys(battle.thresholds).length > 0) {
      setThresholds(battle.thresholds);
      return;
    }

    // Generate default thresholds based on asset type
    const defaults = {};
    [...myPortfolio, ...oppPortfolio].forEach(asset => {
      if (!defaults[asset.symbol]) {
        const isCryptoAsset = isCrypto(asset.symbol);
        defaults[asset.symbol] = {
          threshold: isCryptoAsset ? 5.0 : 2.0,
          rallyThreshold: isCryptoAsset ? 7.5 : 3.0,
          moonshotThreshold: isCryptoAsset ? 10.0 : 4.0
        };
      }
    });
    setThresholds(defaults);
  }, [myPortfolio, oppPortfolio, battle]);

  // Subscribe to battle document (only for Firebase battles)
  useEffect(() => {
    if (!battleId) return;

    // Check if this is a training battle (local) or Firebase battle
    if (battleId.startsWith('training_')) {
      // Training battles don't need Firebase subscription
      setLoading(false);
      return;
    }

    try {
      const battleRef = doc(db, 'battles', battleId);
      const unsubscribe = onSnapshot(battleRef, (snapshot) => {
        if (snapshot.exists()) {
          setBattle({ id: snapshot.id, ...snapshot.data() });
          setLoading(false);
        } else {
          setError('Battle not found');
          setLoading(false);
        }
      }, (err) => {
        console.error('Battle subscription error:', err);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up battle subscription:', err);
      setLoading(false);
    }
  }, [battleId]);

  // Fetch prices on mount and interval
  useEffect(() => {
    if (!battle && myPortfolio.length === 0) return;

    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [battle, fetchPrices, myPortfolio.length]);

  // Fetch thresholds when battle loads
  useEffect(() => {
    if (!battle && myPortfolio.length === 0) return;
    fetchThresholds();
  }, [battle, fetchThresholds, myPortfolio.length]);

  // Update session timer
  useEffect(() => {
    const updateSession = () => {
      const session = getCurrentSession();
      setCurrentSession(session);
      setSessionTimeRemaining(getSessionTimeRemaining(session));
    };

    updateSession();
    const interval = setInterval(updateSession, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format time remaining
  const formatTimeRemaining = useCallback(() => {
    if (!sessionTimeRemaining) return '--:--:--';
    const { hours, minutes, seconds } = sessionTimeRemaining;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [sessionTimeRemaining]);

  return {
    // Battle data
    battle,
    loading,
    error,

    // User context
    isCreator,
    myData,
    oppData,
    myPortfolio,
    oppPortfolio,

    // Prices & Thresholds
    currentPrices,
    openPrices,
    thresholds,

    // Scores
    myScoreData,
    oppScoreData,
    myTotalScore,
    oppTotalScore,

    // Session
    currentSession,
    sessionTimeRemaining,
    sessionStatuses,
    formatTimeRemaining,

    // Constants (for UI)
    SESSIONS,
    SESSION_ORDER,
    BREAKOUT_BONUSES,
    BUST_PENALTIES,

    // Actions
    refreshPrices: fetchPrices
  };
};

export default useBaggerBombBattle;

// Also export helpers for use elsewhere
export {
  SESSIONS,
  SESSION_ORDER,
  BREAKOUT_BONUSES,
  BUST_PENALTIES,
  SESSION_BONUSES,
  isCrypto,
  getCurrentSession,
  getSessionTimeRemaining,
  getConvictionMultiplier,
  calculateAssetScore,
  calculatePortfolioScore
};
