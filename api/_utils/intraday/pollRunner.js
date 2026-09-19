// api/_utils/intraday/pollRunner.js
//
// Intraday Data — Build 1, contract §5.1 / §5.3 / §6.6: ONE poller
// invocation, with every dependency injected (db, clock, fetch, calendar,
// battle listing) so the cron handler is a thin shell and the suite drives
// the real orchestration against fakes.
//
// Invocation order (§5.1, V1.1):
//   (1) deadline processing (§6.2) for any actionable symbol whose session
//       close + 30 min has passed with its last bucket still open — BEFORE the
//       session guard, every invocation;
//   (2) the session guard: quote collection only when now ∈ [open, close + 30 min);
//   (3) the sweep (§5.3): lease → lists → fetch outside any transaction →
//       units recorded IMMEDIATELY in a read-add-write transaction → seeding
//       → classification / accumulators / buckets (pure) → documents →
//       one publish transaction.
// Missing calendar entry → `calendar_missing`; never a guess.

import { randomUUID } from 'node:crypto';
import * as DEFAULT_CONFIG from '../intradayConfig.js';
import { etPartsOf, etDateOf as defaultEtDateOf } from './etTime.js';
import { fetchQuotes, fetchIntraday1mBars } from './intradayFetch.js';
import {
  acquireLease, releaseLease, recordUnits, publishSweep, loadCalcState, loadActionableDocs,
  calcStateRef, actionableRef, parseActionable,
} from './intradayStore.js';
import { runSweepCalc } from './sweepCalc.js';
import { applyDeadline, rebuildFromBuckets, newRing, newState } from './buckets.js';
import { aggregateBarsToBuckets, contiguousTail, combineSeedSessions } from './seed.js';
import { INTRADAY_DEFINITIONS_V1 } from './view.js';
import { ensureDefinitionsDoc } from './evaluatorHook.js';
import { UNIVERSE_STOCKS, actionableFromBattles, toVendorStock, toVendorCrypto } from './universe.js';

/** A price jump across the seed boundary larger than this reads as a corporate action (§6.6) — a heuristic, stated. */
export const CORPORATE_ACTION_JUMP_FRACTION = 0.4;

const dataOf = (snap) => (snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);

/**
 * §6.2 deadline processing for one session: every actionable document of
 * that date whose ring still has an open bucket is marked `incomplete` /
 * `deadline`. Idempotent; a `deadlineApplied` stamp on the calc-state
 * document short-circuits later invocations.
 */
export async function applyDeadlineForSession({ db, session, nowMs, config = DEFAULT_CONFIG }) {
  if (!session?.isTradingDay || nowMs < session.closeMs + config.DEADLINE_AFTER_CLOSE_MS) return { applied: false, reason: 'before_deadline' };
  const stateRef = calcStateRef(db, session.etDate);
  const stateSnap = await stateRef.get();
  const state = dataOf(stateSnap);
  if (state?.deadlineApplied) return { applied: false, reason: 'already_applied' };
  const listing = await stateRef.collection('actionable').get();
  let marked = 0; let scanned = 0;
  for (const doc of listing.docs || []) {
    scanned += 1;
    const parsed = parseActionable(doc.data());
    if (!parsed) continue;
    const r = applyDeadline({ ring: parsed.ring, session, nowMs, deadlineAfterCloseMs: config.DEADLINE_AFTER_CLOSE_MS });
    if (!r.changed) continue;
    await actionableRef(db, session.etDate, doc.id).update({ ringJson: JSON.stringify(r.ring), deadlineAppliedAt: nowMs });
    marked += 1;
  }
  if (state) await stateRef.update({ deadlineApplied: true, deadlineAppliedAt: nowMs });
  else await stateRef.set({ etDate: session.etDate, accumulators: {}, generation: 0, deadlineApplied: true, deadlineAppliedAt: nowMs });
  return { applied: true, scanned, marked };
}

/** Which actionable symbols need a seed attempt this sweep (§6.6). */
export function planSeeds({ symbols, docs, nowMs, config = DEFAULT_CONFIG }) {
  const attempt = []; const expire = [];
  for (const sym of symbols) {
    const d = docs[sym];
    const status = d?.seedStatus ?? null;
    if (status === 'seeded' || status === 'unavailable' || status === 'corporate_action') continue;
    const first = d?.seedFirstAttemptAt ?? null;
    const last = d?.seedLastAttemptAt ?? null;
    if (first !== null && nowMs - first > config.SEED_RETRY_WINDOW_MS) { expire.push(sym); continue; }
    if (last !== null && nowMs - last < config.SEED_RETRY_INTERVAL_MS) continue;
    attempt.push(sym);
  }
  return { attempt, expire };
}

