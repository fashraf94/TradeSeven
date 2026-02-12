// EventFeed - Live ticker of BaggerBomb events
// Shows timestamp, icon, player, symbol, event type, and points
// Features: Slide-in animations, NEW badges for recent events

import React, { useMemo } from 'react';
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

// Time threshold for "NEW" badge (60 seconds)
const NEW_THRESHOLD_MS = 60000;

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
 * Check if event is recent (within NEW_THRESHOLD_MS)
 */
const isRecent = (timestamp) => {
  if (!timestamp) return false;
  const eventTime = new Date(timestamp).getTime();
  return Date.now() - eventTime < NEW_THRESHOLD_MS;
};

/**
 * NEW Badge Component
 */
function NewBadge() {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 6px',
        backgroundColor: HOLO_COLORS.cyan,
        color: HOLO_COLORS.bgDeep,
        fontSize: '9px',
        fontWeight: 700,
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginLeft: '8px',
        boxShadow: `0 0 8px ${HOLO_COLORS.cyan}60`,
      }}
    >
      NEW
    </motion.span>
  );
}

/**
 * Single event item with enhanced animations
 */
function EventItem({ event, index, showNewBadge = false, isOpponent = false }) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.bagger;
  const isPositive = (config.points || event.points || 0) > 0;
  const accentColor = isOpponent ? HOLO_COLORS.red : HOLO_COLORS.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30, height: 0 }}
      animate={{
        opacity: 1,
        x: 0,
        height: 'auto',
        transition: {
          type: 'spring',
          stiffness: 200,
          damping: 20,
          delay: index * 0.05, // Stagger effect
        }
      }}
      exit={{
        opacity: 0,
        x: 30,
        height: 0,
        transition: { duration: 0.2 }
      }}
      layout
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}50`,
        backgroundColor: showNewBadge ? `${accentColor}08` : 'transparent',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left Accent Line for new events */}
      {showNewBadge && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          style={{
            position: 'absolute',
            left: 0,
            top: '10%',
            bottom: '10%',
            width: '3px',
            backgroundColor: accentColor,
            borderRadius: '0 2px 2px 0',
            transformOrigin: 'center',
          }}
        />
      )}

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

      {/* Event Icon with subtle pulse for new events */}
      <motion.span
        animate={showNewBadge ? {
          scale: [1, 1.15, 1],
        } : {}}
        transition={showNewBadge ? {
          duration: 1.5,
          repeat: 2,
          ease: 'easeInOut',
        } : {}}
        style={{ fontSize: '18px' }}
      >
        {config.icon}
      </motion.span>

      {/* Event Details */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
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

        {/* NEW Badge */}
        <AnimatePresence>
          {showNewBadge && <NewBadge />}
        </AnimatePresence>
      </div>

      {/* Points with glow effect for positive */}
      <motion.span
        initial={showNewBadge ? { scale: 0.5 } : {}}
        animate={showNewBadge ? {
          scale: [1, 1.2, 1],
        } : { scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: isPositive ? HOLO_COLORS.green : HOLO_COLORS.red,
          fontVariantNumeric: 'tabular-nums',
          textShadow: showNewBadge
            ? `0 0 10px ${isPositive ? HOLO_COLORS.green : HOLO_COLORS.red}60`
            : 'none',
        }}
      >
        {isPositive ? '+' : ''}{event.points || config.points}
      </motion.span>
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
  index: PropTypes.number,
  showNewBadge: PropTypes.bool,
  isOpponent: PropTypes.bool,
};

/**
 * EventFeed - Live event ticker
 */
export default function EventFeed({
  events = [],
  maxDisplay = 20,
  emptyMessage = 'No explosions yet. Waiting for action...',
  currentUser,
}) {
  // Sort events by timestamp (newest first) and mark new ones
  const sortedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      })
      .slice(0, maxDisplay)
      .map((event) => ({
        ...event,
        isNewEvent: isRecent(event.timestamp),
      }));
  }, [events, maxDisplay]);

  // Count new events for header badge
  const newEventCount = useMemo(() => {
    return sortedEvents.filter(e => e.isNewEvent).length;
  }, [sortedEvents]);

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
        <motion.span
          animate={newEventCount > 0 ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.5, repeat: newEventCount > 0 ? Infinity : 0, repeatDelay: 2 }}
          style={{ fontSize: '14px' }}
        >
          🔥
        </motion.span>
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

        {/* New Events Counter Badge */}
        <AnimatePresence>
          {newEventCount > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '18px',
                height: '18px',
                padding: '0 5px',
                backgroundColor: HOLO_COLORS.red,
                color: HOLO_COLORS.textPrimary,
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '9px',
                boxShadow: `0 0 8px ${HOLO_COLORS.red}60`,
              }}
            >
              {newEventCount}
            </motion.span>
          )}
        </AnimatePresence>

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: HOLO_COLORS.textMuted,
              fontSize: '13px',
            }}
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ marginBottom: '8px', fontSize: '24px' }}
            >
              💤
            </motion.div>
            {emptyMessage}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedEvents.map((event, index) => (
              <EventItem
                key={event.id || `${event.timestamp}-${event.symbol}-${index}`}
                event={event}
                index={index}
                showNewBadge={event.isNewEvent}
                isOpponent={currentUser && event.player !== currentUser}
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
  /** Current user's username — used to distinguish opponent events */
  currentUser: PropTypes.string,
};

EventFeed.defaultProps = {
  events: [],
  maxDisplay: 20,
  emptyMessage: 'No explosions yet. Waiting for action...',
  currentUser: null,
};

// Export event config for use elsewhere
export { EVENT_CONFIG };
