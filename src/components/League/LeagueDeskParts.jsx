/* eslint-disable react-refresh/only-export-components -- desktop League presentational primitives are co-located by design (the LeagueParts / commandUI precedent) */
// src/components/League/LeagueDeskParts.jsx
//
// Desktop-only League presentational primitives, transcribed from the Claude
// Design desktop export (league-desk-funnel.jsx, league-desk-rails.jsx, and the
// centered modals from league-desk.jsx). The harness chrome (the macOS window
// frame, the scale-to-fit stage, the Tweaks panel) is intentionally dropped —
// the same posture the mobile port (LeagueHome) used when it stripped the iOS
// device frame.
//
// REUSE-FIRST: these compose the existing League data + primitives — LTOKENS/LX,
// rankPod, the LeagueParts atoms (Eyebrow/Mono/Icon/LIcon/AgentAvatar/Score/
// StatusBadge/KindMark/Tag/Watchers), PodCard, ActionOption, and AgentOrb — so
// the desktop surface can't drift from mobile. Scores carry the live app's "%"
// suffix (via <Score/>), matching the rest of the redesigned surface.
//
// THE TRAINING ADDITION (build spec): the Training Pod tab + Active Training Game
// card live here too, in the purple training accent so practice reads as visually
// distinct from the teal tournament surface. They reuse the proven training stack
// (quickPlayTraining / subscribeMyTrainingPod / onOpenTrainingPod) — Option B —
// and write no competitive state.

import React, { useState, useRef, useEffect } from 'react';
import { rankPod } from './leagueFixtures';
import { LTOKENS, LX, alpha, MONO } from './leagueTokens';
import { Eyebrow, Mono, Icon, LIcon, AgentAvatar, KindMark, Score, StatusBadge, Tag } from './LeagueParts';
import { PodCard } from './LeaguePod';
import { ActionOption } from './LeagueAction';
import AgentOrb from '../shared/AgentOrb';
import LoadoutChooserSheet from './LoadoutChooserSheet';
import { quickPlayTraining, mapLobbyError } from '../../services/tournamentLobbyActions';
import { GROUP_STATUS } from '../../constants/leagueTournament';
import { shouldPreviewClimb, climbPreviewEnabled } from './trainingClimbPreviewGate';
import TrainingClimbPreview from './TrainingClimbPreview';

// Training accent — purple, per the build spec ("training is purple across
// TradeSeven … visually distinct from the teal tournament surface"). Kept local
// to the desktop training elements so the tournament surface stays teal.
export const TRAIN = { base: '#8b5cf6', lt: '#a78bfa' };

// Training-tab CLIMB PREVIEW gate — dark by default (flag OR ?trainingClimbPreview=1),
// resolved once via the shared climbPreviewEnabled(); the pure shouldPreviewClimb
// predicate then decides per-pod (BATTLE + seated only).
const CLIMB_PREVIEW_ON = climbPreviewEnabled();

