// api/_utils/compileBuild.candidate.test.js
//
// Composition PR 3 — the CompiledBuild LEGALITY BOUNDARY (spec §7 row 3):
//   A7  — an invalid PERSISTED value rejects/quarantines the build, NEVER
//         clamps (clamping exists in exactly one place: the migration planner)
//   A15 — core_conflict/deferred are illegal pairs failing CLOSED, verified
//         by the read predicate (the assembler assertion is
//         compositionAdvisoryRender's admissibility gate)
//   C2  — the client-authoring bypass closes HERE: a banned pairing written
//         through the client SDK (never through equip enforcement) compiles
//         to a rejection, so it can never behave
//
// Cells flow through the REAL candidate path: registry →
// resolveEquippedCompatCells({candidateMode:true}) → toCompilerCompatCell →
// compileBuild. Metadata is fixture-complete (the base-metadata apply arc is
// sequenced separately — X6), isolating the LEGALITY boundary from the
// metadata gap.

import { describe, it, expect } from 'vitest';
import { compileBuild } from './compileBuild.js';
import { resolveEquippedCompatCells } from './compileOnSettingsChange.js';
import { checkCompiledBuildAdmissible, isCompiledBuildAdmissible } from './compiledBuildPredicate.js';
import {
  FIXTURE_NOW, fixtureVersions, fixturePlatformGuardrails,
} from './compilerFixtures.js';
import { getGameModePolicy, computeGameModePolicyHash } from './gameModePolicy.js';

const COMPLETE_META = Object.freeze({
  intendedMode: 'behavioral_guidance', copyClass: 'advisory', receiptTag: 'fixture_tag', modes: 'clash',
});

function candidateCompile({ archetype, snaps }) {
  const bundles = [{
    bundleId: 'b1',
    ruleIds: snaps.map((s) => s.id),
    ruleSnapshots: snaps,
  }];
  const compatCells = resolveEquippedCompatCells(bundles, archetype, { candidateMode: true });
  const ruleMetadata = {};
  for (const s of snaps) ruleMetadata[s.id] = { ...COMPLETE_META };
  const def = { codeId: archetype, identityVersion: 1, identityHash: 'fixture-hash' };
  return compileBuild({
    archetypeDefinition: def,
    userBuildDelta: {
      agentId: 'fx-agent', settingsRev: 7,
      parentArchetypeId: archetype, parentIdentityVersion: 1,
      equippedBundles: bundles, ruleMetadata, compatCells, userGuardrails: [],
    },
    platformGuardrails: fixturePlatformGuardrails,
    gameModePolicy: getGameModePolicy('clash'),
    gameModePolicyHash: computeGameModePolicyHash('clash'),
    versions: fixtureVersions,
    now: FIXTURE_NOW,
  });
}

const snap = (id, sourceRef, paramValues = {}) => ({ id, sourceRef, paramValues, params: {} });

describe('C2 closure — a CLIENT-AUTHORED banned pairing compiles to a rejection', () => {
  it('degen + r-09 (core_conflict, written through the SDK, never through equip enforcement) → blocked, excluded, admissible-as-neutralized', () => {
    const build = candidateCompile({ archetype: 'degen', snaps: [snap('rd1', 'r-09')] });
    const v = build.compatVerdicts.find((x) => x.ruleId === 'rd1');
    expect(v.verdict).toBe('core_conflict');
    expect(v.blocked).toBe(true);
    expect(build.blockedControls.some((b) => b.ruleId === 'rd1' && b.blockedBy === 'core_conflict')).toBe(true);
    // the pairing is REJECTED (cannot behave), the build is legal-as-neutralized:
    expect(isCompiledBuildAdmissible(build)).toBe(true);
  });

  it('deferred is an illegal pair at this boundary too — fails closed exactly like core_conflict (A15)', () => {
    const build = candidateCompile({ archetype: 'degen', snaps: [snap('rd2', 'f-12')] });
    const v = build.compatVerdicts.find((x) => x.ruleId === 'rd2');
    expect(v.verdict).toBe('deferred');
    expect(v.blocked).toBe(true);
    expect(build.blockedControls.some((b) => b.ruleId === 'rd2' && b.blockedBy === 'deferred')).toBe(true);
  });
});

