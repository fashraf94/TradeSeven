// api/_utils/setupMenuLabels/reads.test.js
//
// Slice 2 — the observation inside a tick (spec V2 §4; Correction A): the freeze is gate-first and
// contained, reads start un-awaited, the capture takes ONLY what is already available (no wait), and a
// sealed observation is closed — its timer cleared, its queued reads dropped, late results ignored.
// One run memo per handler invocation bounds the reads across ticks, a prior tick's hung reads included.
// A manual clock and manual timers drive every row; reads come from an in-memory `setupEvidence`
// collection whose documents can be held, released or failed one by one.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../src/config/setupMenuLabelsFlags.js', () => ({ get SETUP_MENU_LABELS_ENABLED() { return flag.on; } }));

const { freezeSetupMenuPool, startSetupMenuReads, settleSetupMenuReads, sealSetupMenuReads, runMemoOf } = await import('./reads.js');
const { createTickCaptureContext, runWithTickCaptureScope, NOOP_TICK_CAPTURE } = await import('../tickCapture/captureContext.js');
const { makeMemoryDb } = await import('./__fixtures__/memoryDb.js');
const { menuSnapshotSet } = await import('./__fixtures__/menuSnapshots.js');
const { snapshotIdOf } = await import('../setupEvidence/index.js');
const { describeRuleSet } = await import('../setupEvaluator/thresholds.js');
const { LABEL_READ_CONCURRENCY, LABEL_READ_DEADLINE_MS, LABEL_READ_SLOT_MS, LABEL_READS_PER_RUN_MAX } = await import('./constants.js');

const FROZEN = Date.parse('2026-09-09T15:00:00.000Z'); // Wed, 11:00 ET → last completed session Tue 2026-09-08
const SESSION = '2026-09-08';
const ruleSet = describeRuleSet();
const idOf = (symbol) => snapshotIdOf({ session: SESSION, symbol, ruleSet });
const BATTLE = Object.freeze({ id: 'b1', ownerId: 'owner-1', gameMode: 'baggerbomb_agent', agentId: 'agent-1', agentContext: { archetype: 'momentum_chaser' } });
const STATE_PATH = 'setupMenuLabelState/main';

