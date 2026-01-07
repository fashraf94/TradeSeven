// /src/components/shared/PinnableInsight.jsx

import React from 'react';

/**
 * PinnableInsight - Reusable insight card with save/pin functionality
 * Used throughout research flow to display metrics with explanations
 *
 * @param {Object} props
 * @param {string} props.title - Metric title
 * @param {string} props.value - Metric value
 * @param {string} props.explanation - Detailed explanation text
 * @param {string} props.symbol - Stock/crypto symbol
 * @param {Function} props.onPin - Handler for pinning insight
 * @param {boolean} props.isPinned - Whether insight is already pinned
 * @param {Object} props.colors - Design tokens
 */
const PinnableInsight = ({ title, value, explanation, symbol, onPin, isPinned, colors }) => {
  const defaultColors = {
    green: '#00ff88',
    red: '#ff4757',
    cyan: '#00d9ff',
  };
  const c = colors || defaultColors;

  const handlePin = () => {
    if (onPin && !isPinned) {
      onPin({
        symbol,
        metricName: title,
        metricValue: value,
        explanation,
        source: 'research_flow',
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      border: '1px solid #2d3548',
    }}>
      {/* Metric Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>{title}</span>
        <span style={{
          color: value?.toString().startsWith('+') ? c.green : value?.toString().startsWith('-') ? c.red : '#e6edf3',
          fontSize: '18px',
          fontWeight: '600',
        }}>
          {value}
        </span>
      </div>

      {/* Explanation */}
      <div style={{
        background: '#161b22',
        borderRadius: '8px',
        padding: '12px',
        marginTop: '8px',
        borderLeft: '3px solid #00d9ff',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ color: '#00d9ff' }}>*</span>
          <span style={{ color: '#c9d1d9', fontSize: '14px', lineHeight: '1.5' }}>
            {explanation}
          </span>
        </div>

        {/* Pin Button */}
        <button
          onClick={handlePin}
          disabled={isPinned}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: 'auto',
            padding: '6px 12px',
            background: isPinned ? '#238636' : 'transparent',
            border: `1px solid ${isPinned ? '#238636' : '#3d4450'}`,
            borderRadius: '6px',
            color: isPinned ? '#ffffff' : '#8b949e',
            fontSize: '12px',
            cursor: isPinned ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {isPinned ? 'Saved' : 'Save Insight'}
        </button>
      </div>
    </div>
  );
};

export default PinnableInsight;
