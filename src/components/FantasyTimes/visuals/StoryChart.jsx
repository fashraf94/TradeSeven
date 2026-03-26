// src/components/FantasyTimes/visuals/StoryChart.jsx
// Price chart visual for FantasyTimes stories — candlestick chart at all sizes.
// Fetches via /api/stocks/chart-data (server-cached) instead of direct EODHD calls.

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { prepareChartData } from '../../Research/chartUtils';
import { detectLevels } from '../../../services/levelDetection';
import { DARK_TOKENS } from '../../../theme/tokens';
import { VISUAL_HEIGHTS } from '../StoryVisualSafe';
import ChartSkeleton from './ChartSkeleton';

// Module-level session cache (L0) — prevents refetch on React re-renders
const chartDataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedData(ticker, timeframe, size) {
  const key = `${ticker}_${timeframe || '1d'}_${size || 'compact'}`;
  const entry = chartDataCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCachedData(ticker, timeframe, size, data) {
  const key = `${ticker}_${timeframe || '1d'}_${size || 'compact'}`;
  chartDataCache.set(key, { data, timestamp: Date.now() });
}

async function fetchChartData(ticker, days) {
  const res = await fetch(`/api/stocks/chart-data?symbol=${encodeURIComponent(ticker)}&days=${days}`);
  if (!res.ok) throw new Error(`Chart API ${res.status}`);
  const json = await res.json();
  if (!json.success || !json.data) throw new Error('No chart data');
  return json.data;
}

async function fetchIntradayData(ticker) {
  const res = await fetch(`/api/stocks/historical?symbol=${encodeURIComponent(ticker)}&timeframe=5m&days=1`);
  if (!res.ok) throw new Error(`Historical API ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

export default function StoryChart({ config, size }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const height = VISUAL_HEIGHTS[size] || VISUAL_HEIGHTS.compact;

  // Fetch OHLCV data via server-cached endpoint
  useEffect(() => {
    if (!config.ticker) {
      setLoading(false);
      return;
    }

    const tf = config.timeframe || '1d';
    const cached = getCachedData(config.ticker, tf, size);
    if (cached) {
      setChartData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const isIntraday = tf === 'intraday';
    const apiDays = isIntraday ? 1 : (size === 'expanded' ? 180 : 90);

    const fetchPromise = isIntraday
      ? fetchIntradayData(config.ticker)
      : fetchChartData(config.ticker, apiDays);

    fetchPromise
      .then(raw => {
        if (cancelled || !raw || raw.length === 0) {
          setLoading(false);
          return;
        }
        const prepared = prepareChartData(raw);
        if (prepared.length > 0) {
          setCachedData(config.ticker, tf, size, prepared);
          setChartData(prepared);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [config.ticker, config.timeframe, size]);

  // Create chart when data is ready
  useEffect(() => {
    if (!containerRef.current || !chartData || chartData.length === 0) return;

    const container = containerRef.current;
    const isExpanded = size === 'expanded';
    const chart = createChart(container, {
      width: container.clientWidth,
      height: height,
      layout: {
        background: { type: 'solid', color: isExpanded ? '#0a1628' : 'transparent' },
        textColor: isExpanded ? '#8b949e' : (DARK_TOKENS.textFaint || '#64748b'),
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: isExpanded, color: 'rgba(0,255,255,0.03)' },
        horzLines: { visible: size !== 'micro', color: 'rgba(0,255,255,0.03)' },
      },
      crosshair: {
        mode: size === 'micro' ? 0 : 1,
      },
      rightPriceScale: {
        visible: isExpanded,
        borderVisible: isExpanded,
        borderColor: 'rgba(0,255,255,0.2)',
      },
      timeScale: {
        visible: isExpanded,
        borderVisible: isExpanded,
        borderColor: 'rgba(0,255,255,0.2)',
      },
      watermark: { visible: false },
      handleScroll: isExpanded,
      handleScale: isExpanded,
    });

    chartRef.current = chart;

    if (size === 'expanded') {
      // Expanded: full candlestick with volume + S/R levels
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00ff88',
        downColor: '#ff4757',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff4757',
        borderVisible: false,
      });
      candleSeries.setData(chartData);

      // Volume bars
      try {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: 'rgba(94,234,212,0.15)',
          priceScaleId: 'volume',
          priceFormat: { type: 'volume' },
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeries.setData(chartData.map(c => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(0,255,136,0.2)' : 'rgba(255,71,87,0.2)',
        })));
      } catch (e) {
        console.warn('[StoryChart] Volume error:', e);
      }

      // Previous close reference line
      if (config.previousClose > 0) {
        try {
          candleSeries.createPriceLine({
            price: config.previousClose,
            color: 'rgba(255,255,255,0.2)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
          });
        } catch (e) {
          console.warn('[StoryChart] Price line error:', e);
        }
      }

      // Support/Resistance levels
      if (chartData.length >= 10) {
        try {
          const levels = detectLevels([...chartData].reverse(), {});
          const srLines = [
            ...(levels.support || []).slice(0, 2).map(l => ({ price: l.price, color: 'rgba(16,185,129,0.4)' })),
            ...(levels.resistance || []).slice(0, 2).map(l => ({ price: l.price, color: 'rgba(239,68,68,0.4)' })),
          ];
          srLines.forEach(({ price, color }) => {
            candleSeries.createPriceLine({
              price,
              color,
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: false,
            });
          });
        } catch (e) {
          console.warn('[StoryChart] S/R level error:', e);
        }
      }
    } else if (size === 'compact') {
      // Compact: candlestick + volume (no axes)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00ff88',
        downColor: '#ff4757',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff4757',
        borderVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      candleSeries.setData(chartData);

      // Volume bars
      try {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: 'rgba(94,234,212,0.15)',
          priceScaleId: 'volume',
          priceFormat: { type: 'volume' },
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeries.setData(chartData.map(c => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(0,255,136,0.15)' : 'rgba(255,71,87,0.15)',
        })));
      } catch (e) {
        console.warn('[StoryChart] Compact volume error:', e);
      }

      // Previous close reference line
      if (config.previousClose > 0) {
        try {
          candleSeries.createPriceLine({
            price: config.previousClose,
            color: 'rgba(255,255,255,0.2)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
          });
        } catch (e) {
          console.warn('[StoryChart] Price line error:', e);
        }
      }
    } else {
      // Micro: candlestick only (no volume, no reference lines)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00ff88',
        downColor: '#ff4757',
        wickUpColor: '#00ff88',
        wickDownColor: '#ff4757',
        borderVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      candleSeries.setData(chartData);
    }

    chart.timeScale().fitContent();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, size, height, config.previousClose]);

  const pctDir = config.percentChange > 0 ? 'up' : 'down';
  const tfLabel = config.timeframe === 'intraday' ? 'intraday' : (size === 'expanded' ? '6-month' : '90-day');
  const ariaLabel = `${config.ticker} ${tfLabel} price chart. Current: $${config.currentPrice}, ${pctDir} ${Math.abs(config.percentChange || 0).toFixed(2)}%`;

  if (loading) {
    return <ChartSkeleton height={height} />;
  }

  if (!chartData || chartData.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
      style={{ height, width: '100%', overflow: 'hidden', borderRadius: 8 }}
      role="img"
      aria-label={ariaLabel}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </motion.div>
  );
}
