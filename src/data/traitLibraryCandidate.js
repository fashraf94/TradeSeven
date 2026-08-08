// src/data/traitLibraryCandidate.js
//
// Composition PR 4 — event-ledger CARGO ITEM 6: the CANDIDATE default-traits
// object (B10 / acceptance A24). Carries the default-trait seeding
// SUBSTITUTIONS for the five hosts still seeding non-offerable rules —
// diversifier's four hidden seeds (tv-04, mb-05: hidden_absent_substrate;
// gs-05, gs-06: hidden_absent_substrate — the par family) and guardian's
// deprecated risk-single-stock-limit — selected under the founder's
// substitution POLICY RULING (Aug 7, 2026):
//
//   1. a substitute is SUPPORTED + OFFERABLE and NATIVE for the host
//      archetype — candidate-registry-native where candidate cells exist
//      (guardian), the STORED map where they don't (reserved diversifier);
//   2. the selection criterion is the TRAIT'S STATED IDENTITY FUNCTION;
//      RULE_FAMILIES is a tie-breaker where defined, never the criterion;
//   3. where NO supported native rule preserves the identity function, the
//      seed is DROPPED and the trait RESHAPED around native rules with
//      HONEST card copy (the WS1 trait-steady-anchor precedent) — never
//      seed hidden/deprecated, never stretch semantics to fill a slot;
//   4. substitutes' seeded params satisfy invariant (b) at every strength
//      wherever cells exist;
//   5. exact per-rule proposals tabled for founder ratification at merge
//      (the 3.5 ladder pattern) — the STOP report carries the table.
//
// SCOPE FINDING (this session, RED-control proof in the composition test):
// the live object seeds SEVEN non-offerable rules, not item 6's five — the
// same predicate also finds momentum_chaser/t-09 and contrarian/tv-07 (both
// hidden_absent_substrate, the intraday-indicator family). The written
// substitution POLICY is generic over the defect class, so both ride it here
// — the 3.5 "analyst-only premise disproven" precedent — flagged FIRST in
// the ratification table (the founder ratifies all seven or severs the two).
//
// THE PROPOSALS BUILT HERE (awaiting ratification):
//   guardian/trait-steady-anchor — risk-single-stock-limit → alloc-sector-cap
//     (guardian candidate-NATIVE; the game has no position sizing, so the
//     surviving concentration-safety lever nearest a single-stock cap is the
//     sector cap: floor (risk-sector-diversification) + cap + even-spread is
//     the complete concentration triad); card copy re-authored honestly.
//   diversifier/trait-smart-money-tracker → trait-crowding-sentinel (NEW):
//     both seeds dropped (no supported diversifier-native rule provides
//     institutional-FLOW evidence); reshaped around the two supported
//     diversifier-NATIVE crowding rules i-05 + r-07 with honest copy.
//   diversifier/trait-score-adaptor → trait-balanced-optionality (NEW):
//     both seeds dropped (no supported diversifier-native game_state rule
//     exists — the par family is absent-substrate); reshaped around
//     alloc-even-spread + a-09, the native optionality/balance pair.
//   momentum_chaser/trait-trend-rider — t-09 → tv-08 (BEYOND item 6):
//     tv-08 "Low Volume Pullback Hold" is candidate-NATIVE and IS the
//     pullback-within-trend rule — the trait's stated identity ("Trusts the
//     trend and buys the pullback") preserved exactly; ladder stricter with
//     strength, matching the trait's existing direction.
//   contrarian/trait-bargain-hunter — tv-07 → fund-value-pe (BEYOND item 6):
//     fund-value-pe "Hunt for undervalued stocks" is candidate-NATIVE and
//     carries the bargain identity ("beaten down too far" ⇒ cheap) that the
//     absent-substrate intraday-range rule only gestured at.
//
// A24 (the B10 test, text of record): this object is UNREACHABLE from every
// birth path — new births are byte-identical to pre-PR births until the
// activation record selects the candidate (identity v3); existing agents are
// untouched in both worlds. The ONLY sanctioned consumers are the registry's
// version-parameterized candidate composition (archetypeRegistry.js) and
// tests. traitLibraryCandidate.composition.test.js enforces both arms.
//
// Composition is BY REFERENCE from the live library wherever content is
// UNCHANGED (no local copies — BUILD_RULES §4); this module re-declares only
// the three candidate trait definitions. It is a sanctioned member of the
// §2.3 composition layer (archetypeRegistry.test.js COMPOSITION_LAYER, this
// commit).

