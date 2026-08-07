// api/_utils/compileBuild.js
//
// Archetype Architecture Phase 2 (P2.3) — the compiler core (Spec §4.4 +
// A-2/A-3, §5.2–§5.6). PURE: no I/O, no clock, no flag reads — every input
// including `now` arrives as an argument; identical inputs produce identical
// output (contentHash-stable). Ships DARK: the only Phase-2 caller is the
// flag-gated equip-time helper (P2.4a), and production activation is
// additionally gated on the §5.6 metadata completeness check
// (activationGate.js), which correctly FAILS against today's corpus.
//
// NO INVENTED DEFAULTS (§5.6): a rule missing required metadata, or a
// compat cell resolved only by fallthrough, is a VALIDATION ERROR — the
// compiler never guesses. Fixture metadata (compilerFixtures.js) drives all
// Phase-2 development; Phases 3–4 author the real corpus.
//
// INPUT CONTRACT
//   archetypeDefinition { codeId, identityVersion, identityHash }
//   userBuildDelta {
//     agentId, settingsRev,            // A-3: the compile mints this revision
//     parentArchetypeId, parentIdentityVersion,   // §3.3 exact-parent rule
//     equippedBundles: [{ bundleId, ruleIds, ruleSnapshots, ruleHardness?,
//                         dimensionValues?, compileConfidence?,
//                         compileTransparency? }],
//     ruleMetadata:  { [ruleId]: §5.1 authored metadata },     // fixture/corpus
//     compatCells:   { [ruleId]: { state, via, treatment?, zone1Ref?,
//                                  tensionReason? } },         // explicit cells
//     userGuardrails: [{ type, value, ... }],  // deployedStrategy.guardrails —
//                                              // source, NEVER mutated (R1-10)
//   }
//   platformGuardrails                  // §1.2 contract object
//   gameModePolicy, gameModePolicyHash  // §1.3 + A-2 (exactly ONE mode)
//   versions { ruleLibraryVersion, calibrationBundleVersion }
//   now                                 // ISO string, caller-supplied

import {
  INTENDED_MODES,
  DETERMINISTIC_LEGAL_FALLBACKS,
  ADVISORY_LEGAL_FALLBACKS,
} from './archetypeBuildSchemas.js';
import { COMPILER_VERSION } from './archetypeVersionConstants.js';
import { canonicalContentHash } from './canonicalHash.js';
// PR 3 (A7): the ONE domain-admit predicate — shared with the equip/save
// legality kernel so the compile boundary can never disagree with it.
import { resolveNarrowedDomains, domainAdmits } from './compositionEnforcement.js';

// ── §5.5 supported guardrail engine shapes ───────────────────────────────
// Compilation requires an EXACT semantic match on all eight descriptor
// fields (R1-9): type, scope, basis, unit, trigger, side, resetBehavior,
// evaluationTiming. The rows below describe the three shapes the live
// engine deterministically enforces (agentGuardrails.applyGuardrails):
//   stopLoss        — forced exit swap, pct below entry     (:208-269, :367-470)
//   trailingStop    — forced exit, pct retrace from HWM     (:208-269, :367-470)
//   maxSectorWeight — blocked entry over portfolio cap      (:272-292, :472-482)
// DELIBERATELY ABSENT (display-agreement, BUILD_RULES §9): maxPosition is a
// documented engine no-op ('skipped_incompatible', agentGuardrails.js
// :327-339) and profitTarget is a soft note (:341-364) — compiling either
// would promise deterministic enforcement the engine does not deliver, the
// exact §5.5 "no lossy coercion" case. Token vocabulary for
// trigger/side/reset/timing is engine-derived (the Spec names the fields;
// the engine's behavior fixes the values).
export const SUPPORTED_GUARDRAIL_SHAPES = Object.freeze({
  stopLoss: Object.freeze({
    type: 'stopLoss', scope: 'position', basis: 'entry', unit: 'pct',
    trigger: 'price_below_threshold', side: 'exit', resetBehavior: 'none',
    evaluationTiming: 'post_decision_tick',
  }),
  trailingStop: Object.freeze({
    type: 'trailingStop', scope: 'position', basis: 'hwm', unit: 'pct',
    trigger: 'retrace_from_high', side: 'exit', resetBehavior: 'ratchet',
    evaluationTiming: 'post_decision_tick',
  }),
  maxSectorWeight: Object.freeze({
    type: 'maxSectorWeight', scope: 'portfolio', basis: 'entry', unit: 'pct',
    trigger: 'sector_weight_exceeds', side: 'entry_block', resetBehavior: 'none',
    evaluationTiming: 'post_decision_tick',
  }),
});

