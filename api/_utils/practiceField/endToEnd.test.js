// api/_utils/practiceField/endToEnd.test.js
//
// Practice Field T1a-1, T1a-2a — THE END-TO-END SYNTHETIC RUN (T1a-1 build prompt §9; T1a-2a build prompt §11; concept
// V6.1 §15: "an end-to-end accounting test before anyone sees a screen"). ONE BOOK, THREE IDEAS THROUGH ITS SHORT SLOT
// (ten sessions each), one after another as the slot frees, one per comparison type:
//
//   C  one name, against its sector fund.      Its line is hit on its second close; the sale WAITS ONE SESSION (no
//                                              quote at the next session's windows) and fills the session after; with
//                                              nothing left, the idea RESOLVES EARLY at that close.
//   B  two names, against a frozen basket.     One name hits its line and is sold; the other runs on — through a
//                                              SPLIT and a DIVIDEND, and one close with a MISSING QUOTE on a basket
//                                              member — and is settled, with the rest, at the due session.
//   A  three names, against the same shares.   Never breaches. Settles at its due session, tied to its comparison to
//                                              the cent, and is liquidated the session after.
//
// Every window runs as the idea-book pass does (sales, then entries), from that slot's STORED snapshot; every close
// reads its own stored snapshot. The book is reconciled after EVERY step, and the final store is dumped: its SHA-256
// and size are the build report's evidence, pinned below so the run is byte-for-byte reproducible on any machine.
//
// To write the dump to a file: PF_E2E_DUMP=<path> npx vitest run api/_utils/practiceField/endToEnd.test.js

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { admitIdea } from './admission.js';
import { assertReconciled } from './reconcile.js';
import { nextSessionDate } from './windows.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, closeOn, windowAt, contractOf, getBook, getIdea, getRow, dumpStore, countDocs, etIso, ADMIT_ISO,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, countResults,
} from './__testsupport__/fixtures.js';

// The pinned evidence. A change here is a change to what the idea book records: re-pin it only with a reviewed
// change, and carry the new figures into the build report.
//   T1a-1 (the fix round's last pin): 69691024…, 186,846 bytes, 81 documents — one book, three ideas in three slots,
//   entry and twelve closes, no sale.
//   T1a-2a: the run itself changed — three ideas through the ONE short slot, each to its result (see above) — so the
//   bytes are not comparable field by field with T1a-1's; the build report lists what each document kind gained.
const EXPECTED_DUMP = { sha256: 'ed90ebd5da97658f7488cf098829f577fe952e00c43c7f9d5830967d4fc80666', bytes: 267350 };

// Twenty-nine sessions from Monday 16 November 2026 (Thanksgiving and Christmas are not sessions).
const SESSIONS = ['2026-11-16'];
while (SESSIONS.length < 29) SESSIONS.push(nextSessionDate(SESSIONS[SESSIONS.length - 1]));
const BASE = {
  AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, LLY: 803.17, JPM: 241.37, XOM: 118.53,
  BAC: 46.27, CVX: 157.19, HON: 226.43, SPY: 597.31, XLV: 147.23,
};
const CAP = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, LLY: 7.5e11, JPM: 6.8e11, XOM: 5.2e11, BAC: 3.5e11, CVX: 2.8e11, HON: 1.5e11 };
const SPLIT_DAY = SESSIONS[9];
const DIVIDEND_DAY = SESSIONS[11];
const MISSING_QUOTE_DAY = SESSIONS[12];
const SPLIT = { type: 'split', ticker: 'XOM', effectiveDate: SPLIT_DAY, ratio: 2, source: 'eodhd_splits' };
const DIVIDEND = { type: 'cash_dividend', ticker: 'XOM', effectiveDate: DIVIDEND_DAY, amount: 0.47, source: 'eodhd_dividends' };

