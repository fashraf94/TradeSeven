import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { designColors, fontMono, MAGNITUDES, BUDGET } from '../designConstants';
import { fadeIn, slideUp, slideInRight, springSmooth, springBouncy } from '../animationPresets';
import { calculateParlayPrices } from '../../../services/earningsReactionsService';
import BeatMissToggle from './BeatMissToggle';
import MagnitudePillars from './MagnitudePillars';
import PredictionSummary from './PredictionSummary';

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

  // Reset state when modal opens with new event
  useMemo(() => {
    if (isOpen) {
      setSelectedOutcome(null);
      setSelectedMagnitude(null);
    }
  }, [isOpen, event?.id]);

  // Calculate all parlay prices from the service
  const parlayPrices = useMemo(() => {
    if (!event) return [];
    return calculateParlayPrices(event, BUDGET);
  }, [event]);

  // Get the selected parlay details
  const selectedParlay = useMemo(() => {
    if (!selectedOutcome || !selectedMagnitude) return null;
    return parlayPrices.find(p =>
      p.outcome === selectedOutcome && p.magnitude === selectedMagnitude
    );
  }, [parlayPrices, selectedOutcome, selectedMagnitude]);

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
      potentialPoints: selectedParlay.potentialPoints,
      multiplier: selectedParlay.multiplier,
      risk: selectedParlay.risk,
      createdAt: new Date().toISOString(),
    };

    onAddPrediction(prediction);
    onClose();
  };

  const isComplete = selectedOutcome && selectedMagnitude && selectedParlay;
  const canAfford = selectedParlay ? selectedParlay.price <= currentBudget : true;

  if (!isOpen || !event) return null;

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
              marginBottom: '24px',
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

            {/* Prediction summary */}
            <PredictionSummary
              symbol={event.symbol}
              outcome={selectedOutcome}
              magnitude={selectedMagnitude}
              price={selectedParlay?.price || 0}
              potentialPoints={selectedParlay?.potentialPoints || 0}
              multiplier={selectedParlay?.multiplier || 0}
              riskLevel={selectedParlay?.risk?.level || 'low'}
              budgetRemaining={currentBudget}
              budgetAfterPick={budgetAfterPick}
              onConfirm={handleConfirm}
              disabled={!isComplete || !canAfford}
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
                  Insufficient budget. Need ${selectedParlay.price - currentBudget} more.
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
            marginBottom: '32px',
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

          {/* Prediction summary */}
          <div style={{ marginTop: 'auto' }}>
            <PredictionSummary
              symbol={event.symbol}
              outcome={selectedOutcome}
              magnitude={selectedMagnitude}
              price={selectedParlay?.price || 0}
              potentialPoints={selectedParlay?.potentialPoints || 0}
              multiplier={selectedParlay?.multiplier || 0}
              riskLevel={selectedParlay?.risk?.level || 'low'}
              budgetRemaining={currentBudget}
              budgetAfterPick={budgetAfterPick}
              onConfirm={handleConfirm}
              disabled={!isComplete || !canAfford}
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
                  Insufficient budget. Need ${selectedParlay.price - currentBudget} more.
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
    </>
  );
}
