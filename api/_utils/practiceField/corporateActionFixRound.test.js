// api/_utils/practiceField/corporateActionFixRound.test.js
//
// Practice Field T1a-2b-3 — THE FIX ROUND FOR ASTRA'S FINAL REVIEW (docs/audits/20261118_ASTRA_REVIEW_T1A2B3.md), in the
// scope the founder set: T2D-01 (with the agreed Q10), T2D-02, T2D-06, T2D-07, T2D-08, T2D-09, T2D-10, and T2D-11's guard
// (every share-basis receipt carries the count before and after it). Each row is Astra's reproduction, ported from her
// probes (run/probe/independent.test.js, more.test.js) onto the committed fixtures, with the outcome the fix must give.
// T2D-03, -04, -05 and -12 are carried to T1a-2b-4; T2D-13 and -14 to T5 (the build report's §10).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { assertReconciled } from './reconcile.js';
import { closeIdeaBook, catchUpIdeaBook } from './close.js';
import { runFounderAction } from './founderControls.js';
import { parseSplitsPayload, parseDividendsPayload } from '../mandateCorporateActions.js';
import { applyLedgerActions, unsettledConflicts, saleHeldBackBy, heldActionRecords } from './ledger.js';
import { planHoldRuling, applyFounderRulings, markRulingsApplied } from './holdRulings.js';
import { nextSessionDate } from './windows.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, contractOf, getBook, getIdea, getRow, closeNowOf, etIso, storeCloseSnapshot, placeSnapshot, closeSnapshot,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16'];
while (S.length < 26) S.push(nextSessionDate(S.at(-1)));
/** A split or reverse split row as the vendor's parser emits it ('3/2' is a 3-for-2). */
const spl = (i, v = '3/2', s = 'AAPL') => parseSplitsPayload(s, [{ date: S[i], split: v }]).actions[0];
/** A cash dividend row as the vendor's parser emits it. */
const div = (i, v = 1, s = 'AAPL') => parseDividendsPayload(s, [{ date: S[i], unadjustedValue: v }]).actions[0];
/** The session's quotes: AAPL at `p` with `a` listed for it; everything else flat. */
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
const raw = (c, i, options = {}) => closeIdeaBook(c.db, c.bookRef, { date: S[i], now: closeNowOf(S[i]), ...options });
/** The stored daily layer of S[i] says AAPL's corporate-action fetch failed. */
function failed(c, i) {
  const path = `mandateUniverseDaily/${S[i]}`;
  const e = c.db._store.get(path);
  e.data.symbols.AAPL.caFetchFailed = true;
  e.version += 1;
}
const rule = (c, body, key = 'founder-r1', at = null) => runFounderAction(c.db, {
  uid: 'owner-1', body: { action: 'resolve_hold', requestKey: key, ideaId: c.ideaId, ...body },
  nowIso: at ?? etIso(bookOf(c).execState.lastCloseKey, 18, 0),
});
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];
/** Every id an idea's ledgers hold both as applied and as declined (T2D-06: must always be empty). */
const appliedAndDeclined = (idea) => LEDGERS.flatMap((f) => {
  const declined = new Set(idea[f]?.declinedActionIds || []);
  return (idea[f]?.appliedActionIds || []).filter((id) => declined.has(id)).map((id) => `${f}:${id}`);
});
/** T2D-11's guard: every applied share-basis receipt on any ledger of any idea carries both counts, as numbers. */
function shareBasisReceiptsMissingCounts(db) {
  const out = [];
  for (const [path, { data }] of db._store.entries()) {
    if (!/^mandates\/[^/]+\/ideas\/[^/]+$/.test(path)) continue;
    for (const f of LEDGERS) {
      for (const r of data?.[f]?.corporateActionReceipts || []) {
        if (r?.applied !== true || !['split', 'reverse_split', 'stock_distribution'].includes(r.type)) continue;
        if (!(Number.isFinite(r.sharesBefore) && r.sharesBefore > 0 && Number.isFinite(r.sharesAfter) && r.sharesAfter > 0)) out.push(`${path} ${f} ${r.actionId}`);
      }
    }
  }
  return out;
}

let restoreMode;
beforeEach(() => {
  restoreMode = setPracticeFieldModeForTests('on');
  takeSeededDbs();
  // No row reaches the vendor: an empty key, and a fetch that refuses (Astra's probes ran the same way).
  vi.stubEnv('EODHD_API_KEY', '');
  vi.stubEnv('MANDATE_FOUNDER_UIDS', 'owner-1');
  vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
});
afterEach(() => {
  restoreMode();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]);
    expect(bannedWordsOnResults(db)).toEqual([]);
    // T2D-11 (registered T5): the legacy receipt shape cannot be written — every share-basis receipt has both counts.
    expect(shareBasisReceiptsMissingCounts(db)).toEqual([]);
  }
});

// ── T2D-01, with the agreed Q10: a DECLINED action is a match for F-7 ──────────────────────────────────────────────────

