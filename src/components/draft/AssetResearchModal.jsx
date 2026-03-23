import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { HOLO_COLORS, CATEGORY_CONFIG, getSectorColor, getRatingColor } from '../../constants/holoTheme';
import { getCompanyProfile } from '../../services/fundamentalsService';
import { getStockPrice } from '../../services/eodhdAPI';
import { formatLargeNumber } from '../../utils/formatters';
import ChartHeader from '../Research/ChartHeader';
import WhyMovingPopup from '../Research/WhyMovingPopup';
import StockChart from '../Research/StockChart';
import useResearchData from '../Research/useResearchData';
import AnalysisDrawer from '../Research/AnalysisDrawer';
import TechnicalTabV2 from '../Research/TechnicalTabV2';
import { useIsMobile } from '../../hooks/useIsMobile';
import TechnicalAnalysisTab from './ResearchTabs/TechnicalAnalysisTab';
import BaggerBombTab from './ResearchTabs/BaggerBombTab';
import HealthTab from '../Research/HealthTab';
import { CRYPTO_SYMBOLS } from '../../services/sessionScoringService';
import AnalysisQATab from '../Research/AnalysisQATab';
import CompeteTab from './CompeteTab';
import SectorTab from './SectorTab';
import { isIndex, INDEX_REGISTRY } from '../../constants/indexRegistry';
import MarketContextTab from '../Research/MarketContextTab';

/**
 * AssetResearchModal - Detailed asset research view (reusable across screens)
 *
 * Shows comprehensive asset information with AI Analysis:
 * - Stock hero section (symbol, name, price, change)
 * - AI Analysis with Fundamental/Technical/News tabs
 * - Key metrics: Market Cap, P/E Ratio, Revenue Growth, Profit Margin
 * - Strengths & Weaknesses
 * - Real-time news from EODHD API
 * - Flexible action button (draft acquire, custom actions, or research-only mode)
 *
 * Props:
 * - asset: { symbol, name, price, percentChange?, change?, sector? }
 * - sector: string (for sector badge color)
 * - category: 'neutral' | 'aggressive' | 'defensive' (optional, for draft context)
 * - isMyTurn: boolean (default: false) - shows ON THE CLOCK alert
 * - timeRemaining: number (default: 0) - seconds remaining in draft
 * - canPick: boolean (default: false) - enables acquire button in draft
 * - onAcquire: (asset) => void (optional) - acquire handler for draft
 * - onClose: () => void - close handler
 * - actionConfig: { label, onClick, variant, disabled? } (optional) - custom action button
 *   - variant: 'primary' | 'danger' | 'secondary'
 * - showActionButton: boolean (default: true) - show/hide action section
 */

