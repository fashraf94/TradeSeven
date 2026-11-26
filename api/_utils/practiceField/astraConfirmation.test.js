import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureDailySnapshot, ensureUniverseSnapshot, fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { admitIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { makeParseReportingFetcher } from './caParseReport.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { S } from './__testsupport__/caSequences.js';
import { ADMIT_ISO, closeNowOf, contractOf, founderRules, getIdea, seedBook, slotNowOf, slotOpenIso, windowAt } from './__testsupport__/fixtures.js';

const symbols = ['AAPL', 'MSFT', 'SPY', 'XLK'];
const dividend = (i, amount) => ({ date: S[i], unadjustedValue: amount });
const split = (i, ratio) => ({ date: S[i], split: ratio });
const parse = (symbol, opts) => fetchCorporateActionsEODHD(symbol, { ...opts, apiKey: 'fixture' });
let restoreMode;
beforeEach(() => {
  vi.stubEnv('PRACTICE_FIELD_PLAYER_UIDS', 'owner-1'); // build B4 (B4-1): the idea book's own player list
  restoreMode = setPracticeFieldModeForTests('allowlist');
});
afterEach(() => { restoreMode(); vi.unstubAllEnvs(); });

async function openIdea() {
  const ctx = await seedBook();
  const contract = contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000, comparison: { type: 'sector_fund', symbols: ['XLK'] } });
  const result = await admitIdea(ctx.db, { bookId: ctx.bookId, contract, opId: 'review', nowIso: ADMIT_ISO });
  expect(result.ok).toBe(true);
  return { ...ctx, ideaId: result.ideaId };
}
const idea = (ctx) => getIdea(ctx.db, ctx.bookId, ctx.ideaId);
const ask = (ctx, body, key) => founderRules(ctx.db, ctx.bookId, ctx.ideaId, body, { requestKey: key, expectOk: false });
const approve = (ctx, i) => ask(ctx, {
  kind: 'late_adjustment', recordId: 'late_idea_cash_dividend_AAPL_' + S[i], decision: 'approve',
}, 'approval');

function vendor(rows) {
  return async (url) => {
    const { pathname, searchParams } = new URL(url);
    const matching = rows.filter(row => pathname.includes('/AAPL.US')
      && pathname.includes('/splits/') === ('split' in row)
      && row.date >= searchParams.get('from') && row.date <= searchParams.get('to'));
    return { ok: true, status: 200, json: async () => matching };
  };
}

async function daily(ctx, i, rows, time = '13:30', gate = null) {
  const now = new Date(S[i] + 'T' + time + ':00Z');
  const built = await ensureDailySnapshot(ctx.db, {
    date: S[i], now, coverageTickers: symbols, candidateUniverse: [],
    getFundamentals: async symbol => {
      if (symbol === 'AAPL' && gate) { gate.signal(); await gate.wait; }
      return { fundamentals: { sector: 'Technology', industry: 'Synthetic', marketCap: 3e12 } };
    },
    fetchCorporateActions: makeParseReportingFetcher(ctx.db, { symbols, base: parse, fetchImpl: vendor(rows), now: () => now }),
  });
  return (await built.ref.get()).data();
}
async function snapshot(ctx, i, slot, price, dailyDoc) {
  const date = S[i], isClose = slot === 'close';
  const now = isClose ? closeNowOf(date) : slotNowOf(date, slot);
  const quoteTime = isClose ? +now - 25 * 60000 : Date.parse(slotOpenIso(date, slot)) - 15 * 60000;
  const prices = { AAPL: price, MSFT: 200, XLK: 200, SPY: 500 };
  await ensureUniverseSnapshot(ctx.db, {
    tickKey: date + '_' + slot, sessionDate: date, dailyDoc, now,
    coverageTickers: symbols, candidateUniverse: [], minCandidateCapacity: 0,
    fetchQuotes: async requested => Object.fromEntries(requested.map(s => [s, { close: prices[s], timestamp: quoteTime / 1000 }])),
  });
}
async function session(ctx, i, rows = [], price = 100) {
  const date = S[i], doc = await daily(ctx, i, rows);
  for (const slot of ['open30', 'midday', 'preClose']) {
    await snapshot(ctx, i, slot, price, doc);
    await windowAt(ctx.db, ctx.bookId, { date, slot, now: slotNowOf(date, slot) });
  }
  await snapshot(ctx, i, 'close', price, doc);
  const result = await closeIdeaBook(ctx.db, ctx.bookRef, {
    date, now: closeNowOf(date), fetchCorporateActions: parse, caFetchImpl: vendor(rows),
  });
  expect(result.closed).toBe(true);
  return idea(ctx).ledger;
}

it('C01 H-revise', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [dividend(3, 1)]);
  await session(ctx, 2, [dividend(3, 2)]);
  // CHANGED EXPECTATION — A-1 (the founder's ruling, 21 Nov 2026): Astra's row expected 0. Before its date, the latest
  // listing of an id is the announcement: the $2 listed on Wednesday for Thursday is what Thursday pays, at full quality.
  expect((await session(ctx, 3, [dividend(3, 2)])).dividendsUsd).toBe(199.94);
});

it('C02 held-post-forward-pair', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [dividend(1, 1)]);
  await session(ctx, 2, [split(1, '5/4'), dividend(1, 1)], 80);
  expect((await approve(ctx, 1)).status).toBe(200);
  expect((await session(ctx, 3, [dividend(4, 1)], 80)).dividendsUsd).toBe(99.97);
});

it('C03 sold-moved-past-sale', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [dividend(3, 1)], 94);
  const sold = await session(ctx, 2, [], 94);
  expect(sold.saleReceipts[0]).toMatchObject({ sessionDate: S[2], shares: 99.970008 });
  await session(ctx, 3, [dividend(2, 1)], 94);
  const answer = await approve(ctx, 2);
  expect((await session(ctx, 4, [dividend(2, 1)], 94)).dividendsUsd).toBe(0);
  expect([404, 409]).toContain(answer.status);
});

function gate() {
  let release, signal;
  const wait = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { signal = resolve; });
  return { ready, wait, release, signal };
}
it('C04 natural-dirty-after', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [], 94);
  await session(ctx, 2, [], 94);
  await session(ctx, 3, [dividend(2, 1)], 94);
  expect((await approve(ctx, 2)).status).toBe(200);
  expect((await session(ctx, 4, [split(2, '5:4')], 94)).dividendsUsd).toBe(0);

  const first = gate(), last = gate();
  const badRows = [dividend(2, 1), split(2, '3:2')];
  const cleanLoser = daily(ctx, 5, [dividend(2, 1)], '21:24', first);
  const dirtyLoser = daily(ctx, 5, badRows, '21:26', last);
  await Promise.all([first.ready, last.ready]);
  const doc = await daily(ctx, 5, [dividend(2, 1), split(2, '5:4')], '21:23');
  first.release();
  await cleanLoser;
  await snapshot(ctx, 5, 'close', 94, doc);

  let staged = false, merged = false;
  const date = S[5];
  const result = await closeIdeaBook(ctx.db, ctx.bookRef, {
    date, now: closeNowOf(date), fetchCorporateActions: parse,
    caFetchImpl: async url => {
      if (!staged) {
        staged = true;
        ctx.db.setBarrier(async () => {
          expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ to: date, failed: false });
          last.release();
          await dirtyLoser;
          merged = true;
        });
      }
      return vendor([dividend(2, 1)])(url);
    },
  });
  expect(result.closed && merged).toBe(true);
  expect(ctx.db._get('practiceFieldCaParseReports/' + date).symbols.AAPL).toMatchObject({
    observations: 3, observationsDisagree: true, rowsRejected: 2,
  });
  expect((await session(ctx, 6, badRows, 94)).dividendsUsd).toBe(0);
});

