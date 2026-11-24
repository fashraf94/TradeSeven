// api/_utils/sharedResearch/explore.js
//
// Shared Research B6a X-1 — WHAT EXPLORE IS TOLD, pure. The read
// `GET /api/forge/shared-research?list=explore` answers `{ quota, items }`: one
// item per Explore story the player has investigated, each
//   { itemRef: { recordKind, recordId }, itemVersion,
//     open: { sessionId, question, lastTurnAt, filled, parts, stepsLeft, findingsCount } | null,
//     last: { sessionId, ended: 'saved' | 'concluded', at, question, statement } | null }
// This module shapes that answer from the sessions store.js
// readExploreInvestigations gathers. No I/O, no clock. (B6c X-9 adds the read's
// top-level `agent`, shaped in store.js exploreAgentOf beside the ranked-agent rule.)
//
// The sessions come from three reads (store.js): the open Explore sessions and
// the completed ones (exact equality queries, each bounded), and the player's
// newest research records, whose Explore investigations' sessions are read when
// the queries did not return them — so the newest investigations are always
// held, newest first, whatever the queries' bounds left out (review HB-2, RF-2,
// RF-3). A session held twice counts once, ended if either read saw it ended
// (review RF-4).
//
//   open   the story's open investigation (the newest, as `open` itself picks it:
//          session.js liveSessionOf). `question` is the record's question, the one
//          the investigation was opened with; `filled` is the thesis view's own
//          count (thesis.js thesisViewOf), null for a session that is not a thesis
//          builder; `parts` is the card's part count; `stepsLeft` is the session
//          view's budget less its steps used.
//   last   the story's newest investigation that ENDED as a saved thesis (or a saved
//          idea) or was concluded: a `completed` session — saved when it carries its
//          adoption — at the time it closed. A discarded one (`abandoned`) is never
//          reported. B6c X-8: `question` is its research record's question, the one
//          it was opened with (the session holds none), null when the record cannot
//          be read; `statement` is, for a saved one, the statement the save recorded
//          on the session's adoption (a thesis save only, B6a X-7), else null.
//   itemVersion  the story version the newest of the two was opened on.
// A story whose investigations were all discarded has no item.

import { THESIS_PARTS, EXPLORE_RECORD_KIND } from '../../../src/constants/sharedResearch.js';
import { itemKeyOf, liveSessionOf, sessionViewOf, SESSIONS_COLLECTION } from './session.js';
import { isBuilder, cardContextOf, thesisViewOf } from './thesis.js';
import { companiesOf } from './companies.js';

/**
 * The open Explore sessions the exact query reads, at most. A player opens at most three investigations a day
 * (PER_DAY), so this is ten days of opening nothing but Explore stories and closing none.
 */
export const EXPLORE_OPEN_READ = 30;
/** The completed Explore sessions the exact query reads, at most (in no order: the newest are held by the window). */
export const EXPLORE_ENDED_READ = 30;
/** The player's newest research records read (the window store.js listOpen reads for "Continue your research"). */
export const EXPLORE_RECORDS_READ = 50;
/**
 * The most documents one call reads, besides the player's agent documents: the quota; the two session queries; the
 * records window; for each Explore record in the window whose session the queries did not return, that session; for
 * each open investigation whose record the window does not hold, that record; and (B6c X-8) for each last-ended
 * investigation whose record the window does not hold, that record. Those are sessions the completed query returned —
 * one the window found has its record in the window — so at most EXPLORE_ENDED_READ.
 *
 * Plus (B6c X-9) the agents query `open` already runs (store.js agentsQueryOf: `ownerId ==`): it reads every agent
 * document the player owns — the ranked agent and its training and casual clones. It is UNBOUNDED by owner, as it is at
 * `open`, on purpose: a limit could drop the ranked agent.
 */
export const EXPLORE_DOCS_MAX = 1 + EXPLORE_OPEN_READ + EXPLORE_ENDED_READ + 2 * EXPLORE_RECORDS_READ + EXPLORE_OPEN_READ + EXPLORE_ENDED_READ;

const isText = (v) => typeof v === 'string' && v.length > 0;
const isExplore = (s) => s?.entry?.itemRef?.recordKind === EXPLORE_RECORD_KIND && isText(s.entry.itemRef.recordId) && isText(itemKeyOf(s.entry.itemRef));

/**
 * The Explore story a Shared Research record was opened on, or null: its opening finding (always its first — the
 * opening is appended at mint, and findings are never removed) is the story's coverage, citing `exploreStories`.
 */
export function exploreStoryOfRecord(record) {
  const first = Array.isArray(record?.findings) ? record.findings[0] : null;
  if (record?.origin !== 'shared_research' || record.host?.collection !== SESSIONS_COLLECTION || !isText(record.host?.id)) return null;
  return first?.kind === 'coverage' && first.source?.recordKind === EXPLORE_RECORD_KIND && isText(first.source.recordId) ? first.source.recordId : null;
}

/**
 * The window's Explore records whose sessions are not held yet and could be reported: open, or closed `completed`
 * (a discarded one, `abandoned`, is never reported, so its session is not read).
 */
