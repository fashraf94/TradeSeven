// api/tournament/backing-stake.topup.test.js
//
// D-ag (Amendment C §C2) — ONE STAKE PER TEAM PER BACKER; A REPEAT TOPS UP.
// POST /api/tournament/backing-stake against the shared VERSIONED harness
// (api/_utils/__fixtures__/versionedFirestore.js — an optimistic-concurrency
// simulator: a transaction re-runs when a document it read has moved, on ONE
// transaction object, as the SDK does), and — for the ledger rows — through the
// REAL close, settlement and refund primitives, so "net BP per §2 unchanged"
// is measured on the money path itself, not on a model of it.
//
// THE ROWS THE BUILD PROMPT NAMES, and the mutation each is the guard for:
//   · the first stake; a top-up within the cap (ONE document — mutation 1:
//     "create a second document instead of topping up" reds it);
//   · a top-up breaching the cap: refused, nothing written (mutation 3:
//     "check the cap against the top-up amount only" reds it);
//   · two racing top-ups serialize and the cap holds;
//   · a replayed `requestId` of a top-up is a no-op;
//   · the ledger sum and the net-BP sum across stake → top-up → settle (win
//     and loss) → refund (mutation 2: "reuse one ledger entry id for two
//     top-ups" reds it);
//   · the maximum stake count of a pool is (eligible backers × teams).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's, the pool module's and
// the settlement primitive's real imports below are the runtime guards for
// their api/ -> src/ imports. Never mock the constants.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ uid: 'backer-x' }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => ({ uid: state.uid, firebase: { sign_in_provider: 'password' } }),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  BACKING_BETA_ENABLED: true,
  TOURNAMENT_ADVANCEMENT_FROZEN: false,
}));

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeVersionedDb } = await import('../_utils/__fixtures__/versionedFirestore.js');
const { default: handler, stakeIdFor, stakeDebitKeyFor } = await import('./backing-stake.js');
const { BACKING_WALLETS_COLLECTION, ENTRY_TYPES, stakeEntryIdFor } = await import('../_utils/backingWallet.js');
const { BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS, VOID_REASONS, closePool } = await import('../_utils/backingPools.js');
const { SETTLEMENT_SOURCE, refundPool, settlePool } = await import('../_utils/backingSettlement.js');
const { ALLOWANCE_BP, PER_TEAM_CAP_BP, VALIDITY_MIN_BACKERS } = await import('../../src/constants/backing.js');
const { TERMS_VERSION } = await import('../../src/constants/eligibility.js');

// ==================== THE WORLD ====================
const GROUP_ID = 'grp-topup';
const WEEK = '2026-W40';
const MONDAY = '2026-09-28';
const NOW = new Date('2026-09-22T14:00:00.000Z');     // Tue of the backing week
const X = 'backer-x';
const Y = 'backer-y';
const Z = 'backer-z';
const BACKERS = [X, Y, Z];
const TEAMS = ['od-a', 'od-b', 'cpu-1'];

const players = () => [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }];

function world() {
  const out = {
    [`tournamentGroups/${GROUP_ID}`]: {
      status: 'forming', isLiveDraft: false, baseLayerWeek: WEEK, createdAt: '2026-09-22T13:00:00.000Z',
      players: players(), groupMembers: players().map((p) => p.odUserId),
    },
    [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]: {
      groupId: GROUP_ID, status: POOL_STATUS.OPEN, formationPath: 'lobby', slotId: null, battleMondayEtDate: MONDAY,
      backingWeekStart: '2026-09-21T04:00:00.000Z', opensAt: '2026-09-22T13:00:00.000Z', closesAt: '2026-09-28T03:59:59.000Z',
      closeReason: 'clock', baseLayerWeek: WEEK, isDev: false,
      backerProgress: { count: 0, floor: VALIDITY_MIN_BACKERS, met: false }, teamSpread: { met: false },
      createdAt: '2026-09-22T13:00:00.000Z', updatedAt: '2026-09-22T13:00:00.000Z',
    },
  };
  for (const uid of BACKERS) {
    out[`eligibility/${uid}`] = { adultAttestedAt: '2026-09-14T13:30:00.000Z', termsVersion: TERMS_VERSION, acceptedAt: '2026-09-14T13:30:00.000Z', source: 'backing_beta' };
    out[`agentBattles/done-${uid}`] = { ownerId: uid, status: 'completed', completedAt: '2026-09-01T20:00:00.000Z' };
  }
  return out;
}

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
async function stakeAs(uid, requestId, teamOdUserId, amount) {
  state.uid = uid;
  const res = mkRes();
  await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'topup' }, body: { groupId: GROUP_ID, teamOdUserId, amount, requestId } }, res);
  return res;
}

