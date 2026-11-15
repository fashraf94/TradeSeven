// Battle Research Slice 1 — the REFUTER round on PR A (spec docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md
// §12): one row per finding the refuter confirmed against the review round's fixes (24a1f1b6) — the
// fixes it found incomplete (BR1-1 swap-out-and-back, BR1-3, BR1-5, BR1-11, BR2-3, BR2-5, BR2-6,
// BR2-7/14) and the defects the fixes introduced (RF-2 – RF-7). Every row FAILED on 23010d10 and passes
// after the fix (the report's findings table names each fix's commit). RF-1 (the sweep's hook timeout)
// is 23010d10 itself; the sweep's plant gaps (P4 – P8) are battleResearchCopy.honesty.test.js's.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildResult, incumbentOf } from './result.js';
import {
  newInvestigation, setOrder, addCondition, currentStep, currentResult, refreshIncumbent, noticeOf, refreshGate,
} from './investigation.js';
import { explainOf, bannerOf, noteLineOf, researchRowOf, draftOf, askDraftOf, rowFactsOf } from './explain.js';
import { moveText } from './readings.js';
import { aheadWords } from './battleResearchCopy.js';
import { pctText } from '../../../screens/battleView/pctText.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

const MIN = 60_000;
const clone = (x) => JSON.parse(JSON.stringify(x));
let BATTLE;
beforeAll(async () => { BATTLE = await researchBattle(); });

const q = (changePercent, ageMin, over = {}) => ({ ...quotesBody().quotes.MSFT, changePercent, price: 100 + changePercent, priceAsOf: TAKEN_AT - ageMin * MIN, ...over });
const resultOf = (battle, { questionId = 'weakest_alternatives', quotes = quotesBody(), doc = rankingsDoc(), takenAt = TAKEN_AT, receivedAt = takenAt } = {}) => buildResult({
  battle, incumbent: questionId === 'weakest_alternatives' ? incumbentOf(battle) : null, rankingsDoc: doc, quotesBody: quotes, takenAt, receivedAt, resultId: 'r1', index: 1,
});
const invOf = (battle, opts = {}) => newInvestigation({ battleId: 'stock-battle', questionId: opts.questionId ?? 'weakest_alternatives', result: resultOf(battle, opts), at: TAKEN_AT });
const MOVE = { measure: 'today_move', direction: 'best_first' };
const RANK = { measure: 'technical_rank', direction: 'best_first' };
const bodyOf = (inv) => bannerOf(inv, currentStep(inv)).body;

describe('RF-2 / BR2-3 — an order switch says which names came and went', () => {
  it('rank → move: the not-ranked name with a move is now placed — never "the names are the same"', () => {
    let inv = invOf(BATTLE);
    expect(currentStep(inv).outcome.unranked.map((u) => u.symbol)).toContain('NOW');
    inv = setOrder(inv, MOVE, TAKEN_AT + 1);
    expect(currentStep(inv).outcome.placed.map((p) => p.symbol)).toContain('NOW');
    expect(bodyOf(inv)).not.toContain('The names and their readings are the same');
    expect(bodyOf(inv)).toContain('1 not in the rankings is now placed by today’s move');
  });
  it('move → rank: it goes back to Not ranked, and the banner says so', () => {
    let inv = setOrder(invOf(BATTLE), MOVE, TAKEN_AT + 1);
    inv = setOrder(inv, RANK, TAKEN_AT + 2);
    expect(bodyOf(inv)).not.toContain('The names and their readings are the same');
    expect(bodyOf(inv)).toContain('1 went to Not ranked (not in the rankings)');
  });
  it('move (two set aside) → rank: the two came back', () => {
    const quotes = quotesBody({ MSFT: q(1.24, 2, { changePercent: null }), ORCL: q(2.05, 3, { changePercent: null }) });
    let inv = setOrder(invOf(BATTLE, { quotes }), MOVE, TAKEN_AT + 1);
    expect(bodyOf(inv)).toContain('2 set aside, not assessed (no usable move today)');
    inv = setOrder(inv, RANK, TAKEN_AT + 2);
    expect(bodyOf(inv)).toContain('2 came back');
    expect(bodyOf(inv)).not.toContain('The names and their readings are the same');
  });
});

