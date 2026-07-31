// api/_utils/wireEntryGuard.js
// FantasyTimes Wire — the N1.4 fail-closed consumer guard (Phase 2 Spec
// V1.5 R4-M2 ordered state machine; V1.3 STOP-3 resolution; Amendment J).
//
// Every Wire CONSUMER classifies an entry before trusting it. Four
// consumers, all routed through here (V1.3 §0 STOP-3): buildContinuityContext,
// resolveChainId's candidate reads, rebuildIndexes, and the N1 newsLine
// projection. The guards land DARK, before the continuity flip — that
// ordering is the point of the resequenced §4.
//
// THE ORDERED EVALUATION (R4-M2 — order is normative, not stylistic):
//   1. All epoch fields absent            → LEGACY (renderable, Amendment J:
//      absent version fields mean pre-stamp legacy — fail-closed applies to
//      unknown NON-legacy values only, otherwise the deploy boundary would
//      blank the historical corpus).
//   2. schemaVersion present + recognized → completeness vs THAT version's
//      required set → STAMPED (or MALFORMED if the set is incomplete).
//   3. Otherwise                          → fail closed:
//        · VERSION_SKIP — a version this build doesn't recognize (a vN+1
//          entry at a vN consumer). Never "malformed": that word is for
//          shapes no writer ever produced (P2-30 permutation).
//        · MALFORMED — partial epoch stamps, missing required facts,
//          entries that aren't entries.
//
// Renderable = LEGACY | STAMPED. Everything else is skipped + logged by the
// consumer (never a throw — corruption of one entry must not take down a
// tick, the P3 analog).

import {
  RECOGNIZED_WIRE_SCHEMA_VERSIONS,
  RECOGNIZED_WIRE_DIGEST_RENDERER_VERSIONS,
} from './wireContracts.js';

export const WIRE_ENTRY_STATES = Object.freeze({
  LEGACY: 'legacy',
  STAMPED: 'stamped',
  VERSION_SKIP: 'version_skip',
  MALFORMED: 'malformed',
});

// Amendment J's "missing": undefined OR explicit null (the repo's legacy
// sentinel convention — entry.generationConfig uses explicit null for the
// same class). No writer stamps a version field null.
const absent = (v) => v === undefined || v === null;

const verdict = (state, schemaVersion, reason) =>
  Object.freeze({ state, schemaVersion: schemaVersion ?? null, reason: reason ?? null });

/**
 * Classify one persisted Wire entry per the R4-M2 ordered state machine.
 *
 * @param {object} entry — a persisted day-doc entry
 * @param {object} [registries] — injection surface for the P2-30
 *   vN/vN+1 permutation tests (and for a future consumer that recognizes a
 *   different version set). Production call sites pass nothing.
 * @returns {{ state: string, schemaVersion: string|null, reason: string|null }}
 */
export function classifyWireEntry(entry, {
  schemaVersions = RECOGNIZED_WIRE_SCHEMA_VERSIONS,
  rendererVersions = RECOGNIZED_WIRE_DIGEST_RENDERER_VERSIONS,
} = {}) {
  if (entry === null || typeof entry !== 'object') {
    return verdict(WIRE_ENTRY_STATES.MALFORMED, null, 'not_an_entry');
  }
  const facts = entry.agentFacts;
  if (facts === null || typeof facts !== 'object') {
    // Every Wire entry has carried agentFacts since Phase 1 — the Wire IS
    // the typed channel. An entry without them is corruption, not legacy.
    return verdict(WIRE_ENTRY_STATES.MALFORMED, null, 'missing_agent_facts');
  }

  const sv = facts.schemaVersion;
  const rv = facts.digestRendererVersion;

  // (1) LEGACY — all epoch fields absent.
  if (absent(sv) && absent(rv)) {
    return verdict(WIRE_ENTRY_STATES.LEGACY, null, null);
  }

  // Partial epoch stamp (renderer version without a schema version): no
  // writer version ever produced this shape — corruption, fail closed.
  if (absent(sv)) {
    return verdict(WIRE_ENTRY_STATES.MALFORMED, null, 'partial_epoch_stamp');
  }

  // (2) Version guard BEFORE the field-set check (R4-M2: "unknown-but-present
  // versions fail closed at the version guard before the field-set check
  // runs").
  const spec = schemaVersions[sv];
  if (!spec) {
    return verdict(WIRE_ENTRY_STATES.VERSION_SKIP, sv, `unrecognized_schema_version:${sv}`);
  }

  // Completeness against THAT version's required set — never the consumer's
  // current one.
  for (const key of spec.requiredFacts) {
    if (absent(facts[key])) {
      return verdict(WIRE_ENTRY_STATES.MALFORMED, sv, `missing_required:${key}`);
    }
  }
  // The digest is what consumers actually render — presence is not enough.
  if (typeof facts.digest !== 'string' || facts.digest.length === 0) {
    return verdict(WIRE_ENTRY_STATES.MALFORMED, sv, 'invalid_digest');
  }

  // Renderer-version trust (N1.4: unknown digestRendererVersion is never
  // rendered on trust). Value-recognition, distinct from the presence check
  // above — an unknown-but-present version is a VERSION_SKIP, not corruption.
  if (!absent(rv) && !rendererVersions.includes(rv)) {
    return verdict(WIRE_ENTRY_STATES.VERSION_SKIP, sv, `unrecognized_renderer_version:${rv}`);
  }

  return verdict(WIRE_ENTRY_STATES.STAMPED, sv, null);
}

/** True iff a classification permits render/serve (LEGACY or STAMPED). */
export function isRenderableState(state) {
  return state === WIRE_ENTRY_STATES.LEGACY || state === WIRE_ENTRY_STATES.STAMPED;
}

/** True iff a consumer may render/serve this entry (LEGACY or STAMPED). */
export function isRenderableWireEntry(entry, registries) {
  return isRenderableState(classifyWireEntry(entry, registries).state);
}

/**
 * The uniform "skipped + logged" line (N1.4) — one warn per skipped entry,
 * same shape at every consumer so the log is greppable by context.
 */
export function warnSkippedWireEntry(context, entry, classification) {
  console.warn(
    `[${context}] N1.4 guard: skipping entry ${entry?.storyId ?? '<unknown>'} ` +
    `(${classification.state}): ${classification.reason}`
  );
}
