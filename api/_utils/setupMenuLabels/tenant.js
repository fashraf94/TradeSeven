// api/_utils/setupMenuLabels/tenant.js
//
// Slice 2 — THE ACQUISITION TENANT, the seventh tenant of api/cron/process-pending-reflections.js
// (spec V2 §6 and §8, as amended by Correction B of the founder's kickoff, 7 Nov 2026). It keeps the
// shared setup-evidence store supplied for the names on each in-scope battle's PERSISTED hot bench.
// The only production caller of getOrAcquireSnapshot in Slice 2. One run:
//
//   1  Gate: flag off or an empty allowlist → { skipped: true } before any read.
//   2  Deadline = min(tenantStart + 20 s, handlerStart + 100 s): ADMISSION, not completion. Less than
//      15 s left → { deferred: 'no_budget' }, no read. The calendar must name the session, else
//      `deferred.calendar_missing` and no request.
//   PREPARATION (≤ 6 s from the tenant's start; no preparation read starts after it):
//   3  State (plain read): unreadable → `deferred.state_unreadable`, NO request this run.
//   4  Battles: per allowlisted owner, rotating from the owner cursor, `ownerId ==` and
//      `status == 'active'`, field-masked, ≤ 10 per owner and ≤ 25 in all; scope in memory.
//   5  Keys: each kept battle's persisted `watchlist.hotBench`, taken in turn across battles; crypto
//      and key-form refusals counted, never requested; no rankings, no menu recomputation, no
//      monitoring, no catalysts.
//   6  Pre-filter on the plain state: done, exhausted, not due, in flight, state full — refused with
//      no reservation. (A reservation due for recovery goes to the transaction, which records it.)
//   ACQUISITION (≤ 12 store calls a run, ≤ 3 at once, ≤ 24 reservation transactions):
//   7  Per key, a token minted HERE, outside every transaction callback, then:
//        reserve (one transaction, serialised with every other state transaction of the run)
//        → recheck admission (≥ 7 s left) and ownership (our token reserved) immediately before the
//          store call; lost → a token-checked cancel, no call
//        → getOrAcquireSnapshot, awaited to its end, OUTSIDE any transaction
//        → complete (one transaction, token-checked, once).
//      A reservation transaction that rejects is UNCERTAIN: no request, and a token-checked cancel
//      (it refunds only if our reservation actually landed). A completion that fails leaves the
//      reservation standing; a later run recovers it (state.js) and the 31 min due rule holds.
//   8  End of run, if ≥ 1 s before the deadline: the owner cursor, the governed sessions forward,
//      the pruning — one transaction.
//   9  Counts only, and one `[setupMenuLabels]` health line per non-skipped run.
//
// RESERVATIONS ARE NOT PROVIDER REQUESTS. A store call answered from a final snapshot, or refused by a
// live lease elsewhere, makes no request. The tenant hands the store a counting wrapper as its
// `fetchPayload` (the same function the store would use by default, the same arguments, the same
// result), so `providerRequests` is a real count, reported beside `reservations` and `storeCalls`.
//
// Never activationObserverState. TIME_BUDGET_MS, the observer and every earlier tenant are untouched.
// `now` is a function returning a Date (production: () => new Date()); `instrument.before(kind)` is a
// test seam awaited before each I/O step; production passes none. setupEvidenceImportGuard.test.js
// lists this file.

import { randomUUID } from 'node:crypto';
import { getOrAcquireSnapshot, lastCompletedSessionAt, ruleKeyOf, snapshotIdOf } from '../setupEvidence/index.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { fetchDailyPayload } from '../eodhdDailyWindow.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import {
  ACQUISITION_CONCURRENCY, ADMISSION_RESERVE_MS, BATTLE_FIELDS, MAX_ACQUISITIONS_PER_RUN, MAX_BATTLES_PER_OWNER_PER_RUN,
  MAX_BATTLES_PER_RUN, MIN_RUN_MS, PREP_BUDGET_MS, STATE_WRITE_RESERVE_MS, TENANT_ADMISSION_CEILING_MS, TENANT_HOST,
  TENANT_SLICE_MS,
} from './constants.js';
import { setupMenuLabelsOwners } from './gate.js';
import { poolScopeAdmits } from './pool.js';
import { scopeOf } from '../activationEvidence/scope.js';
import { cancelKey, completeKey, finishRun, readLabelState, refusalOf, reserveKey } from './state.js';

