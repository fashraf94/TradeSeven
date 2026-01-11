import { motion } from 'framer-motion';
import { designColors, fontMono } from '../designConstants';
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
        margin: '12px 16px',
        padding: '12px 16px',
        backgroundColor: designColors.bgCard,
        borderRadius: '12px',
        border: `1px solid ${designColors.borderDefault}`,
      }}
    >
      {/* Top row: Week + Countdown */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: '13px',
          color: designColors.textSecondary,
        }}>
          {picksCount} picks ·
          <span style={{
            fontFamily: fontMono,
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
