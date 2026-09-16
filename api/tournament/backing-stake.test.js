// api/tournament/backing-stake.test.js
//
// POST /api/tournament/backing-stake — Backing Beta PR 2 (spec V1.3 §8 the one
// stake transaction, §4 window + belt, §3 sealed pools, §12 PR 2; Amendment A
// §A2/§A3 through backingEligibility.js).
//
// THE TRANSACTION HARNESS IS A REAL OPTIMISTIC-CONCURRENCY SIMULATOR, not a
// pass-through. It versions every document, records the versions a transaction
// READ, and on commit discards the buffered writes and RE-RUNS the body if any
// of them moved — which is what Firestore does, and the only way a "two
// simultaneous submissions serialize on the wallet" row can mean anything. It
// also refuses a read issued after a write, so a reordering that production
// would reject fails here instead of in production.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import below is the
// runtime guard for its api/ -> src/ imports (src/constants/backing.js,
// src/constants/leagueTournament.js, src/constants/eligibility.js,
// src/config/featureFlags.js). Never mock the constants modules.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ flag: true, uid: 'backer-1', provider: 'password' }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: state.provider } };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return state.flag; },
}));

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { default: handler, stakeIdFor, stakeRefFor, stakeMetaRefFor, MAX_REQUEST_ID_LEN } = await import('./backing-stake.js');
const { MIN_STAKE_BP, PER_TEAM_CAP_BP, ALLOWANCE_BP } = await import('../../src/constants/backing.js');
const { TERMS_VERSION } = await import('../../src/constants/eligibility.js');
const { ELIGIBILITY_COLLECTION } = await import('../_utils/eligibility.js');
const { BACKING_INELIGIBLE } = await import('../_utils/backingEligibility.js');
const { BACKING_WALLETS_COLLECTION } = await import('../_utils/backingWallet.js');
const {
  BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS,
} = await import('../_utils/backingPools.js');

// ==================== THE CONCURRENCY HARNESS ====================
const tick = () => new Promise((r) => setImmediate(r));

function makeVersionedDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const versions = new Map();
  const writeLog = [];
  const stats = { attempts: 0, commits: 0, conflicts: 0 };

  const snapOf = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
  };
  const docsUnder = (prefix) => [...store.entries()]
    .filter(([p]) => p.startsWith(`${prefix}/`) && !p.slice(prefix.length + 1).includes('/'))
    .map(([p, d]) => ({ __path: p, id: p.slice(prefix.length + 1), data: () => structuredClone(d) }));
  const snapshotOf = (docs) => ({
    docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb),
  });

  function makeQuery(prefix, filters, order = null, max = null) {
    const run = () => {
      let docs = docsUnder(prefix).filter((d) => filters.every((f) => f.op !== '==' || d.data()[f.field] === f.value));
      if (order) {
        docs = [...docs].sort((a, b) => {
          const av = a.data()[order.field]; const bv = b.data()[order.field];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (order.dir === 'desc' ? -1 : 1);
        });
      }
      return max == null ? docs : docs.slice(0, max);
    };
    return {
      path: prefix,
      _run: run,
      where: (field, op, value) => makeQuery(prefix, [...filters, { field, op, value }], order, max),
      orderBy: (field, dir = 'asc') => makeQuery(prefix, filters, { field, dir }, max),
      limit: (n) => makeQuery(prefix, filters, order, n),
      get: async () => { await tick(); return snapshotOf(run()); },
    };
  }
  function makeDocRef(path) {
    return {
      path,
      _isDoc: true,
      get: async () => { await tick(); return snapOf(path); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function makeCollection(prefix) {
    return {
      path: prefix,
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, op, value) => makeQuery(prefix, [{ field, op, value }]),
      get: async () => { await tick(); return snapshotOf(docsUnder(prefix)); },
    };
  }

  const db = {
    collection: makeCollection,
    runTransaction: async (fn) => {
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        stats.attempts += 1;
        const reads = new Map();
        const buffer = [];
        let wrote = false;
        const remember = (path) => reads.set(path, versions.get(path) ?? 0);
        const tx = {
          get: async (ref) => {
            // The Firestore rule, enforced: a transaction reads everything
            // before it writes anything.
            if (wrote) throw new Error('transaction read after write');
            await tick();
            if (ref._isDoc) { remember(ref.path); return snapOf(ref.path); }
            const docs = ref._run();
            // A query's read set is the documents it matched. Coarser than
            // Firestore's (which also guards the range), and the direction that
            // matters here: it never reports a conflict that did not happen.
            for (const d of docs) remember(d.__path);
            return snapshotOf(docs);
          },
          set: (ref, data) => { wrote = true; buffer.push([ref.path, structuredClone(data)]); },
          update: () => { throw new Error('this route writes whole documents or nothing'); },
        };
        const result = await fn(tx);
        await tick();
        const conflict = [...reads].some(([p, v]) => (versions.get(p) ?? 0) !== v);
        if (conflict) { stats.conflicts += 1; continue; }
        for (const [p, d] of buffer) {
          store.set(p, d);
          versions.set(p, (versions.get(p) ?? 0) + 1);
          writeLog.push(['tx.set', p]);
        }
        stats.commits += 1;
        return result;
      }
      throw new Error('transaction contention exhausted');
    },
  };
  return { db, store, writeLog, stats };
}

