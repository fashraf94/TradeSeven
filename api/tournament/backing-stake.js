// api/tournament/backing-stake.js
//
// POST /api/tournament/backing-stake — Backing Beta PR 2, THE STAKE (spec V1.3
// §8 "one transaction per stake", §3 sealed pools, §4 the window and the
// battle-doc belt, §6 shapes, §12 PR 2; Amendment A §A2/§A3 via
// backingEligibility.js, §A6 for the allowlist).
//
// THE ORDER, and the tests pin every rung of it:
//   1  security middleware + rate limit
//   2  method — POST only
//   3  auth — the uid from the VERIFIED token, never the body
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth (the
//      SHOW_IT_ENABLED / research.js shape: a 404 in front of the auth check
//      answers an anonymous caller differently while dark and while lit, which
//      is a free oracle on an unreleased feature's rollout state)
//   5  body — { groupId, teamOdUserId, amount, requestId }, each refusal a plain
//      reason, nothing read
//   6–7 THE PRIMITIVE — `placeStake` (api/_utils/backingStake.js, the
//      activation PR): the two lazy jobs (§4 materialization, §7 the lazy
//      close) and then ONE transaction — read group + pool + the replay probe +
//      this backer's stakes + the sealed totals + the wallet, then window →
//      belt → eligibility → allowance → cap → debit → write. Moved there
//      verbatim so the founder smoke's seeder places its synthetic backers'
//      stakes through the SAME transaction this route runs; the account below
//      of what the transaction does is unchanged and is the primitive's.
//      A SMOKE session (api/_utils/backingSmoke.js) passes `smoke` — dev pods
//      only, refused before any write — and `allowDev`, the dev opt-in.
//
// THE CLOCK IS THE LEGIBLE DEADLINE; THE BATTLE DOC IS THE TRUTH (§4). Both are
// checked, in that order, and the belt is not a formality: a lobby pod's drafts
// resolve at Monday's first tick and a slot pod's picks land after fire, so the
// existence of ANY `agentBattles` doc for this group with
// `gameMode === 'baggerbomb_tournament'` means the drafts are visible and the
// window is over whatever the clock says.
//
// ONE TRANSACTION, AND WHY IT MUST BE ONE (§8). Allowance, the per-team cap, the
// seat's presence, the window and the debit are decided against the SAME
// snapshot that the write lands on. Two simultaneous submissions serialize on
// the WALLET document — both read it, both write it, so Firestore lets exactly
// one commit and re-runs the other against the committed balance. A close racing
// a stake serializes on the POOL document the same way. The idempotency keys in
// play are three, each guarding a different failure:
//   · (backer, pool, team) → the stake's DETERMINISTIC doc id (D-ag,
//     Amendment C §C2): a backer holds ONE stake per team per pool, and backing
//     that team again tops up the same document — see below;
//   · `requestId` → the REQUEST's debit key: the ledger entry
//     `stake:{debitKey}` and the stake document's `debits[]` both carry it, so
//     a double-submit is one debit and a replay returns the stake unchanged,
//     writing nothing, while a distinct top-up is a distinct debit;
//   · the pool's STATUS → a closed pool refuses, so a stake cannot land after
//     the close transaction has frozen the seats.
//
// ONE STAKE PER TEAM PER BACKER; A REPEAT TOPS UP (Amendment C §C2, D-ag). The
// stake document's id derives from (uid, groupId, teamOdUserId) — `poolId =
// groupId` (§1) — so a second request on a team the backer already holds
// lands on the SAME document, inside this same single transaction:
//   · its `amount` becomes the new total, and the per-team cap (500) is
//     checked against that total — the backer's live stakes on the team plus
//     this request;
//   · the request is its OWN debit, with its own ledger entry
//     (`stake:{debitKey}`, `ref` = the stake document) and its own entry on the
//     document's `debits[]` — so Σ entries = the cached balance after every
//     operation, and net BP per §2 is unchanged;
//   · `private/totals` and the public capped counters move exactly as for any
//     stake by a backer already counted on that team: the totals grow, the
//     unique-backer count, teams-backed and the team's backer count do not
//     (one fold, `totalsFromBackers`, keyed by backer and team);
//   · settlement and the refund are untouched — they read the document's
//     final `amount`, one payout / refund / month attribution per document.
// So a backer holds ONE stake document per seat — at most four per pod (a
// pod has four seats, and a CPU seat is backable) — and after the close a
// pool's book is at most 4 × its distinct backers. NOTHING BOUNDS DISTINCT
// BACKERS, so the ceilings are NOT unreachable by construction (this build's
// review record, MONEY-1): 24 backers each backing all four seats reach the
// refund's stuck state (96 live stakes — the PR 5 review record's MONEY-4)
// and 31 reach the settlement ceiling (120). Amendment C §C2 expects "a few
// dozen" stakes at beta scale; the ceilings stay in code as belts, the
// batched refund remains the class fix, and the close has no write ceiling of
// its own (MONEY-R-1 — reported for separate tasking). The first request's
// `placedAt`, `requestId` and `hashAtStake` stay the document's; a top-up's
// fingerprint is kept beside the first in the sealed meta (`topUps[]`), never
// over it.
//
// THE FINGERPRINT IS NOT ON THE STAKE DOC (carry-in E1). `backingStakes/{id}` is
// OWNER-READ, and Firestore rules cannot hide a field — an owner-readable doc
// carrying `ipHash` / `uaHash` / `excluded` would hand every backer their own
// admin-exclusion flag and a hash of their own network identity. Both live at
// `backingStakes/{stakeId}/private/meta`, which no client may read (the
// `backingPools/{id}/private/totals` shape, and its rules block ships in this
// PR). The IP and the UA are HASHED WITH A SERVER-SIDE SALT and never stored
// raw; see `api/_utils/backingFingerprint.js` for what the salt is and what the
// hash is and is not worth.
//
// `hashAtStake` IS TELEMETRY AND NEVER FAILS A STAKE (§4). It records the seat's
// current loadout hash so the results card can show a loadout-CHANGED marker —
// disclosure, not contract. It is resolved BEFORE the transaction, from the
// seat's latest completed battle ("as of last deploy", §4's own stated fallback
// for when the customization kernel proves heavy), and any failure yields `null`.
//
// THE WRITES ARE ALLOWLISTED (compositionProtectedStoresAllowlist.json,
// Amendment A §A6): the deny-by-default protected-store scan cannot trace the
// ref argument of a transaction-handle write, so every `tx.set` here reads as
// `unresolved` whatever the ref's origin. None of these collections is a
// composition-protected store; each key is pinned at its site count with a
// human-review note, so a new write in this transaction fails CI until it is
// reviewed too.
//
// PR 2b — THE COUNTER UPDATE SPLITS (Amendment B §B2/§B5). WRITE 6 sends the
// TRUE totals (pot, exact counts, per-team, the backers map) to
// `private/totals` and only the threshold-capped `backerProgress` /
// `teamSpread` to the public document — and writes the public document NOT AT
// ALL when those capped values are unchanged, which is every stake once both
// floors are met. Nothing else in this transaction moves: the check order, the
// `requestId` idempotency, the wallet threading and the belt are as PR 2 left
// them, because the amendment changes WHAT IS PUBLISHED, not what is decided.
//
// THE CONFIRMATION NAMES THE TEAM BY THE SERVER'S LABEL (Amendment C §C1,
// D-af): the reply carries `teamLabel` — the seat's primary agent's name and
// the player's display name — from the one resolver
// (api/_utils/backingTeamLabels.js), so the "Backed" line the client renders
// from this reply never composes a name from an id. Resolved AFTER the commit,
// like `stake_confirmed`: a name is never a reason to fail a stake.
//
// DARK AT MERGE. `BACKING_BETA_ENABLED` is false and read at CALL time through
// `backingLitFor(uid)` — the flag, or the founder smoke override for THIS uid
// on a Vercel preview (api/_utils/backingSmoke.js); the co-located
// `.dark.test.js` proves the route answers 404 and touches nothing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { BackingPoolError, liveTeamsFor } from '../_utils/backingPools.js';
import { BackingLedgerError } from '../_utils/backingWallet.js';
import { fingerprintOf } from '../_utils/backingFingerprint.js';
import { STAKE_CONFIRMED_EVENT, recordBackingEvent, stakeConfirmedEventId } from '../_utils/backingEvents.js';
import { labelSeatOf, resolveTeamLabels } from '../_utils/backingTeamLabels.js';
import { MAX_REQUEST_ID_LEN, StakeRefusal, placeStake } from '../_utils/backingStake.js';
import { MIN_STAKE_BP, PER_TEAM_CAP_BP, UNNAMED_TEAM_LABEL } from '../../src/constants/backing.js';
import { backingLitFor, smokeOverrideFor } from '../_utils/backingSmoke.js';

// The primitive's names, re-exported: the suites and backingStats.test.js
// import them from the route they have always named.
export {
  MAX_REQUEST_ID_LEN,
  STAKE_META_DOC,
  STAKE_PRIVATE_SUBCOLLECTION,
  StakeRefusal,
  debitsOf,
  resolveHashAtStake,
  stakeDebitKeyFor,
  stakeIdFor,
  stakeMetaRefFor,
  stakeRefFor,
  tournamentBattleExists,
} from '../_utils/backingStake.js';

export const config = { maxDuration: 10 };

/**
 * The confirmation's name for the team (D-af) — the one resolver's label for
 * the seat, off the pod this request already read. NEVER THROWS: the stake is
 * already on the record when this runs, and a name is never a reason to fail
 * it (the resolver degrades on its own; this catch is the belt).
 */
export async function confirmationLabelFor(db, group, teamOdUserId, isCpu = false) {
  try {
    const seat = labelSeatOf({ group }, teamOdUserId, isCpu);
    const labels = await resolveTeamLabels(db, [seat]);
    return labels.teamLabelFor(seat);
  } catch (err) {
    console.warn('[backing-stake] team label unresolvable (the neutral name answers):', err?.message);
    return { label: UNNAMED_TEAM_LABEL, secondary: null };
  }
}

/** A 400 body: one plain reason, the attest.js shape. */
function bad(res, error, message) {
  return res.status(400).json({ error, message });
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  // 3. Auth — the uid and the sign-in provider come from the token.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth. Dark ⇒ the route does not exist.
  // Backing activation: the code flag, OR the founder smoke override for THIS
  // uid on a Vercel preview (api/_utils/backingSmoke.js) — never the bare flag.
  if (!backingLitFor(user.uid)) return res.status(404).json({ error: 'Not found' });

  // 5. Body.
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { groupId, teamOdUserId, amount, requestId } = body;
  if (!isValidForgeId(groupId)) {
    return bad(res, 'invalid_group_id', 'A valid groupId is required.');
  }
  if (!isValidForgeId(teamOdUserId)) {
    return bad(res, 'invalid_team', 'A valid teamOdUserId is required.');
  }
  if (!Number.isInteger(amount)) {
    return bad(res, 'invalid_amount', 'amount must be a whole number of BP.');
  }
  if (amount < MIN_STAKE_BP) {
    return bad(res, 'below_min_stake', `The minimum stake is ${MIN_STAKE_BP} BP.`);
  }
  if (amount > PER_TEAM_CAP_BP) {
    return bad(res, 'above_team_cap', `The per-team cap is ${PER_TEAM_CAP_BP} BP.`);
  }
  if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > MAX_REQUEST_ID_LEN) {
    return bad(res, 'invalid_request_id', 'A non-empty requestId of at most 200 characters is required.');
  }

  const db = getFirebaseAdmin();
  const now = new Date();
  // A SMOKE SESSION (the founder on a preview, allowlisted) backs DEV pods only
  // and may open a dev pod's pool; everyone else passes neither.
  const smoke = smokeOverrideFor(user.uid);

  try {
    // 6–7. The primitive: the lazy jobs, then the one transaction.
    const outcome = await placeStake(db, {
      uid: user.uid,
      decodedToken: user,
      groupId,
      teamOdUserId,
      amount,
      requestId,
      fingerprint: fingerprintOf(req),
      now,
      smoke,
      allowDev: smoke,
    });

    if (outcome.refusal) {
      const { status, error, ...rest } = outcome.refusal;
      return res.status(status).json({ error, ...rest });
    }
    const { group, seat, stakeId, debitKey } = outcome;

    // Backing Beta PR 5 — `stake_confirmed` (spec §10; Amendment B §B7.3) is
    // written SERVER-SIDE, here, AFTER the transaction has committed and only
    // for a NEW debit (a replay confirmed nothing new). It is telemetry: the
    // write is awaited (BUILD_RULES §5) but a failure is logged and NEVER
    // fails the stake — the stake is already on the record. The §10
    // segmentation keys (human seats per pod, formation path) ride along,
    // read off the pod this request already holds.
    //
    // ONE CONFIRMATION PER REQUEST, and it says which it was (D-ag): the id is
    // the request's debit key — a stake and each of its top-ups share one
    // document but are separate confirmations, and a retried request can only
    // rewrite identical bytes — and `topUp` records whether this request
    // opened the stake or added to it. `amount` is what THIS request added.
    // A DEV pod's confirmation is namespaced: the dev wallet is a separate
    // ledger, so a `requestId` spent on a production pod is not refused on a
    // dev one, and its confirmation must not overwrite the production
    // record (the review record's MONEY-3). A smoke session's confirmation
    // carries the dev marker at the top level too (the activation PR), so the
    // smoke's telemetry is never read as the beta's.
    if (outcome.replay !== true) {
      try {
        const isDev = outcome.pool?.isDev === true;
        await recordBackingEvent(db, {
          eventId: stakeConfirmedEventId(isDev ? `dev:${debitKey}` : debitKey),
          userId: user.uid,
          groupId,
          event: STAKE_CONFIRMED_EVENT,
          props: {
            stakeId,
            teamOdUserId,
            amount,
            topUp: outcome.topUp === true,
            weekKey: outcome.stake.weekKey,
            formationPath: outcome.pool?.formationPath ?? null,
            humanTeams: liveTeamsFor(group).filter((t) => !t.isCpu).length,
            isDev,
          },
          ...(isDev ? { isDev: true } : {}),
          now,
        });
      } catch (err) {
        console.warn('[backing-stake] stake_confirmed not recorded (telemetry only):', err?.message);
      }
    }

    // The confirmation's name for the team (D-af), after the commit.
    const teamLabel = await confirmationLabelFor(db, group, teamOdUserId, seat?.isCpu === true);

    // THE SEALED PROJECTION (§3, Amendment B §B2): the reply carries the capped
    // validity signals, the close and the viewer's own stake — never the pot,
    // never an exact count, never a per-team total and never a pays ×.
    //
    // A BACKER WHO HAS JUST STAKED IS THE BEST-PLACED OBSERVER (§B1): they can
    // subtract their own contribution from anything they are told, so handing
    // the pot back in the confirmation response would re-open the leak the
    // document move just closed, on the one request most able to exploit it.
    // The reply projects the same capped fields the public document carries,
    // read off that document, so the two cannot disagree (§9).
    return res.status(200).json({
      replay: outcome.replay === true,
      // D-ag: whether this request topped up a stake the backer already held,
      // and what it added — the stake's `amount` is the TOTAL on the team.
      topUp: outcome.topUp === true,
      added: outcome.added,
      stake: outcome.stake,
      teamLabel,
      pool: outcome.pool
        ? {
          status: outcome.pool.status,
          backerProgress: outcome.pool.backerProgress,
          teamSpread: outcome.pool.teamSpread,
          closesAt: outcome.pool.closesAt,
          closeReason: outcome.pool.closeReason,
        }
        : null,
      allowanceRemaining: outcome.wallet ? outcome.wallet.allowanceRemaining : null,
    });
  } catch (err) {
    // A refusal thrown from inside the transaction, so the transaction rolled
    // back. Answered exactly as a returned refusal would be.
    if (err instanceof StakeRefusal) {
      return res.status(err.statusCode).json({ error: err.code, ...err.payload });
    }
    // The ledger's and the pool's own typed refusals carry their own status. The
    // MESSAGE is logged, never returned: it names internal state (which week the
    // wallet is granted for, which id was ambiguous), and every other refusal on
    // this route answers with a plain reason word.
    // The ledger's refusals are STATE CONFLICTS (the allowance is spent, the
    // wallet is on another week), so 409 whatever the class's own default is;
    // the pool's are about the REQUEST (an ambiguous groupId), so its own 400
    // stands. Either way the MESSAGE is logged, never returned: it names
    // internal state, and every other refusal here answers with a reason word.
    if (err instanceof BackingLedgerError) {
      console.warn(`[backing-stake] ledger refusal (${err.code}):`, err.message);
      return res.status(409).json({ error: err.code });
    }
    if (err instanceof BackingPoolError) {
      console.warn(`[backing-stake] pool refusal (${err.code}):`, err.message);
      return res.status(err.statusCode ?? 400).json({ error: err.code });
    }
    console.error('[backing-stake] transaction failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not place that stake.' });
  }
}
