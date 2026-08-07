// api/_utils/composition.a7lock.test.js
//
// Composition PR 4 — A7-LOCK (ledger row, extends A7): the version FREEZE
// gate + the corpus-wide compile-vs-kernel legality PARITY differential.
//
// FREEZE GATE: docs/composition/ACTIVATION_EVIDENCE.json pins the four
// frozen values (ARCHETYPE_IDENTITY_VERSION, RULE_LIBRARY_VERSION, the
// candidate registry manifestHash, the compositionEnforcement kernel content
// hash). This suite recomputes each from HEAD — drift fails, so the SHA the
// founder ratifies at FINAL-DRYRUN is provably the SHA that activates. A
// deliberate change regenerates the evidence (GENERATE_ACTIVATION_EVIDENCE=1
// npx vitest run api/_utils/composition.a7lock.test.js) in the same commit —
// and, per the freeze declaration, invalidates any prior FINAL-DRYRUN
// ratification.
//
// PARITY DIFFERENTIAL: the PR-3 review F2 agreement (the compile boundary's
// A7 guards mirror checkCandidatePairing exactly) proven CORPUS-WIDE, not on
// fixtures: for EVERY offerable rule × launch archetype, the compile-boundary
// outcome equals the equip/save kernel outcome at (a) the template-default
// values, (b) every narrowed-domain boundary value — inclusive edges IN,
// one-past-the-edge OUT, allow-list member IN / non-member OUT, minOnly edge
// IN / below OUT — and (c) the seeded default-trait ladder values at every
// strength wherever the archetype's default traits host the rule. Zero
// disagreements, enumerated by coordinate on failure.
//
// (Test files are exempt from the §2.3 import-boundary ratchet by its own
// scan rule — the direct table imports here are legal.)

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { compileBuild } from './compileBuild.js';
import { resolveEquippedCompatCells } from './compileOnSettingsChange.js';
import { checkCandidatePairing, resolveNarrowedDomains } from './compositionEnforcement.js';
import { FIXTURE_NOW, fixtureVersions, fixturePlatformGuardrails } from './compilerFixtures.js';
import { getGameModePolicy, computeGameModePolicyHash } from './gameModePolicy.js';
import { ARCHETYPE_IDENTITY_VERSION, RULE_LIBRARY_VERSION } from './archetypeVersionConstants.js';
import { getCandidateCompatCell, INCLUDED_ARCHETYPES } from '../../src/data/archetypeCompatibilityCandidate.js';
import { FORGE_RULE_TEMPLATES } from '../../src/data/forgeKnowledgeBase.js';
import { isSupported } from '../../src/data/ruleSupportStatus.js';
import { ARCHETYPE_DEFAULT_TRAITS, TRAIT_BY_ID } from '../../src/data/traitLibrary.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const EVIDENCE_PATH = resolve(REPO, 'docs/composition/ACTIVATION_EVIDENCE.json');

function computeFrozenValues() {
  const manifest = JSON.parse(readFileSync(resolve(REPO, 'src/data/archetypeCompatibilityCandidate.manifest.json'), 'utf8'));
  const kernelHash = createHash('sha256')
    .update(readFileSync(resolve(HERE, 'compositionEnforcement.js')))
    .digest('hex');
  return {
    archetypeIdentityVersion: ARCHETYPE_IDENTITY_VERSION,
    ruleLibraryVersion: RULE_LIBRARY_VERSION,
    candidateManifestHash: manifest.manifestHash,
    enforcementKernelContentHash: kernelHash,
  };
}

describe('A7-LOCK — the freeze gate (activation evidence vs HEAD)', () => {
  it('every frozen value recomputed from HEAD equals the pinned activation evidence', () => {
    const live = computeFrozenValues();
    if (process.env.GENERATE_ACTIVATION_EVIDENCE === '1') {
      const prior = JSON.parse(readFileSync(EVIDENCE_PATH, 'utf8'));
      writeFileSync(EVIDENCE_PATH, `${JSON.stringify({ ...prior, ...live }, null, 2)}\n`);
    }
    const evidence = JSON.parse(readFileSync(EVIDENCE_PATH, 'utf8'));
    expect(evidence.archetypeIdentityVersion, 'ARCHETYPE_IDENTITY_VERSION drifted from the freeze — regenerate deliberately and re-run FINAL-DRYRUN').toBe(live.archetypeIdentityVersion);
    expect(evidence.ruleLibraryVersion, 'RULE_LIBRARY_VERSION drifted from the freeze').toBe(live.ruleLibraryVersion);
    expect(evidence.candidateManifestHash, 'candidate registry manifestHash drifted from the freeze').toBe(live.candidateManifestHash);
    expect(evidence.enforcementKernelContentHash, 'compositionEnforcement kernel content drifted from the freeze').toBe(live.enforcementKernelContentHash);
    expect(evidence.freezeDeclaration).toContain('FROZEN');
  });
});

