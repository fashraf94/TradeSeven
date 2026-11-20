// api/_utils/practiceField/corporateActionLateAsks.test.js
//
// Practice Field T1a-2b-4, fix round (late data asks, 20 Nov 2026) — ASTRA'S EIGHT FINDINGS (T2E-01 to T2E-08) AS ROWS, and
// the founder's ruling L-1 to L-8 through the real close, sales, founder endpoint and daily builder.
//
//   L-1  no late adjustment posts on its own: a late_entitlement or late_basis is a PROPOSAL on the ledger, alerted; the row
//        and the endpoint read below full quality while it waits; resolve_hold `late_adjustment` approves or declines it.
//   L-2  approval posts the net owed now (ruled payloads, dated count) less everything received for the id — refused (409)
//        while the id is unresolved, pairs under the re-date rule, a share-basis id dated within the holding is unresolved,
//        or a date in the holding interval is uncovered.
//   L-3  closed holdings are screened like held ones (re-date pairing within the close and against rows observed just
//        outside the holding, kept for the window).
//   L-4  counts are recomputed along the dated chain (T2E-04).
//   L-5  two share-basis ids of one symbol and one date are one ambiguity (T2E-06, Q-9).
//   L-6  a correction after a sale leaves a standing reason (T2E-05, Q-5).
//   L-7  parse observations merge, and doubt sticks (T2E-07).
//   L-8  a resulted idea: late data is named and alerted only.
//
// The named histories are reconstructed from Astra's description (her generator extension is not in the attachment):
// __testsupport__/caSequences.js ASTRA_T2E, ASTRA_T2E04, ASTRA_T2E06, ASTRA_T2E08. Each failed at df9b7278.

import { describe, it, expect, vi } from 'vitest';
import { run, installSequenceHooks, S, ASTRA_T2E, ASTRA_T2E04, ASTRA_T2E06, ASTRA_T2E08 } from './__testsupport__/caSequences.js';
import { InputOracle, EntitlementOracle, proposalOf } from './__testsupport__/caOracle.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';
import { ensureDailySnapshot, fetchCorporateActionsEODHD } from '../mandateUniverseSnapshot.js';
import { makeParseReportingFetcher, mergeParseEntries } from './caParseReport.js';
import { parseEntryVerdict } from './dailyCoverage.js';
import { closeIdeaBook } from './close.js';
import {
  seedBook, admitAndEnter, contractOf, getIdea, getRow, storeCloseSnapshot, closeNowOf, closeOn, etIso, CLEAN_PARSE_ENTRY, windowAt, founderRules, storeParseReport,
} from './__testsupport__/fixtures.js';

installSequenceHooks();

const div = (day, amount) => parseDividendsPayload('AAPL', [{ date: S[day], unadjustedValue: amount }]).actions[0];
const spl = (day, ratio) => parseSplitsPayload('AAPL', [{ date: S[day], split: ratio }]).actions[0];
const cl = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
const xlk = { type: 'sector_fund', symbols: ['XLK'] };

