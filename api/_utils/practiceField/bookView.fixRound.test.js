// api/_utils/practiceField/bookView.fixRound.test.js
//
// Practice Field build B3 — THE FIX ROUND FOR ASTRA'S REVIEW (docs/audits/20261124_ASTRA_REVIEW_B3.md), her confirm rows as
// she wrote them, each through the REAL engine on the in-memory store: the admission, the entry at its window, the close
// (closeIdeaBook through the fixtures' closeOn), the founder's ruling and the catch-up — then the screen's own reader,
// readBookView. No row here is hand-built: what the view is given is what close.js wrote.
//   B3-A01  a fresh quote never restores a name's figures while its idea's row is held by its ledger
//   B3-A02  the book line waits when the last close's row is below full quality (ruling B3-11)
//   B3-A03  SPY starts at the book's first FILL, whatever the admission or document-id order
//   B3-A04  a close landing during the read: a complete dated answer, never a row as its own "previous"
//   B3-A06  a thesis is signed by who wrote it (ruling B3-12)
//   B3-A10  the read bound, restated, with the re-read

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPracticeFieldModeForTests } from './mode.js';
import { readBookView } from './bookViewRead.js';
import { buildBookView, finishedView, allotCents, moneyText, ledgerHeld, deriveSinceOpen } from './bookView.js';
import { ROW_REASON_HELD, BOOK_WAITING, BOOK_WAITING_REASON } from './bookViewCopy.js';
import { admitIdea, ideaIdFor } from './admission.js';
import { closeIdeaBook } from './close.js';
import { parseDividendsPayload } from '../mandateCorporateActions.js';
import { roundUsd } from '../mandateRounding.js';
import { toCents } from './money.js';
import { nextSessionDate } from './windows.js';
import {
  seedBook, admitAndEnter, contractOf, getIdea, getRow, closeOn, windowAt, catchUpAt, founderRules, takeSeededDbs, ADMIT_ISO,
  closeNowOf, omitParseReport, storeCloseSnapshot,
} from './__testsupport__/fixtures.js';
import { runBookHistory } from './__testsupport__/bookViewFixtures.js';

const S = ['2026-11-16'];
while (S.length < 8) S.push(nextSessionDate(S.at(-1)));
const UID = 'owner-1';
const view = async (c) => (await readBookView(c.db, { uid: UID, agentOn: false })).book;
const group = (v, slot) => v.groups.find((g) => g.slot === slot);
const name = (g, sym) => g.names.find((n) => n.symbol === sym);
const bookRow = (c, date) => c.db._get(`mandates/${c.bookId}/dailyRows/${date}`);
const FIGURES = ['mark', 'positionValue', 'plOpen', 'plDay', 'distance'];
/** A displayed amount back to whole cents ('+$1,234.56' → 123456; '−$9.10' → −910). */
const cents = (text) => (text.startsWith('−') ? -1 : 1) * Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100);
/** A name that waits: the words, and no figure that depends on a mark. */
const expectWaiting = (n, reason, what) => {
  expect(n, what).toMatchObject({ state: 'waiting', text: 'Waiting on data', waitingReason: reason });
  for (const f of FIGURES) expect(n[f] ?? null, `${what} ${f}`).toBeNull();
};

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
  takeSeededDbs();
});

