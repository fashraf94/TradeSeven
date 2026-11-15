// Battle Research Slice 1 — what the agent says, from the frozen result alone (BRS-5, BRS-13,
// BRS-15 – BRS-20, §9): the proposal and its two no-weakest cases, the explanation (only
// evidence-backed sentences; the keep line always on the weakest question), the banner, a row's
// facts, the modal's research row and comparison, the draft (every reading with its time, nothing
// missing written as zero, under the chat's limit with the trim order) and the Ask's top names.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildResult, incumbentOf } from './result.js';
import { newInvestigation, addCondition, setOrder, currentStep } from './investigation.js';
import {
  proposalOf, explainOf, bannerOf, rowFactsOf, researchRowOf, compareOf, draftOf, askDraftOf, referenceOf, noteLineOf, eligibilityLabel,
  fitDraft, companyNameOf, moveLineOf, availabilityOf, CHAT_MAX_LENGTH,
} from './explain.js';
import { clockRange } from './battleResearchCopy.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

const MIN = 60_000;
let BATTLE;
beforeAll(async () => { BATTLE = await researchBattle(); });
const clone = (x) => JSON.parse(JSON.stringify(x));
const res = (over = {}, battle = BATTLE) => buildResult({ battle, incumbent: incumbentOf(battle), rankingsDoc: rankingsDoc(), quotesBody: quotesBody(), takenAt: TAKEN_AT, resultId: 'r1', ...over });
const inv = (r = res(), questionId = 'weakest_alternatives') => newInvestigation({ battleId: 'b', questionId, result: r, at: TAKEN_AT });

describe('BRS-5 / BRS-6 — the proposal', () => {
  it('names the weakest holding, its check time and its rungs from entry', () => {
    expect(proposalOf(BATTLE, TAKEN_AT)).toMatchObject({
      kind: 'weakest',
      text: 'EQIX is our weakest holding at the 12:45 check, −0.4 rungs from entry. I can line up the bench and my watchlist against it by technical rank, with today’s move beside each name.',
    });
  });
  it('awaiting the first check names the next check; the not-measured cases never mention one', () => {
    const fresh = clone(BATTLE);
    fresh.scoring.stockRewardContexts.agent = {};
    const awaiting = proposalOf(fresh, TAKEN_AT);
    expect(awaiting.kind).toBe('awaiting');
    expect(awaiting.text).toMatch(/^Our holdings are ranked at the next check \(\d{1,2}:\d{2} (AM|PM)\)\. Until then I can rank the bench or my watchlist\.$/);
    const legacy = clone(BATTLE);
    delete legacy.scoring.stockThresholdModel;
    const crypto = clone(BATTLE);
    crypto.portfolio = { ...crypto.portfolio, star: [], core: [], support: [{ symbol: 'ETH', isCrypto: true }] };
    expect(proposalOf(legacy, TAKEN_AT).text).toBe('This battle doesn’t score holdings in rungs, so there’s no weakest holding to compare against. I can rank the bench or my watchlist instead.');
    expect(proposalOf(crypto, TAKEN_AT).text).toBe('Our book holds no stock on the measured ladder. I can rank the bench or my watchlist instead.');
    for (const p of [proposalOf(legacy, TAKEN_AT), proposalOf(crypto, TAKEN_AT)]) {
      expect(p.text).not.toMatch(/next check/);
      expect(p.weakestLine).not.toMatch(/next check/);
    }
  });
  it('the move line the calendar gives while moves cannot be ranked', () => {
    const sat = Date.parse('2026-10-17T15:00:00.000Z');
    expect(moveLineOf(availabilityOf(res({ takenAt: sat, quotesBody: quotesBody(Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, priceAsOf: Date.parse('2026-10-16T19:59:00.000Z'), sessionEtDate: '2026-10-16' }]))) })))).toBe('Market closed · next session Mon, Oct 19 · 9:30 AM ET');
    expect(moveLineOf(availabilityOf(res()))).toBeNull();
  });
});

