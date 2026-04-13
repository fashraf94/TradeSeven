// api/season/pit-stop-reply.js
//
// Processes a pit stop conversation reply via Gemma on OpenRouter.
//
// Client flow:
//   1. Client writes `pendingUserMessage` to the pitStop doc.
//   2. Client POSTs { entryId, week } to this endpoint.
//   3. Endpoint re-reads the pending message server-side, verifies
//      ownership + cap, builds the Gemma prompt via
//      buildPitStopReplyContext, calls OpenRouter, appends both the
//      user message and the parsed assistant reply to pitStop.conversation,
//      clears pendingUserMessage, and returns { reply, scratchpad,
//      suggestedAction }.
//
// The server owns conversation mutation — the client never writes to
// `conversation[]` directly. This keeps Gemma's conversation history
// and the server-side validation in agreement.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import {
  buildPitStopReplyContext,
  parsePitStopReply,
} from '../_utils/seasonPrompts/pitStopReply.js';
import { SEASON_CONFIG, PIT_STOP_STATUS } from '../_utils/seasonConfig.js';
import { logReviewInteraction } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 15 };

async function callOpenRouter(promptContext) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const messages = [
      { role: 'system', content: promptContext.systemPrompt },
      ...(promptContext.conversationHistory || []),
      { role: 'user', content: promptContext.userMessage },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fantasytrades.io',
        'X-Title': 'FantasyTrades Voice Layer',
      },
      body: JSON.stringify({
        model: promptContext.model,
        messages,
        temperature: promptContext.temperature,
        max_tokens: promptContext.maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      throw new Error(`OpenRouter ${response.status}: ${errText.slice(0, 200)}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  // ─── 1. CORS + rate limit ────────────────────────────────────
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // ─── 2. Method ───────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── 3. Firebase auth ────────────────────────────────────────
  const user = await requireAuth(req, res);
  if (!user) return;

  // ─── 4. Validate request body ────────────────────────────────
  const { entryId, week } = req.body || {};
  if (!entryId || week == null) {
    return res.status(400).json({ error: 'Missing entryId or week' });
  }

  const db = getFirebaseAdmin();

  try {
    // ─── 5. Load entry + verify ownership ──────────────────────
    const entryRef = db.collection('seasonEntries').doc(entryId);
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const entry = entrySnap.data();
    if (entry.userId !== user.uid) {
      return res.status(403).json({ error: 'Not your entry' });
    }

    // ─── 6. Load pit stop + verify open ────────────────────────
    const pitStopRef = entryRef.collection('pitStops').doc(String(week));
    const pitStopSnap = await pitStopRef.get();
    if (!pitStopSnap.exists) {
      return res.status(404).json({ error: 'Pit stop not found' });
    }
    const pitStop = pitStopSnap.data();
    if (pitStop.status !== PIT_STOP_STATUS.OPEN) {
      return res.status(400).json({ error: 'Pit stop is not open' });
    }

    // ─── 7. Read + validate pending message ────────────────────
    const pendingRaw = pitStop.pendingUserMessage;
    if (!pendingRaw || typeof pendingRaw !== 'string' || pendingRaw.trim().length === 0) {
      return res.status(400).json({ error: 'No pending message' });
    }
    const truncatedMessage = pendingRaw.trim().slice(0, SEASON_CONFIG.MAX_USER_MESSAGE_LENGTH);

    // ─── 8. Conversation cap check ─────────────────────────────
    const currentCount = pitStop.conversationCount || 0;
    if (currentCount >= SEASON_CONFIG.MAX_CONVERSATION_EXCHANGES) {
      return res.status(400).json({ error: 'Conversation limit reached' });
    }

    // ─── 9. Load agent + season (defensive fallbacks) ──────────
    let agent = { name: 'Agent', archetype: 'balanced' };
    if (entry.agentId) {
      const agentSnap = await db.collection('agents').doc(entry.agentId).get();
      if (agentSnap.exists) agent = agentSnap.data();
    }

    let season = {};
    if (entry.seasonId) {
      const seasonSnap = await db.collection('seasons').doc(entry.seasonId).get();
      if (seasonSnap.exists) season = seasonSnap.data();
    }

    // ─── 10. Build prompt + call Gemma ─────────────────────────
    const promptContext = buildPitStopReplyContext(
      agent,
      entry,
      pitStop,
      truncatedMessage,
      season
    );

    const openRouterResponse = await callOpenRouter(promptContext);

    // parsePitStopReply accepts the raw OpenRouter response object
    // directly and runs the 4-level fallback parser.
    const parsed = parsePitStopReply(openRouterResponse);

    // ─── 11. Write conversation update ─────────────────────────
    // IMPORTANT: store assistant turns with `role: 'assistant'` so
    // buildConversationHistory in pitStopReply.js picks them up on
    // the next call. The filter at pitStopReply.js:276 drops any
    // role that is not 'user' or 'assistant'.
    const nowIso = new Date().toISOString();
    const userEntry = {
      role: 'user',
      content: truncatedMessage,
      timestamp: nowIso,
    };
    const assistantEntry = {
      role: 'assistant',
      content: parsed.reply,
      scratchpad: parsed.scratchpad || null,
      suggestedAction: parsed.suggestedAction || null,
      timestamp: nowIso,
    };

    await pitStopRef.update({
      pendingUserMessage: null,
      conversation: [...(pitStop.conversation || []), userEntry, assistantEntry],
      conversationCount: currentCount + 1,
      updatedAt: nowIso,
    });

    // ─── 12. Shadow log (fire-and-forget) ─────────────────────
    // Captures the full Gemma turn (user + assistant) for training.
    // Silent failure — a GCS outage must not impact chat reply.
    logReviewInteraction({
      type: 'conversation',
      userId: user.uid,
      entryId,
      seasonId: entry.seasonId || null,
      agentId: entry.agentId || null,
      week,
      turnNumber: currentCount + 1,
      maxTurns: SEASON_CONFIG.MAX_CONVERSATION_EXCHANGES,
      userMessage: truncatedMessage,
      assistantReply: parsed.reply || null,
      scratchpad: parsed.scratchpad || null,
      suggestedAction: parsed.suggestedAction || null,
      hypothesis: pitStop.hypothesis || null, // May be set client-side at lock-in
      model: promptContext?.model || null,
      timestamp: nowIso,
      schemaVersion: 1,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      reply: parsed.reply,
      scratchpad: parsed.scratchpad || null,
      suggestedAction: parsed.suggestedAction || null,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[SEASON] Pit stop reply timed out');
      return res.status(504).json({ error: 'Agent response timed out. Try again.' });
    }
    console.error('[SEASON] Pit stop reply failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
