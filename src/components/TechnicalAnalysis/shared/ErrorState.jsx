// src/components/TechnicalAnalysis/shared/ErrorState.jsx
// Shared error state component for Technical Analysis tabs

import React from 'react';

const ErrorState = ({ title = 'Error', message, onRetry }) => (
  <div style={styles.container}>
    <span style={styles.icon}>&#9888;&#65039;</span>
    <h3 style={styles.title}>{title}</h3>
    <p style={styles.text}>{message}</p>
    {onRetry && (
      <button onClick={onRetry} style={styles.retryButton}>
        Try Again
      </button>
    )}
  </div>
);

const styles = {
  container: {
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 71, 87, 0.2)',
  },
  icon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  title: {
    color: '#ff4757',
    fontSize: '16px',
    margin: '0 0 8px 0',
  },
  text: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    margin: '0 0 16px 0',
    lineHeight: '1.5',
  },
  retryButton: {
    padding: '10px 24px',
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
    border: '1px solid #ff4757',
    borderRadius: '8px',
    color: '#ff4757',
    fontSize: '14px',
    cursor: 'pointer',
  },
};

export default ErrorState;
