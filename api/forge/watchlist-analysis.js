// api/forge/watchlist-analysis.js
//
// Analysis Hand-off — Phase 2: the cohort analysis chat endpoint
// (route /api/forge/watchlist-analysis).
//
// Conversational reasoning over a FIXED cohort (a saved watchlist). The backend
// assembles a deterministic cohort digest (api/_utils/cohortDigest.js); Gemma
// (mode 'set_analysis') converses over it — describing what the set shares and
// how winners vs losers differ, never causally, never as a forecast.
//
// Mirrors api/screener/chat.js (auth, session lifecycle, the Gemma call, the
// deterministic-core + Gemma-narration split, explicit field-picking, and the
// _scratchpad-to-shadow-log-only discipline). Differences:
//   * Sessions live in their own analysisSessions collection, scoped to BOTH
//     the user and the watchlist. Accessed only here via the Admin SDK (like
//     researchSessions), so no firestore.rules change is needed.
//   * Two data tiers, both zero-EODHD: Tier-1 (the indexIntelligence/
//     stockRankings doc the screener already loads) is always assembled; Tier-2
//     (per-ticker peerRankings raw fundamentals) is read LAZILY — only on a
//     fundamentals-flavoured turn — to keep the common case to a single read and
//     a lean prompt.
//   * An "open" turn (no userMessage) returns the Tier-1 digest + a deterministic
//     opening (no model call, no budget burn) so the surface paints immediately.
//
// Budget: 30 messages/session — SOFT (graceful "fresh thread" message, not an
// error). Rate limit: 10 req/60s per user.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { buildCohortDigest } from '../_utils/cohortDigest.js';
import { extractTickerSymbols } from '../_utils/watchlistEquip.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logConversation } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 30 };

const MESSAGE_BUDGET = 30;
const HISTORY_WINDOW = 10; // max turns fed back into the model
const COHORT_MAX = 40;     // watchlist ticker cap (matches the write path)

// A fundamentals-flavoured turn triggers the lazy Tier-2 read. The Tier-1 digest
// (sector/return/momentum) answers "what do these share"; only raw-fundamental
// questions need peerRankings, so the heuristic keeps the common turn Tier-1-only.
const FUNDAMENTAL_KEYWORDS =
  /\b(p\/?e|valuation|multiple|cheap|expensive|margin|margins|revenue|sales|growth|debt|leverage|balance\s*sheet|solvency|liquidity|current\s*ratio|interest\s*coverage|ebitda|market\s*cap|cap\b|dividend|roe|roa|book\s*value|fundamental|fundamentals|earnings\s*beat|beat\s*rate|profitab)/i;

// ==================== HELPERS ====================

