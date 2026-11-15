// Battle Research Slice 1 — sheetContext.research, built (spec docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md
// BRS-10, BRS-17 – BRS-19, §8), pure: the row that leaves the result after a step taken inside the modal
// says why in the PRINTED move with its time (a move that prints 0.0% is flat, never up or down — BRS-8),
// and only then; the ATR seed is the frozen row's (none for a name the rankings lack); the comparison
// defaults to the weakest (or, on a group question, the weakest held measured stock) and never compares a
// name with itself; Use across counts against the whole frozen group (up today in place of down today);
// the callbacks are the screen's.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildResult, incumbentOf } from './result.js';
import { newInvestigation, addCondition, setOrder, currentStep, refinementsOf } from './investigation.js';
import { BR_COPY } from './battleResearchCopy.js';
import { researchContextOf } from './researchContext.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT, RANKS_AT } from './__fixtures__/researchFixtures.js';

let BATTLE;
beforeAll(async () => { BATTLE = await researchBattle(); });

const NOW = TAKEN_AT + 30_000;
const invOf = ({ questionId = 'weakest_alternatives', quotes = quotesBody() } = {}) => newInvestigation({
  battleId: 'stock-battle', questionId, at: TAKEN_AT,
  result: buildResult({ battle: BATTLE, incumbent: questionId === 'weakest_alternatives' ? incumbentOf(BATTLE) : null, rankingsDoc: rankingsDoc(), quotesBody: quotes, takenAt: TAKEN_AT, receivedAt: TAKEN_AT, resultId: 'r1', index: 1 }),
});
const ctxOf = (inv, symbol, openedStepId = currentStep(inv).stepId, cb = {}) => researchContextOf({
  inv, symbol, openedStepId, battle: BATTLE, voice: 'Shadow · Trend Follower', agentName: 'Shadow', cb, nowMs: NOW,
});
const quoteAt = (changePercent) => ({ ...quotesBody().quotes.MSFT, changePercent, price: 100 + changePercent });

describe('BRS-18a — a row that leaves the result after a step taken inside the modal', () => {
  it('says why in the printed move, with the quote\'s time', () => {
    const inv0 = invOf();
    const opened = currentStep(inv0).stepId;
    const inv = addCondition(inv0, { id: 'down_today' }, TAKEN_AT + 1);
    expect(ctxOf(inv, 'MSFT', opened).left).toBe('MSFT is up 1.2% today (as of 1:43 PM), so “down today” leaves it out of this result.');
  });
  it('a move that prints 0.0% is flat — never "up", never "down" (BRS-8: the printed number decides)', () => {
    for (const [cp, cond] of [[0.04, 'up_today'], [-0.04, 'down_today']]) {
      const inv0 = invOf({ quotes: quotesBody({ MSFT: quoteAt(cp) }) });
      const opened = currentStep(inv0).stepId;
      const inv = addCondition(inv0, { id: cond }, TAKEN_AT + 1);
      expect(ctxOf(inv, 'MSFT', opened).left).toMatch(/^MSFT is flat at 0\.0% today \(as of 1:43 PM\), so “(up|down) today” leaves it out of this result\.$/);
    }
  });
  it('no line when the row is read at the step it was opened from, or was never placed', () => {
    const inv0 = invOf();
    const opened = currentStep(inv0).stepId;
    const inv = addCondition(inv0, { id: 'down_today' }, TAKEN_AT + 1);
    expect(ctxOf(inv, 'MSFT').left).toBeNull(); // opened at the current step
    expect(ctxOf(inv, 'NOW', opened).left).toBeNull(); // not ranked: never placed
  });
});

describe('BRS-10 — the ATR seed is the frozen row\'s', () => {
  it('the row\'s reading and the rankings\' time; none for a name the rankings lack', () => {
    const inv = invOf();
    expect(ctxOf(inv, 'MSFT').atrReading).toEqual({ pct: 1.94, asOfMs: RANKS_AT });
    expect(ctxOf(inv, 'NOW').atrReading).toEqual({ pct: null, asOfMs: null });
  });
});

