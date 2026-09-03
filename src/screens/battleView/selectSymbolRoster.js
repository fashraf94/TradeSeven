// src/screens/battleView/selectSymbolRoster.js
//
// THE BATTLE'S OWN UNIVERSE — Phase A2 (A2.3, ruling 8, D-73). PURE.
//
// The detector answers "does this text name NVDA" by asking whether the word
// is in a roster. The shipped roster is the BOOK ALONE — the seven pieces on
// the board — so a message about a bench name the agent is one tick from
// buying was never underlined and would never be counted.
//
// Under the flag the roster is the union of the four persisted lists that make
// up the battle's own universe (Phase 0 §2.8, all on the subscribed doc):
//
//   book        portfolio.{star,core,support}[].symbol
//   bench       portfolio.bench.stocks[].symbol + portfolio.bench.crypto.symbol
//   hot bench   watchlist.hotBench[]                     (a STRING array)
//   equipped    agentContext.equippedWatchlist.tickers[] (a STRING array)
//
// UNDER THE FLAG ONLY (hazard 27). Widening the roster widens what the shipped
// chat underlines, and the underline opens a research modal — so flag-off the
// screen keeps handing the detector the book, byte for byte, and the chat
// golden proves it.
//
// NEVER THE OPPONENT'S (seed §5). `opponent` is a portfolio object on the same
// doc and it is not read here: the tape is own-side only, and a piece the
// player does not hold is not a piece they can ask about.
//
// The two list shapes are BOTH handled at every site rather than assumed,
// because two of the four are string arrays and two are arrays of objects, and
// `hotBench` is rebuilt mid-battle by the evaluate cron
// (agent-evaluate.js:1009-1043) where the object form would be the easy
// mistake to make.

const TIERS = ['star', 'core', 'support'];

/** A symbol from either persisted shape: a bare string, or `{ symbol }`. */
function symbolOf(entry) {
  if (typeof entry === 'string') return entry.trim() || null;
  const symbol = entry?.symbol;
  return typeof symbol === 'string' && symbol.trim() ? symbol.trim() : null;
}

function addAll(into, list) {
  if (!Array.isArray(list)) return;
  for (const entry of list) {
    const symbol = symbolOf(entry);
    if (symbol) into.add(symbol);
  }
}

/**
 * The battle's own universe as a Set, for the detector.
 *
 * @param {object|null} battle  the subscribed agentBattles doc
 * @returns {Set<string>}
 */
export function selectSymbolRoster(battle) {
  const roster = new Set();
  if (!battle || typeof battle !== 'object') return roster;

  const portfolio = battle.portfolio;
  for (const tier of TIERS) addAll(roster, portfolio?.[tier]);

  addAll(roster, portfolio?.bench?.stocks);
  const crypto = symbolOf(portfolio?.bench?.crypto);
  if (crypto) roster.add(crypto);

  addAll(roster, battle.watchlist?.hotBench);
  addAll(roster, battle.agentContext?.equippedWatchlist?.tickers);

  return roster;
}

export default selectSymbolRoster;
