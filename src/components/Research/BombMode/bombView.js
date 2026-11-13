// src/components/Research/BombMode/bombView.js
//
// Pure assembly for the three Bomb views: which ladder a mount gets, the
// LIVE · SCORED chip's display rule, the sheet's template line, the check a
// scored instant belongs to, and the red-zone trace's honest split between
// closed minute bars and the quotes the modal observed (BA-6). No React.

import { priceDecimals, priceText } from '../priceFormat.js';
import { nextEligibleSlot } from '../../../../api/_utils/callRecords/horizon.js';
import { measuredLadder, previewLadder, v4Ladder, v4LevelsFor, rungPct, rungShown } from './ladder.js';
import { BOMB_COPY, money, rungPctText } from './bombCopy.js';
import { etClock, etClockAmPm, etDate, etWeekday } from './checkClock.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => finite(v) && v > 0;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * The one ladder this mount draws (BA-1): held when the agent battle's record
 * names a MEASURED position in THIS symbol, else a preview (V4 levels when the
 * battle has today's, else yesterday's close × the Bomb tab's threshold).
 *
 * Ruling 2026-11-07 (spec §0.4(a), rule (i)): the held ladder is drawn only
 * for `record.model === 'measured'`. A legacy-scored position (a legacy stock,
 * and every crypto, stamped battle or not) is not decided only at a 15-minute
 * check — the 8:45 PM ET nightly run re-scores it and its day ladder re-bases
 * each night — so it draws the preview, marked `heldPreview` so the sheet says
 * it is held without promising a ladder. A preview has no clock, no scored
 * chip, no check dots, no red zone and nothing banked. ladder.js legacyLadder
 * stays in the tree, unreachable from here, until the 'on' cleanup.
 */
export function buildLadder({ context, record, bombData, previousClose, threshold, symbol, nowMs, atrReading = null }) {
  if (context?.kind === 'agent' && record && record.symbol === symbol) {
    // The live record's committed context (same shape and source as the
    // modal's bombData.measured); bombData only when the record has none.
    if (record.model === 'measured') return measuredLadder({ measured: record.measured, entryAtMs: record.entry?.atMs ?? null });
    if (record.model === 'legacy') return { ...previewLadder({ previousClose, threshold }), heldPreview: true };
    return { status: record.reason === 'short_position' ? 'short_unsupported' : 'model_unavailable', kind: 'held', model: 'unsupported', rungs: [], up: [], down: [], next: null, bankedPoints: 0 };
  }
  // BS-4 (founder ruling Q3, 2026-11-12): a stock the agent does not hold, in a battle
  // scored by the measured ATR model, previews its rungs at the rankings' ATR reading
  // (atrReading.js) — the scorer's own formula, the number the bench sheet's ATR column
  // shows — never the screen's threshold (atrPercentile × 8, or the 2.5 default). The
  // modal hands `atrReading` ONLY on that arm (a non-held, non-crypto stock in such a
  // battle); a held ladder above, a legacy-scored battle, a bench or V4 context never
  // reach here. With no ladder: "No ladder yet", with the arm's own why — atr_loading
  // (the reading or yesterday's close still coming), atr_failed (the read failed; asked
  // again on the next change of view, tab or timeframe), atr_unavailable (no current reading, or one no ladder can be
  // drawn from: a rung at or below $0 — review A2).
  if (context?.kind === 'agent' && atrReading) {
    const pct = positive(atrReading.pct) ? atrReading.pct : null;
    const none = { ...previewLadder({ previousClose, threshold: null }) };
    if (pct === null) {
      return { ...none, status: atrReading.status === 'none' ? 'atr_unavailable' : atrReading.status === 'failed' ? 'atr_failed' : 'atr_loading' };
    }
    const ladder = previewLadder({ previousClose, threshold: pct });
    if (ladder.status !== 'ok') return { ...none, status: positive(previousClose) ? 'atr_unavailable' : 'atr_loading' };
    return { ...ladder, atrReading: { pct, asOfMs: finite(atrReading.asOfMs) ? atrReading.asOfMs : null } };
  }
  if (context?.kind === 'v4') {
    const levels = v4LevelsFor(context.dailyLevels, symbol, nowMs);
    if (levels) return v4Ladder({ levels });
  }
  return previewLadder({ previousClose, threshold });
}

/** The display decimals of a price (the modal's one precision rule). */
export const decimalsOf = (live) => priceDecimals(live);

/**
 * The LIVE · SCORED chip (spec §3.2): in the red zone always; elsewhere only
 * when the two prices differ by at least one display unit. Null when the
 * record has no scored price (a preview has none).
 */
export function scoredChipText({ live, scored, decimals, always = false, frozen = false, nowMs = null }) {
  if (!scored || !positive(scored.price) || !finite(scored.atMs) || !positive(live)) return null;
  const d = finite(decimals) ? decimals : priceDecimals(live);
  const differs = priceText(live, d) !== priceText(scored.price, d);
  if (!always && !differs) return null;
  return (frozen ? BOMB_COPY.lastTickChip : BOMB_COPY.scoredChip)(live, scored.price, scoredAtText(scored, nowMs), d);
}

/**
 * BD-8 — WHICH CHECK scored the price: `the 1:00 check`, or `Mon's 3:45 check`
 * for an earlier session. The check is the slot of the moment the check READ the
 * quote — `scored.checkAtMs`, the committed context's quoteEvidence.observedAt —
 * NOT the quote's provider time (`scored.atMs`): EODHD stamps its quotes about
 * 16 minutes before the check observes them (build report §1.1, BD-I1), so the
 * provider time names the check two slots early (12:44 → "the 12:30 check" for
 * the 1:00 check). A record without an observation instant (the legacy tick,
 * whose time IS the evaluator's clock) uses `atMs`. With no slot, today's
 * wording: the time, with its day when it is an earlier session's.
 */
export function scoredAtText(scored, nowMs = null) {
  const readMs = finite(scored?.checkAtMs) ? scored.checkAtMs : scored?.atMs;
  const slot = checkSlotOf(readMs);
  if (slot !== null) {
    const sameDay = !finite(nowMs) || etDate(slot) === etDate(nowMs);
    return sameDay ? BOMB_COPY.checkName(etClock(slot)) : BOMB_COPY.checkNameDay(etWeekday(slot), etClock(slot));
  }
  // A check from an earlier session names its day: "at 1:15" alone would read as today's.
  const sameDay = finite(nowMs) && etDate(scored.atMs) === etDate(nowMs);
  return sameDay || !finite(nowMs) ? etClock(scored.atMs) : `${etWeekday(scored.atMs)} ${etClock(scored.atMs)}`;
}

/** BS-4: the ATR reading's time — the rankings run's: '1:00 PM' today, 'Fri 3:00 PM' from an earlier day; null when unknown. */
export function atrAsOfText(asOfMs, nowMs = null) {
  if (!finite(asOfMs)) return null;
  const sameDay = finite(nowMs) && etDate(asOfMs) === etDate(nowMs);
  return sameDay ? etClockAmPm(asOfMs) : `${etWeekday(asOfMs)} ${etClockAmPm(asOfMs)}`;
}

/** The check name for a seen bank or hit instant (a slot instant): `the 1:15 check`. */
export const checkNameAt = (ms) => (finite(ms) ? BOMB_COPY.checkName(etClock(ms)) : null);

/**
 * BD-6, BUILD_RULES §9 — ONE rung's printed facts, from the one ladder and the
 * one decimals: the Fuse's titles and price labels, the bar and the levels
 * table all print these exact strings for a rung. The price is the rung's
 * displayed price, rounded toward its award (ladder.rungShown, BP-1); the % is
 * the rule's (ladder.rungPct, BP-3).
 */
export function rungFacts(ladder, rung, decimals) {
  const pct = rungPct(ladder, rung, decimals);
  const shown = rungShown(rung, decimals);
  return { pct, pctText: finite(pct) ? rungPctText(pct) : null, shown, priceText: money(shown, finite(decimals) ? decimals : priceDecimals(rung.price)) };
}

/** The live price's move from the baseline, % of the displayed baseline, from the displayed prices — the Fuse's live label and the table's live row print it (§9). */
export function liveMovePct(ladder, live, decimals) {
  if (!ladder || ladder.status !== 'ok' || !positive(live)) return null;
  const d = finite(decimals) ? decimals : priceDecimals(live);
  const base = Number(priceText(ladder.baseline.price, d));
  return base > 0 ? ((Number(priceText(live, d)) - base) / base) * 100 : null;
}

/**
 * The scheduled check a scored instant belongs to: the latest evaluator slot
 * at or before it (the cron fires on the slot and may run a few minutes late
 * in its queue). Null when the schedule has none. The scored instant is
 * before the battle's end by construction, so with no end given the slot
 * search is unbounded.
 */
export function checkSlotOf(ms, battleExpiresAtMs = null) {
  if (!finite(ms)) return null;
  const s = nextEligibleSlot(ms - FIFTEEN_MIN_MS, { battleExpiresAtMs: finite(battleExpiresAtMs) ? battleExpiresAtMs : Number.MAX_SAFE_INTEGER });
  return 'slotMs' in s && s.slotMs <= ms ? s.slotMs : null;
}

/**
 * The sheet's one line — what has to happen (spec §4.3 templates; lead-aware
 * since BD-4). `bankedTimes` / `hitTimes`: tier → the check instant the modal
 * SAW it bank / hit at (BA-4); absent → no time is written. `lead`: the lead
 * side (BD-2; null reads as up).
 *
 *   up leads      Needs $280.91 at a check for +15 · Bust at $259.53 · next check 1:15
 *   down leads    Bust (−10) if it's at or below $259.53 at a check · +15 needs $280.91 · next check 1:15
 *   after a hit   Bust −10 hit at the 1:15 check · next below: Crash at $253.47   (down leading)
 *   banked / all  the Build A lines, unchanged (up leading)
 *
 * Every rung price here is the rung's displayed price (ladder.rungShown, BP-1):
 * "Needs $X at a check" and "Bust (−10) if it's at or below $X" are true at X.
 */
export function sheetLine({ ladder, clockLabel = null, checking = false, bankedTimes = {}, hitTimes = {}, lead = null, decimals, nowMs = null }) {
  if (!ladder || ladder.status !== 'ok') return null;
  const d = decimals;
  const px = (r) => rungShown(r, d);
  if (ladder.kind === 'preview') {
    if (ladder.model === 'v4') return BOMB_COPY.previewV4(ladder.baseline.price, d);
    // BS-4: the rung size is the ATR reading — labelled as an estimate, with its value as the
    // bench sheet prints it (one decimal) and the rankings run's time.
    if (ladder.atrReading) return BOMB_COPY.previewNeedsAtr(ladder.baseline.price, d, ladder.atrReading.pct, atrAsOfText(ladder.atrReading.asOfMs, nowMs));
    return (ladder.heldPreview === true ? BOMB_COPY.heldPreviewNeeds : BOMB_COPY.previewNeeds)(ladder.baseline.price, d);
  }
  const join = (...parts) => parts.filter(Boolean).join(' · ');
  const clock = checking ? BOMB_COPY.checking : clockLabel ? BOMB_COPY.nextCheckInline(clockLabel) : null;
  const next = ladder.next;
  const nextDown = ladder.nextDown ?? null;
  if (lead === 'down' && nextDown) {
    const lastHit = [...ladder.down].reverse().find((r) => r.hit) || null;
    if (lastHit) return join(BOMB_COPY.downHitAt(lastHit.label, lastHit.points, checkNameAt(hitTimes[lastHit.key])), BOMB_COPY.downNextBelow(nextDown.label, px(nextDown), d));
    return join(BOMB_COPY.downIfAtCheck(nextDown.label, nextDown.points, px(nextDown), d), next ? BOMB_COPY.upNeeds(next.points, px(next), d) : null, clock);
  }
  if (!next) return BOMB_COPY.allRungsBanked(ladder.bankedPoints);
  const lastBanked = [...ladder.up].reverse().find((r) => r.banked) || null;
  if (lastBanked) {
    const at = finite(bankedTimes[lastBanked.key]) ? etClock(bankedTimes[lastBanked.key]) : null;
    return BOMB_COPY.afterBank(lastBanked.points, at, px(next), d);
  }
  return join(BOMB_COPY.needsFor(px(next), d, next.points), nextDown ? BOMB_COPY.downAt(nextDown.label, px(nextDown), d) : null, clock);
}

/**
 * The red-zone trace (spec §3.5, BA-6): the minute bars as a line up to their
 * last bar, then the quotes the modal observed AFTER that bar as separate dots
 * — never joined to the line, never interpolated. Bars are oldest-first.
 */
export function traceParts(bars, observations) {
  const line = (Array.isArray(bars) ? bars : [])
    .map((b) => ({ t: barMs(b), c: Number(b?.close) }))
    .filter((p) => finite(p.t) && positive(p.c))
    .sort((a, b) => a.t - b.t);
  const lastBarMs = line.length ? line[line.length - 1].t : null;
  const dots = (Array.isArray(observations) ? observations : [])
    .filter((o) => finite(o?.atMs) && positive(o?.price) && (lastBarMs === null || o.atMs > lastBarMs))
    .sort((a, b) => a.atMs - b.atMs);
  // The bars' own spacing names them (a 30-minute fallback series is never called 1-minute).
  let intervalMin = null;
  if (line.length >= 2) {
    const gaps = line.slice(1).map((p, i) => p.t - line[i].t).filter((g) => g > 0).sort((a, b) => a - b);
    if (gaps.length) intervalMin = Math.max(1, Math.round(gaps[Math.floor(gaps.length / 2)] / 60000));
  }
  return { line, dots, lastBarMs, intervalMin };
}

/** A bar's instant in ms (the hook's bars carry `timestamp` seconds and/or a date string). */
export function barMs(b) {
  if (!b) return null;
  if (finite(b.timestamp)) return b.timestamp * 1000;
  if (finite(b.time)) return b.time * 1000;
  const s = b.date || b.datetime;
  if (typeof s !== 'string') return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}
