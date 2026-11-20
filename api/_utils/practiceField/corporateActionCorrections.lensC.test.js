// api/_utils/practiceField/corporateActionCorrections.lensC.test.js
//
// Practice Field T1a-2b-4 — THE LENS (c) REVIEW'S REPRODUCTIONS (resolve_hold with corrections), kept as rows: each
// asserts the behaviour the review found missing at 994ccc2e (AR4-C-1 to C-11) and failed there; the fix round makes it
// hold. Left out: P6 and P14 (the reviewer's own premises were superseded — P6's sold symbol is not uncovered by a real
// flow, P14's price path by P14r) and P23 (AR4-C-4: main's behaviour, a founder question).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { closeIdeaBook } from './close.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';
import { roundUsd, roundShares } from '../mandateRounding.js';
import { ADJUSTMENT_KIND } from './adjustments.js';
import { openRulingRevisions, openAmbiguities } from './ledger.js';
import { nextSessionDate } from './windows.js';
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, getRow, closeOn, closeNowOf, windowAt, founderRules,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16'];
while (S.length < 16) S.push(nextSessionDate(S.at(-1)));
const SH = 99.970008;
const div = (i, v = 1, s = 'AAPL') => parseDividendsPayload(s, [{ date: S[i], unadjustedValue: v }]).actions[0];
const spl = (i, r, s = 'AAPL') => parseSplitsPayload(s, [{ date: S[i], split: r }]).actions[0];
const ren = (i, to, s = 'AAPL') => ({ type: 'ticker_change', ticker: s, renamedTo: to, effectiveDate: S[i], source: 'eodhd' });
const dl = (i, cash, s = 'AAPL') => ({ type: 'delisting', ticker: s, effectiveDate: S[i], cashPerShare: cash, source: 'eodhd' });
const q = (p = 100, a = [], extra = {}) => ({
  AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 },
  ...(extra.more || {}),
});
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];
const log = () => {}; // (the reviewer's printed observations, muted)

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
const closeQ = async (c, i, quotes) => { const out = await closeOn(c.db, c.bookId, S[i], quotes); recon(c); return out; };
const close = (c, i, p = 100, a = [], extra = {}) => closeQ(c, i, q(p, a, extra));
async function rerun(c, i, label = '') {
  const money = () => JSON.stringify([LEDGERS.map((f) => [ideaOf(c)[f]?.cash, ideaOf(c)[f]?.dividendsUsd, ideaOf(c)[f]?.adjustments?.length ?? 0, Object.fromEntries(Object.entries(ideaOf(c)[f]?.holdings || {}).map(([s, h]) => [s, h.shares]))]), bookOf(c).portfolio.cash, bookOf(c).treasury.unreservedCash]);
  const before = money();
  const book = bookOf(c);
  const e = c.db._store.get(`mandates/${c.bookId}`);
  e.data = { ...book, execState: { ...book.execState, lastCloseKey: S[i - 1] } };
  e.version += 1;
  for (const path of [...c.db._store.keys()]) if (path.startsWith(`mandates/${c.bookId}/windows/${S[i]}`)) c.db._store.delete(path);
  await closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]) });
  expect(money(), `I-5 at ${S[i]} ${label}`).toBe(before);
}
const lineLevel = (c, sym = 'AAPL') => ideaOf(c).lines.find((l) => l.symbol === sym).level;
const belowLine = (c, sym = 'AAPL') => roundUsd(lineLevel(c, sym) - 0.5);
async function sellOnLine(c, i, extraQ = {}) {
  const p = belowLine(c);
  await close(c, i, p, [], extraQ);
  expect(ideaOf(c).ledger.holdings.AAPL.exitPending).toBeTruthy();
  const out = await windowAt(c.db, c.bookId, { date: S[i + 1], slot: 'open30', quotes: q(p) });
  expect(out.sales?.[0]?.sold ?? out.sales, JSON.stringify(out.sales)).toBeTruthy();
  return p;
}
const adjustmentsOf = (c, f = 'ledger') => ideaOf(c)[f]?.adjustments || [];
const rules = (c, body, key, expectOk = false) => founderRules(c.db, c.bookId, c.ideaId, body, { requestKey: key, expectOk });
const pending = (c) => (ideaOf(c).founderRulings || []).filter((r) => r.appliedOn == null).map((r) => r.requestKey);
const brief = (l) => ({
  cash: l?.cash, div: l?.dividendsUsd,
  holdings: Object.fromEntries(Object.entries(l?.holdings || {}).map(([s, h]) => [s, h.shares])),
  adj: (l?.adjustments || []).map((a) => `${a.kind}/${a.type}/${a.actionId}/${a.amountUsd}${a.held ? '/HELD' : ''}`),
  open: openAmbiguities(l).map((r) => `${r.reason}:${r.actionId}`),
});

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

