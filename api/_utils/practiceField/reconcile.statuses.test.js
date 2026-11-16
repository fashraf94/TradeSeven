// api/_utils/practiceField/reconcile.statuses.test.js
//
// Practice Field T1a-2a — THE STATUS RULE AND THE TWO LIFTED BOUNDS (Astra T1A-C01; build prompt §1).
//
// T1a-1's reconciliation admitted `accepted`, `entering` and `holding`, required exactly zero fills after entry and
// exactly zero realised profit and loss. This build writes three more statuses and the first sales. Every status that
// still owns cash or shares stays in the open set, and EVERY check that applied to `holding` applies to each of them
// — the list was not merely widened. These rows take each new state from the real paths, show it reconciles, plant
// one fault at a time in it, and show each is refused.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertReconciled } from './reconcile.js';
import { OPEN_IDEA_STATUSES, FILLED_IDEA_STATUSES, RUNNING_IDEA_STATUSES, IDEA_STATUS } from './constants.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, contractOf, getBook, getIdea, takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02'];
const BASE = { AAPL: 231.47, MSFT: 418.13, SPY: 597.31, XLK: 233.59 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12 };
function quotes(over = {}) {
  const out = {};
  for (const [sym, v] of Object.entries({ ...BASE, ...over })) {
    if (v === undefined) continue;
    out[sym] = typeof v === 'number' && CAPS[sym] ? { price: v, marketCap: CAPS[sym] } : v;
  }
  return out;
}
const clone = (v) => structuredClone(v);
const plus = (usd, delta) => Math.round((usd + delta) * 100) / 100;
/** The rules `assertReconciled` names for a book and its ideas, sorted; [] when it reconciles. */
function problems(book, ideas) {
  try { assertReconciled(book, ideas); return []; } catch (err) {
    if (err?.code !== 'recon_failed') throw err;
    return [...new Set(err.detail.problems.map((p) => p.rule))].sort();
  }
}

/** One book, one two-name idea, taken to each state by the real paths. Returns `{ book, idea }` per state. */
async function states(comparison = { type: 'same_stock_held' }) {
  const { db, bookId } = await seedBook();
  const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison }), quotes: quotes(), date: S[0] });
  const snap = () => ({ book: clone(getBook(db, bookId)), idea: clone(getIdea(db, bookId, r.ideaId)) });
  const out = {};
  await closeOn(db, bookId, S[0], quotes());
  out.holding = snap();
  const level = out.holding.idea.lines.find((l) => l.symbol === 'MSFT').level;
  await closeOn(db, bookId, S[1], quotes({ MSFT: roundUsd(level - 0.02) }));
  out.exitPending = snap(); // line_hit_exit_pending, MSFT waiting to exit
  await windowAt(db, bookId, { date: S[2], quotes: quotes({ MSFT: roundUsd(level - 1) }) });
  out.afterLineExit = snap(); // holding again, one fill after entry
  for (let i = 2; i <= 10; i += 1) await closeOn(db, bookId, S[i], quotes());
  out.settled = snap(); // settled, AAPL waiting for its settlement sale
  await windowAt(db, bookId, { date: S[11], quotes: quotes() });
  out.resulted = snap(); // resulted: out of the open set
  return out;
}

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); });
afterEach(() => {
  restoreMode();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]);
    expect(bannedWordsOnResults(db)).toEqual([]);
  }
});