// ── B3-A01 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B3-A01: a name\'s figures follow its row — a ledger hold holds every name of the idea', () => {
  // Two names against a sector fund (so a missing dividend would be a gap), as close.test.js's FR-A1 row.
  const Q = (aapl = 99, over = {}) => ({ AAPL: { price: aapl, marketCap: 3e12, ...over }, MSFT: { price: 200, marketCap: 3e12 }, SPY: 500, XLK: 233.59 });
  const div = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount: 1, source: 'eodhd_dividends' };
  const rival = { ...div, amount: 1.5, source: 'founder' };
  async function conflicted() {
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: { ...Q(100), XLK: 233.59 }, date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], Q(100));
    return c;
  }

  it('Astra\'s row: the conflict gone from the feed but unresolved on the ledger — AAPL (her BAC) and its sibling wait, with no value and no P/L', async () => {
    const c = await conflicted();
    // While the feed presents the conflict, AAPL's mark is held back (carried) AND the action is open: the mixed case. The
    // row cannot say from itself that a hold stands beside the carried mark; the idea's ledgers (same close) do.
    await closeOn(c.db, c.bookId, S[1], Q(99, { corporateActions: [div, rival] }));
    const mixed = getRow(c.db, c.bookId, c.ideaId, S[1]);
    expect(mixed).toMatchObject({ fullQuality: false, marks: { AAPL: { quality: 'carried_forward' }, MSFT: { quality: 'vendor_time' } } });
    let g = group(await view(c), 'short');
    for (const sym of ['AAPL', 'MSFT']) expectWaiting(name(g, sym), ROW_REASON_HELD, `${S[1]} ${sym}`);
    expect(g.gap).toEqual({ waiting: ROW_REASON_HELD });
    // The feed stops presenting it: AAPL is marked fresh again — the vendor's own timed close — but the action was never
    // applied, so the row stays below full quality. Before the fix AAPL showed its value, open and day P/L here.
    await closeOn(c.db, c.bookId, S[2], Q(99));
    const row = getRow(c.db, c.bookId, c.ideaId, S[2]);
    expect(row).toMatchObject({ fullQuality: false, marks: { AAPL: { mark: 99, quality: 'vendor_time' }, MSFT: { quality: 'vendor_time' } } });
    expect(ledgerHeld(row)).toBe(true); // from the row alone: every mark the vendor's own, and still below full quality
    g = group(await view(c), 'short');
    for (const sym of ['AAPL', 'MSFT']) expectWaiting(name(g, sym), ROW_REASON_HELD, `${S[2]} ${sym}`);
    expect(g.gap).toEqual({ waiting: ROW_REASON_HELD });
    // The founder rules; the next close is clean: figures again — but NO day P/L, because the row before was held (the
    // prior row passes the same test, or it is a dash).
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' });
    await closeOn(c.db, c.bookId, S[3], Q(99.5));
    expect(getRow(c.db, c.bookId, c.ideaId, S[3]).fullQuality).toBe(true);
    g = group(await view(c), 'short');
    for (const sym of ['AAPL', 'MSFT']) {
      const n = name(g, sym);
      expect(n.state, sym).toBe('held');
      expect(n.positionValue, sym).toEqual(expect.any(String));
      expect(n.plOpen, sym).toEqual(expect.objectContaining({ text: expect.any(String) }));
      expect(n.plDay, `${sym}: the close before was held`).toBeNull();
    }
    // One clean close later the day P/L is back, against that clean row.
    await closeOn(c.db, c.bookId, S[4], Q(100));
    g = group(await view(c), 'short');
    const before = allotCents(getRow(c.db, c.bookId, c.ideaId, S[3]));
    for (const sym of ['AAPL', 'MSFT']) {
      const n = name(g, sym);
      expect(cents(n.plDay.text), sym).toBe(cents(n.positionValue) - before.get(sym));
    }
  });

  it('Astra\'s row: the same with the open proposal after AAPL\'s sale — the surviving MSFT waits', async () => {
    // corporateActionCorrections.test.js's T2D-03: held 17 Nov, sold on its line at 18 Nov's first window, a $1 dividend
    // dated 17 Nov first listed 19 Nov — PROPOSED, waiting for the founder; the row is below full quality while it waits.
    const q = (p = 100, a = []) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
    const late = parseDividendsPayload('AAPL', [{ date: S[1], unadjustedValue: 1 }]).actions[0];
    const c = await seedBook();
    const a = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000 }), quotes: q(), date: S[0] });
    c.ideaId = a.ideaId;
    await closeOn(c.db, c.bookId, S[0], q());
    const level = getIdea(c.db, c.bookId, c.ideaId).lines.find((l) => l.symbol === 'AAPL').level;
    const below = roundUsd(level - 0.5);
    await closeOn(c.db, c.bookId, S[1], q(below));
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(below) });
    expect(getIdea(c.db, c.bookId, c.ideaId).ledger.holdings.AAPL).toBeUndefined();
    await closeOn(c.db, c.bookId, S[2], q(below));
    await closeOn(c.db, c.bookId, S[3], q(below, [late]));
    const idea = getIdea(c.db, c.bookId, c.ideaId);
    expect(idea.ledger.lateProposals).toEqual([expect.objectContaining({ status: 'open' })]);
    const row = getRow(c.db, c.bookId, c.ideaId, S[3]);
    expect(row).toMatchObject({ fullQuality: false, marks: { MSFT: { quality: 'vendor_time' } } });
    const g = group(await view(c), 'short');
    expectWaiting(name(g, 'MSFT'), ROW_REASON_HELD, 'MSFT');
    expect(name(g, 'AAPL')).toMatchObject({ state: 'sold_line' });
    expect(g.gap).toEqual({ waiting: ROW_REASON_HELD });
  });

  it('unchanged: a row below full quality ONLY because one name\'s mark is not the vendor\'s own holds that name; its sibling keeps its figures (state 7)', async () => {
    const c = await seedBook();
    const quotes = (aapl) => ({ AAPL: { price: 100, marketCap: 3e12, ...aapl }, MSFT: { price: 200, marketCap: 3e12 }, SPY: 500 });
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'] }), quotes: quotes({}), date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], quotes({}));
    await closeOn(c.db, c.bookId, S[1], quotes({ price: 101, at: null })); // AAPL's close has no vendor time
    const row = getRow(c.db, c.bookId, c.ideaId, S[1]);
    expect(row).toMatchObject({ fullQuality: false, marks: { AAPL: { quality: 'receipt_time_fallback' }, MSFT: { quality: 'vendor_time' } } });
    expect(ledgerHeld(row, getIdea(c.db, c.bookId, c.ideaId))).toBe(false);
    const g = group(await view(c), 'short');
    expect(name(g, 'AAPL').state).toBe('waiting');
    expect(name(g, 'AAPL').positionValue ?? null).toBeNull();
    expect(name(g, 'AAPL').waitingReason).toMatch(/no time from the vendor/);
    expect(name(g, 'MSFT')).toMatchObject({ state: 'held', positionValue: expect.any(String), plOpen: expect.any(Object), plDay: expect.any(Object) });
  });
});

