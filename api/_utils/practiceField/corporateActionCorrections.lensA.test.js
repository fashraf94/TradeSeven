// api/_utils/practiceField/corporateActionCorrections.lensA.test.js
//
// Practice Field T1a-2b-4 — THE LENS (a) REVIEW'S REPRODUCTIONS (adjustments and conservation), kept as rows: each
// asserts the behaviour the review found missing at 994ccc2e (AR4-A-1 to A-6) and failed there; the fix round makes it
// hold. The reviewer's own scenarios, through the real close, windows, sales and founder action, with parsed vendor rows.
// (Printed observations are muted; the assertions are the rows.)

import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { seedBook, admitAndEnter, contractOf, getBook, getIdea, getRow, closeOn, closeNowOf, windowAt, takeSeededDbs, storeCloseSnapshot, omitParseReport, founderRules } from './__testsupport__/fixtures.js';
import { adjustmentDocIdOf } from './adjustments.js';
import { closeIdeaBook } from './close.js';
import { openAmbiguities, openRulingRevisions } from './ledger.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';
import { roundUsd } from '../mandateRounding.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { nextSessionDate } from './windows.js';

const S = ['2026-11-16'];
while (S.length < 20) S.push(nextSessionDate(S.at(-1)));
const SH = 99.970008;
const div = (i, v = 1, s = 'AAPL') => parseDividendsPayload(s, [{ date: S[i], unadjustedValue: v }]).actions[0];
const spl = (i, r, s = 'AAPL') => parseSplitsPayload(s, [{ date: S[i], split: r }]).actions[0];
const q = (p = 100, a = [], extra = {}) => ({
  AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: extra.msft ?? 200, marketCap: 3e12, ...(extra.msftCa ? { corporateActions: extra.msftCa } : {}) }, SPY: { price: 500, ...(extra.spy ? { corporateActions: extra.spy } : {}) }, XLK: { price: 200 },
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
// (T1a-2b-4 fix round, L-1: late data is PROPOSED; the founder approves one proposal through the real endpoint.)
async function approveLate(c, ledger, actionId, requestKey = `approve-${ledger}-${actionId}`) {
  const out = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'late_adjustment', recordId: `late_${ledger}_${actionId}`, decision: 'approve' }, { requestKey, expectOk: false });
  expect(out.status, JSON.stringify(out.body)).toBe(200);
  return out;
}
const lineLevel = (c, sym = 'AAPL') => ideaOf(c).lines.find((l) => l.symbol === sym).level;
const belowLine = (c, sym = 'AAPL') => roundUsd(lineLevel(c, sym) - 0.5);
async function sellOnLine(c, i, extra = {}) {
  const p = belowLine(c);
  await close(c, i, p, [], extra);
  expect(ideaOf(c).ledger.holdings.AAPL.exitPending).toBeTruthy();
  const out = await windowAt(c.db, c.bookId, { date: S[i + 1], slot: 'open30', quotes: q(p, [], extra) });
  expect(out.sales?.[0]?.sold ?? out.sales, JSON.stringify(out.sales)).toBeTruthy();
  return p;
}
const adjustmentsOf = (c, f = 'ledger') => ideaOf(c)[f]?.adjustments || [];

beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

