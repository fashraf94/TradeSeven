// src/components/League/draft/useDraftReveal.js
//
// The opponent-reveal controller (Phase 2). The server resolves the CPU run-up
// in one transaction, so the client receives all the new picks in a single
// draft-state snapshot. This hook detects the newly-arrived CPU picks since the
// last consumed point and replays them pick-by-pick at the design's pacing
// (~0.52s first, ~1.18s each), marking a "snipe" when a CPU took a name that sat
// in the human's pre-pick top tier (#1–6). Honors prefers-reduced-motion: the
// reveal steps instantly with no per-pick flash. Includes a skip/fast-forward.
//
// It never replays history on mount (a resumed pod shows current state); only
// picks that arrive after the state doc first loads animate.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';

const FIRST_MS = 520;
const EACH_MS = 1180;
const FINISH_MS = 1000;
const FLASH_MS = 1600;

// Pure: turn the raw new CPU pick events into reveal-block items, marking snipes
// against the human's pre-pick board ranks (symbol → boardRank). Exported for tests.
export function enrichRevealBlock(cpuPicks, snipeRanks) {
  const ranks = snipeRanks || new Map();
  return (cpuPicks || []).map((e) => {
    const sym = String(e.symbol || '').toUpperCase();
    const r = ranks.get(sym);
    const humanRank = r != null ? r : null;
    return {
      pickNumber: e.pickNumber,
      odUserId: e.odUserId,
      symbol: sym,
      humanRank,
      sniped: humanRank != null && humanRank >= 1 && humanRank <= 6,
    };
  });
}

export function useDraftReveal({ events = [], ready = false, currentUserId = null, snipeRanksRef = null } = {}) {
  const reduceMotion = useReducedMotion();
  const seenRef = useRef(null);   // # of events already consumed
  const timerRef = useRef(null);
  const [rev, setRev] = useState({ active: false, block: [], idx: 0, flash: null });

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  // detect a fresh run-up of CPU picks → start a reveal block
  useEffect(() => {
    if (!ready) return;
    // initialize on first load of the state doc — do not replay history
    if (seenRef.current == null) { seenRef.current = events.length; return; }
    if (events.length <= seenRef.current) return;
    if (rev.active) return; // queue: the next run-up is picked up after this one finishes
    const delta = events.slice(seenRef.current);
    const cpuPicks = delta.filter((e) => e && e.odUserId !== currentUserId);
    seenRef.current = events.length; // consume the delta (the human's own pick included)
    if (!cpuPicks.length) return;
    // Use the pre-pick ranks ONLY if they were captured for the human pick that
    // triggered this exact run-up (snipeRanksRef = { atIndex, ranks }). A stale
    // capture (e.g. after a clock autopick, which never captures) yields no
    // snipes rather than wrong ones.
    const humanEvt = delta.find((e) => e && e.odUserId === currentUserId);
    const humanIndex0 = humanEvt ? humanEvt.pickNumber - 1 : null;
    const cap = snipeRanksRef && snipeRanksRef.current;
    const ranks = cap && humanIndex0 != null && cap.atIndex === humanIndex0 ? cap.ranks : new Map();
    const block = enrichRevealBlock(cpuPicks, ranks);
    // reduced motion: show the whole feed at once (instant step, no flash)
    setRev({ active: true, block, idx: reduceMotion ? block.length : 0, flash: null });
  }, [events, ready, currentUserId, reduceMotion, rev.active, snipeRanksRef]);

  // drive the per-pick reveal
  useEffect(() => {
    if (!rev.active) return undefined;
    clearTimer();
    if (rev.idx < rev.block.length) {
      const ms = rev.idx === 0 ? FIRST_MS : EACH_MS;
      timerRef.current = setTimeout(() => {
        setRev((s) => {
          const item = s.block[s.idx];
          return { ...s, idx: s.idx + 1, flash: item && item.sniped ? item : s.flash };
        });
      }, ms);
    } else {
      timerRef.current = setTimeout(() => setRev((s) => ({ ...s, active: false })), reduceMotion ? FINISH_MS / 2 : FINISH_MS);
    }
    return clearTimer;
  }, [rev.active, rev.idx, rev.block, reduceMotion]);

  // clear the snipe flash
  useEffect(() => {
    if (!rev.flash) return undefined;
    const t = setTimeout(() => setRev((s) => ({ ...s, flash: null })), FLASH_MS);
    return () => clearTimeout(t);
  }, [rev.flash]);

  const skip = useCallback(() => {
    clearTimer();
    setRev((s) => ({ active: false, block: s.block, idx: s.block.length, flash: null }));
  }, []);

  // tidy timers on unmount
  useEffect(() => clearTimer, []);

  const feed = rev.block.slice(0, rev.idx);
  return { revealing: rev.active, feed, flash: rev.flash, skip, reduceMotion };
}

export default useDraftReveal;
