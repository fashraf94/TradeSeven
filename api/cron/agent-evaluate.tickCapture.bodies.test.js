// api/cron/agent-evaluate.tickCapture.bodies.test.js
//
// Stage B, END TO END: the real cron, the real observer, a doubled SDK that
// actually calls the `fetch` it was constructed with and reads its own
// response body — the shape `client.js` uses (`this.fetch.call(undefined, url,
// fetchOptions)` → `response.json()`).
//
// The rows here are the ones only an end-to-end run can prove:
//   · the record carries the outgoing body as dispatched and the incoming body
//     before parsing, each with its SHA-256, plus status and returned model;
//   · the SDK still parses its own response — the observer read a CLONE;
//   · auth headers never reach either document;
//   · a non-2xx and a malformed body are captured, and the tick's own
//     failureClass is unchanged by the capture;
//   · an oversize body is truncated, marked, and keeps the WHOLE body's digest
//     (so it is captured but is NOT a usable pair);
//   · a failed copy is recorded `copy_failed`, never reconstructed.
//
// The flag is mocked TRUE for the whole file because `getAnthropicClient()`
// memoizes: the client is constructed once per module instance, so a file that
// flips mid-run would exercise one client under two flag values. The flag-OFF
// construction is asserted in agent-evaluate.tickCapture.flagOff.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCaptureDb, permanentDoc, bodyDoc, containsText } from '../_utils/__fixtures__/tickCaptureHarness.js';
import { sha256Hex, utf8Length } from '../_utils/tickCapture/captureWriter.js';
import { TICK_CAPTURE_TEXT_FIELD_MAX_BYTES } from '../_utils/tickCapture/captureConfig.js';

const API_KEY_SENTINEL = 'sk-ZZQX-AUTH-HEADER-SENTINEL-4417';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn() }));
/** What the transport under the observer returns, and what the SDK double saw. */
const http = vi.hoisted(() => ({ status: 200, body: '', throwError: null, sdkParsed: null, clientOptions: [] }));
const { swapMock } = vi.hoisted(() => ({ swapMock: vi.fn() }));

// The SDK double: it does exactly what client.js does at the seam this build
// observes — calls the constructed `fetch`, then reads its OWN response body.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor(options) {
      http.clientOptions.push(options);
      this.messages = {
        create: async (body) => {
          const fetchImpl = options.fetch || globalThis.fetch;
          const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': API_KEY_SENTINEL, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
            body: JSON.stringify(body),
          });
          const text = await response.text();   // the SDK's own read of its own stream
          http.sdkParsed = text;
          if (response.status >= 400) {
            const err = new Error(`${response.status} ${text}`);
            err.status = response.status;
            throw err;
          }
          return JSON.parse(text);
        },
      };
    }
  },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => ({ ...(await importOriginal()), executeSwapServer: swapMock }));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}), resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'), classifyEvidence: vi.fn(() => 'live_agent'),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), TICK_CAPTURE_ENABLED: true }));

const { processAgentBattle } = await import('./agent-evaluate.js');

const BATTLE_ID = 'battle-tick-1';
const realFetch = globalThis.fetch;

/** The transport the observer wraps. Controlled by `http`. */
function installTransport() {
  globalThis.fetch = async () => {
    if (http.throwError) throw http.throwError;
    return new Response(http.body, { status: http.status, headers: { 'content-type': 'application/json' } });
  };
}

async function runTick({ result = makeHoldResult(), status = 200, body = null, throwError = null } = {}) {
  http.status = status;
  http.throwError = throwError;
  http.sdkParsed = null;
  http.body = body ?? JSON.stringify({ ...makeToolUseResponse(result), model: 'claude-haiku-4-5-20251001' });
  mocks.getStockAnalysisData.mockImplementation(async (s) => (makePriceTable()[s] ? { price: makePriceTable()[s], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  const battle = makeTickBattle();
  const db = makeCaptureDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const seq = db.__updates[0]?.['cronState.tickSeq'] ?? 1;
  return {
    db, summary,
    permanent: permanentDoc(db, BATTLE_ID, `${BATTLE_ID}:${seq}`),
    body: bodyDoc(db, BATTLE_ID, `${BATTLE_ID}:${seq}`),
    entry: (db.__updates.find((u) => Array.isArray(u.evaluations))?.evaluations ?? []).at(-1) ?? null,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  swapMock.mockReset();
  installTransport();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); globalThis.fetch = realFetch; });

describe('the client carries the observer, and only the observer', () => {
  it('FLAG OFF the option is not there at all — the construction is today\'s, verbatim', () => {
    // A source row, deliberately: `getAnthropicClient()` memoizes, so a single
    // module instance cannot construct the client twice under two flag values.
    // What must hold is that the option is SPREAD UNDER THE FLAG and nothing
    // else about the construction moved.
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'agent-evaluate.js'), 'utf8');
    expect(src).toContain('...(TICK_CAPTURE_ENABLED ? { fetch: makeObservingFetch() } : {}),');
    expect(src.split('makeObservingFetch()').length - 1).toBe(1);
    const ctor = src.slice(src.indexOf('anthropicClient = new Anthropic({'), src.indexOf('return anthropicClient;'));
    expect(ctor).toContain('apiKey: process.env.CLAUDE_API_KEY,');
    expect(ctor).toContain('maxRetries: 0,');
    // …and nothing else was added to it
    expect(ctor.match(/^\s{6}\w+:/gm)).toEqual(['      apiKey:', '      maxRetries:']);
  });

  it('flag ON constructs the client with a `fetch` and today\'s other options unchanged', async () => {
    await runTick({});
    const options = http.clientOptions.at(-1);
    expect(typeof options.fetch).toBe('function');
    expect(options.maxRetries).toBe(0);
    expect(Object.keys(options).sort()).toEqual(['apiKey', 'fetch', 'maxRetries']);
  });
});

