// src/components/SignalDrop/AnatomySection.jsx
//
// Sprint 6 Phase 3C — reusable collapsible section for the watchlist
// anatomy panel. Renders a header (chevron + title + count + optional
// accent label / tooltip) and a body whose visibility animates in/out.
//
// Two accent variants:
//   * 'standard'  — no accent border, uses the panel's default styling.
//   * 'discovery' — 3px teal left border + "Asymmetric Edge" label slot
//                   + info icon that toggles a tap-revealed tooltip
//                   explaining the user-contribution unlock.
//
// The Discovery accent is the load-bearing visual decision in 3C — it
// signals that user-contributed picks are a first-class concept rather
// than another bucket. The tooltip mirrors PhaseIndicator's tap-to-toggle
// pattern (auto-hide after 2.4s).
//
// `pulseKey` is a sentinel — when it changes, the section's left border
// glows briefly via a one-shot motion animation (~320ms). Callers bump
// this on anatomy/ticker mutations.

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Info } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const TOOLTIP_AUTOHIDE_MS = 2400;

export default function AnatomySection({
  title,
  count,
  accent = 'standard',
  accentLabel = null,
  tooltipText = null,
  defaultExpanded = true,
  pulseKey = 0,
  emptyMessage = null,
  hasContent = true,
  children,
}) {
  const { tokens } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimerRef = useRef(null);

  // Pulse the section background + left border whenever pulseKey changes
  // (skip the first mount — we don't want a flash on initial render).
  // The pulse is a one-shot ~300ms transient: highlight ON, then back
  // to the resting style. Driven by motion.animate via the `pulse`
  // boolean below, which auto-clears via timeout.
  const pulseSeenRef = useRef(pulseKey);
  const pulseTimerRef = useRef(null);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (pulseSeenRef.current === pulseKey) return;
    pulseSeenRef.current = pulseKey;
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    setPulse(true);
    pulseTimerRef.current = setTimeout(() => {
      setPulse(false);
      pulseTimerRef.current = null;
    }, 320);
  }, [pulseKey]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  function toggleTooltip(e) {
    e.stopPropagation();
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setShowTooltip((v) => {
      const next = !v;
      if (next) {
        tooltipTimerRef.current = setTimeout(() => {
          setShowTooltip(false);
        }, TOOLTIP_AUTOHIDE_MS);
      }
      return next;
    });
  }

  const isDiscovery = accent === 'discovery';
  const accentColor = tokens.teal;
  const showEmpty = !hasContent && emptyMessage;

  // Resting and pulsing styles for the section wrapper. The pulse layers
  // a brief teal background tint + left-border glow on top of the resting
  // discovery/standard styling, then settles back.
  const restingBackground = isDiscovery ? `${accentColor}0a` : 'transparent';
  const restingBoxShadow = isDiscovery
    ? `inset 3px 0 0 0 ${accentColor}`
    : 'inset 3px 0 0 0 transparent';
  const pulsingBackground = `${accentColor}1f`;
  const pulsingBoxShadow = `inset 3px 0 0 0 ${accentColor}, 0 0 14px 0 ${accentColor}55`;

  return (
    <motion.div
      animate={{
        background: pulse ? pulsingBackground : restingBackground,
        boxShadow: pulse ? pulsingBoxShadow : restingBoxShadow,
      }}
      transition={{ duration: pulse ? 0.18 : 0.32, ease: 'easeOut' }}
      style={{
        marginBottom: 14,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: tokens.textMuted,
            flexShrink: 0,
          }}
        >
          <ChevronRight size={14} />
        </motion.span>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: isDiscovery ? accentColor : tokens.textPrimary,
            flexShrink: 0,
          }}
        >
          {title}
        </span>

        {typeof count === 'number' && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: count > 0
                ? (isDiscovery ? accentColor : tokens.textMuted)
                : tokens.textFaint,
              flexShrink: 0,
            }}
          >
            ({count})
          </span>
        )}

        {isDiscovery && accentLabel && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: accentColor,
              padding: '2px 6px',
              borderRadius: 4,
              border: `1px solid ${accentColor}55`,
              background: `${accentColor}14`,
              marginLeft: 2,
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">✦</span>
            {accentLabel}
          </span>
        )}

        {tooltipText && (
          <span
            role="button"
            tabIndex={0}
            onClick={toggleTooltip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') toggleTooltip(e);
            }}
            aria-label="What is this?"
            aria-expanded={showTooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              color: tokens.textMuted,
              cursor: 'pointer',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <Info size={12} />
          </span>
        )}

        <span style={{ flex: 1 }} />
      </button>

      {/* Tooltip body — positioned below the header when toggled. Lives
          outside the <button> to avoid nested-interactive elements. */}
      <AnimatePresence initial={false}>
        {showTooltip && tooltipText && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
              margin: '0 10px 8px 28px',
              padding: '8px 10px',
              background: tokens.bgCard,
              border: `1px solid ${accentColor}40`,
              borderRadius: 6,
              fontSize: 11,
              lineHeight: 1.5,
              color: tokens.textSecondary,
              fontStyle: 'italic',
            }}
            role="tooltip"
          >
            {tooltipText}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 10px 10px 28px' }}>
              {showEmpty ? (
                <div
                  style={{
                    fontSize: 11,
                    fontStyle: 'italic',
                    color: tokens.textFaint,
                    lineHeight: 1.5,
                  }}
                >
                  {emptyMessage}
                </div>
              ) : (
                children
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
