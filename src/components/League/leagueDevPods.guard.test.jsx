// @vitest-environment jsdom
// src/components/League/leagueDevPods.guard.test.jsx
//
// THE LEAGUE TEST-POD GUARD — a test pod (`isDev`) never reaches a real
// player's League.
//
// THE BUG IT PINS (the backing activation review record, SCRIPT-01 / DEV-R-2,
// §8 item 1): the preview and the live site share one Firestore, and the
// League field's read — subscribeBaseLayerGroups → selectBaseLayerField —
// dropped training pods and VOIDED groups only. Any `isDev` pod stamped with
// the current week (an admin-seeded dev pod at once; the backing smoke
// script's pod from Monday 00:00 ET of its battle week) reached EVERY
// signed-in player: as an upcoming card, and after settlement as a final card
// whose made-up composites topped the desktop "Leaderboard · the field" rail,
// its seats counted in the players / CPU agents figures.
//
// ONE WORLD, PRODUCTION-SHAPED: the current week's field as the query answers
// it — two real pods (named players, CPU seats, banked composites; you seated
// in one), an admin-seeded dev pod (the seeder's shape: the founder and its
// three placeholder seats, driven to BATTLE), and the backing smoke pod built
// by the smoke script's OWN builders (buildSmokeGroup; buildSyntheticWeek for
// the state after `advance`) — read through the REAL subscription, selector,
// hooks (useLeagueState → useRealLeagueState), lit provider and adapter, then
// rendered through the REAL lobbies (desktop: the rail and the counts; mobile:
// the field's cards and the counts). Only Firestore, the signed-in user, the
// battles projection, the lit answer and the lobbies' unrelated service seams
// are stood in for.
//
// ROWS
//   · NOT LIT (every real player, on every deployment: the server answers
//     `{ lit: false }`): no test pod in any card, rail row or count.
//   · LIT (the server's answer for the allowlisted founder on a preview): the
//     test pods are there — cards, rail rows, counts — once the answer lands.
//   · A NON-DEV POD IS UNAFFECTED: the real pods are identical lit and not
//     lit, and a test pod never takes a real pod's slot.
//   · THE FLIP TRIPWIRE: the not-lit row again under the SHIPPED
//     BACKING_BETA_ENABLED (every other row holds it false). useBackingLit()
//     lights EVERY viewer once the flag flips, so this row reds at the flip
//     until the flip PR re-keys useRealLeagueState's `includeDev` — the smoke
//     override, the only reason a viewer should see a test pod, is deleted in
//     that commit.
//
// MUTATION CHECK: drop the isDev filter in selectBaseLayerField, or hand the
// read `includeDev: true` unconditionally → the NOT LIT rows red; hand it
// `includeDev: false` unconditionally → the LIT rows red.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const ctx = vi.hoisted(() => ({
  groups: {},                        // tournamentGroups/{id} → the doc the field query reads
  users: {},                         // users/{uid} → the doc the name reader reads
  reads: [],                         // every users/{uid} the name reader asked for
  queries: [],                       // every client subscription opened on tournamentGroups
  viewer: null,                      // the signed-in uid (auth + UserContext)
  myGroup: null,                     // the viewer's seat (subscribeMyGroup)
  litAnswer: false,                  // what GET /api/backing/lit answers this viewer
  litAsks: 0,
  flags: { backing: false, shipped: null },
  // The field query, answered like Firestore would: equality filters, then
  // the order, then the limit.
  run(q) {
    let docs = Object.entries(ctx.groups).map(([id, data]) => ({ id, data }));
    for (const c of q.clauses) {
      if (c.where) {
        const [field, op, value] = c.where;
        if (op !== '==') throw new Error(`guard: unexpected where op ${op}`);
        docs = docs.filter((d) => d.data[field] === value);
      }
    }
    const order = q.clauses.find((c) => c.orderBy)?.orderBy;
    if (order) {
      const [field, dir] = order;
      docs.sort((a, b) => String(a.data[field] ?? '').localeCompare(String(b.data[field] ?? '')) * (dir === 'desc' ? -1 : 1));
    }
    const lim = q.clauses.find((c) => c.limit != null)?.limit;
    if (lim != null) docs = docs.slice(0, lim);
    return docs.map((d) => ({ id: d.id, data: () => structuredClone(d.data) }));
  },
}));

vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  collection: (_db, name) => ({ collection: name }),
  where: (field, op, value) => ({ where: [field, op, value] }),
  orderBy: (field, dir = 'asc') => ({ orderBy: [field, dir] }),
  limit: (n) => ({ limit: n }),
  query: (ref, ...clauses) => ({ ...ref, clauses }),
  onSnapshot: (q, next) => {
    if (q.collection !== 'tournamentGroups') { next({ docs: [] }); return () => {}; }
    ctx.queries.push(q);
    next({ docs: ctx.run(q) });
    return () => {};
  },
  doc: (_db, ...segments) => ({ path: segments.join('/') }),
  getDoc: async ({ path }) => {
    const [collection, uid] = path.split('/');
    if (collection !== 'users') throw new Error(`guard: unexpected client read ${path}`);
    ctx.reads.push(uid);
    const data = ctx.users[uid];
    return { exists: () => data !== undefined, data: () => structuredClone(data) };
  },
}));
vi.mock('../../firebase/config', () => ({
  auth: { get currentUser() { return ctx.viewer ? { uid: ctx.viewer } : null; } },
  db: {},
  default: {},
}));
// The flag is a getter, held FALSE by every row but the tripwire, which runs
// under the value the module ships.
vi.mock('../../config/featureFlags', async (importOriginal) => {
  const orig = await importOriginal();
  ctx.flags.shipped = orig.BACKING_BETA_ENABLED;
  return { ...orig, get BACKING_BETA_ENABLED() { return ctx.flags.backing; } };
});
// The REAL field read (subscribeBaseLayerGroups → selectBaseLayerField) and the
// REAL name reader (fetchDisplayNames); only the member-scoped reads are stood in.
vi.mock('../../services/tournamentGroupService', async (importOriginal) => ({
  ...(await importOriginal()),
  subscribeMyGroup: (_uid, cb) => { cb(ctx.myGroup); return () => {}; },
  subscribeMyTrainingPod: (_uid, cb) => { cb(null); return () => {}; },
  subscribeMyMostRecentVoidedGroup: (_uid, cb) => { cb(null); return () => {}; },
  subscribeBracket: (_id, cb) => { cb(null); return () => {}; },
  subscribeLeaderboard: (_id, cb) => { cb(null); return () => {}; },
}));
vi.mock('../../hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: {} }) }));
vi.mock('../../contexts/UserContext', () => ({ useUser: () => ({ user: ctx.viewer ? { uid: ctx.viewer, displayName: 'Vee' } : null }) }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ tokens: {
    bgCard: '#15171E', borderDivider: '#24262d', textPrimary: '#e2e8f0',
    textMuted: '#94a3b8', textFaint: '#64748b', medalGold: '#eab308', bgApp: '#0b0d12',
  } }),
}));
// The backing pod list (the strip) is its own surface with its own server-side
// dev filter (listablePod / smokeListablePod) — stood in, so the lit rows read
// the League field and nothing else.
vi.mock('./backing/BackingLandingStrip', () => ({ default: () => null }));
vi.mock('../../services/backingService', () => ({
  fetchBackingLit: vi.fn(async () => { ctx.litAsks += 1; return { lit: ctx.litAnswer === true }; }),
  fetchBackingPods: vi.fn(async () => ({ pods: [] })), fetchTeamCard: vi.fn(), placeStake: vi.fn(), attestEligibility: vi.fn(), savePitch: vi.fn(),
  newRequestId: () => 'req', subscribeMyStakes: () => () => {}, subscribePool: () => () => {}, subscribeWallet: () => () => {},
  readEligibility: async () => null, subscribePitch: () => () => {}, fetchTapePod: async () => null, fetchTeamLabels: vi.fn(async () => ({ pods: {} })),
  fetchBackingResults: vi.fn(async () => ({ weeks: [], nextBefore: null })), fetchMyBackingStats: vi.fn(async () => null), fetchTrainerStats: vi.fn(async () => null), postBackingEvent: vi.fn(async () => ({ recorded: true })),
  BackingApiError: class BackingApiError extends Error {},
}));
// The lobbies' unrelated service seams (the leagueRawIds.guard set).
vi.mock('../../services/leagueSignals', () => ({ logLeagueSignal: () => {} }));
vi.mock('../../services/tournamentLobbyActions', () => ({ quickPlay: () => Promise.resolve({}), quickPlayTraining: () => Promise.resolve({}), mapLobbyError: () => 'error' }));
vi.mock('../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }),
  claimSlot: () => Promise.resolve({}),
  releaseSlot: () => Promise.resolve({}),
  mapSlotActionError: () => 'error',
}));
vi.mock('./LoadoutChooserSheet', () => ({ default: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => ({}) })) }));

