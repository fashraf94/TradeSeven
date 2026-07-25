// src/data/ruleSupportStatus.js
//
// C-20 HONESTY GATE — per-rule support status.
//
// Founder ruling C-20: "only support and display rules that can actually be
// detected, verified, and enforced." This module is the single source of truth
// for which of the 143 Forge rule templates may be OFFERED to a user.
//
// ── WHY THIS LIVES OUTSIDE forgeKnowledgeBase.js (load-bearing) ──────────────
// FORGE_RULE_TEMPLATES is a HASHED REGISTRY INPUT: archetypeRegistry.js
// getRegistryCorpus() (:132) feeds the corpus into computeIdentityHash(),
// which strips only `ruleLibraryVersion` (:156) and canonically hashes
// everything else (:157). Adding a `supportStatus` field to the templates
// would therefore change the §2.3 identityHash, break the CI lock in
// archetypeRegistry.test.js ("FAILS when composed registry content changes
// without an ARCHETYPE_IDENTITY_VERSION bump"), and — per Authoring Guide §1 —
// invalidate every authored compat cell whose kernelIdentityHash was stamped
// against the old hash. That is a full matrix re-verdict for a DISPLAY-ONLY
// field with zero identity change: exactly the failure mode Amendment Sheet C
// item C-3 exists to prevent.
//
// Keeping support status in a sibling map means the corpus stays byte-identical
// and the registry hash is untouched. (Founder-ruled, Jul 25 2026.)
//
// FUTURE FORMAL HOME (logged, C-3): presentationHash is the eventual owner of
// presentation-class content like this. It is specified in Amendment Sheet C
// item C-3 but NOT IMPLEMENTED at HEAD (zero production references). When it
// lands, this map is a natural first client and may migrate into the corpus
// under presentationHash coverage without touching identityHash.
//
// ── STATUS VOCABULARY ────────────────────────────────────────────────────────
//   supported                → detectable, verifiable, offerable. Displays.
//   hidden_absent_substrate  → primary mechanism cites a signal that does not
//                              exist on any running path. Hidden until built.
//   hidden_unwired           → signal is real and persisted but no agent path
//                              reads it. Hidden until the wire lands. Fails
//                              C-20's "detected" test today; cheapest to fix.
//   mode_scrapped            → season-mode template; season scrapped per C-19.
//   deprecated               → structurally vacuous or superseded.
//
// Only `supported` rules are OFFERED (browse, search, recommenders, presets).
// Every status resolves normally by id, so an already-equipped rule NEVER
// strands — see isSupported/filterSupported usage notes below.
//
// Basis: Signal Inventory V2 (SIG-001…043 @ a04a291d) + the five accepted
// Phase 3 metadata batches + the Rule Support Triage V1.0 worklist, as amended
// by the Phase 0 discovery rulings of Jul 25 2026.

export const SUPPORT_STATUS_VALUES = Object.freeze([
  'supported',
  'hidden_absent_substrate',
  'hidden_unwired',
  'mode_scrapped',
  'deprecated',
]);

/**
 * Statuses that must never be OFFERED to a user (browse, search, recommend,
 * preset). They remain fully resolvable by id for existing equips.
 */
export const NOT_OFFERED_STATUSES = Object.freeze([
  'hidden_absent_substrate',
  'hidden_unwired',
  'mode_scrapped',
  'deprecated',
]);

