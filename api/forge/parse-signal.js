// api/forge/parse-signal.js
//
// Phase 1 endpoint #1 of Signal Drop. Accepts a user-dropped piece of
// financial content (text, URL, or base64-encoded image) and returns a
// structured parse via Anthropic Haiku 4.5 + Forced Tool Use.
//
// Flow:
//   1. applySecurityMiddleware → requireAuth (Firebase ID token)
//   2. body shape validation
//   3. content-hash dedup against signalDropCache/{contentHash} (6h TTL)
//   4. URL types: 3s-abort fetch; on failure, mark urlFetchSucceeded=false
//   5. Haiku call: tool_choice forces submit_parsed_signal
//   6. ticker validation, injection-attempt detection
//   7. bailout / hard-checkpoint classification
//   8. cache write + per-user drop record
//   9. fire-and-forget shadow log to GCS
//
// Pattern reference: api/agent/decide.js (Anthropic singleton, Forced Tool Use,
// retry-with-tool-result-error). Phase 1 does not retry on validation
// failures — the validator is non-blocking and surfaces issues via
// shouldBailout / shouldHardCheckpoint instead.

import Anthropic from '@anthropic-ai/sdk';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildParsePromptInputs } from '../_utils/signalDropPrompt.js';
import { validateTickers } from '../_utils/tickerValidation.js';
import { hashText, hashUrl, hashImage } from '../_utils/contentHash.js';
import { detectInjectionAttempts } from '../_utils/injectionGuard.js';
import { sanitizeParsedOutput } from '../_utils/sanitizeParsedOutput.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 30 };

const CACHE_TTL_HOURS = 6;
const URL_FETCH_TIMEOUT_MS = 3000;
const URL_FETCH_BODY_CAP_BYTES = 200_000;
const TEXT_INPUT_CAP_CHARS = 5000;
const NOTE_CAP_CHARS = 500;
const URL_CAP_CHARS = 1000;
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const GENERIC_TOPIC_REGEX = /^(general|market|trading|finance|stocks?|investing)$/i;

// Lazy singleton — same pattern as api/agent/decide.js
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

