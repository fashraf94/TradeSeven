// Battle Research Slice 1 — the board's view model (spec docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §7,
// BRS-5, BRS-11 – BRS-16, BRS-20), pure: the rows shown before *Show all* (5 on a phone, 6 on a desktop), the
// reference line where its value falls among the SHOWN rows, the prepared conditions (the move pair off
// until one usable quote, an active condition never offered again), the banner (a Refresh report only on
// the step it was made on), the Refresh gate on the CLIENT's clock (review BR1-3), the Ask door off with
// nothing placed, the opening's list and starters, and the history's trail flags.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildResult, incumbentOf } from './result.js';
import { newInvestigation, addCondition, setOrder, undo, previous, currentStep } from './investigation.js';
import { boardOf, asTheyStandOf, startersOf, SHOWN, askAboutDraft } from './boardView.js';
import { BR_COPY } from './battleResearchCopy.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

const MIN = 60_000;
let BATTLE;
let WIDE; // the agent watchlist widened to seven placed names (AMD, CRM, ADBE added — none of them held)
beforeAll(async () => {
  BATTLE = await researchBattle();
  WIDE = await researchBattle();
  WIDE.watchlist = { ...WIDE.watchlist, hotBench: ['PLTR', 'MSFT', 'AMD', 'CRM', 'ADBE'] };
});

const extra = (symbol, technicalRank) => ({ symbol, technicalRank, technicalScore: 100 - technicalRank / 3, sectorName: 'Technology', sectorTechnicalRank: 1, sectorTechnicalTotal: 21, techRaw: { atrPercent: 2 }, arch_scores: { momentum_chaser: 80 } });
/** The rankings doc with AMD, CRM and ADBE ranked, and EQIX (the weakest) moved to one technical rank. */
const docWithEqixAt = (rank = 140) => {
  const d = rankingsDoc();
  return { ...d, stocks: [...d.stocks.map((s) => (s.symbol === 'EQIX' ? { ...s, technicalRank: rank } : s)), extra('AMD', 20), extra('CRM', 55), extra('ADBE', 95)] };
};
const resultOf = (battle, over = {}) => buildResult({
  battle, incumbent: incumbentOf(battle), rankingsDoc: docWithEqixAt(), quotesBody: quotesBody(), takenAt: TAKEN_AT, receivedAt: TAKEN_AT, resultId: 'r1', index: 1, ...over,
});
const invOf = (battle, over = {}, questionId = 'weakest_alternatives') => newInvestigation({
  battleId: 'stock-battle', questionId, result: resultOf(battle, questionId === 'weakest_alternatives' ? over : { incumbent: null, ...over }), at: TAKEN_AT,
});
const board = (inv, over = {}) => boardOf({ inv, battle: BATTLE, nowMs: TAKEN_AT + 30_000, agentName: 'Shadow', ...over });
const listKeys = (b) => b.list.map((x) => (x.kind === 'reference' ? `ref:${x.reference.symbol ?? 'EQIX'}` : x.symbol));

describe('§7 — the rows shown before Show all', () => {
  it('a phone shows 5, a desktop 6; Show all shows every placed row; the hidden count says how many', () => {
    const inv = invOf(WIDE);
    const placed = currentStep(inv).outcome.placed.map((p) => p.symbol);
    expect(placed).toEqual(['PLTR', 'NVDA', 'AMD', 'MSFT', 'CRM', 'ORCL', 'ADBE']);
    expect(SHOWN).toEqual({ phone: 5, desktop: 6 });
    const phone = board(inv);
    expect(phone.list.filter((x) => x.kind === 'row').map((x) => x.symbol)).toEqual(placed.slice(0, 5));
    expect(phone.hiddenCount).toBe(2);
    expect(phone.total).toBe(7);
    const desk = board(inv, { desktop: true });
    expect(desk.list.filter((x) => x.kind === 'row')).toHaveLength(6);
    expect(desk.hiddenCount).toBe(1);
    const all = board(inv, { showAll: true });
    expect(all.list.filter((x) => x.kind === 'row').map((x) => x.symbol)).toEqual(placed);
    expect(all.hiddenCount).toBe(0);
  });
});

