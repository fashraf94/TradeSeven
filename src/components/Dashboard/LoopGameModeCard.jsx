// /src/components/Dashboard/LoopGameModeCard.jsx
// Unified game mode card with dual CTAs (PVP + Training) for The Loop mobile feed

import React, { useState } from 'react';
import { Flame, Users, Swords, Bot } from 'lucide-react';

// Custom Snake Icon (matching Lucide style)
const SnakeIcon = ({ size = 24, color = 'currentColor', strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 18 Q 4 14, 8 14 Q 12 14, 12 10 Q 12 6, 16 6 Q 20 6, 20 3" />
    <circle cx="20" cy="3" r="1.5" fill={color} stroke="none" />
    <path d="M21.5 2 L23 1" />
    <path d="M21.5 3.2 L23 3.8" />
    <circle cx="19.2" cy="2.5" r="0.5" fill="none" strokeWidth={strokeWidth * 0.8} />
    <path d="M4 18 Q 3 19.5, 2 20" />
  </svg>
);

const MODES = {
  baggerbomb: {
    title: 'BaggerBomb',
    description: 'Score points with breakout bonuses and explosive multipliers.',
    icon: Flame,
    accent: '#f59e0b',
    accentRgb: '245, 158, 11',
    playerCount: '1v1',
  },
  snakeDraft: {
    title: 'Snake Draft',
    description: 'Draft 9 assets in snake order. Outsmart 3 opponents.',
    icon: SnakeIcon,
    accent: '#22c55e',
    accentRgb: '34, 197, 94',
    playerCount: '4 Players',
  },
  classic: {
    title: 'Classic 1v1',
    description: 'Build a portfolio and battle head-to-head.',
    icon: Swords,
    accent: '#00d9ff',
    accentRgb: '0, 217, 255',
    playerCount: '1v1',
  },
};

export default function LoopGameModeCard({ modeId, onPvpSelect, onTrainSelect }) {
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const mode = MODES[modeId];
  if (!mode) return null;

  const Icon = mode.icon;

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(${mode.accentRgb}, 0.08) 0%, rgba(13, 17, 23, 0.95) 100%)`,
      borderRadius: '16px',
      border: `1px solid rgba(${mode.accentRgb}, 0.2)`,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${mode.accent}, ${mode.accent}88)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px rgba(${mode.accentRgb}, 0.3)`,
        }}>
          <Icon size={22} color="#ffffff" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#e6edf3' }}>
              {mode.title}
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              color: mode.accent,
              padding: '2px 6px',
              borderRadius: '6px',
              background: `rgba(${mode.accentRgb}, 0.1)`,
              border: `1px solid rgba(${mode.accentRgb}, 0.15)`,
            }}>
              {mode.playerCount}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '2px' }}>
            {mode.description}
          </div>
        </div>
      </div>

      {/* Dual CTA buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onPvpSelect}
          onMouseEnter={() => setHoveredBtn('pvp')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 0',
            borderRadius: '10px',
            border: `1px solid rgba(${mode.accentRgb}, ${hoveredBtn === 'pvp' ? '0.6' : '0.3'})`,
            background: hoveredBtn === 'pvp'
              ? `rgba(${mode.accentRgb}, 0.15)`
              : `rgba(${mode.accentRgb}, 0.05)`,
            color: mode.accent,
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <Users size={14} />
          Challenge
        </button>
        <button
          onClick={onTrainSelect}
          onMouseEnter={() => setHoveredBtn('train')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 0',
            borderRadius: '10px',
            border: `1px solid rgba(139, 92, 246, ${hoveredBtn === 'train' ? '0.6' : '0.3'})`,
            background: hoveredBtn === 'train'
              ? 'rgba(139, 92, 246, 0.15)'
              : 'rgba(139, 92, 246, 0.05)',
            color: '#a78bfa',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <Bot size={14} />
          vs AI
        </button>
      </div>
    </div>
  );
}
