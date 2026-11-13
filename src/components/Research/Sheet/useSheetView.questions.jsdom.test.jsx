// @vitest-environment jsdom
//
// QF-1 (build prompt of Nov 13, 2026): the question set is decided ONCE when the row opens and kept —
// a tick, a check landing or a move across entry never switches it while the modal is open (the FQ-9
// rule). QF-8: the agent's name goes through the cockpit's agentNameOf — *Shadow*, never *shadow*.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
const fsLog = vi.hoisted(() => ({ reads: [], doc: null }));
vi.mock('firebase/firestore', () => ({ doc: (_db, ...p) => p.join('/'), getDoc: async (path) => { fsLog.reads.push(path); return { exists: () => !!fsLog.doc, data: () => fsLog.doc }; } }));

import useSheetView from './useSheetView.js';
import AnalysisSheet, { SheetActionRow } from './AnalysisSheet.jsx';
import { measuredBookBattle, BOOK_RANKINGS } from './__fixtures__/sheetBattles.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.parse('2026-10-14T17:07:00.000Z');
let UP, DOWN;
beforeAll(async () => {
  UP = await measuredBookBattle();
  // The same book after a later check scored AAPL below its fill.
  DOWN = await measuredBookBattle({ quotes: { AAPL: 99.9 } });
});
let container, root, seen;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(NOW));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  seen = null;
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

function Probe(props) {
  seen = useSheetView(props);
  return seen ? <><AnalysisSheet view={seen} /><SheetActionRow view={seen} /></> : null;
}
const POS = { AAPL: 'position-aapl', EQIX: 'position-eqix' };
const ctx = (battle, symbol, over = {}) => ({ battleId: 'stock-battle', agentId: 'agent', agentName: battle.agentContext.agentName, battle, calls: [], rankings: BOOK_RANKINGS, standing: null, directive: null, row: POS[symbol] ? { held: true, positionId: POS[symbol] } : { held: false }, ...over });
const show = (battle, symbol, live, over) => act(() => {
  root.render(<Probe on context={ctx(battle, symbol, over)} symbol={symbol} isOriginal live={live} rawData={null} timeframe="1D" analysisActive />);
});
const rows = () => [...container.querySelectorAll('[data-sheet-questions] [data-sheet-question]')].map((b) => b.dataset.sheetQuestion);

describe('QF-1 — the rows a row shows', () => {
  it('a held stock up from entry: Should we take profit? first', () => {
    show(UP, 'AAPL', 103.4);
    expect(rows()).toEqual(['take_profit', 'catch_up', 'protect_lead']);
    expect(container.textContent).toContain('Should we take profit?');
  });
  it('a held stock down from entry: Is this our weakest spot? first', () => {
    show(UP, 'EQIX', 809);
    expect(rows()).toEqual(['weakest_spot', 'catch_up', 'protect_lead']);
    expect(container.textContent).toContain('Is this our weakest spot?');
  });
  it('a bench name: Is this better than our weakest holding? first', () => {
    show(UP, 'MSFT', 420);
    expect(rows()).toEqual(['better_than_stalled', 'catch_up', 'protect_lead']);
    expect(container.textContent).toContain('Is this better than our weakest holding?');
    expect(container.textContent).not.toMatch(/what’s stalled/);
  });
  it('a held crypto: the standing two and the line that it is not on the measured ladder', () => {
    show(UP, 'ETH', 2400, { row: { held: true, positionId: 'position-eth' } });
    expect(rows()).toEqual(['catch_up', 'protect_lead']);
    expect(container.querySelector('[data-sheet-not-on-ladder]').textContent).toBe('ETH isn’t on the measured ladder, so only the standing questions apply.');
  });
  it('ruling 2 (2026-11-13) — no committed context at open (just after a swap): the standing two and "ranked at the next check", kept while the clock runs', () => {
    const fresh = JSON.parse(JSON.stringify(UP));
    delete fresh.scoring.stockRewardContexts.agent[POS.AAPL];
    show(fresh, 'AAPL', 103.4);
    expect(rows()).toEqual(['catch_up', 'protect_lead']);
    expect(container.querySelector('[data-sheet-book-pending]').textContent).toBe('Your book is ranked at the next check (1:15)');
    expect(container.querySelector('[data-sheet-not-on-ladder]')).toBeNull();
    expect(container.textContent).not.toMatch(/weakest spot|take profit|rungs from entry/);
    act(() => seen.pickQuestion('weakest_spot'));
    expect(seen.question).toBeNull();
    // Decided with the set: twenty minutes on, the line still names the check it was opened before.
    act(() => { vi.advanceTimersByTime(20 * 60_000); });
    show(fresh, 'AAPL', 103.4);
    expect(container.querySelector('[data-sheet-book-pending]').textContent).toBe('Your book is ranked at the next check (1:15)');
  });
  it('a scored held stock shows no "ranked at the next check" line', () => {
    show(UP, 'AAPL', 103.4);
    expect(container.querySelector('[data-sheet-book-pending]')).toBeNull();
  });
});

