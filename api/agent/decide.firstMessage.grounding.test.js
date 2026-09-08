// api/agent/decide.firstMessage.grounding.test.js
//
// Voice-layer grounding — THE DEPLOY-TIME OPENER (the §7-authorized one-key
// fence contact of Sep 8; the "recorded, not built" clause of D-102).
//
// generateFirstMessageOnDeploy is private to fenced decide.js, so this file
// drives it through runPrescribedTournamentDeploy — the smallest exported
// deploy unit that reaches it (the decide.baselineGate.behavior.test.js seam):
// no Anthropic pipeline, the prescribed six, `isCpu: false` so the opener runs
// (decide.js:1487-1489). Only side-effecting collaborators are mocked: pricing,
// the fenced createAgentBattle (spied, never modified), the compiled-build
// gate, Gemma, the shadow logger. The prompt module is the REAL module behind a
// pass-through spy, so the bytes Gemma is handed are the real assembly and the
// argument the fenced call site asked for is observable at the same time.
//
// Two things are held:
//   · THE GOLDEN — under 'off', 'shadow', and 'canary' for an owner outside the
//     allowlist, the system prompt handed to Gemma is BYTE-IDENTICAL to the
//     pre-grounding capture in __fixtures__/voiceGroundingOffGoldens.json (the
//     70ba90a1 snapshot's own output — voiceLayerPrompt.grounding.goldens.test.js
//     says how it was captured). The golden's conditions are reproduced through
//     the Firestore docs decide.js READS (decide.js:1533-1563: the anchor line
//     is `Regime: ${regime}. ${regimeDetail}` from indexIntelligence/marketContext,
//     the brief from dailyRegimeBrief, the snapshot from voiceLayerCache/{id}),
//     never passed in — so the rows prove the deploy path end to end.
//   · THE OPTION — under 'on', and under 'canary' for an allowlisted owner, the
//     builder is asked for `grounded: true` (the argument itself is asserted),
//     the accessor is asked once with the BATTLE's owner uid (D-101: "the battle
//     OWNER's uid for the crons and the lazy opener"), and what Gemma receives
//     equals the real builder's grounded assembly — the same prompt the lazy
//     opener (ensure-opener.js:191, :257) already sends.
//
// The mode is walked through the live accessor mock, which delegates to the
// REAL resolveVoiceGroundingMode with the walked flag value and a walked
// allowlist — the canary rows exercise the shipped allowlist semantics, not a
// stub of them.
//
// Pinned on purpose — what the fence contact did NOT change: the exchange the
// deploy path writes is the shipped shape in every state, with no
// `groundingVersion` marker. D-102 (ruling 4) admits only stamped exchanges to
// the history window; the deploy-time opener stays out of it, grounded or not.
// Stamping it is a separate ruling, not this change's. And the call site passes
// exactly the keys it passed before plus the one — the "one key" is asserted.
//
// Mutation table (each mutation was applied to the working tree, run, and
// reverted byte-exact; the counts are what was observed, of 24 rows):
//   · `!== 'off'` in place of `=== 'on'`      → 7 red: every 'shadow' and
//     canary-unlisted golden row, and the dark-bytes row
//   · `grounded: true`                         → 14 red: every dark row, and the
//     live rows too (the accessor is asserted consulted)
//   · the key dropped                          → 15 red: the live rows (undefined
//     is not true), the dark rows (undefined is not false), the one-key row
//   · `agentData.ownerId` for `battle.ownerId` → 1 red: the distinct-owner row
//
// Dependency-surface guard (BUILD_RULES §4): decide.js and the prompt module are
// imported for real here (the prompt module through importOriginal). Never mock
// the prompt assembly away in this file — the golden rows would pass vacuously.

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW,
  CANARY_UID,
  makeAgent,
  makeBattle,
  makeMarketSnapshot,
  ANCHOR_CONTEXT,
  SUPPORTED_TERMS,
} from '../_utils/__fixtures__/voiceGroundingFixtures.js';

const state = vi.hoisted(() => ({
  mode: 'off',
  canaryUids: '',
  calls: [],
  firstMessageArgs: [],
  market: { isOpen: true, state: 'OPEN', nextOpenTime: new Date('2026-09-09T13:30:00Z'), isEarlyClose: false },
}));

const mocks = vi.hoisted(() => ({
  getStockAnalysisData: vi.fn(),
  createAgentBattle: vi.fn(),
  ensureDeployableCompiledBuild: vi.fn(),
  callGemmaVoice: vi.fn(),
  parseVoiceLayerResponse: vi.fn(),
  logDecision: vi.fn(async () => {}),
  logFirstMessage: vi.fn(async () => {}),
}));

