// api/_utils/canonicalOpenSweep.js
//
// User-layer CANONICAL-OPEN capture SWEEP (Spec §1.1, Phase 2). Runs post-open
// on the agent-evaluate cron arm: for active canonical-policy rounds, captures
// the round's canonical session open once per symbol and settles every
// null-baseline user leg from it, so the user layer scores live intraday
// consistent with the banked score of record.
//
// INERT IN PROD: it acts ONLY on rounds whose group doc carries the STAMP
// `baselinePolicy == 'canonical_open'` — never the live flag (anti-cohort-mixing:
// a mid-round flag flip can't change how an already-created round is swept). With
// LEAGUE_CANONICAL_OPEN_CAPTURE off, no round carries the stamp → the selection
// returns nothing → early no-op. Merge-dark holds.
//
// SOURCE is pinned to fetchCanonicalOpens (→ fetchBatchQuotes /real-time/ open),
// the SAME open banking settles from. FAIL-CLOSED: a null open leaves the leg
// null with captureState PENDING_OPEN + an audit entry (never a bare null),
// retried next arm. NO fenced-file contact.

import { fetchCanonicalOpens, writeCanonicalOpenSnapshot } from './canonicalOpen.js';
import { fetchEligibleGroupsByStatus } from './tournamentGroupService.js';
import { isMarketOpenAt, formatEtDate, toIso } from './tournamentTime.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  BASELINE_POLICY,
  BASELINE_SOURCE,
  CAPTURE_STATE,
} from '../../src/constants/leagueTournament.js';

const LOG_PREFIX = '[CanonicalOpenSweep]';
// Bounded on-doc audit log — matches the claimSystem.processingLog /
// cronState.cronErrors precedent (no new store).
const CAPTURE_LOG_MAX = 50;
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Settle a single group's null-baseline user legs from its canonical-open
 * snapshots, in ONE idempotent transaction (the flip.js:163 conditional-write
 * pattern generalized). The group-doc read-set is the concurrency precondition:
 * a re-fired/concurrent sweep re-reads a now-settled leg and no-ops.
 *
 *  - A leg with a non-null baseline OR baselineCapturedAt is left UNTOUCHED
 *    (already settled / captured / an in-hours flip's live baseline).
 *  - A null-baseline uncaptured leg whose symbol has a canonicalOpens snapshot
 *    settles CAPTURED from that snapshot's open (fairness: every leg on a symbol
 *    shares one open).
 *  - A null-baseline uncaptured leg whose symbol was fetched with NO eligible
 *    open (fetchedOpens[sym] === null) transitions to PENDING_OPEN and writes an
 *    audit entry (only on transition — no re-audit of an already-pending leg).
 *
 * @param {Object} db Firestore Admin
 * @param {string} groupId
 * @param {Object<string,{open:number,priceTimestamp?:number|null,instrumentId?:*}|null>} fetchedOpens
 *   this pass's fetchCanonicalOpens result (used only to mark PENDING for nulls)
 * @param {{capturedAt:string, captureJobId:string, session:string}} meta
 * @returns {Promise<{captured:string[], pending:string[], changed:boolean, audit:number}>}
 */
export async function settleLegsFromSweep(db, groupId, fetchedOpens = {}, { capturedAt, captureJobId, session } = {}) {
  const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(groupRef);
    if (!snap.exists) return { captured: [], pending: [], changed: false, audit: 0 };
    const data = snap.data() || {};
    const canonicalOpens = data.canonicalOpens || {};
    const captured = [];
    const newlyPending = [];
    const auditEntries = [];
    let changed = false;

    const newPlayers = (data.players || []).map((pl) => ({
      ...pl,
      picks: (pl.picks || []).map((pk) => {
        const sym = pk.symbol;
        const legs = (pk.legs || []).map((leg) => {
          // Untouched: already settled/captured, or an in-hours flip's live baseline.
          if (leg.baselinePrice != null || leg.baselineCapturedAt != null) return leg;

          const snapEntry = canonicalOpens[sym];
          if (snapEntry && Number.isFinite(snapEntry.open) && snapEntry.open > 0) {
            changed = true;
            captured.push(sym);
            return {
              ...leg,
              baselinePrice: snapEntry.open,
              baselineSource: BASELINE_SOURCE.CANONICAL_OPEN_CAPTURE,
              baselineCapturedAt: capturedAt,
              baselinePriceTimestamp: snapEntry.priceTimestamp ?? null,
              captureJobId,
              baselineSession: session,
              instrumentId: snapEntry.instrumentId ?? null,
              captureState: CAPTURE_STATE.CAPTURED,
            };
          }

          // No snapshot. Distinguish fetched-and-null (→ PENDING) from
          // not-fetched-this-pass (→ leave untouched).
          const fetchedThisPass = Object.prototype.hasOwnProperty.call(fetchedOpens, sym);
          if (fetchedThisPass && fetchedOpens[sym] == null) {
            if (leg.captureState !== CAPTURE_STATE.PENDING_OPEN) {
              changed = true;
              newlyPending.push(sym);
              auditEntries.push({
                ts: capturedAt,
                session,
                symbol: sym,
                reason: 'no_eligible_open',
                nextRetry: 'next_sweep_arm',
                captureJobId,
              });
              return { ...leg, captureState: CAPTURE_STATE.PENDING_OPEN };
            }
            return leg; // already pending — no re-audit (avoids log spam per arm)
          }
          return leg;
        });
        return { ...pk, legs };
      }),
    }));

    if (!changed) return { captured, pending: newlyPending, changed: false, audit: 0 };

    const update = { players: newPlayers, updatedAt: capturedAt, lastCanonicalSweepAt: capturedAt };
    if (auditEntries.length > 0) {
      const existingLog = Array.isArray(data.canonicalCaptureLog) ? data.canonicalCaptureLog : [];
      update.canonicalCaptureLog = [...existingLog, ...auditEntries].slice(-CAPTURE_LOG_MAX);
    }
    tx.update(groupRef, update);
    return { captured, pending: newlyPending, changed: true, audit: auditEntries.length };
  });
}

