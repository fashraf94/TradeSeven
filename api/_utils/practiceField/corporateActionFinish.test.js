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
import { closeIdeaBook, catchUpIdeaBook, IDEA_DOC_ALERT_BYTES, ideaDocSizeAlert } from './close.js';
import { firestoreDocumentBytes, resultPacketMissingMarks, resultPacketProvenanceProblems } from './evidence.js';
import { runFounderAction } from './founderControls.js';
import { parseSplitsPayload, parseDividendsPayload } from '../mandateCorporateActions.js';
import { fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { withBasisSuspicions, applyLedgerActions, ledgerOwnDoubtIds, ideaWideDoubtSymbols, saleHeldBackBy, valueLedger } from './ledger.js';
import { planHoldRuling } from './holdRulings.js';
import { ledgerEndpoint, ledgerDoubts } from './settlement.js';
import { dailyDocOf, dailyCoverageOf, sessionCoverage, unionActionsBySymbol, snapshotNamesDaily, DAILY_COVERAGE_REFUSAL } from './dailyCoverage.js';
import { backfillNeeds, ensureCoverageBackfills } from './caBackfill.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, contractOf, getBook, getIdea, getRow, closeNowOf, etIso,
  tickSnapshot, closeSnapshot, storeTickSnapshot, storeCloseSnapshot, takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults,
  withoutWindowAlerts, moneyStoreBytes, founderRules, vendorAnswering, CLEAN_PARSE_ENTRY, refreshFixtureParseReport } from './__testsupport__/fixtures.js';

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
  // (T1a-2b-4: the build that stored this entry wrote its clean parse report — naming the rows it now lists.)
  if (symbol !== undefined) refreshFixtureParseReport(db, date, [symbol]);
}

let restoreMode;
// No row reaches the vendor (review, lens A N3): a close across a gap longer than the window asks the backfill's fetch,
// which, with no key, fails at once — whatever key the shell exports.
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); vi.stubEnv('EODHD_API_KEY', ''); });
afterEach(() => {
  restoreMode();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

/** T1a-2b-4 (T2D-12): a session's parse report with a clean entry for AAPL — what the daily build writes for a held name. */
const reportOf = (date) => ({ schemaVersion: 1, session: date, symbols: { AAPL: CLEAN_PARSE_ENTRY } });

describe('Amendment F-6 — one rule for a daily entry', () => {
  it('the rule itself (pure): a plain object, `caFetchFailed` absent or exactly false; anything else is not covered; an own property only; a document whose date is not its key is missing', () => {
    const doc = (symbols, date = S[1]) => ({ date, symbols });
    const of = (entry) => dailyCoverageOf(dailyDocOf(doc({ AAPL: entry }), S[1]), 'AAPL', reportOf(S[1]));
    // (T1a-2b-4, T2D-12: the session's parse report is part of the rule — without a clean entry nothing is covered.)
    expect(dailyCoverageOf(dailyDocOf(doc({ AAPL: {} }), S[1]), 'AAPL')).toMatchObject({ covered: false, refusal: DAILY_COVERAGE_REFUSAL.PARSE_INCOMPLETE, parse: 'parse_report_missing' });
    for (const v of [false, 0, '', 'x', [], null, ['caFetchFailed']]) expect(of(v), JSON.stringify(v)).toMatchObject({ covered: false, refusal: DAILY_COVERAGE_REFUSAL.COVERAGE_MISSING });
    for (const f of [true, 'true', 1, 0, '', null, [], 'false', {}]) expect(of({ caFetchFailed: f }), JSON.stringify(f)).toMatchObject({ covered: true, fetchSucceeded: false, refusal: DAILY_COVERAGE_REFUSAL.FETCH_FAILED });
    for (const ok of [{}, { caFetchFailed: false }, { sector: 'Technology' }, { caFetchFailed: undefined }]) expect(of(ok)).toEqual({ covered: true, fetchSucceeded: true, refusal: null });
    // An entry inherited through the object's prototype is not the symbol's own.
    const inherited = Object.create({ AAPL: { sector: 'Technology' } });
    expect(dailyCoverageOf(dailyDocOf(doc(inherited), S[1]), 'AAPL', reportOf(S[1])).refusal).toBe(DAILY_COVERAGE_REFUSAL.COVERAGE_MISSING);
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
    const out = applyLedgerActions(ledger, { AAPL: [dividend(0.5, S[9]), dividend(0.55, S[10])] }, { date: S[11] }); // (two amounts: one amount twice within five sessions is a possible re-date, F-7)
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
  const out = await closeIdeaBook(ctx.db, ctx.bookRef, { date, now: closeNowOf(date), ...(fetchCorporateActions ? vendorAnswering(fetchCorporateActions) : {}) });
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
    const first = await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[7], now: closeNowOf(S[7]), ...vendorAnswering(failedFetch) });
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
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[8], now: closeNowOf(S[8]), ...vendorAnswering(fetch) });
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
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[9], now: closeNowOf(S[9]), ...vendorAnswering(again) });
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
    const out = await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[8], now: closeNowOf(S[8]), ...vendorAnswering(fetch) });
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
    const res = await ensureCoverageBackfills(ctx.db, ctx.bookRef, { through: S[7], now: closeNowOf(S[7]), ...vendorAnswering(async () => ({ actions: [], calls: 2, failed: false })) });
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
    expect(sessionCoverage({ parseReport: reportOf(S[4]), symbol: 'AAPL', session: S[4], coveredThrough: S[0], daily: daily(S[4]), dailyRefOk: true })).toMatchObject({ covered: true, viaBackfill: false });
    expect(sessionCoverage({ parseReport: reportOf(S[7]), symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: daily(S[7]), dailyRefOk: true })).toMatchObject({ covered: false, reason: 'gap_beyond_window', needsBackfill: true });
    expect(sessionCoverage({ parseReport: reportOf(S[7]), symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: daily(S[7]), dailyRefOk: true, backfill: { from: '2026-11-17', to: '2026-11-19', actions: [] } })).toMatchObject({ covered: true, viaBackfill: true });
    expect(sessionCoverage({ parseReport: reportOf(S[7]), symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: daily(S[7]), dailyRefOk: true, backfill: { from: '2026-11-17', to: '2026-11-18', actions: [] } })).toMatchObject({ covered: false });
    const failed = { ...daily(S[2]), symbols: { AAPL: { caFetchFailed: true } } };
    expect(sessionCoverage({ parseReport: reportOf(S[2]), symbol: 'AAPL', session: S[2], coveredThrough: S[0], daily: failed, dailyRefOk: true, backfill: { from: '2026-11-17', to: S[2], actions: [] } })).toMatchObject({ covered: true, viaBackfill: true });
    expect(sessionCoverage({ parseReport: reportOf(S[2]), symbol: 'AAPL', session: S[2], coveredThrough: S[0], daily: failed, dailyRefOk: true, backfill: { from: '2026-11-17', to: S[1], actions: [] } })).toMatchObject({ covered: false, reason: 'ca_fetch_failed' });
    expect(sessionCoverage({ parseReport: reportOf(S[1]), symbol: 'AAPL', session: S[1], coveredThrough: S[0], daily: daily(S[1]), dailyRefOk: false })).toMatchObject({ covered: false, reason: 'snapshot_daily_mismatch' });
    // A layer that claims a wider window than the builder fetches is not taken on trust.
    expect(sessionCoverage({ parseReport: reportOf(S[7]), symbol: 'AAPL', session: S[7], coveredThrough: S[0], daily: { ...daily(S[7]), caWindow: { from: '2026-10-01' } }, dailyRefOk: true })).toMatchObject({ covered: false, reason: 'gap_beyond_window' });
  });
});

// ── F-4 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Amendment F-4 — a doubt holds only what it touches; SPY in doubt is named on a measurable result', () => {
  const holding = (extra = {}) => ({ shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, openedAt: S[0], ...extra });
  const ledgerOf = (kind, holdings) => ({ kind, reservedCapitalUsd: 1000, cash: 0, holdings, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, appliedActionIds: [], declinedActionIds: [], corporateActionReceipts: [], saleReceipts: [] });
  const rec = (actionId, extra = {}) => ({ actionId, type: 'reverse_split', ticker: 'AAPL', effectiveDate: S[1], ratio: 0.5, amount: null, cashPerShare: null, source: 'eodhd_splits', heldOn: S[1], heldBecause: [], ...extra });

  it('(pure) the classification: a refusal of the ledger\'s OWN count (rounds to nothing, no entitlement data) and what waits behind only it is own; a refused ratio, a conflict, or a hold behind anything else is about the symbol', () => {
    const own = ledgerOf('comparison', { AAPL: holding({ heldActions: [
      rec('reverse_split_AAPL_a', { refused: 'rounds_to_nothing' }),
      rec('split_AAPL_b', { type: 'split', effectiveDate: S[2], heldBecause: [{ actionId: 'reverse_split_AAPL_a', type: 'reverse_split', effectiveDate: S[1], ledger: 'comparison' }] }),
    ] }) });
    expect([...ledgerOwnDoubtIds(own, {}, { date: S[3] })].sort()).toEqual(['reverse_split_AAPL_a', 'split_AAPL_b']);
    expect([...ideaWideDoubtSymbols(own, {}, { date: S[3] })]).toEqual([]);
    // The same records on the IDEA's ledger: a doubt in the idea's own count still holds the whole idea.
    expect([...ideaWideDoubtSymbols({ ...own, kind: 'idea' }, {}, { date: S[3] })]).toEqual(['AAPL']);
    // A ratio the applier refuses is the row's fault, not the holding's: the symbol is in doubt.
    const bad = ledgerOf('comparison', { AAPL: holding({ heldActions: [rec('reverse_split_AAPL_a', { refused: 'bad_ratio' })] }) });
    expect([...ideaWideDoubtSymbols(bad, {}, { date: S[3] })]).toEqual(['AAPL']);
    // Held behind something that is NOT the ledger's own (another ledger's item) — about the symbol.
    const behindOther = ledgerOf('spy', { AAPL: holding({ heldActions: [rec('split_AAPL_b', { type: 'split', heldBecause: [{ actionId: 'split_AAPL_x', type: 'split', effectiveDate: S[1], ledger: 'idea' }] })] }) });
    expect([...ideaWideDoubtSymbols(behindOther, {}, { date: S[3] })]).toEqual(['AAPL']);
    // A due row the holding has no entitlement data for (no `openedAt`): own.
    const noData = ledgerOf('spy', { AAPL: holding({ openedAt: undefined }) });
    expect([...ledgerOwnDoubtIds(noData, { AAPL: [split(2, S[2])] }, { date: S[3] })]).toEqual([`split_AAPL_${S[2]}`]);
    expect([...ideaWideDoubtSymbols(noData, { AAPL: [split(2, S[2])] }, { date: S[3] })]).toEqual([]);
    // A conflict is always about the symbol.
    const conflict = { ...ledgerOf('comparison', { AAPL: holding() }), corporateActionReceipts: [{ actionId: `split_AAPL_${S[1]}`, type: 'split', ticker: 'AAPL', effectiveDate: S[1], applied: false, reason: 'conflicting_action', entitled: true, rows: [], seenOn: S[1] }] };
    expect([...ideaWideDoubtSymbols(conflict, {}, { date: S[3] })]).toEqual(['AAPL']);
  });

  it('SPY in doubt (a conflicting split, a dividend held behind it) leaves the result MEASURABLE and names it: the symbol, the reasons, and the dividend held and not paid', async () => {
    const ctx = await setup({ names: ['AAPL'] });
    for (let i = 1; i <= 8; i += 1) await closeDay(ctx, S[i]);
    const conflict = [split(2, S[9], 'SPY'), split(3, S[9], 'SPY')];
    await closeDay(ctx, S[9], { SPY: { price: BASE.SPY, corporateActions: conflict } });
    await closeDay(ctx, S[10], { SPY: { price: BASE.SPY, corporateActions: [...conflict, dividend(1.75, S[10], 'SPY')] } }); // the due session
    const idea = ideaOf(ctx);
    expect(idea.endpoint.session).toBe(S[10]);
    expect(idea.result.economicResult).not.toBe('unmeasurable');
    expect(idea.result.economic.unmeasurableBecause).toEqual([]);
    expect(idea.result.spy.fullQuality).toBe(false);
    expect(idea.result.spy.inDoubt).toEqual([{
      symbol: 'SPY',
      reasons: [{ kind: 'conflicting_action', actionId: `split_SPY_${S[9]}`, type: 'split' }, { kind: 'held_action', actionId: `cash_dividend_SPY_${S[10]}`, type: 'cash_dividend' }],
      heldDividends: [{ actionId: `cash_dividend_SPY_${S[10]}`, amount: 1.75, effectiveDate: S[10], heldOn: S[10] }],
    }]);
    expect(idea.spyLedger.dividendsUsd).toBe(0);
  });
});

