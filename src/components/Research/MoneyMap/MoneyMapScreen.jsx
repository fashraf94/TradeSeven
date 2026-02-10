// /src/components/Research/MoneyMap/MoneyMapScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { fetchAllSectorsData } from '../../../services/sectorDataService';
import { computeMoneyMapData, BELLWETHER_MAP } from '../../../services/moneyMapEngine';
import { SECTORS } from '../../../constants/sectors';
import RegimeBanner from './RegimeBanner';
import ConfidenceGauge from './ConfidenceGauge';
import SectorList from './SectorList';
import MetricTooltip from './MetricTooltip';

// ===========================================
// SPY BENCHMARK FETCHER
// Fetches S&P 500 historical prices and computes
// performance metrics needed by the engine
// ===========================================

async function fetchSpyPerformance() {
  try {
    const res = await fetch('/api/stocks/prices?symbols=SPY&type=historical&days=180');
    if (!res.ok) throw new Error(`SPY fetch failed: ${res.status}`);
    const result = await res.json();
    if (!result.success || !result.data?.length) {
      throw new Error('SPY data unavailable');
    }
    const prices = result.data;
    const current = prices[prices.length - 1]?.adjusted_close || prices[prices.length - 1]?.close;
    const getReturn = (daysAgo) => {
      const idx = Math.max(0, prices.length - 1 - daysAgo);
      const past = prices[idx]?.adjusted_close || prices[idx]?.close;
      return (!past || !current) ? 0 : ((current - past) / past) * 100;
    };
    return { week1: getReturn(5), month1: getReturn(21), month3: getReturn(63) };
  } catch (e) {
    console.warn('[MoneyMap] SPY fetch failed, using fallback SPY data:', e.message);
    // Fallback: neutral SPY performance so relative metrics still work
    return { week1: 0, month1: 0, month3: 0 };
  }
}

// ===========================================
// DATA ENRICHMENT
// Merges engine output with raw sector data
// so SectorCard has both derived metrics and
// raw display fields for the expanded view
// ===========================================

function enrichSectors(engineSectors, rawSectors) {
  const enriched = {};

  for (const [sectorId, engineSector] of Object.entries(engineSectors)) {
    const raw = rawSectors[sectorId];
    const sectorDef = SECTORS[sectorId];

    enriched[sectorId] = {
      // Engine-derived fields
      ...engineSector,

      // Raw display fields for expanded card sections
      performance: raw?.performance || { week1: 0, month1: 0, month3: 0 },
      breadthDirection: 'stable', // No historical comparison available yet
      etfTechnicals: raw?.etfTechnicals || {},
      baggerBombStats: raw?.baggerBombStats || {},
      leaders: (raw?.leadership || []).map(l => ({
        symbol: l.symbol,
        above50: l.above50 !== undefined ? l.above50 : true,
        isBellwether: !!BELLWETHER_MAP[l.symbol]?.isBellwether,
        outperforming: l.outperforming !== undefined ? l.outperforming : true,
      })),
      insight: raw?.insight || '',
      sectorColor: sectorDef?.color || '#8b949e',
      sectorEmoji: sectorDef?.emoji || '',
    };
  }

  return enriched;
}

// ===========================================
// COMPONENT
// ===========================================

/**
 * MoneyMapScreen -- Main container for the Money Map feature
 *
 * Fetches live sector data from sectorDataService, computes intelligence
 * via moneyMapEngine, and renders the three layers:
 *   1. RegimeBanner (market regime + weather)
 *   2. ConfidenceGauge (cyclical vs defensive balance)
 *   3. SectorList (11 sectors grouped by momentum quadrant)
 *
 * @param {Object}   props
 * @param {function} props.onBack - Navigate back to Research landing page
 */
const MoneyMapScreen = ({ onBack }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSectorId, setExpandedSectorId] = useState(null);
  const [tooltipMetric, setTooltipMetric] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all sector data + SPY benchmark in parallel
      const [allSectors, spyPerf] = await Promise.all([
        fetchAllSectorsData(),
        fetchSpyPerformance(),
      ]);

      if (!allSectors || Object.keys(allSectors).length === 0) {
        throw new Error('No sector data returned');
      }

      console.log(`[MoneyMap] Loaded ${Object.keys(allSectors).length} sectors, SPY perf:`, spyPerf);

      // Run the intelligence engine
      const engineResult = computeMoneyMapData(allSectors, spyPerf);

      // Merge engine output with raw sector data for display
      const enrichedSectors = enrichSectors(engineResult.sectors, allSectors);

      setData({
        sectors: enrichedSectors,
        global: engineResult.global,
      });
    } catch (err) {
      console.error('[MoneyMap] Failed to load data:', err);
      setError(err.message || 'Failed to load Money Map data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleSector = (sectorId) => {
    setExpandedSectorId(prev => prev === sectorId ? null : sectorId);
  };

  const handleTooltip = (metric) => {
    setTooltipMetric(metric);
  };

  const handleCloseTooltip = () => {
    setTooltipMetric(null);
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      {/* Back Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div>
          <h1 style={{
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: '700',
            margin: 0,
          }}>
            Money Map
          </h1>
          <p style={{
            color: '#8b949e',
            fontSize: '12px',
            margin: '2px 0 0',
          }}>
            Where's the money going?
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          <div style={{
            background: '#1c2128',
            border: '1px solid #21262d',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #00d9ff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ color: '#8b949e', fontSize: '14px' }}>
              Computing Money Map...
            </span>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div style={{
          background: '#1c2128',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{'\u26A0\uFE0F'}</div>
          <div style={{ color: '#e6edf3', fontSize: '14px', marginBottom: '8px' }}>
            {error}
          </div>
          <button
            onClick={loadData}
            style={{
              background: 'rgba(0, 217, 255, 0.1)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
              borderRadius: '8px',
              color: '#00d9ff',
              fontSize: '13px',
              fontWeight: '600',
              padding: '8px 16px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && data && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          {/* Layer 1: Market Regime Banner */}
          <RegimeBanner
            regime={data.global.regime}
            weather={data.global.weather}
            computedAt={data.global.computedAt}
            onTooltip={handleTooltip}
          />

          {/* Layer 2: Confidence Gauge */}
          <ConfidenceGauge
            confidence={data.global.confidence}
            onTooltip={handleTooltip}
          />

          {/* Layer 3: Sector Cards */}
          <SectorList
            sectors={data.sectors}
            expandedSectorId={expandedSectorId}
            onToggleSector={handleToggleSector}
            onTooltip={handleTooltip}
          />
        </div>
      )}

      {/* Tooltip Bottom Sheet */}
      <MetricTooltip
        metric={tooltipMetric}
        isOpen={!!tooltipMetric}
        onClose={handleCloseTooltip}
      />
    </div>
  );
};

export default MoneyMapScreen;
