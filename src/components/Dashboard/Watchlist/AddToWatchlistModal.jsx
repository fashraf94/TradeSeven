import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { STOCKS, CRYPTO } from '../../../data/assets';
import { useIsMobile } from '../../../hooks/useIsMobile';

const MAX_WATCHLIST_SIZE = 30;

export default function AddToWatchlistModal({
  isOpen,
  onClose,
  currentSymbols = [],
  onAdd,
  onRemove,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('stocks');
  const { isMobile } = useIsMobile();

  const filteredAssets = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const list = activeTab === 'stocks' ? STOCKS : CRYPTO;

    if (!query) return list;
    return list.filter(a =>
      a.symbol.toLowerCase().includes(query) ||
      a.name.toLowerCase().includes(query)
    );
  }, [searchQuery, activeTab]);

  const isAtMax = currentSymbols.length >= MAX_WATCHLIST_SIZE;

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 10000,
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isMobile ? 0 : '16px',
        }}
      >
        <motion.div
          initial={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
          animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1 }}
          exit={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: isMobile ? '16px 16px 0 0' : '12px',
            width: isMobile ? '100%' : '100%',
            maxWidth: isMobile ? '100%' : '480px',
            maxHeight: isMobile ? '85vh' : '70vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #21262d',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#e6edf3',
              }}>
                Add to Watchlist
              </h3>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                {'\u2715'}
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by symbol or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '8px',
                color: '#e6edf3',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '10px',
            }}>
              {['stocks', 'crypto'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: activeTab === tab ? '1px solid #9333ea' : '1px solid #21262d',
                    background: activeTab === tab ? 'rgba(147, 51, 234, 0.2)' : '#161b22',
                    color: activeTab === tab ? '#c084fc' : '#8b949e',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab} ({tab === 'stocks' ? STOCKS.length : CRYPTO.length})
                </button>
              ))}
            </div>

            {isAtMax && (
              <div style={{
                marginTop: '8px',
                padding: '6px 10px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#f59e0b',
              }}>
                Max {MAX_WATCHLIST_SIZE} symbols reached. Remove some to add more.
              </div>
            )}
          </div>

          {/* Asset List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
            {filteredAssets.length === 0 && (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#6e7681',
                fontSize: '13px',
              }}>
                No results for &quot;{searchQuery}&quot;
              </div>
            )}

            {filteredAssets.map(asset => {
              const isAdded = currentSymbols.includes(asset.symbol);
              return (
                <div
                  key={asset.symbol}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#e6edf3',
                    }}>
                      {asset.symbol}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#6e7681',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {asset.name}
                      {asset.sector && (
                        <span style={{ marginLeft: '6px', color: '#8b949e' }}>
                          {'\u00B7'} {asset.sector}
                        </span>
                      )}
                      {asset.category && (
                        <span style={{ marginLeft: '6px', color: '#8b949e' }}>
                          {'\u00B7'} {asset.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {isAdded ? (
                    <button
                      onClick={() => onRemove(asset.symbol)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10b981',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {'\u2713'} Added
                    </button>
                  ) : (
                    <button
                      onClick={() => !isAtMax && onAdd(asset.symbol)}
                      disabled={isAtMax}
                      style={{
                        background: isAtMax ? '#161b22' : 'rgba(147, 51, 234, 0.2)',
                        border: isAtMax ? '1px solid #21262d' : '1px solid #9333ea',
                        color: isAtMax ? '#6e7681' : '#c084fc',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: isAtMax ? 'not-allowed' : 'pointer',
                        flexShrink: 0,
                        opacity: isAtMax ? 0.5 : 1,
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid #21262d',
            fontSize: '11px',
            color: '#6e7681',
            textAlign: 'center',
          }}>
            {currentSymbols.length} / {MAX_WATCHLIST_SIZE} symbols
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
