import { motion } from 'framer-motion';
import { BRACKETS, glowEffects } from '../designConstants';

export default function BracketBadge({
  bracket,
  size = 'medium',
  showGlow = false,
  showLabel = true,
}) {
  const config = BRACKETS[bracket] || BRACKETS.bronze;

  const sizes = {
    small: { emoji: '16px', label: '10px', padding: '4px 8px' },
    medium: { emoji: '24px', label: '12px', padding: '6px 12px' },
    large: { emoji: '48px', label: '18px', padding: '12px 24px' },
  };

  const s = sizes[size] || sizes.medium;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display: 'inline-flex',
        flexDirection: size === 'large' ? 'column' : 'row',
        alignItems: 'center',
        gap: size === 'large' ? '8px' : '6px',
        padding: s.padding,
        borderRadius: '8px',
        backgroundColor: showGlow ? 'rgba(0, 217, 255, 0.05)' : 'transparent',
        boxShadow: showGlow ? glowEffects.cyan : 'none',
      }}
    >
      <span style={{ fontSize: s.emoji }}>{config.emoji}</span>
      {showLabel && (
        <span style={{
          fontSize: s.label,
          fontWeight: 'bold',
          color: config.color,
          letterSpacing: '1px',
        }}>
          {config.label}
        </span>
      )}
    </motion.div>
  );
}
