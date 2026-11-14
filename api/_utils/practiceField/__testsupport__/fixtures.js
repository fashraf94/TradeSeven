// api/_utils/practiceField/__testsupport__/fixtures.js
//
// Practice Field T1a-1 — TEST SUPPORT (never imported by a production path; lives under __testsupport__, which the
// engine's import-closure scans and the protected-store scan skip). Synthetic sessions, snapshots and contracts
// for the idea book's tests, on the engine's transaction-faithful in-memory Firestore.
//
// Every price here is a decimal on purpose (never a power-of-two fraction): cent boundaries only show with them.

import { makeMandateFakeDb } from '../../__testsupport__/mandateFakeFirestore.js';
import { etWallClockToMs } from '../../../../src/utils/marketCalendar.js';
import { resolveSessionSlots } from '../../mandateSessionSlots.js';
import { SNAPSHOT_COLLECTION } from '../../mandateUniverseSnapshot.js';

if (SNAPSHOT_COLLECTION !== 'mandateUniverseSnapshots') throw new Error('fixtures.js: the close-snapshot collection was renamed; update storeCloseSnapshot');
import { PRACTICE_FIELD_FUNDS } from '../../../../src/data/practiceFieldFunds.js';
import { createIdeaBook } from '../ideaBook.js';
import { admitIdea } from '../admission.js';
import { enterIdea, runIdeaBookEntryPass } from '../entry.js';
import { runIdeaBookWindow } from '../sweep.js';
import { closeIdeaBook } from '../close.js';

export { makeMandateFakeDb };

/** The epoch-ms instant of an ET wall-clock time on an ET date. */
export const etMs = (date, hour, minute) => etWallClockToMs(date, hour, minute);
export const etIso = (date, hour, minute) => new Date(etMs(date, hour, minute)).toISOString();

/** The engine tick of a slot on a date. */
export function tickOf(date, slot = 'open30') {
  return { date, slot, tickKey: `${date}_${slot}` };
}

/** The instant a slot opens on a date (ISO). */
export function slotOpenIso(date, slot = 'open30') {
  const s = resolveSessionSlots(date);
  const g = s.slots.find((x) => x.name === slot);
  return new Date(etMs(date, 9, 30) + (g.atMin - s.openMin) * 60_000).toISOString();
}

/**
 * A shared snapshot in the engine's own shape.
 * `quotes`: { SYM: number | { price, at?, marketCap?, corporateActions? } } — `at: null` is a quote with NO vendor
 * time (the builder then stamps its fetch instant into priceAsOf); `price: null` is an incomplete quote.
 *
 * MARKET CAP. A stock quote with no `marketCap` key gets FIXTURE_MARKET_CAP — a small-cap value whose tier costs
 * exactly what the engine's `unknown` tier costs, so every T1a-1 figure is unchanged while the leg stays eligible
 * under Amendment D's Q-1 (a leg with no resolvable cost tier does not enter). `marketCap: null`, written out, is a
 * stock with NO market cap: the Q-1 case. A fund never has one (its tier is explicit).
 */
export const FIXTURE_MARKET_CAP = 1e9;
export function snapshotOf({ tickKey, sessionDate, builtAt, quoteAt, quotes }) {
  const symbols = {};
  for (const [sym, raw] of Object.entries(quotes)) {
    const q = typeof raw === 'number' ? { price: raw } : raw;
    const complete = typeof q.price === 'number' && q.price > 0;
    const at = q.at === undefined ? quoteAt : q.at;
    const quoteTs = complete && at !== null ? Math.floor(Date.parse(at) / 1000) : null;
    symbols[sym] = {
      price: complete ? q.price : null,
      priceAsOf: complete ? (quoteTs !== null ? new Date(quoteTs * 1000).toISOString() : builtAt) : null,
      source: 'eodhd_realtime',
      complete,
      quoteTs,
      sector: null,
      industry: null,
      marketCap: Object.hasOwn(q, 'marketCap') ? q.marketCap : (Object.hasOwn(PRACTICE_FIELD_FUNDS, sym) ? null : FIXTURE_MARKET_CAP),
      ...(q.corporateActions?.length ? { corporateActions: q.corporateActions } : {}),
    };
  }
  return { schemaVersion: 1, tickKey, sessionDate, builtAt: new Date(builtAt), symbols };
}

