// research/level-study/lib/labels.js
//
// LevelStory Session 6 — THE LABELER (parent §7 hourly classes, §3 timestamps, §9 dual-origin
// outcome grid + bridge columns). Turns each independent touch event into:
//   - the hourly confirmation class (SHARP_REJECT / DRIFT_HOLD / BREAK_HOLD / BREAK_RECLAIM / CHOP
//     / null), computed from the geometry of the self-constructed 9:30-anchored confirmation window
//     (touch hourly bar + next hourly bar);
//   - the three timestamps (touchAt already set upstream; confirmationAt = window close; entryAt =
//     open of the first tradable 5-min bar strictly after confirmationAt, rolling overnight past
//     15:55 ET);
//   - the outcome grid computed TWICE — once from touchAt (touch-time study), once from entryAt
//     (confirmation-time study) — sign-normalized toward the hold side, in daily-ATR units;
//   - the bridge columns (moveBeforeConfirmation / moveRemainingAfterConfirmation /
//     fractionElapsedAtEntry) that quantify anticipate-vs-chase.
//
// ── THE TWO HAZARDS THIS MODULE EXISTS AROUND (S6 prompt §2) ──────────────────
//  1. THE CONFIRMATION LEAK (the parent spec's founding lesson, pitfall #2). This is the first
//     session where confirmationAt / entryAt exist, so it is the first place the leak can re-enter.
//     The confirmation-time grid must NEVER read a bar before entryAt — otherwise a SHARP_REJECT
//     would be credited with the very move that CREATED the SHARP_REJECT label. Enforced BY
//     CONSTRUCTION: computeGrid() walks bars from its origin forward and cannot see anything earlier.
//     Proven by tests/33 §6.1–6.2.
//  2. SILENT CORRECTNESS LOSS (cache poisoning S2; the calendar-null L-S56-2). This module computes
//     numbers nothing downstream can sanity-check by eye. So every required input is ASSERTED, never
//     silently defaulted: a missing ATR, origin timestamp, session, or session-close throws. A
//     labeler that produced numbers from a defaulted input would be indistinguishable from a correct
//     one. (tests/33 §6.11.)
//
// ── THE MODELLING DECISIONS (S6 CHOICEs; each is spec-cited, each is greppable "S6-C") ────────────
//  S6-C1 THE LEVEL = the family anchor = (zoneLow + zoneHigh) / 2. The episode zone is symmetric
//        about the anchor (events.js episodeZone: anchor ± zoneHalfWidthU·u), so the midpoint
//        recovers the anchor exactly. Every "beyond the level" measurement (P, C, W, held,
//        resolution) is versus this single price. (parent §7 "penetration depth beyond level"; §9.1
//        "beyond the level by >0.25 ATR".)
//  S6-C2 SIGN NORMALIZATION: dir = +1 for support (hold side = up), −1 for resistance (hold side =
//        down). Every signed quantity is dir·(price − reference): positive means toward the hold
//        side. A resistance event and a support event with mirror-image price paths therefore
//        produce IDENTICAL grids (parent §9.1; tests/33 §6.9).
//  S6-C3 MFE/MAE, target-before-stop, time_to, clean_bounce, drawdown, close_position_in_range are
//        measured relative to the ORIGIN PRICE (the study's entry): touch-bar open for the touch-time
//        study, entry-bar open for the confirmation-time study. This is what "MFE from entryAt"
//        (parent §9.2) means, and it is what makes the bridge columns a P&L-from-entry measure.
//  S6-C4 held_{horizon} and resolution are measured relative to the LEVEL (anchor), on 5-min CLOSES
//        (a wick through the level does not break a hold — parent §9.1; tests/33 §6.8). Excursions
//        (MFE/MAE/targets/stops) are on 5-min HIGHS/LOWS (parent §9.1).
//  S6-C5 ORIGIN PRICE = the origin bar's OPEN. entryAt is defined as the open of a 5-min bar (parent
//        §3.3); the touch-time origin uses the same convention for symmetry, so the two studies
//        differ only in WHERE they start, never in HOW price is referenced.
//  S6-C6 confirmationAt = the NOMINAL hourly-bar boundary that closes the window (e.g. 11:30 ET), not
//        the last delivered 5-min bar's close. The window is the hourly BAR (parent §3.2/§7); its
//        close is its boundary. The boundary timestamp is derived DST-safely from a real bar's epoch
//        (epoch is linear in ET minutes within a session), never a hand-rolled offset (session-time
//        philosophy).
//  S6-C7 time_to_{X}_ATR minutes = trading-bar-minutes = (number of 5-min bars from the origin bar
//        through the bar that first reaches X, inclusive) × 5. The overnight gap is counted as
//        bar-steps, not wall-clock (there is no continuous clock across a session boundary). null if
//        X is not reached by next EOD (parent §9.1).
//  S6-C8 close_position_in_range is sign-normalized TOWARD THE HOLD SIDE (support: (close−low)/
//        (high−low); resistance: (high−close)/(high−low)). Parent §9.1 calls it a 0–1 position; the
//        grid is stated sign-normalized "positive toward hold side" (§9.1), so the hold-side fraction
//        is the coherent reading and it keeps the whole grid mirror-symmetric (S6-C2).
//  S6-C9 "close on hold side" for the rejection wick W = the hourly bar's close at or on the hold
//        side of the level (dir·(close − anchor) ≥ 0). Boundary case only; SHARP_REJECT additionally
//        requires C ≥ 0.25, comfortably clear of it.
//  S6-C10 the "nextOpen" MFE/MAE horizon is measured THROUGH the next session's opening 5-min bar
//        (its high/low), uniform with every other horizon (each horizon is a bar window; excursions
//        on highs/lows — parent §9.1). The pure open-price gap is reported separately as
//        `overnightGap`, so both the through-the-open excursion and the mark-at-the-open gap are
//        available to Session 7.
//  S6-C11 required vs degradable close inputs. The ORIGIN session's close is REQUIRED (its session
//        traded) — computeGrid throws if it is not numeric (byte-identical guard / L-S56-2). The NEXT
//        session's close/open are degradable: resolution needs a next EOD (else null), overnightGap
//        needs a next open (else null). close_position needs a non-degenerate range (else null) and is
//        clamped to the spec's stated [0,1].
//
// Pure module: zero product imports; imports ../config.js only. Every exported function is a pure
// function of its inputs so tests fabricate sessions/events directly (mirrors lib/events.js).