// ==================== FIXTURES ====================
const UID = 'backer-1';
const GROUP_ID = 'grp-stake-1';
const MONDAY = '2026-09-28';
const WEEK = '2026-W40';
const CLOSE_ISO = '2026-09-28T03:59:59.000Z';
const NOW = new Date('2026-09-22T14:00:00.000Z');

const group = (over = {}) => ({
  status: 'forming',
  isLiveDraft: false,
  baseLayerWeek: WEEK,
  createdAt: '2026-09-22T14:00:00.000Z',
  players: [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }],
  ...over,
});

const pool = (over = {}) => ({
  groupId: GROUP_ID,
  status: POOL_STATUS.OPEN,
  formationPath: 'lobby',
  slotId: null,
  battleMondayEtDate: MONDAY,
  backingWeekStart: '2026-09-21T04:00:00.000Z',
  opensAt: '2026-09-22T14:00:00.000Z',
  closesAt: CLOSE_ISO,
  closeReason: 'clock',
  baseLayerWeek: WEEK,
  isDev: false,
  potTotal: 0,
  uniqueBackers: 0,
  teamsBacked: 0,
  createdAt: '2026-09-22T14:00:00.000Z',
  updatedAt: '2026-09-22T14:00:00.000Z',
  ...over,
});

function world(over = {}) {
  return {
    [`tournamentGroups/${GROUP_ID}`]: group(),
    [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]: pool(),
    [`${ELIGIBILITY_COLLECTION}/${UID}`]: {
      adultAttestedAt: '2026-09-14T13:30:00.000Z', termsVersion: TERMS_VERSION,
      acceptedAt: '2026-09-14T13:30:00.000Z', source: 'backing_beta',
    },
    'agentBattles/mine': { ownerId: UID, status: 'completed', completedAt: '2026-09-01T20:00:00.000Z' },
    ...over,
  };
}

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

const VALID = () => ({ groupId: GROUP_ID, teamOdUserId: 'od-a', amount: 100, requestId: 'req-1' });

async function post(body, { method = 'POST', headers } = {}) {
  const res = mkRes();
  await handler({
    method,
    headers: headers ?? { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'Mozilla/5.0 (test)' },
    body,
  }, res);
  return res;
}