/** A slot snapshot: built one minute into the slot, quotes observed fifteen minutes before it. */
export function tickSnapshot(date, slot, quotes) {
  const open = Date.parse(slotOpenIso(date, slot));
  return snapshotOf({
    tickKey: `${date}_${slot}`, sessionDate: date,
    builtAt: new Date(open + 60_000).toISOString(), quoteAt: new Date(open - 15 * 60_000).toISOString(), quotes,
  });
}

/** THE close snapshot of a date: built twenty minutes after the close, quotes observed at the close. */
export function closeSnapshot(date, quotes) {
  const s = resolveSessionSlots(date);
  const closeMs = etMs(date, 9, 30) + (s.closeMin - s.openMin) * 60_000;
  return snapshotOf({
    tickKey: `${date}_close`, sessionDate: date,
    builtAt: new Date(closeMs + 20 * 60_000).toISOString(), quoteAt: new Date(closeMs).toISOString(), quotes,
  });
}

/** A fixture contract (author and origin `founder_fixture`, no sources) with overrides. */
export function contractOf(overrides = {}) {
  const names = overrides.names ?? ['AAPL'];
  const slot = overrides.slot ?? 'short';
  const distance = { short: 0.05, medium: 0.1, long: 0.15 }[slot];
  return {
    thesis: { text: 'A fixture thesis for the accounting tests.', author: 'founder_fixture' },
    slot,
    names,
    comparison: { type: 'same_stock_held' },
    lines: names.map((symbol) => ({ symbol, distancePct: distance })),
    capitalUsd: 20000,
    origin: { kind: 'founder_fixture', initiatedBy: 'agent' },
    sources: [],
    ...overrides,
  };
}

/** The three sessions most tests use, and the admission instant before them. */
export const DAYS = Object.freeze({
  admit: '2026-11-13',     // Friday
  d1: '2026-11-16',        // Monday — the start session of an idea admitted on the 13th
  d2: '2026-11-17',
  d3: '2026-11-18',
  d4: '2026-11-19',
  d5: '2026-11-20',
});
export const ADMIT_ISO = etIso(DAYS.admit, 11, 0);

/** Every db a test seeded a book into since the last `takeSeededDbs()` — so a suite can scan everything its tests wrote. */
const SEEDED_DBS = [];
export function takeSeededDbs() { return SEEDED_DBS.splice(0, SEEDED_DBS.length); }

/** A sale's words. On a valuation row no KEY may carry one (the wider list); no key or value may carry the four the build prompt names. */
export const SALE_WORD_KEYS = /proceeds|realized|realised|sold|liquidat|sale|cashed|cash_?out|exit|dispos|redeem|closed_?out/i;
export const SALE_WORDS = /proceeds|realized|realised|sold|liquidat/i;
const keysDeep = (v, out = []) => {
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); keysDeep(x, out); }
  return out;
};
/** Every valuation row in a db that carries a sale's word, as `path: word` strings (B-MARK). */
export function saleWordsOnMarkRows(db) {
  const out = [];
  for (const [path, entry] of db._store.entries()) {
    const d = entry.data;
    if (!d || d.rowKind !== 'valuation') continue;
    if (d.basis !== 'mark') out.push(`${path}: basis ${d.basis}`);
    for (const k of keysDeep(d)) if (SALE_WORD_KEYS.test(k)) out.push(`${path}: key ${k}`);
    if (SALE_WORDS.test(JSON.stringify(d))) out.push(`${path}: value`);
  }
  return out;
}

/**
 * The three words a result may never carry (contract §4.4; concept V6.1 §4). Every `result` and every endpoint row in
 * a db that carries one, as a key or as a value, as `path: where` strings.
 */
export const BANNED_RESULT_WORDS = /validated|proven|supported/i;
export function bannedWordsOnResults(db) {
  const out = [];
  const scan = (path, doc, what) => {
    for (const k of keysDeep(doc)) if (BANNED_RESULT_WORDS.test(k)) out.push(`${path}: ${what} key ${k}`);
    const values = JSON.stringify(doc, (_k, v) => (v instanceof Date ? v.toISOString() : v));
    if (BANNED_RESULT_WORDS.test(values)) out.push(`${path}: ${what} value`);
  };
  for (const [path, entry] of db._store.entries()) {
    const d = entry.data;
    if (!d || typeof d !== 'object') continue;
    if (d.rowKind === 'endpoint') scan(path, d, 'endpoint row');
    if (/\/ideas\/[^/]+$/.test(path) && d.result !== null && typeof d.result === 'object') scan(path, d.result, 'result');
  }
  return out;
}

