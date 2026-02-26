// EventFeed - Card-Based Live Event Stream
// ESPN-quality broadcast feed with tiered visual intensity
// Features: Card anatomy (header/body/commentary), tier-specific animations, ClashCast lower thirds

import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Event type configuration (kept for export compatibility)
const EVENT_CONFIG = {
  bagger: {
    icon: '\u{1F4A3}',
    label: 'BaggerBomb',
    color: HOLO_COLORS.green,
    points: 15,
  },
  doubleBagger: {
    icon: '\u{1F4A3}\u{1F4A3}',
    label: 'Double Bagger',
    color: HOLO_COLORS.amber,
    points: 30,
  },
  tenBagger: {
    icon: '\u{1F680}',
    label: 'TenBagger',
    color: HOLO_COLORS.purple,
    points: 50,
  },
  bust: {
    icon: '\u{1F4C9}',
    label: 'Bust',
    color: HOLO_COLORS.amber,
    points: -10,
  },
  crash: {
    icon: '\u{1F4A5}',
    label: 'Crash',
    color: HOLO_COLORS.red,
    points: -20,
  },
  meltdown: {
    icon: '\u{1F525}',
    label: 'Meltdown',
    color: '#991b1b',
    points: -35,
  },
  // Legacy mappings
  BREAKOUT: {
    icon: '\u{1F4A3}',
    label: 'BaggerBomb',
    color: HOLO_COLORS.green,
    points: 15,
  },
  RALLY: {
    icon: '\u{1F4A3}\u{1F4A3}',
    label: 'Double Bagger',
    color: HOLO_COLORS.amber,
    points: 30,
  },
  MOONSHOT: {
    icon: '\u{1F680}',
    label: 'TenBagger',
    color: HOLO_COLORS.purple,
    points: 50,
  },
  BUST: {
    icon: '\u{1F4C9}',
    label: 'Bust',
    color: HOLO_COLORS.amber,
    points: -10,
  },
  CRASH: {
    icon: '\u{1F4A5}',
    label: 'Crash',
    color: HOLO_COLORS.red,
    points: -20,
  },
  MELTDOWN: {
    icon: '\u{1F525}',
    label: 'Meltdown',
    color: '#991b1b',
    points: -35,
  },
  redzone: {
    icon: '\u{1F3AF}',
    label: 'Red Zone',
    color: HOLO_COLORS.amber,
    points: 0,
  },
  swap: {
    icon: '\u{1F504}',
    label: 'Swap',
    color: HOLO_COLORS.cyan,
    points: 0,
  },
};

// ClashCast commentary accent colors by event type
const COMMENTARY_COLORS = {
  bagger: '#00d9ff',
  doubleBagger: '#00d9ff',
  tenBagger: '#00d9ff',
  bust: '#ff3366',
  crash: '#ff3366',
  meltdown: '#ff3366',
  BREAKOUT: '#00d9ff',
  RALLY: '#00d9ff',
  MOONSHOT: '#00d9ff',
  BUST: '#ff3366',
  CRASH: '#ff3366',
  MELTDOWN: '#ff3366',
  LEAD_CHANGE: '#f59e0b',
  SESSION_TRANSITION: '#a78bfa',
  COMEBACK: '#00ff88',
  SUBSTITUTION: '#94a3b8',
  BATTLE_START: '#00d9ff',
  BATTLE_END: '#f59e0b',
  swap: '#94a3b8',
};

