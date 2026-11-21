// api/_utils/practiceField/corporateActionLateAsks.refuter.test.js
//
// Practice Field T1a-2b-4, fix round (late data asks, 20 Nov 2026) — THE INDEPENDENT REFUTER'S FINDINGS AS ROWS. The
// refuter, on a read-only snapshot of 193a3dda, was asked for a reachable history where late or corrected data moves money
// without the founder's approval or ruling. It found none; it found these, each a reading of the ruling the build missed:
//
//   R-1  L-2 ② on a sold holding (closed path): two rows of one close that pair only with each other never named the open
//        proposal they both also pair with — the founder's approval of it posted at the next close.
//   R-1b the same on a held holding: a paid dividend's late_basis approval posted while two new rows of its payload, within
//        the window, waited as re-dates of each other.
//   R-3  T2E-02's mirror: an open proposal was never re-screened against a row the vendor moved just past the sale.
//   R-5  a conflict ruling on a sold holding's ambiguous row posted while a sticky coverage doubt (T2E-08) held its count.
//   R-2  a decline did not stick: the proposal was made again (`_2`), every close for a late_basis — the result read
//        unmeasurable though the founder had decided.
//   R-4  a sold holding's coverage doubt could never clear: the backfill only fetched held symbols, and a backfill's rows
//        never reached the closed path.
//   O    the oracle: I-7 accepted an approval that L-2 must refuse (I-7 now checks L-2 at posting, from the inputs alone).
//
// Every row here failed at 193a3dda (the product rows on the product; the oracle rows on the oracle), and passes now.
//
// THE SECOND REFUTER (a read-only snapshot of c569f281, after the fixes above) found no money moved without authority, and:
//   P-1  a sold holding's late_basis paired with a row kept outside it could never complete: no record to rule.
//   P-2a a declined proposal's id relisted at another amount was a fresh, approvable proposal (no revision).
//   P-2b a declined proposal's payload under another date was a fresh, approvable proposal (no pairing).
//   P-3  R-4's backfill rows were dropped when a comparison still held the stock: the net missed the split.
//   P-4  R-3 through the daily layer's lookahead: a row dated after the close was not screened.
//   O-1, O-2, O-3  I-7's L-2 at posting read no share-basis (③) or coverage (④) fact, and a partner's ruling ignored ledgers.
// Those rows failed at c569f281, and pass now.
//
// THE THIRD REFUTER (a read-only snapshot of 05aa1200, the diff of the second refuter's fixes) found no money moved without
// authority on that diff, and:
//   F-1  a clean backfill stored BEFORE a sold holding's rejection cleared that later doubt (unchanged code; I-7's new ④
//        caught it): the approval posted while the vendor still listed the row malformed.
//   O-4  the oracle let a ruling made before a pairing showed — the founder's own split among them — answer it.
// Those rows failed at 05aa1200, and pass now.
//
// THE FOURTH REFUTER (read-only, on the equivalence row of 0426efc9, which claimed the battery's survivor FR2 unreachable):
//   EQ-1 FR2's same-date ordering is reachable — a ruled share-basis id beside a new id of its date applied or waited by
//        how the two ids sorted. The founder ruled it (Q-14): the ruled id always holds until the pair is ruled. Built;
//        the rows below (Q-14) fail on afd145f6 where the ruled id sorts first, and pin the other order.

import { describe, it, expect } from 'vitest';
import { run, installSequenceHooks, S } from './__testsupport__/caSequences.js';
import { InputOracle, EntitlementOracle } from './__testsupport__/caOracle.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';
import { backfillNeeds, ensureCoverageBackfills } from './caBackfill.js';
import { fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { closeIdeaBook } from './close.js';
import {
  seedBook, admitAndEnter, contractOf, getIdea, getRow, closeOn, windowAt, founderRules, getBook, storeCloseSnapshot, storeParseReport, closeNowOf, CLEAN_PARSE_ENTRY,
} from './__testsupport__/fixtures.js';

installSequenceHooks();

const div = (day, amount) => parseDividendsPayload('AAPL', [{ date: S[day], unadjustedValue: amount }]).actions[0];
const spl = (day, ratio) => parseSplitsPayload('AAPL', [{ date: S[day], split: ratio }]).actions[0];
const xlk = { type: 'sector_fund', symbols: ['XLK'] };
const q = (p = 100, a = []) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
async function opened(contract = {}) {
  const ctx = await seedBook();
  const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, ...contract }), quotes: q(), date: S[0] });
  return { ...ctx, ideaId: a.ideaId };
}
const ideaOf = (c) => getIdea(c.db, c.bookId, c.ideaId);
const rowAt = (c, i) => getRow(c.db, c.bookId, c.ideaId, S[i]);
const closeAt = (c, i, p = 100, a = []) => closeOn(c.db, c.bookId, S[i], q(p, a));
const lineOf = (c, sym = 'AAPL') => ideaOf(c).lines.find((l) => l.symbol === sym).level;
/** Hold AAPL through S[k-1], close S[k-1] below the line, sell at S[k]'s window, close S[k]. */
async function soldAt(c, k) {
  for (let i = 0; i < k - 1; i += 1) await closeAt(c, i, 100);
  const p = Math.round((lineOf(c) - 0.5) * 100) / 100;
  await closeAt(c, k - 1, p);
  await windowAt(c.db, c.bookId, { date: S[k], slot: 'open30', quotes: q(p) });
  expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
  await closeAt(c, k, p);
  return p;
}
const ask = (c, body, requestKey) => founderRules(c.db, c.bookId, c.ideaId, body, { requestKey, expectOk: false });
const lateBody = (ledger, actionId, decision = 'approve', n = 1) => ({ kind: 'late_adjustment', recordId: `late_${ledger}_${actionId}${n > 1 ? `_${n}` : ''}`, decision });
const D = (i) => `cash_dividend_AAPL_${S[i]}`;
const postedFull = (c, f = 'ledger') => (ideaOf(c)[f]?.adjustments || []).filter((a) => !a.held).map((a) => [a.kind, a.actionId, a.amountUsd, a.postedOn]);
const bookCash = (c) => getBook(c.db, c.bookId).portfolio.cash;
const redates = (c) => ideaOf(c).ledger.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => [r.actionId, r.redateOf]);
const proposalOf = (c, id) => (ideaOf(c).ledger.lateProposals || []).filter((x) => x.actionId === id).at(-1);
const cents = (x) => Math.round(x * 100) / 100;
const rejectedOn = (date) => ({ ...CLEAN_PARSE_ENTRY, rowsReceived: 1, rowsRejected: 1, rejects: [{ leg: 'splits', reason: 'malformed_split', row: { date, split: '5:4' } }], legs: { ...CLEAN_PARSE_ENTRY.legs, splits: { ...CLEAN_PARSE_ENTRY.legs.splits, received: 1, rejected: 1 } } });
const backfillOf = (from, to, actions) => ({ data: { schemaVersion: 1, symbol: 'AAPL', from, to, failed: false, actions, calls: 2, parseReport: CLEAN_PARSE_ENTRY }, version: 1 });

