// api/fantasytimes/wirePayloadEquality.test.js
// FantasyTimes Wire — M8 payload equality at the ENDPOINT level (§9):
// with flags OFF the outbound anthropic.messages.create params are
// byte-identical to the pre-Wire build — the pristine tool singleton passes
// BY IDENTITY, the system string carries no Wire text, max_tokens is the
// pre-Wire number — and this holds in a WARM CONTAINER that has already run
// flag-on requests (clone-never-mutate). Metrics-on/writes-off changes
// nothing either. Two representative seams are exercised end-to-end:
// generate-pulse (handler) and generateAlexMoverStory (in-process function —
// the live scan-movers path). The remaining seams use the identical audited
// pattern (same helpers, same two conditional expressions).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFirestoreFake } from '../_utils/__fixtures__/wireFirestoreFake.js';

// ── mocks ────────────────────────────────────────────────────────────────
const captured = [];
vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor() {
      this.messages = {
        create: async (params) => {
          captured.push(params);
          return {
            stop_reason: 'tool_use',
            content: [{
              type: 'tool_use',
              input: {
                headline: 'H', subheadline: 'S', body: 'B',
                sentiment: 'neutral', themes: [], top_movers: [],
                recommended_action: 'RESEARCH',
                agentFacts: {
                  eventType: 'market_mover', tickers: ['NVDA'], direction: 'up',
                  magnitude: { value: 4.2, unit: 'pct', basis: 'price_vs_prior_close' },
                },
              },
            }],
          };
        },
      };
    }
  },
}));

const flagState = { metricsEnabled: false, writesEnabled: false, continuityEnabled: false };
vi.mock('../_utils/wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

let fakeDb;
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => fakeDb,
}));

vi.mock('../_utils/marketHolidayCheck.js', () => ({
  isMarketHolidayToday: () => false,
}));

vi.mock('../_utils/ingestedClaims.js', () => ({
  getClaimsForReporter: async () => [],
  formatClaimsForPrompt: () => '',
}));

// Partial mock: keep the REAL tool constants/system prompts (identity
// assertions depend on them); stub only the network-touching block builder.
vi.mock('../_utils/fantasyTimesPrompts.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getMarketContextBlock: async () => ({ block: '', data: null }) };
});

vi.mock('../_utils/fantasyTimesConsensus.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    buildConsensusBlock: async () => '',
    appendCatalyst: async () => {},
  };
});

vi.mock('../_utils/validatedCatalystCache.js', () => ({
  getValidatedCatalyst: async () => ({ catalyst: 'ctx', confidence: 'high', source: 'sonar' }),
  validateAndCacheCatalyst: async () => ({ catalyst: 'ctx', confidence: 'high', source: 'sonar' }),
}));
vi.mock('../_utils/sonarCatalystFetch.js', () => ({
  fetchTickerCatalysts: async () => ({ catalysts: 'ctx', headlines: [], raw: 'ctx', citations: [], fallback: true }),
}));

const { KAI_SYSTEM_PROMPT, ALEX_SYSTEM_PROMPT, PUBLISH_MARKET_PULSE_TOOL, PUBLISH_STORY_TOOL } =
  await import('../_utils/fantasyTimesPrompts.js');
const pulseHandler = (await import('./generate-pulse.js')).default;
const { generateAlexMoverStory } = await import('./generate-mover.js');

const PRISTINE_PULSE = JSON.parse(JSON.stringify(PUBLISH_MARKET_PULSE_TOOL));
const PRISTINE_STORY = JSON.parse(JSON.stringify(PUBLISH_STORY_TOOL));

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = () => res;
  return res;
}
const cronReq = (query) => ({ method: 'GET', headers: { 'x-vercel-cron': '1' }, query, body: {}, socket: {} });

async function runPulse() {
  const res = mockRes();
  await pulseHandler(cronReq({ period: 'midday' }), res);
  return res;
}

