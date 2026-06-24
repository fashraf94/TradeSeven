// src/components/League/battleArena/useArenaEngine.js
//
// League Battle View V2 — the live ARENA ENGINE hook. A thin React wrapper around
// the pure arenaEngineCore: it holds the engine state, owns the beat/clock timers,
// and exposes the imperative affordances (flip a pick, ask the agent). ALL of the
// transition logic lives in arenaEngineCore (unit-tested); this file is React
// plumbing.
//
// TWO MODES:
//   • PREVIEW (fixtures): auto-loops the fixture `beats` on a timer (the dev
//     ?battleViewV2=1 surface).
//   • LIVE (real data): no loop — it watches `liveBeats` (deriveBeats over real
//     docs) and surfaces only the FRESHEST UNSEEN beat (arenaBeatDiff), primed on
//     entry so it never replays history. `flip` fires the optimistic on-board
//     drama AND returns the real write's promise so the dock can roll back on a
//     server rejection (no phantom flip).

import React from 'react';
import {
  makeEngineState, applyBeat, applyFlip, applyAsk, clearBeat, tickClock,
} from './arenaEngineCore';
import { beatKey, firstUnseenBeat } from './arenaBeatDiff';

const BEAT_DWELL_MS = 4400;
const SEEN_CAP = 500; // bound the live seen-set across a long session

export function useArenaEngine({
  active, voice, beats, ask, closeStart = 0, wireStart = 0, beatInterval = 7600,
  live = false, liveBeats = null, onFlip = null,
}) {
  const [eng, setEng] = React.useState(() => makeEngineState(voice));
  const [closeClock, setCloseClock] = React.useState(closeStart);
  const [wireClock, setWireClock] = React.useState(wireStart);
  const idxRef = React.useRef(0);
  const dwellRef = React.useRef(null);
  const seenRef = React.useRef(null); // Set<beatKey> already fired (live mode)

  const scheduleClear = React.useCallback(() => {
    if (dwellRef.current) clearTimeout(dwellRef.current);
    dwellRef.current = setTimeout(() => setEng((s) => clearBeat(s)), BEAT_DWELL_MS);
  }, []);

  const fireBeat = React.useCallback((beat) => {
    setEng((s) => applyBeat(s, beat));
    scheduleClear();
  }, [scheduleClear]);

  // flip: optimistic on-board drama + the real write (or a resolved no-op in
  // preview). Returns the write promise so the caller can await + roll back.
  const flip = React.useCallback((tk, newDir) => {
    setEng((s) => applyFlip(s, tk, newDir));
    scheduleClear();
    return onFlip ? onFlip(tk, newDir) : Promise.resolve();
  }, [scheduleClear, onFlip]);

  const askAgent = React.useCallback((i) => {
    const qa = Array.isArray(ask) ? ask[i] : null;
    if (qa) setEng((s) => applyAsk(s, qa));
  }, [ask]);

  // PREVIEW: auto-fire the fixture beat loop (OFF in live mode)
  React.useEffect(() => {
    if (live || !active || !Array.isArray(beats) || !beats.length) return undefined;
    const id = setInterval(() => {
      const b = beats[idxRef.current % beats.length];
      idxRef.current += 1;
      fireBeat(b);
    }, beatInterval);
    return () => clearInterval(id);
  }, [live, active, beats, beatInterval, fireBeat]);

  // LIVE: surface the freshest UNSEEN real beat. On entry, adopt ALL current beats
  // as "seen" so we don't replay history; thereafter fire genuine new beats. The
  // seen-SET (not a single last-key) is what stops a sticky top-of-list beat (a
  // lead change) from masking newer event beats behind it (arenaBeatDiff header).
  React.useEffect(() => {
    if (!live || !Array.isArray(liveBeats) || !liveBeats.length) return undefined;
    if (seenRef.current === null) {
      seenRef.current = new Set(liveBeats.map(beatKey));
      return undefined;
    }
    if (seenRef.current.size > SEEN_CAP) seenRef.current = new Set(liveBeats.map(beatKey)); // safety valve
    const r = firstUnseenBeat(liveBeats, seenRef.current);
    if (r) { seenRef.current.add(r.key); fireBeat(r.beat); }
    return undefined;
  }, [live, liveBeats, fireBeat]);

  // re-sync the countdowns when the model supplies a new seed — useState seeds
  // once, so a wire that opens later (or a corrected server remaining-time) would
  // otherwise keep ticking from the original (often 0) value. In preview the seed
  // is constant, so this is a one-time no-op.
  React.useEffect(() => { setCloseClock(closeStart); }, [closeStart]);
  React.useEffect(() => { setWireClock(wireStart); }, [wireStart]);

  // tick the close + wire countdowns (only when a positive start is supplied)
  React.useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      setCloseClock(tickClock);
      setWireClock(tickClock);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  React.useEffect(() => () => { if (dwellRef.current) clearTimeout(dwellRef.current); }, []);

  return {
    lines: eng.lines,
    beat: eng.beat,
    beatStar: eng.beatStar,
    surge: eng.surge,
    flareKey: eng.flareKey,
    closeClock,
    wireClock,
    flip,
    askAgent,
  };
}