describe('R-1 — L-2 ② on a sold holding: two rows of one close that pair with each other and with an open proposal', () => {
  it('approved D1, then D2 and D3 ($1 each, within the window): nothing posts; all three are ambiguities for the founder; ruled, D1 posts once (red at 193a3dda: $99.97 posted at S6)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 4);
    await closeAt(c, 5, p, [div(1, 1)]);
    expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ actionId: D(1), status: 'open', blockers: [] })]);
    expect((await ask(c, lateBody('idea', D(1)), 'a1')).status).toBe(200);
    const cash5 = bookCash(c);
    await closeAt(c, 6, p, [div(2, 1), div(3, 1)]);
    expect(postedFull(c), 'L-2: refused while another candidate pairs with it under the re-date rule').toEqual([]);
    expect(bookCash(c)).toBe(cash5);
    expect(redates(c).map(([id]) => id).sort(), 'L-3: the open proposal is screened with the close\'s rows — all three are recorded').toEqual([D(1), D(2), D(3)].sort());
    expect(proposalOf(c, D(1))).toMatchObject({ status: 'open' });
    expect(proposalOf(c, D(1)).blockers).toEqual(expect.arrayContaining([`id_unresolved:${D(1)}`, `pairs_with:${D(2)}`, `pairs_with:${D(3)}`]));
    expect(rowAt(c, 6).fullQuality).toBe(false);
    // The founder answers: D2 and D3 are not dividends of their own; D1 is owed.
    expect((await ask(c, { kind: 'conflict', recordId: D(2), decision: 'none' }, 'r2')).status).toBe(200);
    expect((await ask(c, { kind: 'conflict', recordId: D(3), decision: 'none' }, 'r3')).status).toBe(200);
    expect((await ask(c, { kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 1 } }, 'r1')).status).toBe(200);
    await closeAt(c, 7, p);
    expect(postedFull(c)).toEqual([['late_entitlement', D(1), 99.97, S[7]]]);
    expect(cents(bookCash(c) - cash5)).toBe(99.97);
    await closeAt(c, 8, p);
    expect(postedFull(c), 'posted once').toHaveLength(1);
  });

  it('without a prior approval: after S6 the approval is refused (409 late_id_unresolved)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 4);
    await closeAt(c, 5, p, [div(1, 1)]);
    await closeAt(c, 6, p, [div(2, 1), div(3, 1)]);
    expect(await ask(c, lateBody('idea', D(1)), 'a1')).toMatchObject({ status: 409, body: { error: 'late_id_unresolved' } });
  });

  it('control: ONE new row D2 pairs with the open proposal and blocks it (unchanged)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 4);
    await closeAt(c, 5, p, [div(1, 1)]);
    expect((await ask(c, lateBody('idea', D(1)), 'a1')).status).toBe(200);
    await closeAt(c, 6, p, [div(2, 1)]);
    expect(postedFull(c)).toEqual([]);
    expect(redates(c)).toEqual(expect.arrayContaining([[D(2), D(1)], [D(1), D(2)]]));
  });

  it('through the S-6 harness: I-7 (L-2 at posting) and I-6 accept the refusal, and the ruled posting (red at 193a3dda: I-7 L-2 at posting)', async () => {
    const close = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
    const out = await run({
      seed: 'refuter-R-1-pairs-with', comparison: xlk,
      steps: [close(0, 100), close(1, 100), close(2, 100), close(3, 94, [], { belowLine: true }), { kind: 'window', i: 4, price: 94 }, close(4, 94),
        close(5, 94, [div(1, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(1)) },
        close(6, 94, [div(2, 1), div(3, 1)]),
        { kind: 'expectIdea', fn: (idea) => expect(idea.ledger.dividendsUsd ?? 0).toBe(0) },
        { kind: 'ruleExact', body: { kind: 'conflict', recordId: D(2), decision: 'none' } },
        { kind: 'ruleExact', body: { kind: 'conflict', recordId: D(3), decision: 'none' } },
        { kind: 'ruleExact', body: { kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 1 } } },
        close(7, 94)],
    });
    expect(out.idea.ledger.dividendsUsd).toBe(99.97);
  });
});

describe('R-1b — L-2 ② on a held holding: a paid dividend\'s late_basis and two new rows of its payload', () => {
  it('approved late_basis of D2, then D3 and D4 ($1, within the window) wait as re-dates of each other: nothing posts until the founder answers them (red at 193a3dda: +$24.99 at S4)', async () => {
    const c = await opened({ comparison: xlk });
    await closeAt(c, 0);
    await closeAt(c, 1, 80);
    await closeAt(c, 2, 80, [div(2, 1)]);
    await closeAt(c, 3, 80, [div(2, 1), spl(1, '5/4')]);
    expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ actionId: D(2), kind: 'late_basis', status: 'open', blockers: [] })]);
    expect((await ask(c, lateBody('idea', D(2)), 'a1')).status).toBe(200);
    await closeAt(c, 4, 80, [div(3, 1), div(4, 1)]);
    expect(postedFull(c), 'L-2: refused while another candidate pairs with it under the re-date rule').toEqual([]);
    expect(proposalOf(c, D(2)).blockers).toEqual(expect.arrayContaining([`pairs_with:${D(3)}`, `pairs_with:${D(4)}`]));
    expect(rowAt(c, 4).fullQuality).toBe(false);
    expect((await ask(c, { kind: 'conflict', recordId: D(3), decision: 'none' }, 'r3')).status).toBe(200);
    expect((await ask(c, { kind: 'conflict', recordId: D(4), decision: 'none' }, 'r4')).status).toBe(200);
    await closeAt(c, 5, 80);
    expect(postedFull(c), 'answered, the approval posts its net').toEqual([['late_basis', D(2), 24.99, S[5]]]);
  });

  it('the endpoint refuses the approval while they stand (409 late_pairs_with_candidate)', async () => {
    const c = await opened({ comparison: xlk });
    await closeAt(c, 0);
    await closeAt(c, 1, 80);
    await closeAt(c, 2, 80, [div(2, 1)]);
    await closeAt(c, 3, 80, [div(2, 1), spl(1, '5/4')]);
    await closeAt(c, 4, 80, [div(3, 1), div(4, 1)]);
    expect(await ask(c, lateBody('idea', D(2)), 'a1')).toMatchObject({ status: 409, body: { error: 'late_pairs_with_candidate' } });
  });
});

describe('R-3 — an open proposal is re-screened at every close: the vendor moves its dividend just past the sale', () => {
  it('proposed D1 (sold at S2), approved; the vendor drops it and lists $1 dated S3: nothing posts; D1 is an ambiguity; ruled, it posts once (red at 193a3dda: $99.97 at S4)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 2);
    await closeAt(c, 3, p, [div(1, 1)]);
    expect((await ask(c, lateBody('idea', D(1)), 'a1')).status).toBe(200);
    const cash3 = bookCash(c);
    await closeAt(c, 4, p, [div(3, 1)]);
    expect(postedFull(c), 'the $1 the vendor now dates after the sale pairs with D1 under the re-date rule').toEqual([]);
    expect(bookCash(c)).toBe(cash3);
    expect(redates(c)).toContainEqual([D(1), D(3)]);
    expect(proposalOf(c, D(1)).blockers).toEqual(expect.arrayContaining([`id_unresolved:${D(1)}`, `pairs_with:${D(3)}`]));
    expect(rowAt(c, 4).fullQuality).toBe(false);
    expect((await ask(c, { kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 1 } }, 'r1')).status).toBe(200);
    await closeAt(c, 5, p);
    expect(postedFull(c)).toEqual([['late_entitlement', D(1), 99.97, S[5]]]);
  });

  it('without a prior approval: after S4 the approval is refused (409 late_id_unresolved)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 2);
    await closeAt(c, 3, p, [div(1, 1)]);
    await closeAt(c, 4, p, [div(3, 1)]);
    expect(await ask(c, lateBody('idea', D(1)), 'a1')).toMatchObject({ status: 409, body: { error: 'late_id_unresolved' } });
  });

  it('control (T2E-02\'s order): the outside row first, the in-holding row next — both recorded, nothing proposed (unchanged)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 2);
    await closeAt(c, 3, p, [div(3, 1)]);
    await closeAt(c, 4, p, [div(1, 1)]);
    expect(ideaOf(c).ledger.lateProposals || []).toEqual([]);
    expect(redates(c)).toContainEqual([D(1), D(3)]);
  });
});

describe('R-5 — a sold holding\'s sticky coverage doubt holds the count for the founder\'s conflict ruling too', () => {
  it('T2E-01\'s pair ruled while a rejected split dated within the holding stands: nothing posts, the ruling closes moot (alerted); a clean backfill clears the doubt, and the founder\'s ruling then posts once (red at 193a3dda: $99.97 at S5)', async () => {
    const c = await opened({ comparison: xlk });
    await closeAt(c, 0);
    const p = Math.round((lineOf(c) - 0.5) * 100) / 100;
    await closeAt(c, 1, p);
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(p) });
    await closeAt(c, 2, p);
    await closeAt(c, 3, p, [div(1, 1), div(2, 1)]);
    await storeCloseSnapshot(c.db, S[4], q(p));
    storeParseReport(c.db, S[4], 'AAPL', rejectedOn(S[1]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[4], now: closeNowOf(S[4]) });
    expect(ideaOf(c).ledger.closedCoverageDoubts?.AAPL?.dates?.[0]?.date).toBe(S[1]);
    expect((await ask(c, { kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 1 } }, 'c1')).status).toBe(200);
    expect((await ask(c, { kind: 'conflict', recordId: D(2), decision: 'none' }, 'c2')).status).toBe(200);
    await closeAt(c, 5, p);
    expect(postedFull(c), 'nothing is computed on a count in doubt').toEqual([]);
    expect(rowAt(c, 5).fullQuality).toBe(false);
    // (A ruling the doubt defers on a holding the ledger no longer has closes moot, alerted — AR2-RF-4's rule: kept pending,
    // it would lock the record while a doubt that may never clear stands. The record stays open for a new ruling.)
    expect(ideaOf(c).founderRulings.find((r) => r.kind === 'conflict' && r.recordId === D(1))).toMatchObject({ outcome: 'moot' });
    expect(redates(c).map(([id]) => id)).toContain(D(1));
    c.db._store.set('practiceFieldCaBackfill/AAPL', backfillOf(S[1], S[5], [div(1, 1)]));
    await closeAt(c, 6, p);
    expect(ideaOf(c).ledger.closedCoverageDoubts).toBeUndefined();
    expect(postedFull(c)).toEqual([]);
    expect((await ask(c, { kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 1 } }, 'c3')).status).toBe(200);
    await closeAt(c, 7, p);
    expect(postedFull(c)).toEqual([['late_entitlement', D(1), 99.97, S[7]]]);
    await closeAt(c, 8, p);
    expect(postedFull(c), 'posted once').toHaveLength(1);
  });
});

