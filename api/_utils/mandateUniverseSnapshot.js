// api/_utils/mandateUniverseSnapshot.js
//
// Spec 1 — Mandate Substrate — the SHARED UNIVERSE SNAPSHOT (§3.0, HARD
// REQUIREMENT). "Market data is fetched once per tick, platform-wide. No book
// fetches its own data." Architectural invariant, not an optimization.
//
// SOLE FETCHER (§3.0 enforcement): this is the ONLY module on the book eval path
// permitted to import a market-fetch client. Enforced by
// mandateUniverseSnapshot.imports.test.js — the sole-importer scan over the
// mandate eval path (the archetypeRegistry / wireModelCall precedent). The
// fetchers are injectable for tests, but the STATIC imports live here and only
// here; a book-path module that reached for `fetchBatchQuotes` or
// `getStockAnalysisData` directly turns the scan red.
//
// TWO LAYERS (Q5 — cold per-symbol enrichment costs ~5 fetches/stock and must
// never run per tick):
//   • FAST (per tick): batched real-time quotes → mandateUniverseSnapshots/{tickKey}.
//     Prices only; chunked so upstream volume is a handful of calls per tick.
//   • SLOW (once daily, pre-open): fundamentals-derived fields (marketCap,
//     sector, industry) → mandateUniverseDaily/{date}. Tick snapshots REFERENCE
//     the day doc; per-symbol enrichment is a daily cost, not a tick cost.
//
// Upstream volume is flat in user count (F12) because the build set is
// candidate-universe ∪ held, hard-capped — held is a subset of the universe by
// construction (BUY/ADD is snapshot-restricted, F16). The builder increments a
// daily upstream-call counter (Q5: no quota accounting exists in the repo — the
// book brings its own) and alerts at a configured fraction of the ceiling.

import { FieldValue } from 'firebase-admin/firestore';
// The two market-fetch clients — imported HERE AND ONLY HERE on the book eval
// path (§3.0 sole-importer invariant). Injectable below for tests.
import { fetchBatchQuotes } from './tournamentPrices.js';
import { getStockAnalysisData } from './marketDataCache.js';
import { CANDIDATE_UNIVERSE } from './mandateCandidateUniverse.js';
import {
  MANDATE_UNIVERSE_MAX_SYMBOLS,
  MANDATE_SNAPSHOT_MAX_BYTES,
  MANDATE_MIN_CANDIDATE_CAPACITY,
  MANDATE_QUOTE_BATCH_SIZE,
  MANDATE_UPSTREAM_DAILY_CEILING,
  MANDATE_UPSTREAM_ALERT_FRACTION,
  MANDATE_MARK_MAX_AGE_MS,
} from './mandateConfig.js';

const LOG_PREFIX = '[MandateUniverse]';

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_COLLECTION = 'mandateUniverseSnapshots';
export const DAILY_COLLECTION = 'mandateUniverseDaily';
export const UPSTREAM_COUNTER_COLLECTION = 'mandateUpstreamCalls';

const FAST_SOURCE = 'eodhd_realtime';
const DAILY_SOURCE = 'eodhd_fundamentals';

// ── Pure helpers (Firestore-free; the testable core) ─────────────────────────

function norm(sym) {
  return String(sym || '').trim().toUpperCase();
}

function uniqUpper(list) {
  return [...new Set((list || []).map(norm).filter(Boolean))];
}

/**
 * The build set (§3.0): candidate universe ∪ held tickers, hard-capped.
 *
 * Priority under the cap (§3.0): HELD symbols are sacrosanct — every held ticker
 * is included even beyond the cap, because a book must always be able to EXIT a
 * position it holds. Candidates fill the remaining capacity. "Carry-over" held
 * symbols (held but no longer in the candidate universe — delisted/removed) are
 * held symbols too and get the same priority over candidates.
 *
 * @returns {{ symbols, heldSet, candidateSet, carryOverHeld, droppedCandidates,
 *             candidateCapacity }}
 */
