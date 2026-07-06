// src/components/Tournament/myTournament/AwaitingView.jsx
//
// STATE 1 — AWAITING DRAFT. The draft countdown (hero), the tournament fill
// (the pod's seat pips at the REAL 4-seat scale — not the mockup's 16), the
// equipped-loadout summary (links out to the Forge), and the held-seat marker.
// All wired to real base-layer data; the fill legend + copy adapt to the real
// human/CPU/open split.

import React from 'react';
import { Hammer } from 'lucide-react';
import { LTOKENS, LX, alpha } from '../../League/leagueTokens';
import { Eyebrow, Mono, Icon, LIcon, Tag } from '../../League/LeagueParts';
import AgentOrb from '../../shared/AgentOrb';
import { TCard, ModHead } from './TCard';

export function AwaitingView({ segments, lockLabel, pips, loadout, onEditInForge, seatSub, compact }) {
  const gap = compact ? 12 : 16;
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <DraftCountdown segments={segments} lockLabel={lockLabel} compact />
        <TournamentFill pips={pips} compact />
        <LoadoutSummary loadout={loadout} onEditInForge={onEditInForge} compact />
        <SeatHeld seatSub={seatSub} compact />
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.28fr 1fr', gap, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <DraftCountdown segments={segments} lockLabel={lockLabel} />
        <LoadoutSummary loadout={loadout} onEditInForge={onEditInForge} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <SeatHeld seatSub={seatSub} />
        <TournamentFill pips={pips} />
      </div>
    </div>
  );
}

// THE HERO — the draft countdown. Gold, glowing. Segments come from the pure
// countdownSegments(); a past lock shows "Resolving…" rather than a negative clock.
export function DraftCountdown({ segments, lockLabel, compact }) {
  const g = LTOKENS.gold;
  const segs = segments?.past
    ? null
    : [[segments?.d ?? 0, 'DAYS'], [segments?.h ?? 0, 'HRS'], [segments?.m ?? 0, 'MIN']];
  return (
    <TCard accent={g} glow pad={compact ? 18 : 24}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(g, 0.16)}, transparent 68%)`, filter: 'blur(6px)',
        }} />
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 12 : 15 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: g, animation: 'lgLiveDot 1.8s infinite', boxShadow: `0 0 8px ${g}` }} />
          <Eyebrow color={g}>Draft countdown</Eyebrow>
          <Mono style={{ marginLeft: 'auto', fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.08em' }}>MONDAY LOCK</Mono>
        </div>

        <div style={{ fontSize: compact ? 19 : 24, fontWeight: 600, color: LTOKENS.ink, lineHeight: 1.12, letterSpacing: '-0.01em', maxWidth: 440 }}>
          {lockLabel}
        </div>

        {segs ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: compact ? 8 : 11, marginTop: compact ? 15 : 19 }}>
            {segs.map(([v, lb], i) => (
              <React.Fragment key={lb}>
                {i > 0 && <Mono style={{ fontSize: compact ? 30 : 40, fontWeight: 300, color: alpha(g, 0.4), lineHeight: 1, paddingBottom: compact ? 12 : 16 }}>:</Mono>}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <Mono style={{ fontSize: compact ? 40 : 56, fontWeight: 700, color: g, lineHeight: 0.9, textShadow: `0 0 26px ${alpha(g, 0.45)}`, letterSpacing: '-0.02em' }}>
                    {String(v).padStart(2, '0')}
                  </Mono>
                  <Mono style={{ fontSize: compact ? 8.5 : 9.5, fontWeight: 600, letterSpacing: '0.16em', color: LTOKENS.ink3 }}>{lb}</Mono>
                </div>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: compact ? 15 : 19, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: g, animation: 'lgLiveDot 1.4s infinite', boxShadow: `0 0 10px ${g}` }} />
            <Mono style={{ fontSize: compact ? 20 : 26, fontWeight: 700, color: g, letterSpacing: '-0.01em' }}>Resolving your draft…</Mono>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: compact ? 16 : 20, paddingTop: compact ? 14 : 16, borderTop: `1px solid ${LTOKENS.hair}` }}>
          <LIcon name="flip" size={13} color={LTOKENS.ink3} stroke={2} />
          <Mono style={{ fontSize: compact ? 10 : 11, color: LTOKENS.ink2, lineHeight: 1.5 }}>
            Your loadout locks the moment the draft runs — tune it until then.
          </Mono>
        </div>
      </div>
    </TCard>
  );
}

// TOURNAMENT FILL — the pod's seat pips at the real 4-seat scale. The first
// human pip is you.
export function TournamentFill({ pips, compact }) {
  const { human = 0, cpu = 0, open = 0, total = 4 } = pips || {};
  const filled = human + cpu;
  const pct = total ? Math.round((filled / total) * 100) : 0;
  const cells = [];
  for (let i = 0; i < human; i++) cells.push(i === 0 ? 'you' : 'human');
  for (let i = 0; i < cpu; i++) cells.push('cpu');
  for (let i = 0; i < open; i++) cells.push('open');
  const PC = { you: LTOKENS.teal, human: LX.human, cpu: LX.cpu, open: LTOKENS.hair2 };
  return (
    <TCard>
      <ModHead
        icon="users" color={LX.human} label="Tournament fill" sub={open > 0 ? 'Filling up' : 'Group set'}
        right={(
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
              <Mono style={{ fontSize: 22, fontWeight: 700, color: LTOKENS.ink, lineHeight: 1 }}>{filled}</Mono>
              <Mono style={{ fontSize: 12, fontWeight: 600, color: LTOKENS.ink3 }}>/ {total}</Mono>
            </div>
            <Mono style={{ fontSize: 8.5, color: LTOKENS.ink3, letterSpacing: '0.1em' }}>SEATS · {pct}%</Mono>
          </div>
        )}
      />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, 1fr)`, gap: 6, marginBottom: 13 }}>
        {cells.map((k, i) => {
          const you = k === 'you';
          const o = k === 'open';
          return (
            <div key={i} style={{
              position: 'relative', height: 24, borderRadius: 6,
              background: o ? 'transparent' : alpha(PC[k], you ? 0.9 : 0.32),
              border: `1px solid ${o ? LTOKENS.hair2 : alpha(PC[k], you ? 1 : 0.55)}`,
              boxShadow: you ? `0 0 10px ${alpha(LTOKENS.teal, 0.6)}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {you && <Mono style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.06em', color: LTOKENS.bg }}>YOU</Mono>}
              {o && <span style={{ width: 3, height: 3, borderRadius: '50%', background: LTOKENS.ink3 }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 12 : 16, flexWrap: 'wrap' }}>
        <FillLeg color={LX.human} n={human} label="human" />
        <FillLeg color={LX.cpu} n={cpu} label="CPU" />
        <FillLeg color={LTOKENS.ink3} n={open} label="open" hollow />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LTOKENS.hair}` }}>
        <LIcon name="cpu" size={12} color={LTOKENS.ink3} stroke={2} />
        <Mono style={{ fontSize: compact ? 9.5 : 10.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>
          {open > 0
            ? <>The {open} open {open === 1 ? 'seat' : 'seats'} fill to CPU when your group locks Monday.</>
            : <>Your group is set — every seat claimed before the lock.</>}
        </Mono>
      </div>
    </TCard>
  );
}

function FillLeg({ color, n, label, hollow }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: hollow ? 'transparent' : alpha(color, 0.4), border: `1px solid ${alpha(color, hollow ? 0.5 : 0.65)}` }} />
      <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2 }}><b style={{ color: LTOKENS.ink }}>{n}</b> {label}</Mono>
    </span>
  );
}