describe('R-5 — the same doubt holds a ruled correction; a doubt dated beyond the window holds nothing', () => {
  it('a ruled correction of a sold holding\'s paid dividend waits while the doubt stands, and posts once a clean backfill clears it', async () => {
    const c = await opened({ comparison: xlk });
    await closeAt(c, 0);
    await closeAt(c, 1);
    const p = Math.round((lineOf(c) - 0.5) * 100) / 100;
    await closeAt(c, 2, p, [div(2, 1)]);
    await windowAt(c.db, c.bookId, { date: S[3], slot: 'open30', quotes: q(p) });
    await closeAt(c, 3, p, [div(2, 1)]);
    expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
    await storeCloseSnapshot(c.db, S[4], q(p));
    storeParseReport(c.db, S[4], 'AAPL', rejectedOn(S[1]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[4], now: closeNowOf(S[4]) });
    await closeAt(c, 5, p, [div(2, 2)]);
    expect(ideaOf(c).ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: D(2), reason: 'revised_after_ruling' }));
    expect((await ask(c, { kind: 'conflict', recordId: D(2), decision: 'payload', payload: { amount: 2 } }, 'c1')).status).toBe(200);
    await closeAt(c, 6, p, [div(2, 2)]);
    expect(postedFull(c), 'the count it would be computed on is in doubt').toEqual([]);
    c.db._store.set('practiceFieldCaBackfill/AAPL', backfillOf(S[1], S[6], [div(2, 2)]));
    await closeAt(c, 7, p, [div(2, 2)]);
    expect(postedFull(c)).toEqual([['ruled_correction', D(2), 99.97, S[7]]]);
  });

  it('control: a rejected row dated more than the window after the dividend cannot change its count or be it moved — the ruling posts', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 9);
    await closeAt(c, 10, p, [div(1, 1), div(2, 1)]);
    await storeCloseSnapshot(c.db, S[11], q(p));
    storeParseReport(c.db, S[11], 'AAPL', rejectedOn(S[8]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[11], now: closeNowOf(S[11]) });
    expect(ideaOf(c).ledger.closedCoverageDoubts?.AAPL?.dates?.[0]?.date).toBe(S[8]);
    expect((await ask(c, { kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 1 } }, 'c1')).status).toBe(200);
    expect((await ask(c, { kind: 'conflict', recordId: D(2), decision: 'none' }, 'c2')).status).toBe(200);
    await closeAt(c, 12, p);
    expect(postedFull(c)).toEqual([['late_entitlement', D(1), 99.97, S[12]]]);
  });
});

describe('R-2 — a decline sticks', () => {
  it('late_entitlement: declined, the same row listed again opens nothing; the rows read full quality (red at 193a3dda: `_2` opened at S5)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 2);
    await closeAt(c, 3, p, [div(1, 1)]);
    expect((await ask(c, lateBody('idea', D(1), 'decline'), 'd1')).status).toBe(200);
    await closeAt(c, 4, p, [div(1, 1)]);
    await closeAt(c, 5, p, [div(1, 1)]);
    expect(ideaOf(c).ledger.lateProposals.map((x) => [x.id, x.status])).toEqual([[`late_idea_${D(1)}`, 'declined']]);
    expect(rowAt(c, 4).fullQuality).toBe(true);
    expect(rowAt(c, 5).fullQuality).toBe(true);
    expect(postedFull(c)).toEqual([]);
  });

  it('late_basis: declined, it is not made again at later closes; the rows read full quality (red at 193a3dda: re-proposed every close)', async () => {
    const c = await opened({ comparison: xlk });
    await closeAt(c, 0);
    await closeAt(c, 1, 80);
    await closeAt(c, 2, 80, [div(2, 1)]);
    await closeAt(c, 3, 80, [div(2, 1), spl(1, '5/4')]);
    expect((await ask(c, lateBody('idea', D(2), 'decline'), 'd1')).status).toBe(200);
    for (const i of [4, 5, 6]) await closeAt(c, i, 80);
    expect(ideaOf(c).ledger.lateProposals.map((x) => [x.id, x.status])).toEqual([[`late_idea_${D(2)}`, 'declined']]);
    for (const i of [4, 5, 6]) expect(rowAt(c, i).fullQuality, S[i]).toBe(true);
    expect(postedFull(c)).toEqual([]);
  });

  it('a NEW late fact after a decline is a new question: a split first listed after the decline re-asks at the new count', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 3);
    await closeAt(c, 4, p, [div(2, 1)]);
    expect(proposalOf(c, D(2))).toMatchObject({ status: 'open', owedUsd: 99.97 });
    expect((await ask(c, lateBody('idea', D(2), 'decline'), 'd1')).status).toBe(200);
    await closeAt(c, 5, p, [div(2, 1)]);
    expect(ideaOf(c).ledger.lateProposals.filter((x) => x.status === 'open')).toEqual([]);
    await closeAt(c, 6, p, [div(2, 1), spl(1, '5/4')]);
    expect(ideaOf(c).ledger.lateProposals.map((x) => [x.id, x.status, x.owedUsd])).toEqual([[`late_idea_${D(2)}`, 'declined', 99.97], [`late_idea_${D(2)}_2`, 'open', 124.96]]);
  });

  it('through the endpoint: declined once, the result is measured — nothing waits on the founder (red at 193a3dda: unmeasurable)', async () => {
    const c = await opened({ comparison: xlk });
    await closeAt(c, 0);
    await closeAt(c, 1, 80);
    await closeAt(c, 2, 80, [div(2, 1)]);
    await closeAt(c, 3, 80, [div(2, 1), spl(1, '5/4')]);
    expect((await ask(c, lateBody('idea', D(2), 'decline'), 'd1')).status).toBe(200);
    const due = ideaOf(c).contract.schedule.dueSession;
    for (let i = 4; S[i] <= due; i += 1) await closeAt(c, i, 80);
    const idea = ideaOf(c);
    expect(idea.result?.economicResult).toBeDefined();
    expect(idea.result.economicResult).not.toBe('unmeasurable');
    expect(idea.ledger.lateProposals.filter((x) => x.status === 'open')).toEqual([]);
  });
});

describe('R-4 — a sold holding\'s coverage doubt can clear: the backfill is fetched for it, and its rows reach the closed path', () => {
  it('backfillNeeds names the sold symbol from its doubt\'s date; a clean backfill listing the rejected split clears the doubt, the split enters the count, and the approval posts the new net (red at 193a3dda: no need named)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 2);
    await closeAt(c, 3, p);
    await storeCloseSnapshot(c.db, S[4], q(p));
    storeParseReport(c.db, S[4], 'AAPL', rejectedOn(S[1]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[4], now: closeNowOf(S[4]) });
    await closeAt(c, 5, p, [div(2, 1)]);
    expect(backfillNeeds([ideaOf(c)], S[5])).toContainEqual({ symbol: 'AAPL', from: S[1] });
    expect(proposalOf(c, D(2))).toMatchObject({ status: 'open', owedUsd: 99.97, blockers: [`date_uncovered:${S[1]}`] });
    // The vendor's backfill lists the split the daily build rejected, cleanly.
    c.db._store.set('practiceFieldCaBackfill/AAPL', backfillOf(S[1], S[5], [spl(1, '5/4'), div(2, 1)]));
    await closeAt(c, 6, p);
    const idea = ideaOf(c);
    expect(idea.ledger.closedCoverageDoubts).toBeUndefined();
    expect(idea.ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: `split_AAPL_${S[1]}`, historyOnly: true, applied: true }));
    expect(proposalOf(c, D(2))).toMatchObject({ status: 'open', owedUsd: 124.96, netUsd: 124.96, blockers: [] });
    expect(backfillNeeds([idea], S[6]).map((n) => n.symbol)).not.toContain('AAPL');
    expect((await ask(c, lateBody('idea', D(2)), 'a1')).status).toBe(200);
    await closeAt(c, 7, p);
    expect(postedFull(c)).toEqual([['late_entitlement', D(2), 124.96, S[7]]]);
  });
});

