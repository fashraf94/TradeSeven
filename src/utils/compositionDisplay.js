// src/utils/compositionDisplay.js
//
// Composition PR 2 — the D2 display boundary (spec §2 display column):
// core_conflict → GREYED with the cell's one-line displayReason (the reason of
// record, B7); deferred → HIDDEN (complete-but-non-offerable — B1: the rule
// exists, the surface just does not offer it); tension → offered with the fit
// note + narrowed domain. Pure + client-safe: consumes the zero-import
// candidate registry only. DARK behind COMPOSITION_DISPLAY_ENABLED — the
// legacy copy surfaces are byte-identical while off (A23 row in the flag
// table), and adoption is per-surface at activation, not a sweep.

import { COMPOSITION_DISPLAY_ENABLED } from '../config/featureFlags.js';
import { getCandidateCompatCell } from '../data/archetypeCompatibilityCandidate.js';

/**
 * The one display verdict for a (ruleId × archetype) coordinate.
 * @returns {{ visible, greyed, displayReason, fitNote, narrowedParams, state } | null}
 *   null while the flag is dark or off-registry — callers fall through to
 *   legacy display untouched.
 */
export function getCandidateDisplayState(ruleId, archetype, { enabled = COMPOSITION_DISPLAY_ENABLED } = {}) {
  if (!enabled) return null;
  const cell = getCandidateCompatCell(ruleId, archetype);
  if (!cell) return null;
  switch (cell.state) {
    case 'core_conflict':
      return { visible: true, greyed: true, displayReason: cell.displayReason, fitNote: null, narrowedParams: null, state: 'core_conflict' };
    case 'deferred':
      return { visible: false, greyed: false, displayReason: null, fitNote: null, narrowedParams: null, state: 'deferred' };
    case 'tension':
      return { visible: true, greyed: false, displayReason: null, fitNote: cell.advisory, narrowedParams: cell.narrowedParams, state: 'tension' };
    default:
      return { visible: true, greyed: false, displayReason: null, fitNote: null, narrowedParams: null, state: cell.state };
  }
}
