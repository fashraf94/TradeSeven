// api/_utils/agentSwapExecution.identity.test.js
//
// Pilot P6 — the swap identity check inside the executor's transaction (G01;
// pilot spec §7; Phase 0 docs/audits/20261007_PHASE0_PILOT_P6_SWAP_IDENTITY.md
// §9.2 rows A1–A6) and the clock / data seams (Phase 0 §8).
//
// The executor runs against a RETRYING transaction double: the body re-runs
// when a competing commit lands between its read and its commit (the
// optimistic-concurrency shape of versionedFirestore.js, with `update`), and a
// throw from the body aborts the transaction with nothing written — as the
// Admin SDK does. Each attempt's buffered write is kept, so a row can compare
// what a discarded attempt would have written with what the committed one did.
//
// `executeSwapServer` is imported under another name so the literal call
// string never appears here (the repo-level census in agent-evaluate.test.js).
//
// Dependency-surface guard (BUILD_RULES §4): this import of the fenced
// executor — which imports src/config/featureFlags.js and
// src/constants/agentGameModes.js — is never mocked.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('./marketDataCache.js', () => ({ getStockAnalysisData: fetchMock }));

import { executeSwapServer as executeSwap, SwapRefusalError, SWAP_REFUSAL_REASONS } from './agentSwapExecution.js';

const BATTLE_ID = 'battle-p6-1';
const T0 = '2026-10-07T15:00:00.000Z';
const KO_IN = '2026-10-05T16:00:00.000Z';   // when KO entered support[0]
const KO_BACK = '2026-10-07T14:00:00.000Z'; // when KO came back after leaving
const XOM_IN = '2026-10-07T14:45:00.000Z';  // when XOM took support[0]
const MU_IN = '2026-10-06T15:00:00.000Z';

function book(overrides = {}) {
  return {
    status: 'active',
    gameMode: 'baggerbomb_agent',
    activatedAt: '2026-10-05T13:30:00.000Z',
    portfolio: {
      star: [{ symbol: 'MU', name: 'Micron', baseATR: 2.5, isCrypto: false, swapPrice: 100, swappedInAt: MU_IN, swappedInDay: 2 }],
      core: [{ symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.1, isCrypto: false }], // creation-time: no swappedInAt
      support: [{ symbol: 'KO', name: 'Coca-Cola', baseATR: 1.1, isCrypto: false, swapPrice: 61, swappedInAt: KO_IN, swappedInDay: 1 }],
      bench: {
        stocks: [
          { symbol: 'AMD', name: 'AMD', baseATR: 3.4, isCrypto: false },
          { symbol: 'JPM', name: 'JPMorgan', baseATR: 1.6, isCrypto: false },
        ],
        crypto: null,
      },
      startingPrices: { MU: 95, NVDA: 120, KO: 62, AMD: 160, JPM: 199, XOM: 110 },
    },
    scoring: { thresholds: {} },
    thresholdHistory: {},
    trades: [],
    scoreState: { tradeCount: 7 },
    ...overrides,
  };
}
/** The book after another executor call replaced KO with XOM in support[0] (the P02 shape). */
const movedBook = (overrides = {}) => {
  const b = book(overrides);
  b.portfolio.support = [{ symbol: 'XOM', name: 'Exxon', baseATR: 1.4, isCrypto: false, swapPrice: 112, swappedInAt: XOM_IN, swappedInDay: 3 }];
  return b;
};
const PRICES = {
  MU: { current: 110, previousClose: 108 }, NVDA: { current: 121, previousClose: 120 }, KO: { current: 63, previousClose: 62.5 },
  XOM: { current: 113, previousClose: 112 }, AMD: { current: 150, previousClose: 149 }, JPM: { current: 200, previousClose: 198 },
};
const META = { id: 'trade_008', action: 'SWAP', trigger: 'stop_loss', evaluationId: 'risk_stop_loss_KO_1760000000000', tradingDay: 3 };
const AMD = { symbol: 'AMD', name: 'AMD', baseATR: 3.4, isCrypto: false };
const VERIFICATION_ID = `${BATTLE_ID}:${META.evaluationId}:verify`;

/** A clock that advances one second per reading, starting at `start`. */
function makeClock(start = T0) {
  let n = 0;
  return vi.fn(() => new Date(Date.parse(start) + 1000 * n++));
}

