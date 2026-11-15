// api/agent/battle-research-quotes.js
//
// GET /api/agent/battle-research-quotes?battleId=… — BATTLE RESEARCH'S ONE
// SERVER READ (Battle Research Slice 1, spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §5): today's moves for the
// battle's own names, copied from the intraday collector's published snapshot.
// Behind BATTLE_RESEARCH_MODE: off, every answer past the battle checks is 404
// `battle_research_unavailable`, before the snapshot is read.
//
// THE ORDER (the cockpit-bench precedent):
//   1  security middleware + the per-IP limiter
//   2  method — GET only                                    → 405
//   3  auth — the uid from the VERIFIED token                → 401
//   4  the query — a battleId                                → 400
//   5  the per-user limiter, before any read                 → 429
//   6  read the battle — missing                             → 404
//   7  the caller is not the owner                           → 403
//   8  not active, or a League battle (isLeagueBattle)       → 404 battle_research_unavailable
//   9  BATTLE_RESEARCH_MODE does not resolve on for this owner ('allowlist':
//      isCockpitOwnerAllowlisted at call time)               → 404 battle_research_unavailable
//  10  read intradaySnapshots/latest: ONE Admin SDK .get(), through a
//      per-instance memory cache of at most 30 seconds keyed by the doc's
//      sweepId — NEVER a provider call; a missing doc is `snapshot: null`
//      and every quote null
//  11  200 { servedAt, snapshot, quotes } with Cache-Control: private, no-store
//
// THE SYMBOLS are selectBattleUniverse(battle) — the battle's own book and
// roster. NEVER a list from the client: a `symbols` query is ignored. A crypto
// name never matches: the collector keys crypto by its base ticker (BTC for
// BTC-USD.CC), so its quote is null — Battle Research compares no crypto (BRS-9).
//
// THE BODY: values COPIED, never derived (no change is computed from the
// price); times normalized to epoch ms; nothing else from the snapshot leaves
// the server (no indicators, no anomalies, no counters, no lease).
//   { servedAt: ms,
//     snapshot: { sweepId, sweepAt: ms, lastSuccessfulSweepAt: ms } | null,
//     quotes: { [sym]: { price, previousClose, changePercent, priceAsOf: ms,
//                        sessionEtDate, collectionStalled } | null } }
//
// No Firestore rule changes: the snapshot stays default-deny to clients; this
// route adds a reader only. No model call. No write.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isCockpitOwnerAllowlisted } from '../_utils/callRecords/mode.js';
import { snapshotRef } from '../_utils/intraday/intradayStore.js';
import { selectBattleUniverse } from '../../src/data/battleUniverse.js';
import { isLeagueBattle } from '../../src/screens/battleViewRouting.js';
import { resolveBattleResearchMode, battleResearchModeOn } from '../../src/components/Research/BattleResearch/battleResearchMode.js';

export const config = { maxDuration: 5 };

/** The per-IP window (the shared middleware's limiter). */
export const BATTLE_RESEARCH_IP_RATE_LIMIT = Object.freeze({ limit: 60, windowMs: 60_000 });
/** The per-user window, kept in this process (the cockpit-bench precedent). */
export const BATTLE_RESEARCH_USER_RATE_LIMIT = Object.freeze({ limit: 20, windowMs: 60_000 });
/** The snapshot cache's longest life (§5 step 10). */
export const SNAPSHOT_CACHE_MS = 30_000;

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

const windows = new Map();
/** Record one request against the caller's own window; true when the window is already full. */
export function userRateLimited(uid, nowMs = Date.now()) {
  const { limit, windowMs } = BATTLE_RESEARCH_USER_RATE_LIMIT;
  const kept = (windows.get(uid) || []).filter((t) => nowMs - t < windowMs);
  if (kept.length >= limit) { windows.set(uid, kept); return true; }
  kept.push(nowMs);
  windows.set(uid, kept);
  return false;
}

let snapshotCache = null; // { atMs, sweepId, value: { snapshot, symbols } }
/** Tests only. */
export function resetBattleResearchState() { windows.clear(); snapshotCache = null; }

/** An instant as epoch ms: a number, a Firestore Timestamp, or an ISO string; null otherwise. */
export function msOf(v) {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return finite(ms) ? ms : null; } catch { return null; } }
  return null;
}

const num = (v) => (finite(v) ? v : null);

