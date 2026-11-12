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
//
// UNITS (T0a, concept V6.1 ruling 25; Astra C5-05 / B5): the archetype table's
// `sectorConcentrationCap` is a COUNT of the battle's six equal picks ("at most
// N of 6 in one sector" — the meaning agentGuardrails.js:69–83 divides by
// AGENT_PICKS_PER_AGENT). The book's gate compares a FRACTION of book value.
// Spec 1 copied the count straight into the frozen gate config, so a count of 3
// read as 300% and never bound. The count is now translated ONCE, at vintage
// construction (mandateVintage.buildVintagePayload), and the vintage records
// the source count, the denominator, the fraction and the conversion version.
// This is an explicit translation from an equal-slot policy into a dollar
// policy; it is NOT equivalent for unequal holdings. The fenced table is not
// touched and keeps its game meaning.

/** Version of the slot-count → book-share translation stamped on every vintage. */
export const SECTOR_CAP_CONVERSION_VERSION = 1;

/**
 * The denominator of the source policy: the battle's six equal picks
 * (AGENT_PICKS_PER_AGENT, src/constants/leagueTournament.js). Held as a local
 * constant (no api→src runtime import); a test binds the two.
 */
export const SECTOR_CAP_SLOT_DENOMINATOR = 6;

/** Typed refusal for a book whose pinned vintage predates the translation. */
export const VINTAGE_UNCORRECTED = 'vintage_uncorrected';

/**
 * Translate the archetype's sector slot count into the book's gate fields.
 * Mapping: 2 → 1/3, 3 → 1/2, 4 → 2/3 (any integer 1..6 → n/6). `null` stays
 * `null` ("no sector cap", only where the archetype table carries no count).
 * Anything else (0, negative, non-integer, above 6, a non-number) is a
 * construction error — fail closed, no vintage is built.
 *
 * @param {number|null} slots  physics.sectorConcentrationCap from the registry
 * @returns {{ sectorCapSlots:number|null, sectorCapDenominator:number,
 *             sectorConcentrationCap:number|null, sectorCapConversionVersion:number }}
 */
export function translateSectorCapSlots(slots) {
  if (slots !== null
    && !(Number.isInteger(slots) && slots >= 1 && slots <= SECTOR_CAP_SLOT_DENOMINATOR)) {
    throw new Error(
      `translateSectorCapSlots: malformed sector-cap slot count ${String(slots)} — `
      + `expected an integer 1..${SECTOR_CAP_SLOT_DENOMINATOR} or null`,
    );
  }
  return {
    sectorCapSlots: slots,
    sectorCapDenominator: SECTOR_CAP_SLOT_DENOMINATOR,
    sectorConcentrationCap: slots === null ? null : slots / SECTOR_CAP_SLOT_DENOMINATOR,
    sectorCapConversionVersion: SECTOR_CAP_CONVERSION_VERSION,
  };
}

/** A usable cap: null (no cap) or a finite fraction in (0, 1]. */
export function isValidSectorCapFraction(cap) {
  return cap === null || (typeof cap === 'number' && Number.isFinite(cap) && cap > 0 && cap <= 1);
}

/**
 * Admission check for a pinned vintage's gate config: true only when it carries
 * the current translation stamp. A vintage built before T0a lacks it and is
 * refused (VINTAGE_UNCORRECTED) wherever a book resolves its vintage. Published
 * vintages are immutable; a corrected vintage is a new one with a new hash.
 */
export function isSectorCapCorrected(gateConfig) {
  return !!gateConfig && gateConfig.sectorCapConversionVersion === SECTOR_CAP_CONVERSION_VERSION;
}

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
 * @param {number|null} args.cap                gateConfig.sectorConcentrationCap (fraction in (0, 1]) or null
 * @returns {{ rule:'sector_cap', passed:boolean, reason?:string, sector?, cap?, weightAfter? }}
 */
export function checkSectorCap({ sector, addUsd, sectorExposureUsd: exposure = {}, totalValue, cap }) {
  // Null cap → archetype is deliberately unlimited on sector concentration.
  // Strictly null: a MISSING cap (undefined) is malformed, not "no cap".
  if (cap === null) return { rule: 'sector_cap', passed: true, reason: 'no_cap', cap: null };

  // Fail-closed on a cap that is not a fraction in (0, 1] — e.g. an untranslated
  // slot count (2–4), which would otherwise read as 200–400% and never bind.
  if (!isValidSectorCapFraction(cap)) return { rule: 'sector_cap', passed: false, reason: 'malformed_cap', cap };

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