function isNonEmptyString(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

// Best-effort body fetch for type=url. Returns { ok, body, error,
// readabilityOutcome }. The 3-second AbortController hard-cap protects
// the 30s endpoint budget. After a successful fetch we run the HTML
// through Mozilla Readability (lazy-imported so the cold-start cost is
// paid only on URL paths) and hand Haiku the extracted textContent in
// place of the raw HTML. On any Readability failure we fall back to the
// raw HTML slice so Haiku still receives content. The 200KB cap applies
// to both paths.
async function fetchUrlBody(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'FantasyTrades-SignalDrop/1.0' },
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}`, readabilityOutcome: 'not_applicable' };
    }
    const rawHtml = (await resp.text()).slice(0, URL_FETCH_BODY_CAP_BYTES);

    let extractedBody = null;
    let readabilityOutcome;
    try {
      const { JSDOM } = await import('jsdom');
      const { Readability } = await import('@mozilla/readability');
      const dom = new JSDOM(rawHtml, { url });
      const article = new Readability(dom.window.document, { charThreshold: 200 }).parse();
      if (article === null) {
        readabilityOutcome = 'fallback_null';
      } else if (!article.textContent || article.textContent.trim() === '') {
        readabilityOutcome = 'fallback_empty';
      } else {
        extractedBody = article.textContent.slice(0, URL_FETCH_BODY_CAP_BYTES);
        readabilityOutcome = 'extracted';
      }
    } catch {
      readabilityOutcome = 'fallback_failed';
    }
    return { ok: true, body: extractedBody ?? rawHtml, readabilityOutcome };
  } catch (err) {
    return { ok: false, error: err?.message || 'fetch failed', readabilityOutcome: 'not_applicable' };
  } finally {
    clearTimeout(timeout);
  }
}

function computeContentHash({ type, text, url, imageBuffer }) {
  if (type === 'text') return hashText(text);
  if (type === 'url') return hashUrl(url);
  if (type === 'image') return hashImage(imageBuffer);
  throw new Error(`computeContentHash: unsupported type "${type}"`);
}

// Phase 1 bailout / hard-checkpoint policy — see the plan file Step 3
// for the full rule set. Bailout is the "this is junk, don't expand"
// signal; hard-checkpoint asks the UI to surface a confirmation step
// before paying for an expansion call.
function classifyBailout(parsed, validatedCount, impliedCount) {
  const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : 0;
  const topic = (parsed?.topic || '').trim();
  const topicEmptyOrGeneric = topic.length < 5 || GENERIC_TOPIC_REGEX.test(topic);
  const noTickers = validatedCount === 0 && impliedCount === 0;

  const shouldBailout = confidence < 0.5 && noTickers && topicEmptyOrGeneric;
  const shouldHardCheckpoint = !shouldBailout && confidence < 0.6;
  return { shouldBailout, shouldHardCheckpoint };
}

export default async function handler(req, res) {
  // 1. Security + method
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Auth
  const user = await requireAuth(req, res);
  if (!user) return;

  // 3. Body validation
  const { type, text, url, imageBase64, imageMime, note, dropId } = req.body || {};

  if (!['text', 'url', 'image'].includes(type)) {
    return res.status(400).json({ error: 'type must be one of: text, url, image' });
  }
  if (!isNonEmptyString(dropId, 200)) {
    return res.status(400).json({ error: 'dropId is required (client-generated UUID)' });
  }
  if (note != null && !isNonEmptyString(note, NOTE_CAP_CHARS)) {
    return res.status(400).json({ error: `note must be a non-empty string ≤${NOTE_CAP_CHARS} chars` });
  }

  let imageBuffer = null;
  let normalizedText = null;
  let normalizedUrl = null;

  if (type === 'text') {
    if (!isNonEmptyString(text, TEXT_INPUT_CAP_CHARS)) {
      return res.status(400).json({ error: `text must be a non-empty string ≤${TEXT_INPUT_CAP_CHARS} chars` });
    }
    normalizedText = text.trim();
  } else if (type === 'url') {
    if (!isNonEmptyString(url, URL_CAP_CHARS)) {
      return res.status(400).json({ error: `url must be a non-empty string ≤${URL_CAP_CHARS} chars` });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'url is malformed' });
    }
    normalizedUrl = url.trim();
  } else {
    // image
    if (!isNonEmptyString(imageBase64, 8_000_000)) {
      return res.status(400).json({ error: 'imageBase64 is required for type=image (≤8MB)' });
    }
    try {
      imageBuffer = Buffer.from(imageBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'imageBase64 is not valid base64' });
    }
  }

  const db = getFirebaseAdmin();
  const anthropic = getAnthropicClient();
  const userId = user.uid; // Q7 default: ignore body.userId if present
  const droppedAt = new Date().toISOString();

  try {
    // 4. Content hash
    const contentHash = computeContentHash({
      type,
      text: normalizedText,
      url: normalizedUrl,
      imageBuffer,
    });

    // 5. Cache lookup (signalDropCache/{contentHash}, 6h TTL)
    const cacheRef = db.collection('signalDropCache').doc(contentHash);
    const cacheSnap = await cacheRef.get();
    const now = Date.now();
    if (cacheSnap.exists) {
      const cached = cacheSnap.data();
      const expiresMs = cached.expiresAt?.toMillis?.() ?? 0;
      if (expiresMs > now) {
        // Cache hit — write the per-user drop record + log, then return.
        const dropRecord = {
          dropId,
          userId,
          input: dropInputForRecord({ type, normalizedText, normalizedUrl, note, hasImage: !!imageBuffer }),
          contentHash,
          parse: cached.parse,
          validation: cached.validation,
          shouldBailout: cached.shouldBailout,
          shouldHardCheckpoint: cached.shouldHardCheckpoint,
          expansion: null,
          outcome: { forkChosen: null },
          droppedAt,
          cacheHit: true,
        };
        await db.collection('users').doc(userId).collection('signalDrops').doc(dropId).set(dropRecord);
        waitUntil(logSignalDrops({
          ...dropRecord,
          loggedAt: droppedAt,
        }).catch(() => {}));
        return res.status(200).json({
          dropId,
          contentHash,
          parse: cached.parse,
          validation: cached.validation,
          shouldBailout: cached.shouldBailout,
          shouldHardCheckpoint: cached.shouldHardCheckpoint,
          cached: true,
        });
      }
    }

    // 6. URL fetch (best-effort, only for type=url). readabilityOutcome
    // stays null on non-URL paths; on URL paths it is one of:
    // 'extracted' | 'fallback_null' | 'fallback_failed' | 'fallback_empty' |
    // 'not_applicable' (when fetch fails before Readability runs).
    let urlBody = null;
    let urlFetchSucceeded = null;
    let readabilityOutcome = null;
    if (type === 'url') {
      const fetchResult = await fetchUrlBody(normalizedUrl);
      urlFetchSucceeded = fetchResult.ok;
      urlBody = fetchResult.body || null;
      readabilityOutcome = fetchResult.readabilityOutcome;
    }

    // 7. Build parse prompt inputs
    const promptInputs = buildParsePromptInputs({
      type,
      text: normalizedText,
      url: normalizedUrl,
      urlBody,
      urlFetchSucceeded,
      imageBase64,
      imageMime: imageMime || 'image/png',
      note,
    });

    // 8. Haiku Forced Tool Use call
    const haikuResponse = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1500,
      system: promptInputs.system,
      messages: [{ role: 'user', content: promptInputs.user }],
      tools: promptInputs.tools,
      tool_choice: promptInputs.toolChoice,
    });

    const toolUse = haikuResponse.content.find((c) => c.type === 'tool_use');
    if (!toolUse) {
      throw new Error('Haiku did not use submit_parsed_signal tool');
    }
    const parsed = toolUse.input;

    // Defensive sanitizer: strip vendor-side decoder regression artifacts and
    // coerce missing required fields. Fire-and-forget logs every modification.
    sanitizeParsedOutput(parsed, { dropId, userId, contentHash });

    // 9. Validate tickers (canonical-symbol normalization, against the
    // universe defined in rankingConfig.js). Validation runs against the
    // union of explicit + implied tickers — the bailout check uses raw
    // counts. As of Phase 4.5a the universe includes Tier 1 sector ETFs
    // and Tier 2 industry ETFs; previously stocks-only.
    const allTickers = [
      ...(Array.isArray(parsed.tickers) ? parsed.tickers : []),
      ...(Array.isArray(parsed.impliedTickers) ? parsed.impliedTickers : []),
    ];
    const validation = validateTickers(allTickers);
    const impliedCount = Array.isArray(parsed.impliedTickers) ? parsed.impliedTickers.length : 0;

    // 9.5 Off-universe observability (Phase 4.5a). Fires when Haiku returned
    // tickers that fell outside the universe. Mirrors the existing
    // off_universe_ticker_seen pattern from injectionGuard.js but tags the
    // parse stage so GCS-NDJSON aggregation can pivot per stage.
    if (validation.unsupported.length > 0) {
      waitUntil(logSignalDrops({
        event: 'off_universe_ticker_seen',
        stage: 'parse',
        tickers: validation.unsupported,
        contentType: parsed.contentType || 'unknown',
        signalDirection: parsed.signalDirection || 'uncertain',
        topic: parsed.topic || '',
        dropId,
        userId,
        contentHash,
        capturedAt: new Date().toISOString(),
      }).catch(() => {}));
    }

    // 10. Injection-attempt flag (set on the parsed object so downstream
    // shadow logs and the expand endpoint can see it)
    parsed.suspectedInjection = detectInjectionAttempts(parsed.extractedText || '');

    // 11. Bailout / hard-checkpoint classification
    const { shouldBailout, shouldHardCheckpoint } = classifyBailout(
      parsed,
      validation.validated.length,
      impliedCount,
    );

    // 12. Persist cache entry (6h TTL via expiresAt)
    const expiresAt = Timestamp.fromMillis(now + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await cacheRef.set({
      contentHash,
      parse: parsed,
      validation,
      shouldBailout,
      shouldHardCheckpoint,
      createdAt: Timestamp.fromMillis(now),
      expiresAt,
    });

    // 13. Persist per-user drop record
    const dropRecord = {
      dropId,
      userId,
      input: dropInputForRecord({ type, normalizedText, normalizedUrl, note, hasImage: !!imageBuffer }),
      contentHash,
      parse: parsed,
      validation,
      shouldBailout,
      shouldHardCheckpoint,
      expansion: null,
      outcome: { forkChosen: null },
      droppedAt,
      cacheHit: false,
    };
    await db.collection('users').doc(userId).collection('signalDrops').doc(dropId).set(dropRecord);

    // 14. Shadow log (fire-and-forget — must NOT block the response)
    waitUntil(logSignalDrops({
      dropId,
      userId,
      contentHash,
      input: dropRecord.input,
      parse: parsed,
      validation,
      shouldBailout,
      shouldHardCheckpoint,
      urlFetchSucceeded,
      readabilityOutcome,
      tokenUsage: haikuResponse.usage || null,
      droppedAt,
      cacheHit: false,
      stage: 'parse',
    }).catch(() => {}));

    // 15. Respond
    return res.status(200).json({
      dropId,
      contentHash,
      parse: parsed,
      validation,
      shouldBailout,
      shouldHardCheckpoint,
      cached: false,
    });
  } catch (err) {
    console.error('[parse-signal] error:', err);
    return res.status(500).json({
      error: 'Failed to parse signal',
      message: err?.message || 'unknown error',
    });
  }
}

// The drop record stores a sanitized echo of the input. For images we
// store the contentHash only — the raw bytes never leave the cache + the
// upstream Anthropic call. Phase 2 will swap to a Storage URL when the
// upload UI lands.
function dropInputForRecord({ type, normalizedText, normalizedUrl, note, hasImage }) {
  const base = { type, note: note || null };
  if (type === 'text') return { ...base, text: normalizedText };
  if (type === 'url') return { ...base, url: normalizedUrl };
  return { ...base, imagePresent: hasImage };
}
