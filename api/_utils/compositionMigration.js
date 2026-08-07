// api/_utils/compositionMigration.js
//
// Composition PR 2 — the PURE migration planner (§6, Method B). Given an
// agent's persisted rule-config records and the candidate registry, produce
// the overlay entries the migration would write into the CANDIDATE NAMESPACE
// (compositionCandidateState/{id}/entries — design note §2). No I/O here; the
// runner is scripts/composition/migration-scan.js.
//
// SELECTION KERNEL (§9 one-source; adversarial-review C1): the set of rules
// that BEHAVES is exactly what projectActiveRules projects — trait-hosted
// rule docs (traitId ∈ equippedTraits, NO bundle involved) plus rule docs
// carried by ANY non-archived bundle (draft/forged/equipped alike). The
// planner and the residual scanner therefore both select THROUGH
// projectActiveRules itself; a channel it projects can never be a channel
// the migration misses. (The v1 planner selected over equipped-bundle
// snapshots only and was blind to the trait and draft-bundle channels —
// 20 trait-hosted banned pairings exist in shipped data.)
//
// THE ONE LEGAL CLAMP SITE (B8): per-shape semantics (M4) —
//   range {min,max}  → clamp to nearest bound (stored type preserved;
//                      non-numeric/empty strings are NEVER clamped — they
//                      report nonNumericClamp for founder disposition)
//   {minOnly}        → floor
//   enum {allow}     → replacementMap, or reject-and-unequip; AUTO-select only
//                      when exactly one admitted value exists
//   core_conflict    → unequip the HOSTING UNIT: the equipped bundle
//                      (status + equippedBundleIds echo), the TRAIT
//                      (equippedTraits entry removed — all its rules stop
//                      projecting), or a draft/forged bundle's membership
//                      (the banned ruleId cut from ruleIds)
//   deferred         → NO ACTION (non-offerability is an offer-surface fact;
//                      an already-equipped deferred rule never strands — B1)
//   ambiguous bare-domain binding → NO ENTRY; reported for founder binding
//
// Dry-run == apply BY CONSTRUCTION (A8): one planner, two callers. Idempotent
// (A9): planning over the RESOLVED (overlaid) view yields zero new entries.
// Base records are never in the write set (A12/A36).

import { checkCandidatePairing, resolveNarrowedDomains, isDomain } from './compositionEnforcement.js';
import { getCandidateCompatCell } from '../../src/data/archetypeCompatibilityCandidate.js';
import { buildEntryKey, resolveEffectiveConfig } from './compositionStateResolver.js';
import { projectActiveRules } from './projectActiveRules.js';

