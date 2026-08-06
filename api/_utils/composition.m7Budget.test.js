// api/_utils/composition.m7Budget.test.js
//
// Composition PR 3 — M7: the FULL-REQUEST eval budget fixture.
//
// TOKENIZER DISCLOSURE (discovery, this PR): the production stack has NO
// tokenizer by deliberate design ("no tokenizer dependency, no network in
// CI" — evalIdentityBlocks.test.js) — authoritative counts exist only
// post-hoc in response.usage. The repo's measurement convention is the
// chars/4 estimate (voiceLayerPrompt.test.js precedent; conservative for
// natural English — real BPE counts run LOWER, so a passing estimate
// overstates the true spend). This fixture applies that convention at
// FULL-REQUEST scope — system prompt + the identity user message — which no
// prior test did (all previous budget rows were fragment-scoped).
//
// The fixture is maximal-realistic: 14 equipped rules, long memory,
// consolidated insight, and — the reason M7 lands in THIS PR — the lit
// composition-advisory load on every tension rule.

import { describe, it, expect, vi } from 'vitest';
import { EVAL_MAX_OUTPUT_TOKENS } from './agentEvalTransport.js';

const flagState = { compiledIdentity: false };
vi.mock('./compositionConfig.js', () => ({
  get COMPOSITION_ENFORCEMENT_MODE() { return 'off'; },
  get COMPOSITION_EPOCH_FENCE_ENABLED() { return false; },
  get COMPOSITION_MIGRATION_FEED_ENABLED() { return false; },
  get COMPOSITION_COMPILED_IDENTITY_ENABLED() { return flagState.compiledIdentity; },
}));

const { buildEvalSystemPrompt, buildAgentIdentityBlock } = await import('./agentEvalPromptAssembly.js');

// The named budget of record: the estimated FULL-REQUEST input ceiling. The
// maximal fixture measures ≈4.8k today; 8k gives real growth headroom while
// still catching a runaway prompt (a duplicated block, an advisory
// double-append at scale) long before it threatens any model limit.
export const EVAL_REQUEST_INPUT_TOKEN_BUDGET_ESTIMATE = 8000;
const estimateTokens = (s) => Math.ceil(s.length / 4);

const ADVISORY = 'the agent is instructed that the cap limits how much a leading sector may hold, not whether leading sectors are preferred.';

function maximalBattle({ withCompat }) {
  const rules = Array.from({ length: 14 }, (_, i) => ({
    ruleId: `rd${i}`,
    text: 'Cap any single sector at 60% of portfolio with additional confirmation requirements on every swap decision',
    category: i % 2 ? 'allocation' : 'institutional',
    hardness: i % 2 ? 'hard' : 'soft',
  }));
  return {
    gameMode: 'clash',
    agentContext: {
      name: 'Fixture Agent', archetype: 'momentum_chaser',
      activeRules: rules,
      memory: Array.from({ length: 10 }, (_, i) => `Learned lesson ${i}: volume expansion precedes breakouts in leading sectors most of the time.`),
      consolidatedInsight: 'x'.repeat(1200),
    },
    initialPortfolio: { star: [], core: [], support: [] },
    evaluations: [], trades: [],
    ...(withCompat ? {
      resolvedAgentManifest: {
        compositionCompat: {
          entries: Array.from({ length: 14 }, (_, i) => ({
            ruleId: `rd${i}`, verdict: 'tension', advisory: ADVISORY, narrowedParams: { pct: { min: 40, max: 80 } },
          })),
        },
      },
    } : {}),
  };
}

describe('M7 — the full-request eval budget (production-convention estimate)', () => {
  it('EVAL_MAX_OUTPUT_TOKENS is 2048 (the output half of the request budget)', () => {
    expect(EVAL_MAX_OUTPUT_TOKENS).toBe(2048);
  });

  it('the MAXIMAL request — advisories LIT on all 14 rules — fits the named input budget', () => {
    flagState.compiledIdentity = true;
    const battle = maximalBattle({ withCompat: true });
    const system = buildEvalSystemPrompt('Fixture Agent', 'momentum_chaser', 'clash', 'momentum_chaser');
    const user = buildAgentIdentityBlock(battle);
    const inputEstimate = estimateTokens(system) + estimateTokens(user);
    expect(user.split('— Advisory:').length - 1).toBe(14); // the load is genuinely lit
    expect(inputEstimate).toBeLessThan(EVAL_REQUEST_INPUT_TOKEN_BUDGET_ESTIMATE);
    // and the whole request (input estimate + output ceiling) is nowhere near
    // any model context — this row exists to catch RUNAWAY growth, not to
    // flirt with the real limit.
    expect(inputEstimate + EVAL_MAX_OUTPUT_TOKENS).toBeLessThan(12000);
  });

  it('the advisory DELTA is bounded: lit-minus-dark ≈ one sentence per tension rule (a double-append at scale fails here)', () => {
    flagState.compiledIdentity = true;
    const lit = buildAgentIdentityBlock(maximalBattle({ withCompat: true }));
    flagState.compiledIdentity = false;
    const dark = buildAgentIdentityBlock(maximalBattle({ withCompat: true }));
    const delta = lit.length - dark.length;
    const perRule = ` — Advisory: ${ADVISORY}`.length;
    expect(delta).toBe(14 * perRule); // exactly once per rule, nothing else moved
  });
});
