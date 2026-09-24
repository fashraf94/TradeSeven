// @vitest-environment jsdom
// src/components/League/leagueRawIds.guard.test.jsx
//
// THE LEAGUE RAW-ID GUARD — no League seat, pod-list row or leaderboard row
// ever shows a raw account id.
//
// THE BUG IT PINS. The League's name readers — the client's fetchDisplayNames
// (src/services/tournamentGroupService.js) and the leaderboard writer's
// resolveDisplayNames (api/_utils/tournamentLeaderboard.js) — read
// `users/{uid}.username || displayName` at the TOP level, and buildSeat
// (leagueAdapter.js) fell back to the id. The one writer of that document,
// src/firebase/authService.js, nests the names under `profile`, so every real
// player resolved to their raw 28-character uid: on the lobby seats, the
// field's pod list, the funnel, Spectate, the arena climb, the month board and
// its feeds. (The backing build's review record reported it for separate
// tasking as RAWID-R-1; the League batteries passed because they seeded the
// top-level shape production never writes.)
//
// ONE WORLD, PRODUCTION-SHAPED: users/{uid} documents exactly as authService
// writes them (names nested under `profile`), 28-character uids, and one of
// each edge the name chain has to survive — a legacy top-level-only document,
// a profile with no usable name, no document at all, a read that fails —
// beside CPU seats. Then every door:
//   · READS    — both readers answer the nested names, agree seat for seat
//                (BUILD_RULES §9), and answer "Player" for a seat without a
//                usable name — never an id.
//   · WRITES   — the month board the REAL writer stores from that world (its
//                entries and its contrarian feed) and the rank docs the REAL
//                rank writer stores: no display string carries an id, and the
//                names are there.
//   · SURFACES — rendered from those reads and writes and walked for their
//                VISIBLE text (text nodes; aria-label, title, placeholder,
//                alt): League seats (the desktop and mobile lobbies — the
//                funnel, your group, the docked pod, Spectate — and the arena
//                climb, which runs its own name read), the pod list (THE
//                FIELD's PodCards, and the bracket's), and the leaderboards
//                (the lobby's field board, and the month board in BOTH row
//                variants — from the fixed writer's doc AND from a legacy doc
//                the old writer stored, raw uids and all). Every surface is
//                walked again BEFORE the names arrive (the hook's first render
//                hands the adapter `names = {}`).
// Any 28-character account id fails a row; the players' names must be there
// too, so a belt that hides an id cannot hide a reader that lost the name.
//
// MUTATION CHECK: restore the old top-level read in fetchDisplayNames or in
// resolveDisplayNames, the id fallback in buildSeat, or drop the month board's
// id belt (LeaderboardCard) — and a row here reds.
//
// The readers and writers run for real, api/ modules included (the backing
// guard's precedent); only the Firestore handles, the subscriptions, the flags
// and the lobby's unrelated service seams are stood in for.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';

const ctx = vi.hoisted(() => ({
  users: {},             // users/{uid} → the document the CLIENT reader's handle answers
  failing: new Set(),    // uids whose users/{uid} read throws, on both handles
  clientReads: [],       // every users/{uid} the client reader asked for
  board: null,           // the month doc the stubbed subscribeLeaderboard delivers
  leagueState: null,     // the League state the stubbed useLeagueState hands the lobbies
  flags: { ladder: false },
}));

