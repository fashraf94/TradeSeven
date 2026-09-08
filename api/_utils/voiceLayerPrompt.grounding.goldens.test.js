// api/_utils/voiceLayerPrompt.grounding.goldens.test.js
//
// Voice-layer grounding — THE OFF-STATE GOLDENS (spec §9 'off', §10 "off
// goldens"; the Sep 7 rulings §1: "captured AFTER the ATR pick, from that
// commit").
//
// THE DARK CONTRACT. With VOICE_GROUNDING_MODE 'off' (its live value) every
// prompt the arc touches is BYTE-IDENTICAL to the pre-grounding assembly. The
// bytes live in __fixtures__/voiceGroundingOffGoldens.json, captured by running
// THIS file in regeneration mode inside a `git archive 70ba90a1` snapshot tree
// — 70ba90a1 is the cherry-pick of the ATR fix (40008de8) onto this branch, the
// last commit before any grounding edit touched the prompt module — so the
// goldens are the untouched module's own output, not a copy of what the
// grounded module happens to render with its flag off.
//
// Surfaces held to the byte, from ONE deterministic fixture module
// (__fixtures__/voiceGroundingFixtures.js) under a frozen clock:
//   · buildVoiceLayerPrompt — battle mode: discovery / refinement / mastery,
//     archetype integrity off and 'enforce', with and without the cache, the
//     League tournament variant; review mode;
//   · buildFirstMessagePrompt — with and without the cache;
//   · buildTradeNarrationPrompt · buildAnticipationPrompt;
//   · buildTemplateOpener (the deterministic opener floor).
// The battle fixture ALREADY carries evaluations, a directive, a mixed chat
// history and cache briefs with a `fundamentals` field — everything the
// grounded prompt renders — so equality here proves the off state ignores all
// of it, not merely that the fixture is thin.
//
// The archetype flag is walked through the live-getter mock (importOriginal
// spread, the safe shape); the market state is pinned OPEN; the clock is
// frozen to FROZEN_NOW so computeTimeRemaining / computeGameContext /
// buildIntradayLine cannot drift the bytes.
//
// REGENERATE (only ever from the pre-grounding snapshot, never from a tree
// that carries the grounding edits):
//   GENERATE_VOICE_GROUNDING_OFF_GOLDENS=1 ./node_modules/.bin/vitest run \
//     api/_utils/voiceLayerPrompt.grounding.goldens.test.js
//
// Dependency-surface guard (BUILD_RULES §4): this file's import of the prompt
// module is the runtime guard that it stays Node-clean. Never mock it.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { mockMarketState, archetypeFlag } = vi.hoisted(() => ({
  mockMarketState: {
    isOpen: true,
    state: 'OPEN',
    nextOpenTime: new Date('2026-09-09T13:30:00Z'),
    isEarlyClose: false,
  },
  archetypeFlag: { mode: 'off' },
}));

vi.mock('./marketSchedule.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getMarketState: () => ({ ...mockMarketState }) };
});

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return archetypeFlag.mode; },
}));

import {
  buildVoiceLayerPrompt,
  buildFirstMessagePrompt,
  buildTradeNarrationPrompt,
  buildAnticipationPrompt,
  getAgentPhase,
} from './voiceLayerPrompt.js';
import { buildTemplateOpener } from './openerTemplateFloor.js';
// The shipped elicitation table (15 strings, one sent every battle turn): pinned
// as bytes here because the goldens above render the FIXTURE's copy of one line
// (review R-25). The table was byte-identical before and after the build.
import { ELICITATION_INSTRUCTIONS } from '../agent/chat.js';
import {
  FROZEN_NOW,
  makeAgent,
  makeBattle,
  makeTournamentBattle,
  makeMarketSnapshot,
  makeCandidate,
  makeClosedTrade,
  makeDailyReviews,
  ELICITATION_TARGET,
  CAPABILITIES_MANIFEST,
  ANCHOR_CONTEXT,
  SUPPORTED_TERMS,
} from './__fixtures__/voiceGroundingFixtures.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDENS_PATH = path.join(HERE, '__fixtures__', 'voiceGroundingOffGoldens.json');
const REGENERATE = globalThis.process?.env?.GENERATE_VOICE_GROUNDING_OFF_GOLDENS === '1';

const DISCOVERY_AGENT = makeAgent({ stats: { gamesPlayed: 4, wins: 2, losses: 2 } });
const REFINEMENT_AGENT = makeAgent({ stats: { gamesPlayed: 18, wins: 10, losses: 8 } });
const MASTERY_AGENT = makeAgent({ stats: { gamesPlayed: 40, wins: 25, losses: 15 } });

const HISTORY = [
  { role: 'user', content: 'How are we looking?' },
  { role: 'assistant', content: 'CF is carrying the book; KO is the drag.' },
];

