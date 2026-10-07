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
// { data, cachedAt, ttlType, ttlMs, expiresAt }, market-aware effective TTL via
// getEffectiveTTLMs. There is NO in-memory L1 layer — the document is the one
// shared truth, so a per-instance copy cannot add a second staleness on top.
//
// TTL — 60 s (founder ruling, Oct 7): the same age envelope tabs had from
// /api/stocks/prices' own 60 s cache, so no price a tab reads is older than
// today's. While the market is closed, a stock list holds while its age is
// within the time left to the next open — the effective TTL is
// max(60 s, time-until-open) measured at read time, today's client rule
// (src/utils/marketSchedule.js getEffectiveTTL) and the server one
// (getEffectiveTTLMs). In the 9:20–9:30 ET pre-market window it falls back to
// 60 s, as the client evicts closed-market stock prices there. Crypto is
// always 60 s.
//
// CONCURRENCY — a Firestore LEASE per list (marketDataLeases/{kind}_popular),
// taken in a transaction. Several instances that miss at once produce ONE
// upstream fetch: the lease winner fetches and writes, the others poll the
// document until it is fresh. A write-if-older transaction alone would not do
// it — every cold instance would pay for its own fetch before one of them
// committed. A holder that dies leaves a lease that expires after
// POPULAR_MARKET_LEASE_MS; the next waiter takes it over. A waiter that sees
// nothing fresh within POPULAR_MARKET_WAIT_MS gives up and the route reports
// that list as unavailable (the client then shows today's fallbacks).

import { getEffectiveTTLMs, isPreMarketWindow } from './marketSchedule.js';

/** The shared TTL — ONE named constant (founder ruling, Oct 7). */
export const POPULAR_MARKET_TTL_MS = 60_000;
/** How long a lease protects one fetch; longer than any healthy fetch. */
export const POPULAR_MARKET_LEASE_MS = 15_000;
/** How long a waiter polls for the holder's write before giving up. */
export const POPULAR_MARKET_WAIT_MS = 20_000;
/** Poll interval while waiting on another instance's fetch. */
export const POPULAR_MARKET_POLL_MS = 400;

export const POPULAR_CACHE_COLLECTION = 'marketDataCache';
export const POPULAR_LEASE_COLLECTION = 'marketDataLeases';
export const POPULAR_TTL_TYPE = 'popular';
export const POPULAR_KINDS = Object.freeze(['stocks', 'crypto']);

export function popularDocId(kind) {
  return `${kind}_popular`;
}

/** The effective TTL for one list, right now. */
export function popularEffectiveTtlMs(kind) {
  if (kind === 'crypto') return POPULAR_MARKET_TTL_MS;
  if (isPreMarketWindow()) return POPULAR_MARKET_TTL_MS;
  return getEffectiveTTLMs(POPULAR_TTL_TYPE, POPULAR_MARKET_TTL_MS, { isCrypto: false });
}

function toMillis(value) {
  if (value == null) return NaN;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/** Is a cached list document still inside its effective TTL at `nowMs`? */
export function isPopularDocFresh(doc, kind, nowMs) {
  if (!doc || !doc.data) return false;
  const at = toMillis(doc.cachedAt);
  if (!Number.isFinite(at)) return false;
  return nowMs - at <= popularEffectiveTtlMs(kind);
}

async function tryAcquireLease(db, leaseRef, owner, nowMs) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(leaseRef);
    const lease = snap.exists ? snap.data() : null;
    if (lease && lease.owner !== owner && Number(lease.expiresAtMs) > nowMs) return false;
    tx.set(leaseRef, { owner, acquiredAtMs: nowMs, expiresAtMs: nowMs + POPULAR_MARKET_LEASE_MS });
    return true;
  });
}

async function releaseLease(db, leaseRef, owner) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(leaseRef);
    if (snap.exists && snap.data()?.owner === owner) tx.delete(leaseRef);
  });
}

function randomOwner() {
  return `popular-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Read one popular list through the shared cache.
 *
 * @param {object} db - Firestore (Admin SDK shape)
 * @param {'stocks'|'crypto'} kind
 * @param {object} opts
 * @param {() => Promise<{prices:object, count:number}>} opts.fetchList - ONE upstream fetch of the whole list
 * @param {() => number} [opts.now]
 * @param {(ms:number) => Promise<void>} [opts.sleep]
 * @param {string} [opts.owner]
 * @returns {Promise<{data:object, source:'cache'|'waited'|'fetched', ageMs:number}>}
 */
export async function readPopularList(db, kind, { fetchList, now = () => Date.now(), sleep = defaultSleep, owner = randomOwner() } = {}) {
  if (!POPULAR_KINDS.includes(kind)) throw new Error(`unknown popular list: ${kind}`);
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

  for (;;) {
    const fresh = await readFresh();
    if (fresh) {
      const ageMs = now() - toMillis(fresh.cachedAt);
      console.log(`[PopularMarket] HIT | kind=${kind} | ageMs=${ageMs} | source=${waited ? 'waited' : 'cache'}`);
      return { data: fresh.data, source: waited ? 'waited' : 'cache', ageMs };
    }

    if (await tryAcquireLease(db, leaseRef, owner, now())) {
      try {
        // Re-read under the lease: a previous holder may have written between
        // our read and our acquire. Never pay for a list someone just paid for.
        const raced = await readFresh();
        if (raced) {
          const ageMs = now() - toMillis(raced.cachedAt);
          console.log(`[PopularMarket] HIT | kind=${kind} | ageMs=${ageMs} | source=${waited ? 'waited' : 'cache'}`);
          return { data: raced.data, source: waited ? 'waited' : 'cache', ageMs };
        }
        // JSON round trip: exactly what a tab received from the per-symbol
        // routes' res.json (undefined keys dropped, NaN → null) — and Firestore
        // rejects `undefined`, which a vendor record can carry (e.g. volume).
        const data = JSON.parse(JSON.stringify(await fetchList()));
        const cachedAtMs = now();
        await docRef.set({
          data,
          cachedAt: new Date(cachedAtMs),
          ttlType: POPULAR_TTL_TYPE,
          ttlMs: POPULAR_MARKET_TTL_MS,
          expiresAt: new Date(cachedAtMs + POPULAR_MARKET_TTL_MS),
        });
        console.log(`[PopularMarket] FETCH | kind=${kind} | symbols=${data?.count ?? 0} | one upstream request, shared by every tab for ${POPULAR_MARKET_TTL_MS / 1000}s`);
        return { data, source: 'fetched', ageMs: 0 };
      } finally {
        await releaseLease(db, leaseRef, owner).catch((err) =>
          console.error(`[PopularMarket] lease release failed for ${kind} (expires on its own): ${err.message}`));
      }
    }

    if (now() >= deadline) {
      throw new Error(`popular ${kind}: another instance held the lease for ${POPULAR_MARKET_WAIT_MS}ms without a fresh write`);
    }
    waited = true;
    await sleep(POPULAR_MARKET_POLL_MS);
  }
}
