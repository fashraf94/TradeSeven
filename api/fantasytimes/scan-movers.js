// api/fantasytimes/scan-movers.js
// Server-side mover backup — scans all tracked symbols for big intraday moves
// and triggers Alex stories for any that the client-side detector missed.
// GET endpoint called every 15 min during market hours.

import { applySecurityMiddleware } from '../_utils/security.js';
import { isMarketHolidayToday } from '../_utils/marketHolidayCheck.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { STOCK_DATA } from '../_utils/stockIntelligenceData.js';
import { FANTASYTIMES_TICKERS, SECTOR_MAP } from '../_utils/fantasyTimesTickers.js';
import { generateAlexMoverStory, BLOCKING_STORY_REASONS } from './generate-mover.js';
import {
  recordCandidate,
  consumeCandidate,
  markCandidateBlocked,
  tickPendingCandidate,
  listPendingCandidates,
  reSatisfiesTrigger,
  CANDIDATE_STATUS,
  DEFAULT_EXPIRY_TICKS,
} from '../_utils/moverCandidates.js';

// Deterministic story-suppression reasons that must TERMINATE the candidate
// (BLOCKED, no re-arm) instead of leaving it to re-arm and loop. Set for O(1)
// membership; the source of truth is generate-mover's BLOCKING_STORY_REASONS.
const BLOCK_REASON_SET = new Set(BLOCKING_STORY_REASONS);

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:ScanMovers]';
// 3% intraday move arms an Alex candidate. Two-tick confirmation (F1): tick T
// records the candidate; the NEXT scan pass (T+1, 15 min later) re-checks the
// move against this same threshold and only then retrieves + writes.
export const MOVE_THRESHOLD_PCT = 3;
const QUOTE_FETCH_TIMEOUT_MS = 5000;
const QUOTE_FETCH_CONCURRENCY = 8;

