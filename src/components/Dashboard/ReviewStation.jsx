// src/components/Dashboard/ReviewStation.jsx
//
// "05 · Review" — an entry shown only when a recently-completed agent battle
// exists. Taps through to the Film Room (the raw agentBattles doc, same path
// the battleHistory Review button uses). Empty when there's nothing recent.
//
// VISUAL PASS: styling only — onReview + the data read are unchanged.

import React from 'react';
import { Film, ChevronRight } from 'lucide-react';
import GainLossBadge from '../shared/GainLossBadge';
import { CMD, alpha } from './commandUI';

export default function ReviewStation({ battles = [], agent, accent, onReview }) {
  if (!battles.length) return null;
  const latest = battles[0];
  const agentName = latest.agentContext?.agentName || agent?.name || 'Your agent';
  const score = latest.scoreState?.currentScore;
  const more = battles.length - 1;

  return (
    <div
      onClick={() => onReview?.(latest)}
      role="button"
      aria-label="Open last battle in Film Room"
      style={{
        display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 16,
        background: CMD.surface, border: `1px solid ${CMD.hair}`, cursor: 'pointer',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(accent, 0.13), border: `1px solid ${alpha(accent, 0.3)}`, color: accent,
      }}>
        <Film size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: CMD.ink, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName}’s last battle</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 3 }}>
          <GainLossBadge value={score} variant="text" size="sm" showPercent={false} />
          <span style={{ fontSize: 11.5, color: CMD.ink2 }}>Break down the tape{more > 0 ? ` · +${more} more` : ''}</span>
        </div>
      </div>
      <ChevronRight size={16} color={CMD.ink3} style={{ flexShrink: 0 }} />
    </div>
  );
}
