// PortfolioBuilderTD - TD Scoring portfolio builder mirroring Classic builder design
// Clean grid selection with cart modal for allocations

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STOCKS, CRYPTO } from '../../data/assets';
import { getVolatilityThresholds } from '../../services/volatilityService';
import { getMultipleStockPrices, getMultipleCryptoPrices } from '../../services/eodhdAPI';

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

// Sector definitions
const SECTORS = [
  { id: 'Technology', name: 'Tech', icon: '💻' },
  { id: 'Finance', name: 'Finance', icon: '🏦' },
  { id: 'Healthcare', name: 'Health', icon: '🏥' },
  { id: 'Consumer Discretionary', name: 'Consumer', icon: '🛍️' },
  { id: 'Consumer Staples', name: 'Staples', icon: '🛒' },
  { id: 'Energy', name: 'Energy', icon: '⚡' },
  { id: 'Industrials', name: 'Industrial', icon: '🏭' },
  { id: 'Utilities', name: 'Utilities', icon: '💡' },
  { id: 'Real Estate', name: 'Real Estate', icon: '🏢' },
  { id: 'Telecom', name: 'Telecom', icon: '📡' }
];

// Allocation constraints
const STOCK_MIN_ALLOCATION = 7.5;
const STOCK_MAX_ALLOCATION = 20;
const CRYPTO_ALLOCATION = 10;
const STOCK_TOTAL_ALLOCATION = 90;

// Get difficulty from threshold
const getDifficulty = (threshold) => {
  if (!threshold) return null;
  if (threshold <= 2) return { label: 'Easy', color: colors.green };
  if (threshold <= 4) return { label: 'Medium', color: colors.yellow };
  return { label: 'Hard', color: colors.red };
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

  // Data state
  const [stockPrices, setStockPrices] = useState(initialStockPrices);
  const [cryptoPrices, setCryptoPrices] = useState(initialCryptoPrices);
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [isLoadingPrices, setIsLoadingPrices] = useState(Object.keys(initialStockPrices).length === 0);
  const [isCreating, setIsCreating] = useState(false);

  // Load prices on mount
  useEffect(() => {
    if (Object.keys(initialStockPrices).length > 0) return;

    const loadPrices = async () => {
      setIsLoadingPrices(true);
      try {
        const stockSymbols = STOCKS.map(s => s.symbol);
        const cryptoSymbols = CRYPTO.filter(c => c.category !== 'Stablecoin').map(c => c.symbol);

        const [stocks, crypto] = await Promise.all([
          getMultipleStockPrices(stockSymbols),
          getMultipleCryptoPrices(cryptoSymbols)
        ]);

        setStockPrices(stocks || {});
        setCryptoPrices(crypto || {});
      } catch (error) {
        console.error('Error loading prices:', error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    loadPrices();
  }, [initialStockPrices]);

  // Fetch thresholds when assets change
  useEffect(() => {
    const allSymbols = [
      ...portfolio.map(p => p.symbol),
      selectedCrypto?.symbol,
      ...bench.map(b => b.symbol),
      benchCrypto?.symbol
    ].filter(Boolean);

    if (allSymbols.length === 0) return;

    const missingSymbols = allSymbols.filter(s => !thresholds[s]);
    if (missingSymbols.length === 0) return;

    const fetchThresholds = async () => {
      try {
        const stockSymbols = missingSymbols.filter(s => STOCKS.some(stock => stock.symbol === s));
        const cryptoSymbols = missingSymbols.filter(s => CRYPTO.some(crypto => crypto.symbol === s));

        const [stockThresholds, cryptoThresholds] = await Promise.all([
          stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
          cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {}
        ]);

        setThresholds(prev => ({ ...prev, ...(stockThresholds || {}), ...(cryptoThresholds || {}) }));
      } catch (error) {
        console.error('Error fetching thresholds:', error);
      }
    };

    fetchThresholds();
  }, [portfolio, selectedCrypto, bench, benchCrypto, thresholds]);

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
  if (isLoadingPrices) {
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
          <div style={{ color: colors.textSecondary }}>Loading market data...</div>
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
        {SECTORS.map(sector => {
          const isActive = activeTab === sector.id;
          const count = getStockCountBySector(sector.id);
          return (
            <button
              key={sector.id}
              onClick={() => setActiveTab(sector.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '20px',
                border: `1px solid ${isActive ? colors.primary : colors.border}`,
                backgroundColor: isActive ? 'rgba(0,217,255,0.15)' : 'transparent',
                color: isActive ? colors.primary : colors.textSecondary,
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <span>{sector.icon}</span>
              <span>{sector.name}</span>
              <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Stock Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: '10px',
        padding: '0 16px 16px'
      }}>
        {filteredStocks.map(stock => {
          const price = stockPrices[stock.symbol]?.price || 0;
          const change = stockPrices[stock.symbol]?.percentChange || 0;
          const isSelected = portfolio.some(p => p.symbol === stock.symbol);
          const threshold = thresholds[stock.symbol];

          return (
            <button
              key={stock.symbol}
              onClick={() => toggleStock(stock)}
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
                transition: 'all 0.2s'
              }}
            >
              {/* Threshold Badge */}
              {threshold && (
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  fontSize: '9px',
                  padding: '2px 4px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: '4px',
                  color: 'rgba(255,255,255,0.7)',
                  opacity: isSelected ? 1 : 0,
                  transition: 'opacity 0.2s'
                }}>
                  🎯 {threshold.threshold?.toFixed(1)}%
                </div>
              )}

              <div style={{ fontSize: '15px', fontWeight: '700', color: colors.textPrimary }}>
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
            </button>
          );
        })}
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

            return (
              <button
                key={crypto.symbol}
                onClick={() => setSelectedCrypto(isSelected ? null : crypto)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 8px',
                  backgroundColor: isSelected ? 'rgba(245,158,11,0.15)' : colors.cardBg,
                  border: `2px solid ${isSelected ? colors.yellow : 'transparent'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: '700', color: colors.yellow }}>
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
                            gap: '8px',
                            paddingTop: '8px',
                            borderTop: `1px solid ${colors.border}`,
                            fontSize: '11px'
                          }}>
                            <span style={{ color: colors.textMuted }}>🎯 {threshold.threshold?.toFixed(1)}%</span>
                            <span style={{ color: colors.textMuted }}>🚀 {threshold.rallyThreshold?.toFixed(1)}%</span>
                            <span style={{ color: colors.textMuted }}>🌙 {threshold.moonshotThreshold?.toFixed(1)}%</span>
                            {difficulty && (
                              <span style={{
                                marginLeft: 'auto',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: `${difficulty.color}20`,
                                color: difficulty.color,
                                fontWeight: '500'
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
                          fontSize: '11px',
                          color: colors.textMuted
                        }}>
                          🎯 {thresholds[selectedCrypto.symbol].threshold?.toFixed(1)}%
                          {' • '}🚀 {thresholds[selectedCrypto.symbol].rallyThreshold?.toFixed(1)}%
                          {' • '}🌙 {thresholds[selectedCrypto.symbol].moonshotThreshold?.toFixed(1)}%
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
