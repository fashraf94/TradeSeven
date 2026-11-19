// api/_utils/practiceField/corporateActionStickyAmbiguity.test.js
//
// Practice Field T1a-2b-3, FIX ROUND 2 — Amendment F revision 1 (sticky ambiguity;
// docs/design/20261118_PRACTICE_FIELD_AMENDMENT_F_REV1_STICKY_AMBIGUITY.md), answering Astra's round-1 confirmation
// (docs/audits/20261118_ASTRA_CONFIRMATION_T1A2B3_ROUND1.md, T2D-C01 to T2D-C05). Each of her five reproductions runs here
// as a FIXED CASE, on normal entry, parsed vendor rows and the real close or founder action against the fake database,
// with the outcome rev 1 gives — then the rows that pin rev 1's own rules (S-1 to S-5). The randomized sequences (S-6)
// are in corporateActionSequences.test.js.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { closeIdeaBook, catchUpIdeaBook } from './close.js';
import { parseSplitsPayload, parseDividendsPayload } from '../mandateCorporateActions.js';
import { unsettledConflicts, unsettledRedates, openRulingRevisions, heldActionRecords, saleHeldBackBy } from './ledger.js';
import { ledgerDoubts } from './settlement.js';
import { nextSessionDate } from './windows.js';
import {
  seedBook, admitAndEnter, closeOn, contractOf, getBook, getIdea, getRow, closeNowOf, storeCloseSnapshot, founderRules, admitAllThenEnter,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16'];
while (S.length < 30) S.push(nextSessionDate(S.at(-1)));
const spl = (i, v = '3/2', s = 'AAPL') => parseSplitsPayload(s, [{ date: S[i], split: v }]).actions[0];
const div = (i, v = 1, s = 'AAPL') => parseDividendsPayload(s, [{ date: S[i], unadjustedValue: v }]).actions[0];
const q = (p = 100, a = []) => ({
  AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 },
});
const SHARES = 99.970008; // $10,000 of AAPL at $100 after the entry's costs

async function start(opts = {}) {
  const ctx = await seedBook();
  const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, ...opts }), quotes: q(), date: S[0] });
  return { ...ctx, ideaId: a.ideaId };
}
const ideaOf = (c) => getIdea(c.db, c.bookId, c.ideaId);
const bookOf = (c) => getBook(c.db, c.bookId);
const rowOf = (c, i) => getRow(c.db, c.bookId, c.ideaId, S[i]);
const recon = (c) => { const b = bookOf(c); return assertReconciled(b, b.openIdeaIds.map((id) => getIdea(c.db, c.bookId, id))); };
const close = async (c, i, p = 100, a = []) => { const out = await closeOn(c.db, c.bookId, S[i], q(p, a)); recon(c); return out; };
const raw = (c, i) => closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
/** S[i]'s stored daily layer says AAPL's corporate-action fetch failed. */
function failed(c, i) {
  const e = c.db._store.get(`mandateUniverseDaily/${S[i]}`);
  e.data.symbols.AAPL.caFetchFailed = true;
  e.version += 1;
}
/** An uncovered close of S[i]: the snapshot lists `a`, AAPL's fetch failed. */
async function uncoveredClose(c, i, p, a = []) {
  await storeCloseSnapshot(c.db, S[i], q(p, a));
  failed(c, i);
  await raw(c, i);
  recon(c);
}
const rule = (c, body, requestKey, expectOk = true) => founderRules(c.db, c.bookId, c.ideaId, body, { requestKey, expectOk });
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];
const appliedAndDeclined = (idea) => LEDGERS.flatMap((f) => {
  const declined = new Set(idea[f]?.declinedActionIds || []);
  return (idea[f]?.appliedActionIds || []).filter((id) => declined.has(id)).map((id) => `${f}:${id}`);
});
const divs = (idea) => [idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd];

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

// ── T2D-C01 · a revised ex-date conflict, then a re-date of the NEW payload ─────────────────────────────────────────────

describe('T2D-C01 — every payload an ambiguous record sees is kept: a re-date of one first seen at a LATER close is matched', () => {
  it('cash: $1/$2 on the purchase date, then $1/$3 for that id, then $3 re-dated: nothing paid, both ids wait for the founder', async () => {
    const c = await start();
    await close(c, 0, 100, [div(0, 1), div(0, 2)]);
    const cash = bookOf(c).portfolio.cash;
    await close(c, 1, 100, [div(0, 1), div(0, 3)]);
    // The record kept the third payload (seen a session later) beside the first two.
    expect(unsettledConflicts(ideaOf(c).ledger)[0].rows.map((r) => r.amount)).toEqual([1, 2, 3]);
    await close(c, 2, 100, [div(2, 3)]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([0, 0]);
    expect(bookOf(c).portfolio.cash).toBe(cash);
    expect(unsettledRedates(idea.ledger).map((r) => [r.actionId, r.redateOf])).toEqual([[`cash_dividend_AAPL_${S[2]}`, `cash_dividend_AAPL_${S[0]}`]]);
    expect(rowOf(c, 2).fullQuality).toBe(false);
  });

  it('cash, the control: the same three payloads listed at once on the purchase date — the same answer', async () => {
    const c = await start();
    await close(c, 0, 100, [div(0, 1), div(0, 2), div(0, 3)]);
    const cash = bookOf(c).portfolio.cash;
    await close(c, 1, 100, [div(0, 1), div(0, 2), div(0, 3)]);
    await close(c, 2, 100, [div(2, 3)]);
    expect(divs(ideaOf(c))).toEqual([0, 0]);
    expect(bookOf(c).portfolio.cash).toBe(cash);
  });

  it('a split: 3:2 / 5:4 on the purchase date, then 7:4 / 5:4 for that id, then 7:4 re-dated at a flat price: no phantom shares anywhere', async () => {
    const c = await start();
    await close(c, 0, 100, [spl(0, '3/2'), spl(0, '5/4')]);
    await close(c, 1, 100, [spl(0, '7/4'), spl(0, '5/4')]);
    await close(c, 2, 100, [spl(2, '7/4')]);
    const idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([SHARES, SHARES, SHARES]);
    expect(unsettledRedates(idea.ledger).map((r) => r.actionId)).toEqual([`split_AAPL_${S[2]}`]);
    expect(rowOf(c, 2).fullQuality).toBe(false);
    expect(saleHeldBackBy(idea.ledger, 'AAPL', { symbols: {} }, { date: S[3] })).toBe('corporate_action_unsettled');
  });
});

// ── T2D-C02 · an archive/backfill disagreement is the founder's ──────────────────────────────────────────────────────────

describe('T2D-C02 — an open archive/backfill disagreement settles only by the founder', () => {
  /** 22 archived closes; S[4] archived 5:4 at $80; the catch-up's backfill lists 3:2 for the same id. */
  async function disagreement({ archivedS5 = [] } = {}) {
    const c = await start({ slot: 'long' });
    await close(c, 0);
    for (let i = 1; i < 23; i += 1) await storeCloseSnapshot(c.db, S[i], q(i >= 4 ? 80 : 100, i === 4 ? [spl(4, '5/4')] : (i === 5 ? archivedS5 : [])));
    const fetchCorporateActions = async (sym) => ({ failed: false, calls: 2, actions: sym === 'AAPL' ? [spl(4, '3/2')] : [] });
    const args = { before: S[23], now: closeNowOf(S[23]), fetchCorporateActions };
    await catchUpIdeaBook(c.db, c.bookRef, args);
    recon(c);
    await catchUpIdeaBook(c.db, c.bookRef, args);
    recon(c);
    return c;
  }
  it('held through the catch-up; the 3:2 re-listed live under the same id settles nothing; the founder\'s 5:4 is accepted and applied once', async () => {
    const c = await disagreement();
    let idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([SHARES, SHARES]);
    const record = unsettledConflicts(idea.ledger)[0];
    expect(record).toMatchObject({ actionId: `split_AAPL_${S[4]}` });
    expect(record.kinds).toEqual(expect.arrayContaining(['conflict', 'archive_backfill']));
    expect(rowOf(c, 22).fullQuality).toBe(false);
    // Astra's S23: the backfill's 3:2 re-listed live, alone, under the same id.
    await close(c, 23, 80, [spl(4, '3/2')]);
    idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) expect(idea[f].holdings.AAPL.shares, f).toBe(SHARES);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(SHARES);
    expect(unsettledConflicts(idea.ledger).map((r) => r.actionId)).toEqual([`split_AAPL_${S[4]}`]);
    expect(rowOf(c, 23).fullQuality).toBe(false);
    expect((await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[4]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'c02')).status).toBe(200);
    await close(c, 24, 80, [spl(4, '3/2')]);
    idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) expect(idea[f].holdings.AAPL.shares, f).toBe(124.96251);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(124.96251);
    expect(appliedAndDeclined(idea)).toEqual([]);
  });
  it('an archived session that REPEATS the backfill\'s payload does not settle it during the catch-up either', async () => {
    const c = await disagreement({ archivedS5: [spl(4, '3/2')] });
    const idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([SHARES, SHARES]);
    expect(unsettledConflicts(idea.ledger).map((r) => r.actionId)).toEqual([`split_AAPL_${S[4]}`]);
    expect(rowOf(c, 22).fullQuality).toBe(false);
    expect((await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[4]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'c02b')).status).toBe(200);
  });
});