// small mono score, signed, kept-negative, with the live "%" suffix. Used inside
// the dense funnel nodes where a full <Score/> would be too heavy.
function miniScore(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

// ════════════════════════════ THE DESKTOP RAILS ════════════════════════════

// ── EnterTournament — the prominent desktop CTA ────────────────────────────
export function DeskEnter({ accent, onEnter }) {
  return (
    <button
      className="lg-tap"
      onClick={onEnter}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px 11px 12px', borderRadius: 14,
        background: `linear-gradient(120deg, ${alpha(accent, 0.26)}, ${alpha(accent, 0.1)})`,
        border: `1px solid ${alpha(accent, 0.5)}`, boxShadow: `0 8px 26px ${alpha(accent, 0.2)}, inset 0 1px 0 ${alpha('#ffffff', 0.07)}`,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${alpha(accent, 0.45)}` }}>
        <LIcon name="play" size={17} color={LTOKENS.bg} />
      </div>
      <div>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>Enter tournament</div>
        <Mono style={{ fontSize: 10, color: alpha(accent, 0.95) }}>Claim a seat · top 2 advance</Mono>
      </div>
    </button>
  );
}

// ── a hero stat (dot · number · label) ─────────────────────────────────────
export function DeskStat({ n, label, dot, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: muted ? LTOKENS.ink3 : dot, flexShrink: 0, boxShadow: muted ? 'none' : `0 0 7px ${alpha(dot, 0.7)}` }} />
      <Mono style={{ fontSize: 15, fontWeight: 700, color: muted ? LTOKENS.ink3 : LTOKENS.ink }}>{n}</Mono>
      <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{label}</Mono>
    </div>
  );
}

// ── YOUR GROUP — the micro-community card, left rail ───────────────────────
export function DeskYourGroup({ st, accent, onOpen }) {
  const pod = st.rounds.r1.find((p) => p.id === st.yourGroup.id);
  if (!pod) return null;
  const ranked = rankPod(pod);
  const me = ranked.find((s) => s.you);
  const mates = ranked.filter((s) => !s.you && !s.tbd);
  return (
    <div style={{ borderRadius: 18, padding: '15px 16px', background: `linear-gradient(160deg, ${alpha(accent, 0.12)}, ${LTOKENS.surface} 64%)`, border: `1px solid ${alpha(accent, 0.3)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Eyebrow color={accent}>Your group · {pod.name}</Eyebrow>
        <StatusBadge status={pod.status} clock={pod.status === 'live' ? pod.clock : null} compact />
      </div>
      {me && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 12, background: LTOKENS.bg, border: `1px solid ${alpha(accent, 0.28)}`, marginBottom: 11 }}>
          <Mono style={{ fontSize: 15, fontWeight: 700, color: me.advancing ? accent : LX.neg }}>#{me.rank}</Mono>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: LTOKENS.ink }}>{me.name} <span style={{ color: LTOKENS.ink3, fontWeight: 500, fontSize: 12 }}>(you)</span></div>
            <Mono style={{ fontSize: 9, letterSpacing: '0.08em', color: me.advancing ? LX.energy : LTOKENS.ink3, fontWeight: 600 }}>
              {me.advancing ? 'ADVANCING' : 'ON THE BUBBLE'}
            </Mono>
          </div>
          <Score v={me.pscore} size={18} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 12 }}>
        {mates.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 2px' }}>
            <Mono style={{ fontSize: 11, fontWeight: 700, width: 14, textAlign: 'center', color: m.advancing ? accent : LTOKENS.ink3 }}>{m.rank}</Mono>
            <AgentAvatar agent={m} size={26} />
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: LTOKENS.ink }}>{m.name}</span>
            <KindMark agent={m} style={{ transform: 'scale(0.85)', transformOrigin: 'right' }} />
            <Score v={m.pscore} size={13} />
          </div>
        ))}
      </div>
      <button className="lg-tap" onClick={() => onOpen(pod)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: 10, borderRadius: 10, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}`, boxSizing: 'border-box' }}>
        <Mono style={{ fontSize: 10.5, color: accent, fontWeight: 600, letterSpacing: '0.04em' }}>Open the pod standing</Mono>
        <Icon name="arrowR" size={13} color={accent} />
      </button>
    </div>
  );
}

// ── LIVE NOW · people you follow ───────────────────────────────────────────
export function DeskFollowRail({ items, accent, onSpectate }) {
  if (!items.length) {
    return (
      <div style={{ borderRadius: 16, padding: '14px 15px', background: LTOKENS.surface, border: `1px dashed ${LTOKENS.hair2}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <LIcon name="users" size={13} color={LTOKENS.ink3} />
          <Eyebrow color={LTOKENS.ink3}>Live now · follows</Eyebrow>
        </div>
        <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3, lineHeight: 1.5 }}>No one you follow is live yet. Their pods light up here.</Mono>
      </div>
    );
  }
  return (
    <div style={{ borderRadius: 16, padding: '14px 15px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
        <LIcon name="users" size={13} color={LTOKENS.ink3} />
        <Eyebrow color={LTOKENS.ink3}>Live now · people you follow</Eyebrow>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(({ player, pod }) => (
          <button key={player.id} className="lg-tap" onClick={() => onSpectate(pod, player.id)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', borderRadius: 11, background: LTOKENS.bg, border: `1px solid ${LTOKENS.hair}`, boxSizing: 'border-box' }}>
            <AgentAvatar agent={player} size={32} live />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: LTOKENS.ink }}>{player.name}</span>
                <Score v={player.score} size={12} />
              </div>
              <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>{pod.name}{pod.watchers ? ` · ${pod.watchers} watching` : ''}</Mono>
            </div>
            <LIcon name="eyeR" size={14} color={accent} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SEASON LEADERBOARD — top of the whole field, right rail default ────────
export function DeskLeaderboard({ st, accent }) {
  const players = Object.values(st.field).sort((a, b) => b.score - a.score);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Eyebrow color={LTOKENS.ink3}>Leaderboard · the field</Eyebrow>
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.06em' }}>{players.length} players</Mono>
      </div>
      <div className="lg-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {players.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 16px', gap: 9 }}>
            <LIcon name="users" size={20} color={LTOKENS.ink3} stroke={1.8} />
            <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3, lineHeight: 1.55, maxWidth: 220 }}>Standings appear once the weekly base-layer groups are under way.</Mono>
          </div>
        )}
        {players.map((p, i) => {
          const you = p.you;
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 11,
              background: you ? alpha(accent, 0.1) : i < 3 ? LTOKENS.surface : 'transparent',
              border: `1px solid ${you ? alpha(accent, 0.34) : i < 3 ? LTOKENS.hair : 'transparent'}` }}>
              <div style={{ width: 18, display: 'flex', justifyContent: 'center' }}>
                {i === 0 ? <LIcon name="crown" size={15} color={LTOKENS.gold} stroke={2} />
                  : <Mono style={{ fontSize: 12, fontWeight: 700, color: you ? accent : LTOKENS.ink3 }}>{i + 1}</Mono>}
              </div>
              <AgentAvatar agent={p} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: you ? accent : LTOKENS.ink }}>{p.name}</span>
                  {you && <Tag color={accent}>You</Tag>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{p.archName}</Mono>
                  <KindMark agent={p} style={{ transform: 'scale(0.82)', transformOrigin: 'left' }} />
                </div>
              </div>
              <Score v={p.score} size={15} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DOCKED LEAGUE POD PANEL — the four-player standing, right rail ─────────
export function DeskPodPanel({ pod, accent, onClose, onSpectate, onClimb }) {
  const upcoming = pod.status === 'upcoming';
  const base = !!pod.base;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', animation: 'lgFadeIn .25s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Eyebrow color={accent}>League Pod {base ? '· weekly' : pod.round === 3 ? '· Final Four' : `· Round ${pod.round}`}</Eyebrow>
        <button className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
          <Icon name="x" size={15} color={LTOKENS.ink2} />
        </button>
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: LTOKENS.ink, marginBottom: 4 }}>
        {pod.name}{upcoming ? ' · forming' : ''}
      </div>
      <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.45, marginBottom: 14 }}>
        {base ? 'An always-on weekly group of four. Feeds the leaderboard — never the bracket.'
          : upcoming ? 'Fills with the advancers from the prior round. Win your group to claim a seat here.'
          : 'Four players, one combined score each. The cut line is the whole game — finish top two and you move on.'}
      </div>
      <div className="lg-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <PodCard pod={pod} accent={accent} onSpectate={upcoming ? null : onSpectate} featured />
      </div>
      {!upcoming && onClimb && (
        <button className="lg-tap" onClick={() => onClimb(pod)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 12, marginTop: 12,
          background: `linear-gradient(120deg, ${alpha(accent, 0.2)}, ${alpha(accent, 0.07)})`, border: `1px solid ${alpha(accent, 0.4)}`, boxSizing: 'border-box' }}>
          <LIcon name="pulse" size={16} color={accent} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: LTOKENS.ink }}>Open the five-day Altitude Climb</span>
          <Icon name="arrowR" size={15} color={accent} />
        </button>
      )}
    </div>
  );
}

