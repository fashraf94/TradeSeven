// api/_utils/filmRoom/debriefModelCall.test.js
//
// Film Room D2 item 3 — THE MODEL CALL (D2 spec §3; DW-5, DW-8). Every row on a FAKE client (the `create` seam, or a
// mocked SDK for the client's own construction) — no real model call, no key. The request's exact shape, one
// transport retry and none after an answer, usage and cost, the deadline, the reasons, the key never in an output.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sdk = vi.hoisted(() => ({ options: [], create: null }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    constructor(options) { sdk.options.push(options); this.messages = { create: (...a) => sdk.create(...a) }; }
  },
}));

import {
  runDebriefCall, debriefRequestBody, costUsd, resetDebriefClient, DEBRIEF_MODEL, DEBRIEF_MODELS, DEBRIEF_MAX_OUTPUT_TOKENS, MODEL_PRICES, PRICES_AS_OF,
  THINKING_OFF, RETRY_MIN_REMAINING_MS,
} from './debriefModelCall.js';

const SCHEMA = { type: 'object', properties: { lines: { type: 'array' } }, required: ['lines'], additionalProperties: false };
const ARGS = { system: 'SYSTEM TEXT', user: '{"swaps":[]}', schema: SCHEMA };
const answer = (text, { stop = 'end_turn', input = 1200, output = 80 } = {}) => ({ stop_reason: stop, usage: { input_tokens: input, output_tokens: output }, content: [{ type: 'text', text }] });
const OK = answer('{"lines":[{"swap":"s1","text":"The stall rule took MSFT out."}]}');
const netErr = () => Object.assign(new Error('socket hang up'), { name: 'APIConnectionError' });
const statusErr = (status) => Object.assign(new Error(`status ${status}`), { status });

/** A fake create that answers each call from the list in turn, and records what it was asked. */
function fake(...steps) {
  const calls = [];
  const create = async (body, opts) => {
    calls.push({ body, opts });
    const s = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (s instanceof Error) throw s;
    return typeof s === 'function' ? s(body, opts) : s;
  };
  return { create, calls };
}

const KEY_BEFORE = process.env.CLAUDE_API_KEY;
beforeEach(() => { sdk.options.length = 0; sdk.create = null; resetDebriefClient(); });
afterEach(() => { if (KEY_BEFORE === undefined) delete process.env.CLAUDE_API_KEY; else process.env.CLAUDE_API_KEY = KEY_BEFORE; vi.useRealTimers(); });

