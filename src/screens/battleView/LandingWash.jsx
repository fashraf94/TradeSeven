// src/screens/battleView/LandingWash.jsx
//
// One row's share of the landing: a faint teal wash that fades out, starting
// at this row's slot in the top-to-bottom sequence. Mounted only under the
// controller flag, only after a check has landed (landingKey non-null), and
// never under reduced motion — values update in place there.
//
// Colour goes through the token bridge (BUILD_RULES §10): the wash is a static
// CSS background, so a var() is fine here; nothing animates a colour channel.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { landingRowDelayMs, useLandingTransition } from './landing';

export default function LandingWash({ landingKey, index, count, reducedMotion }) {
  const transition = useLandingTransition(landingRowDelayMs(index, count), reducedMotion);
  // Which landing this wash has already played. Keyed on the landing, never
  // a bare boolean: a boolean would play the first check and swallow every
  // later one (review finding F1 — one wash per mount instead of per check).
  const [doneFor, setDoneFor] = useState(null);
  if (!landingKey || reducedMotion || doneFor === landingKey) return null;
  return (
    <motion.div
      key={landingKey}
      aria-hidden="true"
      data-wash="1"
      data-wash-index={index}
      initial={{ opacity: 0.35 }}
      animate={{ opacity: 0 }}
      transition={transition}
      onAnimationComplete={() => setDoneFor(landingKey)}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `rgba(${cssVar('teal-rgb')}, 0.45)`,
        zIndex: 1,
      }}
    />
  );
}
