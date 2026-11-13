// api/_utils/practiceField/admission.test.js
//
// Practice Field T1a-1 — ADMISSION (build prompt §4; shared contract V2 §5.4, §14 cases B-SAME, B-RESERVE, B-COVER;
// Amendment C §7 case B-ORIGIN; Astra V6 C6-02: every failure together, with the permitted maximum and every
// binding constraint).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { admitIdea, releaseIdea, ideaIdFor } from './admission.js';
import { normalizeIdeaContract, planLegCents } from './contract.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';
import { CANDIDATE_UNIVERSE } from '../mandateCandidateUniverse.js';
import { MANDATE_UNIVERSE_MAX_SYMBOLS } from '../mandateConfig.js';
import { assertReconciled } from './reconcile.js';
import {
  seedBook, admitAndEnter, closeOn, contractOf, getBook, getIdea, etIso, DAYS, ADMIT_ISO, makeMandateFakeDb,
} from './__testsupport__/fixtures.js';

const untouchable = new Proxy({}, { get() { throw new Error('the database was touched'); } });
const codes = (res) => res.refusals.map((r) => r.code).sort();
const admit = (db, bookId, contract, opId = 'idea-1', nowIso = ADMIT_ISO) => admitIdea(db, { bookId, contract, opId, nowIso });
const openIdeas = (db, bookId) => getBook(db, bookId).openIdeaIds.map((id) => getIdea(db, bookId, id));

let restoreMode;
let savedEnv;
beforeEach(() => { savedEnv = process.env[COCKPIT_ALLOWLIST_ENV]; restoreMode = setPracticeFieldModeForTests('on'); });
afterEach(() => {
  restoreMode();
  if (savedEnv === undefined) delete process.env[COCKPIT_ALLOWLIST_ENV]; else process.env[COCKPIT_ALLOWLIST_ENV] = savedEnv;
});

