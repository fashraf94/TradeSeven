// api/_utils/mandateClosePass.js
//
// Spec 1 — Mandate Substrate — the DAILY CLOSE PASS (§3.6, F4, P3): the
// authoritative post-close mark, independent of model cadence, for EVERY active
// book — slow-tier, dormant, exit-only, and quarantined included. Runs as the
// eval handler's post-close duty (activeCloseTick window; no new cron slot)
// behind MANDATE_CLOSE_ENABLED, idempotent per date via execState.lastCloseKey.
//
// Per book, ONE revision-disciplined transaction (who-wins note: a concurrent
// eval execution and this close are BOTH revision-preconditioned Firestore
// transactions on the same doc — the loser retries against the winner's state,
// so neither writer's mutation is ever lost; wall-clock overlap is additionally
// impossible by window geometry, see activeCloseTick):
//   apply pending corporate actions (§4.3) → mark every position at the
//   session's official close from the close snapshot → recompute totalValue and
//   set HWM/drawdown, BOTH lenses — this pass is the SOLE writer of peaks (I6);
//   the execution transaction never writes them → write dailyRows/{date} with
//   regime + provenance + agencyState (I10/D-17) → recompute quarter and
//   lifetime scoring (§4.2, FR-2) → revision++ → set execState.lastCloseKey.
//
// HONESTY POSTURE (the P3 theme): a book that cannot be fully marked writes a
// row flagged partial:true with markSource:'carry_over' and increments
// health.missedMarks — never a stale value recorded as truth (I11/F19). Books
// created intra-session write a partial:true creation-day row; their first full
// session begins the scoring series (I17). agencyState records whether the
// manager COULD act — D-17's substrate: "I was frozen" must be durably
// answerable.
//
// DUAL-LABEL STREAM (O-11/I14): after a successful close, an awaited-and-
// checked shadowLogger append to 'mandate_scoring'; a failed append writes a
// durable pendingScoringAppends/{date} marker the NEXT close consumes and
// retries. The stream never blocks or re-runs the committed close.
//
// RETENTION (§3.7): snapshot cleanup (120 days) piggybacks the sweep's
// completion fire — bounded deletes, no new cron. Terminal BATCH bookkeeping
// (30 days) landed with P5's batch transport; OPEN batch docs are never
// retention-deleted (an open doc that old is a loud bug, not garbage).

import { markBook } from './mandateValuation.js';
import { buildDailyRow, buildDecision, buildCorporateAction, clearedOpenSubmissionPatch } from './mandateSchema.js';
import {
  pendingActionsFor,
  applyCorporateAction,
  classifyOvernightGaps,
} from './mandateCorporateActions.js';
import { caActionsBySymbol, snapshotExcluding, shiftDateStr } from './mandateUniverseSnapshot.js';
import { computeMandateScoring, isDegradedRow } from './mandateRiskMetrics.js';
import { logMandateScoring } from './shadowLogger.js';
import { roundUsd } from './mandateRounding.js';
import { resolveSessionSlots } from './mandateSessionSlots.js';
import {
  MANDATE_SCHEMA_VERSION,
  MANDATE_FRICTION_BASIS,
  MANDATE_FRICTION_SPREAD_BASIS,
  MANDATE_RESULT_MAX_AGE_MS,
  MANDATE_FRICTION_MODEL_VERSION,
  MANDATE_LIVENESS_FLOOR,
  MANDATE_LIVENESS_WINDOW_ROWS,
  MANDATE_MISSED_MARKS_ALERT,
  MANDATE_RUNRATE_MONTHLY_USD,
  MANDATE_SNAPSHOT_RETENTION_DAYS,
  MANDATE_RETENTION_DELETE_BATCH,
  MANDATE_BATCH_RETENTION_DAYS,
} from './mandateConfig.js';

const LOG_PREFIX = '[MandateClose]';

// ── Small time helpers (DST-safe via Intl — the mandateCalendar precedent) ───

