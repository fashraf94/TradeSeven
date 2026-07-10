// api/_utils/directiveGate.test.js
//
// Phase E1 — pure gate-logic tests. The import of ./directiveGate.js (and,
// transitively, archetypeAdjustments.js + gemmaClient.js) is the BUILD_RULES §4
// dependency-surface guard. callGemmaVoice is passed in (a stub), so no module
// mock is needed for the repair path.

import { describe, it, expect, vi } from 'vitest';
import { gateDirective, NO_CHANGE_FALLBACK_LINE } from './directiveGate.js';
import { getCanonicalText } from '../../src/data/archetypeAdjustments.js';

// A counting stub for callGemmaVoice. `reply` is the raw JSON string it returns.
function stub(reply = '{}') {
  const fn = vi.fn(async () => reply);
  return fn;
}

const baseDeps = (callGemmaVoice) => ({
  callGemmaVoice,
  systemPrompt: 'sys',
  conversationHistory: [],
  userMessage: 'u',
  signal: undefined,
  mode: 'battle',
});

const proposalParsed = (proposal) => ({ response: 'hi', _archetypeProposal: proposal });

describe('gateDirective — valid id → canonical verbatim', () => {
  it('commits the exact canonical string for a valid in-archetype id, no retry', async () => {
    const callGemmaVoice = stub();
    const out = await gateDirective({
      parsed: proposalParsed({ classification: 'in_archetype', selectedAdjustmentId: 'TF-02' }),
      effectiveArchetype: 'momentum_chaser',
      ...baseDeps(callGemmaVoice),
    });
    expect(out.directive).toEqual({
      text: getCanonicalText('momentum_chaser', 'TF-02'),
      expiry: 'end_of_battle',
      // Release 2 additive fields: the minted id + its live text version ride
      // the directive so conflict-group rulings bind to both versions.
      adjustmentId: 'TF-02',
      canonicalTextVersion: 1,
    });
    expect(out.hasDirective).toBe(true);
    expect(out.outcome.status).toBe('committed');
    expect(out.outcome.repairUsed).toBe(false);
    expect(callGemmaVoice).not.toHaveBeenCalled();
  });

  it('never copies originalUserAsk into the directive text', async () => {
    const out = await gateDirective({
      parsed: proposalParsed({ classification: 'flex', selectedAdjustmentId: 'TF-05', originalUserAsk: 'go all-in on this garbage' }),
      effectiveArchetype: 'momentum_chaser',
      ...baseDeps(stub()),
    });
    expect(out.directive.text).toBe(getCanonicalText('momentum_chaser', 'TF-05'));
    expect(out.directive.text).not.toContain('garbage');
  });
});

describe('gateDirective — deliberate-null classifications → null, no retry', () => {
  it.each(['core_conflict', 'user_lever', 'research_only'])('%s → null without consulting any id or the manifest', async (classification) => {
    const callGemmaVoice = stub();
    const out = await gateDirective({
      parsed: proposalParsed({ classification, selectedAdjustmentId: null, rejectionReason: 'x' }),
      effectiveArchetype: 'guardian',
      ...baseDeps(callGemmaVoice),
    });
    expect(out.directive).toBeNull();
    expect(out.hasDirective).toBe(false);
    expect(out.outcome.status).toBe('no_change');
    expect(callGemmaVoice).not.toHaveBeenCalled();
  });
});