import CONFIG from '../config.js';

const BOUNDARIES = CONFIG.hourly.bucketBoundariesEtMinutes;     // [570,630,690,750,810,870,930,960]
const LAST_BUCKET = CONFIG.hourly.bucketCount - 1;              // 6
const CLASSES = CONFIG.hourlyClass.classes;                    // knob table (parent §7)
const CLASS_ORDER = CONFIG.hourlyClass.evaluationOrder;        // SHARP_REJECT → … → CHOP
const RVOL_DAYS = CONFIG.hourlyClass.rvolOverlay.baselineDays; // 20
const HORIZONS = CONFIG.outcomes.horizons;                     // ['15m','30m','60m','120m','EOD','nextOpen','nextEOD']
const HELD_ATR = CONFIG.outcomes.heldBeyondAtr;               // 0.25
const TIME_TO = CONFIG.outcomes.timeToFavorableAtr;          // [0.25,0.50,0.75,1.00]
const TARGETS = CONFIG.outcomes.targetBeforeStop.targetsAtr;  // [0.50,0.75,1.00,1.50]
const STOPS = CONFIG.outcomes.targetBeforeStop.stopsAtr;      // [0.25,0.50,0.75]
const DRAWDOWN_TARGET = CONFIG.outcomes.drawdownBeforeTargetAtr; // 0.75
const CLEAN = CONFIG.outcomes.ambiguity.cleanBounce;          // {mfeMinAtr:0.75, beforeMaeAtr:0.50}
const FRACTION_NULL_BELOW = CONFIG.outcomes.bridge.fractionElapsedNullBelowAtr; // 0.25
const OVERNIGHT_CUTOFF = CONFIG.outcomes.entryAt.overnightCutoffEtMinutes;      // 955
const STEP = CONFIG.session.fiveMinuteStepMinutes;            // 5
const INTRADAY_HORIZON_MIN = { '15m': 15, '30m': 30, '60m': 60, '120m': 120 };

// ── Primitive geometry ────────────────────────────────────────────────────────

/** S6-C1: the level = the family anchor = the (symmetric) episode-zone midpoint. */
export function anchorOf(event) {
  if (event == null || typeof event.zoneLow !== 'number' || typeof event.zoneHigh !== 'number') {
    throw new Error('labels: event.zoneLow/zoneHigh required to recover the level anchor (S6-C1)');
  }
  return (event.zoneLow + event.zoneHigh) / 2;
}

/** S6-C2: +1 for support (hold = up), −1 for resistance (hold = down). */
export function holdDir(side) {
  if (side === 'support') return 1;
  if (side === 'resistance') return -1;
  throw new Error(`labels: unknown side "${side}" — cannot sign-normalize (S6-C2)`);
}

// ── The confirmation window (parent §3.6/§7) ──────────────────────────────────

/** The 0-based hourly bucket that contains an ET minute; null if out of the 09:30–16:00 grid. */
export function bucketOf(etMinutes) {
  for (let i = 0; i < BOUNDARIES.length - 1; i++) {
    if (etMinutes >= BOUNDARIES[i] && etMinutes < BOUNDARIES[i + 1]) return i;
  }
  return null;
}

