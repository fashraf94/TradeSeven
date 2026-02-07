// src/components/TechnicalAnalysis/ExploreTab.jsx
// Conversational Q&A tab for technical analysis exploration

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getExploreQuestions } from '../../services/technicalAnalysisAI';
import { getRVOLTierColor } from './utils/colors';

/**
 * Get tooltip content for each indicator metric
 */
const getTooltipContent = (metricId, indicators) => {
  switch (metricId) {
    case 'rsi': {
      const val = indicators?.rsi?.value;
      const isNum = typeof val === 'number';
      let zoneText = 'No data available';
      if (isNum) {
        if (val >= 70) zoneText = 'Overbought territory — buyers may be overextended';
        else if (val >= 60) zoneText = 'Bullish momentum — buyers in control';
        else if (val >= 40) zoneText = 'Neutral zone — no strong directional bias';
        else if (val >= 30) zoneText = 'Approaching oversold — bearish momentum but nearing support';
        else zoneText = 'Oversold territory — sellers may be exhausted';
      }
      return {
        title: 'RSI (Relative Strength Index)',
        what: 'Measures the speed and magnitude of recent price changes on a scale of 0-100.',
        current: isNum ? `RSI ${val.toFixed(0)} — ${zoneText}` : 'No data',
        why: 'RSI above 70 suggests overbought (due for a pullback). Below 30 suggests oversold (potential bounce). Between 40-60 is neutral.',
      };
    }
    case 'macd': {
      const val = indicators?.macd?.histogram;
      const isNum = typeof val === 'number';
      let interpText = 'No data available';
      if (isNum) {
        if (Math.abs(val) < 0.5) interpText = 'Momentum is flat — potential trend change incoming';
        else if (val > 0) interpText = 'Bullish momentum — 12-day EMA is above 26-day EMA';
        else interpText = 'Bearish momentum — 12-day EMA is below 26-day EMA';
      }
      return {
        title: 'MACD (Moving Average Convergence Divergence)',
        what: 'Tracks the relationship between two moving averages (12-day and 26-day EMA) to identify momentum shifts.',
        current: isNum ? `MACD ${val > 0 ? '+' : ''}${val.toFixed(2)} — ${interpText}` : 'No data',
        why: 'When MACD crosses above its signal line, momentum is shifting bullish. Below = bearish. The histogram shows acceleration or deceleration.',
      };
    }
    case 'sma50': {
      const pos = indicators?.sma50?.position;
      return {
        title: '50 SMA (50-Day Simple Moving Average)',
        what: 'The average closing price over the last 50 trading days. Acts as a medium-term trend indicator.',
        current: pos ? `Price is ${pos} the 50 SMA` : 'No data',
        why: 'Stocks above their 50 SMA are generally in an uptrend. Below suggests a downtrend. The 50 SMA acts as dynamic support or resistance.',
      };
    }
    case 'atr': {
      const pct = indicators?.atr?.percent;
      const isNum = typeof pct === 'number';
      let interpText = 'No data available';
      if (isNum) {
        if (pct < 1.0) interpText = 'Low volatility — the stock moves quietly';
        else if (pct < 2.0) interpText = 'Moderate volatility — typical for large-cap stocks';
        else if (pct < 3.5) interpText = 'Elevated volatility — expect meaningful daily swings';
        else interpText = 'High volatility — large daily moves are normal';
      }
      return {
        title: 'ATR (Average True Range)',
        what: 'Measures daily price volatility as a percentage of the stock price, based on the average daily range over 14 periods.',
        current: isNum ? `ATR ${pct.toFixed(1)}% — ${interpText}` : 'No data',
        why: `Higher ATR means wider daily price swings. A ${isNum ? pct.toFixed(1) : '?'}% ATR means daily swings of that magnitude are normal.`,
      };
    }
    case 'rvol': {
      const val = indicators?.rvol?.value;
      const tier = indicators?.rvol?.tier;
      const label = indicators?.rvol?.label;
      return {
        title: 'RVOL (Relative Volume)',
        what: "Today's volume compared to the 20-day average volume. An RVOL of 2.0x means twice the normal volume.",
        current: val != null ? `RVOL ${val}x — ${label || tier || 'Unknown'}` : 'No data',
        why: 'Volume confirms price moves. A breakout on high RVOL (>2.5x) has institutional backing. A move on low RVOL (<0.75x) lacks conviction. Think of volume as the "fuel" behind a price move.',
      };
    }
    default:
      return null;
  }
};

/**
 * IndicatorTooltip — shows educational content for a metric
 */
