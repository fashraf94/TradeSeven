// src/components/Research/BattleResearch/investigation.js
//
// Battle Research Slice 1 — THE INVESTIGATION: steps, undo, refresh, caps and
// notices, as PURE REDUCERS (spec docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md
// BRS-13, BRS-14, BRS-21, §6). NODE-CLEAN; every instant is an argument. The
// shape is §6's (Appendix A's), so Slice 2 can store it unchanged.
//
// A STEP is a question, an ordering change, a condition added or removed, a
// group switch, a refresh or a "use across this result". Each records its
// wording, its view and its outcome over ITS result — refinements re-run the
// order over the same frozen evidence and read nothing (BRS-14). Steps form a
// tree (parentStepId); the trail is the path from the question to the cursor.
// Previous step moves the cursor up; Undo also drops the step it leaves when it
// is a leaf; a step tapped in the history becomes the cursor.
//
// UP AND DOWN ARE EXCLUSIVE (BRS-12): adding one replaces the other, as ONE
// step of its own wording (*then: down today, in place of up today*); the
// sector condition is one at a time the same way. Every condition applies to
// the whole frozen group, so a replacement brings back the names the first had
// removed.
//
// CAPS (BRS-21): 40 steps an investigation (the oldest step off the current
// trail goes first; its children re-parent), 10 investigations a battle
// session (the oldest goes) — each with a line in the history.

import { selectBookSymbols, researchGroupsOf } from '../../../data/battleUniverse.js';
import { etClockAmPm } from '../BombMode/checkClock.js';
import { outcomeOf, incumbentOf, bookCheckOf, msOf } from './result.js';
import { BR_COPY, STARTER_TEXT, conditionWords } from './battleResearchCopy.js';

export const CAPS = Object.freeze({ investigations: 10, steps: 40 });
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

const RANK_ORDER = Object.freeze({ measure: 'technical_rank', direction: 'best_first' });
const MOVE_ORDER = Object.freeze({ measure: 'today_move', direction: 'best_first' });

/** The question's opening view (BRS-6, BRS-7). */
export function questionView(questionId) {
  if (questionId === 'rank_bench') return { group: 'bench', order: RANK_ORDER, conditions: [] };
  if (questionId === 'rank_agent_watchlist') return { group: 'agent_watchlist', order: RANK_ORDER, conditions: [] };
  if (questionId === 'moving_today') return { group: 'union', order: MOVE_ORDER, conditions: [] };
  return { group: 'union', order: RANK_ORDER, conditions: [] };
}

/** The question's title: the weakest names its holding (BRS-6); the others are asked as written. */
export function titleOf(inv, result = currentResult(inv)) {
  if (inv.question.id === 'weakest_alternatives' && result?.incumbent) return BR_COPY.titleWeakest(result.incumbent.symbol);
  return inv.question.text;
}

/**
 * A new investigation, its first step the question (§6).
 * @param {object} p
 * @param {string} p.battleId
 * @param {{ agentId, agentName, archetype, scoringModel }} p.agent
 * @param {string} p.questionId
 * @param {object} p.result     buildResult's frozen result (its incumbent is the question's)
 * @param {number} p.at
 */
export function newInvestigation({ battleId, agent = {}, questionId, result, at }) {
  const view = questionView(questionId);
  const text = STARTER_TEXT[questionId];
  const step = { stepId: 's1', parentStepId: null, kind: 'question', wording: text, at, resultId: result.resultId, view, outcome: outcomeOf(result, view) };
  return {
    investigationId: `inv-${battleId}-${at}`,
    battleId,
    agentId: agent.agentId ?? null,
    agentName: agent.agentName ?? null,
    archetype: agent.archetype ?? null,
    scoringModel: agent.scoringModel === 'legacy' ? 'legacy' : 'measured',
    createdAt: at,
    question: { id: questionId, text, incumbent: result.incumbent ? { ...result.incumbent } : null },
    steps: [step],
    cursor: 0,
    results: { [result.resultId]: result },
    nextStep: 2,
    nextResult: 2,
    droppedSteps: 0,
    compare: null,
  };
}

