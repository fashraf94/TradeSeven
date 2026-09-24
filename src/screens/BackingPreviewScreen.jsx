/* eslint-disable react-refresh/only-export-components -- the fixture table is exported for the page's own test (the strip-slot equivalence row); this dev page is never hot-reloaded in production */
// src/screens/BackingPreviewScreen.jsx
//
// Backing Beta PR 4 — DEV-ONLY DESIGN PREVIEW (the visual smoke for PR 4).
// Every Backing surface, rendered from fixture data with BACKING_BETA_ENABLED
// forced on for THIS PAGE ONLY (BackingPreviewLitContext; featureFlags.js is
// untouched), selectable from a switcher at the top.
//
// REACHABLE ONLY at `?preview=backing` where backingPreview.js allows it — the
// Vite dev server, or a Vercel preview host, never production. src/main.jsx
// mounts this page INSTEAD of the app, so the app shell (auth, the user doc,
// the agent listeners) never mounts under it.
//
// NO NETWORK, NO FIRESTORE. The surfaces are rendered directly, with their data
// as props. The calls a surface would make on its own are answered locally:
// the stake control's placeStake / attestEligibility / newRequestId (its
// `services` prop), Your Backing's spectator battles (`battlesByGroup`), the
// pitch editor's save (a local pitch object). A Confirm, a Continue or a Save
// changes this page's state only, and the page says so ("preview — nothing
// saved"). The landing is the real mobile Lobby over the fixture league
// states; its viewer is SEATED with a practice pod, because the unseated
// center (the slot picker) reads the live slot schedule on mount and the
// practice-pod start calls the lobby service — the seated waiting room reads
// neither. BackingPreviewScreen.test.jsx clicks through every state and every
// button and asserts zero fetch calls and zero Firestore reads or writes.
//
// THE FIXTURES are the ones the PR's tests and screenshots use, copied verbatim
// with the source named beside each: the screenshot harness
// (scripts/backing-screenshots/harness.render.jsx) for the strip's four states
// and the first-week and veteran cards; PodList.test.jsx, TeamCard.test.jsx,
// StakeControl.jsdom.test.jsx, YourBacking.test.jsx and backingLanding.test.jsx
// for the rest; and, since PR 5, BackingResultsCard.test.jsx for the results
// card (settled win, settled loss, refunded, insufficient) and
// BackingStats.test.jsx for the two private stats surfaces. Nothing on this
// page is real, and nothing leaves it.
//
// AGENT-NAMED TEAMS (Amendment C §C1, D-af — the pre-flip cleanup): every
// fixture that names a team now carries the SERVER's names, in the shapes the
// endpoints send them — `label` (the team's primary agent) and `secondary`
// (the player) on each seat and team row, `teamLabel` on each of the viewer's
// stakes, `winnerLabels` on a settled result, `labelsById` beside the in-play
// stakes (GET /api/backing/team-labels — each team's label pair AND its two
// layers, `player` and `agent`, named apart for Your Backing's reveal). The
// screenshot harness carries the same shapes since this build's review
// (WIRING-7); the other copied fixtures differ from their named sources by
// exactly those fields, and by the pod-list and results `seatNames` maps,
// which the endpoints no longer send; the group documents keep theirs (a slot
// pod's does), and the surfaces ignore it — so the page shows what the
// pre-flip build shows.
//
// THE DESKTOP TOGGLE (Backing desktop layouts): "Desktop" switches the page to
// every desktop state — the landing (the strip in the centre column: each
// strip state, not seated and seated, no bracket and a bracket), the Backing
// screen during the window (no card yet, the first-week, veteran, CPU and own
// cards, the attestation step, the stake control, the top-up state, "Backed",
// a refusal), Monday–Friday, the results, and the stats' home beside the pitch
// — rendered through the REAL desktop components (DeskLobby, BackingDesk,
// ScoutingLineView, StatsEntryView) from the same fixtures, in frames sized
// as the app sizes them (the League's content area at a 1440-wide window;
// the Backing screen full-window at 1440×900). Every call is answered locally
// as above — the draft-slot picker's and the Auto-draft lane's through their
// `services` seam — and the page's test presses every control of every
// desktop state and asserts zero network, as it does for mobile. The desktop
// states are best viewed in a window at least 1440 wide (the layouts' own
// breakpoints read the window, not the frame).


import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../components/League/league.css';
import { LTOKENS, LX, alpha } from '../components/League/leagueTokens';
import { Eyebrow, Mono } from '../components/League/LeagueParts';
import Lobby from '../components/League/LeagueLobbyRedesign';
import { leagueState } from '../components/League/leagueFixtures';
import { buildLeagueState } from '../components/League/leagueAdapter';
import { GROUP_STATUS } from '../constants/leagueTournament';
import { ELIGIBILITY } from '../hooks/useEligibility';
import BackingStrip from '../components/League/backing/BackingStrip';
import PodList from '../components/League/backing/PodList';
import TeamCard from '../components/League/backing/TeamCard';
import StakeControl from '../components/League/backing/StakeControl';
import YourBacking from '../components/League/backing/YourBacking';
// PR 5: the results card (Surface E) and the two private stats surfaces —
// pure over their data, so the page hands them fixtures and nothing runs.
import BackingResultsCard from '../components/League/backing/BackingResultsCard';
import MyBackingStats from '../components/League/backing/MyBackingStats';
import TrainerStats from '../components/League/backing/TrainerStats';
import { RESULTS, STATS } from '../components/League/backing/backingCopy';
import { deriveStripState } from '../components/League/backing/backingStripState';
import { BackingPreviewLitContext } from '../components/League/backing/backingPreview';
// The desktop layouts — the real components, pure over the page's fixtures.
import { DeskLobby } from '../components/League/LeagueLobbyDesktop';
import BackingDesk, { DESK_SECTION, deskDefaultSection, deskSections } from '../components/League/backing/BackingDesk';
import { backedPodsFor } from '../components/League/backing/YourBacking';
import { ScoutingLineView } from '../components/League/backing/ScoutingLine';
import { StatsEntryView } from '../components/League/backing/BackingStatsEntry';

export const PREVIEW_LABEL = 'Backing — design preview. Fixture data. Nothing here is real or saved.';
export const NOTHING_SAVED = 'preview — nothing saved';
const ACCENT = LX.energy;

// The clock every state is read at — the tests' Wednesday (Wed 23 Sep, 10:00 ET).
const PREVIEW_NOW = new Date('2026-09-23T14:00:00.000Z');
const PREVIEW_MONDAY = new Date('2026-09-21T14:00:00.000Z');
const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z'; // Sun 27 Sep 23:59 ET
const WED_FIRE = '2026-09-23T23:00:00.000Z';     // a slot pod's fire, Wed 7:00 PM ET

// ═══ the server's names (D-af) — each team by its PRIMARY AGENT, the player secondary ═══
// Mira's agent is Kestrel and Draco's is Tarn (the cards below say so); the
// house seats are named by their agents (cpuDisplayName, the one CPU format).
const AGENT_NAMES = Object.freeze({
  'od-a': Object.freeze({ label: 'Kestrel', secondary: 'Mira' }),
  'od-b': Object.freeze({ label: 'Tarn', secondary: 'Draco' }),
  'od-x': Object.freeze({ label: 'Orbit', secondary: 'Rigel' }),
  'cpu-1': Object.freeze({ label: 'CPU — Trend Follower', secondary: null }),
  'cpu-2': Object.freeze({ label: 'CPU — Contrarian', secondary: null }),
  'cpu-3': Object.freeze({ label: 'CPU — Diversifier', secondary: null }),
  'cpu-4': Object.freeze({ label: 'CPU — Speculator', secondary: null }),
});
const named = (id) => AGENT_NAMES[id] ?? { label: 'Unnamed team', secondary: null };
const teamLabel = (id) => named(id).label;
/**
 * The two layers the team-labels route also answers for each team — the
 * player and the agent, named apart (this build's review record, RAWID-R-2);
 * a CPU seat is its own agent.
 */
