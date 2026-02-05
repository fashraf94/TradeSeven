// src/components/TechnicalAnalysis/LevelsTab.jsx
// Levels tab with quality S/R levels and explanations

import React, { useState, useEffect } from 'react';
import detectLevels from '../../services/levelDetection';
import { getStrengthColor } from './utils/colors';

const LevelsTab = ({
  dailyData,
  indicators,
  onToggleChartOverlay,
  chartOverlayEnabled = false,
}) => {
  const [levels, setLevels] = useState({ support: [], resistance: [], currentPrice: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLevel, setExpandedLevel] = useState(null);

  useEffect(() => {
    if (!dailyData?.length) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Small delay to show loading state
    const timer = setTimeout(() => {
      const detected = detectLevels(dailyData, indicators);
      setLevels(detected);
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [dailyData, indicators]);

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.loadingBar}>
            <div style={styles.loadingProgress} />
          </div>
          <span style={styles.loadingText}>Analyzing key levels...</span>
        </div>
      </div>
    );
  }

  const hasLevels = levels.support.length > 0 || levels.resistance.length > 0;

  if (!hasLevels) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>&#128202;</span>
          <h3 style={styles.emptyTitle}>Insufficient Confluence</h3>
          <p style={styles.emptyText}>
            No high-quality support/resistance levels detected. Quality levels require
            at least 2 technical factors aligning at the same price zone.
          </p>
          <p style={styles.emptySubtext}>
            Try checking with more price history or during periods of stronger technical structure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Chart Overlay Toggle */}
      <div style={styles.overlayToggle}>
        <span style={styles.overlayLabel}>Show on chart</span>
        <button
          style={{
            ...styles.toggleButton,
            backgroundColor: chartOverlayEnabled ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            borderColor: chartOverlayEnabled ? '#00ff88' : 'rgba(255, 255, 255, 0.2)',
          }}
          onClick={() => onToggleChartOverlay?.(!chartOverlayEnabled)}
        >
          {chartOverlayEnabled ? '&#10003; ON' : 'OFF'}
        </button>
      </div>

      {/* Current Price */}
      <div style={styles.currentPriceBar}>
        <span style={styles.currentLabel}>Current Price</span>
        <span style={styles.currentPrice}>${levels.currentPrice?.toFixed(2)}</span>
      </div>

      {/* Resistance Levels */}
      {levels.resistance.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.resistanceIcon}>&#128308;</span> RESISTANCE ZONES
          </h3>

          {levels.resistance.map((level, index) => (
            <LevelCard
              key={`res-${index}`}
              level={level}
              type="RESISTANCE"
              isExpanded={expandedLevel === `res-${index}`}
              onToggle={() => setExpandedLevel(
                expandedLevel === `res-${index}` ? null : `res-${index}`
              )}
              getStrengthColor={getStrengthColor}
            />
          ))}
        </div>
      )}

      {/* Support Levels */}
      {levels.support.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            <span style={styles.supportIcon}>&#128994;</span> SUPPORT ZONES
          </h3>

          {levels.support.map((level, index) => (
            <LevelCard
              key={`sup-${index}`}
              level={level}
              type="SUPPORT"
              isExpanded={expandedLevel === `sup-${index}`}
              onToggle={() => setExpandedLevel(
                expandedLevel === `sup-${index}` ? null : `sup-${index}`
              )}
              getStrengthColor={getStrengthColor}
            />
          ))}
        </div>
      )}

      {/* Educational Disclaimer */}
      <div style={styles.disclaimer}>
        <span style={styles.disclaimerIcon}>&#8505;&#65039;</span>
        <span>
          Support/resistance levels are based on historical price action and technical indicators.
          They represent areas where price may react, not guaranteed turning points.
        </span>
      </div>
    </div>
  );
};

/**
 * Individual Level Card Component
 */
