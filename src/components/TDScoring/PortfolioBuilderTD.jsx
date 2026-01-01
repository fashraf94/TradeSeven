// PortfolioBuilderTD - TD Scoring portfolio builder mirroring Classic builder design
// Clean grid selection with cart modal for allocations

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, Building2, Heart, ShoppingBag, ShoppingCart,
  Zap, Factory, Lightbulb, Home, Radio,
  Target, TrendingUp, Rocket
} from 'lucide-react';
import { STOCKS, CRYPTO } from '../../data/assets';
import { getVolatilityThresholds } from '../../services/volatilityService';
import { getMultipleStockPrices, getMultipleCryptoPrices } from '../../services/eodhdAPI';
import StockDetailModal from './StockDetailModal';

// Color scheme matching existing app
const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBgHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  borderHover: 'rgba(255,255,255,0.2)',
  primary: '#00d9ff',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)'
};

// Sector definitions with Lucide icons
const SECTORS = [
  { id: 'Technology', label: 'Tech', icon: Monitor, color: '#8b5cf6' },
  { id: 'Finance', label: 'Finance', icon: Building2, color: '#3b82f6' },
  { id: 'Healthcare', label: 'Health', icon: Heart, color: '#10b981' },
  { id: 'Consumer Discretionary', label: 'Consumer', icon: ShoppingBag, color: '#f59e0b' },
  { id: 'Consumer Staples', label: 'Staples', icon: ShoppingCart, color: '#6366f1' },
  { id: 'Energy', label: 'Energy', icon: Zap, color: '#eab308' },
  { id: 'Industrials', label: 'Industrial', icon: Factory, color: '#64748b' },
  { id: 'Utilities', label: 'Utilities', icon: Lightbulb, color: '#22c55e' },
  { id: 'Real Estate', label: 'Real Estate', icon: Home, color: '#ec4899' },
  { id: 'Telecom', label: 'Telecom', icon: Radio, color: '#06b6d4' }
];

// Difficulty config for threshold badges
const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: '#10b981', threshold: 2 },
  medium: { label: 'Medium', color: '#f59e0b', threshold: 4 },
  hard: { label: 'Hard', color: '#ef4444', threshold: Infinity }
};

// Get difficulty level from threshold value
const getDifficultyLevel = (threshold) => {
  if (!threshold) return null;
  if (threshold <= 2) return 'easy';
  if (threshold <= 4) return 'medium';
  return 'hard';
};

// Allocation constraints
const STOCK_MIN_ALLOCATION = 7.5;
const STOCK_MAX_ALLOCATION = 20;
const CRYPTO_ALLOCATION = 10;
const STOCK_TOTAL_ALLOCATION = 90;

// Get difficulty info from threshold
const getDifficulty = (threshold) => {
  const level = getDifficultyLevel(threshold);
  if (!level) return null;
  return DIFFICULTY_CONFIG[level];
};

// ThresholdBadge component - styled icon badge for breakout thresholds
const ThresholdBadge = ({ type, value }) => {
  const config = {
    breakout: { label: 'TD', color: '#10b981', icon: Target },
    rally: { label: 'Rally', color: '#f59e0b', icon: TrendingUp },
    moonshot: { label: 'Moon', color: '#8b5cf6', icon: Rocket }
  };

  const { color, icon: Icon } = config[type];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 8px',
      backgroundColor: `${color}20`,
      borderRadius: '12px',
      fontSize: '11px',
      color: color
    }}>
      <Icon size={12} />
      <span>{value}%</span>
    </div>
  );
};

// SectorTab component - styled sector tab with Lucide icons
const SectorTab = ({ sector, isActive, onClick, count }) => {
  const Icon = sector.icon;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: isActive ? `${sector.color}15` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? sector.color : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '20px',
        color: isActive ? sector.color : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
      }}
    >
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isActive ? sector.color : `${sector.color}20`
      }}>
        <Icon size={16} color={isActive ? '#fff' : sector.color} />
      </div>
      <span style={{ fontWeight: '500', fontSize: '14px' }}>{sector.label}</span>
      <span style={{ fontSize: '12px', opacity: 0.7 }}>({count})</span>
    </button>
  );
};