const { GROUP_STATUS, currentBaseLayerWeek, isCpuUserId, selectBaseLayerField } = await import('../../constants/leagueTournament');
const { buildSmokeGroup, buildSyntheticWeek, smokeIds } = await import('../../../scripts/backingSmokeLib.js');
const { baseGroupName } = await import('./leagueAdapter');
const { default: useLeagueState } = await import('../../hooks/useLeagueState');
const { default: BackingLitProvider } = await import('./backing/BackingLitProvider');
const { default: LeagueLobbyDesktop } = await import('./LeagueLobbyDesktop');
const { default: LeagueHome } = await import('./LeagueHome');

// ==================== THE WORLD ====================

// Wed 23 Sep 2026 17:20 ET — mid battle week; the hook derives the SAME week.
const NOW = new Date('2026-09-23T21:20:00.000Z');
const WEEK = currentBaseLayerWeek(NOW);

const uid28 = (head) => `${head}${'0'.repeat(27 - head.length)}Z`;   // a 28-character Firebase uid
const VIEWER = uid28('Viewer');
const ADA = uid28('Ada');
const GRACE = uid28('Grace');
const BO = uid28('Bo');
const ED = uid28('Ed');
const FOUNDER = uid28('Founder');

/** users/{uid} as src/firebase/authService.js writes it — the names nested under `profile`. */
const profile = (username, displayName) => ({ profile: { username, displayName, avatarUrl: null, bio: null }, archived: false });
const USERS = {
  [VIEWER]: profile('vee', 'Vee'),
  [ADA]: profile('ada', 'Ada Lovelace'),
  [GRACE]: profile('grace', ''),
  [BO]: profile('bo', 'Bo Reyes'),
  [ED]: profile('ed', 'Ed Park'),
  [FOUNDER]: profile('founder', 'The Founder'),
};
const REAL_NAMES = ['Vee', 'Ada Lovelace', 'grace', 'Bo Reyes', 'Ed Park'];

/** A base-layer pod of this week: four seats, one banked day. Seats are [odUserId, composite]. */
function fieldPod({ status = GROUP_STATUS.BATTLE, seats, updatedAt, extra = {} }) {
  return {
    status,
    roundNumber: 1,
    baseLayerWeek: WEEK,
    groupMembers: seats.map(([uid]) => uid),
    players: seats.map(([uid]) => ({ odUserId: uid, ...(isCpuUserId(uid) ? { isCpu: true } : {}), picks: [] })),
    dailyScores: {
      day1: {
        recordedDate: '2026-09-21',
        closeScores: Object.fromEntries(seats.map(([uid, c]) => [uid, { compositePoints: c, totalPoints: c / 2, agentPoints: c / 4 }])),
      },
    },
    createdAt: '2026-09-18T15:00:00.000Z',
    updatedAt,
    ...extra,
  };
}

const FIELD_A = 'lg-field-a';
const FIELD_B = 'lg-field-b';
const SEEDED = 'kQ2mSeededDevPod01';   // an admin-seeded dev pod (Firestore auto-id shape)
const SMOKE = smokeIds('20260921_qa7p2x');
const REAL_IDS = [FIELD_A, FIELD_B];

