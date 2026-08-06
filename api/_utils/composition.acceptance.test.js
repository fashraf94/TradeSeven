// api/_utils/composition.acceptance.test.js
//
// Composition PR 2 — the acceptance battery over the PURE core (spec §9 rows
// A7–A10, A12, A36*, A41–A42, A44, A47, A49; the endpoint-boundary rows
// A4–A6/A23/A27 live in composition.endpoints.test.js, the census row A46 in
// compositionWriterCensus.test.js, the structural halves of A25/A36 in
// compositionForbiddenReads.test.js). Every test names the defect it fails
// under; the mutation pass (docs/audits record) verifies each can fail.

import { describe, it, expect } from 'vitest';
import {
  checkCandidatePairing, checkCandidateEquipLegality, resolveNarrowedDomains, isBlockingViolation,
} from './compositionEnforcement.js';
import {
  resolveEffectiveConfig, applyFieldValue, buildEntryKey, computeOverlayContentHash,
} from './compositionStateResolver.js';
import {
  planAgentMigration, scanAgentForResiduals, scanResidualsAfterPlan, clampToDomain, resolveEnumReplacement,
} from './compositionMigration.js';
import { validateWriteEpochInTx, assertWriteEpochOpen, EpochClosedError } from './compositionWriteEpoch.js';
import { buildIdentityMigrationFeedEntries, projectIdentityMigrationFeed } from './identityMigrationFeed.js';

// ── fixtures: a small fleet exercising every M4 class, built on REAL candidate
// cells (alloc-sector-cap/mc tension {min:40,max:80}; r-09/degen core_conflict;
// f-12 deferred; risk-avoid-declining-trend/contrarian {period allow:[50]}) ──
const snap = (id, sourceRef, paramValues, params) => ({ id, sourceRef, paramValues, params });

function mcAgentFixture() {
  return {
    agent: { id: 'agent-mc', docPath: 'agents/agent-mc', archetype: 'momentum_chaser', equippedBundleIds: ['b1'] },
    ruleDocs: [
      { id: 'rd1', docPath: 'agents/agent-mc/rules/rd1', sourceRef: 'alloc-sector-cap', paramValues: { pct: 90 }, params: { pct: {} } },
    ],
    bundles: [
      { id: 'b1', docPath: 'agents/agent-mc/bundles/b1', status: 'equipped', ruleIds: ['rd1'], ruleSnapshots: [
        snap('rd1', 'alloc-sector-cap', { pct: 90 }, { pct: {} }),
      ] },
    ],
  };
}
function degenAgentFixture() {
  // realistic shape: rule DOCS exist (forge authors docs; bundles reference
  // them by id and freeze snapshots) — the projection kernel judges the docs.
  return {
    agent: { id: 'agent-dg', docPath: 'agents/agent-dg', archetype: 'degen', equippedBundleIds: ['b1', 'b2'] },
    ruleDocs: [
      { id: 'r1', docPath: 'agents/agent-dg/rules/r1', sourceRef: 'r-09', paramValues: { pct: 10 }, params: { pct: {} } },
      { id: 'r2', docPath: 'agents/agent-dg/rules/r2', sourceRef: 'tech-volume-surge', paramValues: {}, params: {} },
    ],
    bundles: [
      { id: 'b1', docPath: 'agents/agent-dg/bundles/b1', status: 'equipped', ruleIds: ['r1'], ruleSnapshots: [
        snap('r1', 'r-09', { pct: 10 }, { pct: {} }), // core_conflict for degen (R-14)
      ] },
      { id: 'b2', docPath: 'agents/agent-dg/bundles/b2', status: 'equipped', ruleIds: ['r2'], ruleSnapshots: [
        snap('r2', 'tech-volume-surge', {}, {}),      // neutral for degen — must survive
      ] },
    ],
  };
}
// C1 fix channels (adversarial review): what PROJECTS is what migrates.
function traitChannelFixture() {
  return {
    agent: { id: 'agent-tc', docPath: 'agents/agent-tc', archetype: 'contrarian', equippedTraits: [{ traitId: 'trait-breakout-chaser' }], equippedBundleIds: [] },
    ruleDocs: [
      // trait-hosted, NO bundle — projects via the trait channel; tv-11 is
      // core_conflict for contrarian.
      { id: 'td1', docPath: 'agents/agent-tc/rules/td1', traitId: 'trait-breakout-chaser', sourceRef: 'tv-11', paramValues: {}, params: {}, createdAt: 1 },
    ],
    bundles: [],
  };
}
function draftChannelFixture() {
  return {
    agent: { id: 'agent-dc', docPath: 'agents/agent-dc', archetype: 'degen', equippedBundleIds: [] },
    ruleDocs: [
      { id: 'r1', docPath: 'agents/agent-dc/rules/r1', sourceRef: 'r-09', paramValues: {}, params: {} },  // banned for degen
      { id: 'r2', docPath: 'agents/agent-dc/rules/r2', sourceRef: 'a-05', paramValues: {}, params: {} },  // ALSO banned for degen (R-43)
      { id: 'r3', docPath: 'agents/agent-dc/rules/r3', sourceRef: 'tech-volume-surge', paramValues: {}, params: {} },
    ],
    bundles: [
      // a DRAFT bundle projects its members (projectActiveRules:76-79)
      { id: 'bd', docPath: 'agents/agent-dc/bundles/bd', status: 'draft', ruleIds: ['r1', 'r2', 'r3'], ruleSnapshots: [] },
    ],
  };
}

