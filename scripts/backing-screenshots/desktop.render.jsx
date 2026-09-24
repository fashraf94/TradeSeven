// @vitest-environment jsdom
// scripts/backing-screenshots/desktop.render.jsx
//
// Backing desktop layouts — THE DESKTOP SCREENSHOT HARNESS. Mounts the REAL
// desktop surfaces with BACKING_BETA_ENABLED forced on (a getter mock — the
// shipped value stays `false`; src/config/backingBetaFlags.test.js pins it),
// walks the real flow — the landing's strip → the Backing screen → a seat →
// "Back" — and writes each state as a static page (`desk-*.html`) under
// $BACKING_SHOTS_DIR for shoot.mjs to photograph at 1440×900.
//
// THE FRAME IS THE APP'S: the real DesktopSidebar (fixed, 220px) and the
// League beside it at margin-left 220px, exactly as App.jsx lays out the
// League tab at a desktop width; the Backing screen opens full-window over
// both, as the lobby hosts it. The private-record page shows the real
// IdentityPanel — the Command surface's left column, the stats' desktop home
// beside the pitch — in that frame; the Command surface's other two columns
// are not rendered here (their data hooks are outside this build).
//
// Every data read is a mocked hook return shaped like the endpoints' replies —
// INVENTED inputs (no real pod, team or stake is pictured); nothing here
// touches the network or Firestore. Not part of `npm run test:run` (see
// vitest.config.mjs beside this file).

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = process.env.BACKING_SHOTS_DIR;
if (!OUT) throw new Error('Set BACKING_SHOTS_DIR to the directory the pages should be written to.');

const hooked = vi.hoisted(() => ({
  league: null, myGroup: null, trainingPod: null,
  pods: null, inPlay: null, wallet: null, eligibility: null, pitch: null, cards: {},
  results: null, myStats: null, trainerStats: null, battles: {}, slots: [],
}));