export function assembleBuildSet(heldTickers, {
  candidateUniverse = CANDIDATE_UNIVERSE,
  cap = MANDATE_UNIVERSE_MAX_SYMBOLS,
} = {}) {
  const held = uniqUpper(heldTickers);
  const heldSet = new Set(held);
  const candidates = uniqUpper(candidateUniverse);
  const candidateSet = new Set(candidates);
  // Carry-overs = held but not a curated candidate (delisted/removed but still held).
  const carryOverHeld = held.filter((s) => !candidateSet.has(s));

  // Held first (all of them), then candidates up to the cap.
  const symbols = [...held];
  let droppedCandidates = 0;
  for (const c of candidates) {
    if (heldSet.has(c)) continue; // already counted as held
    if (symbols.length >= cap) { droppedCandidates++; continue; }
    symbols.push(c);
  }
  // Non-held candidate capacity actually retained (drives the I11 floor check).
  const candidateCapacity = symbols.filter((s) => !heldSet.has(s)).length;

  return {
    symbols,
    heldSet,
    candidateSet,
    carryOverHeld,
    droppedCandidates,
    candidateCapacity,
  };
}

/** Split a list into chunks of at most `size`. */
export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += Math.max(1, size)) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Per-symbol completeness (F11): each entry carries {price, priceAsOf, source,
 * complete}. A price is complete iff it is a finite positive number. `priceAsOf`
 * is the builder's fetch instant (the price WAS observed now) — the raw upstream
 * timestamp is carried as `quoteTs` for audit. A fresh `builtAt` does NOT certify
 * a symbol; `complete` does.
 *
 * When a `dailyEntries` map is supplied, sector/industry/marketCap are
 * denormalized onto each entry so the gate reads one doc (the tick snapshot),
 * not two. Held/candidate sector share the daily layer as one source.
 */
export function assembleFastEntries(symbols, quotes, {
  now = new Date(),
  dailyEntries = null,
} = {}) {
  const nowIso = now.toISOString();
  const entries = {};
  const missing = [];
  let completeCount = 0;

  for (const sym of symbols) {
    const q = quotes?.[sym] || null;
    // Use the RAW last price (`close`), NEVER the `previousClose` fallback that
    // `fetchBatchQuotes` folds into `current` — a symbol with no live print today
    // must FREEZE, not trade on yesterday's close masquerading as a fresh mark
    // (I2). `close` is documented as "the raw last price (no fallback)".
    const price = q && Number.isFinite(q.close) && q.close > 0 ? q.close : null;
    const complete = price != null;
    if (complete) completeCount++;
    else missing.push(sym);

    // priceAsOf is the UPSTREAM observation time when the quote carries one (an
    // hours-old last trade then reads as stale in classifyHeldFreshness), falling
    // back to the fetch instant only when the feed omits it. EODHD `timestamp` is
    // epoch seconds.
    const quoteTs = q && Number.isFinite(q.timestamp) ? q.timestamp : null;
    const priceAsOf = complete ? (quoteTs != null ? new Date(quoteTs * 1000).toISOString() : nowIso) : null;

    const daily = dailyEntries?.[sym] || null;
    entries[sym] = {
      price,
      priceAsOf,
      source: FAST_SOURCE,
      complete,
      quoteTs,
      // Denormalized daily context (null until the slow layer has enriched it).
      sector: daily?.sector ?? null,
      industry: daily?.industry ?? null,
      marketCap: daily?.marketCap ?? null,
    };
  }

  return { entries, symbolCount: symbols.length, completeCount, missing };
}

/** Count complete, non-held candidate symbols (the I11 floor is measured on these). */
export function countCompleteCandidates(entries, heldSet) {
  let n = 0;
  for (const [sym, e] of Object.entries(entries)) {
    if (!heldSet.has(sym) && e.complete) n++;
  }
  return n;
}

/** JSON byte size of a doc (the Firestore size budget is measured on the serialized form). */
export function docByteSize(doc) {
  return Buffer.byteLength(JSON.stringify(doc), 'utf8');
}