describe('the contract\'s shape (checks 0, 0b, 3–5)', () => {
  it('a valid draft normalises: names upper-cased, equal weights, the comparison\'s own names, the horizon from the slot', () => {
    const { contract, refusals } = normalizeIdeaContract(contractOf({ names: [' aapl ', 'msft'], lines: [{ symbol: 'AAPL', distancePct: 0.05 }, { symbol: 'msft', distancePct: 0.03 }] }));
    expect(refusals).toEqual([]);
    expect(contract).toMatchObject({
      slot: 'short', horizonEnum: 'swing', sessions: 10, names: ['AAPL', 'MSFT'], weights: { mode: 'equal' },
      comparison: { type: 'same_stock_held', symbols: ['AAPL', 'MSFT'], costPolicy: 'same_policy_as_idea' },
      lines: [{ symbol: 'AAPL', distancePct: 0.05 }, { symbol: 'MSFT', distancePct: 0.03 }],
      capitalUsd: 20000, origin: { kind: 'founder_fixture', initiatedBy: 'agent' }, sources: [],
    });
    expect(contract.comparison.question).toMatch(/holding the same shares/);
  });

  it('check 0 — the thesis: missing, an unknown author, and 401 code points (400 passes; an astral character counts once)', () => {
    expect(normalizeIdeaContract(contractOf({ thesis: { text: '  ', author: 'founder_fixture' } })).refusals).toEqual([{ code: 'thesis_missing' }]);
    expect(normalizeIdeaContract(contractOf({ thesis: { text: 'x', author: 'player' } })).refusals).toEqual([{ code: 'thesis_author_invalid' }]);
    expect(normalizeIdeaContract(contractOf({ thesis: { text: '𝒳'.repeat(400), author: 'agent' } })).refusals).toEqual([]);
    expect(normalizeIdeaContract(contractOf({ thesis: { text: '𝒳'.repeat(401), author: 'agent' } })).refusals).toEqual([{ code: 'thesis_too_long', codePoints: 401, max: 400 }]);
  });

  it('B-ORIGIN — an idea without a valid origin, or whose origin matches none of its sources, is refused; founder_fixture alone may have no source', () => {
    const origin = (o, sources) => normalizeIdeaContract(contractOf({ origin: o, sources })).refusals;
    expect(origin(undefined, [])).toEqual([{ code: 'origin_invalid', reason: 'missing_or_unknown' }]);
    expect(origin({ kind: 'telepathy', initiatedBy: 'agent' }, [])).toEqual([{ code: 'origin_invalid', reason: 'missing_or_unknown' }]);
    expect(origin({ kind: 'signaldrop', initiatedBy: 'founder' }, [{ kind: 'signaldrop', ref: 'sd-1' }])).toEqual([{ code: 'origin_invalid', reason: 'missing_or_unknown' }]);
    expect(origin({ kind: 'signaldrop', initiatedBy: 'player' }, [])).toEqual([{ code: 'origin_invalid', reason: 'matches_no_source' }]);
    expect(origin({ kind: 'signaldrop', initiatedBy: 'player' }, [{ kind: 'research', ref: 'r-1' }])).toEqual([{ code: 'origin_invalid', reason: 'matches_no_source' }]);
    expect(origin({ kind: 'founder_fixture', initiatedBy: 'agent' }, [{ kind: 'research', ref: 'r-1' }])).toEqual([{ code: 'origin_invalid', reason: 'matches_no_source' }]);
    expect(origin({ kind: 'signaldrop', initiatedBy: 'player' }, [{ kind: 'research', ref: 'r-1' }, { kind: 'signaldrop', ref: 'sd-1' }])).toEqual([]);
    expect(origin({ kind: 'film_room_card', initiatedBy: 'player' }, [{ kind: 'film_room_card', ref: 'entry-9' }])).toEqual([]);
    expect(origin({ kind: 'founder_fixture', initiatedBy: 'agent' }, [])).toEqual([]);
    expect(origin({ kind: 'research', initiatedBy: 'agent' }, [{ kind: 'research' }]).map((r) => r.code)).toEqual(['sources_invalid', 'origin_invalid']);
  });

  it('check 3 — names: 1 to 4 universe stocks; a fund, a retired stock, an unknown symbol and a duplicate are each named', () => {
    const names = (n) => normalizeIdeaContract(contractOf({ names: n, lines: [] })).refusals;
    expect(names([]).map((r) => r.code)).toContain('names_count_invalid');
    expect(names(['AAPL', 'MSFT', 'NVDA', 'AMD', 'ORCL'])[0]).toEqual({ code: 'names_count_invalid', count: 5, min: 1, max: 4 });
    expect(names(['XLK'])).toContainEqual({ code: 'etf_not_a_name', symbol: 'XLK' });
    expect(names(['SPY'])).toContainEqual({ code: 'etf_not_a_name', symbol: 'SPY' });
    expect(names(['WBA'])).toContainEqual({ code: 'name_not_in_universe', symbol: 'WBA' }); // retired (BR-3)
    expect(names(['ZZZZ'])).toContainEqual({ code: 'name_not_in_universe', symbol: 'ZZZZ' });
    expect(names(['AAPL', 'aapl'])).toContainEqual({ code: 'name_duplicate', symbol: 'AAPL' });
  });

  it('weights: explicit weights must cover every name and sum to exactly 1', () => {
    const w = (weights) => normalizeIdeaContract(contractOf({ names: ['AAPL', 'MSFT'], weights, lines: [{ symbol: 'AAPL', distancePct: 0.05 }, { symbol: 'MSFT', distancePct: 0.05 }] }));
    expect(w({ AAPL: 0.3, MSFT: 0.7 }).contract.weights).toEqual({ mode: 'explicit', ppm: { AAPL: 300000, MSFT: 700000 } });
    expect(w({ AAPL: 0.3, MSFT: 0.6 }).refusals).toEqual([{ code: 'weights_invalid' }]);
    expect(w({ AAPL: 1 }).refusals).toEqual([{ code: 'weights_invalid' }]);
    expect(w({ AAPL: 0.5, MSFT: 0.5, NVDA: 0 }).refusals).toEqual([{ code: 'weights_invalid' }]);
    expect(w({ AAPL: 1.2, MSFT: -0.2 }).refusals).toEqual([{ code: 'weights_invalid' }]);
  });

  it('check 4 — the comparison: type supported; same_stock_held is the idea\'s own names; a sector fund must represent the names\' sector; a frozen basket lists 2–8 universe stocks', () => {
    const cmp = (comparison, names = ['AAPL', 'MSFT']) => normalizeIdeaContract(contractOf({ names, comparison, lines: names.map((symbol) => ({ symbol, distancePct: 0.05 })) }));
    expect(cmp({ type: 'industry_fund', symbols: ['SMH'] }).refusals).toEqual([{ code: 'comparison_type_unsupported', type: 'industry_fund' }]);
    expect(cmp({ type: 'same_stock_held', symbols: ['AAPL', 'NVDA'] }).refusals).toEqual([{ code: 'comparison_symbols_invalid', reason: 'must_be_the_ideas_own_names' }]);
    expect(cmp({ type: 'sector_fund', symbols: ['XLK'] }).contract.comparison).toMatchObject({ type: 'sector_fund', symbols: ['XLK'] });
    expect(cmp({ type: 'sector_fund', symbols: ['XLV'] }).refusals).toEqual([{ code: 'comparison_sector_mismatch', fund: 'XLV', represents: 'Health Care', names: ['AAPL', 'MSFT'] }]);
    expect(cmp({ type: 'sector_fund', symbols: ['XLK'] }, ['AAPL', 'LLY']).refusals).toEqual([{ code: 'comparison_sector_mismatch', fund: 'XLK', represents: 'Technology', names: ['LLY'] }]);
    expect(cmp({ type: 'sector_fund', symbols: ['SPY'] }).refusals[0].code).toBe('comparison_sector_mismatch'); // broad market is no sector
    expect(cmp({ type: 'sector_fund', symbols: ['SMH'] }).refusals).toEqual([{ code: 'comparison_fund_unknown', symbol: 'SMH' }]);
    expect(cmp({ type: 'frozen_basket', symbols: ['NVDA', 'AMD', 'AVGO'] }).contract.comparison.symbols).toEqual(['NVDA', 'AMD', 'AVGO']);
    expect(cmp({ type: 'frozen_basket', symbols: ['NVDA'] }).refusals[0]).toEqual({ code: 'comparison_basket_size_invalid', count: 1, min: 2, max: 8 });
    expect(cmp({ type: 'frozen_basket', symbols: ['NVDA', 'XLK'] }).refusals).toEqual([{ code: 'comparison_symbols_invalid', reason: 'not_universe_stocks', symbols: ['XLK'] }]);
    expect(cmp({ type: 'frozen_basket', symbols: ['NVDA', 'NVDA'] }).refusals[0].code).toBe('comparison_basket_size_invalid');
  });

  it('check 5 — the lines: one per name, each inside the slot\'s band (bounds inclusive)', () => {
    const lines = (slot, l, names = ['AAPL']) => normalizeIdeaContract(contractOf({ slot, names, lines: l })).refusals;
    expect(lines('short', [{ symbol: 'AAPL', distancePct: 0.03 }])).toEqual([]);
    expect(lines('short', [{ symbol: 'AAPL', distancePct: 0.08 }])).toEqual([]);
    expect(lines('short', [{ symbol: 'AAPL', distancePct: 0.0299 }])).toEqual([{ code: 'line_distance_out_of_band', symbol: 'AAPL', distancePct: 0.0299, min: 0.03, max: 0.08 }]);
    expect(lines('medium', [{ symbol: 'AAPL', distancePct: 0.05 }])).toEqual([{ code: 'line_distance_out_of_band', symbol: 'AAPL', distancePct: 0.05, min: 0.06, max: 0.15 }]);
    expect(lines('long', [{ symbol: 'AAPL', distancePct: 0.26 }])[0].code).toBe('line_distance_out_of_band');
    expect(lines('short', [])).toEqual([{ code: 'lines_invalid' }]);
    expect(lines('short', [{ symbol: 'AAPL', distancePct: 0.05 }], ['AAPL', 'MSFT'])).toEqual([{ code: 'lines_invalid' }]);
    expect(lines('short', [{ symbol: 'AAPL', distancePct: 0.05 }, { symbol: 'AAPL', distancePct: 0.05 }], ['AAPL', 'MSFT'])).toEqual([{ code: 'lines_invalid' }]);
  });

  it('capital must be positive and in whole cents; EVERY shape failure comes back together', () => {
    for (const bad of [0, -5, 20000.005, NaN, '20000']) expect(normalizeIdeaContract(contractOf({ capitalUsd: bad })).refusals).toEqual([{ code: 'capital_invalid' }]);
    const all = normalizeIdeaContract({
      thesis: { text: '', author: 'nobody' }, slot: 'intraday', names: ['XLK', 'ZZZZ'], comparison: { type: 'hedge' },
      lines: [], capitalUsd: -1, origin: null, sources: 'none',
    });
    expect(all.contract).toBeNull();
    expect(all.refusals.map((r) => r.code).sort()).toEqual([
      'capital_invalid', 'comparison_type_unsupported', 'etf_not_a_name', 'name_not_in_universe', 'origin_invalid',
      'slot_invalid', 'sources_invalid', 'thesis_author_invalid', 'thesis_missing',
    ]);
    expect(normalizeIdeaContract(null).refusals.map((r) => r.code)).toContain('contract_invalid');
  });

  it('planned dollars are whole cents, rounded DOWN: three equal names of $20,000 are $6,666.66 each', () => {
    const three = normalizeIdeaContract(contractOf({ names: ['AAPL', 'MSFT', 'NVDA'] })).contract;
    expect(planLegCents(three, 2000000)).toEqual({ AAPL: 666666, MSFT: 666666, NVDA: 666666 });
    const weighted = normalizeIdeaContract(contractOf({ names: ['AAPL', 'MSFT'], weights: { AAPL: 0.333333, MSFT: 0.666667 }, lines: [{ symbol: 'AAPL', distancePct: 0.05 }, { symbol: 'MSFT', distancePct: 0.05 }] })).contract;
    const legs = planLegCents(weighted, 1000001);
    expect(legs).toEqual({ AAPL: 333333, MSFT: 666667 });
    expect(legs.AAPL + legs.MSFT).toBeLessThanOrEqual(1000001);
  });
});

