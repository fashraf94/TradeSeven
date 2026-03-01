// src/components/Research/ReadAcrossAlert.jsx
// Dismissible alert banners showing cross-company impact analysis

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

const IMPACT_COLORS = {
  positive: { border: '#10b981', text: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  negative: { border: '#ef4444', text: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  mixed:    { border: '#8b949e', text: '#8b949e', bg: 'rgba(139, 148, 158, 0.1)' },
};

const DIRECTION_ICON = {
  positive: '\u26A1',
  negative: '\u26A0\uFE0F',
  mixed: '\uD83D\uDD04',
};

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * ReadAcrossAlert — Renders dismissible alert cards for cross-company impact events
 *
 * @param {Array}    props.alerts      - Alert objects from /api/read-across-alerts
 * @param {function} props.onDismiss   - (alertId) => void
 * @param {function} props.onTickerTap - (symbol) => void — opens AssetResearchModal
 */
const ReadAcrossAlert = ({ alerts = [], onDismiss, onTickerTap }) => {
  const [showAll, setShowAll] = useState(false);

  if (!alerts.length) return null;

  const visible = showAll ? alerts : alerts.slice(0, 3);
  const hiddenCount = alerts.length - 3;

  return (
    <div style={{ marginBottom: '12px' }}>
      <AnimatePresence>
        {visible.map(alert => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              background: 'rgba(245, 158, 11, 0.06)',
              borderLeft: '3px solid #f59e0b',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '8px',
              position: 'relative',
            }}
          >
            {/* Header row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ fontSize: '12px' }}>{'\uD83D\uDD17'}</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#f59e0b',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  Read-Across Alert
                </span>
                <span style={{
                  fontSize: '10px',
                  color: HOLO_COLORS.textMuted,
                }}>
                  {timeAgo(alert.timestamp)}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss?.(alert.id); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#556677',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '0 2px',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f59e0b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#556677'; }}
                aria-label="Dismiss alert"
              >
                {'\u00D7'}
              </button>
            </div>

            {/* Headline */}
            <div style={{
              fontSize: '13px',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '6px',
              lineHeight: 1.3,
            }}>
              {DIRECTION_ICON[alert.direction] || '\u26A1'}{' '}
              {alert.headline}
            </div>

            {/* Analysis */}
            <div style={{
              fontSize: '12px',
              color: '#c8d0dc',
              lineHeight: 1.5,
              marginBottom: '10px',
            }}>
              {alert.analysis}
            </div>

            {/* Impacted stock pills */}
            {alert.impactedStocks?.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '8px',
              }}>
                <span style={{
                  fontSize: '10px',
                  color: HOLO_COLORS.textMuted,
                  alignSelf: 'center',
                  marginRight: '2px',
                }}>
                  Impacted:
                </span>
                {alert.impactedStocks.map(stock => {
                  const colors = IMPACT_COLORS[stock.expectedImpact] || IMPACT_COLORS.mixed;
                  const arrow = stock.expectedImpact === 'positive' ? '\u25B2'
                    : stock.expectedImpact === 'negative' ? '\u25BC' : '\u25CF';
                  return (
                    <button
                      key={stock.ticker}
                      onClick={(e) => { e.stopPropagation(); onTickerTap?.(stock.ticker); }}
                      title={stock.reasoning}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 8px',
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: colors.text,
                        cursor: 'pointer',
                      }}
                    >
                      {stock.ticker} {arrow}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Watch items */}
            {alert.watchItems?.length > 0 && (
              <div style={{
                fontSize: '11px',
                color: '#8899aa',
                fontStyle: 'italic',
                lineHeight: 1.4,
              }}>
                {'\uD83D\uDCCD'} Watch: {alert.watchItems.join(' \u2022 ')}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* "View N more" link */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#f59e0b',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          View {hiddenCount} more alert{hiddenCount > 1 ? 's' : ''}
        </button>
      )}
      {showAll && alerts.length > 3 && (
        <button
          onClick={() => setShowAll(false)}
          style={{
            background: 'none',
            border: 'none',
            color: HOLO_COLORS.textMuted,
            fontSize: '11px',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          Show fewer
        </button>
      )}
    </div>
  );
};

export default ReadAcrossAlert;
