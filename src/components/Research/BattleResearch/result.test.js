// Battle Research Slice 1 — one frozen result (BRS-4, BRS-6 – BRS-15, §6): the groups and their
// tags, the weakest holding, eligibility, the orders, the conditions, the reference line and the
// freeze. On the research sheet's real measured book (EQIX the weakest, −0.4 rungs at 12:45).

import { describe, it, expect, beforeAll } from 'vitest';
import { researchGroupsOf, selectBenchRoster } from '../../../data/battleUniverse.js';
import { bookOf, weakestOf } from '../Sheet/book.js';
import { membershipOf } from './groups.js';
import { buildResult, outcomeOf, incumbentOf, noWeakestReason, conditionCounts, sectorsPresent, timesOf, rungEstimateOf, sectorOf, testCondition } from './result.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT, RANKS_AT } from './__fixtures__/researchFixtures.js';

const MIN = 60_000;
let BATTLE;
beforeAll(async () => { BATTLE = await researchBattle(); });
const RANK = { measure: 'technical_rank', direction: 'best_first' };
const MOVE = { measure: 'today_move', direction: 'best_first' };
const DROP = { measure: 'today_move', direction: 'worst_first' };
const weakest = (over = {}) => buildResult({ battle: BATTLE, incumbent: incumbentOf(BATTLE), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'r1', ...over });
const syms = (list) => list.map((x) => x.symbol);

describe('BRS-4 — the two groups (researchGroupsOf, extended from the roster)', () => {
  it('bench = the persisted bench then its crypto; agent watchlist = the hot bench then the equipped list; held names out, listed as held', () => {
    const g = researchGroupsOf(BATTLE);
    expect(g.bench).toEqual(['MSFT', 'NVDA', 'ORCL', 'SOL-USD.CC']);
    expect(g.agentWatchlist).toEqual(['PLTR', 'MSFT', 'NOW']);
    expect(g.held).toEqual(['AAPL']);
  });
  it('a name on both lists carries both tags, bench first', () => {
    expect(researchGroupsOf(BATTLE).membership.MSFT).toEqual(['bench', 'agent_watchlist']);
    expect(researchGroupsOf(BATTLE).membership.PLTR).toEqual(['agent_watchlist']);
  });
  it('walks the same lists in the same order as selectBenchRoster: the union is the roster', () => {
    const g = researchGroupsOf(BATTLE);
    expect([...g.bench, ...g.agentWatchlist.filter((s) => !g.bench.includes(s))]).toEqual(selectBenchRoster(BATTLE));
  });
  it('an empty or missing battle has empty groups', () => {
    expect(researchGroupsOf(null)).toEqual({ bench: [], agentWatchlist: [], held: [], membership: {} });
  });
});

describe('BRS-15 — eligibility (canComeIn at takenAt): against the incumbent, and with none', () => {
  it('against EQIX: can come in; locked with its time; the equipped-only reason; a crypto for a stock', () => {
    const m = Object.fromEntries(membershipOf(BATTLE, { out: 'EQIX', slot: 'support', atMs: TAKEN_AT }).membership.map((x) => [x.symbol, x.eligibility]));
    expect(m.MSFT).toEqual({ ok: true, reason: null, lockedUntil: null });
    expect(m.PLTR.ok).toBe(true); // the hot bench has no cooldown
    expect(m.NVDA).toEqual({ ok: false, reason: 'pick_locked', lockedUntil: Date.parse('2026-10-15T14:00:00.000Z') });
    expect(m.NOW).toEqual({ ok: false, reason: 'pick_not_on_bench', lockedUntil: null });
    expect(m['SOL-USD.CC']).toEqual({ ok: false, reason: 'pick_wrong_class', lockedUntil: null });
  });
  it('a group question has no OUT: the crypto is not refused for its class', () => {
    const m = Object.fromEntries(membershipOf(BATTLE, { out: null, atMs: TAKEN_AT }).membership.map((x) => [x.symbol, x.eligibility]));
    expect(m['SOL-USD.CC'].ok).toBe(true);
    expect(m.NOW.reason).toBe('pick_not_on_bench');
  });
  it('a lock that has passed by takenAt is no lock', () => {
    const m = Object.fromEntries(membershipOf(BATTLE, { out: 'EQIX', atMs: Date.parse('2026-10-15T15:00:00.000Z') }).membership.map((x) => [x.symbol, x.eligibility]));
    expect(m.NVDA.ok).toBe(true);
  });
});

