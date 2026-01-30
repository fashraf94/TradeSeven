// EventFeed - Live ticker of BaggerBomb events
// Shows timestamp, icon, player, symbol, event type, and points

import React from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Event type configuration
const EVENT_CONFIG = {
  bagger: {
    icon: '💣',
    label: 'BaggerBomb',
    color: HOLO_COLORS.green,
    points: 15,
  },
  doubleBagger: {
    icon: '💣💣',
    label: 'Double Bagger',
    color: HOLO_COLORS.amber,
    points: 30,
  },
  tenBagger: {
    icon: '🚀',
    label: 'TenBagger',
    color: HOLO_COLORS.purple,
    points: 50,
  },
  bust: {
    icon: '📉',
    label: 'Bust',
    color: HOLO_COLORS.amber,
    points: -10,
  },
  crash: {
    icon: '💥',
    label: 'Crash',
    color: HOLO_COLORS.red,
    points: -20,
  },
  meltdown: {
    icon: '🔥',
    label: 'Meltdown',
    color: '#991b1b',
    points: -35,
  },
  // Legacy mappings
  BREAKOUT: {
    icon: '💣',
    label: 'BaggerBomb',
    color: HOLO_COLORS.green,
    points: 15,
  },
  RALLY: {
    icon: '💣💣',
    label: 'Double Bagger',
    color: HOLO_COLORS.amber,
    points: 30,
  },
  MOONSHOT: {
    icon: '🚀',
    label: 'TenBagger',
    color: HOLO_COLORS.purple,
    points: 50,
  },
  BUST: {
    icon: '📉',
    label: 'Bust',
    color: HOLO_COLORS.amber,
    points: -10,
  },
  CRASH: {
    icon: '💥',
    label: 'Crash',
    color: HOLO_COLORS.red,
    points: -20,
  },
  MELTDOWN: {
    icon: '🔥',
    label: 'Meltdown',
    color: '#991b1b',
    points: -35,
  },
};

/**
 * Format timestamp to readable time
 */
const formatTime = (timestamp) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Single event item
 */
function EventItem({ event, isNew = false }) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.bagger;
  const isPositive = (config.points || event.points || 0) > 0;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -20, scale: 0.95 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}50`,
      }}
    >
      {/* Timestamp */}
      <span
        style={{
          fontSize: '11px',
          color: HOLO_COLORS.textMuted,
          minWidth: '50px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(event.timestamp)}
      </span>

      {/* Event Icon */}
      <span style={{ fontSize: '18px' }}>{config.icon}</span>

      {/* Event Details */}
      <div style={{ flex: 1 }}>
        <span style={{ color: HOLO_COLORS.textPrimary, fontWeight: 500 }}>
          {event.player || event.username || 'Player'}
        </span>
        <span style={{ color: HOLO_COLORS.textMuted }}>{': '}</span>
        <span style={{ color: HOLO_COLORS.textSecondary }}>
          {event.symbol}
        </span>
        <span style={{ color: HOLO_COLORS.textMuted }}>{' '}</span>
        <span style={{ color: config.color, fontWeight: 500 }}>
          {config.label}
        </span>
      </div>

      {/* Points */}
      <span
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {isPositive ? '+' : ''}{event.points || config.points}
      </span>
    </motion.div>
  );
}

EventItem.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    type: PropTypes.string.isRequired,
    player: PropTypes.string,
    username: PropTypes.string,
    symbol: PropTypes.string.isRequired,
    points: PropTypes.number,
  }).isRequired,
  isNew: PropTypes.bool,
};

/**
 * EventFeed - Live event ticker
 */
export default function EventFeed({
  events = [],
  maxDisplay = 20,
  emptyMessage = 'No explosions yet. Waiting for action...',
}) {
  // Sort events by timestamp (newest first)
  const sortedEvents = [...events]
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    })
    .slice(0, maxDisplay);

  return (
    <div
      style={{
        margin: '0 16px',
        backgroundColor: HOLO_COLORS.bgElevated,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '14px' }}>🔥</span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: HOLO_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Live Feed
        </span>
        {sortedEvents.length > 0 && (
          <span
            style={{
              fontSize: '11px',
              color: HOLO_COLORS.textMuted,
              marginLeft: 'auto',
            }}
          >
            {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Event List */}
      <div
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        {sortedEvents.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: HOLO_COLORS.textMuted,
              fontSize: '13px',
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {sortedEvents.map((event, index) => (
              <EventItem
                key={event.id || `${event.timestamp}-${event.symbol}-${index}`}
                event={event}
                isNew={index === 0}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

EventFeed.propTypes = {
  /** Array of event objects */
  events: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
      type: PropTypes.string.isRequired,
      player: PropTypes.string,
      username: PropTypes.string,
      symbol: PropTypes.string.isRequired,
      points: PropTypes.number,
    })
  ),
  /** Maximum events to display */
  maxDisplay: PropTypes.number,
  /** Message to show when no events */
  emptyMessage: PropTypes.string,
};

EventFeed.defaultProps = {
  events: [],
  maxDisplay: 20,
  emptyMessage: 'No explosions yet. Waiting for action...',
};

// Export event config for use elsewhere
export { EVENT_CONFIG };
