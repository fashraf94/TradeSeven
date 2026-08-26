// Phase 5 — the dock corrections. Acceptance rows 11 and 12, plus R9.
//
// Node env (no jsdom): renderToString needs no DOM, and the source-level row
// reads StarCell.jsx through import.meta.url, which is only a file:// URL here.
//
// 5a and 5c pull in opposite directions on purpose: one REMOVES a display
// signal that claims weight the scoring does not have, the other PRESERVES a
// display signal that states a weight the scoring genuinely does have. Tested
// together so the distinction cannot be blurred by a later cleanup.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { StarCell } from './StarCell';
import { DecompositionStrip } from './DecompositionStrip';
import { deriveBeats } from '../../../utils/leagueBeats';
import { swapReasonLabel } from './leagueSwapLedger';
import { TOURNAMENT_TUNING } from '../../../constants/leagueTournament';

const star = (over = {}) => ({
  tk: 'NVDA', tier: 'star', dir: 'long', mult: 0.7, banked: 0, points: 4,
  badge: null, state: 'heating', justIn: false, ...over,
});

// ── 5a — acceptance 11: tick and dim identical across the three tiers ───────
describe('5a — tier is identity, never weight (acceptance 11)', () => {
  const SRC = readFileSync(new URL('./StarCell.jsx', import.meta.url), 'utf8');

  it('tierProminence returns ONE tick and ONE dim for star / core / support', () => {
    // Source-level: the function no longer branches on tier at all.
    const body = SRC.slice(SRC.indexOf('function tierProminence'), SRC.indexOf('// ── tier glyph'));
    expect(body).not.toMatch(/tier === 'star'/);
    expect(body).not.toMatch(/tier === 'core'/);
    expect(body).not.toMatch(/dim: 0\.82/);
    expect((body.match(/tick:/g) || []).length).toBe(1);
    expect((body.match(/dim:/g) || []).length).toBe(1);
  });

  it('the three tiers render at the SAME meter tick size and opacity', () => {
    const sizes = ['star', 'core', 'support'].map((tier) => {
      const html = renderToString(<StarCell star={star({ tier })} />);
      return {
        tier,
        ticks: [...html.matchAll(/font-size:([0-9.]+)px/g)].map((m) => m[1]).join(','),
        dims: [...html.matchAll(/opacity:([0-9.]+)/g)].map((m) => m[1]).join(','),
      };
    });
    expect(sizes[1].ticks).toBe(sizes[0].ticks);
    expect(sizes[2].ticks).toBe(sizes[0].ticks); // support used to be smaller
    expect(sizes[2].dims).toBe(sizes[0].dims);   // and dimmer (0.82)
  });

  it('the tier LABEL survives — identity is kept, only the scalar claim is dropped', () => {
    expect(renderToString(<StarCell star={star({ tier: 'star' })} />)).toMatch(/Star/);
    expect(renderToString(<StarCell star={star({ tier: 'support' })} />)).toMatch(/Support/);
  });

  it('NO tier multiplier is rendered anywhere (R1)', () => {
    for (const tier of ['star', 'core', 'support']) {
      const html = renderToString(<StarCell star={star({ tier })} />);
      expect(html).not.toMatch(/×\s?2|x2\.0|×\s?1\.5|x1\.5/);
    }
  });
});

// ── 5b — the swap motive reaches the caption (R9) ───────────────────────────
describe('5b — swap beats carry their motive', () => {
  const beatFor = (trade) => deriveBeats({ trades: [trade] }).find((b) => b.kind === 'swap');

  it('a deterministic exitReason prints its protective taxonomy, not a generic line', () => {
    const b = beatFor({ symbolOut: 'SOFI', symbolIn: 'MSTR', exitReason: 'guardrail_stopLoss', swappedOutAt: 1 });
    expect(b.text).toContain('swapped SOFI → MSTR');
    expect(b.text).toContain('stop-loss');
  });

  it('a declared motive prints its label', () => {
    const b = beatFor({ symbolOut: 'A', symbolIn: 'B', swapMotive: 'profit_take', swappedOutAt: 1 });
    expect(b.text).toContain('profit take');
  });

  it('the protective taxonomy OUTRANKS a stale declared motive (never "upgrade" on a stop)', () => {
    const b = beatFor({ symbolOut: 'A', symbolIn: 'B', exitReason: 'bust_avoidance', swapMotive: 'upgrade', swappedOutAt: 1 });
    expect(b.text).toContain('stop (bust avoidance)');
    expect(b.text).not.toContain('upgrade');
  });

  it('asked-and-omitted reads "undeclared" rather than being hidden', () => {
    const b = beatFor({ symbolOut: 'A', symbolIn: 'B', exitReason: 'haiku_decision', swapMotive: null, swappedOutAt: 1 });
    expect(b.text).toContain('undeclared');
  });

  it('FALLS BACK to the plain caption when nothing is stamped (legacy records)', () => {
    const b = beatFor({ symbolOut: 'SOFI', symbolIn: 'MSTR', swappedOutAt: 1 });
    expect(swapReasonLabel({})).toBe('agent decision'); // the generic non-answer…
    expect(b.text).toBe('swapped SOFI → MSTR');         // …is not printed
  });
});

// ── 5c — the ×1.5 disclosure STAYS (R2 / acceptance 12) ─────────────────────
describe('5c — DecompositionStrip is unchanged: the ×1.5 stays visible', () => {
  const DECOMP = {
    bankedPrior: 4, six: 3, swaps: 1, three: 2, dropped: 0.5,
    agentSide: 8, userLayer: 3.75, k: 1.5, orb: 11.75,
  };

  it('renders the user-layer weight badge', () => {
    const html = renderToString(<DecompositionStrip decomposition={DECOMP} />);
    expect(html).toMatch(/×1\.5/);
    expect(html).toMatch(/×1/);
  });

  it('k comes from the tuning constant, so the badge cannot drift from the math', () => {
    expect(TOURNAMENT_TUNING.USER_LAYER_K).toBe(1.5);
  });

  it('the split renders as TWO CONTRIBUTIONS, never as a ratio', () => {
    const html = renderToString(<DecompositionStrip decomposition={DECOMP} />);
    expect(html).toMatch(/Agent/);
    expect(html).toMatch(/User/);
    expect(html).not.toMatch(/\d+\s*[/:]\s*\d+\s*%|60\/40/); // no ratio rendering
  });
});
