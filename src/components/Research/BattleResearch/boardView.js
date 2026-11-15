// src/components/Research/BattleResearch/boardView.js
//
// Battle Research Slice 1 — THE BOARD'S VIEW MODEL (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §7, BRS-11 – BRS-16, BRS-20).
// PURE: the active investigation's current step, its frozen result and the
// battle document in; everything the board and the agent column print out —
// the title and its *then: …* chain, the note line, the explanation, the
// banner, the toolbar's states, the conditions, the list (placed rows, the
// reference line where its value falls, Left out, Not ranked), the history.
// The surface renders this and formats nothing. Node-clean (no React).

import { outcomeOf, sectorsPresent } from './result.js';
import { currentStep, currentResult, trailOf, titleOf, refreshGate, noticeOf } from './investigation.js';
import { explainOf, bannerOf, rowFactsOf, referenceOf, noteLineOf, availabilityOf, moveLineOf, proposalOf, askDraftOf, groupLabelOf, notAssessedWords } from './explain.js';
import { BR_COPY, CONDITION_LABEL, STARTER_TEXT, conditionLabel, conditionWords } from './battleResearchCopy.js';
import { etClockAmPm } from '../BombMode/checkClock.js';

/** Placed rows shown before *Show all {n}* (§7). */
export const SHOWN = Object.freeze({ phone: 5, desktop: 6 });
const RANK = Object.freeze({ measure: 'technical_rank', direction: 'best_first' });

/** The "as they stand" list of the opening (BRS-5): the union by technical rank. */
export function asTheyStandOf(battle, opening) {
  if (opening.status !== 'ready' || !opening.result) return { status: opening.status === 'failed' ? 'failed' : 'loading', rows: [], unranked: [] };
  const r = opening.result;
  const o = outcomeOf(r, { group: 'union', order: RANK, conditions: [] });
  return {
    status: 'ready',
    rows: o.placed.map((p) => ({ position: p.position, facts: rowFactsOf(battle, r, p.symbol) })),
    unranked: o.unranked.map((u) => ({ facts: rowFactsOf(battle, r, u.symbol), note: u.reason === 'crypto' ? BR_COPY.notRankedCrypto : BR_COPY.notRankedMissing })),
  };
}

/** The four starters' states (BRS-5): the weakest's own line; What's moving off until one usable quote. */
export function startersOf(battle, opening, noWeakest, nowMs) {
  const proposal = proposalOf(battle, nowMs);
  const avail = opening.status === 'ready' && opening.result ? availabilityOf(opening.result) : null;
  return {
    proposal,
    starters: {
      weakest_alternatives: { disabled: noWeakest !== null, line: noWeakest !== null ? proposal.weakestLine : null },
      rank_bench: { disabled: false, line: null },
      rank_agent_watchlist: { disabled: false, line: null },
      moving_today: { disabled: !avail?.on, line: avail ? moveLineOf(avail) : null },
    },
  };
}

/** One left-out row's own words: the condition's reading, or the state's words (§7). */
function leftOutNote(result, view, item, kind) {
  if (kind === 'removed') {
    const words = item.by.map((id) => conditionWords(id === 'sector' ? view.conditions.find((c) => c.id === 'sector') : { id }));
    return `${BR_COPY.removedBy} · ${words.join(', ')}`;
  }
  return `${BR_COPY.notAssessed} · ${notAssessedWords(result, item)}`;
}

/**
 * The board (§7) for the active investigation.
 * @param {object} p
 * @param {object} p.inv
 * @param {object} p.battle
 * @param {number} p.nowMs
 * @param {boolean} p.desktop
 * @param {boolean} p.showAll
 * @param {{ inFlight, lastAttemptAt, error, report }} p.refresh
 * @param {string} p.agentName
 */
