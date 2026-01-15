import { motion } from 'framer-motion';
import { designColors, fontMono, BRACKETS, MEDALS } from '../designConstants';
import { staggerChild } from '../animationPresets';

/**
 * Get medal for a rank
 */
function getMedal(rank) {
  if (rank === 1) return MEDALS.gold;
  if (rank === 2) return MEDALS.silver;
  if (rank === 3) return MEDALS.bronze;
  if (rank <= 10) return MEDALS.top10;
  return null;
}

export default function LeaderboardRow({
  rank,
  bracket,
  username,
  points,
  medal = null,
  entryNumber = null,
  isBot = false,
  isCurrentUser = false,
  onClick = null,
  index = 0,
}) {
  const bracketConfig = BRACKETS[bracket] || BRACKETS.bronze;
  const medalConfig = medal ? MEDALS[medal] : getMedal(rank);

  return (
    <motion.div
      {...staggerChild(index, 0.03)}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: isCurrentUser ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
        borderLeft: isCurrentUser ? `3px solid ${designColors.cyan}` : '3px solid transparent',
        borderBottom: `1px solid ${designColors.borderDefault}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.2s',
      }}
      whileHover={onClick ? { backgroundColor: 'rgba(255, 255, 255, 0.05)' } : {}}
    >
      {/* Rank with medal */}
      <div style={{
        width: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {medalConfig ? (
          <span style={{
            fontSize: '18px',
            filter: rank <= 3 ? 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.5))' : 'none',
          }}>
            {medalConfig.icon}
          </span>
        ) : (
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            fontFamily: fontMono,
            color: isCurrentUser ? designColors.cyan : designColors.textSecondary,
          }}>
            {rank}.
          </span>
        )}
      </div>

      {/* Bracket badge */}
      <span style={{
        width: '28px',
        fontSize: '16px',
        textAlign: 'center',
      }}>
        {bracketConfig.emoji}
      </span>

      {/* Username */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{
          fontSize: '14px',
          fontWeight: isCurrentUser ? 'bold' : 'normal',
          color: isCurrentUser ? designColors.textPrimary : designColors.textSecondary,
        }}>
          {isCurrentUser ? 'YOU' : username}
        </span>

        {/* Entry number badge */}
        {entryNumber && entryNumber > 1 && (
          <span style={{
            fontSize: '10px',
            color: designColors.textMuted,
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 4px',
            borderRadius: '3px',
          }}>
            #{entryNumber}
          </span>
        )}

        {/* Bot badge */}
        {isBot && (
          <span style={{
            fontSize: '9px',
            color: designColors.violet,
            background: 'rgba(139, 92, 246, 0.2)',
            padding: '2px 5px',
            borderRadius: '3px',
            fontWeight: '600',
            letterSpacing: '0.5px',
          }}>
            BOT
          </span>
        )}

        {/* Current user indicator */}
        {isCurrentUser && (
          <span style={{ color: designColors.cyan, fontSize: '12px' }}>
            |
          </span>
        )}
      </div>

      {/* Points */}
      <span style={{
        fontSize: '14px',
        fontWeight: 'bold',
        fontFamily: fontMono,
        color: isCurrentUser ? designColors.cyan : designColors.textPrimary,
      }}>
        {(points || 0).toLocaleString()}
        <span style={{
          fontSize: '10px',
          color: designColors.textMuted,
          marginLeft: '4px',
        }}>
          pts
        </span>
      </span>
    </motion.div>
  );
}