beforeEach(() => {
  fakeDb = createFirestoreFake();
  captured.length = 0;
  flagState.metricsEnabled = false;
  flagState.writesEnabled = false;
  flagState.continuityEnabled = false;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-24T18:00:00Z'));
  process.env.CLAUDE_API_KEY = 'test-key';
  process.env.EODHD_API_KEY = 'test-key';
  vi.stubGlobal('fetch', async () => ({ ok: false }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('generate-pulse (handler) — M8', () => {
  it('flags OFF: pristine tool BY IDENTITY, no wire text, pre-Wire max_tokens, no wire persistence', async () => {
    const res = await runPulse();
    expect(res.body?.success).toBe(true);
    expect(captured).toHaveLength(1);
    const params = captured[0];
    expect(params.tools[0]).toBe(PUBLISH_MARKET_PULSE_TOOL); // identity — byte-identical by construction
    expect(params.max_tokens).toBe(800);
    expect(params.system).toBe(KAI_SYSTEM_PROMPT); // optional blocks all '' in this rig
    expect(params.system).not.toContain('AGENT FACTS');
    expect(JSON.stringify(params)).not.toContain('agentFacts');

    const stored = Object.entries(fakeDb._dump()).find(([k]) => k.startsWith('fantasyTimesStories/'))[1];
    expect(stored.wirePending).toBeUndefined();
    expect(stored.wireValidation).toBeUndefined();
    expect(JSON.stringify(stored)).not.toContain('agentFacts');
  });

  it('metrics ON, writes OFF: payload unchanged (F2-5/§9)', async () => {
    flagState.metricsEnabled = true;
    await runPulse();
    const params = captured[0];
    expect(params.tools[0]).toBe(PUBLISH_MARKET_PULSE_TOOL);
    expect(params.max_tokens).toBe(800);
    expect(params.system).toBe(KAI_SYSTEM_PROMPT);
    // and the sample landed in the server-only sink
    expect(fakeDb._dump()['wireMetrics/2026-07-24']).toBeDefined();
  });

  it('writes ON: extended clone + instruction + raised max_tokens; story doc carries codes, never facts', async () => {
    flagState.writesEnabled = true;
    const res = await runPulse();
    expect(res.body?.success).toBe(true);
    const params = captured[0];
    expect(params.tools[0]).not.toBe(PUBLISH_MARKET_PULSE_TOOL);
    expect(params.tools[0].input_schema.properties.agentFacts).toBeDefined();
    expect(params.max_tokens).toBe(1200);
    expect(params.system).toContain('AGENT FACTS');

    const [storyPath, stored] = Object.entries(fakeDb._dump()).find(([k]) => k.startsWith('fantasyTimesStories/'));
    expect(stored.wireValidation).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain('agentFacts');
    // Kai rejects market_mover (R3) — outcome recorded as codes only
    expect(stored.wireValidation.outcome).toBe('rejected');
    expect(stored.wireValidation.codes).toContain('R3_EVENTTYPE');
    expect(stored.wirePending).toBe(false); // inline transaction + cleanup ran
    void storyPath;
  });

  it('WARM CONTAINER: a flag-on run does not contaminate the next flag-off run', async () => {
    flagState.writesEnabled = true;
    await runPulse();
    // Same warm module state, fresh db (the endpoint's own dedup would
    // otherwise short-circuit the second run — module state is the subject).
    fakeDb = createFirestoreFake();
    flagState.writesEnabled = false;
    await runPulse();
    const offParams = captured[1];
    expect(offParams.tools[0]).toBe(PUBLISH_MARKET_PULSE_TOOL);
    expect(JSON.parse(JSON.stringify(PUBLISH_MARKET_PULSE_TOOL))).toEqual(PRISTINE_PULSE);
    expect(offParams.max_tokens).toBe(800);
    expect(offParams.system).toBe(KAI_SYSTEM_PROMPT);
  });
});

describe('generateAlexMoverStory (in-process scan path) — M8', () => {
  const moverArgs = {
    symbol: 'NVDA', currentPrice: 150, priceChange: 6.1, percentChange: 4.2,
    atrMultiple: 1.5, direction: 'up', sector: 'Technology',
  };

  it('flags OFF: pristine PUBLISH_STORY_TOOL by identity; bare system prompt; 500 tokens', async () => {
    const result = await generateAlexMoverStory(moverArgs);
    expect(result.success).toBe(true);
    const params = captured[0];
    expect(params.tools[0]).toBe(PUBLISH_STORY_TOOL);
    expect(params.max_tokens).toBe(500);
    expect(params.system).toBe(ALEX_SYSTEM_PROMPT);
    expect(JSON.parse(JSON.stringify(PUBLISH_STORY_TOOL))).toEqual(PRISTINE_STORY);
  });

  it('writes ON: extension + wire artifacts; PASSED facts land as an entry with the digest', async () => {
    flagState.writesEnabled = true;
    const result = await generateAlexMoverStory(moverArgs);
    expect(result.success).toBe(true);
    const params = captured[0];
    expect(params.tools[0].input_schema.properties.agentFacts.properties.eventType.enum)
      .toEqual(['market_mover', 'gap_event']);
    expect(params.max_tokens).toBe(900);

    const day = fakeDb._dump()['fantasyTimesWire/2026-07-24'];
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0].agentFacts.digest).toBe('NVDA move: +4.2% vs prior close.');
    expect(day.validationStats.passed).toBe(1);
    // original constant untouched after the flag-on run
    expect(JSON.parse(JSON.stringify(PUBLISH_STORY_TOOL))).toEqual(PRISTINE_STORY);
  });
});