/** A deterministic decimal price path within ±1.4% of the base (so never 5% under any entry); XOM trades at half from its split day on. */
function priceOn(sym, i, phase) {
  const step = (((i * 2 + phase) * 37 + sym.charCodeAt(0) * 13 + sym.charCodeAt(sym.length - 1) * 7) % 211) - 105;
  const price = BASE[sym] * (1 + step / 7500);
  return roundUsd(sym === 'XOM' && SESSIONS[i] >= SPLIT_DAY ? price / 2 : price);
}
/** Session i's quotes — `phase` 0 for a window, 1 for the close — with overrides (a number, a quote object, or undefined to drop). */
function quotesOn(i, phase, over = {}) {
  const out = {};
  for (const sym of Object.keys(BASE)) {
    const v = Object.hasOwn(over, sym) ? over[sym] : priceOn(sym, i, phase);
    if (v === undefined) continue;
    const q = typeof v === 'number' ? { price: v } : { ...v };
    if (CAP[sym] && !Object.hasOwn(q, 'marketCap')) q.marketCap = CAP[sym];
    // The daily layer's corporate-action window reaches five days back: each action is presented on several closes.
    if (phase === 1 && sym === 'XOM') {
      const actions = [];
      if (i >= 9 && i <= 12) actions.push(SPLIT);
      if (i >= 11 && i <= 14) actions.push(DIVIDEND);
      if (actions.length) q.corporateActions = actions;
    }
    out[sym] = q;
  }
  return out;
}

const cents = (n) => Math.round(n * 100);
const reconcile = (db, bookId) => {
  const book = getBook(db, bookId);
  return assertReconciled(book, book.openIdeaIds.map((id) => getIdea(db, bookId, id)));
};

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); });
afterEach(() => {
  restoreMode();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]); // B-MARK on every valuation row of the run
    expect(bannedWordsOnResults(db)).toEqual([]); // no banned word on any result or endpoint row
  }
});