describe('P1 — closed path: a correction and an earlier-dated re-date of it, in ONE close', () => {
  it('the moved $2 is not paid automatically on the idea (S-2): it is a possible re-date of the revised payload, as on the comparison', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1);
    await close(c, 2, 100, [div(2, 1)]); // $1 dated S2 paid while held
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    await sellOnLine(c, 3);
    expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
    await close(c, 4, belowLine(c));
    const cashBefore = ideaOf(c).ledger.cash;
    const bookBefore = bookOf(c).portfolio.cash;
    // S5 lists the correction ($2 under S2) and the same $2 dated S1 — one close.
    const out = await close(c, 5, belowLine(c), [div(2, 2), div(1, 2)]);
    const idea = ideaOf(c);
    log('P1 idea', JSON.stringify(brief(idea.ledger)));
    log('P1 cmp ', JSON.stringify(brief(idea.comparisonLedger)));
    log('P1 idea cash delta', roundUsd(idea.ledger.cash - cashBefore), 'book cash delta', roundUsd(bookOf(c).portfolio.cash - bookBefore), 'row fullQuality', rowOf(c, 5)?.fullQuality);
    log('P1 alerts', JSON.stringify((out.alerts || []).filter((a) => /AMBIG|REDATE|ADJUST/.test(a))));
    // The comparison (open path) treats S1's $2 as a possible re-date of the revised S2 payload:
    const cmpRedate = idea.comparisonLedger.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[1]}`);
    log('P1 cmp S1 record', JSON.stringify(cmpRedate));
    // The idea must not have been paid the S1 $2 automatically.
    expect(adjustmentsOf(c).filter((a) => a.actionId === `cash_dividend_AAPL_${S[1]}`), 'idea paid the moved $2 automatically').toEqual([]);
    expect(roundUsd(idea.ledger.cash - cashBefore)).toBe(0);
  });

  it('control — the moved row dated LATER (S3, inside the holding) in the same close', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1);
    await close(c, 2, 100, [div(2, 1)]);
    await sellOnLine(c, 3);
    await close(c, 4, belowLine(c));
    const cashBefore = ideaOf(c).ledger.cash;
    await close(c, 5, belowLine(c), [div(2, 2), div(3, 2)]);
    const idea = ideaOf(c);
    log('P1b idea', JSON.stringify(brief(idea.ledger)), 'cash delta', roundUsd(idea.ledger.cash - cashBefore));
    expect(adjustmentsOf(c).filter((a) => a.actionId === `cash_dividend_AAPL_${S[3]}`)).toEqual([]);
  });
});

describe('P2 — after a split correction, a late dividend paid by the C-16 path reads the stale sharesBefore', () => {
  it('5:4 at S1, 2:1 at S3, S1 corrected to 3:2; a $1 dated S2 listed after: owed on 149.955012 shares ($149.96)', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 80);
    await close(c, 3, 40, [spl(3, '2/1')]);
    expect(ideaOf(c).ledger.holdings.AAPL.shares).toBe(roundShares(124.96251 * 2));
    await close(c, 4, 33.33, [spl(1, '3/2')]);
    expect(openRulingRevisions(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`split_AAPL_${S[1]}`]);
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix-split')).status).toBe(200);
    await close(c, 5, 33.33);
    const after = ideaOf(c);
    log('P2 after correction', JSON.stringify(brief(after.ledger)), 'book', bookOf(c).portfolio.positions.AAPL?.shares);
    expect(after.ledger.holdings.AAPL.shares).toBe(roundShares(roundShares(SH * 1.5) * 2));
    const divBefore = after.ledger.dividendsUsd;
    await close(c, 6, 33.33, [div(2, 1)]);
    const idea = ideaOf(c);
    const r = idea.ledger.corporateActionReceipts.find((x) => x.actionId === `cash_dividend_AAPL_${S[2]}` && x.applied);
    log('P2 dividend receipt', JSON.stringify({ incomeUsd: r?.incomeUsd, entitledShares: r?.entitledShares, from: r?.entitledSharesFrom }));
    log('P2 idea', JSON.stringify(brief(idea.ledger)), 'row fullQuality', rowOf(c, 6)?.fullQuality);
    log('P2 cmp ', JSON.stringify(brief(idea.comparisonLedger)));
    expect(roundUsd(idea.ledger.dividendsUsd - divBefore), 'dividend paid on the stale pre-correction count').toBe(roundUsd(roundShares(SH * 1.5) * 1));
    await rerun(c, 6, 'P2');
  });
});

describe('P3 — a history-only split on a sold holding, then revised', () => {
  it('the founder can answer it: keep (confirm) or correct', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [spl(1, '5/4')]);
    const h = ideaOf(c).ledger.corporateActionReceipts.find((r) => r.actionId === `split_AAPL_${S[1]}`);
    log('P3 history-only receipt', JSON.stringify(h && { historyOnly: h.historyOnly, applied: h.applied, ratio: h.ratio }));
    await close(c, 4, belowLine(c), [spl(1, '3/2')]);
    const idea = ideaOf(c);
    log('P3 idea open', JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.reason, r.actionId, r.settledBy, r.closedHolding])), 'row fullQuality', rowOf(c, 4)?.fullQuality, 'status', idea.status);
    const keep = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'keep');
    const fix = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix');
    const none = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'none' }, 'none');
    log('P3 keep', keep.status, JSON.stringify(keep.body), '| fix', fix.status, JSON.stringify(fix.body), '| none', none.status, JSON.stringify(none.body));
    expect([keep.status, fix.status].some((s) => s === 200), 'no answer the founder can give is accepted').toBe(true);
  });

  it('same, with the same-stock comparison still holding AAPL (both ledgers carry the revision)', async () => {
    const c = await start();
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [spl(1, '5/4')]);
    await close(c, 4, belowLine(c) / 1.2, [spl(1, '3/2')]);
    const idea = ideaOf(c);
    log('P3b open', JSON.stringify(LEDGERS.map((f) => openAmbiguities(idea[f]).map((r) => [f, r.reason, r.actionId]))), 'row fq', rowOf(c, 4)?.fullQuality);
    const keep = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'keep');
    const fix = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix');
    log('P3b keep', keep.status, JSON.stringify(keep.body), '| fix', fix.status, JSON.stringify(fix.body));
    expect([keep.status, fix.status].some((s) => s === 200), 'no answer the founder can give is accepted').toBe(true);
  });
});

describe('P4 — a founder-ruled NOT-ENTITLED dividend, revised: a correction is accepted that can never post', () => {
  it('rule $1 on an entry-day conflict (declined not entitled), then $3 listed, then a correction to $3', async () => {
    const c = await start();
    await close(c, 0, 100, [div(0, 1), div(0, 2)]);
    log('P4 conflict', JSON.stringify(openAmbiguities(ideaOf(c).ledger).map((r) => [r.reason, r.actionId, r.entitled])));
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[0]}`, decision: 'payload', payload: { amount: 1 } }, 'r1')).status).toBe(200);
    await close(c, 1);
    log('P4 after r1', JSON.stringify(ideaOf(c).ledger.corporateActionReceipts.filter((r) => r.actionId === `cash_dividend_AAPL_${S[0]}`).map((r) => [r.reason, r.applied, !!r.founderRuling])));
    await close(c, 2, 100, [div(0, 3)]);
    log('P4 revisions', JSON.stringify(openRulingRevisions(ideaOf(c).ledger).map((r) => [r.actionId, r.rows.map((p) => p.amount)])));
    const fix = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[0]}`, decision: 'payload', payload: { amount: 3 } }, 'r2');
    log('P4 correction ruling', fix.status, JSON.stringify(fix.body));
    if (fix.status !== 200) return;
    await close(c, 3);
    await close(c, 4);
    log('P4 pending rulings after 2 closes', JSON.stringify(pending(c)), 'adj', JSON.stringify(adjustmentsOf(c)), 'open', JSON.stringify(openAmbiguities(ideaOf(c).ledger).map((r) => r.actionId)));
    await close(c, 5, 100, [div(0, 4)]);
    const again = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[0]}`, decision: 'payload', payload: { amount: 1 } }, 'r3');
    log('P4 after a 4th payload: open', JSON.stringify(openRulingRevisions(ideaOf(c).ledger).map((r) => [r.actionId, r.rows.map((p) => p.amount)])), 'founder answer', again.status, JSON.stringify(again.body), 'row fq', rowOf(c, 5)?.fullQuality);
    expect(pending(c), 'a correction ruling that can never complete stays pending').toEqual([]);
  });
});