function setDotted(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) cur = cur[parts[i]] ?? (cur[parts[i]] = {});
  cur[parts[parts.length - 1]] = value;
}

/** The retrying transaction double (see the header). */
function makeDb(doc, { between = null } = {}) {
  let data = structuredClone(doc);
  let version = 0;
  const attempts = [];
  const commits = [];
  const db = {
    collection: () => ({ doc: (id) => ({ path: `agentBattles/${id}` }) }),
    runTransaction: async (fn) => {
      for (let n = 1; n <= 5; n += 1) {
        const attempt = { n, readVersion: null, buffered: null };
        attempts.push(attempt);
        const tx = {
          get: async () => { attempt.readVersion = version; return { exists: data != null, data: () => structuredClone(data) }; },
          update: (_ref, updates) => { attempt.buffered = structuredClone(updates); },
        };
        const result = await fn(tx);
        if (between) between({ n, write: (mutate) => { mutate(data); version += 1; } });
        if (attempt.readVersion !== version) continue;
        if (attempt.buffered) {
          for (const [k, v] of Object.entries(attempt.buffered)) setDotted(data, k, structuredClone(v));
          version += 1;
          commits.push(attempt.buffered);
        }
        return result;
      }
      throw new Error('contention exhausted');
    },
  };
  return { db, attempts, commits, current: () => data };
}

const lastTrade = (update) => update.trades[update.trades.length - 1];
/** A write with the trade row's verification lifted — what the same call writes at off. */
function withoutVerification(update) {
  const copy = structuredClone(update);
  delete copy.trades[copy.trades.length - 1].verification;
  return copy;
}

