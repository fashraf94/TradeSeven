// @vitest-environment jsdom
// src/components/League/backing/backingMobilePin.test.jsx
//
// THE MOBILE PIN (Backing desktop layouts, build item A): the desktop build is
// LAYOUT ONLY, and "mobile stays byte-identical to today — a test pins it".
// This is that test.
//
// Every mobile backing surface, and every League host the desktop build had to
// open (SlotCenter, WhileYouWait, the draft-slot picker, the Auto-draft lane —
// shared by the two viewports), is rendered here from fixed fixtures at a fixed
// clock, and its markup's sha-256 is compared with the golden beside this file
// (__fixtures__/backingMobilePin.golden.json). THE GOLDEN WAS GENERATED ON THE
// UNTOUCHED TREE — main @ 97693a41, before any desktop edit — so a green row
// means the mobile markup is the markup main ships, byte for byte (but for the
// 22 rows N3 moved on purpose — below). A row that reds names the surface;
// regenerate on a `git archive` of main and diff the markup to see what moved.
//
// Both flag states where the host is a landing (the flag-off mobile League is
// held here too — the shared hosts changed shape), the lit state for every
// backing surface. Two render modes: react-dom/server for what renders
// without effects, a jsdom mount (act) for what needs them — a seated viewer
// (the group subscription answers), the slot picker's schedule, the Backing
// screen's card and stake views, a Confirm pressed.
//
// Regenerate (only ever on main's code): UPDATE_BACKING_PINS=1 npx vitest run
// src/components/League/backing/backingMobilePin.test.jsx
//
// REGENERATED ONCE, FOR N3 (Backing pre-flip fixes 2 — the mobile strip moved
// to its ruled place, directly under the ranked-entry position). 22 of the 96
// rows moved, every one a lit landing or a seated presentational lobby:
// `landing/{bracket,no-bracket}/on/{unseated-mounted,seated-mounted,
// unseated-ssr}` and `{lobby,lobby-tabbed}/{bracket,no-bracket}/seated/
// {open,staked,week,between}`. Checked row by row against main @ 40acd199's
// markup: in 20 the strip's own markup is byte-identical and so is everything
// else with it excised — the strip moved from below the bracket line (and,
// seated, below "Watch a live game") to under the Auto-draft card / the hero;
// in the 2 server renders the strip is absent — it mounts once the seat
// subscription answers (the desktop's WIRE-7 rule, mirrored), and a server
// render runs no effect. The other 74 rows, both funnels included, are
// main's, byte for byte. The group mock answers null for an unseated viewer,
// as the real subscription does; on main's code that moves no row.

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leagueState } from '../leagueFixtures';
import { buildLeagueState } from '../leagueAdapter';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, '__fixtures__', 'backingMobilePin.golden.json');
const UPDATE = process.env.UPDATE_BACKING_PINS === '1';

const flag = vi.hoisted(() => ({ on: true }));
const hooked = vi.hoisted(() => ({
  league: null, myGroup: null, trainingPod: null,
  pods: null, inPlay: null, wallet: null, eligibility: null, pitch: null, cards: {},
  results: null, myStats: null, trainerStats: null, battles: {},
  slots: [], stakeReply: null,
}));

vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flag.on; },
}));
vi.mock('../../../hooks/useLeagueState', () => ({ default: () => ({ state: hooked.league, loading: false, isFixtures: false }) }));
vi.mock('../../../contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u1', displayName: 'Alice' } }) }));
vi.mock('../../../services/tournamentGroupService', () => ({
  // The real subscription ALWAYS answers — the viewer's group, or null — and
  // the mobile strip mounts once it has (N3 / WIRE-7, pre-flip fixes 2).
  subscribeMyGroup: (_uid, cb) => { cb(hooked.myGroup ?? null); return () => {}; },
  subscribeMyMostRecentVoidedGroup: () => () => {},
  subscribeMyTrainingPod: (_uid, cb) => { if (hooked.trainingPod) cb(hooked.trainingPod); return () => {}; },
  subscribeGroup: () => () => {}, getGroup: async () => null, fetchDisplayNames: async () => ({}),
}));
vi.mock('../../../hooks/useBackingPods', () => ({ default: () => hooked.pods }));
vi.mock('../../../hooks/useMyBacking', () => ({ default: () => hooked.inPlay }));
vi.mock('../../../hooks/useBackingWallet', () => ({ default: () => hooked.wallet }));
vi.mock('../../../hooks/useEligibility', async (importOriginal) => ({ ...(await importOriginal()), default: () => hooked.eligibility }));
vi.mock('../../../hooks/useMyPitch', () => ({ default: () => hooked.pitch }));
vi.mock('../../../hooks/useTeamCard', () => ({
  default: (groupId, odUserId, enabled) => {
    const card = enabled ? hooked.cards[`${groupId}/${odUserId}`] ?? null : null;
    return { card, loading: false, error: null, refresh: () => {} };
  },
}));
vi.mock('../../../hooks/useBackingResults', () => ({ default: () => hooked.results }));
vi.mock('../../../hooks/useMyBackingStats', () => ({ default: () => hooked.myStats }));
vi.mock('../../../hooks/useTrainerStats', () => ({ default: () => hooked.trainerStats }));
vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: hooked.battles, loading: false, error: null }) }));
vi.mock('../../../services/backingService', () => ({
  fetchBackingPods: vi.fn(), fetchTeamCard: vi.fn(), subscribeMyStakes: () => () => {}, subscribePool: () => () => {},
  subscribeWallet: () => () => {}, readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null,
  fetchTeamLabels: async () => ({ pods: {} }), fetchBackingResults: async () => ({ weeks: [] }), fetchMyBackingStats: async () => null,
  fetchTrainerStats: async () => null, postBackingEvent: async () => ({ recorded: true }),
  placeStake: vi.fn(async () => hooked.stakeReply), attestEligibility: vi.fn(async () => ({})), savePitch: vi.fn(async () => ({})),
  newRequestId: () => 'pin-req', BackingApiError: class BackingApiError extends Error {},
}));
// THE FUNNEL's recorder (DARK-1 / DARK-R-2, the desktop build's review record):
// every §10 emit the screen ASKS for, BEFORE the emitter's per-session dedup
// (a re-emit never reaches the sink, so the sink cannot see a wrong-view or a
// dependency regression). A pass-through: the real emitter still runs, so no
// other row sees a change. The design is the dark refuter's, mutation-tested.
const funnel = vi.hoisted(() => ({ calls: [] }));
vi.mock('../../../services/backingTelemetry', async (importOriginal) => {
  const orig = await importOriginal();
  return { ...orig, emitBackingEvent: (...args) => { funnel.calls.push(args); return orig.emitBackingEvent(...args); } };
});
vi.mock('../../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({}) })) }));
vi.mock('../../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => Promise.resolve({}), mapLobbyError: () => 'error' }));
vi.mock('../../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: hooked.slots }), claimSlot: () => Promise.resolve({}), releaseSlot: () => Promise.resolve({}), mapSlotActionError: () => 'error',
}));
vi.mock('../LoadoutChooserSheet', () => ({ default: () => null }));
// EquipStation's collaborators (the mobile pitch home), stubbed as backingDark.test.jsx stubs them.
vi.mock('../../../hooks/useForge', () => ({
  useForge: () => ({ forgedBundles: [], equippedBundles: [], equipBundleFn: vi.fn(), unequipBundleFn: vi.fn(), equippingBundleId: null, loading: false }),
}));
vi.mock('../../../services/forgeWatchlistService', () => ({ listWatchlists: () => Promise.resolve([]) }));
vi.mock('../../../services/agentService', () => ({ equipWatchlist: vi.fn(), unequipWatchlist: vi.fn(), changeArchetype: vi.fn() }));
vi.mock('../../Dashboard/EquipSheet', () => ({ default: () => null }));
vi.mock('../../Dashboard/RuleBundlePicker', () => ({ default: () => null }));
vi.mock('../../Dashboard/TraitsSheet', () => ({ default: () => null }));
vi.mock('../../Dashboard/ArchetypePicker', () => ({ default: () => null }));
vi.mock('../../Dashboard/EvolutionPreviewCard', () => ({ default: () => null }));

