import { motion } from 'framer-motion';
import { designColors } from '../designConstants';
import { cardBase, flexBetween, monoNumber } from '../styleUtils';
import { CountdownTimer } from '../shared';

export default function TournamentBanner({
  week,
  lockDeadline,
  picksCount,
  totalSpent,
  onViewPortfolio,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        ...cardBase,
        margin: '12px 16px',
        padding: '12px 16px',
      }}
    >
      {/* Top row: Week + Countdown */}
      <div style={{
        ...flexBetween,
        marginBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🏆</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: designColors.textPrimary,
          }}>
            WEEK {week}
          </span>
        </div>
        <CountdownTimer deadline={lockDeadline} size="medium" />
      </div>

      {/* Bottom row: Portfolio summary + View link */}
      <div style={flexBetween}>
        <span style={{
          fontSize: '13px',
          color: designColors.textSecondary,
        }}>
          {picksCount} picks ·
          <span style={{
            ...monoNumber,
            color: designColors.cyan,
            marginLeft: '4px',
          }}>
            ${totalSpent.toLocaleString()}
          </span>
          {' '}spent
        </span>

        <motion.button
          onClick={onViewPortfolio}
          whileTap={{ scale: 0.95 }}
          style={{
            background: 'none',
            border: 'none',
            color: designColors.cyan,
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          [VIEW]
        </motion.button>
      </div>
    </motion.div>
  );
}