// Mock fundamental data (in production, fetch from API)
const getMockFundamentals = (symbol) => {
  const defaults = {
    marketCap: '$500B',
    peRatio: '25x',
    revenueGrowth: '+15%',
    profitMargin: '20%',
    rating: 'Buy',
    strengths: ['Strong market position', 'Growing revenue', 'Solid fundamentals'],
    weaknesses: ['Valuation concerns', 'Market competition', 'Economic sensitivity'],
    low52w: 100,
    high52w: 200,
  };

  // Custom data for popular stocks
  const stockData = {
    'AAPL': { marketCap: '$3.0T', peRatio: '30x', revenueGrowth: '+8%', profitMargin: '25%', rating: 'Strong Buy', low52w: 164, high52w: 199, strengths: ['Strong ecosystem', 'Brand loyalty', 'Services growth'], weaknesses: ['iPhone dependency', 'China exposure', 'Premium pricing'] },
    'MSFT': { marketCap: '$2.9T', peRatio: '35x', revenueGrowth: '+15%', profitMargin: '36%', rating: 'Strong Buy', low52w: 309, high52w: 430, strengths: ['Cloud dominance', 'AI integration', 'Enterprise strength'], weaknesses: ['Gaming struggles', 'Regulatory scrutiny', 'Valuation'] },
    'GOOGL': { marketCap: '$2.0T', peRatio: '25x', revenueGrowth: '+12%', profitMargin: '24%', rating: 'Buy', low52w: 120, high52w: 180, strengths: ['Search dominance', 'YouTube growth', 'Cloud expansion'], weaknesses: ['Ad market risks', 'Antitrust concerns', 'AI competition'] },
    'AMZN': { marketCap: '$1.9T', peRatio: '60x', revenueGrowth: '+11%', profitMargin: '7%', rating: 'Buy', low52w: 118, high52w: 201, strengths: ['AWS leadership', 'E-commerce scale', 'Prime ecosystem'], weaknesses: ['Thin retail margins', 'Labor costs', 'Competition'] },
    'NVDA': { marketCap: '$1.2T', peRatio: '65x', revenueGrowth: '+122%', profitMargin: '55%', rating: 'Strong Buy', low52w: 108, high52w: 505, strengths: ['AI chip dominance', 'Data center growth', 'CUDA ecosystem'], weaknesses: ['Concentration risk', 'Competition', 'Valuation'] },
    'TSLA': { marketCap: '$800B', peRatio: '70x', revenueGrowth: '+19%', profitMargin: '11%', rating: 'Hold', low52w: 138, high52w: 299, strengths: ['EV leadership', 'Manufacturing scale', 'Energy business'], weaknesses: ['Competition growing', 'Execution risks', 'Valuation premium'] },
    'META': { marketCap: '$1.3T', peRatio: '28x', revenueGrowth: '+23%', profitMargin: '29%', rating: 'Buy', low52w: 274, high52w: 531, strengths: ['User engagement', 'Ad efficiency', 'AI investment'], weaknesses: ['Metaverse losses', 'Privacy concerns', 'Competition'] },
    'JPM': { marketCap: '$550B', peRatio: '11x', revenueGrowth: '+8%', profitMargin: '33%', rating: 'Buy', low52w: 135, high52w: 200, strengths: ['Scale advantage', 'Diverse revenue', 'Strong management'], weaknesses: ['Rate sensitivity', 'Regulatory burden', 'Credit risk'] }
  };

  return { ...defaults, ...(stockData[symbol] || {}) };
};

