// api/_utils/activationEvidence/tenant.js
//
// ID-1 Build 2 — THE OBSERVER, the sixth tenant of
// api/cron/process-pending-reflections.js (contract §4.3; build prompt V3 §4).
// One run, exactly:
//
//   1  Gate. Flag off, or an empty allowlist → { skipped: true } before any read.
//   2  Deadline = min(tenantStart + 20 s, handlerStart + 80 s): an ADMISSION
//      deadline. Less than 15 s left → { deferred: 'no_budget' }, no read.
//   PREPARATION (3–9): no preparation read starts after tenantStart + 6 s.
//   3  State: activationObserverState/main (absent or unreadable → empty).
//   4  Candidates: per allowlisted owner, an owner-scoped, ids-only query on
//      agentBattles (createdAt ≥ now − 14 days, newest first, 200 a page).
//   5  Battle queues: due (stored cutoffAt/expiresAt), unseen, ordinary, taken
//      in turn, due and ordinary each from its own cursor, ≤ 25 read.
//   6  Per battle: scope; lifetimes and activations; every pointer id in one
//      getAll; beyond the horizon → finished, outstanding work abandoned; due
//      with nothing outstanding → finished. Attribution is resolved here, once
//      per battle with unwritten work, and held in run memory only.
//   7  Ticks, only for unwritten swap-ins: the capturedAt windows, ≤ 400 docs.
//   8  Keys: lastCompletedSessionAt → calendar_missing defers (never written);
//      snapshotIdOf → symbol_form is unresolved; grouped by snapshot id.
//   9  Final reads, due keys first.
//   ACQUISITION (10): due and ordinary keys in turn (own cursors), plus the
//      carried keys; a store call starts only with ≥ 7 s left, ≤ 12 per run, ≤ 3
//      at once; every started call is awaited to its end, never raced.
//   WRITES (11–12), one cap of 30, each transaction only with ≥ 2 s left,
//      finalisation-due first: with evidence; and at finalisation, for a key
//      whose store call IN THIS RUN returned `retryable`, createAtFinalization.
//   13 State, if ≥ 1 s left: cursors, battle index, ≤ 50 carried keys, one write.
//   14 Counts only, no ids.
//
// Overlapping runs (Vercel can deliver a cron twice) may both call the store on
// one key: one gets `pending` and defers. Both may reach one pointer: one
// `create` wins. Both may write the state: the last write wins, at no cost to any
// pointer. The tenant never throws past its caller's isolating try/catch except
// on a programming error (a malformed deployed rule set).
//
// `now` is a function returning a Date (production: () => new Date()); it is the
// clock for every budget decision and is handed to the store unchanged.
// `instrument.before(kind)` is a test seam awaited before every I/O call starts;
// production passes none. setupEvidenceImportGuard.test.js lists this file.

import { getOrAcquireSnapshot, readSnapshot, ruleKeyOf, snapshotIdOf } from '../setupEvidence/index.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';
import {
  ACQUISITION_CONCURRENCY, ACTIVATIONS_SUBCOLLECTION, ADMISSION_RESERVE_MS, BATTLE_FIELDS, BATTLE_READ_CHUNK, CANDIDATE_LOOKBACK_DAYS,
  CATCH_UP_HORIZON_DAYS, DAY_MS, MAX_ACQUISITIONS_PER_RUN, MAX_BATTLES_PER_RUN, MAX_CANDIDATE_IDS_PER_OWNER, MAX_CARRIED_KEYS,
  MAX_POINTER_WRITES_PER_RUN, MAX_TICK_DOCS_PER_BATTLE, MIN_RUN_MS, OBSERVER_ADMISSION_CEILING_MS, OBSERVER_SLICE_MS,
  POINTER_WRITE_RESERVE_MS, PREP_BUDGET_MS, STATE_SCHEMA_VERSION, STATE_WRITE_RESERVE_MS, TICK_FIELDS,
} from './constants.js';
import { activationEvidenceOwners } from './gate.js';
import { scopeOf } from './scope.js';
import { discoverActivations, activationKeyOf } from './discover.js';
import { isBeyondHorizon, isFinalizationDue } from './schedule.js';
import { joinTick, tickWindowsOf } from './tick.js';
import { buildPointer, snapshotServes } from './pointer.js';
import { attributionOf } from './attribution.js';
import { createAtFinalization, createWithEvidence } from './writer.js';
import { emptyState, readObserverState, writeObserverState } from './state.js';
import { isoOf } from './lifetimes.js';

