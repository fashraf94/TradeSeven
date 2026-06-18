// api/_utils/tournamentClaimPlacement.js
//
// League Training Slice 4 (B1) — the SHARED placement core for tournament /
// training user-layer claims. Extracted from api/tournament/place-claim.js so
// the human endpoint AND the CPU placement path (api/_utils/tournamentCpuClaims
// .js) share ONE copy of the validation + transactional write — never a second
// copy of the rules (BUILD_RULES §4 anti-copy). place-claim.js keeps its
// HTTP-only concerns (auth, the ET placement window, the training-scoped status
// gate); everything the CPU path also needs lives here.
//
// validateClaimPlacement is pure (no I/O): the legacy submitClaim order minus
// categories — distinct symbols → membership → drop-on-roster → add-in-userPool
// → day-5. commitClaimPlacement owns the cap+duplicate+write transaction: the
// rider #5 "placed" AWAITED write (Signal Capture pattern A; BUILD_RULES §5).
//
// USER-LAYER ONLY: neither function reaches the agent ledger /
// flattenPortfolioServer (agentScoring.js) path — a claim writes only a pending
// claim doc; resolution (tournamentClaims.js, unchanged) owns the cross-layer
// double-down read.
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); a co-located test's real import of THIS module
// is the dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_TUNING,
  deriveCurrentTradingDay,
} from '../../src/constants/leagueTournament.js';
import { formatEtDate } from './tournamentTime.js';

// The last trading day takes no new claims (legacy :251-260; the resolution
// would have nowhere to land them — there is no day 6).
export const LAST_CLAIM_DAY = 5;

/** Trim + uppercase a ticker, or '' for non-strings (legacy normalizeSymbol). */
export function normalizeSymbol(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

/**
 * Pure placement validation — the legacy order minus categories. Returns
 * `{ ok: true, currentDay }` or `{ ok: false, status, error, message }` (the
 * HTTP status is for the endpoint; the CPU caller just reads `ok`). Symbols are
 * expected already normalized by the caller.
 *
 * @param {Object} args
 * @param {Object} args.group   - tournamentGroups doc data (needs userPool, day clock)
 * @param {Object|null} args.player - the claiming player (group.players entry), or null
 * @param {string} args.dropSymbol - normalized ticker to drop
 * @param {string} args.addSymbol  - normalized ticker to add
 * @param {Date} [args.now]
 */
export function validateClaimPlacement({ group, player, dropSymbol, addSymbol, now = new Date() }) {
  if (!dropSymbol || !addSymbol || dropSymbol === addSymbol) {
    return { ok: false, status: 400, error: 'invalid_symbols', message: 'dropSymbol and addSymbol must be distinct tickers.' };
  }
  if (!player) {
    return { ok: false, status: 403, error: 'not_member', message: 'You are not a member of this group.' };
  }
  if (!(player.picks || []).some(p => p.symbol === dropSymbol)) {
    return { ok: false, status: 409, error: 'drop_not_on_roster', message: `${dropSymbol} is not on your roster.` };
  }
  if (!(group.userPool || []).includes(addSymbol)) {
    return { ok: false, status: 409, error: 'not_in_pool', message: `${addSymbol} is not in this group's claimable pool.` };
  }
  // Day-5 rule, derived from the banking record — deterministic on preview,
  // deliberately NOT bypassable by the dev window control.
  const currentDay = deriveCurrentTradingDay(group, formatEtDate(now));
  if (currentDay >= LAST_CLAIM_DAY) {
    return { ok: false, status: 409, error: 'battle_last_day', message: 'The battle is on its last day — no more claims.' };
  }
  return { ok: true, currentDay };
}

/**
 * The cap+duplicate check and the write share ONE transaction — without it,
 * parallel submissions both read size < cap and both land, making the 3-pending
 * fairness cap advisory. The awaited `tx.set` IS the rider #5 "placed" capture
 * (BUILD_RULES §5). Returns `{ claimId, claim }` or
 * `{ rejected: 'claim_cap_reached' | 'duplicate_claim' }`.
 *
 * @param {Object} db - Firestore admin
 * @param {Object} args
 * @param {string} args.groupId
 * @param {string} args.odUserId
 * @param {string|null} [args.username]
 * @param {string} args.dropSymbol - normalized
 * @param {string} args.addSymbol  - normalized
 * @param {number} [args.rank]
 * @param {Date} [args.now]
 */
export async function commitClaimPlacement(db, { groupId, odUserId, username = null, dropSymbol, addSymbol, rank = 1, now = new Date() }) {
  const nowIso = now.toISOString();
  const claim = {
    odUserId,
    username,
    dropSymbol,
    addSymbol,
    rank,
    status: 'pending',
    denialReason: null,
    processedAt: null,
    submittedAt: nowIso,
    createdAt: nowIso,
  };
  const claimsRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).collection('claims');

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

  if (placement.rejected) return placement;
  return { claimId: placement.claimId, claim };
}
