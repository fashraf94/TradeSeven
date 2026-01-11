import { motion } from 'framer-motion';
import { designColors, fontMono, BRACKETS } from '../designConstants';
import { staggerChild } from '../animationPresets';

export default function LeaderboardRow({
  rank,
  bracket,
  username,
  points,
  isCurrentUser = false,
  index = 0,
}) {
  const bracketConfig = BRACKETS[bracket] || BRACKETS.bronze;

  return (
    <motion.div
      {...staggerChild(index, 0.03)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: isCurrentUser ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
        borderLeft: isCurrentUser ? `3px solid ${designColors.cyan}` : '3px solid transparent',
        borderBottom: `1px solid ${designColors.borderDefault}`,
      }}
    >
      <span style={{
        width: '32px',
        fontSize: '14px',
        fontWeight: 'bold',
        fontFamily: fontMono,
        color: isCurrentUser ? designColors.cyan : designColors.textSecondary,
      }}>
        {rank}.
      </span>

      <span style={{ width: '28px', fontSize: '16px' }}>
        {bracketConfig.emoji}
      </span>

      <span style={{
        flex: 1,
        fontSize: '14px',
        fontWeight: isCurrentUser ? 'bold' : 'normal',
        color: isCurrentUser ? designColors.textPrimary : designColors.textSecondary,
      }}>
        {isCurrentUser ? 'YOU' : username}
        {isCurrentUser && <span style={{ color: designColors.cyan, marginLeft: '6px' }}>◀</span>}
      </span>

      <span style={{
        fontSize: '14px',
        fontWeight: 'bold',
        fontFamily: fontMono,
        color: isCurrentUser ? designColors.cyan : designColors.textPrimary,
      }}>
        {points.toLocaleString()}
      </span>
    </motion.div>
  );
}
