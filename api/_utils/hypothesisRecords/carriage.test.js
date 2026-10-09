// api/_utils/hypothesisRecords/carriage.test.js
//
// Pilot P1b — DEPLOY CARRIAGE, the units (acceptance rows 2–5, 8; founder
// rulings B2, B3, B5, B6):
//   · RESOLUTION (B2): newest ready over an older activated; a reaffirmed
//     successor; due with nothing ready → the refusal, verbatim; drafts or
//     terminal statuses only → nothing; the gate, the pin, a read failure, a
//     corrupt record and a foreign record — and ONE bounded read.
//   · ACTIVATION in the REAL creation transaction (createAgentBattle →
//     commitBattleDocWithPin): ready → activated once with the row armed; a
//     redeploy keeps the clock and re-arms with the new battle (B6); an
//     `unspecified` horizon arms a battle-end row; `calendar_unavailable`
//     marks the version and still deploys (B5).
//   · THE RACE (acceptance row 5): every fresh read that disagrees throws the
//     typed error — no battle, no version change, no row — including a
//     competing commit landing between the body and the commit.
//   · THE WRITER (the fenced createAgentBattle): exactly the eleven keys, only
//     beside a non-null snapshot, never on a tournament battle, never inside
//     the snapshot or the manifest hash.
//   · PROVENANCE (acceptance row 8): a carried battle's calls get the
//     versioned ref; a sibling–snapshot mismatch is provenance_unresolved.
//   · THE FROZEN LIST (B3): the Forge's [LIST] / one-ticker [SYM] source.
//
// The store is the general optimistic double (callsFirestore.js — buffered
// writes discarded on a throw, a moved read re-runs the body) with the deploy
// harness's auto-ids. Dependency-surface guard (BUILD_RULES §4): carriage.js,
// the battle writer and src/constants/hypothesisRecords.js are imported for
// real — never mock them.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stored } from '../__fixtures__/callsFirestore.js';
import { makeDeployDb } from '../__fixtures__/deployHarness.js';

const state = vi.hoisted(() => ({ flag: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});

const C = await import('./carriage.js');
const { createAgentBattle } = await import('../agentBattleService.js');
const { commitBattleDocWithPin } = await import('../compositionGenerationFence.js');
const { buildVersionDoc, contentHashOf } = await import('./model.js');
const { computeReviewDueAt } = await import('./horizon.js');
const { resolveProvenance } = await import('../callRecords/candidate.js');
const { buildResolvedAgentManifest } = await import('../resolvedAgentManifest.js');
const { DUE_DEPLOY_LINE, CARRIAGE_RACE_MESSAGE, DEPLOY_REFUSAL_CODE } = await import('../../../src/constants/hypothesisRecords.js');

const OWNER = 'carry-owner-1';
const OTHER = 'carry-other-2';
const WL = 'wl-carry-1';
const NOW = '2026-10-13T15:00:00.000Z'; // Tue, 11:00 ET
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const LIT = Object.freeze({ dark: false, descriptor: null });
const DARK = Object.freeze({ dark: true, descriptor: null });

const vPath = (n, wl = WL) => `watchlists/${wl}/hypothesisVersions/v${n}`;
const rowPath = (n, wl = WL) => `hypothesisReviewQueue/${wl}:${n}`;
const cond = (symbol) => ({ symbol, side: 'above', level: 100, basis: 'daily_close' });

/** A stored version as buildVersionDoc writes it, with lifecycle overrides. */
function version(n, lifecycle = {}, content = {}) {
  return {
    ...buildVersionDoc({
      version: n, watchlistId: WL, userId: OWNER, opId: `op-${n}`, opFingerprint: 'f'.repeat(64), createdAt: '2026-10-01T14:00:00.000Z',
      content: {
        statement: `idea v${n}`, horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [],
        evidenceRefs: [], publishedAt: null, origin: 'manual', ...content,
      },
      status: 'ready', stateSource: 'player', stateReason: 'player_ready',
    }),
    ...lifecycle,
  };
}
const DEPLOYED = (battleId, due = '2026-10-19T20:00:00.000Z') => ({
  firstDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedAt: '2026-10-05T15:00:00.000Z', lastDeployedBattleId: battleId,
  reviewDueAt: due, stateSource: 'deploy', stateReason: 'deployed',
});
const list = (over = {}) => ({ watchlistId: WL, userId: OWNER, name: 'AI capex', status: 'committed', tickers: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], ...over });
const snapshot = (over = {}) => ({ watchlistId: WL, name: 'AI capex', tickers: ['NVDA', 'AMD'], ...over });

function seed(versions = [], extra = {}) {
  const docs = { [`watchlists/${WL}`]: list(), ...extra };
  for (const v of versions) docs[vPath(v.version, v.watchlistId)] = v;
  return makeDeployDb(docs);
}
const resolve = (db, over = {}) => C.resolveDeployCarriage(db, {
  ownerUid: OWNER, watchlistId: WL, watchlist: list(), snapshot: snapshot(), pin: LIT, ...over,
});