it('C05 refused reverse split has a founder exit', async () => {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [], 94);
  const held = await session(ctx, 2, [split(2, '1/1000000000')], 94);
  expect(held.holdings.AAPL.heldActions[0].refused).toBe('rounds_to_nothing');
  const answer = await ask(ctx, { kind: 'conflict', recordId: 'reverse_split_AAPL_' + S[2], decision: 'none' }, 'exit');
  expect(answer.status).toBe(200);
  await session(ctx, 3, [], 94);
  expect((await session(ctx, 4, [], 94)).saleReceipts.some(r => r.symbol === 'AAPL')).toBe(true);
});

// ── THE FINAL FIX'S ROWS (the founder's ruling of 21 Nov 2026, A-1 to A-5) ──────────────────────────────────────────────
// Astra's named histories and the variants the build prompt asks for, through the same harness as her five rows above:
// the real daily builder, its parse reports, the close, the windows and the founder's endpoint. S0–S8 are the sessions of
// 16–25 and 27 Nov 2026 (no 26th: Thanksgiving). Every money figure is the idea's own ledger: 99.970008 AAPL shares.
import { describe } from 'vitest';
import { getRow } from './__testsupport__/fixtures.js';

const row = (ctx, i) => getRow(ctx.db, ctx.bookId, ctx.ideaId, S[i]);
const recordsOf = (ctx, f = 'ledger') => idea(ctx)[f].corporateActionReceipts
  .filter((r) => r.reason === 'conflicting_action' || r.reason === 'possible_redate').map((r) => [r.reason, r.actionId]).sort();
const divId = (i) => 'cash_dividend_AAPL_' + S[i];
const lateId = (i) => 'late_idea_cash_dividend_AAPL_' + S[i];
const conflictRule = (ctx, id, decision, payload, key) => ask(ctx, { kind: 'conflict', recordId: id, decision, ...(payload ? { payload } : {}) }, key);
const proposalOf = (ctx, i) => (idea(ctx).ledger.lateProposals || []).find((p) => p.actionId === divId(i)) ?? null;
async function openSameStock() {
  const ctx = await seedBook();
  const result = await admitIdea(ctx.db, { bookId: ctx.bookId, contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000 }), opId: 'review', nowIso: ADMIT_ISO });
  expect(result.ok).toBe(true);
  return { ...ctx, ideaId: result.ideaId };
}

describe('C01 — a held row listed before its date (A-1, A-2, A-3)', () => {
  it('H-baseline: an unchanged advance listing pays once, on its date, at full quality (on-time data, as today)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, [dividend(3, 1)]);
    expect((await session(ctx, 3, [dividend(3, 1)])).dividendsUsd).toBe(99.97);
    expect(row(ctx, 3).fullQuality).toBe(true);
    expect((await session(ctx, 4, [dividend(3, 1)])).dividendsUsd).toBe(99.97);
    expect(recordsOf(ctx)).toEqual([]);
  });

  it('H-withdraw: withdrawn before its date — nothing is owed, nothing waits', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, []);
    expect((await session(ctx, 3, [])).dividendsUsd).toBe(0);
    expect(row(ctx, 3).fullQuality).toBe(true);
    expect(recordsOf(ctx)).toEqual([]);
  });

  it('H-revise: $1 then $2 before the date — the $2 is the announcement and pays on the date, at full quality (A-1)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, [dividend(3, 2)]);
    const l = await session(ctx, 3, [dividend(3, 2)]);
    expect([l.dividendsUsd, l.cash, row(ctx, 3).fullQuality]).toEqual([199.94, 199.94, true]);
    expect(recordsOf(ctx)).toEqual([]);
  });

  it('H-revise after the date: $1 paid on its date, then revised to $2 — a revision for the founder; $99.97 kept', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, [dividend(3, 1)]);
    expect((await session(ctx, 3, [dividend(3, 1)])).dividendsUsd).toBe(99.97);
    const l = await session(ctx, 4, [dividend(3, 2)]);
    expect(l.dividendsUsd).toBe(99.97);
    expect(l.corporateActionReceipts.filter((r) => r.reason === 'revised_after_ruling').map((r) => [r.actionId, r.closedBy])).toEqual([[divId(3), null]]);
    expect(row(ctx, 4).fullQuality).toBe(false);
  });

  it('a payload changed AT the date close is a revision: $1 announced, $2 listed on the date — waits; the founder rules it', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, [dividend(3, 1)]);
    expect((await session(ctx, 3, [dividend(3, 2)])).dividendsUsd).toBe(0);
    expect(recordsOf(ctx)).toEqual([['conflicting_action', divId(3)]]);
    expect(row(ctx, 3).fullQuality).toBe(false);
    expect((await conflictRule(ctx, divId(3), 'payload', { amount: 2 }, 'rev')).status).toBe(200);
    expect((await session(ctx, 4, [dividend(3, 2)])).dividendsUsd).toBe(199.94);
  });

  it('H-conflict resolving before the date: [$1, $2] then [$1] — the $1 is the announcement and pays (A-1)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1), dividend(3, 2)]);
    await session(ctx, 2, [dividend(3, 1)]);
    expect((await session(ctx, 3, [dividend(3, 1)])).dividendsUsd).toBe(99.97);
    expect(row(ctx, 3).fullQuality).toBe(true);
    expect(recordsOf(ctx)).toEqual([]);
  });

  it('held-early-ruling: before the date nothing waits, so there is nothing to rule — 404 (A-3: no pre-date ruling is needed)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1), dividend(3, 2)]);
    expect((await conflictRule(ctx, divId(3), 'payload', { amount: 1 }, 'early')).status).toBe(404);
    expect(row(ctx, 1).fullQuality).toBe(true);
  });

  it('H-conflict still conflicting at its date: an ordinary conflict, with `conflict` as the exit (A-3)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1), dividend(3, 2)]);
    await session(ctx, 2, [dividend(3, 1), dividend(3, 2)]);
    expect((await session(ctx, 3, [dividend(3, 1), dividend(3, 2)])).dividendsUsd).toBe(0);
    expect(recordsOf(ctx)).toEqual([['conflicting_action', divId(3)]]);
    expect((await conflictRule(ctx, divId(3), 'payload', { amount: 1 }, 'at-date')).status).toBe(200);
    expect((await session(ctx, 4, [dividend(3, 1), dividend(3, 2)])).dividendsUsd).toBe(99.97);
  });

  it('an announcement that enters its date conflicting and is listed one way on the date is still a conflict (A-3)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1), dividend(3, 2)]);
    await session(ctx, 2, [dividend(3, 1), dividend(3, 2)]);
    const l = await session(ctx, 3, [dividend(3, 1)]);
    expect(l.dividendsUsd).toBe(0);
    const rec = l.corporateActionReceipts.find((r) => r.actionId === divId(3) && r.reason === 'conflicting_action');
    expect(rec.rows.map((x) => x.amount).sort()).toEqual([1, 2]);
    expect((await conflictRule(ctx, divId(3), 'payload', { amount: 1 }, 'enters')).status).toBe(200);
    expect((await session(ctx, 4, [dividend(3, 1)])).dividendsUsd).toBe(99.97);
  });

  it('withdrawn before its date and listed again on it: a revision of the announcement — waits for the founder', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, []);
    expect((await session(ctx, 3, [dividend(3, 1)])).dividendsUsd).toBe(0);
    expect(recordsOf(ctx)).toEqual([['conflicting_action', divId(3)]]);
    expect((await conflictRule(ctx, divId(3), 'payload', { amount: 1 }, 'relisted')).status).toBe(200);
    expect((await session(ctx, 4, [dividend(3, 1)])).dividendsUsd).toBe(99.97);
  });

  it('only a covered close updates an announcement: $2 seen at a close whose parse report rejected a row is no update', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, [dividend(3, 2), split(3, '5:4')]); // the malformed 5:4 is rejected: S2 does not cover AAPL
    expect(row(ctx, 2).fullQuality).toBe(false);
    expect((await session(ctx, 3, [dividend(3, 2)])).dividendsUsd).toBe(0);
    expect(recordsOf(ctx)).toEqual([['conflicting_action', divId(3)]]);
  });

  it('H-move: Thursday $1 announced Tuesday, Wednesday $1 listed on Wednesday — a re-date seen on its date: both wait', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    expect((await session(ctx, 2, [dividend(2, 1)])).dividendsUsd).toBe(0);
    expect(recordsOf(ctx)).toEqual([['possible_redate', divId(2)], ['possible_redate', divId(3)]]);
    expect(row(ctx, 2).fullQuality).toBe(false);
    expect((await conflictRule(ctx, divId(2), 'payload', { amount: 1 }, 'move-2')).status).toBe(200);
    expect((await conflictRule(ctx, divId(3), 'none', null, 'move-3')).status).toBe(200);
    expect((await session(ctx, 3, [dividend(2, 1), dividend(3, 1)])).dividendsUsd).toBe(99.97);
    expect((await session(ctx, 4, [])).dividendsUsd).toBe(99.97);
  });

  it('a move made before both dates is an update: Thursday $1, then Friday $1 instead — Friday pays once', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1)]);
    await session(ctx, 2, [dividend(4, 1)]);
    expect((await session(ctx, 3, [dividend(4, 1)])).dividendsUsd).toBe(0);
    expect((await session(ctx, 4, [dividend(4, 1)])).dividendsUsd).toBe(99.97);
    expect(row(ctx, 4).fullQuality).toBe(true);
    expect(recordsOf(ctx)).toEqual([]);
  });

  // (The switch made before both dates — and the replaced id listed again — run in corporateActionSequences.ahead.test.js:
  // this harness clips the vendor to the daily layer's two-day lookahead, where such a switch is rarely reachable.)

  it('two dates both announced at the last close before either: both wait from the first date (A-2)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(3, 1), dividend(4, 1)]);
    await session(ctx, 2, [dividend(3, 1), dividend(4, 1)]);
    expect((await session(ctx, 3, [dividend(3, 1), dividend(4, 1)])).dividendsUsd).toBe(0);
    expect(recordsOf(ctx)).toEqual([['possible_redate', divId(3)], ['possible_redate', divId(4)]]);
  });

  it('H-split: 2/1 then 3/2 before the date — 3/2 applies as an update, and the $1 of the date pays on its count', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [split(3, '2/1')]);
    await session(ctx, 2, [split(3, '3/2')]);
    const l = await session(ctx, 3, [split(3, '3/2'), dividend(3, 1)], 66.67);
    expect([l.holdings.AAPL.shares, l.dividendsUsd, row(ctx, 3).fullQuality]).toEqual([149.955012, 149.96, true]);
    expect(recordsOf(ctx)).toEqual([]);
  });
});

