// PortfolioBuilderTD - Wrapper component for TD Scoring portfolio creation
// Orchestrates the 4-step portfolio building flow

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { STOCKS, CRYPTO } from '../../data/assets';
import { getVolatilityThresholds } from '../../services/volatilityService';
import { getMultipleStockPrices, getMultipleCryptoPrices } from '../../services/eodhdAPI';
import BenchSelector from './BenchSelector';
import ThresholdPreview from './ThresholdPreview';

// Step definitions
const STEPS = [
  { id: 'roster', label: 'Roster', description: 'Select 6-12 stocks' },
  { id: 'crypto', label: 'Crypto', description: 'Pick 1 crypto (10%)' },
  { id: 'bench', label: 'Bench', description: 'Choose backups' },
  { id: 'review', label: 'Review', description: 'Confirm & create' }
];

// Allocation constraints
const STOCK_MIN_ALLOCATION = 7.5;
const STOCK_MAX_ALLOCATION = 20;
const CRYPTO_ALLOCATION = 10; // Fixed at 10%
const STOCK_TOTAL_ALLOCATION = 90; // Remaining 90%

/**
 * PortfolioBuilderTD
 * Main wrapper for TD Scoring portfolio creation
 *
 * @param {Object} props
 * @param {Function} props.onComplete - Callback when portfolio is ready
 * @param {Object} props.user - Current user object
 * @param {Function} props.onCancel - Cancel callback
 */
