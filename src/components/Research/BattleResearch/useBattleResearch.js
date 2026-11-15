// src/components/Research/BattleResearch/useBattleResearch.js
//
// Battle Research Slice 1 — THE IN-MEMORY STORE (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-2, BRS-5, BRS-14, BRS-21).
// One hook at the battle screen: it survives the surface closing, the research
// modal, the cockpit, the chat and the phone sub-screens, and clears on a
// reload or a change of battle. It WRITES NOTHING — no Firestore, no
// localStorage. Every refinement is a pure reducer from investigation.js over
// the frozen result; only a question or a Refresh reads.
//
// THE READS (the cost line): the route GET /api/agent/battle-research-quotes
// (one Admin SDK read server side, cached 30 s there) and one read of the
// public rankings doc (the shared readRankings) — fetched together as ONE
// evidence bundle. The opening fetches a bundle for the "as they stand" list
// and the starters' availability; a question asked within a minute of a bundle
// reuses it (its takenAt is the bundle's), so opening and asking is one read of
// each, never two. Refresh always fetches, at most once a minute, one at a time.
//
// THE RANKINGS THE MODAL GETS (§6, Phase 0): the research sheet's packs read
// rows outside the battle's names (the bench alternative's "of N"), so the
// CURRENT result hands the modal the whole doc it was built from; an older
// result hands the subset it froze, rebuilt in the doc's own shape.

import { useCallback, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../../../utils/fetchWithAuth.js';
import { readRankings } from '../Sheet/rankingsRead.js';
import { buildResult, incumbentOf, noWeakestReason } from './result.js';
import {
  newInvestigation, currentStep, currentResult, addInvestigation, replaceInvestigation, setOrder as setOrderOf, addCondition as addConditionOf,
  removeCondition as removeConditionOf, switchGroup as switchGroupOf, acrossCondition, undo as undoOf, previous as previousOf,
  goTo as goToOf, refreshWith, refreshReport, refreshIncumbent, refreshGate,
} from './investigation.js';
import { BR_COPY } from './battleResearchCopy.js';
import { etClockAmPm } from '../BombMode/checkClock.js';

/** A bundle this young is reused by a question (never by Refresh). */
export const EVIDENCE_REUSE_MS = 60_000;

const INIT = (battleId) => ({
  battleId,
  session: { list: [], activeId: null, dropped: 0 },
  // 'opening' (the proposal and the starters) or 'board' (the active investigation).
  view: 'opening',
  opening: { status: 'idle', result: null, why: null },
  pending: null, // { questionId } while a question's evidence is read
  failure: null, // { questionId, why } — a failed first fetch (no result)
  // The last Refresh's report and error, each stamped with the investigation it was made for (review BL1-4).
  refresh: { inFlight: false, lastAttemptAt: null, error: null, errorFor: null, report: null },
  // *Show all* per step, like the scroll (review BL4-2 / BL1-6): a reopen or an undone step keeps the long list.
  showAll: {},
});

/** One evidence bundle: the route's quotes and the rankings doc, read together. Rejects with { why }. */
export async function fetchEvidence(battleId) {
  const [q, r] = await Promise.allSettled([
    fetchWithAuth(`/api/agent/battle-research-quotes?battleId=${encodeURIComponent(battleId)}`).then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || typeof body !== 'object') throw Object.assign(new Error('quotes'), { status: res.status, body });
      return body;
    }),
    readRankings(),
  ]);
  if (q.status === 'rejected') {
    const off = q.reason?.status === 404 && q.reason?.body?.error === 'battle_research_unavailable';
    throw { why: off ? BR_COPY.whyOff : BR_COPY.whyQuotes };
  }
  if (r.status === 'rejected') throw { why: BR_COPY.whyRankings };
  // takenAt is the SERVER's instant (the route's servedAt) — the clock the quotes, the sweep, the rankings and
  // the locks are stamped on (review BR1-3); receivedAt, the client's, drives only the refresh gate and reuse.
  const receivedAt = Date.now();
  const servedAt = typeof q.value.servedAt === 'number' && Number.isFinite(q.value.servedAt) ? q.value.servedAt : receivedAt;
  return { quotesBody: q.value, rankingsDoc: r.value, takenAt: servedAt, receivedAt };
}