describe('BRS-6 — the weakest holding is book.js\'s choice, frozen with its check', () => {
  it('weakestOf(bookOf(battle)) — EQIX — with its position, tier, rungs, check time, the receipt\'s rung size and lockNow', () => {
    const inc = incumbentOf(BATTLE);
    const w = weakestOf(bookOf(BATTLE));
    expect(inc.symbol).toBe(w.symbol);
    expect(inc).toMatchObject({ symbol: 'EQIX', positionId: w.positionId, tier: w.tier, slot: w.slot, rungsShown: -0.4, checkAtMs: w.checkAtMs });
    expect(inc.scoringPct).toBe(w.context.scoringPct);
    expect(inc.lockNow).toMatchObject({ atMs: w.checkAtMs });
    expect(Number.isFinite(inc.lockNow.total)).toBe(true);
  });
  it('no weakest: awaiting the first check vs not measured (legacy-scored; a crypto-only book) — never the same case', () => {
    expect(noWeakestReason(BATTLE)).toBeNull();
    const fresh = JSON.parse(JSON.stringify(BATTLE));
    fresh.scoring.stockRewardContexts.agent = {};
    expect(noWeakestReason(fresh)).toBe('awaiting');
    const legacy = JSON.parse(JSON.stringify(BATTLE));
    delete legacy.scoring.stockThresholdModel;
    expect(noWeakestReason(legacy)).toBe('legacy');
    const cryptoOnly = JSON.parse(JSON.stringify(BATTLE));
    cryptoOnly.portfolio = { ...cryptoOnly.portfolio, star: [], core: [], support: [{ symbol: 'ETH', isCrypto: true }] };
    expect(noWeakestReason(cryptoOnly)).toBe('no_ladder');
    expect(incumbentOf(cryptoOnly)).toBeNull();
  });
});

