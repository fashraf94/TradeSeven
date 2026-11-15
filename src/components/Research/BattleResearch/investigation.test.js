// Battle Research Slice 1 — the investigation's pure reducers (BRS-13, BRS-14, BRS-21, §6): steps
// and their wording, Undo and Previous step, the up/down replacement as one step, the weakest fixed
// until Refresh, a refresh as a NEW result (re-selecting the weakest on the weakest question only),
// the refresh gate, the notices that never reorder, and the caps.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildResult, incumbentOf, outcomeOf } from './result.js';
import {
  newInvestigation, currentStep, currentResult, trailOf, refinementsOf, titleOf, setOrder, addCondition, removeCondition, switchGroup, acrossCondition,
  undo, previous, goTo, refreshWith, refreshReport, refreshIncumbent, noticeOf, addInvestigation, refreshGate, CAPS, REFRESH_COOLDOWN_MS,
} from './investigation.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT, KO_WEAKEST_CHECKS } from './__fixtures__/researchFixtures.js';

const MIN = 60_000;
let BATTLE;
let LATER; // the same battle after a 2:15 PM check that makes KO the weakest
beforeAll(async () => { BATTLE = await researchBattle(); LATER = await researchBattle({}, { checks: KO_WEAKEST_CHECKS }); });
const clone = (x) => JSON.parse(JSON.stringify(x));
const result = (battle = BATTLE, over = {}) => buildResult({ battle, incumbent: incumbentOf(battle), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'r1', index: 1, ...over });
const weakestInv = () => newInvestigation({ battleId: 'stock-battle', agent: { agentId: 'a1', agentName: 'Shadow', archetype: 'momentum_chaser', scoringModel: 'measured' }, questionId: 'weakest_alternatives', result: result(), at: TAKEN_AT });
const placed = (inv) => currentStep(inv).outcome.placed.map((p) => p.symbol);
const MOVE = { measure: 'today_move', direction: 'best_first' };

describe('§6 — a new investigation', () => {
  it('its id, its question set once, its first step, its result', () => {
    const inv = weakestInv();
    expect(inv.investigationId).toBe(`inv-stock-battle-${TAKEN_AT}`);
    expect(inv.question).toMatchObject({ id: 'weakest_alternatives', text: 'Find alternatives to our weakest holding', incumbent: { symbol: 'EQIX' } });
    expect(inv.steps).toHaveLength(1);
    expect(currentStep(inv)).toMatchObject({ stepId: 's1', parentStepId: null, kind: 'question', resultId: 'r1', view: { group: 'union', order: { measure: 'technical_rank' }, conditions: [] } });
    expect(titleOf(inv)).toBe('Compare alternatives to EQIX');
    expect(Object.keys(inv.results)).toEqual(['r1']);
  });
  it('the group questions open on their own group; What\'s moving orders the union by today\'s move', () => {
    const mk = (questionId) => newInvestigation({ battleId: 'b', questionId, result: result(BATTLE, { incumbent: null }), at: TAKEN_AT });
    expect(currentStep(mk('rank_bench')).view.group).toBe('bench');
    expect(currentStep(mk('rank_agent_watchlist')).view.group).toBe('agent_watchlist');
    expect(currentStep(mk('moving_today')).view).toMatchObject({ group: 'union', order: MOVE });
    expect(titleOf(mk('rank_bench'))).toBe('Rank my bench');
  });
});

