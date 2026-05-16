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

const {
  getWatchlist,
  patchWatchlist,
  commitWatchlist,
  uncommitWatchlist,
  listWatchlists,
  deleteWatchlist,
  createWatchlist,
} = await import('./forgeWatchlistService.js');

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

describe('forgeWatchlistService — listWatchlists', () => {
  it('GETs the list endpoint and unwraps the watchlists array', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ watchlists: [{ watchlistId: 'wl-1' }, { watchlistId: 'wl-2' }] }),
    );
    const out = await listWatchlists();
    expect(out).toEqual([{ watchlistId: 'wl-1' }, { watchlistId: 'wl-2' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists', { method: 'GET' });
  });

  it('returns an empty array when the response has no watchlists field', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const out = await listWatchlists();
    expect(out).toEqual([]);
  });

  it('throws an error carrying status and code on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'server_error', message: 'Could not load watchlists.' },
        { ok: false, status: 500 },
      ),
    );
    await expect(listWatchlists()).rejects.toMatchObject({ status: 500, code: 'server_error' });
  });
});

describe('forgeWatchlistService — deleteWatchlist', () => {
  it('POSTs to the delete endpoint and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ watchlistId: 'wl-1', deletedAt: '2026-05-16T00:00:00.000Z', idempotent: false }),
    );
    const out = await deleteWatchlist('wl-1');
    expect(out.deletedAt).toBe('2026-05-16T00:00:00.000Z');
    expect(out.idempotent).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists/wl-1/delete', { method: 'POST' });
  });

  it('surfaces the idempotent flag when the watchlist was already deleted', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ watchlistId: 'wl-1', deletedAt: 'orig-ts', idempotent: true }),
    );
    const out = await deleteWatchlist('wl-1');
    expect(out.idempotent).toBe(true);
  });

  it('throws an error carrying status and code on a 404', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'not_found', message: 'Watchlist not found.' }, { ok: false, status: 404 }),
    );
    await expect(deleteWatchlist('wl-x')).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});

describe('forgeWatchlistService — createWatchlist', () => {
  it('POSTs an empty body to the create endpoint', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ watchlistId: 'wl-new', status: 'draft', tickerCount: 0, idempotent: false }),
    );
    await createWatchlist();
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  });

  it('returns the parsed create response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ watchlistId: 'wl-new', status: 'draft', tickerCount: 0, idempotent: false }),
    );
    const out = await createWatchlist();
    expect(out).toEqual({
      watchlistId: 'wl-new',
      status: 'draft',
      tickerCount: 0,
      idempotent: false,
    });
  });

  it('throws an error carrying status and code on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'server_error', message: 'Could not create watchlist.' },
        { ok: false, status: 500 },
      ),
    );
    await expect(createWatchlist()).rejects.toMatchObject({ status: 500, code: 'server_error' });
  });
});
