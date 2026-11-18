// api/research/setup-read.js
//
// GET /api/research/setup-read?symbol=… — THE CHART'S EVIDENCE, READ ONLY (spec of record
// docs/specs/CHART_EVIDENCE_SPEC_V1.md §4, rulings RR-1 – RR-9). One ranked stock's stored
// Trend Follower setup record, for the last completed session, as copied fields.
//
// THE ORDER (the battle-research-quotes.js precedent):
//   1  security middleware + the per-IP limiter
//   2  method — GET only                                         → 405
//   3  auth — the uid from the VERIFIED token                     → 401
//   4  CHART_READ_MODE does not resolve on for this player ('allowlist':
//      isCockpitOwnerAllowlisted at call time)                    → 404 chart_read_unavailable
//   5  the symbol — one of the ranked stocks (ALL_TICKERS), matched without regard to
//      case, "." read as "-" (BRK.B → BRK-B, the store's form); crypto
//                                                                 → 400 unsupported_symbol_class;
//      anything else                                              → 400 invalid_symbol
//   6  the per-user limiter, before any read                      → 429
//   7  the reads: readSnapshot for the last completed session (lastCompletedSessionAt), then
//      for the session before it — AT MOST TWO for `read` — and, when `read` is a record, ONE
//      more for `previous` (the session before `read`'s; the Chart view's read build, RD-1 –
//      RD-5, docs/specs/CHART_READ_SPEC_V1.md): 0 to 3 record reads a call, through a
//      per-instance memory cache of at most 60 seconds keyed by symbol and session
//   8  200 { answer, symbol, servedAt, sessionsTried, read, previous } with Cache-Control: private, no-store
//
// THE SESSION IS THE SERVER'S (RR-4). A client `session` is ignored. `read.behind` is true
// when only the earlier session has a record. Three answers, never merged (RR-5): `measured`
// (a record from usable evidence, with its verdict), `refused` (a record that says the
// evidence could not be used, with its reason), `absent` (no record for either session).
//
// READ ONLY (RR-1): readSnapshot and nothing else of the store. Never getOrAcquireSnapshot,
// never the claims collection, never a provider call, never a write, never a model call.
// setup-read.test.js fails on each. A record carries no owner and no battle id (RR-2): any
// signed-in player may read one, and the flag decides the audience.
//
// setupEvidenceImportGuard.test.js lists this file and its test by exact filename (RR-9).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isCockpitOwnerAllowlisted } from '../_utils/callRecords/mode.js';
import { readSnapshot, lastCompletedSessionAt } from '../_utils/setupEvidence/index.js';
import { describeRuleSet } from '../_utils/setupEvaluator/thresholds.js';
import { isCryptoSymbol } from '../_utils/marketDataCache.js';
import { ALL_TICKERS } from '../_utils/rankingConfig.js';
import { answerOf, projectSetupRecord, projectPreviousRecord } from '../_utils/setupRead/projection.js';
import { chartReadModeOn, resolveChartReadMode } from '../../src/components/Research/Sheet/chartReadMode.js';

export const config = { maxDuration: 5 };

/** The per-IP window (the shared middleware's limiter). */
export const SETUP_READ_IP_RATE_LIMIT = Object.freeze({ limit: 60, windowMs: 60_000 });
/** The per-user window, kept in this process (the battle-research-quotes precedent). */
export const SETUP_READ_USER_RATE_LIMIT = Object.freeze({ limit: 30, windowMs: 60_000 });
/** The answer cache's longest life (RR-8). */
export const SETUP_READ_CACHE_MS = 60_000;
/** A symbol longer than this is not read at all. */
const SYMBOL_MAX_LENGTH = 24;
const RANKED = new Set(ALL_TICKERS);

const windows = new Map();
/** Record one request against the caller's own window; true when the window is already full. */
export function userRateLimited(uid, nowMs = Date.now()) {
  const { limit, windowMs } = SETUP_READ_USER_RATE_LIMIT;
  const kept = (windows.get(uid) || []).filter((t) => nowMs - t < windowMs);
  if (kept.length >= limit) { windows.set(uid, kept); return true; }
  kept.push(nowMs);
  windows.set(uid, kept);
  return false;
}

const cache = new Map(); // `${symbol}|${latestSession}` → { atMs, value }
/** Tests only. */
export function resetSetupReadState() { windows.clear(); cache.clear(); }

