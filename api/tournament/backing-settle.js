// api/tournament/backing-settle.js
//
// POST /api/tournament/backing-settle — Backing Beta PR 3, THE ADMIN RE-RUN
// (spec V1.3 §7 "Retries" and "Admin re-run", §12 PR 3, D-o; the D-ae hold's
// ONLY release path). On the run-duty precedent: cron-secret/admin auth,
// `simulatedNow`, dev pods routed by their own `isDev`, and the freeze checked
// HERE because the endpoints have no freeze cover of their own (A-C13).
//
// THE ORDER, and the tests pin every rung of it:
//   1  method — POST only
//   2  auth — the admin/cron secret (header or Bearer, never a query string)
//   3  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth (the
//      SHOW_IT_ENABLED / research.js shape, the same as every backing route)
//   4  body — { groupId, action?, overrideHold?, reason?, simulatedNow? },
//      each refusal a plain reason, nothing read
//   5  THE FREEZE — 409 while TOURNAMENT_ADVANCEMENT_FROZEN, nothing read
//      (the SETTLE action only — see THE REFUND below)
//   6  a SIMULATED clock settles or refunds DEV pods only (below)
//   7  `settlePool` or `refundPool`, the one primitive per action; the answer
//      is its own
//
// WHAT THIS ROUTE IS FOR. The duty never revisits a completed pod and the pod
// list's settle-on-read cannot reach one (PR 3 review, finding 1 — the
// results reader carries that contract since PR 5), so this is the
// whole-pool retry an operator reaches for — and it is the ONLY way out of a
// `resolving` hold:
//   · a D-ae hold (`holdReason: 'agent_layer_absent'`) is released with
//     `overrideHold: true`, which bypasses the agent-less refusal and settles;
//     who and why are logged loudly and recorded on the pool (`holdRelease`);
//   · a ceiling hold (`holdReason: 'stake_ceiling'`) is STRUCTURAL — the bound
//     is Firestore's — so an override re-runs the assertion and re-holds; the
//     operator reduces the live book (admin voids) and re-runs.
// Without `overrideHold` a held pool answers `held` and nothing moves.
//
// THE REFUND (Backing Beta PR 5; spec §7 "Refund paths"; the PR 3 review
// record's finding 21). `action: 'refund'` voids every live stake of a
// `closed` (or, with `overrideHold`, a `resolving`) pool as `admin` — the §7
// admin refund for a degraded, holiday, frozen or lingering pod — through
// `refundPool`, the one refund primitive. A `reason` is REQUIRED for it,
// logged loudly, and NEVER written to the pool document (authed-read by every
// signed-in user; finding 3 of the same record). The freeze does NOT gate the
// refund: a frozen week that never completes is one of §7's named refund
// cases, and a refund reads no composite — it pays nothing on them. The
// group-driven paths (`voided`, `expired`, a deleted doc) need no action:
// `settlePool` routes them to the refund itself on every host.
//
// A SIMULATED CLOCK SETTLES DEV PODS ONLY. run-duty's `simulatedNow` keeps its
// markers in the 'sim:' namespace so a smoke run can never pre-satisfy the
// real cron; settlement writes no marker, and its one namespace is the pool's.
// A fictitious `settledAt` on real BP is exactly what the sim namespace exists
// to prevent, so a simulated instant is honoured only against a pod whose
// `isDev` routes it to a `dev-` pool (§11 gate 4's founder smoke) and answers
// `simulated_requires_dev` otherwise — INCLUDING a pod whose doc is missing,
// which cannot prove it is dev and whose deleted-pod refund would otherwise
// stamp the fictitious instant on a production pool (review lens C, F2). A
// production re-run, and the deleted-pod refund, use the real clock.
//
// DARK AT MERGE. `BACKING_BETA_ENABLED` is false and read at CALL time; the
// co-located `.dark.test.js` proves the route answers 404 and touches nothing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { parseSimulatedNow } from '../_utils/tournamentTime.js';
import {
  BackingSettlementError,
  SETTLEMENT_SOURCE,
  refundPool,
  settlePool,
} from '../_utils/backingSettlement.js';
import { BackingPoolError, VOID_REASONS, readGroup } from '../_utils/backingPools.js';
import { BackingLedgerError } from '../_utils/backingWallet.js';
import { BACKING_BETA_ENABLED, TOURNAMENT_ADVANCEMENT_FROZEN } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 60 };

/** The longest `reason` the route records — an operator's note, not an essay. */
export const MAX_REASON_LEN = 500;

/** The two things this route can do to a pool. `settle` is the PR 3 default. */
export const ADMIN_ACTIONS = Object.freeze({ SETTLE: 'settle', REFUND: 'refund' });

/** A 400 body: one plain reason, the attest.js shape. */
function bad(res, error, message) {
  return res.status(400).json({ error, message });
}

