import React, { useState, useEffect, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONO_FONT = "'JetBrains Mono', 'SF Mono', monospace";

function getTierColor(percentile) {
  if (percentile == null) return '#6e7681';
  if (percentile >= 80) return '#ffd700';
  if (percentile >= 60) return '#00d9ff';
  if (percentile >= 40) return '#8b949e';
  if (percentile >= 20) return '#f59e0b';
  return '#f85149';
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonLoader() {
  return (
    <div style={{ padding: '8px 0' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          height: '32px', borderRadius: '6px', marginBottom: '6px',
          background: 'rgba(255,255,255,0.04)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorCard({ error }) {
  return (
    <div style={{
      padding: '24px 16px', textAlign: 'center',
      background: '#1c2333', borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#8b949e', marginBottom: '4px' }}>
        Sector Data Unavailable
      </div>
      <div style={{ fontSize: '11px', color: '#6e7681', lineHeight: '1.4' }}>
        {error || 'Unable to load sector rankings. Data is computed daily pre-market.'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock's Sector Card
// ---------------------------------------------------------------------------

function StockSectorCard({ highlightedSector, peerData }) {
  if (!highlightedSector) return null;

  return (
    <div style={{
      padding: '12px', marginBottom: '12px', borderRadius: '8px',
      background: `${highlightedSector.color || '#3b82f6'}10`,
      border: `1px solid ${highlightedSector.color || '#3b82f6'}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: highlightedSector.color || '#3b82f6', flexShrink: 0,
        }} />
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#e6edf3' }}>
          {highlightedSector.name}
        </span>
        <span style={{ fontSize: '11px', color: '#8b949e' }}>
          · {highlightedSector.etf}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
        <div>
          <span style={{ color: '#8b949e' }}>Sector Rank </span>
          <span style={{
            fontWeight: '700', fontFamily: MONO_FONT,
            color: highlightedSector.tier?.color || '#e6edf3',
          }}>
            #{highlightedSector.rank}
          </span>
          <span style={{ color: '#6e7681' }}> of {highlightedSector.totalSectors || 11}</span>
        </div>
        <div>
          <span style={{ color: '#8b949e' }}>Score </span>
          <span style={{
            fontWeight: '700', fontFamily: MONO_FONT,
            color: highlightedSector.tier?.color || '#e6edf3',
          }}>
            {highlightedSector.compositeScore}
          </span>
        </div>
      </div>
      {highlightedSector.breadth && (
        <div style={{ fontSize: '10px', color: '#6e7681', marginTop: '4px' }}>
          Breadth: {highlightedSector.breadth.label}
        </div>
      )}
      {peerData && (
        <div style={{
          fontSize: '10px', color: '#8b949e', marginTop: '4px',
          borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px',
        }}>
          {peerData.name} is #{peerData.compositeRank} of {peerData.totalPeers} peers
          <span style={{ color: peerData.tier?.color, fontWeight: '600', marginLeft: '4px' }}>
            ({peerData.tier?.label})
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock vs Sector Comparison
// ---------------------------------------------------------------------------

function StockVsSectorComparison({ peerData, highlightedSector }) {
  if (!peerData || !highlightedSector?.medianMetrics) return null;

  const metrics = peerData.metrics;
  const medians = highlightedSector.medianMetrics;

  const comparisons = [
    {
      label: 'Revenue Growth',
      stockVal: metrics?.revenueGrowthYOY,
      sectorVal: medians.revenueGrowth,
      format: v => v != null ? `${(v * 100).toFixed(1)}%` : '—',
      higherBetter: true,
    },
    {
      label: 'Forward P/E',
      stockVal: metrics?.forwardPE,
      sectorVal: medians.forwardPE,
      format: v => v != null && v > 0 ? `${v.toFixed(1)}x` : '—',
      higherBetter: false,
    },
  ].filter(c => c.stockVal != null && c.sectorVal != null);

  if (comparisons.length === 0) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        fontSize: '10px', color: '#8b949e', marginBottom: '6px',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Stock vs Sector Median
      </div>
      <div style={{
        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        {comparisons.map((comp, i) => {
          const ratio = comp.sectorVal !== 0
            ? Math.abs(comp.stockVal / comp.sectorVal)
            : null;
          const isAbove = comp.higherBetter
            ? comp.stockVal > comp.sectorVal
            : comp.stockVal < comp.sectorVal;

          let callout = null;
          if (ratio != null && (ratio > 1.5 || ratio < 0.67)) {
            const mult = ratio > 1 ? ratio : 1 / ratio;
            if (comp.higherBetter) {
              callout = comp.stockVal > comp.sectorVal
                ? `${mult.toFixed(1)}x faster`
                : `${mult.toFixed(1)}x slower`;
            } else {
              callout = comp.stockVal < comp.sectorVal
                ? `${mult.toFixed(1)}x cheaper`
                : `${mult.toFixed(1)}x pricier`;
            }
          }

          return (
            <div key={comp.label} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px',
              borderBottom: i < comparisons.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <span style={{ fontSize: '10px', color: '#8b949e', flex: '0 0 85px' }}>
                {comp.label}
              </span>
              <span style={{
                fontSize: '12px', fontWeight: '700', fontFamily: MONO_FONT,
                color: isAbove ? '#10b981' : '#f59e0b',
                flex: '0 0 60px', textAlign: 'right',
              }}>
                {comp.format(comp.stockVal)}
              </span>
              <span style={{ fontSize: '9px', color: '#6e7681' }}>vs</span>
              <span style={{
                fontSize: '11px', fontFamily: MONO_FONT, color: '#8b949e',
                flex: '0 0 50px', textAlign: 'right',
              }}>
                {comp.format(comp.sectorVal)}
              </span>
              {callout && (
                <span style={{
                  fontSize: '9px', fontWeight: '600',
                  color: isAbove ? '#10b981' : '#f59e0b',
                  background: isAbove ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  padding: '1px 6px', borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}>
                  {callout}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// All 11 Sectors List
// ---------------------------------------------------------------------------

function SectorList({ sectors, highlightSectorId }) {
  if (!sectors?.length) return null;

  return (
    <div>
      <div style={{
        fontSize: '10px', color: '#8b949e', marginBottom: '6px',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        All Sectors Ranked
      </div>
      <div style={{
        borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        {sectors.map((sector, i) => {
          const isHl = sector.sectorId === highlightSectorId || sector.isHighlighted;
          const sectorColor = sector.color || '#3b82f6';

          return (
            <div key={sector.sectorId} style={{
              padding: '8px 10px',
              background: isHl ? `${sectorColor}10` : 'transparent',
              borderLeft: isHl ? `3px solid ${sectorColor}` : '3px solid transparent',
              borderBottom: i < sectors.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              {/* Top row: rank, name, score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '10px', fontFamily: MONO_FONT, color: '#6e7681',
                  flex: '0 0 18px', textAlign: 'right',
                }}>
                  {sector.rank}
                </span>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: sectorColor, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '11px', fontWeight: isHl ? '700' : '500',
                  color: isHl ? '#e6edf3' : '#c9d1d9', flex: 1,
                }}>
                  {sector.name}
                </span>
                <span style={{ fontSize: '9px', color: '#6e7681', flex: '0 0 28px' }}>
                  {sector.etf}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: '700', fontFamily: MONO_FONT,
                  color: sector.tier?.color || getTierColor(sector.compositeScore),
                  flex: '0 0 26px', textAlign: 'right',
                }}>
                  {sector.compositeScore}
                </span>
              </div>

              {/* Breadth mini bar */}
              <div style={{
                marginTop: '4px', marginLeft: '32px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <div style={{
                  flex: 1, height: '3px', borderRadius: '2px',
                  background: 'rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: `${sector.breadth?.value || 0}%`,
                    background: sectorColor,
                    opacity: 0.6,
                  }} />
                </div>
                <span style={{ fontSize: '9px', color: '#6e7681', whiteSpace: 'nowrap' }}>
                  {sector.relMomentum3M != null && (
                    <span style={{
                      color: sector.relMomentum3M >= 0 ? '#10b981' : '#f85149',
                      fontFamily: MONO_FONT,
                    }}>
                      {sector.relMomentum3M >= 0 ? '+' : ''}{sector.relMomentum3M}%
                    </span>
                  )}
                  <span style={{ marginLeft: '3px' }}>vs SPY</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const SectorTab = ({ symbol, isMobile }) => {
  const [sectorData, setSectorData] = useState(null);
  const [peerData, setPeerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSectorData(null);
    setPeerData(null);

    Promise.all([
      fetch(`/api/stocks/sector-rankings?symbol=${encodeURIComponent(symbol)}`)
        .then(r => r.json()),
      fetch(`/api/stocks/peer-rankings?symbol=${encodeURIComponent(symbol)}`)
        .then(r => r.json())
        .catch(() => ({ success: false })),
    ]).then(([sectorRes, peerRes]) => {
      if (cancelled) return;
      if (sectorRes.success) {
        setSectorData(sectorRes.data);
      } else {
        setError(sectorRes.message || sectorRes.error || 'Unable to load sector rankings.');
      }
      if (peerRes.success) {
        setPeerData(peerRes.data);
      }
      setLoading(false);
    }).catch(err => {
      if (!cancelled) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [symbol]);

  const highlightedSector = useMemo(() => {
    if (!sectorData?.sectors) return null;
    return sectorData.sectors.find(s => s.isHighlighted) ||
           sectorData.sectors.find(s => s.sectorId === sectorData.highlightSectorId) ||
           null;
  }, [sectorData]);

  if (loading) return <SkeletonLoader />;
  if (error || !sectorData) return <ErrorCard error={error} />;

  return (
    <div>
      <StockSectorCard highlightedSector={highlightedSector} peerData={peerData} />
      <StockVsSectorComparison peerData={peerData} highlightedSector={highlightedSector} />
      <SectorList
        sectors={sectorData.sectors}
        highlightSectorId={sectorData.highlightSectorId}
      />
    </div>
  );
};

export default SectorTab;