async function swapAt(mode, liveDoc, { tier = 'support', slot = 0, incoming = AMD, expectedOut, meta = META, callerBattle = book(), dbOpts = {}, clock = makeClock() } = {}) {
  const store = makeDb(liveDoc, dbOpts);
  const opts = { now: clock, identityMode: mode, ...(expectedOut !== undefined ? { expectedOut } : {}) };
  let result = null;
  let error = null;
  try {
    result = await executeSwap(store.db, BATTLE_ID, callerBattle, tier, slot, incoming, 3, PRICES, meta, null, opts);
  } catch (err) {
    error = err;
  }
  return { ...store, result, error, clock };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({ daily: [{ date: '2026-10-06', rawClose: 120, close: 120, high: 121, low: 119 }] }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const KO_BELIEF = { symbol: 'KO', swappedInAt: KO_IN };

describe('A1 — the belief matches: the swap commits; the row carries `verification` at shadow and enforce, nothing at off', () => {
  for (const mode of ['shadow', 'enforce']) {
    it(`${mode}: committed, one write, the verification exact`, async () => {
      const { commits, result, error } = await swapAt(mode, book(), { expectedOut: KO_BELIEF });
      expect(error).toBeNull();
      expect(commits).toHaveLength(1);
      const row = lastTrade(commits[0]);
      expect(row.symbolOut).toBe('KO');
      expect(row.verification).toEqual({
        verificationId: VERIFICATION_ID,
        mode,
        expected: { symbol: 'KO', swappedInAt: KO_IN },
        found: { symbol: 'KO', swappedInAt: KO_IN },
        verdict: 'match',
        basis: 'symbol_and_entry',
        battleStatus: 'active',
        slot: { tier: 'support', slotIndex: 0 },
        tradeSeq: 7,
        checkedAt: '2026-10-07T15:00:01.000Z', // the attempt's own reading (the second of the clock)
      });
      // The returned trade IS the written row.
      expect(result.closedTrade.verification).toEqual(row.verification);
    });
  }

  it('off: no verification anywhere — and shadow/enforce differ from off by EXACTLY that one key', async () => {
    const off = await swapAt('off', book(), { expectedOut: KO_BELIEF });
    const shadow = await swapAt('shadow', book(), { expectedOut: KO_BELIEF });
    const enforce = await swapAt('enforce', book(), { expectedOut: KO_BELIEF });
    expect(JSON.stringify(off.commits)).not.toContain('verification');
    expect(off.result.closedTrade).not.toHaveProperty('verification');
    expect(JSON.stringify(withoutVerification(shadow.commits[0]))).toBe(JSON.stringify(off.commits[0]));
    expect(JSON.stringify(withoutVerification(enforce.commits[0]))).toBe(JSON.stringify(off.commits[0]));
    const { verification: _v, ...shadowReturned } = shadow.result.closedTrade;
    expect(JSON.stringify(shadowReturned)).toBe(JSON.stringify(off.result.closedTrade));
    expect(JSON.stringify(shadow.result.incomingAsset)).toBe(JSON.stringify(off.result.incomingAsset));
  });

  it('a caller that passes no belief: shadow and enforce record `not_checked` (no expected, no basis) and proceed', async () => {
    for (const mode of ['shadow', 'enforce']) {
      const { commits, error } = await swapAt(mode, book());
      expect(error).toBeNull();
      expect(lastTrade(commits[0]).verification).toMatchObject({ verdict: 'not_checked', expected: null, basis: null, found: { symbol: 'KO', swappedInAt: KO_IN } });
    }
  });
});

describe('A2 — the changed slot (DCR-002 P02): the belief names KO, support[0] now holds XOM', () => {
  it('enforce: a typed refusal — reason, verification, a readable message — and NOTHING written', async () => {
    const { commits, attempts, error } = await swapAt('enforce', movedBook(), { expectedOut: KO_BELIEF });
    expect(error).toBeInstanceOf(SwapRefusalError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SwapRefusalError');
    expect(error.reason).toBe('outgoing_identity_mismatch');
    expect(SWAP_REFUSAL_REASONS).toContain(error.reason);
    expect(error.message).toBe('Swap refused (outgoing_identity_mismatch): expected KO in support[0], found XOM');
    expect(error.verification).toMatchObject({
      verificationId: VERIFICATION_ID, mode: 'enforce', verdict: 'mismatch', basis: 'symbol_and_entry',
      expected: { symbol: 'KO', swappedInAt: KO_IN }, found: { symbol: 'XOM', swappedInAt: XOM_IN }, battleStatus: 'active',
    });
    expect(commits).toEqual([]);
    expect(attempts.every((a) => a.buffered === null)).toBe(true);
  });

  it('shadow: the trade proceeds EXACTLY as today (XOM goes out) and the row says mismatch', async () => {
    const shadow = await swapAt('shadow', movedBook(), { expectedOut: KO_BELIEF });
    const off = await swapAt('off', movedBook(), { expectedOut: KO_BELIEF });
    expect(shadow.error).toBeNull();
    const row = lastTrade(shadow.commits[0]);
    expect(row.symbolOut).toBe('XOM');
    expect(row.verification).toMatchObject({ verdict: 'mismatch', expected: { symbol: 'KO' }, found: { symbol: 'XOM', swappedInAt: XOM_IN } });
    expect(JSON.stringify(withoutVerification(shadow.commits[0]))).toBe(JSON.stringify(off.commits[0]));
  });

  it('enforce names the stale belief even where an older check would also throw: the slot now holds the INCOMING symbol', async () => {
    // A replayed swap KO → AMD after AMD already took the slot (the A9 shape at the executor).
    const b = book();
    b.portfolio.support = [{ symbol: 'AMD', name: 'AMD', baseATR: 3.4, isCrypto: false, swapPrice: 150, swappedInAt: XOM_IN }];
    const enforce = await swapAt('enforce', b, { expectedOut: KO_BELIEF });
    expect(enforce.error.reason).toBe('outgoing_identity_mismatch');
    expect(enforce.error.verification.found.symbol).toBe('AMD');
    // shadow keeps today's refusal, word for word
    const shadow = await swapAt('shadow', b, { expectedOut: KO_BELIEF });
    expect(shadow.error).not.toBeInstanceOf(SwapRefusalError);
    expect(shadow.error.message).toBe('Invalid swap: AMD cannot replace itself');
  });

  it('an emptied slot: enforce refuses typed (found nothing); shadow keeps today\'s message', async () => {
    const b = book();
    b.portfolio.support = [];
    const enforce = await swapAt('enforce', b, { expectedOut: KO_BELIEF });
    expect(enforce.error.reason).toBe('outgoing_identity_mismatch');
    expect(enforce.error.verification.found).toEqual({ symbol: null, swappedInAt: null });
    expect(enforce.error.message).toMatch(/found an empty slot$/);
    const shadow = await swapAt('shadow', b, { expectedOut: KO_BELIEF });
    expect(shadow.error.message).toBe('Asset no longer available in slot');
    expect(shadow.commits).toEqual([]);
  });
});

describe('the verification never carries undefined, and never a shared id (reviews S2-2, S1-2)', () => {
  it('a caller with no tier or slot (an owner-written proposal): enforce refuses with slot {null, null} — Firestore would reject undefined', async () => {
    const { db, commits } = makeDb(book());
    let error = null;
    try {
      // tier and slot positionally undefined — exactly what `proposal.tier` / `proposal.slotIndex` hand over when absent
      await executeSwap(db, BATTLE_ID, book(), undefined, undefined, AMD, 3, PRICES, META, null, { now: makeClock(), identityMode: 'enforce', expectedOut: KO_BELIEF });
    } catch (err) {
      error = err;
    }
    expect(error.reason).toBe('outgoing_identity_mismatch');
    expect(error.verification.slot).toEqual({ tier: null, slotIndex: null });
    const undefinedPaths = [];
    const walk = (v, path) => {
      if (v === undefined) undefinedPaths.push(path);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(error.verification, 'verification');
    expect(undefinedPaths).toEqual([]);
    expect(commits).toEqual([]);
  });

  it('a caller with no evaluation id gets verificationId null — not "<battle>:undefined:verify", which every such call would share', async () => {
    for (const meta of [{ id: 'trade_x', action: 'SWAP' }, { ...META, evaluationId: '' }]) {
      const { commits } = await swapAt('shadow', book(), { expectedOut: KO_BELIEF, meta });
      expect(lastTrade(commits[0]).verification.verificationId).toBeNull();
    }
    const { error } = await swapAt('enforce', movedBook(), { expectedOut: KO_BELIEF, meta: { id: 'trade_y' } });
    expect(error.verification.verificationId).toBeNull();
  });
});

describe('A3 — the symbol left and came back: the same symbol, a different entry instant', () => {
  const returned = () => {
    const b = book();
    b.portfolio.support = [{ symbol: 'KO', name: 'Coca-Cola', baseATR: 1.1, isCrypto: false, swapPrice: 64, swappedInAt: KO_BACK, swappedInDay: 3 }];
    return b;
  };

  it('enforce refuses: a different position under the same symbol', async () => {
    const { error, commits } = await swapAt('enforce', returned(), { expectedOut: KO_BELIEF });
    expect(error.reason).toBe('outgoing_identity_mismatch');
    expect(error.verification).toMatchObject({ verdict: 'mismatch', expected: { symbol: 'KO', swappedInAt: KO_IN }, found: { symbol: 'KO', swappedInAt: KO_BACK } });
    expect(commits).toEqual([]);
  });

  it('shadow records the mismatch and commits as today', async () => {
    const { error, commits } = await swapAt('shadow', returned(), { expectedOut: KO_BELIEF });
    expect(error).toBeNull();
    expect(lastTrade(commits[0]).verification.verdict).toBe('mismatch');
  });

  it('a belief stored WITHOUT the entry instant can only check the symbol, and says so (basis symbol_only → match)', async () => {
    const { error, commits } = await swapAt('enforce', returned(), { expectedOut: { symbol: 'KO' } });
    expect(error).toBeNull();
    expect(lastTrade(commits[0]).verification).toMatchObject({ verdict: 'match', basis: 'symbol_only', expected: { symbol: 'KO', swappedInAt: null } });
  });
});

describe('A4 — a creation-time position (no swappedInAt; the belief carries null)', () => {
  const NVDA_BELIEF = { symbol: 'NVDA', swappedInAt: null };

  it('against the original position → match on symbol AND entry', async () => {
    const { error, commits } = await swapAt('enforce', book(), { tier: 'core', slot: 0, expectedOut: NVDA_BELIEF });
    expect(error).toBeNull();
    expect(lastTrade(commits[0]).verification).toMatchObject({ verdict: 'match', basis: 'symbol_and_entry', expected: { symbol: 'NVDA', swappedInAt: null }, found: { symbol: 'NVDA', swappedInAt: null } });
  });

  it('against NVDA swapped back in later → mismatch (null ≠ an instant)', async () => {
    const b = book();
    b.portfolio.core = [{ symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.1, isCrypto: false, swapPrice: 119, swappedInAt: KO_BACK }];
    const enforce = await swapAt('enforce', b, { tier: 'core', slot: 0, expectedOut: NVDA_BELIEF });
    expect(enforce.error.reason).toBe('outgoing_identity_mismatch');
    expect(enforce.error.verification.found).toEqual({ symbol: 'NVDA', swappedInAt: KO_BACK });
    const shadow = await swapAt('shadow', b, { tier: 'core', slot: 0, expectedOut: NVDA_BELIEF });
    expect(lastTrade(shadow.commits[0]).verification.verdict).toBe('mismatch');
  });

  it('a swapped-in belief against the creation-time original → mismatch (an instant ≠ null)', async () => {
    const { error } = await swapAt('enforce', book(), { tier: 'core', slot: 0, expectedOut: { symbol: 'NVDA', swappedInAt: KO_BACK } });
    expect(error.reason).toBe('outgoing_identity_mismatch');
  });
});

describe('A5 — the battle is no longer active (DCR P03; founder decision D3)', () => {
  it('enforce: `completed` refuses with battle_not_active even though the identity matches; nothing written', async () => {
    const { error, commits } = await swapAt('enforce', book({ status: 'completed' }), { expectedOut: KO_BELIEF });
    expect(error).toBeInstanceOf(SwapRefusalError);
    expect(error.reason).toBe('battle_not_active');
    expect(error.message).toBe("Swap refused (battle_not_active): the battle's status is completed");
    expect(error.verification).toMatchObject({ battleStatus: 'completed', verdict: 'match' });
    expect(commits).toEqual([]);
  });

  it('enforce: an ended battle outranks a moved slot — the reason names the battle', async () => {
    const { error } = await swapAt('enforce', movedBook({ status: 'completed' }), { expectedOut: KO_BELIEF });
    expect(error.reason).toBe('battle_not_active');
    expect(error.verification.verdict).toBe('mismatch');
  });

  it('enforce: the status check needs no belief — a caller with none is refused on a finished battle too', async () => {
    const { error } = await swapAt('enforce', book({ status: 'completed' }));
    expect(error.reason).toBe('battle_not_active');
    expect(error.verification.verdict).toBe('not_checked');
  });

  it('enforce: a battle with no status at all is not active (fail closed)', async () => {
    const doc = book();
    delete doc.status;
    const { error } = await swapAt('enforce', doc, { expectedOut: KO_BELIEF });
    expect(error.reason).toBe('battle_not_active');
    expect(error.message).toBe("Swap refused (battle_not_active): the battle's status is missing");
    expect(error.verification.battleStatus).toBeNull();
  });

  it('shadow: commits as today and records the status it read', async () => {
    const { error, commits } = await swapAt('shadow', book({ status: 'completed' }), { expectedOut: KO_BELIEF });
    expect(error).toBeNull();
    expect(lastTrade(commits[0]).verification).toMatchObject({ battleStatus: 'completed', verdict: 'match' });
  });
});

describe('A6 — a transaction retry: the slot moves between the first and second run of the body', () => {
  /** The competing executor call: lands after attempt 1 read KO, before it commits. */
  const between = ({ n, write }) => {
    if (n !== 1) return;
    write((doc) => {
      doc.portfolio.support = [{ symbol: 'XOM', name: 'Exxon', baseATR: 1.4, isCrypto: false, swapPrice: 112, swappedInAt: XOM_IN, swappedInDay: 3 }];
      doc.scoreState.tradeCount = 8;
    });
  };

  it('shadow: the committed verdict comes from the FRESH read; the id is identical across attempts; one write', async () => {
    const { attempts, commits, error, clock } = await swapAt('shadow', book(), { expectedOut: KO_BELIEF, dbOpts: { between } });
    expect(error).toBeNull();
    expect(attempts).toHaveLength(2);
    expect(commits).toHaveLength(1);
    const first = lastTrade(attempts[0].buffered).verification;
    const second = lastTrade(attempts[1].buffered).verification;
    expect(first).toMatchObject({ verdict: 'match', found: { symbol: 'KO' }, tradeSeq: 7 });
    expect(second).toMatchObject({ verdict: 'mismatch', found: { symbol: 'XOM', swappedInAt: XOM_IN }, tradeSeq: 8 });
    expect(lastTrade(commits[0]).verification).toEqual(second);
    // Derived from inputs, never from a clock: the same id on both runs, and exactly this id.
    expect(first.verificationId).toBe(VERIFICATION_ID);
    expect(second.verificationId).toBe(VERIFICATION_ID);
    // …while each attempt took its own clock reading (one before the transaction + one per attempt).
    expect(first.checkedAt).toBe('2026-10-07T15:00:01.000Z');
    expect(second.checkedAt).toBe('2026-10-07T15:00:02.000Z');
    expect(clock).toHaveBeenCalledTimes(3);
  });

  it('enforce: the second run refuses on the fresh read; nothing of ours is written', async () => {
    const { attempts, commits, error, current } = await swapAt('enforce', book(), { expectedOut: KO_BELIEF, dbOpts: { between } });
    expect(attempts).toHaveLength(2);
    expect(error.reason).toBe('outgoing_identity_mismatch');
    expect(error.verification).toMatchObject({ verificationId: VERIFICATION_ID, found: { symbol: 'XOM' }, tradeSeq: 8 });
    expect(commits).toEqual([]);
    expect(current().trades).toEqual([]);
    expect(current().portfolio.support[0].symbol).toBe('XOM'); // the competing write stands; ours never landed
  });

  it('the stamps of a retried write come from the attempt that committed', async () => {
    const { commits } = await swapAt('shadow', book(), { expectedOut: KO_BELIEF, dbOpts: { between } });
    expect(lastTrade(commits[0]).swappedOutAt).toBe('2026-10-07T15:00:02.000Z');
    expect(commits[0].updatedAt).toBe('2026-10-07T15:00:02.000Z');
    expect(commits[0]['portfolio.support'][0].swappedInAt).toBe('2026-10-07T15:00:02.000Z');
  });
});

describe('the seams (Phase 0 §8): one injected clock, one injected fetch', () => {
  it('every stamp, the beacon age and the bench cooldown derive from the injected clock — the system clock is never read', async () => {
    const clock = vi.fn(() => new Date(T0));
    const doc = book({ livePriceBeacon: { updatedAt: '2026-10-07T14:59:00.000Z', prices: { KO: 63.4, AMD: 151.1 } } });
    const realNow = vi.spyOn(Date, 'now');
    const { commits } = await swapAt('shadow', doc, { expectedOut: KO_BELIEF, clock });
    expect(realNow).not.toHaveBeenCalled();
    const update = commits[0];
    expect(update.updatedAt).toBe(T0);
    expect(lastTrade(update).swappedOutAt).toBe(T0);
    expect(lastTrade(update).exitPrice).toBe(63.4);              // the beacon is 60 s old by the injected clock → fresh
    expect(update['portfolio.support'][0].swapPrice).toBe(151.1);
    expect(update['portfolio.bench.stocks'].find((s) => s.symbol === 'KO').cooldownUntil).toBe('2026-10-08T15:00:00.000Z');
    expect(lastTrade(update).verification.checkedAt).toBe(T0);
  });

  it('Guard 3 reads "today" from the injected clock in ET: 23:30 ET on activation day is still activation day (no fetch)', async () => {
    const doc = book({ activatedAt: '2026-10-07T13:30:00.000Z' });
    const fetchDailyReference = vi.fn(async () => ({ daily: [] }));
    const clock = vi.fn(() => new Date('2026-10-08T03:30:00.000Z')); // 7 Oct 23:30 ET; already 8 Oct in UTC
    const store = makeDb(doc);
    await executeSwap(store.db, BATTLE_ID, doc, 'core', 0, AMD, 1, PRICES, META, null, { now: clock, fetchDailyReference, identityMode: 'off' });
    expect(fetchDailyReference).not.toHaveBeenCalled(); // held-from-start NVDA with a starting price, on activation day
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the next ET day fetches the reference — through the injected fetch, never the module fetch', async () => {
    const doc = book({ activatedAt: '2026-10-07T13:30:00.000Z' });
    const fetchDailyReference = vi.fn(async () => ({ daily: [] }));
    const clock = vi.fn(() => new Date('2026-10-08T14:00:00.000Z')); // 8 Oct 10:00 ET
    const store = makeDb(doc);
    await executeSwap(store.db, BATTLE_ID, doc, 'core', 0, AMD, 2, PRICES, META, null, { now: clock, fetchDailyReference, identityMode: 'off' });
    expect(fetchDailyReference).toHaveBeenCalledTimes(1);
    expect(fetchDailyReference).toHaveBeenCalledWith('NVDA', { forceRefresh: true, fields: ['daily', 'price'] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a crypto held from the start takes its Guard 2 reference by the UTC day OF THE INJECTED CLOCK (review S1-1)', async () => {
    // Injected: 8 Oct 02:00 UTC (= 7 Oct 22:00 ET). A crypto settles on the UTC
    // day, so the cutoff is 8 Oct and the prior-session bar is 7 Oct's. The
    // system clock is set to 7 Oct 03:00 UTC: a utcToday read off it would cut
    // at 7 Oct and pick 6 Oct's bar; an ET-day cutoff would too; a broken one
    // picks none. Only the right read substitutes 70000.
    const doc = book();
    doc.portfolio.support = [{ symbol: 'BTC', name: 'Bitcoin', baseATR: 5, isCrypto: true }]; // creation-time, no swapPrice
    doc.portfolio.bench.crypto = { symbol: 'ETH', name: 'Ethereum', baseATR: 6, isCrypto: true };
    doc.portfolio.startingPrices.BTC = 60000;
    const fetchDailyReference = vi.fn(async () => ({ daily: [
      { date: '2026-10-07', rawClose: 70000, close: 70000 },
      { date: '2026-10-06', rawClose: 60000, close: 60000 },
    ] }));
    const prices = { ...PRICES, BTC: { current: 69500, previousClose: 50000 }, ETH: { current: 3000, previousClose: 3010 } };
    const store = makeDb(doc);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T03:00:00.000Z'));
    try {
      await executeSwap(store.db, BATTLE_ID, doc, 'support', 0, doc.portfolio.bench.crypto, 3, prices, META, null,
        { now: () => new Date('2026-10-08T02:00:00.000Z'), fetchDailyReference, identityMode: 'off' });
    } finally {
      vi.useRealTimers();
    }
    expect(fetchDailyReference).toHaveBeenCalledTimes(1);
    const notes = console.warn.mock.calls.map((c) => String(c[0])).filter((s) => s.startsWith('[guard3]'));
    expect(notes).toEqual([expect.stringMatching(/^\[guard3\] BTC previousClose=50000 \(.*\); substituted 70000$/)]);
    expect(store.commits).toHaveLength(1);
  });

  it('a stock held from the start takes its Guard 2 reference by the ET day OF THE INJECTED CLOCK (verifier SV1 side note)', async () => {
    // Injected: 7 Oct 15:00 UTC (11:00 ET) — the ET cutoff is 7 Oct, so the
    // prior-session bar is 6 Oct's (120). The bars run NEWEST-first, so a
    // cutoff read off any later day picks 7 Oct's (130); the system clock is
    // set years ahead to make every bypass land there.
    const doc = book();
    const fetchDailyReference = vi.fn(async () => ({ daily: [
      { date: '2026-10-07', rawClose: 130, close: 130 },
      { date: '2026-10-06', rawClose: 120, close: 120 },
    ] }));
    const prices = { ...PRICES, NVDA: { current: 121, previousClose: 160 } }; // a glitched previousClose
    const store = makeDb(doc);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-03-09T07:00:00.000Z'));
    try {
      await executeSwap(store.db, BATTLE_ID, doc, 'core', 0, AMD, 3, prices, META, null,
        { now: () => new Date(T0), fetchDailyReference, identityMode: 'off' });
    } finally {
      vi.useRealTimers();
    }
    const notes = console.warn.mock.calls.map((c) => String(c[0])).filter((s) => s.startsWith('[guard3]'));
    expect(notes).toEqual([expect.stringMatching(/^\[guard3\] NVDA previousClose=160 \(.*\); substituted 120$/)]);
  });

  it('without the options bag the defaults are the system clock and the module fetch (the pre-P6 call)', async () => {
    const doc = book();
    const store = makeDb(doc);
    await executeSwap(store.db, BATTLE_ID, doc, 'core', 0, AMD, 3, PRICES, META, null);
    expect(fetchMock).toHaveBeenCalledWith('NVDA', { forceRefresh: true, fields: ['daily', 'price'] });
    expect(Date.parse(store.commits[0].updatedAt)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00.000Z'));
  });
});
