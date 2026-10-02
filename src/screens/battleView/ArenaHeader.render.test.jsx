// @vitest-environment jsdom
//
// (jsdom since the Shadow vs CPU quote-integrity build: the real-framer bar row
// below mounts the header. Every renderToString row — the OFF-6 digests
// included — produces byte-identical output in either environment; verified
// when the annotation was added.)
//
// src/screens/battleView/ArenaHeader.render.test.jsx
//
// A3.0 (D-96) — the arena header. renderToString + toContain, the repo's
// component-test idiom (TurnLine.render.test.jsx).
//
// The rows that matter here are the ones the seed and §9 name: the accessible
// ORDER of the three numbers, ONE seam derivation, the book contract carried
// over intact, tokens instead of hex, and the starfield left alone.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { computeTugOfWarWidth } from './computeTugOfWarWidth';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { TURN_STATE } from './deriveTurnLine';

// The presence face is mounted by ArenaHeader, and its canvas stage is not what
// this file is about. Flag it off the way every other golden/render harness in
// this tree does, then turn it ON for the one row that checks the mark's
// reactivity contract.
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
}));

const ArenaHeader = (await import('./ArenaHeader.jsx')).default;

const TURN = {
  phase: 'LIVE',
  state: TURN_STATE.LIVE,
  text: 'Checked 12:47 PM · next ~1:02 PM',
  decided: true,
  decision: { evalId: 'eval_005' },
};

const BATTLE = {
  agentContext: { agentName: 'SHADOW', archetype: 'degen' },
  scoreState: { currentScore: -2, opponentScore: -21, tradeCount: 3 },
};

// renderToString interleaves <!-- --> between adjacent text nodes; the golden
// harnesses strip it for the same reason.
const strip = (h) => h.replace(/<!-- -->/g, '');

const render = (props = {}) => strip(renderToString(
  <ArenaHeader
    agentBattle={BATTLE}
    playerScore={-2}
    opponentScore={-21}
    dayLabel="Day 3 of 5"
    turnLine={TURN}
    onOpenBook={() => {}}
    bookName="Why? · the whole book"
    {...props}
  />,
));

