// api/agent/research.js
//
// POST /api/agent/research — SHOW IT (Phase C §2, D-116 → D-122).
//
// A READ, NOT A FETCH, wherever the data already sits, and NO MODEL CALL at all.
// The route validates the request, takes a slot under the cap, reads the two
// data paths the platform already runs, composes the card in code and writes one
// `research` exchange. What comes back is what was written.
//
// THE ORDER (§2, from the shipped routes' own order):
//   1  security middleware + rate limit        (debate.js:32)
//   2  method
//   3  THE FLAG — 404 while SHOW_IT_ENABLED is dark, so the route does not
//      exist as far as any caller is concerned (§6)
//   4  auth — the uid from the token, never the body (chat.js:398)
//   5  body
//   6  battle read + ownerId                   (debate.js:65-74)
//   7  battle active + agent-belongs-to-battle — the SHARED predicate
//   8  the universe check                      (hazard 6)
//   9  the cap, PRE-CHECKED here and RE-READ inside the transaction (below)
//  10  technicals — the warm cache path debate.js uses, widened to the universe
//  11  fundamentals — the cache brief's mirror, else one stockRankings read.
//      NO SCREENER CALL (item 4: the mirror covers every field the card needs)
//  12  the card, composed by code
//  13  one transaction: re-read the count, append the exchange, return it
//
// THE CAP IS PRE-CHECKED AND THEN RE-CHECKED, AND ONLY THE SECOND ONE COUNTS
// (Sol C-2). The pre-check exists to fail a fourth tap fast, before spending an
// EODHD call on a card that cannot be written. It is NOT authorization: two taps
// racing for one slot both pass it, both fetch, and the TRANSACTION decides —
// one card is written, the other request gets `research_exhausted`. A
// transaction that throws writes nothing and therefore consumes no slot.
//
// NO MESSAGE IS CHARGED (D-118). The message budget is for influence; a
// research read is not influence, and it has its own scarcity. Neither
// `chatBudgetUsed` nor the League day store is touched — nothing here writes to
// a protected store, so `compositionProtectedStoresAllowlist.json` is unchanged.

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { agentBelongsToBattle } from '../_utils/agentBattleBinding.js';
import { getStockAnalysisData } from '../_utils/marketDataCache.js';
import { calculateAllIndicators } from '../_utils/technicalCalculations.js';
// §1-permitted: reading and CALLING a fenced module's exported functions. The
// book's flattener is the one the debate route already uses; nothing fenced is
// edited and no scoring behaviour changes.
import { flattenPortfolioServer } from '../_utils/agentScoring.js';
import { composeResearchCard } from '../_utils/researchCard.js';
import { canonicalUniverseSymbol, universePlace, UNIVERSE_PLACE } from '../../src/data/battleUniverse.js';
import { RESEARCH_MESSAGE_TYPE } from '../../src/data/decisionRecord.js';
import {
  RESEARCH_CAP,
  RESEARCH_EXHAUSTED_STATUS,
  countResearchUsed,
  researchRemaining,
} from '../../src/data/researchCap.js';
import { SHOW_IT_ENABLED } from '../../src/config/featureFlags.js';

// Sized for the COLD path, not the warm one (hazard 10): L1 is per warm
// instance, so a first call in a fresh instance pays the EODHD daily fetch
// (the module's own figure is 2-4 s for its multi-call bundle) plus the
// uncached real-time quote, then two Firestore reads and one transaction. The
// file-directive route budgets 10 s for a transaction and no model; this adds
// the external fetch, and 15 is debate.js's own budget for the same fetch.
export const config = { maxDuration: 15 };