describe('BRS-11 — ordering', () => {
  it('technical rank, best first; the crypto and the unranked name go to Not ranked', () => {
    const r = weakest();
    const o = outcomeOf(r, { group: 'union', order: RANK, conditions: [] });
    expect(syms(o.placed)).toEqual(['PLTR', 'NVDA', 'MSFT', 'ORCL']);
    expect(o.placed.map((p) => p.position)).toEqual([1, 2, 3, 4]);
    expect(o.unranked).toEqual([{ symbol: 'SOL-USD.CC', reason: 'crypto' }, { symbol: 'NOW', reason: 'not_in_rankings' }]);
  });
  it("today's move, biggest gain first; Biggest drop first reverses it", () => {
    const r = weakest();
    expect(syms(outcomeOf(r, { group: 'union', order: MOVE, conditions: [] }).placed)).toEqual(['ORCL', 'MSFT', 'PLTR', 'NVDA']);
    expect(syms(outcomeOf(r, { group: 'union', order: DROP, conditions: [] }).placed)).toEqual(['NVDA', 'PLTR', 'MSFT', 'ORCL']);
  });
  it('move ties go to technical rank, then the symbol', () => {
    const r = weakest({ quotesBody: quotesBody({ MSFT: { ...quotesBody().quotes.MSFT, changePercent: 2.05 } }) });
    // ORCL and MSFT both +2.05: MSFT (rank 40) before ORCL (rank 75).
    expect(syms(outcomeOf(r, { group: 'union', order: MOVE, conditions: [] }).placed).slice(0, 2)).toEqual(['MSFT', 'ORCL']);
  });
  it('a name without an ok move is NOT ASSESSED under the move order (never flat, never removed); rank still places it', () => {
    const r = weakest({ quotesBody: quotesBody({ PLTR: { ...quotesBody().quotes.PLTR, priceAsOf: TAKEN_AT - 50 * MIN } }) });
    const o = outcomeOf(r, { group: 'union', order: MOVE, conditions: [] });
    expect(syms(o.placed)).toEqual(['ORCL', 'MSFT', 'NVDA']);
    expect(o.notAssessed).toEqual([{ symbol: 'PLTR', conditionId: 'order', state: 'stale' }]);
    expect(o.removed).toEqual([]);
    expect(syms(outcomeOf(r, { group: 'union', order: RANK, conditions: [] }).placed)).toContain('PLTR');
  });
  it('no blended field exists on a result: rank and move are separate readings', () => {
    const r = weakest();
    // Every field NAME of the frozen result (archScores' archetype ids are the sheet packs' input, not a field of ours).
    const keys = [];
    const walk = (o, under) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (under !== 'archScores') keys.push(k); walk(v, k); } };
    walk(r, null);
    expect(keys.filter((k) => /blend|composite|fit|momentum|overlap|spy/i.test(k))).toEqual([]);
  });
  it('a group question ranks one group; the other group is a view switch over the same frozen membership', () => {
    const r = buildResult({ battle: BATTLE, incumbent: null, rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'g1' });
    expect(syms(outcomeOf(r, { group: 'bench', order: RANK, conditions: [] }).placed)).toEqual(['NVDA', 'MSFT', 'ORCL']);
    expect(syms(outcomeOf(r, { group: 'agent_watchlist', order: RANK, conditions: [] }).placed)).toEqual(['PLTR', 'MSFT']);
    expect(outcomeOf(r, { group: 'bench', order: RANK, conditions: [] }).reference).toBeNull();
  });
});

describe('BRS-12 — conditions, over the WHOLE frozen group', () => {
  it('only names that can come in now: NVDA (locked) is removed, the others close up with "was #n"', () => {
    const r = weakest();
    const prev = outcomeOf(r, { group: 'union', order: RANK, conditions: [] });
    const o = outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'eligible_now' }] }, { prev });
    expect(o.placed).toEqual([{ symbol: 'PLTR', position: 1 }, { symbol: 'MSFT', position: 2, wasPosition: 3 }, { symbol: 'ORCL', position: 3, wasPosition: 4 }]);
    expect(o.removed).toEqual([{ symbol: 'NVDA', by: ['eligible_now'] }]);
  });
  it('up today / down today, and ZERO belongs to neither (a fail, not "not assessed")', () => {
    const r = weakest({ quotesBody: quotesBody({ MSFT: { ...quotesBody().quotes.MSFT, changePercent: 0 } }) });
    const up = outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'up_today' }] });
    const down = outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'down_today' }] });
    expect(syms(up.placed)).toEqual(['PLTR', 'ORCL']);
    expect(syms(down.placed)).toEqual(['NVDA']);
    expect(up.removed.find((x) => x.symbol === 'MSFT')).toEqual({ symbol: 'MSFT', by: ['up_today'] });
    expect(down.removed.find((x) => x.symbol === 'MSFT')).toEqual({ symbol: 'MSFT', by: ['down_today'] });
    expect(up.notAssessed).toEqual([]);
  });
  it('a name a condition cannot assess sits under not assessed, never removed', () => {
    const r = weakest({ quotesBody: quotesBody({ PLTR: null }) });
    const o = outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'up_today' }] });
    expect(o.notAssessed).toEqual([{ symbol: 'PLTR', conditionId: 'up_today', state: 'missing' }]);
    expect(o.removed.map((x) => x.symbol)).toEqual(['NVDA']);
  });
  it('a missing move blocks only move assessment: rank, eligibility and sector still work', () => {
    const r = weakest({ quotesBody: quotesBody({ PLTR: null }) });
    expect(syms(outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'eligible_now' }, { id: 'sector', value: 'Technology' }] }).placed)).toContain('PLTR');
  });
  it('the sector condition: one sector, from the rankings row (else the static map); the sectors present', () => {
    const r = weakest();
    expect(sectorsPresent(r, 'union')).toEqual(['Technology']);
    expect(sectorOf(r, 'EQIX')).toBe('Real Estate');
    const o = outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'sector', value: 'Technology' }] });
    expect(o.placed.length).toBe(4);
    expect(testCondition(r, r.membership.find((m) => m.symbol === 'MSFT'), { id: 'sector', value: 'Energy' })).toBe('fail');
  });
  it('a condition applies to the whole frozen group, never to the rows on screen', () => {
    const r = weakest();
    // Replacing up today with down today brings back NVDA, which up today had removed.
    expect(syms(outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'up_today' }] }).placed)).not.toContain('NVDA');
    expect(syms(outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'down_today' }] }).placed)).toEqual(['NVDA']);
  });
  it('BRS-18a counts: remain · fail · not assessed against the whole group with the other conditions', () => {
    const r = weakest({ quotesBody: quotesBody({ PLTR: null }) });
    expect(conditionCounts(r, { group: 'union', order: RANK, conditions: [] }, { id: 'up_today' })).toEqual({ remain: 2, fail: 1, notAssessed: 1 });
    // In place of down today: the other active condition is dropped from the count.
    expect(conditionCounts(r, { group: 'union', order: RANK, conditions: [{ id: 'down_today' }] }, { id: 'up_today' }, { replaces: 'down_today' })).toEqual({ remain: 2, fail: 1, notAssessed: 1 });
  });
});