describe('AR4-A-1 — a share-basis ambiguity recorded on a closed holding holds a later-dated dividend of the same close', () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  const SECTOR = { comparison: { type: 'sector_fund', symbols: ['XLK'] } };

  describe('same-close: conflicting late split + later-dated late dividend on a sold symbol', () => {
    it('OPEN idea: a conflicting split dated S1 (5/4 vs 3/2) and a $1 dated S2 (sale day), listed together after the sale', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1); // below line at S1 close, sold at S2 window
      await close(c, 2, belowLine(c));
      const cash0 = bookOf(c).portfolio.cash;
      await close(c, 3, belowLine(c), [spl(1, '5/4'), spl(1, '3/2'), div(2, 1)]);
      const idea = ideaOf(c);
      console.log('OPEN adjustments', JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.actionId, a.amountUsd, a.entitledShares])));
      console.log('OPEN ambiguities', JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.actionId, r.reason, r.closedHolding])));
      console.log('OPEN book cash delta', bookOf(c).portfolio.cash - cash0, 'row fullQuality', rowOf(c, 3).fullQuality);
      // The rule: nothing count-dependent posts while the symbol's share basis is in doubt.
      expect(openAmbiguities(idea.ledger).some((r) => r.actionId === `split_AAPL_${S[1]}`)).toBe(true);
      expect(adjustmentsOf(c), 'a dividend paid on a count whose split is ambiguous').toEqual([]);
    });

    it('CONTROL — the same rows in two closes: the split conflict first, then the dividend, waits', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      await close(c, 3, belowLine(c), [spl(1, '5/4'), spl(1, '3/2')]);
      await close(c, 4, belowLine(c), [spl(1, '5/4'), spl(1, '3/2'), div(2, 1)]);
      console.log('CONTROL adjustments', JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.actionId, a.amountUsd])), 'closedHeldRows', JSON.stringify(ideaOf(c).ledger.closedHeldRows));
      expect(adjustmentsOf(c)).toEqual([]);
    });

    it('RESULTED idea: a conflicting REVERSE split (1/2 vs 1/3) dated S1 and a $1 dated S1 after it, listed after the result — paid to the treasury on the unsplit count; no ruling can reach a resulted idea', async () => {
      const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      expect(ideaOf(c).status).toBe('resulted');
      const t0 = bookOf(c).treasury.unreservedCash;
      await close(c, 3, belowLine(c), [spl(1, '1/2'), spl(1, '1/3'), div(1, 1)]);
      const idea = ideaOf(c);
      console.log('RESULTED adjustments', JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.actionId, a.amountUsd, a.entitledShares, a.postedTo])));
      console.log('RESULTED cmp adjustments', JSON.stringify(adjustmentsOf(c, 'comparisonLedger').map((a) => [a.kind, a.actionId, a.amountUsd, a.entitledShares, a.postedTo])));
      console.log('RESULTED ambiguities', JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.actionId, r.reason])));
      console.log('RESULTED treasury delta', bookOf(c).treasury.unreservedCash - t0, 'view', JSON.stringify(idea.resultAdjustments));
      expect(adjustmentsOf(c), 'paid on SH while the split is 1/2 or 1/3').toEqual([]);
    });

    it('RESULTED CONTROL: the split conflict in one close, the dividend the next — waits', async () => {
      const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      await close(c, 3, belowLine(c), [spl(1, '1/2'), spl(1, '1/3')]);
      await close(c, 4, belowLine(c), [spl(1, '1/2'), spl(1, '1/3'), div(1, 1)]);
      console.log('RESULTED CONTROL adjustments', JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.amountUsd])));
      expect(adjustmentsOf(c)).toEqual([]);
    });
  });
});