export default function PortfolioBuilderTD({
  onComplete,
  user,
  onCancel
}) {
  // Step state
  const [currentStep, setCurrentStep] = useState('roster');

  // Portfolio state
  const [portfolio, setPortfolio] = useState([]); // Stock allocations
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [bench, setBench] = useState([]); // 4 stocks
  const [benchCrypto, setBenchCrypto] = useState(null);
  const [portfolioName, setPortfolioName] = useState('');

  // Thresholds (fetched on review step)
  const [thresholds, setThresholds] = useState({});
  const [loadingThresholds, setLoadingThresholds] = useState(false);

  // Price data
  const [stockPrices, setStockPrices] = useState({});
  const [cryptoPrices, setCryptoPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Search states for roster and crypto steps
  const [stockSearch, setStockSearch] = useState('');
  const [cryptoSearch, setCryptoSearch] = useState('');

  // Load prices on mount
  useEffect(() => {
    const loadPrices = async () => {
      setLoadingPrices(true);
      try {
        const stockSymbols = STOCKS.map(s => s.symbol);
        const cryptoSymbols = CRYPTO.filter(c => c.category !== 'Stablecoin').map(c => c.symbol);

        const [stocks, crypto] = await Promise.all([
          getMultipleStockPrices(stockSymbols),
          getMultipleCryptoPrices(cryptoSymbols)
        ]);

        setStockPrices(stocks);
        setCryptoPrices(crypto);
      } catch (error) {
        console.error('Error loading prices:', error);
      } finally {
        setLoadingPrices(false);
      }
    };

    loadPrices();
  }, []);

  // Fetch thresholds when entering review step
  useEffect(() => {
    if (currentStep !== 'review') return;

    const fetchThresholds = async () => {
      setLoadingThresholds(true);
      try {
        // Collect all symbols
        const stockSymbols = [...portfolio.map(a => a.symbol), ...bench.map(a => a.symbol)];
        const cryptoSymbols = [
          selectedCrypto?.symbol,
          benchCrypto?.symbol
        ].filter(Boolean);

        const [stockThresholds, cryptoThresholds] = await Promise.all([
          stockSymbols.length > 0 ? getVolatilityThresholds(stockSymbols, 'stock') : {},
          cryptoSymbols.length > 0 ? getVolatilityThresholds(cryptoSymbols, 'crypto') : {}
        ]);

        setThresholds({ ...stockThresholds, ...cryptoThresholds });
      } catch (error) {
        console.error('Error fetching thresholds:', error);
      } finally {
        setLoadingThresholds(false);
      }
    };

    fetchThresholds();
  }, [currentStep, portfolio, bench, selectedCrypto, benchCrypto]);

  // Calculate remaining allocation for stocks
  const totalStockAllocation = useMemo(() => {
    return portfolio.reduce((sum, asset) => sum + (asset.amount || 0), 0);
  }, [portfolio]);

  const remainingAllocation = STOCK_TOTAL_ALLOCATION - totalStockAllocation;

  // Filter available stocks for roster selection
  const availableStocks = useMemo(() => {
    const selectedSymbols = new Set(portfolio.map(a => a.symbol));
    return STOCKS.filter(stock => {
      const matchesSearch = !stockSearch ||
        stock.symbol.toLowerCase().includes(stockSearch.toLowerCase()) ||
        stock.name.toLowerCase().includes(stockSearch.toLowerCase());
      return matchesSearch && !selectedSymbols.has(stock.symbol);
    });
  }, [stockSearch, portfolio]);

  // Filter available crypto (exclude stablecoins)
  const availableCrypto = useMemo(() => {
    return CRYPTO.filter(crypto => {
      if (crypto.category === 'Stablecoin') return false;
      const matchesSearch = !cryptoSearch ||
        crypto.symbol.toLowerCase().includes(cryptoSearch.toLowerCase()) ||
        crypto.name.toLowerCase().includes(cryptoSearch.toLowerCase());
      return matchesSearch;
    });
  }, [cryptoSearch]);

  // Add stock to portfolio
  const handleAddStock = (stock) => {
    if (portfolio.length >= 12) return;
    const defaultAllocation = Math.min(STOCK_MAX_ALLOCATION, Math.max(STOCK_MIN_ALLOCATION, remainingAllocation));
    const price = stockPrices[stock.symbol]?.price || 0;
    setPortfolio([...portfolio, {
      ...stock,
      price,
      amount: defaultAllocation,
      position: 'long'
    }]);
  };

  // Remove stock from portfolio
  const handleRemoveStock = (symbol) => {
    setPortfolio(portfolio.filter(s => s.symbol !== symbol));
  };

  // Update stock allocation
  const handleUpdateAllocation = (symbol, amount) => {
    setPortfolio(portfolio.map(s =>
      s.symbol === symbol ? { ...s, amount: Math.max(STOCK_MIN_ALLOCATION, Math.min(STOCK_MAX_ALLOCATION, amount)) } : s
    ));
  };

  // Validate current step
  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 'roster':
        return portfolio.length >= 6 && portfolio.length <= 12 &&
               Math.abs(totalStockAllocation - STOCK_TOTAL_ALLOCATION) < 0.1;
      case 'crypto':
        return selectedCrypto !== null;
      case 'bench':
        return bench.length === 4 && benchCrypto !== null;
      case 'review':
        return portfolioName.trim().length > 0;
      default:
        return false;
    }
  }, [currentStep, portfolio, totalStockAllocation, selectedCrypto, bench, benchCrypto, portfolioName]);

  // Navigate steps
  const goToNextStep = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  };

  const goToPrevStep = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    }
  };

  // Complete portfolio creation
  const handleComplete = () => {
    if (!isStepValid) return;

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

    onComplete({
      portfolioName: portfolioName.trim(),
      portfolio: [...portfolio, cryptoAsset].filter(Boolean),
      bench: [...benchAssets, benchCryptoAsset].filter(Boolean),
      thresholds
    });
  };

  // Current step index for progress
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Create TD Portfolio</h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-3">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium transition-colors',
                  index === currentStepIndex && 'text-cyan-500',
                  index < currentStepIndex && 'text-emerald-500',
                  index > currentStepIndex && 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  index === currentStepIndex && 'bg-cyan-500 text-white',
                  index < currentStepIndex && 'bg-emerald-500 text-white',
                  index > currentStepIndex && 'bg-muted text-muted-foreground'
                )}>
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 rounded',
                  index < currentStepIndex ? 'bg-emerald-500' : 'bg-muted'
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {/* Step 1: Roster */}
          {currentStep === 'roster' && (
            <motion.div
              key="roster"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <h3 className="text-lg font-bold">Select Your Roster</h3>
                <p className="text-sm text-muted-foreground">
                  Choose 6-12 stocks (allocations must total 90%)
                </p>
              </div>

              {/* Allocation summary */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Stock Allocation</span>
                <span className={cn(
                  'font-bold',
                  Math.abs(totalStockAllocation - 90) < 0.1 ? 'text-emerald-500' : 'text-amber-500'
                )}>
                  {totalStockAllocation.toFixed(1)}% / 90%
                </span>
              </div>

              {/* Selected stocks */}
              <div className="space-y-2">
                {portfolio.map((stock) => (
                  <div
                    key={stock.symbol}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{stock.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{stock.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={stock.amount}
                        onChange={(e) => handleUpdateAllocation(stock.symbol, parseFloat(e.target.value) || 0)}
                        min={STOCK_MIN_ALLOCATION}
                        max={STOCK_MAX_ALLOCATION}
                        step={0.5}
                        className="w-16 px-2 py-1 text-sm text-center rounded border border-border bg-background"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <button
                        onClick={() => handleRemoveStock(stock.symbol)}
                        className="p-1 text-muted-foreground hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add stock */}
              {portfolio.length < 12 && (
                <div className="relative">
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="Search stocks to add..."
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  {stockSearch && availableStocks.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                      {availableStocks.slice(0, 10).map((stock) => (
                        <button
                          key={stock.symbol}
                          onClick={() => {
                            handleAddStock(stock);
                            setStockSearch('');
                          }}
                          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-accent"
                        >
                          <div>
                            <span className="font-medium text-sm">{stock.symbol}</span>
                            <span className="text-xs text-muted-foreground ml-2">{stock.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ${(stockPrices[stock.symbol]?.price || 0).toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Constraints info */}
              <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <p>• Each stock: {STOCK_MIN_ALLOCATION}% - {STOCK_MAX_ALLOCATION}%</p>
                <p>• Total stocks: 6-12 picks</p>
                <p>• Crypto gets fixed 10% (next step)</p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Crypto */}
          {currentStep === 'crypto' && (
            <motion.div
              key="crypto"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <h3 className="text-lg font-bold">Select Your Crypto</h3>
                <p className="text-sm text-muted-foreground">
                  Pick 1 cryptocurrency (fixed at 10% allocation)
                </p>
              </div>

              {/* Selected crypto */}
              {selectedCrypto && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-amber-500">{selectedCrypto.symbol}</div>
                      <div className="text-sm text-muted-foreground">{selectedCrypto.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">10%</div>
                      <div className="text-xs text-muted-foreground">
                        ${(cryptoPrices[selectedCrypto.symbol]?.price || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCrypto(null)}
                    className="mt-2 text-xs text-muted-foreground hover:text-red-500"
                  >
                    Remove and pick another
                  </button>
                </div>
              )}

              {/* Crypto search */}
              {!selectedCrypto && (
                <>
                  <input
                    type="text"
                    value={cryptoSearch}
                    onChange={(e) => setCryptoSearch(e.target.value)}
                    placeholder="Search crypto..."
                    className="w-full px-4 py-2.5 rounded-lg border border-amber-500/30 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />

                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {availableCrypto.map((crypto) => (
                      <button
                        key={crypto.symbol}
                        onClick={() => setSelectedCrypto(crypto)}
                        className="p-3 rounded-lg border border-border bg-card text-left hover:border-amber-500/50 transition-colors"
                      >
                        <div className="font-medium text-amber-500">{crypto.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">{crypto.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ${(cryptoPrices[crypto.symbol]?.price || 0).toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Step 3: Bench */}
          {currentStep === 'bench' && (
            <motion.div
              key="bench"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <BenchSelector
                portfolio={portfolio}
                selectedCrypto={selectedCrypto}
                bench={bench}
                setBench={setBench}
                benchCrypto={benchCrypto}
                setBenchCrypto={setBenchCrypto}
                stockPrices={stockPrices}
                cryptoPrices={cryptoPrices}
              />
            </motion.div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <h3 className="text-lg font-bold">Review & Create</h3>
                <p className="text-sm text-muted-foreground">
                  Name your portfolio and confirm details
                </p>
              </div>

              {/* Portfolio name */}
              <div>
                <label className="block text-sm font-medium mb-2">Portfolio Name</label>
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="e.g., Tech Titans, Value Plays..."
                  maxLength={30}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Thresholds preview */}
              {loadingThresholds ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-2" />
                  Loading thresholds...
                </div>
              ) : (
                <ThresholdPreview
                  portfolio={portfolio}
                  crypto={selectedCrypto}
                  bench={bench}
                  benchCrypto={benchCrypto}
                  thresholds={thresholds}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <button
          onClick={currentStepIndex === 0 ? onCancel : goToPrevStep}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {currentStepIndex === 0 ? 'Cancel' : '← Back'}
        </button>

        {currentStep === 'review' ? (
          <button
            onClick={handleComplete}
            disabled={!isStepValid || loadingThresholds}
            className={cn(
              'px-6 py-2 rounded-lg font-medium text-sm transition-colors',
              isStepValid && !loadingThresholds
                ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Create Battle →
          </button>
        ) : (
          <button
            onClick={goToNextStep}
            disabled={!isStepValid}
            className={cn(
              'px-6 py-2 rounded-lg font-medium text-sm transition-colors',
              isStepValid
                ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
