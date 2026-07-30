// api/_utils/wireModelCall.test.js
// Phase 2 Spec V1.5 R4-B2 — the single-constructor wrapper's contract.
//
// P2-45/P2-49 at the wrapper level: the TWO-DIRECTION assertion (every tuple
// field reaches the request; the request's generation-param surface carries
// nothing beyond the tuple — deny-unknown), golden vectors that fail if the
// wrapper rebuilds the request from anything but the frozen object, BOTH
// call shapes with the batch nesting asserted at the params level, identity
// pass-through of content fields (the M8 lock depends on it), and the
// provenance stamp derived from the same object in the same call.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── SDK mock: captures constructor options + every call's params ─────────
const h = vi.hoisted(() => ({
  constructed: [],
  created: [],
  batchCreated: [],
  retrieved: [],
  resultsFor: [],
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor(opts) {
      h.constructed.push(opts);
      this.messages = {
        create: async (params) => {
          h.created.push(params);
          return { stop_reason: 'tool_use', content: [] };
        },
        batches: {
          create: async (payload) => {
            h.batchCreated.push(payload);
            return { id: 'batch_1', processing_status: 'in_progress' };
          },
          retrieve: async (id) => {
            h.retrieved.push(id);
            return { id, processing_status: 'ended' };
          },
          results: async (id) => {
            h.resultsFor.push(id);
            return (async function* () {})();
          },
        },
      };
    }
  },
}));

import {
  wireModelCall,
  wireBatchSubmit,
  wireBatchRetrieve,
  wireBatchResults,
} from './wireModelCall.js';
import { getGenerationConfig } from './wireGenerationConfig.js';

const OFF = { metricsEnabled: false, writesEnabled: false, continuityEnabled: false };
const WRITES_CONT = { metricsEnabled: true, writesEnabled: true, continuityEnabled: true };

// The generation-parameter surface: request keys that are NOT content keys.
const CONTENT_KEYS = ['system', 'messages', 'tools', 'tool_choice'];
const paramSurface = (request) =>
  Object.keys(request).filter((k) => !CONTENT_KEYS.includes(k)).sort();

const MESSAGES = [{ role: 'user', content: 'go' }];
const TOOLS = [{ name: 'publish_story', input_schema: { type: 'object' } }];
const TOOL_CHOICE = { type: 'tool', name: 'publish_story' };

beforeEach(() => {
  // h.constructed is deliberately NOT cleared: the client is a module-level
  // lazy singleton, so construction happens once per process — the final
  // test asserts the cumulative count.
  h.created.length = 0;
  h.batchCreated.length = 0;
  h.retrieved.length = 0;
  h.resultsFor.length = 0;
  process.env.CLAUDE_API_KEY = 'test-key';
});

describe('messages.create shape — two-direction assertion (P2-45)', () => {
  it('direction 1: every tuple field lands in the request, exact values', async () => {
    const execution = getGenerationConfig('kim_column', OFF);
    await wireModelCall(execution, {
      system: 'S', messages: MESSAGES, tools: TOOLS, tool_choice: TOOL_CHOICE,
    });
    const req = h.created[0];
    expect(req.model).toBe('claude-sonnet-4-6');
    expect(req.max_tokens).toBe(1200);
    expect(req.temperature).toBe(0.85);
    expect(req.thinking).toEqual({ type: 'disabled' });
    expect(req.output_config).toEqual({ effort: 'low' });
  });

  it('direction 2: the generation-param surface is EXACTLY the tuple mapping — deny-unknown', async () => {
    await wireModelCall(getGenerationConfig('kim_column', OFF), {
      system: 'S', messages: MESSAGES, tools: TOOLS, tool_choice: TOOL_CHOICE,
    });
    expect(paramSurface(h.created[0]))
      .toEqual(['max_tokens', 'model', 'output_config', 'temperature', 'thinking']);

    // Haiku seam: no pins, no extras.
    await wireModelCall(getGenerationConfig('alex_mover', OFF), {
      system: 'S', messages: MESSAGES, tools: TOOLS, tool_choice: TOOL_CHOICE,
    });
    expect(paramSurface(h.created[1])).toEqual(['max_tokens', 'model', 'temperature']);
  });

  it('an unknown content key THROWS — params cannot be smuggled around the tuple', async () => {
    const execution = getGenerationConfig('alex_mover', OFF);
    await expect(
      wireModelCall(execution, { messages: MESSAGES, temperature: 0.99 })
    ).rejects.toThrow(/unknown content key 'temperature'/);
    expect(h.created).toHaveLength(0); // nothing reached the client
  });

  it('content fields pass BY IDENTITY — the M8 lock depends on it', async () => {
    await wireModelCall(getGenerationConfig('alex_mover', OFF), {
      system: 'S', messages: MESSAGES, tools: TOOLS, tool_choice: TOOL_CHOICE,
    });
    const req = h.created[0];
    expect(req.tools).toBe(TOOLS);
    expect(req.tools[0]).toBe(TOOLS[0]);
    expect(req.messages).toBe(MESSAGES);
    expect(req.tool_choice).toBe(TOOL_CHOICE);
  });

  it('absent optional content keys stay absent (art_director: no tools)', async () => {
    await wireModelCall(getGenerationConfig('art_director'), {
      system: 'S', messages: MESSAGES,
    });
    const req = h.created[0];
    expect('tools' in req).toBe(false);
    expect('tool_choice' in req).toBe(false);
    expect(req.temperature).toBe(0); // falsy param survives
  });

  it('golden vector: full request object, exact (P2-49)', async () => {
    await wireModelCall(getGenerationConfig('kai_pulse', OFF), {
      system: 'SYS', messages: MESSAGES, tools: TOOLS, tool_choice: TOOL_CHOICE,
    });
    expect(h.created[0]).toEqual({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.8,
      system: 'SYS',
      messages: MESSAGES,
      tools: TOOLS,
      tool_choice: TOOL_CHOICE,
    });
  });

  it('returns the provenance stamp derived from the SAME execution object', async () => {
    const execution = getGenerationConfig('kai_pulse', WRITES_CONT);
    const { generationConfig } = await wireModelCall(execution, { messages: MESSAGES });
    expect(generationConfig).toEqual({
      generationVersion: execution.generationVersion,
      continuityEnabled: true,
    });
    expect(Object.isFrozen(generationConfig)).toBe(true);
  });
});