// ── hidden_absent_substrate (14) ─────────────────────────────────────────────
// Primary mechanism cites a signal absent from every running path.
// Verified rule-by-rule in the Phase 0 discovery against Signal Inventory V2,
// applying the C-13 primary/secondary/exception tiering: a rule is hidden only
// when the ABSENT signal sits in the PRIMARY tier.
const HIDDEN_ABSENT_SUBSTRATE = [
  // Intraday-indicator family — 5-min RSI/MACD, VWAP-as-selection, sigma-bands,
  // reclaim pattern, intraday range position. None exist (Signal Inventory V2
  // §3B). The 5-min bars and one 5-min indicator (sma20_5m, SIG-038) do ship,
  // so this is a COMPUTATION gap, not a data gap — cheapest family to revive.
  'mb-05',  // swap-in gate: daily VWAP + 5-min MACD — both legs absent
  'mb-14',  // news/indicator confirmation — ALL THREE param options are 5-min
  't-09',   // pullback to VWAP (candidate selection) — VWAP is held-only
  't-10',   // >Nσ beyond VWAP — no sigma computation exists anywhere
  'tv-04',  // bench VWAP-reclaim — reclaim pattern absent AND bench VWAP absent
  'tv-07',  // bottom-of-intraday-range patience — range position absent
  'tv-09',  // liquidity sweep incl. VWAP recovery (RVOL leg is real)

  // Score-vs-par family — no par concept exists (Signal Inventory V2 §3B).
  // RE-PREDICATION NOTE: the live state block already renders own score AND the
  // SPY/QQQ/BTC macro line together (agentEvalPromptAssembly.js:884-890), so
  // these three un-hide via a copy-only re-predication onto that comparison.
  'gs-04',  // par-score posture — par is its ONLY signal
  'gs-05',  // defensive when leading par
  'gs-06',  // aggressive when trailing par (C-13: par is in the PRIMARY tier)

  // Regime / volatility.
  // RE-PREDICATION NOTE (r-10): "elevated volatility" DOES have a real
  // substrate — volatilityRegime (compute-index-intelligence.js:565, persisted
  // :873) is decisive inside classifyMarketPosture (agentRegimeClassifier.js:
  // 72-84) and renders as `MARKET POSTURE: defensive`. r-10 un-hides by
  // re-predicating onto that, or by rendering volatilityRegime directly.
  'r-10',                       // "elevated market volatility" — no VIX meter
  'risk-volatility-avoidance',  // vs SECTOR-AVERAGE volatility — absent
                                // (corroborated by the code's own
                                // `sectorVolatility: null, // TODO`)

  // Calendar-backed.
  'f-13',   // C-13: earnings dates are the REQUIRED primary; they reach no
            // running path. Beat-rate override is the secondary tier.
  'a-10',   // doubly absent: macro calendar is agent-blind (SIG-043) AND no
            // sector-sensitivity table exists. Already predicateDefined:false.
];

// ── hidden_unwired (14) ──────────────────────────────────────────────────────
// The signal is REAL, computed and persisted — but no agent decision path reads
// it, so the agent cannot detect it. Fails C-20's "detected" test today.
// Founder ruling Jul 25: all Class B goes dark until the mirror wire lands.
const HIDDEN_UNWIRED = [
  // The fundamental family. Every metric below is persisted on
  // peerRankings/{ticker} (compute-rankings.js:1343-1378) — a document NO agent
  // path reads. agent-evaluate.js reads only stockTechnicalScores (:885) and
  // indexIntelligence/stockRankings (:889). One mirror wire unlocks all 12.
  'fund-earnings-surprise',  // beatRate :1368 / avgSurpriseMag :1369
  'fund-revenue-growth',     // revenueGrowthYOY :1344
  'fund-value-pe',           // trailingPE :1352
  'fund-bank-pb',            // priceBookMRQ :1354 (+ industry, now available)
  'fund-financial-health',   // debtToEquity :1363 + solvency siblings
  'fund-market-cap',         // marketCap :1377 (raw value; no class buckets)
  'f-07',                    // beatRate + surprise magnitude
  'f-08',                    // fcfYield :1355
  'f-09',                    // debtToEquity vs sectorMedian :1320
  'f-10',                    // per-sector valuation selection
  'f-11',                    // revenue-growth acceleration
  'f-12',                    // earningsRevisions :1372

  // Institutional — derivable, not derived.
  'i-04',   // ownership concentration: no computed field, but totalSharesPct
            // (institutionalIntelligence.js:205) + topHolderShares (:188-189)
            // make it a few lines of derivation.

  // Industry taxonomy — the cheapest unlock in the corpus.
  'r-07',   // sub-industry cap. TICKER_TO_INDUSTRY (rankingConfig.js:439-449)
            // has 100% coverage (239/239 tickers, 54 industries) and is
            // PERSISTED per stock as industryName
            // (compute-index-intelligence.js:998) on the doc BOTH agent paths
            // already load — but it is rendered in no prompt (the code comment
            // at :997 says "inert to decide.js"). Needs ONE render line, no new
            // read. Un-hides immediately once rendered.
];

