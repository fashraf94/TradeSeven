// @vitest-environment jsdom
//
// Research universe Build 3b (sections 6 and 7; the founder's ruling of Nov 27, 2026 on the builder's rows): WHAT A
// RESEARCH SESSION SHOWS, and that a game-list session shows none of it.
//   - the builder, on a research session only, holds "What the records already hold": a research company's row with its
//     sector, "Research only · no rank", each kept measure that is not null, the currency line once when a measure is held
//     back, and "not fetched" / "not available today" when there are no numbers;
//   - the thesis saved screen carries "Holds a research-only company. It can't be equipped to a battle agent." when one
//     of its names is research-only (worked out from the companies' eligibility, never a stored flag);
//   - the equip route's research_only_list refusal shows in the equip-failed notice, in its own words.
// Rendered from the server's own answers (__fixtures__/thesisAnswers.json), with the research fields a research
// session's answer carries set on a copy (session.universe, a supported company's eligibility, its stored rows).

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithAuth = vi.hoisted(() => vi.fn());
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth }));
const transitionHypothesis = vi.hoisted(() => vi.fn());
vi.mock('../../services/hypothesisVersionService', () => ({ transitionHypothesis }));
const equipLoadoutBook = vi.hoisted(() => vi.fn());
vi.mock('../../services/loadoutService', () => ({ equipLoadoutBook }));

const { default: Body } = await import('./SharedResearchSheetBody');
const { SR_COPY: COPY } = await import('./sharedResearchCopy');
const kit = await import('./__fixtures__/srKit');
const { default: TA } = await import('./__fixtures__/thesisAnswers.json');
const { fakeServer, mount, flush, click, $ } = kit;
const R = COPY.research;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mounted = [];
let server;
const keep = (m) => { mounted.push(m); return m; };
beforeEach(() => {
  server = fakeServer({ list: TA.listEmpty });
  fetchWithAuth.mockImplementation(server.fetch);
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); });

const AT = '2026-11-27T15:00:00.000Z';
const GLW_ROW = {
  symbol: 'GLW', name: 'Corning Incorporated', research: true,
  peer: { sector: 'Technology', metrics: { revenueGrowthYOY: 0.184, earningsGrowthYOY: -0.05, grossMargin: 0.3648, profitMarginTTM: null, fcfYield: 6.8595, fcfMargin: 33.4274, priceSalesTTM: 4.8731, debtToEquity: 0.8658, currentRatio: 1.5878, interestCoverage: 6.7827, netDebtEbitda: 2.3985 }, asOf: AT },
  ranking: null, numbers: 'shown', stale: false, reportsIn: 'USD', heldBack: [],
};
const TSM_ROW = { ...GLW_ROW, symbol: 'TSM', name: 'Taiwan Semiconductor Manufacturing', peer: { ...GLW_ROW.peer, metrics: { ...GLW_ROW.peer.metrics, fcfYield: null, fcfMargin: null, priceSalesTTM: null } }, reportsIn: 'TWD', heldBack: ['fcfYield', 'fcfMargin', 'priceSalesTTM'] };
const APH_ROW = { ...GLW_ROW, symbol: 'APH', name: 'Amphenol Corp', peer: { sector: 'Technology', metrics: null, asOf: null }, numbers: 'not_fetched', reportsIn: null };
const ANET_ROW = { ...APH_ROW, symbol: 'ANET', name: 'Arista Networks', numbers: 'not_available' };
const NVDA_ROW = { symbol: 'NVDA', name: 'NVIDIA Corporation', peer: { sector: 'Technology', metrics: null, asOf: AT }, ranking: { rank: 2, of: 21, sector: 'Technology', asOf: AT } };

/** A copy of a server answer as a research session answers it: stamped, the card's names research-only, these rows. */
function asResearch(answer, rows) {
  const a = structuredClone(answer);
  a.body.session.universe = 'research';
  const names = a.body.thesis?.parts?.names?.value ?? [];
  for (const c of a.body.companies.supported) if (names.includes(c.symbol)) c.eligibility = 'research';
  a.body.storedRows = rows;
  return a;
}
async function openGet(get, props = {}) {
  server.set('get', get);
  keep(mount(<Body mode="session" sessionId={get.body.session.sessionId} onClose={vi.fn()} phone agentName="Atlas" agentId="agent-fixture-1" {...props} />));
  await flush();
}