// DifficultyHeader component for grouped stock sections
const DifficultyHeader = ({ level, count }) => {
  const config = {
    easy: { icon: Target, hint: 'Lower thresholds, more consistent scoring' },
    medium: { icon: TrendingUp, hint: 'Balanced risk and reward' },
    hard: { icon: Rocket, hint: 'Higher thresholds, bigger bonus potential' }
  };

  const { icon: Icon, hint } = config[level];
  const { label, color } = DIFFICULTY_CONFIG[level];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      marginBottom: '12px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '13px',
        fontWeight: '600',
        backgroundColor: `${color}15`,
        color: color
      }}>
        <Icon size={14} />
        <span>{label} TD</span>
        <span style={{ opacity: 0.7, fontWeight: '400' }}>({count})</span>
      </div>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
        {hint}
      </span>
    </div>
  );
};

// Default thresholds fallback for when API fails
const getDefaultThresholds = () => {
  const defaults = {};

  // Stock defaults based on typical volatility
  const stockDefaults = {
    'AAPL': 1.5, 'MSFT': 1.3, 'GOOGL': 1.8, 'AMZN': 2.0, 'META': 2.5,
    'NVDA': 3.5, 'TSLA': 4.0, 'AMD': 3.2, 'AVGO': 2.5, 'CRM': 2.0,
    'V': 1.3, 'MA': 1.4, 'JPM': 1.5, 'BAC': 1.8, 'GS': 2.0,
    'JNJ': 1.0, 'UNH': 1.5, 'PFE': 1.8, 'MRK': 1.5, 'ABBV': 1.6,
    'XOM': 1.8, 'CVX': 1.7, 'COP': 2.2, 'SLB': 2.5, 'EOG': 2.3,
    'WMT': 1.2, 'PG': 1.0, 'KO': 1.0, 'PEP': 1.1, 'COST': 1.4,
    'HD': 1.6, 'NKE': 2.0, 'MCD': 1.2, 'SBUX': 1.8, 'TGT': 2.0,
    'CAT': 1.8, 'HON': 1.5, 'UPS': 1.6, 'BA': 2.5, 'GE': 2.0,
    'NEE': 1.4, 'DUK': 1.2, 'SO': 1.1, 'D': 1.3, 'AEP': 1.2,
    'PLD': 2.0, 'AMT': 1.8, 'SPG': 2.2, 'O': 1.5, 'EQIX': 1.8,
    'T': 1.5, 'VZ': 1.3, 'TMUS': 1.6, 'CMCSA': 1.7, 'CHTR': 2.0,
    'DEFAULT': 2.0
  };

  const cryptoDefaults = {
    'BTC': 5.0, 'ETH': 6.0, 'SOL': 8.0, 'ADA': 7.0, 'AVAX': 8.5,
    'DOT': 7.0, 'NEAR': 9.0, 'APT': 10.0, 'DOGE': 10.0, 'XRP': 6.5,
    'LINK': 7.5, 'MATIC': 8.0, 'ATOM': 7.0, 'UNI': 8.0, 'LTC': 5.5,
    'DEFAULT': 7.0
  };

  // Build threshold objects for stocks
  STOCKS.forEach(stock => {
    const base = stockDefaults[stock.symbol] || stockDefaults['DEFAULT'];
    defaults[stock.symbol] = {
      threshold: base,
      rallyThreshold: base * 1.5,
      moonshotThreshold: base * 2
    };
  });

  // Build threshold objects for crypto
  CRYPTO.forEach(crypto => {
    const base = cryptoDefaults[crypto.symbol] || cryptoDefaults['DEFAULT'];
    defaults[crypto.symbol] = {
      threshold: base,
      rallyThreshold: base * 1.5,
      moonshotThreshold: base * 2
    };
  });

  return defaults;
};

/**
 * PortfolioBuilderTD - Main component
 */
