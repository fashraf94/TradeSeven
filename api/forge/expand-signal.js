// api/forge/expand-signal.js
//
// Phase 1 endpoint #2 of Signal Drop. Takes a parsed signal (output of
// /api/forge/parse-signal), runs it through Gemma in `signal_expansion`
// mode, and returns a structured expansion: thesisSummary, apparentDriver,
// relatedTickers (with roles), invalidationConditions, suggestedWatchlist
// Name, confidence.
//
// Pattern reference: api/forge/workshop-chat.js (DRB anchor injection,
// Gemma call shape, fire-and-forget shadow log, structured-error path).
//
// Flow:
//   1. applySecurityMiddleware → requireAuth (Firebase ID token)
//   2. Body validation { parsedSignal, dropId, agentId, isRecompute? }
//   3. Read agents/{agentId} — verify ownerId === user.uid
//   4. Read users/{user.uid}/signalDrops/{dropId} — get contentHash + check ownership
//   5. Cache lookup at signalDropCache/expand:{contentHash}:{day} (skip on isRecompute)
//   6. Fetch DRB + market-context docs (workshop-chat pattern)
//   7. buildExpansionInputs(parsedSignal, marketContextString)
//   8. systemPrompt = buildVoiceLayerPrompt({ mode: 'signal_expansion', ... })
//   9. callGemmaVoiceWithRetry with 25s AbortController, userMessage='Expand this signal.'
//  10. parseVoiceLayerResponse → schema-check (Tier 4 fallback → 502)
//  11. validateExpansionOutput → hard-reject 502 OR attach validationWarning
//  12. Persist: signalDropCache row + signalDrops doc update + shadow log
//  13. Return { expansion, validationWarning, expandedAt, cached, tokenUsage:null }

import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { buildExpansionInputs } from '../_utils/signalDropPrompt.js';
import { validateExpansionOutput } from '../_utils/injectionGuard.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 30 };

const CACHE_TTL_HOURS = 6;
const GEMMA_TIMEOUT_MS = 25_000;

const VALID_ROLES = new Set([
  'anchor',
  'comparable',
  'beneficiary',
  'derivative',
  'hedge',
  'exposed',
]);
const VALID_CONFIDENCES = new Set(['low', 'medium', 'high']);

function isNonEmptyString(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

// Tier-4 detection: parseVoiceLayerResponse falls back to a Voice-Layer-
// shaped object {_scratchpad, response, hasDirective, ...} when JSON
// parsing fails three different ways. Expansion outputs have a different
// shape, so we explicitly verify the shape before trusting it.
function isExpansionShape(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.thesisSummary !== 'string' || !obj.thesisSummary.trim()) return false;
  if (!Array.isArray(obj.relatedTickers)) return false;
  return true;
}

// Light shape normalization on the parsed expansion. Coerces relatedTickers
// to an array of { symbol, role } where role is in VALID_ROLES (default
// 'comparable'); ensures invalidationConditions is an array of strings;
// clamps confidence to low/medium/high. Does NOT enforce the spec's
// 3-7 minimum — that's a quality concern surfaced via validateExpansionOutput
// + Step 7 review, not a blocking schema failure.
function normalizeExpansion(raw) {
  const expansion = {
    thesisSummary: String(raw.thesisSummary || '').trim(),
    apparentDriver: String(raw.apparentDriver || '').trim(),
    relatedTickers: [],
    invalidationConditions: [],
    suggestedWatchlistName: String(raw.suggestedWatchlistName || '').trim(),
    confidence: VALID_CONFIDENCES.has(raw.confidence) ? raw.confidence : 'low',
  };

  if (Array.isArray(raw.relatedTickers)) {
    expansion.relatedTickers = raw.relatedTickers
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const symbol = typeof item.symbol === 'string' ? item.symbol.trim().toUpperCase() : '';
        if (!symbol) return null;
        const role = VALID_ROLES.has(item.role) ? item.role : 'comparable';
        return { symbol, role };
      })
      .filter(Boolean);
  }

  if (Array.isArray(raw.invalidationConditions)) {
    expansion.invalidationConditions = raw.invalidationConditions
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => s.trim().slice(0, 200))
      .slice(0, 6);
  }

  return expansion;
}

