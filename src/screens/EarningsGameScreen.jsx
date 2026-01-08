/**
 * EarningsGameScreen.jsx
 *
 * Main screen for EarningsGame mode with parlay system.
 * Users select outcome (beat/miss) + magnitude (up big, up, flat, down, down big)
 */

import React, { useState, useEffect, useMemo } from 'react';

const EarningsGameScreen = ({
  user,
  onBack,
  setScreen,
  colors = {},
  isDesktop = false
}) => {
  // State
  const [events, setEvents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState(null);

  // Constants
  const BUDGET = 10000;
  const MIN_PREDICTIONS = 3;
  const MAX_PREDICTIONS = 10;

  // Computed
  const totalSpent = useMemo(() => predictions.reduce((sum, p) => sum + p.price, 0), [predictions]);
  const budgetRemaining = BUDGET - totalSpent;
  const totalPotentialPoints = useMemo(() => predictions.reduce((sum, p) => sum + p.potentialPoints, 0), [predictions]);
  const isValid = predictions.length >= MIN_PREDICTIONS && totalSpent <= BUDGET;

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const service = await import('../services/polymarketService');
        const data = await service.getUpcomingEarnings(45);
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
    if (isLocked || !selectedEvent) return;
    if (predictions.length >= MAX_PREDICTIONS) return;
    if (parlay.price > budgetRemaining) return;

    setPredictions(prev => [...prev, {
      eventId: selectedEvent.id,
      symbol: selectedEvent.symbol,
      companyName: selectedEvent.companyName,
      reportDate: selectedEvent.reportDate,
      parlayId: parlay.id,
      outcome: parlay.outcome,
      magnitude: parlay.magnitude,
      label: parlay.label,
      emoji: parlay.emoji,
      range: parlay.range,
      price: parlay.price,
      combinedProb: parlay.combinedProb,
      multiplier: parlay.multiplier,
      potentialPoints: parlay.potentialPoints,
      risk: parlay.risk,
      beatOdds: selectedEvent.yesOdds,
      sector: selectedEvent.sector
    }]);

    setSelectedEvent(null);
    setSelectedOutcome(null);
  };

  const handleRemove = (eventId) => {
    if (isLocked) return;
    setPredictions(prev => prev.filter(p => p.eventId !== eventId));
  };

  const handleLock = () => {
    if (isValid) {
      setIsLocked(true);
      setActiveTab('match');
    }
  };

  const handleReset = () => {
    setPredictions([]);
    setIsLocked(false);
    setSelectedEvent(null);
    setSelectedOutcome(null);
    setActiveTab('calendar');
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

  // Default colors
  const defaultColors = {
    background: '#0a0a0f',
    cardBg: '#12121a',
    border: '#21262d',
    cyan: '#00d9ff',
    ...colors
  };

  // Loading
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: defaultColors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: defaultColors.cyan, fontSize: '18px' }}>Loading earnings data...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: defaultColors.background, color: '#fff' }}>
      {/* Header */}
      <div style={{ background: defaultColors.cardBg, borderBottom: `1px solid ${defaultColors.border}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '16px' }}>← Back</button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: defaultColors.cyan, margin: 0 }}>EarningsGame</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>${budgetRemaining.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#a0a0a0' }}>remaining</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'rgba(18,18,26,0.5)', borderBottom: `1px solid ${defaultColors.border}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex' }}>
          {[
            { id: 'calendar', label: 'Calendar' },
            { id: 'portfolio', label: `Portfolio (${predictions.length})` },
            { id: 'match', label: 'Match' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${defaultColors.cyan}` : '2px solid transparent',
                color: activeTab === tab.id ? defaultColors.cyan : '#a0a0a0',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ color: defaultColors.cyan, margin: '0 0 8px 0' }}>Earnings Season Calendar</h2>
              <p style={{ color: '#a0a0a0', margin: 0, fontSize: '14px' }}>
                Select an earnings event to build your parlay prediction
              </p>
            </div>

            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#a0a0a0' }}>
                <p style={{ fontSize: '18px' }}>No upcoming earnings markets found</p>
                <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" style={{ color: defaultColors.cyan }}>View Polymarket</a>
              </div>
            ) : (
              Object.entries(eventsByWeek)
                .sort(([a], [b]) => new Date(a) - new Date(b))
                .map(([weekKey, weekData]) => {
                  const isExpanded = expandedWeek === weekKey;

                  return (
                    <div key={weekKey} style={{ marginBottom: '12px' }}>
                      {/* Week Header */}
                      <button
                        onClick={() => setExpandedWeek(isExpanded ? null : weekKey)}
                        style={{
                          width: '100%',
                          padding: '16px 20px',
                          background: defaultColors.cardBg,
                          border: `1px solid ${defaultColors.border}`,
                          borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>Week of {formatDate(weekData.weekStart)}</div>
                          <div style={{ color: '#a0a0a0', fontSize: '13px' }}>{formatWeekRange(weekData.weekStart, weekData.weekEnd)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            padding: '4px 12px',
                            background: 'rgba(0, 217, 255, 0.1)',
                            borderRadius: '20px',
                            color: defaultColors.cyan,
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {weekData.events.length} earnings
                          </span>
                          <span style={{ color: '#a0a0a0' }}>{isExpanded ? '▼' : '▶'}</span>
                        </div>
                      </button>

                      {/* Week Events */}
                      {isExpanded && (
                        <div style={{
                          background: 'rgba(18, 18, 26, 0.5)',
                          border: `1px solid ${defaultColors.border}`,
                          borderTop: 'none',
                          borderRadius: '0 0 12px 12px',
                          padding: '12px'
                        }}>
                          {weekData.events.map(event => {
                            const hasPrediction = predictions.find(p => p.eventId === event.id);
                            const dayName = new Date(event.reportDate).toLocaleDateString('en-US', { weekday: 'short' });

                            return (
                              <div
                                key={event.id}
                                onClick={() => !hasPrediction && !isLocked && handleSelectEvent(event)}
                                style={{
                                  padding: '14px 16px',
                                  background: hasPrediction ? 'rgba(0, 217, 255, 0.1)' : defaultColors.cardBg,
                                  border: `1px solid ${hasPrediction ? defaultColors.cyan : defaultColors.border}`,
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
                                      background: defaultColors.border,
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      color: '#a0a0a0'
                                    }}>
                                      {dayName}
                                    </span>
                                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{event.symbol}</span>
                                    {event.sector && (
                                      <span style={{ fontSize: '12px', color: '#666', textTransform: 'capitalize' }}>
                                        {event.sector}
                                      </span>
                                    )}
                                    {hasPrediction && (
                                      <span style={{
                                        padding: '3px 10px',
                                        background: hasPrediction.outcome === 'beat' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                        border: `1px solid ${hasPrediction.outcome === 'beat' ? '#10b981' : '#ef4444'}`,
                                        borderRadius: '20px',
                                        fontSize: '11px',
                                        color: hasPrediction.outcome === 'beat' ? '#10b981' : '#ef4444'
                                      }}>
                                        {hasPrediction.emoji} {hasPrediction.outcome.toUpperCase()} {hasPrediction.range}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span style={{ color: '#a0a0a0', fontSize: '14px' }}>
                                      {event.beatProbability}% Beat
                                    </span>
                                    {hasPrediction ? (
                                      <span style={{ color: defaultColors.cyan, fontSize: '14px', fontWeight: 'bold' }}>
                                        ${hasPrediction.price.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#666', fontSize: '13px' }}>
                                        Click to predict
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {event.reactionSummary && !hasPrediction && (
                                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                                    After beat: {event.reactionSummary.upAfterBeat}% up, {event.reactionSummary.flatAfterBeat}% flat, {event.reactionSummary.downAfterBeat}% down
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div>
            {/* Budget Summary */}
            <div style={{
              background: defaultColors.cardBg,
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#a0a0a0' }}>Budget Remaining</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${budgetRemaining.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', color: '#a0a0a0' }}>Potential Points</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: defaultColors.cyan }}>
                    {totalPotentialPoints.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Budget Bar */}
              <div style={{ height: '8px', background: '#21262d', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(totalSpent / BUDGET) * 100}%`,
                  background: budgetRemaining < 0 ? '#ef4444' : defaultColors.cyan,
                  borderRadius: '4px',
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', color: '#a0a0a0' }}>
                <span>{predictions.length} / {MAX_PREDICTIONS} predictions</span>
                <span>${totalSpent.toLocaleString()} / $10,000 spent</span>
              </div>
            </div>

            {/* Predictions List */}
            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#a0a0a0' }}>
                <p style={{ fontSize: '18px', marginBottom: '8px' }}>No predictions yet</p>
                <p style={{ fontSize: '14px' }}>Go to Calendar to add predictions</p>
                <button
                  onClick={() => setActiveTab('calendar')}
                  style={{
                    marginTop: '16px',
                    padding: '12px 24px',
                    background: defaultColors.cyan,
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Browse Calendar
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ color: '#a0a0a0', fontSize: '14px', marginBottom: '12px', fontWeight: '600' }}>
                  Your Predictions
                </h3>
                {predictions.map(pred => (
                  <div
                    key={pred.eventId}
                    style={{
                      padding: '16px',
                      background: defaultColors.cardBg,
                      border: `1px solid ${defaultColors.border}`,
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
                            border: `1px solid ${pred.outcome === 'beat' ? '#10b981' : '#ef4444'}`,
                            borderRadius: '20px',
                            fontSize: '12px',
                            color: pred.outcome === 'beat' ? '#10b981' : '#ef4444',
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
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {Math.round(pred.combinedProb * 100)}% probability, {pred.multiplier}x multiplier
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>${pred.price.toLocaleString()}</div>
                        <div style={{ fontSize: '13px', color: defaultColors.cyan }}>
                          {pred.potentialPoints.toLocaleString()} pts
                        </div>
                        {!isLocked && (
                          <button
                            onClick={() => handleRemove(pred.eventId)}
                            style={{
                              marginTop: '8px',
                              padding: '4px 12px',
                              background: 'transparent',
                              border: '1px solid #ef4444',
                              borderRadius: '6px',
                              color: '#ef4444',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Lock Button */}
                {!isLocked && (
                  <button
                    onClick={handleLock}
                    disabled={!isValid}
                    style={{
                      width: '100%',
                      padding: '16px',
                      marginTop: '16px',
                      background: isValid ? defaultColors.cyan : '#21262d',
                      border: 'none',
                      borderRadius: '12px',
                      color: isValid ? '#000' : '#666',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: isValid ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {predictions.length < MIN_PREDICTIONS
                      ? `Need ${MIN_PREDICTIONS - predictions.length} more prediction${MIN_PREDICTIONS - predictions.length > 1 ? 's' : ''}`
                      : 'Lock Portfolio'
                    }
                  </button>
                )}

                {isLocked && (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid #10b981',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: '#10b981',
                    marginTop: '16px'
                  }}>
                    Portfolio Locked - Good luck!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Match Tab */}
        {activeTab === 'match' && (
          <div>
            {!isLocked ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#a0a0a0' }}>
                <p style={{ fontSize: '18px', marginBottom: '8px' }}>Build and lock your portfolio first</p>
                <button
                  onClick={() => setActiveTab('portfolio')}
                  style={{
                    marginTop: '16px',
                    padding: '12px 24px',
                    background: defaultColors.cyan,
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  View Portfolio
                </button>
              </div>
            ) : (
              <div>
                {/* Score Card */}
                <div style={{
                  background: `linear-gradient(135deg, ${defaultColors.cardBg} 0%, rgba(0,217,255,0.1) 100%)`,
                  borderRadius: '16px',
                  padding: '32px',
                  textAlign: 'center',
                  marginBottom: '24px',
                  border: `1px solid ${defaultColors.cyan}33`
                }}>
                  <div style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '8px' }}>POTENTIAL POINTS</div>
                  <div style={{ fontSize: '48px', fontWeight: 'bold', color: defaultColors.cyan }}>
                    {totalPotentialPoints.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '14px', color: '#a0a0a0', marginTop: '8px' }}>
                    {predictions.length} predictions, ${totalSpent.toLocaleString()} invested
                  </div>
                </div>

                {/* Predictions Summary */}
                <h3 style={{ color: '#a0a0a0', fontSize: '14px', marginBottom: '12px' }}>Your Locked Predictions</h3>
                {predictions.map(pred => (
                  <div
                    key={pred.eventId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      background: defaultColors.cardBg,
                      borderRadius: '10px',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>{pred.symbol}</span>
                      <span style={{ color: pred.outcome === 'beat' ? '#10b981' : '#ef4444', fontSize: '13px' }}>
                        {pred.outcome.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '13px' }}>{pred.emoji} {pred.range}</span>
                    </div>
                    <div style={{ color: '#a0a0a0', fontSize: '14px' }}>
                      {pred.potentialPoints.toLocaleString()} pts
                    </div>
                  </div>
                ))}

                {/* Reset */}
                <button
                  onClick={handleReset}
                  style={{
                    width: '100%',
                    padding: '14px',
                    marginTop: '24px',
                    background: 'transparent',
                    border: `1px solid ${defaultColors.border}`,
                    borderRadius: '10px',
                    color: '#a0a0a0',
                    cursor: 'pointer'
                  }}
                >
                  Reset & Start Over
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Parlay Selection Modal */}
      {selectedEvent && (
        <div
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
          <div
            style={{
              background: defaultColors.cardBg,
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: `1px solid ${defaultColors.border}`
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: `1px solid ${defaultColors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{selectedEvent.symbol}</div>
                <div style={{ fontSize: '14px', color: '#a0a0a0' }}>
                  {formatDate(selectedEvent.reportDate)} - {selectedEvent.beatProbability}% Beat Odds
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', color: '#a0a0a0', fontSize: '24px', cursor: 'pointer' }}
              >
                X
              </button>
            </div>

            {/* Step 1: Select Outcome */}
            <div style={{ padding: '20px', borderBottom: `1px solid ${defaultColors.border}` }}>
              <div style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '12px' }}>
                Step 1: Will {selectedEvent.symbol} beat earnings?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => handleSelectOutcome('beat')}
                  style={{
                    padding: '16px',
                    background: selectedOutcome === 'beat' ? 'rgba(16,185,129,0.2)' : 'transparent',
                    border: `2px solid ${selectedOutcome === 'beat' ? '#10b981' : defaultColors.border}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>BEAT</div>
                  <div style={{ fontSize: '14px', color: '#a0a0a0' }}>{selectedEvent.beatProbability}% odds</div>
                </button>
                <button
                  onClick={() => handleSelectOutcome('miss')}
                  style={{
                    padding: '16px',
                    background: selectedOutcome === 'miss' ? 'rgba(239,68,68,0.2)' : 'transparent',
                    border: `2px solid ${selectedOutcome === 'miss' ? '#ef4444' : defaultColors.border}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>MISS</div>
                  <div style={{ fontSize: '14px', color: '#a0a0a0' }}>{100 - selectedEvent.beatProbability}% odds</div>
                </button>
              </div>
            </div>

            {/* Step 2: Select Magnitude */}
            {selectedOutcome && selectedEvent.parlays && (
              <div style={{ padding: '20px' }}>
                <div style={{ fontSize: '14px', color: '#a0a0a0', marginBottom: '8px' }}>
                  Step 2: How will the stock react after {selectedOutcome}ing?
                </div>
                {selectedEvent.reactionSummary && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                    Historical: {selectedOutcome === 'beat'
                      ? `${selectedEvent.reactionSummary.upAfterBeat}% up, ${selectedEvent.reactionSummary.flatAfterBeat}% flat, ${selectedEvent.reactionSummary.downAfterBeat}% down`
                      : `${selectedEvent.reactionSummary.upAfterMiss}% up, ${selectedEvent.reactionSummary.flatAfterMiss}% flat, ${selectedEvent.reactionSummary.downAfterMiss}% down`
                    }
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedEvent.parlays
                    .filter(p => p.outcome === selectedOutcome)
                    .map(parlay => {
                      const canAfford = parlay.price <= budgetRemaining;

                      return (
                        <button
                          key={parlay.id}
                          onClick={() => canAfford && handleAddParlay(parlay)}
                          disabled={!canAfford}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '14px 16px',
                            background: canAfford ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${defaultColors.border}`,
                            borderRadius: '10px',
                            cursor: canAfford ? 'pointer' : 'not-allowed',
                            opacity: canAfford ? 1 : 0.5,
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '20px' }}>{parlay.emoji}</span>
                              <span style={{ fontWeight: 'bold', color: '#fff' }}>{parlay.range}</span>
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
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                              {Math.round(parlay.combinedProb * 100)}% combined, {parlay.multiplier}x multiplier
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>${parlay.price.toLocaleString()}</div>
                            <div style={{ fontSize: '13px', color: defaultColors.cyan }}>
                              {parlay.potentialPoints.toLocaleString()} pts
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EarningsGameScreen;
