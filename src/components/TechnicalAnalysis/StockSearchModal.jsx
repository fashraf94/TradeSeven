// src/components/TechnicalAnalysis/StockSearchModal.jsx
// Modal for searching and selecting a stock to analyze

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const StockSearchModal = ({
  isOpen,
  onClose,
  onSelectStock,
  recentSearches = [],
  popularStocks = [
    { symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', sector: 'Consumer' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc', sector: 'Consumer' },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' },
  ],
  searchStocks
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setError(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (searchStocks) {
          const results = await searchStocks(query);
          setSearchResults(results.slice(0, 10));
        } else {
          const filtered = popularStocks.filter(
            stock =>
              stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
              stock.name.toLowerCase().includes(query.toLowerCase())
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchStocks, popularStocks]);

  const handleSelectStock = (stock) => {
    onSelectStock(stock);
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '10vh',
          zIndex: 1100,
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            width: '100%',
            maxWidth: '480px',
            maxHeight: '80vh',
            backgroundColor: '#0d1117',
            borderRadius: '16px',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 255, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: '0 16px',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', margin: 0 }}>
              Analyze Stock
            </h2>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: '4px',
              }}
              onClick={onClose}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', padding: '16px 24px' }}>
            <svg
              style={{ position: 'absolute', left: '40px', top: '50%', transform: 'translateY(-50%)' }}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by ticker or company name..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                fontSize: '15px',
                color: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                outline: 'none',
              }}
            />
          </div>

          {/* Search Results */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
            {searchResults.length > 0 ? (
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '12px' }}>
                  Results
                </h3>
                {searchResults.map(stock => (
                  <motion.button
                    key={stock.symbol}
                    onClick={() => handleSelectStock(stock)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      marginBottom: '8px',
                    }}
                    whileHover={{ backgroundColor: 'rgba(0, 255, 255, 0.08)' }}
                  >
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: '600', color: '#ffffff', display: 'block' }}>
                        {stock.symbol}
                      </span>
                      <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        {stock.name}
                      </span>
                    </div>
                    {stock.sector && (
                      <span style={{
                        fontSize: '11px',
                        color: 'rgba(0, 255, 255, 0.7)',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        borderRadius: '4px',
                      }}>
                        {stock.sector}
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            ) : !searchQuery && (
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '12px' }}>
                  Popular
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {popularStocks.map(stock => (
                    <motion.button
                      key={stock.symbol}
                      onClick={() => handleSelectStock(stock)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#ffffff',
                      }}
                      whileHover={{ backgroundColor: 'rgba(0, 255, 255, 0.15)', borderColor: 'rgba(0, 255, 255, 0.5)' }}
                    >
                      {stock.symbol}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default StockSearchModal;
