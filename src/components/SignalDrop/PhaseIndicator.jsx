// src/components/SignalDrop/PhaseIndicator.jsx
//
// Sprint 6 Phase 3B — 4-dot phase progression indicator for the
// WatchlistChat dialogue. Lives at the SignalDrop top level (not in
// `components/`) because it's specific to the watchlist dialogue
// concept; the ChatBubble / ActionChip / TypingIndicator primitives
// are generic and could move to a shared dialogue shell later.
//
// Locked decision D15: 4 dots with tap-to-reveal phase names.
// Server-side phase advancement is forward-only, but we render the
// component defensively if a backward jump ever surfaces — the
// animation snaps rather than reverses.

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

const PHASES = [
  { key: 'explore', label: 'Explore' },
  { key: 'propose', label: 'Propose' },
  { key: 'refine', label: 'Refine' },
  { key: 'finalize', label: 'Finalize' },
];

const PHASE_INDEX = {
  explore: 0,
  propose: 1,
  refine: 2,
  finalize: 3,
};

export default function PhaseIndicator({ currentPhase, messagesUsed, messageBudget }) {
  const { tokens } = useTheme();
  const [revealed, setRevealed] = useState(null); // index of dot whose label is showing
  const revealTimerRef = useRef(null);

  const currentIdx = PHASE_INDEX[currentPhase] ?? 0;

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  function handleDotTap(idx) {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setRevealed((prev) => (prev === idx ? null : idx));
    revealTimerRef.current = setTimeout(() => {
      setRevealed(null);
    }, 1800);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        gap: 10,
        background: tokens.bgCard,
        borderBottom: `1px solid ${tokens.borderDefault}`,
        minHeight: 40,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flex: 1,
          minWidth: 0,
        }}
        role="group"
        aria-label="Dialogue phase progression"
      >
        {PHASES.map((p, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isPending = idx > currentIdx;
          const dotColor = isCurrent
            ? tokens.teal
            : isCompleted
            ? `${tokens.teal}80`
            : 'transparent';
          const dotBorder = isCurrent
            ? tokens.teal
            : isCompleted
            ? `${tokens.teal}80`
            : `${tokens.teal}40`;
          const showLabel = revealed === idx || isCurrent;

          return (
            <React.Fragment key={p.key}>
              <button
                type="button"
                onClick={() => handleDotTap(idx)}
                aria-label={`${p.label} phase${
                  isCurrent ? ' (current)' : isCompleted ? ' (completed)' : ' (pending)'
                }`}
                style={{
                  appearance: 'none',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 2px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                  position: 'relative',
                }}
              >
                <motion.span
                  layout
                  animate={{
                    background: dotColor,
                    borderColor: dotBorder,
                    scale: isCurrent ? 1.15 : 1,
                  }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: `1.5px solid ${dotBorder}`,
                    boxShadow: isCurrent ? `0 0 8px ${tokens.teal}66` : 'none',
                  }}
                />
                <motion.span
                  initial={false}
                  animate={{
                    opacity: showLabel ? 1 : 0,
                    y: showLabel ? 0 : -2,
                  }}
                  transition={{ duration: 0.18 }}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    color: isPending ? tokens.textFaint : tokens.teal,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </motion.span>
              </button>
              {idx < PHASES.length - 1 && (
                <motion.span
                  animate={{
                    background: idx < currentIdx ? `${tokens.teal}80` : `${tokens.teal}1a`,
                  }}
                  transition={{ duration: 0.3 }}
                  style={{
                    flex: 1,
                    height: 1,
                    minWidth: 12,
                    maxWidth: 32,
                    alignSelf: 'flex-start',
                    marginTop: 9,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {typeof messagesUsed === 'number' && typeof messageBudget === 'number' && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            color:
              messagesUsed >= messageBudget
                ? tokens.red
                : messagesUsed >= messageBudget - 3
                ? tokens.amber
                : tokens.textMuted,
            flexShrink: 0,
          }}
          aria-live="polite"
        >
          {messagesUsed} / {messageBudget}
        </div>
      )}
    </div>
  );
}
