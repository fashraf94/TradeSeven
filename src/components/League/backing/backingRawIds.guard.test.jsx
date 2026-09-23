// @vitest-environment jsdom
// src/components/League/backing/backingRawIds.guard.test.jsx
//
// THE RAW-ID GUARD — Amendment C §C1 (D-af): "Never a raw account id, anywhere,
// in any state. … A guard test enforces it." This is that test.
//
// ONE WORLD, EVERY DOOR, EVERY SURFACE. A single in-memory world holds pods
// whose seats carry PRODUCTION-SHAPED ids (28-character Firebase uids), the
// `od-`/`cpu-` seat ids the fixtures use, and — the case that printed a raw uid
// on the PR 5 results card (HON-17) — seats with NO name on file anywhere: no
// agent, no profile, no `seatNames`, and a settled team whose recorded agent is
// gone. Then:
//   · ROW 1 calls EVERY backing endpoint against that world — the pod list, the
//     stake (the confirmation), the team card for every seat, the results
//     reader (the list and one pod), the team-labels reader (Your Backing's
//     names), the two private stats readers, the telemetry sink — and walks
//     every string in every response that is not an id BY CONTRACT (a field
//     named for an id — `odUserId`, `groupId`, `winners` … — is data the client
//     keys on, never text it shows). Any id-shaped string anywhere else fails.
//   · ROW 2 renders EVERY backing surface FROM THOSE SAME RESPONSES — the pod
//     list, each team card, the stake control's Confirm step and its "Backed"
//     line, Your Backing, the strip (window and week states), every results
//     card, the two stats surfaces — and walks the VISIBLE text (text nodes,
//     and the aria-label / title / placeholder / alt a reader is shown). Any
//     id-shaped string fails.
// The dev preview page's every state is walked the same way in its own suite
// (src/screens/BackingPreviewScreen.test.jsx), which owns that page's mocks.
//
// MUTATION CHECK (the prompt's): put a uid back in the winner line — the
// results projection's `winnerLabels` answering `winners`, or the card
// rendering `pod.winners` — and a row here reds.
//
// The api/ handlers are imported for real (their dependency surfaces
// included); only the request plumbing, the flag, and the Firestore handle are
// stood in for, as each route's own suite does.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const ctx = vi.hoisted(() => ({ uid: null, db: null, store: null }));

vi.mock('../../../../api/_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../../../../api/_utils/authMiddleware.js', () => ({
  requireAuth: async () => ({ uid: ctx.uid, firebase: { sign_in_provider: 'password' } }),
}));
vi.mock('../../../../api/_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ctx.db }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  BACKING_BETA_ENABLED: true,
  TOURNAMENT_ADVANCEMENT_FROZEN: false,
}));
// The client seams the surfaces reach the network through — answered locally.
vi.mock('../../../services/backingService', () => ({
  placeStake: vi.fn(), attestEligibility: vi.fn(), savePitch: vi.fn(), newRequestId: () => 'guard-req',
  BackingApiError: class BackingApiError extends Error {},
}));
vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: {}, loading: false, error: null }) }));

const { makeInMemoryDb } = await import('../../../../api/_utils/__fixtures__/inMemoryFirestore.js');
const { TERMS_VERSION } = await import('../../../constants/eligibility');
const { default: podsHandler } = await import('../../../../api/tournament/backing-pools.js');
const { default: stakeHandler } = await import('../../../../api/tournament/backing-stake.js');
const { default: cardHandler } = await import('../../../../api/tournament/team-card.js');
const { default: resultsHandler } = await import('../../../../api/backing/results.js');
const { default: labelsHandler } = await import('../../../../api/backing/team-labels.js');
const { default: myStatsHandler } = await import('../../../../api/backing/my-stats.js');
const { default: trainerStatsHandler } = await import('../../../../api/backing/trainer-stats.js');
const { default: eventHandler } = await import('../../../../api/backing/event.js');
const { default: PodList } = await import('./PodList');
const { default: TeamCard } = await import('./TeamCard');
const { default: StakeControl } = await import('./StakeControl');
const { default: YourBacking } = await import('./YourBacking');
const { default: BackingStrip } = await import('./BackingStrip');
const { default: BackingResultsCard } = await import('./BackingResultsCard');
const { default: MyBackingStats } = await import('./MyBackingStats');
const { default: TrainerStats } = await import('./TrainerStats');
const { deriveStripState } = await import('./backingStripState');

