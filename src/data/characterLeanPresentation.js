// src/data/characterLeanPresentation.js
//
// Release 3 (Character tab) — the GOVERNED UI-local presentation layer for
// standing leans + the tempo dial. Founder ruling (2026-07-13): the design's
// per-lean title/gloss/annotation do NOT exist in the backend, so rather than
// hand-author (and risk drifting from) the agent's real directive, we DERIVE the
// plain-language read from each lean's real `policy` fields. The verbatim
// `canonical` directive is always rendered as the primary text (Display-Agreement
// §9); everything here is a secondary, derived read that cannot contradict it.
//
// Tempo copy: the dial POSITIONS mirror VALID_TEMPO_VALUES (the backend enum);
// the per-archetype MEANING strings are UI explanation copy (not agent
// directives), keyed by the six real archetype code-ids.

import { VALID_TEMPO_VALUES } from '../../api/_utils/tempoDialBands.js';
import { getConflictGroups } from './archetypeAdjustments.js';

// ── Derived lean read (from policy) ──────────────────────────────────────────
// Policy shape (src/data/archetypeAdjustments.js): { riskDirection, concentration
// Direction, timeHorizonDirection, coreAlignment, forbiddenOpposite }.
const RISK_PHRASE = { lower: 'trades more cautiously', higher: 'takes more risk' };
const CONC_PHRASE = { tighter: 'concentrates the book', wider: 'spreads the book wider' };
const HORIZON_PHRASE = { longer: 'holds longer', shorter: 'exits sooner' };

// A short "what this changes" gloss composed from the non-neutral policy
// directions. Empty policy / all-neutral falls back to the reinforcement read.
export function deriveLeanGloss(policy) {
  if (!policy || typeof policy !== 'object') return 'Sharpens how this archetype already trades.';
  const parts = [];
  if (RISK_PHRASE[policy.riskDirection]) parts.push(RISK_PHRASE[policy.riskDirection]);
  if (CONC_PHRASE[policy.concentrationDirection]) parts.push(CONC_PHRASE[policy.concentrationDirection]);
  if (HORIZON_PHRASE[policy.timeHorizonDirection]) parts.push(HORIZON_PHRASE[policy.timeHorizonDirection]);
  if (!parts.length) return 'Sharpens how this archetype already trades — no change to risk, spread, or holding time.';
  // Sentence-case the joined fragments: "Trades more cautiously and holds longer."
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

// The one-line note the fingerprint shows for an equipped lean — the leans
// annotate the disposition, they never reshape it. Derived from the dominant
// policy direction (risk → concentration → horizon), falling back to a neutral
// note. Kept terse (no trailing period) to read as an annotation.
export function deriveLeanNote(policy) {
  if (!policy || typeof policy !== 'object') return 'sharpens its natural read';
  if (policy.concentrationDirection === 'tighter') return 'tightens what it emphasizes';
  if (policy.concentrationDirection === 'wider') return 'loosens what it emphasizes';
  if (policy.timeHorizonDirection === 'longer') return 'widens how long it holds';
  if (policy.timeHorizonDirection === 'shorter') return 'quickens how it exits';
  if (policy.riskDirection === 'lower') return 'sharpens what it hunts for';
  if (policy.riskDirection === 'higher') return 'reaches harder for the move';
  return 'sharpens its natural read';
}

// ── Conflict-group reason ────────────────────────────────────────────────────
// The human "why can't these run together" line, sourced from the SAME
// ADJUSTMENT_CONFLICT_GROUPS the server rejects on — the group's `dimension`
// label. Returns the dimension for the group the candidate belongs to (or null).
export function conflictDimension(codeId, adjustmentId) {
  for (const group of getConflictGroups(codeId)) {
    if (group.members?.some((m) => m.id === adjustmentId)) return group.dimension || null;
  }
  return null;
}

// ── Tempo dial ───────────────────────────────────────────────────────────────
// Positions mirror the backend enum order (measured|standard|aggressive); dots +
// labels are UI. Kept in sync with VALID_TEMPO_VALUES by construction.
const TEMPO_LABELS = { measured: 'Measured', standard: 'Standard', aggressive: 'Aggressive' };
export const TEMPO_POSITIONS = VALID_TEMPO_VALUES.map((id, i) => ({
  id,
  label: TEMPO_LABELS[id] || id,
  dots: i + 1,
}));
export const TEMPO_DEFAULT = 'standard';
export const tempoLabel = (id) => TEMPO_LABELS[id] || (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Standard');

// Per-archetype meaning under the dial — UI explanation copy, keyed by the six
// real code-ids. The through-line: the dial moves the agent WITHIN its own
// identity (its lane), never out of it.
export const TEMPO_MEANING = {
  momentum_chaser: 'At Aggressive it rotates sooner and reaches for younger moves; at Measured it lets the trend prove itself first. Both are still buying strength, never bargains.',
  contrarian: 'At Aggressive it steps into distress earlier and harder; at Measured it waits for the reversal to show. Both are still fading the crowd.',
  diversifier: 'At Aggressive it rebalances more actively; at Measured it lets the spread sit. Both stay broad — the spread is never abandoned.',
  degen: 'Aggressive and Measured are both fast and bold — the dial only changes how hard it reaches. A Speculator at Measured still runs hotter than most.',
  analyst: 'At Aggressive it acts on conviction sooner; at Measured it waits for a deeper discount. Both still demand real quality first.',
  guardian: 'A Capital Preserver at Aggressive is still calmer than a Speculator at Measured. The dial moves it within its lane — never out of it.',
};
export const tempoMeaning = (codeId) => TEMPO_MEANING[codeId] || TEMPO_MEANING.analyst;
