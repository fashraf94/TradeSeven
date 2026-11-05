// api/_utils/activationEvidence/constants.js
//
// ID-1 Build 2 — THE OBSERVER'S NAMED LIMITS (build prompt V3 §3; contract
// docs/design/20261104_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_7.md §4.3–§4.4).
// Pure: numbers and names only, no imports with behaviour.
//
// The store's own provider timeout (setupEvidence/acquire.js ACQUIRE_TIMEOUT_MS,
// 5 s) is restated here because this module must stay importable by the census,
// which may not load the store's write-capable modules. constants.test.js pins the
// two equal, and the store's lease length likewise.

/** The store's provider request timeout (setupEvidence/acquire.js ACQUIRE_TIMEOUT_MS). */
export const STORE_ACQUIRE_TIMEOUT_MS = 5_000;
/** The store's claim lease (setupEvidence/store.js LEASE_MS): live while |now − claimedAt| < this. */
export const STORE_LEASE_MS = 120_000;

/** The tenant's own slice, from its start. */
export const OBSERVER_SLICE_MS = 20_000;
/** From the handler's start: an ADMISSION deadline, not a completion bound (TIME_BUDGET_MS stays 50 s; maxDuration 120 s is the hard stop). */
export const OBSERVER_ADMISSION_CEILING_MS = 80_000;
/** A run with less than this until its deadline defers with no read. */
export const MIN_RUN_MS = 15_000;
/** From the tenant's start: no preparation read starts after it. */
export const PREP_BUDGET_MS = 6_000;
/** A store call starts only with at least this much left before the deadline. */
export const ADMISSION_RESERVE_MS = STORE_ACQUIRE_TIMEOUT_MS + 2_000;
/** A pointer transaction starts only with at least this much left. */
export const POINTER_WRITE_RESERVE_MS = 2_000;
/** Below this the state write is skipped (fairness degrades; no pointer changes). */
export const STATE_WRITE_RESERVE_MS = 1_000;
/** Store calls in flight at once, distinct keys only. */
export const ACQUISITION_CONCURRENCY = 3;
/** Store calls started per run. */
export const MAX_ACQUISITIONS_PER_RUN = 12;
/** Page limit of each owner's candidate query. */
export const MAX_CANDIDATE_IDS_PER_OWNER = 200;
/** Battle documents read per run. */
export const MAX_BATTLES_PER_RUN = 25;
/** Tick documents read per battle per run (a five-session battle has about 180). */
export const MAX_TICK_DOCS_PER_BATTLE = 400;
/** Pointer transactions per run, with and without evidence together. */
export const MAX_POINTER_WRITES_PER_RUN = 30;
/** Outstanding keys kept in state for the next run. */
export const MAX_CARRIED_KEYS = 50;
/** The candidate query's createdAt lower bound. */
export const CANDIDATE_LOOKBACK_DAYS = 14;
/** Days after a battle's cutoff before its outstanding work is abandoned. */
export const CATCH_UP_HORIZON_DAYS = 3;
/** After a swap's swappedOutAt, how long a missing tick join defers before it reads `unavailable`. */
export const TICK_GRACE_MS = 1_800_000;

/** The battle fields the observer and the census read (a field mask: nothing else leaves Firestore). */
export const BATTLE_FIELDS = Object.freeze([
  'agentId', 'ownerId', 'status', 'gameMode', 'isCpu', 'createdAt', 'activatedAt', 'expiresAt', 'timing.tradingDays',
  'portfolio.star', 'portfolio.core', 'portfolio.support',
  'agentContext.archetype', 'agentContext.initialPortfolio',
  'agentContext.equippedHypothesis.watchlistId', 'agentContext.equippedHypothesis.hypothesisVersion', 'agentContext.equippedHypothesis.contentHash',
  'agentContext.equippedWatchlist.tickers',
  'trades', 'scoreState.tradeCount',
]);
/** The tick fields the join reads. */
export const TICK_FIELDS = Object.freeze(['tickSeq', 'evalId', 'actions']);

/** Battle documents per getAll during preparation, so the preparation budget can cut between chunks. */
export const BATTLE_READ_CHUNK = 5;

export const DAY_MS = 86_400_000;

/** The pointer record's version (contract §4, ratified V1.6). */
export const POINTER_SCHEMA_VERSION = 1;
/** The observer state document's version (contract §4.4). */
export const STATE_SCHEMA_VERSION = 1;
/** The one snapshot schema this observer knows (setupEvidence/acquire.js SNAPSHOT_SCHEMA_VERSION). */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Collections (contract §4, §4.4). */
export const ACTIVATIONS_SUBCOLLECTION = 'activations';
export const OBSERVER_STATE_COLLECTION = 'activationObserverState';
export const OBSERVER_STATE_DOC = 'main';

/** The Trend Follower's archetype id (agentArchetypeConfig.js; Phase 0 §C). */
export const TREND_FOLLOWER_ARCHETYPE = 'momentum_chaser';
/** The owner's tiered slots (contract §2). The opponent's holdings and the bench are never activations. */
export const OWNER_TIERS = Object.freeze(['star', 'core', 'support']);

/** Exclusion reasons, in the contract §2 precedence: a battle meeting several is counted under the first. */
export const EXCLUSIONS = Object.freeze(['game_mode', 'cpu', 'training_clone', 'archetype']);

/** Why an activation is never written (contract §4.1). */
export const UNRESOLVED_REASONS = Object.freeze(['inconsistent', 'class_unknown', 'gap', 'instant_malformed', 'symbol_form']);

/** activatedAtSource values (contract §4). */
export const ACTIVATED_AT_SOURCES = Object.freeze(['trade_row', 'position_swappedInAt', 'outgoing_receipt', 'battle_activatedAt']);
