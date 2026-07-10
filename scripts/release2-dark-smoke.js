// scripts/release2-dark-smoke.js
//
// Release 2 (Fenced Customization Bundle) — the DARK-INERT founder smoke
// (spec §8: "founder smoke (dark-inert: nothing visible changes; verify via
// scripts)"). Run from the project root, on the branch you are about to
// merge (or after merging each stacked PR):
//
//   node scripts/release2-dark-smoke.js
//
// It answers ONE question — "is Release 2 actually dark?" — two ways:
//   1. FLAG CHECK: the three Release-2 flags hold their dark values and
//      ARCHETYPE_INTEGRITY_MODE still holds its live pre-Release-2 value.
//   2. OFF-STATE PROOF: the test files that prove byte-identical off-state
//      behavior (real un-mocked flags, snapshot deep-equal, dark endpoints,
//      renderer goldens, the PR-f matrix) all pass.
//
// Exit code 0 + the green summary = dark confirmed. ANY red line = STOP,
// do not merge/flip — report it.

import { spawnSync } from 'node:child_process';

const EXPECTED_FLAGS = {
  STANDING_LEANS_ENABLED: false,
  TEMPO_DIAL_ENABLED: false,
  SECTOR_CAP_MODE: 'off',
  // Not a Release-2 flag — Release 2 must NOT have moved it (its walk is
  // separate; 'observe' has been the live value since the integrity build).
  ARCHETYPE_INTEGRITY_MODE: 'observe',
};

const OFF_STATE_TEST_FILES = [
  'api/_utils/agentPromptAssembly.controls.test.js',   // REAL flags: persisted controls never reach a prompt
  'api/_utils/agentBattleService.test.js',             // snapshot off-state deep-equal + additive keys only
  'api/_utils/controlPromptRenderer.test.js',          // renderer goldens + single-source tripwire + epoch rules
  'api/_utils/agentGuardrails.test.js',                // sector-slot off byte-identity + gating
  'api/_utils/agentGuardrails.bypassContract.test.js', // sourceNote ↔ fenced bypass-set contract
  'api/_utils/release2ControlsMatrix.test.js',         // PR-f: rollback floor, prefixes, versions, receipts
  'api/agent/equip-lean.test.js',                      // 404-dark while STANDING_LEANS_ENABLED=false
  'api/agent/set-tempo-dial.test.js',                  // 404-dark while TEMPO_DIAL_ENABLED=false
];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
let failed = false;

console.log('\n=== Release 2 dark-inert smoke ===\n');

// ---- 1. Flag check ----
const flags = await import('../src/config/featureFlags.js');
console.log('1) Flag values:');
for (const [name, expected] of Object.entries(EXPECTED_FLAGS)) {
  const actual = flags[name];
  const ok = actual === expected;
  if (!ok) failed = true;
  console.log(`   ${ok ? green('OK  ') : red('FAIL')} ${name} = ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// ---- 2. Off-state proof ----
console.log('\n2) Off-state proof (this takes ~30s):');
const result = spawnSync('npx', ['vitest', 'run', ...OFF_STATE_TEST_FILES], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf-8',
});
const tail = `${result.stdout || ''}\n${result.stderr || ''}`.split('\n').filter((l) => /Test Files|Tests {2}|FAIL/.test(l));
for (const line of tail) console.log(`   ${line.trim()}`);
if (result.status !== 0) {
  failed = true;
  console.log(red('   FAIL — one or more off-state proofs did not pass.'));
} else {
  console.log(green('   OK — every off-state proof passed.'));
}

// ---- Verdict ----
console.log('\n=== VERDICT ===');
if (failed) {
  console.log(red('RED — Release 2 is NOT provably dark. STOP: do not merge or flip; report the red lines above.'));
  process.exit(1);
} else {
  console.log(green('GREEN — Release 2 is dark: flags hold their off values and every off-state proof passes.'));
  console.log('Reminder: crons do not run on Vercel preview (BUILD_RULES §6) — the epoch/dial cron wiring is proven by these tests + first production observation, not by preview.');
  process.exit(0);
}