describe('A7 — invalid persisted value REJECTS at the boundary; nothing outside the migration clamps', () => {
  it('out-of-domain persisted param is a named violation (value untouched)', () => {
    const v = checkCandidatePairing({
      ruleId: 'alloc-sector-cap', archetype: 'momentum_chaser',
      paramValues: { pct: 90 }, paramKeys: ['pct'],
    });
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ kind: 'param_out_of_domain', param: 'pct', value: 90 });
    expect(isBlockingViolation(v[0])).toBe(true);
  });
  it('in-domain value is legal; select-string values compare numerically', () => {
    expect(checkCandidatePairing({ ruleId: 'alloc-sector-cap', archetype: 'momentum_chaser', paramValues: { pct: 60 }, paramKeys: ['pct'] })).toEqual([]);
    // risk-avoid-declining-trend/contrarian: {period: allow:[50]}; stored select value "50" (string)
    expect(checkCandidatePairing({ ruleId: 'risk-avoid-declining-trend', archetype: 'contrarian', paramValues: { period: '50' }, paramKeys: ['period'] })).toEqual([]);
    expect(checkCandidatePairing({ ruleId: 'risk-avoid-declining-trend', archetype: 'contrarian', paramValues: { period: '200' }, paramKeys: ['period'] })[0]?.kind).toBe('param_out_of_domain');
  });
  it('the enforcement kernel exports NO clamp — clamping exists only in the migration planner (B8)', async () => {
    const enforcement = await import('./compositionEnforcement.js');
    expect(Object.keys(enforcement).some((k) => /clamp|coerce/i.test(k))).toBe(false);
  });
  it('core_conflict and deferred are explicit blocking violations (B1: deferred ≠ absence)', () => {
    expect(checkCandidatePairing({ ruleId: 'r-09', archetype: 'degen' })[0]).toMatchObject({ kind: 'core_conflict' });
    expect(checkCandidatePairing({ ruleId: 'f-12', archetype: 'guardian' })[0]).toMatchObject({ kind: 'deferred' });
  });
  it('ambiguous bare-domain binding is SURFACED, never guessed', () => {
    const { ambiguous } = resolveNarrowedDomains({ min: 40, max: 80 }, ['a', 'b']);
    expect(ambiguous).toBe(true);
    const bound = resolveNarrowedDomains({ min: 40, max: 80 }, ['pct']);
    expect(bound).toEqual({ domains: { pct: { min: 40, max: 80 } }, ambiguous: false });
  });
});