describe('B3-A01, the refuter of the fix round: the holds close.js names that the first fix missed', () => {
  const q = (p = 100, a = [], msft = 200) => ({ AAPL: { price: p, marketCap: 3e12, corporateActions: a }, MSFT: { price: msft, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
  const div = (i, v) => parseDividendsPayload('AAPL', [{ date: S[i], unadjustedValue: v }]).actions[0];

  it("R1: a founder's correction not yet posted (founderRulings), beside a carried mark — every name waits", async () => {
    const c = await seedBook();
    const a = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: q(), date: S[0] });
    c.ideaId = a.ideaId;
    await closeOn(c.db, c.bookId, S[0], q());
    await closeOn(c.db, c.bookId, S[1], q(100, [div(1, 1)]));
    await closeOn(c.db, c.bookId, S[2], q(100, [div(1, 2)])); // the $2 revision
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'payload', payload: { amount: 2 } }, { requestKey: 'fix-div' });
    await storeCloseSnapshot(c.db, S[3], q(101));
    omitParseReport(c.db, S[3], ['AAPL']); // AAPL's data not covered: its mark is carried, and the correction waits
    const out = await closeIdeaBook(c.db, c.bookRef, { date: S[3], now: closeNowOf(S[3]) });
    expect(out.alerts.some((x) => x.startsWith('PRACTICE_FIELD_CORRECTION_WAITING'))).toBe(true);
    const row = getRow(c.db, c.bookId, c.ideaId, S[3]);
    expect(row).toMatchObject({ fullQuality: false, marks: { AAPL: { quality: 'ca_coverage_missing' }, MSFT: { quality: 'vendor_time' } } });
    const g = group(await view(c), 'short');
    for (const sym of ['AAPL', 'MSFT']) expectWaiting(name(g, sym), ROW_REASON_HELD, sym);
    expect(g.gap).toEqual({ waiting: ROW_REASON_HELD });
  });

  it("R2: a row the page showed as held (a carried mark beside an open conflict) is never the next day's base", async () => {
    const Q = (aapl, msft, over = {}) => ({ AAPL: { price: aapl, marketCap: 3e12, ...over }, MSFT: { price: msft, marketCap: 3e12 }, SPY: 500, XLK: 233.59 });
    const dv = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount: 1, source: 'eodhd_dividends' };
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: Q(100, 200), date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], Q(100, 200));
    await closeOn(c.db, c.bookId, S[1], Q(99, 202, { corporateActions: [dv, { ...dv, amount: 1.5, source: 'founder' }] }));
    expect(name(group(await view(c), 'short'), 'MSFT').state).toBe('waiting');
    await founderRules(c.db, c.bookId, c.ideaId, { kind: 'conflict', recordId: `cash_dividend_AAPL_${S[1]}`, decision: 'none' });
    await closeOn(c.db, c.bookId, S[2], Q(99, 205));
    expect(getRow(c.db, c.bookId, c.ideaId, S[2]).fullQuality).toBe(true);
    const msft = name(group(await view(c), 'short'), 'MSFT');
    expect(msft).toMatchObject({ state: 'held', positionValue: expect.any(String) });
    expect(msft.plDay).toBeNull();
    // The row alone cannot rule a hold out beside a carried mark: it counts as held; with the idea that wrote it, it answers.
    const s1 = getRow(c.db, c.bookId, c.ideaId, S[1]);
    expect([ledgerHeld(s1), ledgerHeld(s1, { ledger: {}, comparisonLedger: {}, spyLedger: {} })]).toEqual([true, false]);
  });
});

