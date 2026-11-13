// The research modal's questions follow the row (build prompt of Nov 13, 2026: QF-1 – QF-5), on the
// real corrected-battle harness: six measured stocks the agent holds, each with its own measured rung
// size (BOOK_STOCKS), and a crypto holding.

import { describe, it, expect, beforeAll } from 'vitest';
import { measuredBookBattle, measuredSheetBattle, BOOK_RANKINGS, BOOK_CHECK_AT, BOOK_STOCKS, SHEET_NOW, ARCHETYPES } from './__fixtures__/sheetBattles.js';
import { buildPacks, candidateItems, questionSetOf, ANCHOR_KINDS, PACK_MAX } from './packs.js';
import { bookOf, rankedBook, weakestOf, offLadderOf, unscoredOf, lockNowOf } from './book.js';
import { SHEET_COPY } from './sheetCopy.js';
import { verifyResearchItems } from '../../../../api/_utils/researchAsk.js';

const NOW = Date.parse('2026-10-14T17:07:00.000Z');
let BOOK;
beforeAll(async () => { BOOK = await measuredBookBattle(); });
const posOf = (battle, sym) => bookOf(battle).find((e) => e.symbol === sym);
const args = (battle, sym, over = {}) => {
  const pos = posOf(battle, sym);
  return { battle, symbol: sym, nowMs: NOW, row: pos?.positionId ? { positionId: pos.positionId } : {}, live: pos?.context?.currentPrice ?? 300, rankings: BOOK_RANKINGS, standing: null, incumbent: null, battleId: 'stock-battle', ...over };
};
const factOf = (battle, sym, kind, over) => candidateItems(args(battle, sym, over)).items.find((i) => i.kind === kind)?.fact;

describe('QF-1 — the question set follows the row', () => {
  it('a held stock UP from entry at the last check: Should we take profit? first, then the standing two', () => {
    expect(questionSetOf(args(BOOK, 'AAPL'))).toEqual({ questions: ['take_profit', 'catch_up', 'protect_lead'], notOnLadder: false });
    expect(questionSetOf(args(BOOK, 'XOM')).questions[0]).toBe('take_profit');
  });
  it('a held stock DOWN from entry: Is this our weakest spot? first', () => {
    expect(questionSetOf(args(BOOK, 'EQIX'))).toEqual({ questions: ['weakest_spot', 'catch_up', 'protect_lead'], notOnLadder: false });
    // Not the weakest, still down: the same question (it asks whether it is).
    expect(questionSetOf(args(BOOK, 'CAT')).questions[0]).toBe('weakest_spot');
  });
  it('a bench name (not held): Is this better than our weakest holding? first (the stored id better_than_stalled — QF-5)', () => {
    expect(questionSetOf(args(BOOK, 'MSFT'))).toEqual({ questions: ['better_than_stalled', 'catch_up', 'protect_lead'], notOnLadder: false });
  });
  it('leading: the standing two in standing order after the row\'s own question', () => {
    const lead = { player: 70, opponent: 60, digits: 0, you: '+70', them: '+60', lead: 'player' };
    expect(questionSetOf(args(BOOK, 'AAPL', { standing: lead })).questions).toEqual(['take_profit', 'protect_lead', 'catch_up']);
    expect(questionSetOf(args(BOOK, 'MSFT', { standing: lead })).questions).toEqual(['better_than_stalled', 'protect_lead', 'catch_up']);
  });
  it('a held crypto, and a held stock in a legacy-scored battle: the standing two only, and the line', () => {
    expect(questionSetOf(args(BOOK, 'ETH', { row: { positionId: 'position-eth' } }))).toEqual({ questions: ['catch_up', 'protect_lead'], notOnLadder: true });
    const legacy = JSON.parse(JSON.stringify(BOOK));
    delete legacy.scoring.stockThresholdModel;
    expect(questionSetOf(args(legacy, 'AAPL'))).toEqual({ questions: ['catch_up', 'protect_lead'], notOnLadder: true });
  });
  it('exactly at entry, or no committed context yet: not up — weakest_spot (the rule\'s "else")', () => {
    const flat = JSON.parse(JSON.stringify(BOOK));
    delete flat.scoring.stockRewardContexts.agent[posOf(BOOK, 'AAPL').positionId];
    expect(questionSetOf(args(flat, 'AAPL', { row: { positionId: posOf(BOOK, 'AAPL').positionId } })).questions[0]).toBe('weakest_spot');
  });
});

