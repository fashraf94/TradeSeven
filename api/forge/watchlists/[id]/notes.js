// api/forge/watchlists/[id]/notes.js
//
// Analysis Hand-off — Phase 2. POST /api/forge/watchlists/{id}/notes.
//
// Writes ONLY the `notes` field, regardless of status. This is the deliberate
// divergence from PATCH /api/forge/watchlists/{id} (which 409s on a committed
// watchlist): the analysis surface saves a user-authored summary onto a saved
// cohort, and Phase-1 saved cohorts are committed. Tickers / thesis / conditions
// / status are structurally un-writable here — the handler reads nothing else
// off the body — so the broader edit-lock on committed watchlists is preserved.
//
// notes is user-facing only. It does NOT reach the agent (the agent reads
// name/tickers/thesis off an equipped watchlist; notes is never forwarded).
//
// Pattern reference: api/forge/watchlists/[id]/commit.js (transaction body,
// owner-scope, shadow-log fire-and-forget). The existing PATCH + commit handlers
// are untouched. Server-only write via the Admin SDK — no firestore.rules change.

import { getFirebaseAdmin } from '../../../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../../../_utils/security.js';
import { requireAuth } from '../../../_utils/authMiddleware.js';
import { logSignalDrops } from '../../../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../../../_utils/idValidation.js';
import { capString, NOTES_MAX_LEN } from '../../../_utils/watchlistValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__watchlist_notes:';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60_000 } })) {
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

  // Read ONLY notes off the body. Anything else is ignored — this route cannot
  // mutate tickers/thesis/conditions/status.
  const notes = capString(req.body?.notes, NOTES_MAX_LEN);
  if (notes === null) {
    return res.status(400).json({ error: 'invalid_field', message: 'notes must be a string.' });
  }

  const db = getFirebaseAdmin();
  const watchlistRef = db.collection('watchlists').doc(watchlistId);
  const nowIso = new Date().toISOString();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(watchlistRef);
      if (!snap.exists) throw new Error(SENTINEL_PREFIX + 'not_found');
      const data = snap.data();
      if (data.userId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // A soft-deleted watchlist reads as gone everywhere.
      if (data.deletedAt) throw new Error(SENTINEL_PREFIX + 'not_found');

      // No status gate — notes may be written on a committed watchlist.
      tx.update(watchlistRef, { notes, updatedAt: nowIso });
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
    console.error('[watchlists:notes] Error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not save notes.' });
  }

  waitUntil(
    logSignalDrops({
      stage: 'watchlist_notes_update',
      userId: user.uid,
      watchlistId,
      notesLength: notes.length,
      loggedAt: nowIso,
    }).catch(() => {}),
  );

  return res.status(200).json({ watchlistId, updatedAt: nowIso });
}
