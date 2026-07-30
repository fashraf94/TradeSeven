// api/_utils/wireGenerationSurface.js
// FantasyTimes Wire — the GENERATION_SURFACE path manifest (Phase 2 Spec
// V1.2 F-M2, V1.3 D-P2-9 / Amendment G) and the pure helpers behind the
// committed-baseline content lock (P2-15).
//
// THE CONTRACT. Every path listed in GENERATION_SURFACE shapes what a
// FantasyTimes reporter model is sent: prompt constants, tool schemas and
// their per-seam extension, the closed contract vocabularies, consensus and
// continuity prompt scaffolding, the ticker universes that select prompt
// content, the per-seam model/sampling table, the transport wrapper, and
// the request-constructing seam files themselves. A diff inside any of them
// without a WIRE_GENERATION_VERSION bump fails CI: the lock test
// (wireGenerationSurface.test.js) recomputes content hashes and compares to
// the committed baseline (wireGenerationBaseline.json), and the regen path
// REFUSES to produce a fresh baseline while the version constant is
// unchanged — so the bump is mechanically unavoidable, not reviewer-honor
// (the archetypeRegistry identityHash precedent; a git-diff test is
// CI-impossible here, discovery Amendment G: fetch-depth 1).
//
// The same baseline binds wireDigest.js to WIRE_DIGEST_RENDERER_VERSION and
// wireValidator.js to WIRE_VALIDATOR_VERSION — each its own epoch input
// (Spec V1.2 N0: gateEpoch resets on any generation/validator/renderer
// change), each with the same change-without-bump enforcement.
//
// EXCLUDED, deliberately (recorded per discovery D9's false-positive
// finding; founder review at the P1 checkpoint):
//   - wireDigest.js / wireValidator.js — covered by their OWN version
//     constants in the renderer/validator sections below, not by
//     WIRE_GENERATION_VERSION.
//   - wireWriteThrough.js / wireReplaySweep.js — persistence machinery;
//     their generation-relevant inputs (schema, digest, validator) are
//     version-bound separately.
//   - rankingConfig.js — 800-line shared config, EXCLUDED at file level by
//     founder ruling (P1 review closeout): file-level inclusion would let
//     every ranking tweak reset gateEpoch and the Phase 3 gate window.
//     Instead its generation-touching EXPORTS are value-locked below
//     (GENERATION_VALUE_EXPORTS): the export's canonical VALUE is hashed
//     into the same baseline, so universe content changes fail the lock and
//     force a WIRE_GENERATION_VERSION bump while unrelated rankingConfig
//     edits touch nothing. Not a residual hole anymore.
//   - art-director.js / fantasyTimesVisuals.js — visual pipeline; cannot
//     change one character of story prose (discovery D9).
//   - poll-batch.js — result retrieval; constructs no request.
//   - Firestore-state channels (continuity digests at one-cycle lag,
//     indexIntelligence prose) — the genuine no-diff blind spot, named in
//     the spec; a path manifest cannot see state.

import { createHash } from 'node:crypto';

