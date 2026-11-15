// api/_utils/anthropicRateLimits.test.js
//
// Capacity Build 1, Part 4 — the Anthropic half of the limits on record, on
// its own (docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md). The end-to-end rows
// (the real handler, tick capture on AND off, the run record) are in
// api/cron/agent-evaluate.limitsOnRecord.test.js.
//
// `sdkCall` builds what @anthropic-ai/sdk 0.71.2's APIPromise is at this seam:
// a promise of the parsed message that also answers `asResponse()` with the
// raw Response, and that rejects with an error carrying `status` and `headers`
// on a non-2xx (core/api-promise.mjs, core/error.mjs).

import { describe, it, expect } from 'vitest';
import {
  RATE_LIMIT_HEADERS, parseRateLimitHeaders, openRateLimitWindow, closeRateLimitWindow,
  recordRateLimitObservation, observeRateLimits,
} from './anthropicRateLimits.js';

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

const LIMIT_HEADERS = {
  'anthropic-ratelimit-requests-limit': '4000',
  'anthropic-ratelimit-requests-remaining': '3998',
  'anthropic-ratelimit-requests-reset': '2026-11-16T15:00:01Z',
  'anthropic-ratelimit-input-tokens-limit': '2000000',
  'anthropic-ratelimit-input-tokens-remaining': '1983000',
  'anthropic-ratelimit-input-tokens-reset': '2026-11-16T15:00:01Z',
  'anthropic-ratelimit-output-tokens-limit': '400000',
  'anthropic-ratelimit-output-tokens-remaining': '398000',
  'anthropic-ratelimit-output-tokens-reset': '2026-11-16T15:00:01Z',
};

function sdkCall({ status = 200, headers = LIMIT_HEADERS, body = { id: 'msg_1' } } = {}) {
  const response = new Response(JSON.stringify(body), { status, headers });
  const responsePromise = Promise.resolve().then(() => {
    if (status >= 400) {
      const err = new Error(`${status} error`);
      err.status = status;
      err.headers = response.headers;
      throw err;
    }
    return response;
  });
  const parsed = responsePromise.then((r) => r.json());
  parsed.asResponse = () => responsePromise;
  return parsed;
}

describe('the headers read, by name (Anthropic API docs, "Rate limits" → "Response headers")', () => {
  it('six headers, exactly these names', () => {
    expect(RATE_LIMIT_HEADERS).toEqual({
      requestsLimit: 'anthropic-ratelimit-requests-limit',
      requestsRemaining: 'anthropic-ratelimit-requests-remaining',
      inputTokensLimit: 'anthropic-ratelimit-input-tokens-limit',
      inputTokensRemaining: 'anthropic-ratelimit-input-tokens-remaining',
      outputTokensLimit: 'anthropic-ratelimit-output-tokens-limit',
      outputTokensRemaining: 'anthropic-ratelimit-output-tokens-remaining',
    });
  });

  it('parses a Headers object and a plain object; an absent header is null', () => {
    const full = parseRateLimitHeaders(new Headers(LIMIT_HEADERS));
    expect(full).toEqual({ requestsLimit: 4000, requestsRemaining: 3998, inputTokensLimit: 2000000, inputTokensRemaining: 1983000, outputTokensLimit: 400000, outputTokensRemaining: 398000 });
    expect(parseRateLimitHeaders({ 'anthropic-ratelimit-requests-limit': '50' })).toEqual({
      requestsLimit: 50, requestsRemaining: null, inputTokensLimit: null, inputTokensRemaining: null, outputTokensLimit: null, outputTokensRemaining: null,
    });
    expect(Object.values(parseRateLimitHeaders(null)).every((v) => v === null)).toBe(true);
  });

  it('a malformed value is null, never a guess: "4k", "-1", "1.5", "", "1e3"', () => {
    for (const v of ['4k', '-1', '1.5', '', '1e3', 'NaN', ' ']) {
      expect(parseRateLimitHeaders({ 'anthropic-ratelimit-requests-limit': v }).requestsLimit).toBeNull();
    }
    expect(parseRateLimitHeaders({ 'anthropic-ratelimit-requests-limit': ' 77 ' }).requestsLimit).toBe(77);
  });

  it('a headers object whose read THROWS gives all nulls, and does not throw', () => {
    const evil = { get: () => { throw new Error('boom'); } };
    expect(() => parseRateLimitHeaders(evil)).not.toThrow();
    expect(Object.values(parseRateLimitHeaders(evil)).every((v) => v === null)).toBe(true);
  });
});

