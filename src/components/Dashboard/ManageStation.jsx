// src/components/Dashboard/ManageStation.jsx
//
// "04 · Manage" — a thin telegraph shown only when a battle is live. Surfaces
// the agent's current standing (score via GainLossBadge — the only red on the
// screen), trade count, and opponent; tapping opens the AgentBattleScreen via
// the existing handleOpenAgentBattle path. No approve/veto (deferred).

import React from 'react';
import { ChevronRight } from 'lucide-react';
import HoloCard from '../shared/HoloCard';
import GainLossBadge from '../shared/GainLossBadge';

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function ManageStation({ battle, agent, accent, tokens, onOpen }) {
  if (!battle) return null;

  const agentName = battle.agentContext?.agentName || agent?.name || 'Your agent';
  const score = battle.scoreState?.currentScore;
  const tradeCount = battle.scoreState?.tradeCount ?? (battle.trades?.length || 0);

  return (
    <HoloCard
      as="button"
      onClick={() => onOpen?.(battle)}
      size="lg"
      style={{
        width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
        background: tokens.bgCard,
        border: `1px solid ${hexToRgba(accent, 0.3)}`,
        borderTop: `2px solid ${hexToRgba(accent, 0.55)}`,
        boxShadow: `${tokens.obsidianShadow}, 0 0 22px ${hexToRgba(accent, 0.12)}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: accent }}>
            04 · Manage
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
            color: tokens.emerald, background: hexToRgba(tokens.emerald, 0.12),
            border: `1px solid ${hexToRgba(tokens.emerald, 0.3)}`, padding: '2px 7px', borderRadius: 20,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: tokens.emerald }} />
            Live
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textWhite, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {agentName} is trading
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <GainLossBadge value={score} variant="pill" size="md" showPercent={false} />
          <span style={{ fontSize: 12, color: tokens.textMuted }}>{tradeCount} trades · vs CPU</span>
        </div>
      </div>
      <ChevronRight size={20} color={tokens.textFaint} style={{ flexShrink: 0 }} />
    </HoloCard>
  );
}