describe('C02 — a held proposal and a listed-ahead partner (A-2: an observation is a pairing candidate)', () => {
  it('held-post-forward-pair: the approval waits while the partner stands; `none` on it posts the net once; replays are inert', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(1, 1)]);
    await session(ctx, 2, [split(1, '5/4'), dividend(1, 1)], 80);
    expect((await approve(ctx, 1)).status).toBe(200);
    expect((await session(ctx, 3, [dividend(4, 1)], 80)).dividendsUsd).toBe(99.97);
    expect(recordsOf(ctx)).toEqual([['possible_redate', divId(4)]]);
    expect(row(ctx, 3).fullQuality).toBe(false);
    expect((await conflictRule(ctx, divId(4), 'none', null, 'partner')).status).toBe(200);
    const l = await session(ctx, 4, [dividend(4, 1)], 80);
    expect([l.dividendsUsd, l.cash]).toEqual([124.96, 124.96]);
    expect((l.adjustments || []).map((a) => [a.kind, a.actionId, a.amountUsd])).toEqual([['late_basis', divId(1), 24.99]]);
    expect((await approve(ctx, 1)).body.idempotentReplay).toBe(true);
    expect((await session(ctx, 5, [], 80)).dividendsUsd).toBe(124.96);
    expect((idea(ctx).ledger.adjustments || []).length).toBe(1);
  });

  it('held-request-forward-pair: the partner listed at the proposal\'s own close — approval refused (409), also once withdrawn, until `none`', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(1, 1)]);
    await session(ctx, 2, [split(1, '5/4'), dividend(1, 1), dividend(3, 1)], 80);
    expect(proposalOf(ctx, 1)?.status).toBe('open');
    const refused = await approve(ctx, 1);
    expect([refused.status, refused.body.error]).toEqual([409, 'late_pairs_with_candidate']);
    await session(ctx, 3, [], 80); // the partner withdrawn on its own date: its record stands
    expect((await ask(ctx, { kind: 'late_adjustment', recordId: lateId(1), decision: 'approve' }, 'approval-2')).status).toBe(409);
    expect((await conflictRule(ctx, divId(3), 'none', null, 'partner')).status).toBe(200);
    await session(ctx, 4, [], 80);
    expect((await ask(ctx, { kind: 'late_adjustment', recordId: lateId(1), decision: 'approve' }, 'approval-3')).status).toBe(200);
    expect((await session(ctx, 5, [], 80)).dividendsUsd).toBe(124.96);
    expect((await session(ctx, 6, [], 80)).dividendsUsd).toBe(124.96);
    expect((idea(ctx).ledger.adjustments || []).length).toBe(1);
  });

  it('held-post-due-pair-control: a partner due at the posting close — the accepted approval waits, $99.97 kept', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(1, 1)]);
    await session(ctx, 2, [split(1, '5/4'), dividend(1, 1)], 80);
    expect((await approve(ctx, 1)).status).toBe(200);
    const l = await session(ctx, 3, [dividend(3, 1)], 80);
    expect([l.dividendsUsd, l.cash, row(ctx, 3).fullQuality]).toEqual([99.97, 99.97, false]);
  });
});

