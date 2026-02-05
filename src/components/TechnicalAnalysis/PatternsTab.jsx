// src/components/TechnicalAnalysis/PatternsTab.jsx
// Multi-Timeframe Confluence Detection Tab

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { detectConfluence } from '../../services/confluenceDetection';
import { getStrengthColor, getStrengthIcon } from './utils/colors';
import { LoadingState, EmptyState, ErrorState } from './shared';

const PatternsTab = ({
  ohlcvData,
  dailyAnchorData,
  dailyIndicators,
  selectedTimeframe,
  onTrackPattern,
}) => {
  const [confluences, setConfluences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ohlcvData?.length) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use daily anchor data if available, otherwise use the current timeframe data
      const anchorData = dailyAnchorData?.length ? dailyAnchorData : ohlcvData;
      const anchorIndicators = dailyIndicators || {};

      // Run confluence detection
      const detected = detectConfluence(
        ohlcvData,
        anchorData,
        anchorIndicators,
        selectedTimeframe
      );

      setConfluences(detected);
    } catch (err) {
      console.error('[PatternsTab] Detection failed:', err);
      setError('Failed to detect patterns. Please try again.');
      setConfluences([]);
    } finally {
      setIsLoading(false);
    }
  }, [ohlcvData, dailyAnchorData, dailyIndicators, selectedTimeframe]);

  const getBiasIcon = (bias) => {
    switch (bias) {
      case 'BULLISH': return '🟢';
      case 'BEARISH': return '🔴';
      default: return '⚪';
    }
  };

  // Pattern tracking state is managed via Firebase, not local state
  // This always returns false since local tracking was removed
  const isPatternTracked = () => false;

  if (isLoading) {
    return <LoadingState message="Detecting confluence zones..." />;
  }

  if (error) {
    return <ErrorState title="Detection Error" message={error} />;
  }

  if (confluences.length === 0) {
    return (
      <div style={styles.container}>
        <EmptyState
          icon="🔍"
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
      <div style={styles.header}>
        <h3 style={styles.title}>CONFLUENCE ZONES</h3>
        <span style={styles.subtitle}>
          Micro patterns ({selectedTimeframe.toUpperCase()}) aligning with macro levels (Daily)
        </span>
      </div>

      <div style={styles.confluenceList}>
        <AnimatePresence>
          {confluences.map((confluence, index) => (
            <motion.div
              key={confluence.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
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
              </div>

              {/* Macro Level */}
              <div style={styles.levelSection}>
                <div style={styles.sectionLabel}>MACRO (DAILY ANCHOR)</div>
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
              <AnimatePresence>
                {expandedId === confluence.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={styles.expandedSection}
                  >
                    <div style={styles.whyMatters}>
                      <div style={styles.whyTitle}>WHY THIS MATTERS</div>
                      <p style={styles.whyText}>{confluence.description}</p>
                    </div>

                    <div style={styles.historicalContext}>
                      <div style={styles.histTitle}>HISTORICAL CONTEXT</div>
                      <p style={styles.histText}>{confluence.historicalContext}</p>
                    </div>

                    <div style={styles.thesisHint}>
                      <span style={styles.thesisLabel}>Suggested thesis:</span>
                      <span style={styles.thesisValue}>
                        {confluence.suggestedThesis.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Track Button */}
              <button
                style={{
                  ...styles.trackButton,
                  opacity: isPatternTracked(confluence.id) ? 0.5 : 1,
                  cursor: isPatternTracked(confluence.id) ? 'default' : 'pointer',
                }}
                onClick={() => !isPatternTracked(confluence.id) && onTrackPattern?.({
                  ...confluence,
                  patternId: confluence.id,
                  patternType: 'CONFLUENCE_ZONE',
                  patternName: `${confluence.microPattern.name} at ${confluence.macroLevel.name}`,
                  zoneType: confluence.macroLevel.type,
                  priceLow: confluence.priceRange.low,
                  priceHigh: confluence.priceRange.high,
                  thesis: confluence.suggestedThesis,
                  indicators: [
                    { indicator: confluence.microPattern.name, value: confluence.microPattern.price },
                    { indicator: confluence.macroLevel.name, value: confluence.macroLevel.price },
                  ],
                  strength: confluence.strength,
                  description: confluence.description,
                  historicalContext: confluence.historicalContext,
                })}
                disabled={isPatternTracked(confluence.id)}
              >
                {isPatternTracked(confluence.id) ? '✓ Tracking' : '📊 Track This Pattern'}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={styles.disclaimer}>
        <span style={styles.disclaimerIcon}>ℹ️</span>
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
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: '12px',
  },
  loadingBar: {
    width: '100px',
    height: '3px',
    backgroundColor: '#00ffff',
    borderRadius: '2px',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  errorState: {
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 71, 87, 0.2)',
  },
  errorTitle: {
    color: '#ff4757',
    fontSize: '16px',
    margin: '0 0 8px 0',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: '16px',
    margin: '0 0 8px 0',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    margin: '0 0 16px 0',
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