// ==================== THE ID SHAPES ====================

/**
 * What an account id looks like on a screen — this guard's OWN patterns, kept
 * apart from the resolver's `looksLikeAccountId` on purpose, so a defect in one
 * cannot blind the other. (The preview page's suite walks its states with the
 * same three shapes, restated there: a test file is never imported by another.)
 */
const RAW_ID_PATTERNS = Object.freeze([
  /(?<![A-Za-z0-9])[A-Za-z0-9]{28}(?![A-Za-z0-9])/,   // a Firebase Auth uid: exactly 28 alphanumerics
  /(?<![\w-])od-[A-Za-z0-9][\w-]*/,                     // an `od-` seat id (the fixtures' shape)
  /(?<![\w-])cpu-\d+(?![\w-])/,                         // a CPU seat id, `cpu-{n}`
]);
const idShaped = (text) => RAW_ID_PATTERNS.some((re) => re.test(text));

/**
 * EVERY ID THE WORLD KNOWS, whatever its shape (this build's review record,
 * RAWID-3): every document-id segment of every path in the store AFTER every
 * door has run — pods, pools, stakes (the stake route's own `stk_…` ids
 * included), wallets, ledger entries, events, agents, profiles. The shape
 * patterns above catch an ACCOUNT id; membership catches ANY id — a pod's
 * group id, a stake id, an agent id — reaching a screen or a display field.
 * Only distinctive ids (6+ characters) are walked, and the store's fixed
 * sub-document names are not ids.
 */
const FIXED_DOC_NAMES = new Set(['totals', 'meta']);
function worldIds(store) {
  const ids = new Set();
  for (const path of store.keys()) {
    path.split('/').forEach((segment, i) => {
      if (i % 2 === 1 && segment.length >= 6 && !FIXED_DOC_NAMES.has(segment)) ids.add(segment);
    });
  }
  return [...ids];
}
const knownIdIn = (text, ids) => ids.find((id) => text.includes(id)) ?? null;

/**
 * The fields that ARE ids by contract — data the client keys on and never
 * shows. Everything else in a response is walked. Named, not inferred: a new
 * DISPLAY field is walked the day it appears; a new ID field is a deliberate
 * edit here.
 */
const ID_FIELDS = new Set([
  'odUserId', 'teamOdUserId', 'groupId', 'poolId', 'stakeId', 'id', 'userId', 'viewerUid',
  'requestId', 'focusId', 'winners', 'winnerOdUserIds', 'entryId', 'hashAtStake',
]);

/** Every non-id string in a JSON value, with its path. */
function displayStrings(value, path = '$', out = []) {
  if (typeof value === 'string') { out.push([path, value]); return out; }
  if (Array.isArray(value)) { value.forEach((v, i) => displayStrings(v, `${path}[${i}]`, out)); return out; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (ID_FIELDS.has(k)) continue;
      displayStrings(v, `${path}.${k}`, out);
    }
  }
  return out;
}

/**
 * What a reader is shown: the text, NODE BY NODE and separated (`textContent`
 * glues adjacent nodes — "6" + "book" + "NVDA" — into runs no reader ever
 * sees), and the attributes a screen reader or a hover speaks.
 */
function visibleText(container) {
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim()) nodes.push(n.nodeValue);
  const parts = [nodes.join(' \u2016 ')];
  for (const el of container.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(attr);
      if (v) parts.push(v);
    }
  }
  return parts.join(' ‖ ');
}

