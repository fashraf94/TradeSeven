import { motion } from 'framer-motion';
import { designColors, fontMono, BUDGET } from '../designConstants';

export default function PowerMeter({
  spent,
  predictions,    // To color segments by risk
}) {
  const remaining = BUDGET - spent;
  const segments = 10;
  const perSegment = BUDGET / segments;

  // Calculate how many segments are filled
  const filledSegments = Math.ceil(spent / perSegment);

  // Map predictions to segment colors
  const getSegmentColor = (index) => {
    let accumulated = 0;
    for (const pred of predictions) {
      accumulated += pred.price;
      const segmentEnd = (index + 1) * perSegment;
      if (accumulated >= index * perSegment && accumulated <= segmentEnd) {
        // This segment contains this prediction
        const riskLevel = pred.risk?.level || 'medium';
        switch (riskLevel) {
          case 'low': return designColors.green;
          case 'medium': return designColors.cyan;
          case 'high': return designColors.orange;
          case 'extreme': return designColors.red;
          default: return designColors.cyan;
        }
      }
    }
    return designColors.cyan; // Default
  };

  return (
    <div style={{
      padding: '16px',
      backgroundColor: designColors.bgCard,
      borderRadius: '12px',
      border: `1px solid ${designColors.borderDefault}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 'bold',
          color: designColors.textSecondary,
          letterSpacing: '0.5px',
        }}>
          Power Meter
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          fontFamily: fontMono,
          color: designColors.cyan,
        }}>
          ${remaining.toLocaleString()} LEFT
        </span>
      </div>

      {/* Segments */}
      <div style={{
        display: 'flex',
        gap: '3px',
        height: '24px',
      }}>
        {Array.from({ length: segments }).map((_, index) => {
          const isFilled = index < filledSegments;
          const segmentColor = isFilled ? getSegmentColor(index) : designColors.borderDefault;

          return (
            <motion.div
              key={index}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: index * 0.03 }}
              style={{
                flex: 1,
                backgroundColor: segmentColor,
                borderRadius: '2px',
                opacity: isFilled ? 1 : 0.3,
              }}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '10px',
        color: designColors.textMuted,
      }}>
        <span>$0</span>
        <span>${BUDGET.toLocaleString()}</span>
      </div>
    </div>
  );
}
