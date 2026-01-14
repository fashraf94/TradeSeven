import { motion } from 'framer-motion';
import { CircleDot, Target, Crosshair } from 'lucide-react';
import { designColors, fontMono, glowEffects } from '../designConstants';

// Tier styling configuration
const tierConfig = {
  standard: {
    bg: 'rgba(139, 148, 158, 0.1)',
    bgHover: 'rgba(139, 148, 158, 0.15)',
    accent: '#8b949e',
    badge: null,
    Icon: CircleDot,
    description: 'Full range'
  },
  narrow: {
    bg: 'rgba(245, 158, 11, 0.12)',
    bgHover: 'rgba(245, 158, 11, 0.18)',
    accent: '#f59e0b',
    badge: 'RISKY',
    Icon: Target,
    description: '2% window'
  },
  bullseye: {
    bg: 'rgba(0, 217, 255, 0.12)',
    bgHover: 'rgba(0, 217, 255, 0.18)',
    accent: '#00d9ff',
    badge: 'LOTTERY',
    Icon: Crosshair,
    description: '1% window'
  }
};

export default function PrecisionTierSelector({
  magnitude,           // Selected magnitude band id
  baseMultiplier,      // Base multiplier from parlay
  precisionOptions,    // Array from selectedParlay.precisionOptions
  selected,            // Currently selected tier id
  onSelect,            // (tierId) => void
  price,               // Price of the parlay (for calculating payout)
  disabled = false,
}) {
  if (!precisionOptions || precisionOptions.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {precisionOptions.map((option) => {
        const config = tierConfig[option.tierId];
        const isSelected = selected === option.tierId;
        const Icon = config.Icon;
        const potentialPayout = price ? Math.round(price * option.finalMultiplier) : 0;

        return (
          <motion.button
            key={option.tierId}
            onClick={() => !disabled && onSelect(option.tierId)}
            whileHover={disabled ? {} : { y: -2 }}
            whileTap={disabled ? {} : { scale: 0.98 }}
            style={{
              width: '100%',
              padding: '14px 16px',
              backgroundColor: isSelected ? config.bgHover : config.bg,
              border: isSelected
                ? `2px solid ${config.accent}`
                : `1px solid ${designColors.borderDefault}`,
              borderRadius: '12px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.2s ease',
              boxShadow: isSelected && option.tierId === 'bullseye'
                ? '0 0 20px rgba(0, 217, 255, 0.3)'
                : isSelected
                  ? `0 0 15px ${config.accent}30`
                  : 'none',
              opacity: disabled ? 0.5 : 1,
              position: 'relative',
            }}
          >
            {/* Icon container */}
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: isSelected
                ? `${config.accent}30`
                : `${config.accent}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: isSelected && option.tierId === 'bullseye'
                ? `0 0 12px ${config.accent}50`
                : 'none',
            }}>
              <Icon
                size={22}
                color={config.accent}
                strokeWidth={isSelected ? 2.5 : 2}
              />
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '4px',
            }}>
              {/* Top row: Name + Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: isSelected ? config.accent : designColors.textPrimary,
                  letterSpacing: '0.5px',
                }}>
                  {option.tierLabel}
                </span>
                {config.badge && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 'bold',
                    color: config.accent,
                    backgroundColor: `${config.accent}20`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.5px',
                  }}>
                    {config.badge}
                  </span>
                )}
              </div>

              {/* Bottom row: Range */}
              <span style={{
                fontSize: '12px',
                color: designColors.textSecondary,
                fontFamily: fontMono,
              }}>
                {option.range?.label || config.description}
              </span>
            </div>

            {/* Multiplier and Payout */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '2px',
            }}>
              <span style={{
                fontSize: '18px',
                fontWeight: 'bold',
                fontFamily: fontMono,
                color: isSelected ? config.accent : designColors.orange,
              }}>
                {option.finalMultiplier.toFixed(1)}x
              </span>
              <span style={{
                fontSize: '11px',
                color: designColors.textMuted,
                fontFamily: fontMono,
              }}>
                {potentialPayout > 0 && `$${potentialPayout.toLocaleString()}`}
              </span>
            </div>

            {/* Capped indicator */}
            {option.isCapped && (
              <div style={{
                position: 'absolute',
                top: '-6px',
                right: '10px',
                fontSize: '9px',
                fontWeight: 'bold',
                color: designColors.gold,
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}>
                MAX 20x
              </div>
            )}
          </motion.button>
        );
      })}

      {/* Info text */}
      <div style={{
        fontSize: '11px',
        color: designColors.textMuted,
        textAlign: 'center',
        marginTop: '4px',
        padding: '0 8px',
      }}>
        {selected === 'standard' && 'Standard range for reliable odds'}
        {selected === 'narrow' && 'Tighter window = higher risk, higher reward'}
        {selected === 'bullseye' && 'Precision play - nail the exact range for max payout!'}
      </div>
    </div>
  );
}