describe('BRS-16 — the explanation, from the frozen result alone', () => {
  it('weakest by rank: who out-ranks it, the leader and whether it can come in, today\'s moves, and always the keep line', () => {
    const i = inv();
    expect(explainOf(i, res(), currentStep(i))).toEqual([
      '4 of 4 names out-rank EQIX (rank 140 of 228). PLTR leads at rank 5 of 228, and it can come in now (ranks as of 1:01 PM ET).',
      'Today PLTR is up 0.3% and EQIX is down 0.8% (as of 1:43 PM).',
      'None of this says how either would score from here. Keeping EQIX is a fair answer.',
    ]);
  });
  it('nothing out-ranks it: said plainly; a missing move is said to be missing, never zero', () => {
    const doc = rankingsDoc();
    doc.stocks = doc.stocks.map((s) => (s.symbol === 'EQIX' ? { ...s, technicalRank: 1 } : s));
    const r = res({ rankingsDoc: doc, quotesBody: quotesBody({ EQIX: null }) });
    const i = inv(r);
    const out = explainOf(i, r, currentStep(i));
    expect(out[0]).toMatch(/^Nothing on the bench or my watchlist out-ranks EQIX on technical rank\./);
    expect(out).toContain('I don’t have today’s move for EQIX yet.');
    expect(out.at(-1)).toBe('None of this says how either would score from here. Keeping EQIX is a fair answer.');
  });
  it('the leader that is locked, or cannot come in, says so', () => {
    const r = res({ quotesBody: quotesBody() });
    let i = inv(r);
    i = addCondition(i, { id: 'down_today' }, 1);
    expect(explainOf(i, r, currentStep(i))[0]).toContain('NVDA leads on today’s move'.replace('on today’s move', 'at rank 12 of 228, but it’s locked until Thu 10:00 AM'));
  });
  it('a group question: the count, the leader, the day\'s up, down and missing', () => {
    const r = res({ incumbent: null });
    const i = inv(r, 'rank_bench');
    expect(explainOf(i, r, currentStep(i))).toEqual([
      '4 names on my bench. NVDA leads at rank 12 of 228, but it’s locked until Thu 10:00 AM (ranks as of 1:01 PM ET).',
      '2 are up today, 1 down, 0 without a reading yet (as of 1:44 PM).',
    ]);
  });
  it('on a weekend: the market-closed line with the next session, and Friday\'s moves for reference', () => {
    const sat = Date.parse('2026-10-17T15:00:00.000Z');
    const fri = Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, priceAsOf: Date.parse('2026-10-16T19:59:00.000Z'), sessionEtDate: '2026-10-16' }]));
    const r = res({ takenAt: sat, quotesBody: quotesBody(fri) });
    const i = inv(r);
    expect(explainOf(i, r, currentStep(i))).toContain('Market closed. The next session is Mon, Oct 19 at 9:30 AM ET. I’m showing Fri’s moves for reference.');
  });
});

describe('BRS-13 — the banner after a refinement', () => {
  it('a condition: what was added, how many are left, which name moved and why, and that nothing was refreshed', () => {
    const doc = rankingsDoc();
    doc.stocks = doc.stocks.map((s) => (s.symbol === 'NVDA' ? { ...s, technicalRank: 3 } : s));
    const r = res({ rankingsDoc: doc });
    const i = addCondition(inv(r), { id: 'eligible_now' }, 1);
    expect(bannerOf(i, currentStep(i))).toEqual({
      title: 'Condition added: only names that can come in now',
      body: '3 of 4 names placed. 1 removed. PLTR is now #1, was #2, because a name above it was removed. Its rank is unchanged. 2 more names closed up the same way. Readings are the same 1:45 PM result. Nothing was refreshed.',
    });
  });
  it('an ordering change: positions changed because the order did; the names and readings are the same', () => {
    const i = setOrder(inv(), { measure: 'today_move', direction: 'best_first' }, 1);
    expect(bannerOf(i, currentStep(i))).toEqual({
      title: "Ordering changed: today's move, biggest gain first",
      body: 'Positions changed because the ordering changed. The names and their readings are the same. Readings are the same 1:45 PM result. Nothing was refreshed.',
    });
  });
  it('a replacement brings names back, and says so', () => {
    let i = addCondition(inv(), { id: 'up_today' }, 1);
    i = addCondition(i, { id: 'down_today' }, 2);
    const b = bannerOf(i, currentStep(i));
    expect(b.title).toBe('Condition replaced: down today, in place of up today');
    expect(b.body).toContain('1 came back');
  });
  it('none for the question itself', () => {
    const i = inv();
    expect(bannerOf(i, currentStep(i))).toBeNull();
  });
});

