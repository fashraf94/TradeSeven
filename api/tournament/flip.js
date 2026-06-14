// api/tournament/flip.js
//
// P1b — POST /api/tournament/flip. Owner-only direction flip of one pick
// (long ⇄ short), capped at TOURNAMENT_TUNING.FLIP_CAP_PER_DAY per ET day
// via the ratified flipCountDate shape addition (Intl-based reset — the
// counter restarts when the stored date is not today's ET date).
//
// Two branches (Spec §1.1 flip rules):
// - MARKET OPEN: the live leg closes AT the current price — its bankedScore
//   is computed here by the canonical scorer — and the new leg opens at that
//   same price (BASELINE_SOURCE.FLIP_MARKET_OPEN) with fresh per-leg
//   thresholds (empty thresholdHistory).
// - MARKET CLOSED: the live leg closes bank-pending (closedAt set,
//   bankedScore OMITTED — not null) and the new leg opens with a null
//   baseline (FLIP_MARKET_CLOSED); the next banking pass settles both from
//   the day's open.
//
// SIGNAL CAPTURE RIDER, EVENT #4 (Addendum A §4 row 4): the leg mutation and
// the public feed event commit in ONE awaited transaction update — the feed
// entry carries writer fields ({symbol, from, to, timestamp, flipPrice|null,
// bankedLegScore|null, legIndexClosed, legIndexOpened}; display strings stay
// client-side), appended to the group-doc `feed` capped at 50.
//
// PREVIEW TIME-CONTROL: `forceMarketState: 'open' | 'closed'` overrides the
// ET-clock branch ONLY when the request carries a valid admin secret
// (isAdminSecretValid — never writes a response); without it the flag is
// silently ignored and the real clock decides. Production behavior is
// unreachable without the secret.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isAdminSecretValid } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { isMarketOpenAt, formatEtDate } from '../_utils/tournamentTime.js';
import { fetchQuoteForSymbol } from '../_utils/tournamentPrices.js';
import { scoreLeg, resolveBaseATR, loadAtrPercentiles } from '../_utils/tournamentUserScoring.js';
import { isCryptoSymbol } from '../_utils/marketDataCache.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  LEG_DIRECTION,
  BASELINE_SOURCE,
  TOURNAMENT_TUNING,
  GROUP_FEED_CAP,
  createLeg,
} from '../../src/constants/leagueTournament.js';
import {
  ledgerRef,
  detectUserDoubleDownEvents,
  buildUserDoubleDownWrites,
  readOwnerAgentMap,
} from '../_utils/tournamentAgentLedger.js';

export const config = { maxDuration: 15 };

const SENTINEL_PREFIX = '__flip:';
const SENTINEL_TO_HTTP = Object.freeze({
  group_not_found:  [404, 'group_not_found',  'Tournament group not found.'],
  not_battle:       [409, 'not_battle',       'Flips require a group in battle.'],
  not_member:       [403, 'not_member',       'You are not a member of this group.'],
  pick_not_found:   [404, 'pick_not_found',   'That symbol is not one of your picks.'],
  leg_already_closed: [409, 'leg_already_closed', 'The live leg is already closed — banking will settle it.'],
  flip_cap_reached: [409, 'flip_cap_reached', `Flip limit reached (${TOURNAMENT_TUNING.FLIP_CAP_PER_DAY} per trading day).`],
});