// The client reader's Firestore handle: users/{uid} answered from the world.
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: (_db, ...segments) => ({ path: segments.join('/') }),
  getDoc: async ({ path }) => {
    const [collection, uid] = path.split('/');
    if (collection !== 'users') throw new Error(`guard: unexpected client read ${path}`);
    ctx.clientReads.push(uid);
    if (ctx.failing.has(uid)) throw new Error('unavailable');
    const data = ctx.users[uid];
    return { exists: () => data !== undefined, data: () => structuredClone(data) };
  },
}));
vi.mock('../../firebase/config', () => ({ auth: { currentUser: null }, db: {}, default: {} }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  // The writer publishes BATTLE groups (its own suite's override: the freeze defaults on).
  TOURNAMENT_ADVANCEMENT_FROZEN: false,
  // Getter-mocked (the DeskSeasonRail.render precedent): one file renders BOTH month-board rows.
  get WEEKLY_LADDER_PLACEMENT_ENABLED() { return ctx.flags.ladder; },
}));
// The REAL client reader (fetchDisplayNames) — only the live subscriptions are stood in for.
vi.mock('../../services/tournamentGroupService', async (importOriginal) => ({
  ...(await importOriginal()),
  subscribeMyGroup: () => () => {},
  subscribeMyTrainingPod: () => () => {},
  subscribeLeaderboard: (_docId, callback) => { callback(ctx.board); return () => {}; },
}));
vi.mock('../../hooks/useLeagueState', () => ({ default: () => ({ state: ctx.leagueState, loading: false, isFixtures: false }) }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: null }) }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ tokens: {
    bgCard: '#15171E', borderDivider: '#24262d', textPrimary: '#e2e8f0',
    textMuted: '#94a3b8', textFaint: '#64748b', medalGold: '#eab308', bgApp: '#0b0d12',
  } }),
}));
// The lobbies' unrelated service seams (the LeagueLobbyHonest.smoke set): each
// transitively pulls the env-gated Firebase client, and none names a seat.
vi.mock('../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => {}, mapLobbyError: () => 'error' }));
vi.mock('../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }),
  claimSlot: () => Promise.resolve({}),
  releaseSlot: () => Promise.resolve({}),
  mapSlotActionError: () => 'error',
}));
vi.mock('./LoadoutChooserSheet', () => ({ default: () => null }));
vi.mock('../../services/backingService', () => ({
  fetchBackingPods: vi.fn(), fetchTeamCard: vi.fn(), placeStake: vi.fn(), attestEligibility: vi.fn(), savePitch: vi.fn(),
  newRequestId: () => 'req', subscribeMyStakes: () => () => {}, subscribePool: () => () => {}, subscribeWallet: () => () => {},
  readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null,
  fetchBackingResults: vi.fn(async () => ({ weeks: [], nextBefore: null })), fetchMyBackingStats: vi.fn(async () => null), fetchTrainerStats: vi.fn(async () => null), postBackingEvent: vi.fn(async () => ({ recorded: true })),
  BackingApiError: class BackingApiError extends Error {},
}));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({}) })) }));

const { GROUP_STATUS, isCpuUserId } = await import('../../constants/leagueTournament');
const { makeInMemoryDb } = await import('../../../api/_utils/__fixtures__/inMemoryFirestore.js');
const { resolveDisplayNames, upsertLeaderboardForGroups } = await import('../../../api/_utils/tournamentLeaderboard.js');
const { applyGroupWeekToRanks } = await import('../../../api/_utils/tournamentRank.js');
const { fetchDisplayNames } = await import('../../services/tournamentGroupService');
const { buildLeagueState } = await import('./leagueAdapter');
const { buildArenaModel } = await import('./battleArena/buildArenaModel');
const { PodCard } = await import('./LeaguePod');
const { DeskPodPanel } = await import('./LeagueDeskParts');
const { default: Spectate } = await import('./LeagueSpectate');
const { default: LeagueLobbyDesktop } = await import('./LeagueLobbyDesktop');
const { default: LeagueHome } = await import('./LeagueHome');
const { default: TrainingClimbPreview } = await import('./TrainingClimbPreview');
const { default: LeaderboardCard } = await import('../Tournament/LeaderboardCard');

// ==================== THE WORLD ====================

const uid28 = (head) => `${head}${'0'.repeat(27 - head.length)}Z`;   // a 28-character Firebase uid
const VIEWER = uid28('Viewer');      // you
const ADA = uid28('Ada');            // profile.displayName
const GRACE = uid28('Grace');        // profile.username (a blank displayName)
const LEGACY = uid28('Legacy');      // a pre-profile document: the top-level name only
const NAMELESS = uid28('Nameless');  // a profile with no usable name
const MISSING = uid28('Missing');    // no users/{uid} document at all
const FAILS = uid28('Fails');        // a users/{uid} read that throws
const HUMANS = [VIEWER, ADA, GRACE, LEGACY, NAMELESS, MISSING, FAILS];

