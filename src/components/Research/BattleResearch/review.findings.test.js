// Battle Research Slice 1 — PR A's review (BUILD_RULES §2): one row per CONFIRMED finding of lenses
// BR1 (readings and freezing) and BR2 (honesty and display agreement), each written to fail on the
// reviewed commit edc9588e and pass on the fix (the build report's review table names the commit).
// Lens BR3's rows live in api/agent/battle-research-quotes.test.js.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildResult, incumbentOf, outcomeOf, conditionCounts } from './result.js';
import { newInvestigation, currentStep, refinementsOf, addCondition, removeCondition, setOrder, switchGroup, refreshGate, refreshIncumbent, refreshReport, CAPS } from './investigation.js';
import { classifyMove, sessionAt } from './readings.js';
import { explainOf, bannerOf, rowFactsOf, compareOf, draftOf, rankText } from './explain.js';
import { signedPts } from './battleResearchCopy.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

const MIN = 60_000;
let BATTLE;
beforeAll(async () => { BATTLE = await researchBattle(); });
const clone = (x) => JSON.parse(JSON.stringify(x));
const q = (over) => ({ ...quotesBody().quotes.MSFT, ...over });
const res = (over = {}, battle = BATTLE) => buildResult({ battle, incumbent: incumbentOf(battle), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'r1', ...over });
const inv = (r, questionId = 'weakest_alternatives') => newInvestigation({ battleId: 'b', questionId, result: r, at: TAKEN_AT });
const RANK = { measure: 'technical_rank', direction: 'best_first' };
const MOVE = { measure: 'today_move', direction: 'best_first' };
const placedOf = (o) => o.placed.map((p) => p.symbol);

/** The executor's swap, replayed: EQIX out (back to the bench, cooling down), MSFT in, the book unscored until the next check. */
function swappedOut(battle) {
  const b = clone(battle);
  const tier = ['star', 'core', 'support'].find((t) => b.portfolio[t].some((a) => a.symbol === 'EQIX'));
  b.portfolio[tier] = b.portfolio[tier].map((a) => (a.symbol === 'EQIX' ? { ...a, symbol: 'MSFT', positionId: 'position-msft' } : a));
  b.portfolio.bench.stocks = [...b.portfolio.bench.stocks.filter((s) => s.symbol !== 'MSFT'), { symbol: 'EQIX', cooldownUntil: '2026-10-15T18:00:00.000Z' }];
  b.scoreState = { ...(b.scoreState || {}), stockScoreEvidence: { status: 'unavailable', reason: 'roster_changed_awaiting_score' } };
  return b;
}