const stakeDoc = (store, id) => store.get(`${BACKING_STAKES_COLLECTION}/${id}`);
const metaDoc = (store, id) => store.get(`${BACKING_STAKES_COLLECTION}/${id}/private/meta`);
const poolDoc = (store) => store.get(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`);
const walletDoc = (store, uid = UID) => store.get(`${BACKING_WALLETS_COLLECTION}/${uid}`);

beforeEach(() => {
  state.flag = true;
  state.uid = UID;
  state.provider = 'password';
  process.env.BACKING_FINGERPRINT_SALT = 'test-salt-not-a-real-secret';
  DB = makeVersionedDb(world());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.BACKING_FINGERPRINT_SALT;
});

// ============================================================================
describe('the pipeline, in order', () => {
  it('405s anything but POST, before auth', async () => {
    state.uid = null;
    for (const method of ['GET', 'PUT', 'DELETE']) {
      expect((await post(VALID(), { method })).statusCode).toBe(405);
    }
    expect(DB.writeLog).toEqual([]);
  });

  it('401s without a caller — BEFORE the flag, so an anonymous caller learns nothing about it', async () => {
    state.uid = null;
    for (const flag of [true, false]) {
      state.flag = flag;
      expect((await post(VALID())).statusCode).toBe(401);
    }
    expect(DB.stats.attempts).toBe(0);
  });

  it('404s while the flag is dark, AFTER auth', async () => {
    state.flag = false;
    const res = await post(VALID());
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(DB.writeLog).toEqual([]);
  });
});

// ============================================================================
describe('the body — each refusal a plain reason, nothing written', () => {
  const rows = [
    ['invalid_group_id', { groupId: undefined }],
    ['invalid_group_id', { groupId: '' }],
    ['invalid_group_id', { groupId: 'a/b' }],
    ['invalid_group_id', { groupId: 7 }],
    ['invalid_team', { teamOdUserId: undefined }],
    ['invalid_team', { teamOdUserId: 'od a' }],
    ['invalid_amount', { amount: undefined }],
    ['invalid_amount', { amount: '100' }],
    ['invalid_amount', { amount: 100.5 }],
    ['invalid_amount', { amount: NaN }],
    ['below_min_stake', { amount: MIN_STAKE_BP - 1 }],
    ['below_min_stake', { amount: 0 }],
    ['below_min_stake', { amount: -100 }],
    ['above_team_cap', { amount: PER_TEAM_CAP_BP + 1 }],
    ['invalid_request_id', { requestId: undefined }],
    ['invalid_request_id', { requestId: '' }],
    ['invalid_request_id', { requestId: 42 }],
    ['invalid_request_id', { requestId: 'x'.repeat(MAX_REQUEST_ID_LEN + 1) }],
  ];
  for (const [error, patch] of rows) {
    it(`400 ${error} for ${JSON.stringify(patch)}`, async () => {
      const res = await post({ ...VALID(), ...patch });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe(error);
      expect(DB.writeLog).toEqual([]);
      expect(DB.stats.attempts).toBe(0);
    });
  }

  it('400s an absent or non-object body with the first check\'s reason', async () => {
    for (const body of [undefined, null, 'groupId=x', 42, true, []]) {
      const res = await post(body);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid_group_id');
    }
  });

  it('accepts the boundary amounts — the minimum and the cap exactly', async () => {
    for (const amount of [MIN_STAKE_BP, PER_TEAM_CAP_BP]) {
      DB = makeVersionedDb(world());
      const res = await post({ ...VALID(), amount });
      expect(res.statusCode).toBe(200);
    }
  });
});

// ============================================================================
describe('the happy path — the §6 stake, the sealed meta, the counters', () => {
  it('writes the stake, its private meta, the wallet, the totals and the pool', async () => {
    const res = await post(VALID());
    expect(res.statusCode).toBe(200);
    const id = stakeIdFor(UID, 'req-1');

    expect(stakeDoc(DB.store, id)).toEqual({
      userId: UID,
      groupId: GROUP_ID,
      teamOdUserId: 'od-a',
      amount: 100,
      hashAtStake: null,
      placedAt: NOW.toISOString(),
      weekKey: WEEK,
      requestId: 'req-1',
      status: STAKE_STATUS.LIVE,
    });

    // The pool's public counters, and the allowance granted lazily this week.
    expect(poolDoc(DB.store)).toMatchObject({ potTotal: 100, uniqueBackers: 1, teamsBacked: 1 });
    expect(walletDoc(DB.store)).toMatchObject({
      lastAllowanceWeek: WEEK,
      allowanceRemaining: ALLOWANCE_BP - 100,
      careerNet: -100,
    });
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/${UID}/entries/stake:${id}`))
      .toMatchObject({ type: 'stake', delta: -100, ref: id, weekKey: WEEK });

    expect(res.body).toEqual({
      replay: false,
      stake: { id, ...stakeDoc(DB.store, id) },
      pool: {
        status: 'open', potTotal: 100, uniqueBackers: 1, teamsBacked: 1,
        closesAt: CLOSE_ISO, closeReason: 'clock',
      },
      allowanceRemaining: ALLOWANCE_BP - 100,
    });
  });

  it('E1: the fingerprint and `excluded` are in private/meta — NEVER on the owner-readable stake', async () => {
    await post(VALID());
    const id = stakeIdFor(UID, 'req-1');
    const meta = metaDoc(DB.store, id);
    expect(Object.keys(meta).sort()).toEqual(['at', 'excluded', 'ipHash', 'uaHash']);
    expect(meta.excluded).toBe(false);
    // Hashed, never raw — neither the IP nor the UA appears anywhere.
    expect(meta.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(meta.uaHash).toMatch(/^[0-9a-f]{64}$/);
    const everything = JSON.stringify([...DB.store.values()]);
    expect(everything).not.toContain('203.0.113.9');
    expect(everything).not.toContain('Mozilla/5.0 (test)');
    // ...and the stake doc itself carries none of the three fields, because a
    // rule cannot hide a field on an owner-readable document.
    for (const field of ['ipHash', 'uaHash', 'excluded', 'fingerprint']) {
      expect(stakeDoc(DB.store, id)).not.toHaveProperty(field);
    }
    expect(stakeMetaRefFor(DB.db, id).path).toBe(`${BACKING_STAKES_COLLECTION}/${id}/private/meta`);
  });

  it('only the first IP of an x-forwarded-for chain is fingerprinted — the rate limiter\'s own rule', async () => {
    const { hashFingerprint } = await import('../_utils/backingFingerprint.js');
    await post(VALID());
    expect(metaDoc(DB.store, stakeIdFor(UID, 'req-1')).ipHash).toBe(hashFingerprint('203.0.113.9'));
  });

  it('records `hashAtStake` when the seat\'s agent IS resolvable', async () => {
    DB = makeVersionedDb(world({
      'agentBattles/theirs': {
        ownerId: 'od-a', status: 'completed', completedAt: '2026-09-05T20:00:00.000Z',
        resolvedAgentManifest: { equippedConfigHash: 'abc123hash' },
      },
    }));
    await post(VALID());
    expect(stakeDoc(DB.store, stakeIdFor(UID, 'req-1')).hashAtStake).toBe('abc123hash');
  });

  it('an UNRESOLVABLE agent still stakes, with hashAtStake null — never fail a stake over telemetry', async () => {
    // Three ways it can be unresolvable, all of which must succeed.
    const worlds = [
      world(),                                                                    // no battle at all
      world({ 'agentBattles/theirs': { ownerId: 'od-a', status: 'active' } }),     // nothing completed
      world({ 'agentBattles/theirs': { ownerId: 'od-a', status: 'completed', completedAt: 'x', resolvedAgentManifest: {} } }),
    ];
    for (const w of worlds) {
      DB = makeVersionedDb(w);
      const res = await post(VALID());
      expect(res.statusCode).toBe(200);
      expect(stakeDoc(DB.store, stakeIdFor(UID, 'req-1')).hashAtStake).toBeNull();
    }
  });

  it('a CPU seat records no hash and costs no lookup — all CPUs share one hash (§1)', async () => {
    const res = await post({ ...VALID(), teamOdUserId: 'cpu-1' });
    expect(res.statusCode).toBe(200);
    expect(stakeDoc(DB.store, stakeIdFor(UID, 'req-1')).hashAtStake).toBeNull();
  });

  it('the reply is SEALED: no per-team total, no pays × (§3)', async () => {
    await post(VALID());
    const res = await post({ ...VALID(), requestId: 'req-2', teamOdUserId: 'od-b', amount: 250 });
    const body = JSON.stringify(res.body);
    expect(Object.keys(res.body.pool).sort())
      .toEqual(['closeReason', 'closesAt', 'potTotal', 'status', 'teamsBacked', 'uniqueBackers']);
    expect(body).not.toContain('paysX');
    expect(body).not.toContain('byTeam');
    expect(body).not.toContain('backers');
    // The pot moved, but WHERE the BP sits is not in the answer.
    expect(res.body.pool.potTotal).toBe(350);
  });

  it('the sealed totals doc holds the per-backer map the public doc is derived from', async () => {
    await post(VALID());
    await post({ ...VALID(), requestId: 'req-2', teamOdUserId: 'od-b', amount: 250 });
    const totals = DB.store.get(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}/private/totals`);
    expect(totals.backers[UID]).toEqual({ total: 350, byTeam: { 'od-a': 100, 'od-b': 250 } });
    expect(totals.byTeam).toEqual({
      'od-a': { stakeTotal: 100, backerCount: 1 },
      'od-b': { stakeTotal: 250, backerCount: 1 },
    });
    expect(poolDoc(DB.store)).toMatchObject({ potTotal: 350, uniqueBackers: 1, teamsBacked: 2 });
  });
});

// ============================================================================
describe('the window and the belt (§4)', () => {
  it('refuses once the server clock has passed closesAt', async () => {
    vi.setSystemTime(new Date('2026-09-28T04:30:00.000Z'));
    const res = await post(VALID());
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('pool_closed');
  });

  it('refuses a pool that is no longer open', async () => {
    DB = makeVersionedDb(world({
      [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]: pool({ status: POOL_STATUS.CLOSED }),
    }));
    const res = await post(VALID());
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'pool_closed', poolStatus: POOL_STATUS.CLOSED });
  });

  it('the BELT refuses the moment a tournament battle doc exists for this pod', async () => {
    DB = makeVersionedDb(world({
      'agentBattles/podbattle': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament', ownerId: 'od-a' },
    }));
    const res = await post(VALID());
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('battle_started');
    expect(DB.writeLog.filter(([, p]) => p.startsWith(BACKING_STAKES_COLLECTION))).toEqual([]);
  });

  it('the belt checks `gameMode` — a non-tournament battle carrying this groupId does NOT close the window', async () => {
    DB = makeVersionedDb(world({
      'agentBattles/other': { groupId: GROUP_ID, gameMode: 'baggerbomb', ownerId: 'od-a' },
    }));
    expect((await post(VALID())).statusCode).toBe(200);
  });

  it('the clock can still be open while the belt is closed — the battle doc is the truth', async () => {
    DB = makeVersionedDb(world({
      'agentBattles/podbattle': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament' },
    }));
    // Mid-window by the clock; refused anyway.
    vi.setSystemTime(new Date('2026-09-23T14:00:00.000Z'));
    expect((await post(VALID())).body.error).toBe('battle_started');
  });

  it('a pod with no pool and no eligibility gets `no_pool` with the reason', async () => {
    const store = world();
    delete store[`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`];
    store[`tournamentGroups/${GROUP_ID}`] = group({ status: 'battle' });
    DB = makeVersionedDb(store);
    const res = await post(VALID());
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'no_pool', reason: 'not_forming' });
  });

  it('a DELETED pod refuses and refunds whatever its pool held (§7)', async () => {
    const store = world();
    delete store[`tournamentGroups/${GROUP_ID}`];
    store[`${BACKING_STAKES_COLLECTION}/old`] = {
      userId: 'someone', groupId: GROUP_ID, teamOdUserId: 'od-a', amount: 200,
      weekKey: WEEK, status: STAKE_STATUS.LIVE,
    };
    store[`${BACKING_WALLETS_COLLECTION}/someone`] = {
      lastAllowanceWeek: WEEK, allowanceRemaining: ALLOWANCE_BP - 200, careerNet: -200,
      seasons: {}, appliedEntries: { [`allowance:${WEEK}`]: 'x', 'stake:old': 'x' },
    };
    DB = makeVersionedDb(store);
    vi.setSystemTime(new Date('2026-09-28T04:30:00.000Z'));
    const res = await post(VALID());
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('no_pod');
    expect(DB.store.get(`${BACKING_STAKES_COLLECTION}/old`).voidReason).toBe('group_deleted');
    expect(walletDoc(DB.store, 'someone').careerNet).toBe(0);
  });

  it('a pool past its close is closed by THIS request before the stake is judged (§7)', async () => {
    const store = world();
    for (const [i, uid] of ['u1', 'u2', 'u3'].entries()) {
      store[`${BACKING_STAKES_COLLECTION}/s${i}`] = {
        userId: uid, groupId: GROUP_ID, teamOdUserId: i === 0 ? 'od-b' : 'od-a',
        amount: 100, weekKey: WEEK, status: STAKE_STATUS.LIVE,
      };
      store[`${BACKING_WALLETS_COLLECTION}/${uid}`] = {
        lastAllowanceWeek: WEEK, allowanceRemaining: ALLOWANCE_BP - 100, careerNet: -100,
        seasons: {}, appliedEntries: { [`allowance:${WEEK}`]: 'x', [`stake:s${i}`]: 'x' },
      };
    }
    DB = makeVersionedDb(store);
    vi.setSystemTime(new Date('2026-09-28T04:30:00.000Z'));
    const res = await post(VALID());
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('pool_closed');
    expect(poolDoc(DB.store).status).toBe(POOL_STATUS.CLOSED);
    expect(poolDoc(DB.store).teams).toBeDefined();
  });
});

// ============================================================================
describe('eligibility (§8) — every refusal is a 403 carrying its reason', () => {
  it('403s an anonymous account', async () => {
    state.provider = 'anonymous';
    const res = await post(VALID());
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(BACKING_INELIGIBLE.ACCOUNT_REQUIRED);
  });

  it('403s a missing attestation', async () => {
    const store = world();
    delete store[`${ELIGIBILITY_COLLECTION}/${UID}`];
    DB = makeVersionedDb(store);
    expect((await post(VALID())).body.error).toBe(BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED);
  });

  it('403s a STALE terms version (D-aa)', async () => {
    DB = makeVersionedDb(world({
      [`${ELIGIBILITY_COLLECTION}/${UID}`]: { termsVersion: 'beta-2026-08-draft', adultAttestedAt: 'x' },
    }));
    expect((await post(VALID())).body.error).toBe(BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED);
  });

  it('403s a caller seated in the pod, on ANY seat (§8 own-pod)', async () => {
    DB = makeVersionedDb(world({
      [`tournamentGroups/${GROUP_ID}`]: group({ players: [{ odUserId: UID }, { odUserId: 'od-a' }] }),
    }));
    expect((await post(VALID())).body.error).toBe(BACKING_INELIGIBLE.OWN_POD);
  });

  it('403s a seat that is not in players[] at stake time', async () => {
    expect((await post({ ...VALID(), teamOdUserId: 'od-nobody' })).body.error)
      .toBe(BACKING_INELIGIBLE.SEAT_NOT_PRESENT);
  });

  it('403s an account with no completed battle', async () => {
    const store = world();
    delete store['agentBattles/mine'];
    DB = makeVersionedDb(store);
    expect((await post(VALID())).body.error).toBe(BACKING_INELIGIBLE.NO_COMPLETED_BATTLE);
  });

  it('writes NOTHING on any eligibility refusal', async () => {
    state.provider = 'anonymous';
    await post(VALID());
    expect(DB.writeLog).toEqual([]);
  });
});

// ============================================================================
describe('the cap and the allowance (§2, §8)', () => {
  it('enforces the per-team cap ACROSS two stakes', async () => {
    expect((await post({ ...VALID(), amount: 300 })).statusCode).toBe(200);
    const res = await post({ ...VALID(), requestId: 'req-2', amount: 300 });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'per_team_cap', staked: 300, cap: PER_TEAM_CAP_BP });
    // The refused stake wrote nothing — not the doc, not the ledger.
    expect(stakeDoc(DB.store, stakeIdFor(UID, 'req-2'))).toBeUndefined();
    expect(walletDoc(DB.store).allowanceRemaining).toBe(ALLOWANCE_BP - 300);
  });

  it('admits a second stake that lands exactly ON the cap', async () => {
    expect((await post({ ...VALID(), amount: 300 })).statusCode).toBe(200);
    expect((await post({ ...VALID(), requestId: 'req-2', amount: 200 })).statusCode).toBe(200);
    expect(walletDoc(DB.store).allowanceRemaining).toBe(ALLOWANCE_BP - 500);
  });

  it('the cap is PER TEAM — the same backer may hold 500 on each of two seats', async () => {
    expect((await post({ ...VALID(), amount: 500 })).statusCode).toBe(200);
    const res = await post({ ...VALID(), requestId: 'req-2', teamOdUserId: 'od-b', amount: 500 });
    expect(res.statusCode).toBe(200);
    expect(poolDoc(DB.store).potTotal).toBe(1000);
  });

  it('a VOIDED stake no longer counts against the cap', async () => {
    DB = makeVersionedDb(world({
      [`${BACKING_STAKES_COLLECTION}/old`]: {
        userId: UID, groupId: GROUP_ID, teamOdUserId: 'od-a', amount: 500,
        weekKey: WEEK, status: STAKE_STATUS.VOIDED, voidReason: 'seat_left',
      },
    }));
    expect((await post({ ...VALID(), amount: 500 })).statusCode).toBe(200);
  });

  it('exhausts the allowance and refuses the stake that would overdraw it', async () => {
    // 1,000 BP: 500 on od-a, 500 on od-b, then nothing left anywhere.
    expect((await post({ ...VALID(), amount: 500 })).statusCode).toBe(200);
    expect((await post({ ...VALID(), requestId: 'r2', teamOdUserId: 'od-b', amount: 500 })).statusCode).toBe(200);
    expect(walletDoc(DB.store).allowanceRemaining).toBe(0);

    const res = await post({ ...VALID(), requestId: 'r3', teamOdUserId: 'cpu-1', amount: 100 });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('insufficient_allowance');
    expect(poolDoc(DB.store).potTotal).toBe(1000);
  });

  it('grants the week\'s allowance lazily on the first stake (§2, D-h)', async () => {
    expect(walletDoc(DB.store)).toBeUndefined();
    await post(VALID());
    const w = walletDoc(DB.store);
    expect(w.lastAllowanceWeek).toBe(WEEK);
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/${UID}/entries/allowance:${WEEK}`))
      .toMatchObject({ type: 'allowance', delta: ALLOWANCE_BP });
  });

  it('a DEV pod debits the dev-namespaced wallet, never the real one', async () => {
    DB = makeVersionedDb(world({
      [`tournamentGroups/${GROUP_ID}`]: group({ isDev: true }),
      [`${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}`]: pool({ isDev: true }),
    }));
    // The pod list excludes dev pods; the namespace is the separate mechanism.
    const res = await post(VALID());
    expect(res.statusCode).toBe(200);
    expect(walletDoc(DB.store, `dev-${UID}`).careerNet).toBe(-100);
    expect(walletDoc(DB.store, UID)).toBeUndefined();
  });
});