// ── F-7, F-8 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Amendment F-7 — re-dated and late actions; F-8 — the receipt link', () => {
  const paid = (ledger) => ledger.corporateActionReceipts.filter((r) => r.type === 'cash_dividend' && r.applied === true);
  const cents = (n) => Math.round(n * 100);

  it('FR-A5: a dividend the vendor RE-DATES (one day later, same amount, a new id) is paid ONCE — the second row is recorded `possible_redate`, naming both ids, alerted, and not settled', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    const bookCash = bookOf(ctx).portfolio.cash;
    await closeDay(ctx, S[1], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.24, S[1])] } });
    const out = await closeOn(ctx.db, ctx.bookId, S[2], quotes({ AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.24, S[2])] } }));
    recon(ctx);
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(paid(l).map((r) => r.actionId), f).toEqual([`cash_dividend_AAPL_${S[1]}`]);
      expect(l.dividendsUsd, f).toBe(Math.round(shares * 0.24 * 100) / 100);
      expect(l.corporateActionReceipts.filter((r) => r.reason === 'possible_redate'), f).toEqual([expect.objectContaining({
        actionId: `cash_dividend_AAPL_${S[2]}`, redateOf: `cash_dividend_AAPL_${S[1]}`, amount: 0.24, applied: false, seenOn: S[2],
      })]);
      expect(l.appliedActionIds.concat(l.declinedActionIds), f).not.toContain(`cash_dividend_AAPL_${S[2]}`); // not settled
    }
    expect(cents(bookOf(ctx).portfolio.cash) - cents(bookCash)).toBe(cents(Math.round(shares * 0.24 * 100) / 100));
    expect(withoutWindowAlerts(out.alerts).filter((a) => a.startsWith('PRACTICE_FIELD_CORPORATE_ACTION_REDATE'))).toHaveLength(2);
    // A cash dividend's re-date puts no count in doubt: the mark is fresh, nothing waits.
    expect(rowOf(ctx, S[2]).marks.AAPL.quality).toBe('vendor_time');
    // Six sessions apart is not a re-date: a dividend of the same amount then is paid.
    for (let i = 3; i <= 7; i += 1) await closeDay(ctx, S[i]);
    await closeDay(ctx, S[8], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.24, S[8])] } });
    expect(paid(ideaOf(ctx).ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`, `cash_dividend_AAPL_${S[8]}`]);
  });

  it('a SHARE-BASIS row that may be a re-date is a doubt about the count: not applied, and a dividend after it waits — on every ledger of the idea', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    await closeDay(ctx, S[1], { AAPL: { price: 115.74, corporateActions: [split(2, S[1])] } });
    await closeDay(ctx, S[2], { AAPL: { price: 115.74, corporateActions: [split(2, S[2]), dividend(0.24, S[2])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(r6(shares * 2)); // once
      expect(l.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => r.actionId), f).toEqual([`split_AAPL_${S[2]}`]);
      expect(l.holdings.AAPL.heldActions.map((r) => [r.actionId, r.heldBecause.map((c) => `${c.actionId}@${c.ledger}`)]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, [`split_AAPL_${S[2]}@comparison`, `split_AAPL_${S[2]}@idea`]]]); // each ledger names its own
      expect(l.dividendsUsd, f).toBe(0);
    }
    expect(rowOf(ctx, S[2]).marks.AAPL.quality).toBe('carried_forward');
    // The doubt survives the feed dropping the row (its receipt is durable): the dividend still waits, the mark is carried.
    // (The price stays where it is — a move back would raise the gap screen's own record and hide this one.)
    await closeDay(ctx, S[3], { AAPL: 115.74 });
    expect(ideaOf(ctx).ledger.holdings.AAPL.heldActions.map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[2]}`]);
    expect(rowOf(ctx, S[3]).marks.AAPL.quality).toBe('carried_forward');
  });

  it('RF-A2 WITHDRAWN (Amendment F rev 1, S-2): a row under a MOVED date whose payload is one of an open conflict\'s settles nothing — it is a possible re-date, both ids wait for the founder, and each ruling then pays once', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    await closeDay(ctx, S[1], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.24, S[1]), dividend(0.26, S[1])] } });
    expect(rowOf(ctx, S[1]).fullQuality).toBe(false);
    expect(ideaOf(ctx).ledger.corporateActionReceipts.filter((r) => r.reason === 'conflicting_action').map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    await closeDay(ctx, S[2], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.26, S[2])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(paid(l), f).toEqual([]);
      expect(l.declinedActionIds, f).toEqual([]);
      expect(l.corporateActionReceipts.filter((r) => r.reason === 'settled_by_redate'), f).toEqual([]);
      expect(l.corporateActionReceipts.find((r) => r.reason === 'possible_redate'), f).toMatchObject({ actionId: `cash_dividend_AAPL_${S[2]}`, redateOf: `cash_dividend_AAPL_${S[1]}` });
    }
    expect(rowOf(ctx, S[2]).fullQuality).toBe(false);
    // The founder reads it as one dividend moved: the old id `none`, the new one paid.
    await founderRules(ctx.db, ctx.bookId, ctx.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' });
    await founderRules(ctx.db, ctx.bookId, ctx.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[2]}`, decision: 'payload', payload: { amount: 0.26 } });
    await closeDay(ctx, S[3], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.26, S[2])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(paid(l).map((r) => [r.actionId, r.amount]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, 0.26]]);
      expect(l.dividendsUsd, f).toBe(Math.round(shares * 0.26 * 100) / 100);
      expect(l.declinedActionIds, f).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    }
    expect(rowOf(ctx, S[3]).fullQuality).toBe(true);
    // Listed again later — every payload the rulings saw — nothing more is paid, and nothing reopens.
    await closeDay(ctx, S[4], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.24, S[1]), dividend(0.26, S[1]), dividend(0.26, S[2])] } });
    expect(paid(ideaOf(ctx).ledger)).toHaveLength(1);
    expect(rowOf(ctx, S[4]).fullQuality).toBe(true);
  });

  it('C-16: a dividend dated BEFORE a split already applied, first listed AFTER it, is paid on the count the holding had on its own ex-date — on the idea, its comparison and the book, once', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    await closeDay(ctx, S[1]);
    await closeDay(ctx, S[2], { AAPL: { price: 115.74, corporateActions: [split(2, S[2])] } });
    const bookBefore = bookOf(ctx).portfolio.cash;
    for (const f of ['ledger', 'comparisonLedger']) {
      const r = ideaOf(ctx)[f].corporateActionReceipts.find((x) => x.actionId === `split_AAPL_${S[2]}`);
      expect(r, f).toMatchObject({ sharesBefore: shares, sharesAfter: r6(shares * 2) });
    }
    // S[3]: the vendor lists, for the first time, a $0.24 dividend dated S[1] — before the split.
    await closeDay(ctx, S[3], { AAPL: { price: 115.74, corporateActions: [dividend(0.24, S[1])] } });
    const owed = Math.round(shares * 0.24 * 100) / 100; // on the pre-split count — never r6(shares * 2) × 0.24
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.dividendsUsd, f).toBe(owed);
      expect(paid(l), f).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[1]}`, incomeUsd: owed, entitledShares: shares, entitledSharesFrom: `split_AAPL_${S[2]}` })]);
      expect(l.holdings.AAPL.shares, f).toBe(r6(shares * 2)); // the holding's count is untouched
    }
    expect(cents(bookOf(ctx).portfolio.cash) - cents(bookBefore)).toBe(cents(owed));
    expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(r6(shares * 2));
    // Listed again, paid nothing more.
    await closeDay(ctx, S[4], { AAPL: { price: 115.74, corporateActions: [dividend(0.24, S[1])] } });
    expect(ideaOf(ctx).ledger.dividendsUsd).toBe(owed);
  });

  it('C-16 (pure): the ex-date count is the one before the FIRST APPLIED of the later-dated splits — a split listed late and applied after a later-dated one does not lend its count', () => {
    const ledger = {
      kind: 'idea', reservedCapitalUsd: 1000, cash: 0, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, saleReceipts: [], declinedActionIds: [],
      holdings: { AAPL: { shares: 40, costBasisTotal: 1000, avgCost: 25, lastMark: 25, openedAt: S[0] } },
      appliedActionIds: [`split_AAPL_${S[5]}`, `split_AAPL_${S[4]}`],
      corporateActionReceipts: [ // in the order they were applied: S[5]'s first, then S[4]'s, listed late
        { actionId: `split_AAPL_${S[5]}`, type: 'split', ticker: 'AAPL', effectiveDate: S[5], ratio: 2, applied: true, appliedOn: S[5], sharesBefore: 10, sharesAfter: 20 },
        { actionId: `split_AAPL_${S[4]}`, type: 'split', ticker: 'AAPL', effectiveDate: S[4], ratio: 2, applied: true, appliedOn: S[6], sharesBefore: 20, sharesAfter: 40 },
      ],
    };
    const out = applyLedgerActions(ledger, { AAPL: [dividend(0.5, S[3])] }, { date: S[7] });
    expect(out.applied).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[3]}`, entitledShares: 10 })]);
    expect(out.ledger.dividendsUsd).toBe(5); // 10 × $0.50 — never 20 × $0.50
  });

  it('C-16 (pure): with no ex-date count on record (a share-basis receipt without `sharesBefore`), nothing is estimated — the late dividend is held, refused `count_on_ex_date_unknown`', () => {
    const ledger = {
      kind: 'idea', reservedCapitalUsd: 1000, cash: 0, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, saleReceipts: [], declinedActionIds: [],
      holdings: { AAPL: { shares: 20, costBasisTotal: 1000, avgCost: 50, lastMark: 50, openedAt: S[0] } },
      appliedActionIds: [`split_AAPL_${S[2]}`],
      corporateActionReceipts: [{ actionId: `split_AAPL_${S[2]}`, type: 'split', ticker: 'AAPL', effectiveDate: S[2], ratio: 2, applied: true, appliedOn: S[2] }],
    };
    const out = applyLedgerActions(ledger, { AAPL: [dividend(0.24, S[1])] }, { date: S[3] });
    expect(out.ledger.cash).toBe(0);
    expect(out.held).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[1]}`, refused: 'count_on_ex_date_unknown' })]);
  });

  it('F-8: a share-basis row that explains a suspicion records the record it explained (by id), and the record — retired into the holding\'s history — names the row', async () => {
    const ctx = await setup({ names: ['AAPL'] });
    await closeDay(ctx, S[1], { AAPL: 115.74 }); // a halving, no row: a suspicion
    const id = `suspected_split_AAPL_${S[1]}`;
    expect(ideaOf(ctx).ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[1] });
    await closeDay(ctx, S[2], { AAPL: { price: 115.74, corporateActions: [split(2, S[1])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const h = ideaOf(ctx)[f].holdings.AAPL;
      expect(h.basisSuspicion, f).toBeUndefined();
      expect(h.basisSuspicionHistory, f).toEqual([expect.objectContaining({ id, suspectedOn: S[1], closedOn: S[2], explainedBy: { actionId: `split_AAPL_${S[1]}`, type: 'split', ratio: 2, effectiveDate: S[1] } })]);
      expect(ideaOf(ctx)[f].corporateActionReceipts.find((r) => r.actionId === `split_AAPL_${S[1]}`).explainedSuspicion, f).toMatchObject({ id, suspectedOn: S[1] });
    }
  });
});