/** Reservation transactions per run: the store-call cap, twice (a refused or cancelled reservation costs a transaction, no call). */
export const MAX_RESERVE_TRANSACTIONS_PER_RUN = 2 * MAX_ACQUISITIONS_PER_RUN;
export const HEALTH_LINE_PREFIX = '[setupMenuLabels]';

const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
const errorCodeOf = (err) => String(err?.code ?? err?.name ?? 'unknown').slice(0, 40);

/** Ids in ascending order, starting after the cursor and wrapping. */
function rotate(ids, cursor) {
  const sorted = [...ids].sort();
  if (!cursor) return sorted;
  return [...sorted.filter((id) => id > cursor), ...sorted.filter((id) => id <= cursor)];
}

/** One item from each queue in turn until all are empty. */
function inTurn(queues) {
  const out = [];
  const pos = queues.map(() => 0);
  for (;;) {
    let took = false;
    for (let q = 0; q < queues.length; q++) {
      if (pos[q] < queues[q].length) { out.push(queues[q][pos[q]++]); took = true; }
    }
    if (!took) return out;
  }
}

/** One transaction at a time on the state document, in this run: contention is bounded without changing any cap. */
function serialiser() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.then(() => {}, () => {});
    return run;
  };
}

/** The completed session before `session` (the calendar's own tables, through the store's wrapper), or null. */
export function previousSessionOf(session) {
  const at = Date.parse(`${session}T12:00:00Z`); // 07:00–08:00 ET on that day: before its close
  if (!Number.isFinite(at)) return null;
  const r = lastCompletedSessionAt(at);
  return r.ok && r.session < session ? r.session : null;
}

function emptyCounts() {
  return {
    state: 'not_read',
    owners: { queried: 0, unread: 0 },
    battles: { read: 0, kept: 0, notOwned: 0 },
    excluded: {},
    keys: { wanted: 0, crypto: 0, symbolForm: 0 },
    refused: {},
    reservations: 0,
    reservationReplays: 0,
    reserveTransactions: 0,
    retries: 0,
    storeCalls: 0,
    providerRequests: 0,
    finalHits: 0,
    store: { final: 0, pending: 0, retryable: 0, excluded: 0, threw: {} },
    completion: {},
    cancelled: {},
    reserveFailed: 0,
    deferred: {},
    failures: {},
    stateWritten: false,
    pruned: 0,
  };
}

// ---------------------------------------------------------------- the health line
// Literal keys of this module only, error codes through codeLabelOf: no owner, battle, symbol or snapshot id.

const NODE_ERRNOS = new Set(['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH']);
/** An error code as the line may print it; anything else is 'other'. */
export function codeLabelOf(code) {
  const c = String(code);
  return /^\d{1,3}$/.test(c) || /^[a-z][a-z_-]{0,39}$/.test(c) || /^(?:[A-Z][A-Za-z]{0,30})?Error$/.test(c) || NODE_ERRNOS.has(c) ? c : 'other';
}
const labelledKeys = (obj, re = /^[a-z][a-zA-Z_]{0,40}$/) => {
  const out = {};
  for (const [k, n] of Object.entries(obj || {})) {
    const key = re.test(k) ? k : 'other';
    out[key] = (out[key] || 0) + n;
  }
  return out;
};
const labelledCodes = (obj) => {
  const out = {};
  for (const [k, n] of Object.entries(obj || {})) {
    const at = k.indexOf(':');
    const key = at === -1 ? codeLabelOf(k) : `${/^[a-z_]{1,20}$/.test(k.slice(0, at)) ? k.slice(0, at) : 'other'}:${codeLabelOf(k.slice(at + 1))}`;
    out[key] = (out[key] || 0) + n;
  }
  return out;
};

