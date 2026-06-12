// src/utils/draftPlayback.test.js
//
// P5 battery for the pure playback layer. The parity lock: fixtures shaped
// EXACTLY like both writers' records (resolve-user-draft.js events;
// tournamentAgentDraft.js events with agentId) flow through the ONE
// normalizer. Annotation locks: snipe attribution (same-market taker,
// rival-user-pick block, unattributable), the act-2 double-down, fallback
// pass-through. Reducer locks: pacing ticks, scrub clamps + pauses,
// skip-to-end, replay-from-ended, empty-timeline degeneracy.

import { describe, it, expect } from 'vitest';
import {
  PASSED_OVER_KIND,
  PLAYBACK_STATUS,
  normalizeDraftEvent,
  buildPlaybackTimeline,
  createPlaybackState,
  playbackReducer,
} from './draftPlayback';

// ==================== WRITER-SHAPED FIXTURES ====================

// resolve-user-draft.js:116 — { pickNumber, round, odUserId, symbol, boardRank, fallback, passedOver }
const USER_STREAM = {
  events: [
    { pickNumber: 1, round: 1, odUserId: 'alice', symbol: 'NVDA', boardRank: 0, fallback: false, passedOver: [] },
    { pickNumber: 2, round: 1, odUserId: 'bob', symbol: 'AMD', boardRank: 1, fallback: false, passedOver: ['NVDA'] },
    { pickNumber: 3, round: 1, odUserId: 'cara', symbol: 'META', boardRank: 0, fallback: false, passedOver: [] },
    { pickNumber: 4, round: 2, odUserId: 'cara', symbol: 'TSLA', boardRank: 2, fallback: false, passedOver: ['AMD'] },
    { pickNumber: 5, round: 2, odUserId: 'bob', symbol: 'PLTR', boardRank: null, fallback: true, passedOver: ['NVDA', 'META'] },
    { pickNumber: 6, round: 2, odUserId: 'alice', symbol: 'AAPL', boardRank: 3, fallback: false, passedOver: [] },
  ],
  roundNumber: 1,
  resolvedAt: '2026-06-15T11:05:00.000Z',
};

// tournamentAgentDraft.js:149 — the same seven fields + agentId
const AGENT_STREAM = {
  events: [
    { pickNumber: 1, round: 1, agentId: 'ag-alice', odUserId: 'alice', symbol: 'MSFT', boardRank: 0, fallback: false, passedOver: [] },
    // The drafted double-down: alice's agent takes alice's own user pick.
    { pickNumber: 2, round: 1, agentId: 'ag-bob', odUserId: 'bob', symbol: 'SNOW', boardRank: 2, fallback: false, passedOver: ['MSFT', 'NVDA'] },
    { pickNumber: 3, round: 1, agentId: 'ag-alice', odUserId: 'alice', symbol: 'NVDA', boardRank: 1, fallback: false, passedOver: [] },
    { pickNumber: 4, round: 2, agentId: 'ag-bob', odUserId: 'bob', symbol: 'CRWD', boardRank: null, fallback: true, passedOver: ['ZZZZ'] },
  ],
  picksByAgent: { 'ag-alice': ['MSFT', 'NVDA'], 'ag-bob': ['SNOW', 'CRWD'] },
  roundNumber: 1,
  resolvedAt: '2026-06-15T11:06:00.000Z',
};

describe('normalizeDraftEvent — one parser, both stream shapes (the parity lock)', () => {
  it('normalizes a user event (no agentId): actor is the player', () => {
    const pick = normalizeDraftEvent(USER_STREAM.events[1], 1);
    expect(pick).toMatchObject({
      act: 1, pickNumber: 2, round: 1, odUserId: 'bob', agentId: null, actorId: 'bob',
      symbol: 'AMD', boardRank: 1, fallback: false, passedOver: ['NVDA'],
    });
  });

  it('normalizes an agent event (the superset field): actor is the agent, owner rides along', () => {
    const pick = normalizeDraftEvent(AGENT_STREAM.events[0], 2);
    expect(pick).toMatchObject({
      act: 2, pickNumber: 1, odUserId: 'alice', agentId: 'ag-alice', actorId: 'ag-alice',
      symbol: 'MSFT', boardRank: 0, fallback: false,
    });
  });

  it('a fallback pick carries fallback: true and a null boardRank (both writers)', () => {
    expect(normalizeDraftEvent(USER_STREAM.events[4], 1)).toMatchObject({ fallback: true, boardRank: null });
    expect(normalizeDraftEvent(AGENT_STREAM.events[3], 2)).toMatchObject({ fallback: true, boardRank: null });
  });

  it('tolerates corrupt events (skips, never throws mid-show)', () => {
    expect(normalizeDraftEvent(null, 1)).toBeNull();
    expect(normalizeDraftEvent({ symbol: '' }, 1)).toBeNull();
    expect(normalizeDraftEvent({ symbol: 'NVDA' }, 1)).toBeNull(); // no pickNumber
  });
});

