// src/screens/battleView/CharacterPane.comparison.render.test.jsx
//
// Shadow vs CPU quote integrity — the pane's face as a comparison consumer
// (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §5.3 R-7, V-4; ON-F5a
// consumer rows, OFF-6; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The pane's face takes the SELECTED pair, or — when the comparison is
// unavailable — a duel with both score keys OMITTED (never null: the binding
// coerces with Number(), and Number(null) is a finite 0). The rest of the
// pane (name, archetype, sections, close) is untouched either way.
//
// OFF-6 — without the `comparison` prop the pane renders byte-identically to
// the pre-build SHA and its face gets the pre-build duel input (captured there
// with SHADOW_OFF_CAPTURE_DIR).

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { PANE_SECTION } from './useCharacterPane';

vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
}));

const CharacterPane = (await import('./CharacterPane.jsx')).default;

const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
const digest = (s) => ({ sha256: createHash('sha256').update(s).digest('hex'), length: s.length });
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `characterPane.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual, `OFF-6 reference ${name} (captured at ${OFF_REFERENCE_SHA})`).toEqual(expected);
}

const BATTLE = {
  agentContext: { agentName: 'Aurora', archetype: 'degen' },
  scoreState: { currentScore: 12, opponentScore: 3 },
};
const strip = (h) => h.replace(/<!-- -->/g, '');
const render = (Comp, props = {}) => strip(renderToString(
  <Comp
    agentBattle={BATTLE}
    open
    section={PANE_SECTION.CHAT}
    onSelectSection={() => {}}
    onClose={() => {}}
    chat={<div data-test-chat="1">chat</div>}
    bench={<div data-test-bench="1">bench</div>}
    tape={<div data-test-tape="1">tape</div>}
    overflow={<span data-test-overflow="1" />}
    {...props}
  />,
));

const OFF_VARIANTS = {
  mobileChat: {},
  desktopChat: { isDesktop: true, showArchetype: true },
  bench: { section: PANE_SECTION.BENCH },
  closed: { open: false },
  pairPassed: { playerScore: 4, opponentScore: 9 },
  reduced: { reducedMotion: true, isDesktop: true },
};

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (7 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF6 = {
 "bench": {
  "length": 3578,
  "sha256": "4c8a6198b0bd44bc603dbe20392ae65615432856712beff204fd8dc8dcded206"
 },
 "closed": {
  "length": 3589,
  "sha256": "9a7039b3a2f9a0fe61e5603f5a0b893496b6cbcb67066fb3f3474ab5f8b766af"
 },
 "desktopChat": {
  "length": 3773,
  "sha256": "0542bc963a85d5bcd944939bc2a2880ac496f8a3cdab796b60c4f51f160ed5c0"
 },
 "mobileChat": {
  "length": 3578,
  "sha256": "775eb49f037391a2e1e6d04bb65460b4890169efc3f8c0feab76ea3132834476"
 },
 "pairPassed": {
  "length": 3578,
  "sha256": "775eb49f037391a2e1e6d04bb65460b4890169efc3f8c0feab76ea3132834476"
 },
 "presenceDuel": [
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 36
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 36
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 36
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 36
  },
  {
   "duel": {
    "opponentScore": 9,
    "playerScore": 4,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 36
  },
  {
   "duel": {
    "opponentScore": 3,
    "playerScore": 12,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 36
  },
  {
   "duel": {
    "opponentScore": 0,
    "playerScore": 0,
    "statusFeed": null
   },
   "reactivityLevel": "static",
   "size": 36
  }
 ],
 "reduced": {
  "length": 3594,
  "sha256": "43c9388eba36e64cfd4d946885438a71944ed7b2fc1fb910c6a5df04f014acea"
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-6 — CharacterPane default markup is byte-identical to the pre-build SHA', () => {
  for (const [name, props] of Object.entries(OFF_VARIANTS)) {
    it(`OFF ${name}`, () => {
      offReference(name, digest(render(CharacterPane, props)), OFF6[name]);
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
    const Fresh = (await import('./CharacterPane.jsx')).default;
    for (const [, props] of Object.entries(OFF_VARIANTS)) render(Fresh, props);
    render(Fresh, { agentBattle: { ...BATTLE, scoreState: {} } });
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
    offReference('presenceDuel', seen, OFF6.presenceDuel);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ON — the pane's face reads the ONE selected comparison
// ─────────────────────────────────────────────────────────────────────────────

describe('ON — CharacterPane comparison transitions', () => {
  const NOW_MS = Date.parse('2026-10-01T17:00:00.000Z');

  it('browser → stored → unavailable → stored: the duel follows the selected pair, keys omitted when unavailable', async () => {
    const { selectComparison } = await import('./shadowCpuQuoteIntegrity.js');
    vi.resetModules();
    const seen = [];
    vi.doMock('../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isAgentPresenceOn: () => true }));
    vi.doMock('../../components/AgentPresence/AgentPresenceMount', () => ({ default: (props) => { seen.push({ duel: props.duel, reactivityLevel: props.reactivityLevel }); return null; } }));
    const Fresh = (await import('./CharacterPane.jsx')).default;
    const pick = (over) => selectComparison({ status: 'active', complete: false, browserPair: null, scoreState: null, contextKey: 'c', nowMs: NOW_MS, ...over });
    const sequence = [
      pick({ complete: true, browserPair: [12, 3] }),
      pick({ scoreState: { currentScore: -0.01, opponentScore: 0, lastScoredAt: '2026-10-01T16:47:00.000Z' } }),
      pick({}),
      pick({ scoreState: { currentScore: 10.4, opponentScore: 10.4, lastScoredAt: '2026-10-01T16:47:00.000Z' } }),
    ];
    const htmls = sequence.map((comparison) => render(Fresh, { comparison, playerScore: 99, opponentScore: 99 }));
    vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
    vi.doUnmock('../../config/featureFlags');
    vi.resetModules();
    expect(seen.map((s) => s.duel)).toEqual([
      { playerScore: 12, opponentScore: 3, statusFeed: null },
      { playerScore: -0.01, opponentScore: 0, statusFeed: null },
      { statusFeed: null },
      { playerScore: 10.4, opponentScore: 10.4, statusFeed: null },
    ]);
    expect(seen.every((s) => s.reactivityLevel === 'static')).toBe(true);
    // Name, sections, close and the three section contents are untouched.
    for (const html of htmls) {
      expect(html).toContain('data-pane-agent-name="1"');
      expect(html).toContain('data-pane-tablist="1"');
      expect(html).toContain('data-pane-close="1"');
      expect(html).toContain('data-test-chat="1"');
      expect(html).toContain('data-test-bench="1"');
      expect(html).toContain('data-test-tape="1"');
    }
  });

  it('presence off: the pane renders the same markup with or without a comparison (the face is the only reader)', () => {
    const c = { available: false };
    expect(render(CharacterPane, { comparison: c })).toBe(render(CharacterPane, {}));
  });
});