describe('BRS-6 — the reference line, placed by its own value; never numbered', () => {
  it('on rank: EQIX (140) trails every ranked candidate — the line sits below the list', () => {
    const o = outcomeOf(weakest(), { group: 'union', order: RANK, conditions: [] });
    expect(o.reference).toEqual({ symbol: 'EQIX', before: null, noReading: false });
    expect(o.placed.some((p) => p.symbol === 'EQIX')).toBe(false);
  });
  it('on rank, inside the list: an incumbent ranked 50 sits above MSFT (40 out-ranks it, 75 does not)', () => {
    const doc = rankingsDoc();
    doc.stocks = doc.stocks.map((s) => (s.symbol === 'EQIX' ? { ...s, technicalRank: 50 } : s));
    const o = outcomeOf(weakest({ rankingsDoc: doc }), { group: 'union', order: RANK, conditions: [] });
    expect(o.reference.before).toBe('ORCL');
  });
  it('on today\'s move: gain first, EQIX −0.81 trails all; drop first, it leads (nothing is down more)', () => {
    expect(outcomeOf(weakest(), { group: 'union', order: MOVE, conditions: [] }).reference.before).toBeNull();
    expect(outcomeOf(weakest(), { group: 'union', order: DROP, conditions: [] }).reference.before).toBe('NVDA');
  });
  it('an equal move never sits above the line', () => {
    const r = weakest({ quotesBody: quotesBody({ EQIX: { ...quotesBody().quotes.EQIX, changePercent: 1.24 } }) });
    expect(outcomeOf(r, { group: 'union', order: MOVE, conditions: [] }).reference.before).toBe('MSFT');
  });
  it('with no reading for the measure the incumbent is not placed, and says so', () => {
    const r = weakest({ quotesBody: quotesBody({ EQIX: null }) });
    expect(outcomeOf(r, { group: 'union', order: MOVE, conditions: [] }).reference).toEqual({ symbol: 'EQIX', before: null, noReading: true });
  });
});