/** Fetch and aggregate up to two prior sessions of 1-minute bars for one symbol. */
export async function fetchSeedBuckets({ sym, session, calendar, apiKey, fetchImpl, config = DEFAULT_CONFIG }) {
  let units = 0;
  const sessions = []; const tails = [];
  let date = session.previousEtDate;
  for (let i = 0; i < config.SEED_MAX_SESSIONS && date; i++) {
    const prev = calendar.getSessionForDate(date);
    if (!prev?.isTradingDay) break;
    const res = await fetchIntraday1mBars({
      apiKey, vendorSymbol: toVendorStock(sym), fromSec: Math.floor(prev.openMs / 1000), toSec: Math.floor(prev.closeMs / 1000) + 60,
      fetchImpl, timeoutMs: config.FETCH_TIMEOUT_MS,
    });
    units += res.units;
    if (!res.ok || !res.bars?.length) return { ok: false, units, reason: res.ok ? 'unpublished' : 'request_failed', buckets: [] };
    const { buckets } = aggregateBarsToBuckets(res.bars, prev, { closingRowPolicy: config.CLOSING_ROW_POLICY });
    sessions.unshift(prev); tails.unshift(contiguousTail(buckets, prev, config.SEED_MAX_BUCKETS));
    const combined = combineSeedSessions(tails, sessions, config.SEED_MAX_BUCKETS);
    if (combined.length >= config.SEED_MIN_BUCKETS || i === config.SEED_MAX_SESSIONS - 1) return { ok: true, units, buckets: combined, sessionsFetched: i + 1 };
    date = prev.previousEtDate;
  }
  return { ok: true, units, buckets: combineSeedSessions(tails, sessions, config.SEED_MAX_BUCKETS), sessionsFetched: sessions.length };
}

/** Apply a fetched seed to an actionable document (pure): late-seed rebuild, corporate-action check. */
export function applySeedToDoc({ doc, seed, sessionOf, nowMs, config = DEFAULT_CONFIG }) {
  const base = doc || { ring: newRing(), state: newState(), log: [], seedStatus: null };
  const attempts = (base.seedAttempts || 0) + 1;
  const stamped = { ...base, seedAttempts: attempts, seedFirstAttemptAt: base.seedFirstAttemptAt ?? nowMs, seedLastAttemptAt: nowMs };
  if (!seed.ok || !seed.buckets.length) return { ...stamped, seedStatus: 'pending', seedReason: seed.reason || 'empty' };
  const todays = base.ring?.buckets || [];
  const firstToday = todays.find((b) => Number.isFinite(b.close));
  const seedLast = seed.buckets[seed.buckets.length - 1];
  if (firstToday && Number.isFinite(seedLast?.close) && seedLast.close > 0 && Math.abs(firstToday.close / seedLast.close - 1) > CORPORATE_ACTION_JUMP_FRACTION) {
    return { ...stamped, seedStatus: 'corporate_action', seededBuckets: 0 };
  }
  const rebuilt = rebuildFromBuckets({ seeded: seed.buckets, existing: todays, sessionOf, maxClosed: config.SEED_MAX_BUCKETS });
  return { ...stamped, ring: rebuilt.ring, state: rebuilt.state, seedStatus: 'seeded', seededBuckets: seed.buckets.length, seedSessions: seed.sessionsFetched ?? null };
}

/**
 * One poller invocation.
 * @param {object} p
 * @param {object} p.db
 * @param {() => number} p.now
 * @param {Function} p.fetchImpl
 * @param {string} p.apiKey
 * @param {boolean} p.collectEnabled INTRADAY_COLLECT_ENABLED, read by the handler
 * @param {{getSessionForDate: Function, getPreviousSessionDate: Function}} p.calendar
 * @param {(db: object) => Promise<object[]>} p.listActiveBattles
 * @param {string[]} [p.universeStocks]
 * @param {object} [p.config]
 * @param {string} [p.owner]
 * @param {(ms:number)=>string} [p.etDateOf]
 */
