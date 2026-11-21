// api/_utils/sharedResearch/explore.js
//
// Shared Research B6a X-1 — WHAT EXPLORE IS TOLD, pure. The read
// `GET /api/forge/shared-research?list=explore` answers `{ quota, items }`: one
// item per Explore story the player has investigated, each
//   { itemRef: { recordKind, recordId }, itemVersion,
//     open: { sessionId, question, lastTurnAt, filled, parts, stepsLeft, findingsCount } | null,
//     last: { sessionId, ended: 'saved' | 'concluded', at } | null }
// This module shapes that answer from the sessions and records store.js read
// (readExploreInvestigations). No I/O, no clock.
//
//   open   the story's open investigation (the newest, as `open` itself picks it:
//          session.js liveSessionOf). `question` is the record's question, the one
//          the investigation was opened with; `filled` is the thesis view's own
//          count (thesis.js thesisViewOf), null for a session that is not a thesis
//          builder; `parts` is the card's part count; `stepsLeft` is the session
//          view's budget less its steps used.
//   last   the newest investigation of the story that ENDED as a saved thesis (or a
//          saved idea) or was concluded: a `completed` session. A discarded one
//          (`abandoned`) is never reported.
// A story whose investigations were all discarded has no item.

import { THESIS_PARTS, EXPLORE_RECORD_KIND } from '../../../src/constants/sharedResearch.js';
import { itemKeyOf, liveSessionOf, sessionViewOf } from './session.js';
import { isBuilder, cardContextOf, thesisViewOf } from './thesis.js';
import { companiesOf } from './companies.js';

/**
 * The most sessions one query reads (each of the two: the open ones and the completed ones). A player opens at most
 * three investigations a day (PER_DAY), so 30 is ten days of opening nothing but Explore stories and closing none.
 */
export const EXPLORE_READ_MAX = 30;
/** The most documents one call reads: the quota, two queries of EXPLORE_READ_MAX sessions, one record per open story. */
export const EXPLORE_DOCS_MAX = 1 + 3 * EXPLORE_READ_MAX;

const isText = (v) => typeof v === 'string' && v.length > 0;
const isExplore = (s) => s?.entry?.itemRef?.recordKind === EXPLORE_RECORD_KIND && isText(s.entry.itemRef.recordId) && isText(itemKeyOf(s.entry.itemRef));

/** The newest open session per story (`open`'s own choice: liveSessionOf), keyed by itemKey. */
export function livePerStoryOf(sessions) {
  const by = new Map();
  for (const s of (Array.isArray(sessions) ? sessions : []).filter((x) => isExplore(x) && x.status === 'open')) {
    const key = itemKeyOf(s.entry.itemRef);
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  return new Map([...by].map(([key, list]) => [key, liveSessionOf(list)]));
}

/** Newest created first, then newest updated (one story's investigations run one after another). */
const newestCreatedFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);

/** The newest `completed` session per story — saved or concluded; never a discarded (`abandoned`) one. */
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

/** How the last closed investigation ended: saved (the session carries its adoption) or concluded, and when. */
export function exploreLastOf(session) {
  const saved = isText(session.adoption?.watchlistId);
  return {
    sessionId: session.sessionId,
    ended: saved ? 'saved' : 'concluded',
    // the close's own time: the save's (adoption.at) or the close's (a closed session's updatedAt never moves again)
    at: saved && isText(session.adoption.at) ? session.adoption.at : session.updatedAt ?? null,
  };
}

/**
 * The items, newest activity first (then by story id). `records`: sessionId → the open session's record (or null).
 * @param {{ live: Map<string, object>, last: Map<string, object>, records: Map<string, object|null> }} p
 */
export function exploreItemsOf({ live, last, records }) {
  const keys = [...new Set([...live.keys(), ...last.keys()])];
  const items = keys.map((key) => {
    const open = live.get(key) ?? null;
    const closed = last.get(key) ?? null;
    const latest = open ?? closed;
    const version = latest.entry?.itemVersion;
    return {
      at: [open?.updatedAt, closed?.updatedAt].filter(isText).sort().at(-1) ?? '',
      item: {
        itemRef: { recordKind: latest.entry.itemRef.recordKind, recordId: latest.entry.itemRef.recordId },
        itemVersion: Number.isSafeInteger(version) ? version : null,
        open: open ? exploreOpenOf(open, records.get(open.sessionId) ?? null) : null,
        last: closed ? exploreLastOf(closed) : null,
      },
    };
  });
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.item.itemRef.recordId < b.item.itemRef.recordId ? -1 : 1));
  return items.map((x) => x.item);
}
