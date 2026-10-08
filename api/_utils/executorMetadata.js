// api/_utils/executorMetadata.js
//
// Integrity build — client-forged proposal data (7 Oct 2026; founder decision
// F2). What may reach the executor's `evaluationMetadata`, the ninth argument
// of executeSwapServer (api/_utils/agentSwapExecution.js, fenced — read, never
// edited). The executor spreads that object onto the trade row AFTER its own
// computed fields, so any key it carries lands on `trades[]` as written — and
// `bankedScore` sums `trades[].lockedPoints`. Before this build two production
// callers spread an owner-written record into it (a planted `lockedPoints:
// 9999` became score). See docs/audits/20261007_BUILD_INTEGRITY_PROPOSAL_FORGERY.md.
//
// THE RULES, enforced at every production executor call:
//   1. The metadata is built by `executorMetadata({…})` — only the keys of
//      EXECUTOR_METADATA_KEYS survive, in the caller's own order (the off
//      goldens record the writer argument byte for byte). The allowlist is
//      disjoint from the executor's computed row keys, so metadata can never
//      override a price, the points, a symbol, the slot or the day.
//   2. Ids and the trading day come from the server's own values.
//   3. A descriptive string read from a client-writable record (a battle's
//      `strategyPreset` / `executionMode`, a pending proposal, a meeting leg)
//      passes through `clientText` / `clientToken`: a string, capped; anything
//      else is dropped. A number, an object or an id from such a record never
//      reaches the row.
// api/cron/agent-evaluate.executorMetadata.guard.test.js fails CI when a call
// site breaks any of the three.
//
// ZERO product imports: pure, so no suite's module mocks can reach it.

/**
 * The documented metadata keys (the executor's JSDoc: id, action, trigger,
 * rationale, hypothesis, evaluationId, tradingDay) plus every key a server path
 * legitimately passes today — the census in the build report §1.
 */
export const EXECUTOR_METADATA_KEYS = Object.freeze([
  'id', 'action', 'trigger', 'rationale', 'hypothesis', 'evaluationId', 'tradingDay',
  'entryRegime', 'entryMarketPosture', 'entryConviction', 'entryPreset', 'entryMode', 'exitReason',
  'swapMotive', 'source', 'archetype', 'hftKnobsSource', 'swapProvenance', 'trade_reasoning',
]);

/** The trade row keys the executor computes itself (agentSwapExecution.js, the closedTrade literal). */
export const EXECUTOR_COMPUTED_KEYS = Object.freeze([
  'symbolOut', 'symbolIn', 'name', 'tier', 'slotIndex', 'entryPrice', 'exitPrice', 'lockedPoints', 'lockedGainPct',
  'swappedOutAt', 'swapDay', 'isCrypto', 'direction', 'snapshot', 'verification',
]);

/** Cap for free text read from a client-writable record (a rationale, a hypothesis, a trigger list). */
export const CLIENT_TEXT_MAX = 1000;
/** Cap for a short label read from a client-writable record (a preset, a mode, a regime, a motive). */
export const CLIENT_TOKEN_MAX = 64;

const ALLOWED = new Set(EXECUTOR_METADATA_KEYS);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A string from a client-writable record, capped; anything that is not a string → null. */
export function clientText(value, max = CLIENT_TEXT_MAX) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

/** A short label from a client-writable record (CLIENT_TOKEN_MAX); anything that is not a string → null. */
export function clientToken(value) {
  return clientText(value, CLIENT_TOKEN_MAX);
}

/**
 * The executor metadata: the allowlisted keys of `fields`, in `fields`' own
 * order. A key outside the allowlist is dropped (the guard test fails CI on
 * the call site that wrote it). Frozen: the executor only reads it, and a
 * later `Object.assign` / member write onto it — the shape that reopens the
 * exploit (review IV4-I4-2) — throws instead of reaching the row.
 */
export function executorMetadata(fields) {
  const out = {};
  if (isPlainObject(fields)) {
    for (const key of Object.keys(fields)) {
      if (ALLOWED.has(key)) out[key] = fields[key];
    }
  }
  return Object.freeze(out);
}

/** The next trade id, from the battle's own trade counter — the form every caller mints. */
export function serverTradeId(battle) {
  return `trade_${String((battle?.scoreState?.tradeCount || 0) + 1).padStart(3, '0')}`;
}

/**
 * A pending proposal's evaluation id, as the SERVER recorded it: the id names a
 * retained `evaluations[]` entry (server-written, never owner-writable) that
 * decided PROPOSAL for the same pair. A proposal the server never made — or
 * whose deciding entry has aged out — gets null: the row then carries no
 * evaluation id, and P6 derives no verification id from it.
 */
export function serverProposalEvaluationId(battle, proposal) {
  return serverProposalDecision(battle, proposal)?.evalId ?? null;
}

/**
 * The server's own record of the decision behind a pending proposal: the
 * retained `evaluations[]` entry (server-written) that decided PROPOSAL for the
 * same pair under the id the proposal names — or null. Its fields (the id, the
 * decision instant) are the server's, never the proposal's.
 */
export function serverProposalDecision(battle, proposal) {
  const claimed = proposal?.evaluationMetadata?.evaluationId ?? proposal?.evalId;
  if (typeof claimed !== 'string' || !claimed) return null;
  const entries = Array.isArray(battle?.evaluations) ? battle.evaluations : [];
  return entries.find((e) => e?.evalId === claimed && e.decision === 'PROPOSAL'
    && typeof e.symbolIn === 'string' && e.symbolIn === proposal?.symbolIn
    && typeof e.symbolOut === 'string' && e.symbolOut === proposal?.symbolOut) ?? null;
}

/** The model's structured reasoning from a client-writable record: its strings only (no conviction number). */
function clientReasoning(value) {
  if (!isPlainObject(value)) return null;
  const out = {};
  for (const key of ['thesis', 'strategy']) {
    const text = clientText(value[key]);
    if (text !== null) out[key] = text;
  }
  for (const key of ['indicators', 'citedRules']) {
    if (Array.isArray(value[key])) out[key] = value[key].filter((s) => typeof s === 'string').slice(0, 20).map((s) => s.slice(0, 200));
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The descriptive fields a pending proposal's stored metadata may contribute —
 * the proposal is owner-writable, so ONLY strings, type-checked and capped
 * (and the reasoning's strings). Ids, the day, the conviction number, the
 * receipt source, the exit reason, the dial provenance and every executor
 * field are never read from it: the caller supplies them from the server.
 */
export function proposalDescriptiveMetadata(proposal) {
  const meta = isPlainObject(proposal?.evaluationMetadata) ? proposal.evaluationMetadata : {};
  const out = {};
  for (const key of ['trigger', 'rationale', 'hypothesis']) {
    if (Object.hasOwn(meta, key)) out[key] = clientText(meta[key]);
  }
  for (const key of ['entryRegime', 'entryMarketPosture', 'swapMotive']) {
    if (Object.hasOwn(meta, key)) out[key] = clientToken(meta[key]);
  }
  for (const key of ['entryPreset', 'entryMode']) {
    const token = clientToken(meta[key]);
    if (token) out[key] = token;
  }
  if (Object.hasOwn(meta, 'trade_reasoning')) out.trade_reasoning = clientReasoning(meta.trade_reasoning);
  return out;
}