// ==================== THE WORLD ====================

const uid28 = (head) => `${head}${'0'.repeat(27 - head.length)}Z`;
const VIEWER = uid28('Viewer');
const NAMED = uid28('AdaLovelace');     // an agent and a profile on file
const BARE = uid28('CyHarrison');       // NOTHING on file — the HON-17 seat
const NOW = new Date('2026-09-22T14:00:00.000Z');   // Tue of the backing week W40
const W40_MONDAY = '2026-09-28';
const P1 = 'grd-p1';   // the upcoming pod (forming, window open)
const P2 = 'grd-p2';   // in play (battle, pool closed)
const P0 = 'grd-p0';   // settled last week — its winner has no name anywhere

function world() {
  const lobby = { isLiveDraft: false, createdAt: '2026-09-22T13:00:00.000Z', updatedAt: '2026-09-22T13:00:00.000Z' };
  return {
    // P1 — a LOBBY pod: no seatNames, two human seats and a CPU.
    [`tournamentGroups/${P1}`]: { ...lobby, status: 'forming', baseLayerWeek: '2026-W40', players: [{ odUserId: NAMED }, { odUserId: BARE }, { odUserId: 'cpu-1', isCpu: true }] },
    [`backingPools/${P1}`]: {
      groupId: P1, status: 'open', formationPath: 'lobby', slotId: null, battleMondayEtDate: W40_MONDAY,
      backingWeekStart: '2026-09-21T04:00:00.000Z', opensAt: '2026-09-22T13:00:00.000Z', closesAt: '2026-09-28T03:59:59.000Z',
      closeReason: 'clock', baseLayerWeek: '2026-W40', isDev: false,
      backerProgress: { count: 0, floor: 3, met: false }, teamSpread: { met: false },
      createdAt: '2026-09-22T13:00:00.000Z', updatedAt: '2026-09-22T13:00:00.000Z',
    },
    // P2 — in play: a seat with an `od-` id and no names, the named seat, a CPU.
    [`tournamentGroups/${P2}`]: { ...lobby, status: 'battle', baseLayerWeek: '2026-W39', players: [{ odUserId: NAMED }, { odUserId: 'od-x' }, { odUserId: 'cpu-3', isCpu: true }] },
    [`backingPools/${P2}`]: {
      groupId: P2, status: 'closed', formationPath: 'lobby', battleMondayEtDate: '2026-09-21', closesAt: '2026-09-21T03:59:59.000Z', baseLayerWeek: '2026-W39', isDev: false,
      teams: [{ odUserId: NAMED, isCpu: false, stakeTotal: 0, backerCount: 0 }, { odUserId: 'od-x', isCpu: false, stakeTotal: 150, backerCount: 1 }, { odUserId: 'cpu-3', isCpu: true, stakeTotal: 0, backerCount: 0 }],
      humanTeams: 2, potTotal: 150, uniqueBackers: 1, teamsBacked: 1, closedAt: '2026-09-21T04:00:00.000Z',
    },
    'backingStakes/g-p2-v': { userId: VIEWER, groupId: P2, teamOdUserId: 'od-x', amount: 150, weekKey: '2026-W39', status: 'live', placedAt: '2026-09-18T14:00:00.000Z' },
    // P0 — settled: the WINNER is BARE, whose recorded agent is gone and who has no name anywhere.
    [`tournamentGroups/${P0}`]: { ...lobby, status: 'complete', baseLayerWeek: '2026-W39', players: [{ odUserId: NAMED }, { odUserId: BARE }, { odUserId: 'cpu-2', isCpu: true }] },
    [`backingPools/${P0}`]: {
      groupId: P0, status: 'resolved', formationPath: 'lobby', battleMondayEtDate: '2026-09-21', closesAt: '2026-09-21T03:59:59.000Z', baseLayerWeek: '2026-W39', isDev: false,
      teams: [
        { odUserId: NAMED, isCpu: false, stakeTotal: 100, backerCount: 1, paysX: 4, agentId: 'agt-played', hashAtSettlement: null },
        { odUserId: BARE, isCpu: false, stakeTotal: 300, backerCount: 2, paysX: 1.33, agentId: 'agt-gone', hashAtSettlement: null },
        { odUserId: 'cpu-2', isCpu: true, stakeTotal: 0, backerCount: 0, paysX: null, agentId: 'cpu-agent-2', hashAtSettlement: null },
      ],
      humanTeams: 2, potTotal: 400, uniqueBackers: 3, teamsBacked: 2, closedAt: '2026-09-21T04:00:00.000Z',
      winnerOdUserIds: [BARE], winningStakes: 300, paysX: 1.33, settledAt: '2026-09-25T22:30:00.000Z', monthKey: '2026-09',
    },
    'backingStakes/g-p0-v': { userId: VIEWER, groupId: P0, teamOdUserId: BARE, amount: 200, weekKey: '2026-W39', status: 'won', payout: 266, placedAt: '2026-09-18T14:00:00.000Z' },
    // Names on file — for NAMED only (and the agent P0 recorded for NAMED).
    'agents/agt-ada': { ownerId: NAMED, name: 'Shadow' },
    'agents/agt-played': { ownerId: 'someone-else', name: 'Played The Week' },
    // The production shape — names NESTED under `profile` (src/firebase/authService.js;
    // this build's review record, RAWID-1: the guard's world used to seed a
    // top-level shape production never writes).
    [`users/${NAMED}`]: { _v: 1, auth: { uid: NAMED, email: 'ada@example.com' }, profile: { username: 'ada', displayName: 'ada', avatarUrl: null, bio: null } },
    // The viewer may stake: attested, one completed battle, not seated in P1.
    [`eligibility/${VIEWER}`]: { adultAttestedAt: '2026-09-14T13:30:00.000Z', termsVersion: TERMS_VERSION, acceptedAt: '2026-09-14T13:30:00.000Z', source: 'backing_beta' },
    'agentBattles/viewer-done': { ownerId: VIEWER, status: 'completed', completedAt: '2026-09-01T20:00:00.000Z' },
  };
}

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
async function call(handler, { method = 'GET', query = {}, body } = {}) {
  const res = mkRes();
  await handler({ method, headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'guard' }, query, body }, res);
  return res;
}