describe('A7 — invalid persisted values quarantine the build, NEVER clamp', () => {
  it('alloc-sector-cap/momentum_chaser pct:90 vs narrowed {pct∈[40,80]} → param_out_of_domain + quarantined + blocked; NO clamped guardrail; predicate refuses', () => {
    const build = candidateCompile({ archetype: 'momentum_chaser', snaps: [snap('rd3', 'alloc-sector-cap', { pct: 90 })] });
    expect(build.validation.errors.some((e) => e.code === 'param_out_of_domain' && e.ruleId === 'rd3' && e.detail === 'paramValues.pct')).toBe(true);
    expect(build.quarantined).toBe(true);
    const v = build.compatVerdicts.find((x) => x.ruleId === 'rd3');
    expect(v.blocked).toBe(true);
    // NEVER clamps: no guardrail or verdict carries a corrected 80.
    expect(JSON.stringify(build.effectiveGuardrailsPreview)).not.toContain('80');
    const { admissible, reasons } = checkCompiledBuildAdmissible(build);
    expect(admissible).toBe(false);
    expect(reasons).toContain('quarantined');
  });

  it('the SAME rule with an in-domain persisted value (pct:60) compiles clean — the domain check admits, never mutates', () => {
    const build = candidateCompile({ archetype: 'momentum_chaser', snaps: [snap('rd3', 'alloc-sector-cap', { pct: 60 })] });
    expect(build.validation.errors.some((e) => e.code === 'param_out_of_domain')).toBe(false);
    expect(build.quarantined).toBeUndefined();
    const v = build.compatVerdicts.find((x) => x.ruleId === 'rd3');
    expect(v.verdict).toBe('tension');
    expect(v.blocked).toBeUndefined();
    expect(isCompiledBuildAdmissible(build)).toBe(true);
  });
});

describe('the CompiledBuild carries verdict state, advisory sentences, and narrowed domains (candidate mode)', () => {
  it('a tension cell rides the build with its verbatim advisory + param-keyed narrowed domain', () => {
    const build = candidateCompile({ archetype: 'momentum_chaser', snaps: [snap('rd3', 'alloc-sector-cap', { pct: 60 })] });
    const v = build.compatVerdicts.find((x) => x.ruleId === 'rd3');
    expect(v.advisory).toMatch(/cap limits how much a leading sector may hold/);
    expect(v.narrowedParams).toEqual({ pct: { min: 40, max: 80 } });
  });

  it('native/neutral cells carry advisory:null and render-affect nothing (A14 precondition)', () => {
    const build = candidateCompile({ archetype: 'degen', snaps: [snap('rd4', 'tech-volume-surge')] });
    const v = build.compatVerdicts.find((x) => x.ruleId === 'rd4');
    expect(['native', 'compatible']).toContain(v.verdict);
    expect(v.advisory).toBeNull();
    expect(v.blocked).toBeUndefined();
  });

  it('DARK (legacy source): verdict entries carry NO advisory/narrowedParams/quarantined keys — byte-identical builds', () => {
    const bundles = [{ bundleId: 'b1', ruleIds: ['rd4'], ruleSnapshots: [snap('rd4', 'tech-volume-surge')] }];
    const cells = resolveEquippedCompatCells(bundles, 'degen'); // flag default: legacy
    const build = compileBuild({
      archetypeDefinition: { codeId: 'degen', identityVersion: 1, identityHash: 'x' },
      userBuildDelta: {
        agentId: 'fx-agent', settingsRev: 7, parentArchetypeId: 'degen', parentIdentityVersion: 1,
        equippedBundles: bundles, ruleMetadata: { rd4: { ...COMPLETE_META } }, compatCells: cells, userGuardrails: [],
      },
      platformGuardrails: fixturePlatformGuardrails,
      gameModePolicy: getGameModePolicy('clash'),
      gameModePolicyHash: computeGameModePolicyHash('clash'),
      versions: fixtureVersions,
      now: FIXTURE_NOW,
    });
    expect('quarantined' in build).toBe(false);
    for (const v of build.compatVerdicts) {
      expect('advisory' in v).toBe(false);
      expect('narrowedParams' in v).toBe(false);
    }
    // Review F6: byte-identity pinned as a GOLDEN, not just key absence —
    // this hash was captured from the dark path at the PR-3 base; any change
    // to a dark build's bytes (key order, new fields, changed errors) fails
    // here and demands a reviewed bump.
    expect(build.contentHash).toBe('aa9f1e1a30ae2a48a1f9b0bfe06820e7f60af8cecacc9a1e0c22739064493420');
  });
});

describe('A15 — the read predicate fails closed on an unblocked illegal pair', () => {
  it('a hand-tampered build whose core_conflict entry lost blocked:true is INADMISSIBLE', () => {
    const build = candidateCompile({ archetype: 'degen', snaps: [snap('rd1', 'r-09')] });
    const tampered = {
      ...build,
      compatVerdicts: build.compatVerdicts.map((v) => (v.ruleId === 'rd1' ? { ...v, blocked: false } : v)),
    };
    const { admissible, reasons } = checkCompiledBuildAdmissible(tampered);
    expect(admissible).toBe(false);
    expect(reasons.some((r) => r.startsWith('unblocked_illegal_pair:rd1'))).toBe(true);
  });

  it('an absent build is inadmissible (fail closed, never a fallback identity)', () => {
    expect(isCompiledBuildAdmissible(null)).toBe(false);
    expect(checkCompiledBuildAdmissible(undefined).reasons).toEqual(['build_missing']);
  });
});

