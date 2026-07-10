// api/_utils/agentPromptAssembly.controls.test.js
//
// Release 2 PR-c — the read-side guard proven THROUGH the real fenced
// assemblies (called, never edited beyond the authorized PR-c swap). Two
// halves, mirroring the compat-test convention:
//
//   1. REAL FLAGS (this file's un-mocked half is the §4 dependency-surface
//      guard for the new fenced→renderer/flags edges): with
//      ARCHETYPE_INTEGRITY_MODE='observe' and STANDING_LEANS_ENABLED=false
//      live, a battle carrying a directive AND leans AT REST renders NEITHER
//      — the guard suppresses what the pre-PR-c assembly would have rendered.
//      A control-free battle renders no control block either (off-state
//      invariant: byte-wise, nothing control-shaped enters the prompt).
//
//   2. The ENFORCE-state byte contract is the renderer golden + single-source
//      tripwire in controlPromptRenderer.test.js (the fenced file delegates,
//      so the block bytes are owned there); the .enforce sibling file walks
//      the flags via getter mock for the render-side states.
//
// buildStrategyUserPrompt is exercised directly (pure). The eval side is
// exercised through buildLiveContextBlock's CONTROL SECTION ONLY via a
// minimal fixture — heavy subsystems (institutional context, news) receive
// empty inputs and degrade gracefully by design.

import { describe, it, expect, vi } from 'vitest';

// Infra seam only — fetchInstitutionalContext reaches for the Admin SDK when
// rules exist; the fixtures carry none, but the import must not boot Firebase.
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { buildStrategyUserPrompt } = await import('./agentPromptAssembly.js');
const { buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');

const DIRECTIVE_AT_REST = Object.freeze({
  text: 'Require stronger confirmation before entering',
  expiry: 'end_of_battle',
  directiveThreadId: 'thread-123',
  createdAt: '2026-07-10T00:00:00.000Z',
  adjustmentId: 'TF-02',
  canonicalTextVersion: 1,
});

const LEANS_AT_REST = Object.freeze([
  { adjustmentId: 'CP-04', version: 1, text: 'Widen the stop slightly (more patience on good positions)' },
]);

function makeEvalBattle({ directive = null, standingLeans = undefined } = {}) {
  return {
    id: 'battle-1',
    gameMode: 'baggerbomb_agent',
    createdAt: '2026-07-10T00:00:00.000Z',
    timing: { tradingDays: [] },
    portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} },
    agentContext: {
      agentName: 'Atlas',
      archetype: 'guardian',
      activeRules: [],
      ...(standingLeans !== undefined ? { standingLeans } : {}),
    },
    scoring: { thresholds: {} },
    trades: [],
    evaluations: [],
    ...(directive ? { directive } : {}),
  };
}

const buildEval = (battle) =>
  buildLiveContextBlock(battle, {}, {}, [], [], [], [], { vwap: {}, riskStatus: null }, { risk: {} });

describe('PR-c guard — REAL flags (observe / leans off): persisted controls never reach the prompt', () => {
  it('a battle with a directive AND leans AT REST renders neither block (the read-side guard)', async () => {
    const out = await buildEval(makeEvalBattle({ directive: DIRECTIVE_AT_REST, standingLeans: LEANS_AT_REST }));
    expect(out).not.toContain('ACTIVE DIRECTIVE');
    expect(out).not.toContain(DIRECTIVE_AT_REST.text);
    expect(out).not.toContain('STANDING LEANS');
    expect(out).not.toContain(LEANS_AT_REST[0].text);
  });

  it('a control-free battle renders no control-shaped block (off-state invariant)', async () => {
    const out = await buildEval(makeEvalBattle());
    expect(out).not.toContain('ACTIVE DIRECTIVE');
    expect(out).not.toContain('STANDING LEANS');
  });

  it('the strategy prompt ignores at-rest leans while STANDING_LEANS_ENABLED is false (locked goldens stay valid)', () => {
    const withLeans = buildStrategyUserPrompt({
      name: 'Atlas',
      archetype: 'guardian',
      activeRules: [],
      standingLeans: [{ adjustmentId: 'CP-04', version: 1 }],
    });
    const without = buildStrategyUserPrompt({ name: 'Atlas', archetype: 'guardian', activeRules: [] });
    expect(withLeans).toBe(without); // byte-identical — the flag gates before any lean work
    expect(withLeans).not.toContain('STANDING LEANS');
  });
});