describe('a successful call — both bodies, their digests, the status and the returned model', () => {
  it('records the OUTGOING body as dispatched, with its SHA-256', async () => {
    const { permanent, body } = await runTick({});
    expect(typeof body.request.body).toBe('string');
    const sent = JSON.parse(body.request.body);
    // it IS the request: the forced tool choice and the three messages
    expect(sent.tool_choice).toEqual({ type: 'tool', name: 'submit_trade_decision' });
    expect(sent.messages).toHaveLength(3);
    expect(sent.tools[0].name).toBe('submit_trade_decision');
    expect(permanent.body.requestSha256).toBe(sha256Hex(body.request.body));
    expect(permanent.body.requestBytes).toBe(utf8Length(body.request.body));
  });

  it('records the INCOMING body before parsing, and the SDK still parsed its own copy', async () => {
    const { permanent, body } = await runTick({});
    expect(body.response.body).toBe(http.body);
    expect(http.sdkParsed).toBe(http.body);            // the SDK read its own stream
    expect(permanent.body.responseSha256).toBe(sha256Hex(http.body));
    expect(permanent.callEnvelope.httpStatus).toBe(200);
    expect(permanent.callEnvelope.returnedModel).toBe('claude-haiku-4-5-20251001');
    expect(permanent.body.status).toBe('written');
    expect(permanent.body.incomplete).toBeNull();
  });

  it('the AUTH HEADER reaches NEITHER document', async () => {
    const { permanent, body } = await runTick({});
    expect(containsText(permanent, API_KEY_SENTINEL)).toBe(false);
    expect(containsText(body, API_KEY_SENTINEL)).toBe(false);
  });

  it('the envelope names the requested model, the ceiling and the temperature', async () => {
    const { permanent } = await runTick({});
    expect(permanent.callEnvelope.requestedModel).toBeTruthy();
    expect(permanent.callEnvelope.temperature).toBe(0.4);
    expect(permanent.callEnvelope.maxOutputTokens).toBeGreaterThan(0);
    expect(permanent.callEnvelope.callMs).toBe(0);     // frozen clock
    expect(permanent.model.dispatched).toBe(true);
  });
});

describe('non-2xx, malformed and oversize bodies', () => {
  it('a 429 body is captured with its status, and the tick\'s own failureClass is unchanged', async () => {
    const { permanent, body, entry } = await runTick({ status: 429, body: '{"type":"error","error":{"type":"rate_limit_error"}}' });
    expect(body.response.body).toContain('rate_limit_error');
    expect(permanent.callEnvelope.httpStatus).toBe(429);
    expect(permanent.body.status).toBe('written');
    // the SHIPPED failure classification is untouched by capture
    expect(entry.haikuError.failureClass).toBe('429');
    expect(permanent.model.failureClass).toBe('429');
    expect(permanent.model.outcome).toBe('failed');
  });

  it('a MALFORMED 200 body is captured whole; the tick records its own truncated_response', async () => {
    const { permanent, body, entry } = await runTick({ body: '{"content":[{"type":"tool_use"' });
    expect(body.response.body).toBe('{"content":[{"type":"tool_use"');
    expect(permanent.body.responseSha256).toBe(sha256Hex('{"content":[{"type":"tool_use"'));
    expect(permanent.callEnvelope.returnedModel).toBeNull();
    // the SDK threw on JSON.parse → the shipped classifier owns the class
    expect(entry.haikuError.failureClass).toBe('SyntaxError');
    expect(permanent.model.failureClass).toBe('SyntaxError');
  });

  it('an OVERSIZE body is captured but TRUNCATED — and keeps the WHOLE body\'s digest', async () => {
    const filler = 'y'.repeat(TICK_CAPTURE_TEXT_FIELD_MAX_BYTES);
    const huge = JSON.stringify({ ...makeToolUseResponse(makeHoldResult({ rationale: filler })), model: 'claude-haiku-4-5-20251001' });
    const { permanent, body } = await runTick({ body: huge });
    expect(utf8Length(huge)).toBeGreaterThan(TICK_CAPTURE_TEXT_FIELD_MAX_BYTES);
    expect(body.response.truncated).toBe(true);
    expect(utf8Length(body.response.body)).toBe(TICK_CAPTURE_TEXT_FIELD_MAX_BYTES);
    expect(permanent.body.responseSha256).toBe(sha256Hex(huge));
    expect(permanent.body.responseBytes).toBe(utf8Length(huge));
    // CAPTURED, but not a usable pair (C-1) — the status says so out loud
    expect(permanent.body.status).toBe('truncated');
    expect(permanent.body.incomplete).toBe('response_truncated');
  });

  it('a transport THROW: the request counts as dispatched, the body is `copy_failed`, nothing is reconstructed', async () => {
    const { permanent, body } = await runTick({ throwError: Object.assign(new Error('socket hang up'), { name: 'APIConnectionError' }) });
    expect(permanent.model.dispatched).toBe(true);
    expect(permanent.body.status).toBe('copy_failed');
    expect(permanent.body.incomplete).toBe('copy_failed');
    expect(body.response.body).toBeNull();
    expect(body.response.sha256).toBeNull();
    // the REQUEST half was still captured — it really was dispatched
    expect(typeof body.request.body).toBe('string');
    expect(permanent.body.requestSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
