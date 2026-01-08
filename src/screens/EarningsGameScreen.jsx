/**
 * EarningsGameScreen.jsx
 *
 * Main screen for EarningsGame mode.
 * Follows the same pattern as DraftRoomScreen, ProfileScreen, etc.
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
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);

  // Constants
  const BUDGET = 10000;
  const MIN_PREDICTIONS = 3;
  const MAX_PREDICTIONS = 10;

  // Computed
  const totalSpent = useMemo(() => predictions.reduce((sum, p) => sum + p.cost, 0), [predictions]);
  const budgetRemaining = BUDGET - totalSpent;
  const isValid = predictions.length >= MIN_PREDICTIONS && totalSpent <= BUDGET;

  // Load data - fetch through Feb 9, 2026 (approximately 45 days)
  useEffect(() => {
    const loadData = async () => {
      try {
        const service = await import('../services/polymarketService');
        const data = await service.getUpcomingEarnings(45);
        setEvents(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = {};
    events.forEach(event => {
      if (!event.reportDate) return;
      const key = new Date(event.reportDate).toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    return grouped;
  }, [events]);

  // Group events by week
  const eventsByWeek = useMemo(() => {
    const grouped = {};

    events.forEach(event => {
      if (!event.reportDate) return;
      const date = new Date(event.reportDate);

      // Get the Monday of the week
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

    // Sort events within each week by date
    Object.values(grouped).forEach(week => {
      week.events.sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));
    });

    return grouped;
  }, [events]);

  // Handlers
  const handleAdd = (event, type) => {
    if (isLocked || predictions.find(p => p.eventId === event.id)) return;
    if (predictions.length >= MAX_PREDICTIONS) return;

    const cost = type === 'beat' ? event.yesCost : event.noCost;
    const odds = type === 'beat' ? event.yesOdds : event.noOdds;
    if (cost > budgetRemaining) return;

    let multiplier = 1.5;
    if (odds >= 0.90) multiplier = 1.1;
    else if (odds >= 0.70) multiplier = 1.3;
    else if (odds >= 0.50) multiplier = 1.5;
    else if (odds >= 0.30) multiplier = 2.0;
    else multiplier = 3.0;

    setPredictions(prev => [...prev, {
      eventId: event.id,
      symbol: event.symbol,
      prediction: type,
      cost,
      odds,
      multiplier,
      potentialPoints: Math.round(cost * multiplier)
    }]);
    setExpandedEvent(null);
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
    setActiveTab('calendar');
  };

  // Default colors
  const defaultColors = {
    background: '#0a0a0f',
    cardBg: '#12121a',
    border: '#21262d',
    cyan: '#00d9ff',
    ...colors
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: defaultColors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: defaultColors.cyan }}>Loading earnings data...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: defaultColors.background, color: '#fff' }}>
      {/* Header */}
      <div style={{ background: defaultColors.cardBg, borderBottom: `1px solid ${defaultColors.border}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '16px' }}>← Back</button>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: defaultColors.cyan, margin: 0 }}>EarningsGame</h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'rgba(18,18,26,0.5)', borderBottom: `1px solid ${defaultColors.border}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex' }}>
          {['calendar', 'builder', 'match'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '16px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${defaultColors.cyan}` : '2px solid transparent',
                color: activeTab === tab ? defaultColors.cyan : '#a0a0a0',
                cursor: 'pointer'
              }}
            >
              {tab === 'calendar' ? 'Calendar' : tab === 'builder' ? 'Portfolio' : 'Match'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div>
            <h2 style={{ color: defaultColors.cyan, marginBottom: '16px' }}>
              Earnings Season Calendar
            </h2>
            <p style={{ color: '#a0a0a0', marginBottom: '24px', fontSize: '14px' }}>
              Q4 2025 earnings season: January - February 2026
            </p>

            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#a0a0a0' }}>
                <p>No upcoming earnings markets found</p>
                <p style={{ fontSize: '14px' }}>Check back during earnings season</p>
                <a href="https://polymarket.com/earnings" target="_blank" rel="noopener noreferrer" style={{ color: defaultColors.cyan }}>View Polymarket</a>
              </div>
            ) : (
              <div>
                {Object.entries(eventsByWeek)
                  .sort(([a], [b]) => new Date(a) - new Date(b))
                  .map(([weekKey, weekData]) => {
                    const isExpanded = expandedWeek === weekKey;
                    const weekStart = new Date(weekData.weekStart);
                    const weekEnd = new Date(weekData.weekEnd);

                    const formatWeekDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
                            alignItems: 'center',
                            textAlign: 'left'
                          }}
                        >
                          <div>
                            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>
                              Week of {formatWeekDate(weekStart)}
                            </div>
                            <div style={{ color: '#a0a0a0', fontSize: '14px', marginTop: '4px' }}>
                              {formatWeekDate(weekStart)} - {formatWeekDate(weekEnd)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              padding: '4px 12px',
                              background: 'rgba(0, 217, 255, 0.1)',
                              borderRadius: '20px',
                              color: defaultColors.cyan,
                              fontSize: '14px',
                              fontWeight: 'bold'
                            }}>
                              {weekData.events.length} earnings
                            </div>
                            <span style={{ color: '#a0a0a0', fontSize: '20px' }}>
                              {isExpanded ? '▼' : '▶'}
                            </span>
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
                              const eventDate = new Date(event.reportDate);
                              const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'short' });
                              const hasPrediction = predictions.find(p => p.eventId === event.id);

                              return (
                                <div
                                  key={event.id}
                                  style={{
                                    padding: '12px 16px',
                                    background: hasPrediction
                                      ? 'rgba(0, 217, 255, 0.1)'
                                      : defaultColors.cardBg,
                                    border: `1px solid ${hasPrediction ? defaultColors.cyan : defaultColors.border}`,
                                    borderRadius: '8px',
                                    marginBottom: '8px'
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
                                      {hasPrediction && (
                                        <span style={{
                                          padding: '2px 8px',
                                          background: hasPrediction.prediction === 'beat' ? '#10b981' : '#ef4444',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          color: '#fff'
                                        }}>
                                          {hasPrediction.prediction.toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                      <span style={{ color: '#a0a0a0', fontSize: '14px' }}>
                                        {event.beatProbability}% Beat
                                      </span>
                                      <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                                        <span style={{ color: '#10b981' }}>${event.yesCost.toLocaleString()}</span>
                                        <span style={{ color: '#a0a0a0' }}> / </span>
                                        <span style={{ color: '#ef4444' }}>${event.noCost.toLocaleString()}</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Quick add buttons */}
                                  {!hasPrediction && !isLocked && expandedEvent === event.id && (
                                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleAdd(event, 'beat'); }}
                                        style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '8px', cursor: 'pointer' }}
                                      >
                                        <div style={{ color: '#10b981', fontWeight: 'bold' }}>BEAT ${event.yesCost.toLocaleString()}</div>
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleAdd(event, 'miss'); }}
                                        style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer' }}
                                      >
                                        <div style={{ color: '#ef4444', fontWeight: 'bold' }}>MISS ${event.noCost.toLocaleString()}</div>
                                      </button>
                                    </div>
                                  )}

                                  {/* Click to expand */}
                                  {!hasPrediction && !isLocked && expandedEvent !== event.id && (
                                    <button
                                      onClick={() => setExpandedEvent(event.id)}
                                      style={{
                                        marginTop: '8px',
                                        padding: '8px',
                                        width: '100%',
                                        background: 'transparent',
                                        border: `1px dashed ${defaultColors.border}`,
                                        borderRadius: '6px',
                                        color: '#a0a0a0',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                      }}
                                    >
                                      + Add Prediction
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {events.length > 0 && (
              <button
                onClick={() => setActiveTab('builder')}
                style={{
                  width: '100%',
                  padding: '16px',
                  marginTop: '24px',
                  background: defaultColors.cyan,
                  border: 'none',
                  borderRadius: '12px',
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Build Portfolio →
              </button>
            )}
          </div>
        )}

        {/* Builder Tab */}
        {activeTab === 'builder' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ color: defaultColors.cyan, margin: 0 }}>Build Portfolio</h2>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${budgetRemaining.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#a0a0a0' }}>of $10,000</div>
              </div>
            </div>

            {/* Budget bar */}
            <div style={{ height: '12px', background: '#21262d', borderRadius: '6px', marginBottom: '24px' }}>
              <div style={{ height: '100%', width: `${(totalSpent / BUDGET) * 100}%`, background: defaultColors.cyan, borderRadius: '6px' }} />
            </div>

            {/* Current picks */}
            {predictions.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: '#a0a0a0', fontSize: '14px', marginBottom: '12px' }}>Your Picks</h3>
                {predictions.map(p => (
                  <div key={p.eventId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: p.prediction === 'beat' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${p.prediction === 'beat' ? '#10b981' : '#ef4444'}`, borderRadius: '8px', marginBottom: '8px' }}>
                    <div>
                      <strong>{p.symbol}</strong>
                      <span style={{ marginLeft: '8px', padding: '2px 8px', background: p.prediction === 'beat' ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '12px' }}>{p.prediction.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div>${p.cost.toLocaleString()}</div>
                        <div style={{ fontSize: '12px', color: '#a0a0a0' }}>{p.multiplier}x = {p.potentialPoints.toLocaleString()} pts</div>
                      </div>
                      {!isLocked && <button onClick={() => handleRemove(p.eventId)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer' }}>X</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Available events */}
            <h3 style={{ color: '#a0a0a0', fontSize: '14px', marginBottom: '12px' }}>Available</h3>
            {events.filter(e => !predictions.find(p => p.eventId === e.id)).map(event => (
              <div key={event.id} style={{ padding: '16px', background: defaultColors.cardBg, border: `1px solid ${defaultColors.border}`, borderRadius: '12px', marginBottom: '8px' }}>
                <div onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>{event.symbol}</strong></div>
                  <div style={{ color: '#a0a0a0' }}>{event.beatProbability}% Beat</div>
                </div>
                {expandedEvent === event.id && !isLocked && (
                  <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button onClick={() => handleAdd(event, 'beat')} style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '8px', cursor: 'pointer' }}>
                      <div style={{ color: '#10b981', fontWeight: 'bold' }}>BEAT</div>
                      <div style={{ color: '#fff', fontSize: '18px' }}>${event.yesCost.toLocaleString()}</div>
                    </button>
                    <button onClick={() => handleAdd(event, 'miss')} style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer' }}>
                      <div style={{ color: '#ef4444', fontWeight: 'bold' }}>MISS</div>
                      <div style={{ color: '#fff', fontSize: '18px' }}>${event.noCost.toLocaleString()}</div>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Lock button */}
            {!isLocked && (
              <button onClick={handleLock} disabled={!isValid} style={{ width: '100%', padding: '16px', marginTop: '16px', background: isValid ? defaultColors.cyan : '#21262d', border: 'none', borderRadius: '12px', color: isValid ? '#000' : '#a0a0a0', fontWeight: 'bold', cursor: isValid ? 'pointer' : 'not-allowed' }}>
                {predictions.length < MIN_PREDICTIONS ? `Need ${MIN_PREDICTIONS - predictions.length} more picks` : 'Lock Portfolio'}
              </button>
            )}
            {isLocked && <div style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '12px', textAlign: 'center', color: '#10b981' }}>Portfolio Locked</div>}
          </div>
        )}

        {/* Match Tab */}
        {activeTab === 'match' && (
          <div>
            <h2 style={{ color: defaultColors.cyan, marginBottom: '16px' }}>Match</h2>
            {!isLocked ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#a0a0a0' }}>
                <p>Build and lock your portfolio first</p>
                <button onClick={() => setActiveTab('builder')} style={{ marginTop: '16px', padding: '12px 24px', background: defaultColors.cyan, border: 'none', borderRadius: '8px', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}>Build Portfolio</button>
              </div>
            ) : (
              <div>
                <div style={{ background: defaultColors.cardBg, borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ color: '#a0a0a0', marginBottom: '8px' }}>POTENTIAL POINTS</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: defaultColors.cyan }}>{predictions.reduce((sum, p) => sum + p.potentialPoints, 0).toLocaleString()}</div>
                </div>
                {predictions.map(p => (
                  <div key={p.eventId} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: defaultColors.cardBg, borderRadius: '8px', marginBottom: '8px' }}>
                    <div><strong>{p.symbol}</strong> <span style={{ color: p.prediction === 'beat' ? '#10b981' : '#ef4444' }}>{p.prediction.toUpperCase()}</span></div>
                    <div style={{ color: '#a0a0a0' }}>{p.potentialPoints.toLocaleString()} pts</div>
                  </div>
                ))}
                <button onClick={handleReset} style={{ width: '100%', padding: '12px', marginTop: '24px', background: 'none', border: `1px solid ${defaultColors.border}`, borderRadius: '8px', color: '#a0a0a0', cursor: 'pointer' }}>Reset & Start Over</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EarningsGameScreen;
