// EventFeed V2 — Compact Card-Based Live Event Stream
// Two-row layout with edge-lighting, tier-specific animations, inline commentary
// ClashCast commentary appears as an indented italic row beneath the action row

import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// Event type configuration (kept for export compatibility — uses HOLO_COLORS)
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

// ── V2 Color Tokens (self-contained, decoupled from holoTheme for rendering) ──
const COLORS = {
  bgDeep: '#0a0e1a',
  bgCard: 'rgba(20, 26, 38, 0.6)',
  cardBorder: 'rgba(255, 255, 255, 0.04)',
  cyan: '#00d9ff',
  green: '#00ff88',
  red: '#ff3366',
  crimsonBright: '#ff1a4a',
  amber: '#f59e0b',
  gold: '#ffd700',
  purple: '#a78bfa',
  textMain: '#e2e8f0',
  textMuted: '#64748b',
  redLive: '#ef4444',
};

// ── Tier system — returns visual config for each event tier ──
const getEventTier = (eventType) => {
  if (!eventType) return TIERS.BAGGERBOMB;
  const type = eventType.toLowerCase().replace(/[_\s-]/g, '');
  if (type.includes('tenbagger') || type.includes('moonshot')) return TIERS.TENBAGGER;
  if (type.includes('doublebagger') || type.includes('rally')) return TIERS.DOUBLE_BAGGER;
  if (type.includes('bagger') || type.includes('breakout')) return TIERS.BAGGERBOMB;
  if (type.includes('meltdown')) return TIERS.MELTDOWN;
  if (type.includes('crash')) return TIERS.CRASH;
  if (type.includes('bust')) return TIERS.BUST;
  return TIERS.BAGGERBOMB;
};

const TIERS = {
  BAGGERBOMB: {
    key: 'BAGGERBOMB',
    label: 'BAGGER',
    labelColor: COLORS.cyan,
    pointsColor: COLORS.green,
    borderStyle: { borderLeft: `3px solid ${COLORS.cyan}` },
    bgGradient: 'none',
    isPill: false,
    pillBg: null,
    pillTextColor: null,
    pointsShadow: null,
    pointsSize: null,
    chartButtonColor: COLORS.cyan,
    commentaryColor: null,
    strikethrough: false,
    shake: null,
    entryAnimation: {
      initial: { opacity: 0, y: -15 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, type: 'spring', bounce: 0.3 },
    },
  },
  DOUBLE_BAGGER: {
    key: 'DOUBLE_BAGGER',
    label: 'DOUBLE BAGGER',
    labelColor: COLORS.cyan,
    pointsColor: COLORS.green,
    borderStyle: { borderLeft: `3px solid ${COLORS.cyan}` },
    bgGradient: 'linear-gradient(90deg, rgba(0, 217, 255, 0.1), transparent 60%)',
    isPill: false,
    pillBg: null,
    pillTextColor: null,
    pointsShadow: null,
    pointsSize: null,
    chartButtonColor: COLORS.cyan,
    commentaryColor: null,
    strikethrough: false,
    shake: null,
    entryAnimation: {
      initial: { opacity: 0, y: -15 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.45, type: 'spring', bounce: 0.35 },
    },
  },
  TENBAGGER: {
    key: 'TENBAGGER',
    label: 'TENBAGGER',
    labelColor: '#000',
    pointsColor: COLORS.gold,
    borderStyle: { borderLeft: `3px solid ${COLORS.gold}` },
    bgGradient: 'linear-gradient(90deg, rgba(255, 215, 0, 0.12), transparent 60%)',
    isPill: true,
    pillBg: COLORS.gold,
    pillTextColor: '#000',
    pointsShadow: `0 0 10px rgba(255, 215, 0, 0.5)`,
    pointsSize: null,
    chartButtonColor: COLORS.gold,
    commentaryColor: null,
    strikethrough: false,
    shake: null,
    entryAnimation: {
      initial: { opacity: 0, y: -15 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5, type: 'spring', bounce: 0.4 },
    },
  },
  BUST: {
    key: 'BUST',
    label: 'BUST',
    labelColor: COLORS.red,
    pointsColor: COLORS.red,
    borderStyle: { borderLeft: `2px solid ${COLORS.red}` },
    bgGradient: 'linear-gradient(90deg, rgba(255, 51, 102, 0.05), transparent 60%)',
    isPill: false,
    pillBg: null,
    pillTextColor: null,
    pointsShadow: null,
    pointsSize: null,
    chartButtonColor: COLORS.cyan,
    commentaryColor: null,
    strikethrough: false,
    shake: null,
    entryAnimation: {
      initial: { opacity: 0, x: -10 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.3, type: 'tween', ease: [0.22, 1.2, 0.36, 1] },
    },
  },
  CRASH: {
    key: 'CRASH',
    label: 'CRASH',
    labelColor: '#fff',
    pointsColor: COLORS.crimsonBright,
    borderStyle: { borderLeft: `3px solid ${COLORS.crimsonBright}` },
    bgGradient: 'linear-gradient(90deg, rgba(255, 26, 74, 0.1), transparent 60%)',
    isPill: true,
    pillBg: COLORS.crimsonBright,
    pillTextColor: '#fff',
    pointsShadow: null,
    pointsSize: null,
    chartButtonColor: COLORS.cyan,
    commentaryColor: null,
    strikethrough: false,
    shake: null,
    entryAnimation: {
      initial: { opacity: 0, x: -10 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.3, type: 'tween', ease: [0.22, 1.2, 0.36, 1] },
    },
  },
  MELTDOWN: {
    key: 'MELTDOWN',
    label: 'MELTDOWN',
    labelColor: '#fff',
    pointsColor: COLORS.crimsonBright,
    borderStyle: { borderRight: `4px solid ${COLORS.crimsonBright}` },
    bgGradient: 'linear-gradient(270deg, rgba(255, 26, 74, 0.12), transparent 60%)',
    isPill: true,
    pillBg: COLORS.crimsonBright,
    pillTextColor: '#fff',
    pointsShadow: `0 0 10px rgba(255, 26, 74, 0.5)`,
    pointsSize: '18px',
    chartButtonColor: COLORS.cyan,
    commentaryColor: '#ffb3c1',
    strikethrough: true,
    shake: [0, -5, 5, -4, 4, -2, 2, 0],
    entryAnimation: {
      initial: { opacity: 0, y: -15 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.3, type: 'tween', ease: [0.22, 1.2, 0.36, 1] },
    },
  },
};