function agentData(over = {}) {
  return {
    id: 'agent-carry-1', ownerId: OWNER, name: 'Viper', archetype: 'momentum_chaser', activeRules: [], equippedBundleIds: [],
    lastDecision: {
      portfolio: {
        star: [{ symbol: 'AAPL', baseATR: 3 }, { symbol: 'MSFT', baseATR: 3 }],
        core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
        support: [{ symbol: 'JPM' }, { symbol: 'XOM' }, { symbol: 'BTC', isCrypto: true }],
      },
      bench: { stocks: [{ symbol: 'COST' }, { symbol: 'LLY' }, { symbol: 'UNH' }], crypto: { symbol: 'ETH', isCrypto: true } },
      strategyBrief: 'brief', innerMonologue: {},
      watchlist: { active: [], hotBench: [], monitoring: [], lastRefreshed: null, totalStocks: 0 },
    },
    ...over,
  };
}
/** Create a battle through the REAL writer and the REAL creation transaction. */
const deploy = (db, { sibling = null, snap = snapshot(), pin = LIT, over = {} } = {}) => createAgentBattle(db, agentData(), {}, {}, {
  equippedWatchlist: snap, ...(sibling ? { equippedHypothesis: sibling } : {}), activationPin: pin, ...over,
});
const battlesIn = (db) => [...db.__docs.keys()].filter((k) => /^agentBattles\/[^/]+$/.test(k));

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  state.flag = true;
  savedEnv = process.env[ENV];
  process.env[ENV] = `${OWNER},someone-else`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
describe('resolution — the gate and the preconditions read NOTHING when they say no', () => {
  it('gate off (flag false) → none, before any read', async () => {
    state.flag = false;
    const db = seed([version(1)]);
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'gate_off' });
    expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
  });
  it('gate off (flag true, the owner off the allowlist) → none, before any read', async () => {
    process.env[ENV] = 'someone-else';
    const db = seed([version(1)]);
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'gate_off' });
    expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
  });
  it('no frozen snapshot, a snapshot of ANOTHER list, or no list id → none, no read (carry-forward 3)', async () => {
    const db = seed([version(1)]);
    expect(await resolve(db, { snapshot: null })).toEqual({ outcome: 'none', reason: 'no_snapshot' });
    expect(await resolve(db, { snapshot: snapshot({ watchlistId: 'wl-other' }) })).toEqual({ outcome: 'none', reason: 'no_snapshot' });
    expect(await resolve(db, { watchlistId: null })).toEqual({ outcome: 'none', reason: 'no_snapshot' });
    expect(db.__access.queries).toEqual([]);
  });
  it('a list the owner does not own (or no list) → none, no read (attacker lens: an equip pointer is never authority)', async () => {
    const db = seed([version(1)]);
    expect(await resolve(db, { watchlist: list({ userId: OTHER }) })).toEqual({ outcome: 'none', reason: 'not_owner' });
    expect(await resolve(db, { watchlist: null })).toEqual({ outcome: 'none', reason: 'not_owner' });
    expect(db.__access.queries).toEqual([]);
  });
});

