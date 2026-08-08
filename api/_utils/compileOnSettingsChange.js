// api/_utils/compileOnSettingsChange.js
//
// Archetype Architecture Phase 2 (P2.4a) — the equip-time compile helper the
// ten settings endpoints call, DARK behind COMPILER_ENABLED=false. When the
// flag is false BOTH entry points return null before touching anything:
// zero added Firestore reads, zero added writes, responses byte-identical
// (the mastery-profile "zero added I/O while dark" precedent,
// equip-bundle.js:106-110).
//
// When enabled, the compile runs INSIDE the endpoint's existing
// runTransaction and rides the SAME structural settingsRev increment
// (founder ruling, P2.0 approval #3): the endpoint's txUpdateAgentSettings
// bumps rev N→N+1 and the CompiledBuild docs written here carry
// sourceRevisionVector.settingsRev = N+1 — A-3's "the compile mints the
// revision", with no second counter.
//
// Storage home (P2.0-confirmed, founder-approved):
//   agents/{agentId}/compiledBuilds/{gameMode}
// Client access is denied by the firestore.rules default-deny catch-all
// (:886-888) — no rules addition, no manual deploy while dark; an explicit
// match block rides the Phase-4 UX PR.
//
// LIVE-CORPUS HONESTY (§5.6): rule metadata comes from the live
// forgeKnowledgeBase templates and compat cells from the live map. Today no
// template carries the §5.6 fields and unclassified cells resolve via
// fallthrough, so every enabled compile records validation.pass=false with
// the missing-metadata errors — the truthful pre-authoring state. Nothing
// is defaulted; the P2.4b deploy path refuses invalid/stale builds, and the
// production flag-flip is separately gated on activationGate going green.

import {
  FORGE_RULE_TEMPLATES,
} from '../../src/data/forgeKnowledgeBase.js';
import { getRuleCompatInfo } from '../../src/data/archetypeRuleCompatibility.js';
import { getCandidateCompatCell, toCompilerCompatCell } from '../../src/data/archetypeCompatibilityCandidate.js';
import { COMPOSITION_COMPILED_IDENTITY_ENABLED } from './compositionConfig.js';
// PR 3.5 (B4-TRAIT): THE shared effective-host projection — the same
// selection kernel the migration planner/scanner uses (no second semantics).
import { projectHostedRuleDocs } from './compositionMigration.js';
import { canonicalContentHash } from './canonicalHash.js';
import { compileBuild } from './compileBuild.js';
import { buildPlatformGuardrails } from './platformGuardrails.js';
import {
  LIVE_DEPLOY_MODES,
  getGameModePolicy,
  computeGameModePolicyHash,
} from './gameModePolicy.js';
import {
  ARCHETYPE_IDENTITY_VERSION,
  RULE_LIBRARY_VERSION,
  CALIBRATION_BUNDLE_VERSION,
} from './archetypeVersionConstants.js';
import { computeIdentityHash, CANDIDATE_IDENTITY_VERSION } from './archetypeRegistry.js';
import {
  ACTIVATION_COLLECTION, ACTIVATION_DOC_ID, readActivationDescriptor,
} from './compositionProductionLoader.js';

/**
 * Sol pre-activation review #11 (genesis-present contract): the candidate
 * cell-source selection is RECORD-SCOPED, not flag-scoped. The flag stays
 * the DARK switch (off ⇒ zero reads, zero behavior change — A23); when lit,
 * THE RECORD decides (A48): candidate cells ONLY when the activation record
 * selects the candidate version. Post-genesis the record always exists —
 * genesis (live version, no candidate) resolves the LIVE map, exactly like
 * pre-genesis; a rollback-to-genesis therefore also restores live-cell
 * compiles even though the flag never lowers (the F5 split-brain closed at
 * this boundary). Malformed records fail closed to the LIVE map here: this
 * is a cell-SOURCE selector for user saves, and live is the conservative
 * source (the activation writer and loader carry the loud fail-closed).
 */
export async function resolveCandidateModeInTx(tx, db, { enabled = COMPOSITION_COMPILED_IDENTITY_ENABLED } = {}) {
  if (!enabled) return false; // dark: zero reads (A23)
  try {
    const snap = await tx.get(db.collection(ACTIVATION_COLLECTION).doc(ACTIVATION_DOC_ID));
    const descriptor = readActivationDescriptor(snap);
    return descriptor?.activeIdentityVersion === CANDIDATE_IDENTITY_VERSION;
  } catch {
    return false; // malformed record → the LIVE map (conservative cell source)
  }
}

// §5.1 metadata fields lifted from a corpus template when (Phase 3+) they
// exist. `modes` is pre-existing corpus data and present today.
const METADATA_FIELDS = [
  'intendedMode', 'copyClass', 'receiptTag', 'contentClass', 'secondaryEffects',
  'detectorSource', 'guardrailBinding', 'missingDataFallback', 'modes',
];

