// api/_utils/setupMenuLabels/reads.js
//
// Slice 2 — THE OBSERVATION INSIDE A TICK (spec V2 §4, as amended by Correction A of the founder's
// kickoff, 7 Nov 2026). Three calls from agent-evaluate.js, none of which can throw or wait:
//
//   1 FREEZE  freezeSetupMenuPool(tickCapture, battle, inputsOf) — at the existing universe capture.
//             Gate (flag AND allowlist) and scope first: closed, nothing is evaluated and nothing is
//             set, so the record has no `setupMenu` key. Open, the inputs are evaluated INSIDE this
//             function's own try (a throw cannot reach the capture's fault text, Correction C), the
//             pool is frozen without I/O (pool.js), and its block is set as the record's pool fact.
//   2 START   startSetupMenuReads({ db, tickCapture, summary }) — strictly after the tick's decision
//             (the no-trigger branch's first statement; after shouldStartHaikuCall). Starts the reads
//             UN-AWAITED and returns at once: one read of setupMenuLabelState/main and one read per
//             candidate snapshot, each promise with its handlers attached in the expression that
//             creates it. One absolute deadline (LABEL_READ_DEADLINE_MS) SEALS the observation.
//   3 SETTLE  settleSetupMenuReads(observation, tickCapture) — immediately before finalizeTickCapture.
//             Synchronous: seal, take ONLY the results already available, compose once, set the
//             block. There is NO settlement wait (Correction A): an unfinished read is
//             `read_unsettled`, and nothing arriving later patches the record.
//   SEAL      sealSetupMenuReads(observation) — idempotent; in the tick's `finally` on every exit,
//             the error exit included (whose record keeps the pool fact).
//
// SEALED MEANS CLOSED: the deadline timer is cleared, the observation's queued reads are dropped and
// never started, and a late result is ignored — the composed block is deep-frozen besides.
//
// THE RUN MEMO (Correction A: bounded memoized work across ticks). One per handler invocation, keyed
// on the invocation's own `summary` object (a WeakMap, so it lives exactly as long as the run): one
// state read per run; one read per snapshot id per run, shared by every tick that wants it; at most
// LABEL_READ_CONCURRENCY in flight across the run; at most LABEL_READS_PER_RUN_MAX issued. A read's
// in-flight slot is released when it settles or LABEL_READ_SLOT_MS after it was issued, so a hung read
// cannot starve a later tick; releasing a slot does NOT cancel the RPC (nothing here can). Already
// issued read-only RPCs are never awaited: they settle into the memo or die with the invocation.
//
// COST, honestly: no wait, but not free — the reads are real Firestore reads, the composition is CPU on
// the tick's path, and the block is bytes the capture serializes and commits (≤ 24 KiB). The record
// carries `readsIssued` and `readsShared` per tick.
//
// setupEvidenceImportGuard.test.js lists this file. It never imports getOrAcquireSnapshot.

import { lastCompletedSessionAt, readSnapshot, ruleKeyOf, snapshotIdOf } from '../setupEvidence/index.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import { LABEL_READ_CONCURRENCY, LABEL_READ_DEADLINE_MS, LABEL_READ_SLOT_MS, LABEL_READS_PER_RUN_MAX } from './constants.js';
import { setupMenuLabelsAdmits } from './gate.js';
import { candidatesOf, poolScopeAdmits, selectorOf } from './pool.js';
import { composeSetupMenuBlock, errorBlockOf } from './compose.js';
import { readLabelState } from './state.js';

/** The real clock and timers; a test passes its own. Timers never hold the process open. */
export const REAL_ENV = Object.freeze({
  now: () => Date.now(),
  setTimer: (fn, ms) => { const t = setTimeout(fn, ms); t?.unref?.(); return t; },
  clearTimer: (t) => clearTimeout(t),
});

/** tickCapture → its frozen pool and observation. Off the record: the record carries only the block. */
const POOLS = new WeakMap();
/** summary (one per handler invocation) → the run memo. */
const MEMOS = new WeakMap();

const freshMemo = () => ({ state: null, reads: new Map(), inflight: 0, issued: 0, waiting: [] });

/** The run memo of an invocation; a missing or primitive key gets an unshared one. Exported for tests. */
export function runMemoOf(summary) {
  if (summary === null || (typeof summary !== 'object' && typeof summary !== 'function')) return freshMemo();
  let memo = MEMOS.get(summary);
  if (!memo) { memo = freshMemo(); MEMOS.set(summary, memo); }
  return memo;
}

const safe = (fn) => { try { fn(); } catch { /* an observation callback can never reach the tick */ } };

/** Set the block on the live context. The context's setter swallows its own errors and never writes `faulted`. */
function setBlock(tickCapture, block) {
  safe(() => tickCapture.setupMenu(block));
}

// ---------------------------------------------------------------- 1. FREEZE

/**
 * @param {object} tickCapture the tick's capture context (the inert NOOP when capture is off)
 * @param {object} battle the battle, for the gate and scope (read before anything else is evaluated)
 * @param {() => { hotBenchSymbols, assetMapKeys, benchAtFreeze, heldAtFreeze, rebuilt, selector, isTournament, frozenAtMs }} inputsOf
 */