function toIso(ts) {
  if (!ts) return null;
  if (typeof ts === 'string') return ts;
  if (typeof ts.toDate === 'function') {
    try { return ts.toDate().toISOString(); } catch { return null; }
  }
  if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toISOString();
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

// Build symbol → stockRankings entry for the cohort (Tier-1).
function indexCohort(stocks, symbolSet) {
  const map = {};
  for (const s of stocks) {
    if (s && typeof s.symbol === 'string' && symbolSet.has(s.symbol)) map[s.symbol] = s;
  }
  return map;
}

// Lazy Tier-2: batch-read peerRankings/{ticker} for the cohort. Firestore 'in'
// caps at 30 per query, so chunk. Returns symbol → metrics object. Zero EODHD.
async function readPeerMetrics(db, symbols) {
  const out = {};
  for (let i = 0; i < symbols.length; i += 30) {
    const chunk = symbols.slice(i, i + 30);
    const snap = await db.collection('peerRankings').where('ticker', 'in', chunk).get();
    snap.forEach((doc) => {
      const d = doc.data();
      if (d && typeof d.ticker === 'string' && d.metrics) out[d.ticker] = d.metrics;
    });
  }
  return out;
}

// Deterministic opening narration from the Tier-1 digest (no model call).
function buildOpeningMessage(digest) {
  if (!digest || !digest.covered) {
    return "I couldn't find ranking data for these names yet — the daily job may still be updating. Check back shortly.";
  }
  const top = digest.sectors?.[0];
  const sectorBit = top ? ` ${top.name} is the largest group (${top.count} of ${digest.covered})` : '';
  const trendBit =
    digest.trend && (digest.trend.aboveCount || digest.trend.belowCount)
      ? `, and ${digest.trend.aboveCount} of ${digest.trend.aboveCount + digest.trend.belowCount} sit above their 200-day line`
      : '';
  return `Here's your ${digest.size}-name set.${sectorBit}${trendBit}. Ask me what they share, how their fundamentals compare, or what separates the winners from the laggards.`;
}

const OPENING_ACTIONS = [
  'What do these have in common?',
  'How do their P/Es compare?',
  'What separates the winners from the laggards?',
  'Which are the outliers?',
];

// ==================== HANDLER ====================

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { watchlistId, userMessage, sessionId: providedSessionId } = req.body || {};

  if (!isValidForgeId(watchlistId)) {
    return res.status(400).json({
      error: 'invalid_watchlist_id',
      message: `watchlistId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (providedSessionId != null && !/^[A-Za-z0-9_-]{1,128}$/.test(String(providedSessionId))) {
    return res.status(404).json({ error: 'Analysis session not found' });
  }

  const sanitizedMessage = sanitizeMessageIn(userMessage);
  const isOpen = sanitizedMessage.length === 0;

  const db = getFirebaseAdmin();

  try {
    // 1. Load the watchlist (ownership + soft-delete gone).
    const wlSnap = await db.collection('watchlists').doc(watchlistId).get();
    if (!wlSnap.exists) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }
    const watchlist = wlSnap.data();
    if (watchlist.userId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized for this watchlist' });
    }
    if (watchlist.deletedAt) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const symbols = extractTickerSymbols(watchlist.tickers).slice(0, COHORT_MAX);
    if (symbols.length === 0) {
      return res.status(200).json({
        sessionId: typeof providedSessionId === 'string' ? providedSessionId : null,
        message: 'This watchlist has no tickers yet — add some names and I can break the set down for you.',
        suggestedActions: null,
        digest: null,
        tier2Included: false,
      });
    }

    // 2. Load or create the session (scoped to user + watchlist).
    const sessionsCol = db.collection('analysisSessions');
    let sessionRef;
    let session;
    let isNewSession = false;

    if (providedSessionId) {
      sessionRef = sessionsCol.doc(String(providedSessionId));
      const snap = await sessionRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'Analysis session not found' });
      session = snap.data();
      if (session.userId !== user.uid) {
        return res.status(403).json({ error: 'Not authorized for this session' });
      }
      if (session.watchlistId !== watchlistId) {
        return res.status(400).json({ error: 'Session does not match this watchlist' });
      }
    } else {
      sessionRef = sessionsCol.doc();
      session = {
        userId: user.uid,
        watchlistId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messagesUsed: 0,
        messageBudget: MESSAGE_BUDGET,
        exchanges: [],
        status: 'active',
      };
      isNewSession = true;
    }

    const messagesUsed = session.messagesUsed || 0;
    const messageBudget = session.messageBudget || MESSAGE_BUDGET;

    // 3. Tier-1: read the rankings universe ONCE.
    const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
    if (!rankingsDoc.exists) {
      return res.status(503).json({
        error: 'Stock rankings not available. The daily ranking job may not have run yet.',
      });
    }
    const rankingsData = rankingsDoc.data();
    const rankingsBySymbol = indexCohort(rankingsData.stocks || [], new Set(symbols));
    const dataAsOf = toIso(rankingsData.updatedAt) || toIso(rankingsData.computedAt);

    // ── OPEN turn: deterministic digest + narration, no model call, no budget burn.
    if (isOpen) {
      const digest = buildCohortDigest({ symbols, rankingsBySymbol });
      const nowIso = new Date().toISOString();
      if (isNewSession) {
        await sessionRef.set({ ...session, updatedAt: nowIso });
      }
      return res.status(200).json({
        sessionId: sessionRef.id,
        message: buildOpeningMessage(digest),
        suggestedActions: OPENING_ACTIONS,
        digest,
        tier2Included: false,
        dataAsOf,
      });
    }

    // 4. Soft budget cap → graceful "fresh thread" message, NOT an error.
    if (messagesUsed >= messageBudget) {
      return res.status(200).json({
        sessionId: null, // signal the client to start a new session
        message: "We've covered a lot about this set. Start a fresh thread and we'll keep going.",
        suggestedActions: null,
        digest: null,
        tier2Included: false,
        sessionEnded: true,
      });
    }

    // 5. Lazy Tier-2: only on a fundamentals-flavoured turn.
    const wantsFundamentals = FUNDAMENTAL_KEYWORDS.test(sanitizedMessage);
    const peerMetricsBySymbol = wantsFundamentals ? await readPeerMetrics(db, symbols) : null;

    const digest = buildCohortDigest({ symbols, rankingsBySymbol, peerMetricsBySymbol });

    // 6. Conversation history (last HISTORY_WINDOW exchanges).
    const previousExchanges = (session.exchanges || []).slice(-HISTORY_WINDOW);
    const conversationHistory = previousExchanges.flatMap((ex) => [
      { role: 'user', content: ex.userMessage || '' },
      { role: 'assistant', content: ex.message || '' },
    ]);

    // 7. Assemble the set-analysis system prompt over the digest.
    const systemPrompt = buildVoiceLayerPrompt({
      mode: 'set_analysis',
      conversationHistory,
      analysisContext: { digest },
    });

    // 8. Call Gemma with a 25s timeout.
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

    // 8b. Gemma failure → graceful (this turn doesn't burn budget).
    if (!gemmaResult.success) {
      console.error('[WatchlistAnalysis] Gemma call failed:', gemmaResult.error);
      return res.status(gemmaResult.aborted ? 504 : 200).json({
        sessionId: sessionRef.id,
        message: 'I hit a snag analyzing that — could you ask again?',
        suggestedActions: null,
        digest,
        tier2Included: digest.tier2Included,
        error: true,
      });
    }

    // 9. Parse (MUST check parseError; never echo rawText).
    const parsed = parseVoiceLayerResponse(gemmaResult.content);
    if (parsed?.parseError === true) {
      console.error('[WatchlistAnalysis] parse failed:', parsed.errorReason);
      return res.status(200).json({
        sessionId: sessionRef.id,
        message: 'I hit a snag analyzing that — could you ask again?',
        suggestedActions: null,
        digest,
        tier2Included: digest.tier2Included,
        error: true,
        errorReason: `parse_${parsed.errorReason}`,
      });
    }

    // 10. Explicitly PICK fields — never spread the raw parsed Gemma object, so
    //     _scratchpad (and any stray fields) never reach the client or Firestore.
    const cleanScratchpad = sanitizeScratchpad(parsed._scratchpad);
    const message = sanitizeMessageOut(parsed.message, "Here's what the set shares.");
    const suggestedActions = sanitizeSuggestedActions(parsed.suggestedActions);

    const nowIso = new Date().toISOString();
    const exchange = {
      userMessage: sanitizedMessage,
      message,
      tier2Included: digest.tier2Included,
      timestamp: nowIso,
    };

    // 11. Persist. New session: set; continuing: transaction re-checks budget.
    if (isNewSession) {
      await sessionRef.set({
        ...session,
        exchanges: [exchange],
        messagesUsed: 1,
        updatedAt: nowIso,
      });
    } else {
      try {
        await db.runTransaction(async (tx) => {
          const freshSnap = await tx.get(sessionRef);
          if (!freshSnap.exists) throw new Error('__concurrency:session_disappeared');
          const fresh = freshSnap.data();
          if (fresh.userId !== user.uid) throw new Error('__concurrency:not_owner');
          if ((fresh.messagesUsed || 0) >= (fresh.messageBudget || MESSAGE_BUDGET)) {
            throw new Error('__concurrency:budget_consumed');
          }
          tx.update(sessionRef, {
            exchanges: FieldValue.arrayUnion(exchange),
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
          return res.status(409).json({
            sessionId: sessionRef.id,
            message: 'Your thread was modified by another request — try that again.',
            suggestedActions: null,
            digest,
            tier2Included: digest.tier2Included,
            error: true,
            errorReason: 'concurrent_modification',
          });
        }
        throw txErr;
      }
    }

    // 12. Shadow log (fire-and-forget). Scratchpad lives ONLY here.
    logConversation({
      userId: user.uid,
      agentId: null,
      battleId: null,
      archetype: null,
      gameMode: 'set_analysis',
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
      watchlistId,
      analysisSessionId: sessionRef.id,
      tier2Included: digest.tier2Included,
    }).catch(() => {});

    // 13. Respond.
    return res.status(200).json({
      sessionId: sessionRef.id,
      message,
      suggestedActions,
      digest,
      tier2Included: digest.tier2Included,
      dataAsOf,
    });
  } catch (error) {
    console.error('[WatchlistAnalysis] Error:', error);
    const isAbort = error?.name === 'AbortError';
    return res.status(isAbort ? 504 : 500).json({
      sessionId: null,
      message: isAbort
        ? 'That took too long — could you ask again?'
        : 'Something went wrong on my end. Try again in a moment.',
      suggestedActions: null,
      digest: null,
      tier2Included: false,
      error: true,
    });
  }
}
