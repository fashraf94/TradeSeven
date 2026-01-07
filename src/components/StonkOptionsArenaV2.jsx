/**
 * Stonk Options Arena V2
 * Main screen combining all options trading components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import StonkOptionsChain from './StonkOptionsChain';
import StonkOptionsExpirySelector from './StonkOptionsExpirySelector';
import StonkOptionsStockSelector from './StonkOptionsStockSelector';
import StonkOptionsOrder from './StonkOptionsOrder';
import StonkOptionsPosition from './StonkOptionsPosition';
import {
  calculatePortfolio,
  STONK_OPTIONS_CONFIG
} from '../services/stonkOptionsEngineV2';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Wallet,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Default stocks to show
const DEFAULT_STOCKS = [
  'TSLA', 'NVDA', 'AAPL', 'AMZN', 'META',
  'AMD', 'GOOGL', 'MSFT', 'NFLX', 'COIN'
];

const StonkOptionsArenaV2 = ({
  onBack,
  stocksData = [],
  stockAPI = null,
  initialCash = 10000
}) => {
  // Core state
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState(7);
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [virtualCash, setVirtualCash] = useState(initialCash);

  // UI state
  const [showOrder, setShowOrder] = useState(false);
  const [showPositions, setShowPositions] = useState(true);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getFallbackPrice = (symbol) => {
    const fallbacks = {
      TSLA: 430, NVDA: 140, AAPL: 185, AMZN: 185, META: 505,
      AMD: 165, GOOGL: 175, MSFT: 420, NFLX: 475, COIN: 175
    };
    return fallbacks[symbol] || 100;
  };

  // Build prices from stocksData or fetch
  const fetchPrices = useCallback(async () => {
    try {
      const newPrices = {};

      // Get prices from stocksData first
      for (const symbol of DEFAULT_STOCKS) {
        const stockInfo = stocksData.find(s => s.symbol === symbol);
        if (stockInfo?.price) {
          newPrices[symbol] = stockInfo.price;
        }
      }

      // Fetch missing prices via API
      const missingSymbols = DEFAULT_STOCKS.filter(s => !newPrices[s]);

      if (stockAPI && missingSymbols.length > 0) {
        for (const symbol of missingSymbols) {
          try {
            const data = await stockAPI.getStockPrice(symbol);
            if (data?.price) {
              newPrices[symbol] = data.price;
            } else {
              newPrices[symbol] = getFallbackPrice(symbol);
            }
          } catch (e) {
            newPrices[symbol] = getFallbackPrice(symbol);
          }
        }
      } else {
        // Use fallbacks for any missing
        for (const symbol of missingSymbols) {
          newPrices[symbol] = getFallbackPrice(symbol);
        }
      }

      setPrices(newPrices);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Price fetch error:', error);
      // Use all fallbacks
      const fallbackPrices = {};
      DEFAULT_STOCKS.forEach(s => fallbackPrices[s] = getFallbackPrice(s));
      setPrices(fallbackPrices);
      setLoading(false);
    }
  }, [stocksData, stockAPI]);

  // Initial load
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Calculate portfolio
  const portfolio = useMemo(() => {
    return calculatePortfolio(contracts, prices);
  }, [contracts, prices]);

  // Total account value
  const totalValue = virtualCash + portfolio.summary.totalCurrent;
  const totalPL = totalValue - initialCash;
  const totalReturn = (totalPL / initialCash) * 100;

  // Handle stock selection
  const handleSelectStock = (symbol) => {
    setSelectedStock(symbol);
    setSelectedStrike(null);
    setShowOrder(false);
  };

  // Handle strike selection from chain
  const handleSelectStrike = (selection) => {
    setSelectedStrike(selection);
    setShowOrder(true);
  };

  // Handle order confirmation
  const handleConfirmOrder = (contract) => {
    if (contract.entryAmount > virtualCash) {
      alert('Insufficient funds!');
      return;
    }

    setContracts(prev => [...prev, contract]);
    setVirtualCash(prev => prev - contract.entryAmount);
    setSelectedStrike(null);
    setShowOrder(false);
  };

  // Handle selling a position
  const handleSellPosition = (contract, valuation) => {
    if (window.confirm(`Sell ${contract.contractName} for $${valuation.currentValue.toFixed(2)}?`)) {
      setContracts(prev => prev.filter(c => c.id !== contract.id));
      setVirtualCash(prev => prev + valuation.currentValue);
    }
  };

  // Handle reset
  const handleReset = () => {
    if (window.confirm('Reset all positions and cash?')) {
      setContracts([]);
      setVirtualCash(initialCash);
      setSelectedStock(null);
      setSelectedStrike(null);
      setShowOrder(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <TrendingUp size={48} color="#00d9ff" style={{ marginBottom: 16 }} />
          <div style={{ color: '#00d9ff', fontSize: 18 }}>Loading Options Arena...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a1a',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    background: '#1f2937',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <TrendingUp size={24} color="#00d9ff" />
                  Stonk Options
                </h1>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Binary options trading game
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={fetchPrices}
                style={{
                  background: '#1f2937',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13
                }}
              >
                <RefreshCw size={14} />
                {!isMobile && 'Refresh'}
              </button>
              <button
                onClick={handleReset}
                style={{
                  background: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Account Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 12
          }}>
            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{
                fontSize: 11,
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4
              }}>
                <Wallet size={12} />
                CASH
              </div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                ${virtualCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{
                fontSize: 11,
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4
              }}>
                <BarChart3 size={12} />
                POSITIONS
              </div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#00d9ff' }}>
                ${portfolio.summary.totalCurrent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                TOTAL VALUE
              </div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                P/L
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: totalPL >= 0 ? '#10b981' : '#ef4444'
              }}>
                {totalPL >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: (!isMobile && showOrder) ? '1fr 380px' : '1fr',
          gap: 20
        }}>
          {/* Left Column: Trading Interface */}
          <div>
            {/* Stock Selector */}
            <StonkOptionsStockSelector
              stocks={DEFAULT_STOCKS}
              prices={prices}
              selectedStock={selectedStock}
              onSelectStock={handleSelectStock}
            />

            {selectedStock && (
              <>
                {/* Expiry Selector */}
                <div style={{ marginTop: 16 }}>
                  <StonkOptionsExpirySelector
                    selectedExpiry={selectedExpiry}
                    onSelectExpiry={setSelectedExpiry}
                  />
                </div>

                {/* Options Chain */}
                <div style={{ marginTop: 16 }}>
                  <StonkOptionsChain
                    symbol={selectedStock}
                    currentPrice={prices[selectedStock]}
                    selectedExpiry={selectedExpiry}
                    selectedStrike={selectedStrike}
                    onSelectStrike={handleSelectStrike}
                  />
                </div>
              </>
            )}

            {!selectedStock && (
              <div style={{
                marginTop: 20,
                padding: 40,
                background: '#0d1117',
                borderRadius: 12,
                textAlign: 'center',
                border: '1px solid #1f2937'
              }}>
                <TrendingUp size={48} color="#374151" style={{ marginBottom: 16 }} />
                <div style={{ color: '#6b7280', fontSize: 16 }}>
                  Select a stock above to view options
                </div>
              </div>
            )}

            {/* Mobile Order Entry (shows below chain on mobile) */}
            {isMobile && showOrder && selectedStrike && (
              <div style={{ marginTop: 16 }}>
                <StonkOptionsOrder
                  selection={selectedStrike}
                  maxBudget={virtualCash}
                  onConfirm={handleConfirmOrder}
                  onCancel={() => {
                    setSelectedStrike(null);
                    setShowOrder(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Order Entry (desktop only) */}
          {!isMobile && showOrder && selectedStrike && (
            <div style={{ position: 'sticky', top: 180, alignSelf: 'flex-start' }}>
              <StonkOptionsOrder
                selection={selectedStrike}
                maxBudget={virtualCash}
                onConfirm={handleConfirmOrder}
                onCancel={() => {
                  setSelectedStrike(null);
                  setShowOrder(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Positions Section */}
        {contracts.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <button
              onClick={() => setShowPositions(!showPositions)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: '#0d1117',
                border: '1px solid #1f2937',
                borderRadius: showPositions ? '12px 12px 0 0' : '12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: '600'
              }}
            >
              <span>
                Your Positions ({contracts.length})
                <span style={{
                  marginLeft: 12,
                  fontSize: 14,
                  color: portfolio.summary.totalPL >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {portfolio.summary.totalPL >= 0 ? '+' : ''}
                  ${portfolio.summary.totalPL.toFixed(2)}
                </span>
              </span>
              {showPositions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showPositions && (
              <div style={{
                padding: 16,
                background: '#0d1117',
                border: '1px solid #1f2937',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 16
                }}>
                  {portfolio.contracts.map(contract => (
                    <StonkOptionsPosition
                      key={contract.id}
                      contract={contract}
                      currentPrice={prices[contract.symbol]}
                      onClose={handleSellPosition}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {contracts.length === 0 && selectedStock && (
          <div style={{
            marginTop: 32,
            padding: 32,
            background: '#0d1117',
            borderRadius: 12,
            textAlign: 'center',
            border: '1px dashed #374151'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ color: '#9ca3af', marginBottom: 8 }}>No positions yet</div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>
              Select a strike from the options chain to place your first trade
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        background: '#0d1117',
        borderTop: '1px solid #1f2937',
        marginTop: 32
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#6b7280',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          <span>This is a simulation. No real money involved.</span>
        </div>
      </div>
    </div>
  );
};

export default StonkOptionsArenaV2;
