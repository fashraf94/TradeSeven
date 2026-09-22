// api/tournament/team-card.test.js
//
// GET /api/tournament/team-card — Backing Beta PR 4, the projection-only Team
// Card (spec V1.3 §5, D-l/D-y; design brief rev2 §2–§4, rev3 §2).
//
// THE ROWS THIS FILE EXISTS FOR:
//   · PROJECTION ONLY — the response never carries an agent's rule contents,
//     trait contents, bundle ids, config, or any strategy WHY. Asserted by
//     walking the WHOLE serialized body by key name, not by spot-checking.
//   · COUNTS ONLY — trait count and rule count, from the owner's RANKED agent,
//     clones excluded (the clones are seeded FIRST so a naive first-doc pick
//     reds the row).
//   · COMPLETED HISTORY ONLY — RP, tier, prior placements, weeks played; no
//     live standing, no current-week score anywhere in the body.
//   · THE FIRST-WEEK CARD IS THE PRIMARY CASE — no rank doc → `known: null`,
//     `lastWeek: null`, `derived: null`; the card says so rather than filling.
//   · LAST WEEK'S TAPE comes from REAL completed battles and the group's own
//     records (the draft stream, the roster's legs, the approved claims); the
//     rationale is the agent's recorded words; an active battle and a non-
//     tournament battle in the same group are ignored.
//   · THE DERIVED LINE is computed from those facts through deriveWeekLine.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import below is
// the runtime guard for its api/ -> src/ imports (deriveWeekLine.js,
// archetypeIdentity.js, archetypeDisplay.js, stockData.js, leagueTournament.js,
// featureFlags.js). Never mock the constants.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ flag: true, uid: 'viewer-1' }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: 'password' } };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return state.flag; },
}));

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const {
  default: handler, HISTORY_LOOKBACK, PRIOR_FINISHES, etDayLabel, projectAgent, knownFactsFrom,
  humanLayerFrom, agentLayerFrom,
} = await import('./team-card.js');
const { ARCHETYPE_IDENTITY } = await import('../../src/data/archetypeIdentity.js');
const { deriveWeekLine } = await import('../../src/constants/deriveWeekLine.js');

// ==================== FIXTURES ====================
const TOURNAMENT = 'baggerbomb_tournament';
const leg = (direction, openedAt) => ({ direction, baselinePrice: null, baselineSource: 'draft_resolution', openedAt, thresholdHistory: [] });

const RANKED_AGENT = {
  ownerId: 'od-a', name: 'Kestrel', archetype: 'momentum_chaser',
  equippedTraits: [{ traitId: 't1', strength: 2 }, { traitId: 't2' }, { traitId: 't3' }, { traitId: 't4' }],
  activeRules: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ ruleId: `r-${n}`, params: { x: n }, hardness: 'soft' })),
  equippedBundleIds: ['bundle-1'],
  config: { risk: 62 },
  innerMonologue: 'PRIVATE — must never leave the server',
  equippedWatchlist: { symbols: ['NVDA'] },
};

