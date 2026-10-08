// api/_utils/executorMetadata.test.js — the F2 allowlist and sanitizers (integrity build).

import { describe, it, expect } from 'vitest';
import {
  EXECUTOR_METADATA_KEYS, EXECUTOR_COMPUTED_KEYS, CLIENT_TEXT_MAX, CLIENT_TOKEN_MAX,
  clientText, clientToken, executorMetadata, serverTradeId, serverProposalEvaluationId, proposalDescriptiveMetadata,
} from './executorMetadata.js';

describe('the allowlist', () => {
  it('holds the documented keys plus the census\'s server keys, frozen, disjoint from the computed row keys', () => {
    expect(EXECUTOR_METADATA_KEYS.slice(0, 7)).toEqual(['id', 'action', 'trigger', 'rationale', 'hypothesis', 'evaluationId', 'tradingDay']);
    expect(EXECUTOR_METADATA_KEYS).toHaveLength(19);
    expect(Object.isFrozen(EXECUTOR_METADATA_KEYS)).toBe(true);
    expect(Object.isFrozen(EXECUTOR_COMPUTED_KEYS)).toBe(true);
    for (const k of EXECUTOR_METADATA_KEYS) expect(EXECUTOR_COMPUTED_KEYS).not.toContain(k);
    for (const k of ['lockedPoints', 'entryPrice', 'exitPrice', 'symbolOut', 'symbolIn', 'swapDay', 'swappedOutAt', 'verification', 'snapshot']) {
      expect(EXECUTOR_METADATA_KEYS).not.toContain(k);
    }
  });
});

describe('executorMetadata', () => {
  it('keeps the allowlisted keys in the caller\'s own order and drops every other key', () => {
    const out = executorMetadata({ exitReason: 'x', lockedPoints: 9999, id: 'trade_001', entryPrice: 1, symbolOut: 'FAKE', rationale: null, verification: {} });
    expect(Object.keys(out)).toEqual(['exitReason', 'id', 'rationale']);
    expect(out).toEqual({ exitReason: 'x', id: 'trade_001', rationale: null });
  });

  it('is byte-identical for a metadata object already inside the allowlist', () => {
    const meta = { id: 'trade_002', action: 'SWAP', trigger: 't', rationale: 'r', hypothesis: null, evaluationId: 'eval_002', tradingDay: 1, entryRegime: null, entryMarketPosture: 'selective', entryConviction: 0, entryPreset: 'balanced', entryMode: 'autopilot', exitReason: 'haiku_decision', swapMotive: null, source: 'haiku', archetype: null, hftKnobsSource: 'archetype', swapProvenance: { tempoDesired: 'standard' }, trade_reasoning: null };
    expect(JSON.stringify(executorMetadata(meta))).toBe(JSON.stringify(meta));
  });

  it('returns {} for a non-object', () => {
    for (const v of [null, undefined, 5, 'x', []]) expect(executorMetadata(v)).toEqual({});
  });
});

describe('clientText / clientToken', () => {
  it('a string passes, capped; anything else is null', () => {
    expect(clientText('abc')).toBe('abc');
    expect(clientText('x'.repeat(CLIENT_TEXT_MAX + 5))).toHaveLength(CLIENT_TEXT_MAX);
    expect(clientToken('y'.repeat(CLIENT_TOKEN_MAX + 5))).toHaveLength(CLIENT_TOKEN_MAX);
    expect(clientText('')).toBe('');
    for (const v of [9999, {}, ['a'], null, undefined, true]) {
      expect(clientText(v)).toBeNull();
      expect(clientToken(v)).toBeNull();
    }
    expect(CLIENT_TOKEN_MAX).toBeLessThan(CLIENT_TEXT_MAX);
  });
});

describe('serverTradeId', () => {
  it('the cron\'s own form, from the battle\'s counter', () => {
    expect(serverTradeId({ scoreState: { tradeCount: 0 } })).toBe('trade_001');
    expect(serverTradeId({ scoreState: { tradeCount: 41 } })).toBe('trade_042');
    expect(serverTradeId({})).toBe('trade_001');
  });
});