describe('T2D-01 / Q10 — a row re-dated past the purchase date is a possible re-date of the one the holding was not entitled to', () => {
  it.each([
    ['a 3-for-2 split', '3/2', 'split'],
    ['a 1-for-2 reverse split', '1/2', 'reverse_split'],
  ])('%s listed on the entry date, then re-dated one session later at a flat price: no phantom shares, held for the founder', async (_name, ratio, type) => {
    const c = await start();
    await close(c, 0, 100, [spl(0, ratio)]);
    const decline = ideaOf(c).ledger.corporateActionReceipts.find((r) => r.reason === 'not_entitled');
    // The decline keeps the payload it declined (the matcher needs it).
    expect(decline).toMatchObject({ actionId: `${type}_AAPL_${S[0]}`, ratio: spl(0, ratio).ratio });
    const cashBefore = bookOf(c).portfolio.cash;
    await close(c, 1, 100, [spl(1, ratio)]);
    const idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(idea[f].holdings.AAPL.shares).toBe(SHARES);
      expect(idea[f].corporateActionReceipts.find((r) => r.actionId === `${type}_AAPL_${S[1]}`)).toMatchObject({ reason: 'possible_redate', redateOf: `${type}_AAPL_${S[0]}`, applied: false });
    }
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(SHARES);
    expect(bookOf(c).portfolio.cash).toBe(cashBefore);
    // A share-basis possible re-date is a doubt about the count: the mark is carried and the row says so.
    const row = rowOf(c, 1);
    expect(row.fullQuality).toBe(false);
    expect(row.marks.AAPL.markSource).not.toBe('snapshot');
    expect(saleHeldBackBy(idea.ledger, 'AAPL', { symbols: {} }, { date: S[2] })).toBe('corporate_action_unsettled');

    // The founder declines it (`none`): the count stands, the doubt clears, money unchanged.
    const ruled = await rule(c, { kind: 'conflict', recordId: `${type}_AAPL_${S[1]}`, decision: 'none' });
    expect(ruled.status).toBe(200);
    await close(c, 2, 100, [spl(1, ratio)]);
    expect(ideaOf(c).ledger.holdings.AAPL.shares).toBe(SHARES);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(SHARES);
    expect(rowOf(c, 2).fullQuality).toBe(true);
  });

  it('Q10: a dividend the holding was not entitled to (bought on its ex-date), re-dated one session later, is not paid', async () => {
    const c = await start();
    await close(c, 0, 100, [div(0)]);
    expect(ideaOf(c).ledger.corporateActionReceipts.find((r) => r.reason === 'not_entitled')).toMatchObject({ actionId: `cash_dividend_AAPL_${S[0]}`, amount: 1 });
    const cashBefore = bookOf(c).portfolio.cash;
    await close(c, 1, 100, [div(1)]);
    const idea = ideaOf(c);
    expect(idea.ledger.dividendsUsd).toBe(0);
    expect(idea.comparisonLedger.dividendsUsd).toBe(0);
    expect(bookOf(c).portfolio.cash).toBe(cashBefore);
    expect(idea.ledger.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[1]}`)).toMatchObject({ reason: 'possible_redate', redateOf: `cash_dividend_AAPL_${S[0]}` });
    // The founder may still pay it: `payload` applies it once.
    const ruled = await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } });
    expect(ruled.status).toBe(200);
    await close(c, 2, 100, [div(1)]);
    await close(c, 3, 100, [div(1)]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    expect(ideaOf(c).comparisonLedger.dividendsUsd).toBe(99.97);
  });
});

// ── T2D-02: a catch-up uses the backfill it fetched, through archived daily entries that are valid ───────────────────

describe('T2D-02 — a 20-session catch-up applies the backfill it fetched, whatever the archived daily entries say', () => {
  it.each([
    ['the archived entries are valid (they predate the vendor correction)', false],
    ['the archived entries failed', true],
  ])('%s: the 5-for-4 split and the one-dollar dividend are applied once, across the 20-session boundary', async (_name, hole) => {
    const c = await start({ slot: 'long' });
    await close(c, 0);
    for (let i = 1; i < 23; i += 1) {
      await storeCloseSnapshot(c.db, S[i], q(i >= 2 ? 80 : 100));
      if (hole) failed(c, i);
    }
    const asks = [];
    const fetchCorporateActions = async (sym, range) => {
      asks.push([sym, range]);
      return { failed: false, calls: 2, actions: sym === 'AAPL' ? [spl(2, '5/4'), div(4)] : [] };
    };
    const args = { before: S[23], now: closeNowOf(S[23]), fetchCorporateActions };
    const first = await catchUpIdeaBook(c.db, c.bookRef, args);
    expect(first.caughtUp.length).toBe(20);
    recon(c);
    const second = await catchUpIdeaBook(c.db, c.bookRef, args);
    expect(second.complete).toBe(true);
    recon(c);
    const idea = ideaOf(c);
    for (const f of ['ledger', 'comparisonLedger']) {
      expect(idea[f].holdings.AAPL.shares).toBe(124.96251);
      expect(idea[f].dividendsUsd).toBe(124.96);
    }
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(124.96251);
    // Applied once: a replay of the catch-up changes nothing.
    const again = await catchUpIdeaBook(c.db, c.bookRef, args);
    expect(again.caughtUp.length).toBe(0);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(124.96);
    expect(ideaOf(c).ledger.appliedActionIds.filter((id) => id === `cash_dividend_AAPL_${S[4]}`)).toHaveLength(1);
  });
});

// ── T2D-06: one id is never both declined and paid ────────────────────────────────────────────────────────────────────

describe('T2D-06 — a conflict whose old row is still listed beside a matching row under a new date stays open', () => {
  it('the $1/$2 conflict, then the $1 row on the old date and the $2 row on the next: only the new row is paid, the conflict stays open', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    for (const i of [2, 3]) {
      // Both dates stay in the daily window for two closes.
      await close(c, i, 100, [div(1, 1), div(2, 2)]);
      const idea = ideaOf(c);
      expect(appliedAndDeclined(idea)).toEqual([]);
      expect(idea.ledger.dividendsUsd).toBe(199.94);
      expect(idea.comparisonLedger.dividendsUsd).toBe(199.94);
      expect(unsettledConflicts(idea.ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
      expect(rowOf(c, i).fullQuality).toBe(false);
    }
    // The founder settles it: `none` declines the old id once; nothing more is paid.
    const ruled = await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' });
    expect(ruled.status).toBe(200);
    await close(c, 4, 100, [div(1, 1), div(2, 2)]);
    const idea = ideaOf(c);
    expect(appliedAndDeclined(idea)).toEqual([]);
    expect(idea.ledger.dividendsUsd).toBe(199.94);
    expect(rowOf(c, 4).fullQuality).toBe(true);
  });

  it('the old id no longer listed: the matching row under the new date still settles the conflict (RF-A2), once', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await close(c, 2, 100, [div(2, 2)]);
    const idea = ideaOf(c);
    expect(appliedAndDeclined(idea)).toEqual([]);
    expect(idea.ledger.dividendsUsd).toBe(199.94);
    expect(idea.ledger.corporateActionReceipts.find((r) => r.reason === 'settled_by_redate')).toMatchObject({ actionId: `cash_dividend_AAPL_${S[1]}`, settledBy: `cash_dividend_AAPL_${S[2]}` });
    expect(rowOf(c, 2).fullQuality).toBe(true);
  });
});

// ── T2D-07: coverage is evidence for the session doing the work ────────────────────────────────────────────────────────

describe('T2D-07 — an uncovered session writes no fresh mark and runs no count-dependent action', () => {
  it('the entry session whose own daily entry failed: the mark is carried as ca_coverage_missing, never a fresh $104', async () => {
    const c = await start();
    await storeCloseSnapshot(c.db, S[0], q(104));
    failed(c, 0);
    await raw(c, 0);
    recon(c);
    const row = rowOf(c, 0);
    expect(row.marks.AAPL).toMatchObject({ quality: 'ca_coverage_missing' });
    expect(row.marks.AAPL.mark).not.toBe(104);
    expect(row.fullQuality).toBe(false);
  });

  it('a dividend dated on the last covered session, first listed at an uncovered close, waits — and is paid once when coverage returns', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 104);
    const cashBefore = bookOf(c).portfolio.cash;
    await storeCloseSnapshot(c.db, S[2], q(104, [div(1)]));
    failed(c, 2);
    await raw(c, 2);
    recon(c);
    let idea = ideaOf(c);
    expect(idea.ledger.dividendsUsd).toBe(0);
    expect(idea.comparisonLedger.dividendsUsd).toBe(0);
    expect(bookOf(c).portfolio.cash).toBe(cashBefore);
    expect(heldActionRecords(idea.ledger).map((r) => r.actionId)).toContain(`cash_dividend_AAPL_${S[1]}`);
    expect(rowOf(c, 2).marks.AAPL.quality).toBe('ca_coverage_missing');
    // Coverage returns (the feed has dropped the row): the held record pays it once, on each stock ledger and the book.
    await close(c, 3, 104);
    await close(c, 4, 104, [div(1)]);
    idea = ideaOf(c);
    expect(idea.ledger.dividendsUsd).toBe(99.97);
    expect(idea.comparisonLedger.dividendsUsd).toBe(99.97);
    expect(bookOf(c).portfolio.cash).toBe(Math.round((cashBefore + 99.97) * 100) / 100);
  });
});

// ── T2D-08: a ruling covers its own transition only ────────────────────────────────────────────────────────────────────

describe('T2D-08 — every split-shaped transition while a record stands is kept, dated; a ruling retires only its own', () => {
  it('a round trip ($100, $50, $25, $50): price_move on the first halving leaves the second one held — and the dividend dated in it', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    await close(c, 2, 25, [div(2)]);
    await close(c, 3, 50, [div(2)]);
    expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'price_move' })).status).toBe(200);
    await close(c, 4, 50);
    let h = ideaOf(c).ledger.holdings.AAPL;
    // The halving at S[2] is a record of its own now, carrying the recovery behind it.
    expect(h.basisSuspicion).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 0.5 });
    expect(ideaOf(c).ledger.dividendsUsd).toBe(0);
    expect(rowOf(c, 4).fullQuality).toBe(false);
    // Ruled real too: the recovery at S[3] is the next record. The dividend dated S[2] is then paid on the count it had.
    expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[2]}`, decision: 'price_move' }, 'founder-r2')).status).toBe(200);
    await close(c, 5, 50);
    h = ideaOf(c).ledger.holdings.AAPL;
    expect(h.basisSuspicion).toMatchObject({ suspectedOn: S[3], since: S[2], ratio: 2 });
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[3]}`, decision: 'price_move' }, 'founder-r3')).status).toBe(200);
    await close(c, 6, 50);
    expect(ideaOf(c).ledger.holdings.AAPL.basisSuspicion ?? null).toBe(null);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(99.97);
    expect(rowOf(c, 6).fullQuality).toBe(true);
  });

  it('a FEED split that explains the first halving leaves the second one a record of its own, holding the dividend dated in it', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    await close(c, 2, 25, [div(2)]);
    await close(c, 3, 25, [spl(1, '2/1'), div(2)]);
    let idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(199.940016);
    expect(idea.ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 0.5 });
    expect(idea.ledger.holdings.AAPL.basisSuspicionHistory.at(-1)).toMatchObject({ id: `suspected_split_AAPL_${S[1]}`, replacedBy: `suspected_split_AAPL_${S[2]}` });
    expect(idea.ledger.dividendsUsd).toBe(0);
    expect(rowOf(c, 3).fullQuality).toBe(false);
    // The founder rules the second halving a real move: the dividend dated in it is paid once, on the count after the
    // first split. (A second identical 2-for-1 listed within five sessions would wait for the founder: Q1.)
    expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[2]}`, decision: 'price_move' })).status).toBe(200);
    await close(c, 4, 25);
    idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(199.940016);
    expect(idea.ledger.holdings.AAPL.basisSuspicion ?? null).toBe(null);
    expect(idea.ledger.dividendsUsd).toBe(199.94);
    expect(idea.comparisonLedger.dividendsUsd).toBe(199.94);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(199.940016);
  });

  it('a partial recovery ($100, $50, $25, $35): the second halving is the next record; the move to $35 is not split-shaped', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    await close(c, 2, 25, [div(2)]);
    await close(c, 3, 35, [div(2)]);
    expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'price_move' })).status).toBe(200);
    await close(c, 4, 35);
    const h = ideaOf(c).ledger.holdings.AAPL;
    expect(h.basisSuspicion).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 0.5 });
    expect(ideaOf(c).ledger.dividendsUsd).toBe(0);
  });
});

