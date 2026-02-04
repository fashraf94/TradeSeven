// src/components/TechnicalAnalysis/PatternTrackerDashboard.jsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PatternTrackerDashboard = ({ patterns = [], stats = {}, onViewPattern, onCancelPattern, onBack }) => {
  const [filter, setFilter] = useState('active');

  const activePatterns = patterns.filter(p => p.status === 'WAITING' || p.status === 'TESTING');
  const completedPatterns = patterns.filter(p => p.status === 'RESOLVED' || p.status === 'EXPIRED');
  const displayedPatterns = filter === 'active' ? activePatterns : filter === 'completed' ? completedPatterns : patterns;

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
        <h1 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Pattern Tracker</h1>
        <div style={{ width: '60px' }} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '20px', backgroundColor: '#0d1117', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <StatCard value={stats.totalTracked || 0} label="Tracked" />
        <StatCard value={stats.confirmed || 0} label="Confirmed" color="#10b981" />
        <StatCard value={stats.failed || 0} label="Failed" color="#ef4444" />
        <StatCard value={`${stats.confirmationRate || 0}%`} label="Rate" color="#00ffff" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {[
          { value: 'active', label: `Active (${activePatterns.length})` },
          { value: 'completed', label: `Results (${completedPatterns.length})` },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: filter === tab.value ? 'rgba(0,255,255,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === tab.value ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '8px',
              color: filter === tab.value ? '#00ffff' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pattern List */}
      <div style={{ padding: '20px' }}>
        <AnimatePresence>
          {displayedPatterns.length > 0 ? (
            displayedPatterns.map(pattern => (
              <motion.div
                key={pattern.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: '600', display: 'block' }}>{pattern.ticker}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{pattern.zoneType} Zone</span>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    backgroundColor: getStatusColor(pattern.status, pattern.outcome) + '20',
                    color: getStatusColor(pattern.status, pattern.outcome),
                  }}>
                    {getStatusText(pattern.status, pattern.outcome)}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                  Zone: ${pattern.priceLow?.toFixed(2)} - ${pattern.priceHigh?.toFixed(2)}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onViewPattern?.(pattern)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: 'rgba(0,255,255,0.1)',
                      border: '1px solid rgba(0,255,255,0.3)',
                      borderRadius: '8px',
                      color: '#00ffff',
                      cursor: 'pointer',
                    }}
                  >
                    View Details
                  </button>
                  {(pattern.status === 'WAITING' || pattern.status === 'TESTING') && (
                    <button
                      onClick={() => onCancelPattern?.(pattern.id)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.5)' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>&#128300;</span>
              <p>No {filter} patterns yet. Analyze a stock to start tracking!</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const StatCard = ({ value, label, color = '#fff' }) => (
  <div style={{ textAlign: 'center', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
    <span style={{ display: 'block', fontSize: '22px', fontWeight: '700', color }}>{value}</span>
    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
  </div>
);

const getStatusColor = (status, outcome) => {
  if (status === 'RESOLVED') return outcome === 'CONFIRMED' ? '#10b981' : '#ef4444';
  if (status === 'TESTING') return '#00ffff';
  if (status === 'WAITING') return '#f59e0b';
  return '#8b949e';
};

const getStatusText = (status, outcome) => {
  if (status === 'RESOLVED') return outcome === 'CONFIRMED' ? '\u2705 Confirmed' : '\u274C Failed';
  if (status === 'TESTING') return '\uD83D\uDD04 Testing';
  if (status === 'WAITING') return '\u23F3 Waiting';
  return status;
};

export default PatternTrackerDashboard;
