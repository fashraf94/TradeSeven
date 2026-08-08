#!/usr/bin/env node
// scripts/composition/preflight-at-sha.js
//
// Composition PR 4 — B8-FINAL: the census + scan RE-RUN HARNESS, pinned to a
// SHA argument. Runbook step 0 (and the B8-FINAL activation-SHA
// reconciliation) require the A46 writer census and the B3/B3-EXT
// deny-by-default scan green AT THE SHA ACTUALLY DEPLOYED — writers merged
// after the last green run (the PR #716 casualClone interception is the
// precedent) must be caught BEFORE the fence goes live.
//
//   node scripts/composition/preflight-at-sha.js --sha <deployed-sha>
//
// The harness REFUSES to run unless `git rev-parse HEAD` matches --sha and
// the tree is clean (an unpinned or dirty run proves nothing about the
// deploy). It runs the census suite, the protected-stores scan suite, and the
// full composition battery, then writes a machine-checkable report to
// scripts/composition/out/preflight-<sha>.json — the artifact the runbook
// gate (validatePreflightReport) checks.

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const shaIdx = args.indexOf('--sha');
const expectedSha = shaIdx > -1 ? args[shaIdx + 1] : null;
if (!expectedSha) {
  console.error('usage: node scripts/composition/preflight-at-sha.js --sha <deployed-sha>');
  process.exit(2);
}

const headSha = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
const dirty = execSync('git status --porcelain', { cwd: REPO }).toString().trim();
if (!headSha.startsWith(expectedSha) && expectedSha !== headSha) {
  console.error(`✗ HEAD ${headSha} is not the pinned SHA ${expectedSha} — check out the deployed SHA first.`);
  process.exit(1);
}
if (dirty) {
  console.error('✗ tree is DIRTY — a preflight on uncommitted edits proves nothing about the deploy:');
  console.error(dirty);
  process.exit(1);
}

const SUITES = [
  { name: 'compositionWriterCensus', spec: 'api/_utils/compositionWriterCensus.test.js' },
  { name: 'compositionProtectedStores.scan', spec: 'api/_utils/compositionProtectedStores.scan.test.js' },
  { name: 'composition battery (api/_utils/composition*)', spec: 'api/_utils/composition' },
  { name: 'fence behavior', spec: 'api/agent/composition.fenceBehavior.test.js' },
  { name: 'candidate registry + default traits', spec: 'src/data/archetypeCompatibilityCandidate.test.js src/data/archetypeDefaultTraits.composition.test.js' },
];

const suites = [];
for (const s of SUITES) {
  console.log(`\n── running ${s.name} …`);
  const r = spawnSync('npx', ['vitest', 'run', ...s.spec.split(' ')], { cwd: REPO, stdio: 'inherit', shell: false });
  suites.push({ name: s.name, spec: s.spec, result: r.status === 0 ? 'green' : `exit ${r.status}` });
}

const report = {
  _what: 'B8-FINAL preflight report — census + scan + battery at the pinned SHA (see preflight-at-sha.js)',
  sha: headSha,
  pinnedShaArg: expectedSha,
  treeClean: true,
  ranAt: new Date().toISOString(),
  suites,
};
mkdirSync(resolve(REPO, 'scripts/composition/out'), { recursive: true });
const outPath = resolve(REPO, `scripts/composition/out/preflight-${headSha.slice(0, 12)}.json`);
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

// §2 review F5 supplement: the fence flag is LOAD-BEARING once the activation
// record exists (see compositionConfig.js) — the preflight cannot read
// Firestore, so the check is a NAMED manual gate the operator signs in the
// runbook log, printed here so it is never skipped in silence.
console.log('\n⚠ MANUAL GATE (F5): if composition/activation EXISTS in production, confirm the deployed build has COMPOSITION_EPOCH_FENCE_ENABLED=true — the flag must NEVER be false while a record exists (split-brain identity selection).');

const allGreen = suites.every((s) => s.result === 'green');
console.log(`\nB8-FINAL preflight: ${allGreen ? 'PASS' : 'FAIL'} — report written to ${outPath}`);
process.exit(allGreen ? 0 : 1);
