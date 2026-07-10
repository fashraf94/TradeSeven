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
// V2 Build 6 — CorrelationLab now imports the two source hooks (which pull in
// useAgent/UserContext/firestore). Stub them so the presentation-export module
// graph stays light in the Node test env; the render smokes drive SourceChips /
// ProvenanceLine with explicit props, never the live hooks.
vi.mock('../../hooks/useWatchlistGroup', () => ({ default: () => null }));
vi.mock('../../hooks/useAgentBookGroup', () => ({ default: () => null }));

import {
  ScanResults,
  ConditionedBaseRates,
  ConditionalCard,
  CohesionCard,
  RelationshipQualityCard,
  ReadQualityCard,
  SinceLastScanStrip,
  SourceChips,
  ProvenanceLine,
  divergenceState,
  leadLagEvidenceLine,
  resolveResultLabels,
} from './CorrelationLab.jsx';
// Build 4 — the conditional verdict chip is a pure copy helper and lives with
// the other presentation-honesty templates in correlationVerdict.js.
import { conditionalVerdict, buildVerdictSentence } from './correlationVerdict';

const AMBER = '#f59e0b';
const RED = '#EF4444';

// react-dom/server inserts `<!-- -->` markers between adjacent text/expression
// nodes; strip them so assertions can match copy that spans an interpolation.
const render = (el) => renderToString(el).replace(/<!-- -->/g, '');