describe('BRS-13 — steps, each with its own wording; the trail', () => {
  it('order, condition, removal: each a step, worded *then: …*, the weakest unchanged throughout', () => {
    let inv = weakestInv();
    inv = setOrder(inv, MOVE, TAKEN_AT + 1);
    inv = addCondition(inv, { id: 'eligible_now' }, TAKEN_AT + 2);
    inv = removeCondition(inv, 'eligible_now', TAKEN_AT + 3);
    expect(inv.steps.map((s) => s.kind)).toEqual(['question', 'order', 'condition_add', 'condition_remove']);
    expect(refinementsOf(inv)).toEqual(["then: ordered by today's move", 'then: only names that can come in now', 'then: without only names that can come in now']);
    expect(new Set(inv.steps.map((s) => s.resultId))).toEqual(new Set(['r1']));
    expect(currentResult(inv).incumbent.symbol).toBe('EQIX');
  });
  it('no step when nothing changes (the same order, a condition already active)', () => {
    const inv = weakestInv();
    expect(setOrder(inv, { measure: 'technical_rank', direction: 'best_first' }, 1)).toBe(inv);
    const once = addCondition(inv, { id: 'eligible_now' }, 1);
    expect(addCondition(once, { id: 'eligible_now' }, 2)).toBe(once);
  });
  it('rows that moved carry was #n against the step before, on the same result', () => {
    const inv = addCondition(weakestInv(), { id: 'eligible_now' }, 1);
    expect(currentStep(inv).outcome.placed).toEqual([{ symbol: 'PLTR', position: 1 }, { symbol: 'MSFT', position: 2, wasPosition: 3 }, { symbol: 'ORCL', position: 3, wasPosition: 4 }]);
  });
  it('UP AND DOWN ARE EXCLUSIVE: the replacement is ONE step, worded as one, and both stay in the history', () => {
    let inv = addCondition(weakestInv(), { id: 'up_today' }, 1);
    expect(placed(inv)).not.toContain('NVDA');
    inv = addCondition(inv, { id: 'down_today' }, 2);
    expect(currentStep(inv).wording).toBe('then: down today, in place of up today');
    expect(currentStep(inv).view.conditions).toEqual([{ id: 'down_today' }]);
    // The whole frozen group: the falling name up today had removed comes back.
    expect(placed(inv)).toEqual(['NVDA']);
    expect(trailOf(inv).map((s) => s.wording)).toEqual(['Find alternatives to our weakest holding', 'then: up today', 'then: down today, in place of up today']);
  });
  it('the sector is one at a time, the same way', () => {
    let inv = addCondition(weakestInv(), { id: 'sector', value: 'Technology' }, 1);
    inv = addCondition(inv, { id: 'sector', value: 'Energy' }, 2);
    expect(currentStep(inv).view.conditions).toEqual([{ id: 'sector', value: 'Energy' }]);
    expect(currentStep(inv).wording).toBe('then: only Energy, in place of only Technology');
  });
  it('Use across this result is a step of its own kind, and says what it replaced', () => {
    let inv = addCondition(weakestInv(), { id: 'down_today' }, 1);
    inv = acrossCondition(inv, 'up_today', 2);
    expect(currentStep(inv)).toMatchObject({ kind: 'use_across', wording: 'then: up today, in place of down today, from a stock’s finding' });
  });
  it('the group switch on a group question; the union (weakest) never switches', () => {
    const g = newInvestigation({ battleId: 'b', questionId: 'rank_bench', result: result(BATTLE, { incumbent: null }), at: TAKEN_AT });
    const s = switchGroup(g, 'agent_watchlist', 1);
    expect(currentStep(s)).toMatchObject({ kind: 'group', wording: 'then: the same question on my agent watchlist', view: { group: 'agent_watchlist' } });
    expect(switchGroup(weakestInv(), 'bench', 1).steps).toHaveLength(1);
  });
});

