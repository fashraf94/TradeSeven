// api/_utils/filmTape/tapeReplay.js
//
// Film Room tape — THE REPLAY (spec BA-11). PURE apart from the scorer import.
//
// "The replay is rebuilt, corrected, and says so." Two paths, both through the
// day's close, both from the session's 1-minute bars sampled at the battle's
// own check times, both scored by calculateAssetScoreServer IMPORTED from the
// fenced api/_utils/agentScoring.js (BUILD_RULES §4: never a local copy of
// scoring math — the replay's tests swap the imported scorer and watch every
// number follow it), with the extremes empty as on every agent path:
//
//   hold path  the sold name scored from its ORIGINAL entry as if never sold,
//              its threshold history continued from the receipt's copy
//              (ghost.atClose);
//   swap path  the recorded lockedPoints banked by the sale PLUS the bought
//              name scored from the swap, its history starting at zero as the
//              executor reset it (bought.atClose).
//   gapPoints = (lockedPoints + bought.atClose) − ghost.atClose
//
// A sale that banks 10, reconciles exactly, and after which neither stock
// moves gives gapPoints 0 — never −10 (the Sep 27 review's worked example).
//
// Samples: the swap instant, then every later check whose tick scored the book
// (stageReached at or past `scores_marked`, as the live evaluator ratchets the
// history only on those), then the session close — each at the last minute
// that COMPLETED at or before the instant (bars.js priceAt), and only when
// that minute closed within 5 minutes of the instant (BA-24, bars.js
// sampleAt). A sample with no fresh price is skipped, left null in its series
// with its stale bar's close time beside it (`barClosedAt`), and named in
// missingInputs. The comparables and the evidence reconciliation obey the
// same rule. `retryableInputs` is the part of missingInputs a later fetch
// could still supply (bars, and samples after the session's first minute) —
// the candle pass keeps such a tape queued inside its window.
//
// reconciliation.closedLegDelta = rebuilt ghost at the swap − lockedPoints:
// agreement AT THE SALE, stated as that and nothing more. boughtVsEvidence
// compares the rebuilt price of the bought name with the price the platform
// recorded in the first later evidence stamp that carries it.
//
// A RETRY MERGES POINT BY POINT (BA-36, mergeReplay): two replays built from
// the same inputs (one `builtFrom`) are merged sample by sample, leg by leg —
// a saved point is never replaced by null, a saved null is no fact and gives
// way to the new point, and where both hold a value the more complete replay's
// stands (a tie keeps the stored one). A leg's points are one scored path: the
// scorer's history runs through every earlier sample of that leg, so a point
// kept from an attempt that lacked an earlier sample keeps that sample named
// in missingInputs — the merge never reads complete on a path no single
// attempt scored. The views (holdPath, swapPath, gap, closedLegDelta) are
// composed from the merged legs by composeLegs, the build's own composition.

import { calculateAssetScoreServer } from '../agentScoring.js';
import { sampleAt, sampleCanExist, pctChange } from './bars.js';
import { toMs } from './tapeTime.js';
import { scoredCheck, laterChecks } from './candleInputs.js';

// Which checks a replay samples is candleInputs.js's rule, so a unit's
// `builtFrom` (BA-31) and the replay it identifies read the same checks.
export { scoredCheck };

export const REPLAY_LABEL = "one-step hypothetical through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle";

const round2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const iso = (ms) => new Date(ms).toISOString();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** A sample on a path: its points, and — when no fresh price stood for it — the stale bar's close time beside the null (BA-24). */
const point = (s) => ({ tickSeq: s.tickSeq, at: iso(s.atMs), points: s.points, ...(s.missing && s.staleBarClosedAt !== null ? { barClosedAt: iso(s.staleBarClosedAt) } : {}) });

/**
 * The replay's views from each leg's samples (BA-11), as `point` entries in
 * the order they were taken: the sold name's — the swap, the later checks, the
 * close — and the bought name's — the later checks, the close. The swap path
 * opens at the sale with exactly what the sale banked. One composition, used
 * by the build and by a merge (BA-36), so a merged replay is stated exactly as
 * a built one.
 */
