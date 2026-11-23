// api/_utils/practiceField/agentSources.js
//
// Practice Field build B2 — WHAT A DESK MAY READ BEFORE ITS CALL (§2, §3), each bounded, READ-ONLY:
//
//   candidatesOf        the CANDIDATE LIST: every name the house universe carries (symbols.js isUniverseStock) that THIS
//                       close's stored snapshot prices (a complete quote), less the names the book's ideas already hold
//                       or have pending (admission would refuse them). Compact: symbol, sector, last close. Pure.
//
//   readPriorNotes      the desk's own last three notes, from the close rows of the sessions before this one (the window
//                       ledger, `mandates/{bookId}/windows/{session}_close` — the rows the owner can already read),
//                       looking back at most ten sessions. By document id: no query, no index.
//
//   readSavedTheses     THE OWNER'S SAVED THESES (ruling PF-5; behind PRACTICE_FIELD_AGENT_THESES_ENABLED; the Shadow desk
//                       only). The owner's saved lists that carry a thesis card, at most AGENT_THESES_QUERY_LIMIT read by
//                       two equality filters (served by the single-field indexes; no composite index — "no rules or index
//                       change"), sorted by the card's own save time, the five most recent kept. Each must pass the three
//                       requirements of the Practice Field's reply on the card (16 Nov; Shared Research Amendment B §B10,
//                       PF-1 to PF-3) or it is SKIPPED, and why is recorded:
//                         PF-1  the card is immutable at save: schema 1, the list it names is this list, idea version 1, its
//                               research session and save time present, the list committed and the owner's;
//                         PF-2  every finding id it carries resolves on its research record (`researchWork/{id}`, read
//                               once per card) to a finding with its text and its source;
//                         PF-3  the provenance stamp is on the list (`attribution`, with its agent and its time).
//                       What reaches the model is a bounded copy of the card's words — the statement, names, reasons, the
//                       "wrong if", the time frame and the price lines — labelled T1…T5 and quoted as UNTRUSTED PLAYER
//                       TEXT (agentPrompt.js). The card is a source, never an order: its time frame asks for a slot and
//                       reserves none; a price line informs a line distance and is not the line. The list's id never
//                       reaches the prompt; code resolves the label to it.
//
// THE CARD'S FIELD NAME. Shared Research pins that one module writes the card (thesisRecord.census.test.js, PF-1). This
// module is its one READER: it names the field once, in the constant below, and writes nothing — the census admits it as
// a reader and pins that it makes no write.

import { getSessionForDate } from '../marketSchedule.js';
import { isUniverseStock, mandateSectorOf, normSymbol } from './symbols.js';
import {
  AGENT_PRIOR_NOTES, AGENT_PRIOR_NOTES_LOOKBACK_SESSIONS, AGENT_THESES_MAX, AGENT_THESES_QUERY_LIMIT,
  AGENT_THESIS_TEXT_MAX, AGENT_THESIS_REASONS_MAX, AGENT_NOTE_SOURCE,
} from './agentConfig.js';
import { windowRowId, CLOSE_WINDOW } from './windows.js';

/** The saved card's field on a saved list (Shared Research thesis.js THESIS_CARD_FIELD) — read here, never written. */
const SAVED_CARD_FIELD = 'thesisCard';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;
const clip = (v, max) => (typeof v === 'string' ? [...v.trim()].slice(0, max).join('') : null);

/** The most candidates the list carries (the house universe is about 136 names). */
export const AGENT_CANDIDATES_MAX = 200;

/**
 * The candidate list from THIS close's stored snapshot. Pure.
 * @param {object} snapshot  the stored `${date}_close` document
 * @param {Set<string>} taken  names an idea of the book holds or has pending
 * @returns {Array<{ symbol: string, sector: string|null, lastClose: number }>}  sorted by symbol
 */
