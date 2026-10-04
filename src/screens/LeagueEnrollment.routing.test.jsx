// @vitest-environment jsdom
// Real LeagueScreen -> real desktop/mobile lobby -> real participant router.
// Only data/auth and unrelated battle bodies are stubbed. No production writes.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildLeagueState } from '../components/League/leagueAdapter';
import { selectMyGroup } from '../constants/leagueTournament';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const state = vi.hoisted(() => ({
  group: null, board: null, desktop: true, liveDraft: true, preOpen: false,
  battle: null, arena: false, listeners: new Set(),
  schedule: vi.fn(), claim: vi.fn(), release: vi.fn(), boardRead: vi.fn(),
  quickPlay: vi.fn(), training: vi.fn(),
}));
vi.mock('../config/featureFlags', async (original) => ({
  ...await original(), LEAGUE_REDESIGN_ENABLED: true,
  get LEAGUE_LIVE_DRAFT() { return state.liveDraft; },
}));
vi.mock('../contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u1', displayName: 'Alice' } }) }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ tokens: {
  bgApp: '#0d0e12', bgCard: '#15171e', textPrimary: '#e2e8f0', textMuted: '#999',
  textFaint: '#888', borderDivider: '#333', teal: '#5eead4', medalGold: '#ddd',
} }) }));
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => ({ isDesktop: state.desktop, isMobile: !state.desktop }) }));
vi.mock('../hooks/useLeagueState', () => ({ default: () => ({ state: buildLeagueState({}).state, loading: false, isFixtures: false }) }));
vi.mock('../hooks/useMyTournamentBattle', () => ({ default: () => ({ battle: state.battle, chain: [] }) }));
vi.mock('../hooks/usePreOpenPhase', () => ({ default: () => state.preOpen }));
vi.mock('../services/tournamentGroupService', () => ({
  subscribeMyGroup: (_uid, cb) => { state.listeners.add(cb); cb(state.group); return () => state.listeners.delete(cb); },
  subscribeMyTrainingPod: (_uid, cb) => { cb(null); return () => {}; },
  subscribeMyMostRecentVoidedGroup: (_uid, cb) => { cb(null); return () => {}; },
  subscribeMyMostRecentCompletedGroup: (_uid, cb) => { cb(null); return () => {}; },
  subscribeBracket: (_id, cb) => { cb(null); return () => {}; },
  subscribeRank: (_id, cb) => { cb(null); return () => {}; },
  subscribeOwnBoard: (...args) => { state.boardRead(...args.slice(0, 2)); args[2](state.board); return () => {}; },
}));
vi.mock('../services/liveDraftActions', () => ({
  fetchSlotSchedule: (...args) => state.schedule(...args),
  claimSlot: (...args) => state.claim(...args), releaseSlot: (...args) => state.release(...args),
  mapSlotActionError: (e) => e.message,
}));
vi.mock('../services/tournamentLobbyActions', () => ({ quickPlay: (...a) => state.quickPlay(...a), quickPlayTraining: (...a) => state.training(...a), mapLobbyError: (e) => e.message }));
vi.mock('../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({}) })) }));
vi.mock('../utils/roundBoundaryAck', () => ({ rememberBracketGameId: () => {}, getRememberedBracketGameId: () => null, isRoundBoundaryAcknowledged: () => false, acknowledgeRoundBoundary: () => {} }));
vi.mock('../components/League/LoadoutChooserSheet', () => ({ default: () => null }));
vi.mock('../components/League/backing/BackingLandingStrip', () => ({ default: () => null }));
vi.mock('../components/League/backing/BackingScreen', () => ({ default: () => null }));
vi.mock('../components/League/backing/useHasStaked', () => ({ default: () => false }));
vi.mock('../services/backingService', () => ({
  fetchBackingPods: async () => ({ pods: [] }), fetchTeamCard: vi.fn(), placeStake: vi.fn(), attestEligibility: vi.fn(), savePitch: vi.fn(),
  newRequestId: () => 'req', subscribeMyStakes: () => () => {}, subscribePool: () => () => {}, subscribeWallet: () => () => {},
  readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null,
  fetchBackingResults: async () => ({ weeks: [] }), fetchMyBackingStats: async () => null, fetchTrainerStats: async () => null, postBackingEvent: async () => ({}),
  BackingApiError: class extends Error {},
}));
vi.mock('../components/Tournament/BoardEditor', () => ({ default: ({ groupId }) => <div>Board editor for {groupId}</div> }));
vi.mock('../components/Tournament/Flat6BattleView', () => ({ default: () => <div>Classic battle</div> }));
vi.mock('../components/Tournament/ClaimFlipWindow', () => ({ default: ({ group }) => <div>Claim controls for {group.id}</div> }));
vi.mock('../components/Tournament/DraftPlaybackTheater', () => ({ default: () => null }));
vi.mock('../components/Tournament/GroupFeed', () => ({ default: () => null }));
vi.mock('../components/League/draft/DraftBoardRoom', () => ({ default: ({ groupId, mode }) => <div>Interactive draft {groupId} {mode}</div> }));
vi.mock('../components/League/battleArena/arenaLiveGate', () => ({ get ARENA_LIVE_ON() { return state.arena; } }));
vi.mock('../components/League/battleArena/LeagueBattleArenaLive', () => ({ default: ({ group }) => <div>Arena with claims {group.id}</div> }));
vi.mock('../components/League/battleArena/LeagueBattleArena', () => ({ default: () => null }));
vi.mock('../components/League/LeagueClimb', () => ({ default: () => null }));
vi.mock('../components/League/LeagueVoidedNotice', () => ({ default: () => null }));
vi.mock('../components/League/LeagueRecapEntry', () => ({ default: () => null }));

const { default: LeagueScreen } = await import('./LeagueScreen');
const { default: Participant } = await import('./LeagueParticipantView');
const { default: SlotCenter } = await import('../components/League/liveDraft/SlotCenter');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const slot = { slotId: 'sun-1900', label: 'Sun 7:00pm ET', humanCount: 0, seats: [], groupId: 'slot-group' };
const legacy = () => ({ id: 'original-registration', status: 'forming', baseLayerWeek: '2026-W41', groupMembers: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'], players: [] });
const scheduled = () => ({ ...legacy(), id: 'slot-group', isLiveDraft: true, scheduledDraftAt: '2026-10-04T23:00:00.000Z', groupMembers: ['u1', 'u2'], seatNames: { u1: 'Alice', u2: 'Bob' } });
let root, container;
// Optional visual artifacts from these same real-component mounts. These are
// fixture renders, not an authenticated production smoke or a live registration.
function capture(name) {
  const out = process.env.LEAGUE_SCREENSHOT_DIR;
  if (!out) return;
  mkdirSync(out, { recursive: true });
  const css = ['src/theme/tokens.css', 'src/components/League/league.css'].map(f => readFileSync(path.resolve(f), 'utf8')).join('\n');
  writeFileSync(path.join(out, `${state.desktop ? 'desktop' : 'mobile'}-${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>League enrollment fixture: ${name}</title><style>${css}\nhtml,body{margin:0;background:var(--ft-bg-dashboard);color:var(--ft-text-primary);font-family:Arial,sans-serif}*{box-sizing:border-box}button{font-family:inherit}</style></head><body>${container.innerHTML}</body></html>`);
}
async function mount(el) {
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container); await act(async () => root.render(el));
}
async function unmount() {
  if (root) await act(async () => root.unmount());
  container?.remove(); root = null;
}
async function press(label) {
  const buttons = [...container.querySelectorAll('button')].filter(b => label === 'Open my game' ? b.textContent.startsWith(label) : b.textContent.trim() === label);
  expect(buttons.length, `button ${label}`).toBeGreaterThan(0);
  await act(async () => buttons[0].click());
}
async function publish(group) {
  await act(async () => { state.group = group; for (const cb of state.listeners) cb(group); });
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-04T18:00:00.000Z'));
  vi.clearAllMocks(); state.group = null; state.board = null; state.desktop = true;
  state.liveDraft = true; state.preOpen = false; state.battle = null; state.arena = false;
  state.schedule.mockReset().mockResolvedValue({ slots: [slot] });
  state.claim.mockReset().mockImplementation(async () => {
    state.group = scheduled(); for (const cb of state.listeners) cb(state.group);
    return { groupId: state.group.id };
  });
  state.release.mockReset().mockImplementation(async () => {
    state.group = null; for (const cb of state.listeners) cb(null);
  });
});
afterEach(async () => { await unmount(); vi.useRealTimers(); });

describe.each([true, false])('ranked entry on desktop=%s', (desktop) => {
  it('claims only a scheduled slot; back and remount return to the same countdown and seat', async () => {
    state.desktop = desktop;
    const screen = <LeagueScreen isDesktop={desktop} hasAgent />;
    await mount(screen);
    capture('entry');
    expect(container.textContent).toContain('Choose a draft time. If you miss it, your picks are drafted automatically.');
    expect(container.textContent).not.toMatch(/Auto-draft|Quick Play|Play now|Find me a game/);
    await press('Claim seat');
    expect(state.claim).toHaveBeenCalledExactlyOnceWith({ slotId: slot.slotId, displayName: 'Alice' });
    expect(container.textContent).toContain('Draft countdown');
    expect(container.textContent).toContain('Your seat is held');
    capture('countdown');
    const saved = structuredClone(state.group);
    await press('League'); await press('Open my game');
    expect(container.textContent).toContain('Draft countdown');
    await unmount(); await mount(screen); await press('Open my game');
    expect(container.textContent).toContain('Draft countdown');
    expect(state.group).toEqual(saved); expect(state.claim).toHaveBeenCalledTimes(1);
    expect(state.quickPlay).not.toHaveBeenCalled();
  });
  it.each([null, { board: ['NVDA', 'AMD'], committedAt: '2026-10-01' }])('preserves an existing registration and board %j through waiting and BATTLE', async (board) => {
    state.desktop = desktop; state.group = legacy(); state.board = board;
    const registration = structuredClone(state.group), savedBoard = structuredClone(board);
    await mount(<LeagueScreen isDesktop={desktop} hasAgent />); await press('Open my game');
    expect(container.textContent).toContain('Your registration is saved');
    capture(board ? 'legacy-committed' : 'legacy-missing');
    expect(container.textContent).not.toMatch(/Edit & re-commit|Board editor|Draft countdown|Leave this slot|Claim seat/);
    await press('League'); await press('Open my game');
    expect(state.group).toEqual(registration); expect(state.board).toEqual(savedBoard);
    expect(state.boardRead).not.toHaveBeenCalled(); expect(state.claim).not.toHaveBeenCalled(); expect(state.release).not.toHaveBeenCalled();
    await publish({ ...registration, status: 'battle' });
    expect(container.textContent).toContain('Claim controls for original-registration');
    expect(container.textContent).not.toContain('Your registration is saved');
  });
});

it('participant fallback has only scheduled enrollment, including flag-off unavailable state', async () => {
  await mount(<Participant />);
  expect(container.textContent).toContain('Pick a draft slot');
  expect(container.textContent).not.toMatch(/Quick Play|Create a group|Find me a game|Auto-draft/);
  await unmount(); state.liveDraft = false; state.schedule.mockClear();
  await mount(<Participant />);
  expect(container.textContent).toContain('Scheduled draft enrollment is unavailable');
  expect(state.schedule).not.toHaveBeenCalled(); expect(state.quickPlay).not.toHaveBeenCalled();
});
it('flag-off entry remains unavailable on both redesigned lobbies', async () => {
  state.liveDraft = false;
  for (const desktop of [true, false]) {
    await mount(<LeagueScreen isDesktop={desktop} hasAgent />);
    expect(container.textContent).toContain('Scheduled draft enrollment is unavailable');
    expect(container.textContent).not.toMatch(/Auto-draft|Claim seat|Quick Play/);
    await unmount();
  }
  expect(state.schedule).not.toHaveBeenCalled();
});
it('loading, empty, failed, disabled and full schedules never offer the retired fallback; retry recovers', async () => {
  state.schedule.mockImplementationOnce(() => new Promise(() => {}));
  await mount(<SlotCenter currentUserId="u1" />);
  expect(container.textContent).toContain('Loading slots'); await unmount();
  state.schedule.mockResolvedValueOnce({ slots: [] }); await mount(<SlotCenter currentUserId="u1" />);
  expect(container.textContent).toContain('No draft slots scheduled'); await unmount();
  state.schedule.mockRejectedValueOnce(new Error('Could not load slots')); await mount(<SlotCenter currentUserId="u1" />);
  expect(container.querySelector('[role="alert"]').textContent).toContain('Could not load slots');
  expect(container.textContent).not.toContain('No draft slots scheduled');
  state.schedule.mockResolvedValueOnce({ slots: [{ ...slot, enabled: false }, { ...slot, slotId: 'full', isFull: true }] });
  await press('Retry slots');
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect([...container.querySelectorAll('button')].every(b => b.disabled)).toBe(true);
  expect(container.textContent).not.toContain('Auto-draft');
});
it('claim failure shows feedback and does not navigate; success is independent of a schedule refetch', async () => {
  const entered = vi.fn(); state.claim.mockRejectedValueOnce(new Error('You already have a game for this battle week.'));
  await mount(<SlotCenter currentUserId="u1" onEntered={entered} />); await press('Claim seat');
  expect(container.textContent).toContain('You already have a game'); expect(entered).not.toHaveBeenCalled();
  state.schedule.mockImplementation(() => new Promise(() => {}));
  await press('Claim seat'); expect(entered).toHaveBeenCalledTimes(1);
});
it('leaving a scheduled seat with live draft enabled returns to entry', async () => {
  state.group = scheduled();
  await mount(<Participant />); expect(container.textContent).toContain('Draft countdown');
  await press('Leave this slot'); expect(state.release).toHaveBeenCalledExactlyOnceWith({ groupId: 'slot-group' });
  expect(container.textContent).toContain('Pick a draft slot');
});
it('flag-off keeps an existing seat readable; the disabled release endpoint cannot remove it', async () => {
  state.group = scheduled(); state.liveDraft = false;
  const saved = structuredClone(state.group);
  state.release.mockRejectedValueOnce(new Error('Live draft is not available.'));
  await mount(<Participant />); expect(container.textContent).toContain('Draft countdown');
  await press('Leave this slot');
  expect(state.release).toHaveBeenCalledExactlyOnceWith({ groupId: 'slot-group' });
  expect(state.group).toEqual(saved); expect(container.textContent).toContain('Draft countdown');
});
it('bracket boards, the interactive draft, awaiting-open and pre-open claim routes retain their own handling', async () => {
  state.group = { ...legacy(), id: 'bracket-group', baseLayerWeek: null, bracketGameId: 'cup-r2-g1' };
  await mount(<Participant />); expect(container.textContent).toContain('Board editor for bracket-group');
  await publish({ ...scheduled(), status: 'drafting' }); expect(container.textContent).toContain('Interactive draft slot-group competitive');
  await publish({ ...scheduled(), status: 'awaiting_open' }); expect(container.textContent).toContain('Trading opens');
  state.preOpen = true;
  await publish({ ...scheduled(), status: 'battle' }); expect(container.textContent).toContain('Claim controls for slot-group');
  state.arena = true; state.battle = { id: 'battle' };
  await publish({ ...state.group }); expect(container.textContent).toContain('Arena with claims slot-group');
});
it('training registrations stay excluded from ranked selection and the waiting-summary predicate', async () => {
  const training = { ...legacy(), isTraining: true };
  expect(selectMyGroup([training])).toBeNull();
  state.group = training; await mount(<Participant />);
  expect(container.textContent).not.toContain('Your registration is saved');
  expect(container.textContent).toContain('Board editor for original-registration');
});
