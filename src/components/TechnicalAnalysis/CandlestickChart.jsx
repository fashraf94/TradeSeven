// src/components/TechnicalAnalysis/CandlestickChart.jsx
// Interactive candlestick chart using lightweight-charts library

import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const CandlestickChart = ({
  ohlcvData,
  height = 300,
  levels = [],
  showVolume = false
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const levelLinesRef = useRef([]);

  useEffect(() => {
    if (!chartContainerRef.current || !ohlcvData?.length) return;

    // Chart options with holographic theme
    const chartOptions = {
      layout: {
        background: { type: 'solid', color: '#0a1628' },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(0, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(0, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 0, // Normal crosshair
        vertLine: {
          color: 'rgba(0, 255, 255, 0.3)',
          width: 1,
          style: 2, // Dashed
          labelBackgroundColor: '#0a1628',
        },
        horzLine: {
          color: 'rgba(0, 255, 255, 0.3)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0a1628',
        },
      },
      timeScale: {
        borderColor: 'rgba(0, 255, 255, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 255, 255, 0.2)',
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
    };

    // Create chart
    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    // Candlestick series options
    const candlestickOptions = {
      upColor: '#00ff88',       // Green for up candles
      downColor: '#ff4757',     // Red for down candles
      borderUpColor: '#00ff88',
      borderDownColor: '#ff4757',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff4757',
    };

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries(candlestickOptions);
    candleSeriesRef.current = candleSeries;

    // Format and set data - ensure chronological order (oldest first)
    const formattedData = ohlcvData
      .map(candle => ({
        time: candle.date, // Expects 'YYYY-MM-DD' or Unix timestamp
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
      .sort((a, b) => {
        // Handle both date strings and timestamps
        const dateA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
        const dateB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
        return dateA - dateB;
      });

    candleSeries.setData(formattedData);

    // Fit content to show all candles
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [ohlcvData, height]);

  // Update levels when they change (for S/R overlay - Phase 5)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    // Remove existing level lines
    levelLinesRef.current.forEach(line => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {
        // Line may already be removed
      }
    });
    levelLinesRef.current = [];

    // Add new level lines if provided
    if (levels?.length > 0) {
      levels.forEach(level => {
        const line = candleSeriesRef.current.createPriceLine({
          price: level.price,
          color: level.type === 'support' ? '#22c55e' : '#ef4444',
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: level.label || '',
        });
        levelLinesRef.current.push(line);
      });
    }
  }, [levels]);

  // Calculate price change for display
  const getPriceChange = () => {
    if (!ohlcvData || ohlcvData.length < 2) return { change: 0, percent: 0, isPositive: true };

    // Data comes newest first, so first item is latest
    const latestClose = ohlcvData[0]?.close;
    const oldestClose = ohlcvData[ohlcvData.length - 1]?.close;

    if (!latestClose || !oldestClose) return { change: 0, percent: 0, isPositive: true };

    const change = latestClose - oldestClose;
    const percent = (change / oldestClose) * 100;

    return {
      change,
      percent,
      isPositive: change >= 0,
    };
  };

  const priceChange = getPriceChange();

  return (
    <div style={{ position: 'relative', width: '100%', height: height }}>
      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />
      {/* Price change indicator */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        fontSize: '12px',
        fontWeight: '600',
        color: priceChange.isPositive ? '#00ff88' : '#ff4757',
        backgroundColor: 'rgba(10, 22, 40, 0.8)',
        padding: '4px 8px',
        borderRadius: '4px',
      }}>
        {priceChange.isPositive ? '+' : ''}{priceChange.percent.toFixed(1)}%
      </div>
      {/* Period label */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.4)',
        backgroundColor: 'rgba(10, 22, 40, 0.8)',
        padding: '2px 6px',
        borderRadius: '4px',
      }}>
        {ohlcvData?.length || 0} candles
      </div>
    </div>
  );
};

export default CandlestickChart;