const LAYERS = Object.freeze({
  'od-a': Object.freeze({ player: 'Mira', agent: 'Kestrel' }),
  'od-b': Object.freeze({ player: 'Draco', agent: 'Tarn' }),
  'od-x': Object.freeze({ player: 'Rigel', agent: 'Orbit' }),
  'cpu-1': Object.freeze({ player: 'CPU — Trend Follower', agent: 'CPU — Trend Follower' }),
  'cpu-2': Object.freeze({ player: 'CPU — Contrarian', agent: 'CPU — Contrarian' }),
  'cpu-3': Object.freeze({ player: 'CPU — Diversifier', agent: 'CPU — Diversifier' }),
  'cpu-4': Object.freeze({ player: 'CPU — Speculator', agent: 'CPU — Speculator' }),
});
/** `labelsById` for the in-play pods — what useMyBacking fetches from the team-labels route, in its full shape. */
const labelsFor = (...groupIds) => Object.fromEntries(groupIds.map((groupId) => [
  groupId,
  Object.fromEntries(Object.entries(AGENT_NAMES).map(([id, names]) => [id, { ...names, ...LAYERS[id] }])),
]));

// ═══ the strip's inputs — scripts/backing-screenshots/harness.render.jsx ═══
const stripSeats = [
  { odUserId: 'od-a', isCpu: false, ...named('od-a'), isOwnSeat: false, backable: true },
  { odUserId: 'od-b', isCpu: false, ...named('od-b'), isOwnSeat: false, backable: true },
  { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), isOwnSeat: false, backable: true },
  { odUserId: 'cpu-2', isCpu: true, ...named('cpu-2'), isOwnSeat: false, backable: true },
];
const stripPod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40',
  humanTeams: 2, teams: stripSeats,
  pool: { status: 'open', closesAt: SUNDAY_CLOSE, closeReason: 'clock', backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false } },
  myStakes: [],
  ...over,
});
const nothingInPlay = { stakes: [], poolsById: {}, groupsById: {}, loading: false };
const battleGroup = (over = {}) => ({
  status: 'battle', baseLayerWeek: '2026-W39', seatNames: { 'od-a': 'Mira', 'od-x': 'Rigel' },
  players: [{ odUserId: 'od-a' }, { odUserId: 'od-x' }, { odUserId: 'cpu-3', isCpu: true }, { odUserId: 'cpu-4', isCpu: true }],
  dailyScores: {
    day1: { closeScores: { 'od-a': { compositePoints: 2.1 }, 'od-x': { compositePoints: 3.0 }, 'cpu-3': { compositePoints: 1.0 }, 'cpu-4': { compositePoints: -0.4 } } },
    day2: { closeScores: { 'od-a': { compositePoints: 4.8 }, 'od-x': { compositePoints: 5.1 }, 'cpu-3': { compositePoints: 1.2 }, 'cpu-4': { compositePoints: -0.5 } } },
  },
  ...over,
});
const STRIP_INPUTS = {
  open: {
    pods: [stripPod('lobby-w40-a'), stripPod('lobby-w40-b'), stripPod('lds-wed-1900', { formationPath: 'slot', slotId: 'wed-1900', pool: { status: 'open', closesAt: WED_FIRE, closeReason: 'fire', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false } } })],
    inPlay: nothingInPlay,
  },
  staked: {
    pods: [
      stripPod('lobby-w40-a', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: teamLabel('od-a'), amount: 250, status: 'live' }] }),
      stripPod('lobby-w40-b', { myStakes: [{ stakeId: 's2', teamOdUserId: 'cpu-1', teamLabel: teamLabel('cpu-1'), amount: 100, status: 'live' }] }),
      stripPod('lobby-w40-c'),
    ],
    inPlay: nothingInPlay,
  },
  week: {
    pods: [stripPod('lobby-w40-a')],
    inPlay: {
      stakes: [
        { id: 's9', groupId: 'lobby-w39-a', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' },
        { id: 's10', groupId: 'lobby-w39-b', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W39' },
      ],
      poolsById: { 'lobby-w39-a': { status: 'closed', closesAt: '2026-09-21T03:59:59.000Z' }, 'lobby-w39-b': { status: 'closed', closesAt: '2026-09-21T03:59:59.000Z' } },
      groupsById: { 'lobby-w39-a': battleGroup(), 'lobby-w39-b': battleGroup({ seatNames: { 'od-x': 'Rigel', 'od-a': 'Mira' } }) },
      labelsById: labelsFor('lobby-w39-a', 'lobby-w39-b'),
      loading: false,
    },
  },
  between: {
    pods: [],
    inPlay: {
      stakes: [{ id: 's7', groupId: 'lobby-w39-a', teamOdUserId: 'od-a', amount: 250, status: 'settled', weekKey: '2026-W39' }],
      poolsById: { 'lobby-w39-a': { status: 'resolved' } },
      groupsById: { 'lobby-w39-a': battleGroup({ status: 'complete' }) },
      loading: false,
    },
  },
};

// ═══ the two landings — backingLanding.test.jsx ═══
// A real-shaped base-layer group and NO bracket — today's production state.
const baseGroup = {
  id: 'wk-real-1', status: 'battle', roundNumber: 1, baseLayerWeek: '2026-W39',
  players: [{ odUserId: 'u1', picks: [] }, { odUserId: 'cpu-1', isCpu: true, picks: [] }, { odUserId: 'u2', picks: [] }, { odUserId: 'cpu-2', isCpu: true, picks: [] }],
  dailyScores: { day1: { closeScores: { u1: { compositePoints: 3.2 }, u2: { compositePoints: 1.1 } } } },
};
const LANDINGS = {
  'no-bracket': buildLeagueState({ fieldGroups: [baseGroup], names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1' }).state,
  bracket: leagueState('open'),
};
// The seated viewer (see the header): their group in battle, a practice pod open.
const SEATED_GROUP = baseGroup;
const PRACTICE_POD = { id: 'preview-practice-pod', status: GROUP_STATUS.BATTLE };

// ═══ the pod list — PodList.test.jsx ═══
const listTeams = (over = {}) => ([
  { odUserId: 'od-a', isCpu: false, ...named('od-a'), isOwnSeat: false, backable: true, ...(over['od-a'] || {}) },
  { odUserId: 'od-b', isCpu: false, ...named('od-b'), isOwnSeat: false, backable: true, ...(over['od-b'] || {}) },
  { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), isOwnSeat: false, backable: true, ...(over['cpu-1'] || {}) },
  { odUserId: 'cpu-2', isCpu: true, ...named('cpu-2'), isOwnSeat: false, backable: true, ...(over['cpu-2'] || {}) },
]);
const listPod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40',
  humanTeams: 2,
  teams: listTeams(),
  pool: { status: 'open', backerProgress: { count: 2, floor: 3, met: false }, teamSpread: { met: false }, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
  myStakes: [],
  ...over,
});
const POD_LIST_PODS = {
  'below-floor': listPod('g1'),
  qualified: listPod('g1', { pool: { status: 'open', backerProgress: { count: 3, floor: 3, met: true }, teamSpread: { met: true }, closesAt: SUNDAY_CLOSE } }),
  revealed: listPod('g-closed', {
    pool: { status: 'closed', potTotal: 1200, uniqueBackers: 5, validity: { backers: 5, minBackers: 3, teams: 2, minTeams: 2 }, closesAt: SUNDAY_CLOSE, closeReason: 'clock' },
    teams: listTeams({ 'od-a': { stakeTotal: 700, backerCount: 3, paysX: 1.71 }, 'od-b': { stakeTotal: 500, backerCount: 2 }, 'cpu-1': { stakeTotal: 0, backerCount: 0 }, 'cpu-2': { stakeTotal: 0, backerCount: 0 } }),
  }),
  'your-pod': listPod('g-mine', { teams: listTeams({ 'od-a': { isOwnSeat: true, backable: false }, 'od-b': { backable: false }, 'cpu-1': { backable: false }, 'cpu-2': { backable: false } }) }),
};

// ═══ the team card — the screenshot harness (first week, veteran), TeamCard.test.jsx (CPU, own) ═══
const APPROACH = 'Goes where the momentum is — and leaves the moment it fades.';
const cardSeat = (over = {}) => ({ index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false, ...over });
const CARD_POD = { groupId: 'lobby-w40-a', pool: { status: 'open', closesAt: SUNDAY_CLOSE }, myStakes: [] };
const FIRST_WEEK_CARD = {
  groupId: 'lobby-w40-a', odUserId: 'od-b', viewerUid: 'viewer-1',
  seat: cardSeat({ index: 2 }),
  team: { displayName: 'Draco', ...named('od-b'), isCpu: false, pitch: 'Macro guy. Tarn keeps me from being too early.', derived: null,
    agent: { name: 'Tarn', archetype: 'analyst', archetypeLabel: 'Fundamental Investor', approach: 'Buys quality companies and lets the fundamentals do the work.', traitCount: 3, ruleCount: 5 } },
  known: null,
  lastWeek: null,
};
const VETERAN_CARD = {
  groupId: 'lobby-w40-a', odUserId: 'od-a', viewerUid: 'viewer-1',
  seat: cardSeat(),
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
  groupId: 'g-now', odUserId: 'cpu-1', viewerUid: 'viewer-1',
  seat: cardSeat({ index: 3, isCpu: true }),
  team: { displayName: 'CPU — Trend Follower', ...named('cpu-1'), isCpu: true, pitch: null, derived: null,
    agent: { name: 'CPU — Trend Follower', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: APPROACH, traitCount: 0, ruleCount: 0 } },
  known: null,
  lastWeek: null,
};
// The viewer's own card: the veteran, seated as the viewer (TeamCard.test.jsx "reads as yours").
const OWN_CARD = { ...VETERAN_CARD, seat: cardSeat({ viewerSeated: true, isViewer: true }) };

// ═══ the stake control — StakeControl.jsdom.test.jsx ═══
const STAKE_CARD = {
  groupId: 'g1', odUserId: 'od-a', viewerUid: 'viewer-1',
  seat: { index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false },
  team: { displayName: 'Mira', ...named('od-a'), isCpu: false, pitch: null, derived: null, agent: { name: 'Kestrel', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: 'x', traitCount: 4, ruleCount: 7 } },
  known: null, lastWeek: null,
};
const STAKE_POD = { groupId: 'g1', pool: { status: 'open', closesAt: SUNDAY_CLOSE }, myStakes: [] };
const STAKE_WALLET = { known: true, left: 1000, total: 1000 };
// D-ag (Amendment C §C2): the viewer already holds a live stake on this team —
// one stake per team per backer, so Confirm ADDS to it (fixture:
// StakeControl.jsdom.test.jsx, the top-up rows).
const TOP_UP_ALREADY = 250;
const TOP_UP_POD = { ...STAKE_POD, myStakes: [{ stakeId: 'preview-stake-0', teamOdUserId: 'od-a', teamLabel: teamLabel('od-a'), amount: TOP_UP_ALREADY, status: 'live' }] };
const TOP_UP_WALLET = { ...STAKE_WALLET, left: STAKE_WALLET.left - TOP_UP_ALREADY };

// ═══ Your Backing — YourBacking.test.jsx ═══
const leg = (direction) => ({ direction, openedAt: '2026-09-21T11:00:00.000Z' });
const weekGroup = (over = {}) => ({
  status: 'battle', baseLayerWeek: '2026-W39',
  seatNames: { 'od-a': 'Mira', 'od-x': 'Rigel' },
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
    { id: 's2', groupId: 'g-play', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' },
    { id: 's3', groupId: 'g-two', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W39' },
    { id: 's4', groupId: 'g-next', teamOdUserId: 'od-a', amount: 50, status: 'live', weekKey: '2026-W40' },
  ],
  poolsById: { 'g-play': { status: 'closed' }, 'g-two': { status: 'closed' }, 'g-next': { status: 'open' } },
  groupsById: { 'g-play': weekGroup(), 'g-two': weekGroup({ seatNames: { 'od-x': 'Rigel' } }) },
  labelsById: labelsFor('g-play', 'g-two', 'g-next', 'lds-wed'),
  ...over,
});
const KESTREL_BATTLE = {
  ownerId: 'od-a', status: 'active', _whyConcealed: true,
  agentContext: { agentName: 'Kestrel', archetype: 'momentum_chaser', initialPortfolio: { star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], core: [{ symbol: 'AVGO' }, { symbol: 'ANET' }], support: [{ symbol: 'VST' }, { symbol: 'META' }] } },
};
const WEEK_BATTLES = { 'g-play': { 'od-a': KESTREL_BATTLE }, 'g-two': {} };
const WEEK_INPUTS = {
  // A slot pod that fired Wednesday: locked in, not started (the R-B-2 row).
  'before-monday': {
    now: PREVIEW_NOW,
    inPlay: weekInPlay({
      stakes: [{ id: 's1', groupId: 'lds-wed', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W40' }],
      poolsById: { 'lds-wed': { status: 'closed' } },
      groupsById: { 'lds-wed': weekGroup({ status: 'drafting', dailyScores: {} }) },
    }),
    battlesByGroup: {},
  },
  // Monday morning: drafted, in battle, no close banked yet — the draft reveal.
  monday: {
    now: PREVIEW_MONDAY,
    inPlay: weekInPlay({ groupsById: { 'g-play': weekGroup({ dailyScores: {} }), 'g-two': weekGroup({ seatNames: { 'od-x': 'Rigel' }, dailyScores: {} }) } }),
    battlesByGroup: WEEK_BATTLES,
  },
  'mid-week': { now: PREVIEW_NOW, inPlay: weekInPlay(), battlesByGroup: WEEK_BATTLES },
};

// ═══ the results card — BackingResultsCard.test.jsx (PR 5, Surface E) ═══
// MUTATION CHECK 3's fixture: the stake document's payout (714) is NOT
// stake × pays × (500 × 1.43 = 715); the card must show 714.
const resultPod = (over = {}) => ({
  groupId: 'lobby-w39-a', poolId: 'lobby-w39-a', weekKey: '2026-W39', status: 'resolved', outcome: 'settled', formationPath: 'lobby', slotId: null,
  humanTeams: 2, potTotal: 1000, uniqueBackers: 4, winners: ['od-a'], winnerLabels: [teamLabel('od-a')], winningStakes: 700, paysX: 1.43,
  closedAt: '2026-09-21T04:00:00.000Z', settledAt: '2026-09-25T22:30:00.000Z', refundedAt: null, refundReason: null, holdReason: null, monthKey: '2026-09',
  teams: [
    { odUserId: 'od-a', isCpu: false, ...named('od-a'), backerCount: 2, stakeTotal: 700, sharePct: 70, paysX: 1.43, won: true },
    { odUserId: 'od-b', isCpu: false, ...named('od-b'), backerCount: 2, stakeTotal: 300, sharePct: 30, paysX: 3.33, won: false },
    { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: false },
  ],
  myStakes: [
    { stakeId: 's1', teamOdUserId: 'od-a', teamLabel: teamLabel('od-a'), amount: 500, status: 'won', payout: 714, voidReason: null, net: 214, loadoutChanged: true },
    { stakeId: 's2', teamOdUserId: 'od-b', teamLabel: teamLabel('od-b'), amount: 100, status: 'lost', payout: 0, voidReason: null, net: -100, loadoutChanged: false },
  ],
  myNet: 114, myWon: true,
  ...over,
});
const voidedPod = (outcome, refundReason) => resultPod({
  outcome, status: outcome === 'insufficient' ? 'insufficient' : 'refunded', refundReason, refundedAt: '2026-09-22T20:30:00.000Z',
  winners: [], winnerLabels: [], paysX: null, winningStakes: null, myNet: null, myWon: null,
  teams: resultPod().teams.map((t) => ({ ...t, paysX: null, won: null })),
  myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: teamLabel('od-a'), amount: 500, status: 'voided', payout: null, voidReason: refundReason ?? 'insufficient', net: 0, loadoutChanged: null }],
  // A pool that DID miss the floor: two backers on two teams (§3 asks ≥3 backers).
  ...(outcome === 'insufficient' ? {
    potTotal: 800, uniqueBackers: 2,
    teams: [
      { odUserId: 'od-a', isCpu: false, ...named('od-a'), backerCount: 1, stakeTotal: 500, sharePct: 63, paysX: null, won: null },
      { odUserId: 'od-b', isCpu: false, ...named('od-b'), backerCount: 1, stakeTotal: 300, sharePct: 38, paysX: null, won: null },
      { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: null },
    ],
  } : {}),
});
const RESULT_PODS = {
  win: resultPod(),
  loss: resultPod({
    winners: ['od-b'], winnerLabels: [teamLabel('od-b')], winningStakes: 300, paysX: 3.33,
    teams: [
      { odUserId: 'od-a', isCpu: false, ...named('od-a'), backerCount: 2, stakeTotal: 700, sharePct: 70, paysX: 1.43, won: false },
      { odUserId: 'od-b', isCpu: false, ...named('od-b'), backerCount: 2, stakeTotal: 300, sharePct: 30, paysX: 3.33, won: true },
      { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: false },
    ],
    myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: teamLabel('od-a'), amount: 500, status: 'lost', payout: 0, voidReason: null, net: -500, loadoutChanged: false }],
    myNet: -500, myWon: false,
  }),
  refunded: voidedPod('refunded', 'group_voided'),
  insufficient: voidedPod('insufficient', null),
};

