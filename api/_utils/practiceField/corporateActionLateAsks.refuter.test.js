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

import { describe, it, expect } from 'vitest';
import { run, installSequenceHooks, S } from './__testsupport__/caSequences.js';
import { InputOracle, EntitlementOracle } from './__testsupport__/caOracle.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';
import { backfillNeeds } from './caBackfill.js';
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
const lateBody = (ledger, actionId, decision = 'approve') => ({ kind: 'late_adjustment', recordId: `late_${ledger}_${actionId}`, decision });
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

  it('a rejected row dated more than the window after the dividend cannot change its count or be it moved: the ruling posts', async () => {
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
    inputs.ruling({ kind: 'conflict', recordId: D(2), decision: 'none' }, { status: 200 }, 'r2', 6);
    expect(() => e.checkAuthority(posting(S[6]), 6, 'unit'), 'D3 still unanswered').toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'none' }, { status: 409 }, 'r3x', 6);
    expect(() => e.checkAuthority(posting(S[6]), 6, 'unit'), 'a refused ruling answers nothing').toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'none' }, { status: 200 }, 'r3', 7);
    expect(() => e.checkAuthority(posting(S[6]), 6, 'unit'), 'a ruling applied after the posting close is too late').toThrow(/L-2 at posting/);
    inputs.ruling({ kind: 'conflict', recordId: D(3), decision: 'none' }, { status: 200 }, 'r3b', 6);
    expect(() => e.checkAuthority(posting(S[6]), 6, 'unit')).not.toThrow();
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
    inputs.ruling({ kind: 'conflict', recordId: D(4), decision: 'none' }, { status: 200 }, 'r4', 5);
    inputs.ruling({ kind: 'conflict', recordId: D(5), decision: 'none' }, { status: 200 }, 'r5', 5);
    expect(() => e.checkAuthority(idea, 5, 'unit')).not.toThrow();
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