// ============================================================================
describe('idempotency and the race (§8)', () => {
  it('a REPLAY of the same requestId returns the existing stake and writes nothing', async () => {
    const first = await post(VALID());
    const writesAfterFirst = DB.writeLog.length;

    vi.setSystemTime(new Date('2026-09-23T14:00:00.000Z'));
    const replay = await post(VALID());
    expect(replay.statusCode).toBe(200);
    expect(replay.body.replay).toBe(true);
    expect(replay.body.stake).toEqual(first.body.stake);
    expect(DB.writeLog.length).toBe(writesAfterFirst);
    expect(poolDoc(DB.store).potTotal).toBe(100);
    expect(walletDoc(DB.store).allowanceRemaining).toBe(ALLOWANCE_BP - 100);
  });

  it('a replay is answered even after the pool has CLOSED — the stake already exists', async () => {
    await post(VALID());
    DB.store.set(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`, { ...poolDoc(DB.store), status: POOL_STATUS.CLOSED });
    const replay = await post(VALID());
    expect(replay.statusCode).toBe(200);
    expect(replay.body.replay).toBe(true);
  });

  it('a DIFFERENT requestId is a DIFFERENT stake, even for the same team and amount', async () => {
    await post(VALID());
    await post({ ...VALID(), requestId: 'req-2' });
    expect(poolDoc(DB.store).potTotal).toBe(200);
    expect(stakeIdFor(UID, 'req-1')).not.toBe(stakeIdFor(UID, 'req-2'));
  });

  it('one requestId cannot reach another user\'s stake — the id mixes in the uid', () => {
    expect(stakeIdFor('a', 'req-1')).not.toBe(stakeIdFor('b', 'req-1'));
    expect(stakeIdFor(UID, 'req-1')).toMatch(/^stk_[0-9a-f]{40}$/);
    // Path-safe whatever the client sends.
    expect(stakeIdFor(UID, 'a/b/../c')).toMatch(/^stk_[0-9a-f]{40}$/);
    expect(stakeRefFor(DB.db, stakeIdFor(UID, 'x')).path.split('/')).toHaveLength(2);
  });

  it('the stake id is STABLE across a fingerprint-salt rotation', async () => {
    const before = stakeIdFor(UID, 'req-1');
    process.env.BACKING_FINGERPRINT_SALT = 'rotated-salt';
    expect(stakeIdFor(UID, 'req-1')).toBe(before);
  });

  it('TWO SIMULTANEOUS SUBMISSIONS with the SAME requestId yield ONE stake and ONE debit', async () => {
    const [a, b] = await Promise.all([post(VALID()), post(VALID())]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    // Exactly one of them created it; the other replayed.
    expect([a.body.replay, b.body.replay].filter(Boolean)).toHaveLength(1);
    expect(DB.stats.conflicts).toBeGreaterThan(0);   // they really did contend
    expect(poolDoc(DB.store).potTotal).toBe(100);
    expect(walletDoc(DB.store).allowanceRemaining).toBe(ALLOWANCE_BP - 100);
    expect(DB.writeLog.filter(([, p]) => p === `${BACKING_STAKES_COLLECTION}/${stakeIdFor(UID, 'req-1')}`))
      .toHaveLength(1);
  });

  it('TWO SIMULTANEOUS SUBMISSIONS with DIFFERENT requestIds serialize on the wallet', async () => {
    // Different TEAMS, so the per-team cap is not what is being measured: the
    // only shared document is the wallet.
    const [a, b] = await Promise.all([
      post({ ...VALID(), amount: 400, requestId: 'r1', teamOdUserId: 'od-a' }),
      post({ ...VALID(), amount: 400, requestId: 'r2', teamOdUserId: 'od-b' }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    // Both landed, and the wallet shows BOTH debits — never one overwriting the
    // other, which is what a non-transactional read-modify-write would produce.
    expect(walletDoc(DB.store).allowanceRemaining).toBe(ALLOWANCE_BP - 800);
    expect(walletDoc(DB.store).careerNet).toBe(-800);
    expect(poolDoc(DB.store).potTotal).toBe(800);
    expect(poolDoc(DB.store).uniqueBackers).toBe(1);
    expect(poolDoc(DB.store).teamsBacked).toBe(2);
  });

  it('two simultaneous submissions CANNOT breach the per-team cap together', async () => {
    // 300 + 300 on one team is 600 against a 500 cap: exactly one must survive.
    const [a, b] = await Promise.all([
      post({ ...VALID(), amount: 300, requestId: 'r1' }),
      post({ ...VALID(), amount: 300, requestId: 'r2' }),
    ]);
    const codes = [a.statusCode, b.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const refused = [a, b].find((r) => r.statusCode === 409);
    expect(refused.body.error).toBe('per_team_cap');
    expect(poolDoc(DB.store).potTotal).toBe(300);
  });

  it('a close racing a stake cannot both land — the pool document serializes them', async () => {
    const { ensureClosed } = await import('../_utils/backingPools.js');
    // The stake is submitted at the last instant; the close runs concurrently.
    const closingNow = new Date('2026-09-28T04:30:00.000Z');
    vi.setSystemTime(closingNow);
    const [stakeRes] = await Promise.all([
      post(VALID()),
      ensureClosed(DB.db, { id: GROUP_ID, ...group() }, closingNow),
    ]);
    expect(stakeRes.statusCode).toBe(409);
    expect(stakeRes.body.error).toBe('pool_closed');
    expect(poolDoc(DB.store).status).not.toBe(POOL_STATUS.OPEN);
    // No stake document survived the close.
    expect(stakeDoc(DB.store, stakeIdFor(UID, 'req-1'))).toBeUndefined();
  });
});

// ============================================================================
describe('failures answer, they do not leak', () => {
  it('500s on an unexpected transaction failure with a generic body', async () => {
    const broken = { ...DB.db, runTransaction: async () => { throw new Error('backend exploded'); } };
    DB = { ...DB, db: broken };
    const res = await post(VALID());
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'server_error', message: 'Could not place that stake.' });
    expect(JSON.stringify(res.body)).not.toContain('exploded');
  });
});