export const sessionsToReadOf = (records, held) => (Array.isArray(records) ? records : [])
  .filter((r) => exploreStoryOfRecord(r) && (r.state === 'open' || r.state === 'completed') && !held.has(r.host.id))
  .map((r) => r.host.id);

/** Every session held once, by id: a session any read saw ended counts as ended (review RF-4). */
export function sessionsByIdOf(lists) {
  const out = new Map();
  for (const s of lists.flat()) {
    if (!isText(s?.sessionId)) continue;
    const prior = out.get(s.sessionId);
    if (!prior || (prior.status === 'open' && s.status !== 'open')) out.set(s.sessionId, s);
  }
  return out;
}

/** The newest open session per story (`open`'s own choice: liveSessionOf), keyed by itemKey. */
export function livePerStoryOf(sessions) {
  const by = new Map();
  for (const s of (Array.isArray(sessions) ? sessions : []).filter((x) => isExplore(x) && x.status === 'open')) {
    const key = itemKeyOf(s.entry.itemRef);
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  return new Map([...by].map(([key, list]) => [key, liveSessionOf(list)]));
}

/** Newest created first, then newest updated (one story's investigations run one after another), then by id. */
const newestCreatedFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1
  : a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.sessionId < b.sessionId ? 1 : -1);

/** The newest `completed` session per story — saved or concluded; never a discarded (`abandoned`) one — keyed by itemKey. */
export function lastPerStoryOf(sessions) {
  const out = new Map();
  for (const s of (Array.isArray(sessions) ? sessions : []).filter((x) => isExplore(x) && x.status === 'completed').sort(newestCreatedFirst)) {
    const key = itemKeyOf(s.entry.itemRef);
    if (!out.has(key)) out.set(key, s);
  }
  return out;
}

/** The open investigation as Explore reads it. `record`: its research record (owned), or null when it cannot be read. */
export function exploreOpenOf(session, record) {
  const view = sessionViewOf(session);
  return {
    sessionId: session.sessionId,
    question: record?.question ?? null,
    lastTurnAt: record?.telemetry?.lastTurnAt ?? null,
    // the thesis view's count — the number the sheet's card shows (§B4.4), never a recount of the stored states
    filled: isBuilder(session) && record ? thesisViewOf(session.thesis, cardContextOf({ record, supported: companiesOf(record).supported, session })).filled : null,
    parts: THESIS_PARTS.length,
    stepsLeft: Math.max(0, view.stepBudget - view.stepsUsed),
    findingsCount: Array.isArray(record?.findings) ? record.findings.length : 0,
  };
}

/**
 * How the last ended investigation ended: saved (the session carries its adoption — written in the save's one
 * transaction with the record's `saved_to_list`) or concluded, and when: the save's time, or the close's (a closed
 * session's `updatedAt` never moves again; both equal the record's `endedAt`).
 * B6c X-8 — `record`: its research record (owned), or null when it cannot be read.
 *   question   the record's question, the one the investigation was opened with (exploreOpenOf's own read); null
 *              with no record.
 *   statement  for a saved one, the statement the save recorded on the session's adoption (B6a X-7: written by a
 *              thesis save only) when it is a non-empty string; null when concluded, and null for a save that
 *              recorded none (an older-style idea save, or a thesis saved before B6a). Never the card's composed
 *              sentence or the list's card: what the save recorded, or nothing.
 */
export function exploreLastOf(session, record = null) {
  const saved = isText(session.adoption?.watchlistId);
  return {
    sessionId: session.sessionId,
    ended: saved ? 'saved' : 'concluded',
    at: saved && isText(session.adoption.at) ? session.adoption.at : session.updatedAt ?? null,
    question: record?.question ?? null,
    statement: saved && isText(session.adoption.statement) ? session.adoption.statement : null,
  };
}

/**
 * The items, newest activity first (then by story id).
 * @param {object} p
 * @param {Map<string, object>} p.live      itemKey → the story's open session
 * @param {Map<string, object>} p.last      itemKey → the story's last ended session
 * @param {Map<string, object|null>} p.records   sessionId → an open or last-ended session's record (null when it
 *                                               cannot be read)
 */
export function exploreItemsOf({ live, last, records }) {
  const keys = [...new Set([...live.keys(), ...last.keys()])];
  const items = keys.map((key) => {
    const open = live.get(key) ?? null;
    const ended = last.get(key) ?? null;
    const latest = open ?? ended;
    const version = latest.entry?.itemVersion;
    return {
      at: [open?.updatedAt, ended?.updatedAt].filter(isText).sort().at(-1) ?? '',
      item: {
        itemRef: { recordKind: EXPLORE_RECORD_KIND, recordId: latest.entry.itemRef.recordId },
        itemVersion: Number.isSafeInteger(version) ? version : null,
        open: open ? exploreOpenOf(open, records.get(open.sessionId) ?? null) : null,
        last: ended ? exploreLastOf(ended, records.get(ended.sessionId) ?? null) : null,
      },
    };
  });
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.item.itemRef.recordId < b.item.itemRef.recordId ? -1 : 1));
  return items.map((x) => x.item);
}
