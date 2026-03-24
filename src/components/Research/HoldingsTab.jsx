import React, { useState, useEffect } from 'react';
import { getCompanyProfile } from '../../services/fundamentalsService';
import { SECTORS } from '../../constants/sectors';
import { HOLO_COLORS } from '../../constants/holoTheme';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const SkeletonRow = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
    <div style={{
      height: '14px', width: '60px', borderRadius: '4px',
      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
    <div style={{
      height: '14px', width: '50px', borderRadius: '4px',
      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  </div>
);

const HoldingsTab = ({ symbol, onNavigateToStock }) => {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const profile = await getCompanyProfile(symbol);
        if (cancelled) return;

        if (profile?.etfHoldings?.length) {
          setHoldings(profile.etfHoldings);
          setUsedFallback(false);
        } else {
          // Fallback to SECTORS topHoldings (no weights available)
          const sector = SECTORS[symbol];
          if (sector?.topHoldings) {
            setHoldings(sector.topHoldings.map(ticker => ({
              symbol: ticker,
              name: ticker,
              weight: null,
            })));
            setUsedFallback(true);
          }
        }
      } catch (err) {
        if (cancelled) return;
        // Fallback on error
        const sector = SECTORS[symbol];
        if (sector?.topHoldings) {
          setHoldings(sector.topHoldings.map(ticker => ({
            symbol: ticker,
            name: ticker,
            weight: null,
          })));
          setUsedFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [symbol]);

  const sectorInfo = SECTORS[symbol];

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Section header */}
      <div style={{
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '1px',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        marginBottom: '8px',
        fontFamily: MONO,
      }}>
        {sectorInfo ? `${sectorInfo.emoji} ${sectorInfo.name} ETF Holdings` : 'Holdings'}
      </div>

      {/* Table */}
      <div style={{
        borderRadius: '10px',
        overflow: 'hidden',
        background: HOLO_COLORS.bgCard,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '0.8px',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            fontFamily: MONO,
          }}>
            Stock
          </span>
          {!usedFallback && (
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.8px',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              fontFamily: MONO,
            }}>
              Weight
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}

        {/* Holdings rows */}
        {!loading && holdings.map((h, i) => (
          <div
            key={h.symbol}
            onClick={() => onNavigateToStock(h.symbol, h.name)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              cursor: 'pointer',
              background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'; }}
          >
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
              fontFamily: MONO,
            }}>
              {h.symbol}
            </span>
            {h.weight != null && (
              <span style={{
                fontSize: '13px',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: MONO,
              }}>
                {h.weight.toFixed(2)}%
              </span>
            )}
          </div>
        ))}

        {/* Empty state */}
        {!loading && holdings.length === 0 && (
          <div style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.35)',
            fontSize: '12px',
          }}>
            No holdings data available
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

export default HoldingsTab;
