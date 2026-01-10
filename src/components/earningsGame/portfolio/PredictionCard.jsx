import { motion } from 'framer-motion';
import { designColors, fontMono, MAGNITUDES } from '../designConstants';

export default function PredictionCard({
  prediction,
  onRemove,
  isLocked = false,
  index = 0,
}) {
  const mag = MAGNITUDES.find(m => m.id === prediction.magnitude);

  const riskColors = {
    low: designColors.green,
    medium: designColors.cyan,
    high: designColors.orange,
    extreme: designColors.red,
  };
  const riskColor = riskColors[prediction.risk?.level] || designColors.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ delay: index * 0.05 }}
      layout
      style={{
        padding: '14px',
        backgroundColor: designColors.bgCard,
        borderRadius: '10px',
        border: `1px solid ${designColors.borderDefault}`,
      }}
    >
      {/* Top row: Symbol + Prediction + Risk dot */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Symbol */}
          <span style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: designColors.textPrimary,
          }}>
            {prediction.symbol}
          </span>

          {/* Divider */}
          <span style={{ color: designColors.textMuted }}>|</span>

          {/* Prediction */}
          <span style={{
            fontSize: '13px',
            color: prediction.outcome === 'beat' ? designColors.green : designColors.red,
            fontWeight: 'bold',
          }}>
            {prediction.outcome?.toUpperCase()}
          </span>
          <span style={{ color: designColors.textMuted }}>+</span>
          <span style={{
            fontSize: '13px',
            color: designColors.textPrimary,
          }}>
            {mag?.label} {mag?.emoji}
          </span>
        </div>

        {/* Risk indicator */}
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: riskColor,
          boxShadow: `0 0 6px ${riskColor}`,
        }} />
      </div>

      {/* Bottom row: Points + Remove button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          fontFamily: fontMono,
          color: designColors.cyan,
        }}>
          {prediction.potentialPoints?.toLocaleString()} Points
        </span>

        {!isLocked && (
          <motion.button
            onClick={() => onRemove(prediction.eventId)}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'none',
              border: 'none',
              color: designColors.textMuted,
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Remove
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
