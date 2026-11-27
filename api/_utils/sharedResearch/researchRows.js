// api/_utils/sharedResearch/researchRows.js
//
// Research universe Build 3b, build prompt sections 5.4 and 6: on a RESEARCH session (sessionUniverse.js), a
// company's name and a research company's numbers. Nothing here runs on a game-list session: namesFor hands it to
// store.js readNames exactly as before, and the route reads a game-list session's rows exactly as PR A leaves them.
//
//   namesFor                  "what is this symbol's company name" (section 5.4): a game stock's peerRankings/{sym}.name
//                             as today; a research stock's kept research record's name when there is one, else the
//                             directory's (researchNameOf).
//   fetchableOf               the research companies this investigation may fetch numbers for: at most 10 (section 6),
//                             fixed in order — the names in scope at open, then each research company in the order its
//                             first Source-backed relationship finding entered the record. Findings are appended and
//                             never removed (a correction supersedes), so the first ten never change: an investigation
//                             can never fetch for an eleventh, whatever is superseded later.
//   researchRowsFor           the stored rows of a research session: the names in scope at open and the idea's
//                             supported companies. A game stock's row is PR A's; a research company's row is its name
//                             and symbol, its sector, no rank, and its measures as kept (researchMeasures/{sym}).
//
// THE NUMBERS ARE FETCHED THROUGH fetchResearchStock (Build 2), unchanged: its 200-a-day ceiling, its 7-day keep and its
// once-a-day retry all apply, and it claims at most one fetch per symbol per UTC day. A fetch that throws, is refused or
// fails never fails the caller: the row says the numbers are not available today. The store, the key, the network and
// the clock are passed in.

import { STOCK_UNIVERSE } from '../rankingConfig.js';
import { fetchResearchStock, readResearchStock } from '../researchMeasures.js';
import { isResearchStock, researchNameOf, researchSectorOf } from '../researchUniverse.js';
import { readNames, readRankingRows } from './store.js';
import { storedRowsOf } from './opening.js';
import { isResearchSession } from './sessionUniverse.js';

/** Section 6: at most this many research companies are fetched per investigation. */
export const RESEARCH_FETCHES_PER_INVESTIGATION = 10;
/** A research row's numbers: shown (kept or fetched), not fetched (past the tenth), or not available today. */
export const NUMBERS = Object.freeze({ shown: 'shown', notFetched: 'not_fetched', notAvailable: 'not_available' });

/** Company names for symbols on this session (section 5.4); a game-list session reads exactly as store.js readNames. */
export async function namesFor(db, symbols, session) {
  if (!isResearchSession(session)) return readNames(db, symbols);
  const research = symbols.filter((s) => isResearchStock(s));
  const names = await readNames(db, symbols.filter((s) => !isResearchStock(s)));
  const kept = await Promise.all(research.map((s) => readResearchStock(db, s)));
  research.forEach((s, i) => {
    const n = kept[i]?.record?.name;
    const name = typeof n === 'string' && n.trim() ? n.trim() : researchNameOf(s);
    if (name) names[s] = name;
  });
  return names;
}

/** The research companies this investigation may fetch numbers for, in their fixed order (at most 10). */
export function fetchableOf(session, record) {
  const order = [];
  const add = (s) => { if (typeof s === 'string' && isResearchStock(s) && !order.includes(s)) order.push(s); };
  for (const s of Array.isArray(session?.entry?.names) ? session.entry.names : []) add(s);
  for (const f of Array.isArray(record?.findings) ? record.findings : []) {
    if (f?.kind === 'relationship' && f.status === 'verified') add(f.symbol);
  }
  return order.slice(0, RESEARCH_FETCHES_PER_INVESTIGATION);
}

/** The rows' symbols on a research session: the names in scope at open, then the idea's supported companies. */
export const rowSymbolsOf = (session, companies) => [...new Set([
  ...(Array.isArray(session?.entry?.names) ? session.entry.names : []),
  ...(Array.isArray(companies?.supported) ? companies.supported : []).map((c) => c.symbol),
])];

/** Kept numbers: a record with status 'ok' and its measures (a failed refetch keeps them, marked — Build 2 Q-6). */
const hasNumbers = (r) => r?.status === 'ok' && r.metrics !== null && typeof r.metrics === 'object';
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** A research company's row, from what is kept for it (null: nothing) and whether it may be fetched. */
export function researchRowOf(symbol, record, { fetchable, name = null, nowMs }) {
  const sectorId = researchSectorOf(symbol);
  const sector = STOCK_UNIVERSE[sectorId]?.name ?? null;
  const shown = fetchable && hasNumbers(record);
  const fetchedAt = shown && typeof record.fetchedAt === 'string' ? record.fetchedAt : null;
  return {
    symbol,
    name: name ?? (typeof record?.name === 'string' && record.name.trim() ? record.name.trim() : researchNameOf(symbol) ?? symbol),
    research: true,
    peer: { sector, metrics: shown ? record.metrics : null, asOf: fetchedAt },
    ranking: null, // RU-15: a research company shows its own numbers and no rank
    numbers: !fetchable ? NUMBERS.notFetched : shown ? NUMBERS.shown : NUMBERS.notAvailable,
    stale: Boolean(fetchedAt) && Number.isFinite(nowMs) && nowMs - Date.parse(fetchedAt) > KEEP_MS,
    reportsIn: shown && typeof record.reportsIn === 'string' ? record.reportsIn : null,
    heldBack: shown && Array.isArray(record.heldBack) ? [...record.heldBack] : [],
  };
}

/**
 * The stored rows of a research session, in order: the names in scope at open, then the idea's supported companies.
 * `fetch`: { apiKey, fetchImpl, now, deadlineAt } to fetch a fetchable company's numbers when needed (an open or a
 * read; a step only while time remains), or null to read what is kept and fetch nothing. Every fetch is sequential
 * (one daily counter), stops once `deadlineAt` is near, and never throws.
 */
export async function researchRowsFor(db, { session, record, companies, names = {}, fetch = null }) {
  const symbols = rowSymbolsOf(session, companies);
  const game = symbols.filter((s) => !isResearchStock(s));
  const gameRows = new Map((game.length ? storedRowsOf(game, await readRankingRows(db, game)) : []).map((r) => [r.symbol, r]));
  const fetchable = new Set(fetchableOf(session, record));
  const now = typeof fetch?.now === 'function' ? fetch.now : () => new Date();
  const rows = [];
  for (const symbol of symbols) {
    if (!isResearchStock(symbol)) { rows.push(gameRows.get(symbol)); continue; }
    let kept = null;
    if (fetchable.has(symbol)) {
      try {
        const late = fetch && Number.isFinite(fetch.deadlineAt) && Date.now() > fetch.deadlineAt;
        kept = fetch && !late
          ? (await fetchResearchStock(symbol, { db, apiKey: fetch.apiKey, fetchImpl: fetch.fetchImpl, now })).record
          : (await readResearchStock(db, symbol)).record;
      } catch (err) {
        console.warn('[shared-research] research numbers not available:', symbol, err?.message || err);
        kept = null;
      }
    }
    rows.push(researchRowOf(symbol, kept, { fetchable: fetchable.has(symbol), name: names[symbol] ?? null, nowMs: now().getTime() }));
  }
  return rows;
}