let fx;
beforeAll(async () => { fx = await menuSnapshotSet({ session: SESSION, fetchedAt: '2026-09-09T13:00:00.000Z' }); });
const prevAllowlist = process.env.COCKPIT_ALLOWLIST_UIDS;
beforeEach(() => { flag.on = true; process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-1'; });
afterEach(() => { if (prevAllowlist === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = prevAllowlist; });

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

/** A manual clock and timer queue: nothing fires until a row advances time. */
function manual(startMs = FROZEN) {
  let now = startMs;
  let seq = 0;
  const timers = new Map();
  return {
    env: {
      now: () => now,
      setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; },
      clearTimer: (id) => { timers.delete(id); },
    },
    timers,
    async advance(ms) {
      now += ms;
      for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (t.at <= now && timers.has(id)) { timers.delete(id); t.fn(); }
      await flush();
    },
  };
}

/** A deferred document read: `hold(path)` makes the next read of `path` wait for `release(path)` / `fail(path)`. */
function holdable(db) {
  const held = new Map();
  const hold = (path) => {
    let resolve; let reject;
    const gate = new Promise((res, rej) => { resolve = res; reject = rej; });
    held.set(path, { resolve, reject });
    db.onGet(path, () => gate);
  };
  return {
    hold,
    release: async (path) => { held.get(path).resolve(); await flush(); },
    fail: async (path) => { held.get(path).reject(new Error('read failed (injected)')); await flush(); },
  };
}

function inputs(over = {}) {
  return () => ({
    hotBenchSymbols: ['AAPL', 'MSFT', 'NFLX'], assetMapKeys: [], benchAtFreeze: ['AAPL'], heldAtFreeze: [],
    rebuilt: false, selector: 'carried', isTournament: false, frozenAtMs: FROZEN, ...over,
  });
}
const liveCtx = () => createTickCaptureContext({ battleId: 'b1', tickSeq: 1, enabled: true });
const docsFor = (symbols) => Object.fromEntries(symbols.filter((s) => fx[s]).map((s) => [`setupEvidence/${idOf(s)}`, fx[s].snapshot]));
const cand = (ctx, symbol) => ctx.state.setupMenu.candidates.find((c) => c.symbol === symbol);

describe('FREEZE — gate first, contained, pure', () => {
  it('flag off: the inputs are never evaluated, nothing is set, no state key exists', () => runWithTickCaptureScope(() => {
    flag.on = false;
    const ctx = liveCtx();
    const inputsOf = vi.fn(inputs());
    freezeSetupMenuPool(ctx, BATTLE, inputsOf);
    expect(inputsOf).not.toHaveBeenCalled();
    expect(Object.hasOwn(ctx.state, 'setupMenu')).toBe(false);
  }));
  it('owner not on the allowlist, out of scope, a tournament: nothing set', () => runWithTickCaptureScope(() => {
    for (const [battle, over] of [[{ ...BATTLE, ownerId: 'someone-else' }, {}], [{ ...BATTLE, agentContext: { archetype: 'analyst' } }, {}], [BATTLE, { isTournament: true }]]) {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, battle, inputs(over));
      expect(Object.hasOwn(ctx.state, 'setupMenu')).toBe(false);
    }
  }));
  it('capture off (the inert NOOP): nothing evaluated, nothing thrown', () => {
    const inputsOf = vi.fn(inputs());
    expect(() => freezeSetupMenuPool(NOOP_TICK_CAPTURE, BATTLE, inputsOf)).not.toThrow();
    expect(inputsOf).not.toHaveBeenCalled();
    expect(startSetupMenuReads({ db: makeMemoryDb(), tickCapture: NOOP_TICK_CAPTURE, summary: {} })).toBeNull();
  });
  it('1.10 the freeze makes no I/O, and its session comes from the freeze instant, not from when reads start', () => runWithTickCaptureScope(() => {
    const ctx = liveCtx();
    freezeSetupMenuPool(ctx, BATTLE, inputs({ frozenAtMs: Date.parse('2026-09-08T21:00:00.000Z') })); // after Tue's close → Tue
    expect(ctx.state.setupMenu).toMatchObject({ session: '2026-09-08', blockStatus: 'reads_unsettled', frozenAt: '2026-09-08T21:00:00.000Z', readsStartedAt: null });
    freezeSetupMenuPool(ctx, BATTLE, inputs({ frozenAtMs: Date.parse('2026-09-08T19:00:00.000Z') })); // before Tue's close → Fri (Mon is Labor Day)
    expect(ctx.state.setupMenu.session).toBe('2026-09-04');
  }));
  it('C-6 a throwing input (a bench whose stocks are a truthy non-array) is contained: the error form, and `faulted` stays null', () => runWithTickCaptureScope(() => {
    const ctx = liveCtx();
    freezeSetupMenuPool(ctx, BATTLE, () => { const bench = { stocks: 7 }; return { ...inputs()(), benchAtFreeze: bench.stocks.map((a) => a) }; });
    expect(ctx.state.setupMenu).toMatchObject({ blockStatus: 'error', errorCode: 'freeze_failed' });
    expect(ctx.state.faulted).toBeNull();
  }));
});

describe('START → SETTLE — no wait: only what is already available (Correction A)', () => {
  it('A-3 (row 1.3 corrected): a state read resolving at 2,900 ms is NOT available on an immediate exit → stateRead false, every s2 field null', async () => {
    const db = makeMemoryDb({ docs: docsFor(['AAPL']) });
    const h = holdable(db);
    h.hold(STATE_PATH);
    const m = manual();
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: ['AAPL'] }), { env: m.env });
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {}, env: m.env });
      await flush(); // the snapshot read is immediate; the state read is held
      settleSetupMenuReads(obs, ctx, { env: m.env }); // the immediate no-trigger exit: settle at once
      expect(ctx.state.setupMenu.stateRead).toBe(false);
      expect(cand(ctx, 'AAPL')).toMatchObject({ status: 'labelled', s2Entry: null, s2Reservations: null, s2LastOutcome: null, s2Exhausted: null });
      await m.advance(2_900);
      await h.release(STATE_PATH); // it resolves now — too late, and it changes nothing
      expect(ctx.state.setupMenu.stateRead).toBe(false);
    });
  });
  it('A-4 when the tick\'s own work outlasts the reads, they are available at the capture with no added wait', async () => {
    const db = makeMemoryDb({ docs: { ...docsFor(['AAPL', 'MSFT']), [STATE_PATH]: { schemaVersion: 1, attempts: { [idOf('NFLX')]: { session: SESSION, n: 2, lastOutcome: 'retryable', lastAt: FROZEN - 60_000 } } } } });
    const m = manual();
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs(), { env: m.env });
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {}, env: m.env });
      await m.advance(1_200); // the model call
      settleSetupMenuReads(obs, ctx, { env: m.env });
      const b = ctx.state.setupMenu;
      expect(b).toMatchObject({ blockStatus: 'ok', stateRead: true, readsIssued: 3, readsShared: 0, readsStartedAt: new Date(FROZEN).toISOString(), observedAt: new Date(FROZEN + 1_200).toISOString() });
      expect(b.candidates.map((c) => c.status)).toEqual(['labelled', 'labelled', 'absent']);
      expect(cand(ctx, 'NFLX')).toMatchObject({ s2Entry: true, s2Reservations: 2, s2LastOutcome: 'retryable' });
      expect(cand(ctx, 'AAPL')).toMatchObject({ inBenchAtFreeze: true });
    });
  });
  it('A-5 / 1.5 a result arriving after the seal patches nothing: the recorded block is frozen and the observation\'s results unchanged', async () => {
    const db = makeMemoryDb({ docs: docsFor(['AAPL']) });
    const h = holdable(db);
    h.hold(`setupEvidence/${idOf('AAPL')}`);
    const m = manual();
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: ['AAPL'] }), { env: m.env });
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {}, env: m.env });
      await flush();
      settleSetupMenuReads(obs, ctx, { env: m.env });
      const recorded = structuredClone(ctx.state.setupMenu);
      const resultsAtSeal = new Map(obs.results);
      await h.release(`setupEvidence/${idOf('AAPL')}`);
      expect(ctx.state.setupMenu).toEqual(recorded);
      expect(Object.isFrozen(ctx.state.setupMenu)).toBe(true);
      expect(obs.results).toEqual(resultsAtSeal);
      expect(cand(ctx, 'AAPL').status).toBe('read_unsettled');
      expect(ctx.state.setupMenu.blockStatus).toBe('reads_unsettled');
    });
  });
  it('A-6 rejected reads are read_failed, a rejected state read is stateRead false, and no rejection goes unhandled', async () => {
    const unhandled = [];
    const onUnhandled = (r) => unhandled.push(r);
    process.on('unhandledRejection', onUnhandled);
    try {
      const db = makeMemoryDb({ docs: docsFor(['AAPL']) });
      db.onGet(`setupEvidence/${idOf('MSFT')}`, async () => { throw new Error('denied'); });
      db.onGet(STATE_PATH, async () => { throw new Error('denied'); });
      const m = manual();
      await runWithTickCaptureScope(async () => {
        const ctx = liveCtx();
        freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: ['AAPL', 'MSFT'] }), { env: m.env });
        const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {}, env: m.env });
        await m.advance(10);
        settleSetupMenuReads(obs, ctx, { env: m.env });
        expect(ctx.state.setupMenu.candidates.map((c) => c.status)).toEqual(['labelled', 'read_failed']);
        expect(ctx.state.setupMenu.stateRead).toBe(false);
      });
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('NO WAIT, structurally (Correction A)', () => {
  it('freeze, start, settle and seal are synchronous functions: none returns a promise, so none can be awaited into a wait', async () => {
    const db = makeMemoryDb();
    db.onGet('setupEvidence/*', () => new Promise(() => {}));
    db.onGet(STATE_PATH, () => new Promise(() => {}));
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      for (const fn of [freezeSetupMenuPool, startSetupMenuReads, settleSetupMenuReads, sealSetupMenuReads]) expect(fn.constructor.name).toBe('Function');
      expect(freezeSetupMenuPool(ctx, BATTLE, inputs())).toBeUndefined();
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {} });
      expect(obs).not.toBeInstanceOf(Promise);
      expect(settleSetupMenuReads(obs, ctx)).toBeUndefined();
      expect(sealSetupMenuReads(obs)).toBeUndefined();
      expect(ctx.state.setupMenu.blockStatus).toBe('reads_unsettled');
    });
  });
});