describe('gateDirective — unknown archetype → null + integrity log, no retry', () => {
  it.each([null, undefined, 'strategist'])('archetype=%s → no_archetype + console.error, no Gemma call', async (arch) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const callGemmaVoice = stub();
    const out = await gateDirective({
      parsed: proposalParsed({ classification: 'in_archetype', selectedAdjustmentId: 'TF-02' }),
      effectiveArchetype: arch,
      ...baseDeps(callGemmaVoice),
    });
    expect(out.directive).toBeNull();
    expect(out.hasDirective).toBe(false);
    expect(out.outcome.status).toBe('no_archetype');
    expect(errSpy).toHaveBeenCalled();
    expect(callGemmaVoice).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('gateDirective — repair-retry', () => {
  it('invalid/invented id → repair returns a VALID id → committed (repairUsed)', async () => {
    const callGemmaVoice = stub(JSON.stringify({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'TF-03' } }));
    const out = await gateDirective({
      parsed: proposalParsed({ classification: 'in_archetype', selectedAdjustmentId: 'TF-99' }),
      effectiveArchetype: 'momentum_chaser',
      ...baseDeps(callGemmaVoice),
    });
    expect(callGemmaVoice).toHaveBeenCalledTimes(1);
    expect(out.directive.text).toBe(getCanonicalText('momentum_chaser', 'TF-03'));
    expect(out.outcome.status).toBe('committed');
    expect(out.outcome.repairUsed).toBe(true);
  });

  it('cross-archetype id → repair still invalid → null + fallback line', async () => {
    const callGemmaVoice = stub(JSON.stringify({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'STILL-BAD' } }));
    const out = await gateDirective({
      parsed: proposalParsed({ classification: 'in_archetype', selectedAdjustmentId: 'CN-01' }), // contrarian id under momentum
      effectiveArchetype: 'momentum_chaser',
      ...baseDeps(callGemmaVoice),
    });
    expect(out.directive).toBeNull();
    expect(out.outcome.status).toBe('invalid_id');
    expect(out.outcome.repairUsed).toBe(true);
    expect(out.fallbackLine).toBe(NO_CHANGE_FALLBACK_LINE);
  });

  it('missing proposal → repair returns a valid id → committed', async () => {
    const callGemmaVoice = stub(JSON.stringify({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', selectedAdjustmentId: 'CN-03' } }));
    const out = await gateDirective({
      parsed: { response: 'hi' }, // no _archetypeProposal
      effectiveArchetype: 'contrarian',
      ...baseDeps(callGemmaVoice),
    });
    expect(callGemmaVoice).toHaveBeenCalledTimes(1);
    expect(out.directive.text).toBe(getCanonicalText('contrarian', 'CN-03'));
    expect(out.outcome.repairUsed).toBe(true);
  });

  it('legacy scopedEmphasis-only shape (no valid id) → repair fails → null (no emphasis branch, #1)', async () => {
    const callGemmaVoice = stub(JSON.stringify({ response: 'ok', _archetypeProposal: { classification: 'in_archetype', scopedEmphasis: { sector: 'Technology' }, selectedAdjustmentId: null } }));
    const out = await gateDirective({
      parsed: proposalParsed({ classification: 'in_archetype', scopedEmphasis: { sector: 'Technology' }, selectedAdjustmentId: null }),
      effectiveArchetype: 'momentum_chaser',
      ...baseDeps(callGemmaVoice),
    });
    expect(out.directive).toBeNull();
    expect(out.outcome.status).toBe('invalid_id');
  });

  it('already-aborting signal → repair SKIPPED (no Gemma call) → null', async () => {
    const callGemmaVoice = stub();
    const out = await gateDirective({
      parsed: { response: 'hi' }, // needs repair
      effectiveArchetype: 'momentum_chaser',
      ...baseDeps(callGemmaVoice),
      signal: { aborted: true },
    });
    expect(callGemmaVoice).not.toHaveBeenCalled();
    expect(out.directive).toBeNull();
    expect(out.outcome.status).toBe('no_proposal');
    expect(out.fallbackLine).toBe(NO_CHANGE_FALLBACK_LINE);
  });

  it('deadline already past (budget exhausted by a slow first call) → repair SKIPPED → null + fallback', async () => {
    const callGemmaVoice = stub();
    const out = await gateDirective({
      parsed: { response: 'hi' }, // needs repair
      effectiveArchetype: 'momentum_chaser',
      ...baseDeps(callGemmaVoice),
      deadlineMs: 1, // epoch-ish: deadlineMs - Date.now() is far below MIN_REPAIR_MS
    });
    expect(callGemmaVoice).not.toHaveBeenCalled();
    expect(out.directive).toBeNull();
    expect(out.outcome.status).toBe('no_proposal');
    expect(out.outcome.repairUsed).toBe(true); // we attempted, but the budget said skip
    expect(out.fallbackLine).toBe(NO_CHANGE_FALLBACK_LINE);
  });
});