// ── deprecated (1) ───────────────────────────────────────────────────────────
const DEPRECATED = [
  'risk-single-stock-limit',  // structurally vacuous — the game has no position
                              // sizing (Batch 1 finding; founder-ruled).
];

// ── mode_scrapped (26) ───────────────────────────────────────────────────────
// Season mode scrapped permanently per founder ruling C-19. These are every
// template carrying modes:'season'. NOTE: GameModePolicy's ruleModeGate governs
// BACKEND admission (activationGate.js:48, compileBuild.js:242) — it does NOT
// suppress display, so before this gate these cards were reachable via
// RuleDirectory browse/search and ForgeScreen in 'all' mode.
const MODE_SCRAPPED = [
  'se-01', 'se-02', 'se-03', 'se-04', 'se-05', 'se-06', 'se-07', 'se-08',
  'sx-01', 'sx-02', 'sx-03', 'sx-04', 'sx-05', 'sx-06', 'sx-07',
  'sr-01', 'sr-02', 'sr-03', 'sr-04', 'sr-05',
  'ss-01', 'ss-02', 'ss-03', 'ss-04', 'ss-05', 'ss-06',
];

function buildStatusMap() {
  const map = {};
  for (const id of HIDDEN_ABSENT_SUBSTRATE) map[id] = 'hidden_absent_substrate';
  for (const id of HIDDEN_UNWIRED) map[id] = 'hidden_unwired';
  for (const id of DEPRECATED) map[id] = 'deprecated';
  for (const id of MODE_SCRAPPED) map[id] = 'mode_scrapped';
  return Object.freeze(map);
}

/**
 * Explicit non-supported statuses, keyed by ruleId. Any template id absent from
 * this map is `supported` — see getSupportStatus. Kept as an exception map so
 * the completeness test asserts against the live corpus rather than a hand-kept
 * list of 143 that would silently rot.
 */
export const RULE_SUPPORT_STATUS = buildStatusMap();

/**
 * Support status for a rule id. Unknown/absent ids resolve to 'supported',
 * which is the correct default for user-authored and agent-learned rules that
 * never appear in the corpus.
 *
 * @param {string} ruleId
 * @returns {string} one of SUPPORT_STATUS_VALUES
 */
export function getSupportStatus(ruleId) {
  return RULE_SUPPORT_STATUS[ruleId] || 'supported';
}

/**
 * May this rule be OFFERED to a user (browse, search, recommender, preset)?
 *
 * NOT the same question as "may it resolve". Already-equipped rules must always
 * resolve by id so an existing build never strands — call this ONLY on
 * enumeration/offer paths, never on lookup-by-id paths.
 *
 * @param {string} ruleId
 * @returns {boolean}
 */
export function isSupported(ruleId) {
  return getSupportStatus(ruleId) === 'supported';
}

/**
 * Filter a template array down to offerable rules. Accepts template objects or
 * bare id strings.
 *
 * @param {Array<{id: string}|string>} templates
 * @returns {Array} the offerable subset, order preserved
 */
export function filterSupported(templates) {
  if (!Array.isArray(templates)) return [];
  return templates.filter((t) => isSupported(typeof t === 'string' ? t : t?.id));
}
