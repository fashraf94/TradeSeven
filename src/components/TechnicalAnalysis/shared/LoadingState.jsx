// src/components/TechnicalAnalysis/shared/LoadingState.jsx
// Shared loading state component for Technical Analysis tabs

import React from 'react';
import { motion } from 'framer-motion';

const LoadingState = ({ message = 'Loading...' }) => (
  <div style={styles.container}>
    <motion.div
      style={styles.bar}
      initial={{ width: 0 }}
      animate={{ width: '100%' }}
      transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
    />
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
  bar: {
    width: '100px',
    height: '3px',
    backgroundColor: '#00ffff',
    borderRadius: '2px',
  },
  text: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
  },
};

export default LoadingState;