describe('A8 — dry-run selection == apply selection (one planner, deterministic)', () => {
  it('planning the same fleet twice yields identical entries (and an identical overlay hash)', () => {
    const a = planAgentMigration({ ...mcAgentFixture(), migrationRunId: 'run-1' });
    const b = planAgentMigration({ ...mcAgentFixture(), migrationRunId: 'run-1' });
    expect(a.entries).toEqual(b.entries);
    expect(computeOverlayContentHash(a.entries)).toBe(computeOverlayContentHash(b.entries));
  });
  it('M4 per-shape semantics: range clamps to NEAREST bound; floor floors; enum auto-replaces only a singleton allow-list', () => {
    expect(clampToDomain({ min: 40, max: 80 }, 90)).toBe(80);
    expect(clampToDomain({ min: 40, max: 80 }, 10)).toBe(40);
    expect(clampToDomain({ min: 40, max: 80 }, 60)).toBe(null);   // in-domain → no entry
    expect(clampToDomain({ minOnly: 1.0 }, 0.5)).toBe(1.0);
    expect(clampToDomain({ min: 40, max: 80 }, '90')).toBe('80'); // stored-type preserved
    expect(resolveEnumReplacement({ allow: [50] }, '200')).toEqual({ kind: 'replace', afterValue: 50 });
    expect(resolveEnumReplacement({ allow: ['light', 'moderate'] }, 'heavy')).toEqual({ kind: 'unequip' });
    expect(resolveEnumReplacement({ allow: ['light', 'moderate'] }, 'heavy', { heavy: 'moderate' }))
      .toEqual({ kind: 'replace', afterValue: 'moderate' });
  });
  it('a banned pairing plans the COMPLETE unequip: bundle status + membership cut + agent echo — and spares legal bundles', () => {
    const { entries } = planAgentMigration({ ...degenAgentFixture(), migrationRunId: 'run-1' });
    const unequips = entries.filter((e) => e.action === 'unequip');
    // status flip alone is NOT an unequip under projection semantics — a
    // forged bundle still projects; the membership cut is what stops behavior.
    expect(unequips.map((e) => `${e.host}:${e.field}`).sort())
      .toEqual(['agentDoc:equippedBundleIds', 'bundleSnapshot:ruleIds', 'bundleSnapshot:status']);
    expect(unequips.find((e) => e.host === 'agentDoc').afterValue).toEqual(['b2']); // b2 (neutral) survives
    expect(unequips.find((e) => e.field === 'ruleIds').afterValue).toEqual([]);     // r1 cut from b1
  });
});