// Every endpoint, once, in the order a viewer would meet them.
const R = {};
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  process.env.BACKING_FINGERPRINT_SALT = 'guard-salt';
  ctx.uid = VIEWER;
  const made = makeInMemoryDb(world());
  ctx.db = made.db;
  ctx.store = made.store;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  R.stake = await call(stakeHandler, { method: 'POST', body: { groupId: P1, teamOdUserId: BARE, amount: 100, requestId: 'guard-1' } });
  R.pods = await call(podsHandler);
  R.cards = {};
  for (const seat of [NAMED, BARE, 'cpu-1']) R.cards[seat] = await call(cardHandler, { query: { groupId: P1, odUserId: seat } });
  R.resultsList = await call(resultsHandler);
  R.resultsOne = await call(resultsHandler, { query: { groupId: P0 } });
  R.labels = await call(labelsHandler, { query: { groupIds: [P0, P1, P2].join(',') } });
  R.myStats = await call(myStatsHandler);
  R.trainerStats = await call(trainerStatsHandler);
  R.event = await call(eventHandler, { method: 'POST', body: { event: 'window_viewed', props: { weekKey: '2026-W40' } } });
});
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.BACKING_FINGERPRINT_SALT;
});

const RESPONSES = () => [
  ['POST /api/tournament/backing-stake (the confirmation)', R.stake],
  ['GET /api/tournament/backing-pools', R.pods],
  ...Object.entries(R.cards).map(([seat, res]) => [`GET /api/tournament/team-card (${seat.startsWith('cpu-') ? seat : 'a human seat'})`, res]),
  ['GET /api/backing/results (weeks)', R.resultsList],
  ['GET /api/backing/results (one pod)', R.resultsOne],
  ['GET /api/backing/team-labels (Your Backing)', R.labels],
  ['GET /api/backing/my-stats', R.myStats],
  ['GET /api/backing/trainer-stats', R.trainerStats],
  ['POST /api/backing/event', R.event],
];

