import { motion } from 'framer-motion';
import { designColors, fontMono, glowEffects } from '../designConstants';
import { EarningsHeader, BracketBadge } from '../shared';
import ResultCard from './ResultCard';

export default function TournamentResults({
  predictions,
  resultsData,          // { [eventId]: { isCorrect, pointsEarned } }
  userPosition,         // { rank, points, bracket }
  tournament,
  onPlayNext,
  onViewLeaderboard,
  isDesktop = false,
}) {
  // Calculate stats
  const results = predictions.map(p => ({
    ...p,
    isCorrect: resultsData[p.eventId]?.isCorrect || false,
    pointsEarned: resultsData[p.eventId]?.pointsEarned || 0,
  }));

  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = results.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  // Points to next bracket
  const getPointsToNextBracket = () => {
    // This would be calculated from actual leaderboard data
    // For now, return a mock value
    if (userPosition.bracket === 'silver') return { points: 1200, bracket: 'Gold' };
    if (userPosition.bracket === 'bronze') return { points: 2500, bracket: 'Silver' };
    return null;
  };

  const nextBracket = getPointsToNextBracket();

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
          whileTap={{ scale: 0.98 }}
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
          whileTap={{ scale: 0.98 }}
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
