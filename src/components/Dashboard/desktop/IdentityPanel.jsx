// src/components/Dashboard/desktop/IdentityPanel.jsx
//
// Left column of the desktop Command surface — the agent as protagonist (the
// stats the mobile loop-home had no room for). Orb portrait + identity (name,
// canonical archetype + disposition, progression level), a career-record block
// (Record · Win rate · Avg score), a games-to-next-level rank bar, and a
// battles-won standing. All data flows from useAgent via the shell — no
// re-derivation here. Desktop-only.
//
// Note (spec D1/D3): "tier" shows the games-based progression level (Rookie /
// Starter / Partner) and the rank bar tracks games-to-next-level — there is no
// competitive Bronze/Silver tier or persisted rank. The third career stat is
// Avg score (the prototype's "Best grade" has no real data source).

import React from 'react';
import { Trophy } from 'lucide-react';
import AgentOrb from '../../shared/AgentOrb';
import { CMD, alpha, Eyebrow, Mono } from '../commandUI';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../../data/archetypeIdentity';

function Tag({ children, color }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.1em',
      textTransform: 'uppercase', color, background: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.25)}`,
      padding: '3px 7px', borderRadius: 6, fontWeight: 500, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

export default function IdentityPanel({ agent, accent, live, record, winRate, levelConfig, nextLevelInfo }) {
  const agentName = agent?.name || 'Your agent';
  const archetypeName = getArchetypeDisplayName(agent?.archetype);
  const disposition = getArchetypeIdentity(agent?.archetype).disposition;
  const levelLabel = levelConfig?.label || 'Rookie';

  const games = agent?.stats?.gamesPlayed ?? 0;
  const wins = agent?.stats?.wins ?? 0;
  const avgScore = agent?.stats?.avgScore;
  const hasGames = games > 0;

  const stats = [
    ['Record', record || '0-0'],
    ['Win rate', hasGames ? `${winRate}%` : '—'],
    ['Avg score', hasGames && avgScore != null ? Math.round(avgScore) : '—'],
  ];

  // Rank progress = position within the current level's games band.
  let rankPct = 100;
  let rankTo = `${levelLabel} · Max level`;
  if (nextLevelInfo && levelConfig) {
    const band = (levelConfig.maxGames + 1) - levelConfig.minGames;
    rankPct = band > 0 ? Math.max(0, Math.min(100, ((games - levelConfig.minGames) / band) * 100)) : 0;
    rankTo = `${levelLabel} → ${nextLevelInfo.label}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* portrait */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: '26px 18px 22px', borderRadius: 20,
        background: `linear-gradient(180deg, ${alpha(accent, 0.08)}, ${CMD.surface} 70%)`,
        border: `1px solid ${CMD.hair}`,
      }}>
        <AgentOrb state={live ? 'live' : 'ready'} size={104} color={accent} />
        <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 18, color: CMD.ink }}>{agentName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
          <Tag color={accent}>{archetypeName}</Tag>
          <Mono style={{ fontSize: 10, letterSpacing: '0.12em', color: CMD.ink3, textTransform: 'uppercase' }}>{levelLabel}</Mono>
        </div>
        {disposition && <div style={{ fontSize: 12.5, color: CMD.ink2, lineHeight: 1.5, marginTop: 12 }}>{disposition}</div>}
      </div>

      {/* career record */}
      <div style={{ padding: '16px 18px', borderRadius: 18, background: CMD.surface, border: `1px solid ${CMD.hair}` }}>
        <Eyebrow style={{ marginBottom: 14 }}>Career record</Eyebrow>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center', flex: 1 }}>
              <Mono style={{ fontSize: 20, fontWeight: 700, color: v === '—' ? CMD.ink3 : CMD.ink, letterSpacing: '-0.01em' }}>{v}</Mono>
              <Mono style={{ fontSize: 8.5, letterSpacing: '0.12em', color: CMD.ink3, textTransform: 'uppercase', display: 'block', marginTop: 4 }}>{k}</Mono>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <Mono style={{ fontSize: 9, letterSpacing: '0.12em', color: CMD.ink3, textTransform: 'uppercase' }}>Rank progress</Mono>
            <Mono style={{ fontSize: 9, letterSpacing: '0.08em', color: CMD.ink2 }}>{rankTo}</Mono>
          </div>
          <div style={{ height: 5, borderRadius: 5, background: CMD.hair, overflow: 'hidden' }}>
            <div style={{ width: `${rankPct}%`, height: '100%', borderRadius: 5, background: accent, boxShadow: `0 0 8px ${alpha(accent, 0.5)}` }} />
          </div>
        </div>
      </div>

      {/* battles won */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 18,
        background: CMD.surface, border: `1px solid ${CMD.hair}`, marginTop: 'auto',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: alpha(CMD.gold, 0.13), border: `1px solid ${alpha(CMD.gold, 0.3)}`,
        }}>
          <Trophy size={19} color={CMD.gold} />
        </div>
        <div style={{ flex: 1 }}>
          <Mono style={{ fontSize: 18, fontWeight: 700, color: CMD.ink }}>{wins}</Mono>
          <span style={{ fontSize: 12, color: CMD.ink3, marginLeft: 6 }}>battles won</span>
        </div>
      </div>
    </div>
  );
}
