// src/components/Dashboard/ReviewStation.jsx
//
// "05 · Review" — an entry shown only when a recently-completed agent battle
// exists. Taps through to the Film Room (the post-battle review surface) using
// the same raw agentBattles doc the battleHistory Review button passes. Empty
// when there's nothing recent.

import React from 'react';
import { Film, ChevronRight } from 'lucide-react';
import HoloCard from '../shared/HoloCard';
import GainLossBadge from '../shared/GainLossBadge';

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function ReviewStation({ battles = [], agent, accent, tokens, onReview }) {
  if (!battles.length) return null;
  const latest = battles[0];
  const agentName = latest.agentContext?.agentName || agent?.name || 'Your agent';
  const score = latest.scoreState?.currentScore;
  const more = battles.length - 1;

  return (
    <HoloCard
      as="button"
      onClick={() => onReview?.(latest)}
      size="lg"
      style={{
        width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
        boxShadow: tokens.obsidianShadow,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hexToRgba(accent, 0.12), border: `1px solid ${hexToRgba(accent, 0.28)}`, color: accent,
      }}>
        <Film size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: tokens.textFaint, marginBottom: 3 }}>
          05 · Review
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: tokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {agentName}’s last battle
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <GainLossBadge value={score} variant="text" size="sm" showPercent={false} />
          <span style={{ fontSize: 12, color: tokens.textMuted }}>
            Break down the tape{more > 0 ? ` · +${more} more` : ''}
          </span>
        </div>
      </div>
      <ChevronRight size={20} color={tokens.textFaint} style={{ flexShrink: 0 }} />
    </HoloCard>
  );
}