// ── F-5 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Amendment F-5 — the founder\'s resolution: resolve_hold', () => {
  // Astra's scenario (corporateActions.test.js fix round 3): $20,000 of AAPL at $100 — 199.940017 shares.
  const Q = { AAPL: { price: 100, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: 500 };
  const closeQ = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, { ...Q, ...over }); recon(ctx); return out; };
  const UID = 'owner-1';
  const cents = (n) => Math.round(n * 100);
  const SUSP = `suspected_split_AAPL_${S[1]}`;
  const delist = (effectiveDate) => ({ type: 'delisting', ticker: 'AAPL', cashPerShare: 30, effectiveDate, source: 'founder_action' });
  const paid = (ledger, type = 'cash_dividend') => ledger.corporateActionReceipts.filter((r) => r.type === type && r.applied === true);
  let prevEnv;
  beforeEach(() => { prevEnv = process.env.MANDATE_FOUNDER_UIDS; process.env.MANDATE_FOUNDER_UIDS = UID; });
  afterEach(() => { if (prevEnv === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = prevEnv; });
  const resolve = (ctx, body, { uid = UID, requestKey = 'rule-1', nowIso = etIso(S[3], 8, 0) } = {}) => runFounderAction(ctx.db, { uid, body: { action: 'resolve_hold', requestKey, ideaId: ctx.ideaId, ...body }, nowIso });

  async function entered() {
    const { db, bookId, bookRef } = await seedBook();
    const e = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: Q });
    const ctx = { db, bookId, bookRef, ideaId: e.ideaId };
    await closeQ(ctx, S[0]);
    expect(ideaOf(ctx).ledger.holdings.AAPL.shares).toBe(199.940017);
    return ctx;
  }
  /** S[1]: AAPL at $50, no row — a suspicion; S[2]: a $1 dividend, held behind it (the price at `s2Price`). */
  async function suspicion(s2Price = 50) {
    const ctx = await entered();
    await closeQ(ctx, S[1], { AAPL: 50 });
    await closeQ(ctx, S[2], { AAPL: { price: s2Price, corporateActions: [dividend(1, S[2])] } });
    for (const f of ['ledger', 'comparisonLedger']) expect(ideaOf(ctx)[f].holdings.AAPL.heldActions.map((r) => r.actionId), f).toEqual([`cash_dividend_AAPL_${S[2]}`]);
    return ctx;
  }

  it('SUSPICION, `price_move`: recorded on the idea, applied ONCE at the next close — the record retired naming the ruling, the held dividend paid once on the CURRENT count, the mark fresh, no new record; the sale free; a replay changes nothing', async () => {
    const ctx = await suspicion();
    const bookCash = bookOf(ctx).portfolio.cash;
    const res = await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    expect(res).toMatchObject({ status: 200, body: { ok: true, action: 'resolve_hold', kind: 'suspicion', recordId: SUSP, decision: 'price_move', appliesAt: 'next_observed_close' } });
    const ruling = ideaOf(ctx).founderRulings[0];
    expect(ruling).toMatchObject({ requestKey: 'rule-1', kind: 'suspicion', recordId: SUSP, decision: 'price_move', by: UID, at: etIso(S[3], 8, 0), appliedOn: null, covers: { suspectedOn: S[1], ratio: 0.5, frozenMark: 100 } });
    // Nothing moves until the close: the record still holds (the sale too).
    expect(ideaOf(ctx).ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[1] });
    // A replay of the request answers the stored response and writes nothing.
    const before = moneyStoreBytes(ctx.db);
    expect((await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' })).body).toMatchObject({ idempotentReplay: true });
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // S[3], AAPL still $50: the ruling applies.
    await closeQ(ctx, S[3], { AAPL: 50 });
    const idea = ideaOf(ctx);
    expect(idea.founderRulings[0].appliedOn).toBe(S[3]);
    for (const f of ['ledger', 'comparisonLedger']) {
      const h = idea[f].holdings.AAPL;
      expect(h.basisSuspicion, f).toBeUndefined();
      expect(h.basisSuspicionHistory, f).toEqual([expect.objectContaining({ id: SUSP, closedOn: S[3], resolvedBy: UID, resolvedAt: etIso(S[3], 8, 0), ruling: expect.objectContaining({ requestKey: 'rule-1', decision: 'price_move' }) })]);
      expect(paid(idea[f]).map((r) => [r.actionId, r.incomeUsd]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, 199.94]]); // on 199.940017 shares
      expect(h.shares, f).toBe(199.940017);
      expect(h.lastMark, f).toBe(50);
    }
    expect(rowOf(ctx, S[3]).marks.AAPL).toMatchObject({ mark: 50, quality: 'vendor_time' });
    expect(cents(bookOf(ctx).portfolio.cash) - cents(bookCash)).toBe(19994);
    // The next close: nothing paid again, no new record.
    await closeQ(ctx, S[4], { AAPL: 50.5 });
    expect(paid(ideaOf(ctx).ledger)).toHaveLength(1);
    expect(ideaOf(ctx).ledger.holdings.AAPL.basisSuspicion).toBeUndefined();
  });

  it('Z1 — a ruling covers only the recorded move: the split-shaped move the record hid (the price back to $100 while it stood) is judged at the ruling — a NEW record — so the identical halving after it is never read as the ruled move, and a cash delisting then is held (not paid on the old count)', async () => {
    const ctx = await suspicion(100); // S[2]: back to $100 while the record stands
    expect(ideaOf(ctx).ledger.holdings.AAPL.basisSuspicion).toMatchObject({ seenAtRaise: { session: S[1], price: 50 }, lastSeen: { session: S[2], price: 100 } });
    await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    // S[3]: AAPL halves again — identical to the ruled move — and a cash delisting is listed. Under the provisional
    // reader this read as the ruled move and paid $5,998.20 on the old count.
    const out = await closeQ(ctx, S[3], { AAPL: { price: 50, corporateActions: [delist(S[3])] } });
    const idea = ideaOf(ctx);
    const step = `suspected_split_AAPL_${S[2]}`;
    for (const f of ['ledger', 'comparisonLedger']) {
      const h = idea[f].holdings.AAPL;
      expect(h.basisSuspicion, f).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 2, frozenMark: 50, raisedBy: { ruling: 'rule-1', after: SUSP } });
      expect(h.basisSuspicionHistory, f).toEqual([expect.objectContaining({ id: SUSP, ruling: expect.objectContaining({ requestKey: 'rule-1' }), replacedBy: step })]);
      expect(paid(idea[f], 'delisting'), f).toEqual([]);
      expect(h.heldActions.map((r) => r.actionId), f).toContain(`delisting_AAPL_${S[3]}`);
    }
    expect(idea.status).not.toBe('resulted');
    expect(withoutWindowAlerts(out.alerts).filter((a) => a.startsWith('PRACTICE_FIELD_HOLD_RULING_STEP'))).toHaveLength(2);
  });

  it('B1 — a second halving made WHILE the record stood is not absorbed by a `price_move` ruling: it is a new record (×0.5, seen S[2]) and the dividend waits; the feed\'s late row for it explains it, and the dividend is paid on the adjusted count — as when the halving comes after the ruling', async () => {
    const ctx = await suspicion(25); // S[2]: $25 — a second unfed halving while the record stands
    await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    await closeQ(ctx, S[3], { AAPL: 25 });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.basisSuspicion, f).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 0.5, frozenMark: 50 });
      expect(l.holdings.AAPL.shares, f).toBe(199.940017);
      expect(paid(l), f).toEqual([]);
    }
    await closeQ(ctx, S[4], { AAPL: { price: 25, corporateActions: [split(2, S[2])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.basisSuspicion, f).toBeUndefined();
      expect(l.holdings.AAPL.shares, f).toBe(399.880034);
      expect(paid(l).map((r) => [r.actionId, r.incomeUsd]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, 399.88]]);
    }
    expect(rowOf(ctx, S[4]).marks.AAPL).toMatchObject({ mark: 25, quality: 'vendor_time' });
    // The control: the same second halving AFTER the ruling is a record of its own at that close.
    const ctl = await suspicion();
    await resolve(ctl, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    await closeQ(ctl, S[3], { AAPL: 25 });
    for (const f of ['ledger', 'comparisonLedger']) expect(ideaOf(ctl)[f].holdings.AAPL.basisSuspicion, f).toMatchObject({ suspectedOn: S[3], ratio: 0.5, frozenMark: 50 });
  });

  it('B3 — a split listed while the record stood is held behind it; after a `price_move` it is applied ONCE, explains the move it made, and nothing is re-suspected — the mark is fresh', async () => {
    const ctx = await entered();
    await closeQ(ctx, S[1], { AAPL: 50 }); // the record
    await closeQ(ctx, S[2], { AAPL: { price: 25, corporateActions: [split(2, S[2])] } }); // a real 2-for-1 a session later, held behind it
    for (const f of ['ledger', 'comparisonLedger']) expect(ideaOf(ctx)[f].holdings.AAPL.heldActions.map((r) => r.actionId), f).toEqual([`split_AAPL_${S[2]}`]);
    await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    await closeQ(ctx, S[3], { AAPL: 25 });
    for (const f of ['ledger', 'comparisonLedger']) {
      const h = ideaOf(ctx)[f].holdings.AAPL;
      expect(h.basisSuspicion, f).toBeUndefined();
      expect(h.shares, f).toBe(399.880034);
      expect(h.screenReference, f).toBeUndefined(); // replaced by the fresh mark
    }
    expect(rowOf(ctx, S[3]).marks.AAPL).toMatchObject({ mark: 25, quality: 'vendor_time' });
    await closeQ(ctx, S[4], { AAPL: 25.2 });
    expect(ideaOf(ctx).ledger.holdings.AAPL.basisSuspicion).toBeUndefined();
  });

  it('D1 — a `price_move` ruling never rewrites the mark: a mark CARRIED at the ruling\'s close still cites the snapshot that priced it, and the result packet at the due session has every endpoint mark and no provenance problem', async () => {
    const ctx = await suspicion();
    await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    const { AAPL: _none, ...noAapl } = Q;
    await closeOn(ctx.db, ctx.bookId, S[3], noAapl); // no AAPL quote at the ruling's close: its mark is carried
    recon(ctx);
    expect(rowOf(ctx, S[3]).marks.AAPL).toMatchObject({ markSource: 'carry_over' });
    expect(ideaOf(ctx).ledger.holdings.AAPL.lastMarkProvenance).toMatchObject({ session: S[0] }); // the snapshot that priced it
    expect(ideaOf(ctx).ledger.holdings.AAPL.screenReference).toMatchObject({ price: 50, session: S[2], ruling: 'rule-1' });
    for (let i = 4; i <= 10; i += 1) await closeQ(ctx, S[i], { AAPL: 50 });
    const base = `mandates/${ctx.bookId}/ideas/${ctx.ideaId}`;
    const packet = ctx.db._get(`${base}/evidence/result`);
    expect(packet).toBeTruthy();
    expect(resultPacketProvenanceProblems(packet)).toEqual([]);
    expect(resultPacketMissingMarks(packet, ctx.db._get(`${base}/rows/endpoint`))).toEqual([]);
  });

  it('Y4 — a listed split applied AFTER the ruling does not re-suspect the ruled move: the reference the ruling set moves with it', async () => {
    const ctx = await suspicion();
    await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    // S[3]: a real 2-for-1 dated S[3], listed; AAPL prints $25.
    await closeQ(ctx, S[3], { AAPL: { price: 25, corporateActions: [split(2, S[3])] } });
    const idea = ideaOf(ctx);
    for (const f of ['ledger', 'comparisonLedger']) {
      const h = idea[f].holdings.AAPL;
      expect(h.basisSuspicion, f).toBeUndefined();
      expect(h.shares, f).toBe(399.880034);
      expect(h.lastMark, f).toBe(25);
      expect(paid(idea[f]).map((r) => r.incomeUsd), f).toEqual([199.94]); // the held dividend, dated before the split
    }
    expect(rowOf(ctx, S[3]).marks.AAPL).toMatchObject({ mark: 25, quality: 'vendor_time' });
  });

  it('N3 — after a ruled halving a LATER 2-for-1 is judged against the fresh mark: its own row explains it and the cash it held is paid on the adjusted count', async () => {
    const ctx = await suspicion();
    await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    await closeQ(ctx, S[3], { AAPL: 50 });
    await closeQ(ctx, S[4], { AAPL: { price: 25, corporateActions: [dividend(0.5, S[4])] } }); // an unfed 2-for-1: a record of ×0.5 against $50
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(ideaOf(ctx)[f].holdings.AAPL.basisSuspicion, f).toMatchObject({ suspectedOn: S[4], ratio: 0.5, frozenMark: 50 });
    }
    await closeQ(ctx, S[5], { AAPL: { price: 25, corporateActions: [split(2, S[4]), dividend(0.5, S[4])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.basisSuspicion, f).toBeUndefined();
      expect(l.holdings.AAPL.shares, f).toBe(399.880034);
      expect(paid(l).map((r) => [r.actionId, r.incomeUsd]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, 199.94], [`cash_dividend_AAPL_${S[4]}`, 199.94]]);
    }
  });

  it('SUSPICION, `split`: the ratio must match the recorded shape; a match applies the split ONCE at the next close with a founder receipt, retires the record naming the ruling, and pays the held dividend on the adjusted count — the book\'s mirror too; the feed\'s own re-dated row later is a possible re-date', async () => {
    const ctx = await suspicion();
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'split', ratio: 3 })).toMatchObject({ status: 422, body: { error: 'ruling_does_not_match_record' } });
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'split', ratio: 0 }, { requestKey: 'rule-0' })).toMatchObject({ status: 400, body: { error: 'ratio_invalid' } });
    expect(ideaOf(ctx).founderRulings ?? []).toEqual([]);
    const bookCash = bookOf(ctx).portfolio.cash;
    expect((await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'split', ratio: 2 }, { requestKey: 'rule-2' })).status).toBe(200);
    await closeQ(ctx, S[3], { AAPL: 50 });
    const FOUNDER_SPLIT = `split_AAPL_${S[1]}`;
    const idea = ideaOf(ctx);
    expect(idea.founderRulings[0].appliedOn).toBe(S[3]);
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = idea[f];
      expect(l.holdings.AAPL.shares, f).toBe(399.880034);
      expect(l.corporateActionReceipts.find((r) => r.actionId === FOUNDER_SPLIT), f).toMatchObject({ applied: true, source: 'founder_ruling', founderRuling: { requestKey: 'rule-2', recordId: SUSP, decision: 'split', by: UID }, explainedSuspicion: { id: SUSP } });
      expect(l.holdings.AAPL.basisSuspicionHistory, f).toEqual([expect.objectContaining({ id: SUSP, explainedBy: expect.objectContaining({ actionId: FOUNDER_SPLIT }), ruling: expect.objectContaining({ requestKey: 'rule-2' }) })]);
      expect(paid(l).map((r) => r.incomeUsd), f).toEqual([399.88]);
    }
    expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(399.880034);
    expect(cents(bookOf(ctx).portfolio.cash) - cents(bookCash)).toBe(39988);
    // The vendor later lists the same split under another date (a session after the founder's): a possible re-date —
    // not applied; a row under the founder's own date (its id) is simply skipped.
    await closeQ(ctx, S[4], { AAPL: { price: 50, corporateActions: [split(2, S[2]), split(2, S[1])] } });
    expect(ideaOf(ctx).ledger.holdings.AAPL.shares).toBe(399.880034);
    expect(ideaOf(ctx).ledger.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => r.actionId)).toEqual([`split_AAPL_${S[2]}`]);
  });

  it('CONFLICT, a recorded payload: a conflict the feed has DROPPED (C-6) is applied once at the next close; `none` declines one; a payload not recorded is refused', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    await closeDay(ctx, S[1], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.24, S[1]), dividend(0.26, S[1])] } });
    await closeDay(ctx, S[2]); // the feed drops it: it stays unsettled, the rows not full quality
    expect(rowOf(ctx, S[2]).fullQuality).toBe(false);
    const ID = `cash_dividend_AAPL_${S[1]}`;
    expect(await resolve(ctx, { kind: 'conflict', recordId: ID, decision: 'payload', payload: { amount: 0.25 } })).toMatchObject({ status: 422, body: { error: 'payload_not_recorded' } });
    expect((await resolve(ctx, { kind: 'conflict', recordId: ID, decision: 'payload', payload: { amount: 0.26 } }, { requestKey: 'rule-c' })).status).toBe(200);
    expect(await resolve(ctx, { kind: 'conflict', recordId: ID, decision: 'none' }, { requestKey: 'rule-c2' })).toMatchObject({ status: 409, body: { error: 'record_already_resolved' } });
    await closeDay(ctx, S[3]);
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(paid(l).map((r) => [r.actionId, r.amount]), f).toEqual([[ID, 0.26]]);
      expect(l.dividendsUsd, f).toBe(Math.round(shares * 0.26 * 100) / 100);
      expect(paid(l)[0], f).toMatchObject({ source: 'founder_ruling', founderRuling: { requestKey: 'rule-c', decision: 'payload' } });
    }
    expect(rowOf(ctx, S[3]).fullQuality).toBe(true);
    expect(ideaOf(ctx).founderRulings[0].appliedOn).toBe(S[3]);
    // …listed again later (both rows), nothing more is paid; and the record is resolved.
    await closeDay(ctx, S[4], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.24, S[1]), dividend(0.26, S[1])] } });
    expect(paid(ideaOf(ctx).ledger)).toHaveLength(1);
    expect(await resolve(ctx, { kind: 'conflict', recordId: ID, decision: 'none' }, { requestKey: 'rule-c3' })).toMatchObject({ status: 409, body: { error: 'record_already_resolved' } });
    // `none` on another conflict: declined on every ledger that records it, nothing paid.
    await closeDay(ctx, S[5], { AAPL: { price: BASE.AAPL, corporateActions: [dividend(0.3, S[5]), dividend(0.31, S[5])] } });
    expect((await resolve(ctx, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[5]}`, decision: 'none' }, { requestKey: 'rule-n' })).status).toBe(200);
    await closeDay(ctx, S[6]);
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.declinedActionIds, f).toContain(`cash_dividend_AAPL_${S[5]}`);
      expect(l.corporateActionReceipts.find((r) => r.reason === 'founder_ruled_none'), f).toMatchObject({ actionId: `cash_dividend_AAPL_${S[5]}`, founderRuling: { requestKey: 'rule-n' } });
      expect(paid(l), f).toHaveLength(1);
    }
    expect(rowOf(ctx, S[6]).fullQuality).toBe(true);
  });

  it('CONFLICT on a POSSIBLE RE-DATE (Astra\'s T2A-E01 case under F-7): the founder applies the Nov 18 2-for-1 — applied once at the next close, it explains the note, and the held dividend is paid ONCE on 799.760068 shares, $799.76', async () => {
    const ctx = await entered();
    await closeQ(ctx, S[1], { AAPL: 50 }); // Nov 17: a note
    await closeQ(ctx, S[2], { AAPL: { price: 25, corporateActions: [split(2, S[1]), dividend(1, S[2])] } }); // Nov 18: the residual move is noted; the dividend waits
    await closeQ(ctx, S[3], { AAPL: { price: 25, corporateActions: [split(2, S[2])] } }); // Nov 19: the Nov 18 split — a possible re-date
    expect(ideaOf(ctx).ledger.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => r.actionId)).toEqual([`split_AAPL_${S[2]}`]);
    const bookCash = bookOf(ctx).portfolio.cash;
    expect((await resolve(ctx, { kind: 'conflict', recordId: `split_AAPL_${S[2]}`, decision: 'payload', payload: { ratio: 2 } }, { nowIso: etIso(S[4], 8, 0) })).status).toBe(200);
    await closeQ(ctx, S[4], { AAPL: 25 });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(799.760068);
      expect(l.holdings.AAPL.basisSuspicion, f).toBeUndefined();
      expect(paid(l).map((r) => r.incomeUsd), f).toEqual([799.76]);
    }
    expect(cents(bookOf(ctx).portfolio.cash) - cents(bookCash)).toBe(79976);
    // A replay of every row pays nothing more.
    await closeQ(ctx, S[5], { AAPL: { price: 25, corporateActions: [split(2, S[1]), split(2, S[2]), dividend(1, S[2])] } });
    expect(paid(ideaOf(ctx).ledger)).toHaveLength(1);
    expect(ideaOf(ctx).ledger.holdings.AAPL.shares).toBe(799.760068);
  });

  it('COVERAGE GAP: `no_action` clears the doubt at the next close; `row` applies one RECORDED backfill row once; a row the backfill does not hold is refused', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    for (let i = 1; i <= 6; i += 1) await closeWithAaplFailed(ctx, S[i]);
    const ID = `ca_coverage_gap_AAPL_${S[0]}`;
    expect(ideaOf(ctx).caCoverageGaps.AAPL).toMatchObject({ since: S[0], lastSession: S[6] });
    // A failed backfill kept its partial rows: the founder may pick one of them.
    ctx.db._store.set('practiceFieldCaBackfill/AAPL', { data: { schemaVersion: 1, symbol: 'AAPL', from: '2026-11-17', to: S[6], failed: true, actions: [dividend(0.24, S[3])], calls: 2 }, version: 1 });
    expect(await resolve(ctx, { kind: 'coverage_gap', recordId: ID, decision: 'row', actionId: `cash_dividend_AAPL_${S[4]}` })).toMatchObject({ status: 422, body: { error: 'row_not_recorded' } });
    expect((await resolve(ctx, { kind: 'coverage_gap', recordId: ID, decision: 'row', actionId: `cash_dividend_AAPL_${S[3]}` }, { requestKey: 'rule-g', nowIso: etIso(S[7], 8, 0) })).status).toBe(200);
    await closeDay(ctx, S[7]);
    const idea = ideaOf(ctx);
    expect(idea.caCoveredThrough.AAPL).toBe(S[7]);
    expect(idea.caCoverageGaps).toEqual({});
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(paid(idea[f]).map((r) => [r.actionId, r.incomeUsd, r.founderRuling?.requestKey]), f).toEqual([[`cash_dividend_AAPL_${S[3]}`, Math.round(shares * 0.24 * 100) / 100, 'rule-g']]);
    }
    expect(rowOf(ctx, S[7]).marks.AAPL.quality).toBe('vendor_time');
    // `no_action` on another idea's gap: the doubt clears, nothing applied.
    const other = await setup();
    for (let i = 1; i <= 6; i += 1) await closeWithAaplFailed(other, S[i]);
    expect((await resolve(other, { kind: 'coverage_gap', recordId: ID, decision: 'no_action' }, { nowIso: etIso(S[7], 8, 0) })).status).toBe(200);
    await closeDay(other, S[7]);
    expect(ideaOf(other).caCoveredThrough.AAPL).toBe(S[7]);
    expect(ideaOf(other).ledger.dividendsUsd).toBe(0);
  });

  it('the REFUSALS: a record that does not exist, a kind or decision outside the vocabulary, an idea not open, a CLOSED book — each writes nothing', async () => {
    const ctx = await suspicion();
    const before = moneyStoreBytes(ctx.db);
    expect(await resolve(ctx, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[0]}`, decision: 'price_move' }, { requestKey: 'x1' })).toMatchObject({ status: 404, body: { error: 'record_not_found' } });
    expect(await resolve(ctx, { kind: 'conflict', recordId: 'cash_dividend_AAPL_2026-11-17', decision: 'none' }, { requestKey: 'x2' })).toMatchObject({ status: 404, body: { error: 'record_not_found' } });
    expect(await resolve(ctx, { kind: 'coverage_gap', recordId: 'ca_coverage_gap_AAPL_2026-11-16', decision: 'no_action' }, { requestKey: 'x3' })).toMatchObject({ status: 404, body: { error: 'record_not_found' } });
    expect(await resolve(ctx, { kind: 'mystery', recordId: SUSP, decision: 'price_move' }, { requestKey: 'x4' })).toMatchObject({ status: 400, body: { error: 'kind_invalid' } });
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'ignore' }, { requestKey: 'x5' })).toMatchObject({ status: 400, body: { error: 'decision_invalid' } });
    expect(await runFounderAction(ctx.db, { uid: UID, body: { action: 'resolve_hold', requestKey: 'x6', ideaId: 'idea_nope', kind: 'suspicion', recordId: SUSP, decision: 'price_move' }, nowIso: etIso(S[3], 8, 0) })).toMatchObject({ status: 404, body: { error: 'record_not_found' } });
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // Already resolved: a second ruling on a record with a pending one; and once applied, the retired record.
    expect((await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' }, { requestKey: 'r1' })).status).toBe(200);
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'split', ratio: 2 }, { requestKey: 'r2' })).toMatchObject({ status: 409, body: { error: 'record_already_resolved' } });
    await closeQ(ctx, S[3], { AAPL: 50 });
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' }, { requestKey: 'r3' })).toMatchObject({ status: 409, body: { error: 'record_already_resolved' } });
    // A closed book.
    const book = ctx.db._get(`mandates/${ctx.bookId}`);
    ctx.db._store.set(`mandates/${ctx.bookId}`, { data: { ...book, status: 'closed' }, version: 999 });
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' }, { requestKey: 'r4' })).toMatchObject({ status: 409, body: { error: 'book_closed' } });
  });

  it('BOTH GATES and the token\'s uid: a non-founder, and the founder at \'off\', get 403 and nothing is read or written; a body\'s uid is never read — the caller\'s own book only', async () => {
    const ctx = await suspicion();
    const before = moneyStoreBytes(ctx.db);
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' }, { uid: 'someone-else' })).toEqual({ status: 403, body: { error: 'forbidden' } });
    delete process.env.MANDATE_FOUNDER_UIDS;
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' })).toEqual({ status: 403, body: { error: 'forbidden' } });
    process.env.MANDATE_FOUNDER_UIDS = UID;
    const restoreOff = setPracticeFieldModeForTests('off');
    try {
      const reads = vi.spyOn(ctx.db, 'runTransaction');
      expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' })).toEqual({ status: 403, body: { error: 'forbidden' } });
      expect(reads).not.toHaveBeenCalled();
    } finally { restoreOff(); }
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // Another founder, naming this book's idea and the owner's uid in the body: their own claim decides — they have none.
    process.env.MANDATE_FOUNDER_UIDS = `${UID},intruder`;
    expect(await runFounderAction(ctx.db, { uid: 'intruder', body: { action: 'resolve_hold', requestKey: 'i1', uid: UID, userId: UID, ideaId: ctx.ideaId, kind: 'suspicion', recordId: SUSP, decision: 'price_move' }, nowIso: etIso(S[3], 8, 0) })).toEqual({ status: 404, body: { error: 'no_open_book' } });
    expect(moneyStoreBytes(ctx.db)).toBe(before);
    // One key, two different rulings: the second is a conflict, not a replay.
    expect((await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' }, { requestKey: 'same' })).status).toBe(200);
    expect(await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'split', ratio: 2 }, { requestKey: 'same' })).toMatchObject({ status: 409, body: { error: 'request_key_conflict' } });
  });
});

