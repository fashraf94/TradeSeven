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
import { buildCohortDigest, buildCohortRows, FUNDAMENTAL_FIELDS, FORWARD_FIELDS } from '../_utils/cohortDigest.js';
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
  /\b(p\/?e|valuations?|multiples?|cheap|expensive|margins?|revenues?|sales|growth|debt|leverage|balance\s*sheets?|solvency|liquidity|current\s*ratio|interest\s*coverage|ebitda|market\s*caps?\b|caps?\b|dividends?|roe|roa|book\s*value|fundamentals?|earnings\s*beat|beat\s*rate|profitab)/i;

// A forward-flavoured turn triggers the lazy Tier-3 read (estimatesCache/latest —
// one Firestore doc). Forward = analyst CONSENSUS only (attributed, never a model
// forecast). These keywords gate the read the way FUNDAMENTAL_KEYWORDS gates Tier-2;
// "grow|growth" overlaps Tier-2 intentionally — both tiers may load, but the
// deterministic SORT is decided by deriveFocusDimension's forward precedence.
const FORWARD_KEYWORDS =
  /\b(grow|growth|estimates?|expected|forecasts?|next\s*year|next\s*quarter|forward|consensus|analysts?|revisions?|upgrades?|downgrades?|outlook)\b/i;

// Piece C — characterization questions ("which are the outliers / what stands
// out / what separates them") should pull the fundamental tier too, so both the
// list and the (aggregate) narration can span technical AND fundamental axes.
const CHARACTERIZATION_KEYWORDS =
  /\b(outliers?|stands?\s*out|stand\s*outs?|separates?|set\s*apart|what\s*makes|differ|different|distinct|unusual|stand\s*apart)\b/i;

// Piece A — deterministic question→column map for the visible list's sort/
// highlight (NO model in the ranking loop). First match wins, most-specific
// first. Returns a row column key or null.
const FOCUS_DIMENSION_RULES = [
  [/\b(leverage|debt[\s/-]*(?:to[\s-]*)?equity|balance\s*sheet|solvency|indebted)/i, 'debtToEquity'],
  [/\b(200[\s-]?day|sma|trend|above\s+(?:the\s+)?(?:200|line)|below\s+(?:the\s+)?(?:200|line))/i, 'sma200_position'],
  [/\b(valuations?|p\/?e|multiples?|cheap|expensive)/i, 'trailingPE'],
  [/\b(margins?|profitab)/i, 'profitMarginTTM'],
  [/\b(revenue|sales|top[\s-]*line|growth)/i, 'revenueGrowthYOY'],
  [/\b(volatil|atr|choppy|swing)/i, 'atrPercentile'],
  [/\b(momentum)/i, 'momentumScore'],
  [/\b(returns?|performance|gainers?|laggards?|winners?|losers?|best|worst)/i, 'return1M'],
];

// Piece A (forward) — forward-qualified phrasing routes the list sort to a
// CONSENSUS column (real estimatesCache values; no model in the ranking loop).
// Checked BEFORE the trailing rules so "expected to grow next year" sorts by
// consensus growth, while a bare "growth"/"revenue growth" stays trailing
// (revenueGrowthYOY) — existing behaviour unchanged.
const FORWARD_FOCUS_RULES = [
  [/\b(consensus|forward|estimated|projected|expected|forecast(?:ed)?)\b[^.?!]*\bgrow/i, 'consensusGrowthNextYear'],
  [/\bgrow\w*\b[^.?!]*\b(next\s*year|next\s*quarter|forward|ahead|going\s*forward)\b/i, 'consensusGrowthNextYear'],
  [/\b(next\s*year|next\s*quarter)\b[^.?!]*\bgrow/i, 'consensusGrowthNextYear'],
  [/\b(revisions?|upgrades?|downgrades?|being\s*raised|being\s*cut|raised\s*or\s*cut)\b/i, 'emsPercentile'],
];

function deriveFocusDimension(message) {
  // Forward-qualified phrasing wins, so a forward question sorts by consensus.
  for (const [re, dim] of FORWARD_FOCUS_RULES) {
    if (re.test(message)) return dim;
  }
  for (const [re, dim] of FOCUS_DIMENSION_RULES) {
    if (re.test(message)) return dim;
  }
  return null;
}

// A focusDimension that is a fundamental field must force the lazy Tier-2 read,
// or the highlighted column would be all dashes.
function isFundamentalDimension(dim) {
  return typeof dim === 'string' && FUNDAMENTAL_FIELDS.includes(dim);
}

// A forward focusDimension must likewise force the lazy Tier-3 read (same
// no-empty-column guard) — its consensus column would otherwise be all dashes.
function isForwardDimension(dim) {
  return typeof dim === 'string' && FORWARD_FIELDS.includes(dim);
}

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