// ═══ the private stats — BackingStats.test.jsx (PR 5) ═══
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

/** The fixture table — exported for the page's own test only. */
export const PREVIEW_FIXTURES = Object.freeze({ now: PREVIEW_NOW, backingWeekCloses: SUNDAY_CLOSE, strip: STRIP_INPUTS, results: RESULT_PODS, stats: { mine: MY_STATS, trainer: TRAINER_STATS } });

// ═══ the desktop states — the same fixtures, through the desktop components ═══
// The draft-slot picker's week (invented labels, the endpoint's shape).
const DESK_SLOTS = Object.freeze([
  { slotId: 'sun-1900', groupId: 'lds-sun-1900', label: 'Sun 7:00pm ET', humanCount: 2, isFull: false, enabled: true, seats: [] },
  { slotId: 'mon-0845', groupId: 'lds-mon-0845', label: 'Mon 8:45am ET', humanCount: 0, isFull: false, enabled: true, seats: [] },
]);
const DESK_OWN_POD = 'g-mine';
// The window's pods: the strip's open pods, and the viewer's own pod (reads as yours).
const deskPods = (myStakesA = []) => [
  stripPod('lobby-w40-a', { myStakes: myStakesA }),
  stripPod('lobby-w40-b'),
  stripPod('lds-wed-1900', { formationPath: 'slot', slotId: 'wed-1900', pool: { status: 'open', closesAt: WED_FIRE, closeReason: 'fire', backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false } } }),
  { ...POD_LIST_PODS['your-pod'], groupId: DESK_OWN_POD },
];
const DESK_TOP_UP = [{ stakeId: 'preview-stake-0', teamOdUserId: 'od-a', teamLabel: teamLabel('od-a'), amount: TOP_UP_ALREADY, status: 'live' }];
/** The card for any seat the window shows — the harness and suites' projections, re-seated. */
function deskCardFor(groupId, odUserId) {
  const pod = deskPods().find((p) => p.groupId === groupId) ?? null;
  const index = Math.max(0, pod?.teams.findIndex((t) => t.odUserId === odUserId) ?? 0) + 1;
  if (groupId === DESK_OWN_POD && odUserId === 'od-a') return { ...OWN_CARD, groupId };
  const base = odUserId === 'od-a' ? VETERAN_CARD : odUserId === 'od-b' ? FIRST_WEEK_CARD : CPU_CARD;
  const card = { ...base, groupId, odUserId, seat: { ...base.seat, index, viewerSeated: groupId === DESK_OWN_POD } };
  if (!odUserId.startsWith('cpu-')) return card;
  const n = named(odUserId);
  return { ...card, team: { ...CPU_CARD.team, displayName: n.label, ...n, agent: { ...CPU_CARD.team.agent, name: n.label, archetypeLabel: n.label.replace('CPU — ', '') } } };
}
const onCard = (groupId, odUserId, kind = 'card') => ({ kind, groupId, odUserId });
const LIST = Object.freeze({ kind: 'list', groupId: null, odUserId: null });
/** Each desktop Backing-screen state: its pods, wallet, attestation, view and section. */
const DESK_SCREENS = {
  list: { view: LIST, pods: deskPods(DESK_TOP_UP), wallet: TOP_UP_WALLET },
  'first-week': { view: onCard('lobby-w40-a', 'od-b') },
  veteran: { view: onCard('lobby-w40-a', 'od-a') },
  cpu: { view: onCard('lobby-w40-a', 'cpu-1') },
  own: { view: onCard(DESK_OWN_POD, 'od-a') },
  attest: { view: onCard('lobby-w40-a', 'od-b', 'stake'), attested: false },
  stake: { view: onCard('lobby-w40-a', 'od-b', 'stake') },
  'top-up': { view: onCard('lobby-w40-a', 'od-a', 'stake'), pods: deskPods(DESK_TOP_UP), wallet: TOP_UP_WALLET },
  backed: { view: onCard('lobby-w40-a', 'od-b', 'stake'), press: true },
  refusal: { view: onCard('lobby-w40-a', 'od-b', 'stake'), press: true, refuse: 'pool_closed' },
  'week-before-monday': { section: DESK_SECTION.WEEK, week: 'before-monday' },
  'week-monday': { section: DESK_SECTION.WEEK, week: 'monday' },
  'week-mid-week': { section: DESK_SECTION.WEEK, week: 'mid-week' },
  'results-win': { section: DESK_SECTION.RESULTS, result: 'win' },
  'results-loss': { section: DESK_SECTION.RESULTS, result: 'loss' },
  'results-refunded': { section: DESK_SECTION.RESULTS, result: 'refunded' },
  'results-insufficient': { section: DESK_SECTION.RESULTS, result: 'insufficient' },
};

