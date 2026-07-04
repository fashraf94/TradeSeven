/**
 * CorrelationLab — Build 3.1 clarity-pass render smoke + gauge-state unit suite.
 *
 * As with the other repo render smokes, there is no jsdom/RTL — react-dom/server
 * renders the exported presentation pieces WITHOUT a DOM (no effects), enough to
 * prove the new 'stretched' tension chip and the three conditioned-panel branches
 * compose the pinned copy. divergenceState is a pure map, tested directly.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Neutralize the Firebase module-load side effect (config.js throws without
// env) so we can import CorrelationLab's presentation exports — the SectorRail
// test idiom. These pieces never call fetchWithAuth; the mock just lets the
// module graph load in the Node test env.
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));

import { ScanResults, ConditionedBaseRates, divergenceState } from './CorrelationLab.jsx';

const AMBER = '#f59e0b';
const RED = '#EF4444';

// react-dom/server inserts `<!-- -->` markers between adjacent text/expression
// nodes; strip them so assertions can match copy that spans an interpolation.
const render = (el) => renderToString(el).replace(/<!-- -->/g, '');

// ── Change A — the Divergence Watch state map (server-authoritative + fallback) ─
describe('divergenceState — coherent five-state map', () => {
  it('renders the server-computed state, spelling break as "in break territory"', () => {
    expect(divergenceState({ state: 'calm', score: 0.4, d: 0.9 }).word).toBe('calm');
    expect(divergenceState({ state: 'elevated', score: 1.5, d: 0.9 }).word).toBe('elevated');
    expect(divergenceState({ state: 'break', score: 2.6, d: 0.3 })).toMatchObject({
      word: 'in break territory',
      color: RED,
    });
  });

  it('gives stretched the amber color and the pinned "not a break" note', () => {
    expect(divergenceState({ state: 'stretched', score: -2.44, d: -0.22 })).toEqual({
      word: 'stretched',
      color: AMBER,
      note: 'Unusual versus its own history — but the gap is still small. Not a break.',
    });
  });

  it('null latest / null state → "not scoreable yet"', () => {
    expect(divergenceState(null).word).toBe('not scoreable yet');
    expect(divergenceState({ state: null, score: null, d: 0.1 }).word).toBe('not scoreable yet');
  });

  it('pre-3.1 cached payload (no state field) falls back to score-only, never stretched', () => {
    // A high score with a tiny gap would be 'stretched' server-side, but the
    // legacy fallback has no floor — it can only say 'break' (or below). This is
    // the transient pre-refresh behavior, not a regression of calm/elevated/break.
    expect(divergenceState({ score: 2.5, d: 0.05 }).word).toBe('in break territory');
    expect(divergenceState({ score: 1.5, d: 0.9 }).word).toBe('elevated');
    expect(divergenceState({ score: 0.2, d: 0.9 }).word).toBe('calm');
    expect(divergenceState({ score: null, d: 0.9 }).word).toBe('not scoreable yet');
  });
});

// ── Change A — the scan table renders the new 'stretched' chip ────────────────
describe('ScanResults — stretched tension chip', () => {
  const scan = {
    summary: null,
    rows: [
      {
        driver: 'HYG', label: 'High-yield credit (HYG)', category: 'Risk & rates',
        corr20: -0.62, corr60: -0.55, d: -0.22, score: -2.44,
        tensionState: 'stretched', joinedCloses: 400, tier: 'established', identity: false,
      },
      {
        driver: 'TNX', label: '10Y Yield', category: 'Macro',
        corr20: 0.71, corr60: 0.66, d: 0.30, score: 2.6,
        tensionState: 'break', joinedCloses: 400, tier: 'established', identity: false,
      },
    ],
    droppedDrivers: [],
    meta: { computedAt: '2026-07-03T20:00:00Z', cached: false, group: ['KBE'] },
  };

  it('renders a stretched row as the new amber chip (not "—" or "break")', () => {
    const html = render(
      <ScanResults scan={scan} isDesktop onDeepDive={() => {}} onRefresh={() => {}} />
    );
    expect(html).toContain('stretched'); // the new chip word rendered
    expect(html).toContain('break');     // the genuine break row still reads break
    // amber chip color is present (the stretched/elevated accent)
    expect(html.toLowerCase()).toContain(AMBER);
  });
});

// ── Change C — the three conditioned-panel branches ──────────────────────────
describe('ConditionedBaseRates — no-contrast collapse branches', () => {
  const above = (n) => Array.from({ length: n }, () => ({ contextAtFlag: { vs50DMA: 'above' } }));
  const below = (n) => Array.from({ length: n }, () => ({ contextAtFlag: { vs50DMA: 'below' } }));

  it('collapses to ONE sentence when every break fired on one 50DMA side', () => {
    const html = render(
      <ConditionedBaseRates
        byCondition={{
          above50DMA: { 5: { independentCount: 9, median: 0.02, hitRate: 0.66 } },
          below50DMA: { 5: { independentCount: 0, median: null, hitRate: null } },
        }}
        inflections={above(12)}
      />
    );
    expect(html).toContain('All 12 breaks fired in an uptrend');
    expect(html).toContain('no contrast to show until breaks occur');
    // no numbers repeated — the per-horizon median lines must NOT render
    expect(html).not.toContain('median');
  });

  it('uses grammatical singular copy when exactly one break fired (n === 1)', () => {
    const html = render(
      <ConditionedBaseRates
        byCondition={{
          above50DMA: { 5: { independentCount: 0, median: null, hitRate: null } },
          below50DMA: { 5: { independentCount: 1, median: null, hitRate: null } },
        }}
        inflections={below(1)}
      />
    );
    expect(html).toContain('The only break fired in a downtrend');
    expect(html).not.toContain('All 1 break');
  });

  it('renders per-side grouped lines under trend-word headers when both sides fired', () => {
    const html = render(
      <ConditionedBaseRates
        byCondition={{
          above50DMA: { 5: { independentCount: 5, median: 0.02, hitRate: 0.6 } },
          below50DMA: { 5: { independentCount: 4, median: -0.01, hitRate: 0.25 } },
        }}
        inflections={[...above(5), ...below(4)]}
      />
    );
    expect(html).toContain('Breaks that fired in an uptrend (above the 50DMA)');
    expect(html).toContain('Breaks that fired in a downtrend (below the 50DMA)');
    expect(html).toContain('+5d (n=5)');           // ≥5 independent → percentage tier
    expect(html).toContain('positive 60% of the time');
    expect(html).toContain('1 of 4 positive');      // 3–4 independent → raw tally, no %
    expect(html).not.toContain('no contrast');      // this is genuine contrast, not a collapse
  });

  it('keeps the "not enough on either side" copy when both sides are sub-3 independent', () => {
    const html = render(
      <ConditionedBaseRates
        byCondition={{
          above50DMA: { 5: { independentCount: 2, median: null, hitRate: null } },
          below50DMA: { 5: { independentCount: 2, median: null, hitRate: null } },
        }}
        inflections={[...above(2), ...below(2)]}
      />
    );
    expect(html).toContain('Not enough breaks on either side of the 50DMA');
    expect(html).not.toContain('no contrast');
    expect(html).not.toContain('Breaks that fired');
  });

  it('renders nothing when byCondition is absent (pre-Build-3 cached payload)', () => {
    expect(render(<ConditionedBaseRates byCondition={null} inflections={[]} />)).toBe('');
  });
});
