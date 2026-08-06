// api/_utils/compositionEnforcement.js
//
// Composition PR 2 — the candidate-legality KERNEL for the offer/equip and
// whole-config-save boundaries (spec §2 rows 1-4; closure sheet §IV). PURE:
// no I/O, no flag reads — callers gate on COMPOSITION_ENFORCEMENT_MODE and
// pass everything in. One detector shared by the equip endpoints, the
// whole-config save, the migration planner, and the residual scanner, so
// enforcement and migration can never disagree about what a violation is
// (the §9 one-source discipline applied to legality).
//
// VERDICT SEMANTICS (spec §2 table):
//   core_conflict → reject pairing (stored config byte-unchanged)
//   deferred      → reject (complete-but-non-offerable — NEVER absence, B1)
//   tension+narrowedParams → reject OUT-OF-DOMAIN persisted values (named
//                   constraint error; stored value untouched). THIS MODULE
//                   NEVER CLAMPS (B8) — clamping exists in exactly one place,
//                   the §6 migration planner (compositionMigration.js).
//   tension / native / neutral → legal (advisory treatment is PR-3 compiler work)
//   (no cell)     → legal here: a rule outside the candidate universe (manual
//                   free-text rules, non-offerable ids) is not this kernel's
//                   jurisdiction — the offer surface (ruleSupportStatus) and
//                   the completeness CI own that boundary.
//
// Invariant-R posture: this module may be imported by write-time endpoints and
// migration/scan tooling ONLY — never by the assemblers or projectActiveRules
// (asserted by compositionForbiddenReads.test.js).

import {
  getCandidateCompatCell,
  INCLUDED_ARCHETYPES,
} from '../../src/data/archetypeCompatibilityCandidate.js';
import { TRAIT_BY_ID } from '../../src/data/traitLibrary.js';

/** Domain shape test: {allow:[...]} | {minOnly:n} | {min?,max? numbers}. */
export function isDomain(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if ('allow' in v) return keys.length === 1 && Array.isArray(v.allow);
  if ('minOnly' in v) return keys.length === 1 && typeof v.minOnly === 'number';
  return keys.length > 0 && keys.every((k) => k === 'min' || k === 'max')
    && (!('min' in v) || typeof v.min === 'number')
    && (!('max' in v) || typeof v.max === 'number');
}

/**
 * Resolve a cell's narrowedParams to a per-param domain map against the rule's
 * authored params. Bare (un-keyed) domains bind ONLY when the template has
 * exactly one param — an ambiguous bare domain is surfaced, never guessed
 * (the honest-binding rule; the scan reports these for founder binding).
 *
 * @param {object|null} narrowedParams  cell.narrowedParams
 * @param {string[]}    paramKeys       the rule's param keys (from its template/snapshot)
 * @returns {{ domains: Object<string,object>, ambiguous: boolean }}
 */
export function resolveNarrowedDomains(narrowedParams, paramKeys = []) {
  if (narrowedParams === null || narrowedParams === undefined) return { domains: {}, ambiguous: false };
  if (isDomain(narrowedParams)) {
    if (paramKeys.length === 1) return { domains: { [paramKeys[0]]: narrowedParams }, ambiguous: false };
    return { domains: {}, ambiguous: true };
  }
  const domains = {};
  for (const [k, d] of Object.entries(narrowedParams)) if (isDomain(d)) domains[k] = d;
  return { domains, ambiguous: false };
}

/**
 * Numeric-aware membership: stored select values are STRINGS ("50") while
 * authored domains carry numbers (allow:[50]) — compare numerically when both
 * sides are numeric, strictly otherwise. Never mutates the stored value.
 */
function domainAdmits(domain, value) {
  const num = typeof value === 'number' ? value
    : (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : null);
  if ('allow' in domain) {
    return domain.allow.some((a) => a === value || (num !== null && typeof a === 'number' && a === num));
  }
  if (num === null) return false; // range/floor domains admit numerics only
  if ('minOnly' in domain) return num >= domain.minOnly;
  if ('min' in domain && num < domain.min) return false;
  if ('max' in domain && num > domain.max) return false;
  return true;
}

