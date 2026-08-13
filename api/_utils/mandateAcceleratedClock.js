// api/_utils/mandateAcceleratedClock.js
//
// Spec 1 — Mandate Substrate — the ACCELERATED-CLOCK HARNESS (§9 acceptance
// item 5, P4). Founder/dev machinery — NOT a scratch script. It drives the REAL
// lifecycle cores (createMandate → rollOneBoundary / catchUpBook / escapeMandate)
// with fast-forwarded clocks by BACKDATING creation, so a boundary that would
// take three months lands in the past and the sweep processes it now. It is the
// machinery the §9 acceptance run uses to demonstrate, end to end:
//   • a full rollover with capital carried forward and the quarter lens reset;
//   • the FR-1 assertion OBSERVED FIRING on an injected violation;
//   • a two-boundary catch-up with per-boundary summaries incl. an empty:true;
//   • an escape-hatch exercise resetting to MANDATE_STARTING_CAPITAL, voided:true,
//     a non-scoring summary, and the once-ever flag.
//
// It is exposed for invocation by the founder-gated dark endpoint
// api/mandate/accelerate.js (MANDATE_FOUNDER_CREATE_ENABLED + allowlist). Every
// scenario takes an injected `db` (real dark db in production; the
// transaction-faithful fake in tests) and a `now`, and returns structured
// OBSERVATIONS the acceptance run asserts on — it never asserts internally.

import { createMandate } from './mandateCreationService.js';
import { rollOneBoundary, catchUpBook } from './mandateRollover.js';
import { escapeMandate } from './mandateEscape.js';
import { buildDailyRow } from './mandateSchema.js';
import { MANDATE_STARTING_CAPITAL } from './mandateConfig.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

const SCENARIOS = Object.freeze(['full_rollover', 'fr1_violation', 'two_boundary_catchup', 'escape']);
export function acceleratedScenarios() { return [...SCENARIOS]; }

/**
 * Create a book whose createdAt is `ageMs` in the past, so its normalized
 * boundary sits `ageMs − 3mo` in the past (a boundary can be processed "now").
 * Returns { mandateId, mandateRef, book }.
 */
async function createBackdatedBook(db, { userId, archetype, now, ageMs }) {
  const createdAt = new Date(now.getTime() - ageMs);
  const r = await createMandate(db, { userId, archetype, now: createdAt });
  if (!r.ok) throw new Error(`accelerated: createMandate failed (${r.code || 'unknown'}) for ${userId}`);
  const mandateRef = db.collection('mandates').doc(r.mandateId);
  const book = (await mandateRef.get()).data();
  return { mandateId: r.mandateId, mandateRef, book };
}

/** Seed synthetic dailyRows for a quarter (the close pass writes these for real). */
async function seedSyntheticRows(db, mandateId, quarterIndex, rows) {
  const col = db.collection('mandates').doc(mandateId).collection('dailyRows');
  for (const r of rows) {
    await col.doc(r.date).set(buildDailyRow({ quarterIndex, ...r }));
  }
}

/** A tiny synthetic tenure: an opening (partial creation-day) row and a closing row. */
function tenureRows(startDate, endDate, opening, closing) {
  return [
    { date: startDate, totalValue: opening, dayReturnPct: null, partial: true, regime: 'risk_on', agencyState: 'full' },
    { date: endDate, totalValue: closing, dayReturnPct: (closing - opening) / opening, regime: 'neutral', agencyState: 'full', dayFrictionPaid: 250, dividendIncomeUsd: 1200 },
  ];
}

// ── Scenario A: full rollover ────────────────────────────────────────────────
export async function simulateFullRollover(db, { userId, archetype = 'analyst', now = new Date() } = {}) {
  const { mandateId, mandateRef } = await createBackdatedBook(db, { userId, archetype, now, ageMs: 3 * MONTH_MS + 15 * DAY_MS });
  await seedSyntheticRows(db, mandateId, 1, tenureRows('2026-05-01', '2026-05-20', MANDATE_STARTING_CAPITAL, 10_600_000));

  const before = (await mandateRef.get()).data();
  const preTotalValue = before.portfolio.totalValue;
  const result = await rollOneBoundary(db, mandateRef, { now });
  const after = (await mandateRef.get()).data();
  const summary = (await mandateRef.collection('quarterSummaries').doc('1').get()).data();

  return {
    scenario: 'full_rollover', ok: !!result.rolled, mandateId,
    observations: {
      capitalCarried: after.portfolio.totalValue === preTotalValue, // FR-1
      preTotalValue, postTotalValue: after.portfolio.totalValue,
      quarterIndexBefore: before.quarterIndex, quarterIndexAfter: after.quarterIndex,
      quarterLensReset: after.portfolio.quarterHighWaterMark === preTotalValue && after.portfolio.quarterDrawdownFromPeak === 0,
      lifetimeLensUntouched: after.portfolio.lifetimeHighWaterMark === before.portfolio.lifetimeHighWaterMark,
      // The re-pin ran (publishVintage + Risk-3 assert-exists); content-addressed,
      // so it resolves to a valid published ref (equal to creation's when the
      // composition is unchanged — the common case).
      vintageRef: after.vintageRef,
      vintageResolves: /^archetypeVintages\/.+_.+$/.test(after.vintageRef),
      cadenceRecomputed: after.cadenceTier,
      summaryDerivedFromRows: !!summary && summary.empty === false && summary.openingValue === MANDATE_STARTING_CAPITAL,
      summaryScoring: summary?.scoring,
    },
  };
}