// Today's market-context day, used as part of the expansion cache key
// so the cache rolls over daily as the DRB / regime changes. UTC date
// is fine — the DRB cron writes once per day on a fixed schedule.
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Builds the signalMarketContext string passed into buildExpansionInputs.
// Mirrors workshop-chat's joined regime-line + DRB-narrative pattern.
async function fetchMarketContextString(db) {
  try {
    const today = todayKey();
    const [marketCtxDoc, drbDoc] = await Promise.all([
      db.collection('indexIntelligence').doc('marketContext').get(),
      db.collection('indexIntelligence').doc('dailyRegimeBrief').get(),
    ]);
    let regimeLine = '';
    if (marketCtxDoc.exists) {
      const ctx = marketCtxDoc.data();
      regimeLine = `Regime: ${ctx.regime || 'unknown'}.${ctx.regimeDetail ? ' ' + ctx.regimeDetail : ''}`.trim();
    }
    let briefLine = '';
    if (drbDoc.exists) {
      const drb = drbDoc.data();
      if (drb.forDate === today && typeof drb.dailyBrief === 'string') {
        briefLine = drb.dailyBrief;
      }
    }
    return [regimeLine, briefLine].filter(Boolean).join(' ');
  } catch (err) {
    console.error('[expand-signal] failed to fetch market context:', err.message);
    return '';
  }
}

