// src/utils/draftPlayback.js
//
// P5 — the pure playback layer for the two-act draft theater (ratified
// proposal A). One parser reads BOTH Monday streams through their verified
// shape parity (P3a claim, re-verified at P5 Stage 0):
//   - streams/userDraft  events: { pickNumber, round, odUserId, symbol,
//                                  boardRank, fallback, passedOver }
//     (api/tournament/resolve-user-draft.js)
//   - streams/agentDraft events: the same seven fields + agentId
//     (api/_utils/tournamentAgentDraft.js)
//
// buildPlaybackTimeline annotates what the writers record implicitly:
//   - SNIPES: each passedOver name is attributed to who took it — an earlier
//     pick in the same market (the takenBy accumulation), a rival player's
//     user-layer pick (the agent draft's cross-layer block, Spec §1.3), or
//     'unavailable' (ledger-held names with no in-stream taker — the
//     re-formed-group defense case; honest, unattributed).
//   - DOUBLE-DOWNS (act 2): an agent drafting its own player's user pick —
//     the draft-night leverage beat (V2.1 §5).
//   - FALLBACKS ride through as-is for the muted, honest treatment.
//
// playbackReducer is the theater's state machine: play/pause, 5s-clock ticks
// (pacing constant: TOURNAMENT_TUNING.PLAYBACK_MS_PER_PICK — caller-owned),
// scrub (pauses, clamps), skip-to-end, replay-from-ended.
//
// ZERO-IMPORT MODULE, BY RULE (the leagueTournament.js precedent) — pure,
// clock-free, deterministic; the component owns timers and reads.

export const PASSED_OVER_KIND = Object.freeze({
  TAKEN: 'taken',                    // an earlier pick in the same market
  RIVAL_USER_PICK: 'rival_user_pick', // blocked by a rival player's user-layer pick (act 2)
  UNAVAILABLE: 'unavailable',        // no in-stream taker (ledger-held defense case)
});

/**
 * Normalize one stream event into the playback pick shape. Both streams pass
 * through here — `agentId` is the optional actor discriminator (its presence
 * is what distinguishes an agent pick). Returns null for an unusable event
 * (corrupt-stream tolerance: the theater skips, never throws mid-show).
 */
export function normalizeDraftEvent(event, act) {
  if (!event || typeof event.symbol !== 'string' || !event.symbol) return null;
  if (!Number.isInteger(event.pickNumber)) return null;
  return {
    act,
    pickNumber: event.pickNumber,
    round: Number.isInteger(event.round) ? event.round : null,
    odUserId: typeof event.odUserId === 'string' ? event.odUserId : null,
    agentId: typeof event.agentId === 'string' ? event.agentId : null,
    actorId: typeof event.agentId === 'string' ? event.agentId : (event.odUserId ?? null),
    symbol: event.symbol,
    boardRank: Number.isInteger(event.boardRank) ? event.boardRank : null,
    fallback: event.fallback === true,
    passedOver: Array.isArray(event.passedOver) ? event.passedOver.filter(s => typeof s === 'string') : [],
  };
}

/**
 * Annotate one act's normalized picks with snipe attribution and (act 2)
 * double-downs. `userPicksByPlayer` = Map(odUserId → Set(symbols)) of the
 * resolved user-layer picks — the act-2 cross-layer block source.
 */
function annotateAct(picks, { userPicksByPlayer = new Map() } = {}) {
  const takenBy = new Map(); // symbol → { actorId, odUserId, pickNumber }
  for (const pick of picks) {
    pick.passedOver = pick.passedOver.map(symbol => {
      const taker = takenBy.get(symbol);
      if (taker) {
        return { symbol, kind: PASSED_OVER_KIND.TAKEN, takenByActorId: taker.actorId, takenByOdUserId: taker.odUserId, atPickNumber: taker.pickNumber };
      }
      if (pick.act === 2) {
        for (const [odUserId, symbols] of userPicksByPlayer) {
          if (odUserId !== pick.odUserId && symbols.has(symbol)) {
            return { symbol, kind: PASSED_OVER_KIND.RIVAL_USER_PICK, takenByActorId: null, takenByOdUserId: odUserId, atPickNumber: null };
          }
        }
      }
      return { symbol, kind: PASSED_OVER_KIND.UNAVAILABLE, takenByActorId: null, takenByOdUserId: null, atPickNumber: null };
    });
    pick.doubleDown = pick.act === 2
      && (userPicksByPlayer.get(pick.odUserId)?.has(pick.symbol) ?? false);
    takenBy.set(pick.symbol, { actorId: pick.actorId, odUserId: pick.odUserId, pickNumber: pick.pickNumber });
  }
  return picks;
}

/**
 * Build the two-act timeline from the stream docs. Either stream may be null
 * (a group mid-Monday has only the user act); events are ordered by
 * pickNumber regardless of stored order. Every pick carries `seq` (1-based
 * global position) — the scrubber's coordinate.
 *
 * `players` (group doc players[]) is the act-2 double-down/rival source of
 * record; when absent it is derived from the act-1 events (the streams are
 * self-sufficient for a completed Monday).
 */
