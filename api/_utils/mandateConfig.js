// api/_utils/mandateConfig.js
//
// Spec 1 — Mandate Substrate — Phase 1 configuration constants.
// Pure data (Node-clean; no Firestore, no client). The single home for the
// numeric/enumerated constants Phase 1 needs; later-phase thresholds are added
// by the phase that first uses them (do-not-build-ahead).
//
// Spec: docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md · Charter:
// docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md (D-numbers refer to it).
//
// TERMINOLOGY (D-42, binding): a manager is *granted a mandate* (the term +
// the entity `mandates/{mandateId}`) and *runs a book* under it (the
// `portfolio` field). Both words are load-bearing.

// ── Schema versioning (Spec §2, F33) ────────────────────────────────────────
// Every durable record family carries `schemaVersion`, integer, starting at 1.
// One constant covers the mandate doc and its four subcollection families in
// Phase 1; a family that later diverges gets its own constant at that time.
export const MANDATE_SCHEMA_VERSION = 1;

// ── Starting capital (D-43 / O-3, RATIFIED) ─────────────────────────────────
// $10,000,000 virtual USD. Deliberately near-fictional for entertainment and
// attachment value; mechanically scale-invariant (all metrics are ratios).
// Binding caveat (D-43): at this scale fixed-bps frictions are IDEALIZED —
// receipts must label them so and never call them realistic (enforced by the
// friction model in P3, not here).
export const MANDATE_STARTING_CAPITAL = 10_000_000;

// NOTE ON A SPEC INCONSISTENCY (surfaced Phase 1): Spec §9 acceptance rows 5
// and 10 say the escape hatch "reset[s] to $100K". That is a stale figure from
// a pre-O-3 draft; O-3/D-43 RATIFY $10,000,000 as MANDATE_STARTING_CAPITAL and
// FR-3 says the escape replacement "starts fresh at MANDATE_STARTING_CAPITAL".
// This constant is the single source of truth; the P4 escape hatch reseeds from
// it. Flagged for founder confirmation in the Phase 1 PR.

// ── Quarter term + escape-hatch window (D-2, D-3, §5.2, §5.4) ───────────────
export const MANDATE_QUARTER_MONTHS = 3;              // three-month mandate term
export const MANDATE_ESCAPE_HATCH_WINDOW_DAYS = 14;   // first book only; createdAt + 14d

// ── Money precision (§4.1, F14) ─────────────────────────────────────────────
export const MANDATE_SHARES_DP = 6;   // shares to 6dp
export const MANDATE_USD_DP = 2;      // cash / USD to 2dp