describe('O — the oracle: I-7 checks L-2 at posting, from the inputs alone', () => {
  it('an approval-only posting of an id the inputs show ambiguous at that close fails I-7 until a conflict ruling answers it; one posted before the pairing passes (red at 193a3dda: accepted)', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.close(5, [div(1, 1)]);
    inputs.close(6, [div(2, 1), div(3, 1)]);
    const posting = (on) => ({ ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', actionId: D(1), amountUsd: 99.97, amountPerShare: 1, postedOn: on }] } });
    inputs.ruling(lateBody('idea', D(1)), { status: 200 }, 'a1', 5);
    expect(() => e.checkAuthority(posting(S[5]), 5, 'unit'), 'posted before the pairing: L-2 did not refuse it').not.toThrow();
    expect(() => e.checkAuthority(posting(S[6]), 6, 'unit')).toThrow(/I-7 \(L-2 at posting\) ledger cash_dividend_AAPL_/);
    // (The founder answers the rows of S6 after seeing them: rulings applied at S7, and the posting at S7.)
    inputs.ruling({ kind: 'conflict', recordId: D(2), decision: 'none' }, { status: 200 }, 'r2', 7);
    expect(() => e.checkAuthority(posting(S[7]), 7, 'unit'), 'D3 still unanswered').toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'none' }, { status: 409 }, 'r3x', 7);
    expect(() => e.checkAuthority(posting(S[7]), 7, 'unit'), 'a refused ruling answers nothing').toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'none' }, { status: 200 }, 'r3', 8);
    expect(() => e.checkAuthority(posting(S[7]), 7, 'unit'), 'a ruling applied after the posting close is too late').toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'none' }, { status: 200 }, 'r3c', 6);
    expect(() => e.checkAuthority(posting(S[7]), 7, 'unit'), 'a ruling made before the pairing showed (third refuter O-4) answers nothing').toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'none' }, { status: 200 }, 'r3b', 7);
    expect(() => e.checkAuthority(posting(S[7]), 7, 'unit')).not.toThrow();
    expect(e.refusalChecks).toBeGreaterThan(0);
  });

  it('a ruling of the id made BEFORE a later pairing answers nothing about it, and is no authority for a later late posting', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.close(2, [div(1, 1), div(2, 1)]);
    inputs.ruling({ kind: 'conflict', recordId: D(2), decision: 'payload', payload: { amount: 1 } }, { status: 200 }, 'r2', 3);
    inputs.ruling({ kind: 'conflict', recordId: D(1), decision: 'none' }, { status: 200 }, 'r1', 3);
    inputs.close(3, [div(1, 1), div(2, 1)]);
    inputs.close(5, [div(4, 1), div(5, 1)]);
    // The paid dividend's late_basis, on an approval alone, posted at the close the two new rows paired with it.
    const idea = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_basis', actionId: D(2), amountUsd: 24.99, amountPerShare: 1, postedOn: S[5] }] } };
    inputs.ruling(lateBody('idea', D(2)), { status: 200 }, 'a1', 5);
    expect(() => e.checkAuthority(idea, 5, 'unit'), 'the founder\'s ruling of S3 did not see the rows of S5').toThrow(/L-2 at posting\) ledger cash_dividend_AAPL_2026-11-18/);
    // (The founder answers the rows of S5 after seeing them; the posting at S6 then meets no refusal.)
    inputs.ruling({ kind: 'conflict', recordId: D(4), decision: 'none' }, { status: 200 }, 'r4', 6);
    inputs.ruling({ kind: 'conflict', recordId: D(5), decision: 'none' }, { status: 200 }, 'r5', 6);
    const later = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_basis', actionId: D(2), amountUsd: 24.99, amountPerShare: 1, postedOn: S[6] }] } };
    expect(() => e.checkAuthority(later, 6, 'unit')).not.toThrow();
  });

  it('through the S-6 harness, held: a ruled dividend\'s approved late_basis, refused while two new rows pair with each other, is excused by I-6 (the wider pairing) — and posts once they are answered', async () => {
    const close = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
    const out = await run({
      seed: 'refuter-R-1b-ruled-late-basis', comparison: xlk,
      steps: [close(0, 100), close(1, 80), close(2, 80, [div(1, 1), div(2, 1)]),
        { kind: 'ruleExact', body: { kind: 'conflict', recordId: D(2), decision: 'payload', payload: { amount: 1 } } },
        { kind: 'ruleExact', body: { kind: 'conflict', recordId: D(1), decision: 'none' } },
        close(3, 80, [div(1, 1), div(2, 1)]),
        close(4, 80, [div(1, 1), div(2, 1), spl(1, '5/4')]),
        { kind: 'expectIdea', fn: (idea) => expect(idea.ledger.lateProposals).toEqual([expect.objectContaining({ actionId: D(2), kind: 'late_basis', status: 'open', blockers: [] })]) },
        { kind: 'lateExact', body: lateBody('idea', D(2)) },
        close(5, 80, [div(4, 1), div(5, 1)]),
        { kind: 'expectIdea', fn: (idea) => { expect(idea.ledger.dividendsUsd).toBe(99.97); expect(idea.ledger.lateProposals[0].blockers).toEqual(expect.arrayContaining([`pairs_with:${D(4)}`, `pairs_with:${D(5)}`])); } },
        { kind: 'ruleExact', body: { kind: 'conflict', recordId: D(4), decision: 'none' } },
        { kind: 'ruleExact', body: { kind: 'conflict', recordId: D(5), decision: 'none' } },
        close(6, 80)],
    });
    expect(out.idea.ledger.dividendsUsd).toBe(124.96);
    expect(out.entitlement.refused, 'the refusal at S5 was excused by refusalStands').toBeGreaterThan(0);
  });

  it('a ruling of the id itself answers its ambiguity', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.close(5, [div(1, 1)]);
    inputs.close(6, [div(2, 1)]);
    const idea = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', actionId: D(1), amountUsd: 99.97, amountPerShare: 1, postedOn: S[6] }] } };
    inputs.ruling(lateBody('idea', D(1)), { status: 200 }, 'a1', 6);
    expect(() => e.checkAuthority(idea, 6, 'unit')).toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 1 } }, { status: 200 }, 'r1', 6);
    expect(() => e.checkAuthority(idea, 6, 'unit')).not.toThrow();
  });
});

// ── THE SECOND REFUTER (c569f281) ─────────────────────────────────────────────────────────────────────────────────────
/** Hold AAPL through S[k-1] (rowsAt[i] listed at close i), close S[k-1] below the line, sell at S[k]'s window, close S[k]. */
async function soldAtWith(c, k, rowsAt = {}) {
  for (let i = 0; i < k - 1; i += 1) await closeAt(c, i, 100, rowsAt[i] || []);
  const p = Math.round((lineOf(c) - 0.5) * 100) / 100;
  await closeAt(c, k - 1, p, rowsAt[k - 1] || []);
  await windowAt(c.db, c.bookId, { date: S[k], slot: 'open30', quotes: q(p) });
  expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
  await closeAt(c, k, p, rowsAt[k] || []);
  return p;
}
const hc = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });

describe('P-1 — a sold holding\'s late_basis paired with a row kept outside the holding can complete', () => {
  it('the outside row is recorded for the founder; ruled `none`, the approval posts the net (red at c569f281: 409 for good, and conflict 404)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 5, { 3: [div(3, 1)] });
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    await closeAt(c, 6, p, [spl(2, '5/4')]);
    expect(proposalOf(c, D(3))).toMatchObject({ kind: 'late_basis', status: 'open', netUsd: 24.99 });
    await closeAt(c, 7, p, [div(6, 1)]);
    expect(ideaOf(c).ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: D(6), reason: 'possible_redate', redateOf: D(3), outsideHolding: true }));
    expect(proposalOf(c, D(3)).blockers).toContain(`pairs_with:${D(6)}`);
    expect(await ask(c, lateBody('idea', D(3)), 'a0')).toMatchObject({ status: 409, body: { error: 'late_pairs_with_candidate' } });
    expect((await ask(c, { kind: 'conflict', recordId: D(6), decision: 'none' }, 'r6')).status).toBe(200);
    await closeAt(c, 8, p, [div(6, 1)]);
    expect(proposalOf(c, D(3)).blockers).toEqual([]);
    expect((await ask(c, lateBody('idea', D(3)), 'a1')).status).toBe(200);
    await closeAt(c, 9, p);
    expect(postedFull(c)).toEqual([['late_basis', D(3), 24.99, S[9]]]);
  });

  it('control: the founder may decline instead — accepted, nothing posts', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 5, { 3: [div(3, 1)] });
    await closeAt(c, 6, p, [spl(2, '5/4')]);
    await closeAt(c, 7, p, [div(6, 1)]);
    expect((await ask(c, lateBody('idea', D(3), 'decline'), 'd1')).status).toBe(200);
    await closeAt(c, 8, p);
    expect(proposalOf(c, D(3)).status).toBe('declined');
    expect(postedFull(c)).toEqual([]);
  });
});

