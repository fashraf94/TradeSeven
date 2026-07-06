// src/components/Tournament/myTournament/BracketView.jsx
//
// STATE 3 — BRACKET LIVE (the launchpad). The SeedHero (position + real career
// tier + standing), the "Open my battle" hero (the primary action — opens the
// existing battle surface), your pod of four (REAL players/scores/rank), and
// your-path funnel.
//
// Spec correction #2 — the flat base layer has no bracket, so the ranked-only
// decorations are HONEST EMPTY: the pod renders real but its top-2 / cut-line /
// advance framing is replaced by an "activates in the monthly bracket" caption,
// and YourPath is a dimmed, non-populated scaffold with the same honest line.

import React from 'react';
import { LTOKENS, LX, alpha } from '../../League/leagueTokens';
import { Eyebrow, Mono, LIcon, Score, AgentAvatar, KindMark, Tag } from '../../League/LeagueParts';
import AgentOrb from '../../shared/AgentOrb';
import { TCard, ModHead } from './TCard';
import { SeedHero } from './SeedHero';

export function BracketView({ seed, rank, standing, pod, battleDayLabel, onOpenBattle, compact }) {
  const gap = compact ? 12 : 16;
  const heroProps = { seed, rank, standing, compact };
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <SeedHero {...heroProps} />
        <BattleLaunch dayLabel={battleDayLabel} onOpenBattle={onOpenBattle} compact />
        <YourPod pod={pod} compact />
        <YourPath compact />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <SeedHero {...heroProps} />
      <BattleLaunch dayLabel={battleDayLabel} onOpenBattle={onOpenBattle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, alignItems: 'start' }}>
        <YourPod pod={pod} />
        <YourPath />
      </div>
    </div>
  );
}

// THE HERO — opening your own live battle is the primary action. The page is a
// launchpad into the game, not a dead-end status board.
export function BattleLaunch({ dayLabel, onOpenBattle, compact }) {
  const c = LTOKENS.teal;
  return (
    <TCard accent={c} glow pad={compact ? 18 : 24} style={{ boxShadow: `0 26px 64px -30px ${alpha(c, 0.75)}` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -70, left: -30, width: 260, height: 260, borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(c, 0.16)}, transparent 66%)`, filter: 'blur(6px)',
        }} />
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 13 : 15 }}>
          <Eyebrow color={c}>Your battle · launchpad</Eyebrow>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
            background: alpha(c, 0.12), border: `1px solid ${alpha(c, 0.3)}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, animation: 'lgLiveDot 1.6s infinite' }} />
            <Mono style={{ fontSize: 10, color: c, fontWeight: 700, letterSpacing: '0.06em' }}>LIVE</Mono>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 13 : 16 }}>
          <AgentOrb color={c} size={compact ? 48 : 58} state="live" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: compact ? 21 : 26, fontWeight: 700, color: LTOKENS.ink, lineHeight: 1.04, letterSpacing: '-0.01em' }}>
              Your pod is trading now
            </div>
            <Mono style={{ fontSize: compact ? 11 : 12, color: LTOKENS.ink2, letterSpacing: '0.02em', marginTop: 5, display: 'block' }}>
              {dayLabel ? `${dayLabel} · ` : ''}jump in to watch it play and work your three
            </Mono>
          </div>
        </div>

        <button
          className="lg-tap" onClick={onOpenBattle}
          style={{
            all: 'unset', boxSizing: 'border-box', width: '100%', marginTop: compact ? 16 : 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: compact ? '15px' : '17px', borderRadius: 13,
            background: c, boxShadow: `0 18px 42px -14px ${alpha(c, 0.8)}`,
          }}
        >
          <span style={{ fontSize: compact ? 15.5 : 17, fontWeight: 700, color: LTOKENS.bg, letterSpacing: '-0.01em' }}>Open my battle</span>
          <LIcon name="arrowUpRight" size={compact ? 17 : 19} color={LTOKENS.bg} stroke={2.6} />
        </button>
      </div>
    </TCard>
  );
}

