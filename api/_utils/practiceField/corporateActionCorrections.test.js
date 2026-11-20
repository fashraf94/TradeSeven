// api/_utils/practiceField/corporateActionCorrections.test.js
//
// Practice Field T1a-2b-4 — LATE AND CORRECTED DATA, AND PARSE COVERAGE (dark). Astra's four pre-switch items from her
// T1a-2b-3 review (docs/audits/20261118_ASTRA_REVIEW_T1A2B3.md), each through the REAL close, sales, founder action and
// daily builder against the fake store, with parsed vendor rows:
//   T2D-03  a dividend first listed after the idea's line sale, dated while it held the stock, is paid once on the
//           ex-date count — with or without a comparison holding the symbol, and after the idea's result;
//   T2D-04  a split listed late, dated before a dividend already paid, corrects that payment: one linked late_basis
//           adjustment on every affected ledger and the book; both arrival orders end with the same money;
//   T2D-05  a vendor correction under an id already settled waits for the founder, who may keep the original or choose
//           the correction: one ruled_correction adjustment (a split's count corrected, the dividends since recomputed);
//   T2D-12  a row the parser rejects, a malformed envelope or a missing parse report is a day of doubt.
// Every adjustment is checked for its record: its evidence document (create-once, content-hashed, owner-readable path),
// its kind, its amount and its posting — and that a re-run of the close posts nothing twice.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { closeIdeaBook } from './close.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';
import { ensureDailySnapshot, fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { roundUsd, roundShares } from '../mandateRounding.js';
import { verifyPacket } from './evidence.js';
import { ADJUSTMENT_KIND, ADJUSTMENT_POSTED_TO, adjustmentDocIdOf, countOnExDate, shareBasisChain } from './adjustments.js';
import { makeParseReportingFetcher, sessionOfWindow, parseEntryVerdict } from './caParseReport.js';
import { dailyCoverageOf } from './dailyCoverage.js';
import { practiceFieldBuildInputs } from './sweep.js';
import { openRulingRevisions } from './ledger.js';
import { nextSessionDate } from './windows.js';
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, getRow, closeOn, closeNowOf, storeCloseSnapshot, windowAt, founderRules,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, storeParseReport, omitParseReport, CLEAN_PARSE_ENTRY, cleanParseEntryFor, makeMandateFakeDb, etIso,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16'];
while (S.length < 14) S.push(nextSessionDate(S.at(-1)));
const SH = 99.970008; // $10,000 of AAPL at $100 after the entry's costs
const div = (i, v = 1, s = 'AAPL') => parseDividendsPayload(s, [{ date: S[i], unadjustedValue: v }]).actions[0];
const spl = (i, r, s = 'AAPL') => parseSplitsPayload(s, [{ date: S[i], split: r }]).actions[0];
const q = (p = 100, a = [], extra = {}) => ({
  AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500, ...(extra.spy ? { corporateActions: extra.spy } : {}) }, XLK: { price: 200 },
});
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];

async function start({ names = ['AAPL', 'MSFT'], capitalUsd = 20000, ...opts } = {}) {
  const ctx = await seedBook();
  const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names, capitalUsd, ...opts }), quotes: q(), date: S[0] });
  if (a.entry.outcome !== 'entered') throw new Error(JSON.stringify(a.entry));
  return { ...ctx, ideaId: a.ideaId };
}
const ideaOf = (c) => getIdea(c.db, c.bookId, c.ideaId);
const bookOf = (c) => getBook(c.db, c.bookId);
const rowOf = (c, i) => getRow(c.db, c.bookId, c.ideaId, S[i]);
const recon = (c) => { const b = bookOf(c); return assertReconciled(b, b.openIdeaIds.map((id) => getIdea(c.db, c.bookId, id))); };
const close = async (c, i, p = 100, a = [], extra = {}) => { const out = await closeOn(c.db, c.bookId, S[i], q(p, a, extra)); recon(c); return out; };
/** I-5: the book's cursor put back one session and the close of S[i] run again — nothing more moves. */
async function rerun(c, i) {
  const money = () => JSON.stringify([LEDGERS.map((f) => [ideaOf(c)[f]?.cash, ideaOf(c)[f]?.dividendsUsd, ideaOf(c)[f]?.adjustments?.length ?? 0]), bookOf(c).portfolio.cash, bookOf(c).treasury.unreservedCash]);
  const before = money();
  const book = bookOf(c);
  const e = c.db._store.get(`mandates/${c.bookId}`);
  e.data = { ...book, execState: { ...book.execState, lastCloseKey: S[i - 1] } };
  e.version += 1;
  for (const path of [...c.db._store.keys()]) if (path.startsWith(`mandates/${c.bookId}/windows/${S[i]}`)) c.db._store.delete(path);
  await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
  expect(money(), `I-5 at ${S[i]}`).toBe(before);
}
/** The line of a holding, and a price a hair below it. */
const lineLevel = (c, sym = 'AAPL') => ideaOf(c).lines.find((l) => l.symbol === sym).level;
const belowLine = (c, sym = 'AAPL') => roundUsd(lineLevel(c, sym) - 0.5);
/** Sell AAPL on its line: S[i]'s close shows it below, S[i+1]'s first window sells it. */
async function sellOnLine(c, i) {
  const p = belowLine(c);
  await close(c, i, p);
  expect(ideaOf(c).ledger.holdings.AAPL.exitPending).toBeTruthy();
  const out = await windowAt(c.db, c.bookId, { date: S[i + 1], slot: 'open30', quotes: q(p) });
  expect(out.sales?.[0]?.sold ?? out.sales, JSON.stringify(out.sales)).toBeTruthy();
  return p;
}
const adjustmentsOf = (c, f = 'ledger') => ideaOf(c)[f]?.adjustments || [];
const evidenceOf = (c, a) => c.db._get(`mandates/${c.bookId}/ideas/${c.ideaId}/evidence/${adjustmentDocIdOf(a.id)}`);

let restoreMode;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  takeSeededDbs();
  vi.stubEnv('EODHD_API_KEY', '');
  vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
});
afterEach(() => {
  restoreMode();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]);
    expect(bannedWordsOnResults(db)).toEqual([]);
  }
});

describe('the holding history and the ex-date count (pure)', () => {
  it('the chain replays the recorded counts exactly, a correction replaces its ratio, and the count on an ex-date is C-16\'s', () => {
    const ledger = {
      holdings: { AAPL: { shares: 124.96251 } },
      corporateActionReceipts: [
        { actionId: 'split_AAPL_2026-11-18', type: 'split', ticker: 'AAPL', effectiveDate: '2026-11-18', ratio: 1.25, applied: true, sharesBefore: SH, sharesAfter: 124.96251 },
      ],
      adjustments: [],
    };
    expect(shareBasisChain(ledger, 'AAPL').end).toBe(124.96251);
    expect(countOnExDate(ledger, 'AAPL', '2026-11-17', { held: ledger.holdings.AAPL })).toMatchObject({ count: SH, from: 'split_AAPL_2026-11-18' });
    expect(countOnExDate(ledger, 'AAPL', '2026-11-18', { held: ledger.holdings.AAPL })).toMatchObject({ count: 124.96251, from: 'holding' });
    const corrected = { ...ledger, adjustments: [{ kind: ADJUSTMENT_KIND.RULED_CORRECTION, type: 'split', ticker: 'AAPL', actionId: 'split_AAPL_2026-11-18', ratio: 1.5, held: false }] };
    expect(shareBasisChain(corrected, 'AAPL').end).toBe(roundShares(SH * 1.5));
  });
});

