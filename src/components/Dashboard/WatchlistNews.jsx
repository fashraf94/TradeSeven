// /src/components/Dashboard/WatchlistNews.jsx

import React, { useState, useEffect } from 'react';
import { getMultipleStockNews } from '../../services/eodhdAPI';

// Predefined stock list for watchlist search
const SEARCHABLE_STOCKS = [
  // Tech
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Tech' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Tech' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Tech' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Tech' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Tech' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Tech' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Tech' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Tech' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Tech' },
  { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Tech' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Tech' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Tech' },
  { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Tech' },
  { symbol: 'CSCO', name: 'Cisco Systems', sector: 'Tech' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Tech' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Tech' },
  { symbol: 'IBM', name: 'IBM Corporation', sector: 'Tech' },
  { symbol: 'NOW', name: 'ServiceNow Inc.', sector: 'Tech' },
  { symbol: 'UBER', name: 'Uber Technologies', sector: 'Tech' },
  { symbol: 'SNAP', name: 'Snap Inc.', sector: 'Tech' },
  { symbol: 'XYZ', name: 'Block Inc.', sector: 'Tech' },
  { symbol: 'SHOP', name: 'Shopify Inc.', sector: 'Tech' },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Tech' },
  // Finance
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Finance' },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Finance' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Finance' },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Finance' },
  { symbol: 'WFC', name: 'Wells Fargo', sector: 'Finance' },
  { symbol: 'C', name: 'Citigroup Inc.', sector: 'Finance' },
  { symbol: 'AXP', name: 'American Express', sector: 'Finance' },
  { symbol: 'MS', name: 'Morgan Stanley', sector: 'Finance' },
  { symbol: 'BLK', name: 'BlackRock Inc.', sector: 'Finance' },
  { symbol: 'PYPL', name: 'PayPal Holdings', sector: 'Finance' },
  // Healthcare
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck & Co.', sector: 'Healthcare' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare' },
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare' },
  { symbol: 'TMO', name: 'Thermo Fisher', sector: 'Healthcare' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb', sector: 'Healthcare' },
  { symbol: 'MRNA', name: 'Moderna Inc.', sector: 'Healthcare' },
  // Consumer
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer' },
  { symbol: 'HD', name: 'Home Depot', sector: 'Consumer' },
  { symbol: 'MCD', name: "McDonald's Corp.", sector: 'Consumer' },
  { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer' },
  { symbol: 'SBUX', name: 'Starbucks Corp.', sector: 'Consumer' },
  { symbol: 'TGT', name: 'Target Corporation', sector: 'Consumer' },
  { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer' },
  { symbol: 'LOW', name: "Lowe's Companies", sector: 'Consumer' },
  { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Consumer' },
  { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer' },
  // Energy
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron Corp.', sector: 'Energy' },
  { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy' },
  { symbol: 'OXY', name: 'Occidental Petroleum', sector: 'Energy' },
  // Industrial
  { symbol: 'BA', name: 'Boeing Co.', sector: 'Industrial' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrial' },
  { symbol: 'UPS', name: 'United Parcel Service', sector: 'Industrial' },
  { symbol: 'HON', name: 'Honeywell International', sector: 'Industrial' },
  { symbol: 'GE', name: 'General Electric', sector: 'Industrial' },
  // Crypto
  { symbol: 'BTC', name: 'Bitcoin', sector: 'Crypto' },
  { symbol: 'ETH', name: 'Ethereum', sector: 'Crypto' },
  { symbol: 'SOL', name: 'Solana', sector: 'Crypto' },
];

const POPULAR_SUGGESTIONS = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META'];

/**
 * WatchlistNews - Displays personalized news for user's watchlist stocks
 * Shows news about stocks the user has shown interest in
 *
 * @param {Object} props
 * @param {Object} props.colors - Design tokens
 */
const WatchlistNews = ({ colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  const [watchlistNews, setWatchlistNews] = useState([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasWatchlist, setHasWatchlist] = useState(true);

  // Modal state
  const [showManageModal, setShowManageModal] = useState(false);
  const [editableWatchlist, setEditableWatchlist] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Default popular stocks as fallback
  const DEFAULT_WATCHLIST = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'MSFT', 'AMZN'];

  // LocalStorage key for custom watchlist
  const WATCHLIST_STORAGE_KEY = 'user_watchlist';

  // Get custom watchlist from localStorage
  const getCustomWatchlist = () => {
    try {
      const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[Watchlist] Error reading custom watchlist:', e);
    }
    return null;
  };

  // Save custom watchlist to localStorage
  const saveCustomWatchlist = (symbols) => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
    } catch (e) {
      console.warn('[Watchlist] Error saving custom watchlist:', e);
    }
  };

  // Get watchlist symbols from various sources
  const getWatchlistSymbols = () => {
    // First check for custom watchlist
    const customWatchlist = getCustomWatchlist();
    if (customWatchlist && customWatchlist.length > 0) {
      setHasWatchlist(true);
      return customWatchlist.slice(0, 8);
    }

    const symbols = new Set();

    // 1. Check portfolio templates (user's saved portfolios)
    try {
      const templates = JSON.parse(localStorage.getItem('portfolio_templates') || '[]');
      templates.forEach(template => {
        if (template.assets) {
          template.assets.forEach(asset => {
            if (asset.symbol && asset.type !== 'crypto') {
              symbols.add(asset.symbol.toUpperCase());
            }
          });
        }
      });
    } catch (e) {
      console.warn('[Watchlist] Error reading portfolio templates:', e);
    }

    // 2. Check for user-specific portfolio templates
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('portfolioTemplates_')) {
          const userTemplates = JSON.parse(localStorage.getItem(key) || '[]');
          userTemplates.forEach(template => {
            if (template.assets) {
              template.assets.forEach(asset => {
                if (asset.symbol && asset.type !== 'crypto') {
                  symbols.add(asset.symbol.toUpperCase());
                }
              });
            }
          });
        }
      });
    } catch (e) {
      console.warn('[Watchlist] Error reading user portfolio templates:', e);
    }

    // 3. Check recent battle data for stocks user has picked
    try {
      const battles = JSON.parse(localStorage.getItem('portfolioDuelBattles') || '[]');
      (Array.isArray(battles) ? battles : []).slice(0, 5).forEach(battle => {
        const portfolio = battle.player1?.portfolio;
        if (Array.isArray(portfolio)) {
          portfolio.forEach(asset => {
            if (asset?.symbol && asset.type !== 'crypto') {
              symbols.add(asset.symbol.toUpperCase());
            }
          });
        }
      });
    } catch (e) {
      console.warn('[Watchlist] Error reading battle data:', e);
    }

    const symbolArray = Array.from(symbols);

    // If no user symbols found, use defaults
    if (symbolArray.length === 0) {
      setHasWatchlist(false);
      return DEFAULT_WATCHLIST;
    }

    setHasWatchlist(true);
    return symbolArray.slice(0, 8);
  };

  // Fetch news for watchlist symbols
  useEffect(() => {
    const fetchWatchlistNews = async () => {
      setIsLoading(true);

      try {
        const symbols = getWatchlistSymbols();
        setWatchlistSymbols(symbols);

        // Fetch news for all symbols
        const newsMap = await getMultipleStockNews(symbols, 2);

        // Flatten and dedupe news items, attach symbol info
        const allNews = [];
        const seenTitles = new Set();

        symbols.forEach(symbol => {
          const symbolNews = newsMap[symbol] || [];
          symbolNews.forEach(item => {
            // Dedupe by title
            if (!seenTitles.has(item.title)) {
              seenTitles.add(item.title);
              allNews.push({
                ...item,
                watchlistSymbol: symbol, // Track which watchlist symbol this is for
              });
            }
          });
        });

        // Sort by date (most recent first) and take top 5
        allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        setWatchlistNews(allNews.slice(0, 5));

      } catch (err) {
        console.warn('[Watchlist] Failed to fetch news:', err);
        setWatchlistNews([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchlistNews();
  }, [refreshKey]);

  // Format time ago
  const getTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Get display source (clean up source name)
  const getDisplaySource = (item) => {
    const source = item.source;
    if (!source || source === 'Unknown' || source.toLowerCase() === 'unknown') {
      if (item.url) {
        try {
          const hostname = new URL(item.url).hostname.replace('www.', '');
          const parts = hostname.split('.');
          if (parts.length >= 2) {
            const name = parts[parts.length - 2];
            return name.charAt(0).toUpperCase() + name.slice(1);
          }
        } catch {
          return 'News';
        }
      }
      return 'News';
    }
    return source;
  };

  // Open manage modal
  const openManageModal = () => {
    // Initialize editable list with current watchlist
    const customWatchlist = getCustomWatchlist();
    if (customWatchlist && customWatchlist.length > 0) {
      setEditableWatchlist([...customWatchlist]);
    } else {
      setEditableWatchlist([...watchlistSymbols]);
    }
    setSearchQuery('');
    setShowManageModal(true);
  };

  // Close manage modal and refresh
  const closeManageModal = (shouldSave = true) => {
    if (shouldSave && editableWatchlist.length > 0) {
      saveCustomWatchlist(editableWatchlist);
      setRefreshKey(prev => prev + 1); // Trigger news refresh
    }
    setShowManageModal(false);
    setSearchQuery('');
  };

  // Remove stock from editable watchlist
  const removeFromWatchlist = (symbol) => {
    setEditableWatchlist(prev => prev.filter(s => s !== symbol));
  };

  // Add stock to editable watchlist
  const addToWatchlist = (symbol) => {
    if (!editableWatchlist.includes(symbol) && editableWatchlist.length < 12) {
      setEditableWatchlist(prev => [...prev, symbol]);
      setSearchQuery('');
    }
  };

  // Filter stocks based on search
  const getFilteredStocks = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return SEARCHABLE_STOCKS
      .filter(stock =>
        !editableWatchlist.includes(stock.symbol) &&
        (stock.symbol.toLowerCase().includes(query) ||
         stock.name.toLowerCase().includes(query))
      )
      .slice(0, 6);
  };

  // Render edit button
  const renderEditButton = () => (
    <button
      onClick={openManageModal}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        marginLeft: 'auto',
      }}
      title="Manage Watchlist"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6e7681" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  // Render manage modal
  const renderManageModal = () => {
    if (!showManageModal) return null;

    const filteredStocks = getFilteredStocks();

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={() => closeManageModal(true)}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
        <div
          style={{
            background: '#1a1f2e',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid #2d3548',
            animation: 'slideUp 0.3s ease-out',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: '#e6edf3', fontSize: '18px', fontWeight: '600', margin: 0 }}>
              Manage Your Watchlist
            </h2>
            <button
              onClick={() => closeManageModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6e7681',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ×
            </button>
          </div>

          {/* Current Watchlist */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
              Current Stocks ({editableWatchlist.length}/12)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '40px' }}>
              {editableWatchlist.length === 0 ? (
                <span style={{ color: '#6e7681', fontSize: '13px', fontStyle: 'italic' }}>
                  No stocks in watchlist
                </span>
              ) : (
                editableWatchlist.map(symbol => (
                  <div
                    key={symbol}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: `${c.cyan}20`,
                      border: `1px solid ${c.cyan}40`,
                      borderRadius: '6px',
                      padding: '6px 10px',
                    }}
                  >
                    <span style={{ color: c.cyan, fontSize: '13px', fontWeight: '600' }}>
                      {symbol}
                    </span>
                    <button
                      onClick={() => removeFromWatchlist(symbol)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6e7681',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '0',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Search Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
              Add Stocks
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stocks to add..."
              style={{
                width: '100%',
                padding: '12px',
                background: '#161b22',
                border: '1px solid #2d3548',
                borderRadius: '8px',
                color: '#e6edf3',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Search Results */}
            {filteredStocks.length > 0 && (
              <div style={{
                marginTop: '8px',
                background: '#161b22',
                border: '1px solid #2d3548',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                {filteredStocks.map(stock => (
                  <div
                    key={stock.symbol}
                    onClick={() => addToWatchlist(stock.symbol)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #2d3548',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#2d3548'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ color: c.cyan, fontSize: '13px', fontWeight: '600' }}>{stock.symbol}</span>
                        <span style={{ color: '#8b949e', fontSize: '12px', marginLeft: '8px' }}>{stock.name}</span>
                      </div>
                      <span style={{ color: '#6e7681', fontSize: '11px' }}>{stock.sector}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Popular Suggestions */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: '#6e7681', fontSize: '11px', marginBottom: '8px', display: 'block' }}>
              Popular:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {POPULAR_SUGGESTIONS.filter(s => !editableWatchlist.includes(s)).map(symbol => (
                <button
                  key={symbol}
                  onClick={() => addToWatchlist(symbol)}
                  style={{
                    background: '#161b22',
                    border: '1px solid #2d3548',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#8b949e',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = c.cyan;
                    e.currentTarget.style.color = c.cyan;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2d3548';
                    e.currentTarget.style.color = '#8b949e';
                  }}
                >
                  + {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Done Button */}
          <button
            onClick={() => closeManageModal(true)}
            style={{
              width: '100%',
              padding: '14px',
              background: `linear-gradient(135deg, ${c.cyan}, ${c.green})`,
              border: 'none',
              borderRadius: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = `0 4px 16px ${c.cyan}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>⭐</span> Your Watchlist
          {renderEditButton()}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: '#161b22',
              borderRadius: '8px',
              padding: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ height: '14px', background: '#2d3548', borderRadius: '4px', width: '80%', marginBottom: '8px' }} />
              <div style={{ height: '12px', background: '#2d3548', borderRadius: '4px', width: '40%' }} />
            </div>
          ))}
        </div>
        {renderManageModal()}
      </div>
    );
  }

  // Empty watchlist state
  if (!hasWatchlist && watchlistNews.length === 0) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>⭐</span> Your Watchlist
          {renderEditButton()}
        </h3>
        <div style={{
          background: '#161b22',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
          <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>
            Add stocks to your watchlist to see personalized news
          </p>
          <button
            onClick={openManageModal}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              background: `${c.cyan}20`,
              border: `1px solid ${c.cyan}`,
              borderRadius: '6px',
              color: c.cyan,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            + Add Stocks
          </button>
        </div>
        {renderManageModal()}
      </div>
    );
  }

  // No news available
  if (watchlistNews.length === 0) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>⭐</span> Your Watchlist
          {renderEditButton()}
        </h3>
        <div style={{
          background: '#161b22',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <span style={{ color: '#8b949e', fontSize: '13px' }}>
            No recent news for your watchlist stocks
          </span>
        </div>
        {renderManageModal()}
      </div>
    );
  }

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid #2d3548',
    }}>
      <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '14px' }}>⭐</span> Your Watchlist
        {renderEditButton()}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {watchlistNews.map((item, idx) => (
          <div
            key={item.id || idx}
            style={{
              background: '#161b22',
              borderRadius: '8px',
              padding: '12px',
              cursor: item.url && item.url !== '#' ? 'pointer' : 'default',
              transition: 'all 0.2s',
              borderLeft: `3px solid ${idx === 0 ? c.cyan : '#2d3548'}`,
            }}
            onClick={() => item.url && item.url !== '#' && window.open(item.url, '_blank')}
          >
            {/* Ticker badge */}
            <div style={{ marginBottom: '6px' }}>
              <span
                style={{
                  display: 'inline-block',
                  background: `${c.cyan}20`,
                  color: c.cyan,
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                ${item.watchlistSymbol || (item.symbols && item.symbols[0]) || 'NEWS'}
              </span>
            </div>

            {/* Headline */}
            <div style={{
              color: '#e6edf3',
              fontSize: '13px',
              lineHeight: '1.4',
              marginBottom: '6px',
              fontWeight: idx === 0 ? '500' : '400',
            }}>
              {item.title}
            </div>

            {/* Source and time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#6e7681', fontSize: '11px' }}>{getDisplaySource(item)}</span>
              <span style={{ color: '#6e7681', fontSize: '11px' }}>•</span>
              <span style={{ color: '#6e7681', fontSize: '11px' }}>{getTimeAgo(item.publishedAt)}</span>
            </div>
          </div>
        ))}
      </div>
      {renderManageModal()}
    </div>
  );
};

export default WatchlistNews;
