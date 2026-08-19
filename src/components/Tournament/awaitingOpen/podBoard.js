// src/components/Tournament/awaitingOpen/podBoard.js
//
// Pure, client-side, fence-clean helpers for the awaiting-open pod's user-layer
// surfaces (Training Pod Draft V2 — Phase 2, L6/L7). No React, no I/O — so the
// derivations are unit-testable in the Node env and can never fork from the
// live board's math: the free-agents board is the SAME buildFitBoard engine the
// draft lobby uses (src/components/League/draft/boardModel.js), fed the pod's
// remaining userPool. We read precomputed arch_scores off the universe doc; we
// never recompute or edit the scoring engine (calibration fence untouched).

import { buildFitBoard, DEFAULT_ARCH } from '../../League/draft/boardModel';

const norm = (s) => (typeof s === 'string' ? s.trim().toUpperCase() : '');

/**
 * Join a list of pool symbols to the stockRankings universe into the row shape
 * buildFitBoard / StockCard expect — the mirror of useTrainingDraft's `poolRows`
 * (kept in sync deliberately; both read the same universe doc fields). A symbol
 * with no universe entry degrades to a bare row (sector 'Other', null signals),
 * never dropped.
 */
export function joinPoolRows(poolSymbols, universe) {
  const bySymbol = new Map((universe || []).map((s) => [norm(s.symbol), s]));
  return (poolSymbols || []).map((sym) => {
    const key = norm(sym);
    const meta = bySymbol.get(key) || { symbol: key };
    return {
      symbol: key,
      sectorName: meta.sectorName || 'Other',
      archScores: meta.arch_scores || {},
      compositeScore: meta.compositeScore ?? null,
      momentumScore: meta.momentumScore ?? null,
      momentumRank: meta.momentumRank ?? null,
      fundamentalScore: meta.fundamentalScore ?? null,
      technicalScore: meta.technicalScore ?? null,
      baggerBombFit: meta.baggerBombFit ?? null,
      atrPercentile: meta.atrPercentile ?? null,
      return1W: meta.return1W ?? null,
      return1M: meta.return1M ?? null,
      return3M: meta.return3M ?? null,
      returnYTD: meta.returnYTD ?? null,
      available: true,
    };
  });
}

/**
 * Symbol → sectorName map off the universe doc (for coloring the draftboard
 * chips, whose symbols come from the pick stream, not the pool join).
 */
export function sectorMapOf(universe) {
  const m = new Map();
  for (const s of universe || []) {
    const key = norm(s?.symbol);
    if (key) m.set(key, s.sectorName || 'Other');
  }
  return m;
}

/** Owned-sector counts from the player's held pick symbols (Diversifier overlay
 *  parity with the lobby board). */
export function ownedSectorCountsFrom(heldSymbols, universe) {
  const sectors = sectorMapOf(universe);
  const counts = {};
  for (const sym of heldSymbols || []) {
    const sec = sectors.get(norm(sym));
    if (sec) counts[sec] = (counts[sec] || 0) + 1;
  }
  return counts;
}

/**
 * The pod's "best remaining free agents" (L7): the user-pool-available names
 * (the ranked universe MINUS the 12 drafted — already the shape of pod.userPool
 * at AWAITING_OPEN) ranked by archetype fit via the SAME buildFitBoard, top N.
 * Diversifier overlay applied from the player's held sectors, mirroring the
 * lobby. Pure.
 */
export function buildFreeAgentBoard({ poolSymbols, universe, archKey = DEFAULT_ARCH, ownedSectorCounts = {}, topN = 12 } = {}) {
  const rows = joinPoolRows(poolSymbols, universe);
  const board = buildFitBoard({ availableRows: rows, archKey, ownedSectorCounts });
  return board.slice(0, topN);
}