// Anchor context: prefer DRB.dailyBrief when fresh, else null. Same
// contract battle/workshop modes use — null leaves the prompt builder
// to inject a fallback string for the anchor block.
async function fetchAnchorContext(db) {
  try {
    const today = todayKey();
    const drbDoc = await db.collection('indexIntelligence').doc('dailyRegimeBrief').get();
    if (!drbDoc.exists) return null;
    const drb = drbDoc.data();
    if (drb.forDate === today && typeof drb.dailyBrief === 'string') {
      return drb.dailyBrief;
    }
    return null;
  } catch {
    return null;
  }
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
  const { parsedSignal, dropId, agentId, isRecompute } = req.body || {};

  if (!parsedSignal || typeof parsedSignal !== 'object') {
    return res.status(400).json({ error: 'parsedSignal is required (object)' });
  }
  if (!isNonEmptyString(dropId, 200)) {
    return res.status(400).json({ error: 'dropId is required' });
  }
  if (!isNonEmptyString(agentId, 200)) {
    return res.status(400).json({ error: 'agentId is required' });
  }
  if (!isNonEmptyString(parsedSignal.extractedText, 6000)) {
    return res.status(400).json({ error: 'parsedSignal.extractedText is required' });
  }

  const db = getFirebaseAdmin();
  const userId = user.uid;
  const recompute = !!isRecompute;
  const expandedAt = new Date().toISOString();

  try {
    // 4. Verify agent ownership
    const agentRef = db.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = { id: agentSnap.id, ...agentSnap.data() };
    if (agent.ownerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to expand on this agent' });
    }

    // 5. Read drop record (for contentHash + ownership)
    const dropRef = db.collection('users').doc(userId).collection('signalDrops').doc(dropId);
    const dropSnap = await dropRef.get();
    if (!dropSnap.exists) {
      return res.status(404).json({ error: 'Drop record not found — call parse-signal first' });
    }
    const dropRecord = dropSnap.data();
    const contentHash = dropRecord.contentHash;
    if (!contentHash) {
      return res.status(500).json({ error: 'Drop record missing contentHash' });
    }

    // 6. Cache lookup (skip on recompute)
    const cacheKey = `expand:${contentHash}:${todayKey()}`;
    const cacheRef = db.collection('signalDropCache').doc(cacheKey);
    const now = Date.now();

    if (!recompute) {
      const cacheSnap = await cacheRef.get();
      if (cacheSnap.exists) {
        const cached = cacheSnap.data();
        const expiresMs = cached.expiresAt?.toMillis?.() ?? 0;
        if (expiresMs > now && cached.expansion) {
          // Cache hit — still update the per-user drop record with this
          // expansion (so the user's drop reflects the latest cached
          // expansion if they call expand multiple times) + log.
          await dropRef.update({
            expansion: cached.expansion,
            expansionExpandedAt: expandedAt,
          });
          logSignalDrops({
            stage: 'expand',
            dropId,
            userId,
            agentId,
            contentHash,
            expansion: cached.expansion,
            validationWarning: cached.validationWarning || null,
            expandedAt,
            cacheHit: true,
            tokenUsage: null,
            isRecompute: false,
          }).catch(() => {});
          return res.status(200).json({
            expansion: cached.expansion,
            validationWarning: cached.validationWarning || null,
            expandedAt,
            cached: true,
            tokenUsage: null,
          });
        }
      }
    }

    // 7. Fetch DRB + market context
    const [marketContextString, anchorContext] = await Promise.all([
      fetchMarketContextString(db),
      fetchAnchorContext(db),
    ]);

    // 8. Build expansion inputs (delimits extractedText)
    const { parsedSignalBlock, signalMarketContextBlock } = buildExpansionInputs(
      parsedSignal,
      marketContextString,
    );

    // 9. Assemble system prompt for the signal_expansion branch
    const systemPrompt = buildVoiceLayerPrompt({
      agent,
      mode: 'signal_expansion',
      anchorContext,
      parsedSignal: parsedSignalBlock,
      signalMarketContext: signalMarketContextBlock,
    });

    // 10. Call Gemma with 25s abort
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMMA_TIMEOUT_MS);
    let gemmaResult;
    try {
      gemmaResult = await callGemmaVoiceWithRetry({
        systemPrompt,
        conversationHistory: [],
        userMessage: 'Expand this signal.',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!gemmaResult.success) {
      console.error('[expand-signal] Gemma call failed:', gemmaResult.error);
      const statusCode = gemmaResult.aborted ? 504 : 502;
      return res.status(statusCode).json({
        error: gemmaResult.aborted ? 'Expansion timed out' : 'Expansion failed',
        message: gemmaResult.error || 'Gemma call failed',
      });
    }

    // 11. Parse + schema-check
    const rawParsed = parseVoiceLayerResponse(gemmaResult.content);
    if (!isExpansionShape(rawParsed)) {
      console.error('[expand-signal] Tier-4 fallback or wrong shape:', JSON.stringify(rawParsed).slice(0, 300));
      return res.status(502).json({
        error: 'Expansion output failed schema check',
        message: 'Gemma response did not contain expansion fields (thesisSummary + relatedTickers).',
      });
    }
    const expansion = normalizeExpansion(rawParsed);

    // 12. Validate (warn-not-reject contract from Step 1.5 revision)
    const validation = validateExpansionOutput(expansion, parsedSignal);
    if (validation.hardRejection) {
      console.warn('[expand-signal] hard-rejection:', validation.reason);
      return res.status(502).json({
        error: 'Expansion failed congruity check',
        reason: validation.reason,
      });
    }
    expansion.validationWarning = validation.warning || null;

    // 13. Cache write
    const expiresAt = Timestamp.fromMillis(now + CACHE_TTL_HOURS * 60 * 60 * 1000);
    await cacheRef.set({
      cacheKey,
      contentHash,
      marketContextDay: todayKey(),
      expansion,
      validationWarning: validation.warning || null,
      createdAt: Timestamp.fromMillis(now),
      expiresAt,
    });

    // 14. Update drop record
    await dropRef.update({
      expansion,
      expansionExpandedAt: expandedAt,
    });

    // 15. Shadow log (fire-and-forget)
    logSignalDrops({
      stage: 'expand',
      dropId,
      userId,
      agentId,
      contentHash,
      expansion,
      validationWarning: validation.warning || null,
      expandedAt,
      cacheHit: false,
      tokenUsage: null,
      isRecompute: recompute,
    }).catch(() => {});

    // 16. Respond
    return res.status(200).json({
      expansion,
      validationWarning: validation.warning || null,
      expandedAt,
      cached: false,
      tokenUsage: null,
    });
  } catch (err) {
    console.error('[expand-signal] error:', err);
    return res.status(500).json({
      error: 'Failed to expand signal',
      message: err?.message || 'unknown error',
    });
  }
}
