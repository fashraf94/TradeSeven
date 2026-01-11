import { motion } from 'framer-motion';
import { designColors, fontMono } from '../designConstants';

export default function MagnitudeGauge({
  targetMin,        // Predicted range start (e.g., 2 for +2%)
  targetMax,        // Predicted range end (e.g., 5 for +5%)
  actualValue,      // Current stock move (null if pending)
  status,           // 'pending' | 'correct' | 'wrong_magnitude' | 'incorrect'
  rangeMin = -10,
  rangeMax = 10,
}) {
  // Calculate positions as percentages of the track
  const valueToPercent = (val) => {
    const clamped = Math.max(rangeMin, Math.min(rangeMax, val));
    return ((clamped - rangeMin) / (rangeMax - rangeMin)) * 100;
  };

  const targetStartPct = valueToPercent(targetMin);
  const targetEndPct = valueToPercent(targetMax);
  const targetWidthPct = targetEndPct - targetStartPct;
  const needlePct = actualValue !== null ? valueToPercent(actualValue) : 50;
  const hasValue = actualValue !== null;

  // Zone markers at standard thresholds
  const markers = [-5, -2, 0, 2, 5];

  // Status-based colors
  const statusColors = {
    pending: designColors.textMuted,
    correct: designColors.green,
    wrong_magnitude: designColors.orange,
    incorrect: designColors.red,
  };
  const activeColor = statusColors[status] || designColors.textMuted;

  return (
    <div style={{ width: '100%', padding: '4px 0' }}>
      {/* Gauge container */}
      <div style={{
        position: 'relative',
        height: '32px',
        marginBottom: '8px',
      }}>
        {/* Track background */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: '8px',
          marginTop: '-4px',
          backgroundColor: '#1c1c24',
          borderRadius: '4px',
        }} />

        {/* Zone markers */}
        {markers.map(val => {
          const pct = valueToPercent(val);
          return (
            <div
              key={val}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: '50%',
                width: '1px',
                height: '16px',
                marginTop: '-8px',
                backgroundColor: val === 0 ? '#444' : '#2a2a2a',
              }}
            />
          );
        })}

        {/* Target zone highlight */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'absolute',
            top: '50%',
            left: `${targetStartPct}%`,
            width: `${targetWidthPct}%`,
            height: '20px',
            marginTop: '-10px',
            backgroundColor: 'rgba(0, 217, 255, 0.15)',
            borderLeft: `2px solid ${designColors.cyan}`,
            borderRight: `2px solid ${designColors.cyan}`,
            borderRadius: '3px',
          }}
        />

        {/* Needle */}
        {hasValue && (
          <motion.div
            initial={{ left: '50%', opacity: 0 }}
            animate={{
              left: `${needlePct}%`,
              opacity: 1,
            }}
            transition={{
              left: { type: 'spring', stiffness: 80, damping: 15 },
              opacity: { duration: 0.3 },
            }}
            style={{
              position: 'absolute',
              top: '50%',
              marginLeft: '-8px',
              marginTop: '-8px',
              zIndex: 10,
            }}
          >
            {/* Needle dot */}
            <motion.div
              animate={status === 'pending' ? {
                x: [0, 2, -2, 1, -1, 0],
              } : {}}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: `2px solid ${activeColor}`,
                boxShadow: `0 0 10px ${activeColor}`,
              }}
            />
          </motion.div>
        )}

        {/* End labels */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          marginTop: '-6px',
          marginLeft: '-4px',
          fontSize: '10px',
          color: designColors.textMuted,
          fontFamily: fontMono,
        }}>
          ◀
        </div>
        <div style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          marginTop: '-6px',
          marginRight: '-4px',
          fontSize: '10px',
          color: designColors.textMuted,
          fontFamily: fontMono,
        }}>
          ▶
        </div>
      </div>

      {/* Value labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '10px',
        fontFamily: fontMono,
      }}>
        <span style={{ color: designColors.textMuted }}>-10%</span>

        {hasValue && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              color: activeColor,
              fontWeight: 'bold',
              fontSize: '12px',
            }}
          >
            {actualValue >= 0 ? '+' : ''}{actualValue.toFixed(1)}%
          </motion.span>
        )}

        <span style={{ color: designColors.textMuted }}>+10%</span>
      </div>
    </div>
  );
}
