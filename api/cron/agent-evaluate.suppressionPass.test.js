// api/cron/agent-evaluate.suppressionPass.test.js
// Exit-Behavior Rebalance Tier 2, Ask 3 — R11: user-directive deterministic
// orders fire through gameplan suppression.
//
// Phase-0 item 2 established the defect: applyGuardrails' sole call site sits
// DOWNSTREAM of the two gameplan early-returns, so the user's equipped stops
// (and the new profit target) were silently suppressed on every tick a
// meeting was pending-and-unexpired. R11's endorsed shape is
// suppression-path-scoped: the deterministic pass runs ON the two gameplan
// early-return paths, before they return; the normal-tick flow is untouched
// (the catalyst override at :1865 mutates the bench between the gate and the
// main call site, so an unconditional hoist could not be byte-identical).
//
// Same static-source posture as the Gate-7 / Knob wiring suites: the handler
// is not decomposed for behavioral testing; behavioral load for the executor
// lives on agentGuardrails.profitTarget.test.js, and this file guards the
// cron wiring R11 exists for. RED-FIRST: the core wiring pins below were
// written before the pass and watched fail.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(HERE, 'agent-evaluate.js');
const source = readFileSync(SOURCE_PATH, 'utf-8');

describe('R11 — the suppression-path deterministic pass (red-first wiring)', () => {
  it('the pass exists and opens with the dark gate (R10: Ask 3 merges dark behind its own flag)', () => {
    expect(source).toMatch(
      /async function runSuppressionDeterministicPass\([\s\S]{0,600}?if \(!PROFIT_TARGET_EXECUTOR_ENABLED\) return;/,
    );
  });

  it('BOTH gameplan early-return paths run the pass FIRST — pending-and-unexpired (skip_haiku) and fresh-trigger creation', () => {
    // Stop breach during a pending-unexpired gameplan window → fires (RED before this build).
    expect(source).toMatch(/if \(gameplanHandled === 'skip_haiku'\) \{\s*\n\s*await runSuppressionDeterministicPass\(/);
    // The tick that first creates a meeting is a suppression tick too.
    expect(source).toMatch(/if \(gameplanTrigger\) \{\s*\n\s*await runSuppressionDeterministicPass\(/);
  });

  it('exactly two call sites — the pass never touches the normal-tick flow (byte-identical outside suppression)', () => {
    const calls = source.match(/await runSuppressionDeterministicPass\(/g) || [];
    expect(calls.length).toBe(2);
  });

  it('the normal-tick guardrail call site is unchanged and single; the pass uses its own invocation', () => {
    expect((source.match(/const result = applyGuardrails\(\{/g) || []).length).toBe(1);
    // `let` + assignment (not const): the catch block reads the result for its
    // feed entry, so the binding is declared above the try.
    expect((source.match(/deterministicResult = applyGuardrails\(\{/g) || []).length).toBe(1);
  });

  it('the pass invokes applyGuardrails deterministically — no model output in the room (haikuResult: null)', () => {
    const fn = extractPassBody();
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/haikuResult: null,/);
    // Same stop semantics as the main site: same injector, same lock set, no observe shadow.
    expect(fn).toMatch(/injectDiversifierSectorCap\(/);
    expect(fn).toMatch(/lockedPositions,/);
    expect(fn).toMatch(/sectorSlotObserveCap: null,/);
  });
});

// The pass has a multi-line destructured parameter object (its `}) {` sits at
// column 0), so a `\n}`-anchored regex would stop at the params. Cut the body
// at the next section banner instead — the function is the last thing in its
// section by construction.
function extractPassBody() {
  const afterHeader = source.split('async function runSuppressionDeterministicPass(')[1] || '';
  const end = afterHeader.indexOf('// ==================== GAMEPLAN MEETING');
  return end === -1 ? afterHeader : afterHeader.slice(0, end);
}

describe('R11 — provenance from scratch inside the pass (F3: the executor inherits nothing)', () => {
  const fn = extractPassBody();

  it('exitReason comes from the guardrail sourceNote; swapMotive and trade_reasoning are literal null', () => {
    expect(fn).toMatch(/const deterministicExitReason = deterministicResult\.sourceNote;/);
    expect(fn).toMatch(/exitReason: deterministicExitReason,/);
    expect(fn).toMatch(/swapMotive: null,/);
    expect(fn).toMatch(/trade_reasoning: null,/);
  });

  it('receipt source is guardrail via the fenced helper (Gate-7 additive site, byte-pinned spelling)', () => {
    expect(fn).toMatch(/\.\.\.buildSwapReceiptSource\(\{ source: 'guardrail', archetype: ctx\.archetype \}\)/);
  });

  it('the fail-closed reason guard: only guardrail_* reasons may execute from the pass', () => {
    expect(fn).toMatch(/startsWith\('guardrail_'\)/);
  });

  it('replacement resolution stays inside applyGuardrails (R13: the held/self-excluding picker) — no local picker call', () => {
    expect(fn).not.toMatch(/pickSwapReplacementCandidate\(/);
    expect(fn).not.toMatch(/pickEmergencyReplacement/);
  });

  it('execution mirrors the risk-loop template end to end: reserve → execute → confirm → narrate → capture → refresh', () => {
    expect(fn).toMatch(/reserveTournamentSymbolIn\(/);
    expect(fn).toMatch(/await executeSwapServer\(/);
    expect(fn).toMatch(/confirmTournamentSwap\(/);
    expect(fn).toMatch(/pendingNarrations\.push\(/);
    expect(fn).toMatch(/captureSwapReceipt\(\{/);
    expect(fn).toMatch(/refreshBattleFromDoc\(/);
    expect(fn).toMatch(/releaseTournamentReservation\(/);
    // Incoming-symbol counter reset (B1b parity — finalizeCronState runs right after on these paths).
    expect(fn).toMatch(/vwapTicks\[[^\]]+\] = 0;/);
    expect(fn).toMatch(/stagnationTicks\[[^\]]+\] = 0;/);
  });
});
