// api/_utils/eodhdDailyWindow.test.js
//
// ID-1 Build 1 — the one shared raw daily request, and the idea review card's
// compatibility with it. The card's existing suite (hypothesisRecords/review.test.js)
// is unchanged; these rows pin what moved: the URL it builds byte for byte, its one
// argument to fetch, a non-array success as `[]`, and today's messages. No network.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked imports of
// eodhdDailyWindow.js and review.js are the runtime guard for their import graphs.
// Never mock them.

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { fetchDailyPayload } from './eodhdDailyWindow.js';
import { computeReviewEvidence, fetchWindowDaily } from './hypothesisRecords/review.js';

const KEY = 'test-key-5ecret';
const WINDOW = { from: '2026-09-01', to: '2026-10-28' };
const ROW = { date: '2026-10-28', open: 10, high: 11, low: 9, close: 10.5, adjusted_close: 10.25, volume: 100 };
const okBody = (body) => ({ ok: true, status: 200, json: async () => body });

let saved;
beforeEach(() => { saved = process.env.EODHD_API_KEY; process.env.EODHD_API_KEY = KEY; });
afterEach(() => {
  vi.unstubAllGlobals();
  if (saved === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = saved;
});
const stub = (impl) => { const f = vi.fn(impl); vi.stubGlobal('fetch', f); return f; };
const failure = async (p) => { try { await p; } catch (e) { return e; } throw new Error('expected a rejection'); };

describe('fetchDailyPayload — the request', () => {
  it('builds the URL byte for byte, in the parameter order the card always sent, with the order it is told', async () => {
    const f = stub(async () => okBody([]));
    await fetchDailyPayload('NVDA', { ...WINDOW, order: 'd' });
    await fetchDailyPayload('NVDA', { ...WINDOW, order: 'a' });
    expect(f.mock.calls.map(([url]) => url)).toEqual([
      `https://eodhd.com/api/eod/NVDA.US?api_token=${KEY}&fmt=json&period=d&order=d&from=2026-09-01&to=2026-10-28`,
      `https://eodhd.com/api/eod/NVDA.US?api_token=${KEY}&fmt=json&period=d&order=a&from=2026-09-01&to=2026-10-28`,
    ]);
  });
  it('a dotted class share uses the provider\'s hyphen', async () => {
    const f = stub(async () => okBody([]));
    await fetchDailyPayload('BRK.B', { ...WINDOW, order: 'd' });
    expect(f.mock.calls[0][0]).toContain('/eod/BRK-B.US?');
  });
  it.each([[undefined], ['asc'], ['D'], ['']])('`order` is explicit: %s is refused before any call', async (order) => {
    const f = stub(async () => okBody([]));
    await expect(fetchDailyPayload('NVDA', { ...WINDOW, order })).rejects.toThrow(TypeError);
    expect(f).not.toHaveBeenCalled();
  });
  it('no timeout: exactly one argument to fetch', async () => {
    const f = stub(async () => okBody([]));
    await fetchDailyPayload('NVDA', { ...WINDOW, order: 'a' });
    expect(f.mock.calls[0]).toHaveLength(1);
  });
  it('a timeout: a signal goes with the request', async () => {
    const f = stub(async () => okBody([]));
    await fetchDailyPayload('NVDA', { ...WINDOW, order: 'd', timeoutMs: 5_000 });
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('fetchDailyPayload — the payload, whatever its shape', () => {
  it.each([[[ROW]], [[]], [{ errors: 'none' }], ['text'], [null], [3]])('returns %j unexamined', async (body) => {
    stub(async () => okBody(body));
    expect(await fetchDailyPayload('NVDA', { ...WINDOW, order: 'd' })).toEqual(body);
  });
  it('the rows are the provider\'s own: not mapped, not sorted', async () => {
    const rows = [{ ...ROW, date: '2026-10-27' }, ROW];
    stub(async () => okBody(rows));
    expect(await fetchDailyPayload('NVDA', { ...WINDOW, order: 'd' })).toBe(rows);
  });
});

describe('fetchDailyPayload — failures, and the key', () => {
  it('no key configured: refuses with no call', async () => {
    delete process.env.EODHD_API_KEY;
    const f = stub(async () => okBody([]));
    await expect(fetchDailyPayload('NVDA', { ...WINDOW, order: 'd' })).rejects.toThrow('EODHD_API_KEY not configured');
    expect(f).not.toHaveBeenCalled();
  });
  it('a network failure throws today\'s message, even when the error carries the URL', async () => {
    stub(async (url) => { throw new TypeError(`fetch failed for ${url}`); });
    const e = await failure(fetchDailyPayload('NVDA', { ...WINDOW, order: 'd' }));
    expect(e.message).toBe('EODHD daily request failed');
    expect(`${e.message} ${e.stack} ${String(e.cause)}`).not.toContain(KEY);
  });
  it.each([[402], [404], [500]])('a %i throws today\'s message', async (status) => {
    stub(async () => ({ ok: false, status, json: async () => ({}) }));
    expect((await failure(fetchDailyPayload('NVDA', { ...WINDOW, order: 'd' }))).message).toBe(`EODHD daily responded with ${status}`);
  });
  it('a request that outlives its timeout fails with the same message, and the key stays out', async () => {
    stub((url, init) => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(init.signal.reason)); }));
    const e = await failure(fetchDailyPayload('NVDA', { ...WINDOW, order: 'd', timeoutMs: 5 }));
    expect(e.message).toBe('EODHD daily request failed');
    expect(`${e.message} ${e.stack}`).not.toContain(KEY);
  });
  it('the timeout covers the body too: a body that outlives it fails the same way', async () => {
    stub(async (url, init) => ({ ok: true, status: 200, json: () => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(init.signal.reason)); }) }));
    expect((await failure(fetchDailyPayload('NVDA', { ...WINDOW, order: 'd', timeoutMs: 5 }))).message).toBe('EODHD daily request failed');
  });
  it('a body that is not JSON fails with no snippet of it in the message', async () => {
    stub(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(`Unexpected token < in "<html>${KEY}"`); } }));
    const e = await failure(fetchDailyPayload('NVDA', { ...WINDOW, order: 'd' }));
    expect(e.message).toBe('EODHD daily request failed');
    expect(`${e.message} ${e.stack}`).not.toContain(KEY);
  });
});