const { ELIGIBILITY } = await import('../../../hooks/useEligibility');
const { GROUP_STATUS } = await import('../../../constants/leagueTournament');
const LeagueHome = (await import('../LeagueHome')).default;
const { default: Lobby, LobbyTabbed } = await import('../LeagueLobbyRedesign');
const SlotCenter = (await import('../liveDraft/SlotCenter')).default;
const WhileYouWait = (await import('../WhileYouWait')).default;
const { PodCard, PodSheet } = await import('../LeaguePod');
const Spectate = (await import('../LeagueSpectate')).default;
const EquipStation = (await import('../../Dashboard/EquipStation')).default;
const BackingLandingStrip = (await import('./BackingLandingStrip')).default;
const BackingStrip = (await import('./BackingStrip')).default;
const BackingScreen = (await import('./BackingScreen')).default;
const PodList = (await import('./PodList')).default;
const TeamCard = (await import('./TeamCard')).default;
const StakeControl = (await import('./StakeControl')).default;
const AttestationStep = (await import('./AttestationStep')).default;
const YourBacking = (await import('./YourBacking')).default;
const BackingResults = (await import('./BackingResults')).default;
const BackingResultsCard = (await import('./BackingResultsCard')).default;
const MyBackingStats = (await import('./MyBackingStats')).default;
const TrainerStats = (await import('./TrainerStats')).default;
const BackingStatsEntry = (await import('./BackingStatsEntry')).default;
const ScoutingLine = (await import('./ScoutingLine')).default;
const { deriveStripState } = await import('./backingStripState');
const { __resetBackingTelemetry } = await import('../../../services/backingTelemetry');

// ═══ the clock and the fixtures (shapes: the preview page, the screenshot harness, the surfaces' own suites) ═══
const NOW = new Date('2026-09-23T14:00:00.000Z');     // Wed 23 Sep, 10:00 ET
const MONDAY = new Date('2026-09-21T14:00:00.000Z');
const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';
const WED_FIRE = '2026-09-23T23:00:00.000Z';
const ACCENT = '#5EEAD4';

const NAMES = {
  'od-a': { label: 'Kestrel', secondary: 'Mira', player: 'Mira', agent: 'Kestrel' },
  'od-b': { label: 'Tarn', secondary: 'Draco', player: 'Draco', agent: 'Tarn' },
  'od-x': { label: 'Orbit', secondary: 'Rigel', player: 'Rigel', agent: 'Orbit' },
  'cpu-1': { label: 'CPU — Trend Follower', secondary: null, player: 'CPU — Trend Follower', agent: 'CPU — Trend Follower' },
  'cpu-2': { label: 'CPU — Contrarian', secondary: null, player: 'CPU — Contrarian', agent: 'CPU — Contrarian' },
  'cpu-3': { label: 'CPU — Diversifier', secondary: null, player: 'CPU — Diversifier', agent: 'CPU — Diversifier' },
  'cpu-4': { label: 'CPU — Speculator', secondary: null, player: 'CPU — Speculator', agent: 'CPU — Speculator' },
};
const named = (id) => ({ label: NAMES[id].label, secondary: NAMES[id].secondary });
const labelsFor = (...groupIds) => Object.fromEntries(groupIds.map((g) => [g, NAMES]));

const seats = (over = {}) => ['od-a', 'od-b', 'cpu-1', 'cpu-2'].map((id) => ({
  odUserId: id, isCpu: id.startsWith('cpu-'), ...named(id), isOwnSeat: false, backable: true, ...(over[id] || {}),
}));
const pod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40', humanTeams: 2, teams: seats(),
  pool: { status: 'open', closesAt: SUNDAY_CLOSE, closeReason: 'clock', backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false } },
  myStakes: [],
  ...over,
});
const slotPod = pod('lds-wed-1900', { formationPath: 'slot', slotId: 'wed-1900', pool: { status: 'open', closesAt: WED_FIRE, closeReason: 'fire', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false } } });
const podsReply = (pods) => ({
  data: { baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: SUNDAY_CLOSE, viewerUid: 'viewer-1', pods },
  pods, loading: false, error: null, refresh: () => {},
});
const nothingInPlay = { stakes: [], poolsById: {}, groupsById: {}, labelsById: {}, loading: false };

