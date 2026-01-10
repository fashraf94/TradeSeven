import { motion } from 'framer-motion';
import { designColors, glowEffects, fontMono, MAGNITUDES } from '../designConstants';

export default function PredictionSummary({
  symbol,
  outcome,           // 'beat' | 'miss'
  magnitude,         // magnitude id
  price,             // number
  potentialPoints,   // number
  riskLevel,         // 'low' | 'medium' | 'high'
  onConfirm,         // () => void
  disabled = false,  // True if selection incomplete
}) {
  const magnitudeInfo = MAGNITUDES.find(m => m.id === magnitude);
  const outcomeLabel = outcome === 'beat' ? 'BEAT' : 'MISS';
  const outcomeColor = outcome === 'beat' ? designColors.green : designColors.red;

  const riskColors = {
    low: designColors.green,
    medium: designColors.orange,
    high: designColors.red,
  };

  const riskColor = riskColors[riskLevel] || designColors.textMuted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: disabled ? 0.5 : 1, y: 0 }}
      style={{
        backgroundColor: designColors.bgCardInner,
        border: `1px solid ${disabled ? designColors.borderDefault : designColors.cyan}`,
        borderRadius: '12px',
        padding: '16px',
        boxShadow: disabled ? 'none' : glowEffects.cyan,
      }}
    >
      {/* Prediction text */}
      <div style={{
        fontSize: '14px',
        color: designColors.textSecondary,
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        {disabled ? (
          <span>Complete your prediction...</span>
        ) : (
          <>
            <span style={{ color: designColors.textPrimary, fontWeight: 'bold' }}>
              {symbol}
            </span>
            {' will '}
            <span style={{ color: outcomeColor, fontWeight: 'bold' }}>
              {outcomeLabel}
            </span>
            {' and move '}
            <span style={{ color: designColors.cyan, fontWeight: 'bold' }}>
              {magnitudeInfo?.label || '...'}
            </span>
            {' '}
            <span style={{ fontSize: '16px' }}>
              {magnitudeInfo?.emoji}
            </span>
          </>
        )}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: designColors.bgCard,
        borderRadius: '8px',
      }}>
        {/* Cost */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            COST
          </div>
          <div style={{
            fontFamily: fontMono,
            fontSize: '18px',
            fontWeight: 'bold',
            color: designColors.textPrimary,
          }}>
            ${disabled ? '—' : price}
          </div>
        </div>

        {/* Points */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            POINTS
          </div>
          <div style={{
            fontFamily: fontMono,
            fontSize: '18px',
            fontWeight: 'bold',
            color: designColors.cyan,
          }}>
            {disabled ? '—' : `+${potentialPoints}`}
          </div>
        </div>

        {/* Risk */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            RISK
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: riskColor,
            textTransform: 'uppercase',
          }}>
            {disabled ? '—' : riskLevel}
          </div>
        </div>
      </div>

      {/* Add to portfolio button */}
      <motion.button
        onClick={onConfirm}
        disabled={disabled}
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: disabled ? designColors.bgCard : designColors.cyan,
          border: 'none',
          borderRadius: '10px',
          color: disabled ? designColors.textMuted : designColors.bgPrimary,
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: disabled ? 'not-allowed' : 'pointer',
          letterSpacing: '1px',
        }}
      >
        {disabled ? 'SELECT OUTCOME & MAGNITUDE' : 'ADD TO PORTFOLIO'}
      </motion.button>
    </motion.div>
  );
}
