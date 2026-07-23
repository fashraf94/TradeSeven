// api/_utils/canonicalHash.js
//
// Archetype Architecture Phase 2 (P2.1) — the ONE canonical content-hash
// helper for every Phase-1-spec hash: CompiledBuild.contentHash,
// sourceRevisionVector.bundleContentHashes, identityHash (§2.3),
// gameModePolicyHash (A-2), calibration-bundle hash (§4.3).
//
// Canonical form: JSON with recursively SORTED object keys (Firestore returns
// map keys alphabetized, so insertion order must never affect a hash —
// the same rule update-agent-settings.js applies to its idempotence check).
// Array order IS preserved (it is meaningful: ruleIds, ruleSnapshots).
// undefined properties are dropped; undefined array slots serialize as null
// (both mirror JSON.stringify semantics).
//
// Node-clean by construction (node:crypto only) — safe under the BUILD_RULES
// §4 import rule for any api/ or test consumer.

import { createHash } from 'node:crypto';

export function stableStringify(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v) ?? 'null').join(',')}]`;
  }
  const body = Object.keys(value)
    .sort()
    .map((k) => {
      const v = stableStringify(value[k]);
      return v === undefined ? undefined : `${JSON.stringify(k)}:${v}`;
    })
    .filter((s) => s !== undefined)
    .join(',');
  return `{${body}}`;
}

/**
 * sha256 hex digest of the canonical form. The digest is stable across
 * key-insertion order, process, and platform — two structurally equal inputs
 * always hash identically.
 */
export function canonicalContentHash(value) {
  const canonical = stableStringify(value);
  return createHash('sha256').update(canonical ?? 'undefined', 'utf8').digest('hex');
}
