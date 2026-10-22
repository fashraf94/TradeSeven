// api/agent/cockpit-bench.js
//
// GET /api/agent/cockpit-bench?battleId=…&callId=… — THE BENCH SHEET'S READ
// (Cockpit Build 2b spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-10, §5.7; the
// V5 mockup's 6A). Behind COCKPIT_2B_ENABLED: off, every answer past the
// owner check is 404 `cockpit_unavailable`.
//
// THE ORDER (the cockpit-status precedent):
//   1  security middleware + the per-IP limiter
//   2  method — GET only                                    → 405
//   3  auth — the uid from the VERIFIED token                → 401
//   4  the query — a battleId                                → 400
//   5  the per-user limiter, before any read                 → 429
//   6  read the battle — missing                             → 404
//   7  the caller is not the owner                           → 403
//   8  resolved mode 'on' AND the 2b flag                     → else 404 cockpit_unavailable
//   9  a callId names an exit call of this battle            → else 400 invalid_call
//  10  200 { asOf, out, rows } with Cache-Control: no-store
//
// THE ROWS (D-7: the swap's own lists, swappable.js):
//   scoped (callId)  every name on the swap's lists of OUT's asset class, held
//                    names omitted; status from canComeIn against OUT at
//                    Date.now(): 'available' · 'locked' (+ lockedUntil) ·
//                    'not_swappable' · 'no_price' — a STOCK the price read
//                    holds no usable price for (absent, non-finite or ≤ 0) is
//                    not offered (D-3 rev 2's reasoning: delisted names stay on
//                    benches until the stale-universe work lands); crypto is
//                    exempt and shows "—" when unknown. Filing is unchanged:
//                    the endpoint's D-7 check and the executor stay the authority.
//   browse           every bench-list name, held names omitted, status from
//                    the lock alone ('available' · 'locked').
//
// THE FIELDS, at HEAD (spec S-10 asked for each name to be cited):
//   rank     indexIntelligence/stockRankings `stocks[].technicalRank` (the doc
//            the cron reads; compute-index-intelligence.js writes it)
//   atrPct   the same row's `techRaw.atrPercent`
//   sector   the same row's `sectorName`, else the bench row's `sector`
//   name     the bench row's `name` (the hot bench carries none → null)
//   price    voiceLayerCache/{battleId} `benchBriefs[].price` and
//   changePct  `benchBriefs[].changePercent` (api/cron/voice-layer-cache.js
//            buildBenchBriefs — the 15-minute REST quote the chat agent reads).
//            HEAD DIFFERS FROM THE SPEC HERE: the spec names the rankings
//            document for prices and the day's change, and that document
//            carries neither (read 2026-10-21: 235 rows, no price or change
//            key). Read literally, every stock row would be 'no_price' and the
//            sheet could offer no stock pick. The build report records the
//            reading for a founder ruling; benchPriceRows() is the one place a
//            ruling would change. TWO CONSEQUENCES OF THAT SOURCE (review
//            CB1-3): benchBriefs covers the bench stocks and the crypto slot
//            only, so a HOT-BENCH name is always 'no_price' here although the
//            executor accepts it and the card's chip may offer it; and before
//            the battle's first voice-layer run (*/15, market hours) there is
//            no cache document, so every stock row is 'no_price'. Both are in
//            the build report's founder questions (benchBriefs is also read by
//            the chat's prompt, so widening it is model-visible).
//   asOf     the price read's own instant (the cache document's `updatedAt`) —
//            the sheet's "prices as of {t}" names the vintage of the numbers
//            it shows (BUILD_RULES §9); null without a cache document.
// A missing field is null, rendered "—". No model call. No write.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { resolveCallRecordsMode } from '../_utils/callRecords/mode.js';
import { canComeIn, swapListNames, benchRowLockedAt } from '../_utils/callRecords/swappable.js';
import { isCockpit2bOn } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 5 };

