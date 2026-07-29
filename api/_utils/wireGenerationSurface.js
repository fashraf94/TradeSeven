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
//   - rankingConfig.js — 800-line shared config; only ALL_TICKERS touches
//     generation (via the consensus block). Hard-failing on every unrelated
//     edit is the over-broad-manifest failure mode. Known residual hole.
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
export function assessRegen(prevSection, nextSection) {
  if (!prevSection) {
    return { allowed: true, reason: 'no committed baseline (first generation)' };
  }
  const contentChanged = prevSection.hash !== nextSection.hash;
  const versionChanged = prevSection.version !== nextSection.version;
  if (contentChanged && !versionChanged) {
    return {
      allowed: false,
      reason:
        `content changed but version is still ${JSON.stringify(prevSection.version)} — ` +
        'bump the constant (F-M1), then regenerate',
    };
  }
  return { allowed: true, reason: contentChanged ? 'content + version changed' : 'no content change' };
}
