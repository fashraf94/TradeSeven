// api/_utils/practiceField/reconcile.transitions.test.js
//
// Practice Field T1a-1 fix round (Astra T1A-02) — EACH OF THE TWO RECONCILIATIONS IS A GUARD OF ITS OWN.
//
// Every money path now reconciles the book AS READ and again the state it is ABOUT TO WRITE. A fault planted in the
// stored state is caught by the first check, and usually by the second as well, so those rows cannot tell whether
// the second check still runs. These rows plant the fault in the TRANSITION instead: the function a path uses to
// build its next state is made to return a state one cent out, while the stored book is sound. Only the next-state
// check can see it. Each row proves that one path's next-state check refuses `recon_failed` and writes nothing.
//
// The faults are switched on for one call at a time; with `fault.on` null every module behaves as the real one.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const fault = { on: null, cents: null };
const plusCent = (usd) => Math.round((usd + 0.01) * 100) / 100;

vi.mock('./ledger.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // Admission builds the new idea's ledger with this.
    newLedger: (...args) => {
      const l = real.newLedger(...args);
      return fault.on === 'newLedger' ? { ...l, cash: plusCent(l.cash) } : l;
    },
    // The close writes each ledger's marks back with this.
    withCloseMarks: (ledger, valuation) => {
      const l = real.withCloseMarks(ledger, valuation);
      return fault.on === 'withCloseMarks' && l.kind === 'idea' ? { ...l, cash: plusCent(l.cash) } : l;
    },
  };
});
vi.mock('./fills.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // The entry books the book's side from each idea fill's receipt.
    executeIdeaFill: (args) => {
      const out = real.executeIdeaFill(args);
      return fault.on === 'fill' && args.ledger.kind === 'idea'
        ? { ...out, receipt: { ...out.receipt, executedSizeUsd: Math.round((out.receipt.executedSizeUsd - 0.01) * 100) / 100 } }
        : out;
    },
  };
});
vi.mock('./admission.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // The entry timeout (and the close's) returns the reservation with this. `releaseIdea` calls its own copy.
    planRelease: (args) => {
      const out = real.planRelease(args);
      if (fault.on !== 'planRelease') return out;
      return { ...out, nextBook: { ...out.nextBook, treasury: { ...out.nextBook.treasury, unreservedCash: plusCent(out.nextBook.treasury.unreservedCash) } } };
    },
  };
});
vi.mock('../mandateValuation.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // The close values the BOOK's own positions with this (they carry an `ideaId`; an idea's ledger holdings do not):
    // a book-side valuation a dollar per position away from its ideas' rows.
    markBook: (positions, cash, snapshot) => {
      const out = real.markBook(positions, cash, snapshot);
      const bookSide = Object.values(positions || {}).some((p) => typeof p?.ideaId === 'string');
      if (fault.on !== 'bookMark' || !bookSide) return out;
      const n = Object.keys(out.marked).length;
      return { ...out, positionsValue: out.positionsValue + n, totalValue: out.totalValue + n };
    },
  };
});
vi.mock('./money.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // `releaseIdea` builds the returned treasury with this, through its own planRelease: one exact value is a cent out.
    fromCents: (c) => (fault.on === 'fromCents' && c === fault.cents ? real.fromCents(c + 1) : real.fromCents(c)),
  };
});

const { admitIdea, releaseIdea } = await import('./admission.js');
const { enterIdea } = await import('./entry.js');
const { closeIdeaBook } = await import('./close.js');
const { setPracticeFieldModeForTests } = await import('./mode.js');
const { isPracticeFieldError } = await import('./errors.js');
const {
  seedBook, admitAndEnter, contractOf, getBook, tickOf, tickSnapshot, slotOpenIso, etIso, storeCloseSnapshot, DAYS, ADMIT_ISO,
} = await import('./__testsupport__/fixtures.js');

const QUOTES = { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 };
const nowAt = (date, slot) => new Date(Date.parse(slotOpenIso(date, slot)) + 2 * 60_000).toISOString();

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); fault.on = null; fault.cents = null; });
afterEach(() => { restoreMode(); fault.on = null; fault.cents = null; });

/** Run `call` with one fault on: it must be refused recon_failed naming `rule`, and write nothing. */
async function refusedByTheNextStateCheck(db, on, call, rule) {
  const before = JSON.stringify([...db._store.entries()]);
  fault.on = on;
  let err = null;
  try { await call(); } catch (e) { err = e; } finally { fault.on = null; }
  expect(isPracticeFieldError(err, 'recon_failed'), String(err)).toBe(true);
  expect(err.detail.problems.map((p) => p.rule)).toContain(rule);
  expect(JSON.stringify([...db._store.entries()])).toBe(before);
}

