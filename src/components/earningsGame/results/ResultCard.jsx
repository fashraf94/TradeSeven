import { motion } from 'framer-motion';
import { designColors, fontMono, MAGNITUDES } from '../designConstants';

export default function ResultCard({
  prediction,
  isCorrect,
  pointsEarned,
  index = 0,
}) {
  const mag = MAGNITUDES.find(m => m.id === prediction.magnitude);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: designColors.bgCard,
        borderRadius: '8px',
        border: `1px solid ${isCorrect ? designColors.green : designColors.borderDefault}`,
        gap: '12px',
      }}
    >
      {/* Status icon */}
      <span style={{
        fontSize: '16px',
        color: isCorrect ? designColors.green : designColors.red,
      }}>
        {isCorrect ? '✓' : '✗'}
      </span>

      {/* Symbol */}
      <span style={{
        fontSize: '14px',
        fontWeight: 'bold',
        color: designColors.textPrimary,
        minWidth: '50px',
      }}>
        {prediction.symbol}
      </span>

      {/* Prediction details */}
      <span style={{
        flex: 1,
        fontSize: '13px',
        color: designColors.textSecondary,
      }}>
        <span style={{
          color: prediction.outcome === 'beat' ? designColors.green : designColors.red
        }}>
          {prediction.outcome?.toUpperCase()}
        </span>
        {' + '}
        <span style={{ color: designColors.textPrimary }}>
          {mag?.label}
        </span>
      </span>

      {/* Points */}
      <span style={{
        fontSize: '14px',
        fontWeight: 'bold',
        fontFamily: fontMono,
        color: isCorrect ? designColors.green : designColors.textMuted,
      }}>
        {isCorrect ? `+${(pointsEarned || 0).toLocaleString()}` : '0'} pts
      </span>
    </motion.div>
  );
}