export const currentStep = (inv) => inv.steps[inv.cursor];
export const currentResult = (inv) => inv.results[currentStep(inv).resultId];
export const stepById = (inv, id) => inv.steps.find((s) => s.stepId === id) ?? null;

/** The trail: the question first, then each step to the cursor (parentStepId links). */
export function trailOf(inv) {
  const out = [];
  let s = currentStep(inv);
  while (s) { out.unshift(s); s = s.parentStepId ? stepById(inv, s.parentStepId) : null; }
  return out;
}

/** The refinement wordings on the trail (the *then: …* chain under the title). */
export const refinementsOf = (inv) => trailOf(inv).slice(1).map((s) => s.wording);

/** Drop the oldest step that is off the current trail (else the oldest after the question); its children re-parent. */
function capSteps(inv) {
  if (inv.steps.length <= CAPS.steps) return inv;
  const onTrail = new Set(trailOf(inv).map((s) => s.stepId));
  let idx = inv.steps.findIndex((s, i) => i > 0 && !onTrail.has(s.stepId));
  if (idx < 0) idx = 1;
  const gone = inv.steps[idx];
  const cur = currentStep(inv);
  const steps = inv.steps.filter((_, i) => i !== idx).map((s) => (s.parentStepId === gone.stepId ? { ...s, parentStepId: gone.parentStepId } : s));
  // A result no step names any more stays in `results`: the history line and Slice 2's record keep it.
  return capSteps({ ...inv, steps, cursor: steps.findIndex((s) => s.stepId === cur.stepId), droppedSteps: inv.droppedSteps + 1 });
}

/** Append a step under the cursor and move to it (its outcome over its result; "was #n" against the parent on the same result). */
export function addStep(inv, { kind, wording, view, at, resultId = null }) {
  const parent = currentStep(inv);
  const rid = resultId ?? parent.resultId;
  const result = inv.results[rid];
  const prev = rid === parent.resultId ? parent.outcome : null;
  const step = { stepId: `s${inv.nextStep}`, parentStepId: parent.stepId, kind, wording, at, resultId: rid, view, outcome: outcomeOf(result, view, { prev }) };
  return capSteps({ ...inv, steps: [...inv.steps, step], cursor: inv.steps.length, nextStep: inv.nextStep + 1 });
}

const viewOf = (inv) => currentStep(inv).view;
const sameOrder = (a, b) => a.measure === b.measure && a.direction === b.direction;

/** BRS-11 — the ordering switch (and Biggest drop first). No step when nothing changes. */
export function setOrder(inv, order, at) {
  const v = viewOf(inv);
  if (sameOrder(v.order, order)) return inv;
  return addStep(inv, { kind: 'order', wording: BR_COPY.thenOrder(order), view: { ...v, order: { ...order } }, at });
}

const EXCLUSIVE = Object.freeze({ up_today: 'down_today', down_today: 'up_today' });

/**
 * BRS-12 — add a condition. Up and down are exclusive and the sector is one at a time: the
 * replacement is ONE step with its own wording. Adding one already active is no step.
 */
export function addCondition(inv, cond, at, { kind = 'condition_add' } = {}) {
  const v = viewOf(inv);
  if (v.conditions.some((c) => c.id === cond.id && (c.id !== 'sector' || c.value === cond.value))) return inv;
  const replaced = v.conditions.find((c) => c.id === EXCLUSIVE[cond.id] || (cond.id === 'sector' && c.id === 'sector')) ?? null;
  const conditions = [...v.conditions.filter((c) => c !== replaced), { ...cond }];
  const words = conditionWords(cond);
  const wording = kind === 'use_across'
    ? BR_COPY.thenUseAcross(replaced ? `${words}, in place of ${conditionWords(replaced)}` : words)
    : replaced ? BR_COPY.thenReplacing(words, conditionWords(replaced)) : BR_COPY.then(words);
  return addStep(inv, { kind, wording, view: { ...v, conditions }, at });
}