const REAL_PODS = {
  // You play here, with Ada and two CPUs; Ada leads the real field.
  [FIELD_A]: fieldPod({ seats: [[VIEWER, 12], [ADA, 20], ['cpu-1', 4], ['cpu-2', 3]], updatedAt: '2026-09-23T20:00:00.000Z' }),
  [FIELD_B]: fieldPod({ seats: [[GRACE, 15], [BO, 9], [ED, 7], ['cpu-3', 2]], updatedAt: '2026-09-23T19:00:00.000Z' }),
};
// api/admin/seed-tournament-group.js: the founder plus three placeholder
// seats, stamped isDev — here driven to BATTLE by the dev duty.
const SEEDED_POD = fieldPod({
  seats: [[FOUNDER, 30], ['dev-user-1', 26], ['dev-user-2', 24], ['dev-user-3', 22]],
  updatedAt: '2026-09-23T21:00:00.000Z',
  extra: { isDev: true },
});
/** The smoke script's pod, from its own builders — seeded (`forming`), or after `advance` (`complete`, the synthetic week banked). */
function smokePod(state) {
  const seeded = buildSmokeGroup({ ids: SMOKE, nowIso: '2026-09-18T15:00:00.000Z', userPool: null });
  // Still in the database on its battle week: the week the field reads now.
  const pod = { ...seeded, baseLayerWeek: WEEK, updatedAt: '2026-09-23T21:10:00.000Z' };
  if (state === 'forming') return pod;
  const dailyScores = buildSyntheticWeek({ group: pod, battleMondayEtDate: '2026-09-21', winnerOdUserId: SMOKE.seatUids[0], recordedAtIso: '2026-09-23T21:10:00.000Z' });
  return { ...pod, dailyScores, status: GROUP_STATUS.COMPLETE };
}
const TEST_POD_NAMES = [baseGroupName(SEEDED), baseGroupName(SMOKE.groupId)];
const REAL_POD_NAMES = REAL_IDS.map(baseGroupName);

function seedWorld(smokeState) {
  ctx.groups = { ...structuredClone(REAL_PODS), [SEEDED]: structuredClone(SEEDED_POD), [SMOKE.groupId]: smokePod(smokeState) };
  ctx.users = structuredClone(USERS);
  ctx.viewer = VIEWER;
  ctx.myGroup = { id: FIELD_A, ...structuredClone(REAL_PODS[FIELD_A]) };
  ctx.queries = [];
  ctx.reads = [];
  ctx.litAsks = 0;
}

// ==================== THE WALK ====================

/** Every visible text node, trimmed, in document order (style/script bodies are not shown). */
function textNodes(container) {
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('style, script') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const out = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim()) out.push(n.nodeValue.trim());
  return out;
}
const leaves = (container) => [...container.querySelectorAll('*')].filter((el) => el.children.length === 0);
/** A hero stat ("12 players", "3 CPU agents"): the figure beside its label. */
function stat(container, label) {
  const found = leaves(container).filter((el) => el.textContent === label).map((el) => Number(el.previousElementSibling?.textContent));
  expect(found, `one "${label}" stat`).toHaveLength(1);
  return found[0];
}
/** The desktop rail: its "N players" figure and its rows' names, top first. */
function rail(container) {
  const eyebrow = leaves(container).find((el) => el.textContent === 'Leaderboard · the field');
  expect(eyebrow, 'the desktop rail rendered').toBeTruthy();
  const root = eyebrow.parentElement.parentElement;
  const figure = leaves(root).map((el) => /^(\d+) players$/.exec(el.textContent)).find(Boolean);
  const known = new Set([...REAL_NAMES, 'The Founder', 'Player']);
  const names = textNodes(root.children[1]).filter((t) => known.has(t));
  return { players: Number(figure?.[1]), names };
}
/** The mobile field's cards, by their pod names (every base card carries the leaderboard footer). */
function cards(container) {
  const nodes = textNodes(container);
  const all = [...REAL_POD_NAMES, ...TEST_POD_NAMES];
  return {
    count: nodes.filter((t) => t === 'Feeds the leaderboard · not the bracket').length,
    names: all.filter((n) => nodes.includes(n)),
  };
}

