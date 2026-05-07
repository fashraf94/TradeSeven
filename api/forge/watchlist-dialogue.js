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

// Phase 2.5 Fix 2 (audit B1): field caps for the parseResult.parse envelope.
// Source of truth for enum values: the SUBMIT_PARSED_SIGNAL_TOOL schema in
// api/_utils/signalDropPrompt.js. If parse-signal evolves its tool schema,
// this validator may drift — accepted risk for Phase 2.5; long-term
// candidate for a shared schema-constants module.
const PARSE_FIELD_CAPS = Object.freeze({
  EXTRACTED_TEXT: 2000,
  TOPIC: 200,
  TICKER_SYMBOL: 12,
  TICKERS_MAX: 20,
  IMPLIED_TICKERS_MAX: 20,
  DATA_POINTS_MAX: 20,
  DATA_POINT_LEN: 500,
  REFERENCED_DATE_LEN: 30,
});

const VALID_CONTENT_TYPES = new Set([
  'tweet',
  'news_article',
  'blog_post',
  'research_note',
  'chart',
  'dm_screenshot',
  'casual_text',
  'unknown',
]);

const VALID_SIGNAL_DIRECTIONS = new Set([
  'bullish',
  'bearish',
  'neutral',
  'mixed',
  'uncertain',
]);

const VALID_TIME_HORIZONS = new Set([
  'intraday',
  'swing',
  'positional',
  'longterm',
  'unspecified',
]);

// Strict ISO date — mirrors expand-signal's computeTemporalRelation regex.
// parse-signal allows free-form values too (e.g. "next week", "Q2 2026")
// but those have no server-side dependent logic in the dialogue prompt;
// dropping them here is a conservative cap. Future cleanup could allow
// free-form up to 50 chars — backlog item, not Phase 2.5 scope.
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Phase 2.5 Fix 1 (audit B2): dropId character validation. Defense-in-depth
// against Firestore path injection (slashes resolving to sub-collection
// paths). Same shape parse-signal uses for the client-supplied dropId.
const DROP_ID_REGEX = /^[A-Za-z0-9_-]+$/;
const DROP_ID_MAX_LEN = 200;

function capString(v, max) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

function capTickerArray(v, cap, perItemCap) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => x.trim().toUpperCase().slice(0, perItemCap))
    .slice(0, cap);
}

function capStringArray(v, cap, perItemCap) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => x.slice(0, perItemCap).trim())
    .filter((x) => x)
    .slice(0, cap);
}

