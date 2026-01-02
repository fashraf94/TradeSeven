import React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';

// Placeholder - will be fully built in Phase 2
const GamePlanResultScreen = ({ onBack, onComplete, gamePlanData }) => {
  const { riskStyle, selectedSectors } = gamePlanData;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', color: '#ffffff' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#00d9ff',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ fontSize: '14px', color: '#8b949e' }}>Step 5 of 5</div>
        <div style={{ width: '60px' }} />
      </div>

      {/* Content */}
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#f59e0b20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '40px'
        }}>
          🎯
        </div>

        <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>
          Your Game Plan is Ready!
        </h1>

        <p style={{ color: '#8b949e', marginBottom: '32px' }}>
          Strategy: {riskStyle?.charAt(0).toUpperCase() + riskStyle?.slice(1)} |
          Sectors: {selectedSectors?.join(', ')}
        </p>

        <div style={{
          padding: '20px',
          backgroundColor: '#161b22',
          borderRadius: '12px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Sparkles size={18} color="#f59e0b" />
            <span style={{ fontWeight: '600' }}>Coming in Phase 2</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#8b949e' }}>
            <li>AI-generated stock recommendations</li>
            <li>Written strategy summary</li>
            <li>Tiered picks (Breakout / Safe / Wildcard)</li>
            <li>One-click portfolio creation</li>
          </ul>
        </div>

        <button
          onClick={() => onComplete?.([])}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#00d9ff',
            border: 'none',
            borderRadius: '12px',
            color: '#000',
            fontWeight: '600',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Continue to Portfolio Builder →
        </button>
      </div>
    </div>
  );
};

export default GamePlanResultScreen;