// The pricing read is stubbed; the rest of the module stays real — the prompt
// module's own `toEtParts` import (voiceLayerPrompt.js:12) renders the cache
// surface's dated lines, and a wholesale stub would fail the build silently
// inside decide.js's swallow-everything catch.
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getStockAnalysisData: mocks.getStockAnalysisData,
}));
vi.mock('../_utils/agentBattleService.js', () => ({ createAgentBattle: mocks.createAgentBattle }));
vi.mock('../_utils/deployBuildValidation.js', () => ({ ensureDeployableCompiledBuild: mocks.ensureDeployableCompiledBuild }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: mocks.callGemmaVoice,
  parseVoiceLayerResponse: mocks.parseVoiceLayerResponse,
}));
vi.mock('../_utils/shadowLogger.js', () => ({ logDecision: mocks.logDecision, logFirstMessage: mocks.logFirstMessage }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (v) => ({ __arrayUnion: v }) } }));
// The golden was captured with the fixture's four terms (decide.js hands the
// live TERM_TOKENS to the same parameter); the fixture's list stands in for it.
vi.mock('../_utils/termUniverse.js', async () => {
  const { SUPPORTED_TERMS: terms } = await import('../_utils/__fixtures__/voiceGroundingFixtures.js');
  return { TERM_TOKENS: terms };
});
// The goldens' own environment (voiceLayerPrompt.grounding.goldens.test.js):
// the market pinned OPEN, the archetype flag 'off', the clock frozen below.
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getMarketState: () => ({ ...state.market }),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get ARCHETYPE_INTEGRITY_MODE() { return 'off'; },
    // The walked flag value + the walked allowlist through the REAL resolver.
    getVoiceGroundingMode: (uid) => {
      state.calls.push(uid);
      return actual.resolveVoiceGroundingMode(state.mode, uid, state.canaryUids);
    },
  };
});
vi.mock('../_utils/voiceLayerPrompt.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildFirstMessagePrompt: (args) => {
      state.firstMessageArgs.push(args);
      return actual.buildFirstMessagePrompt(args);
    },
  };
});