describe('the builder: a research session holds its stored rows; a game-list session holds none', () => {
  it('a research session: the rows, folded under "What the records already hold"; a research row its own numbers and no rank', async () => {
    await openGet(asResearch(TA.walkGetNames, [NVDA_ROW, GLW_ROW, TSM_ROW, APH_ROW, ANET_ROW]));
    const box = $('[data-sr-stored]');
    expect(box).not.toBeNull();
    expect(box.textContent).toContain(COPY.storedFacts);
    click(box.querySelector('button'));
    await flush();
    const glw = $('[data-sr-research-row="GLW"]');
    expect(glw.querySelector('p').textContent).toBe('Corning Incorporated · GLW · Technology · Research only · no rank · As of Nov 27, 2026');
    expect($('[data-sr-research-row="GLW"] [data-sr-measure="revenueGrowthYOY"]').textContent).toBe('Revenue, latest quarter against a year earlier: +18.4 percent');
    expect($('[data-sr-research-row="GLW"] [data-sr-measure="earningsGrowthYOY"]').textContent).toBe('Earnings, latest quarter against a year earlier: −5.0 percent');
    expect($('[data-sr-research-row="GLW"] [data-sr-measure="grossMargin"]').textContent).toBe('Gross margin: 36.5 percent');
    expect($('[data-sr-research-row="GLW"] [data-sr-measure="fcfYield"]').textContent).toBe('Free cash flow yield: 6.9 percent');
    expect($('[data-sr-research-row="GLW"] [data-sr-measure="debtToEquity"]').textContent).toBe('Debt to equity: 0.87');
    // a measure that is null is not shown; no currency line for a USD filer
    expect($('[data-sr-research-row="GLW"] [data-sr-measure="profitMarginTTM"]')).toBeNull();
    expect($('[data-sr-research-row="GLW"] [data-sr-held-back]')).toBeNull();
    // the held-back measures: not shown, and the currency line once
    expect($('[data-sr-research-row="TSM"] [data-sr-measure="fcfYield"]')).toBeNull();
    expect($('[data-sr-research-row="TSM"]').querySelectorAll('[data-sr-held-back]')).toHaveLength(1);
    expect($('[data-sr-research-row="TSM"] [data-sr-held-back]').textContent).toBe(R.heldBack('TWD'));
    expect($('[data-sr-research-row="APH"] [data-sr-not-fetched]').textContent).toBe(R.notFetched);
    expect($('[data-sr-research-row="ANET"] [data-sr-not-available]').textContent).toBe(R.notAvailable);
    // a game stock's row is PR A's one line, with its rank
    expect(box.textContent).toContain('NVIDIA Corporation · NVDA · Technology · Ranked 2 of 21 in Technology · As of Nov 27, 2026');
    expect(box.textContent).not.toMatch(/rank \d|percentile|tier/i);
  });
  it('a game-list session: no rows box at all, even when its answer carries rows', async () => {
    const game = structuredClone(TA.walkGetNames);
    game.body.storedRows = [NVDA_ROW];
    await openGet(game);
    expect($('[data-sr-stored]')).toBeNull();
    expect($('[data-sr-research-row]')).toBeNull();
  });
});

describe('the saved idea says what it is (section 7.2)', () => {
  it('a saved thesis holding a research-only company carries the line; a game-list one does not', async () => {
    await openGet(asResearch(TA.walkGetSaved, []));
    expect($('[data-sr-research-only]').textContent).toBe("Holds a research-only company. It can't be equipped to a battle agent.");
    for (const m of mounted) m.unmount();
    mounted = [];
    await openGet(TA.walkGetSaved);
    expect($('[data-sr-research-only]')).toBeNull();
  });
});

describe('the equip refusal shows where the route\'s other refusals show (section 7.3)', () => {
  it('research_only_list: the equip-failed notice says why, in the route\'s own words', async () => {
    transitionHypothesis.mockResolvedValue({ ok: true });
    equipLoadoutBook.mockRejectedValue(Object.assign(new Error(R.equipRefused), { status: 400, code: 'research_only_list' }));
    await openGet(asResearch(TA.walkGetSaved, []));
    click($('[data-sr-equip]'));
    await flush();
    await flush();
    const notice = $('[data-sr-equip-failed]');
    expect(notice.getAttribute('data-sr-equip-failed')).toBe('research_only_list');
    expect(notice.textContent).toBe("This idea holds a research-only company and can't be equipped to a battle agent.");
  });
  it('any other failure: the notice as before', async () => {
    transitionHypothesis.mockResolvedValue({ ok: true });
    equipLoadoutBook.mockRejectedValue(Object.assign(new Error('Cannot equip'), { status: 409, code: 'battle_active' }));
    await openGet(TA.walkGetSaved);
    click($('[data-sr-equip]'));
    await flush();
    await flush();
    expect($('[data-sr-equip-failed]').getAttribute('data-sr-equip-failed')).toBe('');
    expect($('[data-sr-equip-failed]').textContent).toBe(COPY.equipFailed);
  });
});
