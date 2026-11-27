// api/_utils/sharedResearch/sessionUniverse.js
//
// Research universe Build 3b (Work an idea accepts research companies), build prompt section 5.2: ONE PLACE DECIDES A
// SESSION'S UNIVERSE. Pure: it reads the switch and the founder list at call time (never at module scope), and no
// store, clock or network.
//
//   - The switch (section 5.1): SHARED_RESEARCH_UNIVERSE_MODE 'off' | 'founder' | 'on', read by universeModeNow(); any
//     other value, a missing export or a read that throws is 'off'. At 'founder' only a uid on the founder list
//     (MANDATE_FOUNDER_UIDS, readPracticeFieldFounderList — the zero-import reader the idea book's founder door uses)
//     gets the research list (RU-22).
//   - The stamp: read ONCE, at open (universeStampFor), written on the session as `universe: 'research'` on a research
//     session only. A session with no stamp is a game-list session, so a game-list session's stored record gains no
//     field. The stamp never changes: an investigation opened on the game list stays on it.
//   - universeOf(session): the universe every helper of section 2 point 2 is handed — the game's (gameUniverse,
//     unchanged) or the research session's, below.
//
// The research session's universe has the shape of gameUniverse ({ has, retired }: the research list, RU-2) and adds
// what only a research session does. Each helper reads these optionally, so the game universe, which has none of them,
// behaves exactly as before:
//   research         true (the step and builder prompts gain the one rule of section 5.3; stepPrompt.js)
//   strictCase       a company name is read as a ticker only when written in capitals (section 5.7)
//   lookupName       a company named in words with no symbol: the one directory company (or everyday name) whose core
//                    name it is, else null — never a guess (section 5.6)
//   sameCompany      isSameCompany's research rules: the symbol only in capitals, a listed everyday name (section
//                    5.5, RU-20), a research-only company only by its whole core name (lens 2: never a part of it)
//   eligibilityOf    identity comes from the research list; eligibility is still the game's: 'eligible' for one of the
//                    228, 'research' for a research-only company, 'outside' otherwise (section 5.8)

import { SHARED_RESEARCH_UNIVERSE_MODE, SHARED_RESEARCH_UNIVERSE_MODES } from '../../../src/config/sharedResearchFlags.js';
import { readPracticeFieldFounderList } from '../practiceField/playerList.js';
import { researchUniverse as researchList, isResearchStock, researchNameOf } from '../researchUniverse.js';
import { RESEARCH_DIRECTORY } from '../researchDirectory.js';
import { gameUniverse, coreNameOf } from './companies.js';
import { EVERYDAY_NAMES } from './everydayNames.js';

const OFF = 'off';
/** The stamp a research session carries (`session.universe`). A game-list session carries none. */
export const RESEARCH_STAMP = 'research';

// ── the switch and the stamp ──────────────────────────────────────────────────────────────────────────────────────

