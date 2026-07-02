// src/components/League/battleArena/CommandDock.jsx
//
// League Battle View V2 — THE COMMAND DOCK. Three panels under the climb hero:
//   • DockAgentSix  — the agent's six, teal, WATCH-ONLY (it manages these).
//   • DockYourThree — your three, blue, where YOU act: a per-pick flip + the
//     "Claim a name" doorway to Free Agency.
//   • DockStatePanel — live: the agent's voice + ask · awaiting: the countdown ·
//     complete: the verdict + the Film Room doorway.
//
// Translated from the locked Claude Design (battle-arena-desktop / -core),
// re-skinned onto the shared League palette. Stars come in as the flat Phase-1
// rows; the dock is presentational over them.

import React from 'react';
import { Mono, Eyebrow, LIcon, Icon, clockStr } from '../LeagueParts';
import { LTOKENS, alpha } from '../leagueTokens';
import { StarCell } from './StarCell';
import { VoiceLane } from './VoiceLane';
import { ArenaOrb, MeterKey } from './ArenaPrimitives';
import { OWN_AGENT, OWN_YOU } from './arenaTheme';
import { prefersReducedMotion } from './arenaEngineCore';
import { useArenaFlips } from './useArenaFlips';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const bumpFor = (beatStar, tk) => (beatStar && beatStar.tk === tk ? beatStar.key : 0);

// the agent's recent landed move ("swapped SOFI → MSTR · 1h ago"). Reused by the
// mobile Agent-Portfolio panel; returns null when there's no move (live data's
// agentMove is null until the swap-chip fast-follow).
export function AgentMoveChip({ move, color }) {
  if (!move) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderRadius: 999, marginLeft: 'auto',
      background: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.28)}` }}>
      <LIcon name="scissors" size={12} color={color} stroke={2} />
      <Mono style={{ fontSize: 10.5, color: LTOKENS.ink, fontWeight: 600 }}>
        <span style={{ color: LTOKENS.ink3, textDecoration: 'line-through' }}>{move.from}</span>
        <span style={{ color, margin: '0 4px' }}>→</span>{move.to}
      </Mono>
      <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>{move.ago}</Mono>
    </span>
  );
}

// a per-pick FLIP control — long↔short, anytime. `compact` (mobile dense row):
// slightly tighter padding/type. Default off → desktop dock byte-identical.
export function FlipControl({ dir, onFlip, color = OWN_YOU, compact = false }) {
  const next = dir === 'long' ? 'short' : 'long';
  return (
    <button className="bv2-tap" onClick={() => onFlip(next)} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', marginTop: compact ? 7 : 8, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: compact ? '5px' : '6px', borderRadius: 8, background: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.34)}` }}>
      <LIcon name="flip" size={compact ? 11 : 12} color={color} stroke={2} />
      <Mono style={{ fontSize: compact ? 10 : 10.5, fontWeight: 700, color, letterSpacing: '0.02em' }}>Flip to {next}</Mono>
    </button>
  );
}