describe('A9 — migration is idempotent and logs once', () => {
  it('planning over the RESOLVED (already-overlaid) view yields zero new entries', () => {
    const fx = mcAgentFixture();
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    expect(entries.length).toBeGreaterThan(0);
    const baseDocs = { [fx.agent.docPath]: fx.agent };
    for (const b of fx.bundles) baseDocs[b.docPath] = b;
    for (const r of fx.ruleDocs) baseDocs[r.docPath] = r;
    const { effectiveDocs } = resolveEffectiveConfig({ baseDocs, overlayEntries: entries });
    const second = planAgentMigration({
      agent: effectiveDocs[fx.agent.docPath],
      ruleDocs: fx.ruleDocs.map((r) => effectiveDocs[r.docPath]),
      bundles: fx.bundles.map((b) => effectiveDocs[b.docPath]),
      migrationRunId: 'run-2',
    });
    expect(second.entries).toEqual([]);
  });
  it('duplicate targets dedupe on entryKey (logs once) — proven on a bundle carrying the SAME snapshot twice', () => {
    // Review C1: the plain fixtures structurally cannot collide, so this row
    // must manufacture a genuine duplicate — a corrupted bundle listing one
    // snapshot id twice. Without the entryKey dedupe guard this yields TWO
    // entries for one target and the assertion fails.
    const fx = mcAgentFixture();
    const dupSnap = fx.bundles[0].ruleSnapshots[0];
    fx.bundles[0].ruleSnapshots = [dupSnap, { ...dupSnap }];
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    const keys = entries.map((e) => e.entryKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(entries.filter((e) => e.docPath === fx.bundles[0].docPath && e.field.includes('paramValues.pct'))).toHaveLength(1);
  });

  it('C2/C4 pins — the epoch doc address of record and the shipped dark defaults', async () => {
    const epoch = await import('./compositionWriteEpoch.js');
    expect(`${epoch.WRITE_EPOCH_COLLECTION}/${epoch.WRITE_EPOCH_DOC_ID}`).toBe('composition/writeEpoch'); // the §8 runbook + rules layer address
    const cfg = await import('./compositionConfig.js');
    expect(cfg.COMPOSITION_ENFORCEMENT_MODE).toBe('off');
    expect(cfg.COMPOSITION_EPOCH_FENCE_ENABLED).toBe(false);
    expect(cfg.COMPOSITION_MIGRATION_FEED_ENABLED).toBe(false);
    const ff = await import('../../src/config/featureFlags.js');
    expect(ff.COMPOSITION_DISPLAY_ENABLED).toBe(false);
  });
});

describe('A10 — post-apply residual scan is zero (planner and scanner share one kernel)', () => {
  it.each([['momentum_chaser fleet', mcAgentFixture], ['degen fleet', degenAgentFixture]])('%s scans clean after resolve — through the SHARED helper the runner calls', (_n, fixture) => {
    const fx = fixture();
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    expect(scanResidualsAfterPlan({ ...fx, entries })).toEqual([]);
  });

  it('reporter regression (founder dry-run, Aug 6): a ruleDoc-clamped agent scans clean through the helper — and the phantom shape (raw pre-overlay ruleDocs) provably does NOT', () => {
    // The first dry-run's runner rebuilt the resolve-then-scan composition
    // inline and fed RAW ruleDocs: all 9 reported residuals were phantoms
    // mapping 1:1 to planner ruleDoc entries. The helper is now the one path.
    const fx = mcAgentFixture(); // alloc-sector-cap pct:90 vs domain {40..80} → ruleDoc clamp entry
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    expect(entries.some((e) => e.host === 'ruleDoc')).toBe(true); // the defect's trigger class is present
    expect(scanResidualsAfterPlan({ ...fx, entries })).toEqual([]);

    // The defect, reproduced: same resolved agent+bundles, raw ruleDocs —
    // the planned clamp re-reports as a phantom. This row is what makes the
    // helper's ruleDocs mapping mutation-sensitive.
    const baseDocs = { [fx.agent.docPath]: fx.agent };
    for (const b of fx.bundles) baseDocs[b.docPath] = b;
    for (const r of fx.ruleDocs) baseDocs[r.docPath] = r;
    const { effectiveDocs } = resolveEffectiveConfig({ baseDocs, overlayEntries: entries });
    const phantoms = scanAgentForResiduals({
      agent: effectiveDocs[fx.agent.docPath],
      ruleDocs: fx.ruleDocs, // RAW — the dry-run reporter's bug
      bundles: fx.bundles.map((b) => effectiveDocs[b.docPath]),
    });
    expect(phantoms.some((v) => v.kind === 'param_out_of_domain' && v.ruleId === 'alloc-sector-cap')).toBe(true);
  });

  it('an actually-UNPLANNED violation still fails the resolved-view scan (the helper cannot blanket-suppress)', () => {
    const fx = degenAgentFixture(); // r-09 core_conflict for degen
    const residuals = scanResidualsAfterPlan({ ...fx, entries: [] }); // no plan applied
    expect(residuals.some((v) => v.kind === 'core_conflict' && v.ruleId === 'r-09')).toBe(true);
  });
});

describe('C1 — the projection channels the v1 planner missed (trait + draft-bundle) migrate and scan clean', () => {
  it('a banned TRAIT-hosted rule (no bundle) plans an equippedTraits unequip; the scanner sees it pre-apply and clean post-resolve', () => {
    const fx = traitChannelFixture();
    const pre = scanAgentForResiduals(fx);
    expect(pre.some((r) => r.kind === 'core_conflict' && r.ruleId === 'tv-11')).toBe(true); // the v1 scanner returned [] here
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    const traitCut = entries.find((e) => e.host === 'agentDoc' && e.field === 'equippedTraits');
    expect(traitCut).toBeTruthy();
    expect(traitCut.afterValue).toEqual([]); // trait-breakout-chaser removed — its rules stop projecting
    const baseDocs = { [fx.agent.docPath]: fx.agent };
    for (const r of fx.ruleDocs) baseDocs[r.docPath] = r;
    const { effectiveDocs } = resolveEffectiveConfig({ baseDocs, overlayEntries: entries });
    expect(scanAgentForResiduals({ agent: effectiveDocs[fx.agent.docPath], ruleDocs: fx.ruleDocs, bundles: [] })).toEqual([]);
  });

  it('banned rules in a DRAFT bundle plan a membership cut — BOTH cuts land in one ruleIds entry — and scan clean post-resolve', () => {
    const fx = draftChannelFixture();
    expect(scanAgentForResiduals(fx).filter((r) => r.kind === 'core_conflict')).toHaveLength(2);
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    const cuts = entries.filter((e) => e.field === 'ruleIds');
    expect(cuts).toHaveLength(1); // accumulated — a per-violation emit would lose the second cut
    expect(cuts[0].afterValue).toEqual(['r3']); // both banned docs cut, the legal one survives
    const baseDocs = { [fx.agent.docPath]: fx.agent, [fx.bundles[0].docPath]: fx.bundles[0] };
    for (const r of fx.ruleDocs) baseDocs[r.docPath] = r;
    const { effectiveDocs } = resolveEffectiveConfig({ baseDocs, overlayEntries: entries });
    expect(scanAgentForResiduals({
      agent: effectiveDocs[fx.agent.docPath],
      ruleDocs: fx.ruleDocs,
      bundles: [effectiveDocs[fx.bundles[0].docPath]],
    })).toEqual([]);
  });
});

describe('A12 + A36 (pure half) — base records are never in the write set; the old-identity view is untouched', () => {
  it('the planner emits overlay entries only; resolving never mutates base objects', () => {
    const fx = degenAgentFixture();
    const frozen = JSON.parse(JSON.stringify({ a: fx.agent, r: fx.ruleDocs, b: fx.bundles }));
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    const baseDocs = { [fx.agent.docPath]: fx.agent };
    for (const b of fx.bundles) baseDocs[b.docPath] = b;
    resolveEffectiveConfig({ baseDocs, overlayEntries: entries });
    expect({ a: fx.agent, r: fx.ruleDocs, b: fx.bundles }).toEqual(frozen); // byte-untouched
    expect(entries.every((e) => e.beforeValue !== undefined)).toBe(true);   // M10 before-images
  });
  it('the OLD-identity view (includeOverlay:false) never observes migrated state (A36)', () => {
    const fx = mcAgentFixture();
    const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
    const baseDocs = {}; for (const b of fx.bundles) baseDocs[b.docPath] = b;
    const oldView = resolveEffectiveConfig({ baseDocs, overlayEntries: entries, includeOverlay: false });
    expect(oldView.effectiveDocs[fx.bundles[0].docPath].ruleSnapshots[0].paramValues.pct).toBe(90); // pre-migration value
  });
});

describe('A41 — an old-epoch commit after the close is REJECTED at commit', () => {
  const fakeDb = () => ({ collection: (c) => ({ doc: (d) => ({ path: `${c}/${d}`, get: async () => fakeDb._snap }) }) });
  const txReading = (snapValue) => ({ get: async () => snapValue, _gets: 0 });

  it('a closed epoch read in the transaction throws EpochClosedError (the endpoint 409s, nothing written)', async () => {
    const db = { collection: () => ({ doc: () => ({}) }) };
    const tx = { get: async () => ({ exists: true, data: () => ({ state: 'closed', epochId: 'epoch-2' }) }) };
    await expect(validateWriteEpochInTx(tx, db, { enabled: true })).rejects.toThrow(EpochClosedError);
  });
  it('open or ABSENT epoch doc admits the write (fail-open: byte-identical pre-runbook)', async () => {
    const db = { collection: () => ({ doc: () => ({}) }) };
    await expect(validateWriteEpochInTx({ get: async () => ({ exists: false }) }, db, { enabled: true }))
      .resolves.toEqual({ state: 'open', epochId: null });
    await expect(validateWriteEpochInTx({ get: async () => ({ exists: true, data: () => ({ state: 'open', epochId: 'e1' }) }) }, db, { enabled: true }))
      .resolves.toMatchObject({ state: 'open' });
  });
  it('A23: while dark the helper performs ZERO reads (byte-identical)', async () => {
    let gets = 0;
    const tx = { get: async () => { gets += 1; return { exists: false }; } };
    const out = await validateWriteEpochInTx(tx, {}, { enabled: false });
    expect(out).toBeNull();
    expect(gets).toBe(0);
    let docGets = 0;
    const db = { collection: () => ({ doc: () => ({ get: async () => { docGets += 1; return { exists: false }; } }) }) };
    await assertWriteEpochOpen(db, { enabled: false });
    expect(docGets).toBe(0);
  });
  it('the loop guard rejects a closed epoch between batches (bounded conformance)', async () => {
    const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ state: 'closed', epochId: 'e2' }) }) }) }) };
    await expect(assertWriteEpochOpen(db, { enabled: true })).rejects.toThrow('epoch_closed');
  });
});

