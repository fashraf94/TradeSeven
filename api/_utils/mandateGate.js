// api/_utils/mandateGate.js
//
// Spec 1 — Mandate Substrate — the DETERMINISTIC GATE (§3.4). Runs AFTER the
// model, BEFORE execution. Gate order encodes C-21 (risk lines preempt advisory,
// fail-closed for entries and for acting on bad data, NEVER suppress exits on
// fresh data):
//
//   1. Universe check   — BUY/ADD ticker must be present-and-complete in the tick
//                          snapshot (§3.0/F16), else `gated`.
//   2. Exit lane (F9,I2)— SELL/TRIM bypass every entry gate. They are never
//                          blocked by minimum-position count, diversification, or
//                          the book's quarantine status; a SELL/TRIM on a held
//                          symbol whose OWN mark is fresh always passes. A held
//                          symbol whose mark is stale defers (carry-over) — it is
//                          never SUPPRESSED, it clears the next fresh tick.
//   3. Entry gates      — cash-floor sizing (§4.1 "sized down to fit"), then the
//                          §3.4.3 hard gates in listed order: sector cap
//                          (mandateSectorCap, fail-closed, cap from the pinned
//                          vintage), max single-position weight, max position count.
//   4. Bootstrap ramp   — the minimum-position target (5) is a CONSTRUCTION target,
//                          not an entry precondition (F9). Below target the book is
//                          `bootstrapping` (surfaced for the prompt); it never
//                          converts a BUY to HOLD and never blocks a SELL.
//
// READING NOTE (flagged in the PR): cash-floor is applied as a size-to-fit clamp
// (§4.1's "a BUY is sized down to fit available cash"), a HARD gate only at zero
// room; sector cap and weight cap are hard rejections. Sizing necessarily
// precedes the concentration checks (they need the executable add size).

import { markBook, positionMarketValue } from './mandateValuation.js';
import { isSymbolActionable } from './mandateUniverseSnapshot.js';
import { checkSectorCap } from './mandateSectorCap.js';
import { EXIT_VERBS, ENTRY_VERBS } from './mandateDecisionTool.js';

const EPS = 1e-9;

function outcome(passed, rule, extra = {}) {
  return { passed, rule, gateOutcome: { rule, passed }, ...extra };
}

/**
 * Evaluate the deterministic gate for one decision.
 *
 * @param {object} args
 * @param {{verb, ticker, sizeUsd}} args.decision   normalized decision
 * @param {object} args.positions                   book positions
 * @param {number} args.cash                         book cash
 * @param {object} args.snapshot                     tick snapshot (§3.0)
 * @param {object} args.gateConfig                   pinned-vintage gateConfig (D-44/O-5)
 * @param {Set<string>} [args.actionableHeld]        held symbols with a fresh mark (I2)
 * @returns {{
 *   passed:boolean, rule:string, gateOutcome:{rule,passed}, reason?:string,
 *   execSizeUsd?:number|null, clamped?:boolean, bootstrapping:boolean,
 *   sector?:string, cap?:number, weightAfter?:number, deferred?:boolean,
 * }}
 */