export const BINDING_DESCRIPTOR_FIELDS = Object.freeze([
  'type', 'scope', 'basis', 'unit', 'trigger', 'side', 'resetBehavior', 'evaluationTiming',
]);

// Strictest-wins comparator per supported type (§5.5): for all three shapes
// a SMALLER value is the tighter constraint (tighter stop, tighter trail,
// lower sector cap).
const STRICTEST = Object.freeze({ stopLoss: 'min', trailingStop: 'min', maxSectorWeight: 'min' });

/**
 * §3.2 + founder rulings (P2.0 approval #2): bundleContentHash covers the
 * behavior-affecting bundle fields — ruleIds, ruleSnapshots (params/
 * paramValues live INSIDE snapshot entries; there is no top-level params
 * field), dimensionValues, and ruleHardness. ruleHardness REMAINS a hash
 * input while the field exists (behavior-affecting, server-mintable); it
 * leaves the hash only when §5.4 retirement lands — the one-time
 * invalidation at that point is founder-accepted. compileConfidence /
 * compileTransparency are telemetry and MUST stay hash-exempt (a
 * transparency persist must never invalidate a build).
 */
export function computeBundleContentHash(bundle) {
  return canonicalContentHash({
    ruleIds: bundle.ruleIds ?? [],
    ruleSnapshots: bundle.ruleSnapshots ?? [],
    ruleHardness: bundle.ruleHardness ?? null,
    dimensionValues: bundle.dimensionValues ?? null,
  });
}

/** Exact-semantic match (R1-9): all eight fields, no coercion. */
export function matchSupportedShape(binding) {
  if (!binding || typeof binding !== 'object') return { matched: false, reason: 'no_binding' };
  const shape = SUPPORTED_GUARDRAIL_SHAPES[binding.type];
  if (!shape) return { matched: false, reason: `unsupported_type:${binding.type}` };
  for (const field of BINDING_DESCRIPTOR_FIELDS) {
    if (binding[field] !== shape[field]) {
      return { matched: false, reason: `mismatch:${field}` };
    }
  }
  return { matched: true, shape };
}

const err = (errors, code, ruleId, detail) => {
  errors.push({ code, ...(ruleId ? { ruleId } : {}), ...(detail ? { detail } : {}) });
};