describe('the model, in one place (DW-8)', () => {
  it("DEBRIEF_MODEL is claude-sonnet-5-5; claude-haiku-5-5 is priced beside it", () => {
    expect(DEBRIEF_MODEL).toBe('claude-sonnet-5-5');
    expect(DEBRIEF_MODELS).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
    expect(MODEL_PRICES['claude-sonnet-5-5']).toEqual({ inputPerMTok: 2, outputPerMTok: 10 });
    expect(MODEL_PRICES['claude-haiku-5-5']).toEqual({ inputPerMTok: 0.1, outputPerMTok: 0.5 });
    expect(PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('a model with no price row is refused before any request', async () => {
    const f = fake(OK);
    await expect(runDebriefCall({ ...ARGS, model: 'claude-opus-5-5', create: f.create })).rejects.toThrow(/no model/);
    expect(f.calls).toHaveLength(0);
  });
});

describe('the request (§3): one structured-output request, exactly', () => {
  it('Sonnet 5.5: effort low, thinking off as between_tools, at most 800 output tokens, the schema as output_config.format', async () => {
    const f = fake(OK);
    await runDebriefCall({ ...ARGS, create: f.create });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].body).toEqual({
      model: 'claude-sonnet-5-5',
      max_tokens: 800,
      thinking: { type: 'between_tools' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: 'SYSTEM TEXT',
      messages: [{ role: 'user', content: '{"swaps":[]}' }],
    });
    expect(DEBRIEF_MAX_OUTPUT_TOKENS).toBe(800);
    expect(f.calls[0].opts.signal).toBeInstanceOf(AbortSignal);
  });
  it('Haiku 5.5: thinking off as disabled — the rest the same', async () => {
    const f = fake(OK);
    await runDebriefCall({ ...ARGS, model: 'claude-haiku-5-5', create: f.create });
    expect(f.calls[0].body.thinking).toEqual({ type: 'disabled' });
    expect(f.calls[0].body.model).toBe('claude-haiku-5-5');
    expect(debriefRequestBody({ ...ARGS, model: 'claude-haiku-5-5' })).toEqual({ ...f.calls[0].body });
    expect(THINKING_OFF['claude-haiku-5-5']).toEqual({ type: 'disabled' });
  });
  it('the client: the key from CLAUDE_API_KEY, the SDK\'s own retries OFF (maxRetries 0), built once', async () => {
    process.env.CLAUDE_API_KEY = 'test-key-not-real-0001';
    sdk.create = async () => OK;
    await runDebriefCall(ARGS);
    await runDebriefCall(ARGS);
    expect(sdk.options).toEqual([{ apiKey: 'test-key-not-real-0001', maxRetries: 0 }]);
  });
  it('the key is never printed, logged, or returned', async () => {
    process.env.CLAUDE_API_KEY = 'test-key-not-real-0002';
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    try {
      sdk.create = async () => { throw statusErr(401); };
      const r = await runDebriefCall(ARGS);
      sdk.create = async () => OK;
      const r2 = await runDebriefCall(ARGS);
      for (const s of spies) for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toContain('test-key-not-real-0002');
      expect(JSON.stringify([r, r2])).not.toContain('test-key-not-real-0002');
    } finally { for (const s of spies) s.mockRestore(); }
  });
});

describe('asked ONCE (DW-5): one transport retry, never a second ask after an answer', () => {
  it('a network error, then the answer: two attempts, ok', async () => {
    const f = fake(netErr(), OK);
    const r = await runDebriefCall({ ...ARGS, create: f.create });
    expect([r.ok, r.attempts, f.calls.length]).toEqual([true, 2, 2]);
  });
  it('an overload (529), then the answer: two attempts, ok', async () => {
    const f = fake(statusErr(529), OK);
    const r = await runDebriefCall({ ...ARGS, create: f.create });
    expect([r.ok, r.attempts]).toEqual([true, 2]);
  });
  it('two network errors: two attempts, then model_error_network — never a third', async () => {
    const f = fake(netErr(), netErr(), OK);
    const r = await runDebriefCall({ ...ARGS, create: f.create });
    expect([r.ok, r.reason, r.attempts, f.calls.length]).toEqual([false, 'model_error_network', 2, 2]);
  });
  it('any other HTTP error is not retried: model_error_<status>, one attempt', async () => {
    for (const status of [400, 401, 429, 500]) {
      const f = fake(statusErr(status), OK);
      const r = await runDebriefCall({ ...ARGS, create: f.create });
      expect([r.reason, r.attempts, f.calls.length], String(status)).toEqual([`model_error_${status}`, 1, 1]);
    }
  });
  it('a retry needs RETRY_MIN_REMAINING_MS of the deadline: with less left, a network error is final', async () => {
    let t = 1_000_000;
    const f = fake(netErr(), OK);
    const r = await runDebriefCall({ ...ARGS, create: f.create, now: () => t, deadlineAt: t + RETRY_MIN_REMAINING_MS - 1 });
    expect([r.reason, r.attempts, f.calls.length]).toEqual(['model_error_network', 1, 1]);
    t = 2_000_000;
    const g = fake(netErr(), OK);
    expect((await runDebriefCall({ ...ARGS, create: g.create, now: () => t, deadlineAt: t + RETRY_MIN_REMAINING_MS })).attempts).toBe(2);
  });
  it('an answer that is not JSON: parse — and NO second call', async () => {
    const f = fake(answer('not json at all'), OK);
    const r = await runDebriefCall({ ...ARGS, create: f.create });
    expect([r.ok, r.reason, r.attempts, f.calls.length]).toEqual([false, 'parse', 1, 1]);
  });
  it('a refusal: model_error_refusal; a cut-off output: model_error_max_tokens — one call each, usage kept', async () => {
    const f = fake(answer('', { stop: 'refusal', input: 900, output: 3 }), OK);
    const r = await runDebriefCall({ ...ARGS, create: f.create });
    expect([r.ok, r.reason, f.calls.length, r.usage]).toEqual([false, 'model_error_refusal', 1, { input: 900, output: 3 }]);
    const g = fake(answer('{"lines":[{"swap":"s1","te', { stop: 'max_tokens', output: 800 }), OK);
    const s = await runDebriefCall({ ...ARGS, create: g.create });
    expect([s.ok, s.reason, g.calls.length]).toEqual([false, 'model_error_max_tokens', 1]);
  });
});

describe('usage and cost (§3, §6)', () => {
  it('usage from the answer; costUsd from the published prices — Sonnet and Haiku', async () => {
    const f = fake(answer('{"lines":[]}', { input: 2000, output: 300 }));
    const r = await runDebriefCall({ ...ARGS, create: f.create });
    expect([r.usage, r.costUsd, r.model, r.stopReason]).toEqual([{ input: 2000, output: 300 }, 0.007, 'claude-sonnet-5-5', 'end_turn']);
    const g = fake(answer('{"lines":[]}', { input: 2000, output: 300 }));
    expect((await runDebriefCall({ ...ARGS, model: 'claude-haiku-5-5', create: g.create })).costUsd).toBe(0.00035);
  });
  it('an answer with no usage: usage and cost null — never a guessed cost', async () => {
    const f = fake({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"lines":[]}' }] });
    const r = await runDebriefCall({ ...ARGS, create: f.create });
    expect([r.ok, r.usage, r.costUsd]).toEqual([true, null, null]);
    expect(costUsd('claude-sonnet-5-5', { input: 1.5, output: 2 })).toBeNull();
    expect(costUsd('no-such-model', { input: 1, output: 2 })).toBeNull();
  });
  it('a failed transport records no usage and no cost', async () => {
    const r = await runDebriefCall({ ...ARGS, create: fake(netErr(), netErr()).create });
    expect([r.usage, r.costUsd]).toEqual([null, null]);
  });
});

describe('the deadline', () => {
  it('the call is aborted at deadlineAt and answers `deadline` — no retry after it', async () => {
    let calls = 0;
    const create = (body, { signal }) => { calls += 1; return new Promise((_, reject) => { signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }); };
    const r = await runDebriefCall({ ...ARGS, create, deadlineAt: Date.now() + 40 });
    expect([r.ok, r.reason, r.attempts, calls]).toEqual([false, 'deadline', 1, 1]);
  });
  it('a deadline already passed aborts at once', async () => {
    const create = (body, { signal }) => (signal.aborted ? Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) : new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    expect((await runDebriefCall({ ...ARGS, create, deadlineAt: Date.now() - 1 })).reason).toBe('deadline');
  });
});
