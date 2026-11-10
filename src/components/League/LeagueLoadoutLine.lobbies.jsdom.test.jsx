// @vitest-environment jsdom
//
// src/components/League/LeagueLoadoutLine.lobbies.jsdom.test.jsx
//
// Build A2 fix pass — review A2R-1: the League lobby's loadout line never claims "Open" before the lobby's group read has
// answered, nor after it failed. The two real lobbies (phone LeagueHome, desktop LeagueLobbyDesktop) with
// PER_GAME_LOADOUT_ENABLED and AGENT_FORM_ARMORY_ENABLED held on here (both dark on main); the group read is driven by
// hand through the tournamentGroupService seam, so each row walks the lobby through: no answer yet → Checking, no door;
// answered "no group" → Open, the door; answered a ranked group → Locked; a failed read → Checking, for good, while the
// rest of the lobby shows what it shows today (no group, the Backing strip in its place).

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ subs: [], legacySubs: [] }));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_ARMORY_ENABLED: true }));
vi.mock('../../config/perGameLoadoutFlags', () => ({ PER_GAME_LOADOUT_ENABLED: true }));
vi.mock('../AgentForm/AgentForm', () => ({ default: () => null }));
vi.mock('../../hooks/useLeagueState', async () => {
  const { leagueState } = await import('./leagueFixtures');
  const st = leagueState('open');
  return { default: () => ({ state: st, loading: false, isFixtures: false }) };
});
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'me', displayName: 'Me' } }) }));
vi.mock('../../services/tournamentGroupService', () => ({
  subscribeMyGroupOrFailure: (uid, onGroup, onError) => { const s = { uid, onGroup, onError, live: true }; h.subs.push(s); return () => { s.live = false; }; },
  subscribeMyGroup: (uid, cb) => { h.legacySubs.push({ uid, cb }); return () => {}; },
  subscribeMyTrainingPod: () => () => {},
  subscribeMyMostRecentVoidedGroup: () => () => {},
}));
vi.mock('../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => Promise.resolve({}), mapLobbyError: () => 'error' }));
vi.mock('../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }), claimSlot: () => Promise.resolve({}), releaseSlot: () => Promise.resolve({}), mapSlotActionError: () => 'error',
}));
vi.mock('./LoadoutChooserSheet', () => ({ default: () => null }));
vi.mock('./backing/BackingLandingStrip', () => ({ default: () => <i data-backing-strip="" /> }));
vi.mock('./backing/BackingScreen', () => ({ default: () => null }));
vi.mock('../../services/backingService', () => ({ fetchTapePod: async () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({}) })) }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));

const { default: LeagueHome } = await import('./LeagueHome');
const { default: LeagueLobbyDesktop } = await import('./LeagueLobbyDesktop');
const { LeagueLoadoutLine } = await import('./LeagueLoadoutLine');
const { LobbyTabbed } = await import('./LeagueLobbyRedesign');
const { LeagueGroupKnownContext } = await import('./leagueLoadoutSlot');
const { leagueState } = await import('./leagueFixtures');
const { LOADOUT_COPY } = await import('../../constants/loadoutCopy');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
let errorSpy;
beforeEach(() => {
  h.subs = [];
  h.legacySubs = [];
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  errorSpy.mockRestore();
});

const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
async function render(element) {
  await act(async () => { root.render(element); });
  await settle();
}
const live = () => h.subs.filter((s) => s.live);
async function answer(group) { await act(async () => { for (const s of live()) s.onGroup(group); }); await settle(); }
async function fail() { await act(async () => { for (const s of live()) s.onError(new Error('permission-denied')); }); await settle(); }