describe('admitIdea — reserving capital and coverage', () => {
  it('a valid idea is written `accepted` with its contract frozen; its capital moves from the treasury into its ledger; coverage is reserved; the book reconciles', async () => {
    const { db, bookId } = await seedBook();
    const res = await admit(db, bookId, contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] }, lines: [{ symbol: 'AAPL', distancePct: 0.05 }, { symbol: 'MSFT', distancePct: 0.04 }] }));
    expect(res).toEqual({
      ok: true, ideaId: ideaIdFor(bookId, 'idea-1'), idempotentReplay: false, startSession: DAYS.d1, dueSession: '2026-12-01',
      entryNotBefore: { sessionDate: DAYS.d1, slot: 'open30', iso: etIso(DAYS.d1, 10, 0) },
      permittedMaxUsd: 20000, binding: [{ constraint: 'slot_cap', slot: 'short', limitUsd: 20000 }],
    });
    const book = getBook(db, bookId);
    expect(book).toMatchObject({ revision: 1, treasury: { unreservedCash: 80000 }, slots: { short: res.ideaId, medium: null, long: null }, openIdeaIds: [res.ideaId] });
    expect(book.portfolio.cash).toBe(100000); // nothing is bought at admission
    const idea = getIdea(db, bookId, res.ideaId);
    expect(idea).toMatchObject({
      status: 'accepted', admittedAt: ADMIT_ISO, userId: 'owner-1', attributionAgentId: 'agent-ranked-1',
      ledger: { kind: 'idea', reservedCapitalUsd: 20000, cash: 20000, holdings: {} },
      comparisonLedger: null, spyLedger: null, lines: null, entry: null,
    });
    expect(idea.contract).toMatchObject({
      origin: { kind: 'founder_fixture', initiatedBy: 'agent' }, riskAssumption: 'exit_at_line_next_eligible_fill',
      band: { shareOfReserved: 0.0025, usd: 50 }, benchmarkSymbol: 'SPY', epochId: 'epoch-0001', contractVersion: 2, slotsVersion: 1, fundsVersion: 1,
      schedule: { startSession: DAYS.d1, dueSession: '2026-12-01', sessions: 10 },
    });
    const ref = `${bookId}/${res.ideaId}`;
    expect(db._get('practiceFieldCoverage/current')).toEqual({
      version: 1, updatedAt: ADMIT_ISO,
      symbols: {
        AAPL: { roles: ['pending'], refs: [ref], byRef: { [ref]: ['pending'] } },
        MSFT: { roles: ['pending'], refs: [ref], byRef: { [ref]: ['pending'] } },
        SPY: { roles: ['benchmark'], refs: [ref], byRef: { [ref]: ['benchmark'] } },
        XLK: { roles: ['comparison'], refs: [ref], byRef: { [ref]: ['comparison'] } },
      },
    });
    expect(() => assertReconciled(book, [idea])).not.toThrow();
  });

  it('is idempotent on opId: the same contract returns the same idea and writes nothing; a different contract is op_id_conflict', async () => {
    const { db, bookId } = await seedBook();
    const first = await admit(db, bookId, contractOf());
    const versions = [...db._store.keys()].map((p) => [p, db._versionOf(p)]);
    const replay = await admit(db, bookId, contractOf(), 'idea-1', etIso(DAYS.d2, 11, 0));
    expect(replay).toMatchObject({ ok: true, ideaId: first.ideaId, idempotentReplay: true, startSession: DAYS.d1 });
    expect([...db._store.keys()].map((p) => [p, db._versionOf(p)])).toEqual(versions);
    expect(codes(await admit(db, bookId, contractOf({ capitalUsd: 15000 })))).toEqual(['op_id_conflict']);
    expect(getBook(db, bookId).treasury.unreservedCash).toBe(80000);
  });

  it("mode: 'off' refuses with NO read (and still names the shape's failures); 'allowlist' refuses an owner who is not listed", async () => {
    setPracticeFieldModeForTests('off');
    expect(await admitIdea(untouchable, { bookId: 'any', contract: contractOf({ capitalUsd: -1 }), opId: 'x', nowIso: ADMIT_ISO }))
      .toEqual({ ok: false, refusals: [{ code: 'capital_invalid' }, { code: 'mode_not_admitted' }], permittedMaxUsd: null, binding: [] });
    expect(await releaseIdea(untouchable, { bookId: 'any', ideaId: 'x', nowIso: ADMIT_ISO })).toEqual({ ok: false, code: 'mode_not_admitted' });
    setPracticeFieldModeForTests('on');
    const { db, bookId } = await seedBook();
    setPracticeFieldModeForTests('allowlist');
    process.env[COCKPIT_ALLOWLIST_ENV] = 'someone-else';
    expect(codes(await admit(db, bookId, contractOf()))).toEqual(['mode_not_admitted']);
    process.env[COCKPIT_ALLOWLIST_ENV] = 'owner-1';
    expect((await admit(db, bookId, contractOf())).ok).toBe(true);
  });

  it('check 1 — the book must be active and its drafting not paused; an unknown or quarterly book is book_not_found', async () => {
    const { db, bookId, bookRef } = await seedBook();
    await bookRef.update({ drafting: 'paused' });
    expect(codes(await admit(db, bookId, contractOf()))).toEqual(['drafting_paused']);
    await bookRef.update({ drafting: 'on', windDown: { requestedAt: ADMIT_ISO } });
    expect(codes(await admit(db, bookId, contractOf()))).toEqual(['drafting_paused']);
    await bookRef.update({ windDown: null, status: 'draining' });
    expect(codes(await admit(db, bookId, contractOf()))).toEqual(['book_not_active']);
    expect(codes(await admit(db, 'no-such-book', contractOf()))).toEqual(['book_not_found']);
    await db.collection('mandates').doc('quarterly-1').set({ userId: 'owner-1', status: 'active', portfolio: { cash: 1e7, positions: {} } });
    expect(codes(await admit(db, 'quarterly-1', contractOf()))).toEqual(['book_not_found']);
    expect(db._get('mandates/quarterly-1/ideas')).toBeUndefined();
  });

  it('check 2 and B-SAME — an occupied slot, and a ticker another idea holds or has pending, are each refused', async () => {
    const { db, bookId } = await seedBook();
    const a = await admit(db, bookId, contractOf({ names: ['AAPL', 'MSFT'] }), 'idea-a');
    expect(codes(await admit(db, bookId, contractOf({ names: ['NVDA'] }), 'idea-b'))).toEqual(['slot_occupied']);
    const res = await admit(db, bookId, contractOf({ slot: 'medium', names: ['NVDA', 'MSFT'] }), 'idea-b');
    expect(res.refusals).toEqual([{ code: 'ticker_held_by_other_idea', symbol: 'MSFT', ideaId: a.ideaId }]); // PENDING in idea a
    expect(getBook(db, bookId).openIdeaIds).toEqual([a.ideaId]);
  });

  it('B-SAME — a ticker another idea HOLDS is refused the same way', async () => {
    const { db, bookId } = await seedBook();
    const a = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), opId: 'idea-a', quotes: { AAPL: 231.47, SPY: 597.31 } });
    expect(a.entry.outcome).toBe('entered');
    const res = await admit(db, bookId, contractOf({ slot: 'long', names: ['AAPL', 'NVDA'] }), 'idea-b', etIso(DAYS.d1, 11, 0));
    expect(res.refusals).toEqual([{ code: 'ticker_held_by_other_idea', symbol: 'AAPL', ideaId: a.ideaId }]);
  });

  it('check 6 — the calendar: a window past the maintained years is calendar_unsupported (the long slot first, then every slot)', async () => {
    const { db, bookId } = await seedBook();
    const nov = '2027-11-01T16:00:00.000Z';
    expect((await admit(db, bookId, contractOf({ slot: 'short' }), 'idea-s', nov)).ok).toBe(true); // 10 sessions end in November 2027
    expect(codes(await admit(db, bookId, contractOf({ slot: 'long', names: ['NVDA'] }), 'idea-l', nov))).toEqual(['calendar_unsupported']); // 60 sessions end in 2028
    expect(codes(await admit(db, bookId, contractOf({ slot: 'medium', names: ['MSFT'] }), 'idea-m', '2027-12-31T16:00:00.000Z'))).toEqual(['calendar_unsupported']); // the START session is in 2028
  });
});