// Repo-relative, sorted. Adding/removing a path changes the surface hash —
// manifest edits themselves require a bump.
//
// Note on mixed-concern inclusions (fantasyTimesConsensus.js, ingestedClaims.js):
// each pairs a Firestore-reading half (buildConsensusBlock / getClaimsForReporter
// — the state channel a path manifest cannot see) with a static prompt-FORMATTER
// half (buildConsensusBlock's template / formatClaimsForPrompt) whose output is
// appended verbatim to the reporter userMessage at five seams. The formatter is
// generation-bearing, so the file is included whole; editing the data-read half
// forces a conservative-but-harmless bump. (P1 code-review finding, confirmed:
// ingestedClaims.js was a false-negative hole in the v1 manifest.)
export const GENERATION_SURFACE = Object.freeze([
  'api/_utils/fantasyTimesConsensus.js',
  'api/_utils/fantasyTimesPrompts.js',
  'api/_utils/fantasyTimesTickers.js',
  'api/_utils/ingestedClaims.js',
  'api/_utils/stockIntelligenceData.js',
  'api/_utils/wireContinuity.js',
  'api/_utils/wireContracts.js',
  'api/_utils/wireGenerationConfig.js',
  'api/_utils/wireGenerationSurface.js',
  'api/_utils/wireModelCall.js',
  'api/_utils/wireSchemaExtension.js',
  'api/fantasytimes/generate-column.js',
  'api/fantasytimes/generate-econ.js',
  'api/fantasytimes/generate-macro.js',
  'api/fantasytimes/generate-mover.js',
  'api/fantasytimes/generate-pulse.js',
  'api/fantasytimes/generate-recap.js',
  'api/fantasytimes/ingest-deepdive.js',
  'api/fantasytimes/scan-movers.js',
  'api/fantasytimes/submit-earnings-batch.js',
]);

// ── Value-level locks (founder ruling, P1 review closeout) ────────────────
// Exports whose VALUE is generation-bearing while their host file is too
// broad for the path manifest. Each is hashed by canonical value into
// generationSurface.files under a `value:` key, bound to
// WIRE_GENERATION_VERSION exactly like a file entry.
//
//  - rankingConfig#ALL_TICKERS — the exact set the consensus block consumes
//    (fantasyTimesConsensus.js:9): rankCatalysts significance weighting
//    (:247, orders the catalysts buildConsensusBlock renders into reporter
//    prompts) + checkEarningsAttribution (:441).
//  - rankingConfig#TICKER_TO_SECTOR — the D8 Wire universe consumed by
//    wireValidator.js:21 (isInWireUniverse): membership changes alter
//    validation outcomes, primaryTicker survival, and the digest's subject
//    fallback with no diff in any hashed file. Bound HERE (generation
//    version) rather than to WIRE_VALIDATOR_VERSION, which is semantically
//    live on every stamped entry and must not bump for a lock-mechanism
//    change; the joint-bump is epoch-consistent per the wireContracts note.
//    RATIFIED at FINAL LOCK (Jul 29) with a recorded caveat: the
//    generation-version binding governs the LOCK MECHANISM, but a
//    TICKER_TO_SECTOR content change is a VALIDATION-behavior change — when
//    this lock fires, WIRE_VALIDATOR_VERSION bumps ALONGSIDE
//    WIRE_GENERATION_VERSION so each stamp is truthful about its own axis.
//    Enforced mechanically: assessTickerUniverseCaveat refuses a regen that
//    carries a TICKER_TO_SECTOR value change without a validator bump.
export const GENERATION_VALUE_EXPORTS = Object.freeze([
  Object.freeze({ key: 'value:api/_utils/rankingConfig.js#ALL_TICKERS', exportName: 'ALL_TICKERS' }),
  Object.freeze({ key: 'value:api/_utils/rankingConfig.js#TICKER_TO_SECTOR', exportName: 'TICKER_TO_SECTOR' }),
]);

/** Canonical serialization for value hashing: arrays keep their order (a
 *  ticker-list reorder can reorder prompt content — conservative, locked);
 *  object keys sort (a cosmetic literal reorder is not a universe change). */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** sha256 of one export's canonical value, salted with its lock key. */
export function hashValueExport(key, value) {
  return createHash('sha256').update(`${key}\n`).update(stableStringify(value)).digest('hex');
}

export const BASELINE_PATH = 'api/_utils/wireGenerationBaseline.json';

/** sha256 of one file's content, salted with its repo-relative path so a
 *  rename never aliases. */
export function hashFile(relPath, content) {
  return createHash('sha256').update(`${relPath}\n`).update(content).digest('hex');
}

