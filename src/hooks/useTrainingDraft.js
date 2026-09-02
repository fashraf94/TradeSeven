// src/hooks/useTrainingDraft.js
//
// League Training Slice 2 — the interactive snake-draft hook for the
// tournamentGroups path. The tournamentGroups analog of useDraft (which is
// drafts-bound): it mirrors the live pick-by-pick pattern but reads the
// server-authoritative live state (tournamentGroups/{id}/draft/state, written
// only by the Admin-SDK training-pick endpoint + the lifecycle sweeps) instead
// of writing client-side.
//
// Responsibilities:
//   • subscribe to the group doc + the draft/state sibling doc;
//   • read the universal board once (indexIntelligence/stockRankings) and join
//     the pod's userPool to it by symbol, marking depleted names;
//   • layer the per-player archetype-fit overlay (~5 still-available names via
//     the pure computeArchetypeRankings — call, never copy);
//   • run the per-pick countdown when it's the human's turn and fire an autopick
//     on expiry (the client timer; the server idle-sweep is the tab-close
//     backstop — see trainingLifecycle.sweepIdleDraftingPods);
//   • submit a pick through the server endpoint (tournamentActions.makeTrainingPick).
//
// computeArchetypeRankings is the pure, zero-import, NON-fenced engine in
// api/_utils — imported here under the established src→api precedent
// (tickerSearchMatch, fantasyTimesDetector, …). Never copy scoring math.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { subscribeGroup, subscribeDraftState } from '../services/tournamentGroupService';
import { makeTrainingPick as makeTrainingPickAction, mapTournamentActionError } from '../services/tournamentActions';
import { computeArchetypeRankings } from '../../api/_utils/archetypeScoring.js';
import { readUniverseAxisContext } from '../../api/_utils/axisDerivation.js';
import { GROUP_STATUS, PICKS_PER_PLAYER, TRAINING_TUNING } from '../constants/leagueTournament';
import { isTrainingPodDraftV2On, TRAINING_POD_PICK_CLOCK_MS } from '../config/featureFlags';

const OVERLAY_SIZE = 5;
const norm = (s) => (typeof s === 'string' ? s.trim().toUpperCase() : '');

// Archetype Rank V2: the scorer's default event sink is console.warn (the
// producer collects events into the observation snapshot); in the browser the
// overlay's coverage event fires on every late-draft recompute (< 5 names left),
// so the client sink is silent — the server snapshots carry the observation.
const silentScorerSink = () => {};