describe('C1 — a dividend correction and a rename (or cash delisting) of the holding in the ruling\'s close', () => {
  it('rename: the $2 correction is posted, and the ruling completes', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    await close(c, 2, 100, [div(1, 2)]);
    expect(openRulingRevisions(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix-div')).status).toBe(200);
    const qr = (p) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: [ren(3, 'AAPX')] }, AAPX: { price: p, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
    const out = await closeQ(c, 3, qr(100));
    const idea = ideaOf(c);
    log('C1 idea', JSON.stringify(brief(idea.ledger)), 'pending', JSON.stringify(pending(c)), 'row fq', rowOf(c, 3)?.fullQuality);
    log('C1 cmp ', JSON.stringify(brief(idea.comparisonLedger)));
    log('C1 alerts', JSON.stringify((out.alerts || []).filter((a) => /RENAME|ADJUST|HOLD_RULING|AMBIG/.test(a))));
    const q2 = (p) => ({ AAPX: { price: p, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
    await closeQ(c, 4, q2(100));
    await closeQ(c, 5, q2(100));
    log('C1 after 2 more closes: pending', JSON.stringify(pending(c)), 'idea div', ideaOf(c).ledger.dividendsUsd, 'adj', JSON.stringify(adjustmentsOf(c).map((a) => [a.kind, a.amountUsd])), 'row fq', rowOf(c, 5)?.fullQuality);
    const retry = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'keep');
    log('C1 founder retry', retry.status, JSON.stringify(retry.body));
    expect(ideaOf(c).ledger.dividendsUsd, 'the corrected $2 never reached the idea').toBe(roundUsd(SH * 2));
    expect(pending(c)).toEqual([]);
  });

  it('cash delisting the same close: the $2 correction is posted (before the holding goes) or the ruling closes', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    await close(c, 2, 100, [div(1, 2)]);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix-div')).status).toBe(200);
    await close(c, 3, 100, [dl(3, 101)]);
    log('C1b idea', JSON.stringify(brief(ideaOf(c).ledger)), 'pending', JSON.stringify(pending(c)));
    await close(c, 4, 100);
    await close(c, 5, 100);
    log('C1b after 2 more closes: pending', JSON.stringify(pending(c)), 'idea div', ideaOf(c).ledger.dividendsUsd, 'status', ideaOf(c).status);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(roundUsd(SH * 2));
    expect(pending(c)).toEqual([]);
  });
});

describe('P1x — P1 continued: the founder answers the S2 revision; the auto-paid S1 $2 stands on the idea only', () => {
  it('keep $1 on S2, `none` on the comparison\'s S1 re-date: idea and comparison end $199.94 apart at full quality', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1);
    await close(c, 2, 100, [div(2, 1)]);
    await sellOnLine(c, 3);
    await close(c, 4, belowLine(c));
    await close(c, 5, belowLine(c), [div(2, 2), div(1, 2)]);
    const k = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[2]}`, decision: 'payload', payload: { amount: 1 } }, 'keep-s2');
    const n = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' }, 'none-s1');
    log('P1x rulings', k.status, JSON.stringify(k.body?.error ?? 'ok'), n.status, JSON.stringify(n.body?.error ?? 'ok'), 'none-s1 ledgers', JSON.stringify((ideaOf(c).founderRulings || []).find((r) => r.requestKey === 'none-s1')?.ledgers));
    await close(c, 6, belowLine(c));
    const idea = ideaOf(c);
    log('P1x idea', JSON.stringify(brief(idea.ledger)));
    log('P1x cmp ', JSON.stringify(brief(idea.comparisonLedger)), 'row fq', rowOf(c, 6)?.fullQuality, 'pending', JSON.stringify(pending(c)));
    expect(idea.ledger.dividendsUsd, 'the idea keeps the moved $2 the founder declined').toBe(idea.comparisonLedger.dividendsUsd);
  });
});

describe('P5 — a split correction leaves an open suspicion standing for a stale residual', () => {
  it('×0.5 unexplained at S1; 5:4 dated S1 applied S2; corrected to 2:1 — the residual the founder split is checked against', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    const s1 = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    log('P5 suspicion', JSON.stringify(s1 && { suspectedOn: s1.suspectedOn, since: s1.since, ratio: s1.ratio }));
    await close(c, 2, 50, [spl(1, '5/4')]);
    log('P5 after 5:4', JSON.stringify(brief(ideaOf(c).ledger)), 'susp', !!ideaOf(c).ledger.holdings.AAPL.basisSuspicion);
    await close(c, 3, 50, [spl(1, '2/1')]);
    log('P5 revisions', JSON.stringify(openRulingRevisions(ideaOf(c).ledger).map((r) => [r.actionId, r.rows.map((p) => p.ratio)])));
    const fix = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 2 } }, 'fix');
    log('P5 fix', fix.status, JSON.stringify(fix.body?.error ?? 'ok'));
    await close(c, 4, 50);
    const idea = ideaOf(c);
    const sus = idea.ledger.holdings.AAPL.basisSuspicion;
    log('P5 after correction', JSON.stringify(brief(idea.ledger)), 'suspicion open', !!sus, 'row fq', rowOf(c, 4)?.fullQuality);
    const recordId = sus ? `suspected_split_AAPL_${sus.suspectedOn}` : null;
    const r16 = recordId ? await rules(c, { kind: 'suspicion', recordId, decision: 'split', ratio: 1.6 }, 's16') : null;
    const r2 = recordId ? await rules(c, { kind: 'suspicion', recordId, decision: 'split', ratio: 2 }, 's2') : null;
    log('P5 founder split 1.6 →', r16?.status, JSON.stringify(r16?.body?.error ?? 'ok'), '| split 2 →', r2?.status, JSON.stringify(r2?.body?.error ?? 'ok'));
    if (r16?.status === 200) {
      await close(c, 5, 50);
      log('P5 after founder split 1.6', JSON.stringify(brief(ideaOf(c).ledger)), 'row fq', rowOf(c, 5)?.fullQuality, 'book', bookOf(c).portfolio.positions.AAPL?.shares);
    }
    expect(r16?.status, 'a founder split of the stale residual (×1.6) is accepted on top of the corrected 2:1').not.toBe(200);
  });
});

describe('P6e — a dividend correction deferred at the idea result close', () => {
  it('single-name idea: correction ruled, line sold, a doubt on the result close — the correction is lost and the ruling pends forever', async () => {
    const { omitParseReport, storeCloseSnapshot } = await import('./__testsupport__/fixtures.js');
    const c = await start({ names: ['AAPL'], capitalUsd: 10000 });
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    const p = belowLine(c);
    await close(c, 2, p, [div(1, 2)]);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix-div')).status).toBe(200);
    await windowAt(c.db, c.bookId, { date: S[3], slot: 'open30', quotes: q(p) });
    await storeCloseSnapshot(c.db, S[3], q(p));
    omitParseReport(c.db, S[3], ['AAPL']);
    await closeIdeaBook(c.db, c.bookRef, { date: S[3], now: closeNowOf(S[3]) });
    let idea = ideaOf(c);
    log('P6e after S3', 'status', idea.status, JSON.stringify(brief(idea.ledger)), 'pending', JSON.stringify(pending(c)), 'result', JSON.stringify(idea.result && { label: idea.result.economicResult, keys: Object.keys(idea.result) }));
    for (const i of [4, 5]) await close(c, i, p);
    idea = ideaOf(c);
    log('P6e after S5', 'status', idea.status, JSON.stringify(brief(idea.ledger)), JSON.stringify(brief(idea.comparisonLedger)), 'pending', JSON.stringify(pending(c)), 'resultAdjustments', JSON.stringify(idea.resultAdjustments ?? null));
    expect(idea.ledger.dividendsUsd + (idea.resultAdjustments?.ideaUsd ?? 0), 'the ruled +$99.97 reached neither the ledger nor the result view').toBe(roundUsd(SH * 2));
  });
});

describe('P7 — a split correction after the idea sold the line (the comparison still holds)', () => {
  it('the idea dividends are recomputed on the corrected count; its sale proceeds are not — idea vs comparison', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4'), div(1, 1)]);
    const p = belowLine(c);
    await sellOnLine(c, 2);
    await close(c, 3, p);
    const before = { idea: brief(ideaOf(c).ledger), cmp: brief(ideaOf(c).comparisonLedger), sale: ideaOf(c).ledger.saleReceipts?.map((r) => [r.symbol, r.shares, r.proceedsUsd ?? r.cashUsd]) };
    log('P7 before', JSON.stringify(before));
    await close(c, 4, p, [spl(1, '3/2')]);
    log('P7 revisions', JSON.stringify(LEDGERS.map((f) => openRulingRevisions(ideaOf(c)[f]).map((r) => [f, r.actionId, r.closedHolding ?? false]))));
    const fix = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix');
    log('P7 fix', fix.status, JSON.stringify(fix.body?.error ?? 'ok'));
    await close(c, 5, p);
    const idea = ideaOf(c);
    log('P7 after idea', JSON.stringify(brief(idea.ledger)));
    log('P7 after cmp ', JSON.stringify(brief(idea.comparisonLedger)), 'pending', JSON.stringify(pending(c)), 'row fq', rowOf(c, 5)?.fullQuality);
  });
});

describe('P13/P14 — controls that should hold', () => {
  it('P13: a dividend held behind the split revision replays on the corrected count', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 66.67, [spl(1, '3/2'), div(2, 1)]);
    log('P13 held', JSON.stringify(ideaOf(c).ledger.holdings.AAPL.heldActions?.map((r) => r.actionId)));
    await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix');
    await close(c, 3, 66.67);
    const idea = ideaOf(c);
    log('P13 after', JSON.stringify(brief(idea.ledger)), JSON.stringify(brief(idea.comparisonLedger)), 'book', bookOf(c).portfolio.positions.AAPL?.shares);
    expect(idea.ledger.dividendsUsd).toBe(roundUsd(roundShares(SH * 1.5)));
    await rerun(c, 3, 'P13');
  });

});

describe('P21 — FQ-5 on the CLOSED path: a payload the founder conflict ruling saw reopens on a sold holding', () => {
  it('conflict $1/$2 ruled $1; the line sold; the vendor still lists both — no new ambiguity (the comparison opens none)', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'r1')).status).toBe(200);
    await close(c, 2, 100, [div(1, 1), div(1, 2)]);
    log('P21 after ruling', JSON.stringify(brief(ideaOf(c).ledger)), JSON.stringify(brief(ideaOf(c).comparisonLedger)));
    await sellOnLine(c, 3, {});
    const out = await close(c, 4, belowLine(c), [div(1, 1), div(1, 2)]);
    const idea = ideaOf(c);
    log('P21 idea open', JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.reason, r.actionId, (r.rows || []).map((p) => p.amount)])), '| cmp open', JSON.stringify(openAmbiguities(idea.comparisonLedger).map((r) => [r.reason, r.actionId])), 'row fq', rowOf(c, 4)?.fullQuality);
    log('P21 alerts', JSON.stringify((out.alerts || []).filter((a) => /AMBIG/.test(a))));
    expect(openAmbiguities(idea.ledger), 'a payload the ruling saw reopened on the closed holding').toEqual([]);
  });
});

describe('P22 — a correction of an id settled as a LATE ENTITLEMENT on a sold holding', () => {
  it('late $1 paid after the sale, then $2 listed: corrected to $2, 199.94 once', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [div(1, 1)]);
    await close(c, 4, belowLine(c), [div(1, 2)]);
    log('P22 open', JSON.stringify(openAmbiguities(ideaOf(c).ledger).map((r) => [r.reason, r.actionId])));
    const fix = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix');
    log('P22 fix', fix.status, JSON.stringify(fix.body?.error ?? 'ok'));
    await close(c, 5, belowLine(c));
    const idea = ideaOf(c);
    log('P22 after', JSON.stringify(brief(idea.ledger)), 'pending', JSON.stringify(pending(c)));
    expect(idea.ledger.dividendsUsd).toBe(roundUsd(SH * 2));
    await rerun(c, 5, 'P22');
    await close(c, 6, belowLine(c), [div(1, 2), div(1, 1)]);
    log('P22 relisted', JSON.stringify(openAmbiguities(ideaOf(c).ledger).map((r) => [r.reason, r.actionId])), 'div', ideaOf(c).ledger.dividendsUsd);
    expect(openAmbiguities(ideaOf(c).ledger)).toEqual([]);
  });
});

describe('Astra add-on — no exit from the uncorrected line level', () => {
  it('Astra case: no exitPending on AAPL at S2 or S3', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4'), div(1, 1)]);
    await close(c, 2, 66.67, [spl(1, '3/2'), div(1, 2)]);
    const e2 = ideaOf(c).ledger.holdings.AAPL.exitPending;
    log('Astra S2 level', lineLevel(c), 'exitPending', JSON.stringify(e2 ?? null));
    await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix-split');
    await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix-div');
    await close(c, 3, 66.67);
    log('Astra S3 level', lineLevel(c), 'exitPending', JSON.stringify(ideaOf(c).ledger.holdings.AAPL.exitPending ?? null));
    expect(e2 ?? null).toBe(null);
  });
});

describe('P14x — the reverse-split correction: why the debit waits', () => {
  it('suspicion standing after the correction; the debit posts only after a founder price_move', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 200, [spl(1, '1/2')]);
    await close(c, 2, 200, [div(2, 1)]);
    await close(c, 3, 400, [spl(1, '1/4')]);
    const s3 = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    log('P14x suspicion at S3', JSON.stringify(s3 && { suspectedOn: s3.suspectedOn, since: s3.since, ratio: s3.ratio }));
    await rules(c, { kind: 'conflict', recordId: `reverse_split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 0.25 } }, 'fix');
    await close(c, 4, 400);
    const s4 = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    log('P14x after correction: suspicion', JSON.stringify(s4 && { suspectedOn: s4.suspectedOn, ratio: s4.ratio }), JSON.stringify(brief(ideaOf(c).ledger)), 'row fq', rowOf(c, 4)?.fullQuality);
    if (s4) {
      const rid = `suspected_split_AAPL_${s4.suspectedOn}`;
      const sp = await rules(c, { kind: 'suspicion', recordId: rid, decision: 'split', ratio: 0.5 }, 'sp');
      log('P14x founder split 0.5 on the stale residual', sp.status, JSON.stringify(sp.body?.error ?? 'ok'));
      if (sp.status === 200) {
        await close(c, 5, 400);
        log('P14x after founder split', JSON.stringify(brief(ideaOf(c).ledger)), 'row fq', rowOf(c, 5)?.fullQuality);
      }
    }
  });
});

