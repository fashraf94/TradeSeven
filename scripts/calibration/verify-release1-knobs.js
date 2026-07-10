#!/usr/bin/env node
// scripts/calibration/verify-release1-knobs.js
// Release 1 — Tuned Knob Values Landing V1.1, Phase 2 verification (calibration sibling).
//
// Offline + deterministic (no network, no Firestore, no Date.now, no randomness).
// Two checks, both asserted against the DEPLOYED module so they exercise the same
// tick-time resolve path the cron uses (§2.1):
//   1. Resolve every archetype via resolveHftConfig(getArchetypeConfig(name), mode)
//      in BOTH game modes → assert the B4 tuned table for degen + momentum_chaser and
//      byte-identical hftConfig for the four unchanged archetypes; assert
//      KNOB_CONFIG_VERSION === 2.
//   2. Dry-run the aggregator's generation bucketing on a fixture SPANNING a boundary
//      → assert wholly-contained battles bucket correctly and the straddler is excluded.
//
// Usage:  node scripts/calibration/verify-release1-knobs.js
// Exit 0 = all checks pass; exit 1 = any check failed (CI-friendly).

import { ARCHETYPE_CONFIGS, getArchetypeConfig, resolveHftConfig, KNOB_CONFIG_VERSION } from '../../api/_utils/agentArchetypeConfig.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';
import { aggregateWithGenerations } from './aggregate-real-battles.js';