describe('BRS-18 — the comparison', () => {
  it('the weakest question compares with the weakest; a name is never compared with itself', () => {
    const inv = invOf();
    const c = ctxOf(inv, 'MSFT');
    expect(c.compareDefault).toBe('EQIX');
    expect(c.incumbent.symbol).toBe('EQIX');
    expect(c.compareFor('EQIX')).not.toBeNull();
    expect(c.compareFor('NOPE')).toBeNull();
    expect(ctxOf(inv, 'EQIX').compareFor('EQIX')).toBeNull();
  });
  it('a group question: the picker lists the held measured stocks, weakest first, and defaults to the first', () => {
    const c = ctxOf(invOf({ questionId: 'rank_bench' }), 'MSFT');
    expect(c.incumbent).toBeNull();
    expect(c.holdingsForCompare[0].symbol).toBe('EQIX');
    expect(c.holdingsForCompare.map((h) => h.symbol)).not.toContain('ETH'); // crypto is never on the ladder
    expect(c.compareDefault).toBe('EQIX');
  });
  it('the draft is built against the holding shown, and against none for the holding itself', () => {
    const inv = invOf();
    expect(ctxOf(inv, 'MSFT').draftFor('EQIX').text).toMatch(/^Research: "Compare alternatives to EQIX" \(result 1:45 PM ET\)\nMSFT vs EQIX:/);
    expect(ctxOf(inv, 'EQIX').draftFor('EQIX').text).not.toContain('EQIX vs EQIX');
  });
});

describe('BRS-18a — Use across this result', () => {
  it('counts against the whole frozen group; up today stands in for down today', () => {
    const inv = addCondition(invOf(), { id: 'down_today' }, TAKEN_AT + 1);
    // With down today active, up today REPLACES it: the counts are the ones up today alone gives.
    const counts = ctxOf(inv, 'NVDA').onUseAcross('up_today');
    expect(counts).toEqual(ctxOf(invOf(), 'MSFT').onUseAcross('up_today'));
    expect(counts.remain + counts.fail + counts.notAssessed).toBeGreaterThan(0);
    expect(counts.remain).toBeGreaterThan(0); // never 0 remaining because down today was kept
  });
  it('the callbacks are the screen\'s', () => {
    const got = [];
    const c = ctxOf(invOf(), 'MSFT', undefined, { onBack: () => got.push('back'), onUndo: () => got.push('undo'), onApplyUseAcross: (id) => got.push(`apply:${id}`), onDraft: (d) => got.push(`draft:${d.text.slice(0, 9)}`) });
    c.onBack(); c.onUndo(); c.onApplyUseAcross('up_today'); c.onDraft(c.draftFor('EQIX'));
    expect(got).toEqual(['back', 'undo', 'apply:up_today', 'draft:Research:']);
  });
});

describe('review BL2-6 — the strip\'s times and group print as the row and the note print them', () => {
  it('ranks past their expiry say "older than usual"; the group says "6 names"; no time, no "— ET"', () => {
    const doc = { ...rankingsDoc(), expiresAt: { toMillis: () => RANKS_AT + 10 * 60_000 } };
    const inv = newInvestigation({ battleId: 'stock-battle', questionId: 'weakest_alternatives', at: TAKEN_AT,
      result: buildResult({ battle: BATTLE, incumbent: incumbentOf(BATTLE), rankingsDoc: doc, quotesBody: quotesBody(), takenAt: TAKEN_AT, receivedAt: TAKEN_AT, resultId: 'r1', index: 1 }) });
    const c = ctxOf(inv, 'MSFT');
    expect(c.times.text).toBe('Ranks 1:01 PM ET · older than usual · moves 1:42–1:44 PM ET');
    expect(c.group.text).toBe('Bench and agent watchlist · 6 names');
    expect(BR_COPY.ranksLine(null)).toBe('All stocks · technical rank');
    expect(BR_COPY.ranksLine('1:01 PM', true)).toBe('All stocks · technical rank · 1:01 PM ET · older than usual');
  });
});

describe('review BL2-7 — the then-chain holds every refinement, folded ones included', () => {
  it('past the step cap the strip lists refinementsOf\'s 41, not the trail\'s 39', () => {
    let inv = addCondition(invOf(), { id: 'eligible_now' }, TAKEN_AT + 1);
    for (let i = 0; i < 40; i += 1) inv = setOrder(inv, { measure: i % 2 ? 'technical_rank' : 'today_move', direction: 'best_first' }, TAKEN_AT + 2 + i);
    expect(ctxOf(inv, 'MSFT').refinements).toEqual(refinementsOf(inv));
  });
});