describe('P-2 — a decline answers the money, not the id: its payload stays one the ledger has seen', () => {
  it('(a) declined at $1, relisted at $2: the id is a revision (a conflict record), not a fresh proposal; ruled $2, it posts once (red at c569f281: `_2` approved, $199.94 posted)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt(c, 2);
    await closeAt(c, 3, p, [div(1, 1)]);
    expect((await ask(c, lateBody('idea', D(1), 'decline'), 'd1')).status).toBe(200);
    await closeAt(c, 4, p, [div(1, 1)]);
    await closeAt(c, 5, p, [div(1, 2)]);
    const l = ideaOf(c).ledger;
    expect(l.lateProposals.map((x) => [x.id, x.status])).toEqual([[`late_idea_${D(1)}`, 'declined']]);
    expect(l.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: D(1), reason: 'conflicting_action', kinds: ['revision'], revisedFrom: { proposal: `late_idea_${D(1)}`, declined: true } }));
    expect((await ask(c, lateBody('idea', D(1), 'approve', 2), 'a2')).status).toBe(404);
    expect((await ask(c, { kind: 'conflict', recordId: D(1), decision: 'payload', payload: { amount: 2 } }, 'r1')).status).toBe(200);
    await closeAt(c, 6, p, [div(1, 2)]);
    expect(postedFull(c)).toEqual([['late_entitlement', D(1), 199.94, S[6]]]);
  });

  it('(a) through the S-6 harness: I-7 (L-2 at posting) on decline → relist → approval (red at c569f281)', async () => {
    await run({
      seed: 'refuter2-P-2a', comparison: xlk,
      steps: [hc(0, 100), hc(1, 100), hc(2, 100), hc(3, 94, [], { belowLine: true }), { kind: 'window', i: 4, price: 94 }, hc(4, 94),
        hc(5, 94, [div(1, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(1), 'decline') },
        hc(6, 94, [div(1, 1)]),
        hc(7, 94, [div(1, 2)]),
        { kind: 'lateExact', body: lateBody('idea', D(1), 'approve', 2), status: 404 },
        hc(8, 94, [div(1, 2)]),
        { kind: 'expectIdea', fn: (idea) => expect((idea.ledger.adjustments || []).filter((a) => !a.held)).toEqual([]) }],
    });
  });

  it('(b) declined D1 ($1), then $1 listed a session later: D2 pairs with it — both ambiguities, nothing proposed (red at c569f281: D2 approved, $99.97 posted)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 3);
    await closeAt(c, 4, p, [div(1, 1)]);
    expect((await ask(c, lateBody('idea', D(1), 'decline'), 'd1')).status).toBe(200);
    await closeAt(c, 5, p, [div(1, 1)]);
    await closeAt(c, 6, p, [div(2, 1)]);
    expect(redates(c)).toEqual(expect.arrayContaining([[D(2), D(1)], [D(1), D(2)]]));
    expect((ideaOf(c).ledger.lateProposals || []).filter((x) => x.actionId === D(2))).toEqual([]);
    expect((await ask(c, lateBody('idea', D(2)), 'a2')).status).toBe(404);
    await closeAt(c, 7, p);
    expect(postedFull(c)).toEqual([]);
  });

  it('(b) through the S-6 harness (red at c569f281: I-7 L-2 at posting)', async () => {
    await run({
      seed: 'refuter2-P-2b', comparison: xlk,
      steps: [hc(0, 100), hc(1, 100), hc(2, 100), hc(3, 94, [], { belowLine: true }), { kind: 'window', i: 4, price: 94 }, hc(4, 94),
        hc(5, 94, [div(1, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(1), 'decline') },
        hc(6, 94, [div(1, 1)]),
        hc(7, 94, [div(2, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(2), 'approve'), status: 404 },
        hc(8, 94), hc(9, 94)],
    });
  });

  it('(b) control: D2 at the very close the decline applies — D1 still open, both recorded, no proposal of D2 (unchanged)', async () => {
    await run({
      seed: 'refuter2-P-2b-control', comparison: xlk,
      steps: [hc(0, 100), hc(1, 100), hc(2, 100), hc(3, 94, [], { belowLine: true }), { kind: 'window', i: 4, price: 94 }, hc(4, 94),
        hc(5, 94, [div(1, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(1), 'decline') },
        hc(6, 94, [div(2, 1)]),
        { kind: 'expectIdea', fn: (idea) => expect(idea.ledger.corporateActionReceipts.filter((r) => r.reason === 'possible_redate').map((r) => r.actionId).sort()).toEqual([D(1), D(2)].sort()) },
        { kind: 'lateExact', body: lateBody('idea', D(2), 'approve'), status: 404 },
        hc(7, 94),
        { kind: 'expectIdea', fn: (idea) => expect((idea.ledger.adjustments || []).filter((a) => !a.held)).toEqual([]) }],
    });
  });
});

describe('P-3 — a sold holding\'s clean backfill reaches its path though the comparison still holds the stock', () => {
  it('same-stock comparison: the backfill lists a 5/4 split dated within the holding — the net is 124.96 (red at c569f281: 99.97)', async () => {
    const c = await opened({ comparison: { type: 'same_stock_held' } });
    const p = await soldAtWith(c, 3);
    await storeCloseSnapshot(c.db, S[4], q(p));
    storeParseReport(c.db, S[4], 'AAPL', rejectedOn(S[2]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[4], now: closeNowOf(S[4]) });
    expect(ideaOf(c).ledger.closedCoverageDoubts?.AAPL?.dates?.[0]?.date).toBe(S[2]);
    await closeAt(c, 5, p, [div(3, 1)]);
    expect(proposalOf(c, D(3))).toMatchObject({ kind: 'late_entitlement', status: 'open', owedUsd: 99.97 });
    c.db._store.set('practiceFieldCaBackfill/AAPL', backfillOf(S[2], S[5], [spl(2, '5/4'), div(3, 1)]));
    await closeAt(c, 6, p);
    expect(ideaOf(c).ledger.closedCoverageDoubts).toBeUndefined();
    expect(proposalOf(c, D(3))).toMatchObject({ status: 'open', owedUsd: 124.96 });
    expect((await ask(c, lateBody('idea', D(3)), 'a1')).status).toBe(200);
    await closeAt(c, 7, p);
    expect(postedFull(c).filter(([k]) => k === 'late_entitlement')).toEqual([['late_entitlement', D(3), 124.96, S[7]]]);
  });

  it('control: a sector comparison — 124.96 (unchanged)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 3);
    await storeCloseSnapshot(c.db, S[4], q(p));
    storeParseReport(c.db, S[4], 'AAPL', rejectedOn(S[2]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[4], now: closeNowOf(S[4]) });
    await closeAt(c, 5, p, [div(3, 1)]);
    c.db._store.set('practiceFieldCaBackfill/AAPL', backfillOf(S[2], S[5], [spl(2, '5/4'), div(3, 1)]));
    await closeAt(c, 6, p);
    expect((await ask(c, lateBody('idea', D(3)), 'a1')).status).toBe(200);
    await closeAt(c, 7, p);
    expect(postedFull(c).filter(([k]) => k === 'late_entitlement')).toEqual([['late_entitlement', D(3), 124.96, S[7]]]);
  });
});