describe('the end-to-end synthetic run', () => {
  it('one book, three ideas through its short slot — an early resolution, a line exit settled with the rest, and a clean settlement — with a split, a dividend, a missing quote and a sale that waits; reconciled after every step', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'momentum_chaser' });
    reconcile(db, bookId);
    const idea = (id) => getIdea(db, bookId, id);
    const book = () => getBook(db, bookId);
    const win = async (i, over = {}, slot = 'open30') => { const out = await windowAt(db, bookId, { date: SESSIONS[i], slot, quotes: quotesOn(i, 0, over) }); reconcile(db, bookId); return out; };
    const close = async (i, over = {}) => {
      const cashBefore = cents(book().portfolio.cash);
      const decisionsBefore = countDocs(db, `mandates/${bookId}/decisions/`);
      const out = await closeOn(db, bookId, SESSIONS[i], quotesOn(i, 1, over));
      expect(out.closed, SESSIONS[i]).toBe(true);
      expect(out.caughtUp, SESSIONS[i]).toEqual([]);
      reconcile(db, bookId);
      // B-MARK, on every close of the run: no decision is written, and the book's cash moves only by a dividend.
      expect(countDocs(db, `mandates/${bookId}/decisions/`), SESSIONS[i]).toBe(decisionsBefore);
      const dividendCents = SESSIONS[i] === DIVIDEND_DAY ? cents(roundUsd(xomSharesAtDividend() * 0.47)) : 0;
      expect(cents(book().portfolio.cash), SESSIONS[i]).toBe(cashBefore + dividendCents);
      // B-STAMP: every row of the date carries the one key.
      const bookRow = db._get(`mandates/${bookId}/dailyRows/${SESSIONS[i]}`);
      expect(bookRow.closeSnapshotKey).toBe(`${SESSIONS[i]}_close`);
      return out;
    };
    let ideaB = null;
    const xomSharesAtDividend = () => idea(ideaB).ledger.holdings.XOM.shares;

    // ── C: one name against its sector fund. ───────────────────────────────────────────────────────────────────
    const c = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['LLY'], capitalUsd: 20000, comparison: { type: 'sector_fund', symbols: ['XLV'] }, origin: { kind: 'research', initiatedBy: 'agent' }, sources: [{ kind: 'research', ref: 'rw-0007' }] }), opId: 'idea-c', nowIso: ADMIT_ISO });
    expect(c).toMatchObject({ ok: true, startSession: SESSIONS[0], dueSession: SESSIONS[10] });
    reconcile(db, bookId);
    expect((await win(0)).entries).toMatchObject({ entered: 1 });
    await close(0);
    const lineC = idea(c.ideaId).lines[0].level;
    await close(1, { LLY: roundUsd(lineC - 3.11) }); // the line is hit
    expect(idea(c.ideaId).status).toBe('line_hit_exit_pending');
    // The sale waits one session: no quote for LLY at any of S[2]'s windows.
    for (const slot of ['open30', 'midday', 'preClose']) expect((await win(2, { LLY: undefined }, slot)).sales, slot).toMatchObject({ sold: 0, waiting: 1 });
    await close(2, { LLY: roundUsd(lineC - 5.4) });
    expect((await win(3, { LLY: roundUsd(lineC - 6.02) })).sales).toMatchObject({ sold: 1, resulted: 0 });
    const closed3 = await close(3);
    expect(closed3.resulted).toEqual([c.ideaId]); // E2: nothing left — resolved at this close
    expect(idea(c.ideaId)).toMatchObject({
      status: 'resulted',
      result: { endpointKind: 'early_resolution', endpointSession: SESSIONS[3], contractCondition: 'breached', economicResult: 'behind', processQuality: 'blocked', dataQuality: { waitingDays: 1 } },
    });
    expect(book()).toMatchObject({ slots: { short: null, medium: null, long: null }, openIdeaIds: [], portfolio: { positions: {} } });
    expect(book().treasury.unreservedCash).toBe(book().portfolio.cash);

    // ── B: two names against a frozen basket, in the slot C freed. ─────────────────────────────────────────────
    const b = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['JPM', 'XOM'], capitalUsd: 19000, comparison: { type: 'frozen_basket', symbols: ['BAC', 'CVX', 'HON'] }, origin: { kind: 'signaldrop', initiatedBy: 'player' }, sources: [{ kind: 'signaldrop', ref: 'sd-0001' }] }), opId: 'idea-b', nowIso: etIso(SESSIONS[3], 17, 0) });
    expect(b).toMatchObject({ ok: true, startSession: SESSIONS[4], dueSession: SESSIONS[14] });
    ideaB = b.ideaId;
    expect((await win(4)).entries).toMatchObject({ entered: 1 });
    await close(4);
    await close(5);
    const lineJpm = idea(b.ideaId).lines.find((l) => l.symbol === 'JPM').level;
    await close(6, { JPM: roundUsd(lineJpm - 1.07) }); // JPM's line is hit; XOM's is not
    expect(idea(b.ideaId).ledger.holdings.XOM.exitPending).toBeUndefined();
    expect((await win(7, { JPM: roundUsd(lineJpm - 2.3) })).sales).toMatchObject({ sold: 1 });
    expect(idea(b.ideaId).status).toBe('holding'); // E14: back to holding with XOM
    const xomBeforeSplit = idea(b.ideaId).ledger.holdings.XOM.shares;
    const xomLineBeforeSplit = idea(b.ideaId).lines.find((l) => l.symbol === 'XOM').level;
    for (let i = 7; i <= 13; i += 1) await close(i, i === 12 ? { CVX: undefined } : {}); // a split on S[9], a dividend on S[11], a missing quote on S[12]
    expect(idea(b.ideaId).ledger.holdings.XOM.shares).toBe(Math.round(xomBeforeSplit * 2 * 1e6) / 1e6); // split once, not once per close it was presented
    expect(idea(b.ideaId).lines.find((l) => l.symbol === 'XOM').level).toBe(xomLineBeforeSplit / 2);
    expect(idea(b.ideaId).ledger.appliedActionIds).toEqual([`split_XOM_${SPLIT_DAY}`, `cash_dividend_XOM_${DIVIDEND_DAY}`]);
    expect(idea(b.ideaId).ledger.dividendsUsd).toBe(roundUsd(idea(b.ideaId).ledger.holdings.XOM.shares * 0.47));
    expect(getRow(db, bookId, b.ideaId, MISSING_QUOTE_DAY)).toMatchObject({ fullQuality: false, comparisonMarks: { CVX: { quality: 'carried_forward' } }, lineObservations: { XOM: 'at_or_above' } });
    await close(14); // the due session: the endpoint and the result
    expect(idea(b.ideaId)).toMatchObject({
      status: 'settled',
      result: { endpointKind: 'due_session', endpointSession: SESSIONS[14], contractCondition: 'breached', processQuality: 'followed_plan', trades: { entry: { count: 2 }, lineExit: { count: 1 } }, dataQuality: { rows: 11, rowsNotFullQuality: 1, waitingDays: 0 } },
    });
    expect(idea(b.ideaId).result.economicResult).not.toBe('unmeasurable');
    expect((await win(15)).sales).toMatchObject({ sold: 1, resulted: 1 }); // the settlement sale: XOM
    expect(idea(b.ideaId).status).toBe('resulted');
    expect(book().slots.short).toBeNull();

    // ── A: three names against the same shares, in the slot B freed. ───────────────────────────────────────────
    const a = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['AAPL', 'MSFT', 'NVDA'], capitalUsd: 18000, comparison: { type: 'same_stock_held' } }), opId: 'idea-a', nowIso: etIso(SESSIONS[15], 11, 0) });
    expect(a).toMatchObject({ ok: true, startSession: SESSIONS[16], dueSession: SESSIONS[26] });
    await close(15);
    expect((await win(16)).entries).toMatchObject({ entered: 1 });
    for (let i = 16; i <= 26; i += 1) {
      await close(i);
      // The same-stock idea ties its comparison to the cent on every close.
      const row = getRow(db, bookId, a.ideaId, SESSIONS[i]);
      expect(row.markedValue, SESSIONS[i]).toBe(row.comparisonMarkedValue);
      expect(row).toMatchObject({ markedGapUsd: 0, fullQuality: true });
    }
    expect(idea(a.ideaId)).toMatchObject({
      status: 'settled',
      result: { endpointKind: 'due_session', contractCondition: 'met', economicResult: 'within_band', processQuality: 'followed_plan', economic: { gapUsd: 0 }, trades: { entry: { count: 3 }, lineExit: { count: 0 } } },
    });
    expect((await win(27)).sales).toMatchObject({ sold: 3, resulted: 1 });
    await close(27);

    // ── What the run left behind. ─────────────────────────────────────────────────────────────────────────────
    const end = book();
    expect(end).toMatchObject({ slots: { short: null, medium: null, long: null }, openIdeaIds: [], portfolio: { positions: {} }, execState: { lastCloseKey: SESSIONS[27], submitted: 0, executed: 0 } });
    expect(end.treasury.unreservedCash).toBe(end.portfolio.cash); // every cent is the treasury's again
    expect(end.portfolio.totalValue).toBe(end.portfolio.cash);
    expect(db._get('practiceFieldCoverage/current').symbols).toEqual({});
    for (const id of [c.ideaId, b.ideaId, a.ideaId]) expect(idea(id)).toMatchObject({ status: 'resulted', ledger: { cash: 0, holdings: {} } });
    // The treasury's cash is the starting capital plus what each idea returned less what it reserved.
    const returned = [c.ideaId, b.ideaId, a.ideaId].reduce((sum, id) => sum + cents(idea(id).liquidation.returnedToTreasuryUsd) - cents(idea(id).contract.capitalUsd), 0);
    expect(cents(end.treasury.unreservedCash)).toBe(10000000 + returned);
    // Twelve decisions: six entries, two line exits, four settlement sales. No model action anywhere.
    const decisions = [...db._store.keys()].filter((p) => p.startsWith(`mandates/${bookId}/decisions/`)).map((p) => db._get(p));
    expect(decisions.map((d) => d.origin).sort()).toEqual([...Array(6).fill('basket_entry'), ...Array(2).fill('line_exit'), ...Array(4).fill('settlement')]);
    expect(decisions.every((d) => d.rationaleStatus === 'absent' && d.modelId === null)).toBe(true);
    expect(countDocs(db, `mandates/${bookId}/dailyRows/`)).toBe(28);
    expect(countResults(db)).toBe(6); // three results, three endpoint rows
    // Every idea carries its origin, frozen with the contract and copied onto the inception row (direction note ruling 6).
    expect(idea(b.ideaId).contract.origin).toEqual({ kind: 'signaldrop', initiatedBy: 'player' });
    expect(db._get(`mandates/${bookId}/ideas/${c.ideaId}/rows/inception`).origin).toEqual({ kind: 'research', initiatedBy: 'agent' });

    // The evidence.
    const dump = dumpStore(db);
    const evidence = { sha256: createHash('sha256').update(dump, 'utf8').digest('hex'), bytes: Buffer.byteLength(dump, 'utf8') };
    if (process.env.PF_E2E_DUMP) writeFileSync(process.env.PF_E2E_DUMP, dump);
    console.log(`PF_E2E_EVIDENCE ${JSON.stringify(evidence)} docs=${db._store.size}`);
    expect(evidence).toEqual(EXPECTED_DUMP);
  });

  it('the run is deterministic: a second run produces the same bytes', async () => {
    const run = async () => {
      const { db, bookId } = await seedBook();
      await admitIdea(db, { bookId, contract: contractOf({ names: ['AAPL', 'MSFT'] }), opId: 'i', nowIso: ADMIT_ISO });
      await windowAt(db, bookId, { date: SESSIONS[0], quotes: quotesOn(0, 0) });
      const level = getIdea(db, bookId, getBook(db, bookId).openIdeaIds[0]).lines[0].level;
      await closeOn(db, bookId, SESSIONS[0], quotesOn(0, 1));
      await closeOn(db, bookId, SESSIONS[1], quotesOn(1, 1, { AAPL: roundUsd(level - 0.5) }));
      await windowAt(db, bookId, { date: SESSIONS[2], quotes: quotesOn(2, 0, { AAPL: roundUsd(level - 0.9) }) });
      for (let i = 2; i <= 10; i += 1) await closeOn(db, bookId, SESSIONS[i], quotesOn(i, 1));
      await windowAt(db, bookId, { date: SESSIONS[11], quotes: quotesOn(11, 0) });
      return dumpStore(db);
    };
    const first = await run();
    expect(first).toBe(await run());
    expect(first).toMatch(/"status": "resulted"/);
  });
});

