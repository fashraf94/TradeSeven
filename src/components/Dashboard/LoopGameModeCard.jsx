// /src/components/Dashboard/LoopGameModeCard.jsx
// Unified game mode card with dual CTAs (PVP + Training) for The Loop mobile feed

import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Users, Bot } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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
    challengeBg: 'rgba(245,158,11,0.12)',
  },
  snakeDraft: {
    title: 'Snake Draft',
    description: 'Draft 9 assets in snake order. Outsmart 3 opponents.',
    icon: SnakeIcon,
    accent: '#34d399',
    accentRgb: '52, 211, 153',
    playerCount: '4 Players',
    challengeBg: 'rgba(52,211,153,0.12)',
  },
};

export default function LoopGameModeCard({ modeId, onPvpSelect, onTrainSelect }) {
  const { tokens } = useTheme();
  const mode = MODES[modeId];
  if (!mode) return null;

  const Icon = mode.icon;

  return (
    <div style={{
      background: tokens.bgCard,
      borderRadius: '16px',
      border: `1px solid ${tokens.borderDefault}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: tokens.bgIcon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={24} color={mode.accent} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: '600', color: tokens.textPrimary }}>
              {mode.title}
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: mode.accent,
              padding: '2px 8px',
              borderRadius: '4px',
              background: `rgba(${mode.accentRgb}, 0.15)`,
            }}>
              {mode.playerCount}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: tokens.textMuted, marginTop: '3px' }}>
            {mode.description}
          </div>
        </div>
      </div>

      {/* Dual CTA buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <motion.button
          onClick={onPvpSelect}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 0',
            borderRadius: '10px',
            border: 'none',
            background: mode.challengeBg,
            color: mode.accent,
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <Users size={14} />
          Challenge
        </motion.button>
        <motion.button
          onClick={onTrainSelect}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px 0',
            borderRadius: '10px',
            border: 'none',
            background: tokens.bgIcon,
            color: tokens.textSecondary,
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <Bot size={14} />
          vs AI
        </motion.button>
      </div>
    </div>
  );
}
