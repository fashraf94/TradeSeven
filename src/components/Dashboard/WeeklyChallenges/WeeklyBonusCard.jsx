// /src/components/Dashboard/WeeklyChallenges/WeeklyBonusCard.jsx
// Weekly bonus card - complete all 4 daily challenges to claim bonus XP

import { motion } from 'framer-motion';
import { useIsMobile } from '../../../hooks';
import { CHALLENGE_XP } from './challengeDefinitions';

export default function WeeklyBonusCard({ completedCount, canClaim, onClaim }) {
  const { isMobile } = useIsMobile();

  return (
    <motion.div
      layout
      style={{
        marginTop: '16px',
        padding: isMobile ? '14px' : '18px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        background: canClaim
          ? 'linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 50%, #1a1a2e 100%)'
          : 'linear-gradient(135deg, rgba(30, 20, 50, 0.8) 0%, rgba(45, 31, 61, 0.6) 50%, rgba(30, 20, 50, 0.8) 100%)',
        borderRadius: '14px',
        border: canClaim
          ? '2px solid #8b5cf6'
          : '1px solid rgba(139, 92, 246, 0.4)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: canClaim
          ? '0 0 30px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
          : '0 0 20px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Shimmer animation overlay */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
          pointerEvents: 'none',
        }}
        animate={{ x: ['-100%', '300%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
      />

      {/* Top row: Icon, Title, and XP */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Glowing trophy icon */}
        <span style={{
          fontSize: isMobile ? '24px' : '28px',
          flexShrink: 0,
          lineHeight: 1,
          filter: canClaim
            ? 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.8))'
            : 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.4))',
        }}>
          🏆
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}>
            <h4 style={{
              color: '#f0f0f0',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '700',
              margin: 0,
              textShadow: canClaim ? '0 0 10px rgba(255,255,255,0.3)' : 'none',
            }}>
              Weekly Bonus
            </h4>
            {/* Glowing XP amount */}
            <span style={{
              color: '#fbbf24',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '700',
              flexShrink: 0,
              textShadow: canClaim
                ? '0 0 15px rgba(251, 191, 36, 0.8)'
                : '0 0 8px rgba(251, 191, 36, 0.4)',
            }}>
              +{CHALLENGE_XP.weeklyBonus} XP
            </span>
          </div>
          <p style={{
            color: '#a78bfa',
            fontSize: isMobile ? '11px' : '12px',
            margin: 0,
            whiteSpace: 'normal',
            lineHeight: '1.4',
          }}>
            Complete all 4 challenges for bonus XP!
          </p>
        </div>
      </div>

      {/* Progress segments (4 bars) with glow */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '14px',
        position: 'relative',
        zIndex: 1,
      }}>
        {[0, 1, 2, 3].map(i => {
          const isCompleted = i < completedCount;
          return (
            <motion.div
              key={i}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.1 }}
              style={{
                flex: 1,
                height: '6px',
                background: isCompleted
                  ? 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)'
                  : 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                transformOrigin: 'left',
                boxShadow: isCompleted
                  ? '0 0 10px rgba(139, 92, 246, 0.6)'
                  : 'none',
              }}
            />
          );
        })}
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
            marginTop: '14px',
            padding: '12px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            border: '1px solid #a78bfa',
            borderRadius: '10px',
            color: '#fff',
            fontWeight: '700',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          ✨ CLAIM BONUS
        </motion.button>
      )}
    </motion.div>
  );
}
