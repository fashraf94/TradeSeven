import { motion } from 'framer-motion';
import { designColors, glowEffects, fontMono, MAGNITUDES } from '../designConstants';

export default function MagnitudePillars({
  selected,          // magnitude id or null
  parlayPrices,      // Array from calculateParlayPrices service
  outcome,           // 'beat' | 'miss' - current selected outcome
  budgetRemaining,   // Current budget for affordability check
  onSelect,          // (magnitudeId: string) => void
  disabled = false,  // Disabled until outcome is selected
}) {
  // Get parlay for a specific magnitude
  const getParlay = (magnitudeId) => {
    if (!parlayPrices || !outcome) return null;
    return parlayPrices.find(p =>
      p.magnitude === magnitudeId && p.outcome === outcome
    );
  };

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
        justifyContent: 'center',
        gap: '10px',
        padding: '0 4px',
      }}>
        {MAGNITUDES.map((mag, index) => {
          const parlay = getParlay(mag.id);
          const price = parlay?.price || 0;
          const multiplier = parlay?.multiplier || 0;
          const histProb = parlay?.reactionProb || 0;
          const isSelected = selected === mag.id;
          const isAffordable = price <= budgetRemaining && price > 0;
          const canSelect = !disabled && isAffordable && outcome;

          return (
            <motion.button
              key={mag.id}
              onClick={() => canSelect && onSelect(mag.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: canSelect ? (isSelected ? 1 : 0.85) : 0.4,
                y: 0,
                scale: isSelected ? 1.02 : 1,
              }}
              transition={{
                delay: index * 0.05,
                type: 'spring',
                stiffness: 300,
                damping: 20,
              }}
              whileTap={canSelect ? { scale: 0.95 } : {}}
              disabled={!canSelect}
              style={{
                flex: 1,
                minWidth: '64px',
                maxWidth: '100px',
                padding: '14px 6px',
                backgroundColor: isSelected
                  ? 'rgba(0, 217, 255, 0.1)'
                  : designColors.bgCard,
                border: `2px solid ${isSelected ? designColors.cyan : designColors.borderSubtle}`,
                borderRadius: '12px',
                cursor: canSelect ? 'pointer' : 'not-allowed',
                boxShadow: isSelected ? glowEffects.cyan : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                minHeight: '200px',
                filter: canSelect ? 'none' : 'grayscale(80%)',
              }}
            >
              {/* Emoji Container - Polished styling */}
              <div style={{
                width: '52px',
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(0, 217, 255, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                borderRadius: '14px',
                border: `1px solid ${isSelected ? 'rgba(0, 217, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                boxShadow: isSelected
                  ? '0 4px 12px rgba(0, 217, 255, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
                  : 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
                marginBottom: '4px',
              }}>
                <span style={{
                  fontSize: '26px',
                  filter: canSelect ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' : 'grayscale(100%)',
                }}>
                  {mag.emoji}
                </span>
              </div>

              {/* Label */}
              <div style={{
                fontSize: '10px',
                fontWeight: 'bold',
                color: isSelected ? designColors.textPrimary : designColors.textSecondary,
                textAlign: 'center',
                lineHeight: 1.2,
                letterSpacing: '0.5px',
              }}>
                {mag.label}
              </div>

              {/* Range */}
              <span style={{
                fontSize: '9px',
                color: designColors.textMuted,
              }}>
                {mag.range}
              </span>

              {/* Divider */}
              <div style={{
                width: '70%',
                height: '1px',
                backgroundColor: designColors.borderDefault,
                margin: '4px 0',
              }} />

              {/* Price */}
              <span style={{
                fontSize: '15px',
                fontWeight: 'bold',
                fontFamily: fontMono,
                color: isSelected ? designColors.cyan : designColors.textPrimary,
              }}>
                ${price > 0 ? price.toLocaleString() : '—'}
              </span>

              {/* Multiplier */}
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                color: isSelected ? designColors.cyan : designColors.textSecondary,
              }}>
                {multiplier > 0 ? `${multiplier}x` : '—'}
              </span>

              {/* Historical Probability - ALWAYS INSIDE at bottom */}
              <span style={{
                fontSize: '9px',
                color: designColors.textMuted,
                marginTop: 'auto',
                paddingTop: '4px',
              }}>
                Hist: {Math.round(histProb * 100)}%
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