const SID = (uid, team) => stakeIdFor(uid, GROUP_ID, team);
const ENTRY = (uid, requestId) => stakeEntryIdFor(stakeDebitKeyFor(uid, requestId));
const doc = (path) => DB.store.get(path);
const stakeDocsOfPool = () => [...DB.store.entries()]
  .filter(([p, d]) => p.startsWith(`${BACKING_STAKES_COLLECTION}/`) && p.split('/').length === 2 && d.groupId === GROUP_ID)
  .map(([p, d]) => ({ id: p.split('/')[1], ...d }));
const totals = () => doc(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}/private/totals`);
const wallet = (uid) => doc(`${BACKING_WALLETS_COLLECTION}/${uid}`);
const entriesOf = (uid) => [...DB.store.entries()]
  .filter(([p]) => p.startsWith(`${BACKING_WALLETS_COLLECTION}/${uid}/entries/`))
  .map(([p, d]) => ({ id: p.split('/').pop(), ...d }));

/**
 * THE LEDGER AGREES (§6 ledger-first; the backingWallet.test.js re-fold): every
 * cached figure on the wallet equals the Σ of the entries it caches, AND the
 * stake entries are exactly the stake DOCUMENTS' amounts — so net BP per §2
 * (Σ payouts + Σ refunds − Σ stakes) reads the same off the ledger, the wallet
 * cache and the documents settlement and the refund read.
 */
function assertLedger(uid) {
  const w = wallet(uid);
  const entries = entriesOf(uid);
  const sum = (types, pred = () => true) => entries.filter((e) => types.includes(e.type) && pred(e)).reduce((s, e) => s + e.delta, 0);
  expect(w.allowanceRemaining, `${uid}: allowanceRemaining ≠ Σ this week's entries`)
    .toBe(sum([ENTRY_TYPES.ALLOWANCE, ENTRY_TYPES.STAKE, ENTRY_TYPES.EXPIRY], (e) => e.weekKey === w.lastAllowanceWeek));
  expect(w.careerNet, `${uid}: careerNet ≠ Σ stakes + payouts + refunds`)
    .toBe(sum([ENTRY_TYPES.STAKE, ENTRY_TYPES.PAYOUT, ENTRY_TYPES.REFUND]));
  const months = new Set(entries.map((e) => e.monthKey).filter(Boolean));
  for (const m of months) {
    expect(w.seasons?.[m]?.net, `${uid}: seasons.${m}.net ≠ Σ its entries`)
      .toBe(sum([ENTRY_TYPES.PAYOUT, ENTRY_TYPES.REFUND, ENTRY_TYPES.LOSS], (e) => e.monthKey === m));
  }
  // The debits ARE the documents: Σ stake entries = −Σ this backer's stake amounts.
  const mine = stakeDocsOfPool().filter((s) => s.userId === uid);
  expect(sum([ENTRY_TYPES.STAKE]), `${uid}: Σ stake entries ≠ −Σ stake documents`)
    .toBe(-mine.reduce((s, d) => s + d.amount, 0));
  for (const d of mine) {
    expect(d.debits.reduce((s, x) => s + x.amount, 0), `${d.id}: Σ debits ≠ amount`).toBe(d.amount);
    for (const x of d.debits) expect(entries.find((e) => e.id === x.entryId)?.delta, `${x.entryId} is not on the ledger`).toBe(-x.amount);
  }
  // §2's Net BP, from the documents and the credits: Σ payouts + Σ refunds − Σ stakes.
  const payouts = sum([ENTRY_TYPES.PAYOUT]);
  const refunds = sum([ENTRY_TYPES.REFUND]);
  const staked = mine.reduce((s, d) => s + d.amount, 0);
  expect(w.careerNet, `${uid}: net BP ≠ Σ payouts + Σ refunds − Σ stakes`).toBe(payouts + refunds - staked);
  return { entries, mine };
}

