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
//   4  body — { groupId, overrideHold?, reason?, simulatedNow? }, each refusal
//      a plain reason, nothing read
//   5  THE FREEZE — 409 while TOURNAMENT_ADVANCEMENT_FROZEN, nothing read
//   6  a SIMULATED clock settles DEV pods only (below)
//   7  `settlePool`, the one primitive; the answer is its own
//
// WHAT THIS ROUTE IS FOR. The duty never revisits a completed pod and
// settle-on-read is a latent path, so this is the whole-pool retry an operator
// reaches for — and it is the ONLY way out of a `resolving` hold:
//   · a D-ae hold (`holdReason: 'agent_layer_absent'`) is released with
//     `overrideHold: true`, which bypasses the agent-less refusal and settles;
//     who and why are logged loudly and recorded on the pool (`holdRelease`);
//   · a ceiling hold (`holdReason: 'stake_ceiling'`) is STRUCTURAL — the bound
//     is Firestore's — so an override re-runs the assertion and re-holds; the
//     operator reduces the live book (admin voids) and re-runs.
// Without `overrideHold` a held pool answers `held` and nothing moves.
//
// A SIMULATED CLOCK SETTLES DEV PODS ONLY. run-duty's `simulatedNow` keeps its
// markers in the 'sim:' namespace so a smoke run can never pre-satisfy the
// real cron; settlement writes no marker, and its one namespace is the pool's.
// A fictitious `settledAt` on real BP is exactly what the sim namespace exists
// to prevent, so a simulated instant is honoured only against a pod whose
// `isDev` routes it to a `dev-` pool (§11 gate 4's founder smoke) and answers
// `simulated_requires_dev` otherwise. A production re-run uses the real clock.
//
// DARK AT MERGE. `BACKING_BETA_ENABLED` is false and read at CALL time; the
// co-located `.dark.test.js` proves the route answers 404 and touches nothing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { parseSimulatedNow } from '../_utils/tournamentTime.js';
import {
  BackingSettlementError,
  SETTLEMENT_SOURCE,
  settlePool,
} from '../_utils/backingSettlement.js';
import { BackingPoolError, readGroup } from '../_utils/backingPools.js';
import { BackingLedgerError } from '../_utils/backingWallet.js';
import { BACKING_BETA_ENABLED, TOURNAMENT_ADVANCEMENT_FROZEN } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 60 };

/** The longest `reason` the route records — an operator's note, not an essay. */
export const MAX_REASON_LEN = 500;

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
  const { groupId, overrideHold = false, reason = null, simulatedNow = null } = body;
  if (typeof groupId !== 'string' || groupId.length === 0 || groupId.length > 200 || groupId.includes('/')) {
    return bad(res, 'invalid_group_id', 'A non-empty groupId of at most 200 characters, with no slash, is required.');
  }
  if (typeof overrideHold !== 'boolean') {
    return bad(res, 'invalid_override', 'overrideHold must be a boolean when present.');
  }
  if (reason !== null && (typeof reason !== 'string' || reason.length > MAX_REASON_LEN)) {
    return bad(res, 'invalid_reason', `reason must be a string of at most ${MAX_REASON_LEN} characters when present.`);
  }
  const parsed = parseSimulatedNow(simulatedNow);
  if (parsed.error) {
    return bad(res, 'invalid_simulated_now', parsed.error);
  }
  const simulated = simulatedNow != null;

  // 5. THE FREEZE — this route's own check (A-C13). Nothing is read first.
  if (TOURNAMENT_ADVANCEMENT_FROZEN) {
    console.error(`[backing-settle] FROZEN (TOURNAMENT_ADVANCEMENT_FROZEN): re-run of ${groupId} refused`);
    return res.status(409).json({ error: 'frozen', message: 'Advancement is frozen; settlement is withheld.' });
  }

  const db = getFirebaseAdmin();
  try {
    // 6. A simulated clock is honoured against DEV pods only (see the header).
    if (simulated) {
      const group = await readGroup(db, groupId);
      if (group != null && group.isDev !== true) {
        return res.status(409).json({
          error: 'simulated_requires_dev',
          message: 'A simulated clock may settle dev pods only; re-run without simulatedNow for a production pod.',
        });
      }
    }

    if (overrideHold) {
      console.error(`[backing-settle] HOLD OVERRIDE requested for ${groupId} by admin — reason: ${reason ?? 'none given'}${simulated ? ' [SIMULATED]' : ''}`);
    }

    // 7. The one primitive.
    const result = await settlePool(db, groupId, {
      now: parsed.now,
      source: simulated ? SETTLEMENT_SOURCE.ADMIN_SIM : SETTLEMENT_SOURCE.ADMIN,
      overrideHold,
      actor: 'admin',
      reason,
    });
    console.log(`[backing-settle] ${groupId}${simulated ? ' [SIMULATED]' : ''} → ${result.settled ? 'SETTLED' : `unsettled (${result.reason}${result.holdReason ? `: ${result.holdReason}` : ''})`}`);
    return res.status(200).json({ groupId, simulated, overrideHold, ...result });
  } catch (err) {
    if (err instanceof BackingSettlementError || err instanceof BackingPoolError || err instanceof BackingLedgerError) {
      // Typed refusals: the code goes to the caller, the message (which may
      // name internal state) to the log.
      console.error(`[backing-settle] ${groupId} refused (${err.code}):`, err.message);
      return res.status(err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500)
        .json({ error: err.code, message: 'Settlement refused; see the server log.' });
    }
    console.error('[backing-settle] error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not run the settlement.' });
  }
}
