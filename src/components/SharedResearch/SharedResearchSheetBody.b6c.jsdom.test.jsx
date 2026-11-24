// @vitest-environment jsdom
//
// Shared Research B6c X-10 — THE THESIS SAVED SCREEN SAYS WHAT EQUIPPING DOES. Where
// "Use it in my next game" is offered, a line sits above it:
//   - with the caller's `equippedListLabel`: "Replaces {list} as your equipped list."
//     (SR_COPY.replaces, the older idea screen's own line);
//   - with none: "This becomes your equipped list for your next game." — true whether
//     a list is equipped or not, so it never claims there is none;
//   - no agentId: no button and no line, as before.
// Rendered from the server's own answers (__fixtures__/thesisAnswers.json; the ledger's
// from answers.json). The label reaches the screen from the hub's props (its own
// equippedListLabelOf) and from Explore's (Q-2: `agent.equippedList?.name ?? null`,
// the read's agent shaped by the server's own exploreAgentOf). The older idea screen
// (Adopt.jsx SavedIdea) is unchanged: it keeps "You have no equipped list…".

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
const { equippedListLabelOf } = await import('../CommandCenter/hub/researchDoorView');
const { exploreAgentOf } = await import('../../../api/_utils/sharedResearch/store.js');
const { fakeServer, mount, flush, click, $, textOf } = kit;
const { A, IDS } = kit;
const B = COPY.builder;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mounted = [];
let server;
const keep = (m) => { mounted.push(m); return m; };
beforeEach(() => {
  server = fakeServer({ list: TA.listEmpty });
  fetchWithAuth.mockImplementation(server.fetch);
});
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; vi.clearAllMocks(); });

const SAVED = TA.walkGetSaved;
/** The sheet opened on a saved thesis (mode 'session'), with the props a caller passes. */
async function openSaved(props = {}, get = SAVED) {
  server.set('get', get);
  keep(mount(<Body mode="session" sessionId={get.body.session.sessionId} onClose={vi.fn()} phone {...props} />));
  await flush();
}
const line = () => $('[data-sr-equip-line]');
const equip = () => $('[data-sr-equip]');
/** The line sits directly above the button, in the same column. */
function expectLineAboveButton() {
  expect(line().parentElement).toBe(equip().parentElement);
  expect(line().nextElementSibling).toBe(equip());
}
const NO_LIST = /no equipped list|have none|no list/i;

describe('X-10: the line above "Use it in my next game" on the thesis saved screen', () => {
  it('with a label: "Replaces {list} as your equipped list.", above the button', async () => {
    await openSaved({ agentName: 'Atlas', agentId: 'agent-fixture-1', equippedListLabel: 'Grid builders' });
    expect($('[data-sr-thesis-saved]').textContent).toBe(B.saved);
    expect(line().textContent).toBe(COPY.replaces('Grid builders'));
    expect(line().textContent).toBe('Replaces Grid builders as your equipped list.');
    expect(equip().textContent).toContain(COPY.useNext);
    expectLineAboveButton();
  });
  it('with none: "This becomes your equipped list for your next game." — never that there is no list', async () => {
    for (const equippedListLabel of [null, undefined, '', '   ']) {
      server = fakeServer({ list: TA.listEmpty });
      fetchWithAuth.mockImplementation(server.fetch);
      await openSaved({ agentName: 'Atlas', agentId: 'agent-fixture-1', ...(equippedListLabel === undefined ? {} : { equippedListLabel }) });
      expect(line().textContent).toBe(COPY.becomesList);
      expect(line().textContent).toBe('This becomes your equipped list for your next game.');
      expect(line().textContent).not.toMatch(NO_LIST);
      expect(textOf()).not.toContain(COPY.noList);
      expectLineAboveButton();
      for (const m of mounted) m.unmount();
      mounted = [];
    }
  });
  it('no agentId: neither the line nor the button (null, absent, blank)', async () => {
    for (const agentId of [null, undefined, '']) {
      server = fakeServer({ list: TA.listEmpty });
      fetchWithAuth.mockImplementation(server.fetch);
      await openSaved({ agentName: 'Atlas', equippedListLabel: 'Grid builders', ...(agentId === undefined ? {} : { agentId }) });
      expect($('[data-sr-thesis-saved]')).not.toBeNull();
      expect(line()).toBeNull();
      expect(equip()).toBeNull();
      expect(textOf()).not.toContain(COPY.replaces('Grid builders'));
      expect(textOf()).not.toContain(COPY.becomesList);
      for (const m of mounted) m.unmount();
      mounted = [];
    }
  });
  it('the line goes with the offer: once equipped, "Equipped for your next game" and no line; the equip call is unchanged', async () => {
    transitionHypothesis.mockResolvedValue({ ok: true });
    equipLoadoutBook.mockResolvedValue({ equippedWatchlistId: SAVED.body.session.adoption.watchlistId });
    await openSaved({ agentName: 'Atlas', agentId: 'agent-fixture-1', equippedListLabel: 'Grid builders' });
    click(equip());
    await flush();
    expect(transitionHypothesis).toHaveBeenCalledWith(SAVED.body.session.adoption.watchlistId, { version: 1, action: 'ready', expectedStatus: 'researched' });
    expect(equipLoadoutBook).toHaveBeenCalledWith('agent-fixture-1', SAVED.body.session.adoption.watchlistId, 'baggerbomb');
    expect($('[data-sr-equipped]').textContent).toBe(COPY.equipped);
    expect(line()).toBeNull();
  });
  it('right after a save on this page, too (not only on a reopened thesis)', async () => {
    server.set('adopt', TA.walkSaved);
    await openSaved({ agentName: 'Atlas', agentId: 'agent-fixture-1', equippedListLabel: 'Grid builders' }, TA.walkGetReady);
    server.set('get', SAVED);
    expect($('[data-sr-thesis-saved]')).toBeNull(); // the ready card first
    click($('[data-sr-save-thesis]'));
    await flush();
    expect(server.sent('adopt')).toHaveLength(1);
    expect($('[data-sr-thesis-saved]')).not.toBeNull();
    expect(line().textContent).toBe(COPY.replaces('Grid builders'));
    expectLineAboveButton();
  });
});

