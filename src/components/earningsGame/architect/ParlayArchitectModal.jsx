import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp } from 'lucide-react';
import { designColors, fontMono, MAGNITUDES, BUDGET } from '../designConstants';
import { fadeIn, slideUp, slideInRight, springSmooth, springBouncy } from '../animationPresets';
import { calculateParlayPrices, calculateParlayPricesAsync, calculatePayout } from '../../../services/earningsReactionsService';
import { getStockEarningsStats } from '../../../services/stockEarningsHistoryService';
import BeatMissToggle from './BeatMissToggle';
import MagnitudePillars from './MagnitudePillars';
import PredictionSummary from './PredictionSummary';
import PrecisionTierSelector from './PrecisionTierSelector';

export default function ParlayArchitectModal({
  event,             // { id, symbol, companyName, yesOdds, noOdds, ... }
  isOpen,
  onClose,
  onAddPrediction,   // (prediction) => void
  currentBudget,     // Remaining budget
  isDesktop = false,
}) {
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [selectedMagnitude, setSelectedMagnitude] = useState(null);
  const [selectedPrecisionTier, setSelectedPrecisionTier] = useState('standard');
  const [showLotteryMode, setShowLotteryMode] = useState(false);

  // Stock-specific historical data
  const [stockStats, setStockStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Reset state when modal opens with new event
  useMemo(() => {
    if (isOpen) {
      setSelectedOutcome(null);
      setSelectedMagnitude(null);
      setSelectedPrecisionTier('standard');
      setShowLotteryMode(false);
      setStockStats(null);
    }
  }, [isOpen, event?.id]);

  // Fetch stock-specific historical stats when modal opens
  useEffect(() => {
    if (!isOpen || !event?.symbol) {
      return;
    }

    let cancelled = false;
    setLoadingStats(true);

    getStockEarningsStats(event.symbol)
      .then(stats => {
        if (!cancelled) {
          setStockStats(stats);
          setLoadingStats(false);
        }
      })
      .catch(err => {
        console.warn('[ParlayArchitectModal] Failed to fetch stock stats:', err);
        if (!cancelled) {
          setLoadingStats(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, event?.symbol]);

  // Reset precision tier when magnitude changes
  useEffect(() => {
    setSelectedPrecisionTier('standard');
  }, [selectedMagnitude]);

  // State for parlay prices (async calculation)
  const [parlayPrices, setParlayPrices] = useState([]);
  const [loadingParlays, setLoadingParlays] = useState(false);

  // Calculate parlay prices using async version (stock-specific data when available)
  useEffect(() => {
    if (!isOpen || !event) {
      setParlayPrices([]);
      return;
    }

    let cancelled = false;
    setLoadingParlays(true);

    // Use async version to get stock-specific probabilities
    calculateParlayPricesAsync(event, BUDGET)
      .then(prices => {
        if (!cancelled) {
          setParlayPrices(prices);
          setLoadingParlays(false);
        }
      })
      .catch(err => {
        console.warn('[ParlayArchitectModal] Async calculation failed, falling back to sync:', err);
        if (!cancelled) {
          // Fallback to sync version if async fails
          setParlayPrices(calculateParlayPrices(event, BUDGET));
          setLoadingParlays(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, event]);

  // Get the selected parlay details
  const selectedParlay = useMemo(() => {
    if (!selectedOutcome || !selectedMagnitude) return null;
    return parlayPrices.find(p =>
      p.outcome === selectedOutcome && p.magnitude === selectedMagnitude
    );
  }, [parlayPrices, selectedOutcome, selectedMagnitude]);

  // Get the selected precision option
  const selectedPrecisionOption = useMemo(() => {
    if (!selectedParlay || !selectedParlay.precisionOptions) return null;
    return selectedParlay.precisionOptions.find(o => o.tierId === selectedPrecisionTier)
      || selectedParlay.precisionOptions[0];
  }, [selectedParlay, selectedPrecisionTier]);

  // Calculate final multiplier and payout based on precision tier
  const finalMultiplier = selectedPrecisionOption?.finalMultiplier || selectedParlay?.baseMultiplier || 0;
  const finalPotentialPoints = selectedParlay ? calculatePayout(selectedParlay.price, finalMultiplier) : 0;

  // Budget after this pick
  const budgetAfterPick = selectedParlay
    ? currentBudget - selectedParlay.price
    : currentBudget;

  const handleConfirm = () => {
    if (!selectedOutcome || !selectedMagnitude || !event || !selectedParlay) return;

    const prediction = {
      eventId: event.id,
      symbol: event.symbol,
      companyName: event.companyName,
      outcome: selectedOutcome,
      magnitude: selectedMagnitude,
      price: selectedParlay.price,
      potentialPoints: finalPotentialPoints,
      multiplier: finalMultiplier,
      baseMultiplier: selectedParlay.baseMultiplier,
      risk: selectedParlay.risk,
      // Precision tier info
      precisionTier: selectedPrecisionTier,
      precisionLabel: selectedPrecisionOption?.tierLabel || 'Standard',
      precisionRange: selectedPrecisionOption?.range?.label || selectedParlay.magnitudeRange,
      // Additional parlay info for the hook
      precisionOptions: selectedParlay.precisionOptions,
      outcomeLabel: selectedParlay.outcomeLabel,
      magnitudeLabel: selectedParlay.magnitudeLabel,
      magnitudeEmoji: selectedParlay.magnitudeEmoji,
      magnitudeRange: selectedParlay.magnitudeRange,
      priceDisplay: selectedParlay.priceDisplay,
      combinedProb: selectedParlay.combinedProb,
      outcomeOdds: selectedParlay.outcomeOdds,
      reactionProb: selectedParlay.reactionProb,
      sector: selectedParlay.sector,
      createdAt: new Date().toISOString(),
    };

    onAddPrediction(prediction);
    onClose();
  };

  const isComplete = selectedOutcome && selectedMagnitude && selectedParlay;
  const canAfford = selectedParlay ? selectedParlay.price <= currentBudget : true;

  if (!isOpen || !event) return null;

  // Stock Stats Bar Component - shows historical earnings reaction data
  const StockStatsBar = ({ stats }) => {
    if (!stats) return null;

    const { avgMoveOnBeat, avgMoveOnMiss, beatRate, quartersAnalyzed } = stats;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'rgba(0, 217, 255, 0.08)',
          border: '1px solid rgba(0, 217, 255, 0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px'
        }}>
          <TrendingUp size={14} color="#00d9ff" />
          <span style={{
            fontSize: '11px',
            color: '#00d9ff',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>
            HISTORICAL DATA ({quartersAnalyzed} QUARTERS)
          </span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          gap: '16px'
        }}>
          {avgMoveOnBeat !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: fontMono,
                color: avgMoveOnBeat >= 0 ? '#10b981' : '#ef4444'
              }}>
                {avgMoveOnBeat >= 0 ? '+' : ''}{avgMoveOnBeat.toFixed(1)}%
              </div>
              <div style={{ fontSize: '10px', color: '#8b949e' }}>Avg on Beat</div>
            </div>
          )}

          {avgMoveOnMiss !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: fontMono,
                color: avgMoveOnMiss >= 0 ? '#10b981' : '#ef4444'
              }}>
                {avgMoveOnMiss >= 0 ? '+' : ''}{avgMoveOnMiss.toFixed(1)}%
              </div>
              <div style={{ fontSize: '10px', color: '#8b949e' }}>Avg on Miss</div>
            </div>
          )}

          {beatRate !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: fontMono,
                color: '#f59e0b'
              }}>
                {beatRate}%
              </div>
              <div style={{ fontSize: '10px', color: '#8b949e' }}>Beat Rate</div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // Lottery Mode Toggle Component
  const LotteryModeToggle = () => (
    <motion.button
      onClick={() => setShowLotteryMode(!showLotteryMode)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: showLotteryMode
          ? 'rgba(0, 217, 255, 0.15)'
          : designColors.bgCardInner,
        border: showLotteryMode
          ? `1px solid ${designColors.cyan}`
          : `1px solid ${designColors.borderDefault}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        width: '100%',
        justifyContent: 'center',
      }}
    >
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: showLotteryMode
          ? 'rgba(0, 217, 255, 0.25)'
          : 'rgba(139, 148, 158, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Zap
          size={16}
          color={showLotteryMode ? designColors.cyan : designColors.textSecondary}
          fill={showLotteryMode ? designColors.cyan : 'none'}
        />
      </div>
      <span style={{
        fontSize: '13px',
        fontWeight: 'bold',
        color: showLotteryMode ? designColors.cyan : designColors.textSecondary,
        letterSpacing: '0.5px',
      }}>
        LOTTERY MODE
      </span>
      <span style={{
        fontSize: '11px',
        color: designColors.textMuted,
        marginLeft: '4px',
      }}>
        {showLotteryMode ? 'ON' : 'OFF'}
      </span>
    </motion.button>
  );

  // Mobile bottom sheet
  if (!isDesktop) {
    return (
      <AnimatePresence>
        <motion.div
          {...fadeIn}
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 1000,
          }}
        >
          <motion.div
            {...slideUp}
            transition={springBouncy}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: designColors.bgCard,
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '20px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div style={{
              width: '40px',
              height: '4px',
              backgroundColor: designColors.borderDefault,
              borderRadius: '2px',
              margin: '0 auto 16px',
            }} />

            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <div>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: designColors.textPrimary,
                  margin: 0,
                }}>
                  {event.symbol}
                </h2>
                <span style={{
                  fontSize: '12px',
                  color: designColors.textSecondary,
                }}>
                  {event.companyName}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: designColors.textSecondary,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px',
                }}
              >
                ×
              </button>
            </div>

            {/* Budget indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: designColors.bgCardInner,
              borderRadius: '8px',
              marginBottom: '16px',
            }}>
              <span style={{
                fontSize: '12px',
                color: designColors.textSecondary,
              }}>
                REMAINING BUDGET
              </span>
              <span style={{
                fontFamily: fontMono,
                fontSize: '16px',
                fontWeight: 'bold',
                color: currentBudget < 500 ? designColors.orange : designColors.cyan,
              }}>
                ${currentBudget.toLocaleString()} / ${BUDGET.toLocaleString()}
              </span>
            </div>

            {/* Stock Stats Bar - Historical earnings data */}
            <StockStatsBar stats={stockStats} />

            {/* Outcome section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '12px',
                color: designColors.textSecondary,
                marginBottom: '12px',
                letterSpacing: '1px',
              }}>
                OUTCOME
              </div>
              <BeatMissToggle
                selected={selectedOutcome}
                beatOdds={event.yesOdds || 0.5}
                missOdds={event.noOdds || 0.5}
                onSelect={setSelectedOutcome}
              />
              {/* Attribution */}
              <div style={{
                textAlign: 'center',
                fontSize: '11px',
                color: '#8b949e',
                marginTop: '8px',
                fontStyle: 'italic'
              }}>
                Based on 12-quarter historical data
              </div>
            </div>

            {/* Magnitude section */}
            <div style={{ marginBottom: '24px' }}>
              <MagnitudePillars
                selected={selectedMagnitude}
                parlayPrices={parlayPrices}
                outcome={selectedOutcome}
                budgetRemaining={currentBudget}
                onSelect={setSelectedMagnitude}
                disabled={!selectedOutcome}
              />
            </div>

            {/* Lottery Mode section */}
            {selectedMagnitude && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  fontSize: '12px',
                  color: designColors.textSecondary,
                  marginBottom: '12px',
                  letterSpacing: '1px',
                }}>
                  PRECISION (OPTIONAL)
                </div>
                <LotteryModeToggle />

                <AnimatePresence>
                  {showLotteryMode && selectedParlay && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ marginTop: '12px', overflow: 'hidden' }}
                    >
                      <PrecisionTierSelector
                        magnitude={selectedMagnitude}
                        baseMultiplier={selectedParlay.baseMultiplier}
                        precisionOptions={selectedParlay.precisionOptions}
                        selected={selectedPrecisionTier}
                        onSelect={setSelectedPrecisionTier}
                        price={selectedParlay.price}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Prediction summary */}
            <PredictionSummary
              symbol={event.symbol}
              outcome={selectedOutcome}
              magnitude={selectedMagnitude}
              price={selectedParlay?.price || 0}
              potentialPoints={finalPotentialPoints}
              multiplier={finalMultiplier}
              riskLevel={selectedParlay?.risk?.level || 'low'}
              budgetRemaining={currentBudget}
              budgetAfterPick={budgetAfterPick}
              onConfirm={handleConfirm}
              disabled={!isComplete || !canAfford}
              precisionTier={selectedPrecisionTier}
              precisionLabel={selectedPrecisionOption?.tierLabel}
            />

            {/* Budget warning */}
            {isComplete && !canAfford && selectedParlay && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${designColors.red}`,
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <span style={{
                  fontSize: '12px',
                  color: designColors.red,
                }}>
                  Insufficient budget. Need ${(selectedParlay.price - currentBudget).toLocaleString()} more.
                </span>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Desktop side panel - Enhanced with shadow and better positioning
  return (
    <>
      {/* Semi-transparent backdrop */}
      <motion.div
        {...fadeIn}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 999,
        }}
      />

      {/* Side panel */}
      <motion.div
        {...slideInRight}
        transition={springSmooth}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          backgroundColor: designColors.bgPrimary,
          borderLeft: `1px solid ${designColors.borderDefault}`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
          overflowY: 'auto',
          padding: '24px',
        }}
      >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '32px',
          }}>
            <div>
              <div style={{
                fontSize: '10px',
                color: designColors.cyan,
                letterSpacing: '2px',
                marginBottom: '8px',
              }}>
                PARLAY ARCHITECT
              </div>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: designColors.textPrimary,
                margin: 0,
              }}>
                {event.symbol}
              </h2>
              <span style={{
                fontSize: '14px',
                color: designColors.textSecondary,
              }}>
                {event.companyName}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: `1px solid ${designColors.borderDefault}`,
                borderRadius: '8px',
                color: designColors.textSecondary,
                fontSize: '20px',
                cursor: 'pointer',
                padding: '8px 12px',
              }}
            >
              ×
            </button>
          </div>

          {/* Budget indicator */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            backgroundColor: designColors.bgCardInner,
            borderRadius: '10px',
            marginBottom: '20px',
            border: `1px solid ${designColors.borderDefault}`,
          }}>
            <span style={{
              fontSize: '12px',
              color: designColors.textSecondary,
              letterSpacing: '1px',
            }}>
              REMAINING BUDGET
            </span>
            <span style={{
              fontFamily: fontMono,
              fontSize: '18px',
              fontWeight: 'bold',
              color: currentBudget < 500 ? designColors.orange : designColors.cyan,
            }}>
              ${currentBudget.toLocaleString()} / ${BUDGET.toLocaleString()}
            </span>
          </div>

          {/* Stock Stats Bar - Historical earnings data */}
          <StockStatsBar stats={stockStats} />

          {/* Outcome section */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              fontSize: '12px',
              color: designColors.textSecondary,
              marginBottom: '16px',
              letterSpacing: '1px',
            }}>
              STEP 1: SELECT OUTCOME
            </div>
            <BeatMissToggle
              selected={selectedOutcome}
              beatOdds={event.yesOdds || 0.5}
              missOdds={event.noOdds || 0.5}
              onSelect={setSelectedOutcome}
            />
            {/* Attribution */}
            <div style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#8b949e',
              marginTop: '8px',
              fontStyle: 'italic'
            }}>
              Based on 12-quarter historical data
            </div>
          </div>

          {/* Magnitude section */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              fontSize: '12px',
              color: designColors.textSecondary,
              marginBottom: '16px',
              letterSpacing: '1px',
            }}>
              STEP 2: SELECT MAGNITUDE
            </div>
            <MagnitudePillars
              selected={selectedMagnitude}
              parlayPrices={parlayPrices}
              outcome={selectedOutcome}
              budgetRemaining={currentBudget}
              onSelect={setSelectedMagnitude}
              disabled={!selectedOutcome}
            />
          </div>

          {/* Lottery Mode / Precision section */}
          {selectedMagnitude && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                fontSize: '12px',
                color: designColors.textSecondary,
                marginBottom: '16px',
                letterSpacing: '1px',
              }}>
                STEP 3: PRECISION TIER (OPTIONAL)
              </div>
              <LotteryModeToggle />

              <AnimatePresence>
                {showLotteryMode && selectedParlay && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ marginTop: '16px', overflow: 'hidden' }}
                  >
                    <PrecisionTierSelector
                      magnitude={selectedMagnitude}
                      baseMultiplier={selectedParlay.baseMultiplier}
                      precisionOptions={selectedParlay.precisionOptions}
                      selected={selectedPrecisionTier}
                      onSelect={setSelectedPrecisionTier}
                      price={selectedParlay.price}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Prediction summary */}
          <div style={{ marginTop: 'auto' }}>
            <PredictionSummary
              symbol={event.symbol}
              outcome={selectedOutcome}
              magnitude={selectedMagnitude}
              price={selectedParlay?.price || 0}
              potentialPoints={finalPotentialPoints}
              multiplier={finalMultiplier}
              riskLevel={selectedParlay?.risk?.level || 'low'}
              budgetRemaining={currentBudget}
              budgetAfterPick={budgetAfterPick}
              onConfirm={handleConfirm}
              disabled={!isComplete || !canAfford}
              precisionTier={selectedPrecisionTier}
              precisionLabel={selectedPrecisionOption?.tierLabel}
            />

            {/* Budget warning */}
            {isComplete && !canAfford && selectedParlay && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${designColors.red}`,
                  borderRadius: '10px',
                  textAlign: 'center',
                }}
              >
                <span style={{
                  fontSize: '13px',
                  color: designColors.red,
                }}>
                  Insufficient budget. Need ${(selectedParlay.price - currentBudget).toLocaleString()} more.
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
    </>
  );
}