// ════════════════════════ THE BIG DESKTOP BRACKET FUNNEL ════════════════════
// 16 → 8 → 4 → 1, rendered large enough to be the centerpiece. Every node shows
// its full four-player standing with the cut line; your path glows the whole way.

// Inter-stage X positions are tightened (R2 392→348, Champion 648→584) so the
// bracket's intrinsic width is 700, not 760 — node sizes (NW/NH) are unchanged,
// only the horizontal space between rounds is reduced. DeskFunnel then fit-to-
// width-scales this stage so the whole bracket fits the center column with no
// horizontal scrollbar (scale stays 1.0 when the column is ≥700 wide).
const DFUN = {
  W: 700, H: 680,
  nodes: {
    east: { x: 100, y: 88, col: 1 }, west: { x: 100, y: 236, col: 1 },
    north: { x: 100, y: 452, col: 1 }, south: { x: 100, y: 600, col: 1 },
    r2a: { x: 348, y: 162, col: 2 }, r2b: { x: 348, y: 526, col: 2 },
    r3: { x: 584, y: 344, col: 3 },
  },
  NW: { 1: 178, 2: 196, 3: 200 },
  NH: { 1: 138, 2: 150, 3: 164 },
};
const DFUN_EDGES = [['east', 'r2a'], ['west', 'r2a'], ['north', 'r2b'], ['south', 'r2b'], ['r2a', 'r3'], ['r2b', 'r3']];

