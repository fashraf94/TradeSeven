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
import { SNAPSHOT_COLLECTION, fetchCorporateActionsEODHD } from '../../mandateUniverseSnapshot.js';

if (SNAPSHOT_COLLECTION !== 'mandateUniverseSnapshots') throw new Error('fixtures.js: the close-snapshot collection was renamed; update storeCloseSnapshot');
import { PRACTICE_FIELD_FUNDS } from '../../../../src/data/practiceFieldFunds.js';
import { createIdeaBook } from '../ideaBook.js';
import { admitIdea } from '../admission.js';
import { enterIdea, runIdeaBookEntryPass } from '../entry.js';
import { runIdeaBookWindow } from '../sweep.js';
import { closeIdeaBook, catchUpIdeaBook } from '../close.js';
import { runFounderAction } from '../founderControls.js';
import { admissionMarkSetCandidates } from '../admissionMarks.js';

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
/**
 * THE DAILY LAYER A SNAPSHOT NAMES (T1a-2b-3; Amendment F-1, F-2). The engine's cron builds the session's daily layer
 * (`mandateUniverseDaily/{date}`) before every slot and close snapshot, with the idea books' symbols in it, and the
 * snapshot names it (`dailyRef`) and copies its corporate-action rows. So a fixture snapshot names its session's daily
 * layer by default, and STORING one (storeTickSnapshot, storeCloseSnapshot, placeSnapshot) also writes that layer: one
 * entry per symbol of the snapshot, as a fetch that succeeded leaves it, carrying the snapshot's own action rows — the
 * data complete, as production makes it. `dailyRef: null` builds a snapshot that names none, and stores no layer.
 */
export const dailyRefOf = (date) => `mandateUniverseDaily/${date}`;
export function snapshotOf({ tickKey, sessionDate, builtAt, quoteAt, quotes, dailyRef }) {
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
  return {
    schemaVersion: 1, tickKey, sessionDate, builtAt: new Date(builtAt),
    dailyRef: dailyRef === undefined ? dailyRefOf(sessionDate) : dailyRef, symbols,
  };
}

/** A slot snapshot: built one minute into the slot, quotes observed fifteen minutes before it. */
export function tickSnapshot(date, slot, quotes, { dailyRef } = {}) {
  const open = Date.parse(slotOpenIso(date, slot));
  return snapshotOf({
    tickKey: `${date}_${slot}`, sessionDate: date,
    builtAt: new Date(open + 60_000).toISOString(), quoteAt: new Date(open - 15 * 60_000).toISOString(), quotes, dailyRef,
  });
}