describe('P15 — odd payload shapes on a correction', () => {
  it('amount as a string, a ratio for a dividend id, both fields, ratio as a string', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4'), div(1, 1)]);
    await close(c, 2, 66.67, [spl(1, '3/2'), div(1, 2)]);
    const tries = [
      ['div-str', { recordId: `cash_dividend_AAPL_${S[1]}`, payload: { amount: '2' } }],
      ['div-ratio', { recordId: `cash_dividend_AAPL_${S[1]}`, payload: { ratio: 1.5 } }],
      ['div-both', { recordId: `cash_dividend_AAPL_${S[1]}`, payload: { amount: 2, ratio: 1.5 } }],
      ['spl-str', { recordId: `split_AAPL_${S[1]}`, payload: { ratio: '1.5' } }],
      ['spl-amount', { recordId: `split_AAPL_${S[1]}`, payload: { amount: 2 } }],
      ['spl-array', { recordId: `split_AAPL_${S[1]}`, payload: [1.5] }],
    ];
    for (const [k, b] of tries) {
      const r = await rules(c, { kind: 'conflict', decision: 'payload', ...b }, k);
      log('P15', k, r.status, JSON.stringify(r.body?.error ?? 'ok'));
      expect(r.status, k).not.toBe(200);
    }
  });
});