/** How many results and endpoint rows a db holds — so a suite can show its banned-word scan looked at something. */
export function countResults(db) {
  let n = 0;
  for (const [path, entry] of db._store.entries()) {
    const d = entry.data;
    if (d?.rowKind === 'endpoint') n += 1;
    if (/\/ideas\/[^/]+$/.test(path) && d?.result !== null && typeof d?.result === 'object') n += 1;
  }
  return n;
}

/** A fresh in-memory db with one idea book. Returns `{ db, bookId, bookRef }`. */
export async function seedBook({ uid = 'owner-1', attributionAgentId = 'agent-ranked-1', archetypeCodeId = 'momentum_chaser', opId = 'create-1', nowIso = etIso(DAYS.admit, 9, 0), db = makeMandateFakeDb() } = {}) {
  const res = await createIdeaBook(db, { uid, attributionAgentId, archetypeCodeId, opId, nowIso });
  if (!res.ok) throw new Error(`seedBook: ${res.code}`);
  if (!SEEDED_DBS.includes(db)) SEEDED_DBS.push(db);
  return { db, bookId: res.bookId, bookRef: db.collection('mandates').doc(res.bookId), uid };
}

/**
 * Store a document under a snapshot key as the engine's builder would: first writer wins. Storing the same content
 * again is a no-op; storing DIFFERENT content under a key that is already taken throws — a test that wants two
 * payloads for one key is asking for what B-STAMP forbids (Astra T1A-03).
 */
async function storeSnapshotOnce(db, snap) {
  // The collection by its literal name, so the protected-store scan resolves this write (to a non-protected
  // collection); the module-scope check above keeps the literal equal to the engine's constant.
  const ref = db.collection('mandateUniverseSnapshots').doc(snap.tickKey);
  const existing = await ref.get();
  if (existing.exists) {
    const same = JSON.stringify(existing.data()) === JSON.stringify(snap);
    if (!same) throw new Error(`storeSnapshotOnce: a different snapshot is already stored at ${snap.tickKey}`);
    return snap;
  }
  await ref.set(snap);
  return snap;
}

/**
 * Store THE slot snapshot of a window (`mandateUniverseSnapshots/{date}_{slot}`). Every fill reads it there, by key
 * (review FR-A7): an entry or a sale is never handed a snapshot. `quotes` may be a ready snapshot object. Returns it.
 */
export async function storeTickSnapshot(db, date, slot, quotes) {
  const snap = quotes && typeof quotes === 'object' && typeof quotes.tickKey === 'string' ? quotes : tickSnapshot(date, slot, quotes);
  return storeSnapshotOnce(db, snap);
}

/**
 * Put a snapshot in the store under ITS OWN key, replacing whatever is there — straight into the fake's store, so it
 * works on a db a test has wrapped to fail its writes. For a row that hands a slot's snapshot to the two shims below.
 */
export function placeSnapshot(db, snap) {
  const path = `mandateUniverseSnapshots/${snap.tickKey}`;
  const cur = db._store.get(path);
  db._store.set(path, { data: structuredClone(snap), version: (cur?.version || 0) + 1 });
  return snap;
}

/**
 * T1a-1's rows hand the slot's snapshot to the entry. Since T1a-2a the fill reads the STORED slot snapshot itself
 * (review FR-A7), so these two put the handed snapshot in the store, under its own key, and then call the real
 * function WITHOUT it. A snapshot whose key is not the tick's is therefore simply not the slot's stored document.
 */
export async function enterIdeaWith(db, { snapshot, ...rest }) {
  if (snapshot && typeof snapshot.tickKey === 'string') placeSnapshot(db, snapshot);
  return enterIdea(db, rest);
}
export async function entryPassWith(db, { snapshot, ...rest }) {
  if (snapshot && typeof snapshot.tickKey === 'string') placeSnapshot(db, snapshot);
  return runIdeaBookEntryPass(db, rest);
}

/**
 * The store's bytes (documents and their versions) WITHOUT the shared snapshot documents — which no Practice Field
 * path writes, and which a row using the shims above places for the fill to read. What a money path wrote, or did not.
 */