describe('AR4-A-2 — a row waiting on a closed holding is named: below full quality, alerted, and on a resulted idea named until the look-back ends', () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  const SECTOR = { comparison: { type: 'sector_fund', symbols: ['XLK'] } };
  async function closeUncovered(c, i, p, rows, syms = ['AAPL']) {
    await storeCloseSnapshot(c.db, S[i], q(p, rows));
    omitParseReport(c.db, S[i], syms);
    const out = await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
    recon(c);
    return out;
  }

  describe('closedHeldRows', () => {
    it('OPEN idea: a $1 owed on sold AAPL waits on a doubt — is the row still full quality, and is anything alerted?', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      const out = await closeUncovered(c, 3, belowLine(c), [div(1, 1)]);
      const idea = ideaOf(c);
      console.log('closedHeldRows', JSON.stringify(idea.ledger.closedHeldRows));
      console.log('row S3 fullQuality', rowOf(c, 3).fullQuality);
      const mention = (out.alerts || []).filter((a) => a.includes(`cash_dividend_AAPL_${S[1]}`));
      console.log('alerts naming the held dividend', JSON.stringify(mention));
      expect(idea.ledger.closedHeldRows?.length).toBe(1);
      expect(adjustmentsOf(c)).toEqual([]);
      expect(rowOf(c, 3).fullQuality, 'money owed waits, row reads full quality').toBe(false);
      expect(mention.length, 'nothing alerts the held row').toBeGreaterThan(0);
    });

    it('RESULTED idea: a $1 owed on sold AAPL waits on a doubt for the whole look-back — named on the idea and alerted at every close, and alerted as left unsettled at the last close that reads it (never silently)', async () => {
      const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      expect(ideaOf(c).status).toBe('resulted');
      const t0 = bookOf(c).treasury.unreservedCash;
      const alertsSeen = [];
      // AAPL's parse report missing S3..S6 (the look-back of a Nov 18 result); the row listed throughout.
      for (let i = 3; i <= 6; i += 1) {
        const out = await closeUncovered(c, i, belowLine(c), [div(1, 1)]);
        alertsSeen.push(...(out.alerts || []).map((a) => [S[i], a]));
        expect(ideaOf(c).lateDataUnsettled, S[i]).toEqual({ actions: [{ ledger: 'idea', actionId: `cash_dividend_AAPL_${S[1]}`, kind: 'closed_held' }, { ledger: 'comparison', actionId: `cash_dividend_AAPL_${S[1]}`, kind: 'closed_held' }], readUntil: S[6] });
      }
      const unsettled = alertsSeen.filter(([, a]) => a.startsWith('PRACTICE_FIELD_LATE_DATA_UNSETTLED')).map(([d]) => d);
      const left = alertsSeen.filter(([, a]) => a.startsWith('PRACTICE_FIELD_LATE_DATA_LEFT_UNSETTLED')).map(([d]) => d);
      expect([unsettled, left]).toEqual([[S[3], S[4], S[5]], [S[6]]]);
      // From S7 the resulted idea is no longer read: the money stays where the result put it, and the idea still names
      // what was never settled (a founder question: rulings on resulted ideas, and data past the look-back).
      for (let i = 7; i <= 9; i += 1) await close(c, i, belowLine(c), [div(1, 1)]);
      expect(adjustmentsOf(c)).toEqual([]);
      expect(bookOf(c).treasury.unreservedCash).toBe(t0);
      expect(ideaOf(c).lateDataUnsettled.readUntil).toBe(S[6]);
    });
  });
});

describe('AR4-A-3 / AR4-C-6 — a revision of a history-only split can be answered', () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  const SECTOR = { comparison: { type: 'sector_fund', symbols: ['XLK'] } };

  describe('a revision of a history-only split', () => {
    it('the founder can neither keep nor correct it; it stays open, every row reads below full quality, and a later dividend owed waits for good', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1); // sold S2
      await close(c, 2, belowLine(c));
      await close(c, 3, belowLine(c), [spl(1, '5/4')]); // history-only receipt
      const hist = ideaOf(c).ledger.corporateActionReceipts.find((r) => r.actionId === `split_AAPL_${S[1]}`);
      console.log('history-only receipt', JSON.stringify(hist && { applied: hist.applied, historyOnly: hist.historyOnly }));
      await close(c, 4, belowLine(c), [spl(1, '3/2')]); // the vendor's correction of it
      console.log('open revisions', JSON.stringify(openRulingRevisions(ideaOf(c).ledger).map((r) => [r.actionId, r.settledBy, r.closedHolding, r.rows])));
      const answers = {};
      for (const [key, body] of [
        ['keep', { decision: 'payload', payload: { ratio: 1.25 } }],
        ['correct', { decision: 'payload', payload: { ratio: 1.5 } }],
        ['none', { decision: 'none' }],
      ]) {
        const out = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, ...body }, { requestKey: `r-${key}`, expectOk: false });
        answers[key] = [out.status, out.body?.error ?? null];
      }
      console.log('founder answers', JSON.stringify(answers));
      // A dividend owed on AAPL dated S2 (while held, after the split), listed after the revision.
      await close(c, 5, belowLine(c), [div(2, 1)]);
      await close(c, 6, belowLine(c), [div(2, 1)]);
      const idea = ideaOf(c);
      console.log('S5/S6 fullQuality', rowOf(c, 5).fullQuality, rowOf(c, 6).fullQuality, 'open ambiguities', openAmbiguities(idea.ledger).length,
        'adjustments', JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.amountUsd])), 'closedHeldRows', JSON.stringify(idea.ledger.closedHeldRows?.map((r) => r.actionId)));
      expect(Object.values(answers).some(([s]) => s === 200), 'some founder answer must close the record').toBe(true);
    });
  });
});