// YOUR GROUP — the pod of four, REAL. Ranked by composite; the advance/cut-line
// framing is honest-emptied (base layer has no bracket).
export function YourPod({ pod, compact }) {
  const seats = (pod?.seats || []).filter(Boolean);
  const ranked = [...seats]
    .sort((a, b) => (b.pscore ?? 0) - (a.pscore ?? 0))
    .map((p, i) => ({ ...p, rank: i + 1 }));
  return (
    <TCard>
      <ModHead
        icon="users" color={LTOKENS.ink3} label={`Your group${pod?.name ? ` · ${pod.name}` : ''}`} sub="Your pod of four"
      />
      <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${LTOKENS.hair}` }}>
        {ranked.map((p, i) => <PodRow key={p.id || i} p={p} border={i > 0} />)}
      </div>
      {/* honest-empty: advancement is a bracket-only concept, not live in the base layer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LTOKENS.hair}` }}>
        <LIcon name="flag" size={12} color={LTOKENS.ink3} stroke={2} />
        <Mono style={{ fontSize: compact ? 9.5 : 10.5, color: LTOKENS.ink3, lineHeight: 1.5 }}>
          Advancement activates in the monthly bracket.
        </Mono>
      </div>
    </TCard>
  );
}

function PodRow({ p, border }) {
  const you = p.kind === 'you' || p.you;
  const color = p.color || (p.kind === 'cpu' ? LX.cpu : LX.human);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px',
      background: you ? alpha(color, 0.07) : 'transparent', borderTop: border ? `1px solid ${LTOKENS.hair}` : 'none',
    }}>
      <Mono style={{ fontSize: 12.5, fontWeight: 700, width: 14, textAlign: 'center', color: LTOKENS.ink3 }}>{p.rank}</Mono>
      <AgentAvatar agent={{ kind: you ? 'human' : p.kind, color, you }} size={30} live={you} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: you ? color : LTOKENS.ink }}>{p.name}</span>
          {you && <Tag color={color}>You</Tag>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {p.arch && <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{p.arch}</Mono>}
          <KindMark agent={{ kind: p.kind, you, owner: p.owner }} style={{ transform: 'scale(0.86)', transformOrigin: 'left' }} />
        </div>
      </div>
      <Score v={Number.isFinite(p.pscore) ? p.pscore : 0} size={15} />
    </div>
  );
}

// YOUR PATH — honest-empty. The Group→Semifinals→Final Four→Champion funnel is
// a bracket-only concept; render a dimmed scaffold, not fabricated bracket data.
const PATH_NODES = [
  { label: 'Your group', glyph: 'users' },
  { label: 'Semifinals', glyph: 'layers' },
  { label: 'Final Four', glyph: 'ranked' },
  { label: 'Champion', glyph: 'crown' },
];

export function YourPath({ compact }) {
  return (
    <TCard>
      <ModHead icon="flag" color={LTOKENS.ink3} label="Your path" sub="Group → Final Four → champion" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.45, marginBottom: 12 }}>
        {PATH_NODES.map((n, i) => (
          <React.Fragment key={n.label}>
            {i > 0 && <div style={{ flex: 1, height: 1.5, background: LTOKENS.hair2, margin: '0 4px' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: LTOKENS.surface, border: `1.5px solid ${LTOKENS.hair2}`,
              }}>
                <LIcon name={n.glyph} size={14} color={LTOKENS.ink3} stroke={2} />
              </span>
              <Mono style={{ fontSize: compact ? 8.5 : 9.5, color: LTOKENS.ink3, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{n.label}</Mono>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 11, borderTop: `1px solid ${LTOKENS.hair}` }}>
        <LIcon name="spark" size={12} color={alpha(LTOKENS.gold, 0.8)} stroke={2} />
        <Mono style={{ fontSize: compact ? 9.5 : 10.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>
          Activates in the monthly bracket.
        </Mono>
      </div>
    </TCard>
  );
}