// ═══ the switcher ═══
const GROUPS = [
  { id: 'strip', label: 'Landing strip' },
  { id: 'pods', label: 'Pod list' },
  { id: 'card', label: 'Team card' },
  { id: 'stake', label: 'Stake control' },
  { id: 'week', label: 'Your Backing' },
  { id: 'results', label: 'Results' },
  { id: 'stats', label: 'Beta stats' },
];
const STRIP_KINDS = [['open', 'Open'], ['staked', 'Staked'], ['week', 'Week'], ['between', 'Between']];
export const PREVIEW_STATES = [
  ...STRIP_KINDS.flatMap(([kind, label]) => [
    { id: `strip-${kind}-no-bracket`, group: 'strip', label: `${label} · no bracket`, kind, landing: 'no-bracket' },
    { id: `strip-${kind}-bracket`, group: 'strip', label: `${label} · bracket`, kind, landing: 'bracket' },
  ]),
  { id: 'pods-below-floor', group: 'pods', label: 'Open · below the floor', pod: 'below-floor' },
  { id: 'pods-qualified', group: 'pods', label: 'Open · qualified', pod: 'qualified' },
  { id: 'pods-revealed', group: 'pods', label: 'Closed · revealed', pod: 'revealed' },
  { id: 'pods-your-pod', group: 'pods', label: 'Your own pod', pod: 'your-pod' },
  { id: 'card-first-week', group: 'card', label: 'First week', card: FIRST_WEEK_CARD, source: 'the screenshot harness' },
  { id: 'card-veteran', group: 'card', label: 'Veteran', card: VETERAN_CARD, source: 'the screenshot harness' },
  { id: 'card-cpu', group: 'card', label: 'CPU seat', card: CPU_CARD, source: 'TeamCard.test.jsx' },
  { id: 'card-own', group: 'card', label: 'Your own card', card: OWN_CARD, source: 'TeamCard.test.jsx' },
  { id: 'stake-attest', group: 'stake', label: 'Attestation required', variant: 'attest' },
  { id: 'stake-attested', group: 'stake', label: 'Attestation done', variant: 'attested' },
  { id: 'stake-refusal', group: 'stake', label: 'A refusal', variant: 'refusal' },
  { id: 'stake-backed', group: 'stake', label: 'Backed', variant: 'backed' },
  { id: 'stake-top-up', group: 'stake', label: 'Adding to a stake', variant: 'top-up' },
  { id: 'week-before-monday', group: 'week', label: 'Before Monday', week: 'before-monday' },
  { id: 'week-monday', group: 'week', label: 'Monday · draft reveal', week: 'monday' },
  { id: 'week-mid-week', group: 'week', label: 'Mid-week', week: 'mid-week' },
  { id: 'results-win', group: 'results', label: 'Settled · you won', result: 'win' },
  { id: 'results-loss', group: 'results', label: 'Settled · you lost', result: 'loss' },
  { id: 'results-refunded', group: 'results', label: 'Refunded', result: 'refunded' },
  { id: 'results-insufficient', group: 'results', label: 'Did not qualify', result: 'insufficient' },
  { id: 'stats-mine', group: 'stats', label: 'Your backing', stats: 'mine' },
  { id: 'stats-trainer', group: 'stats', label: 'As a team', stats: 'trainer' },
];
const DESK_GROUPS = [
  { id: 'desk-landing', label: 'Landing' },
  { id: 'desk-window', label: 'Backing · the window' },
  { id: 'desk-week', label: 'Your Backing' },
  { id: 'desk-results', label: 'Results' },
  { id: 'desk-profile', label: 'Stats beside the pitch' },
];
const SEATS = [['unseated', 'not seated'], ['seated', 'seated']];
const LANDING_KINDS = [['no-bracket', 'no bracket'], ['bracket', 'bracket']];
export const PREVIEW_DESKTOP_STATES = [
  ...STRIP_KINDS.flatMap(([kind, label]) => SEATS.flatMap(([seat, seatLabel]) => LANDING_KINDS.map(([landing, landingLabel]) => (
    { id: `desk-landing-${kind}-${seat}-${landing}`, group: 'desk-landing', label: `${label} · ${seatLabel} · ${landingLabel}`, kind, seat, landing }
  )))),
  { id: 'desk-window-list', group: 'desk-window', label: 'No card yet', screen: 'list' },
  { id: 'desk-window-first-week', group: 'desk-window', label: 'First-week card', screen: 'first-week' },
  { id: 'desk-window-veteran', group: 'desk-window', label: 'Veteran card', screen: 'veteran' },
  { id: 'desk-window-cpu', group: 'desk-window', label: 'CPU seat', screen: 'cpu' },
  { id: 'desk-window-own', group: 'desk-window', label: 'Your own pod', screen: 'own' },
  { id: 'desk-window-attest', group: 'desk-window', label: 'Attestation', screen: 'attest' },
  { id: 'desk-window-stake', group: 'desk-window', label: 'Stake control', screen: 'stake' },
  { id: 'desk-window-top-up', group: 'desk-window', label: 'Topping up', screen: 'top-up' },
  { id: 'desk-window-backed', group: 'desk-window', label: 'Backed', screen: 'backed' },
  { id: 'desk-window-refusal', group: 'desk-window', label: 'A refusal', screen: 'refusal' },
  { id: 'desk-week-before-monday', group: 'desk-week', label: 'Before Monday', screen: 'week-before-monday' },
  { id: 'desk-week-monday', group: 'desk-week', label: 'Monday · draft reveal', screen: 'week-monday' },
  { id: 'desk-week-mid-week', group: 'desk-week', label: 'Mid-week', screen: 'week-mid-week' },
  { id: 'desk-results-win', group: 'desk-results', label: 'Settled · you won', screen: 'results-win' },
  { id: 'desk-results-loss', group: 'desk-results', label: 'Settled · you lost', screen: 'results-loss' },
  { id: 'desk-results-refunded', group: 'desk-results', label: 'Refunded', screen: 'results-refunded' },
  { id: 'desk-results-insufficient', group: 'desk-results', label: 'Did not qualify', screen: 'results-insufficient' },
  { id: 'desk-profile-record', group: 'desk-profile', label: 'Your record', stats: 'mine' },
  { id: 'desk-profile-trainer', group: 'desk-profile', label: 'As a team', stats: 'trainer' },
];
/** Where the desktop strip's door leads, per state — the section the strip points to. */
const DESK_DOOR = { open: 'desk-window-list', staked: 'desk-window-list', week: 'desk-week-mid-week', between: 'desk-results-win' };
const STATE_BY_ID = Object.fromEntries([...PREVIEW_STATES, ...PREVIEW_DESKTOP_STATES].map((s) => [s.id, s]));
const isDesktopState = (state) => state.group.startsWith('desk-');

