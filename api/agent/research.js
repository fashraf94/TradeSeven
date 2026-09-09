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
// `chatBudgetUsed` nor the League day store is touched, and the only field any
// write here touches is `chatExchanges`.
//
// `agentBattles` is NOT a composition-protected store — but this route's
// `tx.update` is handle-form, which the deny-by-default scanner resolves as
// `unresolved`, so it carries an entry in
// `compositionProtectedStoresAllowlist.json` with a note saying exactly that
// (review C-7: an earlier draft of this header claimed the file was untouched,
// which was false and would have told a future reader the fence surface was
// clean when the branch's first hunk is that file).

import { randomUUID } from 'node:crypto';
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
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Already on the agent's equipped watchlist — Equip has nothing to offer (spec §3). */
function isAlreadyEquipped(battle, symbol) {
  const tickers = battle?.agentContext?.equippedWatchlist?.tickers;
  if (!Array.isArray(tickers)) return false;
  const wanted = String(symbol).toUpperCase();
  return tickers.some((t) => typeof t === 'string' && t.trim().toUpperCase() === wanted);
}

/** A Firestore document id: one path segment, no `/`, no `.` traversal. */
const DOC_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const isValidDocId = (v) => typeof v === 'string' && DOC_ID_RE.test(v);

/** The longest ticker the platform admits, with room to spare (watchlistEquip.js caps at 12). */
export const MAX_SYMBOL_LENGTH = 16;

/**
 * The charset a symbol must satisfy BEFORE it reaches an outbound URL.
 *
 * The universe check already resolves the client's bytes to the DOC's own
 * spelling, and the battle-creation choke point (`watchlistEquip.js`) constrains
 * that to `[A-Z0-9.-]`. This assertion makes the route self-contained rather
 * than dependent on a distant module staying strict (review E-8): the string
 * that reaches `getStockAnalysisData` — and therefore the EODHD URL, which does
 * no encoding of its own — is checked here.
 */
const TICKER_RE = /^[A-Za-z0-9.-]{1,16}$/;

/**
 * The fundamentals mirror for one name: the cache brief first (it rides every
 * active battle's cache doc under any non-`off` grounding mode, D-107), then the
 * rankings entry the cron reads anyway. NEVER the screener — one map hit, no
 * Gemma, no spec (item 4). A hot-bench or equipped name has no brief (hazard
 * 15), which is exactly why the second read exists; when both are empty the card
 * simply has no fundamentals section.
 */
export async function readCacheBrief(db, battleId, symbol) {
  try {
    const cacheSnap = await db.collection('voiceLayerCache').doc(battleId).get();
    if (!cacheSnap.exists) return { brief: null, updatedAt: null };
    const cache = cacheSnap.data() || {};
    const briefs = [...(cache.portfolioBriefs || []), ...(cache.benchBriefs || [])];
    const brief = briefs.find((b) => b && b.symbol === symbol) || null;
    const ts = cache.updatedAt;
    const updatedAt = typeof ts?.toDate === 'function' ? ts.toDate().toISOString()
      : typeof ts === 'string' ? ts
        : typeof ts === 'number' ? new Date(ts).toISOString() : null;
    return { brief, updatedAt };
  } catch (err) {
    console.warn(`[agent/research] cache read failed for ${symbol}:`, err.message);
    return { brief: null, updatedAt: null };
  }
}