// ── T2D-09: a conflict ruling reaches only the ledgers that carry the record ──────────────────────────────────────────

describe('T2D-09 — a chosen conflict payload is applied only on the ledgers whose record it names', () => {
  /** The $1/$2 conflict on both stock ledgers, then the comparison's record removed (Astra's asymmetric stored state). */
  async function asymmetric() {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    const idea = ideaOf(c);
    idea.comparisonLedger.corporateActionReceipts = [];
    await c.db.doc(`mandates/${c.bookId}/ideas/${c.ideaId}`).set(idea);
    return c;
  }
  it('the ruling records the ledgers that carry the record (pure)', async () => {
    const c = await asymmetric();
    const plan = planHoldRuling(ideaOf(c), { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, { uid: 'owner-1', requestKey: 'k', nowIso: 'now' });
    expect(plan.ruling.ledgers).toEqual(['ledger']);
  });
  it.each([['ledger'], ['comparisonLedger'], ['spyLedger']])('(pure) only %s carries the record: the ruling names it, and its payload reaches no other ledger', async (role) => {
    const c = await start();
    await close(c, 0);
    const idea = ideaOf(c);
    // One ledger role at a time carries an open $1/$2 conflict on a symbol every ledger holds (planted: the scoping is
    // what is under test, whatever made the receipts differ).
    const id = `cash_dividend_ZZZ_${S[1]}`;
    for (const f of LEDGERS) {
      idea[f].holdings.ZZZ = { shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, openedAt: S[0] };
      if (f === role) {
        idea[f].corporateActionReceipts.push({ actionId: id, type: 'cash_dividend', ticker: 'ZZZ', effectiveDate: S[1], applied: false, reason: 'conflicting_action', entitled: true, rows: [{ ratio: null, amount: 1, source: 'eodhd_dividends' }, { ratio: null, amount: 2, source: 'eodhd_dividends' }], seenOn: S[1] });
      }
    }
    const plan = planHoldRuling(idea, { kind: 'conflict', recordId: id, decision: 'payload', payload: { amount: 1 } }, { uid: 'owner-1', requestKey: 'k', nowIso: 'now' });
    expect(plan.ruling.ledgers).toEqual([role]);
    const a = applyFounderRulings({ ...idea, founderRulings: [plan.ruling] }, { date: S[2] });
    for (const f of LEDGERS) {
      const out = applyLedgerActions(a.idea[f], a.extraActionsByLedger[f], { date: S[2], ruledIds: a.ruledIdsByLedger[f] });
      expect(out.applied.map((x) => x.actionId)).toEqual(f === role ? [id] : []);
      expect(out.ledger.dividendsUsd).toBe(f === role ? 10 : 0);
      expect([...a.replacedIdsByLedger[f]]).toEqual(f === role ? [id] : []);
    }
    // Completed on the ledger it names: the others never settle the id, and need not.
    const applied = { ...a.idea };
    for (const f of LEDGERS) applied[f] = applyLedgerActions(a.idea[f], a.extraActionsByLedger[f], { date: S[2], ruledIds: a.ruledIdsByLedger[f] }).ledger;
    expect(markRulingsApplied(applied, { date: S[2] }).idea.founderRulings[0].appliedOn).toBe(S[2]);
  });
  it('at the close (a frozen-basket comparison that also holds AAPL, without the record): the idea is paid with a founder receipt; the comparison gets nothing', async () => {
    const ctx = await seedBook();
    const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL'], capitalUsd: 20000, comparison: { type: 'frozen_basket', symbols: ['AAPL', 'MSFT'] } }), quotes: q(), date: S[0] });
    const c = { ...ctx, ideaId: a.ideaId };
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    const before = ideaOf(c);
    expect(before.comparisonLedger.corporateActionReceipts.some((r) => r.reason === 'conflicting_action')).toBe(true);
    before.comparisonLedger.corporateActionReceipts = before.comparisonLedger.corporateActionReceipts.filter((r) => r.reason !== 'conflicting_action');
    await c.db.doc(`mandates/${c.bookId}/ideas/${c.ideaId}`).set(before);
    expect((await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } })).status).toBe(200);
    await close(c, 2);
    const idea = ideaOf(c);
    const shares = idea.ledger.holdings.AAPL.shares;
    expect(idea.ledger.dividendsUsd).toBe(Math.round(shares * 100) / 100);
    expect(idea.ledger.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[1]}` && r.applied)?.founderRuling).toBeTruthy();
    expect(idea.comparisonLedger.dividendsUsd).toBe(0);
    expect(idea.comparisonLedger.corporateActionReceipts.filter((r) => r.founderRuling)).toEqual([]);
    expect(idea.founderRulings[0].appliedOn).toBe(S[2]);
  });

  it('a genuine feed row of that id is still applied on a ledger without the record — from the feed, not the ruling', async () => {
    const c = await asymmetric();
    expect((await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } })).status).toBe(200);
    await close(c, 2, 100, [div(1, 1)]);
    const idea = ideaOf(c);
    expect(idea.ledger.dividendsUsd).toBe(99.97);
    expect(idea.comparisonLedger.dividendsUsd).toBe(99.97);
    const cmp = idea.comparisonLedger.corporateActionReceipts.find((r) => r.actionId === `cash_dividend_AAPL_${S[1]}` && r.applied);
    expect(cmp.source).toBe('eodhd_dividends');
    expect(cmp.founderRuling).toBeUndefined();
  });
  it('(pure) a ledger that gains the record AFTER the ruling is not one it names: the payload does not reach it', async () => {
    const c = await start();
    await close(c, 0);
    const idea = ideaOf(c);
    const id = `cash_dividend_AAPL_${S[1]}`;
    const record = { actionId: id, type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], applied: false, reason: 'conflicting_action', entitled: true, rows: [{ ratio: null, amount: 1, source: 'eodhd_dividends' }, { ratio: null, amount: 2, source: 'eodhd_dividends' }], seenOn: S[1] };
    idea.ledger.corporateActionReceipts.push(record);
    const plan = planHoldRuling(idea, { kind: 'conflict', recordId: id, decision: 'payload', payload: { amount: 1 } }, { uid: 'owner-1', requestKey: 'k', nowIso: 'now' });
    expect(plan.ruling.ledgers).toEqual(['ledger']);
    idea.comparisonLedger.corporateActionReceipts.push({ ...record });
    const a = applyFounderRulings({ ...idea, founderRulings: [plan.ruling] }, { date: S[2] });
    expect(Object.keys(a.extraActionsByLedger.ledger)).toEqual(['AAPL']);
    expect(a.extraActionsByLedger.comparisonLedger).toEqual({});
    expect([...a.replacedIdsByLedger.comparisonLedger]).toEqual([]);
  });

  it('(pure) applyFounderRulings hands the chosen payload to the named ledgers only', async () => {
    const c = await asymmetric();
    const idea = ideaOf(c);
    const plan = planHoldRuling(idea, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } }, { uid: 'owner-1', requestKey: 'k', nowIso: 'now' });
    const a = applyFounderRulings({ ...idea, founderRulings: [plan.ruling] }, { date: S[2] });
    expect(Object.keys(a.extraActionsByLedger.ledger)).toEqual(['AAPL']);
    expect(a.extraActionsByLedger.comparisonLedger).toEqual({});
    expect(a.extraActionsByLedger.spyLedger).toEqual({});
    const cmp = applyLedgerActions(idea.comparisonLedger, a.extraActionsByLedger.comparisonLedger, { date: S[2], ruledIds: a.ruledIds });
    expect(cmp.applied).toEqual([]);
  });
});

// ── T2D-10: a choice that cannot be applied never locks the record ─────────────────────────────────────────────────────

describe('T2D-10 — an unrepresentable founder choice is refused up front, or closed with its reason; the record takes another ruling', () => {
  it('a recorded 1-for-1,000,000,000 payload is refused up front; the 4-for-5 is then chosen and applied once, and the re-listed row changes nothing', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [spl(1, '1/1000000000'), spl(1, '4/5')]);
    const id = `reverse_split_AAPL_${S[1]}`;
    const refused = await rule(c, { kind: 'conflict', recordId: id, decision: 'payload', payload: { ratio: 1e-9 } });
    expect(refused.status).toBe(422);
    expect(refused.body.error).toBe('ruling_unrepresentable');
    const chosen = await rule(c, { kind: 'conflict', recordId: id, decision: 'payload', payload: { ratio: 0.8 } }, 'second-choice');
    expect(chosen.status).toBe(200);
    await close(c, 2, 125);
    await close(c, 3, 125, [spl(1, '4/5')]);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(79.976006);
    expect(idea.comparisonLedger.holdings.AAPL.shares).toBe(79.976006);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(79.976006);
    expect(heldActionRecords(idea.ledger)).toEqual([]);
    expect(idea.founderRulings.map((r) => [r.requestKey, r.appliedOn])).toEqual([['second-choice', S[2]]]);
  });

  it('a possible re-date the founder would apply on a holding it rounds to nothing: refused up front; `none` then releases the sale', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 10000000, [spl(1, '1/100000')]);
    await close(c, 2, 10000000, [spl(2, '1/100000')]);
    const id = `reverse_split_AAPL_${S[2]}`;
    const refused = await rule(c, { kind: 'conflict', recordId: id, decision: 'payload', payload: { ratio: 1e-5 } });
    expect(refused.status).toBe(422);
    expect(refused.body.error).toBe('ruling_unrepresentable');
    expect((await rule(c, { kind: 'conflict', recordId: id, decision: 'none' }, 'release-key')).status).toBe(200);
    await close(c, 3, 10000000);
    await close(c, 4, 10000000, [spl(2, '1/100000')]);
    const idea = ideaOf(c);
    expect(idea.ledger.declinedActionIds).toContain(id);
    expect(saleHeldBackBy(idea.ledger, 'AAPL', { symbols: {} }, { date: S[5] })).toBe(null);
    expect(rowOf(c, 4).fullQuality).toBe(true);
  });

  it('(pure) a founder split that would round a holding to nothing is refused up front', async () => {
    const c = await start();
    await close(c, 0);
    const idea = ideaOf(c);
    idea.ledger.holdings.AAPL.shares = 0.000001;
    idea.comparisonLedger.holdings.AAPL.shares = 0.000001;
    const s1 = { symbol: 'AAPL', suspectedOn: S[1], since: S[0], ratio: 2, shape: { kind: 'reverse_split', n: 2 }, frozenMark: 100, frozenMarkAsOf: null, resolvedBy: null, resolvedAt: null };
    for (const f of ['ledger', 'comparisonLedger']) idea[f].holdings.AAPL.basisSuspicion = { ...s1 };
    const refused = planHoldRuling(idea, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'split', ratio: 0.5 }, { uid: 'owner-1', requestKey: 'k', nowIso: 'now' });
    expect(refused).toEqual({ error: 'ruling_unrepresentable', status: 422 });
    // price_move stays open to the founder.
    expect(planHoldRuling(idea, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'price_move' }, { uid: 'owner-1', requestKey: 'k', nowIso: 'now' }).ruling).toBeTruthy();
  });

  it('(pure) a ruling whose action the applier refuses at the close is closed with its reason, and a new ruling is then accepted', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [spl(1, '1/2'), spl(1, '1/4')]);
    const id = `reverse_split_AAPL_${S[1]}`;
    let idea = ideaOf(c);
    const plan = planHoldRuling(idea, { kind: 'conflict', recordId: id, decision: 'payload', payload: { ratio: 0.25 } }, { uid: 'owner-1', requestKey: 'k1', nowIso: 'now' });
    expect(plan.ruling).toBeTruthy();
    // Between the ruling and the close the holding shrank to almost nothing (a state the ruling could not foresee).
    for (const f of ['ledger', 'comparisonLedger']) idea[f].holdings.AAPL.shares = 0.000001;
    idea = { ...idea, founderRulings: [plan.ruling] };
    const a = applyFounderRulings(idea, { date: S[2] });
    const outs = {};
    for (const f of ['ledger', 'comparisonLedger', 'spyLedger']) outs[f] = applyLedgerActions(a.idea[f], a.extraActionsByLedger[f], { date: S[2], ruledIds: a.ruledIdsByLedger[f] });
    expect(outs.ledger.founderRefusals).toEqual([expect.objectContaining({ actionId: id, requestKey: 'k1', reason: 'rounds_to_nothing' })]);
    // The refused founder action leaves no held record behind (the conflict's own record still holds).
    expect(heldActionRecords(outs.ledger.ledger).filter((r) => r.actionId === id)).toEqual([]);
    const refusals = new Map();
    for (const [f, out] of Object.entries(outs)) for (const r of out.founderRefusals || []) refusals.set(`${r.requestKey}@${f}`, r.reason);
    const next = { ...a.idea, ledger: outs.ledger.ledger, comparisonLedger: outs.comparisonLedger.ledger, spyLedger: outs.spyLedger.ledger };
    const m = markRulingsApplied(next, { date: S[2], refusals });
    expect(m.idea.founderRulings[0]).toMatchObject({ appliedOn: S[2], outcome: 'refused', refusedBecause: 'rounds_to_nothing' });
    expect(m.alerts.some((x) => x.startsWith('PRACTICE_FIELD_HOLD_RULING_REFUSED'))).toBe(true);
    // The lock is released: the record takes another ruling.
    const again = planHoldRuling(m.idea, { kind: 'conflict', recordId: id, decision: 'none' }, { uid: 'owner-1', requestKey: 'k2', nowIso: 'now' });
    expect(again.error).toBeUndefined();
  });
});

// ── T2D-11 (registered T5): the guard ─────────────────────────────────────────────────────────────────────────────────

describe('T2D-11 — every share-basis receipt carries sharesBefore and sharesAfter (the legacy shape cannot be written)', () => {
  it('feed splits, a held split applied late, a conflict payload and a founder split all write both counts', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50, [spl(1, '2/1')]);
    await close(c, 2, 25);
    await close(c, 3, 25, [spl(3, '1/2'), spl(3, '1/3')]);
    await rule(c, { kind: 'conflict', recordId: `reverse_split_AAPL_${S[3]}`, decision: 'payload', payload: { ratio: 0.5 } });
    await close(c, 4, 50);
    await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[2]}`, decision: 'split', ratio: 2 }, 'founder-split');
    await close(c, 5, 50);
    const receipts = LEDGERS.flatMap((f) => ideaOf(c)[f].corporateActionReceipts.filter((r) => r.applied && ['split', 'reverse_split'].includes(r.type)));
    expect(receipts.length).toBeGreaterThanOrEqual(4);
    // (afterEach asserts the guard over every idea of the store.)
  });
});