// One interactive-draft hook for BOTH modes (the "one room, both modes" reuse):
// the subscription (group + the shared draft/state doc), board, seats, clock, and
// turn logic are mode-agnostic. `submitAction` parameterizes the ONLY coupling —
// the pick endpoint (training-pick vs live-draft-pick). Default (null) →
// makeTrainingPick, so training is byte-identical. The archetype overlay reads a
// single `humanArchetype` (training) OR the per-user `archetypeByUser` map
// (competitive), humanArchetype winning so training is unchanged.
export function useTrainingDraft({ user, groupId, active = true, clockPaused = false, submitAction = null } = {}) {
  const [group, setGroup] = useState(null);
  const [draft, setDraft] = useState(null);
  const [universe, setUniverse] = useState(null); // indexIntelligence/stockRankings.stocks
  const [universeContext, setUniverseContext] = useState(null); // { universeSize, universeMedianReturn1W } — Archetype Rank V2
  const [pickClock, setPickClock] = useState(null); // seconds remaining on my turn
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const currentUserId = user?.odUserId || user?.uid || user?.username || null;
  const autopickFiredRef = useRef(false);
  const submitRef = useRef(null);

  // L1 (Training Pod Draft V2): the HUMAN pick clock runs 60s under the V2 gate,
  // else the module's 20s PICK_CLOCK_MS — resolved off the flag/override so
  // leagueTournament.js stays zero-import and flag-off is byte-identical. The ring
  // TOTAL and the running countdown both derive from THIS single value, so they
  // can never disagree (a stale 20s ring against a 60s clock). CPU turns are
  // untouched — they carry no clock (they resolve server-side).
  const clockTotalSec = useMemo(
    () => Math.max(1, Math.round((isTrainingPodDraftV2On() ? TRAINING_POD_PICK_CLOCK_MS : (TRAINING_TUNING.PICK_CLOCK_MS || 20000)) / 1000)),
    [],
  );

  // ---- subscriptions: group + live draft state ----
  useEffect(() => {
    if (!active || !groupId) return undefined;
    const unsubGroup = subscribeGroup(groupId, setGroup);
    const unsubDraft = subscribeDraftState(groupId, setDraft);
    return () => { unsubGroup && unsubGroup(); unsubDraft && unsubDraft(); };
  }, [active, groupId]);

  // ---- the universal board, read once ----
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'indexIntelligence', 'stockRankings'));
        if (!cancelled) setUniverse(snap.exists() ? (snap.data().stocks || []) : []);
        if (!cancelled) setUniverseContext(snap.exists() ? readUniverseAxisContext(snap.data()) : null);
      } catch (err) {
        console.error('[useTrainingDraft] stockRankings read failed:', err?.message);
        if (!cancelled) setUniverse([]);
      }
    })();
    return () => { cancelled = true; };
  }, [active]);

  // ---- derived turn / completion ----
  const members = group?.groupMembers || [];
  const totalPicks = members.length * PICKS_PER_PLAYER;
  const currentPickIndex = draft?.currentPickIndex ?? 0;
  const onClockSeatIdx = draft?.snakeOrder?.[currentPickIndex];
  const onClockId = Number.isInteger(onClockSeatIdx) ? members[onClockSeatIdx] : null;
  const isDrafting = draft?.status === 'drafting' && group?.status === GROUP_STATUS.DRAFTING;
  const isMyTurn = isDrafting && onClockId != null && onClockId === currentUserId;
  // Completion = the pod has left DRAFTING (handed off to AWAITING_OPEN/BATTLE).
  const isComplete = !!group && group.status !== GROUP_STATUS.DRAFTING && group.status != null;

  const takenSet = useMemo(() => new Set((draft?.taken || []).map(norm)), [draft?.taken]);
  const poolSet = useMemo(() => new Set((draft?.pool || []).map(norm)), [draft?.pool]);

  // ---- the board: pool symbols joined to the universe, depletion-marked,
  //      grouped by sector and composite-sorted within sector ----
  const boardBySector = useMemo(() => {
    if (!Array.isArray(draft?.pool)) return [];
    const bySymbol = new Map((universe || []).map(s => [norm(s.symbol), s]));
    const rows = draft.pool.map((sym) => {
      const key = norm(sym);
      const meta = bySymbol.get(key) || { symbol: key };
      return {
        symbol: key,
        sectorName: meta.sectorName || 'Other',
        compositeScore: meta.compositeScore ?? null,
        momentumScore: meta.momentumScore ?? null,
        momentumRank: meta.momentumRank ?? null,
        available: !takenSet.has(key),
      };
    });
    const groups = new Map();
    for (const r of rows) {
      if (!groups.has(r.sectorName)) groups.set(r.sectorName, []);
      groups.get(r.sectorName).push(r);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
    }
    return [...groups.entries()]
      .map(([sectorName, items]) => ({ sectorName, items }))
      .sort((a, b) => a.sectorName.localeCompare(b.sectorName));
  }, [draft?.pool, universe, takenSet]);

  // ---- enriched pool rows (Training Board redesign, read-only widening): every
  //      pool name joined to the universe doc with the fields the fit-ranked
  //      board needs — arch_scores (the direct-read fit spine), the pillar
  //      signals (composite/momentum/fundamental/technical/ATR), and realized
  //      returns. Surfaced for the new atoms; the legacy boardBySector path above
  //      is untouched (flag-off renders byte-identically). ----
  const poolRows = useMemo(() => {
    if (!Array.isArray(draft?.pool)) return [];
    const bySymbol = new Map((universe || []).map((s) => [norm(s.symbol), s]));
    return draft.pool.map((sym) => {
      const key = norm(sym);
      const meta = bySymbol.get(key) || { symbol: key };
      return {
        symbol: key,
        sectorName: meta.sectorName || 'Other',
        archScores: meta.arch_scores || {},
        compositeScore: meta.compositeScore ?? null,
        momentumScore: meta.momentumScore ?? null,
        momentumRank: meta.momentumRank ?? null,
        fundamentalScore: meta.fundamentalScore ?? null,
        technicalScore: meta.technicalScore ?? null,
        baggerBombFit: meta.baggerBombFit ?? null,
        atrPercentile: meta.atrPercentile ?? null,
        return1W: meta.return1W ?? null,
        return1M: meta.return1M ?? null,
        return3M: meta.return3M ?? null,
        returnYTD: meta.returnYTD ?? null,
        available: !takenSet.has(key),
      };
    });
  }, [draft?.pool, universe, takenSet]);

  // ---- archetype-fit overlay: top ~5 still-available names. R3: if the
  //      ranking is unusable, return an empty highlight (the board is already
  //      composite-sorted) rather than rendering a broken overlay. ----
  const highlightSet = useMemo(() => {
    const archetype = draft?.humanArchetype || draft?.archetypeByUser?.[currentUserId] || 'analyst';
    if (!Array.isArray(universe) || universe.length === 0 || poolSet.size === 0) return new Set();
    const available = universe.filter((s) => {
      const sym = norm(s.symbol);
      return poolSet.has(sym) && !takenSet.has(sym);
    });
    if (available.length === 0) return new Set();
    let ranked = null;
    // Archetype Rank V2 (spec §4 census path 8): explicit 'training' mode, the
    // doc-level subset context (P-8), and the §3.4 pinned overlay minimum. V1
    // ignores opts; a V2 throw lands in the existing empty-overlay degrade.
    try {
      ranked = computeArchetypeRankings(available, archetype, {
        gameMode: 'training',
        universeSize: universeContext?.universeSize,
        universeMedianReturn1W: universeContext?.universeMedianReturn1W,
        minCandidates: OVERLAY_SIZE,
        onEvent: silentScorerSink,
      });
    } catch (err) {
      // R3 degrade (empty overlay) stays; the cause is no longer silent (V-5).
      console.warn('[useTrainingDraft] archetype ranking unavailable — overlay hidden:', err?.message);
      ranked = null;
    }
    if (!Array.isArray(ranked) || ranked.length === 0) return new Set();
    return new Set(ranked.slice(0, OVERLAY_SIZE).map((s) => norm(s.symbol)));
  }, [universe, universeContext, draft?.humanArchetype, draft?.archetypeByUser, currentUserId, poolSet, takenSet]);

  // ---- submit a pick (explicit or autopick) through the server endpoint ----
  const submitPick = useCallback(async (symbol, autopick = false) => {
    // The `submitting` guard also blocks a clock-fired autopick from racing an
    // in-flight pick (the autopick path calls this too).
    if (!groupId || submitting) return false;
    setSubmitting(true);
    setError(null);
    try {
      await (submitAction || makeTrainingPickAction)({ groupId, symbol: symbol ? norm(symbol) : undefined, autopick });
      // Disarm the current turn's clock on success: it re-arms only when
      // currentPickIndex advances (the effect's dep). Without this, a snapshot
      // lag after an explicit pick would let the still-running interval fire an
      // autopick the server applies to the NEXT human turn (snake indices 7 and
      // 8 are both the lone human) — silently consuming the third pick.
      autopickFiredRef.current = true;
      return true;
    } catch (err) {
      // A lost race (CPU/sweep advanced, or an autopick already landed) is not a
      // user-facing failure — surface only genuine, current-turn errors.
      if (err?.code !== 'not_your_turn' && err?.code !== 'draft_not_active') {
        setError(mapTournamentActionError(err));
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [groupId, submitting, submitAction]);
  submitRef.current = submitPick;

  // ---- per-pick countdown: starts on my turn, autopicks on expiry. The client
  //      timer dies on tab close — the server idle-sweep is the backstop.
  //      `clockPaused` holds the clock while a host UI covers the turn (e.g. the
  //      redesigned board's forming intro on pick #1) so the intro can't silently
  //      autopick; the server idle-sweep remains the true-abandonment backstop. ----
  useEffect(() => {
    if (!isMyTurn || clockPaused) { setPickClock(null); autopickFiredRef.current = false; return undefined; }
    const total = clockTotalSec;
    setPickClock(total);
    autopickFiredRef.current = false;
    const startedAt = Date.now();
    const iv = setInterval(() => {
      const remaining = Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000));
      setPickClock(remaining);
      if (remaining <= 0 && !autopickFiredRef.current) {
        autopickFiredRef.current = true;
        clearInterval(iv);
        if (submitRef.current) submitRef.current(null, true);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [isMyTurn, currentPickIndex, clockPaused, clockTotalSec]);

  // ---- seats (snake HUD) ----
  const seats = useMemo(() => {
    return members.map((odUserId, idx) => {
      const player = (group?.players || []).find(p => p.odUserId === odUserId);
      return {
        odUserId,
        seatIndex: idx,
        isCpu: player?.isCpu === true,
        isYou: odUserId === currentUserId,
        onClock: idx === onClockSeatIdx,
        picks: (draft?.picksByUser?.[odUserId] || []),
      };
    });
  }, [members, group?.players, draft?.picksByUser, onClockSeatIdx, currentUserId]);

  const myPicks = draft?.picksByUser?.[currentUserId] || [];
  const round = Math.floor(currentPickIndex / Math.max(1, members.length)) + 1;

  return {
    group,
    draft,
    universe,
    boardBySector,
    highlightSet,
    // Training Board redesign (read-only widening) — the fit-ranked board inputs.
    poolRows,
    humanArchetype: draft?.humanArchetype || draft?.archetypeByUser?.[currentUserId] || 'analyst',
    events: draft?.events || [],
    snakeOrder: draft?.snakeOrder || [],
    picksByUser: draft?.picksByUser || {},
    members,
    currentUserId,
    seats,
    myPicks,
    isDrafting,
    isMyTurn,
    isComplete,
    finalStatus: group?.status ?? null,
    onClockId,
    onClockSeatIdx,
    currentPickIndex,
    totalPicks,
    round,
    pickClock,
    clockTotalSec,
    submitting,
    error,
    submitPick,
  };
}

export default useTrainingDraft;
