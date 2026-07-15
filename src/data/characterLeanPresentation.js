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
// Direction, timeHorizonDirection, coreAlignment, forbiddenOpposite }. The policy
// tags are COARSE — they capture risk / concentration / horizon direction, but
// NOT entry-timing, sizing, or selectivity (all of which map to riskDirection).
// So a policy-only gloss can't reach directive-level specificity without
// misattributing; we therefore keep the gloss honest and SPARING.

// Per-dimension gloss fragments (used only when composing a multi-dimension read).
const GLOSS = {
  risk: { lower: 'leans to the lower-risk side of its picks', higher: 'reaches for more risk' },
  concentration: { tighter: 'concentrates into fewer names', wider: 'spreads across more names' },
  horizon: { longer: 'holds longer before rotating', shorter: 'takes profits sooner' },
};

// The "what this changes" gloss EARNS ITS PLACE ONLY WHEN IT ADDS: it is shown
// solely when a lean synthesizes across TWO OR MORE policy dimensions (a read the
// single verbatim directive doesn't obviously spell out). A single-purpose lean's
// directive already reads plainly, so we return null and the UI drops the line —
// never a generic restatement, never a misattributed risk phrase. Returns a
// composed sentence, or null.
export function deriveLeanGloss(policy) {
  if (!policy || typeof policy !== 'object') return null;
  const parts = [];
  if (GLOSS.risk[policy.riskDirection]) parts.push(GLOSS.risk[policy.riskDirection]);
  if (GLOSS.concentration[policy.concentrationDirection]) parts.push(GLOSS.concentration[policy.concentrationDirection]);
  if (GLOSS.horizon[policy.timeHorizonDirection]) parts.push(GLOSS.horizon[policy.timeHorizonDirection]);
  if (parts.length < 2) return null; // single-purpose → the directive already says it
  const joined = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

// The fingerprint annotation — the teaching read of WHICH AXES a lean sharpens
// (it annotates the disposition, never reshapes it). Composes across ALL the
// non-neutral policy dimensions a lean touches (concentration → horizon → risk),
// joined with · . Terse, no trailing period. This is the version that teaches.
const NOTE = {
  concentration: { tighter: 'tightens what it emphasizes', wider: 'loosens what it emphasizes' },
  horizon: { longer: 'widens how long it holds', shorter: 'quickens how it exits' },
  risk: { lower: 'sharpens what it hunts for', higher: 'reaches harder for the move' },
};
export function deriveLeanNote(policy) {
  if (!policy || typeof policy !== 'object') return 'sharpens its natural read';
  const parts = [];
  if (NOTE.concentration[policy.concentrationDirection]) parts.push(NOTE.concentration[policy.concentrationDirection]);
  if (NOTE.horizon[policy.timeHorizonDirection]) parts.push(NOTE.horizon[policy.timeHorizonDirection]);
  if (NOTE.risk[policy.riskDirection]) parts.push(NOTE.risk[policy.riskDirection]);
  return parts.length ? parts.join(' · ') : 'sharpens its natural read';
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

// ── Lean displayNames (UI chrome ONLY) ───────────────────────────────────────
// The lean's `id` (TF-01 …) is a DB key, not a user-facing label. This map gives
// each of the 46 leans a short human title shown as the card heading ABOVE the
// unchanged, verbatim AGENT DIRECTIVE — never instead of it (Display-Agreement
// §9: the canonical directive remains the source of truth). Purely presentation:
// nothing here feeds the prompt/gate, which read id/canonical/policy only.
//
// First pass derived from each lean's directive + policy (a 3-lens naming panel +
// synthesis, 2026-07-15) — delivered as a review artifact for Flash to edit before
// ship. Two constraints hold the set together:
//  • Shared directives share a name — "Reduce position size on new entries"
//    (TF-05/CN-07/SP-06/DV-06/FI-07) → "Smaller Entries"; "Tighten the downside
//    stop" (CN-03/SP-01) → "Tighter Stop"; "Raise the quality bar" (CP-01/FI-01)
//    → "Higher Quality"; "Concentrate into … quality names" (CP-06/FI-05) →
//    "Quality Conviction".
//  • Conflict-group opposites read as opposites — Sell Into Strength ↔ Ride The
//    Reversal (CN-G1), High Conviction ↔ Wider Net (SP-G1), Breathing Room ↔
//    Tighter Leash (CP-G1), Trim The Creep ↔ Slight Tilt (DV-G1), Patient Hold ↔
//    Cut Dead Money (FI-G1), Quality Conviction ↔ Wider Quality (FI-G2).
export const LEAN_DISPLAY_NAMES = {
  // Trend Follower
  'TF-01': 'Fresh Breakouts', 'TF-02': 'Confirm First', 'TF-03': 'Strongest Sectors',
  'TF-04': 'Let Winners Run', 'TF-05': 'Smaller Entries', 'TF-06': 'Liquid Names',
  'TF-07': 'Chart First', 'TF-08': 'Pause After Fails',
  // Contrarian
  'CN-01': 'Deeper Washout', 'CN-02': 'Confirmed Turn', 'CN-03': 'Tighter Stop',
  'CN-04': 'Most Hated', 'CN-05': 'Sell Into Strength', 'CN-06': 'Fundamental Backing',
  'CN-07': 'Smaller Entries', 'CN-08': 'Ride The Reversal',
  // Speculator
  'SP-01': 'Tighter Stop', 'SP-02': 'Tamer Volatility', 'SP-03': 'Fewer Swings',
  'SP-04': 'High Conviction', 'SP-05': 'Wider Net', 'SP-06': 'Smaller Entries',
  'SP-07': 'Stronger Trigger',
  // Capital Preserver
  'CP-01': 'Higher Quality', 'CP-02': 'Calmer Names', 'CP-03': 'Weather The Noise',
  'CP-04': 'Breathing Room', 'CP-05': 'Tighter Leash', 'CP-06': 'Quality Conviction',
  'CP-07': 'Steady Spread', 'CP-08': 'Stronger Catalyst',
  // Diversifier
  'DV-01': 'Tighter Focus', 'DV-02': 'More Sectors', 'DV-03': 'Trim The Creep',
  'DV-04': 'Equal Weight', 'DV-05': 'Slight Tilt', 'DV-06': 'Smaller Entries',
  'DV-07': 'Fill The Gaps',
  // Fundamental Investor
  'FI-01': 'Higher Quality', 'FI-02': 'Cleaner Setup', 'FI-03': 'Patient Hold',
  'FI-04': 'Cut Dead Money', 'FI-05': 'Quality Conviction', 'FI-06': 'Wider Quality',
  'FI-07': 'Smaller Entries', 'FI-08': 'Timely Catalyst',
};

// The human title for a lean id (null if unknown — the UI then shows no title
// rather than leaking the raw code).
export const leanDisplayName = (id) => LEAN_DISPLAY_NAMES[id] || null;