describe('check 7 — capital, with the permitted maximum and every binding constraint', () => {
  it('the slot cap, the single-position cap and the sector cap for EACH archetype\'s translated limit: a one-stock long idea', async () => {
    // Diversifier and Capital Preserver 1/3 (33,333.33); Speculator 2/3; the rest 1/2. One stock: 35% binds unless the sector cap is tighter.
    const expected = { analyst: 35000, contrarian: 35000, momentum_chaser: 35000, degen: 35000, diversifier: 33333.33, guardian: 33333.33 };
    for (const [archetypeCodeId, max] of Object.entries(expected)) {
      const { db, bookId } = await seedBook({ archetypeCodeId, uid: `u-${archetypeCodeId}` });
      const res = await admit(db, bookId, contractOf({ slot: 'long', names: ['AAPL'], capitalUsd: 40000 }));
      expect(res.ok, archetypeCodeId).toBe(false);
      expect(res.permittedMaxUsd, archetypeCodeId).toBe(max);
      const third = max === 33333.33;
      expect(codes(res), archetypeCodeId).toEqual(third ? ['sector_cap_exceeded', 'single_position_cap_exceeded'] : ['single_position_cap_exceeded']);
      expect(res.binding, archetypeCodeId).toEqual(third
        ? [{ constraint: 'sector_cap', sector: 'Technology', capCents: 3333333, existingCents: 0, limitUsd: 33333.33 }]
        : [{ constraint: 'single_position_cap', symbol: 'AAPL', limitUsd: 35000 }]);
      // The permitted maximum itself is admitted, to the cent — and one cent more is not.
      expect(codes(await admit(db, bookId, contractOf({ slot: 'long', names: ['AAPL'], capitalUsd: Math.round((max + 0.01) * 100) / 100 }), 'over')).length).toBeGreaterThan(0);
      expect((await admit(db, bookId, contractOf({ slot: 'long', names: ['AAPL'], capitalUsd: max }), 'at-max')).ok, archetypeCodeId).toBe(true);
    }
  });

  it('existing exposure narrows the sector headroom, and it differs by archetype: a held medium Technology idea, then a long one', async () => {
    // Held Technology ≈ 30,000 at its recorded mark. Sector cap × equity − held: 1/3 → ~3,330; 1/2 → ~20,000; 2/3 → ~36,650 (then the slot cap, 40%).
    const got = {};
    for (const archetypeCodeId of ['diversifier', 'momentum_chaser', 'degen']) {
      const { db, bookId } = await seedBook({ archetypeCodeId, uid: `u-${archetypeCodeId}` });
      const quotes = { AAPL: { price: 231.47, marketCap: 3.4e12 }, MSFT: { price: 418.13, marketCap: 3.1e12 }, SPY: 597.31 };
      const held = await admitAndEnter(db, bookId, {
        contract: contractOf({ slot: 'medium', names: ['AAPL', 'MSFT'], capitalUsd: 30000 }), opId: 'held', quotes,
      });
      expect(held.entry.outcome, archetypeCodeId).toBe('entered');
      const book = getBook(db, bookId);
      const equityCents = Math.round(book.portfolio.totalValue * 100);
      const heldCents = Object.values(book.portfolio.positions).reduce((s, p) => s + Math.round(p.shares * p.lastMark * 100), 0);
      const res = await admit(db, bookId, contractOf({ slot: 'long', names: ['NVDA', 'AMD'], capitalUsd: 40000 }), 'next', etIso(DAYS.d1, 11, 0));
      const slots = { diversifier: 2, momentum_chaser: 3, degen: 4 }[archetypeCodeId];
      const headroom = Math.floor((equityCents * slots) / 6) - heldCents;
      const slotCap = Math.floor((equityCents * 400000) / 1e6);
      const cashFloor = Math.round(book.treasury.unreservedCash * 100) - Math.ceil((equityCents * 100000) / 1e6);
      expect(res.permittedMaxUsd, archetypeCodeId).toBe(Math.min(headroom, slotCap, cashFloor) / 100);
      got[archetypeCodeId] = res.binding.map((b) => b.constraint);
    }
    expect(got).toEqual({ diversifier: ['sector_cap'], momentum_chaser: ['sector_cap'], degen: ['sector_cap'] });
  });

  it('another idea\'s PENDING plan counts toward the sector cap beside what is held', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'diversifier' }); // sector cap 33,333.33
    expect((await admit(db, bookId, contractOf({ slot: 'short', names: ['AAPL'], capitalUsd: 20000 }), 'a')).ok).toBe(true);
    const res = await admit(db, bookId, contractOf({ slot: 'medium', names: ['MSFT', 'NVDA'], capitalUsd: 20000 }), 'b');
    expect(res.refusals).toEqual([{ code: 'sector_cap_exceeded', constraint: 'sector_cap', sector: 'Technology', capCents: 3333333, existingCents: 2000000, limitUsd: 13333.33, requestedUsd: 20000 }]);
    expect(res.permittedMaxUsd).toBe(13333.33);
    // A second sector is its own headroom: half Technology, half Health Care of 26,666.66 is 13,333.33 each — exactly the room left.
    const mixed = await admit(db, bookId, contractOf({ slot: 'medium', names: ['MSFT', 'LLY'], capitalUsd: 26666.66 }), 'c');
    expect(mixed.ok).toBe(true);
  });

  it('weights move the single-position limit: 0.9 of a long idea in one name binds at 35% of equity ÷ 0.9', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'degen' });
    const contract = contractOf({ slot: 'long', names: ['AAPL', 'LLY'], weights: { AAPL: 0.9, LLY: 0.1 }, capitalUsd: 40000, lines: [{ symbol: 'AAPL', distancePct: 0.15 }, { symbol: 'LLY', distancePct: 0.15 }] });
    const res = await admit(db, bookId, contract);
    expect(res.permittedMaxUsd).toBe(38888.88); // floor(35,000 / 0.9)
    expect(res.binding).toEqual([{ constraint: 'single_position_cap', symbol: 'AAPL', limitUsd: 38888.88 }]);
  });

  it('the cash floor: three full slots leave EXACTLY the 10% floor and all three are admitted; a non-round book is decided to the cent', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'degen' });
    for (const [slot, names, capitalUsd] of [['short', ['AAPL'], 20000], ['medium', ['LLY'], 30000], ['long', ['JPM', 'XOM'], 40000]]) {
      const res = await admit(db, bookId, contractOf({ slot, names, capitalUsd }), `idea-${slot}`);
      expect(res.ok, slot).toBe(true);
    }
    expect(getBook(db, bookId).treasury.unreservedCash).toBe(10000);
    expect(() => assertReconciled(getBook(db, bookId), openIdeas(db, bookId))).not.toThrow();

    // A book whose equity is not round: 100,123.47. The floor is 10,012.347 → the treasury must keep 10,012.35.
    const odd = await seedBook({ archetypeCodeId: 'degen', uid: 'owner-odd' });
    await odd.bookRef.update({ 'portfolio.cash': 100123.47, 'portfolio.totalValue': 100123.47, treasury: { unreservedCash: 100123.47 } });
    expect((await admit(odd.db, odd.bookId, contractOf({ slot: 'short', names: ['AAPL'], capitalUsd: 20024.69 }), 's')).ok).toBe(true); // floor(20,024.694)
    expect((await admit(odd.db, odd.bookId, contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 30037.04 }), 'm')).ok).toBe(true); // floor(30,037.041)
    const long = await admit(odd.db, odd.bookId, contractOf({ slot: 'long', names: ['JPM', 'XOM'], capitalUsd: 40049.39 }), 'l'); // the slot cap allows 40,049.38
    expect(long.refusals.map((r) => r.code)).toEqual(['capital_exceeds_slot_cap']);
    expect(long.permittedMaxUsd).toBe(40049.38);
    expect((await admit(odd.db, odd.bookId, contractOf({ slot: 'long', names: ['JPM', 'XOM'], capitalUsd: 40049.38 }), 'l2')).ok).toBe(true);
    // 100,123.47 − 20,024.69 − 30,037.04 − 40,049.38 = 10,012.36 ≥ 10,012.35.
    expect(getBook(odd.db, odd.bookId).treasury.unreservedCash).toBe(10012.36);
  });

  it('the position count: positions + other ideas\' pending names + this idea\'s names may not pass 15', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    expect((await admit(db, bookId, contractOf({ slot: 'short', names: ['AAPL', 'MSFT', 'NVDA', 'AMD'], capitalUsd: 20000 }), 'a')).ok).toBe(true);
    const epochRef = bookRef.collection('epochs').doc('epoch-0001');
    const epoch = (await epochRef.get()).data();
    await epochRef.set({ ...epoch, gateConfig: { ...epoch.gateConfig, maxPositions: 6 } }); // a test epoch with a small cap
    const res = await admit(db, bookId, contractOf({ slot: 'medium', names: ['LLY', 'JPM', 'XOM'], capitalUsd: 30000 }), 'b');
    expect(res.refusals).toEqual([{ code: 'position_count_exceeded', constraint: 'position_count', positionsAfter: 7, maxPositions: 6, limitUsd: 0, requestedUsd: 30000 }]);
    expect(res.permittedMaxUsd).toBe(0);
    expect((await admit(db, bookId, contractOf({ slot: 'medium', names: ['LLY', 'JPM'], capitalUsd: 30000 }), 'c')).ok).toBe(true);
  });

  it('an epoch without the sector-cap conversion stamp admits nothing (vintage_uncorrected)', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const epochRef = bookRef.collection('epochs').doc('epoch-0001');
    const epoch = (await epochRef.get()).data();
    const { sectorCapConversionVersion: _stamp, ...unstamped } = epoch.gateConfig; // eslint-disable-line no-unused-vars
    await epochRef.set({ ...epoch, gateConfig: { ...unstamped, sectorConcentrationCap: 2 } });
    expect(codes(await admit(db, bookId, contractOf()))).toEqual(['vintage_uncorrected']);
  });

  it('several failures at once are ALL returned, each typed', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'diversifier' });
    expect((await admit(db, bookId, contractOf({ slot: 'long', names: ['AAPL'], capitalUsd: 30000 }), 'a')).ok).toBe(true);
    await bookRef.update({ drafting: 'paused' });
    const res = await admit(db, bookId, contractOf({ slot: 'long', names: ['AAPL', 'MSFT'], capitalUsd: 45000 }), 'b', '2027-12-31T16:00:00.000Z');
    expect(codes(res)).toEqual([
      'calendar_unsupported', 'capital_exceeds_slot_cap', 'drafting_paused', 'sector_cap_exceeded', 'slot_occupied', 'ticker_held_by_other_idea',
    ]);
    expect(res.permittedMaxUsd).toBe(3333.33);
    expect(res.binding.map((b) => b.constraint)).toEqual(['sector_cap']);
  });
});

