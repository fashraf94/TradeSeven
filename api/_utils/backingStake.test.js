// api/_utils/backingStake.test.js
//
// Backing activation — the stake PRIMITIVE (the route's transaction, moved
// verbatim so the founder smoke's seeder stakes through it). The route's own
// suite (api/tournament/backing-stake.test.js) still exercises every rung of
// the transaction end to end through the handler; these rows hold what the
// activation PR ADDED to the primitive and nothing else:
//   · a SMOKE session's stake on a production pod is refused before any
//     write — on the cheap read AND on the fresh in-transaction read
//     (mutation check 3: a smoke stake written to a production pool reds
//     these rows);
//   · `allowDev` lets the primitive open a DEV pod's pool; without it the
//     production refusal stands;
//   · a NEW stake document carries `poolId` — `dev-{groupId}` on a dev pod,
//     `groupId` otherwise — and a top-up carries it through;
//   · the eligibility check is the real one by default, and the ROUTE never
//     passes another (a source pin);
//   · the argument belt: a malformed call is a typed 400 refusal.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the primitive
// below is the runtime guard for its api/ -> src/ imports. Never mock the
// constants modules.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { makeVersionedDb } = await import('./__fixtures__/versionedFirestore.js');
const { placeStake, StakeRefusal, SMOKE_REQUIRES_DEV, stakeIdFor, MAX_REQUEST_ID_LEN } = await import('./backingStake.js');
const { BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS } = await import('./backingPools.js');
const { ELIGIBILITY_COLLECTION } = await import('./eligibility.js');
const { TERMS_VERSION } = await import('../../src/constants/eligibility.js');
const { VALIDITY_MIN_BACKERS } = await import('../../src/constants/backing.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const UID = 'backer-1';
const GROUP_ID = 'grp-prim-1';
const MONDAY = '2026-09-28';
const WEEK = '2026-W40';
const CLOSE_ISO = '2026-09-28T03:59:59.000Z';
const NOW = new Date('2026-09-22T14:00:00.000Z');
const TOKEN = { uid: UID, firebase: { sign_in_provider: 'password' } };

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
  backerProgress: { count: 0, floor: VALIDITY_MIN_BACKERS, met: false },
  teamSpread: { met: false },
  createdAt: '2026-09-22T14:00:00.000Z',
  updatedAt: '2026-09-22T14:00:00.000Z',
  ...over,
});
const eligible = () => ({
  [`${ELIGIBILITY_COLLECTION}/${UID}`]: { adultAttestedAt: '2026-09-14T13:30:00.000Z', termsVersion: TERMS_VERSION, acceptedAt: '2026-09-14T13:30:00.000Z', source: 'backing_beta' },
  'agentBattles/b-1': { ownerId: UID, status: 'completed', completedAt: '2026-09-10T20:00:00.000Z', gameMode: 'baggerbomb' },
});
const production = () => ({ [`tournamentGroups/${GROUP_ID}`]: group(), [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]: pool(), ...eligible() });
const devWorld = () => ({ [`tournamentGroups/${GROUP_ID}`]: group({ isDev: true }), [`${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}`]: pool({ isDev: true }), ...eligible() });

