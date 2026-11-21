// api/_utils/practiceField/astraConfirmation.refuter.test.js
//
// T1a-2b-4 final fix (the founder's ruling of 21 Nov 2026, A-1 to A-5) — THE ONE REFUTER'S MONEY FINDING, as rows. The
// refuter, on a read-only snapshot of f61b39c3, was asked for a reachable history where a row listed ahead, or a sold
// holding's rejection, moves money without the founder. It found one (RF-1), and an over-hold of the same cause (RF-2):
//
//   RF-1  a held symbol's announcement was updated from a daily layer REFUSED for that symbol whenever a stored backfill —
//         one global document per symbol, here written for ANOTHER BOOK's sold-holding doubt — reached through the session:
//         the close counted the session covered (sessionCoverage), though a backfill ending at the session vouches for nothing
//         dated after it. The refused daily's $2 became the announcement, and the date paid $199.94 at full quality with no
//         ruling; alone, the same inputs waited as a revision. (A-2's covered closes only; the outcome hung on another book.)
//   RF-2  the same cause withdrew an announcement at a refused close, so an unchanged $1 listed on its date waited as a revision.
//
// The fix: an announcement is updated only at a close whose OWN daily layer covers the symbol (close.js: the session's
// refusal, held or sold). These rows are the refuter's probe, its logging removed; the two-book ones fail at f61b39c3.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureDailySnapshot, ensureUniverseSnapshot, fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { admitIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { makeParseReportingFetcher } from './caParseReport.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { S } from './__testsupport__/caSequences.js';
import { ADMIT_ISO, closeNowOf, contractOf, getIdea, getRow, seedBook, slotNowOf, slotOpenIso, windowAt } from './__testsupport__/fixtures.js';
import { makeMandateFakeDb } from './__testsupport__/fixtures.js';

const symbols = ['AAPL', 'MSFT', 'SPY', 'XLK'];
const dividend = (i, amount) => ({ date: S[i], unadjustedValue: amount });
const split = (i, ratio) => ({ date: S[i], split: ratio });
const parse = (symbol, opts) => fetchCorporateActionsEODHD(symbol, { ...opts, apiKey: 'fixture' });
let restoreMode;
beforeEach(() => {
  vi.stubEnv('COCKPIT_ALLOWLIST_UIDS', 'owner-1,owner-2');
  restoreMode = setPracticeFieldModeForTests('allowlist');
});
afterEach(() => { restoreMode(); vi.unstubAllEnvs(); });

function vendor(rows) {
  return async (url) => {
    const { pathname, searchParams } = new URL(url);
    const matching = rows.filter((row) => pathname.includes('/AAPL.US')
      && pathname.includes('/splits/') === ('split' in row)
      && row.date >= searchParams.get('from') && row.date <= searchParams.get('to'));
    return { ok: true, status: 200, json: async () => matching };
  };
}

async function openBook(db, uid, slot) {
  const ctx = await seedBook({ db, uid, opId: 'create-' + uid });
  const contract = contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, slot, comparison: { type: 'sector_fund', symbols: ['XLK'] } });
  const result = await admitIdea(db, { bookId: ctx.bookId, contract, opId: 'review-' + uid, nowIso: ADMIT_ISO });
  expect(result.ok).toBe(true);
  return { ...ctx, ideaId: result.ideaId };
}
const idea = (ctx) => getIdea(ctx.db, ctx.bookId, ctx.ideaId);

async function daily(db, i, rows) {
  const now = new Date(S[i] + 'T13:30:00Z');
  const built = await ensureDailySnapshot(db, {
    date: S[i], now, coverageTickers: symbols, candidateUniverse: [],
    getFundamentals: async () => ({ fundamentals: { sector: 'Technology', industry: 'Synthetic', marketCap: 3e12 } }),
    fetchCorporateActions: makeParseReportingFetcher(db, { symbols, base: parse, fetchImpl: vendor(rows), now: () => now }),
  });
  return (await built.ref.get()).data();
}
async function snapshot(db, i, slot, price, dailyDoc) {
  const date = S[i], isClose = slot === 'close';
  const now = isClose ? closeNowOf(date) : slotNowOf(date, slot);
  const quoteTime = isClose ? +now - 25 * 60000 : Date.parse(slotOpenIso(date, slot)) - 15 * 60000;
  const prices = { AAPL: price, MSFT: 200, XLK: 200, SPY: 500 };
  await ensureUniverseSnapshot(db, {
    tickKey: date + '_' + slot, sessionDate: date, dailyDoc, now,
    coverageTickers: symbols, candidateUniverse: [], minCandidateCapacity: 0,
    fetchQuotes: async (requested) => Object.fromEntries(requested.map((s) => [s, { close: prices[s], timestamp: quoteTime / 1000 }])),
  });
}
/** One session for every book in `ctxs` (one daily, one set of snapshots); the books close in the order given. */
async function session(db, ctxs, i, rows = [], price = 100, beforeClose = null) {
  const date = S[i], doc = await daily(db, i, rows);
  for (const slot of ['open30', 'midday', 'preClose']) {
    await snapshot(db, i, slot, price, doc);
    for (const ctx of ctxs) await windowAt(db, ctx.bookId, { date, slot, now: slotNowOf(date, slot) });
  }
  await snapshot(db, i, 'close', price, doc);
  for (const ctx of ctxs) {
    if (beforeClose) await beforeClose(ctx);
    const result = await closeIdeaBook(db, ctx.bookRef, { date, now: closeNowOf(date), fetchCorporateActions: parse, caFetchImpl: vendor(rows) });
    expect(result.closed).toBe(true);
  }
}