describe('resolution — B2: the newest ready/activated version carries; a due idea with nothing ready refuses; else nothing', () => {
  it('ONE read: the list\'s versions, newest first, bounded — the automatic single-field index the Forge already uses', async () => {
    const db = seed([version(1)]);
    await resolve(db);
    expect(db.__access.queries).toHaveLength(1);
    expect(db.__access.queries[0]).toMatchObject({
      collectionPath: `watchlists/${WL}/hypothesisVersions`, filters: [], orders: [{ field: 'version', dir: 'desc' }], limit: C.CARRIAGE_SCAN_LIMIT,
    });
    expect(C.CARRIAGE_SCAN_LIMIT).toBe(100);
  });
  it('newest READY over an older ACTIVATED → carries the ready one, as exactly the eleven sibling keys', async () => {
    const v2 = version(2, {}, { statement: 'the sharper idea', horizonEnum: 'positional', activation: [cond('NVDA')] });
    const db = seed([version(1, { status: 'activated', ...DEPLOYED('b-old') }), v2]);
    const out = await resolve(db);
    expect(out).toMatchObject({ outcome: 'carry', version: 2, status: 'ready' });
    expect(Object.keys(out.equippedHypothesis)).toEqual([...C.SIBLING_KEYS]);
    expect(out.equippedHypothesis).toEqual({
      watchlistId: WL, hypothesisVersion: 2, contentHash: v2.contentHash, statement: 'the sharper idea', horizonEnum: 'positional',
      horizonSource: 'player', activation: [cond('NVDA')], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual',
    });
    expect(contentHashOf(out.equippedHypothesis)).toBe(v2.contentHash);
  });
  it('newest ACTIVATED over an older ready → carries the activated one (a redeploy)', async () => {
    const db = seed([version(1), version(2, { status: 'activated', ...DEPLOYED('b-old') })]);
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', version: 2, status: 'activated' });
  });
  it('a REAFFIRMED successor deploys: v1 due (deployed), v2 ready by reaffirmation → v2, no re-equip', async () => {
    const db = seed([
      version(1, { status: 'review_due', ...DEPLOYED('b-old'), stateSource: 'review_pass', stateReason: 'horizon_elapsed', successorVersion: 2 }),
      version(2, { stateReason: 'reaffirmed' }),
    ]);
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', version: 2, status: 'ready' });
  });
  it('DUE with no ready successor → refuse: 409 { error: hypothesis_review_due, message: table C\'s due-deploy line, verbatim } — also with newer drafts (B4\'s case)', async () => {
    const due = version(1, { status: 'review_due', ...DEPLOYED('b-old'), stateSource: 'review_pass', stateReason: 'horizon_elapsed' });
    for (const newer of [[], [version(2, { status: 'draft' })], [version(2, { status: 'researched' }), version(3, { status: 'cancelled' })]]) {
      const db = seed([due, ...newer]);
      expect(await resolve(db)).toEqual({ outcome: 'refuse', status: 409, body: { error: DEPLOY_REFUSAL_CODE, message: DUE_DEPLOY_LINE }, version: 1 });
      expect(db.__access.writes).toEqual([]);
    }
    expect(DUE_DEPLOY_LINE).toBe('This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys.');
  });
  it('the refusal does not depend on the pin (deploy admission is a record rule; carriage alone needs the transaction)', async () => {
    const db = seed([version(1, { status: 'review_due', ...DEPLOYED('b-old') })]);
    expect(await resolve(db, { pin: DARK })).toMatchObject({ outcome: 'refuse' });
  });
  it('drafts or terminal statuses only → nothing (deploy exactly as today)', async () => {
    for (const status of ['draft', 'researched', 'waiting_for_evidence', 'rejected', 'cancelled', 'retired']) {
      const db = seed([version(1, { status }), version(2, { status: 'draft' })]);
      expect(await resolve(db), status).toEqual({ outcome: 'none', reason: 'nothing_carriable' });
    }
  });
  it('the NEWEST deployed version decides the refusal: invalidated or retired newest → nothing, even over an older due one', async () => {
    for (const status of ['invalidated', 'retired']) {
      const db = seed([
        version(1, { status: 'review_due', ...DEPLOYED('b-1') }),
        version(2, { status, ...DEPLOYED('b-2') }),
      ]);
      expect(await resolve(db), status).toEqual({ outcome: 'none', reason: 'nothing_carriable' });
    }
  });
  it('a dark pin (no creation transaction) carries nothing — carriage requires the transactional path', async () => {
    const db = seed([version(1)]);
    expect(await resolve(db, { pin: DARK })).toEqual({ outcome: 'none', reason: 'no_transaction' });
    expect(await resolve(db, { pin: null })).toEqual({ outcome: 'none', reason: 'no_transaction' });
  });
  it('a read failure degrades to nothing (a deploy is never broken by the record slice)', async () => {
    const db = seed([version(1)]);
    db.__hooks.failQuery = () => new Error('UNAVAILABLE');
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'read_failed' });
  });
  it('attacker lens: a CORRUPT newest ready version (its content no longer hashes to its contentHash) carries NOTHING — never an older stand-in', async () => {
    const tampered = { ...version(2), statement: 'swapped after the fact' };
    const db = seed([version(1), tampered]);
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'corrupt_version' });
  });
  it('attacker lens: a version written under the list for ANOTHER owner, or naming another list, is not a version of this idea', async () => {
    const foreign = { ...version(2, {}, { statement: 'not yours' }), userId: OTHER };
    foreign.contentHash = contentHashOf(foreign);
    const db = seed([version(1, { status: 'draft' }), foreign]);
    db.__docs.set(vPath(3), { ...version(3), watchlistId: 'wl-elsewhere' });
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'nothing_carriable' });
  });
  it('an activated version whose clock fields are malformed is not intact → nothing', async () => {
    const db = seed([version(1, { status: 'activated', ...DEPLOYED('b-old'), reviewDueAt: 'not a date' })]);
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'corrupt_version' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('activation — in the REAL creation transaction (createAgentBattle → commitBattleDocWithPin)', () => {
  it('ready → activated ONCE: the lifecycle stamps, the review row armed with the companion §6 due instant — all in the battle\'s own commit', async () => {
    const db = seed([version(1)]);
    const { equippedHypothesis } = await resolve(db);
    const before = stored(db, vPath(1));
    const { id } = await deploy(db, { sibling: equippedHypothesis });
    const dueAtMs = computeReviewDueAt('swing', Date.parse(NOW));
    expect(new Date(dueAtMs).toISOString()).toBe('2026-10-27T20:00:00.000Z'); // the 10th session after Tue 13 Oct closes Tue 27 Oct, 16:00 ET
    expect(stored(db, vPath(1))).toEqual({
      ...before, status: 'activated', stateChangedAt: NOW, stateSource: 'deploy', stateReason: 'deployed',
      firstDeployedAt: NOW, reviewDueAt: '2026-10-27T20:00:00.000Z', lastDeployedAt: NOW, lastDeployedBattleId: id,
    });
    expect(stored(db, rowPath(1))).toEqual({ userId: OWNER, watchlistId: WL, version: 1, battleId: id, dueAtMs, armedAt: Date.parse(NOW) });
    // One transaction committed the battle, the version and the row together.
    const writes = db.__access.writes.map((w) => `${w.op}:${w.path}`);
    expect(writes).toEqual([`create:agentBattles/${id}`, `update:${vPath(1)}`, `set:${rowPath(1)}`]);
    expect(stored(db, `agentBattles/${id}`).agentContext.equippedHypothesis).toEqual(equippedHypothesis);
  });
  it('B6 — redeploying an ACTIVE idea: no restamp (firstDeployedAt, reviewDueAt, status, reason stay); lastDeployed* move; the row is re-armed with the SAME dueAtMs and the NEW battle', async () => {
    const db = seed([version(1)]);
    const first = await deploy(db, { sibling: (await resolve(db)).equippedHypothesis });
    const afterFirst = stored(db, vPath(1));
    vi.setSystemTime(new Date('2026-10-15T15:00:00.000Z'));
    const again = await resolve(db);
    expect(again).toMatchObject({ outcome: 'carry', status: 'activated' });
    const second = await deploy(db, { sibling: again.equippedHypothesis });
    expect(second.id).not.toBe(first.id);
    expect(stored(db, vPath(1))).toEqual({ ...afterFirst, lastDeployedAt: '2026-10-15T15:00:00.000Z', lastDeployedBattleId: second.id });
    expect(stored(db, rowPath(1))).toEqual({
      userId: OWNER, watchlistId: WL, version: 1, battleId: second.id,
      dueAtMs: Date.parse(afterFirst.reviewDueAt), armedAt: Date.parse('2026-10-15T15:00:00.000Z'),
    });
  });
  it('an UNSPECIFIED horizon runs no clock: reviewDueAt null and a battle-end row (dueAtMs null); no fault marker', async () => {
    const db = seed([version(1, {}, { horizonEnum: 'unspecified', horizonSource: 'default' })]);
    const { id } = await deploy(db, { sibling: (await resolve(db)).equippedHypothesis });
    const v = stored(db, vPath(1));
    expect(v).toMatchObject({ status: 'activated', reviewDueAt: null, firstDeployedAt: NOW });
    expect(C.REVIEW_CLOCK_FAULT_FIELD in v).toBe(false);
    expect(stored(db, rowPath(1))).toMatchObject({ battleId: id, dueAtMs: null });
  });
  it('B5 — the calendar cannot place the clock (calendar_unavailable): the deploy SUCCEEDS, the version carries the typed marker, reviewDueAt stays null, and the row is a battle-end review', async () => {
    vi.setSystemTime(new Date('2027-12-01T15:00:00.000Z'));
    expect(() => computeReviewDueAt('longterm', Date.parse('2027-12-01T15:00:00.000Z'))).toThrow(expect.objectContaining({ code: 'calendar_unavailable' }));
    const db = seed([version(1, {}, { horizonEnum: 'longterm' })]);
    const { id } = await deploy(db, { sibling: (await resolve(db)).equippedHypothesis });
    expect(battlesIn(db)).toEqual([`agentBattles/${id}`]);
    expect(stored(db, vPath(1))).toMatchObject({
      status: 'activated', firstDeployedAt: '2027-12-01T15:00:00.000Z', reviewDueAt: null, reviewClockFault: 'calendar_unavailable',
    });
    expect(C.REVIEW_CLOCK_FAULTS).toEqual(['calendar_unavailable']);
    expect(stored(db, rowPath(1))).toMatchObject({ battleId: id, dueAtMs: null });
  });
  it('a battle that carries NOTHING: the creation transaction reads and writes exactly what it did before (the descriptor, then the battle)', async () => {
    const db = seed([version(1)]);
    const { id } = await deploy(db);
    expect(db.__access.reads).toEqual(['composition/activation']);
    expect(db.__access.writes.map((w) => `${w.op}:${w.path}`)).toEqual([`create:agentBattles/${id}`]);
    expect('equippedHypothesis' in stored(db, `agentBattles/${id}`).agentContext).toBe(false);
    expect(stored(db, vPath(1)).status).toBe('ready');
  });
  it('the dark pin: a battle carrying a sibling is refused outright (carriage requires the transaction); one carrying nothing is the same plain add', async () => {
    const db = seed([version(1)]);
    const doc = { ownerId: OWNER, agentContext: { equippedWatchlist: snapshot(), equippedHypothesis: C.siblingOf(version(1)) } };
    await expect(commitBattleDocWithPin(db, doc, DARK)).rejects.toMatchObject({ code: 'hypothesis_carriage_stale', reason: 'carriage_requires_transaction' });
    expect(db.__access.writes).toEqual([]);
    const added = [];
    const plain = { collection: () => ({ add: async (d) => { added.push(d); return { id: 'x' }; } }) };
    const plainDoc = { ownerId: OWNER, agentContext: { equippedWatchlist: snapshot() } };
    await commitBattleDocWithPin(plain, plainDoc, DARK);
    expect(added).toHaveLength(1);
    expect(added[0]).toBe(plainDoc); // the very object, unchanged (review L1-1)
    expect(JSON.stringify(added[0])).toBe(JSON.stringify({ ownerId: OWNER, agentContext: { equippedWatchlist: snapshot() } }));
  });
});

describe('the race (acceptance row 5) — a fresh read that disagrees: the typed error, NO battle, NO version change, NO row', () => {
  const RACES = {
    'the version was retired after the deploy read it': (db) => { db.__docs.set(vPath(1), { ...db.__docs.get(vPath(1)), status: 'retired' }); },
    'the review pass flagged it due': (db) => { db.__docs.set(vPath(1), { ...db.__docs.get(vPath(1)), status: 'review_due' }); },
    'the version disappeared': (db) => { db.__docs.delete(vPath(1)); },
    'its content (and hash) were rewritten': (db) => {
      const v = { ...db.__docs.get(vPath(1)), statement: 'a different idea' };
      db.__docs.set(vPath(1), { ...v, contentHash: contentHashOf(v) });
    },
    'it now names another owner': (db) => { db.__docs.set(vPath(1), { ...db.__docs.get(vPath(1)), userId: OTHER }); },
  };
  for (const [name, mutate] of Object.entries(RACES)) {
    it(name, async () => {
      const db = seed([version(1)]);
      const { equippedHypothesis } = await resolve(db);
      mutate(db);
      const before = db.__docs.has(vPath(1)) ? stored(db, vPath(1)) : null;
      const err = await deploy(db, { sibling: equippedHypothesis }).catch((e) => e);
      expect(err).toBeInstanceOf(C.HypothesisCarriageError);
      expect(err).toMatchObject({ code: 'hypothesis_carriage_stale', message: CARRIAGE_RACE_MESSAGE });
      expect(battlesIn(db)).toEqual([]);
      expect(db.__docs.has(vPath(1)) ? stored(db, vPath(1)) : null).toEqual(before);
      expect(stored(db, rowPath(1))).toBeNull();
      expect(db.__access.writes).toEqual([]);
    });
  }
  it('a competing commit lands BETWEEN the body and the commit (the review pass): the transaction re-runs, its fresh read disagrees, nothing commits', async () => {
    const db = seed([version(1)]);
    const { equippedHypothesis } = await resolve(db);
    let landed = false;
    db.__hooks.afterTxBody = async ({ writes }) => {
      if (landed || !writes.some((w) => w.path === vPath(1))) return;
      landed = true;
      await db.doc(vPath(1)).update({ status: 'review_due', stateSource: 'review_pass', stateReason: 'horizon_elapsed' });
    };
    const err = await deploy(db, { sibling: equippedHypothesis }).catch((e) => e);
    expect(landed).toBe(true);
    expect(err).toMatchObject({ code: 'hypothesis_carriage_stale', reason: 'version_not_carriable' });
    expect(battlesIn(db)).toEqual([]);
    expect(stored(db, vPath(1))).toMatchObject({ status: 'review_due', firstDeployedAt: null });
    expect(stored(db, rowPath(1))).toBeNull();
  });
  it('a sibling whose frozen content does not hash to its own contentHash (tampered in flight) → refused before any write', async () => {
    const db = seed([version(1)]);
    const { equippedHypothesis } = await resolve(db);
    const err = await deploy(db, { sibling: { ...equippedHypothesis, statement: 'tampered' } }).catch((e) => e);
    expect(err).toMatchObject({ reason: 'content_mismatch' });
    expect(battlesIn(db)).toEqual([]);
  });
  it('a malformed sibling, or one naming another list than the snapshot → refused (never a battle with unprovable provenance)', async () => {
    const db = seed([version(1)]);
    const base = { ownerId: OWNER, agentContext: { equippedWatchlist: snapshot() } };
    await expect(commitBattleDocWithPin(db, { ...base, agentContext: { ...base.agentContext, equippedHypothesis: { watchlistId: WL } } }, LIT))
      .rejects.toMatchObject({ reason: 'sibling_malformed' });
    await expect(commitBattleDocWithPin(db, { ...base, agentContext: { equippedWatchlist: snapshot({ watchlistId: 'wl-x' }), equippedHypothesis: C.siblingOf(version(1)) } }, LIT))
      .rejects.toMatchObject({ reason: 'sibling_without_snapshot' });
    expect(battlesIn(db)).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('the battle writer (the fenced createAgentBattle) — the sibling\'s shape', () => {
  it('writes EXACTLY the eleven keys (extra keys passed in are dropped), beside the snapshot, never inside it', async () => {
    const db = seed([version(1)]);
    const { equippedHypothesis } = await resolve(db);
    const { id } = await deploy(db, { sibling: { ...equippedHypothesis, status: 'ready', userId: OWNER, extra: 'x' } });
    const ctx = stored(db, `agentBattles/${id}`).agentContext;
    expect(Object.keys(ctx.equippedHypothesis)).toEqual([...C.SIBLING_KEYS]);
    expect(Object.keys(ctx.equippedWatchlist).sort()).toEqual(['name', 'snapshotAt', 'tickers', 'watchlistId']);
  });
  it('ABSENT (no key — not null) when nothing is passed; ABSENT beside a null snapshot; ABSENT on a tournament battle — even if one is passed', async () => {
    const db = seed([version(1)]);
    const sibling = C.siblingOf(version(1));
    const none = await deploy(db);
    expect('equippedHypothesis' in stored(db, `agentBattles/${none.id}`).agentContext).toBe(false);
    const noSnap = await deploy(db, { sibling, snap: null });
    expect('equippedHypothesis' in stored(db, `agentBattles/${noSnap.id}`).agentContext).toBe(false);
    const tour = await deploy(db, { sibling, over: { gameMode: 'baggerbomb_tournament', groupId: 'grp-1', tournament: {} } });
    expect('equippedHypothesis' in stored(db, `agentBattles/${tour.id}`).agentContext).toBe(false);
    // Nothing carried → nothing activated.
    expect(stored(db, vPath(1)).status).toBe('ready');
    expect(stored(db, rowPath(1))).toBeNull();
  });
  it('equippedConfigHash is UNCHANGED by the sibling (the manifest hashes the snapshot alone — spec §2.4)', async () => {
    const db = seed([version(1)]);
    const { equippedHypothesis } = await resolve(db);
    const plain = await deploy(db);
    const carried = await deploy(db, { sibling: equippedHypothesis });
    const a = stored(db, `agentBattles/${plain.id}`).resolvedAgentManifest;
    const b = stored(db, `agentBattles/${carried.id}`).resolvedAgentManifest;
    expect(typeof a.equippedConfigHash).toBe('string');
    expect(b.equippedConfigHash).toBe(a.equippedConfigHash);
    expect(b).toEqual(a);
    // And the manifest builder never sees the sibling at all.
    const direct = buildResolvedAgentManifest({ agentData: agentData(), compiledBuild: null, equippedWatchlist: snapshot(), gameMode: 'baggerbomb_agent', now: NOW, generationStamp: null });
    expect(direct.equippedConfigHash).toBe(a.equippedConfigHash);
  });
});

describe('provenance (acceptance row 8) — P1a\'s resolveProvenance reads the carried sibling, no code change', () => {
  it('a carried battle\'s calls get { watchlistId, hypothesisVersion }; a sibling–snapshot mismatch → provenance_unresolved', async () => {
    const db = seed([version(1), version(2)]);
    const { equippedHypothesis } = await resolve(db);
    const { id } = await deploy(db, { sibling: equippedHypothesis });
    const battle = stored(db, `agentBattles/${id}`);
    expect(resolveProvenance(battle)).toEqual({ hypothesisRef: { watchlistId: WL, hypothesisVersion: 2 }, origin: 'equipped' });
    const mismatched = { ...battle, agentContext: { ...battle.agentContext, equippedHypothesis: { ...battle.agentContext.equippedHypothesis, watchlistId: 'wl-other' } } };
    expect(resolveProvenance(mismatched)).toEqual({ hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'hypothesis_snapshot_mismatch' });
    // A battle that carries nothing keeps the legacy ref (byte-identical provenance).
    const plain = stored(db, `agentBattles/${(await deploy(db)).id}`);
    expect(resolveProvenance(plain)).toEqual({ hypothesisRef: { watchlistId: WL, equippedConfigHash: plain.resolvedAgentManifest.equippedConfigHash }, origin: 'equipped' });
  });
});

describe('the frozen list (B3) — deployedListOf', () => {
  it('the DEPLOYING battle\'s own snapshot (name and tickers), found through lastDeployedBattleId — never the live list', async () => {
    const db = seed([version(1)]);
    const { id } = await deploy(db, { sibling: (await resolve(db)).equippedHypothesis });
    db.__docs.set(`watchlists/${WL}`, list({ name: 'Renamed later', tickers: [{ symbol: 'TSLA' }] }));
    expect(await C.deployedListOf(db, { uid: OWNER, version: stored(db, vPath(1)) })).toEqual({ battleId: id, name: 'AI capex', tickers: ['NVDA', 'AMD'] });
  });
  it('null unless the battle is the owner\'s and really carried THIS version beside a snapshot of the same list', async () => {
    const db = seed([version(1), version(2)]);
    const { id } = await deploy(db, { sibling: C.siblingOf(stored(db, vPath(2))) });
    const v2 = stored(db, vPath(2));
    expect(await C.deployedListOf(db, { uid: OTHER, version: v2 })).toBeNull();
    expect(await C.deployedListOf(db, { uid: OWNER, version: { ...v2, version: 1 } })).toBeNull();
    expect(await C.deployedListOf(db, { uid: OWNER, version: { ...v2, lastDeployedBattleId: null } })).toBeNull();
    expect(await C.deployedListOf(db, { uid: OWNER, version: { ...v2, lastDeployedBattleId: 'battle-missing' } })).toBeNull();
    const plain = await deploy(db);
    expect(await C.deployedListOf(db, { uid: OWNER, version: { ...v2, lastDeployedBattleId: plain.id } })).toBeNull();
    expect(await C.deployedListOf(db, { uid: OWNER, version: v2 })).toMatchObject({ battleId: id });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// The BUILD_RULES §2 review's fixes (L2-1, L2-3, L2-4, L4-1).
const rowPathOf = (n) => rowPath(n);
const armedRow = (over = {}) => ({ userId: OWNER, watchlistId: WL, version: 1, battleId: 'b-old', dueAtMs: Date.parse('2026-10-12T20:00:00.000Z'), armedAt: 1, ...over });

describe('L2-1 — activatedReviewDue: the review pass\'s own rule, from the armed row', () => {
  const at = Date.parse(NOW);
  it('a timed row is due once the instant reaches dueAtMs (the pass\'s >=)', () => {
    expect(C.activatedReviewDue({ row: armedRow({ dueAtMs: at }), battle: null, atMs: at })).toBe('horizon_elapsed');
    expect(C.activatedReviewDue({ row: armedRow({ dueAtMs: at + 1 }), battle: null, atMs: at })).toBeNull();
  });
  it('a battle-end row is due once its battle is terminal, or past its own expiresAt (ISO or Timestamp); a live battle, a missing battle or no row is never due', () => {
    const row = armedRow({ dueAtMs: null });
    expect(C.activatedReviewDue({ row, battle: { status: 'completed' }, atMs: at })).toBe('battle_ended');
    expect(C.activatedReviewDue({ row, battle: { status: 'active', expiresAt: '2026-10-13T14:59:59.000Z' }, atMs: at })).toBe('battle_ended');
    expect(C.activatedReviewDue({ row, battle: { status: 'active', expiresAt: { toDate: () => new Date(at - 1) } }, atMs: at })).toBe('battle_ended');
    expect(C.activatedReviewDue({ row, battle: { status: 'active', expiresAt: '2026-10-13T20:00:00.000Z' }, atMs: at })).toBeNull();
    expect(C.activatedReviewDue({ row, battle: { status: 'active' }, atMs: at })).toBeNull();
    expect(C.activatedReviewDue({ row, battle: null, atMs: at })).toBeNull();
    expect(C.activatedReviewDue({ row: null, battle: { status: 'completed' }, atMs: at })).toBeNull();
  });
});

describe('L2-1 — an activated version whose review is already due is judged AT DEPLOY (judged once), then B2 applies to what remains', () => {
  const act1 = (over = {}) => version(1, { status: 'activated', ...DEPLOYED('b-old', '2026-10-12T20:00:00.000Z'), ...over });
  it('a passed clock → review_due (stateSource deploy, horizon_elapsed), the row deleted in the same commit, and the deploy refused', async () => {
    const db = seed([act1()], { [rowPathOf(1)]: armedRow() });
    const before = stored(db, vPath(1));
    expect(await resolve(db)).toMatchObject({ outcome: 'refuse', version: 1 });
    expect(stored(db, vPath(1))).toEqual({ ...before, status: 'review_due', stateChangedAt: NOW, stateSource: 'deploy', stateReason: 'horizon_elapsed' });
    expect(stored(db, rowPathOf(1))).toBeNull();
  });
  it('an ended battle (terminal, or past expiresAt) → battle_ended; a live one → carried with its clock untouched (B6)', async () => {
    for (const [battle, outcome] of [
      [{ ownerId: OWNER, status: 'completed' }, 'refuse'],
      [{ ownerId: OWNER, status: 'active', expiresAt: '2026-10-12T20:00:00.000Z' }, 'refuse'],
      [{ ownerId: OWNER, status: 'active', expiresAt: '2026-10-13T20:00:00.000Z' }, 'carry'],
    ]) {
      const db = seed([act1({ reviewDueAt: null })], { [rowPathOf(1)]: armedRow({ dueAtMs: null }), 'agentBattles/b-old': battle });
      expect((await resolve(db)).outcome, JSON.stringify(battle)).toBe(outcome);
      expect(stored(db, vPath(1)).status).toBe(outcome === 'refuse' ? 'review_due' : 'activated');
      if (outcome === 'refuse') expect(stored(db, vPath(1)).stateReason).toBe('battle_ended');
    }
  });
  it('after judging, an OLDER ready version still cannot ride past the newer due one (L4-1); a NEWER ready one (reaffirmed) carries', async () => {
    let db = seed([version(1), act1({ version: 2 })], {});
    db.__docs.set(vPath(2), { ...version(2, { status: 'activated', ...DEPLOYED('b-old', '2026-10-12T20:00:00.000Z') }) });
    db.__docs.set(rowPathOf(2), armedRow({ version: 2 }));
    expect(await resolve(db)).toMatchObject({ outcome: 'refuse', version: 2 });
    db = seed([act1(), version(2, { stateReason: 'reaffirmed' })], { [rowPathOf(1)]: armedRow() });
    expect(await resolve(db)).toMatchObject({ outcome: 'carry', version: 2 });
    expect(stored(db, vPath(1)).status).toBe('activated'); // a newer ready version decides before the older one is looked at
  });
  it('no armed row, or a clock not yet passed → carried as an active idea (no judgment, no write)', async () => {
    for (const extra of [{}, { [rowPathOf(1)]: armedRow({ dueAtMs: Date.parse('2026-10-20T20:00:00.000Z') }) }]) {
      const db = seed([act1()], extra);
      expect(await resolve(db)).toMatchObject({ outcome: 'carry', version: 1, status: 'activated' });
      expect(db.__access.writes).toEqual([]);
    }
  });
  it('the judgment loses a race (the version moved): carry nothing; a judgment that cannot commit refuses (a due idea never rides unjudged)', async () => {
    let db = seed([act1()], { [rowPathOf(1)]: armedRow() });
    db.__hooks.afterQuery = async () => { db.__docs.set(vPath(1), { ...db.__docs.get(vPath(1)), status: 'retired' }); };
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'state_moved' });
    db = seed([act1()], { [rowPathOf(1)]: armedRow() });
    const realTx = db.runTransaction;
    db.runTransaction = async () => { throw new Error('ABORTED'); };
    expect(await resolve(db)).toMatchObject({ outcome: 'refuse', version: 1 });
    db.runTransaction = realTx;
    expect(stored(db, vPath(1)).status).toBe('activated');
  });
  it('the creation transaction re-checks: an active idea that became due between the deploy\'s read and the battle → the typed race error, nothing written', async () => {
    const db = seed([act1({ reviewDueAt: '2026-10-13T16:00:00.000Z' })], { [rowPathOf(1)]: armedRow({ dueAtMs: Date.parse('2026-10-13T16:00:00.000Z') }) });
    const { equippedHypothesis } = await resolve(db);
    vi.setSystemTime(new Date('2026-10-13T16:30:00.000Z')); // the battle is created after the clock passed
    const err = await deploy(db, { sibling: equippedHypothesis }).catch((e) => e);
    expect(err).toMatchObject({ code: 'hypothesis_carriage_stale', reason: 'review_due_now' });
    expect(battlesIn(db)).toEqual([]);
    expect(stored(db, vPath(1)).status).toBe('activated');
  });
});

describe('L4-1 — the newest DEPLOYED version decides: a due one admits only a NEWER carriable version', () => {
  const due2 = () => version(2, { status: 'review_due', ...DEPLOYED('b-2'), stateSource: 'review_pass', stateReason: 'horizon_elapsed' });
  it('an older READY version under a newer due one → refuse (never a superseded idea riding with a fresh clock)', async () => {
    expect(await resolve(seed([version(1, { successorVersion: 2 }), due2()]))).toMatchObject({ outcome: 'refuse', version: 2 });
  });
  it('an older ACTIVATED version under a newer due one → refuse', async () => {
    expect(await resolve(seed([version(1, { status: 'activated', ...DEPLOYED('b-1', '2026-12-31T21:00:00.000Z') }), due2()]))).toMatchObject({ outcome: 'refuse', version: 2 });
  });
  it('an older ready version under a newer deployed version that is NOT due (retired, invalidated) → carried (B2 as written)', async () => {
    for (const status of ['retired', 'invalidated']) {
      expect(await resolve(seed([version(1), version(2, { status, ...DEPLOYED('b-2') })])), status).toMatchObject({ outcome: 'carry', version: 1 });
    }
  });
});

describe('L2-3 / L2-4 — the read: paged past 100, bounded, and only documents whose id is their version', () => {
  it('a due version below 120 newer drafts is still found (two pages): refused', async () => {
    const versions = [version(1, { status: 'review_due', ...DEPLOYED('b-1') })];
    for (let n = 2; n <= 121; n++) versions.push(version(n, { status: 'draft' }));
    const db = seed(versions);
    expect(await resolve(db)).toMatchObject({ outcome: 'refuse', version: 1 });
    expect(db.__access.queries).toHaveLength(2);
    expect(db.__access.queries[1].startAfter).toEqual([22]);
  });
  it('more than CARRIAGE_SCAN_LIMIT × CARRIAGE_SCAN_MAX_PAGES versions → nothing carried (bounded, logged)', async () => {
    const versions = [];
    for (let n = 1; n <= C.CARRIAGE_SCAN_LIMIT * C.CARRIAGE_SCAN_MAX_PAGES + 1; n++) versions.push({ ...version(1, { status: 'draft' }), version: n });
    const db = seed(versions);
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'scan_cap' });
    expect(db.__access.queries).toHaveLength(C.CARRIAGE_SCAN_MAX_PAGES);
  });
  it('a document whose id disagrees with its version field is no version (never frozen, so never a failed creation)', async () => {
    const db = seed([]);
    db.__docs.set(vPath(2), version(5));
    expect(await resolve(db)).toEqual({ outcome: 'none', reason: 'nothing_carriable' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// "The agent reads none of this" — a census of every non-test source file that
// names the sibling (BUILD_RULES §2 review, verifier V3: no row planted the
// sibling into the evaluation cron's prompt path). Each entry is a writer, the
// provenance reader, the privacy strip or a comment; a NEW reader — a prompt
// module, the evaluation cron, a capture writer — fails here and must be
// reviewed against spec §2.4 / §9 before it is added.
describe('the census — who names agentContext.equippedHypothesis', () => {
  it('exactly the P1b writers, the provenance reader, the privacy strip and comments — no prompt module, no evaluation cron, no capture', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join, relative, sep } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
    const files = [];
    const walk = (abs) => {
      for (const ent of readdirSync(abs, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.') || ent.name === '__fixtures__') continue;
        const child = join(abs, ent.name);
        if (ent.isDirectory()) walk(child);
        else if (/\.(js|jsx|mjs)$/.test(ent.name) && !/\.test\.(js|jsx|mjs)$/.test(ent.name)) files.push(child);
      }
    };
    walk(join(REPO, 'api'));
    walk(join(REPO, 'src'));
    const naming = files.filter((f) => readFileSync(f, 'utf8').includes('equippedHypothesis'))
      .map((f) => relative(REPO, f).split(sep).join('/')).sort();
    expect(naming).toEqual([
      'api/_utils/agentBattleService.js', // the fenced writer (the 11 keys)
      'api/_utils/callRecords/candidate.js', // P1a's resolveProvenance — {watchlistId, hypothesisVersion} only
      'api/_utils/compositionGenerationFence.js', // a comment; the creation transaction calls carriage.js
      'api/_utils/hypothesisRecords/carriage.js', // the resolver, the fresh read, the frozen-list read
      'api/_utils/tournamentBattleView.js', // the privacy strip
      'api/agent/decide.js', // the fenced call site (passes the resolver's sibling through)
      'api/tournament/battle-view.js', // a comment
      'src/config/featureFlags.js', // the flag's docstring
    ]);
  });
  it('and the evaluation prompt\'s identity block is byte-identical with and without a sibling', async () => {
    const { buildAgentIdentityBlock } = await import('../agentEvalPromptAssembly.js');
    const db = seed([version(1)]);
    const { equippedHypothesis } = await resolve(db);
    const plain = stored(db, `agentBattles/${(await deploy(db)).id}`);
    const carried = stored(db, `agentBattles/${(await deploy(db, { sibling: equippedHypothesis })).id}`);
    expect('equippedHypothesis' in carried.agentContext).toBe(true);
    expect(buildAgentIdentityBlock(carried)).toBe(buildAgentIdentityBlock(plain));
  });
});
