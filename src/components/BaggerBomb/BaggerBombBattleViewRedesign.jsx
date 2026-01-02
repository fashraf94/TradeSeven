// BaggerBombBattleViewRedesign - Complete redesigned battle view for BaggerBomb Scoring battles
// Features: Session timeline, live breakout feed, threshold progress bars, celebration animations

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Moon,
  Sun,
  Bell,
  ChevronDown,
  ChevronUp,
  Target,
  Flame,
  Rocket
} from 'lucide-react';

// Import scoring from our hook (fixes negative scoring bug)
import {
  calculateAssetScore,
  calculatePortfolioScore,
  getCurrentSession,
  getSessionTimeRemaining,
  getConvictionMultiplier,
  SESSIONS,
  SESSION_ORDER,
  isCrypto,
  BREAKOUT_BONUSES,
  BUST_PENALTIES
} from '../../hooks/useBaggerBombBattle';

// Import other services
import {
  checkPortfolioBreakouts,
  getBreakoutSummary
} from '../../services/breakoutDetectionService';
import { getVolatilityThresholds } from '../../services/volatilityService';
import { stockAPI, POPULAR_CRYPTO } from '../../services/eodhdAPI';

// Constants
const PRICE_POLL_INTERVAL = 60000; // 60 seconds

const SESSION_CONFIG = {
  MORNING_BELL: {
    icon: Bell,
    label: 'Morning Bell',
    shortLabel: 'Morning',
    color: '#fbbf24',
    time: '9:30 AM - 11:30 AM'
  },
  MIDDAY: {
    icon: Sun,
    label: 'Midday',
    shortLabel: 'Midday',
    color: '#f97316',
    time: '11:30 AM - 2:00 PM'
  },
  POWER_HOUR: {
    icon: Zap,
    label: 'Power Hour',
    shortLabel: 'Power Hour',
    color: '#8b5cf6',
    time: '2:00 PM - 4:00 PM'
  },
  NIGHT_GAME: {
    icon: Moon,
    label: 'Night Game',
    shortLabel: 'Night',
    color: '#3b82f6',
    time: '4:00 PM - 8:00 PM'
  }
};

const BREAKOUT_CONFIG = {
  BREAKOUT: { emoji: '💣', label: 'BaggerBomb', color: '#10b981', points: 15 },
  RALLY: { emoji: '💣💣', label: 'Double Bagger', color: '#f59e0b', points: 30 },
  MOONSHOT: { emoji: '🚀💣', label: 'TenBagger', color: '#8b5cf6', points: 50 },
  BUST: { emoji: '📉', label: 'Bust', color: '#ef4444', points: -10 },
  CRASH: { emoji: '💥', label: 'Crash', color: '#dc2626', points: -20 },
  MELTDOWN: { emoji: '🔥', label: 'Meltdown', color: '#991b1b', points: -35 }
};

// SESSION_ORDER is now imported as SESSION_ORDER from useBaggerBombBattle hook

/**
 * BaggerBombBattleViewRedesign
 * Complete redesigned battle view for BaggerBomb Scoring battles
 */
