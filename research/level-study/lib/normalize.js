// research/level-study/lib/normalize.js
//
// Normalization layer. Takes raw EODHD daily + 5-min responses for one symbol and
// produces:
//   - normalized daily bars (warmup/holdout tagged, per-session adjustment factor)
//   - normalized 5-min bars (closing-auction tagged per A2, split-adjusted per A1)
//   - self-built 9:30-anchored ET hourly bars (parent §4.4; auction excluded per A2)
//   - per-session summaries (session-close carried separately per A2)
//
// ALL session logic is in exchange time via lib/session-time.js — no hardcoded UTC
// offsets (DST-correctness, S2 prompt §4).
//
// Imports only the study's own frozen config + the time backbone. Zero product imports.

import CONFIG from '../config.js';
import { etParts, etTzAbbrev, isoBefore, isoOnOrAfter } from './session-time.js';

const AUCTION_ET_MIN = CONFIG.closingAuction.detection.etMinutes;   // 960 (16:00 ET)
const OPEN_ET_MIN = CONFIG.session.regularOpenEtMinutes;            // 570 (09:30 ET)
const LAST_REG_OPEN_ET_MIN = CONFIG.session.lastRegularBarOpenEtMinutes; // 955 (15:55 ET)
const BUCKETS = CONFIG.hourly.bucketBoundariesEtMinutes;           // [570,630,...,960]
const STUDY_START = CONFIG.range.studyStart;                       // '2023-07-10'
const HOLDOUT_START = CONFIG.range.holdoutStart;                   // '2025-12-10'

// ── Daily ───────────────────────────────────────────────────────────────────

/**
 * @param {Array} rawDaily EODHD /eod records: {date, open, high, low, close, adjusted_close, volume}
 * @returns {{bars:Array, byDate:Map}} bars tagged warmup/holdout with per-session adjFactor
 */
export function normalizeDaily(rawDaily) {
  const bars = rawDaily.map((d) => {
    const adjFactor = (d.close && d.adjusted_close != null) ? d.adjusted_close / d.close : null;
    return {
      date: d.date,
      open: d.open, high: d.high, low: d.low, close: d.close,
      adjustedClose: d.adjusted_close, volume: d.volume,
      adjFactor,                                   // f(S) = adjusted_close / close (A1 / S1 §5)
      warmup: isoBefore(d.date, STUDY_START),      // A6: date < studyStart → warmup
      holdout: isoOnOrAfter(d.date, HOLDOUT_START), // R1: final ~7 months
    };
  });
  const byDate = new Map(bars.map((b) => [b.date, b]));
  return { bars, byDate };
}

/** Study-window selector: bars usable for events/outcomes (never warmup). Test-#2 surface. */
export function selectStudyWindow(dailyBars) {
  return dailyBars.filter((b) => !b.warmup);
}

/**
 * S5.6 §3 — the 5-minute warmup start for ONE symbol.
 *
 * Returns the ISO date of the session exactly `fetch.intradayWarmupSessions` (30) TRADING sessions
 * before studyStart, read off this symbol's own daily calendar. 30 gives margin over the 20
 * sessions the RVOL baseline actually needs (features-intraday.js RVOL_DAYS = 20).
 *
 * Derived, never hardcoded: 30 trading sessions is ~44 calendar days, but the exact span moves with
 * holidays. Reading the real calendar makes the warmup exactly 30 sessions deep for every symbol in
 * every year, with no arithmetic assumption to rot.
 *
 * Degenerate case (fewer than 30 pre-study daily bars — impossible for an R2-eligible name, which
 * needs 550): fall back to the earliest daily bar. Never returns a date at or after studyStart.
 *
 * Lives in lib/ (not the runner) so tests can import it WITHOUT executing the fetch orchestrator.
 * @param {Array<{date:string}>} dailyBars normalized daily bars for the symbol
 * @returns {string} ISO date to begin the 5m fetch at
 */