describe('C03 — an announcement seen while held is remembered across the sale (A-2)', () => {
  const sellOnS2 = async (ctx, announced) => {
    await session(ctx, 0);
    await session(ctx, 1, announced, 94);
    const sold = await session(ctx, 2, [], 94);
    expect(sold.saleReceipts[0]).toMatchObject({ sessionDate: S[2], shares: 99.970008 });
  };

  it('sold-changed-past-sale: $1 announced for the sale day, $2 listed after the sale — a revision, never a proposal', async () => {
    const ctx = await openIdea();
    await sellOnS2(ctx, [dividend(2, 1)]);
    await session(ctx, 3, [dividend(2, 2)], 94);
    expect(recordsOf(ctx)).toEqual([['conflicting_action', divId(2)]]);
    expect([404, 409]).toContain((await approve(ctx, 2)).status);
    expect((await session(ctx, 4, [dividend(2, 2)], 94)).dividendsUsd).toBe(0);
    // The founder's exit: the conflict ruling on the closed holding's row (§11.4 reading 2: its authority posts it).
    expect((await conflictRule(ctx, divId(2), 'payload', { amount: 2 }, 'changed')).status).toBe(200);
    expect((await session(ctx, 5, [dividend(2, 2)], 94)).dividendsUsd).toBe(199.94);
  });

  it('sold-pair-only-after-sale (control): Thursday $1 first shown at the sale close, Wednesday $1 the next — a possible re-date', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [], 94);
    await session(ctx, 2, [dividend(3, 1)], 94);
    await session(ctx, 3, [dividend(2, 1)], 94);
    expect(recordsOf(ctx)).toEqual([['possible_redate', divId(2)]]);
    expect((await approve(ctx, 2)).status).toBe(404);
    expect((await session(ctx, 4, [], 94)).dividendsUsd).toBe(0);
  });

  it('sold-withdrawn (control): announced for the sale day, withdrawn — pays zero, nothing proposed', async () => {
    const ctx = await openIdea();
    await sellOnS2(ctx, [dividend(2, 1)]);
    expect((await session(ctx, 3, [], 94)).dividendsUsd).toBe(0);
    expect(idea(ctx).ledger.lateProposals ?? []).toEqual([]);
    expect(recordsOf(ctx)).toEqual([]);
  });

  it('an unchanged announcement for the sale day, listed on it (control, as today): the sale waits for the row, the close pays it, the sale follows', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [dividend(2, 1)], 94);
    const s2 = await session(ctx, 2, [dividend(2, 1)], 94);
    expect([s2.dividendsUsd, s2.holdings.AAPL?.shares, row(ctx, 2).fullQuality]).toEqual([99.97, 99.970008, true]);
    const s3 = await session(ctx, 3, [dividend(2, 1)], 94);
    expect([s3.dividendsUsd, s3.saleReceipts[0]?.sessionDate, s3.lateProposals ?? []]).toEqual([99.97, S[3], []]);
  });
});

describe('C04 — on a sold holding a rejection clears only by the founder\'s coverage_gap ruling (A-4)', () => {
  const soldWithApproval = async (ctx) => {
    await session(ctx, 0);
    await session(ctx, 1, [], 94);
    await session(ctx, 2, [], 94);
    await session(ctx, 3, [dividend(2, 1)], 94);
    expect((await approve(ctx, 2)).status).toBe(200);
    expect((await session(ctx, 4, [split(2, '5:4')], 94)).dividendsUsd).toBe(0);
  };
  const doubtOf = (ctx) => idea(ctx).ledger.closedCoverageDoubts?.AAPL ?? null;
  const release = (ctx, recordId, key) => ask(ctx, { kind: 'coverage_gap', recordId, decision: 'no_action' }, key);

  it('natural-dirty-after: the doubt stands through S6 with $0; the founder\'s no_action releases one $99.97; replays are inert', async () => {
    const ctx = await openIdea();
    await soldWithApproval(ctx);
    const first = gate(), last = gate();
    const badRows = [dividend(2, 1), split(2, '3:2')];
    const cleanLoser = daily(ctx, 5, [dividend(2, 1)], '21:24', first);
    const dirtyLoser = daily(ctx, 5, badRows, '21:26', last);
    await Promise.all([first.ready, last.ready]);
    const doc = await daily(ctx, 5, [dividend(2, 1), split(2, '5:4')], '21:23');
    first.release();
    await cleanLoser;
    await snapshot(ctx, 5, 'close', 94, doc);
    let staged = false;
    const date = S[5];
    await closeIdeaBook(ctx.db, ctx.bookRef, {
      date, now: closeNowOf(date), fetchCorporateActions: parse,
      caFetchImpl: async (url) => {
        if (!staged) { staged = true; ctx.db.setBarrier(async () => { last.release(); await dirtyLoser; }); }
        return vendor([dividend(2, 1)])(url);
      },
    });
    expect(ctx.db._get('practiceFieldCaParseReports/' + date).symbols.AAPL).toMatchObject({ observations: 3, observationsDisagree: true, rowsRejected: 2 });
    expect(doubtOf(ctx)).toMatchObject({ dates: [{ date: S[2] }], evidence: { cleanRefetch: { failed: false } } });
    expect((await session(ctx, 6, badRows, 94)).dividendsUsd).toBe(0);
    expect(row(ctx, 6).fullQuality).toBe(false);
    const id = doubtOf(ctx).id;
    expect((await release(ctx, id, 'doubt')).status).toBe(200);
    const l = await session(ctx, 7, [], 94);
    expect([l.dividendsUsd, doubtOf(ctx)]).toEqual([99.97, null]);
    expect((await release(ctx, id, 'doubt')).body.idempotentReplay).toBe(true);
    expect((await release(ctx, id, 'doubt-again')).status).toBe(409);
    expect((await session(ctx, 8, [], 94)).dividendsUsd).toBe(99.97);
    expect((idea(ctx).ledger.adjustments || []).length).toBe(1);
  });

  it('fresh-backfill: a clean backfill fetched after the latest rejection no longer clears it — the founder does', async () => {
    const ctx = await openIdea();
    await soldWithApproval(ctx);
    // CHANGED EXPECTATION — A-4: before, the clean backfill fetched at S5 (after S4's rejection) cleared the doubt and the
    // waiting approval posted $99.97 at S5 (F-1). It is evidence for the founder now, and clears nothing.
    expect((await session(ctx, 5, [dividend(2, 1)], 94)).dividendsUsd).toBe(0);
    expect(ctx.db._get('practiceFieldCaBackfill/AAPL')).toMatchObject({ failed: false });
    expect(doubtOf(ctx)).toMatchObject({ dates: [{ date: S[2], seenOn: S[4] }], evidence: { cleanRefetch: { failed: false } } });
    expect((await session(ctx, 6, [], 94)).dividendsUsd).toBe(0);
    expect((await release(ctx, doubtOf(ctx).id, 'doubt')).status).toBe(200);
    expect((await session(ctx, 7, [], 94)).dividendsUsd).toBe(99.97);
  });

  it('no-clean: every backfill keeps failing on the bad row — the doubt stands and $0; the founder\'s ruling releases it', async () => {
    const ctx = await openIdea();
    await soldWithApproval(ctx);
    const bad = [dividend(2, 1), split(2, '5:4')];
    expect((await session(ctx, 5, bad, 94)).dividendsUsd).toBe(0);
    expect((await session(ctx, 6, bad, 94)).dividendsUsd).toBe(0);
    expect(row(ctx, 6).fullQuality).toBe(false);
    expect((await release(ctx, doubtOf(ctx).id, 'doubt')).status).toBe(200);
    expect((await session(ctx, 7, [], 94)).dividendsUsd).toBe(99.97);
  });

  it('a rejection seen after the ruling re-opens the doubt; `row` takes only a row of a stored clean refetch (422 without one)', async () => {
    const ctx = await openIdea();
    await soldWithApproval(ctx);
    expect((await ask(ctx, { kind: 'coverage_gap', recordId: doubtOf(ctx).id, decision: 'row', actionId: 'split_AAPL_' + S[2] }, 'row')).status).toBe(422);
    expect((await release(ctx, doubtOf(ctx).id, 'doubt')).status).toBe(200);
    // S5's daily build still reaches 18 Nov and rejects the bad row again: evidence the ruling never saw.
    expect((await session(ctx, 5, [dividend(2, 1), split(2, '5:4')], 94)).dividendsUsd).toBe(0);
    expect(doubtOf(ctx)).toMatchObject({ dates: [{ date: S[2], seenOn: S[5] }] });
    expect((await release(ctx, doubtOf(ctx).id, 'doubt-2')).status).toBe(200);
    expect((await session(ctx, 6, [], 94)).dividendsUsd).toBe(99.97);
  });
});

