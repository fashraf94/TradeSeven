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
  makeEngineState, applyBeat, applyFlip, applyAsk, applyAsking, applyAnswer, setRemaining,
  clearBeat, tickClock,
} from './arenaEngineCore';
import { beatKey, firstUnseenBeat } from './arenaBeatDiff';
import { LEAGUE_AGENT_CHAT_ENABLED } from '../../../config/featureFlags';

const BEAT_DWELL_MS = 4400;
const SEEN_CAP = 500; // bound the live seen-set across a long session

// The in-voice failure line (a hiccup reaching the agent). NOT an error banner — it
// renders as a normal agent message and the input stays open for a retry, and the
// server never charged (the count is unchanged).
const ASK_FAILED_LINE = "Couldn't get through to me just then — give it another shot.";

// Lazy-load the authed-fetch helper so this hook's static import graph stays node-clean
// (the SSR smoke test never loads firebase). Module-cached, so both callers share it.
const loadAuthedFetch = () => import('../../../utils/fetchWithAuth').then((m) => m.fetchWithAuth);

export function useArenaEngine({
  active, voice, beats, ask, closeStart = 0, wireStart = 0, beatInterval = 7600,
  live = false, liveBeats = null, battleId = null, agentId = null,
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

  // flip = the on-board DRAMA only (the surge token + "you flipped X" caption).
  // The server write + optimistic direction + rollback live in DockYourThree; the
  // dock fires this only AFTER the server confirms, so a rejected flip never shows
  // the celebratory animation.
  const flip = React.useCallback((tk, newDir) => {
    setEng((s) => applyFlip(s, tk, newDir));
    scheduleClear();
  }, [scheduleClear]);

  const askAgent = React.useCallback((i) => {
    const qa = Array.isArray(ask) ? ask[i] : null;
    if (qa) setEng((s) => applyAsk(s, qa));
  }, [ask]);

  // ── the LIVE two-way ask (flag-gated). Ready only with a real battle identity, so
  //    the fixtures/preview path never fires a network call. Both fetches lazy-import
  //    the authed-fetch helper so this hook's static graph stays node-clean (the SSR
  //    smoke test never loads firebase). ──
  const chatReady = LEAGUE_AGENT_CHAT_ENABLED && !!battleId && !!agentId;
  const inFlightRef = React.useRef(false);

  const askLive = React.useCallback(async (message) => {
    const text = String(message ?? '').trim();
    if (!chatReady || !text || inFlightRef.current) return;
    inFlightRef.current = true;
    setEng((s) => applyAsking(s));
    try {
      const fetchWithAuth = await loadAuthedFetch();
      const res = await fetchWithAuth('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({ agentId, battleId, message: text, leagueAsk: true }),
      });
      const data = await res.json().catch(() => ({}));
      // A non-ok status OR a 200 with no answer text (malformed body) both surface the
      // in-voice retry line — never a blank agent bubble. The server did NOT charge on
      // either, so the counter is left untouched.
      if (!res.ok || !data.agentMessage) {
        setEng((s) => applyAnswer(s, { q: text, text: ASK_FAILED_LINE, error: true }));
        return;
      }
      // Success OR the in-voice exhausted 200 — both carry agentMessage + remaining.
      setEng((s) => setRemaining(applyAnswer(s, { q: text, text: data.agentMessage }), data.remaining));
    } catch {
      setEng((s) => applyAnswer(s, { q: text, text: ASK_FAILED_LINE, error: true }));
    } finally {
      inFlightRef.current = false;
    }
  }, [chatReady, agentId, battleId]);

  const fetchRemaining = React.useCallback(async () => {
    if (!chatReady) return;
    try {
      const fetchWithAuth = await loadAuthedFetch();
      const res = await fetchWithAuth(`/api/agent/chat-budget?battleId=${encodeURIComponent(battleId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEng((s) => setRemaining(s, data.remaining));
    } catch { /* leave the counter as-is — never block the arena on a counter read */ }
  }, [chatReady, battleId]);

  // Clear a stale counter the instant the battle identity changes (a new game-day's
  // battle doc, or switching groups) so the dock never shows the prior battle's count.
  React.useEffect(() => { setEng((s) => (s.remaining == null ? s : { ...s, remaining: null })); }, [battleId]);

  // On open (live only), fetch the true "N left today" so the counter is never a
  // client guess — it reflects any questions already spent earlier today.
  React.useEffect(() => { if (chatReady && live) fetchRemaining(); }, [chatReady, live, fetchRemaining]);

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
    // Scan + fire FIRST, then bound the set — so the cap rebuild never folds a beat
    // that just landed this tick into "seen" before it gets a chance to fire.
    const r = firstUnseenBeat(liveBeats, seenRef.current);
    if (r) { seenRef.current.add(r.key); fireBeat(r.beat); }
    if (seenRef.current.size > SEEN_CAP) seenRef.current = new Set(liveBeats.map(beatKey)); // safety valve
    return undefined;
  }, [live, liveBeats, fireBeat]);

  // Re-sync a countdown only on a meaningful seed change — the wire OPENING
  // (cur ≤ 0 → a positive seed) or a large server correction (>90s drift). Between
  // those, the per-second tick owns the value, so the displayed countdown stays
  // smooth instead of snapping to the minute-granular seed every rebuild.
  React.useEffect(() => {
    setCloseClock((cur) => (closeStart > 0 && (cur <= 0 || Math.abs(closeStart - cur) > 90) ? closeStart : cur));
  }, [closeStart]);
  React.useEffect(() => {
    setWireClock((cur) => (wireStart > 0 && (cur <= 0 || Math.abs(wireStart - cur) > 90) ? wireStart : cur));
  }, [wireStart]);

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
    // two-way ask (flag-gated; inert in preview / when off)
    askLive,
    fetchRemaining,
    chatReady,
    remaining: eng.remaining,
    asking: eng.asking,
  };
}
