// src/components/TechnicalAnalysis/PatternInsights.jsx

import React from 'react';
import { motion } from 'framer-motion';

const PatternInsights = ({ stats = {}, onBack }) => {
  const { totalTracked = 0, confirmed = 0, failed = 0, confirmationRate = 0 } = stats;
  const hasData = totalTracked > 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0e14' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backgroundColor: '#0d1117',
      }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#00ffff', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6" /></svg>
          Back
        </button>
        <h1 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Pattern Insights</h1>
        <div style={{ width: '60px' }} />
      </div>

      <div style={{ padding: '20px' }}>
        {hasData ? (
          <>
            {/* Overall Stats */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '20px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              marginBottom: '24px',
            }}>
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <motion.circle
                    cx="50" cy="50" r="45" fill="none" stroke="#00ffff" strokeWidth="8"
                    strokeDasharray={`${confirmationRate * 2.83} 283`}
                    transform="rotate(-90 50 50)"
                    initial={{ strokeDasharray: '0 283' }}
                    animate={{ strokeDasharray: `${confirmationRate * 2.83} 283` }}
                    transition={{ duration: 1 }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: '#00ffff' }}>{confirmationRate}%</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Confirmed</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total Tracked</span>
                  <span style={{ color: '#fff', fontWeight: '600' }}>{totalTracked}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Confirmed</span>
                  <span style={{ color: '#10b981', fontWeight: '600' }}>{confirmed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Failed</span>
                  <span style={{ color: '#ef4444', fontWeight: '600' }}>{failed}</span>
                </div>
              </div>
            </div>

            {/* Insight */}
            <div style={{
              padding: '14px',
              backgroundColor: 'rgba(0,255,255,0.05)',
              borderRadius: '10px',
              border: '1px solid rgba(0,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span>&#128161;</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                Track more patterns to see detailed insights by pattern type and confluence strength.
              </span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span style={{ fontSize: '56px', display: 'block', marginBottom: '16px' }}>&#128202;</span>
            <h3 style={{ color: '#fff', margin: '0 0 8px' }}>No Data Yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '280px', margin: '0 auto', lineHeight: '1.6' }}>
              Start tracking patterns to see your performance insights.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          Insights are based on your personal pattern tracking history.
        </p>
      </div>
    </div>
  );
};

export default PatternInsights;