describe('the oracle (Astra\'s "Oracle" section) — I-6 scoped, and I-7', () => {
  it('her $0.10/$0.20 variant of T2E-04: an unrelated dividend conflict excuses nothing — I-6 still checks $516.64 (red at df9b7278: $516.65 received)', async () => {
    const conflict = [div(2, 0.1), div(2, 0.2)];
    const out = await run({
      seed: 'oracle-T2E-04-with-unrelated-0.10-0.20', comparison: xlk,
      steps: [cl(0, 100), cl(1, 125), cl(2, 62.5, [spl(2, '2/1'), ...conflict]), cl(3, 62.5, [spl(1, '4/5'), spl(2, '2/1'), div(3, 3.23), ...conflict])],
    });
    expect(out.idea.ledger.dividendsUsd).toBe(516.64);
    expect(out.entitlement.checked, 'the $3.23 dividend was checked, not excused').toBeGreaterThan(0);
  });

  it('I-7 is derived from the inputs alone: an adjustment with no approval or ruling in the request log fails; its approval passes', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    const idea = { ledger: { adjustments: [{ kind: 'late_entitlement', actionId: `cash_dividend_AAPL_${S[1]}`, amountUsd: 99.97, amountPerShare: 1, postedOn: S[4] }] } };
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'no approval: I-7 fails').toThrow(/I-7 ledger cash_dividend_AAPL_2026-11-17/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_comparison_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 200 }, 'k1', 4);
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'another ledger\'s approval is not this one\'s').toThrow(/I-7/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_idea_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 409 }, 'k2', 4);
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'a refused approval authorizes nothing').toThrow(/I-7/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_idea_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 200 }, 'k3', 5);
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'an approval made after the posting close is too late').toThrow(/I-7/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_idea_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 200 }, 'k4', 4);
    expect(() => e.checkAuthority(idea, 4, 'unit')).not.toThrow();
    expect(proposalOf(`late_spy_cash_dividend_SPY_${S[2]}_2`)).toEqual({ field: 'spyLedger', actionId: `cash_dividend_SPY_${S[2]}`, n: 2 });
  });

  it('I-7: a ruled_correction needs an accepted conflict ruling choosing exactly its payload', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    const id = `cash_dividend_AAPL_${S[2]}`;
    const idea = { comparisonLedger: { adjustments: [{ kind: 'ruled_correction', actionId: id, amountUsd: 99.97, payload: { amount: 2 }, postedOn: S[5] }] } };
    inputs.ruling({ kind: 'conflict', recordId: id, decision: 'payload', payload: { amount: 3 } }, { status: 200 }, 'k1', 5);
    expect(() => e.checkAuthority(idea, 5, 'unit')).toThrow(/I-7 comparisonLedger/);
    inputs.ruling({ kind: 'conflict', recordId: id, decision: 'payload', payload: { amount: 2 } }, { status: 200 }, 'k2', 5);
    expect(() => e.checkAuthority(idea, 5, 'unit')).not.toThrow();
  });
});

describe('T2E-01, T2E-02, T2E-03 — late data on a dividend id moves no money without the founder (Astra\'s named seeds)', () => {
  for (const plan of ASTRA_T2E) it(plan.seed, async () => { await run(plan); });
});

describe('T2E-04 — counts recomputed along the dated chain: $516.64 on every affected ledger and the book, both listing orders', () => {
  for (const plan of ASTRA_T2E04) it(plan.seed, async () => { await run(plan); });
});

describe('T2E-06 (Q-9) — same-date opposite share-basis ids hold: no dividend, no sale (2011202612 to 2011202619)', () => {
  for (const plan of ASTRA_T2E06) it(plan.seed, async () => { await run(plan); });
});

describe('T2E-08 — a rejected in-holding row is not forgotten once the line is sold: $0 and below full quality on both arms', () => {
  for (const plan of ASTRA_T2E08) it(plan.seed, async () => { await run(plan); });
});

