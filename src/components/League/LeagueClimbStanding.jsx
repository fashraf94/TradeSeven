// src/components/League/LeagueClimbStanding.jsx
//
// The climb's standing surfaces: the vivid ranked-four (ctx-gated cut), the
// training finish vs the ranked verdict, the two layer panels + film room, and
// the two tap targets (a gate → that close; a climber → their two layers + film
// room). Ported from league-climb-screen.jsx. The weighting of the two layers is
// INTERNAL — never shown as a multiplier/ratio/formula. Overlays are real
// position:fixed bottom sheets (the redesign's ActionLayer idiom).

import React from 'react';
import { LTOKENS, LX, alpha } from './leagueTokens';
import {
  Eyebrow, Mono, Icon, LIcon, Tag, AgentAvatar, KindMark, Score, SectionLabel, PortfolioMini, CountScore,
} from './LeagueParts';
import { CutLine } from './LeaguePod';
import { clbRankAt, CLB_DAYS, CLB_WHY } from './leagueClimbFixtures';

const clbBook = (b) => (!b || !b.length ? 0
  : +b.reduce((s, h) => s + ((h.w != null ? h.w : 100 / b.length) / 100) * h.c * (h.dir === 'short' ? -1 : 1), 0).toFixed(1));

// ── a layer panel (the picks / the agent book) — agent layer tinted violet ──
export function CLBLayer({ title, sub, book, kind }) {
  const pnl = clbBook(book), tint = kind === 'agent' ? LX.cpu : LX.human;
  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 14, padding: '12px 13px',
      background: kind === 'agent' ? alpha('#1C1A27', 0.7) : LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <LIcon name={kind === 'agent' ? 'cpu' : 'user'} size={13} color={tint} stroke={2} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>{title}</div>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>{sub}</Mono>
          </div>
        </div>
        <Score v={pnl} size={13} />
      </div>
      <PortfolioMini book={book} accent={tint} />
    </div>
  );
}

// ── film room — sealed for live opponents, open for you & at completion ─────
export function CLBFilm({ player, sealed }) {
  if (sealed) {
    return (
      <div style={{ borderRadius: 16, padding: 16, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <Icon name="lock" size={15} color={LTOKENS.ink3} />
          <Eyebrow color={LTOKENS.ink3}>Film room · sealed</Eyebrow>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[92, 70, 84].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: LTOKENS.ink3, flexShrink: 0 }} />
              <div style={{ height: 9, width: `${w}%`, borderRadius: 5,
                background: `repeating-linear-gradient(90deg, ${LTOKENS.raised}, ${LTOKENS.raised} 7px, ${LTOKENS.surface} 7px, ${LTOKENS.surface} 12px)` }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${LTOKENS.hair}` }}>
          <Icon name="clock" size={14} color={LTOKENS.ink2} style={{ marginTop: 1 }} />
          <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.45 }}>
            You can watch {player.name} climb and slip all week — but their <b style={{ color: LTOKENS.ink }}>reasoning stays sealed until the climb completes.</b> Then the whole pod&apos;s film room unlocks.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ borderRadius: 16, padding: 16, background: `linear-gradient(160deg, ${alpha(player.color, 0.08)}, ${LTOKENS.surface} 62%)`, border: `1px solid ${alpha(player.color, 0.26)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <LIcon name="eyeR" size={15} color={player.color} stroke={2} />
        <Eyebrow color={player.color}>{player.you ? 'Your climb · open' : 'Film room · unlocked'}</Eyebrow>
      </div>
      <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>{CLB_WHY[player.id]}</div>
    </div>
  );
}

// tiny sparkline of one climber's closes, in their identity color
export function CLBSpark({ scores, color }) {
  const w = 116, h = 22, pad = 2;
  const mn = Math.min(...scores), mx = Math.max(...scores), sp = mx - mn || 1;
  const pts = scores.map((s, i) => [pad + (i / (scores.length - 1)) * (w - 2 * pad), h - pad - ((s - mn) / sp) * (h - 2 * pad)]);
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.7} fill={color} />)}
    </svg>
  );
}