describe('X-10 and Q-2: the label from each caller', () => {
  it('from the hub\'s props: the label the hub computes (equippedListLabelOf, the BaggerBomb card\'s book) is the list named', async () => {
    const scope = { agent: { id: 'agent-a', archetype: 'degen', loadouts: { baggerbomb: { archetype: 'degen', book: { ref: { watchlistId: 'wl-1' }, name: 'Stored name', pin: null } } } }, lock: null, lockFailed: false, activeBattles: [] };
    const label = equippedListLabelOf(scope, { committed: [{ watchlistId: 'wl-1', name: 'Grid builders', tickers: [] }] }, null);
    expect(label).toBe('Grid builders');
    await openSaved({ agentName: 'Atlas', agentId: 'agent-a', equippedListLabel: label });
    expect(line().textContent).toBe(COPY.replaces('Grid builders'));
    // a scope before the agent is read: no label, so the plain line
    for (const m of mounted) m.unmount();
    mounted = [];
    server = fakeServer({ list: TA.listEmpty });
    fetchWithAuth.mockImplementation(server.fetch);
    await openSaved({ agentName: 'Atlas', agentId: 'agent-a', equippedListLabel: equippedListLabelOf({ agent: null }, null, null) });
    expect(line().textContent).toBe(COPY.becomesList);
  });

  /** Q-2: Explore passes agent.id, agent.name and agent.equippedList?.name ?? null, from the read's `agent`. */
  const exploreProps = (agent) => ({ agentId: agent?.id ?? null, agentName: agent?.name ?? null, equippedListLabel: agent?.equippedList?.name ?? null });
  const AGENT_DOC = { id: 'agent-x', ownerId: 'u1', name: 'Atlas', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: { watchlistId: 'wl-bb' }, name: 'Grid builders', pin: null } } } };

  it('from Explore\'s props, a list with a name: the list named; equip targets the read\'s agent', async () => {
    transitionHypothesis.mockResolvedValue({ ok: true });
    equipLoadoutBook.mockResolvedValue({});
    const agent = exploreAgentOf(AGENT_DOC, 'u1');
    expect(agent).toEqual({ id: 'agent-x', name: 'Atlas', equippedList: { id: 'wl-bb', name: 'Grid builders' } });
    await openSaved(exploreProps(agent));
    expect(line().textContent).toBe(COPY.replaces('Grid builders'));
    expect($('[data-sr-honest]').textContent).toBe(B.honestLine('Atlas'));
    click(equip());
    await flush();
    expect(equipLoadoutBook).toHaveBeenCalledWith('agent-x', SAVED.body.session.adoption.watchlistId, 'baggerbomb');
  });
  it('from Explore\'s props, no list or a list with no name: the plain line', async () => {
    for (const doc of [
      { ...AGENT_DOC, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } },
      { ...AGENT_DOC, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: { watchlistId: 'wl-bb' }, name: '  ', pin: null } } } },
    ]) {
      server = fakeServer({ list: TA.listEmpty });
      fetchWithAuth.mockImplementation(server.fetch);
      await openSaved(exploreProps(exploreAgentOf(doc, 'u1')));
      expect(line().textContent).toBe(COPY.becomesList);
      expectLineAboveButton();
      for (const m of mounted) m.unmount();
      mounted = [];
    }
  });
  it('from Explore\'s props, no ranked agent (agent: null): no line, no button; the name falls back to "your agent"', async () => {
    await openSaved(exploreProps(exploreAgentOf(null, 'u1')));
    expect(line()).toBeNull();
    expect(equip()).toBeNull();
    expect($('[data-sr-honest]').textContent).toBe(B.honestLine(COPY.agentFallback));
  });
});

describe('the older idea screen is unchanged (Adopt.jsx SavedIdea)', () => {
  async function savedIdea(props) {
    server = fakeServer({ list: A.list, get: A.getShopPay, adopt: A.adoptSaved });
    fetchWithAuth.mockImplementation(server.fetch);
    keep(mount(<Body stories={[]} agentName="Atlas" agentId="agent-fixture-1" onClose={vi.fn()} mode="session" sessionId={IDS.spSid} {...props} />));
    await flush();
    click($('[data-sr-adopt]'));
    await flush();
    click($('[data-sr-horizon="positional"]'));
    click($('[data-sr-save-button]'));
    await flush();
    return $('[data-screen-label^="Idea saved"]');
  }
  it('with a label: "Replaces {list} as your equipped list."; with none: "You have no equipped list; this would become it…" — never the thesis screen\'s line', async () => {
    let screen = await savedIdea({ equippedListLabel: 'Grid builders' });
    expect(screen.textContent).toContain(COPY.replaces('Grid builders'));
    expect(line()).toBeNull();
    for (const m of mounted) m.unmount();
    mounted = [];
    screen = await savedIdea({ equippedListLabel: null });
    expect(screen.textContent).toContain(COPY.noList);
    expect(screen.textContent).not.toContain(COPY.becomesList);
    expect(line()).toBeNull();
  });
});