// ── the corpus-wide differential ─────────────────────────────────────────────

const COMPLETE_META = Object.freeze({
  intendedMode: 'behavioral_guidance', copyClass: 'advisory', receiptTag: 'a7lock_tag', modes: 'clash',
});

const templateParamKeys = (t) => {
  const keys = new Set();
  for (const ft of t.forgeTemplates || []) for (const k of Object.keys(ft?.params || {})) keys.add(k);
  return [...keys];
};
const templateDefault = (t, param) => {
  for (const ft of t.forgeTemplates || []) {
    const p = ft?.params?.[param];
    if (p && 'default' in p) return p.default;
  }
  return undefined;
};

// Probe list per (template, archetype): label + the persisted paramValues to
// judge. Boundary probes are derived from the KERNEL's own domain resolution
// so the probe set can never drift from the shapes the kernel understands.
function probesFor(t, archetype, cell) {
  const keys = templateParamKeys(t);
  const probes = [];
  const defaults = {};
  for (const k of keys) {
    const d = templateDefault(t, k);
    if (d !== undefined) defaults[k] = d;
  }
  probes.push({ label: 'template-defaults', values: defaults });
  if (cell?.narrowedParams) {
    const { domains } = resolveNarrowedDomains(cell.narrowedParams, keys);
    for (const [param, dom] of Object.entries(domains)) {
      if ('allow' in dom) {
        if (dom.allow.length > 0) probes.push({ label: `${param}=allow[0]`, values: { [param]: dom.allow[0] } });
        probes.push({ label: `${param}=non-member`, values: { [param]: '@@a7lock-non-member@@' } });
      } else if ('minOnly' in dom) {
        probes.push({ label: `${param}=minOnly`, values: { [param]: dom.minOnly } });
        probes.push({ label: `${param}<minOnly`, values: { [param]: dom.minOnly - 1 } });
      } else {
        if ('min' in dom) {
          probes.push({ label: `${param}=min`, values: { [param]: dom.min } });
          probes.push({ label: `${param}<min`, values: { [param]: dom.min - 1 } });
        }
        if ('max' in dom) {
          probes.push({ label: `${param}=max`, values: { [param]: dom.max } });
          probes.push({ label: `${param}>max`, values: { [param]: dom.max + 1 } });
        }
      }
    }
  }
  // Seeded ladder probes wherever this archetype's default traits host the rule.
  for (const traitId of ARCHETYPE_DEFAULT_TRAITS[archetype] || []) {
    const trait = TRAIT_BY_ID[traitId];
    if (!trait?.ruleIds?.includes(t.id)) continue;
    for (const strength of ['subtle', 'moderate', 'dominant']) {
      const seeds = trait.strengthProfiles?.[strength]?.[t.id];
      if (seeds) probes.push({ label: `seeded:${traitId}:${strength}`, values: { ...seeds } });
    }
  }
  return probes;
}

// One outcome vocabulary for both boundaries.
function classifyCompile(build, ruleId) {
  const errs = (build.validation?.errors || []).filter((e) => e.ruleId === ruleId);
  if (errs.some((e) => e.code === 'param_out_of_domain')) return 'param_out_of_domain';
  if (errs.some((e) => e.code === 'ambiguous_domain_binding')) return 'ambiguous';
  const v = build.compatVerdicts.find((x) => x.ruleId === ruleId);
  if (v?.blocked && v.verdict === 'core_conflict') return 'core_conflict';
  if (v?.blocked && v.verdict === 'deferred') return 'deferred';
  if (v?.blocked) return `blocked:${build.blockedControls.find((b) => b.ruleId === ruleId)?.blockedBy ?? 'unknown'}`;
  return 'admitted';
}
function classifyKernel(violations) {
  if (violations.some((v) => v.kind === 'param_out_of_domain')) return 'param_out_of_domain';
  if (violations.some((v) => v.kind === 'ambiguous_domain_binding')) return 'ambiguous';
  if (violations.some((v) => v.kind === 'core_conflict')) return 'core_conflict';
  if (violations.some((v) => v.kind === 'deferred')) return 'deferred';
  return 'admitted';
}

// Exact per-leg probe counts at the FROZEN corpus (see the L2-8 note in the
// sweep) — recomputed by hand whenever the corpus deliberately changes.
const A7LOCK_PROBE_PINS = { boundary: 130, seeded: 111 };

