// src/components/Tournament/DraftPlaybackTheater.jsx
//
// P5 — the draft playback theater (Spec §1.5; V2.1 §5's Monday draft show,
// VOD-native; ratified proposal A). Two acts on one component: Act 1 replays
// streams/userDraft (12 picks), Act 2 replays streams/agentDraft (24 picks),
// both through the parity parser in src/utils/draftPlayback.js. Pacing rides
// TOURNAMENT_TUNING.PLAYBACK_MS_PER_PICK (the tuning-ledger constant).
//
// Presentation contract (founder-ratified):
//   - SNIPES are the drama: passed-over names render struck-through with who
//     took them and when (amber); the landing pick slides in with its board
//     rank. Cross-layer blocks name the rival player (Spec §1.3).
//   - DOUBLE-DOWNS get the purple chip + the agent's stance line.
//   - FALLBACKS are muted and honest ("board exhausted — ranking auto-pick").
//   - The viewer's own seats get a subtle you-highlight (founder note).
//   - Motion is the Snake Draft's language restyled in tokens (siblings in
//     motion, not in palette — S3 ratified): holo sweep + reveal, ALL gated
//     on useReducedMotion (the DataStrike posture: color-only when reduced).
//   - Scrub is a native range input — gesture-correct on mobile for free.
//
// Self-contained reads (all client-legal under the recursive rules block):
// both stream docs + agentBoards (rationale, stance lines, archetype). The
// component is read-only by construction — playback never writes.

import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, FastForward, Swords, Bot, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { HOLO_SWEEP } from '../../constants/animationTokens';
import {
  subscribeUserDraftStream,
  subscribeAgentDraftStream,
  subscribeAgentBoards,
} from '../../services/tournamentGroupService';
import {
  buildPlaybackTimeline,
  createPlaybackState,
  playbackReducer,
  PLAYBACK_STATUS,
  PASSED_OVER_KIND,
} from '../../utils/draftPlayback';
import { TOURNAMENT_TUNING } from '../../constants/leagueTournament';

const PACE_MS = TOURNAMENT_TUNING.PLAYBACK_MS_PER_PICK;

