// /src/components/Research/MoneyMap/LeadershipDisplay.jsx

import React, { useState } from 'react';

/**
 * LeadershipDisplay — Shows leadership score dots and individual leader pills
 *
 * @param {Object}   props
 * @param {Object}   props.leadershipScore - { score, maxScore, healthy, outperforming, total }
 * @param {Array}    props.leaders         - [{ symbol, above50, isBellwether, outperforming }]
 * @param {boolean}  props.hasGildedCage   - True if gilded cage is detected
 * @param {boolean}  props.isExpanded      - Controls collapsed dots vs expanded pills
 * @param {function} props.onStockTap      - (symbol) => void — opens asset research modal
 */
const LeadershipDisplay = ({ leadershipScore, leaders = [], hasGildedCage, isExpanded, onStockTap }) => {
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  if (!isExpanded) {
    // === COLLAPSED MODE: dots + score text ===
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        {/* Health dots */}
        <div style={{
          display: 'flex',
          gap: '3px',
        }}>
          {leaders.slice(0, 7).map((leader, i) => (
            <span key={i} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: leader.above50 ? '#10b981' : '#f59e0b',
              border: leader.isBellwether ? '1.5px solid #ffffff' : 'none',
              boxSizing: 'border-box',
            }} />
          ))}
        </div>
        {/* Score text */}
        <span style={{
          fontSize: '12px',
          color: '#e6edf3',
          fontWeight: '600',
        }}>
          {leadershipScore?.healthy || 0}/{leadershipScore?.total || 0}
        </span>
        {/* Gilded cage warning */}
        {hasGildedCage && (
          <span style={{ fontSize: '10px', color: '#f59e0b' }}>
            {'\u26A0\uFE0F'}
          </span>
        )}
      </div>
    );
  }

  // === EXPANDED MODE: individual leader pills ===
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Leader pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
      }}>
        {leaders.map((leader) => {
          const isHovered = hoveredSymbol === leader.symbol;
          return (
            <div
              key={leader.symbol}
              onClick={(e) => { e.stopPropagation(); onStockTap?.(leader.symbol); }}
              onMouseEnter={() => setHoveredSymbol(leader.symbol)}
              onMouseLeave={() => setHoveredSymbol(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                background: '#1c2128',
                borderRadius: '14px',
                fontSize: '12px',
                cursor: onStockTap ? 'pointer' : 'default',
                transition: 'border-color 0.15s ease',
                border: isHovered && onStockTap
                  ? '1px solid rgba(0,255,255,0.5)'
                  : leader.isBellwether
                    ? '1px solid rgba(0,217,255,0.3)'
                    : '1px solid #21262d',
              }}
            >
              {leader.isBellwether && (
                <span style={{ fontSize: '10px', color: '#00d9ff' }}>
                  {'\u2605'}
                </span>
              )}
              <span style={{
                fontWeight: '600',
                color: leader.above50 ? '#ffffff' : '#ef4444',
              }}>
                {leader.symbol}
              </span>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: leader.above50 ? '#10b981' : '#ef4444',
              }} />
            </div>
          );
        })}
      </div>

      {/* Score summary below pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          fontSize: '11px',
          color: '#8b949e',
        }}>
          Leadership: {leadershipScore?.healthy || 0}/{leadershipScore?.total || 0} healthy
        </span>
        {hasGildedCage && (
          <span style={{
            fontSize: '11px',
            color: '#f59e0b',
            fontWeight: '600',
          }}>
            {'\u26A0\uFE0F'} Gilded Cage
          </span>
        )}
      </div>
    </div>
  );
};

export default LeadershipDisplay;
