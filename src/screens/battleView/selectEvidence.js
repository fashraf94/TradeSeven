// src/screens/battleView/selectEvidence.js
//
// What the check saw — Phase B (B1 client half, seed §2). PURE.
//
// The piece's own row from the latest decided entry's `evidence` stamp: the
// numbers the decider's prompt RENDERED for this held name at that check,
// composed by the cron from the tick's own objects after the decision
// (api/_utils/tickStamps.js `composeEvidenceStamp`).
//
// THE CLAIM IS VISIBILITY, NEVER CAUSALITY. "What the {slot} check saw" says
// these values were in front of the decider. It never says the decider
// noticed, weighed, or decided because of them — those are different verbs
// with different evidence requirements, and the stamps support none of them.
//
// PRESENCE-GATED, never flag-gated (D-113). No stamp → null → the section is
// absent whole. There is no placeholder, no "not available" row and no
// skeleton: a pre-flip battle, a `budget_skipped` tick and a tick whose prompt
// build threw all carry no `evidence` key at all, and the panel renders
// exactly what it renders today.
//
// THE SAME DECIDED-JOIN AS THE PANEL (hazard 21, BUILD_RULES §9): the entry
// must belong to the latest check by the `>=` rule, so a caller that hands in
// a stale entry gets nothing here too. The evidence and the words above it can
// never come from two different checks.
//
// `evidence` and `vintages` are all-or-nothing with each other server-side, so
// the provenance line is read from the same entry — never from a newer one.

import { isDecidedAt, toMillis } from './deriveTurnLine';
import { toIso } from '../../adapters/baggerbombAdapter';

/**
 * @param {Object|null} evaluation   the latest evaluations[] entry
 * @param {string|null} symbol       the held piece (null on the book panel)
 * @param {*} lastScoredAt           battle.scoreState.lastScoredAt
 * @returns {{ checkedAt: string|null, evidence: Object, vintages: Object|null }|null}
 *   null whenever there is nothing honest to show.
 */
export function selectEvidence(evaluation, symbol, lastScoredAt) {
  if (typeof symbol !== 'string' || !symbol) return null;
  if (!evaluation || typeof evaluation !== 'object') return null;
  if (toMillis(evaluation.timestamp) == null) return null;
  if (!isDecidedAt(evaluation.timestamp, lastScoredAt)) return null;

  const evidence = evaluation.evidence?.[symbol];
  if (!evidence || typeof evidence !== 'object') return null;

  return {
    // The CHECK's own instant — the evidence is stamped by the tick that
    // rendered it, so the heading names that tick's slot, not the scoring
    // stamp (which is what the panel's own header uses for the words).
    checkedAt: toIso(evaluation.timestamp),
    evidence,
    vintages: evaluation.vintages && typeof evaluation.vintages === 'object'
      ? evaluation.vintages
      : null,
  };
}

export default selectEvidence;