describe('T2E-07 (L-7) — parse observations merge, and doubt sticks', () => {
  const Q = (p) => ({ AAPL: { price: p, marketCap: 3e12 }, MSFT: { price: 200, marketCap: 3e12 }, SPY: { price: 500 }, XLK: { price: 200 } });
  /** Two ordinary calls build S[1]'s daily layer; the first (the LOSER) is delayed at the vendor's AAPL split answer and
   *  sees an empty split list; the second (the WINNER) sees `5:4` — rejected — and wins the daily create. Both see the $1. */
  async function race({ raced }) {
    const ctx = await seedBook();
    const a = await admitAndEnter(ctx.db, ctx.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 20000 }), quotes: Q(100), date: S[0] });
    const c = { ...ctx, ideaId: a.ideaId };
    await closeOn(c.db, c.bookId, S[0], Q(100));
    const dividend = [{ date: S[1], unadjustedValue: 1 }];
    const httpOf = (splits, gate = null) => async (url) => {
      const leg = url.includes('/splits/') ? 'splits' : 'dividends';
      const sym = url.split('/').pop().split('.US')[0];
      if (sym === 'AAPL' && leg === 'splits' && gate) await gate;
      const body = sym === 'AAPL' ? (leg === 'splits' ? splits : dividend) : [];
      return { ok: true, status: 200, json: async () => body };
    };
    const build = (http) => ensureDailySnapshot(c.db, {
      date: S[1], heldTickers: [], coverageTickers: ['AAPL', 'MSFT', 'SPY'], candidateUniverse: [], now: new Date(etIso(S[1], 8, 30)),
      getFundamentals: async () => ({ fundamentals: { sector: 'Technology', marketCap: 3e12 } }),
      fetchCorporateActions: makeParseReportingFetcher(c.db, { symbols: ['AAPL', 'MSFT', 'SPY'], base: (sym, o) => fetchCorporateActionsEODHD(sym, { ...o, apiKey: 'fixture-key' }), fetchImpl: http }),
    });
    const quiet = [vi.spyOn(console, 'log').mockImplementation(() => {})];
    try {
      let release;
      const gate = new Promise((r) => { release = r; });
      const loser = raced ? build(httpOf([], gate)) : null;
      await build(httpOf([{ date: S[1], split: '5:4' }]));
      const winnerReport = structuredClone(c.db._get(`practiceFieldCaParseReports/${S[1]}`).symbols.AAPL);
      if (raced) { release(); await loser; }
      await storeCloseSnapshot(c.db, S[1], Q(100));
      await closeIdeaBook(c.db, c.bookRef, { date: S[1], now: closeNowOf(S[1]) });
      return { c, winnerReport, report: c.db._get(`practiceFieldCaParseReports/${S[1]}`).symbols.AAPL, idea: getIdea(c.db, c.bookId, c.ideaId), row: getRow(c.db, c.bookId, c.ideaId, S[1]) };
    } finally { for (const s of quiet) s.mockRestore(); }
  }

  it('dirty-winner-clean-loser: releasing the losing response after the winning create preserves the hold — the report keeps the rejection and reads uncovered; the $1 is held at $0, the row below full quality (red at df9b7278: $99.97 at full quality)', async () => {
    const { winnerReport, report, idea, row } = await race({ raced: true });
    expect(winnerReport).toMatchObject({ rowsRejected: 1, rejects: [expect.objectContaining({ leg: 'splits' })] });
    expect(report).toMatchObject({ observationsDisagree: true, observations: 2, rowsRejected: 1, rejects: [expect.objectContaining({ leg: 'splits', reason: 'malformed_split' })] });
    expect(report.actionsHashes, 'the accepted rows of both observations hash the same').toHaveLength(1);
    expect(parseEntryVerdict(report)).toEqual({ clean: false, reason: 'parse_observations_disagree' });
    expect(idea.ledger.dividendsUsd).toBe(0);
    expect(row.fullQuality).toBe(false);
    expect(idea.caCoverageGaps?.AAPL).toMatchObject({ reason: 'ca_parse_incomplete' });
  });

  it('the control: the winning fetch alone holds the $1 at $0, below full quality (as at df9b7278)', async () => {
    const { report, idea, row } = await race({ raced: false });
    expect(report).toMatchObject({ rowsRejected: 1 });
    expect(report.observationsDisagree).toBeUndefined();
    expect([idea.ledger.dividendsUsd, row.fullQuality]).toEqual([0, false]);
  });

  it('the merge itself: the same observation twice stays one (clean stays clean — on-time data unchanged); two that disagree read uncovered even with one accepted-rows hash; a rejection once recorded stays', () => {
    const clean = { ...structuredClone(CLEAN_PARSE_ENTRY), actionsHash: 'h1', at: '2026-11-17T13:00:00.000Z' };
    const again = { ...clean, at: '2026-11-17T13:05:00.000Z' };
    expect(mergeParseEntries(undefined, clean)).toBe(clean);
    expect(mergeParseEntries(clean, again)).toBe(clean);
    expect(parseEntryVerdict(mergeParseEntries(clean, again))).toEqual({ clean: true, reason: null });
    const dirty = { ...clean, rowsReceived: 1, rowsRejected: 1, rejects: [{ leg: 'splits', reason: 'malformed_split', row: { date: S[1], split: '5:4' } }], legs: { ...clean.legs, splits: { ...clean.legs.splits, received: 1, rejected: 1 } } };
    const m1 = mergeParseEntries(dirty, again);
    expect(m1).toMatchObject({ observationsDisagree: true, rowsRejected: 1, rejects: dirty.rejects, actionsHashes: ['h1'] });
    const m2 = mergeParseEntries(clean, dirty);
    expect(m2).toMatchObject({ observationsDisagree: true, rowsRejected: 1, rejects: dirty.rejects });
    // …and a third, clean observation after the disagreement keeps it, and the rejection.
    const m3 = mergeParseEntries(m2, again);
    expect(m3).toMatchObject({ observationsDisagree: true, observations: 3, rowsRejected: 1 });
    expect(parseEntryVerdict(m3).clean).toBe(false);
    // A malformed envelope in either sticks too.
    expect(mergeParseEntries({ ...clean, malformedEnvelope: true }, again).malformedEnvelope).toBe(true);
  });
});