describe('AR4-A-1, A-2 — breadth and the result', () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  const SECTOR = { comparison: { type: 'sector_fund', symbols: ['XLK'] } };
  const brief = (c, f = 'ledger') => JSON.stringify(adjustmentsOf(c, f).map((a) => [a.kind, a.actionId, a.amountUsd, a.entitledShares, a.postedTo]));
  async function closeUncovered(c, i, p, rows, extra = {}) {
    await storeCloseSnapshot(c.db, S[i], q(p, rows, extra));
    omitParseReport(c.db, S[i], ['AAPL']);
    const out = await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
    recon(c);
    return out;
  }

  describe('a1 severity', () => {
    it('OPEN: after the same-close payment, the founder rules the closed-holding conflict 5/4 — does it heal (+$24.99)?', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      await close(c, 3, belowLine(c), [spl(1, '5/4'), spl(1, '3/2'), div(2, 1)]);
      console.log('S3', brief(c));
      const r = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, { requestKey: 'rule-54', expectOk: false });
      console.log('ruling', r.status, JSON.stringify(r.body));
      await close(c, 4, belowLine(c));
      const idea = ideaOf(c);
      console.log('S4', brief(c), 'hist', JSON.stringify(idea.ledger.corporateActionReceipts.filter((x) => x.historyOnly).map((x) => [x.actionId, x.ratio, x.sharesBefore, x.sharesAfter])),
        'open', openAmbiguities(idea.ledger).length, 'rulings', JSON.stringify((idea.founderRulings || []).map((x) => [x.requestKey, x.appliedOn ?? null, x.outcome ?? null])));
    });

    it('RESULTED: the founder cannot rule on the resulted idea\'s conflict', async () => {
      const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      await close(c, 3, belowLine(c), [spl(1, '1/2'), spl(1, '1/3'), div(1, 1)]);
      const r = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `reverse_split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 0.5 } }, { requestKey: 'rule-r', expectOk: false });
      console.log('RESULTED ruling', r.status, JSON.stringify(r.body));
      console.log('entitled under 1/2', roundUsd(roundUsd(99.970008 * 0.5) * 1), 'under 1/3', roundUsd(Math.round(99.970008 / 3 * 1e6) / 1e6));
      expect(r.status).not.toBe(200);
    });

    it('BREADTH: a share-basis POSSIBLE RE-DATE recorded in step 1, and a dividend dated after it, in one close', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await close(c, 1, 50, [spl(1, '2/1')]); // a 2-for-1 listed on time: 199.940016
      expect(ideaOf(c).ledger.holdings.AAPL.shares).toBe(199.940016);
      await sellOnLine(c, 2); // below the line S2, sold S3
      await close(c, 3, belowLine(c));
      await close(c, 4, belowLine(c), [spl(1, '2/1'), spl(2, '2/1'), div(2, 1)]); // the same 2-for-1 a session later (a re-date?), and $1 dated S2
      const idea = ideaOf(c);
      console.log('BREADTH', brief(c), 'open', JSON.stringify(openAmbiguities(idea.ledger).map((x) => [x.actionId, x.reason, x.redateOf ?? null])));
      expect(openAmbiguities(idea.ledger).some((x) => x.actionId === `split_AAPL_${S[2]}`)).toBe(true);
      expect(adjustmentsOf(c), 'paid while the count is in doubt (199.94 or 399.88)').toEqual([]);
    });
  });

  describe('a2 severity', () => {
    it('UPGRADE: the open idea reaches its endpoint while $99.97 owed waits in closedHeldRows — the endpoint and result quality', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1); // AAPL sold S2
      await close(c, 2, belowLine(c));
      const msftBelow = roundUsd(lineLevel(c, 'MSFT') - 0.5);
      await closeUncovered(c, 3, belowLine(c), [div(1, 1)], { msft: msftBelow }); // the row waits; MSFT below its line
      expect(ideaOf(c).ledger.closedHeldRows?.length).toBe(1);
      await windowAt(c.db, c.bookId, { date: S[4], slot: 'open30', quotes: q(belowLine(c), [], { msft: msftBelow }) });
      expect(ideaOf(c).ledger.holdings.MSFT).toBeUndefined();
      await closeUncovered(c, 4, belowLine(c), [div(1, 1)], { msft: msftBelow });
      const idea = ideaOf(c);
      const ep = getRow(c.db, c.bookId, c.ideaId, 'endpoint');
      console.log('status', idea.status, 'closedHeldRows', JSON.stringify(idea.ledger.closedHeldRows?.map((r) => r.actionId)));
      console.log('endpoint fullQuality', ep?.fullQuality, 'idea.fullQuality', ep?.idea?.fullQuality, 'unsettled', JSON.stringify(ep?.idea?.unsettledActions));
      console.log('result dataQuality', JSON.stringify(idea.result?.dataQuality), 'doubts', JSON.stringify(idea.result?.doubts ?? idea.result?.inDoubt ?? null), 'economic', idea.result?.economicResult);
      console.log('row S4 fullQuality', rowOf(c, 4).fullQuality);
      // (The fix round: the waiting row is an unsettled action at the endpoint — the idea's value is in doubt by it.)
      expect(ep.idea.unsettledActions).toContain(`cash_dividend_AAPL_${S[1]}`);
      expect(ep.idea.fullQuality).toBe(false);
      expect(idea.result.economicResult).toBe('unmeasurable');
      expect(rowOf(c, 4).fullQuality).toBe(false);
      // Next close covers AAPL: the owed $99.97 is NAMED on the resulted idea — L-8: nothing posts to the treasury.
      const t0 = bookOf(c).treasury.unreservedCash;
      await close(c, 5, belowLine(c), [div(1, 1)], { msft: msftBelow });
      expect(bookOf(c).treasury.unreservedCash).toBe(t0);
      expect(ideaOf(c).lateDataUnsettled.actions).toContainEqual(expect.objectContaining({ ledger: 'idea', actionId: `cash_dividend_AAPL_${S[1]}`, kind: 'late_proposal', netUsd: 99.97 }));
      console.log('after S5', brief(c), 'treasury delta', roundUsd(bookOf(c).treasury.unreservedCash - t0));
    });

    it('CONTROL: resulted idea, doubt S3..S5 only, S6 clean — at S6 (the last session of the look-back) the late row is NAMED, left unsettled (L-8)', async () => {
      const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      for (let i = 3; i <= 5; i += 1) await closeUncovered(c, i, belowLine(c), [div(1, 1)]);
      const out = await close(c, 6, belowLine(c), [div(1, 1)]);
      console.log('CONTROL S6', brief(c), 'closedHeldRows', JSON.stringify(ideaOf(c).ledger.closedHeldRows ?? null));
      expect(adjustmentsOf(c)).toEqual([]);
      expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ netUsd: 99.97, proposedOn: S[6], status: 'open' })]);
      expect(out.alerts.some((a) => a.startsWith(`PRACTICE_FIELD_LATE_DATA_LEFT_UNSETTLED ${c.ideaId}`))).toBe(true);
    });
  });
});

describe("AR4-A-4 / AR4-C-10 — a founder payload ruling on a closed holding's split conflict applies", () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  const SECTOR = { comparison: { type: 'sector_fund', symbols: ['XLK'] } };
  const state = (c) => {
    const idea = ideaOf(c);
    return {
      hist: idea.ledger.corporateActionReceipts.filter((x) => x.historyOnly).map((x) => [x.actionId, x.ratio]),
      open: openAmbiguities(idea.ledger).map((x) => [x.actionId, x.reason]),
      adj: adjustmentsOf(c).map((a) => [a.kind, a.actionId, a.amountUsd]),
      rulings: (idea.founderRulings || []).map((x) => [x.requestKey, x.appliedOn ?? null, x.outcome ?? null]),
    };
  };

  describe('a conflict ruling on a closed holding', () => {
    it('SPLIT conflict (5/4 vs 3/2) on sold AAPL, ruled 5/4 — applied as history, or closed moot with the record still open?', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      await close(c, 3, belowLine(c), [spl(1, '5/4'), spl(1, '3/2')]);
      const r = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, { requestKey: 'rule-54' });
      console.log('ruling answer', r.status);
      const out = await close(c, 4, belowLine(c));
      console.log('SPLIT after S4', JSON.stringify(state(c)));
      console.log('alerts', JSON.stringify((out.alerts || []).filter((a) => /RULING|AMBIG|UNSETTLED/.test(a))));
      console.log('row S4 fullQuality', rowOf(c, 4).fullQuality);
      // A second ruling with the payload, then `none`.
      const r2 = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, { requestKey: 'rule-54b', expectOk: false });
      console.log('second ruling', r2.status, JSON.stringify(r2.body));
      await close(c, 5, belowLine(c));
      console.log('SPLIT after S5', JSON.stringify(state(c)));
      expect(state(c).hist, 'the founder\'s ratio never applies').toEqual([[`split_AAPL_${S[1]}`, 1.25]]);
    });

    it('DIVIDEND conflict ($1 vs $2) on sold AAPL, ruled $1 — paid once (control: a cash conflict is no share-basis doubt)', async () => {
      const c = await start(SECTOR);
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      await close(c, 3, belowLine(c), [div(1, 1), div(1, 2)]);
      await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, { requestKey: 'rule-d1' });
      await close(c, 4, belowLine(c));
      console.log('DIV after S4', JSON.stringify(state(c)));
      expect(state(c).adj).toEqual([['late_entitlement', `cash_dividend_AAPL_${S[1]}`, 99.97]]);
    });
  });
});

describe('AR4-A-5 — each late_basis its own id and evidence document', () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  describe('deterministic id collision', () => {
    it('2-for-1 (S2), 1-for-2 (S3), 2-for-1 (S8) listed late after a $1 dated S8 was paid: the third late_basis reuses the first one\'s id', async () => {
      const c = await start({ slot: 'medium', comparison: { type: 'sector_fund', symbols: ['XLK'] } });
      for (let i = 0; i <= 7; i += 1) await close(c, i);
      await close(c, 8, 100, [div(8, 1)]);
      expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
      await sellOnLine(c, 9); // sold S10
      await close(c, 10, belowLine(c));
      await close(c, 11, belowLine(c), [spl(2, '2/1')]);
      await close(c, 12, belowLine(c), [spl(3, '1/2')]);
      await close(c, 13, belowLine(c), [spl(8, '2/1')]);
      const adj = adjustmentsOf(c);
      console.log(JSON.stringify(adj.map((a) => [a.id, a.kind, a.amountUsd, a.correction, a.postedOn])));
      const ids = adj.map((a) => a.id);
      const docs = ids.map((id) => !!c.db._get(`mandates/${c.bookId}/ideas/${c.ideaId}/evidence/${adjustmentDocIdOf(id)}`));
      console.log('evidence docs present per adjustment', JSON.stringify(docs), 'ledger dividends', ideaOf(c).ledger.dividendsUsd, 'cash', ideaOf(c).ledger.cash, 'book cash', bookOf(c).portfolio.cash);
      const evidenceCount = [...c.db._store.keys()].filter((p) => p.includes(`/ideas/${c.ideaId}/evidence/adjustment_`)).length;
      console.log('adjustments', adj.length, 'evidence documents', evidenceCount);
      expect(new Set(ids).size, 'each posted adjustment its own id and record').toBe(ids.length);
    });
  });
});

describe('lens (a) — catch-up pays once', () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  describe('catch-up', () => {
    it('OPEN idea: S3, S4 missed, the $1 dated S1 listed on S3, S4 and S5; S5 requested — proposed once, paid once on approval', async () => {
      const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      const p = belowLine(c);
      for (const i of [3, 4]) await storeCloseSnapshot(c.db, S[i], q(p, [div(1, 1)]));
      const cash0 = bookOf(c).portfolio.cash;
      for (let k = 0; k < 4; k += 1) {
        await storeCloseSnapshot(c.db, S[5], q(p, [div(1, 1)]));
        const out = await closeIdeaBook(c.db, c.bookRef, { date: S[5], now: closeNowOf(S[5]) });
        recon(c);
        if (bookOf(c).execState.lastCloseKey === S[5]) break;
        void out;
      }
      console.log('lastCloseKey', bookOf(c).execState.lastCloseKey, 'adjustments', JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.amountUsd, a.postedOn])), 'book cash delta', roundUsd(bookOf(c).portfolio.cash - cash0));
      expect(adjustmentsOf(c)).toEqual([]);
      expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ netUsd: 99.97, status: 'open' })]);
      await approveLate(c, 'idea', `cash_dividend_AAPL_${S[1]}`);
      await close(c, 6, p, [div(1, 1)]);
      expect(adjustmentsOf(c)).toHaveLength(1);
      expect(roundUsd(bookOf(c).portfolio.cash - cash0)).toBe(99.97);
    });

    it('RESULTED idea: S3, S4 missed; a 5/4 dated S1 listed after a $1 paid at S1 — named once (L-8: nothing to the treasury), rerun adds nothing', async () => {
      const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
      await close(c, 0);
      await close(c, 1, 80, [div(1, 1)]);
      expect(ideaOf(c).ledger.holdings.AAPL.exitPending).toBeTruthy();
      const { windowAt } = await import('./__testsupport__/fixtures.js');
      await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(80) });
      await close(c, 2, 80);
      expect(ideaOf(c).status).toBe('resulted');
      const t0 = bookOf(c).treasury.unreservedCash;
      for (const i of [3, 4]) await storeCloseSnapshot(c.db, S[i], q(80, [spl(1, '5/4')]));
      for (let k = 0; k < 4; k += 1) {
        await storeCloseSnapshot(c.db, S[5], q(80, [spl(1, '5/4')]));
        await closeIdeaBook(c.db, c.bookRef, { date: S[5], now: closeNowOf(S[5]) });
        recon(c);
        if (bookOf(c).execState.lastCloseKey === S[5]) break;
      }
      console.log('RESULTED lastCloseKey', bookOf(c).execState.lastCloseKey, JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.amountUsd, a.postedOn, a.postedTo])), 'treasury delta', roundUsd(bookOf(c).treasury.unreservedCash - t0));
      expect(adjustmentsOf(c)).toEqual([]);
      expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ kind: 'late_basis', netUsd: 24.99, status: 'open' })]);
      expect(bookOf(c).treasury.unreservedCash).toBe(t0);
      await rerun(c, 5);
    });
  });
});

describe('AR4-A-6 — on a resulted idea the doubt is per action', () => {
  let restoreMode;
  beforeEach(() => {
    restoreMode = setPracticeFieldModeForTests('on');
    takeSeededDbs();
    vi.stubEnv('EODHD_API_KEY', '');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
  });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  const brief = (c, f = 'ledger') => JSON.stringify(adjustmentsOf(c, f).map((a) => [a.kind, a.actionId, a.amountUsd, a.postedTo]));

  describe('resulted gate breadth', () => {
    it('RESULTED: $1 (S1) paid while held; after the result a $0.50 (S2) listed two ways, then a 5/4 dated S1 — the cash conflict on another id does not hold A\'s +$24.99 (it is proposed, named — L-8: never posted)', async () => {
      const c = await start({ names: ['AAPL'], capitalUsd: 10000, comparison: { type: 'sector_fund', symbols: ['XLK'] } });
      await close(c, 0);
      await close(c, 1, 80, [div(1, 1)]); // paid 99.97; below the line
      await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(80) }); // sold S2
      await close(c, 2, 80);
      expect(ideaOf(c).status).toBe('resulted');
      const t0 = bookOf(c).treasury.unreservedCash;
      await close(c, 3, 80, [div(2, 0.5), div(2, 0.75)]); // a CASH conflict on another id
      for (let i = 4; i <= 6; i += 1) await close(c, i, 80, [spl(1, '5/4')]);
      const idea = ideaOf(c);
      console.log('RESULTED', brief(c), 'open', JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.actionId, r.reason])),
        'closedHeldRows', JSON.stringify(idea.ledger.closedHeldRows?.map((r) => r.actionId)), 'treasury delta', roundUsd(bookOf(c).treasury.unreservedCash - t0));
      expect((idea.ledger.lateProposals || []).some((p) => p.kind === 'late_basis' && p.status === 'open' && p.netUsd === 24.99), 'the split is unambiguous; A\'s late_basis is proposed, not held behind the cash conflict').toBe(true);
      expect(adjustmentsOf(c)).toEqual([]);
      expect(bookOf(c).treasury.unreservedCash).toBe(t0);
    });

    it('CONTROL (open idea, AAPL sold, MSFT still held): the same rows — A\'s +$24.99 is proposed and, approved, posts', async () => {
      const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
      await close(c, 0);
      await close(c, 1, 80, [div(1, 1)]);
      await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(80) });
      await close(c, 2, 80);
      expect(ideaOf(c).status).not.toBe('resulted');
      await close(c, 3, 80, [div(2, 0.5), div(2, 0.75)]);
      await close(c, 4, 80, [spl(1, '5/4')]);
      await approveLate(c, 'idea', `cash_dividend_AAPL_${S[1]}`);
      await close(c, 5, 80);
      console.log('OPEN CONTROL', brief(c));
      expect(adjustmentsOf(c).some((a) => a.kind === 'late_basis' && a.amountUsd === 24.99)).toBe(true);
    });
  });
});

describe("AR4-A-1 + A-4 — an open reverse-split conflict paid over, then the founder's ratio", () => {
  let restoreMode;
  beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); vi.stubEnv('EODHD_API_KEY', ''); vi.stubGlobal('fetch', async () => { throw new Error('offline'); }); });
  afterEach(() => { restoreMode(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); takeSeededDbs(); });

  describe('open reverse', () => {
    it('1/2 vs 1/3 dated S1 + $1 dated S2, one close after the sale: the $1 waits; the founder rules 1/2 — applied, $49.99; a later none is refused', async () => {
      const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
      await close(c, 0);
      await sellOnLine(c, 1);
      await close(c, 2, belowLine(c));
      const cash0 = bookOf(c).portfolio.cash;
      await close(c, 3, belowLine(c), [spl(1, '1/2'), spl(1, '1/3'), div(2, 1)]);
      const r1 = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `reverse_split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 0.5 } }, { requestKey: 'half' });
      await close(c, 4, belowLine(c));
      const after1 = { adj: adjustmentsOf(c).map((a) => [a.kind, a.amountUsd]), open: openAmbiguities(ideaOf(c).ledger).length, rulings: (ideaOf(c).founderRulings || []).map((x) => [x.requestKey, x.outcome ?? 'applied']) };
      // The $1 waited on the conflict (AR4-A-1); the founder's 1/2 applies to the history (AR4-A-4) and the $1 is PROPOSED on
      // it (fix round, L-1), posted on the founder's approval.
      expect(r1.status).toBe(200);
      expect(after1.adj).toEqual([]);
      expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ netUsd: 49.99, status: 'open' })]);
      expect(after1.open).toBe(0);
      expect(after1.rulings).toEqual([['half', 'applied']]);
      // The record is settled: a later `none` is refused.
      const r2 = await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `reverse_split_AAPL_${S[1]}`, decision: 'none' }, { requestKey: 'none', expectOk: false });
      expect([r2.status, r2.body?.error]).toEqual([409, 'record_already_resolved']);
      await approveLate(c, 'idea', `cash_dividend_AAPL_${S[2]}`);
      await close(c, 5, belowLine(c));
      expect(adjustmentsOf(c).map((a) => [a.kind, a.amountUsd])).toEqual([['late_entitlement', 49.99]]);
      const idea = ideaOf(c);
      // (Fix round, L-6: the ruled 1/2, dated while the idea held AAPL and first listed after it sold 99.970008 shares,
      // leaves the shares SOLD different from the shares OWED at the sale (49.985004): the sale stands, and from then on
      // every row reads below full quality, the standing reason named — before the fix round this row was full quality.)
      expect(rowOf(c, 5).fullQuality).toBe(false);
      expect(rowOf(c, 5).standingQualityReasons).toEqual([expect.objectContaining({ kind: 'sale_count_differs_from_owed', symbol: 'AAPL', actionId: `reverse_split_AAPL_${S[1]}` })]);
      expect(roundUsd(bookOf(c).portfolio.cash - cash0)).toBe(49.99);
      expect(idea.ledger.dividendsUsd, 'the founder chose 1/2: $49.99 owed').toBe(49.99);
    });
  });
});