/**
 * Every surface, keyed. The archetype flag is set per render and reset after,
 * so each key names its own flag state and the order of rendering cannot
 * leak state between keys.
 */
function renderAll() {
  const withArchetype = (mode, fn) => {
    const prev = archetypeFlag.mode;
    archetypeFlag.mode = mode;
    try { return fn(); } finally { archetypeFlag.mode = prev; }
  };
  const base = (agent, battle, marketSnapshot, extra = {}) => buildVoiceLayerPrompt({
    agent,
    battle,
    elicitationTarget: ELICITATION_TARGET,
    conversationHistory: HISTORY,
    anchorContext: ANCHOR_CONTEXT,
    marketSnapshot,
    mode: 'battle',
    dailyReviews: battle.dailyReviews || [],
    dailyGrades: battle.dailyGrades || {},
    ...extra,
  });

  return {
    'battle.discovery.archetypeOff.noCache': withArchetype('off', () => base(DISCOVERY_AGENT, makeBattle(), null)),
    'battle.discovery.archetypeOff.cache': withArchetype('off', () => base(DISCOVERY_AGENT, makeBattle(), makeMarketSnapshot())),
    'battle.refinement.enforce.cache': withArchetype('enforce', () => base(REFINEMENT_AGENT, makeBattle(), makeMarketSnapshot(), { capabilitiesManifest: CAPABILITIES_MANIFEST })),
    'battle.mastery.enforce.cache.tournament': withArchetype('enforce', () => base(MASTERY_AGENT, makeTournamentBattle(), makeMarketSnapshot(), { capabilitiesManifest: CAPABILITIES_MANIFEST })),
    'battle.discovery.enforce.noCache.noAnchor': withArchetype('enforce', () => base(DISCOVERY_AGENT, makeBattle(), null, { anchorContext: null, capabilitiesManifest: null })),
    'battle.discovery.off.cache.evalFailures': withArchetype('off', () => base(DISCOVERY_AGENT, makeBattle({ cronState: { consecutiveEvalFailures: 2, intradayMomentum: {} } }), makeMarketSnapshot())),
    'review.refinement.cache': withArchetype('enforce', () => buildVoiceLayerPrompt({
      agent: REFINEMENT_AGENT,
      battle: makeBattle({ status: 'completed', dailyReviews: makeDailyReviews() }),
      elicitationTarget: ELICITATION_TARGET,
      conversationHistory: [],
      anchorContext: ANCHOR_CONTEXT,
      marketSnapshot: makeMarketSnapshot(),
      mode: 'review',
      dailyReviews: makeDailyReviews(),
      dailyGrades: { '2026-09-08': 'B+' },
    })),
    'firstMessage.discovery.noCache': buildFirstMessagePrompt({
      agent: DISCOVERY_AGENT,
      battle: makeBattle({ chatExchanges: [], evaluations: [], trades: [], directive: null }),
      anchorContext: ANCHOR_CONTEXT,
      marketSnapshot: null,
      currentPhase: getAgentPhase(4),
      supportedTerms: SUPPORTED_TERMS,
      executionMode: 'autopilot',
    }),
    'firstMessage.mastery.cache': buildFirstMessagePrompt({
      agent: MASTERY_AGENT,
      battle: makeBattle({ chatExchanges: [], evaluations: [], trades: [], directive: null }),
      anchorContext: null,
      marketSnapshot: makeMarketSnapshot(),
      currentPhase: getAgentPhase(40),
      supportedTerms: SUPPORTED_TERMS,
      executionMode: 'autopilot',
    }),
    'tradeNarration.refinement.cache.directive': withArchetype('enforce', () => buildTradeNarrationPrompt({
      agent: REFINEMENT_AGENT,
      battle: makeBattle(),
      anchorContext: ANCHOR_CONTEXT,
      marketSnapshot: makeMarketSnapshot(),
      currentPhase: getAgentPhase(18),
      swap: makeClosedTrade(),
      rationale: makeClosedTrade().rationale,
      provenance: 'autopilot',
      directive: makeBattle().directive,
      supportedTerms: SUPPORTED_TERMS,
      executionMode: 'autopilot',
    })),
    'tradeNarration.discovery.noCache.risk': withArchetype('off', () => buildTradeNarrationPrompt({
      agent: DISCOVERY_AGENT,
      battle: makeBattle({ directive: null }),
      anchorContext: null,
      marketSnapshot: null,
      currentPhase: getAgentPhase(4),
      swap: makeClosedTrade({ rationale: 'Risk manager: drawdown -7%, hit protective threshold', source: 'risk_manager', evaluationId: null }),
      rationale: 'Risk manager: drawdown -7%, hit protective threshold',
      provenance: 'risk_triggered',
      directive: null,
      supportedTerms: SUPPORTED_TERMS,
      executionMode: 'autopilot',
    })),
    'anticipation.refinement.cache.directive': withArchetype('enforce', () => buildAnticipationPrompt({
      agent: REFINEMENT_AGENT,
      battle: makeBattle(),
      anchorContext: ANCHOR_CONTEXT,
      marketSnapshot: makeMarketSnapshot(),
      currentPhase: getAgentPhase(18),
      anticipationCandidate: makeCandidate(),
      directive: makeBattle().directive,
      supportedTerms: SUPPORTED_TERMS,
      executionMode: 'autopilot',
    })),
    'anticipation.discovery.noCache.exit': withArchetype('off', () => buildAnticipationPrompt({
      agent: DISCOVERY_AGENT,
      battle: makeBattle({ directive: null }),
      anchorContext: null,
      marketSnapshot: null,
      currentPhase: getAgentPhase(4),
      anticipationCandidate: makeCandidate({ symbol: 'MOS', direction: 'potential_exit', signalSummary: 'Momentum fading and relative strength rolling over.', threshold: 'One more session of underperformance and I would rotate out.', rationale: undefined, signalSource: undefined }),
      directive: null,
      supportedTerms: SUPPORTED_TERMS,
      executionMode: 'autopilot',
    })),
    'templateOpener.full': buildTemplateOpener({ agent: DISCOVERY_AGENT, battle: makeBattle() }),
    'templateOpener.emptyBook.unknownArchetype': buildTemplateOpener({ agent: makeAgent({ archetype: 'strategist' }), battle: makeBattle({ portfolio: { star: [], core: [], support: [] }, agentContext: {} }) }),
    'elicitation.table': Object.entries(ELICITATION_INSTRUCTIONS).map(([dimension, instruction]) => `${dimension}: ${instruction}`).join('\n'),
  };
}

