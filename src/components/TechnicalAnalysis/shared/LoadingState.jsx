// src/components/TechnicalAnalysis/shared/LoadingState.jsx
// Shared loading state component for Technical Analysis tabs

import React from 'react';

const LoadingState = ({ message = 'Loading...' }) => (
  <div style={styles.container}>
    <div style={styles.barContainer}>
      <div style={styles.bar} />
    </div>
    <span style={styles.text}>{message}</span>
  </div>
);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: '12px',
  },
  barContainer: {
    width: '100px',
    height: '3px',
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  bar: {
    width: '40%',
    height: '100%',
    backgroundColor: '#00ffff',
    borderRadius: '2px',
    animation: 'loadingSlide 1s ease-in-out infinite',
  },
  text: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
  },
};

export default LoadingState;
