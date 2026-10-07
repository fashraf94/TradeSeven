// api/_utils/popularMarketCache.js
//
// EODHD Quick Wins QW-4 (build report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md):
// the SHARED cache behind GET /api/market/popular. Every visible tab used to
// fetch the whole popular list (54 stocks + 33 crypto) every 5 minutes, each
// with its own uncached subset in its own order, so tabs rarely shared a server
// cache entry (census §3 Q-07 row A). Now one Firestore document per list
// holds the last fetch, and every tab on every instance reads it.
//
// Conventions are marketDataCache's L2 ones (api/_utils/marketDataCache.js
// setCachedData): collection `marketDataCache`, doc `{kind}_popular`, fields
// { data, cachedAt, ttlType, ttlMs, expiresAt }. There is NO in-memory L1
// layer — the document is the one shared truth, so a per-instance copy cannot
// add a second staleness on top.
//
// TTL — 60 s (founder ruling, Oct 7): the age envelope tabs had from
// /api/stocks/prices' own 60 s server cache. Crypto is always 60 s. Stocks:
//   • session open, or the 9:20–9:30 ET pre-market window (where the client
//     evicts closed-market stock prices): 60 s;
//   • market closed: a list written at least POPULAR_CLOSE_SETTLE_MS after the
//     most recent session close holds while its age is within the time left to
//     the next open — max(60 s, time-until-open) measured at read time, the
//     client's own rule (src/utils/marketSchedule.js getEffectiveTTL) and the
//     server one (getEffectiveTTLMs). A list written BEFORE that point (in
//     session, or while the closing prints are still arriving through the
//     vendor's ~15–20 min delay) keeps the plain 60 s, so the frozen copy is a
//     settled close rather than the last in-session snapshot. Today a NEW tab
//     after the close got a fresh server answer; this keeps that true once the
//     close has settled (review E2-1). Only a COMPLETE list freezes (every
//     symbol the server asked for came back): a partial or empty one keeps
//     60 s, as the client re-requests a symbol the vendor left out on every
//     poll. A calendar the code cannot read (outside MAINTAINED_HOLIDAY_YEARS)
//     never freezes either.
//
// CONCURRENCY — a Firestore LEASE per list (marketDataLeases/{kind}_popular),
// taken in a transaction. Several instances that miss at once produce ONE
// upstream fetch: the lease winner fetches and writes, the others poll the
// document until it is fresh. A write-if-older transaction alone would not do
// it — every cold instance would pay for its own fetch before one of them
// committed. A holder that dies leaves a lease that expires after
// POPULAR_MARKET_LEASE_MS; the next waiter takes it over. The vendor fetch is
// bounded below the lease (api/market/popular.js, POPULAR_VENDOR_TIMEOUT_MS),
// and the write lands only while the writer still holds the lease, so an
// expired holder can never overwrite a newer list (review E2-4).
//
// FAIL-OPEN — Firestore is a cost saving, never a new way to fail (review E2-3):
// no handle, a read or transaction error, or a lease still busy after
// POPULAR_MARKET_WAIT_MS → this request fetches the list itself, uncached,
// exactly as a tab did before. A write error after a paid fetch still serves
// the data. Only a VENDOR failure makes a list unavailable, as today.

import { getEffectiveTTLMs, isPreMarketWindow, isMarketOpen, getETDate, formatDateString, getSessionForDate, getPreviousSessionDate } from './marketSchedule.js';

/** The shared TTL — ONE named constant (founder ruling, Oct 7). */
export const POPULAR_MARKET_TTL_MS = 60_000;
/** How long a lease protects one fetch; longer than the bounded vendor fetch. */
export const POPULAR_MARKET_LEASE_MS = 15_000;
/** How long a waiter polls for the holder's write before fetching itself. */
export const POPULAR_MARKET_WAIT_MS = 20_000;
/** Poll interval while waiting on another instance's fetch. */
export const POPULAR_MARKET_POLL_MS = 400;
/** After the close, how long stock prints keep settling before a list may freeze. */
export const POPULAR_CLOSE_SETTLE_MS = 30 * 60_000;

export const POPULAR_TTL_TYPE = 'popular';
export const POPULAR_KINDS = Object.freeze(['stocks', 'crypto']);

export function popularDocId(kind) {
  return `${kind}_popular`;
}

