// api/cron/agent-evaluate.limitsOnRecord.test.js
//
// Capacity Build 1, Part 4 — THE LIMITS ON RECORD, end to end
// (docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md). The real handler, the real
// processAgentBattle and the REAL marketDataCache run; only the network (one
// global fetch for EODHD and Anthropic) and Firestore are doubles.
//
// The SDK double is shaped like @anthropic-ai/sdk 0.71.2 at this seam: it
// calls the `fetch` it was constructed with (the capture's observing fetch
// when TICK_CAPTURE_ENABLED is on, the global one when off), returns a
// promise of the parsed message that also answers `asResponse()` with the raw
// Response, and rejects a non-2xx with an error carrying `status` and
// `headers`. Each flag value gets a fresh module graph (the client memoizes).
//
//   · the run record's `anthropic` block carries the headers' limits and the
//     minimum remaining — with tick capture ON and OFF alike;
//   · a 429 is counted, its headers still read, the check's own failure class
//     unchanged;
//   · the `eodhd` block counts this run's requests by endpoint (eod, realTime,
//     intraday) and its non-2xx by class.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makeRankingsDoc, makeTechDocs, makeHoldResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';

const flags = vi.hoisted(() => ({ capture: false }));
const net = vi.hoisted(() => ({ anthropicStatus: 200, anthropicHeaders: {}, eodhd: [], anthropic: 0, eodStatus: {} }));
const world = vi.hoisted(() => ({ db: null, battles: null }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicSdkDouble {
    constructor(options) {
      net.ctorFetch = typeof options.fetch;
      this.messages = {
        create: (body, requestOptions) => {
          const fetchImpl = options.fetch || globalThis.fetch;
          const responsePromise = Promise.resolve(fetchImpl('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: requestOptions?.signal,
          })).then((response) => {
            if (response.status >= 400) {
              const err = new Error(`${response.status} rate limited`);
              err.status = response.status;
              err.headers = response.headers;
              throw err;
            }
            return response;
          });
          const parsed = responsePromise.then((r) => r.json());
          parsed.asResponse = () => responsePromise;
          return parsed;
        },
      };
    }
  },
}));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: () => ({}), cert: () => ({}) }));
vi.mock('firebase-admin/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  getFirestore: () => ({ collection: () => ({ doc: () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => undefined }) }) }) }),
}));
vi.mock('../_utils/marketSchedule.js', async (importOriginal) => ({ ...(await importOriginal()), isMarketOpen: () => true }));
vi.mock('../_utils/agentBattleService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  findActiveAgentBattles: vi.fn(async () => world.battles.map(deepClone)),
}));
vi.mock('../_utils/canonicalOpenSweep.js', () => ({ runCanonicalOpenSweep: vi.fn(async () => ({ skipped: true })) }));
vi.mock('../_utils/masterySettlement.js', async (importOriginal) => ({ ...(await importOriginal()), runRepairSweep: vi.fn(async () => ({ scanned: 0 })) }));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => world.db }));
vi.mock('../_utils/battlePatternLogger.js', () => ({ logBattlePattern: vi.fn(async () => {}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false),
}));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}), resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'), classifyEvidence: vi.fn(() => 'live_agent'),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get TICK_CAPTURE_ENABLED() { return flags.capture; },
}));

const LIMITS = {
  'anthropic-ratelimit-requests-limit': '50',
  'anthropic-ratelimit-requests-remaining': '49',
  'anthropic-ratelimit-input-tokens-limit': '50000',
  'anthropic-ratelimit-input-tokens-remaining': '33000',
  'anthropic-ratelimit-output-tokens-limit': '10000',
  'anthropic-ratelimit-output-tokens-remaining': '9000',
};