beforeEach(() => {
  state.uid = X;
  process.env.BACKING_FINGERPRINT_SALT = 'topup-salt';
  DB = makeVersionedDb(world());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.BACKING_FINGERPRINT_SALT;
});

// ============================================================================
describe('the first stake, and a top-up within the cap — ONE document per team (§C2)', () => {
  it('the first stake is one document with one debit and one ledger entry', async () => {
    const res = await stakeAs(X, 'req-1', 'od-a', 100);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ replay: false, topUp: false, added: 100, stake: { id: SID(X, 'od-a'), amount: 100 } });
    expect(stakeDocsOfPool()).toHaveLength(1);
    expect(stakeDocsOfPool()[0].debits).toEqual([{ entryId: ENTRY(X, 'req-1'), amount: 100, at: NOW.toISOString() }]);
    assertLedger(X);
  });

  it('ONE-PER-TEAM: backing the same team again TOPS UP that document — the total, a second debit, a second entry; never a second document', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    vi.setSystemTime(new Date('2026-09-23T14:00:00.000Z'));
    const res = await stakeAs(X, 'req-2', 'od-a', 150);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ replay: false, topUp: true, added: 150, stake: { id: SID(X, 'od-a'), amount: 250 } });
    const docs = stakeDocsOfPool();
    expect(docs, 'a top-up created a second stake document').toHaveLength(1);
    expect(docs[0]).toMatchObject({
      userId: X, teamOdUserId: 'od-a', amount: 250, status: STAKE_STATUS.LIVE,
      // The FIRST placement stays the document's.
      placedAt: NOW.toISOString(), requestId: 'req-1',
    });
    expect(docs[0].debits.map((d) => [d.entryId, d.amount])).toEqual([[ENTRY(X, 'req-1'), 100], [ENTRY(X, 'req-2'), 150]]);
    const { entries } = assertLedger(X);
    expect(entries.filter((e) => e.type === ENTRY_TYPES.STAKE).map((e) => e.ref)).toEqual([SID(X, 'od-a'), SID(X, 'od-a')]);
    expect(wallet(X)).toMatchObject({ allowanceRemaining: ALLOWANCE_BP - 250, careerNet: -250 });
  });

  it('a top-up moves the TOTALS and nothing else: never the unique-backer count, never teams-backed, never the team\'s backer count', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    await stakeAs(Y, 'req-y', 'od-b', 100);
    const publicBefore = structuredClone(doc(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`));
    const before = structuredClone(totals());
    DB.writeLog.length = 0;
    await stakeAs(X, 'req-2', 'od-a', 150);
    const after = totals();
    expect(after.potTotal).toBe(before.potTotal + 150);
    expect(after.uniqueBackers).toBe(before.uniqueBackers);
    expect(after.teamsBacked).toBe(before.teamsBacked);
    expect(after.byTeam['od-a']).toEqual({ stakeTotal: 250, backerCount: 1 });
    expect(after.backers[X]).toEqual({ total: 250, byTeam: { 'od-a': 250 } });   // the backer's per-team count: one team
    // The capped public pair (Amendment B) did not move — so it was not written at all.
    expect(doc(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`)).toEqual(publicBefore);
    expect(DB.writeLog.map(([, p]) => p)).not.toContain(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`);
  });

  it('stake_confirmed records each request once, and says whether it opened the stake or topped it up', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    await stakeAs(X, 'req-2', 'od-a', 150);
    const confirm = (requestId) => doc(`backingEvents/stake_confirmed:${stakeDebitKeyFor(X, requestId)}`);
    expect(confirm('req-1').props).toMatchObject({ stakeId: SID(X, 'od-a'), amount: 100, topUp: false });
    expect(confirm('req-2').props).toMatchObject({ stakeId: SID(X, 'od-a'), amount: 150, topUp: true });
  });

  it('hedging across teams is still allowed: another team is another document', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    await stakeAs(X, 'req-2', 'od-b', 100);
    expect(stakeDocsOfPool().map((d) => d.teamOdUserId).sort()).toEqual(['od-a', 'od-b']);
    expect(totals().backers[X]).toEqual({ total: 200, byTeam: { 'od-a': 100, 'od-b': 100 } });
    assertLedger(X);
  });
});

// ============================================================================
describe('the per-team cap is checked against the NEW TOTAL', () => {
  it('CAP: a top-up that would take the team past the cap is REFUSED, and nothing is written', async () => {
    await stakeAs(X, 'req-1', 'od-a', 250);
    const snapshot = structuredClone([...DB.store.entries()]);
    DB.writeLog.length = 0;
    const res = await stakeAs(X, 'req-2', 'od-a', 300);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'per_team_cap', staked: 250, cap: PER_TEAM_CAP_BP });
    expect(DB.writeLog.filter(([kind]) => kind === 'tx.set')).toEqual([]);
    expect([...DB.store.entries()]).toEqual(snapshot);
  });

  it('a top-up that lands EXACTLY on the cap is admitted; the next 50 is not', async () => {
    await stakeAs(X, 'req-1', 'od-a', 250);
    expect((await stakeAs(X, 'req-2', 'od-a', PER_TEAM_CAP_BP - 250)).statusCode).toBe(200);
    expect(doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`).amount).toBe(PER_TEAM_CAP_BP);
    expect((await stakeAs(X, 'req-3', 'od-a', 50)).body.error).toBe('per_team_cap');
    assertLedger(X);
  });

  it('TWO RACING TOP-UPS serialize: exactly one lands when both cannot, and the cap holds', async () => {
    await stakeAs(X, 'req-1', 'od-a', 300);
    const conflictsBefore = DB.stats.conflicts;
    const [a, b] = await Promise.all([stakeAs(X, 'race-a', 'od-a', 150), stakeAs(X, 'race-b', 'od-a', 150)]);
    expect(DB.stats.conflicts).toBeGreaterThan(conflictsBefore);   // they really contended
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect([a, b].find((r) => r.statusCode === 409).body.error).toBe('per_team_cap');
    const stake = doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`);
    expect(stake.amount).toBe(450);
    expect(stake.debits).toHaveLength(2);
    assertLedger(X);
  });

  it('two racing top-ups that BOTH fit both land — serialized, never one written over the other', async () => {
    await stakeAs(X, 'req-1', 'od-a', 300);
    const [a, b] = await Promise.all([stakeAs(X, 'race-a', 'od-a', 100), stakeAs(X, 'race-b', 'od-a', 100)]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const stake = doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`);
    expect(stake.amount).toBe(500);
    expect(stake.debits).toHaveLength(3);
    expect(totals().byTeam['od-a']).toEqual({ stakeTotal: 500, backerCount: 1 });
    assertLedger(X);
  });
});