// ── T2D-C03 · one failed coverage day changes nothing the founder may rule ────────────────────────────────────────────────

describe('T2D-C03 — the overlap, then the new row alone, then the old row alone: the same state, the same ruling, the same money, covered or not', () => {
  async function arm(uncovered) {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    if (uncovered) await uncoveredClose(c, 2, 100, [div(1, 1), div(2, 2)]);
    else await close(c, 2, 100, [div(1, 1), div(2, 2)]);
    await close(c, 3, 100, [div(2, 2)]);
    await close(c, 4, 100, [div(1, 1)]);
    const before = ideaOf(c);
    const ruled = await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'c03', false);
    await close(c, 5);
    await close(c, 6);
    return { c, before, ruled, after: ideaOf(c) };
  }
  it('both arms: the old conflict open and the new row a possible re-date before the ruling; the founder\'s $1 accepted in both; $99.97 paid in both', async () => {
    const covered = await arm(false);
    const failedDay = await arm(true);
    for (const { before, ruled, after, c } of [covered, failedDay]) {
      expect(unsettledConflicts(before.ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
      expect(unsettledRedates(before.ledger).map((r) => [r.actionId, r.redateOf])).toEqual([[`cash_dividend_AAPL_${S[2]}`, `cash_dividend_AAPL_${S[1]}`]]);
      expect(before.ledger.corporateActionReceipts.filter((r) => r.reason === 'settled_by_redate')).toEqual([]);
      expect(divs(before)).toEqual([0, 0]);
      expect(ruled.status).toBe(200);
      expect(divs(after)).toEqual([99.97, 99.97]);
      expect(appliedAndDeclined(after)).toEqual([]);
      expect(heldActionRecords(after.ledger)).toEqual([]);
      expect(rowOf(c, 6).fullQuality).toBe(false); // the possible re-date still waits for its own ruling
    }
    expect(bookOf(failedDay.c).portfolio.cash).toBe(bookOf(covered.c).portfolio.cash);
  });
});

// ── T2D-C04 · the gap screen's dry run uses the holding's real state ─────────────────────────────────────────────────────

describe('T2D-C04 — a split coverage keeps from applying is not simulated: the halving seen at the uncovered close is recorded', () => {
  /** $100, $50, $25 (uncovered: a $1.50 dividend dated there), $50; a 2:1 dated S[1] first listed at S[2] or at S[3]. */
  async function path({ splitFirstAt, dividendFirstAt = 2, priceMoveRuling = false }) {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    const rowsAt = (i) => [...(i >= dividendFirstAt ? [div(2, 1.5)] : []), ...(i >= splitFirstAt ? [spl(1, '2/1')] : [])];
    await uncoveredClose(c, 2, 25, rowsAt(2));
    const record = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    if (priceMoveRuling) expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'price_move' }, 'c04')).status).toBe(200);
    await close(c, 3, 50, rowsAt(3));
    await close(c, 4, 50, rowsAt(4));
    return { c, record, idea: ideaOf(c) };
  }
  it.each([
    ['the split first listed at the uncovered close', { splitFirstAt: 2 }],
    ['the split first listed at the recovery', { splitFirstAt: 3 }],
    ['the dividend first reported at the recovery', { splitFirstAt: 2, dividendFirstAt: 3 }],
    ['a founder price_move on the first drop during the gap', { splitFirstAt: 2, priceMoveRuling: true }],
  ])('%s: the S[2] halving is recorded at the uncovered close, stands after the recovery, and the dividend dated in it is not paid', async (_name, opts) => {
    const { c, record, idea } = await path(opts);
    expect(record.transitions).toEqual([expect.objectContaining({ session: S[2], since: S[1], ratio: 0.5, uncovered: true })]);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(idea[f].holdings.AAPL.shares, f).toBe(199.940016);
      expect(idea[f].holdings.AAPL.basisSuspicion, f).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 0.5 });
      expect(idea[f].dividendsUsd, f).toBe(0);
    }
    expect(rowOf(c, 4).fullQuality).toBe(false);
  });
});

// ── T2D-C05 · rulings and feed rows are per ledger ────────────────────────────────────────────────────────────────────────

