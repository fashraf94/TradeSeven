// @vitest-environment jsdom
//
// src/A4.conditionalHooks.jsdom.test.jsx
//
// A4 — THE FLIP-ABLE CONDITIONAL HOOKS, MOUNTED AND FLIPPED.
//
// docs/audits/20260913_LINT_NODE_GLOBALS.md §7 A4 recorded 19
// `react-hooks/rules-of-hooks` errors across 11 files: hooks called after an
// early return, so the hook COUNT depends on a condition. React only crashes
// when that condition changes between renders of the SAME mounted component
// ("Rendered more hooks than during the previous render") — which is why the
// class survives testing and fails in production on one specific path.
//
// Of the 19, three sites are FLIP-ABLE AND CRASH-CLASS: the condition changes
// on a mounted component AND the change crosses a hook. Each gets a row here
// that renders one way, re-renders the other way, and asserts a clean render.
//
// A fourth site — DesktopBackground.jsx:14 — has a flip-able condition
// (`isDesktop` tracks a resize listener) but is NOT crash-class, and it has no
// row here on purpose. That memo is the component's ONLY hook and the early
// return preceded it, so the flip moved the component between 0 and 1 hooks.
// React picks its dispatcher on `current.memoizedState !== null`, so a render
// that called no hooks leaves the next one on the MOUNT path — no order check
// runs. The reverse (1 -> 0) never advances `currentHook`, so the "too few
// hooks" check never fires either. Rows for it passed against the pre-fix tree
// and were removed: BUILD_RULES §2, a row that cannot fail under the defect it
// names is not a guard. The contrast is visible two rows down —
// StonkOptionsPosition has one hook BEFORE its early return and one after, so
// the same shape of flip moves it 1 <-> 2 and crashes in both directions.
//
// The remaining 15 are STATIC — the condition is fixed for the component's
// life. Their guard is `react-hooks/rules-of-hooks` at zero — and that rule
// is NOT RUN BY CI today (neither workflow runs `npm run lint`), so it is a
// guard a human has to run, not a check that will stop a regression. Closing
// that is the interim gate the build record's §6 leaves as the founder's
// call. The per-site classification is in that record.
//
// SHOWN FAILING FIRST. Against the pre-fix tree every row here fails with
// React's own hook-order error, e.g.
//   Error: Rendered more hooks than during the previous render.
// These rows are therefore guards, not decoration: they cannot pass on the
// code they were written against.
//
// NOTE ON WHAT THESE ROWS DO NOT CLAIM. They assert the crash is gone, not
// that the surface looks the same — the "no visual change" invariant is held
// by the diff (hook placement only) and by the preview smoke, not here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// StonkOptionsPosition's valuation comes from the options engine; stub it so
// the row turns on `currentPrice` alone, which is the condition that flips.
vi.mock('./services/stonkOptionsEngineV2', () => ({
  calculateLiveValue: (contract, currentPrice) => ({
    currentValue: 120,
    profitLoss: 20,
    percentReturn: 20,
    isITM: currentPrice >= contract.strike,
    isExpired: false,
    isWinning: true,
    status: 'open',
    daysRemaining: 3,
    timeDisplay: '3d',
    winProbability: 0.5,
  }),
}));

import StonkOptionsPosition from './components/StonkOptionsPosition';
import { AssetSide } from './components/BaggerBomb/TacticalRow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.clearAllMocks();
});

/**
 * Render `el`, then re-render `el2` into the SAME root — the mounted-component
 * re-render that a conditional hook turns into a crash. Any React error is
 * re-thrown by act(), so a surviving call means the hook order held.
 */
const renderThenRerender = async (el, el2) => {
  await act(async () => { root.render(el); });
  await act(async () => { root.render(el2); });
};

const CONTRACT = {
  id: 'c1',
  symbol: 'AAPL',
  direction: 'call',
  strike: 200,
  entryPrice: 190,
  entryAmount: 100,
  daysToExpiry: 3,
  payoutMultiplier: 2,
  potentialPayout: 200,
};

const ASSET = {
  symbol: 'AAPL',
  priceChange: 3.2,
  thresholdPriceChange: 3.2,
  baseATR: 2.5,
  history: { maxMultiplier: 1.0, minMultiplier: 0 },
  points: 12,
  badges: [],
};

describe('A4 — flip-able conditional hooks survive the flip', () => {
  // ── Site 16: src/components/StonkOptionsPosition.jsx:48 (useMemo) ────────
  // `valuation` is null until a price lands, and the arena streams prices in
  // live — so the early return fires on the card's first renders and stops.
  it('StonkOptionsPosition: currentPrice arrives after the first render', async () => {
    await renderThenRerender(
      <StonkOptionsPosition contract={CONTRACT} currentPrice={undefined} />,
      <StonkOptionsPosition contract={CONTRACT} currentPrice={205} />
    );
    expect(container.textContent).toContain('AAPL');
  });

  it('StonkOptionsPosition: the price goes away again', async () => {
    await renderThenRerender(
      <StonkOptionsPosition contract={CONTRACT} currentPrice={205} />,
      <StonkOptionsPosition contract={CONTRACT} currentPrice={undefined} />
    );
    // The row's real guard is act() rethrowing React's hook-order error; this
    // asserts the card is actually gone rather than merely textless.
    expect(container.querySelector('div')).toBeNull();
  });

  // ── Sites 7-8: src/components/BaggerBomb/TacticalRow.jsx:179, 211 ────────
  // AssetSide. The Snake Draft gold-standard surface: an empty slot fills when
  // a pick lands, and a cash slot becomes a position on a swap. Both are the
  // same mounted row re-rendering with a different `asset`.
  it('AssetSide: an empty draft slot fills when a pick lands', async () => {
    await renderThenRerender(
      <AssetSide asset={null} />,
      <AssetSide asset={ASSET} />
    );
    expect(container.textContent).toContain('AAPL');
  });

  it('AssetSide: a cash slot becomes a position on a swap', async () => {
    await renderThenRerender(
      <AssetSide asset={{ isCash: true }} />,
      <AssetSide asset={ASSET} />
    );
    expect(container.textContent).toContain('AAPL');
  });

  it('AssetSide: a position is swapped back out to cash', async () => {
    await renderThenRerender(
      <AssetSide asset={ASSET} />,
      <AssetSide asset={{ isCash: true }} />
    );
    expect(container.textContent).toContain('CASH');
  });
});
