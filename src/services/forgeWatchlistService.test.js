// src/services/forgeWatchlistService.test.js
//
// Sprint 6 Phase 4B — coverage for the forge watchlist client. fetchWithAuth
// is mocked so the tests exercise URL/method/body construction, response
// unwrapping, and error mapping without a network.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('../utils/fetchWithAuth', () => ({
  fetchWithAuth: fetchMock,
}));

const { getWatchlist, patchWatchlist, commitWatchlist, uncommitWatchlist } = await import(
  './forgeWatchlistService.js'
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('forgeWatchlistService — getWatchlist', () => {
  it('GETs the endpoint and unwraps the watchlist field', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ watchlist: { watchlistId: 'wl-1', name: 'AI' } }));
    const wl = await getWatchlist('wl-1');
    expect(wl).toEqual({ watchlistId: 'wl-1', name: 'AI' });
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists/wl-1', { method: 'GET' });
  });

  it('throws an error carrying status and code on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'not_found', message: 'Watchlist not found.' }, { ok: false, status: 404 }),
    );
    await expect(getWatchlist('wl-x')).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});

describe('forgeWatchlistService — patchWatchlist', () => {
  it('PATCHes the JSON-encoded fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ watchlistId: 'wl-1', updatedAt: 'ts' }));
    const out = await patchWatchlist('wl-1', { name: 'New name' });
    expect(out).toEqual({ watchlistId: 'wl-1', updatedAt: 'ts' });
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists/wl-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New name' }),
    });
  });

  it('forwards an AbortSignal to fetchWithAuth', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ watchlistId: 'wl-1', updatedAt: 'ts' }));
    const controller = new AbortController();
    await patchWatchlist('wl-1', { notes: 'x' }, { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('lets an AbortError propagate (the caller decides to swallow it)', async () => {
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    fetchMock.mockRejectedValue(abortErr);
    await expect(patchWatchlist('wl-1', { notes: 'x' })).rejects.toBe(abortErr);
  });

  it('throws the parsed error on a 409 committed conflict', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'invalid_status', message: 'Cannot edit a committed watchlist directly.' },
        { ok: false, status: 409 },
      ),
    );
    await expect(patchWatchlist('wl-1', { name: 'x' })).rejects.toMatchObject({
      status: 409,
      code: 'invalid_status',
    });
  });
});

describe('forgeWatchlistService — commitWatchlist / uncommitWatchlist', () => {
  it('POSTs to the commit endpoint and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ watchlistId: 'wl-1', status: 'committed', idempotent: false }),
    );
    const out = await commitWatchlist('wl-1');
    expect(out.status).toBe('committed');
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists/wl-1/commit', { method: 'POST' });
  });

  it('maps a commit 400 to a thrown not_commit_ready error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'not_commit_ready', message: 'Needs a ticker.' }, { ok: false, status: 400 }),
    );
    await expect(commitWatchlist('wl-1')).rejects.toMatchObject({
      status: 400,
      code: 'not_commit_ready',
    });
  });

  it('POSTs to the uncommit endpoint and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ watchlistId: 'wl-1', status: 'draft', idempotent: false }),
    );
    const out = await uncommitWatchlist('wl-1');
    expect(out.status).toBe('draft');
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists/wl-1/uncommit', {
      method: 'POST',
    });
  });
});