// ============================================================================
describe('the guard\'s own patterns are not vacuous', () => {
  it('a Firebase uid, an `od-` id and a `cpu-` id are caught; a name, a CPU\'s agent name and "Unnamed team" are not', () => {
    for (const id of [BARE, NAMED, VIEWER, 'od-x', 'od-a', 'cpu-3', 'Winner: CyHarrison00000000000000000Z']) expect(idShaped(id), id).toBe(true);
    for (const ok of ['Shadow', 'ada', 'CPU — Diversifier', 'Unnamed team', 'Winner: Unnamed team', 'Good-looking', '2026-09-28T03:59:59.000Z', 'lobby-w40-a', 'Played The Week']) {
      expect(idShaped(ok), ok).toBe(false);
    }
  });

  it('RAWID-3: the membership walk is not vacuous — a pod\'s group id, a stake id the route minted and an agent id are each caught; names are not', () => {
    const ids = worldIds(ctx.store);
    const stakeId = ids.find((id) => id.startsWith('stk_'));
    expect(stakeId, 'the stake route minted a stake document').toBeTruthy();
    for (const planted of [`Pod ${P1}`, `stake ${stakeId}`, 'agent agt-played', `Your backing ${P0}`]) expect(knownIdIn(planted, ids), planted).not.toBeNull();
    for (const ok of ['Shadow', 'Unnamed team', 'CPU — Diversifier', 'Winner: Unnamed team', 'Backed · 100 BP on Unnamed team', 'ada']) expect(knownIdIn(ok, ids), ok).toBeNull();
  });

  it('the world really is the HON-17 shape: every endpoint answered, and the settled winner has no name on file', () => {
    for (const [name, res] of RESPONSES()) expect(res.statusCode, name).toBe(200);
    expect(R.resultsOne.body.pod.winners).toEqual([BARE]);
    expect(R.resultsOne.body.pod.winnerLabels).toEqual(['Unnamed team']);
  });
});