function DeskNodeSeat({ seat, accent }) {
  if (seat.tbd) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 19, opacity: 0.45 }}>
        <span style={{ width: 13, textAlign: 'center', fontFamily: MONO, fontSize: 10, color: LTOKENS.ink3 }}>{seat.rank}</span>
        <span style={{ width: 13, height: 13, borderRadius: '50%', border: `1px dashed ${LTOKENS.hair2}`, flexShrink: 0 }} />
        <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>TBD</Mono>
      </div>
    );
  }
  const adv = seat.advancing;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 19 }}>
      <span style={{ width: 13, textAlign: 'center', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: adv ? accent : LTOKENS.ink3 }}>{seat.rank}</span>
      <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 38% 32%, ${alpha(seat.color, 0.95)}, ${alpha(seat.color, 0.3)} 70%)`,
        boxShadow: seat.you ? `0 0 0 1.5px ${alpha(accent, 0.8)}` : 'none' }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: seat.you ? 700 : 600,
        color: seat.you ? LTOKENS.ink : adv ? LTOKENS.ink : LTOKENS.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {seat.name}{seat.you ? ' · you' : ''}
      </span>
      <Mono style={{ fontSize: 10.5, fontWeight: 600, color: seat.pscore >= 0 ? LX.pos : LX.neg }}>{miniScore(seat.pscore)}</Mono>
    </div>
  );
}

function DeskFunnelNode({ pod, node, accent, onPath, onPick, selected }) {
  const ranked = rankPod(pod);
  const w = DFUN.NW[node.col], h = DFUN.NH[node.col];
  const live = pod.status === 'live', resolved = pod.status === 'final', upcoming = pod.status === 'upcoming';
  const isFinal = node.col === 3;
  const onYourPath = onPath;
  const champion = isFinal && resolved ? ranked[0] : null;
  const ring = selected ? accent : onYourPath ? alpha(LX.energy, 0.85) : resolved ? alpha(LTOKENS.gold, 0.4) : LTOKENS.hair2;
  return (
    <button className="lg-tap" onClick={() => onPick(pod)} style={{ all: 'unset', cursor: 'pointer', position: 'absolute',
      left: node.x - w / 2, top: node.y - h / 2, width: w, height: h, boxSizing: 'border-box', zIndex: 2,
      borderRadius: 15, padding: '11px 13px', display: 'flex', flexDirection: 'column',
      background: selected ? `linear-gradient(160deg, ${alpha(accent, 0.16)}, ${LTOKENS.raised})`
        : onYourPath ? `linear-gradient(160deg, ${alpha(LX.energy, 0.1)}, ${LTOKENS.surface} 70%)` : LTOKENS.surface,
      border: `1.5px solid ${ring}`,
      boxShadow: selected ? `0 0 26px ${alpha(accent, 0.3)}` : onYourPath ? `0 0 18px ${alpha(LX.energy, 0.14)}` : '0 2px 10px rgba(0,0,0,0.3)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: onYourPath ? LX.energy : LTOKENS.ink, letterSpacing: '-0.01em' }}>
          {isFinal ? 'Final Four' : pod.name}
        </span>
        {onYourPath && !isFinal && <Mono style={{ fontSize: 8, color: LX.energy, letterSpacing: '0.1em' }}>· YOU</Mono>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          {live && <span style={{ width: 7, height: 7, borderRadius: '50%', background: LX.energy, animation: 'lgLiveDot 1.6s infinite' }} />}
          {resolved && <Icon name="check" size={13} color={LTOKENS.gold} stroke={2.6} />}
          {champion && <LIcon name="crown" size={14} color={LX.comp} stroke={2} />}
        </div>
      </div>
      {/* the four-seat standing with the cut line */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        {ranked.slice(0, 2).map((s) => <DeskNodeSeat key={s.id || 'a' + s.rank} seat={s} accent={onYourPath ? LX.energy : accent} />)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <div style={{ flex: 1, height: 0, borderTop: `1px dashed ${alpha(LX.cut, 0.5)}` }} />
          {!isFinal && <Mono style={{ fontSize: 7.5, letterSpacing: '0.12em', color: alpha(LX.cut, 0.85) }}>CUT</Mono>}
          <div style={{ flex: 1, height: 0, borderTop: `1px dashed ${alpha(LX.cut, 0.5)}` }} />
        </div>
        {ranked.slice(2).map((s) => (
          <div key={s.id || 'b' + s.rank} style={{ opacity: 0.55 }}><DeskNodeSeat seat={s} accent={accent} /></div>
        ))}
      </div>
      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 7, borderTop: `1px solid ${LTOKENS.hair}` }}>
        <Mono style={{ fontSize: 8.5, letterSpacing: '0.08em',
          color: champion ? LX.comp : upcoming ? LTOKENS.ink3 : live ? LX.energy : LTOKENS.ink3,
          fontWeight: champion ? 700 : 500 }}>
          {isFinal ? (champion ? 'CHAMPION' : upcoming ? 'WINNER TAKES IT' : 'LIVE NOW')
            : upcoming ? 'UPCOMING' : live ? 'LIVE' : 'SETTLED'}
        </Mono>
        {!upcoming && pod.watchers > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <LIcon name="eyeR" size={11} color={LTOKENS.ink3} />
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>{pod.watchers}</Mono>
          </span>
        )}
      </div>
    </button>
  );
}

export function DeskFunnel({ st, accent, onPick, selectedId }) {
  const all = { east: st.rounds.r1[0], west: st.rounds.r1[1], north: st.rounds.r1[2], south: st.rounds.r1[3],
    r2a: st.rounds.r2[0], r2b: st.rounds.r2[1], r3: st.rounds.r3 };
  const pathSet = new Set(st.path.groups);
  const pathEdge = (a, b) => pathSet.has(a) && pathSet.has(b);

  // Fit-to-width: measure the container and scale the fixed stage down ONLY when
  // it's narrower than the bracket (scale === 1 otherwise, so wide screens keep
  // full size). Guarantees the whole bracket fits with no horizontal scrollbar.
  const fitRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return undefined;
    const fit = () => { const w = el.clientWidth; if (w > 0) setScale(Math.min(1, w / DFUN.W)); };
    fit();
    let ro;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(el); }
    else if (typeof window !== 'undefined') window.addEventListener('resize', fit);
    return () => { if (ro) ro.disconnect(); else if (typeof window !== 'undefined') window.removeEventListener('resize', fit); };
  }, []);

  return (
    <div ref={fitRef} style={{ width: '100%' }}>
      {/* outer box collapses to the scaled footprint so there's no dead space;
          the inner fixed-size stage is scaled from its top-left to fill it. */}
      <div style={{ width: DFUN.W * scale, height: (DFUN.H + 30) * scale, margin: '0 auto' }}>
        <div style={{ position: 'relative', width: DFUN.W, height: DFUN.H + 30, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {/* round headers (X centers match the tightened node columns) */}
          {[['Round 1 · 16 seats', 100], ['Round 2 · Semifinals', 348], ['Champion', 584]].map(([lbl, x]) => (
            <div key={lbl} style={{ position: 'absolute', left: x, top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
              <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{lbl}</Mono>
            </div>
          ))}
          <div style={{ position: 'absolute', top: 30, left: 0, width: DFUN.W, height: DFUN.H }}>
            {/* connector lines */}
            <svg width={DFUN.W} height={DFUN.H} style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'visible' }}>
              {DFUN_EDGES.map(([a, b]) => {
                const na = DFUN.nodes[a], nb = DFUN.nodes[b];
                const x1 = na.x + DFUN.NW[na.col] / 2, y1 = na.y, x2 = nb.x - DFUN.NW[nb.col] / 2, y2 = nb.y;
                const mx = (x1 + x2) / 2;
                const on = pathEdge(a, b);
                return <path key={a + b} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none"
                  stroke={on ? LX.energy : LTOKENS.hair2} strokeWidth={on ? 2.5 : 1.5} opacity={on ? 0.9 : 0.55} />;
              })}
            </svg>
            {Object.entries(DFUN.nodes).map(([id, node]) => (
              <DeskFunnelNode key={id} pod={all[id]} node={node} accent={accent}
                onPath={pathSet.has(id)} onPick={onPick} selected={selectedId === all[id].id} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FORTHCOMING BRACKET — the honest center-stage state when the real adapter
//    has no bracket doc yet (base-layer-only / pre-season). An explicit, intentional
//    "opens when the season locks" panel that fills the center column — NOT a TBD
//    skeleton that reads as broken, and never demo boxes. ─────────────────────
export function DeskBracketPending() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 20px' }}>
      <div style={{ width: 68, height: 68, borderRadius: 19, marginBottom: 18, background: alpha(LX.energy, 0.14), border: `1px solid ${alpha(LX.energy, 0.34)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LIcon name="ranked" size={30} color={LX.energy} stroke={1.9} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.02em' }}>The bracket opens when the season locks</div>
      <div style={{ fontSize: 13.5, color: LTOKENS.ink2, lineHeight: 1.55, margin: '12px auto 0', maxWidth: 440 }}>
        The tournament funnel — four-player groups narrowing through the semifinals to a single champion — seeds when the season locks. Until then, the weekly base-layer groups are live in the leaderboard; play your group of four to climb.
      </div>
    </div>
  );
}