/**
 * Build the confirmation window for a touch: the touch-containing hourly bar + the next hourly bar
 * (parent §3.2/§7), from the session's ADJUSTED 5-min regular bars. The window's price geometry lives
 * on the adjusted basis (matching the anchor and ATR), so it is built from adjHigh/adjLow/adjClose —
 * NOT from normalize.js's hourly buckets, which carry raw OHLC for a different purpose.
 *
 * The window is bounded by the session's real close: if the next bucket does not exist (touch in the
 * final bucket, or a half-day that has already closed), the window is the touch bucket alone.
 *
 * @returns {{ touchBucketIndex, windowCloseEtMinutes, windowBars, windowClose, anchorBar }}
 *   windowBars: adjusted regular bars in the window (ascending); windowClose: adjClose of the last
 *   window bar; anchorBar: a real bar used as the DST-safe epoch anchor for confirmationAt (S6-C6).
 */
export function confirmationWindow({ session, touchEtMinutes }) {
  if (!session || !Array.isArray(session.regular) || !session.regular.length) {
    throw new Error('labels: confirmationWindow requires the touch session with regular bars (byte-identical guard)');
  }
  const touchBucketIndex = bucketOf(touchEtMinutes);
  if (touchBucketIndex == null) {
    throw new Error(`labels: touchEtMinutes ${touchEtMinutes} is outside the 09:30–16:00 hourly grid`);
  }
  // The window's nominal close boundary: end of the NEXT bucket if it exists, else end of the touch
  // bucket. "Exists" = the session had a regular bar in the next bucket's span (a half-day that closed
  // has none). This mirrors hourlyCoverageOf's window resolution in events.js.
  const nextBucketIndex = touchBucketIndex < LAST_BUCKET ? touchBucketIndex + 1 : null;
  const nextBucketStart = nextBucketIndex != null ? BOUNDARIES[nextBucketIndex] : null;
  const nextBucketEnd = nextBucketIndex != null ? BOUNDARIES[nextBucketIndex + 1] : null;
  const hasNext = nextBucketIndex != null
    && session.regular.some((b) => b.etMinutes >= nextBucketStart && b.etMinutes < nextBucketEnd);

  const windowCloseEtMinutes = hasNext ? nextBucketEnd : BOUNDARIES[touchBucketIndex + 1];
  const windowStart = BOUNDARIES[touchBucketIndex];
  const windowBars = session.regular
    .filter((b) => b.etMinutes >= windowStart && b.etMinutes < windowCloseEtMinutes)
    .sort((a, b) => a.etMinutes - b.etMinutes);
  if (!windowBars.length) {
    throw new Error('labels: confirmation window has no regular bars (byte-identical guard — an eligible event cannot reach here empty)');
  }
  return {
    touchBucketIndex,
    windowCloseEtMinutes,
    windowBars,
    windowClose: windowBars[windowBars.length - 1].adjClose,
    anchorBar: windowBars[windowBars.length - 1],
  };
}

/**
 * The P/C/W triple over the confirmation window, sign-normalized, in daily-ATR units (parent §7).
 *   P — max penetration of the break-side extreme beyond the level over the window (wick-based: the
 *       deepest the price PIERCED beyond the level, whether or not it closed there). support: low;
 *       resistance: high. Floored at 0.
 *   C — window-close position: dir·(windowClose − anchor)/ATR (positive toward hold side).
 *   W — max rejection wick: over window bars that CLOSED on the hold side (S6-C9), the penetration of
 *       that bar's break-side extreme beyond the level, in ATR. 0 if no bar closed on the hold side.
 * P uses the extreme so BREAK_RECLAIM ("pierced deep, reclaimed") can have P>0.35 while C≥+0.10; W is
 * that same wick restricted to hold-side closes, so SHARP_REJECT ("defended violently") pairs a deep
 * rejected wick (W≥0.30) with a shallow-close hold and C≥+0.25.
 */
export function classMetrics({ windowBars, windowClose, anchor, atr, side }) {
  if (!(atr > 0)) throw new Error('labels: classMetrics requires atr > 0 (byte-identical guard)');
  const dir = holdDir(side);
  // Break-side extreme per bar: how far it pierced beyond the level toward the break side (≥0).
  const penetration = (bar) => {
    const breakExtreme = side === 'support' ? bar.adjLow : bar.adjHigh;
    const depth = dir * (anchor - breakExtreme); // support: anchor − low ; resistance: high − anchor
    return Math.max(0, depth) / atr;
  };
  let P = 0, W = 0;
  for (const bar of windowBars) {
    const pen = penetration(bar);
    if (pen > P) P = pen;
    const closeSigned = dir * (bar.adjClose - anchor); // ≥0 ⇒ bar closed on the hold side (S6-C9)
    if (closeSigned >= 0 && pen > W) W = pen;
  }
  const C = (dir * (windowClose - anchor)) / atr;
  return { P, C, W };
}

