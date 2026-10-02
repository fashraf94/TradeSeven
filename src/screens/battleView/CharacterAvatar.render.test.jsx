// src/screens/battleView/CharacterAvatar.render.test.jsx
//
// A3.1 (D-91, D-98) — the character on the board.
//
// The seed's rows: the bubble appears on a tape change only (and a fake-timer
// row proves a timer alone does nothing), the count is the unread rendered
// entries and clears on open, and the style contract is sharp and unstriped —
// with a mutation adding a stripe required to fail.

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import CharacterAvatar from './CharacterAvatar.jsx';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { SPEECH_EYEBROW_COLOR } from './TapeCards';

vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
}));

const BUBBLE = {
  id: 'check-1',
  eyebrow: 'Status check · 3:45 PM · Held',
  line: 'The book is holding its own relative to the market.',
  eyebrowColor: SPEECH_EYEBROW_COLOR,
  isRecord: true,
};

const BATTLE = { agentContext: { agentName: 'Aurora' }, scoreState: { currentScore: 12, opponentScore: 3 } };

const strip = (h) => h.replace(/<!-- -->/g, '');
// SSR escapes the apostrophe in `the agent's pane` (the flag-off golden's own
// `You didn&#x27;t respond` is the precedent).
const esc = (s) => s.replace(/'/g, '&#x27;');
const render = (props = {}) => strip(renderToString(
  <CharacterAvatar agentBattle={BATTLE} bubble={BUBBLE} unread={3} onOpen={() => {}} {...props} />,
));

afterEach(() => { vi.useRealTimers(); });

describe('CharacterAvatar — the mark', () => {
  it('always renders the mark, with a 48px hit target on both shells', () => {
    for (const isDesktop of [true, false]) {
      const html = render({ isDesktop });
      expect(html).toContain('data-character-mark="1"');
      expect(html).toContain('min-width:48px');
      expect(html).toContain('min-height:48px');
    }
  });

  it('names itself for what it OPENS, and carries the count in that name', () => {
    expect(render({ unread: 3 })).toContain(`aria-label="${esc(COPY.paneOpenName(3))}"`);
    expect(render({ unread: 3 })).toContain('3 new');
    expect(render({ unread: 0, bubble: null })).toContain(`aria-label="${esc(COPY.paneOpen)}"`);
    expect(render({ unread: 0, bubble: null })).not.toContain('new"');
  });

  it('shows the badge only when something is unread', () => {
    expect(render({ unread: 3 })).toContain('data-unread-badge="1"');
    expect(render({ unread: 3 })).toContain('data-unread="3"');
    const none = render({ unread: 0, bubble: null });
    expect(none).not.toContain('data-unread-badge');
    expect(none).not.toContain('data-unread=');
  });

  it('treats a nonsense count as nothing unread rather than rendering it', () => {
    for (const unread of [-1, NaN, null, undefined, 'three']) {
      const html = render({ unread });
      expect(html).not.toContain('data-unread-badge');
      expect(html).not.toContain('data-character-bubble');
    }
  });
});

describe('CharacterAvatar — the bubble appears on a tape change only', () => {
  it('nothing new → the avatar stands alone (brief §5, state 8)', () => {
    const html = render({ unread: 0 });
    expect(html).toContain('data-character-mark="1"');
    expect(html).not.toContain('data-character-bubble');
  });

  it('an unread entry → one bubble, with the tape\'s own two strings', () => {
    const html = render({ unread: 1 });
    expect(html).toContain('data-character-bubble="1"');
    expect(html).toContain('Status check · 3:45 PM · Held');
    expect(html).toContain('The book is holding its own relative to the market.');
    expect(html).toContain(`data-bubble-kind="${BUBBLE.eyebrow}"`);
  });

  it('a bubble with no line is not a bubble', () => {
    expect(render({ bubble: { ...BUBBLE, line: '' } })).not.toContain('data-character-bubble');
    expect(render({ bubble: null })).not.toContain('data-character-bubble');
  });

  it('a bubble with no kind word still renders, and names itself without an empty prefix', () => {
    const html = render({ bubble: { ...BUBBLE, eyebrow: null, line: '3 checks · no change' } });
    expect(html).toContain('data-character-bubble="1"');
    expect(html).toContain('data-bubble-kind="none"');
    expect(html).not.toContain('data-bubble-eyebrow');
    expect(html).toContain(`aria-label="${esc(COPY.paneOpen)}"`);
  });

  it('A TIMER ALONE DOES NOTHING — no clock is read in this file', () => {
    // The seed's row, stated as the property that makes it true: advancing time
    // by an hour with the same props cannot change the output, because the
    // component holds no interval, no timeout and no Date read. Rendering twice
    // across a fake-timer jump proves the output is a pure function of props.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T13:00:00.000Z'));
    const before = render({ unread: 0 });
    vi.advanceTimersByTime(60 * 60 * 1000);
    const after = render({ unread: 0 });
    expect(after).toBe(before);
    expect(after).not.toContain('data-character-bubble');
  });
});

describe('CharacterAvatar — the bubble is sharp and unstriped (D-98)', () => {
  it('has one small radius and NO single-side border', () => {
    const html = render();
    const bubble = html.slice(html.indexOf('data-character-bubble'));
    const open = bubble.slice(0, bubble.indexOf('>'));
    expect(open).toContain('border-radius:4px');
    // The mutation this row exists to kill: a coloured edge on one side, which
    // is what the mock drew and what D-98 superseded.
    expect(open).not.toMatch(/border-left/);
    expect(open).not.toMatch(/border-right/);
    expect(open).not.toMatch(/border-top:/);
    expect(open).not.toMatch(/border-bottom:/);
    // …and no asymmetric corner, the mock's `14px 14px 4px 14px`.
    expect(open).not.toMatch(/border-radius:[^;"]*\s[^;"]*px/);
  });

  it('carries the kind as TEXT in the eyebrow, in the stream\'s own colour', () => {
    const html = render({ bubble: { ...BUBBLE, eyebrowColor: 'var(--ft-amber)' } });
    expect(html).toContain('data-bubble-eyebrow="1"');
    expect(html).toContain('color:var(--ft-amber)');
  });

  it('clips the line at the reader\'s width rather than at a character count', () => {
    const html = render();
    expect(html).toContain('text-overflow:ellipsis');
    expect(html).toContain('white-space:nowrap');
    expect(html).toContain(BUBBLE.line); // the WHOLE line reaches the DOM
  });

  it('authors no hex — every colour is a token (BUILD_RULES §10)', () => {
    expect(render({ isDesktop: true }).match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });
});

describe('CharacterAvatar — nothing idle (D-91)', () => {
  it('declares no CSS animation anywhere', () => {
    // The bug widget this mark replaces ran `clashbot-pulse 2s infinite`
    // (hazard 36). Nothing here may inherit that habit.
    const html = render();
    expect(html).not.toMatch(/animation/);
    expect(html).not.toMatch(/@keyframes/);
  });

  it('both doors open the same pane', () => {
    let opened = 0;
    const props = { onOpen: () => { opened += 1; } };
    // renderToString cannot click; the contract asserted here is that both
    // controls are BUTTONS bound to the one handler (the mounted suite taps
    // them). A non-button would not be reachable by keyboard at all.
    const html = render(props);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('type="button"');
    expect(opened).toBe(0);
  });
});

describe('Review lens 1 F6 — the face reads the pair the BOARD shows (§9, Gate 1)', () => {
  it('passes the displayed scores through, not the persisted ones', async () => {
    // The defect: both new mounts read scoreState.currentScore / opponentScore
    // while the arena header two inches away renders the live pair. The
    // presence face derives its standing from these, and presenceBinding's
    // Gate 1 forbids a parallel recompute — so on desktop, with the pane open,
    // two marks on one page could read different numbers, in SIGN.
    vi.resetModules();
    const seen = [];
    vi.doMock('../../config/featureFlags', async (importOriginal) => ({
      ...(await importOriginal()),
      isAgentPresenceOn: () => true,
    }));
    vi.doMock('../../components/AgentPresence/AgentPresenceMount', () => ({
      default: (props) => { seen.push(props); return null; },
    }));
    const Fresh = (await import('./CharacterAvatar.jsx')).default;
    renderToString(
      <Fresh
        agentBattle={{ scoreState: { currentScore: -5, opponentScore: 3 } }}
        playerScore={12}
        opponentScore={3}
        unread={0}
        onOpen={() => {}}
      />,
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].duel.playerScore).toBe(12);   // the board's number
    expect(seen[0].duel.opponentScore).toBe(3);
    expect(seen[0].duel.playerScore).not.toBe(-5); // …not the persisted one
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
  });
});

describe('Review lens 4 F2 / F4 / F5 — the honesty rules, guarded by something', () => {
  const SOURCE = readFileSync(new URL('./CharacterAvatar.jsx', import.meta.url), 'utf8');
  // Comments describe the rules and legitimately name the things they forbid;
  // strip them so a note about `setTimeout` is not read as a use of one.
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('NO CLOCK IS READ IN THIS FILE — the property behind "a timer alone does nothing"', () => {
    // The seed asks for "a fake-timer row proves a timer alone does nothing".
    // The row that claimed it could not fail (review lens 4 F2): the SSR render
    // runs no effects, and the mounted row fakes only `Date`, so no timer ever
    // fired. A 500 ms effect composing a `Thinking…` bubble — the exact thing
    // brief §4.2 forbids — survived both.
    //
    // A SOURCE row is the honest instrument, as it is for the flag's deleted
    // query override: the claim is that the component CANNOT be driven by time,
    // and that is a property of the file, not of one render.
    expect(CODE).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
    expect(CODE).not.toMatch(/Date\.now|new Date/);
    expect(CODE).not.toMatch(/useEffect/);
  });

  it('NOTHING REPEATS — no idle loop, in CSS or in Framer (D-91)', () => {
    // The `no CSS animation` row is honest about CSS and blind to Framer: an
    // idle `animate={{ scale: [1,1.08,1] }}` with the transition passed as an
    // IDENTIFIER is invisible to it, to the motion guard (its documented
    // `transition={{` blind spot) and to a 975-row broad set (lens 4 F5, M4).
    expect(CODE).not.toMatch(/repeat\s*:/);
    expect(CODE).not.toMatch(/Infinity/);
    expect(CODE).not.toMatch(/repeatType|yoyo/);
  });

  it('reduced motion means NO FADE, not a shorter one (seed §4)', () => {
    // SSR paints framer's `initial` inline, so this is readable without a mount.
    const moving = render({ unread: 1, reducedMotion: false });
    const still = render({ unread: 1, reducedMotion: true });
    expect(moving).toContain('opacity:0');
    expect(still).not.toContain('opacity:0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shadow vs CPU quote integrity (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
// §5.3 R-7/V-4, OFF-6; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// OFF-6 — without the new `comparison` prop the mark's markup and the face's
// `duel` input are byte-identical to the pre-build SHA (captured there with
// SHADOW_OFF_CAPTURE_DIR).
// ─────────────────────────────────────────────────────────────────────────────

const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
const digest = (s) => ({ sha256: createHash('sha256').update(s).digest('hex'), length: s.length });
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `characterAvatar.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual, `OFF-6 reference ${name} (captured at ${OFF_REFERENCE_SHA})`).toEqual(expected);
}

const OFF_VARIANTS = {
  mobileBubble: { isDesktop: false },
  desktopBubble: { isDesktop: true },
  quiet: { unread: 0, bubble: null },
  standalone: { unread: 0, bubble: { ...BUBBLE, standalone: true } },
  pairPassed: { playerScore: 4, opponentScore: 9 },
  inset: { viewportInset: 34, reducedMotion: true },
};

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (7 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF6 = {
 "desktopBubble": {
  "length": 2061,
  "sha256": "3897dd6ec53c6f4083523c14e918f0dc625e6ed683376a55f230be54de7e29c7"
 },
 "inset": {
  "length": 2050,
  "sha256": "6a17ee341ccadb12d2b2d38dddde990735bb816fb42fddd92fa2acc333bab3dc"
 },
 "mobileBubble": {
  "length": 2061,
  "sha256": "c2b02892aa74d0ebca64b3ec8b09e15433d3e50ea8d3e98189e4af7f0e57e76e"
 },
 "pairPassed": {
  "length": 2061,
  "sha256": "c2b02892aa74d0ebca64b3ec8b09e15433d3e50ea8d3e98189e4af7f0e57e76e"
 },
 "presenceDuel": [
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 44
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 9,
    "playerScore": 4,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 40
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
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
  }
 ],
 "quiet": {
  "length": 683,
  "sha256": "8d50511096aedb6d2d46265dafed2caecfe6c5d66eed7aa9896cd44a4350e975"
 },
 "standalone": {
  "length": 1707,
  "sha256": "c499b19ee59e05afeb50f0e1120287fc7f5a675c00708aab8bbecf2404769473"
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-6 — CharacterAvatar default markup is byte-identical to the pre-build SHA', () => {
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
    const Fresh = (await import('./CharacterAvatar.jsx')).default;
    for (const [, props] of Object.entries(OFF_VARIANTS)) {
      renderToString(<Fresh agentBattle={BATTLE} bubble={BUBBLE} unread={3} onOpen={() => {}} {...props} />);
    }
    renderToString(<Fresh agentBattle={{ ...BATTLE, scoreState: {} }} onOpen={() => {}} />);
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
    offReference('presenceDuel', seen, OFF6.presenceDuel);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ON — the mark's face as a comparison consumer (R-7, V-4)
// ─────────────────────────────────────────────────────────────────────────────

describe('ON — CharacterAvatar reads the ONE selected comparison', () => {
  const NOW_MS = Date.parse('2026-10-01T17:00:00.000Z');

  it('available: the duel is exactly the selected pair; unavailable: score keys omitted; controls kept', async () => {
    const { selectComparison } = await import('./shadowCpuQuoteIntegrity.js');
    vi.resetModules();
    const seen = [];
    vi.doMock('../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isAgentPresenceOn: () => true }));
    vi.doMock('../../components/AgentPresence/AgentPresenceMount', () => ({ default: (props) => { seen.push(props.duel); return null; } }));
    const Fresh = (await import('./CharacterAvatar.jsx')).default;
    const avail = selectComparison({ status: 'active', complete: true, browserPair: [4, 9], scoreState: null, contextKey: 'c', nowMs: NOW_MS });
    const unav = selectComparison({ status: 'active', complete: false, browserPair: null, scoreState: null, contextKey: 'c', nowMs: NOW_MS });
    const a = strip(renderToString(<Fresh agentBattle={BATTLE} playerScore={50} opponentScore={1} comparison={avail} bubble={BUBBLE} unread={3} onOpen={() => {}} />));
    const u = strip(renderToString(<Fresh agentBattle={BATTLE} playerScore={50} opponentScore={1} comparison={unav} bubble={BUBBLE} unread={3} onOpen={() => {}} />));
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
    expect(seen[0]).toEqual({ playerScore: 4, opponentScore: 9, statusFeed: null });
    expect(seen[1]).toEqual({ statusFeed: null });
    expect('playerScore' in seen[1]).toBe(false);
    // The open button, its accessible name, the unread badge and the bubble stay.
    for (const html of [a, u]) {
      expect(html).toContain('data-character-mark="1"');
      expect(html).toContain(`aria-label="${esc(COPY.paneOpenName(3))}"`);
      expect(html).toContain('data-unread-badge="1"');
      expect(html).toContain('data-character-bubble="1"');
    }
  });
});
