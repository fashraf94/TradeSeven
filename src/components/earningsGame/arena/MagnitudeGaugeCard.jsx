import { motion } from 'framer-motion';
import { designColors, fontMono, MAGNITUDES } from '../designConstants';
import MagnitudeGauge from './MagnitudeGauge';

export default function MagnitudeGaugeCard({
  prediction,
  actualMove = null,
  outcomeCorrect = null,
  index = 0,
}) {
  const mag = MAGNITUDES.find(m => m.id === prediction.magnitude);

  // Determine status
  let status = 'pending';
  if (outcomeCorrect !== null) {
    if (!outcomeCorrect) {
      status = 'incorrect';
    } else if (actualMove !== null) {
      const inRange = actualMove >= mag.min && actualMove < mag.max;
      status = inRange ? 'correct' : 'wrong_magnitude';
    }
  }

  // Calculate points display
  let pointsDisplay = `(${prediction.potentialPoints?.toLocaleString()})`;
  if (status === 'correct') {
    pointsDisplay = `+${prediction.potentialPoints?.toLocaleString()}`;
  } else if (status === 'incorrect' || status === 'wrong_magnitude') {
    pointsDisplay = '0';
  }

  const isClutch = status === 'pending' && prediction.potentialPoints > 3000;

  const statusConfig = {
    pending: { label: 'PENDING', color: designColors.textMuted },
    correct: { label: 'CORRECT', color: designColors.green },
    wrong_magnitude: { label: 'WRONG MAGNITUDE', color: designColors.orange },
    incorrect: { label: 'INCORRECT', color: designColors.red },
  };
  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      style={{
        padding: '14px',
        backgroundColor: designColors.bgCard,
        borderRadius: '12px',
        border: `1px solid ${
          status === 'correct' ? designColors.green :
          status === 'incorrect' ? designColors.red :
          status === 'wrong_magnitude' ? designColors.orange :
          designColors.borderDefault
        }`,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: designColors.textPrimary,
        }}>
          {prediction.symbol}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isClutch && (
            <span style={{
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 8px',
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${designColors.purple}, ${designColors.orange})`,
              color: designColors.textPrimary,
            }}>
              CLUTCH
            </span>
          )}

          {outcomeCorrect !== null && (
            <span style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: outcomeCorrect ? designColors.green : designColors.red,
            }}>
              {prediction.outcome?.toUpperCase()} {outcomeCorrect ? '✓' : '✗'}
            </span>
          )}
        </div>
      </div>

      {/* Your pick */}
      <div style={{
        fontSize: '12px',
        color: designColors.textSecondary,
        marginBottom: '12px',
      }}>
        Your pick: <span style={{ color: designColors.textPrimary }}>
          {mag?.label} ({mag?.range})
        </span>
      </div>

      {/* Gauge */}
      <MagnitudeGauge
        targetMin={mag?.min === -Infinity ? -10 : mag?.min}
        targetMax={mag?.max === Infinity ? 10 : mag?.max}
        actualValue={actualMove}
        status={status}
      />

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: `1px solid ${designColors.borderDefault}`,
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: config.color,
        }}>
          {config.label}
        </span>

        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: fontMono,
          color: status === 'correct' ? designColors.green :
            status === 'pending' ? designColors.cyan : designColors.textMuted,
        }}>
          {pointsDisplay}
        </span>
      </div>
    </motion.div>
  );
}
