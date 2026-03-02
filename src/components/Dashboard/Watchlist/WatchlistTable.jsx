import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useIsMobile } from '../../../hooks/useIsMobile';

// ============================================
// SOURCE BADGE CONFIG (for My Picks)
// ============================================

const SOURCE_COLORS = {
  BaggerBomb: { bg: 'rgba(147, 51, 234, 0.3)', label: 'BB' },
  Classic: { bg: 'rgba(0, 217, 255, 0.3)', label: '1v1' },
  'Snake Draft': { bg: 'rgba(16, 185, 129, 0.3)', label: 'SD' },
  EarningsGame: { bg: 'rgba(245, 158, 11, 0.3)', label: 'EG' },
};

// ============================================
// SORT ARROW COMPONENT
// ============================================

function SortArrow({ column, sortColumn, sortDirection }) {
  if (column !== sortColumn) return null;
  return (
    <span style={{ marginLeft: '3px', fontSize: '9px' }}>
      {sortDirection === 'asc' ? '\u25B2' : '\u25BC'}
    </span>
  );
}

// ============================================
// PRICE FORMATTER
// ============================================

function formatPrice(price) {
  if (price === null || price === undefined) return '\u2014';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatChange(change) {
  if (change === null || change === undefined || change === 0) return '\u2014';
  const sign = change > 0 ? '+' : '';
  if (Math.abs(change) >= 1) return `${sign}${change.toFixed(2)}`;
  if (Math.abs(change) >= 0.01) return `${sign}${change.toFixed(4)}`;
  return `${sign}${change.toFixed(6)}`;
}

function formatPercent(pct) {
  if (pct === null || pct === undefined || pct === 0) return '\u2014';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

// ============================================
// SINGLE TABLE ROW
// ============================================

function WatchlistRow({
  row,
  index,
  onRowTap,
  activeListId,
  onRemoveFromWatchlist,
  flashState,
  isMobile,
}) {
  const [hovered, setHovered] = useState(false);
  const changeColor = (row.changePercent || 0) > 0
    ? '#10b981'
    : (row.changePercent || 0) < 0
      ? '#ef4444'
      : '#6e7681';

  const borderColor = (row.changePercent || 0) > 0
    ? '#10b981'
    : (row.changePercent || 0) < 0
      ? '#ef4444'
      : '#21262d';

  // Flash background
  let flashBg = 'transparent';
  if (flashState === 'up') flashBg = 'rgba(16, 185, 129, 0.15)';
  else if (flashState === 'down') flashBg = 'rgba(239, 68, 68, 0.15)';

  return (
    <div
      onClick={() => onRowTap(row)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '44px',
        padding: isMobile ? '0 8px' : '0 12px',
        background: flashBg !== 'transparent'
          ? flashBg
          : (hovered ? 'rgba(147, 51, 234, 0.06)' : (index % 2 === 0 ? '#0d1117' : '#0f1318')),
        borderLeft: `3px solid ${borderColor}`,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'background 0.6s ease',
        position: 'relative',
      }}
    >
      {/* Symbol + Name column */}
      <div style={{ flex: 1.2, minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#e6edf3',
          lineHeight: 1.2,
        }}>
          {row.symbol}
          {row.isLive && (
            <span style={{
              display: 'inline-block',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#10b981',
              marginLeft: '4px',
              verticalAlign: 'middle',
            }} />
          )}
        </div>
        <div style={{
          fontSize: '10px',
          color: '#6e7681',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {row.name}
        </div>
        {/* Source badges for My Picks */}
        {activeListId === 'my-picks' && row.sources && row.sources.length > 0 && (
          <div style={{ display: 'flex', gap: '3px', marginTop: '1px' }}>
            {row.sources.map(source => {
              const config = SOURCE_COLORS[source] || { bg: 'rgba(139, 92, 246, 0.3)', label: source.slice(0, 2) };
              return (
                <span
                  key={source}
                  style={{
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    background: config.bg,
                    color: '#e6edf3',
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {config.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Last price */}
      <div style={{
        flex: 1,
        textAlign: 'right',
        fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '13px',
        fontWeight: 600,
        color: '#e6edf3',
      }}>
        {formatPrice(row.price)}
      </div>

      {/* Change */}
      <div style={{
        flex: 0.8,
        textAlign: 'right',
        fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '12px',
        color: changeColor,
      }}>
        {formatChange(row.change)}
      </div>

      {/* % Change */}
      <div style={{
        flex: 0.8,
        textAlign: 'right',
        fontFamily: 'SF Mono, Monaco, Consolas, monospace',
        fontSize: '12px',
        fontWeight: 700,
        color: changeColor,
      }}>
        {formatPercent(row.changePercent)}
      </div>

      {/* Remove button for custom list */}
      {onRemoveFromWatchlist && (hovered || isMobile) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromWatchlist(row.symbol);
          }}
          style={{
            position: isMobile ? 'relative' : 'absolute',
            right: isMobile ? 0 : '4px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: 'none',
            color: '#ef4444',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            lineHeight: 1,
            flexShrink: 0,
            marginLeft: isMobile ? '4px' : 0,
          }}
        >
          \u2715
        </button>
      )}
    </div>
  );
}

// ============================================
// EMPTY STATES
// ============================================

function EmptyState({ activeListId, onAddStocks }) {
  if (activeListId === 'custom') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '32px', marginBottom: '12px' }}>{'\u2B50'}</span>
        <div style={{ fontSize: '14px', color: '#8b949e', marginBottom: '4px' }}>
          Your watchlist is empty
        </div>
        <div style={{ fontSize: '12px', color: '#6e7681', marginBottom: '16px' }}>
          Tap + to add stocks
        </div>
        <button
          onClick={onAddStocks}
          style={{
            background: 'rgba(147, 51, 234, 0.2)',
            border: '1px solid #9333ea',
            color: '#c084fc',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Stocks
        </button>
      </div>
    );
  }

  if (activeListId === 'my-picks') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '32px', marginBottom: '12px' }}>{'\u2694\uFE0F'}</span>
        <div style={{ fontSize: '14px', color: '#8b949e', marginBottom: '4px' }}>
          No active picks yet
        </div>
        <div style={{ fontSize: '12px', color: '#6e7681' }}>
          Start a game to see your picks here
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      color: '#6e7681',
      fontSize: '13px',
    }}>
      No data available
    </div>
  );
}

// ============================================
// MAIN TABLE COMPONENT
// ============================================

export default function WatchlistTable({
  rows,
  sortColumn,
  sortDirection,
  onSort,
  onRowTap,
  activeListId,
  onRemoveFromWatchlist,
  onAddStocks,
  wsPrices = {},
}) {
  const { isMobile } = useIsMobile();
  const prevPricesRef = useRef({});
  const [flashStates, setFlashStates] = useState({});

  // Track price changes for flash animation
  useEffect(() => {
    const prev = prevPricesRef.current;
    const newFlashes = {};
    let hasFlashes = false;

    Object.entries(wsPrices).forEach(([sym, price]) => {
      if (prev[sym] !== undefined && prev[sym] !== price) {
        newFlashes[sym] = price > prev[sym] ? 'up' : 'down';
        hasFlashes = true;
      }
    });

    prevPricesRef.current = { ...wsPrices };

    if (hasFlashes) {
      setFlashStates(newFlashes);
      // Clear flashes after animation
      const timeout = setTimeout(() => setFlashStates({}), 600);
      return () => clearTimeout(timeout);
    }
  }, [wsPrices]);

  const handleColumnClick = useCallback((col) => {
    onSort(col);
  }, [onSort]);

  if (rows.length === 0) {
    return <EmptyState activeListId={activeListId} onAddStocks={onAddStocks} />;
  }

  const headerStyle = {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6e7681',
    fontWeight: 600,
    cursor: 'pointer',
    userSelect: 'none',
    padding: '6px 0',
  };

  return (
    <div style={{
      maxHeight: '50vh',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Column Headers (sticky) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 8px' : '0 12px',
        paddingLeft: isMobile ? '11px' : '15px', // account for 3px border
        background: '#0a0e14',
        position: 'sticky',
        top: 0,
        zIndex: 1,
        borderBottom: '1px solid #21262d',
      }}>
        <div
          style={{ ...headerStyle, flex: 1.2, textAlign: 'left' }}
          onClick={() => handleColumnClick('symbol')}
        >
          Symbol <SortArrow column="symbol" sortColumn={sortColumn} sortDirection={sortDirection} />
        </div>
        <div
          style={{ ...headerStyle, flex: 1, textAlign: 'right' }}
          onClick={() => handleColumnClick('price')}
        >
          Last <SortArrow column="price" sortColumn={sortColumn} sortDirection={sortDirection} />
        </div>
        <div
          style={{ ...headerStyle, flex: 0.8, textAlign: 'right' }}
          onClick={() => handleColumnClick('change')}
        >
          Chg <SortArrow column="change" sortColumn={sortColumn} sortDirection={sortDirection} />
        </div>
        <div
          style={{ ...headerStyle, flex: 0.8, textAlign: 'right' }}
          onClick={() => handleColumnClick('changePercent')}
        >
          %Chg <SortArrow column="changePercent" sortColumn={sortColumn} sortDirection={sortDirection} />
        </div>
        {/* Spacer for remove button on custom list */}
        {onRemoveFromWatchlist && isMobile && (
          <div style={{ width: '30px', flexShrink: 0 }} />
        )}
      </div>

      {/* Table Rows */}
      {rows.map((row, index) => (
        <WatchlistRow
          key={row.symbol}
          row={row}
          index={index}
          onRowTap={onRowTap}
          activeListId={activeListId}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          flashState={flashStates[row.symbol] || null}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}
