import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { prepareChartData, formatTime, calculateBombLevels, detectBombCrossings, calculateNearestLevel } from './chartUtils';

const TIMEFRAMES = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
];

/**
 * StockChart - Interactive candlestick chart with volume, timeframe selector, and overlays.
 * Uses lightweight-charts v5 API.
 */
const StockChart = ({
  ohlcvData,         // Oldest-first processed OHLCV from useResearchData
  rawData,           // Newest-first raw data for SMA computation
  timeframe,         // Current timeframe: '1D' | '1W' | 'bomb' | 'spectate'
  onTimeframeChange, // (tf) => void
  levels,            // { support: [], resistance: [], currentPrice } from detectLevels
  smaData,           // { sma20: [{date,value}], sma50: [{date,value}] } (newest-first)
  activeHighlight,   // Optional: { price, type } for highlighted level
  height = 300,
  bombData,          // { threshold: number, baselinePrice: number } | null
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const smaSeriesRefs = useRef([]);
  const levelLinesRef = useRef([]);
  const highlightLineRef = useRef(null);
  const bombPriceLinesRef = useRef([]);

  const [showSMA, setShowSMA] = useState(false);
  const [showSR, setShowSR] = useState(false);
  const [isSpectateMode, setIsSpectateMode] = useState(false);
  const [spectateLevel, setSpectateLevel] = useState(null);


  const isBombView = timeframe === 'bomb' || timeframe === 'spectate';
  const isSpectateView = timeframe === 'spectate';

  const bombLevels = useMemo(() => {
    if (!isBombView || !bombData?.threshold || !bombData?.baselinePrice) return [];
    return calculateBombLevels(bombData.baselinePrice, bombData.threshold);
  }, [isBombView, bombData?.threshold, bombData?.baselinePrice]);

  // Nearest bomb level to current price (for distance indicator)
  const nearestLevel = useMemo(() => {
    if (!isBombView || bombLevels.length === 0 || !ohlcvData || ohlcvData.length === 0) {
      return { above: null, below: null };
    }
    // Get latest close price (ohlcvData is oldest-first, last element is most recent)
    const latestClose = ohlcvData[ohlcvData.length - 1]?.close;
    if (!latestClose) return { above: null, below: null };
    return calculateNearestLevel(Number(latestClose), bombLevels);
  }, [isBombView, bombLevels, ohlcvData]);

  // Determine which bomb levels have been triggered from TODAY's chart data only
  // (previous days' candles were at different baselines so they'd cause false HITs)
  const triggeredLevels = useMemo(() => {
    if (!isBombView || bombLevels.length === 0 || !ohlcvData || ohlcvData.length === 0) return [];
    const triggered = new Set();
    const baseline = bombData?.baselinePrice;
    if (!baseline || baseline <= 0) return [];

    // Only consider candles from today's trading session
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStartUnix = Math.floor(todayStart.getTime() / 1000);

    const todayCandles = ohlcvData.filter(candle => {
      // Handle both unix timestamp and date string formats
      const t = candle.time || candle.timestamp;
      if (typeof t === 'number') return t >= todayStartUnix;
      const dateStr = candle.date || candle.datetime || '';
      if (!dateStr) return false;
      const candleDate = new Date(dateStr);
      return candleDate >= todayStart;
    });

    // Check if any of today's candles crossed each level
    todayCandles.forEach(candle => {
      const high = Number(candle.high);
      const low = Number(candle.low);
      bombLevels.forEach(level => {
        if (level.tier === 'baseline') return;
        if (level.points > 0 && high >= level.price) triggered.add(level.tier);
        if (level.points < 0 && low <= level.price) triggered.add(level.tier);
      });
    });
    return [...triggered];
  }, [isBombView, bombLevels, ohlcvData, bombData?.baselinePrice]);

  // Auto-switch back to 1D if bombData removed while viewing bomb tab
  useEffect(() => {
    if ((timeframe === 'bomb' || timeframe === 'spectate') && !bombData) onTimeframeChange('1D');
  }, [timeframe, bombData, onTimeframeChange]);

  // Prepare chart-ready data
  const chartData = useMemo(() => {
    if (!ohlcvData || ohlcvData.length === 0) return [];
    return prepareChartData(ohlcvData);
  }, [ohlcvData]);

  // Main chart setup
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    const container = chartContainerRef.current;

    const accentColor = isBombView ? 'rgba(245, 158, 11, ' : 'rgba(0, 255, 255, ';

    // For intraday bomb/spectate views, format times in ET
    const useETTimezone = isBombView;
    const etTimeFormatter = (timestamp) => {
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    const chart = createChart(container, {
      layout: {
        background: { type: 'solid', color: HOLO_COLORS.bgDeep },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: accentColor + '0.03)' },
        horzLines: { color: accentColor + '0.03)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: accentColor + '0.3)', width: 1, style: 2, labelBackgroundColor: HOLO_COLORS.bgDeep },
        horzLine: { color: accentColor + '0.3)', width: 1, style: 2, labelBackgroundColor: HOLO_COLORS.bgDeep },
      },
      ...(useETTimezone ? {
        localization: {
          timeFormatter: etTimeFormatter,
        },
      } : {}),
      timeScale: {
        borderColor: accentColor + '0.15)',
        timeVisible: timeframe === '1D' || isBombView,
        secondsVisible: false,
        ...(useETTimezone ? {
          tickMarkFormatter: (time) => etTimeFormatter(time),
        } : {}),
      },
      rightPriceScale: {
        borderColor: accentColor + '0.15)',
      },
      width: container.clientWidth,
      height: height,
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true },
    });

    chartRef.current = chart;

    if (isBombView) {
      // Bomb view: Background zones between bomb levels (added first for z-order)
      const zoneConfigs = [];
      if (bombLevels.length >= 7) {
        // Sort levels by price descending for zone pairing
        const sorted = [...bombLevels].sort((a, b) => b.price - a.price);
        // Zone pairs: [tenBagger→top], [doubleBagger→tenBagger], [bagger→doubleBagger], [baseline→bagger], [bust→baseline], [crash→bust], [meltdown→crash]
        const zoneDefs = [
          { upper: sorted[0], lower: sorted[1], color: 'rgba(255, 215, 0, 0.04)' },    // gold zone (tenBagger → doubleBagger)
          { upper: sorted[1], lower: sorted[2], color: 'rgba(255, 149, 0, 0.05)' },    // orange zone (doubleBagger → bagger)
          { upper: sorted[2], lower: sorted[3], color: 'rgba(0, 255, 136, 0.04)' },    // green zone (bagger → baseline)
          { upper: sorted[3], lower: sorted[4], color: 'rgba(255, 255, 255, 0.02)' },  // neutral zone (baseline → bust)
          { upper: sorted[4], lower: sorted[5], color: 'rgba(239, 68, 68, 0.06)' },    // light red (bust → crash)
          { upper: sorted[5], lower: sorted[6], color: 'rgba(239, 68, 68, 0.10)' },    // medium red (crash → meltdown)
        ];
        zoneDefs.forEach(z => zoneConfigs.push(z));
      }

      // Render zone AreaSeries (before candles for z-order)
      zoneConfigs.forEach(zone => {
        try {
          const areaSeries = chart.addSeries(AreaSeries, {
            topColor: zone.color,
            bottomColor: 'transparent',
            lineColor: 'transparent',
            lineWidth: 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            autoscaleInfoProvider: () => null,
          });
          // Fill the zone at the upper level price across all time points
          const zoneData = chartData.map(c => ({
            time: c.time,
            value: zone.upper.price,
          }));
          areaSeries.setData(zoneData);
          areaSeries.applyOptions({
            baseValue: { type: 'price', price: zone.lower.price },
          });
        } catch (zoneErr) {
          console.warn('[StockChart] Zone render error:', zoneErr);
        }
      });

      // Bomb view: CandlestickSeries (hourly) with bomb level price lines
      const bombSeries = chart.addSeries(CandlestickSeries, {
        upColor: HOLO_COLORS.green,
        downColor: '#ff4757',
        borderUpColor: HOLO_COLORS.green,
        borderDownColor: '#ff4757',
        wickUpColor: HOLO_COLORS.green,
        wickDownColor: '#ff4757',
        autoscaleInfoProvider: () => {
          if (isSpectateView && spectateLevel && chartData.length > 0) {
            // Spectate: tight Y-axis around current price and focused threshold
            const currentPrice = chartData[chartData.length - 1]?.close;
            if (currentPrice) {
              const thresholdPrice = spectateLevel.price;
              const lo = Math.min(currentPrice, thresholdPrice);
              const hi = Math.max(currentPrice, thresholdPrice);
              const range = hi - lo;
              // 40% padding, minimum 0.2% of current price
              const padding = Math.max(range * 0.4, currentPrice * 0.002);
              return { priceRange: { minValue: lo - padding, maxValue: hi + padding } };
            }
          }
          // Normal bomb view: fit all bomb levels
          if (bombLevels.length === 0) return null;
          const prices = bombLevels.map(l => l.price);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const padding = (max - min) * 0.1;
          return { priceRange: { minValue: min - padding, maxValue: max + padding } };
        },
      });
      candleSeriesRef.current = bombSeries;

      try {
        bombSeries.setData(chartData);
      } catch (err) {
        console.error('[StockChart] bomb setData error:', err);
      }

      // Bomb crossing markers (safety: setMarkers may not exist in all versions)
      try {
        const markers = detectBombCrossings(chartData, bombLevels);
        if (markers.length > 0 && typeof bombSeries.setMarkers === 'function') {
          bombSeries.setMarkers(markers.sort((a, b) => a.time - b.time));
        }
      } catch (markerErr) {
        console.warn('[StockChart] Bomb markers error:', markerErr);
      }

      // Volume histogram (same as normal chart)
      try {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeries.setData(chartData.map(c => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open
            ? 'rgba(0, 255, 136, 0.3)'
            : 'rgba(255, 71, 87, 0.3)',
        })));
      } catch (volErr) {
        console.warn('[StockChart] Bomb volume error:', volErr);
      }

      // Draw 7 bomb level price lines (with triggered-level styling)
      bombLevels.forEach(level => {
        try {
          const isTriggered = triggeredLevels.includes(level.tier);
          const isSpectateTarget = isSpectateView && spectateLevel?.tier === level.tier;
          const line = bombSeries.createPriceLine({
            price: level.price,
            color: isSpectateView
              ? (isSpectateTarget ? level.color : 'rgba(255,255,255,0.15)')
              : level.color,
            lineWidth: isTriggered ? 3 : (isSpectateTarget ? 4 : level.lineWidth),
            lineStyle: isTriggered ? 0 : level.lineStyle,
            axisLabelVisible: isTriggered || isSpectateTarget,
            title: isTriggered
              ? (level.points > 0 ? `\u2705 ${level.label} HIT!` : `\u274C ${level.label} HIT!`)
              : level.label,
          });
          bombPriceLinesRef.current.push(line);
        } catch (e) {
          console.warn('[StockChart] Bomb level error:', e);
        }
      });

      // Spectate mode: add starting price context line
      if (isSpectateView && bombData?.baselinePrice) {
        try {
          bombSeries.createPriceLine({
            price: bombData.baselinePrice,
            color: 'rgba(255, 255, 255, 0.35)',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Start',
          });
        } catch (e) {
          console.warn('[StockChart] Start line error:', e);
        }
      }
    } else {
      // Normal view: Candlestick + volume
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: HOLO_COLORS.green,
        downColor: '#ff4757',
        borderUpColor: HOLO_COLORS.green,
        borderDownColor: '#ff4757',
        wickUpColor: HOLO_COLORS.green,
        wickDownColor: '#ff4757',
      });
      candleSeriesRef.current = candleSeries;

      try {
        candleSeries.setData(chartData);
      } catch (err) {
        console.error('[StockChart] setData error:', err);
      }

      // Volume histogram
      try {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        const volumeData = chartData.map(c => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open
            ? 'rgba(0, 255, 136, 0.3)'
            : 'rgba(255, 71, 87, 0.3)',
        }));

        volumeSeries.setData(volumeData);
      } catch (volErr) {
        console.warn('[StockChart] Volume error:', volErr);
      }
    }

    if (isSpectateView) {
      // Spectate: wider candles, right margin, fit all returned candles
      // barSpacing 12+ makes hourly fallback candles large and readable
      chart.timeScale().applyOptions({ barSpacing: 12, rightOffset: 3 });
      // Wait a frame for chart to process data before fitting
      requestAnimationFrame(() => {
        if (chartRef.current) {
          chart.timeScale().fitContent();
          chart.timeScale().scrollToRealTime();
        }
      });
    } else {
      chart.timeScale().fitContent();
    }

    // ResizeObserver for responsive
    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      smaSeriesRefs.current = [];
      levelLinesRef.current = [];
      highlightLineRef.current = null;
      bombPriceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [chartData, height, timeframe, isBombView, isSpectateView, bombLevels, triggeredLevels, spectateLevel]);

  // Bomb view: subtle style enhancement when price is within 0.5% of a threshold
  // No animation — just thicker line + brighter color to signal proximity
  useEffect(() => {
    if (!isBombView || bombLevels.length === 0 || bombPriceLinesRef.current.length === 0) return;
    if (!chartData || chartData.length === 0) return;

    const latestClose = chartData[chartData.length - 1]?.close;
    if (!latestClose) return;

    bombLevels.forEach((level, idx) => {
      if (level.tier === 'baseline') return;
      const line = bombPriceLinesRef.current[idx];
      if (!line) return;
      const dist = Math.abs(latestClose - level.price) / level.price;
      const isClose = dist < 0.005;
      try {
        if (isClose) {
          line.applyOptions({
            lineWidth: 3,
            lineStyle: 0, // Solid when close
          });
        }
      } catch { /* line may be removed */ }
    });
  }, [isBombView, bombLevels, chartData]);

  // SMA overlay
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    if (isBombView) return;

    // Remove existing SMA series
    smaSeriesRefs.current.forEach(s => {
      try { chartRef.current.removeSeries(s); } catch { /* already removed */ }
    });
    smaSeriesRefs.current = [];

    if (!showSMA || !smaData) return;

    // Detect intraday
    const sampleDate = ohlcvData?.[0]?.date || ohlcvData?.[0]?.datetime || '';
    const isIntraday = typeof sampleDate === 'string' && (sampleDate.includes('T') || sampleDate.includes(':'));

    const configs = [
      { key: 'sma20', color: '#00d9ff', width: 1 },
      { key: 'sma50', color: '#f59e0b', width: 1 },
    ];

    configs.forEach(({ key, color, width }) => {
      const data = smaData[key];
      if (!data || data.length === 0) return;

      try {
        const series = chartRef.current.addSeries(LineSeries, {
          color,
          lineWidth: width,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        // SMA data is newest-first, reverse for chart
        const formatted = [...data].reverse()
          .map(d => ({
            time: formatTime(d.date, isIntraday),
            value: d.value,
          }))
          .filter(d => d.time != null && Number.isFinite(d.value));

        if (formatted.length > 0) {
          series.setData(formatted);
          smaSeriesRefs.current.push(series);
        } else {
          chartRef.current.removeSeries(series);
        }
      } catch (e) {
        console.warn(`[StockChart] SMA ${key} error:`, e);
      }
    });
  }, [showSMA, smaData, chartData, ohlcvData, isBombView]);

  // S/R level overlay
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (isBombView) return;

    // Remove existing level lines
    levelLinesRef.current.forEach(line => {
      try { candleSeriesRef.current.removePriceLine(line); } catch { /* ok */ }
    });
    levelLinesRef.current = [];

    if (!showSR || !levels) return;

    const allLevels = [
      ...(levels.support || []).map(l => ({ ...l, type: 'SUPPORT' })),
      ...(levels.resistance || []).map(l => ({ ...l, type: 'RESISTANCE' })),
    ];

    allLevels.forEach(level => {
      try {
        const isSupport = level.type === 'SUPPORT';
        const line = candleSeriesRef.current.createPriceLine({
          price: level.price,
          color: isSupport ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 71, 87, 0.5)',
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: '',
        });
        levelLinesRef.current.push(line);
      } catch (e) {
        console.warn('[StockChart] Level line error:', e);
      }
    });
  }, [showSR, levels, chartData, isBombView]);

  // Active highlight line (from TechnicalTabV2 tap)
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (isBombView) return;

    if (highlightLineRef.current) {
      try { candleSeriesRef.current.removePriceLine(highlightLineRef.current); } catch { /* ok */ }
      highlightLineRef.current = null;
    }

    if (!activeHighlight?.price) return;

    try {
      const isSupport = activeHighlight.type === 'SUPPORT';
      highlightLineRef.current = candleSeriesRef.current.createPriceLine({
        price: activeHighlight.price,
        color: isSupport ? HOLO_COLORS.green : '#ff4757',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: '',
      });
    } catch (e) {
      console.warn('[StockChart] Highlight line error:', e);
    }
  }, [activeHighlight, chartData, isBombView]);

  const pillStyle = (active, variant) => {
    const isBomb = variant === 'bomb';
    return {
      padding: '4px 10px',
      borderRadius: '12px',
      border: active
        ? `1px solid ${isBomb ? 'rgba(245, 158, 11, 0.5)' : 'rgba(0, 217, 255, 0.5)'}`
        : `1px solid ${HOLO_COLORS.borderSubtle}`,
      background: active
        ? (isBomb ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 217, 255, 0.2)')
        : HOLO_COLORS.borderSubtle,
      color: active ? (isBomb ? '#f59e0b' : HOLO_COLORS.primary) : HOLO_COLORS.textSecondary,
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s',
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: HOLO_COLORS.bgDeep }}>
      {/* Control bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: HOLO_COLORS.bgCard,
        borderBottom: `1px solid ${isBombView ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 255, 255, 0.05)'}`,
      }}>
        {/* Timeframe pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.key}
              onClick={() => { setIsSpectateMode(false); setSpectateLevel(null); onTimeframeChange(tf.key); }}
              style={pillStyle(timeframe === tf.key)}
            >
              {tf.label}
            </button>
          ))}
          {bombData && (
            <button
              onClick={() => { setIsSpectateMode(false); setSpectateLevel(null); onTimeframeChange('bomb'); }}
              style={pillStyle(isBombView && !isSpectateView, 'bomb')}
            >
              {'\uD83D\uDCA3'}
            </button>
          )}
        </div>

        {/* Overlay toggles - hidden in bomb view */}
        {!isBombView && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setShowSMA(v => !v)} style={pillStyle(showSMA)}>
              SMA
            </button>
            <button onClick={() => setShowSR(v => !v)} style={pillStyle(showSR)}>
              S/R
            </button>
          </div>
        )}
      </div>

      {/* Chart container with distance indicator overlay */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <div
          ref={chartContainerRef}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Spectate mode: Back button */}
        {isSpectateView && (
          <button
            onClick={() => {
              setIsSpectateMode(false);
              setSpectateLevel(null);
              onTimeframeChange('bomb');
            }}
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '4px 12px',
              color: '#e0e0e0',
              fontSize: '13px',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            {'\u2190'} Bomb Chart
          </button>
        )}

        {/* Spectate mode: empty data message */}
        {isSpectateView && chartData.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#a0a0a0',
            fontSize: '14px',
            textAlign: 'center',
            zIndex: 5,
          }}>
            <div>1-minute data not available after market hours</div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#6e7681' }}>
              Spectate mode is available during market hours (9:30 AM – 4:00 PM ET)
            </div>
          </div>
        )}

        {/* Distance-to-next-level indicator (bomb/spectate view) */}
        {isBombView && (nearestLevel.above || nearestLevel.below) && (() => {
          const above = nearestLevel.above;
          const below = nearestLevel.below;
          const closest = above && below
            ? (Math.abs(above.pctAway) <= Math.abs(below.pctAway) ? above : below)
            : (above || below);
          if (!closest) return null;
          const absPct = Math.abs(closest.pctAway);
          const isClose = absPct < 0.5;
          const direction = closest.distance > 0 ? '\u2191' : '\u2193';
          const priceDist = Math.abs(closest.distance).toFixed(2);

          if (isSpectateView) {
            // Spectate mode: compact indicator at top-right, not covering candles
            const urgencyColor = absPct < 0.1 ? '#ef4444' : absPct < 0.3 ? '#ff9500' : '#e0e0e0';
            const urgencyBg = absPct < 0.1 ? 'rgba(239,68,68,0.3)' : absPct < 0.3 ? 'rgba(255,149,0,0.25)' : 'rgba(255,255,255,0.1)';
            const urgencyBorder = absPct < 0.1 ? '#ef4444' : absPct < 0.3 ? '#ff9500' : 'rgba(255,255,255,0.2)';
            const tierLabel = closest.tier ? closest.tier.charAt(0).toUpperCase() + closest.tier.slice(1) : '';
            return (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: urgencyBg,
                border: `1px solid ${urgencyBorder}`,
                borderRadius: '10px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: urgencyColor,
                animation: absPct < 0.2 ? 'bombPulse 0.8s infinite' : absPct < 0.5 ? 'bombPulse 1.5s infinite' : 'none',
                zIndex: 10,
                textAlign: 'center',
              }}>
                <div>{direction} {absPct.toFixed(2)}% to {tierLabel} ({closest.points > 0 ? '+' : ''}{closest.points} pts)</div>
                <div style={{ fontSize: '10px', color: '#a0a0a0', marginTop: '2px' }}>
                  ${priceDist} from ${closest.price?.toFixed(2)} {'\u2022'} SPECTATING
                </div>
              </div>
            );
          }

          // Normal bomb view: small indicator in corner, clickable for spectate
          return (
            <div
              onClick={() => {
                setIsSpectateMode(true);
                setSpectateLevel(closest);
                onTimeframeChange('spectate');
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.75)',
                border: `1px solid ${closest.color}`,
                color: closest.color,
                fontSize: '11px',
                fontWeight: '700',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                zIndex: 10,
                cursor: 'pointer',
                animation: isClose ? 'bombPulse 1.5s ease-in-out infinite' : 'none',
              }}
            >
              <span>{direction}</span>
              <span>{absPct.toFixed(2)}%</span>
              <span style={{ opacity: 0.7 }}>to {closest.points > 0 ? '+' : ''}{closest.points}</span>
              <span style={{ fontSize: '9px', color: '#6e7681', marginLeft: '2px' }}>TAP</span>
            </div>
          );
        })()}
      </div>

      {/* Pulse animation for close-to-level indicator */}
      {isBombView && (
        <style>{`
          @keyframes bombPulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(245, 158, 11, 0.3); }
            50% { opacity: 0.7; box-shadow: 0 0 12px rgba(245, 158, 11, 0.6); }
          }
        `}</style>
      )}
    </div>
  );
};

export default StockChart;
