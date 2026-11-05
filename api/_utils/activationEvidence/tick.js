// api/_utils/activationEvidence/tick.js
//
// ID-1 Build 2 — THE ACTIVATING TICK (contract §4 `activatingTick`, ruling
// Q-ID1-8; §4.2 the tick grace).
//
// A swap-in's activating tick is read from the battle's PERMANENT tick records
// (agentBattles/{id}/ticks/{tickId}: tickSeq, evalId, actions[]; one actions[]
// entry per committed executor result, captureContext.js `action`), joined to
// the trade row on the tape's own swap key (swappedOutAt, symbolOut, symbolIn;
// tapeAssemble.js swapKey): the raw strings, compared exactly, as the tape
// compares them. This holds for model executions and proposal executions alike.
// The row's `eval_NNN` never names the tick (no committed field says which path wrote
// it): tickSeq and evalId come from the tick record only. The row's evaluationId is
// carried, unparsed, as `activatingTick.evaluationId` (the §4.5 example's placeholder,
// the same as tradeRef's) and is null when the join is unavailable.
//
//   exactly one committed swap action matches          → tick_action
//   two or more match                                   → unavailable, counted ambiguous
//   none, read complete, within the grace (not final)   → defer (trades and ticks commit apart)
//   none, read complete, after the grace or at final    → unavailable
//   none or one, read INCOMPLETE (failed, truncated)    → defer, counted tick_read_incomplete,
//                                                         at finalisation too: a partial read
//                                                         cannot show there is none, or only one
//
// Tick documents carry `capturedAt` (captureWriter.js), a single-field range the
// tape already queries (tapeSources.js readDayTicks), so a battle's tick read is
// bounded to the windows [swappedOutAt − grace, swappedOutAt + grace] of its
// unwritten swap-ins, merged.
//
// Pure: the instants are the caller's.

import { TICK_GRACE_MS } from './constants.js';
import { instantMsOf, isoOf } from './lifetimes.js';

/** The record for a swap-in whose tick could not be joined (contract §4.5). */
export const UNAVAILABLE_TICK = Object.freeze({ tickSeq: null, evalId: null, evaluationId: null, source: 'unavailable' });

/** A committed swap action as captureContext.js records it. */
const isCommittedSwap = (a) => a !== null && typeof a === 'object' && a.kind === 'swap' && a.committed === true;

/**
 * The capturedAt windows to read for a battle's unwritten swap-ins, merged and ordered.
 * @param {Array<{ row: { swappedOutAt: string } }>} swapIns
 * @returns {Array<{ startIso: string, endIso: string }>} inclusive bounds
 */
export function tickWindowsOf(swapIns, graceMs = TICK_GRACE_MS) {
  const spans = [];
  for (const a of swapIns) {
    const ms = instantMsOf(a?.row?.swappedOutAt);
    if (ms !== null) spans.push([Math.max(0, ms - graceMs), ms + graceMs]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  return merged.map(([a, b]) => ({ startIso: isoOf(a), endIso: isoOf(b) }));
}

/**
 * The join for one swap-in.
 *
 * @param {{ row: { swappedOutAt, symbolOut, symbolIn, evaluationId } }} activation
 * @param {{ complete: boolean, ticks: Array<{ tickSeq, evalId, actions }> }} tickRead the battle's tick read this run
 * @param {{ nowMs: number, finalizing: boolean }} when
 * @returns {{ outcome: 'tick_action' | 'unavailable', ambiguous: boolean, activatingTick: object }
 *   | { outcome: 'defer', reason: 'tick_grace' | 'tick_read_incomplete' }}
 */
export function joinTick(activation, tickRead, { nowMs, finalizing = false }) {
  const row = activation.row;
  const matches = [];
  for (const tick of Array.isArray(tickRead?.ticks) ? tickRead.ticks : []) {
    for (const a of Array.isArray(tick?.actions) ? tick.actions : []) {
      if (isCommittedSwap(a) && a.swappedOutAt === row.swappedOutAt && a.symbolOut === row.symbolOut && a.symbolIn === row.symbolIn) matches.push(tick);
    }
  }
  if (matches.length > 1) return { outcome: 'unavailable', ambiguous: true, activatingTick: { ...UNAVAILABLE_TICK } };
  if (tickRead?.complete !== true) return { outcome: 'defer', reason: 'tick_read_incomplete' };
  if (matches.length === 1) {
    const t = matches[0];
    // A matched tick with no sequence cannot name itself (captureContext.js refuses one, so this is defence only).
    // A null evalId is honest and kept: a risk-manager action in a tick that exited before it identified an
    // evaluation (review V3 on L3-5).
    if (!Number.isFinite(t.tickSeq)) return { outcome: 'unavailable', ambiguous: false, malformed: true, activatingTick: { ...UNAVAILABLE_TICK } };
    return {
      outcome: 'tick_action',
      ambiguous: false,
      activatingTick: {
        tickSeq: t.tickSeq,
        evalId: typeof t.evalId === 'string' && t.evalId ? t.evalId : null,
        evaluationId: row.evaluationId ?? null,
        source: 'tick_action',
      },
    };
  }
  const at = instantMsOf(row.swappedOutAt);
  if (!finalizing && (at === null || nowMs < at + TICK_GRACE_MS)) return { outcome: 'defer', reason: 'tick_grace' };
  return { outcome: 'unavailable', ambiguous: false, activatingTick: { ...UNAVAILABLE_TICK } };
}