export function composeLegs({ ghostPts, boughtPts, locked, swap }) {
  const ghost = ghostPts
    ? { atSwap: ghostPts[0]?.points ?? null, atClose: ghostPts[ghostPts.length - 1]?.points ?? null, series: ghostPts.slice(1, -1).map((p) => ({ ...p })) }
    : null;
  const bought = boughtPts
    ? { atClose: boughtPts[boughtPts.length - 1]?.points ?? null, series: boughtPts.slice(0, -1).map((p) => ({ ...p })) }
    : null;
  return {
    ghost,
    bought,
    holdPath: ghostPts ? ghostPts.map((p) => ({ ...p })) : null,
    swapPath: bought && locked !== null
      ? [{ tickSeq: swap.tickSeq, at: swap.at, points: locked }, ...boughtPts.map((p) => ({ ...p, points: p.points === null ? null : round2(locked + p.points) }))]
      : null,
    gapPoints: ghost && bought && locked !== null && ghost.atClose !== null && bought.atClose !== null
      ? round2((locked + bought.atClose) - ghost.atClose)
      : null,
    closedLegDelta: ghost && locked !== null && ghost.atSwap !== null ? round2(ghost.atSwap - locked) : null,
  };
}

/**
 * Score one leg along the samples. Returns per-sample points (null where no
 * price) and the value at the close.
 */
function runLeg({ inputs, symbol, bars, samples, tierStamp }) {
  let history = { maxMultiplier: inputs.thresholdHistory.maxMultiplier, minMultiplier: inputs.thresholdHistory.minMultiplier };
  const out = [];
  for (const s of samples) {
    const p = sampleAt(bars, s.atMs);
    if (!p || !p.valid) { out.push({ ...s, points: null, missing: true, staleBarClosedAt: p ? p.barClosedAt : null }); continue; }
    const priceChange = ((p.price - inputs.entryPrice) / inputs.entryPrice) * 100;
    const base = inputs.thresholdBaseline.value;
    const thresholdPriceChange = ((p.price - base) / base) * 100;
    // The rebuild carries the MODE-RESOLVED tier stamp, as every live caller
    // does (flat6TierStamp.passthrough.test.js): null for a tiered battle — the
    // only mode the tape replays (BA-3) — so the scorer resolves
    // CONVICTION_MULTIPLIERS[tier] exactly as the live evaluator did.
    const r = calculateAssetScoreServer(
      { symbol, baseATR: inputs.atr, tier: inputs.tier, direction: inputs.direction ?? null, tierMultiplier: tierStamp ?? null },
      priceChange, history, {}, thresholdPriceChange,
    );
    history = { maxMultiplier: r.history.maxMultiplier, minMultiplier: r.history.minMultiplier };
    out.push({ ...s, points: r.totalPoints, price: p.price, missing: false });
  }
  return out;
}

/**
 * The replay for one action row of a tape, or null when the action is out of
 * scope (crypto — the close pass already stated why on `replayReason`).
 *
 * @param {object} p
 * @param {object} p.action          a tape `actions[]` row
 * @param {object[]} p.checks        the tape's `checks[]`
 * @param {Record<string, object[]>} p.barsBySymbol  sessionBars per symbol (missing symbol → absent)
 * @param {object} p.session         marketSchedule.getSessionForDate(etDate)
 * @param {Record<string,string|null>} p.sectors  comparables.sectors
 * @param {number|null} [p.tierStamp]  resolveModeConfig(gameMode).flatMultiplier — null for tiered
 */
