// api/_utils/gemmaClient.test.js
//
// Coverage for parseVoiceLayerResponse — the 4-tier JSON extractor.
//
// Background: previously tier-4 returned `{ response: cleanedText || '...' }`
// which let Gemma's plain-text failure responses (e.g., "I have hit a snag…")
// flow through verbatim as agentMessage in callers that didn't shape-check.
// The contract changed to a structured parse-failure shape:
//   { parseError: true, errorReason: 'plaintext_passthrough' | 'empty_content', rawText }
// Callers MUST detect parseError and route to their own structured-error path.

import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { parseVoiceLayerResponse } from './gemmaClient.js';

describe('parseVoiceLayerResponse — happy paths (tiers 1-3 unchanged)', () => {
  it('tier 1: parses raw JSON', () => {
    const out = parseVoiceLayerResponse('{"response":"hello","hasDirective":false}');
    expect(out).toEqual({ response: 'hello', hasDirective: false });
    expect(out.parseError).toBeUndefined();
  });

  it('tier 2: extracts JSON from a fenced ```json block', () => {
    const fenced = 'preamble\n```json\n{"response":"hi","scratchpad":"thinking"}\n```\ntrailing prose';
    const out = parseVoiceLayerResponse(fenced);
    expect(out).toEqual({ response: 'hi', scratchpad: 'thinking' });
    expect(out.parseError).toBeUndefined();
  });

  it('tier 3: extracts the first {...} object even with surrounding prose', () => {
    const messy = 'Sure, here you go: {"response":"hi","x":1} and then some explanation.';
    const out = parseVoiceLayerResponse(messy);
    // Tier 3 grabs from first { to the LAST } via /\{[\s\S]*\}/.
    // For this input the last } is the JSON's own closer, so we get a clean parse.
    expect(out).toEqual({ response: 'hi', x: 1 });
    expect(out.parseError).toBeUndefined();
  });

  it('preserves arbitrary nested keys when JSON is valid', () => {
    const json = '{"response":"hi","activeThesis":{"summary":"s","instruments":["AAPL"]}}';
    const out = parseVoiceLayerResponse(json);
    expect(out.activeThesis.summary).toBe('s');
    expect(out.activeThesis.instruments).toEqual(['AAPL']);
  });
});

describe('parseVoiceLayerResponse — tier 4 structured parse failure', () => {
  it('returns parseError=true with errorReason="plaintext_passthrough" on plain text', () => {
    const out = parseVoiceLayerResponse('I have hit a snag, could you repeat the question?');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('plaintext_passthrough');
    expect(out.rawText).toBe('I have hit a snag, could you repeat the question?');
  });

  it('returns parseError=true with errorReason="empty_content" on empty string', () => {
    const out = parseVoiceLayerResponse('');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
    expect(out.rawText).toBe('');
  });

  it('returns parseError=true with errorReason="empty_content" on whitespace only', () => {
    const out = parseVoiceLayerResponse('   \n\t  ');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
  });

  it('returns parseError=true with errorReason="empty_content" when only fenced code blocks remain', () => {
    // Fenced block is non-JSON so tier 2 fails to parse; tier 3 also fails;
    // tier 4 strips ```...``` and finds nothing left → empty_content.
    const out = parseVoiceLayerResponse('```\nnot json\n```');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
  });

  it('preserves the raw text verbatim for shadow logging', () => {
    const raw = "I'm sorry, I cannot help with that request.";
    const out = parseVoiceLayerResponse(raw);
    expect(out.parseError).toBe(true);
    expect(out.rawText).toBe(raw);
  });

  it('returns parseError shape (not throw) on null input', () => {
    const out = parseVoiceLayerResponse(null);
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
    expect(out.rawText).toBe('');
  });

  it('returns parseError shape (not throw) on undefined input', () => {
    const out = parseVoiceLayerResponse(undefined);
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('empty_content');
    expect(out.rawText).toBe('');
  });

  it('returns parseError on malformed JSON that looks like JSON', () => {
    // Trailing comma — invalid JSON, no fence, no extractable {...}.
    // Wait: regex /\{[\s\S]*\}/ DOES match this. JSON.parse fails → falls to tier 4.
    const out = parseVoiceLayerResponse('{"response": "hi",}');
    expect(out.parseError).toBe(true);
    expect(out.errorReason).toBe('plaintext_passthrough');
  });
});

describe('parseVoiceLayerResponse — contract guarantees', () => {
  it('never throws on garbage input', () => {
    const garbageInputs = [
      null,
      undefined,
      '',
      '   ',
      'not json at all',
      '{ broken',
      '}{}',
      '```',
      '```json\nnot json```',
      '{ "key": "value" extra junk',
    ];
    for (const input of garbageInputs) {
      expect(() => parseVoiceLayerResponse(input)).not.toThrow();
    }
  });

  it('parseError shape never includes legacy fields like response/_scratchpad', () => {
    // Regression guard: if a caller still reads parsed.response on a
    // parse failure, it should get undefined (not Gemma's plain text).
    const out = parseVoiceLayerResponse('I have hit a snag.');
    expect(out.response).toBeUndefined();
    expect(out._scratchpad).toBeUndefined();
    expect(out.hasDirective).toBeUndefined();
    expect(out.directive).toBeUndefined();
    expect(out.suggestedActions).toBeUndefined();
  });
});