const args = (over = {}) => ({
  uid: UID, decodedToken: TOKEN, groupId: GROUP_ID, teamOdUserId: 'od-a', amount: 100, requestId: 'req-1', now: NOW, ...over,
});
const stakeDoc = (store) => store.get(`${BACKING_STAKES_COLLECTION}/${stakeIdFor(UID, GROUP_ID, 'od-a')}`);
const stakeWrites = (writeLog) => writeLog.filter(([, p]) => p.startsWith(`${BACKING_STAKES_COLLECTION}/`) || p.startsWith(`${BACKING_POOLS_COLLECTION}/`) || p.startsWith('backingWallets/'));

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('a SMOKE session backs dev pods only (the dev-only row — mutation check 3)', () => {
  it('refuses a smoke stake on a PRODUCTION pod before any write, and writes nothing', async () => {
    const DB = makeVersionedDb(production());
    const out = await placeStake(DB.db, args({ smoke: true, allowDev: true }));
    expect(out.refusal).toEqual({ status: 409, error: SMOKE_REQUIRES_DEV, message: 'A smoke session backs dev pods only.' });
    expect(stakeWrites(DB.writeLog)).toEqual([]);
    expect(DB.stats.commits).toBe(0);
  });

  it('a smoke stake on a MISSING pod never runs the §7 lazy close — an orphaned PRODUCTION pool under the id is left untouched, the answer is still no_pod (DEV-1, the activation review record)', async () => {
    // No tournamentGroups document; an OPEN production pool under the id.
    const orphan = () => ({ [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]: pool(), ...eligible() });
    const DB = makeVersionedDb(orphan());
    const out = await placeStake(DB.db, args({ smoke: true, allowDev: true }));
    expect(out.refusal).toEqual({ status: 409, error: 'no_pod', message: 'That pod is no longer available.' });
    expect(DB.writeLog).toEqual([]);
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`).status).toBe(POOL_STATUS.OPEN);
    // …while a NON-smoke caller on the same world still runs the close (§7), as on main.
    const DB2 = makeVersionedDb(orphan());
    const out2 = await placeStake(DB2.db, args());
    expect(out2.refusal?.error).toBe('no_pod');
    expect(DB2.writeLog.length).toBeGreaterThan(0);
  });

  it('refuses on the FRESH in-transaction read too — a pod whose dev flag vanished between the reads', async () => {
    const DB = makeVersionedDb(devWorld());
    // The cheap read sees a dev pod; the transaction's read sees a production one.
    const realGet = DB.db.collection('tournamentGroups').doc(GROUP_ID).get;
    let reads = 0;
    const groupRef = DB.db.collection('tournamentGroups').doc(GROUP_ID);
    const flip = async () => {
      reads += 1;
      if (reads === 1) DB.store.set(`tournamentGroups/${GROUP_ID}`, group());
      return realGet();
    };
    const origCollection = DB.db.collection;
    DB.db.collection = (name) => {
      const col = origCollection(name);
      if (name !== 'tournamentGroups') return col;
      return { ...col, doc: (id) => (id === GROUP_ID ? { ...groupRef, get: flip } : col.doc(id)) };
    };
    const out = await placeStake(DB.db, args({ smoke: true, allowDev: true }));
    // The same answer as the cheap read's, message included (WIRE-2).
    expect(out.refusal).toEqual({ status: 409, error: SMOKE_REQUIRES_DEV, message: 'A smoke session backs dev pods only.' });
    expect(stakeWrites(DB.writeLog)).toEqual([]);
  });

  it('a smoke stake on a DEV pod lands — in the dev wallet, at the dev pool, with `poolId: dev-{groupId}` on the document', async () => {
    const DB = makeVersionedDb(devWorld());
    const out = await placeStake(DB.db, args({ smoke: true, allowDev: true }));
    expect(out.refusal).toBeUndefined();
    expect(out.stake.poolId).toBe(`dev-${GROUP_ID}`);
    expect(stakeDoc(DB.store).poolId).toBe(`dev-${GROUP_ID}`);
    expect(DB.store.get(`backingWallets/dev-${UID}`).careerNet).toBe(-100);
    expect(DB.store.has(`backingWallets/${UID}`)).toBe(false);
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}/private/totals`).potTotal).toBe(100);
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`)).toBe(false);
  });

  it('a NON-smoke caller is unchanged: the production pod stakes, the dev flag is not consulted', async () => {
    const DB = makeVersionedDb(production());
    const out = await placeStake(DB.db, args());
    expect(out.refusal).toBeUndefined();
    expect(stakeDoc(DB.store).poolId).toBe(GROUP_ID);
    expect(DB.store.get(`backingWallets/${UID}`).careerNet).toBe(-100);
  });
});

describe('`allowDev` — the dev opt-in for materialization', () => {
  it('opens a dev pod\'s pool at `dev-{groupId}` when passed; refuses `dev_pod` when not', async () => {
    const world = { [`tournamentGroups/${GROUP_ID}`]: group({ isDev: true }), ...eligible() };
    const refused = await placeStake(makeVersionedDb(world).db, args({ smoke: true }));
    expect(refused.refusal).toMatchObject({ status: 409, error: 'no_pool', reason: 'dev_pod' });
    const DB = makeVersionedDb(world);
    const out = await placeStake(DB.db, args({ smoke: true, allowDev: true }));
    expect(out.refusal).toBeUndefined();
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}`).status).toBe('open');
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`)).toBe(false);
  });

  it('never opens a PRODUCTION pool for a smoke session, allowDev or not', async () => {
    const world = { [`tournamentGroups/${GROUP_ID}`]: group(), ...eligible() };
    const DB = makeVersionedDb(world);
    const out = await placeStake(DB.db, args({ smoke: true, allowDev: true }));
    expect(out.refusal?.error).toBe(SMOKE_REQUIRES_DEV);
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`)).toBe(false);
  });
});

