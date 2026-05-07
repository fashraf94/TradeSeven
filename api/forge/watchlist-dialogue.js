// api/forge/watchlist-dialogue.js
//
// Sprint 6 Phase 2 — Signal Drop V2 watchlist dialogue endpoint. The
// multi-turn conversational counterpart to expand-signal: the user has
// already called parse-signal once (caching the result via contentHash),
// then drops here to walk through a phased dialogue — explore → propose
// → refine → finalize — with a Gemma-powered watchlist agent. The output
// of the dialogue is a curated candidateTickers list which the (yet to
// ship) Phase 4 save endpoint will turn into a dropLists doc.
//
// Pattern reference: api/forge/workshop-chat.js (session lifecycle,
// budget enforcement, structured-error path, shadow logger). The dialogue
// mirrors that pattern with three deltas:
//   * Server-tracked phase (forward-only validation; user can hint via
//     phaseRequest='advance').
//   * Server-tracked candidateTickers (read-modify-write each turn,
//     applying the agent's candidateTickerUpdates atomically).
//   * No latestThesis — replaced by candidateTickers + phase + readyToFinalize.
//
// Per-message exchange shape (vs workshop-chat's per-turn exchanges):
// each exchange is a single { role: 'user'|'agent', content, phase,
// timestamp, suggestedActions? } record. A single user turn appends two
// exchange records (the user's message at the OLD phase, then the agent's
// response at the NEW phase if advancement occurred).
//
// Budget: 20 messages per session (locked decision D3 — tighter than
// Workshop's 25). Rate limit: 10 req/60s per userId, matching workshop-chat.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { buildDialogueInputs } from '../_utils/signalDropPrompt.js';
import { validateTickers } from '../_utils/tickerValidation.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { FieldValue } from 'firebase-admin/firestore';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 30 };

// ==================== CONSTANTS ====================

const MESSAGE_BUDGET = 20;            // locked decision D3
const GEMMA_TIMEOUT_MS = 25_000;
const MESSAGE_CHAR_CAP = 2000;

// Conversation context windows. HISTORY_WINDOW caps the message array
// passed to OpenRouter; PROMPT_EXCHANGES_WINDOW caps the text-rendered
// "RECENT EXCHANGES" block in the system prompt. Different defaults
// because the OpenAI-format messages array is cheap (Gemma processes
// it natively) while the text-rendered block costs prompt tokens.
const HISTORY_WINDOW = 12;            // last 12 messages = ~6 turns
const PROMPT_EXCHANGES_WINDOW = 6;    // last 6 messages = ~3 turns

const PHASE_ORDER = Object.freeze(['explore', 'propose', 'refine', 'finalize']);
const VALID_PHASES = new Set(PHASE_ORDER);
const VALID_TICKER_ACTIONS = new Set(['propose', 'keep', 'remove', 'reorder']);

// ==================== PURE HELPERS (exported for tests) ====================

// Forgiving structural validator for the parseResult payload the client
// sends on first turn. Returns the persisted shape on success, null on
// failure. We trust parse-signal's output — the only rejection criterion
// is "is this even shaped like a parse-signal response?".
export function validateParseResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const parse = raw.parse;
  if (!parse || typeof parse !== 'object' || Array.isArray(parse)) return null;
  if (typeof parse.extractedText !== 'string' || !parse.extractedText.trim()) return null;

  return {
    contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : null,
    parse,
    validation:
      raw.validation && typeof raw.validation === 'object' && !Array.isArray(raw.validation)
        ? raw.validation
        : null,
    shouldBailout: !!raw.shouldBailout,
    shouldHardCheckpoint: !!raw.shouldHardCheckpoint,
  };
}

