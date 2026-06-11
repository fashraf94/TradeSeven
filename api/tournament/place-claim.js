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
import { getTournamentClaimWindow, formatEtDate } from '../_utils/tournamentTime.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  TOURNAMENT_TUNING,
  deriveCurrentTradingDay,
} from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 10 };

const LAST_CLAIM_DAY = 5;

function normalizeSymbol(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

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
    if (group.status !== GROUP_STATUS.BATTLE) {
      return res.status(409).json({ error: 'not_battle', message: 'Claims require a group in battle.' });
    }

    const player = getPlayer(group, odUserId);
    if (!player) {
      return res.status(403).json({ error: 'not_member', message: 'You are not a member of this group.' });
    }

    if (!(player.picks || []).some(p => p.symbol === dropSymbol)) {
      return res.status(409).json({ error: 'drop_not_on_roster', message: `${dropSymbol} is not on your roster.` });
    }
    if (!(group.userPool || []).includes(addSymbol)) {
      return res.status(409).json({ error: 'not_in_pool', message: `${addSymbol} is not in this group's claimable pool.` });
    }

    // Day-5 rule (legacy :251-260 / :66-78): the last trading day takes no
    // new claims. Derived from the banking record — deterministic on
    // preview, deliberately NOT covered by devBypassWindow.
    const currentDay = deriveCurrentTradingDay(group, formatEtDate(now));
    if (currentDay >= LAST_CLAIM_DAY) {
      return res.status(409).json({ error: 'battle_last_day', message: 'The battle is on its last day — no more claims.' });
    }

    const claimsRef = groupRef.collection('claims');
    const nowIso = now.toISOString();
    const claim = {
      odUserId,
      username: typeof body.username === 'string' && body.username.trim() ? body.username.trim() : (user.name ?? null),
      dropSymbol,
      addSymbol,
      rank,
      status: 'pending',
      denialReason: null,
      processedAt: null,
      submittedAt: nowIso,
      createdAt: nowIso,
    };

    // Cap + duplicate check and the write share one transaction — without
    // it, parallel submissions both read size < cap and both land, making
    // the 3-pending fairness cap advisory. Rider #5 "placed": the awaited
    // transactional write IS the capture.
    const placement = await db.runTransaction(async (tx) => {
      const pendingSnap = await tx.get(
        claimsRef.where('odUserId', '==', odUserId).where('status', '==', 'pending')
      );
      if (pendingSnap.size >= TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE) {
        return { rejected: 'claim_cap_reached' };
      }
      let duplicate = false;
      pendingSnap.forEach(doc => {
        const data = doc.data();
        if (data.dropSymbol === dropSymbol && data.addSymbol === addSymbol) duplicate = true;
      });
      if (duplicate) return { rejected: 'duplicate_claim' };

      const claimRef = claimsRef.doc();
      tx.set(claimRef, claim);
      return { claimId: claimRef.id };
    });

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
    return res.status(200).json({ claimId: placement.claimId, ...claim });
  } catch (err) {
    console.error('[Tournament] place-claim error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not place the claim.' });
  }
}