describe('A7-LOCK — corpus-wide compile-vs-kernel legality parity (95 offerable rules × 5 archetypes)', () => {
  const offerable = FORGE_RULE_TEMPLATES.filter((t) => isSupported(t.id));

  it('the offerable universe is the gate denominator (95) — the sweep below cannot silently shrink', () => {
    expect(offerable.length).toBe(95);
    expect(INCLUDED_ARCHETYPES.length).toBe(5);
  });

  it('ZERO compile-vs-kernel disagreements across every cell × every probe (defaults, domain edges, seeded ladders)', () => {
    const disagreements = [];
    let probeCount = 0;
    // §2 pass-2 L2-8: PER-LEG tallies. The aggregate probeCount floor was
    // satisfiable with the entire boundary leg silently generating zero
    // probes (475 defaults alone clear 475) — each leg now carries its own
    // pinned count, so a generator leg going dark (or a narrowedParams
    // schema drift that resolveNarrowedDomains maps to {}) is LOUD. The pins
    // are exact against the FROZEN corpus (the A7-LOCK evidence above): a
    // deliberate corpus change regenerates the evidence AND re-pins these in
    // the same commit.
    let defaultProbes = 0;
    let boundaryProbes = 0;
    let seededProbes = 0;
    let excludedProbes = 0;
    for (const archetype of INCLUDED_ARCHETYPES) {
      // Per-rule probe lists, then batched: build slot i compiles every rule
      // that has an i-th probe in ONE compileBuild call (the boundary is
      // per-rule, so batching changes nothing but wall-clock).
      const perRule = offerable.map((t) => ({
        t, cell: getCandidateCompatCell(t.id, archetype), probes: probesFor(t, archetype, getCandidateCompatCell(t.id, archetype)),
      }));
      const maxSlots = Math.max(...perRule.map((r) => r.probes.length));
      for (let slot = 0; slot < maxSlots; slot += 1) {
        const inSlot = perRule.filter((r) => r.probes[slot]);
        const snaps = inSlot.map((r) => ({
          id: r.t.id, sourceRef: r.t.id,
          paramValues: r.probes[slot].values,
          params: Object.fromEntries(templateParamKeys(r.t).map((k) => [k, {}])),
        }));
        const bundles = [{ bundleId: 'b-a7', ruleIds: snaps.map((s) => s.id), ruleSnapshots: snaps }];
        const compatCells = resolveEquippedCompatCells(bundles, archetype, { candidateMode: true });
        const ruleMetadata = Object.fromEntries(snaps.map((s) => [s.id, { ...COMPLETE_META }]));
        const build = compileBuild({
          archetypeDefinition: { codeId: archetype, identityVersion: ARCHETYPE_IDENTITY_VERSION, identityHash: 'a7lock-hash' },
          userBuildDelta: {
            agentId: 'a7lock', settingsRev: 1, parentArchetypeId: archetype,
            parentIdentityVersion: ARCHETYPE_IDENTITY_VERSION,
            equippedBundles: bundles, ruleMetadata, compatCells, userGuardrails: [],
          },
          platformGuardrails: fixturePlatformGuardrails,
          gameModePolicy: getGameModePolicy('clash'),
          gameModePolicyHash: computeGameModePolicyHash('clash'),
          versions: fixtureVersions, now: FIXTURE_NOW,
        });
        for (const r of inSlot) {
          probeCount += 1;
          const probe = r.probes[slot];
          if (probe.label === 'template-defaults') defaultProbes += 1;
          else if (probe.label.startsWith('seeded:')) seededProbes += 1;
          else boundaryProbes += 1;
          const compileOutcome = classifyCompile(build, r.t.id);
          const kernelOutcome = classifyKernel(checkCandidatePairing({
            ruleId: r.t.id, archetype,
            paramValues: probe.values,
            paramKeys: templateParamKeys(r.t),
          }));
          // ruleModeGate blocks are a compile-only admission axis (game-mode
          // policy), outside the kernel's pairing jurisdiction — excluded
          // from the parity claim, TALLIED and asserted zero below so a
          // live exclusion can never erode the floor invisibly (L2-8).
          if (compileOutcome.startsWith('blocked:ruleModeGate')) { excludedProbes += 1; continue; }
          if (compileOutcome !== kernelOutcome) {
            disagreements.push(`${r.t.id}/${archetype} [${probe.label}]: compile=${compileOutcome} kernel=${kernelOutcome}`);
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
    // Per-leg non-vacuity at the frozen corpus (L2-8):
    expect(defaultProbes, 'every cell gets exactly one defaults probe').toBe(475);
    expect(boundaryProbes, 'the narrowed-domain BOUNDARY leg went dark — headline leg (b) covered zero boundaries').toBe(A7LOCK_PROBE_PINS.boundary);
    expect(seededProbes, 'the seeded-ladder leg went dark').toBe(A7LOCK_PROBE_PINS.seeded);
    // The ruleModeGate exclusion is structurally dead today (this suite
    // authors its own metadata with modes:'clash', which the clash gate
    // always admits) — if it EVER fires, this fails and the exclusion count
    // must be consciously re-pinned, keeping the floor honest:
    expect(excludedProbes).toBe(0);
    expect(probeCount).toBe(475 + A7LOCK_PROBE_PINS.boundary + A7LOCK_PROBE_PINS.seeded);
  });
});
