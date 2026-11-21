// api/_utils/sharedResearch/explore.js
//
// Shared Research B6a X-1 — WHAT EXPLORE IS TOLD, pure. The read
// `GET /api/forge/shared-research?list=explore` answers `{ quota, items }`: one
// item per Explore story the player has investigated, each
//   { itemRef: { recordKind, recordId }, itemVersion,
//     open: { sessionId, question, lastTurnAt, filled, parts, stepsLeft, findingsCount } | null,
//     last: { sessionId, ended: 'saved' | 'concluded', at } | null }
// This module shapes that answer from what store.js readExploreInvestigations
// reads. No I/O, no clock.
//
//   open   the story's open investigation (the newest, as `open` itself picks it:
//          session.js liveSessionOf), from the player's open Explore sessions.
//          `question` is the record's question, the one the investigation was
//          opened with; `filled` is the thesis view's own count (thesis.js
//          thesisViewOf), null for a session that is not a thesis builder; `parts`
//          is the card's part count; `stepsLeft` is the session view's budget less
//          its steps used.
//   last   the story's newest investigation that ENDED as a saved thesis (or a saved
//          idea) or was concluded, from the player's newest research records (the
//          window "Continue your research" reads): its record closed `completed`,
//          `saved_to_list` or `concluded`, at its `endedAt`. A discarded one
//          (`abandoned`) is never reported.
//   itemVersion  the story version the newest of the two was opened on.
// A story whose investigations were all discarded has no item.

import { THESIS_PARTS, EXPLORE_RECORD_KIND } from '../../../src/constants/sharedResearch.js';
import { TERMINAL_REASONS } from '../researchRecords/model.js';
import { itemKeyOf, liveSessionOf, sessionViewOf, SESSIONS_COLLECTION } from './session.js';
import { isBuilder, cardContextOf, thesisViewOf } from './thesis.js';
import { companiesOf } from './companies.js';

/**
 * The open Explore sessions read, at most. An open investigation is found by an exact query on the sessions, so it is
 * missed only past this many open at once: a player opens at most three a day (PER_DAY), so this is ten days of opening
 * nothing but Explore stories and closing none.
 */
export const EXPLORE_OPEN_READ = 30;
/**
 * The research records read for `last`, newest first (the window store.js listOpen reads for "Continue your research",
 * LIST_OPEN_READ). An ended investigation older than the player's newest this-many research records is not reported.
 */
export const EXPLORE_RECORDS_READ = 50;
/**
 * The most documents one call reads: the quota; the open sessions and, for each, its record when the window does not
 * hold it; the window of records; and, for each story reported with only an ended investigation, that session (its
 * story version).
 */
export const EXPLORE_DOCS_MAX = 1 + 2 * EXPLORE_OPEN_READ + 2 * EXPLORE_RECORDS_READ;

const isText = (v) => typeof v === 'string' && v.length > 0;
const isExplore = (s) => s?.entry?.itemRef?.recordKind === EXPLORE_RECORD_KIND && isText(s.entry.itemRef.recordId) && isText(itemKeyOf(s.entry.itemRef));
const keyOfStory = (storyId) => itemKeyOf({ recordKind: EXPLORE_RECORD_KIND, recordId: storyId });

/** The newest open session per story (`open`'s own choice: liveSessionOf), keyed by itemKey. */
export function livePerStoryOf(sessions) {
  const by = new Map();
  for (const s of (Array.isArray(sessions) ? sessions : []).filter((x) => isExplore(x) && x.status === 'open')) {
    const key = itemKeyOf(s.entry.itemRef);
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  return new Map([...by].map(([key, list]) => [key, liveSessionOf(list)]));
}

/**
 * The Explore story a Shared Research record was opened on, or null: its opening finding (always its first — the
 * opening is appended at mint, and findings are never removed) is the story's coverage, citing `exploreStories`.
 */
export function exploreStoryOfRecord(record) {
  const first = Array.isArray(record?.findings) ? record.findings[0] : null;
  if (record?.origin !== 'shared_research' || record.host?.collection !== SESSIONS_COLLECTION || !isText(record.host?.id)) return null;
  return first?.kind === 'coverage' && first.source?.recordKind === EXPLORE_RECORD_KIND && isText(first.source.recordId) ? first.source.recordId : null;
}

const ENDINGS = Object.freeze({ [TERMINAL_REASONS.savedToList]: 'saved', [TERMINAL_REASONS.concluded]: 'concluded' });
/** Newest created first (one story's investigations run one after another), then by id. */
const newestCreatedFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.researchWorkId < b.researchWorkId ? 1 : -1);

/** Per story, its newest record that ended saved or concluded — never a discarded one — keyed by itemKey. */
export function lastPerStoryOf(records) {
  const out = new Map();
  const ended = (Array.isArray(records) ? records : [])
    .filter((r) => exploreStoryOfRecord(r) && r.state === 'completed' && Object.hasOwn(ENDINGS, r.terminalReason ?? ''))
    .sort(newestCreatedFirst);
  for (const r of ended) {
    const key = keyOfStory(exploreStoryOfRecord(r));
    if (!out.has(key)) out.set(key, r);
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

/** How the story's last ended investigation ended, from its record: saved or concluded, and when it closed. */
export const exploreLastOf = (record) => ({
  sessionId: record.host.id,
  ended: ENDINGS[record.terminalReason],
  at: isText(record.endedAt) ? record.endedAt : null,
});

/**
 * The items, newest activity first (then by story id).
 * @param {object} p
 * @param {Map<string, object>} p.live      itemKey → the story's open session
 * @param {Map<string, object>} p.last      itemKey → the story's last ended record
 * @param {Map<string, object|null>} p.records   sessionId → an open session's record (null when it cannot be read)
 * @param {Map<string, object|null>} p.sessions  sessionId → the session of a story's last ended record, where the story
 *                                               has no open one (its story version), null when it cannot be read
 */
export function exploreItemsOf({ live, last, records, sessions }) {
  const keys = [...new Set([...live.keys(), ...last.keys()])];
  const items = keys.map((key) => {
    const open = live.get(key) ?? null;
    const ended = last.get(key) ?? null;
    const storyId = open ? open.entry.itemRef.recordId : exploreStoryOfRecord(ended);
    const versionFrom = open ?? sessions.get(ended.host.id) ?? null;
    const version = versionFrom?.entry?.itemVersion;
    return {
      at: [open?.updatedAt, ended?.endedAt].filter(isText).sort().at(-1) ?? '',
      item: {
        itemRef: { recordKind: EXPLORE_RECORD_KIND, recordId: storyId },
        itemVersion: Number.isSafeInteger(version) ? version : null,
        open: open ? exploreOpenOf(open, records.get(open.sessionId) ?? null) : null,
        last: ended ? exploreLastOf(ended) : null,
      },
    };
  });
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.item.itemRef.recordId < b.item.itemRef.recordId ? -1 : 1));
  return items.map((x) => x.item);
}