export function freezeSetupMenuPool(tickCapture, battle, inputsOf, { env = REAL_ENV } = {}) {
  try {
    if (tickCapture?.enabled !== true) return; // capture off: the inert context, nothing to record
    if (!setupMenuLabelsAdmits(battle?.ownerId)) return; // flag off or owner not allowlisted: nothing at all
    // The battle's scope BEFORE any input is evaluated (review SM1-2): an out-of-scope battle gets no block, even an
    // error one. scopeOf already excludes the tournament mode; the tick's own tournament context is checked below.
    if (!poolScopeAdmits(battle, { isTournament: false })) return;
    let input;
    let frozenAtMs = env.now();
    let pool = { frozenAtMs, session: null, calendarMissing: false, ruleSet: null, selector: null, rebuilt: null, list: null };
    try {
      input = inputsOf();
      if (input?.isTournament === true) return; // a tournament context: nothing
      if (Number.isFinite(input?.frozenAtMs)) frozenAtMs = input.frozenAtMs;
      const ruleSet = describeRuleSet();
      pool = { ...pool, frozenAtMs, ruleSet };
      ruleKeyOf(ruleSet); // a malformed deployed rule set: the error form, never a guess
      const cal = lastCompletedSessionAt(frozenAtMs); // the calendar's tables; no I/O
      const session = cal.ok ? cal.session : null;
      const ids = new Map();
      const classify = (symbol) => {
        if (isCryptoSymbol(symbol)) return 'excluded';
        if (session === null) return null;
        try { ids.set(symbol, snapshotIdOf({ session, symbol, ruleSet })); return null; } catch { return 'symbol_form'; }
      };
      const list = candidatesOf({
        hotBenchSymbols: input.hotBenchSymbols, assetMapKeys: input.assetMapKeys,
        benchAtFreeze: input.benchAtFreeze, heldAtFreeze: input.heldAtFreeze, classify,
      });
      pool = { ...pool, session, calendarMissing: !cal.ok, selector: selectorOf(input.selector), rebuilt: input.rebuilt === true, list, ids, observation: null };
    } catch {
      setBlock(tickCapture, errorBlockOf(pool, 'freeze_failed'));
      return;
    }
    POOLS.set(tickCapture, pool);
    setBlock(tickCapture, composeSetupMenuBlock(pool, null)); // the pool fact: an honest record if nothing else happens
  } catch { /* nothing escapes into the tick */ }
}

// ---------------------------------------------------------------- 2. START

function deliver(obs, symbol, rec) {
  if (obs.closed) return; // a late result never mutates a sealed observation
  obs.results.set(symbol, rec.ok ? { ok: true, value: rec.value } : { ok: false });
}

function deliverState(obs, rec) {
  if (obs.closed) return;
  obs.stateSettled = true;
  obs.stateRead = rec.ok === true && rec.value?.status !== 'unreadable';
  obs.stateEntries = obs.stateRead ? (rec.value?.state?.attempts ?? {}) : null;
}

function subscribe(rec, fn) {
  if (rec.settled) safe(() => fn(rec)); else rec.subs.add(fn);
}

function settleRec(memo, rec, ok, value, env) {
  if (rec.settled) return;
  rec.settled = true;
  rec.ok = ok;
  rec.value = ok ? value : null;
  releaseSlot(memo, rec, env);
  const subs = [...rec.subs];
  rec.subs.clear();
  for (const fn of subs) safe(() => fn(rec));
}

function releaseSlot(memo, rec, env) {
  if (!rec.slotHeld) return;
  rec.slotHeld = false;
  if (rec.slotTimer !== null) safe(() => env.clearTimer(rec.slotTimer));
  rec.slotTimer = null;
  memo.inflight -= 1;
  pump(memo, env);
}

/** Issue one snapshot read into the memo. Its handlers are attached in the same expression that creates it. */
function issue(memo, { db, id, session, symbol, ruleSet }, env) {
  const rec = { settled: false, ok: null, value: null, subs: new Set(), slotHeld: true, slotTimer: null };
  memo.reads.set(id, rec);
  memo.issued += 1;
  memo.inflight += 1;
  rec.slotTimer = env.setTimer(() => releaseSlot(memo, rec, env), LABEL_READ_SLOT_MS);
  let promise;
  try { promise = Promise.resolve(readSnapshot({ db, session, symbol, ruleSet })); } catch (err) { promise = Promise.reject(err); }
  promise.then((value) => settleRec(memo, rec, true, value ?? null, env), () => settleRec(memo, rec, false, null, env));
  return rec;
}

/** Start queued reads while slots are free; a closed observation's entries are dropped, never started. */
function pump(memo, env) {
  while (memo.inflight < LABEL_READ_CONCURRENCY && memo.waiting.length > 0) {
    const w = memo.waiting.shift();
    if (w.obs.closed) continue;
    want(memo, w.obs, w.symbol, env, { queued: true });
  }
}