// YOUR LOADOUT — a summary of what's equipped; editing links to the Forge. Only
// real fields are shown (watchlist name + tickers + archetype); no fabricated
// rule chips.
export function LoadoutSummary({ loadout, onEditInForge, compact }) {
  const l = loadout || {};
  const tickers = Array.isArray(l.tickers) ? l.tickers : [];
  return (
    <TCard>
      <ModHead
        icon="bolt" color={LTOKENS.teal} label="Your loadout" sub="Equipped · editable until the lock"
        right={(
          <button
            className="lg-tap" onClick={onEditInForge}
            style={{
              all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9, background: alpha(LTOKENS.teal, 0.12), border: `1px solid ${alpha(LTOKENS.teal, 0.38)}`,
            }}
          >
            <Hammer size={12} color={LTOKENS.teal} strokeWidth={2.2} />
            <Mono style={{ fontSize: 11, fontWeight: 700, color: LTOKENS.teal }}>Edit in Forge</Mono>
          </button>
        )}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14 }}>
        <AgentOrb color={LTOKENS.teal} size={compact ? 40 : 46} state="ready" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: compact ? 17 : 19, fontWeight: 700, color: LTOKENS.ink }}>
              {l.watchlistName || 'Equipped loadout'}
            </span>
            <Tag color={LTOKENS.teal}>Equipped</Tag>
          </div>
          {l.archLabel && (
            <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3, letterSpacing: '0.03em', marginTop: 3, display: 'block' }}>{l.archLabel}</Mono>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
        <Icon name="layers" size={14} color={LTOKENS.ink3} />
        <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, fontWeight: 600 }}>{l.watchlistName || 'Watchlist'}</Mono>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {tickers.length
            ? tickers.slice(0, 6).map((t) => <Mono key={t} style={{ fontSize: 10, color: LTOKENS.ink3, fontWeight: 600 }}>{t}</Mono>)
            : <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>Book drafts Monday</Mono>}
        </div>
      </div>
    </TCard>
  );
}

// YOUR SEAT — held / confirmed. Real membership.
export function SeatHeld({ seatSub, compact }) {
  return (
    <TCard accent={LTOKENS.gold}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: alpha(LTOKENS.gold, 0.14), border: `1px solid ${alpha(LTOKENS.gold, 0.4)}`,
        }}>
          <LIcon name="ranked" size={19} color={LTOKENS.gold} stroke={2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: LTOKENS.ink }}>Your seat is held</span>
            <LIcon name="check" size={13} color={LTOKENS.teal} stroke={2.6} />
          </div>
          <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.02em', marginTop: 2, display: 'block' }}>
            {seatSub || 'Your group forms at the Monday draft'}
          </Mono>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999,
          background: alpha(LTOKENS.teal, 0.1), border: `1px solid ${alpha(LTOKENS.teal, 0.3)}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: LTOKENS.teal }} />
          <Mono style={{ fontSize: 9.5, fontWeight: 700, color: LTOKENS.teal, letterSpacing: '0.08em' }}>CONFIRMED</Mono>
        </span>
      </div>
    </TCard>
  );
}
