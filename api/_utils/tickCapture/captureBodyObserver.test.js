// api/_utils/tickCapture/captureBodyObserver.test.js
//
// Stage B — the fetch-boundary observer, on its own. The end-to-end rows (the
// real cron, the real record) live in
// api/cron/agent-evaluate.tickCapture.bodies.test.js.

import { describe, it, expect, afterEach } from 'vitest';
import { activeBodyHolder, beginBodyCapture, endBodyCapture, makeObservingFetch } from './captureBodyObserver.js';
import { resolveBodyHolder, sha256Bytes, sha256Hex } from './captureWriter.js';

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
    expect(await holder.responseTextPromise).toMatchObject({ ok: true, text: '{"a":1}' });
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

  it('BLIND SPOT 2 (Astra round 1): fetch returns BEFORE the clone read resolves', async () => {
    // The old row used an immediately-available body and only checked that a
    // Promise existed, so awaiting the clone inside the observer would have
    // passed it. Here the clone read cannot resolve until the row says so, and
    // the assertion is that fetch had already returned.
    const holder = beginBodyCapture();
    let releaseBody;
    const bodyStream = new ReadableStream({
      start(controller) {
        releaseBody = () => { controller.enqueue(new TextEncoder().encode('{"late":true}')); controller.close(); };
      },
    });
    const base = async () => new Response(bodyStream, { status: 200, headers: { 'content-type': 'application/json' } });

    let fetchReturned = false;
    const inFlight = makeObservingFetch(base)('u', { body: '{}' }).then((r) => { fetchReturned = true; return r; });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 5));
    expect(fetchReturned, 'the observer must not await the clone read').toBe(true);
    expect(holder.responseTextPromise).toBeInstanceOf(Promise);

    releaseBody();
    const res = await inFlight;
    expect(await res.text()).toBe('{"late":true}');    // the SDK still reads its own
    const facts = await resolveBodyHolder(endBodyCapture());
    expect(facts.response.body).toBe('{"late":true}');
  });

  it('BLIND SPOT 3 (Astra round 1): a REJECTING body read is handled, with no unhandled rejection', async () => {
    // The existing rows only exercise a synchronous clone() throw. A stream
    // that errors mid-read rejects the text() promise instead — and an
    // unattached rejection handler would crash the process, not the capture.
    const unhandled = [];
    const onUnhandled = (err) => unhandled.push(err);
    process.on('unhandledRejection', onUnhandled);
    try {
      const holder = beginBodyCapture();
      const failing = new ReadableStream({ start(controller) { controller.error(new Error('stream aborted mid-read')); } });
      const base = async () => new Response(failing, { status: 200 });
      await makeObservingFetch(base)('u', { body: '{}' });
      const facts = await resolveBodyHolder(holder);
      expect(facts.response.body).toBeNull();
      expect(facts.copyError).toContain('stream aborted mid-read');
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled, 'a rejecting body read must not become an unhandled rejection').toEqual([]);
    } finally { process.off('unhandledRejection', onUnhandled); }
  });

  it('BLIND SPOT 3b: a rejecting body read on a CAPTURE-SKIPPED exit is still harmless', async () => {
    const unhandled = [];
    const onUnhandled = (err) => unhandled.push(err);
    process.on('unhandledRejection', onUnhandled);
    try {
      beginBodyCapture();
      const failing = new ReadableStream({ start(controller) { controller.error(new Error('aborted')); } });
      await makeObservingFetch(async () => new Response(failing, { status: 200 }))('u', { body: '{}' });
      endBodyCapture();                 // the tick skips capture: nobody ever resolves the holder
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled, 'an unresolved holder must not leak a rejection').toEqual([]);
    } finally { process.off('unhandledRejection', onUnhandled); }
  });

  it('F9 END TO END: the recorded digest is of the RECEIVED BYTES, not the decoded string', async () => {
    // A UTF-8 BOM is stripped by `.text()`. Reading the clone as text and
    // hashing that produced a digest of a string the wire never carried — so
    // the record could not be used to prove what arrived.
    const raw = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('{"model":"m"}')]);
    const holder = beginBodyCapture();
    await makeObservingFetch(async () => new Response(raw, { status: 200 }))('u', { body: '{}' });
    const facts = await resolveBodyHolder(endBodyCapture(holder));

    expect(facts.response.sha256).toBe(sha256Bytes(raw));
    expect(facts.response.bytes).toBe(raw.length);
    // …and that is NOT the digest of the decoded string, which is the point
    expect(facts.response.sha256).not.toBe(sha256Hex('{"model":"m"}'));
    // storage still holds readable text
    expect(facts.response.body).toBe('{"model":"m"}');
  });

  it('endBodyCapture refuses to close a window it does not own', async () => {
    // The identity check (F3): a caller can only close the holder it opened.
    // Scope isolation already stops one TICK closing another's; this stops a
    // stale reference inside one tick closing the live window.
    const mine = beginBodyCapture();
    const stranger = { dispatched: false, requestBody: null, requestError: null, status: null, responseTextPromise: null, responseError: null };
    expect(endBodyCapture(stranger), 'the stranger\'s close is refused').toBe(mine);
    await makeObservingFetch(async () => jsonResponse('{"still":"open"}'))('u', { body: '{"mine":1}' });
    expect(mine.requestBody, 'the window must still be open').toBe('{"mine":1}');
    expect(endBodyCapture(mine)).toBe(mine);
    expect(activeBodyHolder()).toBeNull();
  });

  it('endBodyCapture closes the window — a later dispatch writes into nothing', async () => {
    const holder = beginBodyCapture();
    endBodyCapture();
    await makeObservingFetch(async () => jsonResponse('{"late":true}'))('u', { body: '{"late":1}' });
    expect(holder.dispatched).toBe(false);
    expect(holder.requestBody).toBeNull();
  });
});
