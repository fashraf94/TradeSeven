// api/_utils/huddle/speech.js
//
// Huddle S1 — SPEECH WITH WORD TIMINGS (spec V1.1 §5.3 "Speech"; concept V1.2 §4.1).
// ElevenLabs text-to-speech WITH TIMESTAMPS for the joined beats, Shadow's voice
// (`HUDDLE_SHADOW_VOICE_ID`, founder question 1), `eleven_multilingual_v2`, raw `fetch` as
// the academy route does (api/academy/generate-audio.js:184, :205-213; its settings
// :43-47), abortable. Beat boundaries come from the CHARACTER alignment: each beat's
// start is its first character's start time, its end its last character's end time.
// No voice id set → no call: the huddle publishes transcript-only (R-10's transcript
// fallback) with the reason recorded.

export const SPEECH_MODEL = 'eleven_multilingual_v2';
export const SPEECH_OUTPUT_FORMAT = 'mp3_44100_128';
export const SPEECH_VOICE_SETTINGS = Object.freeze({ stability: 0.5, similarity_boost: 0.75, style: 0.3 });
export const VOICE_ENV = 'HUDDLE_SHADOW_VOICE_ID';
export const BEAT_SEPARATOR = '\n\n';

/** Join the beats and record each one's character span in the joined text (pure). */
export function joinBeats(beats) {
  let text = '';
  const spans = [];
  for (const b of beats) {
    if (!b.text) continue;
    if (text) text += BEAT_SEPARATOR;
    const start = text.length;
    text += b.text;
    spans.push({ id: b.id, start, end: text.length - 1 });
  }
  return { text, spans };
}

/**
 * Beat boundaries from the character alignment (pure).
 * @param {{ characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[] }} alignment
 * @returns {Array<{ id, startMs, endMs }>|null} null when the alignment does not cover the text
 */
export function beatTimings(spans, alignment, text) {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends)) return null;
  if (chars.length !== text.length || starts.length !== chars.length || ends.length !== chars.length) return null;
  return spans.map((s) => ({ id: s.id, startMs: Math.round(starts[s.start] * 1000), endMs: Math.round(ends[s.end] * 1000) }));
}

/**
 * The one speech call. Never throws; never logs the key.
 * @returns {Promise<{ ok: true, mp3: Buffer, alignment: object, voiceId: string, keys: string[] } | { ok: false, reason: string, keys?: string[] }>}
 */
export async function synthesizeWithTimestamps({ text, signal, voiceId = process.env[VOICE_ENV], apiKey = process.env.ELEVENLABS_API_KEY, fetchImpl = fetch, log = console }) {
  if (!voiceId) return { ok: false, reason: 'no_voice_id' };
  if (!apiKey) return { ok: false, reason: 'no_api_key' };
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${SPEECH_OUTPUT_FORMAT}`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text, model_id: SPEECH_MODEL, voice_settings: SPEECH_VOICE_SETTINGS }),
      signal,
    });
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'aborted' : 'request_failed' };
  }
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };
  let body;
  try { body = await res.json(); } catch { return { ok: false, reason: 'unparseable' }; }
  const keys = Object.keys(body || {}).sort();
  const hasAlignment = Array.isArray(body?.alignment?.characters);
  log.log?.('[huddle/speech] answered', JSON.stringify({ keys, hasAlignment, chars: text.length }));
  if (typeof body?.audio_base64 !== 'string' || !hasAlignment) return { ok: false, reason: 'missing_audio_or_alignment', keys };
  return { ok: true, mp3: Buffer.from(body.audio_base64, 'base64'), alignment: body.alignment, voiceId, keys };
}
