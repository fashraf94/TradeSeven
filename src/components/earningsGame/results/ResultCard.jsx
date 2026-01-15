import { motion } from 'framer-motion';
import { designColors, fontMono, MAGNITUDES } from '../designConstants';

/**
 * Get magnitude config from id
 */
function getMagnitude(id) {
  return MAGNITUDES.find(m => m.id === id) || { label: id, emoji: '' };
}

export default function ResultCard({
  prediction,
  isCorrect,
  pointsEarned,
  actualMove = null,
  actualOutcome = null,
  actualMagnitude = null,
  index = 0,
  expanded = false,
}) {
  const predictedMag = getMagnitude(prediction.magnitude);
  const actualMag = getMagnitude(actualMagnitude || prediction.actualMagnitude);

  // Use prediction properties if not passed directly
  const wasCorrect = isCorrect !== undefined ? isCorrect : prediction.isCorrect;
  const earnedPoints = pointsEarned !== undefined ? pointsEarned : prediction.pointsEarned;
  const move = actualMove || prediction.actualMove;
  const outcome = actualOutcome || prediction.actualOutcome;

  // Check individual correctness
  const outcomeCorrect = prediction.outcomeCorrect !== undefined
    ? prediction.outcomeCorrect
    : (prediction.outcome === outcome);
  const magnitudeCorrect = prediction.magnitudeCorrect !== undefined
    ? prediction.magnitudeCorrect
    : (prediction.magnitude === (actualMagnitude || prediction.actualMagnitude));

  const isPending = !prediction.resolved && !wasCorrect && !outcome;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        backgroundColor: designColors.bgCard,
        borderRadius: '10px',
        border: isPending
          ? `1px solid ${designColors.borderDefault}`
          : wasCorrect
            ? `1px solid ${designColors.green}`
            : `1px solid ${designColors.red}40`,
        overflow: 'hidden',
      }}
    >
      {/* Main Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        gap: '12px',
      }}>
        {/* Status icon */}
        <span style={{
          fontSize: '18px',
          width: '24px',
          textAlign: 'center',
        }}>
          {isPending ? (
            <span style={{ color: designColors.orange }}>
              <span role="img" aria-label="pending">⏳</span>
            </span>
          ) : wasCorrect ? (
            <span style={{ color: designColors.green }}>
              <span role="img" aria-label="correct">✓</span>
            </span>
          ) : (
            <span style={{ color: designColors.red }}>
              <span role="img" aria-label="wrong">✗</span>
            </span>
          )}
        </span>

        {/* Symbol */}
        <span style={{
          fontSize: '15px',
          fontWeight: 'bold',
          color: designColors.textPrimary,
          minWidth: '55px',
        }}>
          {prediction.symbol}
        </span>

        {/* Prediction summary */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '13px',
            color: designColors.textSecondary,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: prediction.outcome === 'beat'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
              color: prediction.outcome === 'beat' ? designColors.green : designColors.red,
            }}>
              {prediction.outcome?.toUpperCase()}
            </span>
            <span>+</span>
            <span style={{ color: designColors.textPrimary }}>
              {predictedMag.emoji} {predictedMag.label}
            </span>
          </div>
        </div>

        {/* Points */}
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          fontFamily: fontMono,
          color: isPending
            ? designColors.orange
            : wasCorrect
              ? designColors.green
              : designColors.textMuted,
          textAlign: 'right',
          minWidth: '80px',
        }}>
          {isPending ? (
            <span style={{ fontSize: '12px' }}>Pending</span>
          ) : wasCorrect ? (
            `+${(earnedPoints || 0).toLocaleString()}`
          ) : (
            '0'
          )}
          <span style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginLeft: '3px',
          }}>
            pts
          </span>
        </span>
      </div>

      {/* Actual Result Row (if resolved) */}
      {!isPending && outcome && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          paddingLeft: '52px', // Align with symbol above
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderTop: `1px solid ${designColors.borderDefault}`,
          gap: '10px',
          fontSize: '12px',
        }}>
          <span style={{ color: designColors.textMuted }}>Actual:</span>

          {/* Outcome indicator */}
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '600',
            backgroundColor: outcome === 'beat'
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            color: outcome === 'beat' ? designColors.green : designColors.red,
            border: outcomeCorrect
              ? `1px solid ${designColors.green}40`
              : `1px solid ${designColors.red}40`,
          }}>
            {outcome?.toUpperCase()}
            {outcomeCorrect && ' ✓'}
          </span>

          <span>+</span>

          {/* Magnitude indicator */}
          <span style={{
            color: magnitudeCorrect ? designColors.green : designColors.textSecondary,
          }}>
            {actualMag.emoji} {actualMag.label}
            {magnitudeCorrect && ' ✓'}
          </span>

          {/* Price move */}
          {move !== null && move !== undefined && (
            <span style={{
              marginLeft: 'auto',
              color: move >= 0 ? designColors.green : designColors.red,
              fontFamily: fontMono,
              fontWeight: '600',
            }}>
              {move >= 0 ? '+' : ''}{move.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