// === EVENT TIER CONFIG — Visual intensity scaling ===
const EVENT_TIER_CONFIG = {
  // === POSITIVE EVENTS ===
  bagger: {
    tier: 'standard',
    label: 'BaggerBomb',
    eventColor: '#00d9ff',
    pointsColor: '#00ff88',
    border: '3px solid rgba(0, 217, 255, 0.4)',
    boxShadow: 'none',
    backgroundGradient: 'none',
    bodyGradient: 'none',
    shake: false,
    commentaryDelay: 0.3,
    entryAnimation: { y: -20 },
    pointsSize: '18px',
    pointsGlow: 'none',
    stockSize: '16px',
  },
  doubleBagger: {
    tier: 'big',
    label: 'Double Bagger',
    eventColor: '#00d9ff',
    pointsColor: '#00ff88',
    border: '1px solid rgba(0, 217, 255, 0.5)',
    boxShadow: '0 0 10px rgba(0, 217, 255, 0.2)',
    backgroundGradient: 'none',
    bodyGradient: 'radial-gradient(circle at top right, rgba(0, 217, 255, 0.1), transparent 70%)',
    shake: false,
    commentaryDelay: 0.4,
    entryAnimation: { y: -25 },
    pointsSize: '20px',
    pointsGlow: '0 0 8px rgba(0, 255, 136, 0.4)',
    stockSize: '18px',
  },
  tenBagger: {
    tier: 'explosive',
    label: 'TenBagger!',
    eventColor: '#ffd700',
    pointsColor: '#00ff88',
    border: '2px solid #ffd700',
    boxShadow: '0 0 15px rgba(255, 215, 0, 0.3)',
    backgroundGradient: 'rgba(255, 215, 0, 0.03)',
    bodyGradient: 'radial-gradient(circle at top right, rgba(255, 215, 0, 0.15), transparent 70%)',
    shake: true,
    commentaryDelay: 0.8,
    entryAnimation: { y: -30 },
    pointsSize: '22px',
    pointsGlow: '0 0 10px rgba(0, 255, 136, 0.5)',
    stockSize: '20px',
    viewChartGold: true,
  },

  // === NEGATIVE EVENTS ===
  bust: {
    tier: 'standard',
    label: 'Bust',
    eventColor: '#ff3366',
    pointsColor: '#ff3366',
    border: '3px solid rgba(255, 51, 102, 0.4)',
    boxShadow: 'none',
    backgroundGradient: 'none',
    bodyGradient: 'none',
    shake: false,
    commentaryDelay: 0.3,
    entryAnimation: { y: -20 },
    pointsSize: '18px',
    pointsGlow: 'none',
    stockSize: '16px',
    isNegative: true,
  },
  crash: {
    tier: 'big',
    label: 'Crash!',
    eventColor: '#ff3366',
    pointsColor: '#ff3366',
    border: '1px solid rgba(255, 51, 102, 0.5)',
    boxShadow: '0 0 10px rgba(255, 51, 102, 0.2)',
    backgroundGradient: 'none',
    bodyGradient: 'radial-gradient(circle at top right, rgba(255, 51, 102, 0.1), transparent 70%)',
    shake: false,
    commentaryDelay: 0.4,
    entryAnimation: { y: -25 },
    pointsSize: '20px',
    pointsGlow: '0 0 8px rgba(255, 51, 102, 0.4)',
    stockSize: '18px',
    isNegative: true,
  },
  meltdown: {
    tier: 'explosive',
    label: 'MELTDOWN',
    eventColor: '#ff3366',
    pointsColor: '#ff3366',
    border: '2px solid #ff3366',
    boxShadow: '0 0 15px rgba(255, 51, 102, 0.3)',
    backgroundGradient: 'rgba(255, 51, 102, 0.03)',
    bodyGradient: 'radial-gradient(circle at top right, rgba(255, 51, 102, 0.15), transparent 70%)',
    shake: true,
    commentaryDelay: 0.8,
    entryAnimation: { y: -30 },
    pointsSize: '22px',
    pointsGlow: '0 0 10px rgba(255, 51, 102, 0.5)',
    stockSize: '20px',
    isNegative: true,
  },
};

