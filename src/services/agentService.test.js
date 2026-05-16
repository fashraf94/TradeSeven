// src/services/agentService.test.js
//
// Phase 5B1 — coverage for the equip/unequip client methods. fetchWithAuth is
// mocked so the tests exercise URL/method/body construction, response
// unwrapping, and error mapping without a network. firebase/config is stubbed
// so importing agentService.js does not boot a real Firebase app.
//
// Pattern reference: src/services/forgeWatchlistService.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: fetchMock }));
vi.mock('../firebase/config', () => ({ db: {} }));

const { equipWatchlist, unequipWatchlist } = await import('./agentService.js');

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('agentService — equipWatchlist', () => {
  it('POSTs agentId + watchlistId and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        agentId: 'a1',
        equippedWatchlistId: 'wl-1',
        equippedWatchlistName: 'AI plays',
        equippedAt: '2026-05-16T00:00:00.000Z',
        idempotent: false,
      })
    );
    const out = await equipWatchlist('a1', 'wl-1');
    expect(out.equippedWatchlistId).toBe('wl-1');
    expect(out.idempotent).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/agent/equip-watchlist', {
      method: 'POST',
      body: JSON.stringify({ agentId: 'a1', watchlistId: 'wl-1' }),
    });
  });

  it('surfaces the idempotent flag on a no-op re-equip', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ equippedWatchlistId: 'wl-1', idempotent: true })
    );
    const out = await equipWatchlist('a1', 'wl-1');
    expect(out.idempotent).toBe(true);
  });

  it('throws an error carrying status + code on a 409 battle conflict', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'battle_active', message: 'Cannot equip while in a battle.' },
        { ok: false, status: 409 }
      )
    );
    await expect(equipWatchlist('a1', 'wl-1')).rejects.toMatchObject({
      status: 409,
      code: 'battle_active',
    });
  });

  it('throws an error carrying status + code on a 404 watchlist_not_found', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'watchlist_not_found', message: 'Watchlist not found.' },
        { ok: false, status: 404 }
      )
    );
    await expect(equipWatchlist('a1', 'wl-x')).rejects.toMatchObject({
      status: 404,
      code: 'watchlist_not_found',
    });
  });
});

describe('agentService — unequipWatchlist', () => {
  it('POSTs agentId and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ agentId: 'a1', equippedWatchlistId: null, idempotent: false })
    );
    const out = await unequipWatchlist('a1');
    expect(out.equippedWatchlistId).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/agent/unequip-watchlist', {
      method: 'POST',
      body: JSON.stringify({ agentId: 'a1' }),
    });
  });

  it('surfaces the idempotent flag when nothing was equipped', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ equippedWatchlistId: null, idempotent: true })
    );
    const out = await unequipWatchlist('a1');
    expect(out.idempotent).toBe(true);
  });

  it('throws an error carrying status + code on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'forbidden', message: 'Not authorized for this agent.' },
        { ok: false, status: 403 }
      )
    );
    await expect(unequipWatchlist('a1')).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });
  });
});