let templateById = null;
function metadataForRule(ruleId) {
  if (!templateById) {
    templateById = new Map(FORGE_RULE_TEMPLATES.map((t) => [t.id, t]));
  }
  const t = templateById.get(ruleId);
  if (!t) return undefined; // unknown rule → compiler records metadata_missing
  const meta = {};
  for (const f of METADATA_FIELDS) {
    if (t[f] !== undefined && t[f] !== null) meta[f] = t[f];
  }
  return meta;
}

/**
 * A-4 compat cell per unique equipped rule snapshot, for the target archetype.
 *
 * KEY-SPACE (the defect this shape prevents): each cell is keyed by the
 * snapshot's DOC id (`snap.id`) — the id compileBuild rehydrates rules under
 * (compileBuild.js:160) — but the compat LOOKUP uses the TEMPLATE id
 * (`snap.sourceRef`). The compat map is keyed by forgeKnowledgeBase template id
 * (archetypeRuleCompatibility.js:40-41); `snap.id` is the Firestore rule doc id
 * (forgeService.js:482), NEVER a template id, so looking a cell up by it
 * resolves every rule `via:'fallthrough'`. The correct pairing is the one
 * ruleCompatClassify.js:45-46 already uses. A `via:'fallthrough'` result is
 * ABSENCE (A-4) — compileBuild records it as a missing cell, never a verdict —
 * so manual/free-text rules (sourceRef null, outside the map) correctly land
 * there without leaking a spurious neutral.
 */
export function resolveEquippedCompatCells(bundles, archetype, {
  // PR 3 (spec §7 row 3): the CANDIDATE registry becomes the compat source
  // when the compiled-identity flag lights. toCompilerCompatCell(null) is
  // null, and compileBuild treats a null cell as ABSENCE (A-4) — so a rule
  // outside the candidate universe (manual free-text) lands compat_cell_missing
  // under either source. Dark (default): the legacy map, byte-identical.
  candidateMode = COMPOSITION_COMPILED_IDENTITY_ENABLED,
} = {}) {
  const compatCells = {};
  for (const bundle of bundles ?? []) {
    for (const snap of bundle.ruleSnapshots ?? []) {
      if (!snap?.id || compatCells[snap.id] !== undefined) continue;
      compatCells[snap.id] = candidateMode
        ? toCompilerCompatCell(getCandidateCompatCell(snap.sourceRef, archetype))
        : getRuleCompatInfo(snap.sourceRef, archetype);
    }
  }
  return compatCells;
}

/**
 * PR 3.5 (B4-TRAIT) — normalize the unified host projection into the
 * compiler's input rows. ONE selection source (projectHostedRuleDocs — the
 * planner/scanner kernel); this function only reshapes: doc-authority
 * payload + host provenance. Compat cells resolve by TEMPLATE id
 * (doc.sourceRef) and key by DOC id — the same key-space convention as
 * resolveEquippedCompatCells; a manual rule (sourceRef null) resolves to a
 * null cell and lands compat_cell_missing (A-4: coverage never silently
 * shrinks).
 */
