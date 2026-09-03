// src/screens/battleView/TurnLine.jsx
//
// The turn line under the score header's tug-of-war bar (Phase A, A1). One
// line of scoreboard fact from deriveTurnLine(); every string comes from
// DESK_COPY through that derivation, so the Desk and this line cannot say two
// different things about the same check (BUILD_RULES §9, D-62).
//
// The small mark beside the text is the "decided" indicator: filled when the
// latest check recorded a decision in `evaluations[]` (the `>=` join), hollow
// when the tick ran but recorded none. It is decorative — the words are the
// claim, and the Why? panel spells the decision state out — so it is hidden
// from assistive tech rather than given a label of its own.
//
// Motion: the line re-keys on the landing so it ticks once, last in the
// sequence, through the `fade` token; reduced motion → the instant token.
// Between checks it is still. `aria-live="polite"` announces the new line to
// a screen reader when a check lands, which is the same moment the sighted
// player sees the landing.

import React from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { landingTurnLineDelayMs, useLandingTransition } from './landing';

export default function TurnLine({ turn, landingKey = null, rowCount = 0, reducedMotion = false }) {
  const transition = useLandingTransition(landingTurnLineDelayMs(rowCount), reducedMotion);
  if (!turn) return null;
  return (
    <div
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        letterSpacing: '0.02em',
        color: cssVar('text-secondary'),
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        aria-hidden="true"
        data-decided={turn.decided ? 'true' : 'false'}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          boxSizing: 'border-box',
          background: turn.decided ? cssVar('teal') : 'transparent',
          border: `1px solid ${cssVar('teal')}`,
          opacity: turn.decided ? 1 : 0.6,
        }}
      />
      <motion.span
        key={landingKey || 'still'}
        initial={landingKey && !reducedMotion ? { opacity: 0.3 } : false}
        animate={{ opacity: 1 }}
        transition={transition}
        data-turn-state={turn.state}
        style={{ whiteSpace: 'nowrap' }}
      >
        {turn.text}
      </motion.span>
    </div>
  );
}