describe('the battery’s survivors of the fix round, pinned', () => {
  it('ledgerHeld: a standing reason holds the row even beside a carried mark; the row before, beside a carried mark, cannot rule a hold out', () => {
    const marks = { A: { quality: 'carried_forward' }, B: { quality: 'vendor_time' } };
    const noHolds = { ledger: {}, comparisonLedger: {}, spyLedger: {} };
    expect(ledgerHeld({ fullQuality: false, observed: true, standingQualityReasons: [{ kind: 'sold_shares_differ' }], marks }, noHolds)).toBe(true);
    expect(ledgerHeld({ fullQuality: false, observed: true, marks }, noHolds)).toBe(false);
    expect(ledgerHeld({ fullQuality: false, observed: true, marks })).toBe(true);
    expect(ledgerHeld({ fullQuality: false, observed: false, marks })).toBe(false);
    expect(ledgerHeld({ fullQuality: true, observed: true, marks: { A: { quality: 'vendor_time' } } })).toBe(false);
  });
  it('deriveSinceOpen alone: a row below full quality gives a dash', () => {
    expect(deriveSinceOpen({ markedEquity: 101_000, fullQuality: false }, 100_000)).toEqual({ pct: '—', dir: 0 });
  });
});

// ── B3-A02 (ruling B3-11) ─────────────────────────────────────────────────────────────────────────────────────────────

describe('B3-A02 (B3-11): the book line waits when the last close\'s row is below full quality', () => {
  const expectLineWaits = (v, cashCents, what) => {
    expect(v.line, what).toMatchObject({ value: null, waiting: { text: BOOK_WAITING, reason: BOOK_WAITING_REASON }, today: null, spy: { label: 'SPY', value: '—' } });
    expect(v.line.first, what).toMatchObject({ kind: 'since', value: '—', dir: 0 });
    // Cash still shows, from the row's own stored fields.
    expect(v.line.cash, what).toBe(moneyText(cashCents));
  };

  it('Astra\'s row: one entered idea, no previous valuation, its FIRST close below full quality (an untimed AAPL mark)', async () => {
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 }, date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], { AAPL: { price: 99.96, marketCap: 3e12, at: null }, SPY: 500 });
    const row = bookRow(c, S[0]);
    expect(row).toMatchObject({ fullQuality: false });
    const daily = Object.keys(Object.fromEntries(c.db._store)).filter((p) => p.startsWith(`mandates/${c.bookId}/dailyRows/`));
    expect(daily).toHaveLength(1); // no previous valuation
    const v = await view(c);
    expectLineWaits(v, toCents(row.treasuryCash) + toCents(row.reservedCash), 'first close');
  });

  it('Astra\'s row: the unobserved close with a prior row — the same', async () => {
    const c = await seedBook();
    const quotes = { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 };
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes, date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], quotes);
    expect(bookRow(c, S[0]).fullQuality).toBe(true);
    await catchUpAt(c.db, c.bookId, { date: S[2] }); // S[1] had no stored close snapshot: recorded unobserved
    const row = bookRow(c, S[1]);
    expect(row).toMatchObject({ observed: false, fullQuality: false });
    const v = await view(c);
    expect(v.day).toBe('Tue 17 Nov');
    expectLineWaits(v, toCents(row.treasuryCash) + toCents(row.reservedCash), 'unobserved');
    expect(v.asOf.text).toBe('No close was recorded for 17 Nov; marks are carried from the last one.');
  });

  it('a book with no daily row yet (a new book, all cash) keeps its line', async () => {
    const c = await seedBook();
    const v = await view(c);
    expect(v.line).toMatchObject({ value: '$100,000.00', waiting: null, today: null });
  });
});