describe('the review card through the shared request (its behaviour unchanged)', () => {
  it('fetchWindowDaily asks exactly what it always asked: this URL, oldest first, one argument', async () => {
    const f = stub(async () => okBody([ROW]));
    await fetchWindowDaily('NVDA', WINDOW);
    expect(f.mock.calls).toEqual([[`https://eodhd.com/api/eod/NVDA.US?api_token=${KEY}&fmt=json&period=d&order=a&from=2026-09-01&to=2026-10-28`]]);
  });
  it('rows come back through mapDailyRows: the split- and dividend-adjusted close, the raw close beside it', async () => {
    stub(async () => okBody([ROW]));
    expect(await fetchWindowDaily('NVDA', WINDOW)).toEqual([{ date: '2026-10-28', open: 10, high: 11, low: 9, close: 10.25, rawClose: 10.5, volume: 100 }]);
  });
  it.each([[{ errors: 'none' }], ['text'], [null], [3]])('a non-array success (%j) is still [] (no_data)', async (body) => {
    stub(async () => okBody(body));
    expect(await fetchWindowDaily('NVDA', WINDOW)).toEqual([]);
  });
  it('a network error and a non-OK status still throw today\'s messages', async () => {
    stub(async () => { throw new TypeError('network down'); });
    await expect(fetchWindowDaily('NVDA', WINDOW)).rejects.toThrow(/^EODHD daily request failed$/);
    stub(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(fetchWindowDaily('NVDA', WINDOW)).rejects.toThrow(/^EODHD daily responded with 500$/);
  });
  it('no key: still refused by name with no call', async () => {
    delete process.env.EODHD_API_KEY;
    const f = stub(async () => okBody([]));
    await expect(fetchWindowDaily('NVDA', WINDOW)).rejects.toThrow(/^EODHD_API_KEY not configured$/);
    expect(f).not.toHaveBeenCalled();
  });
  it('no thrown message contains the key, even when the failure carried the URL', async () => {
    stub(async (url) => { throw new TypeError(`fetch failed for ${url}`); });
    expect((await failure(fetchWindowDaily('NVDA', WINDOW))).message).not.toContain(KEY);
  });
  it('a body that is not JSON reaches the card as fetch_failed, as it always did: the message changed, the card never showed it', async () => {
    stub(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }));
    const window = { empty: false, start: { etDate: '2026-09-01' }, end: { etDate: '2026-10-28' } };
    const { evidence } = await computeReviewEvidence({ window, names: ['NVDA'], nowMs: Date.parse('2026-10-29T00:00:00Z') });
    expect(evidence.names).toEqual([{ symbol: 'NVDA', status: 'unavailable', reason: 'fetch_failed' }]);
    expect(evidence.market).toEqual({ symbol: 'SPY', status: 'unavailable', reason: 'fetch_failed' });
    expect(JSON.stringify(evidence)).not.toContain('Unexpected token');
  });
});
