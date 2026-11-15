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
  refresh: { inFlight: false, lastAttemptAt: null, error: null, report: null },
  scroll: {},
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
  const refreshing = useRef(false); // synchronous: a second tap while one is in flight does nothing
  const asking = useRef(false);
  const lastCreatedRef = useRef(0);
  const idRef = useRef(battleId);
  idRef.current = battleId;
  if (evidenceRef.current && evidenceRef.current.battleId !== battleId) { evidenceRef.current = null; fullDocRef.current = new Map(); }

  const active = s.session.list.find((x) => x.investigationId === s.session.activeId) ?? null;

  const getBundle = useCallback(async ({ fresh = false } = {}) => {
    const now = clock();
    const kept = evidenceRef.current;
    if (!fresh && kept && kept.battleId === idRef.current && now - kept.receivedAt < EVIDENCE_REUSE_MS) return kept;
    const id = idRef.current;
    const b = await fetcher(id);
    const bundle = { ...b, receivedAt: typeof b.receivedAt === 'number' ? b.receivedAt : now, battleId: id };
    if (idRef.current === id) evidenceRef.current = bundle;
    return bundle;
  }, [fetcher, clock]);

  /** The opening's evidence (BRS-5): the union as it stands, and the starters' availability. */
  const open = useCallback(async () => {
    if (!idRef.current) return;
    setS((x) => (x.opening.status === 'loading' ? x : { ...x, opening: { ...x.opening, status: 'loading', why: null } }));
    try {
      const b = await getBundle();
      if (idRef.current !== b.battleId) return;
      const result = buildResult({ battle: battleRef.current, incumbent: null, rankingsDoc: b.rankingsDoc, quotesBody: b.quotesBody, takenAt: b.takenAt, receivedAt: b.receivedAt, resultId: 'opening' });
      setS((x) => ({ ...x, opening: { status: 'ready', result, why: null } }));
    } catch (e) {
      setS((x) => ({ ...x, opening: { status: 'failed', result: x.opening.result, why: e?.why ?? BR_COPY.whyQuotes } }));
    }
  }, [getBundle]);

  /** A starter tapped (BRS-5 – BRS-7): its evidence (or the minute-old bundle), one frozen result, a new investigation. */
  const ask = useCallback(async (questionId) => {
    if (asking.current || !idRef.current) return;
    const b0 = battleRef.current;
    if (questionId === 'weakest_alternatives' && noWeakestReason(b0) !== null) return;
    asking.current = true;
    setS((x) => ({ ...x, pending: { questionId }, failure: null }));
    try {
      const b = await getBundle();
      if (idRef.current !== b.battleId) return;
      const battleNow = battleRef.current;
      // BRS-6: the tap fixes the incumbent as weakestOf(bookOf(battle)) at that moment.
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
      setS((x) => ({ ...x, pending: null, failure: { questionId, why: e?.why ?? BR_COPY.whyQuotes } }));
    } finally {
      asking.current = false;
    }
  }, [getBundle, clock]);

  /** Apply a pure reducer to the active investigation. */
  const apply = useCallback((fn) => {
    setS((x) => {
      const inv = x.session.list.find((y) => y.investigationId === x.session.activeId);
      if (!inv) return x;
      const next = fn(inv);
      if (next === inv) return x;
      return { ...x, session: replaceInvestigation(x.session, next), refresh: { ...x.refresh, report: null, error: null } };
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
    if (!inv || refreshing.current) return;
    const gate = refreshGate({ inFlight: false, takenAt: currentResult(inv).receivedAt, lastAttemptAt: s.refresh.lastAttemptAt, nowMs: clock() });
    if (!gate.allowed) return;
    refreshing.current = true;
    const startedAt = clock();
    setS((x) => ({ ...x, refresh: { ...x.refresh, inFlight: true, lastAttemptAt: startedAt, error: null } }));
    try {
      const b = await getBundle({ fresh: true });
      if (idRef.current !== b.battleId) return;
      setS((x) => {
        const cur = x.session.list.find((y) => y.investigationId === inv.investigationId);
        if (!cur) return { ...x, refresh: { ...x.refresh, inFlight: false } };
        const battleNow = battleRef.current;
        const rid = `r${cur.nextResult}`;
        const prevResult = currentResult(cur);
        const prevOutcome = currentStep(cur).outcome;
        const result = buildResult({ battle: battleNow, incumbent: refreshIncumbent(cur, battleNow), rankingsDoc: b.rankingsDoc, quotesBody: b.quotesBody, takenAt: b.takenAt, receivedAt: b.receivedAt, index: cur.nextResult, resultId: rid });
        const next = refreshWith(cur, result, clock());
        // Only the current result keeps the whole doc (§6); the older ones hand the modal their subset.
        for (const k of [...fullDocRef.current.keys()]) if (k.startsWith(`${cur.investigationId}|`)) fullDocRef.current.delete(k);
        fullDocRef.current.set(`${cur.investigationId}|${rid}`, b.rankingsDoc);
        const report = { ...refreshReport(prevResult, prevOutcome, result, currentStep(next).outcome), label: result.label, stepId: currentStep(next).stepId };
        return { ...x, session: replaceInvestigation(x.session, next), refresh: { inFlight: false, lastAttemptAt: startedAt, error: null, report } };
      });
    } catch (e) {
      // A failed refresh changes nothing: the current result stays exactly as it was.
      const t = etClockAmPm(currentResult(inv).takenAt);
      setS((x) => ({ ...x, refresh: { ...x.refresh, inFlight: false, error: BR_COPY.refreshFailed(e?.why ?? BR_COPY.whyQuotes, t) } }));
    } finally {
      refreshing.current = false;
    }
  }, [active, s.refresh.lastAttemptAt, getBundle, clock]);

  /** The rankings the modal gets for one result (§6). */
  const rankingsFor = useCallback((inv, resultId) => fullDocRef.current.get(`${inv.investigationId}|${resultId}`) ?? subsetDoc(inv.results[resultId]), []);

  const rememberScroll = useCallback((key, top) => { setS((x) => (x.scroll[key] === top ? x : { ...x, scroll: { ...x.scroll, [key]: top } })); }, []);

  return useMemo(() => ({
    state: s,
    active,
    open, ask, setOrder, addCondition, removeCondition, switchGroup, applyAcross, undo, previous, goTo, startOver, reopen, refresh,
    rankingsFor, rememberScroll,
    // The weakest question's own availability (BRS-6): null when there is a weakest.
    noWeakest: battle ? noWeakestReason(battle) : 'no_ladder',
  }), [s, active, open, ask, setOrder, addCondition, removeCondition, switchGroup, applyAcross, undo, previous, goTo, startOver, reopen, refresh, rankingsFor, rememberScroll, battle]);
}