// ── B3-A03 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B3-A03: SPY starts at the book\'s FIRST FILL', () => {
  // Two ideas entering on one day: A at the open30 window (10:02 Eastern, 15:02 UTC, SPY 500); B — AAPL missing from the
  // opening quotes — at the midday window (12:47 Eastern, 17:47 UTC, SPY 550). SPY closes at 560: +12.00% from the first.
  const OPEN = { MSFT: { price: 200, marketCap: 3e12 }, SPY: 500 };
  const MID = { MSFT: { price: 200, marketCap: 3e12 }, AAPL: { price: 100, marketCap: 3e12 }, SPY: 550 };
  const CLOSE = { MSFT: { price: 201, marketCap: 3e12 }, AAPL: { price: 101, marketCap: 3e12 }, SPY: 560 };
  /** Two opIds whose idea ids sort the given way (the document-id order). */
  function opIdsFor(bookId, firstFillSortsFirst) {
    for (let i = 0; i < 200; i += 1) {
      const a = `a-${i}`, b = `b-${i}`;
      if ((ideaIdFor(bookId, a) < ideaIdFor(bookId, b)) === firstFillSortsFirst) return { a, b };
    }
    throw new Error('no opIds');
  }
  for (const admitFirst of ['A', 'B']) {
    for (const idOrder of [true, false]) {
      it(`+12.00% — admission order ${admitFirst} first, the first fill's document id sorting ${idOrder ? 'first' : 'last'}`, async () => {
        const c = await seedBook();
        const ops = opIdsFor(c.bookId, idOrder);
        const specs = {
          A: { contract: contractOf({ names: ['MSFT'], slot: 'short' }), opId: ops.a },
          B: { contract: contractOf({ names: ['AAPL'], slot: 'medium' }), opId: ops.b },
        };
        const ids = {};
        for (const k of admitFirst === 'A' ? ['A', 'B'] : ['B', 'A']) {
          const out = await admitIdea(c.db, { bookId: c.bookId, contract: specs[k].contract, opId: specs[k].opId, nowIso: ADMIT_ISO });
          expect(out.ok, JSON.stringify(out)).toBe(true);
          ids[k] = out.ideaId;
        }
        expect(ids.A < ids.B).toBe(idOrder);
        await windowAt(c.db, c.bookId, { date: S[0], slot: 'open30', quotes: OPEN });
        await windowAt(c.db, c.bookId, { date: S[0], slot: 'midday', quotes: MID });
        const a = getIdea(c.db, c.bookId, ids.A);
        const b = getIdea(c.db, c.bookId, ids.B);
        expect([a.entry.filledAt, b.entry.filledAt]).toEqual(['2026-11-16T15:02:00.000Z', '2026-11-16T17:47:00.000Z']);
        await closeOn(c.db, c.bookId, S[0], CLOSE);
        const v = await view(c);
        expect(v.line.spy).toEqual({ label: 'SPY', value: '+12.00%', since: '16 Nov' });
        expect(v.line.first.label).toBe('Since 16 Nov');
      });
    }
  }
});