describe('QF-1 — decided once at open, never switched while the modal is open', () => {
  it('AAPL opens up (take profit); a later check scores it below entry and the clock ticks: the set stays', () => {
    show(UP, 'AAPL', 103.4);
    expect(seen.order).toEqual(['take_profit', 'catch_up', 'protect_lead']);
    show(DOWN, 'AAPL', 99.9);
    act(() => { vi.advanceTimersByTime(65_000); });
    expect(seen.order).toEqual(['take_profit', 'catch_up', 'protect_lead']);
    expect(rows()).toEqual(['take_profit', 'catch_up', 'protect_lead']);
    // A pick outside the set is refused; one inside it opens.
    act(() => seen.pickQuestion('weakest_spot'));
    expect(seen.question).toBeNull();
    act(() => seen.pickQuestion('take_profit'));
    expect(seen.pack.questionId).toBe('take_profit');
  });
  it('a NEW opening (another row) is decided afresh from the record then', () => {
    show(DOWN, 'AAPL', 99.9);
    expect(seen.order[0]).toBe('weakest_spot');
  });
});

describe('QF-8 — the agent\'s name through agentNameOf: Shadow, never shadow', () => {
  it('the battle stores "shadow": the Ask row, What it decided, the reply card all say Shadow', () => {
    expect(UP.agentContext.agentName).toBe('shadow');
    show(UP, 'AAPL', 103.4);
    expect(seen.agentName).toBe('Shadow');
    act(() => seen.pickQuestion('take_profit'));
    const text = container.textContent;
    expect(text).toContain('Ask Shadow: should we take profit?');
    expect(text).not.toMatch(/\bshadow\b/);
  });
  it('no name: the archetype, never agentNameOf\'s "Your Agent"', () => {
    show(UP, 'AAPL', 103.4, { agentName: '  ' });
    expect(seen.agentName).toBeNull();
    expect(container.textContent).not.toMatch(/Your Agent/);
    expect(container.textContent).toContain('Ask Trend Follower');
  });
});

describe('the review round (B1, B3)', () => {
  it('B1 — navigate away inside the modal and back: the row keeps the set decided at its first opening', () => {
    show(UP, 'AAPL', 103.4);
    expect(seen.order[0]).toBe('take_profit');
    show(DOWN, 'MSFT', 420, { row: { held: false } }, false);
    expect(seen.order[0]).toBe('better_than_stalled');
    show(DOWN, 'AAPL', 99.9);
    expect(seen.order).toEqual(['take_profit', 'catch_up', 'protect_lead']);
  });
  it('B3 — a held stock opened with a bench-door incumbent: no pre-set stalled question, and no rankings read for it', async () => {
    fsLog.reads = [];
    show(UP, 'AAPL', 103.4, { incumbent: 'EQIX', rankings: undefined });
    await act(async () => { await Promise.resolve(); });
    expect(seen.question).toBeNull();
    expect(fsLog.reads).toEqual([]);
    // Opening a question that reads them reads them once.
    act(() => seen.pickQuestion('take_profit'));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(fsLog.reads).toEqual(['indexIntelligence/stockRankings']);
  });
});

describe('lens D (M6, M7) — the production path: no rankings in the context, one read when a question that reads them opens', () => {
  const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
  it('a held stock that is down: Is this our weakest spot? reads the rankings once and shows the bench alternative', async () => {
    fsLog.reads = []; fsLog.doc = BOOK_RANKINGS;
    show(UP, 'EQIX', 809, { rankings: undefined });
    expect(fsLog.reads).toEqual([]);
    act(() => seen.pickQuestion('weakest_spot'));
    await settle();
    show(UP, 'EQIX', 809, { rankings: undefined });
    expect(fsLog.reads).toEqual(['indexIntelligence/stockRankings']);
    expect(seen.pack.items.map((i) => i.kind)).toContain('bench_alternative');
    fsLog.doc = null;
  });
  it('a bench name: Is this better than our weakest holding? reads them once and compares the rankings', async () => {
    fsLog.reads = []; fsLog.doc = BOOK_RANKINGS;
    show(UP, 'MSFT', 420, { rankings: undefined, row: { held: false } });
    act(() => seen.pickQuestion('better_than_stalled'));
    await settle();
    show(UP, 'MSFT', 420, { rankings: undefined, row: { held: false } });
    expect(fsLog.reads).toEqual(['indexIntelligence/stockRankings']);
    expect(seen.pack.items.map((i) => i.kind)).toContain('rank_scores');
    fsLog.doc = null;
  });
});