let mounted = [];
async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  // Let the lit ask, the re-subscription and the name read land and re-render.
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
  mounted.push({ root, container });
  return container;
}
const probe = { st: null };
function Probe() { probe.st = useLeagueState('open').state; return null; }
const noop = () => {};
/** Both lobbies and the state they read, under the REAL lit provider. */
async function renderLeague() {
  const desktop = await mount(<BackingLitProvider><LeagueLobbyDesktop onOpenMyGame={noop} onOpenTrainingPod={noop} hasAgent agentLoadout={null} /></BackingLitProvider>);
  const mobile = await mount(<BackingLitProvider><LeagueHome onOpenMyGame={noop} onOpenTrainingPod={noop} hasAgent agentLoadout={null} /></BackingLitProvider>);
  await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
  return { desktop, mobile, st: probe.st };
}
const fieldQueries = () => ctx.queries.filter((q) => q.clauses.some((c) => c.where?.[0] === 'baseLayerWeek'));

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  ctx.flags.backing = false;
  ctx.litAnswer = false;
});
afterEach(async () => {
  for (const { root, container } of mounted) { await act(async () => root.unmount()); container.remove(); }
  mounted = [];
  vi.restoreAllMocks();
});
afterAll(() => { vi.useRealTimers(); });

// ============================================================================
describe('selectBaseLayerField — the one place the field drops a test pod', () => {
  const pod = (id, updatedAt, extra = {}) => ({ id, baseLayerWeek: '2026-W39', updatedAt, ...extra });

  it('drops an isDev pod by default; a doc that omits isDev, or says false, is a real pod', () => {
    const dev = pod('d', '2026-09-23T22:00:00Z', { isDev: true });
    const omitted = pod('a', '2026-09-23T10:00:00Z');
    const explicitFalse = pod('b', '2026-09-23T09:00:00Z', { isDev: false });
    expect(selectBaseLayerField([dev, omitted, explicitFalse], 12).map((g) => g.id)).toEqual(['a', 'b']);
    expect(selectBaseLayerField([dev], 12)).toEqual([]);
  });

  it('includeDev: true keeps it (a lit viewer) — and only the boolean true does', () => {
    const dev = pod('d', '2026-09-23T22:00:00Z', { isDev: true });
    const real = pod('a', '2026-09-23T10:00:00Z');
    expect(selectBaseLayerField([dev, real], 12, { includeDev: true }).map((g) => g.id)).toEqual(['d', 'a']);
    for (const notTrue of ['true', 1, {}, null, undefined, false]) {
      expect(selectBaseLayerField([dev, real], 12, { includeDev: notTrue }).map((g) => g.id), String(notTrue)).toEqual(['a']);
    }
  });

  it('the training and VOIDED exclusions are unchanged, lit or not — a dev pod that is training or void stays out', () => {
    const devTraining = pod('t', '2026-09-23T22:00:00Z', { isDev: true, isTraining: true });
    const devVoided = pod('v', '2026-09-23T21:00:00Z', { isDev: true, status: GROUP_STATUS.VOIDED });
    const real = pod('a', '2026-09-23T10:00:00Z');
    for (const includeDev of [false, true]) {
      expect(selectBaseLayerField([devTraining, devVoided, real], 12, { includeDev }).map((g) => g.id)).toEqual(['a']);
    }
  });

  it('a test pod never consumes a cap slot: the filter runs before the cap', () => {
    const reals = Array.from({ length: 12 }, (_, i) => pod(`g${i}`, `2026-09-23T08:${String(i).padStart(2, '0')}:00Z`));
    const devs = Array.from({ length: 10 }, (_, i) => pod(`d${i}`, `2026-09-23T23:${String(i).padStart(2, '0')}:00Z`, { isDev: true }));
    const out = selectBaseLayerField([...devs, ...reals], 12);
    expect(out.map((g) => g.id).sort()).toEqual(reals.map((g) => g.id).sort());
  });
});

describe('the guard\'s own world is what the rows claim', () => {
  it('four pods of THIS week: two real, two test — the smoke pod from the smoke script\'s own builder, carrying its marker', () => {
    seedWorld('complete');
    expect(Object.values(ctx.groups).every((g) => g.baseLayerWeek === WEEK)).toBe(true);
    expect(Object.entries(ctx.groups).filter(([, g]) => g.isDev === true).map(([id]) => id).sort()).toEqual([SEEDED, SMOKE.groupId].sort());
    expect(ctx.groups[SMOKE.groupId].smoke?.tool).toBe('scripts/backing-smoke.js');
    // Every pod reads under its own name, so a card names exactly one pod.
    expect(new Set([...REAL_POD_NAMES, ...TEST_POD_NAMES]).size).toBe(4);
    // The only unnamed seats are the test pods' (no users/ doc behind them):
    // a "Player" on screen is a test seat.
    for (const id of REAL_IDS) {
      for (const p of ctx.groups[id].players) expect(isCpuUserId(p.odUserId) || USERS[p.odUserId] !== undefined).toBe(true);
    }
  });
});