/** The per-IP window (the shared middleware's limiter). */
export const COCKPIT_BENCH_IP_RATE_LIMIT = Object.freeze({ limit: 60, windowMs: 60_000 });
/** The per-user window, kept in this process (the cockpit-status precedent). */
export const COCKPIT_BENCH_USER_RATE_LIMIT = Object.freeze({ limit: 30, windowMs: 60_000 });
/** The row statuses the sheet renders (spec S-10). */
export const BENCH_ROW_STATUSES = Object.freeze(['available', 'locked', 'not_swappable', 'no_price']);

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const CRYPTO_SUFFIX = /\.CC$/i;
const TIERS = Object.freeze(['star', 'core', 'support']);

const windows = new Map();
/** Record one request against the caller's own window; true when the window is already full. */
export function userRateLimited(uid, nowMs = Date.now()) {
  const { limit, windowMs } = COCKPIT_BENCH_USER_RATE_LIMIT;
  const kept = (windows.get(uid) || []).filter((t) => nowMs - t < windowMs);
  if (kept.length >= limit) { windows.set(uid, kept); return true; }
  kept.push(nowMs);
  windows.set(uid, kept);
  return false;
}
/** Tests only. */
export function resetCockpitBenchRateLimit() { windows.clear(); }

const instantIso = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch { return null; } }
  const ms = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/** The held symbols, every tier. */
function heldSet(battle) {
  const held = new Set();
  for (const tier of TIERS) for (const r of Array.isArray(battle?.portfolio?.[tier]) ? battle.portfolio[tier] : []) if (nonEmpty(r?.symbol)) held.add(r.symbol);
  return held;
}

/** The persisted bench's row for a symbol (stocks, then the crypto slot), or null for a hot-bench name. */
function benchRowOf(battle, symbol) {
  const bench = battle?.portfolio?.bench;
  const stock = (Array.isArray(bench?.stocks) ? bench.stocks : []).find((s) => s?.symbol === symbol);
  if (stock) return stock;
  return bench?.crypto?.symbol === symbol ? bench.crypto : null;
}

/** Is a name crypto, as the swap reads it (a bench row's isCrypto; hot-bench names are stocks). */
function nameIsCrypto(battle, symbol) {
  const row = benchRowOf(battle, symbol);
  return row ? row.isCrypto === true : false;
}

/** OUT's asset class: its book row (isCrypto or a .CC suffix, agentSwapExecution.js:362), else the suffix alone. */
function outIsCrypto(battle, out) {
  for (const tier of TIERS) {
    const row = (Array.isArray(battle?.portfolio?.[tier]) ? battle.portfolio[tier] : []).find((r) => r?.symbol === out);
    if (row) return row.isCrypto === true || CRYPTO_SUFFIX.test(out);
  }
  return CRYPTO_SUFFIX.test(out || '');
}

/**
 * THE PRICE READ (the one place a founder ruling on S-10's price source
 * changes): `{ asOf, bySymbol: { [sym]: { price, changePct } } }` from the
 * battle's voice-layer cache bench briefs.
 */
export function benchPriceRows(cacheDoc) {
  const briefs = Array.isArray(cacheDoc?.benchBriefs) ? cacheDoc.benchBriefs : [];
  const bySymbol = {};
  for (const b of briefs) {
    if (!nonEmpty(b?.symbol)) continue;
    bySymbol[b.symbol] = { price: finite(b.price) ? b.price : null, changePct: finite(b.changePercent) ? b.changePercent : null };
  }
  return { asOf: instantIso(cacheDoc?.updatedAt), bySymbol };
}

/** A usable price: finite and above zero. */
const usablePrice = (p) => finite(p) && p > 0;

/**
 * The rows (pure): the battle, the call (or null for browse), the rankings
 * rows by symbol, the price read, the instant.
 */