describe('serverProposalEvaluationId', () => {
  const entry = { evalId: 'eval_007', decision: 'PROPOSAL', symbolOut: 'KO', symbolIn: 'AMD' };
  const proposal = { symbolOut: 'KO', symbolIn: 'AMD', evalId: 'eval_007', evaluationMetadata: { evaluationId: 'eval_007' } };

  it('returns the id only when the server\'s own log holds the entry that proposed this pair', () => {
    expect(serverProposalEvaluationId({ evaluations: [entry] }, proposal)).toBe('eval_007');
    expect(serverProposalEvaluationId({ evaluations: [{ ...entry, decision: 'SWAP' }] }, proposal)).toBeNull();
    expect(serverProposalEvaluationId({ evaluations: [{ ...entry, symbolIn: 'JPM' }] }, proposal)).toBeNull();
    expect(serverProposalEvaluationId({ evaluations: [{ ...entry, symbolOut: 'PG' }] }, proposal)).toBeNull();
    expect(serverProposalEvaluationId({ evaluations: [] }, proposal)).toBeNull();
    expect(serverProposalEvaluationId({}, proposal)).toBeNull();
  });

  it('falls back to the proposal\'s evalId when its metadata has none; a non-string claim is null', () => {
    expect(serverProposalEvaluationId({ evaluations: [entry] }, { ...proposal, evaluationMetadata: {} })).toBe('eval_007');
    expect(serverProposalEvaluationId({ evaluations: [entry] }, { ...proposal, evalId: 7, evaluationMetadata: { evaluationId: 7 } })).toBeNull();
    expect(serverProposalEvaluationId({ evaluations: [entry] }, null)).toBeNull();
  });

  it('the returned value is the LOG\'s string, never the claim object', () => {
    const claim = new String('eval_007'); // eslint-disable-line no-new-wrappers
    expect(serverProposalEvaluationId({ evaluations: [entry] }, { ...proposal, evaluationMetadata: { evaluationId: claim } })).toBeNull();
  });
});

describe('proposalDescriptiveMetadata', () => {
  it('only descriptive strings (capped) and the reasoning\'s strings — never a number, an id, the day, the source or the exit reason', () => {
    const out = proposalDescriptiveMetadata({
      evaluationMetadata: {
        id: 'trade_999', evaluationId: 'x', tradingDay: 42, entryConviction: 99, lockedPoints: 9999, source: 'guardrail', exitReason: 'guardrail_stopLoss',
        swapProvenance: { v: 1 }, archetype: 'degen', hftKnobsSource: 'user_rule', action: 'SELL',
        trigger: 't', rationale: 'r'.repeat(CLIENT_TEXT_MAX + 1), hypothesis: 7, entryRegime: 'trending', entryMarketPosture: 'risk_on',
        swapMotive: 'conviction', entryPreset: 'aggressive', entryMode: 'copilot',
        trade_reasoning: { thesis: 't', strategy: 's', indicators: ['a', 1, 'b'], citedRules: ['C1'], conviction: 99, extra: 'x' },
      },
    });
    expect(out).toEqual({
      trigger: 't', rationale: 'r'.repeat(CLIENT_TEXT_MAX), hypothesis: null, entryRegime: 'trending', entryMarketPosture: 'risk_on', swapMotive: 'conviction',
      entryPreset: 'aggressive', entryMode: 'copilot',
      trade_reasoning: { thesis: 't', strategy: 's', indicators: ['a', 'b'], citedRules: ['C1'] },
    });
  });

  it('an absent key stays absent; an empty or non-string preset/mode does not override the caller\'s floor', () => {
    expect(proposalDescriptiveMetadata({ evaluationMetadata: {} })).toEqual({});
    expect(proposalDescriptiveMetadata({ evaluationMetadata: { entryPreset: '', entryMode: 7 } })).toEqual({});
    expect(proposalDescriptiveMetadata({})).toEqual({});
    expect(proposalDescriptiveMetadata(null)).toEqual({});
    expect(proposalDescriptiveMetadata({ evaluationMetadata: [1, 2] })).toEqual({});
  });

  it('reasoning that is not an object, or has no strings, is null; long indicator lists are bounded', () => {
    expect(proposalDescriptiveMetadata({ evaluationMetadata: { trade_reasoning: 'x' } })).toEqual({ trade_reasoning: null });
    expect(proposalDescriptiveMetadata({ evaluationMetadata: { trade_reasoning: { conviction: 5 } } })).toEqual({ trade_reasoning: null });
    const many = proposalDescriptiveMetadata({ evaluationMetadata: { trade_reasoning: { indicators: Array.from({ length: 50 }, () => 'i'.repeat(500)) } } });
    expect(many.trade_reasoning.indicators).toHaveLength(20);
    expect(many.trade_reasoning.indicators[0]).toHaveLength(200);
  });
});
