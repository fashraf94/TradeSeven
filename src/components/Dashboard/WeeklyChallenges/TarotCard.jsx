// /src/components/Dashboard/WeeklyChallenges/TarotCard.jsx
// Premium tarot-style challenge card with 1:2 aspect ratio
// - HolographicBorder wrapper with scroll-reactive shimmer
// - Unique flip animation per slot type (Sword Strike, Slither, Chaos, Champion Spin)
// - Spotlight glow on accept
// - 3D perspective flip between CardFront and CardBack

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CardFront from './CardFront';
import CardBack from './CardBack';
import HolographicBorder from './HolographicBorder';
import {
  getCardState,
  getSignatureColor,
  getFlipVariants,
} from './challengeDefinitions';

export default function TarotCard({
  challenge,
  index,
  activeDailyChallenge,
  completedWeeklyChallenges,
  challengeProgress,
  onAccept,
  scrollProgress = 0,
  cardWidth = 160,
  cardHeight = 320,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);

  const state = getCardState(challenge, activeDailyChallenge, completedWeeklyChallenges);
  const canFlip = state === 'available';
  const progress = challengeProgress[challenge.id] || 0;
  const accentColor = getSignatureColor(challenge);
  const flipVariants = getFlipVariants(challenge);
  const isMuted = state === 'completed' || state === 'locked';

  const handleAccept = () => {
    setShowSpotlight(true);
    setTimeout(() => {
      setShowSpotlight(false);
      setIsFlipped(false);
      onAccept(challenge);
    }, 600);
  };

  const handleClick = () => {
    if (canFlip) setIsFlipped(!isFlipped);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
      style={{
        // Responsive tarot card with 1:2 aspect ratio
        width: `${cardWidth}px`,
        minWidth: `${cardWidth}px`,
        height: `${cardHeight}px`,
        perspective: '1200px',
        position: 'relative',
        flexShrink: 0,
        scrollSnapAlign: 'center',
      }}
    >
      {/* Spotlight glow on accept */}
      <AnimatePresence>
        {showSpotlight && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute',
              inset: '-12px',
              background: `radial-gradient(circle at center, ${accentColor}55 0%, ${accentColor}22 40%, transparent 70%)`,
              borderRadius: '24px',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}
      </AnimatePresence>

      <HolographicBorder
        accentColor={accentColor}
        scrollProgress={scrollProgress}
        muted={isMuted}
      >
        <motion.div
          animate={isFlipped ? flipVariants.back : flipVariants.front}
          transition={flipVariants.transition}
          onClick={handleClick}
          style={{
            width: '100%',
            height: `${cardHeight}px`,
            transformStyle: 'preserve-3d',
            cursor: canFlip ? 'pointer' : 'default',
            position: 'relative',
          }}
        >
          {/* Front Face */}
          <div style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            borderRadius: '13px',
          }}>
            <CardFront
              challenge={challenge}
              state={state}
              progress={progress}
              accentColor={accentColor}
            />
          </div>

          {/* Back Face - only available cards can flip */}
          {canFlip && (
            <div style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              borderRadius: '13px',
              background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,
            }}>
              <CardBack
                challenge={challenge}
                accentColor={accentColor}
                onAccept={handleAccept}
              />
            </div>
          )}
        </motion.div>
      </HolographicBorder>
    </motion.div>
  );
}