describe('RF-3 — the group explanation\'s counts are one partition of the group, whatever the order', () => {
  it('Rank my agent watchlist: 3 names, and the move counts cover all 3, in rank order and in move order', () => {
    let inv = invOf(BATTLE, { questionId: 'rank_agent_watchlist' });
    const rankPara = explainOf(inv, currentResult(inv), currentStep(inv)).join(' ');
    expect(rankPara).toContain('3 names on my agent watchlist.');
    expect(rankPara).toContain('3 are up today, 0 down');
    inv = setOrder(inv, MOVE, TAKEN_AT + 1);
    const movePara = explainOf(inv, currentResult(inv), currentStep(inv)).join(' ');
    expect(movePara).toContain('3 are up today, 0 down');
  });
  it('Rank my bench: a flat name and a crypto are counted, so the parts sum to the group', () => {
    const quotes = quotesBody({ ORCL: q(0.04, 3) });
    const inv = invOf(BATTLE, { questionId: 'rank_bench', quotes });
    const p = explainOf(inv, currentResult(inv), currentStep(inv)).join(' ');
    expect(p).toContain('4 names on my bench.');
    expect(p).toMatch(/1 is up today, 1 down, 1 flat, 0 without a reading yet, 1 crypto not compared/);
  });
});

describe('RF-7 — the banner\'s total is the note line\'s', () => {
  it('Agent watchlist · 3 names → "2 of 3 names placed"', () => {
    let inv = invOf(BATTLE, { questionId: 'rank_agent_watchlist' });
    inv = addCondition(inv, { id: 'eligible_now' }, TAKEN_AT + 1);
    const st = currentStep(inv);
    expect(noteLineOf(currentResult(inv), st.view, st.outcome)).toMatch(/^Agent watchlist · 3 names/);
    expect(bodyOf(inv)).toContain('2 of 3 names placed.');
  });
});

describe('RF-6 — a name a sector condition can\'t assess says why', () => {
  it('no known sector: "sector not known", never its move words', async () => {
    const b = clone(BATTLE);
    b.watchlist.hotBench = [...b.watchlist.hotBench, 'QQQX'];
    let inv = invOf(b, { questionId: 'moving_today', quotes: quotesBody({ QQQX: q(0.7, 2) }) });
    inv = addCondition(inv, { id: 'sector', value: 'Technology' }, TAKEN_AT + 1);
    const st = currentStep(inv);
    expect(st.outcome.notAssessed.map((n) => n.symbol)).toEqual(['QQQX']);
    const row = researchRowOf(inv, currentResult(inv), st, 'QQQX');
    expect(row.measureText).toContain('sector not known');
    expect(row.measureText).not.toContain('+0.7%');
  });
});

describe('BR1-5 — a hot-bench crypto can\'t replace a stock, and nothing says it can', () => {
  it('BTC against EQIX: the wrong class, in the membership, the row and the draft', () => {
    const b = clone(BATTLE);
    b.watchlist.hotBench = [...b.watchlist.hotBench, 'BTC'];
    const inv = invOf(b, { quotes: quotesBody({ BTC: q(1.5, 1) }) });
    const r = currentResult(inv);
    expect(r.membership.find((m) => m.symbol === 'BTC').eligibility).toEqual({ ok: false, reason: 'pick_wrong_class', lockedUntil: null });
    expect(rowFactsOf(b, r, 'BTC').eligibility.text).toBe('Can’t come in · a crypto can’t replace a stock');
    expect(draftOf(inv, r, currentStep(inv), 'BTC', r.incumbent).text).not.toContain('can come in now');
  });
});

describe('BR1-11 — a quote with no session date of its own', () => {
  it('is not called an earlier session\'s move, and carries its time', () => {
    const r = resultOf(BATTLE, { quotes: quotesBody({ MSFT: q(1.24, 2, { sessionEtDate: null }) }) });
    const row = r.quotes.rows.MSFT;
    expect(row.state).toBe('earlier_session'); // §4's letter: a session date that is not today's
    expect(row.words).not.toMatch(/earlier session/);
    expect(row.words).toContain('1:43 PM');
    expect(row.words).toContain('session not recorded');
  });
});

describe('BR1-1 — a holding swapped out and back is a new position, never the old comparison', () => {
  const swappedBack = () => {
    const b = clone(BATTLE);
    // EQIX swapped out and back in: a new position, no context yet; and no other holding scored yet.
    for (const tier of ['star', 'core', 'support']) {
      for (const a of b.portfolio[tier]) if (a.symbol === 'EQIX') a.positionId = 'position-eqix-2';
    }
    b.scoring.stockRewardContexts.agent = {};
    b.trades = [{ symbolOut: 'EQIX', symbolIn: 'EQIX', swappedOutAt: new Date(TAKEN_AT + 25 * MIN).toISOString() }];
    return b;
  };
  it('Refresh: no weakest (the old position is gone), not the old EQIX reading', () => {
    const inv = invOf(BATTLE);
    expect(currentResult(inv).incumbent.positionId).toBe('position-eqix');
    expect(refreshIncumbent(inv, swappedBack())).toBeNull();
  });
  it('the notice says it left and came back as a new position', () => {
    const n = noticeOf(invOf(BATTLE), swappedBack());
    expect(n?.kind).toBe('left_book');
    expect(n.text).toBe('EQIX was swapped out at 2:10 PM and is held again as a new position; this result compares with the one held then.');
  });
});