// ── the vivid ranked-four standing at the current close ─────────────────────
//    ctx 'training' → no cut, no ADV/OUT.  ctx 'ranked' → cut line + verdict marks.
export function ClimbStanding({ mode, ctx, onPlayer }) {
  const lastIdx = mode === 'live' ? 3 : 4;
  const ranked = clbRankAt(lastIdx);
  const leaderId = ranked[0].id;
  const finalRanked = mode === 'final' && ctx === 'ranked';
  const Row = ({ s }) => {
    const todayDelta = +(s.scores[lastIdx] - s.scores[lastIdx - 1]).toFixed(1);
    const isLead = s.id === leaderId;
    const recede = finalRanked && !s.advancing;
    return (
      <div className="lg-tap" onClick={() => onPlayer(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px',
        cursor: 'pointer', opacity: recede ? 0.55 : 1, filter: recede ? 'saturate(0.5)' : 'none', transition: 'opacity .3s, filter .3s' }}>
        <Mono style={{ fontSize: 13, fontWeight: 700, width: 15, textAlign: 'center', color: isLead ? LTOKENS.gold : s.you ? s.color : LTOKENS.ink3 }}>{s.rank}</Mono>
        <div style={{ position: 'relative' }}>
          <AgentAvatar agent={s} size={31} live={mode === 'live'} />
          {isLead && <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${LTOKENS.gold}`, pointerEvents: 'none' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: s.you ? s.color : LTOKENS.ink }}>{s.name}</span>
            {s.you && <Tag color={s.color}>You</Tag>}
            {isLead && <LIcon name="crown" size={13} color={LTOKENS.gold} stroke={2} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>{s.archName}</Mono>
            <KindMark agent={s} />
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 2 }}>
          <LIcon name={todayDelta >= 0 ? 'long' : 'short'} size={10} color={todayDelta >= 0 ? LX.pos : LX.neg} stroke={2.4} />
          <Mono style={{ fontSize: 9.5, color: todayDelta >= 0 ? LX.pos : LX.neg }}>{todayDelta >= 0 ? '+' : ''}{todayDelta.toFixed(1)}</Mono>
        </span>
        {finalRanked && <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: s.advancing ? LX.energy : LTOKENS.ink3, marginRight: 2 }}>{s.advancing ? 'ADV' : 'OUT'}</Mono>}
        <CountScore value={s.pscore} size={15} />
      </div>
    );
  };
  return (
    <div style={{ borderRadius: 16, padding: '4px 13px 8px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      {ctx === 'ranked' ? (
        <>
          {ranked.slice(0, 2).map((s) => <Row key={s.id} s={s} />)}
          <CutLine />
          {ranked.slice(2).map((s) => <Row key={s.id} s={s} />)}
        </>
      ) : ranked.map((s, i) => (
        <div key={s.id} style={{ borderTop: i ? `1px solid ${LTOKENS.hair}` : 'none' }}><Row s={s} /></div>
      ))}
    </div>
  );
}

// ── TRAINING finish — solo practice. Just the finish; no cut, no elimination,
//    no champion. An optional teaching echo of how a real bracket would read. ─
export function ClimbFinish() {
  const ranked = clbRankAt(4);
  const you = ranked.find((s) => s.you);
  const leader = ranked[0];
  return (
    <div style={{ borderRadius: 18, padding: '17px 16px', textAlign: 'center',
      background: `linear-gradient(160deg, ${alpha(you.color, 0.12)}, ${LTOKENS.surface} 64%)`, border: `1px solid ${alpha(you.color, 0.3)}` }}>
      <Eyebrow color={you.color} style={{ marginBottom: 6 }}>Climb complete · training</Eyebrow>
      <div style={{ fontSize: 20, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>
        You finished <span style={{ color: you.color }}>#{you.rank}</span> of four.
      </div>
      <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginTop: 6 }}>
        A +4.6 final-day surge carried you past Helios at the summit. {leader.name} led the climb wire-to-wire. No stakes here — training doesn&apos;t ladder.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 13, padding: '8px 12px', borderRadius: 10,
        background: alpha(LTOKENS.gold, 0.06), border: `1px dashed ${alpha(LTOKENS.gold, 0.3)}` }}>
        <LIcon name="flag" size={13} color={LTOKENS.gold} stroke={2} />
        <Mono style={{ fontSize: 10, color: LTOKENS.ink2, letterSpacing: '0.02em', lineHeight: 1.4 }}>
          In a ranked bracket, the top two would advance — here it&apos;s just your finish.
        </Mono>
      </div>
    </div>
  );
}

// ── RANKED verdict (reuse layer) — advancers lift, eliminated recede ────────
export function ClimbVerdict() {
  const ranked = clbRankAt(4);
  const you = ranked.find((s) => s.you);
  const adv = ranked.filter((s) => s.advancing);
  const youAdv = you.advancing;
  return (
    <div style={{ borderRadius: 18, padding: '16px', textAlign: 'center',
      background: `linear-gradient(160deg, ${alpha(youAdv ? LX.energy : LX.neg, 0.12)}, ${LTOKENS.surface} 62%)`,
      border: `1px solid ${alpha(youAdv ? LX.energy : LX.neg, 0.3)}` }}>
      <Eyebrow color={youAdv ? LX.energy : LX.neg} style={{ marginBottom: 6 }}>{youAdv ? 'You advanced' : 'Your run ended'}</Eyebrow>
      <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>
        {youAdv ? 'Top two — into the next round.' : 'Below the cut at the summit.'}
      </div>
      <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginTop: 6 }}>
        The final close is the verdict. You took 2nd on a +4.6 summit surge past Helios.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
        <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.1em' }}>ADVANCING</Mono>
        {adv.map((s) => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
            background: alpha(s.color, 0.14), border: `1px solid ${alpha(s.color, 0.34)}` }}>
            {s.rank === 1 && <LIcon name="crown" size={10} color={LTOKENS.gold} stroke={2.2} />}
            <span style={{ fontSize: 11.5, fontWeight: 700, color: s.color }}>{s.name}{s.you ? ' · you' : ''}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// shared bottom-sheet shell — the redesign's ActionLayer idiom (fixed modal)
function ClimbSheet({ onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, color: LTOKENS.ink }}>
      <div className="lg-tap" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.72)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div className="lg-scroll" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', width: '100%', maxWidth: 448,
        background: LTOKENS.bg, borderRadius: '22px 22px 0 0', border: `1px solid ${LTOKENS.hair2}`, borderBottom: 'none',
        padding: '14px 18px calc(env(safe-area-inset-bottom, 0px) + 32px)', boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
        maxHeight: '90%', overflowY: 'auto', animation: 'lgSheetIn 0.28s ease' }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: LTOKENS.hair2, margin: '0 auto 16px' }} />
        {children}
      </div>
    </div>
  );
}

const CloseBtn = ({ onClose }) => (
  <button className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
    <Icon name="x" size={15} color={LTOKENS.ink2} />
  </button>
);

// ════════════════════ GATE-CLOSE SHEET — tap a gate ═════════════════════════
export function ClimbDaySheet({ dayIdx, mode, onClose, onPlayer }) {
  const provisional = mode === 'live' && dayIdx === 3;
  const ranked = clbRankAt(dayIdx);
  const leaderId = ranked[0].id;
  const [open, setOpen] = React.useState(null);
  const day = CLB_DAYS[dayIdx];
  return (
    <ClimbSheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Eyebrow color={provisional ? LTOKENS.teal : LTOKENS.ink3}>{day.wd} {day.d} · Gate {dayIdx + 1} of 5</Eyebrow>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
        {provisional ? 'At the gate · live' : 'Altitude at this gate'}
      </div>
      <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginBottom: 16 }}>
        Where the pod stood through {day.wd}&apos;s {provisional ? 'live tape' : 'close'} — the running altitude, not the day alone. Tap a climber for the picks and stocks that moved them.
      </div>
      <div style={{ borderRadius: 16, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}`, overflow: 'hidden' }}>
        {ranked.map((s, i) => {
          const isOpen = open === s.id, isLead = s.id === leaderId;
          const todayDelta = +(s.scores[dayIdx] - (dayIdx ? s.scores[dayIdx - 1] : 0)).toFixed(1);
          return (
            <div key={s.id} style={{ borderTop: i ? `1px solid ${LTOKENS.hair}` : 'none' }}>
              <div className="lg-tap" onClick={() => setOpen(isOpen ? null : s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', cursor: 'pointer',
                  background: isOpen ? alpha(s.color, 0.07) : 'transparent' }}>
                <Mono style={{ fontSize: 13, fontWeight: 700, width: 14, textAlign: 'center', color: isLead ? LTOKENS.gold : s.you ? s.color : LTOKENS.ink3 }}>{s.rank}</Mono>
                <AgentAvatar agent={s} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.you ? s.color : LTOKENS.ink }}>{s.name}</span>
                    {s.you && <Tag color={s.color}>You</Tag>}
                    <KindMark agent={s} style={{ transform: 'scale(0.9)' }} />
                  </div>
                </div>
                <Mono style={{ fontSize: 9.5, color: todayDelta >= 0 ? LX.pos : LX.neg, marginRight: 2 }}>{todayDelta >= 0 ? '+' : ''}{todayDelta.toFixed(1)} day</Mono>
                <Score v={s.pscore} size={14} />
                <Icon name={isOpen ? 'chevD' : 'chevR'} size={14} color={LTOKENS.ink3} />
              </div>
              {isOpen && (
                <div style={{ padding: '4px 13px 14px', animation: 'lgFadeIn .2s ease' }}>
                  <div className="lg-spec-layers" style={{ display: 'flex', gap: 10 }}>
                    <CLBLayer title="Picks" sub="3 STOCKS" book={s.userBook} kind="user" />
                    <CLBLayer title="Agent book" sub="6 STOCKS" book={s.agentBook} kind="agent" />
                  </div>
                  <button className="lg-tap" onClick={() => { onClose(); onPlayer(s.id); }} style={{ all: 'unset', cursor: 'pointer', marginTop: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: 10, borderRadius: 10,
                    background: LTOKENS.raised, border: `1px solid ${LTOKENS.hair}`, color: LTOKENS.ink2 }}>
                    <Mono style={{ fontSize: 10.5, letterSpacing: '0.06em' }}>Full climb for {s.name}</Mono>
                    <Icon name="arrowR" size={13} color={LTOKENS.ink2} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ClimbSheet>
  );
}

// ════════════════════ CLIMBER SHEET — tap a track / head ════════════════════
export function ClimbPlayerSheet({ playerId, mode, ctx, onClose }) {
  const lastIdx = mode === 'live' ? 3 : 4;
  const ranked = clbRankAt(lastIdx);
  const s = ranked.find((p) => p.id === playerId);
  if (!s) return null; // defensive: never deref a missing seat
  const sealed = mode === 'live' && !s.you;
  const weekDelta = +(s.scores[lastIdx] - s.scores[0]).toFixed(1);
  const standLabel = mode === 'live' ? `currently #${s.rank}` : ctx === 'ranked' ? (s.advancing ? 'advancing' : 'below the cut') : `#${s.rank} finish`;
  return (
    <ClimbSheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Eyebrow color={LTOKENS.ink3}>{standLabel}</Eyebrow>
        <CloseBtn onClose={onClose} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
        <AgentAvatar agent={s} size={44} live={mode === 'live'} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: s.you ? s.color : LTOKENS.ink }}>{s.name}</span>
            {s.you && <Tag color={s.color}>You</Tag>}
            <KindMark agent={s} />
          </div>
          <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>{s.archName} · {s.kind === 'human' ? s.owner : 'CPU agent'}</Mono>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Score v={s.pscore} size={22} />
          <Mono style={{ fontSize: 8.5, color: LTOKENS.ink3, display: 'block', marginTop: 2, letterSpacing: '0.06em' }}>ALTITUDE</Mono>
        </div>
      </div>
      {/* the climb in one line — sparkline in the climber's color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
        <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.06em' }}>THE CLIMB</Mono>
        <CLBSpark scores={s.scores.slice(0, lastIdx + 1)} color={s.color} />
        <Mono style={{ fontSize: 10.5, fontWeight: 700, color: weekDelta >= 0 ? LX.pos : LX.neg, marginLeft: 'auto' }}>{weekDelta >= 0 ? '+' : ''}{weekDelta.toFixed(1)} climbed</Mono>
      </div>

      <SectionLabel label="Two layers · one altitude" color={LTOKENS.ink3} />
      <div className="lg-spec-layers" style={{ display: 'flex', gap: 11, marginBottom: 20 }}>
        <CLBLayer title="The picks" sub="3 STOCKS · CLAIMS & FLIPS" book={s.userBook} kind="user" />
        <CLBLayer title="The agent book" sub="6 STOCKS · AUTO-MANAGED" book={s.agentBook} kind="agent" />
      </div>

      <SectionLabel label="Why they moved" color={LTOKENS.ink3} />
      <CLBFilm player={s} sealed={sealed} />
    </ClimbSheet>
  );
}
