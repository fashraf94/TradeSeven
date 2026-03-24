import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ArrowUpDown } from 'lucide-react';
import cacheService from '../../services/cacheService';

const SECTOR_ETFS = [
  { name: 'Technology', symbol: 'XLK', color: '#3b82f6' },
  { name: 'Healthcare', symbol: 'XLV', color: '#10b981' },
  { name: 'Financials', symbol: 'XLF', color: '#f59e0b' },
  { name: 'Energy', symbol: 'XLE', color: '#ef4444' },
  { name: 'Consumer Disc.', symbol: 'XLY', color: '#8b5cf6' },
  { name: 'Consumer Stpl.', symbol: 'XLP', color: '#06b6d4' },
  { name: 'Industrials', symbol: 'XLI', color: '#6366f1' },
  { name: 'Materials', symbol: 'XLB', color: '#84cc16' },
  { name: 'Utilities', symbol: 'XLU', color: '#f97316' },
  { name: 'Real Estate', symbol: 'XLRE', color: '#ec4899' },
  { name: 'Communication', symbol: 'XLC', color: '#14b8a6' },
];

const BENCHMARK = { name: 'S&P 500', symbol: 'SPY', color: '#5eead4' };

const TIMEFRAMES = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1Y' },
];

// ETF full names for Research Modal
const ETF_NAMES = {
  XLK: 'Technology Select Sector SPDR',
  XLV: 'Health Care Select Sector SPDR',
  XLF: 'Financial Select Sector SPDR',
  XLE: 'Energy Select Sector SPDR',
  XLY: 'Consumer Discretionary Select Sector SPDR',
  XLP: 'Consumer Staples Select Sector SPDR',
  XLI: 'Industrial Select Sector SPDR',
  XLB: 'Materials Select Sector SPDR',
  XLU: 'Utilities Select Sector SPDR',
  XLRE: 'Real Estate Select Sector SPDR',
  XLC: 'Communication Services Select Sector SPDR',
  SPY: 'SPDR S&P 500 ETF Trust',
};

function computeReturns(prices) {
  if (!prices || prices.length < 2) return {};
  const current = prices[prices.length - 1]?.adjusted_close || prices[prices.length - 1]?.close;
  if (!current) return {};

  const getReturn = (daysAgo) => {
    const idx = Math.max(0, prices.length - 1 - daysAgo);
    const past = prices[idx]?.adjusted_close || prices[idx]?.close;
    if (!past) return null;
    return Math.round(((current - past) / past) * 10000) / 100;
  };

  return {
    '3m': getReturn(63),
    '1y': getReturn(252),
  };
}

// Skeleton row for loading state
function SkeletonRow({ tokens }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 10px', borderBottom: `0.5px solid ${tokens.borderDefault}`,
    }}>
      <div style={{ width: 90, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ flex: 1 }} />
      <div style={{ width: 50, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  );
}

