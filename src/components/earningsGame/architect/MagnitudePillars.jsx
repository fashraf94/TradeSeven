import { motion } from 'framer-motion';
import {
  TrendingDown,
  ArrowDownRight,
  Minus,
  ArrowUpRight,
  Rocket
} from 'lucide-react';
import { designColors, bgTints, glowEffects, fontMono, MAGNITUDES } from '../designConstants';

const MAGNITUDE_ICONS = {
  downBig: {
    Icon: TrendingDown,
    color: designColors.red,
    bgColor: bgTints.red
  },
  down: {
    Icon: ArrowDownRight,
    color: designColors.orangeRed,
    bgColor: bgTints.orange
  },
  flat: {
    Icon: Minus,
    color: designColors.cyan,
    bgColor: bgTints.cyan
  },
  up: {
    Icon: ArrowUpRight,
    color: designColors.green,
    bgColor: bgTints.green
  },
  upBig: {
    Icon: Rocket,
    color: designColors.greenBright,
    bgColor: bgTints.green
  },
};

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
        gap: '8px',
      }}>
        {MAGNITUDES.map((mag, index) => {
          const parlay = getParlay(mag.id);
          const price = parlay?.price || 0;
          const multiplier = parlay?.multiplier || 0;
          const histProb = parlay?.reactionProb || 0;
          const isSelected = selected === mag.id;
          const isAffordable = price <= budgetRemaining && price > 0;
          const canSelect = !disabled && isAffordable && outcome;

          const iconConfig = MAGNITUDE_ICONS[mag.id];
          const IconComponent = iconConfig?.Icon || Minus;
          const iconColor = isSelected ? designColors.textPrimary : iconConfig?.color;
          const iconBgColor = isSelected
            ? 'rgba(0, 217, 255, 0.25)'
            : iconConfig?.bgColor;

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
              {/* Icon Container - MarketClash Standard Style */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: iconBgColor,
                border: `1px solid ${isSelected ? 'rgba(0, 217, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '4px',
                transition: 'all 0.2s ease',
              }}>
                <IconComponent
                  size={24}
                  color={iconColor}
                  strokeWidth={2.5}
                />
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
