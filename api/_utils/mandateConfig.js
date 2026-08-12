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