/** What every human seat must read as: the nested name, the legacy name, or "Player" — never an id. */
const EXPECTED = Object.freeze({
  [VIEWER]: 'Vee', [ADA]: 'Ada L', [GRACE]: 'grace', [LEGACY]: 'Old Timer',
  [NAMELESS]: 'Player', [MISSING]: 'Player', [FAILS]: 'Player',
});

/** users/{uid} EXACTLY as src/firebase/authService.js signUp writes it — the names NESTED under `profile`. */
const production = (uid, { username, displayName }) => ({
  _v: 1,
  auth: { uid, email: `${uid.slice(0, 6).toLowerCase()}@example.com`, createdAt: '2026-09-01T12:00:00.000Z', lastLoginAt: '2026-09-20T12:00:00.000Z' },
  profile: { username, displayName, avatarUrl: null, bio: null },
  stats: { xp: 0, level: 1, rank: 'Beginner', wins: 0, losses: 0, totalBattles: 0, winStreak: 0, longestWinStreak: 0, totalXPEarned: 0 },
  settings: {
    notifications: { battleStart: true, battleEnd: true, challengeAvailable: true },
    privacy: { showStats: true, allowChallenges: true },
  },
  achievements: [],
  metadata: { referralCode: null, premiumTier: null, flags: {} },
  archived: false,
  updatedAt: '2026-09-20T12:00:00.000Z',
});
const USERS = {
  [VIEWER]: production(VIEWER, { username: 'vee', displayName: 'Vee' }),
  [ADA]: production(ADA, { username: 'ada', displayName: 'Ada L' }),
  [GRACE]: production(GRACE, { username: 'grace', displayName: '' }),
  [LEGACY]: { username: 'Old Timer', email: 'old@example.com' },
  [NAMELESS]: production(NAMELESS, { username: null, displayName: null }),
  [FAILS]: production(FAILS, { username: 'unread', displayName: 'Never Read' }),
};

const NOW = new Date('2026-09-23T21:20:00.000Z');

/** A tournamentGroups doc: four seats, one banked day. Seats are [odUserId, composite, symbols]. */
function groupDoc({ id, bracketGameId = null, seats }) {
  return {
    id,
    status: GROUP_STATUS.BATTLE,
    roundNumber: 1,
    ...(bracketGameId ? { bracketGameId } : { baseLayerWeek: '2026-W39' }),
    groupMembers: seats.map(([uid]) => uid),
    players: seats.map(([uid, , symbols = []]) => ({
      odUserId: uid,
      ...(isCpuUserId(uid) ? { isCpu: true } : {}),
      picks: symbols.map((symbol) => ({ symbol, legs: [{ direction: 'long' }] })),
    })),
    dailyScores: {
      day1: {
        recordedDate: '2026-09-21',
        closeScores: Object.fromEntries(seats.map(([uid, c]) => [uid, { compositePoints: c, totalPoints: c / 2, agentPoints: c / 4, picks: [] }])),
      },
    },
  };
}

