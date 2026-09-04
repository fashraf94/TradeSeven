// src/screens/battleView/selectBench.js
//
// BENCH QUOTES THE DECIDER ONLY — Phase A3 (A3.3, D-92). PURE.
//
// The bench is the roster the agent could buy but has not: the persisted
// bench, the hot bench the cron rebuilds each tick, and the equipped
// watchlist's tickers — MINUS the book, because a piece already on the board
// has a row of its own and is not a bench name.
//
// Beside each name, what the DECIDER said about it at the last check that
// carries words, verbatim. Not the narrator: the character's `Bench note`
// messages ("Eyeing NOW on the bench…") are Chat entries with their own kind
// eyebrow, and putting them here would present the narrator's voice as the
// decider's (brief §4.4). The only text input this module has is
// `evaluations[].rationale`, so that confusion is impossible by construction
// rather than by review.
//
// ONE SPLIT, THEN A FILTER PER SYMBOL. `extractSentences(text, symbol)` is
// `splitSentences(text).filter(s => namesSymbol(s, symbol))`; calling it once
// per bench name would split the same paragraph n times. Splitting once and
// filtering per symbol is the same answer for one split — and it goes through
// the SAME `splitSentences` / `namesSymbol` pair the row, the tape scope and
// the check card use, so Bench is the fourth consumer of one naming rule and
// never a fifth copy of it (D-87).
//
// THE SCAN-BACK (D-92, hazard 40). `selectLatestDecision` returns null when the
// latest tick recorded no decision — right for the turn line, which is about
// THIS check, and wrong here: an afternoon whose 12:45 check named three bench
// names and whose 1:00 tick timed out would have read `No check yet today`
// while the words were sitting in the doc. So this walks BACK to the last entry
// that carries a rationale and labels THAT slot. The absence line renders only
// when no entry today carries words at all.
//
// The slot is `slotLabel(entry.timestamp)` — a check is named by its cron slot
// on every surface (D-83), so the label here is the label the card and the turn
// line use for the same tick.

import { splitSentences, namesSymbol } from './selectWhyState';

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
 * The last `evaluations[]` entry that carries a rationale — the DECIDER's last
 * words, however many outage ticks have run since.
 *
 * Entries are appended chronologically (agent-evaluate.js:2710), so the scan
 * from the end stops at the first one with words.
 *
 * @returns {object|null}
 */
export function selectLastDecidedWithWords(battle) {
  const evals = battle?.evaluations;
  if (!Array.isArray(evals) || evals.length === 0) return null;
  for (let i = evals.length - 1; i >= 0; i -= 1) {
    const entry = evals[i];
    if (!entry || typeof entry.rationale !== 'string') continue;
    if (!entry.rationale.trim()) continue;
    return entry;
  }
  return null;
}

/**
 * Bench, ready to render.
 *
 * @param {object|null} battle  the subscribed agentBattles doc
 * @returns {{
 *   slotIso: string|null,          the check whose words these are (null = absence)
 *   named: Array<{symbol: string, sentences: string[]}>,
 *   rest: string[],                the roster the check did not name
 *   watchlistName: string|null,    the equipped watchlist's bare name
 * }}
 */
export function selectBench(battle) {
  const roster = selectBenchRoster(battle);
  const rawName = battle?.agentContext?.equippedWatchlist?.name;
  const watchlistName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;

  const decision = selectLastDecidedWithWords(battle);
  if (!decision) {
    // ABSENCE. No entry today carries words at all — every bench name is
    // "rest", and the caller renders the absence line above them.
    return { slotIso: null, named: [], rest: roster, watchlistName };
  }

  // ONE split for the whole roster.
  const sentences = splitSentences(decision.rationale);
  const named = [];
  const rest = [];
  for (const symbol of roster) {
    const mine = sentences.filter((s) => namesSymbol(s, symbol));
    if (mine.length > 0) named.push({ symbol, sentences: mine });
    else rest.push(symbol);
  }

  return { slotIso: decision.timestamp ?? null, named, rest, watchlistName };
}

export default selectBench;
