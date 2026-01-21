import { motion } from 'framer-motion';
import { Target, Crosshair } from 'lucide-react';
import { designColors, glowEffects, fontMono, MAGNITUDES } from '../designConstants';
import { cardTap } from '../animationPresets';

// Precision tier styling
const precisionStyles = {
  standard: { color: designColors.textMuted, label: 'Standard', Icon: null },
  narrow: { color: designColors.orange, label: 'Narrow', Icon: Target },
  bullseye: { color: designColors.cyan, label: 'Bullseye', Icon: Crosshair }
};

// Magnitude labels for explanation sentence
const MAGNITUDE_LABELS = {
  upBig: 'UP BIG (+5% or more)',
  up: 'UP (+2% to +5%)',
  flat: 'FLAT (±2%)',
  down: 'DOWN (-2% to -5%)',
  downBig: 'DOWN BIG (-5% or more)'
};

/**
 * Generate explanatory sentence about historical probability
 */
function getExplanationSentence(symbol, outcome, magnitude, probability, quarterCount) {
  if (!symbol || !outcome || !magnitude || probability === undefined) return null;

  const magnitudeLabel = MAGNITUDE_LABELS[magnitude] || magnitude;
  const probabilityPercent = Math.round(probability * 100);
  const outcomeText = outcome === 'beat' ? 'beating' : 'missing';
  const dataSource = quarterCount ? `${quarterCount} quarters` : 'sector averages';

  return `${symbol} moves ${magnitudeLabel} ${probabilityPercent}% of the time after ${outcomeText} earnings (based on ${dataSource})`;
}

