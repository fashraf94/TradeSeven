import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { STOCKS } from '../../data/assets';

const SearchOverlay = ({ visible, onClose, onSelectStock, stocksData, isMobile }) => {
  const { tokens } = useTheme();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!visible) setQuery('');
  }, [visible]);

  // Merge STOCKS (for sector/name) with stocksData (for price/change)
  const priceMap = useMemo(() => {
    const map = {};
    (stocksData || []).forEach(s => { map[s.symbol] = s; });
    return map;
  }, [stocksData]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return STOCKS.filter(s =>
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query]);

  const handleSelect = (stock) => {
    const priceInfo = priceMap[stock.symbol] || {};
    // Save to recent searches
    try {
      const key = 'ft_recent_searches';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = [stock.symbol, ...existing.filter(s => s !== stock.symbol)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    onSelectStock({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      price: priceInfo.price || 0,
      percentChange: priceInfo.percentChange || 0,
      change: priceInfo.change || 0,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
          animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
          exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: tokens.bgApp,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            borderBottom: `1px solid ${tokens.borderDefault}`,
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: tokens.bgCard,
              borderRadius: '12px',
              padding: '10px 14px',
              border: `1px solid rgba(94,234,212,0.3)`,
            }}>
              <Search size={18} color={tokens.teal} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ticker or name..."
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: tokens.textPrimary,
                  fontSize: '15px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.textMuted,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={22} />
            </button>
          </div>

          {/* Results */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}>
            {query.trim() && results.length === 0 && (
              <div style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: tokens.textMuted,
                fontSize: '14px',
              }}>
                No stocks found for "{query}"
              </div>
            )}
            {results.map(stock => {
              const priceInfo = priceMap[stock.symbol] || {};
              const pctChange = priceInfo.percentChange || 0;
              return (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelect(stock)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `0.5px solid ${tokens.borderDefault}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    gap: '12px',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ color: tokens.textPrimary, fontWeight: 600, fontSize: '14px' }}>
                      {stock.symbol}
                    </span>
                    <span style={{ color: tokens.textMuted, fontSize: '13px', marginLeft: '8px' }}>
                      {stock.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {priceInfo.price > 0 && (
                      <div style={{ color: tokens.textPrimary, fontSize: '13px', fontWeight: 500 }}>
                        ${priceInfo.price.toFixed(2)}
                      </div>
                    )}
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: pctChange >= 0 ? '#10b981' : '#ef4444',
                    }}>
                      {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlay;
