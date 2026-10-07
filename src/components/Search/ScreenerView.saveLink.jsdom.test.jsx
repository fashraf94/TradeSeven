// @vitest-environment jsdom
// src/components/Search/ScreenerView.saveLink.jsdom.test.jsx
//
// Pilot P2 — the screener → list link, client side (acceptance row 5): the
// "Save as watchlist" request carries the screener session the screen ran in
// (`screenerSessionId`), so the server can name the list's research record.
// The server links it only when the research-record gate is on for the
// player (api/forge/researchRecords.hosts.test.js row 5); the request's other
// fields are unchanged. Before any session exists, nothing is sent for it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth }));
vi.mock('../../contexts/ThemeContext', async () => {
  const { DARK_TOKENS } = await import('../../theme/tokens');
  return { useTheme: () => ({ tokens: DARK_TOKENS }) };
});

import ScreenerView from './ScreenerView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const screened = {
  sessionId: 'rs-session-7', message: 'Here are the strongest names.', suggestedActions: [], screened: true, resultType: 'stocks',
  appliedSpec: { filters: [{ field: 'compositeScore', op: 'gte', value: 60 }], limit: 2 }, rejectedFilters: [],
  results: [{ symbol: 'NVDA', sectorName: 'Technology', compositeScore: 95 }, { symbol: 'AMD', sectorName: 'Technology', compositeScore: 85 }],
  matchCount: 4, universeSize: 6, dataAsOf: '2026-10-07T12:00:00.000Z',
};

let container;
let root;
beforeEach(() => {
  fetchWithAuth.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => {}); };
const buttonWith = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));
async function click(el) { await act(async () => { el.click(); }); await flush(); }

describe('Save as watchlist sends the screener session it came from', () => {
  it('the create request carries screenerSessionId beside the fields it always sent', async () => {
    fetchWithAuth.mockImplementation(async (url) => {
      if (url === '/api/screener/chat') return json(200, screened);
      if (url === '/api/forge/watchlists') return json(200, { watchlistId: 'wl-9', status: 'draft' });
      return json(200, {});
    });
    await act(async () => { root.render(<ScreenerView onOpenResearch={() => {}} isMobile={false} />); });
    await flush();
    await click(buttonWith('Top BaggerBomb fit'));
    await click(buttonWith('Save as watchlist'));
    await click(buttonWith('Save & finalize'));
    const create = fetchWithAuth.mock.calls.find(([url]) => url === '/api/forge/watchlists');
    expect(create).toBeTruthy();
    const body = JSON.parse(create[1].body);
    expect(body).toEqual({
      tickers: [{ symbol: 'NVDA', reasoning: '', category: 'Technology' }, { symbol: 'AMD', reasoning: '', category: 'Technology' }],
      name: expect.any(String),
      sourceScreenSpec: screened.appliedSpec,
      screenerSessionId: 'rs-session-7',
    });
  });
});
