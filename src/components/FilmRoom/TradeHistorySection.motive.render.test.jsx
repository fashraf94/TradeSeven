// src/components/FilmRoom/TradeHistorySection.motive.render.test.jsx
//
// Swap Motive Observability (Tier 1) — the Film Room reason display, DARK by
// default. Flag OFF ⇒ no reason label on any row (byte-identical to pre-Tier-1);
// flag ON ⇒ every row shows its one human reason. renderToString (no jsdom in this
// repo); the flag is getter-mocked (the behavior-test precedent), the reason helper
// runs UN-mocked. filterTradesByDay is stubbed to pass the fixtures straight through.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const { flagState } = vi.hoisted(() => ({ flagState: { on: false } }));

vi.mock('../../config/featureFlags', () => ({
  get SWAP_MOTIVE_DISPLAY_ENABLED() { return flagState.on; },
}));

vi.mock('../../utils/computeDayScore', () => ({
  filterTradesByDay: (trades) => trades,
}));

import TradeHistorySection from './TradeHistorySection';

const tokens = {};
const battle = {
  trades: [
    { symbolOut: 'AMD', symbolIn: 'NVDA', entryPrice: 100, exitPrice: 110, lockedPoints: 5, swapMotive: 'profit_take', exitReason: 'haiku_decision' },
    { symbolOut: 'DIS', symbolIn: 'KO', entryPrice: 50, exitPrice: 48, lockedPoints: -2, exitReason: 'bust_avoidance' },
    { symbolOut: 'F', symbolIn: 'GM', entryPrice: 10, exitPrice: 10, lockedPoints: 0, exitReason: 'haiku_decision' }, // legacy model swap
  ],
};

const render = () => renderToString(<TradeHistorySection battle={battle} dayNum={1} tokens={tokens} />);

describe('TradeHistorySection — swap motive display flag', () => {
  beforeEach(() => { flagState.on = false; });

  it('flag OFF: renders NO reason label (byte-identity — the strings never appear)', () => {
    const html = render();
    expect(html).not.toContain('profit take');
    expect(html).not.toContain('stop (bust avoidance)');
    expect(html).not.toContain('agent decision');
    // the numbers/symbols the row always shows are still present
    expect(html).toContain('AMD');
    expect(html).toContain('Entry');
  });

  it('flag ON: every row shows its one human reason (declared, deterministic, legacy)', () => {
    flagState.on = true;
    const html = render();
    expect(html).toContain('profit take');          // declared model motive
    expect(html).toContain('stop (bust avoidance)'); // deterministic taxonomy
    expect(html).toContain('agent decision');        // legacy model swap — never a fabricated motive
  });

  it('flag ON: a non-swap row (neither symbol) gets NO reason badge (isSwapTrade gate)', () => {
    flagState.on = true;
    const nonSwap = { swapDay: 1, lockedPoints: 3, exitReason: 'haiku_decision' }; // no symbolOut/In
    const html = renderToString(
      <TradeHistorySection battle={{ trades: [nonSwap] }} dayNum={1} tokens={tokens} />,
    );
    // the row renders, but no fabricated swap-reason label is attached to it
    expect(html).not.toContain('agent decision');
    expect(html).not.toContain('undeclared');
  });
});
