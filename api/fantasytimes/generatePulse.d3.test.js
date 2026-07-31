// api/fantasytimes/generatePulse.d3.test.js
// D-3 regression (DRIFT_LEDGER D-3): the A2 remap overwrote correct
// model-emitted subjectRefs at Kai's index_move seam because
// storyDoc.primaryTicker is a "the market" proxy (SPY), not the event's
// subject. index_move is cardinality-0 — it has no primary ticker — so the
// seam now nulls the WIRE primaryTicker for it, and the remap never engages.
//
// End-to-end through the REAL publishStoryWithWire + validator (writes ON):
//   1. Dow-led pulse, storyData.primaryTicker=SPY, model emits subjectRef=DJI
//      → DJI SURVIVES (no S1_SUBJECT_REMAPPED, digest "DJI move: ...").
//   2. Faithful S&P pulse, primaryTicker=SPY, model emits SPX → SPX passes.
//   3. Control: the seam does NOT over-null — a ticker-bearing kai event keeps
//      its primaryTicker on the wire.
// The validator's remap mechanism itself (the "genuine single ticker still
// remaps" case) is unchanged and covered in wireValidator.test.js; an explicit
// non-SPY case is re-asserted here so this file documents the full contract.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFirestoreFake } from '../_utils/__fixtures__/wireFirestoreFake.js';
import { validateAgentFacts } from '../_utils/wireValidator.js';
import { WIRE_OUTCOMES, WIRE_CODES } from '../_utils/wireContracts.js';

// ── configurable Anthropic mock (per-test tool input) ──────────────────────
let toolInput = null;
const captured = [];
vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor() {
      this.messages = {
        create: async (params) => {
          captured.push(params);
          return { stop_reason: 'tool_use', content: [{ type: 'tool_use', input: toolInput }] };
        },
      };
    }
  },
}));

const flagState = { metricsEnabled: false, writesEnabled: true, continuityEnabled: false };
vi.mock('../_utils/wireFlags.js', () => ({ getWireFlags: () => ({ ...flagState }) }));

let fakeDb;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => fakeDb }));
vi.mock('../_utils/marketHolidayCheck.js', () => ({ isMarketHolidayToday: () => false }));
vi.mock('../_utils/ingestedClaims.js', () => ({
  getClaimsForReporter: async () => [],
  formatClaimsForPrompt: () => '',
}));
vi.mock('../_utils/fantasyTimesPrompts.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, getMarketContextBlock: async () => ({ block: '', data: null }) };
});
vi.mock('../_utils/fantasyTimesConsensus.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, buildConsensusBlock: async () => '', appendCatalyst: async () => {} };
});
vi.mock('../_utils/validatedCatalystCache.js', () => ({
  getValidatedCatalyst: async () => ({ catalyst: 'ctx', confidence: 'high', source: 'sonar' }),
  validateAndCacheCatalyst: async () => ({ catalyst: 'ctx', confidence: 'high', source: 'sonar' }),
}));
vi.mock('../_utils/sonarCatalystFetch.js', () => ({
  fetchTickerCatalysts: async () => ({ catalysts: 'ctx', headlines: [], raw: 'ctx', citations: [], fallback: true }),
}));

const pulseHandler = (await import('./generate-pulse.js')).default;

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

const baseStory = (primaryTicker, agentFacts) => ({
  headline: 'H', subheadline: 'S', body: 'B',
  sentiment: 'neutral', themes: [], top_movers: [], recommended_action: 'RESEARCH',
  primaryTicker,
  agentFacts,
});

const indexMoveFacts = (subjectRef) => ({
  eventType: 'index_move', tickers: [], direction: 'down',
  magnitude: { value: -1.2, unit: 'pct', basis: 'index_vs_prior_close' },
  subjectRef,
});

