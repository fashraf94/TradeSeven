// api/_utils/archetypeRegistry.test.js
//
// Archetype Architecture Phase 2 (P2.2) — registry tests:
//
//   1. Completeness (§2.3): all six archetypes present in every composed home
//   2. identityHash CI LOCK (§2.3 / R1-23): composed-content change without
//      an ARCHETYPE_IDENTITY_VERSION bump FAILS the build (hash compared
//      against the committed snapshot artifact)
//   3. Import-boundary RATCHET (§2.3 / R1-25, api/-import-policy precedent):
//      the set of production modules importing the legacy archetype tables
//      directly is frozen at the committed baseline — new direct importers
//      fail (go through archetypeRegistry), removed ones must shrink the
//      baseline in the same commit. Phase 3 migrates the baseline to zero.
//
// SNAPSHOT REGENERATION (deliberately vitest-hosted: archetypeCharacter.js
// uses extensionless relative imports that resolve under Vite/vitest but not
// plain `node`, so a standalone node script cannot load the registry graph):
//
//   GENERATE_REGISTRY_SNAPSHOT=1 npx vitest run api/_utils/archetypeRegistry.test.js
//
// writes docs/registry-snapshots/archetype-registry-identity-v{N}.json for
// the CURRENT version; commit it in the same PR as the content change + the
// version bump. Published snapshots are immutable — git provides retrieval.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of
// archetypeRegistry.js pulls all ten data homes (api→src) through the Node
// test environment — a browser-only dep entering that graph explodes this
// suite at import time. NEVER mock these imports.

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  ARCHETYPE_IDENTITY_VERSION,
  CANDIDATE_IDENTITY_VERSION,
  listArchetypeIds,
  getArchetypeDefinition,
  getRegistryCorpus,
  computeIdentityHash,
  computeCandidateIdentityHash,
  validateRegistryCompleteness,
  buildRegistrySnapshot,
  buildCandidateRegistrySnapshot,
} from './archetypeRegistry.js';
import { canonicalContentHash } from './canonicalHash.js';
import { VALID_ARCHETYPES } from './agentArchetypeConfig.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SNAPSHOT_DIR = path.join(REPO_ROOT, 'docs', 'registry-snapshots');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, `archetype-registry-identity-v${ARCHETYPE_IDENTITY_VERSION}.json`);
const CANDIDATE_SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, `archetype-registry-identity-v${CANDIDATE_IDENTITY_VERSION}.json`);
const BASELINE_PATH = path.join(REPO_ROOT, 'api', '_utils', 'archetypeImportBoundaryBaseline.json');