describe('§7 — a row\'s facts; the note line; the reference', () => {
  it('rank and its time, the move and its own time, the rung estimate, the sector, the difference chips', () => {
    expect(rowFactsOf(BATTLE, res(), 'PLTR')).toEqual({
      symbol: 'PLTR', name: 'Palantir', groups: ['Agent watchlist'], eligibility: { tone: 'ok', text: 'Can come in now' },
      rank: 'Rank 5 of 228 · 1:01 PM ET', sectorRank: null, move: '+0.3% · 1:43 PM', moveState: 'ok',
      rung: 'Estimated rung size ≈4.1% · ATR reading · 1:01 PM ET', sector: 'Technology', diffs: ['Higher rank than EQIX', 'Up more today than EQIX'],
    });
  });
  it('with a sector condition the sector rank prints first (a label, not a second sort)', () => {
    expect(rowFactsOf(BATTLE, res(), 'NVDA', { sectorActive: true }).sectorRank).toBe('3rd of 21 in Technology');
  });
  it('both groups carry both tags; a stale move prints its own words; no rung in a legacy-scored battle', () => {
    const r = res({ quotesBody: quotesBody({ MSFT: { ...quotesBody().quotes.MSFT, priceAsOf: TAKEN_AT - 50 * MIN } }) });
    const msft = rowFactsOf(BATTLE, r, 'MSFT');
    expect(msft.groups).toEqual(['Bench', 'Agent watchlist']);
    expect(msft.move).toBe('Quote from 12:55 PM · over 45 minutes old');
    expect(msft.diffs).toEqual(['Higher rank than EQIX']);
    const legacy = clone(BATTLE);
    delete legacy.scoring.stockThresholdModel;
    expect(rowFactsOf(legacy, res({}, legacy), 'MSFT').rung).toBeNull();
  });
  it('the note line: group, count, ranks time and the moves\' range', () => {
    const i = inv();
    expect(noteLineOf(res(), currentStep(i).view, currentStep(i).outcome)).toBe('Bench and agent watchlist · 6 names · Ranks as of 1:01 PM ET · moves as of 1:42–1:44 PM ET');
    expect(clockRange('11:58 AM', '12:02 PM')).toBe('11:58 AM–12:02 PM');
  });
  it('the reference line\'s words, and the hairline label only when it falls inside the list', () => {
    const i = inv();
    expect(referenceOf(res(), currentStep(i).view, currentStep(i).outcome)).toMatchObject({
      text: 'EQIX · held · our weakest at the 12:45 check · −0.4 rungs from entry · reference, not ranked',
      above: 'Names above this line out-rank EQIX on technical rank',
    });
  });
  it('BRS-15: eligibility labels — now; locked with its day; the passed lock; equipped only; the class', () => {
    expect(eligibilityLabel({ ok: true }).text).toBe('Can come in now');
    const until = Date.parse('2026-10-14T19:15:00.000Z');
    expect(eligibilityLabel({ ok: false, reason: 'pick_locked', lockedUntil: until }, TAKEN_AT).text).toBe('Locked until 3:15 PM');
    expect(eligibilityLabel({ ok: false, reason: 'pick_locked', lockedUntil: until }, TAKEN_AT, until + 1).text).toBe('Locked until 3:15 PM at this result · since passed');
    expect(eligibilityLabel({ ok: false, reason: 'pick_not_on_bench' }).text).toBe('Can’t come in · on the equipped list only');
    expect(eligibilityLabel({ ok: false, reason: 'pick_wrong_class' }).text).toBe('Can’t come in · a crypto can’t replace a stock');
  });
  it('company names: the bench row\'s, else the static map, else none (the ticker alone)', () => {
    expect(companyNameOf(BATTLE, 'MSFT')).toBe('Microsoft');
    expect(companyNameOf(BATTLE, 'PLTR')).toBe('Palantir');
    expect(companyNameOf(BATTLE, 'ZZZQ')).toBeNull();
  });
});