function clampConfidence(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Cap every field of a parseResult.parse object. Returns null if the
// critical extractedText is missing or empty post-cap; otherwise returns
// a fully-capped parse object. Non-critical fields that fail validation
// are dropped (set to empty string / null) but don't fail the validation.
function capParseFields(rawParse) {
  const extractedText = capString(rawParse.extractedText, PARSE_FIELD_CAPS.EXTRACTED_TEXT).trim();
  if (!extractedText) return null;

  const referencedDateRaw = capString(rawParse.referencedDate, PARSE_FIELD_CAPS.REFERENCED_DATE_LEN);
  const referencedDate = ISO_DATE_REGEX.test(referencedDateRaw) ? referencedDateRaw : '';

  return {
    extractedText,
    topic: capString(rawParse.topic, PARSE_FIELD_CAPS.TOPIC).trim(),
    tickers: capTickerArray(
      rawParse.tickers,
      PARSE_FIELD_CAPS.TICKERS_MAX,
      PARSE_FIELD_CAPS.TICKER_SYMBOL,
    ),
    impliedTickers: capTickerArray(
      rawParse.impliedTickers,
      PARSE_FIELD_CAPS.IMPLIED_TICKERS_MAX,
      PARSE_FIELD_CAPS.TICKER_SYMBOL,
    ),
    confidence: clampConfidence(rawParse.confidence),
    contentType: VALID_CONTENT_TYPES.has(rawParse.contentType) ? rawParse.contentType : 'unknown',
    signalDirection: VALID_SIGNAL_DIRECTIONS.has(rawParse.signalDirection)
      ? rawParse.signalDirection
      : 'uncertain',
    timeHorizon: VALID_TIME_HORIZONS.has(rawParse.timeHorizon)
      ? rawParse.timeHorizon
      : 'unspecified',
    referencedDate,
    dataPoints: capStringArray(
      rawParse.dataPoints,
      PARSE_FIELD_CAPS.DATA_POINTS_MAX,
      PARSE_FIELD_CAPS.DATA_POINT_LEN,
    ),
    suspectedInjection: !!rawParse.suspectedInjection,
  };
}

// ==================== PURE HELPERS (exported for tests) ====================

// Structural validator for the parseResult payload the client sends on
// first turn. Returns the capped shape on success, null on failure.
//
// Phase 2.5 Fix 2 (audit B1): every field inside `parse` is now capped to
// bounded sizes matching parse-signal's tool schema. Critical field
// extractedText is required non-empty post-cap; non-critical fields are
// dropped to safe defaults if they fail validation but don't fail the
// overall result.
export function validateParseResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const parse = raw.parse;
  if (!parse || typeof parse !== 'object' || Array.isArray(parse)) return null;

  const cappedParse = capParseFields(parse);
  if (!cappedParse) return null;

  return {
    contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : null,
    parse: cappedParse,
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
    dropId: rawDropId,
  } = req.body || {};

  if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
    return res.status(400).json({ error: 'agentId is required' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const phaseRequest = rawPhaseRequest === 'advance' ? 'advance' : null;

  // First-turn callers MUST supply parseResult AND dropId; subsequent-turn
  // callers MUST supply sessionId. Both at once is fine — sessionId wins
  // (dropId is silently ignored on continuing turns since the session doc
  // already binds the verified dropId).
  if (!providedSessionId && !rawParseResult) {
    return res.status(400).json({
      error: 'parseResult is required on the first turn (no sessionId)',
    });
  }

  // Phase 2.5 Fix 1 (audit B2): dropId is required on the first turn so we
  // can verify the parseResult actually came from a real parse-signal call
  // by this user. Character-validated against a strict regex to defend
  // against Firestore path injection.
  let dropId = null;
  if (!providedSessionId) {
    if (typeof rawDropId !== 'string' || !rawDropId.trim()) {
      return res.status(400).json({
        error: 'dropId is required on the first turn',
      });
    }
    const trimmedDropId = rawDropId.trim();
    if (trimmedDropId.length > DROP_ID_MAX_LEN || !DROP_ID_REGEX.test(trimmedDropId)) {
      return res.status(400).json({
        error: 'dropId is malformed',
        message: `dropId must match ${DROP_ID_REGEX} and be ≤${DROP_ID_MAX_LEN} chars`,
      });
    }
    dropId = trimmedDropId;
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
      // Phase 2.5 Fix 5 (audit A1): reject if the request's agentId doesn't
      // match the session's persisted agentId. Prevents accidental client
      // bugs from mixing one agent's profile into another agent's session.
      if (session.agentId !== agentId) {
        return res.status(400).json({
          error: 'agent_session_mismatch',
          message:
            'The agent for this session does not match the agent in the request.',
        });
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

      // Phase 2.5 Fix 1 (audit B2): verify parseResult against the per-user
      // signalDrops record. The doc lives at users/{userId}/signalDrops/{dropId}
      // and persists indefinitely (no TTL), unlike the global signalDropCache.
      // Closes the prompt-injection root cause where a client could fabricate
      // parseResult envelopes without going through parse-signal.
      const dropRef = db
        .collection('users')
        .doc(user.uid)
        .collection('signalDrops')
        .doc(dropId);
      const dropSnap = await dropRef.get();
      if (!dropSnap.exists) {
        return res.status(400).json({
          error: 'unknown_drop',
          message:
            'No signal drop found for this dropId. Call /api/forge/parse-signal first.',
        });
      }
      const dropRecord = dropSnap.data();
      if (
        typeof dropRecord.contentHash !== 'string' ||
        dropRecord.contentHash !== validatedParseResult.contentHash
      ) {
        return res.status(400).json({
          error: 'parse_result_mismatch',
          message:
            "The parseResult contentHash doesn't match the recorded drop. Re-call parse-signal to get a fresh parseResult.",
        });
      }

      sessionRef = sessionsCol.doc();
      const nowIso = new Date().toISOString();
      session = {
        userId: user.uid,
        agentId,
        dropId,
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

    // 17. Build per-message exchange records (pre-transaction — these
    // don't depend on fresh state).
    const nowIso = new Date().toISOString();
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

    // 18. Apply ticker updates + persist.
    //
    // Phase 2.5 Fix 4 (audit D1, D2): the continuing-turn write is wrapped
    // in db.runTransaction. The transaction re-reads fresh session state,
    // re-validates budget / status / phase, and applies candidateTicker
    // updates against the FRESH list (not the pre-Gemma snapshot). Closes
    // the lost-update race on candidateTickers and the rollback race on
    // phase. If any concurrency check fails, throw a sentinel error caught
    // below and translated into a 409 concurrent_modification response.
    //
    // First-turn writes use set() directly — no transaction needed because
    // the doc doesn't exist yet and the auto-allocated session ID is unique.
    let updatedCandidateTickers;
    if (isNewSession) {
      updatedCandidateTickers = applyCandidateTickerUpdates(
        [],
        normalized.candidateTickerUpdates,
        transition.newPhase,
        nowIso,
      );
      await sessionRef.set({
        ...session,
        phase: transition.newPhase,
        exchanges: [userExchange, agentExchange],
        candidateTickers: updatedCandidateTickers,
        messagesUsed: 1,
        updatedAt: nowIso,
      });
    } else {
      try {
        const txResult = await db.runTransaction(async (tx) => {
          const freshSnap = await tx.get(sessionRef);
          if (!freshSnap.exists) {
            throw new Error('__concurrency:session_disappeared');
          }
          const freshSession = freshSnap.data();
          if (freshSession.status !== 'active') {
            throw new Error('__concurrency:session_closed');
          }
          if (
            (freshSession.messagesUsed || 0) >=
            (freshSession.messageBudget || MESSAGE_BUDGET)
          ) {
            throw new Error('__concurrency:budget_consumed');
          }
          if (freshSession.phase !== currentPhase) {
            throw new Error('__concurrency:phase_advanced');
          }

          const freshList = applyCandidateTickerUpdates(
            freshSession.candidateTickers || [],
            normalized.candidateTickerUpdates,
            transition.newPhase,
            nowIso,
          );

          tx.update(sessionRef, {
            phase: transition.newPhase,
            exchanges: FieldValue.arrayUnion(userExchange, agentExchange),
            candidateTickers: freshList,
            messagesUsed: FieldValue.increment(1),
            updatedAt: nowIso,
          });

          return { freshList };
        });
        updatedCandidateTickers = txResult.freshList;
      } catch (txErr) {
        if (
          typeof txErr?.message === 'string' &&
          txErr.message.startsWith('__concurrency:')
        ) {
          const reason = txErr.message.split(':')[1];
          console.warn(
            `[watchlist-dialogue] concurrent_modification: ${reason} (session ${sessionRef.id})`,
          );
          return res.status(409).json({
            error: 'concurrent_modification',
            errorReason: reason,
            message:
              'Your session was modified by another request. Please try again.',
            sessionId: sessionRef.id,
            phase: currentPhase,
            candidateTickers: session.candidateTickers || [],
            suggestedActions: ['retry'],
            messagesUsed: currentMessagesUsed,
            messageBudget,
            readyToFinalize: false,
          });
        }
        throw txErr;
      }
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