// ── F-9 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Amendment F-9 — the idea document\'s size (T2C-04)', () => {
  it('(pure) Firestore\'s storage rules for a document, and the line: 786,432 bytes (768 KiB) alerts, 786,431 does not', () => {
    // mandates(9) b(2) ideas(6) i(2) + 16 = 35; { a: 'xy' } = 2 + 3 = 5; + 32.
    expect(firestoreDocumentBytes('mandates/b/ideas/i', { a: 'xy' })).toBe(72);
    expect(IDEA_DOC_ALERT_BYTES).toBe(786432);
    expect(ideaDocSizeAlert('b', 'i', 786431)).toBeNull();
    expect(ideaDocSizeAlert('b', 'i', 786432)).toBe('PRACTICE_FIELD_IDEA_DOC_LARGE b i 786432 bytes — the idea document is past 786432 bytes (768 KiB) of Firestore\'s 1 MiB; a close that cannot write it fails for good');
  });

  it('through a close: the idea document it is about to write is measured — at exactly 768 KiB it alerts, one byte under it does not; nothing else changes', async () => {
    const padded = async (len) => {
      const ctx = await setup();
      const path = `mandates/${ctx.bookId}/ideas/${ctx.ideaId}`;
      const e = ctx.db._store.get(path);
      ctx.db._store.set(path, { data: { ...e.data, padding: 'x'.repeat(len) }, version: e.version + 1 });
      const out = await closeDay(ctx, S[1]);
      return { ctx, out, bytes: firestoreDocumentBytes(path, ctx.db._get(path)), path };
    };
    const probe = await padded(1000);
    const atLine = 1000 + (IDEA_DOC_ALERT_BYTES - probe.bytes);
    const at = await padded(atLine);
    expect(at.bytes).toBe(IDEA_DOC_ALERT_BYTES);
    expect(at.out.alerts.filter((a) => a.startsWith('PRACTICE_FIELD_IDEA_DOC_LARGE'))).toEqual([`PRACTICE_FIELD_IDEA_DOC_LARGE ${at.ctx.bookId} ${at.ctx.ideaId} ${IDEA_DOC_ALERT_BYTES} bytes — the idea document is past 786432 bytes (768 KiB) of Firestore's 1 MiB; a close that cannot write it fails for good`]);
    const under = await padded(atLine - 1);
    expect(under.bytes).toBe(IDEA_DOC_ALERT_BYTES - 1);
    expect(under.out.alerts.filter((a) => a.startsWith('PRACTICE_FIELD_IDEA_DOC_LARGE'))).toEqual([]);
    // The close itself is the same either way.
    expect(rowOf(at.ctx, S[1]).markedValue).toBe(rowOf(under.ctx, S[1]).markedValue);
  });
});