describe('§7 — the reference line falls where its value falls', () => {
  it('among the shown rows: just before the first name it ranks below', () => {
    const inv = invOf(WIDE, { rankingsDoc: docWithEqixAt(50) });
    expect(listKeys(board(inv))).toEqual(['PLTR', 'NVDA', 'AMD', 'MSFT', 'ref:EQIX', 'CRM']);
  });
  it('among the names Show all hides: after the last shown row (every shown name is above it)', () => {
    const inv = invOf(WIDE, { rankingsDoc: docWithEqixAt(85) });
    expect(listKeys(board(inv))).toEqual(['PLTR', 'NVDA', 'AMD', 'MSFT', 'CRM', 'ref:EQIX']);
    expect(listKeys(board(inv, { showAll: true }))).toEqual(['PLTR', 'NVDA', 'AMD', 'MSFT', 'CRM', 'ORCL', 'ref:EQIX', 'ADBE']);
  });
  it('below every name: it trails them all', () => {
    const inv = invOf(BATTLE);
    expect(listKeys(board(inv)).at(-1)).toBe('ref:EQIX');
    expect(board(inv).list.filter((x) => x.kind === 'reference')).toHaveLength(1);
  });
});

describe('§7 — the prepared conditions', () => {
  it('the move pair is off until one usable quote, with the calendar\'s line; can come in now never is', () => {
    const weekend = quotesBody(Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, sessionEtDate: '2026-10-13' }])));
    const b = board(invOf(BATTLE, { quotesBody: weekend }));
    const byId = Object.fromEntries(b.conditions.prepared.filter((c) => c.id !== 'sector').map((c) => [c.id, c]));
    expect(byId.eligible_now).toMatchObject({ disabled: false, line: null });
    expect(byId.up_today.disabled).toBe(true);
    expect(byId.down_today.disabled).toBe(true);
    expect(byId.up_today.line).toBe('Waiting for today’s quotes');
    expect(b.toolbar.moveOrderDisabled).toBe(true);
    expect(b.toolbar.moveLine).toBe('Waiting for today’s quotes');
  });
  it('an active condition is not offered again (a sector by its value only)', () => {
    let inv = invOf(BATTLE);
    inv = addCondition(inv, { id: 'eligible_now' }, TAKEN_AT + 1);
    inv = addCondition(inv, { id: 'sector', value: 'Technology' }, TAKEN_AT + 2);
    const b = board(inv);
    expect(b.conditions.active.map((c) => c.id)).toEqual(['eligible_now', 'sector']);
    expect(b.conditions.prepared.some((c) => c.id === 'eligible_now')).toBe(false);
    expect(b.conditions.prepared.some((c) => c.id === 'sector' && c.value === 'Technology')).toBe(false);
  });
});

describe('the banner', () => {
  it('a refinement says nothing was refreshed; a Refresh report shows only on the step it was made on', () => {
    let inv = invOf(BATTLE);
    expect(board(inv).banner).toBeNull();
    inv = setOrder(inv, { measure: 'today_move', direction: 'best_first' }, TAKEN_AT + 1);
    const stepId = currentStep(inv).stepId;
    expect(board(inv).banner.kind).toBe('refinement');
    expect(board(inv).banner.body ?? board(inv).banner.title).toBeTruthy();
    const report = { stepId, label: 'Result 2 · 1:47 PM', moved: 2, in: ['JPM'], out: [], placedIn: ['JPM'], placedOut: ['ORCL'], incumbentChanged: null };
    const withReport = board(inv, { refresh: { report } });
    expect(withReport.banner).toEqual({
      kind: 'refresh', title: 'Result 2 · 1:47 PM',
      body: `${BR_COPY.refreshedBody(2, 1, 0)} ${BR_COPY.refreshedPlaced(1, 1)}`,
    });
    expect(BR_COPY.refreshedPlaced(1, 1)).toBe('1 newly placed, 1 no longer placed (left out or set aside).');
    // Another step: the report is not this step's.
    expect(board(undo(inv), { refresh: { report } }).banner?.kind ?? null).not.toBe('refresh');
  });
});