export default async function handler(req, res) {
  // 1. Method.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 2. Auth — the admin/cron secret, before anything else is answered.
  if (!requireAdminSecret(req, res)) return;

  // 3. THE FLAG, read at call time, after auth.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 4. Body.
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return bad(res, 'invalid_body', 'The body must be JSON.');
  }
  const { groupId, action = ADMIN_ACTIONS.SETTLE, overrideHold = false, reason = null, simulatedNow = null } = body;
  if (typeof groupId !== 'string' || groupId.length === 0 || groupId.length > 200 || groupId.includes('/')) {
    return bad(res, 'invalid_group_id', 'A non-empty groupId of at most 200 characters, with no slash, is required.');
  }
  if (!Object.values(ADMIN_ACTIONS).includes(action)) {
    return bad(res, 'invalid_action', `action must be one of ${Object.values(ADMIN_ACTIONS).join(', ')} when present.`);
  }
  if (typeof overrideHold !== 'boolean') {
    return bad(res, 'invalid_override', 'overrideHold must be a boolean when present.');
  }
  if (reason !== null && (typeof reason !== 'string' || reason.length > MAX_REASON_LEN)) {
    return bad(res, 'invalid_reason', `reason must be a string of at most ${MAX_REASON_LEN} characters when present.`);
  }
  const refunding = action === ADMIN_ACTIONS.REFUND;
  // A refund of other people's stakes needs a stated why — logged, never stored.
  if (refunding && (typeof reason !== 'string' || reason.trim().length === 0)) {
    return bad(res, 'reason_required', 'A refund requires a non-empty reason (logged, never written to the pool).');
  }
  const parsed = parseSimulatedNow(simulatedNow);
  if (parsed.error) {
    return bad(res, 'invalid_simulated_now', parsed.error);
  }
  const simulated = simulatedNow != null;

  // 5. THE FREEZE — this route's own check (A-C13). Nothing is read first.
  // The SETTLE action only: a refund reads no composite (see the header).
  if (TOURNAMENT_ADVANCEMENT_FROZEN && !refunding) {
    console.error(`[backing-settle] FROZEN (TOURNAMENT_ADVANCEMENT_FROZEN): re-run of ${groupId} refused`);
    return res.status(409).json({ error: 'frozen', message: 'Advancement is frozen; settlement is withheld.' });
  }

  const db = getFirebaseAdmin();
  try {
    // 6. A simulated clock is honoured against DEV pods only (see the header).
    // A pod whose doc is MISSING cannot prove it is dev — and the primitive's
    // deleted-pod path would close and refund whatever pool the id names, in
    // either namespace, at the fictitious instant — so it is refused too; the
    // deleted-pod refund runs on the real clock, without simulatedNow.
    if (simulated) {
      const group = await readGroup(db, groupId);
      if (group == null || group.isDev !== true) {
        return res.status(409).json({
          error: 'simulated_requires_dev',
          message: 'A simulated clock may settle dev pods only; re-run without simulatedNow for a production or missing pod.',
        });
      }
    }

    const source = simulated ? SETTLEMENT_SOURCE.ADMIN_SIM : SETTLEMENT_SOURCE.ADMIN;

    // 7a. THE REFUND — `refundPool`, the one refund primitive. The operator's
    // reason is on this log line and nowhere else.
    if (refunding) {
      console.error(`[backing-settle] ADMIN REFUND requested for ${groupId}${overrideHold ? ' (out of a hold)' : ''}${simulated ? ' [SIMULATED]' : ''} — reason: ${reason}`);
      const result = await refundPool(db, groupId, {
        now: parsed.now,
        source,
        reason: VOID_REASONS.ADMIN,
        fromHold: overrideHold,
        actor: 'admin',
        note: reason,
      });
      console.log(`[backing-settle] ${groupId}${simulated ? ' [SIMULATED]' : ''} → ${result.refunded ? `REFUNDED (${result.stakesVoided} stakes)` : `not refunded (${result.reason}${result.holdReason ? `: ${result.holdReason}` : ''})`}`);
      return res.status(200).json({ groupId, simulated, action, overrideHold, ...result });
    }

    if (overrideHold) {
      console.error(`[backing-settle] HOLD OVERRIDE requested for ${groupId} by admin — reason: ${reason ?? 'none given'}${simulated ? ' [SIMULATED]' : ''}`);
    }

    // 7b. The one settlement primitive (which routes a voided, expired or
    // deleted pod to the refund on its own — PR 5).
    const result = await settlePool(db, groupId, {
      now: parsed.now,
      source,
      overrideHold,
      actor: 'admin',
      reason,
    });
    console.log(`[backing-settle] ${groupId}${simulated ? ' [SIMULATED]' : ''} → ${result.settled ? 'SETTLED' : result.refunded ? `REFUNDED (${result.refundReason})` : `unsettled (${result.reason}${result.holdReason ? `: ${result.holdReason}` : ''})`}`);
    return res.status(200).json({ groupId, simulated, action, overrideHold, ...result });
  } catch (err) {
    if (err instanceof BackingSettlementError || err instanceof BackingPoolError || err instanceof BackingLedgerError) {
      // Typed refusals: the code goes to the caller, the message (which may
      // name internal state) to the log.
      console.error(`[backing-settle] ${groupId} refused (${err.code}):`, err.message);
      return res.status(err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500)
        .json({ error: err.code, message: refunding ? 'Refund refused; see the server log.' : 'Settlement refused; see the server log.' });
    }
    console.error('[backing-settle] error:', err);
    return res.status(500).json({ error: 'server_error', message: refunding ? 'Could not run the refund.' : 'Could not run the settlement.' });
  }
}
