// api/_utils/practiceField/endToEnd.test.js
//
// Practice Field T1a-1 — THE END-TO-END SYNTHETIC RUN (build prompt §9; concept V6.1 §15: "an end-to-end accounting
// test before anyone sees a screen"). One book; three ideas, one per slot, with a same-stock, a sector-fund and a
// frozen-basket comparison; basket entry through the idea-book pass; twelve closes with one split and one
// dividend. The book is reconciled after EVERY step, and the final store is dumped: its SHA-256 and size are the
// build report's evidence (§4), pinned below so the run is byte-for-byte reproducible on any machine.
//
// To write the dump to a file: PF_E2E_DUMP=<path> npx vitest run api/_utils/practiceField/endToEnd.test.js

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { admitIdea } from './admission.js';
import { runIdeaBookEntryPass } from './entry.js';
import { assertReconciled } from './reconcile.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, closeOn, contractOf, getBook, getIdea, getRow, tickOf, tickSnapshot, slotOpenIso, dumpStore, countDocs, ADMIT_ISO,
  takeSeededDbs, saleWordsOnMarkRows,
} from './__testsupport__/fixtures.js';

// The pinned evidence. A change here is a change to what the idea book records: re-pin it only with a reviewed
// change, and carry the new figures into the build report.
// Astra T1A-02 (fix round, 13 Nov 2026): +81 bytes, one field — `postEntryFillCount: 0` on each of the three ideas,
// written at entry for the same-stock tie (reconcile.js rule 9). Every other byte is unchanged (was 10049196…, 147,178).
const EXPECTED_DUMP = { sha256: 'ea5d0d4cd19c3852cd98447629d0dddfc7253dac54890b6a058874bbfe2191fe', bytes: 147259 };

const SESSIONS = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02'];
const BASE = {
  AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, LLY: 803.17, JNJ: 154.83, JPM: 241.37, XOM: 118.53, CAT: 387.61,
  BAC: 46.27, CVX: 157.19, HON: 226.43, SPY: 597.31, XLV: 147.23,
};
const CAP = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, LLY: 7.5e11, JNJ: 3.7e11, JPM: 6.8e11, XOM: 5.2e11, CAT: 1.9e11, BAC: 3.5e11, CVX: 2.8e11, HON: 1.5e11 };
const SPLIT_DAY = '2026-11-19';
const DIVIDEND_DAY = '2026-11-23';
const SPLIT = { type: 'split', ticker: 'NVDA', effectiveDate: SPLIT_DAY, ratio: 2, source: 'eodhd_splits' };
const DIVIDEND = { type: 'cash_dividend', ticker: 'JNJ', effectiveDate: DIVIDEND_DAY, amount: 1.24, source: 'eodhd_dividends' };

/** A deterministic decimal price path; NVDA trades at half from its split day on. */
function priceOn(sym, i, date) {
  const step = ((i * 37 + sym.charCodeAt(0) * 13 + sym.charCodeAt(sym.length - 1) * 7) % 211) - 105;
  const price = BASE[sym] * (1 + step / 4000);
  return roundUsd(sym === 'NVDA' && date >= SPLIT_DAY ? price / 2 : price);
}

function closeQuotes(i) {
  const date = SESSIONS[i];
  const quotes = Object.fromEntries(Object.keys(BASE).map((s) => [s, priceOn(s, i + 1, date)]));
  // The daily layer's corporate-action window reaches five days back: each action is presented on several closes.
  if (date >= SPLIT_DAY && i <= SESSIONS.indexOf(SPLIT_DAY) + 3) quotes.NVDA = { price: quotes.NVDA, corporateActions: [SPLIT] };
  if (date >= DIVIDEND_DAY && i <= SESSIONS.indexOf(DIVIDEND_DAY) + 3) quotes.JNJ = { price: quotes.JNJ, corporateActions: [DIVIDEND] };
  return quotes;
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
  for (const db of takeSeededDbs()) expect(saleWordsOnMarkRows(db)).toEqual([]); // B-MARK on every valuation row of the run
});

