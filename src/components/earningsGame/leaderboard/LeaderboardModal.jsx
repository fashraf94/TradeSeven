import { motion } from 'framer-motion';
import { designColors } from '../designConstants';
import { EarningsHeader } from '../shared';
import LeaderboardRow from './LeaderboardRow';

export default function LeaderboardModal({
  leaderboard,
  currentUserId,
  tournament,
  onClose,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: designColors.bgPrimary,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <EarningsHeader
        title="LEADERBOARD"
        onBack={onClose}
        rightElement={
          <span style={{ fontSize: '12px', color: designColors.textSecondary }}>
            WEEK {tournament?.week}
          </span>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {leaderboard.map((entry, index) => (
          <LeaderboardRow
            key={entry.odId || index}
            rank={entry.rank}
            bracket={entry.bracket}
            username={entry.username}
            points={entry.points}
            isCurrentUser={entry.odId === currentUserId}
            index={index}
          />
        ))}
      </div>

      <div style={{
        padding: '16px',
        textAlign: 'center',
        borderTop: `1px solid ${designColors.borderDefault}`,
        fontSize: '13px',
        color: designColors.textMuted,
      }}>
        {tournament?.participantCount || leaderboard.length} players total
      </div>
    </motion.div>
  );
}
