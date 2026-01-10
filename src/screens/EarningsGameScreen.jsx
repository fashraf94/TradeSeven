/**
 * EarningsGameScreen.jsx
 *
 * Main screen for EarningsGame mode with parlay system.
 * Users select outcome (beat/miss) + magnitude (up big, up, flat, down, down big)
 *
 * Phase 1 Refactor: Integrated useEarningsGame hook, Framer Motion, and new shared components
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
  MAX_PREDICTIONS
} from '../components/earningsGame';
import {
  EarningsHeader,
  CountdownTimer,
  BracketBadge
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

  // Legacy tab state (maps to view for backwards compatibility during transition)
  const [activeTab, setActiveTab] = useState('calendar');

  // Events and loading state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Calendar state
  const [expandedWeek, setExpandedWeek] = useState(null);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState(null);

  // Load earnings data
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getUpcomingEarnings(45);
        setEvents(data);

        // Auto-expand first week with events
        if (data.length > 0) {
          const firstDate = new Date(data[0].reportDate);
          const day = firstDate.getDay();
          const diff = firstDate.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(firstDate);
          monday.setDate(diff);
          setExpandedWeek(monday.toISOString().split('T')[0]);
        }
      } catch (err) {
        console.error('Load error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Group events by week
  const eventsByWeek = useMemo(() => {
    const grouped = {};
    events.forEach(event => {
      if (!event.reportDate) return;
      const date = new Date(event.reportDate);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      const weekKey = monday.toISOString().split('T')[0];

      if (!grouped[weekKey]) {
        grouped[weekKey] = {
          weekStart: new Date(monday),
          weekEnd: new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000),
          events: []
        };
      }
      grouped[weekKey].events.push(event);
    });

    Object.values(grouped).forEach(week => {
      week.events.sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));
    });

    return grouped;
  }, [events]);

  // Handlers
  const handleSelectEvent = (event) => {
    if (predictions.find(p => p.eventId === event.id)) return;
    setSelectedEvent(event);
    setSelectedOutcome(null);
  };

  const handleSelectOutcome = (outcome) => {
    setSelectedOutcome(outcome);
  };

  const handleAddParlay = (parlay) => {
    if (!selectedEvent) return;

    // Use hook's addPrediction - it handles all validation
    const success = addPrediction(selectedEvent, parlay);

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
      setActiveTab('match');
      setView('arena');
    }
  };

  const handleReset = () => {
    reset();
    setSelectedEvent(null);
    setSelectedOutcome(null);
    setActiveTab('calendar');
    setView('calendar');
  };

  const closeModal = () => {
    setSelectedEvent(null);
    setSelectedOutcome(null);
  };

  // Format helpers
  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formatWeekRange = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  // Merge design colors with passed colors
  const mergedColors = {
    ...designColors,
    ...colors
  };

  // Loading state with animation
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: designColors.bgPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            color: designColors.cyan,
            fontSize: '18px',
            fontFamily: fontMono
          }}
        >
          Loading earnings data...
        </motion.div>
      </div>
    );
  }

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
              onClick={onBack}
              whileTap={{ scale: 0.95 }}
              style={{ background: 'none', border: 'none', color: designColors.textSecondary, cursor: 'pointer', fontSize: '16px' }}
            >
              ← Back
            </motion.button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: designColors.cyan, margin: 0 }}>EARNINGSGAME</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: fontMono }}>
              ${budgetRemaining.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: designColors.textSecondary }}>remaining</div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ background: 'rgba(18,18,26,0.5)', borderBottom: `1px solid ${designColors.borderDefault}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex' }}>
          {[
            { id: 'calendar', label: 'Calendar' },
            { id: 'portfolio', label: `Portfolio (${predictions.length})` },
            { id: 'match', label: 'Match' }
          ].map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '16px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${designColors.cyan}` : '2px solid transparent',
                color: activeTab === tab.id ? designColors.cyan : designColors.textSecondary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'color 0.2s'
              }}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

        {/* Calendar Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ color: designColors.cyan, margin: '0 0 8px 0' }}>Earnings Season Calendar</h2>
                <p style={{ color: designColors.textSecondary, margin: 0, fontSize: '14px' }}>
                  Select an earnings event to build your parlay prediction
                </p>
              </div>

              {events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: designColors.textSecondary }}>
                  <p style={{ fontSize: '18px' }}>No upcoming earnings markets found</p>
                  <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" style={{ color: designColors.cyan }}>View Polymarket</a>
                </div>
              ) : (
                Object.entries(eventsByWeek)
                  .sort(([a], [b]) => new Date(a) - new Date(b))
                  .map(([weekKey, weekData], weekIndex) => {
                    const isExpanded = expandedWeek === weekKey;

                    return (
                      <motion.div
                        key={weekKey}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: weekIndex * 0.05 }}
                        style={{ marginBottom: '12px' }}
                      >
                        {/* Week Header */}
                        <motion.button
                          onClick={() => setExpandedWeek(isExpanded ? null : weekKey)}
                          whileTap={{ scale: 0.99 }}
                          style={{
                            width: '100%',
                            padding: '16px 20px',
                            background: designColors.bgCard,
                            border: `1px solid ${designColors.borderDefault}`,
                            borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ color: designColors.textPrimary, fontWeight: 'bold' }}>Week of {formatDate(weekData.weekStart)}</div>
                            <div style={{ color: designColors.textSecondary, fontSize: '13px' }}>{formatWeekRange(weekData.weekStart, weekData.weekEnd)}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              padding: '4px 12px',
                              background: 'rgba(0, 217, 255, 0.1)',
                              borderRadius: '20px',
                              color: designColors.cyan,
                              fontSize: '14px',
                              fontWeight: 'bold',
                              fontFamily: fontMono
                            }}>
                              {weekData.events.length} earnings
                            </span>
                            <motion.span
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              style={{ color: designColors.textSecondary }}
                            >
                              ▶
                            </motion.span>
                          </div>
                        </motion.button>

                        {/* Week Events */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{
                                background: 'rgba(18, 18, 26, 0.5)',
                                border: `1px solid ${designColors.borderDefault}`,
                                borderTop: 'none',
                                borderRadius: '0 0 12px 12px',
                                padding: '12px',
                                overflow: 'hidden'
                              }}
                            >
                              {weekData.events.map((event, eventIndex) => {
                                const hasPrediction = predictions.find(p => p.eventId === event.id);
                                const dayName = new Date(event.reportDate).toLocaleDateString('en-US', { weekday: 'short' });

                                return (
                                  <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: eventIndex * 0.03 }}
                                    onClick={() => !hasPrediction && !isLocked && handleSelectEvent(event)}
                                    whileHover={!hasPrediction && !isLocked ? { scale: 1.01 } : {}}
                                    whileTap={!hasPrediction && !isLocked ? { scale: 0.99 } : {}}
                                    style={{
                                      padding: '14px 16px',
                                      background: hasPrediction ? 'rgba(0, 217, 255, 0.1)' : designColors.bgCard,
                                      border: `1px solid ${hasPrediction ? designColors.cyan : designColors.borderDefault}`,
                                      borderRadius: '10px',
                                      marginBottom: '8px',
                                      cursor: hasPrediction || isLocked ? 'default' : 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{
                                          padding: '4px 8px',
                                          background: designColors.borderDefault,
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          color: designColors.textSecondary
                                        }}>
                                          {dayName}
                                        </span>
                                        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{event.symbol}</span>
                                        {event.sector && (
                                          <span style={{ fontSize: '12px', color: designColors.textMuted, textTransform: 'capitalize' }}>
                                            {event.sector}
                                          </span>
                                        )}
                                        {hasPrediction && (
                                          <span style={{
                                            padding: '3px 10px',
                                            background: hasPrediction.outcome === 'beat' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                            border: `1px solid ${hasPrediction.outcome === 'beat' ? designColors.green : designColors.red}`,
                                            borderRadius: '20px',
                                            fontSize: '11px',
                                            color: hasPrediction.outcome === 'beat' ? designColors.green : designColors.red
                                          }}>
                                            {hasPrediction.emoji} {hasPrediction.outcome.toUpperCase()} {hasPrediction.range}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ color: designColors.textSecondary, fontSize: '14px', fontFamily: fontMono }}>
                                          {event.beatProbability}% Beat
                                        </span>
                                        {hasPrediction ? (
                                          <span style={{ color: designColors.cyan, fontSize: '14px', fontWeight: 'bold', fontFamily: fontMono }}>
                                            ${hasPrediction.price.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span style={{ color: designColors.textMuted, fontSize: '13px' }}>
                                            Click to predict
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {event.reactionSummary && !hasPrediction && (
                                      <div style={{ marginTop: '10px', fontSize: '12px', color: designColors.textMuted }}>
                                        After beat: {event.reactionSummary.upAfterBeat}% up, {event.reactionSummary.flatAfterBeat}% flat, {event.reactionSummary.downAfterBeat}% down
                                      </div>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
              )}
            </motion.div>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <motion.div
              key="portfolio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
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
                    onClick={() => setActiveTab('calendar')}
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
            </motion.div>
          )}

          {/* Match Tab */}
          {activeTab === 'match' && (
            <motion.div
              key="match"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {!isLocked ? (
                <div style={{ textAlign: 'center', padding: '60px', color: designColors.textSecondary }}>
                  <p style={{ fontSize: '18px', marginBottom: '8px' }}>Build and lock your portfolio first</p>
                  <motion.button
                    onClick={() => setActiveTab('portfolio')}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Parlay Selection Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                background: designColors.bgCard,
                borderRadius: '16px',
                maxWidth: '500px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: `1px solid ${designColors.borderDefault}`
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '20px',
                borderBottom: `1px solid ${designColors.borderDefault}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{selectedEvent.symbol}</div>
                  <div style={{ fontSize: '14px', color: designColors.textSecondary }}>
                    {formatDate(selectedEvent.reportDate)} - {selectedEvent.beatProbability}% Beat Odds
                  </div>
                </div>
                <motion.button
                  onClick={closeModal}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{ background: 'none', border: 'none', color: designColors.textSecondary, fontSize: '24px', cursor: 'pointer' }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Step 1: Select Outcome */}
              <div style={{ padding: '20px', borderBottom: `1px solid ${designColors.borderDefault}` }}>
                <div style={{ fontSize: '14px', color: designColors.textSecondary, marginBottom: '12px' }}>
                  Step 1: Will {selectedEvent.symbol} beat earnings?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <motion.button
                    onClick={() => handleSelectOutcome('beat')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '16px',
                      background: selectedOutcome === 'beat' ? 'rgba(16,185,129,0.2)' : 'transparent',
                      border: `2px solid ${selectedOutcome === 'beat' ? designColors.green : designColors.borderDefault}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: designColors.green }}>BEAT</div>
                    <div style={{ fontSize: '14px', color: designColors.textSecondary, fontFamily: fontMono }}>
                      {selectedEvent.beatProbability}% odds
                    </div>
                  </motion.button>
                  <motion.button
                    onClick={() => handleSelectOutcome('miss')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '16px',
                      background: selectedOutcome === 'miss' ? 'rgba(239,68,68,0.2)' : 'transparent',
                      border: `2px solid ${selectedOutcome === 'miss' ? designColors.red : designColors.borderDefault}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: designColors.red }}>MISS</div>
                    <div style={{ fontSize: '14px', color: designColors.textSecondary, fontFamily: fontMono }}>
                      {100 - selectedEvent.beatProbability}% odds
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Step 2: Select Magnitude */}
              <AnimatePresence>
                {selectedOutcome && selectedEvent.parlays && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ padding: '20px', overflow: 'hidden' }}
                  >
                    <div style={{ fontSize: '14px', color: designColors.textSecondary, marginBottom: '8px' }}>
                      Step 2: How will the stock react after {selectedOutcome}ing?
                    </div>
                    {selectedEvent.reactionSummary && (
                      <div style={{ fontSize: '12px', color: designColors.textMuted, marginBottom: '16px' }}>
                        Historical: {selectedOutcome === 'beat'
                          ? `${selectedEvent.reactionSummary.upAfterBeat}% up, ${selectedEvent.reactionSummary.flatAfterBeat}% flat, ${selectedEvent.reactionSummary.downAfterBeat}% down`
                          : `${selectedEvent.reactionSummary.upAfterMiss}% up, ${selectedEvent.reactionSummary.flatAfterMiss}% flat, ${selectedEvent.reactionSummary.downAfterMiss}% down`
                        }
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedEvent.parlays
                        .filter(p => p.outcome === selectedOutcome)
                        .map((parlay, index) => {
                          const canAfford = parlay.price <= budgetRemaining;

                          return (
                            <motion.button
                              key={parlay.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => canAfford && handleAddParlay(parlay)}
                              disabled={!canAfford}
                              whileHover={canAfford ? { scale: 1.01, backgroundColor: 'rgba(255,255,255,0.05)' } : {}}
                              whileTap={canAfford ? { scale: 0.99 } : {}}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '14px 16px',
                                background: canAfford ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.3)',
                                border: `1px solid ${designColors.borderDefault}`,
                                borderRadius: '10px',
                                cursor: canAfford ? 'pointer' : 'not-allowed',
                                opacity: canAfford ? 1 : 0.5,
                                transition: 'all 0.2s'
                              }}
                            >
                              <div style={{ textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '20px' }}>{parlay.emoji}</span>
                                  <span style={{ fontWeight: 'bold', color: designColors.textPrimary }}>{parlay.range}</span>
                                  <span style={{
                                    padding: '2px 8px',
                                    background: parlay.risk.color + '22',
                                    color: parlay.risk.color,
                                    borderRadius: '10px',
                                    fontSize: '11px'
                                  }}>
                                    {parlay.risk.label}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: designColors.textMuted, marginTop: '4px' }}>
                                  {Math.round(parlay.combinedProb * 100)}% combined, {parlay.multiplier}x multiplier
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: designColors.textPrimary, fontFamily: fontMono }}>
                                  ${parlay.price.toLocaleString()}
                                </div>
                                <div style={{ fontSize: '13px', color: designColors.cyan, fontFamily: fontMono }}>
                                  {parlay.potentialPoints.toLocaleString()} pts
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EarningsGameScreen;