let RENDERED;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FROZEN_NOW));
  RENDERED = renderAll();
  if (REGENERATE) {
    writeFileSync(GOLDENS_PATH, `${JSON.stringify(RENDERED, null, 2)}\n`);
  }
});

afterAll(() => {
  vi.useRealTimers();
});

// Read lazily (inside the rows), so a regeneration run asserts against the
// bytes it just wrote rather than against a file that did not exist at load.
const loadGoldens = () => (existsSync(GOLDENS_PATH) ? JSON.parse(readFileSync(GOLDENS_PATH, 'utf8')) : null);

describe("Voice-layer grounding — 'off' is byte-identical to the pre-grounding prompt (goldens @ 70ba90a1)", () => {
  it('the golden file exists and names every surface this file renders (and nothing else)', () => {
    const GOLDENS = loadGoldens();
    expect(GOLDENS, 'run the regeneration command in the header, from the 70ba90a1 snapshot').not.toBeNull();
    expect(Object.keys(GOLDENS).sort()).toEqual(Object.keys(RENDERED).sort());
  });

  const KEYS = [
    'battle.discovery.archetypeOff.noCache',
    'battle.discovery.archetypeOff.cache',
    'battle.refinement.enforce.cache',
    'battle.mastery.enforce.cache.tournament',
    'battle.discovery.enforce.noCache.noAnchor',
    'battle.discovery.off.cache.evalFailures',
    'review.refinement.cache',
    'firstMessage.discovery.noCache',
    'firstMessage.mastery.cache',
    'tradeNarration.refinement.cache.directive',
    'tradeNarration.discovery.noCache.risk',
    'anticipation.refinement.cache.directive',
    'anticipation.discovery.noCache.exit',
    'templateOpener.full',
    'templateOpener.emptyBook.unknownArchetype',
    'elicitation.table',
  ];

  it.each(KEYS)('%s — byte-identical', (key) => {
    expect(typeof RENDERED[key]).toBe('string');
    expect(RENDERED[key].length).toBeGreaterThan(0);
    expect(RENDERED[key]).toBe(loadGoldens()?.[key]);
  });

  it('the fixture carries everything the grounded prompt would render, and none of it reaches the off bytes', () => {
    // The proof that equality means something: the record, the directive
    // line's vocabulary, the fundamentals field and the grounded headings are
    // absent from every off surface even though the fixture supplies them.
    const battle = makeBattle();
    expect(battle.evaluations.length).toBe(5);
    expect(battle.directive.text).toBe('Require stronger confirmation before entering');
    expect(makeMarketSnapshot().portfolioBriefs[0].fundamentals).toBeTruthy();
    for (const key of KEYS.filter((k) => k.startsWith('battle.'))) {
      const text = RENDERED[key];
      expect(text).not.toContain('YOUR RECORD');
      expect(text).not.toContain('CURRENT CONTEXT');
      expect(text).not.toContain('CURRENT DIRECTIVE');
      expect(text).not.toContain('Fundamentals (as of');
      expect(text).not.toContain('CF will break out');
    }
  });
});