const LOADOUT = (over = {}) => ({ name: 'Nova', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', openLoadout: vi.fn(), ...over });
const LOCKED_GROUP = { id: 'g-1', status: 'battle', groupMembers: ['me'], updatedAt: '2026-11-04', startAnchor: { anchorEtDate: '2026-11-02' } };
const line = () => host.querySelector('[data-league-loadout]');
const state = () => line()?.querySelector('[data-league-loadout-state]')?.getAttribute('data-league-loadout-state') ?? null;

describe('A2R-1: the line itself', () => {
  it('group={null} with groupKnown: answered "no group" → Open, with its door', async () => {
    await render(<LeagueLoadoutLine agentLoadout={LOADOUT()} group={null} groupKnown accent="#5EEAD4" />);
    expect(state()).toBe('open');
    expect(line().tagName).toBe('BUTTON');
  });

  it('groupKnown={false} → Checking, no door, whatever group it is handed', async () => {
    for (const group of [null, LOCKED_GROUP]) {
      await render(<LeagueLoadoutLine agentLoadout={LOADOUT()} group={group} groupKnown={false} accent="#5EEAD4" />);
      expect(state()).toBe('checking');
      expect(line().tagName).toBe('SECTION');
      expect(line().getAttribute('aria-busy')).toBe('true');
      expect(line().textContent).toContain(LOADOUT_COPY.lines.checking);
      expect(line().textContent).not.toContain(LOADOUT_COPY.leagueOpen);
      expect(host.querySelector('button')).toBeNull();
    }
  });

  it('no groupKnown at all fails closed: Checking (a lobby that provides nothing never reads as open)', async () => {
    await render(<LeagueLoadoutLine agentLoadout={LOADOUT()} group={null} accent="#5EEAD4" />);
    expect(state()).toBe('checking');
    await render(<LobbyTabbed st={leagueState('open')} accent="#5EEAD4" tab="ranked" onSwitchTab={() => {}} hasAgent agentLoadout={LOADOUT()} uid="me" onOpenTrainingPod={() => {}} />);
    expect(state()).toBe('checking');
  });
});

for (const [site, Lobby] of [['phone (LeagueHome)', LeagueHome], ['desktop (LeagueLobbyDesktop)', LeagueLobbyDesktop]]) {
  describe(`A2R-1: the ${site} lobby`, () => {
    it('reads the group through the failure-aware read, not subscribeMyGroup', async () => {
      await render(<Lobby onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={LOADOUT()} />);
      expect(live().map((s) => s.uid)).toEqual(['me']);
      expect(h.legacySubs).toEqual([]);
    });

    it('before the first answer: Checking, no door; then answered "no group": Open with the door; then a ranked group: Locked', async () => {
      await render(<Lobby onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={LOADOUT()} />);
      expect(state()).toBe('checking');
      expect(line().tagName).toBe('SECTION');
      await answer(null);
      expect(state()).toBe('open');
      expect(line().tagName).toBe('BUTTON');
      await answer(LOCKED_GROUP);
      expect(state()).toBe('locked');
      expect(line().textContent).toContain('Locked until the week is scored, after the close on Fri Nov 6');
    });

    it('a failed read: Checking for good, never Open; the lobby otherwise shows today\'s no-group view, the strip in its place', async () => {
      await render(<Lobby onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={LOADOUT()} />);
      expect(host.querySelector('[data-backing-strip]')).toBeNull(); // the seat is not known yet (WIRE-7)
      await fail();
      expect(state()).toBe('checking');
      expect(line().tagName).toBe('SECTION');
      expect(host.querySelector('[data-backing-strip]')).not.toBeNull(); // as today: a failed read mounts the strip
    });

    it('a failure after an answer goes back to Checking (the read can no longer vouch for the week)', async () => {
      await render(<Lobby onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={LOADOUT()} />);
      await answer(null);
      expect(state()).toBe('open');
      await fail();
      expect(state()).toBe('checking');
    });
  });
}

describe('A2R-1: the lobby\'s context reaches the slot', () => {
  it('LobbyTabbed under a provider that says known: the group decides', async () => {
    const tabbed = (group) => (
      <LeagueGroupKnownContext.Provider value>
        <LobbyTabbed st={leagueState('open')} accent="#5EEAD4" tab="ranked" onSwitchTab={() => {}} hasAgent agentLoadout={LOADOUT()} uid="me" onOpenTrainingPod={() => {}} activeGroup={group} />
      </LeagueGroupKnownContext.Provider>
    );
    await render(tabbed(null));
    expect(state()).toBe('open');
    await render(tabbed(LOCKED_GROUP));
    expect(state()).toBe('locked');
  });
});
