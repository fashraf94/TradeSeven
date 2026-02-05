// src/components/TechnicalAnalysis/CandlestickChart.jsx
// Interactive candlestick chart using lightweight-charts library

import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

// Strict validation for numeric values - uses Number.isFinite for maximum strictness
const isValidNumber = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(num) && num > 0;
};

/**
 * Convert various time formats to Unix timestamp in seconds
 * lightweight-charts requires time as:
 * - Unix timestamp in SECONDS (not milliseconds)
 * - Or a date string 'YYYY-MM-DD' for daily data
 */
const formatTime = (dateValue, isIntraday = false) => {
  if (!dateValue) return null;

  // If already a Unix timestamp in seconds (10 digits)
  if (typeof dateValue === 'number' && dateValue < 9999999999) {
    return dateValue;
  }

  // If Unix timestamp in milliseconds (13 digits), convert to seconds
  if (typeof dateValue === 'number' && dateValue > 9999999999) {
    return Math.floor(dateValue / 1000);
  }

  // If string, parse it
  if (typeof dateValue === 'string') {
    // For intraday data, convert to Unix timestamp in seconds
    if (isIntraday || dateValue.includes('T') || dateValue.includes(':')) {
      const timestamp = new Date(dateValue).getTime();
      if (isNaN(timestamp)) return null;
      return Math.floor(timestamp / 1000);
    }
    // For daily data, return date string as-is (YYYY-MM-DD format)
    return dateValue.split('T')[0];
  }

  return null;
};

// Helper to validate raw candle data before transformation
const isValidRawCandle = (candle) => {
  if (!candle) return false;
  // Check for date field (could be 'date', 'datetime', or 'timestamp')
  const hasDate = candle.date || candle.datetime || candle.timestamp;
  if (!hasDate) return false;
  return (
    isValidNumber(candle.open) &&
    isValidNumber(candle.high) &&
    isValidNumber(candle.low) &&
    isValidNumber(candle.close)
  );
};