// Your bracket game, and THE FIELD's two base-layer groups. ADA, LEGACY and
// MISSING each hold a symbol nobody else does from the top composite quartile,
// so the month board's contrarian feed NAMES them (the feed reads the names).
const MY_GROUP = groupDoc({ id: 'lg-g1', bracketGameId: 'lb-r1-g1', seats: [[VIEWER, 12, ['NVDA']], [ADA, 40, ['AMD']], ['cpu-1', 6], [NAMELESS, -3, ['NVDA']]] });
const FIELD_1 = groupDoc({ id: 'lg-f1', seats: [[VIEWER, 8, ['NVDA']], [LEGACY, 30, ['COIN']], [MISSING, 25, ['PLTR']], ['cpu-3', 1]] });
const FIELD_2 = groupDoc({ id: 'lg-f2', seats: [[GRACE, 22, ['NVDA']], [FAILS, 5, ['NVDA']], [NAMELESS, 2, ['NVDA']], ['cpu-4', 0]] });
const seatsOf = (group) => group.players.map(({ odUserId, isCpu }) => ({ odUserId, ...(isCpu ? { isCpu } : {}) }));
const BRACKET = {
  id: 'lb', bracketId: 'lb', status: 'active', currentRound: 1, totalRounds: 3,
  rounds: {
    r1: {
      roundNumber: 1,
      games: {
        'lb-r1-g1': { bracketGameId: 'lb-r1-g1', gameIndex: 1, groupId: MY_GROUP.id, seats: seatsOf(MY_GROUP), finalScores: null, completedAt: null },
        'lb-r1-g2': {
          bracketGameId: 'lb-r1-g2', gameIndex: 2, groupId: 'lg-g2',
          seats: [{ odUserId: GRACE }, { odUserId: LEGACY }, { odUserId: 'cpu-2', isCpu: true }, { odUserId: FAILS }],
          finalScores: { [GRACE]: 9, [LEGACY]: 7, 'cpu-2': 3, [FAILS]: -2 }, completedAt: '2026-09-19T20:00:00.000Z',
        },
      },
    },
  },
};

/** A month doc as the OLD writer stored it: every human's raw uid as displayName and in the feed's names. */
const LEGACY_BOARD = {
  id: '2026-08',
  monthKey: '2026-08',
  entries: {
    [ADA]: { odUserId: ADA, displayName: ADA, isCpu: false, weeks: { 'lg-old': { points: 12, final: true } }, points: 12, currentGroupId: 'lg-old' },
    [MISSING]: { odUserId: MISSING, displayName: MISSING, isCpu: false, weeks: { 'lg-old': { points: 4, final: true } }, points: 4, currentGroupId: 'lg-old' },
    'cpu-5': { odUserId: 'cpu-5', displayName: 'CPU — Momentum Rider', isCpu: true, weeks: { 'lg-old': { points: -1, final: true } }, points: -1, currentGroupId: 'lg-old' },
  },
  feeds: { consensus: [], contrarian: [{ symbol: 'AMD', holders: 1, names: [ADA], bestComposite: 40 }] },
};

/** The server's Admin-SDK handle: the in-memory store, with the FAILS read throwing. */
function serverDb() {
  const made = makeInMemoryDb(Object.fromEntries(Object.entries(USERS).map(([uid, data]) => [`users/${uid}`, data])));
  const db = {
    ...made.db,
    collection: (name) => {
      const col = made.db.collection(name);
      if (name !== 'users') return col;
      return { ...col, doc: (id) => (ctx.failing.has(id) ? { get: async () => { throw new Error('unavailable'); } } : col.doc(id)) };
    },
  };
  return { db, store: made.store };
}

// ==================== THE WALK ====================

/** A Firebase Auth uid on a screen: exactly 28 alphanumerics, standing alone — this guard's own pattern. */
const ACCOUNT_ID = /(?<![A-Za-z0-9])[A-Za-z0-9]{28}(?![A-Za-z0-9])/;

/** The first account id in the text — by shape, or any of the world's uids anywhere in it — or null. */
function rawIdIn(text) {
  const m = text.match(ACCOUNT_ID);
  if (m) return m[0];
  return HUMANS.find((uid) => text.includes(uid)) ?? null;
}

/**
 * What a reader is shown: the text NODE BY NODE (never glued into runs no
 * reader sees; style/script bodies are not shown), and the attributes a screen
 * reader or a hover speaks.
 */
function visibleText(container) {
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('style, script') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const parts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim()) parts.push(n.nodeValue);
  for (const el of container.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(attr);
      if (v) parts.push(v);
    }
  }
  return parts.join(' ‖ ');
}