describe('T2D-03 — a dividend first listed after the idea\'s line sale, dated while it held the stock', () => {
  it('Astra\'s case: held Nov 17, sold Nov 18, a $1 dividend listed Nov 19 dated Nov 17 — the idea gets $99.97 and the book cash rises $99.97, once; the same-stock comparison is paid its own', async () => {
    const c = await start();
    await close(c, 0);
    await sellOnLine(c, 1); // S[1] = Nov 17 below the line; sold at S[2] = Nov 18's first window
    expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
    await close(c, 2, belowLine(c));
    const bookCashBefore = bookOf(c).portfolio.cash;
    const cmpBefore = ideaOf(c).comparisonLedger.dividendsUsd;
    await close(c, 3, belowLine(c), [div(1, 1)]); // Nov 19 lists the $1 dated Nov 17
    const idea = ideaOf(c);
    const [adj] = adjustmentsOf(c);
    expect(adjustmentsOf(c)).toHaveLength(1);
    expect(adj).toMatchObject({
      kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, actionId: `cash_dividend_AAPL_${S[1]}`, ledger: 'idea', amountUsd: 99.97, entitledShares: SH,
      postedOn: S[3], postedTo: ADJUSTMENT_POSTED_TO.LEDGER, derivation: expect.objectContaining({ closedOn: S[2], openedAt: S[0] }),
    });
    expect(idea.ledger.dividendsUsd).toBe(99.97);
    expect(roundUsd(bookOf(c).portfolio.cash - bookCashBefore)).toBe(99.97);
    // The comparison still holds AAPL: it is paid its own dividend by the ordinary path, not by an adjustment.
    expect(roundUsd(idea.comparisonLedger.dividendsUsd - cmpBefore)).toBe(99.97);
    expect(adjustmentsOf(c, 'comparisonLedger')).toEqual([]);
    // Its record: one create-once evidence document, content-hashed, under the idea's evidence (owner-readable).
    const doc = evidenceOf(c, adj);
    expect(doc).toMatchObject({ packet: 'adjustment', kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, amountUsd: 99.97, field: 'ledger', ideaId: c.ideaId });
    expect(verifyPacket(doc)).toBe(true);
    // Once: a re-run, and the next close with the row still listed, post nothing more.
    await rerun(c, 3);
    await close(c, 4, belowLine(c), [div(1, 1)]);
    expect(adjustmentsOf(c)).toHaveLength(1);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
  });

  it('the comparison does not hold the symbol (a sector fund): only the idea is paid, once', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    const before = bookOf(c).portfolio.cash;
    await close(c, 3, belowLine(c), [div(1, 1)]);
    expect(adjustmentsOf(c)).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, amountUsd: 99.97 })]);
    expect(adjustmentsOf(c, 'comparisonLedger')).toEqual([]);
    expect(ideaOf(c).comparisonLedger.dividendsUsd).toBe(0);
    expect(roundUsd(bookOf(c).portfolio.cash - before)).toBe(99.97);
    await rerun(c, 3);
  });

  it('a dividend dated AFTER the sale is not owed; one dated on the day it was opened is not owed either', async () => {
    const c = await start();
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [div(3, 1), div(0, 2)]);
    expect(adjustmentsOf(c)).toEqual([]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(0);
  });

  it('an AMBIGUOUS late row waits: two payloads under one id after the sale are recorded, nothing is paid, the row is not full quality', async () => {
    const c = await start();
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [div(1, 1), div(1, 2)]);
    expect(adjustmentsOf(c)).toEqual([]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(0);
    expect(ideaOf(c).ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[1]}`, reason: 'conflicting_action', closedHolding: true }));
    expect(rowOf(c, 3).fullQuality).toBe(false);
  });

  it('a possible RE-DATE after the sale waits: the same $1 a session after one already paid', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]); // paid while held
    await sellOnLine(c, 2);
    await close(c, 3, belowLine(c));
    await close(c, 4, belowLine(c), [div(2, 1)]); // the same $1, dated a session later, listed after the sale
    expect(adjustmentsOf(c)).toEqual([]);
    expect(ideaOf(c).ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[2]}`, reason: 'possible_redate', redateOf: `cash_dividend_AAPL_${S[1]}` }));
  });

  it('AFTER THE IDEA\'S RESULT: the idea\'s own late dividend goes to the book\'s treasury, its comparison\'s is recorded beside the result; the result stands, its view says whether the label would change', async () => {
    const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c)); // nothing held: the endpoint, the result, `resulted`
    expect(ideaOf(c).status).toBe('resulted');
    const result = JSON.stringify(ideaOf(c).result);
    const treasury = bookOf(c).treasury.unreservedCash;
    const cash = bookOf(c).portfolio.cash;
    await close(c, 3, belowLine(c), [div(1, 1)], { spy: [] });
    const idea = ideaOf(c);
    expect(JSON.stringify(idea.result)).toBe(result); // never rewritten
    expect(adjustmentsOf(c)).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, amountUsd: 99.97, postedTo: ADJUSTMENT_POSTED_TO.TREASURY })]);
    expect(adjustmentsOf(c, 'comparisonLedger')).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, amountUsd: 99.97, postedTo: ADJUSTMENT_POSTED_TO.PAPER_AFTER_RESULT })]);
    expect(roundUsd(bookOf(c).treasury.unreservedCash - treasury)).toBe(99.97);
    expect(roundUsd(bookOf(c).portfolio.cash - cash)).toBe(99.97);
    expect(idea.ledger.cash).toBe(0); // the resulted ledger keeps its returned state
    expect(idea.resultAdjustments).toMatchObject({ ideaUsd: 99.97, comparisonUsd: 99.97, wouldChangeLabel: false, economicResult: idea.result.economicResult });
    for (const [f, a] of [['ledger', adjustmentsOf(c)[0]], ['comparisonLedger', adjustmentsOf(c, 'comparisonLedger')[0]]]) expect(verifyPacket(evidenceOf(c, a)), f).toBe(true);
    // Once.
    await rerun(c, 3);
    await close(c, 4, belowLine(c), [div(1, 1)]);
    expect(adjustmentsOf(c)).toHaveLength(1);
    expect(roundUsd(bookOf(c).treasury.unreservedCash - treasury)).toBe(99.97);
  });

  it('the SPY line after the result: a SPY dividend dated while it held, first listed after the result, is recorded beside the result (paper)', async () => {
    const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    const treasury = bookOf(c).treasury.unreservedCash;
    await close(c, 3, belowLine(c), [], { spy: [div(1, 2, 'SPY')] });
    const spy = adjustmentsOf(c, 'spyLedger');
    expect(spy).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, postedTo: ADJUSTMENT_POSTED_TO.PAPER_AFTER_RESULT, actionId: `cash_dividend_SPY_${S[1]}` })]);
    expect(spy[0].amountUsd).toBe(roundUsd(ideaOf(c).spyLedger.holdings.SPY.shares * 2));
    expect(bookOf(c).treasury.unreservedCash).toBe(treasury); // paper: nothing moves
    expect(ideaOf(c).resultAdjustments).toMatchObject({ spyUsd: spy[0].amountUsd, wouldChangeLabel: false });
  });
});

