import { motion } from 'framer-motion';
import { designColors, fontMono, glowEffects, MEDALS } from '../designConstants';
import { cardTap } from '../animationPresets';
import { EarningsHeader, BracketBadge } from '../shared';
import ResultCard from './ResultCard';

// XP calculation (simplified version from resolution service)
const XP_REWARDS = {
  participation: 50,
  first: 500,
  second: 350,
  third: 250,
  top10: 150,
  diamond: 100,
  platinum: 75,
  gold: 50,
  silver: 25,
  bronze: 10,
  perfectPrediction: 25,
  allCorrect: 200,
};

function calculateXP(rank, bracket, correctCount, totalCount) {
  let xp = XP_REWARDS.participation;

  if (rank === 1) xp += XP_REWARDS.first;
  else if (rank === 2) xp += XP_REWARDS.second;
  else if (rank === 3) xp += XP_REWARDS.third;
  else if (rank <= 10) xp += XP_REWARDS.top10;
  else if (bracket) xp += XP_REWARDS[bracket] || 0;

  xp += correctCount * XP_REWARDS.perfectPrediction;

  if (correctCount === totalCount && correctCount > 0) {
    xp += XP_REWARDS.allCorrect;
  }

  return xp;
}

export default function TournamentResults({
  predictions,
  resultsData = {},     // { [eventId]: { isCorrect, pointsEarned, actualMove, actualOutcome, actualMagnitude } }
  userPosition,         // { rank, points, bracket, medal }
  tournament,
  xpEarned = null,      // Optional pre-calculated XP
  onPlayNext,
  onViewLeaderboard,
  isDesktop = false,
}) {
  // Calculate stats - now supports resolved predictions with more detail
  const results = predictions.map(p => {
    const result = resultsData[p.eventId] || {};
    return {
      ...p,
      isCorrect: p.isCorrect !== undefined ? p.isCorrect : (result.isCorrect || false),
      pointsEarned: p.pointsEarned !== undefined ? p.pointsEarned : (result.pointsEarned || 0),
      actualMove: p.actualMove !== undefined ? p.actualMove : result.actualMove,
      actualOutcome: p.actualOutcome !== undefined ? p.actualOutcome : result.actualOutcome,
      actualMagnitude: p.actualMagnitude !== undefined ? p.actualMagnitude : result.actualMagnitude,
      resolved: p.resolved !== undefined ? p.resolved : result.resolved,
    };
  });

  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = results.length;
  const pendingCount = results.filter(r => !r.resolved && !r.isCorrect).length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / (totalCount - pendingCount || 1)) * 100) : 0;

  // Calculate XP if not provided
  const earnedXP = xpEarned || calculateXP(
    userPosition.rank,
    userPosition.bracket,
    correctCount,
    totalCount
  );

  // Get medal for rank
  const medal = userPosition.medal || (
    userPosition.rank === 1 ? MEDALS?.gold :
    userPosition.rank === 2 ? MEDALS?.silver :
    userPosition.rank === 3 ? MEDALS?.bronze :
    userPosition.rank <= 10 ? MEDALS?.top10 : null
  );

  // Points to next bracket
  const getPointsToNextBracket = () => {
    // This would be calculated from actual leaderboard data
    // For now, return a mock value
    if (userPosition.bracket === 'silver') return { points: 1200, bracket: 'Gold' };
    if (userPosition.bracket === 'bronze') return { points: 2500, bracket: 'Silver' };
    return null;
  };

  const nextBracket = getPointsToNextBracket();

  // Desktop layout - wider hero, 2-column results
  if (isDesktop) {
    return (
      <div style={{
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
      }}>
        <EarningsHeader
          title={`WEEK ${tournament?.week} RESULTS`}
          onBack={onPlayNext}
        />

        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px' }}>
          {/* Hero Section - Wider */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              borderBottom: `1px solid ${designColors.borderDefault}`,
              marginBottom: '32px',
            }}
          >
            <BracketBadge
              bracket={userPosition.bracket}
              size="large"
              showGlow={true}
            />

            <div style={{
              fontSize: '24px',
              color: designColors.textSecondary,
              marginTop: '20px',
            }}>
              #{userPosition.rank} of {tournament?.participantCount || 147}
            </div>

            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              fontFamily: fontMono,
              color: designColors.cyan,
              marginTop: '8px',
            }}>
              {userPosition.points?.toLocaleString()} PTS
            </div>

            {/* XP Earned Badge */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              style={{
                marginTop: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${designColors.green}`,
                borderRadius: '20px',
              }}
            >
              <span style={{ fontSize: '16px' }}>+{earnedXP}</span>
              <span style={{ color: designColors.green, fontWeight: '600', fontSize: '12px' }}>XP EARNED</span>
            </motion.div>

            {nextBracket && (
              <div style={{
                fontSize: '14px',
                color: designColors.textMuted,
                marginTop: '16px',
                padding: '10px 20px',
                backgroundColor: designColors.bgCard,
                borderRadius: '20px',
                display: 'inline-block',
              }}>
                {nextBracket.points.toLocaleString()} pts from {nextBracket.bracket}
              </div>
            )}
          </motion.div>

          {/* Results section with 2-column grid */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: designColors.textSecondary,
              letterSpacing: '0.5px',
            }}>
              YOUR PREDICTIONS
            </span>
            <span style={{
              fontSize: '14px',
              color: designColors.textSecondary,
            }}>
              {correctCount}/{totalCount} correct · {accuracy}% accuracy
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '32px',
          }}>
            {results.map((result, index) => (
              <ResultCard
                key={result.eventId}
                prediction={result}
                isCorrect={result.isCorrect}
                pointsEarned={result.pointsEarned}
                index={index}
              />
            ))}
          </div>

          {/* CTAs - Inline for desktop */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            paddingBottom: '40px',
          }}>
            <motion.button
              onClick={onPlayNext}
              whileHover={{ scale: 1.02 }}
              whileTap={cardTap}
              style={{
                padding: '16px 48px',
                backgroundColor: designColors.cyan,
                border: 'none',
                borderRadius: '10px',
                color: designColors.bgPrimary,
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: glowEffects.cyanIntense,
              }}
            >
              PLAY WEEK {(tournament?.week || 3) + 1} →
            </motion.button>

            <motion.button
              onClick={onViewLeaderboard}
              whileHover={{ scale: 1.02 }}
              whileTap={cardTap}
              style={{
                padding: '16px 32px',
                backgroundColor: 'transparent',
                border: `1px solid ${designColors.borderDefault}`,
                borderRadius: '10px',
                color: designColors.textSecondary,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              View Leaderboard
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
        paddingBottom: '100px',
      }}
    >
      <EarningsHeader
        title={`WEEK ${tournament?.week} RESULTS`}
        onBack={onPlayNext}  // Back goes to next week
      />

      {/* Hero Section */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          textAlign: 'center',
          padding: '32px 20px',
        }}
      >
        {/* Bracket Badge */}
        <BracketBadge
          bracket={userPosition.bracket}
          size="large"
          showGlow={true}
        />

        {/* Rank */}
        <div style={{
          fontSize: '20px',
          color: designColors.textSecondary,
          marginTop: '16px',
        }}>
          #{userPosition.rank} of {tournament?.participantCount || 147}
        </div>

        {/* Points */}
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          fontFamily: fontMono,
          color: designColors.cyan,
          marginTop: '8px',
        }}>
          {userPosition.points?.toLocaleString()} PTS
        </div>

        {/* XP Earned Badge */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          style={{
            marginTop: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${designColors.green}`,
            borderRadius: '16px',
          }}
        >
          <span style={{ fontSize: '14px' }}>+{earnedXP}</span>
          <span style={{ color: designColors.green, fontWeight: '600', fontSize: '11px' }}>XP</span>
        </motion.div>

        {/* Gap to next bracket */}
        {nextBracket && (
          <div style={{
            fontSize: '13px',
            color: designColors.textMuted,
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: designColors.bgCard,
            borderRadius: '20px',
            display: 'inline-block',
          }}>
            {nextBracket.points.toLocaleString()} pts from {nextBracket.bracket}
          </div>
        )}
      </motion.div>

      {/* Predictions Results */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: designColors.textSecondary,
          marginBottom: '12px',
          letterSpacing: '0.5px',
        }}>
          YOUR PREDICTIONS
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {results.map((result, index) => (
            <ResultCard
              key={result.eventId}
              prediction={result}
              isCorrect={result.isCorrect}
              pointsEarned={result.pointsEarned}
              index={index}
            />
          ))}
        </div>

        {/* Stats summary */}
        <div style={{
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '14px',
          color: designColors.textSecondary,
        }}>
          {correctCount}/{totalCount} correct · {accuracy}% accuracy
        </div>
      </div>

      {/* Bottom CTAs */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px',
        backgroundColor: designColors.bgPrimary,
        borderTop: `1px solid ${designColors.borderDefault}`,
      }}>
        <motion.button
          onClick={onPlayNext}
          whileTap={cardTap}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: designColors.cyan,
            border: 'none',
            borderRadius: '10px',
            color: designColors.bgPrimary,
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: glowEffects.cyanIntense,
            marginBottom: '10px',
          }}
        >
          PLAY WEEK {(tournament?.week || 3) + 1} →
        </motion.button>

        <motion.button
          onClick={onViewLeaderboard}
          whileTap={cardTap}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: 'transparent',
            border: 'none',
            color: designColors.textSecondary,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          View Leaderboard
        </motion.button>
      </div>
    </motion.div>
  );
}