// ============================================================================
describe('a replayed requestId of a top-up is a no-op', () => {
  it('the top-up replayed answers the stake as it stands, says it was a top-up, and writes nothing', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    const first = await stakeAs(X, 'req-2', 'od-a', 150);
    const writes = DB.writeLog.length;
    const events = [...DB.store.keys()].filter((k) => k.startsWith('backingEvents/')).length;
    const replay = await stakeAs(X, 'req-2', 'od-a', 150);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toMatchObject({ replay: true, topUp: true, added: 150 });
    expect(replay.body.stake).toEqual(first.body.stake);
    expect(DB.writeLog.length).toBe(writes);
    expect([...DB.store.keys()].filter((k) => k.startsWith('backingEvents/')).length).toBe(events);
    expect(doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`).amount).toBe(250);
    assertLedger(X);
  });

  it('the FIRST request replayed after a top-up is a no-op too — and says it opened the stake', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    await stakeAs(X, 'req-2', 'od-a', 150);
    const replay = await stakeAs(X, 'req-1', 'od-a', 100);
    expect(replay.body).toMatchObject({ replay: true, topUp: false, added: 100, stake: { amount: 250 } });
  });

  it('two SIMULTANEOUS submissions of one top-up are ONE debit', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    const [a, b] = await Promise.all([stakeAs(X, 'req-2', 'od-a', 150), stakeAs(X, 'req-2', 'od-a', 150)]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect([a.body.replay, b.body.replay].filter(Boolean)).toHaveLength(1);
    expect(doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`).amount).toBe(250);
    assertLedger(X);
  });

  it('a top-up requestId reused for ANOTHER team, or another amount, is refused — never a silent substitution', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    await stakeAs(X, 'req-2', 'od-a', 150);
    expect((await stakeAs(X, 'req-2', 'od-b', 150)).body.error).toBe('request_id_conflict');
    expect((await stakeAs(X, 'req-2', 'od-a', 200)).body.error).toBe('request_id_conflict');
    expect(stakeDocsOfPool()).toHaveLength(1);
    assertLedger(X);
  });

  it('a stake that is no longer live is not topped up', async () => {
    await stakeAs(X, 'req-1', 'od-a', 100);
    const path = `${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`;
    DB.store.set(path, { ...doc(path), status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.ADMIN });
    const res = await stakeAs(X, 'req-2', 'od-a', 100);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('stake_not_live');
    expect(doc(path).amount).toBe(100);
  });
});