export { BATTLE_FIELDS, TICK_FIELDS };
const HOST = 'activation-observer';

const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
const errorCodeOf = (err) => String(err?.code ?? err?.name ?? 'unknown').slice(0, 40);

/** Ids in ascending order, starting after the cursor and wrapping (each run resumes where the last stopped). */
function rotate(ids, cursor) {
  const sorted = [...ids].sort();
  if (!cursor) return sorted;
  return [...sorted.filter((id) => id > cursor), ...sorted.filter((id) => id <= cursor)];
}

/** Take from the queues in turn, skipping an empty one, until `limit` are taken. */
function inTurn(queues, limit) {
  const out = [];
  const pos = queues.map(() => 0);
  while (out.length < limit) {
    let took = false;
    for (let q = 0; q < queues.length && out.length < limit; q++) {
      if (pos[q] < queues[q].items.length) { out.push({ queue: queues[q].name, item: queues[q].items[pos[q]++] }); took = true; }
    }
    if (!took) break;
  }
  return out;
}

function emptyCounts() {
  return {
    candidates: 0,
    battles: { read: 0, due: 0, unseen: 0, ordinary: 0, missing: 0, notOwned: 0, finished: 0 },
    excluded: {},
    gapBattles: 0,
    finalizationUndetermined: 0,
    activations: { discovered: 0, alreadyWritten: 0, cryptoSkipped: 0 },
    unresolved: {},
    deferred: {},
    abandoned: {},
    pointers: { withEvidence: 0, null: 0, exists: 0, snapshotInvalid: 0, writeFailed: {} },
    store: { finalRead: 0, final: 0, pending: 0, retryable: 0, excluded: 0, threw: {} },
    ticks: { tickAction: 0, unavailable: 0, ambiguous: 0, incompleteReads: 0 },
    truncations: { candidates: 0, ticks: 0 },
    failures: {},
    state: 'not_read',
    stateWritten: false,
  };
}

/**
 * @param {object} p
 * @param {object} p.db Admin Firestore
 * @param {number} p.handlerStartMs the host handler's start (its `startTime`)
 * @param {() => Date} [p.now]
 * @param {Function} [p.fetchPayload] the store's provider read (omitted in production)
 * @param {{ before?: (kind: string) => any }} [p.instrument] test seam
 */
