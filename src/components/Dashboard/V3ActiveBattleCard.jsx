// /src/components/Dashboard/V3ActiveBattleCard.jsx
// Active battle card for V3 BaggerBomb battles with live score calculation

import { motion } from 'framer-motion';
import { GraduationCap, User, Target } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import useBaggerBombBattleV3 from '../../hooks/useBaggerBombBattleV3';

const V3ActiveBattleCard = ({
  battle,
  user,
  colors,
  index,
  setCurrentBattle,
  setScreen,
  battleTimer,
}) => {
  // Use the V3 hook to get live calculated scores
  const {
    myScore,
    opponentScore,
    isCreator,
  } = useBaggerBombBattleV3(battle?.id, user);

  // Determine opponent name
  const opponent = isCreator
    ? (battle.opponent?.username || 'Waiting...')
    : (battle.creator?.username || 'Creator');

  // Use live calculated scores (these are point scores, not percentages for V3)
  const myGain = myScore?.totalScore || 0;
  const theirGain = opponentScore?.totalScore || 0;
  const isWinning = myGain > theirGain;
  const leadBy = Math.abs(myGain - theirGain);

  // For progress bar, use base values + scores
  const myValue = 1000000 + myGain * 1000;
  const theirValue = 1000000 + theirGain * 1000;

  return (
    <motion.div
      key={battle.id || battle.firestoreId || index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      style={{
        background: colors.cardBg,
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '12px',
        border: `1px solid ${battle.isTrainingBattle ? colors.purple + '60' : colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.3s'
      }}
      onClick={() => {
        setCurrentBattle(battle);
        setScreen('battle');
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = battle.isTrainingBattle ? colors.purple : colors.cyan;
        e.currentTarget.style.boxShadow = `0 0 20px ${battle.isTrainingBattle ? colors.purple : colors.cyan}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = battle.isTrainingBattle ? colors.purple + '60' : colors.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Battle Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {battle.isTrainingBattle && <GraduationCap style={{ height: '16px', width: '16px', color: colors.purple }} />}
          <span style={{
            background: `${colors.purple}30`,
            color: colors.purple,
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '700'
          }}>
            BB3
          </span>
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {battle.isTrainingBattle ? 'TRAINING' : 'BATTLE'}: vs {opponent}
          </span>
        </div>
        <span style={{
          fontSize: '14px',
          fontWeight: '600',
          color: colors.cyan,
          fontFamily: "'SF Mono', 'Monaco', monospace"
        }}>
          {battleTimer.formatTimeRemaining(battle)} left
        </span>
      </div>

      {/* Player Comparison - V3 uses points not percentages */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        {/* You */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.green}30 0%, ${colors.cyan}30 100%)`,
            border: `2px solid ${colors.green}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User style={{ height: '20px', width: '20px', color: colors.green }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: colors.textSecondary }}>YOU ({user.username})</div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: myGain >= 0 ? colors.green : colors.red
            }}>
              {myGain >= 0 ? '+' : ''}{myGain} pts
            </div>
          </div>
        </div>

        {/* Opponent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexDirection: 'row-reverse' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.red}30 0%, ${colors.purple}30 100%)`,
            border: `2px solid ${colors.red}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Target style={{ height: '20px', width: '20px', color: colors.red }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', color: colors.textSecondary }}>OPPONENT</div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: theirGain >= 0 ? colors.green : colors.red
            }}>
              {theirGain >= 0 ? '+' : ''}{theirGain} pts
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        position: 'relative',
        height: '8px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '9999px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(myValue / (myValue + theirValue)) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            height: '100%',
            borderRadius: '9999px',
            background: isWinning
              ? `linear-gradient(90deg, #4ADE80 0%, ${HOLO_COLORS.defensive} 100%)`
              : `linear-gradient(90deg, ${HOLO_COLORS.ratingSell} 0%, #DC2626 100%)`
          }}
        />
      </div>

      {/* Status & Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          fontSize: '13px',
          fontWeight: '600',
          color: isWinning ? colors.green : (myGain === theirGain ? colors.textSecondary : colors.red)
        }}>
          {isWinning ? `LEADING BY +${leadBy} pts` : (myGain === theirGain ? 'TIED' : `TRAILING BY -${leadBy} pts`)}
        </span>
        <button
          style={{
            padding: '8px 16px',
            background: battle.isTrainingBattle ? colors.purple : colors.cyan,
            border: 'none',
            borderRadius: '8px',
            color: colors.background,
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          VIEW BATTLE
        </button>
      </div>
    </motion.div>
  );
};

export default V3ActiveBattleCard;