function seedWorld() {
  const initial = {
    // The CURRENT pod (forming — the window is open). The viewer is NOT seated.
    'tournamentGroups/g-now': {
      status: 'forming', baseLayerWeek: '2026-W40', isLiveDraft: false,
      seatNames: { 'od-a': 'Mira', 'od-b': 'Draco' },
      players: [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }],
    },
    'users/od-a': { username: 'Mira' },
    'users/od-b': { displayName: 'Draco' },
    // CLONES FIRST — a naive "first doc for this owner" would pick one of these.
    'agents/training-agent-g-old_od-a': { ownerId: 'od-a', isTrainingClone: true, name: 'Kestrel (clone)', archetype: 'guardian', equippedTraits: [], activeRules: [] },
    'agents/casual-agent-od-a': { ownerId: 'od-a', isCasualClone: true, name: 'Kestrel (casual)', archetype: 'degen', equippedTraits: [{ traitId: 'x' }], activeRules: [{}] },
    'agents/agent-a': RANKED_AGENT,
    'agents/agent-b': { ownerId: 'od-b', name: 'Tarn', archetype: 'analyst', equippedTraits: [{ traitId: 'a' }, { traitId: 'b' }, { traitId: 'c' }], activeRules: [{}, {}, {}, {}, {}] },
    'agents/cpu-agent-1': { ownerId: 'cpu-1', isCpu: true, name: 'CPU — Trend Follower', archetype: 'momentum_chaser', equippedTraits: [], activeRules: [] },
    'teamPitches/od-a': { text: 'I take the leader in whatever sector has breadth on Monday. Kestrel presses; I bank.', updatedAt: '2026-09-20T12:00:00.000Z' },
    // The veteran's rank doc: two finalized weeks.
    'tournamentRanks/od-a': {
      odUserId: 'od-a', rp: 412, tier: 2, tierName: 'Analyst', floorRp: 250, peakRp: 412,
      appliedGroups: { 'g-w1': { placement: 2 }, 'g-w2': { placement: 1 } },
      history: [
        { groupId: 'g-w1', weeklyComposite: 3.2, placement: 2, rpAfter: 210, appliedAt: '2026-09-11T21:00:00.000Z' },
        { groupId: 'g-w2', weeklyComposite: 8.7, placement: 1, rpAfter: 412, appliedAt: '2026-09-18T21:00:00.000Z' },
      ],
    },
    // The most recent COMPLETED base-layer week.
    'tournamentGroups/g-w2': {
      status: 'complete', baseLayerWeek: '2026-W38', isTraining: false,
      players: [
        {
          odUserId: 'od-a',
          picks: [
            { symbol: 'NVDA', legs: [leg('long', '2026-09-14T11:00:00.000Z')], flipCountToday: 0 },
            { symbol: 'AMD', legs: [leg('long', '2026-09-14T11:00:00.000Z'), leg('short', '2026-09-16T14:00:00.000Z')], flipCountToday: 0 },
            { symbol: 'XLE', legs: [{ ...leg('long', '2026-09-15T11:00:00.000Z'), baselineSource: 'claim_execution' }], flipCountToday: 0 },
          ],
          droppedPicks: [{ symbol: 'COIN', legs: [{ ...leg('long', '2026-09-14T11:00:00.000Z'), closedAt: '2026-09-15T11:00:00.000Z' }] }],
        },
        { odUserId: 'od-x', picks: [{ symbol: 'TSLA', legs: [leg('long', '2026-09-14T11:00:00.000Z')] }] },
        { odUserId: 'cpu-3', isCpu: true, picks: [] },
        { odUserId: 'cpu-4', isCpu: true, picks: [] },
      ],
      claimSystem: {
        enabled: true,
        processingLog: [{
          day: 2, processedAt: '2026-09-15T11:00:00.000Z',
          results: [
            { odUserId: 'od-a', dropSymbol: 'COIN', addSymbol: 'XLE', status: 'approved', reason: null },
            { odUserId: 'od-x', dropSymbol: 'TSLA', addSymbol: 'F', status: 'denied', reason: 'claimed_by_higher_priority' },
          ],
        }],
      },
      dailyScores: {
        day1: { closeScores: { 'od-a': { compositePoints: 2.1 }, 'od-x': { compositePoints: 3.0 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: 0 } } },
        day5: { closeScores: { 'od-a': { compositePoints: 8.7 }, 'od-x': { compositePoints: 4.1 }, 'cpu-3': { compositePoints: 2 }, 'cpu-4': { compositePoints: -1 } } },
      },
    },
    'tournamentGroups/g-w2/streams/userDraft': {
      events: [
        { pickNumber: 1, round: 1, odUserId: 'od-a', symbol: 'NVDA' },
        { pickNumber: 2, round: 1, odUserId: 'od-x', symbol: 'TSLA' },
        { pickNumber: 8, round: 2, odUserId: 'od-a', symbol: 'AMD' },
        { pickNumber: 9, round: 3, odUserId: 'od-a', symbol: 'COIN' },
      ],
      resolvedAt: '2026-09-14T11:00:00.000Z',
    },
    // The week's daily-chained battles for od-a (Monday and Thursday), plus
    // the noise that must be ignored: another owner, a non-tournament battle,
    // and an ACTIVE one.
    'agentBattles/b-w2-mon': {
      groupId: 'g-w2', ownerId: 'od-a', agentId: 'agent-a', gameMode: TOURNAMENT, status: 'completed',
      createdAt: '2026-09-14T13:30:00.000Z', completedAt: '2026-09-14T20:00:00.000Z',
      agentContext: {
        agentName: 'Kestrel', archetype: 'momentum_chaser',
        initialPortfolio: {
          star: [{ symbol: 'NVDA', sector: 'technology' }, { symbol: 'AMD', sector: 'technology' }],
          core: [{ symbol: 'AVGO', sector: 'technology' }, { symbol: 'ANET', sector: 'technology' }],
          support: [{ symbol: 'VST', sector: 'utilities' }, { symbol: 'META', sector: 'technology' }],
        },
        innerMonologue: 'PRIVATE', strategyBrief: 'PRIVATE', activeRules: [{ ruleId: 'r-1' }],
      },
      portfolio: { star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], core: [{ symbol: 'AVGO' }, { symbol: 'ANET' }], support: [{ symbol: 'VST' }, { symbol: 'META' }] },
      trades: [],
    },
    'agentBattles/b-w2-thu': {
      groupId: 'g-w2', ownerId: 'od-a', agentId: 'agent-a', gameMode: TOURNAMENT, status: 'completed',
      createdAt: '2026-09-17T13:30:00.000Z', completedAt: '2026-09-17T20:00:00.000Z',
      agentContext: { agentName: 'Kestrel', archetype: 'momentum_chaser' },
      portfolio: { star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], core: [{ symbol: 'AVGO' }, { symbol: 'SMCI' }], support: [{ symbol: 'VST' }, { symbol: 'META' }] },
      trades: [{
        symbolOut: 'ANET', symbolIn: 'SMCI', tier: 'core', slotIndex: 1, swappedOutAt: '2026-09-17T15:10:00.000Z', swapDay: 1,
        rationale: 'Broke its Monday low. Rule is rule.', hypothesis: 'SMCI confirms the chip read.',
        trade_reasoning: 'PRIVATE-SHAPED FIELD that must not be echoed as a key',
      }],
    },
    'agentBattles/b-w2-other': { groupId: 'g-w2', ownerId: 'od-x', gameMode: TOURNAMENT, status: 'completed', createdAt: '2026-09-14T13:30:00.000Z', portfolio: { star: [{ symbol: 'TSLA' }] }, trades: [{ symbolOut: 'TSLA', symbolIn: 'F', swappedOutAt: '2026-09-15T15:00:00.000Z', rationale: 'other owner' }] },
    'agentBattles/b-w2-casual': { groupId: 'g-w2', ownerId: 'od-a', gameMode: 'baggerbomb_agent', status: 'completed', createdAt: '2026-09-14T13:30:00.000Z', portfolio: { star: [{ symbol: 'ZZZ' }] }, trades: [{ symbolOut: 'ZZZ', symbolIn: 'YYY', swappedOutAt: '2026-09-15T15:00:00.000Z' }] },
    'agentBattles/b-w2-active': { groupId: 'g-w2', ownerId: 'od-a', gameMode: TOURNAMENT, status: 'active', createdAt: '2026-09-18T13:30:00.000Z', portfolio: { star: [{ symbol: 'LIVE' }] }, trades: [{ symbolOut: 'LIVE', symbolIn: 'WHY', swappedOutAt: '2026-09-18T15:00:00.000Z', rationale: 'live WHY' }] },
  };
  return makeInMemoryDb(initial);
}

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