const leg = (direction) => ({ direction, openedAt: '2026-09-21T11:00:00.000Z' });
const weekGroup = (over = {}) => ({
  status: 'battle', baseLayerWeek: '2026-W39',
  players: [
    { odUserId: 'od-a', picks: [{ symbol: 'NVDA', legs: [leg('long')] }, { symbol: 'AMD', legs: [leg('long'), leg('short')] }, { symbol: 'VST', legs: [leg('long')] }] },
    { odUserId: 'od-x', picks: [{ symbol: 'TSLA', legs: [leg('long')] }] },
    { odUserId: 'cpu-3', isCpu: true, picks: [] },
    { odUserId: 'cpu-4', isCpu: true, picks: [] },
  ],
  dailyScores: {
    day1: { closeScores: { 'od-a': { compositePoints: 2.1 }, 'od-x': { compositePoints: 3.0 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
    day2: { closeScores: { 'od-a': { compositePoints: 3.4 }, 'od-x': { compositePoints: 2.6 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
    day3: { recordedDate: '2026-09-23', closeScores: { 'od-a': { compositePoints: 4.8 }, 'od-x': { compositePoints: 5.1 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
  },
  ...over,
});
const weekInPlay = (over = {}) => ({
  stakes: [
    { id: 's1', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' },
    { id: 's3', groupId: 'g-two', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W39' },
    { id: 's4', groupId: 'g-next', teamOdUserId: 'od-a', amount: 50, status: 'live', weekKey: '2026-W40' },
  ],
  poolsById: { 'g-play': { status: 'closed' }, 'g-two': { status: 'closed' }, 'g-next': { status: 'open' } },
  groupsById: { 'g-play': weekGroup(), 'g-two': weekGroup() },
  labelsById: labelsFor('g-play', 'g-two', 'g-next', 'lds-wed'),
  loading: false,
  ...over,
});
const KESTREL_BATTLE = {
  ownerId: 'od-a', status: 'active', _whyConcealed: true,
  agentContext: { agentName: 'Kestrel', archetype: 'momentum_chaser', initialPortfolio: { star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], core: [{ symbol: 'AVGO' }, { symbol: 'ANET' }], support: [{ symbol: 'VST' }, { symbol: 'META' }] } },
};

const STRIP = {
  open: { pods: podsReply([pod('lobby-w40-a'), pod('lobby-w40-b'), slotPod]), inPlay: nothingInPlay },
  staked: {
    pods: podsReply([
      pod('lobby-w40-a', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: NAMES['od-a'].label, amount: 250, status: 'live' }] }),
      pod('lobby-w40-b', { myStakes: [{ stakeId: 's2', teamOdUserId: 'cpu-1', teamLabel: NAMES['cpu-1'].label, amount: 100, status: 'live' }] }),
      pod('lobby-w40-c'),
    ]),
    inPlay: nothingInPlay,
  },
  week: {
    pods: podsReply([pod('lobby-w40-a')]),
    inPlay: weekInPlay({ stakes: weekInPlay().stakes.slice(0, 2), poolsById: { 'g-play': { status: 'closed' }, 'g-two': { status: 'closed' } } }),
  },
  between: {
    pods: podsReply([]),
    inPlay: {
      stakes: [{ id: 's7', groupId: 'lobby-w39-a', teamOdUserId: 'od-a', amount: 250, status: 'settled', weekKey: '2026-W39' }],
      poolsById: { 'lobby-w39-a': { status: 'resolved' } }, groupsById: { 'lobby-w39-a': weekGroup({ status: 'complete' }) },
      labelsById: labelsFor('lobby-w39-a'), loading: false,
    },
  },
  quiet: { pods: podsReply([]), inPlay: nothingInPlay },
};
const stripState = (kind) => deriveStripState({ pods: STRIP[kind].pods.pods, inPlay: STRIP[kind].inPlay, now: NOW, backingWeekCloses: SUNDAY_CLOSE });

const APPROACH = 'Goes where the momentum is — and leaves the moment it fades.';
const seat = (over = {}) => ({ index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false, ...over });
const FIRST_WEEK = {
  groupId: 'lobby-w40-a', odUserId: 'od-b', viewerUid: 'viewer-1', seat: seat({ index: 2 }),
  team: { displayName: 'Draco', ...named('od-b'), isCpu: false, pitch: 'Macro guy. Tarn keeps me from being too early.', derived: null,
    agent: { name: 'Tarn', archetype: 'analyst', archetypeLabel: 'Fundamental Investor', approach: 'Buys quality companies and lets the fundamentals do the work.', traitCount: 3, ruleCount: 5 } },
  known: null, lastWeek: null,
};
const VETERAN = {
  groupId: 'lobby-w40-a', odUserId: 'od-a', viewerUid: 'viewer-1', seat: seat(),
  team: { displayName: 'Mira', ...named('od-a'), isCpu: false, pitch: 'I take the leader in whatever sector has breadth on Monday.', derived: 'Held 2 of 3 all week · 2 moves · leaned technology',
    agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: APPROACH, traitCount: 4, ruleCount: 7 } },
  known: { rp: 412, tier: 2, tierName: 'Analyst', weeksPlayed: 2, priorFinishes: [1, 2] },
  lastWeek: {
    groupId: 'lobby-w38-c', baseLayerWeek: '2026-W38', placement: 1, seatCount: 4, composite: 8.7,
    human: { drafted: ['NVDA', 'AMD', 'COIN'], picks: [
      { symbol: 'NVDA', drafted: true, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, swappedOut: null },
      { symbol: 'AMD', drafted: true, heldAtClose: true, flips: 1, direction: 'short', lastFlipDay: 'WED', swappedOut: null },
      { symbol: 'COIN', drafted: true, heldAtClose: false, flips: null, direction: null, lastFlipDay: null, swappedOut: { day: 'TUE', forSymbol: 'XLE' } },
      { symbol: 'XLE', drafted: false, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, claimedIn: { day: 'TUE', forSymbol: 'COIN' } },
    ] },
    agent: { agentName: 'Kestrel', swaps: 1, picks: [
      { symbol: 'NVDA', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'AVGO', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'ANET', sector: 'technology', drafted: true, heldAtClose: false, swappedOut: { day: 'THU', forSymbol: 'SMCI' } },
      { symbol: 'VST', sector: 'energy', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'META', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'LLY', sector: 'healthcare', drafted: true, heldAtClose: true, swappedOut: null },
      { symbol: 'SMCI', sector: 'technology', drafted: false, heldAtClose: true, addedIn: { day: 'THU', forSymbol: 'ANET' } },
    ], trades: [{ day: 'THU', symbolOut: 'ANET', symbolIn: 'SMCI', rationale: 'Broke its Monday low. Rule is rule.' }] },
    tape: { groupId: 'lobby-w38-c', focusId: 'od-a' },
  },
};
const CPU_CARD = {
  groupId: 'lobby-w40-a', odUserId: 'cpu-1', viewerUid: 'viewer-1', seat: seat({ index: 3, isCpu: true }),
  team: { displayName: 'CPU — Trend Follower', ...named('cpu-1'), isCpu: true, pitch: null, derived: null,
    agent: { name: 'CPU — Trend Follower', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: APPROACH, traitCount: 0, ruleCount: 0 } },
  known: null, lastWeek: null,
};
const OWN_CARD = { ...VETERAN, seat: seat({ viewerSeated: true, isViewer: true }) };
const CARD_POD = { groupId: 'lobby-w40-a', formationPath: 'lobby', pool: { status: 'open', closesAt: SUNDAY_CLOSE }, myStakes: [] };
const TOP_UP_POD = { ...CARD_POD, myStakes: [{ stakeId: 's0', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 250, status: 'live' }] };
const AT_CAP_POD = { ...CARD_POD, myStakes: [{ stakeId: 's0', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 500, status: 'live' }] };
const CLOSED_POD = { ...CARD_POD, pool: { status: 'closed', closesAt: SUNDAY_CLOSE }, myStakes: [{ stakeId: 's0', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 250, status: 'live' }] };
const PITCH = { text: 'I take the leader in whatever sector has breadth on Monday.', loaded: true, saving: false, error: null, save: async () => true };
const WALLET = { known: true, left: 1000, total: 1000 };

const resultPod = (over = {}) => ({
  groupId: 'lobby-w39-a', poolId: 'lobby-w39-a', weekKey: '2026-W39', status: 'resolved', outcome: 'settled', formationPath: 'lobby', slotId: null,
  humanTeams: 2, potTotal: 1000, uniqueBackers: 4, winners: ['od-a'], winnerLabels: ['Kestrel'], winningStakes: 700, paysX: 1.43,
  closedAt: '2026-09-21T04:00:00.000Z', settledAt: '2026-09-25T22:30:00.000Z', refundedAt: null, refundReason: null, holdReason: null, monthKey: '2026-09',
  teams: [
    { odUserId: 'od-a', isCpu: false, ...named('od-a'), backerCount: 2, stakeTotal: 700, sharePct: 70, paysX: 1.43, won: true },
    { odUserId: 'od-b', isCpu: false, ...named('od-b'), backerCount: 2, stakeTotal: 300, sharePct: 30, paysX: 3.33, won: false },
    { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: false },
  ],
  myStakes: [
    { stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 500, status: 'won', payout: 714, voidReason: null, net: 214, loadoutChanged: true },
    { stakeId: 's2', teamOdUserId: 'od-b', teamLabel: 'Tarn', amount: 100, status: 'lost', payout: 0, voidReason: null, net: -100, loadoutChanged: false },
  ],
  myNet: 114, myWon: true,
  ...over,
});
const RESULTS = {
  win: resultPod(),
  loss: resultPod({ winners: ['od-b'], winnerLabels: ['Tarn'], myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 500, status: 'lost', payout: 0, voidReason: null, net: -500, loadoutChanged: false }], myNet: -500, myWon: false }),
  refunded: resultPod({ outcome: 'refunded', status: 'refunded', refundReason: 'group_voided', winners: [], winnerLabels: [], paysX: null, myNet: null, myWon: null,
    myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 500, status: 'voided', payout: null, voidReason: 'group_voided', net: 0, loadoutChanged: null }] }),
  insufficient: resultPod({ outcome: 'insufficient', status: 'insufficient', potTotal: 800, uniqueBackers: 2, winners: [], winnerLabels: [], paysX: null, myNet: null, myWon: null,
    myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 500, status: 'voided', payout: null, voidReason: 'insufficient', net: 0, loadoutChanged: null }] }),
  settling: resultPod({ outcome: 'settling', status: 'closed', podStatus: 'battle', winners: [], winnerLabels: [], paysX: null, myNet: null, myWon: null,
    myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 500, status: 'live', payout: null, voidReason: null, net: null, loadoutChanged: null }] }),
};
const MY_STATS = {
  label: 'beta stats', seasonKey: '2026-09', net: { career: -150, season: 40 },
  career: { poolsBacked: 3, poolsWon: 1, weeksPlayed: 2, pending: 1, net: -150 },
  season: { monthKey: '2026-09', poolsBacked: 1, poolsWon: 1, weeksPlayed: 1, pending: 1, net: 40 },
  seasons: {}, accuracy: { career: { pools: 2, youWon: 1, baselineWon: 2, both: 1, excluded: 1 }, season: { pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 0 } },
};
const TRAINER_STATS = {
  label: 'beta stats', seasonKey: '2026-09',
  career: { uniqueBackers: 3, bpBacked: 600, backersNet: 100, pending: 100, poolsBackedOn: 3, stakes: 4, decidedStakes: 3 },
  season: { monthKey: '2026-09', uniqueBackers: 1, bpBacked: 100, backersNet: 0, pending: 100, poolsBackedOn: 1, stakes: 1, decidedStakes: 0 },
  seasons: {}, excludedStakes: 1,
};

