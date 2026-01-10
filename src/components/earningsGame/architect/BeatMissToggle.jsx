import { motion } from 'framer-motion';
import { designColors, glowEffects, fontMono } from '../designConstants';

export default function BeatMissToggle({
  selected,        // 'beat' | 'miss' | null
  beatOdds,        // 0-1
  missOdds,        // 0-1
  onSelect,        // (choice: 'beat' | 'miss') => void
}) {
  const options = [
    {
      id: 'beat',
      label: 'BEAT',
      odds: beatOdds,
      selectedColor: designColors.green,
      selectedGlow: glowEffects.green,
    },
    {
      id: 'miss',
      label: 'MISS',
      odds: missOdds,
      selectedColor: designColors.red,
      selectedGlow: glowEffects.red,
    },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
    }}>
      {options.map((option) => {
        const isSelected = selected === option.id;

        return (
          <motion.button
            key={option.id}
            onClick={() => onSelect(option.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              borderColor: isSelected ? option.selectedColor : designColors.borderDefault,
              boxShadow: isSelected ? option.selectedGlow : 'none',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              flex: 1,
              padding: '20px 16px',
              backgroundColor: isSelected ? `${option.selectedColor}15` : designColors.bgCardInner,
              border: `2px solid ${isSelected ? option.selectedColor : designColors.borderDefault}`,
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Label */}
            <span style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: isSelected ? option.selectedColor : designColors.textSecondary,
              letterSpacing: '1px',
            }}>
              {option.label}
            </span>

            {/* Odds display */}
            <span style={{
              fontFamily: fontMono,
              fontSize: '24px',
              fontWeight: 'bold',
              color: isSelected ? option.selectedColor : designColors.textPrimary,
            }}>
              {Math.round(option.odds * 100)}%
            </span>

            {/* Selection indicator */}
            <motion.div
              animate={{
                scale: isSelected ? 1 : 0,
                opacity: isSelected ? 1 : 0,
              }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: option.selectedColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: designColors.bgPrimary, fontSize: '12px', fontWeight: 'bold' }}>
                ✓
              </span>
            </motion.div>
          </motion.button>
        );
      })}
    </div>
  );
}
