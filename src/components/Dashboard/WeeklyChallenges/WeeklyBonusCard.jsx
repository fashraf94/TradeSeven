// /src/components/Dashboard/WeeklyChallenges/WeeklyBonusCard.jsx
// Weekly bonus card - complete all 4 daily challenges to claim bonus XP

import { motion } from 'framer-motion';
import { CHALLENGE_XP } from './challengeDefinitions';

export default function WeeklyBonusCard({ completedCount, canClaim, onClaim }) {
  return (
    <motion.div
      layout
      style={{
        marginTop: '16px',
        padding: '16px',
        background: canClaim
          ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(167, 139, 250, 0.15))'
          : 'rgba(168, 85, 247, 0.1)',
        borderRadius: '12px',
        border: canClaim
          ? '1px solid #7c3aed'
          : '1px solid rgba(168, 85, 247, 0.3)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '24px' }}>🏆</span>
        <div style={{ flex: 1 }}>
          <h4 style={{
            color: '#e6edf3',
            fontSize: '13px',
            fontWeight: '600',
            margin: 0,
          }}>
            Weekly Bonus
          </h4>
          <p style={{
            color: '#8b949e',
            fontSize: '12px',
            margin: '2px 0 0',
          }}>
            Complete all 4 challenges for bonus XP!
          </p>
        </div>
        <span style={{
          color: '#a78bfa',
          fontSize: '13px',
          fontWeight: '700',
        }}>
          +{CHALLENGE_XP.weeklyBonus} XP
        </span>
      </div>

      {/* Progress segments (4 bars) */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.1 }}
            style={{
              flex: 1,
              height: '4px',
              background: i < completedCount ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
              transformOrigin: 'left',
            }}
          />
        ))}
      </div>

      {/* Claim button when all 4 completed */}
      {canClaim && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClaim}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '10px',
            background: '#10b981',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          CLAIM BONUS
        </motion.button>
      )}
    </motion.div>
  );
}
