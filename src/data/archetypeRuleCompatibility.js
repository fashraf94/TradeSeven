// src/data/archetypeRuleCompatibility.js
//
// WS1 — Rule-library archetype scoping: the single-source compatibility map
// between the 143 Forge rule templates and the six archetype identities.
// Pattern: src/data/archetypeAdjustments.js — ZERO imports, Node-clean, data +
// pure helpers only, so the api/ test import is the BUILD_RULES §4
// dependency-surface guard.
//
// INVARIANT R (runtime neutrality — WS1 design §4.3): this module must NEVER be
// imported by the fenced files, api/_utils/projectActiveRules.js, or either
// prompt assembly (agentPromptAssembly / agentEvalPromptAssembly). It informs
// equip-path warnings/blocks and render-time badges ONLY — never projection or
// prompts. archetypeRuleCompatibility.test.js asserts this from source.
//
// CLASSIFICATION AUTHORITY: each archetype's Zone 1 statements in the six
// ARCHETYPE_DEF_*_2026-06-24.md docs (repo root), distilled in the WS1 build
// spec §4.2. Every rule was adjudicated against its ACTUAL template text; the
// 30 draft needs_review cells were resolved by the Flash + Claude adjudication
// of July 3, 2026 (WS1 Phase 1 close-out), whose three policy rulings govern
// future template additions:
//   P1 — contrarian avoid-the-unloved: categorical gates/avoidance of the
//        out-of-favor = core_conflict; soft signals with a legitimate
//        turn-reading = neutral.
//   P2 — exits are Zone 2: profit targets, trims, and stop management on an
//        owned position are execution discipline (neutral) absent a separate
//        Zone 1 hit (guardian's no-churn core can still be that hit).
//   P3 — param-swing rules classify by DEFAULT direction; the swing is
//        documented in PARAM_SWING_NOTES; param-aware classification is the
//        designated post-observe refinement.
//
// RESOLUTION ORDER (classifyRule): ruleOverrides > familyDefaults > 'neutral'.
// A rule id may belong to AT MOST ONE family (tested) — the tag vocabulary
// cannot express direction (Phase 0 §2.1), so families are curated id-lists,
// and rules whose direction differs per archetype are handled via overrides.
//
// PARAM-INDEPENDENCE: classification is per TEMPLATE id, not per authored
// paramValues (P3 above). Param-loosening attacks on native cap rules are
// rung-2 precedence concerns, not classification concerns.
//
// SCOPE BOUNDARY (V1): only template-derived rules classify — the map is keyed
// by forgeKnowledgeBase template ids, matched from rule docs via `sourceRef`.
// Free-text manual rules (source 'manual', no sourceRef) are outside the map
// and resolve 'neutral'.

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT MODE — SHIPPED (false) as of the July 3, 2026 adjudication close-out.
// While false: 'needs_review' is forbidden anywhere in the map, the ship gate
// (zero-needs_review + shipped-states-only) and the STRICT seeded-rule
// invariant are live in the test suite. Any future re-draft (e.g. new template
// batches) flips this back on for the authoring window only.
// ─────────────────────────────────────────────────────────────────────────────
export const DRAFT_MODE = false;

// Shipped taxonomy (design spec §4.2). 'needs_review' is authoring-only.
export const COMPAT_STATES = ['native', 'neutral', 'core_conflict'];
export const DRAFT_ONLY_STATES = ['needs_review'];

