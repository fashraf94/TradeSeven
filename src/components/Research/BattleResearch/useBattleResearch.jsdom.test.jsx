// @vitest-environment jsdom
//
// Battle Research Slice 1 — the in-memory store (BRS-2, BRS-5, BRS-14, BRS-21): a question reads one
// evidence bundle (or reuses the one a minute old), freezes ONE result on the server's clock and starts an
// investigation; refinements read nothing; Refresh is one at a time and once a minute, and a failed one
// changes nothing; a change of battle clears everything; nothing is ever written (no Firestore, no
// localStorage); ids never collide; the modal gets the whole doc for the current result, the subset for
// an older one.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../../firebase/authService', () => ({ getIdToken: async () => 'token-1' }));
// fetchEvidence's two reads (the store rows below inject their own fetcher and never reach these).
const READS = vi.hoisted(() => ({ rankings: null, rankingsFail: false }));
vi.mock('../Sheet/rankingsRead.js', () => ({ readRankings: async () => { if (READS.rankingsFail) throw new Error('down'); return READS.rankings; } }));

import useBattleResearch, { subsetDoc, EVIDENCE_REUSE_MS, fetchEvidence } from './useBattleResearch.js';
import { BR_COPY } from './battleResearchCopy.js';
import { currentResult, currentStep } from './investigation.js';
import { REFRESH_COOLDOWN_MS } from './investigation.js';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const MIN = 60_000;
let BATTLE;
beforeAll(async () => { BATTLE = await researchBattle(); });

let container; let root; let clockNow; let fetches; let failNext;
const clock = () => clockNow;
const fetcher = async (battleId) => {
  fetches.push(battleId);
  if (failNext) { failNext = false; throw { why: 'the price read didn’t answer' }; }
  // The server stamps its own time; the client's arrives a second later.
  return { quotesBody: { ...quotesBody(), servedAt: clockNow - 1000 }, rankingsDoc: rankingsDoc(), takenAt: clockNow - 1000, receivedAt: clockNow };
};
function Probe({ battleId, battle, out }) {
  out.store = useBattleResearch({ battleId, battle, agent: { agentId: 'a1', agentName: 'shadow', archetype: 'momentum_chaser' }, fetcher, clock });
  return null;
}
const out = {};
const render = async (battleId = 'stock-battle', battle = BATTLE) => { await act(async () => { root.render(<Probe battleId={battleId} battle={battle} out={out} />); }); };
const run = async (fn) => { await act(async () => { await fn(out.store); }); };

beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  clockNow = TAKEN_AT; fetches = []; failNext = false;
  vi.spyOn(Storage.prototype, 'setItem');
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe('a question', () => {
  it('reads one bundle, freezes one result on the SERVER clock (servedAt), starts an investigation and shows the board', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    const inv = out.store.active;
    expect(fetches).toEqual(['stock-battle']);
    expect(out.store.state.view).toBe('board');
    expect(currentResult(inv).takenAt).toBe(TAKEN_AT - 1000);
    expect(currentResult(inv).receivedAt).toBe(TAKEN_AT);
    expect(currentResult(inv).incumbent.symbol).toBe('EQIX');
  });
  it('reuses the opening\'s bundle within a minute (one read of each per open-and-ask), and reads again after', async () => {
    await render();
    await run((s) => s.open());
    clockNow += EVIDENCE_REUSE_MS - 1;
    await run((s) => s.ask('rank_bench'));
    expect(fetches).toHaveLength(1);
    clockNow += 2;
    await run((s) => s.ask('rank_agent_watchlist'));
    expect(fetches).toHaveLength(2);
  });
  it('a failed first fetch shows its line and no result; Try again asks again', async () => {
    await render();
    failNext = true;
    await run((s) => s.ask('weakest_alternatives'));
    expect(out.store.state.failure).toEqual({ questionId: 'weakest_alternatives', why: 'the price read didn’t answer' });
    expect(out.store.active).toBeNull();
    await run((s) => s.ask('weakest_alternatives'));
    expect(out.store.active).not.toBeNull();
  });
  it('two questions never share an id, even at the same clock instant (review BR1-12)', async () => {
    await render();
    await run((s) => s.ask('rank_bench'));
    await run((s) => s.ask('rank_agent_watchlist'));
    const ids = out.store.state.session.list.map((x) => x.investigationId);
    expect(new Set(ids).size).toBe(2);
  });
  it('the weakest question is refused when there is no weakest (BRS-6)', async () => {
    const fresh = JSON.parse(JSON.stringify(BATTLE));
    fresh.scoring.stockRewardContexts.agent = {};
    await render('stock-battle', fresh);
    await run((s) => s.ask('weakest_alternatives'));
    expect(fetches).toEqual([]);
    expect(out.store.noWeakest).toBe('awaiting');
  });
});

describe('refinements read nothing; the result is frozen', () => {
  it('order, condition, undo — no fetch, the same result', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    const r1 = JSON.stringify(currentResult(out.store.active));
    await run((s) => s.setOrder({ measure: 'today_move', direction: 'best_first' }));
    await run((s) => s.addCondition({ id: 'eligible_now' }));
    await run((s) => s.undo());
    expect(fetches).toHaveLength(1);
    expect(JSON.stringify(currentResult(out.store.active))).toBe(r1);
    expect(currentStep(out.store.active).kind).toBe('order');
  });
  it('the battle moving on (a new roster) reorders nothing', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    const placed = JSON.stringify(currentStep(out.store.active).outcome.placed);
    const moved = JSON.parse(JSON.stringify(BATTLE));
    moved.watchlist.hotBench = ['ZZZ'];
    await render('stock-battle', moved);
    expect(JSON.stringify(currentStep(out.store.active).outcome.placed)).toBe(placed);
  });
});