/** Assign the hourly class from P/C/W by the pre-registered evaluation order (parent §7; config). */
export function classifyHourly({ P, C, W }) {
  for (const name of CLASS_ORDER) {
    const k = CLASSES[name];
    if (k === 'else') return name; // CHOP is the residual
    if (name === 'SHARP_REJECT' && P <= k.penetrationMax && C >= k.closeMin && W >= k.wickMin) return name;
    if (name === 'DRIFT_HOLD' && P <= k.penetrationMax && C >= k.closeMin && C < k.closeMaxExclusive) return name;
    if (name === 'BREAK_HOLD' && P > k.penetrationMinExclusive && C <= k.closeMax) return name;
    if (name === 'BREAK_RECLAIM' && P > k.penetrationMinExclusive && C >= k.closeMin) return name;
  }
  return 'CHOP';
}

// ── The three timestamps (parent §3) ──────────────────────────────────────────

/**
 * confirmationAt from a confirmation window (S6-C6): the nominal boundary that closes the window,
 * stamped DST-safely off a real bar's epoch (epoch is linear in ET minutes within one session).
 */
export function confirmationAtOf(window) {
  const { anchorBar, windowCloseEtMinutes } = window;
  const epoch = anchorBar.epoch + (windowCloseEtMinutes - anchorBar.etMinutes) * 60;
  return new Date(epoch * 1000).toISOString();
}

/**
 * entryAt (parent §3.3): open of the first tradable 5-min bar strictly after confirmationAt.
 *   - If confirmationAt ≥ 15:55 ET (window closes at/after the cutoff), OR the session has no regular
 *     bar at/after the window close (a data gap at the tail), entry rolls to the NEXT session's
 *     opening bar and overnightEntry = true.
 *   - Otherwise entry is the same-session regular bar opening at (or, robustly, at/after) the window
 *     close boundary — the first bar the window does not already contain.
 *
 * @returns {{ overnightEntry, entrySessionIdx, entryEtMinutes, entryBar, entryAt, entryPrice }}
 */
export function entryPointOf({ orderedSessions, originIdx, windowCloseEtMinutes }) {
  const session = orderedSessions[originIdx];
  const sameSessionEntry = windowCloseEtMinutes < OVERNIGHT_CUTOFF
    ? session.regular.find((b) => b.etMinutes >= windowCloseEtMinutes) || null
    : null;
  if (sameSessionEntry) {
    return {
      overnightEntry: false,
      entrySessionIdx: originIdx,
      entryEtMinutes: sameSessionEntry.etMinutes,
      entryBar: sameSessionEntry,
      entryAt: new Date(sameSessionEntry.epoch * 1000).toISOString(),
      entryPrice: sameSessionEntry.adjOpen,
    };
  }
  // Overnight roll to the next session's opening regular bar.
  const nextSession = orderedSessions[originIdx + 1] || null;
  if (!nextSession || !Array.isArray(nextSession.regular) || !nextSession.regular.length) {
    return {
      overnightEntry: true, entrySessionIdx: null, entryEtMinutes: null,
      entryBar: null, entryAt: null, entryPrice: null,
    };
  }
  const open = nextSession.regular[0];
  return {
    overnightEntry: true,
    entrySessionIdx: originIdx + 1,
    entryEtMinutes: open.etMinutes,
    entryBar: open,
    entryAt: new Date(open.epoch * 1000).toISOString(),
    entryPrice: open.adjOpen,
  };
}

// ── The dual-origin outcome grid (parent §9) ──────────────────────────────────

/**
 * Compute the full outcome grid from ONE origin. Walks bars from the origin FORWARD only — it can
 * never read a bar before the origin, which is the structural leak guard (parent pitfall #2): the
 * confirmation-time grid, called with the entry origin, cannot see the touchAt→entryAt window.
 *
 * Excursions (MFE/MAE, targets, stops, time_to, clean_bounce, drawdown) are on 5-min HIGHS/LOWS
 * relative to the ORIGIN PRICE (S6-C3). held_{horizon} and resolution are on 5-min CLOSES relative to
 * the LEVEL (S6-C4). All sign-normalized toward the hold side (S6-C2).
 *
 * @param {object} a orderedSessions, originIdx (the origin's session), originEtMinutes, originPrice,
 *   anchor, atr, side
 */