// ── F-1 and the gap screen; C-12 ─────────────────────────────────────────────────────────────────────────────────────

describe('F-1 beside the gap screen, and C-12', () => {
  it('a 2-for-1 DURING an outage halves the price: the screen leaves the uncovered symbol alone (no record a later row could fail to explain); the backfilled split applies at recovery and the mark is fresh — no suspicion at all', async () => {
    const ctx = await setup({ names: ['AAPL'] });
    const shares = sharesOf(ctx);
    for (let i = 1; i <= 6; i += 1) await closeWithAaplFailed(ctx, S[i], i >= 2 ? { AAPL: 115.74 } : {});
    for (const f of ['ledger', 'comparisonLedger']) expect(ideaOf(ctx)[f].holdings.AAPL.basisSuspicion, f).toBeUndefined();
    const fetch = vi.fn(async (sym) => ({ actions: sym === 'AAPL' ? [split(2, S[2])] : [], calls: 2, failed: false }));
    await storeCloseSnapshot(ctx.db, S[7], quotes({ AAPL: 115.8 }));
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[7], now: closeNowOf(S[7]), ...vendorAnswering(fetch) });
    recon(ctx);
    for (const f of ['ledger', 'comparisonLedger']) {
      const h = ideaOf(ctx)[f].holdings.AAPL;
      expect(h.shares, f).toBe(r6(shares * 2));
      expect(h.basisSuspicion, f).toBeUndefined();
      expect(h.basisSuspicionHistory, f).toBeUndefined();
    }
    expect(rowOf(ctx, S[7]).marks.AAPL).toMatchObject({ mark: 115.8, quality: 'vendor_time' });
  });

  it('C-12 is NOT reachable under today\'s feed: the feed\'s parsers — the daily layer\'s and the backfill\'s, one fetch — emit only splits, reverse splits and cash dividends; a ticker change (or a delisting) comes only from a row the founder writes', () => {
    const splits = parseSplitsPayload('aapl', [{ date: '2026-11-17', split: '2/1' }, { date: '2026-11-18', split: '1/5' }, { date: '2026-11-19', split: '1/1' }, { date: 'x', split: 'nonsense' }]);
    const dividends = parseDividendsPayload('aapl', [{ date: '2026-11-17', value: 0.24 }, { date: '2026-11-18', unadjustedValue: 0.3, value: 0.15 }, { date: '2026-11-19', value: -1 }]);
    const types = new Set([...splits.actions, ...dividends.actions].map((a) => a.type));
    expect([...types].sort()).toEqual(['cash_dividend', 'reverse_split', 'split']);
    // The backfill calls the daily builder's own fetch (caBackfill.js imports fetchCorporateActionsEODHD), which parses
    // with exactly these two functions.
    expect(fetchCorporateActionsEODHD.toString()).toMatch(/parseSplitsPayload\][\s\S]*parseDividendsPayload\]/);
  });
});

// ── The review's fix round (§5): lens C, and the rows the first battery's survivors asked for ─────────────────────────

