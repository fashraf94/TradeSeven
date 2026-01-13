import React from 'react';
import { Loader2 } from 'lucide-react';
import DesktopBackground from '../components/DesktopBackground';
import { AssetWeightCard } from '../components/shared';

// ============================================
// UTILITY FUNCTIONS
// ============================================
const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? fallback : num;
};

const safeToFixed = (val, decimals = 2, fallback = 0) => {
  return safeNumber(val, fallback).toFixed(decimals);
};

const sanitizePortfolioName = (name) => {
  if (!name) return '';
  return name
    .trim()
    .slice(0, 50)
    .replace(/[<>'"&]/g, '');
};

// ============================================
// SYSTEM PORTFOLIO TEMPLATES
// ============================================
const SYSTEM_PORTFOLIO_TEMPLATES = [
  {
    id: 'sys_tech_giants',
    name: 'Tech Giants',
    description: 'Top technology companies',
    type: 'stocks',
    assets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'],
    icon: '💻',
    isSystem: true
  },
  {
    id: 'sys_blue_chip',
    name: 'Blue Chip Mix',
    description: 'Stable, established companies',
    type: 'stocks',
    assets: ['JNJ', 'JPM', 'PG', 'KO', 'V'],
    icon: '🏛️',
    isSystem: true
  },
  {
    id: 'sys_growth',
    name: 'High Growth',
    description: 'High-growth momentum stocks',
    type: 'stocks',
    assets: ['NVDA', 'TSLA', 'AMD', 'CRM', 'SHOP'],
    icon: '🚀',
    isSystem: true
  },
  {
    id: 'sys_crypto_majors',
    name: 'Crypto Majors',
    description: 'Top cryptocurrency by market cap',
    type: 'crypto',
    assets: ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'],
    icon: '🪙',
    isSystem: true
  },
  {
    id: 'sys_defi',
    name: 'DeFi Leaders',
    description: 'Decentralized finance tokens',
    type: 'crypto',
    assets: ['UNI', 'AAVE', 'LINK', 'MKR', 'SNX'],
    icon: '🔗',
    isSystem: true
  },
  {
    id: 'sys_meme',
    name: 'Meme Coins',
    description: 'High-risk community tokens',
    type: 'crypto',
    assets: ['DOGE', 'SHIB', 'PEPE', 'BONK', 'FLOKI'],
    icon: '🐕',
    isSystem: true
  }
];

// ============================================
// BUILDER SCREEN COMPONENT
// ============================================
const BuilderScreen = ({
  // Layout
  isDesktop,
  containerStyle,
  // Market data
  stocksData,
  cryptoData,
  loadingMarketData,
  // Portfolio state
  portfolio,
  setPortfolio,
  portfolioType,
  setPortfolioType,
  portfolioName,
  setPortfolioName,
  selectedCrypto,
  setSelectedCrypto,
  cryptoPercentage,
  setCryptoPercentage,
  // Builder state
  builderCategory,
  setBuilderCategory,
  builderMode,
  setBuilderMode,
  joinCode,
  setJoinCode,
  searchTerm,
  setSearchTerm,
  assetType,
  setAssetType,
  // Modal state
  showPortfolioManager,
  setShowPortfolioManager,
  showTemplatesModal,
  setShowTemplatesModal,
  saveTemplateModal,
  setSaveTemplateModal,
  templateName,
  setTemplateName,
  // Templates
  portfolioTemplates,
  // Handlers
  handleRemoveAsset,
  handleCreateBattle,
  handleJoinBattle,
  handleCreateTrainingBattle,
  savePortfolioTemplate,
  loadTemplateToPortfolio,
  addNotification,
  // Navigation
  setScreen
}) => {
  // Stock category definitions
  const LEADERSHIP_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK.B', 'JPM', 'V', 'MA', 'UNH', 'JNJ', 'WMT', 'PG', 'HD', 'XOM'];
  const STABLE_STOCKS = ['KO', 'PEP', 'MCD', 'COST', 'VZ', 'T', 'PFE', 'MRK', 'ABBV', 'LLY', 'NEE', 'DUK', 'SO', 'D', 'CVX', 'COP'];

  // Short category - organized by type
  const SHORT_VOLATILE_STOCKS = ['TSLA', 'RIVN', 'LCID', 'SNAP', 'HOOD', 'COIN', 'GME', 'AMC', 'PLTR', 'SMCI'];
  const SHORT_INDEX_ETFS = ['SPY', 'QQQ', 'DIA', 'IWM'];
  const SHORT_CRYPTO = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE'];
  const SHORT_STOCKS = [...SHORT_VOLATILE_STOCKS, ...SHORT_INDEX_ETFS];

  // Allowed crypto for BUY section
  const ALLOWED_CRYPTO = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE'];

  // ETF placeholder data (in case not in stocksData)
  const ETF_DATA = {
    'SPY': { symbol: 'SPY', name: 'S&P 500 ETF', price: 450, percentChange: 0.5 },
    'QQQ': { symbol: 'QQQ', name: 'Nasdaq 100 ETF', price: 380, percentChange: 0.7 },
    'DIA': { symbol: 'DIA', name: 'Dow Jones ETF', price: 350, percentChange: 0.3 },
    'IWM': { symbol: 'IWM', name: 'Russell 2000 ETF', price: 200, percentChange: 0.4 }
  };

  // Volatile stock placeholder data (in case not in stocksData)
  const VOLATILE_STOCK_DATA = {
    'TSLA': { symbol: 'TSLA', name: 'Tesla', price: 250, percentChange: -1.2 },
    'RIVN': { symbol: 'RIVN', name: 'Rivian', price: 15, percentChange: -2.1 },
    'LCID': { symbol: 'LCID', name: 'Lucid Motors', price: 4, percentChange: -1.8 },
    'SNAP': { symbol: 'SNAP', name: 'Snap', price: 12, percentChange: -0.9 },
    'HOOD': { symbol: 'HOOD', name: 'Robinhood', price: 18, percentChange: 1.5 },
    'COIN': { symbol: 'COIN', name: 'Coinbase', price: 180, percentChange: 2.3 },
    'GME': { symbol: 'GME', name: 'GameStop', price: 25, percentChange: -3.2 },
    'AMC': { symbol: 'AMC', name: 'AMC Entertainment', price: 5, percentChange: -1.5 },
    'PLTR': { symbol: 'PLTR', name: 'Palantir', price: 45, percentChange: 1.8 },
    'SMCI': { symbol: 'SMCI', name: 'Super Micro', price: 35, percentChange: -4.2 }
  };

  // Get Momentum stocks dynamically (best 30-day performers from remaining stocks)
  const getMomentumStocks = () => {
    const excludeSymbols = [...LEADERSHIP_STOCKS, ...STABLE_STOCKS, ...SHORT_STOCKS];
    const remainingStocks = stocksData.filter(s => !excludeSymbols.includes(s.symbol));
    return remainingStocks
      .sort((a, b) => (b.priceChange30d || 0) - (a.priceChange30d || 0))
      .slice(0, 16)
      .map(s => s.symbol);
  };

  const MOMENTUM_STOCKS = getMomentumStocks();

  // Get stocks for a category
  const getCategoryStocks = (category) => {
    let symbols = [];
    switch (category) {
      case 'Leadership': symbols = LEADERSHIP_STOCKS; break;
      case 'Momentum': symbols = MOMENTUM_STOCKS; break;
      case 'Stable': symbols = STABLE_STOCKS; break;
      case 'Short': symbols = SHORT_VOLATILE_STOCKS; break;
      default: symbols = [];
    }
    return stocksData.filter(s => symbols.includes(s.symbol));
  };

  // Get short assets by sub-category with fallback data
  const getShortVolatileStocks = () => {
    return SHORT_VOLATILE_STOCKS.map(symbol => {
      const stockData = stocksData.find(s => s.symbol === symbol);
      return stockData || VOLATILE_STOCK_DATA[symbol] || { symbol, name: symbol, price: 0, percentChange: 0 };
    });
  };

  const getShortETFs = () => {
    return SHORT_INDEX_ETFS.map(symbol => {
      const stockData = stocksData.find(s => s.symbol === symbol);
      return stockData || ETF_DATA[symbol] || { symbol, name: symbol, price: 0, percentChange: 0 };
    });
  };

  const getShortCrypto = () => {
    return SHORT_CRYPTO.map(symbol => {
      const crypto = cryptoData.find(c => c.symbol === symbol);
      return crypto || { symbol, name: symbol, price: 0, percentChange: 0 };
    }).filter(c => c.price > 0);
  };

  // Calculate counts - separate longs from shorts (includes crypto shorts)
  const ALL_SHORT_SYMBOLS = [...SHORT_STOCKS, ...SHORT_CRYPTO];
  const longPositions = portfolio.filter(p => !ALL_SHORT_SYMBOLS.includes(p.symbol) && p.position !== 'short');
  const shortPositions = portfolio.filter(p => ALL_SHORT_SYMBOLS.includes(p.symbol) || p.position === 'short');
  const longCount = longPositions.length;
  const shortCount = shortPositions.length;
  const hasCrypto = selectedCrypto !== null;
  const totalSelected = longCount + shortCount + (hasCrypto ? 1 : 0);

  // Calculate total percentage
  const stockPercentage = portfolio.reduce((sum, p) => sum + (p.percentage || 0), 0);
  const totalPercentage = stockPercentage + (selectedCrypto ? cryptoPercentage : 0);

  // Get filtered crypto
  const allowedCryptoData = cryptoData.filter(c => ALLOWED_CRYPTO.includes(c.symbol));

  // Filter stocks by category and search
  const categoryStocks = getCategoryStocks(builderCategory);
  const filteredCategoryStocks = categoryStocks.filter(asset =>
    searchTerm === '' ||
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Responsive columns
  const getGridColumns = () => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w < 400) return 3;
    if (w < 640) return 4;
    if (w < 1024) return 6;
    return 8;
  };

  // Toggle stock in portfolio
  const toggleBuilderStock = (asset) => {
    const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
    const isShortCategory = builderCategory === 'Short';

    if (inPortfolio) {
      setPortfolio(prev => prev.filter(p => p.symbol !== asset.symbol));
    } else {
      // Validate limits
      if (isShortCategory && shortCount >= 2) return;
      if (!isShortCategory && longCount >= 12) return;

      setPortfolio(prev => [...prev, {
        ...asset,
        percentage: 14.29,
        position: isShortCategory ? 'short' : 'long'
      }]);

      if (!portfolioType) setPortfolioType('stocks');
    }
  };

  // Handle crypto selection - simple BUY only
  const handleCryptoSelect = (symbol) => {
    if (selectedCrypto === symbol) {
      setSelectedCrypto(null);
    } else {
      setSelectedCrypto(symbol);
    }
  };

  // Format price helper
  const formatBuilderPrice = (price) => {
    if (!price) return '0.00';
    if (price >= 1000) return `${(price / 1000).toFixed(1)}K`;
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  return (
    <div style={containerStyle}>
      <DesktopBackground isDesktop={isDesktop} />

      <div style={{ minHeight: '100vh', background: '#0d1117', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#0d1117',
          borderBottom: '1px solid #21262d',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <button
            onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setSelectedCrypto(null); setBuilderMode('create'); setJoinCode(''); setScreen('dashboard'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>

          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <h1 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              {builderMode === 'training' ? 'Training Mode' : builderMode === 'join' ? 'Join Battle' : 'Build Portfolio'}
            </h1>
            {/* Mode-specific badge */}
            {builderMode === 'join' && joinCode && (
              <span style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Joining: {joinCode}
              </span>
            )}
            {builderMode === 'training' && (
              <span style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                vs CPU
              </span>
            )}
          </div>

          <button
            onClick={() => setShowPortfolioManager(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
              position: 'relative'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Cart
            {totalSelected > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '700',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {totalSelected}
              </span>
            )}
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflow: 'auto', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
          {/* PORTFOLIO STATUS CARD */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '12px',
            padding: '16px',
            margin: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>📊</span>
                <span style={{ color: '#ffffff', fontSize: '16px', fontWeight: '700' }}>Your Portfolio</span>
              </div>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>6-12 Longs • 0-2 Shorts (optional) • 1 Crypto</span>
            </div>

            <div style={{ width: '100%', height: '8px', background: '#21262d', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{
                height: '100%',
                width: `${Math.min((totalSelected / 7) * 100, 100)}%`,
                background: totalSelected >= 7 ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)',
                borderRadius: '4px',
                transition: 'all 0.3s ease'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>
                Longs: <span style={{ color: longCount >= 6 ? '#22c55e' : '#00d9ff', fontWeight: '600' }}>{longCount}/6 min</span>
                {' • '}
                Shorts: <span style={{ color: shortCount > 0 ? '#ef4444' : '#8b949e', fontWeight: '600' }}>{shortCount}/2</span>
                {' • '}
                Crypto: <span style={{ color: hasCrypto ? '#22c55e' : '#f59e0b', fontWeight: '600' }}>{hasCrypto ? '1/1' : '0/1'}</span>
              </span>
              <span style={{ color: totalSelected >= 7 ? '#22c55e' : '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                {totalSelected >= 7 ? `${totalSelected} selected ✓` : `${totalSelected}/7 minimum`}
              </span>
            </div>
          </div>

          {/* CATEGORY TABS */}
          <div style={{ display: 'flex', gap: '6px', padding: '0 12px', marginBottom: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {[
              { id: 'Leadership', label: 'Leadership', color: '#00d9ff' },
              { id: 'Momentum', label: 'Momentum', color: '#8b5cf6' },
              { id: 'Stable', label: 'Stable', color: '#22c55e' },
              { id: 'Short', label: 'Short', color: '#ef4444' }
            ].map((cat) => {
              const isActive = builderCategory === cat.id;
              const count = getCategoryStocks(cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setBuilderCategory(cat.id)}
                  style={{
                    flex: '1 0 auto',
                    minWidth: '80px',
                    padding: '10px 14px',
                    background: isActive ? cat.color : '#161b22',
                    border: isActive ? 'none' : '1px solid #21262d',
                    borderRadius: '8px',
                    color: isActive ? (cat.id === 'Short' ? '#ffffff' : '#0d1117') : '#8b949e',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* SEARCH BAR - Only for non-Short categories */}
          {builderCategory !== 'Short' && (
            <div style={{ position: 'relative', padding: '0 12px', marginBottom: '12px' }}>
              <span style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e', fontSize: '14px' }}>🔍</span>
              <input
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  background: '#0d1117',
                  border: '1px solid #21262d',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* STOCK GRID - For non-Short categories */}
          {loadingMarketData ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
              <Loader2 style={{ height: '32px', width: '32px', color: '#00d9ff', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : builderCategory !== 'Short' ? (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)`,
                gap: '8px',
                padding: '0 12px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {filteredCategoryStocks.map((asset) => {
                  const isSelected = portfolio.some(p => p.symbol === asset.symbol);
                  const isDisabled = !isSelected && longCount >= 12;
                  const changePercent = asset.percentChange || asset.change24h || 0;

                  return (
                    <button
                      key={asset.symbol}
                      onClick={() => !isDisabled && toggleBuilderStock(asset)}
                      disabled={isDisabled}
                      style={{
                        background: isSelected ? 'rgba(0, 217, 255, 0.12)' : '#161b22',
                        border: isSelected ? '2px solid #00d9ff' : '1px solid #21262d',
                        borderRadius: '10px',
                        padding: '10px 6px',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.4 : 1,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        minHeight: '90px'
                      }}
                    >
                      <div style={{ color: isSelected ? '#00d9ff' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                        {asset.symbol}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                        {asset.name}
                      </div>
                      <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                        ${formatBuilderPrice(asset.price)}
                      </div>
                      <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                        {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* SHORT CATEGORY - Organized Sub-sections */
            <>
              {/* Main Short Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, height: '1px', background: '#ef4444', opacity: 0.3 }} />
                <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="#ef4444"><path d="M6 11L1 4H11L6 11Z" /></svg>
                  Short Positions (Max 2)
                </span>
                <div style={{ flex: 1, height: '1px', background: '#ef4444', opacity: 0.3 }} />
              </div>

              {/* Volatile Stocks Sub-section */}
              <div style={{ marginBottom: '28px', padding: '0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingLeft: '4px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1.5px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                      <polyline points="17 18 23 18 23 12" />
                    </svg>
                  </div>
                  <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>
                    Volatile Stocks
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(239, 68, 68, 0.4), transparent)', marginLeft: '8px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 120px))',
                    gap: '10px',
                    justifyContent: 'center',
                    width: '100%',
                    maxWidth: '700px'
                  }}>
                  {getShortVolatileStocks().map((asset) => {
                    const isSelected = portfolio.some(p => p.symbol === asset.symbol);
                    const isDisabled = !isSelected && shortCount >= 2;
                    const changePercent = asset.percentChange || asset.change24h || 0;
                    return (
                      <button
                        key={asset.symbol}
                        onClick={() => !isDisabled && toggleBuilderStock(asset)}
                        disabled={isDisabled}
                        style={{
                          background: isSelected ? 'rgba(239, 68, 68, 0.12)' : '#161b22',
                          border: isSelected ? '2px solid #ef4444' : '1px solid #21262d',
                          borderRadius: '10px',
                          padding: '10px 6px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.4 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          minHeight: '90px'
                        }}
                      >
                        {isSelected && (
                          <div style={{ color: '#ef4444', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="#ef4444"><path d="M6 11L1 4H11L6 11Z" /></svg>
                            SHORT
                          </div>
                        )}
                        <div style={{ color: isSelected ? '#ef4444' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                          {asset.symbol}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                          {asset.name}
                        </div>
                        <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                          ${formatBuilderPrice(asset.price)}
                        </div>
                        <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                          {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                        </div>
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>

              {/* Index ETFs Sub-section */}
              <div style={{ marginBottom: '28px', padding: '0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingLeft: '4px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1.5px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </div>
                  <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>
                    Index ETFs (Hedge)
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(245, 158, 11, 0.4), transparent)', marginLeft: '8px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 120px))',
                    gap: '10px',
                    justifyContent: 'center',
                    width: '100%',
                    maxWidth: '550px'
                  }}>
                  {getShortETFs().map((asset) => {
                    const isSelected = portfolio.some(p => p.symbol === asset.symbol);
                    const isDisabled = !isSelected && shortCount >= 2;
                    const changePercent = asset.percentChange || asset.change24h || 0;
                    return (
                      <button
                        key={asset.symbol}
                        onClick={() => !isDisabled && toggleBuilderStock(asset)}
                        disabled={isDisabled}
                        style={{
                          background: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#161b22',
                          border: isSelected ? '2px solid #f59e0b' : '1px solid #21262d',
                          borderRadius: '10px',
                          padding: '10px 6px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.4 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          minHeight: '90px'
                        }}
                      >
                        {isSelected && (
                          <div style={{ color: '#f59e0b', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="#f59e0b"><path d="M6 11L1 4H11L6 11Z" /></svg>
                            SHORT
                          </div>
                        )}
                        <div style={{ color: isSelected ? '#f59e0b' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                          {asset.symbol}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                          {asset.name}
                        </div>
                        <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                          ${formatBuilderPrice(asset.price)}
                        </div>
                        <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                          {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                        </div>
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>

              {/* Crypto Shorts Sub-section */}
              <div style={{ marginBottom: '20px', padding: '0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingLeft: '4px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1.5px solid rgba(139, 92, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727" />
                    </svg>
                  </div>
                  <span style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>
                    Crypto Shorts
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(139, 92, 246, 0.4), transparent)', marginLeft: '8px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 120px))',
                    gap: '10px',
                    justifyContent: 'center',
                    width: '100%',
                    maxWidth: '800px'
                  }}>
                  {getShortCrypto().map((crypto) => {
                    const isSelected = portfolio.some(p => p.symbol === crypto.symbol && p.position === 'short');
                    const isDisabled = !isSelected && shortCount >= 2;
                    const changePercent = crypto.percentChange || crypto.change24h || 0;
                    return (
                      <button
                        key={crypto.symbol}
                        onClick={() => {
                          if (isDisabled) return;
                          const inPortfolio = portfolio.some(p => p.symbol === crypto.symbol && p.position === 'short');
                          if (inPortfolio) {
                            setPortfolio(prev => prev.filter(p => !(p.symbol === crypto.symbol && p.position === 'short')));
                          } else {
                            setPortfolio(prev => [...prev, { ...crypto, percentage: 14.29, position: 'short' }]);
                          }
                        }}
                        disabled={isDisabled}
                        style={{
                          background: isSelected ? 'rgba(139, 92, 246, 0.12)' : '#161b22',
                          border: isSelected ? '2px solid #8b5cf6' : '1px solid #21262d',
                          borderRadius: '10px',
                          padding: '10px 6px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.4 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          minHeight: '90px'
                        }}
                      >
                        {isSelected && (
                          <div style={{ color: '#8b5cf6', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="#8b5cf6"><path d="M6 11L1 4H11L6 11Z" /></svg>
                            SHORT
                          </div>
                        )}
                        <div style={{ color: isSelected ? '#8b5cf6' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                          {crypto.symbol}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                          {crypto.name}
                        </div>
                        <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                          ${formatBuilderPrice(crypto.price)}
                        </div>
                        <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                          {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                        </div>
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>
            </>
          )}

              {/* CRYPTO SECTION - Simple BUY only tiles - Centered */}
              <div style={{ padding: '12px', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ flex: 1, maxWidth: '100px', height: '1px', background: '#f59e0b', opacity: 0.3 }} />
                  <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    ₿ Crypto (Pick 1)
                  </span>
                  <div style={{ flex: 1, maxWidth: '100px', height: '1px', background: '#f59e0b', opacity: 0.3 }} />
                </div>

                {/* Centered crypto grid */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 500
                      ? 'repeat(3, minmax(80px, 110px))'
                      : 'repeat(6, minmax(80px, 110px))',
                    gap: '8px',
                    maxWidth: '720px'
                  }}>
                    {allowedCryptoData.map((crypto) => {
                      const isSelected = selectedCrypto === crypto.symbol;
                      const changePercent = crypto.percentChange || crypto.change24h || 0;

                      return (
                        <button
                          key={crypto.symbol}
                          onClick={() => handleCryptoSelect(crypto.symbol)}
                          style={{
                            background: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#161b22',
                            border: isSelected ? '2px solid #f59e0b' : '1px solid #21262d',
                            borderRadius: '10px',
                            padding: '10px 6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            minHeight: '90px'
                          }}
                        >
                          {isSelected && (
                            <div style={{ color: '#f59e0b', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="#f59e0b"><path d="M6 1L11 8H1L6 1Z" /></svg>
                              BUY
                            </div>
                          )}
                          <div style={{ color: isSelected ? '#f59e0b' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                            {crypto.symbol}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                            {crypto.name}
                          </div>
                          <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                            ${formatBuilderPrice(crypto.price)}
                          </div>
                          <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                            {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* TEMPLATE BUTTONS */}
              <div style={{ display: 'flex', gap: '8px', margin: '16px 12px', paddingTop: '16px', borderTop: '1px solid #21262d' }}>
                <button
                  onClick={() => setShowTemplatesModal(true)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#21262d',
                    color: '#d1d5db',
                    border: '1px solid #30363d',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  📂 Load Template
                </button>
                {portfolio.length >= 5 && (
                  <button
                    onClick={() => setSaveTemplateModal(true)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      backgroundColor: '#22c55e20',
                      color: '#22c55e',
                      border: '1px solid #22c55e40',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    💾 Save Template
                  </button>
                )}
              </div>

        </div>
      </div>

      {/* PORTFOLIO MANAGER MODAL - REDESIGNED */}
      {showPortfolioManager && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0d1117',
          zIndex: 60,
          overflowY: 'auto'
        }}>

          {/* MODAL HEADER */}
          <div style={{
            backgroundColor: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setShowPortfolioManager(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#00d9ff',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>

              <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff' }}>
                Your Portfolio
              </h1>

              <div style={{ width: '60px' }}></div>
            </div>
          </div>

          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '16px',
            paddingBottom: '120px'
          }}>

            {/* PORTFOLIO NAME - AT TOP */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#8b949e',
                marginBottom: '8px'
              }}>
                Portfolio Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={portfolioName}
                onChange={(e) => setPortfolioName(sanitizePortfolioName(e.target.value))}
                placeholder="Enter portfolio name"
                maxLength={50}
                style={{
                  width: '100%',
                  backgroundColor: '#161b22',
                  border: portfolioName ? '1px solid #30363d' : '2px solid #ef4444',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#ffffff',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {!portfolioName && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>
                  Portfolio name is required
                </p>
              )}
            </div>

            {/* SUMMARY CARD */}
            <div style={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#8b949e', fontSize: '14px' }}>
                  {portfolio.length}/13 assets
                </span>
                <span style={{
                  color: Math.abs(totalPercentage - 100) < 0.01 ? '#22c55e' : totalPercentage > 100 ? '#ef4444' : '#fbbf24',
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}>
                  {totalPercentage.toFixed(1)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#21262d',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, totalPercentage)}%`,
                  backgroundColor: Math.abs(totalPercentage - 100) < 0.01 ? '#22c55e' : totalPercentage > 100 ? '#ef4444' : '#00d9ff',
                  transition: 'all 0.3s ease'
                }} />
              </div>
            </div>

            {/* DISTRIBUTE EVENLY BUTTON */}
            {(portfolio.length > 0 || selectedCrypto) && (
              <button
                onClick={() => {
                  // Count total assets INCLUDING crypto
                  const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
                  if (totalAssets === 0) return;

                  // Use integer basis points (10000 = 100%) to avoid floating point issues
                  const TOTAL_BASIS_POINTS = 10000;
                  const basePointsPerAsset = Math.floor(TOTAL_BASIS_POINTS / totalAssets);
                  const remainderPoints = TOTAL_BASIS_POINTS - (basePointsPerAsset * totalAssets);

                  // Update all stock assets with even distribution
                  setPortfolio(prev => prev.map((asset, index) => {
                    // First 'remainderPoints' assets each get +1 basis point (0.01%)
                    const bonusPoint = index < remainderPoints ? 1 : 0;
                    const totalPoints = basePointsPerAsset + bonusPoint;
                    const percentage = totalPoints / 100; // Convert basis points to percentage

                    return {
                      ...asset,
                      percentage: percentage,
                      amount: (percentage / 100) * 1000000
                    };
                  }));

                  // Update crypto percentage if selected
                  if (selectedCrypto) {
                    // Crypto gets its share - account for portfolio assets that got bonus points
                    const cryptoIndex = portfolio.length; // Crypto comes after portfolio assets
                    const cryptoBonusPoint = cryptoIndex < remainderPoints ? 1 : 0;
                    const cryptoPoints = basePointsPerAsset + cryptoBonusPoint;
                    setCryptoPercentage(cryptoPoints / 100);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0d1117',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(0, 217, 255, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                ⚖️ Distribute Evenly
              </button>
            )}

            {/* ASSETS LIST */}
            {portfolio.length === 0 ? (
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '12px',
                padding: '48px 16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>📂</div>
                <p style={{ color: '#8b949e', fontSize: '16px', marginBottom: '8px' }}>
                  No assets selected
                </p>
                <p style={{ color: '#6e7681', fontSize: '14px' }}>
                  Go back and add assets to your portfolio
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {portfolio.map((asset, index) => (
                  <AssetWeightCard
                    key={`${asset.symbol}-${index}`}
                    asset={{
                      ...asset,
                      allocation: asset.percentage || ((asset.amount / 1000000) * 100)
                    }}
                    onWeightChange={(newWeight) => {
                      const newAmount = (newWeight / 100) * 1000000;
                      setPortfolio(prev => prev.map(a =>
                        a.symbol === asset.symbol
                          ? { ...a, amount: newAmount, percentage: newWeight }
                          : a
                      ));
                    }}
                    onRemove={() => handleRemoveAsset(asset.symbol)}
                  />
                ))}
              </div>
            )}

            {/* CRYPTO SECTION - Show selected crypto with adjustable allocation */}
            {selectedCrypto && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{
                  color: '#f59e0b',
                  fontSize: '13px',
                  fontWeight: '700',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '14px' }}>₿</span>
                  CRYPTO (1)
                </h3>
                <div style={{
                  backgroundColor: '#161b22',
                  border: '2px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '14px'
                }}>
                  {/* Header Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <div style={{
                        color: '#ffffff',
                        fontSize: '16px',
                        fontWeight: '700'
                      }}>
                        {selectedCrypto}
                      </div>
                      <div style={{
                        color: '#f59e0b',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {cryptoData.find(c => c.symbol === selectedCrypto)?.name || selectedCrypto}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => {
                        setSelectedCrypto(null);
                        setCryptoPercentage(10);
                      }}
                      style={{
                        width: '28px',
                        height: '28px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Allocation Dropdown */}
                  <div style={{
                    background: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '10px'
                  }}>
                    <select
                      value={cryptoPercentage}
                      onChange={(e) => setCryptoPercentage(Number(e.target.value))}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {[7.5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(val => (
                        <option key={val} value={val} style={{ background: '#0d1117' }}>{val}%</option>
                      ))}
                    </select>
                  </div>

                  {/* Fine Tune Slider */}
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px'
                    }}>
                      <span style={{ color: '#8b949e', fontSize: '12px' }}>Fine tune</span>
                      <span style={{ color: '#f59e0b', fontSize: '14px', fontWeight: '600' }}>
                        {cryptoPercentage}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="7.5"
                      max="20"
                      step="0.5"
                      value={cryptoPercentage}
                      onChange={(e) => setCryptoPercentage(Number(e.target.value))}
                      style={{
                        width: '100%',
                        accentColor: '#f59e0b'
                      }}
                    />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '4px'
                    }}>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>7.5%</span>
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>20%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VALIDATION MESSAGES */}
            {(portfolio.length > 0 || selectedCrypto) && (
              <div style={{ marginTop: '16px' }}>
                {portfolio.length < 6 && portfolio.length > 0 && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '4px' }}>
                    • Need at least 6 stocks (have {portfolio.length})
                  </p>
                )}
                {!selectedCrypto && (
                  <p style={{ color: '#f59e0b', fontSize: '13px', marginBottom: '4px' }}>
                    • You must select 1 crypto to continue
                  </p>
                )}
                {Math.abs(totalPercentage - 100) >= 0.01 && (portfolio.length > 0 || selectedCrypto) && (
                  <p style={{ color: '#ef4444', fontSize: '13px' }}>
                    • Total must equal 100% (currently {totalPercentage.toFixed(1)}%)
                  </p>
                )}
                {(cryptoPercentage < 7.5 || cryptoPercentage > 20) && selectedCrypto && (
                  <p style={{ color: '#ef4444', fontSize: '13px' }}>
                    • Crypto allocation must be 7.5-20%
                  </p>
                )}
              </div>
            )}

            {/* SUBMIT BUTTON - Handles different modes */}
            <button
              onClick={() => {
                // Call appropriate handler based on mode
                if (builderMode === 'training') {
                  handleCreateTrainingBattle();
                } else if (builderMode === 'join') {
                  handleJoinBattle();
                } else {
                  handleCreateBattle();
                }
                setShowPortfolioManager(false);
              }}
              disabled={(() => {
                const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
                return !portfolioName ||
                  !selectedCrypto ||
                  totalAssets < 7 ||
                  totalAssets > 13 ||
                  Math.abs(totalPercentage - 100) >= 0.01 ||
                  cryptoPercentage < 7.5 || cryptoPercentage > 20 ||
                  (builderMode === 'join' && (!joinCode || joinCode.length !== 6));
              })()}
              style={(() => {
                const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
                const canProceed = portfolioName && selectedCrypto && totalAssets >= 7 && totalAssets <= 13 && Math.abs(totalPercentage - 100) < 0.01 && cryptoPercentage >= 7.5 && cryptoPercentage <= 20;
                return {
                  width: '100%',
                  backgroundColor: canProceed
                    ? builderMode === 'training' ? '#a855f7' : builderMode === 'join' ? '#06b6d4' : '#8b5cf6'
                    : '#21262d',
                  color: canProceed ? '#ffffff' : '#6e7681',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                };
              })()}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {(() => {
                const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
                const assetsNeeded = 7 - totalAssets;
                const assetsOver = totalAssets - 13;

                if (!portfolioName) return 'Enter Portfolio Name';
                if (totalAssets === 0) return 'Add Assets';
                if (totalAssets < 7) return `Need ${assetsNeeded} More Asset${assetsNeeded !== 1 ? 's' : ''}`;
                if (totalAssets > 13) return `Remove ${assetsOver} Asset${assetsOver !== 1 ? 's' : ''}`;
                if (Math.abs(totalPercentage - 100) >= 0.01) return `Adjust to 100% (${totalPercentage.toFixed(1)}%)`;
                if (builderMode === 'training') return '🤖 Start Training Battle';
                if (builderMode === 'join') return '🎯 Join Battle';
                return '⚔️ Create Battle';
              })()}
            </button>
          </div>
        </div>
      )}

      {/* SAVE TEMPLATE MODAL */}
      {saveTemplateModal && (
        <>
          <div
            onClick={() => setSaveTemplateModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 200,
              backdropFilter: 'blur(4px)'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '400px',
            backgroundColor: '#161b22',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 210,
            padding: '24px'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', marginBottom: '16px' }}>
              Save Portfolio Template
            </h2>
            <input
              type="text"
              placeholder="Template name..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0d1117',
                border: '1px solid #21262d',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            />
            <div style={{
              backgroundColor: '#0d1117',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>Assets to save:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {portfolio.map(asset => (
                  <span key={asset.symbol} style={{
                    padding: '4px 8px',
                    backgroundColor: '#21262d',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#00d9ff'
                  }}>
                    {asset.symbol}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setSaveTemplateModal(false);
                  setTemplateName('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#21262d',
                  color: '#8b949e',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (templateName.trim() && portfolio.length > 0) {
                    const symbols = portfolio.map(a => a.symbol);
                    savePortfolioTemplate(templateName.trim(), symbols, portfolioType || assetType);
                    setSaveTemplateModal(false);
                    setTemplateName('');
                    // Show toast or notification
                    addNotification('system', 'Template Saved!', `Your "${templateName.trim()}" template has been saved.`);
                  }
                }}
                disabled={!templateName.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: templateName.trim() ? '#22c55e' : '#21262d',
                  color: templateName.trim() ? '#000000' : '#6e7681',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: templateName.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Save Template
              </button>
            </div>
          </div>
        </>
      )}

      {/* PORTFOLIO TEMPLATES MODAL (shared from dashboard) */}
      {showTemplatesModal && (
        <>
          <div
            onClick={() => setShowTemplatesModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 200,
              backdropFilter: 'blur(4px)'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            backgroundColor: '#161b22',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 210,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #21262d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff' }}>
                Portfolio Templates
              </h2>
              <button
                onClick={() => setShowTemplatesModal(false)}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  color: '#8b949e',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #21262d',
              display: 'flex',
              gap: '8px'
            }}>
              <button
                onClick={() => setAssetType('stocks')}
                disabled={portfolioType === 'crypto'}
                style={{
                  padding: '8px 16px',
                  backgroundColor: assetType === 'stocks' ? '#22c55e' : '#21262d',
                  color: assetType === 'stocks' ? '#000' : '#8b949e',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: portfolioType === 'crypto' ? 'not-allowed' : 'pointer',
                  opacity: portfolioType === 'crypto' ? 0.5 : 1
                }}
              >
                Stocks
              </button>
              <button
                onClick={() => setAssetType('crypto')}
                disabled={portfolioType === 'stocks'}
                style={{
                  padding: '8px 16px',
                  backgroundColor: assetType === 'crypto' ? '#f59e0b' : '#21262d',
                  color: assetType === 'crypto' ? '#000' : '#8b949e',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: portfolioType === 'stocks' ? 'not-allowed' : 'pointer',
                  opacity: portfolioType === 'stocks' ? 0.5 : 1
                }}
              >
                Crypto
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px', paddingLeft: '4px' }}>
                  SYSTEM TEMPLATES
                </div>
                {SYSTEM_PORTFOLIO_TEMPLATES
                  .filter(t => t.type === assetType)
                  .map(template => (
                    <div
                      key={template.id}
                      onClick={() => loadTemplateToPortfolio(template)}
                      style={{
                        padding: '12px 16px',
                        marginBottom: '8px',
                        borderRadius: '10px',
                        backgroundColor: '#0d1117',
                        border: '1px solid #21262d',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{template.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>{template.name}</div>
                          <div style={{ fontSize: '12px', color: '#8b949e' }}>{template.description}</div>
                          <div style={{ fontSize: '11px', color: '#6e7681', marginTop: '4px' }}>{template.assets.join(', ')}</div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px', paddingLeft: '4px' }}>
                  YOUR TEMPLATES
                </div>
                {portfolioTemplates.filter(t => t.type === assetType).length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '24px',
                    color: '#6e7681',
                    backgroundColor: '#0d1117',
                    borderRadius: '10px',
                    border: '1px dashed #21262d'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                    <p style={{ fontSize: '13px' }}>No saved templates yet</p>
                  </div>
                ) : (
                  portfolioTemplates
                    .filter(t => t.type === assetType)
                    .map(template => (
                      <div
                        key={template.id}
                        onClick={() => loadTemplateToPortfolio(template)}
                        style={{
                          padding: '12px 16px',
                          marginBottom: '8px',
                          borderRadius: '10px',
                          backgroundColor: '#0d1117',
                          border: '1px solid #21262d',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>{template.name}</div>
                        <div style={{ fontSize: '11px', color: '#6e7681', marginTop: '2px' }}>{template.assets.join(', ')}</div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BuilderScreen;
