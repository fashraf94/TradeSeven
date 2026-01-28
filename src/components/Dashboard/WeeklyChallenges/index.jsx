// /src/components/Dashboard/WeeklyChallenges/index.jsx
// Main Weekly Challenges container with card-flip mechanic
// Drop-in replacement for WeeklyChallengesPanel with same props interface

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ChallengeCard from './ChallengeCard';
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
        background: colors?.cardBg || '#0d1117',
        borderRadius: '16px',
        border: `1px solid ${colors?.border || '#21262d'}`,
        overflow: 'hidden',
      }}
    >
      {/* Header - clickable to expand/collapse */}
      <div
        onClick={() => setShowWeeklyChallenges(!showWeeklyChallenges)}
        style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🎯</span>
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
        <motion.div
          animate={{ rotate: showWeeklyChallenges ? 180 : 0 }}
          style={{ color: '#A855F7' }}
        >
          <ChevronDown size={20} />
        </motion.div>
      </div>

      {/* Expandable content with challenge cards */}
      {showWeeklyChallenges && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{ padding: '0 16px 16px' }}>
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
                  marginBottom: '12px',
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

            {/* Challenge Cards with flip animation */}
            {weeklyChallenges.map((challenge, index) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                index={index}
                activeDailyChallenge={activeDailyChallenge}
                completedWeeklyChallenges={completedWeeklyChallenges}
                challengeProgress={challengeProgress}
                onAccept={acceptChallenge}
                colors={colors}
              />
            ))}

            {/* Weekly Bonus Progress */}
            <WeeklyBonusCard
              completedCount={completedCount}
              canClaim={canClaimBonus}
              onClaim={handleClaimBonus}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default WeeklyChallengesPanel;