describe('BRS-17 / BRS-18 — the modal\'s research row and the comparison', () => {
  it('For this question: the place and measure, one line for, one against; the finding offers Use across when it applies', () => {
    const i = addCondition(inv(), { id: 'eligible_now' }, 1);
    const r = res();
    expect(researchRowOf(i, r, currentStep(i), 'MSFT')).toEqual({
      symbol: 'MSFT', position: 2, placed: true, of: 3,
      measureText: '#2 of 3 placed · Rank 40 of 228 · 1:01 PM ET',
      support: 'Higher technical rank than EQIX: 40 against 140 of 228 (ranks as of 1:01 PM ET).', against: null,
      finding: { text: 'Today’s move +1.2% · regular session · as of 1:43 PM', conditionId: 'up_today', replaces: null },
    });
    const removed = researchRowOf(i, r, currentStep(i), 'NVDA');
    expect(removed).toMatchObject({ placed: false, measureText: 'Not placed in this result · removed by a condition (only names that can come in now)', against: 'Locked until Thu 10:00 AM.' });
    expect(researchRowOf(i, r, currentStep(i), 'NVDA').finding).toMatchObject({ conditionId: 'down_today' });
  });
  it('the finding does not offer a condition already active, and says what it would replace', () => {
    const i = addCondition(inv(), { id: 'up_today' }, 1);
    expect(researchRowOf(i, res(), currentStep(i), 'MSFT').finding.conditionId).toBeNull();
    expect(researchRowOf(i, res(), currentStep(i), 'NVDA').finding).toMatchObject({ conditionId: 'down_today', replaces: 'up_today' });
  });
  it('the comparison: the rows in order, each with its time; the lock line on the holding only; absent rows left out', () => {
    const i = inv();
    const c = compareOf(res(), currentStep(i).view, 'MSFT', res().incumbent, BATTLE);
    expect(c.rows.map((r) => r.key)).toEqual(['measure', 'move', 'rung', 'stands', 'sector']);
    expect(c.rows.find((r) => r.key === 'rung')).toEqual({ key: 'rung', label: 'One rung', cand: 'Estimated rung size ≈1.9% · ATR reading · 1:01 PM ET', held: 'One rung is 1.0% · fixed at entry' });
    expect(c.lock).toBe('Swapping EQIX out at the 12:45 check’s price locks −6 pts');
    expect(c.tradeoff).toBe('MSFT out-ranks EQIX and is up more today than EQIX; EQIX leads on nothing here.');
    expect(c.evidence).toBe('On technical rank and today’s move, MSFT is ahead of EQIX. It can come in now. None of this says how it would score from here.');
    expect(JSON.stringify(c)).not.toMatch(/overlap|fit/i);
  });
  it('no comparison without a holding', () => {
    expect(compareOf(res(), { order: { measure: 'technical_rank' } }, 'MSFT', null, BATTLE)).toBeNull();
  });
});