describe('QF-2 — "weakest" in rungs from entry, the game\'s own unit', () => {
  it('the six-stock book ranks EQIX −0.4, KO −0.3, CAT −0.1, JPM +0.2, XOM +0.6, AAPL +1.3; ETH (crypto) is not ranked', () => {
    const book = bookOf(BOOK);
    expect(rankedBook(book).map((e) => [e.symbol, e.rungsShown])).toEqual([['EQIX', -0.4], ['KO', -0.3], ['CAT', -0.1], ['JPM', 0.2], ['XOM', 0.6], ['AAPL', 1.3]]);
    expect(weakestOf(book).symbol).toBe('EQIX');
    expect(offLadderOf(book)).toEqual(['ETH']);
  });
  it('rungs, not raw %: KO is the lowest by % from entry (−1.2 %), EQIX by rungs (its rung is 1 %, KO\'s 4 %)', () => {
    const pct = (e) => ((e.context.currentPrice - e.context.fill) / e.context.fill) * 100;
    const byPct = [...rankedBook(bookOf(BOOK))].sort((a, b) => pct(a) - pct(b));
    expect(byPct[0].symbol).toBe('KO');
    expect(weakestOf(bookOf(BOOK)).symbol).toBe('EQIX');
  });
  it('on screen: "EQIX is −0.4 rungs from entry, the lowest of your 6 stocks · at the Wed 12:45 check", ETH named off the ladder', () => {
    expect(factOf(BOOK, 'EQIX', 'book_rank')).toBe('EQIX is −0.4 rungs from entry, the lowest of your 6 stocks · at the Wed 12:45 check · not on the ladder: ETH');
    expect(factOf(BOOK, 'KO', 'book_rank')).toBe('KO is −0.3 rungs from entry, the 2nd lowest of your 6 stocks; the lowest is EQIX at −0.4 · at the Wed 12:45 check · not on the ladder: ETH');
  });
  it('a tie on the printed number goes to the one nearer its next downside rung, in rungs (both print −0.4)', async () => {
    // KO moved to −0.44 rungs (prints −0.4, like EQIX's −0.42). Both are 0.56–0.58 rungs above Bust; KO's −0.44 is nearer.
    const ko = BOOK_STOCKS_WITH({ KO: -0.44 });
    const b = await measuredBookBattle({ stocks: ko });
    expect(rankedBook(bookOf(b)).slice(0, 2).map((e) => [e.symbol, e.rungsShown])).toEqual([['KO', -0.4], ['EQIX', -0.4]]);
  });
  it('crypto and legacy are never ranked, even when every measured stock is up (a not-on-ladder name is never "lowest")', async () => {
    const up = BOOK_STOCKS_WITH({ EQIX: 0.3, KO: 0.4, CAT: 0.5 });
    const b = await measuredBookBattle({ stocks: up });
    const book = bookOf(b);
    expect(weakestOf(book).symbol).toBe('JPM');
    expect(rankedBook(book).map((e) => e.symbol)).not.toContain('ETH');
    // A legacy-scored battle: nothing on the ladder, nothing ranked, no book item.
    const legacy = JSON.parse(JSON.stringify(b));
    delete legacy.scoring.stockThresholdModel;
    expect(rankedBook(bookOf(legacy))).toEqual([]);
    expect(factOf(legacy, 'MSFT', 'book_rank')).toBeUndefined();
  });
});

describe('QF-3 — Is this our weakest spot?', () => {
  it('EQIX\'s pack: its place, its move, its quiet count against the rotation rule, the best AVAILABLE bench name with its rank and rung size', () => {
    const pack = buildPacks(args(BOOK, 'EQIX')).packs.weakest_spot;
    expect(pack.items.map((i) => i.kind).sort()).toEqual(['bench_alternative', 'book_rank', 'move_since_entry', 'quiet_ticks']);
    expect(factOf(BOOK, 'EQIX', 'quiet_ticks')).toBe('EQIX: 4 quiet checks in a row; Trend Follower counts a name stalled at 5');
    // NVDA ranks higher (91) but is cooling down until tomorrow: ORCL is the best that can come in.
    expect(factOf(BOOK, 'EQIX', 'bench_alternative')).toBe('Best on the bench by Trend Follower’s ranking: ORCL 85 (#2 of 5) · estimated rung size: ATR reading 2.8% (rankings as of Wed 10/14)');
  });
  it('Capital Preserver: "doesn\'t rotate out of quiet names"; its own ranking picks the bench name', async () => {
    const g = await measuredBookBattle({ archetype: 'guardian' });
    expect(factOf(g, 'EQIX', 'quiet_ticks')).toBe('Capital Preserver doesn’t rotate out of quiet names');
    expect(factOf(g, 'EQIX', 'bench_alternative')).toBe('Best on the bench by Capital Preserver’s ranking: MSFT 72 (#1 of 5) · estimated rung size: ATR reading 1.9% (rankings as of Wed 10/14)');
  });
  it('rankings older than BS-4\'s 96-hour window: the bench name keeps its rank, the rung size is dropped', () => {
    const old = { ...BOOK_RANKINGS, computedAt: { seconds: (NOW - 97 * 3600 * 1000) / 1000 } };
    expect(factOf(BOOK, 'EQIX', 'bench_alternative', { rankings: old })).toBe('Best on the bench by Trend Follower’s ranking: ORCL 85 (#2 of 5) (rankings as of Sat 10/10)');
  });
});