function captionFor(state) {
  switch (state.group) {
    case 'desk-landing':
      return `The desktop League (the real DeskLobby — the content area of a 1440-wide window), ${state.seat === 'seated' ? 'the viewer seated this week (the waiting room is the centre)' : 'the viewer not seated (the draft-slot picker is the centre)'}, ${state.landing === 'bracket' ? 'the fixture bracket' : 'no bracket — today’s production'}. The strip, in its “${state.kind}” state, sits directly under the entry. Tap it.`;
    case 'desk-window':
      return 'The Backing screen on desktop during the window (the real BackingDesk, full-window at 1440×900): the pods left, the team card centre, your backing right — the stake control, and the attestation step, swap into the right column. Every answer is local fixture data.';
    case 'desk-week':
      return 'Monday–Friday on desktop: Your Backing takes the whole screen (fixture: YourBacking.test.jsx). No stake action exists on this surface.';
    case 'desk-results':
      return 'Friday on desktop: the results take the whole screen, the viewer’s private record beside them (fixtures: BackingResultsCard.test.jsx, BackingStats.test.jsx).';
    case 'desk-profile':
      return 'The private record and the trainer beta stats in their desktop home — the agent/profile column (IdentityPanel), directly beside the pitch — the real views, from fixtures.';
    case 'strip':
      return `The strip in its “${state.kind}” state (inputs: the screenshot harness), on ${state.landing === 'bracket'
        ? 'the League’s fixture bracket landing'
        : 'a base-layer week with no bracket — today’s production state'}. The viewer is seated with a practice pod, so the landing opens no live read. Tap the strip.`;
    case 'pods':
      return 'The pod list (fixture: PodList.test.jsx). Tap a seat to open its team card.';
    case 'card':
      return `The team card (fixture: ${state.source}). Its call to action opens the stake control.`;
    case 'stake':
      if (state.variant === 'top-up') {
        return 'The stake control on a team you already back (fixture: StakeControl.jsdom.test.jsx). One stake per team: Confirm adds to it. Every answer is local fixture data.';
      }
      return state.variant === 'refusal' || state.variant === 'backed'
        ? 'The stake control (fixture: StakeControl.jsdom.test.jsx). The preview pressed Confirm; the answer is local fixture data.'
        : 'The stake control (fixture: StakeControl.jsdom.test.jsx). Every answer is local fixture data.';
    case 'results':
      return 'The results card (fixture: BackingResultsCard.test.jsx) as the Spectate final state and the Backing screen show it. Every figure is the projection’s — the payout per stake is the stake document’s, never stake × pays ×.';
    case 'stats':
      return 'The private stats (fixture: BackingStats.test.jsx) as the profile home shows them. Private, no consequences, not a ranking.';
    default:
      return 'Your Backing (fixture: YourBacking.test.jsx). No stake action exists on this surface.';
  }
}

