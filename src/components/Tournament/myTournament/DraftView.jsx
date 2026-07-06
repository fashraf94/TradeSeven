// src/components/Tournament/myTournament/DraftView.jsx
//
// STATE 2 — DRAFT LIVE (single-shot resolution). Per the spec correction, the
// ranked draft is a pre-committed board resolved in ONE shot at the Monday lock
// — there is no interactive "your turn" phase. So this is a brief status beat
// ("Drafting your lineup…") plus a read-only glance of your 3 picks and your
// agent's 6 as they resolve. No pick UI, no "Go to the draft" board button.

import React from 'react';
import { PICKS_PER_PLAYER, AGENT_PICKS_PER_AGENT } from '../../../constants/leagueTournament';
import { LTOKENS, LX, alpha } from '../../League/leagueTokens';
import { Eyebrow, Mono, Icon, LIcon } from '../../League/LeagueParts';
import AgentOrb from '../../shared/AgentOrb';
import { TCard, ModHead } from './TCard';

const OWN_YOU = LX.human;   // human-owned (blue)
const OWN_AGENT = LTOKENS.teal; // the agent (teal)

export function DraftView({ yourPicks = [], agentPicks = [], compact }) {
  const gap = compact ? 12 : 14;
  return (
    <div style={{ maxWidth: compact ? '100%' : 660, margin: '0 auto', display: 'flex', flexDirection: 'column', gap }}>
      <DraftStatusGlance yourPicks={yourPicks} agentPicks={agentPicks} compact={compact} />
      <DraftPicksGlance yourPicks={yourPicks} agentPicks={agentPicks} compact={compact} />
    </div>
  );
}

// The resolution beat. NOT the draft interface — the draft resolves in one shot
// server-side; this reports that it's happening.
export function DraftStatusGlance({ yourPicks, agentPicks, compact }) {
  const c = LTOKENS.teal;
  const done = yourPicks.length + agentPicks.length;
  const total = PICKS_PER_PLAYER + AGENT_PICKS_PER_AGENT;
  return (
    <TCard accent={c} glow pad={compact ? 18 : 22}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 15 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, animation: 'lgLiveDot 1.4s infinite', boxShadow: `0 0 8px ${c}` }} />
        <Eyebrow color={c}>Draft resolving</Eyebrow>
        <Mono style={{ marginLeft: 'auto', fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.08em' }}>{done} / {total} LOCKED</Mono>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <AgentOrb color={c} size={compact ? 46 : 54} state="live" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: compact ? 21 : 25, fontWeight: 700, color: LTOKENS.ink, lineHeight: 1.05 }}>
            Drafting your lineup…
          </div>
          <Mono style={{ fontSize: compact ? 11 : 12, color: c, fontWeight: 600, letterSpacing: '0.02em', marginTop: 4, display: 'block' }}>
            Your {PICKS_PER_PLAYER} picks + your agent's {AGENT_PICKS_PER_AGENT}, resolving
          </Mono>
        </div>
      </div>

      {/* resolution progress — one bar per pick */}
      <div style={{ display: 'flex', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < done;
          return (
            <div key={i} style={{
              flex: '1 1 6%', height: 5, borderRadius: 4, minWidth: 8,
              background: filled ? c : LTOKENS.hair2,
              boxShadow: filled ? `0 0 8px ${alpha(c, 0.6)}` : 'none',
            }} />
          );
        })}
      </div>

      <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, textAlign: 'center', marginTop: 14, display: 'block', letterSpacing: '0.03em' }}>
        Your lineup resolves automatically — this updates live, then opens into your battle.
      </Mono>
    </TCard>
  );
}

// The picks arriving — your three + the agent's six, read-only glance.
export function DraftPicksGlance({ yourPicks, agentPicks, compact }) {
  const three = padPicks(yourPicks, PICKS_PER_PLAYER);
  const six = padPicks(agentPicks, AGENT_PICKS_PER_AGENT);
  const agentIn = six.filter((p) => p.tk).length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: compact ? 12 : 14 }}>
      <TCard>
        <ModHead icon="long" color={OWN_YOU} label="Your three" sub="Your hand-picks, arriving" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {three.map((h, i) => <PickRow key={i} h={h} n={i + 1} color={OWN_YOU} />)}
        </div>
      </TCard>
      <TCard>
        <ModHead
          icon="cpu" color={OWN_AGENT} label="Agent's six" sub="Auto-drafting · watch-only"
          right={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="eye" size={11} color={LTOKENS.ink3} />
              <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>{agentIn}/{AGENT_PICKS_PER_AGENT}</Mono>
            </span>
          )}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {six.map((h, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8,
              background: h.tk ? LTOKENS.surface : 'transparent',
              border: `1px ${h.tk ? 'solid' : 'dashed'} ${h.tk ? alpha(OWN_AGENT, 0.32) : LTOKENS.hair2}`,
            }}>
              {h.tk ? (
                <>
                  <LIcon name="long" size={10} color={alpha(OWN_AGENT, 0.85)} stroke={2.2} />
                  <Mono style={{ fontSize: 11.5, color: LTOKENS.ink, fontWeight: 600 }}>{h.tk}</Mono>
                </>
              ) : (
                <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.05em' }}>· · ·</Mono>
              )}
            </span>
          ))}
        </div>
      </TCard>
    </div>
  );
}

function PickRow({ h, n, color }) {
  const pending = !h.tk;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10,
      background: pending ? 'transparent' : alpha(color, 0.06),
      border: `1px ${pending ? 'dashed' : 'solid'} ${pending ? LTOKENS.hair2 : alpha(color, 0.28)}`,
    }}>
      <Mono style={{ fontSize: 10, fontWeight: 700, color: pending ? LTOKENS.ink3 : color, width: 14 }}>{n}</Mono>
      {pending ? (
        <>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'lgLiveDot 1.2s infinite' }} />
          <Mono style={{ fontSize: 11.5, color, fontWeight: 600, letterSpacing: '0.02em' }}>Resolving…</Mono>
        </>
      ) : (
        <>
          <LIcon name={h.dir === 'short' ? 'short' : 'long'} size={13} color={h.dir === 'short' ? LX.alert : alpha(color, 0.9)} stroke={2.2} />
          <Mono style={{ fontSize: 13.5, color: LTOKENS.ink, fontWeight: 700 }}>{h.tk}</Mono>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <LIcon name="check" size={12} color={color} stroke={2.6} />
            <Mono style={{ fontSize: 9.5, color, fontWeight: 700, letterSpacing: '0.06em' }}>LOCKED</Mono>
          </span>
        </>
      )}
    </div>
  );
}

// Normalize a pick list to fixed length, each { tk, dir } (tk null = pending).
function padPicks(picks, n) {
  const out = (picks || []).slice(0, n).map((p) => {
    if (typeof p === 'string') return { tk: p, dir: 'long' };
    return { tk: p?.tk || p?.symbol || null, dir: p?.dir || 'long' };
  });
  while (out.length < n) out.push({ tk: null, dir: null });
  return out;
}