function toDate(v) {
  if (v == null) return null;
  if (typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** The ET calendar date (YYYY-MM-DD) of an instant. */
export function etDateOf(instant) {
  const d = toDate(instant);
  if (!d) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

// ── Agency state (I10 / D-17) ────────────────────────────────────────────────

/**
 * Derive the session's agencyState at close time, from end-of-session state:
 *   exit_only — the book is quarantined (§6.4: it still evaluates, tool
 *               restricted to SELL/TRIM/HOLD); the restriction defined its
 *               agency this session whether or not it acted.
 *   full      — it was evaluated this session with the full tool.
 *   skipped:created_intraday — creation-day book (I17) that never evaluated.
 *   skipped:eval_failure     — not evaluated and carrying a failure streak
 *                              (the manager was NOT permitted to act — D-17's
 *                              distinction from "chose to hold").
 *   skipped:not_evaluated    — not evaluated, no failure evidence (missed
 *                              slots / sweep never reached it).
 * ('frozen' exists in the §2.2 enum for a full administrative freeze; no P3
 * mechanism produces one — C-21 forbids it — so it is never derived here.)
 */
export function deriveAgencyState(book, date) {
  if (book?.health?.quarantined) return 'exit_only';
  // 'full' requires a SUCCESSFUL eval today (invariants review P3 finding 5):
  // the catch/soft-failure paths stamp lastEvalTickKey too, so the attempt
  // stamp alone would record full agency on a day the manager produced
  // nothing — the exact D-17/I10 corruption the field exists to prevent.
  // lastSuccessfulEvalAt advances only on non-failed terminals (executed,
  // gated, rejected_stale, no_decision — the manager had its shot).
  const succeededToday = etDateOf(book?.health?.lastSuccessfulEvalAt) === date;
  if (succeededToday) return 'full';
  const attemptedToday = typeof book?.execState?.lastEvalTickKey === 'string'
    && book.execState.lastEvalTickKey.startsWith(`${date}_`);
  if (attemptedToday) return 'skipped:eval_failure'; // attempted, no completed cycle (model throw, soft failure, or a §3.5 abort)
  if (etDateOf(book?.createdAt) === date) return 'skipped:created_intraday';
  if ((book?.health?.consecutiveEvalFailures || 0) > 0) return 'skipped:eval_failure';
  return 'skipped:not_evaluated';
}

/**
 * Trading sessions STRICTLY BETWEEN two ET dates (both exclusive), walking the
 * market calendar backward from `date`, bounded. 0 = consecutive sessions.
 * Bounded at `maxWalk` calendar days: a longer gap undercounts rather than
 * unbounding the close transaction — the row's sessionsSpanned label still
 * flags it as multi-session (P3 review INV-2).
 */
export function tradingSessionsBetween(prevDate, date, { maxWalk = 30 } = {}) {
  if (!prevDate || !date || prevDate >= date) return 0;
  let count = 0;
  let d = shiftDateStr(date, -1);
  for (let i = 0; i < maxWalk && d > prevDate; i++) {
    if (resolveSessionSlots(d)?.trading) count++;
    d = shiftDateStr(d, -1);
  }
  return count;
}

// ── The per-book close (one transaction) ─────────────────────────────────────

/**
 * Close one book for `date`. Pre-reads the book's historical dailyRows (they
 * are immutable once written and only this pass writes them, so an outside-txn
 * read is safe under retry); everything about TODAY is computed INSIDE the
 * transaction from the txn-read book, so a retry after a racing eval commit
 * recomputes over the winner's state.
 *
 * @returns {Promise<{ closed:boolean, skipped?:string, row?:object, streamRecord?:object, alerts:string[] }>}
 */
export async function closeBook(db, mandateRef, {
  date, closeSnapshot, now = new Date(), regime = { regime: 'unknown', regimeAsOf: null, regimeSource: null },
}) {
  // Pre-read: the historical row series (ordered; immutable record family —
  // only this pass writes rows and each date is written once, so an
  // outside-txn read stays valid across a txn retry).
  const rowsSnap = await mandateRef.collection('dailyRows').orderBy('date', 'asc').get();
  const historicalRows = (rowsSnap.docs || []).map((d) => d.data());
  const priorRows = historicalRows.filter((r) => r.date !== date); // defensive: a same-date row implies an idempotency short-circuit below
  const prevRow = priorRows.length > 0 ? priorRows[priorRows.length - 1] : null;

  const result = await db.runTransaction(async (tx) => {
    // Alerts accumulate INSIDE the txn callback and travel out on the return
    // value — a transaction retry re-runs the callback, so closure-scoped
    // accumulation would double-report.
    const alerts = [];
    const bookSnap = await tx.get(mandateRef);
    if (!bookSnap.exists) return { closed: false, skipped: 'book_missing', alerts };
    const book = bookSnap.data();

    // Idempotency (§3.6): a repeat run for the same date no-ops.
    if (book.execState?.lastCloseKey === date) return { closed: false, skipped: 'already_closed', alerts };
    if (book.status !== 'active') return { closed: false, skipped: 'not_active', alerts };

    let positions = { ...(book.portfolio?.positions || {}) };
    let cash = Number(book.portfolio?.cash) || 0;
    let dividendIncomeUsd = 0;
    let staleRejectStreak = book.execState?.staleRejectStreak || 0;
    const txWrites = []; // deferred writes, applied after all tx.get()s (Firestore reads-before-writes)

    // 1. Open-batch auto-expiry (I1/§6.4): expiry is a DISPOSITION, not an
    // alert — the stale submission reaches terminal 'expired', the gate clears,
    // and the book returns to submit-eligibility. Rarely reachable under direct
    // transport (submit and harvest share a tick); P5 inherits this path.
    const openBatchId = book.execState?.openBatchId || null;
    let expiredBatch = false;
    if (openBatchId) {
      const submittedAt = toDate(book.execState?.openBatchSubmittedAt);
      const age = submittedAt ? now.getTime() - submittedAt.getTime() : Infinity;
      if (age > MANDATE_RESULT_MAX_AGE_MS) {
        const decRef = mandateRef.collection('decisions').doc(openBatchId);
        const existing = await tx.get(decRef);
        if (!existing.exists) {
          txWrites.push([decRef, buildDecision({
            decisionId: openBatchId,
            status: 'expired',
            failCondition: 'result_age', // §3.3 condition recorded (P5 durable-failCondition rule)
            frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
          }), 'set']);
        }
        expiredBatch = true;
        staleRejectStreak += 1; // an aged-out submission is a liveness event (I9)
      }
    }

    // 2. Corporate actions (§4.3): pending = held ∩ feed-window ∩ effective ≤
    // date ∩ not yet applied. Idempotent per {mandateId, actionId} via a
    // create-if-absent log doc read inside THIS transaction.
    const actionsBySym = caActionsBySymbol(closeSnapshot);
    const { pending, unrecognized, notEntitled, noEntitlementData } = pendingActionsFor(positions, actionsBySym, { onOrBefore: date });
    const caQuarantined = new Set();
    for (const bad of unrecognized) {
      // Unrecognized action type → SYMBOL-level quarantine, never a silent mismark (§4.3).
      caQuarantined.add(bad.ticker);
      alerts.push(`MANDATE_CA_UNRECOGNIZED ${bad.ticker} type=${bad.type} — symbol frozen, founder review`);
    }
    // Entitlement declines (§4.3 P3): durable applied:false claims under the
    // same idempotency key — "seen and declined, because X" — so the action is
    // never re-examined for this book. A missing-openedAt skip additionally
    // alerts: it means a real action may go unapplied on a legacy position
    // (the gap detector backstops with a visible freeze, never phantom money).
    const settledIds = new Set(); // applied or declined by THIS book — excluded from the post-apply gap scan
    for (const { list, reason, alert } of [
      { list: notEntitled, reason: 'not_entitled', alert: false },
      { list: noEntitlementData, reason: 'no_entitlement_data', alert: true },
    ]) {
      for (const decl of list) {
        settledIds.add(decl.actionId);
        const caRef = mandateRef.collection('corporateActions').doc(decl.actionId);
        const existing = await tx.get(caRef);
        if (existing.exists) continue; // claim already recorded (idempotent, no re-alert)
        txWrites.push([caRef, {
          ...buildCorporateAction({
            actionId: decl.actionId, type: decl.type, ticker: decl.ticker,
            ratio: decl.ratio ?? null, amount: decl.amount ?? null,
            renamedTo: decl.renamedTo ?? null, appliedAt: null, source: decl.source ?? null,
            applied: false, reason,
          }),
          effectiveDate: decl.effectiveDate,
        }, 'set']);
        if (alert) alerts.push(`MANDATE_CA_NO_ENTITLEMENT_DATA ${decl.ticker} ${decl.type} ${decl.effectiveDate} — position has no openedAt; action NOT applied (gap detector backstops)`);
      }
    }
    const appliedActions = [];
    for (const action of pending) {
      const caRef = mandateRef.collection('corporateActions').doc(action.actionId);
      const existing = await tx.get(caRef);
      if (existing.exists) { settledIds.add(action.actionId); continue; } // already applied (idempotency key held)
      const applied = applyCorporateAction({ positions, cash }, action);
      if (!applied.ok) {
        if (applied.reason !== 'not_held') {
          caQuarantined.add(action.ticker);
          alerts.push(`MANDATE_CA_APPLY_FAILED ${action.ticker} ${action.type}: ${applied.reason} — symbol frozen`);
        }
        continue;
      }
      positions = applied.positions;
      cash = applied.cash;
      dividendIncomeUsd = roundUsd(dividendIncomeUsd + applied.incomeUsd);
      txWrites.push([caRef, {
        ...buildCorporateAction({
          actionId: action.actionId, type: action.type, ticker: action.ticker,
          ratio: action.ratio ?? null, amount: action.amount ?? null,
          renamedTo: action.renamedTo ?? null, appliedAt: now, source: action.source ?? null,
        }),
        effectiveDate: action.effectiveDate,
        note: applied.note,
      }, 'set']);
      appliedActions.push(action.actionId);
      settledIds.add(action.actionId);
      if (applied.forcedClose) {
        // Delisting/merger: forced close at last good mark → CORPORATE_CLOSE
        // decision receipt (§4.3); the symbol leaves the carry-over build set
        // by no longer being held.
        const fc = applied.forcedClose;
        const decRef = mandateRef.collection('decisions').doc(`corp_close_${action.actionId}`);
        txWrites.push([decRef, buildDecision({
          decisionId: `corp_close_${action.actionId}`,
          verb: 'CORPORATE_CLOSE',
          ticker: fc.ticker,
          executedSizeUsd: fc.proceeds,
          executedShares: fc.shares,
          executedPrice: fc.mark,
          realizedPnl: fc.realizedPnl,
          fillMarkQuality: 'carry_over', // last good mark, by definition
          status: 'executed',
          frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
          // §4.1 "every receipt" (spec review P3 finding 4): an executed,
          // money-moving forced fill carries the honesty labels like any other
          // fill — zero friction (administrative close, no modeled spread),
          // labeled, never an unlabeled friction:null.
          friction: {
            slippageBps: 0,
            spreadProxyBps: 0,
            spreadBasis: MANDATE_FRICTION_SPREAD_BASIS,
            frictionPaid: 0,
            frictionBasis: MANDATE_FRICTION_BASIS,
          },
        }), 'set']);
      }
    }

    // 3. Suspected-CA screen at close (I7): AFTER applying known actions, a
    // still-ratio-shaped gap with no feed entry keeps its symbol on carry-over
    // (frozen mark) — the row goes partial rather than a phantom mark becoming
    // the record. News-shaped gaps pass and mark normally.
    const gapScan = classifyOvernightGaps(positions, closeSnapshot, actionsBySym, {
      // Gap window = (previous close, today]; actions this book just applied or
      // declined are settled — apply-then-scan must mark fresh, not re-freeze.
      sinceDate: book.execState?.lastCloseKey ?? null,
      asOfDate: date,
      excludeActionIds: settledIds,
    });
    for (const sym of gapScan.suspectedCA.keys()) {
      alerts.push(`MANDATE_SUSPECTED_CA ${sym} ratio=${gapScan.suspectedCA.get(sym).ratio.toFixed(4)} — frozen mark pending resolution`);
    }
    const frozenAtClose = new Set([...gapScan.frozen, ...caQuarantined]);

    // 4. Mark every position at the session's official close (frozen symbols
    // fall back to their last-good carry-over mark by construction).
    const markingSnapshot = snapshotExcluding(closeSnapshot, frozenAtClose);
    const { marked, totalValue: rawTotal } = markBook(positions, cash, markingSnapshot);
    const totalValue = roundUsd(rawTotal);

    // Write the close marks back onto the positions (tomorrow's gap detection
    // compares against today's close; the doc must say what the record says).
    const nextPositions = {};
    for (const [sym, pos] of Object.entries(positions)) {
      const m = marked[sym];
      if (!m) { nextPositions[sym] = pos; continue; } // zero-share safety: markBook skips
      const fresh = m.markSource === 'snapshot';
      nextPositions[sym] = {
        ...pos,
        lastMark: m.mark,
        lastMarkAsOf: fresh ? (closeSnapshot?.symbols?.[sym]?.priceAsOf ?? null) : (pos.lastMarkAsOf ?? null),
        lastMarkSource: m.markSource,
      };
    }

    // Partial-close discipline (I11/F19 + I17) — INCLUDING fully-missed
    // sessions (§6.4, P3 review INV-1/SPEC-2): a session with NO committed
    // close is a missed close mark for the whole book; it leaves no row, so
    // the accounting happens RETROACTIVELY at the next close that does
    // commit, from the trading-calendar gap since the previous row. Without
    // this, the "missed close marks ≥ 2 consecutive sessions" alert was
    // structurally unreachable for the actual missed-session case, and the
    // next full close silently reset the streak.
    const carryOverSyms = Object.values(marked).filter((m) => m.markSource !== 'snapshot').length;
    const createdToday = etDateOf(book.createdAt) === date;
    const partial = carryOverSyms > 0 || createdToday;
    const degradedMarks = carryOverSyms > 0;
    const missedMark = carryOverSyms > 0; // creation-day partial is NOT a missed mark
    const gapSessions = prevRow ? tradingSessionsBetween(prevRow.date, date) : 0;
    const priorStreak = book.health?.consecutiveMissedMarks || 0;
    const retroStreak = priorStreak + gapSessions + (missedMark ? 1 : 0);
    const missedMarks = (book.health?.missedMarks || 0) + gapSessions + (missedMark ? 1 : 0);
    // The streak survives today only if today itself was partial; a full close
    // ends it — but the alert still fires retroactively for the gap it closed.
    const consecutiveMissedMarks = missedMark ? retroStreak : 0;
    if (retroStreak >= MANDATE_MISSED_MARKS_ALERT && (missedMark || gapSessions > 0)) {
      alerts.push(`MANDATE_MISSED_MARKS ${retroStreak} consecutive missed close marks (${gapSessions} fully-missed session${gapSessions === 1 ? '' : 's'}, today ${missedMark ? 'partial' : 'full'})`);
    }

    // 5. HWM / drawdown, BOTH lenses — the close pass is the SOLE peak writer (I6).
    const initial = Number(book.portfolio?.initialValue) || 0;
    const lifetimeHWM = Math.max(Number(book.portfolio?.lifetimeHighWaterMark) || initial, totalValue);
    const quarterHWM = Math.max(Number(book.portfolio?.quarterHighWaterMark) || initial, totalValue);
    const lifetimeDD = lifetimeHWM > 0 ? (lifetimeHWM - totalValue) / lifetimeHWM : 0;
    const quarterDD = quarterHWM > 0 ? (quarterHWM - totalValue) / quarterHWM : 0;

    // 6. Sector weights at the close marks (the doc's display block stays consistent).
    const sectorWeights = {};
    if (totalValue > 0) {
      const usd = {};
      for (const m of Object.values(marked)) {
        const sector = m.sector || '__unknown__';
        usd[sector] = (usd[sector] || 0) + m.marketValue;
      }
      for (const [s, v] of Object.entries(usd)) sectorWeights[s] = v / totalValue;
    }

    // 7. Today's row. dayReturnPct derives from the PREVIOUS ROW's close — with
    // no prior row it is NULL (an honest "cannot compute"), never a fabricated
    // multi-day figure; dividends flow through cash so total return includes
    // them, and the row separately records them as income (not trading P&L).
    const prevTotal = Number(prevRow?.totalValue);
    const dayReturnPct = Number.isFinite(prevTotal) && prevTotal > 0 ? (totalValue - prevTotal) / prevTotal : null;
    // Return-quality labels (P3 review INV-2/MONEY-8): a return spanning
    // missed sessions, or baselined on a degraded (carry-over) prior row,
    // stays factual on the row but is excluded from variance metrics.
    const sessionsSpanned = prevRow ? 1 + gapSessions : null;
    const returnBaseDegraded = !!(prevRow && isDegradedRow(prevRow));
    const frictionPaidCum = roundUsd(book.portfolio?.frictionPaidCum || 0);
    // First row: no window — null, never all-inception friction labeled as one
    // day's (money review P3 finding 6). Σ over labeled rows still telescopes
    // to frictionPaidCum via the cum field on every row.
    const dayFrictionPaid = prevRow ? roundUsd(frictionPaidCum - (Number(prevRow.frictionPaidCum) || 0)) : null;
    const today = book.costTelemetry?.today?.date === date ? book.costTelemetry.today : null;
    const agencyState = deriveAgencyState(book, date);

    const row = buildDailyRow({
      date,
      quarterIndex: book.quarterIndex ?? null,
      totalValue,
      dayReturnPct,
      quarterDrawdown: quarterDD,
      regime: regime.regime,
      regimeAsOf: regime.regimeAsOf,
      regimeSource: regime.regimeSource,
      markSource: degradedMarks ? 'carry_over' : 'close_snapshot',
      agencyState,
      evalCount: today?.evalCount ?? 0,
      tokensIn: today?.tokensIn ?? 0,
      tokensOut: today?.tokensOut ?? 0,
      estUsd: today?.estUsd ?? 0,
      cacheHitTokens: today?.cacheHitTokens ?? 0,
      cacheWriteTokens: today?.cacheWriteTokens ?? 0, // §6.3 (P5) — D-20 stacking rate needs both sides
      partial,
      degradedMarks,
      sessionsSpanned,
      returnBaseDegraded,
      dividendIncomeUsd,
      dayFrictionPaid,
      frictionPaidCum,
      submittedCum: book.execState?.submitted || 0,
      executedCum: book.execState?.executed || 0,
    });

    // 8. Scoring, both lenses (§4.2/FR-2), over the tagged row series + today.
    const scoring = computeMandateScoring([...priorRows, row], book.quarterIndex, now);

    // 9. Commit — reads are done; apply the deferred writes, the row, the book.
    for (const [ref, doc, op] of txWrites) {
      if (op === 'set') tx.set(ref, doc);
    }
    tx.set(mandateRef.collection('dailyRows').doc(date), row);
    tx.update(mandateRef, {
      'portfolio.positions': nextPositions,
      'portfolio.cash': roundUsd(cash),
      'portfolio.totalValue': totalValue,
      'portfolio.sectorWeights': sectorWeights,
      'portfolio.lifetimeHighWaterMark': lifetimeHWM,
      'portfolio.lifetimeDrawdownFromPeak': lifetimeDD,
      'portfolio.quarterHighWaterMark': quarterHWM,
      'portfolio.quarterDrawdownFromPeak': quarterDD,
      scoring,
      'health.lastCloseMarkAt': now,
      'health.lastCloseAttemptAt': now, // the sweep's ordering key: success and failure both advance it (INV-1/C21-1)
      'health.consecutiveCloseFailures': 0, // a committed close ends any whole-close failure streak
      'health.missedMarks': missedMarks,
      'health.consecutiveMissedMarks': consecutiveMissedMarks,
      revision: (book.revision || 0) + 1,
      'execState.lastCloseKey': date,
      ...(expiredBatch ? clearedOpenSubmissionPatch() : {}),
      'execState.staleRejectStreak': staleRejectStreak,
    });

    // The dual-label stream record (O-11): gross + net + metrics + regime +
    // vintage + agencyState. Gross adds friction back ONCE (F14).
    const grossDayReturnPct = Number.isFinite(prevTotal) && prevTotal > 0
      ? ((totalValue - prevTotal) + dayFrictionPaid) / prevTotal
      : null;
    const streamRecord = {
      schemaVersion: MANDATE_SCHEMA_VERSION,
      mandateId: mandateRef.id,
      date,
      quarterIndex: book.quarterIndex ?? null,
      archetype: book.archetype ?? null,
      vintageRef: book.vintageRef ?? null,
      agencyState,
      regime: regime.regime,
      regimeAsOf: regime.regimeAsOf,
      net: { totalValue, dayReturnPct },
      gross: { dayFrictionPaid, grossDayReturnPct },
      sessionsSpanned,
      returnBaseDegraded,
      dividendIncomeUsd,
      partial,
      degradedMarks,
      scoring,
      frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
      frictionBasis: 'idealized_no_market_impact',
    };

    return {
      closed: true, row, streamRecord, appliedActions, alerts,
      rows: [...priorRows, row], // for the post-close trailing-window health checks
      monthEstUsd: book.costTelemetry?.monthKey === date.slice(0, 7) ? (book.costTelemetry?.estUsd || 0) : 0,
    };
  });

  return result;
}

// ── Dual-label stream append + durable retry (O-11 / I14) ────────────────────

/**
 * Retry any pending markers, then append today's record; a failed append
 * writes a durable marker for the NEXT close. Never throws, never re-runs the
 * close. Returns counts for the sweep summary.
 */
export async function appendScoringWithRetry(db, mandateRef, streamRecord, { date, appendFn = logMandateScoring } = {}) {
  let retried = 0;
  let stillPending = 0;

  // 1. Consume prior pending markers (bounded).
  try {
    const pendSnap = await mandateRef.collection('pendingScoringAppends').limit(10).get();
    const docs = pendSnap.docs || [];
    for (const d of docs) {
      const marker = d.data();
      const ok = await appendFn(marker.record || marker);
      if (ok) { await d.ref.delete(); retried++; } else stillPending++;
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} pending-append retry failed for ${mandateRef.id}: ${err.message}`);
  }

  // 2. Today's append — awaited AND checked (BUILD_RULES §5; never fire-and-forget).
  let appended = false;
  try {
    appended = await appendFn(streamRecord);
  } catch (err) {
    appended = false; // the logger contract never rejects, but never trust that with money records
    console.error(`${LOG_PREFIX} scoring append threw for ${mandateRef.id}: ${err.message}`);
  }
  if (!appended) {
    try {
      await mandateRef.collection('pendingScoringAppends').doc(date).set({
        date, record: streamRecord, failedAt: new Date(),
      });
      stillPending++;
      console.error(`${LOG_PREFIX} MANDATE_SCORING_APPEND_DEFERRED ${mandateRef.id} ${date} — durable marker written (I14)`);
    } catch (err) {
      // Marker write ALSO failed — loudest possible signal; the row itself is
      // committed (the record of record), only the stream copy is at risk.
      console.error(`${LOG_PREFIX} MANDATE_SCORING_APPEND_LOST ${mandateRef.id} ${date}: ${err.message}`);
    }
  }
  return { appended, retried, stillPending };
}

// ── Post-close health alerts (I9 / §6.4 / §6.2) ──────────────────────────────

/**
 * Trailing-window liveness ratio (I9): (Δexecuted / Δsubmitted) over the last
 * MANDATE_LIVENESS_WINDOW_ROWS rows' cumulative counters. HOLD counts as
 * executed (founder ruling), so this is a coarse secondary signal — the
 * stale-rejection streak is the primary liveness wire. Null when the window
 * has too little submission activity to be meaningful.
 */
export function trailingLivenessRatio(rows, windowRows = MANDATE_LIVENESS_WINDOW_ROWS) {
  const sorted = [...(rows || [])].sort((a, b) => String(a?.date).localeCompare(String(b?.date)));
  if (sorted.length < 2) return null;
  const window = sorted.slice(-windowRows);
  const first = window[0];
  const last = window[window.length - 1];
  const dSub = (Number(last?.submittedCum) || 0) - (Number(first?.submittedCum) || 0);
  const dExec = (Number(last?.executedCum) || 0) - (Number(first?.executedCum) || 0);
  if (dSub < 5) return null; // too quiet to judge
  return dExec / dSub;
}

export function healthAlertsAfterClose({ mandateId, rows, monthEstUsd }) {
  const alerts = [];
  const ratio = trailingLivenessRatio(rows);
  if (ratio != null && ratio < MANDATE_LIVENESS_FLOOR) {
    alerts.push(`MANDATE_LIVENESS_LOW ${mandateId} executedVsSubmitted=${ratio.toFixed(2)} < floor ${MANDATE_LIVENESS_FLOOR}`);
  }
  if ((monthEstUsd || 0) > MANDATE_RUNRATE_MONTHLY_USD) {
    alerts.push(`MANDATE_RUNRATE_EXCEEDED ${mandateId} month estUsd $${monthEstUsd.toFixed(4)} > D-22 band $${MANDATE_RUNRATE_MONTHLY_USD.toFixed(2)}`);
  }
  return alerts;
}

// ── Retention (§3.7) ─────────────────────────────────────────────────────────

/**
 * Bounded snapshot cleanup: tick snapshots and daily docs older than the
 * retention window, deleted up to MANDATE_RETENTION_DELETE_BATCH per
 * collection per fire. Doc ids are ISO-date-prefixed, so a lexicographic
 * documentId() range covers both `YYYY-MM-DD_slot` and `YYYY-MM-DD` keys.
 * decisions/dailyRows/quarterSummaries/corporateActions are NEVER touched —
 * they are the record. `documentIdPath` is injectable for tests; production
 * passes FieldPath.documentId() (the Admin SDK's canonical id sentinel).
 */
export async function runRetentionCleanup(db, { now = new Date(), documentIdPath = '__name__' } = {}) {
  const cutoff = new Date(now.getTime() - MANDATE_SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  let deleted = 0;
  for (const collection of ['mandateUniverseSnapshots', 'mandateUniverseDaily']) {
    try {
      const snap = await db.collection(collection)
        .where(documentIdPath, '<', cutoff)
        .limit(MANDATE_RETENTION_DELETE_BATCH)
        .get();
      const docs = snap.docs || [];
      for (const d of docs) { await d.ref.delete(); deleted++; }
    } catch (err) {
      console.error(`${LOG_PREFIX} retention cleanup failed on ${collection}: ${err.message}`);
    }
  }

  // §3.7 (P5): TERMINAL batch bookkeeping 30 days. Batch doc ids are provider
  // ids (not date-prefixed), so the window queries sessionDate; status is
  // filtered CLIENT-SIDE within the bounded page because an OPEN doc must
  // never be deleted — it holds undisposed submissions (I1). An open doc that
  // old means every disposal path failed for a month: alert, never destroy.
  const batchCutoff = new Date(now.getTime() - MANDATE_BATCH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  try {
    const snap = await db.collection('mandateBatches')
      .where('sessionDate', '<', batchCutoff)
      .limit(MANDATE_RETENTION_DELETE_BATCH)
      .get();
    for (const d of snap.docs || []) {
      const status = d.data()?.status;
      if (status === 'open') {
        console.error(`${LOG_PREFIX} MANDATE_BATCH_STUCK_OPEN ${d.id} — open past the ${MANDATE_BATCH_RETENTION_DAYS}d retention window; NOT deleted (I1) — founder review`);
        continue;
      }
      await d.ref.delete(); deleted++;
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} retention cleanup failed on mandateBatches: ${err.message}`);
  }
  try {
    const snap = await db.collection('mandateBatchStats')
      .where(documentIdPath, '<', batchCutoff)
      .limit(MANDATE_RETENTION_DELETE_BATCH)
      .get();
    for (const d of snap.docs || []) { await d.ref.delete(); deleted++; }
  } catch (err) {
    console.error(`${LOG_PREFIX} retention cleanup failed on mandateBatchStats: ${err.message}`);
  }

  if (deleted > 0) console.log(`${LOG_PREFIX} retention: deleted ${deleted} snapshot/batch docs past their §3.7 windows`);
  return deleted;
}