/** One symbol's facts, COPIED (never derived): the price block's four fields, the session date, the stall flag. */
export function quoteOf(facts) {
  const p = facts && typeof facts === 'object' ? facts.price : null;
  if (!p || typeof p !== 'object') return null;
  return {
    price: num(p.value),
    previousClose: num(p.previousClose),
    changePercent: num(p.changePercent),
    priceAsOf: msOf(p.priceAsOf),
    sessionEtDate: nonEmpty(facts.sessionEtDate) ? facts.sessionEtDate : null,
    collectionStalled: facts.collectionStalled === true,
  };
}

/** The snapshot document → { snapshot, symbols } (doc-level ids and times only; the per-symbol facts the body may copy). */
export function projectSnapshot(doc) {
  if (!doc || typeof doc !== 'object') return { snapshot: null, symbols: {} };
  return {
    snapshot: {
      sweepId: nonEmpty(doc.sweepId) ? doc.sweepId : null,
      sweepAt: msOf(doc.sweepAt),
      lastSuccessfulSweepAt: msOf(doc.lastSuccessfulSweepAt),
    },
    symbols: doc.symbols && typeof doc.symbols === 'object' ? doc.symbols : {},
  };
}

/**
 * Step 10: the snapshot through the per-instance cache. A cached value at most SNAPSHOT_CACHE_MS
 * old answers without a read; past it, ONE .get() — and when the doc still names the cached
 * sweepId, the cached projection is kept (the same sweep is the same facts).
 */
export async function readSnapshot(db, nowMs = Date.now()) {
  if (snapshotCache && nowMs - snapshotCache.atMs < SNAPSHOT_CACHE_MS) return snapshotCache.value;
  const snap = await snapshotRef(db).get();
  const doc = snap.exists ? snap.data() : null;
  const sweepId = doc && nonEmpty(doc.sweepId) ? doc.sweepId : null;
  const value = snapshotCache && sweepId !== null && snapshotCache.sweepId === sweepId ? snapshotCache.value : projectSnapshot(doc);
  snapshotCache = { atMs: nowMs, sweepId, value };
  return value;
}

/** The body (pure): the battle's own symbols, each its copied quote or null. */
export function buildQuotesBody({ battle, projected, servedAt }) {
  const quotes = {};
  for (const sym of selectBattleUniverse(battle)) quotes[sym] = projected.snapshot ? quoteOf(projected.symbols[sym]) : null;
  return { servedAt, snapshot: projected.snapshot, quotes };
}

/** Step 9: does the flag admit this owner? 'allowlist' reads the server allowlist at THIS call. */
export function battleResearchAdmits(ownerId) {
  const mode = resolveBattleResearchMode();
  return battleResearchModeOn(mode, { verdict: mode === 'allowlist' ? isCockpitOwnerAllowlisted(ownerId) : undefined });
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: BATTLE_RESEARCH_IP_RATE_LIMIT.limit, windowMs: BATTLE_RESEARCH_IP_RATE_LIMIT.windowMs } })) {
    return;
  }
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  const first = (v) => (Array.isArray(v) ? v[0] : v);
  const battleId = first(req.query?.battleId);
  if (!nonEmpty(battleId)) {
    return res.status(400).json({ error: 'invalid_request', message: 'battleId is required' });
  }
  // One document id: no path segments, within Firestore's id length (review BR3-6) — a 400, never a 500.
  if (battleId.includes('/') || Buffer.byteLength(battleId.trim(), 'utf8') > 1500) {
    return res.status(400).json({ error: 'invalid_request', message: 'battleId must be a battle id' });
  }
  if (userRateLimited(user.uid)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const db = getFirebaseAdmin();
    const snap = await db.collection('agentBattles').doc(battleId.trim()).get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const battle = snap.data();
    if (battle?.ownerId !== user.uid) return res.status(403).json({ error: 'forbidden' });
    if (battle?.status !== 'active' || isLeagueBattle(battle)) return res.status(404).json({ error: 'battle_research_unavailable' });
    if (!battleResearchAdmits(battle.ownerId)) return res.status(404).json({ error: 'battle_research_unavailable' });
    const nowMs = Date.now();
    const projected = await readSnapshot(db, nowMs);
    return res.status(200).json(buildQuotesBody({ battle, projected, servedAt: nowMs }));
  } catch (error) {
    console.error('[BattleResearchQuotes] Error:', error?.message || error);
    return res.status(500).json({ error: 'Could not read the quotes.' });
  }
}
