// api/screener/chat.js
//
// Research Engine — Phase 2: the screener chat endpoint (route /api/screener/chat).
//
// Conversational, universe-level stock screening. The user describes what they
// want in plain language; Gemma (via buildVoiceLayerPrompt mode:'research')
// translates it into a screenSpec; the deterministic api/_utils/screenStocks.js
// util runs it against the daily indexIntelligence/stockRankings doc; and the
// endpoint returns ranked, value-carrying results framed by a short message.
//
// Isolated and additive: NO agent, NO battle — its own researchSessions
// collection. Mirrors api/forge/workshop-chat.js for auth, session lifecycle,
// the Gemma call, and error handling. The screenStocks util OWNS all spec
// validation — this endpoint hands parsed.screenSpec straight through and treats
// the util's appliedSpec / rejectedFilters as truth (no re-validation here).
//
// _scratchpad never reaches the client or the session doc: every persisted and
// returned field is picked explicitly — the raw parsed Gemma object is never
// spread. The scratchpad goes only to the fire-and-forget shadow logger.
//
// Session lifecycle:
//   * sessionId === null  → create a researchSessions doc (messagesUsed=0,
//     messageBudget=30, status='active', latestSpec=null).
//   * subsequent calls    → load the doc, re-inject latestSpec as previousSpec
//     so refinements ("drop energy") mutate the prior spec, append the exchange.
//
// Budget: 30 messages/session — SOFT. Hitting it returns a graceful
// "start a fresh screen" message (sessionEnded:true), NOT an error.
// Rate limit: 10 req/60s per user (matches the sibling chat endpoints).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { screenStocks, screenIndustries } from '../_utils/screenStocks.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logConversation } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 30 };

const MESSAGE_BUDGET = 30;
const HISTORY_WINDOW = 10; // max turns fed back into the model

// ==================== HELPERS ====================

// Firestore Timestamp | ISO string | {_seconds} | null → ISO string | null.
// The stockRankings doc writes serverTimestamp() for updatedAt/computedAt
// (compute-index-intelligence.js:1019-1023), which reads back as a Timestamp
// with .toDate(); tolerate the other shapes defensively.
function toIso(ts) {
  if (!ts) return null;
  if (typeof ts === 'string') return ts;
  if (typeof ts.toDate === 'function') {
    try { return ts.toDate().toISOString(); } catch { return null; }
  }
  if (typeof ts._seconds === 'number') {
    return new Date(ts._seconds * 1000).toISOString();
  }
  return null;
}

function sanitizeMessageIn(raw) {
  return String(raw || '')
    .slice(0, 2000)
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[<>{}]/g, '')
    .trim();
}

function sanitizeScratchpad(raw) {
  if (typeof raw !== 'string') return null;
  return raw.replace(/\s{2,}/g, ' ').trim() || null;
}

function sanitizeMessageOut(raw, fallback) {
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 1200);
  return fallback;
}

function sanitizeSuggestedActions(raw) {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => x.trim().slice(0, 80))
    .slice(0, 4);
  return out.length ? out : null;
}

// Only re-inject a structurally-plausible prior spec into the prompt.
// screenStocks does the real validation; this just avoids feeding obvious
// garbage to the model on a refinement turn.
function sanitizePreviousSpec(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const filters = Array.isArray(raw.filters) ? raw.filters : [];
  const rankBy = raw.rankBy && typeof raw.rankBy === 'object' && !Array.isArray(raw.rankBy) ? raw.rankBy : null;
  if (filters.length === 0 && !rankBy) return null;
  const spec = { filters };
  if (rankBy) spec.rankBy = rankBy;
  if (Number.isFinite(raw.limit)) spec.limit = raw.limit;
  // Carry the industry-rollup discriminator so a rollup refinement stays a rollup
  // (the model still re-decides per turn — see voiceLayerPrompt rollup rules).
  if (raw.screenType === 'industries') spec.screenType = 'industries';
  return spec;
}

// ==================== HANDLER ====================