export function computeGrid({ orderedSessions, originIdx, originEtMinutes, originPrice, anchor, atr, side }) {
  if (!(atr > 0)) throw new Error('labels: computeGrid requires atr > 0 (byte-identical guard)');
  if (typeof originPrice !== 'number') throw new Error('labels: computeGrid requires a numeric originPrice (byte-identical guard)');
  const originSession = orderedSessions[originIdx];
  if (!originSession || !Array.isArray(originSession.regular)) {
    throw new Error('labels: computeGrid requires the origin session with regular bars (byte-identical guard)');
  }
  // The ORIGIN session's close is a REQUIRED input, not a degradable one: the origin session (touch
  // session, or entry session on an overnight roll) by definition hosted a tradable bar, so it has a
  // close. A missing one means the upstream grain is broken (no daily bar ⇒ null adjFactor ⇒ null
  // adjusted prices) — throw rather than silently null closePositionInRange / overnightGap / feed NaN
  // into every excursion. (byte-identical guard / L-S56-2.) The NEXT session's close/open stay
  // null-degradable — a last-session event legitimately has no next EOD.
  if (typeof originSession.sessionCloseAdj !== 'number') {
    throw new Error(`labels: origin session ${originSession.etDate} has no numeric sessionCloseAdj — a required outcome input, never silently nulled (byte-identical guard / L-S56-2)`);
  }
  const nextSession = orderedSessions[originIdx + 1] || null;
  const dir = holdDir(side);

  // Per-bar sign-normalized excursions vs the origin price, in ATR.
  const favExtreme = (b) => (side === 'support' ? b.adjHigh : b.adjLow);   // hold-side extreme
  const advExtreme = (b) => (side === 'support' ? b.adjLow : b.adjHigh);   // break-side extreme
  const favExc = (b) => (dir * (favExtreme(b) - originPrice)) / atr;       // ≥0 when price moved toward hold
  const advExc = (b) => (dir * (advExtreme(b) - originPrice)) / atr;       // ≤0 when price moved toward break
  const breachSigned = (b) => (dir * (b.adjClose - anchor)) / atr;         // close vs LEVEL (held/resolution)

  const originFromBars = originSession.regular
    .filter((b) => b.etMinutes >= originEtMinutes)
    .sort((a, b) => a.etMinutes - b.etMinutes);
  if (!originFromBars.length) {
    throw new Error('labels: no bars at/after the origin — origin timestamp is not in its session (byte-identical guard)');
  }
  const nextBars = nextSession && Array.isArray(nextSession.regular)
    ? [...nextSession.regular].sort((a, b) => a.etMinutes - b.etMinutes) : [];

  // Bar sets per horizon (cumulative). Intraday horizons are clipped to the origin session. Bars are
  // OPEN-labeled (config.session.barLabeling='open'), so the "+Xm" window is the bars whose trading
  // completes by minute X — i.e. those OPENING strictly before origin+X (etMinutes < origin+X): +15m
  // is the 3 bars opening at origin, +5, +10, not the bar opening AT +15 (which trades [+15,+20],
  // after the horizon). This matches the module's own bar-minute model (S6-C7: bar k completes at
  // (k+1)·5m). Using `<=` would measure one 5-min bar too much.
  const intradayBars = (minutes) => originFromBars.filter((b) => b.etMinutes < originEtMinutes + minutes);
  const eodBars = originFromBars;
  const nextFirst = nextBars.length ? [nextBars[0]] : null;

  const maxOrNull = (arr, f) => (arr && arr.length ? Math.max(...arr.map(f)) : null);
  const minOrNull = (arr, f) => (arr && arr.length ? Math.min(...arr.map(f)) : null);

  const mfe = {}, mae = {}, held = {};
  for (const h of HORIZONS) {
    let bars;
    if (INTRADAY_HORIZON_MIN[h] != null) bars = intradayBars(INTRADAY_HORIZON_MIN[h]);
    else if (h === 'EOD') bars = eodBars;
    else if (h === 'nextOpen') bars = nextFirst ? [...eodBars, ...nextFirst] : null;
    else if (h === 'nextEOD') bars = nextBars.length ? [...eodBars, ...nextBars] : null;
    mfe[h] = maxOrNull(bars, favExc);
    mae[h] = minOrNull(bars, advExc);
    // held: no CLOSE beyond the level by more than HELD_ATR on the break side (S6-C4). A wick does
    // not count. null when the horizon has no bars (nextOpen/nextEOD with no next session).
    if (bars == null || !bars.length) held[h] = null;
    else held[h] = minOrNull(bars, breachSigned) >= -HELD_ATR;
  }

  // The full resolution window: origin session from origin, then the next session (through nextEOD).
  const resolutionBars = [...originFromBars, ...nextBars];

  // time_to_{X}_ATR favorable (S6-C7): trading-bar-minutes to the first bar reaching X; null if never.
  const timeTo = {};
  for (const x of TIME_TO) {
    let mins = null;
    for (let i = 0; i < resolutionBars.length; i++) {
      if (favExc(resolutionBars[i]) >= x) { mins = (i + 1) * STEP; break; }
    }
    timeTo[String(x)] = mins;
  }

  // Target-before-stop grid, adverse-first on same-bar collisions (parent §9.3). Each cell records
  // its result and whether the resolving bar was an ambiguous (collision) bar.
  const targetBeforeStop = {};
  let ambiguousBars = 0;
  for (const T of TARGETS) {
    for (const S of STOPS) {
      let result = 'neither', ambiguous = false;
      for (const b of resolutionBars) {
        const hitT = favExc(b) >= T;
        const hitS = advExc(b) <= -S;
        if (hitT && hitS) { result = 'stop'; ambiguous = true; break; } // adverse-first
        if (hitS) { result = 'stop'; break; }
        if (hitT) { result = 'target'; break; }
      }
      if (ambiguous) ambiguousBars += 1;
      targetBeforeStop[`${T.toFixed(2)}/${S.toFixed(2)}`] = { result, ambiguous };
    }
  }

  // clean_bounce: favorable MFE ≥ 0.75 ATR reached before adverse MAE ≥ 0.50 ATR, adverse-first.
  let cleanBounce = false;
  for (const b of resolutionBars) {
    const hitFav = favExc(b) >= CLEAN.mfeMinAtr;
    const hitAdv = advExc(b) <= -CLEAN.beforeMaeAtr;
    if (hitAdv) { cleanBounce = false; break; } // adverse-first: 0.50 adverse reached first (or same bar)
    if (hitFav) { cleanBounce = true; break; }
  }

  // drawdown_before_target: max adverse magnitude (ATR) experienced before the 0.75 ATR target was
  // first reached; null if the target is never reached by next EOD. Adverse-first within a bar (a
  // bar's adverse updates the running drawdown before its favorable can claim the target).
  let drawdownBeforeTarget = null, runMaxAdv = 0;
  for (const b of resolutionBars) {
    runMaxAdv = Math.max(runMaxAdv, -advExc(b));
    if (favExc(b) >= DRAWDOWN_TARGET) { drawdownBeforeTarget = runMaxAdv; break; }
  }

  // close_position_in_range (S6-C8): the origin session's EOD close as a hold-side fraction of the
  // post-origin high-low range, in [0,1]. null when the range is degenerate (high == low) or the
  // close is unknown. S6-C11: the range is built from REGULAR bars (A2 excludes the auction print
  // from range math), but the numerator is the session close, which in production IS the auction
  // print — so on the rare session where the auction settles outside the traded band the raw
  // fraction escapes [0,1]. Clamp to honor the spec's stated 0–1 contract (parent §9.1).
  let closePositionInRange = null;
  {
    const hi = maxOrNull(originFromBars, (b) => b.adjHigh);
    const lo = minOrNull(originFromBars, (b) => b.adjLow);
    const eodClose = originSession.sessionCloseAdj;
    if (hi != null && lo != null && hi > lo && typeof eodClose === 'number') {
      const raw = side === 'support' ? (eodClose - lo) / (hi - lo) : (hi - eodClose) / (hi - lo);
      closePositionInRange = Math.max(0, Math.min(1, raw));
    }
  }

  // overnight_gap: next-open minus the origin session's close, toward hold, in ATR. null if no next.
  let overnightGap = null;
  if (nextFirst && typeof originSession.sessionCloseAdj === 'number') {
    overnightGap = (dir * (nextFirst[0].adjOpen - originSession.sessionCloseAdj)) / atr;
  }

  // resolution AT NEXT EOD (parent §9.1): held / broke / reclaimed_after_break, close+level based.
  // Requires a next session — without a next EOD there is no resolution to state, so it is null (the
  // event sits at the end of the dataset). Never fabricated from the origin session's own close.
  let resolution = null;
  if (nextBars.length && typeof nextSession.sessionCloseAdj === 'number') {
    const everBeyond = resolutionBars.some((b) => breachSigned(b) < -HELD_ATR);
    const finalBreach = (dir * (nextSession.sessionCloseAdj - anchor)) / atr;
    resolution = !everBeyond ? 'held' : finalBreach < -HELD_ATR ? 'broke' : 'reclaimed_after_break';
  }

  return {
    mfe, mae, held, timeTo, targetBeforeStop, ambiguousBars,
    cleanBounce, drawdownBeforeTarget, closePositionInRange, overnightGap, resolution,
  };
}

