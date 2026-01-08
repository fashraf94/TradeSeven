// /src/screens/BuilderScreen.jsx

import React, { useState, useMemo } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

/**
 * BuilderScreen - Build portfolio for Classic battles
 * Extracted from App.jsx Phase 6
 *
 * Note: This is a complex screen with many features. The full implementation
 * remains in App.jsx for now - this is a simplified extraction template.
 */
const BuilderScreen = ({
  onBack,
  onBattleCreated,
  onShowPortfolioManager,
  stocksData = [],
  cryptoData = [],
  colors,
  containerStyle,
  isDesktop,
  DesktopBackground,
  // Builder state (passed from App.jsx)
  portfolio = [],
  setPortfolio,
  portfolioType,
  setPortfolioType,
  portfolioName,
  setPortfolioName,
  selectedCrypto,
  setSelectedCrypto,
  builderMode = 'create',
  builderCategory = 'Leadership',
  setBuilderCategory,
  searchTerm = '',
  setSearchTerm,
  joinCode = '',
  loadingMarketData = false,
  showPortfolioManager,
  setShowPortfolioManager
}) => {
  const { user } = useUser();

  // Stock category definitions
  const LEADERSHIP_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK.B', 'JPM', 'V', 'MA', 'UNH', 'JNJ', 'WMT', 'PG', 'HD', 'XOM'];
  const STABLE_STOCKS = ['KO', 'PEP', 'MCD', 'COST', 'VZ', 'T', 'PFE', 'MRK', 'ABBV', 'LLY', 'NEE', 'DUK', 'SO', 'D', 'CVX', 'COP'];
  const SHORT_VOLATILE_STOCKS = ['TSLA', 'RIVN', 'LCID', 'SNAP', 'HOOD', 'COIN', 'GME', 'AMC', 'PLTR', 'SMCI'];
  const SHORT_INDEX_ETFS = ['SPY', 'QQQ', 'DIA', 'IWM'];
  const SHORT_CRYPTO = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE'];
  const SHORT_STOCKS = [...SHORT_VOLATILE_STOCKS, ...SHORT_INDEX_ETFS];
  const ALL_SHORT_SYMBOLS = [...SHORT_STOCKS, ...SHORT_CRYPTO];

  // Get Momentum stocks dynamically
  const getMomentumStocks = () => {
    const excludeSymbols = [...LEADERSHIP_STOCKS, ...STABLE_STOCKS, ...SHORT_STOCKS];
    const remainingStocks = stocksData.filter(s => !excludeSymbols.includes(s.symbol));
    return remainingStocks
      .sort((a, b) => (b.priceChange30d || 0) - (a.priceChange30d || 0))
      .slice(0, 16)
      .map(s => s.symbol);
  };

  const MOMENTUM_STOCKS = useMemo(() => getMomentumStocks(), [stocksData]);

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

  // Calculate counts
  const longPositions = portfolio.filter(p => !ALL_SHORT_SYMBOLS.includes(p.symbol) && p.position !== 'short');
  const shortPositions = portfolio.filter(p => ALL_SHORT_SYMBOLS.includes(p.symbol) || p.position === 'short');
  const longCount = longPositions.length;
  const shortCount = shortPositions.length;
  const hasCrypto = selectedCrypto !== null;
  const totalSelected = longCount + shortCount + (hasCrypto ? 1 : 0);

  // Validation
  const isPortfolioValid = longCount >= 6 && longCount <= 12 && shortCount <= 2 && hasCrypto && totalSelected >= 7 && totalSelected <= 13;

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
    if (!setPortfolio) return;

    const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
    const isShortCategory = builderCategory === 'Short';

    if (inPortfolio) {
      setPortfolio(prev => prev.filter(p => p.symbol !== asset.symbol));
    } else {
      if (isShortCategory && shortCount >= 2) return;
      if (!isShortCategory && longCount >= 12) return;

      setPortfolio(prev => [...prev, {
        ...asset,
        percentage: 14.29,
        position: isShortCategory ? 'short' : 'long'
      }]);

      if (!portfolioType && setPortfolioType) setPortfolioType('stocks');
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
      {isDesktop && DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

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
            onClick={onBack}
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
                🤖 vs CPU
              </span>
            )}
          </div>

          <button
            onClick={() => setShowPortfolioManager?.(true)}
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
                  onClick={() => setBuilderCategory?.(cat.id)}
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

          {/* SEARCH BAR */}
          {builderCategory !== 'Short' && (
            <div style={{ position: 'relative', padding: '0 12px', marginBottom: '12px' }}>
              <span style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e', fontSize: '14px' }}>🔍</span>
              <input
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm?.(e.target.value)}
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

          {/* STOCK GRID */}
          {loadingMarketData ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
              <Loader2 style={{ height: '32px', width: '32px', color: '#00d9ff', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : builderCategory !== 'Short' ? (
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
                const change = asset.percentChange || 0;

                return (
                  <button
                    key={asset.symbol}
                    onClick={() => !isDisabled && toggleBuilderStock(asset)}
                    disabled={isDisabled}
                    style={{
                      background: isSelected ? 'rgba(0, 217, 255, 0.15)' : '#161b22',
                      border: isSelected ? '2px solid #00d9ff' : '1px solid #21262d',
                      borderRadius: '10px',
                      padding: '10px 6px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: isSelected ? '#00d9ff' : '#ffffff'
                    }}>
                      {asset.symbol}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: '#8b949e'
                    }}>
                      ${formatBuilderPrice(asset.price)}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: change >= 0 ? '#22c55e' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '0 12px' }}>
              <p style={{ color: '#8b949e', textAlign: 'center' }}>Short positions available - select volatile stocks to short</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuilderScreen;
