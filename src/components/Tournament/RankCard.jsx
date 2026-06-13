// src/components/Tournament/RankCard.jsx
//
// P6b — the career-rank surface (Spec §1.5): current tier + the permanent
// floor + a within-tier progress bar (the ratchet made legible), the per-week
// audit lines (raw · guard · Δ — the CPU-farm discount shown honestly), and
// the peak. CPU rows are DISPLAY-ONLY per §7.1 (shown-but-frozen, founder-
// chosen): RP shown for context, no progress bar, marked "bots don't climb."
// Tokens-native; the only motion is the bar fill, gated on reduced-motion.

import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeRank } from '../../services/tournamentGroupService';
import { rankProgress } from '../../constants/leagueTournament';

export default function RankCard({ docId, dev = false, label = 'Career rank' }) {
  const { tokens } = useTheme();
  const reduce = useReducedMotion();
  const [rank, setRank] = useState(null);

  useEffect(() => subscribeRank(docId, setRank), [docId]);
  if (!rank) return null;

  const isCpu = rank.isCpu === true;
  const prog = rankProgress(rank);
  const card = {
    background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: isCpu ? 0.72 : 1,
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {label}{dev ? ' (dev)' : ''}
          {isCpu && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}> CPU · DISPLAY ONLY</span>}
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: isCpu ? tokens.textFaint : '#f59e0b' }}>
          {rank.tierName} · {rank.rp} RP
        </span>
      </div>

      {isCpu ? (
        <div style={{ fontSize: 11, color: tokens.textMuted }}>
          Bots don't climb the ladder — RP shown for context, no floor (§7.1).
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: tokens.textMuted }}>
            floor: {prog.floorTierName}
            {prog.nextTierName
              ? ` · climbing toward ${prog.nextTierName} (${prog.nextFloor} RP)`
              : ' · top of the ladder'}
            {' · '}peak {rank.peakRp}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: tokens.bgApp, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.round(prog.withinTierPct * 100)}%`,
              background: '#f59e0b', transition: reduce ? 'none' : 'width 240ms ease',
            }} />
          </div>
        </>
      )}

      {(rank.history || []).slice(-5).reverse().map((event) => (
        <div key={`${event.groupId}-${event.appliedAt}`}
          style={{ fontSize: 11, color: tokens.textMuted, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: tokens.textFaint }}>{event.groupId}</span>
          <span>#{event.placement}</span>
          <span>composite {event.weeklyComposite}</span>
          <span>raw {event.raw}</span>
          <span title="CPU-farm guard">guard ×{event.guard}</span>
          <span style={{ fontWeight: 700, color: event.delta < 0 ? '#ef4444' : event.delta > 0 ? '#10b981' : tokens.textMuted }}>
            Δ {event.delta >= 0 ? '+' : ''}{event.delta}
          </span>
          <span>→ {event.rpAfter} RP</span>
        </div>
      ))}
    </div>
  );
}