describe.each(['forming', 'complete'])('the smoke pod %s — a real player\'s League', (smokeState) => {
  it('NOT LIT (every real player, every deployment): no test pod in any card, rail row or count — the real field all there', async () => {
    seedWorld(smokeState);
    const { desktop, mobile, st } = await renderLeague();
    // The server was asked, and said no.
    expect(ctx.litAsks).toBeGreaterThan(0);

    // THE CARDS (mobile field): the two real pods, and no test pod.
    const c = cards(mobile);
    expect(c.names.sort()).toEqual([...REAL_POD_NAMES].sort());
    expect(c.count).toBe(2);
    // THE RAIL (desktop): eight seats, all real; Ada leads it.
    const r = rail(desktop);
    expect(r.players).toBe(8);
    expect(r.names).not.toContain('The Founder');
    expect(r.names).not.toContain('Player');
    expect(r.names[0]).toBe('Ada Lovelace');
    // THE COUNTS (both lobbies): five players, three CPU agents.
    for (const lobby of [desktop, mobile]) {
      expect(stat(lobby, 'players')).toBe(5);
      expect(stat(lobby, 'CPU agents')).toBe(3);
    }
    // …and nowhere else either: no test seat's name and no test pod's name in any text.
    for (const lobby of [desktop, mobile]) {
      const nodes = textNodes(lobby);
      for (const t of ['The Founder', 'Player', ...TEST_POD_NAMES]) expect(nodes, `"${t}" on a real player's screen`).not.toContain(t);
    }
    // The state every surface derives from: no test pod, no test seat.
    expect(st.baseGames.map((p) => p.id).sort()).toEqual([...REAL_IDS].sort());
    expect(Object.keys(st.field).filter((id) => [FOUNDER, ...SMOKE.seatUids, 'cpu-98', 'cpu-99', 'dev-user-1'].includes(id))).toEqual([]);
    // The field was read for THIS week; the names read follows the field, so
    // no test seat's users/ doc was even asked for.
    expect(fieldQueries().length).toBeGreaterThan(0);
    expect(fieldQueries().every((q) => q.clauses.some((cl) => cl.where?.[2] === WEEK))).toBe(true);
    expect(ctx.reads).toContain(ADA);
    for (const uid of [FOUNDER, 'dev-user-1', ...SMOKE.seatUids]) expect(ctx.reads, uid).not.toContain(uid);
  });

  it('LIT (the allowlisted founder on a preview): once the server\'s answer lands, the test pods are there — cards, rail rows, counts', async () => {
    seedWorld(smokeState);
    ctx.litAnswer = true;
    const { desktop, mobile, st } = await renderLeague();

    const c = cards(mobile);
    expect(c.names.sort()).toEqual([...REAL_POD_NAMES, ...TEST_POD_NAMES].sort());
    expect(c.count).toBe(4);
    const r = rail(desktop);
    expect(r.players).toBe(16);
    expect(r.names).toContain('The Founder');
    expect(r.names).toContain('Player');
    // After settlement the smoke pod's synthetic composite tops the rail —
    // the exact thing a real player must never see.
    expect(r.names[0]).toBe(smokeState === 'complete' ? 'Player' : 'The Founder');
    for (const lobby of [desktop, mobile]) {
      expect(stat(lobby, 'players')).toBe(11);
      expect(stat(lobby, 'CPU agents')).toBe(5);
    }
    expect(st.baseGames.map((p) => p.id).sort()).toEqual([...REAL_IDS, SEEDED, SMOKE.groupId].sort());
  });
});