describe('P-4 — R-3 through the daily layer\'s lookahead: a row dated after the close is screened too', () => {
  it('D2 proposed (sold Thursday S3) and approved; Monday S5 lists $1 dated Tuesday S6, D2 dropped: nothing posts; D2 is an ambiguity (red at c569f281: $99.97 at S5)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 3);
    await closeAt(c, 4, p, [div(2, 1)]);
    expect((await ask(c, lateBody('idea', D(2)), 'a1')).status).toBe(200);
    expect([S[5], S[6]]).toEqual(['2026-11-23', '2026-11-24']);
    await closeAt(c, 5, p, [div(6, 1)]);
    expect(postedFull(c)).toEqual([]);
    expect(redates(c)).toContainEqual([D(2), D(6)]);
    expect((ideaOf(c).ledger.closedOutsideRows || []).map((x) => x.actionId)).toContain(D(6));
    await closeAt(c, 6, p, [div(6, 1)]);
    expect(postedFull(c)).toEqual([]);
  });

  it('through the S-6 harness (red at c569f281: I-7 L-2 at posting)', async () => {
    await run({
      seed: 'refuter2-P-4', comparison: xlk,
      steps: [hc(0, 100), hc(1, 100), hc(2, 94, [], { belowLine: true }), { kind: 'window', i: 3, price: 94 }, hc(3, 94),
        hc(4, 94, [div(2, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(2), 'approve') },
        hc(5, 94, [div(6, 1)]),
        hc(6, 94, [div(6, 1)]),
        hc(7, 94)],
    });
  });
});

describe('O-1 to O-3 — I-7\'s L-2 at posting reads ③, ④ and the ledgers a ruling covers', () => {
  it('O-1: L-2 ③ — a share-basis id dated within the holding ambiguous by the inputs refuses an approval-only posting (red at c569f281: accepted)', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.close(4, [div(2, 1)]);
    inputs.close(5, [spl(1, '5/4'), spl(1, '2/1')]);
    expect((inputs.marks.get(`split_AAPL_${S[1]}`) || []).map((m) => m.how)).toContain('conflict');
    inputs.ruling(lateBody('idea', D(2)), { status: 200 }, 'a1', 5);
    const idea = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', actionId: D(2), amountUsd: 99.97, amountPerShare: 1, postedOn: S[5] }] } };
    expect(() => e.checkAuthority(idea, 5, 'unit')).toThrow(/L-2 ③ at posting/);
    // (Answered by the founder's ruling of the split, made after the close that showed it: a posting at the next close passes.)
    inputs.ruling({ kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, { status: 200 }, 'r1', 6);
    const next = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', actionId: D(2), amountUsd: 99.97, amountPerShare: 1, postedOn: S[6] }] } };
    expect(() => e.checkAuthority(next, 6, 'unit')).not.toThrow();
  });

  it('O-2: L-2 ④ — a posting at a close whose inputs leave the symbol uncovered, or after a rejected row of a sold holding with no clean data since (red at c569f281: accepted)', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.close(4, [div(2, 1)]);
    inputs.close(5, [div(2, 1)], { uncoveredSyms: ['AAPL'] });
    inputs.coverage(5, { uncovered: ['AAPL'] });
    inputs.ruling(lateBody('idea', D(2)), { status: 200 }, 'a1', 5);
    const at = (on) => ({ ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', actionId: D(2), amountUsd: 99.97, amountPerShare: 1, postedOn: on }] } });
    expect(() => e.checkAuthority(at(S[5]), 5, 'unit')).toThrow(/L-2 ④ at posting/);
    // A sold holding (bought S0, sold S3): a row dated S1 rejected at S4 is a sticky doubt; a catch-up after it clears it.
    inputs.coverage(4, { rejected: [{ sym: 'AAPL', date: S[1] }] });
    inputs.coverage(6, {});
    const sold = { ledger: { sym: 'AAPL', entryShares: 99.970008, boughtAt: 0, soldAt: 3 } };
    expect(() => e.checkAuthority(at(S[6]), 6, 'unit', sold)).toThrow(/L-2 ④ at posting.*rejected/);
    inputs.coverage(6, { catchup: true });
    expect(() => e.checkAuthority(at(S[6]), 6, 'unit', sold)).not.toThrow();
  });

  it('O-3: a ruling of the paired id covering only the comparison answers nothing on the idea\'s ledger (red at c569f281: accepted)', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.close(5, [div(1, 1)]);
    inputs.close(6, [div(2, 1)]);
    inputs.ruling(lateBody('idea', D(1)), { status: 200 }, 'a1', 6);
    inputs.ruling({ kind: 'conflict', recordId: D(2), decision: 'none' }, { status: 200 }, 'r2', 7, ['comparisonLedger']);
    const idea = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', actionId: D(1), amountUsd: 99.97, amountPerShare: 1, postedOn: S[7] }] } };
    expect(() => e.checkAuthority(idea, 7, 'unit')).toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(2), decision: 'none' }, { status: 200 }, 'r2b', 7, ['ledger']);
    expect(() => e.checkAuthority(idea, 7, 'unit')).not.toThrow();
  });
});

// ── FOUND BY I-7's L-2 ③ ITSELF (shape seed 2119990011, probe seed 2120900156) ─────────────────────────────────────────
describe('a share-basis row kept outside the sold holding that pairs with one applied within it holds the proposals of the symbol', () => {
  it('a reverse split dated S2 (listed after the sale) makes a late_basis; the same 4-for-5 then listed dated S6, just after the sale: the approval waits; ruled `none`, it posts (red at c569f281: −$19.99 posted on the approval)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 5, { 3: [div(3, 1)] });
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    await closeAt(c, 6, p, [spl(2, '4/5')]);
    expect(proposalOf(c, D(3))).toMatchObject({ kind: 'late_basis', status: 'open', netUsd: -19.99, blockers: [] });
    expect((await ask(c, lateBody('idea', D(3)), 'a1')).status).toBe(200);
    await closeAt(c, 7, p, [spl(6, '4/5')]);
    const rs6 = `reverse_split_AAPL_${S[6]}`;
    expect(ideaOf(c).ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: rs6, reason: 'possible_redate', redateOf: `reverse_split_AAPL_${S[2]}`, outsideHolding: true }));
    expect(proposalOf(c, D(3)).blockers).toContain(`share_basis_unresolved:${rs6}`);
    expect(postedFull(c), 'the count the late_basis stands on is in question').toEqual([]);
    expect(await ask(c, lateBody('idea', D(3)), 'a2')).toMatchObject({ status: 409 });
    expect((await ask(c, { kind: 'conflict', recordId: rs6, decision: 'none' }, 'r6')).status).toBe(200);
    await closeAt(c, 8, p, [spl(6, '4/5')]);
    await closeAt(c, 9, p);
    expect(postedFull(c)).toEqual([['late_basis', D(3), -19.99, S[8]]]);
  });
});