export async function runActivationObserver({ db, handlerStartMs, now = () => new Date(), fetchPayload, instrument = {} } = {}) {
  // 1. THE GATE — before any read.
  const owners = activationEvidenceOwners();
  if (owners.length === 0) return { skipped: true };

  // 2. THE DEADLINE.
  const clock = () => now().getTime();
  const tenantStart = clock();
  const deadline = Math.min(tenantStart + OBSERVER_SLICE_MS, Number.isFinite(handlerStartMs) ? handlerStartMs + OBSERVER_ADMISSION_CEILING_MS : Infinity);
  if (deadline - tenantStart < MIN_RUN_MS) return { deferred: 'no_budget' };
  const prepEnd = tenantStart + PREP_BUDGET_MS;
  const canRead = () => clock() < prepEnd;
  const before = async (kind) => { if (typeof instrument.before === 'function') await instrument.before(kind); };
  const nowMs = tenantStart;
  const ruleSet = describeRuleSet();
  ruleKeyOf(ruleSet); // a malformed deployed rule set is a programming error: throw before any write
  const counts = emptyCounts();

  // 3. STATE.
  let state;
  if (canRead()) {
    await before('state');
    const read = await readObserverState(db);
    state = read.state;
    counts.state = read.status;
  } else {
    state = emptyState();
  }
  const index = state.battles;
  const cursors = { ...state.cursors };

  // 4. CANDIDATES — owner-scoped, ids only, newest first.
  const lookbackIso = isoOf(nowMs - CANDIDATE_LOOKBACK_DAYS * DAY_MS);
  const candidates = [];
  const candidateSet = new Set();
  let allOwnersQueried = true;
  for (const ownerId of owners) {
    if (!canRead()) { allOwnersQueried = false; bump(counts.deferred, 'candidates_unread'); continue; }
    try {
      await before('candidates');
      const page = await db.collection('agentBattles').where('ownerId', '==', ownerId).where('createdAt', '>=', lookbackIso)
        .orderBy('createdAt', 'desc').limit(MAX_CANDIDATE_IDS_PER_OWNER).select().get();
      const docs = page?.docs || [];
      if (docs.length >= MAX_CANDIDATE_IDS_PER_OWNER) counts.truncations.candidates += 1;
      for (const d of docs) if (!candidateSet.has(d.id)) { candidateSet.add(d.id); candidates.push(d.id); }
    } catch (err) {
      allOwnersQueried = false;
      bump(counts.failures, `candidates:${errorCodeOf(err)}`);
    }
  }
  counts.candidates = candidates.length;
  // The index never outlives the window: an entry no query returned is older than the lookback (or its
  // owner left the allowlist). Pruned only when every owner's query answered.
  if (allOwnersQueried) for (const id of Object.keys(index)) if (!candidateSet.has(id)) delete index[id];

  // 5. BATTLE QUEUES — only battles this run's owner-scoped queries returned.
  const live = candidates.filter((id) => !index[id]?.finished);
  const indexed = live.filter((id) => index[id]);
  const dueIds = indexed.filter((id) => isFinalizationDue({ terminal: false, expiresAtMs: index[id].expiresAt, cutoffAtMs: index[id].cutoffAt }, nowMs));
  const dueSet = new Set(dueIds);
  const plan = inTurn([
    { name: 'due', items: rotate(dueIds, cursors.dueBattles) },
    { name: 'unseen', items: live.filter((id) => !index[id]) },
    { name: 'ordinary', items: rotate(indexed.filter((id) => !dueSet.has(id)), cursors.ordinaryBattles) },
  ], MAX_BATTLES_PER_RUN);

  // 6–7. PER BATTLE.
  const work = []; // { battleId, battle, d, due, attribution, unwritten: activation[] }
  for (let c = 0; c < plan.length; c += BATTLE_READ_CHUNK) {
    if (!canRead()) { bump(counts.deferred, 'battles_unread', plan.length - c); break; }
    const chunk = plan.slice(c, c + BATTLE_READ_CHUNK);
    let snaps;
    try {
      await before('battles');
      snaps = await db.getAll(...chunk.map(({ item }) => db.collection('agentBattles').doc(item)), { fieldMask: [...BATTLE_FIELDS] });
    } catch (err) {
      bump(counts.failures, `battles:${errorCodeOf(err)}`);
      snaps = null;
    }
    // Each cursor advances past every battle taken, whatever happens to it.
    for (const { queue, item } of chunk) {
      if (queue === 'due') cursors.dueBattles = item;
      if (queue === 'ordinary') cursors.ordinaryBattles = item;
    }
    if (!snaps) continue;
    for (let k = 0; k < chunk.length; k++) {
      const battleId = chunk[k].item;
      const snap = snaps[k];
      counts.battles.read += 1;
      bump(counts.battles, chunk[k].queue);
      if (!snap?.exists) { counts.battles.missing += 1; delete index[battleId]; continue; }
      const battle = snap.data();
      if (!owners.includes(battle.ownerId)) { counts.battles.notOwned += 1; continue; } // never another owner's battle
      const scope = scopeOf(battle);
      const d = scope.inScope ? discoverActivations(battle) : null;
      const sched = d ? d.schedule : null;
      index[battleId] = { cutoffAt: sched?.cutoffAtMs ?? null, expiresAt: sched?.expiresAtMs ?? null, finished: false, excludedBy: null };
      if (!scope.inScope) {
        index[battleId] = { ...index[battleId], finished: true, excludedBy: scope.excludedBy };
        bump(counts.excluded, scope.excludedBy);
        continue;
      }
      if (d.gap) counts.gapBattles += 1;
      if (sched.cutoffAtMs === null) counts.finalizationUndetermined += 1;
      counts.activations.discovered += d.activations.length;
      counts.activations.cryptoSkipped += d.cryptoSkipped;
      for (const u of d.unresolved) bump(counts.unresolved, u.reason);

      // Every pointer id, in one getAll.
      let written = new Set();
      if (d.activations.length) {
        if (!canRead()) { bump(counts.deferred, 'prep_cut', d.activations.length); continue; }
        try {
          await before('pointers');
          const refs = d.activations.map((a) => db.collection('agentBattles').doc(battleId).collection(ACTIVATIONS_SUBCOLLECTION).doc(a.activationId));
          const ps = await db.getAll(...refs, { fieldMask: ['activationId'] });
          written = new Set(ps.filter((s) => s.exists).map((s) => s.id));
        } catch (err) {
          bump(counts.failures, `pointers:${errorCodeOf(err)}`);
          bump(counts.deferred, 'prep_cut', d.activations.length);
          continue;
        }
      }
      counts.activations.alreadyWritten += written.size;
      const unwritten = d.activations.filter((a) => !written.has(a.activationId));
      const due = isFinalizationDue(sched, nowMs);

      if (isBeyondHorizon(sched, nowMs)) {
        index[battleId].finished = true;
        counts.battles.finished += 1;
        for (const a of unwritten) {
          const key = activationKeyOf(a, ruleSet);
          if (!key.ok && key.reason === 'symbol_form') bump(counts.unresolved, 'symbol_form');
          else bump(counts.abandoned, key.ok ? 'unwritten' : key.reason);
        }
        continue;
      }
      if (unwritten.length === 0) {
        if (due) { index[battleId].finished = true; counts.battles.finished += 1; }
        continue;
      }
      // Attribution, once per battle with unwritten work; a ranked battle needs no read.
      let attribution = null;
      if (isCasualCloneId(battle.agentId)) {
        if (!canRead()) { bump(counts.deferred, 'prep_cut', unwritten.length); continue; }
        await before('attribution');
      }
      attribution = await attributionOf(db, battle);
      work.push({ battleId, battle, d, due, attribution, unwritten, outstanding: unwritten.length });
    }
  }

  // 7. TICKS — only for battles with an unwritten swap-in.
  for (const w of work) {
    const swapIns = w.unwritten.filter((a) => a.kind === 'swap_in');
    if (!swapIns.length) continue;
    const ticks = [];
    let complete = true;
    let remaining = MAX_TICK_DOCS_PER_BATTLE;
    for (const win of tickWindowsOf(swapIns)) {
      if (!canRead() || remaining <= 0) { complete = false; break; }
      try {
        await before('ticks');
        const page = await db.collection('agentBattles').doc(w.battleId).collection('ticks')
          .where('capturedAt', '>=', win.startIso).where('capturedAt', '<=', win.endIso)
          .orderBy('capturedAt', 'asc').limit(remaining).select(...TICK_FIELDS).get();
        const docs = page?.docs || [];
        for (const doc of docs) ticks.push(doc.data());
        if (docs.length >= remaining) { complete = false; counts.truncations.ticks += 1; }
        remaining -= docs.length;
      } catch (err) {
        complete = false;
        bump(counts.failures, `ticks:${errorCodeOf(err)}`);
      }
    }
    if (!complete) counts.ticks.incompleteReads += 1;
    const read = { complete, ticks };
    w.unwritten = w.unwritten.filter((a) => {
      if (a.kind !== 'swap_in') return true;
      const j = joinTick(a, read, { nowMs, finalizing: w.due });
      if (j.outcome === 'defer') { bump(counts.deferred, j.reason); return false; }
      a.activatingTick = j.activatingTick;
      if (j.outcome === 'tick_action') counts.ticks.tickAction += 1;
      else { counts.ticks.unavailable += 1; if (j.ambiguous) counts.ticks.ambiguous += 1; }
      return true;
    });
  }

  // 8. KEYS.
  const keys = new Map(); // snapshotId → { snapshotId, session, symbol, due, dueAt, members: [{ w, a }] }
  for (const w of work) {
    for (const a of w.unwritten) {
      const k = activationKeyOf(a, ruleSet);
      if (!k.ok) {
        if (k.reason === 'calendar_missing') bump(counts.deferred, 'calendar_missing');
        else { bump(counts.unresolved, 'symbol_form'); w.outstanding -= 1; }
        continue;
      }
      if (!keys.has(k.snapshotId)) keys.set(k.snapshotId, { snapshotId: k.snapshotId, session: k.session, symbol: a.symbol, due: false, dueAt: null, members: [] });
      const key = keys.get(k.snapshotId);
      key.members.push({ w, a, session: k.session });
      if (w.due) key.due = true;
      const cut = w.d.schedule.cutoffAtMs;
      if (Number.isFinite(cut)) key.dueAt = key.dueAt === null ? cut : Math.min(key.dueAt, cut);
    }
  }

  // 9. FINAL READS, due keys first.
  const ordered = [...keys.values()].sort((x, y) => Number(y.due) - Number(x.due));
  for (const key of ordered) {
    if (!canRead()) break;
    try {
      await before('final');
      const snap = await readSnapshot({ db, session: key.session, symbol: key.symbol, ruleSet });
      if (snap) {
        if (snapshotServes(snap, { session: key.session, symbol: key.symbol, ruleSet })) { key.final = snap; counts.store.finalRead += 1; }
        else { key.invalid = true; counts.pointers.snapshotInvalid += 1; }
      }
    } catch (err) {
      bump(counts.failures, `final:${errorCodeOf(err)}`);
    }
  }

  // 10. ACQUISITION.
  const acquisitions = new Map(); // snapshotId → { session, symbol, due, dueAt, run: key|null }
  for (const key of keys.values()) if (!key.final && !key.invalid) acquisitions.set(key.snapshotId, { snapshotId: key.snapshotId, session: key.session, symbol: key.symbol, due: key.due, dueAt: key.dueAt, run: key });
  for (const c of state.outstandingKeys) {
    if (acquisitions.has(c.snapshotId) || keys.has(c.snapshotId)) continue;
    let same = false;
    try { same = snapshotIdOf({ session: c.session, symbol: c.symbol, ruleSet }) === c.snapshotId; } catch { same = false; }
    if (!same) { bump(counts.deferred, 'carried_stale'); continue; } // another rule set's key, or malformed
    acquisitions.set(c.snapshotId, { snapshotId: c.snapshotId, session: c.session, symbol: c.symbol, due: c.dueAt !== null && nowMs >= c.dueAt, dueAt: c.dueAt, run: null });
  }
  const all = [...acquisitions.values()];
  const queue = inTurn([
    { name: 'due', items: rotate(all.filter((k) => k.due).map((k) => k.snapshotId), cursors.dueKeys) },
    { name: 'ordinary', items: rotate(all.filter((k) => !k.due).map((k) => k.snapshotId), cursors.ordinaryKeys) },
  ], all.length);
  const results = new Map(); // snapshotId → store result | { status: 'threw', code }
  const inflight = new Set();
  let started = 0;
  for (const { queue: q, item: id } of queue) {
    while (inflight.size >= ACQUISITION_CONCURRENCY) await Promise.race(inflight);
    if (started >= MAX_ACQUISITIONS_PER_RUN || deadline - clock() < ADMISSION_RESERVE_MS) break;
    started += 1;
    if (q === 'due') cursors.dueKeys = id; else cursors.ordinaryKeys = id; // past every key started, whatever its outcome
    const k = acquisitions.get(id);
    await before('acquire');
    const call = (async () => {
      try {
        results.set(id, await getOrAcquireSnapshot({ db, session: k.session, symbol: k.symbol, now, fetchPayload, host: HOST }));
      } catch (err) {
        results.set(id, { status: 'threw', code: errorCodeOf(err) });
      }
    })();
    inflight.add(call);
    call.then(() => inflight.delete(call));
  }
  await Promise.all([...inflight]); // every started call is awaited to its end

  for (const [id, r] of results) {
    const k = acquisitions.get(id);
    if (r.status === 'final') {
      counts.store.final += 1;
      if (snapshotServes(r.snapshot, { session: k.session, symbol: k.symbol, ruleSet })) { if (k.run) k.run.final = r.snapshot; }
      else { counts.pointers.snapshotInvalid += 1; if (k.run) k.run.invalid = true; }
    } else if (r.status === 'pending') counts.store.pending += 1;
    else if (r.status === 'retryable') { counts.store.retryable += 1; if (k.run) k.run.retryable = r.reason; }
    else if (r.status === 'excluded') {
      counts.store.excluded += 1;
      if (k.run) {
        k.run.excluded = true;
        for (const m of k.run.members) { bump(counts.unresolved, 'class_unknown'); m.w.outstanding -= 1; }
      }
    } else bump(counts.store.threw, r.code);
    k.done = r.status === 'final' || r.status === 'excluded';
  }

  // 11–12. WRITES — one cap, finalisation-due first.
  const tasks = [];
  for (const key of keys.values()) {
    for (const m of key.members) {
      if (key.final) tasks.push({ mode: 'evidence', key, ...m });
      else if (key.invalid || key.excluded) continue;
      else if (m.w.due && typeof key.retryable === 'string') tasks.push({ mode: 'finalize', key, ...m });
      else if (!results.has(key.snapshotId)) bump(counts.deferred, 'not_reached');
      else if (results.get(key.snapshotId).status === 'pending') bump(counts.deferred, 'pending');
      else if (results.get(key.snapshotId).status === 'threw') bump(counts.deferred, 'store_threw');
      else bump(counts.deferred, 'retryable_not_due');
    }
  }
  tasks.sort((x, y) => Number(y.w.due) - Number(x.w.due));
  let writes = 0;
  for (let t = 0; t < tasks.length; t++) {
    const task = tasks[t];
    if (writes >= MAX_POINTER_WRITES_PER_RUN) { bump(counts.deferred, 'write_cap', tasks.length - t); break; }
    if (deadline - clock() < POINTER_WRITE_RESERVE_MS) { bump(counts.deferred, 'write_reserve', tasks.length - t); break; }
    writes += 1;
    const { w, a, session, key } = task;
    const make = (evidence) => buildPointer({
      battle: w.battle, battleId: w.battleId, activation: a, session, attribution: w.attribution, ruleSet,
      evidence, missingDetail: evidence ? null : key.retryable, observedAt: isoOf(clock()),
    });
    try {
      await before(task.mode === 'evidence' ? 'write_evidence' : 'write_finalize');
      const r = task.mode === 'evidence'
        ? await createWithEvidence({ db, battleId: w.battleId, pointer: make({ snapshotId: key.snapshotId, snapshot: key.final }) })
        : await createAtFinalization({ db, battleId: w.battleId, activationId: a.activationId, session, symbol: a.symbol, makePointer: make });
      if (r === 'created' || r === 'created_with_evidence') { counts.pointers.withEvidence += 1; w.outstanding -= 1; }
      else if (r === 'created_null') { counts.pointers.null += 1; w.outstanding -= 1; }
      else if (r === 'exists') { counts.pointers.exists += 1; w.outstanding -= 1; }
      else if (r === 'snapshot_invalid') counts.pointers.snapshotInvalid += 1;
    } catch (err) {
      bump(counts.pointers.writeFailed, errorCodeOf(err));
    }
  }
  for (const w of work) if (w.due && w.outstanding <= 0) { index[w.battleId].finished = true; counts.battles.finished += 1; }

  // 13. STATE.
  if (deadline - clock() >= STATE_WRITE_RESERVE_MS) {
    const carried = [];
    const horizonMs = CATCH_UP_HORIZON_DAYS * DAY_MS;
    for (const k of acquisitions.values()) {
      if (k.done) continue;
      if (k.dueAt !== null && nowMs >= k.dueAt + horizonMs) continue; // its battles are past the horizon
      if (k.dueAt === null && Date.parse(`${k.session}T00:00:00Z`) < nowMs - CANDIDATE_LOOKBACK_DAYS * DAY_MS) continue;
      carried.push({ snapshotId: k.snapshotId, session: k.session, symbol: k.symbol, dueAt: k.dueAt });
    }
    carried.sort((x, y) => (x.dueAt ?? Infinity) - (y.dueAt ?? Infinity) || (x.snapshotId < y.snapshotId ? -1 : 1));
    try {
      await before('state_write');
      await writeObserverState(db, {
        schemaVersion: STATE_SCHEMA_VERSION, cursors, battles: index,
        outstandingKeys: carried.slice(0, MAX_CARRIED_KEYS), updatedAt: isoOf(clock()),
      });
      counts.stateWritten = true;
    } catch (err) {
      bump(counts.failures, `state_write:${errorCodeOf(err)}`);
    }
  } else {
    bump(counts.deferred, 'state_write_skipped');
  }

  // 14. COUNTS ONLY.
  counts.acquisitionsStarted = started;
  counts.pointerTransactions = writes;
  counts.ms = clock() - tenantStart;
  return counts;
}