// ── B3-A04 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B3-A04: a close landing during the read', () => {
  const Q = (p) => ({ AAPL: { price: p, marketCap: 3e12 }, SPY: 500 });
  /** The store, with the 18 Nov close committed (the real close) just before the reader's FIRST daily-rows query runs. */
  function closingDuring(c, runClose, count) {
    let fired = false;
    const wrapQuery = (q, isDaily) => ({
      where: (...x) => wrapQuery(q.where(...x), isDaily),
      orderBy: (...x) => wrapQuery(q.orderBy(...x), isDaily),
      limit: (n) => wrapQuery(q.limit(n), isDaily),
      get: async () => {
        if (isDaily && !fired) { fired = true; await runClose(); }
        const s = await q.get();
        count.queries += 1; count.docs += s.size;
        return s;
      },
    });
    const wrapDoc = (d) => ({ id: d.id, get: async () => { count.docs += 1; return d.get(); }, collection: (n) => wrapCol(d.collection(n), n === 'dailyRows') });
    const wrapCol = (col, isDaily = false) => ({ ...wrapQuery(col, isDaily), doc: (id) => wrapDoc(col.doc(id)) });
    return { collection: (n) => wrapCol(c.db.collection(n)) };
  }

  it('Astra\'s row: the 18 Nov close commits between the book read and the row read — a complete dated answer, never $0.00 under the old date', async () => {
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: Q(100), date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], Q(100));
    await closeOn(c.db, c.bookId, S[1], Q(101)); // the settled 17 Nov book
    const settled17 = (await view(c));
    const aapl17 = name(group(settled17, 'short'), 'AAPL');
    expect([settled17.day, aapl17.mark]).toEqual(['Tue 17 Nov', '101.00']);
    const count = { docs: 0, queries: 0 };
    const db = closingDuring(c, () => closeOn(c.db, c.bookId, S[2], Q(103)), count);
    const { book: v } = await readBookView(db, { uid: UID, agentOn: false });
    const aapl = name(group(v, 'short'), 'AAPL');
    const dayOf = (date, prevDate) => allotCents(getRow(c.db, c.bookId, c.ideaId, date)).get('AAPL') - allotCents(getRow(c.db, c.bookId, c.ideaId, prevDate)).get('AAPL');
    // Either complete dated answer: 17 Nov at 101.00 against 16 Nov, or 18 Nov at 103.00 against 17 Nov. Never a $0.00
    // day under the old date.
    const answer17 = v.day === 'Tue 17 Nov' && aapl.mark === '101.00' && cents(aapl.plDay.text) === dayOf(S[1], S[0]);
    const answer18 = v.day === 'Wed 18 Nov' && aapl.mark === '103.00' && cents(aapl.plDay.text) === dayOf(S[2], S[1]);
    expect(answer17 || answer18, JSON.stringify({ day: v.day, mark: aapl.mark, plDay: aapl.plDay })).toBe(true);
    expect(aapl.plDay.text).not.toBe('$0.00');
    // (This reader re-reads once and answers 18 Nov, the book's own row and the row before it.)
    expect(v.day).toBe('Wed 18 Nov');
    expect(v.line.today.text).toBe(moneyText(toCents(bookRow(c, S[2]).markedEquity) - toCents(bookRow(c, S[1]).markedEquity), { signed: true }));
    // B3-A10: within the restated bound with the re-read — 53 + 4·I + 20·P documents, 4 queries (I = 1, P = 0).
    expect(count.queries).toBe(4);
    expect(count.docs).toBeLessThanOrEqual(53 + 4 * 1);
  });

  it('two closes landing during one read (the re-read disagrees too): the book’s own row and the row strictly before it', async () => {
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: Q(100), date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], Q(100));
    await closeOn(c.db, c.bookId, S[1], Q(101));
    // A close commits before EACH of the reader's two daily-rows queries: 18 Nov before the first, 19 Nov before the second.
    const closes = [() => closeOn(c.db, c.bookId, S[2], Q(103)), () => closeOn(c.db, c.bookId, S[3], Q(104))];
    const wrapQuery = (q, isDaily) => ({
      where: (...x) => wrapQuery(q.where(...x), isDaily), orderBy: (...x) => wrapQuery(q.orderBy(...x), isDaily), limit: (n) => wrapQuery(q.limit(n), isDaily),
      get: async () => { if (isDaily && closes.length > 0) await closes.shift()(); return q.get(); },
    });
    const wrapDoc = (d) => ({ id: d.id, get: () => d.get(), collection: (n) => wrapCol(d.collection(n), n === 'dailyRows') });
    const wrapCol = (col, isDaily = false) => ({ ...wrapQuery(col, isDaily), doc: (id) => wrapDoc(col.doc(id)) });
    const { book: v } = await readBookView({ collection: (n) => wrapCol(c.db.collection(n)) }, { uid: UID, agentOn: false });
    // The second read's book names 18 Nov; its rows are 19 and 18 Nov. The answer is 18 Nov's, against 17 Nov.
    expect(v.day).toBe('Wed 18 Nov');
    expect(v.line.value).toBe(moneyText(toCents(bookRow(c, S[2]).markedEquity)));
    expect(v.line.today.text).toBe(moneyText(toCents(bookRow(c, S[2]).markedEquity) - toCents(bookRow(c, S[1]).markedEquity), { signed: true }));
  });

  it('the view itself never takes a row of the session as its "previous" (the reader\'s pick, held in the pure view too)', async () => {
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: Q(100), date: S[0] });
    c.ideaId = r.ideaId;
    await closeOn(c.db, c.bookId, S[0], Q(100));
    await closeOn(c.db, c.bookId, S[1], Q(101));
    const book = { ...c.db._get(`mandates/${c.bookId}`), bookId: c.bookId };
    const idea = { ...getIdea(c.db, c.bookId, c.ideaId), ideaId: c.ideaId };
    const last = getRow(c.db, c.bookId, c.ideaId, S[1]);
    const input = { book, ideas: [idea], rows: new Map([[c.ideaId, { last, prev: last }]]), dailyRows: { last: bookRow(c, S[1]), prev: bookRow(c, S[1]) } };
    const v = buildBookView(input);
    expect(name(group(v, 'short'), 'AAPL').plDay).toBeNull();
    expect(v.line.today).toBeNull();
  });
});