export default function DraftPlaybackTheater({ groupId, group, uid, onDone }) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();

  const [userStream, setUserStream] = useState(null);
  const [agentStream, setAgentStream] = useState(null);
  const [agentBoards, setAgentBoards] = useState([]);

  useEffect(() => {
    if (!groupId) return undefined;
    const subs = [
      subscribeUserDraftStream(groupId, setUserStream),
      subscribeAgentDraftStream(groupId, setAgentStream),
      subscribeAgentBoards(groupId, setAgentBoards),
    ];
    return () => subs.forEach(unsub => unsub());
  }, [groupId]);

  const timeline = useMemo(
    () => buildPlaybackTimeline({ userStream, agentStream, players: group?.players ?? null }),
    [userStream, agentStream, group]
  );
  const boardByAgent = useMemo(
    () => new Map(agentBoards.map(b => [b.id, b])),
    [agentBoards]
  );

  const [state, dispatch] = useReducer(playbackReducer, timeline.totalPicks, createPlaybackState);
  // Streams arrive async (and a live Monday can grow Act 2 mid-view) —
  // re-seat the machine on every timeline size change; SEED preserves the
  // viewer's place.
  useEffect(() => {
    dispatch({ type: 'SEED', totalPicks: timeline.totalPicks });
  }, [timeline.totalPicks]);

  // The pacing clock (the tuning-ledger 5s/pick): one beat per reveal while
  // playing; the reducer owns every boundary.
  useEffect(() => {
    if (state.status !== PLAYBACK_STATUS.PLAYING) return undefined;
    const timer = setInterval(() => dispatch({ type: 'TICK' }), PACE_MS);
    return () => clearInterval(timer);
  }, [state.status]);

  const seatLabel = (odUserId) => {
    if (odUserId === uid) return 'You';
    const player = (group?.players || []).find(p => p.odUserId === odUserId);
    if (player?.isCpu) return `CPU ${odUserId}`;
    return odUserId || 'Unknown';
  };
  const actorLabel = (pick) => (pick.act === 1 ? seatLabel(pick.odUserId) : `${seatLabel(pick.odUserId)}'s agent`);

  const act1Count = timeline.acts[0].picks.length;
  const revealed = timeline.picks.slice(0, state.index);
  const current = revealed[revealed.length - 1] ?? null;
  const inActTwo = current ? current.act === 2 : state.index > act1Count;

  if (timeline.totalPicks === 0) {
    return (
      <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 16, color: tokens.textMuted, fontSize: 13 }}>
        No draft to replay yet — the playback opens once Monday's draft resolves.
      </div>
    );
  }

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ActBanner
        tokens={tokens}
        inActTwo={inActTwo}
        hasAgentAct={timeline.hasAgentAct}
        agentBoards={agentBoards}
        seatLabel={seatLabel}
        started={state.index > 0}
      />

      {state.index === 0 ? (
        <PosterFrame tokens={tokens} totalPicks={timeline.totalPicks} onPlay={() => dispatch({ type: 'PLAY' })} />
      ) : state.status === PLAYBACK_STATUS.ENDED && state.index >= timeline.totalPicks ? (
        <EndCard tokens={tokens} timeline={timeline} uid={uid} seatLabel={seatLabel} actorLabel={actorLabel} onDone={onDone} onReplay={() => dispatch({ type: 'PLAY' })} />
      ) : current ? (
        <StagePick
          key={current.seq}
          tokens={tokens}
          pick={current}
          uid={uid}
          actorLabel={actorLabel}
          seatLabel={seatLabel}
          rationale={current.agentId ? boardByAgent.get(current.agentId)?.rationale?.[current.symbol] : null}
          stance={current.doubleDown ? (boardByAgent.get(current.agentId)?.userPicksStance || []).find(s => s.symbol === current.symbol)?.stance : null}
          reduceMotion={reduceMotion}
        />
      ) : null}

      {state.index > 0 && state.index < timeline.totalPicks + 1 && revealed.length > 1 && (
        <PickLog tokens={tokens} picks={revealed.slice(0, -1)} uid={uid} actorLabel={actorLabel} />
      )}

      <Controls tokens={tokens} state={state} dispatch={dispatch} totalPicks={timeline.totalPicks} />
    </div>
  );
}

// ==================== FRAMES ====================

function PosterFrame({ tokens, totalPicks, onPlay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '26px 12px', textAlign: 'center' }}>
      <Swords size={28} color={tokens.teal} />
      <div style={{ fontWeight: 800, fontSize: 18, color: tokens.textPrimary, letterSpacing: '-0.01em' }}>The Monday Draft</div>
      <div style={{ fontSize: 13, color: tokens.textMuted }}>
        {totalPicks} picks · two acts · every snipe as it happened
      </div>
      <button
        onClick={onPlay}
        style={{
          marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px',
          borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
          background: tokens.purple, color: tokens.textWhite, boxShadow: tokens.glowPurpleBtn,
        }}
      >
        <Play size={16} /> Watch the draft
      </button>
    </div>
  );
}

function ActBanner({ tokens, inActTwo, hasAgentAct, agentBoards, seatLabel, started }) {
  const stances = useMemo(
    () => agentBoards.flatMap(b => (b.userPicksStance || []).map(s => ({ ...s, odUserId: b.odUserId }))),
    [agentBoards]
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {inActTwo ? <Bot size={15} color={tokens.purpleText} /> : <Swords size={15} color={tokens.teal} />}
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: inActTwo ? tokens.purpleText : tokens.teal }}>
          {inActTwo ? 'Act 2 — The Agent Draft' : 'Act 1 — The User Draft'}
        </span>
      </div>
      {inActTwo && started && stances.length > 0 && (
        <div style={{ fontSize: 12, color: tokens.textMuted, lineHeight: 1.5 }}>
          The agents saw the boards.{' '}
          {stances.slice(0, 2).map((s, i) => (
            <span key={`${s.odUserId}-${s.symbol}-${i}`}>
              <span style={{ color: tokens.textSecondary, fontWeight: 600 }}>{seatLabel(s.odUserId)}'s agent</span> on {s.symbol}: “{s.stance}” {' '}
            </span>
          ))}
        </div>
      )}
      {!hasAgentAct && started && !inActTwo && (
        <div style={{ fontSize: 11, color: tokens.textFaint }}>Agent draft pending — Act 2 appears once it resolves.</div>
      )}
    </div>
  );
}