/** The epoch-ms of the most recent regular-session close at or before now, or null. */
export function lastSessionCloseMs(nowMs = Date.now()) {
  const etToday = formatDateString(getETDate());
  const today = getSessionForDate(etToday);
  if (today?.isTradingDay && Number.isFinite(today.closeMs) && nowMs >= today.closeMs) return today.closeMs;
  const prev = today?.previousEtDate ?? getPreviousSessionDate(etToday);
  const prior = prev ? getSessionForDate(prev) : null;
  return Number.isFinite(prior?.closeMs) ? prior.closeMs : null;
}

function toMillis(value) {
  if (value == null) return NaN;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/** The effective TTL for one cached list document, right now. */
export function popularEffectiveTtlMs(kind, doc, nowMs = Date.now()) {
  if (kind === 'crypto') return POPULAR_MARKET_TTL_MS;
  if (isPreMarketWindow() || isMarketOpen()) return POPULAR_MARKET_TTL_MS;
  const count = Number(doc?.data?.count);
  const expected = Number(doc?.expectedCount);
  if (!(count > 0) || !(expected > 0) || count < expected) return POPULAR_MARKET_TTL_MS;
  const closeMs = lastSessionCloseMs(nowMs);
  if (closeMs == null) return POPULAR_MARKET_TTL_MS;
  if (toMillis(doc.cachedAt) < closeMs + POPULAR_CLOSE_SETTLE_MS) return POPULAR_MARKET_TTL_MS;
  return getEffectiveTTLMs(POPULAR_TTL_TYPE, POPULAR_MARKET_TTL_MS, { isCrypto: false });
}

/** Is a cached list document still inside its effective TTL at `nowMs`? */
export function isPopularDocFresh(doc, kind, nowMs) {
  if (!doc || !doc.data) return false;
  const at = toMillis(doc.cachedAt);
  if (!Number.isFinite(at)) return false;
  return nowMs - at <= popularEffectiveTtlMs(kind, doc, nowMs);
}

// The helpers' parameter is `ref`, deliberately NOT `leaseRef`: the protected-
// store scan's const map is file-wide, so a parameter sharing the caller's const
// name would be resolved to that const and the helpers would never register as
// write-helpers — hiding their call sites (review EV4 on E4-2).
async function tryAcquireLease(db, ref, owner, nowMs) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const lease = snap.exists ? snap.data() : null;
    if (lease && lease.owner !== owner && Number(lease.expiresAtMs) > nowMs) return false;
    tx.set(ref, { owner, acquiredAtMs: nowMs, expiresAtMs: nowMs + POPULAR_MARKET_LEASE_MS });
    return true;
  });
}

async function releaseLease(db, ref, owner) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data()?.owner === owner) tx.delete(ref);
  });
}

