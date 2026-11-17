// api/_utils/practiceField/corporateActionFinish.test.js
//
// Practice Field T1a-2b-3 — THE CORPORATE-ACTION FINISH (Amendment F). One file per amendment item's rows:
//   F-6  one rule for a daily entry, on admission, the sales and the close alike;
//   F-2  action rows from the daily document; a snapshot that names another daily layer is not used;
//   F-1  a session with no corporate-action data is a session of doubt; the backfill; the fifth-session alert;
//   F-3  the gap screen dates a gap from the mark's own session;
//   and the committed race row for admission's daily read inside its transaction (T1a-2b-2 §9.4).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { admitIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { withBasisSuspicions, applyLedgerActions } from './ledger.js';
import { dailyDocOf, dailyCoverageOf, sessionCoverage, unionActionsBySymbol, snapshotNamesDaily, DAILY_COVERAGE_REFUSAL } from './dailyCoverage.js';
import { backfillNeeds, ensureCoverageBackfills } from './caBackfill.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, contractOf, getBook, getIdea, getRow, closeNowOf, etIso,
  tickSnapshot, closeSnapshot, storeTickSnapshot, storeCloseSnapshot, takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults,
  withoutWindowAlerts, moneyStoreBytes,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-07'];
const BASE = { AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, SPY: 597.31, XLK: 233.59 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12 };
function quotes(over = {}) {
  const out = {};
  for (const [sym, v] of Object.entries({ ...BASE, ...over })) {
    if (v === undefined) continue;
    if (typeof v === 'number') out[sym] = CAPS[sym] ? { price: v, marketCap: CAPS[sym] } : v;
    else out[sym] = CAPS[sym] && !Object.hasOwn(v, 'marketCap') ? { marketCap: CAPS[sym], ...v } : v;
  }
  return out;
}
const ideaOf = (ctx) => getIdea(ctx.db, ctx.bookId, ctx.ideaId);
const bookOf = (ctx) => getBook(ctx.db, ctx.bookId);
const rowOf = (ctx, date) => getRow(ctx.db, ctx.bookId, ctx.ideaId, date);
const recon = (ctx) => { const book = bookOf(ctx); return assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id))); };
const closeDay = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, quotes(over)); recon(ctx); return out; };
const lineOf = (ctx, sym) => ideaOf(ctx).lines.find((l) => l.symbol === sym);
const below = (level) => Math.round((level - 1.13) * 100) / 100;
const reverseSplit = (ratio, effectiveDate, ticker = 'AAPL') => ({ type: 'reverse_split', ticker, effectiveDate, ratio, source: 'eodhd_splits' });
const split = (ratio, effectiveDate, ticker = 'AAPL') => ({ type: 'split', ticker, effectiveDate, ratio, source: 'eodhd_splits' });
const dividend = (amount, effectiveDate, ticker = 'AAPL') => ({ type: 'cash_dividend', ticker, effectiveDate, amount, source: 'eodhd_dividends' });

/** An AAPL + MSFT idea (same-stock comparison), entered at S[0] and closed there. */
async function setup(contract = {}) {
  const { db, bookId, bookRef } = await seedBook();
  const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], ...contract }), quotes: quotes(), date: S[0] });
  const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
  await closeDay(ctx, S[0]);
  return ctx;
}

/** Plant a value straight into a stored daily layer: one symbol's entry, or (`docDate`) the document's own date. */
function plantDaily(db, date, { symbol, entry, docDate } = {}) {
  const path = `mandateUniverseDaily/${date}`;
  const cur = db._store.get(path);
  const data = structuredClone(cur.data);
  if (symbol !== undefined) data.symbols[symbol] = entry;
  if (docDate !== undefined) data.date = docDate;
  db._store.set(path, { data, version: cur.version + 1 });
}

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); });
afterEach(() => {
  restoreMode();
  vi.restoreAllMocks();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]);
    expect(bannedWordsOnResults(db)).toEqual([]);
  }
});

// ── F-6 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The refuter's eight odd values (T1a-2b-2 §9.4) and the rule's own two values, as entries of a daily layer. */
const ODD = [
  ['an entry of false', false, false],
  ['an entry of 0', 0, false],
  ["an entry of ''", '', false],
  ["an entry of 'x'", 'x', false],
  ['an entry of []', [], false],
  ["caFetchFailed: 'true'", { caFetchFailed: 'true' }, false],
  ['caFetchFailed: 1', { caFetchFailed: 1 }, false],
  // F-6's letter: a plain object whose caFetchFailed is absent IS covered — `{}` included (a reading stated in the report).
  ['an entry of {}', {}, true],
];