describe('SEAL — closed means closed (Correction A)', () => {
  it('A-7 / A-9 the error exit seals: the deadline timer is cleared, later results are ignored, the pool fact stays', async () => {
    const db = makeMemoryDb({ docs: docsFor(['AAPL']) });
    const h = holdable(db);
    h.hold(`setupEvidence/${idOf('AAPL')}`);
    const m = manual();
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: ['AAPL'] }), { env: m.env });
      const poolFact = ctx.state.setupMenu;
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {}, env: m.env });
      expect(m.timers.size).toBe(2); // the observation's deadline and the read's slot
      sealSetupMenuReads(obs, { env: m.env });
      sealSetupMenuReads(obs, { env: m.env }); // idempotent
      expect([...m.timers.values()].map((t) => t.at)).toEqual([FROZEN + LABEL_READ_SLOT_MS]); // only the read's own slot timer remains
      await h.release(`setupEvidence/${idOf('AAPL')}`);
      expect(obs.results.size).toBe(0);
      expect(ctx.state.setupMenu).toBe(poolFact);
    });
  });
  it('the deadline seals the observation: a read resolving after 3 s is unsettled on the record', async () => {
    const db = makeMemoryDb({ docs: docsFor(['AAPL']) });
    const h = holdable(db);
    h.hold(`setupEvidence/${idOf('AAPL')}`);
    const m = manual();
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: ['AAPL'] }), { env: m.env });
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {}, env: m.env });
      await m.advance(LABEL_READ_DEADLINE_MS);
      expect(obs.closed).toBe(true);
      await h.release(`setupEvidence/${idOf('AAPL')}`);
      await m.advance(30_000); // the capture, much later
      settleSetupMenuReads(obs, ctx, { env: m.env });
      expect(cand(ctx, 'AAPL').status).toBe('read_unsettled');
      expect(ctx.state.setupMenu.observedAt).toBe(new Date(FROZEN + LABEL_READ_DEADLINE_MS).toISOString());
    });
  });
  it('A-8 queue closure: past the run\'s in-flight limit, queued reads never start once the observation is sealed', async () => {
    const symbols = Array.from({ length: 10 }, (_, i) => `Q${i}`);
    const db = makeMemoryDb();
    db.onGet('setupEvidence/*', () => new Promise(() => {})); // every snapshot read hangs
    const m = manual();
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: symbols }), { env: m.env });
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {}, env: m.env });
      await flush();
      const snapshotGets = () => db.__log.gets.filter((p) => p.startsWith('setupEvidence/')).length;
      expect(snapshotGets()).toBe(LABEL_READ_CONCURRENCY);
      settleSetupMenuReads(obs, ctx, { env: m.env });
      await m.advance(LABEL_READ_SLOT_MS); // the slots free up — the queue is gone
      expect(snapshotGets()).toBe(LABEL_READ_CONCURRENCY);
      expect(ctx.state.setupMenu.counts.unsettled).toBe(10);
      expect(ctx.state.setupMenu.readsIssued).toBe(LABEL_READ_CONCURRENCY);
    });
  });
});