/**
 * Enforce the size budget (§3.0): if the doc exceeds `maxBytes`, drop CANDIDATE
 * entries (never held) until it fits. Held symbols are never dropped — a book
 * must always see its own positions to mark and exit them. If held-only already
 * exceeds the budget, throw (fail LOUD, never silently truncate).
 *
 * @returns {{ entries, dropped }} trimmed entries and the count dropped.
 */
export function fitToByteBudget(doc, entries, heldSet, {
  maxBytes = MANDATE_SNAPSHOT_MAX_BYTES,
} = {}) {
  let working = { ...entries };
  let dropped = 0;
  const rebuild = () => ({ ...doc, symbols: working });

  if (docByteSize(rebuild()) <= maxBytes) return { entries: working, dropped };

  // Drop candidates in reverse build order (lowest-priority tail first).
  const candidateSyms = Object.keys(working).filter((s) => !heldSet.has(s));
  for (let i = candidateSyms.length - 1; i >= 0; i--) {
    delete working[candidateSyms[i]];
    dropped++;
    if (docByteSize(rebuild()) <= maxBytes) return { entries: working, dropped };
  }

  // Held-only still over budget — cannot silently truncate held marks.
  const heldOnlyBytes = docByteSize(rebuild());
  if (heldOnlyBytes > maxBytes) {
    throw new Error(
      `${LOG_PREFIX} snapshot exceeds ${maxBytes}B with held symbols alone `
      + `(${heldOnlyBytes}B, ${Object.keys(working).length} held) — cannot truncate held marks (§3.0)`,
    );
  }
  return { entries: working, dropped };
}

// ── Firestore-touching layer ─────────────────────────────────────────────────

/**
 * Increment the daily upstream-call counter atomically and alert once when the
 * count crosses the configured fraction of the ceiling (§3.0 / Q5). Returns the
 * post-increment count.
 */
export async function bumpUpstreamCounter(db, dateStr, delta, {
  ceiling = MANDATE_UPSTREAM_DAILY_CEILING,
  alertFraction = MANDATE_UPSTREAM_ALERT_FRACTION,
} = {}) {
  if (!delta) return null;
  const ref = db.collection(UPSTREAM_COUNTER_COLLECTION).doc(dateStr);
  const threshold = Math.floor(ceiling * alertFraction);
  const post = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? (snap.data().count || 0) : 0;
    const next = prev + delta;
    tx.set(ref, { date: dateStr, count: next, updatedAt: new Date() }, { merge: true });
    return { prev, next };
  });
  if (post.prev < threshold && post.next >= threshold) {
    console.error(
      `${LOG_PREFIX} MANDATE_UPSTREAM_QUOTA_ALERT — daily upstream calls crossed `
      + `${threshold} (${Math.round(alertFraction * 100)}% of ${ceiling}) on ${dateStr}: now ${post.next}`,
    );
  }
  return post.next;
}

/**
 * SLOW LAYER (§3.0): build the daily fundamentals-derived doc for `date`,
 * idempotent (skips if already built — the slow layer runs once daily pre-open).
 * Enriches each build-set symbol with {marketCap, sector, industry}. Corporate
 * actions and technical baselines are P3 — not fetched here.
 *
 * Upstream cost: fundamentals is one field group per symbol, and
 * getStockAnalysisData caches it (24h TTL), so only cache-miss symbols hit
 * upstream; only those are counted.
 *
 * @returns {Promise<{ ref, date, built: boolean, symbolCount, completeCount, upstreamCalls }>}
 */