export function candidatesOf(snapshot, taken = new Set()) {
  const out = [];
  for (const [raw, e] of Object.entries(snapshot?.symbols || {})) {
    const sym = normSymbol(raw);
    if (sym === null || taken.has(sym) || !isUniverseStock(sym)) continue;
    if (e?.complete !== true || !(Number.isFinite(e.price) && e.price > 0)) continue;
    out.push({ symbol: sym, sector: mandateSectorOf(sym), lastClose: e.price });
  }
  out.sort((a, b) => (a.symbol < b.symbol ? -1 : (a.symbol > b.symbol ? 1 : 0)));
  return out.slice(0, AGENT_CANDIDATES_MAX);
}

/** The names the book's open ideas hold or have pending (admission's B-SAME set). Pure. */
export function namesTakenByBook(book, ideas) {
  const taken = new Set(Object.keys(book?.portfolio?.positions || {}));
  for (const idea of ideas) {
    for (const s of idea?.contract?.names || []) taken.add(s);
    for (const s of Object.keys(idea?.ledger?.holdings || {})) taken.add(s);
  }
  return taken;
}

const DAY_MS = 86_400_000;
const prevCalendarDate = (etDate) => {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) - DAY_MS).toISOString().slice(0, 10);
};

/** The trading session strictly before `etDate`, or null off the maintained calendar. */
export function previousSessionDate(etDate) {
  let cursor = etDate;
  for (let i = 0; i < 12; i += 1) {
    cursor = prevCalendarDate(cursor);
    const s = getSessionForDate(cursor);
    if (!s) return null;
    if (s.isTradingDay) return cursor;
  }
  return null;
}

/**
 * The desk's own last notes before `session`, newest first: only a note the model wrote and code accepted (a code
 * fallback or a desk with no work wrote none). At most AGENT_PRIOR_NOTES, looking back AGENT_PRIOR_NOTES_LOOKBACK_SESSIONS.
 * @returns {Promise<Array<{ session: string, note: string }>>}
 */
export async function readPriorNotes(bookRef, { session, desk }) {
  const out = [];
  let s = session;
  for (let i = 0; i < AGENT_PRIOR_NOTES_LOOKBACK_SESSIONS && out.length < AGENT_PRIOR_NOTES; i += 1) {
    s = previousSessionDate(s);
    if (s === null) break;
    const snap = await bookRef.collection('windows').doc(windowRowId(s, CLOSE_WINDOW)).get();
    const part = snap.exists ? snap.data()?.agent?.desks?.[desk] : null;
    if (part?.source === AGENT_NOTE_SOURCE.MODEL && isText(part.note)) out.push({ session: s, note: part.note });
  }
  return out;
}

/** PF-1: why a saved card is not the immutable card it must be, or null. Pure. */
export function cardIntegrityProblem(listId, list, card, uid) {
  if (!isPlain(list) || list.userId !== uid) return 'not_the_owners_list';
  if (list.status !== 'committed') return 'list_not_committed';
  if (!isPlain(card)) return 'card_missing';
  if (card.schemaVersion !== 1) return 'card_schema_unknown';
  if (card.watchlistId !== listId) return 'card_names_another_list';
  if (card.hypothesisVersion !== 1) return 'card_version_not_1';
  if (!isText(card.sessionId) || !isText(card.savedAt) || !Number.isFinite(Date.parse(card.savedAt))) return 'card_save_record_missing';
  if (!isText(card.researchWorkId) || card.researchWorkId !== list.researchWorkId) return 'card_record_mismatch';
  return null;
}

/** PF-3: is the provenance stamp on the list? Pure. */
export function provenanceProblem(list) {
  const a = list?.attribution;
  if (!isPlain(a) || !isText(a.agentId) || !isText(a.at)) return 'provenance_stamp_missing';
  return null;
}

/** Every finding id the card carries (its own list and each part's). Pure. */
export function cardFindingIds(card) {
  const ids = new Set();
  const add = (v) => { for (const id of (Array.isArray(v) ? v : [])) if (isText(id)) ids.add(id); };
  add(card?.findingIds);
  add(card?.segment?.findingIds);
  add(card?.wrongIf?.findingIds);
  add(card?.why?.against?.findingIds);
  for (const r of (Array.isArray(card?.why?.reasons) ? card.why.reasons : [])) add(r?.findingIds);
  return [...ids].sort();
}