/** The run's health line, from its counts. Pure. */
export function healthLineOf(r) {
  const c = r && typeof r === 'object' && r.store ? r : null;
  const health = {
    state: c ? (['read', 'absent', 'unreadable', 'not_read'].includes(c.state) ? c.state : 'other') : null,
    battles: { read: c?.battles?.read ?? 0, kept: c?.battles?.kept ?? 0 },
    reservations: c?.reservations ?? 0,
    storeCalls: c?.storeCalls ?? 0,
    providerRequests: c?.providerRequests ?? 0,
    finalHits: c?.finalHits ?? 0,
    store: c ? { final: c.store.final, pending: c.store.pending, retryable: c.store.retryable, excluded: c.store.excluded, threw: labelledCodes(c.store.threw) } : null,
    refused: labelledKeys(c?.refused),
    completion: labelledKeys(c?.completion),
    cancelled: labelledKeys(c?.cancelled),
    reserveFailed: c?.reserveFailed ?? 0,
    deferred: c ? labelledKeys(c.deferred) : (typeof r?.deferred === 'string' && /^[a-z_]{1,40}$/.test(r.deferred) ? { [r.deferred]: 1 } : {}),
    failures: { ...labelledCodes(c?.failures), ...(r?.threw ? labelledCodes({ [`run:${r.threw}`]: 1 }) : {}) },
    stateWritten: c?.stateWritten === true,
  };
  return `${HEALTH_LINE_PREFIX} ${JSON.stringify(health)}`;
}

/**
 * One acquisition run, then its health line (none when the gate skipped it).
 *
 * @param {object} p
 * @param {object} p.db Admin Firestore
 * @param {number} p.handlerStartMs the host handler's start
 * @param {() => Date} [p.now]
 * @param {Function} [p.fetchPayload] the provider read (omitted in production: the store's own default)
 * @param {{ before?: (kind: string) => any }} [p.instrument] test seam
 */
export async function runSetupMenuAcquisition(p = {}) {
  let r;
  try {
    r = await acquire(p);
  } catch (err) {
    console.log(healthLineOf({ threw: errorCodeOf(err) }));
    throw err;
  }
  if (!r?.skipped) console.log(healthLineOf(r));
  return r;
}