// ── The bridge columns (parent §9.2) ──────────────────────────────────────────

/**
 * moveBeforeConfirmation / moveRemainingAfterConfirmation / fractionElapsedAtEntry.
 *   before   = dir·(entryPrice − touchPrice)/ATR  (signed touchAt→entryAt move toward hold)
 *   remaining = the confirmation-time grid's MFE at EOD (MFE from entryAt through EOD)
 *   fraction = before / (before + remaining), null when the denominator < 0.25 ATR (null-never-zero)
 */
export function bridgeColumns({ touchPrice, entryPrice, confirmationMfeEod, atr, side }) {
  const dir = holdDir(side);
  const before = (entryPrice == null || touchPrice == null) ? null : (dir * (entryPrice - touchPrice)) / atr;
  const remaining = confirmationMfeEod; // already in ATR, from computeGrid
  let fraction = null;
  if (before != null && remaining != null) {
    const denom = before + remaining;
    fraction = denom < FRACTION_NULL_BELOW ? null : before / denom;
  }
  return {
    moveBeforeConfirmation: before,
    moveRemainingAfterConfirmation: remaining,
    fractionElapsedAtEntry: fraction,
  };
}

// ── Hourly RVOL overlay at the touch bar (parent §7 volume overlay) ────────────

/**
 * hourly_rvol_at_touch: the touch hourly bucket's volume ÷ the trailing-RVOL_DAYS average of the
 * SAME bucket index (hour-of-day matched, parent §7). Volume is on the split-adjusted share basis
 * (÷adjFactor, S3-C1) so a split inside the baseline window cannot inflate it. Baselines MAY include
 * pre-study warmup5m sessions (they are baselines only). null when < RVOL_DAYS baselines carry the
 * bucket, or the baseline average is ≤ 0.
 */
