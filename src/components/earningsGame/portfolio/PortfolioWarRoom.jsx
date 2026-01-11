import { motion, AnimatePresence } from 'framer-motion';
import { designColors, fontMono, MIN_PREDICTIONS, MAX_PREDICTIONS, glowEffects } from '../designConstants';
import { screenContainer, sectionHeader, fixedBottomContainer, buttonPrimary, buttonDisabled, flexBetween } from '../styleUtils';
import { EarningsHeader } from '../shared';
import PowerMeter from './PowerMeter';
import RiskProfile from './RiskProfile';
import PredictionCard from './PredictionCard';

export default function PortfolioWarRoom({
  predictions,
  totalSpent,
  budgetRemaining,
  totalPotentialPoints,
  isLocked,
  isValid,
  validationMessage,
  onBack,
  onRemove,
  onLock,
  isDesktop = false,
}) {
  const canLock = isValid && predictions.length >= MIN_PREDICTIONS;

  // Desktop layout - Enhanced 2-column grid
  if (isDesktop) {
    return (
      <div style={screenContainer}>
        {/* Header with inline lock button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: `1px solid ${designColors.borderDefault}`,
          backgroundColor: designColors.bgCard,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <motion.button
              onClick={onBack}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'none',
                border: 'none',
                color: designColors.textSecondary,
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ←
            </motion.button>
            <span style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: designColors.textPrimary,
            }}>
              PORTFOLIO
            </span>
          </div>

          {!isLocked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {!canLock && predictions.length > 0 && (
                <span style={{
                  fontSize: '13px',
                  color: designColors.orange,
                }}>
                  {predictions.length < MIN_PREDICTIONS
                    ? `Add ${MIN_PREDICTIONS - predictions.length} more to lock`
                    : validationMessage
                  }
                </span>
              )}
              <motion.button
                onClick={onLock}
                disabled={!canLock}
                whileHover={canLock ? { scale: 1.02 } : {}}
                whileTap={canLock ? { scale: 0.98 } : {}}
                style={{
                  padding: '10px 24px',
                  backgroundColor: canLock ? designColors.cyan : designColors.bgCardInner,
                  border: canLock ? 'none' : `1px solid ${designColors.borderDefault}`,
                  borderRadius: '8px',
                  color: canLock ? designColors.bgPrimary : designColors.textMuted,
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: canLock ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: canLock ? glowEffects.cyan : 'none',
                }}
              >
                LOCK PORTFOLIO
              </motion.button>
            </div>
          ) : (
            <div style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '6px',
              border: `1px solid ${designColors.green}`,
            }}>
              <span style={{
                color: designColors.green,
                fontWeight: 'bold',
                fontSize: '13px',
              }}>
                Portfolio Locked
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Metrics row - side by side */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
          }}>
            <PowerMeter spent={totalSpent} predictions={predictions} />
            <RiskProfile predictions={predictions} />
          </div>

          {/* Predictions header with total */}
          <div style={{
            ...flexBetween,
            marginBottom: '16px',
          }}>
            <span style={{
              ...sectionHeader,
              marginBottom: 0,
            }}>
              YOUR PREDICTIONS ({predictions.length}/{MAX_PREDICTIONS})
            </span>
            <span style={{
              fontSize: '14px',
              color: designColors.textSecondary,
            }}>
              Total: <span style={{
                color: designColors.cyan,
                fontFamily: fontMono,
                fontWeight: 'bold',
              }}>
                {totalPotentialPoints?.toLocaleString()}
              </span> potential pts
            </span>
          </div>

          {/* 2-column prediction grid */}
          {predictions.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: designColors.textMuted,
              backgroundColor: designColors.bgCard,
              borderRadius: '12px',
              border: `1px solid ${designColors.borderDefault}`,
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>No predictions yet</div>
              <div style={{ fontSize: '13px' }}>
                Add at least {MIN_PREDICTIONS} predictions to lock your portfolio
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
            }}>
              <AnimatePresence>
                {predictions.map((prediction, index) => (
                  <PredictionCard
                    key={prediction.eventId}
                    prediction={prediction}
                    onRemove={onRemove}
                    isLocked={isLocked}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mobile layout
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        backgroundColor: designColors.bgPrimary,
        minHeight: '100vh',
        paddingBottom: isLocked ? '20px' : '100px', // Space for lock button
      }}
    >
      <EarningsHeader
        title="PORTFOLIO"
        onBack={onBack}
      />

      <div style={{
        padding: '16px',
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        gap: '12px',
      }}>
        {/* Power Meter */}
        <div style={{ flex: isDesktop ? 1 : 'auto' }}>
          <PowerMeter spent={totalSpent} predictions={predictions} />
        </div>

        {/* Risk Profile */}
        <div style={{ flex: isDesktop ? 1 : 'auto' }}>
          <RiskProfile predictions={predictions} />
        </div>
      </div>

      {/* Predictions List */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          ...flexBetween,
          marginBottom: '12px',
        }}>
          <span style={{
            ...sectionHeader,
            marginBottom: 0,
          }}>
            YOUR PREDICTIONS ({predictions.length}/{MAX_PREDICTIONS})
          </span>
        </div>

        {predictions.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: designColors.textMuted,
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            <div>No predictions yet</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>
              Add at least {MIN_PREDICTIONS} predictions to lock your portfolio
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <AnimatePresence>
              {predictions.map((prediction, index) => (
                <PredictionCard
                  key={prediction.eventId}
                  prediction={prediction}
                  onRemove={onRemove}
                  isLocked={isLocked}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Total Points */}
        {predictions.length > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: designColors.bgCard,
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: '13px',
              color: designColors.textSecondary,
            }}>
              Total Potential Points
            </span>
            <span style={{
              fontSize: '18px',
              fontWeight: 'bold',
              fontFamily: fontMono,
              color: designColors.cyan,
            }}>
              {totalPotentialPoints?.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Lock Button */}
      {!isLocked && (
        <div style={fixedBottomContainer}>
          {/* Validation message */}
          {!canLock && predictions.length > 0 && (
            <div style={{
              marginBottom: '12px',
              fontSize: '12px',
              color: designColors.orange,
              textAlign: 'center',
            }}>
              {predictions.length < MIN_PREDICTIONS
                ? `Add ${MIN_PREDICTIONS - predictions.length} more prediction${MIN_PREDICTIONS - predictions.length > 1 ? 's' : ''} to lock`
                : validationMessage
              }
            </div>
          )}

          <motion.button
            onClick={onLock}
            disabled={!canLock}
            whileTap={canLock ? { scale: 0.98 } : {}}
            style={{
              ...buttonPrimary,
              ...(!canLock && {
                ...buttonDisabled,
                border: `1px solid ${designColors.borderDefault}`,
              }),
              width: '100%',
              boxShadow: canLock ? glowEffects.cyanIntense : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            LOCK PORTFOLIO
          </motion.button>
        </div>
      )}

      {/* Locked state banner */}
      {isLocked && (
        <div style={{
          margin: '16px',
          padding: '16px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '10px',
          border: `1px solid ${designColors.green}`,
          textAlign: 'center',
        }}>
          <span style={{
            color: designColors.green,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            Portfolio Locked
          </span>
        </div>
      )}
    </motion.div>
  );
}
