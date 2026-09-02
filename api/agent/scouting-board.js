// api/agent/scouting-board.js
//
// Command Center Scouting Board — V1, read-only preview endpoint.
//
// Returns the top-N archetype-ranked names over today's stock universe plus the
// caller's equipped watchlist as a distinct group, computed READ-ONLY from the
// deterministic ranking (computeArchetypeRankings). It creates NO battle and
// performs NO Firestore writes — it only .get()s the shared stockRankings doc and
// (optionally) one owned watchlist doc. This is the whole basis of the "fully
// non-fenced" build: it reads the ranking, never drafts.
//
// Honesty principle: every rendered value traces to a real, non-null field. A
// null field is emitted as null (the client renders nothing) — never a guess.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { computeArchetypeRankings } from '../_utils/archetypeScoring.js';
import { resolveEquippedWatchlist, extractTickerSymbols } from '../_utils/watchlistEquip.js';
import { getArchetypeLabel, VALID_ARCHETYPES } from '../_utils/agentArchetypeConfig.js';
import { SCOUTING_BOARD_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 10 };

const BOARD_SIZE = 10;

// Archetype → categorical reason chip. Only the two archetypes whose dominant
// weighted dimension is an ALWAYS-PRESENT stockRankings field get a chip, so a
// board's chips are all-present-or-all-absent — never a per-row hole driven by an
// invisible null (the honesty principle). atrPercentile and technicalScore are
// always written per stock (compute-index-intelligence.js); the nullable
// dimensions (fundamentalScore / compositeScore) are deliberately chip-less in V1.
function chipForArchetype(archetype) {
  if (archetype === 'degen') return { label: 'high volatility', dim: 'atrPercentile' };
  if (archetype === 'momentum_chaser') return { label: 'strong technicals', dim: 'technicalScore' };
  return null;
}

// Normalize the stockRankings doc-level `computedAt` to an ISO string. In the live
// path it is a Firestore Timestamp (serverTimestamp, read via Admin SDK) with
// .toDate(); the {seconds}/{_seconds} branches match the canonical toIso copies for
// a serialized-Timestamp shape. Named distinctly from api/_utils/tournamentTime.js's
// toIso, which only accepts Date|string and would throw on a Timestamp — do NOT swap
// this for that helper.
function firestoreTsToIso(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') {
    try { return ts.toDate().toISOString(); } catch { return null; }
  }
  if (typeof ts === 'string') return ts;
  if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toISOString();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString();
  return null;
}

export default async function handler(req, res) {
  // Cheap read-only endpoint; re-fetched on board open + archetype/equip swap, so
  // a higher limit than the write endpoints (chat's 10) is appropriate.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Defense-in-depth for merge-dark: while the flag is off the endpoint reveals
  // nothing and performs no reads. The client only calls it from behind the same
  // flag, so this 404 is unreachable in the normal flow.
  if (!SCOUTING_BOARD_ENABLED) return res.status(404).json({ error: 'not_found' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const archetype = typeof req.query.archetype === 'string' ? req.query.archetype : null;
  const watchlistId =
    typeof req.query.watchlistId === 'string' && req.query.watchlistId ? req.query.watchlistId : null;

  // 400, not analyst-fallback: an unknown archetype has no honest label, and
  // computeArchetypeRankings would silently score it as analyst — a fabricated
  // ranking under a label nobody asked for. Mirrors change-archetype.js.
  if (!archetype || !VALID_ARCHETYPES.includes(archetype)) {
    return res.status(400).json({ error: 'invalid_archetype', message: 'Unknown archetype code.' });
  }

  try {
    const db = getFirebaseAdmin();

    // 1. Universe — one Firestore doc read (same source as decide.js:233-239).
    const rankingsSnap = await db.collection('indexIntelligence').doc('stockRankings').get();
    const rankingsData = rankingsSnap.exists ? rankingsSnap.data() : null;
    const stocks = Array.isArray(rankingsData?.stocks) ? rankingsData.stocks : [];
    const asOf = firestoreTsToIso(rankingsData?.computedAt);

    // 2. Resolve + AUTHORIZE the equipped watchlist. watchlistId comes from the
    //    client (not an owned agent doc, as in decide.js), and this endpoint uses
    //    the Admin SDK (bypasses Firestore rules) — so the owner check is
    //    mandatory and runs BEFORE resolve, so a foreign watchlist's tickers are
    //    never read. Any mismatch / missing / uncommitted / error DEGRADES to
    //    "no watchlist" (a read-only preview never 403s on a stale id).
    let equippedSymbols = [];
    if (watchlistId) {
      try {
        const wlSnap = await db.collection('watchlists').doc(watchlistId).get();
        const wlData = wlSnap.exists ? wlSnap.data() : null;
        if (wlData && wlData.userId === user.uid) {
          const resolved = resolveEquippedWatchlist(wlData); // committed + not-deleted
          if (resolved) equippedSymbols = extractTickerSymbols(resolved.tickers);
        }
      } catch (wlErr) {
        console.warn('[scouting-board] watchlist read failed — degrading to no watchlist:', wlErr?.message);
      }
    }
    const equippedSet = new Set(equippedSymbols);

    // 3. Rank the universe for this archetype (pure; full sorted-desc copy).
    // Archetype Rank V2 (spec §4 census): explicit mode + the §3.4 pinned minimum (V1 ignores opts).
    const ranked = computeArchetypeRankings(stocks, archetype, { gameMode: 'scouting', minCandidates: BOARD_SIZE });
    const scoreBySymbol = new Map(ranked.map((s) => [s.symbol, s])); // also the in-universe test
    const top = ranked.slice(0, BOARD_SIZE);
    const topSet = new Set(top.map((s) => s.symbol));
    const chip = chipForArchetype(archetype);

    // 4. Ranked rows (top-N). null sectorName renders nothing client-side (no
    //    fabrication). Chip only on in-universe names.
    const rankedOut = top.map((s) => ({
      symbol: s.symbol,
      sectorName: s.sectorName ?? null,
      archetypeScore: s.archetypeScore,
      inWatchlist: equippedSet.has(s.symbol),
      chip,
    }));

    // 5. Classify equipped symbols not already in the top rows:
    //    (a) in top-N        → already marked inWatchlist above (skip, no dup)
    //    (b) below top-N     → inUniverse, carrying its REAL archetypeScore
    //    (c) outside universe → offUniverse, symbol only — NO score, NO chip
    const inUniverse = [];
    const offUniverse = [];
    for (const sym of equippedSymbols) {
      if (topSet.has(sym)) continue;
      const s = scoreBySymbol.get(sym);
      if (s) {
        inUniverse.push({
          symbol: sym,
          sectorName: s.sectorName ?? null,
          archetypeScore: s.archetypeScore,
          chip,
        });
      } else {
        offUniverse.push({ symbol: sym });
      }
    }
    inUniverse.sort((a, b) => b.archetypeScore - a.archetypeScore);

    return res.status(200).json({
      mode: 'board', // V2 seam: a later tier returns mode:'draft' from this same endpoint
      archetype,
      archetypeLabel: getArchetypeLabel(archetype),
      asOf,
      ranked: rankedOut,
      watchlist: { inUniverse, offUniverse },
      empty: rankedOut.length === 0,
    });
  } catch (err) {
    console.error('[scouting-board] unexpected error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