export function evaluateGate({ decision, positions = {}, cash = 0, snapshot = null, gateConfig = {}, actionableHeld = null }) {
  const verb = decision?.verb;
  const ticker = decision?.ticker;

  const { marked, totalValue, sectorExposureUsd } = markBook(positions, cash, snapshot);
  const held = new Set(Object.keys(marked));
  const positionCount = held.size;
  const bootstrapping = positionCount < (gateConfig.minPositions ?? 0);

  // HOLD — always passes; no execution.
  if (verb === 'HOLD') return outcome(true, 'hold', { execSizeUsd: null, clamped: false, bootstrapping });

  // ── 2. EXIT LANE (before entry gates; C-21) ──────────────────────────────
  // C-21 constitutional: an exit is NEVER suppressed, and no exit-suppressing
  // state may be INDEFINITE. A SELL/TRIM on a held symbol therefore ALWAYS passes
  // the gate regardless of its mark's freshness or the book's state — the
  // executor fills at the fresh mark when available, else the last-good
  // (carry-over) mark (§4.3 "exit... at last good mark"). `actionableHeld`
  // freshness is informational only (it labels positions in the prompt); it never
  // blocks or defers an exit here. (Automated corporate-action forced-close is P3;
  // this keeps the manager-initiated exit path unblocked in the meantime.)
  if (EXIT_VERBS.includes(verb)) {
    if (!held.has(ticker)) {
      return outcome(false, 'exit_lane', { reason: 'not_held', bootstrapping });
    }
    const fresh = actionableHeld ? actionableHeld.has(ticker) : true;
    // SELL = full exit (size derived from holdings at execution); TRIM carries a
    // dollar size, clamped to held shares at execution.
    const execSizeUsd = verb === 'TRIM' ? decision.sizeUsd : null;
    return outcome(true, 'exit_lane', { execSizeUsd, clamped: false, bootstrapping, freshMark: fresh });
  }

  // ── ENTRY VERBS (BUY / ADD) ──────────────────────────────────────────────
  if (!ENTRY_VERBS.includes(verb)) {
    return outcome(false, 'unknown_verb', { reason: 'unknown_verb', bootstrapping });
  }

  // 1. Universe check.
  if (!isSymbolActionable(snapshot, ticker)) {
    return outcome(false, 'universe', { reason: 'not_in_snapshot', bootstrapping });
  }

  const isHeld = held.has(ticker);

  // 3a. Cash-floor sizing (§4.1). Hard gate only when there is zero room.
  const floorReserve = (gateConfig.cashFloorPct ?? 0) * totalValue;
  const spendable = cash - floorReserve;
  if (spendable <= 0) {
    return outcome(false, 'cash_floor', { reason: 'below_cash_floor', bootstrapping });
  }
  let execSizeUsd = Math.min(decision.sizeUsd, spendable);
  let clamped = execSizeUsd < decision.sizeUsd - EPS;

  // 3b. Sector cap (fail-closed) — §3.4.3 first hard gate. Sector comes from the
  // DAILY snapshot ONLY (one taxonomy, shared with how held positions were
  // bucketed). No seed-map guess here: an unclassified entry must fail CLOSED, not
  // be waved through on a guessed sector (C-21 review C4). Exposure is the FRESH
  // marked exposure from markBook, never a stale-lastMark recompute (C1).
  const sector = snapshot?.symbols?.[ticker]?.sector ?? null;
  const capRes = checkSectorCap({ sector, addUsd: execSizeUsd, sectorExposureUsd, totalValue, cap: gateConfig.sectorConcentrationCap });
  if (!capRes.passed) {
    return outcome(false, 'sector_cap', { reason: capRes.reason, sector: capRes.sector, cap: capRes.cap, weightAfter: capRes.weightAfter, bootstrapping });
  }

  // 3c. Max single-position weight.
  const currentPosValue = positionMarketValue(marked, ticker);
  const weightAfter = (currentPosValue + execSizeUsd) / totalValue;
  if (weightAfter > (gateConfig.maxSinglePositionWeightPct ?? Infinity) + EPS) {
    return outcome(false, 'max_single_position_weight', { reason: 'weight_cap_exceeded', weightAfter, cap: gateConfig.maxSinglePositionWeightPct, bootstrapping });
  }

  // 3d. Max position count — only a NEW ticker adds a position.
  if (!isHeld && positionCount >= (gateConfig.maxPositions ?? Infinity)) {
    return outcome(false, 'max_positions', { reason: 'position_cap_reached', bootstrapping });
  }

  // Pass. (Bootstrap ramp never gates — it is informational for the prompt.)
  return outcome(true, isHeld ? 'add' : 'buy', { execSizeUsd, clamped, bootstrapping });
}