export function fiveMinWarmupStart(dailyBars) {
  const want = CONFIG.fetch.intradayWarmupSessions; // 30
  const pre = dailyBars.map((b) => b.date).filter((d) => isoBefore(d, STUDY_START)).sort();
  if (!pre.length) return CONFIG.fetch.intradayFetchStart; // no pre-study history → study window only
  return pre.length >= want ? pre[pre.length - want] : pre[0];
}

// ── 5-minute classification ──────────────────────────────────────────────────

/**
 * Classify one raw 5-min bar in exchange time.
 * @returns {{etDate,etMinutes,tzAbbrev,role,closingAuction}}
 *   role: 'regular' (09:30–15:55 open) | 'auction' (16:00 print) | 'other' (out of session)
 */
export function classifyBar(raw) {
  const t = etParts(raw.timestamp);
  const allNull = raw.open == null && raw.high == null && raw.low == null && raw.close == null;
  const onGrid = t.etMinutes % 5 === 0; // EODHD 5m bars are 5-min aligned; off-grid = halt/anomaly print
  const zeroRangeNullVol = !allNull && raw.volume === null &&
    raw.open === raw.high && raw.high === raw.low && raw.low === raw.close;
  // Closing auction = the 16:00-ET (etMin 960) null-volume zero-range print — A2 / S1 §7, ALL
  // THREE conditions incl. the ET minute. S2 findings that make the 16:00 constraint essential
  // (not just the signature): (a) illiquid ETFs (SPHB/SPLV) print mid-session no-trade bars with
  // the same null-volume/zero-range signature — signature-only detection tags several "auctions"
  // per session; (b) off-grid halt prints (13:21, 10:06) also carry it. Requiring etMin 960 +
  // on-grid isolates the true auction. Half-days close at 13:00 ET with no 16:00 print → no
  // auction (handled downstream as earlyClose; the 13:00 close survives as the last regular bar).
  const isAuction = onGrid && t.etMinutes === AUCTION_ET_MIN && zeroRangeNullVol;
  let role;
  if (allNull) role = 'invalid';                             // defensive strip (parent pitfall #10)
  else if (isAuction) role = 'auction';
  else if (onGrid && t.etMinutes >= OPEN_ET_MIN && t.etMinutes <= LAST_REG_OPEN_ET_MIN) role = 'regular'; // incl. illiquid null-volume flat bars (real price, no trade)
  else role = 'other'; // off-grid / out-of-window / non-signature 16:00 — S1 §6 found none in-grid
  // tzAbbrev is intentionally NOT computed here: the DST regime is constant within a
  // session, so normalizeFiveMin computes it once per session (one Intl call vs ~79).
  return { etDate: t.etDate, etMinutes: t.etMinutes, role, closingAuction: isAuction };
}

// ── 5-minute normalization + sessionization ──────────────────────────────────

/**
 * @param {Array} raw5m EODHD /intraday 5m records
 * @param {Map} dailyByDate output of normalizeDaily().byDate (for split factors + cross-grain)
 * @returns {{bars:Array, sessions:Array}}
 */