describe('buildPlaybackTimeline — two acts, snipe attribution, double-downs', () => {
  const timeline = buildPlaybackTimeline({ userStream: USER_STREAM, agentStream: AGENT_STREAM });

  it('two acts on one seq axis (the scrubber coordinate)', () => {
    expect(timeline.totalPicks).toBe(10);
    expect(timeline.acts[0].picks).toHaveLength(6);
    expect(timeline.acts[1].picks).toHaveLength(4);
    expect(timeline.picks.map(p => p.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(timeline.hasUserAct).toBe(true);
    expect(timeline.hasAgentAct).toBe(true);
  });

  it('SNIPES read as who-lost-what-to-whom: passed-over names name their taker and pick', () => {
    const bobsPick = timeline.acts[0].picks[1];
    expect(bobsPick.passedOver).toEqual([
      { symbol: 'NVDA', kind: PASSED_OVER_KIND.TAKEN, takenByActorId: 'alice', takenByOdUserId: 'alice', atPickNumber: 1 },
    ]);
    // The fallback pick's drama is still attributed before the muted landing.
    const fallbackPick = timeline.acts[0].picks[4];
    expect(fallbackPick.passedOver.map(p => p.takenByOdUserId)).toEqual(['alice', 'cara']);
  });

  it('act-2 cross-layer blocks attribute to the rival player (Spec §1.3), unattributable names stay honest', () => {
    const bobsAgentPick = timeline.acts[1].picks[1];
    expect(bobsAgentPick.passedOver).toEqual([
      // MSFT was taken in the agent market at pick 1.
      { symbol: 'MSFT', kind: PASSED_OVER_KIND.TAKEN, takenByActorId: 'ag-alice', takenByOdUserId: 'alice', atPickNumber: 1 },
      // NVDA is alice's USER pick — blocked for bob's agent, never "taken" in act 2.
      { symbol: 'NVDA', kind: PASSED_OVER_KIND.RIVAL_USER_PICK, takenByActorId: null, takenByOdUserId: 'alice', atPickNumber: null },
    ]);
    // A name no in-stream record explains (ledger-held defense case).
    const fallbackAgentPick = timeline.acts[1].picks[3];
    expect(fallbackAgentPick.passedOver[0].kind).toBe(PASSED_OVER_KIND.UNAVAILABLE);
  });

  it('THE DOUBLE-DOWN: an agent drafting its own player\'s user pick is marked; rivals never are', () => {
    const aliceDoubleDown = timeline.acts[1].picks[2]; // ag-alice takes NVDA — alice's own user pick
    expect(aliceDoubleDown.doubleDown).toBe(true);
    expect(timeline.acts[1].picks.filter(p => p.doubleDown)).toHaveLength(1);
    expect(timeline.acts[0].picks.every(p => p.doubleDown === false)).toBe(true);
  });

  it('a group mid-Monday (agent stream pending) yields a one-act timeline', () => {
    const partial = buildPlaybackTimeline({ userStream: USER_STREAM, agentStream: null });
    expect(partial.totalPicks).toBe(6);
    expect(partial.hasAgentAct).toBe(false);
  });

  it('group players[] (when supplied) is the double-down source of record', () => {
    const fromPlayers = buildPlaybackTimeline({
      userStream: null,
      agentStream: AGENT_STREAM,
      players: [{ odUserId: 'alice', picks: [{ symbol: 'NVDA' }] }, { odUserId: 'bob', picks: [] }],
    });
    expect(fromPlayers.acts[1].picks[2].doubleDown).toBe(true);
  });

  it('events are ordered by pickNumber regardless of stored order', () => {
    const shuffled = { ...USER_STREAM, events: [...USER_STREAM.events].reverse() };
    const ordered = buildPlaybackTimeline({ userStream: shuffled });
    expect(ordered.picks.map(p => p.pickNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('playbackReducer — the theater state machine', () => {
  const start = () => createPlaybackState(10);

  it('opens paused on the poster frame; PLAY starts the clock', () => {
    expect(start()).toEqual({ status: PLAYBACK_STATUS.PAUSED, index: 0, totalPicks: 10 });
    expect(playbackReducer(start(), { type: 'PLAY' }).status).toBe(PLAYBACK_STATUS.PLAYING);
  });

  it('TICK reveals one pick per beat and ends exactly at the boundary', () => {
    let state = playbackReducer(start(), { type: 'PLAY' });
    for (let i = 1; i <= 9; i++) {
      state = playbackReducer(state, { type: 'TICK' });
      expect(state).toMatchObject({ index: i, status: PLAYBACK_STATUS.PLAYING });
    }
    state = playbackReducer(state, { type: 'TICK' });
    expect(state).toMatchObject({ index: 10, status: PLAYBACK_STATUS.ENDED });
    // Ticks past the end are inert (a straggling timer can't overrun).
    expect(playbackReducer(state, { type: 'TICK' })).toEqual(state);
  });

  it('TICK while paused is inert (pause really pauses)', () => {
    const paused = playbackReducer(playbackReducer(start(), { type: 'PLAY' }), { type: 'PAUSE' });
    expect(playbackReducer(paused, { type: 'TICK' })).toEqual(paused);
  });

  it('SCRUB clamps to [0, total] and PAUSES — direct manipulation owns the clock', () => {
    const playing = playbackReducer(start(), { type: 'PLAY' });
    expect(playbackReducer(playing, { type: 'SCRUB', index: 7 })).toMatchObject({ index: 7, status: PLAYBACK_STATUS.PAUSED });
    expect(playbackReducer(playing, { type: 'SCRUB', index: -3 })).toMatchObject({ index: 0, status: PLAYBACK_STATUS.PAUSED });
    expect(playbackReducer(playing, { type: 'SCRUB', index: 99 })).toMatchObject({ index: 10, status: PLAYBACK_STATUS.ENDED });
  });

  it('SKIP_END jumps to the final roster; PLAY from ended replays from the top', () => {
    const ended = playbackReducer(start(), { type: 'SKIP_END' });
    expect(ended).toMatchObject({ index: 10, status: PLAYBACK_STATUS.ENDED });
    expect(playbackReducer(ended, { type: 'PLAY' })).toMatchObject({ index: 0, status: PLAYBACK_STATUS.PLAYING });
  });

  it('an empty timeline is born ended and stays inert', () => {
    const empty = createPlaybackState(0);
    expect(empty.status).toBe(PLAYBACK_STATUS.ENDED);
    expect(playbackReducer(empty, { type: 'PLAY' })).toEqual(empty);
    expect(playbackReducer(empty, { type: 'SCRUB', index: 3 })).toEqual(empty);
  });

  it('SEED re-seats a machine born before the streams arrived (async reads)', () => {
    const empty = createPlaybackState(0);
    const seeded = playbackReducer(empty, { type: 'SEED', totalPicks: 12 });
    expect(seeded).toEqual({ status: PLAYBACK_STATUS.PAUSED, index: 0, totalPicks: 12 });
  });

  it('SEED on a growing live stream keeps the viewer\'s place; a parked viewer un-ends', () => {
    // Mid-show: place preserved, playback continues.
    const midShow = { status: PLAYBACK_STATUS.PLAYING, index: 5, totalPicks: 12 };
    expect(playbackReducer(midShow, { type: 'SEED', totalPicks: 36 }))
      .toEqual({ status: PLAYBACK_STATUS.PLAYING, index: 5, totalPicks: 36 });
    // Parked at the old end: the show grew, so ended becomes paused-there.
    const parked = { status: PLAYBACK_STATUS.ENDED, index: 12, totalPicks: 12 };
    expect(playbackReducer(parked, { type: 'SEED', totalPicks: 36 }))
      .toEqual({ status: PLAYBACK_STATUS.PAUSED, index: 12, totalPicks: 36 });
    // Same size: identity (no spurious re-renders).
    expect(playbackReducer(midShow, { type: 'SEED', totalPicks: 12 })).toBe(midShow);
  });
});
