// src/constants/backingApproach.js
//
// Backing Beta PR 5 carry-in (spec V1.3 §2G; DOM-2 in the PR 4 multi-lens
// review record) — THE BACKING-SAFE APPROACH LINES, kept ALONGSIDE the
// canonical per-archetype copy, never in place of it.
//
// The team card's "approach" is the archetype's canonical disposition
// (src/data/archetypeIdentity.js) — and ONLY when that line passes the backing
// lexicon (§5, §9: no bet / wager / odds / cash out / win money / gamble on a
// backing surface). One canonical line fails it: the Diversifier's "Spreads
// the bets…". PR 4 omitted the approach for that seat rather than rewrite
// canonical copy; the founder's ruling in PR 5 is a SECOND line, written for
// the backing surface, that says the same thing in the lexicon's words.
//
// USED ONLY BY THE TEAM-CARD PROJECTION (api/tournament/team-card.js
// `projectAgent`): every other surface keeps reading the canonical line. The
// table is keyed by archetype so a future canonical edit that trips the
// lexicon has one place to add its safe twin, and the co-located test holds
// every entry to the lexicon it exists to satisfy.
//
// Zero runtime imports beyond the ONE lexicon matcher (R-B-5): the copy guard
// and the projection's filter share it, so "safe" here means exactly what
// "safe" means there.

// The `.js` extension: this module is reachable from api/ (team-card.js), and Node ESM requires it (BUILD_RULES §4).
import { findForbiddenTerm } from './backingLexicon.js';

/**
 * Archetype key → the backing-safe approach line. Add an entry only when the
 * canonical disposition fails the backing lexicon; a canonical line that
 * passes is shown as it is and needs no twin.
 */
export const BACKING_SAFE_APPROACH = Object.freeze({
  diversifier: 'Keeps the portfolio spread across many sectors so no single one can sink you.',
});

/**
 * The approach the backing surface shows for an archetype: the canonical line
 * when it passes the lexicon, else its backing-safe twin, else nothing — never
 * a guess, never another archetype's line.
 *
 * @param {string|null} archetype the archetype key
 * @param {string|null} canonical the archetype's canonical disposition
 * @returns {string|null}
 */
export function backingSafeApproach(archetype, canonical) {
  if (typeof canonical === 'string' && canonical.length > 0 && findForbiddenTerm(canonical) == null) return canonical;
  const safe = typeof archetype === 'string' ? BACKING_SAFE_APPROACH[archetype] : undefined;
  return typeof safe === 'string' && safe.length > 0 && findForbiddenTerm(safe) == null ? safe : null;
}