describe('BR1 — readings and freezing', () => {
  it('BR1-1: after the incumbent is swapped out, Refresh never compares with it again (none, and the weakest question says why)', () => {
    const later = swappedOut(BATTLE);
    expect(incumbentOf(later)).toBeNull();
    const i = inv(res());
    expect(refreshIncumbent(i, later)).toBeNull();
    const r2 = buildResult({ battle: later, incumbent: refreshIncumbent(i, later), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT + 20 * MIN, resultId: 'r2', index: 2 });
    const i2 = inv(r2);
    expect(explainOf(i2, r2, currentStep(i2))[0]).toMatch(/^Our holdings are ranked at the next check/);
    // And the incumbent is never a member of its own result.
    expect(res().membership.some((m) => m.symbol === 'EQIX')).toBe(false);
  });
  it('BR1-2: the move order, its ties, the reference line and the count decide on the PRINTED move', () => {
    const r = res({ quotesBody: quotesBody({ ORCL: q({ changePercent: 1.24 }), MSFT: q({ changePercent: 1.21 }), EQIX: q({ changePercent: 1.21 }) }) });
    const i = setOrder(inv(r), MOVE, 1);
    const o = currentStep(i).outcome;
    // ORCL and MSFT both print +1.2%: a tie, to technical rank (MSFT 40 before ORCL 75).
    expect(placedOf(o).slice(0, 2)).toEqual(['MSFT', 'ORCL']);
    // EQIX prints +1.2% too: nothing above it is ahead of it — the line sits at the top and the count says 0.
    expect(o.reference.before).toBe('MSFT');
    expect(explainOf(i, r, currentStep(i))[0]).toContain('0 of 5 names are ahead of EQIX on today’s move.');
  });
  it('BR1-3: the refresh countdown never shows more than a minute, however the clocks sit', () => {
    expect(refreshGate({ takenAt: TAKEN_AT + 2 * MIN, nowMs: TAKEN_AT }).remainingMs).toBeLessThanOrEqual(60_000);
    expect(refreshGate({ takenAt: TAKEN_AT + 2 * MIN, nowMs: TAKEN_AT }).text).toBe('1:00');
    expect(res({ receivedAt: TAKEN_AT + 5000 }).receivedAt).toBe(TAKEN_AT + 5000);
  });
  it('BR1-4: What\'s moving today places an unranked name by its own ok move', () => {
    expect(placedOf(outcomeOf(res(), { group: 'union', order: MOVE, conditions: [] }))).toContain('NOW');
    expect(placedOf(outcomeOf(res(), { group: 'union', order: RANK, conditions: [] }))).not.toContain('NOW');
  });
  it('BR1-5: a bare crypto ticker on the hot bench is crypto — never a stock quote, never the move that turns moves on', () => {
    const b = clone(BATTLE);
    b.watchlist.hotBench = ['PLTR', 'MSFT', 'BTC'];
    const r = buildResult({ battle: b, incumbent: incumbentOf(b), rankingsDoc: rankingsDoc(), quotesBody: quotesBody({ BTC: q({ changePercent: 3.1 }) }), takenAt: TAKEN_AT, resultId: 'r' });
    expect(r.membership.find((m) => m.symbol === 'BTC').isCrypto).toBe(true);
    expect(r.quotes.rows.BTC.state).toBe('unsupported');
  });
  it('BR1-7: a refresh reports a name entering or leaving the placed list with the lists unchanged', () => {
    const r1 = res();
    const o1 = outcomeOf(r1, { group: 'union', order: MOVE, conditions: [] });
    const r2 = res({ quotesBody: quotesBody({ NVDA: null }), resultId: 'r2' });
    const o2 = outcomeOf(r2, { group: 'union', order: MOVE, conditions: [] });
    expect(refreshReport(r1, o1, r2, o2).placedOut).toEqual(['NVDA']);
  });
  it('BR1-8: the use-across counts make the same replacement addCondition makes (down today active, up today asked)', () => {
    const r = res();
    const view = { group: 'union', order: RANK, conditions: [{ id: 'down_today' }] };
    const counts = conditionCounts(r, view, { id: 'up_today' });
    const applied = currentStep(addCondition(addCondition(inv(r), { id: 'down_today' }, 1), { id: 'up_today' }, 2)).outcome;
    expect(counts.remain).toBe(applied.placed.length);
  });
  it('BR1-9: a long single trail past the cap still accounts for every refinement in its *then: …* chain', () => {
    let i = inv(res());
    for (let k = 0; k < CAPS.steps + 5; k += 1) i = k % 2 ? removeCondition(i, 'eligible_now', k) : addCondition(i, { id: 'eligible_now' }, k);
    expect(i.steps).toHaveLength(CAPS.steps);
    expect(refinementsOf(i)).toHaveLength(CAPS.steps + 5);
  });
  it('BR1-10: a group switch carries no "was #n" from the other group\'s list', () => {
    const b = clone(BATTLE);
    b.watchlist.hotBench = ['NVDA', 'PLTR', 'MSFT'];
    const r = buildResult({ battle: b, incumbent: null, rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'g' });
    const i = switchGroup(inv(r, 'rank_bench'), 'agent_watchlist', 1);
    expect(currentStep(i).outcome.placed.every((p) => p.wasPosition === undefined)).toBe(true);
  });
  it('BR1-11: a quote with no session date is never named as some day\'s close', () => {
    const c = classifyMove({ quote: q({ sessionEtDate: null }), session: sessionAt(TAKEN_AT), snapshot: { sweepAt: TAKEN_AT }, takenAt: TAKEN_AT });
    expect(c.words).not.toMatch(/'s move · close/);
  });
  it('BR1-14: a move that prints 0.0 is zero — it fails both up and down today, and prints no sign', () => {
    const r = res({ quotesBody: quotesBody({ PLTR: q({ changePercent: 0.04 }), NVDA: q({ changePercent: -0.04 }) }) });
    expect(r.quotes.rows.PLTR.words).toMatch(/^0\.0% · /);
    expect(placedOf(outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'up_today' }] }))).not.toContain('PLTR');
    expect(placedOf(outcomeOf(r, { group: 'union', order: RANK, conditions: [{ id: 'down_today' }] }))).not.toContain('NVDA');
  });
});