/**
 * The post-open capture sweep. Gates on the ET regular session (injectable
 * `now`), selects active canonical-policy rounds by the STAMP, and for each:
 * fetches the canonical open for its uncaptured null symbols, writes the
 * immutable per-symbol snapshot (idempotent), then settles/marks its legs.
 * Per-group failures are caught and isolated. Returns a structured summary.
 *
 * @param {Object} db Firestore Admin
 * @param {{now?:Date, timeoutMs?:number, captureJobId?:string}} [opts]
 */
export async function runCanonicalOpenSweep(db, { now = new Date(), timeoutMs = DEFAULT_TIMEOUT_MS, captureJobId = null } = {}) {
  if (!isMarketOpenAt(now)) {
    return { skipped: true, reason: 'market_closed', groups: 0, captured: 0, pending: 0, snapshots: 0 };
  }

  const session = formatEtDate(now);
  const capturedAt = toIso(now);
  const jobId = captureJobId || `canonical-sweep-${session}-${now.getTime()}`;

  const battleGroups = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE);
  // The anti-cohort-mixing invariant: act on the STAMP, never the flag. Absent
  // stamp = legacy = skip (banking settles at open as today).
  const canonical = battleGroups.filter((g) => g.baselinePolicy === BASELINE_POLICY.CANONICAL_OPEN);
  if (canonical.length === 0) {
    return { skipped: false, reason: 'no_canonical_rounds', groups: 0, captured: 0, pending: 0, snapshots: 0, session, jobId };
  }

  const startedAt = Date.now();
  let groupsProcessed = 0;
  let capturedTotal = 0;
  let pendingTotal = 0;
  let snapshotsTotal = 0;
  let deferred = 0;
  let errors = 0;

  for (const group of canonical) {
    if (Date.now() - startedAt > timeoutMs) {
      deferred = canonical.length - groupsProcessed;
      console.log(`${LOG_PREFIX} timeout ${timeoutMs}ms — ${deferred} group(s) deferred to next arm`);
      break;
    }
    try {
      const existingSnaps = group.canonicalOpens || {};
      const nullSymbols = new Set();
      for (const pl of group.players || []) {
        for (const pk of pl.picks || []) {
          for (const leg of pk.legs || []) {
            if (leg.baselinePrice == null && leg.baselineCapturedAt == null) nullSymbols.add(pk.symbol);
          }
        }
      }
      if (nullSymbols.size === 0) { groupsProcessed++; continue; }

      // Fetch only symbols that still lack a snapshot (an existing snapshot is
      // immutable — never re-fetch or overwrite it).
      const toFetch = [...nullSymbols].filter((s) => existingSnaps[s] == null);
      const fetched = toFetch.length > 0 ? await fetchCanonicalOpens(toFetch) : {};

      const nonNull = {};
      for (const [s, v] of Object.entries(fetched)) if (v != null) nonNull[s] = v;
      if (Object.keys(nonNull).length > 0) {
        const w = await writeCanonicalOpenSnapshot(db, group.id, nonNull, { capturedAt, captureJobId: jobId, session });
        snapshotsTotal += w.written.length;
      }

      const res = await settleLegsFromSweep(db, group.id, fetched, { capturedAt, captureJobId: jobId, session });
      capturedTotal += res.captured.length;
      pendingTotal += res.pending.length;
      groupsProcessed++;
    } catch (err) {
      errors++;
      console.error(`${LOG_PREFIX} group ${group.id} FAILED (isolated):`, err.message);
    }
  }

  const summary = {
    skipped: false,
    groups: canonical.length,
    groupsProcessed,
    captured: capturedTotal,
    pending: pendingTotal,
    snapshots: snapshotsTotal,
    deferred,
    errors,
    session,
    jobId,
  };
  // First-print window / quiet-day: 0 captured + some pending + no opens yet is
  // EXPECTED, not an error — INFO, never an alert.
  console.log(`${LOG_PREFIX}`, summary);
  return summary;
}
