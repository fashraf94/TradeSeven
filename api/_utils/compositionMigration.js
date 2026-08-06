// api/_utils/compositionMigration.js
//
// Composition PR 2 — the PURE migration planner (§6, Method B). Given an
// agent's persisted rule-config records and the candidate registry, produce
// the overlay entries the migration would write into the CANDIDATE NAMESPACE
// (compositionCandidateState/{id}/entries — design note §2). No I/O here; the
// runner is scripts/composition/migration-scan.js.
//
// THE ONE LEGAL CLAMP SITE (B8): per-shape semantics (M4) —
//   range {min,max}  → clamp to nearest bound
//   {minOnly}        → floor
//   enum {allow}     → replacementMap, or reject-and-unequip; AUTO-select only
//                      when exactly one admitted value exists
//   core_conflict    → unequip (bundle status + agent equippedBundleIds entries)
//   deferred         → NO ACTION (non-offerability is an offer-surface fact;
//                      an already-equipped deferred rule never strands — B1)
//   ambiguous bare-domain binding → NO ENTRY; reported for founder binding
//
// Dry-run == apply BY CONSTRUCTION (A8): one planner, two callers. Idempotent
// (A9): planning over the RESOLVED (overlaid) view yields zero new entries.
// Base records are never in the write set (A12/A36): the planner emits overlay
// entries only.
//
// The violation detector is compositionEnforcement.checkCandidatePairing —
// the same kernel the equip/save boundaries enforce with, so migration and
// enforcement can never disagree about legality (§9 one-source).

import { checkCandidatePairing, resolveNarrowedDomains, isDomain } from './compositionEnforcement.js';
import { getCandidateCompatCell } from '../../src/data/archetypeCompatibilityCandidate.js';
import { buildEntryKey } from './compositionStateResolver.js';

/** Nearest-bound clamp for range/floor domains over a numeric(-string) value. */
export function clampToDomain(domain, value) {
  const wasString = typeof value === 'string';
  const num = wasString ? Number(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num)) return null; // non-numeric → not clampable
  let next = num;
  if ('minOnly' in domain) next = Math.max(num, domain.minOnly);
  else {
    if ('min' in domain && next < domain.min) next = domain.min;
    if ('max' in domain && next > domain.max) next = domain.max;
  }
  if (next === num) return null; // already in-domain
  return wasString ? String(next) : next; // preserve the stored value's type
}

/**
 * Enum resolution (M4): explicit replacementMap wins; else auto-select ONLY
 * when the allow-list has exactly one member; else reject-and-unequip.
 */
export function resolveEnumReplacement(domain, value, replacementMap = {}) {
  if (Object.prototype.hasOwnProperty.call(replacementMap, String(value))) {
    return { kind: 'replace', afterValue: replacementMap[String(value)] };
  }
  if (domain.allow.length === 1) return { kind: 'replace', afterValue: domain.allow[0] };
  return { kind: 'unequip' };
}

/**
 * Plan the overlay entries for ONE agent.
 *
 * @param {object} p.agent    { id, archetype, equippedBundleIds }
 * @param {Array}  p.ruleDocs [{ id, docPath, sourceRef, paramValues, params, isDeleted }]
 * @param {Array}  p.bundles  [{ id, docPath, status, ruleIds, ruleSnapshots }]
 * @param {object} p.replacementMaps  { [ruleId]: { [param]: { [fromValue]: toValue } } }
 * @param {string} p.migrationRunId
 * @returns {{ entries, reports }} — reports: non-entry findings
 *   ({needsBinding|nonNumericClamp|deferredEquipped} classes) for the run report.
 */