function ReturnCell({ value, tokens }) {
  if (value == null) {
    return (
      <span style={{ fontSize: '12px', color: tokens.textFaint, fontVariantNumeric: 'tabular-nums' }}>—</span>
    );
  }

  const isPositive = value >= 0;
  const color = isPositive ? '#10b981' : '#ef4444';
  const bgAlpha = Math.min(Math.abs(value) * 0.02, 0.15);
  const bg = isPositive
    ? `rgba(16, 185, 129, ${bgAlpha})`
    : `rgba(239, 68, 68, ${bgAlpha})`;

  return (
    <span style={{
      fontSize: '12px',
      fontWeight: 600,
      color,
      background: bg,
      padding: '2px 6px',
      borderRadius: 4,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }}>
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

const SectorPerformanceTable = ({ marketContext, onOpenResearch, isMobile, tokens }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');
  const [sortKey, setSortKey] = useState('1d');
  const [sortAsc, setSortAsc] = useState(false);
  const [extendedReturns, setExtendedReturns] = useState({}); // { XLK: { '3m': 5.2, '1y': 18.4 }, ... }
  const [loadingExtended, setLoadingExtended] = useState(false);

  // Build sector data from Firestore sectorSnapshot (1D/1W/1M)
  const snapshotMap = useMemo(() => {
    const map = {};
    const snapshot = marketContext?.sectorSnapshot;
    if (!Array.isArray(snapshot)) return map;
    snapshot.forEach(s => {
      map[s.etf] = {
        '1d': s.changePercent ?? null,
        '1w': s.weekChange ?? null,
        '1m': s.monthChange ?? null,
      };
    });
    return map;
  }, [marketContext]);

  // Fetch extended returns (3M/1Y) from historical API
  const fetchExtendedReturns = useCallback(async () => {
    const allSymbols = [...SECTOR_ETFS.map(s => s.symbol), BENCHMARK.symbol];
    const results = {};

    // Check cache first
    const uncached = [];
    allSymbols.forEach(sym => {
      const cached = cacheService.get('historical', `${sym}_sector_perf`);
      if (cached) {
        results[sym] = cached;
      } else {
        uncached.push(sym);
      }
    });

    if (uncached.length === 0) {
      setExtendedReturns(results);
      return;
    }

    setLoadingExtended(true);

    // Fetch historical data for uncached symbols (batch 3 at a time to avoid rate limits)
    for (let i = 0; i < uncached.length; i += 3) {
      const batch = uncached.slice(i, i + 3);
      const fetches = batch.map(async (sym) => {
        try {
          const res = await fetch(`/api/stocks/prices?symbols=${encodeURIComponent(sym)}&type=historical&days=365`);
          if (!res.ok) return { sym, data: {} };
          const json = await res.json();
          if (!json.success) return { sym, data: {} };
          const returns = computeReturns(json.data || []);
          return { sym, data: returns };
        } catch {
          return { sym, data: {} };
        }
      });

      const batchResults = await Promise.all(fetches);
      batchResults.forEach(({ sym, data }) => {
        results[sym] = data;
        if (data && Object.keys(data).length > 0) {
          cacheService.set('historical', `${sym}_sector_perf`, data);
        }
      });
    }

    setExtendedReturns(results);
    setLoadingExtended(false);
  }, []);

  useEffect(() => {
    fetchExtendedReturns();
  }, [fetchExtendedReturns]);

  // Merge snapshot + extended returns for each sector
  const sectorRows = useMemo(() => {
    const allEntries = [...SECTOR_ETFS, BENCHMARK];
    return allEntries.map(entry => {
      const snap = snapshotMap[entry.symbol] || {};
      const ext = extendedReturns[entry.symbol] || {};
      return {
        ...entry,
        isBenchmark: entry.symbol === BENCHMARK.symbol,
        returns: {
          '1d': snap['1d'] ?? null,
          '1w': snap['1w'] ?? null,
          '1m': snap['1m'] ?? null,
          '3m': ext['3m'] ?? null,
          '1y': ext['1y'] ?? null,
        },
      };
    });
  }, [snapshotMap, extendedReturns]);

  // Sort
  const sortedRows = useMemo(() => {
    const sectors = sectorRows.filter(r => !r.isBenchmark);
    const benchmark = sectorRows.find(r => r.isBenchmark);

    sectors.sort((a, b) => {
      const aVal = a.returns[sortKey] ?? -Infinity;
      const bVal = b.returns[sortKey] ?? -Infinity;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return benchmark ? [...sectors, benchmark] : sectors;
  }, [sectorRows, sortKey, sortAsc]);

  const handleHeaderClick = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleRowTap = (row) => {
    onOpenResearch({
      symbol: row.symbol,
      name: ETF_NAMES[row.symbol] || row.name,
      sector: row.name,
      price: 0,
      percentChange: row.returns['1d'] || 0,
      change: 0,
    });
  };

  const hasData = Object.keys(snapshotMap).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.3 }}
      style={{
        borderRadius: 14,
        background: tokens.bgCard,
        boxShadow: tokens.obsidianShadow,
        border: `0.5px solid ${tokens.borderDefault}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 14px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={14} color={tokens.teal} />
          <span style={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>
            Sector Performance
          </span>
        </div>
      </div>

      {/* Timeframe Pills */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '10px 14px',
      }}>
        {TIMEFRAMES.map(tf => {
          const isActive = selectedTimeframe === tf.key;
          return (
            <button
              key={tf.key}
              onClick={() => {
                setSelectedTimeframe(tf.key);
                setSortKey(tf.key);
                setSortAsc(false);
              }}
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'inherit',
                background: isActive ? 'rgba(94,234,212,0.15)' : 'rgba(255,255,255,0.04)',
                color: isActive ? tokens.teal : tokens.textMuted,
                transition: 'all 0.15s',
              }}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {!hasData ? (
        // Loading skeleton
        <div style={{ padding: '0 14px 14px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} tokens={tokens} />
          ))}
        </div>
      ) : isMobile ? (
        // Mobile: compact layout — sector name + selected timeframe
        <div style={{ padding: '0 14px 14px' }}>
          {sortedRows.map((row, i) => (
            <div
              key={row.symbol}
              onClick={() => handleRowTap(row)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 8px',
                cursor: 'pointer',
                borderTop: row.isBenchmark ? '1px solid rgba(94,234,212,0.15)' : undefined,
                borderBottom: !row.isBenchmark ? `0.5px solid ${tokens.borderDefault}` : undefined,
                background: row.isBenchmark ? 'rgba(94,234,212,0.03)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 4, height: 20, borderRadius: 2,
                  background: row.color, flexShrink: 0,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: row.isBenchmark ? tokens.teal : tokens.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.name}
                  </div>
                  <div style={{ fontSize: 10, color: tokens.textFaint }}>{row.symbol}</div>
                </div>
              </div>
              <ReturnCell value={row.returns[selectedTimeframe]} tokens={tokens} />
            </div>
          ))}
        </div>
      ) : (
        // Desktop: full table with all timeframes
        <div style={{ padding: '0 14px 14px', overflowX: 'auto' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 50px repeat(5, 1fr)',
            gap: 4,
            padding: '6px 8px',
            borderBottom: `1px solid ${tokens.borderDefault}`,
            marginBottom: 2,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: tokens.textFaint, textTransform: 'uppercase' }}>
              Sector
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: tokens.textFaint, textTransform: 'uppercase' }}>
              ETF
            </span>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => handleHeaderClick(tf.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 2,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  color: sortKey === tf.key ? tokens.teal : tokens.textFaint,
                }}>
                  {tf.label}
                </span>
                {sortKey === tf.key && (
                  <ArrowUpDown size={10} color={tokens.teal} />
                )}
              </button>
            ))}
          </div>

          {/* Table rows */}
          {sortedRows.map((row) => (
            <div
              key={row.symbol}
              onClick={() => handleRowTap(row)}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 50px repeat(5, 1fr)',
                gap: 4,
                padding: '8px 8px',
                cursor: 'pointer',
                borderTop: row.isBenchmark ? '1px solid rgba(94,234,212,0.15)' : undefined,
                borderBottom: !row.isBenchmark ? `0.5px solid rgba(255,255,255,0.03)` : undefined,
                background: row.isBenchmark ? 'rgba(94,234,212,0.03)' : 'transparent',
                alignItems: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!row.isBenchmark) e.currentTarget.style.background = 'rgba(94,234,212,0.03)'; }}
              onMouseLeave={(e) => { if (!row.isBenchmark) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Sector name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 3, height: 16, borderRadius: 2,
                  background: row.color, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: row.isBenchmark ? tokens.teal : tokens.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {row.name}
                </span>
              </div>

              {/* ETF ticker */}
              <span style={{ fontSize: 11, color: tokens.textFaint, fontWeight: 500 }}>
                {row.symbol}
              </span>

              {/* Returns for each timeframe */}
              {TIMEFRAMES.map(tf => (
                <div key={tf.key} style={{ textAlign: 'right' }}>
                  {(tf.key === '3m' || tf.key === '1y') && loadingExtended && !extendedReturns[row.symbol] ? (
                    <span style={{
                      display: 'inline-block', width: 40, height: 12,
                      borderRadius: 4, background: 'rgba(255,255,255,0.05)',
                    }} />
                  ) : (
                    <ReturnCell value={row.returns[tf.key]} tokens={tokens} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default SectorPerformanceTable;