describe('C05 — a refused share-basis record has a founder exit (A-5)', () => {
  it('replays: the same request answers its stored response; a second ruling of the record is refused (409)', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [], 94);
    await session(ctx, 2, [split(2, '1/1000000000')], 94);
    const body = { kind: 'conflict', recordId: 'reverse_split_AAPL_' + S[2], decision: 'none' };
    expect((await ask(ctx, body, 'exit')).status).toBe(200);
    expect((await ask(ctx, body, 'exit')).body.idempotentReplay).toBe(true);
    expect((await ask(ctx, body, 'exit-2')).status).toBe(409);
    await session(ctx, 3, [], 94);
    expect(idea(ctx).ledger.corporateActionReceipts.filter((r) => r.actionId === 'reverse_split_AAPL_' + S[2] && r.reason === 'founder_ruled_none')).toHaveLength(1);
    expect((await ask(ctx, body, 'exit-3')).status).toBe(409);
    expect((await session(ctx, 4, [], 94)).saleReceipts.some((r) => r.symbol === 'AAPL')).toBe(true);
  });

  it('`payload` is no answer to a refused record (422): only `none`', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [], 94);
    await session(ctx, 2, [split(2, '1/1000000000')], 94);
    expect((await ask(ctx, { kind: 'conflict', recordId: 'reverse_split_AAPL_' + S[2], decision: 'payload', payload: { ratio: 1e-9 } }, 'p')).status).toBe(422);
  });

  it('a same-stock comparison carries its own copy: the ruling names both ledgers; the idea sells, the comparison keeps its shares', async () => {
    const ctx = await openSameStock();
    await session(ctx, 0);
    await session(ctx, 1, [], 94);
    await session(ctx, 2, [split(2, '1/1000000000')], 94);
    expect(idea(ctx).comparisonLedger.holdings.AAPL.heldActions[0].refused).toBe('rounds_to_nothing');
    expect((await ask(ctx, { kind: 'conflict', recordId: 'reverse_split_AAPL_' + S[2], decision: 'none' }, 'exit')).status).toBe(200);
    expect(idea(ctx).founderRulings.at(-1).ledgers).toEqual(['ledger', 'comparisonLedger']);
    await session(ctx, 3, [], 94);
    const l = await session(ctx, 4, [], 94);
    expect(l.saleReceipts.some((r) => r.symbol === 'AAPL')).toBe(true);
    expect([idea(ctx).comparisonLedger.holdings.AAPL.shares, idea(ctx).comparisonLedger.holdings.AAPL.heldActions]).toEqual([99.970008, undefined]);
  });

  it('the Q-14 companion: a ruled forward split of the refused id\'s date waits on it, and applies once it is ruled `none`', async () => {
    const ctx = await openIdea();
    await session(ctx, 0);
    await session(ctx, 1, [], 94);
    await session(ctx, 2, [split(2, '1/1000000000')], 94);
    await session(ctx, 3, [split(2, '2/1'), split(2, '3/2')], 94);
    expect((await conflictRule(ctx, 'split_AAPL_' + S[2], 'payload', { ratio: 2 }, 'fwd')).status).toBe(200);
    await session(ctx, 4, [], 94);
    expect(idea(ctx).ledger.holdings.AAPL.shares).toBe(99.970008);
    expect((await ask(ctx, { kind: 'conflict', recordId: 'reverse_split_AAPL_' + S[2], decision: 'none' }, 'exit')).status).toBe(200);
    await session(ctx, 5, [], 47);
    expect(idea(ctx).ledger.holdings.AAPL.shares).toBe(199.940016);
    expect((await session(ctx, 6, [], 46)).saleReceipts.some((r) => r.symbol === 'AAPL')).toBe(true);
  });
});

// ── THE ORACLE: ASTRA'S TEST-ONLY GAP (her "A test-only gap" and "Oracle controls") ─────────────────────────────────────────
// Inputs: a $1 AAPL dividend dated S1, listed late at S3; 99.970008 entry shares bought S0, sold S2; the founder's accepted
// approval of the original proposal (generation 1, request a1). Constructed oracle objects only, to characterise coverage.
import { InputOracle, EntitlementOracle } from './__testsupport__/caOracle.js';

describe('the oracle — a posting matches one exact, unconsumed request, and its net is checked before any excuse', () => {
  const D1 = 'cash_dividend_AAPL_' + S[1];
  const row1 = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[1], amount: 1, source: 'eodhd_dividends' };
  const sold = { ledger: { sym: 'AAPL', entryShares: 99.970008, boughtAt: 0, soldAt: 2 } };
  const posting = (over = {}) => ({ kind: 'late_entitlement', type: 'cash_dividend', ticker: 'AAPL', actionId: D1, amountUsd: 99.97, amountPerShare: 1, proposal: 'late_idea_' + D1, ruling: { requestKey: 'a1' }, postedOn: S[4], ...over });
  // (Astra's fabricated product state: the comparison ledger reports a split conflict dated before the ex-date.)
  const doubted = { actionId: 'split_AAPL_' + S[1], type: 'split', ticker: 'AAPL', effectiveDate: S[1], applied: false, reason: 'conflicting_action', rows: [{ ratio: 2 }, { ratio: 3 }] };
  const ideaOf = (adjustments, comparisonReceipts = []) => ({
    ledger: { corporateActionReceipts: [], adjustments, dividendsUsd: adjustments.reduce((n, a) => n + a.amountUsd, 0), holdings: {} },
    comparisonLedger: { corporateActionReceipts: comparisonReceipts, adjustments: [], holdings: { AAPL: { shares: 99.970008 } } },
  });
  const oracle = () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    for (const k of [0, 1, 2]) inputs.close(k, []);
    inputs.close(3, [row1]);
    inputs.ruling({ kind: 'late_adjustment', recordId: 'late_idea_' + D1, decision: 'approve' }, { status: 200 }, 'a1', 4);
    inputs.close(4, []);
    return e;
  };

  it('Astra\'s fabricated posting — generation 2, another request key, $100.97 — is refused by I-7 even beside a fabricated comparison doubt', () => {
    const e = oracle();
    const fabricated = ideaOf([posting({ amountUsd: 100.97, proposal: 'late_idea_' + D1 + '_2', ruling: { requestKey: 'x9' } })], [doubted]);
    expect(() => e.checkAuthority(fabricated, 4, 'unit', sold)).toThrow(/matches no exact, unconsumed founder approval/);
  });

  it('the right proposal and request, but $100.97: the net at posting refuses it — the comparison\'s fabricated doubt excuses nothing', () => {
    const e = oracle();
    expect(() => e.checkAuthority(ideaOf([posting({ amountUsd: 100.97 })], [doubted]), 4, 'unit', sold)).toThrow(/I-7 \(net at posting\).*the inputs say \$99\.97 owed less \$0 received/);
    expect(() => e.checkAuthority(ideaOf([posting({ amountUsd: 100.97 })]), 4, 'unit', sold)).toThrow(/net at posting/);
  });

  it('one request authorizes one posting: the same approval named twice is refused the second time', () => {
    const e = oracle();
    expect(() => e.checkAuthority(ideaOf([posting(), posting({ amountUsd: 0.01 })]), 4, 'unit', sold)).toThrow(/matches no exact, unconsumed/);
  });

  it('control: the honest posting — proposal 1, request a1, $99.97 — passes I-7 and I-6; the normal two-idea book is untouched', () => {
    const e = oracle();
    const honest = ideaOf([posting()]);
    expect(() => e.checkAuthority(honest, 4, 'unit', sold)).not.toThrow();
    expect(() => e.check(honest, 4, sold, 'unit')).not.toThrow();
    expect(e.netChecks).toBe(1);
  });
});