// ════════════════════════════ CENTERED MODALS ══════════════════════════════
// Desktop modals — centered cards (not bottom sheets). Reuse ActionOption +
// AgentOrb so copy and visuals can't drift from the mobile action layer.

export function LDFocus({ width = 480, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,9,0.74)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'lgFadeIn .2s ease both' }} />
      <div style={{ position: 'relative', width, maxWidth: '100%', maxHeight: '90vh', animation: 'lgFadeIn .26s ease both' }}>{children}</div>
    </div>
  );
}

export function LDActionModal({ accent, onClose, onPick }) {
  return (
    <LDFocus width={560} onClose={onClose}>
      <div className="lg-scroll" style={{ background: LTOKENS.bg, borderRadius: 22, border: `1px solid ${LTOKENS.hair2}`, padding: '20px 22px 24px', boxShadow: '0 30px 90px rgba(0,0,0,0.6)', maxHeight: '88vh', overflowY: 'auto', color: LTOKENS.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Eyebrow color={accent}>Enter tournament</Eyebrow>
          <button className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <Icon name="x" size={15} color={LTOKENS.ink2} />
          </button>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 18 }}>Pick your mode</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActionOption icon="play" color={LX.energy} kicker="Solo · Training" title="Quick Play"
            body="Jump into a practice group of four against CPU opponents. No stakes, no waiting — start anytime and tune your picks and your agent."
            honest="Every other seat here is a CPU. Great for learning the format before you enter the bracket."
            onPick={() => onPick('quick')} />
          <ActionOption icon="ranked" color={LX.comp} kicker="Competitive · This month's bracket" title="Ranked Play"
            body="The real bracket. You're drawn into a named group of four — finish top two on combined score and you advance through the funnel toward the Final Four."
            honest="If your group isn't full of humans, empty seats run as CPU — the same pods you just watched. Honest competition either way."
            onPick={() => onPick('ranked')} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '12px 14px', borderRadius: 13, background: alpha(accent, 0.07), border: `1px solid ${alpha(accent, 0.22)}` }}>
          <Icon name="clock" size={17} color={accent} />
          <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.45 }}>
            <b style={{ color: LTOKENS.ink }}>Your group locks Monday.</b> That&apos;s when the draft runs and the trading week begins. Join any time before — your seat is held.
          </div>
        </div>
      </div>
    </LDFocus>
  );
}