describe('BRS-13 — Undo, Previous step, the history', () => {
  it('Undo goes back to the parent and drops the leaf it leaves', () => {
    let inv = setOrder(weakestInv(), MOVE, 1);
    inv = addCondition(inv, { id: 'eligible_now' }, 2);
    inv = undo(inv);
    expect(inv.steps.map((s) => s.kind)).toEqual(['question', 'order']);
    expect(currentStep(inv).kind).toBe('order');
    expect(undo(undo(inv)).steps).toHaveLength(1);
    expect(undo(undo(undo(inv))).steps).toHaveLength(1); // the question stays
  });
  it('Previous step moves the cursor up and keeps the step; tapping a step in the history returns to it', () => {
    let inv = setOrder(weakestInv(), MOVE, 1);
    inv = addCondition(inv, { id: 'eligible_now' }, 2);
    const back = previous(inv);
    expect(back.steps).toHaveLength(3);
    expect(currentStep(back).kind).toBe('order');
    expect(currentStep(goTo(back, 's3')).kind).toBe('condition_add');
  });
  it('a new step from an earlier cursor branches (its parent is the cursor); the trail follows the cursor', () => {
    let inv = addCondition(setOrder(weakestInv(), MOVE, 1), { id: 'eligible_now' }, 2);
    inv = addCondition(previous(inv), { id: 'up_today' }, 3);
    expect(currentStep(inv).parentStepId).toBe('s2');
    expect(trailOf(inv).map((s) => s.stepId)).toEqual(['s1', 's2', 's4']);
  });
});

describe('BRS-14 — Refresh makes a NEW result; the weakest is re-selected on the weakest question only', () => {
  it('a new resultId and label, the same question and refinements, the old result kept in the trail', () => {
    let inv = addCondition(weakestInv(), { id: 'eligible_now' }, 1);
    const r2 = buildResult({ battle: BATTLE, incumbent: refreshIncumbent(inv, BATTLE), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT + 20 * MIN, resultId: 'r2', index: 2 });
    inv = refreshWith(inv, r2, TAKEN_AT + 20 * MIN);
    expect(currentStep(inv)).toMatchObject({ kind: 'refresh', resultId: 'r2', wording: 'then: refreshed · Result 2 · 2:05 PM', view: { conditions: [{ id: 'eligible_now' }] } });
    expect(Object.keys(inv.results)).toEqual(['r1', 'r2']);
    expect(trailOf(inv).map((s) => s.resultId)).toEqual(['r1', 'r1', 'r2']);
  });
  it('what a refresh changed: positions moved, names in and out', () => {
    const r1 = result();
    const o1 = outcomeOf(r1, { group: 'union', order: { measure: 'technical_rank', direction: 'best_first' }, conditions: [] });
    const later = clone(BATTLE);
    later.watchlist.hotBench = ['MSFT', 'XYZ'];
    const r2 = buildResult({ battle: later, incumbent: incumbentOf(later), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT + 5 * MIN, resultId: 'r2', index: 2 });
    const o2 = outcomeOf(r2, { group: 'union', order: { measure: 'technical_rank', direction: 'best_first' }, conditions: [] });
    expect(refreshReport(r1, o1, r2, o2)).toMatchObject({ in: ['XYZ'], out: ['PLTR'], incumbentChanged: null });
    expect(refreshReport(r1, o1, r2, o2).moved).toBe(3); // NVDA, MSFT and ORCL each move up a place with PLTR gone
  });
  it('the weakest is re-selected on the weakest question; a group question keeps its own compare context', () => {
    // After the 2:15 check KO is the weakest: the weakest question re-selects it (a new title) …
    const inv = weakestInv();
    expect(refreshIncumbent(inv, LATER)?.symbol).toBe('KO');
    const r2 = buildResult({ battle: LATER, incumbent: refreshIncumbent(inv, LATER), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT + 40 * MIN, resultId: 'r2', index: 2 });
    expect(titleOf(refreshWith(inv, r2, TAKEN_AT + 40 * MIN))).toBe('Compare alternatives to KO');
    // … and a group question keeps its own context (none here; never the weakest by another route).
    const group = newInvestigation({ battleId: 'b', questionId: 'rank_bench', result: result(BATTLE, { incumbent: null }), at: TAKEN_AT });
    expect(refreshIncumbent(group, LATER)).toBeNull();
  });
  it('the refresh gate: one in flight, once a minute (a failed attempt counts), the time left as m:ss', () => {
    expect(refreshGate({ inFlight: true, takenAt: 0, nowMs: 10 * MIN })).toMatchObject({ allowed: false, reason: 'in_flight' });
    expect(refreshGate({ takenAt: TAKEN_AT, nowMs: TAKEN_AT + 18_000 })).toEqual({ allowed: false, reason: 'cooldown', remainingMs: 42_000, text: '0:42' });
    expect(refreshGate({ takenAt: TAKEN_AT, nowMs: TAKEN_AT + REFRESH_COOLDOWN_MS }).allowed).toBe(true);
    expect(refreshGate({ takenAt: TAKEN_AT - 5 * MIN, lastAttemptAt: TAKEN_AT, nowMs: TAKEN_AT + 1000 })).toMatchObject({ allowed: false, text: '0:59' });
  });
});