// ── Change A — the Divergence Watch state map (server-authoritative + fallback) ─
describe('divergenceState — coherent five-state map', () => {
  it('renders the server-computed state, spelling break as "in break territory" with its H6 explainer', () => {
    expect(divergenceState({ state: 'calm', score: 0.4, d: 0.9 }).word).toBe('calm');
    expect(divergenceState({ state: 'elevated', score: 1.5, d: 0.9 }).word).toBe('elevated');
    expect(divergenceState({ state: 'break', score: 2.6, d: 0.3 })).toMatchObject({
      word: 'in break territory',
      color: RED,
      note: 'The gap is both unusual and large — this is the condition that logs a regime break in the table below.',
    });
  });

  it('appends the H6 strain explainer to stretched’s pinned "not a break" caption (amber)', () => {
    expect(divergenceState({ state: 'stretched', score: -2.44, d: -0.22 })).toEqual({
      word: 'stretched',
      color: AMBER,
      note: 'Unusual versus its own history — but the gap is still small. Not a break. The relationship is under strain. From here it either settles back to normal, or — if the gap keeps widening past the break threshold — becomes a regime break like the ones listed below.',
    });
  });

  it('calm and elevated carry NO explainer note (unchanged — they keep the default caption)', () => {
    expect(divergenceState({ state: 'calm', score: 0.4, d: 0.9 }).note).toBeUndefined();
    expect(divergenceState({ state: 'elevated', score: 1.5, d: 0.9 }).note).toBeUndefined();
  });

  it('the attention-state explainers use no banned predictive words (presentation-honesty)', () => {
    const BANNED = ['predict', 'expect', 'will likely'];
    for (const state of ['stretched', 'break']) {
      const note = divergenceState({ state, score: -2.44, d: -0.22 }).note.toLowerCase();
      for (const w of BANNED) expect(note).not.toContain(w);
    }
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

// ── H7 — the lead-lag evidence line under a flat verdict ──────────────────────
describe('leadLagEvidenceLine — evidence under coincident / none', () => {
  // leadLag.table rows are { lag, corr, n }; lag 0 is same-day (maxLag 5 → -5..+5).
  const mkTable = () => [
    { lag: -2, corr: -0.11, n: 100 },
    { lag: -1, corr: 0.3, n: 100 },
    { lag: 0, corr: 0.52, n: 100 },
    { lag: 1, corr: 0.28, n: 100 },
    { lag: 2, corr: -0.41, n: 100 }, // largest |corr| among the nonzero lags
  ];

  it('coincident: names the strongest lagged reading against same-day', () => {
    const line = leadLagEvidenceLine({ verdict: 'coincident', lag0Corr: 0.52, table: mkTable() });
    expect(line).toBe(
      'Strongest lagged reading: +2d at r = -0.41 — not meaningfully different from same-day (0.52 r).'
    );
  });

  it("none verdict also renders (it's the other flat verdict)", () => {
    const line = leadLagEvidenceLine({ verdict: 'none', lag0Corr: 0.02, table: mkTable() });
    expect(line).toContain('Strongest lagged reading: +2d at r = -0.41');
    expect(line).toContain('same-day (0.02 r)');
  });

  it('a negative best lag prints its sign; a |corr| tie breaks to the nearer lag', () => {
    const table = [
      { lag: -1, corr: 0.4, n: 100 },
      { lag: 0, corr: 0.1, n: 100 },
      { lag: 3, corr: -0.4, n: 100 }, // equal |corr| but farther → -1 wins
    ];
    const line = leadLagEvidenceLine({ verdict: 'coincident', lag0Corr: 0.1, table });
    expect(line).toContain('-1d at r = 0.40');
  });

  it('renders nothing for a directional verdict (driver_leads / group_leads keep their sentence)', () => {
    expect(
      leadLagEvidenceLine({ verdict: 'driver_leads', bestLag: 2, lag0Corr: 0.3, table: mkTable() })
    ).toBeNull();
    expect(
      leadLagEvidenceLine({ verdict: 'group_leads', bestLag: -1, lag0Corr: 0.3, table: mkTable() })
    ).toBeNull();
  });

  it('guards nulls: no leadLag, null table, no usable nonzero row, or missing lag0 → null', () => {
    expect(leadLagEvidenceLine(null)).toBeNull();
    expect(leadLagEvidenceLine({ verdict: 'coincident', lag0Corr: 0.5, table: null })).toBeNull();
    expect(
      leadLagEvidenceLine({
        verdict: 'none',
        lag0Corr: 0.5,
        table: [{ lag: 1, corr: null, n: 3 }, { lag: 0, corr: 0.5, n: 4 }],
      })
    ).toBeNull();
    expect(leadLagEvidenceLine({ verdict: 'coincident', lag0Corr: null, table: mkTable() })).toBeNull();
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

// ══════════════════════════════════════════════════════════════════════════════
// V2 Build 4 — WHEN DOES THE LINK HOLD? (conditional correlation card)
// ══════════════════════════════════════════════════════════════════════════════

// A realistic full block (the energy-trio shape): asymmetric toward down days.
const ddBlock = (over = {}) => ({
  up: { corr: 0.44, n: 251 },
  down: { corr: 0.61, n: 248 },
  asymmetric: true,
  direction: 'down',
  counts: { up: 251, down: 248 },
  labels: { up: 'days Brent Crude (BNO proxy) rose', down: 'days Brent Crude (BNO proxy) fell' },
  ...over,
});

describe('conditionalVerdict — the pinned chip copy', () => {
  const SIDES = ['up', 'down'];

  it('asymmetric → "tighter on {winning-side label}" (the down-day classic)', () => {
    expect(conditionalVerdict(ddBlock(), SIDES, 60)).toEqual({
      kind: 'tighter',
      text: 'tighter on days Brent Crude (BNO proxy) fell',
    });
  });

  it('not asymmetric → exactly "no meaningful difference" — never a percentage, never "significant"', () => {
    // The symmetric-truncation discriminator's copy pin: BOTH sides sit below
    // the full-sample headline (subsetting truncates variance), yet the honest
    // verdict is that the sides match EACH OTHER.
    const v = conditionalVerdict(
      ddBlock({ up: { corr: 0.5, n: 294 }, down: { corr: 0.53, n: 306 }, asymmetric: false, direction: null }),
      SIDES,
      60
    );
    expect(v).toEqual({ kind: 'nodiff', text: 'no meaningful difference' });
    expect(v.text).not.toMatch(/%|significan/i);
  });

  it('a null side → "not enough {side label} (n={real n}, 60 needed)"', () => {
    const v = conditionalVerdict(
      ddBlock({ down: null, asymmetric: null, direction: null, counts: { up: 251, down: 41 } }),
      SIDES,
      60
    );
    expect(v).toEqual({
      kind: 'insufficient',
      text: 'not enough days Brent Crude (BNO proxy) fell (n=41, 60 needed)',
    });
  });

  it('both sides null names the smaller-n side (the binding constraint)', () => {
    const v = conditionalVerdict(
      {
        up: null,
        down: null,
        asymmetric: null,
        direction: null,
        counts: { up: 55, down: 12 },
        labels: { up: 'uptrend days', down: 'downtrend days' },
      },
      SIDES,
      60
    );
    expect(v.text).toBe('not enough downtrend days (n=12, 60 needed)');
  });

  it('a null side with ≥ 60 days (degenerate subset) says "couldn\'t measure", never a lying count', () => {
    const v = conditionalVerdict(
      ddBlock({ up: null, asymmetric: null, direction: null, counts: { up: 179, down: 180 } }),
      SIDES,
      60
    );
    expect(v).toEqual({
      kind: 'unmeasurable',
      text: "couldn't measure days Brent Crude (BNO proxy) rose",
    });
  });

  it('asymmetric with a NULL direction (the exact sign-flip tie) degrades to the no-difference verdict', () => {
    const v = conditionalVerdict(ddBlock({ direction: null }), SIDES, 60);
    expect(v).toEqual({ kind: 'nodiff', text: 'no meaningful difference' });
  });

  it('missing block (old cached shape) → null, and the server minObs drives the copy', () => {
    expect(conditionalVerdict(undefined, SIDES, 60)).toBeNull();
    const v = conditionalVerdict(
      ddBlock({ down: null, asymmetric: null, direction: null, counts: { up: 251, down: 41 } }),
      SIDES,
      80 // a hypothetical future floor must flow into the copy — one home, the server
    );
    expect(v.text).toContain('(n=41, 80 needed)');
  });
});

describe('ConditionalCard — render smoke (three rows, pinned caption, honest sides)', () => {
  const conditional = {
    minObs: 60,
    driverDirection: ddBlock(),
    volRegime: {
      high: { corr: 0.52, n: 169 },
      calm: { corr: 0.47, n: 171 },
      asymmetric: false,
      direction: null,
      counts: { high: 169, calm: 171 },
      labels: { high: 'high-vol days', calm: 'calm days' },
    },
    trendState: {
      up: { corr: 0.41, n: 183 },
      down: null,
      asymmetric: null,
      direction: null,
      counts: { up: 183, down: 44 },
      labels: { up: 'uptrend days', down: 'downtrend days' },
    },
  };

  it('renders the three condition rows with side numbers in the pinned "r = +0.61 (n=248)" form', () => {
    const html = render(<ConditionalCard conditional={conditional} isDesktop />);
    expect(html).toContain('When does the link hold?');
    expect(html).toContain('Driver direction');
    expect(html).toContain('Volatility regime');
    expect(html).toContain('Group trend');
    expect(html).toContain('r = +0.61 (n=248)');
    expect(html).toContain('r = +0.44 (n=251)');
    expect(html).toContain('r = +0.52 (n=169)');
  });

  it('renders the pinned truncation-guard caption verbatim', () => {
    const html = render(<ConditionalCard conditional={conditional} isDesktop />);
    expect(html).toContain(
      'Each side is measured on a subset of days, which naturally lowers both readings — compare the two sides to each other, not to the headline link above.'
    );
  });

  it('renders one of each verdict chip: tighter / no meaningful difference / not enough', () => {
    const html = render(<ConditionalCard conditional={conditional} isDesktop />);
    expect(html).toContain('tighter on days Brent Crude (BNO proxy) fell');
    expect(html).toContain('no meaningful difference');
    expect(html).toContain('not enough downtrend days (n=44, 60 needed)');
    // the null side prints an honest dash + its real day count, never a number
    expect(html).toContain('— (n=44)');
  });

  it('stacks (flex column) on mobile and still renders every row', () => {
    const html = render(<ConditionalCard conditional={conditional} isDesktop={false} />);
    expect(html).toContain('flex-direction:column');
    expect(html).not.toContain('display:grid');
    expect(html).toContain('Group trend');
    expect(html).toContain('tighter on days Brent Crude (BNO proxy) fell');
  });

  it('absence tolerance: a pre-Build-4 cached payload (no conditional field) renders NOTHING without error', () => {
    expect(render(<ConditionalCard conditional={undefined} isDesktop />)).toBe('');
    expect(render(<ConditionalCard conditional={null} isDesktop />)).toBe('');
  });

  it('no banned vocabulary anywhere on the card (presentation-honesty)', () => {
    const html = render(<ConditionalCard conditional={conditional} isDesktop />);
    expect(html.toLowerCase()).not.toContain('significan');
    expect(html).not.toMatch(/\d+(\.\d+)?%/); // no percentages — r values and counts only
  });
});

// ── Build 4 review fixes — null-never-zero counts + server-owned side keys ────
describe('conditionalVerdict + ConditionalCard — review fixes', () => {
  it('a null side with a MISSING count says "couldn\'t measure", never a fabricated n=0', () => {
    const v = conditionalVerdict(
      ddBlock({ down: null, asymmetric: null, direction: null, counts: { up: 251 } }),
      ['up', 'down'],
      60
    );
    expect(v).toEqual({
      kind: 'unmeasurable',
      text: "couldn't measure days Brent Crude (BNO proxy) fell",
    });
    expect(v.text).not.toContain('n=0');
  });

  it('the side cell prints a bare dash (no n) when the count is missing', () => {
    const conditional = {
      minObs: 60,
      driverDirection: ddBlock({ down: null, asymmetric: null, direction: null, counts: { up: 251 } }),
    };
    const html = render(<ConditionalCard conditional={conditional} isDesktop />);
    expect(html).not.toContain('(n=0)');
    expect(html).toContain('—');
  });

  it('server-sent sides win over the client fallback pair (rename-safe rendering)', () => {
    // A hypothetical future server rename: volRegime sides become loud/quiet.
    // The card must render the SERVER keys — real numbers, real labels — not
    // a false insufficiency from a stale client mirror.
    const conditional = {
      minObs: 60,
      volRegime: {
        loud: { corr: 0.52, n: 169 },
        quiet: { corr: 0.47, n: 171 },
        sides: ['loud', 'quiet'],
        asymmetric: false,
        direction: null,
        counts: { loud: 169, quiet: 171 },
        labels: { loud: 'loud days', quiet: 'quiet days' },
      },
    };
    const html = render(<ConditionalCard conditional={conditional} isDesktop />);
    expect(html).toContain('loud days');
    expect(html).toContain('r = +0.52 (n=169)');
    expect(html).toContain('no meaningful difference');
    expect(html).not.toContain('not enough'); // the C6 failure mode never renders
  });
});

// ── Founder-folded sign-flip verdict (pre-PR) ─────────────────────────────────
describe('conditionalVerdict + ConditionalCard — sign-flip reversal verdict', () => {
  // A flip block: link positive on side A (up), negative on side B (down).
  const flipBlock = (over = {}) => ({
    up: { corr: 0.31, n: 240 },
    down: { corr: -0.29, n: 250 },
    sides: ['up', 'down'],
    asymmetric: true,
    direction: null,
    flipped: true,
    counts: { up: 240, down: 250 },
    labels: { up: 'days the 10Y yield rose', down: 'days the 10Y yield fell' },
    ...over,
  });

  it('names the positive and negative sides — never "tighter", never a percentage', () => {
    const v = conditionalVerdict(flipBlock(), ['up', 'down'], 60);
    expect(v).toEqual({
      kind: 'flipped',
      text: 'same direction on days the 10Y yield rose, opposite on days the 10Y yield fell',
    });
    expect(v.text).not.toContain('tighter');
    expect(v.text).not.toMatch(/%|significan/i);
  });

  it('identifies the positive side by sign, whichever key holds it', () => {
    // Reversed signs: side A (up) is now the negative one.
    const v = conditionalVerdict(
      flipBlock({ up: { corr: -0.31, n: 240 }, down: { corr: 0.29, n: 250 } }),
      ['up', 'down'],
      60
    );
    expect(v.text).toBe(
      'same direction on days the 10Y yield fell, opposite on days the 10Y yield rose'
    );
  });

  it('renders the flip chip (gold accent) with both signed side numbers in the card', () => {
    const conditional = { minObs: 60, driverDirection: flipBlock() };
    const html = render(<ConditionalCard conditional={conditional} isDesktop />);
    expect(html).toContain('same direction on days the 10Y yield rose, opposite on days the 10Y yield fell');
    expect(html).toContain('r = +0.31 (n=240)');
    expect(html).toContain('r = -0.29 (n=250)');
    expect(html).not.toContain('tighter');
    expect(html.toLowerCase()).toContain('#f0c75e'); // GOLD accent, not a caution color
  });

  it('a non-flip block is unaffected — "tighter" still renders for a same-direction asymmetry', () => {
    const v = conditionalVerdict(ddBlock(), ['up', 'down'], 60);
    expect(v.kind).toBe('tighter');
  });
});

// ── Display-integrity fast-follow: result labels bind to the PAYLOAD ──────────
describe('resolveResultLabels — result surfaces bind to the payload, never the live select', () => {
  it('payload meta.driverLabel wins (the primary, server-carried source)', () => {
    expect(
      resolveResultLabels({ meta: { driver: 'GOLD', driverLabel: 'Gold (GLD proxy)' } }).driverLabel
    ).toBe('Gold (GLD proxy)');
  });

  it('falls back to the local key lookup when the payload omits the label', () => {
    expect(resolveResultLabels({ meta: { driver: 'GOLD' } }).driverLabel).toBe('Gold (GLD proxy)');
  });

  it('renders an em-dash when neither a label nor a known key is present — never a live default', () => {
    expect(resolveResultLabels({ meta: { driver: 'ZZ_NOT_A_DRIVER' } }).driverLabel).toBe('—');
    expect(resolveResultLabels({ meta: {} }).driverLabel).toBe('—');
    expect(resolveResultLabels({}).driverLabel).toBe('—');
    expect(resolveResultLabels(null).driverLabel).toBe('—');
  });

  it('driverUnit is payload-bound, with the TNX forward-return override (never the diff-mode unit)', () => {
    expect(resolveResultLabels({ meta: { driver: 'BRENT', driverUnit: '% change' } }).driverUnit).toBe(
      '% change'
    );
    // TNX forward returns are percent-of-level, so its diff-mode 'yield points'
    // unit must be dropped here (that unit belongs to beta/inflections).
    expect(
      resolveResultLabels({ meta: { driver: 'TNX', driverUnit: 'yield points (pp)' } }).driverUnit
    ).toBe('% change in yield level');
  });
});

describe('result surfaces render the payload driver label, not the component default select', () => {
  // The bug (pre-existing since V0): driverLabel derived from the live <select>
  // (default BRENT), so flipping the dropdown AFTER a run relabeled every result
  // surface while the numbers still belonged to the old driver. Bound to the
  // payload, a GOLD-run result reads Gold even though the default select is Brent.
  const goldData = {
    meta: {
      driver: 'GOLD',
      driverLabel: 'Gold (GLD proxy)',
      joinedCloses: 400,
      firstEligibleInflectionDate: '2026-01-02',
    },
    byWindow: { corr20: { value: 0.62 }, corr60: { value: 0.55 } },
    inflections: [],
    leadLag: null,
  };

  it('the verdict result surface names the PAYLOAD driver (Gold), never the default select (Brent)', () => {
    const { driverLabel } = resolveResultLabels(goldData);
    const html = render(<div>{buildVerdictSentence(goldData, driverLabel)}</div>);
    expect(html).toContain('Gold (GLD proxy)');
    expect(html).not.toContain('Brent');
  });
});

// ── Build 5 — GROUP COHESION card ─────────────────────────────────────────────
describe('CohesionCard — intra-group cohesion headline card', () => {
  it('renders both windows, the "(N pairs)" disclosure, and a phrase that agrees with the printed value', () => {
    const html = render(
      <CohesionCard
        cohesion={{ c20: { value: 0.82, pairsUsed: 3, pairsTotal: 3 }, c60: { value: 0.71, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 }}
      />
    );
    expect(html).toContain('Group cohesion');
    expect(html).toContain('+0.82'); // 1-mo via fmtCorr
    expect(html).toContain('+0.71'); // 3-mo
    expect(html).toContain('moving as one right now'); // strengthBand(0.82) = strong
    expect(html).toContain('(3 pairs)'); // pairsUsed === pairsTotal → total form
  });

  it('discloses partial coverage as "(x of y pairs)" when a member drops out of a window', () => {
    const html = render(
      <CohesionCard
        cohesion={{ c20: { value: 0.5, pairsUsed: 1, pairsTotal: 3 }, c60: { value: 0.5, pairsUsed: 1, pairsTotal: 3 }, memberCount: 3 }}
      />
    );
    expect(html).toContain('(1 of 3 pairs)');
    expect(html).toContain('mostly moving together'); // moderate
  });

  it('a meaningfully-negative reading prints "pulling in opposite directions", never "moving as one" (Rule 9)', () => {
    const html = render(
      <CohesionCard
        cohesion={{ c20: { value: -0.83, pairsUsed: 3, pairsTotal: 3 }, c60: { value: -0.6, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 }}
      />
    );
    expect(html).toContain('-0.83');
    expect(html).toContain('pulling in opposite directions right now');
    expect(html).not.toContain('moving as one');
  });

  it('both windows null (no shared history) → "—" values and the honest phrase, no crash', () => {
    const html = render(<CohesionCard cohesion={{ c20: null, c60: null, memberCount: 3 }} />);
    expect(html).toContain('not enough shared history');
    expect(html).toContain('—');
  });

  it('c20 null but c60 present → falls back to the 3-month reading (never a false "not enough history")', () => {
    const html = render(
      <CohesionCard cohesion={{ c20: null, c60: { value: 0.75, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 }} />
    );
    expect(html).not.toContain('not enough shared history');
    expect(html).toContain('moving as one right now'); // banded off c60
    expect(html).toContain('+0.75');
  });

  it('absence tolerance: no cohesion block (old cached payload / group < 3 members) renders NOTHING', () => {
    expect(render(<CohesionCard cohesion={undefined} />)).toBe('');
    expect(render(<CohesionCard cohesion={null} />)).toBe('');
  });
});

// ── V3 Phase 1 Sub-build 1 — relationship-quality bundle render smoke ─────────
describe('RelationshipQualityCard — the deep-dive relationship-quality bundle', () => {
  const fullRq = {
    contribution: {
      full: { corr: 0.58, beta: 1.2 },
      members: [
        { index: 0, corrDelta: 0.31, betaDelta: 0.4 },
        { index: 1, corrDelta: 0.06, betaDelta: 0.05 },
        { index: 2, corrDelta: 0.04, betaDelta: 0.03 },
      ],
      window: 60,
      n: 60,
      memberSymbols: ['NVDA', 'AMD', 'AVGO'],
    },
    partial: {
      w20: { raw: 0.6, adjusted: 0.42, n: 20, suppressed: null },
      w60: { raw: 0.55, adjusted: 0.38, n: 60, suppressed: null },
    },
    selfPercentile: {
      corr20: { percentile: 82, n: 480, latest: 0.6 },
      corr60: { percentile: 74, n: 440, latest: 0.55 },
    },
    captureAsymmetry: {
      minObs: 60,
      down: { beta: 1.5, alpha: 0, r: 0.7, n: 120 },
      up: { beta: 1.1, alpha: 0, r: 0.6, n: 130 },
      comparison: { asymmetric: true, direction: 'down', betaDown: 1.5, betaUp: 1.1, nDown: 120, nUp: 130 },
      counts: { down: 120, up: 130 },
    },
    tail: {
      worst: { n: 24, tailPct: 10, coMoveCount: 20, groupMedian: -0.018 },
      best: { n: 24, tailPct: 10, coMoveCount: 19, groupMedian: 0.015 },
      sampleN: 240,
    },
    stability: { signPersistence: 0.88, aboveFraction: 0.7, n: 480, sign: 'positive', threshold: 0.15 },
    driverContext: { trailingReturn: 0.032, vol: { percentile: 65, n: 480, latest: 0.01 } },
  };

  it('renders the keystone partial, contribution verdict, capture, tail, and context — §9 numbers bound to labels', () => {
    const html = render(<RelationshipQualityCard rq={fullRq} driverLabel="10Y Yield" isDesktop />);
    // Partial (raw vs S&P-adjusted), values via fmtCorr.
    expect(html).toContain('adjusted');
    expect(html).toContain('+0.60'); // raw w20
    expect(html).toContain('+0.42'); // S&P-adjusted w20
    // Member contribution: the pure verdict names the top contributor.
    expect(html).toContain('NVDA carried this link the most');
    expect(html).toContain('+0.31'); // the leave-one-out delta the verdict decided on
    // Capture asymmetry.
    expect(html).toContain('β = +1.50 (n=120)');
    expect(html).toContain('stronger on down days');
    // Tail (n-first — a count, never a % of a handful).
    expect(html).toContain('On the 24 weakest 10Y Yield days in this sample');
    // Context strip: self-percentile, past stability, driver-side move.
    // ("88%" sits inside a <strong>, so assert around the element boundary.)
    expect(html).toContain('82nd percentile');
    expect(html).toContain('The link stayed positive in');
    expect(html).toContain('of the 480 observed 20-day windows');
    expect(html).toContain('+3.2%'); // the driver's own trailing move
    // No banned predictive vocabulary.
    expect(html.toLowerCase()).not.toContain('predict');
    expect(html.toLowerCase()).not.toContain('will likely');
  });

  it('a market-proxy driver shows the honest note instead of an adjusted number', () => {
    const rq = {
      ...fullRq,
      partial: {
        w20: { raw: 0.9, adjusted: null, n: 20, suppressed: 'driver_is_market' },
        w60: { raw: 0.88, adjusted: null, n: 60, suppressed: 'driver_is_market' },
      },
    };
    const html = render(<RelationshipQualityCard rq={rq} driverLabel="Equal-weight S&P (RSP)" isDesktop />);
    expect(html).toContain('almost 1-for-1'); // the PARTIAL_MARKET_NOTE
    expect(html).not.toContain('+0.42');
  });

  it('the driver being SPY hides the partial card entirely (self-skip), context still renders', () => {
    const rq = { ...fullRq, partial: { w20: { skipped: 'self' }, w60: { skipped: 'self' } } };
    const html = render(<RelationshipQualityCard rq={rq} driverLabel="S&P 500 (SPY)" isDesktop />);
    expect(html).not.toContain('Link,'); // the partial card caption is gone
    expect(html).toContain('Relationship context'); // the rest still renders
  });

  it('a missing SPY reference degrades to an honest unavailable note', () => {
    const rq = {
      ...fullRq,
      partial: { w20: { suppressed: 'spy_unavailable' }, w60: { suppressed: 'spy_unavailable' } },
    };
    const html = render(<RelationshipQualityCard rq={rq} driverLabel="Gold (GLD proxy)" isDesktop />);
    expect(html).toContain('reference data was unavailable');
  });

  it('absence tolerance: no relationshipQuality block (dark / old payload) renders NOTHING', () => {
    expect(render(<RelationshipQualityCard rq={null} driverLabel="Gold" isDesktop />)).toBe('');
    expect(render(<RelationshipQualityCard rq={undefined} driverLabel="Gold" isDesktop />)).toBe('');
  });

  it('clamps a sub-0.5 percentile to "1st", never "0th percentile" (a record extreme)', () => {
    const rq = { ...fullRq, selfPercentile: { corr20: { percentile: 0.4, n: 250, latest: -0.9 }, corr60: null } };
    const html = render(<RelationshipQualityCard rq={rq} driverLabel="VIX" isDesktop />);
    expect(html).toContain('1st percentile');
    expect(html).not.toContain('0th percentile');
  });

  it('omits the Relationship context card entirely when all three clauses are absent', () => {
    const rq = {
      ...fullRq,
      selfPercentile: { corr20: null, corr60: null },
      stability: { signPersistence: null, aboveFraction: 0, n: 5, sign: null, threshold: 0.15 },
      driverContext: { trailingReturn: null, vol: null },
    };
    const html = render(<RelationshipQualityCard rq={rq} driverLabel="Gold" isDesktop />);
    expect(html).not.toContain('Relationship context');
  });

  it('renders the volatility clause even when the driver trailing return is null', () => {
    const rq = { ...fullRq, driverContext: { trailingReturn: null, vol: { percentile: 65, n: 480, latest: 0.01 } } };
    const html = render(<RelationshipQualityCard rq={rq} driverLabel="Gold" isDesktop />);
    expect(html).toContain('Relationship context'); // the card still renders
    expect(html).toContain('65th percentile'); // the vol read isn't suppressed by a null move
  });
});

describe('ScanResults — the desktop S&P-adjusted column (only when the server sent rq)', () => {
  const rqRow = (over) => ({ partial: { w20: { raw: 0.5, adjusted: 0.42, n: 20, suppressed: null }, w60: {} }, ...over });
  const scanWithRq = {
    summary: null,
    rows: [
      {
        driver: 'XLK', label: 'Technology (XLK)', category: 'Sectors',
        corr20: 0.62, corr60: 0.55, d: 0.07, score: 1.1,
        tensionState: 'elevated', joinedCloses: 400, tier: 'established', identity: false,
        rq: rqRow(),
      },
      {
        driver: 'SPX', label: 'S&P 500 (SPY)', category: 'Macro',
        corr20: 0.71, corr60: 0.66, d: 0.05, score: 1.0,
        tensionState: 'elevated', joinedCloses: 400, tier: 'established', identity: false,
        rq: { partial: { w20: { skipped: 'self' }, w60: { skipped: 'self' } } },
      },
    ],
    droppedDrivers: [],
    meta: { computedAt: '2026-07-03T20:00:00Z', cached: false, group: ['AAPL'] },
  };

  it('renders the S&P-adj header and the adjusted value on desktop; self-skip prints a dash', () => {
    const html = render(<ScanResults scan={scanWithRq} isDesktop onDeepDive={() => {}} onRefresh={() => {}} />);
    expect(html).toContain('S&amp;P-adj 20d'); // the header (react escapes &)
    expect(html).toContain('+0.42'); // the XLK adjusted value
  });

  it('mobile carries NO adjusted column (comparison-tax: full detail lives in the deep dive)', () => {
    const html = render(<ScanResults scan={scanWithRq} isDesktop={false} onDeepDive={() => {}} onRefresh={() => {}} />);
    expect(html).not.toContain('S&amp;P-adj 20d');
  });

  it('a scan without rq (flag dark) renders no adjusted column at all', () => {
    const noRq = { ...scanWithRq, rows: scanWithRq.rows.map(({ rq, ...r }) => r) };
    const html = render(<ScanResults scan={noRq} isDesktop onDeepDive={() => {}} onRefresh={() => {}} />);
    expect(html).not.toContain('S&amp;P-adj 20d');
  });
});

// ── V2 Build 6 — source chips + provenance line render smokes ─────────────────
describe('SourceChips — renders ONLY with a source', () => {
  it('renders nothing when neither source exists', () => {
    expect(render(<SourceChips watchlistGroup={null} bookGroup={null} onPick={() => {}} />)).toBe('');
  });

  it('renders a labelled chip per present source, never a mystery button for an absent one', () => {
    const countButtons = (html) => (html.match(/<button/g) || []).length;

    const wl = { symbols: ['XOM', 'CVX', 'COP'], label: 'My watchlist' };
    const html = render(<SourceChips watchlistGroup={wl} bookGroup={null} onPick={() => {}} />);
    expect(html).toContain('My watchlist (3)');
    expect(countButtons(html)).toBe(1); // exactly one chip — no mystery button for the absent source
    expect(html).not.toContain('book');

    // NB: react-dom/server HTML-escapes the apostrophe in "Viper's" → assert on
    // the unescaped fragments (agent name + "book (n)").
    const book = { symbols: ['NVDA', 'MSFT'], label: "Viper's book" };
    const both = render(<SourceChips watchlistGroup={wl} bookGroup={book} onPick={() => {}} />);
    expect(both).toContain('My watchlist (3)');
    expect(both).toContain('Viper');
    expect(both).toContain('book (2)');
    expect(countButtons(both)).toBe(2); // exactly one chip per present source
  });
});

describe('ProvenanceLine — copy variants + clears on manual edit', () => {
  it('watchlist provenance names the source, count, and freshness', () => {
    const html = render(
      <ProvenanceLine
        provenance={{ source: 'watchlist', label: 'your equipped watchlist', count: 3, asOf: Date.UTC(2026, 6, 5, 18, 30) }}
      />
    );
    expect(html).toContain('Group: your equipped watchlist');
    expect(html).toContain('3 tickers');
    expect(html).toContain('as of Jul 5');
  });

  it('book provenance surfaces truncation and crypto exclusion honestly', () => {
    const html = render(
      <ProvenanceLine
        provenance={{ source: 'book', label: "Viper's current book", count: 10, truncatedFrom: 14, excludedCrypto: ['BTC'] }}
      />
    );
    expect(html).toContain('current book'); // apostrophe in "Viper's" is HTML-escaped
    expect(html).toContain('Viper');
    expect(html).toContain('showing the 10 largest of 14');
    expect(html).toContain('1 non-equity position excluded — equities only for now');
  });

  it('url-sourced provenance reads "linked from elsewhere"', () => {
    expect(render(<ProvenanceLine provenance={{ source: 'url' }} />)).toContain('Group: linked from elsewhere');
  });

  it('renders NOTHING once provenance is cleared (the manual-edit / §9 post-state)', () => {
    expect(render(<ProvenanceLine provenance={null} />)).toBe('');
  });
});

// ── V3 Sub-build 2 — READ QUALITY panel + "Since your last scan" strip ────────
describe('ReadQualityCard (Change 1)', () => {
  const evidence = {
    readType: 'market_proxy',
    readState: 'in_flux',
    applicableCount: 4,
    passedCount: 2,
    failedCount: 2,
    unavailableCount: 2,
    criteria: [
      { id: 'adequate_sample', outcome: 'pass', value: 480, threshold: 300, unit: 'count' },
      { id: 'stable_link', outcome: 'pass', value: 0.82, threshold: 0.7, unit: 'fraction' },
      { id: 'group_coheres', outcome: 'not_applicable', value: null, threshold: 0.4, unit: 'correlation' },
      { id: 'broad_based', outcome: 'not_applicable', value: null, threshold: 'broad_based', unit: 'none' },
      { id: 'survives_adjustment', outcome: 'fail', value: 0.1, threshold: 0.15, unit: 'correlation' },
      { id: 'tension_contained', outcome: 'fail', value: 'break', threshold: 'calm|elevated', unit: 'none' },
    ],
  };

  it('renders BOTH badge dimensions (type never hides state)', () => {
    const html = render(<ReadQualityCard evidence={evidence} />);
    expect(html).toContain('Market-proxy read');
    expect(html).toContain('currently in flux');
    expect(html).toContain('Not a prediction.');
  });

  it('lists every criterion with its actual number and threshold', () => {
    const html = render(<ReadQualityCard evidence={evidence} />);
    expect(html).toContain('Adequate sample');
    expect(html).toContain('480');
    expect(html).toContain('Survives S&amp;P adjustment');
  });

  it('absence-tolerant — renders nothing without evidence', () => {
    expect(render(<ReadQualityCard evidence={null} />)).toBe('');
  });
});

describe('SinceLastScanStrip (Change 2)', () => {
  const rows = [{ driver: 'TNX', label: '10Y Yield' }, { driver: 'HYG', label: 'High Yield (HYG)' }];

  it('names the real baseline day and lists top events', () => {
    const html = render(
      <SinceLastScanStrip
        comparison={{ status: 'available', baselineObservationDay: '2026-07-06', gapTradingDays: 3 }}
        changes={{ status: 'available', events: [{ driverId: 'TNX', event: 'correlation_strengthened', from: 0.4, to: 0.6, magnitude: 0.2 }] }}
        rows={rows}
      />
    );
    expect(html).toContain('Since your last scan (2026-07-06 — 3 trading days ago)');
    expect(html).toContain('10Y Yield link strengthened');
  });

  it('honest empty state when nothing changed', () => {
    const html = render(
      <SinceLastScanStrip comparison={{ status: 'available', baselineObservationDay: '2026-07-06', gapTradingDays: 1 }} changes={{ status: 'available', events: [] }} rows={rows} />
    );
    expect(html).toContain('No meaningful changes since 2026-07-06');
  });

  it('not_comparable → the pinned honest copy', () => {
    const html = render(<SinceLastScanStrip comparison={{ status: 'not_comparable' }} changes={{ status: 'not_comparable', events: [] }} rows={rows} />);
    expect(html).toContain('Baseline not comparable');
  });

  it('no_prior_scan → the pinned honest copy', () => {
    const html = render(<SinceLastScanStrip comparison={{ status: 'no_prior_scan' }} changes={{ status: 'no_prior_scan', events: [] }} rows={rows} />);
    expect(html).toContain('No prior scan to compare against yet');
  });

  it('"and N more" when events exceed 5', () => {
    const events = Array.from({ length: 8 }, () => ({ driverId: 'TNX', event: 'rank_rose', from: 8, to: 1, magnitude: 7 }));
    const html = render(
      <SinceLastScanStrip comparison={{ status: 'available', baselineObservationDay: '2026-07-06', gapTradingDays: 2 }} changes={{ status: 'available', events }} rows={rows} />
    );
    expect(html).toContain('and 3 more');
  });

  it('absence-tolerant — renders nothing without a comparison', () => {
    expect(render(<SinceLastScanStrip comparison={null} changes={null} rows={rows} />)).toBe('');
  });
});