describe('T2D-C05 — an idea-only conflict leaves a genuine backfill row to the comparison that holds no record of its id', () => {
  /** The frozen-basket idea; the $1/$2 conflict at S[1]; only the IDEA keeps the receipt (Astra's alteration). */
  async function basket() {
    const ctx = await seedBook();
    const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL'], capitalUsd: 20000, comparison: { type: 'frozen_basket', symbols: ['AAPL', 'MSFT'] } }), quotes: q(), date: S[0] });
    const c = { ...ctx, ideaId: a.ideaId };
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    const idea = ideaOf(c);
    idea.comparisonLedger.corporateActionReceipts = idea.comparisonLedger.corporateActionReceipts.filter((r) => r.reason !== 'conflicting_action');
    await c.db.doc(`mandates/${c.bookId}/ideas/${c.ideaId}`).set(idea);
    // A successful stored backfill whose genuine row for that id is $1.50 (the catch-up reads it at every session).
    await c.db.doc('practiceFieldCaBackfill/AAPL').set({ schemaVersion: 1, symbol: 'AAPL', from: S[1], to: S[2], failed: false, actions: [div(1, 1.5)], calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
    return c;
  }
  it('the founder picks $2 for the idea: on the ruling close the idea is credited $399.88 and the comparison its own $149.96 — cash and value dated that close', async () => {
    const c = await basket();
    const s1 = rowOf(c, 1);
    expect((await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'c05')).status).toBe(200);
    await storeCloseSnapshot(c.db, S[2], q(100));
    await catchUpIdeaBook(c.db, c.bookRef, { before: S[3], now: closeNowOf(S[3]) });
    recon(c);
    const idea = ideaOf(c);
    const cmpShares = idea.comparisonLedger.holdings.AAPL.shares;
    expect(cmpShares).toBe(SHARES);
    expect(idea.ledger.dividendsUsd).toBe(399.88);
    expect(idea.comparisonLedger.dividendsUsd).toBe(149.96);
    const row = rowOf(c, 2);
    expect(row.comparisonCash).toBe(Math.round((s1.comparisonCash + 149.96) * 100) / 100);
    expect(row.comparisonMarkedValue).toBe(Math.round((s1.comparisonMarkedValue + 149.96) * 100) / 100);
    expect(row.comparisonMarkedValue).toBe(20143.96);
    const cmp = idea.comparisonLedger.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[1]}` && r.applied);
    expect(cmp).toMatchObject({ amount: 1.5, source: 'eodhd_dividends' });
    expect(cmp.founderRuling).toBeUndefined();
    expect(idea.ledger.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[1]}` && r.applied)).toMatchObject({ amount: 2, founderRuling: expect.objectContaining({ requestKey: 'c05' }) });
  });
  it('without a ruling: the comparison is paid its genuine row at once; the idea\'s conflict waits, and the backfill\'s payload joins its record', async () => {
    const c = await basket();
    await storeCloseSnapshot(c.db, S[2], q(100));
    await catchUpIdeaBook(c.db, c.bookRef, { before: S[3], now: closeNowOf(S[3]) });
    recon(c);
    const idea = ideaOf(c);
    expect(idea.comparisonLedger.dividendsUsd).toBe(149.96);
    expect(idea.ledger.dividendsUsd).toBe(0);
    const record = unsettledConflicts(idea.ledger)[0];
    expect(record.rows.map((r) => r.amount)).toEqual([1, 2, 1.5]);
    expect(record.kinds).toEqual(expect.arrayContaining(['archive_backfill']));
  });
});

// ── Rev 1's own rules ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Amendment F rev 1 — S-2: once ambiguous, only the founder settles it', () => {
  it('a share-basis conflict, then ONE consistent row for five closes: nothing applies, the sale and the quality stay held; the founder\'s ruling applies it once', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4')]);
    for (let i = 2; i <= 6; i += 1) {
      await close(c, i, 100 / 1.5, [spl(1, '3/2')]);
      const idea = ideaOf(c);
      expect(idea.ledger.holdings.AAPL.shares, S[i]).toBe(SHARES);
      expect(rowOf(c, i).fullQuality, S[i]).toBe(false);
      expect(saleHeldBackBy(idea.ledger, 'AAPL', { symbols: {} }, { date: S[i + 1] })).not.toBe(null);
    }
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 's2');
    await close(c, 7, 100 / 1.5, [spl(1, '3/2')]);
    await close(c, 8, 100 / 1.5, [spl(1, '3/2')]);
    expect(ideaOf(c).ledger.holdings.AAPL.shares).toBe(149.955012);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(149.955012);
    expect(rowOf(c, 8).fullQuality).toBe(true);
  });

  it('S-1 ②: a dividend HELD at an uncovered close, then listed with a different amount: a revision — ambiguous, never paid at either amount until ruled', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, [div(1, 1)]);
    expect(heldActionRecords(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    const out = await close(c, 2, 100, [div(1, 1.25)]);
    let idea = ideaOf(c);
    expect(divs(idea)).toEqual([0, 0]);
    expect(heldActionRecords(idea.ledger)).toEqual([]);
    expect(unsettledConflicts(idea.ledger)[0]).toMatchObject({ actionId: `cash_dividend_AAPL_${S[1]}`, kinds: ['revision'] });
    expect(unsettledConflicts(idea.ledger)[0].rows.map((r) => r.amount)).toEqual([1, 1.25]);
    expect(out.alerts.some((a) => a.startsWith(`PRACTICE_FIELD_CORPORATE_ACTION_AMBIGUOUS ${c.ideaId} idea AAPL cash_dividend_AAPL_${S[1]} — revision`))).toBe(true);
    await close(c, 3, 100, [div(1, 1)]);
    expect(divs(ideaOf(c))).toEqual([0, 0]);
    await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'rev');
    await close(c, 4, 100, [div(1, 1.25)]);
    idea = ideaOf(c);
    expect(divs(idea)).toEqual([99.97, 99.97]);
  });

  it('S-1 ③: a new-date row matching a HELD row makes both ambiguous — the held one no longer replays when its doubt clears', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, [div(1, 1)]);
    await close(c, 2, 100, [div(2, 1)]);
    const idea = ideaOf(c);
    expect(unsettledRedates(idea.ledger).map((r) => [r.actionId, r.redateOf]).sort()).toEqual([
      [`cash_dividend_AAPL_${S[1]}`, `cash_dividend_AAPL_${S[2]}`],
      [`cash_dividend_AAPL_${S[2]}`, `cash_dividend_AAPL_${S[1]}`],
    ]);
    expect(heldActionRecords(idea.ledger)).toEqual([]);
    await close(c, 3);
    expect(divs(ideaOf(c))).toEqual([0, 0]);
  });

  it('S-2, last paragraph: a ruled id later listed with a payload the ruling did not see is a new ambiguity; a payload it did see reopens nothing', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'r1');
    await close(c, 2, 100, [div(1, 1), div(1, 2)]);
    // The feed still lists both payloads the ruling saw: nothing reopens (the reading this round builds; see the report).
    await close(c, 3, 100, [div(1, 1), div(1, 2)]);
    expect(openRulingRevisions(ideaOf(c).ledger)).toEqual([]);
    expect(rowOf(c, 3).fullQuality).toBe(true);
    // A third payload the ruling never saw: a new ambiguity — alerted, the row below full quality; the money stays.
    const out = await close(c, 4, 100, [div(1, 3)]);
    const idea = ideaOf(c);
    expect(openRulingRevisions(idea.ledger)).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${S[1]}`, ruling: 'r1', rows: [expect.objectContaining({ amount: 3 })] })]);
    expect(divs(idea)).toEqual([99.97, 99.97]);
    expect(rowOf(c, 4).fullQuality).toBe(false);
    expect(out.alerts.some((a) => a.includes(`cash_dividend_AAPL_${S[1]} — revised_after_ruling`))).toBe(true);
    // An answer that would undo the money (an adjustment, T1a-2b-4's) is refused; the ruled outcome again closes it.
    const undo = await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 3 } }, 'r2', false);
    expect(undo).toMatchObject({ status: 422, body: { error: 'ruling_needs_adjustment' } });
    await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'r3');
    await close(c, 5, 100, [div(1, 3)]);
    expect(openRulingRevisions(ideaOf(c).ledger)).toEqual([]);
    expect(divs(ideaOf(c))).toEqual([99.97, 99.97]);
    expect(rowOf(c, 5).fullQuality).toBe(true);
  });

  it('S-2, a SPLIT revised after its ruling: the count is in doubt again — what depends on it waits, the sale waits, the endpoint names it — until the founder answers', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4')]);
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'split-r1');
    await close(c, 2, 100 / 1.5, [spl(1, '3/2')]);
    expect(ideaOf(c).ledger.holdings.AAPL.shares).toBe(149.955012);
    // The vendor now lists 7:4 for that id, and a dividend dated after it.
    await close(c, 3, 100 / 1.5, [spl(1, '7/4'), div(3, 1)]);
    let idea = ideaOf(c);
    expect(openRulingRevisions(idea.ledger)).toEqual([expect.objectContaining({ actionId: `split_AAPL_${S[1]}`, ruling: 'split-r1' })]);
    expect(idea.ledger.holdings.AAPL.shares).toBe(149.955012); // the money the ruling moved stays
    expect(divs(idea)).toEqual([0, 0]);
    expect(heldActionRecords(idea.ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[3]}`]);
    expect(rowOf(c, 3).fullQuality).toBe(false);
    expect(saleHeldBackBy(idea.ledger, 'AAPL', { symbols: {} }, { date: S[4] })).toBe('corporate_action_unsettled');
    expect(ledgerDoubts(idea.ledger).find((x) => x.symbol === 'AAPL').reasons).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'revised_after_ruling', actionId: `split_AAPL_${S[1]}` })]));
    // The founder answers with the ruled outcome: the record closes, the count is trusted again, the dividend is paid once.
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'split-r2');
    await close(c, 4, 100 / 1.5, [spl(1, '7/4'), div(3, 1)]);
    idea = ideaOf(c);
    expect(openRulingRevisions(idea.ledger)).toEqual([]);
    expect(divs(idea)).toEqual([149.96, 149.96]);
    expect(rowOf(c, 4).fullQuality).toBe(true);
  });

  it('a possible re-date whose own id later shows a second payload: the founder may choose the payload first seen later (every payload of the record is choosable)', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    await close(c, 2, 100, [div(1, 1), div(2, 1)]);
    expect(unsettledRedates(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[2]}`]);
    await close(c, 3, 100, [div(2, 4)]);
    expect(unsettledRedates(ideaOf(c).ledger)[0].rows.map((r) => r.amount)).toEqual([1, 4]);
    expect((await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[2]}`, decision: 'payload', payload: { amount: 4 } }, 'redate-4')).status).toBe(200);
    await close(c, 4, 100, [div(2, 4)]);
    expect(divs(ideaOf(c))).toEqual([499.85, 499.85]); // $1 on S[1] (never ambiguous) and the founder's $4 on S[2]
  });

  it('S-3: an action that was never ambiguous is applied exactly as before — one payload, covered, no re-date', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    await close(c, 2, 100 / 1.5, [spl(2, '3/2')]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([99.97, 99.97]);
    expect(idea.ledger.holdings.AAPL.shares).toBe(149.955012);
    expect(rowOf(c, 2).fullQuality).toBe(true);
  });
});