describe('B-RESERVE — two admissions racing for the same cash', () => {
  it('exactly one wins; the other is refused with its reason and the room that is left', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'degen' });
    // A long idea that has run up: the book's equity is above its starting cash, so the treasury no longer holds
    // enough for both a full short and a full medium idea.
    const quotes = { JPM: { price: 241.37, marketCap: 6.8e11 }, XOM: { price: 118.53, marketCap: 5.2e11 }, SPY: 597.31 };
    const held = await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'long', names: ['JPM', 'XOM'], capitalUsd: 40000 }), opId: 'held', quotes });
    expect(held.entry.outcome).toBe('entered');
    await closeOn(db, bookId, DAYS.d1, { JPM: 362.11, XOM: 177.83, SPY: 598.02 }); // +50%
    const before = getBook(db, bookId);
    const equityCents = Math.round(before.portfolio.totalValue * 100);
    const roomCents = Math.round(before.treasury.unreservedCash * 100) - Math.ceil(equityCents / 10);
    const shortCapital = Math.floor(equityCents * 0.2) / 100;
    const mediumCapital = Math.floor(equityCents * 0.3) / 100;
    expect(Math.round(shortCapital * 100) + Math.round(mediumCapital * 100)).toBeGreaterThan(roomCents); // together they exceed the room
    expect(Math.round(mediumCapital * 100)).toBeLessThanOrEqual(roomCents); // alone, either fits

    const now = etIso(DAYS.d2, 11, 0);
    const short = contractOf({ slot: 'short', names: ['AAPL'], capitalUsd: shortCapital });
    const medium = contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: mediumCapital });
    // The short admission reads the book; the medium one commits first; the short one is retried against it.
    let mediumRes = null;
    db.setBarrier(async () => { mediumRes = await admit(db, bookId, medium, 'medium', now); });
    const attemptsBefore = db._txAttempts();
    const shortRes = await admit(db, bookId, short, 'short', now);
    expect(mediumRes.ok).toBe(true);
    expect(shortRes.ok).toBe(false);
    expect(shortRes.refusals).toHaveLength(1);
    expect(shortRes.refusals[0]).toMatchObject({ code: 'cash_floor_breached', constraint: 'cash_floor', requestedUsd: shortCapital });
    expect(shortRes.permittedMaxUsd).toBe((roomCents - Math.round(mediumCapital * 100)) / 100);
    expect(shortRes.binding).toEqual([{ constraint: 'cash_floor', limitUsd: shortRes.permittedMaxUsd }]);
    expect(db._txAttempts() - attemptsBefore).toBe(3); // short, medium, short again

    const after = getBook(db, bookId);
    expect(after.slots.short).toBeNull();
    expect(after.slots.medium).toBe(mediumRes.ideaId);
    expect(Math.round(after.treasury.unreservedCash * 100)).toBe(Math.round(before.treasury.unreservedCash * 100) - Math.round(mediumCapital * 100));
    expect(getIdea(db, bookId, ideaIdFor(bookId, 'short'))).toBeUndefined();
    expect(() => assertReconciled(after, openIdeas(db, bookId))).not.toThrow();
    // The loser may come back for what is left.
    expect((await admit(db, bookId, contractOf({ slot: 'short', names: ['AAPL'], capitalUsd: shortRes.permittedMaxUsd }), 'short-2', now)).ok).toBe(true);
  });

  it('two admissions racing for one slot: one wins, the other is slot_occupied', async () => {
    const { db, bookId } = await seedBook();
    let second = null;
    db.setBarrier(async () => { second = await admit(db, bookId, contractOf({ names: ['MSFT'] }), 'b'); });
    const first = await admit(db, bookId, contractOf({ names: ['AAPL'] }), 'a');
    expect(second.ok).toBe(true);
    expect(codes(first)).toEqual(['slot_occupied']);
    expect(getBook(db, bookId).openIdeaIds).toEqual([second.ideaId]);
  });
});