// The B4 tuned table (degen + mc) and the untouched seeds (the other four). This is
// the SAME table the unit tests assert; duplicating it here is intentional — an
// independent second witness that the deployed values match what shipped.
const EXPECTED_HFT = {
  momentum_chaser: {
    forcedRotation: { enabled: true, pctThreshold: 0.0015, ticksThreshold: 5, maxTickAgeMinutes: 20, winnerThreshold: 0.0015 },
    hurdleFloor: {
      enabled: true,
      byReason: { haiku_decision: { atrMultiplier: 0.35 }, stagnation: { atrMultiplier: 0.5 } },
      default: { atrMultiplier: 0.35 },
      requireBenchPositive: true,
    },
    swapWindow: { enabled: true, capPerWindow: 6, windowMinutes: 60, countEmergencies: false },
  },
  degen: {
    forcedRotation: { enabled: true, pctThreshold: 0.001, ticksThreshold: 3, maxTickAgeMinutes: 20, winnerThreshold: 0.002 },
    hurdleFloor: {
      enabled: true,
      byReason: { haiku_decision: { atrMultiplier: 0.2 }, stagnation: { atrMultiplier: 0.3 } },
      default: { atrMultiplier: 0.2 },
      requireBenchPositive: true,
    },
    swapWindow: { enabled: true, capPerWindow: 12, windowMinutes: 60, countEmergencies: false },
  },
  analyst: {
    forcedRotation: { enabled: true, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
    hurdleFloor: {
      enabled: true,
      byReason: { haiku_decision: { atrMultiplier: 0.4 }, stagnation: { atrMultiplier: 0.5 } },
      default: { atrMultiplier: 0.4 },
      requireBenchPositive: true,
    },
    swapWindow: { enabled: true, capPerWindow: 4, windowMinutes: 60, countEmergencies: false },
  },
  diversifier: {
    forcedRotation: { enabled: true, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
    hurdleFloor: {
      enabled: true,
      byReason: { haiku_decision: { atrMultiplier: 0.4 }, stagnation: { atrMultiplier: 0.5 } },
      default: { atrMultiplier: 0.4 },
      requireBenchPositive: true,
    },
    swapWindow: { enabled: true, capPerWindow: 4, windowMinutes: 60, countEmergencies: false },
  },
  contrarian: {
    forcedRotation: { enabled: true, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
    hurdleFloor: {
      enabled: true,
      byReason: { haiku_decision: { atrMultiplier: 0.4 }, stagnation: { atrMultiplier: 0.5 } },
      default: { atrMultiplier: 0.4 },
      requireBenchPositive: true,
    },
    swapWindow: { enabled: true, capPerWindow: 4, windowMinutes: 60, countEmergencies: false },
  },
  guardian: {
    forcedRotation: { enabled: false, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
    hurdleFloor: {
      enabled: true,
      byReason: { haiku_decision: { atrMultiplier: 0.5 }, stagnation: { atrMultiplier: 0.5 } },
      default: { atrMultiplier: 0.5 },
      requireBenchPositive: true,
    },
    swapWindow: { enabled: true, capPerWindow: 2, windowMinutes: 120, countEmergencies: false },
  },
};

const TUNED = new Set(['degen', 'momentum_chaser']);

// Minimal deep-equal (deterministic key ordering) — no deps.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

// ---- Check 1: resolved knob table (both modes) + version constant ----
check('KNOB_CONFIG_VERSION === 2', KNOB_CONFIG_VERSION === 2, `got ${KNOB_CONFIG_VERSION}`);

for (const mode of [TIERED_GAME_MODE, FLAT6_GAME_MODE]) {
  for (const name of Object.keys(EXPECTED_HFT)) {
    const resolved = resolveHftConfig(getArchetypeConfig(name), mode);
    const ok = deepEqual(resolved, EXPECTED_HFT[name]);
    const tag = TUNED.has(name) ? 'B4-tuned' : 'byte-identical';
    check(`resolve[${mode}] ${name} (${tag})`, ok, ok ? '' : `resolved=${JSON.stringify(resolved)}`);
  }
}

// Reinforcing-ordering sanity (§4.3): degen stagnation floor is now BELOW guardian's.
const degStag = ARCHETYPE_CONFIGS.degen.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier;
const guaStag = ARCHETYPE_CONFIGS.guardian.hftConfig.hurdleFloor.byReason.stagnation.atrMultiplier;
check('degen stagnation floor < guardian (B4-loosened, reinforcing)', degStag < guaStag, `degen=${degStag} guardian=${guaStag}`);

// ---- Check 2: generation bucketing dry-run over a boundary-spanning fixture ----
const BOUNDARY = '2026-07-08T20:05:00.000Z'; // an after-close merge boundary
const fixture = [
  // Wholly contained in generation 0 (pre-merge).
  { agentContext: { archetype: 'degen' }, createdAt: '2026-07-08T14:00:00Z', completedAt: '2026-07-08T20:00:00Z', trades: [{ id: 'a', exitReason: 'stagnation', swappedOutAt: '2026-07-08T15:00:00Z' }] },
  // Wholly contained in generation 1 (post-merge).
  { agentContext: { archetype: 'degen' }, createdAt: '2026-07-09T14:00:00Z', completedAt: '2026-07-09T20:00:00Z', trades: [{ id: 'b', exitReason: 'stagnation', swappedOutAt: '2026-07-09T15:00:00Z' }] },
  // SPANS the boundary (created pre-merge, completed post-merge) → excluded.
  { agentContext: { archetype: 'degen' }, createdAt: '2026-07-08T14:00:00Z', completedAt: '2026-07-09T20:00:00Z', trades: [{ id: 'c', exitReason: 'stagnation', swappedOutAt: '2026-07-08T15:00:00Z' }] },
];
const gen = aggregateWithGenerations(fixture, [BOUNDARY]);
check('generation bucketing: 2 generations', gen.generations.length === 2, `got ${gen.generations.length}`);
check('generation 0 holds 1 wholly-contained battle', gen.generations[0].containedBattles === 1, `got ${gen.generations[0].containedBattles}`);
check('generation 1 holds 1 wholly-contained battle', gen.generations[1].containedBattles === 1, `got ${gen.generations[1].containedBattles}`);
check('the boundary-spanning battle is EXCLUDED (1 straddler)', gen.straddling.battles === 1, `got ${gen.straddling.battles}`);
check('determinism: identical JSON on repeat', JSON.stringify(aggregateWithGenerations(fixture, [BOUNDARY])) === JSON.stringify(gen));

// ---- Report ----
const failed = results.filter((r) => !r.pass);
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  — ${r.detail}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.error(`\nRelease 1 knob verification FAILED (${failed.length} check(s)).`);
  process.exit(1);
}
console.log('Release 1 knob verification PASSED — deployed values match the B4 tuned table; generation bucketing sound.');