// Helper to validate formatted candle data (after transformation)
const isValidFormattedCandle = (candle) => {
  if (!candle || !candle.time) return false;
  // Time can be number (Unix timestamp) or string (date)
  const validTime = typeof candle.time === 'number'
    ? Number.isFinite(candle.time) && candle.time > 0
    : typeof candle.time === 'string' && candle.time.length > 0;
  return validTime &&
    Number.isFinite(candle.open) && candle.open > 0 &&
    Number.isFinite(candle.high) && candle.high > 0 &&
    Number.isFinite(candle.low) && candle.low > 0 &&
    Number.isFinite(candle.close) && candle.close > 0;
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

    // Validate input data exists
    if (!ohlcvData || !Array.isArray(ohlcvData) || ohlcvData.length === 0) {
      setChartError('No chart data available');
      return;
    }

    // First pass: filter raw candles with detailed logging
    let rawFilteredCount = 0;
    const validRawCandles = ohlcvData.filter((candle, index) => {
      const isValid = isValidRawCandle(candle);
      if (!isValid) {
        rawFilteredCount++;
        if (rawFilteredCount <= 3) {
          console.warn(`[CandlestickChart] Filtered invalid raw candle #${rawFilteredCount}:`, {
            index,
            date: candle?.date,
            open: candle?.open,
            high: candle?.high,
            low: candle?.low,
            close: candle?.close
          });
        }
      }
      return isValid;
    });

    if (rawFilteredCount > 0) {
      console.log(`[CandlestickChart] Raw pass: filtered ${rawFilteredCount} of ${ohlcvData.length} candles`);
    }

    if (validRawCandles.length === 0) {
      setChartError('No valid price data available');
      console.error('[CandlestickChart] All raw candles filtered out');
      return;
    }

    // Diagnostic: Log raw data sample to understand format
    console.log('[CandlestickChart] Raw data sample (first 3):', validRawCandles.slice(0, 3));
    const sampleCandle = validRawCandles[0];
    console.log('[CandlestickChart] Sample candle structure:', {
      date: sampleCandle?.date,
      datetime: sampleCandle?.datetime,
      timestamp: sampleCandle?.timestamp,
      dateType: typeof sampleCandle?.date,
    });

    // Detect if this is intraday data (has time component in date)
    const dateValue = sampleCandle?.date || sampleCandle?.datetime || sampleCandle?.timestamp;
    const isIntraday = typeof dateValue === 'string' && (dateValue.includes('T') || dateValue.includes(':'));
    console.log('[CandlestickChart] Detected intraday data:', isIntraday);

    // Transform data with proper time format conversion
    const transformedData = validRawCandles.map(candle => {
      const rawTime = candle.date || candle.datetime || candle.timestamp;
      const time = formatTime(rawTime, isIntraday);
      const open = Number(candle.open);
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);
      return { time, open, high, low, close };
    });

    // Diagnostic: Log transformed data sample
    console.log('[CandlestickChart] Transformed data sample (first 3):', transformedData.slice(0, 3));
    console.log('[CandlestickChart] Data types:', transformedData[0] ? {
      time: typeof transformedData[0].time,
      timeValue: transformedData[0].time,
      open: typeof transformedData[0].open,
      high: typeof transformedData[0].high,
      low: typeof transformedData[0].low,
      close: typeof transformedData[0].close,
    } : 'no data');

    // Second pass: filter transformed data with detailed logging
    let formattedFilteredCount = 0;
    const validFormattedData = transformedData.filter((candle, index) => {
      const isValid = isValidFormattedCandle(candle);
      if (!isValid) {
        formattedFilteredCount++;
        if (formattedFilteredCount <= 3) {
          console.warn(`[CandlestickChart] Filtered invalid formatted candle #${formattedFilteredCount}:`, candle);
        }
      }
      return isValid;
    });

    if (formattedFilteredCount > 0) {
      console.log(`[CandlestickChart] Formatted pass: filtered ${formattedFilteredCount} more candles`);
    }

    if (validFormattedData.length === 0) {
      setChartError('No valid price data after processing');
      console.error('[CandlestickChart] All formatted candles filtered out');
      return;
    }

    // Sort chronologically (oldest first for lightweight-charts)
    // Handle both numeric timestamps and string dates
    const sortedData = validFormattedData.sort((a, b) => {
      const timeA = typeof a.time === 'number' ? a.time : new Date(a.time).getTime() / 1000;
      const timeB = typeof b.time === 'number' ? b.time : new Date(b.time).getTime() / 1000;
      return timeA - timeB;
    });

    // Log sorted data sample
    console.log('[CandlestickChart] Sorted data (first & last):', {
      first: sortedData[0],
      last: sortedData[sortedData.length - 1],
      count: sortedData.length
    });

    // Final validation summary
    const totalFiltered = ohlcvData.length - sortedData.length;
    if (totalFiltered > 0) {
      console.log(`[CandlestickChart] Total: filtered ${totalFiltered} invalid candles, ${sortedData.length} valid candles remain`);
    } else {
      console.log(`[CandlestickChart] All ${sortedData.length} candles valid`);
    }

    setChartError(null);

    let chart = null;
    let handleResize = null;

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
      chart = createChart(chartContainerRef.current, chartOptions);
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

      // Final safety check before setData
      if (!sortedData || sortedData.length === 0) {
        console.error('[CandlestickChart] No data to set after all validation');
        setChartError('No valid chart data');
        return;
      }

      // ========== DIAGNOSTIC: Check for issues that crash lightweight-charts ==========
      console.log('[CandlestickChart] FULL DATA DUMP (first 5):', JSON.stringify(sortedData.slice(0, 5), null, 2));
      console.log('[CandlestickChart] Total candles:', sortedData.length);
      console.log('[CandlestickChart] Time range:', sortedData[0]?.time, 'to', sortedData[sortedData.length - 1]?.time);

      // Check for duplicate times (lightweight-charts HATES duplicate timestamps)
      const times = sortedData.map(c => c.time);
      const uniqueTimes = new Set(times);
      if (times.length !== uniqueTimes.size) {
        console.error('[CandlestickChart] DUPLICATE TIMES DETECTED!', times.length - uniqueTimes.size, 'duplicates');
        // Find and log duplicates
        const seen = {};
        times.forEach((t, idx) => {
          if (seen[t] !== undefined) {
            console.error(`Duplicate time at index ${idx}:`, t, '(first seen at index', seen[t], ')');
          }
          seen[t] = idx;
        });
      } else {
        console.log('[CandlestickChart] No duplicate times detected');
      }

      // Check time ordering (must be strictly ascending)
      let orderErrors = 0;
      for (let i = 1; i < sortedData.length; i++) {
        const prevTime = sortedData[i - 1].time;
        const currTime = sortedData[i].time;
        // Compare as numbers if numeric, otherwise as strings
        const prev = typeof prevTime === 'number' ? prevTime : new Date(prevTime).getTime();
        const curr = typeof currTime === 'number' ? currTime : new Date(currTime).getTime();
        if (curr <= prev) {
          orderErrors++;
          if (orderErrors <= 3) {
            console.error(`[CandlestickChart] TIME ORDER ERROR at index ${i}:`, prevTime, '>=', currTime);
          }
        }
      }
      if (orderErrors > 0) {
        console.error(`[CandlestickChart] Total time order errors: ${orderErrors}`);
      } else {
        console.log('[CandlestickChart] Time ordering is correct (ascending)');
      }
      // ========== END DIAGNOSTIC ==========

      // Log what we're about to set
      console.log(`[CandlestickChart] Setting ${sortedData.length} candles, first: ${sortedData[0]?.time}, last: ${sortedData[sortedData.length - 1]?.time}`);

      // Set data with comprehensive error handling
      try {
        candleSeries.setData(sortedData);
        console.log('[CandlestickChart] setData completed successfully');
      } catch (setDataErr) {
        console.error('[CandlestickChart] Error in setData:', setDataErr);
        console.error('[CandlestickChart] First candle:', JSON.stringify(sortedData[0]));
        console.error('[CandlestickChart] Last candle:', JSON.stringify(sortedData[sortedData.length - 1]));
        // Try to find problematic candles
        for (let i = 0; i < sortedData.length; i++) {
          const c = sortedData[i];
          if (!isValidFormattedCandle(c)) {
            console.error(`[CandlestickChart] Found bad candle at index ${i}:`, JSON.stringify(c));
          }
        }
        setChartError('Failed to render chart data');
        return;
      }

      // Fit content to show all candles
      try {
        chart.timeScale().fitContent();
      } catch (fitErr) {
        console.warn('[CandlestickChart] Error fitting content:', fitErr);
        // Non-fatal, continue
      }

      // Handle resize
      handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth
          });
        }
      };

      window.addEventListener('resize', handleResize);

    } catch (err) {
      console.error('[CandlestickChart] Error creating chart:', err);
      setChartError('Failed to render chart');
    }

    // Cleanup
    return () => {
      if (handleResize) {
        window.removeEventListener('resize', handleResize);
      }
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
