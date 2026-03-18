// /src/components/Research/MoneyMap/MoneyMapScreen.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllSectorsData } from '../../../services/sectorDataService';
import { computeMoneyMapData, BELLWETHER_MAP } from '../../../services/moneyMapEngine';
import { fetchWithAuth } from '../../../utils/fetchWithAuth';
import { SECTORS } from '../../../constants/sectors';
import RegimeBanner from './RegimeBanner';
import ConfidenceGauge from './ConfidenceGauge';
import SectorList from './SectorList';
import HeatmapView from './HeatmapView';
import MetricTooltip from './MetricTooltip';
import { useAssetResearch } from '../../../hooks/useAssetResearch';
import AssetResearchModal from '../../draft/AssetResearchModal';

// ===========================================
// SESSION STORAGE CACHE
// Stores computed Money Map data with 15-min TTL.
// On revisit within window, data renders instantly
// while a background refresh fetches fresh data.
// ===========================================

const CACHE_KEY = 'mc_moneymap_data';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCachedData() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.data || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCachedData(data, timestamp) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp,
    }));
  } catch (e) {
    console.warn('[MoneyMap] Cache write failed:', e.message);
  }
}

// ===========================================
// SPY BENCHMARK FETCHER
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
    console.warn('[MoneyMap] SPY fetch failed, using fallback:', e.message);
    return { week1: 0, month1: 0, month3: 0 };
  }
}

// ===========================================
// DATA ENRICHMENT
// ===========================================

function enrichSectors(engineSectors, rawSectors) {
  const enriched = {};

  for (const [sectorId, engineSector] of Object.entries(engineSectors)) {
    const raw = rawSectors[sectorId];
    const sectorDef = SECTORS[sectorId];

    enriched[sectorId] = {
      ...engineSector,
      performance: raw?.performance || { week1: 0, month1: 0, month3: 0 },
      breadthDirection: 'stable',
      etfTechnicals: raw?.etfTechnicals || {},
      baggerBombStats: raw?.baggerBombStats || {},
      leaders: (raw?.leadership || []).map(l => ({
        symbol: l.symbol,
        above50: l.above50 !== undefined ? l.above50 : true,
        isBellwether: !!BELLWETHER_MAP[l.symbol]?.isBellwether,
        outperforming: l.outperforming !== undefined ? l.outperforming : true,
        relativePerformance: l.relativePerformance,
      })),
      insight: raw?.insight || '',
      sectorColor: sectorDef?.color || '#8b949e',
      sectorEmoji: sectorDef?.emoji || '',
    };
  }

  return enriched;
}

// ===========================================
// SKELETON COMPONENTS
// Shimmer placeholders shown while sector
// data loads on a cold start (no cache)
// ===========================================

const SectorCardSkeleton = () => (
  <div style={{
    background: '#161b22',
    border: '1px solid #21262d',
    borderRadius: '12px',
    padding: '16px',
    overflow: 'hidden',
    position: 'relative',
  }}>
    {/* Shimmer overlay */}
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
      animation: 'moneymap-shimmer 1.5s ease-in-out infinite',
    }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#21262d', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: '12px', width: '55%', background: '#21262d', borderRadius: '4px', marginBottom: '8px' }} />
        <div style={{ height: '10px', width: '35%', background: '#21262d', borderRadius: '4px' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ height: '8px', width: '40px', background: '#21262d', borderRadius: '4px' }} />
        <div style={{ height: '16px', width: '16px', borderRadius: '4px', background: '#21262d' }} />
      </div>
    </div>
  </div>
);

const SectorListSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    {/* Group header skeleton */}
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#21262d' }} />
        <div style={{ height: '10px', width: '100px', background: '#21262d', borderRadius: '4px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectorCardSkeleton />
        <SectorCardSkeleton />
        <SectorCardSkeleton />
      </div>
    </div>
    {/* Second group */}
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#21262d' }} />
        <div style={{ height: '10px', width: '80px', background: '#21262d', borderRadius: '4px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectorCardSkeleton />
        <SectorCardSkeleton />
      </div>
    </div>
  </div>
);

// ===========================================
// SHIMMER KEYFRAMES (injected once)
// ===========================================

const SHIMMER_STYLE = `
@keyframes moneymap-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

// ===========================================
// COMPONENT
// ===========================================

/**
 * MoneyMapScreen -- Main container for the Money Map feature
 *
 * Stale-while-revalidate pattern:
 *   1. On mount, check sessionStorage for cached data (15-min TTL)
 *   2. If cached: show instantly, then fetch fresh data in background
 *   3. If no cache: show skeleton, fetch fresh data
 *   4. On fresh data: update display + update cache
 *   5. Refresh button forces a new fetch
 *
 * @param {Object}   props
 * @param {function} props.onBack - Navigate back to Research landing page
 */
const MoneyMapScreen = ({ onBack, stocksData }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSectorId, setExpandedSectorId] = useState(null);
  const [tooltipMetric, setTooltipMetric] = useState(null);
  const [viewMode, setViewMode] = useState('heatmap');
  const [sectorInsights, setSectorInsights] = useState({});
  const mountedRef = useRef(true);

  // Asset research modal
  const { researchAsset, isOpen: isResearchOpen, showResearch, hideResearch, getModalProps } = useAssetResearch();

  // Mobile detection
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Core fetch + compute pipeline
  const fetchFreshData = useCallback(async () => {
    const [allSectors, spyPerf] = await Promise.all([
      fetchAllSectorsData(),
      fetchSpyPerformance(),
    ]);

    if (!allSectors || Object.keys(allSectors).length === 0) {
      throw new Error('No sector data returned');
    }

    const engineResult = computeMoneyMapData(allSectors, spyPerf);
    const enrichedSectors = enrichSectors(engineResult.sectors, allSectors);
    const fetchedAt = Date.now();

    const newData = {
      sectors: enrichedSectors,
      global: {
        ...engineResult.global,
        computedAt: fetchedAt,
      },
    };

    return { newData, fetchedAt };
  }, []);

  // Stale-while-revalidate: load cached data first, then refresh in background
  useEffect(() => {
    mountedRef.current = true;
    const cached = getCachedData();

    if (cached) {
      // Show cached data instantly with the original fetch timestamp
      setData({
        ...cached.data,
        global: {
          ...cached.data.global,
          computedAt: cached.timestamp,
        },
      });
      setIsLoading(false);

      // Background refresh
      setIsRefreshing(true);
      fetchFreshData()
        .then(({ newData, fetchedAt }) => {
          if (!mountedRef.current) return;
          setData(newData);
          setCachedData(newData, fetchedAt);
        })
        .catch((err) => {
          console.warn('[MoneyMap] Background refresh failed, keeping cached data:', err.message);
        })
        .finally(() => {
          if (mountedRef.current) setIsRefreshing(false);
        });
    } else {
      // Cold start: no cache, show loading skeleton
      setIsLoading(true);
      fetchFreshData()
        .then(({ newData, fetchedAt }) => {
          if (!mountedRef.current) return;
          setData(newData);
          setCachedData(newData, fetchedAt);
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          console.error('[MoneyMap] Failed to load data:', err);
          setError(err.message || 'Failed to load Money Map data');
        })
        .finally(() => {
          if (mountedRef.current) setIsLoading(false);
        });
    }

    return () => { mountedRef.current = false; };
  }, [fetchFreshData]);

  // Manual refresh: force-fetch fresh data
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const { newData, fetchedAt } = await fetchFreshData();
      if (!mountedRef.current) return;
      setData(newData);
      setCachedData(newData, fetchedAt);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[MoneyMap] Refresh failed:', err);
      if (!data) {
        setError(err.message || 'Failed to load Money Map data');
      }
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, [fetchFreshData, isRefreshing, data]);

  // Fetch Sonar sector insight on demand
  const fetchSectorInsight = useCallback(async (sectorId) => {
    if (sectorInsights[sectorId]) return;
    const sector = data?.sectors?.[sectorId];
    if (!sector) return;
    try {
      const res = await fetchWithAuth('/api/sector-insight', {
        method: 'POST',
        body: JSON.stringify({
          sectorName: sector.name,
          etfSymbol: sectorId,
          change1M: sector.performance?.month1 || 0,
          breadthPct: sector.breadth?.percent || sector.breadthTier?.percent || 50,
          quadrant: sector.quadrant?.quadrant || 'NEUTRAL',
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSectorInsights(prev => ({ ...prev, [sectorId]: result.data }));
      }
    } catch (err) {
      console.warn('[SectorInsight] Failed for', sectorId, err);
    }
  }, [data, sectorInsights]);

  const handleToggleSector = (sectorId) => {
    setExpandedSectorId(prev => prev === sectorId ? null : sectorId);
  };

  // Fetch insight when a sector is expanded
  useEffect(() => {
    if (expandedSectorId) fetchSectorInsight(expandedSectorId);
  }, [expandedSectorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Look up full stock data from stocksData before opening the research modal
  const handleStockTap = useCallback((symbol) => {
    const stockInfo = stocksData?.find(s => s.symbol === symbol);
    const sector = Object.values(data?.sectors || {}).find(s =>
      s.leaders?.some(l => l.symbol === symbol)
    );
    showResearch({
      symbol,
      name: stockInfo?.name || symbol,
      price: stockInfo?.price || 0,
      percentChange: stockInfo?.percentChange || 0,
      sector: sector?.name,
      type: 'stock',
    });
  }, [data, stocksData, showResearch]);

  const handleTooltip = (metric) => setTooltipMetric(metric);
  const handleCloseTooltip = () => setTooltipMetric(null);

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      <style>{SHIMMER_STYLE}</style>

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
        <div style={{ flex: 1 }}>
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
        {/* Refreshing indicator in header */}
        {isRefreshing && data && (
          <div style={{
            width: '14px',
            height: '14px',
            border: '2px solid #00d9ff',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            flexShrink: 0,
          }} />
        )}
      </div>

      {/* Cold-start loading: full skeleton */}
      {isLoading && !data && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          {/* RegimeBanner skeleton */}
          <div style={{
            background: '#1c2128',
            border: '1px solid #21262d',
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
              animation: 'moneymap-shimmer 1.5s ease-in-out infinite',
            }} />
            <div style={{ height: '10px', width: '100px', background: '#21262d', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ height: '20px', width: '60%', background: '#21262d', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ height: '12px', width: '40%', background: '#21262d', borderRadius: '4px', marginBottom: '16px' }} />
            <div style={{ height: '12px', width: '100%', background: '#21262d', borderRadius: '4px', marginBottom: '8px' }} />
            <div style={{ height: '12px', width: '80%', background: '#21262d', borderRadius: '4px' }} />
          </div>

          {/* ConfidenceGauge skeleton */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
              animation: 'moneymap-shimmer 1.5s ease-in-out infinite',
            }} />
            <div style={{ height: '12px', width: '100px', background: '#21262d', borderRadius: '4px', marginBottom: '20px' }} />
            <div style={{ height: '4px', width: '100%', background: '#21262d', borderRadius: '4px' }} />
          </div>

          {/* SectorList skeleton */}
          <SectorListSkeleton />
        </div>
      )}

      {/* Error (only on cold-start failure with no cached data) */}
      {!isLoading && error && !data && (
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
            onClick={handleRefresh}
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

      {/* Main content: show when data exists (cached or fresh) */}
      {data && (
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
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />

          {/* Layer 2: Confidence Gauge */}
          <ConfidenceGauge
            confidence={data.global.confidence}
            onTooltip={handleTooltip}
          />

          {/* View Toggle: Heatmap / List */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              display: 'inline-flex',
              background: '#161b22',
              borderRadius: '8px',
              border: '1px solid #21262d',
              padding: '2px',
            }}>
              {[
                { key: 'heatmap', label: 'Heatmap' },
                { key: 'list', label: 'List' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: viewMode === key ? 'rgba(0,217,255,0.15)' : 'transparent',
                    color: viewMode === key ? '#00d9ff' : '#8b949e',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Layer 3a: Heatmap View */}
          {viewMode === 'heatmap' && (
            <HeatmapView
              sectors={data.sectors}
              global={data.global}
              onSectorTap={(sectorId) => handleToggleSector(sectorId)}
              onStockTap={handleStockTap}
              compact={isMobile}
            />
          )}

          {/* Layer 3b: Sector Cards (always renders; hides collapsed cards in heatmap mode) */}
          <SectorList
            sectors={data.sectors}
            expandedSectorId={expandedSectorId}
            onToggleSector={handleToggleSector}
            onTooltip={handleTooltip}
            sectorInsights={sectorInsights}
            onStockTap={handleStockTap}
            hideCollapsed={viewMode === 'heatmap'}
          />
        </div>
      )}

      {/* Tooltip Bottom Sheet */}
      <MetricTooltip
        metric={tooltipMetric}
        isOpen={!!tooltipMetric}
        onClose={handleCloseTooltip}
      />

      {/* Asset Research Modal */}
      {isResearchOpen && researchAsset && (
        <AssetResearchModal {...getModalProps()} showActionButton={false} />
      )}
    </div>
  );
};

export default MoneyMapScreen;