// The six stable archetype CODE-IDS (keys used by agent.archetype — mirrors
// archetypeAdjustments.js / ARCHETYPE_DEFAULT_TRAITS).
export const ARCHETYPE_KEYS = [
  'momentum_chaser', // Trend Follower
  'contrarian',
  'degen',           // Speculator
  'guardian',        // Capital Preserver
  'analyst',         // Fundamental Investor
  'diversifier',
];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 1 REFERENCES
//
// Short stable ids naming the Zone 1 statement a core_conflict violates —
// required on EVERY core_conflict (family default or override), consumed by
// review + the Phase 2 warning copy ("Off-style for your [Archetype]:
// [zone1Ref statement]…"). Statements are distilled verbatim-faithful from the
// six ARCHETYPE_DEF_*_2026-06-24.md Zone 1 sections.
// ─────────────────────────────────────────────────────────────────────────────
export const ZONE1_REFS = {
  'TF-Z1-BUY-STRENGTH': {
    archetype: 'momentum_chaser',
    statement: 'Buys strength, never weakness — no bottom-fishing, no fading extended moves, no buying a name because it is beaten down.',
  },
  'TF-Z1-PRICE-NOT-PEDIGREE': {
    archetype: 'momentum_chaser',
    statement: 'Reads price, not pedigree — "buy it because it is a great company / cheap" is not a Trend Follower instruction.',
  },
  'CN-Z1-DONT-CHASE': {
    archetype: 'contrarian',
    statement: 'Does not chase strength — a name that has already run and is beloved is the worst thing it can buy.',
  },
  'CN-Z1-BUY-WEAKNESS': {
    archetype: 'contrarian',
    statement: 'Buys the oversold and out-of-favor — categorically avoiding out-of-favor names removes its entire hunting ground.',
  },
  'SP-Z1-CHASE-VOL': {
    archetype: 'degen',
    statement: 'Chases volatility, not safety — high ATR is the signal; capping or avoiding it (or locking profits so tight the volatility thesis cannot play out) is the one thing it refuses.',
  },
  'SP-Z1-FUND-IRRELEVANT': {
    archetype: 'degen',
    statement: 'Does not care what the company is — fundamentals are nothing to it; a fundamental entry gate is meaningless to a Speculator.',
  },
  'SP-Z1-NO-BORING': {
    archetype: 'degen',
    statement: 'Will not buy boring — mandated stable, low-volatility holdings are the refusal that defines it.',
  },
  'CP-Z1-NO-JUICE': {
    archetype: 'guardian',
    statement: 'Will not chase the juice — high-volatility names, junk for a quick pop, and fast in/out trading are the opposite of a Capital Preserver.',
  },
  'CP-Z1-PATIENCE': {
    archetype: 'guardian',
    statement: 'Does not get shaken out by noise — it holds good positions through wobbles; forced reactive churn contradicts patience-as-edge.',
  },
  'FI-Z1-QUALITY-GATE': {
    archetype: 'analyst',
    statement: 'Quality is the price of admission — a name failing the quality floor is not even considered, no matter how much it is moving.',
  },
  'FI-Z1-WORK-NOT-TAPE': {
    archetype: 'analyst',
    statement: 'Conviction comes from the work, not the tape — fundamentals lead; selecting by volatility or velocity alone is not a Fundamental Investor instruction.',
  },
  'DV-Z1-SPREAD': {
    archetype: 'diversifier',
    statement: 'Spreads, always — breadth is the strategy itself; deliberate concentration or standing single-sector overweight is the core attack.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PARAM-SWING NOTES (adjudication policy P3 / close-out rider §4.2)
//
// Rules classified by their DEFAULT param direction whose selectable params can
// reverse that direction. The Phase 2 warning copy for these acknowledges the
// swing instead of flatly declaring the rule off-style. Param-aware
// classification is the designated post-observe refinement.
// ─────────────────────────────────────────────────────────────────────────────
export const PARAM_SWING_NOTES = {
  'alloc-tier-preference': {
    archetype: 'contrarian',
    defaultDirection: 'Star-tier attribute defaults to "high momentum" (chase)',
    inStyleSetting: 'Undervalued',
    copyHint: 'Off-style at its default setting for your Contrarian — the "Undervalued" Star-tier setting fits your style.',
  },
  'i-07': {
    archetype: 'contrarian',
    defaultDirection: 'prefers sectors with institutional INFLOW (sector-level chase)',
    inStyleSetting: 'out-of-favor / outflow sector sentiment',
    copyHint: 'Off-style at its default setting for your Contrarian — pointing it at out-of-favor sector flow fits your style.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE FAMILIES — curated id-lists (Phase 0 §2.1: tags name topics, never
// direction, so membership is hand-curated from template text; tag probes were
// only the starting set). A rule appears in AT MOST one family; rules whose
// direction is genuinely mixed are classified per-rule in ruleOverrides.
// The five spec-sensitive families (concentration, deep value, high
// volatility, mean reversion, forced trading) plus the extensions the
// library's real directions required (volatility_avoidance, weakness_avoidance,
// chase_avoidance, profit_locking).
// ─────────────────────────────────────────────────────────────────────────────
export const RULE_FAMILIES = {
  // Buy-the-dip / oversold / counter-trend entry instructions.
  mean_reversion: {
    ruleIds: ['tech-rsi-oversold', 'tv-06', 'tv-07'],
  },
  // Buy-because-cheap valuation instructions.
  deep_value: {
    ruleIds: ['fund-value-pe', 'f-10'],
  },
  // Volatility-SEEKING instructions (squeeze hunting, high-ATR targeting,
  // conditional aggression that instructs reaching for volatility).
  high_volatility: {
    ruleIds: [
      'tech-bollinger-squeeze', 't-12', 't-15', 'tv-05', 'i-09', 'tv-15',
      'gs-06', 'gs-12', 'ss-01',
    ],
  },
  // Volatility-AVOIDING / capping instructions (the directional opposite —
  // the tag vocabulary cannot tell these apart from the family above).
  volatility_avoidance: {
    ruleIds: ['risk-volatility-avoidance', 'ts-01', 'r-10'],
  },
  // Chase-strength / breakout / momentum-preference instructions.
  momentum_breakout: {
    ruleIds: [
      'tech-moving-average-trend', 'tech-macd-bullish', 'tech-relative-strength',
      'tech-volume-surge', 't-11', 't-14', 'tv-01', 'tv-02', 'tv-11', 'tv-13',
      'tv-14', 'a-06', 'se-06', 'ss-05', 'i-06', 'i-10',
    ],
  },
  // Fundamental-quality gates and fundamentals-led selection preferences.
  fundamental_quality: {
    ruleIds: [
      'fund-financial-health', 'fund-revenue-growth', 'fund-earnings-surprise',
      'fund-bank-pb', 'f-07', 'f-08', 'f-09', 'f-11', 'f-12', 'tv-10', 'se-05',
      'a-07',
    ],
  },
  // Categorical avoid-downtrend / avoid-out-of-favor instructions.
  weakness_avoidance: {
    ruleIds: ['tech-avoid-declining', 'risk-avoid-declining-trend', 'se-03'],
  },
  // Avoid-overbought / avoid-overextended (anti-chase) instructions.
  chase_avoidance: {
    ruleIds: ['tech-rsi-overbought', 't-10', 'gs-10', 'se-01'],
  },
  // Tight profit-locking / winner-trimming instructions.
  profit_locking: {
    ruleIds: ['th-05', 'sx-04', 'sr-01'],
  },
  // Forced-churn instructions (stagnation-forced swaps, velocity rotation).
  // Directionally mixed per archetype → defaults only where uniform; the
  // guardian cells are adjudicated per-rule in ruleOverrides.
  forced_trading: {
    ruleIds: ['mb-03', 'gs-09', 'ts-04', 'ts-06'],
  },
  // PRO-concentration instructions (standing overweight, pyramiding). The
  // library's cap/spread rules are the OPPOSITE direction (diversification-
  // native) and are classified as natives via ruleOverrides, not here.
  concentration: {
    ruleIds: ['alloc-sector-minimum', 'sr-04'],
  },
};

// familyDefaults values are { state, zone1Ref? } — zone1Ref REQUIRED when
// state === 'core_conflict' (design §4.1; tested). Archetypes absent from a
// family's defaults fall through to per-rule overrides, then 'neutral'.
export const ARCHETYPE_RULE_COMPATIBILITY = {
  momentum_chaser: {
    familyDefaults: {
      mean_reversion: { state: 'core_conflict', zone1Ref: 'TF-Z1-BUY-STRENGTH' },
      deep_value: { state: 'core_conflict', zone1Ref: 'TF-Z1-PRICE-NOT-PEDIGREE' },
      momentum_breakout: { state: 'native' },
      weakness_avoidance: { state: 'native' },
      // fundamental_quality: gates narrow the universe by pedigree but do not
      // instruct buying weakness / buying-on-value — not one of the three
      // distilled TF conflict tests (spec §4.2). Deliberately neutral.
      fundamental_quality: { state: 'neutral' },
      high_volatility: { state: 'neutral' },
      volatility_avoidance: { state: 'neutral' },
      chase_avoidance: { state: 'neutral' },
      // profit_locking (th-05/sx-04/sr-01): adjudicated neutral — exits on an
      // owned position are Zone 2 execution, not a fade instruction (P2).
      profit_locking: { state: 'neutral' },
      forced_trading: { state: 'neutral' },
      concentration: { state: 'neutral' },
    },
    ruleOverrides: {
      // Momentum-flavored rebalance: adding to winners rides strength.
      'sr-04': { state: 'native' },
      // Sentiment-tailwind overweight = ride what is working.
      'a-08': { state: 'native' },
      // Reclaim entries buy CONFIRMED recovery strength, not weakness (adjudicated).
      'tv-04': { state: 'neutral' },
    },
  },

  contrarian: {
    familyDefaults: {
      mean_reversion: { state: 'native' },
      deep_value: { state: 'native' },
      chase_avoidance: { state: 'native' },
      profit_locking: { state: 'native' },
      momentum_breakout: { state: 'core_conflict', zone1Ref: 'CN-Z1-DONT-CHASE' },
      // weakness_avoidance: core_conflict per adjudication policy P1 — hard
      // gates / categorical avoidance of the out-of-favor delete the hunting
      // ground (all three members are categorical below-MA exclusions).
      weakness_avoidance: { state: 'core_conflict', zone1Ref: 'CN-Z1-BUY-WEAKNESS' },
      high_volatility: { state: 'neutral' },
      volatility_avoidance: { state: 'neutral' },
      fundamental_quality: { state: 'neutral' },
      forced_trading: { state: 'neutral' },
      concentration: { state: 'neutral' },
    },
    ruleOverrides: {
      // MACD bullish crossover is TURN detection ("momentum shifting from
      // bearish to bullish") — the contrarian's own second leg, not a chase.
      // Overturns the audit's example classification.
      'tech-macd-bullish': { state: 'neutral' },
      // P1 soft/turn-reading: volume confirmation doubles as the capitulation/
      // accumulation signal of the contrarian's turning leg.
      'tech-volume-surge': { state: 'neutral' },
      // P1 categorical ground-blockers (hard filters/gates on the unloved).
      'r-12': { state: 'core_conflict', zone1Ref: 'CN-Z1-BUY-WEAKNESS' },
      'i-02': { state: 'core_conflict', zone1Ref: 'CN-Z1-BUY-WEAKNESS' },
      'se-08': { state: 'core_conflict', zone1Ref: 'CN-Z1-BUY-WEAKNESS' },
      // P3 default direction: prefers sectors with institutional INFLOW —
      // sector-level chase (see PARAM_SWING_NOTES for the in-style setting).
      'i-07': { state: 'core_conflict', zone1Ref: 'CN-Z1-BUY-WEAKNESS' },
      // P1 soft, stock-level accumulation preference with a quality/turn reading.
      'i-01': { state: 'neutral' },
      // Standing overweight of the loved — allocation-level chase.
      'a-08': { state: 'core_conflict', zone1Ref: 'CN-Z1-DONT-CHASE' },
      // P3 default direction: Star-tier attribute defaults "high momentum"
      // (see PARAM_SWING_NOTES for the in-style setting).
      'alloc-tier-preference': { state: 'core_conflict', zone1Ref: 'CN-Z1-DONT-CHASE' },
      'sr-04': { state: 'core_conflict', zone1Ref: 'CN-Z1-DONT-CHASE' }, // add-to-winners as a strategy (spec §4.2 distilled test, verbatim)
      // Contrarian Zone 2 natives: the hard mechanical stop licenses the
      // patient default.
      'mb-09': { state: 'native' },
      'sx-01': { state: 'native' },
      'risk-exit-atr-stop': { state: 'native' },
    },
  },

  degen: {
    familyDefaults: {
      high_volatility: { state: 'native' },
      forced_trading: { state: 'native' },
      volatility_avoidance: { state: 'core_conflict', zone1Ref: 'SP-Z1-CHASE-VOL' },
      fundamental_quality: { state: 'core_conflict', zone1Ref: 'SP-Z1-FUND-IRRELEVANT' },
      deep_value: { state: 'core_conflict', zone1Ref: 'SP-Z1-FUND-IRRELEVANT' },
      profit_locking: { state: 'core_conflict', zone1Ref: 'SP-Z1-CHASE-VOL' },
      mean_reversion: { state: 'neutral' },
      momentum_breakout: { state: 'neutral' },
      weakness_avoidance: { state: 'neutral' },
      chase_avoidance: { state: 'neutral' },
      concentration: { state: 'neutral' },
    },
    ruleOverrides: {
      'th-04': { state: 'native' }, // house-money threshold chasing = riding volatility
      // Partial trim ≠ tight profit lock; the volatility thesis survives (adjudicated).
      'sr-01': { state: 'neutral' },
      // The barbell's anchors are the survival floor degen's own doc sanctions
      // as Zone-2 machinery (adjudicated).
      'a-05': { state: 'neutral' },
    },
  },

  guardian: {
    familyDefaults: {
      volatility_avoidance: { state: 'native' },
      profit_locking: { state: 'native' },
      high_volatility: { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' },
      mean_reversion: { state: 'neutral' },
      deep_value: { state: 'neutral' },
      momentum_breakout: { state: 'neutral' },
      fundamental_quality: { state: 'neutral' },
      weakness_avoidance: { state: 'neutral' },
      chase_avoidance: { state: 'neutral' },
      concentration: { state: 'neutral' },
      // forced_trading: no family default — the four members split on the
      // patience test and are adjudicated per-rule below.
    },
    ruleOverrides: {
      // Forced-trading members, per-rule (adjudicated July 3, 2026):
      'mb-03': { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' }, // stagnation-forced swaps = fast in/out churn, verbatim anti-patience
      'gs-09': { state: 'neutral' },  // persistent bleed is not noise; loss control is guardian-owned
      'ts-04': { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' }, // continuous chase-the-hottest rotation = churn-as-strategy
      'ts-06': { state: 'neutral' },  // single flatline demotion; sells nothing; protects the multiplier
      'th-04': { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' }, // house-money: widen stops past protective bounds to chase the next tier
      'i-06': { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' },  // explicit "explosive intraday moves" targeting = juice-chasing by name
      // §E close-out split: a-05's rocket mandate is un-zeroable (rockets min 1)
      // → conflict; a-09's high-ATR bench leg is zeroable and the rule is
      // primarily a spread instruction → neutral. The guardian SEED no longer
      // carries either (trait-steady-anchor replaced trait-diversifier in
      // ARCHETYPE_DEFAULT_TRAITS — the mandatory §3 seed-map fix).
      'a-05': { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' },
      'a-09': { state: 'neutral' },
      // Protective natives (spread-for-safety, stops, lock-the-lead, patience).
      'risk-sector-diversification': { state: 'native' },
      'risk-single-stock-limit': { state: 'native' },
      'risk-exit-atr-stop': { state: 'native' },
      'r-06': { state: 'native' },
      'r-08': { state: 'native' },
      'r-09': { state: 'native' },
      'alloc-sector-cap': { state: 'native' },
      'alloc-even-spread': { state: 'native' },
      'a-07': { state: 'native' },
      'gs-05': { state: 'native' },
      'gs-07': { state: 'native' },
      'gs-08': { state: 'native' },
      'th-07': { state: 'native' },
      'ss-02': { state: 'native' },
      'ss-03': { state: 'native' },
      'ss-04': { state: 'native' },
      'sx-01': { state: 'native' },
      'sx-02': { state: 'native' },
      'mb-04': { state: 'native' },
      'mb-07': { state: 'native' },
      'mb-09': { state: 'native' },
      'ts-07': { state: 'native' },
    },
  },

  analyst: {
    familyDefaults: {
      fundamental_quality: { state: 'native' },
      mean_reversion: { state: 'neutral' }, // incl. tech-rsi-oversold — technical entry timing under the standing quality floor (overturns the audit example)
      deep_value: { state: 'neutral' },
      high_volatility: { state: 'neutral' },
      volatility_avoidance: { state: 'neutral' }, // incl. ts-01 — a vol CAP is not a "vol play" (overturns the audit example)
      momentum_breakout: { state: 'neutral' },
      weakness_avoidance: { state: 'neutral' },
      chase_avoidance: { state: 'neutral' },
      profit_locking: { state: 'neutral' },
      forced_trading: { state: 'neutral' },
      concentration: { state: 'neutral' },
    },
    ruleOverrides: {
      // Vol-ALONE selection instructions — the §4.2 "enter on volatility
      // alone" test applied to swap/selection targeting (adjudicated: the
      // rule, not the roster, is what's classified).
      'tv-15': { state: 'core_conflict', zone1Ref: 'FI-Z1-WORK-NOT-TAPE' },
      'gs-06': { state: 'core_conflict', zone1Ref: 'FI-Z1-WORK-NOT-TAPE' }, // conditional-when-active: comeback selection by vol alone (not survival machinery)
      'i-09': { state: 'core_conflict', zone1Ref: 'FI-Z1-WORK-NOT-TAPE' },  // holders chosen BECAUSE they amplify volatility — tape-first selection
      'gs-12': { state: 'neutral' },  // catalyst-driven (fundamentals-adjacent), one end-of-day evaluation
      // P2 stop management, not pick selection. Guardian's separate th-04
      // conflict stands — its core covers risk posture; analyst's covers
      // selection basis.
      'th-04': { state: 'neutral' },
    },
  },

  diversifier: {
    familyDefaults: {
      mean_reversion: { state: 'neutral' },
      deep_value: { state: 'neutral' },
      high_volatility: { state: 'neutral' }, // Zone 1: no volatility ceiling — vol is not this archetype's axis
      volatility_avoidance: { state: 'neutral' },
      momentum_breakout: { state: 'neutral' },
      fundamental_quality: { state: 'neutral' }, // Zone 1: no quality floor — a user-added one narrows slots, never breadth
      weakness_avoidance: { state: 'neutral' },
      chase_avoidance: { state: 'neutral' },
      profit_locking: { state: 'neutral' },
      forced_trading: { state: 'neutral' },
      // concentration: no family default — both members adjudicated per-rule.
    },
    ruleOverrides: {
      // Standing single-sector overweight is DV-Z1's named core attack (adjudicated).
      'alloc-sector-minimum': { state: 'core_conflict', zone1Ref: 'DV-Z1-SPREAD' },
      // Marginal cap-bounded adds; breadth disturbed only at the margin (adjudicated).
      'sr-04': { state: 'neutral' },
      // Spread-machinery natives.
      'risk-sector-diversification': { state: 'native' },
      'risk-single-stock-limit': { state: 'native' },
      'r-06': { state: 'native' },
      'r-07': { state: 'native' },
      'alloc-sector-cap': { state: 'native' },
      'alloc-even-spread': { state: 'native' },
      'se-07': { state: 'native' },
      'sr-01': { state: 'native' },
      'sr-03': { state: 'native' },
      'sx-07': { state: 'native' },
      'i-05': { state: 'native' },
      'a-09': { state: 'native' },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPECTED DRAFT SEED REVIEWS — EMPTY at ship (and must stay empty while
// DRAFT_MODE is false; tested). During the July 3, 2026 draft this carried the
// two guardian trait-diversifier cells (a-05 / a-09); the close-out resolved
// them via the §E split (a-05 core_conflict / a-09 neutral) plus the mandatory
// seed-map fix: ARCHETYPE_DEFAULT_TRAITS.guardian now seeds trait-steady-anchor
// instead of trait-diversifier, so the strict invariant passes by construction.
// ─────────────────────────────────────────────────────────────────────────────
export const EXPECTED_DRAFT_SEED_REVIEWS = [];

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Family lookup: ruleId → familyKey (built once; pure data, no imports).
const FAMILY_BY_RULE_ID = (() => {
  const m = {};
  for (const [familyKey, fam] of Object.entries(RULE_FAMILIES)) {
    for (const rid of fam.ruleIds) m[rid] = familyKey;
  }
  return m;
})();

/**
 * Full classification record for (ruleId, archetype).
 * Resolution: ruleOverrides > familyDefaults > 'neutral' fall-through.
 * Unknown ruleId (custom/manual rules) or unknown archetype → neutral
 * fall-through (fail-open: blocks/warnings key on explicit core_conflict only —
 * Invariant R friendly).
 *
 * @returns {{ state: string, via: 'override'|'family'|'fallthrough',
 *             familyKey: string|null, zone1Ref: string|null,
 *             tensionReason: string|null }}
 */
export function getRuleCompatInfo(ruleId, archetype) {
  const arch = ARCHETYPE_RULE_COMPATIBILITY[archetype];
  const familyKey = FAMILY_BY_RULE_ID[ruleId] || null;
  if (arch) {
    const override = arch.ruleOverrides ? arch.ruleOverrides[ruleId] : undefined;
    if (override) {
      return {
        state: override.state,
        via: 'override',
        familyKey,
        zone1Ref: override.zone1Ref || null,
        tensionReason: override.tensionReason || null,
      };
    }
    if (familyKey && arch.familyDefaults && arch.familyDefaults[familyKey]) {
      const fd = arch.familyDefaults[familyKey];
      return {
        state: fd.state,
        via: 'family',
        familyKey,
        zone1Ref: fd.zone1Ref || null,
        tensionReason: null,
      };
    }
  }
  return { state: 'neutral', via: 'fallthrough', familyKey, zone1Ref: null, tensionReason: null };
}

/**
 * The classification state for (ruleId, archetype):
 * 'native' | 'neutral' | 'core_conflict' — plus 'needs_review' only while
 * DRAFT_MODE is true. This is the Phase 2 block/warning predicate
 * (`classifyRule(id, arch) === 'core_conflict'`).
 */
export function classifyRule(ruleId, archetype) {
  return getRuleCompatInfo(ruleId, archetype).state;
}

/**
 * Every template id that classifies core_conflict for the archetype, with its
 * zone1Ref (for review tooling + the Phase 2 badge/warning surfaces).
 *
 * @returns {Array<{ ruleId: string, zone1Ref: string|null, via: string }>}
 */
export function getConflictsForArchetype(archetype) {
  const arch = ARCHETYPE_RULE_COMPATIBILITY[archetype];
  if (!arch) return [];
  const out = [];
  const seen = new Set();
  // Family-default conflicts.
  for (const [familyKey, fam] of Object.entries(RULE_FAMILIES)) {
    const fd = arch.familyDefaults ? arch.familyDefaults[familyKey] : undefined;
    if (!fd || fd.state !== 'core_conflict') continue;
    for (const rid of fam.ruleIds) {
      const info = getRuleCompatInfo(rid, archetype); // override may supersede
      if (info.state === 'core_conflict' && !seen.has(rid)) {
        seen.add(rid);
        out.push({ ruleId: rid, zone1Ref: info.zone1Ref, via: info.via });
      }
    }
  }
  // Override conflicts (incl. rules outside conflict-defaulted families).
  for (const [rid, ov] of Object.entries(arch.ruleOverrides || {})) {
    if (ov.state === 'core_conflict' && !seen.has(rid)) {
      seen.add(rid);
      out.push({ ruleId: rid, zone1Ref: ov.zone1Ref || null, via: 'override' });
    }
  }
  return out;
}

/**
 * Every (archetype, ruleId) cell currently in needs_review — the draft-window
 * adjudication work-list. Empty at ship (tested by the zero-needs_review gate).
 *
 * @returns {Array<{ archetype: string, ruleId: string, tensionReason: string,
 *                   draftLeaning: string|null, zone1Ref: string|null }>}
 */
export function getNeedsReviewEntries() {
  const out = [];
  for (const archetype of ARCHETYPE_KEYS) {
    const arch = ARCHETYPE_RULE_COMPATIBILITY[archetype];
    for (const [rid, ov] of Object.entries(arch.ruleOverrides || {})) {
      if (ov.state === 'needs_review') {
        out.push({
          archetype,
          ruleId: rid,
          tensionReason: ov.tensionReason || '',
          draftLeaning: ov.draftLeaning || null,
          zone1Ref: ov.zone1Ref || null,
        });
      }
    }
  }
  return out;
}
