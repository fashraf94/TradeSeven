// src/screens/battleView/PaneBench.render.test.jsx
//
// Phase B (B1 client half, seed §3 / §7) — the flag, in the rendered markup.
//
// The import IS the guard (BUILD_RULES §4). renderToString: effects do not
// run, so the markup is the whole claim.
//
// What these rows defend: a flagged name renders under the NAMED heading with
// the `Flagged` chip and leaves the rest of the roster; the signal text behind
// the flag never reaches the DOM; and without a candidates stamp the section
// is byte-identical to what Phase A3 shipped.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PaneBench from './PaneBench.jsx';
import { selectBench } from './selectBench';

const SLOT = '2026-09-01T16:45:00.000Z'; // 12:45 PM ET

const doc = (over = {}) => ({
  scoreState: { lastScoredAt: '2026-09-01T17:00:00.000Z' },
  portfolio: {
    star: [{ symbol: 'AAPL' }], core: [{ symbol: 'NVDA' }], support: [],
    bench: { stocks: [{ symbol: 'NOW' }, { symbol: 'TSLA' }], crypto: null },
  },
  watchlist: { hotBench: ['CRWD'] },
  agentContext: { equippedWatchlist: { name: 'Energy leaders', tickers: [] } },
  evaluations: [{
    evalId: 'e1', timestamp: SLOT, decision: 'HOLD',
    rationale: 'The book is steady.',
    ...over,
  }],
  chatExchanges: [],
});

const strip = (h) => h.replace(/<!-- -->/g, '');
const render = (battle) => strip(renderToString(<PaneBench bench={selectBench(battle)} />));

describe('PaneBench — the flag (Phase B)', () => {
  it('a flagged name renders under the NAMED heading with the `Flagged` chip', () => {
    const html = render(doc({ candidates: [{ symbol: 'NOW', direction: 'potential_entry' }] }));
    expect(html).toContain('data-bench-flagged="1"');
    expect(html).toContain('data-bench-flag-chip="NOW"');
    expect(html).toContain('Flagged');
    // Under the group heading that names the check by its slot (D-83).
    expect(html).toContain('Named at the 12:45 PM check');
  });

  it('the flagged name LEAVES the rest of the roster', () => {
    const html = render(doc({ candidates: [{ symbol: 'NOW', direction: 'potential_entry' }] }));
    // The rest row still exists for the names that were not flagged...
    expect(html).toContain('data-bench-chip="TSLA"');
    expect(html).toContain('data-bench-chip="CRWD"');
    // ...and NOW is in the named half of the section, not the muted one.
    // Fail-loud capture (review V-7): a `|| ['']` fallback makes every
    // assertion after it pass if the markup ever moves.
    const restGroup = html.match(/data-bench-rest-group[\s\S]*$/);
    expect(restGroup).not.toBeNull();
    expect(restGroup[0]).not.toContain('data-bench-chip="NOW"');
  });

  it('NO SIGNAL TEXT reaches the DOM — not the summary, not the threshold, not the source', () => {
    const html = render(doc({
      candidates: [{
        symbol: 'NOW', direction: 'potential_entry',
        signalSummary: 'BB squeeze + volume surge', threshold: '2.1x RVOL', signalSource: 'wire',
      }],
    }));
    expect(html).toContain('data-bench-flag-chip="NOW"');
    for (const leak of ['BB squeeze', 'volume surge', '2.1x RVOL', 'wire']) {
      expect(html).not.toContain(leak);
    }
  });

  it('the flag is a past fact, never a forecast — no eyeing, about to, will buy', () => {
    const html = render(doc({ candidates: [{ symbol: 'NOW', direction: 'potential_entry' }] })).toLowerCase();
    for (const forecast of ['eyeing', 'about to', 'will buy', 'close to a trade', 'considering']) {
      expect(html).not.toContain(forecast);
    }
  });

  it('the named group renders for a flag ALONE, with no sentence behind it', () => {
    // The rationale names no bench name, so there are no sentence cards — the
    // heading and the flag still have to appear.
    const html = render(doc({ candidates: [{ symbol: 'NOW', direction: 'potential_entry' }] }));
    expect(html).not.toContain('data-bench-card="0"');
    expect(html).toContain('Named at the 12:45 PM check');
    expect(html).toContain('data-bench-flagged="1"');
  });

  it('NO CANDIDATES STAMP → byte-identical to Phase A3', () => {
    const before = render(doc());
    expect(before).not.toContain('data-bench-flagged');
    expect(before).not.toContain('Flagged');
    // And the unflagged roster still holds every unspoken name.
    expect(before).toContain('data-bench-chip="NOW"');
    expect(render(doc({ candidates: [] }))).toBe(before);
  });

  // Review A-1. The whose-words footer is an authorship claim about QUOTED
  // TEXT. Phase B widened the named-group gate to admit a flag with no
  // sentence; the footer's gate did not widen with it, so a group holding only
  // a `Flagged` chip would have carried "The agent's own words" over a bench
  // name the agent wrote nothing about.
  it('a FLAGGED-ONLY group carries NO whose-words footer', () => {
    const html = render({
      ...doc({
        // A downgraded entry gives selectWhyState a non-null footer...
        downgraded: true, decision: 'SWAP', symbolOut: 'AAPL', symbolIn: 'AVGO',
        // ...while the rationale names no bench symbol, so there are no cards.
        rationale: 'Rotating the star slot into AVGO on relative strength.',
        candidates: [{ symbol: 'NOW', direction: 'potential_entry' }],
      }),
    });
    expect(html).toContain('data-bench-flagged="1"');
    expect(html).not.toContain('data-bench-card="0"');
    expect(html).not.toContain('data-bench-footer');
    expect(html).not.toContain("The agent's own words");
  });

  it('but a group WITH a quoted sentence still carries it (D-80 unbroken)', () => {
    const html = render(doc({
      downgraded: true, decision: 'SWAP', symbolOut: 'AAPL', symbolIn: 'AVGO',
      rationale: 'NOW would need +7.4% more to lock in the bonus.',
    }));
    expect(html).toContain('data-bench-card="0"');
    expect(html).toContain('data-bench-footer="1"');
  });

  it('a name the check SPOKE about keeps its sentence and gains no second chip', () => {
    const html = render(doc({
      rationale: 'NOW would need +7.4% more to lock in the bonus.',
      candidates: [{ symbol: 'NOW', direction: 'potential_entry' }],
    }));
    expect(html).toContain('data-bench-card-symbols="NOW"');
    expect(html).not.toContain('data-bench-flagged="1"');
  });
});
