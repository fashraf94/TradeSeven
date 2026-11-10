// @vitest-environment jsdom
//
// Research Modal Build C — useSheetView on its own (review C5 — CU3): BC-11's
// incumbent belongs to the stock the cockpit's bench door opened. A player who
// navigates inside the modal to another stock opens that one on Layer 0, with
// no incumbent and no stalled question pre-picked.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

import useSheetView from './useSheetView.js';
import { measuredSheetBattle, SHEET_NOW, AAPL_DAILY, RANKINGS } from './__fixtures__/sheetBattles.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let BATTLE;
beforeAll(async () => { BATTLE = await measuredSheetBattle({ archetype: 'momentum_chaser' }); });
let container, root, seen;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(SHEET_NOW));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  seen = null;
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

function Probe(props) {
  seen = useSheetView(props);
  return null;
}
const ctx = () => ({ battleId: 'stock-battle', agentId: 'agent', battle: BATTLE, calls: [], rankings: RANKINGS, standing: null, directive: BATTLE.directive, incumbent: 'ETH', row: { held: false } });
const show = (symbol, isOriginal) => act(() => {
  root.render(<Probe on context={ctx()} symbol={symbol} isOriginal={isOriginal} live={103.2} rawData={AAPL_DAILY} timeframe="1D" analysisActive />);
});

describe('BC-11: the incumbent stays with the stock the bench door opened', () => {
  it('opened from the door: the stalled question, with the incumbent item', () => {
    show('NVDA', true);
    expect(seen.question).toBe('better_than_stalled');
    expect(seen.pack.items.map((i) => i.kind)).toContain('incumbent');
  });
  it('navigated to another stock inside the modal: Layer 0, no incumbent', () => {
    show('NVDA', true);
    show('MSFT', false);
    expect(seen.symbol).toBe('MSFT');
    expect(seen.question).toBeNull();
    act(() => seen.pickQuestion('better_than_stalled'));
    expect(seen.pack.items.map((i) => i.kind)).not.toContain('incumbent');
  });
});