// ── Gate configuration (D-44 / FR-6 + O-5 / §3.4) ───────────────────────────
// These VALUES are frozen into every published vintage's gateConfig block so a
// mid-quarter change cannot reach an active book — it propagates per-user at
// rollover (D-44). Phase 1 pins the DATA; P2 builds the enforcement
// (mandateSectorCap.js + the deterministic gate). The per-archetype sector cap
// is NOT here — it is read per-archetype from the pinned vintage payload
// (sourced from the registry's physics.sectorConcentrationCap), per O-5.
export const MANDATE_CASH_FLOOR_PCT = 0.02;                 // 2% cash floor (§3.4)
export const MANDATE_MIN_POSITIONS = 5;                     // construction target (§3.4, F9) — NOT an exit blocker
export const MANDATE_MAX_POSITIONS = 15;                    // hard position cap (§3.4)
// Max single-position weight: §3.4 names the gate but pins no numeric value.
// Provisional Phase-1 default; founder-tunable, propagates at rollover (D-44);
// P2 enforces it. Flagged in the Phase 1 PR as a spec gap filled with a default.
export const MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT = 0.35;
// The decision-tool verb set (§3.4). One action per decision; sized in dollars.
export const MANDATE_DECISION_VERBS = Object.freeze(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD']);

// ── Cadence tiers (D-19: cadence is an archetype property) ───────────────────
// The tier VALUES are pinned in the vintage (recomputed from the new vintage at
// rollover, §5.3). The archetype→tier mapping lives in mandateGenerationConfig.js.
export const MANDATE_CADENCE_TIERS = Object.freeze(['slow', 'standard', 'fast']);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — evaluation pipeline constants (§3.0–§3.5). Added by the phase that
// first uses them (do-not-build-ahead): the snapshot builder, the sweep/lease,
// the model seam, the deterministic gate, and the execution boundary. Numeric
// initials are the spec's; every one is founder-tunable and documented so.
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared universe snapshot (§3.0, HARD REQUIREMENT) ────────────────────────
// Build set = curated candidate universe ∪ all held tickers, hard-capped. The
// cap bounds the platform-wide fetch and the doc size regardless of user count
// (F12). Carry-over (delisted/removed-but-held) symbols count against the cap
// with priority over candidates (§3.0).
export const MANDATE_UNIVERSE_MAX_SYMBOLS = 300;

// Firestore's hard doc ceiling is 1MB; the build fails LOUDLY rather than
// silently truncating if a snapshot would exceed this budget. When approached,
// candidate symbols are dropped before held symbols (§3.0).
export const MANDATE_SNAPSHOT_MAX_BYTES = 800 * 1024; // 800KB

// Candidate-capacity floor (I11): the snapshot must retain at least this many
// non-held candidate symbols. Falling below logs MANDATE_UNIVERSE_DEGRADED and
// alerts — the cap must never silently convert the platform to sell-only by
// crowding candidates out with carry-overs.
export const MANDATE_MIN_CANDIDATE_CAPACITY = 100;

// Per-symbol freshness (I2): a held symbol is *actionable* only if it is
// present, `complete`, and its mark is no older than this. Stale/missing symbols
// are frozen (no action this eval, carry-over mark) — freshness is evaluated per
// symbol, never whole-book. Sized to accept a freshly-built tick snapshot (marks
// seconds old) while freezing a carry-over mark from a prior session-relative
// slot (slots are hours apart). Tunable.
export const MANDATE_MARK_MAX_AGE_MS = 20 * 60 * 1000; // 20 minutes

// ── Upstream quota accounting (§3.0 / Q5) ────────────────────────────────────
// Q5 found NO quota accounting anywhere in the repo; the book brings its own.
// The snapshot builder increments a daily upstream-call counter and alerts when
// it crosses a configured fraction of the account's daily ceiling. The ceiling
// mirrors the EODHD plan's ~100K/day documented in §3.0; both are tunable.
export const MANDATE_UPSTREAM_DAILY_CEILING = 100_000;
export const MANDATE_UPSTREAM_ALERT_FRACTION = 0.8; // alert at 80% of ceiling

// The fast layer chunks the build set into batched real-time quote calls so the
// scaling claim is literal (§3.0: "a handful of batched quote calls per tick —
// 300 symbols / batch-size per call"). One chunk == one counted upstream call.
export const MANDATE_QUOTE_BATCH_SIZE = 100; // 300-cap → ≤3 calls/tick

// ── Bounded sweep + owner-token lease (§3.1) ─────────────────────────────────
// Work is processed in bounded pages with a durable cursor in cronState, ordered
// by health.lastSuccessfulEvalAt ASC so the least-recently-served books go first
// and no tail starves (F24). Page size is bounded so a page always completes
// within the handler's time budget even with a per-book model call.
export const MANDATE_SWEEP_PAGE_SIZE = 25;

// The book's lease carries an owner token (invocation nonce); release and renewal
// are preconditioned on token match (§3.1, Q3). Correctness NEVER rests on the
// lease — every book mutation is a revision-preconditioned transaction (§3.5), so
// a stale writer's commit fails on mismatch regardless of lock state. The lease
// only prevents wasted duplicate work; its TTL matches the handler's maxDuration
// so a live invocation's lease is never seen as stale by a concurrent tick.
export const MANDATE_LEASE_TTL_MS = 300_000; // 300s (== handler maxDuration)

// ── Model seam / harvest validation (§3.3) ───────────────────────────────────
// A harvested result is applied only if its age is within this bound (condition
// 4 of harvest validation). Cross-session results are already rejected by the
// sessionDate check (condition 3); this bounds within-session staleness and is
// the age past which a result reaches the `expired` terminal state. In direct
// transport (P2) a result is produced and consumed in the same tick, so this is
// satisfied trivially; it bites under batch transport (P5). Tunable.
export const MANDATE_RESULT_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

// Price-drift guard (I3): if the harvest mark has moved more than this many bps
// from the submit mark, the decision is `rejected_stale` with the drift recorded
// — the manager never fills at a price materially different from the one it
// reasoned over. In direct transport submit and harvest share a tick (drift ≈ 0);
// the guard is exercised by the unit test with divergent ticks and bites in P5.
export const MANDATE_PRICE_DRIFT_MAX_BPS = 150;

// (Liveness alerting — the stale-rejection streak threshold and the
// executedVsSubmitted floor, I9/§6.4 — is a P3 concern: the health/quarantine
// pass first consumes it. Not added here, per this file's do-not-build-ahead rule.
// The P2 exec path already maintains execState.submitted/executed for it.)

// ── Prompt / context budget (§3.2 / §6.3) ────────────────────────────────────
// The assembled prompt-input token budget, enforced pre-send. The §6.3 envelope
// sizes the mandate manager at ~12K in / ~600 out; 14K gives headroom for the
// scaffold + context + snapshot without approaching the model's window. Tunable.
export const MANDATE_EVAL_INPUT_TOKEN_BUDGET = 14000;

// The number of curated candidate symbols surfaced to the manager per eval is a
// config constant (§3.2), NOT the whole snapshot — the prompt carries a bounded
// candidate slate, not all ~300 build-set symbols.
export const MANDATE_PROMPT_CANDIDATE_COUNT = 40;

// ── Friction (§4.1) — IDEALIZED, zeroed in P2 ────────────────────────────────
// P2 executes at the harvest mark with ZERO friction; the market-cap-tier spread
// proxy and slippage model land in P3 (§4.1), which bumps the model version. The
// receipt still carries the honesty labels (D-15 / O-3): spread is a modeled
// proxy, never observed; frictions are idealized and model no market impact.
export const MANDATE_P2_SLIPPAGE_BPS = 0;
export const MANDATE_P2_SPREAD_PROXY_BPS = 0;
export const MANDATE_FRICTION_MODEL_VERSION = 'p2_zero_friction';
export const MANDATE_FRICTION_SPREAD_BASIS = 'proxy';                  // §4.1 label
export const MANDATE_FRICTION_BASIS = 'idealized_no_market_impact';    // §4.1 / O-3 label

// ── Execution invariants (§3.5) ──────────────────────────────────────────────
// The atomic execution transaction asserts cash ≥ 0 within this tight rounding
// tolerance (USD); a violation aborts and writes `failed`.
export const MANDATE_VALUE_RECONCILE_TOLERANCE_USD = 0.01;

// Value-conservation tolerance (§3.5): `newTotalValue === preTotalValue − Σfriction`
// accumulates a few independent 2dp roundings (cost, cash, friction), so the
// conservation check uses a slightly looser tolerance than the cash-floor check.
// A real share/cash mis-record moves totalValue by ≫ this, so it still fires; only
// legitimate rounding noise is absorbed. At $10M scale 5¢ is ~5e-9 relative.
export const MANDATE_VALUE_CONSERVE_TOLERANCE_USD = 0.05;
