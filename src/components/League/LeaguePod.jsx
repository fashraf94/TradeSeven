// src/components/League/LeaguePod.jsx
//
// The FOUR-player model — ranked-four-with-a-cut-line is the primary visual —
// plus the bracket funnel explorer and the expanded-pod sheet. Transcribed from
// the Claude Design prototype (league-pod.jsx). Overlays are adapted to real
// position:fixed modals (the prototype's iOS device frame is gone).

import React from 'react';
import { rankPod } from './leagueFixtures';
import { LTOKENS, LX, alpha } from './leagueTokens';
import {
  Eyebrow, Mono, Icon, LIcon, Tag, AgentAvatar, KindMark, Score, StatusBadge, Watchers,
} from './LeagueParts';

// ── the cut line — the single element that teaches the whole game ──────────
export function CutLine({ accent = LX.cut }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${alpha(accent, 0.5)})` }} />
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999,
        background: alpha(accent, 0.12), border: `1px solid ${alpha(accent, 0.4)}`, whiteSpace: 'nowrap',
      }}>
        <LIcon name="flag" size={10} color={accent} stroke={2} />
        <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>CUT · TOP 2 ADVANCE</Mono>
      </span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${alpha(accent, 0.5)}, transparent)` }} />
    </div>
  );
}

// ── one seat row in a pod standing ─────────────────────────────────────────
export function PodRow({ seat, accent, onSpectate, dim, base }) {
  if (seat.tbd) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px', opacity: 0.5 }}>
        <Mono style={{ fontSize: 12, color: LTOKENS.ink3, width: 16, textAlign: 'center' }}>{seat.rank}</Mono>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: `1px dashed ${LTOKENS.hair2}`, flexShrink: 0 }} />
        <Mono style={{ fontSize: 12, color: LTOKENS.ink3, flex: 1 }}>Open seat · advances from prior round</Mono>
      </div>
    );
  }
  const adv = seat.advancing;
  return (
    <div
      className={onSpectate ? 'lg-tap' : ''}
      onClick={onSpectate ? () => onSpectate(seat) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px', cursor: onSpectate ? 'pointer' : 'default',
        opacity: dim && !adv ? 0.62 : 1,
      }}
    >
      <Mono style={{ fontSize: 13, fontWeight: 700, width: 16, textAlign: 'center', color: base ? LTOKENS.ink3 : adv ? accent : LTOKENS.ink3 }}>{seat.rank}</Mono>
      <AgentAvatar agent={seat} size={32} live />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: LTOKENS.ink }}>{seat.name}</span>
          {seat.you && <Tag color={accent}>You</Tag>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>{seat.archName}</Mono>
          <KindMark agent={seat} />
        </div>
      </div>
      {!base && (adv
        ? <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: LX.energy, marginRight: 2 }}>ADV</Mono>
        : <Mono style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', color: LTOKENS.ink3, marginRight: 2 }}>OUT</Mono>)}
      <Score v={seat.pscore} size={15} />
    </div>
  );
}

