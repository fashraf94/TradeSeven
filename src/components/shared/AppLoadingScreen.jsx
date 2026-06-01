// src/components/shared/AppLoadingScreen.jsx
//
// The app's single full-screen loading splash. Shown both while Firebase Auth
// restores the session AND while the agent subscription resolves (the
// onboarding gate in App.jsx), so the two sequential waits read as one
// continuous load instead of two different splashes flashing back to back.

import React from 'react';

const AppLoadingScreen = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0a0a0f',
    color: '#00d9ff',
    fontFamily: 'Inter, system-ui, sans-serif',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: '24px',
        fontWeight: 700,
        marginBottom: '12px',
        background: 'linear-gradient(90deg, #FF8C00, #468CFF)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        FantasyTrades
      </div>
      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
        Loading...
      </div>
    </div>
  </div>
);

export default AppLoadingScreen;