describe('B-COVER — coverage is reserved, and held coverage is never the part that gives way', () => {
  const fillCoverage = async (db, count) => {
    const symbols = {};
    for (let i = 0; i < count; i += 1) symbols[`ZZ${String(i).padStart(3, '0')}`] = { roles: ['held'], refs: ['other-book/idea-0'], byRef: { 'other-book/idea-0': ['held'] } };
    await db.collection('practiceFieldCoverage').doc('current').set({ version: 7, symbols, updatedAt: ADMIT_ISO });
  };

  it('an admission whose symbols would push the shared build past its cap fails coverage_unavailable; the reserved symbols are unchanged', async () => {
    const { db, bookId } = await seedBook();
    const room = MANDATE_UNIVERSE_MAX_SYMBOLS - CANDIDATE_UNIVERSE.length; // what idea books may reserve beside the default universe
    await fillCoverage(db, room);
    const before = JSON.stringify(db._get('practiceFieldCoverage/current'));
    // AAPL and SPY: AAPL is already in the default universe; SPY is not — one new symbol, one too many.
    const res = await admit(db, bookId, contractOf({ names: ['AAPL'] }));
    expect(res.refusals).toEqual([{ code: 'coverage_unavailable', needed: MANDATE_UNIVERSE_MAX_SYMBOLS + 1, cap: MANDATE_UNIVERSE_MAX_SYMBOLS }]);
    expect(JSON.stringify(db._get('practiceFieldCoverage/current'))).toBe(before);
    expect(getBook(db, bookId)).toMatchObject({ revision: 0, treasury: { unreservedCash: 100000 }, openIdeaIds: [] });
  });

  it('with one symbol of room the same idea is admitted, and a symbol two ideas share stays reserved until the LAST lets go', async () => {
    const { db, bookId } = await seedBook();
    await fillCoverage(db, MANDATE_UNIVERSE_MAX_SYMBOLS - CANDIDATE_UNIVERSE.length - 1);
    const a = await admit(db, bookId, contractOf({ names: ['AAPL'] }), 'a');
    expect(a.ok).toBe(true);
    const b = await admit(db, bookId, contractOf({ slot: 'medium', names: ['MSFT'] }), 'b'); // SPY is already reserved: no new symbol
    expect(b.ok).toBe(true);
    const refA = `${bookId}/${a.ideaId}`; const refB = `${bookId}/${b.ideaId}`;
    expect(db._get('practiceFieldCoverage/current').symbols.SPY).toEqual({ roles: ['benchmark'], refs: [refA, refB].sort(), byRef: { [refA]: ['benchmark'], [refB]: ['benchmark'] } });

    expect(await releaseIdea(db, { bookId, ideaId: a.ideaId, nowIso: etIso(DAYS.admit, 12, 0) })).toEqual({ ok: true, released: true });
    const cov = db._get('practiceFieldCoverage/current').symbols;
    expect(cov.SPY).toEqual({ roles: ['benchmark'], refs: [refB], byRef: { [refB]: ['benchmark'] } });
    expect(cov.AAPL).toBeUndefined();
    expect(cov.MSFT.roles).toEqual(['pending', 'comparison']); // same_stock_held: the name is also its own comparison
    expect(Object.keys(cov).filter((s) => s.startsWith('ZZ')).length).toBe(MANDATE_UNIVERSE_MAX_SYMBOLS - CANDIDATE_UNIVERSE.length - 1); // other books' held coverage untouched
  });
});