export function buildProjectedCompileInputs({ agent, ruleDocs, allBundles, archetype }) {
  const hosted = projectHostedRuleDocs({
    agent: { archetype, equippedTraits: agent?.equippedTraits ?? [] },
    ruleDocs: ruleDocs ?? [],
    bundles: allBundles ?? [],
  });
  const projectedRules = [];
  const compatCells = {};
  const ruleMetadata = {};
  for (const { doc, hosting } of hosted) {
    projectedRules.push({
      id: doc.id,
      sourceRef: doc.sourceRef ?? null,
      paramValues: doc.paramValues ?? null,
      params: doc.params ?? null,
      ...(hosting.channel === 'trait'
        ? { hostTraitId: hosting.traitId }
        : { hostBundleId: hosting.bundles[0]?.bundleId ?? hosting.bundles[0]?.id ?? null }),
    });
    compatCells[doc.id] = toCompilerCompatCell(getCandidateCompatCell(doc.sourceRef, archetype));
    const meta = metadataForRule(doc.sourceRef ?? doc.id);
    if (meta !== undefined) ruleMetadata[doc.id] = meta;
  }
  // Deterministic content hash over the projected payloads — the freshness
  // vector component that makes a trait-doc or draft-bundle edit STALE a
  // candidate build (the equipped-bundle hashes alone cannot see them).
  const sorted = [...projectedRules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const projectedRulesHash = canonicalContentHash(sorted);
  return { projectedRules, compatCells, ruleMetadata, projectedRulesHash };
}

// The registry identityHash is content-static per deploy; memoized so the
// (flag-on) first compile pays the one canonicalization, and dark endpoints
// never pay it at all. Exported: the P2.4b deploy gate
// (deployBuildValidation.js) verifies stored vectors against the SAME
// memoized value the compiler stamps — one source, no drift.
let cachedIdentityHash = null;
export function registryIdentityHash() {
  if (cachedIdentityHash === null) cachedIdentityHash = computeIdentityHash();
  return cachedIdentityHash;
}

/**
 * Phase-1 of the two-call protocol: transactional READS (Firestore requires
 * every read before the first write). Call after the endpoint's own reads,
 * before its writes. Returns { bundles } or null when disabled.
 *
 * Takes agentRef and derives the bundles collection ONLY after the enabled
 * gate — callers must never pre-evaluate `agentRef.collection(...)` in the
 * argument list, or the dark path stops being a true no-op (endpoint test
 * fakes without `.collection` would 500 — the exact byte-identity break the
 * flag exists to prevent).
 */
export async function prepareCompileInputs(tx, {
  agentRef,
  // Sol review #11: the db handle for the RECORD-SCOPED candidate selection
  // (resolveCandidateModeInTx). Endpoints pass it; when absent AND no
  // explicit candidateMode is given, the legacy flag default applies (unit
  // fixtures that drive the compiler directly) — production call shapes are
  // pinned by the endpoint suites' genesis-present rows.
  db = null,
  nextEquippedBundleIds,
  enabled = false,
  // PR 3.5 (B4-TRAIT): the unified host projection needs the FULL behaving
  // surface — every rule doc + every bundle (projectActiveRules' universe),
  // not just the equipped bundles. Reads are DOUBLY dark: they run only when
  // the compiler is enabled AND the candidate selection is on. #11: the
  // selection is the RECORD's (candidate version active), never bare flag —
  // pass candidateMode explicitly ONLY for candidate-scoped pipeline tooling
  // (the runbook step-5 {candidateStateId, activeIdentityVersion: 3} scope).
  candidateMode = undefined,
} = {}) {
  if (!enabled) return null;
  const mode = candidateMode !== undefined
    ? candidateMode
    : (db ? await resolveCandidateModeInTx(tx, db) : COMPOSITION_COMPILED_IDENTITY_ENABLED);
  const ids = (nextEquippedBundleIds ?? []).filter(Boolean);
  const bundlesCol = ids.length > 0 || mode ? agentRef.collection('bundles') : null;
  let bundles = [];
  if (ids.length > 0) {
    const snaps = await tx.getAll(...ids.map((id) => bundlesCol.doc(id)));
    for (const snap of snaps) {
      if (!snap.exists) continue; // a dangling id compiles as an absent bundle
      bundles.push({ bundleId: snap.id, ...snap.data() });
    }
  }
  if (!mode) return { bundles, candidateMode: false };
  const [rulesSnap, allBundlesSnap] = await Promise.all([
    tx.get(agentRef.collection('rules')),
    tx.get(bundlesCol),
  ]);
  const ruleDocs = rulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const allBundles = allBundlesSnap.docs.map((d) => ({ id: d.id, bundleId: d.id, ...d.data() }));
  return { bundles, ruleDocs, allBundles, candidateMode: true };
}

/**
 * Phase-2 of the protocol: compile for every live deploy mode and WRITE the
 * CompiledBuild docs inside the same transaction. Call adjacent to the
 * endpoint's txUpdateAgentSettings. Returns the client preview payload
 * (per-mode) or null when disabled.
 *
 * nextState carries the POST-write values the endpoint is committing —
 * the compile describes the build the user just saved, not the one that
 * existed before this transaction.
 *
 * revision (A-3 discipline):
 *   'mint'    (default) — the settings-endpoint case: the caller's
 *             txUpdateAgentSettings bumps rev N→N+1 in this same
 *             transaction and the builds carry N+1.
 *   'current' — the deploy-path validate-or-recompile case (P2.4b): no
 *             source mutation happened, so NO revision is minted and no
 *             agent-doc write occurs — the artifact is re-derived for the
 *             CURRENT rev (a stale artifact re-derived at rev N is the
 *             same buildVersion N; phantom revisions would break the
 *             update-agent-settings no-phantom-revs discipline).
 */
export function writeCompiledBuildsInTx(tx, {
  agentRef,
  agentId,
  agent,
  nextState = {},
  bundles,
  // PR 3.5 (B4-TRAIT): the unified-projection inputs from prepareCompileInputs'
  // candidate reads. Absent while dark — the legacy snapshot path runs
  // byte-identically.
  ruleDocs = null,
  allBundles = null,
  enabled = false,
  nowIso,
  revision = 'mint',
  // Sol review #11: the cell-source selection resolved by prepareCompileInputs
  // (record-scoped) — thread `compileInputs?.candidateMode`. The flag default
  // survives only for direct unit-fixture calls that pass neither.
  candidateMode = COMPOSITION_COMPILED_IDENTITY_ENABLED,
  // Optional collector: when a caller needs the FULL CompiledBuild documents
  // (the deploy gate feeds one to the manifest builder), pass an object and
  // each mode's full build is set on it — the return value stays the client
  // PREVIEW payload (two shapes, two names, never conflated).
  collectBuilds = null,
} = {}) {
  if (!enabled) return null;

  const settingsRevAfter = (agent?.settingsRev || 0) + (revision === 'current' ? 0 : 1);
  const archetype = nextState.archetype ?? agent?.archetype ?? null;
  const deployedStrategy = 'deployedStrategy' in nextState
    ? nextState.deployedStrategy
    : agent?.deployedStrategy;

  const archetypeDefinition = {
    codeId: archetype,
    // §3.3: the compile targets the CURRENT registry identity version — the
    // exact parent this build is being authored against. (The agent doc
    // carries no historical parent pointer today; rebase semantics arrive
    // with Phase 3 authoring.)
    identityVersion: ARCHETYPE_IDENTITY_VERSION,
    identityHash: registryIdentityHash(),
  };

  const ruleMetadata = {};
  for (const bundle of bundles ?? []) {
    for (const snap of bundle.ruleSnapshots ?? []) {
      if (!snap?.id || ruleMetadata[snap.id] !== undefined) continue;
      const meta = metadataForRule(snap.id);
      if (meta !== undefined) ruleMetadata[snap.id] = meta;
    }
  }
  // Compat cells resolve by TEMPLATE id (snap.sourceRef), keyed by doc id — see
  // resolveEquippedCompatCells. via:'fallthrough' is ABSENCE (A-4): compileBuild
  // records it as a missing cell, never as a verdict. #11: the source is the
  // RESOLVED selection (record-scoped), not the bare flag.
  const compatCells = resolveEquippedCompatCells(bundles, archetype, { candidateMode });

  // PR 3.5: with the candidate inputs present, the compile universe is the
  // UNIFIED HOST PROJECTION (trait + bundle channels, doc-authority) — the
  // set of rules that actually behaves at deploy. equippedTraits comes from
  // nextState when the save changes it (update-agent-settings), else the doc.
  const projected = ruleDocs !== null && allBundles !== null
    ? buildProjectedCompileInputs({
        agent: { equippedTraits: nextState.equippedTraits ?? agent?.equippedTraits ?? [] },
        ruleDocs, allBundles, archetype,
      })
    : null;

  const userBuildDelta = {
    agentId,
    settingsRev: settingsRevAfter,
    parentArchetypeId: archetype,
    parentIdentityVersion: ARCHETYPE_IDENTITY_VERSION,
    equippedBundles: bundles ?? [],
    ruleMetadata: projected ? projected.ruleMetadata : ruleMetadata,
    compatCells: projected ? projected.compatCells : compatCells,
    ...(projected ? {
      projectedRules: projected.projectedRules,
      projectedRulesHash: projected.projectedRulesHash,
    } : {}),
    userGuardrails: Array.isArray(deployedStrategy?.guardrails) ? deployedStrategy.guardrails : [],
  };

  const platformGuardrails = buildPlatformGuardrails();
  const previews = {};
  for (const gameMode of LIVE_DEPLOY_MODES) {
    const build = compileBuild({
      archetypeDefinition,
      userBuildDelta,
      platformGuardrails,
      gameModePolicy: getGameModePolicy(gameMode),
      gameModePolicyHash: computeGameModePolicyHash(gameMode),
      versions: {
        ruleLibraryVersion: RULE_LIBRARY_VERSION,
        calibrationBundleVersion: CALIBRATION_BUNDLE_VERSION,
      },
      now: nowIso,
    });

    // DELIBERATE DIVERGENCE from captureSwapReceipt's create-only pattern
    // (founder ruling, P2.0 approval #3): overwrite-in-place .set() is
    // CORRECT here. A CompiledBuild is a freshness artifact — only the
    // latest compile per (agent, mode) is the contract object; history is
    // the manifest's job at lock. Do NOT "fix" this to .create().
    tx.set(agentRef.collection('compiledBuilds').doc(gameMode), build);
    if (collectBuilds) collectBuilds[gameMode] = build;

    previews[gameMode] = {
      compiledBuildId: build.compiledBuildId,
      gameMode,
      buildVersion: build.buildVersion,
      contentHash: build.contentHash,
      validationPass: build.validation.pass,
      validationErrorCount: build.validation.errors.length,
      effectiveGuardrailsPreview: build.effectiveGuardrailsPreview,
      blockedControls: build.blockedControls,
    };
  }
  return previews;
}

/** Test seam: reset module memos (fixture corpuses across test files). */
export function __resetCompileMemos() {
  templateById = null;
  cachedIdentityHash = null;
}