// ==========================================================================
// ABORT CLASSIFICATION — the Sep 3 2026 voice-timeout incident guard.
//
// These rows exist because a hand-mocked error could not have caught the bug.
// The defect lived in WHERE the abort surfaces: a `signal` on fetch covers the
// body read too, so a timeout firing mid-body leaves the response resolved
// (200, headers received) and rejects `.json()` instead. That rejection landed
// in a catch written for malformed JSON and came back out as a plain Error
// reading `OpenRouter 200: Invalid JSON from OpenRouter: This operation was
// aborted` — so every consumer classifying on `name === 'AbortError'` missed it.
//
// So these use a REAL http server, a REAL AbortController and REAL fetch. No
// stubbed Response, no hand-set `err.name`: the seam under test is undici's own
// behaviour, and modelling it by hand is how the original guard
// (chat.test.js "AbortError → 504") passed for months against a live defect.
//
// MUTATION CHECK: reverting the `isAbortError(jsonErr) || signal?.aborted`
// branch in _callGemmaOnce turns the first two rows red — callGemmaVoice throws
// name 'Error', and callGemmaVoiceWithRetry reports aborted undefined.
// ==========================================================================

import http from 'node:http';
import { callGemmaVoice, callGemmaVoiceWithRetry, isAbortError } from './gemmaClient.js';

describe('abort classification — a timeout is never reported as invalid JSON', () => {
  let server;
  let baseUrl;
  const openSockets = new Set();

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/stall-body') {
        // Headers + a partial body, then stall: the exact production shape.
        // fetch RESOLVES here (200) and the abort lands on the body read.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"choices":[{"message":{"content":');
        return;
      }
      if (req.url === '/stall-headers') return; // never respond — fetch itself rejects
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{"response":"ok"}' } }] }));
    });
    server.on('connection', (s) => { openSockets.add(s); s.on('close', () => openSockets.delete(s)); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    for (const s of openSockets) s.destroy();
    await new Promise((r) => server.close(r));
  });

  // OPENROUTER_URL is module-scoped, so point the call at the local server by
  // swapping global.fetch for a thin forwarder. Everything downstream of the
  // request — the real Response, the real body read, the real abort — is undici.
  function useLocalServer(path) {
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
      realFetch(`${baseUrl}${path}`, init));
  }
  afterEach(() => vi.restoreAllMocks());

  const call = (fn, timeoutMs = 120) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return Promise.resolve(fn({
      systemPrompt: 'sys', conversationHistory: [], userMessage: 'hi',
      signal: controller.signal,
    })).finally(() => clearTimeout(timer));
  };

  it('callGemmaVoice: abort DURING BODY READ throws a real AbortError (not "Invalid JSON")', async () => {
    useLocalServer('/stall-body');
    const err = await call(callGemmaVoice).then(
      () => { throw new Error('expected the call to reject'); },
      (e) => e,
    );

    // The load-bearing assertion: chat.js:681 classifies on this exact name, and
    // its 504 / gemma_timeout / honest-client-string path hangs off it.
    expect(err.name).toBe('AbortError');
    expect(isAbortError(err)).toBe(true);
    // The production string that must never be produced for an abort again.
    expect(err.message).not.toMatch(/Invalid JSON/);
    expect(err.message).not.toMatch(/OpenRouter 200/);
  });

  it('callGemmaVoiceWithRetry: abort DURING BODY READ reports aborted:true and does NOT retry', async () => {
    useLocalServer('/stall-body');
    const result = await call(callGemmaVoiceWithRetry);

    // The five sibling callers gate their 504 on this flag; without it they
    // answered HTTP 200 with "I hit a snag" on a turn that actually timed out.
    expect(result.success).toBe(false);
    expect(result.aborted).toBe(true);
    expect(result.error).not.toMatch(/Invalid JSON/);
    // An abort is not transient — one attempt only, never a retry into a
    // deadline that has already expired.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('callGemmaVoice: abort BEFORE HEADERS also throws AbortError (the window that always worked)', async () => {
    useLocalServer('/stall-headers');
    const err = await call(callGemmaVoice).then(
      () => { throw new Error('expected the call to reject'); },
      (e) => e,
    );
    expect(err.name).toBe('AbortError');
  });

  it('a genuine malformed-JSON body is STILL reported as invalid JSON (no over-classification)', async () => {
    // The regression this fix must not cause: non-abort parse failures keep
    // their own error shape, so real bad payloads are not mislabelled timeouts.
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      realFetch(`${baseUrl}/ok`).then((r) => ({
        ok: true, status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
        text: r.text.bind(r),
      })));

    const err = await callGemmaVoice({
      systemPrompt: 'sys', conversationHistory: [], userMessage: 'hi',
    }).then(() => { throw new Error('expected the call to reject'); }, (e) => e);

    expect(err.name).toBe('Error');
    expect(err.message).toMatch(/Invalid JSON from OpenRouter/);
  });

  it('a healthy response is unaffected', async () => {
    useLocalServer('/ok');
    const content = await callGemmaVoice({
      systemPrompt: 'sys', conversationHistory: [], userMessage: 'hi',
    });
    expect(JSON.parse(content).response).toBe('ok');
  });
});

