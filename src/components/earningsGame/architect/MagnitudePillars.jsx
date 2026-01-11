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
  // Pillar heights for visual effect (percentages)
  const pillarHeights = [85, 65, 45, 65, 85];

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
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '8px',
        height: '200px',
        padding: '0 4px',
      }}>
        {MAGNITUDES.map((mag, index) => {
          const isSelected = selected === mag.id;
          const parlay = getParlay(mag.id);
          const price = parlay?.price || 0;
          const multiplier = parlay?.multiplier || 0;
          const histProb = parlay?.reactionProb || 0;
          const canAfford = price <= budgetRemaining;

          return (
            <motion.button
              key={mag.id}
              onClick={() => canAfford && onSelect(mag.id)}
              whileHover={canAfford ? { scale: 1.03 } : {}}
              whileTap={canAfford ? { scale: 0.97 } : {}}
              animate={{
                borderColor: isSelected ? designColors.cyan : designColors.borderDefault,
                boxShadow: isSelected ? glowEffects.cyan : 'none',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{
                flex: 1,
                height: `${pillarHeights[index]}%`,
                backgroundColor: isSelected
                  ? 'rgba(0, 217, 255, 0.15)'
                  : !canAfford
                    ? 'rgba(50, 50, 60, 0.5)'
                    : designColors.bgCardInner,
                border: `2px solid ${isSelected ? designColors.cyan : designColors.borderDefault}`,
                borderRadius: '10px',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 4px',
                minWidth: '56px',
                opacity: canAfford ? 1 : 0.5,
              }}
            >
              {/* Emoji - LARGER */}
              <div style={{
                fontSize: '28px',
                filter: canAfford ? 'none' : 'grayscale(80%)',
                opacity: isSelected ? 1 : 0.85,
              }}>
                {mag.emoji}
              </div>

              {/* Label */}
              <div style={{
                fontSize: '10px',
                fontWeight: 'bold',
                color: isSelected ? designColors.textPrimary : designColors.textSecondary,
                textAlign: 'center',
                lineHeight: 1.3,
                minHeight: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {mag.label}
              </div>

              {/* Range */}
              <span style={{
                fontSize: '9px',
                color: designColors.textMuted,
                marginTop: '2px',
              }}>
                {mag.range}
              </span>

              {/* Divider */}
              <div style={{
                width: '80%',
                height: '1px',
                backgroundColor: designColors.borderDefault,
                margin: '6px 0',
              }} />

              {/* Price - PROMINENT */}
              <span style={{
                fontFamily: fontMono,
                fontSize: '14px',
                fontWeight: 'bold',
                color: isSelected ? designColors.cyan : designColors.textPrimary,
              }}>
                ${price > 0 ? price.toLocaleString() : '—'}
              </span>

              {/* Multiplier */}
              {price > 0 && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: isSelected ? designColors.cyan : designColors.textMuted,
                  marginTop: '2px',
                }}>
                  {multiplier}x
                </span>
              )}

              {/* Historical probability */}
              <span style={{
                fontSize: '9px',
                color: designColors.textMuted,
                marginTop: '4px',
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