// ── THE THIRD REFUTER (05aa1200) ──────────────────────────────────────────────────────────────────────────────────────
describe('F-1 — a sold holding\'s coverage doubt clears only by a backfill fetched after it was seen', () => {
  it('the idea\'s own pipeline: a clean backfill clears doubt #1; a later rejection is doubt #2; the refetch meets the bad row, the stale document does not clear it; the vendor corrects it, and the approval posts (red at 05aa1200: $99.97 posted at S8)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 3);
    let malformed = false; // the vendor lists the split dated S3 malformed while this holds
    const fetchImpl = async (url) => {
      const u = new URL(url);
      const leg = u.pathname.includes('/splits/') ? 'splits' : 'dividends';
      const body = leg === 'splits' ? (malformed ? [{ date: S[3], split: '5:4' }] : []) : [{ date: S[2], unadjustedValue: 1 }];
      return { ok: true, status: 200, json: async () => body };
    };
    const fetchCorporateActions = (sym, opts = {}) => fetchCorporateActionsEODHD(sym, { ...opts, apiKey: 'fixture-vendor-key', fetchImpl: opts.fetchImpl ?? fetchImpl });
    const closeWith = async (i, report = null, rows = []) => {
      await ensureCoverageBackfills(c.db, c.bookRef, { through: S[i], now: closeNowOf(S[i]), fetchCorporateActions, fetchImpl });
      await storeCloseSnapshot(c.db, S[i], q(p, rows));
      if (report) storeParseReport(c.db, S[i], 'AAPL', report);
      await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
    };
    await closeWith(4, rejectedOn(S[1]), [div(2, 1)]);
    expect(ideaOf(c).ledger.closedCoverageDoubts?.AAPL?.dates).toEqual([{ date: S[1], seenOn: S[4] }]);
    await closeWith(5);
    expect(ideaOf(c).ledger.closedCoverageDoubts, 'cleared by the clean backfill fetched for it at S5').toBeUndefined();
    expect(proposalOf(c, D(2))).toMatchObject({ kind: 'late_entitlement', status: 'open', blockers: [] });
    malformed = true;
    await closeWith(6, rejectedOn(S[3]));
    await closeWith(7);
    expect(ideaOf(c).ledger.closedCoverageDoubts?.AAPL?.dates, 'the stored S1..S5 document never saw the S3 row').toEqual([{ date: S[3], seenOn: S[6] }]);
    expect(await ask(c, lateBody('idea', D(2)), 'a1')).toMatchObject({ status: 409, body: { error: 'late_date_uncovered' } });
    await closeWith(8);
    expect(postedFull(c)).toEqual([]);
    expect(rowAt(c, 8).fullQuality).toBe(false);
    malformed = false;
    await closeWith(9);
    expect(ideaOf(c).ledger.closedCoverageDoubts, 'a clean backfill fetched after the doubt clears it').toBeUndefined();
    expect((await ask(c, lateBody('idea', D(2)), 'a2')).status).toBe(200);
    await closeWith(10);
    expect(postedFull(c)).toEqual([['late_entitlement', D(2), 99.97, S[10]]]);
  });

  it('a clean document stored before the rejection (another idea\'s or an earlier need\'s) does not clear it (red at 05aa1200)', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 3);
    c.db._store.set('practiceFieldCaBackfill/AAPL', backfillOf(S[0], S[4], [div(2, 1)]));
    await closeAt(c, 4, p, [div(2, 1)]);
    await storeCloseSnapshot(c.db, S[5], q(p));
    storeParseReport(c.db, S[5], 'AAPL', rejectedOn(S[1]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[5], now: closeNowOf(S[5]) });
    await closeAt(c, 6, p);
    expect(ideaOf(c).ledger.closedCoverageDoubts?.AAPL?.dates).toEqual([{ date: S[1], seenOn: S[5] }]);
    expect(await ask(c, lateBody('idea', D(2)), 'a1')).toMatchObject({ status: 409, body: { error: 'late_date_uncovered' } });
    await closeAt(c, 7, p);
    expect(postedFull(c)).toEqual([]);
  });

  it('through the S-6 harness: a catch-up before the rejection, then an approval — refused (red at 05aa1200: I-7 L-2 ④ at posting)', async () => {
    await run({
      seed: 'refuter3-F-1', comparison: xlk,
      steps: [hc(0, 100), hc(1, 100), hc(2, 94, [], { belowLine: true }), { kind: 'window', i: 3, price: 94 }, hc(3, 94),
        { kind: 'catchup', i: 4, price: 94, rows: [div(2, 1)], backfill: [div(2, 1)] },
        hc(5, 94, [], { parse: { reject: 1 } }),
        hc(6, 94),
        { kind: 'lateExact', body: lateBody('idea', D(2)), status: 409 },
        hc(7, 94),
        { kind: 'expectIdea', fn: (idea) => expect((idea.ledger.adjustments || []).filter((a) => !a.held)).toEqual([]) }],
    });
  });
});

describe('O-4 — the oracle: a ruling made before a pairing showed never answers it', () => {
  it('a vendor split paired only with the founder\'s pending split: an approval-only posting is refused by I-7 (L-2 ③) (red at 05aa1200: accepted)', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.ruling({ kind: 'suspicion', recordId: `suspected_split_AAPL_${S[3]}`, decision: 'split', ratio: 2 }, { status: 200 }, 's1', 4);
    const F = `split_AAPL_${S[3]}`;
    const pend = new Map([[F, { ratio: 2, since: S[2], suspectedOn: S[3], at: 4 }]]);
    inputs.close(4, [div(1, 1)], { pendingSplits: pend });
    inputs.close(5, [spl(5, '2/1')], { pendingSplits: pend });
    expect((inputs.marks.get(`split_AAPL_${S[5]}`) || []).map((m) => m.how)).toEqual(['redate']);
    inputs.ruling(lateBody('idea', D(1)), { status: 200 }, 'a1', 6);
    inputs.close(6, []);
    const idea = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', ticker: 'AAPL', actionId: D(1), amountUsd: 99.97, amountPerShare: 1, postedOn: S[6] }] } };
    expect(() => e.checkAuthority(idea, 6, 'unit')).toThrow(/L-2 ③ at posting/);
  });

  it('the posting id pairs with an id a conflict ruling settled before the pairing showed: refused (red at 05aa1200: accepted)', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    inputs.close(3, [div(3, 1), div(3, 2)]);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'payload', payload: { amount: 1 } }, { status: 200 }, 'r3', 4);
    inputs.close(4, []);
    inputs.close(5, [div(1, 1)]);
    inputs.ruling(lateBody('idea', D(1)), { status: 200 }, 'a1', 6);
    inputs.close(6, []);
    const idea = { ledger: { corporateActionReceipts: [], adjustments: [{ kind: 'late_entitlement', ticker: 'AAPL', actionId: D(1), amountUsd: 99.97, amountPerShare: 1, postedOn: S[6] }] } };
    expect(() => e.checkAuthority(idea, 6, 'unit')).toThrow(/L-2 at posting/);
  });
});

describe('the proposal the founder is told about is owed on the ex-date count (battery survivor L03-count-at-close-not-ex-date)', () => {
  it('a sold holding: a 2-for-1 dated after the dividend, listed after the sale, then the dividend listed late — the alert and the proposal say $99.97, never the closing count\'s $199.94', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAtWith(c, 4);
    await closeAt(c, 5, p, [spl(2, '2/1')]);
    const out = await closeAt(c, 6, p, [div(1, 1)]);
    expect(proposalOf(c, D(1))).toMatchObject({ kind: 'late_entitlement', status: 'open', owedUsd: 99.97, netUsd: 99.97 });
    expect(proposalOf(c, D(1)).updatedOn, 'made once, on the right count').toBeUndefined();
    const told = (out.alerts || []).filter((a) => a.startsWith('PRACTICE_FIELD_LATE_PROPOSED'));
    expect(told).toHaveLength(1);
    expect(told[0]).toContain('late_entitlement of $99.97 (owed $99.97 on 99.970008 shares');
  });
});