// ── The fix-round refuter (AR1-RF-01 to AR1-RF-05), each probe as a row ────────────────────────────────────────────────

describe('AR1-RF-01 — the founder\'s ruling on a conflict T2D-06 left open is applied: it is never "ambiguous" itself', () => {
  it('share basis: a 2-for-1 applied, then a 2/1-vs-3/2 conflict the next session; the founder picks 3/2 — applied once, the sale free', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50, [spl(1, '2/1')]);
    await close(c, 2, 50, [spl(2, '2/1'), spl(2, '3/2')]);
    expect((await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[2]}`, decision: 'payload', payload: { ratio: 1.5 } })).status).toBe(200);
    for (let i = 3; i <= 6; i += 1) await close(c, i, 50 / 1.5);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.shares).toBe(299.910024);
    expect(bookOf(c).portfolio.positions.AAPL.shares).toBe(299.910024);
    expect(idea.founderRulings[0].appliedOn).toBe(S[3]);
    expect(saleHeldBackBy(idea.ledger, 'AAPL', { symbols: {} }, { date: S[7] })).toBe(null);
    expect(rowOf(c, 6).fullQuality).toBe(true);
  });
  it('cash: T2D-06\'s own case, the founder ruling the old id a second dividend (one dollar): paid once, the conflict closed', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await close(c, 2, 100, [div(1, 1), div(2, 2)]);
    expect((await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 1 } })).status).toBe(200);
    await close(c, 3, 100, [div(1, 1), div(2, 2)]);
    await close(c, 4);
    const idea = ideaOf(c);
    expect(appliedAndDeclined(idea)).toEqual([]);
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd]).toEqual([299.91, 299.91]);
    expect(idea.founderRulings[0].appliedOn).toBe(S[3]);
    expect(unsettledConflicts(idea.ledger)).toEqual([]);
    expect(rowOf(c, 4).fullQuality).toBe(true);
  });
  it('cash: a two-dollar row applied, then a one-or-two-dollar conflict the next session; the founder picks one dollar (no applied row carries it) — paid once', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 2)]);
    await close(c, 2, 100, [div(2, 1), div(2, 2)]);
    expect((await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[2]}`, decision: 'payload', payload: { amount: 1 } })).status).toBe(200);
    await close(c, 3);
    await close(c, 4);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(299.91);
    expect(ideaOf(c).founderRulings[0].appliedOn).toBe(S[3]);
  });
  it('the feed later lists the old id alone: the conflict stays open (two readings remain), and the founder\'s `none` releases it', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    await close(c, 2, 100, [div(1, 1), div(2, 2)]);
    for (let i = 3; i <= 5; i += 1) await close(c, i, 100, [div(1, 1)]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(199.94);
    expect(unsettledConflicts(ideaOf(c).ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    expect(rowOf(c, 5).fullQuality).toBe(false);
    expect((await rule(c, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' })).status).toBe(200);
    await close(c, 6, 100, [div(1, 1)]);
    expect(ideaOf(c).ledger.dividendsUsd).toBe(199.94);
    expect(rowOf(c, 6).fullQuality).toBe(true);
  });
});

describe('AR1-RF-02 — an ex-date action the feed listed two ways is a decline too: its re-date is not credited (T2D-01, Q10)', () => {
  it.each([
    ['a 3-for-2 (with a 5/4 second row)', ['3/2', '5/4'], '3/2'],
    ['a 1-for-2 reverse (with a 1/3 second row)', ['1/2', '1/3'], '1/2'],
  ])('%s listed two ways on the entry date, then one payload re-dated a session later at a flat price: no phantom shares', async (_name, entryRatios, next) => {
    const c = await start();
    await close(c, 0, 100, entryRatios.map((r) => spl(0, r)));
    await close(c, 1, 100, [spl(1, next)]);
    const idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, idea.comparisonLedger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([SHARES, SHARES, SHARES]);
    expect(idea.ledger.corporateActionReceipts.find((r) => r.reason === 'possible_redate')).toMatchObject({ redateOf: `${spl(0, next).type}_AAPL_${S[0]}` });
  });
  it('cash: one dollar and two dollars listed for the entry date, then one dollar re-dated a session later: not paid', async () => {
    const c = await start();
    await close(c, 0, 100, [div(0, 1), div(0, 2)]);
    const cash = bookOf(c).portfolio.cash;
    await close(c, 1, 100, [div(1, 1)]);
    const idea = ideaOf(c);
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd, bookOf(c).portfolio.cash]).toEqual([0, 0, cash]);
  });
});

describe('AR1-RF-03 — a conflict id\'s own row held at an uncovered close replays as the covered close would have applied it', () => {
  it.each([[false], [true]])('S2 uncovered: %s — the same money either way; the old id applied, never settled under the new date', async (uncovered) => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    if (uncovered) {
      await storeCloseSnapshot(c.db, S[2], q(100, [div(1, 1)]));
      failed(c, 2);
      await raw(c, 2);
      recon(c);
    } else {
      await close(c, 2, 100, [div(1, 1)]);
    }
    await close(c, 3, 100, [div(3, 2)]);
    await close(c, 4, 100, [div(3, 2)]);
    const idea = ideaOf(c);
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd]).toEqual([299.91, 299.91]);
    expect(unsettledConflicts(idea.ledger)).toEqual([]);
    expect(rowOf(c, 4).fullQuality).toBe(true);
    expect(idea.ledger.corporateActionReceipts.filter((r) => r.actionId === `cash_dividend_AAPL_${S[1]}` && r.reason !== 'conflicting_action').map((r) => r.reason ?? 'applied')).toEqual(['applied']);
  });
});

