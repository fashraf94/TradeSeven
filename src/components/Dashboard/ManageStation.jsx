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
import { DESK_COPY } from './desk/deskCopy';

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

export default function ManageStation({ battle, agent, accent, onOpen, showType, sync = null }) {
  if (!battle) return null;
  const agentName = battle.agentContext?.agentName || agent?.name || 'Your agent';
  const score = battle.scoreState?.currentScore;
  const tradeCount = battle.scoreState?.tradeCount ?? (battle.trades?.length || 0);
  const left = timeLeft(battle.expiresAt);

  // Command Center Sync (Pass 1, spec §7 Manage rail). `sync` is the adapter
  // object, or null while the flag is dark — in which case every value below
  // falls back to exactly what this card rendered before.
  //
  // The line this replaces was an unconditional "{agentName} is trading". It
  // is false for most of a fullday battle's life: evals are hard-gated to
  // regular trading hours (agent-evaluate.js:284-286), so overnight, at the
  // weekend and on holidays the agent is not trading and the card said it was.
  const phase = sync?.phase ?? null;
  const activity = phase === 'LIVE' || phase === null
    ? DESK_COPY.manageLive(agentName)
    : phase === 'PRE_OPEN'
      ? DESK_COPY.managePreOpen
      : DESK_COPY.manageClosedResuming(sync?.nextOpenEt);
  // The expiry countdown STAYS in the right rail. It is still true off-hours
  // and, for a crypto fullday battle (which expires 8:00 PM ET, four hours
  // after the close), it is the truer of the two facts — that battle ends
  // before the next open the resume line names. So the resume time rides the
  // activity line instead of displacing the countdown. Both are derived from
  // the same adapter field the Desk's posture line uses, so no two surfaces can
  // disagree about them (BUILD_RULES §9).
  const rightRail = left || (phase === 'PRE_OPEN' ? DESK_COPY.manageResumes(sync?.nextOpenEt) : null);

  // F-4: the dot stops pulsing in the closed phases.
  //
  // The eyebrow TEXT stays "LIVE" — that is true of the battle, which is still
  // running. The pulse is a different claim: motion reads as activity, and
  // overnight, at the weekend and on holidays there is none. Evals are
  // hard-gated to regular trading hours (agent-evaluate.js:284-286), so a
  // pulsing dot beside "Market closed" animates something that is not
  // happening — the same fabrication class as an agent verb, made of motion
  // instead of words.
  //
  // Driven from the adapter's phase, never from a market-state read here: this
  // card and the Desk above it must not derive "is the market open" from two
  // sources that can drift (BUILD_RULES §9). Dark (phase null) it pulses
  // exactly as before, which is what keeps flag-off byte-identical.
  const pulseStatic = phase === 'PRE_OPEN' || phase === 'LIVE_CLOSED';
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
            animate={pulseStatic ? { scale: 1, opacity: 1 } : { scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
            transition={pulseStatic ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 9, height: 9, borderRadius: '50%', background: accent, display: 'block' }}
          />
          <Mono style={{ fontSize: 11, letterSpacing: '0.16em', color: accent, textTransform: 'uppercase', fontWeight: 600 }}>{typeLabel ? `${typeLabel} · live` : 'Battle live'}</Mono>
        </div>
        {rightRail && (
          <Mono style={{ fontSize: 12, color: CMD.ink2, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} color={CMD.ink2} /> {rightRail}
          </Mono>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: CMD.ink, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activity}</div>
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