// Forward-only phase transition with user-override support. Returns
// { newPhase, didAdvance, didReject } so the caller can shadow-log the
// rejection without bouncing the request.
//
// Rules:
//   - phaseRequest === 'advance' AND current has a successor → bump one step
//   - proposedPhase invalid/missing → reject, stay at current
//   - proposedPhase < current (backward) → reject, stay at current
//   - proposedPhase > current + 1 (skip-ahead) → clamp to current + 1
//   - otherwise → honor proposedPhase
//
// 'completed' is intentionally not handled here — that transition is
// owned by the Phase 4 save endpoint, not by Gemma's tool output.
export function validatePhaseTransition(currentPhase, proposedPhase, phaseRequest) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const safeCurrentIdx = currentIdx >= 0 ? currentIdx : 0;
  const safeCurrent = PHASE_ORDER[safeCurrentIdx];

  // User force-advance (locked decision D3 hybrid model)
  if (phaseRequest === 'advance' && safeCurrentIdx < PHASE_ORDER.length - 1) {
    return {
      newPhase: PHASE_ORDER[safeCurrentIdx + 1],
      didAdvance: true,
      didReject: false,
    };
  }

  const proposedIdx = PHASE_ORDER.indexOf(proposedPhase);
  if (proposedIdx < 0) {
    return { newPhase: safeCurrent, didAdvance: false, didReject: true };
  }
  if (proposedIdx < safeCurrentIdx) {
    return { newPhase: safeCurrent, didAdvance: false, didReject: true };
  }
  if (proposedIdx > safeCurrentIdx + 1) {
    return {
      newPhase: PHASE_ORDER[safeCurrentIdx + 1],
      didAdvance: true,
      didReject: false,
    };
  }
  return {
    newPhase: PHASE_ORDER[proposedIdx],
    didAdvance: proposedIdx > safeCurrentIdx,
    didReject: false,
  };
}

// Apply Gemma's candidateTickerUpdates to the existing candidateTickers
// list. Returns a NEW array — does not mutate the input. Each update is
// validated defensively:
//   - propose: ticker must pass tickerValidation.validateTickers; duplicates
//     by symbol are no-ops; reasoning/category are clamped.
//   - keep: existing ticker → status='kept'. Missing ticker → silent skip.
//   - remove: existing ticker → status='removed'. Missing ticker → silent skip.
//   - reorder: existing ticker → proposedAt updated to nowIso. Missing → skip.
//
// Same forgiving-validation pattern as parse-signal: malformed updates
// are dropped silently (no errors, no bailout).
export function applyCandidateTickerUpdates(currentList, updates, currentPhase, nowIso) {
  const safeCurrent = Array.isArray(currentList) ? currentList : [];
  if (!Array.isArray(updates) || updates.length === 0) return [...safeCurrent];

  const list = safeCurrent.map((t) => ({ ...t }));
  const indexBySymbol = new Map();
  list.forEach((t, i) => {
    if (t && typeof t.symbol === 'string') {
      indexBySymbol.set(t.symbol.toUpperCase(), i);
    }
  });

  const phaseTag = VALID_PHASES.has(currentPhase) ? currentPhase : 'explore';

  for (const update of updates) {
    if (!update || typeof update !== 'object') continue;
    const action = update.action;
    if (!VALID_TICKER_ACTIONS.has(action)) continue;
    const rawSymbol = typeof update.symbol === 'string' ? update.symbol.trim() : '';
    if (!rawSymbol) continue;

    if (action === 'propose') {
      const v = validateTickers([rawSymbol]);
      if (v.validated.length === 0) continue;
      const canonical = v.validated[0].symbol;

      if (indexBySymbol.has(canonical)) continue;

      const reasoning =
        typeof update.reasoning === 'string' ? update.reasoning.slice(0, 500).trim() : '';
      const category =
        typeof update.category === 'string' ? update.category.slice(0, 30).trim() : '';

      list.push({
        symbol: canonical,
        reasoning,
        category,
        status: 'proposed',
        proposedAt: nowIso,
        proposedAtPhase: phaseTag,
      });
      indexBySymbol.set(canonical, list.length - 1);
      continue;
    }

    const symbol = rawSymbol.toUpperCase();
    const idx = indexBySymbol.get(symbol);
    if (idx === undefined) continue;

    if (action === 'keep') {
      list[idx].status = 'kept';
      if (typeof update.reasoning === 'string' && update.reasoning.trim()) {
        list[idx].reasoning = update.reasoning.slice(0, 500).trim();
      }
    } else if (action === 'remove') {
      list[idx].status = 'removed';
    } else if (action === 'reorder') {
      list[idx].proposedAt = nowIso;
    }
  }

  return list;
}