const LevelCard = ({ level, type, isExpanded, onToggle, getStrengthColor }) => {
  const typeColor = type === 'SUPPORT' ? '#00ff88' : '#ff4757';

  return (
    <div
      style={{
        ...styles.levelCard,
        borderLeftColor: typeColor,
      }}
    >
      {/* Header */}
      <div style={styles.levelHeader} onClick={onToggle}>
        <div style={styles.levelLeft}>
          <div style={styles.priceRow}>
            <span style={styles.levelPrice}>
              ${level.priceRange.low.toFixed(2)} - ${level.priceRange.high.toFixed(2)}
            </span>
            <span style={{
              ...styles.strengthBadge,
              backgroundColor: getStrengthColor(level.strength) + '20',
              color: getStrengthColor(level.strength),
            }}>
              {level.strength}
            </span>
          </div>
          <div style={styles.distanceRow}>
            <span style={styles.distance}>
              {Math.abs(parseFloat(level.distanceFromCurrent)).toFixed(1)}% {parseFloat(level.distanceFromCurrent) > 0 ? 'above' : 'below'}
            </span>
          </div>
        </div>

        <div style={styles.levelRight}>
          <div style={styles.confluenceScore}>
            <div style={styles.confluenceLabel}>Confluence</div>
            <div style={styles.confluenceValue}>{level.confluenceScore}%</div>
          </div>
          <span style={styles.expandIcon}>{isExpanded ? '&#9660;' : '&#9654;'}</span>
        </div>
      </div>

      {/* Factors */}
      <div style={styles.factorsRow}>
        {level.factors.slice(0, 3).map((factor, i) => (
          <span key={i} style={styles.factorChip}>
            {factor.name}
          </span>
        ))}
        {level.factors.length > 3 && (
          <span style={styles.moreFactors}>+{level.factors.length - 3}</span>
        )}
      </div>

      {/* Expanded Explanation */}
      {isExpanded && (
        <div style={styles.expandedContent}>
          <div style={styles.explanationSection}>
            <h4 style={styles.explanationTitle}>WHY THIS LEVEL MATTERS</h4>
            <p style={styles.explanationText}>{level.explanation}</p>
          </div>

          <div style={styles.factorsList}>
            <h4 style={styles.factorsTitle}>CONTRIBUTING FACTORS</h4>
            {level.factors.map((factor, i) => (
              <div key={i} style={styles.factorItem}>
                <span style={styles.factorName}>{factor.name}</span>
                <span style={styles.factorDesc}>{factor.description}</span>
              </div>
            ))}
          </div>

          {/* Price Target Info */}
          <div style={styles.priceInfo}>
            <div style={styles.priceInfoRow}>
              <span style={styles.priceInfoLabel}>Exact Level</span>
              <span style={styles.priceInfoValue}>${level.price?.toFixed(2)}</span>
            </div>
            <div style={styles.priceInfoRow}>
              <span style={styles.priceInfoLabel}>Watch Zone</span>
              <span style={styles.priceInfoValue}>
                ${level.priceRange.low.toFixed(2)} - ${level.priceRange.high.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '0',
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
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: '#00ffff',
    borderRadius: '2px',
    animation: 'loading 1.5s ease-in-out infinite',
    width: '30%',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
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
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    margin: '0 0 8px 0',
    lineHeight: '1.5',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    margin: 0,
  },
  overlayToggle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  overlayLabel: {
    fontSize: '14px',
    color: '#fff',
  },
  toggleButton: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#fff',
    transition: 'all 0.2s ease',
    background: 'none',
  },
  currentPriceBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 255, 255, 0.3)',
    marginBottom: '20px',
  },
  currentLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
  },
  currentPrice: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#00ffff',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '1px',
    marginBottom: '12px',
  },
  resistanceIcon: {
    fontSize: '10px',
  },
  supportIcon: {
    fontSize: '10px',
  },
  levelCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '12px',
    borderLeft: '3px solid',
    marginBottom: '12px',
    overflow: 'hidden',
  },
  levelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    cursor: 'pointer',
  },
  levelLeft: {
    flex: 1,
  },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  levelPrice: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
  },
  strengthBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
  },
  distanceRow: {
    marginTop: '4px',
  },
  distance: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  levelRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  confluenceScore: {
    textAlign: 'center',
  },
  confluenceLabel: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
  },
  confluenceValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#00ffff',
  },
  expandIcon: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '10px',
  },
  factorsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '0 16px 14px',
  },
  factorChip: {
    padding: '4px 10px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: '12px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
  },
  moreFactors: {
    padding: '4px 10px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
  },
  expandedContent: {
    padding: '16px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  explanationSection: {
    marginBottom: '16px',
  },
  explanationTitle: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.5px',
    margin: '0 0 8px 0',
  },
  explanationText: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: '1.5',
    margin: 0,
  },
  factorsList: {
    marginTop: '12px',
  },
  factorsTitle: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.5px',
    margin: '0 0 8px 0',
  },
  factorItem: {
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    marginBottom: '6px',
  },
  factorName: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '2px',
  },
  factorDesc: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
  },
  priceInfo: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
  },
  priceInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  priceInfoLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
  },
  priceInfoValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
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
    lineHeight: '1.4',
  },
  disclaimerIcon: {
    flexShrink: 0,
  },
};

export default LevelsTab;