// Lookup helper — handles various event type string formats + legacy types
const getEventTierConfig = (eventType) => {
  if (!eventType) return EVENT_TIER_CONFIG.bagger;
  const type = eventType.toLowerCase().replace(/[_\s-]/g, '');
  if (type.includes('tenbagger') || type.includes('moonshot')) return EVENT_TIER_CONFIG.tenBagger;
  if (type.includes('doublebagger') || type.includes('rally')) return EVENT_TIER_CONFIG.doubleBagger;
  if (type.includes('bagger') || type.includes('breakout')) return EVENT_TIER_CONFIG.bagger;
  if (type.includes('meltdown')) return EVENT_TIER_CONFIG.meltdown;
  if (type.includes('crash')) return EVENT_TIER_CONFIG.crash;
  if (type.includes('bust')) return EVENT_TIER_CONFIG.bust;
  return EVENT_TIER_CONFIG.bagger;
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

// Get entry animation props based on tier and negative status
const getEntryAnimationProps = (tierConfig) => {
  const isNeg = tierConfig.isNegative;

  if (tierConfig.tier === 'explosive') {
    return {
      initial: { opacity: 0, y: tierConfig.entryAnimation.y },
      animate: {
        opacity: 1,
        y: 0,
        ...(tierConfig.shake ? { x: [0, -2, 2, -2, 2, 0] } : {}),
      },
      transition: isNeg
        ? { duration: 0.3, type: 'tween', ease: [0.22, 1.2, 0.36, 1], x: { duration: 0.3, delay: 0.1 } }
        : { duration: 0.5, type: 'spring', bounce: 0.4, x: { duration: 0.3, delay: 0.1 } },
    };
  }

  if (tierConfig.tier === 'big') {
    return {
      initial: { opacity: 0, y: tierConfig.entryAnimation.y },
      animate: { opacity: 1, y: 0 },
      transition: isNeg
        ? { duration: 0.3, type: 'tween', ease: [0.22, 1.2, 0.36, 1] }
        : { duration: 0.45, type: 'spring', bounce: 0.35 },
    };
  }

  // Standard tier
  return {
    initial: { opacity: 0, y: tierConfig.entryAnimation.y },
    animate: { opacity: 1, y: 0 },
    transition: isNeg
      ? { duration: 0.3, type: 'tween', ease: [0.22, 1.2, 0.36, 1] }
      : { duration: 0.4, type: 'spring', bounce: 0.3 },
  };
};

/**
 * Commentary Lower Third — shared between breakout cards and special events
 */
function CommentaryLowerThird({ commentary, commentaryLoading, delay = 0.3 }) {
  if (!commentary && !commentaryLoading) return null;

  return (
    <motion.div
      style={{
        backgroundColor: '#050812',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
      }}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <div style={{ paddingTop: '12px', paddingLeft: '16px', paddingRight: '16px' }}>
        <div style={{
          color: '#64748b',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '6px',
        }}>
          <span>{'\u{1F399}\uFE0F'}</span> ClashCast Live
        </div>
        {commentaryLoading ? (
          <motion.p
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{
              color: '#94a3b8',
              fontSize: '14px',
              fontStyle: 'italic',
              lineHeight: '1.5',
              margin: '0 0 16px 0',
            }}
          >
            {'\u00B7\u00B7\u00B7'}
          </motion.p>
        ) : (
          <motion.p
            style={{
              color: '#94a3b8',
              fontSize: '14px',
              fontStyle: 'italic',
              lineHeight: '1.5',
              margin: '0 0 16px 0',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.3, duration: 0.3 }}
          >
            &ldquo;{commentary}&rdquo;
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Breakout Event Card — BaggerBomb, DoubleBagger, TenBagger, Bust, Crash, Meltdown
 * 3-section anatomy: Header → Body → Commentary Lower Third
 */
function BreakoutEventCard({ event, tierConfig, onRedZoneTap, commentary, commentaryLoading }) {
  const animProps = getEntryAnimationProps(tierConfig);
  const isPositive = !tierConfig.isNegative;
  const pointsValue = event.points || (EVENT_CONFIG[event.type] || EVENT_CONFIG.bagger).points;
  const pointsDisplay = `${isPositive ? '+' : ''}${pointsValue}`;

  const viewChartColor = tierConfig.viewChartGold ? '#ffd700' : '#00d9ff';
  const viewChartBorder = tierConfig.viewChartGold
    ? '1px solid rgba(255, 215, 0, 0.3)'
    : '1px solid rgba(0, 217, 255, 0.3)';
  const viewChartBg = tierConfig.viewChartGold
    ? 'rgba(255, 215, 0, 0.1)'
    : 'rgba(0, 217, 255, 0.1)';

  return (
    <motion.div
      style={{
        backgroundColor: tierConfig.backgroundGradient !== 'none'
          ? tierConfig.backgroundGradient
          : 'rgba(15, 23, 42, 0.8)',
        border: tierConfig.border,
        boxShadow: tierConfig.boxShadow !== 'none' ? tierConfig.boxShadow : undefined,
        borderRadius: '12px',
        margin: '0 0 12px 0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
      initial={animProps.initial}
      animate={animProps.animate}
      exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
      transition={animProps.transition}
    >
      {/* Section 1: Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: `1px solid ${tierConfig.eventColor}1a`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#e2e8f0',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 'normal' }}>
            {formatTime(event.timestamp)}
          </span>
          <span>{event.player || event.username || 'Player'}</span>
        </div>
        <div style={{
          color: tierConfig.pointsColor,
          fontSize: tierConfig.pointsSize,
          fontWeight: 900,
          textShadow: tierConfig.pointsGlow !== 'none' ? tierConfig.pointsGlow : undefined,
        }}>
          {pointsDisplay}
        </div>
      </div>

      {/* Section 2: Body Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        background: tierConfig.bodyGradient !== 'none' ? tierConfig.bodyGradient : undefined,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{
            color: '#ffffff',
            fontSize: tierConfig.stockSize,
            fontWeight: 800,
            letterSpacing: '0.5px',
          }}>
            {event.symbol}
          </span>
          <span style={{
            color: tierConfig.eventColor,
            fontSize: '14px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {tierConfig.label}
          </span>
        </div>
        {onRedZoneTap && (
          <button
            onClick={(e) => { e.stopPropagation(); onRedZoneTap(event); }}
            style={{
              backgroundColor: viewChartBg,
              color: viewChartColor,
              border: viewChartBorder,
              borderRadius: '20px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: '100px',
            }}
          >
            View Chart
          </button>
        )}
      </div>

      {/* Section 3: Commentary Lower Third */}
      <CommentaryLowerThird
        commentary={commentary}
        commentaryLoading={commentaryLoading}
        delay={tierConfig.commentaryDelay}
      />
    </motion.div>
  );
}

/**
 * Lead Change Banner — full-width amber banner breaking card flow
 */
function LeadChangeBanner({ event, commentary, commentaryLoading }) {
  const playerName = event.player || event.username || 'Player';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderTop: '1px solid rgba(245, 158, 11, 0.4)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
        padding: '12px 16px',
        textAlign: 'center',
        margin: '8px 0',
      }}
    >
      <div style={{
        color: '#f59e0b',
        fontSize: '14px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        {'\u2694\uFE0F'} LEAD CHANGE &mdash; {playerName} TAKES THE LEAD
      </div>
      {(commentary || commentaryLoading) && (
        <div style={{ marginTop: '10px' }}>
          <CommentaryLowerThird
            commentary={commentary}
            commentaryLoading={commentaryLoading}
            delay={0.4}
          />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Session Transition Pill — center-aligned pill between cards
 */
function SessionTransitionPill({ event, commentary, commentaryLoading }) {
  const label = event.label || event.commentary || 'Session Change';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        margin: '4px 0',
      }}
    >
      <div style={{
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        border: '1px solid rgba(167, 139, 250, 0.3)',
        borderRadius: '20px',
        padding: '6px 16px',
        color: '#a78bfa',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        {label}
      </div>
      {(commentary || commentaryLoading) && (
        <div style={{ marginTop: '8px', width: '100%' }}>
          <CommentaryLowerThird
            commentary={commentary}
            commentaryLoading={commentaryLoading}
            delay={0.3}
          />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Battle Start/End Banner — full-width gradient banner
 */
function BattleBanner({ event, commentary, commentaryLoading }) {
  const isBattleEnd = event.type === 'BATTLE_END';
  const bannerText = isBattleEnd ? '\u{1F3C6} FINAL BELL' : '\u{1F514} BATTLE IS LIVE';
  const textColor = isBattleEnd ? '#ffd700' : '#00d9ff';
  const borderColor = isBattleEnd
    ? '1px solid rgba(255, 215, 0, 0.3)'
    : '1px solid rgba(0, 217, 255, 0.3)';
  const bgGradient = isBattleEnd
    ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(139, 92, 246, 0.15))'
    : 'linear-gradient(135deg, rgba(0, 217, 255, 0.15), rgba(139, 92, 246, 0.15))';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
      style={{
        background: bgGradient,
        border: borderColor,
        borderRadius: '12px',
        padding: '16px',
        textAlign: 'center',
        margin: '0 0 12px 0',
        overflow: 'hidden',
      }}
    >
      <div style={{
        color: textColor,
        fontSize: '16px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
      }}>
        {bannerText}
      </div>
      {/* Battle events always render commentary */}
      <CommentaryLowerThird
        commentary={commentary || event.commentary}
        commentaryLoading={commentaryLoading}
        delay={0.5}
      />
    </motion.div>
  );
}

/**
 * Approaching Alert Card (Red Zone) — enhanced with amber sweep progress bar
 */
function ApproachingAlertCard({ event, onRedZoneTap }) {
  const rzColor = event.direction === 'negative' ? HOLO_COLORS.red : HOLO_COLORS.amber;
  const percentage = event.progress || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.35, type: 'spring', bounce: 0.25 }}
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '12px',
        padding: '12px 16px',
        margin: '0 0 12px 0',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '4px',
            marginBottom: '8px',
          }}>
            <span style={{ color: HOLO_COLORS.textPrimary, fontWeight: 600, fontSize: '13px' }}>
              {event.player || 'Player'}
            </span>
            <span style={{ color: HOLO_COLORS.textMuted, fontSize: '13px' }}>{': '}</span>
            <span style={{ color: HOLO_COLORS.textSecondary, fontWeight: 600, fontSize: '13px' }}>
              {event.symbol}
            </span>
            <span style={{ color: rzColor, fontWeight: 600, fontSize: '12px' }}>
              approaching {EVENT_CONFIG[event.targetThreshold]?.label || event.targetThreshold}!
            </span>
            <span style={{ fontSize: '11px', color: rzColor, fontWeight: 700, marginLeft: '4px' }}>
              {percentage}%
            </span>
          </div>
          {/* Amber sweep progress bar */}
          <div style={{
            width: '100%',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: `${rzColor}30`,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              borderRadius: '2px',
              background: `linear-gradient(90deg, transparent 0%, ${rzColor}cc 50%, transparent 100%)`,
              backgroundSize: '200% 100%',
              animation: 'amberSweep 2s ease-in-out infinite',
              width: `${percentage}%`,
            }} />
          </div>
        </div>
        {onRedZoneTap && (
          <button
            onClick={(e) => { e.stopPropagation(); onRedZoneTap(event); }}
            style={{
              backgroundColor: `${rzColor}15`,
              color: rzColor,
              border: `1px solid ${rzColor}40`,
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flexShrink: 0,
            }}
          >
            View Chart
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Swap Event Card — minimal card treatment
 */
function SwapEventCard({ event }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: '12px',
        padding: '12px 16px',
        margin: '0 0 12px 0',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '16px' }}>{'\u{1F504}'}</span>
        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 'normal' }}>
          {formatTime(event.timestamp)}
        </span>
        <span style={{ color: HOLO_COLORS.textPrimary, fontWeight: 600, fontSize: '13px' }}>
          {event.player || 'Player'}
        </span>
        <span style={{ color: HOLO_COLORS.textMuted, fontSize: '13px' }}>swapped</span>
        <span style={{ color: HOLO_COLORS.red, fontWeight: 600, fontSize: '13px' }}>
          {event.removedSymbol}
        </span>
        <span style={{ color: HOLO_COLORS.textMuted, fontSize: '13px' }}>{'\u2192'}</span>
        <span style={{ color: HOLO_COLORS.green, fontWeight: 600, fontSize: '13px' }}>
          {event.addedSymbol}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * EventItem — routes events to the appropriate card/banner component
 */
function EventItem({ event, onRedZoneTap, commentary = null, commentaryLoading = false }) {
  const isSynthetic = event.isSynthetic;
  const isRedZone = event.type === 'redzone';
  const isSwap = event.type === 'swap';

  // Synthetic events: route to specific banner/pill components
  if (isSynthetic) {
    const synthCommentary = event.commentary || commentary;
    const synthType = event.type;

    if (synthType === 'LEAD_CHANGE') {
      return (
        <LeadChangeBanner
          event={event}
          commentary={synthCommentary}
          commentaryLoading={commentaryLoading}
        />
      );
    }

    if (synthType === 'SESSION_TRANSITION') {
      return (
        <SessionTransitionPill
          event={event}
          commentary={synthCommentary}
          commentaryLoading={commentaryLoading}
        />
      );
    }

    if (synthType === 'BATTLE_START' || synthType === 'BATTLE_END') {
      return (
        <BattleBanner
          event={event}
          commentary={synthCommentary}
          commentaryLoading={commentaryLoading}
        />
      );
    }

    // Fallback for other synthetic types (COMEBACK, SUBSTITUTION, etc.)
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          border: `1px solid ${COMMENTARY_COLORS[synthType] || HOLO_COLORS.cyan}40`,
          borderRadius: '12px',
          padding: '12px 16px',
          margin: '0 0 12px 0',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{'\u{1F399}\uFE0F'}</span>
          {!synthCommentary ? (
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: '13px', color: HOLO_COLORS.textMuted, fontStyle: 'italic' }}
            >
              {'\u00B7\u00B7\u00B7'}
            </motion.span>
          ) : (
            <p style={{
              fontSize: '13px',
              color: HOLO_COLORS.textMuted,
              fontStyle: 'italic',
              lineHeight: '1.5',
              margin: 0,
            }}>
              {synthCommentary}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // Red Zone (approaching alerts)
  if (isRedZone) {
    return <ApproachingAlertCard event={event} onRedZoneTap={onRedZoneTap} />;
  }

  // Swap events
  if (isSwap) {
    return <SwapEventCard event={event} />;
  }

  // Breakout events — the main card-based rendering
  const tierConfig = getEventTierConfig(event.type);
  return (
    <BreakoutEventCard
      event={event}
      tierConfig={tierConfig}
      onRedZoneTap={onRedZoneTap}
      commentary={commentary}
      commentaryLoading={commentaryLoading}
    />
  );
}

EventItem.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    type: PropTypes.string.isRequired,
    player: PropTypes.string,
    username: PropTypes.string,
    symbol: PropTypes.string,
    points: PropTypes.number,
  }).isRequired,
  onRedZoneTap: PropTypes.func,
  commentary: PropTypes.string,
  commentaryLoading: PropTypes.bool,
};

/**
 * EventFeed - Card-based live event stream with ClashCast commentary
 */
export default function EventFeed({
  events = [],
  maxDisplay = 20,
  emptyMessage = 'No explosions yet. Waiting for action...',
  currentUser,
  onRedZoneTap,
  getEventCommentary,
  clashCastActive = false,
  syntheticEvents = [],
}) {
  // Inject CSS keyframes for amber sweep animation
  useEffect(() => {
    const styleId = 'eventfeed-animations';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes amberSweep {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Merge real events with synthetic commentary events, sort by timestamp (newest first)
  const sortedEvents = useMemo(() => {
    const allEvents = [...events, ...syntheticEvents];
    const sorted = allEvents
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

    // Dedup redzone events: keep only the most recent per symbol+target+direction
    const seenRedZone = new Set();
    const deduped = sorted.filter(event => {
      if (event.type === 'redzone') {
        const key = `${event.symbol}-${event.targetThreshold}-${event.direction}`;
        if (seenRedZone.has(key)) return false;
        seenRedZone.add(key);
      }
      return true;
    });

    return deduped
      .slice(0, maxDisplay)
      .map((event) => ({
        ...event,
        isNewEvent: isRecent(event.timestamp),
      }));
  }, [events, syntheticEvents, maxDisplay]);

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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{'\u{1F525}'}</span>
          <span style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Live Feed
          </span>
          {clashCastActive && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}>
              <motion.span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>
                {'\u{1F399}\uFE0F'} LIVE
              </span>
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Event List */}
      <div
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '8px 12px',
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
              {'\u{1F4A4}'}
            </motion.div>
            {emptyMessage}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedEvents.map((event, index) => {
              const commentaryData = getEventCommentary ? getEventCommentary(event.id) : null;
              return (
                <EventItem
                  key={event.id || `${event.timestamp}-${event.symbol}-${index}`}
                  event={event}
                  onRedZoneTap={event.type !== 'swap' && !event.isSynthetic ? onRedZoneTap : undefined}
                  commentary={commentaryData?.text || null}
                  commentaryLoading={commentaryData?.isLoading || false}
                />
              );
            })}
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
      symbol: PropTypes.string,
      points: PropTypes.number,
    })
  ),
  /** Maximum events to display */
  maxDisplay: PropTypes.number,
  /** Message to show when no events */
  emptyMessage: PropTypes.string,
  /** Current user's username — used to distinguish opponent events */
  currentUser: PropTypes.string,
  /** Callback when user taps a Red Zone event's "View Chart" button */
  onRedZoneTap: PropTypes.func,
  /** ClashCast: function(eventId) => { text, isLoading } | null */
  getEventCommentary: PropTypes.func,
  /** ClashCast: whether commentary engine is running */
  clashCastActive: PropTypes.bool,
  /** ClashCast: synthetic commentary events (lead changes, session transitions) */
  syntheticEvents: PropTypes.array,
};

EventFeed.defaultProps = {
  events: [],
  maxDisplay: 20,
  emptyMessage: 'No explosions yet. Waiting for action...',
  currentUser: null,
  getEventCommentary: null,
  clashCastActive: false,
  syntheticEvents: [],
};

// Export event config for use elsewhere
export { EVENT_CONFIG };
