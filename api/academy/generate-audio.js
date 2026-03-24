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

const SCENE_ORDER = ['hook', 'context', 'chartReplay', 'mechanism', 'gameConnection', 'outro'];

const SCENE_BREAKS = {
  hook: '<break time="1.5s" />',
  context: '<break time="1.0s" />',
  chartReplay: '<break time="1.0s" />',
  mechanism: '<break time="1.0s" />',
  gameConnection: '<break time="1.0s" />',
  // no break after outro
};

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

  for (const sceneName of SCENE_ORDER) {
    const scene = scenes[sceneName];
    if (!scene || !scene.narration || typeof scene.narration !== 'string') continue;

    const text = scene.narration.trim();
    if (!text) continue;

    const wordCount = text.split(/\s+/).length;
    perScene[sceneName] = { characterCount: text.length, wordCount };

    parts.push(text);
    if (SCENE_BREAKS[sceneName]) {
      parts.push(SCENE_BREAKS[sceneName]);
    }
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