export function replayAction({ action, checks, barsBySymbol, session, sectors = {}, tierStamp = null }) {
  if (action.replayReason === 'crypto_not_supported') return null;
  const swapMs = toMs(action.at);
  const missingInputs = [...(action.replayMissing || [])];
  const retryableInputs = [];
  /** A market-data sample with no fresh price: named, and retryable unless no minute could have closed yet. */
  const missSample = (name, atMs) => { missingInputs.push(name); if (sampleCanExist(session, atMs)) retryableInputs.push(name); };
  const missBars = (sym) => { missingInputs.push(`bars:${sym}`); retryableInputs.push(`bars:${sym}`); };
  const inputs = action.replayInputs || { ghost: null, bought: null };
  const barsOut = barsBySymbol[action.symbolOut] || null;
  const barsIn = barsBySymbol[action.symbolIn] || null;
  if (!barsOut) missBars(action.symbolOut);
  if (!barsIn) missBars(action.symbolIn);

  // The check that MADE the swap is the swap sample, not a later check: its
  // capturedAt falls a few seconds after the swap instant, inside the same minute.
  const later = laterChecks(checks, action, session);
  const samples = [
    { kind: 'swap', tickSeq: Number.isInteger(action.tickSeq) ? action.tickSeq : null, atMs: swapMs },
    ...later.map((c) => ({ kind: 'check', tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, atMs: toMs(c.at), key: c.key })),
    { kind: 'close', tickSeq: null, atMs: session.closeMs },
  ];

  const legOf = (legInputs, symbol, bars, legSamples) => {
    if (!legInputs || !bars) return null;
    const run = runLeg({ inputs: legInputs, symbol, bars, samples: legSamples, tierStamp });
    for (const s of run) if (s.missing) missSample(`price:${symbol}@${s.kind === 'check' ? (s.tickSeq ?? iso(s.atMs)) : s.kind}`, s.atMs);
    return run;
  };
  // The sold name is sampled AT the swap too (its standing at the sale is the
  // reconciliation's subject). The bought name is scored FROM the swap: its
  // samples are the later checks and the close only — the last minute that
  // completed before the swap is a price from before it was bought, and
  // scoring it against the fill could ratchet a badge the live position never
  // saw (review L2-F2; BA-11, §6 "each later check's … price and at the close").
  const ghostRun = legOf(inputs.ghost, action.symbolOut, barsOut, samples);
  const boughtRun = legOf(inputs.bought, action.symbolIn, barsIn, samples.filter((smp) => smp.kind !== 'swap'));
  const locked = typeof action.lockedPoints === 'number' && Number.isFinite(action.lockedPoints) ? action.lockedPoints : null;
  if (locked === null) missingInputs.push('lockedPoints');

  // The views and the gap (composeLegs); closedLegDelta is agreement at the sale.
  const legs = composeLegs({
    ghostPts: ghostRun ? ghostRun.map(point) : null,
    boughtPts: boughtRun ? boughtRun.map(point) : null,
    locked,
    swap: { tickSeq: samples[0].tickSeq, at: iso(samples[0].atMs) },
  });

  // Reconciliation — the bought name against its first recorded evidence.
  let boughtVsEvidence = null;
  if (barsIn && inputs.bought) {
    const row = later.find((c) => c.evidence && c.evidence[action.symbolIn] && typeof c.evidence[action.symbolIn].px === 'number');
    const rebuilt = row ? sampleAt(barsIn, toMs(row.at)) : null;
    // A stale bar is never reconciled against the recorded price (BA-24).
    if (row && rebuilt?.valid) {
      const ev = row.evidence[action.symbolIn];
      const rebuiltChg = round2(((rebuilt.price - inputs.bought.entryPrice) / inputs.bought.entryPrice) * 100);
      boughtVsEvidence = {
        tickSeq: Number.isInteger(row.tickSeq) ? row.tickSeq : null,
        evalId: row.evalId ?? null,
        at: row.at,
        recordedPx: ev.px,
        rebuiltPx: rebuilt.price,
        pxDelta: round2(rebuilt.price - ev.px),
        recordedChg: typeof ev.chg === 'number' ? ev.chg : null,
        rebuiltChg,
        chgDelta: typeof ev.chg === 'number' && rebuiltChg !== null ? round2(rebuiltChg - ev.chg) : null,
      };
    }
  }

  // Comparables from the swap to the close (market class — bars alone), each
  // end a fresh sample or the change is null with the missing end named.
  const changeAfter = (sym) => {
    const bars = barsBySymbol[sym];
    if (!bars) { missBars(sym); return null; }
    const from = sampleAt(bars, swapMs);
    const to = sampleAt(bars, session.closeMs);
    if (!from?.valid) missSample(`price:${sym}@swap`, swapMs);
    if (!to?.valid) missSample(`price:${sym}@close`, session.closeMs);
    return from?.valid && to?.valid ? pctChange(from.price, to.price) : null;
  };
  const marketChangeAfter = { SPY: changeAfter('SPY'), RSP: changeAfter('RSP') };
  const sectorChangeAfter = {};
  for (const sym of [action.symbolOut, action.symbolIn]) {
    const etf = sectors[sym];
    if (etf && !(etf in sectorChangeAfter)) sectorChangeAfter[etf] = changeAfter(etf);
  }

  return {
    basis: 'rebuilt_1m_at_checks',
    horizon: 'close',
    hypothetical: true,
    label: REPLAY_LABEL,
    closeAt: iso(session.closeMs),
    lockedPoints: locked,
    subsequentTradesInSlot: action.subsequentTradesInSlot ?? null,
    ghost: legs.ghost,
    bought: legs.bought,
    holdPath: legs.holdPath,
    swapPath: legs.swapPath,
    gapPoints: legs.gapPoints,
    reconciliation: { closedLegDelta: legs.closedLegDelta, boughtVsEvidence },
    marketChangeAfter,
    sectorChangeAfter,
    missingInputs: [...new Set(missingInputs)],
    retryableInputs: [...new Set(retryableInputs)],
  };
}