// ── THE FOUNDER'S ENDPOINT (L-1, L-2): approve, decline, replay, each refusal, and the net ───────────────────────────────
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
async function soldAt2(c) {
  await closeAt(c, 0);
  const p = Math.round((lineOf(c) - 0.5) * 100) / 100;
  await closeAt(c, 1, p);
  await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(p) });
  expect(ideaOf(c).ledger.holdings.AAPL).toBeUndefined();
  await closeAt(c, 2, p);
  return p;
}
const ask = (c, body, requestKey) => founderRules(c.db, c.bookId, c.ideaId, body, { requestKey, expectOk: false });
const lateBody = (ledger, actionId, decision = 'approve') => ({ kind: 'late_adjustment', recordId: `late_${ledger}_${actionId}`, decision });
const D1 = `cash_dividend_AAPL_${S[1]}`;
const D2 = `cash_dividend_AAPL_${S[2]}`;
const posted = (c, f = 'ledger') => (ideaOf(c)[f]?.adjustments || []).filter((a) => !a.held).map((a) => [a.kind, a.actionId, a.amountUsd]);
const rejectedOn = (date) => ({ ...CLEAN_PARSE_ENTRY, rowsReceived: 1, rowsRejected: 1, rejects: [{ leg: 'splits', reason: 'malformed_split', row: { date, split: '5:4' } }], legs: { ...CLEAN_PARSE_ENTRY.legs, splits: { ...CLEAN_PARSE_ENTRY.legs.splits, received: 1, rejected: 1 } } });