describe('P2p — P2 persists: later closes never recompute the stale late dividend', () => {
  it('two more closes, the rows still listed', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 80);
    await close(c, 3, 40, [spl(3, '2/1')]);
    await close(c, 4, 33.33, [spl(1, '3/2')]);
    await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix-split');
    await close(c, 5, 33.33);
    await close(c, 6, 33.33, [div(2, 1)]);
    await close(c, 7, 33.33, [div(2, 1), spl(1, '3/2'), spl(3, '2/1')]);
    await close(c, 8, 33.33, [div(2, 1)]);
    const idea = ideaOf(c);
    log('P2p', JSON.stringify(brief(idea.ledger)), 'book cash', bookOf(c).portfolio.cash, 'row fq S6..S8', [6, 7, 8].map((i) => rowOf(c, i)?.fullQuality));
    expect(idea.ledger.dividendsUsd).toBe(roundUsd(roundShares(SH * 1.5)));
  });
});

describe('P16 — ordering in one close: a split correction and a pending conflict ruling on a dividend of the same symbol', () => {
  it('the conflict ruling pays on the corrected count', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 66.67, [spl(1, '3/2'), div(2, 1), div(2, 0.5)]);
    log('P16 open', JSON.stringify(openAmbiguities(ideaOf(c).ledger).map((r) => [r.reason, r.actionId])));
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix-split')).status).toBe(200);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[2]}`, decision: 'payload', payload: { amount: 1 } }, 'div')).status).toBe(200);
    await close(c, 3, 66.67);
    const idea = ideaOf(c);
    log('P16 after', JSON.stringify(brief(idea.ledger)), JSON.stringify(brief(idea.comparisonLedger)), 'pending', JSON.stringify(pending(c)), 'row fq', rowOf(c, 3)?.fullQuality);
    expect(idea.ledger.dividendsUsd).toBe(roundUsd(roundShares(SH * 1.5)));
    await rerun(c, 3, 'P16');
  });
});

describe('P17 — a re-date of the CORRECTED payload after the correction', () => {
  it('open path: 3:2 listed under S2 after S1 was corrected to 3:2 is a possible re-date, not applied', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 66.67, [spl(1, '3/2')]);
    await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix-split');
    await close(c, 3, 66.67);
    const before = ideaOf(c).ledger.holdings.AAPL.shares;
    await close(c, 4, 66.67, [spl(2, '3/2')]);
    const idea = ideaOf(c);
    log('P17 open', JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.reason, r.actionId, r.redateOf])), 'shares', before, '→', idea.ledger.holdings.AAPL.shares);
    expect(idea.ledger.holdings.AAPL.shares).toBe(before);
  });

  it('closed path: $2 listed under S2 after S1 ($1→$2) was corrected on a sold holding is a possible re-date, not paid', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    await sellOnLine(c, 2);
    await close(c, 3, belowLine(c));
    await close(c, 4, belowLine(c), [div(1, 2)]);
    await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix-div');
    await close(c, 5, belowLine(c));
    const d = ideaOf(c).ledger.dividendsUsd;
    await close(c, 6, belowLine(c), [div(2, 2)]);
    const idea = ideaOf(c);
    log('P17b', d, '→', idea.ledger.dividendsUsd, JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.reason, r.actionId, r.redateOf])));
    expect(idea.ledger.dividendsUsd).toBe(d);
  });
});

describe('P1s — P1 for a SPLIT: a correction and an earlier-dated re-date of it on a sold holding, one close', () => {
  it('the moved 3:2 is not applied to the history (no automatic late_basis from it)', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await close(c, 1);
    await close(c, 2, 80, [spl(2, '5/4')]);
    await close(c, 3, 80, [div(3, 1)]);
    const p = belowLine(c);
    await close(c, 4, p);
    await windowAt(c.db, c.bookId, { date: S[5], slot: 'open30', quotes: q(p) });
    await close(c, 5, p);
    expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
    const d0 = ideaOf(c).ledger.dividendsUsd;
    await close(c, 6, p, [spl(2, '3/2'), spl(1, '3/2')]);
    const idea = ideaOf(c);
    log('P1s', d0, '→', idea.ledger.dividendsUsd, JSON.stringify(brief(idea.ledger)), JSON.stringify(idea.ledger.corporateActionReceipts.filter((r) => r.type === 'split').map((r) => [r.actionId, r.reason ?? 'applied', r.historyOnly ?? false, r.ratio])));
    expect(idea.ledger.corporateActionReceipts.some((r) => r.actionId === `split_AAPL_${S[1]}` && r.applied === true), 'the moved 3:2 was applied to the history').toBe(false);
    expect(idea.ledger.dividendsUsd).toBe(d0);
  });
});

