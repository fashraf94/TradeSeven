// src/components/TechnicalAnalysis/shared/EmptyState.jsx
// Shared empty state component for Technical Analysis tabs

import React from 'react';

const EmptyState = ({ icon = '🔍', title, message }) => (
  <div style={styles.container}>
    <span style={styles.icon}>{icon}</span>
    <h3 style={styles.title}>{title}</h3>
    <p style={styles.text}>{message}</p>
  </div>
);

const styles = {
  container: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  icon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  title: {
    color: '#fff',
    fontSize: '16px',
    margin: '0 0 8px 0',
  },
  text: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    margin: 0,
    lineHeight: '1.5',
  },
};

export default EmptyState;
