// api/_utils/huddle/speech.test.js
//
// Huddle S1 — the speech call (spec V1.1 §5.3 "Speech"; concept V1.2 §4.1). A refusal keeps the error body's short
// machine code in the reason (the verification run's two 400s were unreadable without it; build report RF-13), never the
// message and never the key; the alignment is read from `alignment.characters`; beat boundaries come from it.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  synthesizeWithTimestamps, synthesizeWithRetry, isRetryableSpeechFailure, joinBeats, beatTimings, alignmentDurationMs, SPEECH_RETRY_WAIT_MS, SPEECH_RETRY_MIN_LEFT_MS,
} from './speech.js';
import { ELEVENLABS_TIMESTAMPS_CAPTURE, OBSERVED_TOP_KEYS, OBSERVED_ALIGNMENT_KEYS } from '../__fixtures__/elevenLabsTimestampsCapture.js';

const quiet = { log: vi.fn(), warn: vi.fn() };
const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('alignmentDurationMs (review L1-2)', () => {
  it('the last end time in ms; unknown (missing, empty, not a positive number) is null, never 0, and never throws', () => {
    expect(alignmentDurationMs({ character_end_times_seconds: [0.1, 0.2, 61.25] })).toBe(61250);
    expect(alignmentDurationMs({ character_end_times_seconds: [] })).toBeNull();
    expect(alignmentDurationMs({ characters: ['a'] })).toBeNull();
    expect(alignmentDurationMs({ character_end_times_seconds: [0] })).toBeNull();
    expect(alignmentDurationMs({ character_end_times_seconds: ['1'] })).toBeNull();
    expect(alignmentDurationMs(null)).toBeNull();
  });
});

