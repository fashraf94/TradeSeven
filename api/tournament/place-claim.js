// api/tournament/place-claim.js
//
// P1b — POST /api/tournament/place-claim. User-authed claim placement for
// the overnight waiver wire. Validation is the legacy submitClaim order
// (src/services/claimFreeAgencyService.js:210-310) minus categories: window
// → membership → drop-on-roster → flat-pool membership → day-5 → pending
// cap → duplicate. The legacy placement was a client-side Firestore write;
// the tournament rules deny client subcollection writes, so this endpoint
// is the server-side sibling.
//
// SIGNAL CAPTURE RIDER, EVENT #5 "placed" (Addendum A §4 row 5): the single
// awaited claim-doc write below IS the capture — target, drop, rank, and
// timestamp in writer-readable fields. No fire-and-forget.
//
// PREVIEW TIME-CONTROL: `devBypassWindow: true` skips ONLY the ET placement
// window, and ONLY when the request also carries a valid admin secret
// (X-Admin-Secret header) — checked server-side via isAdminSecretValid,
// which never writes a response: without the secret the flag is silently
// ignored and normal validation applies. Production behavior is unreachable
// without the secret.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isAdminSecretValid } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { getPlayer } from '../_utils/tournamentGroupService.js';
import { getTournamentClaimWindow, isMarketOpenAt } from '../_utils/tournamentTime.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  TOURNAMENT_TUNING,
  BASELINE_POLICY,
} from '../../src/constants/leagueTournament.js';
// Slice 4 (B1): the validation + transactional write live in the shared
// placement core, so the CPU path (tournamentCpuClaims.js) reuses ONE copy of
// the rules (BUILD_RULES §4). This endpoint keeps its HTTP-only concerns: auth,
// the ET window, and the training-scoped status gate.
import {
  validateClaimPlacement,
  commitClaimPlacement,
  normalizeSymbol,
} from '../_utils/tournamentClaimPlacement.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  const odUserId = user.uid;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId, devBypassWindow = false } = body;
  const dropSymbol = normalizeSymbol(body.dropSymbol);
  const addSymbol = normalizeSymbol(body.addSymbol);
  const rank = Number.isInteger(body.rank) && body.rank >= 1 ? body.rank : 1;

  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }
  if (!dropSymbol || !addSymbol || dropSymbol === addSymbol) {
    return res.status(400).json({ error: 'invalid_symbols', message: 'dropSymbol and addSymbol must be distinct tickers.' });
  }

  const now = new Date();
  const window = getTournamentClaimWindow(now);
  const windowBypassed = devBypassWindow && isAdminSecretValid(req);
  if (!window.isOpen && !windowBypassed) {
    return res.status(403).json({
      error: 'window_closed',
      message: `The claim window is closed (${window.reason}; ${window.etTime} ET). It opens at the 4:00 PM ET close and shuts at 9:24 AM ET.`,
    });
  }

  try {
    const db = getFirebaseAdmin();
    const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return res.status(404).json({ error: 'group_not_found', message: 'Tournament group not found.' });
    }
    const group = groupSnap.data();

    // FENCE-ADJACENT — the close-only exposure-contract guard (do NOT weaken the
    // BATTLE path). Competitive Live Draft (LEAGUE_LIVE_DRAFT) update: a
    // COMPETITIVE slot pod now passes through DRAFTING → AWAITING_OPEN before
    // BATTLE (it no longer stops at FORMING). In those pre-battle states it has
    // NO battle and NO legs, so a claim is structurally invalid. This explicit
    // guard rejects any non-BATTLE competitive live-draft pod — structurally, not
    // merely time-gated. (The claimsStatusOpen expression below ALSO rejects it —
    // its AWAITING_OPEN exemption is isTraining-scoped and a live-draft pod is
    // never isTraining — but the intent is stated here so a future edit to that
    // expression cannot silently admit a leg-less competitive pod.)
    if (group.isLiveDraft === true && group.status !== GROUP_STATUS.BATTLE) {
      return res.status(409).json({ error: 'not_battle', message: 'Claims require a group in battle.' });
    }

    // Slice 4 (Phase A): claims open on a BATTLE pod — and, for TRAINING pods
    // only, on an AWAITING_OPEN pod (the weeknight pre-day-1 window; the pod is
    // flipped to BATTLE by the orchestrator morning tick before the 9:25 AM ET
    // processing pass). AWAITING_OPEN opens claims ONLY for training pods; a
    // competitive AWAITING_OPEN pod (Live Draft) is rejected above and by the
    // isTraining-scoped exemption here — ranked/competitive claims require BATTLE.
    const claimsStatusOpen = group.status === GROUP_STATUS.BATTLE
      || (group.isTraining === true && group.status === GROUP_STATUS.AWAITING_OPEN);
    if (!claimsStatusOpen) {
      return res.status(409).json({ error: 'not_battle', message: 'Claims require a group in battle.' });
    }

    // Phase 4 — exposure-contract enforcement (Spec §1.1 canonical-open policy).
    // A canonical-open round is CLOSE-ONLY: a claim placed mid-session would
    // create a null-baseline leg that the sweep captures at the NEXT open —
    // retroactive exposure, unfair to the field. Read the STAMP (not the flag),
    // and gate ONLY canonical rounds, so legacy/absent-stamp rounds stay
    // byte-identical (the ET window already keeps their placement off-hours;
    // this guard is the authoritative check that also survives the admin
    // devBypassWindow path). UI-consumable (code + message) for the Phase-5
    // claim-disable affordance.
    if (group.baselinePolicy === BASELINE_POLICY.CANONICAL_OPEN && isMarketOpenAt(now)) {
      return res.status(403).json({
        error: 'claims_closed_during_market_hours',
        message: 'Claims open after the 4:00 PM ET close — the market is open right now.',
      });
    }

    const player = getPlayer(group, odUserId);

    // Shared placement core (B1): distinct symbols → membership → drop-on-roster
    // → add-in-userPool → day-5. Identical rules to the CPU path.
    const validation = validateClaimPlacement({ group, player, dropSymbol, addSymbol, now });
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error, message: validation.message });
    }

    const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : (user.name ?? null);
    // Cap + duplicate + the rider #5 "placed" awaited write — one transaction.
    const placement = await commitClaimPlacement(db, { groupId, odUserId, username, dropSymbol, addSymbol, rank, now });

    if (placement.rejected === 'claim_cap_reached') {
      return res.status(409).json({
        error: 'claim_cap_reached',
        message: `Claim limit reached (${TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE} pending per cycle).`,
      });
    }
    if (placement.rejected === 'duplicate_claim') {
      return res.status(409).json({ error: 'duplicate_claim', message: 'You already have a pending claim for this exact swap.' });
    }

    console.log(`[Tournament] place-claim: group ${groupId} ${odUserId} drop ${dropSymbol} add ${addSymbol} rank ${rank}${windowBypassed ? ' (window bypassed)' : ''}`);
    return res.status(200).json({ claimId: placement.claimId, ...placement.claim });
  } catch (err) {
    console.error('[Tournament] place-claim error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not place the claim.' });
  }
}