vi.mock('../../src/config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return true; },
}));
vi.mock('../../src/hooks/useLeagueState', () => ({ default: () => ({ state: hooked.league, loading: false, isFixtures: false }) }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { uid: 'u1', displayName: 'Alice' } }) }));
vi.mock('../../src/services/tournamentGroupService', () => ({
  subscribeMyGroup: (_uid, cb) => { if (hooked.myGroup) cb(hooked.myGroup); return () => {}; },
  subscribeMyMostRecentVoidedGroup: () => () => {},
  subscribeMyTrainingPod: (_uid, cb) => { if (hooked.trainingPod) cb(hooked.trainingPod); return () => {}; },
  subscribeGroup: () => () => {}, getGroup: async () => null, fetchDisplayNames: async () => ({}), subscribeLeaderboard: () => () => {},
}));
vi.mock('../../src/hooks/useBackingPods', () => ({ default: () => hooked.pods }));
vi.mock('../../src/hooks/useMyBacking', () => ({ default: () => hooked.inPlay }));
vi.mock('../../src/hooks/useBackingWallet', () => ({ default: () => hooked.wallet }));
vi.mock('../../src/hooks/useEligibility', async (importOriginal) => ({ ...(await importOriginal()), default: () => hooked.eligibility }));
vi.mock('../../src/hooks/useMyPitch', () => ({ default: () => hooked.pitch }));
vi.mock('../../src/hooks/useTeamCard', () => ({
  default: (groupId, odUserId, enabled) => ({ card: enabled ? hooked.cards[`${groupId}/${odUserId}`] ?? null : null, loading: false, error: null, refresh: () => {} }),
}));
vi.mock('../../src/hooks/useBackingResults', () => ({ default: ({ enabled } = {}) => (enabled ? hooked.results : { data: null, pod: null, weeks: [], nextBefore: null, loadMore: () => {}, loading: false, loadingMore: false, error: null, refresh: () => {} }) }));
vi.mock('../../src/hooks/useMyBackingStats', () => ({ default: (enabled) => (enabled ? hooked.myStats : { data: null, loading: false, error: null, refresh: () => {} }) }));
vi.mock('../../src/hooks/useTrainerStats', () => ({ default: () => hooked.trainerStats }));
vi.mock('../../src/hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: hooked.battles, loading: false, error: null }) }));
vi.mock('../../src/services/backingService', () => ({
  fetchBackingPods: vi.fn(), fetchTeamCard: vi.fn(), subscribeMyStakes: () => () => {}, subscribePool: () => () => {},
  subscribeWallet: () => () => {}, readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null,
  fetchTeamLabels: async () => ({ pods: {} }), fetchBackingResults: async () => ({ weeks: [] }), fetchMyBackingStats: async () => null,
  fetchTrainerStats: async () => null, postBackingEvent: async () => ({ recorded: true }),
  placeStake: vi.fn(), attestEligibility: vi.fn(), savePitch: vi.fn(), newRequestId: () => 'shot-req',
  BackingApiError: class BackingApiError extends Error {},
}));
vi.mock('../../src/utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({}) })) }));
vi.mock('../../src/services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../src/services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => Promise.resolve({}), mapLobbyError: () => 'error' }));
vi.mock('../../src/services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: hooked.slots }), claimSlot: () => Promise.resolve({}), releaseSlot: () => Promise.resolve({}), mapSlotActionError: () => 'error',
}));
vi.mock('../../src/components/League/LoadoutChooserSheet', () => ({ default: () => null }));

const { ThemeProvider } = await import('../../src/contexts/ThemeContext');
const DesktopSidebar = (await import('../../src/components/Navigation/DesktopSidebar')).default;
const LeagueLobbyDesktop = (await import('../../src/components/League/LeagueLobbyDesktop')).default;
const IdentityPanel = (await import('../../src/components/Dashboard/desktop/IdentityPanel')).default;
const { ELIGIBILITY } = await import('../../src/hooks/useEligibility');
const { leagueState } = await import('../../src/components/League/leagueFixtures');
const { buildLeagueState } = await import('../../src/components/League/leagueAdapter');
const { LTOKENS } = await import('../../src/components/League/leagueTokens');

// ── the page shell: the League's tokens and stylesheet, the app's fonts, 1440×900 ──
const CSS = ['src/theme/tokens.css', 'src/components/League/league.css'].map((f) => readFileSync(path.join(REPO, f), 'utf8')).join('\n');
function page(title, fragment) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="./fonts.css">
<style>${CSS}</style>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; background: ${LTOKENS.bg}; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: ${LTOKENS.ink}; }
  #shot { width: 1440px; height: 900px; position: relative; overflow: hidden; background: ${LTOKENS.bg}; }