const { runPrescribedTournamentDeploy } = await import('./decide.js');
const promptModule = await vi.importActual('../_utils/voiceLayerPrompt.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDENS = JSON.parse(readFileSync(path.join(HERE, '../_utils/__fixtures__/voiceGroundingOffGoldens.json'), 'utf8'));

const SIX = ['AAPL', 'NVDA', 'MSFT', 'GOOG', 'AMZN', 'META'];
const UNIVERSE = SIX.map((s) => ({ symbol: s, name: s, atrPercentile: 0.5 }));
const VALID_PRICE = { price: { current: 150, high: 152, low: 148, previousClose: 149 }, daily: [{ close: 149 }] };

/** The golden battle: a fresh deploy's doc — empty chat, no record, no directive. */
const goldenBattle = (overrides = {}) => makeBattle({ chatExchanges: [], evaluations: [], trades: [], directive: null, ...overrides });

/**
 * The two first-message surfaces the golden file holds, keyed as it keys them,
 * each expressed as the DOCS decide.js reads (not the builder's arguments) plus
 * the arguments the real builder needs to render the same surface grounded.
 */
const SURFACES = {
  'firstMessage.discovery.noCache': {
    agent: () => makeAgent({ stats: { gamesPlayed: 4, wins: 2, losses: 2 } }),
    docs: () => ({
      // decide.js:1552 — `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim();
      // no dailyRegimeBrief doc → no brief line → the fixture's ANCHOR_CONTEXT.
      'indexIntelligence/marketContext': { regime: 'bull', regimeDetail: 'Broad participation, low volatility. Semis lead; energy lags into the afternoon.' },
    }),
    args: () => ({ anchorContext: ANCHOR_CONTEXT, marketSnapshot: null }),
  },
  'firstMessage.mastery.cache': {
    agent: () => makeAgent({ stats: { gamesPlayed: 40, wins: 25, losses: 15 } }),
    docs: () => ({
      // no marketContext doc → anchorContext stays null; the cache doc is the snapshot.
      'voiceLayerCache/battle-1': makeMarketSnapshot(),
    }),
    args: () => ({ anchorContext: null, marketSnapshot: makeMarketSnapshot() }),
  },
};

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function makeDb(docs) {
  const updates = [];
  const col = (name) => {
    const q = {
      doc: (id) => ({
        get: async () => {
          if (name === 'indexIntelligence' && id === 'stockRankings') return { exists: true, data: () => ({ stocks: UNIVERSE }) };
          const d = docs[`${name}/${id}`];
          return d ? { exists: true, data: () => d } : { exists: false, data: () => ({}) };
        },
        update: async (data) => { updates.push({ path: `${name}/${id}`, data }); },
      }),
      where: () => q,
      limit: () => q,
      get: async () => ({ empty: true, docs: [] }),
    };
    return q;
  };
  return { collection: col, updates };
}

/** Run a human-owned prescribed deploy to completion; the opener runs at the end. */
async function deploy({ agent, docs = {}, battle = goldenBattle() }) {
  const db = makeDb({ 'agentBattles/battle-1': battle, ...docs });
  const res = makeRes();
  const req = { body: { groupId: 'g1', prescribedPortfolio: [...SIX], isCpu: false, userPicksStance: [], doubleDownSymbols: [], userPicks: [] } };
  await runPrescribedTournamentDeploy({ db, req, res, agentRef: { update: vi.fn(async () => {}) }, agent, agentId: agent.id });
  expect(res.statusCode).toBe(200);
  expect(res.body.battleCreated).toBe(true);
  expect(mocks.callGemmaVoice).toHaveBeenCalledTimes(1);
  expect(state.firstMessageArgs).toHaveLength(1);
  const written = db.updates.find((u) => u.path === 'agentBattles/battle-1' && u.data.chatExchanges);
  return {
    prompt: mocks.callGemmaVoice.mock.calls[0][0].systemPrompt,
    args: state.firstMessageArgs[0],
    exchange: written?.data.chatExchanges.__arrayUnion,
    battle,
  };
}

/** The real builder's grounded assembly for a surface — what the lazy opener sends. */
function groundedAssembly(key, agent, battle) {
  return promptModule.buildFirstMessagePrompt({
    agent,
    battle,
    ...SURFACES[key].args(),
    currentPhase: promptModule.getAgentPhase(agent.stats.gamesPlayed),
    supportedTerms: SUPPORTED_TERMS,
    executionMode: 'autopilot',
    grounded: true,
  });
}

const walk = ({ mode, canaryUids = '' }) => { state.mode = mode; state.canaryUids = canaryUids; };

// The flag states in which the deploy path must send the SHIPPED bytes …
const DARK = [
  ["'off'", { mode: 'off' }],
  ["'shadow' (the live value)", { mode: 'shadow' }],
  ["'canary', owner not on the allowlist", { mode: 'canary', canaryUids: 'someone-else,another-uid' }],
  ["'canary', empty allowlist", { mode: 'canary', canaryUids: '' }],
];
// … and the ones in which it must send the grounded prompt.
const LIVE = [
  ["'on'", { mode: 'on' }],
  ["'canary', owner on the allowlist", { mode: 'canary', canaryUids: ` someone-else , ${CANARY_UID} ` }],
];

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
});
afterAll(() => { vi.useRealTimers(); });

beforeEach(() => {
  walk({ mode: 'off' });
  state.calls = [];
  state.firstMessageArgs = [];
  mocks.getStockAnalysisData.mockReset().mockResolvedValue(VALID_PRICE);
  mocks.createAgentBattle.mockReset().mockResolvedValue({ id: 'battle-1', expiresAt: '2026-09-09T00:00:00.000Z' });
  mocks.ensureDeployableCompiledBuild.mockReset().mockResolvedValue({ proceed: true, compiledBuild: null });
  mocks.callGemmaVoice.mockReset().mockResolvedValue('{"response":"Agent is live."}');
  mocks.parseVoiceLayerResponse.mockReset().mockReturnValue({ response: 'Agent is live.', _scratchpad: null });
  mocks.logDecision.mockClear();
  mocks.logFirstMessage.mockClear();
});

describe('the golden file holds the two first-message surfaces this file reproduces', () => {
  it.each(Object.keys(SURFACES))('%s is a captured, non-empty string', (key) => {
    expect(typeof GOLDENS[key]).toBe('string');
    expect(GOLDENS[key].length).toBeGreaterThan(0);
  });

  it('the fixture list the golden was captured with is the one standing in for TERM_TOKENS', async () => {
    const { TERM_TOKENS } = await import('../_utils/termUniverse.js');
    expect(TERM_TOKENS).toBe(SUPPORTED_TERMS);
  });
});

