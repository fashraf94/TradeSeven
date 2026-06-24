// src/components/League/battleArena/useArenaEngine.js
//
// League Battle View V2 — the live ARENA ENGINE hook. A thin React wrapper around
// the pure arenaEngineCore: it holds the engine state, owns the beat/clock timers,
// and exposes the imperative affordances (flip a pick, ask the agent). ALL of the
// transition logic lives in arenaEngineCore (unit-tested); this file is only
// React plumbing — so it stays out of the pure-test surface the repo can run.

import React from 'react';
import {
  makeEngineState, applyBeat, applyFlip, applyAsk, clearBeat, tickClock,
} from './arenaEngineCore';

const BEAT_DWELL_MS = 4400;

export function useArenaEngine({ active, voice, beats, ask, closeStart = 0, wireStart = 0, beatInterval = 7600 }) {
  const [eng, setEng] = React.useState(() => makeEngineState(voice));
  const [closeClock, setCloseClock] = React.useState(closeStart);
  const [wireClock, setWireClock] = React.useState(wireStart);
  const idxRef = React.useRef(0);
  const dwellRef = React.useRef(null);

  const scheduleClear = React.useCallback(() => {
    if (dwellRef.current) clearTimeout(dwellRef.current);
    dwellRef.current = setTimeout(() => setEng((s) => clearBeat(s)), BEAT_DWELL_MS);
  }, []);

  const fireBeat = React.useCallback((beat) => {
    setEng((s) => applyBeat(s, beat));
    scheduleClear();
  }, [scheduleClear]);

  const flip = React.useCallback((tk, newDir) => {
    setEng((s) => applyFlip(s, tk, newDir));
    scheduleClear();
  }, [scheduleClear]);

  const askAgent = React.useCallback((i) => {
    const qa = Array.isArray(ask) ? ask[i] : null;
    if (qa) setEng((s) => applyAsk(s, qa));
  }, [ask]);

  // auto-fire the beat stream while the battle is live
  React.useEffect(() => {
    if (!active || !Array.isArray(beats) || !beats.length) return undefined;
    const id = setInterval(() => {
      const b = beats[idxRef.current % beats.length];
      idxRef.current += 1;
      fireBeat(b);
    }, beatInterval);
    return () => clearInterval(id);
  }, [active, beats, beatInterval, fireBeat]);

  // tick the close + wire countdowns
  React.useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      setCloseClock(tickClock);
      setWireClock(tickClock);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  // tidy the dwell timer on unmount
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
