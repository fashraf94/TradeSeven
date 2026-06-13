// src/services/tournamentLobbyActions.test.js
//
// P10b — the client lobby mutation callers. Locks the client-honest /
// server-authoritative contract: the exact request shape; success ONLY on 2xx;
// a structured throw (status/code/message) on every error code (never a
// resolved "joined/formed"); and the error→copy map (known codes mapped,
// server message as fallback — never swallowed, never invented).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const fetchMock = vi.fn();
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: (...args) => fetchMock(...args) }));

import {
  quickPlay,
  createLobby,
  joinLobby,
  matchmakeJoin,
  formLobby,
  mapLobbyError,
} from './tournamentLobbyActions';

function res(ok, status, body) {
  return { ok, status, json: async () => body };
}

beforeEach(() => { fetchMock.mockReset(); });

describe('request shapes', () => {
  it('quickPlay POSTs to lobby-quickplay and returns the formed group', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { lobbyId: 'l1', groupId: 'l1', cpuNs: [1, 2, 3] }));
    const out = await quickPlay({ displayName: 'Ada' });
    expect(out.groupId).toBe('l1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/tournament/lobby-quickplay');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ displayName: 'Ada' });
  });

  it('createLobby includes mode only when provided', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { lobbyId: 'l1', lobby: { id: 'l1', joinCode: 'ABC234' } }));
    await createLobby({ displayName: 'Ada', mode: 'private' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ displayName: 'Ada', mode: 'private' });

    fetchMock.mockResolvedValue(res(true, 200, {}));
    await createLobby({});
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({});
  });

  it('joinLobby carries lobbyId or joinCode', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { joined: true, formed: null }));
    await joinLobby({ joinCode: 'ABC234' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ joinCode: 'ABC234' });
    await joinLobby({ lobbyId: 'l1', displayName: 'Bo' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ lobbyId: 'l1', displayName: 'Bo' });
  });

  it('matchmakeJoin and formLobby hit their routes', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { created: true, formed: null }));
    await matchmakeJoin({});
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tournament/lobby-matchmake');

    fetchMock.mockResolvedValue(res(true, 200, { groupId: 'l1' }));
    await formLobby({ lobbyId: 'l1' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/tournament/lobby-form');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ lobbyId: 'l1' });
  });
});

describe('client-honest: never resolves a success the server did not grant', () => {
  it('THROWS a structured error on a 409 lobby_full (never resolves)', async () => {
    fetchMock.mockResolvedValue(res(false, 409, { error: 'lobby_full', message: 'That game is already full.' }));
    await expect(joinLobby({ lobbyId: 'l1' })).rejects.toMatchObject({
      status: 409, code: 'lobby_full', message: 'That game is already full.',
    });
  });

  it('THROWS on 503 universe_unavailable', async () => {
    fetchMock.mockResolvedValue(res(false, 503, { error: 'universe_unavailable', message: 'not ready' }));
    await expect(quickPlay({})).rejects.toMatchObject({ status: 503, code: 'universe_unavailable' });
  });

  it('THROWS on 403 not_lobby_owner', async () => {
    fetchMock.mockResolvedValue(res(false, 403, { error: 'not_lobby_owner', message: 'nope' }));
    await expect(formLobby({ lobbyId: 'l1' })).rejects.toMatchObject({ status: 403, code: 'not_lobby_owner' });
  });

  it('falls back to an HTTP code when the error body is empty/non-JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('no json'); } });
    await expect(matchmakeJoin({})).rejects.toMatchObject({ status: 500, code: 'http_500' });
  });
});

describe('mapLobbyError', () => {
  it('maps known codes to friendly copy', () => {
    expect(mapLobbyError({ code: 'code_not_found' })).toMatch(/No open game matched/);
    expect(mapLobbyError({ code: 'lobby_full' })).toMatch(/filled up/);
  });
  it('falls back to the server message for an unmapped code (never swallowed)', () => {
    expect(mapLobbyError({ code: 'some_new_code', message: 'Server said no.' })).toBe('Server said no.');
  });
  it('has a final fallback for a null error', () => {
    expect(mapLobbyError(null)).toMatch(/try again/);
  });
});
