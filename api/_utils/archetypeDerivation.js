// api/_utils/archetypeDerivation.js
//
// The deterministic archetype mapping from the three temperament answers,
// implementing ARCHETYPE_IDENTITY_CONTRACT_V1.md §3 precedence. This is the
// default Haiku is steered toward AND the server-side fallback when Haiku is
// unavailable or returns an out-of-enum value (api/agent/create-profile.js).
//
// Derivation is QUESTION-ONLY: it takes the three temperament answers and
// nothing else. The user's stock picks intentionally never reach here — they
// build the starter watchlist and supply sectorAffinity, but must not influence
// the archetype.
//
// Matching is keyword-based so it tolerates both the structured option values
// (e.g. 'beaten_down') and freeform text (e.g. "I like beaten-down names").
//
// §3 precedence (apply in order):
//   1. Q1 = protect-first → guardian. Protect-first dominates and overrides the
//      buy signal — the anchor separating the defensive guardian from the
//      merely-spread diversifier.
//   2. Else Q2 = broad mix OR Q3 = spread → diversifier.
//   3. Else route by Q2 buy signal: trending → momentum_chaser,
//      beaten_down → contrarian, fundamentals → analyst, volatile → degen.
//   4. Default → analyst.
// All six archetypes are reachable (the prior buy-signal-only quiz could reach
// only four — it structurally couldn't produce guardian or diversifier).

/**
 * @param {string} q1 - risk posture answer (aggressive | balanced | protect | freeform)
 * @param {string} q2 - buy-signal answer (trending | beaten_down | fundamentals | volatile | broad_mix | freeform)
 * @param {string} q3 - concentration answer (concentrate | spread | freeform)
 * @returns {string} an archetype code-id
 */
export function deriveArchetypeFromAnswers(q1, q2, q3) {
  const r = String(q1 || '').toLowerCase();
  const b = String(q2 || '').toLowerCase();
  const c = String(q3 || '').toLowerCase();

  // 1. Protect-first dominates.
  if (r.includes('protect')) return 'guardian';
  // 2. Broad mix (Q2) or spread-wide (Q3) → diversifier.
  if (b.includes('broad') || b.includes('mix') || c.includes('spread')) return 'diversifier';
  // 3. Route by buy signal.
  if (b.includes('trend')) return 'momentum_chaser';
  if (b.includes('beaten') || b.includes('favor') || b.includes('down')) return 'contrarian';
  if (b.includes('fundamental') || b.includes('health') || b.includes('quality')) return 'analyst';
  if (b.includes('volatil') || b.includes('swing') || b.includes('move')) return 'degen';
  // 4. Default.
  return 'analyst';
}

export default deriveArchetypeFromAnswers;