// ============================================================================
describe('LEDGER — Σ entries = the cached balance, and net BP per §2, across stake → top-up → settle (win, loss) → refund', () => {
  const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
  /**
   * The book: X 100 then TWO top-ups (100, 50) on od-a; Z 100 on od-a; Y 200
   * on od-b — pot 550, 3 backers, 2 teams. Two top-ups, not one: a ledger
   * entry id SHARED by two top-ups (mutation check 2) is only visible once a
   * second top-up lands on the same stake.
   */
  async function book() {
    expect((await stakeAs(X, 'x-1', 'od-a', 100)).statusCode).toBe(200);
    expect((await stakeAs(Y, 'y-1', 'od-b', 200)).statusCode).toBe(200);
    expect((await stakeAs(Z, 'z-1', 'od-a', 100)).statusCode).toBe(200);
    for (const uid of BACKERS) assertLedger(uid);
    for (const [requestId, amount] of [['x-2', 100], ['x-3', 50]]) {
      const topUp = await stakeAs(X, requestId, 'od-a', amount);
      expect(topUp.statusCode, `the top-up ${requestId} must land`).toBe(200);
      expect(topUp.body).toMatchObject({ topUp: true, added: amount });
      for (const uid of BACKERS) assertLedger(uid);
    }
    expect(doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`).debits.map((d) => d.amount)).toEqual([100, 100, 50]);
    expect(totals()).toMatchObject({ potTotal: 550, uniqueBackers: 3, teamsBacked: 2 });
  }
  async function close() {
    const g = { id: GROUP_ID, ...doc(`tournamentGroups/${GROUP_ID}`) };
    const closed = await closePool(DB.db, g, new Date('2026-09-28T04:00:00.000Z'));
    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED });
    for (const uid of BACKERS) assertLedger(uid);
  }
  function complete(winner) {
    const final = { 'od-a': winner === 'od-a' ? [60, 30] : [10, 5], 'od-b': winner === 'od-b' ? [60, 30] : [10, 5], 'cpu-1': [20, 10] };
    const dailyScores = {};
    DAYS.forEach((recordedDate, i) => {
      const closeScores = {};
      for (const [id, [user, agent]] of Object.entries(final)) closeScores[id] = { totalPoints: user, agentPoints: agent, compositePoints: agent + 1.5 * user, picks: [] };
      dailyScores[`day${i + 1}`] = { recordedDate, closeScores };
    });
    const path = `tournamentGroups/${GROUP_ID}`;
    DB.store.set(path, { ...doc(path), status: 'complete', dailyScores });
  }

  it('WIN: the topped-up stake is paid on its TOTAL; every wallet agrees with its ledger; net BP = Σ payouts + Σ refunds − Σ stakes', async () => {
    await book();
    await close();
    complete('od-a');
    const out = await settlePool(DB.db, GROUP_ID, { now: new Date('2026-10-02T22:00:00.000Z'), source: SETTLEMENT_SOURCE.ADMIN });
    expect(out).toMatchObject({ settled: true });
    // floor(250 × 550 ÷ 350) = 392 — the document's final amount, one payout.
    expect(doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`)).toMatchObject({ status: STAKE_STATUS.WON, amount: 250, payout: 392 });
    for (const uid of BACKERS) assertLedger(uid);
    expect(wallet(X).careerNet).toBe(392 - 250);
    expect(wallet(X).seasons['2026-09'].net).toBe(392 - 250);
    expect(wallet(Y).careerNet).toBe(-200);
  });

  it('LOSS: the topped-up stake loses its TOTAL, once; every wallet agrees with its ledger', async () => {
    await book();
    await close();
    complete('od-b');
    expect(await settlePool(DB.db, GROUP_ID, { now: new Date('2026-10-02T22:00:00.000Z'), source: SETTLEMENT_SOURCE.ADMIN })).toMatchObject({ settled: true });
    expect(doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`)).toMatchObject({ status: STAKE_STATUS.LOST, amount: 250 });
    for (const uid of BACKERS) assertLedger(uid);
    expect(wallet(X).careerNet).toBe(-250);
    expect(wallet(X).seasons['2026-09'].net).toBe(-250);
    expect(entriesOf(X).filter((e) => e.type === ENTRY_TYPES.LOSS)).toHaveLength(1);
  });

  it('REFUND: the topped-up stake is refunded in full, score-neutral in BOTH records; every wallet agrees with its ledger', async () => {
    await book();
    await close();
    const path = `tournamentGroups/${GROUP_ID}`;
    DB.store.set(path, { ...doc(path), status: 'voided' });
    const out = await refundPool(DB.db, GROUP_ID, { now: new Date('2026-09-30T15:00:00.000Z'), reason: VOID_REASONS.GROUP_VOIDED, source: SETTLEMENT_SOURCE.ADMIN });
    expect(out).toMatchObject({ refunded: true });
    expect(doc(`${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`)).toMatchObject({ status: STAKE_STATUS.VOIDED, amount: 250 });
    for (const uid of BACKERS) assertLedger(uid);
    for (const uid of BACKERS) expect(wallet(uid).careerNet, uid).toBe(0);
    expect(entriesOf(X).find((e) => e.type === ENTRY_TYPES.REFUND)?.delta).toBe(250);
  });
});

// ============================================================================
describe('this build\'s review record — MONEY-3, MONEY-4, MONEY-5', () => {
  const txSets = () => DB.writeLog.filter(([k]) => k === 'tx.set');

  it('MONEY-4: a requestId spent in a PRIOR week, reused this week → 409 and NOTHING committed — the refusal returns before the week\'s grant is buffered', async () => {
    DB = makeVersionedDb(world());
    const wPath = `${BACKING_WALLETS_COLLECTION}/${X}`;
    const spent = ENTRY(X, 'r-old');
    const w0 = { lastAllowanceWeek: '2026-W39', allowanceRemaining: 700, careerNet: -300, seasons: {}, appliedEntries: { 'allowance:2026-W39': 'x', [spent]: 'x' }, createdAt: 'x' };
    DB.store.set(wPath, w0);
    DB.store.set(`${wPath}/entries/allowance:2026-W39`, { type: 'allowance', delta: 1000, ref: '2026-W39', weekKey: '2026-W39', at: 'x' });
    DB.store.set(`${wPath}/entries/${spent}`, { type: 'stake', delta: -300, ref: 'stk_somewhere_else', weekKey: '2026-W39', at: 'x' });
    DB.writeLog.length = 0;
    const res = await stakeAs(X, 'r-old', 'od-a', 100);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'request_id_conflict' });
    // A RETURNED refusal commits whatever was buffered before it — here, had
    // the ledger pre-check sat below `ensureAllowance`, last week's expiry,
    // this week's grant and the re-keyed wallet. Nothing may be.
    expect(txSets()).toEqual([]);
    expect(doc(wPath)).toEqual(w0);
  });

  it('MONEY-5: the cap counts the document being topped up even when the week query cannot see it (an out-of-band drift) — refused, nothing written', async () => {
    DB = makeVersionedDb(world());
    expect((await stakeAs(X, 'x-1', 'od-a', 400)).statusCode).toBe(200);
    const path = `${BACKING_STAKES_COLLECTION}/${SID(X, 'od-a')}`;
    DB.store.set(path, { ...doc(path), weekKey: '2026-W39' });           // out of band: outside the (userId, weekKey) query
    DB.writeLog.length = 0;
    const res = await stakeAs(X, 'x-2', 'od-a', 400);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'per_team_cap', staked: 400, cap: PER_TEAM_CAP_BP });
    expect(doc(path).amount).toBe(400);
    expect(txSets()).toEqual([]);
  });

  it('MONEY-3: a requestId spent on a production pod and reused on a DEV pod never overwrites the production confirmation — the dev one is namespaced', async () => {
    const DEV_GROUP = 'grp-topup-dev';
    const base = world();
    DB = makeVersionedDb({
      ...base,
      [`tournamentGroups/${DEV_GROUP}`]: { ...base[`tournamentGroups/${GROUP_ID}`], isDev: true },
      [`${BACKING_POOLS_COLLECTION}/dev-${DEV_GROUP}`]: { ...base[`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`], groupId: DEV_GROUP, isDev: true },
    });
    const debitKey = stakeDebitKeyFor(X, 'r1');
    expect((await stakeAs(X, 'r1', 'od-a', 100)).statusCode).toBe(200);
    const prodEvent = structuredClone(doc(`backingEvents/stake_confirmed:${debitKey}`));
    expect(prodEvent.props).toMatchObject({ amount: 100, teamOdUserId: 'od-a', isDev: false });

    state.uid = X;
    const res = mkRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'topup' }, body: { groupId: DEV_GROUP, teamOdUserId: 'od-b', amount: 150, requestId: 'r1' } }, res);
    expect(res.statusCode).toBe(200);                                     // a separate ledger (the dev wallet)
    expect(doc(`backingEvents/stake_confirmed:${debitKey}`)).toEqual(prodEvent);
    expect(doc(`backingEvents/stake_confirmed:dev:${debitKey}`).props).toMatchObject({ amount: 150, teamOdUserId: 'od-b', isDev: true });
    expect(doc(`${BACKING_WALLETS_COLLECTION}/${X}`).careerNet).toBe(-100);
    expect(doc(`${BACKING_WALLETS_COLLECTION}/dev-${X}`).careerNet).toBe(-150);
  });
});

// ============================================================================
describe('the maximum stake count of a pool is (eligible backers × teams) — by construction', () => {
  it('three backers, each backing all three teams three times over: nine documents, never more', async () => {
    let n = 0;
    for (const uid of BACKERS) {
      for (const team of TEAMS) {
        for (let k = 0; k < 3; k += 1) {
          const res = await stakeAs(uid, `r-${n += 1}`, team, 50);
          expect(res.statusCode, `${uid} ${team} #${k}`).toBe(200);
        }
      }
    }
    const docs = stakeDocsOfPool();
    expect(docs).toHaveLength(BACKERS.length * TEAMS.length);
    expect(docs.every((d) => d.amount === 150 && d.debits.length === 3)).toBe(true);
    expect(totals()).toMatchObject({ potTotal: 27 * 50, uniqueBackers: 3, teamsBacked: 3 });
    for (const team of TEAMS) expect(totals().byTeam[team]).toEqual({ stakeTotal: 450, backerCount: 3 });
    for (const uid of BACKERS) assertLedger(uid);
  });
});
