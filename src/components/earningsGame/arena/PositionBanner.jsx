import { motion } from 'framer-motion';
import { designColors, fontMono, BRACKETS } from '../designConstants';

export default function PositionBanner({
  rank,
  totalPlayers,
  points,
  bracket,
  movement = 0,
}) {
  const bracketConfig = BRACKETS[bracket] || BRACKETS.bronze;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: '12px 16px',
        padding: '14px 16px',
        backgroundColor: designColors.bgCard,
        borderRadius: '12px',
        border: `1px solid ${designColors.borderDefault}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          fontFamily: fontMono,
          color: designColors.textPrimary,
        }}>
          #{rank}
        </div>
        {movement !== 0 && (
          <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: movement > 0 ? designColors.green : designColors.red,
            marginTop: '2px',
          }}>
            {movement > 0 ? '▲' : '▼'}{Math.abs(movement)} today
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '20px',
          fontWeight: 'bold',
          fontFamily: fontMono,
          color: designColors.cyan,
        }}>
          {points.toLocaleString()} pts
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '20px', marginBottom: '2px' }}>
          {bracketConfig.emoji}
        </div>
        <div style={{
          fontSize: '11px',
          fontWeight: 'bold',
          color: bracketConfig.color,
        }}>
          {bracketConfig.label}
        </div>
      </div>
    </motion.div>
  );
}