/** THE close snapshot of a date: built twenty minutes after the close, quotes observed at the close. */
export function closeSnapshot(date, quotes, { dailyRef } = {}) {
  const s = resolveSessionSlots(date);
  const closeMs = etMs(date, 9, 30) + (s.closeMin - s.openMin) * 60_000;
  return snapshotOf({
    tickKey: `${date}_close`, sessionDate: date,
    builtAt: new Date(closeMs + 20 * 60_000).toISOString(), quoteAt: new Date(closeMs).toISOString(), quotes, dailyRef,
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
  mergeDailyLayerOf(db, snap);
  await ref.set(snap);
  return snap;
}

/** The daily layer's own fields, as the engine's builder writes them (its corporate-action window included). */
function dailyBaseOf(date) {
  const shift = (days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return { schemaVersion: 1, date, builtAt: new Date(etIso(date, 9, 0)), caWindow: { from: shift(-5), to: shift(2) } };
}
const actionKeyOf = (a) => JSON.stringify(Object.keys(a || {}).sort().map((k) => [k, a[k]]));
/**
 * The daily layers the FIXTURES wrote, per database: path → the symbols a row removed (omitDailyEntry), which a later
 * stored snapshot must not put back. A layer a row wrote ITSELF, through the database (the engine's document as the row
 * gives it), is not one of them: a stored snapshot never merges into it.
 */
const FIXTURE_DAILY = new WeakMap();
const fixtureDailyOf = (db) => { if (!FIXTURE_DAILY.has(db)) FIXTURE_DAILY.set(db, new Map()); return FIXTURE_DAILY.get(db); };
function writeFixtureDaily(db, path, doc, cur, omitted) {
  db._store.set(path, { data: structuredClone(doc), version: (cur?.version || 0) + 1 });
  fixtureDailyOf(db).set(path, omitted ?? fixtureDailyOf(db).get(path) ?? new Set());
  ensureFixtureParseReport(db, doc.date, Object.keys(doc.symbols || {}));
}

/**
 * T1a-2b-4 (T2D-12): THE PARSE REPORT a daily build that covered a symbol writes beside its layer
 * (`practiceFieldCaParseReports/{date}`, caParseReport.js) — production writes one wherever an idea book's coverage asks
 * for the symbol, and a missing one is a day of doubt. So the fixtures write a CLEAN entry for every symbol they write a
 * daily entry for (each answer parsed whole), straight into the fake's store; a row about a rejected row, a malformed
 * envelope or a missing report writes its own (storeParseReport, omitParseReport), which a later stored snapshot never
 * replaces.
 */
export const CLEAN_PARSE_LEG = Object.freeze({ answered: true, status: 200, envelope: 'list', received: 0, accepted: 0, noOp: 0, rejected: 0 });
export const CLEAN_PARSE_ENTRY = Object.freeze({
  rowsReceived: 0, rowsAccepted: 0, rowsNoOp: 0, rowsRejected: 0, rejects: [], malformedEnvelope: false,
  legs: { splits: { ...CLEAN_PARSE_LEG }, dividends: { ...CLEAN_PARSE_LEG } }, at: null,
});
const FIXTURE_REPORT = new WeakMap(); // db → Map(date → Set of symbols a ROW wrote or removed: never overwritten)
const rowOwnedReports = (db) => { if (!FIXTURE_REPORT.has(db)) FIXTURE_REPORT.set(db, new Map()); return FIXTURE_REPORT.get(db); };
function ensureFixtureParseReport(db, date, symbols) {
  if (typeof date !== 'string' || !db?._store) return;
  const path = `practiceFieldCaParseReports/${date}`;
  const cur = db._store.get(path);
  const owned = rowOwnedReports(db).get(date) || new Set();
  const entries = { ...(cur?.data?.symbols || {}) };
  let added = false;
  for (const sym of symbols) {
    if (owned.has(sym) || Object.hasOwn(entries, sym)) continue;
    entries[sym] = structuredClone(CLEAN_PARSE_ENTRY);
    added = true;
  }
  if (!added && cur) return;
  db._store.set(path, { data: { schemaVersion: 1, session: date, symbols: entries }, version: (cur?.version || 0) + 1 });
}
/** A row's own parse-report entry for one symbol of one session (a rejected row, a malformed envelope…). */
export function storeParseReport(db, date, symbol, entry) {
  const path = `practiceFieldCaParseReports/${date}`;
  const cur = db._store.get(path);
  const owned = rowOwnedReports(db).get(date) || new Set();
  owned.add(symbol);
  rowOwnedReports(db).set(date, owned);
  const entries = { ...(cur?.data?.symbols || {}), [symbol]: structuredClone(entry) };
  db._store.set(path, { data: { schemaVersion: 1, session: date, symbols: entries }, version: (cur?.version || 0) + 1 });
}
/** No parse report for `symbols` of a session (the build wrote none for them): removed, and kept out. */
export function omitParseReport(db, date, symbols) {
  const path = `practiceFieldCaParseReports/${date}`;
  const cur = db._store.get(path);
  const owned = rowOwnedReports(db).get(date) || new Set();
  for (const sym of symbols) owned.add(sym);
  rowOwnedReports(db).set(date, owned);
  const entries = { ...(cur?.data?.symbols || {}) };
  for (const sym of symbols) delete entries[sym];
  db._store.set(path, { data: { schemaVersion: 1, session: date, symbols: entries }, version: (cur?.version || 0) + 1 });
}

/**
 * A daily layer WITHOUT an entry for `symbols` (a build that did not cover them): the entries are removed and stay out
 * when a later snapshot of the session is stored. For the rows about a missing entry. Returns the document.
 */
export function omitDailyEntry(db, date, symbols) {
  const path = `mandateUniverseDaily/${date}`;
  const cur = db._store.get(path);
  const entries = { ...(cur?.data?.symbols || {}) };
  for (const sym of symbols) delete entries[sym];
  const omitted = new Set([...(fixtureDailyOf(db).get(path) || []), ...symbols]);
  const doc = { ...(cur?.data || dailyBaseOf(date)), symbols: entries };
  writeFixtureDaily(db, path, doc, cur, omitted);
  return doc;
}

/**
 * The daily layer a stored snapshot names (see `dailyRefOf`), written straight into the fake's store: every symbol of
 * the snapshot — and, as the cron's build covers them whether or not a quote comes back (sweep.js
 * practiceFieldBuildInputs), every symbol the coverage document reserves and every name an idea book holds — gets an
 * entry if it has none, and every action row the snapshot carries for it is added to its entry if the entry does not
 * already list it. An entry already there is never replaced (a row that wrote a failed or missing one keeps it), and
 * a symbol a row REMOVED from the layer (`omitDailyEntry`) stays out. A snapshot that names no daily layer, or another
 * session's, stores none.
 */
export function mergeDailyLayerOf(db, snap) {
  if (!db?._store || snap?.dailyRef !== dailyRefOf(snap?.sessionDate)) return null;
  const date = snap.sessionDate;
  const path = `mandateUniverseDaily/${date}`;
  const cur = db._store.get(path);
  // A layer a row wrote itself (not through the fixtures) is the engine's document as the row gives it: left alone (its
  // parse report, as production's build would write it, is still ensured for its symbols — T1a-2b-4).
  if (cur && !fixtureDailyOf(db).has(path)) {
    ensureFixtureParseReport(db, date, Object.keys(cur.data?.symbols || {}));
    return cur.data;
  }
  const entries = { ...(cur?.data?.symbols || {}) };
  const omitted = fixtureDailyOf(db).get(path) || new Set();
  const covered = new Set(Object.keys(db._store.get('practiceFieldCoverage/current')?.data?.symbols || {}));
  for (const [p, d] of db._store.entries()) {
    if (/^mandates\/[^/]+$/.test(p) && d?.data?.kind === 'idea_book') for (const sym of Object.keys(d.data.portfolio?.positions || {})) covered.add(sym);
  }
  const fromSnapshot = { ...Object.fromEntries([...covered].map((s) => [s, {}])), ...(snap.symbols || {}) };
  for (const [sym, e] of Object.entries(fromSnapshot)) {
    if (omitted.has(sym)) continue;
    const prior = Object.hasOwn(entries, sym) ? entries[sym] : null;
    const entry = prior !== null && typeof prior === 'object' && !Array.isArray(prior)
      ? { ...prior }
      : (prior === null ? { sector: null, industry: null, marketCap: null, source: 'eodhd_fundamentals', complete: false } : null);
    if (entry === null) continue; // an odd value a row planted stays exactly as it is
    const actions = [...(entry.corporateActions || [])];
    const seen = new Set(actions.map(actionKeyOf));
    for (const a of e?.corporateActions || []) if (!seen.has(actionKeyOf(a))) { seen.add(actionKeyOf(a)); actions.push(a); }
    if (actions.length > 0) entry.corporateActions = actions;
    entries[sym] = entry;
  }
  const doc = { ...(cur?.data || dailyBaseOf(date)), symbols: entries };
  writeFixtureDaily(db, path, doc, cur);
  return doc;
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
  mergeDailyLayerOf(db, snap);
  db._store.set(path, { data: structuredClone(snap), version: (cur?.version || 0) + 1 });
  return snap;
}

/**
 * Astra T2C-01: THE daily layer of a session (`mandateUniverseDaily/{date}`), with one entry per symbol in the daily
 * builder's entry shape (mandateUniverseSnapshot.js ensureDailySnapshot) — as a corporate-action fetch that succeeded
 * with nothing listed leaves it; `failed` names whose fetch failed (`caFetchFailed: true`). Merged into whatever the
 * document already holds, straight into the fake's store (it works on a db a test wraps to fail its writes).
 * Admission refuses a held name its session's daily layer does not cover (admissionMarks.js), and a sale reads it too
 * (exits.js). Since T1a-2b-3 a stored snapshot writes its session's layer (mergeDailyLayerOf); this REPLACES the
 * named symbols' entries — a row about a failed fetch says so here. Returns it.
 */
export function storeDailyLayer(db, date, symbols, { failed = [] } = {}) {
  const path = `mandateUniverseDaily/${date}`;
  const cur = db._store.get(path);
  const entries = { ...(cur?.data?.symbols || {}) };
  for (const sym of [...symbols, ...failed]) {
    entries[sym] = {
      sector: null, industry: null, marketCap: null, source: 'eodhd_fundamentals', complete: false,
      ...(failed.includes(sym) ? { caFetchFailed: true } : {}),
    };
  }
  const doc = { ...(cur?.data || dailyBaseOf(date)), symbols: entries };
  writeFixtureDaily(db, path, doc, cur);
  return doc;
}

/**
 * The daily layer an admission at `nowIso` reads (admissionMarks.js: the session its marks belong to), covering every
 * name the book's open ideas hold — as the daily build's idea-book coverage does in production. For a row about
 * something else that admits while the book holds a name. Returns the document.
 */
export function coverHeldNames(db, bookId, nowIso) {
  const { session } = admissionMarkSetCandidates(nowIso);
  if (session === null) throw new Error(`coverHeldNames: no session for ${nowIso}`);
  const held = new Set();
  for (const id of getBook(db, bookId)?.openIdeaIds || []) {
    for (const sym of Object.keys(getIdea(db, bookId, id)?.ledger?.holdings || {})) held.add(sym);
  }
  return storeDailyLayer(db, session, [...held]);
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
 * The store's bytes (documents and their versions) WITHOUT the shared snapshot documents and their daily layers — which
 * no Practice Field path writes, and which a row using the shims above places for the fill to read (a stored snapshot
 * writes its session's daily layer, mergeDailyLayerOf). What a money path wrote, or did not.
 */
export const moneyStoreBytes = (db) => JSON.stringify([...db._store.entries()].filter(([path]) => !path.startsWith('mandateUniverseSnapshots/') && !path.startsWith('mandateUniverseDaily/') && !path.startsWith('practiceFieldCaParseReports/')));

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

/**
 * The catch-up a window runs before it sells or enters (sweep.js runIdeaBookWindow; sessions.js: nothing moves past an
 * unclosed session): every session before `date` the book has not closed is closed, or accounted for by the window
 * ledger's own cursor (T2B-02), from stored snapshots only. An entry the fixtures make "at a window" runs it first, as
 * the window does — so a book's creation day is accounted for before its first fill (T1a-2b-2 §1: admission refuses
 * while a completed session is unclosed, C-2).
 */
export async function catchUpAt(db, bookId, { date, slot = 'open30', now } = {}) {
  const bookRef = db.collection('mandates').doc(bookId);
  return catchUpIdeaBook(db, bookRef, { before: date, now: now ?? slotNowOf(date, slot) });
}

/** Admit and (optionally) enter an idea in its start session — at a window, after its catch-up. Returns `{ ideaId, admission, entry }`. */
export async function admitAndEnter(db, bookId, { contract, opId = 'idea-1', admitIso = ADMIT_ISO, quotes, date = DAYS.d1, slot = 'open30' }) {
  const admission = await admitIdea(db, { bookId, contract, opId, nowIso: admitIso });
  if (!admission.ok) throw new Error(`admitAndEnter: ${JSON.stringify(admission.refusals)}`);
  const snapshot = await storeTickSnapshot(db, date, slot, quotes);
  await catchUpAt(db, bookId, { date, slot });
  const entry = await enterAt(db, bookId, admission.ideaId, { date, slot });
  return { ideaId: admission.ideaId, admission, entry, snapshot };
}

/**
 * Admit SEVERAL ideas — each at its own instant, all before any of them enters — THEN enter each at its window, in the
 * order given, after the window's catch-up. For a book holding two ideas entered in one session: admission measures a
 * book at the marks of its moment (T1a-2b-2 §1), so an idea is admitted before, not after, a later fill. Each spec:
 * `{ contract, opId, admitIso?, quotes, date?, slot? }`. Returns `[{ ideaId, admission, entry, snapshot }]`.
 */
export async function admitAllThenEnter(db, bookId, specs) {
  const out = [];
  for (const [i, s] of specs.entries()) {
    const admission = await admitIdea(db, { bookId, contract: s.contract, opId: s.opId ?? `idea-${i + 1}`, nowIso: s.admitIso ?? ADMIT_ISO });
    if (!admission.ok) throw new Error(`admitAllThenEnter: ${JSON.stringify(admission.refusals)}`);
    out.push({ ideaId: admission.ideaId, admission });
  }
  for (const [i, s] of specs.entries()) {
    const date = s.date ?? DAYS.d1;
    const slot = s.slot ?? 'open30';
    out[i].snapshot = await storeTickSnapshot(db, date, slot, s.quotes);
    await catchUpAt(db, bookId, { date, slot });
    out[i].entry = await enterAt(db, bookId, out[i].ideaId, { date, slot });
  }
  return out;
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

/**
 * A close's alerts without the window ledger's `PRACTICE_FIELD_WINDOW_MISSED` lines (T1a-2b-1 §4). A row that closes a
 * book WITHOUT running its windows is told, correctly, that each window was missed; rows about something else — a
 * corporate action, a line — assert on the rest. The missed windows themselves are windowLedger.test.js's.
 */
export const withoutWindowAlerts = (alerts) => (alerts || []).filter((a) => !/^PRACTICE_FIELD_WINDOW_MISSED /.test(a));

/**
 * THE REAL WIND-DOWN (T1a-2b-1 §6; T1a-2a C-1): the founder's `wind_down` action, through the same dispatcher the
 * endpoint calls (founderControls.js), for the book's owner — never a fixture status. The owner is made the founder
 * for the call (MANDATE_FOUNDER_UIDS, restored after). The mode must not be 'off' (the caller's test sets it).
 */
export async function windDownBook(db, { uid = 'owner-1', requestKey = 'wind-down-1', nowIso = etIso(DAYS.d1, 8, 0) } = {}) {
  const prev = process.env.MANDATE_FOUNDER_UIDS;
  process.env.MANDATE_FOUNDER_UIDS = uid;
  try {
    const out = await runFounderAction(db, { uid, body: { action: 'wind_down', requestKey }, nowIso });
    if (out.status !== 200 || out.body.ok !== true) throw new Error(`windDownBook: ${JSON.stringify(out)}`);
    return out.body;
  } finally {
    if (prev === undefined) delete process.env.MANDATE_FOUNDER_UIDS;
    else process.env.MANDATE_FOUNDER_UIDS = prev;
  }
}

/**
 * The founder's `resolve_hold` (Amendment F-5), as the endpoint runs it, for one idea — with MANDATE_FOUNDER_UIDS set
 * for the call and restored after. Amendment F rev 1: it is the ONLY way an ambiguous id settles, so a row that once
 * relied on the feed correcting itself rules here instead. `nowIso` defaults to 18:00 ET of the book's last close.
 * Returns the endpoint's answer; with `expectOk` (the default) a refusal throws.
 */
export async function founderRules(db, bookId, ideaId, body, { uid = 'owner-1', requestKey = `rule-${body?.recordId}-${body?.decision}`, nowIso = null, expectOk = true } = {}) {
  const prev = process.env.MANDATE_FOUNDER_UIDS;
  process.env.MANDATE_FOUNDER_UIDS = uid;
  try {
    const at = nowIso ?? etIso(getBook(db, bookId).execState.lastCloseKey, 18, 0);
    const out = await runFounderAction(db, { uid, body: { action: 'resolve_hold', requestKey, ideaId, ...body }, nowIso: at });
    if (expectOk && out.status !== 200) throw new Error(`founderRules: ${JSON.stringify(out)}`);
    return out;
  } finally {
    if (prev === undefined) delete process.env.MANDATE_FOUNDER_UIDS;
    else process.env.MANDATE_FOUNDER_UIDS = prev;
  }
}


/**
 * T1a-2b-4 (T2D-12): A VENDOR FAKE BEHIND A ROW'S STUB. The backfill now records a parse report of what the vendor
 * answered (caBackfill.js, caParseReport.js): it observes the HTTP answers through the daily builder's own fetch. A row
 * that hands a stub — `(sym, { from, to }) => ({ actions, calls, failed })` — gets back the pair the close takes:
 * `fetchCorporateActions`, the daily builder's own fetch (with a fixture key), and `caFetchImpl`, an HTTP fake that answers
 * each leg with the stub's rows written back in the vendor's shape (`{ date, split: 'r/1' }`, `{ date, unadjustedValue }`).
 * A failed stub fails the leg its rows do not need (both, with none); a non-list `actions` is served as the envelope.
 * `onCall(sym, opts)` — the stub's own calls are made once per symbol and window.
 */
export function vendorAnswering(stub) {
  const memo = new Map();
  const answerOf = (sym, from, to) => {
    const key = `${sym}|${from}|${to}`;
    if (!memo.has(key)) memo.set(key, Promise.resolve().then(() => stub(sym, { from, to })));
    return memo.get(key);
  };
  const caFetchImpl = async (url) => {
    const u = new URL(url);
    const leg = u.pathname.includes('/splits/') ? 'splits' : 'dividends';
    const sym = decodeURIComponent(u.pathname.split('/').pop()).replace(/\.US$/, '');
    const res = await answerOf(sym, u.searchParams.get('from'), u.searchParams.get('to'));
    const actions = res?.actions;
    if (!Array.isArray(actions)) return { ok: true, status: 200, json: async () => actions ?? null };
    const splits = actions.filter((a) => ['split', 'reverse_split', 'stock_distribution'].includes(a?.type));
    const divs = actions.filter((a) => a?.type === 'cash_dividend');
    if (res?.failed !== false) {
      const failLeg = splits.length > 0 && divs.length === 0 ? 'dividends' : (divs.length > 0 && splits.length === 0 ? 'splits' : 'both');
      if (failLeg === 'both' || failLeg === leg) return { ok: false, status: 503, json: async () => ({}) };
    }
    const body = leg === 'splits'
      ? splits.map((a) => ({ date: a.effectiveDate, split: `${a.ratio}/1` }))
      : divs.map((a) => ({ date: a.effectiveDate, unadjustedValue: a.amount }));
    return { ok: true, status: 200, json: async () => body };
  };
  const fetchCorporateActions = (sym, opts = {}) => fetchCorporateActionsEODHD(sym, { ...opts, apiKey: 'fixture-vendor-key', fetchImpl: opts.fetchImpl ?? caFetchImpl });
  return { fetchCorporateActions, caFetchImpl, fetchImpl: caFetchImpl };
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