describe('BRS-14 — Refresh', () => {
  it('waits a minute, then makes Result 2 and reports what changed; the old result stays', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    await run((s) => s.refresh());
    expect(fetches).toHaveLength(1); // inside the minute: nothing
    clockNow += REFRESH_COOLDOWN_MS;
    await run((s) => s.refresh());
    expect(fetches).toHaveLength(2);
    const inv = out.store.active;
    expect(currentResult(inv).label).toMatch(/^Result 2 · /);
    expect(Object.keys(inv.results)).toEqual(['r1', 'r2']);
    expect(out.store.state.refresh.report).toMatchObject({ label: currentResult(inv).label });
  });
  it('one in flight: a second tap while one runs does nothing', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    clockNow += REFRESH_COOLDOWN_MS;
    await act(async () => { const a = out.store.refresh(); const b = out.store.refresh(); await Promise.all([a, b]); });
    expect(fetches).toHaveLength(2);
  });
  it('a failed refresh changes nothing — the result byte-identical — and says so', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    const before = JSON.stringify(out.store.active);
    clockNow += REFRESH_COOLDOWN_MS;
    failNext = true;
    await run((s) => s.refresh());
    expect(JSON.stringify(out.store.active)).toBe(before);
    expect(out.store.state.refresh.error).toMatch(/^Couldn’t refresh: the price read didn’t answer\. Your \d{1,2}:\d{2} (AM|PM) result is unchanged\.$/);
  });
});

describe('BRS-21 — memory only', () => {
  it('a change of battle clears every investigation', async () => {
    await render();
    await run((s) => s.ask('rank_bench'));
    expect(out.store.state.session.list).toHaveLength(1);
    await render('another-battle');
    expect(out.store.state.session.list).toHaveLength(0);
    expect(out.store.active).toBeNull();
  });
  it('writes nothing to the browser\'s storage', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    await run((s) => s.addCondition({ id: 'eligible_now' }));
    expect(Storage.prototype.setItem).not.toHaveBeenCalled();
  });
  it('the modal gets the WHOLE doc for the current result and the frozen subset (doc-shaped) for an older one', async () => {
    await render();
    await run((s) => s.ask('weakest_alternatives'));
    const inv1 = out.store.active;
    expect(out.store.rankingsFor(inv1, 'r1').stocks).toHaveLength(rankingsDoc().stocks.length);
    clockNow += REFRESH_COOLDOWN_MS;
    await run((s) => s.refresh());
    const inv2 = out.store.active;
    const old = out.store.rankingsFor(inv2, 'r1');
    expect(old).toEqual(subsetDoc(inv2.results.r1));
    expect(old.stocks.some((x) => x.symbol === 'ZZZ')).toBe(false);
    expect(old.stocks.find((x) => x.symbol === 'PLTR')).toMatchObject({ technicalRank: 5, techRaw: { atrPercent: 4.06 } });
    expect(out.store.rankingsFor(inv2, 'r2').stocks).toHaveLength(rankingsDoc().stocks.length);
  });
});

describe('fetchEvidence — one bundle: the route and the rankings doc, stamped on the SERVER clock (review BR1-3)', () => {
  const answer = (status, body) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
  beforeEach(() => { READS.rankings = rankingsDoc(); READS.rankingsFail = false; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TAKEN_AT + 3000)); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("takenAt is the route's servedAt; receivedAt the client's instant; one call to the route, by battle id", async () => {
    const f = answer(200, { ...quotesBody(), servedAt: TAKEN_AT });
    vi.stubGlobal('fetch', f);
    const b = await fetchEvidence('stock battle/1');
    expect(f.mock.calls.map(([u]) => u)).toEqual(['/api/agent/battle-research-quotes?battleId=stock%20battle%2F1']);
    expect(b.takenAt).toBe(TAKEN_AT);
    expect(b.receivedAt).toBe(TAKEN_AT + 3000);
    expect(b.rankingsDoc).toBe(READS.rankings);
  });
  it("no servedAt: the client's instant stands in for both", async () => {
    const { servedAt, ...noServed } = { ...quotesBody() }; // eslint-disable-line no-unused-vars
    vi.stubGlobal('fetch', answer(200, noServed));
    const b = await fetchEvidence('b');
    expect(b.takenAt).toBe(TAKEN_AT + 3000);
  });
  it('the three reasons a first fetch says it failed', async () => {
    vi.stubGlobal('fetch', answer(404, { error: 'battle_research_unavailable' }));
    await expect(fetchEvidence('b')).rejects.toEqual({ why: BR_COPY.whyOff });
    vi.stubGlobal('fetch', answer(500, { error: 'internal' }));
    await expect(fetchEvidence('b')).rejects.toEqual({ why: BR_COPY.whyQuotes });
    vi.stubGlobal('fetch', answer(200, { ...quotesBody(), servedAt: TAKEN_AT }));
    READS.rankingsFail = true;
    await expect(fetchEvidence('b')).rejects.toEqual({ why: BR_COPY.whyRankings });
  });
});
