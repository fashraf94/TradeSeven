// api/_utils/__fixtures__/controlsPromptFixtures.js
//
// Release 2 PR-c — the ONE battle fixture for the two controls test files
// (agentPromptAssembly.controls.test.js and its .enforce sibling). They had
// drifted copies of makeEvalBattle (/code-review, Phase-2); a fixture drift
// would let the real-flags guard and the enforce-state proofs silently test
// different battle shapes. ZERO imports on purpose: each test file sets up
// its OWN vi.mock ordering (real flags vs getter-mocked flags) before
// importing the fenced assemblies — this module must never join that graph.

export const DIRECTIVE_AT_REST = Object.freeze({
  text: 'Require stronger confirmation before entering',
  expiry: 'end_of_battle',
  directiveThreadId: 'thread-123',
  createdAt: '2026-07-10T00:00:00.000Z',
  adjustmentId: 'TF-02',
  canonicalTextVersion: 1,
});

export const LEANS_AT_REST = Object.freeze([
  { adjustmentId: 'CP-04', version: 1, text: 'Widen the stop slightly (more patience on good positions)' },
]);

/**
 * Minimal eval-assembly battle: heavy subsystems (institutional context,
 * news) receive empty inputs and degrade gracefully by design — only the
 * CONTROL SECTION varies with the params.
 */
export function makeEvalBattle({
  directive = null,
  standingLeans = undefined,
  controlEpochLog = undefined,
  archetype = 'guardian',
} = {}) {
  return {
    id: 'battle-1',
    gameMode: 'baggerbomb_agent',
    createdAt: '2026-07-10T00:00:00.000Z',
    timing: { tradingDays: [] },
    portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} },
    agentContext: {
      agentName: 'Atlas',
      archetype,
      activeRules: [],
      ...(standingLeans !== undefined ? { standingLeans } : {}),
    },
    scoring: { thresholds: {} },
    trades: [],
    evaluations: [],
    ...(directive ? { directive } : {}),
    ...(controlEpochLog !== undefined ? { controlEpochLog } : {}),
  };
}

/**
 * The shared buildLiveContextBlock arg tail. Takes the (per-file, mocked-
 * import-graph) function as input because each test file must import the
 * fenced assembly AFTER its own vi.mock setup.
 */
export const buildEvalWith = (buildLiveContextBlock) => (battle) =>
  buildLiveContextBlock(battle, {}, {}, [], [], [], [], { vwap: {}, riskStatus: null }, { risk: {} });