// ── BA-36 — a retry merges a replay point by point ─────────────────────────

/** How complete a replay is: a gap first, then legs, then fewer missing inputs (review L2-F1). */
export const replayRank = (r) => (r ? (r.gapPoints !== null ? 1000 : 0) + ((r.ghost ? 1 : 0) + (r.bought ? 1 : 0)) * 100 - (r.missingInputs || []).length : -1);

const hasPoint = (e) => isNum(e?.points);

/** Does a replay hold any fact — a scored point, a reconciliation, a comparable (BA-31: a unit that "exists")? */
export function replayHasFact(r) {
  if (!r) return false;
  const legs = legSamples(r);
  return [legs.ghost, legs.bought].some((list) => Array.isArray(list) && list.some(hasPoint))
    || Boolean(r.reconciliation?.boughtVsEvidence)
    || [...Object.values(r.marketChangeAfter || {}), ...Object.values(r.sectorChangeAfter || {})].some(isNum);
}

/**
 * A built replay's two legs as the samples each was scored at, in order: the
 * sold name's swap, later checks and close (its holdPath); the bought name's
 * later checks and close. Null for a leg that was not built.
 */
function legSamples(r) {
  const ghost = r?.ghost && Array.isArray(r.holdPath) ? r.holdPath : null;
  let bought = null;
  if (r?.bought) {
    const tail = Array.isArray(r.swapPath) ? r.swapPath[r.swapPath.length - 1] : null;
    bought = [...(Array.isArray(r.bought.series) ? r.bought.series : []),
      { tickSeq: null, at: r.closeAt ?? tail?.at ?? null, points: isNum(r.bought.atClose) ? r.bought.atClose : null, ...(tail?.barClosedAt ? { barClosedAt: tail.barClosedAt } : {}) }];
  }
  return { ghost, bought };
}

/** The sample a leg's i-th entry stands for, as missingInputs names it (`price:SYMBOL@<swap | tickSeq | instant | close>`). */
const sampleKey = (leg, list, i) => (i === list.length - 1 ? 'close' : (leg === 'ghost' && i === 0 ? 'swap' : (list[i].tickSeq ?? list[i].at)));

/**
 * One leg, sample by sample: a saved point is never replaced by null; a saved
 * null is no fact, so the new entry stands there; where both hold a value, the
 * more complete replay's stands, and a tie keeps the stored one. A leg only
 * one attempt built is that attempt's, whole.
 */
function mergeLeg(s, f, storedWins) {
  if (!s || !f) {
    if (!s && !f) return null;
    const side = s ? 's' : 'f';
    return { list: s ?? f, from: (s ?? f).map(() => side) };
  }
  if (s.length !== f.length) {
    // The same builtFrom samples the same instants, so this is no merge case — keep the leg holding more.
    const side = f.filter(hasPoint).length > s.filter(hasPoint).length ? 'f' : 's';
    const list = side === 's' ? s : f;
    return { list, from: list.map(() => side) };
  }
  const from = s.map((se, i) => (!hasPoint(se) ? 'f' : (!hasPoint(f[i]) ? 's' : (storedWins ? 's' : 'f'))));
  return { list: from.map((side, i) => (side === 's' ? s[i] : f[i])), from };
}

/**
 * The samples a merged leg is missing: each null point, and — for a point kept
 * from an attempt that lacked an EARLIER sample of the leg — that sample too,
 * since the scorer's history runs through every earlier sample (BA-11). A kept
 * point the other attempt scored to the same value on a whole path (every
 * earlier sample of the leg priced) is vouched for by it, and names nothing.
 */
function legNames(symbol, leg, merged, sides) {
  const out = [];
  const wholeBefore = (list, i) => Array.isArray(list) && list.length === merged.list.length && list.slice(0, i).every(hasPoint);
  merged.list.forEach((e, i) => {
    if (!hasPoint(e)) { out.push(`price:${symbol}@${sampleKey(leg, merged.list, i)}`); return; }
    const src = sides[merged.from[i]];
    if (wholeBefore(src, i)) return;
    const other = sides[merged.from[i] === 's' ? 'f' : 's'];
    if (wholeBefore(other, i) && hasPoint(other[i]) && other[i].points === e.points) return;
    for (let h = 0; h < i; h += 1) if (!hasPoint(src[h])) out.push(`price:${symbol}@${sampleKey(leg, src, h)}`);
  });
  return out;
}