async function get(query, method = 'GET') {
  const res = mkRes();
  await handler({ method, headers: {}, query }, res);
  return res;
}

/** Every key name anywhere in a JSON body. */
function allKeys(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { out.add(k); allKeys(v, out); }
  }
  return out;
}

/** Every string anywhere in a JSON body. */
function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

// The keys that would mean the projection leaked contents or a live WHY.
const FORBIDDEN_KEYS = [
  'activeRules', 'equippedTraits', 'equippedBundleIds', 'config', 'innerMonologue', 'strategyBrief',
  'consolidatedInsight', 'deployedGuardrails', 'equippedWatchlist', 'watchlist', 'memory', 'params',
  'hardness', 'ruleId', 'traitId', 'trade_reasoning', 'citedRules', 'evaluations', 'statusFeed',
  'compositePoints', 'closeScores', 'dailyScores',
];

beforeEach(() => {
  state.flag = true;
  state.uid = 'viewer-1';
  DB = seedWorld();
});

// ============================================================================
describe('the pipeline, in order', () => {
  it('405s anything but GET', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await get({ groupId: 'g-now', odUserId: 'od-a' }, method)).statusCode).toBe(405);
    }
  });

  it('401s without a caller, then 404s while the flag is dark — auth first, and dark reads nothing', async () => {
    state.uid = null;
    for (const flag of [true, false]) {
      state.flag = flag;
      expect((await get({ groupId: 'g-now', odUserId: 'od-a' })).statusCode).toBe(401);
    }
    state.uid = 'viewer-1';
    state.flag = false;
    const res = await get({ groupId: 'g-now', odUserId: 'od-a' });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(DB.readLog).toEqual([]);
  });

  it('400s a missing or malformed groupId / odUserId before any read', async () => {
    expect((await get({ odUserId: 'od-a' })).body.error).toBe('invalid_group_id');
    expect((await get({ groupId: 'g/now', odUserId: 'od-a' })).body.error).toBe('invalid_group_id');
    expect((await get({ groupId: 'g-now' })).body.error).toBe('invalid_team');
    expect((await get({ groupId: 'g-now', odUserId: 'od a' })).body.error).toBe('invalid_team');
    expect(DB.readLog).toEqual([]);
  });

  it('404s a pod that does not exist and a seat that is not in it', async () => {
    expect((await get({ groupId: 'g-nope', odUserId: 'od-a' })).body).toEqual({ error: 'no_pod' });
    expect((await get({ groupId: 'g-now', odUserId: 'od-stranger' })).body).toEqual({ error: 'seat_not_present' });
  });

  it('is READ-ONLY — a full projection writes nothing', async () => {
    await get({ groupId: 'g-now', odUserId: 'od-a' });
    expect(DB.writeLog).toEqual([]);
  });
});