// The two landings: no bracket (today's production) and the fixture bracket.
const baseGroup = {
  id: 'wk-real-1', status: 'battle', roundNumber: 1, baseLayerWeek: '2026-W39',
  players: [{ odUserId: 'u1', picks: [] }, { odUserId: 'cpu-1', isCpu: true, picks: [] }, { odUserId: 'u2', picks: [] }, { odUserId: 'cpu-2', isCpu: true, picks: [] }],
  dailyScores: { day1: { closeScores: { u1: { compositePoints: 3.2 }, u2: { compositePoints: 1.1 } } } },
};
const LANDING = {
  'no-bracket': () => buildLeagueState({ fieldGroups: [baseGroup], names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1' }).state,
  bracket: () => leagueState('open'),
};
const SEATED = { id: 'wk-real-1', status: GROUP_STATUS.BATTLE };
const PRACTICE = { id: 'pin-practice-pod', status: GROUP_STATUS.BATTLE };
const SLOTS = [
  { slotId: 'sun-1900', groupId: 'lds-sun-1900', label: 'Sun 7:00pm ET', humanCount: 2, isFull: false, enabled: true, seats: [] },
  { slotId: 'mon-0845', groupId: 'lds-mon-0845', label: 'Mon 8:45am ET', humanCount: 0, isFull: false, enabled: true, seats: [] },
];

function resetHooks() {
  hooked.league = LANDING['no-bracket']();
  hooked.myGroup = null;
  hooked.trainingPod = null;
  hooked.pods = STRIP.open.pods;
  hooked.inPlay = nothingInPlay;
  hooked.wallet = WALLET;
  hooked.eligibility = { status: ELIGIBILITY.ATTESTED, refresh: () => {} };
  hooked.pitch = PITCH;
  hooked.cards = { 'lobby-w40-a/od-b': FIRST_WEEK, 'lobby-w40-a/od-a': VETERAN, 'lobby-w40-a/cpu-1': CPU_CARD };
  hooked.results = { data: null, pod: null, weeks: [], nextBefore: null, loadMore: () => {}, loading: false, loadingMore: false, error: null, refresh: () => {} };
  hooked.myStats = { data: MY_STATS, loading: false, error: null, refresh: () => {} };
  hooked.trainerStats = { data: TRAINER_STATS, loading: false, error: null, refresh: () => {} };
  hooked.battles = {};
  hooked.slots = SLOTS;
  hooked.stakeReply = { ok: true, replay: false, topUp: false, added: 250, teamLabel: 'Kestrel', stake: { stakeId: 'pin-stake', teamOdUserId: 'od-a', amount: 250, status: 'live' }, allowanceRemaining: 750 };
  flag.on = true;
}

// ═══ the pin ═══
/** The markup's fingerprint: sha-256 of the markup (U+202F normalised, so an ICU that narrows the AM/PM space cannot move a hash). */
const fingerprint = (markup) => {
  const text = String(markup).replace(/ /g, ' ');
  return { sha256: createHash('sha256').update(text).digest('hex'), length: text.length };
};
const golden = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : {};
const seen = {};
function pin(name, markup) {
  const fp = fingerprint(markup);
  expect(fp.length, `${name}: rendered nothing`).toBeGreaterThan(0);
  seen[name] = fp;
  if (UPDATE) return;
  expect(golden[name], `${name}: no golden row — regenerate on main's code`).toBeDefined();
  expect(fp, `${name}: the mobile markup moved (today's is ${golden[name]?.length} chars, this is ${fp.length})`).toEqual(golden[name]);
}

/** A behaviour row: the ordered events themselves ride the golden (readable), beside their fingerprint. */
function pinFunnel(name, steps) {
  const fp = { ...fingerprint(JSON.stringify(steps)), steps };
  seen[name] = fp;
  if (UPDATE) return;
  expect(golden[name], `${name}: no golden row — regenerate on main's code`).toBeDefined();
  expect(fp, `${name}: the mobile funnel moved — which view emits which §10 event`).toEqual(golden[name]);
}

let roots = [];
async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
  roots.push({ root, container });
  return container;
}
async function press(el) {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
}
const ssr = (el) => renderToString(el);
const homeProps = { onOpenMyGame: () => {}, onOpenTrainingPod: () => {}, hasAgent: true, agentLoadout: null };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
  resetHooks();
});
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (UPDATE) {
    mkdirSync(path.dirname(GOLDEN), { recursive: true });
    const sorted = Object.fromEntries(Object.keys(seen).sort().map((k) => [k, seen[k]]));
    writeFileSync(GOLDEN, `${JSON.stringify(sorted, null, 2)}\n`);
  }
});
resetHooks();