describe('the next-state reconciliation of each money path, with the book as read sound', () => {
  it('admission: a new idea whose ledger holds a cent more than was reserved is refused', async () => {
    const { db, bookId } = await seedBook();
    await refusedByTheNextStateCheck(db, 'newLedger', () => admitIdea(db, { bookId, contract: contractOf(), opId: 'a', nowIso: ADMIT_ISO }), 'cash_mismatch');
    expect((await admitIdea(db, { bookId, contract: contractOf(), opId: 'a', nowIso: ADMIT_ISO })).ok).toBe(true); // and sound without the fault
  });

  it('release: a treasury returned a cent too high is refused', async () => {
    const { db, bookId } = await seedBook();
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'a', nowIso: ADMIT_ISO });
    fault.cents = 100000 * 100; // 80,000.00 in the treasury + 20,000.00 returned
    await refusedByTheNextStateCheck(db, 'fromCents', () => releaseIdea(db, { bookId, ideaId: a.ideaId, nowIso: ADMIT_ISO }), 'cash_mismatch');
    expect((await releaseIdea(db, { bookId, ideaId: a.ideaId, nowIso: ADMIT_ISO })).released).toBe(true);
  });

  it('entry: a fill booked onto the book a cent away from the idea\'s ledger is refused', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'a', nowIso: ADMIT_ISO });
    const tick = tickOf(DAYS.d1, 'open30');
    const enter = () => enterIdea(db, { bookRef, ideaId: a.ideaId, tick, snapshot: tickSnapshot(DAYS.d1, 'open30', QUOTES), nowIso: nowAt(DAYS.d1, 'open30') });
    await refusedByTheNextStateCheck(db, 'fill', enter, 'cash_mismatch');
    expect((await enter()).outcome).toBe('entered');
  });

  it('the entry timeout: a reservation returned a cent too high is refused', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'a', nowIso: ADMIT_ISO });
    const late = () => enterIdea(db, { bookRef, ideaId: a.ideaId, tick: tickOf(DAYS.d2, 'open30'), snapshot: tickSnapshot(DAYS.d2, 'open30', QUOTES), nowIso: nowAt(DAYS.d2, 'open30') });
    await refusedByTheNextStateCheck(db, 'planRelease', late, 'cash_mismatch');
    expect((await late()).outcome).toBe('cancelled');
  });

  it('the close: a ledger written back a cent away from the book is refused, and so is a timeout a cent out', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    await admitAndEnter(db, bookId, { contract: contractOf(), opId: 'a', quotes: QUOTES });
    await storeCloseSnapshot(db, DAYS.d1, { AAPL: 100.13, SPY: 500 });
    const close = () => closeIdeaBook(db, bookRef, { date: DAYS.d1, now: new Date(etIso(DAYS.d1, 16, 25)) });
    await refusedByTheNextStateCheck(db, 'withCloseMarks', close, 'cash_mismatch');
    // An accepted idea whose start session is over times out inside the close.
    await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'b', nowIso: ADMIT_ISO });
    await refusedByTheNextStateCheck(db, 'planRelease', close, 'cash_mismatch');
    const out = await close();
    expect(out.closed).toBe(true);
    expect(out.cancelled).toHaveLength(1);
    expect(getBook(db, bookId).execState.lastCloseKey).toBe(DAYS.d1);
  });

  it('the close: its own valuation of the book\'s positions, a dollar away from its ideas\' rows, is refused `book_marks_disagree_with_ideas` (review L1-6) — the as-read check cannot see a fault made during the close', async () => {
    const { db, bookId, bookRef } = await seedBook();
    await admitAndEnter(db, bookId, { contract: contractOf(), opId: 'a', quotes: QUOTES });
    await storeCloseSnapshot(db, DAYS.d1, { AAPL: 100.13, SPY: 500 });
    const before = JSON.stringify([...db._store.entries()]);
    fault.on = 'bookMark';
    let err = null;
    try { await closeIdeaBook(db, bookRef, { date: DAYS.d1, now: new Date(etIso(DAYS.d1, 16, 25)) }); } catch (e) { err = e; } finally { fault.on = null; }
    expect(isPracticeFieldError(err, 'book_marks_disagree_with_ideas'), String(err)).toBe(true);
    expect(JSON.stringify([...db._store.entries()])).toBe(before);
    expect((await closeIdeaBook(db, bookRef, { date: DAYS.d1, now: new Date(etIso(DAYS.d1, 16, 25)) })).closed).toBe(true);
  });
});