// ==========================================================================
// THE SIBLING BODY-READ WINDOW — found by adversarial review of the first fix.
//
// `.text()` on a non-ok response is a body read too. The original fix closed
// only the `.json()` window, leaving the SAME defect eleven lines above it: an
// abort during the error-body read was erased into errorText:'unknown' and
// escaped with no AbortError and no `aborted` flag — the incident, intact, on
// the other branch. These rows pin both windows and the retry interaction.
// ==========================================================================

describe('abort classification — the error-body read window', () => {
  let server; let baseUrl; const openSockets = new Set();
  let attempts = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      attempts += 1;
      if (req.url === '/stall-error-body') {
        // Non-ok status, headers + partial body, then stall.
        res.writeHead(429, { 'Content-Type': 'text/plain' });
        res.write('partial error body');
        return;
      }
      if (req.url === '/retry-then-stall') {
        // Attempt 1: a COMPLETE 429 body, so the transient retry fires.
        // Attempt 2: headers + partial, then stall, so the deadline expires
        // inside the final attempt's error-body read — the window the retry
        // loop's pre-attempt signal check can never cover.
        res.writeHead(429, { 'Content-Type': 'text/plain' });
        if (attempts === 1) { res.end('rate limited'); return; }
        res.write('partial error body');
        return;
      }
      if (req.url === '/fast-error-body') {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('bad request');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{"response":"ok"}' } }] }));
    });
    server.on('connection', (s) => { openSockets.add(s); s.on('close', () => openSockets.delete(s)); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => {
    for (const s of openSockets) s.destroy();
    await new Promise((r) => server.close(r));
  });
  beforeEach(() => { attempts = 0; });
  afterEach(() => vi.restoreAllMocks());

  function useLocalServer(path) {
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
      realFetch(`${baseUrl}${path}`, init));
  }
  const call = (fn, timeoutMs = 120) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return Promise.resolve(fn({
      systemPrompt: 'sys', conversationHistory: [], userMessage: 'hi', signal: controller.signal,
    })).finally(() => clearTimeout(timer));
  };

  it('callGemmaVoice: abort during the ERROR body read throws a real AbortError', async () => {
    useLocalServer('/stall-error-body');
    const err = await call(callGemmaVoice).then(
      () => { throw new Error('expected the call to reject'); }, (e) => e);

    expect(err.name).toBe('AbortError');
    // Before the fix this was `OpenRouter 429: unknown` with name 'Error' —
    // chat.js would classify 500 and the client would lie again.
    expect(err.message).not.toMatch(/OpenRouter 429/);
    expect(err.message).not.toMatch(/unknown/);
  });

  it('callGemmaVoiceWithRetry: the likely production shape — 429, retry, deadline expires on attempt 2', async () => {
    // The retry loop only checks the signal BEFORE an attempt, so the last
    // attempt was never re-checked and returned with no `aborted` flag.
    useLocalServer('/retry-then-stall');
    const result = await call(callGemmaVoiceWithRetry, 2_400); // past the 2s backoff

    expect(result.success).toBe(false);
    expect(result.aborted).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(2);   // it really did retry first
  });

  it('a genuine non-ok response with NO abort still reports the HTTP error', async () => {
    // The regression guard: 400s must keep their own shape, not become timeouts.
    useLocalServer('/fast-error-body');
    const err = await callGemmaVoice({
      systemPrompt: 'sys', conversationHistory: [], userMessage: 'hi',
    }).then(() => { throw new Error('expected the call to reject'); }, (e) => e);

    expect(err.name).toBe('Error');
    expect(err.message).toMatch(/OpenRouter 400/);
  });

  it('asAbortError preserves the original error as `cause`', async () => {
    // A TimeoutError or a custom abort reason is the only record of WHY the
    // call aborted; fabricating a bare Error would discard it.
    const controller = new AbortController();
    useLocalServer('/stall-error-body');
    setTimeout(() => controller.abort(new Error('deadline exceeded')), 120);
    const err = await callGemmaVoice({
      systemPrompt: 'sys', conversationHistory: [], userMessage: 'hi', signal: controller.signal,
    }).then(() => null, (e) => e);

    expect(err.name).toBe('AbortError');
    expect(err.cause).toBeDefined();
  });
});