export async function ensureDailySnapshot(db, {
  date,
  heldTickers = [],
  now = new Date(),
  force = false,
  candidateUniverse = CANDIDATE_UNIVERSE,
  getFundamentals = (sym) => getStockAnalysisData(sym, { fields: ['fundamentals'] }),
  concurrency = 8,
} = {}) {
  if (!db) throw new Error('ensureDailySnapshot: db required');
  if (!date) throw new Error('ensureDailySnapshot: date required');

  const ref = db.collection(DAILY_COLLECTION).doc(date);
  if (!force) {
    const existing = await ref.get();
    if (existing.exists) {
      const d = existing.data();
      return { ref, date, built: false, symbolCount: d.symbolCount ?? 0, completeCount: d.completeCount ?? 0, upstreamCalls: 0 };
    }
  }

  const { symbols, heldSet } = assembleBuildSet(heldTickers, { candidateUniverse });

  const entries = {};
  const missing = [];
  let completeCount = 0;
  let upstreamCalls = 0;

  // Bounded-concurrency enrichment (the slow layer runs once daily; most days
  // this is cache hits after the first build).
  for (const group of chunk(symbols, concurrency)) {
    const results = await Promise.all(group.map(async (sym) => {
      try {
        const res = await getFundamentals(sym);
        const f = res?.fundamentals || {};
        const upstream = res?.cacheStatus?.fundamentals === 'fresh' ? 1 : 0;
        const sector = f.sector ?? null;
        return { sym, sector, industry: f.industry ?? null, marketCap: f.marketCap ?? null, upstream };
      } catch (err) {
        console.error(`${LOG_PREFIX} fundamentals fetch failed for ${sym}: ${err.message}`);
        return { sym, sector: null, industry: null, marketCap: null, upstream: 0, failed: true };
      }
    }));
    for (const r of results) {
      upstreamCalls += r.upstream;
      const complete = r.sector != null; // sector is the field the gate depends on
      if (complete) completeCount++;
      else missing.push(r.sym);
      entries[r.sym] = {
        sector: r.sector,
        industry: r.industry,
        marketCap: r.marketCap,
        source: DAILY_SOURCE,
        complete,
      };
    }
  }

  const doc = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    date,
    builtAt: now,
    heldCount: heldSet.size,
    symbolCount: symbols.length,
    completeCount,
    missing,
    symbols: entries,
  };
  await ref.set(doc);
  if (upstreamCalls > 0) await bumpUpstreamCounter(db, date, upstreamCalls);

  return { ref, date, built: true, symbolCount: symbols.length, completeCount, upstreamCalls };
}

/**
 * FAST LAYER (§3.0): build one tick snapshot at `tickKey` from batched real-time
 * quotes, referencing the day doc for denormalized sector context. Idempotent on
 * `tickKey` unless `force` — re-running the same slot no-ops the fetch.
 *
 * Guards, in order:
 *   • assemble build set (held priority, cap)
 *   • chunked batch fetch (one chunk == one counted upstream call)
 *   • per-symbol completeness (F11) → symbolCount/completeCount/missing[]
 *   • candidate-capacity floor (I11) → MANDATE_UNIVERSE_DEGRADED alert
 *   • size budget (§3.0) → drop candidates before held; fail loud if held exceeds
 *
 * @returns {Promise<{ ref, tickKey, built, snapshot, degraded, droppedForSize, upstreamCalls }>}
 */