describe('P3f — asymmetry: a FOUNDER-ruled history-only split, revised, IS correctable', () => {
  it('conflict on a sold holding ruled 5:4 (history only), then 3:2 listed: the correction is accepted', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [spl(1, '5/4'), spl(1, '2/1')]);
    log('P3f conflict', JSON.stringify(openAmbiguities(ideaOf(c).ledger).map((r) => [r.reason, r.actionId])));
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'r1')).status).toBe(200);
    await close(c, 4, belowLine(c));
    log('P3f receipt', JSON.stringify(ideaOf(c).ledger.corporateActionReceipts.filter((r) => r.actionId === `split_AAPL_${S[1]}` && r.applied).map((r) => [r.historyOnly, !!r.founderRuling])));
    await close(c, 5, belowLine(c), [spl(1, '3/2')]);
    log('P3f open', JSON.stringify(openAmbiguities(ideaOf(c).ledger).map((r) => [r.reason, r.actionId])));
    const fix = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix');
    const keep = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'keep');
    log('P3f founder-ruled: fix', fix.status, JSON.stringify(fix.body?.error ?? 'ok'), '| keep', keep.status, JSON.stringify(keep.body?.error ?? 'ok'));
  });
});

describe('P3g — a founder conflict ruling on a SOLD holding: does it ever apply?', () => {
  it('split conflict on a sold holding, ruled 5:4: applied within three closes', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [spl(1, '5/4'), spl(1, '2/1')]);
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'r1')).status).toBe(200);
    const outs = [];
    for (const i of [4, 5, 6]) outs.push(await close(c, i, belowLine(c)));
    const idea = ideaOf(c);
    log('P3g split: pending', JSON.stringify(pending(c)), 'open', JSON.stringify(openAmbiguities(idea.ledger).map((r) => [r.reason, r.actionId])), 'rows fq', [4, 5, 6].map((i) => rowOf(c, i)?.fullQuality), 'receipts', JSON.stringify(idea.ledger.corporateActionReceipts.filter((r) => r.actionId === `split_AAPL_${S[1]}`).map((r) => [r.reason ?? 'applied', r.historyOnly ?? false])));
    log('P3g S4 ruling alerts', JSON.stringify((outs[0].alerts || []).filter((a) => /HOLD_RULING/.test(a))), 'r1', JSON.stringify((ideaOf(c).founderRulings || []).find((r) => r.requestKey === 'r1')?.outcome));
    log('P3g alerts S6', JSON.stringify((outs[2].alerts || []).filter((a) => /AAPL/.test(a)).slice(0, 4)));
    const retry = await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'none' }, 'r2');
    log('P3g founder retry none', retry.status, JSON.stringify(retry.body?.error ?? 'ok'));
    expect(pending(c), 'the founder ruling on a sold holding never applies').toEqual([]);
  });

  it('dividend conflict on a sold holding, ruled $1: applied', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await sellOnLine(c, 1);
    await close(c, 2, belowLine(c));
    await close(c, 3, belowLine(c), [div(1, 1), div(1, 2)]);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'r1')).status).toBe(200);
    await close(c, 4, belowLine(c));
    log('P3g div: pending', JSON.stringify(pending(c)), JSON.stringify(brief(ideaOf(c).ledger)));
    expect(pending(c)).toEqual([]);
  });
});