function sentinel(code, detail) {
  const err = new Error(SENTINEL_PREFIX + code);
  err.detail = detail;
  return err;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  const odUserId = user.uid;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId } = body;
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }
  if (!symbol) {
    return res.status(400).json({ error: 'invalid_symbol', message: 'symbol is required.' });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const etDate = formatEtDate(now);

  const forced = body.forceMarketState;
  const forceHonored = (forced === 'open' || forced === 'closed') && isAdminSecretValid(req);
  const marketOpen = forceHonored ? forced === 'open' : isMarketOpenAt(now);

  try {
    const db = getFirebaseAdmin();

    // Open-branch inputs are fetched BEFORE the transaction (no network
    // inside a tx): the flip price and the symbol's baseATR.
    let flipPrice = null;
    let quoteOpen = null;
    let baseATR = null;
    if (marketOpen) {
      const [quote, atrPercentiles] = await Promise.all([
        fetchQuoteForSymbol(symbol),
        // The rankings doc refreshes once daily — the short cache spares a
        // large-doc read per flip without risking staleness that matters.
        loadAtrPercentiles(db, { cacheMs: 10 * 60 * 1000 }),
      ]);
      // The flip executes AT this price: require the raw close (the live
      // last price). The current ?? previousClose fallback is fine for
      // close-of-day scoring but would silently execute a flip at the PRIOR
      // session's price.
      if (!Number.isFinite(quote?.close)) {
        return res.status(502).json({
          error: 'price_unavailable',
          message: `No live price for ${symbol} — try again shortly.`,
        });
      }
      flipPrice = quote.close;
      quoteOpen = quote.open;
      baseATR = resolveBaseATR(symbol, atrPercentiles) ?? (isCryptoSymbol(symbol) ? 5.0 : 2.5);
    }

    // D-1 (user-side double-down): the user's own agentId, from the immutable
    // agent-draft stream — a plain read BEFORE the transaction (the shared
    // helper degrades to {} on failure; the flip never blocks on it).
    const ownAgentId = (await readOwnerAgentMap(db, groupId))[odUserId] || null;

    const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);

    const summary = await db.runTransaction(async (tx) => {
      const groupSnap = await tx.get(groupRef);
      if (!groupSnap.exists) throw sentinel('group_not_found');
      const group = groupSnap.data();
      if (group.status !== GROUP_STATUS.BATTLE) throw sentinel('not_battle');

      const players = JSON.parse(JSON.stringify(group.players || []));
      const player = players.find(p => p.odUserId === odUserId);
      if (!player) throw sentinel('not_member');

      const pick = (player.picks || []).find(p => p.symbol === symbol);
      if (!pick) throw sentinel('pick_not_found');

      // Daily cap — flipCountDate resets the counter across ET midnight.
      const effectiveCount = pick.flipCountDate === etDate ? (pick.flipCountToday || 0) : 0;
      if (effectiveCount >= TOURNAMENT_TUNING.FLIP_CAP_PER_DAY) throw sentinel('flip_cap_reached');

      const legIndexClosed = pick.legs.length - 1;
      const liveLeg = pick.legs[legIndexClosed];
      if (!liveLeg || liveLeg.closedAt !== undefined) throw sentinel('leg_already_closed');

      const from = liveLeg.direction;
      const to = from === LEG_DIRECTION.LONG ? LEG_DIRECTION.SHORT : LEG_DIRECTION.LONG;

      let bankedLegScore = null;
      if (marketOpen) {
        // An intraday flip can precede the leg's first banking pass: settle
        // a null baseline at today's open first, when the feed carries it.
        if (liveLeg.baselinePrice == null && Number.isFinite(quoteOpen) && quoteOpen > 0) {
          liveLeg.baselinePrice = quoteOpen;
        }
        // Close at the live price. A still-unscoreable leg (no usable
        // baseline) closes bank-pending instead — the banking pass owns it.
        const result = scoreLeg({ symbol, baseATR, leg: liveLeg, price: flipPrice });
        if (result) {
          liveLeg.bankedScore = result.totalPoints;
          bankedLegScore = result.totalPoints;
        } else {
          console.warn(`[Tournament] flip: ${symbol} live leg closed bank-pending (no usable baseline)`);
        }
        liveLeg.closedAt = nowIso;
      } else {
        // Market closed: bank-pending close — bankedScore OMITTED, not null
        // (createLeg's only-exists-once-set convention).
        liveLeg.closedAt = nowIso;
      }

      pick.legs.push(createLeg({
        direction: to,
        baselinePrice: marketOpen ? flipPrice : null,
        baselineSource: marketOpen ? BASELINE_SOURCE.FLIP_MARKET_OPEN : BASELINE_SOURCE.FLIP_MARKET_CLOSED,
        openedAt: nowIso,
      }));
      const legIndexOpened = pick.legs.length - 1;

      pick.flipCountToday = effectiveCount + 1;
      pick.flipCountDate = etDate; // ratified shape addition (P1a register #4)

      // RIDER #4: leg mutation + public feed event in ONE awaited update.
      const feedEvent = {
        type: 'flip',
        symbol,
        odUserId,
        from,
        to,
        timestamp: nowIso,
        flipPrice: marketOpen ? flipPrice : null,
        bankedLegScore,
        legIndexClosed,
        legIndexOpened,
      };
      const feed = [...(group.feed || []), feedEvent];

      // D-1 (Signal Capture Rider): a flip on a symbol the user's OWN agent
      // holds FLIPS the per-player double-down. Detected + recorded ATOMICALLY
      // with the flip — the ledger doubleDowns sibling AND a group-feed
      // double_down entry, all in THIS transaction. The ledger read sits
      // before every write (Firestore reads-before-writes). No own agent / no
      // alignment ⇒ nothing is written to the ledger (contention near zero).
      let doubledDown = false;
      if (ownAgentId) {
        const lRef = ledgerRef(db, groupId);
        const ledgerSnap = await tx.get(lRef);
        const ledger = ledgerSnap.exists ? ledgerSnap.data() : null;
        const events = ledger ? detectUserDoubleDownEvents({
          ownAgentId,
          held: ledger.held,
          odUserId,
          candidates: [{ symbol, kind: 'flipped', userDirection: to, from, to }],
          now: nowIso,
        }) : [];
        if (events.length > 0) {
          doubledDown = true;
          const { doubleDowns, feedEvents } = buildUserDoubleDownWrites(ledger, events, nowIso);
          tx.set(lRef, { ...ledger, doubleDowns, updatedAt: nowIso });
          feed.push(...feedEvents);
        }
      }

      tx.update(groupRef, {
        players,
        feed: feed.slice(-GROUP_FEED_CAP),
        updatedAt: nowIso,
      });

      return {
        symbol,
        from,
        to,
        marketState: marketOpen ? 'open' : 'closed',
        flipCountToday: pick.flipCountToday,
        flipPrice: feedEvent.flipPrice,
        bankedLegScore,
        legIndexClosed,
        legIndexOpened,
        doubledDown,
      };
    });

    console.log(`[Tournament] flip: group ${groupId} ${odUserId} ${symbol} ${summary.from}→${summary.to} (${summary.marketState}${forceHonored ? ', forced' : ''})`);
    return res.status(200).json({ groupId, ...summary });
  } catch (err) {
    if (typeof err?.message === 'string' && err.message.startsWith(SENTINEL_PREFIX)) {
      const code = err.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({
          error: errorKey,
          message: err.detail ? `${humanCopy} ${err.detail}` : humanCopy,
        });
      }
    }
    console.error('[Tournament] flip error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not flip the pick.' });
  }
}