/** Step 4: does the flag admit this player? 'allowlist' reads the server allowlist at THIS call. */
export function chartReadAdmits(uid) {
  const mode = resolveChartReadMode();
  return chartReadModeOn(mode, { verdict: mode === 'allowlist' ? isCockpitOwnerAllowlisted(uid) : undefined });
}

/**
 * Step 5 (RR-3): the query's symbol → { symbol } in the store's form, or { error }. Pure.
 * Crypto is answered before the ranked list, so it is never a generic refusal.
 */
export function symbolOf(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return { error: 'invalid_request' };
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > SYMBOL_MAX_LENGTH) return { error: 'invalid_request' };
  if (isCryptoSymbol(trimmed)) return { error: 'unsupported_symbol_class' };
  const symbol = trimmed.toUpperCase().replace(/\./g, '-');
  return RANKED.has(symbol) ? { symbol } : { error: 'invalid_symbol' };
}

/** The session before a session; null when the calendar cannot say. Pure. */
export function sessionBefore(session) {
  // Noon UTC on a session's own date is before its close, so the answer is the session before it.
  const prior = lastCompletedSessionAt(Date.parse(`${session}T12:00:00Z`));
  return prior.ok && prior.session < session ? prior.session : null;
}

/** RR-4: the last completed session, then the one before it; null when the calendar cannot say. Pure. */
export function sessionsToTry(nowMs) {
  const latest = lastCompletedSessionAt(nowMs);
  if (!latest.ok) return null;
  const prior = sessionBefore(latest.session);
  return prior ? [latest.session, prior] : [latest.session];
}

/**
 * Step 7: the answer for one symbol now, through the cache. At most two record reads for `read`, and
 * one more for `previous` (RD-3) when `read` is a record: 0 to 3 a call.
 */
export async function readSetup({ db, symbol, nowMs }) {
  const sessions = sessionsToTry(nowMs);
  if (!sessions) return null;
  const key = `${symbol}|${sessions[0]}`;
  const hit = cache.get(key);
  let value = hit && nowMs - hit.atMs >= 0 && nowMs - hit.atMs < SETUP_READ_CACHE_MS ? hit.value : null;
  if (!value) {
    const ruleSet = describeRuleSet();
    // The one readSnapshot call site (RR-1): every record this route reads comes through it.
    const recordAt = (session) => readSnapshot({ db, session, symbol, ruleSet });
    const tried = [];
    for (let i = 0; i < sessions.length && !value; i++) {
      const session = sessions[i];
      tried.push(session);
      const record = await recordAt(session);
      if (record) value = { answer: answerOf(record), sessionsTried: [...tried], read: projectSetupRecord(record, { session, symbol, behind: i > 0 }), previous: null };
    }
    if (!value) value = { answer: 'absent', sessionsTried: tried, read: null, previous: null };
    // RD-1: the record of the session before `read`'s — one more read, the same cache and the same rule:
    // a record the projection cannot read throws (500), never null and never in part.
    if (value.read) {
      const before = sessionBefore(value.read.session);
      const earlier = before ? await recordAt(before) : null;
      if (earlier) value.previous = projectPreviousRecord(earlier, { session: before, symbol });
    }
    for (const [k, v] of cache) if (nowMs - v.atMs >= SETUP_READ_CACHE_MS) cache.delete(k);
    cache.set(key, { atMs: nowMs, value });
  }
  return { answer: value.answer, symbol, servedAt: nowMs, sessionsTried: [...value.sessionsTried], read: value.read, previous: value.previous };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: SETUP_READ_IP_RATE_LIMIT.limit, windowMs: SETUP_READ_IP_RATE_LIMIT.windowMs } })) {
    return;
  }
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  if (!chartReadAdmits(user.uid)) {
    return res.status(404).json({ error: 'chart_read_unavailable' });
  }
  const parsed = symbolOf(req.query?.symbol);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  if (userRateLimited(user.uid)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const body = await readSetup({ db: getFirebaseAdmin(), symbol: parsed.symbol, nowMs: Date.now() });
    if (!body) return res.status(503).json({ error: 'calendar_missing' });
    return res.status(200).json(body);
  } catch (error) {
    console.error('[SetupRead] Error:', error?.name || 'Error');
    return res.status(500).json({ error: 'Could not read the record.' });
  }
}
