// test/rules/activationObserver.rules.mjs
//
// ID-1 Build 2 (shape note V1.7 §4.2–§4.4; build prompt V3 §4, §7) — THE
// OBSERVER AND ITS WRITER AGAINST THE REAL FIRESTORE EMULATOR, through the Admin
// SDK as in production, with the real store (setupEvidence/) underneath. Not a
// security-rules test: it rides the emulator runner, `npm run test:rules`
// (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST), outside the default
// suite (no `.test.` in the name). The setupEvidenceStore.rules.mjs precedent.
//
// The provider is injected (the store's `fetchPayload`), the clock is a virtual
// one moved by hand or by the `instrument.before` seam (a slow read is a read
// that moves the clock), and nothing waits on a real timer. The flag module is
// mocked ON here; the allowlist is the real environment variable. Each row clears
// the emulator's database first (the rules files run serially).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the tenant, the writer and the store
// are imported unmocked; only the flag module is replaced.

import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../src/config/activationEvidenceFlags.js', () => ({ get ACTIVATION_EVIDENCE_ENABLED() { return flag.on; } }));

const { runActivationObserver, BATTLE_FIELDS } = await import('../../api/_utils/activationEvidence/tenant.js');
const { createWithEvidence, createAtFinalization } = await import('../../api/_utils/activationEvidence/writer.js');
const { buildPointer } = await import('../../api/_utils/activationEvidence/pointer.js');
const { discoverActivations, activationKeyOf } = await import('../../api/_utils/activationEvidence/discover.js');
const C = await import('../../api/_utils/activationEvidence/constants.js');
const { legacyBattle, legacySwap, correctedBattle, correctedSwap, tickOf, CREATED_AT } = await import('../../api/_utils/activationEvidence/__fixtures__/activationBattles.js');
const { upRows, rowsWithoutNewest, snapshotFor } = await import('../../api/_utils/activationEvidence/__fixtures__/activationSnapshots.js');
const { describeRuleSet } = await import('../../api/_utils/setupEvaluator/thresholds.js');
const { snapshotIdOf } = await import('../../api/_utils/setupEvidence/key.js');

const PROJECT = 'demo-tradeseven-rules';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const RS = describeRuleSet();
const OWNER = 'ao-owner-1';
const OTHER = 'ao-owner-2';
const SESSION = '2026-11-04'; // the session the fixtures' 2026-11-05 activations date to
const INTRADAY = '2026-11-05T15:30:00.000Z';
const BEFORE_CUTOFF = '2026-11-06T01:15:00.000Z';
const CUTOFF = '2026-11-06T01:30:00.000Z';
const AT_0145 = '2026-11-06T01:45:00.000Z';
const NEXT_1300 = '2026-11-06T13:00:00.000Z';
const STOCKS = ['NVDA', 'AMD', 'MSFT', 'AAPL', 'KO', 'XOM'];

let app;
let db;
let host;
let savedEnv;