// ── Scenario B: FR-1 assertion firing on an injected violation ────────────────
export async function simulateFr1Violation(db, { userId, archetype = 'analyst', now = new Date() } = {}) {
  const { mandateId, mandateRef } = await createBackdatedBook(db, { userId, archetype, now, ageMs: 3 * MONTH_MS + 15 * DAY_MS });
  await seedSyntheticRows(db, mandateId, 1, tenureRows('2026-05-01', '2026-05-20', MANDATE_STARTING_CAPITAL, 10_100_000));

  const before = (await mandateRef.get()).data();
  let fired = false;
  let message = null;
  try {
    // Inject a capital mutation the correct rollover never does — the FR-1
    // assertion must abort the transaction.
    await rollOneBoundary(db, mandateRef, { now, patchMutator: (p) => ({ ...p, 'portfolio.totalValue': 1 }) });
  } catch (err) {
    fired = /FR-1 violation/.test(err.message);
    message = err.message;
  }
  const after = (await mandateRef.get()).data();

  return {
    scenario: 'fr1_violation', ok: fired, mandateId,
    observations: {
      assertionFired: fired,
      message,
      transactionAborted: after.quarterIndex === before.quarterIndex && after.portfolio.totalValue === before.portfolio.totalValue,
      noSummaryWritten: (await mandateRef.collection('quarterSummaries').doc('1').get()).exists === false,
    },
  };
}

// ── Scenario C: two-boundary catch-up with an empty quarter ───────────────────
export async function simulateTwoBoundaryCatchup(db, { userId, archetype = 'analyst', now = new Date() } = {}) {
  // Backdate ~7 months so TWO boundaries are already past. Only quarter 1 gets
  // rows; quarter 2's range is empty → empty:true (never fabricated).
  const { mandateId, mandateRef } = await createBackdatedBook(db, { userId, archetype, now, ageMs: 7 * MONTH_MS });
  await seedSyntheticRows(db, mandateId, 1, tenureRows('2026-02-01', '2026-02-20', MANDATE_STARTING_CAPITAL, 10_300_000));

  const before = (await mandateRef.get()).data();
  const { processed, boundaries } = await catchUpBook(db, mandateRef, { now });
  const after = (await mandateRef.get()).data();
  const s1 = (await mandateRef.collection('quarterSummaries').doc('1').get()).data();
  const s2 = (await mandateRef.collection('quarterSummaries').doc('2').get()).data();

  return {
    scenario: 'two_boundary_catchup', ok: boundaries >= 2, mandateId,
    observations: {
      boundariesProcessed: boundaries,
      oldestFirst: processed[0]?.oldQuarterIndex === 1,
      capitalCarried: after.portfolio.totalValue === before.portfolio.totalValue, // FR-1 across every boundary
      quarterIndexAfter: after.quarterIndex,
      summary1Empty: s1?.empty,      // false — quarter 1 had rows
      summary2Empty: s2?.empty,      // true — quarter 2 had none (never fabricated)
      caughtUp: after.nextRolloverAt.getTime() > now.getTime(),
    },
  };
}

// ── Scenario D: escape hatch ─────────────────────────────────────────────────
export async function simulateEscape(db, { userId, archetype = 'analyst', replacementArchetype = 'contrarian', now = new Date() } = {}) {
  // Backdate 3 days so the book is inside its 14-day escape window at `now`.
  const { mandateId: oldId } = await createBackdatedBook(db, { userId, archetype, now, ageMs: 3 * DAY_MS });
  await seedSyntheticRows(db, oldId, 1, tenureRows('2026-06-01', '2026-06-05', MANDATE_STARTING_CAPITAL, 9_700_000));

  const result = await escapeMandate(db, { userId, archetype: replacementArchetype, now, requestKey: `accel_escape_${userId}` });
  const old = (await db.collection('mandates').doc(oldId).get()).data();
  const nb = result.ok ? (await db.collection('mandates').doc(result.newMandateId).get()).data() : null;
  const summary = (await db.collection('mandates').doc(oldId).collection('quarterSummaries').doc('1').get()).data();
  const meta = (await db.collection('userMeta').doc(userId).get()).data();

  return {
    scenario: 'escape', ok: !!result.ok, oldMandateId: oldId, newMandateId: result.newMandateId ?? null,
    observations: {
      oldVoided: old.voided === true && old.status === 'closed',
      summaryNonScoring: summary?.scoring === false,
      replacementCapital: nb?.portfolio?.totalValue,
      replacementReset: nb?.portfolio?.totalValue === MANDATE_STARTING_CAPITAL && nb?.quarterIndex === 1,
      replacementArchetype: nb?.archetype,
      replacementNoEscapeWindow: nb ? nb.escapeHatchEligibleUntil === null : null,
      onceEverFlag: meta?.mandateEscapeHatchUsed === true,
      activePointsAtReplacement: meta?.activeMandateId === result.newMandateId,
    },
  };
}

/**
 * Dispatch a named scenario. `userId` is namespaced per scenario so repeated
 * runs never collide on the one-active-book-per-user claim.
 */
export async function runScenario(db, { scenario, userId, archetype, replacementArchetype, now = new Date() } = {}) {
  if (!SCENARIOS.includes(scenario)) {
    return { ok: false, error: 'unknown_scenario', scenarios: [...SCENARIOS] };
  }
  const uid = userId || `accel_${scenario}_${now.getTime()}`;
  switch (scenario) {
    case 'full_rollover': return simulateFullRollover(db, { userId: uid, archetype, now });
    case 'fr1_violation': return simulateFr1Violation(db, { userId: uid, archetype, now });
    case 'two_boundary_catchup': return simulateTwoBoundaryCatchup(db, { userId: uid, archetype, now });
    case 'escape': return simulateEscape(db, { userId: uid, archetype, replacementArchetype, now });
    default: return { ok: false, error: 'unknown_scenario' };
  }
}