// Lazy Tier-3: read estimatesCache/latest ONCE (a single Firestore doc — cheaper
// than the chunked peerRankings reads) and project each cohort symbol's NESTED
// forward-consensus record into the FLAT shape FORWARD_FIELDS expects. Forward
// data is attributed analyst CONSENSUS, never a model forecast. Zero EODHD;
// read-only consumer of the cache. Returns symbol → flat map, or null when the
// cache doc is missing (the tier then stays hidden — no empty columns).
async function readEstimates(db, symbols) {
  // The cron stores raw EODHD trend fields (forwardEstimates avg/growth/
  // numAnalysts) un-coerced — they arrive as numeric STRINGS. Coerce to finite
  // numbers (or null) so the downstream stats/sort stay numeric.
  const num = (v) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // EODHD trend growth is a decimal fraction ("0.081" = 8.1%); scale to percent so
  // consensus growth lands on the same convention as trailing revenueGrowthYOY (the
  // formatters treat growth values as already-percent).
  const pct = (v) => {
    const n = num(v);
    return n == null ? null : Math.round(n * 1000) / 10; // fraction → % (1 dp; avoids FP noise)
  };

  const snap = await db.collection('estimatesCache').doc('latest').get();
  if (!snap.exists) return null;
  const stocks = snap.data()?.stocks;
  if (!stocks || typeof stocks !== 'object') return null;
  const out = {};
  for (const s of symbols) {
    const e = stocks[s];
    if (!e) continue;
    const fe = e.forwardEstimates || {};
    const spread = e.estimateSpread || {};
    out[s] = {
      consensusGrowthNextYear: pct(fe.nextYear?.growth),
      consensusGrowthCurrentYear: pct(fe.currentYear?.growth),
      numAnalystsNextYear: num(fe.nextYear?.numAnalysts),
      rsr: num(e.rsr),                       // 0..1 — share of 30-day EPS revisions that were UP
      emsPercentile: num(e.emsPercentile),   // 0..100 — revision-momentum percentile (in-sector)
      estimateSpread: num(spread.currentYear), // % — (high−low)/|avg| dispersion of estimates
    };
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
        tier3Included: false,
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
      const rows = buildCohortRows({ symbols, rankingsBySymbol }); // Tier-1 only on open
      const nowIso = new Date().toISOString();
      if (isNewSession) {
        await sessionRef.set({ ...session, updatedAt: nowIso });
      }
      return res.status(200).json({
        sessionId: sessionRef.id,
        message: buildOpeningMessage(digest),
        suggestedActions: OPENING_ACTIONS,
        digest,
        rows,
        focusDimension: null, // no question yet → default sort applies
        tier2Included: false,
        tier3Included: false,
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
        rows: null,
        focusDimension: null,
        tier2Included: false,
        tier3Included: false,
        sessionEnded: true,
      });
    }

    // 5. Which list column does this question imply (deterministic; no model)?
    const focusDimension = deriveFocusDimension(sanitizedMessage);

    // 6. Lazy Tier-2: fundamentals-flavoured OR characterization (C) OR a
    //    fundamental focusDimension (so its highlighted column has data).
    const wantsFundamentals =
      FUNDAMENTAL_KEYWORDS.test(sanitizedMessage) ||
      CHARACTERIZATION_KEYWORDS.test(sanitizedMessage) ||
      isFundamentalDimension(focusDimension);
    const peerMetricsBySymbol = wantsFundamentals ? await readPeerMetrics(db, symbols) : null;

    // 6b. Lazy Tier-3 (forward analyst consensus): forward-flavoured OR a forward
    //     focusDimension (same no-empty-column guard). One estimatesCache/latest
    //     doc read — zero EODHD, read-only consumer of the cache.
    const wantsForward =
      FORWARD_KEYWORDS.test(sanitizedMessage) ||
      isForwardDimension(focusDimension);
    const forwardBySymbol = wantsForward ? await readEstimates(db, symbols) : null;

    const digest = buildCohortDigest({ symbols, rankingsBySymbol, peerMetricsBySymbol, forwardBySymbol });
    // Per-name rows for the visible list (A/D). UI-only — NEVER added to the
    // prompt (that's B). The prompt below still sees only { digest }.
    const rows = buildCohortRows({ symbols, rankingsBySymbol, peerMetricsBySymbol, forwardBySymbol });

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
        rows: null, // keep the prior list on a transient error (client: if (data.rows) …)
        focusDimension: null,
        tier2Included: digest.tier2Included,
        tier3Included: digest.tier3Included,
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
        rows: null,
        focusDimension: null,
        tier2Included: digest.tier2Included,
        tier3Included: digest.tier3Included,
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
      tier3Included: digest.tier3Included,
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
            rows: null,
            focusDimension: null,
            tier2Included: digest.tier2Included,
            tier3Included: digest.tier3Included,
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
      tier3Included: digest.tier3Included,
    }).catch(() => {});

    // 13. Respond.
    return res.status(200).json({
      sessionId: sessionRef.id,
      message,
      suggestedActions,
      digest,
      rows,
      focusDimension,
      tier2Included: digest.tier2Included,
      tier3Included: digest.tier3Included,
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
      rows: null,
      focusDimension: null,
      tier2Included: false,
      tier3Included: false,
      error: true,
    });
  }
}
