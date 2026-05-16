// api/_utils/watchlistEquip.js
//
// Phase 5B1 — Watchlist Equip. Pure helpers for the equip path. No I/O: every
// function here is deterministic and unit-testable, which keeps the riskiest
// logic (the decide.js shortlist fold and the agent-evaluate hotBench union)
// out of the monolithic, hard-to-mock handlers that consume it.
//
// Consumed by:
//   * api/agent/decide.js            — resolveEquippedWatchlist, extractTickerSymbols,
//                                       foldEquippedTickers, unionEquippedIntoHotBench,
//                                       buildEquippedSnapshot
//   * api/_utils/agentBattleService  — (snapshot shape produced here)
//   * api/cron/agent-evaluate.js     — unionEquippedIntoHotBench

// Ticker symbols are uppercase alphanumerics plus '.' and '-' (e.g. BRK.B),
// capped at 12 chars. Anything else is a malformed entry and is dropped.
const SYMBOL_REGEX = /^[A-Z0-9.-]{1,12}$/;

/**
 * Normalize a watchlist's `tickers` array into a clean, deduped list of symbol
 * strings. Stays pure — emits no logs. Callers that want a "stripped N invalid"
 * signal should compare the input length against the returned length.
 *
 * @param {Array<{symbol?: string}>|undefined} tickers
 * @returns {string[]}
 */
export function extractTickerSymbols(tickers) {
  if (!Array.isArray(tickers)) return [];
  const seen = new Set();
  const out = [];
  for (const t of tickers) {
    if (!t || typeof t.symbol !== 'string') continue;
    const symbol = t.symbol.trim().toUpperCase();
    if (!SYMBOL_REGEX.test(symbol)) continue;
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}

/**
 * Decide whether an equipped watchlist is usable at deploy / battle-creation
 * time. Q3 + Q4 locks: a missing, soft-deleted, or non-committed watchlist
 * degrades to "no equip" (the agent's equippedWatchlistId field is left
 * untouched — only the *effect* is suppressed).
 *
 * @param {Object|null} watchlistData - watchlists/{id} doc data, or null if absent.
 * @returns {Object|null} the data when usable, otherwise null.
 */
export function resolveEquippedWatchlist(watchlistData) {
  if (!watchlistData) return null;
  if (watchlistData.deletedAt) return null;
  if (watchlistData.status !== 'committed') return null;
  return watchlistData;
}

/**
 * Fold equipped-watchlist tickers into the Sonnet shortlist (Option 8C).
 *
 * Replaces decide.js's bare `shortlist.filter(t => validSymbols.has(t))`:
 *   - Sonnet hallucinations (not in the universe and not equipped) are dropped.
 *   - Equipped tickers survive even when off-universe.
 *   - Equipped tickers not already present are appended ("elevated").
 *   - augmentedValidSymbols extends validSymbols with off-universe equipped
 *     tickers so downstream validatePortfolio() does not reject them.
 *
 * With an empty equippedSymbols this is behaviourally identical to the old
 * filter (regression-safe — V-14).
 *
 * @param {Object} args
 * @param {string[]} args.shortlist        - Sonnet's raw shortlist.
 * @param {string[]} args.equippedSymbols  - clean equipped symbols (extractTickerSymbols output).
 * @param {Set<string>} args.validSymbols  - universe symbol set.
 * @returns {{shortlist: string[], elevatedTickers: string[], offUniverseTickers: string[], augmentedValidSymbols: Set<string>}}
 */
export function foldEquippedTickers({ shortlist, equippedSymbols, validSymbols }) {
  const rawShortlist = Array.isArray(shortlist) ? shortlist : [];
  const equipped = Array.isArray(equippedSymbols) ? equippedSymbols : [];
  const equippedSet = new Set(equipped);

  // Keep universe-valid tickers + equipped tickers; drop everything else.
  const filtered = rawShortlist.filter(
    (t) => validSymbols.has(t) || equippedSet.has(t)
  );
  const filteredSet = new Set(filtered);

  // Equipped tickers Sonnet did not already include.
  const elevatedTickers = equipped.filter((t) => !filteredSet.has(t));
  const augmentedShortlist = [...filtered, ...elevatedTickers];

  // Equipped tickers that sit outside the scored universe.
  const offUniverseTickers = equipped.filter((t) => !validSymbols.has(t));
  const augmentedValidSymbols = new Set([...validSymbols, ...offUniverseTickers]);

  return {
    shortlist: augmentedShortlist,
    elevatedTickers,
    offUniverseTickers,
    augmentedValidSymbols,
  };
}

/**
 * Union equipped tickers back into a hotBench list.
 *
 * hotBench is a flat array of symbol strings everywhere in the codebase
 * (decide.js, agent-evaluate.js, agentSwapExecution.js) — this helper stays
 * string-based and never mutates the input. baggerBombFit for the over-cap
 * sort is looked up from `rankings`, not read off entries (entries are bare
 * strings).
 *
 * Q-A2 lock: soft cap of 20. When the union exceeds the cap, equipped tickers
 * are always retained; the lowest-baggerBombFit non-equipped tickers drop.
 *
 * @param {Object} args
 * @param {string[]} args.hotBench               - current hotBench symbols.
 * @param {string[]} args.equippedTickers        - equipped symbols to union in.
 * @param {Array<{symbol: string, baggerBombFit?: number}>} [args.rankings] - fit source.
 * @param {Set<string>} [args.excludeSymbols]    - symbols already placed (portfolio/bench).
 * @param {number} [args.cap=20]                 - soft size cap.
 * @returns {string[]}
 */
export function unionEquippedIntoHotBench({
  hotBench,
  equippedTickers,
  rankings = [],
  excludeSymbols = new Set(),
  cap = 20,
}) {
  const bench = Array.isArray(hotBench) ? hotBench : [];
  const equipped = Array.isArray(equippedTickers) ? equippedTickers : [];

  const benchSet = new Set(bench);
  const toAdd = equipped.filter(
    (s) => s && !benchSet.has(s) && !excludeSymbols.has(s)
  );
  const merged = [...bench, ...toAdd];

  if (merged.length <= cap) return merged;

  // Over cap — protect equipped, drop lowest-fit non-equipped.
  const equippedSet = new Set(equipped);
  const fitMap = new Map();
  for (const r of rankings) {
    if (r && typeof r.symbol === 'string') {
      fitMap.set(r.symbol, r.baggerBombFit || 0);
    }
  }

  const equippedInBench = merged.filter((s) => equippedSet.has(s));
  const nonEquipped = merged
    .filter((s) => !equippedSet.has(s))
    .sort((a, b) => (fitMap.get(b) || 0) - (fitMap.get(a) || 0))
    .slice(0, Math.max(0, cap - equippedInBench.length));

  return [...nonEquipped, ...equippedInBench];
}

/**
 * Build the frozen battle-doc snapshot of an equipped watchlist. The
 * `snapshotAt` timestamp is intentionally NOT set here — createAgentBattle()
 * stamps it with the battle-creation time so the snapshot reads as frozen
 * "at battle start".
 *
 * @param {string} watchlistId
 * @param {Object} watchlistData - watchlists/{id} doc data.
 * @returns {{watchlistId: string, name: string, tickers: string[]}}
 */
export function buildEquippedSnapshot(watchlistId, watchlistData) {
  return {
    watchlistId,
    name: watchlistData?.name || 'Untitled watchlist',
    tickers: extractTickerSymbols(watchlistData?.tickers),
  };
}