/** The aggregate surface hash: sha256 over the sorted per-file hashes. */
export function surfaceHash(fileHashes) {
  const h = createHash('sha256');
  for (const key of Object.keys(fileHashes).sort()) {
    h.update(`${key}:${fileHashes[key]}\n`);
  }
  return h.digest('hex');
}

/**
 * Regen gate — pure, unit-testable (P2-15's second direction). Given the
 * previously COMMITTED baseline section and the freshly computed one,
 * decide whether regeneration is permitted.
 *
 * The rule: content changed + version unchanged → REFUSED. You cannot
 * produce a green baseline without bumping the constant first.
 *
 * @returns {{ allowed: boolean, reason: string }}
 */
/**
 * Strictly-forward version comparison, uniform over the integer
 * generationVersion and the dotted-semver validator/renderer versions
 * (coerced via String().split('.')). Returns true ONLY when `next` is
 * greater than `prev` — equal is not a bump, and a DOWNGRADE is not a bump
 * (P2+N0 review finding: a directionless `!==` accepted a validator
 * downgrade as satisfying the required bump).
 */
export function versionIncreased(prev, next) {
  if (prev === undefined || next === undefined) return false;
  const a = String(prev).split('.').map(Number);
  const b = String(next).split('.').map(Number);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (y > x) return true;
    if (y < x) return false;
  }
  return false; // equal
}

export function assessRegen(prevSection, nextSection) {
  if (!prevSection) {
    return { allowed: true, reason: 'no committed baseline (first generation)' };
  }
  const contentChanged = prevSection.hash !== nextSection.hash;
  // A bump must move the version FORWARD — an unchanged OR downgraded version
  // does not license a content change (review finding: downgrade slipped past
  // the old directionless `!==`).
  const versionForward = versionIncreased(prevSection.version, nextSection.version);
  if (contentChanged && !versionForward) {
    return {
      allowed: false,
      reason:
        `content changed but version did not move forward (still/down from ${JSON.stringify(prevSection.version)}) — ` +
        'bump the constant forward (F-M1), then regenerate',
    };
  }
  return { allowed: true, reason: contentChanged ? 'content + forward version bump' : 'no content change' };
}

const TICKER_UNIVERSE_KEY = 'value:api/_utils/rankingConfig.js#TICKER_TO_SECTOR';

/**
 * The FINAL-LOCK ratification caveat (founder, Jul 29), made mechanical:
 * a TICKER_TO_SECTOR content change is a VALIDATION-behavior change, so the
 * regen that absorbs it must carry a WIRE_VALIDATOR_VERSION bump alongside
 * the WIRE_GENERATION_VERSION bump — each stamp truthful about its own axis.
 *
 * @param {object|null} prevBaseline — the committed baseline (full doc)
 * @param {object} next — the freshly computed sections
 * @returns {{ allowed: boolean, reason: string }}
 */
export function assessTickerUniverseCaveat(prevBaseline, next) {
  if (!prevBaseline) return { allowed: true, reason: 'first generation' };
  const prevHash = prevBaseline.generationSurface?.files?.[TICKER_UNIVERSE_KEY];
  const nextHash = next.generationSurface?.files?.[TICKER_UNIVERSE_KEY];
  const universeChanged = prevHash !== undefined && prevHash !== nextHash;
  // Must be a FORWARD validator bump — a downgrade (or equal) does not
  // satisfy the caveat (review finding: `!==` accepted 1.6.0 -> 1.5.0).
  const validatorBumped = versionIncreased(prevBaseline.validator?.version, next.validator?.version);
  if (universeChanged && !validatorBumped) {
    return {
      allowed: false,
      reason:
        'TICKER_TO_SECTOR changed — a validation-behavior change. Bump ' +
        'WIRE_VALIDATOR_VERSION alongside WIRE_GENERATION_VERSION (FINAL-LOCK ' +
        'ratification caveat, Jul 29), then regenerate',
    };
  }
  return { allowed: true, reason: universeChanged ? 'universe + validator version changed' : 'universe unchanged' };
}
