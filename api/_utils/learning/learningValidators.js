// api/_utils/learning/learningValidators.js
//
// Agent Learning System — L1 Foundation, Phase 2.
// Write-path validators for the raw receipt. Source of truth: Build Spec §3 +
// ANNEX A5 (closed enums, fail closed).
//
// Every exported validator returns { valid: boolean, errors: string[] } and
// never throws (the visionValidators.js convention). Callers decide how to
// react — the capture path EXCLUDES and LOGS an invalid receipt, never silently
// accepts it (Signal Capture Rider posture; ANNEX A5 fail-closed contract).

import { RECEIPT_SOURCES, RECEIPT_EXIT_REASONS } from './learningEnums.js';

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function inSet(value, set, fieldName, errors) {
  if (!set.includes(value)) {
    errors.push(`${fieldName}: expected one of [${set.join(', ')}], got ${JSON.stringify(value)} (fail closed — excluded, never coerced)`);
    return false;
  }
  return true;
}

function requireString(value, fieldName, errors) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${fieldName}: expected non-empty string, got ${JSON.stringify(value)}`);
    return false;
  }
  return true;
}

/**
 * Validate a raw receipt before it is written.
 *
 * The load-bearing check (ANNEX A5): `source` and `exitReason` MUST be members
 * of their closed enums. Anything outside the enum FAILS CLOSED — the receipt is
 * invalid, and the caller excludes + logs it (never silently accepts, never
 * coerces the value). `EMERGENCY_BYPASS_REASONS` is deliberately NOT the
 * exclusion set — the enums here are the whole contract.
 *
 * Also checks the minimal identity fields a receipt cannot be ordered/attributed
 * without. Does NOT validate any derived/estimator field — there are none in L1.
 *
 * @param {unknown} receipt
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateReceipt(receipt) {
  const errors = [];

  if (!isPlainObject(receipt)) {
    return { valid: false, errors: ['receipt: expected object'] };
  }

  // Closed enums — fail closed. This is the whole point of the validator.
  inSet(receipt.source, RECEIPT_SOURCES, 'source', errors);
  inSet(receipt.exitReason, RECEIPT_EXIT_REASONS, 'exitReason', errors);

  // Archetype identity (Corpus Capture Patch W1) — string | null REQUIRED in
  // shape; any other type/absence fails closed. VALUE membership is
  // deliberately NOT checked here: it is warn-only at the capture seam
  // (captureSwapReceipt), because an unknown archetype id must never cause a
  // receipt drop — a lost receipt is worse than an odd label.
  if (receipt.archetype !== null && (typeof receipt.archetype !== 'string' || receipt.archetype.length === 0)) {
    errors.push(`archetype: expected non-empty string or null, got ${JSON.stringify(receipt.archetype)}`);
  }

  // Minimal identity — a receipt with no agent/battle/order is unattributable.
  requireString(receipt.agentId, 'agentId', errors);
  requireString(receipt.battleId, 'battleId', errors);
  if (typeof receipt.receiptSeq !== 'number' || !Number.isInteger(receipt.receiptSeq) || receipt.receiptSeq < 1) {
    errors.push(`receiptSeq: expected integer >= 1, got ${JSON.stringify(receipt.receiptSeq)}`);
  }
  requireString(receipt.symbolIn, 'symbolIn', errors);
  requireString(receipt.symbolOut, 'symbolOut', errors);

  return { valid: errors.length === 0, errors };
}