describe('AR1-RF-04 — a split-shaped transition seen at an uncovered close is kept (flagged), and a ruling does not cover it', () => {
  it('$100, $50, then $25 on a day the fetch failed, then $50: price_move on the first halving leaves the second one held', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    await storeCloseSnapshot(c.db, S[2], q(25, [div(2)]));
    failed(c, 2);
    await raw(c, 2);
    recon(c);
    const record = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    expect(record.transitions).toEqual([expect.objectContaining({ session: S[2], since: S[1], ratio: 0.5, uncovered: true })]);
    expect(record.lastSeen.session).toBe(S[1]); // an uncovered close never moves it (lens A's A1)
    await close(c, 3, 50, [div(2)]);
    expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'price_move' })).status).toBe(200);
    await close(c, 4, 50);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[2], since: S[1], ratio: 0.5 });
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd]).toEqual([0, 0]);
    expect(rowOf(c, 4).fullQuality).toBe(false);
  });
});

describe('AR1-RF-05 — a backfill row never settles a conflict it took part in', () => {
  it('the archived day lists 5/4 and the price falls to $80; the backfill lists 3/2 for that id: held for the founder, never 3/2 at full quality', async () => {
    const c = await start({ slot: 'long' });
    await close(c, 0);
    for (let i = 1; i < 23; i += 1) await storeCloseSnapshot(c.db, S[i], q(i >= 4 ? 80 : 100, i === 4 ? [spl(4, '5/4')] : []));
    const fetchCorporateActions = async (sym) => ({ failed: false, calls: 2, actions: sym === 'AAPL' ? [spl(4, '3/2')] : [] });
    const args = { before: S[23], now: closeNowOf(S[23]), fetchCorporateActions };
    await catchUpIdeaBook(c.db, c.bookRef, args);
    recon(c);
    await catchUpIdeaBook(c.db, c.bookRef, args);
    recon(c);
    let idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([SHARES, SHARES]);
    expect(unsettledConflicts(idea.ledger).map((r) => r.actionId)).toEqual([`split_AAPL_${S[4]}`]);
    expect(rowOf(c, 22).fullQuality).toBe(false);
    // The founder reads the price ($100 to $80) and picks 5/4: applied once.
    expect((await rule(c, { kind: 'conflict', recordId: `split_AAPL_${S[4]}`, decision: 'payload', payload: { ratio: 1.25 } })).status).toBe(200);
    await close(c, 23, 80);
    idea = ideaOf(c);
    expect([idea.ledger.holdings.AAPL.shares, bookOf(c).portfolio.positions.AAPL.shares]).toEqual([124.96251, 124.96251]);
  });
});

