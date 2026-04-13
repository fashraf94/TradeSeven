// api/forge/workshop-chat.js
//
// Workshop Mode chat endpoint — the conversational strategy-development
// sibling of api/agent/chat.js. Uses the same Gemma (OpenRouter) model and
// the same voiceLayerPrompt assembly, but with `mode: 'workshop'`:
//   * No battleId — conversations live in their own `workshopSessions`
//     collection keyed by sessionId.
//   * No elicitation target / market snapshot / anchor context.
//   * Parsed response MUST include an `activeThesis` object which the
//     server persists on the session doc so the next turn can feed it
//     back in as `previousThesis`.
//
// Session lifecycle:
//   * First call with sessionId === null creates a new workshopSessions doc
//     with messagesUsed=0, messageBudget=25, status='active'.
//   * Each subsequent call loads the existing doc, appends the exchange,
//     and updates latestThesis.
//   * When compile-dimensions.js consumes a thesis, it flips
//     status='compiled' — client must start a new session to talk again.
//
// Budget: 25 messages per session. Rate limit: 10 req/60s per userId
// (matches battle chat). When either is exceeded, the client gets a 403.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logConversation } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 15 };

const MESSAGE_BUDGET = 25;
const HISTORY_WINDOW = 10; // max turns fed back into the model

// ==================== THESIS HELPERS ====================

const EMPTY_THESIS = Object.freeze({
  summary: '',
  catalyst: '',
  instruments: [],
  entryLogic: '',
  exitLogic: '',
  riskPosture: '',
  invalidation: '',
  confidence: 'low',
  readyToCompile: false,
});

function normalizeThesis(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_THESIS };

  const asString = (v) => (typeof v === 'string' ? v.slice(0, 600).trim() : '');
  const asArray = (v) => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => x.slice(0, 120).trim())
      .slice(0, 10);
  };
  const confidence = ['low', 'medium', 'high'].includes(raw.confidence)
    ? raw.confidence
    : 'low';

  // readyToCompile is gated server-side — it may only be true when the three
  // load-bearing fields are non-empty. Avoids the model flipping it true
  // prematurely from the opening turn.
  const entryLogic = asString(raw.entryLogic);
  const exitLogic = asString(raw.exitLogic);
  const riskPosture = asString(raw.riskPosture);
  const summary = asString(raw.summary);
  const serverReady =
    Boolean(raw.readyToCompile) &&
    Boolean(entryLogic) &&
    Boolean(exitLogic) &&
    Boolean(riskPosture) &&
    Boolean(summary);

  return {
    summary,
    catalyst: asString(raw.catalyst),
    instruments: asArray(raw.instruments),
    entryLogic,
    exitLogic,
    riskPosture,
    invalidation: asString(raw.invalidation),
    confidence,
    readyToCompile: serverReady,
  };
}

function sanitizeScratchpad(raw) {
  if (typeof raw !== 'string') return null;
  return raw.replace(/\s{2,}/g, ' ').trim() || null;
}

// ==================== HANDLER ====================