/** BRS-12 — remove a condition (a removable chip). */
export function removeCondition(inv, condId, at) {
  const v = viewOf(inv);
  const gone = v.conditions.find((c) => c.id === condId);
  if (!gone) return inv;
  return addStep(inv, { kind: 'condition_remove', wording: BR_COPY.thenRemoved(conditionWords(gone)), view: { ...v, conditions: v.conditions.filter((c) => c !== gone) }, at });
}

/** BRS-7 — the same question on the other group (group questions only). */
export function switchGroup(inv, group, at) {
  const v = viewOf(inv);
  if (v.group === group || v.group === 'union') return inv;
  return addStep(inv, { kind: 'group', wording: BR_COPY.thenGroup(group), view: { ...v, group }, at });
}

/** BRS-18a — Use across this result: up or down today, from a stock's finding (the replacement is said). */
export function acrossCondition(inv, condId, at) {
  return addCondition(inv, { id: condId }, at, { kind: 'use_across' });
}

/** Previous step: the cursor moves up the trail; nothing is dropped. */
export function previous(inv) {
  const parent = currentStep(inv).parentStepId;
  if (!parent) return inv;
  return { ...inv, cursor: inv.steps.findIndex((s) => s.stepId === parent) };
}

/** Undo (the last step): back to its parent, and the step goes when nothing hangs from it. */
export function undo(inv) {
  const cur = currentStep(inv);
  if (!cur.parentStepId) return inv;
  const leaf = !inv.steps.some((s) => s.parentStepId === cur.stepId);
  const steps = leaf ? inv.steps.filter((s) => s.stepId !== cur.stepId) : inv.steps;
  return { ...inv, steps, cursor: steps.findIndex((s) => s.stepId === cur.parentStepId) };
}

/** A step tapped in the history becomes the cursor. */
export function goTo(inv, stepId) {
  const i = inv.steps.findIndex((s) => s.stepId === stepId);
  return i < 0 ? inv : { ...inv, cursor: i };
}

/**
 * BRS-14 — Refresh: a NEW result (its own id and label) under the same question and the current
 * view; the old result stays in the trail. The step's wording names the new result.
 * @param {object} inv
 * @param {object} result  buildResult's new frozen result
 * @param {number} at
 */
export function refreshWith(inv, result, at) {
  const v = viewOf(inv);
  const withResult = { ...inv, results: { ...inv.results, [result.resultId]: result }, nextResult: inv.nextResult + 1 };
  return addStep(withResult, { kind: 'refresh', wording: BR_COPY.thenRefresh(result.label), view: v, at, resultId: result.resultId });
}

/**
 * What a refresh changed (BRS-14): positions moved, names in, names out — the previous step's
 * outcome and result against the new ones.
 */
export function refreshReport(prevResult, prevOutcome, nextResult, nextOutcome) {
  const before = new Map(prevOutcome.placed.map((p) => [p.symbol, p.position]));
  const moved = nextOutcome.placed.filter((p) => before.has(p.symbol) && before.get(p.symbol) !== p.position).length;
  const was = new Set(prevResult.membership.map((m) => m.symbol));
  const now = new Set(nextResult.membership.map((m) => m.symbol));
  return {
    moved,
    in: [...now].filter((s) => !was.has(s)),
    out: [...was].filter((s) => !now.has(s)),
    incumbentChanged: prevResult.incumbent?.symbol && nextResult.incumbent?.symbol && prevResult.incumbent.symbol !== nextResult.incumbent.symbol
      ? { from: prevResult.incumbent.symbol, to: nextResult.incumbent.symbol } : null,
  };
}

/**
 * The incumbent a refresh uses (BRS-14): re-selected ONLY on the weakest-holding question (a new
 * one renames the title; none now keeps the frozen one); every other question keeps its own.
 */
export function refreshIncumbent(inv, battle) {
  const prev = currentResult(inv).incumbent;
  if (inv.question.id !== 'weakest_alternatives') return prev ? { ...prev } : null;
  return incumbentOf(battle) ?? (prev ? { ...prev } : null);
}