// Normalize Gemma's parsed JSON output into the shape the rest of the
// pipeline expects. ALWAYS returns a fully-shaped object — caller gets
// safe defaults even on garbage input, mirroring parseVoiceLayerResponse's
// "never throw" contract.
export function normalizeDialogueOutput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      agentMessage: '',
      proposedPhase: null,
      candidateTickerUpdates: [],
      suggestedActions: [],
      readyToFinalize: false,
    };
  }

  const agentMessage =
    typeof raw.agentMessage === 'string' ? raw.agentMessage.slice(0, MESSAGE_CHAR_CAP).trim() : '';

  const proposedPhase = VALID_PHASES.has(raw.proposedPhase) ? raw.proposedPhase : null;

  const candidateTickerUpdates = Array.isArray(raw.candidateTickerUpdates)
    ? raw.candidateTickerUpdates
        .filter((u) => u && typeof u === 'object' && !Array.isArray(u))
        .slice(0, 8)
    : [];

  const suggestedActions = Array.isArray(raw.suggestedActions)
    ? raw.suggestedActions
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.slice(0, 60).trim())
        .slice(0, 3)
    : [];

  return {
    agentMessage,
    proposedPhase,
    candidateTickerUpdates,
    suggestedActions,
    readyToFinalize: !!raw.readyToFinalize,
  };
}