describe('`poolId` on the stake document', () => {
  it('a top-up carries the document\'s own poolId through, and Σ debits = amount', async () => {
    const DB = makeVersionedDb(devWorld());
    await placeStake(DB.db, args({ smoke: true, allowDev: true }));
    const out = await placeStake(DB.db, args({ smoke: true, allowDev: true, requestId: 'req-2', amount: 150 }));
    expect(out.topUp).toBe(true);
    const doc = stakeDoc(DB.store);
    expect(doc.poolId).toBe(`dev-${GROUP_ID}`);
    expect(doc.amount).toBe(250);
    expect(doc.debits.map((d) => d.amount)).toEqual([100, 150]);
  });
});

describe('the eligibility check and the argument belt', () => {
  it('the ROUTE never passes its own checker — the real `checkBackingEligibility` is the default', () => {
    const route = readFileSync(path.join(REPO, 'api/tournament/backing-stake.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(route).toContain('placeStake(db, {');
    expect(route).not.toContain('checkEligibility');
    const prim = readFileSync(path.join(REPO, 'api/_utils/backingStake.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(prim).toContain('checkEligibility = checkBackingEligibility');
  });

  it('a caller-supplied checker is consulted INSIDE the transaction with the fresh group, and its refusal is a 403', async () => {
    const DB = makeVersionedDb(devWorld());
    const seen = [];
    const out = await placeStake(DB.db, args({
      smoke: true, allowDev: true,
      checkEligibility: async (_db, a) => { seen.push(a); return { allowed: false, reason: 'synthetic_says_no' }; },
    }));
    expect(out.refusal).toEqual({ status: 403, error: 'synthetic_says_no' });
    expect(seen).toHaveLength(1);
    expect(seen[0].group.id).toBe(GROUP_ID);
    expect(seen[0].uid).toBe(UID);
    expect(stakeWrites(DB.writeLog)).toEqual([]);
  });

  it('refuses malformed arguments as typed 400s, before any read', async () => {
    const DB = makeVersionedDb(devWorld());
    for (const [over, code] of [
      [{ uid: '' }, 'invalid_uid'],
      [{ groupId: 'a/b' }, 'invalid_group_id'],
      [{ teamOdUserId: 42 }, 'invalid_team'],
      [{ amount: 100.5 }, 'invalid_amount'],
      [{ amount: 49 }, 'below_min_stake'],
      [{ amount: 501 }, 'above_team_cap'],
      [{ requestId: '' }, 'invalid_request_id'],
      [{ requestId: 'x'.repeat(MAX_REQUEST_ID_LEN + 1) }, 'invalid_request_id'],
      [{ now: 'not a date' }, 'invalid_now'],
    ]) {
      await expect(placeStake(DB.db, args(over)), JSON.stringify(over)).rejects.toMatchObject({ name: 'StakeRefusal', statusCode: 400, code });
    }
    expect(DB.writeLog).toEqual([]);
    expect(new StakeRefusal(409, 'x', { a: 1 })).toMatchObject({ statusCode: 409, code: 'x', payload: { a: 1 } });
  });
});