describe('Astra T1A-C01 — the status rule', () => {
  it('the open set is every status that still owns cash or shares; the filled statuses are the ones with three ledgers; resulted and cancelled are in neither', () => {
    expect(OPEN_IDEA_STATUSES).toEqual(['accepted', 'entering', 'holding', 'line_hit_exit_pending', 'settled']);
    expect(FILLED_IDEA_STATUSES).toEqual(['holding', 'line_hit_exit_pending', 'settled']);
    expect(RUNNING_IDEA_STATUSES).toEqual(['holding', 'line_hit_exit_pending']);
    expect(IDEA_STATUS).toMatchObject({ LINE_HIT_EXIT_PENDING: 'line_hit_exit_pending', SETTLED: 'settled', RESULTED: 'resulted' });
    for (const out of ['resulted', 'cancelled', 'retired', 'drafted', undefined]) expect(OPEN_IDEA_STATUSES.includes(out), String(out)).toBe(false);
  });

  it('each new status reconciles with the cash and shares it still owns, as the real paths write it', async () => {
    const st = await states();
    expect(st.holding.idea.status).toBe('holding');
    expect(st.exitPending.idea.status).toBe('line_hit_exit_pending');
    expect(st.afterLineExit.idea.status).toBe('holding');
    expect(st.settled.idea.status).toBe('settled');
    expect(st.resulted.idea.status).toBe('resulted');
    for (const name of ['holding', 'exitPending', 'afterLineExit', 'settled']) {
      expect(problems(st[name].book, [st[name].idea]), name).toEqual([]);
      expect(st[name].book.openIdeaIds, name).toEqual([st[name].idea.ideaId]);
    }
    // Each still owns something.
    expect(Object.keys(st.exitPending.idea.ledger.holdings)).toEqual(['AAPL', 'MSFT']);
    expect(Object.keys(st.settled.idea.ledger.holdings)).toEqual(['AAPL']);
    expect(st.settled.idea.ledger.cash).toBeGreaterThan(0);
    // A resulted idea is out of the open set and owns nothing.
    expect(st.resulted.book.openIdeaIds).toEqual([]);
    expect(st.resulted.idea.ledger).toMatchObject({ cash: 0, holdings: {} });
    expect(problems(st.resulted.book, [])).toEqual([]);
  });

  it('EVERY check that applied to `holding` applies to each new status: a planted fault in each is refused, by the same rule', async () => {
    const st = await states({ type: 'sector_fund', symbols: ['XLK'] });
    for (const name of ['exitPending', 'afterLineExit', 'settled']) {
      const { book, idea } = st[name];
      const held = Object.keys(idea.ledger.holdings)[0];
      const fault = (mutate) => { const b = clone(book); const i = clone(idea); mutate(b, i); return problems(b, [i]); };
      // Rule 1/4: a cent in the idea's cash.
      expect(fault((b, i) => { i.ledger.cash = plus(i.ledger.cash, 0.01); }), `${name} cash`).toEqual(['cash_mismatch', 'equity_mismatch', 'ledger_not_conserved']);
      // Rule 2: the book's shares differ from the idea's.
      expect(fault((b) => { b.portfolio.positions[held].shares += 0.000001; }), `${name} shares`).toEqual(['shares_mismatch']);
      // Rule 3: a position with no idea.
      expect(fault((b) => { delete b.portfolio.positions[held].ideaId; }), `${name} owned`).toContain('position_without_idea');
      // Rule 6: the reserved capital.
      expect(fault((b, i) => { i.ledger.reservedCapitalUsd = plus(i.ledger.reservedCapitalUsd, 0.01); }), `${name} capital`).toContain('reserved_capital_mismatch');
      // Rule 7: the recorded mark, and the equity.
      expect(fault((b) => { b.portfolio.positions[held].lastMark += 0.01; }), `${name} mark`).toEqual(['mark_mismatch']);
      expect(fault((b) => { b.portfolio.totalValue = plus(b.portfolio.totalValue, 0.01); }), `${name} equity`).toEqual(['equity_mismatch']);
      // Rule 8: paper-ledger completeness and conservation — on the comparison and on SPY.
      expect(fault((b, i) => { i.comparisonLedger = null; }), `${name} comparison missing`).toEqual(['comparison_ledger_missing']);
      expect(fault((b, i) => { i.spyLedger = null; }), `${name} spy missing`).toEqual(['spy_ledger_missing']);
      expect(fault((b, i) => { i.comparisonLedger.cash = plus(i.comparisonLedger.cash, 0.01); }), `${name} comparison cash`).toEqual(['comparison_ledger_not_conserved']);
      expect(fault((b, i) => { i.spyLedger.cash = plus(i.spyLedger.cash, 0.01); }), `${name} spy cash`).toEqual(['spy_ledger_not_conserved']);
      expect(fault((b, i) => { i.spyLedger.reservedCapitalUsd = plus(i.spyLedger.reservedCapitalUsd, 1); }), `${name} spy capital`).toContain('spy_capital_mismatch');
      // Rule 9: the fill count.
      for (const bad of [undefined, null, -1, 0.5, '1', idea.postEntryFillCount + 1]) {
        expect(fault((b, i) => { i.postEntryFillCount = bad; }), `${name} count ${String(bad)}`).toEqual(['post_entry_fill_count_invalid']);
      }
      // Rule 5: the slot, and the open set.
      expect(fault((b) => { b.slots.short = null; }), `${name} slot`).toEqual(['idea_not_in_its_slot']);
      expect(fault((b) => { b.openIdeaIds = []; }), `${name} open set`).toContain('open_idea_set_mismatch');
    }
  });

  it('the status agrees with what the holdings carry: each mismatch is refused', async () => {
    const st = await states();
    const fault = (state, mutate) => { const b = clone(state.book); const i = clone(state.idea); mutate(b, i); return problems(b, [i]); };
    // A holding waiting to exit on an idea that says `holding`, or `settled`.
    expect(fault(st.exitPending, (b, i) => { i.status = 'holding'; })).toEqual(['exit_pending_status_mismatch']);
    expect(fault(st.exitPending, (b, i) => { i.status = 'settled'; i.result = {}; })).toEqual(['exit_pending_status_mismatch', 'settled_holding_not_pending', 'settled_without_endpoint']);
    // `settled` without the endpoint figure its liquidation is measured against.
    expect(fault(st.settled, (b, i) => { delete i.endpoint; })).toEqual(['settled_without_endpoint']);
    expect(fault(st.settled, (b, i) => { i.endpoint.holdingsNetUsd = 'n/a'; })).toEqual(['settled_without_endpoint']);
    // `line_hit_exit_pending` with holdings and none waiting.
    expect(fault(st.holding, (b, i) => { i.status = 'line_hit_exit_pending'; })).toEqual(['exit_pending_status_mismatch']);
    // A holding waiting for its settlement sale on an idea that is not `settled`.
    expect(fault(st.settled, (b, i) => { i.status = 'holding'; })).toEqual(['settlement_pending_status_mismatch']);
    // `settled` without its result; `settled` with a holding that is not waiting to be sold.
    expect(fault(st.settled, (b, i) => { i.result = null; })).toEqual(['settled_without_result']);
    expect(fault(st.settled, (b, i) => { delete i.ledger.holdings.AAPL.settlementPending; })).toEqual(['settled_holding_not_pending']);
    // `holding` that holds nothing; `accepted` that holds shares.
    expect(fault(st.afterLineExit, (b, i) => { i.ledger.holdings = {}; })).toContain('holding_idea_holds_nothing');
    expect(fault(st.holding, (b, i) => { i.status = 'accepted'; })).toContain('accepted_idea_holds_shares');
  });

  it('a `resulted` idea owning anything is refused: in the open set at all, holding cash, or named by a position', async () => {
    const st = await states();
    const { book, idea } = st.resulted;
    // Handed in as an open idea — even owning nothing.
    const listed = clone(book); listed.openIdeaIds = [idea.ideaId]; listed.slots.short = idea.ideaId;
    expect(problems(listed, [idea])).toContain('open_idea_not_live');
    // Still holding cash the treasury also counts.
    const rich = clone(idea); rich.ledger.cash = 100;
    expect(problems(listed, [rich])).toEqual(expect.arrayContaining(['open_idea_not_live', 'cash_mismatch']));
    // Out of the open set, but a position still carries its id.
    const haunted = clone(book);
    haunted.portfolio.positions.AAPL = { shares: 1, costBasisTotal: 100, avgCost: 100, lastMark: 100, ideaId: idea.ideaId };
    expect(problems(haunted, [])).toContain('position_idea_missing');
    // The same for a cancelled idea, and for a status this build does not know.
    for (const status of ['cancelled', 'retired', 'abandoned', undefined]) {
      const odd = clone(st.settled.idea); odd.status = status;
      expect(problems(st.settled.book, [odd]), String(status)).toContain('open_idea_not_live');
    }
  });
});