describe('the manifest carries the compat slice the eval assembler consumes (the end-to-end thread)', () => {
  it('buildResolvedAgentManifest: a candidate-mode build → compositionCompat slice, verbatim entries; a legacy build → NO slice key', async () => {
    const { buildResolvedAgentManifest } = await import('./resolvedAgentManifest.js');
    const agentData = { id: 'fx-agent', archetype: 'momentum_chaser', settingsRev: 7, config: {}, equippedBundleIds: [] };
    const candidateBuild = candidateCompile({ archetype: 'momentum_chaser', snaps: [snap('rd3', 'alloc-sector-cap', { pct: 60 })] });
    const withSlice = buildResolvedAgentManifest({ agentData, compiledBuild: { ...candidateBuild, sourceRevisionVector: { ...candidateBuild.sourceRevisionVector, settingsRev: 7 } }, equippedWatchlist: null, gameMode: 'clash', now: FIXTURE_NOW });
    expect(withSlice.compositionCompat).toBeTruthy();
    const entry = withSlice.compositionCompat.entries.find((e) => e.ruleId === 'rd3');
    expect(entry.verdict).toBe('tension');
    expect(entry.advisory).toMatch(/cap limits how much a leading sector may hold/);
    expect(entry.narrowedParams).toEqual({ pct: { min: 40, max: 80 } });

    const legacy = buildResolvedAgentManifest({ agentData, compiledBuild: null, equippedWatchlist: null, gameMode: 'clash', now: FIXTURE_NOW });
    expect('compositionCompat' in legacy).toBe(false);
  });
});

describe('A7 agrees with the equip/save kernel on legitimately-persisted sparse shapes (design review F2)', () => {
  it.each([
    ['paramValues: null (forgeService first-class shape)', null],
    ['paramValues: {} (empty object)', {}],
    ['paramValues: { pct: null } (explicit null — unset at render)', { pct: null }],
  ])('%s on a narrowed-domain cell compiles CLEAN — no quarantine, no ambiguity error', (_n, paramValues) => {
    const s = { id: 'rd3', sourceRef: 'alloc-sector-cap', params: { sector: {}, pct: {} } };
    if (paramValues !== null) s.paramValues = paramValues; else s.paramValues = null;
    const build = candidateCompile({ archetype: 'momentum_chaser', snaps: [s] });
    expect(build.quarantined).toBeUndefined();
    expect(build.validation.errors.some((e) => e.code === 'param_out_of_domain' || e.code === 'ambiguous_domain_binding')).toBe(false);
    expect(isCompiledBuildAdmissible(build)).toBe(true);
  });

  it('paramKeys derive from snapshot.params when present (the kernel derivation) — a bare-domain cell + multi-param doc still fails closed IDENTICALLY in both', async () => {
    // gs-02/guardian is param-keyed post-A11; simulate the drift case with the
    // kernel side-by-side to pin the agreement itself.
    const { checkCandidatePairing } = await import('./compositionEnforcement.js');
    const kernelVerdict = checkCandidatePairing({
      ruleId: 'alloc-sector-cap', archetype: 'momentum_chaser',
      paramValues: { sector: 'Technology', pct: 90 }, paramKeys: ['sector', 'pct'],
    });
    const build = candidateCompile({
      archetype: 'momentum_chaser',
      snaps: [{ id: 'rd3', sourceRef: 'alloc-sector-cap', params: { sector: {}, pct: {} }, paramValues: { sector: 'Technology', pct: 90 } }],
    });
    // both sides: pct out of the narrowed [40,80]; sector untouched
    expect(kernelVerdict.some((v) => v.kind === 'param_out_of_domain' && v.param === 'pct')).toBe(true);
    expect(build.validation.errors.some((e) => e.code === 'param_out_of_domain' && e.detail === 'paramValues.pct')).toBe(true);
    expect(build.validation.errors.some((e) => e.detail === 'paramValues.sector')).toBe(false);
  });
});

describe('a BLOCKED tension rule never rides renderedTensionCandidates (design review F5)', () => {
  it('an out-of-domain (quarantined+blocked) tension rule is absent from the tension feed; a clean one is present', () => {
    const blocked = candidateCompile({ archetype: 'momentum_chaser', snaps: [snap('rd3', 'alloc-sector-cap', { pct: 90 })] });
    expect(blocked.renderedTensionCandidates.some((t) => t.ruleId === 'rd3')).toBe(false);
    const clean = candidateCompile({ archetype: 'momentum_chaser', snaps: [snap('rd3', 'alloc-sector-cap', { pct: 60 })] });
    expect(clean.renderedTensionCandidates.some((t) => t.ruleId === 'rd3')).toBe(true);
  });
});