describe('the review\'s fix round — re-dated and late actions (lens C); coverage rows the battery asked for', () => {
  const UID = 'owner-1';
  let prevEnv;
  beforeEach(() => { prevEnv = process.env.MANDATE_FOUNDER_UIDS; process.env.MANDATE_FOUNDER_UIDS = UID; });
  afterEach(() => { if (prevEnv === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = prevEnv; });
  const resolve = (ctx, body, requestKey, nowIso) => runFounderAction(ctx.db, { uid: UID, body: { action: 'resolve_hold', requestKey, ideaId: ctx.ideaId, ...body }, nowIso });
  const held = (l) => (l.holdings.AAPL?.heldActions || []).map((r) => r.actionId);
  const paidIds = (l) => l.corporateActionReceipts.filter((r) => r.type === 'cash_dividend' && r.applied === true).map((r) => r.actionId);
  /** A ledger planted for a pure row: AAPL only. */
  const plain = (over = {}) => ({
    kind: 'idea', reservedCapitalUsd: 1000, cash: 0, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, saleReceipts: [], declinedActionIds: [], appliedActionIds: [],
    corporateActionReceipts: [], ...over,
  });
  // No test reaches the vendor: a close across a gap longer than the window asks this instead.
  const noFetch = async () => ({ actions: [], calls: 0, failed: true });

  it('C1: a share-basis possible re-date on the idea\'s OWN ledger holds the idea\'s sale and refuses the name on admission — with a comparison that does not hold the name (sector_fund) as with a same-stock one', async () => {
    for (const comparison of [{ type: 'sector_fund', symbols: ['XLK'] }, { type: 'same_stock_held' }]) {
      const ctx = await setup({ names: ['AAPL'], comparison, lines: [{ symbol: 'AAPL', distancePct: 0.05 }] });
      await closeDay(ctx, S[1], { AAPL: { price: 140, corporateActions: [split(1.5, S[1])] } }); // applied; the line breached: the exit queued
      expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending, comparison.type).toBeTruthy();
      await closeDay(ctx, S[2], { AAPL: { price: 93.33, corporateActions: [split(1.5, S[2])] } }); // a 3-for-2 one session later: a possible re-date
      await closeDay(ctx, S[3], { AAPL: 93.33 }); // the feed drops the row
      await closeDay(ctx, S[4], { AAPL: 93.33 });
      expect(ideaOf(ctx).ledger.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => r.actionId), comparison.type).toEqual([`split_AAPL_${S[2]}`]);
      await storeTickSnapshot(ctx.db, S[5], 'open30', quotes({ AAPL: 93.33 }));
      const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'c1', nowIso: etIso(S[5], 11, 0) });
      expect(res.refusals, comparison.type).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', unavailable: [expect.objectContaining({ symbol: 'AAPL', reason: 'corporate_action_unsettled' })] })]);
      expect((await windowAt(ctx.db, ctx.bookId, { date: S[5], slot: 'open30' })).sales, comparison.type).toMatchObject({ sold: 0, waiting: 1 });
      expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending.waiting.lastRefusal, comparison.type).toBe('corporate_action_unsettled');
    }
  });

  it('C2: the founder applies a re-date of a HELD dividend — the original is recorded `possible_redate` at once (Amendment F rev 1, S-1 ③: the row it may repeat is ambiguous too) and its held record goes: paid once, nothing holds the sale for good, and `none` then declines it', async () => {
    const ctx = await setup();
    const conflict = [split(2, S[1]), split(3, S[1])];
    await closeDay(ctx, S[1], { AAPL: { price: 115.74, corporateActions: [...conflict, dividend(0.24, S[1])] } });
    expect(held(ideaOf(ctx).ledger)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    await closeDay(ctx, S[2], { AAPL: { price: 115.74, corporateActions: [...conflict, dividend(0.24, S[2])] } });
    expect((await resolve(ctx, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[2]}`, decision: 'payload', payload: { amount: 0.24 } }, 'rule-1', etIso(S[3], 8, 0))).status).toBe(200);
    await closeDay(ctx, S[3], { AAPL: { price: 115.74, corporateActions: conflict } });
    // Held behind the conflict, the founder's action keeps its ruling on its held record.
    for (const f of ['ledger', 'comparisonLedger']) expect(ideaOf(ctx)[f].holdings.AAPL.heldActions.find((r) => r.actionId === `cash_dividend_AAPL_${S[2]}`), f).toMatchObject({ founderRuling: expect.objectContaining({ requestKey: 'rule-1' }) });
    // (Amendment F rev 1: the split conflict is settled by the founder's ruling — the feed's one row alone no longer does.)
    expect((await resolve(ctx, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 2 } }, 'rule-split', etIso(S[4], 8, 0))).status).toBe(200);
    await closeDay(ctx, S[4], { AAPL: { price: 115.74, corporateActions: [split(2, S[1])] } }); // the conflict settles: ×2
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(paidIds(l), f).toEqual([`cash_dividend_AAPL_${S[2]}`]); // once
      // Held behind the conflict at S[3] and applied from its record: its receipt still names the ruling.
      expect(l.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[2]}` && r.applied), f).toMatchObject({ founderRuling: expect.objectContaining({ requestKey: 'rule-1' }) });
      expect(held(l), f).toEqual([]);
      expect(l.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[1]}` && r.reason === 'possible_redate'), f).toMatchObject({ redateOf: `cash_dividend_AAPL_${S[2]}` });
    }
    for (const d of [S[5], S[6], S[7]]) await closeDay(ctx, d, { AAPL: 115.74 });
    const idea = ideaOf(ctx);
    const snap = await storeTickSnapshot(ctx.db, S[8], 'open30', quotes({ AAPL: 115.74 }));
    expect(saleHeldBackBy(idea.ledger, 'AAPL', snap, { sinceDate: S[7], date: S[8], otherLedgers: [idea.comparisonLedger, idea.spyLedger], actionsBySymbol: {} })).toBeNull();
    expect((await resolve(ctx, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' }, 'rule-2', etIso(S[8], 8, 0))).status).toBe(200);
    await closeDay(ctx, S[8], { AAPL: 115.74 });
    expect(ideaOf(ctx).ledger.declinedActionIds).toContain(`cash_dividend_AAPL_${S[1]}`);
    expect(paidIds(ideaOf(ctx).ledger)).toEqual([`cash_dividend_AAPL_${S[2]}`]);
  });

  it('C2 backstop (pure): a held record whose id is already settled holds nothing — the sale gate passes it, and the next call drops it', () => {
    const rec = { actionId: `cash_dividend_AAPL_${S[1]}`, type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount: 0.24, heldOn: S[1], heldBecause: [] };
    const ledger = plain({
      declinedActionIds: [rec.actionId],
      holdings: { AAPL: { shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, openedAt: S[0], heldActions: [rec] } },
    });
    expect(saleHeldBackBy(ledger, 'AAPL', tickSnapshot(S[2], 'open30', quotes({ AAPL: 100 })), { sinceDate: S[1], date: S[2], actionsBySymbol: {} })).toBeNull();
    expect(applyLedgerActions(ledger, {}, { date: S[2] }).ledger.holdings.AAPL.heldActions).toBeUndefined();
    // Not settled, it still holds.
    expect(saleHeldBackBy({ ...ledger, declinedActionIds: [] }, 'AAPL', tickSnapshot(S[2], 'open30', quotes({ AAPL: 100 })), { sinceDate: S[1], date: S[2], actionsBySymbol: {} })).toBe('corporate_action_unsettled');
  });

  it('C3 (pure): a split dated BEFORE the dividend but listed late — applied after a later-dated split — is in the ex-date count: 10 × 1.5 = 15, never 10', () => {
    const ledger = plain({
      holdings: { AAPL: { shares: 30, costBasisTotal: 1000, avgCost: 1000 / 30, lastMark: 25, openedAt: S[0] } },
      appliedActionIds: [`split_AAPL_${S[5]}`, `split_AAPL_${S[2]}`],
      corporateActionReceipts: [ // in the order applied: S[5]'s, then S[2]'s (listed late)
        { actionId: `split_AAPL_${S[5]}`, type: 'split', ticker: 'AAPL', effectiveDate: S[5], ratio: 2, applied: true, appliedOn: S[5], sharesBefore: 10, sharesAfter: 20 },
        { actionId: `split_AAPL_${S[2]}`, type: 'split', ticker: 'AAPL', effectiveDate: S[2], ratio: 1.5, applied: true, appliedOn: S[6], sharesBefore: 20, sharesAfter: 30 },
      ],
    });
    const out = applyLedgerActions(ledger, { AAPL: [dividend(0.5, S[3])] }, { date: S[7] });
    expect(out.applied).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[3]}`, entitledShares: 15 })]);
    expect(out.ledger.dividendsUsd).toBe(7.5);
    expect(out.ledger.corporateActionReceipts.at(-1)).toMatchObject({ entitledShares: 15, entitledSharesFrom: `split_AAPL_${S[5]}`, entitledSharesAlsoFrom: [`split_AAPL_${S[2]}`] });
  });

  it('RF-A2 WITHDRAWN (pure; Amendment F rev 1): a row matching two open conflicts\' payloads settles neither — it is a possible re-date of the first, and all three wait for the founder', () => {
    const conflictOf = (date) => ({
      actionId: `cash_dividend_AAPL_${date}`, type: 'cash_dividend', ticker: 'AAPL', effectiveDate: date, applied: false, reason: 'conflicting_action', entitled: true,
      rows: [{ ratio: null, amount: 0.24, source: 'eodhd_dividends' }, { ratio: null, amount: 0.26, source: 'eodhd_dividends' }], seenOn: date,
    });
    const ledger = plain({ holdings: { AAPL: { shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, openedAt: S[0] } }, corporateActionReceipts: [conflictOf(S[1]), conflictOf(S[2])] });
    const out = applyLedgerActions(ledger, { AAPL: [dividend(0.26, S[3])] }, { date: S[3] });
    expect(out.ledger.corporateActionReceipts.filter((r) => r.reason === 'settled_by_redate')).toEqual([]);
    expect(out.ledger.declinedActionIds).toEqual([]);
    expect(out.ledger.appliedActionIds).toEqual([]);
    expect(out.ledger.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => [r.actionId, r.redateOf])).toEqual([[`cash_dividend_AAPL_${S[3]}`, `cash_dividend_AAPL_${S[1]}`]]);
    expect(out.ledger.dividendsUsd).toBe(0);
  });

  it('RF-A2 (pure): a row that is itself a possible re-date of a dividend already paid does not settle a conflict — the conflict stays for the founder, and the row is recorded, not applied', () => {
    const conflict = {
      actionId: `cash_dividend_AAPL_${S[3]}`, type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[3], applied: false, reason: 'conflicting_action', entitled: true,
      rows: [{ ratio: null, amount: 0.24, source: 'eodhd_dividends' }, { ratio: null, amount: 0.26, source: 'eodhd_dividends' }], seenOn: S[3],
    };
    const paidEarlier = { actionId: `cash_dividend_AAPL_${S[1]}`, type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], ratio: null, amount: 0.24, incomeUsd: 2.4, applied: true, appliedOn: S[1] };
    const ledger = plain({
      holdings: { AAPL: { shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, openedAt: S[0] } },
      appliedActionIds: [paidEarlier.actionId], dividendsUsd: 2.4, cash: 2.4, corporateActionReceipts: [paidEarlier, conflict],
    });
    const out = applyLedgerActions(ledger, { AAPL: [dividend(0.24, S[2])] }, { date: S[4] });
    expect(out.ledger.corporateActionReceipts.filter((r) => r.reason === 'settled_by_redate')).toEqual([]);
    expect(out.ledger.declinedActionIds).toEqual([]);
    expect(out.ledger.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => [r.actionId, r.redateOf])).toEqual([[`cash_dividend_AAPL_${S[2]}`, paidEarlier.actionId]]);
    expect(out.ledger.dividendsUsd).toBe(2.4);
  });

  it('F-1 on ADMISSION: the first day after an outage longer than the window, the day\'s entry is clean but does not reach back — the name is refused `ca_coverage_gap` until the close backfills', async () => {
    const ctx = await setup();
    for (let i = 1; i <= 6; i += 1) await closeWithAaplFailed(ctx, S[i], {}, { fetchCorporateActions: noFetch });
    await storeTickSnapshot(ctx.db, S[7], 'open30', quotes());
    expect(dailyCoverageOf(ctx.db._get(`mandateUniverseDaily/${S[7]}`), 'AAPL', ctx.db._get(`practiceFieldCaParseReports/${S[7]}`))).toMatchObject({ covered: true, refusal: null }); // the day's own entry is clean
    const res = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'f1', nowIso: etIso(S[7], 11, 0) });
    expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', unavailable: [expect.objectContaining({ symbol: 'AAPL', reason: 'ca_coverage_gap' })] })]);
  });

  it('the backfill never NARROWS: a stored success that starts after the needed day is fetched again from the needed day, and the wider range is kept', async () => {
    const ctx = await setup();
    for (let i = 1; i <= 6; i += 1) await closeWithAaplFailed(ctx, S[i], {}, { fetchCorporateActions: noFetch });
    ctx.db._store.set('practiceFieldCaBackfill/AAPL', { data: { schemaVersion: 1, symbol: 'AAPL', from: '2026-11-20', to: S[7], failed: false, actions: [], calls: 2, fetchedAt: etIso(S[7], 8, 0), source: 'idea_book_backfill' }, version: 9 });
    await storeCloseSnapshot(ctx.db, S[7], quotes());
    const fetch = vi.fn(async () => ({ actions: [], calls: 2, failed: false }));
    await ensureCoverageBackfills(ctx.db, ctx.bookRef, { through: S[7], now: closeNowOf(S[7]), ...vendorAnswering(fetch) });
    expect(fetch.mock.calls).toEqual([['AAPL', { from: '2026-11-17', to: S[7] }]]);
    expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ from: '2026-11-17', to: S[7], failed: false });
  });

  it('FR-10: a FAILED entry\'s own rows are part of the union, but the session is uncovered — a reverse split it lists is held, not applied, and the first covered close applies it once', async () => {
    const ctx = await setup();
    const shares = sharesOf(ctx);
    await storeCloseSnapshot(ctx.db, S[1], quotes({ AAPL: 289.34 }));
    plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true, corporateActions: [reverseSplit(0.8, S[1])] } });
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]), ...vendorAnswering(noFetch) });
    recon(ctx);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(ideaOf(ctx)[f].holdings.AAPL.shares, f).toBe(shares);
      expect(held(ideaOf(ctx)[f]), f).toEqual([`reverse_split_AAPL_${S[1]}`]);
    }
    expect(rowOf(ctx, S[1]).marks.AAPL.quality).toBe('ca_coverage_missing');
    await closeDay(ctx, S[2], { AAPL: 289.34 });
    for (const f of ['ledger', 'comparisonLedger']) expect(sharesOf(ctx, f), f).toBe(r6(shares * 0.8));
    expect(rowOf(ctx, S[2]).marks.AAPL).toMatchObject({ mark: 289.34, quality: 'vendor_time' });
  });
});

// ── The review's fix round (§5): F-5's split ruling (lenses B, D) and the endpoint's re-dates (lens D) ─────────────────