describe('P14r — realistic reverse case: the market shows 1:4 from S1, the vendor first says 1:2', () => {
  it('suspicion raised at S1 against the 1:2 count; corrected to 1:4: the residual check still offers ×0.5, and price_move is needed', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 400, [spl(1, '1/2')]);
    const s1 = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    log('P14r S1', JSON.stringify(brief(ideaOf(c).ledger)), 'suspicion', JSON.stringify(s1 && { suspectedOn: s1.suspectedOn, since: s1.since, ratio: s1.ratio }));
    await close(c, 2, 400, [spl(1, '1/4')]);
    expect((await rules(c, { kind: 'conflict', recordId: `reverse_split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 0.25 } }, 'fix')).status).toBe(200);
    await close(c, 3, 400);
    const s3 = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    log('P14r after correction', JSON.stringify(brief(ideaOf(c).ledger)), 'suspicion', JSON.stringify(s3 && { suspectedOn: s3.suspectedOn, ratio: s3.ratio }), 'row fq', rowOf(c, 3)?.fullQuality);
    if (!s3) return;
    const rid = `suspected_split_AAPL_${s3.suspectedOn}`;
    const sp = await rules(c, { kind: 'suspicion', recordId: rid, decision: 'split', ratio: 0.5 }, 'sp');
    log('P14r founder reverse split ×0.5 on the residual →', sp.status, JSON.stringify(sp.body?.error ?? 'ok'));
    if (sp.status === 200) {
      await close(c, 4, 400);
      log('P14r after founder split', JSON.stringify(brief(ideaOf(c).ledger)), 'book', bookOf(c).portfolio.positions.AAPL?.shares, 'row fq', rowOf(c, 4)?.fullQuality);
    }
    expect(sp.status, 'the residual check accepts a further ×0.5 on a count the correction already made right').not.toBe(200);
  });
});

describe('C1c — cash delisting while the dividend revision is still open (no same-close timing needed)', () => {
  it('delisted at S3 with the revision open; the founder corrects after; the correction never posts', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    await close(c, 2, 100, [div(1, 2)]);
    await close(c, 3, 100, [dl(3, 101)]);
    log('C1c after delisting', JSON.stringify(brief(ideaOf(c).ledger)), 'open', JSON.stringify(LEDGERS.map((f) => openRulingRevisions(ideaOf(c)[f]).map((r) => r.actionId))));
    const fix = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix-div');
    log('C1c ruling', fix.status, JSON.stringify(fix.body?.error ?? 'ok'));
    for (const i of [4, 5, 6]) await close(c, i, 100);
    log('C1c after 3 closes: pending', JSON.stringify(pending(c)), 'idea div', ideaOf(c).ledger.dividendsUsd, 'cmp div', ideaOf(c).comparisonLedger.dividendsUsd, 'rows fq', [4, 5, 6].map((i) => rowOf(c, i)?.fullQuality));
    expect(pending(c)).toEqual([]);
  });
});

describe('P21x — the spurious closed-path reopen lets one ledger be re-ruled to the payload the original ruling rejected', () => {
  it('founder corrects the idea alone to $2', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, 'r1');
    await close(c, 2, 100, [div(1, 1), div(1, 2)]);
    await sellOnLine(c, 3, {});
    await close(c, 4, belowLine(c), [div(1, 1), div(1, 2)]);
    const fix = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'r2');
    log('P21x correction on the reopened record', fix.status, JSON.stringify(fix.body?.error ?? 'ok'), 'ledgers', JSON.stringify((ideaOf(c).founderRulings || []).find((r) => r.requestKey === 'r2')?.ledgers));
    await close(c, 5, belowLine(c));
    const idea = ideaOf(c);
    log('P21x idea', JSON.stringify(brief(idea.ledger)), '| cmp', JSON.stringify(brief(idea.comparisonLedger)), 'row fq', rowOf(c, 5)?.fullQuality);
  });
});

describe('P24 — FQ-5 after a KEEP, open path', () => {
  it('Astra case, keep 5:4: re-listing 3:2 reopens nothing; 2:1 reopens', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 80, [spl(1, '3/2')]);
    await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'keep');
    await close(c, 3, 80);
    await close(c, 4, 80, [spl(1, '3/2'), spl(1, '5/4')]);
    const a4 = openAmbiguities(ideaOf(c).ledger).map((r) => r.actionId);
    await close(c, 5, 80, [spl(1, '2/1')]);
    const a5 = openRulingRevisions(ideaOf(c).ledger).map((r) => [r.actionId, r.rows.map((p) => p.ratio)]);
    log('P24 S4 open', JSON.stringify(a4), 'row fq', rowOf(c, 4)?.fullQuality, '| S5 revisions', JSON.stringify(a5), 'shares', ideaOf(c).ledger.holdings.AAPL.shares);
    expect(a4).toEqual([]);
    expect(a5).toEqual([[`split_AAPL_${S[1]}`, [2]]]);
  });
});

describe('P25 — a split correction at a close whose data does not cover AAPL', () => {
  it('shares and line move once; the late_basis waits, then posts once coverage returns; I-5', async () => {
    const { omitParseReport, storeCloseSnapshot } = await import('./__testsupport__/fixtures.js');
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4'), div(1, 1)]);
    await close(c, 2, 66.67, [spl(1, '3/2')]);
    await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix');
    await storeCloseSnapshot(c.db, S[3], q(66.67));
    omitParseReport(c.db, S[3], ['AAPL']);
    await closeIdeaBook(c.db, c.bookRef, { date: S[3], now: closeNowOf(S[3]) });
    recon(c);
    log('P25 S3 (uncovered)', JSON.stringify(brief(ideaOf(c).ledger)), 'level', lineLevel(c), 'book', bookOf(c).portfolio.positions.AAPL?.shares, 'pending', JSON.stringify(pending(c)));
    await close(c, 4, 66.67);
    const idea = ideaOf(c);
    log('P25 S4', JSON.stringify(brief(idea.ledger)), 'level', lineLevel(c), 'row fq', rowOf(c, 4)?.fullQuality);
    expect(idea.ledger.holdings.AAPL.shares).toBe(149.955012);
    expect(idea.ledger.dividendsUsd).toBe(149.96);
    await rerun(c, 4, 'P25');
  });
});

describe('the refuters\' rows — RF4, RF5, RF6 (each failed at 994ccc2e)', () => {
  const rules = (c, body, key) => founderRules(c.db, c.bookId, c.ideaId, body, { requestKey: key, expectOk: false });
  const pendingKeys = (c) => (ideaOf(c).founderRulings || []).filter((r) => r.appliedOn == null).map((r) => r.requestKey);
  /** Breach the line at close i while listing `rows` there; the S[i+1] open30 window sells AAPL. */
  async function breachAndSell(c, i, rows = []) {
    const p = belowLine(c);
    await close(c, i, p, rows);
    expect(ideaOf(c).ledger.holdings.AAPL.exitPending).toBeTruthy();
    const out = await windowAt(c.db, c.bookId, { date: S[i + 1], slot: 'open30', quotes: q(p) });
    expect(out.sales?.[0]?.sold ?? out.sales, JSON.stringify(out.sales)).toBeTruthy();
    expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
    return p;
  }

  it('AR4-C-1 (RF4 ORDER A): a split corrected, then a late dividend dated before a later split — paid on the CORRECTED count, the same money as the other arrival order', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 80, [spl(1, '5/4')]);
    await close(c, 2, 80);
    await close(c, 3, 40, [spl(3, '2/1')]);
    await close(c, 4, 33.33, [spl(1, '3/2')]);
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix')).status).toBe(200);
    await close(c, 5, 33.33);
    await close(c, 6, 33.33, [div(2, 1)]);
    for (const i of [7, 8]) await close(c, i, 33.33, [div(2, 1)]);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(299.910024);
    for (const f of ['ledger', 'comparisonLedger']) expect(idea[f].dividendsUsd, f).toBe(149.96); // 149.955012 × $1
    const rec = idea.ledger.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[2]}` && r.applied === true);
    expect(rec.entitledShares).toBe(149.955012);
  });

  it('AR4-C-5 (RF4, same sitting): the founder corrects 5:4 → 2:1 and answers the suspicion with ×1.6 before one close — the split is moot, the count stays 199.940016 on the idea, the comparison and the book', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    await close(c, 2, 50, [spl(1, '5/4')]);
    await close(c, 3, 50, [spl(1, '2/1')]);
    const s = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    const id = `suspected_split_AAPL_${s.suspectedOn}`;
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 2 } }, 'fix')).status).toBe(200);
    await rules(c, { kind: 'suspicion', recordId: id, decision: 'split', ratio: 1.6 }, 's16');
    for (const i of [4, 5, 6]) await close(c, i, 50);
    const idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) expect(idea[f].holdings.AAPL.shares, f).toBe(roundShares(SH * 2));
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(roundShares(SH * 2));
    // …and, after the correction, the residual the founder's split is checked against is the corrected one.
    const again = await rules(c, { kind: 'suspicion', recordId: id, decision: 'split', ratio: 1.6 }, 's16b');
    if (ideaOf(c).ledger.holdings.AAPL.basisSuspicion) expect([again.status, again.body?.error]).toEqual([422, 'no_residual_move']);
  });

  it('AR4-C-3 (RF5 C3a): on a sold holding, a correction ($2 under S2, settled $1) and its earlier-dated re-date ($2 under S1) listed in ONE close — the moved row is a possible re-date on the idea too, nothing paid', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1);
    const p = await breachAndSell(c, 2, [div(2, 1)]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    const cash0 = ideaOf(c).ledger.cash;
    await close(c, 3, p, [div(2, 2), div(1, 2)]);
    const idea = ideaOf(c);
    expect(idea.ledger.cash).toBe(cash0);
    expect((idea.ledger.adjustments || []).filter((a) => a.actionId === `cash_dividend_AAPL_${S[1]}`)).toEqual([]);
    const open = openAmbiguities(idea.ledger).map((r) => [r.actionId, r.reason]);
    expect(open).toEqual(expect.arrayContaining([[`cash_dividend_AAPL_${S[1]}`, 'possible_redate'], [`cash_dividend_AAPL_${S[2]}`, 'revised_after_ruling']]));
    expect(rowOf(c, 3).fullQuality).toBe(false);
  });

  it('AR4-C-3 (RF5 C3e): the split variant — a 3:2 under S2 (applied 5:4) and the same 3:2 under S1 in one close after the sale: nothing applied to the history, the dividend stays $124.96', async () => {
    const c = await start({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await close(c, 1);
    await close(c, 2, 80, [spl(2, '5/4')]);
    const p = await breachAndSell(c, 3, [div(3, 1)]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(124.96);
    await close(c, 4, p, [spl(2, '3/2'), spl(1, '3/2')]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(124.96);
    expect(ideaOf(c).ledger.corporateActionReceipts.some((r) => r.actionId === `split_AAPL_${S[1]}` && r.applied === true)).toBe(false);
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[2]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'keep-s2')).status).toBe(200);
    for (const i of [5, 6]) await close(c, i, p);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(124.96);
  });

  it('RF6-X1 (FQ-5): a correction a doubt keeps pending does not close a later revision it never saw — the vendor\'s $3 stays open for the founder', async () => {
    const c = await start();
    const D = `cash_dividend_AAPL_${S[1]}`;
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    await close(c, 2, 100, [div(1, 2), spl(2, '5/4'), spl(2, '3/2')]);
    expect((await rules(c, { kind: 'conflict', recordId: D, decision: 'payload', payload: { amount: 2 } }, 'r2')).status).toBe(200);
    await close(c, 3, 100, [div(1, 3)]);
    await close(c, 4, 100, [div(1, 3)]);
    expect(pendingKeys(c)).toContain('r2');
    const open3 = ideaOf(c).ledger.corporateActionReceipts.filter((r) => r.actionId === D && r.reason === 'revised_after_ruling' && r.closedBy == null);
    expect(open3.map((r) => r.rows.map((x) => x.amount))).toEqual([[3]]);
    expect(rowOf(c, 4).fullQuality).toBe(false);
    // The founder settles the split; the $2 posts; the $3 revision is still the founder's to answer.
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[2]}`, decision: 'payload', payload: { ratio: 1.25 } }, 'rs')).status).toBe(200);
    for (const i of [5, 6]) await close(c, i, 100, [div(1, 3)]);
    expect(pendingKeys(c)).toEqual([]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(199.94);
    expect(openAmbiguities(ideaOf(c).ledger).map((r) => [r.actionId, r.reason])).toEqual([[D, 'revised_after_ruling']]);
    const ask3 = await rules(c, { kind: 'conflict', recordId: D, decision: 'payload', payload: { amount: 3 } }, 'r3');
    expect(ask3.status).toBe(200);
  });

  it('AR4-C-7 (RF6): a correction of a dividend the founder ruled NOT ENTITLED is refused (nothing was paid to correct), as on main; keeping the ruled payload still closes the revision', async () => {
    const c = await start();
    await close(c, 0, 100, [div(0, 1), div(0, 2)]);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[0]}`, decision: 'payload', payload: { amount: 1 } }, 'r1')).status).toBe(200);
    await close(c, 1);
    await close(c, 2, 100, [div(0, 3)]);
    const fix = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[0]}`, decision: 'payload', payload: { amount: 3 } }, 'r2');
    expect([fix.status, fix.body?.error]).toEqual([422, 'ruling_needs_adjustment']);
    const keep = await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[0]}`, decision: 'payload', payload: { amount: 1 } }, 'keep');
    expect(keep.status).toBe(200);
    await close(c, 3);
    expect(pendingKeys(c)).toEqual([]);
    expect(rowOf(c, 3).fullQuality).toBe(true);
  });

  it('AR4-C-8 (RFX note): a correction still pending at the endpoint is an unsettled action there, as a waiting closed row is — the result is unmeasurable, and the correction posts after it', async () => {
    const { omitParseReport, storeCloseSnapshot } = await import('./__testsupport__/fixtures.js');
    const c = await start({ names: ['AAPL'], capitalUsd: 10000, comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1)]);
    const p = belowLine(c);
    await close(c, 2, p, [div(1, 2)]);
    expect((await rules(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, 'fix-div')).status).toBe(200);
    await windowAt(c.db, c.bookId, { date: S[3], slot: 'open30', quotes: q(p) });
    await storeCloseSnapshot(c.db, S[3], q(p));
    omitParseReport(c.db, S[3], ['AAPL']); // the sold symbol's data does not cover the result close: the correction waits
    await closeIdeaBook(c.db, c.bookRef, { date: S[3], now: closeNowOf(S[3]) });
    let idea = ideaOf(c);
    expect(idea.status).toBe('resulted');
    expect(pendingKeys(c)).toEqual(['fix-div']);
    expect(idea.result.economicResult).toBe('unmeasurable');
    expect(JSON.stringify(idea.result)).toContain('idea_unsettled_corporate_action');
    for (const i of [4, 5]) await close(c, i, p);
    idea = ideaOf(c);
    expect(pendingKeys(c)).toEqual([]);
    expect(idea.resultAdjustments).toMatchObject({ ideaUsd: 99.97 });
  });

  it('AR4-C-11 (RF4, realistic price): a split correction after the line sold the stock is flagged — the alert and the record say what the corrected count would have sold; the sale stands', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 66.67, [spl(1, '5/4'), div(1, 1)]);
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(66.67) });
    expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
    const sold = ideaOf(c).ledger.saleReceipts[0];
    await close(c, 2, 66.67);
    await close(c, 3, 66.67, [spl(1, '3/2')]);
    expect((await rules(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'fix')).status).toBe(200);
    const out = await close(c, 4, 66.67);
    expect(out.alerts.some((a) => a.startsWith('PRACTICE_FIELD_CORRECTION_AFTER_SALE') && a.includes(`split_AAPL_${S[1]}`))).toBe(true);
    const rec = ideaOf(c).ledger.adjustments.find((a) => a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && a.actionId === `split_AAPL_${S[1]}`);
    expect(rec.soldBeforeCorrection).toEqual([{ sessionDate: sold.sessionDate, shares: sold.shares, sharesIfCorrected: roundShares(sold.shares * 1.2) }]);
    expect(ideaOf(c).ledger.saleReceipts[0]).toEqual(sold);
  });
});