const AssetResearchModal = ({
  asset,
  sector,
  category,
  // Draft-specific props - optional with safe defaults
  isMyTurn = false,
  timeRemaining = 0,
  canPick = false,
  onAcquire = null,
  onClose,
  // Flexible action button configuration
  // actionConfig: { label: string, onClick: fn, variant: 'primary'|'danger'|'secondary', disabled?: boolean }
  actionConfig = null,
  showActionButton = true,
  isGameContext: isGameContextProp,
  version = 2,
  defaultTab = null,
  defaultTimeframe = null,
  realtimeExtremes = null,
  wsPrice = null,
}) => {
  // Stock navigation — allows swapping to a different stock via leaderboard
  const [currentAsset, setCurrentAsset] = useState(asset);
  const [stockHistory, setStockHistory] = useState([]);

  // Sync when the external prop changes (modal opened for a different stock)
  useEffect(() => {
    setCurrentAsset(asset);
    setStockHistory([]);
    // Assets opened without a price (index ETFs, stocks from FantasyTimes) — fetch from EODHD
    if (!(asset?.price > 0)) {
      getStockPrice(asset.symbol).then(data => {
        if (!data?.price || isNaN(data.price)) return;
        setCurrentAsset(prev => {
          if (prev?.symbol !== data.symbol) return prev;
          return { ...prev, price: data.price, percentChange: data.percentChange || 0 };
        });
      }).catch(err => console.warn('[AssetPrice] Failed:', err.message));
    }
  }, [asset?.symbol]);

  const isCrypto = useMemo(() => (
    currentAsset?.isCrypto || currentAsset?.category === 'crypto' || CRYPTO_SYMBOLS.has(currentAsset?.symbol)
  ), [currentAsset?.symbol, currentAsset?.isCrypto, currentAsset?.category]);

  const isIndexAsset = useMemo(() => isIndex(currentAsset?.symbol), [currentAsset?.symbol]);

  const isGameContext = isGameContextProp !== undefined
    ? isGameContextProp
    : (onAcquire !== null || showActionButton);
  const [activeTab, setActiveTab] = useState(defaultTab || (isCrypto ? 'health' : isIndexAsset ? 'marketContext' : 'fundamental'));
  const [whyMovingOpen, setWhyMovingOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [highlightedLevel, setHighlightedLevel] = useState(null);
  const [drawerSnapState, setDrawerSnapState] = useState('mid');
  const [v2ContainerHeight, setV2ContainerHeight] = useState(600);
  const v2ContainerRef = useRef(null);
  const isInternalNavRef = useRef(false);
  const { isMobile, isTablet } = useIsMobile();

  const handleNavigateToStock = useCallback((ticker, name) => {
    isInternalNavRef.current = true;
    setStockHistory(prev => [...prev, currentAsset]);
    setCurrentAsset({ symbol: ticker, name: name || ticker });
  }, [currentAsset]);

  const handleNavigateBack = useCallback(() => {
    if (stockHistory.length === 0) return;
    isInternalNavRef.current = true;
    const prev = stockHistory[stockHistory.length - 1];
    setStockHistory(h => h.slice(0, -1));
    setCurrentAsset(prev);
  }, [stockHistory]);

  const canGoBack = stockHistory.length > 0;
  const isOriginalAsset = currentAsset?.symbol === asset?.symbol;

  const handleClose = useCallback(() => {
    setStockHistory([]);
    onClose();
  }, [onClose]);

  // v2: Responsive chart height — scale to container so date axis clears drawer at mid snap.
  // Drawer mid-top sits at 55% (desktop/tablet) or 62% (mobile) of container.
  // Mobile: 50% of container (min 280) + 40px padding — clears the 62% drawer line.
  // Desktop/tablet: capped at old fixed max but shrinks to 45% when container is small,
  // guaranteeing ≥5% gap (~30px) between chart bottom and drawer top.
  const chartHeight = version >= 2
    ? isMobile
      ? Math.max(Math.round(v2ContainerHeight * 0.5), 280)
      : Math.min(isTablet ? 260 : 300, Math.round(v2ContainerHeight * 0.45))
    : isMobile ? 200 : isTablet ? 260 : 300;

  // v2: Research data hook for chart + enhanced technical tab
  const researchData = useResearchData(version >= 2 ? currentAsset?.symbol : null, {
    currentPrice: (isOriginalAsset ? wsPrice : null) || currentAsset?.price || currentAsset?.currentPrice || 0,
    isCrypto: isCrypto,
    initialTimeframe: defaultTimeframe,
  });

  // Always prefer daily change from OHLCV data over parent-provided percentChange.
  // Parent components (BaggerBomb, Snake Draft) pass entry-based cumulative % change
  // for scoring context, but the research modal should show today's daily change.
  const enrichedAsset = useMemo(() => {
    if (researchData.dailyChange != null) {
      return { ...currentAsset, percentChange: researchData.dailyChange };
    }
    return currentAsset;
  }, [currentAsset, researchData.dailyChange]);

  // v2: Bomb chart data — only available when asset has battle context (threshold + baseline price)
  // Prefer previousClose from OHLCV daily data (most accurate daily baseline) over
  // asset properties. This ensures the bomb chart and BaggerBombTab use yesterday's close
  // as the starting point, matching the scoring engine's daily reset behavior.
  const bombData = useMemo(() => {
    const threshold = currentAsset?.threshold;
    const baselinePrice =
      researchData.previousClose || // OHLCV-derived yesterday's close (most accurate)
      currentAsset?.baselinePrice ||
      currentAsset?.lockedPrice ||
      currentAsset?.startPrice ||
      currentAsset?.startingPrice ||
      currentAsset?.basePrice ||
      currentAsset?.draftPrice ||
      currentAsset?.price ||          // Fallback to current price (aligns with BaggerBombTab)
      currentAsset?.currentPrice ||
      null;
    if (!threshold || threshold <= 0 || !baselinePrice || baselinePrice <= 0) return null;
    return { threshold, baselinePrice };
  }, [researchData.previousClose, currentAsset?.threshold, currentAsset?.lockedPrice, currentAsset?.baselinePrice,
      currentAsset?.startPrice, currentAsset?.startingPrice, currentAsset?.basePrice, currentAsset?.draftPrice,
      currentAsset?.price, currentAsset?.currentPrice]);

  // v2: Measure container height for drawer snap points
  useEffect(() => {
    if (version < 2 || !v2ContainerRef.current) return;
    const measure = () => {
      if (v2ContainerRef.current) {
        setV2ContainerHeight(v2ContainerRef.current.clientHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(v2ContainerRef.current);
    return () => observer.disconnect();
  }, [version]);

  const handleDrawerSnapChange = useCallback((state) => {
    setDrawerSnapState(state);
  }, []);

  // Reset tab default when asset or defaultTab changes (e.g. "View Chart" click while modal is open)
  // Skip reset on internal navigation (leaderboard tap / back button) to preserve tab context,
  // UNLESS the asset type changed (e.g. index → stock), in which case reset to avoid showing
  // an invalid tab (marketContext for a stock, or fundamental for an index).
  useEffect(() => {
    const correctTab = defaultTab || (isCrypto ? 'health' : isIndexAsset ? 'marketContext' : 'fundamental');
    if (isInternalNavRef.current) {
      isInternalNavRef.current = false;
      // Reset tab if it's invalid for the new asset type
      if (
        (activeTab === 'marketContext' && !isIndexAsset) ||
        (activeTab === 'health' && !isCrypto) ||
        (isIndexAsset && activeTab !== 'marketContext' && activeTab !== 'technical') ||
        (isCrypto && activeTab !== 'health')
      ) {
        setActiveTab(correctTab);
      }
      return;
    }
    setActiveTab(correctTab);
  }, [currentAsset?.symbol, defaultTab]);

  useEffect(() => {
    if (currentAsset?.symbol && !isCrypto) {
      setProfileLoading(true);
      setDescExpanded(false);
      getCompanyProfile(currentAsset.symbol)
        .then(data => setProfile(data))
        .finally(() => setProfileLoading(false));
    } else {
      setProfile(null);
    }
  }, [currentAsset?.symbol]);

  // Fetch current price for internally-navigated stocks (not the original asset).
  // The original asset gets wsPrice from parent; navigated stocks need their own price fetch.
  useEffect(() => {
    if (isOriginalAsset || !currentAsset?.symbol) return;
    if (currentAsset?.price > 0) return; // Already has price (e.g., restored from history)

    let cancelled = false;
    getStockPrice(currentAsset.symbol).then(data => {
      if (cancelled || !data?.price) return;
      setCurrentAsset(prev => {
        if (prev?.symbol !== data.symbol) return prev;
        return { ...prev, price: data.price, percentChange: data.percentChange || 0 };
      });
    });
    return () => { cancelled = true; };
  }, [currentAsset?.symbol, isOriginalAsset]);

  if (!asset) return null;

  const sectorColor = getSectorColor(sector);
  const fundamentals = getMockFundamentals(currentAsset.symbol);
  const priceChange = enrichedAsset.percentChange || enrichedAsset.change || 0;

  // Use real rating from API if available, fall back to mock
  const displayRating = profile?.ratingText || fundamentals.rating;
  const ratingColor = getRatingColor(displayRating);

  // Category styles derived from CATEGORY_CONFIG
  const getCategoryStyle = (cat) => {
    const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.neutral;
    const color = config.color;
    // Convert hex to rgba for backgrounds/borders
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    return {
      bg: hexToRgba(color, 0.2),
      color: color,
      border: hexToRgba(color, 0.4),
    };
  };
  const catStyle = getCategoryStyle(category);

  // v2: Compute responsive modal size overrides
  const v2ModalStyle = version >= 2 ? (
    isMobile ? {
      width: '100vw',
      height: '100vh',
      top: 0,
      left: 0,
      transform: 'none',
      borderRadius: 0,
      maxHeight: 'none',
    } : {
      width: '90vw',
      maxWidth: '900px',
      height: '90vh',
      maxHeight: '90vh',
      borderRadius: '12px',
    }
  ) : {};

  // Use Portal to render at document.body level, bypassing any parent CSS constraints
  return ReactDOM.createPortal(
    <>
      {/* Backdrop - matches TopPerformersModal pattern */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1100,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal - matches TopPerformersModal pattern */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(calc(100vw - 40px), 480px)',
          maxHeight: 'calc(100vh - 40px)',
          background: '#0d1117',
          borderRadius: '16px',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 255, 0.15)',
          zIndex: 1101,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalSlideIn 0.3s ease-out',
          ...v2ModalStyle,
        }}
      >
        {/* ON THE CLOCK Alert - Shows when it's user's turn */}
        {isMyTurn && (
          <div
            className={timeRemaining <= 15 ? 'on-the-clock-urgent' : 'on-the-clock-alert'}
            style={{
              background: timeRemaining <= 15
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : 'linear-gradient(90deg, #ff9500, #ff6b00)',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{timeRemaining <= 15 ? '🚨' : '⏰'}</span>
              <div>
                <div style={{
                  fontWeight: 'bold',
                  color: timeRemaining <= 15 ? '#fff' : '#000',
                  fontSize: '14px',
                }}>
                  {timeRemaining <= 15 ? 'HURRY! TIME ALMOST UP!' : "YOU'RE ON THE CLOCK!"}
                </div>
                <div style={{
                  color: timeRemaining <= 15 ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                  fontSize: '12px',
                }}>
                  Make your pick before time runs out
                </div>
              </div>
            </div>

            {/* Time remaining */}
            <div style={{
              background: timeRemaining <= 15 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              color: timeRemaining <= 15 ? '#fff' : '#000',
              fontSize: '18px',
              fontFamily: 'monospace',
              minWidth: '60px',
              textAlign: 'center',
            }}>
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </div>
          </div>
        )}

        {/* CSS for ON THE CLOCK animations */}
        <style>{`
          @keyframes pulse-alert {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.7);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(255, 149, 0, 0);
            }
          }

          @keyframes pulse-urgent {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8);
            }
            50% {
              box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            }
          }

          .on-the-clock-alert {
            animation: pulse-alert 1.5s ease-in-out infinite;
          }

          .on-the-clock-urgent {
            animation: pulse-urgent 0.5s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .on-the-clock-alert,
            .on-the-clock-urgent {
              animation: none !important;
            }
          }
        `}</style>

        {/* Header: v2 compact header vs v1 original header */}
        {version >= 2 ? (
          <ChartHeader asset={enrichedAsset} sector={sector} category={category} isIndex={isIndexAsset} onClose={handleClose} onWhyMoving={() => setWhyMovingOpen(true)} onBack={canGoBack ? handleNavigateBack : undefined} />
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
            }}
          >
            {canGoBack && (
              <button
                onClick={handleNavigateBack}
                style={{
                  background: 'rgba(0, 217, 255, 0.1)', border: '1px solid rgba(0, 217, 255, 0.2)',
                  borderRadius: '6px', color: '#00d9ff', fontSize: '11px', fontWeight: '600',
                  padding: '4px 10px', cursor: 'pointer', marginRight: '8px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                {'\u2190'} Back
              </button>
            )}
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#00d9ff',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Close
            </button>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '20px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Area — v2: positioned container for chart+drawer, v1: scrollable */}
        <div
          ref={version >= 2 ? v2ContainerRef : undefined}
          style={version >= 2
            ? { flex: 1, position: 'relative', overflow: 'visible' }
            : { flex: 1, overflowY: 'auto' }
          }
        >

          {/* v1: Stock Hero Section */}
          {version < 2 && (
            <div
              style={{
                padding: '24px',
                margin: '16px',
                background: `linear-gradient(180deg, ${sectorColor}15 0%, transparent 100%)`,
                border: `1px solid ${sectorColor}40`,
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <h1
                style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  color: '#ffffff',
                  margin: 0,
                  textShadow: `0 0 20px ${sectorColor}40`,
                }}
              >
                {currentAsset.symbol}
              </h1>
              <p
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  margin: '4px 0 0',
                  fontSize: '14px',
                }}
              >
                {currentAsset.name}
              </p>

              {/* Sector Badge */}
              {sector && (
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: `${sectorColor}20`,
                    color: sectorColor,
                    border: `1px solid ${sectorColor}40`,
                  }}
                >
                  {sector}
                </div>
              )}

              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '16px 0 8px',
                  fontFamily: 'monospace',
                }}
              >
                ${currentAsset.price?.toFixed(2) || '\u2014'}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: priceChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: priceChange >= 0 ? '#10b981' : '#ef4444',
                }}
              >
                {priceChange >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(priceChange)?.toFixed(2)}% today
              </div>
            </div>
          )}

          {/* v1: Draft Category Section */}
          {version < 2 && category && (
            <div
              style={{
                padding: '16px 20px',
                margin: '0 16px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>Draft Category</span>
              <span
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: catStyle.bg,
                  color: catStyle.color,
                  border: `1px solid ${catStyle.border}`,
                }}
              >
                {category}
              </span>
            </div>
          )}

          {/* v2: Chart Section */}
          {version >= 2 && (
            <div style={{ flexShrink: 0, position: 'relative', zIndex: 1, paddingBottom: '40px' }}>
              {researchData.loading && !researchData.ohlcvData && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: `${chartHeight}px`, background: '#0a0e14',
                }}>
                  <div style={{
                    width: '90%', height: '200px', borderRadius: '8px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }} />
                </div>
              )}
              {researchData.error && !researchData.ohlcvData && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: `${chartHeight}px`, background: '#0a0e14', gap: '12px',
                }}>
                  <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '14px' }}>
                    Chart data unavailable
                  </span>
                  <button
                    onClick={researchData.retry}
                    style={{
                      padding: '6px 16px', borderRadius: '6px',
                      border: '1px solid rgba(0, 217, 255, 0.3)',
                      background: 'rgba(0, 217, 255, 0.1)',
                      color: '#00d9ff', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {researchData.ohlcvData && researchData.ohlcvData.length > 0 && (
                <StockChart
                  key={currentAsset?.symbol}
                  ohlcvData={researchData.ohlcvData}
                  rawData={researchData.rawData}
                  timeframe={researchData.timeframe}
                  onTimeframeChange={researchData.setTimeframe}
                  levels={researchData.levels}
                  smaData={researchData.smaData}
                  activeHighlight={highlightedLevel}
                  height={chartHeight}
                  bombData={bombData}
                  symbol={currentAsset?.symbol}
                  todayDailyCandle={researchData.todayDailyCandle}
                  realtimeExtremes={isOriginalAsset ? realtimeExtremes : null}
                />
              )}
            </div>
          )}

          {/* v2: Chart dim overlay when drawer is at full */}
          {version >= 2 && drawerSnapState === 'full' && (
            <div
              onClick={() => setDrawerSnapState('mid')}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(10, 14, 20, 0.7)',
                zIndex: 5,
                transition: 'opacity 0.3s ease',
              }}
            />
          )}

          {/* v2: AnalysisDrawer with tab content inside */}
          {version >= 2 && (
            <AnalysisDrawer
              containerHeight={v2ContainerHeight}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onSnapStateChange={handleDrawerSnapChange}
              isCrypto={isCrypto}
              isIndex={isIndexAsset}
              hasBombData={!!bombData}
              isGameContext={isGameContext}
            >
              {activeTab === 'fundamental' && (
                <div style={{ padding: '8px 0' }}>
                  {/* Rating */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: ratingColor, fontWeight: '600', fontSize: '14px' }}>
                      {'\u25CF'} {displayRating}
                    </span>
                  </div>
                  {/* Company profile: sector/industry pills + description */}
                  {profileLoading && (
                    <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ height: '12px', width: '40%', borderRadius: '6px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '8px' }} />
                      <div style={{ height: '10px', width: '90%', borderRadius: '5px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    </div>
                  )}
                  {profile && !profileLoading && (profile.sector !== 'Unknown' || profile.description) && (
                    <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: profile.description ? '8px' : 0 }}>
                        {profile.sector && profile.sector !== 'Unknown' && (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '600' }}>
                            {profile.sector}
                          </span>
                        )}
                        {profile.industry && profile.industry !== 'Unknown' && (
                          <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '600' }}>
                            {profile.industry}
                          </span>
                        )}
                      </div>
                      {profile.description && (
                        <>
                          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', lineHeight: '1.5', margin: 0, overflow: 'hidden', maxHeight: descExpanded ? 'none' : '48px' }}>
                            {profile.description}
                          </p>
                          {profile.description.length > 150 && (
                            <button
                              onClick={() => setDescExpanded(!descExpanded)}
                              style={{ color: '#14b8a6', background: 'none', border: 'none', fontSize: '10px', cursor: 'pointer', padding: '4px 0 0', fontWeight: '500' }}
                            >
                              {descExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {/* Q&A Cards — Ask About This Stock */}
                  <AnalysisQATab
                    symbol={currentAsset?.symbol}
                    companyName={profile?.Name || currentAsset?.name}
                  />
                </div>
              )}

              {activeTab === 'health' && (
                <HealthTab asset={currentAsset} symbol={currentAsset?.symbol} />
              )}

              {activeTab === 'technical' && (
                <TechnicalTabV2
                  asset={currentAsset}
                  ohlcvData={researchData.ohlcvData}
                  indicators={researchData.indicators}
                  levels={researchData.levels}
                  onLevelHighlight={setHighlightedLevel}
                />
              )}

              {activeTab === 'baggerbomb' && (
                <BaggerBombTab asset={currentAsset} />
              )}

              {activeTab === 'compete' && (
                <CompeteTab
                  symbol={currentAsset?.symbol}
                  isMobile={isMobile}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}

              {activeTab === 'sector' && (
                <SectorTab
                  symbol={currentAsset?.symbol}
                  isMobile={isMobile}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}

              {activeTab === 'marketContext' && (
                <MarketContextTab
                  symbol={currentAsset?.symbol}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}
            </AnalysisDrawer>
          )}

          {/* v1: AI Analysis Section (original layout) */}
          {version < 2 && (
          <div
            style={{
              padding: '20px',
              margin: '0 16px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                color: '#ffffff',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
              <h2 style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
                AI ANALYSIS
              </h2>
            </div>

            {/* Tabs - Horizontal scroll carousel for mobile */}
            <div
              className="ai-tabs-scroll"
              style={{
                display: 'flex',
                gap: '6px',
                marginBottom: '16px',
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                marginLeft: '-20px',
                marginRight: '-20px',
                paddingLeft: '20px',
                paddingRight: '20px',
                paddingBottom: '4px',
              }}
            >
              <style>{`
                .ai-tabs-scroll::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {isCrypto && (
              <button
                onClick={() => setActiveTab('health')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'health' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'health' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'health' ? '#f59e0b' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {'\u26D3\uFE0F'} Health
              </button>
              )}
              {!isCrypto && (
              <button
                onClick={() => setActiveTab('fundamental')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'fundamental' ? '1px solid #00d9ff' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'fundamental' ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'fundamental' ? '#00d9ff' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Analysis
              </button>
              )}
              {!isCrypto && (
              <button
                onClick={() => setActiveTab('compete')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'compete' ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'compete' ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'compete' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Ranks
              </button>
              )}
              {!isCrypto && (
              <button
                onClick={() => setActiveTab('sector')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'sector' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'sector' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'sector' ? '#f59e0b' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Sector
              </button>
              )}
              <button
                onClick={() => setActiveTab('technical')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'technical' ? '1px solid #00d9ff' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'technical' ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'technical' ? '#00d9ff' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Technical
              </button>
              {(bombData || isGameContext) && (
                <button
                  onClick={() => setActiveTab('baggerbomb')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: activeTab === 'baggerbomb' ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: activeTab === 'baggerbomb' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: activeTab === 'baggerbomb' ? '#00ff88' : 'rgba(255, 255, 255, 0.6)',
                    fontWeight: '600',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  💣 Bomb
                </button>
              )}
            </div>

            {activeTab === 'fundamental' && (
              <div>
                {/* Rating */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}
                >
                  <span style={{ color: ratingColor, fontWeight: '600', fontSize: '14px' }}>
                    ● {displayRating}
                  </span>
                </div>

                {/* Company Profile Section */}
                {profileLoading && (
                  <div style={{
                    padding: '16px',
                    marginBottom: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                  }}>
                    <div style={{
                      height: '14px', width: '40%', borderRadius: '7px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '10px',
                    }} />
                    <div style={{
                      height: '12px', width: '90%', borderRadius: '6px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '6px',
                    }} />
                    <div style={{
                      height: '12px', width: '70%', borderRadius: '6px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }} />
                    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                  </div>
                )}

                {profile && !profileLoading && (profile.sector !== 'Unknown' || profile.description) && (
                  <div style={{
                    padding: '14px 16px',
                    marginBottom: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}>
                    {/* Sector · Industry pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: profile.description ? '10px' : 0 }}>
                      {profile.sector && profile.sector !== 'Unknown' && (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          {profile.sector}
                        </span>
                      )}
                      {profile.industry && profile.industry !== 'Unknown' && (
                        <span style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#818cf8',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          {profile.industry}
                        </span>
                      )}
                    </div>
                    {/* Company description */}
                    {profile.description && (
                      <>
                        <p style={{
                          color: 'rgba(255, 255, 255, 0.55)',
                          fontSize: '12px',
                          lineHeight: '1.55',
                          margin: 0,
                          overflow: 'hidden',
                          maxHeight: descExpanded ? 'none' : '54px',
                        }}>
                          {profile.description}
                        </p>
                        {profile.description.length > 150 && (
                          <button
                            onClick={() => setDescExpanded(!descExpanded)}
                            style={{
                              color: '#14b8a6',
                              background: 'none',
                              border: 'none',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '4px 0 0',
                              fontWeight: '500',
                            }}
                          >
                            {descExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Q&A Cards — Ask About This Stock */}
                <AnalysisQATab
                  symbol={currentAsset?.symbol}
                  companyName={profile?.Name || currentAsset?.name}
                />
              </div>
            )}

            {activeTab === 'health' && (
              <HealthTab asset={currentAsset} symbol={currentAsset?.symbol} />
            )}

            {activeTab === 'technical' && (
              <TechnicalAnalysisTab asset={currentAsset} fundamentals={fundamentals} />
            )}

            {activeTab === 'baggerbomb' && (
              <BaggerBombTab asset={currentAsset} />
            )}

            {activeTab === 'compete' && (
              <CompeteTab
                symbol={currentAsset?.symbol}
                isMobile={isMobile}
                onNavigateToStock={handleNavigateToStock}
              />
            )}

            {activeTab === 'sector' && (
              <SectorTab
                symbol={currentAsset?.symbol}
                isMobile={isMobile}
                onNavigateToStock={handleNavigateToStock}
              />
            )}
          </div>
          )}
        </div>

        {/* Action Button Section - Flexible Configuration */}
        {showActionButton && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.3)',
              flexShrink: 0,
            }}
          >
            {/* Draft Mode: ON THE CLOCK - Original behavior */}
            {isMyTurn && canPick && onAcquire && (
              <button
                onClick={() => {
                  onAcquire(currentAsset);
                  handleClose();
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.1) 100%)',
                  border: '2px solid #00ff88',
                  borderRadius: '10px',
                  color: '#e6edf3',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Acquire {currentAsset.symbol}
              </button>
            )}

            {/* Custom Action Button - New flexible option */}
            {!isMyTurn && actionConfig && (
              <button
                onClick={actionConfig.onClick}
                disabled={actionConfig.disabled}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: actionConfig.variant === 'danger'
                    ? 'linear-gradient(135deg, rgba(255, 51, 102, 0.3) 0%, rgba(255, 51, 102, 0.1) 100%)'
                    : actionConfig.variant === 'secondary'
                    ? 'transparent'
                    : 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.1) 100%)',
                  border: `2px solid ${
                    actionConfig.variant === 'danger'
                      ? '#ff3366'
                      : actionConfig.variant === 'secondary'
                      ? '#374151'
                      : '#00ff88'
                  }`,
                  borderRadius: '10px',
                  color: actionConfig.variant === 'secondary'
                    ? '#8b949e'
                    : '#e6edf3',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: actionConfig.disabled ? 'not-allowed' : 'pointer',
                  opacity: actionConfig.disabled ? 0.5 : 1,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'all 0.2s ease',
                }}
              >
                {actionConfig.label}
              </button>
            )}

            {/* Research Only Mode - Just close button */}
            {!isMyTurn && !actionConfig && (
              <button
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '10px',
                  color: '#8b949e',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Close
              </button>
            )}
          </div>
        )}

        {/* Animations - matches TopPerformersModal */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: translate(-50%, -45%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `}</style>
      </div>

      {/* Why is it moving? bottom sheet */}
      <WhyMovingPopup
        symbol={currentAsset?.symbol}
        name={currentAsset?.name}
        change={currentAsset?.percentChange || currentAsset?.change}
        price={currentAsset?.price}
        isOpen={whyMovingOpen}
        onClose={() => setWhyMovingOpen(false)}
        open={researchData.todayDailyCandle?.open}
        high={researchData.todayDailyCandle?.high}
        low={researchData.todayDailyCandle?.low}
        close={researchData.todayDailyCandle?.close}
      />
    </>,
    document.body
  );
};

export default AssetResearchModal;
