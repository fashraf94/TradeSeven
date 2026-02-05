// src/components/TechnicalAnalysis/CandlestickChart.jsx
// Interactive candlestick chart using lightweight-charts library

import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

// Helper to validate a candle has all required numeric values
const isValidCandle = (candle) => {
  if (!candle || !candle.date) return false;
  const open = parseFloat(candle.open);
  const high = parseFloat(candle.high);
  const low = parseFloat(candle.low);
  const close = parseFloat(candle.close);
  return (
    !isNaN(open) && open > 0 &&
    !isNaN(high) && high > 0 &&
    !isNaN(low) && low > 0 &&
    !isNaN(close) && close > 0
  );
};

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
  const [chartError, setChartError] = React.useState(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Validate and filter data
    if (!ohlcvData || !Array.isArray(ohlcvData) || ohlcvData.length === 0) {
      setChartError('No chart data available');
      return;
    }

    // Filter to only valid candles
    const validCandles = ohlcvData.filter(isValidCandle);

    if (validCandles.length === 0) {
      setChartError('No valid price data available');
      console.warn('[CandlestickChart] All candles filtered out - no valid OHLC values');
      return;
    }

    setChartError(null);

    try {
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

      // Add candlestick series (v5.x API)
      const candleSeries = chart.addSeries(CandlestickSeries, candlestickOptions);
      candleSeriesRef.current = candleSeries;

      // Format and set data - ensure chronological order (oldest first)
      const formattedData = validCandles
        .map(candle => {
          // Normalize date format - extract YYYY-MM-DD if it's an ISO string
          let dateStr = candle.date;
          if (typeof dateStr === 'string' && dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
          }
          return {
            time: dateStr,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
          };
        })
        .sort((a, b) => {
          // Handle date strings
          const dateA = new Date(a.time).getTime();
          const dateB = new Date(b.time).getTime();
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
    } catch (err) {
      console.error('[CandlestickChart] Error creating chart:', err);
      setChartError('Failed to render chart');
    }
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

  // Show error state
  if (chartError) {
    return (
      <div style={{
        position: 'relative',
        width: '100%',
        height: height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a1628',
        borderRadius: '8px',
      }}>
        <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '14px' }}>
          {chartError}
        </span>
      </div>
    );
  }

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
      {ohlcvData?.length > 0 && (
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
      )}
      {/* Period label */}
      {ohlcvData?.length > 0 && (
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
      )}
    </div>
  );
};

export default CandlestickChart;