export function boardOf({ inv, battle, nowMs, desktop = false, showAll = false, refresh = {}, agentName = '' }) {
  const step = currentStep(inv);
  const result = currentResult(inv);
  const { view, outcome } = step;
  const sectorActive = view.conditions.some((c) => c.id === 'sector');
  const facts = (s) => rowFactsOf(battle, result, s, { sectorActive, nowMs });
  const ref = referenceOf(result, view, outcome);
  const limit = desktop ? SHOWN.desktop : SHOWN.phone;
  // The placed rows, with the reference line where its value falls (before `ref.before`, else after the last).
  const placed = outcome.placed.map((p) => ({ kind: 'row', symbol: p.symbol, position: p.position, was: p.wasPosition ?? null, facts: facts(p.symbol) }));
  const visible = showAll ? placed : placed.slice(0, limit);
  const list = [];
  for (const row of visible) {
    if (ref && !ref.noReading && ref.before === row.symbol) list.push({ kind: 'reference', reference: ref });
    list.push(row);
  }
  // The line after every shown name: it trails them all (before: null), it falls among the names
  // *Show all* hides (every shown name is above it), or it has no reading for this order (not placed).
  if (ref && !list.some((x) => x.kind === 'reference')) list.push({ kind: 'reference', reference: ref.noReading ? { ...ref, above: null } : ref });
  const avail = availabilityOf(result);
  const moveLine = moveLineOf(avail);
  const moveOrder = view.order.measure === 'today_move';
  const prepared = [
    { id: 'eligible_now', label: CONDITION_LABEL.eligible_now, disabled: false, line: null },
    { id: 'up_today', label: CONDITION_LABEL.up_today, disabled: !avail.on, line: avail.on ? null : moveLine },
    { id: 'down_today', label: CONDITION_LABEL.down_today, disabled: !avail.on, line: avail.on ? null : moveLine },
    ...sectorsPresent(result, view.group).map((sector) => ({ id: 'sector', value: sector, label: conditionLabel({ id: 'sector', value: sector }), disabled: false, line: null })),
  ].filter((c) => !view.conditions.some((a) => a.id === c.id && (c.id !== 'sector' || a.value === c.value)));
  const gate = refreshGate({ inFlight: !!refresh.inFlight, since: result.receivedAt ?? result.takenAt, lastAttemptAt: refresh.lastAttemptAt ?? null, nowMs });
  const question = inv.question.id;
  const groupQuestion = question === 'rank_bench' || question === 'rank_agent_watchlist';
  const other = view.group === 'bench' ? 'agent_watchlist' : 'bench';
  const banner = refresh.report && refresh.report.stepId === step.stepId
    ? { kind: 'refresh', title: refresh.report.label, body: [BR_COPY.refreshedBody(refresh.report.moved, refresh.report.in.length, refresh.report.out.length), (refresh.report.placedIn?.length || refresh.report.placedOut?.length) ? BR_COPY.refreshedPlaced(refresh.report.placedIn?.length ?? 0, refresh.report.placedOut?.length ?? 0) : null, refresh.report.incumbentChanged ? BR_COPY.refreshedWeakest(refresh.report.incumbentChanged.to, refresh.report.incumbentChanged.from) : null].filter(Boolean).join(' ') }
    : (() => { const b = bannerOf(inv, step); return b ? { kind: 'refinement', ...b } : null; })();
  const paragraphs = explainOf(inv, result, step);
  return {
    stepId: step.stepId,
    resultId: result.resultId,
    resultLabel: result.label,
    title: titleOf(inv, result),
    refinements: trailOf(inv).slice(1).map((s) => s.wording),
    note: noteLineOf(result, view, outcome),
    paragraphs,
    lead: paragraphs[0] ?? null,
    banner,
    notice: noticeOf(inv, battle),
    toolbar: {
      order: view.order,
      moveOrderDisabled: !avail.on && !moveOrder,
      moveLine: avail.on ? null : moveLine,
      groupSwitch: groupQuestion ? { to: other, label: BR_COPY.sameOnOther(other) } : null,
      canUndo: !!step.parentStepId,
      canPrevious: !!step.parentStepId,
      refresh: { allowed: gate.allowed, inFlight: !!refresh.inFlight, text: refresh.inFlight ? BR_COPY.refreshing : gate.allowed ? BR_COPY.refresh : BR_COPY.refreshIn(gate.text) },
      refreshError: refresh.error ?? null,
    },
    conditions: {
      active: view.conditions.map((c) => ({ id: c.id, value: c.value ?? null, label: conditionLabel(c) })),
      prepared,
    },
    list,
    total: placed.length,
    hiddenCount: Math.max(0, placed.length - visible.length),
    removed: outcome.removed.map((r) => ({ facts: facts(r.symbol), note: leftOutNote(result, view, r, 'removed') })),
    notAssessed: outcome.notAssessed.map((r) => ({ facts: facts(r.symbol), note: leftOutNote(result, view, r, 'notAssessed') })),
    unranked: outcome.unranked.map((u) => ({ facts: facts(u.symbol), note: u.reason === 'crypto' ? BR_COPY.notRankedCrypto : BR_COPY.notRankedMissing })),
    excluded: result.excluded.map((e) => e.symbol),
    empty: placed.length === 0 ? (outcome.removed.length || outcome.notAssessed.length ? BR_COPY.emptyPlaced : BR_COPY.emptyGroup(groupLabelOf(view))) : null,
    askAbout: { label: BR_COPY.askAbout(agentName), cost: BR_COPY.askCost, disabled: outcome.placed.length === 0 },
    history: inv.steps.map((s) => ({ stepId: s.stepId, wording: s.wording, time: etClockAmPm(s.at), current: s.stepId === step.stepId, onTrail: trailOf(inv).some((t) => t.stepId === s.stepId) })),
    droppedSteps: inv.droppedSteps,
    groupLabel: groupLabelOf(view),
  };
}

/** The Ask about this result's draft (BRS-20) for the active step. */
export function askAboutDraft(inv, nowMs = null) {
  return askDraftOf(inv, currentResult(inv), currentStep(inv), { nowMs });
}

/** An earlier question's line in this session's history. */
export function investigationLine(inv) {
  return `${titleOf(inv, currentResult(inv))} · ${etClockAmPm(inv.createdAt)}`;
}

export { STARTER_TEXT };