export function hourlyRvolAtTouch({ orderedSessions, originIdx, touchBucketIndex }) {
  const bucketStart = BOUNDARIES[touchBucketIndex];
  const bucketEnd = BOUNDARIES[touchBucketIndex + 1];
  const bucketVol = (session) => {
    if (!session || !Array.isArray(session.regular)) return null;
    const bars = session.regular.filter((b) => b.etMinutes >= bucketStart && b.etMinutes < bucketEnd);
    if (!bars.length) return null;
    return bars.reduce((a, b) => a + (b.volume ?? 0) / (b.adjFactor || 1), 0);
  };
  const own = bucketVol(orderedSessions[originIdx]);
  if (own == null) return null;
  const baselines = [];
  for (let i = originIdx - 1; i >= 0 && baselines.length < RVOL_DAYS; i--) {
    const v = bucketVol(orderedSessions[i]);
    if (v != null) baselines.push(v);
  }
  if (baselines.length < RVOL_DAYS) return null;
  const avg = baselines.reduce((a, b) => a + b, 0) / baselines.length;
  return avg > 0 ? own / avg : null;
}

// ── Peer confirmations (Addendum §A2.1; S6 prompt §4) ─────────────────────────

/**
 * peer_confirmations_same_session_before_touch: the number of SAME-SECTOR peer touch events in the
 * SAME session whose own confirmationAt strictly precedes THIS event's touchAt. A peer counts only if
 * its confirmation window had already closed before this level was even touched — a genuinely
 * pre_touch fact, which is why it is availability pre_touch despite needing S6 to compute (config
 * features.group). Populating it is the act that resolves the S5 stub (features-market.js:156).
 *
 * @param {object} event with { eventDate, touchAt }
 * @param {Array} peerLabels [{ eventDate, confirmationAt, disposition }] — peers, self excluded
 */
export function peerConfirmationsSameSessionBeforeTouch(event, peerLabels) {
  if (event == null || event.touchAt == null) {
    throw new Error('labels: peer confirmations require event.touchAt (byte-identical guard)');
  }
  let n = 0;
  for (const p of peerLabels || []) {
    if (p == null || p.disposition !== 'touch') continue;
    if (p.eventDate !== event.eventDate) continue;       // SAME session only
    if (p.confirmationAt == null) continue;              // a peer with no confirmation cannot count
    if (p.confirmationAt < event.touchAt) n += 1;        // STRICTLY before this touch
  }
  return n;
}

// ── The whole label for one event ─────────────────────────────────────────────