// ==================== THE STAGE ====================

function StagePick({ tokens, pick, uid, actorLabel, seatLabel, rationale, stance, reduceMotion }) {
  const isYou = pick.odUserId === uid;
  const accent = pick.doubleDown ? tokens.purpleText : pick.act === 2 ? tokens.purpleText : tokens.teal;

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 10, padding: 12,
        background: tokens.bgApp,
        border: `1px solid ${isYou ? tokens.teal : tokens.borderInput}`,
        boxShadow: isYou ? tokens.glowTealNav : 'none',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      {!reduceMotion && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: HOLO_SWEEP.duration, ease: HOLO_SWEEP.ease }}
          style={{ position: 'absolute', inset: 0, background: HOLO_SWEEP.gradient, pointerEvents: 'none' }}
        />
      )}

      {pick.passedOver.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {pick.passedOver.map(po => (
            <SnipeLine key={po.symbol} tokens={tokens} po={po} seatLabel={seatLabel} reduceMotion={reduceMotion} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: tokens.textFaint, fontVariantNumeric: 'tabular-nums' }}>Pick {pick.pickNumber} · R{pick.round}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: isYou ? tokens.teal : tokens.textSecondary }}>{actorLabel(pick)}</span>
        {isYou && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: tokens.teal }}>YOU</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: tokens.textWhite }}>{pick.symbol}</span>
        {pick.fallback ? (
          <span style={{ fontSize: 11, color: tokens.textMuted, border: `1px solid ${tokens.borderInput}`, borderRadius: 6, padding: '2px 6px' }}>
            board exhausted — ranking auto-pick
          </span>
        ) : (
          <span style={{ fontSize: 11, color: accent, border: `1px solid ${tokens.borderInput}`, borderRadius: 6, padding: '2px 6px' }}>
            board #{pick.boardRank + 1}{pick.passedOver.length > 0 ? ` — slid past ${pick.passedOver.length}` : ''}
          </span>
        )}
        {pick.doubleDown && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800,
            color: tokens.purpleText, border: `1px solid ${tokens.borderPurple}`, borderRadius: 6,
            padding: '2px 8px', boxShadow: tokens.glowPurpleCard,
          }}>
            <Zap size={11} /> DOUBLE-DOWN
          </span>
        )}
      </div>

      {rationale && <div style={{ fontSize: 12, color: tokens.textMuted, fontStyle: 'italic' }}>“{rationale}”</div>}
      {stance && <div style={{ fontSize: 12, color: tokens.purpleText }}>Stance at board time: “{stance}”</div>}
    </motion.div>
  );
}

function SnipeLine({ tokens, po, seatLabel, reduceMotion }) {
  const attribution = po.kind === PASSED_OVER_KIND.TAKEN
    ? `taken by ${seatLabel(po.takenByOdUserId)} (pick ${po.atPickNumber})`
    : po.kind === PASSED_OVER_KIND.RIVAL_USER_PICK
      ? `${seatLabel(po.takenByOdUserId)}'s user pick — off-limits`
      : 'unavailable';
  return (
    <motion.div
      initial={{ color: tokens.amber, opacity: reduceMotion ? 1 : 0 }}
      animate={{ color: tokens.textFaint, opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      style={{ fontSize: 12 }}
    >
      <span style={{ textDecoration: 'line-through', fontWeight: 600 }}>{po.symbol}</span>
      <span style={{ color: tokens.amber }}> · {attribution}</span>
    </motion.div>
  );
}

function PickLog({ tokens, picks, uid, actorLabel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 3, maxHeight: 180, overflowY: 'auto' }}>
      {picks.map(pick => (
        <div
          key={pick.seq}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 8px',
            borderRadius: 6, background: tokens.bgElevated,
            borderLeft: `2px solid ${pick.odUserId === uid ? tokens.teal : 'transparent'}`,
          }}
        >
          <span style={{ width: 24, color: tokens.textFaintest, fontVariantNumeric: 'tabular-nums' }}>{pick.act}.{pick.pickNumber}</span>
          <span style={{ fontWeight: 700, color: tokens.textPrimary, width: 52 }}>{pick.symbol}</span>
          <span style={{ color: tokens.textFaint, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actorLabel(pick)}</span>
          {pick.doubleDown && <Zap size={11} color={tokens.purpleText} />}
          {pick.passedOver.length > 0 && <span style={{ color: tokens.amber, fontSize: 10 }}>snipe ×{pick.passedOver.length}</span>}
          {pick.fallback && <span style={{ color: tokens.textFaintest, fontSize: 10 }}>auto</span>}
        </div>
      ))}
    </div>
  );
}

