// src/constants/profitTargetPromise.js
//
// Exit-Behavior Rebalance Tier 2, Ask 1 — the ONE source of the profit-target
// promise copy (§9 display-agreement: Ask 3's promise surface and Ask 1's are
// the same string by construction, never two wordings drifting).
//
// The LIVE copy carries the physics ruled in F2/R2 — next-eval cadence,
// trigger-gating (a quiet stretch can defer the fire), swap-not-sell,
// replacement availability, LOCK carve-out, one-exit-per-eval — plus the
// precedence disclosure ruled at the Ask 3 review (finding A4): protective
// actions take precedence, and a deferred protective exit can delay a target
// by one evaluation cycle. §9 applies to this prose: no claim the engine
// does not deliver.
//
// Consumers select on PROFIT_TARGET_EXECUTOR_ENABLED at their own read sites
// (the flag is NOT read here — this module is pure strings, safe under every
// hermetic featureFlags mock).

export const PROFIT_TARGET_PROMISE_DARK =
  'Lock in gains once a position reaches this return.';

export const PROFIT_TARGET_PROMISE_LIVE =
  'Sells by swapping into the best eligible bench name at the next evaluation once gain from entry reaches this %. '
  + 'Evaluations tick ~every 15 min in market hours but only run on market triggers — a quiet stretch can defer the fire, '
  + 'as can no eligible replacement or a position locked near a bonus threshold. '
  + 'Protective actions take precedence — a deferred protective exit can delay a target by one evaluation cycle. '
  + 'One exit per evaluation.';