export function normalizeFiveMin(raw5m, dailyByDate) {
  const bars = [];
  const sessionMap = new Map(); // etDate -> { raw regular bars, auction bar, ... }

  for (const raw of raw5m) {
    const c = classifyBar(raw);
    const daily = dailyByDate.get(c.etDate) || null;
    const f = daily ? daily.adjFactor : null; // A1: per-session factor, constant within a session
    const bar = {
      epoch: raw.timestamp,
      etDate: c.etDate,
      etMinutes: c.etMinutes,
      role: c.role,
      closingAuction: c.closingAuction, // A2: TAG, don't strip
      open: raw.open, high: raw.high, low: raw.low, close: raw.close, volume: raw.volume,
      adjFactor: f,
      // A1: split-adjusted OHLC (raw × f) — places 5m on the daily adjusted basis
      adjOpen: f != null ? raw.open * f : null,
      adjHigh: f != null ? raw.high * f : null,
      adjLow: f != null ? raw.low * f : null,
      adjClose: f != null ? raw.close * f : null,
      // S5.6 §3: 5m is now fetched with a 30-trading-session warmup before studyStart (the RVOL
      // baseline needs 20 trailing sessions of 5m). A bar dated before studyStart is a warmup5m
      // bar: it feeds RVOL/volume BASELINES ONLY. It is never an event session, never an outcome
      // input, and no other feature reads it. (Was hardcoded `warmup: false` — the 5m warmup did
      // not exist, which nulled RVOL on 72.6% of first-20-session events.)
      warmup5m: isoBefore(c.etDate, STUDY_START),
    };
    bars.push(bar);

    if (!sessionMap.has(c.etDate)) {
      sessionMap.set(c.etDate, { etDate: c.etDate, firstEpoch: raw.timestamp, regular: [], auctions: [], otherCount: 0, invalidCount: 0, nullVolRegular: 0 });
    }
    const s = sessionMap.get(c.etDate);
    if (c.role === 'regular') { s.regular.push(bar); if (bar.volume === null) s.nullVolRegular += 1; }
    else if (c.role === 'auction') s.auctions.push(bar);
    else if (c.role === 'invalid') s.invalidCount += 1;
    else s.otherCount += 1;
  }

  const sessions = [];
  for (const s of sessionMap.values()) {
    s.regular.sort((a, b) => a.etMinutes - b.etMinutes);
    s.auctions.sort((a, b) => a.etMinutes - b.etMinutes);
    const daily = dailyByDate.get(s.etDate) || null;
    const f = daily ? daily.adjFactor : null;
    // The closing print is the LATEST auction-signature bar (defensive against a stray
    // mid-session zero-range null-volume bar; on the probe there is at most one, at 16:00).
    const auction = s.auctions.length ? s.auctions[s.auctions.length - 1] : null;
    const auctionEtMinutes = auction ? auction.etMinutes : null;
    const lastRegEt = s.regular.length ? s.regular[s.regular.length - 1].etMinutes : null;
    const auctionClose = auction ? auction.close : null;            // raw auction print = session close (A2)
    const lastRegularClose = s.regular.length ? s.regular[s.regular.length - 1].close : null;
    const sessionClose = auctionClose != null ? auctionClose : lastRegularClose; // A2: prefer auction print
    const isFullDay = s.regular.length === CONFIG.session.barsPerRegularSession; // 78
    const earlyClose = auction ? auctionEtMinutes < AUCTION_ET_MIN
      : (lastRegEt != null && lastRegEt < LAST_REG_OPEN_ET_MIN);   // half-day when no 16:00 close
    sessions.push({
      etDate: s.etDate,
      tzAbbrev: etTzAbbrev(s.firstEpoch), // one Intl call per session (DST regime constant within a session)
      adjFactor: f,
      warmup5m: isoBefore(s.etDate, STUDY_START), // S5.6 §3: RVOL/volume baselines ONLY — never an event session
      isFullDay, earlyClose,
      regularBarCount: s.regular.length,
      otherBarCount: s.otherCount,
      invalidBarCount: s.invalidCount,
      nullVolRegularBarCount: s.nullVolRegular,
      auctionBarCount: s.auctions.length,
      hasAuction: !!auction,
      auctionEtMinutes,                                             // 960 on full days; earlyClose minute otherwise
      auctionAfterLastRegular: auction ? (lastRegEt == null || auctionEtMinutes >= lastRegEt) : null,
      auctionClose,
      auctionCloseAdj: (auctionClose != null && f != null) ? auctionClose * f : null,
      lastRegularClose,
      sessionClose,                                                  // A2: EOD outcome-label price
      sessionCloseAdj: (sessionClose != null && f != null) ? sessionClose * f : null,
      hourly: buildHourly(s.regular),                                // §4.4: auction excluded (only s.regular passed)
    });
  }
  sessions.sort((a, b) => (a.etDate < b.etDate ? -1 : 1));
  return { bars, sessions };
}

