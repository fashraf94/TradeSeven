// api/forge/watchlists/[id]/delete.js
//
// Sprint 6 Phase 4D — POST /api/forge/watchlists/{id}/delete. Soft-deletes a
// watchlist by stamping a `deletedAt` timestamp. The "My Watchlists" list view
// surfaces the trash action; the list endpoint and the four single-item
// endpoints (GET, PATCH, commit, uncommit) all treat a deletedAt-set doc as
// gone.
//
// Soft, not hard: the document is preserved (status, tickers, thesis all
// intact) so the delete is recoverable by a future surface or by support.
// `status` is deliberately left untouched — a committed watchlist that is
// deleted keeps status:'committed'; the deletedAt stamp alone removes it from
// every read path.
//
// Idempotent: if the watchlist is already soft-deleted, return 200 with the
// existing deletedAt timestamp preserved. Mirrors the commit/uncommit
// already-terminal idempotency pattern.
//
// Pattern reference: api/forge/watchlists/[id]/uncommit.js (transaction body,
// sentinel error map, shadow log fire-and-forget).

import { getFirebaseAdmin } from '../../../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../../../_utils/security.js';
import { requireAuth } from '../../../_utils/authMiddleware.js';
import { logSignalDrops } from '../../../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../../../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__watchlist_delete:';

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

      // Idempotent: already soft-deleted → preserve the original deletedAt.
      if (data.deletedAt) {
        return {
          idempotent: true,
          deletedAt: data.deletedAt,
        };
      }

      tx.update(watchlistRef, {
        deletedAt: nowIso,
        updatedAt: nowIso,
      });
      return { idempotent: false, deletedAt: nowIso };
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
    console.error('[watchlists:delete] Error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not delete watchlist.' });
  }

  waitUntil(
    logSignalDrops({
      stage: 'watchlist_delete',
      userId: user.uid,
      watchlistId,
      idempotent: txResult.idempotent,
      deletedAt: txResult.deletedAt,
      loggedAt: nowIso,
    }).catch(() => {}),
  );

  return res.status(200).json({
    watchlistId,
    deletedAt: txResult.deletedAt,
    idempotent: txResult.idempotent,
  });
}