export const moneyStoreBytes = (db) => JSON.stringify([...db._store.entries()].filter(([path]) => !path.startsWith('mandateUniverseSnapshots/')));

/** The instant a fixture window runs: two minutes into the slot. */
export function slotNowOf(date, slot = 'open30') {
  return new Date(Date.parse(slotOpenIso(date, slot)) + 2 * 60_000);
}

/** Enter one idea at a window: the slot snapshot is stored first, then the entry reads it. Returns the entry's answer. */
export async function enterAt(db, bookId, ideaId, { date = DAYS.d1, slot = 'open30', quotes, nowIso } = {}) {
  const bookRef = db.collection('mandates').doc(bookId);
  if (quotes !== undefined) await storeTickSnapshot(db, date, slot, quotes);
  return enterIdea(db, { bookRef, ideaId, tick: tickOf(date, slot), nowIso: nowIso ?? slotNowOf(date, slot).toISOString() });
}

/**
 * One window of one book, EXACTLY as the idea-book pass runs it (sweep.js runIdeaBookWindow): the slot snapshot is
 * stored (when `quotes` is given), then the book's missed sessions are CAUGHT UP, then SALES, then ENTRIES.
 * Returns the pass's own answer: `{ served, complete, skipped?, caughtUp, sales, entries, errors }`.
 */
export async function windowAt(db, bookId, { date, slot = 'open30', quotes, now } = {}) {
  const bookRef = db.collection('mandates').doc(bookId);
  if (quotes !== undefined) await storeTickSnapshot(db, date, slot, quotes);
  return runIdeaBookWindow(db, { bookRef, tick: tickOf(date, slot), now: now ?? slotNowOf(date, slot) });
}

/** Admit and (optionally) enter an idea in its start session. Returns `{ ideaId, admission, entry }`. */
export async function admitAndEnter(db, bookId, { contract, opId = 'idea-1', admitIso = ADMIT_ISO, quotes, date = DAYS.d1, slot = 'open30' }) {
  const admission = await admitIdea(db, { bookId, contract, opId, nowIso: admitIso });
  if (!admission.ok) throw new Error(`admitAndEnter: ${JSON.stringify(admission.refusals)}`);
  const snapshot = await storeTickSnapshot(db, date, slot, quotes);
  const entry = await enterAt(db, bookId, admission.ideaId, { date, slot });
  return { ideaId: admission.ideaId, admission, entry, snapshot };
}

/**
 * Store THE close snapshot of a date (`mandateUniverseSnapshots/{date}_close`) as the engine's builder would:
 * first writer wins. Storing the same content again is a no-op; storing DIFFERENT content under a key that is
 * already taken throws — a test that wants two payloads for one date is asking for what B-STAMP forbids (Astra
 * T1A-03). Returns the snapshot.
 */
export async function storeCloseSnapshot(db, date, quotes) {
  return storeSnapshotOnce(db, closeSnapshot(date, quotes));
}

/** The instant a fixture close runs: 25 minutes after the session's close. */
export function closeNowOf(date) {
  const s = resolveSessionSlots(date);
  return new Date(etMs(date, 9, 30) + (s.closeMin - s.openMin + 25) * 60_000);
}

/** Close an idea book for a date from the given quotes: the close snapshot is stored first, then the close reads it. */
export async function closeOn(db, bookId, date, quotes) {
  const bookRef = db.collection('mandates').doc(bookId);
  await storeCloseSnapshot(db, date, quotes);
  return closeIdeaBook(db, bookRef, { date, now: closeNowOf(date) });
}

/** Read helpers. */
export const getBook = (db, bookId) => db._get(`mandates/${bookId}`);
export const getIdea = (db, bookId, ideaId) => db._get(`mandates/${bookId}/ideas/${ideaId}`);
export const getRow = (db, bookId, ideaId, date) => db._get(`mandates/${bookId}/ideas/${ideaId}/rows/${date}`);

/** A stable dump of the whole store: sorted paths, Dates as ISO strings. */
export function dumpStore(db) {
  const out = {};
  for (const path of [...db._store.keys()].sort()) out[path] = db._store.get(path).data;
  return JSON.stringify(out, (_k, v) => (v instanceof Date ? v.toISOString() : v), 1);
}

/** Count the docs under a path prefix. */
export const countDocs = (db, prefix) => [...db._store.keys()].filter((p) => p.startsWith(prefix)).length;