import { TRAIT_BY_ID, ARCHETYPE_DEFAULT_TRAITS } from './traitLibrary.js';

/** The identity version this candidate object targets (live + 1). */
export const CANDIDATE_IDENTITY_DELTA = 1;

/**
 * Candidate trait definitions — ONLY the traits that differ from the live
 * library. Full library shape per trait; everything else resolves live.
 */
export const CANDIDATE_TRAIT_DEFINITIONS = Object.freeze({
  // Guardian slot — MODIFIED in place (same trait id, the WS1-minted trait):
  // the deprecated risk-single-stock-limit ("structurally vacuous — the game
  // has no position sizing", ruleSupportStatus.js) is replaced by
  // alloc-sector-cap, and the card copy stops promising position sizing.
  'trait-steady-anchor': {
    id: 'trait-steady-anchor',
    name: 'Steady Anchor',
    identityStatement: 'Keeps the book spread wide and no single bet able to sink it',
    dnaGroup: 'discipline',
    icon: 'Anchor',
    source: 'library',
    tags: ['diversification', 'sector-cap', 'capital-preservation', 'sectors'],
    ruleIds: ['risk-sector-diversification', 'alloc-sector-cap', 'alloc-even-spread'],
    strengthProfiles: {
      subtle: {
        'risk-sector-diversification': { n: 3 },
        'alloc-sector-cap': { sector: 'any single', pct: 45 },
        'alloc-even-spread': { conviction: 'light' },
      },
      moderate: {
        'risk-sector-diversification': { n: 4 },
        'alloc-sector-cap': { sector: 'any single', pct: 35 },
        'alloc-even-spread': { conviction: 'moderate' },
      },
      dominant: {
        'risk-sector-diversification': { n: 5 },
        'alloc-sector-cap': { sector: 'any single', pct: 25 },
        'alloc-even-spread': { conviction: 'strong' },
      },
    },
  },

  // Diversifier instincts slot — NEW trait (reshape ruling 3): i-05 + r-07
  // are the ONLY supported diversifier-native rules carrying institutional /
  // correlation-crowding evidence; the card copy promises what they do.
  'trait-crowding-sentinel': {
    id: 'trait-crowding-sentinel',
    name: 'Crowding Sentinel',
    identityStatement: 'Knows what the big funds hold and refuses to crowd into their bets',
    dnaGroup: 'instincts',
    icon: 'Radar',
    source: 'library',
    tags: ['institutional', 'overlap', 'correlation', 'diversification'],
    ruleIds: ['i-05', 'r-07'],
    strengthProfiles: {
      subtle: {
        'i-05': { max: 3 },
        'r-07': { max: 2 },
      },
      moderate: {
        'i-05': { max: 2 },
        'r-07': { max: 1 },
      },
      dominant: {
        'i-05': { max: 1 },
        'r-07': { max: 1 },
      },
    },
  },

  // Diversifier strategy slot — NEW trait (reshape ruling 3): no supported
  // diversifier-native game_state rule exists (the par family is
  // absent-substrate), so the slot reshapes to the native balance +
  // bench-optionality pair — honest adaptivity through readiness, no
  // score-awareness claimed.
  'trait-balanced-optionality': {
    id: 'trait-balanced-optionality',
    name: 'Balanced Optionality',
    identityStatement: 'Keeps the book balanced and the bench ready for whatever comes next',
    dnaGroup: 'strategy',
    icon: 'Scale',
    source: 'library',
    tags: ['balanced', 'bench', 'diversification', 'flexibility'],
    ruleIds: ['alloc-even-spread', 'a-09'],
    strengthProfiles: {
      subtle: {
        'alloc-even-spread': { conviction: 'light' },
        'a-09': { complement: 1, high_upside: 0 },
      },
      moderate: {
        'alloc-even-spread': { conviction: 'moderate' },
        'a-09': { complement: 2, high_upside: 1 },
      },
      dominant: {
        'alloc-even-spread': { conviction: 'strong' },
        'a-09': { complement: 3, high_upside: 2 },
      },
    },
  },

  // Momentum-chaser discipline slot — MODIFIED in place (BEYOND item 6, the
  // scope finding): t-09 (absent-substrate VWAP pullback) → tv-08, the
  // candidate-NATIVE pullback-within-trend rule. Unchanged rules carry their
  // LIVE ladders verbatim (incl. the 3.5-repaired tv-01 values); tv-08's
  // ladder is stricter with strength, the trait's existing direction.
  'trait-trend-rider': {
    id: 'trait-trend-rider',
    name: 'Trend Rider',
    identityStatement: 'Trusts the trend and buys the pullback',
    dnaGroup: 'instincts',
    icon: 'TrendingUp',
    source: 'library',
    tags: ['trend', 'moving-average', 'pullback', 'volume'],
    ruleIds: ['tech-moving-average-trend', 'tv-08', 'tv-01'],
    strengthProfiles: {
      subtle: {
        'tech-moving-average-trend': { period: '50', requireAlignment: false },
        'tv-08': { score: 55, vol: 1, minutes: 60 },
        'tv-01': { low: 45, high: 75, weak: 35, stretched: 80 },
      },
      moderate: {
        'tech-moving-average-trend': { period: '50', requireAlignment: true },
        'tv-08': { score: 60, vol: 0.8, minutes: 90 },
        'tv-01': { low: 50, high: 70, weak: 40, stretched: 77 },
      },
      dominant: {
        'tech-moving-average-trend': { period: '200', requireAlignment: true },
        'tv-08': { score: 65, vol: 0.6, minutes: 120 },
        'tv-01': { low: 55, high: 65, weak: 45, stretched: 75 },
      },
    },
  },

  // Contrarian instincts slot — MODIFIED in place (BEYOND item 6, the scope
  // finding): tv-07 (absent-substrate intraday-range patience) →
  // fund-value-pe, the candidate-NATIVE valuation-bargain rule; ladder
  // deepens the cheapness bar with strength, matching the trait's
  // tightening direction. Unchanged rules carry their LIVE ladders verbatim.
  'trait-bargain-hunter': {
    id: 'trait-bargain-hunter',
    name: 'Bargain Hunter',
    identityStatement: 'Targets stocks that have been beaten down too far',
    dnaGroup: 'instincts',
    icon: 'Search',
    source: 'library',
    tags: ['oversold', 'mean-reversion', 'RSI', 'value'],
    ruleIds: ['tech-rsi-oversold', 'tv-06', 'fund-value-pe'],
    strengthProfiles: {
      subtle: {
        'tech-rsi-oversold': { threshold: 35 },
        'tv-06': { percentB: 0.2 },
        'fund-value-pe': { level: 'sector median' },
      },
      moderate: {
        'tech-rsi-oversold': { threshold: 30 },
        'tv-06': { percentB: 0.1 },
        'fund-value-pe': { level: '20' },
      },
      dominant: {
        'tech-rsi-oversold': { threshold: 25 },
        'tv-06': { percentB: 0.05 },
        'fund-value-pe': { level: '15' },
      },
    },
  },
});

/**
 * The CANDIDATE default-trait map: diversifier's two reshaped slots swap
 * trait ids; every other archetype's list is the LIVE list by reference
 * (guardian keeps trait-steady-anchor — its DEFINITION is what changes).
 */
export const CANDIDATE_ARCHETYPE_DEFAULT_TRAITS = Object.freeze({
  ...ARCHETYPE_DEFAULT_TRAITS,
  diversifier: Object.freeze(['trait-crowding-sentinel', 'trait-sector-rotator', 'trait-balanced-optionality']),
});

/**
 * The candidate trait view: candidate definition where one exists, else the
 * live library object. This is the composition seam the registry's
 * version-parameterized resolver reads for identity v(live+1).
 */
export function getCandidateTraitById(traitId) {
  return CANDIDATE_TRAIT_DEFINITIONS[traitId] ?? TRAIT_BY_ID[traitId] ?? null;
}
