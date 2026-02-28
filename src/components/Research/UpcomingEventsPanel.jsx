import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// ─── Color tokens ────────────────────────────────────────────
const C = {
  bgCard: HOLO_COLORS.bgCard || '#0d1117',
  bgElevated: HOLO_COLORS.bgElevated || '#161b22',
  cyan: '#00d9ff',
  green: '#00ff88',
  red: '#ff4757',
  amber: '#f59e0b',
  purple: '#a78bfa',
  white: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#484f58',
  border: 'rgba(0,217,255,0.08)',
};

const IMPACT_COLORS = {
  high: C.red,
  medium: C.amber,
  low: C.green,
};

const SIGNIFICANCE_COLORS = {
  high: C.red,
  medium: C.amber,
  low: C.green,
};

// ─── Loading skeleton ────────────────────────────────────────
const SkeletonRow = ({ width }) => (
  <div style={{
    height: '12px',
    width,
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
    animation: 'upcomingShimmer 1.5s ease-in-out infinite',
  }} />
);

// ─── Day abbreviation ────────────────────────────────────────
const shortDay = (day) => {
  if (!day) return '';
  return day.slice(0, 3).toUpperCase();
};

// =============================================================================
// UpcomingEventsPanel
// =============================================================================

const UpcomingEventsPanel = ({
  economicEvents,
  earningsCalendar,
  economicLoading,
  earningsLoading,
  economicError,
  earningsError,
  onRetryEconomic,
  onRetryEarnings,
  onStockTap,
}) => {
  const [activeTab, setActiveTab] = useState('economic');
  const [nextWeekOpen, setNextWeekOpen] = useState(false);

  const isEconomic = activeTab === 'economic';
  const loading = isEconomic ? economicLoading : earningsLoading;
  const error = isEconomic ? economicError : earningsError;
  const onRetry = isEconomic ? onRetryEconomic : onRetryEarnings;

  const data = isEconomic ? economicEvents : earningsCalendar;
  const thisWeek = data?.thisWeek || [];
  const nextWeek = data?.nextWeek || [];
  const highlightText = isEconomic ? data?.highlight : data?.spotlight;

  // ─── Loading state ───────────────────────────────────────
  const renderLoading = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
      <SkeletonRow width="90%" />
      <SkeletonRow width="70%" />
      <SkeletonRow width="80%" />
      <SkeletonRow width="60%" />
    </div>
  );

  // ─── Error state ─────────────────────────────────────────
  const renderError = () => (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '8px' }}>
        Couldn't load {isEconomic ? 'economic events' : 'earnings calendar'}.
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'rgba(0,217,255,0.1)',
            border: '1px solid rgba(0,217,255,0.2)',
            borderRadius: '8px',
            color: C.cyan,
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 14px',
            cursor: 'pointer',
          }}
        >
          Tap to retry
        </button>
      )}
    </div>
  );

  // ─── Economic event row ──────────────────────────────────
  const renderEconomicEvent = (ev, i) => {
    const dotColor = IMPACT_COLORS[ev.impact] || C.textMuted;
    return (
      <div key={i} style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '6px 0',
        borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Impact dot */}
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          marginTop: '5px',
        }} />

        {/* Day abbreviation */}
        <span style={{
          fontSize: '9px',
          fontWeight: 700,
          color: C.textMuted,
          width: '28px',
          flexShrink: 0,
          marginTop: '2px',
          letterSpacing: '0.5px',
        }}>
          {shortDay(ev.day)}
        </span>

        {/* Event name + time */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: C.white,
            lineHeight: 1.3,
          }}>
            {ev.event}
          </div>
          {ev.time && (
            <span style={{
              fontSize: '10px',
              color: C.textMuted,
            }}>
              {ev.time}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ─── Earnings event row ──────────────────────────────────
  const renderEarningsEvent = (ev, i) => {
    const dotColor = SIGNIFICANCE_COLORS[ev.significance] || C.textMuted;
    return (
      <div key={i} style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '6px 0',
        borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Significance dot */}
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          marginTop: '5px',
        }} />

        {/* Day abbreviation */}
        <span style={{
          fontSize: '9px',
          fontWeight: 700,
          color: C.textMuted,
          width: '28px',
          flexShrink: 0,
          marginTop: '2px',
          letterSpacing: '0.5px',
        }}>
          {shortDay(ev.day)}
        </span>

        {/* AMC/BMO badge */}
        <span style={{
          fontSize: '8px',
          fontWeight: 700,
          color: ev.timing === 'BMO' ? C.amber : C.purple,
          background: ev.timing === 'BMO' ? 'rgba(245,158,11,0.12)' : 'rgba(167,139,250,0.12)',
          padding: '1px 4px',
          borderRadius: '3px',
          flexShrink: 0,
          marginTop: '2px',
        }}>
          {ev.timing || '—'}
        </span>

        {/* Ticker + name + watchFor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStockTap?.(ev.symbol);
              }}
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
                color: C.cyan,
                background: 'rgba(0,217,255,0.08)',
                border: '1px solid rgba(0,217,255,0.15)',
                borderRadius: '4px',
                padding: '1px 5px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {ev.symbol}
            </button>
            <span style={{
              fontSize: '11px',
              color: C.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {ev.name}
            </span>
          </div>
          {ev.watchFor && (
            <div style={{
              fontSize: '10px',
              color: C.textMuted,
              marginTop: '2px',
              lineHeight: 1.4,
            }}>
              {ev.watchFor}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Events list ─────────────────────────────────────────
  const renderEvents = (events) => {
    if (!events.length) {
      return (
        <div style={{ fontSize: '11px', color: C.textMuted, padding: '8px 0', fontStyle: 'italic' }}>
          No events scheduled
        </div>
      );
    }
    return events.map((ev, i) =>
      isEconomic ? renderEconomicEvent(ev, i) : renderEarningsEvent(ev, i)
    );
  };

  return (
    <div style={{
      background: C.bgCard,
      borderRadius: '14px',
      padding: '16px',
      border: `1px solid ${C.border}`,
    }}>
      {/* ─── Header + Tab toggle ─────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: C.textMuted,
        }}>
          UPCOMING EVENTS
        </div>

        {/* Tab toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '6px',
          padding: '2px',
        }}>
          {['economic', 'earnings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: '9px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === tab ? C.white : C.textMuted,
                background: activeTab === tab ? 'rgba(0,217,255,0.12)' : 'transparent',
                transition: 'all 0.15s ease',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────── */}
      {loading && thisWeek.length === 0 ? renderLoading() :
        error && thisWeek.length === 0 ? renderError() : (
          <>
            {/* This Week */}
            <div style={{ marginBottom: nextWeek.length > 0 ? '8px' : 0 }}>
              {renderEvents(thisWeek)}
            </div>

            {/* Highlight / Spotlight */}
            {highlightText && (
              <div style={{
                fontSize: '11px',
                color: C.textSecondary,
                fontStyle: 'italic',
                lineHeight: 1.5,
                padding: '8px 0',
                borderTop: `1px solid ${C.border}`,
                marginTop: '4px',
              }}>
                {highlightText}
              </div>
            )}

            {/* Next Week — collapsible */}
            {nextWeek.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div
                  onClick={() => setNextWeekOpen(!nextWeekOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    padding: '6px 0',
                  }}
                >
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: C.textMuted,
                  }}>
                    NEXT WEEK
                  </span>
                  <span style={{
                    fontSize: '8px',
                    color: C.textMuted,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '1px 5px',
                    fontWeight: 600,
                  }}>
                    {nextWeek.length}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    color: C.textMuted,
                    transform: nextWeekOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    marginLeft: 'auto',
                  }}>
                    {'\u25BC'}
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {nextWeekOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      {renderEvents(nextWeek)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

      <style>{`
        @keyframes upcomingShimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default UpcomingEventsPanel;
