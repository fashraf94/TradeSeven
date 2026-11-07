// api/_utils/huddle/dissentTable.js
//
// Huddle S1 — THE DISSENT TABLE (spec V1.1 §4.3; concept V1.2 §3 "Guardrails"): one
// rule per archetype, a code constant proposed by the build and ratified by the
// founder in the build report (founder question 2). A rule names ONE stance kind the
// archetype will not carry and the stance it carries instead, with the reason the
// plan card shows. Every rule moves a stance toward WATCH, never toward more risk.
//
// FAIL CLOSED (Astra AR-8): an archetype with no row has no dissent table. The plan is
// still proposed, but confirm answers `archetype_unsupported` and nothing is filed;
// the apply module refuses a battle whose frozen archetype has no row the same way.
//
// The six keys are the archetype ids of the fenced archetype table
// (api/_utils/agentArchetypeConfig.js VALID_ARCHETYPES). They are HELD here as values,
// not imported (no new importer of a legacy archetype table, so no §2.3 ratchet line,
// BUILD_RULES §1): dissentTable.test.js pins the key set equal to VALID_ARCHETYPES.
// ZERO imports.

export const DISSENT_TABLE = Object.freeze({
  // Trend Follower — "Goes where the momentum is — and leaves the moment it fades."
  momentum_chaser: Object.freeze({ from: 'FADE', to: 'WATCH', reason: 'A trend follower does not lean against a move, so it watches this name instead.' }),
  // Contrarian — "Buys what everyone else is giving up on."
  contrarian: Object.freeze({ from: 'CHASE', to: 'WATCH', reason: 'A contrarian does not chase a crowded move, so it watches this name instead.' }),
  // Diversifier — "Spreads the bets so no single one can sink you."
  diversifier: Object.freeze({ from: 'CHASE', to: 'WATCH', reason: 'A diversifier does not press one name on a move, so it watches this name instead.' }),
  // Speculator — "Chases the biggest swings and wears the risk."
  degen: Object.freeze({ from: 'FADE', to: 'WATCH', reason: 'A speculator rides a swing rather than fading it, so it watches this name instead.' }),
  // Fundamental Investor — "Buys quality companies and lets the fundamentals do the work."
  analyst: Object.freeze({ from: 'CHASE', to: 'WATCH', reason: 'A fundamental investor does not buy a price move on its own, so it watches this name instead.' }),
  // Capital Preserver — "Protects the downside before chasing any upside."
  guardian: Object.freeze({ from: 'CHASE', to: 'WATCH', reason: 'A capital preserver protects the downside before chasing upside, so it watches this name instead.' }),
});

/** The archetype's row, or null (fail closed). An inherited name ('constructor') is never a row. */
export function dissentRowOf(archetype) {
  if (typeof archetype !== 'string' || !Object.prototype.hasOwnProperty.call(DISSENT_TABLE, archetype)) return null;
  return DISSENT_TABLE[archetype];
}

/** Whether the archetype has a dissent row: the plan can be confirmed and filed under it. */
export function isArchetypeSupported(archetype) {
  return dissentRowOf(archetype) !== null;
}