// The history. A (the victim) holds AAPL throughout (slot long: its line is 15% away). B (another book's idea, slot short)
// sells AAPL at S2, and a malformed split dated within its holding, listed at S3, leaves it a sold-holding doubt — so every
// close from S4 fetches the AAPL backfill [S2 .. session] (caBackfill.js backfillNeeds), one global document per symbol.
//   S5  the vendor announces A's Wednesday (S7) dividend at $1 (clean)          → A's announcement: $1
//   S6  the vendor lists it at $2, beside a second, unreadable row of it ($0)  → A's daily is REFUSED for AAPL
//   S7  the vendor lists $2
async function history(withHelper) {
  const db = makeMandateFakeDb();
  const a = await openBook(db, 'owner-1', 'long');
  const b = withHelper ? await openBook(db, 'owner-2', 'short') : null;
  const all = withHelper ? [b, a] : [a];
  await session(db, all, 0, [], 100);
  await session(db, all, 1, [], 94);
  await session(db, all, 2, [], 94);
  await session(db, all, 3, [split(2, '5:4')], 94);
  await session(db, all, 4, [], 94);
  await session(db, all, 5, [dividend(7, 1)], 94);
  await session(db, all, 6, [dividend(7, 2), { date: S[7], unadjustedValue: 0 }], 94);
  const s6 = idea(a);
  await session(db, all, 7, [dividend(7, 2)], 94);
  return { db, a, b, s6, s7: idea(a), row7: getRow(db, a.bookId, a.ideaId, S[7]) };
}

it('RF-1 control, A alone: S6 is uncovered — the $2 is a revision of the $1 announcement at S7, and waits for the founder', async () => {
  const { db, s6, s7, row7 } = await history(false);
  expect(s7.ledger.dividendsUsd).toBe(0);
}, 60_000);

it('RF-1, A beside B: another book\'s backfill does not make A\'s refused S6 an update — the $2 at S7 is a revision and waits', async () => {
  const { db, b, s6, s7, row7 } = await history(true);
  expect(s7.ledger.dividendsUsd).toBe(0);
}, 60_000);

// OVER-HOLD variant: at S6 the vendor's only row of the announced id is unreadable. Alone, S6 is uncovered — no withdrawal —
// and S7's unchanged $1 pays. Beside B, S6 counts as covered: the announcement is WITHDRAWN there, and S7's unchanged $1 is
// a "withdrawn one listed again" — a revision that waits.
async function history2(withHelper) {
  const db = makeMandateFakeDb();
  const a = await openBook(db, 'owner-1', 'long');
  const b = withHelper ? await openBook(db, 'owner-2', 'short') : null;
  const all = withHelper ? [b, a] : [a];
  await session(db, all, 0, [], 100);
  await session(db, all, 1, [], 94);
  await session(db, all, 2, [], 94);
  await session(db, all, 3, [split(2, '5:4')], 94);
  await session(db, all, 4, [], 94);
  await session(db, all, 5, [dividend(7, 1)], 94);
  await session(db, all, 6, [{ date: S[7], unadjustedValue: 0 }], 94);
  const s6 = idea(a);
  await session(db, all, 7, [dividend(7, 1)], 94);
  return { s6, s7: idea(a), row7: getRow(db, a.bookId, a.ideaId, S[7]) };
}
it('RF-2 control, A alone: an unreadable listing at S6 withdraws nothing and S7 pays $99.97', async () => {
  const { s6, s7, row7 } = await history2(false);
  expect(s7.ledger.dividendsUsd).toBe(99.97);
}, 60_000);
it('RF-2, A beside B: the refused S6 withdraws nothing either — S7\'s unchanged $1 pays $99.97', async () => {
  const { s6, s7, row7 } = await history2(true);
  expect(s7.ledger.dividendsUsd).toBe(99.97);
}, 60_000);

// PLANTED-DOC variant: A alone, and right before A's S6 close the exact practiceFieldCaBackfill/AAPL document B's S6
// backfill pass writes (captured from the two-book run). The document alone flips A's S7 from $0 (revision) to $199.94.
it('RF-1, planted: the backfill document B writes, alone in A\'s store, changes nothing — S7 waits', async () => {
  let captured = null;
  {
    const db = makeMandateFakeDb();
    const a = await openBook(db, 'owner-1', 'long');
    const b = await openBook(db, 'owner-2', 'short');
    const rows = [[], [], [], [split(2, '5:4')], [], [dividend(7, 1)], [dividend(7, 2), { date: S[7], unadjustedValue: 0 }]];
    const prices = [100, 94, 94, 94, 94, 94, 94];
    for (let i = 0; i <= 6; i += 1) await session(db, [b, a], i, rows[i], prices[i], async (ctx) => { if (i === 6 && ctx === a) captured = JSON.parse(JSON.stringify(db._get('practiceFieldCaBackfill/AAPL'))); });
  }
  const db = makeMandateFakeDb();
  const a = await openBook(db, 'owner-1', 'long');
  const rows = [[], [], [], [split(2, '5:4')], [], [dividend(7, 1)], [dividend(7, 2), { date: S[7], unadjustedValue: 0 }]];
  const prices = [100, 94, 94, 94, 94, 94, 94];
  for (let i = 0; i <= 6; i += 1) await session(db, [a], i, rows[i], prices[i], async () => { if (i === 6) await db.collection('practiceFieldCaBackfill').doc('AAPL').set(captured); });
  await session(db, [a], 7, [dividend(7, 2)], 94);
  const l = idea(a).ledger;
  expect(l.dividendsUsd).toBe(0);
}, 60_000);