// Avatar colors — deterministic color from username
const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ── Timestamp formatter ──────────────────────────────────────
const formatEventTime = (event) => {
  const ts = event.timestamp || event.triggeredAt || event.createdAt;
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// ── Sub-Components ──────────────────────────────────────────

/**
 * EventRow — compact 2-row breakout event card
 * Row 1: [Avatar] Name · SYMBOL [Badge] ... +Points
 * Row 2: (optional) indented mic + commentary
 */
function EventRow({ event, tier, commentary, commentaryLoading }) {
  const playerName = event.player || event.username || 'Player';
  const pointsValue = event.points || (EVENT_CONFIG[event.type] || EVENT_CONFIG.bagger).points;
  const isPositive = pointsValue > 0;
  const pointsDisplay = `${isPositive ? '+' : ''}${pointsValue}`;

  const shakeAnimate = tier.shake
    ? { ...tier.entryAnimation.animate, x: tier.shake }
    : tier.entryAnimation.animate;

  const shakeTransition = tier.shake
    ? { ...tier.entryAnimation.transition, x: { duration: 0.3, delay: 0.1 } }
    : tier.entryAnimation.transition;

  return (
    <motion.div
      style={{
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: '8px',
        padding: '8px 12px',
        margin: '0 0 6px 0',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        ...(tier.bgGradient !== 'none' ? { background: `${tier.bgGradient}, ${COLORS.bgCard}` } : {}),
        ...tier.borderStyle,
      }}
      initial={tier.entryAnimation.initial}
      animate={shakeAnimate}
      exit={{ opacity: 0, y: 10, transition: { duration: 0.15 } }}
      transition={shakeTransition}
    >
      {/* Action Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '28px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: getAvatarColor(playerName),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}>
          {(playerName[0] || '?').toUpperCase()}
        </div>

        {/* Player name */}
        <span style={{ color: COLORS.textMain, fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
          {playerName}
        </span>

        {/* Dot separator */}
        <span style={{ color: COLORS.textMuted, fontSize: '10px', flexShrink: 0 }}>{'\u00B7'}</span>

        {/* Stock symbol */}
        <span style={{
          color: COLORS.textMain,
          fontSize: '13px',
          fontWeight: 700,
          flexShrink: 0,
          ...(tier.strikethrough ? { textDecoration: 'line-through', textDecorationColor: COLORS.crimsonBright } : {}),
        }}>
          {event.symbol}
          {/* V5: Direction label for crypto events */}
          {event.direction === 'short' && ' (SHORT)'}
          {event.direction === 'long' && ' (LONG)'}
        </span>

        {/* Event badge */}
        {tier.isPill ? (
          <span style={{
            backgroundColor: tier.pillBg,
            color: tier.pillTextColor,
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}>
            {tier.label}
          </span>
        ) : (
          <span style={{
            color: tier.labelColor,
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}>
            {tier.label}
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Points */}
        <span style={{
          color: tier.pointsColor,
          fontSize: tier.pointsSize || '14px',
          fontWeight: 900,
          flexShrink: 0,
          ...(tier.pointsShadow ? { textShadow: tier.pointsShadow } : {}),
        }}>
          {pointsDisplay}
        </span>

        {/* Timestamp */}
        <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: '400', flexShrink: 0 }}>
          {formatEventTime(event)}
        </span>
      </div>

      {/* Commentary Row (conditional) */}
      {(commentary || commentaryLoading) && (
        <div style={{ paddingLeft: '32px', paddingTop: '4px' }}>
          {commentaryLoading ? (
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: '12px', color: COLORS.textMuted, fontStyle: 'italic' }}
            >
              {'\u{1F399}\uFE0F'} {'\u00B7\u00B7\u00B7'}
            </motion.span>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              style={{
                fontSize: '12px',
                fontStyle: 'italic',
                color: tier.commentaryColor || COLORS.textMuted,
                lineHeight: '1.4',
                margin: 0,
              }}
            >
              {'\u{1F399}\uFE0F'} {commentary}
            </motion.p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * LeadChangeDivider — horizontal line with centered text, NOT a card
 */
function LeadChangeDivider({ event }) {
  const playerName = event.player || event.username || 'Player';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '8px 0',
        padding: '0 4px',
      }}
    >
      {/* Left gradient line */}
      <div style={{
        flex: 1,
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${COLORS.amber}60)`,
      }} />

      {/* Center text */}
      <span style={{
        color: COLORS.amber,
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        whiteSpace: 'nowrap',
      }}>
        {'\u2726'} {playerName.toUpperCase()} TAKES THE LEAD {'\u2726'}
      </span>

      {/* Timestamp */}
      <span style={{ fontSize: '10px', color: `${COLORS.amber}80`, fontWeight: '400', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {formatEventTime(event)}
      </span>

      {/* Right gradient line */}
      <div style={{
        flex: 1,
        height: '1px',
        background: `linear-gradient(270deg, transparent, ${COLORS.amber}60)`,
      }} />
    </motion.div>
  );
}

/**
 * SessionTransitionPill — centered pill between cards (no commentary)
 */
function SessionTransitionPill({ event }) {
  const label = event.label || event.commentary || 'Session Change';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '6px 0',
        margin: '4px 0',
      }}
    >
      <div style={{
        backgroundColor: 'rgba(167, 139, 250, 0.15)',
        border: '1px solid rgba(167, 139, 250, 0.3)',
        borderRadius: '20px',
        padding: '5px 14px',
        color: COLORS.purple,
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        {label}
        {formatEventTime(event) && (
          <span style={{ fontSize: '9px', color: `${COLORS.purple}99`, fontWeight: '400', marginLeft: '8px' }}>
            {formatEventTime(event)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * BattleBanner — gradient banner for BATTLE_START / BATTLE_END
 */
function BattleBanner({ event, commentary, commentaryLoading }) {
  const isBattleEnd = event.type === 'BATTLE_END';
  const bannerText = isBattleEnd ? '\u{1F3C6} FINAL BELL' : '\u{1F514} BATTLE IS LIVE';
  const textColor = isBattleEnd ? COLORS.gold : COLORS.cyan;
  const borderColor = isBattleEnd
    ? `1px solid rgba(255, 215, 0, 0.3)`
    : `1px solid rgba(0, 217, 255, 0.3)`;
  const bgGradient = isBattleEnd
    ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(139, 92, 246, 0.15))'
    : 'linear-gradient(135deg, rgba(0, 217, 255, 0.15), rgba(139, 92, 246, 0.15))';

  const synthCommentary = event.commentary || commentary;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
      style={{
        background: bgGradient,
        border: borderColor,
        borderRadius: '8px',
        padding: '12px 16px',
        textAlign: 'center',
        margin: '0 0 6px 0',
        overflow: 'hidden',
      }}
    >
      <div style={{
        color: textColor,
        fontSize: '14px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
      }}>
        {bannerText}
      </div>
      {formatEventTime(event) && (
        <div style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: '400', marginTop: '4px' }}>
          {formatEventTime(event)}
        </div>
      )}
      {(synthCommentary || commentaryLoading) && (
        <div style={{ marginTop: '8px' }}>
          {commentaryLoading ? (
            <motion.p
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: '12px', color: COLORS.textMuted, fontStyle: 'italic', margin: 0 }}
            >
              {'\u00B7\u00B7\u00B7'}
            </motion.p>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              style={{ fontSize: '12px', color: COLORS.textMuted, fontStyle: 'italic', margin: 0, lineHeight: '1.4' }}
            >
              {'\u{1F399}\uFE0F'} {synthCommentary}
            </motion.p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * ApproachingAlertCard — compact red zone card with progress bar
 */
function ApproachingAlertCard({ event, onRedZoneTap, currentUser }) {
  const rzColor = event.direction === 'negative' ? COLORS.red : COLORS.amber;
  const percentage = event.progress || 0;

  // Chart button color: green if good for user, red if bad
  const isPositiveThreshold = event.direction === 'positive';
  const isCurrentUserEvent = event.player === currentUser;
  const isGoodForUser = (isCurrentUserEvent && isPositiveThreshold) ||
                        (!isCurrentUserEvent && !isPositiveThreshold);
  const chartColor = isGoodForUser ? COLORS.green : COLORS.red;

  return (
    <motion.div
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.35, type: 'spring', bounce: 0.25 }}
      style={{
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${rzColor}40`,
        borderLeft: `3px solid ${rzColor}`,
        borderRadius: '8px',
        padding: '8px 12px',
        margin: '0 0 6px 0',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
      }}>
        <span style={{ color: COLORS.textMain, fontWeight: 600, fontSize: '13px' }}>
          {event.player || 'Player'}
        </span>
        <span style={{ color: COLORS.textMuted, fontSize: '10px' }}>{'\u00B7'}</span>
        <span style={{ color: COLORS.textMain, fontWeight: 700, fontSize: '13px' }}>
          {event.symbol}
        </span>
        <span style={{ color: rzColor, fontWeight: 600, fontSize: '12px' }}>
          approaching {EVENT_CONFIG[event.targetThreshold]?.label || event.targetThreshold}!
        </span>
        <span style={{ fontSize: '11px', color: rzColor, fontWeight: 700 }}>
          {percentage}%
        </span>
        <div style={{ flex: 1 }} />
        {onRedZoneTap && (
          <button
            onClick={(e) => { e.stopPropagation(); onRedZoneTap(event); }}
            style={{
              backgroundColor: `${chartColor}15`,
              border: `1px solid ${chartColor}40`,
              borderRadius: '6px',
              padding: '4px 10px',
              color: chartColor,
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '28px',
              flexShrink: 0,
            }}
          >
            Chart
          </button>
        )}
        {/* Timestamp */}
        <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: '400', flexShrink: 0 }}>
          {formatEventTime(event)}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '3px',
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
    </motion.div>
  );
}

/**
 * SwapEventCard — minimal gray card, no chart button
 */
function SwapEventCard({ event }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: '8px',
        padding: '8px 12px',
        margin: '0 0 6px 0',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '14px' }}>{'\u{1F504}'}</span>
        <span style={{ color: COLORS.textMain, fontWeight: 600, fontSize: '13px' }}>
          {event.player || 'Player'}
        </span>
        <span style={{ color: COLORS.textMuted, fontSize: '13px' }}>swapped</span>
        <span style={{ color: COLORS.red, fontWeight: 600, fontSize: '13px' }}>
          {event.removedSymbol}
          {event.direction && event.swapType !== 'cash' && (
            <span style={{ fontSize: '10px', opacity: 0.8 }}>
              {event.direction === 'short' ? ' (SHORT)' : ' (LONG)'}
            </span>
          )}
        </span>
        <span style={{ color: COLORS.textMuted, fontSize: '13px' }}>{'\u2192'}</span>
        <span style={{
          color: event.swapType === 'cash' ? COLORS.textMuted : COLORS.green,
          fontWeight: 600,
          fontSize: '13px',
        }}>
          {event.addedSymbol === 'CASH' ? '💵 CASH' : event.addedSymbol}
        </span>
        <div style={{ flex: 1 }} />
        {/* Timestamp */}
        <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: '400', flexShrink: 0 }}>
          {formatEventTime(event)}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * SyntheticFallbackCard — for COMEBACK, SUBSTITUTION, and other synthetic events
 */
