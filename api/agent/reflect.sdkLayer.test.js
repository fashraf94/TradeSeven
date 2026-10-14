// api/agent/reflect.sdkLayer.test.js
//
// Reflection outage fix, part 2 (P-OUT-2, ruling O7; reviews WR-5 and WR-8) —
// the account-wide classification THROUGH THE REAL SDK: no SDK mock. Only
// globalThis.fetch is stubbed (nothing leaves the machine), so the SDK's own
// retries, backoff and error construction run exactly as in production. If an
// SDK upgrade changed the backoff or the error shape this classification rests
// on, a row here turns red.
//
// The responses are the ones Anthropic documents (platform.claude.com/docs/en/
// api/errors and /api/rate-limits, read 14 Oct 2026): the tier spend cap is a
// 429 with error.details.error_code 'enforced_spend_limit_reached' and NO
// retry-after header; a spend limit the organisation set is a 400
// invalid_request_error, which the SDK never retries.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const http = vi.hoisted(() => ({ respond: null, fetches: [] }));
vi.stubGlobal('fetch', async (url, init) => { http.fetches.push({ url: String(url), at: Date.now() }); return http.respond(url, init); });
process.env.CLAUDE_API_KEY = 'sk-test-not-a-real-key';

vi.mock('../_utils/shadowLogger.js', () => ({ logReflection: async () => true, logConsolidation: async () => true }));
vi.mock('../_utils/agentConsolidationApply.js', () => ({ consolidateAgentEvolution: async () => ({ success: true }) }));

const { generateReflection } = await import('./reflect.js');

const jsonResponse = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const SPEND_CAP_429 = { type: 'error', error: { type: 'rate_limit_error', message: 'You have reached your API usage limits: your organization has crossed its monthly API usage threshold, set based on your organization\'s API tier.', details: { error_code: 'enforced_spend_limit_reached' } }, request_id: 'req_test' };
const ORG_LIMIT_400 = { type: 'error', error: { type: 'invalid_request_error', message: 'You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.' }, request_id: 'req_test' };
const OVERLOADED_529 = { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' }, request_id: 'req_test' };

function makeDb(seed) {
  const store = new Map(Object.entries(seed).map(([p, d]) => [p, structuredClone(d)]));
  const writes = [];
  const refOf = (path) => ({
    path,
    id: path.split('/').pop(),
    async get() { const has = store.has(path); return { exists: has, id: path.split('/').pop(), data: () => (has ? structuredClone(store.get(path)) : undefined) }; },
    async update(patch) { writes.push({ path, patch: structuredClone(patch) }); store.set(path, { ...store.get(path), ...structuredClone(patch) }); },
  });
  return { db: { collection: (c) => ({ doc: (id) => refOf(`${c}/${id}`) }), runTransaction: async () => { throw new Error('not used'); } }, store, writes };
}
const seed = () => makeDb({
  'agentBattles/b1': {
    status: 'completed', agentId: 'a1', ownerId: 'o1', gameMode: 'baggerbomb_tournament',
    completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // within the 7-day backstop
    scoreState: { currentScore: 7, opponentScore: 0 }, evaluations: [], trades: [], statusFeed: [], chatExchanges: [],
  },
  'agents/a1': { name: 'Nova', archetype: 'analyst', ownerId: 'o1', stats: { gamesPlayed: 2 }, memory: [] },
});

beforeEach(() => {
  http.fetches.length = 0;
  http.respond = null;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.spyOn(Math, 'random').mockReturnValue(0); // the SDK's backoff jitter at its widest
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function run(attempt) {
  const { db, writes } = seed();
  const pending = generateReflection(db, 'b1', { attempt });
  await vi.advanceTimersByTimeAsync(10_000); // far below the 35 s deadline
  return { result: await pending, writes };
}

describe('the real SDK on the documented refusals (O7)', () => {
  it('the tier spend cap (429, no retry-after): the SDK retries twice within ~1.5 s, then it is http_429, account-wide, NOT counted — even at attempt 3, and nothing is written', async () => {
    http.respond = () => jsonResponse(429, SPEND_CAP_429);
    const { result, writes } = await run(3);
    expect(http.fetches).toHaveLength(3);
    expect(http.fetches.every((f) => f.url === 'https://api.anthropic.com/v1/messages')).toBe(true);
    expect(result).toMatchObject({ outcome: 'failed', counted: false, record: { failureClass: 'http_429', accountWide: true, errorName: 'RateLimitError', attempt: 3 } });
    expect(result.record.elapsedMs).toBeLessThan(5_000);
    expect(result).not.toHaveProperty('deferToRecovery');
    expect(writes).toEqual([]);
  });

  it('a spend limit the organisation set (400): one fetch, never retried, http_400, account-wide, not counted', async () => {
    http.respond = () => jsonResponse(400, ORG_LIMIT_400);
    const { result, writes } = await run(3);
    expect(http.fetches).toHaveLength(1);
    expect(result).toMatchObject({ counted: false, record: { failureClass: 'http_400', accountWide: true, errorName: 'BadRequestError' } });
    expect(writes).toEqual([]);
  });

  it('an ordinary 529 is retried by the SDK and then COUNTS: at attempt 3 the game finishes with its no-lesson marker', async () => {
    http.respond = () => jsonResponse(529, OVERLOADED_529);
    const { result, writes } = await run(3);
    expect(http.fetches).toHaveLength(3);
    expect(result).toMatchObject({ counted: true, record: { failureClass: 'http_529', accountWide: false, errorName: 'InternalServerError' } });
    expect(writes).toHaveLength(1);
    expect(writes[0].patch.memory.at(-1)).toMatchObject({ gameId: 'b1', noLesson: true, lesson: '' });
  });
});
