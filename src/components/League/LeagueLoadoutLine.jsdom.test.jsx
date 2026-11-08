// @vitest-environment jsdom
//
// src/components/League/LeagueLoadoutLine.jsdom.test.jsx
//
// Build A2 — board 3, the League lobby's loadout lines (FD-2, FD-3, FD-4), with PER_GAME_LOADOUT_ENABLED and
// AGENT_FORM_ARMORY_ENABLED held on here (both dark on main), the agent form wrapper a recording stand-in:
//   - the League tab's line: the set's 40 px still, the book, and the lock state from the player's ranked group (the
//     writers' own rule); a door to the Command Center only while the loadout is open; locked, the lock and the week's
//     end and nothing tappable;
//   - the Training tab's line: "Training uses your League loadout", no door, where to change it;
//   - the lobbies, phone and desktop: the Customize loadout button and its sheet are gone, the Training line stands in
//     their place (loaded through the folded lazy slot), and the League tab carries the League line; flag off, as before.

import React, { Component, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ perGame: { on: true }, stills: [] }));
vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_ARMORY_ENABLED: true }));
vi.mock('../../config/perGameLoadoutFlags', () => ({ get PER_GAME_LOADOUT_ENABLED() { return h.perGame.on; } }));
vi.mock('../AgentForm/AgentForm', () => ({
  default: class StillProbe extends Component {
    componentDidMount() { h.stills.push(this.props); }
    render() { return null; }
  },
}));
vi.mock('../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => Promise.resolve({}), mapLobbyError: () => 'error' }));
vi.mock('../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }), claimSlot: () => Promise.resolve({}), releaseSlot: () => Promise.resolve({}), mapSlotActionError: () => 'error',
}));
vi.mock('./LoadoutChooserSheet', () => ({ default: () => <i data-chooser="" /> }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));