describe('BRS-14 / review BR1-3 — the Refresh gate runs on the client\'s clock (receivedAt), not the server\'s', () => {
  it('a result served 60 s ago but received 30 s ago still waits', () => {
    const inv = invOf(BATTLE, { takenAt: TAKEN_AT - 30_000, receivedAt: TAKEN_AT });
    const b = board(inv, { nowMs: TAKEN_AT + 30_000 });
    expect(b.toolbar.refresh.allowed).toBe(false);
    expect(b.toolbar.refresh.text).toMatch(/^Refresh in /);
    expect(board(inv, { nowMs: TAKEN_AT + MIN }).toolbar.refresh.allowed).toBe(true);
  });
  it('one in flight: the button says so', () => {
    expect(board(invOf(BATTLE), { nowMs: TAKEN_AT + 2 * MIN, refresh: { inFlight: true } }).toolbar.refresh).toMatchObject({ allowed: false, inFlight: true, text: BR_COPY.refreshing });
  });
});

describe('BRS-20 — the Ask door', () => {
  it('is off when nothing is placed, and costs one message when sent', () => {
    let inv = invOf(BATTLE);
    expect(board(inv).askAbout).toEqual({ label: BR_COPY.askAbout('Shadow'), cost: BR_COPY.askCost, disabled: false });
    inv = addCondition(inv, { id: 'sector', value: 'Utilities' }, TAKEN_AT + 1);
    const b = board(inv);
    expect(b.total).toBe(0);
    expect(b.askAbout.disabled).toBe(true);
    expect(b.empty).toBe(BR_COPY.emptyPlaced);
  });
  it('the draft names the question and the result time', () => {
    expect(askAboutDraft(invOf(BATTLE), TAKEN_AT + 30_000).text).toMatch(/^Research: "Compare alternatives to EQIX" \(result 1:45 PM ET\)/);
  });
});

describe('the history', () => {
  it('every step, the current one marked, and a step left by Previous off the trail', () => {
    let inv = invOf(BATTLE);
    inv = addCondition(inv, { id: 'eligible_now' }, TAKEN_AT + MIN);
    expect(undo(inv).steps).toHaveLength(1); // Undo drops a leaf step
    inv = previous(inv);
    const h = board(inv).history;
    expect(h).toHaveLength(2);
    expect(h.map((s) => [s.current, s.onTrail])).toEqual([[true, true], [false, false]]);
    expect(h[1].time).toBe('1:46 PM');
  });
});

describe('BRS-5 — the opening', () => {
  it('the as-they-stand list: loading, failed, then the union by technical rank with the unranked named', () => {
    expect(asTheyStandOf(BATTLE, { status: 'loading', result: null }).status).toBe('loading');
    expect(asTheyStandOf(BATTLE, { status: 'failed', result: null }).status).toBe('failed');
    const r = buildResult({ battle: BATTLE, incumbent: null, rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'opening' });
    const a = asTheyStandOf(BATTLE, { status: 'ready', result: r });
    expect(a.rows.map((x) => x.position)).toEqual([1, 2, 3, 4]);
    expect(a.unranked.map((u) => u.note)).toEqual([BR_COPY.notRankedCrypto, BR_COPY.notRankedMissing]);
  });
  it('the weakest starter is off with its own line when there is no weakest; What\'s moving waits for a usable quote', () => {
    const s = startersOf(BATTLE, { status: 'loading', result: null }, 'awaiting', TAKEN_AT);
    expect(s.starters.weakest_alternatives.disabled).toBe(true);
    expect(s.starters.weakest_alternatives.line).toBe(s.proposal.weakestLine);
    expect(s.starters.moving_today).toEqual({ disabled: true, line: null });
    const r = buildResult({ battle: BATTLE, incumbent: null, rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'opening' });
    const on = startersOf(BATTLE, { status: 'ready', result: r }, null, TAKEN_AT);
    expect(on.starters.weakest_alternatives).toEqual({ disabled: false, line: null });
    expect(on.starters.moving_today.disabled).toBe(false);
  });
});