// ── AR2: the fix round's own adversarial review (lenses A, B, C) — each reproduction as a row, with rev 1's outcome ─────

describe('AR2 — the review of fix round 2: each probe as a row', () => {
  const ren = (i, to) => ({ type: 'ticker_change', ticker: 'AAPL', renamedTo: to, effectiveDate: S[i], source: 'eodhd' });
  const dl = (i, cash) => ({ type: 'delisting', ticker: 'AAPL', effectiveDate: S[i], cashPerShare: cash, source: 'eodhd' });
  const qx = (p = 100, a = []) => ({ ...q(p, a), AAPX: { price: 100, marketCap: 3e12 }, AAPY: { price: 120, marketCap: 3e12 } });
  const closeX = async (c, i, p = 100, a = []) => { const out = await closeOn(c.db, c.bookId, S[i], qx(p, a)); recon(c); return out; };
  async function uncoveredX(c, i, p, a = []) {
    await storeCloseSnapshot(c.db, S[i], qx(p, a));
    failed(c, i);
    await raw(c, i);
    recon(c);
  }
  const backfill = (c, from, to, actions, failedFetch = false) => c.db.doc('practiceFieldCaBackfill/AAPL').set({ schemaVersion: 1, symbol: 'AAPL', from: S[from], to: S[to], failed: failedFetch, actions, calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
  const ID1 = `cash_dividend_AAPL_${S[1]}`;

  it('AR2-C-1: a payload listed at the very close a ruling applies is one the ruling did not see — a new ambiguity, alerted, below full quality', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await rule(c, { kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, 'c1');
    const out = await close(c, 2, 100, [div(1, 3)]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([99.97, 99.97]); // the founder's ruling is applied as made
    expect(openRulingRevisions(idea.ledger)).toEqual([expect.objectContaining({ actionId: ID1, rows: [expect.objectContaining({ amount: 3 })] })]);
    expect(rowOf(c, 2).fullQuality).toBe(false);
    expect(out.alerts.some((a) => a.includes(`${ID1} — revised_after_ruling`))).toBe(true);
  });

  it('AR2-C-1 / AR2-A-5: …and one listed while the ruling waits behind a coverage gap, then dropped by the feed, is kept and reopens it once it applies', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await rule(c, { kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, 'c1b');
    await uncoveredClose(c, 2, 100, [div(1, 3)]);
    await uncoveredClose(c, 3, 100, [div(1, 3)]);
    expect(unsettledConflicts(ideaOf(c).ledger)[0].rows.map((r) => r.amount)).toEqual([1, 2, 3]);
    await close(c, 4);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([99.97, 99.97]);
    expect(openRulingRevisions(idea.ledger).map((r) => r.rows.map((x) => x.amount))).toEqual([[3]]);
    expect(rowOf(c, 4).fullQuality).toBe(false);
  });

  it('AR2-A-1 / AR2-C-2: a founder SPLIT under an id that is ambiguous is refused 409 — the conflict is ruled first; nothing moves', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100);
    await close(c, 2, 50);
    await close(c, 3, 50, [spl(2, '3/2'), spl(2, '5/4')]);
    const out = await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[2]}`, decision: 'split', ratio: 2 }, 'a1', false);
    expect(out).toMatchObject({ status: 409, body: { error: 'record_ambiguous_rule_conflict_first' } });
    await close(c, 4, 50, [spl(2, '3/2'), spl(2, '5/4')]);
    expect(ideaOf(c).ledger.holdings.AAPL.shares).toBe(SHARES);
    expect(unsettledConflicts(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`split_AAPL_${S[2]}`]);
  });

  it.each([
    ['cash ($1/$2, the row $1.50)', [div(1, 1), div(1, 2)], [div(1, 1.5)], ID1],
    ['a split (3:2/5:4, the row 2:1)', [spl(1, '3/2'), spl(1, '5/4')], [spl(1, '2/1')], `split_AAPL_${S[1]}`],
  ])('AR2-A-1 1b / AR2-B-1: a coverage-gap ROW of an ambiguous id is refused 409 — %s', async (_name, rows, bf, id) => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, rows);
    await backfill(c, 1, 1, bf);
    expect(await rule(c, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId: id }, 'b1', false)).toMatchObject({ status: 409, body: { error: 'row_ambiguous_rule_conflict' } });
    await close(c, 2, 100);
    await close(c, 3, 100);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([0, 0]);
    expect(idea.ledger.holdings.AAPL.shares).toBe(SHARES);
    expect(unsettledConflicts(idea.ledger).map((r) => r.actionId)).toEqual([id]);
    expect(rowOf(c, 3).fullQuality).toBe(false);
  });

  it('AR2-A-1 1c: a coverage-gap row of a POSSIBLE RE-DATE is refused 409 — no second payment of the same dividend', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    for (let i = 2; i <= 7; i += 1) await uncoveredClose(c, i, 100, i >= 3 ? [div(3, 1)] : []);
    expect(unsettledRedates(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[3]}`]);
    await backfill(c, 2, 7, [div(3, 1)], true);
    expect(await rule(c, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[1]}`, decision: 'row', actionId: `cash_dividend_AAPL_${S[3]}` }, 'b1c', false)).toMatchObject({ status: 409 });
    await close(c, 8);
    expect(divs(ideaOf(c))).toEqual([99.97, 99.97]);
  });

  it('AR2-A-2: a waiting rename whose id became ambiguous is not applied from its record — the holding waits for the founder, who names the target', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredX(c, 1, 100, [ren(1, 'AAPX')]);
    await closeX(c, 2, 100, [ren(1, 'AAPX'), ren(1, 'AAPY')]);
    await closeX(c, 3, 100, [ren(1, 'AAPY')]);
    await closeX(c, 4);
    let idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) expect(Object.keys(idea[f].holdings).sort(), f).toEqual(['AAPL', 'MSFT']);
    expect(Object.keys(bookOf(c).portfolio.positions).sort()).toEqual(['AAPL', 'MSFT']);
    expect(rowOf(c, 4).fullQuality).toBe(false);
    expect((await rule(c, { kind: 'conflict', recordId: `ticker_change_AAPL_${S[1]}`, decision: 'payload', payload: { renamedTo: 'AAPY' } }, 'a2')).status).toBe(200);
    await closeX(c, 5);
    idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) expect(Object.keys(idea[f].holdings).sort(), f).toEqual(['AAPY', 'MSFT']);
    expect(Object.keys(bookOf(c).portfolio.positions).sort()).toEqual(['AAPY', 'MSFT']);
  });

  it('AR2-A-3: a waiting rename listed again with ANOTHER target is a revision — ambiguous, not applied; `none` is accepted', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredX(c, 1, 100, [ren(1, 'AAPX')]);
    await closeX(c, 2, 100, [ren(1, 'AAPY')]);
    await closeX(c, 3);
    const idea = ideaOf(c);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['AAPL', 'MSFT']);
    expect(unsettledConflicts(idea.ledger)[0]).toMatchObject({ actionId: `ticker_change_AAPL_${S[1]}`, kinds: ['revision'] });
    expect(rowOf(c, 3).fullQuality).toBe(false);
    expect((await rule(c, { kind: 'conflict', recordId: `ticker_change_AAPL_${S[1]}`, decision: 'none' }, 'a3')).status).toBe(200);
  });

  it('AR2-A-4: a conflict ruling names a delisting\'s cash — one never recorded is refused 422; the recorded $12 is credited once', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [dl(1, 10), dl(1, 12)]);
    const id = `delisting_AAPL_${S[1]}`;
    expect(await rule(c, { kind: 'conflict', recordId: id, decision: 'payload', payload: { cashPerShare: 999 } }, 'a4x', false)).toMatchObject({ status: 422, body: { error: 'payload_not_recorded' } });
    expect((await rule(c, { kind: 'conflict', recordId: id, decision: 'payload', payload: { cashPerShare: 12 } }, 'a4')).status).toBe(200);
    await close(c, 2, 100, [dl(1, 10), dl(1, 12)]);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL).toBeUndefined();
    expect(idea.ledger.corporateActionReceipts.filter((r) => r.actionId === id && r.applied)).toEqual([expect.objectContaining({ cashPerShare: 12, cashUsd: 1199.64, founderRuling: expect.objectContaining({ kind: 'conflict' }) })]);
  });

  /** Astra's asymmetric state (T2D-09, C05): only the idea keeps the split conflict W of S[1]. */
  async function ideaOnlySplitConflict(price) {
    const c = await start();
    await close(c, 0);
    await close(c, 1, price, [spl(1, '3/2'), spl(1, '5/4')]);
    const idea = ideaOf(c);
    idea.comparisonLedger.corporateActionReceipts = idea.comparisonLedger.corporateActionReceipts.filter((r) => r.reason !== 'conflicting_action');
    await c.db.doc(`mandates/${c.bookId}/ideas/${c.ideaId}`).set(idea);
    return c;
  }
  it('AR2-B-2 (planted): a split the idea\'s doubt keeps from applying on the comparison is not simulated there either — no record is retired by it', async () => {
    const c = await ideaOnlySplitConflict(100);
    const X = `split_AAPL_${S[2]}`;
    await close(c, 2, 50);
    await close(c, 3, 25, [spl(2, '2/1'), div(3, 1)]);
    const idea = ideaOf(c);
    expect(idea.comparisonLedger.holdings.AAPL.heldActions.map((r) => r.actionId)).toContain(X);
    expect(idea.comparisonLedger.holdings.AAPL.basisSuspicionHistory ?? []).toEqual([]);
    expect(idea.comparisonLedger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2] });
    expect(idea.ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2] });
  });
  it('AR2-B-3 (planted): a same-stock comparison waits on the idea\'s doubt of the same split id — the pair stays tied and the close is not refused', async () => {
    const c = await ideaOnlySplitConflict(100 / 1.5);
    await close(c, 2, 100 / 1.5, [spl(1, '3/2')]);
    const idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([SHARES, SHARES, SHARES]);
    expect(rowOf(c, 2).fullQuality).toBe(false);
  });

  it('AR2-C-3 (a reading, put to the founder): after `none`, a revised payload cannot be chosen — 422; only `none` again closes it', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await rule(c, { kind: 'conflict', recordId: ID1, decision: 'none' }, 'c3');
    await close(c, 2, 100, [div(1, 1), div(1, 2)]);
    await close(c, 3, 100, [div(1, 3)]);
    expect(await rule(c, { kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 3 } }, 'c3b', false)).toMatchObject({ status: 422, body: { error: 'ruling_needs_adjustment' } });
    expect((await rule(c, { kind: 'conflict', recordId: ID1, decision: 'none' }, 'c3c')).status).toBe(200);
  });
});

// ── AR2-RF: the final refuter on the review's fixes — each probe as a row ──────────────────────────────────────────────

describe('AR2-RF — the final refuter on the fixes: each probe as a row', () => {
  const ren = (i, to) => ({ type: 'ticker_change', ticker: 'AAPL', renamedTo: to, effectiveDate: S[i], source: 'eodhd' });
  const dl = (i, cash) => ({ type: 'delisting', ticker: 'AAPL', effectiveDate: S[i], cashPerShare: cash, source: 'eodhd' });
  const qx = (p = 100, a = []) => ({ ...q(p, a), AAPX: { price: 100, marketCap: 3e12 }, AAPY: { price: 120, marketCap: 3e12 } });
  const closeX = async (c, i, p = 100, a = []) => { const out = await closeOn(c.db, c.bookId, S[i], qx(p, a)); recon(c); return out; };
  const backfill = (c, actions) => c.db.doc('practiceFieldCaBackfill/AAPL').set({ schemaVersion: 1, symbol: 'AAPL', from: S[1], to: S[1], failed: true, actions, calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
  const ID1 = `cash_dividend_AAPL_${S[1]}`;
  const RID = `ticker_change_AAPL_${S[1]}`;

  it.each([
    ['cash: the founder\'s $1 row, the daily layer\'s $2', [div(1, 1)], ID1, (c) => close(c, 2, 100, [div(1, 2)]), [1, 2]],
    ['a split: the founder\'s 3:2 row, the daily layer\'s 2:1', [spl(1, '3/2')], `split_AAPL_${S[1]}`, (c) => close(c, 2, 50, [spl(1, '2/1')]), [1.5, 2]],
  ])('AR2-RF-1: a coverage-gap ROW and a different daily row under one id are a CONFLICT — %s: nothing applied, both payloads choosable', async (_name, bf, id, closeTwo, payloads) => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, []);
    await backfill(c, bf);
    await rule(c, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId: id }, 'rf1');
    await closeTwo(c);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([0, 0]);
    expect(idea.ledger.holdings.AAPL.shares).toBe(SHARES);
    const record = unsettledConflicts(idea.ledger).find((r) => r.actionId === id);
    expect(record.rows.map((r) => r.ratio ?? r.amount).sort()).toEqual(payloads);
    expect(rowOf(c, 2).fullQuality).toBe(false);
    // The founder's own payload is choosable on the record (before: 422 payload_not_recorded once it was dropped).
    const p = bf[0].ratio != null ? { ratio: bf[0].ratio } : { amount: bf[0].amount };
    expect((await rule(c, { kind: 'conflict', recordId: id, decision: 'payload', payload: p }, 'rf1b')).status).toBe(200);
  });

  it('AR2-RF-2: a founder rename into a ticker another idea holds is refused at the close — the ruling closes with its reason and the record takes another', async () => {
    const ctx = await seedBook();
    const [a] = await admitAllThenEnter(ctx.db, ctx.bookId, [
      { contract: contractOf({ names: ['AAPL'], capitalUsd: 20000 }), opId: 'idea-1', quotes: qx(), date: S[0] },
      { contract: contractOf({ slot: 'medium', names: ['MSFT'], capitalUsd: 15000 }), opId: 'idea-2', quotes: qx(), date: S[0], slot: 'midday' },
    ]);
    const c = { ...ctx, ideaId: a.ideaId };
    await closeX(c, 0);
    await closeX(c, 1, 100, [ren(1, 'AAPX'), ren(1, 'MSFT')]);
    await rule(c, { kind: 'conflict', recordId: RID, decision: 'payload', payload: { renamedTo: 'MSFT' } }, 'rf2');
    const out = await closeX(c, 2);
    expect(Object.keys(ideaOf(c).ledger.holdings)).toEqual(['AAPL']);
    expect(ideaOf(c).founderRulings.find((r) => r.requestKey === 'rf2')).toMatchObject({ appliedOn: S[2], outcome: 'refused', refusedBecause: 'rename_target_taken' });
    expect(out.alerts.some((x) => x.startsWith(`PRACTICE_FIELD_HOLD_RULING_REFUSED ${c.ideaId} ${RID}`))).toBe(true);
    expect((await rule(c, { kind: 'conflict', recordId: RID, decision: 'payload', payload: { renamedTo: 'AAPX' } }, 'rf2b')).status).toBe(200);
    await closeX(c, 3);
    expect(Object.keys(ideaOf(c).ledger.holdings)).toEqual(['AAPX']);
  });

  it('AR2-RF-3: a rename target the vendor writes in lower case is the same target — the ruling that chose it is not reopened', async () => {
    const c = await start();
    await close(c, 0);
    await closeX(c, 1, 100, [ren(1, 'aapx'), ren(1, 'aapy')]);
    await rule(c, { kind: 'conflict', recordId: RID, decision: 'payload', payload: { renamedTo: 'AAPY' } }, 'rf3');
    await closeX(c, 2, 100, [ren(1, 'aapx'), ren(1, 'aapy')]);
    await closeX(c, 3, 100, [ren(1, 'aapx'), ren(1, 'aapy')]);
    const idea = ideaOf(c);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['AAPY', 'MSFT']);
    expect(openRulingRevisions(idea.ledger)).toEqual([]);
    expect([rowOf(c, 2).fullQuality, rowOf(c, 3).fullQuality]).toEqual([true, true]);
  });

  it('AR2-RF-4: a rename ruling whose holding a cash delisting closed first is MOOT (alerted), not "applied"; `none` then closes the record', async () => {
    const c = await start();
    await close(c, 0);
    await closeX(c, 1, 100, [ren(1, 'AAPX'), ren(1, 'AAPY')]);
    await rule(c, { kind: 'conflict', recordId: RID, decision: 'payload', payload: { renamedTo: 'AAPY' } }, 'rf4');
    const out = await closeX(c, 2, 100, [dl(2, 12)]);
    const idea = ideaOf(c);
    expect(Object.keys(idea.ledger.holdings)).toEqual(['MSFT']);
    expect(idea.founderRulings.find((r) => r.requestKey === 'rf4')).toMatchObject({ appliedOn: S[2], outcome: 'moot' });
    expect(out.alerts.some((x) => x.startsWith(`PRACTICE_FIELD_HOLD_RULING_MOOT ${c.ideaId} ${RID}`))).toBe(true);
    expect((await rule(c, { kind: 'conflict', recordId: RID, decision: 'none' }, 'rf4b')).status).toBe(200);
    await closeX(c, 3);
    expect(rowOf(c, 3).fullQuality).toBe(true);
  });
});

// ── Rows the round's mutation battery asked for (a survivor each), with the outcome rev 1 gives ──────────────────────────

describe('the battery\'s rows (AR2-M05, -M06, -M07, -M13, -M31, -M34)', () => {
  it('AR2-M05: a NOT-ENTITLED conflict re-listed with one payload is not declined by the feed — it stays open for the founder', async () => {
    const c = await start();
    await close(c, 0, 100, [div(0, 1), div(0, 2)]);
    await close(c, 1, 100, [div(0, 1)]);
    const idea = ideaOf(c);
    expect(idea.ledger.declinedActionIds).toEqual([]);
    expect(unsettledConflicts(idea.ledger).map((r) => [r.actionId, r.entitled])).toEqual([[`cash_dividend_AAPL_${S[0]}`, false]]);
    expect(rowOf(c, 1).fullQuality).toBe(false);
  });

  it('AR2-M06 / -M07: a not-entitled row (dated the purchase day) repeating a dividend HELD at an uncovered close makes both ambiguous — neither is paid', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, [div(1, 1)]);
    expect(heldActionRecords(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    // The vendor moves the dividend to the purchase day (the holding is not entitled to that one) and drops the old row.
    await close(c, 2, 100, [div(0, 1)]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([0, 0]);
    expect(idea.ledger.declinedActionIds).toEqual([]);
    expect(unsettledRedates(idea.ledger).map((r) => [r.actionId, r.redateOf]).sort()).toEqual([
      [`cash_dividend_AAPL_${S[0]}`, `cash_dividend_AAPL_${S[1]}`],
      [`cash_dividend_AAPL_${S[1]}`, `cash_dividend_AAPL_${S[0]}`],
    ]);
    expect(heldActionRecords(idea.ledger)).toEqual([]);
  });

  it('AR2-M13: an AMBIGUOUS split that would explain a suspicion explains nothing — a dividend dated inside the gap, before the split, still waits', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, []);
    await close(c, 2, 50);
    expect(ideaOf(c).ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2], since: S[0] });
    await close(c, 3, 50, [spl(2, '2/1'), spl(2, '3/1'), div(1, 1)]);
    await close(c, 4, 50, [spl(2, '2/1'), div(1, 1)]);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(SHARES);
    expect(divs(idea)).toEqual([0, 0]);
    expect(rowOf(c, 4).fullQuality).toBe(false);
  });

  it('AR2-M31: a ruled split revised later holds the sale by itself (no other doubt on the holding)', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4')]);
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'm31');
    await close(c, 2, 100 / 1.5, [spl(1, '3/2')]);
    await close(c, 3, 100 / 1.5, [spl(1, '7/4')]);
    const idea = ideaOf(c);
    expect(heldActionRecords(idea.ledger)).toEqual([]);
    expect(openRulingRevisions(idea.ledger)).toHaveLength(1);
    expect(saleHeldBackBy(idea.ledger, 'AAPL', { symbols: {} }, { date: S[4] })).toBe('corporate_action_unsettled');
  });

  it('AR2-M34: a founder coverage-gap row HELD behind another doubt, then a different feed payload under its id: a revision — neither paid until the founder rules', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4')]);
    await c.db.doc('practiceFieldCaBackfill/AAPL').set({ schemaVersion: 1, symbol: 'AAPL', from: S[1], to: S[1], failed: true, actions: [div(1, 1)], calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
    await rule(c, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId: ID_DIV1 }, 'm34');
    await close(c, 2, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4')]);
    expect(heldActionRecords(ideaOf(c).ledger).map((r) => [r.actionId, r.amount])).toEqual([[ID_DIV1, 1]]);
    await close(c, 3, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4'), div(1, 2)]);
    expect(unsettledConflicts(ideaOf(c).ledger).find((r) => r.actionId === ID_DIV1)).toMatchObject({ kinds: ['revision'] });
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'm34-split');
    await close(c, 4, 100 / 1.5, [div(1, 2)]);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(149.955012);
    expect(divs(idea)).toEqual([0, 0]);
    expect(unsettledConflicts(idea.ledger).find((r) => r.actionId === ID_DIV1).rows.map((r) => r.amount)).toEqual([1, 2]);
  });
});
const ID_DIV1 = `cash_dividend_AAPL_${S[1]}`;

// ── Astra's round 2 (docs/audits/20261119_ASTRA_CONFIRMATION_T1A2B3_ROUND2.md, Run:101): the battery's three "equivalent"
// survivors are not equivalent. Each history below is ordinary entries, parsed rows and real closes; each assertion passes on
// the shipped source and fails only under its mutant (AR2-M07, AR2-M11, AR2-M34 in the battery).

describe('Astra round 2 — the distinguishing histories of AR2-M07, AR2-M11 and AR2-M34', () => {
  it('AR2-M07: a dividend held at an uncovered close meets a new conflict and a not-entitled row of its payload — its re-date receipt links the not-entitled row (the audit link), and nothing is paid', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, [div(1, 1)]);
    expect(heldActionRecords(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([ID_DIV1]);
    // Nov 18: a dividend listed two ways ($1/$2), and the $1 under the purchase day (not entitled).
    await close(c, 2, 100, [div(2, 1), div(2, 2), div(0, 1)]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([0, 0]);
    const held = idea.ledger.corporateActionReceipts.find((r) => r.actionId === ID_DIV1 && r.reason === 'possible_redate');
    expect(held?.redateOf, 'the held Nov 17 row is paired with the row that found it (Nov 16), not with the Nov 18 conflict').toBe(`cash_dividend_AAPL_${S[0]}`);
  });

  it('AR2-M11: a dividend held into an uncovered close where a 2:1 split of its date first appears — its hold names the gap and the split on BOTH the idea and the comparison', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, [div(1, 1)]);
    await uncoveredClose(c, 2, 50, [div(1, 1), spl(1, '2/1')]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([0, 0]);
    for (const f of ['ledger', 'comparisonLedger']) {
      const rec = idea[f].holdings.AAPL.heldActions.find((r) => r.actionId === ID_DIV1);
      const causes = rec.heldBecause.map((i) => `${i.type}:${i.ledger}`).sort();
      expect(causes, f).toEqual(expect.arrayContaining(['ca_coverage_gap:idea', 'split:idea', 'split:comparison']));
    }
  });

  it('AR2-M34: a live $1 held at a failed fetch, a backfill row of $2 under its id chosen by a coverage-gap ruling — a revision; nothing is paid until a conflict ruling', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, [div(1, 1)]);
    await c.db.doc('practiceFieldCaBackfill/AAPL').set({ schemaVersion: 1, symbol: 'AAPL', from: S[1], to: S[1], failed: true, actions: [div(1, 2)], calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
    await rule(c, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId: ID_DIV1 }, 'r2-m34');
    await close(c, 2, 100, []);
    const idea = ideaOf(c);
    expect(divs(idea), 'the founder chose a row through a coverage-gap ruling, not a conflict ruling').toEqual([0, 0]);
    expect(unsettledConflicts(idea.ledger).find((r) => r.actionId === ID_DIV1)?.rows.map((r) => r.amount)).toEqual([1, 2]);
    expect(bookOf(c).portfolio.cash).toBe(80000);
  });
});

// ── Rows the S-6 soak found (the founder's 5,000-sequence run), each with the outcome rev 1 gives ─────────────────────────

describe('the S-6 soak\'s findings', () => {
  it('SOAK-1 (wide seed 26): a ratio a ruled split showed SINCE its ruling, re-dated under a new id, is a possible re-date — never applied as a fresh split', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4'), spl(1, '3/1')]);
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'none' }, 'soak1');
    await close(c, 2, 80, [spl(1, '5/4'), spl(1, '3/1')]);
    await close(c, 3, 50, [spl(1, '2/1')]); // a ratio the ruling never saw: revised after the ruling
    expect(openRulingRevisions(ideaOf(c).ledger).map((r) => r.rows.map((x) => x.ratio))).toEqual([[2]]);
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'none' }, 'soak1b');
    await close(c, 4, 50, [spl(4, '2/1')]); // the same 2:1 under a moved date
    const idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([SHARES, SHARES, SHARES]);
    expect(unsettledRedates(idea.ledger).map((r) => [r.actionId, r.redateOf])).toEqual([[`split_AAPL_${S[4]}`, `split_AAPL_${S[1]}`]]);
    expect(rowOf(c, 4).fullQuality).toBe(false);
  });
});

// ── AR2-IR: the independent refuter over the fixes nothing had reviewed (e35434e0, b040987d, SOAK-1) — each probe a row ──

describe('AR2-IR — the independent refuter on the unreviewed fixes: each probe as a row', () => {
  const ren = (i, to) => ({ type: 'ticker_change', ticker: 'AAPL', renamedTo: to, effectiveDate: S[i], source: 'eodhd' });
  const qxa = (p = 100, a = [], ax = []) => ({ ...q(p, a), AAPX: { price: p, marketCap: 3e12, corporateActions: ax }, AAPY: { price: 120, marketCap: 3e12 } });
  const closeXA = async (c, i, p = 100, a = [], ax = []) => { const out = await closeOn(c.db, c.bookId, S[i], qxa(p, a, ax)); recon(c); return out; };
  const ID1 = `cash_dividend_AAPL_${S[1]}`;
  const RID = `ticker_change_AAPL_${S[1]}`;

  it('AR2-IR-1: a rename ruling into a ticker a named ledger already holds is refused when it is made (422) — the record takes another', async () => {
    const c = await start();
    await close(c, 0);
    await closeXA(c, 1, 100, [ren(1, 'AAPX'), ren(1, 'MSFT')]);
    expect(await rule(c, { kind: 'conflict', recordId: RID, decision: 'payload', payload: { renamedTo: 'MSFT' } }, 'ir1', false)).toMatchObject({ status: 422, body: { error: 'ruling_unrepresentable' } });
    expect((await rule(c, { kind: 'conflict', recordId: RID, decision: 'payload', payload: { renamedTo: 'AAPX' } }, 'ir1b')).status).toBe(200);
    await closeXA(c, 2);
    expect(Object.keys(ideaOf(c).ledger.holdings).sort()).toEqual(['AAPX', 'MSFT']);
    expect(Object.keys(ideaOf(c).comparisonLedger.holdings).sort()).toEqual(['AAPX', 'MSFT']);
  });

  it('AR2-IR-2: a clean rename WAITS while its symbol has an open dividend conflict — the founder\'s ruling then pays the holding it was made for, and the rename follows', async () => {
    const c = await start();
    await close(c, 0);
    await closeXA(c, 1, 100, [div(1, 1), div(1, 2)]);
    await closeXA(c, 2, 100, [ren(2, 'AAPX')]);
    expect(Object.keys(ideaOf(c).ledger.holdings).sort()).toEqual(['AAPL', 'MSFT']);
    expect(ideaOf(c).ledger.holdings.AAPL.deferredRename).toMatchObject({ to: 'AAPX' });
    expect((await rule(c, { kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, 'ir2')).status).toBe(200);
    await closeXA(c, 3);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([99.97, 99.97]);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['AAPX', 'MSFT']);
    expect(idea.founderRulings.find((r) => r.requestKey === 'ir2')).toMatchObject({ appliedOn: S[3] });
    expect(idea.founderRulings.find((r) => r.requestKey === 'ir2').outcome).toBeUndefined();
  });

  it('AR2-IR-3: a conflict formed in one close keeps the payload of a row the holding HOLDS of that id (the founder\'s coverage row) — the founder can still choose it', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4')]);
    await c.db.doc('practiceFieldCaBackfill/AAPL').set({ schemaVersion: 1, symbol: 'AAPL', from: S[1], to: S[1], failed: true, actions: [div(1, 1)], calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
    await rule(c, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId: ID1 }, 'ir3');
    await close(c, 2, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4')]);
    await close(c, 3, 100 / 1.5, [spl(1, '3/2'), spl(1, '5/4'), div(1, 2), div(1, 3)]);
    expect(unsettledConflicts(ideaOf(c).ledger).find((r) => r.actionId === ID1).rows.map((r) => r.amount)).toEqual([1, 2, 3]);
    expect((await rule(c, { kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, 'ir3b')).status).toBe(200);
    await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'ir3c');
    await close(c, 4, 100 / 1.5);
    expect(divs(ideaOf(c))).toEqual([149.96, 149.96]);
  });

  it('AR2-IR-4 (the stricter hold the founder accepted, FQ-8): a payload the founder dismissed by confirming the ruling, re-dated later, is a possible re-date — held, not paid', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await rule(c, { kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, 'ir4');
    await close(c, 2, 100, [div(1, 1), div(1, 2)]);
    await close(c, 3, 100, [div(1, 3)]);
    await rule(c, { kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, 'ir4b');
    await close(c, 4);
    expect(rowOf(c, 4).fullQuality).toBe(true);
    await close(c, 5, 100, [div(5, 3)]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([99.97, 99.97]);
    expect(unsettledRedates(idea.ledger).map((r) => [r.actionId, r.redateOf])).toEqual([[`cash_dividend_AAPL_${S[5]}`, ID1]]);
    expect(rowOf(c, 5).fullQuality).toBe(false);
  });

  it('AR2-IR-5: a founder coverage row and the same payload from the feed are one payload on the record', async () => {
    const c = await start();
    await close(c, 0);
    await uncoveredClose(c, 1, 100, []);
    await c.db.doc('practiceFieldCaBackfill/AAPL').set({ schemaVersion: 1, symbol: 'AAPL', from: S[1], to: S[1], failed: true, actions: [div(1, 1)], calls: 2, fetchedAt: '2026-11-18T23:00:00.000Z', source: 'idea_book_backfill' });
    await rule(c, { kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId: ID1 }, 'ir5');
    await close(c, 2, 100, [div(1, 1), div(1, 2)]);
    expect(unsettledConflicts(ideaOf(c).ledger).find((r) => r.actionId === ID1).rows.map((r) => r.amount)).toEqual([1, 2]);
  });

  it('AR2-IR-6: a dividend re-listed under the RENAMED ticker is matched against the old ticker\'s records — never paid twice', async () => {
    const c = await start();
    await close(c, 0);
    await closeXA(c, 1, 100, [div(1, 1)]);
    await closeXA(c, 2, 100, [ren(2, 'AAPX')]);
    expect(Object.keys(ideaOf(c).ledger.holdings).sort()).toEqual(['AAPX', 'MSFT']);
    // The vendor re-lists the S[1] dividend under the new ticker (a new id: cash_dividend_AAPX_S[1]).
    await closeXA(c, 3, 100, [], [div(1, 1, 'AAPX')]);
    const idea = ideaOf(c);
    expect(divs(idea)).toEqual([99.97, 99.97]);
    expect(unsettledRedates(idea.ledger).map((r) => [r.actionId, r.redateOf])).toEqual([[`cash_dividend_AAPX_${S[1]}`, ID1]]);
  });

  it('AR2-IR-6 (its first case): an AMBIGUOUS dividend, the rename waiting on it, then the dividend re-listed under the new ticker after `none` — held, never settled', async () => {
    const c = await start();
    await close(c, 0);
    await closeXA(c, 1, 100, [div(1, 1), div(1, 2)]);
    await closeXA(c, 2, 100, [ren(2, 'AAPX')]);
    await closeXA(c, 3, 100, [], [div(1, 2, 'AAPX')]);
    expect(divs(ideaOf(c))).toEqual([0, 0]);
    expect((await rule(c, { kind: 'conflict', recordId: ID1, decision: 'none' }, 'ir6')).status).toBe(200);
    await closeXA(c, 4, 100, [], [div(1, 2, 'AAPX')]);
    await closeXA(c, 5, 100, [], [div(1, 2, 'AAPX')]);
    const idea = ideaOf(c);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['AAPX', 'MSFT']);
    expect(divs(idea)).toEqual([0, 0]);
    expect(unsettledRedates(idea.ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPX_${S[1]}`]);
    expect(rowOf(c, 5).fullQuality).toBe(false);
  });
});

describe('AR2-IR-2, in one close', () => {
  it('a dividend conflict and a clean rename listed in the SAME close: the rename waits on the conflict formed in that call', async () => {
    const c = await start();
    await close(c, 0);
    await closeOn(c.db, c.bookId, S[1], { ...q(100, [div(1, 1), div(1, 2), { type: 'ticker_change', ticker: 'AAPL', renamedTo: 'AAPX', effectiveDate: S[1], source: 'eodhd' }]), AAPX: { price: 100, marketCap: 3e12 } });
    recon(c);
    const idea = ideaOf(c);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['AAPL', 'MSFT']);
    expect(idea.ledger.holdings.AAPL.deferredRename).toMatchObject({ to: 'AAPX' });
  });
});