/** Every surface that shows an account id, with the id and its context. */
function offenders(surfaces) {
  const out = [];
  for (const [name, container] of surfaces) {
    const text = visibleText(container);
    const id = rawIdIn(text);
    if (id) {
      const at = text.indexOf(id);
      out.push(`${name}: ${JSON.stringify(id)} in …${text.slice(Math.max(0, at - 40), at + id.length + 40)}…`);
    }
  }
  return out;
}

/** Fields that ARE ids by contract in a stored doc — keyed on, never shown. Everything else is walked. */
const ID_FIELDS = new Set(['odUserId', 'currentGroupId', 'groupId', 'bracketGameId', 'id']);
function displayStrings(value, path = '$', out = []) {
  if (typeof value === 'string') { out.push([path, value]); return out; }
  if (Array.isArray(value)) { value.forEach((v, i) => displayStrings(v, `${path}[${i}]`, out)); return out; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!ID_FIELDS.has(k)) displayStrings(v, `${path}.${k}`, out);
  }
  return out;
}

const ssr = (element) => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  return container;
};
let mounted = [];
async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  // Let a surface's own one-shot reads (the arena's name read) resolve and re-render.
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
  mounted.push({ root, container });
  return container;
}

/** Every League seat surface a state can reach: both lobbies, then every seated pod as a card, the docked panel and Spectate on each human. */
function leagueSurfaces(st, label) {
  ctx.leagueState = st;
  const noop = () => {};
  const out = [
    [`${label} · desktop lobby`, ssr(<LeagueLobbyDesktop onOpenMyGame={noop} onOpenTrainingPod={noop} hasAgent agentLoadout={null} />)],
    [`${label} · mobile lobby`, ssr(<LeagueHome onOpenMyGame={noop} onOpenTrainingPod={noop} hasAgent agentLoadout={null} />)],
  ];
  const pods = [...st.rounds.r1, ...st.rounds.r2, st.rounds.r3, ...st.baseGames].filter((pod) => pod.seats.some(Boolean));
  const cards = [];
  for (const pod of pods) {
    const where = `${label} · ${pod.base ? 'the field' : 'bracket'} pod ${pod.id} (${pod.name})`;
    const card = ssr(<PodCard pod={pod} accent="#5eead4" onSpectate={noop} />);
    cards.push({ where, card, pod });
    out.push([`${where} · PodCard`, card]);
    out.push([`${where} · DeskPodPanel`, ssr(<DeskPodPanel pod={pod} accent="#5eead4" onClose={noop} onSpectate={noop} onClimb={noop} />)]);
    for (const seat of pod.seats.filter((s) => s && s.kind === 'human')) {
      out.push([`${where} · Spectate on ${EXPECTED[seat.id]}`, ssr(<Spectate pod={pod} focusId={seat.id} accent="#5eead4" onBack={noop} onEnter={noop} />)]);
    }
  }
  return { surfaces: out, pods, cards };
}

// ==================== EVERY DOOR, ONCE ====================

const R = {};
beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  Object.assign(ctx.users, structuredClone(USERS));
  ctx.failing.add(FAILS);

  // READS — both readers, the same seats.
  R.client = await fetchDisplayNames([...HUMANS, 'cpu-1']);
  R.server = await resolveDisplayNames(serverDb().db, [...HUMANS, 'cpu-1']);

  // WRITES — the month board (entries + the contrarian feed) and the rank docs, by the real writers.
  const { db, store } = serverDb();
  ctx.flags.ladder = false;
  await upsertLeaderboardForGroups(db, [MY_GROUP, FIELD_1, FIELD_2], { now: NOW, heldByGroup: {}, writeFeeds: true });
  R.board = { id: '2026-09', ...store.get('tournamentLeaderboards/2026-09') };
  const composites = Object.fromEntries(Object.entries(MY_GROUP.dailyScores.day1.closeScores).map(([uid, s]) => [uid, s.compositePoints]));
  const ranking = Object.keys(composites).sort((a, b) => composites[b] - composites[a]);
  await applyGroupWeekToRanks(db, { groupId: MY_GROUP.id, seats: seatsOf(MY_GROUP), compositeByPlayer: composites, ranking, now: NOW });
  R.ranks = Object.fromEntries(MY_GROUP.players.map(({ odUserId }) => [odUserId, store.get(`tournamentRanks/${odUserId}`)]));
});
afterAll(async () => {
  for (const { root, container } of mounted) { await act(async () => root.unmount()); container.remove(); }
  mounted = [];
  vi.restoreAllMocks();
});

