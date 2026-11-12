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
//
// THE CAPTURE (Amendment E §E4, R-17): the reader is written against one real response,
// api/_utils/__fixtures__/elevenLabsTimestampsCapture.js — four top-level keys, of which it
// reads `audio_base64` and `alignment` (its three arrays) and nothing else; the raw
// `alignment` covers the joined text exactly, "\n\n" between beats included, so the beat
// boundaries compute (`normalized_alignment` does not match the text and is never read).
//
// ONE RETRY INSIDE THE JOB (E4, R-19): a 429, a 5xx or an attempt that times out is retried
// once after a short wait, within the job's budget, with no new model call
// (synthesizeWithRetry); each attempt has its own timeout, chained to the job's signal (the
// job's own deadline is never retried). A second failure publishes the day text-only, as
// before; the record's immutability (A §A2) stands.

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
 * The audio's duration from the alignment (pure): the last character's end time when it is a positive number, else
 * null — an unknown duration is never 0 (review L1-2).
 */
export function alignmentDurationMs(alignment) {
  const ends = alignment?.character_end_times_seconds;
  const last = Array.isArray(ends) && ends.length ? ends[ends.length - 1] : null;
  return typeof last === 'number' && Number.isFinite(last) && last > 0 ? Math.round(last * 1000) : null;
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
  if (!res.ok) {
    // the error body's short machine code (ElevenLabs `detail.status`, e.g. `voice_not_found`), never its message
    let code = null;
    try {
      const err = await res.json();
      const status = err?.detail?.status;
      code = typeof status === 'string' && /^[a-z0-9_]{1,48}$/.test(status) ? status : null;
    } catch { /* not JSON */ }
    log.warn?.('[huddle/speech] refused', JSON.stringify({ status: res.status, code }));
    return { ok: false, reason: code ? `http_${res.status}:${code}` : `http_${res.status}` };
  }
  let body;
  try { body = await res.json(); } catch { return { ok: false, reason: 'unparseable' }; }
  const keys = Object.keys(body || {}).sort();
  const hasAlignment = Array.isArray(body?.alignment?.characters);
  log.log?.('[huddle/speech] answered', JSON.stringify({ keys, hasAlignment, chars: text.length }));
  if (typeof body?.audio_base64 !== 'string' || !hasAlignment) return { ok: false, reason: 'missing_audio_or_alignment', keys };
  return { ok: true, mp3: Buffer.from(body.audio_base64, 'base64'), alignment: body.alignment, voiceId, keys };
}

export const SPEECH_ATTEMPT_TIMEOUT_MS = 30_000;
export const SPEECH_RETRY_WAIT_MS = 2_000;
/** A retry is started only with at least this much of the job left after the wait (one Nov 9 attempt took ~6 s). */
export const SPEECH_RETRY_MIN_LEFT_MS = 15_000;

/** E4: the failures a second attempt may cure — a 429, a 5xx, or an attempt that timed out (never the job's deadline). */
export const isRetryableSpeechFailure = (reason) => typeof reason === 'string' && (/^http_(?:429|5\d\d)(?::|$)/.test(reason) || reason === 'timeout');

/**
 * E4 (R-19): the speech call with ONE retry inside the job. Each attempt gets its own AbortController, aborted by the job's
 * signal or by the attempt's timeout (a timed-out attempt reads `timeout`, retryable; the job's abort reads `aborted`,
 * not). The retry waits `waitMs` and starts only when at least `minLeftMs` of the job's deadline remain after it. No model
 * call is involved: the same text is voiced again.
 * @returns {Promise<object>} the attempt's result with `attempts` (1 or 2) and, after a retry, `firstFailure`
 */
export async function synthesizeWithRetry({
  text, signal, deadlineMs = Infinity, clock = () => Date.now(), sleep = (ms) => new Promise((r) => { setTimeout(r, ms); }),
  attemptTimeoutMs = SPEECH_ATTEMPT_TIMEOUT_MS, waitMs = SPEECH_RETRY_WAIT_MS, minLeftMs = SPEECH_RETRY_MIN_LEFT_MS,
  synthesize = synthesizeWithTimestamps, ...rest
}) {
  const attempt = async () => {
    const ctl = new AbortController();
    let timedOut = false;
    const onAbort = () => ctl.abort();
    if (signal?.aborted) ctl.abort();
    signal?.addEventListener?.('abort', onAbort);
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, Math.max(1, Math.min(attemptTimeoutMs, deadlineMs - clock())));
    try {
      const r = await synthesize({ text, signal: ctl.signal, ...rest });
      return !r.ok && timedOut && !signal?.aborted ? { ...r, reason: 'timeout' } : r;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }
  };
  const first = await attempt();
  if (first.ok || !isRetryableSpeechFailure(first.reason) || signal?.aborted) return { ...first, attempts: 1 };
  if (deadlineMs - clock() < waitMs + minLeftMs) return { ...first, attempts: 1, retry: 'no_budget' };
  await sleep(waitMs);
  if (signal?.aborted) return { ...first, attempts: 1 };
  const second = await attempt();
  return { ...second, attempts: 2, firstFailure: first.reason };
}
