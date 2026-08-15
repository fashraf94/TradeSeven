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
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

// Runner portability (fixed 2026-08-15 — the step-0.2 ENOENT). The harness
// used to spawn bare `npx` with shell:false. On win32 the runner is `npx.cmd`,
// so every spawn failed ENOENT before any test started; spawnSync returned
// status === null, the old code recorded the string "exit null", and the
// report rendered five FAILING suites when in fact NONE had run.
//
// Two fixes were rejected before this one:
//   • `shell: true` — Windows would re-parse the whole command line through
//     cmd.exe, so a spec containing & | ^ > < (or merely a path with a space)
//     changes meaning silently. SUITES is edited by whoever adds a suite, so
//     that is a latent footgun in exactly the harness meant to prevent them.
//   • `npx.cmd` with shell:false — rejected by Node itself since the
//     BatBadBut mitigation (CVE-2024-27980): spawning a .cmd/.bat without a
//     shell now fails EINVAL by design. Measured here on Node v22.20.0.
//
// So: spawn THIS Node on vitest's own JS entrypoint. No .cmd, no shell, no
// PATH lookup, identical on every platform — argv is passed through verbatim,
// so the injection surface stays closed BY CONSTRUCTION rather than by the
// current contents of a constant.
const VITEST_BIN = resolve(REPO, 'node_modules/vitest/vitest.mjs');
if (!existsSync(VITEST_BIN)) {
  console.error(`✗ vitest entrypoint not found at ${VITEST_BIN} — run \`npm install\` before the preflight.`);
  console.error('  (Failing loudly here: a missing runner must never be recorded as a suite result.)');
  process.exit(1);
}

const suites = [];
for (const s of SUITES) {
  console.log(`\n── running ${s.name} …`);
  const r = spawnSync(process.execPath, [VITEST_BIN, 'run', ...s.spec.split(' ')], { cwd: REPO, stdio: 'inherit', shell: false });
  // R6: "did this actually run" must be recorded UNAMBIGUOUSLY. A null status
  // means the child never started (spawn error) — categorically different from
  // a suite that ran and failed. Never collapse the two into one string.
  const entry = { name: s.name, spec: s.spec };
  if (r.status === 0) {
    entry.result = 'green';
  } else if (r.status === null) {
    entry.result = 'did-not-run';
    entry.spawnError = r.error ? `${r.error.code || 'spawn failure'} — ${r.error.message}` : 'child never started (status null, no error object)';
    console.error(`\n✗ ${s.name} NEVER EXECUTED: ${entry.spawnError}`);
  } else {
    entry.result = `exit ${r.status}`;
  }
  suites.push(entry);
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

// R6: an INCONCLUSIVE run is not a FAIL. Reporting "FAIL" for suites that
// never executed invites the reader to look for a composition defect that
// does not exist — and, worse, invites them to treat a later green as having
// fixed something. Name the three outcomes separately.
const didNotRun = suites.filter((s) => s.result === 'did-not-run');
const ranAndFailed = suites.filter((s) => s.result !== 'green' && s.result !== 'did-not-run');
const allGreen = didNotRun.length === 0 && ranAndFailed.length === 0;

let verdict;
if (allGreen) verdict = 'PASS';
else if (didNotRun.length > 0) verdict = `INCONCLUSIVE — ${didNotRun.length}/${suites.length} suite(s) NEVER EXECUTED (this is NOT a test failure; the report proves nothing about the SHA)`;
else verdict = 'FAIL';

console.log(`\nB8-FINAL preflight: ${verdict} — report written to ${outPath}`);
if (didNotRun.length) {
  console.error('\n✗ The following suites never started — fix the runner and re-run; do NOT read this as a composition finding:');
  for (const s of didNotRun) console.error(`   • ${s.name}: ${s.spawnError}`);
}
process.exit(allGreen ? 0 : 1);