describe('QF-4 — Should we take profit?', () => {
  it('the lock equals QF-0\'s rule, worked by hand on a decimal fixture with a crossed DOWNSIDE rung', async () => {
    // KO (support ×1, fill $61.20, rung 4 %): an 11:15 check at $58.70 crossed Bust (≤ $58.752); the 12:45 check at
    // $63.97 crossed BaggerBomb (≥ $63.648). Gain 2.77 / 61.20 = 4.52614 % → base 45.26 → 45; rungs +15 − 10.
    const b = await measuredBookBattle({ checks: [
      { at: '2026-10-14T15:15:40.000Z', quoteAt: Date.parse('2026-10-14T15:15:31.000Z') / 1000, quotes: { KO: 58.7 } },
      { at: BOOK_CHECK_AT, quoteAt: Date.parse('2026-10-14T16:45:31.000Z') / 1000, quotes: { KO: 63.97 } },
    ] });
    const ko = posOf(b, 'KO');
    expect(ko.context.crossedTiers.sort()).toEqual(['bagger', 'bust']);
    expect(lockNowOf(ko)).toMatchObject({ total: 50, gain: 45, banked: 15, hit: -10, price: 63.97 });
    expect(factOf(b, 'KO', 'lock_now')).toBe('Swapped out at the Wed 12:45 check’s $63.97, it would lock +50: +45 from the gain, +15 banked, −10 from downside rungs');
    expect(questionSetOf(args(b, 'KO')).questions[0]).toBe('take_profit');
  });
  it('AAPL (star ×2, fill $100.75, scored $103.41): +53 from the gain (2.66 / 100.75 × 100 × 10 × 2 = 52.8), +15 banked', () => {
    expect(factOf(BOOK, 'AAPL', 'lock_now')).toBe('Swapped out at the Wed 12:45 check’s $103.41, it would lock +68: +53 from the gain, +15 banked');
  });
  it('what holding risks, in displayed values: the way back to entry and to the next downside rung (toGoDown)', () => {
    expect(factOf(BOOK, 'AAPL', 'rung_down', { live: 103.2 })).toBe('$2.45 (2.37%) down to entry at $100.75 · $4.47 (4.33%) down to the next downside rung, Bust (−10) at $98.73');
  });
  it('the pack holds the lock and the downside for every archetype — never cut for the loop items (ANCHOR_KINDS)', async () => {
    const base = await measuredSheetBattle();
    for (const a of ARCHETYPES) {
      const battle = { ...base, agentContext: { ...base.agentContext, archetype: a } };
      const p = buildPacks({ battle, symbol: 'AAPL', nowMs: SHEET_NOW, row: { positionId: 'position-agent' }, live: 103.2, rankings: BOOK_RANKINGS, directive: battle.directive, battleId: 'stock-battle' }).packs;
      for (const q of ['take_profit', 'weakest_spot']) {
        expect(p[q].items.length).toBeLessThanOrEqual(PACK_MAX);
        for (const k of ANCHOR_KINDS[q]) if (k !== 'bench_alternative') expect(p[q].items.map((i) => i.kind), `${a} ${q} ${k}`).toContain(k);
      }
    }
  });
});

describe('QF-5 — Is this better than our weakest holding?', () => {
  it('no incumbent: compared with QF-2\'s weakest (EQIX), in the place and the rankings', () => {
    const items = candidateItems(args(BOOK, 'MSFT')).items;
    expect(items.find((i) => i.kind === 'book_rank').symbol).toBe('EQIX');
    expect(items.find((i) => i.kind === 'rank_scores').fact).toBe('Trend Follower’s ranking: MSFT 72 · EQIX 42 (rankings as of Wed 10/14)');
  });
  it('the bench door\'s incumbent is the compare when one was passed (no weakest item then)', () => {
    const items = candidateItems(args(BOOK, 'MSFT', { incumbent: 'AAPL' })).items;
    expect(items.find((i) => i.kind === 'incumbent').symbol).toBe('AAPL');
    expect(items.find((i) => i.kind === 'book_rank')).toBeUndefined();
    expect(items.find((i) => i.kind === 'rank_scores').fact).toBe('Trend Follower’s ranking: MSFT 72 · AAPL 78 (rankings as of Wed 10/14)');
  });
  it('the stalled list joins only when the archetype rotates', async () => {
    expect(candidateItems(args(BOOK, 'MSFT')).items.map((i) => i.kind)).toContain('stalled');
    const g = await measuredBookBattle({ archetype: 'guardian' });
    expect(candidateItems(args(g, 'MSFT')).items.map((i) => i.kind)).not.toContain('stalled');
  });
});