describe('BRS-19 — the draft carries the investigation', () => {
  it('the question, the refinements and the order, both names\' frozen readings with their times, the closing question', () => {
    let i = setOrder(inv(), { measure: 'today_move', direction: 'best_first' }, 1);
    i = addCondition(i, { id: 'eligible_now' }, 2);
    const r = res();
    expect(draftOf(i, r, currentStep(i), 'MSFT', r.incumbent).text).toBe([
      'Research: "Compare alternatives to EQIX" (result 1:45 PM ET)',
      "Then: only names that can come in now · ordered by today's move",
      'MSFT vs EQIX:',
      '• Rank: MSFT 40 of 228, EQIX 140 (ranks 1:01 PM ET)',
      '• Today: MSFT +1.2%, EQIX −0.8% (quote 1:43 PM ET)',
      '• Rung: MSFT ≈1.9% (estimate, ATR reading 1:01 PM ET), EQIX 1.0% (fixed at entry)',
      '• Sector: MSFT Technology, EQIX Real Estate',
      '• MSFT can come in now. EQIX is −0.4 rungs from entry at the 12:45 check.',
      'Should MSFT replace EQIX?',
    ].join('\n'));
  });
  it('a reading the result does not have is LEFT OUT, never written as zero', () => {
    const r = res({ quotesBody: quotesBody({ EQIX: null }) });
    const i = inv(r);
    const d = draftOf(i, r, currentStep(i), 'MSFT', r.incumbent).text;
    expect(d).toContain('• Today: MSFT +1.2% (quote 1:43 PM ET)');
    expect(d).not.toMatch(/EQIX [+−]?0\.0%|EQIX 0%/);
  });
  it('no incumbent: no holding column; it ends "What do you make of {CAND}?"', () => {
    const r = res({ incumbent: null });
    const i = inv(r, 'rank_bench');
    expect(draftOf(i, r, currentStep(i), 'MSFT').text).toBe([
      'Research: "Rank my bench" (result 1:45 PM ET)', 'MSFT:', '• Rank: 40 of 228 (ranks 1:01 PM ET)', '• Today: +1.2% (quote 1:43 PM ET)',
      '• Rung: ≈1.9% (estimate, ATR reading 1:01 PM ET)', '• Sector: Technology', '• MSFT can come in now.', 'What do you make of MSFT?',
    ].join('\n'));
  });
  it('the trim order: the sector line goes first, then the rung line; always under the chat\'s limit', () => {
    const r = res();
    const i = inv(r);
    const { variants } = draftOf(i, r, currentStep(i), 'MSFT', r.incumbent);
    expect(variants[1]).not.toContain('• Sector:');
    expect(variants[1]).toContain('• Rung:');
    expect(variants[2]).not.toMatch(/• Sector:|• Rung:/);
    expect(fitDraft(variants, variants[1].length)).toBe(variants[1]);
    expect(fitDraft(variants, variants[2].length)).toBe(variants[2]);
    // Never cut mid-reading (BR2-8): the shortest variant is whole lines, and nothing fits → '' (the caller keeps the typed text).
    expect(variants[3]).toBe(['Research: "Compare alternatives to EQIX" (result 1:45 PM ET)', 'MSFT vs EQIX:', 'Should MSFT replace EQIX?'].join('\n'));
    expect(fitDraft(variants, variants[3].length)).toBe(variants[3]);
    expect(fitDraft(variants, 10)).toBe('');
    expect(variants[0].length).toBeLessThanOrEqual(CHAT_MAX_LENGTH);
    expect(variants[0]).not.toMatch(/[<>{}]/); // the chat's sanitizer strips these (Phase 0 point 9)
  });
});

describe('BRS-20 — Ask about this result: the first three PLACED names', () => {
  it('the header lines, the readings\' times, one line per top name, the closing question', () => {
    const i = setOrder(inv(), { measure: 'today_move', direction: 'best_first' }, 1);
    const r = res();
    const a = askDraftOf(i, r, currentStep(i));
    expect(a.top).toEqual(['ORCL', 'MSFT', 'NOW']);
    expect(a.text).toBe([
      'Research: "Compare alternatives to EQIX" (result 1:45 PM ET)', "Then: ordered by today's move", '(ranks 1:01 PM ET · quotes 1:42–1:44 PM ET)', 'Top names:',
      '• ORCL · rank 75 · +2.0% · can come in now', '• MSFT · rank 40 · +1.2% · can come in now', '• NOW · +0.9% · can’t come in · on the equipped list only', 'What do you make of these?',
    ].join('\n'));
  });
  it('never a name left out, not assessed or not ranked', () => {
    const r = res({ quotesBody: quotesBody({ PLTR: null }) });
    const i = addCondition(inv(r), { id: 'eligible_now' }, 1);
    const a = askDraftOf(addCondition(i, { id: 'up_today' }, 2), r, currentStep(addCondition(i, { id: 'up_today' }, 2)));
    expect(a.top).toEqual(['MSFT', 'ORCL']);
    expect(a.top).not.toContain('NVDA'); // removed
    expect(a.top).not.toContain('PLTR'); // not assessed
    expect(a.top).not.toContain('NOW'); // not ranked
  });
});