export function planAgentMigration({ agent, ruleDocs = [], bundles = [], replacementMaps = {}, migrationRunId }) {
  const entries = [];
  const reports = [];
  const archetype = agent.archetype;
  const equippedBundles = bundles.filter((b) => b.status === 'equipped');
  const unequippedBundleIds = new Set();

  const pushEntry = (e) => {
    const entry = { ...e, entryKey: buildEntryKey(e), migrationRunId };
    if (!entries.some((x) => x.entryKey === entry.entryKey)) entries.push(entry); // logs once (A9)
  };

  // ── per-equipped-bundle: snapshots are the frozen authority (host C) ──────
  for (const bundle of equippedBundles) {
    let bundleBanned = false;
    for (const snap of bundle.ruleSnapshots || []) {
      if (!snap?.sourceRef) continue;
      const violations = checkCandidatePairing({
        ruleId: snap.sourceRef, archetype,
        paramValues: snap.paramValues ?? null,
        paramKeys: snap.params ? Object.keys(snap.params) : null,
      });
      for (const v of violations) {
        if (v.kind === 'core_conflict') bundleBanned = true;
        else if (v.kind === 'ambiguous_domain_binding') {
          reports.push({ class: 'needsBinding', agentId: agent.id, ruleId: v.ruleId, archetype, narrowedParams: v.narrowedParams });
        } else if (v.kind === 'param_out_of_domain') {
          const e = planParamEntry({
            host: 'bundleSnapshot', docPath: bundle.docPath,
            field: `ruleSnapshots[${snap.id}].paramValues.${v.param}`,
            v, replacementMaps, agent, reports,
          });
          if (e === 'unequip') bundleBanned = true;
          else if (e) pushEntry(e);
        }
        // 'deferred': already-equipped deferred rules never strand (B1) — record only.
        if (v.kind === 'deferred') reports.push({ class: 'deferredEquipped', agentId: agent.id, ruleId: v.ruleId, archetype });
      }
    }
    if (bundleBanned) {
      unequippedBundleIds.add(bundle.id);
      pushEntry({
        host: 'bundleSnapshot', docPath: bundle.docPath, field: 'status',
        action: 'unequip', beforeValue: 'equipped', afterValue: 'forged',
        ruleId: null, archetype, cellRef: null,
      });
    }
  }

  if (unequippedBundleIds.size > 0) {
    const before = agent.equippedBundleIds || [];
    pushEntry({
      host: 'agentDoc', docPath: agent.docPath, field: 'equippedBundleIds',
      action: 'unequip', beforeValue: before,
      afterValue: before.filter((id) => !unequippedBundleIds.has(id)),
      ruleId: null, archetype, cellRef: null,
    });
  }

  // ── per-rule-doc: the EDITABLE paramValues source (host B), migrated in
  // lockstep with the snapshots so the double-freeze cannot diverge ─────────
  for (const doc of ruleDocs) {
    if (doc.isDeleted || !doc.sourceRef) continue;
    const violations = checkCandidatePairing({
      ruleId: doc.sourceRef, archetype,
      paramValues: doc.paramValues ?? null,
      paramKeys: doc.params ? Object.keys(doc.params) : null,
    });
    for (const v of violations) {
      if (v.kind === 'param_out_of_domain') {
        const e = planParamEntry({
          host: 'ruleDoc', docPath: doc.docPath, field: `paramValues.${v.param}`,
          v, replacementMaps, agent, reports,
        });
        if (e && e !== 'unequip') pushEntry(e);
        // rule-doc enum with no admissible replacement: the bundle-side unequip
        // (above) is the effective action; record the residue for the report.
        if (e === 'unequip') reports.push({ class: 'ruleDocEnumUnresolved', agentId: agent.id, ruleId: v.ruleId, param: v.param });
      } else if (v.kind === 'ambiguous_domain_binding') {
        reports.push({ class: 'needsBinding', agentId: agent.id, ruleId: v.ruleId, archetype, narrowedParams: v.narrowedParams });
      }
      // core_conflict on an UNEQUIPPED rule doc is inert (nothing projects it);
      // equipped ones were handled through their bundle snapshots above.
    }
  }

  return { entries, reports };

  function planParamEntry({ host, docPath, field, v, replacementMaps: maps, agent: a, reports: r }) {
    const { domain, value, ruleId, param } = v;
    if ('allow' in domain) {
      const res = resolveEnumReplacement(domain, value, maps?.[ruleId]?.[param] ?? {});
      if (res.kind === 'unequip') return 'unequip';
      return {
        host, docPath, field, action: 'replace',
        beforeValue: value, afterValue: res.afterValue,
        ruleId, archetype: a.archetype, cellRef: cellRefFor(ruleId, a.archetype),
      };
    }
    const clamped = clampToDomain(domain, value);
    if (clamped === null) {
      if (!isDomain(domain) || !domainIsRange(domain)) return null;
      r.push({ class: 'nonNumericClamp', agentId: a.id, ruleId, param, value });
      return null;
    }
    return {
      host, docPath, field, action: 'minOnly' in domain ? 'floor' : 'clamp',
      beforeValue: value, afterValue: clamped,
      ruleId, archetype: a.archetype, cellRef: cellRefFor(ruleId, a.archetype),
    };
  }
}

function domainIsRange(d) { return 'min' in d || 'max' in d || 'minOnly' in d; }
function cellRefFor(ruleId, archetype) {
  const cell = getCandidateCompatCell(ruleId, archetype);
  return cell ? { rulingIds: cell.rulingIds, state: cell.state } : null;
}

/**
 * Residual scan (A10): violations remaining in a RESOLVED view. Zero after a
 * correct apply. Shares the kernel — cannot disagree with the planner.
 */
export function scanAgentForResiduals({ agent, ruleDocs = [], bundles = [] }) {
  const residuals = [];
  for (const bundle of bundles.filter((b) => b.status === 'equipped')) {
    for (const snap of bundle.ruleSnapshots || []) {
      if (!snap?.sourceRef) continue;
      residuals.push(...checkCandidatePairing({
        ruleId: snap.sourceRef, archetype: agent.archetype,
        paramValues: snap.paramValues ?? null,
        paramKeys: snap.params ? Object.keys(snap.params) : null,
      }).filter((x) => x.kind !== 'ambiguous_domain_binding' && x.kind !== 'deferred'));
    }
  }
  return residuals;
}

/** narrowedParams cells whose bare domain cannot bind mechanically — the founder worklist. */
export { resolveNarrowedDomains };