/** BOOK_STOCKS with some names moved to other rungs-from-entry targets. */
function BOOK_STOCKS_WITH(moves) {
  return BOOK_STOCKS.map((s) => (Object.hasOwn(moves, s.symbol) ? { ...s, rungs: moves[s.symbol] } : s));
}

describe('the review round (PR 1 §2 review: A1, A2, A3, A6, A9, C2)', () => {
  it('A1 (refuted, the letter kept) — up means gain > 0: +0.03 rungs (prints 0.0) is up; −0.03 is not', async () => {
    const flat = await measuredBookBattle({ stocks: BOOK_STOCKS_WITH({ AAPL: 0.03 }) });
    expect(posOf(flat, 'AAPL').rungsShown).toBe(0);
    expect(posOf(flat, 'AAPL').rungs).toBeGreaterThan(0);
    expect(questionSetOf(args(flat, 'AAPL')).questions[0]).toBe('take_profit');
    const down = await measuredBookBattle({ stocks: BOOK_STOCKS_WITH({ AAPL: -0.03 }) });
    expect(questionSetOf(args(down, 'AAPL')).questions[0]).toBe('weakest_spot');
  });
  it('A2 — an incumbent the agent no longer holds is no incumbent: the compare is the weakest holding', () => {
    const items = candidateItems(args(BOOK, 'MSFT', { incumbent: 'TSLA' })).items;
    expect(items.find((i) => i.kind === 'incumbent')).toBeUndefined();
    expect(items.find((i) => i.kind === 'book_rank').symbol).toBe('EQIX');
    expect(items.find((i) => i.kind === 'rank_scores').fact).toBe('Trend Follower’s ranking: MSFT 72 · EQIX 42 (rankings as of Wed 10/14)');
  });
  it('A3 — a held measured stock the check could not score is named, so the count is never short', () => {
    // (Deleting one context breaks the committed content for all, so the case is built on the pure book.)
    const book = bookOf(BOOK).map((e) => (e.symbol === 'CAT' ? { ...e, scored: false } : e));
    expect(rankedBook(book).map((e) => e.symbol)).not.toContain('CAT');
    expect(SHEET_COPY.bookRank('EQIX', '−0.4', 1, 5, 'EQIX', '−0.4', 'Wed 12:45', ['ETH'], ['CAT'])).toBe('EQIX is −0.4 rungs from entry, the lowest of your 5 stocks · at the Wed 12:45 check · no check yet: CAT · not on the ladder: ETH');
    expect(unscoredOf(book)).toEqual(['CAT']);
  });
  it('A6 — the bench rank is the printed score\'s: 84.6 and 84.9 both print 85 and share #2', () => {
    const tie = { ...BOOK_RANKINGS, stocks: [...BOOK_RANKINGS.stocks, { symbol: 'IBM', arch_scores: { momentum_chaser: 84.9 } }] };
    expect(factOf(BOOK, 'EQIX', 'bench_alternative', { rankings: tie })).toMatch(/ORCL 85 \(#2 of 6\)/);
  });
  it('A9 — the top of the book reads "the highest", never "the 6th lowest of your 6"', () => {
    expect(factOf(BOOK, 'AAPL', 'book_rank')).toBe('AAPL is +1.3 rungs from entry, the highest of your 6 stocks; the lowest is EQIX at −0.4 · at the Wed 12:45 check · not on the ladder: ETH');
  });
  it('C2 — the CPU\'s row of a ticker the agent holds: never compared with itself; the server verifies its true items', async () => {
    // EQIX is the agent's weakest; the CPU's row of EQIX (not the agent's position) compares with the NEXT weakest.
    const items = candidateItems(args(BOOK, 'EQIX', { row: { posKey: 'cpu:star:0' } })).items;
    expect(items.find((i) => i.kind === 'book_rank').symbol).toBe('KO');
    const sent = items.filter((i) => i.kind === 'book_rank' || i.kind === 'rung_compare');
    expect(sent.map((i) => i.kind).sort()).toEqual(['book_rank', 'rung_compare']);
    const out = verifyResearchItems({ battle: BOOK, ask: { symbol: 'EQIX', questionId: 'better_than_stalled', items: sent }, nowMs: NOW });
    expect(out.map((i) => i.status)).toEqual(['verified', 'verified']);
  });
});