export function LDJoinModal({ mode, onClose, onWatch }) {
  const quick = mode === 'quick';
  const color = quick ? LX.energy : LX.comp;
  return (
    <LDFocus width={460} onClose={onClose}>
      <div style={{ borderRadius: 22, border: `1px solid ${LTOKENS.hair2}`, overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
        background: `radial-gradient(circle at 50% 30%, ${alpha(color, 0.16)}, transparent 62%), ${LTOKENS.bg}`,
        padding: '40px 34px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: LTOKENS.ink }}>
        <AgentOrb state="ready" size={104} color={color} />
        <Mono style={{ fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color, marginTop: 26 }}>
          {quick ? 'Quick Play' : "Ranked · This month's bracket"}
        </Mono>
        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 9 }}>Seat reserved</div>
        <div style={{ fontSize: 13.5, color: LTOKENS.ink2, lineHeight: 1.55, marginTop: 11, maxWidth: 340 }}>
          {quick
            ? <>Your training group is ready against CPU opponents. <b style={{ color: LTOKENS.ink }}>The draft runs Monday</b> — that&apos;s when trading opens. We&apos;ll bring your picks and agent in then.</>
            : <>You&apos;re drawn into a group of four for this month&apos;s bracket. <b style={{ color: LTOKENS.ink }}>Your group locks Monday</b> when the draft runs; empty seats run as CPU until humans arrive.</>}
        </div>
        <button className="lg-tap" onClick={onWatch} style={{ all: 'unset', cursor: 'pointer', marginTop: 26, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', maxWidth: 320, padding: '14px', borderRadius: 13, background: color, color: LTOKENS.bg, fontWeight: 700, fontSize: 14.5, boxShadow: `0 8px 24px ${alpha(color, 0.32)}` }}>
          <LIcon name="eyeR" size={16} color={LTOKENS.bg} /> Watch a live game while you wait
        </button>
        <button className="lg-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', marginTop: 12, color: LTOKENS.ink3, fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.08em' }}>BACK TO LOBBY</button>
      </div>
    </LDFocus>
  );
}

// ═══════════════════ THE TRAINING POD ADDITION (purple) ═════════════════════

// Ranked | Training tab control for the desktop top bar. Training rides the
// purple accent so it reads as practice; Ranked rides the tournament teal.
export function DeskTabBar({ tab, onSwitchTab, accent }) {
  const tabs = [
    { id: 'ranked', label: 'Ranked', icon: 'ranked', color: accent },
    { id: 'training', label: 'Training Pod', icon: 'play', color: TRAIN.base },
  ];
  return (
    <div role="tablist" aria-label="League mode" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      {tabs.map((t) => {
        const on = t.id === tab;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} className="lg-tap" onClick={() => onSwitchTab(t.id)}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
              background: on ? alpha(t.color, 0.16) : 'transparent', border: `1px solid ${on ? alpha(t.color, 0.42) : 'transparent'}` }}>
            <LIcon name={t.icon} size={14} color={on ? t.color : LTOKENS.ink3} stroke={2} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: on ? LTOKENS.ink : LTOKENS.ink3 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Active Training Game card — the "jump back in" surface (build spec §4).
//    Purple, clearly labelled practice so it never reads as a live bracket game.
//    Mirrors DeploymentCard's routable-card pattern; tap → onOpenTrainingPod.
export function ActiveTrainingGameCard({ pod, onResume }) {
  const drafting = pod?.status === GROUP_STATUS.DRAFTING;
  const live = pod?.status === GROUP_STATUS.BATTLE;
  const title = drafting ? 'Resume your draft' : 'Return to your training pod';
  const sub = drafting ? 'live snake draft · finish your picks' : 'your training battle · CPU opponents';
  const statusLabel = drafting ? 'DRAFTING' : live ? 'LIVE' : pod?.status === GROUP_STATUS.AWAITING_OPEN ? 'AWAITING OPEN' : 'ACTIVE';
  return (
    <button className="lg-tap" onClick={onResume} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13,
      padding: '16px 18px', borderRadius: 16,
      background: `linear-gradient(120deg, ${alpha(TRAIN.base, 0.22)}, ${alpha(TRAIN.base, 0.08)})`,
      border: `1px solid ${alpha(TRAIN.base, 0.45)}`, boxShadow: `0 8px 28px ${alpha(TRAIN.base, 0.2)}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: TRAIN.base, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${alpha(TRAIN.base, 0.45)}` }}>
        <LIcon name="play" size={19} color={LTOKENS.bg} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16.5, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>{title}</span>
          <Tag color={TRAIN.lt}>Training</Tag>
        </div>
        <Mono style={{ fontSize: 11, color: alpha(TRAIN.lt, 0.95), marginTop: 2 }}>{sub}</Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: alpha(TRAIN.base, 0.14), border: `1px solid ${alpha(TRAIN.base, 0.34)}` }}>
          {live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: TRAIN.lt, animation: 'lgLiveDot 1.6s infinite' }} />}
          <Mono style={{ fontSize: 10, color: TRAIN.lt, fontWeight: 600, letterSpacing: '0.08em' }}>{statusLabel}</Mono>
        </span>
        <Icon name="arrowR" size={20} color={TRAIN.base} />
      </div>
    </button>
  );
}