// ── T1a-1's run, kept: three ideas SIDE BY SIDE in the book's three slots ────────────────────────────────────────────
// The lifecycle run above holds one idea at a time, so it cannot show the book's row agreeing with the SUM of several
// ideas' rows — where a second rounding of the book's own positions could differ by a cent (review L1-6). This is
// T1a-1's end-to-end scenario, unchanged in substance: entry through the idea-book pass, twelve closes with a split and
// a dividend, no sale (the medium and long ideas are not due inside it; the short one is closed out before its line or
// its due session matters). Its bytes are not pinned: the pinned evidence is the lifecycle run's.
describe('three ideas side by side — the book\'s row is the sum of its ideas\' rows, to the cent, on every close', () => {
  const DAYS12 = SESSIONS.slice(0, 10);
  const PX = {
    AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, LLY: 803.17, JNJ: 154.83, JPM: 241.37, XOM: 118.53, CAT: 387.61,
    BAC: 46.27, CVX: 157.19, HON: 226.43, SPY: 597.31, XLV: 147.23,
  };
  const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, LLY: 7.5e11, JNJ: 3.7e11, JPM: 6.8e11, XOM: 5.2e11, CAT: 1.9e11, BAC: 3.5e11, CVX: 2.8e11, HON: 1.5e11 };
  const splitDay = DAYS12[3];
  const dividendDay = DAYS12[5];
  const split = { type: 'split', ticker: 'NVDA', effectiveDate: splitDay, ratio: 2, source: 'eodhd_splits' };
  const dividend = { type: 'cash_dividend', ticker: 'JNJ', effectiveDate: dividendDay, amount: 1.24, source: 'eodhd_dividends' };
  /** A deterministic decimal path within ±1.4% of the base; NVDA trades at half from its split day on. */
  const price = (sym, i) => {
    const step = ((i * 37 + sym.charCodeAt(0) * 13 + sym.charCodeAt(sym.length - 1) * 7) % 211) - 105;
    const p = PX[sym] * (1 + step / 7500);
    return roundUsd(sym === 'NVDA' && DAYS12[i] >= splitDay ? p / 2 : p);
  };
  const closeQuotesOf = (i) => {
    const out = Object.fromEntries(Object.keys(PX).map((s) => [s, CAPS[s] ? { price: price(s, i), marketCap: CAPS[s] } : price(s, i)]));
    if (i >= 3 && i <= 6) out.NVDA = { ...out.NVDA, corporateActions: [split] };
    if (i >= 5 && i <= 8) out.JNJ = { ...out.JNJ, corporateActions: [dividend] };
    return out;
  };

  it('entry by the pass, ten closes with a split and a dividend: every book row equals its ideas\' rows; the same-stock idea ties its comparison across the split', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'momentum_chaser' });
    const drafts = {
      short: contractOf({ slot: 'short', names: ['AAPL', 'MSFT', 'NVDA'], capitalUsd: 20000, comparison: { type: 'same_stock_held' } }),
      medium: contractOf({ slot: 'medium', names: ['LLY', 'JNJ'], capitalUsd: 30000, comparison: { type: 'sector_fund', symbols: ['XLV'] }, weights: { LLY: 0.6, JNJ: 0.4 } }),
      long: contractOf({ slot: 'long', names: ['JPM', 'XOM', 'CAT'], capitalUsd: 40000, comparison: { type: 'frozen_basket', symbols: ['BAC', 'CVX', 'HON'] } }),
    };
    const ideas = {};
    for (const [slot, contract] of Object.entries(drafts)) {
      const res = await admitIdea(db, { bookId, contract, opId: `idea-${slot}`, nowIso: ADMIT_ISO });
      expect(res.ok, slot).toBe(true);
      ideas[slot] = res.ideaId;
      reconcile(db, bookId);
    }
    expect(getBook(db, bookId)).toMatchObject({ treasury: { unreservedCash: 10000 }, revision: 3 });
    const entryQuotes = Object.fromEntries(Object.keys(PX).map((s) => [s, CAPS[s] ? { price: PX[s], marketCap: CAPS[s] } : PX[s]]));
    const pass = await windowAt(db, bookId, { date: DAYS12[0], quotes: entryQuotes });
    expect(pass.entries).toEqual({ served: true, entered: 3, waiting: 0, cancelled: 0, errors: 0 });
    reconcile(db, bookId);
    expect(Object.keys(getBook(db, bookId).portfolio.positions).sort()).toEqual(['AAPL', 'CAT', 'JNJ', 'JPM', 'LLY', 'MSFT', 'NVDA', 'XOM']);
    const nvdaAtEntry = getIdea(db, bookId, ideas.short).ledger.holdings.NVDA.shares;
    const jnjShares = getIdea(db, bookId, ideas.medium).ledger.holdings.JNJ.shares;
    let bookCashCents = cents(getBook(db, bookId).portfolio.cash);

    for (let i = 0; i < DAYS12.length; i += 1) {
      const date = DAYS12[i];
      const out = await closeOn(db, bookId, date, closeQuotesOf(i));
      expect(out.closed, date).toBe(true);
      expect(out.alerts, date).toEqual([]);
      reconcile(db, bookId);
      const book = getBook(db, bookId);
      // B-MARK: a close moves cash only by a dividend; the treasury never moves; no decision is written.
      expect(cents(book.portfolio.cash), date).toBe(bookCashCents + (date === dividendDay ? cents(roundUsd(jnjShares * 1.24)) : 0));
      bookCashCents = cents(book.portfolio.cash);
      expect(book.treasury.unreservedCash).toBe(10000);
      expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(8);
      // The same-stock idea ties its comparison to the cent on every close — across the split too.
      const shortRow = getRow(db, bookId, ideas.short, date);
      expect(shortRow.markedValue, date).toBe(shortRow.comparisonMarkedValue);
      expect(shortRow.markedGapUsd).toBe(0);
      // B-STAMP: every row of the date carries the one key and build time.
      const bookRow = db._get(`mandates/${bookId}/dailyRows/${date}`);
      const rows = ['short', 'medium', 'long'].map((slot) => getRow(db, bookId, ideas[slot], date));
      for (const row of rows) {
        expect(row.closeSnapshotKey).toBe(`${date}_close`);
        expect(row.closeSnapshotBuiltAt).toBe(bookRow.closeSnapshotBuiltAt);
        expect(row.fullQuality).toBe(true);
        expect(cents(row.markedGapUsd)).toBe(cents(row.markedValue) - cents(row.comparisonMarkedValue));
      }
      // The book's equity is its parts, and its parts are the ideas': exactly, to the cent.
      expect(cents(bookRow.markedEquity), date).toBe(cents(bookRow.treasuryCash) + rows.reduce((sum, r) => sum + cents(r.markedValue), 0));
      expect(cents(bookRow.markedPositionsValue), date).toBe(rows.reduce((sum, r) => sum + cents(r.markedHoldingsValue), 0));
      expect(cents(bookRow.reservedCash), date).toBe(rows.reduce((sum, r) => sum + cents(r.cash), 0));
      expect(cents(bookRow.markedEquity)).toBe(cents(bookRow.treasuryCash) + cents(bookRow.reservedCash) + cents(bookRow.markedPositionsValue));
    }
    const short = getIdea(db, bookId, ideas.short);
    const medium = getIdea(db, bookId, ideas.medium);
    expect(short.ledger.holdings.NVDA.shares).toBe(Math.round(nvdaAtEntry * 2 * 1e6) / 1e6); // split once, not once per close it was presented
    expect(short.comparisonLedger.holdings.NVDA.shares).toBe(short.ledger.holdings.NVDA.shares);
    expect(getBook(db, bookId).portfolio.positions.NVDA.shares).toBe(short.ledger.holdings.NVDA.shares);
    expect(short.ledger.appliedActionIds).toEqual([`split_NVDA_${splitDay}`]);
    expect(short.lines.find((l) => l.symbol === 'NVDA').adjustments).toHaveLength(1);
    expect(medium.ledger.dividendsUsd).toBe(roundUsd(jnjShares * 1.24)); // credited once
    expect(medium.comparisonLedger.dividendsUsd).toBe(0); // XLV paid nothing in the fixture
    expect(countDocs(db, `mandates/${bookId}/dailyRows/`)).toBe(10);
    for (const slot of ['short', 'medium', 'long']) {
      expect(countDocs(db, `mandates/${bookId}/ideas/${ideas[slot]}/rows/`)).toBe(11); // inception + ten
      expect(getIdea(db, bookId, ideas[slot])).toMatchObject({ status: 'holding', result: null, postEntryFillCount: 0 });
    }
    expect(getBook(db, bookId)).toMatchObject({ revision: 3 + 3 + 10, execState: { lastCloseKey: DAYS12[9], submitted: 0, executed: 0 } });
  });
});
