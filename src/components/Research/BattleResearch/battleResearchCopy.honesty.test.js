// Battle Research Slice 1 — THE HONESTY SWEEP (spec §9, BRS-16): every template's output over a
// spread of battles (measured and legacy-scored; a session, a weekend, stale and missing quotes),
// every question, order and condition — and every static string — holds the rules:
//   · no "will", "should buy" or "likely"; nothing called live; no fit, overlap, momentum or SPY;
//     no stock called good or bad;
//   · no points in a candidate line: the one points figure is the holding's lock line (lockNowOf);
//   · every number carries its time (a rank, a move, a rung) in the same line or paragraph.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildResult, incumbentOf } from './result.js';
import { newInvestigation, addCondition, setOrder, switchGroup, currentStep, CAPS } from './investigation.js';
import { proposalOf, explainOf, bannerOf, rowFactsOf, researchRowOf, compareOf, draftOf, askDraftOf, referenceOf, noteLineOf, moveLineOf, availabilityOf } from './explain.js';
import { BR_COPY, STARTER_TEXT, CONDITION_LABEL } from './battleResearchCopy.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

const MIN = 60_000;
const BANNED = [/\bwill\b/i, /should buy/i, /\blikely\b/i, /\blive\b/i, /\bfit\b/i, /overlap/i, /momentum/i, /\bSPY\b/i, /\bgood\b/i, /\bbad\b/i];
const POINTS = /\bpoints?\b|\bpts\b/i;
const NUMBER = /\d+(\.\d+)?%|\brank \d|\bRank \d/;
const TIMED = /\b(AM|PM)\b|\bcheck\b|fixed at entry|’s move · close|'s move · close/;

const OUT = []; // { where, text, timed } — `timed` false for strings whose time lives in a sibling line (the Ask's top names)
const add = (where, text, timed = true) => { if (typeof text === 'string' && text) OUT.push({ where, text, timed }); };

