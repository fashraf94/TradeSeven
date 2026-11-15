// Battle Research Slice 1 — THE HONESTY SWEEP (spec §9, BRS-16; rebuilt after review BR2-16): every
// template's output over a spread of battles (measured and legacy-scored; a session, a weekend, before
// the open; stale, missing and printed-zero moves; a printed tie; ranks with no time; a check on an
// earlier day; a lock that has passed), every question, order and condition — added AND removed — the
// comparison against the incumbent AND each picked holding, and every static string, holds the rules:
//   · no "will", "should buy", "likely", "'ll" (but "I'll", §9's own), "won't", "set to", "could",
//     "strong"; nothing called live; no fit, overlap, momentum or SPY; no stock called good or bad —
//     over every step's wording and every UI-only template too (refuter P6 – P8);
//   · no points in a candidate line: the one points figure is the holding's lock line (lockNowOf);
//   · every number carries its time — each FIELD checked on its own (a row's facts are never joined, so
//     one field's time cannot hide another's), a rank as "N of M" as much as "Rank N";
//   · a missing reading is never written as zero or flat — in a row, the explanation, the finding, a
//     comparison cell, a draft line or the Ask (refuter P4, P5);
//   · every engine template is exercised; the UI-only labels are PR B's, listed by name, each swept
//     with sample arguments — and the engine calls none of them (refuter: the list held engine templates).

import { describe, it, expect, beforeAll, vi } from 'vitest';

const CALLED = vi.hoisted(() => new Set());
vi.mock('./battleResearchCopy.js', async (importOriginal) => {
  const m = await importOriginal();
  // A plain copy as the target: a Proxy over the frozen object may not hand back a wrapper.
  const BR_COPY = new Proxy({ ...m.BR_COPY }, {
    get(target, key) {
      const v = target[key];
      return typeof v === 'function' ? (...args) => { CALLED.add(key); return v(...args); } : v;
    },
  });
  return { ...m, BR_COPY };
});

const { buildResult, incumbentOf } = await import('./result.js');
const { newInvestigation, addCondition, removeCondition, setOrder, switchGroup, acrossCondition, refreshWith, refreshIncumbent, noticeOf, currentStep, CAPS } = await import('./investigation.js');
const { proposalOf, explainOf, bannerOf, rowFactsOf, researchRowOf, compareOf, draftOf, askDraftOf, referenceOf, noteLineOf, moveLineOf, availabilityOf } = await import('./explain.js');
const { BR_COPY, STARTER_TEXT, CONDITION_LABEL } = await import('./battleResearchCopy.js');
const { researchBattle, rankingsDoc, quotesBody, TAKEN_AT, KO_WEAKEST_CHECKS } = await import('./__fixtures__/researchFixtures.js');

