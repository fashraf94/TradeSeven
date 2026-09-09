// src/data/battleUniverse.js
//
// THE BATTLE'S UNIVERSE — Phase C (Show it), spec §1/§2. PURE, ZERO IMPORTS.
//
// The set of names a battle can be asked about: the book (every piece with a
// row on the board) ∪ the bench roster (the persisted bench, the hot bench the
// cron rebuilds each tick, and the equipped watchlist's tickers, minus the
// book). Discovery item 1: `book ∪ bench.stocks ∪ bench.crypto ∪
// watchlist.hotBench ∪ agentContext.equippedWatchlist.tickers`.
//
// IT LIVES HERE, WITH NO IMPORTS, BECAUSE THE SERVER NEEDS IT (hazard 6: never
// trust a client-sent symbol — the research route validates membership exactly
// as `file-directive` validates a directive id). `selectBench.js` — the client
// module that owned this union — imports from a chain that reaches
// `components/Dashboard/desk/deskCopy`, so `api/` cannot take it under the
// BUILD_RULES §4 Node-clean condition. The union is NOT copied: `selectBench.js`
// now imports these two functions from here and re-exports them under their
// shipped names, so the bench the player reads and the universe the route
// validates against are one derivation (BUILD_RULES §9).
//
// The bench roster keeps its LIST ORDER (the order the doc carries, never
// re-sorted) because the Bench pane renders it in that order; the universe adds
// the book in tier order in front of it.

const TIERS = ['star', 'core', 'support'];

/** A symbol from either persisted shape: a bare string, or `{ symbol }`. */
function symbolOf(entry) {
  if (typeof entry === 'string') return entry.trim() || null;
  const symbol = entry?.symbol;
  return typeof symbol === 'string' && symbol.trim() ? symbol.trim() : null;
}

function pushAll(into, list) {
  if (!Array.isArray(list)) return;
  for (const entry of list) {
    const symbol = symbolOf(entry);
    if (symbol) into.push(symbol);
  }
}

/** The book: every piece with a row on the board. */
export function selectBookSymbols(battle) {
  const book = new Set();
  const portfolio = battle?.portfolio;
  for (const tier of TIERS) {
    if (!Array.isArray(portfolio?.[tier])) continue;
    for (const entry of portfolio[tier]) {
      const symbol = symbolOf(entry);
      if (symbol) book.add(symbol);
    }
  }
  return book;
}

/**
 * The bench roster: the three bench lists minus the book, deduped, IN LIST
 * ORDER (persisted bench first, then the hot bench, then the equipped
 * watchlist) — the order the doc carries, never re-sorted, because a bench
 * re-ordered by this module would disagree with every other reading of it.
 *
 * @param {object|null} battle
 * @returns {string[]}
 */
export function selectBenchRoster(battle) {
  if (!battle || typeof battle !== 'object') return [];
  const ordered = [];
  pushAll(ordered, battle.portfolio?.bench?.stocks);
  const crypto = symbolOf(battle.portfolio?.bench?.crypto);
  if (crypto) ordered.push(crypto);
  pushAll(ordered, battle.watchlist?.hotBench);
  pushAll(ordered, battle.agentContext?.equippedWatchlist?.tickers);

  const book = selectBookSymbols(battle);
  const seen = new Set();
  const roster = [];
  for (const symbol of ordered) {
    if (book.has(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    roster.push(symbol);
  }
  return roster;
}

/**
 * The whole universe, book first (tier order) then the bench roster (list
 * order), deduped. The order is stable and meaningful; nothing sorts it.
 *
 * @param {object|null} battle
 * @returns {string[]}
 */
export function selectBattleUniverse(battle) {
  return [...selectBookSymbols(battle), ...selectBenchRoster(battle)];
}

/**
 * Is this symbol one the battle can be asked about?
 *
 * CASE- AND WHITESPACE-INSENSITIVE on the CLIENT'S half only: the doc's symbols
 * are canonical, the request's are not, and `mpc` is the same name as `MPC` to
 * everyone except a strict comparison. Anything that is not a non-empty string
 * is not in any universe.
 */
export function isInBattleUniverse(battle, symbol) {
  const wanted = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
  if (!wanted) return false;
  return selectBattleUniverse(battle).some((s) => s.toUpperCase() === wanted);
}

/**
 * The universe's own spelling of a symbol — the doc's canonical string for a
 * name the client asked for in any case. Null when it is not in the universe.
 * The route persists THIS, never the client's bytes.
 */
export function canonicalUniverseSymbol(battle, symbol) {
  const wanted = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
  if (!wanted) return null;
  return selectBattleUniverse(battle).find((s) => s.toUpperCase() === wanted) ?? null;
}

/** Where in the battle a name sits — the card's "standing" section (§3). */
export const UNIVERSE_PLACE = Object.freeze({
  BOOK: 'book',
  BENCH: 'bench',
  WATCHLIST: 'watchlist',
  ABSENT: null,
});

/**
 * `book` when the name has a row on the board, `bench` when it is on the
 * persisted bench (including the crypto slot), `watchlist` when it reaches the
 * roster only through the hot bench or the equipped watchlist, null otherwise.
 *
 * The three lists are read in the SAME order `selectBenchRoster` walks them, so
 * a name that appears twice is placed by the first list that carries it.
 */
export function universePlace(battle, symbol) {
  const canonical = canonicalUniverseSymbol(battle, symbol);
  if (!canonical) return UNIVERSE_PLACE.ABSENT;
  if (selectBookSymbols(battle).has(canonical)) return UNIVERSE_PLACE.BOOK;
  const bench = [];
  pushAll(bench, battle?.portfolio?.bench?.stocks);
  const crypto = symbolOf(battle?.portfolio?.bench?.crypto);
  if (crypto) bench.push(crypto);
  if (bench.includes(canonical)) return UNIVERSE_PLACE.BENCH;
  return UNIVERSE_PLACE.WATCHLIST;
}