describe('ROW 1 — every backing endpoint\'s response carries NO raw id outside an id field (D-af)', () => {
  it('walks every string of every response', () => {
    const ids = worldIds(ctx.store);
    const offenders = [];
    for (const [name, res] of RESPONSES()) {
      for (const [path, text] of displayStrings(res.body)) {
        const known = knownIdIn(text, ids);
        if (idShaped(text) || known) offenders.push(`${name} ${path} = ${JSON.stringify(text)}${known ? ` (the world's id ${known})` : ''}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('ROW 2 — every backing surface, rendered from those responses, shows NO raw id (D-af)', () => {
  let mounted = [];
  async function render(element) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(element); });
    mounted.push({ root, container });
    return container;
  }
  afterAll(async () => {
    for (const { root, container } of mounted) { await act(async () => root.unmount()); container.remove(); }
    mounted = [];
  });

  it('walks the visible text of every surface', async () => {
    const pods = R.pods.body.pods;
    const p1 = pods.find((p) => p.groupId === P1);
    const store = ctx.db;
    const readDoc = async (path) => { const s = await store.collection(path.split('/')[0]).doc(path.split('/')[1]).get(); return s.exists ? s.data() : null; };
    const inPlay = {
      stakes: [
        { id: 'g-p2-v', ...(await readDoc('backingStakes/g-p2-v')) },
        { id: 'g-p0-v', ...(await readDoc('backingStakes/g-p0-v')) },
      ],
      poolsById: { [P0]: await readDoc(`backingPools/${P0}`), [P2]: await readDoc(`backingPools/${P2}`) },
      groupsById: { [P0]: await readDoc(`tournamentGroups/${P0}`), [P2]: await readDoc(`tournamentGroups/${P2}`) },
      labelsById: R.labels.body.pods,
    };

    const surfaces = [];
    surfaces.push(['PodList', await render(<PodList pods={pods} onOpenSeat={() => {}} />)]);
    for (const [seat, res] of Object.entries(R.cards)) {
      surfaces.push([`TeamCard ${seat.startsWith('cpu-') ? seat : 'human'}`, await render(<TeamCard card={res.body} pod={p1} onBack={() => {}} />)]);
    }
    const services = { placeStake: async () => R.stake.body, newRequestId: () => 'guard-req-2', attestEligibility: async () => ({}) };
    const stakeProps = { card: R.cards[BARE].body, pod: p1, wallet: { known: true, left: 900, total: 1000 }, eligibility: { status: 'attested', refresh: () => {} }, services, onBacked: () => {}, onClose: () => {} };
    const confirmStep = await render(<StakeControl {...stakeProps} />);
    surfaces.push(['StakeControl (Confirm)', confirmStep]);
    const backedStep = await render(<StakeControl {...stakeProps} />);
    await act(async () => { backedStep.querySelector('[data-backing="confirm"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); });
    expect(backedStep.querySelector('[data-backing="backed"]')).not.toBeNull();
    surfaces.push(['StakeControl (Backed)', backedStep]);
    surfaces.push(['YourBacking', await render(<YourBacking inPlay={inPlay} now={NOW} battlesByGroup={{}} onOpenTape={() => {}} />)]);
    surfaces.push(['BackingStrip (week)', await render(<BackingStrip state={deriveStripState({ pods, inPlay, now: NOW })} />)]);
    surfaces.push(['BackingStrip (window)', await render(<BackingStrip state={deriveStripState({ pods, inPlay: null, now: NOW })} />)]);
    for (const week of R.resultsList.body.weeks) {
      for (const pod of week.pools) surfaces.push([`BackingResultsCard ${pod.groupId}`, await render(<BackingResultsCard pod={pod} onOpenTape={() => {}} />)]);
    }
    surfaces.push(['BackingResultsCard (one pod)', await render(<BackingResultsCard pod={R.resultsOne.body.pod} />)]);
    surfaces.push(['MyBackingStats', await render(<MyBackingStats stats={R.myStats.body} />)]);
    surfaces.push(['TrainerStats', await render(<TrainerStats stats={R.trainerStats.body} />)]);

    // THE SCAN FIRST, so a raw id planted on any surface is reported BY the
    // scan (surface, match and context) — not by a name check below that
    // happens to run earlier.
    const ids = worldIds(ctx.store);
    const offenders = [];
    for (const [name, container] of surfaces) {
      const text = visibleText(container);
      for (const re of RAW_ID_PATTERNS) {
        const m = text.match(re);
        if (m) offenders.push(`${name}: ${JSON.stringify(m[0])} in …${text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)}…`);
      }
      const known = knownIdIn(text, ids);
      if (known) offenders.push(`${name}: the world's id ${JSON.stringify(known)} in …${text.slice(Math.max(0, text.indexOf(known) - 30), text.indexOf(known) + known.length + 30)}…`);
    }
    expect(offenders).toEqual([]);

    // Not vacuous: the surfaces rendered, and they rendered the names.
    expect(surfaces.length).toBeGreaterThan(10);
    const all = surfaces.map(([, c]) => visibleText(c)).join(' ');
    expect(all).toContain('Winner: Unnamed team');
    expect(all).toContain('Shadow');
    expect(all).toContain('Backed · 100 BP on Unnamed team');
    // The player's name from the NESTED profile (RAWID-1) reaches the card:
    // the human-and-agent unit names both halves.
    expect(all).toContain('Back ada & Shadow');
  });
});