/** Nearest-bound clamp for range/floor domains over a numeric(-string) value. */
export function clampToDomain(domain, value) {
  const wasString = typeof value === 'string';
  if (wasString && value.trim() === '') return null; // review C4: never clamp a phantom zero
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
 * THE effective-host projection (PR 3.5, founder trait ruling / B4-TRAIT):
 * the ONE selection of "which rule DOCS behave, hosted where" — driven by
 * projectActiveRules (bundle + trait channels, deduped by its own semantics)
 * with host provenance retained. Consumed by the migration planner, the
 * residual scanner, AND the candidate compiler's input assembly — no second
 * projection semantics exist anywhere ("reuse, no new semantics").
 *
 * Returns [{doc, hosting}] for EVERY projected doc, including manual rules
 * (sourceRef null) — consumers apply their own universe filter (the planner
 * skips no-sourceRef docs; the compiler keeps them so A-4 records
 * compat_cell_missing rather than silently shrinking coverage).
 */
export function projectHostedRuleDocs({ agent, ruleDocs = [], bundles = [] }) {
  const docsById = new Map(ruleDocs.map((r) => [r.id, r]));
  const projected = projectActiveRules(agent.equippedTraits || [], ruleDocs, bundles);
  const out = [];
  for (const item of projected) {
    const doc = docsById.get(item.ruleId);
    if (!doc) continue; // a projected item always has a doc; guard for fakes
    const hosting = doc.traitId
      ? { channel: 'trait', traitId: doc.traitId }
      : { channel: 'bundle', bundles: bundles.filter((b) => b && b.status !== 'archived' && (b.ruleIds || []).includes(doc.id)) };
    out.push({ doc, hosting });
  }
  return out;
}

/**
 * The PROJECTED violation set for one agent — the shared selection kernel of
 * the planner AND the residual scanner (they cannot disagree). Each violation
 * is annotated with its hosting channel — derived via projectHostedRuleDocs
 * (refactor-neutral: same selection, same annotations as before PR 3.5).
 */
function projectedViolations({ agent, ruleDocs = [], bundles = [] }) {
  const out = [];
  for (const { doc, hosting } of projectHostedRuleDocs({ agent, ruleDocs, bundles })) {
    if (!doc.sourceRef) continue; // manual rules: outside the candidate universe
    const violations = checkCandidatePairing({
      ruleId: doc.sourceRef, archetype: agent.archetype,
      paramValues: doc.paramValues ?? null,
      paramKeys: doc.params ? Object.keys(doc.params) : null,
    });
    for (const v of violations) out.push({ ...v, doc, hosting });
  }
  return out;
}

/**
 * Plan the overlay entries for ONE agent.
 *
 * @returns {{ entries, reports }} — reports carry the non-entry findings
 *   ({needsBinding|nonNumericClamp|deferredEquipped|ruleDocEnumUnresolved}).
 */
export function planAgentMigration({ agent, ruleDocs = [], bundles = [], replacementMaps = {}, migrationRunId }) {
  const entries = [];
  const reports = [];
  const archetype = agent.archetype;
  const unequippedBundleIds = new Set();
  const unequippedTraitIds = new Set();
  // draft/forged membership cuts ACCUMULATE per bundle and emit once at the
  // end — two banned docs in one draft bundle must both leave ruleIds (a
  // per-violation emit would collide on entryKey and lose the second cut).
  const membershipCuts = new Map(); // bundleId → { bundle, cutDocIds:Set }

  const pushEntry = (e) => {
    const entry = { ...e, entryKey: buildEntryKey(e), migrationRunId };
    if (!entries.some((x) => x.entryKey === entry.entryKey)) entries.push(entry); // logs once (A9)
  };
  const cutMembership = (b, docId, ruleId) => {
    if (!membershipCuts.has(b.id)) membershipCuts.set(b.id, { bundle: b, cutDocIds: new Set(), ruleIds: new Set() });
    const c = membershipCuts.get(b.id);
    c.cutDocIds.add(docId);
    c.ruleIds.add(ruleId);
  };

  for (const v of projectedViolations({ agent, ruleDocs, bundles })) {
    if (v.kind === 'ambiguous_domain_binding') {
      reports.push({ class: 'needsBinding', agentId: agent.id, ruleId: v.ruleId, archetype, narrowedParams: v.narrowedParams });
      continue;
    }
    if (v.kind === 'deferred') {
      reports.push({ class: 'deferredEquipped', agentId: agent.id, ruleId: v.ruleId, archetype });
      continue;
    }
    if (v.kind === 'core_conflict') {
      if (v.hosting.channel === 'trait') {
        unequippedTraitIds.add(v.hosting.traitId); // the trait is the pairing unit
      } else {
        for (const b of v.hosting.bundles) {
          if (b.status === 'equipped' && !unequippedBundleIds.has(b.id)) {
            // the equip gesture was the unit → whole-bundle unequip …
            unequippedBundleIds.add(b.id);
            pushEntry({
              host: 'bundleSnapshot', docPath: b.docPath, field: 'status',
              action: 'unequip', beforeValue: 'equipped', afterValue: 'forged',
              ruleId: v.ruleId, archetype, cellRef: cellRefFor(v.ruleId, archetype),
            });
          }
          // … AND the banned rule's membership is cut in EVERY non-archived
          // hosting bundle: a forged (or draft) bundle still PROJECTS its
          // members (projectActiveRules:76-79), so a status flip alone would
          // leave the pairing behaving — the scan-clean test caught this.
          cutMembership(b, v.doc.id, v.ruleId);
        }
      }
      continue;
    }
    if (v.kind === 'param_out_of_domain') {
      // Host B (the live rule doc — WHAT PROJECTS) …
      const e = planParamEntry({
        host: 'ruleDoc', docPath: v.doc.docPath, field: `paramValues.${v.param}`,
        v, replacementMaps, agent, reports,
      });
      if (e === 'unequip') {
        // enum with no admissible replacement: unequip the hosting unit
        if (v.hosting.channel === 'trait') unequippedTraitIds.add(v.hosting.traitId);
        else for (const b of v.hosting.bundles) {
          if (b.status === 'equipped' && !unequippedBundleIds.has(b.id)) {
            unequippedBundleIds.add(b.id);
            pushEntry({
              host: 'bundleSnapshot', docPath: b.docPath, field: 'status',
              action: 'unequip', beforeValue: 'equipped', afterValue: 'forged',
              ruleId: v.ruleId, archetype, cellRef: cellRefFor(v.ruleId, archetype),
            });
          }
          cutMembership(b, v.doc.id, v.ruleId); // membership cut stops projection
        }
        reports.push({ class: 'ruleDocEnumUnresolved', agentId: agent.id, ruleId: v.ruleId, param: v.param });
      } else if (e) pushEntry(e);
      // … and host C in LOCKSTEP: every non-archived bundle snapshot of this
      // doc (the double-freeze must not diverge from the migrated doc).
      for (const b of v.hosting.channel === 'bundle' ? v.hosting.bundles : []) {
        const snap = (b.ruleSnapshots || []).find((s) => s && s.id === v.doc.id);
        if (!snap) continue;
        const se = planParamEntry({
          host: 'bundleSnapshot', docPath: b.docPath,
          field: `ruleSnapshots[${snap.id}].paramValues.${v.param}`,
          v, replacementMaps, agent, reports: [], // reported once via host B
        });
        if (se && se !== 'unequip') pushEntry(se);
      }
    }
  }

  for (const { bundle, cutDocIds, ruleIds } of membershipCuts.values()) {
    pushEntry({
      host: 'bundleSnapshot', docPath: bundle.docPath, field: 'ruleIds',
      action: 'unequip', beforeValue: bundle.ruleIds || [],
      afterValue: (bundle.ruleIds || []).filter((id) => !cutDocIds.has(id)),
      ruleId: [...ruleIds].sort().join(','), archetype, cellRef: null,
    });
  }

  if (unequippedTraitIds.size > 0) {
    const before = agent.equippedTraits || [];
    pushEntry({
      host: 'agentDoc', docPath: agent.docPath, field: 'equippedTraits',
      action: 'unequip', beforeValue: before,
      afterValue: before.filter((t) => !unequippedTraitIds.has(typeof t === 'string' ? t : t?.traitId ?? t?.id)),
      ruleId: null, archetype, cellRef: null,
    });
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

  return { entries, reports };

  function planParamEntry({ host, docPath, field, v, replacementMaps: maps, agent: a, reports: r }) {
    const { domain, value, ruleId, param } = v;
    if ('allow' in domain) {
      const res = resolveEnumReplacement(domain, value, maps?.[ruleId]?.[param] ?? {});
      if (res.kind === 'unequip') return 'unequip';
      const typed = typeof value === 'string' && typeof res.afterValue === 'number' ? String(res.afterValue) : res.afterValue;
      return {
        host, docPath, field, action: 'replace',
        beforeValue: value, afterValue: typed,
        ruleId, archetype: a.archetype, cellRef: cellRefFor(ruleId, a.archetype),
      };
    }
    const clamped = clampToDomain(domain, value);
    if (clamped === null) {
      if (domainIsRange(domain)) r.push({ class: 'nonNumericClamp', agentId: a.id, ruleId, param, value });
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
 * Residual scan (A10): blocking violations remaining in a RESOLVED view,
 * selected THROUGH projectActiveRules — the scanner sees exactly what would
 * behave, including the trait and draft-bundle channels. Zero after a correct
 * apply. Shares the kernel — cannot disagree with the planner.
 */
export function scanAgentForResiduals({ agent, ruleDocs = [], bundles = [] }) {
  return projectedViolations({ agent, ruleDocs, bundles })
    .filter((v) => v.kind === 'core_conflict' || v.kind === 'param_out_of_domain')
    .map(({ doc, hosting, ...v }) => v);
}

/**
 * THE resolve-then-scan composition (founder dry-run fix, Aug 6 2026): apply
 * the planned overlay to EVERY record class — agent doc, rule docs, AND bundle
 * snapshots — then scan the resolved view. The first dry-run's runner rebuilt
 * this composition inline and passed RAW pre-overlay ruleDocs, so all 9
 * reported residuals were phantoms mapping 1:1 to planner ruleDoc entries.
 * One shared helper, two callers (the A10 battery rows and migration-scan.js),
 * so the reporter can never again drift from the tested path.
 */
export function scanResidualsAfterPlan({ agent, ruleDocs = [], bundles = [], entries = [] }) {
  const baseDocs = { [agent.docPath]: agent };
  for (const b of bundles) baseDocs[b.docPath] = b;
  for (const r of ruleDocs) baseDocs[r.docPath] = r;
  const { effectiveDocs } = resolveEffectiveConfig({ baseDocs, overlayEntries: entries });
  return scanAgentForResiduals({
    agent: effectiveDocs[agent.docPath],
    ruleDocs: ruleDocs.map((r) => effectiveDocs[r.docPath]),
    bundles: bundles.map((b) => effectiveDocs[b.docPath]),
  });
}

export { resolveNarrowedDomains, isDomain };
