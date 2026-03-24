// api/academy/generate-audio.js
// Admin endpoint to generate TTS audio from Academy video script narrations via ElevenLabs.
//
// Usage:
//   POST /api/academy/generate-audio
//   Auth: Authorization: Bearer {CRON_SECRET} or X-Admin-Secret header or ?secret= query param
//
//   Body: {
//     "scenes": {
//       "hook": { "narration": "..." },
//       "context": { "narration": "..." },
//       ...
//     },
//     "voiceId": "pNInz6obpgDQGcFmaJgB",
//     "options": { "modelId": "eleven_multilingual_v2", "outputFormat": "mp3_44100_128", ... },
//     "download": false,
//     "entryId": "short-squeeze"
//   }
//
//   Also accepts a full VideoScript JSON — narration is extracted from scenes.{sceneName}.narration.

export const config = { maxDuration: 300 };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Each entry lists alternative scene names in priority order (new name first, old fallback second).
// The endpoint accepts EITHER naming convention (or a mix).
const SCENE_PAIRS = [
  ['coldOpen', 'hook'],
  ['setup', 'context'],
  ['evidence', 'chartReplay'],
  ['revelation', 'mechanism'],
  ['connection', 'gameConnection'],
  ['outro'],
];

// SSML break after each scene (by index). 1.5s after the first scene, 1.0s between others.
// No break after the last scene that has narration.
const SCENE_BREAK_TIMES = ['1.5s', '1.0s', '1.0s', '1.0s', '1.0s'];

const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
const DEFAULT_STABILITY = 0.5;
const DEFAULT_SIMILARITY_BOOST = 0.75;
const DEFAULT_STYLE = 0.3;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[AcademyAudio]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

function logError(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.error(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.error(`${ts} ${LOG_PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractNarrations(scenes) {
  const perScene = {};
  const parts = [];
  let matchedCount = 0;

  for (let i = 0; i < SCENE_PAIRS.length; i++) {
    const alternatives = SCENE_PAIRS[i];
    // Pick the first alternative that has narration text
    let sceneName = null;
    let scene = null;
    for (const name of alternatives) {
      const candidate = scenes[name];
      if (candidate && candidate.narration && typeof candidate.narration === 'string' && candidate.narration.trim()) {
        sceneName = name;
        scene = candidate;
        break;
      }
    }
    if (!sceneName) continue;

    const text = scene.narration.trim();
    const wordCount = text.split(/\s+/).length;
    perScene[sceneName] = { characterCount: text.length, wordCount };

    parts.push(text);
    // Add SSML break after this scene (except the very last scene with narration)
    if (SCENE_BREAK_TIMES[i]) {
      parts.push(`<break time="${SCENE_BREAK_TIMES[i]}" />`);
    }
    matchedCount++;
  }

  // Remove trailing break if the last pushed item was a break tag
  if (parts.length > 0 && parts[parts.length - 1].startsWith('<break')) {
    parts.pop();
  }

  const combined = parts.join(' ');
  const totalChars = Object.values(perScene).reduce((s, v) => s + v.characterCount, 0);
  const totalWords = Object.values(perScene).reduce((s, v) => s + v.wordCount, 0);

  return { combined, stats: { perScene, totalChars, totalWords } };
}

function estimateDuration(wordCount) {
  const seconds = Math.round(wordCount / 2.5);
  return `~${seconds} seconds`;
}

function parseOutputFormat(fmt) {
  const parts = fmt.split('_');
  if (parts.length === 3) {
    return { format: parts[0], sampleRate: parseInt(parts[1], 10), bitrate: parseInt(parts[2], 10) };
  }
  return { format: 'mp3', sampleRate: 44100, bitrate: 128 };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Auth: Bearer token, x-admin-secret header, or ?secret= query param
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!adminSecret) {
    logError('No ADMIN_SECRET or CRON_SECRET configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const authHeader = req.headers.authorization;
  const providedSecret = req.headers['x-admin-secret'] || req.query.secret;
  const bearerMatch = authHeader === `Bearer ${adminSecret}`;
  const secretMatch = providedSecret === adminSecret;

  if (!bearerMatch && !secretMatch) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check ElevenLabs key early
  if (!process.env.ELEVENLABS_API_KEY) {
    logError('ELEVENLABS_API_KEY not configured');
    return res.status(500).json({ error: 'ElevenLabs API not configured' });
  }

  try {
    const body = req.body || {};
    const { scenes, voiceId, options = {}, download = false, entryId } = body;

    // --- Validation ---
    if (!voiceId || typeof voiceId !== 'string') {
      return res.status(400).json({ error: 'voiceId is required' });
    }

    if (!scenes || typeof scenes !== 'object' || Array.isArray(scenes)) {
      return res.status(400).json({ error: 'Missing scenes object' });
    }

    const narrationData = extractNarrations(scenes);
    if (!narrationData.combined.trim()) {
      return res.status(400).json({ error: 'No narration text found in scenes' });
    }

    // --- Build ElevenLabs request ---
    const modelId = options.modelId || DEFAULT_MODEL_ID;
    const outputFormat = options.outputFormat || DEFAULT_OUTPUT_FORMAT;
    const stability = options.stability ?? DEFAULT_STABILITY;
    const similarityBoost = options.similarityBoost ?? DEFAULT_SIMILARITY_BOOST;
    const style = options.style ?? DEFAULT_STYLE;

    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;

    const ttsPayload = {
      text: narrationData.combined,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
      },
    };

    logInfo('Calling ElevenLabs TTS', {
      voiceId,
      modelId,
      outputFormat,
      charCount: narrationData.stats.totalChars,
      wordCount: narrationData.stats.totalWords,
    });

    // --- Call ElevenLabs ---
    const ttsResponse = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(ttsPayload),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text().catch(() => '');
      logError('ElevenLabs API error', { status: ttsResponse.status, body: errorText });
      return res.status(502).json({
        error: 'ElevenLabs API error',
        detail: errorText,
        status: ttsResponse.status,
      });
    }

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    logInfo('TTS audio received', { bytes: audioBuffer.length });

    // --- Download mode: return raw MP3 ---
    if (download) {
      const filename = entryId ? `${entryId}-narration.mp3` : 'academy-narration.mp3';
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', audioBuffer.length);
      return res.status(200).send(audioBuffer);
    }

    // --- JSON mode: return base64 ---
    const { format, sampleRate, bitrate } = parseOutputFormat(outputFormat);

    return res.status(200).json({
      success: true,
      entryId: entryId || null,
      audio: {
        base64: audioBuffer.toString('base64'),
        format,
        sampleRate,
        bitrate,
        characterCount: narrationData.stats.totalChars,
        estimatedDuration: estimateDuration(narrationData.stats.totalWords),
      },
      scenes: narrationData.stats.perScene,
      voiceId,
      modelId,
    });
  } catch (err) {
    logError('Audio generation failed', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: err.message });
  }
}