// ============================================================================
describe('the guard\'s own walk is not vacuous', () => {
  it('a world uid is caught standing alone and inside a line; a name, "Player" and a CPU\'s agent name are not', () => {
    for (const uid of HUMANS) {
      expect(rawIdIn(uid), uid).toBe(uid);
      expect(rawIdIn(`Winner: ${uid} · 12 pts`), uid).toBe(uid);
      expect(rawIdIn(`${uid}xyz`), 'a uid glued into a longer run').toBe(uid);
    }
    for (const ok of ['Ada L', 'Old Timer', 'Player', 'grace', 'CPU — Trend Follower', 'Leaderboard · the field', '2026-09-21T20:00:00.000Z']) {
      expect(rawIdIn(ok), ok).toBeNull();
    }
  });

  it('the world is production-shaped: the nested profile carries the names, and nothing is named at the top level', () => {
    for (const uid of [VIEWER, ADA, GRACE, NAMELESS, FAILS]) {
      expect(USERS[uid].profile, uid).toBeTruthy();
      expect(USERS[uid].username, uid).toBeUndefined();
      expect(USERS[uid].displayName, uid).toBeUndefined();
    }
  });
});

describe('READS — both League name readers answer the nested names, and never an id', () => {
  it('the client reader (fetchDisplayNames): profile.displayName, profile.username, the legacy top level, else "Player"; CPUs never read', () => {
    expect(R.client).toEqual(EXPECTED);
    expect(ctx.clientReads).not.toContain('cpu-1');
  });

  it('the server reader (resolveDisplayNames) agrees with the client seat for seat (§9); a CPU is its agent name', () => {
    const { 'cpu-1': cpuName, ...humans } = R.server;
    expect(humans).toEqual(R.client);
    expect(cpuName).toMatch(/^CPU — /);
  });
});

describe('WRITES — the month board and the rank docs carry the names, and no display string is an id', () => {
  it('walks every non-id string the real writers stored', () => {
    const found = [];
    for (const [path, text] of [...displayStrings(R.board, 'board'), ...displayStrings(R.ranks, 'ranks')]) {
      const id = rawIdIn(text);
      if (id) found.push(`${path} = ${JSON.stringify(text)}`);
    }
    expect(found).toEqual([]);
  });

  it('every entry, every rank doc and the contrarian feed name the player the profile names', () => {
    for (const uid of HUMANS) expect(R.board.entries[uid]?.displayName, uid).toBe(EXPECTED[uid]);
    for (const uid of [VIEWER, ADA, NAMELESS]) expect(R.ranks[uid]?.displayName, uid).toBe(EXPECTED[uid]);
    const named = R.board.feeds.contrarian.flatMap((c) => c.names).sort();
    expect(named).toEqual(['Ada L', 'Old Timer', 'Player']);
  });
});

