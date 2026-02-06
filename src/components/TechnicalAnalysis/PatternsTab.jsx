// src/components/TechnicalAnalysis/PatternsTab.jsx
// Multi-Timeframe Confluence Detection Tab with Pattern Tracking

import React, { useState, useEffect } from 'react';
import { detectConfluence } from '../../services/confluenceDetection';
import { saveTrackedPattern, updatePatternStatus } from '../../firebase/firebaseService';
import { getStrengthColor, getStrengthIcon, getRVOLTierColor } from './utils/colors';
import { LoadingState, EmptyState, ErrorState } from './shared';
import PatternHistory from './PatternHistory';

const PatternsTab = ({
  ohlcvData,
  dailyAnchorData,
  dailyIndicators,
  calculatedIndicators,
  selectedTimeframe,
  onTrackPattern,
  rvolData,
  userId,
  showToast,
  trackedPatterns,
  onPatternTracked,
  ticker,
}) => {
  const [confluences, setConfluences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);
  const [subTab, setSubTab] = useState('zones');
  const [trackingInProgress, setTrackingInProgress] = useState(new Set());

  useEffect(() => {
    if (!ohlcvData?.length) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // For weekly: use weekly data + weekly indicators as macro anchor
      const isWeekly = selectedTimeframe === '1w';
      const anchorData = isWeekly ? ohlcvData : (dailyAnchorData?.length ? dailyAnchorData : ohlcvData);
      const anchorIndicators = isWeekly ? (calculatedIndicators || {}) : (dailyIndicators || {});

      const detected = detectConfluence(
        ohlcvData,
        anchorData,
        anchorIndicators,
        selectedTimeframe,
        rvolData
      );

      setConfluences(detected);
    } catch (err) {
      console.error('[PatternsTab] Detection failed:', err);
      setError('Failed to detect patterns. Please try again.');
      setConfluences([]);
    } finally {
      setIsLoading(false);
    }
  }, [ohlcvData, dailyAnchorData, dailyIndicators, selectedTimeframe, rvolData]);

  const getBiasIcon = (bias) => {
    switch (bias) {
      case 'BULLISH': return '\uD83D\uDFE2';
      case 'BEARISH': return '\uD83D\uDD34';
      default: return '\u26AA';
    }
  };

  // Check if a confluence zone is already tracked
  const isPatternTracked = (confluence) => {
    if (!trackedPatterns || !ticker) return false;
    const patternName = `${confluence.microPattern.name} at ${confluence.macroLevel.name}`;
    return trackedPatterns.some(p =>
      p.ticker === ticker &&
      p.patternName === patternName &&
      ['WAITING', 'TESTING'].includes(p.status)
    );
  };

  const isInProgress = (confluenceId) => trackingInProgress.has(confluenceId);

  // Instant 2-click tracking
  const handleInstantTrack = async (confluence) => {
    if (!userId) {
      showToast?.('Please sign in to track patterns', 'error');
      return;
    }

    const patternName = `${confluence.microPattern.name} at ${confluence.macroLevel.name}`;

    // Optimistic UI: mark as in-progress immediately
    setTrackingInProgress(prev => new Set(prev).add(confluence.id));

    try {
      await saveTrackedPattern(userId, {
        ticker,
        patternType: 'CONFLUENCE_ZONE',
        patternName,
        zoneType: confluence.macroLevel.type,
        priceLow: confluence.priceRange.low,
        priceHigh: confluence.priceRange.high,
        thesis: confluence.suggestedThesis,
        trackingDuration: 14,
        priceAtCreation: ohlcvData?.[0]?.close,
        indicators: [
          { indicator: confluence.microPattern.name, value: confluence.microPattern.price },
          { indicator: confluence.macroLevel.name, value: confluence.macroLevel.price },
        ],
        confluenceStrength: confluence.strength,
        description: confluence.description,
        historicalContext: confluence.historicalContext,
      });

      showToast?.('Pattern tracked! Check back in 2 weeks.', 'success');
      onPatternTracked?.();
    } catch (err) {
      console.error('[PatternsTab] Failed to track:', err);
      showToast?.('Failed to track pattern', 'error');
      setTrackingInProgress(prev => {
        const next = new Set(prev);
        next.delete(confluence.id);
        return next;
      });
    }
  };

  // Resolve expired patterns from history
  const handleResolvePattern = async (patternId, updates) => {
    try {
      await updatePatternStatus(patternId, updates);
      onPatternTracked?.();
    } catch (err) {
      console.error('[PatternsTab] Failed to resolve:', err);
    }
  };

  // Filter tracked patterns for current ticker
  const tickerPatterns = (trackedPatterns || []).filter(p => p.ticker === ticker);

  // Pill toggle
  const renderSubTabToggle = () => (
    <div style={styles.pillToggle}>
      <button
        style={{ ...styles.pillButton, ...(subTab === 'zones' ? styles.pillActive : {}) }}
        onClick={() => setSubTab('zones')}
      >
        Confluence Zones
      </button>
      <button
        style={{ ...styles.pillButton, ...(subTab === 'history' ? styles.pillActive : {}) }}
        onClick={() => setSubTab('history')}
      >
        Pattern History {tickerPatterns.length > 0 ? `(${tickerPatterns.length})` : ''}
      </button>
    </div>
  );

  // Pattern History sub-tab
  if (subTab === 'history') {
    return (
      <div style={styles.container}>
        {renderSubTabToggle()}
        <PatternHistory
          patterns={tickerPatterns}
          currentPrice={ohlcvData?.[0]?.close}
          onResolve={handleResolvePattern}
        />
      </div>
    );
  }

  // Confluence Zones sub-tab (existing behavior)
  if (isLoading) {
    return (
      <div style={styles.container}>
        {renderSubTabToggle()}
        <LoadingState message="Detecting confluence zones..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        {renderSubTabToggle()}
        <ErrorState title="Detection Error" message={error} />
      </div>
    );
  }

  if (confluences.length === 0) {
    return (
      <div style={styles.container}>
        {renderSubTabToggle()}
        <EmptyState
          icon="\uD83D\uDD0D"
          title="No Confluence Detected"
          message="No significant pattern + level alignments found on the current timeframe. Try switching timeframes or check back later."
        />
        <div style={styles.emptyHint}>
          <strong>What is confluence?</strong><br/>
          When short-term patterns (like double bottoms, engulfing candles) align
          with longer-term levels (like the 50-day SMA), it creates a high-probability
          reaction zone.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {renderSubTabToggle()}

      <div style={styles.header}>
        <h3 style={styles.title}>CONFLUENCE ZONES</h3>
        <span style={styles.subtitle}>
          Micro patterns ({selectedTimeframe.toUpperCase()}) aligning with macro levels ({selectedTimeframe === '1w' ? 'Weekly' : 'Daily'})
        </span>
      </div>

      {/* RVOL Context Banner */}
      {rvolData && rvolData.value !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          marginBottom: '12px',
          backgroundColor: rvolData.isClimax
            ? 'rgba(255, 170, 0, 0.1)'
            : 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          border: `1px solid ${getRVOLTierColor(rvolData.tier)}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>
              RVOL
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: getRVOLTierColor(rvolData.tier),
            }}>
              {rvolData.value}x
            </span>
          </div>
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: `${getRVOLTierColor(rvolData.tier)}20`,
            color: getRVOLTierColor(rvolData.tier),
            fontWeight: 500,
          }}>
            {rvolData.tier}{rvolData.isClimax ? ' \u26A0\uFE0F' : ''}
          </span>
        </div>
      )}

      <div style={styles.confluenceList}>
        {confluences.map((confluence) => {
          const tracked = isPatternTracked(confluence);
          const saving = isInProgress(confluence.id);

          return (
            <div
              key={confluence.id}
              style={{
                ...styles.confluenceCard,
                borderColor: getStrengthColor(confluence.strength),
              }}
            >
                {/* Header */}
                <div
                  style={styles.cardHeader}
                  onClick={() => setExpandedId(expandedId === confluence.id ? null : confluence.id)}
                >
                  <div style={styles.headerLeft}>
                    <span style={{
                      ...styles.strengthBadge,
                      backgroundColor: getStrengthColor(confluence.strength) + '20',
                      color: getStrengthColor(confluence.strength),
                    }}>
                      {getStrengthIcon(confluence.strength)} {confluence.strength}
                    </span>
                    <span style={{
                      ...styles.levelType,
                      color: confluence.macroLevel.type === 'SUPPORT' ? '#00ff88' : '#ff6b6b',
                    }}>
                      {confluence.macroLevel.type}
                    </span>
                  </div>
                  <div style={styles.priceRange}>
                    ${confluence.priceRange.low.toFixed(2)} - ${confluence.priceRange.high.toFixed(2)}
                  </div>
                </div>

                {/* Micro Pattern */}
                <div style={styles.patternSection}>
                  <div style={styles.sectionLabel}>
                    MICRO ({confluence.microPattern.timeframe.toUpperCase()})
                  </div>
                  <div style={styles.patternRow}>
                    <span style={styles.biasIcon}>{getBiasIcon(confluence.microPattern.bias)}</span>
                    <span style={styles.patternName}>{confluence.microPattern.name}</span>
                  </div>
                  <div style={styles.patternDesc}>{confluence.microPattern.description}</div>

                  {/* Quality Metadata Badges */}
                  {confluence.microPattern.quality && (
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {confluence.microPattern.quality.qualityNote && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: confluence.microPattern.quality.isStrong
                            ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          color: confluence.microPattern.quality.isStrong
                            ? '#00ff88' : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${confluence.microPattern.quality.isStrong
                            ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                          {confluence.microPattern.quality.qualityNote}
                        </span>
                      )}
                      {confluence.microPattern.quality.volumeContext && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 204, 0, 0.1)',
                          color: '#ffcc00',
                          border: '1px solid rgba(255, 204, 0, 0.2)',
                        }}>
                          {confluence.microPattern.quality.volumeContext}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Macro Level */}
                <div style={styles.levelSection}>
                  <div style={styles.sectionLabel}>MACRO ({selectedTimeframe === '1w' ? 'WEEKLY' : 'DAILY'} ANCHOR)</div>
                  <div style={styles.levelName}>{confluence.macroLevel.name}</div>
                  <div style={styles.levelPrice}>${confluence.macroLevel.price.toFixed(2)}</div>
                </div>

                {/* Distance indicator */}
                <div style={styles.distanceBar}>
                  <span style={styles.distanceLabel}>
                    {parseFloat(confluence.distanceFromCurrent) > 0 ? 'Above' : 'Below'} current price by
                  </span>
                  <span style={{
                    ...styles.distanceValue,
                    color: Math.abs(parseFloat(confluence.distanceFromCurrent)) < 1 ? '#00ff88' : '#fff',
                  }}>
                    {Math.abs(parseFloat(confluence.distanceFromCurrent)).toFixed(2)}%
                  </span>
                </div>

                {/* Expanded Details */}
                {expandedId === confluence.id && (
                  <div style={styles.expandedSection}>
                    <div style={styles.whyMatters}>
                      <div style={styles.whyTitle}>WHY THIS MATTERS</div>
                      <p style={styles.whyText}>{confluence.description}</p>
                    </div>

                    <div style={styles.historicalContext}>
                      <div style={styles.histTitle}>HISTORICAL CONTEXT</div>
                      <p style={styles.histText}>{confluence.historicalContext}</p>
                    </div>

                    {/* Pattern Quality Detail */}
                    {confluence.microPattern.quality && (
                      confluence.microPattern.quality.bodyRatio !== null ||
                      confluence.microPattern.quality.shadowRatio !== null
                    ) && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.4)',
                          letterSpacing: '0.5px',
                          marginBottom: '6px',
                        }}>
                          PATTERN QUALITY
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {confluence.microPattern.quality.bodyRatio !== null && (
                            <div>
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Body Ratio: </span>
                              <span style={{ fontSize: '12px', color: '#fff' }}>
                                {confluence.microPattern.quality.bodyRatio}x
                              </span>
                            </div>
                          )}
                          {confluence.microPattern.quality.shadowRatio !== null && (
                            <div>
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Shadow Ratio: </span>
                              <span style={{ fontSize: '12px', color: '#fff' }}>
                                {confluence.microPattern.quality.shadowRatio}:1
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={styles.thesisHint}>
                      <span style={styles.thesisLabel}>Suggested thesis:</span>
                      <span style={styles.thesisValue}>
                        {confluence.suggestedThesis.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Track Button — 2-click instant flow */}
                <button
                  style={{
                    ...styles.trackButton,
                    ...(tracked || saving ? {
                      backgroundColor: 'rgba(0, 255, 136, 0.15)',
                      borderTopColor: 'rgba(0, 255, 136, 0.3)',
                      color: '#00ff88',
                      cursor: 'default',
                    } : {}),
                  }}
                  onClick={() => !tracked && !saving && handleInstantTrack(confluence)}
                  disabled={tracked || saving}
                >
                  {tracked ? '\u2713 Tracking' : saving ? 'Saving...' : '\uD83D\uDCCA Track This Pattern'}
                </button>
            </div>
          );
        })}
      </div>

      <div style={styles.disclaimer}>
        <span style={styles.disclaimerIcon}>{'\u2139\uFE0F'}</span>
        <span>
          Confluence detection identifies technical patterns for educational purposes.
          Past patterns do not guarantee future results.
        </span>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '0',
  },
  pillToggle: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  pillButton: {
    flex: 1,
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.5)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  pillActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    border: '1px solid rgba(0, 255, 255, 0.4)',
    color: '#00ffff',
  },
  header: {
    marginBottom: '16px',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '1px',
    margin: 0,
  },
  subtitle: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.3)',
  },
  emptyHint: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    padding: '12px',
    backgroundColor: 'rgba(0,255,255,0.05)',
    borderRadius: '8px',
    textAlign: 'left',
    lineHeight: '1.5',
  },
  confluenceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  confluenceCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '12px',
    border: '1px solid',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  strengthBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  },
  levelType: {
    fontSize: '12px',
    fontWeight: 600,
  },
  priceRange: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#00ffff',
  },
  patternSection: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  levelSection: {
    padding: '12px 16px',
  },
  sectionLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  patternRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  biasIcon: {
    fontSize: '12px',
  },
  patternName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  patternDesc: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '2px',
  },
  levelName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
  },
  levelPrice: {
    fontSize: '13px',
    color: '#00ffff',
    marginTop: '2px',
  },
  distanceBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  distanceLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
  },
  distanceValue: {
    fontSize: '13px',
    fontWeight: 600,
  },
  expandedSection: {
    padding: '16px',
    backgroundColor: 'rgba(0,255,255,0.03)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  whyMatters: {
    marginBottom: '12px',
  },
  whyTitle: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  whyText: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: '1.5',
    margin: 0,
  },
  historicalContext: {
    marginBottom: '12px',
  },
  histTitle: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  histText: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: '1.5',
    margin: 0,
    fontStyle: 'italic',
  },
  thesisHint: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: '6px',
  },
  thesisLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
  },
  thesisValue: {
    fontSize: '12px',
    color: '#00ffff',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  trackButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    border: 'none',
    borderTop: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '0 0 11px 11px',
    color: '#00ffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  disclaimer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginTop: '20px',
    padding: '12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
  },
  disclaimerIcon: {
    flexShrink: 0,
  },
};

export default PatternsTab;