describe('BRS-8 / BRS-14 — the frozen readings and their times', () => {
  it('rank time from computedAt, the move range from the ok quotes used, older than usual past expiresAt', () => {
    const t = timesOf(weakest());
    expect(t).toMatchObject({ ranksAtMs: RANKS_AT, ranksAt: '1:01 PM', ranksOlder: false, movesFrom: '1:42 PM', movesTo: '1:44 PM', takenAt: '1:45 PM' });
    expect(timesOf(weakest({ takenAt: RANKS_AT + 80 * MIN, quotesBody: quotesBody() })).ranksOlder).toBe(true);
  });
  it('a candidate\'s rung estimate: atrReadingOf on the row\'s atrPercent at the doc\'s time; none in a legacy-scored battle', () => {
    expect(rungEstimateOf(weakest(), 'PLTR')).toEqual({ pct: 4.06, asOfMs: RANKS_AT });
    const legacy = JSON.parse(JSON.stringify(BATTLE));
    delete legacy.scoring.stockThresholdModel;
    expect(rungEstimateOf(buildResult({ battle: legacy, incumbent: null, rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'l' }), 'PLTR')).toBeNull();
  });
  it('the rankings subset keeps the battle\'s names only — the membership, the incumbent and the held measured stocks a comparison can pick (and their archetype scores) — never the whole universe', () => {
    const r = weakest();
    expect(Object.keys(r.rankings.rows).sort()).toEqual(['AAPL', 'CAT', 'EQIX', 'JPM', 'KO', 'MSFT', 'NVDA', 'ORCL', 'PLTR', 'XOM']);
    expect(r.rankings.rows.ZZZ).toBeUndefined();
    // BRS-18: the held measured stocks, frozen in the incumbent's shape, weakest first.
    expect(r.holdings.map((h) => h.symbol)).toEqual(['EQIX', 'KO', 'CAT', 'JPM', 'XOM', 'AAPL']);
    expect(r.quotes.rows.AAPL.state).toBe('ok');
    expect(r.rankings).toMatchObject({ computedAt: RANKS_AT, mode: 'intraday', totalTechStocks: 228 });
    expect(r.rankings.rows.PLTR).toMatchObject({ technicalRank: 5, sectorTechnicalRank: 2, sectorTechnicalTotal: 21, atrPercent: 4.06, sectorName: 'Technology' });
  });
  it('quotes are classified once and frozen: the median and every state are stored with the result', () => {
    const r = weakest();
    expect(r.quotes.medianAsOf).toBe(TAKEN_AT - 2 * MIN);
    expect(r.quotes.rows.MSFT).toMatchObject({ state: 'ok', words: '+1.2% · 1:43 PM' });
    expect(r.quotes.rows['SOL-USD.CC'].state).toBe('unsupported');
    expect(r.label).toBe('Result 1 · 1:45 PM');
  });
  it('FREEZING: a newer snapshot, a new check, a rebuilt roster or a new rankings run handed to the same result changes no position', () => {
    const r = weakest();
    const view = { group: 'union', order: RANK, conditions: [{ id: 'eligible_now' }] };
    const before = JSON.stringify(outcomeOf(r, view));
    // The battle moves on: the roster rebuilt, a lock gone, a new check — the result never reads it.
    BATTLE.watchlist.hotBench = ['ZZZ'];
    BATTLE.portfolio.bench.stocks[1].cooldownUntil = null;
    expect(JSON.stringify(outcomeOf(r, view))).toBe(before);
    BATTLE.watchlist.hotBench = ['PLTR', 'MSFT'];
    BATTLE.portfolio.bench.stocks[1].cooldownUntil = '2026-10-15T14:00:00.000Z';
  });
  it('adding or removing a condition leaves every row\'s state, cause and words identical (no re-classification)', () => {
    const r = weakest({ quotesBody: quotesBody({ PLTR: { ...quotesBody().quotes.PLTR, priceAsOf: TAKEN_AT - 50 * MIN } }) });
    const snap = JSON.stringify(r.quotes);
    outcomeOf(r, { group: 'union', order: MOVE, conditions: [{ id: 'up_today' }, { id: 'eligible_now' }] });
    outcomeOf(r, { group: 'bench', order: RANK, conditions: [] });
    expect(JSON.stringify(r.quotes)).toBe(snap);
  });
});
