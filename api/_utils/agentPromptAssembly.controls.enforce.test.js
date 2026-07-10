// api/_utils/agentPromptAssembly.controls.enforce.test.js
//
// Release 2 PR-c — the RENDER-side states, with the flags getter-mocked
// (code constants in prod; the change-archetype.compat.test.js convention —
// the un-mocked sibling agentPromptAssembly.controls.test.js is the §4
// guard). Proves through the REAL fenced assemblies:
//   - enforce + active directive → the byte-exact block renders in the eval
//     prompt (and dies via the epoch kill record — no resurrection);
//   - leans on → the leans block renders in BOTH assemblies, post-
//     revalidation on the strategy side (cross-archetype leans omitted);
//   - the voice-layer reader agrees with the eval assembly (one resolution).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { flagState } = vi.hoisted(() => ({
  flagState: { integrity: 'enforce', leans: true },
}));

vi.mock('../../src/config/featureFlags.js', () => ({
  get ARCHETYPE_INTEGRITY_MODE() { return flagState.integrity; },
  get STANDING_LEANS_ENABLED() { return flagState.leans; },
  get TEMPO_DIAL_ENABLED() { return false; },
  RULE_COMPAT_MODE: 'off',
}));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { buildStrategyUserPrompt } = await import('./agentPromptAssembly.js');
const { buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');
const { buildTradeNarrationPrompt } = await import('./voiceLayerPrompt.js');

const DIRECTIVE = Object.freeze({
  text: 'Require stronger confirmation before entering',
  expiry: 'end_of_battle',
  directiveThreadId: 'thread-123',
  createdAt: '2026-07-10T00:00:00.000Z',
  adjustmentId: 'TF-02',
  canonicalTextVersion: 1,
});

// The byte contract (controlPromptRenderer.test.js golden).
const DIRECTIVE_BLOCK_GOLDEN =
  'ACTIVE DIRECTIVE (from your Coach):\n' +
  '"Require stronger confirmation before entering"\n' +
  'threadId: thread-123\n' +
  'If your next trade is influenced by this directive, include directiveThreadId: "thread-123" in your submit_trade_decision response.';

function makeEvalBattle({ directive = null, standingLeans = undefined, controlEpochLog = undefined } = {}) {
  return {
    id: 'battle-1',
    gameMode: 'baggerbomb_agent',
    createdAt: '2026-07-10T00:00:00.000Z',
    timing: { tradingDays: [] },
    portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} },
    agentContext: {
      agentName: 'Atlas',
      archetype: 'momentum_chaser',
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

const buildEval = (battle) =>
  buildLiveContextBlock(battle, {}, {}, [], [], [], [], { vwap: {}, riskStatus: null }, { risk: {} });

beforeEach(() => {
  flagState.integrity = 'enforce';
  flagState.leans = true;
});

describe('PR-c render states (flags walked)', () => {
  it('ENFORCE + active directive → the byte-exact block renders in the eval prompt', async () => {
    const out = await buildEval(makeEvalBattle({ directive: DIRECTIVE }));
    expect(out).toContain(DIRECTIVE_BLOCK_GOLDEN);
  });

  it('the epoch kill record keeps a directive dead under re-enforce (no resurrection through the REAL assembly)', async () => {
    const killedLog = [{ epochKey: 'integrity=observe|leans=on|dial=off', suppressedDirectiveIds: ['thread-123'] }];
    const out = await buildEval(makeEvalBattle({ directive: DIRECTIVE, controlEpochLog: killedLog }));
    expect(out).not.toContain('ACTIVE DIRECTIVE');
  });

  it('LEANS ON → the snapshot leans render in the eval prompt; a same-id directive dedups its lean', async () => {
    const leans = [
      { adjustmentId: 'TF-02', version: 1, text: 'Require stronger confirmation before entering' },
      { adjustmentId: 'TF-05', version: 1, text: 'Reduce position size on new entries' },
    ];
    const out = await buildEval(makeEvalBattle({ directive: DIRECTIVE, standingLeans: leans }));
    expect(out).toContain('STANDING LEANS');
    expect(out).toContain('- "Reduce position size on new entries"');
    // TF-02 appears ONCE (the directive block) — the identical lean line is deduped.
    const occurrences = out.split('Require stronger confirmation before entering').length - 1;
    expect(occurrences).toBe(1);
  });

  it('the STRATEGY prompt renders leans post-revalidation (cross-archetype pins omitted, fail closed)', () => {
    const out = buildStrategyUserPrompt({
      name: 'Atlas',
      archetype: 'guardian',
      activeRules: [],
      standingLeans: [
        { adjustmentId: 'CP-04', version: 1, equippedAt: 't1' }, // guardian ✓
        { adjustmentId: 'TF-02', version: 1, equippedAt: 't2' }, // cross-archetype ✗
      ],
    });
    expect(out).toContain('STANDING LEANS');
    expect(out).toContain('- "Widen the stop slightly (more patience on good positions)"');
    expect(out).not.toContain('Require stronger confirmation before entering');
  });

  it('the VOICE reader agrees with the eval assembly: renders under enforce, suppresses under observe and under an epoch kill', () => {
    const narrate = (battle) => buildTradeNarrationPrompt({
      agent: { name: 'Atlas', archetype: 'momentum_chaser' },
      battle,
      anchorContext: null,
      marketSnapshot: null,
      currentPhase: null,
      swap: { symbolOut: 'AAA', symbolIn: 'BBB', tier: 'core' },
      rationale: 'r',
      provenance: 'autopilot',
      directive: battle.directive ?? null,
    });

    const enforceOut = narrate(makeEvalBattle({ directive: DIRECTIVE }));
    expect(enforceOut).toContain('ACTIVE COACH DIRECTIVE');

    flagState.integrity = 'observe';
    const observeOut = narrate(makeEvalBattle({ directive: DIRECTIVE }));
    expect(observeOut).not.toContain('ACTIVE COACH DIRECTIVE');

    flagState.integrity = 'enforce';
    const killedOut = narrate(makeEvalBattle({
      directive: DIRECTIVE,
      controlEpochLog: [{ epochKey: 'integrity=observe|leans=on|dial=off', suppressedDirectiveIds: ['thread-123'] }],
    }));
    expect(killedOut).not.toContain('ACTIVE COACH DIRECTIVE');
  });
});