async function acquire({ db, handlerStartMs, now = () => new Date(), fetchPayload, instrument = {} } = {}) {
  // 1. THE GATE — before any read.
  const owners = setupMenuLabelsOwners();
  if (owners.length === 0) return { skipped: true };

  // 2. THE DEADLINE, THE RULE SET, THE SESSION.
  const clock = () => now().getTime();
  const tenantStart = clock();
  const deadline = Math.min(tenantStart + TENANT_SLICE_MS, Number.isFinite(handlerStartMs) ? handlerStartMs + TENANT_ADMISSION_CEILING_MS : Infinity);
  if (deadline - tenantStart < MIN_RUN_MS) return { deferred: 'no_budget' };
  const prepEnd = tenantStart + PREP_BUDGET_MS;
  const canRead = () => clock() < prepEnd;
  const before = async (kind) => { if (typeof instrument.before === 'function') await instrument.before(kind); };
  const ruleSet = describeRuleSet();
  ruleKeyOf(ruleSet); // a malformed deployed rule set is a programming error: throw before any write
  const counts = emptyCounts();
  const cal = lastCompletedSessionAt(tenantStart);
  if (!cal.ok) { bump(counts.deferred, 'calendar_missing'); return counts; }
  const session = cal.session;

  // 3. STATE — unreadable means no request this run.
  if (!canRead()) { bump(counts.deferred, 'prep_cut'); return counts; }
  await before('state');
  const read = await readLabelState(db);
  counts.state = read.status;
  if (read.status === 'unreadable') { bump(counts.deferred, 'state_unreadable'); return counts; }
  const state = read.state;

  // 4. BATTLES.
  const kept = [];
  let ownersCursor = state.cursors.owners;
  for (const ownerId of rotate(owners, state.cursors.owners)) {
    if (kept.length >= MAX_BATTLES_PER_RUN) break;
    if (!canRead()) { counts.owners.unread += 1; bump(counts.deferred, 'prep_cut'); continue; }
    counts.owners.queried += 1;
    ownersCursor = ownerId; // past every owner whose query this run attempted
    try {
      await before('battles');
      const page = await db.collection('agentBattles').where('ownerId', '==', ownerId).where('status', '==', 'active')
        .select(...BATTLE_FIELDS).limit(MAX_BATTLES_PER_OWNER_PER_RUN).get();
      for (const doc of page?.docs || []) {
        if (kept.length >= MAX_BATTLES_PER_RUN) break;
        counts.battles.read += 1;
        const battle = doc.data() || {};
        if (battle.ownerId !== ownerId) { counts.battles.notOwned += 1; continue; } // never another owner's battle
        if (!poolScopeAdmits(battle, { isTournament: false })) { bump(counts.excluded, scopeOf(battle).excludedBy ?? 'scope'); continue; }
        kept.push(battle);
      }
    } catch (err) {
      bump(counts.failures, `battles:${errorCodeOf(err)}`);
    }
  }
  counts.battles.kept = kept.length;

  // 5. KEYS — the persisted hot bench, in turn across battles.
  const queues = kept.map((b) => {
    const list = Array.isArray(b.watchlist?.hotBench) ? b.watchlist.hotBench : [];
    return [...new Set(list.filter((s) => typeof s === 'string' && s.length > 0))];
  });
  const keys = [];
  const seenIds = new Set();
  const seenSymbols = new Set();
  for (const symbol of inTurn(queues)) {
    if (seenSymbols.has(symbol)) continue;
    seenSymbols.add(symbol);
    if (isCryptoSymbol(symbol)) { counts.keys.crypto += 1; continue; }
    let id;
    try { id = snapshotIdOf({ session, symbol, ruleSet }); } catch { counts.keys.symbolForm += 1; continue; }
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    keys.push({ id, symbol });
  }
  counts.keys.wanted = keys.length;

  // 6. PRE-FILTER — refused here with no reservation; a recovery goes on to the transaction.
  const nowAtFilter = clock();
  const keyCount = Object.keys(state.attempts).length;
  const queue = [];
  for (const k of keys) {
    const entry = state.attempts[k.id] ?? null;
    const why = refusalOf(entry, { nowMs: nowAtFilter, isNewKey: !entry, keyCount });
    if (why && why !== 'recover') { bump(counts.refused, why); continue; }
    queue.push(k);
  }

  // 7. ACQUISITION.
  const serial = serialiser();
  const inflight = new Set();
  let reserveTx = 0;
  let undecided = 0; // units launched that have neither called the store nor ended without a call
  const provider = typeof fetchPayload === 'function' ? fetchPayload : fetchDailyPayload;
  const admissionHolds = () => deadline - clock() >= ADMISSION_RESERVE_MS;

  const unit = async ({ id, symbol }, decide) => {
    const token = randomUUID(); // outside every transaction callback; a re-run of the callback reuses it
    let res;
    try {
      await before('reserve');
      res = await serial(() => reserveKey({ db, id, session, token, nowMs: clock() }));
    } catch (err) {
      // UNCERTAIN: the commit may have landed. No request; a token-checked cancel refunds only if it did.
      counts.reserveFailed += 1;
      bump(counts.failures, `reserve:${errorCodeOf(err)}`);
      try {
        await before('cancel');
        const c = await serial(() => cancelKey({ db, id, token, nowMs: clock() }));
        bump(counts.cancelled, `uncertain_${c.status}`);
      } catch (cancelErr) {
        bump(counts.failures, `cancel:${errorCodeOf(cancelErr)}`);
      }
      return;
    }
    if (res.status !== 'reserved') { bump(counts.refused, res.reason); return; }
    counts.reservations += 1;
    if (res.replay) counts.reservationReplays += 1;

    // RECHECK, immediately before the store: admission (a slow transaction may have consumed the reserve)
    // and the run's call cap. Checked and counted with no await between, so concurrent units cannot overshoot.
    if (!admissionHolds() || counts.storeCalls >= MAX_ACQUISITIONS_PER_RUN) {
      try {
        await before('cancel');
        const c = await serial(() => cancelKey({ db, id, token, nowMs: clock() }));
        bump(counts.cancelled, `admission_lost_${c.status}`);
      } catch (cancelErr) {
        bump(counts.failures, `cancel:${errorCodeOf(cancelErr)}`);
      }
      return;
    }
    decide();
    counts.storeCalls += 1;
    if (res.n > 1) counts.retries += 1;

    let fetches = 0;
    const countingFetch = (...args) => { fetches += 1; counts.providerRequests += 1; return provider(...args); };
    let r;
    try {
      await before('acquire');
      r = await getOrAcquireSnapshot({ db, session, symbol, now, fetchPayload: countingFetch, host: TENANT_HOST });
    } catch (err) {
      r = { status: 'threw', code: errorCodeOf(err) };
    }
    let outcome;
    let reason = null;
    if (r?.status === 'final') { counts.store.final += 1; if (fetches === 0) counts.finalHits += 1; outcome = 'final'; }
    else if (r?.status === 'pending') { counts.store.pending += 1; outcome = 'pending'; }
    else if (r?.status === 'retryable') { counts.store.retryable += 1; outcome = 'retryable'; reason = r.reason ?? null; }
    else if (r?.status === 'excluded') { counts.store.excluded += 1; outcome = 'excluded'; }
    else { bump(counts.store.threw, r?.code ?? 'unknown'); outcome = 'threw'; }

    try {
      await before('complete');
      const c = await serial(() => completeKey({ db, id, token, outcome, reason, nowMs: clock() }));
      bump(counts.completion, c.status);
    } catch (err) {
      // The outcome was not saved: the reservation stands, a later run recovers it (31 min, no early fetch).
      bump(counts.completion, 'failed');
      bump(counts.failures, `complete:${errorCodeOf(err)}`);
    }
  };

  let index = 0;
  for (; index < queue.length; index++) {
    // Wait for a slot, and while the undecided units could still fill the call cap, for one of them to end.
    while (inflight.size >= ACQUISITION_CONCURRENCY || (undecided > 0 && counts.storeCalls + undecided >= MAX_ACQUISITIONS_PER_RUN)) await Promise.race(inflight);
    if (counts.storeCalls >= MAX_ACQUISITIONS_PER_RUN) break;
    if (reserveTx >= MAX_RESERVE_TRANSACTIONS_PER_RUN) { bump(counts.deferred, 'reserve_cap'); break; }
    if (!admissionHolds()) break;
    reserveTx += 1;
    undecided += 1;
    let decided = false;
    const decide = () => { if (!decided) { decided = true; undecided -= 1; } };
    const p = unit(queue[index], decide).catch((err) => { bump(counts.failures, `unit:${errorCodeOf(err)}`); }).finally(decide);
    const tracked = p.finally(() => inflight.delete(tracked));
    inflight.add(tracked);
  }
  if (index < queue.length) bump(counts.deferred, 'not_reached', queue.length - index);
  counts.reserveTransactions = reserveTx;
  await Promise.all([...inflight]); // every started unit is awaited to its end

  // 8. END OF RUN.
  if (deadline - clock() >= STATE_WRITE_RESERVE_MS) {
    try {
      await before('finish');
      const f = await serial(() => finishRun({ db, governed: { previous: previousSessionOf(session), current: session }, ownersCursor, nowMs: clock() }));
      counts.stateWritten = true;
      counts.pruned = f.pruned;
    } catch (err) {
      bump(counts.failures, `finish:${errorCodeOf(err)}`);
    }
  } else {
    bump(counts.deferred, 'state_write_skipped');
  }

  // 9. COUNTS ONLY.
  counts.ms = clock() - tenantStart;
  return counts;
}
