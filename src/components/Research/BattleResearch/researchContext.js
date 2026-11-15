// src/components/Research/BattleResearch/researchContext.js
//
// Battle Research Slice 1 — sheetContext.research, BUILT (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-10, BRS-17 – BRS-19, §8).
// PURE: the active investigation, the step the row was opened from, the
// battle, and the screen's callbacks in; the plain object the research modal's
// state 2 reads out. Every reading is the FROZEN result's — the strip, For this
// question, the finding, the comparison, the ATR seed (BRS-10: 💣 prints the
// row's number and time, and the modal makes no second read for it).

import { outcomeOf, rungEstimateOf, timesOf, conditionCounts, holdingEntryOfResult, moveOf } from './result.js';
import { moveText } from './readings.js';
import { etClockAmPm } from '../BombMode/checkClock.js';
import { currentStep, currentResult, refinementsOf, titleOf } from './investigation.js';
import { researchRowOf, compareOf, draftOf, groupLabelOf } from './explain.js';
import { BR_COPY, conditionLabel, conditionWords, orderLabel } from './battleResearchCopy.js';

/**
 * @param {object} p
 * @param {object} p.inv          the active investigation
 * @param {string} p.symbol       the row opened
 * @param {string} p.openedStepId the step the row was opened from (the modal's opening key)
 * @param {object} p.battle
 * @param {string} p.voice        *{Agent} · {Archetype}*
 * @param {string} p.agentName
 * @param {object} p.cb           { onBack, onApplyUseAcross, onUndo, onDraft }
 */
export function researchContextOf({ inv, symbol, openedStepId, battle, voice, agentName, cb = {}, nowMs = null }) {
  const step = currentStep(inv);
  const result = currentResult(inv);
  const { view, outcome } = step;
  const t = timesOf(result);
  const n = outcome.placed.length + outcome.removed.length + outcome.notAssessed.length + outcome.unranked.length;
  const row = researchRowOf(inv, result, step, symbol, { nowMs });
  const incumbent = result.incumbent ? { ...result.incumbent } : null;
  const holdings = Array.isArray(result.holdings) ? result.holdings : [];
  // BRS-18: the incumbent; with none, the held measured stocks (weakest first) for the picker.
  const defaultHolding = incumbent ?? holdings[0] ?? null;
  const compareFor = (holdingSymbol) => {
    const h = incumbent && incumbent.symbol === holdingSymbol ? incumbent : holdingEntryOfResult(result, holdingSymbol);
    return h && h.symbol !== symbol ? compareOf(result, view, symbol, h, battle, { nowMs }) : null;
  };
  // Left the result after a step taken from inside the modal (BRS-18a): say why, with Undo.
  const opened = inv.steps.find((s) => s.stepId === openedStepId) ?? null;
  const wasPlaced = !!opened?.outcome.placed.some((p) => p.symbol === symbol);
  let left = null;
  if (wasPlaced && !row.placed && step.stepId !== openedStepId) {
    const by = outcome.removed.find((r) => r.symbol === symbol)?.by?.[0] ?? null;
    const c = by ? view.conditions.find((x) => x.id === by) : null;
    const q = result.quotes.rows[symbol];
    const words = c ? conditionWords(c) : BR_COPY.notAssessed;
    left = q?.state === 'ok'
      ? BR_COPY.leftResult(symbol, `${moveOf(result, symbol).value > 0 ? 'up' : moveOf(result, symbol).value < 0 ? 'down' : 'flat at'} ${moveText(Math.abs(moveOf(result, symbol).value)).replace(/^\+/, '')}`, words, etClockAmPm(q.priceAsOf))
      : BR_COPY.leftResultNoMove(symbol, words);
  }
  const atr = rungEstimateOf(result, symbol);
  return {
    investigationId: inv.investigationId,
    resultId: result.resultId,
    stepId: step.stepId,
    openedStepId,
    question: { text: titleOf(inv, result) },
    // Every refinement, the ones the step cap folded included (review BL2-7).
    refinements: refinementsOf(inv),
    group: { label: groupLabelOf(view), count: n, text: BR_COPY.stripGroup(groupLabelOf(view), n) },
    conditions: view.conditions.map((c) => ({ id: c.id, label: conditionLabel(c) })),
    order: { label: orderLabel(view.order) },
    times: { ranksAt: t.ranksAt, ranksOlder: !!t.ranksOlder, movesFrom: t.movesFrom, movesTo: t.movesTo, text: BR_COPY.stripTimes(t.ranksAt, !!t.ranksOlder, t.movesFrom, t.movesTo) },
    resultLabel: result.label,
    voice,
    agentName,
    row,
    left,
    incumbent,
    holdingsForCompare: holdings.map((h) => ({ symbol: h.symbol, positionId: h.positionId })),
    compareDefault: defaultHolding?.symbol ?? null,
    compareFor,
    // BRS-10: the row's own ATR reading, seeded into the modal's reads (status 'none' when the row has none).
    atrReading: result.measured ? (atr ? { pct: atr.pct, asOfMs: atr.asOfMs } : { pct: null, asOfMs: null }) : null,
    // BRS-18a: the three counts against the WHOLE frozen group, with the other active conditions.
    onUseAcross: (conditionId) => conditionCounts(result, view, { id: conditionId }, { replaces: conditionId === 'up_today' ? 'down_today' : conditionId === 'down_today' ? 'up_today' : null }),
    onApplyUseAcross: (conditionId) => cb.onApplyUseAcross?.(conditionId),
    onBack: () => cb.onBack?.(),
    onUndo: () => cb.onUndo?.(),
    // BRS-19: the draft for this candidate against the comparison holding shown.
    draftFor: (holdingSymbol) => {
      const h = holdingSymbol ? (incumbent && incumbent.symbol === holdingSymbol ? incumbent : holdingEntryOfResult(result, holdingSymbol)) : null;
      return draftOf(inv, result, step, symbol, h && h.symbol !== symbol ? h : null, { nowMs });
    },
    onDraft: (draft) => cb.onDraft?.(draft),
  };
}

/** The outcome a step would have (for tests and the counts line). */
export const outcomeAt = (inv, step) => outcomeOf(inv.results[step.resultId], step.view);
