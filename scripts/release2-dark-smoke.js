// scripts/release2-dark-smoke.js
//
// Release 2 (Fenced Customization Bundle) — founder ACTIVATION-POSTURE smoke.
// Originally the dark-inert smoke (spec §8: "founder smoke (dark-inert:
// nothing visible changes; verify via scripts)"). Repurposed 2026-07-24
// (founder ruling) once the staged-activation walk landed: leans, dial, and
// the integrity directives are now LIVE by design, so a "must be dark"
// assertion only produced false RED on every sanctioned flip. It now checks
// that Release 2 holds its INTENDED ACTIVATED posture, not that it is dark.
// Run from the project root, on the branch you are about to merge:
//
//   node scripts/release2-dark-smoke.js
//
// It answers ONE question — "does Release 2 hold its intended activated
// posture?" — two ways:
//   1. FLAG CHECK: each governed Release-2 flag holds its intended CURRENT
//      value (leans/dial ON, integrity 'enforce', sector-cap 'observe'). A
//      mismatch is flag DRIFT — an accidental flip of a governed flag.
//   2. POSTURE PROOF: the test files that prove the flag-gated behavior (real
//      un-mocked flags, snapshot equal + additive keys, live endpoints,
//      renderer goldens, the PR-f matrix) all pass.
//
// Exit code 0 + the green summary = posture confirmed. ANY red line = STOP,
// do not merge/flip — report it. SCOPE: the Release-2 walk flags only
// (RELEASE2_ACTIVATION_RUNBOOK.md). Phase-2 flags (e.g. MANIFEST_WRITE_ENABLED)
// are a separate program and are intentionally NOT checked here.

import { spawnSync } from 'node:child_process';

const EXPECTED_FLAGS = {
  // The INTENDED activated posture (founder ruling 2026-07-24). These are the
  // values the staged-activation walk landed on; a mismatch means a governed
  // Release-2 flag drifted (an accidental flip), not that anything is "dark".
  // Update this block deliberately, in lockstep with each walk step.

  // Walk step 2 — standing leans ACTIVATED (equip/unequip-lean live; persisted
  // leans render into prompts).
  STANDING_LEANS_ENABLED: true,
  // Walk step 3 — tempo dial ACTIVATED (set-tempo-dial live; the clamp applies
  // the desired tempo).
  TEMPO_DIAL_ENABLED: true,
  // Walk step 1 — sector cap at 'observe' (measurement only; nothing blocked).
  // 'enforce' is a later, separate founder flip (runbook Rule 3).
  SECTOR_CAP_MODE: 'observe',
  // Archetype-integrity directives ACTIVATED to 'enforce' (the gate mints only
  // core-safe allowlist directives). Rollback target is 'observe', never 'off'
  // (runbook Rule 2).
  ARCHETYPE_INTEGRITY_MODE: 'enforce',
};

const OFF_STATE_TEST_FILES = [
  'api/_utils/agentPromptAssembly.controls.test.js',   // REAL flags: persisted controls never reach a prompt
  'api/_utils/agentBattleService.test.js',             // snapshot off-state deep-equal + additive keys only
  'api/_utils/controlPromptRenderer.test.js',          // renderer goldens + single-source tripwire + epoch rules
  'api/_utils/agentGuardrails.test.js',                // sector-slot off byte-identity + gating
  'api/_utils/agentGuardrails.bypassContract.test.js', // sourceNote ↔ fenced bypass-set contract
  'api/_utils/release2ControlsMatrix.test.js',         // PR-f: rollback floor, prefixes, versions, receipts
  'api/agent/equip-lean.test.js',                      // LIVE while STANDING_LEANS_ENABLED=true (past the flag gate; no dark 404)
  'api/agent/set-tempo-dial.test.js',                  // LIVE while TEMPO_DIAL_ENABLED=true (past the flag gate; no dark 404)
];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
let failed = false;

console.log('\n=== Release 2 activation-posture smoke ===\n');

// ---- 1. Flag check ----
const flags = await import('../src/config/featureFlags.js');
console.log('1) Flag values:');
for (const [name, expected] of Object.entries(EXPECTED_FLAGS)) {
  const actual = flags[name];
  const ok = actual === expected;
  if (!ok) failed = true;
  console.log(`   ${ok ? green('OK  ') : red('FAIL')} ${name} = ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// ---- 2. Posture proof ----
console.log('\n2) Posture proof (this takes ~30s):');
// On Windows the npx launcher is `npx.cmd`; a bare `npx` fails to resolve
// (ENOENT) and a `.cmd` can't be spawned without a shell (EINVAL, Node's
// post-CVE-2024-27980 hardening). `shell: true` routes through the platform
// shell so npx resolves on both Windows and POSIX — without it the proof
// surfaces as a false RED. Args are hard-coded literal paths (no injection).
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxCmd, ['vitest', 'run', ...OFF_STATE_TEST_FILES], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf-8',
  shell: true,
});
const tail = `${result.stdout || ''}\n${result.stderr || ''}`.split('\n').filter((l) => /Test Files|Tests {2}|FAIL/.test(l));
for (const line of tail) console.log(`   ${line.trim()}`);
if (result.status !== 0) {
  failed = true;
  console.log(red('   FAIL — one or more posture proofs did not pass.'));
} else {
  console.log(green('   OK — every posture proof passed.'));
}

// ---- Verdict ----
console.log('\n=== VERDICT ===');
if (failed) {
  console.log(red('RED — Release 2 posture does NOT match intent. STOP: do not merge or flip; report the red lines above.'));
  process.exit(1);
} else {
  console.log(green('GREEN — Release 2 holds its intended activated posture: flags match intent and every posture proof passes.'));
  console.log('Reminder: crons do not run on Vercel preview (BUILD_RULES §6) — the epoch/dial cron wiring is proven by these tests + first production observation, not by preview.');
  process.exit(0);
}