describe('the end-to-end synthetic run', () => {
  it('one book, three ideas, entry, twelve closes with a split and a dividend — reconciled after every step', async () => {
    // 1. The book.
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'momentum_chaser' });
    reconcile(db, bookId);

    // 2. Three ideas, one per slot, three comparison types.
    const ideas = {};
    const drafts = {
      short: contractOf({ slot: 'short', names: ['AAPL', 'MSFT', 'NVDA'], capitalUsd: 20000, comparison: { type: 'same_stock_held' }, origin: { kind: 'signaldrop', initiatedBy: 'player' }, sources: [{ kind: 'signaldrop', ref: 'sd-0001' }] }),
      medium: contractOf({ slot: 'medium', names: ['LLY', 'JNJ'], capitalUsd: 30000, comparison: { type: 'sector_fund', symbols: ['XLV'] }, weights: { LLY: 0.6, JNJ: 0.4 }, origin: { kind: 'research', initiatedBy: 'agent' }, sources: [{ kind: 'research', ref: 'rw-0007' }, { kind: 'conversation', ref: 'cx-0002' }] }),
      long: contractOf({ slot: 'long', names: ['JPM', 'XOM', 'CAT'], capitalUsd: 40000, comparison: { type: 'frozen_basket', symbols: ['BAC', 'CVX', 'HON'] } }),
    };
    for (const [slot, contract] of Object.entries(drafts)) {
      const res = await admitIdea(db, { bookId, contract, opId: `idea-${slot}`, nowIso: ADMIT_ISO });
      expect(res.ok, slot).toBe(true);
      ideas[slot] = res.ideaId;
      reconcile(db, bookId);
    }
    expect(getBook(db, bookId)).toMatchObject({ treasury: { unreservedCash: 10000 }, revision: 3 });
    expect(getBook(db, bookId).portfolio.cash).toBe(100000);

    // 3. Entry, by the idea-book pass, at the start session's first slot.
    const date0 = SESSIONS[0];
    const entryQuotes = Object.fromEntries(Object.keys(BASE).map((s) => [s, CAP[s] ? { price: BASE[s], marketCap: CAP[s] } : BASE[s]]));
    const pass = await runIdeaBookEntryPass(db, {
      bookRef, tick: tickOf(date0, 'open30'), snapshot: tickSnapshot(date0, 'open30', entryQuotes),
      now: new Date(Date.parse(slotOpenIso(date0, 'open30')) + 120_000),
    });
    expect(pass).toEqual({ served: true, entered: 3, waiting: 0, cancelled: 0, errors: 0 });
    reconcile(db, bookId);
    const afterEntry = getBook(db, bookId);
    expect(Object.keys(afterEntry.portfolio.positions).sort()).toEqual(['AAPL', 'CAT', 'JNJ', 'JPM', 'LLY', 'MSFT', 'NVDA', 'XOM']);
    for (const [sym, pos] of Object.entries(afterEntry.portfolio.positions)) expect(Object.values(ideas), sym).toContain(pos.ideaId);
    const decisionsAfterEntry = countDocs(db, `mandates/${bookId}/decisions/`);
    expect(decisionsAfterEntry).toBe(8);
    const nvdaAtEntry = getIdea(db, bookId, ideas.short).ledger.holdings.NVDA.shares;
    const jnjShares = getIdea(db, bookId, ideas.medium).ledger.holdings.JNJ.shares;

    // 4. Twelve closes.
    let bookCashCents = cents(afterEntry.portfolio.cash);
    for (let i = 0; i < SESSIONS.length; i += 1) {
      const date = SESSIONS[i];
      const out = await closeOn(db, bookId, date, closeQuotes(i));
      expect(out.closed, date).toBe(true);
      expect(out.alerts, date).toEqual([]);
      reconcile(db, bookId);

      const book = getBook(db, bookId);
      const dividendCents = date === DIVIDEND_DAY ? cents(roundUsd(jnjShares * 1.24)) : 0;
      // B-MARK: a close moves cash only by a dividend; the treasury never moves; no decision is written.
      expect(cents(book.portfolio.cash), date).toBe(bookCashCents + dividendCents);
      bookCashCents = cents(book.portfolio.cash);
      expect(book.treasury.unreservedCash).toBe(10000);
      expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(decisionsAfterEntry);

      // The same-stock idea ties its comparison to the cent on every close — across the split too.
      const shortRow = getRow(db, bookId, ideas.short, date);
      expect(shortRow.markedValue, date).toBe(shortRow.comparisonMarkedValue);
      expect(shortRow.markedGapUsd).toBe(0);

      // B-STAMP: every row of the date carries the one key.
      const bookRow = db._get(`mandates/${bookId}/dailyRows/${date}`);
      for (const slot of ['short', 'medium', 'long']) {
        const row = getRow(db, bookId, ideas[slot], date);
        expect(row.closeSnapshotKey).toBe(`${date}_close`);
        expect(row.closeSnapshotBuiltAt).toBe(bookRow.closeSnapshotBuiltAt);
        expect(row.fullQuality).toBe(true);
        expect(cents(row.markedGapUsd)).toBe(cents(row.markedValue) - cents(row.comparisonMarkedValue));
      }
      // The book's equity is its parts, and its parts are the ideas'.
      const ideaValueCents = ['short', 'medium', 'long'].reduce((s, slot) => s + cents(getRow(db, bookId, ideas[slot], date).markedValue), 0);
      expect(cents(bookRow.markedEquity), date).toBe(cents(bookRow.treasuryCash) + ideaValueCents); // exactly: the book's row is the sum of its ideas' rows
      expect(cents(bookRow.markedEquity)).toBe(cents(bookRow.treasuryCash) + cents(bookRow.reservedCash) + cents(bookRow.markedPositionsValue));
    }

    // 5. What the run left behind.
    const short = getIdea(db, bookId, ideas.short);
    const medium = getIdea(db, bookId, ideas.medium);
    expect(short.ledger.holdings.NVDA.shares).toBe(Math.round(nvdaAtEntry * 2 * 1e6) / 1e6); // split once, not once per close it was presented
    expect(short.comparisonLedger.holdings.NVDA.shares).toBe(short.ledger.holdings.NVDA.shares);
    expect(getBook(db, bookId).portfolio.positions.NVDA.shares).toBe(short.ledger.holdings.NVDA.shares);
    expect(short.ledger.appliedActionIds).toEqual([`split_NVDA_${SPLIT_DAY}`]);
    expect(short.lines.find((l) => l.symbol === 'NVDA').adjustments).toHaveLength(1);
    expect(medium.ledger.dividendsUsd).toBe(roundUsd(jnjShares * 1.24)); // credited once
    expect(medium.ledger.appliedActionIds).toEqual([`cash_dividend_JNJ_${DIVIDEND_DAY}`]);
    expect(medium.comparisonLedger.dividendsUsd).toBe(0); // XLV paid nothing in the fixture
    expect(countDocs(db, `mandates/${bookId}/dailyRows/`)).toBe(12);
    for (const slot of ['short', 'medium', 'long']) expect(countDocs(db, `mandates/${bookId}/ideas/${ideas[slot]}/rows/`)).toBe(13); // inception + twelve
    expect(getBook(db, bookId)).toMatchObject({ revision: 3 + 3 + 12, execState: { lastCloseKey: SESSIONS[11], submitted: 0, executed: 0 } });
    // Every idea carries its origin, frozen with the contract and copied onto the inception row (direction note ruling 6).
    expect(short.contract.origin).toEqual({ kind: 'signaldrop', initiatedBy: 'player' });
    expect(db._get(`mandates/${bookId}/ideas/${ideas.medium}/rows/inception`).origin).toEqual({ kind: 'research', initiatedBy: 'agent' });

    // 6. The evidence.
    const dump = dumpStore(db);
    const evidence = { sha256: createHash('sha256').update(dump, 'utf8').digest('hex'), bytes: Buffer.byteLength(dump, 'utf8') };
    if (process.env.PF_E2E_DUMP) writeFileSync(process.env.PF_E2E_DUMP, dump);
    console.log(`PF_E2E_EVIDENCE ${JSON.stringify(evidence)} docs=${db._store.size}`);
    expect(evidence).toEqual(EXPECTED_DUMP);
  });

  it('the run is deterministic: a second run produces the same bytes', async () => {
    const run = async () => {
      const { db, bookId, bookRef } = await seedBook();
      await admitIdea(db, { bookId, contract: contractOf({ names: ['AAPL', 'MSFT'] }), opId: 'i', nowIso: ADMIT_ISO });
      await runIdeaBookEntryPass(db, { bookRef, tick: tickOf(SESSIONS[0], 'open30'), snapshot: tickSnapshot(SESSIONS[0], 'open30', { AAPL: BASE.AAPL, MSFT: BASE.MSFT, SPY: BASE.SPY }), now: new Date(Date.parse(slotOpenIso(SESSIONS[0], 'open30')) + 120_000) });
      for (let i = 0; i < 3; i += 1) await closeOn(db, bookId, SESSIONS[i], closeQuotes(i));
      return dumpStore(db);
    };
    expect(await run()).toBe(await run());
  });
});