function randomOwner() {
  return `popular-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A vendor failure, kept apart from a Firestore one: only this one makes a list unavailable. */
class VendorFetchError extends Error {
  constructor(cause) {
    super(cause?.message || String(cause));
    this.cause = cause;
  }
}

/**
 * Read one popular list through the shared cache.
 *
 * @param {object|null} db - Firestore (Admin SDK shape); null → fetch direct, uncached
 * @param {'stocks'|'crypto'} kind
 * @param {object} opts
 * @param {() => Promise<{prices:object, count:number}>} opts.fetchList - ONE upstream fetch of the whole list
 * @param {number} [opts.expectedCount] - how many symbols the list asks for (a short answer never freezes)
 * @param {() => number} [opts.now]
 * @param {(ms:number) => Promise<void>} [opts.sleep]
 * @param {string} [opts.owner]
 * @returns {Promise<{data:object, source:'cache'|'waited'|'fetched'|'direct', ageMs:number}>}
 *   Rejects only with the vendor's own error.
 */
export async function readPopularList(db, kind, opts = {}) {
  if (!POPULAR_KINDS.includes(kind)) throw new Error(`unknown popular list: ${kind}`);
  try {
    return await readThrough(db, kind, opts);
  } catch (err) {
    if (err instanceof VendorFetchError) throw err.cause;
    throw err;
  }
}

async function readThrough(db, kind, { fetchList, expectedCount = null, now = () => Date.now(), sleep = defaultSleep, owner = randomOwner() } = {}) {
  // JSON round trip: exactly what a tab received from the per-symbol routes'
  // res.json (undefined keys dropped, NaN → null) — and Firestore rejects
  // `undefined`, which a vendor record can carry (e.g. volume).
  const fetchOnce = async () => {
    try {
      return JSON.parse(JSON.stringify(await fetchList()));
    } catch (err) {
      throw new VendorFetchError(err);
    }
  };
  const direct = async (why) => {
    console.error(`[PopularMarket] cache unavailable for ${kind} (${why}) — fetching direct, uncached`);
    const data = await fetchOnce();
    console.log(`[PopularMarket] FETCH_DIRECT | kind=${kind} | symbols=${data?.count ?? 0} | uncached (fail-open)`);
    return { data, source: 'direct', ageMs: 0 };
  };

  if (!db) return direct('no Firestore handle');
  try {
    return await throughCache(db, kind, { fetchOnce, expectedCount, now, sleep, owner });
  } catch (err) {
    if (err instanceof VendorFetchError) throw err;
    return direct(err.message);
  }
}

async function throughCache(db, kind, { fetchOnce, expectedCount, now, sleep, owner }) {
  const id = popularDocId(kind);
  // Literal collection names (not the constants above) keep these refs
  // statically resolvable for the protected-store scan
  // (compositionProtectedStoresScan.js) — the mandateUniverseSnapshot precedent.
  const docRef = db.collection('marketDataCache').doc(id);
  const leaseRef = db.collection('marketDataLeases').doc(id);
  const deadline = now() + POPULAR_MARKET_WAIT_MS;
  let waited = false;

  const readFresh = async () => {
    const snap = await docRef.get();
    const doc = snap.exists ? snap.data() : null;
    return isPopularDocFresh(doc, kind, now()) ? doc : null;
  };
  const hit = (doc) => {
    const ageMs = now() - toMillis(doc.cachedAt);
    console.log(`[PopularMarket] HIT | kind=${kind} | ageMs=${ageMs} | source=${waited ? 'waited' : 'cache'}`);
    return { data: doc.data, source: waited ? 'waited' : 'cache', ageMs };
  };

  for (;;) {
    const fresh = await readFresh();
    if (fresh) return hit(fresh);

    if (await tryAcquireLease(db, leaseRef, owner, now())) {
      try {
        // Re-read under the lease: a previous holder may have written between
        // our read and our acquire. Never pay for a list someone just paid for.
        const raced = await readFresh();
        if (raced) return hit(raced);

        // Stamped at the fetch's START (review EV2 on E2-4): the list's age
        // then counts the time the vendor took, never less.
        const cachedAtMs = now();
        const data = await fetchOnce();
        const doc = {
          data,
          expectedCount: Number.isFinite(expectedCount) ? expectedCount : null,
          cachedAt: new Date(cachedAtMs),
          ttlType: POPULAR_TTL_TYPE,
          ttlMs: POPULAR_MARKET_TTL_MS,
          expiresAt: new Date(cachedAtMs + POPULAR_MARKET_TTL_MS),
        };
        // The write lands only while this request still holds the lease: a
        // holder whose lease expired mid-fetch (and was taken over) must not
        // overwrite the newer list. A failed write still serves the paid data.
        let written = false;
        try {
          written = await db.runTransaction(async (tx) => {
            const lease = await tx.get(leaseRef);
            if (!lease.exists || lease.data()?.owner !== owner) return false;
            tx.set(docRef, doc);
            return true;
          });
        } catch (err) {
          console.error(`[PopularMarket] cache write failed for ${kind} (serving the fetched list uncached): ${err.message}`);
        }
        console.log(written
          ? `[PopularMarket] FETCH | kind=${kind} | symbols=${data?.count ?? 0} | one upstream request, shared by every tab for ${POPULAR_MARKET_TTL_MS / 1000}s`
          : `[PopularMarket] FETCH_UNCACHED | kind=${kind} | symbols=${data?.count ?? 0} | lease lost or write failed`);
        return { data, source: 'fetched', ageMs: 0 };
      } finally {
        await releaseLease(db, leaseRef, owner).catch((err) =>
          console.error(`[PopularMarket] lease release failed for ${kind} (expires on its own): ${err.message}`));
      }
    }

    if (now() >= deadline) {
      throw new Error(`another instance held the lease for ${POPULAR_MARKET_WAIT_MS}ms without a fresh write`);
    }
    waited = true;
    await sleep(POPULAR_MARKET_POLL_MS);
  }
}