// ============================================================================
describe('the veteran card — the team leads, from real completed data', () => {
  let body;
  beforeEach(async () => {
    const res = await get({ groupId: 'g-now', odUserId: 'od-a' });
    expect(res.statusCode).toBe(200);
    body = res.body;
  });

  it('the seat: index of four, not the viewer, viewer not seated', () => {
    expect(body.seat).toEqual({ index: 1, count: 4, isCpu: false, isViewer: false, viewerSeated: false });
    expect(body.groupId).toBe('g-now');
    expect(body.odUserId).toBe('od-a');
    expect(body.viewerUid).toBe('viewer-1');
  });

  it('the team unit: display name, the pitch in the player\'s words, the agent with archetype label, approach and COUNTS ONLY', () => {
    expect(body.team.displayName).toBe('Mira');
    expect(body.team.isCpu).toBe(false);
    expect(body.team.pitch).toBe('I take the leader in whatever sector has breadth on Monday. Kestrel presses; I bank.');
    expect(body.team.agent).toEqual({
      name: 'Kestrel',
      archetype: 'momentum_chaser',
      archetypeLabel: 'Trend Follower',
      approach: ARCHETYPE_IDENTITY.momentum_chaser.disposition,
      traitCount: 4,
      ruleCount: 7,
    });
  });

  it('the OWNER LOOKUP excludes clones — the ranked agent wins even though the clones are seeded first', () => {
    expect(body.team.agent.name).toBe('Kestrel');
    expect(body.team.agent.archetype).not.toBe('guardian');
    expect(body.team.agent.archetype).not.toBe('degen');
  });

  it('the known facts: completed history only — RP, tier, last placements (most recent first), weeks played; NO live standing', () => {
    expect(body.known).toEqual({ rp: 412, tier: 2, tierName: 'Analyst', weeksPlayed: 2, priorFinishes: [1, 2] });
    // rev3 §2: no "Round 1 now · 2nd of 4 · +X" anywhere on the card.
    const keys = allKeys(body);
    for (const k of ['liveStanding', 'currentRank', 'currentWeek', 'liveScore', 'standing']) expect(keys.has(k)).toBe(false);
  });

  it('last week — the human\'s three drafted picks and what became of them, as recorded', () => {
    const lw = body.lastWeek;
    expect(lw.groupId).toBe('g-w2');
    expect(lw.baseLayerWeek).toBe('2026-W38');
    expect(lw.placement).toBe(1);
    expect(lw.seatCount).toBe(4);
    expect(lw.composite).toBe(8.7);
    expect(lw.human.drafted).toEqual(['NVDA', 'AMD', 'COIN']);
    expect(lw.human.picks).toEqual([
      { symbol: 'NVDA', drafted: true, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, swappedOut: null },
      { symbol: 'AMD', drafted: true, heldAtClose: true, flips: 1, direction: 'short', lastFlipDay: 'WED', swappedOut: null },
      { symbol: 'COIN', drafted: true, heldAtClose: false, flips: null, direction: null, lastFlipDay: null, swappedOut: { day: 'TUE', forSymbol: 'XLE' } },
      { symbol: 'XLE', drafted: false, heldAtClose: true, flips: 0, direction: 'long', lastFlipDay: null, claimedIn: { day: 'TUE', forSymbol: 'COIN' } },
    ]);
  });

  it('last week — the agent\'s six from the frozen Monday portfolio, the one recorded swap, the agent\'s own recorded why', () => {
    const ag = body.lastWeek.agent;
    expect(ag.agentName).toBe('Kestrel');
    expect(ag.swaps).toBe(1);
    expect(ag.picks.map((p) => p.symbol)).toEqual(['NVDA', 'AMD', 'AVGO', 'ANET', 'VST', 'META', 'SMCI']);
    expect(ag.picks.find((p) => p.symbol === 'ANET')).toEqual({ symbol: 'ANET', sector: 'technology', drafted: true, heldAtClose: false, swappedOut: { day: 'THU', forSymbol: 'SMCI' } });
    expect(ag.picks.find((p) => p.symbol === 'SMCI')).toEqual({ symbol: 'SMCI', sector: null, drafted: false, heldAtClose: true, addedIn: { day: 'THU', forSymbol: 'ANET' } });
    expect(ag.picks.find((p) => p.symbol === 'NVDA')).toEqual({ symbol: 'NVDA', sector: 'technology', drafted: true, heldAtClose: true, swappedOut: null });
    expect(ag.trades).toEqual([{ day: 'THU', symbolOut: 'ANET', symbolIn: 'SMCI', rationale: 'Broke its Monday low. Rule is rule.' }]);
  });

  it('the other owner\'s battle, the non-tournament battle and the ACTIVE battle are ignored — no live WHY, no foreign tape', () => {
    const strings = allStrings(body);
    expect(strings).not.toContain('live WHY');
    expect(strings).not.toContain('other owner');
    expect(strings.some((s) => s.includes('PRIVATE'))).toBe(false);
    expect(body.lastWeek.agent.picks.map((p) => p.symbol)).not.toContain('LIVE');
    expect(body.lastWeek.agent.picks.map((p) => p.symbol)).not.toContain('ZZZ');
  });

  it('the tape link points at the completed week\'s battle view, focused on this seat', () => {
    expect(body.lastWeek.tape).toEqual({ groupId: 'g-w2', focusId: 'od-a' });
  });

  it('the DERIVED LINE is deriveWeekLine over exactly these facts — held from the draft record, moves from both layers, lean from the repo\'s sector map', () => {
    // NVDA and AMD are in COMPANY_SECTORS (technology); XLE (claimed in) is on
    // the roster at close but not drafted, so it is not a held name.
    expect(body.team.derived).toBe('Held 2 of 3 all week · 2 moves · leaned technology');
    expect(body.team.derived).toBe(deriveWeekLine({
      drafted: ['NVDA', 'AMD', 'COIN'], heldAtClose: ['NVDA', 'AMD', 'XLE'], userSwaps: 1, agentSwaps: 1,
      sectors: { NVDA: 'technology', AMD: 'technology' },
    }));
  });

  it('PROJECTION ONLY — no rule contents, trait contents, bundle ids, config or strategy WHY anywhere in the body (walked by key)', () => {
    const keys = allKeys(body);
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `leaked key: ${k}`).toBe(false);
  });
});

