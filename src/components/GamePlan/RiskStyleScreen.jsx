import React, { useState } from 'react';
import { ArrowLeft, Flame, Scale, Shield } from 'lucide-react';

const RISK_STYLES = [
  {
    id: 'aggressive',
    name: 'Aggressive',
    icon: Flame,
    color: '#ef4444',
    emoji: '🔥',
    description: 'High volatility stocks with big swing potential',
    details: [
      'Focus on high-threshold stocks (3%+ moves)',
      'More breakout opportunities',
      'Higher bust risk',
      'Best for: Confident players seeking big wins'
    ]
  },
  {
    id: 'balanced',
    name: 'Balanced',
    icon: Scale,
    color: '#f59e0b',
    emoji: '⚖️',
    description: 'Mix of volatile and stable picks',
    details: [
      'Blend of high and low threshold stocks',
      'Moderate risk/reward profile',
      'Diversified approach',
      'Best for: Most players'
    ]
  },
  {
    id: 'conservative',
    name: 'Conservative',
    icon: Shield,
    color: '#10b981',
    emoji: '🛡️',
    description: 'Stable stocks focused on base points',
    details: [
      'Focus on low-threshold stocks (1-2% moves)',
      'Consistent base point accumulation',
      'Lower bust risk',
      'Best for: Steady, defensive play'
    ]
  }
];

const RiskStyleScreen = ({ onBack, onNext, selectedStyle }) => {
  const [selected, setSelected] = useState(selectedStyle || null);

  const handleNext = () => {
    if (selected) {
      onNext(selected);
    }
  };

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
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>

        <div style={{ fontSize: '14px', color: '#8b949e' }}>
          Step 2 of 5
        </div>

        <div style={{ width: '60px' }} />
      </div>

      {/* Progress Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '24px', height: '8px', borderRadius: '4px', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#21262d' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#21262d' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#21262d' }} />
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '0 20px 32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          What's your risk style?
        </h1>
        <p style={{ color: '#8b949e', fontSize: '15px' }}>
          This affects which stocks we recommend for your Game Plan
        </p>
      </div>

      {/* Risk Style Cards */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {RISK_STYLES.map((style) => {
          const Icon = style.icon;
          const isSelected = selected === style.id;

          return (
            <div
              key={style.id}
              onClick={() => setSelected(style.id)}
              style={{
                backgroundColor: isSelected ? `${style.color}15` : '#161b22',
                border: isSelected ? `2px solid ${style.color}` : '1px solid #21262d',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: `${style.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={28} color={style.color} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '20px' }}>{style.emoji}</span>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>
                      {style.name}
                    </h3>
                  </div>

                  <p style={{ margin: '0 0 12px', color: '#8b949e', fontSize: '14px' }}>
                    {style.description}
                  </p>

                  <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#8b949e', fontSize: '13px' }}>
                    {style.details.map((detail, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{detail}</li>
                    ))}
                  </ul>
                </div>

                {isSelected && (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: style.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    ✓
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: '#161b22',
        borderTop: '1px solid #21262d'
      }}>
        <button
          onClick={handleNext}
          disabled={!selected}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: selected ? '#00d9ff' : '#21262d',
            border: 'none',
            borderRadius: '12px',
            color: selected ? '#000000' : '#8b949e',
            fontWeight: '600',
            fontSize: '16px',
            cursor: selected ? 'pointer' : 'not-allowed'
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
};

export default RiskStyleScreen;