describe("the deploy-time opener — 'off', 'shadow' and a non-canary owner send the shipped bytes (the golden)", () => {
  for (const key of Object.keys(SURFACES)) {
    it.each(DARK)(`${key} under %s — byte-identical to the pre-grounding capture, the builder asked for grounded: false`, async (_label, flag) => {
      walk(flag);
      const { prompt, args } = await deploy({ agent: SURFACES[key].agent(), docs: SURFACES[key].docs() });
      expect(args.grounded).toBe(false);
      expect(prompt).toBe(GOLDENS[key]);
    });
  }

  it('the dark bytes carry none of the grounded contract, even though the accessor was consulted', async () => {
    walk({ mode: 'shadow' });
    const { prompt } = await deploy({ agent: SURFACES['firstMessage.mastery.cache'].agent(), docs: SURFACES['firstMessage.mastery.cache'].docs() });
    expect(state.calls).toEqual([CANARY_UID]);
    // The shipped identity sentence (voiceLayerPrompt.js:3255) — absent from
    // the grounded identity (:3250).
    expect(prompt).toContain('a competitive fantasy trading agent on FantasyTrades');
    expect(prompt).not.toContain('Your trades are decided by your trading process');
    expect(prompt).not.toContain('CURRENT CONTEXT');
  });
});

describe("the deploy-time opener — 'on' and an allowlisted canary owner: the grounded option reaches the fenced call", () => {
  for (const key of Object.keys(SURFACES)) {
    it.each(LIVE)(`${key} under %s — the builder is asked for grounded: true, and Gemma receives the lazy opener's grounded assembly`, async (_label, flag) => {
      walk(flag);
      const agent = SURFACES[key].agent();
      const { prompt, args, battle } = await deploy({ agent, docs: SURFACES[key].docs() });
      expect(args.grounded).toBe(true);
      expect(state.calls).toEqual([CANARY_UID]);
      // The same prompt the lazy opener sends: the real builder, grounded.
      expect(prompt).toBe(groundedAssembly(key, agent, battle));
      // …and not the shipped bytes.
      expect(prompt).not.toBe(GOLDENS[key]);
      expect(prompt).toContain('Your trades are decided by your trading process');
      expect(prompt).not.toContain('a competitive fantasy trading agent on FantasyTrades');
    });
  }

  it("the gate resolves the BATTLE doc's owner (D-101), not the agent record's — asked once, with that uid", async () => {
    // The agent's owner is NOT on the allowlist; the battle doc's owner is. Only
    // a read of battle.ownerId grounds this opener.
    walk({ mode: 'canary', canaryUids: 'battle-owner-uid' });
    const agent = makeAgent();
    expect(agent.ownerId).toBe(CANARY_UID);
    const { args } = await deploy({ agent, docs: SURFACES['firstMessage.discovery.noCache'].docs(), battle: goldenBattle({ ownerId: 'battle-owner-uid' }) });
    expect(state.calls).toEqual(['battle-owner-uid']);
    expect(args.grounded).toBe(true);
  });
});

describe('what the one-key fence contact did not change', () => {
  it('the call site passes exactly the shipped arguments plus the one key', async () => {
    walk({ mode: 'on' });
    const { args } = await deploy({ agent: makeAgent(), docs: SURFACES['firstMessage.discovery.noCache'].docs() });
    expect(Object.keys(args).sort()).toEqual([
      'agent', 'anchorContext', 'battle', 'currentPhase', 'executionMode', 'grounded', 'marketSnapshot', 'supportedTerms',
    ]);
    expect(args.supportedTerms).toBe(SUPPORTED_TERMS);
    expect(args.executionMode).toBe('autopilot');
    expect(args.currentPhase).toBe(promptModule.getAgentPhase(4));
  });

  it.each([...DARK, ...LIVE])('under %s the persisted exchange is the shipped shape — first_message, no groundingVersion marker (D-102 ruling 4)', async (_label, flag) => {
    walk(flag);
    const { exchange } = await deploy({ agent: makeAgent(), docs: SURFACES['firstMessage.discovery.noCache'].docs() });
    expect(exchange).toBeTruthy();
    expect(exchange.messageType).toBe('first_message');
    expect(exchange.userMessage).toBeNull();
    expect(exchange.agentResponse).toBe('Agent is live.');
    expect('groundingVersion' in exchange).toBe(false);
    expect(Object.keys(exchange).sort()).toEqual([
      'agentResponse', 'directive', 'elicitationTarget', 'hasDirective', 'messageType', 'mode', 'scratchpad', 'suggestedActions', 'timestamp', 'userMessage',
    ]);
  });
});