beforeAll(async () => {
  const measured = await researchBattle();
  const legacy = JSON.parse(JSON.stringify(measured));
  delete legacy.scoring.stockThresholdModel;
  const fresh = JSON.parse(JSON.stringify(measured));
  fresh.scoring.stockRewardContexts.agent = {};
  const sat = Date.parse('2026-10-17T15:00:00.000Z');
  const fri = Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, priceAsOf: Date.parse('2026-10-16T19:59:00.000Z'), sessionEtDate: '2026-10-16' }]));
  const stale = Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, priceAsOf: TAKEN_AT - 70 * MIN }]));
  const scenarios = [
    { name: 'measured', battle: measured, body: quotesBody(), takenAt: TAKEN_AT },
    { name: 'legacy', battle: legacy, body: quotesBody(), takenAt: TAKEN_AT },
    { name: 'weekend', battle: measured, body: quotesBody(fri), takenAt: sat },
    { name: 'stale', battle: measured, body: { ...quotesBody(stale), snapshot: { sweepId: 's', sweepAt: TAKEN_AT - 20 * MIN } }, takenAt: TAKEN_AT },
    { name: 'missing', battle: measured, body: { servedAt: TAKEN_AT, snapshot: null, quotes: {} }, takenAt: TAKEN_AT },
    { name: 'before-open', battle: measured, body: quotesBody(fri), takenAt: Date.parse('2026-10-14T13:00:00.000Z') },
  ];
  for (const b of [measured, legacy, fresh]) { const p = proposalOf(b, TAKEN_AT); add('proposal', p.text); add('proposal', p.weakestLine); }
  for (const s of scenarios) {
    for (const questionId of ['weakest_alternatives', 'rank_bench', 'rank_agent_watchlist', 'moving_today']) {
      const incumbent = questionId === 'weakest_alternatives' ? incumbentOf(s.battle) : null;
      if (questionId === 'weakest_alternatives' && !incumbent) continue;
      const r = buildResult({ battle: s.battle, incumbent, rankingsDoc: rankingsDoc(), quotesBody: s.body, takenAt: s.takenAt, resultId: 'r1' });
      add(`${s.name}/move-line`, moveLineOf(availabilityOf(r)));
      let inv = newInvestigation({ battleId: 'b', questionId, result: r, at: s.takenAt });
      const walk = [
        (i) => i,
        (i) => setOrder(i, { measure: 'today_move', direction: 'best_first' }, 1),
        (i) => setOrder(i, { measure: 'today_move', direction: 'worst_first' }, 2),
        (i) => addCondition(i, { id: 'eligible_now' }, 3),
        (i) => addCondition(i, { id: 'up_today' }, 4),
        (i) => addCondition(i, { id: 'down_today' }, 5),
        (i) => addCondition(i, { id: 'sector', value: 'Technology' }, 6),
        (i) => switchGroup(i, 'agent_watchlist', 7),
      ];
      for (const step of walk) {
        inv = step(inv);
        const st = currentStep(inv);
        const where = `${s.name}/${questionId}/${st.kind}`;
        explainOf(inv, r, st).forEach((p) => add(`${where}/explain`, p));
        const b = bannerOf(inv, st);
        if (b) { add(`${where}/banner`, b.title); add(`${where}/banner`, b.body); }
        add(`${where}/note`, noteLineOf(r, st.view, st.outcome));
        const ref = referenceOf(r, st.view, st.outcome);
        if (ref) { add(`${where}/ref`, ref.text); add(`${where}/ref`, ref.above); add(`${where}/ref`, ref.noReading); }
        for (const m of r.membership) {
          const f = rowFactsOf(s.battle, r, m.symbol, { sectorActive: true });
          add(`${where}/row/${m.symbol}`, [f.rank, f.sectorRank, f.move, f.rung].filter(Boolean).join(' · '));
          f.diffs.forEach((d) => add(`${where}/row/diff`, d));
          add(`${where}/row/elig`, f.eligibility?.text);
          const rr = researchRowOf(inv, r, st, m.symbol);
          add(`${where}/research/measure`, rr.measureText);
          add(`${where}/research/for`, rr.support);
          add(`${where}/research/against`, rr.against);
          add(`${where}/research/finding`, rr.finding?.text);
          const c = compareOf(r, st.view, m.symbol, incumbent, s.battle);
          if (c) {
            c.rows.forEach((row) => { add(`${where}/compare/${row.key}`, row.cand); add(`${where}/compare/${row.key}`, row.held); });
            add(`${where}/compare/lock`, c.lock);
            add(`${where}/compare/tradeoff`, c.tradeoff);
            add(`${where}/compare/evidence`, c.evidence);
          }
          draftOf(inv, r, st, m.symbol, incumbent).variants.forEach((v) => v.split('\n').forEach((line) => add(`${where}/draft`, line)));
        }
        const a = askDraftOf(inv, r, st);
        a.text.split('\n').forEach((line) => add(`${where}/ask`, line, !line.startsWith('• ')));
        if (a.top.length) expect(a.text).toMatch(/^\(ranks .* ET.*\)$/m);
      }
    }
  }
  // Every static string and every argument-free template.
  for (const [k, v] of Object.entries(BR_COPY)) if (typeof v === 'string') add(`copy/${k}`, v);
  Object.values(STARTER_TEXT).forEach((t) => add('copy/starter', t));
  Object.values(CONDITION_LABEL).forEach((t) => add('copy/condition', t));
  add('copy/caps', BR_COPY.historyCapped(CAPS.steps));
});

describe('§9 / BRS-16 — the honesty sweep', () => {
  it('swept a real spread of outputs', () => {
    expect(OUT.length).toBeGreaterThan(2000);
  });
  it('no will, should buy, likely, live, fit, overlap, momentum, SPY, good or bad — anywhere', () => {
    const bad = OUT.filter((o) => BANNED.some((re) => re.test(o.text)));
    expect(bad.map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });
  it('no points in a candidate line: the only points figure is the holding\'s lock line', () => {
    const withPoints = OUT.filter((o) => POINTS.test(o.text));
    expect(withPoints.length).toBeGreaterThan(0);
    expect(withPoints.filter((o) => !/^Swapping [A-Z]+ out at the .* check’s price locks [+−]?\d+ pts$/.test(o.text)).map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });
  it('every number carries its time — a rank, a move, a rung', () => {
    const untimed = OUT.filter((o) => o.timed && NUMBER.test(o.text) && !TIMED.test(o.text));
    expect(untimed.map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });
  it('nothing is called live, and no number is called delayed by an assumed amount', () => {
    expect(OUT.filter((o) => /\b(delayed|real[- ]time|15[- ]minute delay)\b/i.test(o.text)).map((o) => o.text)).toEqual([]);
  });
});
