// src/components/TechnicalAnalysis/TimeframeSelector.jsx
// Timeframe selector for switching between 1H, 1D, 1W views

import React from 'react';

const TimeframeSelector = ({ selected, onChange, disabled = false }) => {
  const timeframes = [
    { value: '1h', label: '1H', description: 'Hourly' },
    { value: '1d', label: '1D', description: 'Daily' },
    { value: '1w', label: '1W', description: 'Weekly' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '4px',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '8px',
      border: '1px solid rgba(0, 255, 255, 0.1)',
    }}>
      {timeframes.map(tf => (
        <button
          key={tf.value}
          onClick={() => !disabled && onChange(tf.value)}
          disabled={disabled}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: selected === tf.value
              ? 'rgba(0, 255, 255, 0.15)'
              : 'transparent',
            border: selected === tf.value
              ? '1px solid rgba(0, 255, 255, 0.4)'
              : '1px solid transparent',
            borderRadius: '6px',
            color: selected === tf.value
              ? '#00ffff'
              : 'rgba(255, 255, 255, 0.5)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.5 : 1,
          }}
          title={tf.description}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
};

export default TimeframeSelector;
