// api/_utils/huddle/speech.test.js
//
// Huddle S1 — the speech call (spec V1.1 §5.3 "Speech"; concept V1.2 §4.1). A refusal keeps the error body's short
// machine code in the reason (the verification run's two 400s were unreadable without it; build report RF-13), never the
// message and never the key; the alignment is read from `alignment.characters`; beat boundaries come from it.

import { describe, it, expect, vi } from 'vitest';
import { synthesizeWithTimestamps, joinBeats, beatTimings } from './speech.js';

const quiet = { log: vi.fn(), warn: vi.fn() };
const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

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
