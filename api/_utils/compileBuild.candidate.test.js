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