describe('Q-14 — a ruled share-basis id beside a new id of its date holds, as one ambiguity with it, until the founder rules the pair', () => {
  // The founder's ruling (20 Nov 2026), on the fourth refuter's EQ-1: "A ruled share-basis id beside a new id of the same
  // date always holds, as one ambiguity with the new id, until the founder rules the pair, whatever order the ids sort in.
  // Meanwhile no dividend, sale or approval uses the count." Before, RFX-2's order by id decided it: the ruled id applied
  // when its id sorted first (`reverse_split_…` before `split_…`), and waited when it sorted after — and on a held holding a
  // new id listed in the same call never held it. Rows for both orders, on a sold and on a held holding: where the ruled id
  // sorts first they fail on afd145f6 (it applied); where it sorts after, it already held — pinned, so the rule is
  // order-free — and every row then has the founder rule the pair and the ruled id apply.
  const RS = `reverse_split_AAPL_${S[1]}`;
  const SP = `split_AAPL_${S[1]}`;
  const ORDERS = [
    { name: 'the ruled id sorts FIRST', ruled: RS, ruledRows: [spl(1, '4/5'), spl(1, '1/2')], ratio: 0.8, other: SP, otherRow: spl(1, '2/1') },
    { name: 'the ruled id sorts AFTER the new one', ruled: SP, ruledRows: [spl(1, '2/1'), spl(1, '3/2')], ratio: 2, other: RS, otherRow: spl(1, '1/2') },
  ];
  const conflict = (recordId, decision, payload) => ({ kind: 'ruleExact', body: { kind: 'conflict', recordId, decision, ...(payload ? { payload } : {}) } });
  const rulingsOf = (idea, id) => (idea.founderRulings || []).filter((r) => r.recordId === id).map((r) => [r.appliedOn ?? null, r.outcome ?? null]);
  const openRecord = (idea, id) => idea.ledger.corporateActionReceipts.some((r) => r.actionId === id && (r.reason === 'possible_redate' || r.reason === 'conflicting_action') && !(idea.ledger.appliedActionIds || []).includes(id) && !(idea.ledger.declinedActionIds || []).includes(id));

  it('EQ-1, sold at S2 (the ruled id sorts first): A (two ratios) ruled 4-for-5; then a 2-for-1 dated S1 and one dated S2 — A holds and its ruling closes moot; a late $1 dividend dated S1 is never proposed and nothing posts; ruled together with the new id, A applies as history', async () => {
    const A = RS;
    await run({
      seed: 'refuter4-EQ-1', comparison: xlk,
      steps: [hc(0, 100), hc(1, 94, [], { belowLine: true }), { kind: 'window', i: 2, price: 94 }, hc(2, 94),
        hc(3, 94, [spl(1, '4/5'), spl(1, '1/2')]),
        { kind: 'expectIdea', fn: (idea) => expect(idea.ledger.corporateActionReceipts.filter((r) => r.reason).map((r) => [r.reason, r.actionId])).toEqual([['conflicting_action', A]]) },
        conflict(A, 'payload', { ratio: 0.8 }),
        hc(4, 94, [spl(1, '2/1'), spl(2, '2/1')]),
        { kind: 'expectIdea', fn: (idea) => {
          expect(idea.ledger.appliedActionIds, 'the ruled id holds beside the new one').not.toContain(A);
          expect(rulingsOf(idea, A), 'a deferred ruling on a sold holding closes moot (Q-12 as built)').toEqual([[S[4], 'moot']]);
          expect(openRecord(idea, A) && openRecord(idea, SP), 'one ambiguity: both ids open').toBe(true);
        } },
        hc(5, 94, [div(1, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(1)), status: 404 },
        conflict(A, 'payload', { ratio: 0.8 }), conflict(SP, 'none'),
        hc(6, 94),
        { kind: 'expectIdea', fn: (idea) => {
          expect(idea.ledger.appliedActionIds, 'the pair ruled: A applies').toContain(A);
          expect(idea.ledger.corporateActionReceipts.filter((r) => r.actionId === A && r.applied).map((r) => r.historyOnly)).toEqual([true]);
          expect(rulingsOf(idea, A)).toEqual([[S[4], 'moot'], [S[6], null]]);
          expect((idea.ledger.adjustments || []).filter((a) => !a.held), 'nothing posts without an approval').toEqual([]);
          expect(idea.ledger.dividendsUsd).toBe(0);
        } }],
    });
  });

  it('sold at S2, the ruled id sorts AFTER the new one: the same — it holds, its ruling closes moot, nothing is proposed or posted; ruled together with the new id, it applies as history', async () => {
    const o = ORDERS[1];
    await run({
      seed: 'q14-sold-ruled-sorts-after', comparison: xlk,
      steps: [hc(0, 100), hc(1, 94, [], { belowLine: true }), { kind: 'window', i: 2, price: 94 }, hc(2, 94),
        hc(3, 94, o.ruledRows),
        conflict(o.ruled, 'payload', { ratio: o.ratio }),
        hc(4, 94, [o.otherRow]),
        { kind: 'expectIdea', fn: (idea) => {
          expect(idea.ledger.appliedActionIds).not.toContain(o.ruled);
          expect(rulingsOf(idea, o.ruled)).toEqual([[S[4], 'moot']]);
          expect(openRecord(idea, o.ruled) && openRecord(idea, o.other), 'one ambiguity: both ids open').toBe(true);
        } },
        hc(5, 94, [div(1, 1)]),
        { kind: 'lateExact', body: lateBody('idea', D(1)), status: 404 },
        conflict(o.ruled, 'payload', { ratio: o.ratio }), conflict(o.other, 'none'),
        hc(6, 94),
        { kind: 'expectIdea', fn: (idea) => {
          expect(idea.ledger.appliedActionIds).toContain(o.ruled);
          expect(rulingsOf(idea, o.ruled)).toEqual([[S[4], 'moot'], [S[6], null]]);
          expect((idea.ledger.adjustments || []).filter((a) => !a.held)).toEqual([]);
          expect(idea.ledger.dividendsUsd).toBe(0);
        } }],
    });
  });

  for (const o of ORDERS) {
    it(`held (${o.name}): ruled, then the new id listed with a $1 dividend dated S2 and the price below the line — the ruled id holds, its ruling pending; no dividend, no sale, the count unmoved; the founder rules the new id, and the pair applies`, async () => {
      let sh = null;
      await run({
        seed: `q14-held-${o.ruled === RS ? 'ruled-sorts-first' : 'ruled-sorts-after'}`, comparison: xlk,
        steps: [hc(0, 100), hc(1, 100), hc(2, 100, o.ruledRows),
          { kind: 'expectIdea', fn: (idea) => { sh = idea.ledger.holdings.AAPL.shares; expect(openRecord(idea, o.ruled)).toBe(true); } },
          conflict(o.ruled, 'payload', { ratio: o.ratio }),
          hc(3, 100, [o.otherRow, div(2, 1)], { belowLine: true }),
          { kind: 'expectIdea', fn: (idea) => {
            expect(idea.ledger.appliedActionIds, 'the ruled id holds beside the new one').not.toContain(o.ruled);
            expect(rulingsOf(idea, o.ruled), 'pending while its record stands').toEqual([[null, null]]);
            expect(openRecord(idea, o.other), 'the new id is an ambiguity beside it').toBe(true);
            expect(idea.ledger.holdings.AAPL.shares, 'the count unmoved').toBe(sh);
            expect(idea.ledger.dividendsUsd, 'no dividend on the count').toBe(0);
          } },
          { kind: 'window', i: 4, price: 90 },
          hc(4, 90),
          { kind: 'expectIdea', fn: (idea) => {
            expect(idea.ledger.holdings.AAPL?.shares, 'no sale').toBe(sh);
            expect(idea.ledger.appliedActionIds).not.toContain(o.ruled);
          } },
          conflict(o.other, 'none'),
          hc(5, 90),
          { kind: 'expectIdea', fn: (idea) => {
            expect(idea.ledger.appliedActionIds, 'the pair ruled: the ruled id applies').toContain(o.ruled);
            expect(idea.ledger.holdings.AAPL.shares).toBe(Math.round(sh * o.ratio * 1e6) / 1e6);
            expect(rulingsOf(idea, o.ruled)).toEqual([[S[5], null]]);
            expect(idea.ledger.dividendsUsd, 'the dividend paid on the ruled count (I-6 checks the amount)').toBeGreaterThan(0);
          } }],
      });
    });
  }
  it('the Q-14 refuter\'s Q14-1, sold at S2: one close lists a 1-for-2 once and a split dated the same day two ways — both ids are one ambiguity, nothing applies; the founder rules the split alone: it holds and closes moot; a late $1 dividend is never proposed, nothing posts (red at 6c8daebb: the 1-for-2 applied unruled — I-2)', async () => {
    await run({
      seed: 'q14-refuter-Q14-1', comparison: xlk,
      steps: [hc(0, 100), hc(1, 94, [], { belowLine: true }), { kind: 'window', i: 2, price: 94 }, hc(2, 94),
        hc(3, 94, [spl(1, '1/2'), spl(1, '2/1'), spl(1, '3/2')]),
        { kind: 'expectIdea', fn: (idea) => {
          expect(idea.ledger.corporateActionReceipts.filter((r) => r.reason).map((r) => [r.reason, r.actionId])).toEqual([['possible_redate', RS], ['conflicting_action', SP]]);
          expect((idea.ledger.appliedActionIds || []).filter((x) => x.includes('split'))).toEqual([]);
        } },
        conflict(SP, 'payload', { ratio: 2 }),
        hc(4, 94, [div(1, 1)]),
        { kind: 'expectIdea', fn: (idea) => {
          expect(idea.ledger.appliedActionIds).not.toContain(SP);
          expect(rulingsOf(idea, SP)).toEqual([[S[4], 'moot']]);
        } },
        { kind: 'lateExact', body: lateBody('idea', D(1)), status: 404 },
        hc(5, 94),
        { kind: 'expectIdea', fn: (idea) => {
          expect((idea.ledger.adjustments || []).filter((a) => !a.held)).toEqual([]);
          expect(idea.ledger.dividendsUsd).toBe(0);
        } }],
    });
  });

  it('sold at S2: the new id is listed two ways at the very close the ruling applies (recorded only after the ruled id\'s turn) — the ruled id still holds (the listed-now rows: the Q-14 refuter\'s unpinned branch)', async () => {
    await run({
      seed: 'q14-sold-new-id-listed-two-ways', comparison: xlk,
      steps: [hc(0, 100), hc(1, 94, [], { belowLine: true }), { kind: 'window', i: 2, price: 94 }, hc(2, 94),
        hc(3, 94, [spl(1, '4/5'), spl(1, '1/2')]),
        conflict(RS, 'payload', { ratio: 0.8 }),
        hc(4, 94, [spl(1, '2/1'), spl(1, '3/2')]),
        { kind: 'expectIdea', fn: (idea) => {
          expect(idea.ledger.appliedActionIds).not.toContain(RS);
          expect(rulingsOf(idea, RS)).toEqual([[S[4], 'moot']]);
          expect(openRecord(idea, RS) && openRecord(idea, SP), 'one ambiguity: both ids open').toBe(true);
        } }],
    });
  });
});