describe('the review\'s fix round — the founder\'s split, the move it covers, and the endpoint\'s re-dates', () => {
  const Q = { AAPL: { price: 100, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: 500 };
  const closeQ = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, { ...Q, ...over }); recon(ctx); return out; };
  const UID = 'owner-1';
  const SUSP = `suspected_split_AAPL_${S[1]}`;
  const paid = (ledger, type = 'cash_dividend') => ledger.corporateActionReceipts.filter((r) => r.type === type && r.applied === true);
  let prevEnv;
  beforeEach(() => { prevEnv = process.env.MANDATE_FOUNDER_UIDS; process.env.MANDATE_FOUNDER_UIDS = UID; });
  afterEach(() => { if (prevEnv === undefined) delete process.env.MANDATE_FOUNDER_UIDS; else process.env.MANDATE_FOUNDER_UIDS = prevEnv; });
  const resolve = (ctx, body, { requestKey = 'rule-1', nowIso = etIso(S[3], 8, 0) } = {}) => runFounderAction(ctx.db, { uid: UID, body: { action: 'resolve_hold', requestKey, ideaId: ctx.ideaId, ...body }, nowIso });
  async function entered() {
    const { db, bookId, bookRef } = await seedBook();
    const e = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: Q });
    const ctx = { db, bookId, bookRef, ideaId: e.ideaId };
    await closeQ(ctx, S[0]);
    return ctx;
  }
  /** A ledger planted for a pure row: AAPL, 100 shares, a record of a ×0.25 move first seen S[2] (since S[0]). */
  const recordLedger = (receipts = []) => ({
    kind: 'idea', reservedCapitalUsd: 10000, cash: 0, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, saleReceipts: [], declinedActionIds: [],
    appliedActionIds: receipts.map((r) => r.actionId), corporateActionReceipts: receipts,
    holdings: { AAPL: { shares: 100, costBasisTotal: 10000, avgCost: 100, lastMark: 100, openedAt: S[0], basisSuspicion: { symbol: 'AAPL', suspectedOn: S[2], since: S[0], ratio: 0.25, shape: { kind: 'split', n: 4 }, frozenMark: 100, resolvedBy: null, resolvedAt: null } } },
  });
  const splitReceipt = (date, appliedOn) => ({ actionId: `split_AAPL_${date}`, type: 'split', ticker: 'AAPL', effectiveDate: date, ratio: 2, applied: true, appliedOn });
  const plan = (ledger, ratio) => planHoldRuling({ ideaId: 'i', founderRulings: [], ledger, comparisonLedger: null, spyLedger: null }, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[2]}`, decision: 'split', ratio }, { uid: UID, requestKey: 'k', nowIso: etIso(S[4], 8, 0) });

  it('D5 (pure): a founder split must be the move the record STILL stands for — rows applied since inside its gap are counted; with none left (T1a-2a Q-V) it is refused, `price_move` being the ruling', () => {
    expect(plan(recordLedger(), 4).ruling).toMatchObject({ ratio: 4, actionId: `split_AAPL_${S[2]}`, ledgers: ['ledger'] });
    // A 2-for-1 dated inside the gap, applied at a close after the record was raised: ×2 is left.
    expect(plan(recordLedger([splitReceipt(S[1], S[3])]), 4)).toEqual({ error: 'ruling_does_not_match_record', status: 422 });
    expect(plan(recordLedger([splitReceipt(S[1], S[3])]), 2).ruling).toMatchObject({ ratio: 2 });
    // One applied at the raise's own close is already in the recorded move.
    expect(plan(recordLedger([splitReceipt(S[1], S[2])]), 4).ruling).toMatchObject({ ratio: 4 });
    // Two (Q-V): the count is right; a split on top would corrupt it.
    expect(plan(recordLedger([splitReceipt(S[1], S[3]), { ...splitReceipt(S[2], S[3]) }]), 4)).toEqual({ error: 'no_residual_move', status: 422 });
  });

  it('D6: the feed applied a 2-for-1 on the move\'s own session but the move was ×4 — the founder\'s 2-for-1 for the rest takes its OWN id (the record\'s split id is the feed\'s), applies once with a founder receipt, and the held dividend is paid on 799.760068 shares, $799.76', async () => {
    const ctx = await entered();
    await closeQ(ctx, S[1], { AAPL: { price: 25, corporateActions: [split(2, S[1])] } }); // ×2 listed; the price says ×4
    const rec = `suspected_split_AAPL_${S[1]}`;
    expect(ideaOf(ctx).ledger.holdings.AAPL).toMatchObject({ shares: 399.880034, basisSuspicion: { suspectedOn: S[1], ratio: 0.5 } });
    await closeQ(ctx, S[2], { AAPL: { price: 25, corporateActions: [dividend(1, S[2])] } });
    const res = await resolve(ctx, { kind: 'suspicion', recordId: rec, decision: 'split', ratio: 2 });
    expect(res.status).toBe(200);
    expect(ideaOf(ctx).founderRulings[0]).toMatchObject({ actionId: `founder_split_AAPL_${S[1]}`, ledgers: ['ledger', 'comparisonLedger'] });
    await closeQ(ctx, S[3], { AAPL: 25 });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(799.760068);
      expect(l.holdings.AAPL.basisSuspicion, f).toBeUndefined();
      expect(l.corporateActionReceipts.find((r) => r.actionId === `founder_split_AAPL_${S[1]}`), f).toMatchObject({ applied: true, ratio: 2, founderRuling: expect.objectContaining({ requestKey: 'rule-1' }), explainedSuspicion: { id: rec } });
      expect(paid(l).map((r) => [r.actionId, r.incomeUsd]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, 799.76]]);
    }
    expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(799.760068);
    expect(ideaOf(ctx).founderRulings[0]).toMatchObject({ appliedOn: S[3], outcome: 'applied' });
  });

  it('B2: the feed\'s row for the move, dated inside the gap, arrives at the close the founder\'s split is applied — the row explains the record first, the founder split is MOOT (applied nowhere): one 2-for-1, and the ruling is closed with an alert', async () => {
    const ctx = await entered();
    await storeCloseSnapshot(ctx.db, S[1], { ...Q, AAPL: { price: 50, marketCap: 3e12 } });
    plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true } }); // S[1] uncovered: no record yet
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]) });
    recon(ctx);
    await closeQ(ctx, S[2], { AAPL: 50 }); // the record: first seen S[2], since S[0]
    const rec = `suspected_split_AAPL_${S[2]}`;
    expect(ideaOf(ctx).ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2], since: S[0] });
    expect((await resolve(ctx, { kind: 'suspicion', recordId: rec, decision: 'split', ratio: 2 })).status).toBe(200);
    const out = await closeQ(ctx, S[3], { AAPL: { price: 50, corporateActions: [split(2, S[1])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(399.880034); // once
      expect(l.corporateActionReceipts.filter((r) => r.applied && r.type === 'split').map((r) => r.actionId), f).toEqual([`split_AAPL_${S[1]}`]);
      expect(l.holdings.AAPL.basisSuspicion, f).toBeUndefined();
      expect(l.holdings.AAPL.basisSuspicionHistory, f).toEqual([expect.objectContaining({ id: rec, explainedBy: expect.objectContaining({ actionId: `split_AAPL_${S[1]}` }) })]);
    }
    expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(399.880034);
    expect(ideaOf(ctx).founderRulings[0]).toMatchObject({ appliedOn: S[3], outcome: 'moot' });
    expect(withoutWindowAlerts(out.alerts).filter((a) => a.startsWith('PRACTICE_FIELD_HOLD_RULING_MOOT'))).toHaveLength(1);
  });

  it('D5 at the close (pure): a founder split is applied only for the move still left — after a 2-for-1 applied inside the gap a ×4 is moot, a ×2 is applied and retires the record (the founder\'s account of the rest), and the cash behind it is paid at the same close', () => {
    const ledger = recordLedger([splitReceipt(S[1], S[3])]);
    ledger.holdings.AAPL = { ...ledger.holdings.AAPL, shares: 200, costBasisTotal: 10000, avgCost: 50, lastMark: 50 };
    const id = `suspected_split_AAPL_${S[2]}`;
    const action = { type: 'split', ticker: 'AAPL', ratio: 4, effectiveDate: S[2], actionId: `split_AAPL_${S[2]}`, source: 'founder_ruling', founderRuling: { requestKey: 'k', kind: 'suspicion', recordId: id, decision: 'split', by: UID, at: 'x' } };
    const four = applyLedgerActions(ledger, { AAPL: [action] }, { date: S[4], ruledIds: new Set([action.actionId]) });
    expect(four.ledger.holdings.AAPL.shares).toBe(200);
    expect(four.ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2] });
    expect(four.founderSkips).toEqual([expect.objectContaining({ reason: 'ratio_not_residual' })]);
    const two = applyLedgerActions(ledger, { AAPL: [{ ...action, ratio: 2 }, dividend(0.5, S[3])] }, { date: S[4], ruledIds: new Set([action.actionId]) });
    expect(two.ledger.holdings.AAPL.shares).toBe(400);
    expect(two.ledger.holdings.AAPL.basisSuspicion).toBeUndefined();
    expect(two.ledger.holdings.AAPL.basisSuspicionHistory).toEqual([expect.objectContaining({ id, explainedBy: expect.objectContaining({ actionId: `split_AAPL_${S[2]}`, ratio: 2 }), ruling: expect.objectContaining({ requestKey: 'k' }) })]);
    expect(two.applied.map((a) => a.actionId)).toEqual([`split_AAPL_${S[2]}`, `cash_dividend_AAPL_${S[3]}`]);
    expect(two.ledger.dividendsUsd).toBe(200); // 400 × $0.50, at the same close
  });

  it('A1: the last price seen while a record stands is taken only at a close whose data covers the symbol — an uncovered close\'s price is never what a ruling relies on', async () => {
    const ctx = await entered();
    await closeQ(ctx, S[1], { AAPL: 50 }); // the record
    await storeCloseSnapshot(ctx.db, S[2], { ...Q, AAPL: { price: 25, marketCap: 3e12 } });
    plantDaily(ctx.db, S[2], { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true } });
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[2], now: closeNowOf(S[2]) });
    recon(ctx);
    for (const f of ['ledger', 'comparisonLedger']) expect(ideaOf(ctx)[f].holdings.AAPL.basisSuspicion.lastSeen, f).toMatchObject({ session: S[1], price: 50 });
    await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'price_move' });
    await closeQ(ctx, S[3], { AAPL: 25 });
    // The second halving is a new record — dated at the uncovered close that OBSERVED it (S[2]; the fix round's
    // AR1-RF-04 keeps a transition seen there, flagged), frozen at the covered price before it. The ruling's reference
    // stays a covered close's price (lastSeen above).
    for (const f of ['ledger', 'comparisonLedger']) expect(ideaOf(ctx)[f].holdings.AAPL.basisSuspicion, f).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 0.5, frozenMark: 50 });
  });

  it('C-6\'s own case: a SHARE-BASIS conflict the feed has dropped (a 2-for-1 and a 3-for-1 listed for one day, then neither) is ruled by payload — the 2-for-1 is applied ONCE at the next close on the idea, its comparison and the book, with a founder receipt; the dividend it held is paid on the adjusted count and the mark is fresh', async () => {
    const ctx = await entered();
    const conflict = `split_AAPL_${S[1]}`;
    await closeQ(ctx, S[1], { AAPL: { price: 50, corporateActions: [split(2, S[1]), split(3, S[1])] } });
    await closeQ(ctx, S[2], { AAPL: { price: 50, corporateActions: [dividend(1, S[2])] } }); // the feed drops the conflict
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.corporateActionReceipts.filter((r) => r.reason === 'conflicting_action').map((r) => r.actionId), f).toEqual([conflict]);
      expect(l.holdings.AAPL.shares, f).toBe(199.940017);
      expect(l.dividendsUsd, f).toBe(0);
    }
    expect((await resolve(ctx, { kind: 'conflict', recordId: conflict, decision: 'payload', payload: { ratio: 2 } })).status).toBe(200);
    await closeQ(ctx, S[3], { AAPL: 50 });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(399.880034);
      expect(l.corporateActionReceipts.filter((r) => r.actionId === conflict && r.applied), f).toEqual([expect.objectContaining({ ratio: 2, founderRuling: expect.objectContaining({ requestKey: 'rule-1', decision: 'payload' }) })]);
      expect(paid(l).map((r) => [r.actionId, r.incomeUsd]), f).toEqual([[`cash_dividend_AAPL_${S[2]}`, 399.88]]);
      expect(l.holdings.AAPL.basisSuspicion, f).toBeUndefined();
    }
    expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(399.880034);
    expect(rowOf(ctx, S[3]).marks.AAPL).toMatchObject({ mark: 50, quality: 'vendor_time' });
    expect(ideaOf(ctx).founderRulings[0].appliedOn).toBe(S[3]);
    // Listed again later, the conflict pays nothing more.
    await closeQ(ctx, S[4], { AAPL: { price: 50, corporateActions: [split(2, S[1]), split(3, S[1])] } });
    expect(ideaOf(ctx).ledger.holdings.AAPL.shares).toBe(399.880034);
  });

  it('NF-1: a founder split found MOOT at the close (a row inside the gap applied first: the record now stands for another move) explains nothing — the dividend dated in the gap stays held while the record stands; a ruling for the move left then retires it and pays it', async () => {
    const ctx = await entered();
    await storeCloseSnapshot(ctx.db, S[1], { ...Q, AAPL: { price: 50, marketCap: 3e12 } });
    plantDaily(ctx.db, S[1], { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true } }); // S[1] uncovered: no record yet
    await closeIdeaBook(ctx.db, ctx.bookRef, { date: S[1], now: closeNowOf(S[1]) });
    recon(ctx);
    await closeQ(ctx, S[2], { AAPL: { price: 25, marketCap: 3e12, corporateActions: [dividend(1, S[1])] } }); // a ×0.25 record; the dividend held
    const rec = `suspected_split_AAPL_${S[2]}`;
    expect(ideaOf(ctx).ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2], since: S[0], ratio: 0.25 });
    expect((await resolve(ctx, { kind: 'suspicion', recordId: rec, decision: 'split', ratio: 4 })).status).toBe(200);
    // S[3]: the feed lists a 2-for-1 dated S[1] — applied first; ×2 is left, so the founder's ×4 is moot.
    const out = await closeQ(ctx, S[3], { AAPL: { price: 25, marketCap: 3e12, corporateActions: [split(2, S[1])] } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(399.880034);
      expect(l.holdings.AAPL.basisSuspicion, f).toMatchObject({ suspectedOn: S[2], ratio: 0.25 });
      expect(l.holdings.AAPL.heldActions.map((r) => r.actionId), f).toEqual([`cash_dividend_AAPL_${S[1]}`]);
      expect(paid(l), f).toEqual([]);
    }
    expect(ideaOf(ctx).founderRulings[0]).toMatchObject({ appliedOn: S[3], outcome: 'moot' });
    expect(withoutWindowAlerts(out.alerts).filter((a) => a.startsWith('PRACTICE_FIELD_HOLD_RULING_MOOT'))).toHaveLength(1);
    // A ruling for the move left (×2): applied once, it retires the record; the dividend — dated S[1], before the founder's
    // split (dated the record's session) in the close's date order — waits that close and is paid at the next, on the
    // count it had on its ex-date (F-7).
    expect((await resolve(ctx, { kind: 'suspicion', recordId: rec, decision: 'split', ratio: 2 }, { requestKey: 'rule-2', nowIso: etIso(S[4], 8, 0) })).status).toBe(200);
    await closeQ(ctx, S[4], { AAPL: { price: 25, marketCap: 3e12 } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(l.holdings.AAPL.shares, f).toBe(799.760068);
      expect(l.holdings.AAPL.basisSuspicion, f).toBeUndefined();
    }
    await closeQ(ctx, S[5], { AAPL: { price: 25, marketCap: 3e12 } });
    for (const f of ['ledger', 'comparisonLedger']) {
      const l = ideaOf(ctx)[f];
      expect(paid(l).map((r) => [r.actionId, r.incomeUsd, r.entitledShares]), f).toEqual([[`cash_dividend_AAPL_${S[1]}`, 399.88, 399.880034]]);
      expect(l.holdings.AAPL.shares, f).toBe(799.760068);
    }
    expect(bookOf(ctx).portfolio.positions.AAPL.shares).toBe(799.760068);
  });

  it('B5 (pure): a founder split reaches only a ledger that carries its record — one without it applies nothing and reports it moot', () => {
    const ledger = { ...recordLedger(), holdings: { AAPL: { ...recordLedger().holdings.AAPL, basisSuspicion: undefined } } };
    delete ledger.holdings.AAPL.basisSuspicion;
    const action = { type: 'split', ticker: 'AAPL', ratio: 4, effectiveDate: S[2], actionId: `split_AAPL_${S[2]}`, source: 'founder_ruling', founderRuling: { requestKey: 'k', kind: 'suspicion', recordId: `suspected_split_AAPL_${S[2]}`, decision: 'split', by: UID, at: 'x' } };
    const out = applyLedgerActions(ledger, { AAPL: [action] }, { date: S[3], ruledIds: new Set([action.actionId]) });
    expect(out.ledger.holdings.AAPL.shares).toBe(100);
    expect(out.applied).toEqual([]);
    expect(out.founderSkips).toEqual([expect.objectContaining({ actionId: action.actionId, reason: 'record_not_open' })]);
    // …and on the ledger that carries it, it applies.
    const carried = applyLedgerActions(recordLedger(), { AAPL: [action] }, { date: S[3], ruledIds: new Set([action.actionId]) });
    expect(carried.ledger.holdings.AAPL.shares).toBe(400);
    expect(carried.founderSkips).toEqual([]);
  });

  it('B7 / F-8: the founder\'s split explains the record in the dry run and a further move takes its place (T2A-E01) — the retired record names the ruling, and the split\'s receipt names the record', async () => {
    const ctx = await entered();
    await closeQ(ctx, S[1], { AAPL: 50 });
    await closeQ(ctx, S[2], { AAPL: 50 });
    expect((await resolve(ctx, { kind: 'suspicion', recordId: SUSP, decision: 'split', ratio: 2 })).status).toBe(200);
    await closeQ(ctx, S[3], { AAPL: 25 });
    for (const f of ['ledger', 'comparisonLedger']) {
      const h = ideaOf(ctx)[f].holdings.AAPL;
      expect(h.shares, f).toBe(399.880034);
      expect(h.basisSuspicion, f).toMatchObject({ suspectedOn: S[3], ratio: 0.5 });
      expect(h.basisSuspicionHistory, f).toEqual([expect.objectContaining({ id: SUSP, closedOn: S[3], resolvedBy: UID, resolvedAt: etIso(S[3], 8, 0), ruling: expect.objectContaining({ requestKey: 'rule-1' }), replacedBy: `suspected_split_AAPL_${S[3]}` })]);
      expect(ideaOf(ctx)[f].corporateActionReceipts.find((r) => r.actionId === `split_AAPL_${S[1]}`), f).toMatchObject({ founderRuling: expect.objectContaining({ requestKey: 'rule-1' }), explainedSuspicion: { id: SUSP } });
    }
  });

  it('N1 (pure): a coverage-gap `row` ruling takes a recorded backfill row dated INSIDE the gap only — after its last session it is refused', () => {
    const idea = { ideaId: 'i', founderRulings: [], ledger: null, comparisonLedger: null, spyLedger: null, caCoverageGaps: { AAPL: { since: S[0], lastSession: S[3], sessions: 3 } } };
    const backfill = { symbol: 'AAPL', actions: [dividend(1, S[2]), dividend(1, S[5])] };
    const rule = (actionId) => planHoldRuling(idea, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId }, { uid: UID, requestKey: 'k', nowIso: etIso(S[4], 8, 0), backfill });
    expect(rule(`cash_dividend_AAPL_${S[2]}`).ruling).toMatchObject({ row: { effectiveDate: S[2] } });
    expect(rule(`cash_dividend_AAPL_${S[5]}`)).toEqual({ error: 'row_not_recorded', status: 422 });
  });

  it('D2 / D3 / D4 (pure): at the endpoint a SHARE-BASIS possible re-date is an unsettled action (the value is in doubt by it) and is named; a dividend\'s re-date is named, with the dividend not paid — and (Amendment F rev 1) counted too: it waits for the founder, so the value is in doubt by it', () => {
    const ledger = {
      kind: 'spy', reservedCapitalUsd: 5000, cash: 0, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, saleReceipts: [], declinedActionIds: [], appliedActionIds: [],
      holdings: { SPY: { shares: 10, costBasisTotal: 5000, avgCost: 500, lastMark: 500, openedAt: S[0], exitCostTier: 'tier1' } },
      corporateActionReceipts: [
        { actionId: `split_SPY_${S[2]}`, type: 'split', ticker: 'SPY', effectiveDate: S[2], ratio: 2, amount: null, applied: false, reason: 'possible_redate', redateOf: `split_SPY_${S[1]}`, seenOn: S[2] },
        { actionId: `cash_dividend_SPY_${S[3]}`, type: 'cash_dividend', ticker: 'SPY', effectiveDate: S[3], ratio: null, amount: 1.5, applied: false, reason: 'possible_redate', redateOf: `cash_dividend_SPY_${S[2]}`, seenOn: S[3] },
      ],
    };
    const v = valueLedger(ledger, closeSnapshot(S[4], { SPY: 500 }), { sessionDate: S[4] });
    expect(ledgerEndpoint(ledger, v).unsettledActions).toEqual([`split_SPY_${S[2]}`, `cash_dividend_SPY_${S[3]}`]);
    expect(ledgerDoubts(ledger)).toEqual([{
      symbol: 'SPY',
      reasons: [
        { kind: 'possible_redate', actionId: `split_SPY_${S[2]}`, type: 'split', redateOf: `split_SPY_${S[1]}` },
        { kind: 'possible_redate', actionId: `cash_dividend_SPY_${S[3]}`, type: 'cash_dividend', redateOf: `cash_dividend_SPY_${S[2]}` },
      ],
      heldDividends: [{ actionId: `cash_dividend_SPY_${S[3]}`, amount: 1.5, effectiveDate: S[3], heldOn: S[3], possibleRedateOf: `cash_dividend_SPY_${S[2]}` }],
    }]);
  });
});

// ── The review's fix round (§5): lens A — the catch-up's backfill, a bounded backfill, F-2 on the entry session ─────────

describe('the review\'s fix round — coverage (lens A)', () => {
  /** S[1]…S[6] stored, AAPL's fetch failed on each, none of them closed by the book (a missed-close outage). */
  async function missedOutage() {
    const ctx = await setup();
    for (let i = 1; i <= 6; i += 1) {
      await storeCloseSnapshot(ctx.db, S[i], quotes());
      plantDaily(ctx.db, S[i], { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true } });
    }
    return ctx;
  }

  it('A2: the WINDOW\'s catch-up — usually the first close after an outage — backfills first: the gap sessions close from the backfill, in order, and a dividend dated in the gap is paid at its own session\'s close', async () => {
    const ctx = await missedOutage();
    const shares = sharesOf(ctx);
    const fetch = vi.fn(async (sym) => ({ actions: sym === 'AAPL' ? [dividend(0.75, S[2])] : [], calls: 2, failed: false }));
    const out = await catchUpIdeaBook(ctx.db, ctx.bookRef, { before: S[7], now: new Date(`${S[7]}T15:00:00Z`), ...vendorAnswering(fetch) });
    recon(ctx);
    expect(out.caughtUp.map((c) => c.date)).toEqual([S[1], S[2], S[3], S[4], S[5], S[6]]);
    expect(fetch).toHaveBeenCalledWith('AAPL', { from: '2026-11-17', to: S[7] });
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(ideaOf(ctx)[f].corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[2]}`), f).toMatchObject({ applied: true, appliedOn: S[2], incomeUsd: Math.round(shares * 0.75 * 100) / 100 });
    }
    for (const d of [S[1], S[2], S[6]]) expect(rowOf(ctx, d).marks.AAPL.quality, d).toBe('vendor_time');
    expect(ideaOf(ctx).caCoveredThrough.AAPL).toBe(S[6]);
  });

  it('NF-2: a book that has NEVER closed backfills at its first catch-up too (it closes from its first entry session)', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const e = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'] }), quotes: quotes(), date: S[0] });
    for (let i = 0; i <= 6; i += 1) {
      await storeCloseSnapshot(db, S[i], quotes());
      if (i >= 1) plantDaily(db, S[i], { symbol: 'AAPL', entry: { sector: null, caFetchFailed: true } });
    }
    expect(getBook(db, bookId).execState?.lastCloseKey ?? null).toBeNull();
    const fetch = vi.fn(async () => ({ actions: [], calls: 2, failed: false }));
    const out = await catchUpIdeaBook(db, bookRef, { before: S[7], now: new Date(`${S[7]}T15:00:00Z`), ...vendorAnswering(fetch), lastCloseKey: null });
    expect(out.caughtUp.map((c) => c.date)).toEqual([S[0], S[1], S[2], S[3], S[4], S[5], S[6]]);
    expect(fetch).toHaveBeenCalledWith('AAPL', { from: '2026-11-17', to: S[7] });
    expect(getIdea(db, bookId, e.ideaId).caCoveredThrough.AAPL).toBe(S[6]);
  });

  it('N2: the backfill is bounded — a fetch with no answer in its time is a failed one (the doubt stays, alerted), and once the pass\'s budget is spent no further symbol is asked', async () => {
    const ctx = await missedOutage();
    await storeCloseSnapshot(ctx.db, S[7], quotes());
    const hung = vi.fn(() => new Promise(() => {}));
    const res = await ensureCoverageBackfills(ctx.db, ctx.bookRef, { through: S[7], now: closeNowOf(S[7]), ...vendorAnswering(hung), fetchTimeoutMs: 20 });
    expect(res.failed).toBe(res.needed);
    expect(res.fetched).toBe(0);
    expect(res.alerts.some((a) => a.includes('no answer in 20 ms'))).toBe(true);
    expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ failed: true });
    const asked = vi.fn(async () => ({ actions: [], calls: 2, failed: false }));
    const spent = await ensureCoverageBackfills(ctx.db, ctx.bookRef, { through: S[7], now: closeNowOf(S[7]), ...vendorAnswering(asked), passBudgetMs: 0 });
    expect(asked).not.toHaveBeenCalled();
    expect(spent.alerts.some((a) => a.includes('budget was spent'))).toBe(true);
  });

  it('N4: an answer whose rows are not a list is a FAILED backfill, whatever it says — the doubt stays', async () => {
    const ctx = await missedOutage();
    await storeCloseSnapshot(ctx.db, S[7], quotes());
    await ensureCoverageBackfills(ctx.db, ctx.bookRef, { through: S[7], now: closeNowOf(S[7]), ...vendorAnswering(async () => ({ actions: 'garbage', calls: 2, failed: false })) });
    expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ failed: true, actions: [] });
  });

  it('A4 (pure): a snapshot naming another session\'s layer covers nothing — on the entry session too, where the data already covers the session', () => {
    const daily = { date: S[0], caWindow: { from: '2026-11-11', to: '2026-11-18' }, symbols: { AAPL: { sector: null } } };
    expect(sessionCoverage({ parseReport: reportOf(S[0]), symbol: 'AAPL', session: S[0], coveredThrough: S[0], daily, dailyRefOk: true })).toMatchObject({ covered: true });
    expect(sessionCoverage({ parseReport: reportOf(S[0]), symbol: 'AAPL', session: S[0], coveredThrough: S[0], daily, dailyRefOk: false })).toMatchObject({ covered: false, reason: 'snapshot_daily_mismatch' });
  });

  it('the vendor is never reached from a row (lens A N3): the key is empty, so a backfill the rows did not stub fails at once', async () => {
    expect(process.env.EODHD_API_KEY).toBe('');
    await expect(fetchCorporateActionsEODHD('AAPL', { from: S[0], to: S[1] })).rejects.toThrow(/not configured/);
  });
});
