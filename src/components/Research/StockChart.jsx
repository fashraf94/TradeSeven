import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { prepareChartData, formatTime } from './chartUtils';

const TIMEFRAMES = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
];

/**
 * StockChart - Interactive candlestick chart with volume, timeframe selector, and overlays.
 * Uses lightweight-charts v5 API.
 */
const StockChart = ({
  ohlcvData,         // Oldest-first processed OHLCV from useResearchData
  rawData,           // Newest-first raw data for SMA computation
  timeframe,         // Current timeframe: '1D' | '1W' | '1M'
  onTimeframeChange, // (tf) => void
  levels,            // { support: [], resistance: [], currentPrice } from detectLevels
  smaData,           // { sma20: [{date,value}], sma50: [{date,value}] } (newest-first)
  activeHighlight,   // Optional: { price, type } for highlighted level
  height = 300,
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const smaSeriesRefs = useRef([]);
  const levelLinesRef = useRef([]);
  const highlightLineRef = useRef(null);

  const [showSMA, setShowSMA] = useState(false);
  const [showSR, setShowSR] = useState(false);

  // Prepare chart-ready data
  const chartData = useMemo(() => {
    if (!ohlcvData || ohlcvData.length === 0) return [];
    return prepareChartData(ohlcvData);
  }, [ohlcvData]);

  // Main chart setup
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: 'solid', color: HOLO_COLORS.bgDeep },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(0, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(0, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(0, 255, 255, 0.3)', width: 1, style: 2, labelBackgroundColor: HOLO_COLORS.bgDeep },
        horzLine: { color: 'rgba(0, 255, 255, 0.3)', width: 1, style: 2, labelBackgroundColor: HOLO_COLORS.bgDeep },
      },
      timeScale: {
        borderColor: 'rgba(0, 255, 255, 0.15)',
        timeVisible: timeframe === '1D',
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 255, 255, 0.15)',
      },
      width: container.clientWidth,
      height: height,
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true },
    });

    chartRef.current = chart;

    // Candlestick series
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

    chart.timeScale().fitContent();

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
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [chartData, height, timeframe]);

  // SMA overlay
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

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
  }, [showSMA, smaData, chartData, ohlcvData]);

  // S/R level overlay
  useEffect(() => {
    if (!candleSeriesRef.current) return;

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
  }, [showSR, levels, chartData]);

  // Active highlight line (from TechnicalTabV2 tap)
  useEffect(() => {
    if (!candleSeriesRef.current) return;

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
  }, [activeHighlight, chartData]);

  const pillStyle = (active) => ({
    padding: '4px 10px',
    borderRadius: '12px',
    border: active
      ? '1px solid rgba(0, 217, 255, 0.5)'
      : `1px solid ${HOLO_COLORS.borderSubtle}`,
    background: active
      ? 'rgba(0, 217, 255, 0.2)'
      : HOLO_COLORS.borderSubtle,
    color: active ? HOLO_COLORS.primary : HOLO_COLORS.textSecondary,
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: HOLO_COLORS.bgDeep }}>
      {/* Control bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: HOLO_COLORS.bgCard,
        borderBottom: '1px solid rgba(0, 255, 255, 0.05)',
      }}>
        {/* Timeframe pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.key}
              onClick={() => onTimeframeChange(tf.key)}
              style={pillStyle(timeframe === tf.key)}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Overlay toggles */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setShowSMA(v => !v)} style={pillStyle(showSMA)}>
            SMA
          </button>
          <button onClick={() => setShowSR(v => !v)} style={pillStyle(showSR)}>
            S/R
          </button>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        style={{ width: '100%', height: `${height}px` }}
      />
    </div>
  );
};

export default StockChart;