const MIN = 60_000;
// The spec's list (§9: will, should buy, likely; live; fit, overlap, momentum, SPY) and review BR2-16's
// additions (won't, set to, could, strong; good, bad). "'ll" is "will" (refuter P6): banned on every subject
// but "I" — §9's own copy says "I'll rank by today's move once they arrive", the agent's own next step,
// never a claim about a stock (a reading in the report).
const BANNED = [/\bwill\b/i, /should buy/i, /\blikely\b/i, /\blive\b/i, /\bfit\b/i, /overlap/i, /momentum/i, /\bSPY\b/i, /\bgood\b/i, /\bbad\b/i,
  /\bwon[’']t\b/i, /\bset to\b/i, /\bcould\b/i, /\bstrong\b/i, /\b(?!I[’']ll\b)[A-Za-z]+[’']ll\b/];
const POINTS = /\bpoints?\b|\bpts\b/i;
// A reading: a percentage, a rank ("Rank 5", "rank 5", "5 of 228", "40 against 140").
const NUMBER = /\d+(\.\d+)?%|\brank \d|\bRank:? \d|\b\d+ of \d{3}\b|\d+ against \d+/;
const TIMED = /\b(AM|PM)\b|\bcheck\b|fixed at entry|’s move · close|'s move · close|an earlier session’s move|time not recorded/;

const OUT = []; // { where, text, timed }
const add = (where, text, timed = true) => { if (typeof text === 'string' && text) OUT.push({ where, text, timed }); };

/**
 * The UI-only labels the surface (PR B) prints — the engine calls none of them (a row below proves it) —
 * each with sample arguments, so the sweep reads what they print too (refuter P8).
 */
const UI_SAMPLES = {
  voiceLabel: [['Shadow', 'Trend Follower']],
  proposesEyebrow: [['Shadow']],
  asTheyStand: [[1], [4]],
  fetching: [['Compare alternatives to EQIX']],
  firstFetchFailed: [['the price read didn’t answer']],
  refreshFailed: [['the price read didn’t answer', '1:45 PM']],
  refreshIn: [['0:42']],
  showAll: [[9]],
  askAbout: [['Shadow']],
  sameOnOther: [['bench'], ['agent_watchlist']],
  draftFor: [['Shadow']],
  draftDoor: [['Shadow']],
  compareWith: [['EQIX']],
  acrossConfirm: [['up today', null, 3, 1, 0], ['up today', 'down today', 3, 1, 2]],
  applied: [[3]],
  ranksLine: [['1:01 PM']],
  refreshedTitle: [['Result 2 · 1:47 PM']],
  refreshedBody: [[2, 1, 0], [0, 0, 0]],
  refreshedWeakest: [['KO', 'EQIX']],
  refreshedPlaced: [[1, 1], [2, 0], [0, 3]],
  resultOf: [['Result 2 · 1:47 PM']],
  emptyGroup: [['Bench']],
  forLine: [['Higher technical rank than EQIX: 40 against 140 of 228 (ranks as of 1:01 PM ET).']],
  againstLine: [['Locked until Thu 10:00 AM.']],
  position: [[3]],
  was: [[2]],
  historyCapped: [[40]],
  leftResult: [['MSFT', 'up 1.2%', 'down today', '1:43 PM']],
  leftResultNoMove: [['MSFT', 'down today']],
};
const UI_ONLY = new Set(Object.keys(UI_SAMPLES));
let ENGINE_CALLED = new Set();

beforeAll(async () => {
  const measured = await researchBattle();
  const later = await researchBattle({}, { checks: KO_WEAKEST_CHECKS });
  const legacy = JSON.parse(JSON.stringify(measured));
  delete legacy.scoring.stockThresholdModel;
  const fresh = JSON.parse(JSON.stringify(measured));
  fresh.scoring.stockRewardContexts.agent = {};
  const sat = Date.parse('2026-10-17T15:00:00.000Z');
  const thu = Date.parse('2026-10-15T13:40:00.000Z'); // Thu 9:40 AM: the book's check is Wednesday's
  const fri = Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, priceAsOf: Date.parse('2026-10-16T19:59:00.000Z'), sessionEtDate: '2026-10-16' }]));
  const stale = Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, priceAsOf: TAKEN_AT - 70 * MIN }]));
  const q = quotesBody().quotes;
  const tie = { ...q, ORCL: { ...q.ORCL, changePercent: 1.24 }, MSFT: { ...q.MSFT, changePercent: 1.21 }, EQIX: { ...q.EQIX, changePercent: 1.21 }, PLTR: { ...q.PLTR, changePercent: 0.04 }, NVDA: { ...q.NVDA, changePercent: -0.04 } };
  const noTime = rankingsDoc();
  delete noTime.computedAt;
  const incBest = rankingsDoc();
  incBest.stocks = incBest.stocks.map((x) => (x.symbol === 'EQIX' ? { ...x, technicalRank: 1 } : x));
  const oldQuotes = Object.fromEntries(Object.entries(q).map(([k, v]) => [k, { ...v, priceAsOf: TAKEN_AT - 70 * MIN }]));
  // The swap, replayed: EQIX out, the book unscored until the next check (the weakest gone; a notice).
  const swapped = JSON.parse(JSON.stringify(measured));
  const eqTier = ['star', 'core', 'support'].find((t) => swapped.portfolio[t].some((x) => x.symbol === 'EQIX'));
  swapped.portfolio[eqTier] = swapped.portfolio[eqTier].map((x) => (x.symbol === 'EQIX' ? { ...x, symbol: 'MSFT', positionId: 'position-msft' } : x));
  swapped.portfolio.bench.stocks = [...swapped.portfolio.bench.stocks.filter((x) => x.symbol !== 'MSFT'), { symbol: 'EQIX' }];
  swapped.scoreState = { ...(swapped.scoreState || {}), stockScoreEvidence: { status: 'unavailable', reason: 'roster_changed_awaiting_score' } };
  swapped.trades = [{ symbolOut: 'EQIX', symbolIn: 'MSFT', swappedOutAt: '2026-10-14T18:10:00.000Z' }];
  // Swapped out and back in: EQIX held again as a new position (refuter BR1-1).
  const reheld = JSON.parse(JSON.stringify(measured));
  for (const t of ['star', 'core', 'support']) reheld.portfolio[t] = reheld.portfolio[t].map((x) => (x.symbol === 'EQIX' ? { ...x, positionId: 'position-eqix-2' } : x));
  reheld.trades = [{ symbolOut: 'EQIX', symbolIn: 'EQIX', swappedOutAt: '2026-10-14T18:10:00.000Z' }];
  const relisted = JSON.parse(JSON.stringify(measured));
  relisted.watchlist.hotBench = ['MSFT', 'XYZ'];
  const scenarios = [
    { name: 'measured', battle: measured, body: quotesBody(), takenAt: TAKEN_AT },
    { name: 'legacy', battle: legacy, body: quotesBody(), takenAt: TAKEN_AT },
    { name: 'weekend', battle: measured, body: quotesBody(fri), takenAt: sat },
    { name: 'stale', battle: measured, body: { ...quotesBody(stale), snapshot: { sweepId: 's', sweepAt: TAKEN_AT - 20 * MIN } }, takenAt: TAKEN_AT },
    { name: 'missing', battle: measured, body: { servedAt: TAKEN_AT, snapshot: null, quotes: {} }, takenAt: TAKEN_AT },
    { name: 'before-open', battle: measured, body: quotesBody(fri), takenAt: Date.parse('2026-10-14T13:00:00.000Z') },
    { name: 'printed-tie-and-zero', battle: measured, body: quotesBody(tie), takenAt: TAKEN_AT },
    { name: 'ranks-no-time', battle: measured, body: quotesBody(), takenAt: TAKEN_AT, doc: noTime },
    { name: 'incumbent-best', battle: measured, body: quotesBody(), takenAt: TAKEN_AT, doc: incBest },
    { name: 'all-quotes-old', battle: measured, body: quotesBody(oldQuotes), takenAt: TAKEN_AT },
    { name: 'leader-cant', battle: measured, body: quotesBody({ NOW: { ...q.NOW, changePercent: 5.2 } }), takenAt: TAKEN_AT },
    { name: 'check-yesterday', battle: measured, body: quotesBody(Object.fromEntries(Object.entries(q).map(([k, v]) => [k, { ...v, priceAsOf: thu - 2 * MIN, sessionEtDate: '2026-10-15' }]))), takenAt: thu },
  ];
  for (const b of [measured, legacy, fresh]) { const p = proposalOf(b, TAKEN_AT); add('proposal', p.text); add('proposal', p.weakestLine); }
  for (const s of scenarios) {
    for (const questionId of ['weakest_alternatives', 'rank_bench', 'rank_agent_watchlist', 'moving_today']) {
      const incumbent = questionId === 'weakest_alternatives' ? incumbentOf(s.battle) : null;
      if (questionId === 'weakest_alternatives' && !incumbent) continue;
      const r = buildResult({ battle: s.battle, incumbent, rankingsDoc: s.doc ?? rankingsDoc(), quotesBody: s.body, takenAt: s.takenAt, resultId: 'r1' });
      add(`${s.name}/move-line`, moveLineOf(availabilityOf(r)));
      let inv = newInvestigation({ battleId: 'b', questionId, result: r, at: s.takenAt });
      const walk = [
        (i) => i,
        (i) => setOrder(i, { measure: 'today_move', direction: 'best_first' }, 1),
        (i) => setOrder(i, { measure: 'today_move', direction: 'worst_first' }, 2),
        (i) => setOrder(i, { measure: 'technical_rank', direction: 'best_first' }, 3),
        (i) => addCondition(i, { id: 'eligible_now' }, 4),
        (i) => addCondition(i, { id: 'up_today' }, 5),
        (i) => addCondition(i, { id: 'down_today' }, 6),
        (i) => removeCondition(i, 'down_today', 7),
        (i) => removeCondition(i, 'eligible_now', 8),
        (i) => addCondition(i, { id: 'sector', value: 'Technology' }, 9),
        (i) => acrossCondition(i, 'up_today', 10), // Use across, from a stock's finding (BRS-18a)
        (i) => switchGroup(i, 'agent_watchlist', 11),
      ];
      for (const step of walk) {
        inv = step(inv);
        const st = currentStep(inv);
        const where = `${s.name}/${questionId}/${st.kind}`;
        add(`${where}/step`, st.wording); // every step's own wording (refuter P7)
        explainOf(inv, r, st).forEach((p) => add(`${where}/explain`, p));
        const b = bannerOf(inv, st);
        if (b) { add(`${where}/banner`, b.title); add(`${where}/banner`, b.body); }
        add(`${where}/note`, noteLineOf(r, st.view, st.outcome));
        const ref = referenceOf(r, st.view, st.outcome);
        if (ref) { add(`${where}/ref`, ref.text); add(`${where}/ref`, ref.above); add(`${where}/ref`, ref.noReading); }
        for (const m of r.membership) {
          const f = rowFactsOf(s.battle, r, m.symbol, { sectorActive: true, nowMs: s.takenAt + 26 * 60 * MIN });
          // Each field on its own (review BR2-16): one field's time never hides another's.
          for (const k of ['rank', 'sectorRank', 'move', 'rung']) add(`${where}/row/${m.symbol}/${k}`, f[k], k !== 'sectorRank');
          f.diffs.forEach((d) => add(`${where}/row/diff`, d));
          add(`${where}/row/elig`, f.eligibility?.text);
          const rr = researchRowOf(inv, r, st, m.symbol, { nowMs: s.takenAt + 26 * 60 * MIN });
          add(`${where}/research/measure`, rr.measureText);
          add(`${where}/research/for`, rr.support);
          add(`${where}/research/against`, rr.against);
          add(`${where}/research/finding`, rr.finding?.text);
          // The comparison against the incumbent AND against each picked holding (review BR2-16).
          const noMove = (sym) => r.quotes.rows[sym]?.state !== 'ok';
          const zero = /0\.0%|\bflat\b/;
          const neverZero = (tag, text, bad) => add(`${where}/never-zero/${tag}`, bad ? `NEVER-ZERO VIOLATION: ${text}` : 'ok', false);
          for (const h of [incumbent, ...r.holdings].filter(Boolean)) {
            const c = compareOf(r, st.view, m.symbol, h, s.battle, { nowMs: s.takenAt + 26 * 60 * MIN });
            if (!c) continue;
            c.rows.forEach((row) => { add(`${where}/compare/${row.key}`, row.cand); add(`${where}/compare/${row.key}`, row.held); });
            add(`${where}/compare/lock`, c.lock);
            add(`${where}/compare/tradeoff`, c.tradeoff);
            add(`${where}/compare/evidence`, c.evidence);
            // A comparison's move cells: a side with no usable move never prints a zero (refuter P5).
            const mv = c.rows.find((row) => row.key === 'move');
            if (mv && noMove(m.symbol) && mv.cand) neverZero(`compare/${m.symbol}`, mv.cand, zero.test(mv.cand));
            if (mv && noMove(h.symbol) && mv.held) neverZero(`compare/${h.symbol}`, mv.held, zero.test(mv.held));
            const lines = draftOf(inv, r, st, m.symbol, h, { nowMs: s.takenAt + 26 * 60 * MIN }).variants.flatMap((v) => v.split('\n'));
            lines.forEach((line) => add(`${where}/draft`, line));
            // A draft names each side's move after its symbol: none for a side with no usable move (refuter P4).
            for (const sym of [m.symbol, h.symbol].filter(noMove)) {
              const re = new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:? [+−]?0\\.0%`);
              lines.forEach((line) => neverZero(`draft/${sym}`, line, re.test(line)));
            }
          }
          const solo = draftOf(inv, r, st, m.symbol, null).variants.flatMap((v) => v.split('\n'));
          solo.forEach((line) => add(`${where}/draft-solo`, line));
          // A solo draft carries one name's readings: with no usable move, no line prints a zero move.
          if (noMove(m.symbol)) solo.forEach((line) => neverZero(`draft-solo/${m.symbol}`, line, /^Today\b.*0\.0%|^• Today\b.*0\.0%/.test(line) || /\bflat\b/.test(line)));
          // NEVER ZERO: a name with no usable move never prints a zero or "flat" move anywhere.
          if (r.quotes.rows[m.symbol]?.state !== 'ok') {
            for (const text of [f.move, rr.finding?.text, ...explainOf(inv, r, st)].filter(Boolean)) {
              if (text.includes(m.symbol) || text === f.move) add(`${where}/never-zero/${m.symbol}`, text.match(/0\.0%|flat/) ? `NEVER-ZERO VIOLATION: ${text}` : 'ok', false);
            }
          }
        }
        const a = askDraftOf(inv, r, st, { nowMs: s.takenAt });
        a.text.split('\n').forEach((line) => add(`${where}/ask`, line, !line.startsWith('• ')));
        for (const sym of a.top.filter((x) => r.quotes.rows[x]?.state !== 'ok')) {
          a.text.split('\n').filter((line) => line.startsWith(`• ${sym} `)).forEach((line) => add(`${where}/never-zero/ask/${sym}`, /0\.0%|\bflat\b/.test(line) ? `NEVER-ZERO VIOLATION: ${line}` : 'ok', false));
        }
        if (a.top.length) expect(a.text).toMatch(/^\(ranks .*\)$|^\(quotes .*\)$/m);
      }
      // Refresh and the notices on the same question.
      const r2 = buildResult({ battle: later, incumbent: refreshIncumbent(inv, later), rankingsDoc: rankingsDoc(), quotesBody: s.body, takenAt: s.takenAt + 40 * MIN, resultId: 'r2', index: 2 });
      const i2 = refreshWith(inv, r2, s.takenAt + 40 * MIN);
      explainOf(i2, r2, currentStep(i2)).forEach((p) => add(`${s.name}/${questionId}/refresh/explain`, p));
      add(`${s.name}/${questionId}/refresh/step`, currentStep(i2).wording);
      add(`${s.name}/${questionId}/notice`, noticeOf(inv, reheld)?.text);
      add(`${s.name}/${questionId}/notice`, noticeOf(inv, later)?.text);
      add(`${s.name}/${questionId}/notice`, noticeOf(inv, swapped)?.text);
      add(`${s.name}/${questionId}/notice`, noticeOf(inv, relisted)?.text);
      // A refresh after the swap: the weakest question with no weakest says why.
      const r3 = buildResult({ battle: swapped, incumbent: refreshIncumbent(inv, swapped), rankingsDoc: rankingsDoc(), quotesBody: s.body, takenAt: s.takenAt + 50 * MIN, resultId: 'r3', index: 3 });
      const i3 = refreshWith(inv, r3, s.takenAt + 50 * MIN);
      explainOf(i3, r3, currentStep(i3)).forEach((p) => add(`${s.name}/${questionId}/swap/explain`, p));
      // A comparison at the result's own instant (a lock not yet passed).
      for (const m of r.membership) {
        const c = incumbent ? compareOf(r, currentStep(inv).view, m.symbol, incumbent, s.battle) : null;
        if (c) add(`${s.name}/${questionId}/compare-now/evidence`, c.evidence);
      }
    }
  }
  ENGINE_CALLED = new Set(CALLED);
  // The UI-only templates, with their sample arguments (banned words; their numbers are counts, not readings).
  for (const [k, argsList] of Object.entries(UI_SAMPLES)) for (const args of argsList) add(`ui/${k}`, BR_COPY[k](...args), false);
  // Every static string and every argument-free template.
  for (const [k, v] of Object.entries(BR_COPY)) if (typeof v === 'string') add(`copy/${k}`, v);
  Object.values(STARTER_TEXT).forEach((t) => add('copy/starter', t));
  Object.values(CONDITION_LABEL).forEach((t) => add('copy/condition', t));
  add('copy/caps', BR_COPY.historyCapped(CAPS.steps));
}, 120_000); // ~20k outputs: seconds on a quiet machine, more on a 2-vCPU runner

describe('§9 / BRS-16 — the honesty sweep', () => {
  it('swept a real spread of outputs', () => {
    expect(OUT.length).toBeGreaterThan(20000);
  });
  it('no will, should buy, likely, won’t, set to, could, strong, live, fit, overlap, momentum, SPY, good or bad — anywhere', () => {
    const bad = OUT.filter((o) => BANNED.some((re) => re.test(o.text)));
    expect([...new Set(bad.map((o) => `${o.where}: ${o.text}`))].slice(0, 20)).toEqual([]);
  });
  it('no points in a candidate line: the only points figure is the holding\'s lock line', () => {
    const withPoints = OUT.filter((o) => POINTS.test(o.text));
    expect(withPoints.length).toBeGreaterThan(0);
    expect([...new Set(withPoints.filter((o) => !/^Swapping [A-Z]+ out at the .* check’s price locks [+−]\d+ pts$/.test(o.text)).map((o) => `${o.where}: ${o.text}`))]).toEqual([]);
  });
  it('every number carries its time — a rank, a move, a rung — field by field', () => {
    const untimed = OUT.filter((o) => o.timed && NUMBER.test(o.text) && !TIMED.test(o.text));
    expect([...new Set(untimed.map((o) => `${o.where}: ${o.text}`))].slice(0, 20)).toEqual([]);
  });
  it('a missing reading is never written as zero or flat', () => {
    expect([...new Set(OUT.filter((o) => o.text.startsWith('NEVER-ZERO VIOLATION')).map((o) => `${o.where}: ${o.text}`))]).toEqual([]);
  });
  it('nothing is called live, and no number is called delayed by an assumed amount', () => {
    expect(OUT.filter((o) => /\b(delayed|real[- ]time|15[- ]minute delay)\b/i.test(o.text)).map((o) => o.text)).toEqual([]);
  });
  it('every engine template is exercised by the sweep (the UI-only labels are PR B\'s, named)', () => {
    const fns = Object.entries(BR_COPY).filter(([, v]) => typeof v === 'function').map(([k]) => k);
    expect(fns.filter((k) => !ENGINE_CALLED.has(k) && !UI_ONLY.has(k))).toEqual([]);
  });
  it('a UI-only label is one the engine never calls (else the sweep would be skipping an engine template)', () => {
    expect([...UI_ONLY].filter((k) => ENGINE_CALLED.has(k))).toEqual([]);
    expect([...UI_ONLY].filter((k) => typeof BR_COPY[k] !== 'function')).toEqual([]);
  });
});