describe('a non-dev pod is unaffected', () => {
  it('the real pods and their seats are identical lit and not lit — same cards, same seats, same scores', async () => {
    seedWorld('complete');
    const dark = await renderLeague();
    const darkReal = dark.st.baseGames.filter((p) => REAL_IDS.includes(p.id));
    const darkSeats = Object.fromEntries(Object.entries(dark.st.field));
    const darkText = textNodes(dark.desktop);
    for (const { root, container } of mounted) { await act(async () => root.unmount()); container.remove(); }
    mounted = [];

    seedWorld('complete');
    ctx.litAnswer = true;
    const lit = await renderLeague();
    expect(lit.st.baseGames.filter((p) => REAL_IDS.includes(p.id))).toEqual(darkReal);
    for (const [id, seat] of Object.entries(darkSeats)) expect(lit.st.field[id], id).toEqual(seat);
    const litText = textNodes(lit.desktop);
    for (const name of REAL_NAMES) {
      expect(darkText, name).toContain(name);
      expect(litText, name).toContain(name);
    }
  });

  it('a test pod never takes a real pod\'s slot: twelve real pods under ten NEWER test pods — all twelve show, not lit', async () => {
    seedWorld('complete');
    const reals = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`lg-real-${i}`,
      fieldPod({ seats: [[ADA, i], ['cpu-1', 0], ['cpu-2', 0], ['cpu-3', 0]], updatedAt: `2026-09-23T08:${String(i).padStart(2, '0')}:00.000Z` })]));
    const tests = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`lg-test-${i}`,
      fieldPod({ seats: [[FOUNDER, 50], ['dev-user-1', 0], ['dev-user-2', 0], ['dev-user-3', 0]], updatedAt: `2026-09-23T22:${String(i).padStart(2, '0')}:00.000Z`, extra: { isDev: true } })]));
    ctx.groups = { ...reals, ...tests };
    const { st } = await renderLeague();
    expect(st.baseGames.map((p) => p.id).sort()).toEqual(Object.keys(reals).sort());
  });
});

describe('the lit answer arrives AFTER the first render (the provider\'s one ask)', () => {
  it('the field re-reads when the answer lands: dark first, then the test pods — the read is told, never the surfaces', async () => {
    seedWorld('complete');
    ctx.litAnswer = true;
    let release;
    const { fetchBackingLit } = await import('../../services/backingService');
    fetchBackingLit.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ lit: true }); }));
    await mount(<BackingLitProvider><Probe /></BackingLitProvider>);
    // Before the answer: the dark field.
    expect(probe.st.baseGames.map((p) => p.id).sort()).toEqual([...REAL_IDS].sort());
    const readsBefore = fieldQueries().length;
    await act(async () => { release(); });
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    // After: one more read of the field, and the test pods in it.
    expect(fieldQueries().length).toBe(readsBefore + 1);
    expect(probe.st.baseGames.map((p) => p.id).sort()).toEqual([...REAL_IDS, SEEDED, SMOKE.groupId].sort());
  });
});

describe('THE FLIP TRIPWIRE — the not-lit row under the SHIPPED backing flag', () => {
  it('a real player (the server answers no) sees no test pod — under the flag value the module ships', async () => {
    // Every other row holds BACKING_BETA_ENABLED false. This one runs under the
    // shipped value: useBackingLit() is the flag OR the server's answer, so the
    // flip lights EVERY viewer and this row reds until the flip PR re-keys
    // useRealLeagueState's `includeDev` (the smoke override — the only reason
    // a viewer should see a test pod — is deleted in that same commit).
    expect(typeof ctx.flags.shipped, 'the shipped value was read (else this row is vacuous)').toBe('boolean');
    ctx.flags.backing = ctx.flags.shipped;
    seedWorld('complete');
    const { desktop, mobile, st } = await renderLeague();
    const hint = `BACKING_BETA_ENABLED is ${ctx.flags.shipped}: useBackingLit() lights every viewer once the flag flips — re-key useRealLeagueState's includeDev in the flip commit`;
    expect(st.baseGames.map((p) => p.id).sort(), hint).toEqual([...REAL_IDS].sort());
    for (const lobby of [desktop, mobile]) {
      expect(textNodes(lobby), hint).not.toContain('The Founder');
      expect(stat(lobby, 'players'), hint).toBe(5);
    }
  });
});