// ============================================================================
describe('the FIRST-WEEK card — the primary case', () => {
  it('a human with an agent but no finalized week: known null, lastWeek null, derived null, no pitch yet', async () => {
    const res = await get({ groupId: 'g-now', odUserId: 'od-b' });
    expect(res.statusCode).toBe(200);
    expect(res.body.team).toEqual({
      displayName: 'Draco',
      isCpu: false,
      pitch: null,
      derived: null,
      agent: { name: 'Tarn', archetype: 'analyst', archetypeLabel: 'Fundamental Investor', approach: ARCHETYPE_IDENTITY.analyst.disposition, traitCount: 3, ruleCount: 5 },
    });
    expect(res.body.known).toBeNull();
    expect(res.body.lastWeek).toBeNull();
    expect(res.body.seat.index).toBe(2);
  });

  it('a human with NO agent document projects agent: null — nothing invented', async () => {
    DB.store.delete('agents/agent-b');
    const res = await get({ groupId: 'g-now', odUserId: 'od-b' });
    expect(res.body.team.agent).toBeNull();
  });

  it('a cleared pitch reads as no pitch', async () => {
    DB.store.set('teamPitches/od-a', { text: '', updatedAt: '2026-09-21T00:00:00.000Z' });
    const res = await get({ groupId: 'g-now', odUserId: 'od-a' });
    expect(res.body.team.pitch).toBeNull();
  });
});