function SyntheticFallbackCard({ event, commentary, commentaryLoading }) {
  const synthCommentary = event.commentary || commentary;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: '8px',
        padding: '8px 12px',
        margin: '0 0 6px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>{'\u{1F399}\uFE0F'}</span>
        {commentaryLoading && !synthCommentary ? (
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: '12px', color: COLORS.textMuted, fontStyle: 'italic', flex: 1 }}
          >
            {'\u00B7\u00B7\u00B7'}
          </motion.span>
        ) : (
          <p style={{
            fontSize: '12px',
            color: COLORS.textMuted,
            fontStyle: 'italic',
            lineHeight: '1.4',
            margin: 0,
            flex: 1,
          }}>
            {synthCommentary}
          </p>
        )}
        {/* Timestamp */}
        <span style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: '400', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {formatEventTime(event)}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * EventItem — routes events to the appropriate component
 */
function EventItem({ event, onRedZoneTap, currentUser, commentary = null, commentaryLoading = false }) {
  const isSynthetic = event.isSynthetic;
  const isRedZone = event.type === 'redzone';
  const isSwap = event.type === 'swap';

  // Synthetic events
  if (isSynthetic) {
    const synthCommentary = event.commentary || commentary;
    const synthType = event.type;

    if (synthType === 'LEAD_CHANGE') {
      return <LeadChangeDivider event={event} />;
    }

    if (synthType === 'SESSION_TRANSITION') {
      return <SessionTransitionPill event={event} />;
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

    return (
      <SyntheticFallbackCard
        event={event}
        commentary={synthCommentary}
        commentaryLoading={commentaryLoading}
      />
    );
  }

  // Red Zone
  if (isRedZone) {
    return <ApproachingAlertCard event={event} onRedZoneTap={onRedZoneTap} currentUser={currentUser} />;
  }

  // Swap
  if (isSwap) {
    return <SwapEventCard event={event} />;
  }

  // Breakout events — main event row
  const tier = getEventTier(event.type);
  return (
    <EventRow
      event={event}
      tier={tier}
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
  currentUser: PropTypes.string,
  commentary: PropTypes.string,
  commentaryLoading: PropTypes.bool,
};

/**
 * EventFeed — compact card-based live event stream with ClashCast commentary
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
    const sorted = allEvents.sort((a, b) => {
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

    return deduped.slice(0, maxDisplay);
  }, [events, syntheticEvents, maxDisplay]);

  return (
    <div style={{
      overflow: 'hidden',
      width: '100%',
    }}>
      {/* Sticky Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: `${COLORS.bgDeep}f2`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backdropFilter: 'blur(8px)',
      }}>
        <span style={{
          color: COLORS.textMain,
          fontSize: '14px',
          fontWeight: 700,
        }}>
          ClashCast
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
                backgroundColor: COLORS.redLive,
              }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span style={{ fontSize: '10px', color: COLORS.redLive, fontWeight: 700 }}>
              LIVE
            </span>
          </span>
        )}
      </div>

      {/* Scroll Container with mask */}
      <div style={{
        maxHeight: '60vh',
        overflowY: 'auto',
        padding: '8px',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 3%, black 97%, transparent)',
        maskImage: 'linear-gradient(to bottom, transparent, black 3%, black 97%, transparent)',
      }}>
        {sortedEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: COLORS.textMuted,
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
                  onRedZoneTap={event.type === 'redzone' ? onRedZoneTap : undefined}
                  currentUser={currentUser}
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
  maxDisplay: PropTypes.number,
  emptyMessage: PropTypes.string,
  currentUser: PropTypes.string,
  onRedZoneTap: PropTypes.func,
  getEventCommentary: PropTypes.func,
  clashCastActive: PropTypes.bool,
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