function storedStory() {
  return Object.entries(fakeDb._dump()).find(([k]) => k.startsWith('fantasyTimesStories/'))[1];
}
function wireEntries() {
  const day = Object.entries(fakeDb._dump()).find(([k]) => k.startsWith('fantasyTimesWire/'));
  return day ? day[1].entries : [];
}

beforeEach(() => {
  fakeDb = createFirestoreFake();
  captured.length = 0;
  toolInput = null;
  flagState.writesEnabled = true;
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

describe('D-3: index_move subjectRef survives Kai\'s market-proxy primaryTicker', () => {
  it('CASE 1 — Dow-led pulse, primaryTicker=SPY, model emits DJI → DJI survives, no remap', async () => {
    toolInput = baseStory('SPY', indexMoveFacts('DJI'));
    const res = await runPulse();
    expect(res.body?.success).toBe(true);

    const stored = storedStory();
    expect(stored.wireValidation.outcome).toBe('passed');
    // the bug would have been a SALVAGED outcome carrying S1_SUBJECT_REMAPPED
    expect(stored.wireValidation.codes).not.toContain(WIRE_CODES.S1_SUBJECT_REMAPPED);

    const entries = wireEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].agentFacts.subjectRef).toBe('DJI');
    expect(entries[0].agentFacts.digest).toContain('DJI move');
    expect(entries[0].agentFacts.digest).not.toContain('SPX');
    // cardinality-0: the wire primaryTicker is null, not the SPY proxy
    expect(entries[0].agentFacts.primaryTicker ?? null).toBeNull();
  });

  it('CASE 1b — Nasdaq-led pulse, primaryTicker=SPY, model emits NDX → NDX survives', async () => {
    toolInput = baseStory('SPY', indexMoveFacts('NDX'));
    await runPulse();
    const entries = wireEntries();
    expect(entries[0].agentFacts.subjectRef).toBe('NDX');
    expect(storedStory().wireValidation.codes).not.toContain(WIRE_CODES.S1_SUBJECT_REMAPPED);
  });

  it('CASE 2 — faithful S&P pulse, primaryTicker=SPY, model emits SPX → SPX passes (fix does not break it)', async () => {
    toolInput = baseStory('SPY', indexMoveFacts('SPX'));
    const res = await runPulse();
    expect(res.body?.success).toBe(true);
    const entries = wireEntries();
    expect(entries[0].agentFacts.subjectRef).toBe('SPX');
    expect(entries[0].agentFacts.digest).toContain('SPX move');
    expect(storedStory().wireValidation.outcome).toBe('passed');
  });

  it('CASE 3 — the validator remap is intact: a GENUINE single index-ETF primaryTicker still remaps', () => {
    // Not the seam — a direct validator call, proving the fix did not gut the
    // A2 mechanism. QQQ is unambiguously a real ticker (not a market proxy).
    const v = validateAgentFacts({
      rawAgentFacts: indexMoveFacts('SPX'), // model says SPX...
      reporter: 'kai', stopReason: 'tool_use',
      primaryTickerRaw: 'QQQ',              // ...but primaryTicker is genuinely QQQ
    });
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.codes).toContain(WIRE_CODES.S1_SUBJECT_REMAPPED);
    expect(v.facts.subjectRef).toBe('NDX'); // remapped QQQ->NDX
  });

  it('CONTROL — the seam does not over-null: a ticker-bearing kai event keeps its primaryTicker', async () => {
    toolInput = baseStory('NVDA', {
      eventType: 'technical_break', tickers: ['NVDA'], direction: 'up',
      magnitude: { value: 2.1, unit: 'pct', basis: 'price_vs_prior_close' },
      keyLevel: { price: 150, type: 'resistance' },
    });
    const res = await runPulse();
    expect(res.body?.success).toBe(true);
    const entries = wireEntries();
    expect(entries).toHaveLength(1);
    // primaryTicker preserved for a cardinality>=1 eventType
    expect(entries[0].agentFacts.primaryTicker).toBe('NVDA');
  });
});