describe('L-1, L-2 through the real founder endpoint — approve, decline, replay, each refusal, the net', () => {
  it('approve: 200, the next observed close posts the NET once (the ruling applied, `posted`); a replay answers the stored response and posts nothing more; a second approval is refused', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt2(c);
    await closeAt(c, 3, p, [div(1, 1)]);
    const first = await ask(c, lateBody('idea', D1), 'k1');
    expect(first).toMatchObject({ status: 200, body: { ok: true, kind: 'late_adjustment', decision: 'approve', appliesAt: 'next_observed_close', idempotentReplay: false } });
    expect(posted(c)).toEqual([]); // nothing moves at the request
    expect((await ask(c, lateBody('idea', D1), 'k2')).status, 'a pending ruling holds the record').toBe(409);
    await closeAt(c, 4, p, [div(1, 1)]);
    expect(posted(c)).toEqual([['late_entitlement', D1, 99.97]]);
    expect(ideaOf(c).founderRulings.find((r) => r.requestKey === 'k1')).toMatchObject({ appliedOn: S[4], outcome: 'posted', netAtRuling: 99.97 });
    const replay = await ask(c, lateBody('idea', D1), 'k1');
    expect(replay).toMatchObject({ status: 200, body: { idempotentReplay: true } });
    await closeAt(c, 5, p, [div(1, 1)]);
    expect(posted(c)).toEqual([['late_entitlement', D1, 99.97]]);
    expect(await ask(c, lateBody('idea', D1), 'k3')).toMatchObject({ status: 409, body: { error: 'record_already_resolved' } });
  });

  it('decline: 200, the next close closes the proposal `declined` and posts nothing; the row returns to full quality; an approval after it is refused', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt2(c);
    await closeAt(c, 3, p, [div(1, 1)]);
    expect(rowAt(c, 3).fullQuality).toBe(false);
    expect((await ask(c, lateBody('idea', D1, 'decline'), 'd1')).status).toBe(200);
    await closeAt(c, 4, p, [div(1, 1)]);
    expect(posted(c)).toEqual([]);
    expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ status: 'declined', closedBecause: 'founder_declined' })]);
    expect(ideaOf(c).founderRulings.find((r) => r.requestKey === 'd1')).toMatchObject({ appliedOn: S[4], outcome: 'declined' });
    expect(rowAt(c, 4).fullQuality).toBe(true);
    expect(await ask(c, lateBody('idea', D1), 'a1')).toMatchObject({ status: 409, body: { error: 'record_already_resolved' } });
    expect(await ask(c, lateBody('idea', `cash_dividend_AAPL_${S[3]}`), 'a2')).toMatchObject({ status: 404, body: { error: 'record_not_found' } });
  });

  it('409 (1) the id is unresolved (T2E-03: a revision of the dividend stands) — `late_id_unresolved`', async () => {
    const c = await opened({ comparison: xlk });
    for (const [i, p, rows] of [[0, 100, []], [1, 100, []], [2, 100, [div(2, 1)]], [3, 100, [div(2, 2)]], [4, 80, [spl(1, '5/4'), div(2, 2)]]]) await closeAt(c, i, p, rows);
    expect(await ask(c, lateBody('idea', D2), 'x')).toMatchObject({ status: 409, body: { error: 'late_id_unresolved' } });
  });

  it('409 (2) another candidate pairs with it under the re-date rule (a paid dividend\'s late_basis, and the same $1 a session later) — `late_pairs_with_candidate`', async () => {
    const c = await opened({ comparison: xlk });
    await closeAt(c, 0);
    await closeAt(c, 1, 80);
    await closeAt(c, 2, 80, [div(2, 1)]); // paid on time
    await closeAt(c, 3, 80, [div(2, 1), spl(1, '5/4')]); // the split listed late: a late_basis proposal
    expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ actionId: D2, kind: 'late_basis', status: 'open' })]);
    await closeAt(c, 4, 80, [div(3, 1)]); // the same $1 a session later: a possible re-date of the paid one
    expect(ideaOf(c).ledger.lateProposals[0].blockers).toEqual([`pairs_with:cash_dividend_AAPL_${S[3]}`]);
    expect(await ask(c, lateBody('idea', D2), 'x')).toMatchObject({ status: 409, body: { error: 'late_pairs_with_candidate' } });
  });

  it('409 (3) a share-basis id dated within the holding is unresolved (a split conflict listed after the proposal) — `late_share_basis_unresolved`', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt2(c);
    await closeAt(c, 3, p, [div(1, 1)]);
    await closeAt(c, 4, p, [spl(1, '5/4'), spl(1, '3/2')]);
    expect(ideaOf(c).ledger.lateProposals[0].blockers).toContain('share_basis_unresolved:AAPL');
    expect(await ask(c, lateBody('idea', D1), 'x')).toMatchObject({ status: 409, body: { error: 'late_share_basis_unresolved' } });
  });

  it('409 (4) a date in the holding interval is uncovered (T2E-08: a rejected row dated within the sold holding) — `late_date_uncovered`; a clean backfill covering it clears the doubt, and the approval posts', async () => {
    const c = await opened({ comparison: xlk });
    const p = await soldAt2(c);
    await closeAt(c, 3, p);
    await storeCloseSnapshot(c.db, S[4], q(p));
    storeParseReport(c.db, S[4], 'AAPL', rejectedOn(S[1]));
    await closeIdeaBook(c.db, c.bookRef, { date: S[4], now: closeNowOf(S[4]) });
    expect(ideaOf(c).ledger.closedCoverageDoubts).toEqual({ AAPL: { dates: [{ date: S[1], seenOn: S[4] }], through: S[2] } });
    await closeAt(c, 5, p, [div(2, 1)]);
    expect(ideaOf(c).ledger.lateProposals).toEqual([expect.objectContaining({ actionId: D2, status: 'open', blockers: [`date_uncovered:${S[1]}`] })]);
    expect(rowAt(c, 5).fullQuality).toBe(false);
    expect(await ask(c, lateBody('idea', D2), 'x')).toMatchObject({ status: 409, body: { error: 'late_date_uncovered' } });
    c.db._store.set('practiceFieldCaBackfill/AAPL', { data: { schemaVersion: 1, symbol: 'AAPL', from: S[0], to: S[5], failed: false, actions: [div(2, 1)], calls: 2, parseReport: CLEAN_PARSE_ENTRY }, version: 1 });
    await closeAt(c, 6, p, [div(2, 1)]);
    expect(ideaOf(c).ledger.closedCoverageDoubts).toBeUndefined();
    expect((await ask(c, lateBody('idea', D2), 'y')).status).toBe(200);
    await closeAt(c, 7, p);
    expect(posted(c)).toEqual([['late_entitlement', D2, 99.97]]);
  });

  it('a resulted idea: the founder\'s action answers 404 (open ideas only — Q-2 as ruled); the late row is named', async () => {
    const c = await opened({ names: ['AAPL'], comparison: xlk });
    const p = await soldAt2(c);
    expect(ideaOf(c).status).toBe('resulted');
    await closeAt(c, 3, p, [div(1, 1)]);
    expect(await ask(c, lateBody('idea', D1), 'x')).toMatchObject({ status: 404 });
    expect(ideaOf(c).lateDataUnsettled.actions).toContainEqual(expect.objectContaining({ actionId: D1, kind: 'late_proposal' }));
  });
});