</style></head>
<body><div id="shot" data-shot="desktop">${fragment}</div></body></html>
`;
}

// ── mounting and pressing ────────────────────────────────────────────────────
let roots = [];
const settle = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); };
async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  await settle();
  roots.push({ root, container });
  return container;
}
async function press(el) {
  expect(el, 'the element to press').toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
}
const seatNamed = (c, name) => [...c.querySelectorAll('[data-backing="seat"]')].find((el) => el.textContent.includes(name));
function write(name, title, container) {
  mkdirSync(OUT, { recursive: true });
  const html = container.innerHTML;
  expect(html.length).toBeGreaterThan(0);
  writeFileSync(path.join(OUT, `${name}.html`), page(title, html));
  return html;
}

// The League tab exactly as App lays it out on a desktop: the sidebar, the League beside it.
const sidebarProps = { screen: 'league', setScreen: () => {}, setShowForge: () => {}, showForge: false, user: { username: 'Alice', wins: 4, losses: 3 }, unreadCount: 0, collapsed: false, onToggleCollapse: () => {}, onLogout: () => {} };
const AppFrame = ({ children }) => (
  <ThemeProvider>
    <DesktopSidebar {...sidebarProps} />
    <div style={{ marginLeft: '220px' }}>{children}</div>
  </ThemeProvider>
);
const lobby = () => <AppFrame><LeagueLobbyDesktop onOpenMyGame={() => {}} onOpenTrainingPod={() => {}} hasAgent agentLoadout={null} /></AppFrame>;

// ═══ the inputs — shaped like the endpoints' replies (invented) ═══
const NOW = new Date('2026-09-23T14:00:00.000Z');   // Wed 23 Sep, 10:00 ET
const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';
const WED_FIRE = '2026-09-23T23:00:00.000Z';
const NAMES = {
  'od-a': { label: 'Kestrel', secondary: 'Mira', player: 'Mira', agent: 'Kestrel' },
  'od-b': { label: 'Tarn', secondary: 'Draco', player: 'Draco', agent: 'Tarn' },
  'od-c': { label: 'Halyard', secondary: 'Orion', player: 'Orion', agent: 'Halyard' },
  'od-x': { label: 'Orbit', secondary: 'Rigel', player: 'Rigel', agent: 'Orbit' },
  'cpu-1': { label: 'CPU — Trend Follower', secondary: null, player: 'CPU — Trend Follower', agent: 'CPU — Trend Follower' },
  'cpu-2': { label: 'CPU — Contrarian', secondary: null, player: 'CPU — Contrarian', agent: 'CPU — Contrarian' },
  'cpu-3': { label: 'CPU — Diversifier', secondary: null, player: 'CPU — Diversifier', agent: 'CPU — Diversifier' },
  'cpu-4': { label: 'CPU — Speculator', secondary: null, player: 'CPU — Speculator', agent: 'CPU — Speculator' },
};
const named = (id) => ({ label: NAMES[id].label, secondary: NAMES[id].secondary });
const seat = (id, over = {}) => ({ odUserId: id, isCpu: id.startsWith('cpu-'), ...named(id), isOwnSeat: false, backable: true, ...over });
const openPool = (count, over = {}) => ({ status: 'open', closesAt: SUNDAY_CLOSE, closeReason: 'clock', backerProgress: { count, floor: 3, met: false }, teamSpread: { met: false }, ...over });
const pod = (groupId, teams, over = {}) => ({ groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40', humanTeams: teams.filter((t) => !t.isCpu).length, teams, pool: openPool(1), myStakes: [], ...over });
const WINDOW_PODS = (myStakesA = []) => [
  pod('lobby-w40-a', [seat('od-a'), seat('od-b'), seat('cpu-1'), seat('cpu-2')], { pool: openPool(2), myStakes: myStakesA }),
  pod('lobby-w40-b', [seat('od-c'), seat('cpu-3'), seat('cpu-4'), seat('cpu-1')], { pool: openPool(1) }),
  pod('lds-wed-1900', [seat('od-x'), seat('cpu-2'), seat('cpu-3'), seat('cpu-4')], { formationPath: 'slot', slotId: 'wed-1900', pool: openPool(0, { closesAt: WED_FIRE, closeReason: 'fire' }) }),
];
const podsReply = (pods) => ({
  data: { baseLayerWeek: '2026-W40', backingWeekStart: '2026-09-21T04:00:00.000Z', backingWeekCloses: SUNDAY_CLOSE, viewerUid: 'u1', pods },
  pods, loading: false, error: null, refresh: () => {},
});
const nothingInPlay = { stakes: [], poolsById: {}, groupsById: {}, labelsById: {}, loading: false };
const leg = (direction) => ({ direction, openedAt: '2026-09-21T11:00:00.000Z' });
const weekGroup = (over = {}) => ({
  status: 'battle', baseLayerWeek: '2026-W39',
  players: [
    { odUserId: 'od-a', picks: [{ symbol: 'NVDA', legs: [leg('long')] }, { symbol: 'AMD', legs: [leg('long'), leg('short')] }, { symbol: 'VST', legs: [leg('long')] }] },
    { odUserId: 'od-x', picks: [{ symbol: 'TSLA', legs: [leg('long')] }, { symbol: 'PLTR', legs: [leg('long')] }, { symbol: 'XOM', legs: [leg('long')] }] },
    { odUserId: 'cpu-3', isCpu: true, picks: [] },
    { odUserId: 'cpu-4', isCpu: true, picks: [] },
  ],
  dailyScores: {
    day1: { closeScores: { 'od-a': { compositePoints: 2.1 }, 'od-x': { compositePoints: 3.0 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
    day2: { closeScores: { 'od-a': { compositePoints: 3.4 }, 'od-x': { compositePoints: 2.6 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
    day3: { recordedDate: '2026-09-23', closeScores: { 'od-a': { compositePoints: 4.8 }, 'od-x': { compositePoints: 5.1 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0.4 } } },
  },
  ...over,
});
const labelsFor = (...groupIds) => Object.fromEntries(groupIds.map((g) => [g, NAMES]));
const IN_PLAY = {
  stakes: [
    { id: 's1', groupId: 'lobby-w39-a', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' },
    { id: 's2', groupId: 'lobby-w39-b', teamOdUserId: 'od-x', amount: 200, status: 'live', weekKey: '2026-W39' },
  ],
  poolsById: { 'lobby-w39-a': { status: 'closed' }, 'lobby-w39-b': { status: 'closed' } },
  groupsById: { 'lobby-w39-a': weekGroup(), 'lobby-w39-b': weekGroup() },
  labelsById: labelsFor('lobby-w39-a', 'lobby-w39-b'),
  loading: false,
};
const SETTLED = {
  stakes: [{ id: 's7', groupId: 'lobby-w39-a', teamOdUserId: 'od-a', amount: 250, status: 'settled', weekKey: '2026-W39' }],
  poolsById: { 'lobby-w39-a': { status: 'resolved' } }, groupsById: { 'lobby-w39-a': weekGroup({ status: 'complete' }) },
  labelsById: labelsFor('lobby-w39-a'), loading: false,
};
const KESTREL_BATTLE = { ownerId: 'od-a', status: 'active', _whyConcealed: true, agentContext: { agentName: 'Kestrel', archetype: 'momentum_chaser', initialPortfolio: { star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], core: [{ symbol: 'AVGO' }, { symbol: 'ANET' }], support: [{ symbol: 'VST' }, { symbol: 'META' }] } } };
const ORBIT_BATTLE = { ownerId: 'od-x', status: 'active', _whyConcealed: true, agentContext: { agentName: 'Orbit', archetype: 'analyst', initialPortfolio: { star: [{ symbol: 'MSFT' }, { symbol: 'COST' }], core: [{ symbol: 'JPM' }, { symbol: 'UNH' }], support: [{ symbol: 'LIN' }, { symbol: 'HD' }] } } };

const APPROACH = 'Goes where the momentum is — and leaves the moment it fades.';
const cardSeat = (over = {}) => ({ index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false, ...over });
const FIRST_WEEK = {
  groupId: 'lobby-w40-a', odUserId: 'od-b', viewerUid: 'u1', seat: cardSeat({ index: 2 }),
  team: { displayName: 'Draco', ...named('od-b'), isCpu: false, pitch: 'Macro guy. Tarn keeps me from being too early.', derived: null,
    agent: { name: 'Tarn', archetype: 'analyst', archetypeLabel: 'Fundamental Investor', approach: 'Buys quality companies and lets the fundamentals do the work.', traitCount: 3, ruleCount: 5 } },
  known: null, lastWeek: null,
};
const VETERAN = {
  groupId: 'lobby-w40-a', odUserId: 'od-a', viewerUid: 'u1', seat: cardSeat(),
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
const MY_STAKE_ON_KESTREL = [{ stakeId: 's0', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 250, status: 'live' }];

const resultPod = (groupId, over = {}) => ({
  groupId, poolId: groupId, weekKey: '2026-W39', status: 'resolved', outcome: 'settled', formationPath: 'lobby', slotId: null,
  humanTeams: 2, potTotal: 1000, uniqueBackers: 4, winners: ['od-a'], winnerLabels: ['Kestrel'], winningStakes: 700, paysX: 1.43,
  closedAt: '2026-09-21T04:00:00.000Z', settledAt: '2026-09-25T22:30:00.000Z', refundedAt: null, refundReason: null, holdReason: null, monthKey: '2026-09',
  teams: [
    { odUserId: 'od-a', isCpu: false, ...named('od-a'), backerCount: 2, stakeTotal: 700, sharePct: 70, paysX: 1.43, won: true },
    { odUserId: 'od-b', isCpu: false, ...named('od-b'), backerCount: 2, stakeTotal: 300, sharePct: 30, paysX: 3.33, won: false },
    { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: false },
  ],
  myStakes: [
    { stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Kestrel', amount: 500, status: 'won', payout: 714, voidReason: null, net: 214, loadoutChanged: true },
  ],
  myNet: 214, myWon: true,
  ...over,
});
const RESULT_WEEKS = [{ weekKey: '2026-W39', pools: [
  resultPod('lobby-w39-a'),
  resultPod('lobby-w39-b', {
    winners: ['od-x'], winnerLabels: ['Orbit'], winningStakes: 400, paysX: 2.25, potTotal: 900, uniqueBackers: 3,
    teams: [
      { odUserId: 'od-x', isCpu: false, ...named('od-x'), backerCount: 1, stakeTotal: 400, sharePct: 44, paysX: 2.25, won: true },
      { odUserId: 'od-c', isCpu: false, ...named('od-c'), backerCount: 2, stakeTotal: 500, sharePct: 56, paysX: 1.8, won: false },
      { odUserId: 'cpu-3', isCpu: true, ...named('cpu-3'), backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: false },
    ],
    myStakes: [{ stakeId: 's2', teamOdUserId: 'od-c', teamLabel: 'Halyard', amount: 200, status: 'lost', payout: 0, voidReason: null, net: -200, loadoutChanged: false }],
    myNet: -200, myWon: false,
  }),
] }];
const MY_STATS = {
  label: 'beta stats', seasonKey: '2026-09', net: { career: 180, season: 14 },
  career: { poolsBacked: 11, poolsWon: 5, weeksPlayed: 6, pending: 0, net: 180 },
  season: { monthKey: '2026-09', poolsBacked: 4, poolsWon: 2, weeksPlayed: 3, pending: 0, net: 14 },
  seasons: {}, accuracy: { career: { pools: 9, youWon: 5, baselineWon: 4, both: 3, excluded: 2 }, season: { pools: 3, youWon: 2, baselineWon: 1, both: 1, excluded: 1 } },
};
const TRAINER_STATS = {
  label: 'beta stats', seasonKey: '2026-09',
  career: { uniqueBackers: 5, bpBacked: 1650, backersNet: 320, pending: 0, poolsBackedOn: 3, stakes: 7, decidedStakes: 7 },
  season: { monthKey: '2026-09', uniqueBackers: 3, bpBacked: 700, backersNet: 164, pending: 0, poolsBackedOn: 1, stakes: 3, decidedStakes: 3 },
  seasons: {}, excludedStakes: 0,
};

const NO_BRACKET = () => buildLeagueState({
  fieldGroups: [{
    id: 'wk-real-1', status: 'battle', roundNumber: 1, baseLayerWeek: '2026-W39',
    players: [{ odUserId: 'u1', picks: [] }, { odUserId: 'cpu-1', isCpu: true, picks: [] }, { odUserId: 'u2', picks: [] }, { odUserId: 'cpu-2', isCpu: true, picks: [] }],
    dailyScores: { day1: { closeScores: { u1: { compositePoints: 3.2 }, u2: { compositePoints: 1.1 } } } },
  }],
  names: { u1: 'Alice', u2: 'Bob' }, uid: 'u1',
}).state;
const SLOTS = [
  { slotId: 'sun-1900', groupId: 'lds-sun-1900', label: 'Sun 7:00pm ET', humanCount: 2, isFull: false, enabled: true, seats: [] },
  { slotId: 'mon-0845', groupId: 'lds-mon-0845', label: 'Mon 8:45am ET', humanCount: 0, isFull: false, enabled: true, seats: [] },
];

function reset() {
  hooked.league = NO_BRACKET();
  hooked.myGroup = null;
  hooked.trainingPod = null;
  hooked.pods = podsReply(WINDOW_PODS());
  hooked.inPlay = nothingInPlay;
  hooked.wallet = { known: true, left: 1000, total: 1000 };
  hooked.eligibility = { status: ELIGIBILITY.ATTESTED, refresh: () => {} };
  hooked.pitch = { text: 'I back breadth, and my agent keeps me honest.', loaded: true, saving: false, error: null, save: async () => true };
  hooked.cards = { 'lobby-w40-a/od-b': FIRST_WEEK, 'lobby-w40-a/od-a': VETERAN };
  hooked.results = { data: { weeks: RESULT_WEEKS }, pod: null, weeks: RESULT_WEEKS, nextBefore: null, loadMore: () => {}, loading: false, loadingMore: false, error: null, refresh: () => {} };
  hooked.myStats = { data: MY_STATS, loading: false, error: null, refresh: () => {} };
  hooked.trainerStats = { data: TRAINER_STATS, loading: false, error: null, refresh: () => {} };
  hooked.battles = { 'od-a': KESTREL_BATTLE, 'od-x': ORBIT_BATTLE };
  hooked.slots = SLOTS;
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  reset();
});
afterEach(async () => {
  for (const { root, container } of roots) { await act(async () => root.unmount()); container.remove(); }
  roots = [];
  reset();
});
afterAll(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ═══ the pages ═══
describe('the desktop landing — the strip in the centre column', () => {
  for (const [landing, st] of [['no-bracket', NO_BRACKET], ['bracket', () => leagueState('open')]]) {
    for (const seated of [false, true]) {
      it(`${seated ? 'seated' : 'not seated'} · ${landing}`, async () => {
        hooked.league = st();
        if (seated) { hooked.myGroup = { id: 'wk-real-1', status: 'battle' }; hooked.trainingPod = { id: 'shot-practice', status: 'battle' }; }
        const c = await mount(lobby());
        const html = write(`desk-landing-${seated ? 'seated' : 'unseated'}-${landing}`, `Desktop League · ${seated ? 'seated' : 'not seated'} · ${landing}`, c);
        expect(html).toContain('data-strip-layout="desktop"');
        expect(c.querySelector('.ld-center [data-backing="strip"]')).not.toBeNull();
      });
    }
  }
});

describe('the strip — every state, on the landing', () => {
  const STATES = {
    staked: () => { hooked.pods = podsReply(WINDOW_PODS(MY_STAKE_ON_KESTREL)); },
    week: () => { hooked.inPlay = IN_PLAY; },
    between: () => { hooked.pods = podsReply([]); hooked.inPlay = SETTLED; },
  };
  for (const [kind, setup] of Object.entries(STATES)) {
    it(kind, async () => {
      setup();
      const c = await mount(lobby());
      const html = write(`desk-strip-${kind}`, `Desktop strip · ${kind}`, c);
      expect(html).toContain(`data-strip-state="${kind}"`);
    });
  }
});

describe('the Backing screen, desktop — the window: pods · card · your backing', () => {
  async function openScreen() {
    const c = await mount(lobby());
    await press(c.querySelector('[data-backing="strip"]'));
    expect(c.querySelector('[data-backing="desk-host"] [data-layout="desktop"]')).not.toBeNull();
    return c;
  }
  it('no card yet', async () => {
    hooked.pods = podsReply(WINDOW_PODS(MY_STAKE_ON_KESTREL));
    hooked.wallet = { known: true, left: 750, total: 1000 };
    const c = await openScreen();
    write('desk-window-list', 'Backing · the window, no card yet', c);
  });
  it('the first-week card (the primary case)', async () => {
    const c = await openScreen();
    await press(seatNamed(c, 'Tarn'));
    const html = write('desk-window-first-week', 'Backing · first-week card', c);
    expect(html).toContain('data-backing="tape-first-week"');
  });
  it('the veteran card — last week\'s two portfolios side by side', async () => {
    const c = await openScreen();
    await press(seatNamed(c, 'Kestrel'));
    const html = write('desk-window-veteran', 'Backing · veteran card', c);
    expect(html).toContain('data-backing="two-layer-book"');
  });
  it('the stake control in the right column (attested)', async () => {
    const c = await openScreen();
    await press(seatNamed(c, 'Tarn'));
    await press(c.querySelector('[data-backing="cta-back"]'));
    const html = write('desk-window-stake', 'Backing · the stake control', c);
    expect(c.querySelector('[data-desk-col="right"] [data-backing="stake-control"]')).not.toBeNull();
    expect(html).toContain('data-backing="disclosures"');
  });
  it('the top-up state — "Adds to your 250 BP on Kestrel."', async () => {
    hooked.pods = podsReply(WINDOW_PODS(MY_STAKE_ON_KESTREL));
    hooked.wallet = { known: true, left: 750, total: 1000 };
    const c = await openScreen();
    await press(seatNamed(c, 'Kestrel'));
    await press(c.querySelector('[data-backing="cta-back"]'));
    const html = write('desk-window-top-up', 'Backing · topping up a stake', c);
    expect(c.querySelector('[data-desk-col="right"] [data-backing="top-up"]')).not.toBeNull();
    expect(html).toContain('Adds to your 250 BP on Kestrel.');
  });
  it('the 18+ / terms step — where the stake control lives', async () => {
    hooked.eligibility = { status: ELIGIBILITY.REQUIRED, refresh: () => {} };
    const c = await openScreen();
    await press(seatNamed(c, 'Tarn'));
    await press(c.querySelector('[data-backing="cta-back"]'));
    write('desk-window-attestation', 'Backing · the one-time confirmation', c);
    expect(c.querySelector('[data-desk-col="right"] [data-backing="attestation"]')).not.toBeNull();
  });
});

describe('the Backing screen, desktop — Monday–Friday and Friday take the whole screen', () => {
  it('Your Backing (mid-week)', async () => {
    hooked.inPlay = IN_PLAY;
    const c = await mount(lobby());
    await press(c.querySelector('[data-backing="strip"]'));
    const html = write('desk-week', 'Backing · Your Backing, Monday–Friday', c);
    expect(html).toContain('data-desk-section-view="week"');
  });
  it('the results — the reveal, with the private record beside it', async () => {
    hooked.pods = podsReply([]);
    hooked.inPlay = SETTLED;
    const c = await mount(lobby());
    await press(c.querySelector('[data-backing="strip"]'));
    const html = write('desk-results', 'Backing · Friday\'s results', c);
    expect(html).toContain('data-desk-section-view="results"');
    expect(html).toContain('data-backing="desk-record"');
  });
});

describe('the private record and the trainer stats — their desktop home, beside the pitch', () => {
  const agent = { id: 'a1', ownerId: 'u1', name: 'Prime', archetype: 'momentum_chaser', stats: { gamesPlayed: 7, wins: 4, avgScore: 64 } };
  const panel = () => (
    <AppFrame>
      <div style={{ height: '900px', padding: '22px 30px', background: LTOKENS.bg }}>
        <div style={{ width: '300px', height: '100%', overflowY: 'auto' }} className="lg-scroll">
          <IdentityPanel agent={agent} accent="#5EEAD4" live={false} record="4-3" winRate={57} levelConfig={{ label: 'Starter' }} nextLevelInfo={{ label: 'Partner' }} onOpenRecord={() => {}} />
        </div>
      </div>
    </AppFrame>
  );
  it('your record (private)', async () => {
    const c = await mount(panel());
    const html = write('desk-profile-record', 'Profile · your record, private', c);
    expect(html).toContain('data-backing="scouting-line"');
    expect(html).toContain('data-backing="my-stats"');
  });
  it('as a team (trainer beta stats)', async () => {
    const c = await mount(panel());
    await press(c.querySelector('[data-backing="stats-tab"][data-tab="trainer"]'));
    const html = write('desk-profile-trainer', 'Profile · your team, backed — beta stats', c);
    expect(html).toContain('data-backing="trainer-stats"');
  });
});
