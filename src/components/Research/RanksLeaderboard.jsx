import React, { useMemo } from 'react';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const TYPE_CONFIG = {
  fundamental: {
    label: 'FUNDAMENTAL LEADERBOARD',
    gradient: 'linear-gradient(90deg, rgba(245,158,11,0.5), rgba(245,158,11,0.9))',
    scoreColor: '#f59e0b',
    scoreKey: 'fundamentalScore',
  },
  technical: {
    label: 'TECHNICAL LEADERBOARD',
    gradient: 'linear-gradient(90deg, rgba(0,217,255,0.5), rgba(0,217,255,0.9))',
    scoreColor: '#00d9ff',
    scoreKey: 'technicalScore',
  },
  composite: {
    label: 'COMPOSITE RANKING',
    gradient: 'linear-gradient(90deg, rgba(0,217,255,0.5), rgba(16,185,129,0.8))',
    scoreColor: '#00d9ff',
    scoreKey: 'compositeScore',
  },
};

const RanksLeaderboard = ({ type, stocks, currentSymbol, onNavigateToStock, title, sectorFilter }) => {
  const config = TYPE_CONFIG[type];

  const { topStocks, currentEntry, currentIdx, totalCount } = useMemo(() => {
    if (!stocks?.length) return { topStocks: [], currentEntry: null, currentIdx: -1, totalCount: 0 };

    // Optionally filter to a single sector
    let filtered = stocks.filter(s => s[config.scoreKey] != null);
    if (sectorFilter) {
      filtered = filtered.filter(s => s.sectorId === sectorFilter);
    }

    const sorted = [...filtered].sort((a, b) => {
      if (type === 'fundamental') return (a.fundamentalRank || 999) - (b.fundamentalRank || 999);
      if (type === 'technical') return (a.technicalRank || 999) - (b.technicalRank || 999);
      return (b.compositeScore || 0) - (a.compositeScore || 0);
    });

    const top = sorted.slice(0, 10);
    const curIdx = sorted.findIndex(s => s.symbol === currentSymbol);
    const isInTop = curIdx >= 0 && curIdx < 10;
    const cur = (!isInTop && curIdx >= 0) ? sorted[curIdx] : null;

    return { topStocks: top, currentEntry: cur, currentIdx: curIdx, totalCount: sorted.length };
  }, [stocks, type, config.scoreKey, sectorFilter, currentSymbol]);

  if (!topStocks.length) return null;

  const allDisplayed = currentEntry ? [...topStocks, currentEntry] : topStocks;
  const maxScore = Math.max(...allDisplayed.map(s => s[config.scoreKey] || 0), 1);

  const renderRow = (stock, idx, rank) => {
    const isCurrent = stock.symbol === currentSymbol;
    const score = stock[config.scoreKey];
    const barWidth = Math.max(5, (score / maxScore) * 100);

    return (
      <div
        key={stock.symbol}
        onClick={() => {
          if (!isCurrent && onNavigateToStock) onNavigateToStock(stock.symbol);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 10px',
          marginBottom: '2px',
          borderRadius: '6px',
          cursor: isCurrent ? 'default' : 'pointer',
          background: isCurrent ? 'rgba(0, 217, 255, 0.06)' : 'transparent',
          borderLeft: isCurrent ? '2px solid #00d9ff' : '2px solid transparent',
          transition: 'background 0.15s',
        }}
      >
        {/* Rank */}
        <span style={{
          fontSize: '12px',
          fontWeight: '700',
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: MONO,
          width: '20px',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {rank}.
        </span>

        {/* Symbol + sub-ranks */}
        <div style={{ width: '50px', flexShrink: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#ffffff',
            lineHeight: 1,
          }}>
            {stock.symbol}
          </div>
          {type === 'composite' && (stock.fundamentalRank || stock.technicalRank) && (
            <div style={{
              fontSize: '9px',
              color: '#6e7681',
              marginTop: '2px',
              lineHeight: 1,
            }}>
              {stock.fundamentalRank ? `F:#${stock.fundamentalRank}` : ''}
              {stock.fundamentalRank && stock.technicalRank ? '  ' : ''}
              {stock.technicalRank ? `T:#${stock.technicalRank}` : ''}
            </div>
          )}
        </div>

        {/* Score Bar */}
        <div style={{
          flex: 1,
          height: '8px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            borderRadius: '4px',
            width: `${barWidth}%`,
            background: config.gradient,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Score Value */}
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: config.scoreColor,
          fontFamily: MONO,
          width: '36px',
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {Math.round(score)}
        </span>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Section Header */}
      <div style={{
        fontSize: '10px',
        color: '#8b949e',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '8px',
      }}>
        {title || config.label}
      </div>

      {/* Top 10 Rows */}
      {topStocks.map((stock, idx) => renderRow(stock, idx, idx + 1))}

      {/* Current stock if not in top 10 */}
      {currentEntry && (
        <>
          <div style={{
            padding: '4px 10px',
            textAlign: 'center',
            fontSize: '10px',
            color: '#6e7681',
          }}>
            ···  {totalCount - 10 > 1 ? `${totalCount - 10} more` : ''}  ···
          </div>
          {renderRow(currentEntry, 0, currentIdx + 1)}
        </>
      )}
    </div>
  );
};

export default RanksLeaderboard;
