// src/screens/battleView/ArenaHeader.render.test.jsx
//
// A3.0 (D-96) — the arena header. renderToString + toContain, the repo's
// component-test idiom (TurnLine.render.test.jsx).
//
// The rows that matter here are the ones the seed and §9 name: the accessible
// ORDER of the three numbers, ONE seam derivation, the book contract carried
// over intact, tokens instead of hex, and the starfield left alone.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
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
