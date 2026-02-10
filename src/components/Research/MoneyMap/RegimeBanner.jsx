// /src/components/Research/MoneyMap/RegimeBanner.jsx

import React from 'react';
import { FadeIn } from '../../ui/motion';

// ===========================================
// REGIME GLOW COLORS
// Radial gradient overlay at 5% opacity per regime state
// ===========================================
const REGIME_GLOW = {
  FULL_RISK_ON:      'rgba(34, 197, 94, 0.05)',
  LEANING_CYCLICAL:  'rgba(0, 217, 255, 0.05)',
  MIXED:             'transparent',
  LEANING_DEFENSIVE: 'rgba(245, 158, 11, 0.05)',
  FULL_RISK_OFF:     'rgba(239, 68, 68, 0.05)',
  UNKNOWN:           'transparent',
};

// ===========================================
// WEATHER EMOJI MAP
// ===========================================
const WEATHER_EMOJI = {
  'Clear Skies':  '☀️',
  'Partly Sunny': '🌤️',
  'Overcast':     '☁️',
  'Cloudy':       '🌥️',
  'Stormy':       '⛈️',
  'Fog':          '🌫️',
};

/**
 * Format a timestamp into a human-readable "Updated X ago" string
 */
const formatUpdatedTime = (timestamp) => {
  if (!timestamp) return 'Unknown';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

/**
 * RegimeBanner — Market Regime classification card
 * Displays the current market regime, weather analogy, AI narrative,
 * and a subtle background glow matching the regime state.
 *
 * @param {Object} props
 * @param {Object} props.regime - From global.regime ({ regime, label, ... })
 * @param {Object} props.weather - From global.weather ({ weather, description })
 * @param {number} props.computedAt - Timestamp from Date.now()
 */
const RegimeBanner = ({ regime, weather, computedAt, onTooltip, onRefresh, isRefreshing }) => {
  const glowColor = REGIME_GLOW[regime.regime] || 'transparent';
  const weatherEmoji = WEATHER_EMOJI[weather.weather] || '';

  const cardBackground = glowColor !== 'transparent'
    ? `radial-gradient(ellipse at top center, ${glowColor} 0%, transparent 70%), #1c2128`
    : '#1c2128';

  return (
    <FadeIn duration={0.5} style={{
      background: cardBackground,
      border: '1px solid #21262d',
      borderRadius: '16px',
      padding: '20px',
    }}>
      {/* Regime Label */}
      <div style={{
        color: '#8b949e',
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '4px',
      }}>
        <span
          onClick={() => onTooltip?.('regime')}
          style={{
            borderBottom: onTooltip ? '1px dashed #484f58' : 'none',
            cursor: onTooltip ? 'pointer' : 'default',
            paddingBottom: '1px',
          }}
        >MARKET REGIME</span>
      </div>

      {/* Regime Name */}
      <div style={{
        color: '#ffffff',
        fontSize: '20px',
        fontWeight: '700',
        marginBottom: '8px',
      }}>
        {regime.label}
      </div>

      {/* Weather Line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '16px' }}>{weatherEmoji}</span>
        <span style={{
          color: '#8b949e',
          fontSize: '14px',
        }}>
          {weather.weather}
        </span>
      </div>

      {/* AI Narrative / Description */}
      <div style={{
        color: '#e6edf3',
        fontSize: '14px',
        lineHeight: '1.5',
        marginBottom: '16px',
      }}>
        {weather.description}
      </div>

      {/* Footer: Updated time + Refresh icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #21262d',
        paddingTop: '12px',
      }}>
        <span style={{
          color: '#8b949e',
          fontSize: '12px',
        }}>
          Updated {formatUpdatedTime(computedAt)}
        </span>

        {/* Refresh button */}
        <button
          disabled={!onRefresh || isRefreshing}
          onClick={onRefresh}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: onRefresh && !isRefreshing ? 'pointer' : 'not-allowed',
            opacity: onRefresh ? (isRefreshing ? 0.6 : 1) : 0.4,
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'opacity 0.2s',
          }}
          title={isRefreshing ? 'Refreshing...' : 'Refresh data'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isRefreshing ? '#00d9ff' : '#8b949e'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </FadeIn>
  );
};

export default RegimeBanner;