function readInitialState() {
  try {
    const id = new URLSearchParams(window.location.search).get('state');
    if (id && STATE_BY_ID[id]) return id;
  } catch { /* no window: the first state */ }
  return PREVIEW_STATES[0].id;
}

// ═══ the stages ═══
function LandingStage({ state, onOpenStrip, onLeagueNav }) {
  const inputs = STRIP_INPUTS[state.kind];
  const stripState = deriveStripState({ pods: inputs.pods, inPlay: inputs.inPlay, now: PREVIEW_NOW, backingWeekCloses: SUNDAY_CLOSE });
  // The slot exactly as BackingLandingStrip renders it on the mobile landing
  // (the page's test holds the two byte-equal for every state).
  const slot = (
    <div data-backing="strip-slot" style={{ marginBottom: 18 }}>
      <BackingStrip state={stripState} accent={ACCENT} onOpen={onOpenStrip} />
    </div>
  );
  return (
    <div data-preview-stage="landing" style={{ position: 'relative', maxWidth: 448, margin: '0 auto', background: LTOKENS.bg, color: LTOKENS.ink }}>
      <Lobby
        st={LANDINGS[state.landing]}
        accent={ACCENT}
        onPickPod={onLeagueNav}
        onSpectate={onLeagueNav}
        onOpenMyGame={onLeagueNav}
        activeGroup={SEATED_GROUP}
        uid="u1"
        displayName="Alice"
        onOpenTrainingPod={onLeagueNav}
        activeTrainingPod={PRACTICE_POD}
        hasAgent
        backingSlot={slot}
      />
    </div>
  );
}

function ScreenFrame({ children, name }) {
  return (
    <div data-preview-stage={name} style={{ maxWidth: 448, margin: '0 auto', padding: '16px 18px 64px', color: LTOKENS.ink }}>
      {children}
    </div>
  );
}

function OwnPitchCard({ card, onBack, onOpenTape, onNote }) {
  const [text, setText] = useState(card.team.pitch ?? '');
  const save = useCallback(async (next) => {
    setText(next);
    onNote(NOTHING_SAVED);
    return true;
  }, [onNote]);
  const myPitch = { text, loaded: true, saving: false, error: null, save };
  return <TeamCard card={card} pod={CARD_POD} accent={ACCENT} onBack={onBack} onOpenTape={onOpenTape} myPitch={myPitch} />;
}

function StakeStage({ variant, card, onNote, onReset }) {
  const [eligibility, setEligibility] = useState(variant === 'attest' ? ELIGIBILITY.REQUIRED : ELIGIBILITY.ATTESTED);
  const topUp = variant === 'top-up';
  const pod = topUp ? TOP_UP_POD : STAKE_POD;
  const wallet = topUp ? TOP_UP_WALLET : STAKE_WALLET;
  const requests = useRef(0);
  const services = useMemo(() => ({
    newRequestId: () => { requests.current += 1; return `preview-request-${requests.current}`; },
    attestEligibility: async () => { onNote(NOTHING_SAVED); return { eligible: true }; },
    placeStake: async ({ teamOdUserId, amount }) => {
      onNote(NOTHING_SAVED);
      if (variant === 'refusal') throw Object.assign(new Error('pool_closed'), { code: 'pool_closed' });
      // A top-up answers as the endpoint does: the ONE stake's new total, and what this Confirm added.
      const already = topUp ? TOP_UP_ALREADY : 0;
      return { ok: true, replay: false, topUp, added: amount, stake: { stakeId: `preview-stake-${requests.current}`, teamOdUserId, amount: already + amount, status: 'live' }, allowanceRemaining: wallet.left - amount };
    },
  }), [variant, onNote, topUp, wallet]);
  // "A refusal" and "Backed" land on their answer: the page presses the real
  // Confirm once (the control's own handler runs, against the local answers).
  const frame = useRef(null);
  const pressed = useRef(false);
  useEffect(() => {
    if (pressed.current || (variant !== 'refusal' && variant !== 'backed')) return;
    pressed.current = true;
    frame.current?.querySelector('[data-backing="confirm"]')?.click();
  }, [variant]);
  return (
    <div ref={frame} style={{ borderRadius: 18, padding: '14px 15px', background: `linear-gradient(165deg, ${alpha(ACCENT, 0.06)}, ${LTOKENS.surface} 58%)`, border: `1px solid ${alpha(ACCENT, 0.26)}` }}>
      <StakeControl
        card={card}
        pod={pod}
        wallet={wallet}
        eligibility={{ status: eligibility, refresh: () => setEligibility(ELIGIBILITY.ATTESTED) }}
        accent={ACCENT}
        services={services}
        onBacked={() => onNote(NOTHING_SAVED)}
        onClose={onReset}
      />
    </div>
  );
}

// ═══ the desktop stages ═══
// The lobby's own scroll model locks its root to the viewport height; inside
// the page's frame it fills the frame instead.
const DESK_FRAME_STYLE = '.bkp-desk-frame .ld-root { height: 100%; }';
function DeskFrame({ name, width, children }) {
  return (
    <div style={{ padding: '16px 0 40px', overflowX: 'auto' }}>
      <style>{DESK_FRAME_STYLE}</style>
      <div data-preview-stage={name} className="bkp-desk-frame" style={{ width, height: 900, margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: 12, border: `1px solid ${LTOKENS.hair2}`, background: LTOKENS.bg, color: LTOKENS.ink }}>
        {children}
      </div>
    </div>
  );
}

