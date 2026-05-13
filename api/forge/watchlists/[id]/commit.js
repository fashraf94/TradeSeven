// api/forge/watchlists/[id]/commit.js
//
// Sprint 6 Phase 4A — POST /api/forge/watchlists/{id}/commit. Transitions a
// draft watchlist to status='committed'. Phase 4A ships the endpoint with no
// FE consumer; Phase 4B's editor will surface the commit ceremony.
//
// Commit-readiness criteria locked in Phase 4A audit D-A-2: at least one
// ticker. No thesis requirement (a "watch these names" list is a valid
// preference signal even without a written thesis). Empty/zero-ticker commits
// are 400 not_commit_ready — a watchlist with no tickers serves no
// preference-signal purpose.
//
// Idempotent: if status is already 'committed', return 200 with the existing
// committedAt timestamp preserved (mirrors the abandon endpoint's
// already-terminal idempotency pattern).
//
// Pattern reference: api/forge/watchlist-dialogue-abandon.js (transaction
// body, sentinel error map, shadow log fire-and-forget).

import { getFirebaseAdmin } from '../../../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../../../_utils/security.js';
import { requireAuth } from '../../../_utils/authMiddleware.js';
import { logSignalDrops } from '../../../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../../../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__watchlist_commit:';

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

      // Idempotent: already committed → preserve original committedAt.
      if (data.status === 'committed') {
        return {
          idempotent: true,
          committedAt: data.committedAt || null,
        };
      }

      // Commit-readiness per D-A-2: ≥1 ticker.
      const tickers = Array.isArray(data.tickers) ? data.tickers : [];
      if (tickers.length === 0) {
        throw new Error(SENTINEL_PREFIX + 'not_commit_ready');
      }

      tx.update(watchlistRef, {
        status: 'committed',
        committedAt: nowIso,
        updatedAt: nowIso,
      });
      return { idempotent: false, committedAt: nowIso };
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
      if (code === 'not_commit_ready') {
        return res.status(400).json({
          error: 'not_commit_ready',
          message: 'A watchlist needs at least one ticker before it can be committed.',
        });
      }
    }
    console.error('[watchlists:commit] Error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not commit watchlist.' });
  }

  waitUntil(
    logSignalDrops({
      stage: 'watchlist_commit',
      userId: user.uid,
      watchlistId,
      idempotent: txResult.idempotent,
      committedAt: txResult.committedAt,
      loggedAt: nowIso,
    }).catch(() => {}),
  );

  return res.status(200).json({
    watchlistId,
    status: 'committed',
    committedAt: txResult.committedAt,
    idempotent: txResult.idempotent,
  });
}
