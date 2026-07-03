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
// spec §4.2. Every rule was adjudicated against its ACTUAL template text in
// src/data/forgeKnowledgeBase.js — not against the audit's example ids (several
// of which the adjudication overturned; see the Phase 1 adjudication artifact).
//
// RESOLUTION ORDER (classifyRule): ruleOverrides > familyDefaults > 'neutral'.
// A rule id may belong to AT MOST ONE family (tested) — the tag vocabulary
// cannot express direction (Phase 0 §2.1), so families are curated id-lists,
// and rules whose direction differs per archetype are handled via overrides.
//
// PARAM-INDEPENDENCE: classification is per TEMPLATE id, not per authored
// paramValues. Param-dependent edge cases (e.g. alloc-tier-preference's
// attribute select, cap-loosening attacks on native cap rules) are classified
// by the template's DEFAULT direction, with the swing documented in
// tensionReason / the adjudication artifact. Runtime param attacks on hard
// bounds are rung-2 concerns (precedence ladder), not classification concerns.
//
// SCOPE BOUNDARY (V1): only template-derived rules classify — the map is keyed
// by forgeKnowledgeBase template ids, matched from rule docs via `sourceRef`.
// Free-text manual rules (source 'manual', no sourceRef) are outside the map
// and resolve 'neutral'.

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT MODE
//
// TRUE while the map is in the Phase 1 draft → adjudication loop. While true:
//   * 'needs_review' entries are permitted (each carries tensionReason +
//     draftLeaning for the adjudication table).
//   * The zero-needs_review ship gate in the test file is SKIPPED.
//   * The seeded-rule invariant tolerates ONLY the cells declared in
//     EXPECTED_DRAFT_SEED_REVIEWS below (no silent growth).
// Flipping this to false without resolving every needs_review entry fails the
// suite. Flash + Claude adjudicate at the Phase 1 STOP; CC applies the calls,
// deletes the needs_review entries (and draftLeaning fields), and flips this.
// ─────────────────────────────────────────────────────────────────────────────
export const DRAFT_MODE = true;

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
      forced_trading: { state: 'neutral' },
      concentration: { state: 'neutral' },
    },
    ruleOverrides: {
      // Momentum-flavored rebalance: adding to winners rides strength.
      'sr-04': { state: 'native' },
      // Sentiment-tailwind overweight = ride what is working.
      'a-08': { state: 'native' },
      'th-05': {
        state: 'needs_review',
        tensionReason: 'Tightening stops to lock profit after a threshold cuts a winner early — tension with let-winners-run (seeded mb-08) and "never fade strength"; but it is threshold-game stop management, not a fade instruction.',
        draftLeaning: 'neutral',
        zone1Ref: 'TF-Z1-BUY-STRENGTH',
      },
      'sx-04': {
        state: 'needs_review',
        tensionReason: 'A fixed profit target sells strength at a preset gain — fade-adjacent; but exits on own terms are Zone 2 execution, not a weakness-buying instruction.',
        draftLeaning: 'neutral',
        zone1Ref: 'TF-Z1-BUY-STRENGTH',
      },
      'sr-01': {
        state: 'needs_review',
        tensionReason: 'Trimming any position above a cap back to target systematically cuts winners — anti-let-run direction; but it trims (keeps the position) rather than exits, and is standard rebalancing discipline.',
        draftLeaning: 'neutral',
        zone1Ref: 'TF-Z1-BUY-STRENGTH',
      },
      'tv-04': {
        state: 'needs_review',
        tensionReason: 'VWAP-reclaim entries buy a name that just dipped (turn-buying) — bottom-fish-adjacent; but the reclaim requirement means the entry is on confirmed recovery strength, not weakness.',
        draftLeaning: 'neutral',
        zone1Ref: 'TF-Z1-BUY-STRENGTH',
      },
    },
  },

  contrarian: {
    familyDefaults: {
      mean_reversion: { state: 'native' },
      deep_value: { state: 'native' },
      chase_avoidance: { state: 'native' },
      profit_locking: { state: 'native' },
      momentum_breakout: { state: 'core_conflict', zone1Ref: 'CN-Z1-DONT-CHASE' },
      high_volatility: { state: 'neutral' },
      volatility_avoidance: { state: 'neutral' },
      fundamental_quality: { state: 'neutral' },
      forced_trading: { state: 'neutral' },
      concentration: { state: 'neutral' },
      // weakness_avoidance: no family default — all three members are
      // adjudicated per-rule below (the categorical-exclusion reading vs the
      // "not the broken" discipline reading).
    },
    ruleOverrides: {
      // MACD bullish crossover is TURN detection ("momentum shifting from
      // bearish to bullish") — the contrarian's own second leg, not a chase.
      // Overturns the audit's example classification.
      'tech-macd-bullish': { state: 'neutral' },
      'tech-volume-surge': {
        state: 'needs_review',
        tensionReason: 'Volume-surge preference follows big moves (chase-flavored, "follow the smart money") — but volume confirmation on a washed-out name is exactly the capitulation/accumulation signal a contrarian uses for its turning leg.',
        draftLeaning: 'neutral',
        zone1Ref: 'CN-Z1-DONT-CHASE',
      },
      // Weakness-avoidance members — categorical below-MA exclusions remove
      // most washed-out names (the hunting ground), but also align with
      // "oversold, not broken" (the archetype's own stabilizing-leg bar).
      'tech-avoid-declining': {
        state: 'needs_review',
        tensionReason: 'Hard avoid-below-MA exclusion forbids nearly all oversold names (they are by definition below moving averages) — guts the hunting ground; counter-reading: it encodes "not the broken" / wait-for-reversal, which the archetype itself requires.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      'risk-avoid-declining-trend': {
        state: 'needs_review',
        tensionReason: 'Same direction as tech-avoid-declining with a longer lookback ("Don\'t fight the trend") — categorically excludes the out-of-favor names the archetype exists to buy; counter-reading: falling-knife protection.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      'se-03': {
        state: 'needs_review',
        tensionReason: 'HARD entry gate ("Only enter stocks trading above their N-day moving average") — the strictest form of the family; an oversold name that has merely stabilized cannot pass a 50/200-day MA gate.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      // Institutional/sentiment ground-blockers: avoid what is being sold /
      // out-of-favor ↔ that IS the contrarian universe.
      'r-12': {
        state: 'needs_review',
        tensionReason: '"Avoid sectors in the news doghouse" — negative-sentiment sectors are the lagging/out-of-favor ground the archetype leans into (with a floor); a categorical sector exclusion carves it away.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      'i-02': {
        state: 'needs_review',
        tensionReason: '"Strictly avoid where institutions are net selling" (hard Level-1 filter) — washed-out names almost always show institutional distribution, so the filter excludes most legitimate contrarian entries; counter-reading: distribution ≠ oversold, and it filters garbage.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      'se-08': {
        state: 'needs_review',
        tensionReason: 'HARD entry gate on institutional ownership direction ("Only enter where ownership has increased/decreased over N quarters") — at the accumulating default it forbids out-of-favor entries outright.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      'i-07': {
        state: 'needs_review',
        tensionReason: 'Prefer sectors with institutional inflow — soft, but the direction is "fish where money is flowing in," the opposite of leaning lagging sectors.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      'i-01': {
        state: 'needs_review',
        tensionReason: 'Soft preference for institutional accumulation ("can still draft stocks without institutional backing") — mild anti-out-of-favor tilt, but explicitly non-binding and quality-flavored.',
        draftLeaning: 'neutral',
        zone1Ref: 'CN-Z1-BUY-WEAKNESS',
      },
      'a-08': {
        state: 'needs_review',
        tensionReason: 'Overweight sectors with POSITIVE sentiment = ride the loved narrative — sector-level strength-chasing ("what everyone is piling into").',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-DONT-CHASE',
      },
      'alloc-tier-preference': {
        state: 'needs_review',
        tensionReason: 'Param-swing rule: the Star-tier attribute select DEFAULTS to "high momentum" (chase — conflict direction) but offers "undervalued" (native direction). Classified by default direction per the param-independence policy; the swing is the review question.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CN-Z1-DONT-CHASE',
      },
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
      'sr-01': {
        state: 'needs_review',
        tensionReason: 'Trimming winners caps the upside leg of the volatility thesis (profit_locking family direction) — but a trim keeps the position and the family\'s conflict test targets TIGHT locks that preclude the thesis, which a partial rebalance does not.',
        draftLeaning: 'neutral',
        zone1Ref: 'SP-Z1-CHASE-VOL',
      },
      'a-05': {
        state: 'needs_review',
        tensionReason: 'The barbell MANDATES low-ATR anchors (un-zeroable: anchors min 1) — a standing "hold boring ballast" instruction against "I will not buy boring"; counter-reading: the anchors are survival ballast that licenses the rockets, Zone-2-flavored.',
        draftLeaning: 'neutral',
        zone1Ref: 'SP-Z1-NO-BORING',
      },
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
      // Forced-trading members, per-rule (the conflict-heavy mandatory set).
      'mb-03': { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' }, // stagnation-forced swaps = fast in/out churn, verbatim anti-patience
      'gs-09': {
        state: 'needs_review',
        tensionReason: 'Forces a swap of the worst performer after N consecutive negative cycles — reactive forced trading; counter-reading: a persistent portfolio bleed is not "noise", and acting on it is loss control, which the archetype owns.',
        draftLeaning: 'neutral',
        zone1Ref: 'CP-Z1-PATIENCE',
      },
      'ts-04': {
        state: 'needs_review',
        tensionReason: 'Continuous P&L-velocity tier rotation every N minutes = chasing the hottest thing at multiplier level — churn-as-strategy against patience-as-edge; counter-reading: tier reassignment moves no capital in or out of positions.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CP-Z1-NO-JUICE',
      },
      'ts-06': {
        state: 'needs_review',
        tensionReason: 'Demotes a flatlined Star — stagnation-reactive at tier level; counter-reading: a single demotion on a true flatline protects the multiplier without selling anything (holding through wobbles is untouched).',
        draftLeaning: 'neutral',
        zone1Ref: 'CP-Z1-PATIENCE',
      },
      'th-04': { state: 'core_conflict', zone1Ref: 'CP-Z1-NO-JUICE' }, // house-money: widen stops past protective bounds to chase the next tier
      'i-06': {
        state: 'needs_review',
        tensionReason: 'Targets crowded hedge-fund names explicitly for "explosive intraday moves" (with reversal risk) — juice-chasing flavor; counter-reading: the instruction pairs it with strict technical exits, and crowding itself is an ownership fact, not a volatility mandate.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CP-Z1-NO-JUICE',
      },
      // THE seeded-cell flags (ARCHETYPE_DEFAULT_TRAITS.guardian →
      // trait-diversifier → a-05, a-09). See EXPECTED_DRAFT_SEED_REVIEWS.
      'a-05': {
        state: 'needs_review',
        tensionReason: 'The barbell MANDATES high-ATR rockets (un-zeroable: rockets min 1, ATR floor ≥2.5%; the guardian SEED equips it at rockets:3 via trait-diversifier@moderate) — a standing "hold explosive names" instruction against "avoid high-ATR / won\'t chase the juice"; counter-reading: a bounded barbell is a recognized capital-preservation shape (anchors dominate, rockets are contained upside).',
        draftLeaning: 'core_conflict',
        zone1Ref: 'CP-Z1-NO-JUICE',
      },
      'a-09': {
        state: 'needs_review',
        tensionReason: 'Bench construction "include N high-ATR breakout candidates" — juice on the bench; counter-reading: high_upside is zeroable (min 0, default 1), bench-only until a swap fires, and the rule\'s primary instruction is cross-sector spread (safety-flavored).',
        draftLeaning: 'neutral',
        zone1Ref: 'CP-Z1-NO-JUICE',
      },
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
      // alone" test, applied to swap/selection targeting.
      'tv-15': {
        state: 'needs_review',
        tensionReason: '"Swap into the highest-ATR bench stock" — selection by volatility alone, no quality input; counter-reading: mid-battle swap targeting operates within an already quality-screened roster/bench.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'FI-Z1-WORK-NOT-TAPE',
      },
      'gs-06': {
        state: 'needs_review',
        tensionReason: '"Prioritize high-ATR bench stocks" when trailing — comeback selection by volatility alone; counter-reading: conditional game-state management, not standing entry logic.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'FI-Z1-WORK-NOT-TAPE',
      },
      'i-09': {
        state: 'needs_review',
        tensionReason: 'Prefer names accumulated by high-turnover transient funds BECAUSE they amplify intraday volatility — tape-first selection; counter-reading: it is an ownership-structure signal, and the quality floor still governs picks.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'FI-Z1-WORK-NOT-TAPE',
      },
      'gs-12': {
        state: 'needs_review',
        tensionReason: 'Final-evaluation priority for after-hours-catalyst names gated ONLY by ATR — a volatility-gated pick; counter-reading: one end-of-day evaluation, catalyst-driven rather than vol-driven.',
        draftLeaning: 'neutral',
        zone1Ref: 'FI-Z1-WORK-NOT-TAPE',
      },
      'th-04': {
        state: 'needs_review',
        tensionReason: 'House-money stop-widening to chase the next tier is tape-driven improvisation — tension with deliberate low-variance conviction; counter-reading: it is threshold-game stop management, not pick selection, and the audit\'s listing of it as an analyst conflict looks over-broad.',
        draftLeaning: 'neutral',
        zone1Ref: 'FI-Z1-WORK-NOT-TAPE',
      },
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
      'alloc-sector-minimum': {
        state: 'needs_review',
        tensionReason: 'A standing minimum to ONE named sector (default 20%, param up to 50%) is a deliberate structural overweight — concentration as an instruction; counter-reading: at low settings a floor in one sector does not make it dominant, and the 35% hard cap (rung 2) bounds the damage under enforce.',
        draftLeaning: 'core_conflict',
        zone1Ref: 'DV-Z1-SPREAD',
      },
      'sr-04': {
        state: 'needs_review',
        tensionReason: 'Pyramiding winners grows single positions unevenly — anti-spread direction; counter-reading: adds are small (default +2%), the library pairs it with position caps, and breadth is disturbed only at the margin.',
        draftLeaning: 'neutral',
        zone1Ref: 'DV-Z1-SPREAD',
      },
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
// EXPECTED DRAFT SEED REVIEWS (DRAFT_MODE only)
//
// The seeded-rule invariant (spec §4.5) requires every ARCHETYPE_DEFAULT_TRAITS
// rule to classify native/neutral for its archetype. These cells are seeded AND
// sit in needs_review — the exact situation the spec routes to human
// adjudication ("bug in seed map or classification — a human adjudicates
// which"). While DRAFT_MODE is true the invariant test tolerates EXACTLY this
// list (declared, no silent growth); the ship build tolerates none. Resolving
// these two cells (fix the seed kit, or the classification, or both) is a
// Phase 1 STOP decision — see the adjudication artifact.
// ─────────────────────────────────────────────────────────────────────────────
export const EXPECTED_DRAFT_SEED_REVIEWS = [
  { archetype: 'guardian', ruleId: 'a-05' }, // via trait-diversifier (seeded at rockets:3 @ moderate)
  { archetype: 'guardian', ruleId: 'a-09' }, // via trait-diversifier (1 high-ATR bench candidate @ default)
];

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
 * 'native' | 'neutral' | 'core_conflict' — plus 'needs_review' while
 * DRAFT_MODE is true. This is the Phase 2 block/warning predicate
 * (`classifyRule(id, arch) === 'core_conflict'`).
 */
export function classifyRule(ruleId, archetype) {
  return getRuleCompatInfo(ruleId, archetype).state;
}

/**
 * Every template id that classifies core_conflict for the archetype, with its
 * zone1Ref (for review tooling + the Phase 2 badge/warning surfaces).
 * needs_review entries are NOT conflicts and are excluded.
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
 * Every (archetype, ruleId) cell currently in needs_review — the Phase 1
 * adjudication work-list. Empty once the map ships (tested).
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