/** PF-2: the finding ids the record cannot resolve to a finding with its text and source. Pure. */
export function unresolvedFindingIds(card, record) {
  const byId = new Map((Array.isArray(record?.findings) ? record.findings : []).map((f) => [f?.findingId, f]));
  return cardFindingIds(card).filter((id) => {
    const f = byId.get(id);
    return !(isPlain(f) && isText(f.fact) && isPlain(f.source));
  });
}

/** The bounded copy of a card the model sees. Pure. */
export function thesisViewOf(card, label) {
  const priceLines = (Array.isArray(card?.wrongIf?.priceLines) ? card.wrongIf.priceLines : [])
    .filter((p) => isPlain(p) && isText(p.symbol) && Number.isFinite(p.level))
    .slice(0, 8)
    .map((p) => ({ symbol: clip(p.symbol, 12), level: p.level }));
  return {
    label,
    statement: clip(card?.statement, AGENT_THESIS_TEXT_MAX),
    names: (Array.isArray(card?.names?.value) ? card.names.value : []).filter(isText).slice(0, 8).map((s) => clip(s, 12)),
    why: (Array.isArray(card?.why?.reasons) ? card.why.reasons : []).slice(0, AGENT_THESIS_REASONS_MAX)
      .map((r) => ({ symbol: clip(r?.symbol, 12), text: clip(r?.text, AGENT_THESIS_TEXT_MAX) })).filter((r) => r.text),
    wrongIf: clip(card?.wrongIf?.text, AGENT_THESIS_TEXT_MAX),
    timeFrame: clip(card?.timeFrame?.label ?? card?.timeFrame?.value, 40),
    priceLines,
  };
}

/**
 * The owner's saved theses the Shadow desk may read (see the header). Read-only.
 * @returns {Promise<{ theses: Array<object>, refs: Object<string, string>, skipped: Array<{ listId: string, reason: string }>,
 *                     read: number, truncated: boolean }>}  `refs`: label → saved list id (never shown to the model)
 */
export async function readSavedTheses(db, { uid }) {
  // The collection by its literal name, as Shared Research writes it (hypothesisRecords/model.js WATCHLISTS_COLLECTION).
  const page = await db.collection('watchlists')
    .where('userId', '==', uid)
    .where(`${SAVED_CARD_FIELD}.schemaVersion`, '==', 1)
    .limit(AGENT_THESES_QUERY_LIMIT)
    .get();
  const rows = page.docs.map((d) => ({ listId: d.id, list: d.data() }))
    .filter((r) => isPlain(r.list?.[SAVED_CARD_FIELD]))
    .sort((a, b) => {
      const x = String(a.list[SAVED_CARD_FIELD].savedAt ?? '');
      const y = String(b.list[SAVED_CARD_FIELD].savedAt ?? '');
      return x < y ? 1 : (x > y ? -1 : (a.listId < b.listId ? -1 : 1));
    })
    .slice(0, AGENT_THESES_MAX);
  const theses = [];
  const refs = {};
  const skipped = [];
  for (const { listId, list } of rows) {
    const card = list[SAVED_CARD_FIELD];
    const problem = cardIntegrityProblem(listId, list, card, uid) ?? provenanceProblem(list);
    if (problem) { skipped.push({ listId, reason: problem }); continue; }
    // The collection by its literal name (researchRecords/store.js researchWorkRefOf).
    const recordSnap = await db.collection('researchWork').doc(card.researchWorkId).get();
    const unresolved = unresolvedFindingIds(card, recordSnap.exists ? recordSnap.data() : null);
    if (!recordSnap.exists || unresolved.length > 0) { skipped.push({ listId, reason: recordSnap.exists ? 'finding_ids_unresolved' : 'research_record_missing' }); continue; }
    const label = `T${theses.length + 1}`;
    refs[label] = listId;
    theses.push(thesisViewOf(card, label));
  }
  return { theses, refs, skipped, read: page.docs.length, truncated: page.docs.length >= AGENT_THESES_QUERY_LIMIT };
}
