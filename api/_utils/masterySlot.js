// api/_utils/masterySlot.js
// Archetype Mastery — the slot system (Spec V2 §3; V2.1 memo of record:
// docs/ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md).
//
// PURE MODULE, ZERO IMPORTS — no Firestore, no clocks. A battle's daily-rate
// band is a pure function of immutable creation data (createdAt, battleId,
// ownerId, agentContext.archetype — all server-authored, client-write-denied
// per firestore.rules agentBattles hasOnly allowlist). No allocator exists:
// no counter, no assignment transaction. The first verified stamp
// (masterySlot) is AUTHORITATIVE once written; recomputation is diagnostic
// only (spec §3 authority inversion).
//
// Phase 0 finding S11.5 (ARCHETYPE_MASTERY_PHASE0_DISCOVERY_20260720.md):
// there is NO server-monotone creation key — createdAt is the API server's
// wall clock and battleId is a random Firestore auto-id — so the
// same-millisecond insertion edge is live at the source. This module's
// ordering is therefore deterministic-but-not-wall-clock-perfect:
// (createdAt, battleId) lexicographic. The stamp authority + duplicate-rank
// audit (routed to the corrections ledger) absorb the edge, per spec §3.

// Day boundary: America/New_York, server-computed, immutable (spec §4).
// Intl-based per BUILD_RULES §6 — never hand-rolled offsets. 'en-CA' yields
// ISO YYYY-MM-DD directly.
const NY_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Rate bands by slot rank (spec §3): 1–3 → 1.0 · 4–6 → 0.5 · 7+ → 0.
// Module-local: rateBandForRank IS the public contract (dead exports read
// as API surface the recalibration work can't see via the suite).
const RATE_BAND_FULL = 1.0;
const RATE_BAND_HALF = 0.5;
const RATE_BAND_ZERO = 0;

/**
 * America/New_York calendar date ('YYYY-MM-DD') of an ISO instant.
 * Returns null for missing/unparseable input (callers fail closed).
 */
export function deriveSlotDate(createdAtIso) {
  if (typeof createdAtIso !== 'string' || createdAtIso.length === 0) return null;
  const ms = Date.parse(createdAtIso);
  if (Number.isNaN(ms)) return null;
  return NY_DATE_FORMATTER.format(new Date(ms));
}

/**
 * Total order over creation keys: (createdAt, battleId) lexicographic.
 * createdAt values are fixed-width toISOString() strings (agentBattleService
 * :57/:114), so string comparison IS chronological comparison; battleId
 * breaks exact-string ties deterministically.
 */
export function compareCreationKey(a, b) {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.battleId < b.battleId) return -1;
  if (a.battleId > b.battleId) return 1;
  return 0;
}

/** rank → rate band. Fail-closed: anything but a positive integer earns 0. */
export function rateBandForRank(rank) {
  if (!Number.isInteger(rank) || rank < 1) return RATE_BAND_ZERO;
  if (rank <= 3) return RATE_BAND_FULL;
  if (rank <= 6) return RATE_BAND_HALF;
  return RATE_BAND_ZERO;
}

/**
 * Derive the slot rank of `target` among `cohort` (spec §3):
 *
 *   slotRank = 1 + |{ same-user, same-archetype battles b on slotDate :
 *                     (b.createdAt, b.battleId) < (target.createdAt, target.battleId) }|
 *
 * `cohort` is the same-owner, same-archetype candidate set (the widened
 * createdAt-range query — see widenedQueryBounds); this function applies the
 * EXACT slotDate filter itself with the same deriveSlotDate used to compute
 * the target's date, so the filter and the stamp can never disagree
 * (BUILD_RULES §9 one-source-by-construction).
 *
 * @param {{battleId: string, createdAt: string}} target
 * @param {Array<{battleId: string, createdAt: string}>} cohort - may include target; excluded by battleId
 * @returns {{slotDate: string, rank: number}|null} null when target's createdAt is unusable (fail closed)
 */
export function deriveSlotRank(target, cohort) {
  const slotDate = deriveSlotDate(target?.createdAt);
  if (slotDate === null || typeof target?.battleId !== 'string' || target.battleId.length === 0) {
    return null;
  }
  let before = 0;
  for (const c of Array.isArray(cohort) ? cohort : []) {
    if (!c || c.battleId === target.battleId) continue;
    if (deriveSlotDate(c.createdAt) !== slotDate) continue;
    if (compareCreationKey(c, target) < 0) before += 1;
  }
  return { slotDate, rank: 1 + before };
}

/**
 * The write-once masterySlot stamp shape (spec §3):
 * { date, rank, rateBand, assignedAt } — authoritative once written.
 */
export function buildSlotStamp({ slotDate, rank, assignedAt }) {
  return {
    date: slotDate,
    rank,
    rateBand: rateBandForRank(rank),
    assignedAt,
  };
}

/**
 * Widened UTC ISO bounds for the createdAt range query that fetches a slot
 * cohort. The NY day D lies strictly inside [D 00:00Z, D+2 00:00Z) for every
 * UTC offset NY can have (-4/-5), so the range over-fetches by design and
 * deriveSlotRank's exact filter (same deriveSlotDate) trims it — DST-proof by
 * construction, no offset math on the query boundary itself.
 */
export function widenedQueryBounds(slotDate) {
  const startMs = Date.parse(`${slotDate}T00:00:00.000Z`);
  if (Number.isNaN(startMs)) return null;
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + TWO_DAYS_MS).toISOString(),
  };
}

/**
 * Duplicate-rank audit (spec §3): a stamped sibling already holding this
 * (date, rank) pair. The stamp still stands (authority inversion — no
 * retro-shift); the pair routes to the corrections ledger as an audit event.
 * Returns the first colliding sibling or null.
 */
export function findDuplicateRank({ slotDate, rank, cohortDocs, selfBattleId }) {
  for (const d of Array.isArray(cohortDocs) ? cohortDocs : []) {
    if (!d || d.battleId === selfBattleId) continue;
    const stamp = d.masterySlot;
    if (stamp && stamp.date === slotDate && stamp.rank === rank) return d;
  }
  return null;
}