// ── B3-A06 (ruling B3-12) ─────────────────────────────────────────────────────────────────────────────────────────────

describe('B3-A06 (B3-12): a thesis is signed by who wrote it; the managing desk stays on the group and its calls', () => {
  it('Astra\'s row: the founder-authored medium thesis, managed by the Shadow desk — "The founder" in Positions (and History below)', { timeout: 60_000 }, async () => {
    let seen = null;
    await runBookHistory({
      n: 1,
      onSession: async (date, i, c) => { seen = (await readBookView(c.db, { uid: c.uid, agentOn: true })).book; },
    });
    const medium = group(seen, 'medium');
    expect(medium.thesis).toMatchObject({ byline: 'The founder' });
    expect(medium).toMatchObject({ desk: 'shadow', deskName: 'Shadow desk', source: 'Entered by the founder' });
    expect(medium.call).toMatchObject({ deskName: 'Shadow desk' });
    // B3-A08 on the same close: the session the idea entered.
    expect(medium).toMatchObject({ line: 'Entered today · 30 sessions', day: 0, of: 30 });
  });

  it('History: the founder\'s finished idea is signed "The founder", its desk the Shadow desk; an agent\'s, its drafting desk; any other author, no byline', () => {
    const idea = (author, desk) => ({
      ideaId: 'i1', status: 'resulted', admittedAt: '2026-11-13T16:00:00.000Z',
      contract: { slot: 'medium', names: ['JPM'], thesis: { text: 'Banks re-rate.', author }, ...(desk ? { desk } : {}) },
      liquidation: { completedSession: S[3] },
    });
    const founder = finishedView({ idea: idea('founder_fixture'), packet: null, parts: {} });
    expect(founder).toMatchObject({ desk: 'shadow', deskName: 'Shadow desk', thesis: { byline: 'The founder', text: 'Banks re-rate.' } });
    expect(finishedView({ idea: idea('agent', 'shadow'), packet: null, parts: {} }).thesis.byline).toBe('Shadow desk');
    expect(finishedView({ idea: { ...idea('agent', 'archetype'), contract: { ...idea('agent', 'archetype').contract, slot: 'short' } }, packet: null, parts: {} }).thesis.byline).toBe('Archetype desk');
    for (const other of ['player', '', undefined, null]) expect(finishedView({ idea: idea(other), packet: null, parts: {} }).thesis.byline, String(other)).toBeNull();
  });
});

// ── B3-A10 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('B3-A10: the read bound counts unique ideas', () => {
  it('an idea in both the open set and a slot is read once', async () => {
    const c = await seedBook();
    const r = await admitAndEnter(c.db, c.bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 }, date: S[0] });
    await closeOn(c.db, c.bookId, S[0], { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 });
    const book = c.db._get(`mandates/${c.bookId}`);
    expect(book.openIdeaIds).toEqual([r.ideaId]);
    expect(Object.values(book.slots).filter(Boolean)).toEqual([r.ideaId]);
    let ideaReads = 0;
    const wrap = (x) => new Proxy(x, {
      get: (t, k) => {
        if (k === 'doc') return (id) => { const d = t.doc(id); if (id === r.ideaId) return { ...d, collection: d.collection, get: async () => { ideaReads += 1; return d.get(); } }; return wrap(d); };
        if (k === 'collection') return (n) => wrap(t.collection(n));
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    await readBookView(wrap(c.db), { uid: UID });
    expect(ideaReads).toBe(1);
  });
});