describe('the run window', () => {
  it('with no call, every value is null and responses429 is 0', () => {
    const w = openRateLimitWindow();
    expect(closeRateLimitWindow(w)).toEqual({
      requestsLimit: null, inputTokensLimit: null, outputTokensLimit: null,
      minRequestsRemaining: null, minInputTokensRemaining: null, minOutputTokensRemaining: null, responses429: 0,
    });
  });

  it('keeps the MINIMUM remaining and the LOWEST limit seen; counts 429s; stops collecting once closed', () => {
    const w = openRateLimitWindow();
    recordRateLimitObservation({ headers: LIMIT_HEADERS, status: 200 });
    recordRateLimitObservation({ headers: { ...LIMIT_HEADERS, 'anthropic-ratelimit-requests-remaining': '12', 'anthropic-ratelimit-output-tokens-limit': '350000' }, status: 200 });
    recordRateLimitObservation({ headers: { 'anthropic-ratelimit-input-tokens-remaining': '5000' }, status: 429 });
    recordRateLimitObservation({ headers: null, status: 429 });
    const out = closeRateLimitWindow(w);
    expect(out).toEqual({
      requestsLimit: 4000, inputTokensLimit: 2000000, outputTokensLimit: 350000,
      minRequestsRemaining: 12, minInputTokensRemaining: 5000, minOutputTokensRemaining: 398000, responses429: 2,
    });
    recordRateLimitObservation({ headers: { 'anthropic-ratelimit-requests-remaining': '1' }, status: 429 });
    expect(closeRateLimitWindow(w)).toEqual(out); // idempotent; closed windows collect nothing
  });

  it('closeRateLimitWindow(null) is null and never throws', () => {
    expect(closeRateLimitWindow(null)).toBeNull();
  });
});

describe('observeRateLimits — a pass-through of the one call', () => {
  it('hands the SAME arguments to the SDK and returns the SDK\'s own promise', async () => {
    const calls = [];
    let returned;
    const client = { messages: { create(body, options) { calls.push({ self: this, body, options }); returned = sdkCall(); return returned; } } };
    const body = { model: 'm', messages: [] };
    const options = { timeout: 40_000, signal: new AbortController().signal };
    const w = openRateLimitWindow();
    const out = observeRateLimits(client).messages.create(body, options);
    expect(out).toBe(returned);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toBe(body);
    expect(calls[0].options).toBe(options);
    expect(calls[0].self).toBe(client.messages); // a method call, `this` kept
    expect(await out).toEqual({ id: 'msg_1' });
    await flush();
    expect(closeRateLimitWindow(w)).toMatchObject({ requestsLimit: 4000, minRequestsRemaining: 3998, responses429: 0 });
  });

  it('a 429: the call still rejects with the SDK\'s own error; its headers and the 429 are recorded', async () => {
    const w = openRateLimitWindow();
    let call;
    const client = { messages: { create: () => { call = sdkCall({ status: 429, headers: { ...LIMIT_HEADERS, 'anthropic-ratelimit-requests-remaining': '0' } }); return call; } } };
    const out = observeRateLimits(client).messages.create({}, {});
    const err = await out.catch((e) => e);
    expect(err.status).toBe(429);
    await flush();
    expect(closeRateLimitWindow(w)).toMatchObject({ minRequestsRemaining: 0, requestsLimit: 4000, responses429: 1 });
  });

  it('a headers read that throws records nulls and leaves the call\'s result unchanged', async () => {
    const w = openRateLimitWindow();
    const response = { headers: { get: () => { throw new Error('header boom'); } }, status: 200 };
    const parsed = Promise.resolve({ id: 'msg_2' });
    parsed.asResponse = () => Promise.resolve(response);
    const client = { messages: { create: () => parsed } };
    expect(await observeRateLimits(client).messages.create({}, {})).toEqual({ id: 'msg_2' });
    await flush();
    expect(closeRateLimitWindow(w)).toMatchObject({ requestsLimit: null, minRequestsRemaining: null, responses429: 0 });
  });

  it('an asResponse() that throws synchronously never reaches the call path', async () => {
    const parsed = Promise.resolve({ id: 'msg_3' });
    parsed.asResponse = () => { throw new Error('sync boom'); };
    const client = { messages: { create: () => parsed } };
    expect(await observeRateLimits(client).messages.create({}, {})).toEqual({ id: 'msg_3' });
  });

  it('a non-SDK promise (the suites\' double): no headers; a rejected one with status 429 is still counted', async () => {
    const w = openRateLimitWindow();
    const plain = Promise.reject(Object.assign(new Error('rate limited'), { status: 429 }));
    const client = { messages: { create: () => plain } };
    await observeRateLimits(client).messages.create({}, {}).catch(() => {});
    await flush();
    expect(closeRateLimitWindow(w)).toMatchObject({ responses429: 1, requestsLimit: null });
  });

  it('a value that is not a promise at all passes straight through', () => {
    const client = { messages: { create: () => 42 } };
    expect(observeRateLimits(client).messages.create({}, {})).toBe(42);
  });
});
