// src/utils/retiredTickerCopy.js
//
// BaggerBomb cleanup C4 (Flash, Oct 27, 2026): the two lines a player reads
// about a retired stock (BR-3: 11 names left the stock universe). Both take the
// SYMBOLS the server named in its payload — `symbols` on a `retired_ticker`
// refusal, `droppedRetired` on a saved dialogue — never a re-parse of its
// message (BUILD_RULES §9). Pure; no imports.

const clean = (symbols) => (Array.isArray(symbols) ? symbols.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : []);

/** "KRE", "KRE and XLF", "KRE, XLF and EA". */
function nameList(list) {
  return list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/**
 * The editor's line for a refused save (#998 MT3-6): the symbol the player must
 * remove. Null when the server named none.
 */
export function retiredEditorLine(symbols) {
  const list = clean(symbols);
  if (list.length === 0) return null;
  return list.length === 1
    ? `${list[0]} is no longer available. Remove it to save.`
    : `${nameList(list)} are no longer available. Remove them to save.`;
}

/**
 * The dialogue's line after a save that left retired names out. Null when none
 * were dropped.
 */
export function retiredDroppedLine(symbols) {
  const list = clean(symbols);
  if (list.length === 0) return null;
  return list.length === 1
    ? `${list[0]} is no longer available, so it was left out of your watchlist.`
    : `${nameList(list)} are no longer available, so they were left out of your watchlist.`;
}
