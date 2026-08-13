// api/_utils/mandateModelCall.test.js
// Spec 1 §3.3 — submission envelope (F1/F2), deny-unknown request assembly,
// forced tool_choice, and decision extraction.

import { describe, it, expect } from 'vitest';
import {
  computeRequestId, buildSubmissionEnvelope, buildMandateRequest, extractDecisionInput,
} from './mandateModelCall.js';
import { MANDATE_DECISION_TOOL_NAME } from './mandateDecisionTool.js';

const SEAT = { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', params: { temperature: 0.7, maxTokens: 600 } };

describe('submission envelope (F1/F2)', () => {
  it('requestId is deterministic in (mandateId, quarterKey, snapshotTickKey, baseRevision)', () => {
    const a = computeRequestId({ mandateId: 'm1', quarterKey: 'm1:1', snapshotTickKey: 't', baseRevision: 3 });
    const b = computeRequestId({ mandateId: 'm1', quarterKey: 'm1:1', snapshotTickKey: 't', baseRevision: 3 });
    const c = computeRequestId({ mandateId: 'm1', quarterKey: 'm1:1', snapshotTickKey: 't', baseRevision: 4 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('builds the full envelope with submitTickKey == snapshotTickKey', () => {
    const env = buildSubmissionEnvelope({
      mandateId: 'm1', baseRevision: 3, quarterKey: 'm1:1', vintageRef: 'archetypeVintages/x',
      snapshotTickKey: '2026-08-12_open30', bookStatus: 'active', submittedAt: '2026-08-12T14:00:00Z', sessionDate: '2026-08-12',
    });
    expect(env.requestId).toHaveLength(24);
    expect(env.submitTickKey).toBe('2026-08-12_open30');
    expect(env.baseRevision).toBe(3);
    expect(env.sessionDate).toBe('2026-08-12');
  });
});

describe('buildMandateRequest — deny-unknown + forced tool', () => {
  it('maps the model seat and forces the decision tool', () => {
    const req = buildMandateRequest(SEAT, { system: 'S', messages: [{ role: 'user', content: 'hi' }], tools: [{ name: MANDATE_DECISION_TOOL_NAME }] });
    expect(req.model).toBe(SEAT.model);
    expect(req.max_tokens).toBe(600);
    expect(req.temperature).toBe(0.7);
    expect(req.tool_choice).toEqual({ type: 'tool', name: MANDATE_DECISION_TOOL_NAME });
  });

  it('throws on an unknown content key (no param smuggling)', () => {
    expect(() => buildMandateRequest(SEAT, { messages: [], temperature: 0.99 })).toThrow(/unknown content key/);
  });

  it('respects an explicitly supplied tool_choice', () => {
    const req = buildMandateRequest(SEAT, { messages: [], tool_choice: { type: 'auto' } });
    expect(req.tool_choice).toEqual({ type: 'auto' });
  });
});

describe('extractDecisionInput — deny-unknown block types', () => {
  it('extracts the decision tool input', () => {
    const resp = { content: [{ type: 'text', text: 'thinking' }, { type: 'tool_use', name: MANDATE_DECISION_TOOL_NAME, input: { verb: 'HOLD' } }], usage: { input_tokens: 10 } };
    const r = extractDecisionInput(resp);
    expect(r.ok).toBe(true);
    expect(r.input).toEqual({ verb: 'HOLD' });
  });

  it('rejects when no decision tool_use is present', () => {
    expect(extractDecisionInput({ content: [{ type: 'text', text: 'x' }] })).toEqual({ ok: false, reason: 'no_decision_tool_use' });
  });

  it('rejects an unexpected block type', () => {
    const r = extractDecisionInput({ content: [{ type: 'image' }] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('unexpected_block');
  });
});

// ── P5: prompt caching (D-20) + the batch request shape ──────────────────────

describe('P5 — cache_control on the stable scaffold (D-20)', () => {
  it('a string system becomes ONE cache-marked block; the context stays in messages, uncached', () => {
    const req = buildMandateRequest(SEAT, { system: 'IDENTITY SCAFFOLD', messages: [{ role: 'user', content: 'per-tick context' }] });
    expect(req.system).toEqual([{ type: 'text', text: 'IDENTITY SCAFFOLD', cache_control: { type: 'ephemeral' } }]);
    // The per-tick context rides in messages — after the cache breakpoint.
    expect(req.messages[0].content).toBe('per-tick context');
    expect(JSON.stringify(req.messages)).not.toContain('cache_control');
  });

  it('a caller-supplied block ARRAY is passed through untouched (caller owns its markers)', () => {
    const blocks = [{ type: 'text', text: 'a' }, { type: 'text', text: 'b', cache_control: { type: 'ephemeral' } }];
    const req = buildMandateRequest(SEAT, { system: blocks, messages: [] });
    expect(req.system).toBe(blocks);
  });

  it('no system → no fabricated block', () => {
    const req = buildMandateRequest(SEAT, { messages: [] });
    expect(req.system).toBeUndefined();
  });
});

describe('P5 — createMandateBatch request shape (the Doug batches.create nesting)', () => {
  it('nests params per request with custom_id = requestId; deny-unknown applies AT THE PARAMS LEVEL per request', async () => {
    // Import lazily so the module mock in other suites never interferes.
    const { createMandateBatch } = await import('./mandateModelCall.js');
    // No network in unit tests: assert the THROW path proves per-request
    // assembly runs BEFORE any client call.
    await expect(createMandateBatch([
      { customId: 'req1', modelSeat: SEAT, content: { messages: [], smuggled: 1 } },
    ])).rejects.toThrow(/unknown content key/);
    await expect(createMandateBatch([])).rejects.toThrow(/at least one request/);
    await expect(createMandateBatch([{ modelSeat: SEAT, content: { messages: [] } }])).rejects.toThrow(/customId/);
  });
});