describe('synthesizeWithTimestamps', () => {
  it('a refusal carries the error\'s status code, and nothing of its message', async () => {
    const log = { log: vi.fn(), warn: vi.fn() };
    const r = await synthesizeWithTimestamps({ text: 'Hi.', voiceId: 'v', apiKey: 'k-secret', log, fetchImpl: respond(400, { detail: { status: 'voice_not_found', message: 'A voice with id v was not found.' } }) });
    expect(r).toEqual({ ok: false, reason: 'http_400:voice_not_found' });
    const logged = JSON.stringify(log.warn.mock.calls);
    expect(logged).toContain('voice_not_found');
    expect(logged).not.toContain('was not found');
    expect(logged).not.toContain('k-secret');
  });

  it('a refusal without a readable code is the bare status; a code of the wrong shape is not kept', async () => {
    expect(await synthesizeWithTimestamps({ text: 'Hi.', voiceId: 'v', apiKey: 'k', log: quiet, fetchImpl: respond(500, 'oops') })).toEqual({ ok: false, reason: 'http_500' });
    expect(await synthesizeWithTimestamps({ text: 'Hi.', voiceId: 'v', apiKey: 'k', log: quiet, fetchImpl: respond(400, { detail: { status: 'Bad Thing <b>' } }) })).toEqual({ ok: false, reason: 'http_400' });
  });

  it('no voice id or no key: no call', async () => {
    const fetchImpl = vi.fn();
    expect(await synthesizeWithTimestamps({ text: 'Hi.', voiceId: '', apiKey: 'k', fetchImpl, log: quiet })).toEqual({ ok: false, reason: 'no_voice_id' });
    expect(await synthesizeWithTimestamps({ text: 'Hi.', voiceId: 'v', apiKey: '', fetchImpl, log: quiet })).toEqual({ ok: false, reason: 'no_api_key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an answer with audio and alignment is ok; beat boundaries come from the character alignment', async () => {
    const { text, spans } = joinBeats([{ id: 'tape', text: 'Ab.' }, { id: 'plan', text: 'Cd.' }]);
    expect(text).toBe('Ab.\n\nCd.');
    const chars = [...text];
    const alignment = { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.1), character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1) };
    const r = await synthesizeWithTimestamps({ text, voiceId: 'v', apiKey: 'k', log: quiet, fetchImpl: respond(200, { audio_base64: Buffer.from('mp3').toString('base64'), alignment, normalized_alignment: alignment }) });
    expect(r.ok).toBe(true);
    expect(r.keys).toEqual(['alignment', 'audio_base64', 'normalized_alignment']);
    expect(beatTimings(spans, r.alignment, text)).toEqual([{ id: 'tape', startMs: 0, endMs: 300 }, { id: 'plan', startMs: 500, endMs: 800 }]);
    expect(beatTimings(spans, { ...alignment, characters: chars.slice(1) }, text)).toBeNull();
  });
});

// ── Amendment E §E4 (R-17): the reader against ONE real response, and (R-19) one retry inside the job ──

describe('E4 (R-17): the alignment reader, written against the captured with-timestamps response', () => {
  const C = ELEVENLABS_TIMESTAMPS_CAPTURE;
  const captured = { ...C.response, audio_base64: C.response.audio_base64 };
  delete captured.status; delete captured.contentType; delete captured.elapsedMs; delete captured.audioBase64Length; delete captured.mp3Bytes;

  it('the capture: four top-level keys; the raw alignment\'s three arrays cover the joined text EXACTLY, "\\n\\n" included', () => {
    expect(Object.keys(captured).sort()).toEqual([...OBSERVED_TOP_KEYS]);
    expect(Object.keys(C.response.alignment).sort()).toEqual([...OBSERVED_ALIGNMENT_KEYS]);
    const { text } = joinBeats([{ id: 'tape', text: 'SPY closed at 682.10 on Friday, up 0.66 percent.' }, { id: 'plan', text: "Here's what I'd carry in today: hold CCI. One line: no adds to RKLB before its report." }]);
    expect(text).toBe(C.request.text);
    expect(C.response.alignment.characters.join('')).toBe(text);
    for (const k of OBSERVED_ALIGNMENT_KEYS) expect(C.response.alignment[k]).toHaveLength(text.length);
    // the normalized alignment is NOT the text (spaces added, the separator collapsed): the reader must never use it
    expect(C.response.normalized_alignment.length).not.toBe(text.length);
  });

  it('the helper reads the captured body: ok, the audio decoded, the keys as observed; the beat bounds and the duration compute', async () => {
    const r = await synthesizeWithTimestamps({ text: C.request.text, voiceId: C.request.voiceId, apiKey: 'k', log: quiet, fetchImpl: respond(200, captured) });
    expect(r.ok).toBe(true);
    expect(r.keys).toEqual([...OBSERVED_TOP_KEYS]);
    expect(Buffer.isBuffer(r.mp3) && r.mp3.length > 0).toBe(true);
    expect(beatTimings(C.request.spans, r.alignment, C.request.text)).toEqual([{ id: 'tape', startMs: 0, endMs: 5793 }, { id: 'plan', startMs: 6177, endMs: 14768 }]);
    expect(alignmentDurationMs(r.alignment)).toBe(14768);
    // read against the normalized alignment instead, the bounds would be refused (lengths differ): never wrong timings
    expect(beatTimings(C.request.spans, C.response.normalized_alignment, C.request.text)).toBeNull();
  });

  it('no key the capture lacks is read from the response body (source scan of the reader)', () => {
    const src = readFileSync(new URL('./speech.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    const bodyReads = [...src.matchAll(/\bbody\?*\.([a-z0-9_]+)/gi)].map((m) => m[1]);
    expect([...new Set(bodyReads)].sort()).toEqual(['alignment', 'audio_base64']);
    const alignmentReads = [...src.matchAll(/\balignment\?*\.([a-z0-9_]+)/gi)].map((m) => m[1]);
    for (const k of alignmentReads) expect(OBSERVED_ALIGNMENT_KEYS, k).toContain(k);
    expect(src).not.toMatch(/normalized_alignment|quality_check/);
  });
});

describe('E4 (R-19): one retry inside the job — a 429, a 5xx or an attempt timeout; nothing else', () => {
  const OK = { ok: true, mp3: Buffer.from('x'), alignment: { characters: ['x'], character_start_times_seconds: [0], character_end_times_seconds: [0.2] }, voiceId: 'v', keys: [] };
  const run = (results, over = {}) => {
    const calls = [];
    const synthesize = vi.fn(async (args) => { calls.push(args); const next = results.shift(); return typeof next === 'function' ? next(args) : next; });
    const sleep = vi.fn(async () => {});
    return { calls, sleep, synthesize, go: () => synthesizeWithRetry({ text: 'Hello.', synthesize, sleep, clock: () => 1000, deadlineMs: 120_000, ...over }) };
  };

  it.each(['http_429', 'http_503', 'http_500:server_error'])('%s once, then audio: retried once, with the same text, after the wait', async (reason) => {
    const h = run([{ ok: false, reason }, OK]);
    const r = await h.go();
    expect(r).toMatchObject({ ok: true, attempts: 2, firstFailure: reason });
    expect(h.synthesize).toHaveBeenCalledTimes(2);
    expect(h.calls.map((c) => c.text)).toEqual(['Hello.', 'Hello.']);
    expect(h.sleep).toHaveBeenCalledWith(SPEECH_RETRY_WAIT_MS);
  });

  it('a second failure gives up: the day publishes text-only, with the second reason (and the first kept)', async () => {
    const h = run([{ ok: false, reason: 'http_503' }, { ok: false, reason: 'http_502' }]);
    expect(await h.go()).toMatchObject({ ok: false, reason: 'http_502', attempts: 2, firstFailure: 'http_503' });
    expect(h.synthesize).toHaveBeenCalledTimes(2);
  });

  it.each(['http_400:voice_not_found', 'http_401', 'no_voice_id', 'no_api_key', 'missing_audio_or_alignment', 'request_failed', 'aborted'])('%s is not retried', async (reason) => {
    const h = run([{ ok: false, reason }, OK]);
    expect(await h.go()).toMatchObject({ ok: false, reason, attempts: 1 });
    expect(h.synthesize).toHaveBeenCalledTimes(1);
    expect(isRetryableSpeechFailure(reason)).toBe(false);
  });

  it('an attempt that outlives its own timeout is aborted and reads `timeout`, which is retried', async () => {
    const hang = (args) => new Promise((resolve) => { args.signal.addEventListener('abort', () => resolve({ ok: false, reason: 'aborted' })); });
    const h = run([hang, OK], { attemptTimeoutMs: 5 });
    expect(await h.go()).toMatchObject({ ok: true, attempts: 2, firstFailure: 'timeout' });
  });

  // review HD-6: each row aborts the JOB while the attempt's own answer is RETRYABLE (or the attempt timer fired), so each of
  // the three job-abort guards is the only thing that stops a second call
  it("the JOB's deadline is never retried: aborted while the attempt answers a retryable 503", async () => {
    const job = new AbortController();
    const h = run([() => { job.abort(); return { ok: false, reason: 'http_503' }; }, OK], { signal: job.signal, deadlineMs: Infinity });
    expect(await h.go()).toMatchObject({ ok: false, reason: 'http_503', attempts: 1 });
    expect(h.synthesize).toHaveBeenCalledTimes(1);
    expect(h.sleep).not.toHaveBeenCalled(); // given up at once: no wait spent on a job already out of time
  });

  it("the JOB's deadline is never retried: aborted during the wait before the second attempt", async () => {
    const job = new AbortController();
    const h = run([{ ok: false, reason: 'http_429' }, OK], { signal: job.signal, deadlineMs: Infinity });
    h.sleep.mockImplementation(async () => { job.abort(); });
    expect(await h.go()).toMatchObject({ ok: false, reason: 'http_429', attempts: 1 });
    expect(h.synthesize).toHaveBeenCalledTimes(1);
  });

  it("the JOB's deadline is never read as the attempt's own timeout: both fired, the failure stays `aborted`", async () => {
    const job = new AbortController();
    const hang = (args) => new Promise((resolve) => { args.signal.addEventListener('abort', () => { job.abort(); resolve({ ok: false, reason: 'aborted' }); }); });
    const h = run([hang, OK], { signal: job.signal, attemptTimeoutMs: 5, deadlineMs: Infinity });
    expect(await h.go()).toMatchObject({ ok: false, reason: 'aborted', attempts: 1 });
    expect(h.synthesize).toHaveBeenCalledTimes(1);
  });

  it('no retry without room in the job: the wait plus the minimum left must fit before the deadline', async () => {
    const h = run([{ ok: false, reason: 'http_429' }, OK], { deadlineMs: 1000 + SPEECH_RETRY_WAIT_MS + SPEECH_RETRY_MIN_LEFT_MS - 1 });
    expect(await h.go()).toMatchObject({ ok: false, reason: 'http_429', attempts: 1, retry: 'no_budget' });
    const room = run([{ ok: false, reason: 'http_429' }, OK], { deadlineMs: 1000 + SPEECH_RETRY_WAIT_MS + SPEECH_RETRY_MIN_LEFT_MS });
    expect(await room.go()).toMatchObject({ ok: true, attempts: 2 });
  });
});