export function compileBuild({
  archetypeDefinition,
  userBuildDelta,
  platformGuardrails,
  gameModePolicy,
  gameModePolicyHash,
  versions,
  now,
}) {
  const errors = [];
  let quarantined = false; // PR 3 (A7): out-of-domain persisted values quarantine the BUILD
  const delta = userBuildDelta ?? {};
  const def = archetypeDefinition ?? {};

  // ── Mode admission (A-2): a CompiledBuild exists for exactly ONE explicit
  // mode; an unresolvable policy cannot compile.
  if (!gameModePolicy || typeof gameModePolicy.mode !== 'string') {
    err(errors, 'unknown_game_mode', null, 'gameModePolicy missing or modeless');
  }
  const gameMode = gameModePolicy?.mode ?? null;

  // ── §3.3 exact-parent rule: no silent fallback to latest.
  if (delta.parentArchetypeId !== def.codeId) {
    err(errors, 'parent_archetype_mismatch', null,
      `delta parent ${delta.parentArchetypeId} vs definition ${def.codeId}`);
  }
  if (delta.parentIdentityVersion !== def.identityVersion) {
    err(errors, 'parent_version_mismatch', null,
      `delta parentIdentityVersion ${delta.parentIdentityVersion} vs definition identityVersion ${def.identityVersion}`);
  }

  // ── Assemble the rule set. LEGACY (and dark): the frozen equipped-bundle
  // snapshots (the double-freeze authority). PR 3.5 CANDIDATE MODE: the
  // UNIFIED HOST PROJECTION (delta.projectedRules — trait + bundle channels,
  // doc-authority, deduped by projectActiveRules' own semantics, host
  // provenance retained). The projection is what actually BEHAVES at deploy;
  // absent while dark, so legacy builds assemble byte-identically.
  const bundles = delta.equippedBundles ?? [];
  const ruleMetadata = delta.ruleMetadata ?? {};
  const compatCells = delta.compatCells ?? {};
  const rulesById = new Map();
  if (Array.isArray(delta.projectedRules)) {
    for (const pr of delta.projectedRules) {
      if (!pr?.id || rulesById.has(pr.id)) continue;
      rulesById.set(pr.id, {
        snapshot: pr,
        bundleId: pr.hostBundleId ?? null,
        ...(pr.hostTraitId ? { traitId: pr.hostTraitId } : {}),
      });
    }
  } else {
    for (const bundle of bundles) {
      for (const snap of bundle.ruleSnapshots ?? []) {
        if (!snap?.id || rulesById.has(snap.id)) continue;
        rulesById.set(snap.id, { snapshot: snap, bundleId: bundle.bundleId });
      }
    }
  }

  const compatVerdicts = [];
  const blockedControls = [];
  const tensionPairs = [];
  const compiledGuardrails = [];

  for (const [ruleId, { snapshot, bundleId, traitId }] of rulesById) {
    const meta = ruleMetadata[ruleId];

    // §5.6 required base metadata — never defaulted.
    if (!meta) {
      err(errors, 'metadata_missing', ruleId, 'no authored metadata');
      continue;
    }
    for (const field of ['intendedMode', 'copyClass', 'receiptTag']) {
      if (meta[field] === undefined || meta[field] === null) err(errors, 'metadata_missing', ruleId, field);
    }
    if (meta.intendedMode != null && !INTENDED_MODES.includes(meta.intendedMode)) {
      err(errors, 'unknown_intended_mode', ruleId, String(meta.intendedMode));
    }

    // A-4: an explicit compat cell per (rule × archetype); absence — including
    // the live map's fallthrough-to-neutral — is NOT a verdict.
    const cell = compatCells[ruleId];
    if (!cell || cell.via === 'fallthrough') {
      err(errors, 'compat_cell_missing', ruleId, `archetype ${def.codeId}`);
      continue;
    }

    // Input vocabulary → §4.4 verdict vocabulary ('neutral' is the
    // 'compatible' class — §5.2 map unchanged, §4.4 token naming; see
    // archetypeBuildSchemas.js COMPAT_VERDICTS note).
    const verdict =
      cell.state === 'neutral' ? 'compatible'
      : cell.state === 'native' ? 'native'
      : cell.state === 'tension' ? 'tension'
      : cell.state === 'core_conflict' ? 'core_conflict'
      // PR 3 (spec §7 row 3): 'deferred' joins the vocabulary — a candidate
      // cell state (complete-but-non-offerable, B1). Only the candidate
      // source produces it; it fails closed below exactly like core_conflict.
      : cell.state === 'deferred' ? 'deferred'
      : null;
    if (verdict === null) {
      err(errors, 'unknown_compat_state', ruleId, String(cell.state));
      continue;
    }

    // PR 3: candidate cells carry the advisory sentence + narrowed domains
    // onto the build (the assemblers' ONLY advisory source — A25). Legacy
    // cells have neither key, so dark builds stay byte-identical.
    const candidateCarriage = {
      ...('advisory' in cell ? { advisory: cell.advisory ?? null } : {}),
      ...('narrowedParams' in cell ? { narrowedParams: cell.narrowedParams ?? null } : {}),
      // PR 3.5: trait-host provenance (unified projection only — absent on
      // every legacy entry, so dark builds gain no key).
      ...(traitId ? { hostTraitId: traitId } : {}),
    };

    // §5.4: tie_breaker intendedMode is legal only for lean-class content.
    if (meta.intendedMode === 'tie_breaker' && meta.contentClass !== 'lean') {
      err(errors, 'illegal_pair_tie_breaker_non_lean', ruleId);
    }

    // core_conflict never compiles (§5.2/§5.4) — blocked, excluded from
    // rendering and guardrail compilation. A legal outcome, not an error.
    // PR 3 (A15): 'deferred' is an illegal pair at this boundary too — it
    // fails closed identically (founder instruction; the B1 no-strand ruling
    // governs the MIGRATION, which reports deferredEquipped rather than
    // migrating — at compile time the pair never behaves).
    if (verdict === 'core_conflict' || verdict === 'deferred') {
      compatVerdicts.push({ ruleId, bundleId, verdict, intendedMode: meta.intendedMode, blocked: true, ...candidateCarriage });
      blockedControls.push({
        ruleId, bundleId, blockedBy: verdict,
        zone1Ref: cell.zone1Ref ?? null, reason: cell.tensionReason ?? null,
      });
      continue;
    }

    // §5.2/§5.6: a tension verdict is meaningless without its authored
    // treatment.
    let forcedAdvisory = false;
    if (verdict === 'tension') {
      if (!cell.treatment) {
        err(errors, 'tension_missing_treatment', ruleId);
        continue;
      }
      // §5.4 legal-combination matrix: tension+advisoryDowngrade forces
      // prompt_advisory regardless of intendedMode or binding.
      if (cell.treatment === 'advisoryDowngrade') forcedAdvisory = true;
      // (recorded AFTER the A7/mode-gate blocks below — review F5: a blocked
      // or quarantined tension rule must not ride renderedTensionCandidates
      // into the manifest's DR-13 feed.)
    }

    // ── PR 3 (A7): candidate narrowed-domain legality over the PERSISTED
    // frozen params. An out-of-domain value REJECTS the rule and QUARANTINES
    // the build — the compiler NEVER clamps (clamping exists in exactly one
    // place, the §6 migration planner). '' / non-numeric never false-admits:
    // domainAdmits is the same predicate the equip/save kernel uses — and the
    // GUARDS mirror the kernel exactly (review F2: absent/null paramValues is
    // a first-class persisted shape and is LEGAL — checkCandidatePairing
    // judges only truthy paramValues objects, keys from snap.params when
    // present, and skips null/unset values; disagreeing here false-quarantined
    // legitimately-persisted rules).
    if ('narrowedParams' in cell && cell.narrowedParams
        && snapshot?.paramValues && typeof snapshot.paramValues === 'object') {
      const paramKeys = snapshot.params && typeof snapshot.params === 'object'
        ? Object.keys(snapshot.params)
        : Object.keys(snapshot.paramValues);
      const { domains, ambiguous } = resolveNarrowedDomains(cell.narrowedParams, paramKeys);
      if (ambiguous) {
        // The kernel classifies the SAME shape ambiguous (identical key
        // derivation), so this arm never disagrees with equip/save — it is
        // the fail-closed tripwire for a bare domain meeting a multi-param
        // doc, never a guess.
        err(errors, 'ambiguous_domain_binding', ruleId);
        quarantined = true;
        compatVerdicts.push({ ruleId, bundleId, verdict, intendedMode: meta.intendedMode, blocked: true, ...candidateCarriage });
        blockedControls.push({ ruleId, bundleId, blockedBy: 'param_out_of_domain', detail: 'ambiguous_domain_binding' });
        continue;
      }
      const violations = Object.entries(domains)
        .filter(([param, domain]) => param in snapshot.paramValues
          && snapshot.paramValues[param] !== null && snapshot.paramValues[param] !== undefined
          && !domainAdmits(domain, snapshot.paramValues[param]))
        .map(([param]) => param);
      if (violations.length > 0) {
        for (const param of violations) err(errors, 'param_out_of_domain', ruleId, `paramValues.${param}`);
        quarantined = true;
        compatVerdicts.push({ ruleId, bundleId, verdict, intendedMode: meta.intendedMode, blocked: true, ...candidateCarriage });
        blockedControls.push({ ruleId, bundleId, blockedBy: 'param_out_of_domain', detail: violations.map((p) => `paramValues.${p}`).join(',') });
        continue;
      }
    }

    // Mode admission for the rule itself (§1.3 ruleModeGate over the
    // template's existing modes field, when known).
    if (meta.modes && Array.isArray(gameModePolicy?.ruleModeGate)
        && !gameModePolicy.ruleModeGate.includes(meta.modes)) {
      compatVerdicts.push({ ruleId, bundleId, verdict, intendedMode: meta.intendedMode, blocked: true, ...candidateCarriage });
      blockedControls.push({ ruleId, bundleId, blockedBy: 'ruleModeGate', detail: meta.modes });
      continue;
    }

    // ── §5.3 effectiveEnforcement derivation ─────────────────────────────
    // deterministic ⇔ a guardrailBinding exact-matches a supported engine
    // shape (and tension hasn't forced advisory), or authored metadata
    // declares an owning platform/knob gate. Everything else is
    // prompt_advisory — the honest derived fact.
    let effectiveEnforcement = 'prompt_advisory';
    let bindingMatch = null;
    let compiledValue = null;

    if (!forcedAdvisory && meta.platformOwnedGate) {
      effectiveEnforcement = 'deterministic';
    } else if (!forcedAdvisory && meta.guardrailBinding) {
      bindingMatch = matchSupportedShape(meta.guardrailBinding);
      if (bindingMatch.matched) {
        // The compiled value comes from the rule's own frozen params — the
        // binding names WHICH param carries it (valueParamKey: an
        // implementation mapping field under the Spec's descriptor; absence
        // is an authoring error, never guessed).
        const key = meta.guardrailBinding.valueParamKey;
        const value = key ? snapshot?.paramValues?.[key] : undefined;
        if (key === undefined) {
          err(errors, 'binding_missing_value_param', ruleId);
        } else if (typeof value !== 'number') {
          err(errors, 'binding_value_unresolved', ruleId, `paramValues.${key}`);
        } else {
          effectiveEnforcement = 'deterministic';
          compiledValue = value;
        }
      }
    }

    // §5.4 fallback legality per derived enforcement; §5.6 deterministic
    // tier requires detectorSource + fallback.
    const fallback = meta.missingDataFallback;
    if (effectiveEnforcement === 'deterministic') {
      if (!DETERMINISTIC_LEGAL_FALLBACKS.includes(fallback)) {
        err(errors, 'illegal_fallback_for_deterministic', ruleId, String(fallback));
      }
      if (!meta.detectorSource) err(errors, 'metadata_missing', ruleId, 'detectorSource');
    } else if (fallback !== undefined && !ADVISORY_LEGAL_FALLBACKS.includes(fallback)) {
      err(errors, 'unknown_fallback', ruleId, String(fallback));
    }

    if (verdict === 'tension') {
      tensionPairs.push({ ruleId, treatment: cell.treatment, tensionReason: cell.tensionReason ?? null });
    }
    const compiledToGuardrail = effectiveEnforcement === 'deterministic' && compiledValue !== null;
    compatVerdicts.push({
      ruleId, bundleId, verdict, ...candidateCarriage,
      ...(verdict === 'tension' ? { treatment: cell.treatment } : {}),
      intendedMode: meta.intendedMode,
      effectiveEnforcement,
      // §5.3: a constraint-intended rule landing advisory renders under
      // advisory framing and is never presented as enforced.
      copyClass: forcedAdvisory ? 'advisory' : meta.copyClass,
      ...(compiledToGuardrail
        // §5.5 no-double-rendering: compiled rules leave the CONSTRAINTS
        // text; the renderer emits the system-enforcement notice instead.
        ? { compiledToGuardrail: true, renderExclusion: 'system_enforcement_notice' }
        : {}),
      ...(bindingMatch && !bindingMatch.matched ? { bindingMismatch: bindingMatch.reason } : {}),
    });

    if (compiledToGuardrail) {
      compiledGuardrails.push({
        ruleId,
        type: meta.guardrailBinding.type,
        value: compiledValue,
        binding: meta.guardrailBinding,
      });
    }
  }

  // ── §5.5 strictest-wins merge → §4.4 mandatory preview (R1-12) ──────────
  // Computed ONLY here (and, at lock, in the manifest — P2.5). User source
  // values are never mutated; unequip restores by construction (R1-10).
  const userGuardrails = delta.userGuardrails ?? [];
  const perType = {};
  const typeUniverse = new Set([
    ...userGuardrails.map((g) => g?.type).filter(Boolean),
    ...compiledGuardrails.map((g) => g.type),
  ]);
  for (const type of typeUniverse) {
    const requested = userGuardrails.find((g) => g?.type === type)?.value;
    const derived = compiledGuardrails.filter((g) => g.type === type);
    const candidates = [
      ...(typeof requested === 'number' ? [{ source: 'user', value: requested }] : []),
      ...derived.map((g) => ({ source: `rule:${g.ruleId}`, value: g.value })),
    ];
    if (candidates.length === 0) continue;
    // min = strictest for every supported type; ties resolve to 'user' (an
    // equal user value governs — unequipping the rule then changes nothing).
    const pick = candidates.reduce((best, c) => {
      if (best === null) return c;
      if (STRICTEST[type] === 'min' ? c.value < best.value : c.value > best.value) return c;
      if (c.value === best.value && c.source === 'user') return c;
      return best;
    }, null);
    const governedByRule = pick.source !== 'user';
    perType[type] = {
      requestedByUser: typeof requested === 'number' ? requested : null,
      derivedFromRules: derived.map((g) => ({ ruleId: g.ruleId, value: g.value, binding: g.binding })),
      effective: pick.value,
      governingSource: pick.source,
      onUnequipBehavior: governedByRule
        ? (typeof requested === 'number'
          ? `reverts to user value ${requested}`
          : 'reverts to none (no user guardrail of this type)')
        : 'unchanged (user value governs)',
    };
  }

  // ── Assembly ─────────────────────────────────────────────────────────────
  const settingsRev = delta.settingsRev;
  if (typeof settingsRev !== 'number') err(errors, 'missing_settings_rev', null);

  const bundleContentHashes = {};
  for (const bundle of bundles) {
    if (bundle?.bundleId) bundleContentHashes[bundle.bundleId] = computeBundleContentHash(bundle);
  }

  const sourceRevisionVector = {
    settingsRev: settingsRev ?? -1,
    bundleContentHashes,
    ruleLibraryVersion: versions?.ruleLibraryVersion ?? null,
    identityHash: def.identityHash ?? null,
    calibrationBundleVersion: versions?.calibrationBundleVersion ?? null,
    guardrailSetVersion: platformGuardrails?.guardrailSetVersion ?? null,
    // A-2: the three mode fields enter the vector AND contentHash; the lock
    // transaction re-verifies them exactly like a settingsRev mismatch.
    gameMode,
    gameModePolicyVersion: gameModePolicy?.gameModePolicyVersion ?? null,
    gameModePolicyHash: gameModePolicyHash ?? null,
    // PR 3.5 (unified projection): the projected-payload hash — a trait-doc
    // or draft-bundle edit stales a candidate build (the equipped-bundle
    // hashes alone cannot see them). Key absent while dark.
    ...(delta.projectedRulesHash ? { projectedRulesHash: delta.projectedRulesHash } : {}),
  };

  const build = {
    compiledBuildId: `${delta.agentId ?? 'unknown'}_${gameMode ?? 'unknown'}_rev${settingsRev ?? 'x'}`,
    compilerVersion: COMPILER_VERSION,
    compiledAt: now,
    contentHash: '',
    agentId: delta.agentId ?? null,
    buildVersion: settingsRev ?? -1,
    parentArchetypeId: def.codeId ?? null,
    parentIdentityVersion: def.identityVersion ?? -1,
    identityHash: def.identityHash ?? null,
    gameMode,
    gameModePolicyVersion: gameModePolicy?.gameModePolicyVersion ?? -1,
    gameModePolicyHash: gameModePolicyHash ?? null,
    sourceRevisionVector,
    validation: { pass: errors.length === 0, errors },
    // PR 3 (A7): key present ONLY when an out-of-domain persisted value was
    // found under the candidate boundary — legacy/dark builds carry no new
    // key, so their contentHash and doc bytes are unchanged.
    ...(quarantined ? { quarantined: true } : {}),
    compatVerdicts,
    blockedControls,
    effectiveGuardrailsPreview: { perType },
    renderedTensionCandidates: tensionPairs,
    freshness: { validUntilSourceChange: true },
  };

  // contentHash covers the build's semantic content — everything except the
  // hash field itself and the call timestamp (identical inputs at different
  // times are the SAME build).
  const { contentHash, compiledAt, ...hashable } = build;
  build.contentHash = canonicalContentHash(hashable);
  return build;
}