describe('the oracle — A-1 and A-2 from the inputs alone', () => {
  const adv = (i, amount) => ({ type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[i], amount, source: 'eodhd_dividends' });
  // (Distinct marks: the oracle records a pairing from each side, and a revision once per check that sees it.)
  const marksOf = (o, i) => [...new Set((o.marks.get('cash_dividend_AAPL_' + S[i]) || []).map((m) => `${m.k}:${m.how}`))].map((s) => [Number(s.split(':')[0]), s.split(':')[1]]);

  it('a payload changed before its date marks nothing; one changed at the date is a revision', () => {
    const o = new InputOracle(S);
    o.close(0, [adv(3, 1)]);
    o.close(1, [adv(3, 2)]);
    o.close(2, [adv(3, 2)]);
    expect(marksOf(o, 3)).toEqual([]);
    o.close(3, [adv(3, 1)]);
    expect(marksOf(o, 3)).toEqual([[3, 'revision']]);
  });

  it('only a covered close updates an announcement', () => {
    const o = new InputOracle(S);
    o.close(1, [adv(3, 1)]);
    o.close(2, [adv(3, 2)], { parseUncoveredSyms: ['AAPL'] });
    o.close(3, [adv(3, 2)]);
    expect(marksOf(o, 3)).toEqual([[3, 'revision']]);
  });

  it('two dates announced together pair only from the first of them; a switch made before both is an update', () => {
    const o = new InputOracle(S);
    o.close(1, [adv(3, 1), adv(4, 1)]);
    o.close(2, [adv(3, 1), adv(4, 1)]);
    expect([marksOf(o, 3), marksOf(o, 4)]).toEqual([[], []]);
    o.close(3, [adv(3, 1), adv(4, 1)]);
    expect([marksOf(o, 3), marksOf(o, 4)]).toEqual([[[3, 'redate']], [[3, 'redate']]]);
    const p = new InputOracle(S);
    p.close(1, [adv(3, 1)]);
    p.close(2, [adv(4, 1)]);
    p.close(3, [adv(4, 1)]);
    p.close(4, [adv(4, 1)]);
    expect([marksOf(p, 3), marksOf(p, 4)]).toEqual([[], []]);
  });

  it('withdrawn before its date and listed again on it is a revision; an announcement entering its date two ways is a conflict', () => {
    const w = new InputOracle(S);
    w.close(1, [adv(3, 1)]);
    w.close(2, []);
    w.close(3, [adv(3, 1)]);
    expect(marksOf(w, 3)).toEqual([[3, 'revision']]);
    const c2 = new InputOracle(S);
    c2.close(1, [adv(3, 1), adv(3, 2)]);
    c2.close(2, [adv(3, 1), adv(3, 2)]);
    expect(marksOf(c2, 3)).toEqual([]);
    c2.close(3, [adv(3, 1)]);
    expect(marksOf(c2, 3)).toEqual([[3, 'conflict']]);
  });

  it('I-6: a dividend only ever announced — withdrawn before its date — is owed nothing; money received for it fails', () => {
    const o = new InputOracle(S);
    const e = new EntitlementOracle(S, o);
    o.close(1, [adv(3, 1)]);
    o.close(2, []);
    o.close(3, []);
    const paid = { ledger: { corporateActionReceipts: [{ actionId: 'cash_dividend_AAPL_' + S[3], type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[3], applied: true, appliedOn: S[3], amount: 1, incomeUsd: 99.97 }], adjustments: [] } };
    expect(() => e.check(paid, 3, { ledger: { sym: 'AAPL', entryShares: 99.970008, boughtAt: 0, soldAt: null } }, 'unit')).toThrow(/only announced/);
    expect(() => e.check({ ledger: { corporateActionReceipts: [], adjustments: [] } }, 3, { ledger: { sym: 'AAPL', entryShares: 99.970008, boughtAt: 0, soldAt: null } }, 'unit')).not.toThrow();
  });
});

// ── THE CLOSEOUT'S ROWS (the founder's ruling of 21 Nov 2026, C-1 and C-2; Astra's recheck T2E-R01 to R03) ──────────────
// Astra's three executable seeds, appended as she wrote them. R03 is verbatim, in both vendor orders. R01 and R02 are
// pinned to the ruled behaviour (C-1: a report that changes after its close is ALERTED, it reopens nothing and holds no
// money): the money is as she observed it, and the alert fires exactly once, naming the symbol, the session and the book.
import { planHoldRuling } from './holdRulings.js';
import { shiftCalendarDate } from './dailyCoverage.js';
import { sessionOfWindow } from './caParseReport.js';
import { MANDATE_CA_FETCH_LOOKBACK_DAYS, MANDATE_CA_FETCH_LOOKAHEAD_DAYS } from '../mandateConfig.js';

async function reviewClose(ctx, i, doc, price, backfillRows) {
  await snapshot(ctx, i, 'close', price, doc);
  const result = await closeIdeaBook(ctx.db, ctx.bookRef, {
    date: S[i], now: closeNowOf(S[i]), fetchCorporateActions: parse,
    caFetchImpl: vendor(backfillRows),
  });
  expect(result.closed).toBe(true);
}

async function reviewLateReport(ctx, i, clean, dirty, price) {
  const paused = gate();
  const loser = daily(ctx, i, dirty, '21:25', paused);
  await paused.ready;
  try {
    const winner = await daily(ctx, i, clean, '21:25');
    await reviewClose(ctx, i, winner, price, clean);
  } finally {
    paused.release();
    await loser;
  }
  const report = ctx.db._get('practiceFieldCaParseReports/' + S[i]);
  expect(report.symbols.AAPL).toMatchObject({ rowsRejected: 1, observationsDisagree: true });
}

async function reviewSale() {
  const ctx = await openIdea();
  await session(ctx, 0);
  await session(ctx, 1, [], 94);
  const sold = await session(ctx, 2, [], 94);
  expect(sold.saleReceipts[0]).toMatchObject({ sessionDate: S[2], shares: 99.970008 });
  await session(ctx, 3, [dividend(2, 1)], 94);
  return ctx;
}

// C-1's alert, as logged (console.error), and the rows' spy on it — passed through, so every other line still prints.
const REPORT_ALERT = 'PRACTICE_FIELD_REPORT_CHANGED_AFTER_CLOSE';
function alertSpy() {
  const spy = vi.spyOn(console, 'error');
  return { lines: () => spy.mock.calls.map((c) => String(c[0])).filter((l) => l.includes(REPORT_ALERT)), restore: () => spy.mockRestore() };
}
const alertOf = (ctx, i) => expect.stringContaining(`${REPORT_ALERT} AAPL ${S[i]} books=${ctx.bookId} `);

/** The loser's report committed BEFORE the close (the passing order of R01 and R02, as today). */
async function reviewEarlyReport(ctx, i, clean, dirty, price) {
  const paused = gate();
  const loser = daily(ctx, i, dirty, '21:25', paused);
  await paused.ready;
  const winner = await daily(ctx, i, clean, '21:25');
  paused.release();
  await loser;
  expect(ctx.db._get('practiceFieldCaParseReports/' + S[i]).symbols.AAPL).toMatchObject({ rowsRejected: 1, observationsDisagree: true });
  await reviewClose(ctx, i, winner, price, clean);
}

/** One more observation of session S[i] through the daily builder's own wrapper (a third build, a retry). */
async function lateObservation(ctx, i, rows) {
  const from = shiftCalendarDate(S[i], -MANDATE_CA_FETCH_LOOKBACK_DAYS), to = shiftCalendarDate(S[i], MANDATE_CA_FETCH_LOOKAHEAD_DAYS);
  expect(sessionOfWindow(from, to)).toBe(S[i]);
  const now = new Date(S[i] + 'T21:27:00Z');
  await makeParseReportingFetcher(ctx.db, { symbols, base: parse, fetchImpl: vendor(rows), now: () => now })('AAPL', { from, to });
}