/** EODHD and Anthropic behind one fetch. EODHD: a quote and 90 days of bars for anything; `eodStatus[sym]` forces a status. */
function installNetwork() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith('https://api.anthropic.com/')) {
      net.anthropic += 1;
      const body = net.anthropicStatus === 200
        ? JSON.stringify({ ...makeToolUseResponse(makeHoldResult()), model: 'claude-haiku-4-5-20251001' })
        : JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } });
      return new Response(body, { status: net.anthropicStatus, headers: { 'content-type': 'application/json', ...net.anthropicHeaders } });
    }
    const m = /eodhd\.com\/api\/(eod|real-time|intraday)\/([^?]+)/.exec(u);
    if (!m) throw new Error(`unexpected request ${u}`);
    const [, endpoint, sym] = m;
    net.eodhd.push(endpoint);
    if (net.eodStatus[sym]) return new Response('{}', { status: net.eodStatus[sym] });
    if (endpoint === 'real-time') return new Response(JSON.stringify({ close: 100, previousClose: 99, change: 1, change_p: 1, high: 101, low: 98, volume: 5, timestamp: 1 }), { status: 200 });
    if (endpoint === 'intraday') return new Response('[]', { status: 200 });
    return new Response(JSON.stringify([{ date: '2026-09-08', open: 99, high: 100, low: 98, close: 99, adjusted_close: 99, volume: 5 }]), { status: 200 });
  };
}

function makeRunDb(battles) {
  const docs = new Map(battles.map((b) => [b.id, deepClone(b)]));
  const runDocs = [];
  const updates = [];
  const shared = {
    'indexIntelligence/stockRankings': makeRankingsDoc(),
    ...Object.fromEntries(Object.entries(makeTechDocs()).map(([s, d]) => [`stockTechnicalScores/${s}`, d])),
  };
  const snap = (id, data) => ({ exists: data != null, id, data: () => (data == null ? undefined : deepClone(data)) });
  const emptyQuery = { where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery, startAfter: () => emptyQuery, get: async () => ({ docs: [], empty: true, size: 0 }) };
  const generic = (col, id) => ({
    id, path: `${col}/${id}`,
    get: async () => snap(id, shared[`${col}/${id}`] ?? null),
    set: async () => {}, update: async () => {}, create: async () => {},
    collection: (sub) => ({ doc: (subId) => generic(`${col}/${id}/${sub}`, subId) }),
  });
  const battle = (id) => ({
    id, path: `agentBattles/${id}`,
    get: async () => snap(id, docs.get(id) ?? null),
    update: async (payload) => { updates.push({ id, payload: deepClone(payload) }); },
    collection: (sub) => ({ doc: (subId) => generic(`agentBattles/${id}/${sub}`, subId) }),
  });
  return {
    collection(col) {
      return {
        doc: (id) => (col === 'agentBattles' ? battle(id) : col === 'agentEvalRuns' ? { id, set: async (data) => { runDocs.push(deepClone(data)); } } : generic(col, id)),
        where: () => emptyQuery, orderBy: () => emptyQuery, limit: () => emptyQuery, get: async () => ({ docs: [], empty: true, size: 0 }),
      };
    },
    getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
    runTransaction: async (cb) => cb({ get: (ref) => ref.get(), update: (ref, payload) => updates.push({ id: ref.id, payload: deepClone(payload) }), set: () => {}, create: () => {} }),
    batch: () => ({ set: () => {}, update: () => {}, create: () => {}, commit: async () => {} }),
    __runDocs: runDocs, __updates: updates,
  };
}

async function runOnce({ capture }) {
  flags.capture = capture;
  vi.resetModules();
  const { default: handler } = await import('./agent-evaluate.js');
  const battle = makeTickBattle();
  world.battles = [battle];
  world.db = makeRunDb([battle]);
  const res = { status() { return res; }, json(p) { res.payload = p; return res; } };
  await handler({ headers: { 'x-vercel-cron': '1' } }, res);
  return { run: world.db.__runDocs[0], db: world.db, res };
}