export function buildPlaybackTimeline({ userStream = null, agentStream = null, players = null } = {}) {
  const actOf = (stream, act) => (Array.isArray(stream?.events) ? stream.events : [])
    .map(e => normalizeDraftEvent(e, act))
    .filter(Boolean)
    .sort((a, b) => a.pickNumber - b.pickNumber);

  const act1 = actOf(userStream, 1);
  const act2 = actOf(agentStream, 2);

  const userPicksByPlayer = new Map();
  if (Array.isArray(players)) {
    for (const p of players) {
      if (p?.odUserId) {
        userPicksByPlayer.set(p.odUserId, new Set((p.picks || []).map(pk => pk?.symbol).filter(Boolean)));
      }
    }
  } else {
    for (const pick of act1) {
      if (!userPicksByPlayer.has(pick.odUserId)) userPicksByPlayer.set(pick.odUserId, new Set());
      userPicksByPlayer.get(pick.odUserId).add(pick.symbol);
    }
  }

  annotateAct(act1, {});
  annotateAct(act2, { userPicksByPlayer });

  const picks = [...act1, ...act2].map((pick, i) => ({ ...pick, seq: i + 1 }));
  return {
    acts: [
      { act: 1, picks: picks.filter(p => p.act === 1) },
      { act: 2, picks: picks.filter(p => p.act === 2) },
    ],
    picks,
    totalPicks: picks.length,
    hasUserAct: act1.length > 0,
    hasAgentAct: act2.length > 0,
  };
}

// ==================== STATE MACHINE ====================

export const PLAYBACK_STATUS = Object.freeze({
  PAUSED: 'paused',
  PLAYING: 'playing',
  ENDED: 'ended',
});

/** Initial state: nothing revealed, paused (the theater opens on a poster
 * frame; the component dispatches PLAY on the user's cue). `index` = number
 * of picks revealed, 0..totalPicks. */
export function createPlaybackState(totalPicks) {
  const total = Number.isInteger(totalPicks) && totalPicks > 0 ? totalPicks : 0;
  return { status: total === 0 ? PLAYBACK_STATUS.ENDED : PLAYBACK_STATUS.PAUSED, index: 0, totalPicks: total };
}

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/**
 * Pure reducer. Actions: PLAY (replays from the start when ended), PAUSE,
 * TICK (the pacing timer's beat — reveals one pick, ends at the boundary),
 * SCRUB {index} (clamps and PAUSES — direct manipulation owns the clock),
 * SKIP_END, RESET, SEED {totalPicks} (a late-arriving or growing stream —
 * live Monday — re-seats the machine without losing the viewer's place; a
 * viewer parked at the old end stays paused there as the show grows).
 */
export function playbackReducer(state, action) {
  const { totalPicks } = state;
  switch (action?.type) {
    case 'SEED': {
      const total = Number.isInteger(action.totalPicks) && action.totalPicks > 0 ? action.totalPicks : 0;
      if (total === totalPicks) return state;
      if (total === 0) return createPlaybackState(0);
      const index = clamp(state.index, 0, total);
      const status = state.status === PLAYBACK_STATUS.PLAYING
        ? PLAYBACK_STATUS.PLAYING
        : index >= total ? PLAYBACK_STATUS.ENDED : PLAYBACK_STATUS.PAUSED;
      return { status, index, totalPicks: total };
    }
    case 'PLAY': {
      if (totalPicks === 0) return state;
      if (state.status === PLAYBACK_STATUS.ENDED || state.index >= totalPicks) {
        return { ...state, status: PLAYBACK_STATUS.PLAYING, index: 0 };
      }
      return { ...state, status: PLAYBACK_STATUS.PLAYING };
    }
    case 'PAUSE':
      return state.status === PLAYBACK_STATUS.PLAYING ? { ...state, status: PLAYBACK_STATUS.PAUSED } : state;
    case 'TICK': {
      if (state.status !== PLAYBACK_STATUS.PLAYING) return state;
      const index = clamp(state.index + 1, 0, totalPicks);
      return { ...state, index, status: index >= totalPicks ? PLAYBACK_STATUS.ENDED : PLAYBACK_STATUS.PLAYING };
    }
    case 'SCRUB': {
      if (totalPicks === 0) return state;
      const index = clamp(Number.isInteger(action.index) ? action.index : state.index, 0, totalPicks);
      return { ...state, index, status: index >= totalPicks ? PLAYBACK_STATUS.ENDED : PLAYBACK_STATUS.PAUSED };
    }
    case 'SKIP_END':
      if (totalPicks === 0) return state;
      return { ...state, index: totalPicks, status: PLAYBACK_STATUS.ENDED };
    case 'RESET':
      return createPlaybackState(totalPicks);
    default:
      return state;
  }
}