/**
 * BRS-14 — ONE quiet notice for a change the screen can see, never a reorder: the incumbent left
 * the book, a newer check (naming a new weakest on the weakest question), or the lists changed.
 * Null when nothing the screen can see has moved since the result.
 */
export function noticeOf(inv, battle) {
  if (!inv || !battle) return null;
  const result = currentResult(inv);
  const inc = result.incumbent;
  if (inc && !selectBookSymbols(battle).has(inc.symbol)) {
    const trade = (Array.isArray(battle.trades) ? battle.trades : []).filter((t) => t?.symbolOut === inc.symbol).map((t) => msOf(t.swappedOutAt)).filter((ms) => finite(ms) && ms > result.takenAt);
    return { kind: 'left_book', text: BR_COPY.noticeLeftBook(inc.symbol, trade.length ? etClockAmPm(Math.min(...trade)) : null) };
  }
  const check = bookCheckOf(battle);
  if (finite(check) && (!finite(result.bookCheckMs) || check > result.bookCheckMs)) {
    const t = etClockAmPm(check);
    if (inv.question.id === 'weakest_alternatives' && inc) {
      const now = incumbentOf(battle)?.symbol ?? null;
      if (now && now !== inc.symbol) return { kind: 'new_check', text: BR_COPY.noticeNewCheckWeakest(t, now, inc.symbol) };
    }
    return { kind: 'new_check', text: BR_COPY.noticeNewCheck(t, result.label) };
  }
  const g = researchGroupsOf(battle);
  const now = new Set([...g.bench, ...g.agentWatchlist]);
  const was = new Set(result.membership.map((m) => m.symbol));
  const inn = [...now].filter((s) => !was.has(s)).length;
  const out = [...was].filter((s) => !now.has(s)).length;
  if (inn || out) {
    const at = msOf(battle.watchlist?.lastRefreshed);
    return { kind: 'lists', text: BR_COPY.noticeLists(inn, out, finite(at) && at > result.takenAt ? etClockAmPm(at) : null) };
  }
  return null;
}

/** BRS-14: at most one refresh a minute. */
export const REFRESH_COOLDOWN_MS = 60_000;

/**
 * BRS-14 — may Refresh run now? One request in flight (a second tap does nothing), and at most one a
 * minute, counted from the later of the current result's evidence and the last attempt (a failed
 * attempt counts too). The button names the time left (*Refresh in 0:42*).
 * @param {{ inFlight: boolean, takenAt: number|null, lastAttemptAt: number|null, nowMs: number }} p
 * @returns {{ allowed: boolean, reason: 'in_flight'|'cooldown'|null, remainingMs: number, text: string|null }}
 */
export function refreshGate({ inFlight = false, takenAt = null, lastAttemptAt = null, nowMs }) {
  if (inFlight) return { allowed: false, reason: 'in_flight', remainingMs: 0, text: null };
  const since = Math.max(finite(takenAt) ? takenAt : -Infinity, finite(lastAttemptAt) ? lastAttemptAt : -Infinity);
  const left = finite(since) && finite(nowMs) ? Math.max(0, since + REFRESH_COOLDOWN_MS - nowMs) : 0;
  if (left <= 0) return { allowed: true, reason: null, remainingMs: 0, text: null };
  const s = Math.ceil(left / 1000);
  return { allowed: false, reason: 'cooldown', remainingMs: left, text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` };
}

/**
 * A battle session's investigations (BRS-21): the newest last, at most 10 — past the cap the
 * oldest goes, and the session remembers that one did.
 */
export function addInvestigation(session, inv) {
  const list = [...(session?.list ?? []), inv];
  const over = Math.max(0, list.length - CAPS.investigations);
  return { list: list.slice(over), activeId: inv.investigationId, dropped: (session?.dropped ?? 0) + over };
}

/** Replace one investigation in the session (by id). */
export function replaceInvestigation(session, inv) {
  return { ...session, list: session.list.map((x) => (x.investigationId === inv.investigationId ? inv : x)) };
}