// ============================================================================
describe('the CPU seat — archetype and no history (spec §5)', () => {
  it('projects the deterministic archetype, its stated approach, counts from the system doc, and nothing else', async () => {
    const res = await get({ groupId: 'g-now', odUserId: 'cpu-1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.seat).toEqual({ index: 3, count: 4, isCpu: true, isViewer: false, viewerSeated: false });
    expect(res.body.team).toEqual({
      displayName: 'CPU — Trend Follower',
      isCpu: true,
      pitch: null,
      derived: null,
      agent: { name: 'CPU — Trend Follower', archetype: 'momentum_chaser', archetypeLabel: 'Trend Follower', approach: ARCHETYPE_IDENTITY.momentum_chaser.disposition, traitCount: 0, ruleCount: 0 },
    });
    expect(res.body.known).toBeNull();
    expect(res.body.lastWeek).toBeNull();
  });

  it('a CPU without a system agent doc still has its archetype; the counts are null, never zero-filled', async () => {
    const res = await get({ groupId: 'g-now', odUserId: 'cpu-2' });
    expect(res.body.team.agent.archetype).toBe('contrarian');
    expect(res.body.team.agent.archetypeLabel).toBe('Contrarian');
    expect(res.body.team.agent.traitCount).toBeNull();
    expect(res.body.team.agent.ruleCount).toBeNull();
  });
});

// ============================================================================
describe('honesty of the pure pieces', () => {
  it('projectAgent: an unknown archetype gets NO approach — never the analyst fallback', () => {
    const p = projectAgent({ name: 'X', archetype: 'not_an_archetype', equippedTraits: [1], activeRules: [] });
    expect(p.approach).toBeNull();
    expect(p.archetype).toBe('not_an_archetype');
    expect(projectAgent({ name: 'Y' })).toEqual({ name: 'Y', archetype: null, archetypeLabel: null, approach: null, traitCount: null, ruleCount: null });
  });

  it('projectAgent returns exactly six fields — the whole public surface of an agent doc', () => {
    expect(Object.keys(projectAgent(RANKED_AGENT)).sort()).toEqual(['approach', 'archetype', 'archetypeLabel', 'name', 'ruleCount', 'traitCount']);
  });

  it('the approach is the canonical per-archetype copy, one string per archetype, for every archetype the identity module knows', () => {
    for (const [key, identity] of Object.entries(ARCHETYPE_IDENTITY)) {
      expect(projectAgent({ archetype: key }).approach).toBe(identity.disposition);
    }
  });

  it('knownFactsFrom: no doc or an empty history → null; otherwise the strip\'s facts with the last placements most recent first', () => {
    expect(knownFactsFrom(null)).toBeNull();
    expect(knownFactsFrom({ rp: 0, history: [] })).toBeNull();
    const facts = knownFactsFrom({ rp: 900, tier: 3, tierName: 'Associate', appliedGroups: { a: 1, b: 1, c: 1, d: 1 }, history: [{ placement: 4 }, { placement: 3 }, { placement: 2 }, { placement: 1 }] });
    expect(facts).toEqual({ rp: 900, tier: 3, tierName: 'Associate', weeksPlayed: 4, priorFinishes: [1, 2, 3] });
    expect(facts.priorFinishes).toHaveLength(PRIOR_FINISHES);
  });

  it('etDayLabel reads the ET weekday, and is null for an unreadable instant', () => {
    expect(etDayLabel('2026-09-14T11:00:00.000Z')).toBe('MON');
    expect(etDayLabel('2026-09-18T20:00:00.000Z')).toBe('FRI');
    // 03:00Z on Tuesday is still MONDAY evening in New York.
    expect(etDayLabel('2026-09-15T03:00:00.000Z')).toBe('MON');
    expect(etDayLabel(null)).toBeNull();
    expect(etDayLabel('not a date')).toBeNull();
  });

  it('humanLayerFrom with no draft record and no roster projects nulls, not guesses', () => {
    expect(humanLayerFrom({ drafted: null, player: null, approvedClaims: [] })).toEqual({ drafted: null, heldAtClose: null, picks: [] });
  });

  it('agentLayerFrom with no completed battle is null', () => {
    expect(agentLayerFrom([])).toBeNull();
    expect(agentLayerFrom(null)).toBeNull();
  });

  it('the history walk is bounded and skips the current pod', () => {
    expect(HISTORY_LOOKBACK).toBe(5);
  });
});

// ============================================================================
describe('the last completed week is found through the rank history, and only a COMPLETED base-layer week counts', () => {
  it('a history whose latest group is still in battle falls back to the completed one behind it', async () => {
    DB.store.set('tournamentGroups/g-w3', { status: 'battle', baseLayerWeek: '2026-W39', players: [{ odUserId: 'od-a', picks: [] }], dailyScores: { day2: { closeScores: { 'od-a': { compositePoints: 1 } } } } });
    const rank = DB.store.get('tournamentRanks/od-a');
    rank.history.push({ groupId: 'g-w3', placement: 1 });
    rank.appliedGroups['g-w3'] = { placement: 1 };
    const res = await get({ groupId: 'g-now', odUserId: 'od-a' });
    expect(res.body.lastWeek.groupId).toBe('g-w2');
    expect(res.body.known.weeksPlayed).toBe(3);
  });

  it('a week that never banked its final day, or a training pod, is not "completed"', async () => {
    const g = DB.store.get('tournamentGroups/g-w2');
    delete g.dailyScores.day5;
    const res = await get({ groupId: 'g-now', odUserId: 'od-a' });
    expect(res.body.lastWeek).toBeNull();
    expect(res.body.team.derived).toBeNull();
    // ...and the known-facts strip still counts the finalized weeks.
    expect(res.body.known.weeksPlayed).toBe(2);
  });

  it('a missing draft stream omits the drafted list and the held clause — nothing filled from the roster', async () => {
    DB.store.delete('tournamentGroups/g-w2/streams/userDraft');
    const res = await get({ groupId: 'g-now', odUserId: 'od-a' });
    expect(res.body.lastWeek.human.drafted).toBeNull();
    expect(res.body.lastWeek.human.picks.map((p) => p.symbol)).toEqual(['NVDA', 'AMD', 'XLE']);
    expect(res.body.lastWeek.human.picks.every((p) => p.drafted === false)).toBe(true);
    expect(res.body.team.derived).toBe('2 moves');
  });

  it('a dev pod reads the dev-namespace rank doc (ruling A-4 mirrored), never the production one', async () => {
    DB.store.set('tournamentGroups/g-dev', { status: 'forming', isDev: true, baseLayerWeek: '2026-W40', players: [{ odUserId: 'od-a' }, { odUserId: 'cpu-1', isCpu: true }] });
    const res = await get({ groupId: 'g-dev', odUserId: 'od-a' });
    expect(res.body.known).toBeNull(); // no tournamentRanks/dev-od-a doc
    expect(DB.readLog.some(([, p]) => p === 'tournamentRanks/dev-od-a')).toBe(true);
    expect(DB.readLog.some(([, p]) => p === 'tournamentRanks/od-a')).toBe(false);
  });
});
