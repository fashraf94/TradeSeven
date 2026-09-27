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
// that COMPLETED at or before the instant (bars.js priceAt). A sample with no
// price is skipped, left null in its series and named in missingInputs.
//
// reconciliation.closedLegDelta = rebuilt ghost at the swap − lockedPoints:
// agreement AT THE SALE, stated as that and nothing more. boughtVsEvidence
// compares the rebuilt price of the bought name with the price the platform
// recorded in the first later evidence stamp that carries it.

import { calculateAssetScoreServer } from '../agentScoring.js';
import { STAGES } from '../tickCapture/captureConfig.js';
import { NON_CHECK_STATES } from '../../../src/constants/filmTape.js';
import { priceAt, pctChange } from './bars.js';
import { toMs } from './tapeTime.js';

export const REPLAY_LABEL = "one-step hypothetical through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle";
const SCORED_FROM = STAGES.indexOf('scores_marked');

const round2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const iso = (ms) => new Date(ms).toISOString();

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
function runLeg({ inputs, symbol, bars, samples }) {
  let history = { maxMultiplier: inputs.thresholdHistory.maxMultiplier, minMultiplier: inputs.thresholdHistory.minMultiplier };
  const asset = { symbol, baseATR: inputs.atr, tier: inputs.tier, direction: inputs.direction ?? null };
  const out = [];
  for (const s of samples) {
    const p = priceAt(bars, s.atMs);
    if (!p) { out.push({ ...s, points: null, missing: true }); continue; }
    const priceChange = ((p.price - inputs.entryPrice) / inputs.entryPrice) * 100;
    const base = inputs.thresholdBaseline.value;
    const thresholdPriceChange = ((p.price - base) / base) * 100;
    const r = calculateAssetScoreServer(asset, priceChange, history, {}, thresholdPriceChange);
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
 */
export function replayAction({ action, checks, barsBySymbol, session, sectors = {} }) {
  if (action.replayReason === 'crypto_not_supported') return null;
  const swapMs = toMs(action.at);
  const missingInputs = [...(action.replayMissing || [])];
  const inputs = action.replayInputs || { ghost: null, bought: null };
  const barsOut = barsBySymbol[action.symbolOut] || null;
  const barsIn = barsBySymbol[action.symbolIn] || null;
  if (!barsOut) missingInputs.push(`bars:${action.symbolOut}`);
  if (!barsIn) missingInputs.push(`bars:${action.symbolIn}`);

  const later = (checks || []).filter((c) => scoredCheck(c) && toMs(c.at) > swapMs && toMs(c.at) <= session.closeMs);
  const samples = [
    { kind: 'swap', tickSeq: Number.isInteger(action.tickSeq) ? action.tickSeq : null, atMs: swapMs },
    ...later.map((c) => ({ kind: 'check', tickSeq: Number.isInteger(c.tickSeq) ? c.tickSeq : null, atMs: toMs(c.at), key: c.key })),
    { kind: 'close', tickSeq: null, atMs: session.closeMs },
  ];

  const legOf = (legInputs, symbol, bars, name) => {
    if (!legInputs || !bars) return null;
    const run = runLeg({ inputs: legInputs, symbol, bars, samples });
    for (const s of run) if (s.missing) missingInputs.push(`price:${symbol}@${s.kind === 'check' ? (s.tickSeq ?? iso(s.atMs)) : s.kind}`);
    const at = (kind) => run.find((s) => s.kind === kind) ?? null;
    return {
      name,
      run,
      out: {
        atSwap: at('swap')?.points ?? null,
        atClose: at('close')?.points ?? null,
        series: run.filter((s) => s.kind === 'check').map((s) => ({ tickSeq: s.tickSeq, at: iso(s.atMs), points: s.points })),
      },
    };
  };
  const ghost = legOf(inputs.ghost, action.symbolOut, barsOut, 'ghost');
  const bought = legOf(inputs.bought, action.symbolIn, barsIn, 'bought');
  const locked = typeof action.lockedPoints === 'number' && Number.isFinite(action.lockedPoints) ? action.lockedPoints : null;
  if (locked === null) missingInputs.push('lockedPoints');

  const holdPath = ghost ? ghost.run.map((s) => ({ tickSeq: s.tickSeq, at: iso(s.atMs), points: s.points })) : null;
  const swapPath = bought && locked !== null
    ? bought.run.map((s) => ({ tickSeq: s.tickSeq, at: iso(s.atMs), points: s.points === null ? null : round2(locked + s.points) }))
    : null;
  const gapPoints = ghost && bought && locked !== null && ghost.out.atClose !== null && bought.out.atClose !== null
    ? round2((locked + bought.out.atClose) - ghost.out.atClose)
    : null;

  // Reconciliation — agreement at the sale, and the bought name against its first recorded evidence.
  const closedLegDelta = ghost && locked !== null && ghost.out.atSwap !== null ? round2(ghost.out.atSwap - locked) : null;
  let boughtVsEvidence = null;
  if (barsIn && inputs.bought) {
    const row = later.find((c) => c.evidence && c.evidence[action.symbolIn] && typeof c.evidence[action.symbolIn].px === 'number');
    const rebuilt = row ? priceAt(barsIn, toMs(row.at)) : null;
    if (row && rebuilt) {
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

  // Comparables from the swap to the close (market class — bars alone).
  const changeAfter = (sym) => {
    const bars = barsBySymbol[sym];
    if (!bars) { missingInputs.push(`bars:${sym}`); return null; }
    return pctChange(priceAt(bars, swapMs)?.price, priceAt(bars, session.closeMs)?.price);
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
  };
}
