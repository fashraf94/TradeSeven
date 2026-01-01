// PortfolioBuilderTD - Accordion-style TD Scoring portfolio builder
// Single-page layout with collapsible sections for roster, crypto, bench, and scoring preview

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { STOCKS, CRYPTO } from '../../data/assets';
import { getVolatilityThresholds } from '../../services/volatilityService';
import { getMultipleStockPrices, getMultipleCryptoPrices } from '../../services/eodhdAPI';
import AccordionSection from './AccordionSection';
import RosterAssetCard from './RosterAssetCard';
import AllocationBar from './AllocationBar';
import { BenchCard, AddBenchCard } from './BenchCard';
import ScoringPreviewNew from './ScoringPreviewNew';
import BottomActionBar from './BottomActionBar';
import StockSearch from './StockSearch';

// Color scheme matching existing app
const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBgHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  primary: '#00d9ff',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)'
};

// Allocation constraints
const STOCK_MIN_ALLOCATION = 7.5;
const STOCK_MAX_ALLOCATION = 20;
const CRYPTO_ALLOCATION = 10; // Fixed at 10%
const STOCK_TOTAL_ALLOCATION = 90; // Remaining 90%

/**
 * PortfolioBuilderTD
 * Accordion-style single-page portfolio builder for TD Scoring battles
 *
 * @param {Function} onSubmit - Callback when portfolio is ready to create battle
 * @param {Function} onBack - Callback to go back/cancel
 * @param {Object} stockPrices - Optional pre-loaded stock prices
 * @param {Object} cryptoPrices - Optional pre-loaded crypto prices
 * @param {Object} thresholds - Optional pre-loaded thresholds
 */