/** The statuses this route answers with. */
export const RESEARCH_STATUS = Object.freeze({
  SHOWN: 'shown',
  EXHAUSTED: RESEARCH_EXHAUSTED_STATUS,
});

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * The fundamentals mirror for one name: the cache brief first (it rides every
 * active battle's cache doc under any non-`off` grounding mode, D-107), then the
 * rankings entry the cron reads anyway. NEVER the screener — one map hit, no
 * Gemma, no spec (item 4). A hot-bench or equipped name has no brief (hazard
 * 15), which is exactly why the second read exists; when both are empty the card
 * simply has no fundamentals section.
 */
export async function readFundamentals(db, battleId, symbol) {
  try {
    const cacheSnap = await db.collection('voiceLayerCache').doc(battleId).get();
    if (cacheSnap.exists) {
      const cache = cacheSnap.data() || {};
      const briefs = [...(cache.portfolioBriefs || []), ...(cache.benchBriefs || [])];
      const brief = briefs.find((b) => b && b.symbol === symbol);
      if (brief?.fundamentals) return brief.fundamentals;
    }
  } catch (err) {
    console.warn(`[agent/research] cache read failed for ${symbol}:`, err.message);
  }
  try {
    const snap = await db.collection('indexIntelligence').doc('stockRankings').get();
    if (!snap.exists) return null;
    const entry = (snap.data()?.stocks || []).find((s) => s && s.symbol === symbol);
    return entry?.fundamentals || null;
  } catch (err) {
    console.warn(`[agent/research] rankings read failed for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * The technicals: the SAME path debate.js uses (`getStockAnalysisData` +
 * `calculateAllIndicators`), its book-only guard replaced by the universe check
 * above. The window is the shipped 30 calendar days, so MACD, SMA50, SMA200 and
 * EMA50 arrive NULL and the card omits them — D-120's separate fix widens the
 * fetch; this build renders nothing rather than a placeholder (hazard 1).
 */
export async function readTechnicals(symbol) {
  try {
    const data = await getStockAnalysisData(symbol, { fields: ['daily', 'price'] });
    const daily = data?.daily || null;
    return {
      indicators: daily ? calculateAllIndicators(daily) : null,
      price: {
        ...(data?.price || {}),
        candleDate: Array.isArray(daily) && daily.length ? daily[0]?.date ?? null : null,
      },
    };
  } catch (err) {
    console.warn(`[agent/research] market data fetch failed for ${symbol}:`, err.message);
    return { indicators: null, price: null };
  }
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit (the debate route's shape: a data read).
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 3. THE FLAG, read at call time. Dark ⇒ the route does not exist.
  if (!SHOW_IT_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 4. Auth — the uid comes from the token.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 5. Body.
  const body = req.body || {};
  const { agentId, battleId, symbol } = body;
  if (!nonEmpty(agentId) || !nonEmpty(battleId) || !nonEmpty(symbol)) {
    return res.status(400).json({ error: 'agentId, battleId and symbol are required' });
  }

  const db = getFirebaseAdmin();
  const battleRef = db.collection('agentBattles').doc(battleId);

  let battle;
  try {
    const snap = await battleRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Battle not found' });
    battle = snap.data();
  } catch (err) {
    console.error('[agent/research] battle read failed:', err.message);
    return res.status(500).json({ error: 'Research failed' });
  }

  // 6-7. Owner, active, and the agent's binding — the shared predicate.
  if (battle.ownerId !== user.uid) return res.status(403).json({ error: 'Forbidden' });
  if (battle.status !== 'active') return res.status(409).json({ error: 'Battle is not active' });
  if (!agentBelongsToBattle(battle, agentId)) return res.status(403).json({ error: 'Forbidden' });

  // 8. The universe check. A name that has LEFT the universe (the hot bench is
  //    rebuilt mid-tick) gets an honest 404 rather than a card about a name the
  //    battle no longer holds.
  const canonical = canonicalUniverseSymbol(battle, symbol);
  if (!canonical) return res.status(404).json({ error: `${String(symbol).trim()} is not in this battle` });

  // 9. The cap, pre-checked. NOT authorization — the transaction below re-reads
  //    it and is the authority (Sol C-2).
  const usedBefore = countResearchUsed(battle.chatExchanges);
  if (usedBefore >= RESEARCH_CAP) {
    return res.status(409).json({
      status: RESEARCH_STATUS.EXHAUSTED,
      used: usedBefore,
      remaining: 0,
      cap: RESEARCH_CAP,
    });
  }

  // 10-11. The two data paths, in parallel — neither depends on the other.
  const place = universePlace(battle, canonical);
  const [{ indicators, price }, fundamentals] = await Promise.all([
    readTechnicals(canonical),
    readFundamentals(db, battleId, canonical),
  ]);

  // 12. The card, in code. The position is the book's own row when the name is
  //     held — the flattener the board and the debate route both read.
  const position = place === UNIVERSE_PLACE.BOOK
    ? (flattenPortfolioServer(battle.portfolio || {}) || []).find((p) => p && p.symbol === canonical) || null
    : null;
  const card = composeResearchCard({
    symbol: canonical,
    place,
    position,
    // The row's own held-since fallback, so the card and the board agree.
    deployedAt: battle.activatedAt ?? null,
    indicators,
    price,
    fundamentals,
    // D-54's forward path, with hazard 7's exception: Equip is offered only for
    // a name that is NOT already on the board or the bench the agent can reach.
    equipAvailable: place === UNIVERSE_PLACE.WATCHLIST,
  });

  // 13. One transaction: the count is re-read HERE, and the append happens in
  //     the same commit, so a race cannot produce a fourth card and a failure
  //     cannot consume a slot.
  try {
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(battleRef);
      if (!snap.exists) return { kind: 'battle_not_found' };
      const fresh = snap.data();
      const used = countResearchUsed(fresh.chatExchanges);
      if (used >= RESEARCH_CAP) return { kind: 'exhausted', used };

      const exchange = buildResearchExchange({ card, symbol: canonical, agentId });
      tx.update(battleRef, { chatExchanges: FieldValue.arrayUnion(exchange) });
      return { kind: 'shown', used: used + 1, exchange };
    });

    if (outcome.kind === 'battle_not_found') return res.status(404).json({ error: 'Battle not found' });
    if (outcome.kind === 'exhausted') {
      return res.status(409).json({
        status: RESEARCH_STATUS.EXHAUSTED,
        used: outcome.used,
        remaining: researchRemaining(outcome.used),
        cap: RESEARCH_CAP,
      });
    }
    return res.status(200).json({
      status: RESEARCH_STATUS.SHOWN,
      card: outcome.exchange.card,
      // The counts the client RECONCILES to (Sol C-2): the client never keeps an
      // optimistic increment, so these — or the next battle snapshot — are the
      // only things that move its door.
      used: outcome.used,
      remaining: researchRemaining(outcome.used),
      cap: RESEARCH_CAP,
    });
  } catch (err) {
    console.error('[agent/research] transaction failed:', err.message);
    return res.status(500).json({ error: 'Research failed' });
  }
}

/**
 * The persisted exchange (§3, D-121).
 *
 * NO `groundingVersion` — not 1, not 0. A research card is platform data, not a
 * grounded narrator turn, and the marker is what would put it in the narrator's
 * EARLIER MESSAGES block as the character's own earlier words (Sol C-1). It
 * reaches the grounded prompt only through the typed PLATFORM RESEARCH block.
 *
 * NO `userMessage` — nobody typed anything; the user tapped a chip or a door.
 * NO `agentResponse` — the character did not speak this turn (V1: the card is
 * not narrated). NO `suggestedActions` (hazard 4).
 */
export function buildResearchExchange({ card, symbol, agentId, now = new Date() }) {
  return {
    messageType: RESEARCH_MESSAGE_TYPE,
    symbol,
    agentId: agentId ?? null,
    card,
    agentResponse: '',
    suggestedActions: null,
    timestamp: now.toISOString(),
  };
}
