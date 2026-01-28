// /src/components/Dashboard/WeeklyChallenges/index.jsx
// Weekly Challenges with premium tarot card carousel
// Drop-in replacement for WeeklyChallengesPanel with same props interface

import React from 'react';
import { motion } from 'framer-motion';
import ChallengeCarousel from './ChallengeCarousel';
import WeeklyBonusCard from './WeeklyBonusCard';
import { getTimeUntilReset } from './challengeDefinitions';

const WeeklyChallengesPanel = ({
  showWeeklyChallenges,
  setShowWeeklyChallenges,
  weeklyChallenges,
  activeDailyChallenge,
  challengeProgress,
  completedWeeklyChallenges,
  expandedChallengeId,
  setExpandedChallengeId,
  acceptChallenge,
  colors,
}) => {
  const completedCount = completedWeeklyChallenges.length;
  const canClaimBonus = completedCount >= 4;
  const resetTime = getTimeUntilReset();

  const handleClaimBonus = () => {
    // Weekly bonus is tracked by parent via completedWeeklyChallenges
    // Future: award bonus XP here
  };

  return (
    <motion.div
      id="tour-weekly-challenges"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      style={{
        marginBottom: '24px',
        // CRITICAL: Allow carousel to extend beyond bounds for scrolling
        overflow: 'visible',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 16px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{
            color: '#e6edf3',
            fontSize: '16px',
            fontWeight: '700',
            margin: 0,
          }}>
            Weekly Challenges
          </h3>
          <p style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '12px',
            margin: 0,
          }}>
            {completedCount}/4 completed • Resets in {resetTime.days}d {resetTime.hours}h
          </p>
        </div>
      </div>

      {/* Active Challenge Indicator */}
      {activeDailyChallenge && activeDailyChallenge.acceptedDate === new Date().toISOString().split('T')[0] && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(168, 85, 247, 0.2)',
            border: '1px solid #A855F7',
            borderRadius: '8px',
            padding: '10px 12px',
            margin: '0 16px 8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#e6edf3',
          }}
        >
          <span style={{ color: '#A855F7', fontSize: '14px' }}>⚡</span>
          Active Today: <strong>{activeDailyChallenge.name}</strong>
        </motion.div>
      )}

      {/* Tarot Card Carousel */}
      <ChallengeCarousel
        challenges={weeklyChallenges}
        activeDailyChallenge={activeDailyChallenge}
        completedWeeklyChallenges={completedWeeklyChallenges}
        challengeProgress={challengeProgress}
        onAccept={acceptChallenge}
      />

      {/* Weekly Bonus Progress */}
      <div style={{ padding: '0 16px 4px 16px' }}>
        <WeeklyBonusCard
          completedCount={completedCount}
          canClaim={canClaimBonus}
          onClaim={handleClaimBonus}
        />
      </div>
    </motion.div>
  );
};

export default WeeklyChallengesPanel;