/** The switch as the server reads it NOW: one of the walked states, else 'off'. Never throws. */
export function universeModeNow() {
  try {
    const mode = SHARED_RESEARCH_UNIVERSE_MODE;
    return Array.isArray(SHARED_RESEARCH_UNIVERSE_MODES) && SHARED_RESEARCH_UNIVERSE_MODES.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/** Does a NEW investigation opened now by this uid open on the research list? Read at call time. Never throws. */
export function researchListFor(uid) {
  try {
    if (typeof uid !== 'string' || uid.length === 0) return false;
    const mode = universeModeNow();
    if (mode === 'on') return true;
    if (mode === 'founder') return readPracticeFieldFounderList().includes(uid);
    return false;
  } catch {
    return false;
  }
}

/** The stamp to write on a new session at open: 'research', or null (no field is written). */
export const universeStampFor = (uid) => (researchListFor(uid) ? RESEARCH_STAMP : null);

/** Is this stored session a research session (stamped at open)? */
export const isResearchSession = (session) => session?.universe === RESEARCH_STAMP;

// ── the name lookup (section 5.6) and the everyday names (section 5.5) ────────────────────────────────────────────────

/**
 * Share-type and company-form tails the directory's names carry that coreNameOf does not drop ("Ambev SA ADR",
 * "Arm Holdings plc American Depositary Shares", "Accelevation Holdings Corp. Class A Ordinary Shares").
 */
const SHARE_TAIL = /[\s,]+(?:class\s+[a-c](?:\s+(?:ordinary|common)\s+(?:shares?|stock))?|american\s+depositary\s+(?:shares?|receipts?)|depositary\s+(?:shares?|receipts?)|new\s+york\s+registry\s+shares|ad[rs]|ordinary\s+shares?|common\s+(?:shares?|stock)|s\.?a\.?b\.?\s+de\s+c\.?v\.?|l\.?p\.?|llc|corp\.?)$/i;

/**
 * A company name as the lookup compares it: its core (coreNameOf) with share-type tails dropped, NFKC, lower case,
 * punctuation as spaces ("Corning Incorporated" → "corning"; "Ambev SA ADR" → "ambev"; "J&J" → "j&j"). Empty for
 * no name.
 */
export function lookupKeyOf(name) {
  let s = String(name ?? '').normalize('NFKC').trim();
  for (let i = 0; i < 8; i++) {
    const next = coreNameOf(s.replace(SHARE_TAIL, '').trim());
    if (next === s) break;
    s = next;
  }
  return s.toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, ' ').trim();
}

let INDEX = null;
/** key → the symbols it names: every directory company's core name, and every everyday name. Built once, on first use. */
function lookupIndex() {
  if (INDEX) return INDEX;
  const index = new Map();
  const add = (key, symbol) => {
    if (!key) return;
    const hits = index.get(key) ?? new Set();
    hits.add(symbol);
    index.set(key, hits);
  };
  for (const [symbol, [name]] of Object.entries(RESEARCH_DIRECTORY)) add(lookupKeyOf(name), symbol);
  for (const [name, symbol] of EVERYDAY_NAMES) add(lookupKeyOf(name), symbol);
  INDEX = index;
  return index;
}

/**
 * A company named in words: the symbol whose directory core name — or listed everyday name — it is, when EXACTLY ONE
 * matches and that symbol is on the research list and not retired; null for none, or for more than one (never a
 * guess). The game's 228 are not in the directory: a game company named in words is found only through an everyday
 * name (Build 3b's offline check found no game name equal to a directory core name; the report says so).
 */
export function lookupName(name) {
  const key = lookupKeyOf(name);
  const hits = key ? lookupIndex().get(key) : null;
  if (!hits || hits.size !== 1) return null;
  const [symbol] = hits;
  return researchList.has(symbol) && !researchList.retired(symbol) ? symbol : null;
}

const EVERYDAY_BY_SYMBOL = new Map();
for (const [name, symbol] of EVERYDAY_NAMES) EVERYDAY_BY_SYMBOL.set(symbol, [...(EVERYDAY_BY_SYMBOL.get(symbol) ?? []), lookupKeyOf(name)]);
/** Is `companyName` a listed everyday name for `symbol` ("Google" for GOOGL)? */
export function isEverydayNameOf(companyName, symbol) {
  const key = lookupKeyOf(companyName);
  return key !== '' && (EVERYDAY_BY_SYMBOL.get(symbol) ?? []).includes(key);
}

/**
 * isSameCompany on a research session (companies.js asks this first). True or false when it decides; null hands the
 * question back to the game list's word rule (one of the 228 named in words, as on a game session):
 *   - the symbol itself, written in capitals ("GLW"), unless that word is another company's name ("HP" is HP Inc's name
 *     and Helmerich & Payne's symbol: false, never a guess);
 *   - a listed everyday name for the symbol ("Google" for GOOGL; RU-20);
 *   - a research-only company only by its WHOLE core name ("Corning" or "Corning Inc" for Corning Incorporated), never a
 *     part of it: "Apple" is not Apple Hospitality REIT, "Taiwan" is not Taiwan Semiconductor Manufacturing. The game
 *     list's word rule would accept a part, and the directory's 2,241 names are full of common words.
 */
export function sameCompany(companyName, { symbol, name }) {
  const c = String(companyName ?? '').trim();
  if (typeof symbol !== 'string' || !c) return false;
  if (c.replace(/\./g, '-') === symbol) {
    const byName = lookupName(c);
    return byName === null || byName === symbol;
  }
  if (isEverydayNameOf(c, symbol)) return true;
  if (isResearchStock(symbol)) {
    const key = lookupKeyOf(c);
    const names = [name, researchNameOf(symbol)].filter((x) => typeof x === 'string' && x.trim());
    return key !== '' && names.some((x) => lookupKeyOf(x) === key);
  }
  return null;
}

// ── eligibility (section 5.8) ─────────────────────────────────────────────────────────────────────────────────────

/** 'eligible' for one of the 228 (not retired); 'research' for a research-only company; 'outside' otherwise. */
export function eligibilityOf(symbol) {
  if (gameUniverse.has(symbol) && !gameUniverse.retired(symbol)) return 'eligible';
  if (isResearchStock(symbol) && !researchList.retired(symbol)) return 'research';
  return 'outside';
}

/** The research-only symbols among these (a saved idea's line, RU-18), worked out each time from the symbols. */
export const researchOnlyOf = (symbols) => (Array.isArray(symbols) ? symbols : []).filter((s) => eligibilityOf(s) === 'research');

// ── the universes ───────────────────────────────────────────────────────────────────────────────────────────────

/** A research session's universe (see the header). Frozen. */
export const RESEARCH_SESSION_UNIVERSE = Object.freeze({
  has: researchList.has,
  retired: researchList.retired,
  research: true,
  strictCase: true,
  lookupName,
  sameCompany,
  eligibilityOf,
});

/** The universe a session's helpers are handed: the research session's, or the game's exactly as before. */
export const universeOf = (session) => (isResearchSession(session) ? RESEARCH_SESSION_UNIVERSE : gameUniverse);