const IndicatorTooltip = ({ content, onClose }) => {
  const tooltipRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  if (!content) return null;

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: '8px',
        padding: '14px',
        backgroundColor: 'rgba(10, 22, 40, 0.95)',
        border: '1px solid rgba(0, 255, 255, 0.2)',
        borderRadius: '10px',
        zIndex: 100,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#00ffff' }}>{content.title}</div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: '14px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', lineHeight: 1.5 }}>
        <strong style={{ color: 'rgba(255,255,255,0.8)' }}>What:</strong> {content.what}
      </div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', marginBottom: '6px', lineHeight: 1.5, fontWeight: 500 }}>
        <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Current:</strong> {content.current}
      </div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
        <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Why it matters:</strong> {content.why}
      </div>
    </div>
  );
};

const ExploreTab = ({ indicators, conversation, isLoading, onAskQuestion, onReset }) => {
  const questions = getExploreQuestions();
  const [openTooltip, setOpenTooltip] = useState(null);

  const handleTooltipToggle = (metricId) => {
    setOpenTooltip(prev => prev === metricId ? null : metricId);
  };

  // Info icon button
  const InfoIcon = ({ metricId }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleTooltipToggle(metricId);
      }}
      style={{
        background: 'none',
        border: 'none',
        padding: '0 2px',
        cursor: 'pointer',
        fontSize: '11px',
        color: openTooltip === metricId ? '#00ffff' : 'rgba(0, 255, 255, 0.4)',
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
      aria-label={`Info about ${metricId.toUpperCase()}`}
    >
      &#9432;
    </button>
  );

  // RVOL value color
  const rvolColor = indicators?.rvol?.tier
    ? getRVOLTierColor(indicators.rvol.tier)
    : 'rgba(255,255,255,0.4)';

  return (
    <div>
      {/* Indicator Summary Bar */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '4px',
          padding: '10px 8px',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              RSI <InfoIcon metricId="rsi" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
              {typeof indicators?.rsi?.value === 'number' ? indicators.rsi.value.toFixed(0) : '--'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              MACD <InfoIcon metricId="macd" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: indicators?.macd?.histogram > 0 ? '#00ff88' : '#ff4757' }}>
              {indicators?.macd?.histogram > 0 ? '+' : ''}{typeof indicators?.macd?.histogram === 'number' ? indicators.macd.histogram.toFixed(2) : '--'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              50 SMA <InfoIcon metricId="sma50" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
              {indicators?.sma50?.position || '--'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              ATR <InfoIcon metricId="atr" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
              {indicators?.atr?.percent ? `${indicators.atr.percent.toFixed(1)}%` : '--'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              RVOL <InfoIcon metricId="rvol" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: rvolColor }}>
              {indicators?.rvol?.value != null ? `${indicators.rvol.value.toFixed(1)}x` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Tooltip overlay (positioned below the bar) */}
        {openTooltip && (
          <IndicatorTooltip
            content={getTooltipContent(openTooltip, indicators)}
            onClose={() => setOpenTooltip(null)}
          />
        )}
      </div>

      {/* Conversation Display */}
      {conversation.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {conversation.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: 'rgba(0, 255, 255, 0.05)',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#00ffff', marginBottom: '8px', fontWeight: '600' }}>
                Q: {item.question}
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.6' }}>
                {item.answer}
              </div>

              {/* Follow-up Suggestions */}
              {item.followUps && item.followUps.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {item.followUps.map((followUp, j) => (
                    <button
                      key={j}
                      onClick={() => onAskQuestion(followUp)}
                      disabled={isLoading}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        border: '1px solid rgba(0, 255, 255, 0.3)',
                        borderRadius: '16px',
                        color: '#00ffff',
                        cursor: isLoading ? 'default' : 'pointer',
                        opacity: isLoading ? 0.5 : 1,
                      }}
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {/* Reset Button */}
          <button
            onClick={onReset}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.5)',
              cursor: isLoading ? 'default' : 'pointer',
              marginBottom: '16px',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            Start Over
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 255, 255, 0.05)',
          borderRadius: '12px',
          marginBottom: '16px',
        }}>
          <motion.div
            style={{
              width: '100px',
              height: '3px',
              backgroundColor: 'rgba(0, 255, 255, 0.2)',
              borderRadius: '2px',
              margin: '0 auto',
              overflow: 'hidden',
            }}
          >
            <motion.div
              style={{ height: '100%', backgroundColor: '#00ffff', borderRadius: '2px' }}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
            />
          </motion.div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '12px 0 0' }}>
            Analyzing...
          </p>
        </div>
      )}

      {/* Question Buttons (2x3 grid) */}
      {!isLoading && (
        <>
          <h3 style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
            {conversation.length > 0 ? 'Ask Another Question' : 'Ask a Question'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => onAskQuestion(q.id)}
                disabled={isLoading}
                style={{
                  padding: '14px 12px',
                  fontSize: '13px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 255, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                {q.question}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ExploreTab;