export default function PortfolioBuilderTD({
  onSubmit,
  onBack,
  stockPrices: initialStockPrices = {},
  cryptoPrices: initialCryptoPrices = {},
  thresholds: initialThresholds = {}
}) {
  // Portfolio state
  const [portfolio, setPortfolio] = useState([]);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [bench, setBench] = useState([]);
  const [benchCrypto, setBenchCrypto] = useState(null);
  const [portfolioName, setPortfolioName] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState('Technology');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showBenchModal, setShowBenchModal] = useState(false);
  const [benchModalType, setBenchModalType] = useState('stock');
  const [selectedStockForDetail, setSelectedStockForDetail] = useState(null);

  // Data state
  const [stockPrices, setStockPrices] = useState(initialStockPrices);
  const [cryptoPrices, setCryptoPrices] = useState(initialCryptoPrices);
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [isLoadingPrices, setIsLoadingPrices] = useState(Object.keys(initialStockPrices).length === 0);
  const [isLoadingThresholds, setIsLoadingThresholds] = useState(Object.keys(initialThresholds).length === 0);
  const [isCreating, setIsCreating] = useState(false);

  // Load prices and thresholds on mount
  useEffect(() => {
    const loadData = async () => {
      const needsPrices = Object.keys(initialStockPrices).length === 0;
      const needsThresholds = Object.keys(initialThresholds).length === 0;

      if (needsPrices) setIsLoadingPrices(true);
      if (needsThresholds) setIsLoadingThresholds(true);

      try {
        const stockSymbols = STOCKS.map(s => s.symbol);
        const cryptoSymbols = CRYPTO.filter(c => c.category !== 'Stablecoin').map(c => c.symbol);

        // Fetch prices and thresholds in parallel
        const [stockPricesResult, cryptoPricesResult, stockThresholds, cryptoThresholds] = await Promise.all([
          needsPrices ? getMultipleStockPrices(stockSymbols) : Promise.resolve(null),
          needsPrices ? getMultipleCryptoPrices(cryptoSymbols) : Promise.resolve(null),
          needsThresholds ? getVolatilityThresholds(stockSymbols, 'stock') : Promise.resolve(null),
          needsThresholds ? getVolatilityThresholds(cryptoSymbols, 'crypto') : Promise.resolve(null)
        ]);

        if (stockPricesResult) setStockPrices(stockPricesResult);
        if (cryptoPricesResult) setCryptoPrices(cryptoPricesResult);

        if (stockThresholds || cryptoThresholds) {
          const allThresholds = { ...(stockThresholds || {}), ...(cryptoThresholds || {}) };
          // If we got some thresholds, use them; otherwise use defaults
          if (Object.keys(allThresholds).length > 0) {
            setThresholds(allThresholds);
          } else {
            setThresholds(getDefaultThresholds());
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        // Use fallback defaults if threshold fetch fails
        if (Object.keys(initialThresholds).length === 0) {
          setThresholds(getDefaultThresholds());
        }
      } finally {
        setIsLoadingPrices(false);
        setIsLoadingThresholds(false);
      }
    };

    loadData();
  }, [initialStockPrices, initialThresholds]);

  // Filter stocks by sector and search
  const filteredStocks = useMemo(() => {
    return STOCKS.filter(stock => {
      if (stock.sector !== activeTab) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return stock.symbol.toLowerCase().includes(q) || stock.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeTab, searchQuery]);

  // Filter crypto (exclude stablecoins)
  const availableCrypto = useMemo(() => {
    return CRYPTO.filter(c => c.category !== 'Stablecoin');
  }, []);

  // Get stock count by sector
  const getStockCountBySector = useCallback((sectorId) => {
    return STOCKS.filter(s => s.sector === sectorId).length;
  }, []);

  // Toggle stock selection
  const toggleStock = useCallback((stock) => {
    setPortfolio(prev => {
      const exists = prev.find(p => p.symbol === stock.symbol);
      if (exists) {
        return prev.filter(p => p.symbol !== stock.symbol);
      }
      if (prev.length >= 12) return prev;

      const price = stockPrices[stock.symbol]?.price || 0;
      const defaultAllocation = 90 / Math.max(prev.length + 1, 6);
      return [...prev, {
        ...stock,
        price,
        allocation: Math.round(Math.min(STOCK_MAX_ALLOCATION, Math.max(STOCK_MIN_ALLOCATION, defaultAllocation)) * 100) / 100
      }];
    });
  }, [stockPrices]);

  // Update allocation
  const updateAllocation = useCallback((symbol, value) => {
    setPortfolio(prev => prev.map(p =>
      p.symbol === symbol
        ? { ...p, allocation: Math.round(Math.max(STOCK_MIN_ALLOCATION, Math.min(STOCK_MAX_ALLOCATION, value)) * 100) / 100 }
        : p
    ));
  }, []);

  // Remove stock
  const removeStock = useCallback((symbol) => {
    setPortfolio(prev => prev.filter(p => p.symbol !== symbol));
  }, []);

  // Distribute evenly
  const distributeEvenly = useCallback(() => {
    if (portfolio.length === 0) return;
    const baseAllocation = STOCK_TOTAL_ALLOCATION / portfolio.length;

    setPortfolio(prev => prev.map((stock, index) => {
      let allocation = baseAllocation;
      if (index === prev.length - 1) {
        const sumSoFar = (prev.length - 1) * (Math.round(baseAllocation * 100) / 100);
        allocation = STOCK_TOTAL_ALLOCATION - sumSoFar;
      }
      return { ...stock, allocation: Math.round(allocation * 100) / 100 };
    }));
  }, [portfolio.length]);

  // Add to bench
  const addToBench = useCallback((asset, type) => {
    if (type === 'stock') {
      if (bench.length >= 4) return;
      const price = stockPrices[asset.symbol]?.price || 0;
      setBench(prev => [...prev, { ...asset, price }]);
    } else {
      setBenchCrypto({ ...asset, price: cryptoPrices[asset.symbol]?.price || 0 });
    }
    setShowBenchModal(false);
  }, [bench.length, stockPrices, cryptoPrices]);

  // Remove from bench
  const removeFromBench = useCallback((symbol, type) => {
    if (type === 'crypto') {
      setBenchCrypto(null);
    } else {
      setBench(prev => prev.filter(b => b.symbol !== symbol));
    }
  }, []);

  // Calculations
  const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
  const totalAllocation = portfolio.reduce((sum, p) => sum + (p.allocation || 0), 0) + (selectedCrypto ? CRYPTO_ALLOCATION : 0);
  const rosterComplete = portfolio.length >= 6 && Math.abs(totalAllocation - 100) < 0.1;
  const cryptoComplete = selectedCrypto !== null;
  const benchComplete = bench.length === 4 && benchCrypto !== null;

  // Excluded symbols for bench
  const excludedSymbols = useMemo(() => [
    ...portfolio.map(p => p.symbol),
    selectedCrypto?.symbol,
    ...bench.map(b => b.symbol),
    benchCrypto?.symbol
  ].filter(Boolean), [portfolio, selectedCrypto, bench, benchCrypto]);

  // Handle create battle
  const handleCreateBattle = async () => {
    if (!rosterComplete || !cryptoComplete || !benchComplete || !portfolioName.trim()) return;

    setIsCreating(true);
    try {
      const creatorPortfolio = portfolio
        .filter(stock => stock && stock.symbol)
        .map(stock => ({
          symbol: String(stock.symbol || ''),
          name: String(stock.name || stock.symbol || ''),
          price: Number(stock.price) || Number(stockPrices[stock.symbol]?.price) || 0,
          amount: Math.round((Number(stock.allocation) || 15) / 100 * 1000000),
          position: 'long'
        }));

      if (selectedCrypto) {
        creatorPortfolio.push({
          symbol: String(selectedCrypto.symbol || ''),
          name: String(selectedCrypto.name || selectedCrypto.symbol || ''),
          price: Number(cryptoPrices[selectedCrypto.symbol]?.price) || 0,
          amount: 100000,
          position: 'long'
        });
      }

      const creatorBench = bench
        .filter(stock => stock && stock.symbol)
        .map(stock => ({
          symbol: String(stock.symbol || ''),
          name: String(stock.name || stock.symbol || ''),
          price: Number(stock.price) || Number(stockPrices[stock.symbol]?.price) || 0,
          amount: 0,
          position: 'long'
        }));

      if (benchCrypto) {
        creatorBench.push({
          symbol: String(benchCrypto.symbol || ''),
          name: String(benchCrypto.name || benchCrypto.symbol || ''),
          price: Number(cryptoPrices[benchCrypto.symbol]?.price) || 0,
          amount: 0,
          position: 'long'
        });
      }

      console.log('Creating TD Battle:', { portfolioName, creatorPortfolio, creatorBench });

      await onSubmit({
        portfolioName: portfolioName.trim(),
        roster: creatorPortfolio,
        crypto: null,
        bench: creatorBench,
        benchCrypto: null,
        thresholds
      });
    } catch (error) {
      console.error('Error creating battle:', error);
      alert('Failed to create TD battle. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (isLoadingPrices || isLoadingThresholds) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid transparent',
            borderTopColor: colors.primary,
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{ color: colors.textSecondary }}>
            {isLoadingThresholds ? 'Loading breakout thresholds...' : 'Loading market data...'}
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: 'rgba(10,10,15,0.95)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textSecondary,
            fontSize: '14px',
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          ← Back
        </button>

        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: colors.textPrimary }}>
          TD Battle
        </h1>

        <button
          onClick={() => setShowCart(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: portfolio.length > 0 ? colors.primary : 'transparent',
            border: portfolio.length > 0 ? 'none' : `1px solid ${colors.border}`,
            color: portfolio.length > 0 ? '#000' : colors.textSecondary,
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s'
          }}
        >
          🛒 Cart
          {totalAssets > 0 && (
            <span style={{
              backgroundColor: portfolio.length > 0 ? 'rgba(0,0,0,0.3)' : colors.primary,
              color: portfolio.length > 0 ? '#000' : '#fff',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {totalAssets}
            </span>
          )}
        </button>
      </header>

      {/* Requirements & Progress */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '13px', color: colors.textSecondary }}>
          Longs: <span style={{ color: portfolio.length >= 6 ? colors.green : colors.yellow }}>{portfolio.length}/6 min</span>
          {' • '}
          Crypto: <span style={{ color: selectedCrypto ? colors.green : colors.yellow }}>{selectedCrypto ? '1/1' : '0/1'}</span>
        </div>
        <div style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: '600' }}>
          {totalAssets}/7 minimum
          {portfolio.length >= 6 && selectedCrypto && (
            <span style={{ color: colors.green, marginLeft: '6px' }}>✓</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: '4px',
        backgroundColor: colors.border,
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, (totalAssets / 13) * 100)}%`,
          backgroundColor: totalAssets >= 7 ? colors.green : colors.primary,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Search Bar */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '10px'
        }}>
          <span style={{ color: colors.textMuted }}>🔍</span>
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.textPrimary,
              fontSize: '14px'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Sector Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '0 16px 12px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none'
      }}>
        {SECTORS.map(sector => (
          <SectorTab
            key={sector.id}
            sector={sector}
            isActive={activeTab === sector.id}
            onClick={() => setActiveTab(sector.id)}
            count={getStockCountBySector(sector.id)}
          />
        ))}
      </div>

      {/* Stock Grid - Grouped by Difficulty */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '0 16px 16px'
      }}>
        {(() => {
          // Group stocks by difficulty
          const grouped = { easy: [], medium: [], hard: [] };
          filteredStocks.forEach(stock => {
            const threshold = thresholds[stock.symbol]?.threshold || 2.5;
            const level = getDifficultyLevel(threshold);
            if (level && grouped[level]) {
              grouped[level].push(stock);
            }
          });

          // Render grouped sections
          return ['easy', 'medium', 'hard'].map(level => {
            const stocks = grouped[level];
            if (stocks.length === 0) return null;

            return (
              <div key={level} style={{ display: 'flex', flexDirection: 'column' }}>
                <DifficultyHeader level={level} count={stocks.length} />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: '10px'
                }}>
                  {stocks.map(stock => {
                    const price = stockPrices[stock.symbol]?.price || 0;
                    const change = stockPrices[stock.symbol]?.percentChange || 0;
                    const isSelected = portfolio.some(p => p.symbol === stock.symbol);
                    const threshold = thresholds[stock.symbol];
                    const difficultyColor = DIFFICULTY_CONFIG[level].color;

                    return (
                      <button
                        key={stock.symbol}
                        onClick={() => setSelectedStockForDetail(stock)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '14px 10px',
                          backgroundColor: isSelected ? 'rgba(0,217,255,0.1)' : colors.cardBg,
                          border: `2px solid ${isSelected ? colors.primary : 'transparent'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.2s'
                        }}
                      >
                        {/* Difficulty indicator bar at top */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          backgroundColor: difficultyColor
                        }} />

                        <div style={{ fontSize: '15px', fontWeight: '700', color: colors.textPrimary, marginTop: '2px' }}>
                          {stock.symbol}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: colors.textMuted,
                          textAlign: 'center',
                          marginTop: '2px',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {stock.name}
                        </div>
                        <div style={{ fontSize: '13px', color: colors.primary, marginTop: '6px' }}>
                          ${price.toFixed(2)}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: change >= 0 ? colors.green : colors.red,
                          marginTop: '2px'
                        }}>
                          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                        </div>
                        {/* Threshold display */}
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          marginTop: '4px',
                          color: difficultyColor
                        }}>
                          TD: {threshold?.threshold?.toFixed(1) || '—'}%
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Crypto Section */}
      <div style={{ padding: '0 16px 100px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '8px 0 16px',
          color: colors.textMuted
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
          <span style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '1px' }}>₿ CRYPTO (PICK 1)</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '10px'
        }}>
          {availableCrypto.slice(0, 8).map(crypto => {
            const price = cryptoPrices[crypto.symbol]?.price || 0;
            const change = cryptoPrices[crypto.symbol]?.percentChange || 0;
            const isSelected = selectedCrypto?.symbol === crypto.symbol;

            const threshold = thresholds[crypto.symbol];
            const difficultyLevel = threshold?.threshold <= 6 ? 'medium' : 'hard';
            const difficultyColor = difficultyLevel === 'medium' ? colors.yellow : colors.red;

            return (
              <button
                key={crypto.symbol}
                onClick={() => setSelectedStockForDetail(crypto)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 8px',
                  backgroundColor: isSelected ? 'rgba(245,158,11,0.15)' : colors.cardBg,
                  border: `2px solid ${isSelected ? colors.yellow : 'transparent'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s'
                }}
              >
                {/* Difficulty indicator bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: difficultyColor
                }} />
                <div style={{ fontSize: '15px', fontWeight: '700', color: colors.yellow, marginTop: '2px' }}>
                  {crypto.symbol}
                </div>
                <div style={{ fontSize: '12px', color: colors.primary, marginTop: '6px' }}>
                  ${price < 1 ? price.toFixed(4) : price.toFixed(2)}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: change >= 0 ? colors.green : colors.red,
                  marginTop: '2px'
                }}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </div>
                {/* Threshold display */}
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  marginTop: '4px',
                  color: difficultyColor
                }}>
                  TD: {threshold?.threshold?.toFixed(1) || '—'}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart Modal */}
      <AnimatePresence>
        {showCart && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center'
            }}
            onClick={() => setShowCart(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                backgroundColor: '#12121a',
                borderRadius: '20px 20px 0 0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Cart Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: colors.textPrimary }}>
                  Your Portfolio
                </h2>
                <button
                  onClick={() => setShowCart(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textMuted,
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Cart Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {/* Portfolio Name */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>
                    Portfolio Name *
                  </label>
                  <input
                    type="text"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="Enter portfolio name..."
                    maxLength={30}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${portfolioName.trim() ? colors.green : colors.border}`,
                      backgroundColor: colors.cardBg,
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Progress */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ color: colors.textSecondary }}>{totalAssets}/13 assets</span>
                    <span style={{
                      color: Math.abs(totalAllocation - 100) < 0.1 ? colors.green : totalAllocation > 100 ? colors.red : colors.yellow
                    }}>
                      {totalAllocation.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{
                    height: '6px',
                    backgroundColor: colors.border,
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, totalAllocation)}%`,
                      backgroundColor: Math.abs(totalAllocation - 100) < 0.1 ? colors.green : totalAllocation > 100 ? colors.red : colors.primary,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>

                {/* Distribute Evenly */}
                {portfolio.length >= 2 && (
                  <button
                    onClick={distributeEvenly}
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginBottom: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: 'transparent',
                      color: colors.textSecondary,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    ⚖️ Distribute Evenly
                  </button>
                )}

                {/* Stock List */}
                <div style={{ marginBottom: '16px' }}>
                  {portfolio.map(stock => {
                    const threshold = thresholds[stock.symbol];
                    const difficulty = getDifficulty(threshold?.threshold);

                    return (
                      <div
                        key={stock.symbol}
                        style={{
                          padding: '12px',
                          marginBottom: '8px',
                          backgroundColor: colors.cardBg,
                          borderRadius: '10px',
                          border: `1px solid ${colors.border}`
                        }}
                      >
                        {/* Stock Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px'
                        }}>
                          <div>
                            <span style={{ fontWeight: '600', color: colors.textPrimary }}>{stock.symbol}</span>
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: colors.textMuted }}>
                              ${stock.price?.toFixed(2)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeStock(stock.symbol)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: colors.textMuted,
                              fontSize: '18px',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            ×
                          </button>
                        </div>

                        {/* Allocation Controls */}
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px'
                          }}>
                            <span style={{ fontSize: '12px', color: colors.textMuted }}>Allocation</span>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.primary }}>
                              {stock.allocation?.toFixed(2)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={STOCK_MIN_ALLOCATION}
                            max={STOCK_MAX_ALLOCATION}
                            step={0.01}
                            value={stock.allocation || 15}
                            onChange={(e) => updateAllocation(stock.symbol, parseFloat(e.target.value))}
                            style={{
                              width: '100%',
                              height: '6px',
                              borderRadius: '3px',
                              appearance: 'none',
                              background: `linear-gradient(to right, ${colors.primary} 0%, ${colors.primary} ${((stock.allocation - STOCK_MIN_ALLOCATION) / (STOCK_MAX_ALLOCATION - STOCK_MIN_ALLOCATION)) * 100}%, ${colors.border} ${((stock.allocation - STOCK_MIN_ALLOCATION) / (STOCK_MAX_ALLOCATION - STOCK_MIN_ALLOCATION)) * 100}%, ${colors.border} 100%)`,
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '10px',
                            color: colors.textMuted,
                            marginTop: '4px'
                          }}>
                            <span>7.5%</span>
                            <span>20%</span>
                          </div>
                        </div>

                        {/* Threshold Display */}
                        {threshold && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'wrap',
                            paddingTop: '8px',
                            borderTop: `1px solid ${colors.border}`
                          }}>
                            <ThresholdBadge type="breakout" value={threshold.threshold?.toFixed(1)} />
                            <ThresholdBadge type="rally" value={threshold.rallyThreshold?.toFixed(1)} />
                            <ThresholdBadge type="moonshot" value={threshold.moonshotThreshold?.toFixed(1)} />
                            {difficulty && (
                              <span style={{
                                marginLeft: 'auto',
                                padding: '4px 8px',
                                borderRadius: '8px',
                                backgroundColor: `${difficulty.color}20`,
                                color: difficulty.color,
                                fontWeight: '600',
                                fontSize: '11px'
                              }}>
                                {difficulty.label}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Crypto Item */}
                  {selectedCrypto && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: 'rgba(245,158,11,0.1)',
                      border: `1px solid rgba(245,158,11,0.3)`,
                      borderRadius: '10px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontWeight: '600', color: colors.yellow }}>{selectedCrypto.symbol}</span>
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: colors.textMuted }}>
                            ${cryptoPrices[selectedCrypto.symbol]?.price?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>10% (fixed)</span>
                      </div>
                      {thresholds[selectedCrypto.symbol] && (
                        <div style={{
                          marginTop: '8px',
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap'
                        }}>
                          <ThresholdBadge type="breakout" value={thresholds[selectedCrypto.symbol].threshold?.toFixed(1)} />
                          <ThresholdBadge type="rally" value={thresholds[selectedCrypto.symbol].rallyThreshold?.toFixed(1)} />
                          <ThresholdBadge type="moonshot" value={thresholds[selectedCrypto.symbol].moonshotThreshold?.toFixed(1)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bench Section */}
                <div style={{
                  padding: '12px',
                  backgroundColor: colors.cardBg,
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <span style={{ fontWeight: '600', color: colors.textPrimary }}>BENCH</span>
                    <span style={{ fontSize: '12px', color: benchComplete ? colors.green : colors.yellow }}>
                      {bench.length}/4 stocks • {benchCrypto ? '1/1' : '0/1'} crypto
                      {benchComplete && ' ✓'}
                    </span>
                  </div>

                  <p style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    marginBottom: '12px',
                    lineHeight: 1.4
                  }}>
                    ℹ️ Bench assets can substitute in during battle windows (11:30am & 2:00pm ET)
                  </p>

                  {/* Bench Stocks */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {bench.map(stock => (
                      <div
                        key={stock.symbol}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: colors.textSecondary
                        }}
                      >
                        {stock.symbol}
                        <button
                          onClick={() => removeFromBench(stock.symbol, 'stock')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: colors.textMuted,
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '14px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {bench.length < 4 && (
                      <button
                        onClick={() => { setBenchModalType('stock'); setShowBenchModal(true); }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: `1px dashed ${colors.border}`,
                          backgroundColor: 'transparent',
                          color: colors.primary,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        + Add Stock
                      </button>
                    )}
                  </div>

                  {/* Bench Crypto */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {benchCrypto ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        backgroundColor: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: colors.yellow
                      }}>
                        {benchCrypto.symbol}
                        <button
                          onClick={() => removeFromBench(benchCrypto.symbol, 'crypto')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: colors.textMuted,
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '14px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setBenchModalType('crypto'); setShowBenchModal(true); }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px dashed rgba(245,158,11,0.3)',
                          backgroundColor: 'transparent',
                          color: colors.yellow,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        + Add Crypto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <div style={{ padding: '16px 20px', borderTop: `1px solid ${colors.border}` }}>
                <button
                  onClick={handleCreateBattle}
                  disabled={!rosterComplete || !cryptoComplete || !benchComplete || !portfolioName.trim() || isCreating}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: (rosterComplete && cryptoComplete && benchComplete && portfolioName.trim())
                      ? colors.primary
                      : colors.border,
                    color: (rosterComplete && cryptoComplete && benchComplete && portfolioName.trim())
                      ? '#000'
                      : colors.textMuted,
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: (rosterComplete && cryptoComplete && benchComplete && portfolioName.trim() && !isCreating)
                      ? 'pointer'
                      : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create Battle →'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bench Add Modal */}
      <AnimatePresence>
        {showBenchModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setShowBenchModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '400px',
                maxHeight: '70vh',
                backgroundColor: '#12121a',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: colors.textPrimary }}>
                  Add Bench {benchModalType === 'stock' ? 'Stock' : 'Crypto'}
                </h3>
                <button
                  onClick={() => setShowBenchModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textMuted,
                    fontSize: '20px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: '8px'
                }}>
                  {benchModalType === 'stock'
                    ? STOCKS.filter(s => !excludedSymbols.includes(s.symbol)).map(stock => (
                        <button
                          key={stock.symbol}
                          onClick={() => addToBench(stock, 'stock')}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '10px 6px',
                            backgroundColor: colors.cardBg,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: '600', color: colors.primary }}>
                            {stock.symbol}
                          </span>
                          <span style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>
                            ${stockPrices[stock.symbol]?.price?.toFixed(2) || '0.00'}
                          </span>
                        </button>
                      ))
                    : availableCrypto.filter(c => !excludedSymbols.includes(c.symbol)).map(crypto => (
                        <button
                          key={crypto.symbol}
                          onClick={() => addToBench(crypto, 'crypto')}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '10px 6px',
                            backgroundColor: colors.cardBg,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: '600', color: colors.yellow }}>
                            {crypto.symbol}
                          </span>
                          <span style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px' }}>
                            ${cryptoPrices[crypto.symbol]?.price?.toFixed(2) || '0.00'}
                          </span>
                        </button>
                      ))
                  }
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Detail Modal */}
      {selectedStockForDetail && (
        <StockDetailModal
          stock={selectedStockForDetail}
          price={stockPrices[selectedStockForDetail.symbol]?.price || cryptoPrices[selectedStockForDetail.symbol]?.price}
          priceChange={stockPrices[selectedStockForDetail.symbol]?.percentChange || cryptoPrices[selectedStockForDetail.symbol]?.percentChange}
          threshold={thresholds[selectedStockForDetail.symbol]}
          isSelected={portfolio.some(p => p.symbol === selectedStockForDetail.symbol) || selectedCrypto?.symbol === selectedStockForDetail.symbol}
          onSelect={(asset) => {
            // Check if it's a crypto
            if (CRYPTO.some(c => c.symbol === asset.symbol)) {
              if (selectedCrypto?.symbol === asset.symbol) {
                setSelectedCrypto(null);
              } else {
                setSelectedCrypto(asset);
              }
            } else {
              toggleStock(asset);
            }
          }}
          onClose={() => setSelectedStockForDetail(null)}
          isCrypto={CRYPTO.some(c => c.symbol === selectedStockForDetail.symbol)}
        />
      )}

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${colors.primary};
          cursor: pointer;
          border: 2px solid #fff;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${colors.primary};
          cursor: pointer;
          border: 2px solid #fff;
        }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