it('R01 sold-report-after-close', async () => {
  const alerts = alertSpy();
  try {
    const ctx = await reviewSale();
    const clean = [dividend(2, 1)], dirty = [...clean, split(2, '3:2')];
    await session(ctx, 4, clean, 94);
    await reviewLateReport(ctx, 5, clean, dirty, 94);
    // C-1: the loser's rejection reached Monday's report after the book closed Monday — alerted, once.
    expect(alerts.lines()).toEqual([alertOf(ctx, 5)]);
    // The same rejection observed again adds nothing to the report, so nothing is alerted again.
    await lateObservation(ctx, 5, dirty);
    expect(alerts.lines()).toHaveLength(1);
    const answer = await approve(ctx, 2);
    const next = await session(ctx, 6, dirty, 94);
    // CHANGED EXPECTATION — C-1 (the founder's ruling, 21 Nov 2026): Astra's seed expected 0 and 409. The closed session is
    // not reopened and no money is held: the approval is accepted and Tuesday posts the $99.97 she observed.
    expect(next.dividendsUsd).toBe(99.97);
    expect(answer.status).toBe(200);
    expect(alerts.lines()).toHaveLength(1);
  } finally {
    alerts.restore();
  }
});

it('R02 refused-announcement-after-close', async () => {
  const alerts = alertSpy();
  try {
    const ctx = await openIdea();
    for (let i = 0; i <= 4; i++) await session(ctx, i);
    await session(ctx, 5, [dividend(7, 1)]);
    const revised = [dividend(7, 2.37)];
    await reviewLateReport(ctx, 6, revised, [...revised, split(7, '3:2')], 100);
    expect(alerts.lines()).toEqual([alertOf(ctx, 6)]);
    const due = await session(ctx, 7, revised);
    // CHANGED EXPECTATION — C-1: Astra's seed expected 0. The announcement S6's close made stands, and S7 pays the $236.93
    // she observed; the alert named the session whose report changed.
    expect(due.dividendsUsd).toBe(236.93);
    expect(alerts.lines()).toEqual([alertOf(ctx, 6)]);
  } finally {
    alerts.restore();
  }
});

it.each([['5/4','2/1'], ['2/1','5/4']])('R03 refetch-order %s then %s', async (a, b) => {
  const ctx = await reviewSale();
  expect((await approve(ctx, 2)).status).toBe(200);
  const bad = [dividend(2, 1), split(2, '5:4')];
  await session(ctx, 4, bad, 94);
  await session(ctx, 5, bad, 94);
  const doc = await daily(ctx, 6, []);
  await reviewClose(ctx, 6, doc, 94, [split(2, a), split(2, b), dividend(2, 1)]);
  const stored = ctx.db._get('practiceFieldCaBackfill/AAPL');
  expect(stored.failed).toBe(false);
  expect(stored.actions.filter(r => r.type === 'split')).toHaveLength(2);
  const body = {
    kind: 'coverage_gap', recordId: 'ca_closed_doubt_AAPL_' + S[2],
    decision: 'row', actionId: 'split_AAPL_' + S[2], payload: { ratio: 1.25 },
  };
  const answer = await ask(ctx, body, 'refetch-choice');
  const next = await session(ctx, 7, [], 94);
  if (answer.status === 200) {
    expect(idea(ctx).founderRulings.at(-1).row.ratio).toBe(1.25);
    expect(next.dividendsUsd).toBe(124.96);
  } else {
    expect([409, 422]).toContain(answer.status);
    expect(next.dividendsUsd).toBe(0);
  }
});

describe("C-1 — the passing order: the loser's report committed before the close (as today; nothing alerted)", () => {
  it("R01's control: the standing doubt refuses the approval (409) and Tuesday pays nothing", async () => {
    const alerts = alertSpy();
    try {
      const ctx = await reviewSale();
      const clean = [dividend(2, 1)], dirty = [...clean, split(2, '3:2')];
      await session(ctx, 4, clean, 94);
      await reviewEarlyReport(ctx, 5, clean, dirty, 94);
      const answer = await approve(ctx, 2);
      expect((await session(ctx, 6, dirty, 94)).dividendsUsd).toBe(0);
      expect(answer.status).toBe(409);
      expect(alerts.lines()).toEqual([]);
    } finally {
      alerts.restore();
    }
  });

  it("R02's control: S6 keeps the $1 announcement and S7 is a conflict that pays nothing", async () => {
    const alerts = alertSpy();
    try {
      const ctx = await openIdea();
      for (let i = 0; i <= 4; i++) await session(ctx, i);
      await session(ctx, 5, [dividend(7, 1)]);
      const revised = [dividend(7, 2.37)];
      await reviewEarlyReport(ctx, 6, revised, [...revised, split(7, '3:2')], 100);
      const due = await session(ctx, 7, revised);
      expect(due.dividendsUsd).toBe(0);
      expect(due.corporateActionReceipts.some((r) => r.reason === 'conflicting_action')).toBe(true);
      expect(alerts.lines()).toEqual([]);
    } finally {
      alerts.restore();
    }
  });
});