// ==================== END CARD ====================

function EndCard({ tokens, timeline, uid, seatLabel, actorLabel, onDone, onReplay }) {
  const userRosters = new Map();
  for (const pick of timeline.acts[0].picks) {
    if (!userRosters.has(pick.odUserId)) userRosters.set(pick.odUserId, []);
    userRosters.get(pick.odUserId).push(pick);
  }
  const agentRosters = new Map();
  for (const pick of timeline.acts[1].picks) {
    if (!agentRosters.has(pick.actorId)) agentRosters.set(pick.actorId, []);
    agentRosters.get(pick.actorId).push(pick);
  }

  const rosterRow = (label, picks, isYou) => (
    <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '4px 8px', borderRadius: 6, background: isYou ? tokens.bgElevated : 'transparent', borderLeft: `2px solid ${isYou ? tokens.teal : 'transparent'}` }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: isYou ? tokens.teal : tokens.textSecondary, minWidth: 90 }}>{label}</span>
      <span style={{ fontSize: 12, color: tokens.textMuted, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {picks.map(p => (
          <span key={p.seq} style={{ color: p.doubleDown ? tokens.purpleText : tokens.textMuted, fontWeight: p.doubleDown ? 700 : 400 }}>
            {p.symbol}{p.doubleDown ? ' ⚡' : ''}
          </span>
        ))}
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: tokens.textPrimary }}>Final rosters</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: tokens.teal, textTransform: 'uppercase' }}>User layer — 3 picks each</div>
        {[...userRosters.entries()].map(([odUserId, picks]) => rosterRow(seatLabel(odUserId), picks, odUserId === uid))}
      </div>
      {timeline.hasAgentAct && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: tokens.purpleText, textTransform: 'uppercase' }}>Agent layer — 6 picks each · ⚡ double-down</div>
          {[...agentRosters.values()].map(picks => rosterRow(actorLabel(picks[0]), picks, picks[0].odUserId === uid))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onReplay}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${tokens.borderInput}`, background: 'transparent', color: tokens.textSecondary, fontWeight: 700, cursor: 'pointer' }}
        >
          Watch again
        </button>
        {onDone && (
          <button
            onClick={onDone}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', background: tokens.purple, color: tokens.textWhite, fontWeight: 700, cursor: 'pointer', boxShadow: tokens.glowPurpleBtn }}
          >
            On to battle week
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== CONTROLS ====================

function Controls({ tokens, state, dispatch, totalPicks }) {
  const playing = state.status === PLAYBACK_STATUS.PLAYING;
  const btn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 44, height: 44, borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${tokens.borderInput}`, background: tokens.bgElevated, color: tokens.textPrimary,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={() => dispatch({ type: playing ? 'PAUSE' : 'PLAY' })}
        aria-label={playing ? 'Pause playback' : 'Play playback'}
        style={btn}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <input
        type="range"
        min={0}
        max={totalPicks}
        step={1}
        value={state.index}
        onChange={(e) => dispatch({ type: 'SCRUB', index: Number(e.target.value) })}
        aria-label="Scrub the draft timeline"
        style={{ flex: 1, accentColor: tokens.teal, minHeight: 44, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 12, color: tokens.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>
        {state.index}/{totalPicks}
      </span>
      <button onClick={() => dispatch({ type: 'SKIP_END' })} aria-label="Skip to the final rosters" style={btn}>
        <FastForward size={18} />
      </button>
    </div>
  );
}