const realFetch = globalThis.fetch;
let savedKey;
// Each row re-imports the handler in a fresh module graph (the client memoizes per
// graph). The first import transforms the whole graph — seconds on a cold cache —
// so it is paid once here, outside any row's clock.
beforeAll(async () => { await import('./agent-evaluate.js'); }, 120_000);
vi.setConfig({ testTimeout: 30_000 });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  net.anthropicStatus = 200; net.anthropicHeaders = { ...LIMITS }; net.eodhd = []; net.anthropic = 0; net.eodStatus = {};
  savedKey = process.env.EODHD_API_KEY;
  process.env.EODHD_API_KEY = 'test-key';
  installNetwork();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = savedKey;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the run record\'s `anthropic` block — tick capture on and off', () => {
  for (const capture of [false, true]) {
    it(`capture ${capture ? 'ON' : 'OFF'}: the limits and the minimum remaining from this run's model call`, async () => {
      const { run } = await runOnce({ capture });
      expect(net.anthropic).toBe(1); // anti-vacuous: the check called the model
      // the client was built with the capture's observing fetch exactly when capture is on
      expect(net.ctorFetch).toBe(capture ? 'function' : 'undefined');
      expect(run.modelCalls).toBe(1);
      expect(run.anthropic).toEqual({
        requestsLimit: 50, inputTokensLimit: 50000, outputTokensLimit: 10000,
        minRequestsRemaining: 49, minInputTokensRemaining: 33000, minOutputTokensRemaining: 9000, responses429: 0,
      });
    });
  }

  it('no headers on the response → every value null (the record never guesses)', async () => {
    net.anthropicHeaders = {};
    const { run } = await runOnce({ capture: false });
    expect(run.anthropic).toEqual({
      requestsLimit: null, inputTokensLimit: null, outputTokensLimit: null,
      minRequestsRemaining: null, minInputTokensRemaining: null, minOutputTokensRemaining: null, responses429: 0,
    });
  });

  it('a 429: counted, its headers still read, the check\'s failure class unchanged ("429")', async () => {
    net.anthropicStatus = 429;
    net.anthropicHeaders = { ...LIMITS, 'anthropic-ratelimit-requests-remaining': '0' };
    const { run, db } = await runOnce({ capture: false });
    expect(run.anthropic).toMatchObject({ responses429: 1, minRequestsRemaining: 0, requestsLimit: 50 });
    const entry = db.__updates.find((u) => Array.isArray(u.payload.evaluations))?.payload.evaluations.at(-1);
    expect(entry?.haikuError?.failureClass).toBe('429');
  });
});

describe('the run record\'s `eodhd` block — this run\'s requests by endpoint', () => {
  it('eod / realTime / intraday equal the requests the network saw; other 0; no timeouts', async () => {
    const { run } = await runOnce({ capture: false });
    const seen = (e) => net.eodhd.filter((x) => x === e).length;
    expect(seen('eod')).toBeGreaterThan(5); // anti-vacuous
    expect(seen('intraday')).toBeGreaterThan(0);
    expect(run.eodhd).toEqual({
      requests: { eod: seen('eod'), realTime: seen('real-time'), intraday: seen('intraday'), other: 0 },
      timeouts: 0,
      non2xx: { 429: 0, '5xx': 0, other: 0 },
    });
  });

  it('non-2xx answers are counted by class', async () => {
    net.eodStatus = { 'NVDA.US': 429, 'TSLA.US': 503, 'MSFT.US': 404 };
    const { run } = await runOnce({ capture: false });
    // each of those symbols answers its /eod/ and /real-time/ (and NVDA its /intraday/) with that status
    expect(run.eodhd.non2xx[429]).toBeGreaterThanOrEqual(2);
    expect(run.eodhd.non2xx['5xx']).toBe(2);
    expect(run.eodhd.non2xx.other).toBe(2);
  });

  it('a second run counts only its own requests (a difference, not the process total)', async () => {
    const first = await runOnce({ capture: false });
    net.eodhd = [];
    const { default: handler } = await import('./agent-evaluate.js'); // same module graph as `first`
    world.battles = [makeTickBattle()];
    world.db = makeRunDb(world.battles);
    const res = { status() { return res; }, json() { return res; } };
    await handler({ headers: { 'x-vercel-cron': '1' } }, res);
    const second = world.db.__runDocs[0];
    expect(second.eodhd.requests.eod).toBe(net.eodhd.filter((x) => x === 'eod').length);
    expect(second.eodhd.requests.eod).toBe(first.run.eodhd.requests.eod);
  });
});