describe('AR1-RF-04 (its edge) — a snapshot that names another day\'s layer is not used: a move in its prices is no transition', () => {
  it('the record at $50, then a $25 snapshot naming no daily layer: no transition, no last quote kept', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    placeSnapshot(c.db, closeSnapshot(S[2], q(25), { dailyRef: null }));
    await raw(c, 2);
    recon(c);
    const record = ideaOf(c).ledger.holdings.AAPL.basisSuspicion;
    expect(record.transitions ?? []).toEqual([]);
    expect(record.lastQuote ?? null).toBe(null);
    expect(record.lastSeen.session).toBe(S[1]);
  });
});

describe('T2D-08 — with no split-shaped step, the move from the raise to the last price seen is still judged (FR-14, the drift case)', () => {
  it('$100, $50 (the record), then $40, $32, $25: no single step is split-shaped, the whole is — price_move leaves a new record', async () => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 50);
    await close(c, 2, 40, [div(2)]);
    await close(c, 3, 32, [div(2)]);
    await close(c, 4, 25, [div(2)]);
    expect(ideaOf(c).ledger.holdings.AAPL.basisSuspicion.transitions ?? []).toEqual([]);
    expect((await rule(c, { kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'price_move' })).status).toBe(200);
    await close(c, 5, 25);
    const idea = ideaOf(c);
    expect(idea.ledger.holdings.AAPL.basisSuspicion).toMatchObject({ suspectedOn: S[4], since: S[1], ratio: 0.5 });
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd]).toEqual([0, 0]);
  });
});

describe('T2D-06 — a matching row HELD at an uncovered close counts as one the conflict met: the same money either way', () => {
  it.each([[false], [true]])('S2 uncovered: %s — the old row beside a matching new-date row, then the old row alone: the conflict stays open', async (uncovered) => {
    const c = await start();
    await close(c, 0);
    await close(c, 1, 100, [div(1, 1), div(1, 2)]);
    if (uncovered) {
      await storeCloseSnapshot(c.db, S[2], q(100, [div(1, 1), div(2, 2)]));
      failed(c, 2);
      await raw(c, 2);
      recon(c);
    } else {
      await close(c, 2, 100, [div(1, 1), div(2, 2)]);
    }
    await close(c, 3, 100, [div(1, 1)]);
    await close(c, 4, 100, [div(1, 1)]);
    const idea = ideaOf(c);
    expect(appliedAndDeclined(idea)).toEqual([]);
    expect([idea.ledger.dividendsUsd, idea.comparisonLedger.dividendsUsd]).toEqual([199.94, 199.94]);
    expect(unsettledConflicts(idea.ledger).map((r) => r.actionId)).toEqual([`cash_dividend_AAPL_${S[1]}`]);
    expect(rowOf(c, 4).fullQuality).toBe(false);
  });
});
