// api/_utils/sharedResearch/modelTurn.test.js
//
// Shared Research B1 — the model adapter and the cost controls (spec D-SR-1,
// §6.12, K-3, K-4). No network: the request seam (`create`) answers. The
// recorded probe (test/fixtures/sharedResearch/step.recorded.json, when present)
// is validated in stepSchema.recorded.test.js.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { MODELS, MODEL_PRICES, MAX_OUTPUT_TOKENS, EFFORT, THINKING, PRICES_AS_OF, costUsd, runTurn } from './modelTurn.js';

const CURRENT_ID = /^claude-(sonnet|haiku)-5-5$/;
const ok = (output, usage = { input_tokens: 1000, output_tokens: 200 }) => ({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: JSON.stringify(output) }] });
const call = (create, over = {}) => runTurn({ kind: 'step', system: 's', user: 'u', schema: { type: 'object' }, create, ...over });

describe('the models (control 1)', () => {
  it('one place, the current ids only: step on Sonnet 5.5, frame on Haiku 5.5', () => {
    expect(MODELS).toEqual({ step: 'claude-sonnet-5-5', frame: 'claude-haiku-5-5' });
    for (const id of Object.values(MODELS)) expect(id).toMatch(CURRENT_ID);
    expect(MAX_OUTPUT_TOKENS).toEqual({ step: 2500, frame: 600 });
    expect(EFFORT).toBe('low');
  });
  it('no other Shared Research module names a model id, and none names a legacy one', () => {
    const DIR = dirname(fileURLToPath(import.meta.url));
    const REPO = resolve(DIR, '../../..');
    const files = [...readdirSync(DIR).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).map((f) => join(DIR, f)), resolve(REPO, 'api/forge/shared-research.js')];
    const ID = /claude-(?:sonnet|haiku|opus|fable)-[\w.-]+/g;
    for (const f of files) {
      const ids = readFileSync(f, 'utf8').match(ID) || [];
      if (relative(DIR, f) === 'modelTurn.js') { for (const id of ids) expect(id, f).toMatch(CURRENT_ID); }
      else expect(ids, relative(REPO, f)).toEqual([]);
    }
  });
});

describe('the request (K-3)', () => {
  it('structured output with the schema, effort low, thinking off in each model\'s own form, the token cap', async () => {
    const seen = [];
    await call(async (body) => { seen.push(body); return ok({ a: 1 }); });
    await runTurn({ kind: 'frame', system: 's', user: 'u', schema: { type: 'object' }, create: async (body) => { seen.push(body); return ok({ a: 1 }); } });
    expect(seen[0]).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 2500, thinking: { type: 'between_tools' }, output_config: { effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } } });
    expect(seen[1]).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 600, thinking: { type: 'disabled' } });
    expect(THINKING.step).toEqual({ type: 'between_tools' });
  });
});

describe('one turn per step, one transport retry (R5)', () => {
  it('a network error or an overload is retried once, and counted', async () => {
    let n = 0;
    const out = await call(async () => { n += 1; if (n === 1) { const e = new Error('overloaded'); e.status = 529; throw e; } return ok({ a: 1 }); });
    expect(out).toMatchObject({ ok: true, attempts: 2 });
  });
  it('a 400 is not retried; a second transport failure ends the turn', async () => {
    let n = 0;
    const bad = await call(async () => { n += 1; const e = new Error('bad'); e.status = 400; throw e; });
    expect(bad).toMatchObject({ ok: false, reason: 'model_error_400', attempts: 1 });
    expect(n).toBe(1);
    const twice = await call(async () => { throw new Error('socket hang up'); });
    expect(twice).toMatchObject({ ok: false, reason: 'model_error_network', attempts: 2 });
  });
  it('no retry without room left in the deadline', async () => {
    let t = 0;
    const out = await call(async () => { const e = new Error('x'); e.status = 529; throw e; }, { deadlineAt: 5000, now: () => t });
    expect(out.attempts).toBe(1);
  });
  it('an abort is a failed turn, never retried', async () => {
    const ac = new AbortController();
    ac.abort();
    const out = await call(async () => { const e = new Error('Request was aborted.'); e.name = 'AbortError'; throw e; }, { signal: ac.signal });
    expect(out).toMatchObject({ ok: false, reason: 'aborted', attempts: 1 });
  });
  it('a refusal, a cut-off answer and unparseable text are failed turns, with their usage kept', async () => {
    expect(await call(async () => ({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, usage: { input_tokens: 5, output_tokens: 0 }, content: [] })))
      .toMatchObject({ ok: false, reason: 'model_refusal', category: 'cyber', usage: { input: 5, output: 0 } });
    expect(await call(async () => ({ ...ok({}), stop_reason: 'max_tokens' }))).toMatchObject({ ok: false, reason: 'output_cut_off' });
    expect(await call(async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: '{nope' }] }))).toMatchObject({ ok: false, reason: 'unparseable_output' });
  });
});

describe('cost accounting (control 5, K-4)', () => {
  it('every model id has a price row, dated', () => {
    for (const id of Object.values(MODELS)) expect(MODEL_PRICES[id]).toBeDefined();
    expect(PRICES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('costUsd on a fixed usage: 12,000 in + 2,000 out on Sonnet 5.5 is $0.044; on Haiku 5.5 $0.0022', () => {
    expect(costUsd('claude-sonnet-5-5', { input: 12_000, output: 2_000 })).toBe(0.044);
    expect(costUsd('claude-haiku-5-5', { input: 12_000, output: 2_000 })).toBe(0.0022);
  });
  it('null — never a guess — for an unknown model or an unknown usage', () => {
    expect(costUsd('claude-unknown', { input: 1, output: 1 })).toBeNull();
    expect(costUsd('claude-sonnet-5-5', null)).toBeNull();
  });
  it('the turn carries its cost', async () => {
    expect((await call(async () => ok({ a: 1 }, { input_tokens: 12_000, output_tokens: 2_000 }))).costUsd).toBe(0.044);
  });
});
