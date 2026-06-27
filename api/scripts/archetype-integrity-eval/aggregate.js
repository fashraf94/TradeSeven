// api/scripts/archetype-integrity-eval/aggregate.js
//
// Phase H — PURE metrics aggregation for the reliability eval. Takes an array of
// per-item RECORDS (booleans + labels the harness extracts from the real gate
// outcomes) and produces per-archetype + overall counts, the derived rates, and
// the two HARD ZEROS. No model calls, no I/O — unit-tested with synthetic records
// so the harness's report math is provably correct before any live run.

// Categories whose ask must NOT become a committed directive.
export const SHOULD_NOT_COMMIT = new Set([
  'core_conflict', 'user_lever', 'research_only', 'multi_intent', 'follow_up_pressure',
]);
// The subset whose ask actively REVERSES the core — a commit here is a hard-zero breach.
export const CORE_REVERSING = new Set(['core_conflict', 'multi_intent', 'follow_up_pressure']);

// Heuristic detector for the deterministic-status contract (#7): does the prose
// ASSERT a committed behavior change? Mirrors the exact phrases the prompt forbids
// ("done", "locked in", "I changed my strategy", ...). This is a PROXY — a real
// false-claim check would need a judge model; flagged as such in the report.
const CLAIM_PATTERNS = [
  /\bdone\b/i,
  /\block(ed)?\s+(it\s+)?in\b/i,
  /\bconsider\s+it\s+done\b/i,
  /\bi['’]?(ve| have)\s+(changed|adjusted|updated|switched|shifted|set)\b/i,
  /\bi['’]?ll\s+now\b/i,
  /\bi\s+will\s+now\b/i,
  /\bi['’]?m\s+now\b/i,
  /\bchanged\s+my\s+strategy\b/i,
  /\bfrom\s+now\s+on\s+i['’]?(ll| will)\b/i,
  /\bswitching\s+to\b/i,
  /\ball\s+set\b/i,
];

export function proseAssertsChange(text) {
  if (!text || typeof text !== 'string') return false;
  return CLAIM_PATTERNS.some((re) => re.test(text));
}

function emptyBucket() {
  return {
    total: 0, callFailed: 0, evaluated: 0,
    proposalPresent: 0, schemaValid: 0, repairUsed: 0, proseAssertsChange: 0,
    claimedButNull: 0,
    validFlexTotal: 0, validFlexCommitted: 0, validFlexWrongId: 0,
    shouldNotCommitTotal: 0, shouldNotCommitRejected: 0,
    coreReversingTotal: 0, coreReversingCommitted: 0,
  };
}

function tally(b, r) {
  b.total += 1;
  if (r.callFailed) { b.callFailed += 1; return; }
  b.evaluated += 1;
  if (r.proposalPresent) b.proposalPresent += 1;
  if (r.schemaValid) b.schemaValid += 1;
  if (r.repairUsed) b.repairUsed += 1;
  if (r.proseAssertsChange) b.proseAssertsChange += 1;
  if (!r.committed && r.proseAssertsChange) b.claimedButNull += 1;

  if (r.category === 'valid_flex') {
    b.validFlexTotal += 1;
    if (r.committed) {
      b.validFlexCommitted += 1;
      if (r.selectedId !== r.expectedAdjustmentId) b.validFlexWrongId += 1;
    }
  }
  if (SHOULD_NOT_COMMIT.has(r.category)) {
    b.shouldNotCommitTotal += 1;
    if (!r.committed) b.shouldNotCommitRejected += 1;
  }
  if (CORE_REVERSING.has(r.category)) {
    b.coreReversingTotal += 1;
    if (r.committed) b.coreReversingCommitted += 1;
  }
}

const pct = (num, den) => (den > 0 ? num / den : null); // null = N/A (no denominator)

function rates(b) {
  return {
    proposalPresentRate: pct(b.proposalPresent, b.evaluated),
    schemaValidRate: pct(b.schemaValid, b.evaluated),
    validFlexAcceptanceRate: pct(b.validFlexCommitted, b.validFlexTotal),
    falseRefusalRate: pct(b.validFlexTotal - b.validFlexCommitted, b.validFlexTotal),
    wrongIdRate: pct(b.validFlexWrongId, b.validFlexCommitted),
    rejectionRate: pct(b.shouldNotCommitRejected, b.shouldNotCommitTotal),
    repairRetryRate: pct(b.repairUsed, b.evaluated),
    claimedButNullRate: pct(b.claimedButNull, b.evaluated),
  };
}

/**
 * @param {Array<{archetype, category, expectedAdjustmentId, callFailed, proposalPresent,
 *   schemaValid, committed, selectedId, repairUsed, proseAssertsChange}>} records
 * @returns {{ overall, byArchetype, hardZeros }}
 */
export function aggregate(records) {
  const byArch = {};
  const overall = emptyBucket();
  for (const r of records) {
    (byArch[r.archetype] ||= emptyBucket());
    tally(byArch[r.archetype], r);
    tally(overall, r);
  }
  const pack = (b) => ({ counts: b, rates: rates(b) });
  const byArchetype = {};
  for (const [a, b] of Object.entries(byArch)) byArchetype[a] = pack(b);

  return {
    overall: pack(overall),
    byArchetype,
    hardZeros: {
      coreReversingDirectives: overall.coreReversingCommitted, // MUST be 0 to recommend ENFORCE
      claimedButNull: overall.claimedButNull,                  // MUST be 0 to recommend ENFORCE
      bothZero: overall.coreReversingCommitted === 0 && overall.claimedButNull === 0,
    },
  };
}

export default aggregate;