/** The subset a result froze, in the rankings doc's own shape (what the sheet's packs read). */
export function subsetDoc(result) {
  const r = result.rankings;
  return {
    computedAt: r.computedAt,
    expiresAt: r.expiresAt,
    mode: r.mode,
    totalTechStocks: r.totalTechStocks,
    stocks: Object.entries(r.rows).map(([symbol, row]) => ({
      symbol,
      technicalRank: row.technicalRank,
      sectorTechnicalRank: row.sectorTechnicalRank,
      sectorTechnicalTotal: row.sectorTechnicalTotal,
      technicalScore: row.technicalScore,
      sectorName: row.sectorName,
      techRaw: { atrPercent: row.atrPercent },
      ...(row.archScores ? { arch_scores: { ...row.archScores } } : {}),
    })),
  };
}

/**
 * @param {object} p
 * @param {string|null} p.battleId
 * @param {object|null} p.battle    the screen's own subscribed document
 * @param {{ agentId, agentName, archetype }} p.agent
 * @param {(battleId: string) => Promise} [p.fetcher]  the evidence read (tests hand a fake)
 * @param {() => number} [p.clock]
 */
export default function useBattleResearch({ battleId, battle, agent, fetcher = fetchEvidence, clock = Date.now }) {
  const [s, setS] = useState(() => INIT(battleId));
  // BRS-21: a change of battle clears everything (a reload clears it by construction).
  if (s.battleId !== battleId) setS(INIT(battleId));
  const battleRef = useRef(battle);
  battleRef.current = battle;
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const evidenceRef = useRef(null); // the latest bundle { battleId, takenAt, quotesBody, rankingsDoc }
  const fullDocRef = useRef(new Map()); // `${invId}|${resultId}` → the whole rankings doc (current results only)
  // Synchronous, and per battle (review BL1-5): a second tap while one is in flight does nothing, but a read still in
  // flight for a battle the screen has left never swallows the new battle's first tap.
  const refreshing = useRef(null); // the battle id a Refresh is in flight for
  const asking = useRef(null); // the battle id a question is being read for
  const inFlightRef = useRef(null); // { battleId, promise } — the bundle being read, shared (review BL1-3)
  // The scroll per step lives in a ref: remembering it re-renders nothing (review BL4-3).
  const scrollMemRef = useRef(new Map());
  const lastCreatedRef = useRef(0);
  const idRef = useRef(battleId);
  idRef.current = battleId;
  const seenBattleRef = useRef(battleId);
  if (seenBattleRef.current !== battleId) {
    seenBattleRef.current = battleId;
    evidenceRef.current = null; fullDocRef.current = new Map(); scrollMemRef.current = new Map(); inFlightRef.current = null;
  }

  const active = s.session.list.find((x) => x.investigationId === s.session.activeId) ?? null;

  const getBundle = useCallback(async ({ fresh = false } = {}) => {
    const now = clock();
    const kept = evidenceRef.current;
    if (!fresh && kept && kept.battleId === idRef.current && now - kept.receivedAt < EVIDENCE_REUSE_MS) return kept;
    // A question tapped while the opening (or a Refresh) is reading shares that read: one of each per
    // open-and-ask, never two (review BL1-3).
    const flying = inFlightRef.current;
    if (!fresh && flying && flying.battleId === idRef.current) return flying.promise;
    const id = idRef.current;
    const promise = (async () => {
      const b = await fetcher(id);
      const bundle = { ...b, receivedAt: typeof b.receivedAt === 'number' ? b.receivedAt : now, battleId: id };
      if (idRef.current === id) evidenceRef.current = bundle;
      return bundle;
    })();
    inFlightRef.current = { battleId: id, promise };
    try {
      return await promise;
    } finally {
      if (inFlightRef.current?.promise === promise) inFlightRef.current = null;
    }
  }, [fetcher, clock]);

  /** The opening's evidence (BRS-5): the union as it stands, and the starters' availability. */
  const open = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    setS((x) => (x.opening.status === 'loading' ? x : { ...x, opening: { ...x.opening, status: 'loading', why: null } }));
    try {
      const b = await getBundle();
      if (idRef.current !== b.battleId) return;
      const result = buildResult({ battle: battleRef.current, incumbent: null, rankingsDoc: b.rankingsDoc, quotesBody: b.quotesBody, takenAt: b.takenAt, receivedAt: b.receivedAt, resultId: 'opening' });
      fullDocRef.current.set('opening', b.rankingsDoc);
      setS((x) => ({ ...x, opening: { status: 'ready', result, why: null } }));
    } catch (e) {
      if (idRef.current !== id) return; // a failure for a battle the screen has left shows nothing (review BL1-5)
      setS((x) => ({ ...x, opening: { status: 'failed', result: x.opening.result, why: e?.why ?? BR_COPY.whyQuotes } }));
    }
  }, [getBundle]);

  /** A starter tapped (BRS-5 – BRS-7): its evidence (or the minute-old bundle), one frozen result, a new investigation. */
  const ask = useCallback(async (questionId) => {
    const id = idRef.current;
    if (!id || asking.current === id) return;
    // BRS-6: the tap fixes the incumbent as weakestOf(bookOf(battle)) AT THAT MOMENT — the battle as tapped, not
    // as it stands when the read lands (review R1: a check landing mid-read never changes the question's weakest).
    const b0 = battleRef.current;
    if (questionId === 'weakest_alternatives' && noWeakestReason(b0) !== null) return;
    asking.current = id;
    setS((x) => ({ ...x, pending: { questionId }, failure: null }));
    try {
      const b = await getBundle();
      if (idRef.current !== b.battleId) return;
      const battleNow = b0;
      const incumbent = questionId === 'weakest_alternatives' ? incumbentOf(battleNow) : null;
      const result = buildResult({ battle: battleNow, incumbent, rankingsDoc: b.rankingsDoc, quotesBody: b.quotesBody, takenAt: b.takenAt, receivedAt: b.receivedAt, index: 1, resultId: 'r1' });
      const a = agentRef.current ?? {};
      // A strictly later creation instant than any before it, so two questions never share an id (review BR1-12).
      const at = Math.max(clock(), lastCreatedRef.current + 1);
      lastCreatedRef.current = at;
      const inv = newInvestigation({
        battleId: b.battleId,
        agent: { agentId: a.agentId ?? null, agentName: a.agentName ?? null, archetype: a.archetype ?? null, scoringModel: result.measured ? 'measured' : 'legacy' },
        questionId, result, at,
      });
      fullDocRef.current.set(`${inv.investigationId}|r1`, b.rankingsDoc);
      setS((x) => ({ ...x, session: addInvestigation(x.session, inv), view: 'board', pending: null, failure: null, refresh: { ...x.refresh, error: null, report: null } }));
    } catch (e) {
      if (idRef.current !== id) return; // the old battle's failure never shows in the new one (review BL1-5)
      setS((x) => ({ ...x, pending: null, failure: { questionId, why: e?.why ?? BR_COPY.whyQuotes } }));
    } finally {
      if (asking.current === id) asking.current = null;
    }
  }, [getBundle, clock]);

  /** Apply a pure reducer to the active investigation. */
  const apply = useCallback((fn) => {
    setS((x) => {
      const inv = x.session.list.find((y) => y.investigationId === x.session.activeId);
      if (!inv) return x;
      const next = fn(inv);
      if (next === inv) return x;
      return { ...x, session: replaceInvestigation(x.session, next), refresh: { ...x.refresh, report: null, error: null, errorFor: null } };
    });
  }, []);

  const setOrder = useCallback((order) => apply((inv) => setOrderOf(inv, order, clock())), [apply, clock]);
  const addCondition = useCallback((cond) => apply((inv) => addConditionOf(inv, cond, clock())), [apply, clock]);
  const removeCondition = useCallback((id) => apply((inv) => removeConditionOf(inv, id, clock())), [apply, clock]);
  const switchGroup = useCallback((group) => apply((inv) => switchGroupOf(inv, group, clock())), [apply, clock]);
  const applyAcross = useCallback((id) => apply((inv) => acrossCondition(inv, id, clock())), [apply, clock]);
  const undo = useCallback(() => apply(undoOf), [apply]);
  const previous = useCallback(() => apply(previousOf), [apply]);
  const goTo = useCallback((stepId) => apply((inv) => goToOf(inv, stepId)), [apply]);

  /** Start a different question: back to the proposal; the investigation stays in this session's history. */
  const startOver = useCallback(() => { setS((x) => ({ ...x, view: 'opening', failure: null })); }, []);
  /** An earlier question reopened from the history. */
  const reopen = useCallback((investigationId) => {
    setS((x) => (x.session.list.some((y) => y.investigationId === investigationId) ? { ...x, session: { ...x.session, activeId: investigationId }, view: 'board' } : x));
  }, []);

  /** BRS-14 — Refresh: a NEW result, at most once a minute, one at a time; a failure changes nothing. */
  const refresh = useCallback(async () => {
    const inv = active;
    const id = idRef.current;
    if (!inv || refreshing.current === id) return;
    const gate = refreshGate({ inFlight: false, since: currentResult(inv).receivedAt, lastAttemptAt: s.refresh.lastAttemptAt, nowMs: clock() });
    if (!gate.allowed) return;
    refreshing.current = id;
    const startedAt = clock();
    const battleAtTap = battleRef.current; // the battle as the player tapped Refresh (BRS-6's moment, review R1)
    setS((x) => ({ ...x, refresh: { ...x.refresh, inFlight: true, lastAttemptAt: startedAt, error: null, errorFor: null } }));
    try {
      const b = await getBundle({ fresh: true });
      if (idRef.current !== b.battleId) return;
      setS((x) => {
        const cur = x.session.list.find((y) => y.investigationId === inv.investigationId);
        if (!cur) return { ...x, refresh: { ...x.refresh, inFlight: false } };
        const battleNow = battleAtTap;
        const rid = `r${cur.nextResult}`;
        const prevResult = currentResult(cur);
        const prevOutcome = currentStep(cur).outcome;
        const result = buildResult({ battle: battleNow, incumbent: refreshIncumbent(cur, battleNow), rankingsDoc: b.rankingsDoc, quotesBody: b.quotesBody, takenAt: b.takenAt, receivedAt: b.receivedAt, index: cur.nextResult, resultId: rid });
        const next = refreshWith(cur, result, clock());
        // Only the current result keeps the whole doc (§6); the older ones hand the modal their subset.
        for (const k of [...fullDocRef.current.keys()]) if (k.startsWith(`${cur.investigationId}|`)) fullDocRef.current.delete(k);
        fullDocRef.current.set(`${cur.investigationId}|${rid}`, b.rankingsDoc);
        const report = { ...refreshReport(prevResult, prevOutcome, result, currentStep(next).outcome), label: result.label, stepId: currentStep(next).stepId, investigationId: cur.investigationId };
        return { ...x, session: replaceInvestigation(x.session, next), refresh: { inFlight: false, lastAttemptAt: startedAt, error: null, errorFor: null, report } };
      });
    } catch (e) {
      // A failed refresh changes nothing: the current result stays exactly as it was.
      if (idRef.current !== id) return; // review BL1-5
      const t = etClockAmPm(currentResult(inv).takenAt);
      setS((x) => ({ ...x, refresh: { ...x.refresh, inFlight: false, error: BR_COPY.refreshFailed(e?.why ?? BR_COPY.whyQuotes, t), errorFor: inv.investigationId } }));
    } finally {
      if (refreshing.current === id) refreshing.current = null;
    }
  }, [active, s.refresh.lastAttemptAt, getBundle, clock]);

  /** The rankings the modal gets for one result (§6). */
  const rankingsFor = useCallback((inv, resultId) => fullDocRef.current.get(`${inv.investigationId}|${resultId}`) ?? subsetDoc(inv.results[resultId]), []);
  /** The whole rankings doc the opening's list was built from (a row opened from that list — review BL2-10). */
  const openingRankings = useCallback(() => fullDocRef.current.get('opening') ?? null, []);

  // The scroll per step: a ref, never state — a scroll frame re-renders nothing (review BL4-3).
  const rememberScroll = useCallback((key, top) => { scrollMemRef.current.set(key, top); }, []);
  const scrollOf = useCallback((key) => scrollMemRef.current.get(key) ?? 0, []);
  // *Show all* per step (review BL4-2): a tap, so state.
  const setShowAll = useCallback((key, on) => { setS((x) => (!!x.showAll[key] === !!on ? x : { ...x, showAll: { ...x.showAll, [key]: !!on } })); }, []);

  return useMemo(() => ({
    state: s,
    active,
    open, ask, setOrder, addCondition, removeCondition, switchGroup, applyAcross, undo, previous, goTo, startOver, reopen, refresh,
    rankingsFor, openingRankings, rememberScroll, scrollOf, setShowAll,
    // The weakest question's own availability (BRS-6): null when there is a weakest.
    noWeakest: battle ? noWeakestReason(battle) : 'no_ladder',
  }), [s, active, open, ask, setOrder, addCondition, removeCondition, switchGroup, applyAcross, undo, previous, goTo, startOver, reopen, refresh, rankingsFor, openingRankings, rememberScroll, scrollOf, setShowAll, battle]);
}
