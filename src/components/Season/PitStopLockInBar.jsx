// src/components/Season/PitStopLockInBar.jsx
//
// Pit Stop lock-in bar — the bottom-of-content confirmation surface.
//
// Intent-not-endpoint: there is no client-side lock-in API call. The user's
// changes and shortlist are already persisted to the pitStop doc incrementally
// as they edit. The Sunday night cron (`handleLockIn` in
// `api/cron/season-pit-stop-manage.js`) validates and applies everything on
// schedule, and sets `lockedInBy: 'user'` vs `'auto'` based on whether any
// activity happened. This bar plays a confirmation animation and then
// navigates the user back — it's a user experience affordance, not a
// server-side action.
//
// Props:
//   week      - current pit stop week number
//   changes   - pitStop.changes[] (read-only snapshot for summary counts)
//   shortlist - pitStop.shortlist[] (read-only snapshot for summary counts)
//   onLockIn  - () => void; called after the animation finishes
//
// Position: sticks to the end of the scrollable content (not fixed to the
// viewport) per the spec — matches "scrolls into view" behaviour.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TROPHY_GOLD = '#F0C75E';
const LOCK_IN_SPRING = { type: 'spring', stiffness: 400, damping: 15 };

// ─── Inline SVGs ─────────────────────────────────────────────

function LockClosedIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────

export default function PitStopLockInBar({ week, changes, shortlist, onLockIn }) {
  const changeCount = Array.isArray(changes) ? changes.length : 0;
  const shortlistCount = Array.isArray(shortlist) ? shortlist.length : 0;
  const hasIntent = changeCount > 0 || shortlistCount > 0;

  // Flow: idle -> confirming (summary prompt) -> locking (animation) -> done.
  const [stage, setStage] = useState('idle');

  const handlePrimaryTap = () => {
    if (!hasIntent) return;
    setStage('confirming');
  };

  const handleCancel = () => {
    setStage('idle');
  };

  const handleConfirm = () => {
    setStage('locking');
    // Mech-bay animation runs ~1s, then hand control back to the parent.
    setTimeout(() => {
      setStage('done');
      setTimeout(() => {
        onLockIn?.();
      }, 400);
    }, 1000);
  };

  // Pluralisation helper for the summary blurb.
  const summaryLine = (() => {
    const parts = [];
    if (changeCount > 0) {
      parts.push(`${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`);
    }
    if (shortlistCount > 0) {
      parts.push(
        `${shortlistCount} shortlist ${shortlistCount === 1 ? 'pick' : 'picks'}`,
      );
    }
    return parts.length > 0 ? parts.join(' · ') : 'No changes queued';
  })();

  return (
    <section
      style={{
        background: '#15171E',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '14px 16px 16px',
        marginTop: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gold flash overlay for the lock-in animation */}
      <AnimatePresence>
        {stage === 'locking' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.2] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at 50% 100%, ${TROPHY_GOLD} 0%, rgba(240, 199, 94, 0) 70%)`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </AnimatePresence>

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Summary row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: hasIntent ? TROPHY_GOLD : 'rgba(255,255,255,0.5)',
            }}
          >
            Lock In
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {summaryLine}
          </span>
        </div>

        {/* Stage: idle / confirming / locking / done */}
        <AnimatePresence mode="wait">
          {stage === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <motion.button
                onClick={handlePrimaryTap}
                disabled={!hasIntent}
                whileTap={hasIntent ? { scale: 0.97 } : undefined}
                transition={LOCK_IN_SPRING}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: hasIntent ? TROPHY_GOLD : 'rgba(255,255,255,0.08)',
                  color: hasIntent ? '#1a1200' : 'rgba(255,255,255,0.45)',
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  cursor: hasIntent ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: hasIntent
                    ? '0 6px 20px rgba(240, 199, 94, 0.25)'
                    : 'none',
                }}
              >
                <LockClosedIcon />
                {hasIntent
                  ? `Lock In Changes for Week ${week}`
                  : 'No Changes — Auto-Lock on Sunday'}
              </motion.button>
              {!hasIntent && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
                    lineHeight: 1.5,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  You can queue up to 3 parameter changes and 3 shortlist picks.
                  Sunday night locks in whatever&rsquo;s queued.
                </div>
              )}
            </motion.div>
          )}

          {stage === 'confirming' && (
            <motion.div
              key="confirming"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.85)',
                  textAlign: 'center',
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                Apply{' '}
                <strong style={{ color: TROPHY_GOLD }}>
                  {changeCount} {changeCount === 1 ? 'change' : 'changes'}
                </strong>{' '}
                and{' '}
                <strong style={{ color: TROPHY_GOLD }}>
                  {shortlistCount} shortlist{' '}
                  {shortlistCount === 1 ? 'pick' : 'picks'}
                </strong>
                ?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCancel}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <motion.button
                  onClick={handleConfirm}
                  whileTap={{ scale: 0.97 }}
                  transition={LOCK_IN_SPRING}
                  style={{
                    flex: 2,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: TROPHY_GOLD,
                    color: '#1a1200',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <LockClosedIcon />
                  Confirm Lock-In
                </motion.button>
              </div>
            </motion.div>
          )}

          {stage === 'locking' && (
            <motion.div
              key="locking"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: [0.9, 1.05, 1], opacity: 1 }}
              transition={LOCK_IN_SPRING}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '18px 16px',
                background: 'rgba(240, 199, 94, 0.12)',
                border: `1px solid ${TROPHY_GOLD}`,
                borderRadius: 12,
                color: TROPHY_GOLD,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              <motion.span
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                style={{ display: 'inline-flex' }}
              >
                <LockClosedIcon size={18} />
              </motion.span>
              Sealing pit stop...
            </motion.div>
          )}

          {stage === 'done' && (
            <motion.div
              key="done"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={LOCK_IN_SPRING}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '18px 16px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: `1px solid rgba(16, 185, 129, 0.5)`,
                borderRadius: 12,
                color: '#10b981',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.3,
              }}
            >
              <CheckIcon />
              Changes locked in
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