describe('Amendment F-6 — one rule for a daily entry', () => {
  it('the rule itself (pure): a plain object, `caFetchFailed` absent or exactly false; anything else is not covered; an own property only; a document whose date is not its key is missing', () => {
    const doc = (symbols, date = S[1]) => ({ date, symbols });
    const of = (entry) => dailyCoverageOf(dailyDocOf(doc({ AAPL: entry }), S[1]), 'AAPL');
    for (const v of [false, 0, '', 'x', [], null, ['caFetchFailed']]) expect(of(v), JSON.stringify(v)).toMatchObject({ covered: false, refusal: DAILY_COVERAGE_REFUSAL.COVERAGE_MISSING });
    for (const f of [true, 'true', 1, 0, '', null, [], 'false', {}]) expect(of({ caFetchFailed: f }), JSON.stringify(f)).toMatchObject({ covered: true, fetchSucceeded: false, refusal: DAILY_COVERAGE_REFUSAL.FETCH_FAILED });
    for (const ok of [{}, { caFetchFailed: false }, { sector: 'Technology' }, { caFetchFailed: undefined }]) expect(of(ok)).toEqual({ covered: true, fetchSucceeded: true, refusal: null });
    // An entry inherited through the object's prototype is not the symbol's own.
    const inherited = Object.create({ AAPL: { sector: 'Technology' } });
    expect(dailyCoverageOf(dailyDocOf(doc(inherited), S[1]), 'AAPL').refusal).toBe(DAILY_COVERAGE_REFUSAL.COVERAGE_MISSING);
    // …and `caFetchFailed: true` inherited by an entry does not make it failed, nor does one of its own pass through.
    expect(of(Object.create({ caFetchFailed: true })).refusal).toBeNull();
    // The document: its own `date` must be its key; not a plain object, it is missing.
    expect(dailyDocOf(doc({ AAPL: {} }, S[0]), S[1])).toBeNull();
    expect(dailyDocOf(doc({ AAPL: {} }), S[1])).not.toBeNull();
    for (const bad of [null, [], 'x', 7, { symbols: {} }]) expect(dailyDocOf(bad, S[1]), JSON.stringify(bad)).toBeNull();
    expect(dailyCoverageOf(null, 'AAPL')).toMatchObject({ covered: false, refusal: DAILY_COVERAGE_REFUSAL.DAILY_MISSING });
  });

  describe.each(ODD)('%s — on all three paths', (_name, entry, covered) => {
    it('ADMISSION: a held name with that entry is refused by symbol, nothing written (or, covered, admitted)', async () => {
      const ctx = await setup();
      await storeTickSnapshot(ctx.db, S[1], 'open30', quotes());
      plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry });
      const before = moneyStoreBytes(ctx.db);
      const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'odd', nowIso: etIso(S[1], 11, 0) });
      if (covered) { expect(res.ok, JSON.stringify(res.refusals)).toBe(true); return; }
      expect(res.ok).toBe(false);
      const reason = typeof entry === 'object' && !Array.isArray(entry) ? 'ca_fetch_failed' : 'ca_coverage_missing';
      expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', symbols: ['AAPL'], unavailable: [expect.objectContaining({ symbol: 'AAPL', reason })] })]);
      expect(moneyStoreBytes(ctx.db)).toBe(before);
    });

    it('THE SALES: a pending sale of the name with that entry waits under its own name (or, covered, fills)', async () => {
      const ctx = await setup();
      await closeDay(ctx, S[1], { AAPL: below(lineOf(ctx, 'AAPL').level) });
      await storeTickSnapshot(ctx.db, S[2], 'open30', quotes());
      plantDaily(ctx.db, S[2], { symbol: 'AAPL', entry });
      const out = await windowAt(ctx.db, ctx.bookId, { date: S[2], slot: 'open30' });
      recon(ctx);
      if (covered) { expect(out.sales).toMatchObject({ sold: 1 }); return; }
      expect(out.sales).toMatchObject({ sold: 0, waiting: 1 });
      expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting).toMatchObject({ lastRefusal: 'corporate_action_data_missing' });
    });

    it('THE CLOSE: the name with that entry is carried, named `ca_coverage_missing`, and nothing count-dependent of it runs (or, covered, it is marked fresh)', async () => {
      const ctx = await setup();
      await storeCloseSnapshot(ctx.db, S[1], quotes({ AAPL: { price: 240.11, corporateActions: [dividend(0.5, S[1])] } }));
      plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry });
      await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]) });
      recon(ctx);
      const idea = ideaOf(ctx);
      if (covered) {
        expect(rowOf(ctx, S[1]).marks.AAPL).toMatchObject({ mark: 240.11, quality: 'vendor_time' });
        expect(idea.caCoveredThrough.AAPL).toBe(S[1]);
        return;
      }
      expect(rowOf(ctx, S[1]).marks.AAPL).toMatchObject({ mark: BASE.AAPL, quality: 'ca_coverage_missing', markSource: 'carry_over' });
      expect(idea.caCoveredThrough.AAPL).toBe(S[0]);
      expect(idea.caCoverageGaps.AAPL).toMatchObject({ since: S[0], lastSession: S[1], sessions: 1 });
      // The dividend dated in the doubt is held on both ledgers that hold the name — nothing credited.
      for (const f of ['ledger', 'comparisonLedger']) {
        expect(idea[f].dividendsUsd, f).toBe(0);
        expect(idea[f].holdings.AAPL.heldActions, f).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[1]}`, heldBecause: [expect.objectContaining({ type: 'ca_coverage_gap' })] })]);
      }
    });
  });

  it('a daily document whose own `date` is not its key counts as MISSING — on admission, the sales and the close', async () => {
    // Admission.
    {
      const ctx = await setup();
      await storeTickSnapshot(ctx.db, S[1], 'open30', quotes());
      plantDaily(ctx.db, S[1], { docDate: S[0] });
      const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'mismatch', nowIso: etIso(S[1], 11, 0) });
      expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', unavailable: expect.arrayContaining([expect.objectContaining({ symbol: 'AAPL', reason: 'ca_daily_missing' })]) })]);
    }
    // The sales.
    {
      const ctx = await setup();
      await closeDay(ctx, S[1], { AAPL: below(lineOf(ctx, 'AAPL').level) });
      await storeTickSnapshot(ctx.db, S[2], 'open30', quotes());
      plantDaily(ctx.db, S[2], { docDate: S[3] });
      expect((await windowAt(ctx.db, ctx.bookId, { date: S[2], slot: 'open30' })).sales).toMatchObject({ sold: 0, waiting: 1 });
      expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting.lastRefusal).toBe('corporate_action_data_missing');
    }
    // The close.
    {
      const ctx = await setup();
      await storeCloseSnapshot(ctx.db, S[1], quotes());
      plantDaily(ctx.db, S[1], { docDate: S[0] });
      await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]) });
      for (const sym of ['AAPL', 'MSFT']) expect(rowOf(ctx, S[1]).marks[sym].quality, sym).toBe('ca_coverage_missing');
      expect(ideaOf(ctx).caCoverageGaps.AAPL).toMatchObject({ reason: 'ca_daily_missing' });
    }
  });
});

// ── F-2 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Amendment F-2 — action rows come from the daily document; a snapshot naming another layer is not used', () => {
  it('the union (pure): every source\'s rows, one row per content, two payloads of one id kept as two; a snapshot is used only when it names its session\'s layer', () => {
    const a = dividend(0.5, S[1]);
    const u = unionActionsBySymbol({ AAPL: [a] }, { aapl: [{ ...a }, dividend(0.6, S[1])] }, { MSFT: [split(2, S[1], 'MSFT')] });
    expect(u).toEqual({ AAPL: [a, dividend(0.6, S[1])], MSFT: [split(2, S[1], 'MSFT')] });
    expect(snapshotNamesDaily({ dailyRef: `mandateUniverseDaily/${S[1]}` }, S[1])).toBe(true);
    for (const ref of [null, undefined, `mandateUniverseDaily/${S[0]}`, `mandateUniverseSnapshots/${S[1]}`, '']) expect(snapshotNamesDaily({ dailyRef: ref }, S[1]), String(ref)).toBe(false);
  });

  /**
   * R7a and R7b: the daily layer lists an action the slot or close snapshot does not carry — a top-up for a held name
   * the day's first build missed, or a `force` rebuild, made after the snapshot was built. A 4-for-5 reverse split moves
   * AAPL +25%, under the gap screen's 40%: before F-2 nothing saw it.
   */
  it('R7a / R7b — the layer lists a reverse split the snapshot does not: ADMISSION refuses the name, the SALE waits, the CLOSE applies it', async () => {
    const adjusted = 289.34; // 231.47 / 0.8, rounded
    // Admission.
    {
      const ctx = await setup();
      await storeTickSnapshot(ctx.db, S[1], 'open30', quotes({ AAPL: adjusted }));
      plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry: { sector: null, corporateActions: [reverseSplit(0.8, S[1])] } });
      expect(ctx.db._get(`mandateUniverseSnapshots/${S[1]}_open30`).symbols.AAPL.corporateActions).toBeUndefined();
      const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'r7', nowIso: etIso(S[1], 11, 0) });
      expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', unavailable: [expect.objectContaining({ symbol: 'AAPL', reason: 'corporate_action_pending' })] })]);
    }
    // The sale.
    {
      const ctx = await setup();
      await closeDay(ctx, S[1], { AAPL: below(lineOf(ctx, 'AAPL').level) });
      await storeTickSnapshot(ctx.db, S[2], 'open30', quotes({ AAPL: adjusted }));
      plantDaily(ctx.db, S[2], { symbol: 'AAPL', entry: { sector: null, corporateActions: [reverseSplit(0.8, S[2])] } });
      expect((await windowAt(ctx.db, ctx.bookId, { date: S[2], slot: 'open30' })).sales).toMatchObject({ sold: 0, waiting: 1 });
      expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting.lastRefusal).toBe('corporate_action_pending');
    }
    // The close.
    {
      const ctx = await setup();
      const shares = ideaOf(ctx).ledger.holdings.AAPL.shares;
      await storeCloseSnapshot(ctx.db, S[1], quotes({ AAPL: adjusted }));
      plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry: { sector: null, corporateActions: [reverseSplit(0.8, S[1])] } });
      await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]) });
      recon(ctx);
      const idea = ideaOf(ctx);
      for (const f of ['ledger', 'comparisonLedger']) {
        expect(idea[f].holdings.AAPL.shares, f).toBe(Math.round(shares * 0.8 * 1e6) / 1e6);
        expect(idea[f].appliedActionIds, f).toEqual([`reverse_split_AAPL_${S[1]}`]);
      }
      expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(Math.round(shares * 0.8 * 1e6) / 1e6);
      expect(rowOf(ctx, S[1]).marks.AAPL).toMatchObject({ mark: adjusted, quality: 'vendor_time' });
    }
  });

  it('R7d, and a snapshot naming ANOTHER session\'s layer: the snapshot is not used — admission refuses, a sale waits, the close carries every mark', async () => {
    for (const dailyRef of [null, `mandateUniverseDaily/${S[0]}`]) {
      // Admission: the newest slot snapshot names no layer (built before the day's layer existed), the layer is there.
      {
        const ctx = await setup();
        await storeTickSnapshot(ctx.db, S[1], 'open30', tickSnapshot(S[1], 'open30', quotes(), { dailyRef }));
        await storeCloseSnapshot(ctx.db, S[1], quotes()); // the session's layer exists (written with the close's own)
        const before = moneyStoreBytes(ctx.db);
        const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'r7d', nowIso: etIso(S[1], 11, 0) });
        expect(res.refusals, String(dailyRef)).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', snapshotKey: null, unavailable: expect.arrayContaining([expect.objectContaining({ symbol: 'AAPL', reason: 'snapshot_daily_mismatch' })]) })]);
        expect(moneyStoreBytes(ctx.db)).toBe(before);
      }
      // The sale.
      {
        const ctx = await setup();
        await closeDay(ctx, S[1], { AAPL: below(lineOf(ctx, 'AAPL').level) });
        await storeTickSnapshot(ctx.db, S[2], 'open30', tickSnapshot(S[2], 'open30', quotes(), { dailyRef }));
        expect((await windowAt(ctx.db, ctx.bookId, { date: S[2], slot: 'open30' })).sales).toMatchObject({ sold: 0, waiting: 1 });
        expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting.lastRefusal).toBe('snapshot_daily_mismatch');
        expect(ideaOf(ctx).blockedBy).toEqual([expect.objectContaining({ kind: 'line_exit_held_for_corporate_action', symbol: 'AAPL' })]);
      }
      // The close.
      {
        const ctx = await setup();
        await storeTickSnapshot(ctx.db, S[1], 'open30', quotes()); // the session's layer exists
        await storeTickSnapshot(ctx.db, S[1], 'close', closeSnapshot(S[1], quotes({ AAPL: { price: 240.11, corporateActions: [dividend(0.5, S[1])] } }), { dailyRef }));
        await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]) });
        recon(ctx);
        for (const sym of ['AAPL', 'MSFT']) expect(rowOf(ctx, S[1]).marks[sym], `${dailyRef} ${sym}`).toMatchObject({ quality: 'ca_coverage_missing', markSource: 'carry_over' });
        expect(ideaOf(ctx).caCoverageGaps.AAPL).toMatchObject({ reason: 'snapshot_daily_mismatch' });
        expect(ideaOf(ctx).ledger.dividendsUsd).toBe(0); // the snapshot's own row is not used
        expect(ideaOf(ctx).caCoveredThrough).toMatchObject({ AAPL: S[0], MSFT: S[0] });
      }
    }
  });
});

// ── the race row (T1a-2b-2 §9.4) ──────────────────────────────────────────────────────────────────────────────────────

describe('admission reads the daily layer INSIDE its transaction (T1a-2b-2 §9.4: the committed race row)', () => {
  it('the layer turns to failed between admission\'s read and its commit — that document alone: the transaction retries and refuses; nothing written', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, S[1], 'open30', quotes());
    const contract = contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 });
    // The barrier changes ONE document — the daily layer — so only a transactional read of it forces the retry.
    ctx.db.setBarrier(async () => { plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true } }); });
    const attempts = ctx.db._txAttempts();
    const before = moneyStoreBytes(ctx.db);
    const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract, opId: 'race', nowIso: etIso(S[1], 11, 0) });
    expect(ctx.db._txAttempts() - attempts).toBe(2);
    expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', unavailable: [expect.objectContaining({ symbol: 'AAPL', reason: 'ca_fetch_failed' })] })]);
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // The control: with no race the same admission is accepted.
    const ok = await setup();
    await storeTickSnapshot(ok.db, S[1], 'open30', quotes());
    expect((await admitIdea(ok.db, { bookId: ok.bookId, contract, opId: 'race', nowIso: etIso(S[1], 11, 0) })).ok).toBe(true);
  });

  it('…and deleted between the read and the commit: retried, refused `ca_daily_missing`', async () => {
    const ctx = await setup();
    await storeTickSnapshot(ctx.db, S[1], 'open30', quotes());
    ctx.db.setBarrier(async () => { ctx.db._store.delete(`mandateUniverseDaily/${S[1]}`); });
    const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'race-del', nowIso: etIso(S[1], 11, 0) });
    expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', unavailable: expect.arrayContaining([expect.objectContaining({ symbol: 'AAPL', reason: 'ca_daily_missing' })]) })]);
  });
});

// ── F-3 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Amendment F-3 — the gap screen dates a gap from the mark\'s own session', () => {
  it('Astra\'s case: Nov 27 timed → Nov 30 UNTIMED → a later halving: the suspicion\'s window starts after Nov 30, the session the frozen mark came from (not Nov 27, which `lastMarkAsOf` keeps)', async () => {
    const ctx = await setup();
    for (let i = 1; i <= 8; i += 1) await closeDay(ctx, S[i]); // through Nov 27 (S[8]), every quote timed
    expect(S[8]).toBe('2026-11-27');
    expect(S[9]).toBe('2026-11-30');
    // Nov 30: an untimed AAPL quote (no vendor time) — a fresh mark, `receipt_time_fallback`; lastMarkAsOf keeps Nov 27's time.
    await closeDay(ctx, S[9], { AAPL: { price: 236.17, at: null } });
    const h = ideaOf(ctx).ledger.holdings.AAPL;
    expect(h.lastMark).toBe(236.17);
    expect(h.lastMarkProvenance).toMatchObject({ session: S[9], quality: 'receipt_time_fallback', vendorTimeIso: null });
    expect(h.lastMarkAsOf.slice(0, 10)).toBe(S[8]); // the field the old screen read
    // Dec 1: half the Nov 30 price, no row — a suspicion.
    await closeDay(ctx, S[10], { AAPL: 118.09 });
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(ideaOf(ctx)[f].holdings.AAPL.basisSuspicion, f).toMatchObject({ suspectedOn: S[10], since: S[9], frozenMark: 236.17 });
    }
    // The window starts AFTER Nov 30: a dividend dated Nov 30 is before the move — paid on the current count; one dated
    // Dec 1 waits. (With `since` Nov 27 the Nov 30 dividend would wait too.)
    const ledger = ideaOf(ctx).ledger;
    const out = applyLedgerActions(ledger, { AAPL: [dividend(0.5, S[9]), dividend(0.5, S[10])] }, { date: S[11] });
    expect(out.applied.map((a) => a.actionId)).toEqual([`cash_dividend_AAPL_${S[9]}`]);
    expect(out.held.map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[10]}`]);
  });

  it('(pure) a holding with no mark provenance cannot tell where its mark came from: `since` is null, and every cash action after the mark waits', () => {
    const holding = { shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, lastMarkAsOf: etIso(S[1], 16, 0), openedAt: S[0] };
    const ledger = { kind: 'idea', reservedCapitalUsd: 1000, cash: 0, holdings: { AAPL: holding }, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, appliedActionIds: [], declinedActionIds: [], corporateActionReceipts: [], saleReceipts: [] };
    const { raised } = withBasisSuspicions(ledger, closeSnapshot(S[2], { AAPL: 50 }), {}, { sinceDate: S[1], date: S[2] });
    expect(raised).toEqual([expect.objectContaining({ suspectedOn: S[2], since: null })]);
  });
});

