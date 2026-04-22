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
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logConversation } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 30 };

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

    // 10b. Fetch today's market context for the workshop anchor block.
    // Mirrors the pattern in api/agent/chat.js — regime line from
    // marketContext, DRB narrative appended only when fresh (forDate ===
    // today). Any failure leaves anchorContext = null; the prompt builder
    // then omits the block entirely.
    let anchorContext = null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [marketCtxDoc, drbDoc] = await Promise.all([
        db.collection('indexIntelligence').doc('marketContext').get(),
        db.collection('indexIntelligence').doc('dailyRegimeBrief').get(),
      ]);
      if (marketCtxDoc.exists) {
        const ctx = marketCtxDoc.data();
        const regimeLine = `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim();
        const drb = drbDoc.exists ? drbDoc.data() : null;
        const briefLine = drb && drb.forDate === today && typeof drb.dailyBrief === 'string'
          ? drb.dailyBrief
          : null;
        const joined = [regimeLine, briefLine].filter(Boolean).join(' ');
        anchorContext = joined || null;
      }
    } catch (err) {
      console.error('[WorkshopChat] Failed to fetch market context:', err.message);
    }

    // 11. Assemble system prompt
    const systemPrompt = buildVoiceLayerPrompt({
      agent,
      mode: 'workshop',
      conversationHistory,
      workshopContext,
      anchorContext,
    });

    // 12. Call Gemma with 25s timeout (Vercel's platform timeout is higher;
    // giving the model room on complex workshop turns prevents the platform
    // from killing us and returning plaintext HTML to the frontend).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    let gemmaResult;
    try {
      gemmaResult = await callGemmaVoiceWithRetry({
        systemPrompt,
        conversationHistory,
        userMessage: sanitizedMessage,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 12b. Structured error path — NEVER leak raw strings to the frontend.
    // Return a 200 with a graceful agent message + the previous thesis so
    // the sidebar survives and the failed turn doesn't burn budget.
    if (!gemmaResult.success) {
      console.error('[WorkshopChat] Gemma call failed:', gemmaResult.error);
      const previousThesis = session.latestThesis || null;
      const sessionIdForClient = isNewSession ? null : sessionRef.id;
      const statusCode = gemmaResult.aborted ? 504 : 200;
      return res.status(statusCode).json({
        sessionId: sessionIdForClient,
        agentMessage:
          "I hit a snag processing that — could you try that again?",
        activeThesis: previousThesis,
        scratchpad: null,
        suggestedActions: null,
        messagesUsed: session.messagesUsed || 0, // unchanged — this turn didn't count
        messageBudget,
        readyToCompile: Boolean(previousThesis?.readyToCompile),
        error: true,
      });
    }

    // 13. Parse
    const parsed = parseVoiceLayerResponse(gemmaResult.content);
    const cleanScratchpad = sanitizeScratchpad(parsed._scratchpad);

    // Defensive extraction: even though the few-shot example now puts
    // activeThesis at the top level, Gemma occasionally nests it under
    // _scratchpad. Also wrap a bare-string `instruments` into an array
    // so normalizeThesis's asArray() doesn't drop the data.
    const rawThesis =
      parsed.activeThesis ||
      (parsed._scratchpad && typeof parsed._scratchpad === 'object'
        ? parsed._scratchpad.activeThesis
        : null) ||
      null;
    if (rawThesis && typeof rawThesis.instruments === 'string') {
      rawThesis.instruments = [rawThesis.instruments];
    }
    const activeThesis = normalizeThesis(rawThesis);

    const suggestedActions = Array.isArray(parsed.suggestedActions)
      ? parsed.suggestedActions
          .filter((x) => typeof x === 'string' && x.trim())
          .map((x) => x.slice(0, 120).trim())
          .slice(0, 4)
      : null;
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
      suggestedActions,
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
      suggestedActions,
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
      suggestedActions,
      messagesUsed: messagesUsed + 1,
      messageBudget,
      readyToCompile: activeThesis.readyToCompile,
    });
  } catch (error) {
    // Catch-all for anything that escaped the structured gemmaResult path
    // (e.g., Firestore write failures). Always return valid JSON in the
    // same shape the frontend expects for a graceful error turn so the
    // thesis sidebar and chat UI stay consistent.
    console.error('[WorkshopChat] Error:', error);
    const isAbort = error?.name === 'AbortError';
    return res.status(isAbort ? 504 : 500).json({
      agentMessage: isAbort
        ? 'That took too long — could you try sending that again?'
        : 'Something went wrong on my end. Try again in a moment.',
      error: true,
      activeThesis: null,
      sessionId: null,
      scratchpad: null,
      suggestedActions: null,
      messagesUsed: 0,
      messageBudget: MESSAGE_BUDGET,
      readyToCompile: false,
    });
  }
}
