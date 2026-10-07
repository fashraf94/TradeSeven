// api/_utils/gemmaClient.usage.test.js
//
// Pilot P2 — the model client's OPT-IN provider usage (acceptance row 10).
// The census (build report, "Model-usage census") found no caller that
// persists, spreads or serialises the whole result, yet the field is opt-in
// anyway: a caller that does not pass `includeUsage: true` gets the result
// object it always got, byte for byte, and the request sent is identical
// either way. Usage is the provider's own counts or null — never estimated;
// a call that needed a retry reports null (the failed attempt's consumption
// was never reported).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { callGemmaVoiceWithRetry } from './gemmaClient.js';

const body = (extra = {}) => ({ choices: [{ message: { content: '{"message":"hi"}' } }], ...extra });
const okResponse = (payload) => ({ ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) });
const errResponse = (status) => ({ ok: false, status, json: async () => ({}), text: async () => 'upstream' });
const ARGS = { systemPrompt: 'sys', conversationHistory: [{ role: 'user', content: 'earlier' }], userMessage: 'now' };

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('callGemmaVoiceWithRetry — usage is opt-in', () => {
  it('NOT opted in: exactly { success, content } (no usage key), even when the provider sends usage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(body({ usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } })));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = await callGemmaVoiceWithRetry(ARGS);
    expect(out).toStrictEqual({ success: true, content: '{"message":"hi"}' });
  });
  it('opted in: the provider\'s own prompt / completion counts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(body({ usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } })));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = await callGemmaVoiceWithRetry({ ...ARGS, includeUsage: true });
    expect(out).toStrictEqual({ success: true, content: '{"message":"hi"}', usage: { input: 120, output: 30 } });
  });
  it('opted in, but the provider sent no usable counts → usage null (never estimated)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const usage of [undefined, null, {}, { prompt_tokens: 5 }, { prompt_tokens: -1, completion_tokens: 2 }, { prompt_tokens: '5', completion_tokens: 2 }, { prompt_tokens: 1.5, completion_tokens: 2 }]) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(body(usage === undefined ? {} : { usage })));
      const out = await callGemmaVoiceWithRetry({ ...ARGS, includeUsage: true });
      expect(out, JSON.stringify(usage)).toStrictEqual({ success: true, content: '{"message":"hi"}', usage: null });
    }
  });
  it('opted in, success on the RETRY → usage null (the failed attempt\'s consumption is unknown)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse(body({ usage: { prompt_tokens: 10, completion_tokens: 2 } })));
    const pending = callGemmaVoiceWithRetry({ ...ARGS, includeUsage: true });
    await vi.runAllTimersAsync();
    const out = await pending;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(out).toStrictEqual({ success: true, content: '{"message":"hi"}', usage: null });
  });
  it('a failure result is unchanged by the opt-in', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errResponse(400));
    const a = await callGemmaVoiceWithRetry(ARGS);
    const b = await callGemmaVoiceWithRetry({ ...ARGS, includeUsage: true });
    expect(b).toStrictEqual(a);
    expect('usage' in b).toBe(false);
  });
  it('the request sent is byte-identical with and without the opt-in', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(body()));
    await callGemmaVoiceWithRetry(ARGS);
    await callGemmaVoiceWithRetry({ ...ARGS, includeUsage: true });
    const [[url1, init1], [url2, init2]] = fetchSpy.mock.calls;
    expect(url2).toBe(url1);
    expect(init2.body).toBe(init1.body);
    expect(init2.headers).toEqual(init1.headers);
    expect(init2.method).toBe(init1.method);
  });
});