export default function PortfolioBuilderTD({
  onSubmit,
  onBack,
  stockPrices: initialStockPrices = {},
  cryptoPrices: initialCryptoPrices = {},
  thresholds: initialThresholds = {}
}) {
  // Portfolio state
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolio, setPortfolio] = useState([]); // roster stocks with allocations
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [bench, setBench] = useState([]); // 4 stocks
  const [benchCrypto, setBenchCrypto] = useState(null);

  // UI state
  const [stockPrices, setStockPrices] = useState(initialStockPrices);
  const [cryptoPrices, setCryptoPrices] = useState(initialCryptoPrices);
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [isLoadingPrices, setIsLoadingPrices] = useState(Object.keys(initialStockPrices).length === 0);
  const [isLoadingThresholds, setIsLoadingThresholds] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Bench selection modal state
  const [showBenchStockModal, setShowBenchStockModal] = useState(false);
  const [showBenchCryptoModal, setShowBenchCryptoModal] = useState(false);

  // Load prices on mount if not provided
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

    // Check if we already have thresholds for all symbols
    const missingSymbols = allSymbols.filter(s => !thresholds[s]);
    if (missingSymbols.length === 0) return;

    const fetchThresholds = async () => {
      setIsLoadingThresholds(true);
      try {
        const stockSymbols = missingSymbols.filter(s =>
          STOCKS.some(stock => stock.symbol === s)
        );
        const cryptoSymbols = missingSymbols.filter(s =>
          CRYPTO.some(crypto => crypto.symbol === s)
        );

        const [stockThresholds, cryptoThresholds] = await Promise.all([
          stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
          cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {}
        ]);

        setThresholds(prev => ({
          ...prev,
          ...(stockThresholds || {}),
          ...(cryptoThresholds || {})
        }));
      } catch (error) {
        console.error('Error fetching thresholds:', error);
      } finally {
        setIsLoadingThresholds(false);
      }
    };

    fetchThresholds();
  }, [portfolio, selectedCrypto, bench, benchCrypto, thresholds]);

  // Calculate allocation
  const totalStockAllocation = useMemo(() => {
    return portfolio.reduce((sum, asset) => sum + (asset.amount || 0), 0);
  }, [portfolio]);

  const remainingAllocation = STOCK_TOTAL_ALLOCATION - totalStockAllocation;

  // Validation states
  const rosterComplete = portfolio.length >= 6 && portfolio.length <= 12 &&
    Math.abs(totalStockAllocation - STOCK_TOTAL_ALLOCATION) < 0.1;
  const cryptoComplete = selectedCrypto !== null;
  const benchComplete = bench.length === 4 && benchCrypto !== null;
  const nameComplete = portfolioName.trim().length > 0;

  // Validation errors
  const validationErrors = useMemo(() => {
    const errors = [];
    if (portfolio.length < 6) errors.push(`Need ${6 - portfolio.length} more stocks (minimum 6)`);
    if (portfolio.length > 12) errors.push('Too many stocks (maximum 12)');
    if (portfolio.length >= 6 && Math.abs(totalStockAllocation - 90) >= 0.1) {
      if (totalStockAllocation < 90) {
        errors.push(`Need ${(90 - totalStockAllocation).toFixed(1)}% more allocation to reach 90%`);
      } else {
        errors.push(`${(totalStockAllocation - 90).toFixed(1)}% over allocation limit`);
      }
    }
    if (!selectedCrypto) errors.push('Select 1 crypto for your portfolio');
    if (bench.length < 4) errors.push(`Bench needs ${4 - bench.length} more stocks`);
    if (!benchCrypto) errors.push('Bench needs 1 crypto');
    if (!portfolioName.trim()) errors.push('Enter a portfolio name');
    return errors;
  }, [portfolio, totalStockAllocation, selectedCrypto, bench, benchCrypto, portfolioName]);

  // Section statuses
  const getRosterStatus = () => rosterComplete ? 'complete' : 'incomplete';
  const getCryptoStatus = () => cryptoComplete ? 'complete' : 'incomplete';
  const getBenchStatus = () => benchComplete ? 'complete' : 'incomplete';

  // Add stock to portfolio
  const handleAddStock = useCallback((stock) => {
    if (portfolio.length >= 12) return;
    const defaultAllocation = Math.min(
      STOCK_MAX_ALLOCATION,
      Math.max(STOCK_MIN_ALLOCATION, remainingAllocation / Math.max(1, 6 - portfolio.length))
    );
    const price = stockPrices[stock.symbol]?.price || stock.price || 0;
    setPortfolio(prev => [...prev, {
      ...stock,
      price,
      amount: Math.round(defaultAllocation * 2) / 2, // Round to 0.5
      position: 'long'
    }]);
  }, [portfolio.length, remainingAllocation, stockPrices]);

  // Remove stock from portfolio
  const handleRemoveStock = useCallback((symbol) => {
    setPortfolio(prev => prev.filter(s => s.symbol !== symbol));
  }, []);

  // Update stock allocation
  const handleUpdateAllocation = useCallback((symbol, amount) => {
    setPortfolio(prev => prev.map(s =>
      s.symbol === symbol
        ? { ...s, amount: Math.round(Math.max(STOCK_MIN_ALLOCATION, Math.min(STOCK_MAX_ALLOCATION, amount)) * 2) / 2 }
        : s
    ));
  }, []);

  // Auto-balance allocations
  const handleAutoBalance = useCallback(() => {
    if (portfolio.length === 0) return;
    const remaining = STOCK_TOTAL_ALLOCATION - totalStockAllocation;
    if (Math.abs(remaining) < 0.1) return;

    const perStock = remaining / portfolio.length;
    setPortfolio(prev => prev.map(s => ({
      ...s,
      amount: Math.round(Math.min(STOCK_MAX_ALLOCATION, Math.max(STOCK_MIN_ALLOCATION, s.amount + perStock)) * 2) / 2
    })));
  }, [portfolio, totalStockAllocation]);

  // Equal split allocations
  const handleEqualSplit = useCallback(() => {
    if (portfolio.length === 0) return;
    const perStock = STOCK_TOTAL_ALLOCATION / portfolio.length;
    const clamped = Math.min(STOCK_MAX_ALLOCATION, Math.max(STOCK_MIN_ALLOCATION, perStock));
    setPortfolio(prev => prev.map(s => ({
      ...s,
      amount: Math.round(clamped * 2) / 2
    })));
  }, [portfolio.length]);

  // Add stock to bench
  const handleAddToBench = useCallback((stock) => {
    if (bench.length >= 4) return;
    const price = stockPrices[stock.symbol]?.price || stock.price || 0;
    setBench(prev => [...prev, { ...stock, price }]);
    setShowBenchStockModal(false);
  }, [bench.length, stockPrices]);

  // Remove stock from bench
  const handleRemoveFromBench = useCallback((symbol) => {
    setBench(prev => prev.filter(s => s.symbol !== symbol));
  }, []);

  // Filter available stocks (exclude those already in roster or bench)
  const excludedStockSymbols = useMemo(() => [
    ...portfolio.map(p => p.symbol),
    ...bench.map(b => b.symbol)
  ], [portfolio, bench]);

  // Filter available crypto (exclude selected and bench crypto)
  const availableCrypto = useMemo(() => {
    return CRYPTO.filter(crypto => {
      if (crypto.category === 'Stablecoin') return false;
      if (selectedCrypto?.symbol === crypto.symbol) return false;
      if (benchCrypto?.symbol === crypto.symbol) return false;
      return true;
    });
  }, [selectedCrypto, benchCrypto]);

  // Handle create battle
  const handleCreateBattle = async () => {
    if (!rosterComplete || !cryptoComplete || !benchComplete || !nameComplete) return;

    setIsCreating(true);
    try {
      // Build crypto asset with fixed 10% allocation
      const cryptoAsset = selectedCrypto ? {
        ...selectedCrypto,
        amount: CRYPTO_ALLOCATION,
        price: cryptoPrices[selectedCrypto.symbol]?.price || 0,
        position: 'long'
      } : null;

      // Build bench assets
      const benchAssets = bench.map(stock => ({
        ...stock,
        amount: 0,
        price: stockPrices[stock.symbol]?.price || 0,
        position: 'long'
      }));

      const benchCryptoAsset = benchCrypto ? {
        ...benchCrypto,
        amount: 0,
        price: cryptoPrices[benchCrypto.symbol]?.price || 0,
        position: 'long'
      } : null;

      await onSubmit({
        portfolioName: portfolioName.trim(),
        roster: portfolio,
        crypto: cryptoAsset,
        bench: benchAssets,
        benchCrypto: benchCryptoAsset,
        thresholds
      });
    } catch (error) {
      console.error('Error creating battle:', error);
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
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        padding: '16px',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: 'rgba(10,10,15,0.95)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              padding: '8px',
              fontSize: '14px'
            }}
          >
            ← Back
          </button>
          <h1 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: colors.textPrimary,
            margin: 0
          }}>
            Create TD Battle
          </h1>
          <div style={{ width: '60px' }} /> {/* Spacer for centering */}
        </div>

        {/* Portfolio Name Input */}
        <input
          type="text"
          value={portfolioName}
          onChange={(e) => setPortfolioName(e.target.value)}
          placeholder="Portfolio Name..."
          maxLength={30}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            border: `1px solid ${nameComplete ? colors.green : colors.border}`,
            backgroundColor: colors.cardBg,
            color: colors.textPrimary,
            fontSize: '16px',
            fontWeight: '500',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
        />
      </header>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        paddingBottom: '140px' // Space for sticky bottom bar
      }}>
        {/* Allocation Helper Bar */}
        <AllocationBar
          stocks={portfolio}
          remaining={remainingAllocation}
          target={STOCK_TOTAL_ALLOCATION}
        />

        {/* ROSTER Section */}
        <AccordionSection
          title="ROSTER"
          subtitle={`${portfolio.length}/6-12 stocks · ${totalStockAllocation.toFixed(1)}%/90%`}
          status={getRosterStatus()}
          defaultOpen={true}
        >
          {/* Allocation Helpers */}
          {portfolio.length >= 2 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <button
                onClick={handleAutoBalance}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.textSecondary,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Auto-Balance
              </button>
              <button
                onClick={handleEqualSplit}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.textSecondary,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Equal Split
              </button>
            </div>
          )}

          {/* Roster Cards */}
          <div style={{ marginBottom: '12px' }}>
            {portfolio.map((stock) => (
              <RosterAssetCard
                key={stock.symbol}
                asset={stock}
                threshold={thresholds[stock.symbol]}
                onRemove={handleRemoveStock}
                onAllocationChange={handleUpdateAllocation}
              />
            ))}
          </div>

          {/* Add Stock Search */}
          {portfolio.length < 12 && (
            <StockSearch
              onSelect={handleAddStock}
              excludeSymbols={excludedStockSymbols}
              stocks={STOCKS}
              stockPrices={stockPrices}
              thresholds={thresholds}
              placeholder="🔍 Search stocks to add..."
            />
          )}

          {/* Constraints Info */}
          <div style={{
            marginTop: '12px',
            padding: '10px 12px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: colors.textMuted
          }}>
            <p style={{ margin: '0 0 4px 0' }}>• Each stock: {STOCK_MIN_ALLOCATION}% - {STOCK_MAX_ALLOCATION}%</p>
            <p style={{ margin: '0 0 4px 0' }}>• Total stocks: 6-12 picks</p>
            <p style={{ margin: 0 }}>• Crypto gets fixed 10% (next section)</p>
          </div>
        </AccordionSection>

        {/* CRYPTO Section */}
        <AccordionSection
          title="CRYPTO"
          subtitle={selectedCrypto ? `${selectedCrypto.symbol} · 10% fixed` : 'Select 1 crypto'}
          status={getCryptoStatus()}
        >
          {/* Selected Crypto */}
          {selectedCrypto && (
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '10px',
              marginBottom: '12px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: colors.yellow
                  }}>
                    {selectedCrypto.symbol}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: colors.textSecondary
                  }}>
                    {selectedCrypto.name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: colors.primary
                  }}>
                    10%
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: colors.textMuted
                  }}>
                    ${(cryptoPrices[selectedCrypto.symbol]?.price || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCrypto(null)}
                style={{
                  marginTop: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Remove and pick another
              </button>
            </div>
          )}

          {/* Crypto Grid */}
          {!selectedCrypto && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '8px'
            }}>
              {availableCrypto.map((crypto) => (
                <button
                  key={crypto.symbol}
                  onClick={() => setSelectedCrypto(crypto)}
                  style={{
                    padding: '12px',
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.yellow;
                    e.currentTarget.style.backgroundColor = colors.cardBgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.backgroundColor = colors.cardBg;
                  }}
                >
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: colors.yellow
                  }}>
                    {crypto.symbol}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    marginTop: '4px'
                  }}>
                    ${(cryptoPrices[crypto.symbol]?.price || 0).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </AccordionSection>

        {/* BENCH Section */}
        <AccordionSection
          title="BENCH"
          subtitle={`${bench.length}/4 stocks · ${benchCrypto ? '1' : '0'}/1 crypto`}
          status={getBenchStatus()}
        >
          {/* Info Tooltip */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: 'rgba(0,217,255,0.05)',
            border: '1px solid rgba(0,217,255,0.1)',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '14px' }}>ℹ️</span>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: colors.textSecondary,
              lineHeight: 1.4
            }}>
              Bench assets can substitute in during battle windows (11:30am & 2:00pm ET).
              Choose backups that complement your roster strategy.
            </p>
          </div>

          {/* Stock Bench */}
          <div style={{
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textMuted,
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              STOCKS ({bench.length}/4)
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '8px'
            }}>
              {bench.map((stock) => (
                <BenchCard
                  key={stock.symbol}
                  asset={stock}
                  threshold={thresholds[stock.symbol]}
                  onRemove={handleRemoveFromBench}
                />
              ))}
              {bench.length < 4 && (
                <AddBenchCard
                  onClick={() => setShowBenchStockModal(true)}
                  type="stock"
                />
              )}
            </div>
          </div>

          {/* Crypto Bench */}
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textMuted,
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              CRYPTO ({benchCrypto ? '1' : '0'}/1)
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '8px'
            }}>
              {benchCrypto ? (
                <BenchCard
                  asset={benchCrypto}
                  threshold={thresholds[benchCrypto.symbol]}
                  onRemove={() => setBenchCrypto(null)}
                  isCrypto
                />
              ) : (
                <AddBenchCard
                  onClick={() => setShowBenchCryptoModal(true)}
                  type="crypto"
                />
              )}
            </div>
          </div>
        </AccordionSection>

        {/* SCORING PREVIEW Section */}
        <AccordionSection
          title="SCORING PREVIEW"
          subtitle="Estimated points & strategy"
          status="info"
        >
          {isLoadingThresholds ? (
            <div style={{
              textAlign: 'center',
              padding: '24px',
              color: colors.textMuted
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid transparent',
                borderTopColor: colors.primary,
                borderRadius: '50%',
                margin: '0 auto 8px',
                animation: 'spin 0.8s linear infinite'
              }} />
              Loading thresholds...
            </div>
          ) : (
            <ScoringPreviewNew
              portfolio={portfolio}
              crypto={selectedCrypto}
              bench={bench}
              benchCrypto={benchCrypto}
              thresholds={thresholds}
            />
          )}
        </AccordionSection>

        {/* Validation Warnings */}
        {validationErrors.length > 0 && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '10px',
            marginTop: '16px'
          }}>
            {validationErrors.map((error, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: i < validationErrors.length - 1 ? '6px' : 0
                }}
              >
                <span style={{ color: colors.yellow }}>⚠️</span>
                <span style={{
                  fontSize: '13px',
                  color: colors.textSecondary
                }}>
                  {error}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <BottomActionBar
        rosterComplete={rosterComplete}
        cryptoComplete={cryptoComplete}
        benchComplete={benchComplete}
        nameComplete={nameComplete}
        onCreateBattle={handleCreateBattle}
        isLoading={isCreating}
      />

      {/* Bench Stock Selection Modal */}
      {showBenchStockModal && (
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
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowBenchStockModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              width: '100%',
              maxWidth: '400px',
              maxHeight: '70vh',
              backgroundColor: '#12121a',
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '16px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: colors.textPrimary
              }}>
                Add Bench Stock
              </h3>
              <button
                onClick={() => setShowBenchStockModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              padding: '16px',
              overflowY: 'auto',
              maxHeight: 'calc(70vh - 60px)'
            }}>
              <StockSearch
                onSelect={handleAddToBench}
                excludeSymbols={excludedStockSymbols}
                stocks={STOCKS}
                stockPrices={stockPrices}
                thresholds={thresholds}
                placeholder="🔍 Search bench stocks..."
                maxResults={15}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Bench Crypto Selection Modal */}
      {showBenchCryptoModal && (
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
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowBenchCryptoModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              width: '100%',
              maxWidth: '400px',
              maxHeight: '70vh',
              backgroundColor: '#12121a',
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '16px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: colors.textPrimary
              }}>
                Add Bench Crypto
              </h3>
              <button
                onClick={() => setShowBenchCryptoModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              padding: '16px',
              overflowY: 'auto',
              maxHeight: 'calc(70vh - 60px)'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '8px'
              }}>
                {availableCrypto.map((crypto) => (
                  <button
                    key={crypto.symbol}
                    onClick={() => {
                      setBenchCrypto(crypto);
                      setShowBenchCryptoModal(false);
                    }}
                    style={{
                      padding: '12px',
                      backgroundColor: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.yellow;
                      e.currentTarget.style.backgroundColor = colors.cardBgHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.backgroundColor = colors.cardBg;
                    }}
                  >
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: colors.yellow
                    }}>
                      {crypto.symbol}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: colors.textMuted,
                      marginTop: '4px'
                    }}>
                      ${(cryptoPrices[crypto.symbol]?.price || 0).toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