describe('THE RUN MEMO — bounded work across ticks (Correction A)', () => {
  it('A-10 two battles on one handler clock: a hung read of battle 1 is shared, never re-issued, and holds no slot past its own 3 s', async () => {
    const db = makeMemoryDb({ docs: docsFor(['MSFT']) });
    db.onGet(`setupEvidence/${idOf('AAPL')}`, () => new Promise(() => {})); // hangs forever
    const m = manual();
    const summary = {};
    const tick = async (hot, settleAfterMs) => runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: hot }), { env: m.env });
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary, env: m.env });
      await m.advance(settleAfterMs);
      settleSetupMenuReads(obs, ctx, { env: m.env });
      return ctx.state.setupMenu;
    });
    const first = await tick(['AAPL'], 1_000);
    expect(first.readsIssued).toBe(1);
    await m.advance(LABEL_READ_SLOT_MS);
    expect(runMemoOf(summary).inflight).toBe(0); // the slot is released; the RPC itself is not cancelled
    const second = await tick(['AAPL', 'MSFT'], 50);
    expect(second).toMatchObject({ readsIssued: 1, readsShared: 1, stateRead: true });
    expect(second.candidates.map((c) => c.status)).toEqual(['read_unsettled', 'labelled']);
    expect(db.__log.gets.filter((p) => p === `setupEvidence/${idOf('AAPL')}`)).toHaveLength(1);
    expect(db.__log.gets.filter((p) => p === STATE_PATH)).toHaveLength(1); // one state read per run
  });
  it('a NEW invocation (another summary) reads again; the memo never leaks across runs', async () => {
    const db = makeMemoryDb({ docs: docsFor(['MSFT']) });
    const m = manual();
    for (const summary of [{}, {}]) {
      await runWithTickCaptureScope(async () => {
        const ctx = liveCtx();
        freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: ['MSFT'] }), { env: m.env });
        settleSetupMenuReads(startSetupMenuReads({ db, tickCapture: ctx, summary, env: m.env }), ctx, { env: m.env });
      });
    }
    expect(db.__log.gets.filter((p) => p.startsWith('setupEvidence/'))).toHaveLength(2);
  });
  it('the run cap: no more than LABEL_READS_PER_RUN_MAX reads are issued in one invocation', async () => {
    const db = makeMemoryDb();
    const m = manual();
    const summary = {};
    const symbols = Array.from({ length: LABEL_READS_PER_RUN_MAX + 30 }, (_, i) => `R${i}`);
    for (let i = 0; i < symbols.length; i += 40) {
      await runWithTickCaptureScope(async () => {
        const ctx = liveCtx();
        freezeSetupMenuPool(ctx, BATTLE, inputs({ hotBenchSymbols: symbols.slice(i, i + 40) }), { env: m.env });
        const obs = startSetupMenuReads({ db, tickCapture: ctx, summary, env: m.env });
        for (let k = 0; k < 20; k++) await flush();
        settleSetupMenuReads(obs, ctx, { env: m.env });
      });
    }
    expect(runMemoOf(summary).issued).toBe(LABEL_READS_PER_RUN_MAX);
    expect(db.__log.gets.filter((p) => p.startsWith('setupEvidence/'))).toHaveLength(LABEL_READS_PER_RUN_MAX);
  });
  it('the calendar cannot name the session: the pool fact says so and no read starts', async () => {
    const db = makeMemoryDb();
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs({ frozenAtMs: Date.parse('2031-06-01T15:00:00.000Z') }));
      expect(ctx.state.setupMenu.blockStatus).toBe('calendar_missing');
      expect(startSetupMenuReads({ db, tickCapture: ctx, summary: {} })).toBeNull();
    });
    expect(db.__log.gets).toEqual([]);
  });
  it('the reader writes nothing and logs nothing', async () => {
    const log = vi.spyOn(console, 'log');
    const warn = vi.spyOn(console, 'warn');
    const db = makeMemoryDb({ docs: docsFor(['AAPL']) });
    await runWithTickCaptureScope(async () => {
      const ctx = liveCtx();
      freezeSetupMenuPool(ctx, BATTLE, inputs());
      const obs = startSetupMenuReads({ db, tickCapture: ctx, summary: {} });
      await flush();
      settleSetupMenuReads(obs, ctx);
    });
    expect(db.__log.sets).toEqual([]);
    expect(db.__log.transactions).toBe(0);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    log.mockRestore(); warn.mockRestore();
  });
});