describe('ArenaHeader — the score header as an arena (D-96)', () => {
  it('reads player → VS → CPU in DOM order', () => {
    // The accessible order IS the DOM order — there is no tabindex or grid-order
    // trick reordering these, and a screen reader walks them as the eye does.
    const html = render();
    const agent = html.indexOf('SHADOW');
    const vs = html.indexOf('>VS<');
    const cpu = html.indexOf('>CPU<');
    expect(agent).toBeGreaterThan(-1);
    expect(vs).toBeGreaterThan(agent);
    expect(cpu).toBeGreaterThan(vs);
  });

  it('renders VS upper case in the centre slot, not the mock\'s lower-case vs', () => {
    const html = render();
    expect(html).toContain('data-arena-vs="1"');
    expect(html).toContain('>VS<');
    expect(html).not.toContain('>vs<');
  });

  it('carries the book contract the shipped header owns (D-89)', () => {
    // The panel's close finds this control by attribute to hand focus back. A
    // header that renamed or dropped the hook would strand the book's focus
    // return with every other row still green.
    const html = render();
    expect(html).toContain('data-why-book-toggle="1"');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Why? · the whole book"');
    expect(html).toContain('aria-describedby="why-book-agent why-book-day why-book-cpu"');
    expect(html).toContain('id="why-book-agent"');
    expect(html).toContain('id="why-book-day"');
    expect(html).toContain('id="why-book-cpu"');
    expect(render({ bookOpen: true })).toContain('aria-expanded="true"');
  });

  it('emits none of the book attributes when the header is not tappable', () => {
    const html = render({ onOpenBook: null, bookName: null });
    expect(html).not.toContain('data-why-book-toggle');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('aria-describedby');
  });

  it('shows `Tap for the book` on desktop only, and only when it is tappable', () => {
    expect(render({ isDesktop: true })).toContain('Tap for the book');
    expect(render({ isDesktop: false })).not.toContain('Tap for the book');
    expect(render({ isDesktop: true, onOpenBook: null, bookName: null })).not.toContain('Tap for the book');
  });

  it('rehosts the shipped turn line unchanged, and renders no line without one', () => {
    expect(render()).toContain('Checked 12:47 PM · next ~1:02 PM');
    expect(render()).toContain('data-turn-state="live"');
    const bare = render({ turnLine: null });
    expect(bare).toContain('data-arena-header="1"');
    expect(bare).not.toContain('data-turn-state');
  });

  it('the arena is still under reduced motion (seed §4)', () => {
    expect(render({ reducedMotion: false })).toContain('opacity:0');
    expect(render({ reducedMotion: true })).not.toContain('opacity:0');
  });

  it('the player wears teal and the CPU wears copper — in their own slots', () => {
    // The sibling row below only checks both tokens appear SOMEWHERE, so
    // swapping the four name/score colours survived it (review lens 4 F7, M1b).
    // This reads each side's own markup.
    const html = render();
    const agent = html.slice(html.indexOf('id="why-book-agent"'), html.indexOf('id="why-book-day"'));
    // Bounded at the bar — past it the wash, the seam and the turn line all
    // legitimately carry teal.
    const cpu = html.slice(html.indexOf('id="why-book-cpu"'), html.indexOf('data-arena-bar'));
    expect(agent).toContain('var(--ft-teal)');
    expect(agent).not.toContain('var(--ft-copper)');
    expect(cpu).toContain('var(--ft-copper)');
    expect(cpu).not.toContain('var(--ft-teal)');
  });

  it('has ONE seam: the bar\'s width and the wash hinge on the same number (§9)', () => {
    // computeTugOfWarWidth(-2, -21) = 2/23 clamped up to the 10% floor. The tint
    // stop and the bar's width must be that same 10 — the mock's second
    // derivation (50 + (me-cpu)/tot*25) would put the seam at 71 and the two
    // would disagree on screen about who is winning.
    const html = render();
    expect(html).toContain('data-seam-pct="10"');
    expect(html).toContain('rgba(var(--ft-teal-rgb), 0) 10%');
    expect(html).not.toContain('data-seam-pct="71"');
    // …AND THE BAR ITSELF. `data-seam-pct` and the wash are the two the first
    // draft read; the bar's width is a framer `animate` value SSR does not
    // paint, so a second derivation used ONLY for the bar survived (review
    // lens 4 F7, M38). The bar now states the number it was given.
    expect(html).toContain('data-bar-pct="10"');
  });

  it('puts the player on teal and the CPU on copper, as tokens', () => {
    const html = render();
    expect(html).toContain('var(--ft-teal)');
    expect(html).toContain('var(--ft-copper)');
    expect(html).toContain('var(--ft-teal-rgb)');
    expect(html).toContain('var(--ft-copper-rgb)');
  });

  it('authors no hex at all — every colour is a token (BUILD_RULES §10)', () => {
    // The theme guard only scans CORE_PALETTE hexes, and it cannot see a
    // non-core one (hazard 42 — copper itself was invisible to it until this
    // commit made it a token). This row is stricter than the guard on purpose:
    // NO six- or three-digit hex reaches the rendered output of this surface.
    const html = render({ isDesktop: true });
    expect(html.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it('mounts no starfield of its own (hazard 39)', () => {
    // The arena is the floor the EXISTING canvas shows through. A second
    // starfield here would double the ambient drift and cost a canvas.
    const html = render();
    expect(html).not.toContain('<canvas');
    expect(html).toContain('data-arena-bar="1"');
  });

  it('renders the day label and trade count in the centre, and omits them when absent', () => {
    const html = render();
    expect(html).toContain('Day 3 of 5');
    expect(html).toContain('3 trades');
    const bare = render({ dayLabel: '', agentBattle: { ...BATTLE, scoreState: { ...BATTLE.scoreState, tradeCount: 0 } } });
    expect(bare).not.toContain('Day 3 of 5');
    expect(bare).not.toContain('trades');
  });

  it('singularises one trade', () => {
    const html = render({ agentBattle: { ...BATTLE, scoreState: { ...BATTLE.scoreState, tradeCount: 1 } } });
    expect(html).toContain('1 trade<');
  });

  it('falls back to the battle document when the scores are not passed', () => {
    const html = render({ playerScore: undefined, opponentScore: undefined });
    expect(html).toContain('data-arena-header="1"');
    expect(html).toContain('data-seam-pct="10"');
  });
});

describe('ArenaHeader — the mark is still and deaf (D-91, hazard 41)', () => {
  it('mounts the presence face static, with its events withheld', async () => {
    // The one row that turns presence ON. It asserts the PROPS the mount
    // receives rather than the pixels it paints: static means it never joins the
    // rAF loop, and withholding events is what stops the raw statusFeed moving
    // a face between checks.
    vi.resetModules();
    const seen = [];
    vi.doMock('../../config/featureFlags', async (importOriginal) => ({
      ...(await importOriginal()),
      isAgentPresenceOn: () => true,
    }));
    vi.doMock('../../components/AgentPresence/AgentPresenceMount', () => ({
      default: (props) => { seen.push(props); return null; },
    }));
    const Fresh = (await import('./ArenaHeader.jsx')).default;
    renderToString(
      <Fresh agentBattle={BATTLE} playerScore={-2} opponentScore={-21} turnLine={TURN} />,
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].reactivityLevel).toBe('static');
    expect(seen[0].duel.statusFeed).toBeNull();
    expect(seen[0].enableEnvironment).toBe(false);
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shadow vs CPU quote integrity (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
// §5.3, OFF-6; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// OFF-6 — `comparison === undefined` is the legacy header: its markup, its
// seam number and the presence face's `duel` input are byte-identical to the
// pre-build SHA (digests captured there with SHADOW_OFF_CAPTURE_DIR).
// ─────────────────────────────────────────────────────────────────────────────

const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
const digest = (s) => ({ sha256: createHash('sha256').update(s).digest('hex'), length: s.length });
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `arenaHeader.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual, `OFF-6 reference ${name} (captured at ${OFF_REFERENCE_SHA})`).toEqual(expected);
}

const OFF_VARIANTS = {
  negatives: {},
  leading: { playerScore: 30, opponentScore: 12 },
  trailing: { playerScore: 4, opponentScore: 19 },
  tie: { playerScore: 10, opponentScore: 10 },
  zeroZero: { playerScore: 0, opponentScore: 0 },
  desktop: { isDesktop: true, playerScore: 7, opponentScore: 3 },
  reduced: { reducedMotion: true, playerScore: 7, opponentScore: 3 },
  notBookable: { onOpenBook: null, bookName: null },
  docFallback: { playerScore: undefined, opponentScore: undefined },
};

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (11 entries; presenceOnMarkup added after the first capture, captured at the same SHA).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output. At that SHA
// the file's ON section also imports src/screens/battleView/shadowCpuQuoteIntegrity.js,
// which does not exist there: copy it alongside (a pure module the OFF rows
// never call) so the import graph resolves, then run with -t "OFF".
const OFF6 = {
 "desktop": {
  "length": 4610,
  "sha256": "2a01bc10c48dc5ad20ab168f9897f9ea398a08a22e8cf6e302374ae560e3aacc"
 },
 "docFallback": {
  "length": 4483,
  "sha256": "6a8bd5a3d007d829bd07a1d22dd4949acb79c6d6ace978c3cd9f41de2752e0ee"
 },
 "leading": {
  "length": 4529,
  "sha256": "1d644f7b48f045dfdcc598834c7c7518ac7201809a3737140f9d947678ef3479"
 },
 "negatives": {
  "length": 4483,
  "sha256": "6a8bd5a3d007d829bd07a1d22dd4949acb79c6d6ace978c3cd9f41de2752e0ee"
 },
 "notBookable": {
  "length": 4243,
  "sha256": "1b07dc9e2e77e7eddfa1d2931db4df407c6d60f6cb9f8c4af4f32069cbc7b46e"
 },
 "presenceDuel": [
  {
   "duel": {
    "opponentScore": -21,
    "playerScore": -2,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 12,
    "playerScore": 30,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 19,
    "playerScore": 4,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 10,
    "playerScore": 10,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 0,
    "playerScore": 0,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 7,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 56
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 7,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": -21,
    "playerScore": -2,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": -21,
    "playerScore": -2,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  }
 ],
 "presenceOnMarkup": {
  "negatives": {
   "sha256": "b00417d63b31710f8ebfca82d6fc35977721ee11e22b04ccfbd0d6844640dc30",
   "length": 7294
  },
  "leading": {
   "sha256": "51bd10a13ad4cc32c7a63ead3112397842bd673ca1c693279bff5848c2906fc5",
   "length": 7340
  },
  "trailing": {
   "sha256": "b2d63048428690d6f32d6918518bb8b57f961109e4c14d5acfa6bc7bea0a4c5d",
   "length": 7342
  },
  "tie": {
   "sha256": "782c82b900412432cabebed647d59cd8c8865d5fe4e55c67ae722fb79707a5eb",
   "length": 7295
  },
  "zeroZero": {
   "sha256": "782c82b900412432cabebed647d59cd8c8865d5fe4e55c67ae722fb79707a5eb",
   "length": 7295
  },
  "desktop": {
   "sha256": "e065346a2bddfb70df380da3660129bf3126f9413910bf06386b6814d5ea7ceb",
   "length": 7423
  },
  "reduced": {
   "sha256": "18bee5b94bf8fdb8ca680d8a308d72975f1f65e516c1d478e3e46043b3eca5ad",
   "length": 7282
  },
  "notBookable": {
   "sha256": "62d8cfd50bfbd4455894241b802fc95070b3097dc19aa5aaac3fd923a475f17a",
   "length": 7054
  },
  "docFallback": {
   "sha256": "b00417d63b31710f8ebfca82d6fc35977721ee11e22b04ccfbd0d6844640dc30",
   "length": 7294
  }
 },
 "reduced": {
  "length": 4471,
  "sha256": "c2bd78fac54c00b28ce05637e4512180b2ae642203a1dafe998d33056982cbf3"
 },
 "tie": {
  "length": 4484,
  "sha256": "31a691744ddc2dc1456ce1bbf8b71a61312ef4a1d01070607b365638502f1ddb"
 },
 "trailing": {
  "length": 4531,
  "sha256": "63fa1bb4c1144ba8d3faba407c534b23095f925ecb29b341a82fbabf1e83106f"
 },
 "zeroZero": {
  "length": 4484,
  "sha256": "31a691744ddc2dc1456ce1bbf8b71a61312ef4a1d01070607b365638502f1ddb"
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-6 — ArenaHeader default markup is byte-identical to the pre-build SHA', () => {
  for (const [name, props] of Object.entries(OFF_VARIANTS)) {
    it(`OFF ${name}`, () => {
      offReference(name, digest(render(props)), OFF6[name]);
    });
  }

  it('OFF presenceDuel: the face receives exactly the pre-build duel input', async () => {
    vi.resetModules();
    const seen = [];
    vi.doMock('../../config/featureFlags', async (importOriginal) => ({
      ...(await importOriginal()),
      isAgentPresenceOn: () => true,
    }));
    vi.doMock('../../components/AgentPresence/AgentPresenceMount', () => ({
      default: (props) => { seen.push({ duel: props.duel, reactivityLevel: props.reactivityLevel, size: props.size }); return null; },
    }));
    const Fresh = (await import('./ArenaHeader.jsx')).default;
    for (const [, props] of Object.entries(OFF_VARIANTS)) {
      renderToString(<Fresh agentBattle={BATTLE} playerScore={-2} opponentScore={-21} turnLine={TURN} {...props} />);
    }
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
    offReference('presenceDuel', seen, OFF6.presenceDuel);
  });

  it('OFF presenceOnMarkup: with the REAL presence face the markup — its SSR useIds included — is byte-identical', async () => {
    // The shipped header renders the face (presence is on in production). At
    // the pre-build SHA the container under the starfield holds three child
    // slots — names, seam, turn line; a fourth, even an empty `false` slot,
    // renumbers every SSR useId beneath it (the face's SVG clip and filter
    // ids). The client DOM would not differ; the serialized markup would.
    vi.resetModules();
    vi.doMock('../../config/featureFlags', async (importOriginal) => ({
      ...(await importOriginal()),
      isAgentPresenceOn: () => true,
    }));
    const Fresh = (await import('./ArenaHeader.jsx')).default;
    const out = {};
    for (const [name, props] of Object.entries(OFF_VARIANTS)) {
      out[name] = digest(strip(renderToString(
        <Fresh agentBattle={BATTLE} playerScore={-2} opponentScore={-21} dayLabel="Day 3 of 5" turnLine={TURN}
          onOpenBook={() => {}} bookName="Why? · the whole book" {...props} />,
      )));
    }
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
    offReference('presenceOnMarkup', out, OFF6.presenceOnMarkup);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ON — the gated header reads ONE selected comparison (§5.3, C-1, B-1, P8, R-7)
// ─────────────────────────────────────────────────────────────────────────────

const { selectComparison, gatedBarWidth, duelFor } = await import('./shadowCpuQuoteIntegrity.js');
const NOW_MS = Date.parse('2026-10-01T17:00:00.000Z');
const browser = (my, opp, ctx = 'ab-1#1#1') => selectComparison({ status: 'active', complete: true, browserPair: [my, opp], scoreState: null, contextKey: ctx, nowMs: NOW_MS });
const stored = (my, opp, ctx = 'ab-1#1#1') => selectComparison({
  status: 'active', complete: false, browserPair: null, contextKey: ctx, nowMs: NOW_MS,
  scoreState: { currentScore: my, opponentScore: opp, lastScoredAt: '2026-10-01T16:47:00.000Z' },
});
const unavailable = (ctx = 'ab-1#1#1') => selectComparison({ status: 'active', complete: false, browserPair: null, scoreState: null, contextKey: ctx, nowMs: NOW_MS });
const tealAlpha = (html) => /rgba\(var\(--ft-teal-rgb\), (0\.\d+|1)\), rgba\(var\(--ft-teal-rgb\), (0\.\d+|1)\)/.exec(html).slice(1);
const copperAlpha = (html) => /rgba\(var\(--ft-copper-rgb\), (0\.\d+|1)\), rgba\(var\(--ft-copper-rgb\), (0\.\d+|1)\)/.exec(html).slice(1);

describe('ON — available comparison: every cue from the selected pair', () => {
  it('browser: integer digits, the source label and prose, the seam and the bar from ONE width', () => {
    const c = browser(30, 12);
    const html = render({ comparison: c, playerScore: 999, opponentScore: -999 });
    expect(html).toContain('data-comparison-kind="browser"');
    expect(html).toContain('Live browser estimate');
    expect(html).toContain('You lead by 18');
    expect(html).toContain(`data-seam-pct="${Math.round(c.barWidth)}"`);
    expect(html).toContain(`data-bar-pct="${Math.round(c.barWidth)}"`);
    expect(html).toContain(`rgba(var(--ft-teal-rgb), 0) ${c.barWidth}%`);
    // The props the legacy header would read are ignored when a comparison is passed.
    expect(html).not.toContain('999');
  });

  it('stored: two-decimal digits, the actual stored time, three-way lead tint', () => {
    const html = render({ comparison: stored(10.4, 10.2) });
    expect(html).toContain('Last scored Oct 1, 12:47 PM EDT · browser quotes incomplete');
    expect(html).toContain('You lead by 0.20');
    expect(tealAlpha(html)).toEqual(['0.35', '1']);
    expect(copperAlpha(html)).toEqual(['0.55', '0.2']);
  });

  it('CPU lead emphasizes copper; an exact tie emphasizes NEITHER side (P8)', () => {
    const cpu = render({ comparison: stored(10.2, 10.4) });
    expect(tealAlpha(cpu)).toEqual(['0.2', '0.55']);
    expect(copperAlpha(cpu)).toEqual(['1', '0.35']);
    const tie = render({ comparison: stored(10.4, 10.4) });
    expect(tealAlpha(tie)).toEqual(['0.2', '0.55']);
    expect(copperAlpha(tie)).toEqual(['0.55', '0.2']);
    expect(tie).toContain('Tied');
    expect(tie).toContain('data-bar-pct="50"');
  });

  it.each([
    [-0.01, 0, 10, 'CPU leads by 0.01'],
    [-2, -21, 90, 'You lead by 19.00'],
    [0.01, -0.01, 90, 'You lead by 0.02'],
    [10.204, 10.2, 50, 'You lead by less than 0.01'],
  ])('precision row %p vs %p → bar %p, "%s" (B-1/B-2/B-3+)', (my, opp, pct, prose) => {
    const c = stored(my, opp);
    const html = render({ comparison: c });
    expect(Math.round(c.barWidth)).toBe(pct);
    expect(c.barWidth).toBe(gatedBarWidth(my, opp));
    expect(html).toContain(`data-bar-pct="${pct}"`);
    expect(html).toContain(prose);
  });

  it('[B-1] healthy non-negative pair: the width string equals today\'s helper output exactly', () => {
    const c = browser(3, 10);
    expect(c.barWidth).toBe(computeTugOfWarWidth(3, 10));
    expect(render({ comparison: c })).toContain(`width:${computeTugOfWarWidth(3, 10)}%`);
  });
});

describe('ON — unavailable: no digits, no bar, no lead tint; names, day, trades and the book stay', () => {
  it('renders the honest text and none of the score cues', () => {
    const html = render({ comparison: unavailable(), isDesktop: true });
    expect(html).toContain('data-comparison-kind="unavailable"');
    expect(html).toContain('Comparison unavailable');
    expect(html).not.toContain('data-arena-bar');
    expect(html).not.toContain('data-seam-pct');
    expect(html).not.toContain('data-bar-pct');
    expect(html).not.toContain('letter-spacing:-0.06em'); // no counter span at all
    expect(html).not.toContain('rgba(var(--ft-teal-rgb), 0.20) 0%'); // no wash hinge
    expect(html).toContain('SHADOW');
    expect(html).toContain('Day 3 of 5');
    expect(html).toContain('3 trades');
    expect(html).toContain('data-why-book-toggle="1"');
    expect(html).toContain('Tap for the book');
  });
  it('final-unavailable says so', () => {
    const c = selectComparison({ status: 'completed', complete: true, browserPair: [1, 2], scoreState: null, contextKey: 'x', nowMs: NOW_MS });
    expect(render({ comparison: c })).toContain('Final comparison unavailable');
  });
});

describe('ON — the face input (R-7, V-4) with presence on', () => {
  it('available: exactly the selected pair; unavailable: both score keys omitted, static', async () => {
    vi.resetModules();
    const seen = [];
    vi.doMock('../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isAgentPresenceOn: () => true }));
    vi.doMock('../../components/AgentPresence/AgentPresenceMount', () => ({ default: (props) => { seen.push(props); return null; } }));
    const Fresh = (await import('./ArenaHeader.jsx')).default;
    const c = stored(-0.01, 0);
    renderToString(<Fresh agentBattle={BATTLE} playerScore={50} opponentScore={1} comparison={c} />);
    renderToString(<Fresh agentBattle={BATTLE} playerScore={50} opponentScore={1} comparison={unavailable()} />);
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
    expect(seen[0].duel).toEqual(duelFor(c));
    expect(seen[0].duel).toEqual({ playerScore: -0.01, opponentScore: 0, statusFeed: null });
    expect(seen[1].duel).toEqual({ statusFeed: null });
    expect('playerScore' in seen[1].duel).toBe(false);
    expect(seen.every((p) => p.reactivityLevel === 'static')).toBe(true);
  });
});

// ─── ON-F5a: the REAL framer-motion committed width (B-12) ──────────────────
// framer-motion is NOT mocked in this file. Each row reads the teal half's
// inline width SYNCHRONOUSLY AT COMMIT, through a layout-effect probe rendered
// after the header (layout effects run after the DOM mutation and before any
// passive effect or animation frame). Evidence class: jsdom with the real
// library; browser PAINT is not exercised here (see the build record).

describe('ON-F5a — real framer-motion: the switch commits the selected width; the negative controls do not', () => {
  const { act } = React;
  let container;
  let root;
  let atCommit;
  function Probe({ selector }) {
    React.useLayoutEffect(() => {
      const el = container.querySelector(selector);
      atCommit.push(el ? el.style.width : null);
    });
    return null;
  }
  const mountHeader = (comparison) => act(() => {
    root.render(<><ArenaHeader agentBattle={BATTLE} turnLine={TURN} comparison={comparison} /><Probe selector="[data-bar-pct]" /></>);
  });
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    atCommit = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('first mount and every switch: the committed inline width IS the selected width', () => {
    const a = browser(4, 6); // 40%
    mountHeader(a);
    expect(atCommit[atCommit.length - 1]).toBe(`${a.barWidth}%`);
    const b = stored(1, 3); // a different KIND → a switch → 25%
    mountHeader(b);
    expect(atCommit[atCommit.length - 1]).toBe(`${b.barWidth}%`);
    const otherBattle = stored(7, 3, 'ab-2#1#1'); // same kind, new CONTEXT → still a switch (V-3)
    mountHeader(otherBattle);
    expect(atCommit[atCommit.length - 1]).toBe(`${otherBattle.barWidth}%`);
  });

  it('NEGATIVE CONTROL 1 — same kind, same context (the token-only path): the commit still shows the OLD width', () => {
    const a = stored(1, 3); // 25%
    mountHeader(a);
    const sameKind = stored(7, 3); // 70%, same switch key
    expect(sameKind.switchKey).toBe(a.switchKey);
    mountHeader(sameKind);
    expect(atCommit[atCommit.length - 1]).toBe(`${a.barWidth}%`);
    expect(atCommit[atCommit.length - 1]).not.toBe(`${sameKind.barWidth}%`);
  });

  it('NEGATIVE CONTROL 2 — a keyed remount WITHOUT initial={false}: no width at commit', async () => {
    const { motion } = await import('framer-motion');
    act(() => {
      root.render(<><div style={{ display: 'flex' }}><motion.div key="k2" data-bar-pct="1" animate={{ width: '80%' }} /></div><Probe selector="[data-bar-pct]" /></>);
    });
    expect(atCommit[atCommit.length - 1]).toBe('');
  });
});