describe('BR2 — honesty and display agreement', () => {
  it('BR2-1: a group question\'s comparison with a picked holding judges the candidate against THAT holding', () => {
    const r = buildResult({ battle: BATTLE, incumbent: null, rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'g' });
    const i = inv(r, 'rank_bench');
    const eqix = r.holdings.find((h) => h.symbol === 'EQIX');
    const c = compareOf(r, currentStep(i).view, 'SOL-USD.CC', eqix, BATTLE);
    expect(c.rows.find((x) => x.key === 'stands').cand).toBe('Can’t come in · a crypto can’t replace a stock');
    expect(draftOf(i, r, currentStep(i), 'SOL-USD.CC', eqix).text).not.toContain('SOL-USD.CC can come in now');
  });
  it('BR2-2: a locked candidate\'s evidence names the lock, never "not on the swap\'s lists"', () => {
    const r = res();
    const c = compareOf(r, currentStep(inv(r)).view, 'NVDA', r.incumbent, BATTLE);
    expect(c.evidence).toContain('It’s locked until Thu 10:00 AM');
    expect(c.evidence).not.toContain('not on the swap');
  });
  it('BR2-3: the banner counts against the group, and names what was set aside separately from what was removed', () => {
    let i = addCondition(inv(res()), { id: 'up_today' }, 1);
    i = removeCondition(i, 'up_today', 2);
    expect(bannerOf(i, currentStep(i)).body).toMatch(/^4 of 4 names placed\./);
    const r = res({ quotesBody: quotesBody({ PLTR: null }) });
    const j = addCondition(inv(r), { id: 'up_today' }, 1);
    expect(bannerOf(j, currentStep(j)).body).toContain('set aside, not assessed');
  });
  it('BR2-5: a name that is down but less than the holding is never called "up more today"', () => {
    const r = res();
    expect(rowFactsOf(BATTLE, r, 'NVDA').diffs).toContain('Down less today than EQIX');
    expect(compareOf(r, currentStep(inv(r)).view, 'NVDA', r.incumbent, BATTLE).tradeoff).not.toContain('up more today');
  });
  it('BR2-6: a time from another day than the result\'s names its day', () => {
    const sat = Date.parse('2026-10-17T15:00:00.000Z');
    const fri = Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, priceAsOf: Date.parse('2026-10-16T19:59:00.000Z'), sessionEtDate: '2026-10-16' }]));
    const r = res({ takenAt: sat, quotesBody: quotesBody(fri) });
    expect(rankText(r, 'PLTR')).toMatch(/· Wed 1:01 PM ET/);
  });
  it('BR2-9: two quotes\' times print as their range, never one quote\'s time for both', () => {
    const i = setOrder(inv(res()), MOVE, 1);
    expect(explainOf(i, res(), currentStep(i))[1]).toContain('(as of 1:42–1:43 PM)');
  });
  it('BR2-10: a missing move is said once', () => {
    const r = res({ quotesBody: quotesBody({ EQIX: null }) });
    const i = setOrder(inv(r), MOVE, 1);
    expect(explainOf(i, r, currentStep(i)).join(' ').split('I don’t have today’s move for EQIX yet.').length - 1).toBe(1);
  });
  it('BR2-11: no shared reading, no verdict', () => {
    const r = res();
    expect(compareOf(r, currentStep(inv(r)).view, 'SOL-USD.CC', r.incumbent, BATTLE).evidence).toMatch(/share no reading/);
  });
  it('BR2-13: an expired lock is said to have passed in the draft too', () => {
    const r = res();
    const d = draftOf(inv(r), r, currentStep(inv(r)), 'NVDA', r.incumbent, { nowMs: Date.parse('2026-10-15T15:00:00.000Z') }).text;
    expect(d).toContain('since passed');
  });
  it('BR2-14 / BR2-15: a rank with no time says so; a zero lock prints "+0"; the first rank printed carries "of N"', () => {
    const doc = rankingsDoc();
    delete doc.computedAt;
    expect(rankText(res({ rankingsDoc: doc }), 'PLTR')).toBe('Rank 5 of 228 · time not recorded');
    expect(signedPts(0)).toBe('+0');
    const r = res();
    const d = draftOf(inv(r), r, currentStep(inv(r)), 'NOW', r.incumbent).text;
    expect(d).toContain('• Rank: EQIX 140 of 228');
  });
});
