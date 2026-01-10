/**
 * EarningsGameScreen.jsx
 *
 * Main screen for EarningsGame mode with parlay system.
 * Users select outcome (beat/miss) + magnitude (up big, up, flat, down, down big)
 *
 * Phase 1 Refactor: Integrated useEarningsGame hook, Framer Motion, and new shared components
 * Phase 2 Refactor: Integrated EarningsCalendar component for calendar view
 * Phase 3 Refactor: Integrated ParlayArchitectModal with BeatMissToggle, MagnitudePillars, PredictionSummary
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEarningsGame } from '../hooks/useEarningsGame';
import { getUpcomingEarnings } from '../services/polymarketService';
import {
  designColors,
  fontMono,
  BUDGET,
  MIN_PREDICTIONS,
  MAX_PREDICTIONS,
  EarningsCalendar,
  ParlayArchitectModal
} from '../components/earningsGame';

const EarningsGameScreen = ({
  user,
  onBack,
  setScreen,
  colors = {},
  isDesktop = false
}) => {
  // Use the hook for portfolio state management
  const {
    predictions,
    addPrediction,
    removePrediction,
    lockPortfolio,
    isLocked,
    totalSpent,
    budgetRemaining,
    totalPotentialPoints,
    isValid,
    validationMessage,
    reset,
  } = useEarningsGame();

  // View state for navigation between screens
  const [view, setView] = useState('calendar'); // 'calendar' | 'portfolio' | 'arena' | 'results'

  // Events and loading state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState(null);

  // Load earnings data
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getUpcomingEarnings(45);
        setEvents(data);
      } catch (err) {
        console.error('Load error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate tournament week number based on current date
  const getTournamentWeek = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return weekNum;
  };

  // Get lock deadline (next Monday 9am)
  const getLockDeadline = () => {
    const now = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday;
  };

  // Handlers
  const handleSelectEvent = (event) => {
    if (predictions.find(p => p.eventId === event.id)) return;
    setSelectedEvent(event);
    setSelectedOutcome(null);
  };

  const handleSelectOutcome = (outcome) => {
    setSelectedOutcome(outcome);
  };

  const handleAddParlay = (prediction) => {
    // Use hook's addPrediction - it handles all validation
    // The prediction object comes from ParlayArchitectModal with all required fields
    const success = addPrediction(
      { id: prediction.eventId, symbol: prediction.symbol, companyName: prediction.companyName },
      prediction
    );

    if (success) {
      setSelectedEvent(null);
      setSelectedOutcome(null);
    }
  };

  const handleRemove = (eventId) => {
    removePrediction(eventId);
  };

  const handleLock = () => {
    const success = lockPortfolio();
    if (success) {
      setView('arena');
    }
  };

  const handleReset = () => {
    reset();
    setSelectedEvent(null);
    setSelectedOutcome(null);
    setView('calendar');
  };

  const closeModal = () => {
    setSelectedEvent(null);
    setSelectedOutcome(null);
  };

  // Format helpers
  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // ========================================
  // VIEW: CALENDAR (New EarningsCalendar component)
  // ========================================
  if (view === 'calendar') {
    return (
      <>
        <EarningsCalendar
          events={events}
          predictions={predictions}
          tournament={{
            week: getTournamentWeek(),
            lockDeadline: getLockDeadline(),
            status: isLocked ? 'locked' : 'open',
          }}
          loading={loading}
          error={error}
          onBack={onBack}
          onOpenArchitect={(event) => {
            setSelectedEvent(event);
            setSelectedOutcome(null);
          }}
          onViewPortfolio={() => setView('portfolio')}
          isDesktop={isDesktop}
        />

        {/* Parlay Architect Modal - Phase 3 */}
        <ParlayArchitectModal
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={closeModal}
          onAddPrediction={handleAddParlay}
          currentBudget={budgetRemaining}
          isDesktop={isDesktop}
        />
      </>
    );
  }

  // ========================================
  // VIEW: PORTFOLIO (To be replaced in Phase 4)
  // ========================================
  if (view === 'portfolio') {
    return (
      <div style={{ minHeight: '100vh', background: designColors.bgPrimary, color: designColors.textPrimary }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            background: designColors.bgCard,
            borderBottom: `1px solid ${designColors.borderDefault}`,
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <motion.button
                onClick={() => setView('calendar')}
                whileTap={{ scale: 0.95 }}
                style={{ background: 'none', border: 'none', color: designColors.textSecondary, cursor: 'pointer', fontSize: '16px' }}
              >
                ←
              </motion.button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: designColors.cyan, margin: 0 }}>PORTFOLIO</h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: fontMono }}>
                ${budgetRemaining.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: designColors.textSecondary }}>remaining</div>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
          {/* Budget Summary */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: designColors.bgCard,
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: designColors.textSecondary }}>Budget Remaining</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: fontMono }}>
                  ${budgetRemaining.toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: designColors.textSecondary }}>Potential Points</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: designColors.cyan, fontFamily: fontMono }}>
                  {totalPotentialPoints.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Budget Bar */}
            <div style={{ height: '8px', background: designColors.borderDefault, borderRadius: '4px', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(totalSpent / BUDGET) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  background: budgetRemaining < 0 ? designColors.red : designColors.cyan,
                  borderRadius: '4px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', color: designColors.textSecondary }}>
              <span>{predictions.length} / {MAX_PREDICTIONS} predictions</span>
              <span style={{ fontFamily: fontMono }}>${totalSpent.toLocaleString()} / $10,000 spent</span>
            </div>
          </motion.div>

          {/* Predictions List */}
          {predictions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '60px', color: designColors.textSecondary }}
            >
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>No predictions yet</p>
              <p style={{ fontSize: '14px' }}>Go to Calendar to add predictions</p>
              <motion.button
                onClick={() => setView('calendar')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  background: designColors.cyan,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Browse Calendar
              </motion.button>
            </motion.div>
          ) : (
            <div>
              <h3 style={{ color: designColors.textSecondary, fontSize: '14px', marginBottom: '12px', fontWeight: '600' }}>
                Your Predictions
              </h3>
              {predictions.map((pred, index) => (
                <motion.div
                  key={pred.eventId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  style={{
                    padding: '16px',
                    background: designColors.bgCard,
                    border: `1px solid ${designColors.borderDefault}`,
                    borderRadius: '10px',
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{pred.symbol}</span>
                        <span style={{
                          padding: '4px 12px',
                          background: pred.outcome === 'beat' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          border: `1px solid ${pred.outcome === 'beat' ? designColors.green : designColors.red}`,
                          borderRadius: '20px',
                          fontSize: '12px',
                          color: pred.outcome === 'beat' ? designColors.green : designColors.red,
                          fontWeight: '600'
                        }}>
                          {pred.outcome.toUpperCase()}
                        </span>
                        <span style={{
                          padding: '4px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '20px',
                          fontSize: '12px'
                        }}>
                          {pred.emoji} {pred.range}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: designColors.textMuted }}>
                        {Math.round(pred.combinedProb * 100)}% probability, {pred.multiplier}x multiplier
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: fontMono }}>
                        ${pred.price.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '13px', color: designColors.cyan, fontFamily: fontMono }}>
                        {pred.potentialPoints.toLocaleString()} pts
                      </div>
                      {!isLocked && (
                        <motion.button
                          onClick={() => handleRemove(pred.eventId)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            marginTop: '8px',
                            padding: '4px 12px',
                            background: 'transparent',
                            border: `1px solid ${designColors.red}`,
                            borderRadius: '6px',
                            color: designColors.red,
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Lock Button */}
              {!isLocked && (
                <motion.button
                  onClick={handleLock}
                  disabled={!isValid}
                  whileHover={isValid ? { scale: 1.01 } : {}}
                  whileTap={isValid ? { scale: 0.99 } : {}}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginTop: '16px',
                    background: isValid ? designColors.cyan : designColors.borderDefault,
                    border: 'none',
                    borderRadius: '12px',
                    color: isValid ? '#000' : designColors.textMuted,
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: isValid ? 'pointer' : 'not-allowed'
                  }}
                >
                  {validationMessage || 'LOCK PORTFOLIO'}
                </motion.button>
              )}

              {isLocked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    padding: '16px',
                    background: 'rgba(16,185,129,0.1)',
                    border: `1px solid ${designColors.green}`,
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: designColors.green,
                    marginTop: '16px'
                  }}
                >
                  Portfolio Locked - Good luck!
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================================
  // VIEW: ARENA (To be replaced in Phase 5)
  // ========================================
  if (view === 'arena') {
    return (
      <div style={{ minHeight: '100vh', background: designColors.bgPrimary, color: designColors.textPrimary }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            background: designColors.bgCard,
            borderBottom: `1px solid ${designColors.borderDefault}`,
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <motion.button
                onClick={() => setView('portfolio')}
                whileTap={{ scale: 0.95 }}
                style={{ background: 'none', border: 'none', color: designColors.textSecondary, cursor: 'pointer', fontSize: '16px' }}
              >
                ←
              </motion.button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: designColors.cyan, margin: 0 }}>LIVE ARENA</h1>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
          {!isLocked ? (
            <div style={{ textAlign: 'center', padding: '60px', color: designColors.textSecondary }}>
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>Build and lock your portfolio first</p>
              <motion.button
                onClick={() => setView('portfolio')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  background: designColors.cyan,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                View Portfolio
              </motion.button>
            </div>
          ) : (
            <div>
              {/* Score Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: `linear-gradient(135deg, ${designColors.bgCard} 0%, rgba(0,217,255,0.1) 100%)`,
                  borderRadius: '16px',
                  padding: '32px',
                  textAlign: 'center',
                  marginBottom: '24px',
                  border: `1px solid ${designColors.cyan}33`
                }}
              >
                <div style={{ fontSize: '14px', color: designColors.textSecondary, marginBottom: '8px' }}>POTENTIAL POINTS</div>
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  style={{ fontSize: '48px', fontWeight: 'bold', color: designColors.cyan, fontFamily: fontMono }}
                >
                  {totalPotentialPoints.toLocaleString()}
                </motion.div>
                <div style={{ fontSize: '14px', color: designColors.textSecondary, marginTop: '8px' }}>
                  {predictions.length} predictions, ${totalSpent.toLocaleString()} invested
                </div>
              </motion.div>

              {/* Predictions Summary */}
              <h3 style={{ color: designColors.textSecondary, fontSize: '14px', marginBottom: '12px' }}>Your Locked Predictions</h3>
              {predictions.map((pred, index) => (
                <motion.div
                  key={pred.eventId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    background: designColors.bgCard,
                    borderRadius: '10px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 'bold' }}>{pred.symbol}</span>
                    <span style={{ color: pred.outcome === 'beat' ? designColors.green : designColors.red, fontSize: '13px' }}>
                      {pred.outcome.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '13px' }}>{pred.emoji} {pred.range}</span>
                  </div>
                  <div style={{ color: designColors.textSecondary, fontSize: '14px', fontFamily: fontMono }}>
                    {pred.potentialPoints.toLocaleString()} pts
                  </div>
                </motion.div>
              ))}

              {/* Reset */}
              <motion.button
                onClick={handleReset}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  width: '100%',
                  padding: '14px',
                  marginTop: '24px',
                  background: 'transparent',
                  border: `1px solid ${designColors.borderDefault}`,
                  borderRadius: '10px',
                  color: designColors.textSecondary,
                  cursor: 'pointer'
                }}
              >
                Reset & Start Over
              </motion.button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback - should never reach here
  return null;
};

export default EarningsGameScreen;
