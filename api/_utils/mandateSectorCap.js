// api/_utils/mandateSectorCap.js
//
// Spec 1 — Mandate Substrate — the book's OWN sector-concentration cap (§3.4,
// O-5 / Q1). Q1 found the battle enforcer (`agentGuardrails.checkSectorCap`)
// private, tier/slot-coupled, and FAIL-OPEN — unsafe to reuse. This is a fresh,
// flat-map, FAIL-CLOSED implementation whose cap VALUE is read from the pinned
// vintage's gateConfig (D-44 / O-5), never from a live registry read.
//
// FORK-LEDGER DIVERGENCE (§8, accepted): the battle enforcer is tier-shaped; this
// is flat. The same archetype may exhibit different effective concentration in
// arena vs. book. They share cap VALUES via archetype config, not enforcement
// semantics — reconciled (if ever) at Spec 4 as a §7-gated battle-side event.
//
// FAIL-CLOSED for entries (C-21): if a BUY/ADD symbol's sector cannot be
// classified, the cap cannot be verified, so the entry is REFUSED. A null cap
// means the archetype is deliberately unlimited (a known "no cap", not missing
// data) and passes. Exits never reach this module (the exit lane precedes it).

/**
 * Sector → held USD value, from marked positions. A position with no sector
 * classification is bucketed under the sentinel `__unknown__` so unclassified
 * exposure is visible rather than silently ignored.
 */
export function sectorExposureUsd(positions = {}) {
  const out = {};
  for (const pos of Object.values(positions || {})) {
    const mark = Number.isFinite(pos.lastMark) ? pos.lastMark : null;
    const shares = Number.isFinite(pos.shares) ? pos.shares : 0;
    if (mark == null || shares <= 0) continue;
    const sector = pos.sector || '__unknown__';
    out[sector] = (out[sector] || 0) + shares * mark;
  }
  return out;
}

/**
 * Would adding `addUsd` of exposure to `sector` keep the sector at or under the
 * concentration cap? Fail-closed on an unknown sector for an entry.
 *
 * The exposure numerator MUST be the FRESH marked exposure (from
 * mandateValuation.markBook), NOT one recomputed from `pos.lastMark` — the
 * denominator `totalValue` is valued at the fresh snapshot, and mixing a
 * last-trade numerator with a fresh denominator understates concentration and
 * fails OPEN (the O-5/Q1 hazard, C-21 review C1).
 *
 * @param {object} args
 * @param {string|null} args.sector             the entry symbol's sector (daily snapshot only — no seed guess)
 * @param {number} args.addUsd                  dollars being added to that sector
 * @param {Object<string,number>} args.sectorExposureUsd  fresh sector→USD exposure (markBook)
 * @param {number} args.totalValue              book total value (fresh; the denominator)
 * @param {number|null} args.cap                gateConfig.sectorConcentrationCap (fraction 0..1) or null
 * @returns {{ rule:'sector_cap', passed:boolean, reason?:string, sector?, cap?, weightAfter? }}
 */
export function checkSectorCap({ sector, addUsd, sectorExposureUsd: exposure = {}, totalValue, cap }) {
  // Null cap → archetype is deliberately unlimited on sector concentration.
  if (cap == null) return { rule: 'sector_cap', passed: true, reason: 'no_cap', cap: null };

  // Fail-closed: an entry whose sector we cannot classify cannot be checked.
  if (!sector) return { rule: 'sector_cap', passed: false, reason: 'unknown_sector', cap };

  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    return { rule: 'sector_cap', passed: false, reason: 'no_total_value', cap };
  }

  const current = exposure[sector] || 0;
  const weightAfter = (current + Math.max(0, addUsd)) / totalValue;
  const passed = weightAfter <= cap + 1e-9; // tolerance for float noise
  return {
    rule: 'sector_cap',
    passed,
    reason: passed ? undefined : 'sector_cap_exceeded',
    sector,
    cap,
    weightAfter,
  };
}