beforeAll(() => {
  host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`activationObserver needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: PROJECT }, `activation-observer-${Date.now()}`);
  db = getFirestore(app);
  savedEnv = process.env[ENV];
});
afterAll(async () => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  if (app) await deleteApp(app);
});
beforeEach(async () => {
  flag.on = true;
  process.env[ENV] = OWNER;
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`could not clear the emulator: ${res.status}`);
});

// ---------------------------------------------------------------- helpers

/** A virtual clock: `now` returns it, `advance` moves it. */
function clockAt(iso) {
  let t = Date.parse(iso);
  return { now: () => new Date(t), advance: (ms) => { t += ms; }, ms: () => t };
}
/** The provider: every symbol answers an ok window for the requested session, unless `bySymbol` says otherwise. */
function provider(bySymbol = {}) {
  const calls = [];
  const fetchPayload = async (symbol, { to }) => {
    calls.push(symbol);
    const v = bySymbol[symbol];
    if (typeof v === 'function') return v(to, calls.filter((s) => s === symbol).length);
    if (v === 'missing_newest') return rowsWithoutNewest(to);
    return structuredClone(v ?? upRows(to));
  };
  return { fetchPayload, calls };
}
async function seedBattle(id, battle) { await db.doc(`agentBattles/${id}`).set(battle); }
async function pointersOf(id) { return (await db.collection(`agentBattles/${id}/activations`).get()).docs.map((d) => ({ id: d.id, data: d.data(), updateTime: d.updateTime.toMillis() })); }
async function seedFinal(symbol, session = SESSION, fetchedAt = '2026-11-05T01:00:00.000Z') {
  const ev = await snapshotFor({ session, symbol, fetchedAt });
  await db.doc(`setupEvidence/${ev.snapshotId}`).set(ev.snapshot);
  return ev;
}
const run = (c, { fetchPayload = provider().fetchPayload, handlerStartMs = c.ms(), before, dbx = db } = {}) => runActivationObserver({
  db: dbx, handlerStartMs, now: c.now, fetchPayload, instrument: { before: (kind) => before?.(kind, c) },
});
const ownerBattle = (over = {}) => legacyBattle({ ownerId: OWNER, ...over });
/** A db whose every operation is counted (and may be refused). */
function countingDb(base) {
  const ops = [];
  return {
    ops,
    db: new Proxy(base, { get(t, k) { const v = t[k]; if (typeof v !== 'function') return v; return (...a) => { ops.push(String(k)); return v.apply(t, a); }; } }),
  };
}

// ---------------------------------------------------------------- the emulator behaves as the tenant assumes

describe('the read shapes the tenant uses (smoke rows, on the emulator)', () => {
  it('getAll with a field mask returns only the masked fields, nested ones included; an empty select() returns ids with no data', async () => {
    const b = ownerBattle({ agentContext: { ...ownerBattle().agentContext, equippedHypothesis: { watchlistId: 'w', hypothesisVersion: 2, contentHash: 'h', statement: 'SECRET_TEXT' } } });
    await seedBattle('b-1', b);
    const [snap] = await db.getAll(db.doc('agentBattles/b-1'), { fieldMask: [...BATTLE_FIELDS] });
    const data = snap.data();
    expect(data.agentContext.equippedHypothesis).toEqual({ watchlistId: 'w', hypothesisVersion: 2, contentHash: 'h' });
    expect(data.portfolio.bench).toBeUndefined();
    expect(data.agentContext.agentName).toBeUndefined();
    expect(data.trades).toEqual([]);
    const page = await db.collection('agentBattles').where('ownerId', '==', OWNER).where('createdAt', '>=', '2026-10-01').orderBy('createdAt', 'desc').limit(5).select().get();
    expect(page.docs.map((d) => [d.id, d.data()])).toEqual([['b-1', {}]]);
  });
});

// ---------------------------------------------------------------- the writer (contract §4.2)

describe('the writer — create-once', () => {
  const activationOf = (b) => discoverActivations(b).activations[0];
  const pointerFrom = (b, a, evidence, detail = null) => buildPointer({ battle: b, battleId: 'b-1', activation: a, session: SESSION, attribution: { attributionAgentId: b.agentId, attributionStatus: 'resolved' }, ruleSet: RS, evidence, missingDetail: detail, observedAt: '2026-11-05T15:00:00.000Z' });
  it('createWithEvidence creates once; a second write is skipped and changes no byte', async () => {
    const b = ownerBattle();
    const a = activationOf(b);
    const ev = await seedFinal(a.symbol);
    expect(await createWithEvidence({ db, battleId: 'b-1', pointer: pointerFrom(b, a, ev) })).toBe('created');
    const [first] = await pointersOf('b-1');
    expect(await createWithEvidence({ db, battleId: 'b-1', pointer: { ...pointerFrom(b, a, ev), observedAt: '2027-01-01T00:00:00.000Z' } })).toBe('exists');
    const [second] = await pointersOf('b-1');
    expect(second).toEqual(first);
  });
  it('createAtFinalization: the final present inside the transaction supplies the entry; absent → the null pointer; an existing pointer → skipped', async () => {
    const b = ownerBattle();
    const [a1, a2] = discoverActivations(b).activations;
    const ev = await seedFinal(a1.symbol);
    const make = (a) => (evidence) => pointerFrom(b, a, evidence, 'missing_bar');
    expect(await createAtFinalization({ db, battleId: 'b-1', activationId: a1.activationId, session: SESSION, symbol: a1.symbol, makePointer: make(a1) })).toBe('created_with_evidence');
    expect(await createAtFinalization({ db, battleId: 'b-1', activationId: a2.activationId, session: SESSION, symbol: a2.symbol, makePointer: make(a2) })).toBe('created_null');
    expect(await createAtFinalization({ db, battleId: 'b-1', activationId: a2.activationId, session: SESSION, symbol: a2.symbol, makePointer: make(a2) })).toBe('exists');
    const ps = Object.fromEntries((await pointersOf('b-1')).map((p) => [p.id, p.data]));
    expect(ps[a1.activationId]).toMatchObject({ snapshotRef: ev.snapshotId, missing: null });
    expect(ps[a1.activationId].entry).toEqual(ev.snapshot.entry);
    expect(ps[a2.activationId]).toMatchObject({ entry: null, snapshotRef: null, missing: { reason: 'snapshot_unavailable', detail: 'missing_bar' } });
  });
  it('a document at the key that is not this key\'s final (wrong schemaVersion or key) is neither evidence nor proof of absence: nothing is written', async () => {
    const b = ownerBattle();
    const a = activationOf(b);
    const ev = await seedFinal(a.symbol);
    for (const bad of [{ ...ev.snapshot, schemaVersion: 2 }, { ...ev.snapshot, key: { ...ev.snapshot.key, symbol: 'OTHER' } }]) {
      await db.doc(`setupEvidence/${ev.snapshotId}`).set(bad);
      expect(await createAtFinalization({ db, battleId: 'b-1', activationId: a.activationId, session: SESSION, symbol: a.symbol, makePointer: (e) => pointerFrom(b, a, e, 'x') })).toBe('snapshot_invalid');
    }
    expect(await pointersOf('b-1')).toEqual([]);
  });
  it('two concurrent finalisation writes for one activation → one pointer', async () => {
    const b = ownerBattle();
    const a = activationOf(b);
    const go = () => createAtFinalization({ db, battleId: 'b-1', activationId: a.activationId, session: SESSION, symbol: a.symbol, makePointer: (e) => pointerFrom(b, a, e, 'missing_bar') });
    const results = await Promise.all([go(), go(), go()]);
    expect(results.filter((r) => r === 'created_null')).toHaveLength(1);
    expect(results.filter((r) => r === 'exists')).toHaveLength(2);
    expect(await pointersOf('b-1')).toHaveLength(1);
  });
  it('refuses a non-session and a pointer without evidence on the evidence path', async () => {
    const b = ownerBattle();
    const a = activationOf(b);
    await expect(createAtFinalization({ db, battleId: 'b-1', activationId: a.activationId, session: null, symbol: a.symbol, makePointer: () => ({}) })).rejects.toThrow(TypeError);
    await expect(createWithEvidence({ db, battleId: 'b-1', pointer: pointerFrom(b, a, null, 'x') })).rejects.toThrow(TypeError);
  });
});

// ---------------------------------------------------------------- the gate and the budget

describe('the gate and the budget — no read', () => {
  for (const [label, setup] of [
    ['flag off', () => { flag.on = false; }],
    ['an empty allowlist', () => { process.env[ENV] = ' , '; }],
  ]) {
    it(`${label} → { skipped: true } before any read`, async () => {
      setup();
      const c = countingDb(db);
      expect(await runActivationObserver({ db: c.db, handlerStartMs: Date.parse(INTRADAY), now: clockAt(INTRADAY).now })).toEqual({ skipped: true });
      expect(c.ops).toEqual([]);
    });
  }
  it('less than MIN_RUN_MS until the admission deadline → { deferred: no_budget }, no read', async () => {
    const c = countingDb(db);
    const clock = clockAt(INTRADAY);
    expect(await runActivationObserver({ db: c.db, handlerStartMs: clock.ms() - 70_000, now: clock.now })).toEqual({ deferred: 'no_budget' });
    expect(c.ops).toEqual([]);
  });
});

// ---------------------------------------------------------------- owner scoping

describe('owner scoping', () => {
  it('an allowlisted owner\'s query never returns another owner\'s battle: only the admitted owner\'s battle is read or written', async () => {
    await seedBattle('b-mine', ownerBattle());
    await seedBattle('b-theirs', legacyBattle({ ownerId: OTHER }));
    const r = await run(clockAt(INTRADAY));
    expect(r.candidates).toBe(1);
    expect(await pointersOf('b-mine')).toHaveLength(6);
    expect(await pointersOf('b-theirs')).toEqual([]);
  });
  it('a battle with no agent id is counted malformed and never gets a pointer keyed by null', async () => {
    const b = ownerBattle();
    delete b.agentId;
    await seedBattle('b-noagent', b);
    const r = await run(clockAt(INTRADAY));
    expect(r.battles.malformed).toBe(1);
    expect(await pointersOf('b-noagent')).toEqual([]);
  });
  it('a full candidate page is counted as truncated', async () => {
    const batch = db.batch();
    for (let i = 0; i < C.MAX_CANDIDATE_IDS_PER_OWNER; i++) batch.set(db.doc(`agentBattles/p-${String(i).padStart(3, '0')}`), { ownerId: OWNER, agentId: `agent-${i}`, createdAt: `2026-11-05T14:${String(i % 60).padStart(2, '0')}:00.000Z`, agentContext: { archetype: 'contrarian' } });
    await batch.commit();
    const r = await run(clockAt(INTRADAY));
    expect(r.truncations.candidates).toBe(1);
    expect(r.battles.read).toBe(C.MAX_BATTLES_PER_RUN);
    expect(r.excluded.archetype).toBe(C.MAX_BATTLES_PER_RUN);
  });
});

// ---------------------------------------------------------------- pointers with evidence, and when none is written

describe('with evidence', () => {
  it('a final → one pointer per activation, from the store\'s snapshot, read by the store\'s key', async () => {
    await seedBattle('b-1', ownerBattle());
    const p = provider();
    const r = await run(clockAt(INTRADAY), { fetchPayload: p.fetchPayload });
    expect(r.pointers.withEvidence).toBe(6);
    expect(r.store.final).toBe(6);
    expect(p.calls.sort()).toEqual([...STOCKS].sort()); // one store call per key; crypto never asked
    const ps = await pointersOf('b-1');
    expect(ps).toHaveLength(6);
    for (const { data } of ps) {
      const snap = (await db.doc(`setupEvidence/${data.snapshotRef}`).get()).data();
      expect(data.snapshotRef).toBe(snapshotIdOf({ session: SESSION, symbol: data.symbol, ruleSet: RS }));
      expect(data.entry).toEqual(snap.entry);
      expect(data).toMatchObject({ schemaVersion: 1, kind: 'creation', asOf: SESSION, missing: null, attributionStatus: 'resolved' });
    }
  });
  it('a final already in the store is read, not acquired', async () => {
    await seedBattle('b-1', ownerBattle());
    for (const s of STOCKS) await seedFinal(s);
    const p = provider();
    const r = await run(clockAt(INTRADAY), { fetchPayload: p.fetchPayload });
    expect([r.store.finalRead, r.acquisitionsStarted, p.calls.length, r.pointers.withEvidence]).toEqual([6, 0, 0, 6]);
  });
  it('a pointer is never updated: a second run changes no byte', async () => {
    await seedBattle('b-1', ownerBattle());
    await run(clockAt(INTRADAY));
    const first = await pointersOf('b-1');
    const r2 = await run(clockAt('2026-11-05T15:45:00.000Z'));
    expect(r2.activations.alreadyWritten).toBe(6);
    expect(r2.pointerTransactions).toBe(0);
    expect(await pointersOf('b-1')).toEqual(first);
  });
  it('two concurrent runs → one pointer per activation', async () => {
    await seedBattle('b-1', ownerBattle());
    const [r1, r2] = await Promise.all([run(clockAt(INTRADAY)), run(clockAt(INTRADAY))]);
    expect(await pointersOf('b-1')).toHaveLength(6);
    expect(r1.pointers.withEvidence + r2.pointers.withEvidence).toBe(6);
  });
  it('a swap-in with a matching committed tick action → tick_action; within the grace without one → deferred, no pointer', async () => {
    const b = ownerBattle();
    legacySwap(b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: '2026-11-05T15:02:11.412Z', evaluationId: 'eval_012' });
    legacySwap(b, { tier: 'core', slot: 0, symbolIn: 'CVX', at: '2026-11-05T15:20:00.000Z' });
    await seedBattle('b-1', b);
    await db.doc('agentBattles/b-1/ticks/b-1:12').set(tickOf(12, '2026-11-05T15:03:00.000Z', [b.trades[0]]));
    const r = await run(clockAt(INTRADAY));
    const ps = Object.fromEntries((await pointersOf('b-1')).map((p) => [p.data.symbol, p.data]));
    expect(ps.JPM.activatingTick).toEqual({ tickSeq: 12, evalId: 'eval_012', evaluationId: 'eval_012', source: 'tick_action' });
    expect(ps.CVX).toBeUndefined(); // 10 minutes after its swap, no tick yet: the grace defers it
    expect(r.deferred.tick_grace).toBe(1);
    // After the grace it is written, `unavailable`.
    await run(clockAt('2026-11-05T16:00:00.000Z'));
    expect((await pointersOf('b-1')).find((p) => p.data.symbol === 'CVX').data.activatingTick).toEqual({ tickSeq: null, evalId: null, evaluationId: null, source: 'unavailable' });
  });
  it('the corrected route: the pointer ids are the position ids', async () => {
    const b = correctedBattle({ ownerId: OWNER });
    correctedSwap(b, { tier: 'core', slot: 1, symbolIn: 'BRK-B', at: '2026-11-05T15:02:11.412Z', positionId: 'pos_7Hq2LmN4' });
    await seedBattle('b-1', b);
    await db.doc('agentBattles/b-1/ticks/b-1:12').set(tickOf(12, '2026-11-05T15:03:00.000Z', [b.trades[0]]));
    await run(clockAt(INTRADAY));
    const ids = (await pointersOf('b-1')).map((p) => p.id).sort();
    expect(ids).toEqual(['pos-core-0', 'pos-core-1', 'pos-star-0', 'pos-star-1', 'pos-support-0', 'pos-support-1', 'pos_7Hq2LmN4'].sort());
  });
});

describe('the store call', () => {
  it('the hyphen symbol passes; a dotted one is symbol_form before any call; a stock slot the store reads as crypto is class_unknown, never written', async () => {
    const b = ownerBattle();
    b.portfolio.star[0] = { ...b.portfolio.star[0], symbol: 'BRK.B' }; b.agentContext.initialPortfolio.star[0].symbol = 'BRK.B';
    b.portfolio.star[1] = { ...b.portfolio.star[1], symbol: 'BRK-B' }; b.agentContext.initialPortfolio.star[1].symbol = 'BRK-B';
    b.portfolio.core[0] = { ...b.portfolio.core[0], symbol: 'ETH' }; b.agentContext.initialPortfolio.core[0].symbol = 'ETH';
    await seedBattle('b-1', b);
    const p = provider();
    const r = await run(clockAt(INTRADAY), { fetchPayload: p.fetchPayload });
    expect(p.calls).not.toContain('BRK.B');
    expect(p.calls).not.toContain('ETH'); // the store excludes it before any fetch
    expect(r.unresolved).toMatchObject({ symbol_form: 1, class_unknown: 1 });
    expect(r.store.excluded).toBe(1);
    const syms = (await pointersOf('b-1')).map((x) => x.data.symbol).sort();
    expect(syms).toEqual(['AAPL', 'BRK-B', 'KO', 'XOM']); // star[0] BRK.B and core[0] ETH are not written
  });
  it('a throw for one key (an ABORTED transaction) leaves the others, and defers that key', async () => {
    await seedBattle('b-1', ownerBattle());
    const p = provider({ AMD: () => { throw Object.assign(new Error('10 ABORTED: contention'), { code: 10 }); } });
    // The store turns a provider throw into retryable; to reach a THROW from the store, its claim transaction is refused for AMD.
    const real = db.runTransaction.bind(db);
    let failing = true;
    const dbx = new Proxy(db, { get(t, k) {
      if (k === 'runTransaction') return async (fn, ...rest) => real(async (tx) => {
        const proxyTx = new Proxy(tx, { get(tt, kk) {
          if (kk === 'get') return async (ref) => { if (failing && String(ref.path).includes('__AMD__')) throw Object.assign(new Error('10 ABORTED'), { code: 10 }); return tt.get(ref); };
          const v = tt[kk]; return typeof v === 'function' ? v.bind(tt) : v;
        } });
        return fn(proxyTx);
      }, ...rest);
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    } });
    const r = await run(clockAt(INTRADAY), { fetchPayload: p.fetchPayload, dbx });
    expect(r.store.threw).toEqual({ 10: 1 });
    expect(r.deferred.store_threw).toBe(1);
    expect((await pointersOf('b-1')).map((x) => x.data.symbol).sort()).toEqual(STOCKS.filter((s) => s !== 'AMD').sort());
    failing = false;
  });
  it('confirmation through the tenant: a confirm-class first result, a second call under 30 minutes later (no final), a third at least 30 minutes after the first response (final)', async () => {
    await seedBattle('b-1', ownerBattle());
    const short = (to) => upRows(to, 54); // insufficient_history: a confirm-class result
    const bySymbol = Object.fromEntries(STOCKS.map((s) => [s, short]));
    const p1 = provider(bySymbol);
    await run(clockAt('2026-11-05T15:00:00.000Z'), { fetchPayload: p1.fetchPayload });
    expect(await pointersOf('b-1')).toEqual([]);
    const p2 = provider(bySymbol);
    await run(clockAt('2026-11-05T15:15:00.000Z'), { fetchPayload: p2.fetchPayload });
    expect(p2.calls).toHaveLength(6); // a separate fetch, too early to confirm
    expect(await pointersOf('b-1')).toEqual([]);
    const p3 = provider(bySymbol);
    await run(clockAt('2026-11-05T15:31:00.000Z'), { fetchPayload: p3.fetchPayload });
    expect(p3.calls).toHaveLength(6);
    const ps = await pointersOf('b-1');
    expect(ps).toHaveLength(6);
    expect(ps.every((x) => x.data.entry?.refusal?.reason === 'insufficient_history')).toBe(true);
  });
});

describe('without evidence — only at finalisation, only after this run\'s own `retryable`', () => {
  it('retryable before the cutoff → no pointer, deferred; at the cutoff → the null pointer with this run\'s reason', async () => {
    await seedBattle('b-1', ownerBattle());
    const missing = Object.fromEntries(STOCKS.map((s) => [s, 'missing_newest']));
    const r1 = await run(clockAt(BEFORE_CUTOFF), { fetchPayload: provider(missing).fetchPayload });
    expect([r1.store.retryable, r1.pointers.null, r1.deferred.retryable_not_due]).toEqual([6, 0, 6]);
    expect(await pointersOf('b-1')).toEqual([]);
    const r2 = await run(clockAt(CUTOFF), { fetchPayload: provider(missing).fetchPayload });
    expect(r2.pointers.null).toBe(6);
    const ps = await pointersOf('b-1');
    expect(ps.every((x) => x.data.entry === null && x.data.missing.reason === 'snapshot_unavailable' && x.data.missing.detail === 'missing_bar' && x.data.asOf === SESSION)).toBe(true);
  });
  it('`pending` (a live lease) at finalisation → no null pointer', async () => {
    await seedBattle('b-1', ownerBattle());
    for (const s of STOCKS) await db.doc(`setupEvidenceClaims/${snapshotIdOf({ session: SESSION, symbol: s, ruleSet: RS })}`).set({ lease: { token: 't', claimedAt: CUTOFF, host: 'other' }, observation: null, attempts: 1, lastAttemptAt: CUTOFF });
    const r = await run(clockAt(CUTOFF), { fetchPayload: provider().fetchPayload });
    expect([r.store.pending, r.pointers.null, r.deferred.pending]).toEqual([6, 0, 6]);
    expect(await pointersOf('b-1')).toEqual([]);
  });
  it('an unreached key at finalisation → no null pointer (the run\'s time ran out before its store call)', async () => {
    await seedBattle('b-1', ownerBattle());
    const r = await run(clockAt(CUTOFF), {
      fetchPayload: provider(Object.fromEntries(STOCKS.map((s) => [s, 'missing_newest']))).fetchPayload,
      before: (kind, c) => { if (kind === 'acquire') c.advance(6_000); }, // each call start costs time: the reserve stops the rest
    });
    expect(r.acquisitionsStarted).toBeLessThan(6);
    expect(r.deferred.not_reached).toBe(6 - r.acquisitionsStarted);
    expect((await pointersOf('b-1')).length).toBe(r.pointers.null);
    expect(r.pointers.null).toBe(r.acquisitionsStarted);
  });
  it('acquisition versus finalisation: a final created between this run\'s `retryable` and its finalisation transaction supplies the entry', async () => {
    await seedBattle('b-1', ownerBattle());
    let seeded = false;
    const r = await run(clockAt(CUTOFF), {
      fetchPayload: provider(Object.fromEntries(STOCKS.map((s) => [s, 'missing_newest']))).fetchPayload,
      before: async (kind) => { if (kind === 'write_finalize' && !seeded) { seeded = true; await seedFinal('NVDA'); } },
    });
    const nvda = (await pointersOf('b-1')).find((x) => x.data.symbol === 'NVDA').data;
    expect(nvda.entry).not.toBe(null);
    expect(nvda.missing).toBe(null);
    expect(r.pointers.null).toBe(5);
  });
  it('evidence and null writes share ONE cap of 30', async () => {
    for (let i = 0; i < 6; i++) await seedBattle(`b-${i}`, ownerBattle());
    for (const s of ['NVDA', 'AMD', 'MSFT']) await seedFinal(s);
    const r = await run(clockAt(CUTOFF), { fetchPayload: provider({ AAPL: 'missing_newest', KO: 'missing_newest', XOM: 'missing_newest' }).fetchPayload });
    expect(r.pointerTransactions).toBe(C.MAX_POINTER_WRITES_PER_RUN);
    expect(r.pointers.withEvidence + r.pointers.null).toBe(30);
    expect(r.pointers.withEvidence).toBeGreaterThan(0);
    expect(r.pointers.null).toBeGreaterThan(0);
    expect(r.deferred.write_cap).toBe(6);
  });
  it('a calendar_missing activation is deferred, never sent to the writer, never a pointer', async () => {
    const b = ownerBattle({ activatedAt: '2028-01-04T15:00:00.000Z', createdAt: CREATED_AT });
    await seedBattle('b-1', b);
    const r = await run(clockAt(CUTOFF));
    expect(r.deferred.calendar_missing).toBe(6);
    expect(r.pointerTransactions).toBe(0);
    expect(await pointersOf('b-1')).toEqual([]);
  });
});

// ---------------------------------------------------------------- progress, fairness, starvation

describe('progress in every run', () => {
  it('a slow-read fixture (six final reads at 200 ms, slow battle reads) still starts acquisitions in the same run', async () => {
    for (let i = 0; i < 3; i++) await seedBattle(`b-${i}`, ownerBattle());
    const r = await run(clockAt(INTRADAY), { before: (kind, c) => { if (kind === 'battles') c.advance(1_500); if (kind === 'final') c.advance(200); if (kind === 'pointers') c.advance(300); } });
    expect(r.acquisitionsStarted).toBeGreaterThan(0);
    expect(r.pointers.withEvidence).toBeGreaterThan(0);
  });
  it('preparation never starts a read after PREP_BUDGET_MS, and acquisition still runs', async () => {
    for (let i = 0; i < 12; i++) await seedBattle(`b-${String(i).padStart(2, '0')}`, ownerBattle());
    const prep = [];
    let start = null;
    const r = await run(clockAt(INTRADAY), { before: (kind, c) => {
      if (start === null) start = c.ms();
      if (['state', 'candidates', 'battles', 'pointers', 'attribution', 'ticks', 'final'].includes(kind)) { prep.push(c.ms() - start); c.advance(900); }
    } });
    expect(prep.length).toBeGreaterThan(3);
    expect(Math.max(...prep)).toBeLessThan(C.PREP_BUDGET_MS);
    expect(r.deferred.battles_unread).toBeGreaterThan(0);
    expect(r.acquisitionsStarted).toBeGreaterThan(0);
  });
  it('a run whose preparation is cut short still acquires the state\'s carried keys', async () => {
    const carried = ['NVDA', 'AMD'].map((s) => ({ snapshotId: snapshotIdOf({ session: SESSION, symbol: s, ruleSet: RS }), session: SESSION, symbol: s, dueAt: null }));
    await db.doc('activationObserverState/main').set({ schemaVersion: 1, cursors: {}, battles: {}, outstandingKeys: carried, updatedAt: null });
    await seedBattle('b-1', ownerBattle());
    const r = await run(clockAt(INTRADAY), { before: (kind, c) => { if (kind === 'state') c.advance(C.PREP_BUDGET_MS + 1); } });
    expect(r.candidates).toBe(0);
    expect(r.acquisitionsStarted).toBe(2);
    for (const k of carried) expect((await db.doc(`setupEvidence/${k.snapshotId}`).get()).exists).toBe(true);
    expect(await pointersOf('b-1')).toEqual([]); // a carried key produces no pointer this run
  });
});

describe('fairness — every cursor advances past what it takes', () => {
  const carriedKeys = (symbols, dueAt) => symbols.map((s) => ({ snapshotId: snapshotIdOf({ session: SESSION, symbol: s, ruleSet: RS }), session: SESSION, symbol: s, dueAt }));
  it('a persistently failing due key does not stop later due keys, and ordinary keys still progress while due work exists', async () => {
    const due = carriedKeys(['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10'], Date.parse('2026-11-05T01:30:00.000Z'));
    const ordinary = carriedKeys(['O01', 'O02', 'O03', 'O04', 'O05', 'O06'], Date.parse('2026-11-07T01:30:00.000Z'));
    await db.doc('activationObserverState/main').set({ schemaVersion: 1, cursors: {}, battles: {}, outstandingKeys: [...due, ...ordinary], updatedAt: null });
    const always = Object.fromEntries([...due, ...ordinary].map((k) => [k.symbol, 'missing_newest'])); // every key keeps failing
    const p1 = provider(always);
    await run(clockAt(INTRADAY), { fetchPayload: p1.fetchPayload });
    expect(p1.calls).toHaveLength(12);
    expect(p1.calls.filter((s) => s.startsWith('O')).length).toBeGreaterThanOrEqual(5); // in turn, not due-first-only
    const p2 = provider(always);
    await run(clockAt('2026-11-05T15:45:00.000Z'), { fetchPayload: p2.fetchPayload });
    const both = new Set([...p1.calls, ...p2.calls]);
    expect([...due, ...ordinary].every((k) => both.has(k.symbol))).toBe(true); // nobody starved across two runs
  });
  it('battles: due battles whose work never finishes do not stop the rest — due and ordinary are read in turn, each from its own cursor', async () => {
    // 30 due battles that stay outstanding (their activations date to an unmaintained year: deferred every run) and 10 ordinary ones.
    const index = {};
    for (let i = 0; i < 30; i++) {
      const id = `d-${String(i).padStart(2, '0')}`;
      await seedBattle(id, ownerBattle({ activatedAt: '2028-01-04T15:00:00.000Z' }));
      index[id] = { cutoffAt: Date.parse(CUTOFF), expiresAt: Date.parse('2026-11-06T01:00:00.000Z'), finished: false, excludedBy: null };
    }
    for (let i = 0; i < 10; i++) {
      const id = `o-${String(i).padStart(2, '0')}`;
      await seedBattle(id, ownerBattle({ timing: { tradingDays: ['2026-11-09'] }, expiresAt: '2026-11-10T01:00:00.000Z', activatedAt: '2028-01-04T15:00:00.000Z' }));
      index[id] = { cutoffAt: Date.parse('2026-11-10T01:30:00.000Z'), expiresAt: Date.parse('2026-11-10T01:00:00.000Z'), finished: false, excludedBy: null };
    }
    await db.doc('activationObserverState/main').set({ schemaVersion: 1, cursors: {}, battles: index, outstandingKeys: [], updatedAt: null });
    const r1 = await run(clockAt(AT_0145));
    expect([r1.battles.read, r1.battles.due, r1.battles.ordinary]).toEqual([25, 15, 10]);
    const s1 = (await db.doc('activationObserverState/main').get()).data();
    expect(s1.cursors.dueBattles).toBe('d-14');
    const r2 = await run(clockAt(NEXT_1300));
    expect(r2.battles.due).toBe(15);
    const s2 = (await db.doc('activationObserverState/main').get()).data();
    expect(s2.cursors.dueBattles).toBe('d-29'); // d-15 … d-29: the due battles the first run did not reach
    expect(Object.values(s2.battles).filter((b) => b.finished)).toEqual([]); // none could finish, none starved the others
  });
});

describe('review fixes (L2-1, L2-2, L2-6, L4-2)', () => {
  it('L2-1: evidence already in hand is written even when every store call is slow enough to end in the last 2 s', async () => {
    await seedBattle('b-1', ownerBattle());
    await seedFinal('NVDA'); // read in step 9
    const missing = Object.fromEntries(STOCKS.map((s) => [s, 'missing_newest']));
    const p = provider(missing);
    const clock = clockAt(CUTOFF);
    const r = await runActivationObserver({
      db, handlerStartMs: clock.ms(), now: clock.now,
      fetchPayload: async (...a) => { clock.advance(6_100); return p.fetchPayload(...a); }, // three at once: 18.3 s gone, 1.7 s left
      instrument: {},
    });
    expect(r.acquisitionsStarted).toBe(3);
    expect(r.pointers.withEvidence).toBe(1);
    expect((await pointersOf('b-1')).map((x) => x.data.symbol)).toEqual(['NVDA']);
    expect(r.deferred.write_reserve).toBe(3); // the three retryable ones came back with too little left
  });
  it('L2-2: a key whose activations were all written is not carried, so the next run fetches nothing for it', async () => {
    await seedBattle('b-1', ownerBattle());
    const missing = Object.fromEntries(STOCKS.map((s) => [s, 'missing_newest']));
    const r1 = await run(clockAt(CUTOFF), { fetchPayload: provider(missing).fetchPayload });
    expect(r1.pointers.null).toBe(6);
    expect((await db.doc('activationObserverState/main').get()).data().outstandingKeys).toEqual([]);
    const p2 = provider(missing);
    const r2 = await run(clockAt(AT_0145), { fetchPayload: p2.fetchPayload });
    expect([r2.acquisitionsStarted, p2.calls.length, r2.battles.read]).toEqual([0, 0, 0]);
  });
  it('L2-6: a state the run could not read is never overwritten', async () => {
    const carried = [{ snapshotId: snapshotIdOf({ session: SESSION, symbol: 'NVDA', ruleSet: RS }), session: SESSION, symbol: 'NVDA', dueAt: null }];
    const stored = { schemaVersion: 1, cursors: { dueBattles: 'x', ordinaryBattles: null, dueKeys: null, ordinaryKeys: null }, battles: { 'b-old': { cutoffAt: 1, expiresAt: 1, finished: true, excludedBy: 'archetype' } }, outstandingKeys: carried, updatedAt: 'before' };
    await db.doc('activationObserverState/main').set(stored);
    await seedBattle('b-1', ownerBattle());
    const dbx = new Proxy(db, { get(t, k) {
      if (k === 'collection') return (name) => { const c = t.collection(name); if (name !== 'activationObserverState') return c; return { doc: (id) => { const d = c.doc(id); return { get: async () => { throw Object.assign(new Error('14 UNAVAILABLE'), { code: 14 }); }, set: (...a) => d.set(...a) }; } }; };
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    } });
    const r = await run(clockAt(INTRADAY), { dbx });
    expect(r.state).toBe('unreadable');
    expect(r.deferred.state_write_skipped_unread).toBe(1);
    expect(r.pointers.withEvidence).toBe(6); // pointers depend only on §4.2
    expect((await db.doc('activationObserverState/main').get()).data()).toEqual(stored);
  });
  it('L4-2: the owners are queried in an order that turns each run, so a budget that fits one query starves no owner', async () => {
    process.env[ENV] = `${OWNER},${OTHER}`;
    await seedBattle('a-1', ownerBattle());
    await seedBattle('o-1', legacyBattle({ ownerId: OTHER }));
    await seedBattle('o-2', legacyBattle({ ownerId: OTHER }));
    const tight = (kind, c) => { if (kind === 'state') c.advance(5_000); if (kind === 'candidates') c.advance(1_200); };
    const r1 = await run(clockAt(INTRADAY), { before: tight });
    const r2 = await run(clockAt('2026-11-05T15:45:00.000Z'), { before: tight });
    expect([r1.deferred.candidates_unread, r2.deferred.candidates_unread]).toEqual([1, 1]);
    expect([r1.candidates, r2.candidates].sort()).toEqual([1, 2]);
  });
});

describe('final-tick starvation and caps', () => {
  it('a finalisation run whose budget runs out leaves the rest for 01:45, then 13:00', async () => {
    for (let i = 0; i < 3; i++) await seedBattle(`b-${i}`, ownerBattle());
    const missing = Object.fromEntries(STOCKS.map((s) => [s, 'missing_newest']));
    const slowWrites = (kind, c) => { if (kind === 'write_finalize') c.advance(3_000); };
    const total = async () => (await pointersOf('b-0')).length + (await pointersOf('b-1')).length + (await pointersOf('b-2')).length;
    const r1 = await run(clockAt(CUTOFF), { fetchPayload: provider(missing).fetchPayload, before: slowWrites });
    expect(r1.deferred.write_reserve).toBeGreaterThan(0);
    expect(await total()).toBe(r1.pointers.null);
    const r2 = await run(clockAt(AT_0145), { fetchPayload: provider(missing).fetchPayload, before: slowWrites });
    expect(r2.deferred.write_reserve).toBeGreaterThan(0);
    const r3 = await run(clockAt(NEXT_1300), { fetchPayload: provider(missing).fetchPayload });
    expect([r1.pointers.null > 0, r2.pointers.null > 0, r3.pointers.null > 0]).toEqual([true, true, true]);
    expect(r1.pointers.null + r2.pointers.null + r3.pointers.null).toBe(18);
    expect(await total()).toBe(18);
  });
  it('every cap holds, no call or transaction starts without its reserve, and every started call is awaited', async () => {
    for (let i = 0; i < 3; i++) {
      const b = ownerBattle();
      ['star', 'core', 'support'].forEach((tier, t) => b.portfolio[tier].forEach((a, slot) => { if (!a.isCrypto) { a.symbol = `S${i}T${t}${slot}`; b.agentContext.initialPortfolio[tier][slot].symbol = a.symbol; } }));
      await seedBattle(`b-${i}`, b);
    }
    const starts = [];
    let deadline = null;
    let inflight = 0;
    let maxInflight = 0;
    let lastFinishedAt = 0;
    const slow = (to, n, c) => upRows(to);
    const clock = clockAt(INTRADAY);
    deadline = clock.ms() + C.OBSERVER_SLICE_MS;
    const r = await runActivationObserver({
      db, handlerStartMs: clock.ms(), now: clock.now,
      fetchPayload: async (symbol, { to }) => { inflight += 1; maxInflight = Math.max(maxInflight, inflight); clock.advance(2_500); await new Promise((res) => setTimeout(res, 5)); inflight -= 1; lastFinishedAt = clock.ms(); return slow(to); },
      instrument: { before: (kind) => { if (kind === 'acquire' || kind.startsWith('write')) starts.push([kind, deadline - clock.ms()]); } },
    });
    expect(r.acquisitionsStarted).toBeLessThanOrEqual(C.MAX_ACQUISITIONS_PER_RUN);
    expect(maxInflight).toBeLessThanOrEqual(C.ACQUISITION_CONCURRENCY);
    for (const [kind, left] of starts) expect([kind, left >= (kind === 'acquire' ? C.ADMISSION_RESERVE_MS : C.POINTER_WRITE_RESERVE_MS)]).toEqual([kind, true]);
    expect(lastFinishedAt).toBeGreaterThan(deadline - C.ADMISSION_RESERVE_MS); // a call ran on past the admission point …
    expect(r.store.final).toBe(r.acquisitionsStarted); // … and every started call's result was received
    expect(r.pointerTransactions).toBeLessThanOrEqual(C.MAX_POINTER_WRITES_PER_RUN);
  });
});

describe('the state', () => {
  it('lost, stale or unwritable → the same pointers, only later', async () => {
    const reference = async (prep) => {
      const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
      expect(res.ok).toBe(true);
      await seedBattle('b-1', ownerBattle());
      await prep();
      const dbx = prep.unwritable ? new Proxy(db, { get(t, k) {
        if (k === 'collection') return (name) => { const c = t.collection(name); if (name !== 'activationObserverState') return c; return { doc: (id) => { const d = c.doc(id); return { get: () => d.get(), set: async () => { throw new Error('unwritable'); } }; } }; };
        const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
      } }) : db;
      await run(clockAt(INTRADAY), { dbx });
      return (await pointersOf('b-1')).map((p) => ({ ...p.data, observedAt: null })).sort((a, b) => (a.activationId < b.activationId ? -1 : 1));
    };
    const normal = await reference(async () => {});
    const stale = await reference(async () => { await db.doc('activationObserverState/main').set({ schemaVersion: 1, cursors: { dueBattles: 'zzz', ordinaryBattles: 'zzz', dueKeys: 'zzz', ordinaryKeys: 'zzz' }, battles: { 'b-1': { cutoffAt: 0, expiresAt: 0, finished: false, excludedBy: null } }, outstandingKeys: [], updatedAt: 'old' }); });
    const garbage = await reference(async () => { await db.doc('activationObserverState/main').set({ schemaVersion: 'x', battles: 7 }); });
    const unwritableFn = async () => {}; unwritableFn.unwritable = true;
    const unwritable = await reference(unwritableFn);
    expect(stale).toEqual(normal);
    expect(garbage).toEqual(normal);
    expect(unwritable).toEqual(normal);
    expect(normal).toHaveLength(6);
  });
  it('a battle outside scope is marked finished with its reason and not read again', async () => {
    await seedBattle('b-x', ownerBattle({ agentContext: { archetype: 'degen' } }));
    await run(clockAt(INTRADAY));
    const s = (await db.doc('activationObserverState/main').get()).data();
    expect(s.battles['b-x']).toMatchObject({ finished: true, excludedBy: 'archetype' });
    const r2 = await run(clockAt('2026-11-05T15:45:00.000Z'));
    expect(r2.battles.read).toBe(0);
  });
  it('beyond the horizon: finished, its outstanding activations abandoned and counted, never written', async () => {
    await seedBattle('b-1', ownerBattle());
    const r = await run(clockAt('2026-11-09T01:30:00.000Z'));
    expect(r.abandoned.unwritten).toBe(6);
    expect(r.pointerTransactions).toBe(0);
    expect(await pointersOf('b-1')).toEqual([]);
  });
});

describe('the return carries counts only', () => {
  it('no battle, owner, agent, activation or snapshot id, and no symbol, in the result', async () => {
    await seedBattle('SENTINEL_BATTLE_91c2', legacyBattle({ ownerId: 'SENTINEL_OWNER_7f3a', agentId: 'SENTINEL_AGENT_55' }));
    process.env[ENV] = 'SENTINEL_OWNER_7f3a';
    const r = await run(clockAt(INTRADAY));
    expect(r.pointers.withEvidence).toBe(6);
    const text = JSON.stringify(r);
    for (const s of ['SENTINEL', 'NVDA', 'AMD', 'MSFT', 'AAPL', 'star:', SESSION, '__']) expect(text).not.toContain(s);
  });
});

// Keep a reference so lint never calls these unused across edits.
void activationKeyOf;