/** Validate the fields labelEvent hard-requires; throw rather than silently default (S6 §6.11). */
function assertLabelable(event, orderedSessions, dateToIdx) {
  if (event == null) throw new Error('labels: null event');
  for (const [field, type] of [['eventDate', 'string'], ['touchAt', 'string'], ['touchEtMinutes', 'number'], ['side', 'string']]) {
    if (typeof event[field] !== type) throw new Error(`labels: event.${field} (${type}) is required — refusing to label from a defaulted input (S6 §6.11)`);
  }
  if (typeof event.atrDaily !== 'number' || !(event.atrDaily > 0)) {
    throw new Error(`labels: event ${event.eventId} has no positive atrDaily — the ATR series is a required input, never defaulted (S6 §6.11)`);
  }
  if (typeof event.hourlyClassEligible !== 'boolean') {
    throw new Error(`labels: event ${event.eventId} has no hourlyClassEligible boolean — this event predates S56-A4; re-run the pipeline (S6 §6.11)`);
  }
  const idx = dateToIdx.get(event.eventDate);
  if (idx == null) throw new Error(`labels: no session for eventDate ${event.eventDate} — origin session is a required input (S6 §6.11)`);
  const session = orderedSessions[idx];
  if (!session || !Array.isArray(session.regular) || !session.regular.length) {
    throw new Error(`labels: session ${event.eventDate} has no regular bars — cannot label (S6 §6.11)`);
  }
  return idx;
}

/**
 * Label one touch event: hourly class, three timestamps, dual-origin grid, bridge columns, RVOL
 * overlay. peer_confirmations is populated by the runner (needs the sector's confirmationAt set) and
 * is not computed here.
 *
 * @param {object} a event, orderedSessions (all sessions incl. warmup, ascending), dateToIdx
 * @returns {object} the label record
 */
export function labelEvent({ event, orderedSessions, dateToIdx }) {
  const originIdx = assertLabelable(event, orderedSessions, dateToIdx);
  const session = orderedSessions[originIdx];
  const anchor = anchorOf(event);
  const atr = event.atrDaily;
  const side = event.side;

  // ── Confirmation window → class (nulled when the A4 coverage guard failed upstream) ──
  const window = confirmationWindow({ session, touchEtMinutes: event.touchEtMinutes });
  const metrics = classMetrics({ windowBars: window.windowBars, windowClose: window.windowClose, anchor, atr, side });
  // S56-A4 / S6 §3: NEVER assign a class from an incomplete confirmation window. The eligibility was
  // decided upstream (events.js hourlyCoverageOf) and travels on the event; assert it and null here.
  const hourly_class = event.hourlyClassEligible ? classifyHourly(metrics) : null;
  const hourlyClassInputs = event.hourlyClassEligible ? { P: metrics.P, C: metrics.C, W: metrics.W } : null;
  const hourly_rvol_at_touch = hourlyRvolAtTouch({ orderedSessions, originIdx, touchBucketIndex: window.touchBucketIndex });

  // ── The three timestamps ──
  const confirmationAt = confirmationAtOf(window);
  const entry = entryPointOf({ orderedSessions, originIdx, windowCloseEtMinutes: window.windowCloseEtMinutes });

  // ── Touch-time grid (origin = the touch bar) ──
  const touchBar = session.regular.find((b) => b.etMinutes === event.touchEtMinutes)
    || session.regular.find((b) => b.etMinutes >= event.touchEtMinutes);
  if (!touchBar) throw new Error(`labels: no touch bar at/after ${event.touchEtMinutes} in ${event.eventDate} (byte-identical guard)`);
  const touchPrice = touchBar.adjOpen;
  const touchTime = computeGrid({
    orderedSessions, originIdx, originEtMinutes: event.touchEtMinutes, originPrice: touchPrice, anchor, atr, side,
  });

  // ── Confirmation-time grid (origin = entryAt) — reads NO bar before entryAt, by construction ──
  let confirmationTime = null;
  if (entry.entrySessionIdx != null) {
    confirmationTime = computeGrid({
      orderedSessions, originIdx: entry.entrySessionIdx, originEtMinutes: entry.entryEtMinutes,
      originPrice: entry.entryPrice, anchor, atr, side,
    });
  }

  // ── Bridge columns ──
  const bridge = bridgeColumns({
    touchPrice, entryPrice: entry.entryPrice,
    confirmationMfeEod: confirmationTime ? confirmationTime.mfe.EOD : null, atr, side,
  });

  return {
    eventId: event.eventId,
    symbol: event.symbol,
    sector: event.sector,
    side,
    eventDate: event.eventDate,
    familyTier: event.familyTier,
    disposition: event.disposition,
    touchAt: event.touchAt,
    touchEtMinutes: event.touchEtMinutes,
    hourlyClassEligible: event.hourlyClassEligible,
    // §7 class
    hourly_class,
    hourlyClassInputs,
    hourly_rvol_at_touch,
    // §3 timestamps
    confirmationAt,
    entryAt: entry.entryAt,
    entryEtMinutes: entry.entryEtMinutes,
    overnightEntry: entry.overnightEntry,
    // §9 dual grids
    touchTime,
    confirmationTime,
    // §9.2 bridge
    ...bridge,
    // §A2.1 peer (populated by the runner)
    peer_confirmations_same_session_before_touch: null,
    configVersion: CONFIG.version,
  };
}