// ── the four-player game card / pod standing (THE primary surface) ─────────
export function PodCard({ pod, accent, onSpectate, featured = false }) {
  const ranked = rankPod(pod);
  const resolved = pod.status === 'final';
  const base = !!pod.base;
  const live = pod.status === 'live';
  return (
    <div style={{
      borderRadius: 18, padding: featured ? '15px 15px 13px' : '13px 14px',
      background: featured ? `linear-gradient(165deg, ${alpha(accent, 0.06)}, ${LTOKENS.surface} 58%)` : LTOKENS.surface,
      border: `1px solid ${featured ? alpha(accent, 0.26) : LTOKENS.hair}`,
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{pod.name}</span>
          <Tag color={base ? LX.human : LTOKENS.ink3}>{base ? 'Weekly' : pod.round === 3 ? 'Final Four' : `Round ${pod.round}`}</Tag>
        </div>
        <StatusBadge status={pod.status} clock={live ? pod.clock : null} compact />
      </div>
      {base ? (
        /* base layer — four ranked players, NO cut framing (feeds the leaderboard only) */
        <div>
          {ranked.map((s) => <PodRow key={s.id || s.rank} seat={s} accent={accent} onSpectate={onSpectate} base />)}
        </div>
      ) : (
        /* bracket — four ranked seats with the cut line between #2 and #3 */
        <div>
          {ranked.slice(0, 2).map((s) => <PodRow key={s.id || `a${s.rank}`} seat={s} accent={accent} onSpectate={onSpectate} dim={resolved} />)}
          <CutLine />
          {ranked.slice(2).map((s) => <PodRow key={s.id || `b${s.rank}`} seat={s} accent={accent} onSpectate={onSpectate} dim />)}
        </div>
      )}
      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LTOKENS.hair}` }}>
        {base
          ? <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>Feeds the leaderboard · not the bracket</Mono>
          : <Watchers n={pod.watchers} />}
        {onSpectate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <LIcon name="eyeR" size={13} color={accent} />
            <Mono style={{ fontSize: 10.5, color: accent, fontWeight: 600, letterSpacing: '0.04em' }}>Tap a seat to spectate</Mono>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════ THE BRACKET FUNNEL EXPLORER ════════════════════════
// A narrowing funnel (16 → 8 → 4 → 1), each node a pod of four. Your path is
// highlighted the whole way to the trophy. Tap a node to expand its standing.
const FUNNEL_W = 354, FUNNEL_H = 384;
const NODES = {
  east: { x: 50, y: 44, col: 1 }, west: { x: 50, y: 140, col: 1 },
  north: { x: 50, y: 240, col: 1 }, south: { x: 50, y: 336, col: 1 },
  r2a: { x: 190, y: 92, col: 2 }, r2b: { x: 190, y: 288, col: 2 },
  r3: { x: 306, y: 190, col: 3 },
};
const NW = { 1: 92, 2: 98, 3: 86 }, NH = { 1: 80, 2: 86, 3: 86 };
const FUNNEL_EDGES = [['east', 'r2a'], ['west', 'r2a'], ['north', 'r2b'], ['south', 'r2b'], ['r2a', 'r3'], ['r2b', 'r3']];

function FunnelNode({ pod, node, onPick, onPath }) {
  const ranked = rankPod(pod);
  const w = NW[node.col], h = NH[node.col];
  const live = pod.status === 'live', resolved = pod.status === 'final', upcoming = pod.status === 'upcoming';
  const onYourPath = onPath;
  const isFinal = node.col === 3;
  const ring = onYourPath ? LX.energy : resolved ? alpha(LTOKENS.gold, 0.4) : LTOKENS.hair2;
  return (
    <button
      className="lg-tap"
      onClick={() => onPick(pod)}
      style={{
        all: 'unset', cursor: 'pointer', position: 'absolute', left: node.x - w / 2, top: node.y - h / 2,
        width: w, height: h, boxSizing: 'border-box', borderRadius: 12, padding: '7px 8px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: onYourPath ? `linear-gradient(160deg, ${alpha(LX.energy, 0.12)}, ${LTOKENS.raised})` : LTOKENS.surface,
        border: `1px solid ${ring}`, boxShadow: onYourPath ? `0 0 16px ${alpha(LX.energy, 0.18)}` : 'none', zIndex: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Mono style={{ fontSize: isFinal ? 9 : 10, fontWeight: 700, color: onYourPath ? LX.energy : LTOKENS.ink, letterSpacing: '0.02em' }}>
          {isFinal ? 'FINAL 4' : pod.name}
        </Mono>
        {live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: LX.energy, animation: 'lgLiveDot 1.6s infinite' }} />}
        {resolved && <Icon name="check" size={11} color={LTOKENS.gold} stroke={2.6} />}
      </div>
      {/* all four seats — name only the top two (advancers); collapse the rest */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {ranked.slice(0, 2).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: s.tbd ? 'transparent' : LX.energy, border: s.tbd ? `1px dashed ${LTOKENS.hair2}` : 'none',
            }} />
            <Mono style={{ fontSize: 8.5, color: s.tbd ? LTOKENS.ink3 : LTOKENS.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: w - 34 }}>
              {s.tbd ? 'TBD' : s.name}{s.you ? ' ·you' : ''}
            </Mono>
            {isFinal && resolved && i === 0 && <Icon name="trophy" size={11} color={LX.comp} stroke={2} style={{ marginLeft: 'auto' }} />}
          </div>
        ))}
        {/* the cut — a faint dashed hairline */}
        <div style={{ height: 0, borderTop: `1px dashed ${alpha(LX.cut, 0.45)}`, margin: '1.5px 0' }} />
        {/* bottom two — nameless pips, collapsed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.5 }}>
          {ranked.slice(2).map((s, i) => (
            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, border: `1px solid ${LTOKENS.ink3}` }} />
          ))}
          <Mono style={{ fontSize: 8, color: LTOKENS.ink3 }}>{ranked.slice(2).every((s) => s.tbd) ? 'seats TBD' : '+2 below cut'}</Mono>
        </div>
      </div>
      <Mono style={{ fontSize: 8, color: isFinal && resolved ? LX.comp : LTOKENS.ink3, fontWeight: isFinal && resolved ? 700 : 400, letterSpacing: '0.06em' }}>
        {isFinal
          ? (resolved ? 'CHAMPION' : upcoming ? 'WINNER TAKES IT' : 'LIVE')
          : (upcoming ? 'UPCOMING' : live ? (pod.watchers ? `${pod.watchers}👁` : 'LIVE') : 'SETTLED')}
      </Mono>
    </button>
  );
}

export function Funnel({ st, onPick }) {
  const all = {
    east: st.rounds.r1[0], west: st.rounds.r1[1], north: st.rounds.r1[2], south: st.rounds.r1[3],
    r2a: st.rounds.r2[0], r2b: st.rounds.r2[1], r3: st.rounds.r3,
  };
  const pathSet = new Set(st.path.groups);
  const pathEdge = (a, b) => pathSet.has(a) && pathSet.has(b);
  return (
    <div style={{ position: 'relative', width: FUNNEL_W, height: FUNNEL_H, margin: '0 auto', maxWidth: '100%' }}>
      {/* round headers */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[['Round 1 · 16', 50], ['Round 2 · 8', 190], ['Champion', 306]].map(([lbl, x]) => (
          <Mono key={lbl} style={{ position: 'absolute', left: x, top: -2, transform: 'translateX(-50%)', fontSize: 8.5, color: LTOKENS.ink3, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{lbl}</Mono>
        ))}
      </div>
      {/* connector lines */}
      <svg width={FUNNEL_W} height={FUNNEL_H} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {FUNNEL_EDGES.map(([a, b]) => {
          const na = NODES[a], nb = NODES[b];
          const x1 = na.x + NW[na.col] / 2, y1 = na.y, x2 = nb.x - NW[nb.col] / 2, y2 = nb.y;
          const mx = (x1 + x2) / 2;
          const on = pathEdge(a, b);
          return <path key={a + b} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={on ? LX.energy : LTOKENS.hair2} strokeWidth={on ? 2 : 1.2} opacity={on ? 0.9 : 0.6} />;
        })}
      </svg>
      {/* nodes */}
      {Object.entries(NODES).map(([id, node]) => (
        <FunnelNode key={id} pod={all[id]} node={node} onPick={onPick} onPath={pathSet.has(id)} />
      ))}
    </div>
  );
}

// ── expanded-pod sheet — tap a funnel node → its live four-player standing.
//    Tapping a player opens Spectate. (Real position:fixed modal.) ──────────
export function PodSheet({ pod, accent, onClose, onSpectate }) {
  const upcoming = pod.status === 'upcoming';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, color: LTOKENS.ink }}>
      <div className="lg-tap" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.72)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div
        className="lg-scroll"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', width: '100%', maxWidth: 448,
          background: LTOKENS.bg, borderRadius: '22px 22px 0 0', border: `1px solid ${LTOKENS.hair2}`, borderBottom: 'none',
          padding: '14px 18px calc(env(safe-area-inset-bottom, 0px) + 28px)', boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
          maxHeight: '88%', overflowY: 'auto', animation: 'lgSheetIn 0.28s ease',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 4, background: LTOKENS.hair2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Eyebrow color={accent}>{pod.round === 3 ? 'Final Four' : `Round ${pod.round}`} · {pod.name}</Eyebrow>
          <button className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <Icon name="x" size={15} color={LTOKENS.ink2} />
          </button>
        </div>
        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {upcoming ? 'Forming' : pod.status === 'final' ? 'Settled' : 'Live now'} · top 2 advance
        </div>
        <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginBottom: 16 }}>
          {upcoming
            ? 'This pod fills with the advancers from the prior round. Win your group to claim a seat here.'
            : 'Four players, one combined score each. The cut line is the whole game — finish top two and you move on.'}
        </div>
        <PodCard pod={pod} accent={accent} onSpectate={upcoming ? null : onSpectate} />
      </div>
    </div>
  );
}