describe('A42 + A47 + A49 — the one resolver: overlay visible to the scanner, base visible to old reads; epoch layer wins; abandoned epochs never resolve', () => {
  const base = { 'agents/a/bundles/b1': { id: 'b1', status: 'equipped', ruleSnapshots: [{ id: 'r1', paramValues: { pct: 90 } }] } };
  const overlay = [{
    host: 'bundleSnapshot', docPath: 'agents/a/bundles/b1',
    field: 'ruleSnapshots[r1].paramValues.pct', action: 'clamp', beforeValue: 90, afterValue: 80,
  }];

  it('A42: the scanner-facing view observes the overlay value while the base object holds the base value', () => {
    const { effectiveDocs, provenance } = resolveEffectiveConfig({ baseDocs: base, overlayEntries: overlay });
    expect(effectiveDocs['agents/a/bundles/b1'].ruleSnapshots[0].paramValues.pct).toBe(80);
    expect(base['agents/a/bundles/b1'].ruleSnapshots[0].paramValues.pct).toBe(90); // isolation intact
    expect(Object.values(provenance)).toContain('overlay');
  });
  it('A47: a post-activation save (epoch layer) overrides the migrated value while the overlay hash is unchanged', () => {
    const hashBefore = computeOverlayContentHash(overlay);
    const epochEntry = [{
      host: 'bundleSnapshot', docPath: 'agents/a/bundles/b1',
      field: 'ruleSnapshots[r1].paramValues.pct', action: 'replace', beforeValue: 80, afterValue: 60, epochId: 'epoch-1',
    }];
    const { effectiveDocs, provenance } = resolveEffectiveConfig({
      baseDocs: base, overlayEntries: overlay, epochOverrideEntries: epochEntry, activeEpochId: 'epoch-1',
    });
    expect(effectiveDocs['agents/a/bundles/b1'].ruleSnapshots[0].paramValues.pct).toBe(60); // epoch wins
    expect(computeOverlayContentHash(overlay)).toBe(hashBefore); // A47: overlay untouched
    const key = buildEntryKey(epochEntry[0]);
    expect(provenance[key]).toBe('epoch');
  });
  it('A49: an abandoned epoch\'s overrides are retained but EXCLUDED from resolution after rollback/re-activation', () => {
    const abandoned = [{
      host: 'bundleSnapshot', docPath: 'agents/a/bundles/b1',
      field: 'ruleSnapshots[r1].paramValues.pct', action: 'replace', beforeValue: 80, afterValue: 55, epochId: 'epoch-1',
    }];
    // rollback: activeEpochId null → overlay value governs, epoch-1 silent
    const rolledBack = resolveEffectiveConfig({ baseDocs: base, overlayEntries: overlay, epochOverrideEntries: abandoned, activeEpochId: null });
    expect(rolledBack.effectiveDocs['agents/a/bundles/b1'].ruleSnapshots[0].paramValues.pct).toBe(80);
    // re-activation under a FRESH epoch: epoch-1 entries still never resolve
    const reactivated = resolveEffectiveConfig({ baseDocs: base, overlayEntries: overlay, epochOverrideEntries: abandoned, activeEpochId: 'epoch-2' });
    expect(reactivated.effectiveDocs['agents/a/bundles/b1'].ruleSnapshots[0].paramValues.pct).toBe(80);
  });
  it('a dangling entry (deleted target) is REPORTED, never silently dropped or invented', () => {
    const { dangling } = resolveEffectiveConfig({
      baseDocs: base,
      overlayEntries: [{ host: 'bundleSnapshot', docPath: 'agents/a/bundles/GONE', field: 'status', afterValue: 'forged' }],
    });
    expect(dangling).toHaveLength(1);
    expect(dangling[0].reason).toBe('doc_missing');
  });
  it('applyFieldValue addresses ruleSnapshots by ID, never by index', () => {
    const doc = { ruleSnapshots: [{ id: 'x', v: 1 }, { id: 'y', v: 2 }] };
    const { node, applied } = applyFieldValue(doc, 'ruleSnapshots[y].v', 9);
    expect(applied).toBe(true);
    expect(node.ruleSnapshots[1].v).toBe(9);
    expect(doc.ruleSnapshots[1].v).toBe(2); // immutability
  });
});