export async function readFundamentals(db, brief, symbol) {
  if (brief?.fundamentals) return brief.fundamentals;
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
    // `daily` ONLY (review A-7b / E-2, discovery hazard 2). The `price` field is
    // uncached EODHD on EVERY call, so requesting it made "no EODHD call unless
    // the cache is cold" (spec §6) and the route's own "A READ, NOT A FETCH"
    // false, and made a research tap cost a billed external call per request
    // whether or not it won the cap. The daily series is L1-cached 5 min and
    // L2-cached 4 h; the quote comes from the cache brief instead (see below).
    const data = await getStockAnalysisData(symbol, { fields: ['daily'] });
    const daily = data?.daily || null;
    return {
      indicators: daily ? calculateAllIndicators(daily) : null,
      lastClose: Array.isArray(daily) && daily.length ? daily[0]?.close ?? null : null,
      candleDate: Array.isArray(daily) && daily.length ? daily[0]?.date ?? null : null,
    };
  } catch (err) {
    console.warn(`[agent/research] market data fetch failed for ${symbol}:`, err.message);
    return { indicators: null, lastClose: null, candleDate: null };
  }
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit (the debate route's shape: a data read).
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 3. Auth — the uid comes from the token, never the body.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time. Dark ⇒ the route does not exist.
  //
  // AFTER auth, deliberately (review E-3): the flag's 404 in front of the auth
  // check answers an ANONYMOUS caller differently while dark (404) and while
  // lit (401), which is a free oracle on an unreleased feature's rollout state.
  // file-directive.js auths first for the same reason.
  if (!SHOW_IT_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 5. Body.
  //
  // THREE SHAPES, NOT ONE (review E-4 / E-5). Presence is not enough:
  //   · an id with a `/` in it either THROWS synchronously out of
  //     `collection().doc()` (an odd component count) or silently resolves to
  //     an arbitrary NESTED document — and the same string is reused as the
  //     voiceLayerCache doc id. equip-watchlist.js validates its ids before
  //     touching Firestore; this route now does too.
  //   · `symbol` is free text from the client and was echoed back verbatim in
  //     the 404 body with no length cap — the only uncapped free-text field in
  //     this route family (chat.js caps its message at 2000 chars).
  const body = req.body || {};
  const { agentId, battleId, symbol } = body;
  if (!nonEmpty(agentId) || !nonEmpty(battleId) || !nonEmpty(symbol)) {
    return res.status(400).json({ error: 'agentId, battleId and symbol are required' });
  }
  if (!isValidDocId(agentId) || !isValidDocId(battleId)) {
    return res.status(400).json({ error: 'agentId and battleId must be document ids' });
  }
  const requestedSymbol = String(symbol).trim().slice(0, MAX_SYMBOL_LENGTH);

  const db = getFirebaseAdmin();

  let battle;
  let battleRef;
  try {
    battleRef = db.collection('agentBattles').doc(battleId);
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
  const canonical = canonicalUniverseSymbol(battle, requestedSymbol);
  if (!canonical || !TICKER_RE.test(canonical)) {
    return res.status(404).json({ error: `${requestedSymbol} is not in this battle` });
  }

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
  const [{ indicators, lastClose, candleDate }, { brief, updatedAt }] = await Promise.all([
    readTechnicals(canonical),
    readCacheBrief(db, battleId, canonical),
  ]);
  const fundamentals = await readFundamentals(db, brief, canonical);

  // THE QUOTE: the cache's own 15-minute price, at the cache doc's vintage, when
  // the battle has a brief for this name; otherwise the newest daily close,
  // labelled as a close. Two sources, never mixed, each carrying its own date —
  // and neither costs an external call (hazard 2).
  const quote = num(brief?.price) !== null && updatedAt
    ? { current: brief.price, asOf: updatedAt, candleDate }
    : { current: lastClose, fromClose: true, candleDate };

  // 12. The card, in code. The position is the book's own row when the name is
  //     held — the flattener the board and the debate route both read.
  const position = place === UNIVERSE_PLACE.BOOK
    ? (flattenPortfolioServer(battle.portfolio || {}) || []).find((p) => p && p.symbol === canonical) || null
    : null;
  const card = composeResearchCard({
    symbol: canonical,
    place,
    position,
    // The row's own held-since fallback, and the battle's starting price — the
    // second half of the canonical entry-price derivation (review A-2).
    deployedAt: battle.activatedAt ?? null,
    startingPrice: battle.portfolio?.startingPrices?.[canonical] ?? battle.startingPrices?.[canonical] ?? null,
    indicators,
    price: quote,
    fundamentals,
    // D-54's forward path. Spec §3: Equip is offered "when the name is not
    // already equipped" — and `universePlace` returns WATCHLIST for the hot
    // bench AND for the equipped watchlist, so `place` alone offered Equip on
    // names that are already equipped (review A-4). The membership check is the
    // rule; hazard 7's rival-held names are out of the roster upstream.
    equipAvailable: place === UNIVERSE_PLACE.WATCHLIST && !isAlreadyEquipped(battle, canonical),
  });

  // 13. One transaction: the count is re-read HERE, and the append happens in
  //     the same commit, so a race cannot produce a fourth card and a failure
  //     cannot consume a slot.
  try {
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(battleRef);
      if (!snap.exists) return { kind: 'battle_not_found' };
      const fresh = snap.data();
      // EVERY GATE IS RE-CHECKED HERE, NOT JUST THE CAP (review C-5 / E-1).
      // The pre-read above is separated from this commit by the data reads, and
      // `agent-evaluate` flips a battle to `completed` on its own schedule — so
      // re-reading only the count appended a card to a settled battle whenever a
      // tap and the close cron overlapped. file-directive.js makes all four
      // checks inside its transaction; this now does the same, and the route's
      // claim to be authoritative is true of every gate rather than one.
      if (fresh.ownerId !== user.uid) return { kind: 'forbidden' };
      if (fresh.status !== 'active') return { kind: 'not_active' };
      if (!agentBelongsToBattle(fresh, agentId)) return { kind: 'forbidden' };
      if (!canonicalUniverseSymbol(fresh, canonical)) return { kind: 'left_universe' };
      const used = countResearchUsed(fresh.chatExchanges);
      if (used >= RESEARCH_CAP) return { kind: 'exhausted', used };

      const exchange = buildResearchExchange({ card, symbol: canonical, agentId });
      tx.update(battleRef, { chatExchanges: FieldValue.arrayUnion(exchange) });
      return { kind: 'shown', used: used + 1, exchange };
    });

    if (outcome.kind === 'battle_not_found') return res.status(404).json({ error: 'Battle not found' });
    if (outcome.kind === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
    if (outcome.kind === 'not_active') return res.status(409).json({ error: 'Battle is not active' });
    if (outcome.kind === 'left_universe') {
      return res.status(404).json({ error: `${canonical} is not in this battle` });
    }
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
export function buildResearchExchange({ card, symbol, agentId, now = new Date(), researchId = randomUUID() }) {
  return {
    messageType: RESEARCH_MESSAGE_TYPE,
    // THE UNIQUE ID IS LOAD-BEARING, not decoration (review CO-1).
    // `FieldValue.arrayUnion` does not append an element that is already
    // present by DEEP EQUALITY. Every other field of two cards for the same
    // symbol can coincide — same symbol, same agent, the same card composed off
    // the same warm cache, and an ISO timestamp is only millisecond-precise —
    // so two concurrent taps could produce deep-equal objects, the second write
    // would be a silent no-op, and the route would report a slot spent that the
    // doc does not hold. `file-directive.js` avoids this by construction, since
    // every filed exchange carries a randomUUID directiveThreadId; this is the
    // same guarantee, made explicit.
    researchId,
    symbol,
    agentId: agentId ?? null,
    card,
    agentResponse: '',
    suggestedActions: null,
    timestamp: now.toISOString(),
  };
}