// The CPU-only footnote — shared by both Training-tab states.
function TrainingCpuNote() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderRadius: 13, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      <LIcon name="cpu" size={14} color={LX.cpu} stroke={2} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.45 }}>
        Every seat here is a CPU. No stakes, no cut — practice runs don&apos;t feed the leaderboard or the bracket.
      </div>
    </div>
  );
}

// ── Training Pod panel (desktop) — the no-stakes practice surface. Renders the
//    Active Training Game card when a pod is in progress (re-entry, build spec
//    §4), else the cold-start CTA. Reuses the proven training stack: the start
//    path runs quickPlayTraining and routes into the fresh pod via
//    onOpenTrainingPod; the server is the sole authority (client gates are
//    courtesy). Purple throughout, per the build spec.
export function DeskTrainingPanel({ onOpenTrainingPod, activeTrainingPod = null, hasAgent, agentLoadout = null, uid = null }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const inFlight = useRef(false);

  const runTrainingForm = async (loadoutSpec = null) => {
    if (inFlight.current) return;
    if (hasAgent === false) { setError(mapLobbyError({ code: 'no_agent' })); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await quickPlayTraining(loadoutSpec ? { loadoutSpec } : undefined);
      setChooserOpen(false);
      onOpenTrainingPod?.({ id: res.groupId, status: res.status ?? GROUP_STATUS.DRAFTING });
    } catch (err) {
      if (err?.code === 'already_active' && err?.data?.groupId) {
        setChooserOpen(false);
        onOpenTrainingPod?.({ id: err.data.groupId, status: err.data.status });
      } else {
        setError(mapLobbyError(err));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const start = () => runTrainingForm(null);
  const openChooser = () => { setError(null); setChooserOpen(true); };

  // ── Re-entry state: the Active Training Game card REPLACES the start CTA. When
  //    the climb preview is enabled AND the pod is in BATTLE, the real five-day
  //    climb takes the card's place (tap → the same onOpenTrainingPod hop); a
  //    pre-bell pod keeps the card. ─────────────────────────────────────────────
  if (activeTrainingPod) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {shouldPreviewClimb(activeTrainingPod, CLIMB_PREVIEW_ON) ? (
          <TrainingClimbPreview pod={activeTrainingPod} uid={uid} onOpen={() => onOpenTrainingPod?.(activeTrainingPod)} viewport="desktop" accent={TRAIN.base} />
        ) : (
          <ActiveTrainingGameCard pod={activeTrainingPod} onResume={() => onOpenTrainingPod?.(activeTrainingPod)} />
        )}
        <TrainingCpuNote />
      </div>
    );
  }

  // ── Cold-start state: the start CTA. ────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ borderRadius: 20, padding: '34px 28px', background: `linear-gradient(160deg, ${alpha(TRAIN.base, 0.12)}, ${LTOKENS.surface} 64%)`, border: `1px solid ${alpha(TRAIN.base, 0.32)}`, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 17, margin: '0 auto 16px', background: alpha(TRAIN.base, 0.16), border: `1px solid ${alpha(TRAIN.base, 0.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LIcon name="play" size={28} color={TRAIN.base} stroke={1.9} />
        </div>
        <Mono style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: alpha(TRAIN.lt, 0.95) }}>Solo · Training Pod</Mono>
        <div style={{ fontSize: 24, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.02em', marginTop: 9 }}>Practice the League format</div>
        <div style={{ fontSize: 13.5, color: LTOKENS.ink2, lineHeight: 1.55, margin: '11px auto 0', maxWidth: 460 }}>
          Spin up a no-stakes group of four against CPU opponents. Rehearse the draft → claims → flips loop and tune your picks and your agent before you enter the bracket. Nothing on the line.
        </div>
        <button type="button" className="lg-tap" onClick={start} disabled={busy}
          style={{ all: 'unset', boxSizing: 'border-box', cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20, padding: '14px 26px', borderRadius: 13, background: TRAIN.base, color: LTOKENS.bg, fontWeight: 700, fontSize: 15, opacity: busy ? 0.7 : 1, boxShadow: `0 8px 24px ${alpha(TRAIN.base, 0.32)}` }}>
          <LIcon name="play" size={16} color={LTOKENS.bg} /> {busy ? 'Starting your pod…' : 'Start a training pod'}
        </button>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="lg-tap" onClick={openChooser} disabled={busy}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: busy ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px', color: alpha(TRAIN.lt, 0.95), fontWeight: 600, fontSize: 12.5, opacity: busy ? 0.5 : 1 }}>
            <LIcon name="layers" size={13} color={alpha(TRAIN.lt, 0.95)} /> Customize loadout
          </button>
        </div>
        {error && <div role="alert" style={{ marginTop: 12, fontSize: 12, color: LX.neg, lineHeight: 1.4 }}>{error}</div>}
      </div>
      <TrainingCpuNote />

      <LoadoutChooserSheet
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        accent={TRAIN.base}
        currentArchetype={agentLoadout?.archetype}
        currentWatchlistId={agentLoadout?.equippedWatchlistId}
        currentWatchlistName={agentLoadout?.equippedWatchlistName}
        onStart={(spec) => runTrainingForm(spec)}
        busy={busy}
        error={chooserOpen ? error : null}
      />
    </div>
  );
}