describe('A44 — identityMigration feed entries are invisible before activation', () => {
  const fx = degenAgentFixture();
  const { entries } = planAgentMigration({ ...fx, migrationRunId: 'run-1' });
  const feedEntries = buildIdentityMigrationFeedEntries(entries, { nowIso: '2026-08-06T00:00:00Z', migrationRunId: 'run-1' });
  const runDoc = { candidateStateId: 'run-1', feedEntries };

  it('builds candidate-namespaced entries in the statusFeed shape (no agent-doc echoes)', () => {
    expect(feedEntries.length).toBeGreaterThan(0);
    for (const e of feedEntries) {
      expect(e.type).toBe('identity_migration');
      expect(typeof e.copy).toBe('string');
    }
    expect(feedEntries.some((e) => e.meta.docPath.startsWith('agents/agent-dg/bundles'))).toBe(true);
  });
  it('projector returns [] while the flag is dark, regardless of activation', () => {
    expect(projectIdentityMigrationFeed({ runDoc, activationRecord: { candidateStateId: 'run-1' }, enabled: false })).toEqual([]);
  });
  it('projector returns [] pre-activation and under a DIFFERENT epoch; publishes only under its own activation record', () => {
    expect(projectIdentityMigrationFeed({ runDoc, activationRecord: null, enabled: true })).toEqual([]);
    expect(projectIdentityMigrationFeed({ runDoc, activationRecord: { candidateStateId: 'other-run' }, enabled: true })).toEqual([]);
    expect(projectIdentityMigrationFeed({ runDoc, activationRecord: { candidateStateId: 'run-1' }, enabled: true })).toEqual(feedEntries);
  });
});

describe('equip-boundary kernel (feeds A4/A5 endpoint rows)', () => {
  it('flags every violating snapshot in a bundle and passes legal ones', () => {
    const violations = checkCandidateEquipLegality({
      ruleSnapshots: [
        snap('r1', 'r-09', {}, {}),                          // core_conflict for degen
        snap('r2', 'f-12', {}, {}),                          // deferred
        snap('r3', 'tech-volume-surge', {}, {}),             // neutral — legal
        snap('r4', null, {}, {}),                            // manual rule — outside jurisdiction
      ],
      archetype: 'degen',
    });
    expect(violations.map((v) => v.kind).sort()).toEqual(['core_conflict', 'deferred']);
  });
});