describe('T2D-04 — a split listed late, dated before a dividend already paid', () => {
  it('Astra\'s case: a 5:4 split listed late — the $1 dividend first paid $99.97 is adjusted +$24.99 to $124.96 on the idea, its same-stock comparison and the book, once', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80); // the 5:4 happened (the price follows), no row: no hold (×0.8 is not a split's shape, under the threshold)
    await close(c, 2, 80, [div(2, 1)]); // the $1 dated Nov 18 paid on the unadjusted count
    expect([ideaOf(c).ledger.dividendsUsd, ideaOf(c).comparisonLedger.dividendsUsd]).toEqual([99.97, 99.97]);
    const cash = bookOf(c).portfolio.cash;
    await close(c, 3, 80, [div(2, 1), spl(1, '5/4')]); // the split, dated Nov 17, listed Nov 19
    const idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(idea[f].holdings.AAPL.shares, f).toBe(124.96251);
      expect(idea[f].dividendsUsd, f).toBe(124.96);
      expect(adjustmentsOf(c, f), f).toEqual([expect.objectContaining({
        kind: ADJUSTMENT_KIND.LATE_BASIS, actionId: `cash_dividend_AAPL_${S[2]}`, amountUsd: 24.99, entitledShares: 124.96251, trigger: [`split_AAPL_${S[1]}`],
        corrects: { receipt: `cash_dividend_AAPL_${S[2]}`, appliedOn: S[2] },
      })]);
    }
    expect(roundUsd(bookOf(c).portfolio.cash - cash)).toBe(24.99);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(124.96251);
    // Once: a re-run, and the next close listing both rows again.
    await rerun(c, 3);
    await close(c, 4, 80, [div(2, 1), spl(1, '5/4')]);
    expect(adjustmentsOf(c)).toHaveLength(1);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(124.96);
  });

  it('both arrival orders end with the same money: the split listed on time pays $124.96 directly', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 80, [div(2, 1)]);
    expect([ideaOf(c).ledger.dividendsUsd, ideaOf(c).comparisonLedger.dividendsUsd]).toEqual([124.96, 124.96]);
    expect(adjustmentsOf(c)).toEqual([]); // on time: nothing late, nothing posted
  });

  it('a REVERSE split listed late is a debit: 4-for-5 after a $1 paid on 99.970008 — −$19.99, to $79.98', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 125);
    await close(c, 2, 125, [div(2, 1)]);
    const cash = bookOf(c).portfolio.cash;
    await close(c, 3, 125, [spl(1, '4/5')]);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(roundShares(SH * 0.8));
    expect(adjustmentsOf(c)).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_BASIS, amountUsd: -19.99 })]);
    expect(idea.ledger.dividendsUsd).toBe(79.98);
    expect(roundUsd(bookOf(c).portfolio.cash - cash)).toBe(-19.99);
  });

  it('two dividends after one late split: each is recomputed, once', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80);
    await close(c, 2, 80, [div(2, 1)]);
    await close(c, 3, 80, [div(3, 0.5)]);
    await close(c, 4, 80, [spl(1, '5/4')]);
    const want = [roundUsd(124.96251 * 1) - roundUsd(SH * 1), roundUsd(124.96251 * 0.5) - roundUsd(SH * 0.5)].map(roundUsd);
    expect(adjustmentsOf(c).map((a) => [a.actionId, a.amountUsd])).toEqual([[`cash_dividend_AAPL_${S[2]}`, want[0]], [`cash_dividend_AAPL_${S[3]}`, want[1]]]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(roundUsd(124.96 + roundUsd(124.96251 * 0.5)));
    await rerun(c, 4);
  });

  it('AFTER THE RESULT: a split dated on the dividend\'s own ex-date, listed after the idea resulted, corrects it — the idea\'s +$24.99 to the treasury, its comparison\'s beside the result', async () => {
    const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
    await close(c, 0);
    // Nov 17: the 5:4 happens (the price follows, to $80, below the line) and the $1 dated Nov 17 is listed and paid.
    await close(c, 1, 80, [div(1, 1)]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    expect(ideaOf(c).ledger.holdings.AAPL.exitPending).toBeTruthy();
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(80) });
    await close(c, 2, 80);
    expect(ideaOf(c).status).toBe('resulted');
    const treasury = bookOf(c).treasury.unreservedCash;
    await close(c, 3, 80, [spl(1, '5/4')]); // the split, dated Nov 17, listed after the result
    const idea = ideaOf(c);
    expect(idea.ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: `split_AAPL_${S[1]}`, historyOnly: true, applied: true, sharesBefore: SH, sharesAfter: 124.96251 }));
    expect(adjustmentsOf(c)).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_BASIS, amountUsd: 24.99, postedTo: ADJUSTMENT_POSTED_TO.TREASURY })]);
    expect(adjustmentsOf(c, 'comparisonLedger')).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_BASIS, amountUsd: 24.99, postedTo: ADJUSTMENT_POSTED_TO.PAPER_AFTER_RESULT })]);
    expect(roundUsd(bookOf(c).treasury.unreservedCash - treasury)).toBe(24.99);
    expect(idea.resultAdjustments).toMatchObject({ ideaUsd: 24.99, comparisonUsd: 24.99, wouldChangeLabel: false });
    await rerun(c, 3);
  });
});