export default function PredictionSummary({
  symbol,
  outcome,           // 'beat' | 'miss'
  magnitude,         // magnitude id
  price,             // number
  potentialPoints,   // number
  multiplier,        // number (e.g., 2.2)
  riskLevel,         // 'low' | 'medium' | 'high' | 'veryHigh' | 'extreme'
  budgetRemaining,   // Current budget
  budgetAfterPick,   // Budget after this pick
  onConfirm,         // () => void
  disabled = false,  // True if selection incomplete
  precisionTier = 'standard',
  precisionLabel,
  // New props for explanation sentence
  reactionProb,      // Historical probability (0-1)
  quarterCount,      // Number of quarters data is based on (null for sector)
}) {
  const magnitudeInfo = MAGNITUDES.find(m => m.id === magnitude);
  const outcomeLabel = outcome === 'beat' ? 'BEAT' : 'MISS';
  const outcomeColor = outcome === 'beat' ? designColors.green : designColors.red;

  const riskColors = {
    low: designColors.green,
    medium: designColors.orange,
    high: designColors.orangeRed,
    veryHigh: designColors.red,
    extreme: designColors.redDark,
  };

  const riskLabels = {
    low: 'Low',
    medium: 'Med',
    high: 'High',
    veryHigh: 'V.High',
    extreme: 'Extreme',
  };

  const riskColor = riskColors[riskLevel] || designColors.textMuted;
  const riskLabel = riskLabels[riskLevel] || riskLevel;

  const precisionStyle = precisionStyles[precisionTier] || precisionStyles.standard;
  const PrecisionIcon = precisionStyle.Icon;
  const showPrecisionBadge = precisionTier !== 'standard';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: disabled ? 0.5 : 1, y: 0 }}
      style={{
        backgroundColor: designColors.bgCardInner,
        border: `1px solid ${disabled ? designColors.borderDefault : designColors.cyan}`,
        borderRadius: '12px',
        padding: '16px',
        boxShadow: disabled ? 'none' : glowEffects.cyan,
      }}
    >
      {/* Budget Preview */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: designColors.bgCard,
        borderRadius: '8px',
        border: `1px solid ${designColors.borderDefault}`,
      }}>
        <div>
          <div style={{
            fontSize: '11px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '0.5px',
          }}>
            CURRENT BUDGET
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            fontFamily: fontMono,
            color: designColors.textPrimary,
          }}>
            ${budgetRemaining?.toLocaleString() || '—'}
          </div>
        </div>

        {price > 0 && (
          <>
            <div style={{
              fontSize: '20px',
              color: designColors.textMuted,
            }}>
              →
            </div>
            <div>
              <div style={{
                fontSize: '11px',
                color: designColors.textMuted,
                marginBottom: '4px',
                letterSpacing: '0.5px',
              }}>
                AFTER THIS PICK
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                fontFamily: fontMono,
                color: budgetAfterPick >= 0 ? designColors.cyan : designColors.red,
              }}>
                ${budgetAfterPick?.toLocaleString() || '—'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Prediction text */}
      <div style={{
        fontSize: '14px',
        color: designColors.textSecondary,
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        {disabled ? (
          <span>Complete your prediction...</span>
        ) : (
          <>
            <span style={{ color: designColors.textPrimary, fontWeight: 'bold' }}>
              {symbol}
            </span>
            {' will '}
            <span style={{ color: outcomeColor, fontWeight: 'bold' }}>
              {outcomeLabel}
            </span>
            {' and move '}
            <span style={{ color: designColors.cyan, fontWeight: 'bold' }}>
              {magnitudeInfo?.label || '...'}
            </span>
            {' '}
            <span style={{ fontSize: '18px' }}>
              {magnitudeInfo?.emoji}
            </span>
          </>
        )}
      </div>

      {/* Explanatory sentence about historical probability */}
      {!disabled && reactionProb !== undefined && (
        <p style={{
          color: '#9ca3af',
          fontSize: '12px',
          fontStyle: 'italic',
          textAlign: 'center',
          marginTop: '0px',
          marginBottom: '12px',
          lineHeight: '1.4',
          padding: '0 8px',
        }}>
          {getExplanationSentence(symbol, outcome, magnitude, reactionProb, quarterCount)}
        </p>
      )}

      {/* Precision tier badge (if not standard) */}
      {showPrecisionBadge && !disabled && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: '12px',
          padding: '8px 12px',
          backgroundColor: `${precisionStyle.color}15`,
          borderRadius: '6px',
          border: `1px solid ${precisionStyle.color}40`,
        }}>
          {PrecisionIcon && (
            <PrecisionIcon size={14} color={precisionStyle.color} />
          )}
          <span style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: precisionStyle.color,
            letterSpacing: '0.5px',
          }}>
            {precisionLabel || precisionStyle.label} PRECISION
          </span>
          <span style={{
            fontSize: '10px',
            color: designColors.textMuted,
          }}>
            — Higher risk, higher reward
          </span>
        </div>
      )}

      {/* Stats row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: designColors.bgCard,
        borderRadius: '8px',
      }}>
        {/* Cost */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            COST
          </div>
          <div style={{
            fontFamily: fontMono,
            fontSize: '18px',
            fontWeight: 'bold',
            color: designColors.textPrimary,
          }}>
            ${disabled ? '—' : price.toLocaleString()}
          </div>
        </div>

        {/* Points */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            POINTS
          </div>
          <div style={{
            fontFamily: fontMono,
            fontSize: '18px',
            fontWeight: 'bold',
            color: designColors.cyan,
          }}>
            {disabled ? '—' : `+${potentialPoints.toLocaleString()}`}
          </div>
        </div>

        {/* Multiplier */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            MULT
          </div>
          <div style={{
            fontFamily: fontMono,
            fontSize: '18px',
            fontWeight: 'bold',
            color: showPrecisionBadge ? precisionStyle.color : designColors.orange,
          }}>
            {disabled ? '—' : `${multiplier.toFixed(1)}x`}
          </div>
        </div>

        {/* Risk */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '10px',
            color: designColors.textMuted,
            marginBottom: '4px',
            letterSpacing: '1px',
          }}>
            RISK
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: riskColor,
            textTransform: 'uppercase',
          }}>
            {disabled ? '—' : riskLabel}
          </div>
        </div>
      </div>

      {/* Add to portfolio button */}
      <motion.button
        onClick={onConfirm}
        disabled={disabled}
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : cardTap}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: disabled ? designColors.bgCard : designColors.cyan,
          border: 'none',
          borderRadius: '10px',
          color: disabled ? designColors.textMuted : designColors.bgPrimary,
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: disabled ? 'not-allowed' : 'pointer',
          letterSpacing: '1px',
        }}
      >
        {disabled ? 'SELECT OUTCOME & MAGNITUDE' : 'ADD TO PORTFOLIO'}
      </motion.button>
    </motion.div>
  );
}
