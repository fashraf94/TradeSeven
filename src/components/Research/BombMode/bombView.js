// src/components/Research/BombMode/bombView.js
//
// Pure assembly for the three Bomb views: which ladder a mount gets, the
// LIVE · SCORED chip's display rule, the sheet's template line, the check a
// scored instant belongs to, and the red-zone trace's honest split between
// closed minute bars and the quotes the modal observed (BA-6). No React.

import { priceDecimals, priceText } from '../priceFormat.js';
import { nextEligibleSlot } from '../../../../api/_utils/callRecords/horizon.js';
import { measuredLadder, legacyLadder, previewLadder, v4Ladder, v4LevelsFor } from './ladder.js';
import { BOMB_COPY } from './bombCopy.js';
import { etClock, etDate, etWeekday } from './checkClock.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => finite(v) && v > 0;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * The one ladder this mount draws (BA-1): held when the agent battle's record
 * names a position in THIS symbol, else a preview (V4 levels when the battle
 * has today's, else yesterday's close × the Bomb tab's threshold).
 */
export function buildLadder({ context, record, bombData, previousClose, threshold, symbol, nowMs }) {
  if (context?.kind === 'agent' && record && record.symbol === symbol) {
    // The live record's committed context (same shape and source as the
    // modal's bombData.measured); bombData only when the record has none.
    if (record.model === 'measured') return measuredLadder({ measured: record.measured, entryAtMs: record.entry?.atMs ?? null });
    if (record.model === 'legacy') return legacyLadder({ record, previousClose, nowMs });
    return { status: 'short_unsupported', kind: 'held', model: 'unsupported', rungs: [], up: [], down: [], next: null, bankedPoints: 0 };
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
  // A check from an earlier session names its day: "at 1:15" alone would read as today's.
  const sameDay = finite(nowMs) && etDate(scored.atMs) === etDate(nowMs);
  const at = sameDay || !finite(nowMs) ? etClock(scored.atMs) : `${etWeekday(scored.atMs)} ${etClock(scored.atMs)}`;
  return (frozen ? BOMB_COPY.lastTickChip : BOMB_COPY.scoredChip)(live, scored.price, at, d);
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
 * The sheet's one line (spec §4.3 templates). `bankedTimes`: tier → the check
 * instant the modal SAW it bank at (BA-4); absent → no time is written.
 */
export function sheetLine({ ladder, clockLabel = null, checking = false, bankedTimes = {}, decimals }) {
  if (!ladder || ladder.status !== 'ok') return null;
  const d = decimals;
  if (ladder.kind === 'preview') {
    return ladder.model === 'v4' ? BOMB_COPY.previewV4(ladder.baseline.price, d) : BOMB_COPY.previewNeeds(ladder.baseline.price, d);
  }
  if (!ladder.next) return BOMB_COPY.allRungsBanked(ladder.bankedPoints);
  const lastBanked = [...ladder.up].reverse().find((r) => r.banked) || null;
  if (lastBanked) {
    const at = finite(bankedTimes[lastBanked.key]) ? etClock(bankedTimes[lastBanked.key]) : null;
    return BOMB_COPY.afterBank(lastBanked.points, at, ladder.next.price, d);
  }
  return checking ? BOMB_COPY.needsChecking(ladder.next.price, d) : BOMB_COPY.needs(ladder.next.price, d, clockLabel);
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