// ==================== HANDLER ====================

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
  const {
    agentId,
    sessionId: providedSessionId,
    message,
    parseResult: rawParseResult,
    phaseRequest: rawPhaseRequest,
  } = req.body || {};

  if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
    return res.status(400).json({ error: 'agentId is required' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const phaseRequest = rawPhaseRequest === 'advance' ? 'advance' : null;

  // First-turn callers MUST supply parseResult; subsequent-turn callers
  // MUST supply sessionId. Both at once is fine — sessionId wins.
  if (!providedSessionId && !rawParseResult) {
    return res.status(400).json({
      error: 'parseResult is required on the first turn (no sessionId)',
    });
  }

  // 4. Sanitize message — same shape as workshop-chat (cap, strip newlines / brackets)
  const sanitizedMessage = String(message)
    .slice(0, MESSAGE_CHAR_CAP)
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[<>{}]/g, '')
    .trim();

  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Message cannot be empty after sanitization' });
  }

  const db = getFirebaseAdmin();

  try {
    // 5. Read agent doc + verify ownership
    const agentRef = db.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = agentSnap.data();
    if (agent.ownerId !== user.uid) {
      return res
        .status(403)
        .json({ error: 'Not authorized to dialogue with this agent' });
    }

    // 6. Load or create session
    const sessionsCol = db.collection('watchlistSessions');
    let sessionRef;
    let session;
    let isNewSession = false;

    if (providedSessionId) {
      sessionRef = sessionsCol.doc(providedSessionId);
      const snap = await sessionRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Watchlist dialogue session not found' });
      }
      session = snap.data();
      if (session.userId !== user.uid) {
        return res
          .status(403)
          .json({ error: 'Not authorized for this session' });
      }
      // Per Q3 override: 400 (matching workshop-chat precedent), not 410.
      if (session.status !== 'active') {
        return res.status(400).json({
          error: 'session_not_active',
          message:
            'This dialogue is already finalized or abandoned. Drop a new signal to start another.',
        });
      }
    } else {
      const validatedParseResult = validateParseResult(rawParseResult);
      if (!validatedParseResult) {
        return res.status(400).json({
          error: 'parseResult is malformed',
          message:
            'Expected the verbatim response from /api/forge/parse-signal: { contentHash, parse, validation, shouldBailout, shouldHardCheckpoint }.',
        });
      }
      sessionRef = sessionsCol.doc();
      const nowIso = new Date().toISOString();
      session = {
        userId: user.uid,
        agentId,
        startedAt: nowIso,
        updatedAt: nowIso,
        status: 'active',
        phase: 'explore',
        parseResult: validatedParseResult,
        exchanges: [],
        candidateTickers: [],
        messagesUsed: 0,
        messageBudget: MESSAGE_BUDGET,
        dropListId: null,
        meta: {
          initialAgentName: typeof agent.name === 'string' ? agent.name : 'Gemma',
        },
      };
      isNewSession = true;
    }

    // 7. Budget check — happens BEFORE we count this turn
    const currentMessagesUsed = session.messagesUsed || 0;
    const messageBudget = session.messageBudget || MESSAGE_BUDGET;
    if (currentMessagesUsed >= messageBudget) {
      return res.status(403).json({
        error: 'budget_exceeded',
        message:
          "We've covered a lot of ground here. Let's lock in the list as it stands instead of adding more.",
        messageBudget,
      });
    }

    // 8. Build conversation context
    const currentPhase = VALID_PHASES.has(session.phase) ? session.phase : 'explore';
    const allExchanges = Array.isArray(session.exchanges) ? session.exchanges : [];
    const recentExchanges = allExchanges.slice(-PROMPT_EXCHANGES_WINDOW);

    // OpenAI-format message history for OpenRouter (separate from the
    // text-rendered RECENT EXCHANGES block above)
    const conversationHistory = allExchanges.slice(-HISTORY_WINDOW).map((ex) => ({
      role: ex.role === 'agent' ? 'assistant' : 'user',
      content: typeof ex.content === 'string' ? ex.content : '',
    }));

    // 9. Anchor context (DRB) — same pattern as workshop-chat
    let anchorContext = null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const drbDoc = await db
        .collection('indexIntelligence')
        .doc('dailyRegimeBrief')
        .get();
      if (drbDoc.exists) {
        const drb = drbDoc.data();
        if (drb.forDate === today && typeof drb.dailyBrief === 'string') {
          anchorContext = drb.dailyBrief;
        }
      }
    } catch (err) {
      console.error('[watchlist-dialogue] DRB fetch failed:', err.message);
    }

    // 10. Build dialogue inputs (parsedSignalBlock for the prompt)
    const { parsedSignalBlock } = buildDialogueInputs(session.parseResult);

    // 11. Assemble system prompt
    const systemPrompt = buildVoiceLayerPrompt({
      agent,
      mode: 'watchlist_dialogue',
      anchorContext,
      parsedSignal: parsedSignalBlock,
      currentPhase,
      recentExchanges,
      candidateTickers: session.candidateTickers || [],
      phaseRequest,
    });

    // 12. Decorate user message with phase-advance annotation if requested
    const userMessage =
      phaseRequest === 'advance'
        ? `[User has requested to advance to the next phase]\nUser: ${sanitizedMessage}`
        : sanitizedMessage;

    // 13. Call Gemma with abort
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMMA_TIMEOUT_MS);
    let gemmaResult;
    try {
      gemmaResult = await callGemmaVoiceWithRetry({
        systemPrompt,
        conversationHistory,
        userMessage,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 14. Structured-error path (Gemma failed but session preserved)
    // Mirrors workshop-chat's contract: 200 (or 504 on abort) with a
    // graceful agentMessage and the previous candidate state. The failed
    // turn does NOT burn budget, so messagesUsed is NOT incremented.
    if (!gemmaResult.success) {
      console.error('[watchlist-dialogue] Gemma call failed:', gemmaResult.error);

      if (isNewSession) {
        // First-turn failure: don't materialize the session doc — the
        // client will retry with the same parseResult and we'll allocate
        // a fresh ID. Avoids leaving abandoned shells in Firestore.
        const statusCode = gemmaResult.aborted ? 504 : 200;
        return res.status(statusCode).json({
          sessionId: null,
          error: true,
          errorReason: gemmaResult.aborted ? 'gemma_timeout' : 'gemma_invalid_shape',
          agentMessage:
            "I hit a snag opening this conversation — could you send that again?",
          candidateTickers: [],
          phase: 'explore',
          suggestedActions: ['retry'],
          messagesUsed: 0,
          messageBudget,
          readyToFinalize: false,
        });
      }

      // Continuing-turn failure: shadow log + 200 with preserved state.
      waitUntil(
        logSignalDrops({
          stage: 'dialogue',
          dropId: session.parseResult?.contentHash || null,
          contentHash: session.parseResult?.contentHash || null,
          userId: user.uid,
          agentId,
          sessionId: sessionRef.id,
          phase: currentPhase,
          messagesUsed: currentMessagesUsed,
          turnError: true,
          errorReason: gemmaResult.aborted ? 'gemma_timeout' : 'gemma_invalid_shape',
          loggedAt: new Date().toISOString(),
        }).catch(() => {}),
      );

      const statusCode = gemmaResult.aborted ? 504 : 200;
      return res.status(statusCode).json({
        sessionId: sessionRef.id,
        error: true,
        errorReason: gemmaResult.aborted ? 'gemma_timeout' : 'gemma_invalid_shape',
        agentMessage:
          "I hit a snag processing that — could you try that again?",
        candidateTickers: session.candidateTickers || [],
        phase: currentPhase,
        suggestedActions: ['retry'],
        messagesUsed: currentMessagesUsed,
        messageBudget,
        readyToFinalize: false,
      });
    }

    // 15. Parse + normalize Gemma's output
    const rawParsed = parseVoiceLayerResponse(gemmaResult.content);
    const normalized = normalizeDialogueOutput(rawParsed);

    // Defensive fallback for empty agentMessage — never echo Gemma's raw
    // string, but still return a sane turn so the user can retry.
    const agentMessage =
      normalized.agentMessage ||
      "Let me think again — can you rephrase that for me?";

    // 16. Validate phase transition (server-authoritative per D3)
    const transition = validatePhaseTransition(
      currentPhase,
      normalized.proposedPhase,
      phaseRequest,
    );
    if (transition.didReject) {
      console.warn(
        `[watchlist-dialogue] Rejected phase transition: ${currentPhase} → ${normalized.proposedPhase} (session ${sessionRef.id})`,
      );
    }

    // 17. Apply candidateTicker updates atomically (whole-array write)
    const nowIso = new Date().toISOString();
    const updatedCandidateTickers = applyCandidateTickerUpdates(
      session.candidateTickers || [],
      normalized.candidateTickerUpdates,
      transition.newPhase,
      nowIso,
    );

    // 18. Build per-message exchange records
    const userExchange = {
      role: 'user',
      content: sanitizedMessage,
      phase: currentPhase,
      timestamp: nowIso,
    };
    const agentExchange = {
      role: 'agent',
      content: agentMessage,
      phase: transition.newPhase,
      timestamp: nowIso,
      suggestedActions: normalized.suggestedActions,
    };

    // 19. Persist
    if (isNewSession) {
      await sessionRef.set({
        ...session,
        phase: transition.newPhase,
        exchanges: [userExchange, agentExchange],
        candidateTickers: updatedCandidateTickers,
        messagesUsed: 1,
        updatedAt: nowIso,
      });
    } else {
      await sessionRef.update({
        phase: transition.newPhase,
        exchanges: FieldValue.arrayUnion(userExchange, agentExchange),
        candidateTickers: updatedCandidateTickers,
        messagesUsed: FieldValue.increment(1),
        updatedAt: nowIso,
      });
    }

    // 20. Shadow log (fire-and-forget)
    waitUntil(
      logSignalDrops({
        stage: 'dialogue',
        dropId: session.parseResult?.contentHash || null,
        contentHash: session.parseResult?.contentHash || null,
        userId: user.uid,
        agentId,
        sessionId: sessionRef.id,
        previousPhase: currentPhase,
        phase: transition.newPhase,
        phaseRejected: transition.didReject,
        phaseRequest,
        messagesUsed: currentMessagesUsed + 1,
        messageBudget,
        userMessage: sanitizedMessage,
        agentMessage,
        candidateTickerCount: updatedCandidateTickers.length,
        candidateTickerUpdates: normalized.candidateTickerUpdates,
        suggestedActions: normalized.suggestedActions,
        readyToFinalize: normalized.readyToFinalize,
        turnError: false,
        loggedAt: nowIso,
      }).catch(() => {}),
    );

    // 21. Respond — public-shape candidateTickers (drop server-internal fields)
    const publicCandidateTickers = updatedCandidateTickers.map((t) => ({
      symbol: t.symbol,
      reasoning: t.reasoning || '',
      category: t.category || '',
      status: t.status || 'proposed',
    }));

    return res.status(200).json({
      sessionId: sessionRef.id,
      agentMessage,
      candidateTickers: publicCandidateTickers,
      phase: transition.newPhase,
      suggestedActions: normalized.suggestedActions,
      messagesUsed: currentMessagesUsed + 1,
      messageBudget,
      readyToFinalize: normalized.readyToFinalize,
    });
  } catch (error) {
    console.error('[watchlist-dialogue] Error:', error);
    const isAbort = error?.name === 'AbortError';
    return res.status(isAbort ? 504 : 500).json({
      error: true,
      errorReason: isAbort ? 'gemma_timeout' : 'server_error',
      agentMessage: isAbort
        ? 'That took too long — could you try sending that again?'
        : 'Something went wrong on my end. Try again in a moment.',
      sessionId: null,
      candidateTickers: [],
      phase: 'explore',
      suggestedActions: ['retry'],
      messagesUsed: 0,
      messageBudget: MESSAGE_BUDGET,
      readyToFinalize: false,
    });
  }
}
