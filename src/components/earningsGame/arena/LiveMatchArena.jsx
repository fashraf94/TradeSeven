import { motion } from 'framer-motion';
import { designColors } from '../designConstants';
import { EarningsHeader } from '../shared';
import PositionBanner from './PositionBanner';
import MagnitudeGaugeCard from './MagnitudeGaugeCard';
import LeaderboardRow from '../leaderboard/LeaderboardRow';

export default function LiveMatchArena({
  predictions,
  userPosition,
  resultsData = {},
  onBack,
  onViewLeaderboard,
  leaderboard = null,
  currentUserId,
  tournament,
  isDesktop = false,
}) {
  // Desktop: 2-column with inline leaderboard
  if (isDesktop && leaderboard) {
    return (
      <div style={{ backgroundColor: designColors.bgPrimary, minHeight: '100vh' }}>
        <EarningsHeader title="LIVE ARENA" onBack={onBack} showLive={true} />

        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1, padding: '0 16px' }}>
            <PositionBanner {...userPosition} totalPlayers={tournament?.participantCount} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '20px' }}>
              {predictions.map((prediction, index) => (
                <MagnitudeGaugeCard
                  key={prediction.eventId}
                  prediction={prediction}
                  actualMove={resultsData[prediction.eventId]?.actualMove}
                  outcomeCorrect={resultsData[prediction.eventId]?.outcomeCorrect}
                  index={index}
                />
              ))}
            </div>
          </div>

          <div style={{
            width: '320px',
            borderLeft: `1px solid ${designColors.borderDefault}`,
            backgroundColor: designColors.bgCard,
          }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${designColors.borderDefault}` }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: designColors.textSecondary }}>
                LEADERBOARD
              </span>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {leaderboard.slice(0, 15).map((entry, index) => (
                <LeaderboardRow
                  key={entry.odId || index}
                  {...entry}
                  isCurrentUser={entry.odId === currentUserId}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ backgroundColor: designColors.bgPrimary, minHeight: '100vh', paddingBottom: '80px' }}
    >
      <EarningsHeader title="LIVE ARENA" onBack={onBack} showLive={true} />
      <PositionBanner {...userPosition} totalPlayers={tournament?.participantCount} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 16px' }}>
        {predictions.map((prediction, index) => (
          <MagnitudeGaugeCard
            key={prediction.eventId}
            prediction={prediction}
            actualMove={resultsData[prediction.eventId]?.actualMove}
            outcomeCorrect={resultsData[prediction.eventId]?.outcomeCorrect}
            index={index}
          />
        ))}
      </div>

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
          onClick={onViewLeaderboard}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: designColors.bgCard,
            border: `1px solid ${designColors.borderDefault}`,
            borderRadius: '10px',
            color: designColors.textPrimary,
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          VIEW LEADERBOARD
        </motion.button>
      </div>
    </motion.div>
  );
}