// Regen mode — see header. Runs before the lock test so a regen run passes.
// PR 4 (catalog model): the same regen also mints the CANDIDATE snapshot
// alongside the current one — v{N} and v{N+1} coexist in the catalog.
if (process.env.GENERATE_REGISTRY_SNAPSHOT === '1') {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(buildRegistrySnapshot(), null, 2)}\n`);
  writeFileSync(CANDIDATE_SNAPSHOT_PATH, `${JSON.stringify(buildCandidateRegistrySnapshot(), null, 2)}\n`);
}

describe('archetype registry — read surface + completeness (§2.3)', () => {
  it('exposes exactly the six launch archetypes', () => {
    expect(listArchetypeIds()).toEqual(VALID_ARCHETYPES);
    expect(listArchetypeIds()).toHaveLength(6);
  });

  it('returns null for unknown ids — no analyst fallback on the contract surface', () => {
    expect(getArchetypeDefinition('archetype_7')).toBeNull();
  });

  it('passes the completeness validator against the live data homes', () => {
    const { complete, problems } = validateRegistryCompleteness();
    expect(problems).toEqual([]);
    expect(complete).toBe(true);
  });

  it('composes by reference, never by copy (BUILD_RULES §4 local-copy bug class)', async () => {
    const { ARCHETYPE_WEIGHTS } = await import('./archetypeScoring.js');
    const { ARCHETYPE_CONFIGS } = await import('./agentArchetypeConfig.js');
    const def = getArchetypeDefinition('momentum_chaser');
    expect(def.scoring.weights).toBe(ARCHETYPE_WEIGHTS.momentum_chaser);
    expect(def.physics.hftConfig).toBe(ARCHETYPE_CONFIGS.momentum_chaser.hftConfig);
  });

  it('stamps the physics ref with calibrationBundleVersion (§2 amendment)', () => {
    for (const id of listArchetypeIds()) {
      expect(getArchetypeDefinition(id).physics.calibrationBundleVersion).toBe(1);
    }
  });

  it('carries the baseline rulebook in the corpus surface', () => {
    const corpus = getRegistryCorpus();
    expect(corpus.forgeRuleTemplates.length).toBeGreaterThan(100);
    expect(corpus.compatStates).toEqual(['native', 'neutral', 'core_conflict']);
  });
});

describe('identityHash CI lock (§2.3 / R1-23)', () => {
  it('has a committed snapshot artifact for the current identity version', () => {
    expect(
      existsSync(SNAPSHOT_PATH),
      `missing ${path.relative(REPO_ROOT, SNAPSHOT_PATH)} — run GENERATE_REGISTRY_SNAPSHOT=1 npx vitest run api/_utils/archetypeRegistry.test.js and commit the artifact`
    ).toBe(true);
  });

  it('FAILS when composed registry content changes without an ARCHETYPE_IDENTITY_VERSION bump', () => {
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    expect(snapshot.identityVersion).toBe(ARCHETYPE_IDENTITY_VERSION);
    // REMEDY on failure: if the content change is deliberate, bump
    // ARCHETYPE_IDENTITY_VERSION (archetypeVersionConstants.js) and
    // regenerate + commit the NEW snapshot file in the same commit. The old
    // snapshot stays — published versions are immutable.
    expect(computeIdentityHash()).toBe(snapshot.identityHash);
  });
});

describe('the snapshot CATALOG lock (Composition PR 4, closure sheet §I amendment)', () => {
  // The catalog model: current = recomputed from live modules (the lock
  // above); the CANDIDATE = recomputed from the candidate composition; every
  // PRIOR version = validated AS STORED (self-consistent + immutable git
  // content — live modules can no longer reproduce it).
  const stripStored = (snap) => {
    const definitions = {};
    for (const [id, def] of Object.entries(snap.definitions)) {
      const { identityVersion, physics, ...rest } = def;
      const { calibrationBundleVersion, ...physicsContent } = physics;
      definitions[id] = { ...rest, physics: physicsContent };
    }
    const { ruleLibraryVersion, ...corpusContent } = snap.corpus;
    return { definitions, corpus: corpusContent };
  };

  it(`the CANDIDATE snapshot (v${CANDIDATE_IDENTITY_VERSION}) exists ALONGSIDE the current one and tracks the candidate composition exactly`, () => {
    expect(
      existsSync(CANDIDATE_SNAPSHOT_PATH),
      `missing ${path.relative(REPO_ROOT, CANDIDATE_SNAPSHOT_PATH)} — run GENERATE_REGISTRY_SNAPSHOT=1 npx vitest run api/_utils/archetypeRegistry.test.js and commit BOTH artifacts`
    ).toBe(true);
    const snap = JSON.parse(readFileSync(CANDIDATE_SNAPSHOT_PATH, 'utf8'));
    expect(snap.identityVersion).toBe(CANDIDATE_IDENTITY_VERSION);
    // The candidate lock: a change to ANY candidate input (cell matrix,
    // candidate default traits) without regenerating the v3 snapshot fails —
    // and after the A7-LOCK freeze, regenerating without re-running
    // FINAL-DRYRUN violates the freeze declaration.
    expect(computeCandidateIdentityHash()).toBe(snap.identityHash);
  });

  it('every PRIOR version in the catalog is SELF-CONSISTENT as stored (its embedded hash matches its own content)', () => {
    for (let n = 1; n < ARCHETYPE_IDENTITY_VERSION; n += 1) {
      const p = path.join(SNAPSHOT_DIR, `archetype-registry-identity-v${n}.json`);
      expect(existsSync(p), `prior snapshot v${n} missing — published versions are immutable and never deleted`).toBe(true);
      const snap = JSON.parse(readFileSync(p, 'utf8'));
      expect(snap.identityVersion).toBe(n);
      expect(canonicalContentHash(stripStored(snap)), `v${n} snapshot content does not match its own embedded identityHash — a prior version was EDITED (forbidden: priors are immutable)`).toBe(snap.identityHash);
    }
  });

  it('the version-parameterized read surface resolves every catalog member and fails loudly outside it (A48 posture: no caller passes a version until the activation record exists)', () => {
    // live (no arg) — byte-identical to the pre-PR-4 call:
    expect(getArchetypeDefinition('guardian').identityVersion).toBe(ARCHETYPE_IDENTITY_VERSION);
    // candidate — the substituted defaults:
    const g3 = getArchetypeDefinition('guardian', { identityVersion: CANDIDATE_IDENTITY_VERSION });
    expect(g3.identityVersion).toBe(CANDIDATE_IDENTITY_VERSION);
    expect(g3.defaultTraits.find((t) => t.id === 'trait-steady-anchor').ruleIds).toContain('alloc-sector-cap');
    // prior — resolved AS STORED from the catalog:
    expect(getArchetypeDefinition('guardian', { identityVersion: 1 })?.identityVersion).toBe(1);
    // outside the catalog — null, never a guess:
    expect(getArchetypeDefinition('guardian', { identityVersion: CANDIDATE_IDENTITY_VERSION + 1 })).toBeNull();
    expect(getArchetypeDefinition('guardian', { identityVersion: 0 })).toBeNull();
  });
});

describe('import-boundary ratchet (§2.3 / R1-25)', () => {
  const LEGACY_TABLE_BASENAMES = [
    'agentArchetypeConfig',
    'archetypeScoring',
    'archetypeAdjustments',
    'traitLibrary',
    'archetypeRuleCompatibility',
    'archetypeDisplay',
    'archetypeIdentity',
    'archetypeCharacter',
    'characterLeanPresentation',
    'forgeKnowledgeBase',
  ];
  // The sanctioned composition layer — the registry family and the Phase-2
  // compiler layer may (must) import the tables directly; everything else
  // goes through the registry from here on.
  const COMPOSITION_LAYER = new Set([
    'api/_utils/archetypeRegistry.js',
    'api/_utils/calibrationBundle.js',
    'api/_utils/platformGuardrails.js',
    'api/_utils/activationGate.js',
    'api/_utils/compileOnSettingsChange.js',
    'api/_utils/resolvedAgentManifest.js',
    'api/_utils/shadowAssemblyCapture.js',
    // Composition PR 4: the candidate default-traits object composes BY
    // REFERENCE from traitLibrary (unchanged content is never copied — the
    // §4 local-copy bug class), so it is a sanctioned composition-layer
    // member, consumed only through the registry's version-parameterized
    // candidate path (A24: unreachable from every birth path).
    'src/data/traitLibraryCandidate.js',
    // Composition PR 4 (A24 authority switch, client half): the browser birth
    // path cannot import the node registry (fs), so its seed-source resolver
    // composes live-vs-candidate BY REFERENCE itself — record-gated, every
    // failure path resolving LIVE. A sanctioned composition-layer member.
    'src/services/compositionIdentityClient.js',
  ]);
  const IMPORT_RE = new RegExp(
    `from\\s+['"][^'"]*(?:${LEGACY_TABLE_BASENAMES.join('|')})(?:\\.js)?['"]`
  );

  function scanDirectImporters() {
    const hits = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(full);
          continue;
        }
        if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) continue;
        const rel = path.relative(REPO_ROOT, full);
        if (COMPOSITION_LAYER.has(rel)) continue;
        if (IMPORT_RE.test(readFileSync(full, 'utf8'))) hits.push(rel);
      }
    };
    walk(path.join(REPO_ROOT, 'api'));
    walk(path.join(REPO_ROOT, 'src'));
    return hits.sort();
  }

  it('no NEW production module imports a legacy archetype table directly; removed importers shrink the baseline', () => {
    const { importers: baseline } = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    const current = scanDirectImporters();
    const baselineSet = new Set(baseline);
    const currentSet = new Set(current);

    const added = current.filter((f) => !baselineSet.has(f));
    const removed = baseline.filter((f) => !currentSet.has(f));

    expect(
      added,
      'new direct importer(s) of legacy archetype tables — import through api/_utils/archetypeRegistry.js instead (Spec §2.3)'
    ).toEqual([]);
    expect(
      removed,
      'importer(s) left the direct-import set — shrink archetypeImportBoundaryBaseline.json in this same commit (the ratchet only tightens)'
    ).toEqual([]);
  });
});

describe('extensionless relative import guard — whole api/ graph (BUILD_RULES §4)', () => {
  // Generalizes the dependency-surface guard from "no browser deps" to "no
  // extensionless relative imports anywhere reachable from api/". Vite/vitest
  // resolve extensionless relative imports (`./foo`), but Vercel's Node-ESM
  // serverless runtime does NOT — so an extensionless import in the api/ graph
  // crashes the function at module-link time (ERR_MODULE_NOT_FOUND) while every
  // unit test still passes. This walks the real transitive graph on disk and
  // fails on any relative specifier lacking a module extension.
  //
  // Motivating regression: a fenced decide.js import (P2.4b) pulled the archetype
  // registry graph — with archetypeCharacter.js's extensionless imports — into the
  // /api/agent/decide serverless function, crashing every cold start. Unit tests
  // stayed green because vitest resolved the extensionless imports.
  const KNOWN_EXT = /\.(js|mjs|cjs|json|node)$/;

  // Blank comments (preserving newlines) so a `from '...'` inside a JSDoc example
  // is never mistaken for a real import.
  const stripComments = (src) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  // Relative specifiers from static import/export-from, side-effect import, and
  // dynamic import() — scanned over the full (comment-blanked) source so
  // multi-line imports are handled.
  const relSpecs = (raw) => {
    const src = stripComments(raw);
    const out = [];
    const lineOf = (idx) => src.slice(0, idx).split('\n').length;
    for (const re of [
      /\bfrom\s*['"]([^'"]+)['"]/g,
      /\bimport\s+['"]([^'"]+)['"]/g,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        if (m[1].startsWith('.')) out.push({ spec: m[1], line: lineOf(m.index) });
      }
    }
    return out;
  };

  const resolveSpec = (fromFile, spec) => {
    const base = path.resolve(path.dirname(fromFile), spec);
    for (const t of [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, path.join(base, 'index.js'), path.join(base, 'index.mjs')]) {
      if (existsSync(t) && statSync(t).isFile()) return t;
    }
    return null;
  };

  const listJs = (dir) => {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...listJs(p));
      else if (/\.(js|mjs|cjs)$/.test(e.name)) out.push(p);
    }
    return out;
  };

  it('has no extensionless relative imports reachable from api/', () => {
    const apiDir = path.join(REPO_ROOT, 'api');
    const entries = listJs(apiDir).filter((f) => !/\.test\.js$/.test(f));
    const visited = new Set();
    const offenders = [];
    const walk = (file) => {
      if (visited.has(file)) return;
      visited.add(file);
      let src;
      try { src = readFileSync(file, 'utf8'); } catch { return; }
      for (const { spec, line } of relSpecs(src)) {
        if (!KNOWN_EXT.test(spec)) {
          offenders.push(`${path.relative(REPO_ROOT, file)}:${line}  '${spec}'`);
        }
        const resolved = resolveSpec(file, spec);
        if (resolved) walk(resolved);
      }
    };
    for (const e of entries) walk(e);

    expect(
      offenders,
      `Extensionless relative import(s) in the api/ graph — add the .js extension (Node ESM requires it; Vite/vitest hide this):\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });
});
