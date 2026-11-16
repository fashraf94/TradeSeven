// @vitest-environment jsdom
//
// League hide (direction note BB-1; founder ruling Q3, Nov 15, 2026) — the hub's Loadout tab. With LEAGUE_HIDE_ENABLED on, the
// League loadout card is not rendered, the BaggerBomb card is the one loadout (still editable: its doors open the hub's
// archetype and book sheets for the BaggerBomb loadout), and the League lock read — a live Firestore subscription the
// loadout scope starts for the owner — does not run. With it off (as shipped) both cards render and the lock is read: the
// control that shows these rows can see what they pin.
//
// The two components are the real LoadoutCards and PerGameLoadoutScope; the League lock's client read is a spy and the
// agent's still a stand-in (no canvas in jsdom). The flag is put on through a module mock read at render time; the constant
// itself is never asserted here (the pin is src/config/leagueHideFlag.test.js).

import React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ hide: false, lockSubs: [] }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get LEAGUE_HIDE_ENABLED() { return h.hide; },
}));
vi.mock('../../services/leagueLockService', () => ({
  subscribeLeagueLock: (uid, onLock, onError) => { const sub = { uid, onLock, onError, live: true }; h.lockSubs.push(sub); return () => { sub.live = false; }; },
}));
vi.mock('../AgentForm/LoadoutStill', () => ({
  default: function StillStandIn({ archetype }) { return <span data-still={archetype} />; },
  STILL_PX: { card: 48, line: 40 },
}));

import LoadoutCards from './LoadoutCards';
import PerGameLoadoutScope from './PerGameLoadoutScope';
import { mount } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const AGENT = {
  id: 'agent-a', ownerId: 'uid-A', name: 'Nova', archetype: 'contrarian', equippedWatchlistId: null, equippedWatchlistName: null,
  loadouts: { baggerbomb: { archetype: 'degen', book: { ref: null, name: null, pin: null } } },
};
const READ = { status: 'ready', agent: AGENT };

let mounted;
beforeEach(() => { h.hide = false; h.lockSubs = []; mounted = []; });
afterEach(() => { for (const m of mounted) m.unmount(); });

function render(agentRead = READ) {
  const doors = { archetype: vi.fn(), book: vi.fn(), forge: vi.fn() };
  const m = mount(
    <PerGameLoadoutScope agentRead={agentRead} activeBattles={[]}>
      <LoadoutCards onOpenArchetype={doors.archetype} onOpenBook={doors.book} onOpenForge={doors.forge} />
    </PerGameLoadoutScope>,
  );
  mounted.push(m);
  return { m, doors };
}
const cards = () => [...document.querySelectorAll('[data-loadout-card]')].map((el) => el.getAttribute('data-loadout-card'));
const card = (kind) => document.querySelector(`[data-loadout-card="${kind}"]`);

describe('league hide, hub Loadout tab — the flag ON', () => {
  beforeEach(() => { h.hide = true; });

  it('renders the BaggerBomb card alone: no League card, no League words', () => {
    render();
    expect(cards()).toEqual(['baggerbomb']);
    expect(card('league')).toBeNull();
    expect(document.querySelector('[data-loadout-cards]').textContent).not.toMatch(/league/i);
  });

  it('the League lock read does not run: no subscription is started, for any owner', () => {
    render();
    expect(h.lockSubs).toEqual([]);
  });

  it('the BaggerBomb card is the one loadout and stays editable: neither checking nor locked, and its doors open the hub\'s sheets for it', () => {
    const { doors } = render();
    const bb = card('baggerbomb');
    expect(['checking', 'locked']).not.toContain(bb.getAttribute('data-loadout-state'));
    const armor = bb.querySelector('[data-loadout-row="armor"]');
    const book = bb.querySelector('[data-loadout-row="book"]');
    expect(armor.tagName).toBe('BUTTON');
    expect(book.tagName).toBe('BUTTON');
    act(() => { armor.click(); });
    act(() => { book.click(); });
    expect(doors.archetype).toHaveBeenCalledTimes(1);
    expect(doors.book).toHaveBeenCalledTimes(1);
  });

  it('with no agent read yet the tab is its loading line, as before', () => {
    render({ status: 'loading', agent: null });
    expect(cards()).toEqual([]);
    expect(h.lockSubs).toEqual([]);
  });
});

describe('league hide, hub Loadout tab — the flag OFF (as shipped): the control', () => {
  it('both cards render, BaggerBomb first, and the League lock is read for the owner', () => {
    render();
    expect(cards()).toEqual(['baggerbomb', 'league']);
    expect(h.lockSubs.map((s) => s.uid)).toEqual(['uid-A']);
    // Until the lock answers the League card says it is checking: the state the hidden card never shows.
    expect(card('league').getAttribute('data-loadout-state')).toBe('checking');
  });

  it('the same component answers a flip at render time: ON hides the League card in place', () => {
    const { m } = render();
    expect(cards()).toEqual(['baggerbomb', 'league']);
    h.hide = true;
    m.rerender(
      <PerGameLoadoutScope agentRead={READ} activeBattles={[]}>
        <LoadoutCards onOpenArchetype={vi.fn()} onOpenBook={vi.fn()} onOpenForge={vi.fn()} />
      </PerGameLoadoutScope>,
    );
    expect(cards()).toEqual(['baggerbomb']);
  });
});