export async function ensureUniverseSnapshot(db, {
  tickKey,
  sessionDate,
  heldTickers = [],
  now = new Date(),
  force = false,
  dailyDoc = null,
  candidateUniverse = CANDIDATE_UNIVERSE,
  fetchQuotes = fetchBatchQuotes,
  batchSize = MANDATE_QUOTE_BATCH_SIZE,
} = {}) {
  if (!db) throw new Error('ensureUniverseSnapshot: db required');
  if (!tickKey) throw new Error('ensureUniverseSnapshot: tickKey required');
  if (!sessionDate) throw new Error('ensureUniverseSnapshot: sessionDate required');

  const ref = db.collection(SNAPSHOT_COLLECTION).doc(tickKey);
  if (!force) {
    const existing = await ref.get();
    if (existing.exists) {
      return {
        ref, tickKey, built: false, snapshot: existing.data(),
        degraded: !!existing.data().degraded, droppedForSize: existing.data().droppedForSize ?? 0, upstreamCalls: 0,
      };
    }
  }

  const build = assembleBuildSet(heldTickers, { candidateUniverse });
  const { symbols, heldSet } = build;

  // Chunked batch fetch — one chunk is one counted upstream call.
  const groups = chunk(symbols, batchSize);
  const quotes = {};
  for (const group of groups) {
    const part = await fetchQuotes(group);
    Object.assign(quotes, part || {});
  }
  const upstreamCalls = groups.length;

  const dailyEntries = dailyDoc?.symbols || null;
  const { entries, symbolCount, completeCount, missing } = assembleFastEntries(symbols, quotes, { now, dailyEntries });

  const baseDoc = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    tickKey,
    sessionDate,
    builtAt: now,
    dailyRef: dailyDoc ? `${DAILY_COLLECTION}/${sessionDate}` : null,
    heldCount: heldSet.size,
    carryOverCount: build.carryOverHeld.length,
    droppedCandidatesForCap: build.droppedCandidates,
  };

  // Size budget: trim candidates (never held); fail loud if held-only exceeds.
  const fitted = fitToByteBudget({ ...baseDoc, symbolCount, completeCount, missing }, entries, heldSet);
  const finalEntries = fitted.entries;
  // Recompute counts on the FINAL (trimmed) entries — the I11 candidate-capacity
  // floor MUST be measured after the size-budget trim, else the byte budget could
  // crowd candidates below the floor while the stored doc reads degraded:false
  // (arch review F3 — the same "silently sell-only" failure via the budget).
  const finalSymbolCount = Object.keys(finalEntries).length;
  const finalMissing = missing.filter((s) => finalEntries[s] !== undefined);
  let finalComplete = 0;
  for (const e of Object.values(finalEntries)) if (e.complete) finalComplete++;

  const completeCandidates = countCompleteCandidates(finalEntries, heldSet);
  const degraded = completeCandidates < MANDATE_MIN_CANDIDATE_CAPACITY;
  if (degraded) {
    console.error(
      `${LOG_PREFIX} MANDATE_UNIVERSE_DEGRADED — only ${completeCandidates} complete candidate `
      + `symbols (< floor ${MANDATE_MIN_CANDIDATE_CAPACITY}) at tick ${tickKey} `
      + `(${fitted.dropped} dropped for size); snapshot risks sell-only`,
    );
  }

  const doc = {
    ...baseDoc,
    symbolCount: finalSymbolCount,
    completeCount: finalComplete,
    missing: finalMissing,
    completeCandidateCount: completeCandidates,
    degraded,
    droppedForSize: fitted.dropped,
    symbols: finalEntries,
  };

  await ref.set(doc);
  if (upstreamCalls > 0) await bumpUpstreamCounter(db, sessionDate, upstreamCalls);

  return { ref, tickKey, built: true, snapshot: doc, degraded, droppedForSize: fitted.dropped, upstreamCalls };
}

// ── Read helpers for the eval path (no fetch — pure reads of the built doc) ───

/**
 * Per-held-symbol freshness (I2): a held symbol is ACTIONABLE iff it is present,
 * `complete`, and its mark age is within `maxAgeMs`. Freshness is per symbol,
 * never whole-book — one halted ticker never suppresses exits on the others.
 *
 * @returns {{ actionable: Set<string>, frozen: Set<string> }}
 */
export function classifyHeldFreshness(snapshot, heldTickers, {
  now = new Date(),
  maxAgeMs = MANDATE_MARK_MAX_AGE_MS, // default so an omitted arg never freezes the whole book (C5)
} = {}) {
  const actionable = new Set();
  const frozen = new Set();
  const nowMs = now.getTime();
  for (const raw of heldTickers || []) {
    const sym = norm(raw);
    const e = snapshot?.symbols?.[sym];
    const ageOk = e?.priceAsOf ? (nowMs - new Date(e.priceAsOf).getTime()) <= maxAgeMs : false;
    if (e && e.complete && ageOk) actionable.add(sym);
    else frozen.add(sym);
  }
  return { actionable, frozen };
}

/** A symbol is eligible for BUY/ADD iff present-and-complete in the tick snapshot (F16). */
export function isSymbolActionable(snapshot, symbol) {
  const e = snapshot?.symbols?.[norm(symbol)];
  return !!(e && e.complete);
}

/** The harvest-tick mark for a symbol (I3): the price fills execute at. Null if not markable. */
export function markFor(snapshot, symbol) {
  const e = snapshot?.symbols?.[norm(symbol)];
  return e && e.complete ? e.price : null;
}