export default async function handler(req, res) {
  // 1. Security middleware + rate limit
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
  const {
    userMessage,
    sessionId: providedSessionId,
    previousSpec: rawPreviousSpec,
  } = req.body || {};

  const sanitizedMessage = sanitizeMessageIn(userMessage);
  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  // Session ids are server-generated Firestore auto-ids. Reject anything that
  // isn't a plain token so a crafted value can't steer the doc() path to an
  // unexpected document. Treat malformed ids as not-found (no existence oracle).
  if (providedSessionId != null && !/^[A-Za-z0-9_-]{1,128}$/.test(String(providedSessionId))) {
    return res.status(404).json({ error: 'Research session not found' });
  }

  const db = getFirebaseAdmin();

  try {
    // 5. Load or create session (scoped to user.uid)
    const sessionsCol = db.collection('researchSessions');
    let sessionRef;
    let session;
    let isNewSession = false;

    if (providedSessionId) {
      sessionRef = sessionsCol.doc(String(providedSessionId));
      const snap = await sessionRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Research session not found' });
      }
      session = snap.data();
      // Session isolation: a user may only read/write their own session.
      if (session.userId !== user.uid) {
        return res.status(403).json({ error: 'Not authorized for this session' });
      }
    } else {
      sessionRef = sessionsCol.doc();
      session = {
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messagesUsed: 0,
        messageBudget: MESSAGE_BUDGET,
        exchanges: [],
        latestSpec: null,
        status: 'active',
      };
      isNewSession = true;
    }

    const messagesUsed = session.messagesUsed || 0;
    const messageBudget = session.messageBudget || MESSAGE_BUDGET;

    // 6. Soft budget cap → graceful "fresh screen" message, NOT an error.
    if (messagesUsed >= messageBudget) {
      return res.status(200).json({
        sessionId: null, // signal the client to start a new session
        message: "We've covered a lot in this thread. Start a fresh screen and we'll keep going.",
        suggestedActions: null,
        screened: false,
        sessionEnded: true,
      });
    }

    // 7. Conversation history (last HISTORY_WINDOW exchanges)
    const previousExchanges = (session.exchanges || []).slice(-HISTORY_WINDOW);
    const conversationHistory = previousExchanges.flatMap((ex) => [
      { role: 'user', content: ex.userMessage || '' },
      { role: 'assistant', content: ex.message || '' },
    ]);

    // 8. previousSpec for refinement: the server-persisted latestSpec is the
    //    source of truth on a continuing turn; a client-sent previousSpec is
    //    honored only on a brand-new (stateless) session.
    const previousSpec = isNewSession
      ? sanitizePreviousSpec(rawPreviousSpec)
      : sanitizePreviousSpec(session.latestSpec);

    // 9. Assemble the agent-agnostic research system prompt.
    const systemPrompt = buildVoiceLayerPrompt({
      mode: 'research',
      conversationHistory,
      researchContext: { previousSpec },
    });

    // 10. Call Gemma with a 25s timeout.
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

    // 10b. Gemma failure → graceful 200 (this turn doesn't burn budget).
    if (!gemmaResult.success) {
      console.error('[ScreenerChat] Gemma call failed:', gemmaResult.error);
      return res.status(gemmaResult.aborted ? 504 : 200).json({
        sessionId: isNewSession ? null : sessionRef.id,
        message: 'I hit a snag building that screen — could you try that again?',
        suggestedActions: null,
        screened: false,
        error: true,
      });
    }

    // 11. Parse (mode-agnostic; MUST check parseError and never echo rawText).
    const parsed = parseVoiceLayerResponse(gemmaResult.content);
    if (parsed?.parseError === true) {
      console.error(
        '[ScreenerChat] parse failed:',
        parsed.errorReason,
        '| raw:',
        String(parsed.rawText || '').slice(0, 300),
      );
      return res.status(200).json({
        sessionId: isNewSession ? null : sessionRef.id,
        message: 'I hit a snag building that screen — could you try that again?',
        suggestedActions: null,
        screened: false,
        error: true,
        errorReason: `parse_${parsed.errorReason}`,
      });
    }

    // 12. Explicitly PICK fields — never spread the raw parsed Gemma object, so
    //     _scratchpad (and any stray fields) never reach the client or Firestore.
    const cleanScratchpad = sanitizeScratchpad(parsed._scratchpad);
    const message = sanitizeMessageOut(parsed.message, "Here's what I found.");
    const suggestedActions = sanitizeSuggestedActions(parsed.suggestedActions);
    const rawScreenSpec =
      parsed.screenSpec && typeof parsed.screenSpec === 'object' && !Array.isArray(parsed.screenSpec)
        ? parsed.screenSpec
        : null;
    // Default toward screening: run whenever a spec is present, unless Gemma
    // explicitly held off (readyToScreen === false).
    const shouldScreen = rawScreenSpec != null && parsed.readyToScreen !== false;

    const nowIso = new Date().toISOString();
    let responsePayload;
    let exchange;

    if (shouldScreen) {
      // 13. Read the universe ONCE (decide.js:122 pattern).
      const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
      if (!rankingsDoc.exists) {
        return res.status(503).json({
          error: 'Stock rankings not available. The daily ranking job may not have run yet.',
        });
      }
      const rankingsData = rankingsDoc.data();
      const stocks = rankingsData.stocks || [];
      // Carry the universe's own freshness through, distinct from the screen-run
      // time the util stamps — so a saved artifact later records both.
      const dataAsOf = toIso(rankingsData.updatedAt) || toIso(rankingsData.computedAt);
      const dataMode = typeof rankingsData.mode === 'string' ? rankingsData.mode : null;

      // 14. Hand the raw spec straight to the util — it owns all validation. An
      //     "industries" screenType runs the precomputed-rollup path; anything else
      //     (including absent) runs the per-stock path, unchanged.
      const isIndustryRollup = rawScreenSpec.screenType === 'industries';
      const screen = isIndustryRollup
        ? screenIndustries(rankingsData.industries || {}, rawScreenSpec)
        : screenStocks(stocks, rawScreenSpec);

      // rejectedFilters and matchCount are ALWAYS present on a screened turn,
      // so an empty (matchCount:0) or partial screen is always explainable.
      responsePayload = {
        sessionId: sessionRef.id,
        message,
        suggestedActions,
        screened: true,
        resultType: isIndustryRollup ? 'industries' : 'stocks',
        appliedSpec: screen.appliedSpec,
        rejectedFilters: screen.rejectedFilters,
        results: screen.results,
        matchCount: screen.matchCount,
        universeSize: screen.universeSize,
        computedAt: screen.computedAt,
        dataAsOf,
        dataMode,
      };
      exchange = {
        userMessage: sanitizedMessage,
        message,
        appliedSpec: screen.appliedSpec,
        matchCount: screen.matchCount,
        timestamp: nowIso,
      };
    } else {
      // Clarifying turn (rare) — message only, no screen run.
      responsePayload = {
        sessionId: sessionRef.id,
        message,
        suggestedActions,
        screened: false,
      };
      exchange = {
        userMessage: sanitizedMessage,
        message,
        appliedSpec: null,
        matchCount: null,
        timestamp: nowIso,
      };
    }

    // 15. Persist. latestSpec carries forward only a screened spec (so a
    //     refinement has something to mutate); a clarifying turn leaves it.
    const nextLatestSpec = shouldScreen ? responsePayload.appliedSpec : (session.latestSpec || null);

    if (isNewSession) {
      await sessionRef.set({
        ...session,
        exchanges: [exchange],
        latestSpec: nextLatestSpec,
        messagesUsed: 1,
        updatedAt: nowIso,
      });
    } else {
      // Continuing turn: transaction re-reads fresh state and re-checks budget
      // so concurrent turns can't interleave their increments past the cap
      // (mirrors workshop-chat.js:539-560).
      try {
        await db.runTransaction(async (tx) => {
          const freshSnap = await tx.get(sessionRef);
          if (!freshSnap.exists) throw new Error('__concurrency:session_disappeared');
          const fresh = freshSnap.data();
          // Re-verify ownership inside the transaction (defense-in-depth: the
          // doc was ownership-checked at load, and userId is immutable, but
          // this makes the isolation invariant hold locally and survive any
          // future change that could touch userId).
          if (fresh.userId !== user.uid) throw new Error('__concurrency:not_owner');
          if ((fresh.messagesUsed || 0) >= (fresh.messageBudget || MESSAGE_BUDGET)) {
            throw new Error('__concurrency:budget_consumed');
          }
          tx.update(sessionRef, {
            exchanges: FieldValue.arrayUnion(exchange),
            latestSpec: nextLatestSpec,
            messagesUsed: FieldValue.increment(1),
            updatedAt: nowIso,
          });
        });
      } catch (txErr) {
        if (typeof txErr?.message === 'string' && txErr.message.startsWith('__concurrency:')) {
          const reason = txErr.message.split(':')[1];
          if (reason === 'not_owner') {
            return res.status(403).json({ error: 'Not authorized for this session' });
          }
          console.warn(`[ScreenerChat] concurrent_modification: ${reason} (session ${sessionRef.id})`);
          return res.status(409).json({
            sessionId: sessionRef.id,
            message: 'Your screen was modified by another request — try that again.',
            suggestedActions: null,
            screened: false,
            error: true,
            errorReason: 'concurrent_modification',
          });
        }
        throw txErr;
      }
    }

    // 16. Shadow log (fire-and-forget). The scratchpad lives ONLY here — never
    //     in the response or the session doc.
    logConversation({
      userId: user.uid,
      agentId: null,
      battleId: null,
      archetype: null,
      gameMode: 'research',
      exchangeNumber: messagesUsed + 1,
      userMessage: sanitizedMessage,
      agentMessage: message,
      scratchpad: cleanScratchpad,
      directive: null,
      suggestedActions,
      elicitationTarget: null,
      anchorContext: null,
      hasDirective: false,
      tokenUsage: null,
      researchSessionId: sessionRef.id,
      screenSpec: shouldScreen ? responsePayload.appliedSpec : null,
      matchCount: shouldScreen ? responsePayload.matchCount : null,
    }).catch(() => {});

    // 17. Respond
    return res.status(200).json(responsePayload);
  } catch (error) {
    // Catch-all — always return valid JSON in the shape the client expects.
    console.error('[ScreenerChat] Error:', error);
    const isAbort = error?.name === 'AbortError';
    return res.status(isAbort ? 504 : 500).json({
      sessionId: null,
      message: isAbort
        ? 'That took too long — could you try sending that again?'
        : 'Something went wrong on my end. Try again in a moment.',
      suggestedActions: null,
      screened: false,
      error: true,
    });
  }
}
