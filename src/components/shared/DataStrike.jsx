import { useRef, useEffect } from 'react';
import { motion, useReducedMotion, useAnimationControls } from 'framer-motion';
import { DATA_STRIKE, STRIKE_COLORS } from '../../constants/animationTokens';

/**
 * DataStrike — universal score-change animation component.
 * Renders a numeric value with a scale + color flash on change.
 * GPU-composited: only animates transform (scale) and color.
 */
export default function DataStrike({
  value,
  size = 24,
  color = '#ffffff',
  gainColor = STRIKE_COLORS.gain,
  lossColor = STRIKE_COLORS.loss,
  prefix = '',
  suffix = '',
  fontWeight = 700,
  showSign = false,
  style = {},
}) {
  const prevValue = useRef(value);
  const shouldReduceMotion = useReducedMotion();
  const controls = useAnimationControls();

  useEffect(() => {
    if (prevValue.current !== value) {
      const isGain = value > prevValue.current;
      const flashColor = isGain ? gainColor : lossColor;

      if (shouldReduceMotion) {
        // Reduced motion: quick color flash only, no scale
        controls.start({
          color: [flashColor, color],
          transition: { duration: 0.3, times: [0, 1] },
        });
      } else {
        controls.start({
          scale: DATA_STRIKE.scale,
          color: [color, flashColor, color],
          transition: {
            duration: DATA_STRIKE.duration,
            times: DATA_STRIKE.times,
            ease: DATA_STRIKE.ease,
          },
        });
      }

      prevValue.current = value;
    }
  }, [value, color, gainColor, lossColor, shouldReduceMotion, controls]);

  const sign = showSign && value > 0 ? '+' : showSign && value < 0 ? '' : '';
  const displayValue = `${prefix}${sign}${value}${suffix}`;

  return (
    <motion.span
      animate={controls}
      style={{
        fontSize: size,
        fontWeight,
        color,
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-block',
        willChange: 'transform',
        ...style,
      }}
    >
      {displayValue}
    </motion.span>
  );
}