/**
 * The user-layer draftboard grid (L6): rounds (rows) × seats (columns). Each
 * cell is that seat's pick in that round, or null. Prefers the persisted pick
 * stream's `events` ({ round, odUserId, symbol }); a caller with no events can
 * pass synthetic ones via eventsFromPlayers(). Pure.
 *
 * Returns `grid[roundIdx][seatIdx] = { symbol, odUserId, pickNumber } | null`.
 */
export function buildDraftGrid({ events, groupMembers, picksPerPlayer = 3 } = {}) {
  const seatCount = (groupMembers || []).length;
  const grid = Array.from({ length: picksPerPlayer }, () => new Array(seatCount).fill(null));
  for (const ev of events || []) {
    const seatIdx = (groupMembers || []).indexOf(ev?.odUserId);
    const r = (ev?.round || 0) - 1;
    if (seatIdx < 0 || r < 0 || r >= picksPerPlayer) continue;
    grid[r][seatIdx] = { symbol: norm(ev.symbol), odUserId: ev.odUserId, pickNumber: ev.pickNumber ?? null };
  }
  return grid;
}

/**
 * Seat-major view of the same draft grid, for the redesigned draftboard: one
 * LANE per seat, each carrying that seat's picks in round order. The classic
 * board is round-major (rounds as rows); the redesign reads down a seat's
 * column, with YOUR lane rendered as the hero.
 *
 * Derived from buildDraftGrid so both boards resolve identically from one
 * source — a symbol can never appear in one and not the other (BUILD_RULES §9).
 * Seat labels mirror the existing convention ("You" / "CPU {seatIdx}",
 * UserDraftboard.jsx:18). Sector is looked up through the caller's sectorMap
 * (the live getSectorColor keying), missing entries degrading to 'Other' rather
 * than dropping the pick. Pure.
 *
 * Returns `[{ odUserId, seat, you, picks: [{ symbol, sector, round } | null] }]`.
 */
export function buildSeatLanes({ events, groupMembers, picksPerPlayer = 3, uid = null, sectorMap = null } = {}) {
  const members = groupMembers || [];
  const grid = buildDraftGrid({ events, groupMembers: members, picksPerPlayer });
  return members.map((odUserId, seatIdx) => ({
    odUserId,
    seat: odUserId === uid ? 'You' : `CPU ${seatIdx}`,
    you: odUserId === uid,
    picks: Array.from({ length: picksPerPlayer }, (_, r) => {
      const cell = grid[r]?.[seatIdx];
      if (!cell) return null;
      return {
        symbol: cell.symbol,
        sector: (sectorMap && sectorMap.get(cell.symbol)) || 'Other',
        round: `R${r + 1}`,
      };
    }),
  }));
}

/**
 * Sector spread of a set of picks — "your book" at a glance. Counts by sector,
 * densest first, ties broken alphabetically so the order is stable across
 * renders. Nulls (an undrafted slot) are ignored. Pure.
 */
export function sectorSpread(picks) {
  const counts = {};
  for (const p of picks || []) {
    if (!p || !p.sector) continue;
    counts[p.sector] = (counts[p.sector] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([sector, n]) => ({ sector, n }));
}

/**
 * Fallback pick "events" from materialized players[].picks (each seat's picks in
 * draft order → round = index + 1). Used only when the pick stream is absent.
 * `players[].picks` are pick-state objects ({ symbol, ... }) or bare symbols. Pure.
 */
export function eventsFromPlayers(players) {
  const out = [];
  for (const p of players || []) {
    (p?.picks || []).forEach((pick, i) => {
      const symbol = typeof pick === 'string' ? pick : pick?.symbol;
      if (symbol) out.push({ odUserId: p.odUserId, symbol: norm(symbol), round: i + 1, pickNumber: null });
    });
  }
  return out;
}

/** Held pick symbols for a player (pick-state objects or bare symbols). Pure. */
export function heldSymbolsOf(player) {
  return (player?.picks || []).map((pick) => (typeof pick === 'string' ? norm(pick) : norm(pick?.symbol))).filter(Boolean);
}
