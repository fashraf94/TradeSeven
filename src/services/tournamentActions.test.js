// src/services/tournamentActions.test.js
//
// P7 (B) — the mutation callers. Locks the client-honest/server-authoritative
// contract: the exact request shape; success ONLY on 2xx; a structured throw
// (status/code/message) on every error code (never a resolved "success"); and
// the error→copy map (known codes mapped, server message as fallback — never
// swallowed, never invented).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const fetchMock = vi.fn();
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: (...args) => fetchMock(...args) }));

import { placeClaim, flipPick, makeTrainingPick, mapTournamentActionError } from './tournamentActions';

function res(ok, status, body) {
  return { ok, status, json: async () => body };
}

beforeEach(() => { fetchMock.mockReset(); });

describe('placeClaim', () => {
  it('POSTs the exact body the server expects and returns the parsed success doc', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { claimId: 'c1', status: 'pending' }));
    const out = await placeClaim({ groupId: 'g1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 2 });
    expect(out).toEqual({ claimId: 'c1', status: 'pending' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/tournament/place-claim');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ groupId: 'g1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 2 });
  });

  it('omits rank when not a positive integer', async () => {
    fetchMock.mockResolvedValue(res(true, 200, {}));
    await placeClaim({ groupId: 'g1', dropSymbol: 'A', addSymbol: 'B' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ groupId: 'g1', dropSymbol: 'A', addSymbol: 'B' });
  });

  it('THROWS a structured error on a 409 (never resolves success)', async () => {
    fetchMock.mockResolvedValue(res(false, 409, { error: 'claim_cap_reached', message: 'Claim limit reached (3 pending per cycle).' }));
    await expect(placeClaim({ groupId: 'g1', dropSymbol: 'A', addSymbol: 'B' })).rejects.toMatchObject({
      status: 409,
      code: 'claim_cap_reached',
      message: 'Claim limit reached (3 pending per cycle).',
    });
  });

  it('THROWS on a 403 window_closed', async () => {
    fetchMock.mockResolvedValue(res(false, 403, { error: 'window_closed', message: 'closed' }));
    await expect(placeClaim({ groupId: 'g1', dropSymbol: 'A', addSymbol: 'B' })).rejects.toMatchObject({ status: 403, code: 'window_closed' });
  });
});

describe('flipPick', () => {
  it('POSTs {groupId, symbol} (no direction) and returns the response', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { from: 'long', to: 'short', marketState: 'open', doubledDown: true }));
    const out = await flipPick({ groupId: 'g1', symbol: 'NVDA' });
    expect(out.doubledDown).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tournament/flip');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ groupId: 'g1', symbol: 'NVDA' });
  });

  it('THROWS on 502 price_unavailable', async () => {
    fetchMock.mockResolvedValue(res(false, 502, { error: 'price_unavailable', message: 'no price' }));
    await expect(flipPick({ groupId: 'g1', symbol: 'NVDA' })).rejects.toMatchObject({ status: 502, code: 'price_unavailable' });
  });

  it('falls back to an HTTP code when the error body is empty/non-JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('no json'); } });
    await expect(flipPick({ groupId: 'g1', symbol: 'NVDA' })).rejects.toMatchObject({ status: 500, code: 'http_500' });
  });
});

describe('makeTrainingPick (Slice 2 interactive draft)', () => {
  it('POSTs an explicit pick {groupId, symbol} and returns the response', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { status: 'drafting', currentPickIndex: 7, complete: false }));
    const out = await makeTrainingPick({ groupId: 'g1', symbol: 'NVDA' });
    expect(out).toMatchObject({ currentPickIndex: 7, complete: false });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tournament/training-pick');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ groupId: 'g1', symbol: 'NVDA' });
  });

  it('sends the autopick flag (no symbol) on a timeout', async () => {
    fetchMock.mockResolvedValue(res(true, 200, { status: 'battle', complete: true }));
    const out = await makeTrainingPick({ groupId: 'g1', autopick: true });
    expect(out.complete).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ groupId: 'g1', autopick: true });
  });

  it('THROWS a structured error on a 409 not_your_turn (never resolves success)', async () => {
    fetchMock.mockResolvedValue(res(false, 409, { error: 'not_your_turn', message: 'not your turn' }));
    await expect(makeTrainingPick({ groupId: 'g1', symbol: 'NVDA' })).rejects.toMatchObject({ status: 409, code: 'not_your_turn' });
  });
});

describe('mapTournamentActionError', () => {
  it('maps known codes to friendly copy', () => {
    expect(mapTournamentActionError({ code: 'flip_cap_reached' })).toMatch(/all 5/);
    expect(mapTournamentActionError({ code: 'window_closed' })).toMatch(/9:24 AM ET/);
  });
  it('falls back to the server message for an unmapped code (never swallowed)', () => {
    expect(mapTournamentActionError({ code: 'some_new_code', message: 'Server said no.' })).toBe('Server said no.');
  });
  it('has a final fallback for a null error', () => {
    expect(mapTournamentActionError(null)).toMatch(/try again/);
  });
});
