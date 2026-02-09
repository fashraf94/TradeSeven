// BaggerBombRulesCard - Expandable rules card for dashboard
// Displays key game rules, scoring, timing, and substitution info

import React, { useState } from 'react';

// Icons as inline SVG components for portability
const ChevronDown = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

const ChevronUp = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6,15 12,9 18,15" />
  </svg>
);

const Target = ({ size = 16, color = '#00d9ff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const Clock = ({ size = 16, color = '#00d9ff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const RefreshCw = ({ size = 16, color = '#00d9ff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <polyline points="23,4 23,10 17,10" />
    <polyline points="1,20 1,14 7,14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const Calendar = ({ size = 16, color = '#00d9ff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const Info = ({ size = 20, color = '#00d9ff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/**
 * Rule section with icon and title
 */
const RuleSection = ({ icon, title, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
      color: '#00d9ff',
      fontSize: '14px',
      fontWeight: '600'
    }}>
      {icon}
      {title}
    </div>
    <div style={{ paddingLeft: '24px' }}>
      {children}
    </div>
  </div>
);

/**
 * Individual rule item with bullet point
 */
const RuleItem = ({ text, highlight = false }) => (
  <div style={{
    fontSize: '13px',
    color: highlight ? '#00d9ff' : '#ccc',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    lineHeight: 1.4
  }}>
    <span style={{ color: '#00d9ff', flexShrink: 0 }}>&#8226;</span>
    <span>{text}</span>
  </div>
);

/**
 * BaggerBombRulesCard - Expandable rules summary for dashboard
 *
 * @param {boolean} defaultExpanded - Start expanded (default: false)
 */
export default function BaggerBombRulesCard({ defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '12px',
      border: '1px solid rgba(0, 217, 255, 0.3)',
      overflow: 'hidden',
      marginBottom: '16px'
    }}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#fff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(0, 217, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Info size={20} color="#00d9ff" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              BaggerBomb Rules
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
              Tap to {isExpanded ? 'hide' : 'view'} game rules
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div style={{ padding: '0 16px 16px 16px' }}>
          {/* Scoring Section */}
          <RuleSection
            icon={<Target size={16} color="#00d9ff" />}
            title="Scoring"
          >
            <RuleItem text="BaggerBomb: +15 pts when asset crosses its volatility threshold" />
            <RuleItem text="Bust: -10 pts when asset drops below threshold" />
            <RuleItem text="Multiple thresholds stack (2x = 30 pts, 3x = 50 pts)" />
            <RuleItem text="Base points: 1% return = 10 points" />
            <RuleItem text="Star picks earn 2x base points, Core 1.5x, Support 1x" />
            <RuleItem text="Thresholds are unique to each asset based on volatility" />
          </RuleSection>

          {/* Timing Section */}
          <RuleSection
            icon={<Clock size={16} color="#00d9ff" />}
            title="PvP Timing"
          >
            <RuleItem text="Join deadline: 3:55 PM ET" />
            <RuleItem text="Prices lock: 4:00 PM ET (market close)" />
            <RuleItem text="Battle day: 9:30 AM - 8:00 PM ET (next day)" />
            <RuleItem text="Overnight moves count!" highlight />
          </RuleSection>

          {/* Sessions Section */}
          <RuleSection
            icon={<Calendar size={16} color="#00d9ff" />}
            title="Sessions"
          >
            <RuleItem text="Morning Bell: 9:30 - 11:30 AM ET" />
            <RuleItem text="Midday: 11:30 AM - 2:00 PM ET" />
            <RuleItem text="Power Hour: 2:00 - 4:00 PM ET" />
            <RuleItem text="Night Game: 4:00 - 8:00 PM ET (crypto only)" />
          </RuleSection>

          {/* Substitutions Section */}
          <RuleSection
            icon={<RefreshCw size={16} color="#00d9ff" />}
            title="Substitutions"
          >
            <RuleItem text="2 per battle maximum" />
            <RuleItem text="Windows: 11:30 AM & 2:00 PM ET (15 min each)" />
            <RuleItem text="Stock-for-stock or crypto-for-crypto only" />
          </RuleSection>

          {/* Schedule Info */}
          <div style={{
            background: 'rgba(0, 217, 255, 0.1)',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '8px',
            fontSize: '12px',
            color: '#a0a0a0',
            lineHeight: 1.5
          }}>
            <strong style={{ color: '#00d9ff' }}>Schedule:</strong> Battles run weekdays only (Mon-Fri).
            Use weekends to research and build your portfolio!
          </div>
        </div>
      )}
    </div>
  );
}