describe('batches.create shape — nesting asserted at the params level (R4-B2)', () => {
  it('params nest inside requests[].params; two-direction holds PER REQUEST', async () => {
    const execution = getGenerationConfig('doug_earnings_preview', OFF);
    const { batch, generationConfig } = await wireBatchSubmit(execution, [
      { customId: 'earnings_preview_AAPL_2026-07-28', content: { system: 'A', messages: MESSAGES, tools: TOOLS, tool_choice: TOOL_CHOICE } },
      { customId: 'earnings_preview_MSFT_2026-07-28', content: { system: 'M', messages: MESSAGES, tools: TOOLS, tool_choice: TOOL_CHOICE } },
    ]);
    expect(batch.id).toBe('batch_1');
    const payload = h.batchCreated[0];
    expect(Object.keys(payload)).toEqual(['requests']);
    expect(payload.requests).toHaveLength(2);

    for (const [i, id] of [['0', 'earnings_preview_AAPL_2026-07-28'], ['1', 'earnings_preview_MSFT_2026-07-28']]) {
      const req = payload.requests[Number(i)];
      expect(Object.keys(req).sort()).toEqual(['custom_id', 'params']);
      expect(req.custom_id).toBe(id);
      // direction 1 at the params level
      expect(req.params.model).toBe('claude-sonnet-4-6');
      expect(req.params.max_tokens).toBe(800);
      expect(req.params.thinking).toEqual({ type: 'disabled' });
      expect(req.params.output_config).toEqual({ effort: 'low' });
      // direction 2 at the params level — and the register quirk holds:
      // doug_earnings_preview sends NO temperature.
      expect(paramSurface(req.params))
        .toEqual(['max_tokens', 'model', 'output_config', 'thinking']);
      expect('temperature' in req.params).toBe(false);
    }

    expect(generationConfig).toEqual({
      generationVersion: execution.generationVersion,
      continuityEnabled: false,
    });
  });

  it('a subset assertion at the WRONG level would pass vacuously — the top level carries no params', async () => {
    // Documents why the per-request assertion above exists: the batch
    // envelope itself has no model/max_tokens; anyone asserting there
    // asserts against nothing.
    await wireBatchSubmit(getGenerationConfig('doug_earnings_preview', OFF), [
      { customId: 'x', content: { messages: MESSAGES } },
    ]);
    expect(paramSurface(h.batchCreated[0])).toEqual(['requests']);
  });

  it('unknown content key throws per request, naming the custom_id', async () => {
    await expect(
      wireBatchSubmit(getGenerationConfig('doug_earnings_preview', OFF), [
        { customId: 'bad_one', content: { messages: MESSAGES, max_tokens: 9999 } },
      ])
    ).rejects.toThrow(/unknown content key 'max_tokens'.*bad_one/);
    expect(h.batchCreated).toHaveLength(0);
  });
});

describe('retrieval pass-throughs + client construction', () => {
  it('retrieve/results delegate; the singleton was constructed exactly once, seams-style', async () => {
    await wireModelCall(getGenerationConfig('kai_pulse', OFF), { messages: MESSAGES });
    await wireBatchRetrieve('batch_9');
    await wireBatchResults('batch_9');
    expect(h.retrieved).toEqual(['batch_9']);
    expect(h.resultsFor).toEqual(['batch_9']);
    // Cumulative across every test in this file — the lazy singleton was
    // built exactly once, with the identical options every pre-P1 seam used.
    expect(h.constructed).toHaveLength(1);
    expect(h.constructed[0]).toEqual({ apiKey: 'test-key' });
  });
});