// ═══ the rows ═══
describe('the mobile League landing — both flag states, both landings, unseated and seated', () => {
  for (const landing of ['no-bracket', 'bracket']) {
    for (const lit of [true, false]) {
      it(`LeagueHome · ${landing} · flag ${lit ? 'on' : 'off'} · unseated (server render)`, () => {
        hooked.league = LANDING[landing]();
        flag.on = lit;
        pin(`landing/${landing}/${lit ? 'on' : 'off'}/unseated-ssr`, ssr(<LeagueHome {...homeProps} />));
      });
      it(`LeagueHome · ${landing} · flag ${lit ? 'on' : 'off'} · unseated, mounted (the slot picker's schedule answered)`, async () => {
        hooked.league = LANDING[landing]();
        flag.on = lit;
        const c = await mount(<LeagueHome {...homeProps} />);
        pin(`landing/${landing}/${lit ? 'on' : 'off'}/unseated-mounted`, c.innerHTML);
      });
      it(`LeagueHome · ${landing} · flag ${lit ? 'on' : 'off'} · seated with a practice pod, mounted`, async () => {
        hooked.league = LANDING[landing]();
        hooked.myGroup = SEATED;
        hooked.trainingPod = PRACTICE;
        flag.on = lit;
        const c = await mount(<LeagueHome {...homeProps} />);
        pin(`landing/${landing}/${lit ? 'on' : 'off'}/seated-mounted`, c.innerHTML);
      });
    }
    for (const kind of ['open', 'staked', 'week', 'between']) {
      it(`the presentational lobbies (Lobby, LobbyTabbed) · ${landing} · seated · the ${kind} strip in the slot`, () => {
        const st = LANDING[landing]();
        const slot = <div data-backing="strip-slot" style={{ marginBottom: 18 }}><BackingStrip state={stripState(kind)} accent={ACCENT} onOpen={() => {}} /></div>;
        const common = { st, accent: ACCENT, onPickPod: () => {}, onSpectate: () => {}, onOpenMyGame: () => {}, activeGroup: SEATED, uid: 'u1', displayName: 'Alice', onOpenTrainingPod: () => {}, activeTrainingPod: PRACTICE, hasAgent: true, backingSlot: slot };
        pin(`lobby/${landing}/seated/${kind}`, ssr(<Lobby {...common} />));
        pin(`lobby-tabbed/${landing}/seated/${kind}`, ssr(<LobbyTabbed {...common} tab="ranked" onSwitchTab={() => {}} agentLoadout={null} />));
      });
    }
  }
});

describe('the shared centre — SlotCenter and WhileYouWait as mobile mounts them', () => {
  it('SlotCenter · server render and mounted (the schedule answered)', async () => {
    pin('slot-center/ssr', ssr(<SlotCenter currentUserId="u1" displayName="Alice" onEntered={() => {}} />));
    const c = await mount(<SlotCenter currentUserId="u1" displayName="Alice" onEntered={() => {}} />);
    pin('slot-center/mounted', c.innerHTML);
  });
  for (const [name, props] of [
    ['forming', { status: GROUP_STATUS.FORMING }],
    ['battle', { status: GROUP_STATUS.BATTLE }],
    ['pre-open', { status: GROUP_STATUS.BATTLE, preOpen: true }],
    ['battle · a live pod to watch · a practice pod', { status: GROUP_STATUS.BATTLE, st: leagueState('open'), activeTrainingPod: PRACTICE, onSpectate: () => {} }],
  ]) {
    it(`WhileYouWait · mobile · ${name}`, () => {
      pin(`while-you-wait/mobile/${name}`, ssr(<WhileYouWait viewport="mobile" onOpenTrainingPod={() => {}} hasAgent {...props} />));
    });
  }
});

describe('the strip — every state, the gated mount and the bare component', () => {
  for (const kind of ['open', 'staked', 'week', 'between', 'quiet']) {
    it(`BackingStrip · ${kind}`, () => {
      pin(`strip/${kind}`, ssr(<BackingStrip state={stripState(kind)} accent={ACCENT} onOpen={() => {}} />));
    });
    it(`BackingLandingStrip · ${kind}`, () => {
      hooked.pods = STRIP[kind].pods;
      hooked.inPlay = STRIP[kind].inPlay;
      pin(`landing-strip/${kind}`, ssr(<BackingLandingStrip uid="viewer-1" accent={ACCENT} onOpen={() => {}} />));
    });
  }
});

describe('the Backing screen — mobile: the list, a card, the stake control', () => {
  it('the list view (results, Your Backing, the pods)', async () => {
    hooked.pods = STRIP.staked.pods;
    hooked.inPlay = weekInPlay();
    hooked.results = { ...hooked.results, weeks: [{ weekKey: '2026-W39', pools: [RESULTS.win, { ...RESULTS.refunded, groupId: 'lobby-w39-b', poolId: 'lobby-w39-b' }] }] };
    pin('screen/list-ssr', ssr(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="mobile" onBack={() => {}} onOpenTape={() => {}} />));
    const c = await mount(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="mobile" onBack={() => {}} onOpenTape={() => {}} />);
    pin('screen/list-mounted', c.innerHTML);
  });
  it('a seat → its card → the stake control (attested, then not)', async () => {
    hooked.pods = podsReply([pod('lobby-w40-a')]);
    const c = await mount(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="mobile" onBack={() => {}} onOpenTape={() => {}} />);
    const seatEl = [...c.querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes('Kestrel'));
    await press(seatEl);
    pin('screen/card-veteran', c.innerHTML);
    await press(c.querySelector('[data-backing="cta-back"]'));
    pin('screen/stake-attested', c.innerHTML);
    hooked.eligibility = { status: ELIGIBILITY.REQUIRED, refresh: () => {} };
    const c2 = await mount(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="mobile" onBack={() => {}} onOpenTape={() => {}} />);
    await press([...c2.querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes('Tarn')));
    pin('screen/card-first-week', c2.innerHTML);
    await press(c2.querySelector('[data-backing="cta-back"]'));
    pin('screen/stake-attest', c2.innerHTML);
  });
  it('the viewer holding a stake on the seat — the top-up path', async () => {
    hooked.pods = podsReply([pod('lobby-w40-a', { myStakes: [{ stakeId: 's0', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 250, status: 'live' }] })]);
    hooked.wallet = { known: true, left: 750, total: 1000 };
    const c = await mount(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="mobile" onBack={() => {}} onOpenTape={() => {}} />);
    await press([...c.querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes('Kestrel')));
    pin('screen/card-top-up', c.innerHTML);
    await press(c.querySelector('[data-backing="cta-back"]'));
    pin('screen/stake-top-up', c.innerHTML);
  });
});