export function buildBenchRows({ battle, call = null, rankingsBySymbol = {}, prices = { asOf: null, bySymbol: {} }, nowMs }) {
  const held = heldSet(battle);
  const scoped = Boolean(call);
  const out = scoped ? call.symbol : null;
  // An exit whose stock already LEFT the book can bring nobody in: every scoped row is not_swappable (the filing
  // would be 400 symbol_not_held — review CB1-8).
  const outGone = scoped && !held.has(out);
  const outCrypto = scoped ? outIsCrypto(battle, out) : null;
  const names = swapListNames(battle).filter((s) => !held.has(s) && (!scoped || nameIsCrypto(battle, s) === outCrypto));
  const rows = names.map((symbol) => {
    const bench = benchRowOf(battle, symbol);
    const ranking = rankingsBySymbol[symbol] || null;
    const priced = prices.bySymbol?.[symbol] || null;
    const crypto = nameIsCrypto(battle, symbol);
    const price = priced?.price ?? null;
    let status;
    let lockedUntil = null;
    if (scoped && outGone) {
      status = 'not_swappable';
    } else if (scoped) {
      const verdict = canComeIn({ battle, out, slot: call.slot, inSymbol: symbol, atMs: nowMs });
      if (verdict.ok) status = !crypto && !usablePrice(price) ? 'no_price' : 'available';
      else if (verdict.reason === 'pick_locked') { status = 'locked'; lockedUntil = bench?.cooldownUntil ?? null; } else status = 'not_swappable';
    } else if (bench && benchRowLockedAt(bench, nowMs)) {
      status = 'locked';
      lockedUntil = bench.cooldownUntil;
    } else {
      status = 'available';
    }
    return {
      symbol,
      name: nonEmpty(bench?.name) ? bench.name : null,
      sector: nonEmpty(ranking?.sectorName) ? ranking.sectorName : (nonEmpty(bench?.sector) ? bench.sector : null),
      rank: Number.isInteger(ranking?.technicalRank) ? ranking.technicalRank : null,
      price,
      changePct: priced?.changePct ?? null,
      atrPct: finite(ranking?.techRaw?.atrPercent) ? ranking.techRaw.atrPercent : null,
      status,
      lockedUntil: lockedUntil ?? null,
    };
  });
  return { asOf: prices.asOf ?? null, out: scoped ? { symbol: out, slot: call.slot ?? null } : null, rows };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: COCKPIT_BENCH_IP_RATE_LIMIT.limit, windowMs: COCKPIT_BENCH_IP_RATE_LIMIT.windowMs } })) {
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  const first = (v) => (Array.isArray(v) ? v[0] : v);
  const battleId = first(req.query?.battleId);
  const callIdRaw = first(req.query?.callId);
  if (!nonEmpty(battleId)) {
    return res.status(400).json({ error: 'invalid_request', message: 'battleId is required' });
  }
  if (callIdRaw !== undefined && callIdRaw !== null && callIdRaw !== '' && !nonEmpty(callIdRaw)) {
    return res.status(400).json({ error: 'invalid_request', message: 'callId must be a call id' });
  }
  if (userRateLimited(user.uid)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const db = getFirebaseAdmin();
    const battleRef = db.collection('agentBattles').doc(battleId.trim());
    const snap = await battleRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const battle = snap.data();
    if (battle?.ownerId !== user.uid) return res.status(403).json({ error: 'forbidden' });
    if (resolveCallRecordsMode(battle) !== 'on' || !isCockpit2bOn()) return res.status(404).json({ error: 'cockpit_unavailable' });
    let call = null;
    if (nonEmpty(callIdRaw)) {
      const callSnap = await battleRef.collection('calls').doc(callIdRaw.trim()).get();
      const c = callSnap.exists ? callSnap.data() : null;
      if (!c || c.kind === 'pick' || c.direction !== 'exit') return res.status(400).json({ error: 'invalid_call' });
      call = c;
    }
    const [rankingsSnap, cacheSnap] = await Promise.all([
      db.collection('indexIntelligence').doc('stockRankings').get(),
      db.collection('voiceLayerCache').doc(battleId.trim()).get(),
    ]);
    const rankingsBySymbol = {};
    for (const s of (rankingsSnap.exists ? rankingsSnap.data()?.stocks : null) || []) if (nonEmpty(s?.symbol)) rankingsBySymbol[s.symbol] = s;
    const prices = benchPriceRows(cacheSnap.exists ? cacheSnap.data() : null);
    return res.status(200).json(buildBenchRows({ battle, call, rankingsBySymbol, prices, nowMs: Date.now() }));
  } catch (error) {
    console.error('[CockpitBench] Error:', error?.message || error);
    return res.status(500).json({ error: 'Could not read the bench.' });
  }
}