describe('BRS-14 — notices: one quiet line, never a reorder', () => {
  it('nothing seen: no notice', () => {
    expect(noticeOf(weakestInv(), BATTLE)).toBeNull();
  });
  it('a newer check that names a new weakest: the notice says so and that this result still compares with EQIX', () => {
    const inv = weakestInv();
    expect(noticeOf(inv, LATER)).toEqual({ kind: 'new_check', text: 'A newer check at 2:15 PM: KO is now our weakest. This result still compares with EQIX.' });
    // The result's order is untouched.
    expect(placed(inv)).toEqual(['PLTR', 'NVDA', 'MSFT', 'ORCL']);
  });
  it('the incumbent left the book: named with the swap\'s time', () => {
    const later = clone(BATTLE);
    const tier = ['star', 'core', 'support'].find((t) => later.portfolio[t].some((a) => a.symbol === 'EQIX'));
    later.portfolio[tier] = later.portfolio[tier].filter((a) => a.symbol !== 'EQIX');
    later.trades = [{ symbolOut: 'EQIX', symbolIn: 'MSFT', swappedOutAt: '2026-10-14T18:10:00.000Z' }];
    expect(noticeOf(weakestInv(), later)).toEqual({ kind: 'left_book', text: 'EQIX left the book at 2:10 PM.' });
  });
  it('the lists changed: counted in and out', () => {
    const later = clone(BATTLE);
    later.watchlist = { hotBench: ['MSFT', 'XYZ', 'QQQ'], lastRefreshed: '2026-10-14T18:01:00.000Z' };
    expect(noticeOf(weakestInv(), later)).toEqual({ kind: 'lists', text: 'My watchlist changed at 2:01 PM (2 in, 1 out).' });
  });
});

describe('BRS-21 — caps', () => {
  it('40 steps an investigation: the oldest step off the trail goes first, and the history says so', () => {
    let inv = weakestInv();
    for (let i = 0; i < 45; i += 1) inv = i % 2 ? removeCondition(inv, 'eligible_now', i) : addCondition(inv, { id: 'eligible_now' }, i);
    expect(inv.steps).toHaveLength(CAPS.steps);
    expect(inv.droppedSteps).toBe(6);
    expect(inv.steps[0].kind).toBe('question');
    // The trail still walks from the question to the cursor.
    expect(trailOf(inv)[0].stepId).toBe('s1');
    expect(trailOf(inv).at(-1)).toBe(currentStep(inv));
  });
  it('10 investigations a battle session: the oldest goes, counted', () => {
    let session = { list: [], dropped: 0 };
    for (let i = 0; i < 12; i += 1) session = addInvestigation(session, { ...weakestInv(), investigationId: `inv-${i}` });
    expect(session.list.map((x) => x.investigationId)).toEqual(['inv-2', 'inv-3', 'inv-4', 'inv-5', 'inv-6', 'inv-7', 'inv-8', 'inv-9', 'inv-10', 'inv-11']);
    expect(session.dropped).toBe(2);
    expect(session.activeId).toBe('inv-11');
  });
});