// ── Self-built 9:30-anchored ET hourly bars (parent §4.4, §3.6; A2) ──────────

/**
 * Aggregate regular 5-min bars into 9:30-anchored hourly buckets. The closing-auction
 * bar is NOT passed in (A2: excluded from hourly aggregation). Bucket boundaries are
 * ET minutes from config: [570,630,690,750,810,870,930,960] → 6 full hours + 15:30–16:00.
 * @param {Array} regularBars sorted-by-etMinutes regular 5m bars for one session
 */
export function buildHourly(regularBars) {
  const out = [];
  for (let i = 0; i < BUCKETS.length - 1; i++) {
    const startMin = BUCKETS[i];
    const endMin = BUCKETS[i + 1];
    const inBucket = regularBars.filter((b) => b.etMinutes >= startMin && b.etMinutes < endMin);
    if (inBucket.length === 0) continue; // session may be short (half-day); skip empty buckets
    let high = -Infinity, low = Infinity, vol = 0;
    for (const b of inBucket) {
      // Explicit null guards: JS coerces null→0 in `<`/`>`, so one partial-null bar
      // (b.low === null) would set low=null and then never recover it. (Review F3.)
      if (b.high != null && b.high > high) high = b.high;
      if (b.low != null && b.low < low) low = b.low;
      vol += (b.volume || 0);
    }
    out.push({
      bucketIndex: i,
      openEtMinutes: startMin,   // 570 for the first bucket (09:30 ET)
      closeEtMinutes: endMin,    // 960 for the last bucket (16:00 ET)
      barCount: inBucket.length,
      open: inBucket[0].open,
      high: high === -Infinity ? null : high,  // null-never-zero if every bar's high was null
      low: low === Infinity ? null : low,
      close: inBucket[inBucket.length - 1].close,
      volume: vol,
    });
  }
  return out;
}

// ── Cross-grain invariant (A1 / parent §4.3; S1 §5) ──────────────────────────

/**
 * Compare each session's raw closing-auction print to the raw daily close (same session).
 * @returns {Array<{date,auctionClose,dailyClose,diffPct,pass}>}
 */
export function crossGrainCheck(sessions, dailyByDate, tolerancePct = CONFIG.adjustment.crossGrainInvariant.tolerancePct) {
  const rows = [];
  for (const s of sessions) {
    if (s.auctionClose == null) continue;
    const daily = dailyByDate.get(s.etDate);
    if (!daily || daily.close == null || daily.close === 0) continue; // skip zero denom like null (Review F4)
    const diffPct = Math.abs(s.auctionClose - daily.close) / daily.close * 100;
    rows.push({ date: s.etDate, auctionClose: s.auctionClose, dailyClose: daily.close, diffPct, pass: diffPct <= tolerancePct });
  }
  return rows;
}

/**
 * Adjustment check (A1 / test #6): adjusted auction print vs daily adjusted_close.
 * @returns {Array<{date,auctionCloseAdj,dailyAdjClose,diffPct,pass}>}
 */
export function adjustmentCheck(sessions, dailyByDate, tolerancePct = CONFIG.adjustment.crossGrainInvariant.tolerancePct) {
  const rows = [];
  for (const s of sessions) {
    if (s.auctionCloseAdj == null) continue;
    const daily = dailyByDate.get(s.etDate);
    if (!daily || daily.adjustedClose == null || daily.adjustedClose === 0) continue; // skip zero denom like null (Review F4)
    const diffPct = Math.abs(s.auctionCloseAdj - daily.adjustedClose) / daily.adjustedClose * 100;
    rows.push({ date: s.etDate, auctionCloseAdj: s.auctionCloseAdj, dailyAdjClose: daily.adjustedClose, diffPct, pass: diffPct <= tolerancePct });
  }
  return rows;
}
