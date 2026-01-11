import { motion } from 'framer-motion';
import { designColors } from '../designConstants';
import { cardTap } from '../animationPresets';
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
  // Desktop: Enhanced 2-column with position banner spanning full width
  if (isDesktop && leaderboard) {
    return (
      <div style={{
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <EarningsHeader title="LIVE ARENA" onBack={onBack} showLive={true} />

        {/* Position banner spans full width */}
        <div style={{ padding: '0 24px' }}>
          <PositionBanner {...userPosition} totalPlayers={tournament?.participantCount} />
        </div>

        {/* Main content: Predictions + Leaderboard */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Left: Prediction cards */}
          <div style={{
            flex: 1,
            padding: '8px 24px 24px',
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: designColors.textSecondary,
              marginBottom: '16px',
              letterSpacing: '0.5px',
            }}>
              YOUR PREDICTIONS
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
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

          {/* Right: Leaderboard sidebar */}
          <div style={{
            width: '320px',
            borderLeft: `1px solid ${designColors.borderDefault}`,
            backgroundColor: designColors.bgCard,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Sticky header */}
            <div style={{
              padding: '16px',
              borderBottom: `1px solid ${designColors.borderDefault}`,
              backgroundColor: designColors.bgCard,
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: designColors.textSecondary,
                  letterSpacing: '0.5px',
                }}>
                  LEADERBOARD
                </span>
                <span style={{
                  fontSize: '11px',
                  color: designColors.textMuted,
                }}>
                  WEEK {tournament?.week}
                </span>
              </div>
            </div>

            {/* Scrollable leaderboard */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {leaderboard.slice(0, 15).map((entry, index) => (
                <LeaderboardRow
                  key={entry.odId || index}
                  {...entry}
                  isCurrentUser={entry.odId === currentUserId}
                  index={index}
                />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${designColors.borderDefault}`,
              textAlign: 'center',
              fontSize: '12px',
              color: designColors.textMuted,
            }}>
              {tournament?.participantCount || leaderboard.length} players total
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
          whileTap={cardTap}
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
