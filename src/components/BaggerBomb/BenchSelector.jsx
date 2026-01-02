// BenchSelector - Component for selecting bench assets for TD Scoring
// Bench: 4 stocks + 1 crypto that can be substituted during battle

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { STOCKS, CRYPTO } from '../../data/assets';

/**
 * BenchSelector
 * Component for selecting bench assets (4 stocks + 1 crypto)
 *
 * @param {Object} props
 * @param {Array} props.portfolio - Current roster stocks (to exclude from options)
 * @param {Object} props.selectedCrypto - Roster crypto (to exclude from options)
 * @param {Array} props.bench - Selected bench stocks
 * @param {Function} props.setBench - Setter for bench stocks
 * @param {Object} props.benchCrypto - Selected bench crypto
 * @param {Function} props.setBenchCrypto - Setter for bench crypto
 * @param {Object} props.stockPrices - Current stock prices
 * @param {Object} props.cryptoPrices - Current crypto prices
 */
export default function BenchSelector({
  portfolio = [],
  selectedCrypto = null,
  bench = [],
  setBench,
  benchCrypto = null,
  setBenchCrypto,
  stockPrices = {},
  cryptoPrices = {}
}) {
  const [stockSearch, setStockSearch] = useState('');
  const [cryptoSearch, setCryptoSearch] = useState('');
  const [showStockDropdown, setShowStockDropdown] = useState(false);
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false);

  // Get roster symbols to exclude
  const rosterSymbols = useMemo(() => {
    const symbols = new Set();
    portfolio.forEach(asset => symbols.add(asset.symbol?.toUpperCase()));
    if (selectedCrypto?.symbol) {
      symbols.add(selectedCrypto.symbol.toUpperCase());
    }
    return symbols;
  }, [portfolio, selectedCrypto]);

  // Get bench symbols to prevent duplicates
  const benchSymbols = useMemo(() => {
    const symbols = new Set();
    bench.forEach(asset => symbols.add(asset.symbol?.toUpperCase()));
    if (benchCrypto?.symbol) {
      symbols.add(benchCrypto.symbol.toUpperCase());
    }
    return symbols;
  }, [bench, benchCrypto]);

  // Filter available stocks (not in roster or bench)
  const availableStocks = useMemo(() => {
    return STOCKS.filter(stock => {
      const symbol = stock.symbol.toUpperCase();
      const matchesSearch = !stockSearch ||
        stock.symbol.toLowerCase().includes(stockSearch.toLowerCase()) ||
        stock.name.toLowerCase().includes(stockSearch.toLowerCase());
      return matchesSearch && !rosterSymbols.has(symbol) && !benchSymbols.has(symbol);
    });
  }, [stockSearch, rosterSymbols, benchSymbols]);

  // Filter available crypto (not in roster or bench, exclude stablecoins)
  const availableCrypto = useMemo(() => {
    return CRYPTO.filter(crypto => {
      const symbol = crypto.symbol.toUpperCase();
      // Exclude stablecoins from bench options
      if (crypto.category === 'Stablecoin') return false;
      const matchesSearch = !cryptoSearch ||
        crypto.symbol.toLowerCase().includes(cryptoSearch.toLowerCase()) ||
        crypto.name.toLowerCase().includes(cryptoSearch.toLowerCase());
      return matchesSearch && !rosterSymbols.has(symbol) && !benchSymbols.has(symbol);
    });
  }, [cryptoSearch, rosterSymbols, benchSymbols]);

  // Add stock to bench
  const handleAddStock = (stock) => {
    if (bench.length >= 4) return;
    const price = stockPrices[stock.symbol]?.price || stockPrices[stock.symbol] || 0;
    setBench([...bench, { ...stock, price }]);
    setStockSearch('');
    setShowStockDropdown(false);
  };

  // Remove stock from bench
  const handleRemoveStock = (symbol) => {
    setBench(bench.filter(s => s.symbol !== symbol));
  };

  // Set bench crypto
  const handleAddCrypto = (crypto) => {
    const price = cryptoPrices[crypto.symbol]?.price || cryptoPrices[crypto.symbol] || 0;
    setBenchCrypto({ ...crypto, price });
    setCryptoSearch('');
    setShowCryptoDropdown(false);
  };

  // Remove bench crypto
  const handleRemoveCrypto = () => {
    setBenchCrypto(null);
  };

  const stocksComplete = bench.length === 4;
  const cryptoComplete = benchCrypto !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold mb-1">Select Your Bench</h3>
        <p className="text-sm text-muted-foreground">
          Choose backup assets for mid-battle substitutions
        </p>
      </div>

      {/* Stock Bench Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Stock Bench</span>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded',
            stocksComplete ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted text-muted-foreground'
          )}>
            {bench.length}/4 stocks
          </span>
        </div>

        {/* Selected bench stocks */}
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          <AnimatePresence mode="popLayout">
            {bench.map((stock) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                layout
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border"
              >
                <span className="font-medium text-sm">{stock.symbol}</span>
                <span className="text-xs text-muted-foreground">
                  ${(stockPrices[stock.symbol]?.price || stock.price || 0).toFixed(2)}
                </span>
                <button
                  onClick={() => handleRemoveStock(stock.symbol)}
                  className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {bench.length === 0 && (
            <span className="text-sm text-muted-foreground/50 py-1">
              No stocks selected yet
            </span>
          )}
        </div>

        {/* Stock search input */}
        {!stocksComplete && (
          <div className="relative">
            <input
              type="text"
              value={stockSearch}
              onChange={(e) => {
                setStockSearch(e.target.value);
                setShowStockDropdown(true);
              }}
              onFocus={() => setShowStockDropdown(true)}
              placeholder="Search stocks to add..."
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />

            {/* Dropdown */}
            <AnimatePresence>
              {showStockDropdown && availableStocks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
                >
                  {availableStocks.slice(0, 10).map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleAddStock(stock)}
                      className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-accent transition-colors"
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Click outside to close */}
        {showStockDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowStockDropdown(false)}
          />
        )}
      </div>

      {/* Crypto Bench Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Crypto Bench</span>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded',
            cryptoComplete ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted text-muted-foreground'
          )}>
            {benchCrypto ? '1/1' : '0/1'} crypto
          </span>
        </div>

        {/* Selected bench crypto */}
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          <AnimatePresence mode="popLayout">
            {benchCrypto && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                layout
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30"
              >
                <span className="font-medium text-sm text-amber-500">{benchCrypto.symbol}</span>
                <span className="text-xs text-muted-foreground">
                  ${(cryptoPrices[benchCrypto.symbol]?.price || benchCrypto.price || 0).toFixed(2)}
                </span>
                <button
                  onClick={handleRemoveCrypto}
                  className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!benchCrypto && (
            <span className="text-sm text-muted-foreground/50 py-1">
              No crypto selected yet
            </span>
          )}
        </div>

        {/* Crypto search input */}
        {!cryptoComplete && (
          <div className="relative">
            <input
              type="text"
              value={cryptoSearch}
              onChange={(e) => {
                setCryptoSearch(e.target.value);
                setShowCryptoDropdown(true);
              }}
              onFocus={() => setShowCryptoDropdown(true)}
              placeholder="Search crypto to add..."
              className="w-full px-4 py-2.5 rounded-lg border border-amber-500/30 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />

            {/* Dropdown */}
            <AnimatePresence>
              {showCryptoDropdown && availableCrypto.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
                >
                  {availableCrypto.slice(0, 10).map((crypto) => (
                    <button
                      key={crypto.symbol}
                      onClick={() => handleAddCrypto(crypto)}
                      className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-accent transition-colors"
                    >
                      <div>
                        <span className="font-medium text-sm text-amber-500">{crypto.symbol}</span>
                        <span className="text-xs text-muted-foreground ml-2">{crypto.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ${(cryptoPrices[crypto.symbol]?.price || 0).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Click outside to close */}
        {showCryptoDropdown && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowCryptoDropdown(false)}
          />
        )}
      </div>

      {/* Completion indicator */}
      {stocksComplete && cryptoComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
        >
          <span className="text-emerald-500 font-medium">
            ✓ Bench complete! Ready to proceed.
          </span>
        </motion.div>
      )}

      {/* Info box */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">About Bench Assets</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Substitute in during two 15-minute windows</li>
              <li>Stocks can only replace stocks, crypto for crypto</li>
              <li>Maximum 2 substitutions per battle</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