async function fetchQuote(symbol) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUOTE_FETCH_TIMEOUT_MS);
  try {
    const url = `https://eodhd.com/api/real-time/${symbol}.US?api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      return { symbol, ok: false, error: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    return { symbol, ok: true, data };
  } catch (err) {
    return { symbol, ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAllQuotes(symbols) {
  const out = [];
  for (let i = 0; i < symbols.length; i += QUOTE_FETCH_CONCURRENCY) {
    const chunk = symbols.slice(i, i + QUOTE_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(fetchQuote));
    for (const r of settled) {
      if (r.status === 'fulfilled') out.push(r.value);
      else out.push({ symbol: 'unknown', ok: false, error: r.reason?.message || 'rejected' });
    }
  }
  return out;
}

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

/**
 * Get the start of today in ET for dedup queries.
 */
function getStartOfTodayET() {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  et.setHours(0, 0, 0, 0);
  // Convert back to UTC by finding the offset
  const utcNow = now.getTime();
  const etNow = et.getTime();
  const diff = utcNow - new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
  return new Date(etNow + diff);
}

/**
 * The two-tick mover scan core (F1). Pure of HTTP + real I/O — every external
 * effect is injected — so the acceptance rows (R1/R1a/R2/R3) drive it directly.
 *
 * One invocation plays BOTH roles: it consumes last tick's pending candidates
 * (the T+1 pass) and arms this tick's fresh movers (the T pass). Consumption is
 * an atomic compare-and-set on candidate state (moverCandidates), so overlapping
 * invocations confirm a candidate exactly once (A1). The dedup check precedes
 * retrieval (F1b), so a dedup hit costs ZERO story/model/retrieval calls.
 *
 * @param {object} db
 * @param {object} deps
 * @param {Array}  deps.quotes — fetchAllQuotes() output ({symbol, ok, data|error})
 * @param {string} deps.marketDate — 'YYYY-MM-DD' candidate partition key
 * @param {number} [deps.threshold=MOVE_THRESHOLD_PCT]
 * @param {(args:object)=>Promise<{success:boolean}>} deps.generateStory — the writer
 * @param {(symbol:string)=>Promise<boolean>} deps.hasRecentStory — dedup probe
 * @param {(symbol:string)=>string} [deps.sectorOf]
 * @param {number} [deps.expiryTicks=DEFAULT_EXPIRY_TICKS]
 * @param {Date}   [deps.now]
 * @param {Function} [deps.info] / [deps.error] — loggers
 */
export async function runMoverScan(db, {
  quotes,
  marketDate,
  threshold = MOVE_THRESHOLD_PCT,
  generateStory,
  hasRecentStory,
  sectorOf = () => 'Unknown',
  expiryTicks = DEFAULT_EXPIRY_TICKS,
  // A candidate must be at least this old to confirm — it must have been armed
  // on an EARLIER pass, so the move genuinely persisted (two-tick). 5 min sits
  // well below the 15-min cadence (tolerating cron jitter) and well above any
  // seconds-scale overlapping double-invocation (review finding).
  minConfirmAgeMs = 5 * 60 * 1000,
  now = new Date(),
  info = () => {},
  error = () => {},
}) {
  const results = {
    // Display-agreement (§9): moversDetected decomposes over the T-detection
    // pass into exactly candidatesRecorded + moverAlreadyStoried (birth-
    // suppressed: a story already exists) + moverAlreadyPending (a candidate is
    // already armed) + moverAlreadyBlocked (a candidate BLOCKED earlier today,
    // not re-armed) — plus any arm-error captured in errors[]. Without these
    // counters the summary showed movers landing in no bucket.
    scanned: 0, moversDetected: 0, candidatesRecorded: 0,
    moverAlreadyStoried: 0, moverAlreadyPending: 0, moverAlreadyBlocked: 0,
    confirmed: 0, reverted: 0, expired: 0, blocked: 0,
    storiesGenerated: 0, dedupSkipped: 0, skipped: 0, errors: [],
  };

  // Fresh T+1 snapshots, keyed by symbol — the ONLY operand source for a write
  // (C3/R3: the story never describes T's stale tape).
  const freshBySymbol = new Map();
  for (const q of quotes) {
    if (!q.ok) { results.errors.push(`${q.symbol}: ${q.error}`); continue; }
    results.scanned++;
    const changeP = parseFloat(q.data.change_p);
    if (Number.isFinite(changeP)) freshBySymbol.set(q.symbol, { changeP, data: q.data });
  }
  const isMover = (symbol) => {
    const f = freshBySymbol.get(symbol);
    return !!f && Math.abs(f.changeP) >= threshold;
  };
  for (const [, f] of freshBySymbol) if (Math.abs(f.changeP) >= threshold) results.moversDetected++;

  const nowMs = (now && typeof now.getTime === 'function') ? now.getTime() : Date.now();

  // ── T+1 consumption pass: resolve last tick's pending candidates ──────────
  // Each iteration is fault-isolated: a transient error on one symbol must not
  // abort the whole tick (the origin/main handler isolated per-symbol; review
  // finding restores that).
  const pending = await listPendingCandidates(db, marketDate);
  for (const cand of pending) {
    const symbol = cand.symbol;
    try {
      const fresh = freshBySymbol.get(symbol);

      // Could not evaluate this pass (quote error / symbol not scanned) → tick
      // toward expiry (F1a: `expired` fires only on a skipped pass).
      if (!fresh) {
        const t = await tickPendingCandidate(db, { marketDate, symbol, maxTicks: expiryTicks, now });
        if (t.expired) { results.expired++; info(`candidate_expired: ${symbol}`); }
        continue;
      }

      // Whipsaw / partial revert that no longer independently clears the trigger
      // (F1c) → terminate as reverted, no story (R1c/R2). Reverting a young
      // candidate is fine — it genuinely reverted; only CONFIRMATION is age-gated.
      if (!reSatisfiesTrigger(fresh.changeP, cand.triggerSnapshot, threshold)) {
        const r = await consumeCandidate(db, { marketDate, symbol, outcome: CANDIDATE_STATUS.REVERTED, reason: 'whipsaw_reverted', now });
        if (r.won) { results.reverted++; info(`whipsaw_reverted: ${symbol} ${fresh.changeP.toFixed(2)}%`); }
        continue;
      }

      // Two-tick persistence guard: confirm only a candidate armed on an EARLIER
      // pass. Blocks a seconds-later overlapping invocation from confirming a
      // candidate its sibling just armed — the move must survive to a real next
      // scan, which is the whole point of two-tick.
      if (nowMs - (cand.armedAtMs || 0) < minConfirmAgeMs) {
        info(`candidate too young to confirm, left pending: ${symbol}`);
        continue;
      }

      // Confirmed. Dedup BEFORE retrieval (F1b) — a hit costs zero API calls.
      if (await hasRecentStory(symbol)) {
        const c = await consumeCandidate(db, { marketDate, symbol, outcome: CANDIDATE_STATUS.CONFIRMED, reason: 'dedup_skip', now });
        if (c.won) { results.dedupSkipped++; info(`dedup_skip (zero retrieval): ${symbol}`); }
        continue;
      }

      // Atomic claim — only the winner writes (idempotent under overlap, A1/R1a).
      const c = await consumeCandidate(db, { marketDate, symbol, outcome: CANDIDATE_STATUS.CONFIRMED, reason: 'confirmed', now });
      if (!c.won) { info(`consume lost race, skipping: ${symbol}`); continue; }
      results.confirmed++;

      const close = parseFloat(fresh.data.close) || 0;
      const previousClose = parseFloat(fresh.data.previousClose) || 0;
      const sr = await generateStory({
        symbol,
        currentPrice: close,
        priceChange: close - previousClose,
        percentChange: fresh.changeP,           // FRESH T+1 operand (R3)
        atrMultiple: 1.5,                        // server fallback; no ATR cached
        direction: fresh.changeP >= 0 ? 'up' : 'down',
        sector: sectorOf(symbol),
      });
      if (sr?.success) { results.storiesGenerated++; info(`wrote story: ${symbol} (${sr.headline || ''})`); }
      else if (sr && BLOCK_REASON_SET.has(sr.reason)) {
        // Deterministic suppression (earnings attribution / units) wrote NO
        // story, so hasRecentStory can never birth-suppress the re-arm.
        // Terminate the candidate as BLOCKED so it is NOT re-armed next tick —
        // this closes the confirm → generate → block → re-arm loop (the HD
        // incident). Best-effort: a failure here degrades to the old behavior,
        // never aborts the tick.
        try { await markCandidateBlocked(db, { marketDate, symbol, reason: sr.reason, now }); }
        catch (mbErr) { error(`markCandidateBlocked failed for ${symbol}`, { error: mbErr.message }); }
        results.blocked++;
        info(`story blocked → candidate terminated (no re-arm): ${symbol} (${sr.reason})`);
      }
      else { results.skipped++; info(`story skipped: ${symbol} (${sr?.reason || sr?.message || 'unknown'})`); }
    } catch (err) {
      results.errors.push(`${symbol}: ${err.message}`);
      error(`scan pass error for ${symbol}`, { error: err.message });
    }
  }

  // ── T detection pass: arm fresh movers (birth-suppressed) ─────────────────
  for (const [symbol, fresh] of freshBySymbol) {
    if (!isMover(symbol)) continue;
    try {
      // Birth-suppression, story half (F1b): a symbol already covered in the
      // dedup window arms no candidate (and a symbol just confirmed above now
      // has a story, so the sustained mover pays retrieval exactly once, R1a).
      if (await hasRecentStory(symbol)) { results.moverAlreadyStoried++; continue; }
      const rec = await recordCandidate(db, {
        marketDate,
        symbol,
        triggerSnapshot: {
          changePct: fresh.changeP,
          price: parseFloat(fresh.data.close) || 0,
          previousClose: parseFloat(fresh.data.previousClose) || 0,
          detectedAt: (now.toISOString && now.toISOString()) || String(now),
        },
        now,
      });
      if (rec.created) { results.candidatesRecorded++; info(`candidate armed: ${symbol} ${fresh.changeP.toFixed(2)}%`); }
      // recordCandidate returns created:false when the symbol is accounted for
      // but not newly armed: 'pending_exists' (armed on an earlier pass) or
      // 'blocked_terminal' (BLOCKED earlier today, re-arm refused — the loop
      // fix). Split into distinct §9 buckets so the still-moving-but-blocked
      // case is honest, not silently counted as "pending".
      else if (rec.reason === 'blocked_terminal') { results.moverAlreadyBlocked++; }
      else { results.moverAlreadyPending++; }
    } catch (err) {
      results.errors.push(`${symbol}: ${err.message}`);
      error(`arm error for ${symbol}`, { error: err.message });
    }
  }

  return results;
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (isMarketHolidayToday()) {
    return res.status(200).json({ skipped: true, reason: 'Market holiday' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ success: false, error: 'EODHD API key not configured' });
  }

  try {
    const db = getFirebaseAdmin();
    const startOfToday = getStartOfTodayET();
    const marketDate = new Date().toISOString().split('T')[0];

    logInfo(`Scanning ${FANTASYTIMES_TICKERS.length} symbols for big movers (>=${MOVE_THRESHOLD_PCT}%)`);
    const quoteFetchStart = Date.now();
    const quotes = await fetchAllQuotes(FANTASYTIMES_TICKERS);
    console.log(`[SCAN:TIMING] Quote fetch took ${Date.now() - quoteFetchStart}ms (${FANTASYTIMES_TICKERS.length} symbols)`);

    // Dedup probe — the same per-symbol Alex/today query as before, now shared
    // by birth-suppression (T) and the pre-retrieval dedup (T+1).
    const hasRecentStory = async (symbol) => {
      const q = await db
        .collection('fantasyTimesStories')
        .where('primaryTicker', '==', symbol)
        .where('reporter', '==', 'alex')
        .where('publishedAt', '>', startOfToday)
        .limit(1)
        .get();
      return !q.empty;
    };

    const processingStart = Date.now();
    const results = await runMoverScan(db, {
      quotes,
      marketDate,
      generateStory: generateAlexMoverStory,
      hasRecentStory,
      sectorOf: (symbol) => STOCK_DATA[symbol]?.sector || SECTOR_MAP[symbol] || 'Unknown',
      now: new Date(),
      info: (msg, data) => logInfo(msg, data),
      error: (msg, data) => logError(msg, data),
    });
    console.log(`[SCAN:TIMING] Two-tick processing took ${Date.now() - processingStart}ms`);

    logInfo('Scan complete', {
      scanned: results.scanned,
      moversDetected: results.moversDetected,
      candidatesRecorded: results.candidatesRecorded,
      moverAlreadyStoried: results.moverAlreadyStoried,
      moverAlreadyPending: results.moverAlreadyPending,
      moverAlreadyBlocked: results.moverAlreadyBlocked,
      confirmed: results.confirmed,
      reverted: results.reverted,
      expired: results.expired,
      blocked: results.blocked,
      storiesGenerated: results.storiesGenerated,
      dedupSkipped: results.dedupSkipped,
    });

    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    logError('Scan failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Mover scan failed' });
  }
}
