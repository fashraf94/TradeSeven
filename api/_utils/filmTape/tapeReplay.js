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

import { calculateAssetScoreServer } from '../agentScoring.js';
import { STAGES } from '../tickCapture/captureConfig.js';
import { NON_CHECK_STATES } from '../../../src/constants/filmTape.js';
import { sampleAt, sampleCanExist, pctChange } from './bars.js';
import { toMs } from './tapeTime.js';

export const REPLAY_LABEL = "one-step hypothetical through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle";
const SCORED_FROM = STAGES.indexOf('scores_marked');

const round2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const iso = (ms) => new Date(ms).toISOString();
/** A sample on a path: its points, and — when no fresh price stood for it — the stale bar's close time beside the null (BA-24). */
const point = (s) => ({ tickSeq: s.tickSeq, at: iso(s.atMs), points: s.points, ...(s.missing && s.staleBarClosedAt !== null ? { barClosedAt: iso(s.staleBarClosedAt) } : {}) });

/** Did this check's tick score the book (so the live history ratcheted)? */
export function scoredCheck(row) {
  if (!row || NON_CHECK_STATES.includes(row.state) || toMs(row.at) === null) return false;
  if (row.rowSource === 'entry') return true; // an entry is written only on the full path
  const idx = STAGES.indexOf(row.stageReached);
  return idx >= SCORED_FROM;
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
  const ownSeq = Number.isInteger(action.tickSeq) ? action.tickSeq : null;
  const later = (checks || []).filter((c) => scoredCheck(c) && toMs(c.at) > swapMs && toMs(c.at) <= session.closeMs
    && !(ownSeq !== null && c.tickSeq === ownSeq));
  const samples = [
    { kind: 'swap', tickSeq: Number.isInteger(action.tickSeq) ? action.tickSeq : null, atMs: swapMs },
    ...later.map((c) => ({ kind: 'check', tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, atMs: toMs(c.at), key: c.key })),
    { kind: 'close', tickSeq: null, atMs: session.closeMs },
  ];

  const legOf = (legInputs, symbol, bars, name, legSamples) => {
    if (!legInputs || !bars) return null;
    const run = runLeg({ inputs: legInputs, symbol, bars, samples: legSamples, tierStamp });
    for (const s of run) if (s.missing) missSample(`price:${symbol}@${s.kind === 'check' ? (s.tickSeq ?? iso(s.atMs)) : s.kind}`, s.atMs);
    const at = (kind) => run.find((s) => s.kind === kind) ?? null;
    return {
      name,
      run,
      out: {
        ...(name === 'ghost' ? { atSwap: at('swap')?.points ?? null } : {}),
        atClose: at('close')?.points ?? null,
        series: run.filter((s) => s.kind === 'check').map(point),
      },
    };
  };
  // The sold name is sampled AT the swap too (its standing at the sale is the
  // reconciliation's subject). The bought name is scored FROM the swap: its
  // samples are the later checks and the close only — the last minute that
  // completed before the swap is a price from before it was bought, and
  // scoring it against the fill could ratchet a badge the live position never
  // saw (review L2-F2; BA-11, §6 "each later check's … price and at the close").
  const ghost = legOf(inputs.ghost, action.symbolOut, barsOut, 'ghost', samples);
  const bought = legOf(inputs.bought, action.symbolIn, barsIn, 'bought', samples.filter((smp) => smp.kind !== 'swap'));
  const locked = typeof action.lockedPoints === 'number' && Number.isFinite(action.lockedPoints) ? action.lockedPoints : null;
  if (locked === null) missingInputs.push('lockedPoints');

  const holdPath = ghost ? ghost.run.map(point) : null;
  // The swap path opens AT the sale with exactly what the sale banked.
  const swapPath = bought && locked !== null
    ? [
      { tickSeq: samples[0].tickSeq, at: iso(samples[0].atMs), points: locked },
      ...bought.run.map((s) => ({ ...point(s), points: s.points === null ? null : round2(locked + s.points) })),
    ]
    : null;
  const gapPoints = ghost && bought && locked !== null && ghost.out.atClose !== null && bought.out.atClose !== null
    ? round2((locked + bought.out.atClose) - ghost.out.atClose)
    : null;

  // Reconciliation — agreement at the sale, and the bought name against its first recorded evidence.
  const closedLegDelta = ghost && locked !== null && ghost.out.atSwap !== null ? round2(ghost.out.atSwap - locked) : null;
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
    ghost: ghost ? ghost.out : null,
    bought: bought ? bought.out : null,
    holdPath,
    swapPath,
    gapPoints,
    reconciliation: { closedLegDelta, boughtVsEvidence },
    marketChangeAfter,
    sectorChangeAfter,
    missingInputs: [...new Set(missingInputs)],
    retryableInputs: [...new Set(retryableInputs)],
  };
}
