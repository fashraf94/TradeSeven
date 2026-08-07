// api/_utils/compositionForbiddenReads.test.js
//
// Composition PR 2 — the compatRow forbidden-read CI rule (spec §7 row 2;
// mechanizes A25's PR-2 half and A36's structural half; closes the
// ruleCompatClassify gap the Phase 0 discovery found in the Invariant-R regex,
// ruleCompatInvariantR.test.js:145).
//
// TWO BANS, asserted from source:
//  1. The prompt/projection surface (both assemblers + projectActiveRules)
//     references NO compat surface — legacy OR candidate. The compat verdict
//     acts at write time and rides the CompiledBuild (PR 3); it never steers
//     a live prompt directly (Invariant R, extended to the full surface).
//  2. No production api/ module reads the three-layer resolver or the overlay
//     (A36 structural): pre-activation, only migration/scan/preview tooling
//     may consume the candidate state — a production read of migrated state
//     before activation is the exact leak A36 forbids.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const read = (p) => readFileSync(resolve(REPO, p), 'utf8');

// The FULL compat surface (legacy map + kernels + copy + candidate + composition):
const COMPAT_SURFACE = [
  'archetypeRuleCompatibility', 'ruleCompatGuard', 'ruleCompatEvaluate',
  'ruleCompatClassify', 'compatSurfaceCopy',
  'archetypeCompatibilityCandidate', 'compositionEnforcement', 'compositionDisplay',
];
const PROMPT_SURFACE = [
  'api/_utils/agentPromptAssembly.js',
  'api/_utils/agentEvalPromptAssembly.js',
  'api/_utils/projectActiveRules.js',
];

describe('forbidden-read CI rule — prompt/projection surface never touches ANY compat surface', () => {
  it.each(PROMPT_SURFACE)('%s imports no compat module (legacy or candidate)', (file) => {
    const src = read(file);
    for (const name of COMPAT_SURFACE) {
      expect(src.includes(`/${name}.js'`) || src.includes(`/${name}'`),
        `${file} references ${name}`).toBe(false);
    }
  });

  // M11 (PR 3, ledger): ONE-HOP resolution — a shim module between an
  // assembler and the compat surface (prompt surface → util → compat) slips
  // the direct sweep above. Resolve each prompt-surface file's relative
  // imports and apply the same ban to THOSE modules' sources.
  function relativeImportsOf(file) {
    const src = read(file);
    const dir = dirname(resolve(REPO, file));
    const out = [];
    for (const m of src.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) {
      const abs = resolve(dir, m[1]);
      const rel = abs.slice(resolve(REPO).length + 1);
      if (rel.endsWith('.js')) out.push(rel);
    }
    return out;
  }

  it.each(PROMPT_SURFACE)('%s — its ONE-HOP imports also touch no compat surface (M11: no shim re-exports)', (file) => {
    const hops = relativeImportsOf(file);
    expect(hops.length).toBeGreaterThan(0); // the extraction genuinely resolves imports
    for (const hop of hops) {
      let src;
      try { src = read(hop); } catch { continue; } // non-file specifier (should not happen for .js)
      for (const name of COMPAT_SURFACE) {
        expect(src.includes(`/${name}.js'`) || src.includes(`/${name}'`),
          `${file} → ${hop} references ${name} (one-hop shim, M11)`).toBe(false);
      }
    }
  });
});

describe('A36 (structural) — no production module reads the resolver/overlay pre-activation', () => {
  const ALLOWED_RESOLVER_CONSUMERS = new Set([
    'api/_utils/compositionStateResolver.js',      // itself
    'api/_utils/compositionMigration.js',          // the planner
    'api/_utils/compositionProductionLoader.js',   // B5: THE one sanctioned production read path (PR-4 flips against it)
    // PR 4: the ACTIVATION WRITER — imports computeOverlaySemanticHash +
    // entryDocId for the M6 in-transaction candidate verification (recomputed
    // hash vs stored, create-only id consistency). It reads candidate entries
    // ONLY inside the activation transaction itself — the activation, not a
    // pre-activation production read; nothing calls it until the runbook does.
    'api/_utils/compositionActivationService.js',
    'api/_utils/composition.acceptance.test.js',   // tests
    'api/_utils/composition.pr3.acceptance.test.js',
    'api/_utils/compositionProductionLoader.contract.test.js',
    'api/_utils/compositionForbiddenReads.test.js',
    'api/_utils/compositionActivationService.test.js',
  ]);

  it('the only api/ importers of compositionStateResolver are the migration planner and tests', () => {
    const files = [];
    for (const dir of ['api/_utils', 'api/agent', 'api/cron']) {
      for (const f of readdirSync(resolve(REPO, dir))) {
        if (f.endsWith('.js')) files.push(`${dir}/${f}`);
      }
    }
    for (const f of files) {
      if (read(f).includes("compositionStateResolver")) {
        expect(ALLOWED_RESOLVER_CONSUMERS.has(f),
          `${f} imports the resolver — a production read of candidate state pre-activation (A36)`).toBe(true);
      }
    }
  });

  it('no api/cron module imports the candidate registry or enforcement kernel', () => {
    for (const f of readdirSync(resolve(REPO, 'api/cron'))) {
      if (!f.endsWith('.js')) continue;
      const src = read(`api/cron/${f}`);
      expect(src.includes('archetypeCompatibilityCandidate') || src.includes('compositionEnforcement'),
        `api/cron/${f} touches the candidate surface`).toBe(false);
    }
  });
});
