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
import { makeParseReportingFetcher, sessionOfWindow } from './caParseReport.js';
import { practiceFieldBuildInputs } from './sweep.js';
import { openRulingRevisions } from './ledger.js';
import { nextSessionDate } from './windows.js';
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, getRow, closeOn, closeNowOf, storeCloseSnapshot, windowAt, founderRules,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, storeParseReport, omitParseReport, CLEAN_PARSE_ENTRY, makeMandateFakeDb, etIso,
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
