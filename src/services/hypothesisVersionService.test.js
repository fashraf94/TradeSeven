// src/services/hypothesisVersionService.test.js
//
// Pilot P1a — the client ↔ route contract (review L5-1): the panel's suite
// mocks this whole module, so these rows pin what it actually sends — URL,
// method and body per call — and that a non-2xx answer carries the API's
// typed code (the panel hides on `disabled` and closes an editor on a 409
// conflict only through that code). Only fetchWithAuth is mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: (...args) => fetchMock(...args) }));
const svc = await import('./hypothesisVersionService');

const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const fail = (status, data) => ({ ok: false, status, json: async () => data });
const sent = (i = 0) => { const [url, init] = fetchMock.mock.calls[i]; return { url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body) }; };
beforeEach(() => fetchMock.mockReset());

describe('URL, method and body per call', () => {
  it('list → GET /api/forge/watchlists/{id}/hypothesis-versions, no body', async () => {
    fetchMock.mockResolvedValue(ok({ currentVersion: 0, versions: [] }));
    await svc.listHypothesisVersions('wl-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/forge/watchlists/wl-1/hypothesis-versions', { method: 'GET' });
  });
  it('create → POST hypothesis-versions { opId, expectedVersion, statement } — horizonEnum only when picked', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await svc.createHypothesisVersion('wl-1', { opId: 'op-1', expectedVersion: 0, statement: 'Idea' });
    await svc.createHypothesisVersion('wl-1', { opId: 'op-2', expectedVersion: 1, statement: 'Idea', horizonEnum: 'swing' });
    expect(sent(0)).toEqual({ url: '/api/forge/watchlists/wl-1/hypothesis-versions', method: 'POST', body: { opId: 'op-1', expectedVersion: 0, statement: 'Idea' } });
    expect(sent(1).body).toEqual({ opId: 'op-2', expectedVersion: 1, statement: 'Idea', horizonEnum: 'swing' });
  });
  it('transition → POST hypothesis-transition { version, action, expectedStatus } — missingEvidence only when given', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await svc.transitionHypothesis('wl-1', { version: 2, action: 'ready', expectedStatus: 'researched' });
    await svc.transitionHypothesis('wl-1', { version: 2, action: 'wait', expectedStatus: 'researched', missingEvidence: 'Q3' });
    expect(sent(0)).toEqual({ url: '/api/forge/watchlists/wl-1/hypothesis-transition', method: 'POST', body: { version: 2, action: 'ready', expectedStatus: 'researched' } });
    expect(sent(1).body).toEqual({ version: 2, action: 'wait', expectedStatus: 'researched', missingEvidence: 'Q3' });
  });
  it('reaffirm → POST hypothesis-transition with action reaffirm; statement / horizonEnum only when sent', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await svc.reaffirmHypothesis('wl-1', { version: 1, opId: 'op-1', expectedVersion: 1 });
    await svc.reaffirmHypothesis('wl-1', { version: 1, opId: 'op-2', expectedVersion: 1, statement: 'Sharper', horizonEnum: 'longterm' });
    expect(sent(0)).toEqual({ url: '/api/forge/watchlists/wl-1/hypothesis-transition', method: 'POST', body: { version: 1, action: 'reaffirm', opId: 'op-1', expectedVersion: 1 } });
    expect(sent(1).body).toEqual({ version: 1, action: 'reaffirm', opId: 'op-2', expectedVersion: 1, statement: 'Sharper', horizonEnum: 'longterm' });
  });
  it('a watchlist id is URL-encoded', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await svc.listHypothesisVersions('a b');
    expect(sent(0).url).toBe('/api/forge/watchlists/a%20b/hypothesis-versions');
  });
});

describe('errors carry the API\'s typed code', () => {
  it('a non-2xx answer throws with status, the API error code and the body — `disabled` is detectable', async () => {
    fetchMock.mockResolvedValue(fail(404, { error: 'disabled' }));
    await expect(svc.listHypothesisVersions('wl-1')).rejects.toMatchObject({ status: 404, code: 'disabled', body: { error: 'disabled' } });
  });
  it('a typed 409 keeps its code and message', async () => {
    fetchMock.mockResolvedValue(fail(409, { error: 'version_conflict', message: 'The idea changed since you loaded it. Reload and try again.', currentVersion: 3 }));
    await expect(svc.createHypothesisVersion('wl-1', { opId: 'op-1', expectedVersion: 2, statement: 'x' }))
      .rejects.toMatchObject({ status: 409, code: 'version_conflict', message: 'The idea changed since you loaded it. Reload and try again.', body: { currentVersion: 3 } });
  });
  it('a non-JSON error body (a platform page) reads as request_failed — never a gate verdict', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } });
    await expect(svc.listHypothesisVersions('wl-1')).rejects.toMatchObject({ status: 502, code: 'request_failed' });
  });
});