describe('C-2 — `coverage_gap` / `row` takes only the payload the founder names (Astra T2E-R03)', () => {
  /** R03's history up to the stored clean refetch: the sale, the approved dividend, the standing doubt, the refetch. */
  async function refetchOf(rows) {
    const ctx = await reviewSale();
    expect((await approve(ctx, 2)).status).toBe(200);
    const bad = [dividend(2, 1), split(2, '5:4')];
    await session(ctx, 4, bad, 94);
    await session(ctx, 5, bad, 94);
    const doc = await daily(ctx, 6, []);
    await reviewClose(ctx, 6, doc, 94, rows);
    expect(ctx.db._get('practiceFieldCaBackfill/AAPL').failed).toBe(false);
    return ctx;
  }
  const rowBody = (extra) => ({ kind: 'coverage_gap', recordId: 'ca_closed_doubt_AAPL_' + S[2], decision: 'row', actionId: 'split_AAPL_' + S[2], ...extra });

  it.each([['5/4', '2/1'], ['2/1', '5/4']])('naming ratio 1.25 takes the 5/4 row with %s listed first, and the dividend posts once', async (a, b) => {
    const ctx = await refetchOf([split(2, a), split(2, b), dividend(2, 1)]);
    expect((await ask(ctx, rowBody({ payload: { ratio: 1.25 } }), 'named')).status).toBe(200);
    expect(idea(ctx).founderRulings.at(-1).row).toMatchObject({ type: 'split', ratio: 1.25 });
    const paid = await session(ctx, 7, [], 94);
    expect(paid.dividendsUsd).toBe(124.96);
    const after = await session(ctx, 8, [], 94);
    expect(after.dividendsUsd).toBe(124.96);
    expect(after.cash).toBe(paid.cash);
  });

  it.each([['5/4', '2/1'], ['2/1', '5/4']])('naming nothing while the id carries two payloads (%s first) is refused with 422 and pays nothing', async (a, b) => {
    const ctx = await refetchOf([split(2, a), split(2, b), dividend(2, 1)]);
    expect(await ask(ctx, rowBody({}), 'unnamed')).toMatchObject({ status: 422, body: { error: 'row_payload_ambiguous' } });
    expect(idea(ctx).founderRulings.some((r) => r.recordId === 'ca_closed_doubt_AAPL_' + S[2])).toBe(false);
    expect((await session(ctx, 7, [], 94)).dividendsUsd).toBe(0);
  });

  it('naming a ratio the refetch does not hold is refused with 422 and pays nothing — also when the id is unique', async () => {
    const two = await refetchOf([split(2, '5/4'), split(2, '2/1'), dividend(2, 1)]);
    expect(await ask(two, rowBody({ payload: { ratio: 1.5 } }), 'absent')).toMatchObject({ status: 422, body: { error: 'payload_not_recorded' } });
    expect((await session(two, 7, [], 94)).dividendsUsd).toBe(0);
    const one = await refetchOf([split(2, '5/4'), dividend(2, 1)]);
    expect(await ask(one, rowBody({ payload: { ratio: 2 } }), 'absent-unique')).toMatchObject({ status: 422, body: { error: 'payload_not_recorded' } });
    expect((await session(one, 7, [], 94)).dividendsUsd).toBe(0);
  });

  it('a unique row still works without naming a payload: the 5/4 split is taken and the dividend posts once', async () => {
    const ctx = await refetchOf([split(2, '5/4'), dividend(2, 1)]);
    expect((await ask(ctx, rowBody({}), 'unique')).status).toBe(200);
    expect(idea(ctx).founderRulings.at(-1).row).toMatchObject({ type: 'split', ratio: 1.25 });
    expect((await session(ctx, 7, [], 94)).dividendsUsd).toBe(124.96);
    expect((await session(ctx, 8, [], 94)).dividendsUsd).toBe(124.96);
  });

  it("the open coverage gap's `row` takes the same care (pure): two payloads need a named one, taken in either order", () => {
    const gapIdea = { ideaId: 'i', founderRulings: [], ledger: null, comparisonLedger: null, spyLedger: null, caCoverageGaps: { AAPL: { since: S[0], lastSession: S[3], sessions: 3 } } };
    const splitRow = (ratio) => ({ type: 'split', ticker: 'AAPL', effectiveDate: S[2], ratio, source: 'eodhd_splits' });
    const ruleOn = (actions, payload) => planHoldRuling(gapIdea, { kind: 'coverage_gap', recordId: 'ca_coverage_gap_AAPL_' + S[0], decision: 'row', actionId: 'split_AAPL_' + S[2], payload },
      { uid: 'owner-1', requestKey: 'k', nowIso: S[4] + 'T13:00:00.000Z', backfill: { symbol: 'AAPL', actions } });
    for (const actions of [[splitRow(1.25), splitRow(2)], [splitRow(2), splitRow(1.25)]]) {
      expect(ruleOn(actions, null)).toEqual({ error: 'row_payload_ambiguous', status: 422 });
      expect(ruleOn(actions, { ratio: 1.25 }).ruling.row).toMatchObject({ ratio: 1.25 });
      expect(ruleOn(actions, { ratio: 2 }).ruling.row).toMatchObject({ ratio: 2 });
      expect(ruleOn(actions, { ratio: 1.5 })).toEqual({ error: 'payload_not_recorded', status: 422 });
    }
    // The same payload listed twice is one payload: taken without naming. A unique row is taken without naming, and a
    // named payload it does not carry is refused.
    expect(ruleOn([splitRow(1.25), splitRow(1.25)], null).ruling.row).toMatchObject({ ratio: 1.25 });
    expect(ruleOn([splitRow(2)], null).ruling.row).toMatchObject({ ratio: 2 });
    expect(ruleOn([splitRow(2)], { ratio: 1.25 })).toEqual({ error: 'payload_not_recorded', status: 422 });
  });
});

// ── The closeout refuter's RX-1 and RX-2, fixed (the founder's go-ahead, 21 Nov 2026) ─────────────────────────────────────
describe('the closeout refuter — RX-1 and RX-2 (each red at 7b7066cd)', () => {
  /** R03's history up to the S6 close: the sale, the approved dividend, the doubt; `beforeRefetch` runs before S6. */
  async function doubtWithRefetch(rows, beforeRefetch = null) {
    const ctx = await reviewSale();
    expect((await approve(ctx, 2)).status).toBe(200);
    const bad = [dividend(2, 1), split(2, '5:4')];
    await session(ctx, 4, bad, 94);
    await session(ctx, 5, bad, 94);
    if (beforeRefetch) beforeRefetch(ctx);
    const doc = await daily(ctx, 6, []);
    await reviewClose(ctx, 6, doc, 94, rows);
    return ctx;
  }
  const rowBody = (extra) => ({ kind: 'coverage_gap', recordId: 'ca_closed_doubt_AAPL_' + S[2], decision: 'row', actionId: 'split_AAPL_' + S[2], ...extra });

  it('RX-1: a `ratio` sent beside a coverage-gap ruling is refused (400), never ignored — the unique 2/1 row is not taken on it', async () => {
    const ctx = await doubtWithRefetch([split(2, '2/1'), dividend(2, 1)]);
    // The founder means 1.25 but sends it as `ratio`: refused, and no ruling is recorded (at 7b7066cd: 200, the 2/1 taken, $199.94).
    expect(await ask(ctx, rowBody({ ratio: 1.25 }), 'top-level')).toMatchObject({ status: 400, body: { error: 'ratio_not_accepted' } });
    // `no_action` with a ratio is refused too.
    expect(await ask(ctx, { ...rowBody({ ratio: 1.25 }), decision: 'no_action', actionId: undefined }, 'no-action-ratio')).toMatchObject({ status: 400, body: { error: 'ratio_not_accepted' } });
    expect((idea(ctx).founderRulings || []).some((r) => r.kind === 'coverage_gap')).toBe(false);
    // Only a payload the founder names in `payload` takes the row: here the 2/1 itself, and the dividend then posts on its count.
    expect((await ask(ctx, rowBody({ payload: { ratio: 2 } }), 'named')).status).toBe(200);
    expect(idea(ctx).founderRulings.at(-1).row).toMatchObject({ type: 'split', ratio: 2 });
    expect((await session(ctx, 7, [], 94)).dividendsUsd).toBe(199.94);
  });

  it('RX-2: a stored document the engine does not count as clean (no parse report) offers no row to a sold holding\'s doubt — 422, nothing pays', async () => {
    const legacy = (ctx) => ctx.db._store.set('practiceFieldCaBackfill/AAPL', {
      data: { schemaVersion: 1, symbol: 'AAPL', from: S[1], to: S[5], failed: false, calls: 2, fetchedAt: S[5] + 'T21:00:00.000Z', source: 'idea_book_backfill',
        actions: [{ type: 'split', ticker: 'AAPL', effectiveDate: S[2], ratio: 2, source: 'eodhd_splits' }, { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[2], amount: 1, source: 'eodhd_dividends' }] },
      version: 1,
    });
    // The S6 refetch lists the 2/1 beside a malformed 5:4 of the same date: not clean, so it never replaces the stored document.
    const ctx = await doubtWithRefetch([split(2, '2/1'), split(2, '5:4'), dividend(2, 1)], legacy);
    const stored = ctx.db._get('practiceFieldCaBackfill/AAPL');
    expect(stored).toMatchObject({ failed: false });
    expect(stored.parseReport).toBeUndefined();
    expect(await ask(ctx, rowBody({}), 'legacy')).toMatchObject({ status: 422, body: { error: 'row_not_recorded' } });
    expect(await ask(ctx, rowBody({ payload: { ratio: 2 } }), 'legacy-named')).toMatchObject({ status: 422, body: { error: 'row_not_recorded' } });
    expect((await session(ctx, 7, [], 94)).dividendsUsd).toBe(0);
  });
});