/** One candidate's read: shared from the memo, issued, queued, or (past the run cap) left unsettled. */
function want(memo, obs, symbol, env, { queued = false } = {}) {
  const pool = obs.pool;
  const id = pool.ids.get(symbol);
  const existing = memo.reads.get(id);
  if (existing) {
    obs.readsShared += 1;
    subscribe(existing, (rec) => deliver(obs, symbol, rec));
    return;
  }
  if (memo.issued >= LABEL_READS_PER_RUN_MAX) return; // the run's cap: never read, `read_unsettled`
  if (memo.inflight >= LABEL_READ_CONCURRENCY) {
    if (!queued) memo.waiting.push({ obs, symbol });
    else memo.waiting.unshift({ obs, symbol });
    return;
  }
  obs.readsIssued += 1;
  const rec = issue(memo, { db: obs.db, id, session: pool.session, symbol, ruleSet: pool.ruleSet }, env);
  subscribe(rec, (r) => deliver(obs, symbol, r));
}

/**
 * Start the reads for this tick's frozen pool, un-awaited. Returns the observation, or null when there is
 * nothing to observe (capture off, no pool, the calendar could not name the session). Never throws.
 */
export function startSetupMenuReads({ db, tickCapture, summary, env = REAL_ENV } = {}) {
  try {
    if (tickCapture?.enabled !== true) return null;
    const pool = POOLS.get(tickCapture);
    if (!pool || pool.calendarMissing || !pool.list) return null;
    if (pool.observation) return pool.observation; // one observation per tick
    const memo = runMemoOf(summary);
    const startedAtMs = env.now();
    const obs = {
      pool, db, memo, closed: false, startedAtMs, sealedAtMs: null,
      results: new Map(), stateSettled: false, stateRead: false, stateEntries: null,
      readsIssued: 0, readsShared: 0, timer: null,
    };
    pool.observation = obs;
    obs.timer = env.setTimer(() => sealSetupMenuReads(obs, { env }), LABEL_READ_DEADLINE_MS);

    // The state: one read per run, shared; its own handlers attached at creation (state.js never rejects; belt and braces).
    if (!memo.state) {
      const rec = { settled: false, ok: null, value: null, subs: new Set() };
      memo.state = rec;
      let promise;
      try { promise = Promise.resolve(readLabelState(db)); } catch (err) { promise = Promise.reject(err); }
      promise.then(
        (value) => { if (rec.settled) return; rec.settled = true; rec.ok = true; rec.value = value; const s = [...rec.subs]; rec.subs.clear(); for (const fn of s) safe(() => fn(rec)); },
        () => { if (rec.settled) return; rec.settled = true; rec.ok = false; rec.value = null; const s = [...rec.subs]; rec.subs.clear(); for (const fn of s) safe(() => fn(rec)); },
      );
    }
    subscribe(memo.state, (rec) => deliverState(obs, rec));

    for (const c of pool.list.candidates) {
      if (c.status !== 'read_unsettled' || !pool.ids.has(c.symbol)) continue;
      want(memo, obs, c.symbol, env);
    }
    return obs;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- SEAL / 3. SETTLE

/** Close the observation: idempotent, never throws. Its timer is cleared and its queued reads dropped. */
export function sealSetupMenuReads(obs, { env = REAL_ENV } = {}) {
  try {
    if (!obs || obs.closed) return;
    obs.closed = true;
    obs.sealedAtMs = env.now();
    if (obs.timer !== null) safe(() => env.clearTimer(obs.timer));
    obs.timer = null;
    if (obs.memo) obs.memo.waiting = obs.memo.waiting.filter((w) => w.obs !== obs);
  } catch { /* nothing escapes */ }
}

/** What the observation holds at its seal, as the composer reads it: copies, never the live maps. */
function snapshotOfObservation(obs) {
  const pool = obs.pool;
  const stateBySymbol = new Map();
  if (obs.stateRead && obs.stateEntries) {
    for (const [symbol, id] of pool.ids) {
      const entry = Object.hasOwn(obs.stateEntries, id) ? obs.stateEntries[id] : null;
      stateBySymbol.set(symbol, entry);
    }
  }
  return {
    readsStartedAtMs: obs.startedAtMs,
    observedAtMs: obs.sealedAtMs,
    stateRead: obs.stateRead === true,
    stateBySymbol,
    results: new Map(obs.results),
    readsIssued: obs.readsIssued,
    readsShared: obs.readsShared,
  };
}

/**
 * At the capture stage, immediately before finalizeTickCapture: seal, compose from what is available
 * NOW, set the block. Synchronous; no wait of any length; never throws.
 */
export function settleSetupMenuReads(obs, tickCapture, { env = REAL_ENV } = {}) {
  try {
    sealSetupMenuReads(obs, { env });
    if (!obs || tickCapture?.enabled !== true) return;
    setBlock(tickCapture, composeSetupMenuBlock(obs.pool, snapshotOfObservation(obs)));
  } catch {
    safe(() => setBlock(tickCapture, errorBlockOf(obs?.pool, 'compose_failed')));
  }
}
