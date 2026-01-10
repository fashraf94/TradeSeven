import { motion } from 'framer-motion';
import { designColors, glowEffects, fontMono, MAGNITUDES } from '../designConstants';

export default function MagnitudePillars({
  selected,          // magnitude id or null
  magnitudePrices,   // { downBig: 200, down: 180, flat: 150, up: 180, upBig: 200 }
  onSelect,          // (magnitudeId: string) => void
  disabled = false,  // Disabled until outcome is selected
}) {
  // Pillar heights for visual effect (percentages)
  const pillarHeights = [85, 65, 45, 65, 85];

  return (
    <div style={{
      opacity: disabled ? 0.4 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      transition: 'opacity 0.2s',
    }}>
      {/* Section header */}
      <div style={{
        fontSize: '12px',
        color: designColors.textSecondary,
        marginBottom: '16px',
        letterSpacing: '1px',
      }}>
        MAGNITUDE
      </div>

      {/* Pillars container */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '8px',
        height: '160px',
        padding: '0 8px',
      }}>
        {MAGNITUDES.map((mag, index) => {
          const isSelected = selected === mag.id;
          const price = magnitudePrices?.[mag.id] || 0;

          return (
            <motion.button
              key={mag.id}
              onClick={() => onSelect(mag.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                borderColor: isSelected ? designColors.cyan : designColors.borderDefault,
                boxShadow: isSelected ? glowEffects.cyan : 'none',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{
                flex: 1,
                height: `${pillarHeights[index]}%`,
                backgroundColor: isSelected ? 'rgba(0, 217, 255, 0.15)' : designColors.bgCardInner,
                border: `2px solid ${isSelected ? designColors.cyan : designColors.borderDefault}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 4px',
                minWidth: '50px',
              }}
            >
              {/* Emoji */}
              <span style={{ fontSize: '20px' }}>
                {mag.emoji}
              </span>

              {/* Label */}
              <span style={{
                fontSize: '9px',
                fontWeight: 'bold',
                color: isSelected ? designColors.cyan : designColors.textSecondary,
                letterSpacing: '0.5px',
                textAlign: 'center',
                lineHeight: '1.2',
              }}>
                {mag.label}
              </span>

              {/* Price */}
              <span style={{
                fontFamily: fontMono,
                fontSize: '11px',
                fontWeight: 'bold',
                color: isSelected ? designColors.cyan : designColors.textMuted,
              }}>
                ${price}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Range labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        padding: '0 8px',
      }}>
        {MAGNITUDES.map((mag) => (
          <span
            key={mag.id}
            style={{
              flex: 1,
              fontSize: '8px',
              color: designColors.textMuted,
              textAlign: 'center',
            }}
          >
            {mag.range}
          </span>
        ))}
      </div>
    </div>
  );
}