/**
 * The one pairing check: (ruleId × archetype [× persisted paramValues]).
 * ruleId is the TEMPLATE id (a snapshot's sourceRef — the ruleCompatClassify
 * key-space discipline; a null sourceRef is a manual rule, outside jurisdiction).
 *
 * @returns {Array<violation>} violations, [] when legal. Shapes:
 *   { kind:'core_conflict', ruleId, archetype, displayReason, rulingIds }
 *   { kind:'deferred',      ruleId, archetype, rulingIds }
 *   { kind:'param_out_of_domain', ruleId, archetype, param, value, domain, advisory }
 *   { kind:'ambiguous_domain_binding', ruleId, archetype, narrowedParams } (reported, non-blocking)
 */
export function checkCandidatePairing({ ruleId, archetype, paramValues = null, paramKeys = null }) {
  if (!ruleId || !INCLUDED_ARCHETYPES.includes(archetype)) return [];
  const cell = getCandidateCompatCell(ruleId, archetype);
  if (!cell) return [];
  if (cell.state === 'core_conflict') {
    return [{ kind: 'core_conflict', ruleId, archetype, displayReason: cell.displayReason, rulingIds: cell.rulingIds }];
  }
  if (cell.state === 'deferred') {
    return [{ kind: 'deferred', ruleId, archetype, rulingIds: cell.rulingIds }];
  }
  if (cell.state === 'tension' && cell.narrowedParams && paramValues && typeof paramValues === 'object') {
    const keys = paramKeys ?? Object.keys(paramValues);
    const { domains, ambiguous } = resolveNarrowedDomains(cell.narrowedParams, keys);
    if (ambiguous) {
      return [{ kind: 'ambiguous_domain_binding', ruleId, archetype, narrowedParams: cell.narrowedParams }];
    }
    const out = [];
    for (const [param, domain] of Object.entries(domains)) {
      if (!(param in paramValues)) continue; // an unset param defaults at render; only persisted values are judged
      const value = paramValues[param];
      if (value === null || value === undefined) continue;
      if (!domainAdmits(domain, value)) {
        out.push({ kind: 'param_out_of_domain', ruleId, archetype, param, value, domain, advisory: cell.advisory });
      }
    }
    return out;
  }
  return [];
}

/**
 * Equip-boundary check over a bundle's frozen ruleSnapshots (the equip API's
 * unit of work). Snapshot → template id via sourceRef; paramValues judged from
 * the frozen snapshot (the double-freeze authority).
 */
export function checkCandidateEquipLegality({ ruleSnapshots = [], archetype }) {
  const violations = [];
  for (const snap of ruleSnapshots) {
    if (!snap || !snap.sourceRef) continue;
    const paramKeys = snap.params && typeof snap.params === 'object' ? Object.keys(snap.params) : null;
    violations.push(...checkCandidatePairing({
      ruleId: snap.sourceRef, archetype, paramValues: snap.paramValues ?? null, paramKeys,
    }));
  }
  return violations;
}

/** Blocking predicate (observe mode computes, enforce mode rejects on these). */
export function isBlockingViolation(v) {
  return v.kind === 'core_conflict' || v.kind === 'deferred' || v.kind === 'param_out_of_domain';
}

/**
 * Whole-config-save boundary (A27): a saved equippedTraits set whose traits
 * bundle a banned rule for the agent's REAL archetype is a banned pairing.
 * Trait entries: 'trait-id' strings or { traitId|id, strength } objects
 * (both persisted shapes); paramValues resolve from the trait's strength
 * profile so narrowed domains are judged against what would actually equip.
 */
export function checkCandidateTraitLegality({ equippedTraits = [], archetype }) {
  const violations = [];
  for (const entry of equippedTraits) {
    const traitId = typeof entry === 'string' ? entry : entry?.traitId ?? entry?.id;
    const strength = (typeof entry === 'object' && entry?.strength) || 'moderate';
    const trait = traitId ? TRAIT_BY_ID[traitId] : null;
    if (!trait) continue; // unknown ids are the schema validator's problem, not legality's
    for (const ruleId of trait.ruleIds || []) {
      const paramValues = trait.strengthProfiles?.[strength]?.[ruleId] ?? null;
      violations.push(...checkCandidatePairing({
        ruleId, archetype, paramValues,
        paramKeys: paramValues ? Object.keys(paramValues) : null,
      }).map((v) => ({ ...v, traitId })));
    }
  }
  return violations;
}