describe('BR2-6 — a notice names the day when it is not the result\'s', () => {
  it('a holding that left the next morning: "Thu 10:05 AM"', () => {
    const b = clone(BATTLE);
    for (const tier of ['star', 'core', 'support']) b.portfolio[tier] = b.portfolio[tier].filter((a) => a.symbol !== 'EQIX');
    b.trades = [{ symbolOut: 'EQIX', swappedOutAt: '2026-10-15T14:05:00.000Z' }];
    expect(noticeOf(invOf(BATTLE), b).text).toBe('EQIX left the book at Thu 10:05 AM.');
  });
});

describe('RF-4 — the lists notice names the list that changed', () => {
  it('MSFT leaves the agent watchlist but stays on the bench: "My watchlist changed … (1 out)"', () => {
    const b = clone(BATTLE);
    b.watchlist.hotBench = ['PLTR'];
    expect(noticeOf(invOf(BATTLE), b).text).toBe('My watchlist changed since this result (1 out).');
  });
});

describe('BR2-7 / BR2-14 — no rank without its time, the Ask included', () => {
  it('a rankings doc with no computedAt: the Ask\'s lines carry no rank', () => {
    const doc = { ...rankingsDoc() };
    delete doc.computedAt;
    const inv = invOf(BATTLE, { doc });
    const text = askDraftOf(inv, currentResult(inv), currentStep(inv)).text;
    expect(text).not.toMatch(/· rank \d+/);
  });
});

describe('RF-5 — a move prints as pctText prints it (BRS-8), the zero included', () => {
  it('moveText is pctText: +0.0% and −0.0% as the cockpit shows them; the decision is still the digits', () => {
    expect(moveText(0.04)).toBe(pctText(0.04));
    expect(moveText(-0.04)).toBe(pctText(-0.04));
    expect(moveText(-0.04)).toBe('−0.0%');
    const r = resultOf(BATTLE, { quotes: quotesBody({ MSFT: q(-0.04, 2) }) });
    expect(rowFactsOf(BATTLE, r, 'MSFT').move).toBe(`${pctText(-0.04)} · 1:43 PM`);
    // Zero belongs to neither: MSFT fails "down today" as printed.
    let inv = invOf(BATTLE, { quotes: quotesBody({ MSFT: q(-0.04, 2) }) });
    inv = addCondition(inv, { id: 'down_today' }, TAKEN_AT + 1);
    expect(currentStep(inv).outcome.removed.map((x) => x.symbol)).toContain('MSFT');
  });
});

describe('BR2-5 (residual) — "ahead" words never say "more" against a fall or a flat', () => {
  it('up against down, up against flat', () => {
    expect(aheadWords(0.3, -0.8, 'EQIX')).toBe('up today while EQIX is down');
    expect(aheadWords(0.1, 0, 'EQIX')).toBe('up today while EQIX is flat');
    expect(aheadWords(1.2, 0.3, 'EQIX')).toBe('up more today than EQIX');
    expect(aheadWords(-0.2, -0.8, 'EQIX')).toBe('down less today than EQIX');
  });
});

describe('BR1-3 — the client\'s clock never judges a server-stamped instant', () => {
  it('the gate takes the client\'s own instant by name (since)', () => {
    expect(refreshGate({ since: TAKEN_AT, nowMs: TAKEN_AT + 30_000 }).allowed).toBe(false);
    expect(refreshGate({ since: TAKEN_AT, nowMs: TAKEN_AT + MIN }).allowed).toBe(true);
  });
  it('"since passed" reads the server\'s now (the client 2 min ahead does not lapse a lock early)', () => {
    const b = clone(BATTLE);
    b.portfolio.bench.stocks = b.portfolio.bench.stocks.map((s) => (s.symbol === 'NVDA' ? { ...s, cooldownUntil: new Date(TAKEN_AT + MIN).toISOString() } : s));
    const r = resultOf(b, { takenAt: TAKEN_AT, receivedAt: TAKEN_AT + 2 * MIN });
    // The client reads TAKEN_AT + 2.5 min; on the server's clock that is TAKEN_AT + 30 s, before the lock lapses.
    expect(rowFactsOf(b, r, 'NVDA', { nowMs: TAKEN_AT + 2.5 * MIN }).eligibility.text).not.toContain('since passed');
    expect(rowFactsOf(b, r, 'NVDA', { nowMs: TAKEN_AT + 3.5 * MIN }).eligibility.text).toContain('since passed');
  });
});