function DeskLandingStage({ state, onDoor, onLeagueNav, onNote }) {
  const inputs = STRIP_INPUTS[state.kind];
  const stripState = deriveStripState({ pods: inputs.pods, inPlay: inputs.inPlay, now: PREVIEW_NOW, backingWeekCloses: SUNDAY_CLOSE });
  // The slot exactly as BackingLandingStrip renders it on the desktop landing
  // (wide, bare — the page's test holds the two byte-equal for every state).
  const slot = (
    <div data-backing="strip-slot">
      <BackingStrip state={stripState} accent={ACCENT} onOpen={onDoor} wide />
    </div>
  );
  const slotServices = useMemo(() => ({
    fetchSlotSchedule: async () => ({ slots: DESK_SLOTS }),
    claimSlot: async () => { onNote(NOTHING_SAVED); return {}; },
    releaseSlot: async () => { onNote(NOTHING_SAVED); return {}; },
    quickPlay: async () => { onNote(NOTHING_SAVED); return {}; },
  }), [onNote]);
  const seated = state.seat === 'seated';
  return (
    <DeskFrame name="desk-landing" width={1220}>
      <DeskLobby
        st={LANDINGS[state.landing]}
        uid="u1"
        displayName="Alice"
        tab="ranked"
        onSwitchTab={onLeagueNav}
        activeGroup={seated ? SEATED_GROUP : null}
        preOpen={false}
        activeTrainingPod={seated ? PRACTICE_POD : null}
        onOpenMyGame={onLeagueNav}
        onOpenTrainingPod={onLeagueNav}
        hasAgent
        agentLoadout={null}
        selectedPod={null}
        onPickPod={onLeagueNav}
        onClosePod={onLeagueNav}
        onOpenGroupById={onLeagueNav}
        railTab="field"
        onRailTab={onLeagueNav}
        onSpectate={onLeagueNav}
        backingSlot={slot}
        slotServices={slotServices}
      />
    </DeskFrame>
  );
}

/** The desktop Backing screen over one fixture state — its view and section the page's own, as BackingScreen owns them in the app. */
function DeskScreenStage({ state, onNote, onLeagueNav, onOpenTape }) {
  const cfg = DESK_SCREENS[state.screen];
  const week = cfg.week ? WEEK_INPUTS[cfg.week] : null;
  const pods = cfg.pods ?? deskPods();
  const wallet = cfg.wallet ?? STAKE_WALLET;
  const inPlay = week ? week.inPlay : nothingInPlay;
  const now = week ? week.now : PREVIEW_NOW;
  const [view, setView] = useState(cfg.view ?? LIST);
  const [section, setSection] = useState(null);
  const [eligibility, setEligibility] = useState(cfg.attested === false ? ELIGIBILITY.REQUIRED : ELIGIBILITY.ATTESTED);
  const [pitchText, setPitchText] = useState(OWN_CARD.team.pitch ?? '');
  const savePitch = useCallback(async (next) => { setPitchText(next); onNote(NOTHING_SAVED); return true; }, [onNote]);
  const requests = useRef(0);
  const services = useMemo(() => ({
    newRequestId: () => { requests.current += 1; return `preview-request-${requests.current}`; },
    attestEligibility: async () => { onNote(NOTHING_SAVED); return { eligible: true }; },
    placeStake: async ({ teamOdUserId, amount }) => {
      onNote(NOTHING_SAVED);
      if (cfg.refuse) throw Object.assign(new Error(cfg.refuse), { code: cfg.refuse });
      const already = pods.find((p) => p.groupId === view.groupId)?.myStakes.filter((x) => x.teamOdUserId === teamOdUserId && x.status === 'live').reduce((n, x) => n + x.amount, 0) ?? 0;
      return { ok: true, replay: false, topUp: already > 0, added: amount, stake: { stakeId: `preview-stake-${requests.current}`, teamOdUserId, amount: already + amount, status: 'live' }, allowanceRemaining: wallet.left - amount };
    },
  }), [cfg, onNote, pods, view.groupId, wallet]);
  const pressed = useRef(false);
  const frame = useRef(null);
  useEffect(() => {
    if (pressed.current || !cfg.press) return;
    pressed.current = true;
    frame.current?.querySelector('[data-desk-col="right"] [data-backing="confirm"]')?.click();
  }, [cfg.press]);

  const stripState = deriveStripState({ pods, inPlay, now, backingWeekCloses: SUNDAY_CLOSE });
  const windowState = deriveStripState({ pods, inPlay: null, now, backingWeekCloses: SUNDAY_CLOSE });
  const backed = backedPodsFor(inPlay).length;
  const sections = deskSections(backed);
  const current = section != null && sections.includes(section) ? section : (cfg.section ?? deskDefaultSection(stripState, backed));
  const card = view.kind !== 'list' && view.groupId ? deskCardFor(view.groupId, view.odUserId) : null;
  const results = cfg.result ? { weeks: [{ weekKey: RESULT_PODS[cfg.result].weekKey, pools: [RESULT_PODS[cfg.result]] }], loading: false, nextBefore: null } : { weeks: [], loading: false, nextBefore: null };
  return (
    <DeskFrame name="desk-screen" width={1440}>
      <div ref={frame} style={{ height: '100%' }}>
        <BackingDesk
          accent={ACCENT}
          uid="viewer-1"
          pods={{ data: { baseLayerWeek: '2026-W40', backingWeekCloses: SUNDAY_CLOSE }, pods, loading: false, error: null }}
          state={stripState}
          windowState={windowState}
          inPlay={inPlay}
          wallet={wallet}
          eligibility={{ status: eligibility, refresh: () => setEligibility(ELIGIBILITY.ATTESTED) }}
          myPitch={{ text: pitchText, loaded: true, saving: false, error: null, save: savePitch }}
          view={view}
          cardQuery={{ card, loading: false }}
          pod={view.groupId ? pods.find((p) => p.groupId === view.groupId) ?? null : null}
          section={current}
          sections={sections}
          onSection={(next) => { setSection(next); if (next !== DESK_SECTION.WINDOW) setView(LIST); }}
          onBack={onLeagueNav}
          onOpenSeat={(groupId, odUserId) => setView({ kind: 'card', groupId, odUserId })}
          onToStake={() => setView((v) => ({ ...v, kind: 'stake' }))}
          onToCard={() => setView((v) => ({ ...v, kind: 'card' }))}
          onBacked={() => onNote(NOTHING_SAVED)}
          onOpenTape={onOpenTape}
          results={results}
          myStats={{ data: MY_STATS, loading: false }}
          now={now}
          services={services}
          battlesByGroup={week ? week.battlesByGroup : {}}
        />
      </div>
    </DeskFrame>
  );
}

/** The stats' desktop home — the agent/profile column (IdentityPanel's), beside the pitch: the real views, from fixtures. */
function DeskProfileStage({ state, onNote }) {
  const [text, setText] = useState('I back breadth, and my agent keeps me honest.');
  const save = useCallback(async (next) => { setText(next); onNote(NOTHING_SAVED); return true; }, [onNote]);
  return (
    <DeskFrame name="desk-profile" width={1220}>
      <div style={{ padding: '22px 30px', height: '100%', boxSizing: 'border-box' }}>
        <div data-preview-column="identity" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ScoutingLineView pitch={{ text, loaded: true, saving: false, error: null, save }} agentName="Prime" accent={ACCENT} />
          <StatsEntryView mine={{ data: MY_STATS, loading: false }} trainer={{ data: TRAINER_STATS, loading: false }} accent={ACCENT} initialTab={state.stats} />
        </div>
      </div>
    </DeskFrame>
  );
}