const { LeagueLoadoutLine, TrainingLoadoutLine } = await import('./LeagueLoadoutLine');
const { LobbyTabbed } = await import('./LeagueLobbyRedesign');
const { DeskTrainingPanel } = await import('./LeagueDeskParts');
const { leagueState } = await import('./leagueFixtures');
const { getArchetypeDisplayName } = await import('../../data/archetypeDisplay');
const { LOADOUT_COPY } = await import('../../constants/loadoutCopy');
const { LeagueGroupKnownContext } = await import('./leagueLoadoutSlot');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
beforeEach(() => {
  h.perGame.on = true;
  h.stills = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render(element) {
  await act(async () => { root.render(element); });
  // the folded lazy slot's chunk, and its Suspense
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
}

const LOADOUT = (over = {}) => ({ name: 'Nova', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', ...over });
const LOCKED_GROUP = { id: 'g-1', status: 'battle', groupMembers: ['me'], updatedAt: '2026-11-04', startAnchor: { anchorEtDate: '2026-11-02' } };
const button = (name) => [...host.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent).includes(name)) || null;

describe('the League tab\'s line', () => {
  it('open: the set\'s still, the book, "Open · locks when you register", and a door to the Command Center', async () => {
    const openLoadout = vi.fn();
    await render(<LeagueLoadoutLine agentLoadout={LOADOUT({ openLoadout })} group={null} groupKnown accent="#5EEAD4" />);
    const line = host.querySelector('[data-league-loadout]');
    expect(line.textContent).toContain(LOADOUT_COPY.leagueEyebrow);
    expect(line.textContent).toContain(`${getArchetypeDisplayName('contrarian')} · Industrials`);
    expect(line.querySelector('[data-league-loadout-state]').getAttribute('data-league-loadout-state')).toBe('open');
    expect(line.textContent).toContain('Open · locks when you register');
    expect(h.stills.map((p) => [p.archetype, p.size, p.rate])).toEqual([['contrarian', 40, 'still']]);
    expect(line.tagName).toBe('BUTTON');
    expect(line.getAttribute('aria-label')).toBe(LOADOUT_COPY.leagueDoor);
    await act(async () => { line.click(); });
    expect(openLoadout).toHaveBeenCalledTimes(1);
  });

  it('locked by the player\'s ranked group: the lock and the week\'s end; no door', async () => {
    await render(<LeagueLoadoutLine agentLoadout={LOADOUT({ openLoadout: vi.fn() })} group={LOCKED_GROUP} groupKnown accent="#5EEAD4" />);
    const line = host.querySelector('[data-league-loadout]');
    expect(line.tagName).toBe('SECTION');
    expect(line.querySelector('[data-league-loadout-state]').getAttribute('data-league-loadout-state')).toBe('locked');
    expect(line.textContent).toContain('Locked until the week is scored, after the close on Fri Nov 6');
    expect(host.querySelector('button')).toBeNull();
  });

  it('a training pod in flight never locks it; no book reads the open market', async () => {
    await render(<LeagueLoadoutLine agentLoadout={LOADOUT({ equippedWatchlistId: null, equippedWatchlistName: null })} group={{ ...LOCKED_GROUP, isTraining: true }} groupKnown accent="#5EEAD4" />);
    // (the lobby passes subscribeMyGroup's answer, which never holds a training pod; the rule refuses one regardless)
    expect(host.querySelector('[data-league-loadout-state]').getAttribute('data-league-loadout-state')).toBe('open');
    expect(host.textContent).toContain('No book · open market');
  });
});

describe('the Training tab\'s line (FD-4)', () => {
  it('"Training uses your League loadout", the same set and book, no door, and where to change it', async () => {
    await render(<TrainingLoadoutLine agentLoadout={LOADOUT()} />);
    const line = host.querySelector('[data-training-loadout]');
    expect(line.textContent).toContain('Training uses your League loadout');
    expect(line.textContent).toContain(`${getArchetypeDisplayName('contrarian')} · Industrials`);
    expect(line.textContent).toContain('Change it on the League tab, between weeks.');
    expect(line.querySelector('button')).toBeNull();
  });
});

describe('the lobbies (FD-4): the Customize loadout button and its sheet are gone', () => {
  const phone = (tab, extra = {}) => <LobbyTabbed st={leagueState('open')} accent="#5EEAD4" tab={tab} onSwitchTab={() => {}} hasAgent agentLoadout={LOADOUT()} uid="me" onOpenTrainingPod={() => {}} {...extra} />;
  const desk = () => <DeskTrainingPanel hasAgent agentLoadout={LOADOUT()} uid="me" onOpenTrainingPod={() => {}} />;

  it('the phone Training tab: the Training line in the button\'s place, no chooser', async () => {
    await render(phone('training'));
    expect(button('Customize loadout')).toBeNull();
    expect(host.querySelector('[data-chooser]')).toBeNull();
    expect(host.querySelector('[data-training-loadout]')).not.toBeNull();
  });

  it('the desktop Training panel: the same', async () => {
    await render(desk());
    expect(button('Customize loadout')).toBeNull();
    expect(host.querySelector('[data-chooser]')).toBeNull();
    expect(host.querySelector('[data-training-loadout]')).not.toBeNull();
  });

  it('the phone League tab carries the League line, locked by the active group', async () => {
    // the lobby (LeagueHome) provides whether its group read answered (A2R-1); here it has
    await render(<LeagueGroupKnownContext.Provider value>{phone('ranked', { activeGroup: LOCKED_GROUP })}</LeagueGroupKnownContext.Provider>);
    expect(host.querySelector('[data-league-loadout]')).not.toBeNull();
    expect(host.querySelector('[data-league-loadout-state]').getAttribute('data-league-loadout-state')).toBe('locked');
  });

  it('flag off: the Customize loadout button and its sheet, as before; no line', async () => {
    h.perGame.on = false;
    await render(phone('training'));
    expect(button('Customize loadout')).not.toBeNull();
    expect(host.querySelector('[data-chooser]')).not.toBeNull();
    expect(host.querySelector('[data-training-loadout]')).toBeNull();
  });
});