describe('T2D-05 — a vendor correction under an id already settled', () => {
  /** 5:4 and $1 for Nov 17, both settled by the feed at Nov 17's close; then 3:2 and $2 for the same date. */
  async function corrected() {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4'), div(1, 1)]);
    expect([ideaOf(c).ledger.holdings.AAPL.shares, ideaOf(c).ledger.dividendsUsd]).toEqual([124.96251, 124.96]);
    await close(c, 2, 66.67, [spl(1, '3/2'), div(1, 2)]);
    return c;
  }

  it('the correction is recorded on every ledger that settled the ids, waits for the founder, holds the row below full quality and moves nothing', async () => {
    const c = await corrected();
    const idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(openRulingRevisions(idea[f]).map((r) => [r.actionId, r.settledBy, r.rows.map((p) => p.ratio ?? p.amount)]).sort(), f).toEqual([
        [`cash_dividend_AAPL_${S[1]}`, 'feed', [2]], [`split_AAPL_${S[1]}`, 'feed', [1.5]],
      ]);
      expect(idea[f].holdings.AAPL.shares).toBe(124.96251);
      expect(idea[f].dividendsUsd).toBe(124.96);
    }
    expect(rowOf(c, 2).fullQuality).toBe(false);
  });

  it('Astra\'s case, ruled to the correction: 149.955012 shares and $299.91 of dividends, once, on the idea, its comparison and the book', async () => {
    const c = await corrected();
    expect((await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, { requestKey: 'fix-split' })).status).toBe(200);
    expect((await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, { requestKey: 'fix-div' })).status).toBe(200);
    const cash = bookOf(c).portfolio.cash;
    await close(c, 3, 66.67);
    const idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(idea[f].holdings.AAPL.shares, f).toBe(149.955012);
      expect(idea[f].dividendsUsd, f).toBe(299.91);
      expect(adjustmentsOf(c, f).map((a) => [a.kind, a.type, a.amountUsd]), f).toEqual([
        [ADJUSTMENT_KIND.RULED_CORRECTION, 'split', 0],
        [ADJUSTMENT_KIND.LATE_BASIS, 'cash_dividend', 25],
        [ADJUSTMENT_KIND.RULED_CORRECTION, 'cash_dividend', 149.95],
      ]);
      expect(openRulingRevisions(idea[f]), f).toEqual([]);
    }
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(149.955012);
    expect(roundUsd(bookOf(c).portfolio.cash - cash)).toBe(174.95);
    expect(idea.founderRulings.filter((r) => r.appliedOn === S[3]).map((r) => r.requestKey).sort()).toEqual(['fix-div', 'fix-split']);
    expect(rowOf(c, 3).fullQuality).toBe(true);
    // The line moved with the count.
    expect(idea.lines.find((l) => l.symbol === 'AAPL').adjustments).toContainEqual(expect.objectContaining({ actionId: `split_AAPL_${S[1]}`, correction: true }));
    // Once.
    await rerun(c, 3);
    await close(c, 4, 66.67, [spl(1, '3/2'), div(1, 2)]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(299.91);
    expect(adjustmentsOf(c)).toHaveLength(3);
  });

  it('ruled to keep the original: nothing moves, the records close, full quality returns', async () => {
    const c = await corrected();
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, { requestKey: 'keep-split' });
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, { requestKey: 'keep-div' });
    await close(c, 3, 80);
    const idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, idea.ledger.dividendsUsd]).toEqual([124.96251, 124.96]);
    expect(adjustmentsOf(c)).toEqual([]);
    expect(openRulingRevisions(idea.ledger)).toEqual([]);
    expect(rowOf(c, 3).fullQuality).toBe(true);
  });

  it('a THIRD payload after the ruling is a new ambiguity (FQ-5): the ruling covers exactly what it saw', async () => {
    const c = await corrected();
    // (The split's own revision is answered first — kept — so its doubt no longer holds the dividend's correction.)
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, { requestKey: 'keep-split' });
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, { requestKey: 'fix-div' });
    await close(c, 3, 80);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(roundUsd(124.96251 * 2));
    await close(c, 4, 80, [div(1, 3)]);
    expect(openRulingRevisions(ideaOf(c).ledger)).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[1]}`, rows: [expect.objectContaining({ amount: 3 })] })]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(roundUsd(124.96251 * 2)); // nothing moves until the founder answers
    // A seen payload reopens nothing: the original $1 listed again is not a new ambiguity.
    expect(rowOf(c, 4).fullQuality).toBe(false);
  });

  it('`none` after a paid payload is still refused (it would undo a settlement, not adjust it); a payload never seen is refused', async () => {
    const c = await corrected();
    expect(await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' }, { requestKey: 'n', expectOk: false })).toMatchObject({ status: 422, body: { error: 'ruling_needs_adjustment' } });
    expect(await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 7 } }, { requestKey: 'p', expectOk: false })).toMatchObject({ status: 422, body: { error: 'payload_not_recorded' } });
  });
});

describe('T2D-12 — parse coverage: a rejected row, a malformed envelope or a missing report is a day of doubt', () => {
  /** S[1]'s daily layer built by the REAL daily builder through the parse-reporting wrapper, the vendor answering `bodies`. */
  async function buildDaily(c, i, bodies) {
    const http = async (url) => {
      const leg = url.includes('/splits/') ? 'splits' : 'dividends';
      const sym = url.split('/').pop().split('.US')[0];
      const body = bodies[sym]?.[leg] ?? [];
      return { ok: true, status: 200, json: async () => body };
    };
    const quiet = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {})];
    try {
      c.db._store.delete(`mandateUniverseDaily/${S[i]}`);
      await ensureDailySnapshot(c.db, {
        date: S[i], heldTickers: [], coverageTickers: ['AAPL', 'MSFT', 'SPY'], candidateUniverse: [], now: new Date(etIso(S[i], 8, 30)),
        getFundamentals: async () => ({ fundamentals: { sector: 'Technology', marketCap: 3e12 } }),
        fetchCorporateActions: makeParseReportingFetcher(c.db, { symbols: ['AAPL', 'MSFT', 'SPY'], base: (sym, o) => fetchCorporateActionsEODHD(sym, { ...o, apiKey: 'fixture-key' }), fetchImpl: http }),
      });
    } finally { for (const s of quiet) s.mockRestore(); }
  }

  it('Astra\'s case: a 5:4 split written `5:4` is rejected — the close holds 99.970008 shares as uncovered, not valued at $80 at full quality', async () => {
    const c = await start();
    await close(c, 0);
    c.db._store.delete(`practiceFieldCaParseReports/${S[1]}`);
    await buildDaily(c, 1, { AAPL: { splits: [{ date: S[1], split: '5:4' }] } });
    expect(c.db._get(`practiceFieldCaParseReports/${S[1]}`).symbols.AAPL).toMatchObject({ rowsReceived: 1, rowsAccepted: 0, rowsRejected: 1, malformedEnvelope: false, rejects: [{ leg: 'splits', reason: 'malformed_split' }] });
    expect(c.db._get(`mandateUniverseDaily/${S[1]}`).symbols.AAPL.caFetchFailed).toBeUndefined(); // the daily entry alone reads as a success
    await storeCloseSnapshot(c.db, S[1], q(80));
    await closeIdeaBook(c.db, c.bookRef, { date: S[1], now: closeNowOf(S[1]) });
    recon(c);
    const row = rowOf(c, 1);
    expect(ideaOf(c).ledger.holdings.AAPL.shares).toBe(SH);
    expect(row.marks.AAPL).toMatchObject({ quality: 'ca_coverage_missing', markSource: 'carry_over' });
    expect(row.marks.AAPL.mark).not.toBe(80);
    expect(row.fullQuality).toBe(false);
    expect(ideaOf(c).caCoverageGaps?.AAPL).toMatchObject({ reason: 'ca_parse_incomplete' });
  });

  it('a malformed envelope (an object, not a list) is a day of doubt; a clean report covers', async () => {
    const c = await start();
    await close(c, 0);
    await buildDaily(c, 1, { AAPL: { splits: { error: 'Ticker temporarily unavailable' } } });
    expect(c.db._get(`practiceFieldCaParseReports/${S[1]}`).symbols.AAPL).toMatchObject({ malformedEnvelope: true, rowsRejected: 0 });
    await storeCloseSnapshot(c.db, S[1], q(100));
    await closeIdeaBook(c.db, c.bookRef, { date: S[1], now: closeNowOf(S[1]) });
    expect(rowOf(c, 1).marks.AAPL.quality).toBe('ca_coverage_missing');
    // The next session's build is clean: covered again, a fresh mark.
    await buildDaily(c, 2, {});
    expect(c.db._get(`practiceFieldCaParseReports/${S[2]}`).symbols.AAPL).toMatchObject({ rowsRejected: 0, malformedEnvelope: false });
    await storeCloseSnapshot(c.db, S[2], q(101));
    await closeIdeaBook(c.db, c.bookRef, { date: S[2], now: closeNowOf(S[2]) });
    expect(rowOf(c, 2).marks.AAPL).toMatchObject({ mark: 101, quality: 'vendor_time' });
  });

  it('a MISSING report counts as uncovered (fail-closed); a report naming a rejection on a held symbol waits the sale too', async () => {
    const c = await start();
    await close(c, 0);
    await storeCloseSnapshot(c.db, S[1], q(100));
    omitParseReport(c.db, S[1], ['AAPL']);
    await closeIdeaBook(c.db, c.bookRef, { date: S[1], now: closeNowOf(S[1]) });
    expect(rowOf(c, 1).marks.AAPL.quality).toBe('ca_coverage_missing');
    expect(rowOf(c, 1).marks.MSFT.quality).toBe('vendor_time');
    // A rejection in the report on a later session.
    storeParseReport(c.db, S[2], 'AAPL', { ...CLEAN_PARSE_ENTRY, rowsReceived: 1, rowsRejected: 1, rejects: [{ leg: 'dividends', reason: 'malformed_dividend', row: { date: S[2] } }], legs: { ...CLEAN_PARSE_ENTRY.legs, dividends: { ...CLEAN_PARSE_ENTRY.legs.dividends, received: 1, rejected: 1 } } });
    await close(c, 2, 100);
    expect(rowOf(c, 2).marks.AAPL.quality).toBe('ca_coverage_missing');
  });

  it('the wrapper returns EXACTLY what the base returns, makes no second upstream call, never stores the URL, and reports only the symbols it is told', async () => {
    const db = makeMandateFakeDb();
    const calls = [];
    const http = async (url) => { calls.push(url); return { ok: true, status: 200, json: async () => (url.includes('/div/') ? [{ date: '2026-11-17', unadjustedValue: 1 }] : [{ date: '2026-11-17', split: '1/1' }]) }; };
    const base = (sym, o) => fetchCorporateActionsEODHD(sym, { ...o, apiKey: 'secret-key', fetchImpl: o.fetchImpl ?? http });
    const fetcher = makeParseReportingFetcher(db, { symbols: ['AAPL'], base, fetchImpl: http });
    const opts = { from: '2026-11-12', to: '2026-11-19' };
    expect(sessionOfWindow(opts.from, opts.to)).toBe('2026-11-17');
    const plain = await fetchCorporateActionsEODHD('AAPL', { ...opts, apiKey: 'secret-key', fetchImpl: http });
    const n = calls.length;
    const wrapped = await fetcher('AAPL', opts);
    expect(wrapped).toEqual(plain);
    expect(calls.length - n).toBe(n); // the same two calls as the base alone, no more
    const report = db._get('practiceFieldCaParseReports/2026-11-17');
    expect(report.symbols.AAPL).toMatchObject({ rowsReceived: 2, rowsAccepted: 1, rowsNoOp: 1, rowsRejected: 0, malformedEnvelope: false });
    expect(JSON.stringify(report)).not.toMatch(/secret-key|api_token|eodhd\.com/);
    // A symbol not required: straight to the base, no seam, no report.
    const other = await fetcher('MSFT', opts);
    expect(other).toEqual(await fetchCorporateActionsEODHD('MSFT', { ...opts, apiKey: 'secret-key', fetchImpl: http }));
    expect(db._get('practiceFieldCaParseReports/2026-11-17').symbols.MSFT).toBeUndefined();
  });

  it('QUARTERLY ISOLATION: at off, and at on with no idea book, the daily build gets no wrapper and writes no report; with an idea book the shared daily document is byte-identical to the base fetcher, and only the report is added', async () => {
    const build = async (mode, { inputs: mk, strip = false }) => {
      const restore = setPracticeFieldModeForTests(mode);
      const quiet = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {})];
      const calls = [];
      vi.stubGlobal('fetch', async (url) => { calls.push(String(url).replace(/api_token=[^&]*/, 'api_token=*')); return { ok: true, status: 200, json: async () => (url.includes('/splits/AAPL') ? [{ date: '2026-11-17', split: '5:4' }] : []) }; });
      vi.stubEnv('EODHD_API_KEY', 'synthetic');
      try {
        const db = makeMandateFakeDb();
        const inputs = await mk(db);
        const daily = { ...inputs.daily };
        if (strip) delete daily.fetchCorporateActions;
        await ensureDailySnapshot(db, {
          date: '2026-11-17', heldTickers: ['AAPL'], candidateUniverse: ['AAPL', 'JPM'], now: new Date('2026-11-17T13:30:00Z'),
          getFundamentals: async () => ({ fundamentals: { sector: 'Technology', marketCap: 3e12 } }), ...daily,
        });
        return { daily: JSON.stringify(db._get('mandateUniverseDaily/2026-11-17')), report: db._get('practiceFieldCaParseReports/2026-11-17') ?? null, wrapped: typeof inputs.daily.fetchCorporateActions === 'function', calls };
      } finally { for (const s of quiet) s.mockRestore(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); restore(); }
    };
    const noBook = async () => ({ daily: {} }); // the cron's own answer when no idea book is in the fire (mandate-evaluate.js)
    const withBook = (db) => practiceFieldBuildInputs(db, { ideaHeldTickers: ['AAPL'], quarterlyActive: true, coverageData: null });
    const engine = await build('off', { inputs: noBook });
    expect(engine.report).toBeNull();
    // 'off': even handed a book, the build inputs carry no wrapper.
    const off = await build('off', { inputs: withBook });
    expect([off.wrapped, off.report]).toEqual([false, null]);
    const onNoBook = await build('on', { inputs: noBook });
    expect([onNoBook.wrapped, onNoBook.report, onNoBook.daily, [...onNoBook.calls].sort()]).toEqual([false, null, engine.daily, [...engine.calls].sort()]);
    // 'on' with a book: the same inputs with and without the wrapper — the shared daily document and the vendor calls are
    // byte-identical; only the report is added, in its own collection.
    const base = await build('on', { inputs: withBook, strip: true });
    const onBook = await build('on', { inputs: withBook });
    expect(onBook.wrapped).toBe(true);
    expect(base.report).toBeNull();
    expect(onBook.daily).toBe(base.daily);
    expect([...onBook.calls].sort()).toEqual([...base.calls].sort()); // (the build fetches several symbols at once: order is not fixed)
    expect(onBook.report.symbols.AAPL).toMatchObject({ rowsRejected: 1 });
  });
});

describe('the adjustment record (pure): a debit larger than its cash is held, and the result view', () => {
  const ledgerPaid = (cash) => ({
    kind: 'idea', cash, dividendsUsd: 99.97, holdings: { AAPL: { shares: 79.976006, costBasisTotal: 10000 } }, appliedActionIds: ['cash_dividend_AAPL_2026-11-18', 'reverse_split_AAPL_2026-11-17'], declinedActionIds: [], saleReceipts: [],
    corporateActionReceipts: [
      { actionId: 'cash_dividend_AAPL_2026-11-18', type: 'cash_dividend', ticker: 'AAPL', effectiveDate: '2026-11-18', amount: 1, incomeUsd: 99.97, applied: true, appliedOn: '2026-11-18' },
      { actionId: 'reverse_split_AAPL_2026-11-17', type: 'reverse_split', ticker: 'AAPL', effectiveDate: '2026-11-17', ratio: 0.8, incomeUsd: 0, applied: true, appliedOn: '2026-11-19', sharesBefore: SH, sharesAfter: 79.976006 },
    ],
  });
  it('a late-basis DEBIT larger than the cash it would come from is not posted: held, `adjustment_exceeds_cash`, alerted; with the cash later, posted once', async () => {
    const { planLedgerAdjustments } = await import('./adjustments.js');
    const ctx = { ideaId: 'i', ledgerKind: 'idea', date: '2026-11-19', rows: {}, closed: new Map(), doubtOn: () => false };
    const short = planLedgerAdjustments(ledgerPaid(5), ctx);
    expect(short.posted).toEqual([]);
    expect(short.held).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_BASIS, held: true, reason: 'adjustment_exceeds_cash', amountUsd: -19.99 })]);
    expect(short.ledger.cash).toBe(5);
    expect(short.alerts.some((a) => /PRACTICE_FIELD_ADJUSTMENT_HELD .*(adjustment_exceeds_cash)/.test(a))).toBe(true);
    const later = planLedgerAdjustments({ ...short.ledger, cash: 50 }, { ...ctx, date: '2026-11-20' });
    expect(later.posted).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_BASIS, amountUsd: -19.99 })]);
    expect(later.ledger.adjustments.filter((a) => a.held)).toEqual([]);
    expect([later.ledger.cash, later.ledger.dividendsUsd]).toEqual([30.01, 79.98]);
    expect(planLedgerAdjustments(later.ledger, { ...ctx, date: '2026-11-23' }).posted).toEqual([]);
  });
  it('a doubt on the symbol defers it (durable: posted at the first close without the doubt)', async () => {
    const { planLedgerAdjustments } = await import('./adjustments.js');
    const ctx = { ideaId: 'i', ledgerKind: 'idea', date: '2026-11-19', rows: {}, closed: new Map() };
    const waiting = planLedgerAdjustments(ledgerPaid(500), { ...ctx, doubtOn: () => true });
    expect([waiting.posted, waiting.held]).toEqual([[], []]);
    expect(planLedgerAdjustments(waiting.ledger, { ...ctx, doubtOn: () => false }).posted).toEqual([expect.objectContaining({ amountUsd: -19.99 })]);
  });
  it('the result view: `wouldChangeLabel` is computed from the figures — an idea-only adjustment that moves the gap past the band changes it; one dated after the endpoint is not counted', async () => {
    const { resultAdjustmentView } = await import('./adjustments.js');
    const idea = (adjs, cmp = []) => ({
      result: { endpointSession: '2026-11-20', economicResult: 'within_band', economic: { gapUsd: 50, bandUsd: 100 } },
      ledger: { adjustments: adjs }, comparisonLedger: { adjustments: cmp }, spyLedger: { adjustments: [] },
    });
    const a = (amountUsd, effectiveDate = '2026-11-18', postedOn = '2026-11-23') => ({ kind: 'late_entitlement', actionId: 'x', amountUsd, effectiveDate, postedOn, postedTo: 'treasury' });
    expect(resultAdjustmentView(idea([a(99.97)]))).toMatchObject({ gapUsdIfIncluded: 149.97, economicResultIfIncluded: 'ahead', wouldChangeLabel: true });
    expect(resultAdjustmentView(idea([a(99.97)], [a(99.97)]))).toMatchObject({ gapUsdIfIncluded: 50, wouldChangeLabel: false });
    expect(resultAdjustmentView(idea([a(99.97, '2026-11-23')]))).toBeNull(); // dated after the endpoint: not what it measured
    expect(resultAdjustmentView(idea([a(99.97, '2026-11-18', '2026-11-20')]))).toBeNull(); // posted at the endpoint: already in it
    expect(resultAdjustmentView({ ...idea([a(99.97)]), result: { ...idea([]).result, economicResult: 'unmeasurable' } })).toMatchObject({ wouldChangeLabel: false });
  });
});

describe('the battery\'s rows — each a behaviour of this build no other row pins', () => {
  it('T2D-03: a dividend dated ON the sale day is owed (sold on the ex-date); one dated before a split applied while held is paid on the count before it', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50, [spl(1, '2/1')]); // a 2-for-1 on Nov 17, listed on time: 199.940016 shares
    await sellOnLine(c, 2); // below the line Nov 18, sold Nov 19
    await close(c, 3, belowLine(c));
    // Listed after the sale: $1 dated Nov 16 (before the split, after the purchase? no — Nov 16 is the purchase day: owed nothing),
    // $0.5 dated Nov 19 (the sale day: owed, on 199.940016), and $2 dated Nov 17 (the split's own date: share basis first).
    await close(c, 4, belowLine(c), [div(0, 1), div(3, 0.5), div(1, 2)]);
    const got = Object.fromEntries(adjustmentsOf(c).map((a) => [a.actionId.slice(-10), [a.amountUsd, a.entitledShares]]));
    expect(got).toEqual({ [S[3]]: [roundUsd(199.940016 * 0.5), 199.940016], [S[1]]: [roundUsd(199.940016 * 2), 199.940016] });
  });

  it('T2D-03: the late row waits while the session\'s data does not cover the sold symbol (its parse report missing), and is paid at the first close that covers it', async () => {
    const c = await start();
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await storeCloseSnapshot(c.db, S[3], q(belowLine(c), [div(1, 1)]));
    omitParseReport(c.db, S[3], ['AAPL']);
    await closeIdeaBook(c.db, c.bookRef, { date: S[3], now: closeNowOf(S[3]) });
    expect(adjustmentsOf(c)).toEqual([]);
    await close(c, 4, belowLine(c), [div(1, 1)]);
    expect(adjustmentsOf(c)).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, amountUsd: 99.97, postedOn: S[4] })]);
  });

  it('T2D-12: a SALE waits on a session whose parse report shows a rejected row for the symbol (the same rule as the close)', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, belowLine(c));
    expect(ideaOf(c).ledger.holdings.AAPL.exitPending).toBeTruthy();
    storeParseReport(c.db, S[2], 'AAPL', { ...CLEAN_PARSE_ENTRY, rowsReceived: 1, rowsRejected: 1, rejects: [{ leg: 'splits', reason: 'malformed_split', row: { date: S[2], split: '5:4' } }], legs: { ...CLEAN_PARSE_ENTRY.legs, splits: { ...CLEAN_PARSE_ENTRY.legs.splits, received: 1, rejected: 1 } } });
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(belowLine(c)) });
    expect(ideaOf(c).ledger.holdings.AAPL).toBeTruthy(); // not sold
    expect(JSON.stringify(ideaOf(c).ledger.holdings.AAPL.exitPending.waiting)).toMatch(/corporate_action_data_missing/);
  });

  it('T2D-12: ADMISSION refuses a held name whose session parse report shows a rejection (`ca_parse_incomplete`)', async () => {
    const { admitIdea } = await import('./admission.js');
    const c = await start({ capitalUsd: 10000 });
    await close(c, 0);
    await storeCloseSnapshot(c.db, S[1], q(100));
    storeParseReport(c.db, S[1], 'AAPL', { ...CLEAN_PARSE_ENTRY, malformedEnvelope: true, legs: { ...CLEAN_PARSE_ENTRY.legs, dividends: { ...CLEAN_PARSE_ENTRY.legs.dividends, envelope: 'not_a_list' } } });
    await closeIdeaBook(c.db, c.bookRef, { date: S[1], now: closeNowOf(S[1]) });
    const res = await admitIdea(c.db, { bookId: c.bookId, contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 1000 }), opId: 'p1', nowIso: etIso(S[1], 18, 0) });
    expect(res.refusals).toEqual([expect.objectContaining({ code: 'admission_marks_unavailable', unavailable: expect.arrayContaining([expect.objectContaining({ symbol: 'AAPL', reason: 'ca_parse_incomplete' })]) })]);
  });

  it('T2D-12: a BACKFILL whose own parse report shows a rejection is stored failed (its rows kept) and covers nothing', async () => {
    const { ensureCoverageBackfills } = await import('./caBackfill.js');
    const { successfulBackfill } = await import('./dailyCoverage.js');
    const c = await start();
    const ref = c.db.collection('mandates').doc(c.bookId);
    const idea = ideaOf(c);
    c.db._store.get(`mandates/${c.bookId}/ideas/${c.ideaId}`).data = { ...idea, caCoveredThrough: { AAPL: S[0], MSFT: S[0], SPY: S[0] }, status: 'holding' };
    const http = async (url) => ({ ok: true, status: 200, json: async () => (url.includes('/splits/AAPL') ? [{ date: S[3], split: '5:4' }, { date: S[4], split: '2/1' }] : []) });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await ensureCoverageBackfills(c.db, ref, { through: S[9], now: closeNowOf(S[9]), fetchCorporateActions: (sym, o) => fetchCorporateActionsEODHD(sym, { ...o, apiKey: 'k' }), fetchImpl: http });
    } finally { quiet.mockRestore(); }
    const doc = c.db._get('practiceFieldCaBackfill/AAPL');
    expect(doc).toMatchObject({ failed: true, parseReport: { rowsRejected: 1 } });
    expect(doc.actions).toEqual([expect.objectContaining({ type: 'split', ratio: 2 })]); // the row that parsed is kept
    expect(successfulBackfill(doc, 'AAPL', null)).toBeNull();
    expect(successfulBackfill({ ...doc, failed: false }, 'AAPL', null)).toBeNull(); // not clean: never a success
  });

  it('RETENTION: the daily build keeps the symbols of an idea that resulted within the look-back, and only then', async () => {
    const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    expect(ideaOf(c).status).toBe('resulted');
    const at = async (date, ideaBookIds = [c.bookId]) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(etIso(date, 8, 0)));
      try { return await practiceFieldBuildInputs(c.db, { ideaHeldTickers: [], quarterlyActive: false, coverageData: null, ideaBookIds, now: new Date(etIso(date, 8, 0)) }); } finally { vi.useRealTimers(); }
    };
    expect((await at(S[3])).daily.coverageTickers).toEqual(expect.arrayContaining(['AAPL', 'SPY']));
    expect((await at(S[3])).daily.fetchCorporateActions).toBeTypeOf('function');
    expect((await at(S[12])).daily.coverageTickers).toEqual([]); // past the look-back: released
    // Review AR4-B-2 (the isolation rule): retention is read only for the idea books in the fire. With none — at 'on',
    // the resulted idea still in the store — the build inputs carry nothing of it: no symbol, no wrapper. At 'off', none.
    const none = await at(S[3], []);
    expect([none.daily.coverageTickers, none.daily.fetchCorporateActions]).toEqual([[], undefined]);
    const restore = setPracticeFieldModeForTests('off');
    try {
      const off = await at(S[3]);
      expect([off.daily.coverageTickers, off.daily.fetchCorporateActions]).toEqual([[], undefined]);
    } finally { restore(); }
  });
});

describe('the lens (b) review\'s rows — the report tied to its rows, a late rejection, the fenced query, the stored success, the writer', () => {
  const rejectedEntry = (row, leg = 'splits') => ({
    ...CLEAN_PARSE_ENTRY, rowsReceived: 1, rowsRejected: 1, rejects: [{ leg, reason: leg === 'splits' ? 'malformed_split' : 'malformed_dividend', row }],
    legs: { ...CLEAN_PARSE_ENTRY.legs, [leg]: { ...CLEAN_PARSE_ENTRY.legs[leg], received: 1, rejected: 1 } },
  });

  it('AR4-B-1: a clean report written by ANOTHER build of the session (other rows) is no evidence for the stored entry — uncovered, `parse_report_other_rows`; the matching report covers', () => {
    const daily = { date: S[1], dailyWindowFrom: S[0], symbols: { AAPL: { sector: null, corporateActions: [spl(1, '5/4')] } } };
    const report = (entry) => ({ schemaVersion: 1, session: S[1], symbols: { AAPL: entry } });
    // The losing build fetched nothing for AAPL and parsed it cleanly; the stored entry is the winning build's split.
    expect(dailyCoverageOf(daily, 'AAPL', report(CLEAN_PARSE_ENTRY))).toMatchObject({ covered: false, refusal: 'ca_parse_incomplete', parse: 'parse_report_other_rows' });
    expect(dailyCoverageOf(daily, 'AAPL', report(cleanParseEntryFor([spl(1, '5/4')])))).toMatchObject({ covered: true });
    // Order-free: the same rows listed in another order are the same rows.
    const two = [spl(1, '5/4'), div(1, 1)];
    expect(dailyCoverageOf({ ...daily, symbols: { AAPL: { sector: null, corporateActions: two } } }, 'AAPL', report(cleanParseEntryFor([...two].reverse())))).toMatchObject({ covered: true });
  });

  it('AR4-B-1: an entry without `actionsHash` (a report written before the tie) is uncovered too', () => {
    const daily = { date: S[1], dailyWindowFrom: S[0], symbols: { AAPL: { sector: null, corporateActions: [] } } };
    const { actionsHash, ...old } = CLEAN_PARSE_ENTRY;
    expect(actionsHash).toBeTypeOf('string');
    expect(dailyCoverageOf(daily, 'AAPL', { schemaVersion: 1, session: S[1], symbols: { AAPL: old } })).toMatchObject({ covered: false, parse: 'parse_report_other_rows' });
  });

  it('AR4-B-3: a rejected row dated BEFORE the last covered session reaches back — the covered-through date drops to the day before it, and the next clean window covering that date restores it', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1);
    await close(c, 2);
    expect(ideaOf(c).caCoveredThrough.AAPL).toBe(S[2]);
    // S[3]'s build lists, late, a row dated S[1] that the parser rejects.
    await storeCloseSnapshot(c.db, S[3], q(100));
    storeParseReport(c.db, S[3], 'AAPL', rejectedEntry({ date: S[1], split: '5:4' }));
    await closeIdeaBook(c.db, c.bookRef, { date: S[3], now: closeNowOf(S[3]) });
    recon(c);
    expect(rowOf(c, 3).marks.AAPL.quality).toBe('ca_coverage_missing');
    expect(ideaOf(c).caCoveredThrough.AAPL).toBe(S[0]); // the day before the rejected row's date, not S[2]
    expect(ideaOf(c).caCoveredThrough.MSFT).toBe(S[3]);
    // S[4]'s clean build: its window reaches back past S[1] — covered again, a fresh mark.
    await close(c, 4, 101);
    expect(rowOf(c, 4).marks.AAPL).toMatchObject({ mark: 101, quality: 'vendor_time' });
    expect(ideaOf(c).caCoveredThrough.AAPL).toBe(S[4]);
  });

  it('AR4-B-3: a rejected row with NO readable date reaches back to the idea\'s entry', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1);
    await storeCloseSnapshot(c.db, S[2], q(100));
    storeParseReport(c.db, S[2], 'AAPL', rejectedEntry({ split: '5/4' }));
    await closeIdeaBook(c.db, c.bookRef, { date: S[2], now: closeNowOf(S[2]) });
    expect(ideaOf(c).caCoveredThrough.AAPL).toBe(ideaOf(c).entry.sessionDate);
  });

  it('AR4-B-4: the resulted-ideas query failing does not stop the book closing — alerted; the next close posts the late dividend, once', async () => {
    const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    expect(ideaOf(c).status).toBe('resulted');
    const treasury = bookOf(c).treasury.unreservedCash;
    // A book ref whose `ideas` range query fails (every other read and write is the real one).
    const failing = new Proxy(c.bookRef, {
      get(t, k) {
        if (k !== 'collection') return t[k];
        return (name) => {
          const col = t.collection(name);
          if (name !== 'ideas') return col;
          return new Proxy(col, { get: (ct, ck) => (ck === 'where' ? () => ({ get: async () => { throw new Error('FAILED_PRECONDITION: the query needs an index'); } }) : ct[ck]) });
        };
      },
    });
    await storeCloseSnapshot(c.db, S[3], q(belowLine(c), [div(1, 1)]));
    const out = await closeIdeaBook(c.db, failing, { date: S[3], now: closeNowOf(S[3]) });
    expect(out.closed).toBe(true);
    expect(bookOf(c).execState.lastCloseKey).toBe(S[3]);
    expect(out.alerts.some((a) => a.startsWith('PRACTICE_FIELD_RESULTED_IDEAS_UNREAD'))).toBe(true);
    expect(adjustmentsOf(c)).toEqual([]);
    await close(c, 4, belowLine(c), [div(1, 1)]);
    expect(adjustmentsOf(c)).toEqual([expect.objectContaining({ kind: ADJUSTMENT_KIND.LATE_ENTITLEMENT, amountUsd: 99.97, postedTo: ADJUSTMENT_POSTED_TO.TREASURY, postedOn: S[4] })]);
    expect(roundUsd(bookOf(c).treasury.unreservedCash - treasury)).toBe(99.97);
  });

  it('AR4-B-5: a success stored before this build (no parse report) is never overwritten by a later failure', async () => {
    const { ensureCoverageBackfills } = await import('./caBackfill.js');
    const c = await start();
    const ref = c.db.collection('mandates').doc(c.bookId);
    const idea = ideaOf(c);
    c.db._store.get(`mandates/${c.bookId}/ideas/${c.ideaId}`).data = { ...idea, caCoveredThrough: { AAPL: S[0], MSFT: S[0], SPY: S[0] }, status: 'holding' };
    const legacy = { symbol: 'AAPL', from: S[0], to: S[2], failed: false, actions: [spl(1, '2/1')], fetchedAt: '2026-11-18T13:00:00.000Z' };
    c.db._store.set('practiceFieldCaBackfill/AAPL', { data: structuredClone(legacy), version: 1 });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await ensureCoverageBackfills(c.db, ref, { through: S[9], now: closeNowOf(S[9]), fetchCorporateActions: async () => { throw new Error('vendor down'); } });
    } finally { quiet.mockRestore(); }
    expect(c.db._get('practiceFieldCaBackfill/AAPL')).toEqual(legacy);
  });

  it('AR4-B-6: the writer is one merge at a time, coalesced, and a write that never answers is given up — the fetch returns the base\'s answer, the symbol reads uncovered', async () => {
    const db = makeMandateFakeDb();
    const http = async () => ({ ok: true, status: 200, json: async () => [] });
    const base = (sym, o) => fetchCorporateActionsEODHD(sym, { ...o, apiKey: 'k', fetchImpl: o.fetchImpl ?? http });
    const opts = { from: '2026-11-12', to: '2026-11-19' };
    // Three symbols fetched at once: every entry lands, never two writes to the document at once, in at most two merges.
    let inFlight = 0; let most = 0; let writes = 0;
    const watched = new Proxy(db, { get: (t, k) => (k !== 'collection' ? t[k] : (name) => {
      const col = t.collection(name);
      if (name !== 'practiceFieldCaParseReports') return col;
      return { doc: (id) => { const d = col.doc(id); return { set: async (...a) => { inFlight += 1; writes += 1; most = Math.max(most, inFlight); await new Promise((r) => setTimeout(r, 5)); try { return await d.set(...a); } finally { inFlight -= 1; } } }; } };
    }) });
    const fetcher = makeParseReportingFetcher(watched, { symbols: ['AAPL', 'MSFT', 'SPY'], base, fetchImpl: http });
    await Promise.all(['AAPL', 'MSFT', 'SPY'].map((s) => fetcher(s, opts)));
    expect(Object.keys(db._get('practiceFieldCaParseReports/2026-11-17').symbols).sort()).toEqual(['AAPL', 'MSFT', 'SPY']);
    expect(most).toBe(1);
    expect(writes).toBeLessThanOrEqual(2);
    // A write that never answers: given up after the timeout, the base's answer returned, nothing stored, alerted.
    const stuck = new Proxy(db, { get: (t, k) => (k !== 'collection' ? t[k] : () => ({ doc: () => ({ set: () => new Promise(() => {}) }) })) });
    const errors = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((m) => errors.push(String(m)));
    try {
      const slow = makeParseReportingFetcher(stuck, { symbols: ['NVDA'], base, fetchImpl: http, writeTimeoutMs: 20 });
      const got = await slow('NVDA', opts);
      expect(got).toEqual(await base('NVDA', opts));
    } finally { spy.mockRestore(); }
    expect(errors.some((e) => e.includes('PRACTICE_FIELD_PARSE_REPORT_UNWRITTEN NVDA'))).toBe(true);
    expect(db._get('practiceFieldCaParseReports/2026-11-17').symbols.NVDA).toBeUndefined();
  });

  it('AR4-B-7: a dateless 1:1 row is a rejection, not a no-op; a non-success status is not an answer; counts must add up', async () => {
    const db = makeMandateFakeDb();
    const http = async (url) => ({ ok: true, status: 200, json: async () => (url.includes('/splits/') ? [{ split: '1/1' }] : []) });
    const base = (sym, o) => fetchCorporateActionsEODHD(sym, { ...o, apiKey: 'k', fetchImpl: o.fetchImpl ?? http });
    await makeParseReportingFetcher(db, { symbols: ['AAPL'], base, fetchImpl: http })('AAPL', { from: '2026-11-12', to: '2026-11-19' });
    const entry = db._get('practiceFieldCaParseReports/2026-11-17').symbols.AAPL;
    expect(entry).toMatchObject({ rowsNoOp: 0, rowsRejected: 1 });
    expect(parseEntryVerdict(entry).clean).toBe(false);
    const clean = cleanParseEntryFor([]);
    expect(parseEntryVerdict(clean).clean).toBe(true);
    expect(parseEntryVerdict({ ...clean, legs: { ...clean.legs, splits: { ...clean.legs.splits, status: 500 } } }).clean).toBe(false);
    expect(parseEntryVerdict({ ...clean, legs: { ...clean.legs, splits: { ...clean.legs.splits, received: 2, accepted: 1 } } })).toMatchObject({ clean: false, reason: 'parse_counts_inconsistent' });
    expect(parseEntryVerdict({ ...clean, legs: { ...clean.legs, splits: { ...clean.legs.splits, received: 1.5, accepted: 1.5 } } })).toMatchObject({ clean: false, reason: 'parse_counts_inconsistent' });
    expect(parseEntryVerdict({ ...clean, rejects: undefined }).clean).toBe(false);
  });
});
