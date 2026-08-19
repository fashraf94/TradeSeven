// api/_utils/swapMotiveObservability.contract.test.js
//
// Swap Motive Observability (Tier 1) — the load-bearing invariant of this arc.
//
// Phase 0 established that the exact string 'haiku_decision' is NOT just a label:
// four independent subsystems key on it. Tier 1 therefore records the model's
// motive in a NEW sibling field (swapMotive) and leaves exitReason byte-unchanged.
// This test is the guard the founder asked for: it FAILS if anyone ever repurposes
// the exitReason stamp, and its message names every subsystem that would break.
//
//   1. Hurdle-floor gate   — agentArchetypeConfig hftConfig.hurdleFloor.byReason.haiku_decision
//   2. Receipt source       — agent-evaluate.js: swapSource = haikuSwapReason === 'haiku_decision'
//   3. Learning L1 allowlist — learningEnums D3_DISCRETIONARY_EXIT_REASONS
//   4. Calibration partition — aggregate-real-battles KNOWN_NONEMERGENCY_REASONS
//
// If a future tier wants exitReason itself to carry the motive, it must migrate
// all four readers in the same change — this test is where that decision surfaces.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { ARCHETYPE_CONFIGS } from './agentArchetypeConfig.js';
import { D3_DISCRETIONARY_EXIT_REASONS, RECEIPT_EXIT_REASONS } from './learning/learningEnums.js';
import { KNOWN_NONEMERGENCY_REASONS } from '../../scripts/calibration/aggregate-real-battles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const cronSource = readFileSync(join(HERE, '../cron/agent-evaluate.js'), 'utf8');

const STAMP = 'haiku_decision';

describe('Swap Motive Observability — exitReason byte-equality across the four keyed subsystems', () => {
  it('1. hurdle-floor gate: every archetype still keys its discretionary floor on haiku_decision', () => {
    const archetypes = Object.keys(ARCHETYPE_CONFIGS);
    expect(archetypes.length).toBeGreaterThan(0);
    for (const a of archetypes) {
      const byReason = ARCHETYPE_CONFIGS[a].hftConfig?.hurdleFloor?.byReason;
      expect(
        byReason && Object.prototype.hasOwnProperty.call(byReason, STAMP),
        `archetype '${a}' lost its byReason.${STAMP} hurdle floor — a swap-stamp rename would misroute the deterministic gate`,
      ).toBe(true);
    }
  });

  it('2. receipt source: swapSource is still derived by comparing haikuSwapReason to haiku_decision', () => {
    expect(cronSource).toMatch(
      /const swapSource = haikuSwapReason === 'haiku_decision' \? 'haiku' : 'guardrail';/,
    );
  });

  it('3. learning L1 allowlist: the discretionary set is exactly {haiku_decision}', () => {
    expect([...D3_DISCRETIONARY_EXIT_REASONS]).toEqual([STAMP]);
    expect(RECEIPT_EXIT_REASONS).toContain(STAMP);
  });

  it('4. calibration partition: the non-emergency reason set still contains haiku_decision', () => {
    expect(KNOWN_NONEMERGENCY_REASONS.has(STAMP)).toBe(true);
  });

  it('the discretionary exitReason stamp itself is byte-unchanged (autopilot + proposal paths)', () => {
    // Autopilot: exitReason = the computed reason (haikuSwapReason, which is
    // 'haiku_decision' for a discretionary swap). Proposal creation: literal.
    expect(cronSource).toMatch(/exitReason: haikuSwapReason,/);
    expect(cronSource).toMatch(/exitReason: 'haiku_decision',/);
  });
});

describe('Swap Motive Observability — swapMotive is a SEPARATE additive sibling', () => {
  it('the motive is stamped from the model swap_type, never onto exitReason', () => {
    // Present on the model-swap metadata objects, alongside (not replacing) exitReason.
    // Exit-Behavior Tier 2 Ask 3 (F3, endorsed constraint — amended additively
    // in the same PR per R3): the AUTOPILOT stamp is now deterministic-aware —
    // a guardrail_* exitReason stamps motive NULL (a guardrail-materialized
    // haikuResult spreads prior model output, and a stale swap_type must never
    // ride onto a forced swap). The unconditional spelling remains only at the
    // proposal-creation site (dormant, always discretionary by construction).
    const conditionalStamps = cronSource.match(/swapMotive: haikuSwapReason === 'haiku_decision' \? \(haikuResult\?\.swap_type \?\? null\) : null,/g) || [];
    expect(conditionalStamps.length).toBe(1); // autopilot (live)
    const unconditionalStamps = cronSource.match(/swapMotive: haikuResult\?\.swap_type \?\? null,/g) || [];
    expect(unconditionalStamps.length).toBe(1); // proposal creation (dormant)
  });

  it('F3 (Ask 3): every deterministic execution path stamps motive null — engine physics never masquerades as model judgment', () => {
    // The R11 suppression pass constructs its receipt from scratch: motive is
    // the literal null, trade_reasoning likewise (nothing model-side exists).
    const fromScratch = cronSource.match(/swapMotive: null,/g) || [];
    expect(fromScratch.length).toBeGreaterThanOrEqual(1);
    // And the risk-loop metadata (bust/vwap/trail/stagnation) never stamps a
    // model motive at all — absent field, never a fabricated value.
    expect(cronSource).not.toMatch(/swapMotive: riskResult/);
  });

  it('no stamp ever writes a compound haiku:* value into exitReason (the retired approach)', () => {
    expect(cronSource).not.toMatch(/exitReason:\s*[`'"]haiku:/);
  });
});