export default function BaggerBombBattleViewRedesign({
  battle,
  user,
  onBack,
  isTraining = false
}) {
  // ==================== STATE ====================
  const [currentPrices, setCurrentPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [thresholds, setThresholds] = useState(battle?.thresholds || {});
  const [detectedBreakouts, setDetectedBreakouts] = useState([]);
  const [activeTab, setActiveTab] = useState('yours'); // 'yours' | 'opponent'
  const [expandedSession, setExpandedSession] = useState(null);
  const [showBreakoutFeed, setShowBreakoutFeed] = useState(true);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(null);
  const [celebrationEvent, setCelebrationEvent] = useState(null);

  // ==================== DERIVED DATA ====================
  const isCreator = battle?.creator?.uid === user?.uid ||
                    battle?.creator?.uid === user?.odUserId ||
                    battle?.creator?.odUserId === user?.odUserId ||
                    battle?.creator?.username === user?.username;

  const myData = isCreator ? battle?.creator : battle?.opponent;
  const oppData = isCreator ? battle?.opponent : battle?.creator;
  const myPortfolio = myData?.portfolio || [];
  const oppPortfolio = oppData?.portfolio || [];
  const playerKey = isCreator ? 'creator' : 'opponent';
  const opponentKey = isCreator ? 'opponent' : 'creator';

  const currentSession = useMemo(() => getCurrentSession(), []);

  // ==================== PRICE FETCHING ====================
  const fetchPrices = useCallback(async () => {
    try {
      const allSymbols = [
        ...myPortfolio.map(a => a.symbol),
        ...oppPortfolio.map(a => a.symbol),
        ...(myData?.bench || []).map(a => a.symbol),
        ...(oppData?.bench || []).map(a => a.symbol)
      ];
      const uniqueSymbols = [...new Set(allSymbols.filter(Boolean))];

      if (uniqueSymbols.length === 0) {
        setLoadingPrices(false);
        return;
      }

      const stockSymbols = uniqueSymbols.filter(s => !isCrypto(s));
      const cryptoSymbols = uniqueSymbols.filter(s => isCrypto(s));

      // Fetch prices using stockAPI
      const combinedPrices = {};

      // Fetch stock prices
      for (const symbol of stockSymbols) {
        try {
          const data = await stockAPI.getStockPrice(symbol);
          if (data?.price) {
            combinedPrices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`Failed to fetch price for ${symbol}`);
        }
      }

      // Fetch crypto prices
      for (const symbol of cryptoSymbols) {
        try {
          const data = await stockAPI.getCryptoPrice(symbol);
          if (data?.price) {
            combinedPrices[symbol] = data.price;
          }
        } catch (err) {
          console.warn(`Failed to fetch crypto price for ${symbol}`);
        }
      }

      // Fallback to starting prices if no current prices fetched
      if (Object.keys(combinedPrices).length === 0 && battle?.state?.startingPrices) {
        setCurrentPrices(battle.state.startingPrices);
      } else {
        setCurrentPrices(prev => ({ ...prev, ...combinedPrices }));
      }
      setLoadingPrices(false);
    } catch (error) {
      console.error('[BaggerBombBattleView] Error fetching prices:', error);
      // Fallback to starting prices on error
      if (battle?.state?.startingPrices) {
        setCurrentPrices(battle.state.startingPrices);
      }
      setLoadingPrices(false);
    }
  }, [myPortfolio, oppPortfolio, myData?.bench, oppData?.bench, battle?.state?.startingPrices]);

  // ==================== EFFECTS ====================

  // Initial load + price polling
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Load thresholds if not in battle
  useEffect(() => {
    const loadThresholds = async () => {
      if (Object.keys(thresholds).length === 0) {
        const allSymbols = [...myPortfolio, ...oppPortfolio].map(a => a.symbol).filter(Boolean);
        const stockSymbols = allSymbols.filter(s => !isCrypto(s));
        const cryptoSymbols = allSymbols.filter(s => isCrypto(s));

        try {
          const [stockThresholds, cryptoThresholds] = await Promise.all([
            stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
            cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {}
          ]);

          setThresholds({ ...stockThresholds, ...cryptoThresholds });
        } catch (error) {
          console.error('[BaggerBombBattleView] Error loading thresholds:', error);
        }
      }
    };
    loadThresholds();
  }, [myPortfolio, oppPortfolio, thresholds]);

  // Session timer
  useEffect(() => {
    const updateTimer = () => {
      const remaining = getSessionTimeRemaining();
      if (typeof remaining === 'number') {
        const hours = Math.floor(remaining / 60);
        const minutes = remaining % 60;
        const seconds = 0;
        setSessionTimeRemaining({ hours, minutes, seconds });
      } else if (remaining && typeof remaining === 'object') {
        setSessionTimeRemaining(remaining);
      } else {
        setSessionTimeRemaining(null);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Breakout detection
  useEffect(() => {
    if (Object.keys(currentPrices).length === 0 || Object.keys(thresholds).length === 0) return;
    if (!currentSession) return;

    const openPrices = battle?.sessionPrices?.[currentSession?.id]?.open || battle?.state?.startingPrices || {};
    const existingBreakouts = battle?.breakouts?.[playerKey] || [];

    const newBreakouts = checkPortfolioBreakouts(
      myPortfolio,
      openPrices,
      currentPrices,
      thresholds,
      existingBreakouts,
      currentSession?.id
    );

    if (newBreakouts.length > detectedBreakouts.length) {
      // New breakout detected - trigger celebration
      const latestBreakout = newBreakouts[newBreakouts.length - 1];
      triggerCelebration(latestBreakout);
    }

    setDetectedBreakouts(newBreakouts);
  }, [currentPrices, thresholds, battle, currentSession, myPortfolio, playerKey, detectedBreakouts.length]);

  // ==================== SCORING CALCULATIONS ====================

  const calculateTotalScore = useCallback((portfolio, playerId) => {
    let total = 0;
    const sessionScores = battle?.sessionScores || {};

    // Add completed session scores
    SESSION_ORDER.forEach(sessionId => {
      const sessionScore = sessionScores[sessionId];
      if (sessionScore && sessionScore[playerId] !== undefined && sessionScore[playerId] !== 0) {
        total += sessionScore[playerId];
      }
    });

    // Add current session live score using new calculateAssetScore (fixes negative scoring bug)
    if (currentSession && Object.keys(currentPrices).length > 0) {
      const openPrices = battle?.sessionPrices?.[currentSession.id]?.open || battle?.state?.startingPrices || {};
      let sessionTotal = 0;

      portfolio.forEach(asset => {
        const openPrice = openPrices[asset.symbol] || asset.price;
        const currentPrice = currentPrices[asset.symbol] || openPrice;
        const threshold = thresholds[asset.symbol];
        const totalValue = 1000000; // $1M portfolio

        if (openPrice > 0) {
          // Use new calculateAssetScore from hook - properly handles negative movements
          const score = calculateAssetScore(
            asset,
            openPrice,
            currentPrice,
            threshold,
            totalValue
          );
          sessionTotal += score.totalPoints || 0;
        }
      });

      total += sessionTotal;
    }

    return Math.round(total);
  }, [battle, currentSession, currentPrices, thresholds]);

  const myTotalScore = useMemo(() =>
    calculateTotalScore(myPortfolio, playerKey),
    [calculateTotalScore, myPortfolio, playerKey]
  );

  const oppTotalScore = useMemo(() =>
    calculateTotalScore(oppPortfolio, opponentKey),
    [calculateTotalScore, oppPortfolio, opponentKey]
  );

  // ==================== CELEBRATION HANDLER ====================

  const triggerCelebration = (breakout) => {
    setCelebrationEvent(breakout);
    setTimeout(() => setCelebrationEvent(null), 3000);
  };

  // ==================== HELPER FUNCTIONS ====================

  const getAssetProgress = (asset) => {
    const openPrice = battle?.sessionPrices?.[currentSession?.id]?.open?.[asset.symbol] ||
                      battle?.state?.startingPrices?.[asset.symbol] ||
                      asset.price;
    const currentPrice = currentPrices[asset.symbol] || openPrice;
    const threshold = thresholds[asset.symbol];

    if (!threshold || !openPrice || openPrice <= 0) {
      return { percent: 0, change: 0, progress: 0, threshold: 2.5 };
    }

    const percentChange = ((currentPrice - openPrice) / openPrice) * 100;
    const thresholdValue = threshold.threshold || 2.5;
    const progress = Math.min(100, Math.abs(percentChange / thresholdValue) * 100);

    return {
      percent: percentChange,
      change: currentPrice - openPrice,
      progress,
      threshold: thresholdValue,
      rallyThreshold: threshold.rallyThreshold || thresholdValue * 1.5,
      moonshotThreshold: threshold.moonshotThreshold || thresholdValue * 2.0,
      currentPrice,
      openPrice
    };
  };

  const getSessionStatus = (sessionId) => {
    const completedSessions = battle?.state?.completedSessions || [];
    const sessionScores = battle?.sessionScores || {};

    if (completedSessions.includes(sessionId)) {
      const myScore = sessionScores[sessionId]?.[playerKey] || 0;
      const oppScore = sessionScores[sessionId]?.[opponentKey] || 0;
      return {
        status: 'completed',
        winner: myScore > oppScore ? 'you' : myScore < oppScore ? 'opponent' : 'tie',
        myScore,
        oppScore
      };
    }

    if (currentSession?.id === sessionId) {
      return { status: 'active' };
    }

    return { status: 'upcoming' };
  };

  const formatTime = (timeObj) => {
    if (!timeObj) return '--:--';
    const { hours, minutes, seconds } = timeObj;
    if (hours > 0) {
      return `${hours}:${String(minutes || 0).padStart(2, '0')}:${String(seconds || 0).padStart(2, '0')}`;
    }
    return `${minutes || 0}:${String(seconds || 0).padStart(2, '0')}`;
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // ==================== RENDER COMPONENTS ====================

  // Session Timeline Bar
  const renderSessionTimeline = () => (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: '#161b22',
      borderRadius: '12px',
      marginBottom: '16px',
      overflowX: 'auto'
    }}>
      {SESSION_ORDER.map((sessionId) => {
        const config = SESSION_CONFIG[sessionId];
        const status = getSessionStatus(sessionId);
        const Icon = config.icon;
        const isActive = status.status === 'active';
        const isCompleted = status.status === 'completed';

        return (
          <div
            key={sessionId}
            onClick={() => isCompleted && setExpandedSession(expandedSession === sessionId ? null : sessionId)}
            style={{
              flex: '1',
              minWidth: '80px',
              padding: '10px 8px',
              backgroundColor: isActive ? 'rgba(0, 217, 255, 0.1)' : '#0d1117',
              borderRadius: '8px',
              border: isActive ? '2px solid #00d9ff' : '1px solid #21262d',
              cursor: isCompleted ? 'pointer' : 'default',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <Icon size={16} color={config.color} style={{ marginBottom: '4px' }} />
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>
              {config.shortLabel}
            </div>

            {isCompleted && (
              <>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: status.winner === 'you' ? '#10b981' : status.winner === 'opponent' ? '#ef4444' : '#8b949e'
                }}>
                  {status.myScore} - {status.oppScore}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: status.winner === 'you' ? '#10b981' : status.winner === 'opponent' ? '#ef4444' : '#8b949e',
                  marginTop: '2px'
                }}>
                  {status.winner === 'you' ? '✓ WON' : status.winner === 'opponent' ? '✗ LOST' : '— TIE'}
                </div>
              </>
            )}

            {isActive && (
              <>
                <div style={{
                  fontSize: '10px',
                  color: '#00d9ff',
                  fontWeight: 'bold',
                  marginTop: '4px'
                }}>
                  LIVE
                </div>
                <div style={{ fontSize: '11px', color: '#00d9ff' }}>
                  {formatTime(sessionTimeRemaining)}
                </div>
              </>
            )}

            {status.status === 'upcoming' && (
              <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
                🔒
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Main Scoreboard
  const renderScoreboard = () => {
    const leadingBy = myTotalScore - oppTotalScore;
    const isLeading = leadingBy > 0;
    const isTied = leadingBy === 0;
    const totalScore = myTotalScore + oppTotalScore;
    const myPercent = totalScore > 0 ? (myTotalScore / totalScore) * 100 : 50;

    return (
      <div style={{
        backgroundColor: '#161b22',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        {/* VS Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          {/* You */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: '#00d9ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px',
              fontSize: '24px'
            }}>
              👤
            </div>
            <div style={{ fontSize: '14px', color: '#8b949e' }}>
              {myData?.username || myData?.odUsername || 'YOU'}
            </div>
          </div>

          <div style={{ color: '#8b949e', fontSize: '16px', padding: '0 16px' }}>VS</div>

          {/* Opponent */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px',
              fontSize: '24px'
            }}>
              {isTraining ? '🤖' : '👤'}
            </div>
            <div style={{ fontSize: '14px', color: '#8b949e' }}>
              {oppData?.username || oppData?.odUsername || (isTraining ? 'CPU' : 'OPP')}
            </div>
          </div>
        </div>

        {/* Giant Point Totals */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: isLeading ? '#10b981' : isTied ? '#ffffff' : '#ef4444'
            }}>
              {myTotalScore}
            </div>
            <div style={{ fontSize: '14px', color: '#8b949e' }}>PTS</div>
          </div>

          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: !isLeading && !isTied ? '#10b981' : isTied ? '#ffffff' : '#ef4444'
            }}>
              {oppTotalScore}
            </div>
            <div style={{ fontSize: '14px', color: '#8b949e' }}>PTS</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          height: '8px',
          backgroundColor: '#21262d',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '12px'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.max(5, Math.min(95, myPercent))}%`,
            backgroundColor: isLeading ? '#10b981' : isTied ? '#8b949e' : '#ef4444',
            borderRadius: '4px',
            transition: 'width 0.5s ease-out'
          }} />
        </div>

        {/* Lead Indicator */}
        <div style={{
          fontSize: '14px',
          color: isLeading ? '#10b981' : isTied ? '#8b949e' : '#ef4444',
          fontWeight: '600',
          marginBottom: '16px'
        }}>
          {isTied ? 'TIED' : `${isLeading ? 'LEADING' : 'TRAILING'} BY ${Math.abs(leadingBy)} POINTS`}
        </div>

        {/* Session Context */}
        {currentSession && (
          <div style={{
            fontSize: '13px',
            color: '#8b949e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <span>Session {SESSION_ORDER.indexOf(currentSession.id) + 1} of 4</span>
            <span>•</span>
            <span style={{ color: SESSION_CONFIG[currentSession.id]?.color }}>
              {SESSION_CONFIG[currentSession.id]?.label}
            </span>
            <span>•</span>
            <span style={{ color: '#00d9ff' }}>{formatTime(sessionTimeRemaining)} remaining</span>
          </div>
        )}
      </div>
    );
  };

  // Breakout Feed
  const renderBreakoutFeed = () => {
    const allBreakouts = [
      ...(detectedBreakouts || []).map(b => ({ ...b, isYours: true })),
      ...(battle?.breakouts?.[opponentKey] || []).map(b => ({ ...b, isYours: false }))
    ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5);

    // Add "approaching threshold" alerts
    const approachingAssets = myPortfolio
      .map(asset => ({ ...asset, ...getAssetProgress(asset) }))
      .filter(a => a.progress >= 75 && a.progress < 100)
      .slice(0, 2);

    if (allBreakouts.length === 0 && approachingAssets.length === 0) {
      return null;
    }

    return (
      <div style={{
        backgroundColor: '#161b22',
        borderRadius: '12px',
        marginBottom: '16px',
        overflow: 'hidden'
      }}>
        <div
          onClick={() => setShowBreakoutFeed(!showBreakoutFeed)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            cursor: 'pointer',
            borderBottom: showBreakoutFeed ? '1px solid #21262d' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444'
            }} />
            <span style={{ fontWeight: '600', color: '#ffffff' }}>LIVE BREAKOUTS</span>
            <span style={{
              fontSize: '12px',
              color: '#8b949e',
              backgroundColor: '#21262d',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {allBreakouts.length}
            </span>
          </div>
          {showBreakoutFeed ? <ChevronUp size={18} color="#8b949e" /> : <ChevronDown size={18} color="#8b949e" />}
        </div>

        {showBreakoutFeed && (
          <div style={{ padding: '8px' }}>
            {/* Approaching Alerts */}
            {approachingAssets.map((asset, idx) => (
              <div key={`approaching-${idx}`} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                backgroundColor: 'rgba(0, 217, 255, 0.1)',
                borderRadius: '8px',
                marginBottom: '8px',
                border: '1px solid rgba(0, 217, 255, 0.3)'
              }}>
                <span style={{ fontSize: '18px', marginRight: '10px' }}>📈</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#00d9ff' }}>
                    {asset.symbol} approaching threshold
                  </div>
                  <div style={{ fontSize: '12px', color: '#8b949e' }}>
                    {asset.progress.toFixed(0)}% there • Needs +{(asset.threshold - Math.abs(asset.percent)).toFixed(2)}% more
                  </div>
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#00d9ff',
                  fontWeight: '600'
                }}>
                  NOW
                </div>
              </div>
            ))}

            {/* Breakout Events */}
            {allBreakouts.map((breakout, idx) => {
              const config = BREAKOUT_CONFIG[breakout.type] || BREAKOUT_CONFIG.BREAKOUT;
              const isPositive = (breakout.points || config.points) > 0;

              return (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: '#0d1117',
                  borderRadius: '8px',
                  marginBottom: idx < allBreakouts.length - 1 ? '8px' : 0
                }}>
                  <span style={{ fontSize: '18px', marginRight: '10px' }}>{config.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: config.color }}>
                      {breakout.symbol} {config.label}!
                    </div>
                    <div style={{ fontSize: '12px', color: '#8b949e' }}>
                      {breakout.isYours ? 'Your pick' : 'Opponent'} • {Math.abs(breakout.percentChange || 0).toFixed(2)}% move
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: 'bold',
                      color: isPositive ? '#10b981' : '#ef4444'
                    }}>
                      {isPositive ? '+' : ''}{breakout.points || config.points} pts
                    </div>
                    <div style={{ fontSize: '11px', color: '#8b949e' }}>
                      {breakout.timestamp ? formatTimeAgo(breakout.timestamp) : 'Just now'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Asset Card with Threshold Progress
  const renderAssetCard = (asset, isYours = true) => {
    const progress = getAssetProgress(asset);
    const allocationPercent = asset.amount ? (asset.amount / 1000000) * 100 : asset.allocation || 10;
    const conviction = getConvictionMultiplier(allocationPercent);
    const potentialPoints = Math.round(15 * conviction); // Base BaggerBomb points * conviction

    const isApproaching = progress.progress >= 75 && progress.progress < 100;
    const hasBreakout = progress.progress >= 100;
    const isBusted = progress.percent < 0 && Math.abs(progress.percent) >= progress.threshold;

    let borderColor = '#21262d';
    if (hasBreakout) borderColor = '#10b981';
    else if (isBusted) borderColor = '#ef4444';
    else if (isApproaching) borderColor = '#00d9ff';

    return (
      <div key={asset.symbol} style={{
        backgroundColor: '#0d1117',
        borderRadius: '10px',
        padding: '14px',
        marginBottom: '10px',
        border: `2px solid ${borderColor}`,
        transition: 'border-color 0.3s ease'
      }}>
        {/* Header Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '10px'
        }}>
          <div>
            <div style={{
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {asset.symbol}
              {hasBreakout && <span>💣</span>}
              {isBusted && <span>📉</span>}
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e' }}>
              {(asset.name || asset.assetName || asset.symbol)?.substring(0, 20)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontWeight: 'bold',
              fontSize: '16px',
              color: progress.percent >= 0 ? '#10b981' : '#ef4444'
            }}>
              {progress.percent >= 0 ? '+' : ''}{progress.percent.toFixed(2)}%
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e' }}>
              ${progress.currentPrice?.toFixed(2) || '—'}
            </div>
          </div>
        </div>

        {/* Threshold Progress Bar */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            height: '6px',
            backgroundColor: '#21262d',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '4px'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, progress.progress)}%`,
              backgroundColor: hasBreakout ? '#10b981' : isBusted ? '#ef4444' : isApproaching ? '#00d9ff' : '#8b949e',
              borderRadius: '3px',
              transition: 'width 0.5s ease-out'
            }} />
          </div>
          <div style={{
            fontSize: '11px',
            color: isApproaching ? '#00d9ff' : '#8b949e',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>{progress.progress.toFixed(0)}% toward {progress.threshold?.toFixed(1)}% threshold</span>
            {isApproaching && <span style={{ color: '#00d9ff' }}>📈 Approaching!</span>}
          </div>
        </div>

        {/* Bottom Info Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#8b949e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>💰 {allocationPercent.toFixed(1)}%</span>
            {conviction > 1 && (
              <span style={{
                color: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px'
              }}>
                {conviction.toFixed(2)}x
              </span>
            )}
          </div>
          <div style={{ color: '#10b981' }}>
            💣 +{potentialPoints} if hit
          </div>
        </div>

        {/* Threshold Zones (shown on approach) */}
        {isApproaching && (
          <div style={{
            marginTop: '10px',
            padding: '8px',
            backgroundColor: '#161b22',
            borderRadius: '6px',
            fontSize: '11px'
          }}>
            <div style={{ color: '#8b949e', marginBottom: '4px' }}>Breakout Zones:</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ color: '#10b981' }}>💣 {progress.threshold?.toFixed(1)}%</span>
              <span style={{ color: '#f59e0b' }}>💣💣 {progress.rallyThreshold?.toFixed(1)}%</span>
              <span style={{ color: '#8b5cf6' }}>🚀 {progress.moonshotThreshold?.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Portfolio Section with Tabs
  const renderPortfolios = () => (
    <div style={{
      backgroundColor: '#161b22',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      {/* Tab Headers */}
      <div style={{ display: 'flex', borderBottom: '1px solid #21262d' }}>
        <button
          onClick={() => setActiveTab('yours')}
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: activeTab === 'yours' ? '#00d9ff' : 'transparent',
            color: activeTab === 'yours' ? '#0d1117' : '#8b949e',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          👤 YOUR LINEUP
        </button>
        <button
          onClick={() => setActiveTab('opponent')}
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: activeTab === 'opponent' ? '#ef4444' : 'transparent',
            color: activeTab === 'opponent' ? '#ffffff' : '#8b949e',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          {isTraining ? '🤖' : '👤'} {isTraining ? 'CPU' : 'OPPONENT'}
        </button>
      </div>

      {/* Portfolio Content */}
      <div style={{
        padding: '16px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {(activeTab === 'yours' ? myPortfolio : oppPortfolio).map((asset) => (
          renderAssetCard(asset, activeTab === 'yours')
        ))}

        {(activeTab === 'yours' ? myPortfolio : oppPortfolio).length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            color: '#8b949e'
          }}>
            No portfolio data available
          </div>
        )}
      </div>
    </div>
  );

  // Celebration Overlay
  const renderCelebration = () => {
    if (!celebrationEvent) return null;

    const config = BREAKOUT_CONFIG[celebrationEvent.type] || BREAKOUT_CONFIG.BREAKOUT;
    const isMoonshot = celebrationEvent.type === 'MOONSHOT';

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isMoonshot ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '20px',
          padding: '40px 60px',
          textAlign: 'center',
          border: `3px solid ${config.color}`
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>
            {config.emoji}
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: config.color,
            marginBottom: '8px'
          }}>
            {config.label.toUpperCase()}!
          </div>
          <div style={{ fontSize: '18px', color: '#ffffff', marginBottom: '4px' }}>
            {celebrationEvent.symbol}
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: config.color
          }}>
            +{celebrationEvent.points || config.points} PTS
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  if (loadingPrices && Object.keys(currentPrices).length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>💣</div>
          <div>Loading BaggerBomb Battle...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      color: '#ffffff'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        borderBottom: '1px solid #21262d'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#00d9ff',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {isTraining && (
            <span style={{
              backgroundColor: '#8b5cf6',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600'
            }}>
              TRAINING
            </span>
          )}
          <span style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            BAGGERBOMB
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10b981'
          }} />
          <span style={{ fontSize: '12px', color: '#10b981' }}>LIVE</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
        {renderSessionTimeline()}
        {renderScoreboard()}
        {renderBreakoutFeed()}
        {renderPortfolios()}
      </div>

      {/* Celebration Overlay */}
      {renderCelebration()}
    </div>
  );
}
