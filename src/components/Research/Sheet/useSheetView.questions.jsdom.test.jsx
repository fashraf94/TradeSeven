// @vitest-environment jsdom
//
// QF-1 (build prompt of Nov 13, 2026): the question set is decided ONCE when the row opens and kept —
// a tick, a check landing or a move across entry never switches it while the modal is open (the FQ-9
// rule). QF-8: the agent's name goes through the cockpit's agentNameOf — *Shadow*, never *shadow*.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

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
