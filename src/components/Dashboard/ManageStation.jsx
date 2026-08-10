// src/components/Dashboard/ManageStation.jsx
//
// "04 · Manage" — the prototype's live-battle telegraph (the pulse-card): a
// thin entry to the running battle, never the rich state. Shows the live dot,
// time left, what the agent is doing, the current standing (via GainLossBadge —
// the only red on the screen), trade count, and a tap-in arrow. No approve/veto
// (deferred). Tapping opens the AgentBattleScreen via the existing path.
//
// VISUAL PASS: styling only — onOpen + the data read are unchanged.

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight } from 'lucide-react';
import GainLossBadge from '../shared/GainLossBadge';
import { CMD, alpha, Mono } from './commandUI';
import { classifyBattleType, battleTypeLabel, BATTLE_TYPE_RANKED } from '../../utils/commandCenterLiveBattles';

function timeLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return 'ending';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m left`;
}

export default function ManageStation({ battle, agent, accent, onOpen, showType }) {
  if (!battle) return null;
  const agentName = battle.agentContext?.agentName || agent?.name || 'Your agent';
  const score = battle.scoreState?.currentScore;
  const tradeCount = battle.scoreState?.tradeCount ?? (battle.trades?.length || 0);
  const left = timeLeft(battle.expiresAt);
  // Header label and the opponent line both derive from ONE classification (§9 —
  // never a second raw read of battle.groupId). Gated by showType so flag-off (no
  // showType passed) is byte-identical to the legacy "Battle live … · vs CPU" card.
  const battleType = showType ? classifyBattleType(battle) : null;
  const typeLabel = battleType ? battleTypeLabel(battle) : null;
  const showVsCpu = battleType !== BATTLE_TYPE_RANKED; // ranked = league opponent, not CPU

  return (
    <div
      onClick={() => onOpen?.(battle)}
      role="button"
      aria-label="Open live battle"
      style={{
        padding: '15px 16px', borderRadius: 18, cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${alpha(accent, 0.12)}, ${CMD.raised})`,
        border: `1px solid ${alpha(accent, 0.3)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <motion.span
            animate={{ scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 9, height: 9, borderRadius: '50%', background: accent, display: 'block' }}
          />
          <Mono style={{ fontSize: 11, letterSpacing: '0.16em', color: accent, textTransform: 'uppercase', fontWeight: 600 }}>{typeLabel ? `${typeLabel} · live` : 'Battle live'}</Mono>
        </div>
        {left && (
          <Mono style={{ fontSize: 12, color: CMD.ink2, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} color={CMD.ink2} /> {left}
          </Mono>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: CMD.ink, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName} is trading</div>
          <Mono style={{ fontSize: 11, color: CMD.ink3, marginTop: 3, display: 'block' }}>{tradeCount} trades{showVsCpu ? ' · vs CPU' : ''}</Mono>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <GainLossBadge value={score} variant="compact" size="lg" showPercent={false} />
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: alpha(accent, 0.16), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={16} color={accent} />
          </div>
        </div>
      </div>
    </div>
  );
}
