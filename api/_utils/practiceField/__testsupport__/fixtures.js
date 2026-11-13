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
import { createIdeaBook } from '../ideaBook.js';
import { admitIdea } from '../admission.js';
import { enterIdea } from '../entry.js';
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
 */
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
      marketCap: q.marketCap ?? null,
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
export const SALE_WORD_KEYS = /proceeds|realized|realised|sold|liquidat|sale|cashed|exit/i;
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

/** A fresh in-memory db with one idea book. Returns `{ db, bookId, bookRef }`. */
export async function seedBook({ uid = 'owner-1', attributionAgentId = 'agent-ranked-1', archetypeCodeId = 'momentum_chaser', opId = 'create-1', nowIso = etIso(DAYS.admit, 9, 0), db = makeMandateFakeDb() } = {}) {
  const res = await createIdeaBook(db, { uid, attributionAgentId, archetypeCodeId, opId, nowIso });
  if (!res.ok) throw new Error(`seedBook: ${res.code}`);
  if (!SEEDED_DBS.includes(db)) SEEDED_DBS.push(db);
  return { db, bookId: res.bookId, bookRef: db.collection('mandates').doc(res.bookId), uid };
}

/** Admit and (optionally) enter an idea in its start session. Returns `{ ideaId, admission, entry }`. */
export async function admitAndEnter(db, bookId, { contract, opId = 'idea-1', admitIso = ADMIT_ISO, quotes, date = DAYS.d1, slot = 'open30' }) {
  const admission = await admitIdea(db, { bookId, contract, opId, nowIso: admitIso });
  if (!admission.ok) throw new Error(`admitAndEnter: ${JSON.stringify(admission.refusals)}`);
  const bookRef = db.collection('mandates').doc(bookId);
  const snapshot = tickSnapshot(date, slot, quotes);
  const nowIso = new Date(Date.parse(slotOpenIso(date, slot)) + 2 * 60_000).toISOString();
  const entry = await enterIdea(db, { bookRef, ideaId: admission.ideaId, tick: tickOf(date, slot), snapshot, nowIso });
  return { ideaId: admission.ideaId, admission, entry, snapshot };
}

/** Close an idea book for a date from the given quotes. */
export async function closeOn(db, bookId, date, quotes) {
  const bookRef = db.collection('mandates').doc(bookId);
  const snap = closeSnapshot(date, quotes);
  const s = resolveSessionSlots(date);
  const now = new Date(etMs(date, 9, 30) + (s.closeMin - s.openMin + 25) * 60_000);
  return closeIdeaBook(db, bookRef, { date, closeSnapshot: snap, now });
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
