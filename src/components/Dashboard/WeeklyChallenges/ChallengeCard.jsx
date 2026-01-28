// /src/components/Dashboard/WeeklyChallenges/ChallengeCard.jsx
// Flip-card challenge with Framer Motion 3D animation
// States: available (flippable), active (progress), completed (done), locked (dimmed)

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CardFront from './CardFront';
import CardBack from './CardBack';
import LockedOverlay from './LockedOverlay';
import { getCardState, getGameModeColor } from './challengeDefinitions';

export default function ChallengeCard({
  challenge,
  index,
  activeDailyChallenge,
  completedWeeklyChallenges,
  challengeProgress,
  onAccept,
  colors,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);

  const state = getCardState(challenge, activeDailyChallenge, completedWeeklyChallenges);
  const canFlip = state === 'available';
  const progress = challengeProgress[challenge.id] || 0;

  const handleAccept = () => {
    // Spotlight glow effect, then accept
    setShowSpotlight(true);
    setTimeout(() => {
      setShowSpotlight(false);
      setIsFlipped(false); // Flip back to front
      onAccept(challenge);
    }, 600);
  };

  const borderColor =
    state === 'completed' ? '#10b981'
    : state === 'active' ? '#A855F7'
    : colors?.borderSubtle || '#21262d';

  const bgColor =
    state === 'completed' ? 'rgba(16, 185, 129, 0.08)'
    : state === 'active' ? 'rgba(168, 85, 247, 0.12)'
    : 'rgba(255, 255, 255, 0.03)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      style={{
        marginBottom: '10px',
        perspective: '1000px',
        position: 'relative',
      }}
    >
      {/* Spotlight glow on accept */}
      <AnimatePresence>
        {showSpotlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              inset: '-4px',
              background: 'radial-gradient(circle at center, rgba(124, 58, 237, 0.4) 0%, transparent 70%)',
              borderRadius: '16px',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={() => canFlip && setIsFlipped(!isFlipped)}
        style={{
          transformStyle: 'preserve-3d',
          cursor: canFlip ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        {/* Front Face */}
        <div style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <CardFront
            challenge={challenge}
            state={state}
            progress={progress}
          />
          {/* Locked overlay renders on top of front face */}
          {state === 'locked' && <LockedOverlay />}
        </div>

        {/* Back Face - only rendered for available state */}
        {canFlip && (
          <div style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid #7c3aed',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <CardBack
              challenge={challenge}
              onAccept={handleAccept}
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