/** Keyed market changes (marketChangeAfter, sectorChangeAfter), key by key, by the same rule. */
function mergeKeyed(s, f, storedWins) {
  const out = {};
  for (const k of [...new Set([...Object.keys(s || {}), ...Object.keys(f || {})])]) {
    const sv = s?.[k] ?? null;
    const fv = f?.[k] ?? null;
    out[k] = !isNum(sv) ? fv : (!isNum(fv) ? sv : (storedWins ? sv : fv));
  }
  return out;
}

/**
 * BA-36 — the replay a retry keeps when the stored and the new one share
 * `builtFrom`, merged point by point (see the header). The caller (the candle
 * pass's keepUnit) decides whether the merge kept anything earlier, and marks
 * it `preservedFrom`. `missingInputs` names exactly what the merged replay
 * lacks: its null points, the samples its kept points were built without, and
 * — for a leg or a comparable neither attempt priced — why; the inputs the
 * action row itself lacks are the same on both.
 */
export function mergeReplay(stored, fresh, { symbolOut, symbolIn }) {
  const storedWins = replayRank(stored) >= replayRank(fresh);
  const sl = legSamples(stored);
  const fl = legSamples(fresh);
  const ghost = mergeLeg(sl.ghost, fl.ghost, storedWins);
  const bought = mergeLeg(sl.bought, fl.bought, storedWins);
  const locked = isNum(fresh.lockedPoints) ? fresh.lockedPoints : null;
  const swapEntry = (Array.isArray(fresh.swapPath) ? fresh.swapPath[0] : null) ?? (Array.isArray(stored.swapPath) ? stored.swapPath[0] : null) ?? ghost?.list[0] ?? null;
  const legs = composeLegs({ ghostPts: ghost?.list ?? null, boughtPts: bought?.list ?? null, locked, swap: { tickSeq: swapEntry?.tickSeq ?? null, at: swapEntry?.at ?? null } });
  const marketChangeAfter = mergeKeyed(stored.marketChangeAfter, fresh.marketChangeAfter, storedWins);
  const sectorChangeAfter = mergeKeyed(stored.sectorChangeAfter, fresh.sectorChangeAfter, storedWins);
  const sB = stored.reconciliation?.boughtVsEvidence ?? null;
  const fB = fresh.reconciliation?.boughtVsEvidence ?? null;
  const boughtVsEvidence = !sB ? fB : (!fB ? sB : (storedWins ? sB : fB));

  const named = [...new Set([...(fresh.missingInputs || []), ...(stored.missingInputs || [])])];
  const keep = new Set(named.filter((n) => !n.startsWith('bars:') && !n.startsWith('price:')));
  const legGap = (symbol, leg, merged, sides) => {
    if (merged) for (const n of legNames(symbol, leg, merged, sides)) keep.add(n);
    else if (named.includes(`bars:${symbol}`)) keep.add(`bars:${symbol}`);
  };
  legGap(symbolOut, 'ghost', ghost, { s: sl.ghost, f: fl.ghost });
  legGap(symbolIn, 'bought', bought, { s: sl.bought, f: fl.bought });
  for (const [symbol, value] of Object.entries({ ...marketChangeAfter, ...sectorChangeAfter })) {
    if (isNum(value)) continue;
    const priced = named.filter((n) => n === `price:${symbol}@swap` || n === `price:${symbol}@close`);
    if (priced.length) priced.forEach((n) => keep.add(n));
    else if (named.includes(`bars:${symbol}`)) keep.add(`bars:${symbol}`);
  }
  const missingInputs = named.filter((n) => keep.has(n));
  const retry = new Set([...(fresh.retryableInputs || []), ...(stored.retryableInputs || [])]);
  const { preservedFrom: _earlier, ...base } = fresh;
  return {
    ...base,
    ghost: legs.ghost,
    bought: legs.bought,
    holdPath: legs.holdPath,
    swapPath: legs.swapPath,
    gapPoints: legs.gapPoints,
    reconciliation: { closedLegDelta: legs.closedLegDelta, boughtVsEvidence },
    marketChangeAfter,
    sectorChangeAfter,
    missingInputs,
    retryableInputs: missingInputs.filter((n) => retry.has(n)),
  };
}