// ═══ the page ═══
export default function BackingPreviewScreen() {
  const [stateId, setStateId] = useState(readInitialState);
  const [nonce, setNonce] = useState(0);
  const [note, setNote] = useState(null);
  const [stakeCard, setStakeCard] = useState(STAKE_CARD);
  const state = STATE_BY_ID[stateId];

  const select = useCallback((id, { card = STAKE_CARD } = {}) => {
    setStateId(id);
    setNonce((n) => n + 1);
    setNote(null);
    setStakeCard(card);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('state', id);
      window.history.replaceState(null, '', url);
    } catch { /* no history: the switcher still works */ }
  }, []);
  const onNote = useCallback((text) => setNote(text), []);
  const onLeagueNav = useCallback(() => setNote('preview — League navigation is off on this page'), []);
  const onOpenTape = useCallback(() => setNote('preview — in the app this opens the week’s film room'), []);
  const onOpenSeat = useCallback((pod, team) => {
    if (team.isOwnSeat) select('card-own');
    else if (team.isCpu) select('card-cpu');
    else if (team.odUserId === 'od-b') select('card-first-week');
    else select('card-veteran');
  }, [select]);

  let stage;
  if (state.group === 'desk-landing') {
    stage = <DeskLandingStage state={state} onDoor={() => select(DESK_DOOR[state.kind])} onLeagueNav={onLeagueNav} onNote={onNote} />;
  } else if (state.group === 'desk-window' || state.group === 'desk-week' || state.group === 'desk-results') {
    stage = <DeskScreenStage state={state} onNote={onNote} onLeagueNav={onLeagueNav} onOpenTape={onOpenTape} />;
  } else if (state.group === 'desk-profile') {
    stage = <DeskProfileStage state={state} onNote={onNote} />;
  } else if (state.group === 'strip') {
    stage = <LandingStage state={state} onOpenStrip={() => select('pods-below-floor')} onLeagueNav={onLeagueNav} />;
  } else if (state.group === 'pods') {
    stage = <ScreenFrame name="pods"><PodList pods={[POD_LIST_PODS[state.pod]]} accent={ACCENT} onOpenSeat={onOpenSeat} /></ScreenFrame>;
  } else if (state.group === 'card') {
    const toStake = () => select('stake-attested', { card: state.card });
    stage = (
      <ScreenFrame name="card">
        {state.card.seat.isViewer
          ? <OwnPitchCard card={state.card} onBack={toStake} onOpenTape={onOpenTape} onNote={onNote} />
          : <TeamCard card={state.card} pod={CARD_POD} accent={ACCENT} onBack={toStake} onOpenTape={onOpenTape} />}
      </ScreenFrame>
    );
  } else if (state.group === 'stake') {
    stage = <ScreenFrame name="stake"><StakeStage variant={state.variant} card={stakeCard} onNote={onNote} onReset={() => select('stake-attested', { card: stakeCard })} /></ScreenFrame>;
  } else if (state.group === 'results') {
    stage = (
      <ScreenFrame name="results">
        <div style={{ marginBottom: 8 }}><Eyebrow color={LTOKENS.ink3}>{RESULTS.eyebrow}</Eyebrow></div>
        <BackingResultsCard pod={RESULT_PODS[state.result]} accent={ACCENT} onOpenTape={onOpenTape} />
      </ScreenFrame>
    );
  } else if (state.group === 'stats') {
    stage = (
      <ScreenFrame name="stats">
        <div data-preview-stats={state.stats} style={{ borderRadius: 14, padding: '13px 15px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}` }}>
          <Eyebrow color={LTOKENS.ink3}>{STATS.eyebrow}</Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', margin: '4px 0 8px' }}>{STATS.title}</div>
          {state.stats === 'mine' ? <MyBackingStats stats={MY_STATS} /> : <TrainerStats stats={TRAINER_STATS} />}
          <div style={{ marginTop: 9, padding: '6px 9px', borderRadius: 8, background: alpha(LTOKENS.bg, 0.5), display: 'inline-block' }}>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{STATS.label}</Mono>
          </div>
        </div>
      </ScreenFrame>
    );
  } else {
    const week = WEEK_INPUTS[state.week];
    stage = <ScreenFrame name="week"><YourBacking inPlay={week.inPlay} accent={ACCENT} onOpenTape={onOpenTape} now={week.now} battlesByGroup={week.battlesByGroup} /></ScreenFrame>;
  }

  const desktop = isDesktopState(state);
  const groups = desktop ? DESK_GROUPS : GROUPS;
  const states = desktop ? PREVIEW_DESKTOP_STATES : PREVIEW_STATES;

  const chip = (on) => ({
    all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '6px 10px', borderRadius: 9, fontSize: 12, fontWeight: 600,
    color: on ? LTOKENS.bg : LTOKENS.ink2, background: on ? ACCENT : LTOKENS.surface, border: `1px solid ${on ? ACCENT : LTOKENS.hair2}`,
  });

  return (
    <BackingPreviewLitContext.Provider value>
      <div data-preview="root" style={{ minHeight: '100vh', background: LTOKENS.bg, color: LTOKENS.ink }}>
        <header data-preview="header" style={{ position: 'sticky', top: 0, zIndex: 20, padding: '12px 16px', background: alpha(LTOKENS.bg, 0.97), borderBottom: `1px solid ${LTOKENS.hair}` }}>
          <div data-preview="label" role="note" style={{ fontSize: 13.5, fontWeight: 700, color: LTOKENS.gold, lineHeight: 1.35 }}>{PREVIEW_LABEL}</div>
          <div role="group" aria-label="Layout" data-preview="viewport" style={{ display: 'inline-flex', gap: 6, marginTop: 10 }}>
            {[['mobile', 'Mobile', PREVIEW_STATES], ['desktop', 'Desktop', PREVIEW_DESKTOP_STATES]].map(([id, label, set]) => {
              const on = (id === 'desktop') === desktop;
              return (
                <button key={id} type="button" className="lg-tap" data-preview-viewport={id} aria-pressed={on} onClick={() => { if (!on) select(set[0].id); }} style={chip(on)}>
                  {label}
                </button>
              );
            })}
          </div>
          <nav aria-label="Surface" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {groups.map((g) => (
              <button key={g.id} type="button" className="lg-tap" data-preview-group={g.id} aria-pressed={state.group === g.id}
                onClick={() => select(states.find((s) => s.group === g.id).id)} style={chip(state.group === g.id)}>
                {g.label}
              </button>
            ))}
          </nav>
          <div role="group" aria-label="State" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {states.filter((s) => s.group === state.group).map((s) => (
              <button key={s.id} type="button" className="lg-tap" data-preview-state={s.id} aria-pressed={s.id === stateId}
                onClick={() => select(s.id)} style={chip(s.id === stateId)}>
                {s.label}
              </button>
            ))}
          </div>
          <div data-preview="caption" style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.45, marginTop: 8 }}>{captionFor(state)}</div>
          {note && (
            <div data-preview="note" role="status" style={{ display: 'inline-block', marginTop: 8, padding: '4px 9px', borderRadius: 8, background: alpha(LTOKENS.gold, 0.12), border: `1px solid ${alpha(LTOKENS.gold, 0.35)}` }}>
              <Mono style={{ fontSize: 11, color: LTOKENS.gold, letterSpacing: '0.02em' }}>{note}</Mono>
            </div>
          )}
        </header>
        <main data-preview="stage" data-preview-current={stateId}>
          <React.Fragment key={`${stateId}#${nonce}`}>{stage}</React.Fragment>
        </main>
        <footer style={{ padding: '0 16px 32px', textAlign: 'center' }}>
          <Eyebrow color={LTOKENS.ink3}>Dev preview · ?preview=backing · never on production</Eyebrow>
        </footer>
      </div>
    </BackingPreviewLitContext.Provider>
  );
}