describe('the mobile funnel — WHICH view emits WHICH event, in order (DARK-1 / DARK-R-2, the desktop review record)', () => {
  // Behaviour, not markup: which mobile view emits which §10 event, captured
  // before the dedup and kept per view step, pinned against a golden generated
  // on main's code. The desktop build rewrote the list events' gating
  // (listShown / yourBackingShown), keyed the card visit on its seat and moved
  // results_viewed into a shared hook. The fake clock moves past MIN_DWELL
  // (16 ms) before a card is left, so team_card_opened fires; it is put back
  // after, for the rows that follow.
  const took = () => funnel.calls.splice(0).map(([event, o = {}]) => [event, o.groupId ?? null, o.odUserId ?? null, o.props ?? {}]);
  const seatEl = (c, name) => [...c.querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes(name));
  it('list → card → stake → card → list → a second card left inside one frame', async () => {
    __resetBackingTelemetry(); funnel.calls.length = 0;
    hooked.pods = podsReply([pod('lobby-w40-a')]);
    hooked.inPlay = weekInPlay();
    hooked.results = { ...hooked.results, weeks: [{ weekKey: '2026-W39', pools: [RESULTS.win, { ...RESULTS.refunded, groupId: 'lobby-w39-b', poolId: 'lobby-w39-b' }] }] };
    const steps = [];
    try {
      const c = await mount(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="mobile" onBack={() => {}} onOpenTape={() => {}} />);
      steps.push(['list', took()]);
      await press(seatEl(c, 'Kestrel')); steps.push(['card', took()]);
      vi.setSystemTime(new Date(NOW.getTime() + 20000));
      await press(c.querySelector('[data-backing="cta-back"]')); steps.push(['stake', took()]);
      await press(c.querySelector('[data-backing="screen-back"]')); steps.push(['stake → card', took()]);
      vi.setSystemTime(new Date(NOW.getTime() + 45000));
      await press(c.querySelector('[data-backing="screen-back"]')); steps.push(['card → list', took()]);
      await press(seatEl(c, 'Tarn')); steps.push(['card (Tarn)', took()]);
      vi.setSystemTime(new Date(NOW.getTime() + 45005));
      await press(c.querySelector('[data-backing="screen-back"]')); steps.push(['card → list, inside one frame', took()]);
    } finally { vi.setSystemTime(NOW); }
    // Not vacuous: the journey saw the window, Your Backing, the results, a card visit and the control.
    const events = steps.flatMap(([, list]) => list.map(([event]) => event));
    for (const e of ['window_viewed', 'your_backing_viewed', 'results_viewed', 'team_card_opened', 'stake_control_opened']) expect(events, e).toContain(e);
    pinFunnel('funnel/journey', steps);
  });
  it('data arriving while the list is off screen — the effects\' dependencies', async () => {
    __resetBackingTelemetry(); funnel.calls.length = 0;
    hooked.pods = { data: null, pods: [], loading: true, error: null, refresh: () => {} };
    const el = () => <BackingScreen uid="viewer-1" accent={ACCENT} viewport="mobile" onBack={() => {}} onOpenTape={() => {}} />;
    const steps = [];
    try {
      const c = await mount(el());
      const { root } = roots[roots.length - 1];
      const rerender = async () => { await act(async () => { root.render(el()); }); for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
      steps.push(['list, pods loading', took()]);
      hooked.pods = podsReply([pod('lobby-w40-a')]); await rerender(); steps.push(['pods answer', took()]);
      await press(seatEl(c, 'Kestrel')); steps.push(['card', took()]);
      hooked.inPlay = weekInPlay(); await rerender(); steps.push(['in play arrives on the card', took()]);
      hooked.results = { ...hooked.results, weeks: [{ weekKey: '2026-W39', pools: [RESULTS.win] }] }; await rerender(); steps.push(['results arrive on the card', took()]);
      vi.setSystemTime(new Date(NOW.getTime() + 20000));
      await press(c.querySelector('[data-backing="screen-back"]')); steps.push(['card → list', took()]);
      const moved = podsReply([pod('lobby-w40-a')]);
      hooked.pods = { ...moved, data: { ...moved.data, baseLayerWeek: '2026-W41' } }; await rerender(); steps.push(['the week key moves on the list', took()]);
    } finally { vi.setSystemTime(NOW); }
    pinFunnel('funnel/late-data', steps);
  });
});

describe('the DESKTOP funnel — each event on its own section, a card visit keyed on its seat (WIRE-2 / WIRE-3, the desktop review record)', () => {
  // No golden (main has no desktop screen): the steps below ARE the desktop
  // semantics, captured before the dedup — window_viewed on the window
  // section, your_backing_viewed on Monday–Friday's, results_viewed on
  // Friday's, never on another; the screen opens on the section the strip
  // named; a card visit is keyed on its seat (re-selecting the open seat is
  // not a new visit) and ends where the event's contract says — "Back" into
  // the control, another seat, the window section closing — as on mobile.
  it('opened on Your Backing, then the window, a card, a re-click, Back, back to the card, another card, the results, the window again', async () => {
    __resetBackingTelemetry(); funnel.calls.length = 0;
    hooked.pods = podsReply([pod('lobby-w40-a')]);
    hooked.inPlay = weekInPlay();
    hooked.results = { ...hooked.results, weeks: [{ weekKey: '2026-W39', pools: [RESULTS.win] }] };
    let t = NOW.getTime();
    const tick = (ms) => { t += ms; vi.setSystemTime(new Date(t)); };
    const took = () => funnel.calls.splice(0).map(([event, o = {}]) => (event === 'team_card_opened' ? `${event}:${o.odUserId}:${o.props.dwellMs}` : o.odUserId ? `${event}:${o.odUserId}` : event));
    const seat = (c, name) => [...c.querySelectorAll('[data-desk-col="pods"] [data-backing="seat"]')].find((el) => el.textContent.includes(name));
    const tab = (c, id) => c.querySelector(`[data-backing="desk-sections"] [data-desk-section="${id}"]`);
    const steps = [];
    try {
      const c = await mount(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="desktop" initialSection="week" onBack={() => {}} onOpenTape={() => {}} />);
      // The section the strip named, from the first frame — never the window first.
      expect(c.querySelector('[data-backing="screen"]').getAttribute('data-desk-section')).toBe('week');
      steps.push(['opened on Your Backing', took()]);
      await press(tab(c, 'window')); steps.push(['the window', took()]);
      tick(1000); await press(seat(c, 'Kestrel')); steps.push(['Kestrel\'s card', took()]);
      tick(2000); await press(seat(c, 'Kestrel')); steps.push(['the open seat again', took()]);
      tick(60000); await press(c.querySelector('[data-desk-col="card"] [data-backing="cta-back"]'));
      expect(c.querySelector('[data-desk-col="right"] [data-backing="stake-control"]')).not.toBeNull();
      steps.push(['Back', took()]);
      await press(c.querySelector('[data-desk-col="right"] [data-backing="stake-cancel"]')); steps.push(['back to the card', took()]);
      tick(1000); await press(seat(c, 'Tarn')); steps.push(['Tarn\'s card', took()]);
      tick(3000); await press(tab(c, 'results')); steps.push(['the results', took()]);
      await press(tab(c, 'window'));
      expect(c.querySelector('[data-desk-col="card"] [data-backing="desk-card-empty"]'), 'the window comes back without a stale card').not.toBeNull();
      steps.push(['the window again', took()]);
    } finally {
      vi.setSystemTime(NOW);
    }
    expect(steps).toEqual([
      ['opened on Your Backing', ['your_backing_viewed']],
      ['the window', ['window_viewed']],
      ['Kestrel\'s card', []],
      ['the open seat again', []],                                   // not a new visit — the 62 s below are whole
      ['Back', ['team_card_opened:od-a:62000', 'stake_control_opened:od-a']],
      ['back to the card', []],
      ['Tarn\'s card', ['team_card_opened:od-a:1000']],             // the second visit (the sink keeps the first)
      ['the results', ['team_card_opened:od-b:3000', 'results_viewed']],
      ['the window again', ['window_viewed']],
    ]);
  });
});

describe('the DESKTOP section — the one the screen was opened on, held; the card closed by any route out of the window (WIRE-2, the desktop review record)', () => {
  const took = () => funnel.calls.splice(0).map(([event]) => event);
  it('opened by "Back a team" on a Monday–Friday viewer: the WINDOW, never the week its state points to', async () => {
    __resetBackingTelemetry(); funnel.calls.length = 0;
    hooked.pods = podsReply([pod('lobby-w40-a')]);
    hooked.inPlay = weekInPlay();
    const c = await mount(<BackingScreen uid="viewer-1" accent={ACCENT} viewport="desktop" initialSection="window" onBack={() => {}} onOpenTape={() => {}} />);
    expect(c.querySelector('[data-backing="screen"]').getAttribute('data-desk-section')).toBe('window');
    expect(took()).toEqual(['window_viewed']);
  });
  it('a section that moves with the data (none asked for) closes the open card — the window comes back without a stale one', async () => {
    __resetBackingTelemetry(); funnel.calls.length = 0;
    hooked.pods = podsReply([pod('lobby-w40-a')]);
    hooked.inPlay = nothingInPlay;
    const el = () => <BackingScreen uid="viewer-1" accent={ACCENT} viewport="desktop" onBack={() => {}} onOpenTape={() => {}} />;
    const c = await mount(el());
    const { root } = roots[roots.length - 1];
    expect(c.querySelector('[data-backing="screen"]').getAttribute('data-desk-section')).toBe('window');
    await press([...c.querySelectorAll('[data-desk-col="pods"] [data-backing="seat"]')].find((x) => x.textContent.includes('Kestrel')));
    expect(c.querySelector('[data-desk-col="card"] [data-backing="team-card"]')).not.toBeNull();
    // The week's stakes land: the state points to Your Backing, and the section follows.
    hooked.inPlay = weekInPlay();
    await act(async () => { root.render(el()); });
    for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
    expect(c.querySelector('[data-backing="screen"]').getAttribute('data-desk-section')).toBe('week');
    await press(c.querySelector('[data-backing="desk-sections"] [data-desk-section="window"]'));
    expect(c.querySelector('[data-desk-col="card"] [data-backing="desk-card-empty"]'), 'no stale card').not.toBeNull();
  });
});

describe('the surfaces themselves — pure over their props', () => {
  it('PodList · open below the floor, qualified, revealed, your pod, a slot pod, empty', () => {
    pin('pods/below-floor', ssr(<PodList pods={[pod('g1', { pool: { ...pod('g1').pool, backerProgress: { count: 2, floor: 3, met: false } } })]} onOpenSeat={() => {}} />));
    pin('pods/qualified', ssr(<PodList pods={[pod('g1', { pool: { status: 'open', backerProgress: { count: 3, floor: 3, met: true }, teamSpread: { met: true }, closesAt: SUNDAY_CLOSE } })]} onOpenSeat={() => {}} />));
    pin('pods/revealed', ssr(<PodList pods={[pod('g-closed', {
      pool: { status: 'closed', potTotal: 1200, uniqueBackers: 5, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
      teams: seats({ 'od-a': { stakeTotal: 700, backerCount: 3, paysX: 1.71 }, 'od-b': { stakeTotal: 500, backerCount: 2 }, 'cpu-1': { stakeTotal: 0, backerCount: 0 }, 'cpu-2': { stakeTotal: 0, backerCount: 0 } }),
    })]} onOpenSeat={() => {}} />));
    pin('pods/your-pod', ssr(<PodList pods={[pod('g-mine', { teams: seats({ 'od-a': { isOwnSeat: true, backable: false }, 'od-b': { backable: false }, 'cpu-1': { backable: false }, 'cpu-2': { backable: false } }) })]} onOpenSeat={() => {}} />));
    pin('pods/mixed-with-my-stake', ssr(<PodList pods={[pod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }] }), slotPod]} onOpenSeat={() => {}} />));
    pin('pods/empty', ssr(<PodList pods={[]} onOpenSeat={() => {}} />));
  });
  it('TeamCard · first week, veteran, CPU, your own, closed, a top-up CTA', () => {
    pin('card/first-week', ssr(<TeamCard card={FIRST_WEEK} pod={CARD_POD} onBack={() => {}} onOpenTape={() => {}} />));
    pin('card/veteran', ssr(<TeamCard card={VETERAN} pod={CARD_POD} onBack={() => {}} onOpenTape={() => {}} />));
    pin('card/cpu', ssr(<TeamCard card={CPU_CARD} pod={CARD_POD} onBack={() => {}} onOpenTape={() => {}} />));
    pin('card/own', ssr(<TeamCard card={OWN_CARD} pod={CARD_POD} onBack={() => {}} onOpenTape={() => {}} myPitch={PITCH} />));
    pin('card/closed', ssr(<TeamCard card={VETERAN} pod={CLOSED_POD} onBack={() => {}} onOpenTape={() => {}} />));
    pin('card/top-up-cta', ssr(<TeamCard card={VETERAN} pod={TOP_UP_POD} onBack={() => {}} onOpenTape={() => {}} />));
  });
  it('StakeControl · attest, checking, wallet pending, attested, top-up, at the cap', () => {
    const base = { card: VETERAN, pod: CARD_POD, wallet: WALLET, eligibility: { status: ELIGIBILITY.ATTESTED, refresh: () => {} }, onBacked: () => {}, onClose: () => {} };
    pin('stake/attest', ssr(<StakeControl {...base} eligibility={{ status: ELIGIBILITY.REQUIRED, refresh: () => {} }} />));
    pin('stake/checking', ssr(<StakeControl {...base} eligibility={{ status: ELIGIBILITY.LOADING, refresh: () => {} }} />));
    pin('stake/wallet-pending', ssr(<StakeControl {...base} wallet={{ known: false, left: null, total: 1000 }} />));
    pin('stake/attested', ssr(<StakeControl {...base} />));
    pin('stake/top-up', ssr(<StakeControl {...base} pod={TOP_UP_POD} wallet={{ known: true, left: 750, total: 1000 }} />));
    pin('stake/at-cap', ssr(<StakeControl {...base} pod={AT_CAP_POD} wallet={{ known: true, left: 500, total: 1000 }} />));
    pin('attestation-step', ssr(<AttestationStep onAttested={() => {}} />));
  });
  it('StakeControl · Confirm pressed: backed, topped up, refused', async () => {
    const base = { card: VETERAN, pod: CARD_POD, wallet: WALLET, eligibility: { status: ELIGIBILITY.ATTESTED, refresh: () => {} }, onBacked: () => {}, onClose: () => {} };
    const backed = await mount(<StakeControl {...base} services={{ newRequestId: () => 'r1', attestEligibility: async () => ({}), placeStake: async () => hooked.stakeReply }} />);
    await press(backed.querySelector('[data-backing="confirm"]'));
    pin('stake/backed', backed.innerHTML);
    const topped = await mount(<StakeControl {...base} pod={TOP_UP_POD} wallet={{ known: true, left: 750, total: 1000 }} services={{ newRequestId: () => 'r2', attestEligibility: async () => ({}), placeStake: async () => ({ ...hooked.stakeReply, topUp: true, added: 250, stake: { ...hooked.stakeReply.stake, amount: 500 } }) }} />);
    await press(topped.querySelector('[data-backing="confirm"]'));
    pin('stake/topped-up', topped.innerHTML);
    const refused = await mount(<StakeControl {...base} services={{ newRequestId: () => 'r3', attestEligibility: async () => ({}), placeStake: async () => { throw Object.assign(new Error('pool_closed'), { code: 'pool_closed' }); } }} />);
    await press(refused.querySelector('[data-backing="confirm"]'));
    pin('stake/refused', refused.innerHTML);
  });
  it('YourBacking · before Monday, Monday, mid-week, settled', () => {
    pin('week/before-monday', ssr(<YourBacking inPlay={weekInPlay({ stakes: [{ id: 's1', groupId: 'lds-wed', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W40' }], poolsById: { 'lds-wed': { status: 'closed' } }, groupsById: { 'lds-wed': weekGroup({ status: 'drafting', dailyScores: {} }) } })} now={NOW} battlesByGroup={{}} onOpenTape={() => {}} />));
    pin('week/monday', ssr(<YourBacking inPlay={weekInPlay({ groupsById: { 'g-play': weekGroup({ dailyScores: {} }), 'g-two': weekGroup({ dailyScores: {} }) } })} now={MONDAY} battlesByGroup={{ 'g-play': { 'od-a': KESTREL_BATTLE }, 'g-two': {} }} onOpenTape={() => {}} />));
    pin('week/mid-week', ssr(<YourBacking inPlay={weekInPlay()} now={NOW} battlesByGroup={{ 'g-play': { 'od-a': KESTREL_BATTLE }, 'g-two': {} }} onOpenTape={() => {}} />));
    pin('week/settled', ssr(<YourBacking inPlay={weekInPlay({ poolsById: { 'g-play': { status: 'resolved' }, 'g-two': { status: 'refunded' } } })} now={NOW} battlesByGroup={{}} onOpenTape={() => {}} />));
  });
  it('BackingResultsCard · win, loss, refunded, insufficient, settling — and the results section', () => {
    for (const [k, p] of Object.entries(RESULTS)) pin(`results-card/${k}`, ssr(<BackingResultsCard pod={p} onOpenTape={() => {}} />));
    hooked.results = { ...hooked.results, weeks: [{ weekKey: '2026-W39', pools: [RESULTS.win, { ...RESULTS.loss, groupId: 'lobby-w39-b', poolId: 'lobby-w39-b' }] }], nextBefore: '2026-W38' };
    pin('results-section', ssr(<BackingResults uid="viewer-1" onOpenTape={() => {}} />));
  });
  it('the private stats, and their mobile home under the pitch', () => {
    pin('stats/mine', ssr(<MyBackingStats stats={MY_STATS} />));
    pin('stats/trainer', ssr(<TrainerStats stats={TRAINER_STATS} />));
    pin('stats/entry-compact', ssr(<BackingStatsEntry uid="viewer-1" compact />));
    pin('scouting-line/compact', ssr(<ScoutingLine uid="viewer-1" agentName="Prime" compact />));
    const props = { agent: { id: 'a1', ownerId: 'viewer-1', name: 'Prime', archetype: 'momentum_chaser', stats: {} }, accent: ACCENT, onOpenAgentRecord: () => {}, setShowForge: () => {} };
    pin('equip-station/on', ssr(<EquipStation {...props} />));
    flag.on = false;
    pin('equip-station/off', ssr(<EquipStation {...props} />));
  });
  it('the pod rows — the Predictions label lit, the spectate label dark', () => {
    const podRow = leagueState('open').baseGames[0];
    pin('pod-card/on', ssr(<PodCard pod={podRow} accent={ACCENT} onSpectate={() => {}} />));
    pin('pod-sheet/on', ssr(<PodSheet pod={podRow} accent={ACCENT} onClose={() => {}} onSpectate={() => {}} />));
    flag.on = false;
    pin('pod-card/off', ssr(<PodCard pod={podRow} accent={ACCENT} onSpectate={() => {}} />));
  });
  it('Spectate · the final state with its results card', async () => {
    const finalPod = leagueState('open').baseGames.find((p) => p.base && p.status === 'final');
    hooked.results = { ...hooked.results, pod: RESULTS.win, data: { pod: RESULTS.win } };
    const c = await mount(<Spectate pod={finalPod} accent={ACCENT} onBack={() => {}} onEnter={() => {}} />);
    pin('spectate/final-with-results', c.innerHTML);
  });
});

describe('the pin itself', () => {
  it('the golden carries exactly the rows this file renders — nothing stale, nothing missing', () => {
    if (UPDATE) return;
    expect(Object.keys(seen).sort()).toEqual(Object.keys(golden).sort());
  });
});
