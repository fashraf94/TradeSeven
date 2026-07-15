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
const STEP = CONFIG.session.fiveMinuteStepMinutes;                 // 5
const REGULAR_CLOSE_ET_MIN = CONFIG.session.regularCloseEtMinutes;  // 960 (16:00 ET)
const MIN_BAR_COVERAGE_PCT = CONFIG.hourlyClass.minBarCoveragePct; // 80 (S56-A4)
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

/**
 * S56-A4/A5 — the session's close, in ET minutes, for the EXPECTED-BAR count.
 *
 * THE TRAP THIS AVOIDS: deriving the close from the last DELIVERED bar makes the coverage measure
 * SELF-CERTIFYING. A thin name whose 5m feed simply stops at 11:00 would be read as "the session
 * ended at 11:00", expect 18 bars, receive 18, and report **100% complete** — so the very symbols
 * S56-A5 exists to detect would be the ones it certifies as clean, and A4 would pass their events.
 *
 * So the close is taken from a source INDEPENDENT of this symbol's regular bars:
 *
 *   1. the MARKET SESSION CALENDAR (buildSessionCalendar, below). A session's end is a MARKET fact,
 *      not a per-symbol one, so the strongest source is the consensus of many liquid instruments.
 *   2. otherwise the symbol's own AUCTION PRINT, which is emitted independently of the regular bars.
 *   3. otherwise the FULL-DAY close (16:00) — deliberately conservative: a session whose bars stop
 *      early reads as INCOMPLETE (events dropped) rather than as complete.
 *
 * MEASURED, and the reason the calendar exists: EODHD emits NO closing-auction print on half-days.
 * On all 7 half-days in the study window, 229/229 symbols have `hasAuction === false`. An earlier
 * version of this function assumed "the auction prints at the early close (13:00)" and fell back to
 * 16:00 when it was absent — so every half-day was measured against a 78-bar expectation, read as a
 * ~53%-covered data gap, and dropped. That dragged EVERY symbol's completeness down by a uniform
 * ~0.93 points (7 of 754 sessions) and was why not one of the 229 names cleared a 99% floor. The
 * bias was invisible precisely because it was uniform.
 *
 * A trading HALT is the case this must NOT swallow: a halted symbol's bars stop early while the
 * market runs to 16:00. The calendar says 16:00, the symbol's feed says otherwise, and the session
 * is correctly flagged incomplete. That is the desired behaviour — a halted symbol's hourly bars are
 * exactly the ones S56-A4 must refuse to build a class from.
 */
function sessionEndOf(auctionEtMinutes, etDate, calendar) {
  const fromCalendar = calendar ? calendar.get(etDate) : null;
  if (fromCalendar != null) return fromCalendar;
  if (auctionEtMinutes != null) return auctionEtMinutes;
  return REGULAR_CLOSE_ET_MIN;
}

/**
 * The MARKET SESSION CALENDAR — etDate → the session's true end in ET minutes.
 *
 * Built from the consensus of reference instruments (SPY + the 11 SPDR sector ETFs). They print in
 * essentially every 5-minute window, so their last regular bar IS the session's last regular bar;
 * and no single truncated or halted feed can move the MODE of twelve. That is what makes this
 * non-self-certifying, which a per-symbol derivation can never be (S3-R3 says the session end is
 * derived per session FROM THE DATA — this honours that while denying any one symbol the ability to
 * certify its own completeness).
 *
 * THE RULE, and why it is not simply "the last bar". A CLOSING PRINT carries a price but NO volume
 * (`close != null, volume == null`); a regular bar carries volume. So, per reference symbol, take the
 * last bar of the session that has a price, and:
 *
 *   - it has NO volume  ⇒ it IS the closing print, and the session ends AT it.
 *       full day  16:00 print        → 960
 *       half-day  13:00 print        → 780   (EODHD emits this; it is NOT at 16:00 — see below)
 *   - it HAS volume     ⇒ it is an ordinary bar and the session ran one step past it.
 *       full day, print absent, last traded bar opens 15:55 → 955 + 5 = 960
 *
 * That second branch is load-bearing: for eleven consecutive sessions (2025-10-13 → 2025-10-27) the
 * vendor emitted NO closing print at all, for every symbol. A rule keyed on the print alone would
 * have mis-dated the close of all eleven. MEASURED: this rule gives 12/12 reference agreement on
 * every date in the window, half-days and the October gap included.
 *
 * @param {Array<{symbol:string, bars:Array}>} refs `bars` as returned by normalizeFiveMin()
 * @param {number} quorum minimum refs that must agree before a date is trusted
 * @returns {Map<string, number>} etDate → session close in ET minutes
 */
