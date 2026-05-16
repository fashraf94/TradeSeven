// api/forge/watchlists/[id]/uncommit.js
//
// Sprint 6 Phase 4B — POST /api/forge/watchlists/{id}/uncommit. Transitions a
// committed watchlist back to status='draft' so it can be edited again. The
// editor surfaces this as the "edit-unlock" flow: a committed watchlist is
// read-only until uncommit reopens it.
//
// Idempotent: if status is already 'draft', return 200 with the existing
// uncommittedAt timestamp preserved — null for a draft that was never
// committed in the first place. Mirrors the commit endpoint's
// already-terminal idempotency pattern.
//
// Clears committedAt and stamps uncommittedAt so a watchlist that was
// committed then reopened is distinguishable from one never committed.
//
// Pattern reference: api/forge/watchlists/[id]/commit.js (transaction body,
// sentinel error map, shadow log fire-and-forget).

import { getFirebaseAdmin } from '../../../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../../../_utils/security.js';
import { requireAuth } from '../../../_utils/authMiddleware.js';
import { logSignalDrops } from '../../../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../../../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__watchlist_uncommit:';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const watchlistId = req.query?.id;
  if (!isValidForgeId(watchlistId)) {
    return res.status(400).json({
      error: 'invalid_watchlist_id',
      message: `watchlistId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }

  const db = getFirebaseAdmin();
  const watchlistRef = db.collection('watchlists').doc(watchlistId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(watchlistRef);
      if (!snap.exists) throw new Error(SENTINEL_PREFIX + 'not_found');
      const data = snap.data();

      if (data.userId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // A soft-deleted watchlist reads as gone everywhere (Phase 4D).
      if (data.deletedAt) throw new Error(SENTINEL_PREFIX + 'not_found');

      // Idempotent: already a draft → preserve the original uncommittedAt
      // (null when the watchlist was never committed in the first place).
      if (data.status === 'draft') {
        return {
          idempotent: true,
          uncommittedAt: data.uncommittedAt || null,
        };
      }

      tx.update(watchlistRef, {
        status: 'draft',
        committedAt: null,
        uncommittedAt: nowIso,
        updatedAt: nowIso,
      });
      return { idempotent: false, uncommittedAt: nowIso };
    });
  } catch (txErr) {
    if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
      const code = txErr.message.slice(SENTINEL_PREFIX.length);
      if (code === 'not_found') {
        return res.status(404).json({ error: 'not_found', message: 'Watchlist not found.' });
      }
      if (code === 'forbidden') {
        return res.status(403).json({ error: 'forbidden', message: 'Not authorized for this watchlist.' });
      }
    }
    console.error('[watchlists:uncommit] Error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not uncommit watchlist.' });
  }

  waitUntil(
    logSignalDrops({
      stage: 'watchlist_uncommit',
      userId: user.uid,
      watchlistId,
      idempotent: txResult.idempotent,
      uncommittedAt: txResult.uncommittedAt,
      loggedAt: nowIso,
    }).catch(() => {}),
  );

  return res.status(200).json({
    watchlistId,
    status: 'draft',
    uncommittedAt: txResult.uncommittedAt,
    idempotent: txResult.idempotent,
  });
}