describe('SURFACES — League seats, pod-list rows and leaderboard rows show NO raw id', () => {
  it('every League seat surface, from the resolved names: no id, and every seat reads as its player', () => {
    const { surfaces, pods, cards } = leagueSurfaces(buildLeagueState({
      myGroup: MY_GROUP, bracket: BRACKET, fieldGroups: [FIELD_1, FIELD_2], names: R.client, uid: VIEWER, liveClock: 3600,
    }).state, 'named');
    // THE SCAN FIRST, so a raw id is reported by the scan (surface, id, context).
    expect(offenders(surfaces)).toEqual([]);

    // Not vacuous: the bracket pods AND the field's pod list rendered, and each
    // card names every human seat as its player (the pod-list rows).
    expect(pods.filter((p) => p.base).map((p) => p.id).sort()).toEqual([FIELD_1.id, FIELD_2.id]);
    expect(pods.filter((p) => !p.base)).toHaveLength(2);
    for (const { where, card, pod } of cards) {
      const text = visibleText(card);
      const humans = pod.seats.filter((s) => s && s.kind === 'human');
      expect(humans.length, where).toBeGreaterThan(0);
      for (const seat of humans) expect(text, `${where} names ${EXPECTED[seat.id]}`).toContain(EXPECTED[seat.id]);
    }
    // The lobby leaderboard (the desktop rail's field board) names the field.
    const desktop = visibleText(surfaces[0][1]);
    for (const name of ['Old Timer', 'grace', 'Player', 'Vee']) expect(desktop, `the field board names ${name}`).toContain(name);
    const all = surfaces.map(([, c]) => visibleText(c)).join(' ');
    for (const name of Object.values(EXPECTED)) expect(all).toContain(name);
  });

  it('BEFORE the names arrive (the hook\'s first render: names = {}): every human seat reads "Player", never its id', () => {
    const { surfaces } = leagueSurfaces(buildLeagueState({
      myGroup: MY_GROUP, bracket: BRACKET, fieldGroups: [FIELD_1, FIELD_2], names: {}, uid: VIEWER, liveClock: 3600,
    }).state, 'unnamed');
    expect(offenders(surfaces)).toEqual([]);
    expect(visibleText(surfaces[0][1])).toContain('Player');
  });

  it('the arena climb (TrainingClimbPreview runs its OWN name read) names its seats, never their ids', async () => {
    const climb = await mount(<TrainingClimbPreview pod={MY_GROUP} uid={VIEWER} onOpen={() => {}} viewport="desktop" />);
    expect(offenders([['TrainingClimbPreview', climb]])).toEqual([]);
    const text = visibleText(climb);
    for (const name of ['Vee', 'Ada L', 'Player']) expect(text, `the climb names ${name}`).toContain(name);
    // The arena model's seats — the names the live arena's overlays read (name + owner).
    const { seats } = buildArenaModel({ group: MY_GROUP, battle: null, claims: [], priceCtx: {}, displayNames: R.client, uid: VIEWER, mode: 'ranked' });
    for (const seat of seats) {
      for (const text of [seat.name, seat.owner].filter(Boolean)) expect(rawIdIn(text), `${seat.id} → ${text}`).toBeNull();
    }
  });

  it('the month board — BOTH row variants, from the fixed writer\'s doc: no id, and the rows and the feed name the players', async () => {
    for (const ladder of [false, true]) {
      ctx.flags.ladder = ladder;
      ctx.board = R.board;
      const card = await mount(<LeaderboardCard uid={VIEWER} initialMonthKey="2026-09" onOpenGroup={() => {}} />);
      expect(offenders([[`LeaderboardCard (ladder ${ladder ? 'on' : 'off'})`, card]])).toEqual([]);
      const text = visibleText(card);
      for (const name of ['Ada L', 'grace', 'Old Timer', 'Player']) expect(text, `ladder ${ladder}: ${name}`).toContain(name);
      expect(text).toContain('Contrarian');
    }
    ctx.flags.ladder = false;
  });

  it('the month board from a LEGACY doc the old writer stored (raw uids as names): every such row and feed name reads "Player"', async () => {
    for (const ladder of [false, true]) {
      ctx.flags.ladder = ladder;
      ctx.board = LEGACY_BOARD;
      const card = await mount(<LeaderboardCard uid={VIEWER} initialMonthKey="2026-08" onOpenGroup={() => {}} />);
      expect(offenders([[`LeaderboardCard legacy doc (ladder ${ladder ? 'on' : 'off'})`, card]])).toEqual([]);
      const text = visibleText(card);
      expect(text).toContain('Player');
      expect(text).toContain('CPU — Momentum Rider');
    }
    ctx.flags.ladder = false;
  });
});