// ── the agent's six — watch-only ────────────────────────────────────────────
export function DockAgentSix({ stars, dormant, complete, beatStar, flareKey = 0, headline, move, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, borderRadius: 16, padding: '13px 14px',
      background: alpha('#0A1520', 0.5), border: `1px solid ${LTOKENS.hair}`, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        {/* the agent orb flares when it makes a swap (flareKey bumps per swap).
            A user flip is YOUR move, not the agent's, so it never flares here. */}
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <ArenaOrb state={dormant ? 'ready' : 'live'} size={22} color={OWN_AGENT} />
          {!dormant && flareKey > 0 && !prefersReducedMotion() && (
            <span key={flareKey} className="bv2-flare" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${OWN_AGENT}`, pointerEvents: 'none' }} />
          )}
        </span>
        <div>
          <Eyebrow color={OWN_AGENT}>Your agent&rsquo;s six</Eyebrow>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Icon name="eye" size={10} color={LTOKENS.ink3} />
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>watch-only · it manages these</Mono>
          </span>
        </div>
        {!dormant && <AgentMoveChip move={move} color={OWN_AGENT} />}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr', gap: 10, minHeight: 0 }}>
        {stars.map((s) => (
          <StarCell key={s.tk} star={s} dormant={dormant} complete={complete} headline={headline} owner={OWN_AGENT}
            bump={bumpFor(beatStar, s.tk)} style={{ minWidth: 0 }} />
        ))}
      </div>
    </div>
  );
}

// ── your three — where you act ──────────────────────────────────────────────
export function DockYourThree({ stars, dormant, complete, state, wire, wireClock, beatStar, onFlip, onFlipDrama, onClaim, headline, style }) {
  const live = state === 'live';
  const open = live && wire?.open;
  const c = OWN_YOU;
  // Layer-level pending marker + close-only claim messaging (Deliverables 3-4).
  // Canonical rounds only: legacy stars carry settleState null → pending 0, and
  // wire.canonical is false → the claim label is unchanged.
  const pending = stars.filter((s) => s?.settleState === 'pending').length;
  const closedForMarket = wire?.canonical && wire?.reason === 'market_hours';
  // The optimistic-write + server-authoritative ROLLBACK flip controller, shared
  // VERBATIM with the mobile Your-Portfolio panel (useArenaFlips) so the two never
  // drift on this money-adjacent path.
  const { dirOf, doFlip, flipError } = useArenaFlips(stars, onFlip, onFlipDrama);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, borderRadius: 16, padding: '13px 14px',
      background: `linear-gradient(160deg, ${alpha(c, 0.08)}, ${alpha(LTOKENS.bg, 0.5)} 60%)`, border: `1px solid ${alpha(c, 0.32)}`,
      boxShadow: `0 14px 40px -20px ${alpha(c, 0.4)}`, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(c, 0.16), border: `1px solid ${alpha(c, 0.45)}` }}>
          <LIcon name="long" size={12} color={c} stroke={2.4} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eyebrow color={c}>Your three</Eyebrow>
            {pending > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 5,
                background: alpha(LTOKENS.ink3, 0.12), border: `1px solid ${LTOKENS.hair2}` }}>
                <Icon name="clock" size={9} color={LTOKENS.ink3} stroke={2.2} />
                <Mono style={{ fontSize: 8.5, fontWeight: 700, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>{pending} pick{pending === 1 ? '' : 's'} pending</Mono>
              </span>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <LIcon name="flip" size={10} color={c} stroke={2} />
            <Mono style={{ fontSize: 9, color: alpha(c, 0.85), letterSpacing: '0.04em' }}>yours to act · flip a pick or claim</Mono>
          </span>
        </div>
        {/* the claim doorway */}
        <button className="bv2-tap" onClick={open ? onClaim : undefined} disabled={!open}
          style={{ all: 'unset', cursor: open ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3,
            padding: '6px 11px', borderRadius: 10, background: open ? c : LTOKENS.surface, border: open ? 'none' : `1px solid ${LTOKENS.hair}`, opacity: open ? 1 : 0.7 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="plus" size={12} color={open ? LTOKENS.bg : LTOKENS.ink3} stroke={2.4} />
            <Mono style={{ fontSize: 11.5, fontWeight: 700, color: open ? LTOKENS.bg : LTOKENS.ink3 }}>Claim a name</Mono>
            <LIcon name="arrowUpRight" size={11} color={open ? LTOKENS.bg : LTOKENS.ink3} stroke={2.4} />
          </span>
          <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: open ? alpha('#0A0B0E', 0.7) : LTOKENS.ink3 }}>
            {open ? `FREE AGENCY · ${wire.claimsUsed}/${wire.claimsTotal} · ${clockStr(wireClock != null ? wireClock : wire.closes)}`
              : closedForMarket ? 'CLAIMS OPEN AFTER CLOSE' : 'WIRE CLOSED'}
          </Mono>
        </button>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, minHeight: 0 }}>
        {stars.map((s) => (
          <StarCell key={s.tk} star={s} dormant={dormant} complete={complete} headline={headline} owner={c} dir={dirOf(s)}
            bump={bumpFor(beatStar, s.tk)} style={{ minWidth: 0 }}
            footer={live ? <FlipControl dir={dirOf(s)} onFlip={(nd) => doFlip(s.tk, nd)} color={c} /> : null} />
        ))}
      </div>
      {flipError && (
        <Mono style={{ marginTop: 7, fontSize: 9.5, fontWeight: 600, color: '#F2766B', letterSpacing: '0.01em' }}>{flipError}</Mono>
      )}
    </div>
  );
}

// ── the agent voice + ask (the live state panel body) ───────────────────────
// `compact` (mobile chat tab): tighter padding and — crucially — the voice lane is
// a plain block (not a flex:1 internal-scroll region), so it flows in the mobile
// arena's page scroll instead of collapsing to 0 height in an auto-height parent.
// Default off → DockStatePanel's desktop call is byte-identical.
export function AgentDock({ lines, archName, live, ask, onAsk, compact = false, style,
  askLive = null, remaining = null, asking = false, chatReady = false }) {
  const c = OWN_AGENT;
  const [asked, setAsked] = React.useState([]);
  const handleAsk = (i) => { if (!asked.includes(i)) setAsked((a) => [...a, i]); onAsk(i); };

  // Two-way ask is LIVE only when the flag + a real battle identity are present
  // (chatReady from the engine). Otherwise this is today's stub — decorative box,
  // canned chip echoes — byte-identical.
  const chatOn = chatReady && typeof askLive === 'function';
  const [draft, setDraft] = React.useState('');
  const submitDraft = () => {
    const t = draft.trim();
    if (!t || asking) return;
    setDraft('');
    askLive(t);
  };
  const tapChip = (i, qa) => {
    if (chatOn) { if (!asking) askLive(qa.q); return; }
    handleAsk(i);
  };

  return (
    <div style={{ borderRadius: 16, padding: compact ? '13px 14px' : '15px 17px', position: 'relative', display: 'flex', flexDirection: 'column',
      background: alpha(LTOKENS.bg, 0.72), backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: `1px solid ${alpha(c, 0.22)}`, boxShadow: '0 18px 50px -18px rgba(0,0,0,0.7)', ...style }}>
      <div className="bv2-scroll" style={compact ? { minHeight: 0 } : { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <VoiceLane lines={lines} archName={archName} color={c} live={live} max={compact ? 3 : 4} />
      </div>
      <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${LTOKENS.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <LIcon name="spark" size={12} color={c} stroke={2} />
          <Eyebrow color={c}>Ask your agent</Eyebrow>
          {/* the quiet, persistent counter — "N left today" (says "today" so the daily
              reset is never a surprise). Server-fed; absent until the first read. */}
          {chatOn && Number.isFinite(remaining) && (
            <Mono style={{ fontSize: 10.5, fontWeight: 600, color: remaining > 0 ? LTOKENS.ink3 : c, marginLeft: 'auto' }}>
              {remaining} left today
            </Mono>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 9 }}>
          {(ask || []).map((qa, i) => {
            const on = !chatOn && asked.includes(i); // stub-only "asked" highlight
            return (
              <button key={qa.q} className="bv2-tap" onClick={() => tapChip(i, qa)} disabled={chatOn && asking}
                style={{ all: 'unset', cursor: chatOn && asking ? 'default' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 999,
                  // opacity only under the live path — keeps the flag-off stub chip byte-identical
                  opacity: chatOn ? (asking ? 0.5 : 1) : undefined,
                  background: on ? alpha(c, 0.1) : LTOKENS.surface, border: `1px solid ${on ? alpha(c, 0.4) : LTOKENS.hair2}` }}>
                <Mono style={{ fontSize: 11, fontWeight: 600, color: on ? c : LTOKENS.ink2 }}>{qa.q}</Mono>
              </button>
            );
          })}
        </div>
        {chatOn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 11, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}`, opacity: asking ? 0.6 : 1 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitDraft(); } }}
              disabled={asking}
              placeholder={asking ? 'Thinking…' : 'Ask anything…'}
              maxLength={2000}
              style={{ all: 'unset', flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 11.5, color: LTOKENS.ink }}
            />
            <button className="bv2-tap" onClick={submitDraft} disabled={asking || !draft.trim()} aria-label="Send"
              style={{ all: 'unset', cursor: asking || !draft.trim() ? 'default' : 'pointer', width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: alpha(c, draft.trim() && !asking ? 0.14 : 0.06), border: `1px solid ${alpha(c, draft.trim() && !asking ? 0.36 : 0.18)}` }}>
              <LIcon name="arrowUp" size={13} color={c} stroke={2.2} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 11, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <Mono style={{ fontSize: 11.5, color: LTOKENS.ink3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ask anything…</Mono>
            <span style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(c, 0.14), border: `1px solid ${alpha(c, 0.36)}` }}>
              <LIcon name="arrowUp" size={13} color={c} stroke={2.2} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── the dock's right panel — voice (live) / countdown (awaiting) / verdict ──
export function DockStatePanel({ state, mode, eng, archName, voice, pod, ask, youRank, onFilm, style }) {
  if (state === 'live') {
    return <AgentDock lines={eng.lines} archName={archName} live ask={ask} onAsk={eng.askAgent}
      askLive={eng.askLive} remaining={eng.remaining} asking={eng.asking} chatReady={eng.chatReady} style={style} />;
  }
  if (state === 'awaiting') {
    return (
      <div style={{ borderRadius: 16, padding: '14px 15px', background: alpha(LTOKENS.bg, 0.72), border: `1px solid ${alpha(OWN_AGENT, 0.22)}`, display: 'flex', flexDirection: 'column', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <ArenaOrb state="ready" size={38} color={OWN_AGENT} />
          <div>
            <Mono style={{ fontSize: 8.5, letterSpacing: '0.16em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>Awaiting open</Mono>
            <Mono style={{ fontSize: 25, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '0.02em', display: 'block', marginTop: 2 }}>{clockStr(eng.closeClock != null ? eng.closeClock : pod.toOpen)}</Mono>
          </div>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LTOKENS.hair}` }}>
          <VoiceLane lines={[{ ...voice.wait, t: 'now', _k: 0 }]} archName={archName} color={OWN_AGENT} live={false} max={1} />
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 12 }}><MeterKey /></div>
      </div>
    );
  }
  // complete
  const advanced = youRank <= 2;
  const tone = mode === 'ranked' ? (advanced ? LTOKENS.teal : '#F2766B') : OWN_AGENT;
  return (
    <div style={{ borderRadius: 16, padding: '14px 15px', display: 'flex', flexDirection: 'column',
      background: `linear-gradient(160deg, ${alpha(tone, 0.12)}, ${alpha(LTOKENS.bg, 0.7)} 60%)`, border: `1px solid ${alpha(tone, 0.35)}`, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <LIcon name={mode === 'ranked' && advanced ? 'ranked' : 'flag'} size={15} color={tone} stroke={2} />
        <Eyebrow color={tone}>{mode === 'ranked' ? (advanced ? 'You advanced' : 'Run ended') : 'Training · finish'}</Eyebrow>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink, marginTop: 8 }}>
        {ordinal(youRank)} of four{mode === 'ranked' && advanced ? <> — <span style={{ color: tone }}>next round.</span></> : '.'}
      </div>
      <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, lineHeight: 1.55, marginTop: 8 }}>
        Final badges below; rivals&rsquo; books were sealed until now. The Film Room opens the whole week.
      </Mono>
      <button className="bv2-tap" onClick={onFilm} style={{ all: 'unset', cursor: 'pointer', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        padding: '12px 16px', borderRadius: 12, background: alpha(LTOKENS.gold, 0.16), border: `1px solid ${alpha(LTOKENS.gold, 0.45)}` }}>
        <ArenaOrb state="review" size={22} color={LTOKENS.gold} />
        <Mono style={{ fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>Break the seal · Film Room</Mono>
        <Icon name="chevR" size={14} color={LTOKENS.gold} />
      </button>
    </div>
  );
}