export function buildSessionCalendar(refs, quorum = 3) {
  const lastBarByDate = new Map(); // etDate → [session close, one per ref]
  for (const { bars } of refs) {
    const lastPerDate = new Map();
    for (const b of bars) {
      // Only bars inside the regular window that actually PRINTED a price. An empty placeholder bar
      // (close == null) says nothing about when the session ended.
      if (b.close == null) continue;
      if (b.etMinutes < OPEN_ET_MIN || b.etMinutes > REGULAR_CLOSE_ET_MIN) continue;
      const cur = lastPerDate.get(b.etDate);
      if (cur == null || b.etMinutes > cur.etMinutes) lastPerDate.set(b.etDate, b);
    }
    for (const [etDate, b] of lastPerDate) {
      const close = b.volume == null ? b.etMinutes : b.etMinutes + STEP;
      if (!lastBarByDate.has(etDate)) lastBarByDate.set(etDate, []);
      lastBarByDate.get(etDate).push(close);
    }
  }
  const calendar = new Map();
  for (const [etDate, opens] of lastBarByDate) {
    const counts = new Map();
    for (const o of opens) counts.set(o, (counts.get(o) || 0) + 1);
    const [mode, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    // Below quorum the references disagree (or too few reported) — trust nothing, fall back.
    if (n < quorum) continue;
    calendar.set(etDate, mode);
  }
  return calendar;
}

// ── 5-minute normalization + sessionization ──────────────────────────────────

/**
 * @param {Array} raw5m EODHD /intraday 5m records
 * @param {Map} dailyByDate output of normalizeDaily().byDate (for split factors + cross-grain)
 * @returns {{bars:Array, sessions:Array}}
 */
export function normalizeFiveMin(raw5m, dailyByDate, sessionCalendar) {
  // The calendar is REQUIRED, not defaulted. It was optional-with-a-null-default for exactly one
  // build, and in that build 03-detect-events.js — which re-normalizes from raw to recover per-bar
  // arrays — simply forgot to pass it. It silently fell back to a 16:00 close, rebuilt every hourly
  // bucket against a full-day expectation, and stamped pre-fix coverage onto every event. The
  // sessions on disk were correct and the events were wrong, and nothing anywhere failed.
  //
  // A silent default is what made that undetectable. Passing `null` is now a DELIBERATE act, made
  // only by the pass that is building the calendar itself (and by fixtures that predate it).
  if (sessionCalendar === undefined) {
    throw new Error(
      'MISSING_SESSION_CALENDAR: normalizeFiveMin requires an explicit sessionCalendar (S56-C3). ' +
      'Pass the calendar from data/normalized/_session_calendar.json, or pass null to deliberately ' +
      'opt out (only the calendar-building pass and fixture tests may do that).',
    );
  }
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

    // classifyBar() recognizes the closing auction by a HARDCODED 16:00, which is wrong on a
    // half-day: EODHD prints the half-day auction at the 13:00 close, so classifyBar tags it
    // 'regular'. That is why hasAuction was false on all 7 half-days for 229/229 symbols. With the
    // market calendar in hand the close is known per session, so the print is identified by WHERE
    // THE SESSION ACTUALLY ENDED rather than by a constant — which is what S3-R3 asked for.
    const sessionClose = sessionCalendar ? sessionCalendar.get(c.etDate) : null;

    // On a SHORT session, every bar at or after the close is OUT OF SESSION. Two vendor artifacts
    // make this necessary, and one measured fact makes it the *limit* of what may be inferred:
    //
    //   - the 13:00 bar. It carries a price and no volume, so it looks exactly like the 16:00
    //     closing print. It is NOT a regular 5-minute bar and must not be aggregated into an hourly
    //     bucket (§4.4 excludes the closing print) nor counted toward the 42 bars the session owed.
    //   - a spurious 16:00 bar, emitted on some half-days for some symbols (NVDA 2024-07-03 had
    //     one). classifyBar, keyed on a hardcoded 16:00, tagged it the closing auction — a print
    //     three hours after the market shut, and a second auction bar in the same session.
    //
    // But the 13:00 bar is NOT promoted to `auction`, and that restraint is load-bearing. MEASURED:
    // on 3 of the 7 half-days it disagrees with the daily close by 0.107–0.118% — just OVER A1's
    // 0.1% tolerance. It is the last 5-minute print, not the official closing auction. Tagging it
    // `auction` would newly subject half-days to a cross-grain invariant they have never been
    // subject to (`hasAuction` was false there, so crossGrainCheck skipped them), and 3 of 7 would
    // fail — an A1 breach manufactured by this change. A1 is never loosened and sessions are not
    // quarantined to accommodate an inference the data does not support. So: `hasAuction` stays
    // false on half-days, exactly as before, and the discrepancy is REPORTED, not absorbed.
    //
    // The calendar is used for precisely what it is evidence of — WHEN THE SESSION ENDED — and for
    // nothing more.
    const isShortSession = sessionClose != null && sessionClose < REGULAR_CLOSE_ET_MIN;
    const isPostClose = isShortSession && bar.etMinutes >= sessionClose;

    const role = isPostClose ? 'other' : c.role;
    if (isPostClose) bar.role = 'other';

    if (role === 'regular') { s.regular.push(bar); if (bar.volume === null) s.nullVolRegular += 1; }
    else if (role === 'auction') s.auctions.push(bar);
    else if (role === 'invalid') s.invalidCount += 1;
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

    // The session's true end (S3-R3: derived per session from the data, never a hardcoded 16:00) —
    // but from the MARKET, not from this symbol's own bars. See sessionEndOf() for why that
    // distinction is load-bearing.
    const sessionEnd = sessionEndOf(auctionEtMinutes, s.etDate, sessionCalendar);

    // A half-day is now a fact about the SESSION, not an inference from this symbol's last bar. The
    // old fallback (`lastRegEt < LAST_REG_OPEN_ET_MIN`) tagged any truncated feed as an early close,
    // which is the same self-certification bug in a different coat: a symbol that halted at 14:00
    // would have declared itself a half-day and its missing bars legitimate.
    const earlyClose = sessionEnd < REGULAR_CLOSE_ET_MIN;
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
      // S56-A4/A5: the session's close drives the expected-bar count. See sessionEndOf().
      sessionEndEtMinutes: sessionEnd,
      // S56-A5: whole-session 5m coverage — the input to the completeness-eligibility floor.
      // Expected regular bars = slots from the open to the session's close (78 on a full day).
      expectedRegularBarCount: Math.max(0, Math.floor((sessionEnd - OPEN_ET_MIN) / STEP)),
      hourly: buildHourly(s.regular, sessionEnd), // §4.4: auction excluded (only s.regular passed)
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
 *
 * S56-A4: each bucket carries its own COVERAGE — how many 5m bars it actually got against how many
 * it should have got. `complete` is the pre-registered usability flag (≥ minBarCoveragePct).
 * Session 6 reads it to null the hourly class rather than compute a confirmation label from a
 * partial bar.
 *
 * @param {Array} regularBars sorted-by-etMinutes regular 5m bars for one session
 * @param {number|null} sessionEndEtMinutes the session's ACTUAL close (half-days close early; S3-R3
 *   requires this be derived per session, never assumed 16:00). Defaults to the last bar's slot end.
 */
export function buildHourly(regularBars, sessionEndEtMinutes = null) {
  // The expected-bar count must be measured against the session that ACTUALLY happened. On a
  // half-day (13:00 ET close) the afternoon buckets legitimately do not exist and the 12:30–13:30
  // bucket legitimately holds 6 bars, not 12 — calling either "incomplete" would flag every half-day
  // in the study as a data gap. Derive the close; never hardcode 960. (S3-R3.)
  const lastBar = regularBars.length ? regularBars[regularBars.length - 1] : null;
  const sessionEnd = sessionEndEtMinutes != null
    ? sessionEndEtMinutes
    : (lastBar ? lastBar.etMinutes + STEP : null);

  const out = [];
  for (let i = 0; i < BUCKETS.length - 1; i++) {
    const startMin = BUCKETS[i];
    const endMin = BUCKETS[i + 1];
    const inBucket = regularBars.filter((b) => b.etMinutes >= startMin && b.etMinutes < endMin);

    // A bucket is EXPECTED when the session was still open at its start. Distinguish the two very
    // different reasons a bucket can be empty:
    //   - the session had already CLOSED (half-day) → the bucket does not exist. Omit it.
    //   - the session was OPEN but the vendor delivered NO bars → a 0%-covered bucket. EMIT IT,
    //     flagged incomplete.
    // Omitting the second case was a real bug: hourlyCoverageOf resolves the window's next bar by
    // bucketIndex, so an omitted bucket read as "there is no next bar" and the event PASSED the
    // coverage gate. The guard fired on a 79%-covered next bar but not on a 0%-covered one — it let
    // through precisely the worst case it exists to catch.
    const expectedBucket = sessionEnd == null || startMin < sessionEnd;
    if (inBucket.length === 0 && !expectedBucket) continue; // session had closed — bucket doesn't exist
    if (inBucket.length === 0) {
      const effEnd = sessionEnd != null ? Math.min(endMin, sessionEnd) : endMin;
      out.push({
        bucketIndex: i, openEtMinutes: startMin, closeEtMinutes: endMin,
        barCount: 0,
        expectedBarCount: Math.max(0, Math.floor((effEnd - startMin) / STEP)),
        missingBarCount: Math.max(0, Math.floor((effEnd - startMin) / STEP)),
        coveragePct: 0,
        complete: false, // 0% covered — the strongest possible coverage failure
        open: null, high: null, low: null, close: null, volume: 0,
      });
      continue;
    }
    let high = -Infinity, low = Infinity, vol = 0;
    for (const b of inBucket) {
      // Explicit null guards: JS coerces null→0 in `<`/`>`, so one partial-null bar
      // (b.low === null) would set low=null and then never recover it. (Review F3.)
      if (b.high != null && b.high > high) high = b.high;
      if (b.low != null && b.low < low) low = b.low;
      vol += (b.volume || 0);
    }
    // Expected 5m slots in this bucket, clipped to the session's real close.
    const effectiveEnd = sessionEnd != null ? Math.min(endMin, sessionEnd) : endMin;
    const expected = Math.max(0, Math.floor((effectiveEnd - startMin) / STEP));
    const coveragePct = expected > 0 ? (inBucket.length / expected) * 100 : null;
    out.push({
      bucketIndex: i,
      openEtMinutes: startMin,   // 570 for the first bucket (09:30 ET)
      closeEtMinutes: endMin,    // 960 for the last bucket (16:00 ET)
      barCount: inBucket.length,
      expectedBarCount: expected,                        // S56-A4 (per-session; half-day clipped)
      missingBarCount: Math.max(0, expected - inBucket.length),
      coveragePct: coveragePct != null ? Math.round(coveragePct * 10) / 10 : null,
      // S56-A4: the pre-registered usability flag. Session 6 nulls hourly_class when this is false.
      complete: coveragePct != null ? coveragePct >= MIN_BAR_COVERAGE_PCT : false,
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
