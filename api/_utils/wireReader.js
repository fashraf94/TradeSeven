// api/_utils/wireReader.js
// FantasyTimes Wire — THE raw Wire reader (Phase 2 Spec V1.3 N1.0, named
// build work per Amendment H / discovery D10).
//
// This module is the single sanctioned read path over persisted Wire day
// docs for CONSUMERS. It exists so the N1.1 boundary has a name: when the
// AgentSafeWireEntry DTO lands (P3), the import-graph dependency test
// forbids every consumer except agentSafeWireEntry.js from importing this
// module — and the DTO is the only thing consumers see. Until then, NOTHING
// imports this module in production; it ships ahead of its consumers by
// design, so the boundary exists before the first consumer does.
//
// RAW means raw: entries come back exactly as persisted, INCLUDING
// `headline` (founder readability only, P7) — stripping is the DTO's job
// (explicit field copy, F-M7), never the reader's. That is why this module
// must never be imported by a prompt-facing consumer directly.
//
// Writer-internal reads (wireWriteThrough's transaction reread, the sweep's
// terminal paths, cleanup's retention scan) do NOT route through here —
// they are the write machinery itself, not consumers, and their read shapes
// are transactional. buildContinuityContext keeps its own read (it predates
// this module; its fail-closed guard is N1.4 work and its reader/renderer
// split is a recorded open question, V1.3 Amendment H).
//
// I/O vs resolution are split for N1.2's one-fetch-per-tick budget: the
// voice-layer cache fetches today + prior session ONCE per tick
// (fetchWireDays), then resolves per portfolio/bench symbol from the
// in-memory docs (resolveSymbolEntries, pure).

import { WIRE_COLLECTION } from './wireContracts.js';

/**
 * Fetch Wire day docs for the given market dates in one parallel batch.
 * Missing days are simply absent from the result map — a missing day is a
 * normal state (weekend, holiday, pre-Wire date), never an error.
 *
 * @param {object} db
 * @param {string[]} marketDates — 'YYYY-MM-DD' Wire market dates
 * @returns {Promise<Map<string, object>>} date → day-doc data
 */
export async function fetchWireDays(db, marketDates) {
  const snaps = await Promise.all(
    marketDates.map((d) => db.collection(WIRE_COLLECTION).doc(d).get())
  );
  const days = new Map();
  for (let i = 0; i < snaps.length; i++) {
    if (snaps[i].exists) days.set(marketDates[i], snaps[i].data());
  }
  return days;
}

/**
 * Resolve one symbol's raw entries from already-fetched day docs. Pure.
 *
 * Resolution is bySymbol → storyIds → entries[] (the persisted index is
 * rebuilt from entries inside every Wire transaction, M9, so it cannot
 * drift from entries in an uncorrupted doc). Two belts anyway:
 *   - quarantined entries are dropped even if an index ever referenced one
 *     (defense in depth; bySymbol excludes them by construction —
 *     rebuildIndexes skips quarantined before indexing);
 *   - a dangling storyId (indexed but absent from entries[]) is skipped,
 *     never a throw — corruption of a read-side index must not take down a
 *     consumer's tick (P3 analog).
 *
 * Order: days in the order given by `marketDates`; within a day, persisted
 * entries[] order (append-only, therefore chronological). Callers wanting
 * newest-first (N1.2) pass dates newest-first and/or reverse — ordering
 * POLICY belongs to the consumer, not the reader.
 *
 * @param {Map<string, object>} days — from fetchWireDays
 * @param {string[]} marketDates — the dates, in the order to scan
 * @param {string} symbol — validated in-universe ticker (uppercased)
 * @returns {Array<{ marketDate: string, entry: object }>}
 */
export function resolveSymbolEntries(days, marketDates, symbol) {
  const out = [];
  for (const date of marketDates) {
    const day = days.get(date);
    if (!day) continue;
    const storyIds = day.bySymbol?.[symbol];
    if (!Array.isArray(storyIds) || storyIds.length === 0) continue;
    const byId = new Map((day.entries || []).map((e) => [e.storyId, e]));
    for (const id of storyIds) {
      const entry = byId.get(id);
      if (!entry) continue;                    // dangling index id — skip, never throw
      if (entry.quarantined === true) continue; // belt: never surface quarantined
      out.push({ marketDate: date, entry });
    }
  }
  return out;
}
