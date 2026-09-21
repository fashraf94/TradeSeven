// api/_utils/tickCapture/captureBodyObserver.test.js
//
// Stage B — the fetch-boundary observer, on its own. The end-to-end rows (the
// real cron, the real record) live in
// api/cron/agent-evaluate.tickCapture.bodies.test.js.

import { describe, it, expect, afterEach } from 'vitest';
import { activeBodyHolder, beginBodyCapture, endBodyCapture, makeObservingFetch } from './captureBodyObserver.js';
import { resolveBodyHolder } from './captureWriter.js';

const jsonResponse = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'application/json' } });

afterEach(() => { endBodyCapture(); });

describe('outside a window the observer is a pass-through', () => {
  it('does not touch the response and records nothing', async () => {
    const base = async () => jsonResponse('{"model":"m"}');
    const res = await makeObservingFetch(base)('https://api.anthropic.com/v1/messages', { body: '{}' });
    expect(await res.text()).toBe('{"model":"m"}');
    expect(activeBodyHolder()).toBeNull();
  });
});

describe('inside a window', () => {
  it('captures the OUTGOING entity body exactly as dispatched, and never reads a header', async () => {
    const holder = beginBodyCapture();
    const seen = [];
    const base = async (url, init) => { seen.push(init); return jsonResponse('{"model":"claude-x"}'); };
    const dispatched = '{"model":"claude-haiku","messages":[{"role":"user","content":"hi"}]}';
    await makeObservingFetch(base)('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': 'SECRET-KEY-MUST-NEVER-BE-CAPTURED', 'content-type': 'application/json' },
      body: dispatched,
    });
    expect(holder.requestBody).toBe(dispatched);
    expect(holder.dispatched).toBe(true);
    expect(JSON.stringify(holder)).not.toContain('SECRET-KEY');
    // the init reached the transport untouched
    expect(seen[0].headers['x-api-key']).toBe('SECRET-KEY-MUST-NEVER-BE-CAPTURED');
  });

  it('does NOT consume the SDK\'s stream — the caller still reads its own body', async () => {
    beginBodyCapture();
    const base = async () => jsonResponse('{"model":"claude-x","content":[]}');
    const res = await makeObservingFetch(base)('u', { body: '{}' });
    // The SDK's own read succeeds — the observer read a CLONE.
    expect(await res.text()).toBe('{"model":"claude-x","content":[]}');
    expect(res.bodyUsed).toBe(true);
    const facts = await resolveBodyHolder(endBodyCapture());
    expect(facts.response.body).toBe('{"model":"claude-x","content":[]}');
  });

  it('does NOT block the dispatch: the clone read is started, not awaited', async () => {
    const holder = beginBodyCapture();
    const base = async () => jsonResponse('{"a":1}');
    await makeObservingFetch(base)('u', { body: '{}' });
    // Still a pending promise the instant fetch returned — so the observer
    // cannot inflate `callMs`, the tick's own transport measurement.
    expect(holder.responseTextPromise).toBeInstanceOf(Promise);
    expect(await holder.responseTextPromise).toEqual({ ok: true, text: '{"a":1}' });
  });

  it('captures a NON-2xx body with its status', async () => {
    const holder = beginBodyCapture();
    const base = async () => jsonResponse('{"type":"error","error":{"type":"rate_limit_error"}}', 429);
    await makeObservingFetch(base)('u', { body: '{}' });
    const facts = await resolveBodyHolder(holder);
    expect(facts.response.status).toBe(429);
    expect(facts.response.body).toContain('rate_limit_error');
  });

  it('captures a MALFORMED body — it simply names no model', async () => {
    const holder = beginBodyCapture();
    const base = async () => jsonResponse('{"content":[{"type":"tool_use"', 200);
    await makeObservingFetch(base)('u', { body: '{}' });
    const facts = await resolveBodyHolder(holder);
    expect(facts.response.body).toBe('{"content":[{"type":"tool_use"');
    expect(facts.response.returnedModel).toBeNull();
    expect(facts.response.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('a transport THROW still counts as dispatched, and the failure reaches the caller unchanged', async () => {
    const holder = beginBodyCapture();
    const base = async () => { throw new Error('socket hang up'); };
    await expect(makeObservingFetch(base)('u', { body: '{"x":1}' })).rejects.toThrow('socket hang up');
    expect(holder.dispatched).toBe(true);
    expect(holder.requestBody).toBe('{"x":1}');
    const facts = await resolveBodyHolder(holder);
    expect(facts.response.body).toBeNull();
    expect(facts.copyError).toBe('response_body_absent');
  });

  it('a response that cannot be cloned records the failure and STILL returns the response', async () => {
    const holder = beginBodyCapture();
    const hostile = { status: 200, clone() { throw new Error('body already disturbed'); } };
    const res = await makeObservingFetch(async () => hostile)('u', { body: '{}' });
    expect(res).toBe(hostile);                 // the request never failed
    expect(holder.responseError).toBe('body already disturbed');
    const facts = await resolveBodyHolder(holder);
    expect(facts.response.body).toBeNull();    // never reconstructed
    expect(facts.copyError).toBe('body already disturbed');
  });

  it('a NON-STRING request body is recorded as unsupported, never reconstructed', async () => {
    const holder = beginBodyCapture();
    await makeObservingFetch(async () => jsonResponse('{}'))('u', { body: new Uint8Array([1, 2, 3]) });
    expect(holder.requestBody).toBeNull();
    expect(holder.requestError).toMatch(/^unsupported_request_body_/);
  });

  it('endBodyCapture closes the window — a later dispatch writes into nothing', async () => {
    const holder = beginBodyCapture();
    endBodyCapture();
    await makeObservingFetch(async () => jsonResponse('{"late":true}'))('u', { body: '{"late":1}' });
    expect(holder.dispatched).toBe(false);
    expect(holder.requestBody).toBeNull();
  });
});