// ── F-1 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A close of `date` whose daily layer says AAPL's fetch FAILED (the snapshot still quotes it). */
async function closeWithAaplFailed(ctx, date, over = {}, { fetchCorporateActions } = {}) {
  await storeCloseSnapshot(ctx.db, date, quotes(over));
  plantDaily(ctx.db, date, { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true } });
  const out = await closeIdeaBook(ctx.db, ctx.bookRef, { date, now: closeNowOf(date), ...(fetchCorporateActions ? { fetchCorporateActions } : {}) });
  recon(ctx);
  return out;
}
const sharesOf = (ctx, f = 'ledger') => ideaOf(ctx)[f].holdings.AAPL.shares;
const r6 = (n) => Math.round(n * 1e6) / 1e6;

describe('Amendment F-1 — a session with no corporate-action data is a session of doubt', () => {
  it('refuter R8: the fetch fails for three sessions while a 4-for-5 reverse split (+25%, under the gap screen) happens — every close CARRIES the mark (never the adjusted price over the unadjusted count); the first covered close applies the split, then marks fresh', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    const adjusted = 289.34;
    await closeWithAaplFailed(ctx, S[1]);
    await closeWithAaplFailed(ctx, S[2], { AAPL: adjusted }); // the split's day: the price moves, the feed says nothing
    await closeWithAaplFailed(ctx, S[3], { AAPL: adjusted });
    for (const d of [S[1], S[2], S[3]]) {
      expect(rowOf(ctx, d).marks.AAPL, d).toMatchObject({ mark: BASE.AAPL, quality: 'ca_coverage_missing', markSource: 'carry_over' });
      expect(rowOf(ctx, d).marks.MSFT.quality, d).toBe('vendor_time'); // only the symbol in doubt
      expect(rowOf(ctx, d).fullQuality, d).toBe(false);
    }
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(ideaOf(ctx)[f].holdings.AAPL.lastMark, f).toBe(BASE.AAPL); // no adjusted price over the unadjusted count
      expect(sharesOf(ctx, f), f).toBe(shares);
    }
    expect(bookOf(ctx).portfolio.positions.AAPL.lastMark).toBe(BASE.AAPL);
    expect(ideaOf(ctx).caCoveredThrough).toMatchObject({ AAPL: S[0], MSFT: S[3], SPY: S[3] });
    expect(ideaOf(ctx).caCoverageGaps.AAPL).toMatchObject({ since: S[0], from: '2026-11-17', firstSession: S[1], lastSession: S[3], sessions: 3, reason: 'ca_fetch_failed', backfillNeeded: false });
    // S[4]: the fetch succeeds, and its window (from 2026-11-15) reaches back over the gap: the split is listed, applied once.
    await closeDay(ctx, S[4], { AAPL: { price: adjusted, corporateActions: [reverseSplit(0.8, S[2])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(sharesOf(ctx, f), f).toBe(r6(shares * 0.8));
      expect(ideaOf(ctx)[f].appliedActionIds, f).toEqual([`reverse_split_AAPL_${S[2]}`]);
    }
    expect(rowOf(ctx, S[4]).marks.AAPL).toMatchObject({ mark: adjusted, quality: 'vendor_time' });
    expect(ideaOf(ctx).caCoveredThrough.AAPL).toBe(S[4]);
    expect(ideaOf(ctx).caCoverageGaps).toEqual({});
    expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(r6(shares * 0.8));
  });

  it('a gap LONGER than the fetch window: the doubt stays until a BACKFILL succeeds; the first close that has it applies the gap\'s split and then its dividend on the adjusted count, once, in date, phase and id order', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    for (let i = 1; i <= 6; i += 1) await closeWithAaplFailed(ctx, S[i], i >= 2 ? { AAPL: 289.34 } : {});
    expect(ideaOf(ctx).caCoverageGaps.AAPL).toMatchObject({ since: S[0], sessions: 6 });
    // S[7] (Nov 25): AAPL's fetch succeeds, but its window starts Nov 20 — after the day after S[0]. The backfill fails:
    // the doubt stays, and the failed attempt is recorded.
    const failedFetch = vi.fn(async () => ({ actions: [], calls: 2, failed: true }));
    await storeCloseSnapshot(ctx.db, S[7], quotes({ AAPL: { price: 290.01, corporateActions: [dividend(0.5, S[5])] } }));
    const first = await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[7], now: closeNowOf(S[7]), fetchCorporateActions: failedFetch });
    recon(ctx);
    expect(failedFetch).toHaveBeenCalledWith('AAPL', { from: '2026-11-17', to: S[7] });
    expect(first.alerts.some((a) => a.startsWith('PRACTICE_FIELD_CA_BACKFILL_FAILED'))).toBe(true);
    expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ failed: true, from: '2026-11-17', to: S[7] });
    expect(rowOf(ctx, S[7]).marks.AAPL.quality).toBe('ca_coverage_missing');
    expect(ideaOf(ctx).caCoverageGaps.AAPL).toMatchObject({ reason: 'gap_beyond_window', backfillNeeded: true, sessions: 7 });
    expect(ideaOf(ctx).ledger.dividendsUsd).toBe(0);
    expect(ideaOf(ctx).ledger.holdings.AAPL.heldActions.map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[5]}`]);
    // S[8]: the backfill succeeds — the split on S[2]. The close applies it, then the held dividend on the count it leaves.
    const fetch = vi.fn(async (sym) => ({ actions: sym === 'AAPL' ? [reverseSplit(0.8, S[2]), dividend(0.5, S[5])] : [], calls: 2, failed: false }));
    await storeCloseSnapshot(ctx.db, S[8], quotes({ AAPL: 290.55 }));
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[8], now: closeNowOf(S[8]), fetchCorporateActions: fetch });
    recon(ctx);
    expect(fetch.mock.calls).toEqual([['AAPL', { from: '2026-11-17', to: S[8] }]]); // only the symbol in doubt
    expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ symbol: 'AAPL', from: '2026-11-17', to: S[8], failed: false, calls: 2, source: 'idea_book_backfill' });
    const after = r6(shares * 0.8);
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(after);
      expect(l.appliedActionIds, f).toEqual([`reverse_split_AAPL_${S[2]}`, `cash_dividend_AAPL_${S[5]}`]);
      expect(l.dividendsUsd, f).toBe(Math.round(after * 0.5 * 100) / 100);
      expect(l.holdings.AAPL.heldActions, f).toBeUndefined();
    }
    expect(ideaOf(ctx).caCoveredThrough.AAPL).toBe(S[8]);
    expect(ideaOf(ctx).caCoverageGaps).toEqual({});
    expect(rowOf(ctx, S[8]).marks.AAPL).toMatchObject({ mark: 290.55, quality: 'vendor_time' });
    // The book's mirror credited the same dividend once.
    expect(ctx.db._get(`mandates/${ctx.bookId}/corporateActions/cash_dividend_AAPL_${S[5]}`)).toMatchObject({ amount: 0.5 });
    // A later close fetches nothing (the data is continuous again) and pays nothing twice.
    const again = vi.fn();
    await storeCloseSnapshot(ctx.db, S[9], quotes({ AAPL: { price: 290.6, corporateActions: [dividend(0.5, S[5])] } }));
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[9], now: closeNowOf(S[9]), fetchCorporateActions: again });
    expect(again).not.toHaveBeenCalled();
    expect(ideaOf(ctx).ledger.dividendsUsd).toBe(Math.round(after * 0.5 * 100) / 100);
  });

  it('the fifth session of doubt alerts PRACTICE_FIELD_CA_COVERAGE_GAP — once per session, not before', async () => {
    const ctx = await setup();
    const alerted = [];
    for (let i = 1; i <= 6; i += 1) {
      const out = await closeWithAaplFailed(ctx, S[i]);
      const gap = withoutWindowAlerts(out.alerts).filter((a) => a.startsWith('PRACTICE_FIELD_CA_COVERAGE_GAP '));
      alerted.push(gap.length);
      if (gap.length > 0) expect(gap[0]).toMatch(new RegExp(`^PRACTICE_FIELD_CA_COVERAGE_GAP ${ctx.ideaId} AAPL — no corporate-action data has covered it since ${S[0]} \\(${i} sessions; ca_fetch_failed, a backfill is needed\\)`)); // past the window by then
    }
    expect(alerted).toEqual([0, 0, 0, 0, 1, 1]);
    expect(ideaOf(ctx).caCoverageGaps.AAPL.alertedOn).toBe(S[6]);
  });

  it('T1A-08\'s residual — THE FLAG\'S TIME \'OFF\' IS A GAP LIKE ANY OTHER: the closes built while it was off carry no idea symbol; the first close after it returns backfills the gap, and a dividend dated in it is paid once', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    // Off for seven sessions: the cron builds the day's layer and close snapshot for quarterly books only — no idea symbol.
    const restoreOff = setPracticeFieldModeForTests('off');
    try {
      for (let i = 1; i <= 7; i += 1) {
        await storeCloseSnapshot(ctx.db, S[i], { NVDA: { price: BASE.NVDA, marketCap: CAPS.NVDA } });
        const d = ctx.db._get(`mandateUniverseDaily/${S[i]}`);
        ctx.db._store.set(`mandateUniverseDaily/${S[i]}`, { data: { ...d, symbols: { NVDA: d.symbols.NVDA } }, version: 99 });
        expect((await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[i], now: closeNowOf(S[i]) })).skipped).toBe('practice_field_off');
      }
    } finally { restoreOff(); }
    // On again at S[8]: the window of S[8]'s own layer starts Nov 22 — the dividend of Nov 18 (S[2]) is outside it.
    const fetch = vi.fn(async (sym) => ({ actions: sym === 'AAPL' ? [dividend(0.75, S[2])] : [], calls: 2, failed: false }));
    await storeCloseSnapshot(ctx.db, S[8], quotes());
    const out = await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[8], now: closeNowOf(S[8]), fetchCorporateActions: fetch });
    recon(ctx);
    expect(out).toMatchObject({ closed: true, session: S[8] });
    expect(out.caughtUp.map((c) => c.date)).toEqual(S.slice(1, 8));
    expect(fetch.mock.calls.map(([sym]) => sym).sort()).toEqual(['AAPL', 'MSFT', 'SPY']);
    // Each caught-up session is covered by the backfill: the dividend is paid ONCE, at its own session, on its count.
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(ideaOf(ctx)[f].dividendsUsd, f).toBe(Math.round(shares * 0.75 * 100) / 100);
      expect(ideaOf(ctx)[f].corporateActionReceipts.filter((r) => r.applied).map((r) => [r.actionId, r.appliedOn]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, S[2]]]);
    }
    expect(ideaOf(ctx).caCoveredThrough).toEqual({ AAPL: S[8], MSFT: S[8], SPY: S[8] });
    // The caught-up sessions carry the idea's marks (their snapshots had no idea symbol), and say nothing of doubt.
    expect(rowOf(ctx, S[3]).marks.AAPL).toMatchObject({ quality: 'carried_forward' });
  });

  it('a due session inside a coverage gap: the endpoint is UNMEASURABLE and BLOCKED, naming the gap', async () => {
    const ctx = await setup();
    for (let i = 1; i <= 9; i += 1) await closeDay(ctx, S[i]);
    await closeWithAaplFailed(ctx, S[10]); // S[10] is the short slot's due session
    const idea = ideaOf(ctx);
    expect(idea.endpoint.session).toBe(S[10]);
    expect(idea.result.economicResult).toBe('unmeasurable');
    expect(idea.result.economic.unmeasurableBecause).toEqual(expect.arrayContaining(['idea_unsettled_corporate_action', 'comparison_unsettled_corporate_action']));
    expect(idea.result.processDetail.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'endpoint_unsettled_corporate_action', actions: [`ca_coverage_gap_AAPL_${S[9]}`] })]));
  });

  it('the backfill is confined: it writes only its own documents (and the day\'s upstream counter) — never a daily layer or a snapshot — and asks nothing while the data is complete', async () => {
    const ctx = await setup();
    for (let i = 1; i <= 6; i += 1) await closeWithAaplFailed(ctx, S[i]);
    await storeCloseSnapshot(ctx.db, S[7], quotes());
    const versionsBefore = new Map([...ctx.db._store.entries()].map(([p, e]) => [p, e.version]));
    const shared = [...ctx.db._store.keys()].filter((p) => p.startsWith('mandateUniverseDaily/') || p.startsWith('mandateUniverseSnapshots/'));
    const sharedBytes = JSON.stringify(shared.map((p) => [p, ctx.db._store.get(p)]));
    const res = await ensureCoverageBackfills(ctx.db, ctx.bookRef, { through: S[7], now: closeNowOf(S[7]), fetchCorporateActions: async () => ({ actions: [], calls: 2, failed: false }) });
    expect(res).toMatchObject({ needed: 1, fetched: 1, failed: 0, upstreamCalls: 2 });
    const changed = [...ctx.db._store.entries()].filter(([p, e]) => versionsBefore.get(p) !== e.version).map(([p]) => p).sort();
    expect(changed).toEqual(['mandateUpstreamCalls/2026-11-25', 'practiceFieldCaBackfill/AAPL']);
    expect(JSON.stringify(shared.map((p) => [p, ctx.db._store.get(p)]))).toBe(sharedBytes);
    // Pure: with the data continuous there is nothing to ask for.
    expect(backfillNeeds([ideaOf(ctx)], S[1])).toEqual([]);
    expect(backfillNeeds([{ ...ideaOf(ctx), caCoveredThrough: { AAPL: S[6], MSFT: S[6], SPY: S[6] } }], S[7])).toEqual([]);
  });

  it('(pure) sessionCoverage: the window reaches the day after; else a backfill joins it; a failed entry is covered only by a backfill through the session; a snapshot naming another layer covers nothing', () => {
    const daily = (date) => ({ date, caWindow: { from: new Date(Date.parse(`${date}T00:00:00Z`) - 5 * 864e5).toISOString().slice(0, 10) }, symbols: { AAPL: {} } });
    expect(sessionCoverage({ symbol: 'AAPL', session: S[4], coveredThrough: S[0], daily: daily(S[4]), dailyRefOk: true })).toMatchObject({ covered: true, viaBackfill: false });
    expect(sessionCoverage({ symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: daily(S[7]), dailyRefOk: true })).toMatchObject({ covered: false, reason: 'gap_beyond_window', needsBackfill: true });
    expect(sessionCoverage({ symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: daily(S[7]), dailyRefOk: true, backfill: { from: '2026-11-17', to: '2026-11-19', actions: [] } })).toMatchObject({ covered: true, viaBackfill: true });
    expect(sessionCoverage({ symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: daily(S[7]), dailyRefOk: true, backfill: { from: '2026-11-17', to: '2026-11-18', actions: [] } })).toMatchObject({ covered: false });
    const failed = { ...daily(S[2]), symbols: { AAPL: { caFetchFailed: true } } };
    expect(sessionCoverage({ symbol: 'AAPL', session: S[2], coveredThrough: S[0], daily: failed, dailyRefOk: true, backfill: { from: '2026-11-17', to: S[2], actions: [] } })).toMatchObject({ covered: true, viaBackfill: true });
    expect(sessionCoverage({ symbol: 'AAPL', session: S[2], coveredThrough: S[0], daily: failed, dailyRefOk: true, backfill: { from: '2026-11-17', to: S[1], actions: [] } })).toMatchObject({ covered: false, reason: 'ca_fetch_failed' });
    expect(sessionCoverage({ symbol: 'AAPL', session: S[1], coveredThrough: S[0], daily: daily(S[1]), dailyRefOk: false })).toMatchObject({ covered: false, reason: 'snapshot_daily_mismatch' });
    // A layer that claims a wider window than the builder fetches is not taken on trust.
    expect(sessionCoverage({ symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: { ...daily(S[7]), caWindow: { from: '2026-10-01' } }, dailyRefOk: true })).toMatchObject({ covered: false, reason: 'gap_beyond_window' });
  });
});