export async function runPoll({
  db, now, fetchImpl, apiKey, collectEnabled, calendar, listActiveBattles,
  universeStocks = UNIVERSE_STOCKS, config = DEFAULT_CONFIG, owner = randomUUID(), etDateOf = defaultEtDateOf, log = console,
}) {
  if (!collectEnabled) return { skipped: true, reason: 'flag_off' };
  const nowMs = now();
  const et = etPartsOf(nowMs);
  const etDate = et.dateStr;
  const session = calendar.getSessionForDate(etDate);
  if (!session) return { skipped: true, reason: 'calendar_missing', etDate };
  const summary = { etDate, nowMs, deadline: [] };

  // (1) Deadline processing — before the guard, every invocation.
  const targets = [];
  if (session.isTradingDay && nowMs >= session.closeMs + config.DEADLINE_AFTER_CLOSE_MS) targets.push(session);
  if (!session.isTradingDay || nowMs < session.openMs) {
    const prev = session.previousEtDate ? calendar.getSessionForDate(session.previousEtDate) : null;
    if (prev?.isTradingDay) targets.push(prev);
  }
  for (const target of targets) {
    try { summary.deadline.push({ etDate: target.etDate, ...(await applyDeadlineForSession({ db, session: target, nowMs, config })) }); }
    catch (err) { summary.deadline.push({ etDate: target.etDate, applied: false, error: err?.message || String(err) }); }
  }

  // (2) Session guard.
  if (!session.isTradingDay) return { skipped: true, reason: 'not_trading_day', ...summary };
  if (nowMs < session.openMs || nowMs >= session.closeMs + config.COLLECTION_WINDOW_AFTER_CLOSE_MS) return { skipped: true, reason: 'outside_session_window', ...summary };

  // (3) Sweep. 1. Lease.
  const lease = await acquireLease(db, { owner, now, leaseMs: config.LEASE_MS });
  if (!lease.ok) return { skipped: true, reason: lease.reason, ...summary };
  const generation = (lease.generation || 0) + 1;
  const sweepId = `${etDate}-${String(generation).padStart(4, '0')}`;
  try {
    // 2. Lists; dedupe.
    const battles = await listActiveBattles(db);
    const actionable = actionableFromBattles(battles);
    const universeSweep = et.minute % config.UNIVERSE_CADENCE_MIN === 0;
    const stockSet = new Set(config.HELD_TIER_ENABLED ? actionable.stocks : []);
    if (universeSweep) for (const s of universeStocks) stockSet.add(s);
    const stocks = [...stockSet].map((sym) => ({ sym, vendor: toVendorStock(sym) }));
    const crypto = actionable.crypto.map((sym) => ({ sym, vendor: toVendorCrypto(sym) }));
    const actionableSet = new Set([...actionable.stocks, ...actionable.crypto]);
    const cryptoSet = new Set(actionable.crypto);

    // 3. Fetch outside any transaction.
    const quotes = await fetchQuotes({
      apiKey, stocks, crypto, fetchImpl, now, timeoutMs: config.FETCH_TIMEOUT_MS, concurrency: config.FETCH_CONCURRENCY, maxPerRequest: config.MAX_TICKERS_PER_REQUEST,
    });

    // State for the day, and the seed plan (§6.6) — seed fetches are I/O outside transactions too.
    const calcState = await loadCalcState(db, etDate);
    const docs = await loadActionableDocs(db, etDate, actionable.stocks);
    const plan = planSeeds({ symbols: actionable.stocks, docs, nowMs, config });
    const seeds = {};
    let seedUnits = 0;
    for (const sym of plan.attempt) {
      const seed = await fetchSeedBuckets({ sym, session, calendar, apiKey, fetchImpl, config });
      seedUnits += seed.units;
      seeds[sym] = seed;
    }

    // 4. Units recorded IMMEDIATELY — before any calculation or publication.
    const units = quotes.unitsRequested + seedUnits;
    await recordUnits(db, { etDate, units, unitsBySource: { ...quotes.unitsBySource, intraday_1m_seed: seedUnits }, sweepId, now });

    // Seeds applied (pure), expiries marked.
    const sessionOf = (d) => calendar.getSessionForDate(d);
    for (const [sym, seed] of Object.entries(seeds)) docs[sym] = applySeedToDoc({ doc: docs[sym], seed, sessionOf, nowMs, config });
    for (const sym of plan.expire) docs[sym] = { ...(docs[sym] || { ring: newRing(), state: newState(), log: [] }), seedStatus: 'unavailable' };

    // 5–6. Classification, accumulators, buckets, documents (pure).
    const calc = runSweepCalc({
      prevSnapshotSymbols: lease.previous?.symbols || {}, universeState: calcState, actionableDocs: docs,
      observations: quotes.observations, missing: quotes.missing, fetchAnomalies: quotes.anomalies,
      actionableSet, cryptoSet, session, etDateOf, sessionOf, nowMs, sweepId, generation, config,
    });
    const snapshotDoc = {
      sweepId, sweepAt: nowMs, etDate, calcVersion: config.CALC_VERSION,
      anomalies: { ...calc.anomalies, requestFailed: quotes.anomalies.requestFailed || 0 },
      counters: calc.counters, unchangedCount: calc.counters.unchangedCount,
      universeSweep, universeCount: universeSweep ? universeStocks.length : 0, actionableCount: actionableSet.size,
      requests: quotes.requests, unitsRequested: units, symbols: calc.snapshotSymbols,
    };
    if (!calcState.generation) await ensureDefinitionsDoc(db, INTRADAY_DEFINITIONS_V1);

    // 7. Publish — one transaction, lease re-checked with `now` per attempt.
    const pub = await publishSweep(db, { owner, now, etDate, snapshotDoc, universeState: calc.universeState, actionableDocs: calc.actionableDocs, generation });
    if (!pub.ok) {
      await releaseLease(db, { owner });
      return { published: false, reason: pub.reason, sweepId, generation, unitsRecorded: units, ...summary };
    }
    return {
      published: true, sweepId, generation, unitsRecorded: units, universeSweep, requested: stocks.length + crypto.length,
      actionable: actionableSet.size, anomalies: snapshotDoc.anomalies, counters: calc.counters,
      seeds: Object.fromEntries(Object.entries(seeds).map(([s, r]) => [s, r.ok ? 'fetched' : r.reason])), seedsExpired: plan.expire, ...summary,
    };
  } catch (err) {
    log.error?.(`[intraday-poll] sweep failed (${err?.message || err}) — releasing lease`);
    await releaseLease(db, { owner }).catch(() => {});
    return { published: false, reason: 'sweep_error', error: err?.message || String(err), sweepId, generation, ...summary };
  }
}