// ── T2E-05 (L-6; Q-5 as ruled): a correction after a sale leaves a standing reason, through liquidation ─────────────────────
async function throughLiquidation(c, from, p, rows = []) {
  const due = ideaOf(c).contract.schedule.dueSession;
  const quality = {};
  for (let i = from; S[i] <= due; i += 1) { await closeAt(c, i, p, rows); quality[S[i]] = rowAt(c, i).fullQuality; }
  const after = S.indexOf(due) + 1;
  await windowAt(c.db, c.bookId, { date: S[after], slot: 'open30', quotes: q(p, rows) });
  await closeAt(c, after, p, rows);
  return { quality, due };
}
describe('T2E-05 (L-6) — `q5-correct-sold-5/4-to-3/2` and its first-listing variant, through liquidation', () => {
  it('q5-correct-sold-5/4-to-3/2: the sale stands; from the correction on every row, the endpoint and the result read below full quality, the reason beside the result (red at df9b7278)', async () => {
    const c = await opened();
    await closeAt(c, 0);
    await closeAt(c, 1, 66.67, [spl(1, '5/4'), div(1, 1)]); // the 5:4 and $1 at $66.67 — below the line
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(66.67) });
    expect(ideaOf(c).ledger.saleReceipts.map((r) => [r.symbol, r.shares])).toEqual([['AAPL', 124.96251]]);
    await closeAt(c, 2, 66.67);
    await closeAt(c, 3, 66.67, [spl(1, '3/2'), div(1, 1)]); // the vendor revises the split to 3:2
    expect((await ask(c, { kind: 'conflict', recordId: `split_AAPL_${S[1]}`, decision: 'payload', payload: { ratio: 1.5 } }, 'q5')).status).toBe(200);
    await closeAt(c, 4, 66.67);
    const idea = ideaOf(c);
    expect(idea.comparisonLedger.holdings.AAPL.shares).toBe(149.955012);
    expect(idea.standingQualityReasons).toEqual([expect.objectContaining({ kind: 'sale_count_differs_from_owed', symbol: 'AAPL', actionId: `split_AAPL_${S[1]}`, since: S[4], via: 'correction_after_sale' })]);
    expect(rowAt(c, 4)).toMatchObject({ fullQuality: false, standingQualityReasons: [expect.objectContaining({ kind: 'sale_count_differs_from_owed' })] });
    // The dividend's recompute is a proposal on each ledger: approved, it posts — the standing reason still holds the rows.
    for (const l of ['idea', 'comparison']) expect((await ask(c, lateBody(l, D1), `q5-${l}`)).status).toBe(200);
    const { quality, due } = await throughLiquidation(c, 5, 66.67);
    expect(posted(c).map(([k, id]) => [k, id])).toContainEqual(['late_basis', D1]);
    expect(Object.keys(quality).length, 'rows closed through the due session').toBeGreaterThanOrEqual(5);
    expect(Object.values(quality).every((fq) => fq === false), JSON.stringify(quality)).toBe(true);
    const done = ideaOf(c);
    expect(done.status).toBe('resulted');
    expect(done.result.endpointSession).toBe(due);
    expect(done.result.economicResult).toBe('unmeasurable');
    expect(done.result.economic.unmeasurableBecause).toContain('sale_count_differs_from_owed');
    expect(done.result.economic.standingQualityReasons).toEqual([expect.objectContaining({ kind: 'sale_count_differs_from_owed', symbol: 'AAPL', sold: [expect.objectContaining({ shares: 124.96251, sharesIfCorrected: 149.955012 })] })]);
    expect(getRow(c.db, c.bookId, c.ideaId, 'endpoint').standingQualityReasons).toEqual([expect.objectContaining({ kind: 'sale_count_differs_from_owed' })]);
  });

  it('the first-listing variant: sold 99.970008 before the 5:4 was first listed — the split listed after the sale leaves the shares sold different from those owed: the same standing reason, through liquidation', async () => {
    const c = await opened();
    await closeAt(c, 0);
    await closeAt(c, 1, 80); // the 5:4 happened (×0.8, not a split's shape), no row: below the line
    await windowAt(c.db, c.bookId, { date: S[2], slot: 'open30', quotes: q(80) });
    expect(ideaOf(c).ledger.saleReceipts.map((r) => [r.symbol, r.shares])).toEqual([['AAPL', 99.970008]]);
    await closeAt(c, 2, 80);
    await closeAt(c, 3, 80, [spl(1, '5/4')]); // first listed after the sale
    const idea = ideaOf(c);
    expect(idea.ledger.corporateActionReceipts).toContainEqual(expect.objectContaining({ actionId: `split_AAPL_${S[1]}`, historyOnly: true }));
    expect(idea.standingQualityReasons).toEqual([expect.objectContaining({ kind: 'sale_count_differs_from_owed', via: 'split_listed_after_sale', sharesSold: 99.970008, sharesOwed: 124.96251, since: S[3] })]);
    expect(rowAt(c, 3).fullQuality).toBe(false);
    const { quality } = await throughLiquidation(c, 4, 80);
    expect(Object.keys(quality).length, 'rows closed through the due session').toBeGreaterThanOrEqual(5);
    expect(Object.values(quality).every((fq) => fq === false), JSON.stringify(quality)).toBe(true);
    expect(ideaOf(c).result.economic.unmeasurableBecause).toContain('sale_count_differs_from_owed');
  });
});

describe('the planner\'s doubt in the count is dated as the held path dates it (fix round; the shape soak\'s 2120900020, 2120900137)', () => {
  it('a split ambiguity dated AFTER a dividend does not defer the founder\'s correction of that dividend; one dated ON its ex-date does', async () => {
    for (const [splitDay, deferred] of [[2, false], [1, true]]) {
      const c = await opened();
      await closeAt(c, 0);
      await closeAt(c, 1, 100, [div(1, 1)]);
      await closeAt(c, 2, 100, [div(1, 2), spl(splitDay, '5/4'), spl(splitDay, '3/2')]);
      expect((await ask(c, { kind: 'conflict', recordId: D1, decision: 'payload', payload: { amount: 2 } }, 'r2')).status).toBe(200);
      await closeAt(c, 3, 100);
      const pending = (ideaOf(c).founderRulings || []).filter((r) => r.appliedOn == null).map((r) => r.requestKey);
      expect([pending, ideaOf(c).ledger.dividendsUsd], `split dated S${splitDay}`).toEqual(deferred ? [['r2'], 99.97] : [[], 199.94]);
    }
  });
});