describe('releaseIdea — reversing a reservation that never filled', () => {
  it('returns the whole reservation to the treasury, opens the slot, lets the coverage go, and is idempotent', async () => {
    const { db, bookId } = await seedBook();
    const a = await admit(db, bookId, contractOf({ names: ['AAPL', 'MSFT'], capitalUsd: 17654.32 }));
    const at = etIso(DAYS.admit, 12, 0);
    expect(await releaseIdea(db, { bookId, ideaId: a.ideaId, reason: 'entry_timeout', nowIso: at })).toEqual({ ok: true, released: true });
    const book = getBook(db, bookId);
    expect(book).toMatchObject({ revision: 2, treasury: { unreservedCash: 100000 }, slots: { short: null }, openIdeaIds: [] });
    expect(book.portfolio.cash).toBe(100000);
    const idea = getIdea(db, bookId, a.ideaId);
    expect(idea).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout', at, returnedToTreasuryUsd: 17654.32 }, ledger: { cash: 0, reservedCapitalUsd: 0 } });
    expect(idea.statusHistory.map((h) => h.status)).toEqual(['accepted', 'cancelled']);
    expect(db._get('practiceFieldCoverage/current').symbols).toEqual({});
    const versions = [...db._store.keys()].map((p) => [p, db._versionOf(p)]);
    expect(await releaseIdea(db, { bookId, ideaId: a.ideaId, nowIso: at })).toEqual({ ok: true, released: false, idempotentReplay: true });
    expect([...db._store.keys()].map((p) => [p, db._versionOf(p)])).toEqual(versions);
    // The slot is open again.
    expect((await admit(db, bookId, contractOf({ names: ['NVDA'] }), 'idea-2')).ok).toBe(true);
  });

  it('refuses an idea that has filled (its capital leaves only through fills), an unknown idea and an unknown book', async () => {
    const { db, bookId } = await seedBook();
    const a = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: { AAPL: 231.47, SPY: 597.31 } });
    expect(await releaseIdea(db, { bookId, ideaId: a.ideaId, nowIso: etIso(DAYS.d1, 12, 0) })).toEqual({ ok: false, code: 'idea_already_filled', status: 'holding' });
    expect(await releaseIdea(db, { bookId, ideaId: 'nope', nowIso: ADMIT_ISO })).toEqual({ ok: false, code: 'idea_not_found' });
    expect(await releaseIdea(makeMandateFakeDb(), { bookId: 'nope', ideaId: 'x', nowIso: ADMIT_ISO })).toEqual({ ok: false, code: 'book_not_found' });
  });
});