describe('the two lifted bounds (build prompt §1)', () => {
  it('a line exit raises the fill count and switches the same-stock tie off — exactly while the count is 0, it is on', async () => {
    const st = await states();
    // Before any later fill the comparison is tied: a cent of difference is refused.
    expect(st.exitPending.idea.postEntryFillCount).toBe(0);
    const untied = clone(st.exitPending.idea);
    untied.comparisonLedger.holdings.MSFT.lastMark += 0.01;
    expect(problems(st.exitPending.book, [untied])).toEqual(['comparison_not_tied']);
    // After the line exit the idea and its comparison DIFFER (the idea sold MSFT; the comparison never trades) and reconcile.
    const { book, idea } = st.afterLineExit;
    expect(idea.postEntryFillCount).toBe(1);
    expect(Object.keys(idea.ledger.holdings)).toEqual(['AAPL']);
    expect(Object.keys(idea.comparisonLedger.holdings)).toEqual(['AAPL', 'MSFT']);
    expect(idea.ledger.cash).not.toBe(idea.comparisonLedger.cash);
    expect(problems(book, [idea])).toEqual([]);
    // The count cannot be wound back to 0 to keep the tie off-book, nor run ahead of the receipts.
    const zeroed = clone(idea); zeroed.postEntryFillCount = 0;
    expect(problems(book, [zeroed])).toEqual(['post_entry_fill_count_invalid']);
    const ahead = clone(idea); ahead.postEntryFillCount = 2;
    expect(problems(book, [ahead])).toEqual(['post_entry_fill_count_invalid']);
    // …and the settled idea's count is every fill after entry: here still the one line exit.
    expect(st.settled.idea.postEntryFillCount).toBe(1);
    expect(st.resulted.idea.postEntryFillCount).toBe(2);
  });

  it('realised profit and loss equals the sum on the sale receipts, to the cent: without a matching receipt it is refused; with it, it passes', async () => {
    const st = await states({ type: 'sector_fund', symbols: ['XLK'] });
    const { book, idea } = st.afterLineExit;
    const receipt = idea.ledger.saleReceipts[0];
    expect(idea.ledger.realizedPnlUsd).toBe(receipt.realizedPnlUsd); // a real loss, receipted
    expect(idea.ledger.realizedPnlUsd).toBeLessThan(0);
    expect(problems(book, [idea])).toEqual([]);
    // A cent of realised profit with the same cent in cash CONSERVES — and is refused, because no receipt carries it.
    const padded = clone(idea); const paddedBook = clone(book);
    padded.ledger.cash = plus(padded.ledger.cash, 0.01); padded.ledger.realizedPnlUsd = plus(padded.ledger.realizedPnlUsd, 0.01);
    paddedBook.portfolio.cash = plus(paddedBook.portfolio.cash, 0.01); paddedBook.portfolio.totalValue = plus(paddedBook.portfolio.totalValue, 0.01);
    expect(problems(paddedBook, [padded])).toEqual(['realized_pnl_not_receipted']);
    // The receipt removed: the realised amount it carried is unaccounted for (and the count no longer matches).
    const stripped = clone(idea); stripped.ledger.saleReceipts = [];
    expect(problems(book, [stripped])).toEqual(['post_entry_fill_count_invalid', 'realized_pnl_not_receipted']);
    // The receipt's own figure altered.
    const forged = clone(idea); forged.ledger.saleReceipts[0].realizedPnlUsd = plus(receipt.realizedPnlUsd, 0.01);
    expect(problems(book, [forged])).toEqual(['realized_pnl_not_receipted', 'sale_receipt_inconsistent']);
    // A receipt must agree with itself (review SX-7): proceeds less cost basis is what it realised. Moving the proceeds
    // alone — which feed the liquidation's figures — is refused though every ledger total still adds up.
    const inflated = clone(idea); inflated.ledger.saleReceipts[0].proceedsUsd = plus(receipt.proceedsUsd, 100);
    expect(problems(book, [inflated])).toEqual(['sale_receipt_inconsistent']);
    // …and it must be one of the sales this build makes.
    const mislabelled = clone(idea); mislabelled.ledger.saleReceipts[0].kind = 'trim';
    expect(problems(book, [mislabelled])).toEqual(['sale_receipt_kind_unknown']);
    for (const kind of ['line_exit', 'settlement']) {
      const ok = clone(idea); ok.ledger.saleReceipts[0].kind = kind;
      expect(problems(book, [ok]), kind).toEqual([]);
    }
    const third = clone(idea); third.ledger.saleReceipts[0].kind = 'delisting_exit'; // a cause, never an origin
    expect(problems(book, [third])).toEqual(['sale_receipt_kind_unknown']);
    const blank = clone(idea); blank.ledger.saleReceipts[0].realizedPnlUsd = 'n/a';
    expect(problems(book, [blank])).toEqual(expect.arrayContaining(['not_a_number', 'realized_pnl_not_receipted']));
  });

  it('the comparison and SPY ledgers never sell (E3): a sale receipt on either is refused, and so is any realised amount with no receipt', async () => {
    const st = await states({ type: 'sector_fund', symbols: ['XLK'] });
    const { book, idea } = st.afterLineExit;
    for (const [field, prefix] of [['comparisonLedger', 'comparison_'], ['spyLedger', 'spy_']]) {
      const sold = clone(idea);
      sold[field].saleReceipts = [{ decisionId: 'x', kind: 'line_exit', symbol: 'XLK', proceedsUsd: 10, costBasisUsd: 10, realizedPnlUsd: 0 }];
      expect(problems(book, [sold]), field).toEqual([`${prefix}ledger_sold`]);
      const padded = clone(idea);
      padded[field].cash = plus(padded[field].cash, 0.01); padded[field].realizedPnlUsd = 0.01;
      expect(problems(book, [padded]), field).toEqual([`${prefix}realized_pnl_not_receipted`]);
      // Even with a matching sale receipt planted beside it: a paper ledger has no sales.
      padded[field].saleReceipts = [{ decisionId: 'x', kind: 'line_exit', symbol: 'XLK', proceedsUsd: 10.01, costBasisUsd: 10, realizedPnlUsd: 0.01 }];
      expect(problems(book, [padded]), field).toEqual([`${prefix}ledger_sold`]);
    }
  });

  it('E5 — the cost tier each holding entered with is reconciled (review SX-6): missing on any ledger it is refused, and while the same-stock tie holds it must be the comparison\'s too', async () => {
    const st = await states();
    const { book, idea } = st.holding;
    expect(idea.postEntryFillCount).toBe(0);
    const fault = (mutate) => { const b = clone(book); const i = clone(idea); mutate(b, i); return problems(b, [i]); };
    // A planted tier on the idea's own holding would price its sale and its endpoint differently from the comparison's.
    expect(fault((b, i) => { i.ledger.holdings.MSFT.costTier = { capTier: 'small', slippageBps: 5, spreadProxyBps: 15 }; })).toEqual(['comparison_not_tied']);
    expect(fault((b, i) => { i.comparisonLedger.holdings.AAPL.costTier = { ...i.comparisonLedger.holdings.AAPL.costTier, spreadProxyBps: 0 }; })).toEqual(['comparison_not_tied']);
    // No tier, or one that is not a tier, on any of the three ledgers.
    expect(fault((b, i) => { delete i.ledger.holdings.MSFT.costTier; })).toEqual(['comparison_not_tied', 'cost_tier_missing']);
    expect(fault((b, i) => { i.ledger.holdings.MSFT.costTier = { capTier: 'unknown', slippageBps: 5, spreadProxyBps: 15 }; })).toEqual(['comparison_not_tied', 'cost_tier_missing']);
    expect(fault((b, i) => { delete i.comparisonLedger.holdings.AAPL.costTier; })).toEqual(['comparison_cost_tier_missing', 'comparison_not_tied']);
    expect(fault((b, i) => { i.spyLedger.holdings.SPY.costTier = { capTier: 'fund:liquid_fund', slippageBps: -1, spreadProxyBps: 2 }; })).toEqual(['spy_cost_tier_missing']);
    // After a fill the tie is off, but a holding still needs its tier.
    const after = st.settled;
    const b2 = clone(after.book); const i2 = clone(after.idea); delete i2.ledger.holdings.AAPL.costTier;
    expect(problems(b2, [i2])).toEqual(['cost_tier_missing']);
  });

  it('the receipts are kept for the life of the ledger: pruning a dividend\'s receipt, or a sale\'s, makes the ledger unreconcilable', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'] }), quotes: quotes(), date: S[0] });
    const dividend = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount: 0.26, source: 'eodhd_dividends' };
    await closeOn(db, bookId, S[0], quotes());
    await closeOn(db, bookId, S[1], quotes({ AAPL: { price: 231.2, marketCap: CAPS.AAPL, corporateActions: [dividend] } }));
    // Twenty sessions on, far outside the feed's window, the receipt is still there and still needed.
    for (let i = 2; i <= 9; i += 1) await closeOn(db, bookId, S[i], quotes());
    const book = getBook(db, bookId);
    const idea = getIdea(db, bookId, r.ideaId);
    expect(idea.ledger.corporateActionReceipts.filter((x) => x.applied)).toHaveLength(1);
    expect(problems(book, [idea])).toEqual([]);
    for (const field of ['ledger', 'comparisonLedger']) {
      const pruned = clone(idea); pruned[field].corporateActionReceipts = [];
      expect(problems(book, [pruned]), field).toEqual([field === 'ledger' ? 'dividends_not_receipted' : 'comparison_dividends_not_receipted']);
    }
  });
});