export default async function handler(req, res) {
  // 1. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // 2. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Auth
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. Validate body
  const { agentId, sessionId: providedSessionId, message } = req.body || {};

  if (!agentId || !message) {
    return res.status(400).json({ error: 'agentId and message are required' });
  }

  // 5. Sanitize message
  const sanitizedMessage = String(message)
    .slice(0, 2000)
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[<>{}]/g, '')
    .trim();

  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const db = getFirebaseAdmin();

  try {
    // 6. Read agent doc
    const agentRef = db.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = agentSnap.data();

    if (agent.ownerId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized to chat with this agent' });
    }

    // 7. Load or create session
    const sessionsCol = db.collection('workshopSessions');
    let sessionRef;
    let session;
    let isNewSession = false;

    if (providedSessionId) {
      sessionRef = sessionsCol.doc(providedSessionId);
      const snap = await sessionRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Workshop session not found' });
      }
      session = snap.data();
      if (session.userId !== user.uid) {
        return res.status(403).json({ error: 'Not authorized for this session' });
      }
      if (session.status !== 'active') {
        return res.status(400).json({
          error: 'session_not_active',
          message:
            'This workshop session has already been compiled or closed. Start a new one to keep talking.',
        });
      }
    } else {
      sessionRef = sessionsCol.doc();
      session = {
        userId: user.uid,
        agentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messagesUsed: 0,
        messageBudget: MESSAGE_BUDGET,
        exchanges: [],
        latestThesis: null,
        status: 'active',
        compiledThesisId: null,
      };
      isNewSession = true;
    }

    // 8. Budget check
    if ((session.messagesUsed || 0) >= (session.messageBudget || MESSAGE_BUDGET)) {
      return res.status(403).json({
        error: 'workshop_budget_exceeded',
        message:
          "We've got a lot of material here. Let's compile what we have instead of adding more.",
      });
    }

    // 9. Build conversation history (last HISTORY_WINDOW exchanges)
    const previousExchanges = (session.exchanges || []).slice(-HISTORY_WINDOW);
    const conversationHistory = previousExchanges.flatMap((ex) => [
      { role: 'user', content: ex.userMessage || '' },
      { role: 'assistant', content: ex.agentResponse || '' },
    ]);

    // 10. Build workshop context
    const messagesUsed = session.messagesUsed || 0;
    const messageBudget = session.messageBudget || MESSAGE_BUDGET;
    const workshopContext = {
      previousThesis: session.latestThesis || null,
      sessionTurnCount: previousExchanges.length,
      messagesRemaining: Math.max(0, messageBudget - messagesUsed - 1),
      messageBudget,
    };

    // 11. Assemble system prompt
    const systemPrompt = buildVoiceLayerPrompt({
      agent,
      mode: 'workshop',
      conversationHistory,
      workshopContext,
    });

    // 12. Call Gemma with 15s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let rawResponse;
    try {
      rawResponse = await callGemmaVoice({
        systemPrompt,
        conversationHistory,
        userMessage: sanitizedMessage,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 13. Parse
    const parsed = parseVoiceLayerResponse(rawResponse);
    const cleanScratchpad = sanitizeScratchpad(parsed._scratchpad);
    const activeThesis = normalizeThesis(parsed.activeThesis);
    const agentMessage =
      typeof parsed.response === 'string' && parsed.response.trim()
        ? parsed.response.trim()
        : "Let me think again — can you rephrase that for me?";

    // 14. Persist exchange + thesis
    const exchange = {
      userMessage: sanitizedMessage,
      agentResponse: agentMessage,
      scratchpad: cleanScratchpad,
      activeThesis,
      timestamp: new Date().toISOString(),
    };

    const nowIso = new Date().toISOString();

    if (isNewSession) {
      await sessionRef.set({
        ...session,
        exchanges: [exchange],
        latestThesis: activeThesis,
        messagesUsed: 1,
        updatedAt: nowIso,
      });
    } else {
      await sessionRef.update({
        exchanges: FieldValue.arrayUnion(exchange),
        latestThesis: activeThesis,
        messagesUsed: FieldValue.increment(1),
        updatedAt: nowIso,
      });
    }

    // 15. Shadow log (fire-and-forget)
    logConversation({
      userId: user.uid,
      agentId,
      battleId: null,
      archetype: agent.archetype || null,
      gameMode: 'workshop',
      exchangeNumber: messagesUsed + 1,
      userMessage: sanitizedMessage,
      agentMessage,
      scratchpad: cleanScratchpad,
      directive: null,
      suggestedActions: null,
      elicitationTarget: null,
      anchorContext: null,
      hasDirective: false,
      tokenUsage: null,
      workshopSessionId: sessionRef.id,
      activeThesis,
    }).catch(() => {});

    // 16. Respond
    return res.status(200).json({
      sessionId: sessionRef.id,
      agentMessage,
      activeThesis,
      scratchpad: cleanScratchpad,
      messagesUsed: messagesUsed + 1,
      messageBudget,
      readyToCompile: activeThesis.readyToCompile,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[WorkshopChat] Request timed out');
      return res.status(504).json({ error: 'Agent response timed out. Try again.' });
    }
    console.error('[WorkshopChat] Error:', error);
    return res.status(500).json({ error: 'Agent unavailable. Try again in a moment.' });
  }
}
