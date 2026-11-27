// api/_utils/researchUniverse.js
//
// Research universe Build 1: the accessor (founder rulings RU-1 to RU-5 of Nov 26, 2026; build prompt section
// 3.2; census docs/audits/20261126_RESEARCH_UNIVERSE_CENSUS.md Part G, row G1).
//
// The research list is the 228 game stocks plus the directory (RU-2). This module answers "is this on the research
// list, is it a research stock, and what sector is it in?". It is PURE: it imports rankingConfig.js and the
// generated researchDirectory.js and nothing else, reads no clock, store or network, and changes neither import.
// The game list is untouched (RU-1): nothing here enters ALL_TICKERS, TICKER_TO_SECTOR or any ranked pool.
//
// NOTHING IMPORTS THIS MODULE YET. That is the off switch (build prompt section 3.3):
// researchUniverse.boundary.test.js fails if any file in api/ or src/ other than this module, the directory and
// their tests names either one. Later builds connect Work an idea, Explore, search and the idea book one at a time.
//
// Words used here:
//   - on the research list: one of the 228, or a directory entry (researchUniverse.has);
//   - a research stock: a directory entry, which is never one of the 228 (isResearchStock). The founder's notes
//     for later builds use the word this way ("a research stock shows its own numbers and no rank at first").

import { ALL_TICKERS, TICKER_TO_SECTOR, isRetiredStock } from './rankingConfig.js';
import { RESEARCH_DIRECTORY } from './researchDirectory.js';

const GAME = new Set(ALL_TICKERS);
const held = (s) => typeof s === 'string' && Object.hasOwn(RESEARCH_DIRECTORY, s);

/**
 * The research list in the shape of gameUniverse (api/_utils/sharedResearch/companies.js): membership and
 * retirement, exact symbols (callers normalise first, as resolveSymbol does). `retired` answers exactly as
 * gameUniverse.retired does; how a retired stock that is also a directory entry is treated is left to a later build.
 */
export const researchUniverse = Object.freeze({
  has: (s) => GAME.has(s) || held(s),
  retired: (s) => isRetiredStock(s),
});

/** True for a directory entry (a research stock); false for the 228 and for anything not on the research list. */
export function isResearchStock(s) {
  return held(s) && !GAME.has(s);
}

/** The house sector id: for one of the 228 the house map wins, otherwise the directory's; null when not held. */
export function researchSectorOf(s) {
  if (GAME.has(s)) return TICKER_TO_SECTOR[s];
  return held(s) ? RESEARCH_DIRECTORY[s][1] : null;
}

/** The directory's name; null when the directory does not hold the symbol (the 228 included). */
export function researchNameOf(s) {
  return held(s) ? RESEARCH_DIRECTORY[s][0] : null;
}

/** The directory's industry (the screener's own words, not GICS); null when not held (the 228 included) or none was given. */
export function researchIndustryOf(s) {
  return held(s) ? RESEARCH_DIRECTORY[s][2] : null;
}

export const RESEARCH_DIRECTORY_COUNT = Object.keys(RESEARCH_DIRECTORY).length;
