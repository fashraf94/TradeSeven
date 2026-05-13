// api/forge/watchlist-dialogue-abandon.js
//
// Sprint 6 Phase 3.6 PR 1 — abandon companion to watchlist-dialogue.js.
// Flips a watchlistSessions doc out of status='active' so we can distinguish
// abandoned dialogues from completed ones in shadow logs and Firestore. Phase
// 4's save endpoint will add the third terminal status ('completed').
//
// Status transitions:
//   reason='user_close'     → status='abandoned'
//   reason='finalize_intent'→ status='finalize_intent'
//
// Idempotent: calling abandon on an already-terminal session returns 200 with
// the existing terminal state preserved (the first abandon's reason / timestamp
// wins). Wrapped in a transaction so the read-status / write-status pair is
// atomic — concurrent abandons settle via Firestore optimistic concurrency,
// and an abandon-vs-dialogue-turn race is handled by the dialogue handler's
// existing `__concurrency:session_closed` sentinel (watchlist-dialogue.js:1037).
//
// Pattern reference: api/forge/watchlist-dialogue.js (security/auth middleware,
// Admin SDK transaction, shadow logger fire-and-forget). The abandon endpoint
// is intentionally narrow — no LLM calls, no dialogue-turn validation.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { FORGE_ID_REGEX, FORGE_ID_MAX_LEN, isValidForgeId } from '../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

// Two-value reason enum (locked Phase 3.6 PR 1 decision D1). budget_exceeded
// users tap the same finalize CTA so they send 'finalize_intent' too — the
// distinction is in WatchlistChat's CTA wiring, not the endpoint contract.
const VALID_REASONS = new Set(['user_close', 'finalize_intent']);

// Reason → terminal status map. Status enum after Phase 3.6:
// active | abandoned | finalize_intent. Phase 4's save endpoint adds 'completed'.
const REASON_TO_STATUS = Object.freeze({
  user_close: 'abandoned',
  finalize_intent: 'finalize_intent',
});

// Defense-in-depth char validation — same regex as the dropId hardening in
// watchlist-dialogue.js (Phase 2.5 Fix 1). Firestore rejects path-shaped
// slashes at the SDK level, but validating at the boundary surfaces the 400
// before any read. Phase 4A: validator moved to api/_utils/idValidation.js
// (shared with watchlist-dialogue.js and the new watchlist endpoints).

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { sessionId, agentId, reason } = req.body || {};

  if (!isValidForgeId(sessionId)) {
    return res.status(400).json({
      error: 'invalid_session_id',
      message: `sessionId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (typeof reason !== 'string' || !VALID_REASONS.has(reason)) {
    return res.status(400).json({
      error: 'invalid_reason',
      message: `reason must be one of: ${[...VALID_REASONS].join(', ')}`,
    });
  }

  const targetStatus = REASON_TO_STATUS[reason];
  const db = getFirebaseAdmin();
  const sessionRef = db.collection('watchlistSessions').doc(sessionId);
  const nowIso = new Date().toISOString();

  try {
    // Read-then-write inside a transaction. Sentinel errors translate to HTTP
    // status codes in the catch — same shape as watchlist-dialogue.js's
    // __concurrency:* pattern.
    const txResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) throw new Error('__abandon:not_found');

      const data = snap.data();
      if (data.userId !== user.uid) throw new Error('__abandon:forbidden');
      if (data.agentId !== agentId) throw new Error('__abandon:agent_mismatch');

      // Idempotency — already in any non-active terminal state. Per audit
      // decision B, abandon's goal IS to make the session not-active, so
      // already-terminal is success, not error. Preserves the first abandon's
      // reason / timestamp.
      if (data.status !== 'active') {
        return {
          idempotent: true,
          previousStatus: data.status,
          status: data.status,
          abandonReason: data.abandonReason || null,
          abandonedAt: data.abandonedAt || null,
        };
      }

      tx.update(sessionRef, {
        status: targetStatus,
        abandonReason: reason,
        abandonedAt: nowIso,
        updatedAt: nowIso,
      });
      return {
        idempotent: false,
        previousStatus: 'active',
        status: targetStatus,
        abandonReason: reason,
        abandonedAt: nowIso,
      };
    });

    waitUntil(
      logSignalDrops({
        stage: 'dialogue_abandon',
        sessionId,
        userId: user.uid,
        agentId,
        reason,
        previousStatus: txResult.previousStatus,
        newStatus: txResult.status,
        idempotent: txResult.idempotent,
        loggedAt: nowIso,
      }).catch(() => {}),
    );

    return res.status(200).json({
      sessionId,
      status: txResult.status,
      abandonReason: txResult.abandonReason,
      abandonedAt: txResult.abandonedAt,
      idempotent: txResult.idempotent,
    });
  } catch (err) {
    if (typeof err?.message === 'string' && err.message.startsWith('__abandon:')) {
      const code = err.message.split(':')[1];
      if (code === 'not_found') {
        return res.status(404).json({
          error: 'not_found',
          message: 'Watchlist dialogue session not found',
        });
      }
      if (code === 'forbidden') {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Not authorized for this session',
        });
      }
      if (code === 'agent_mismatch') {
        return res.status(400).json({
          error: 'agent_session_mismatch',
          message:
            'The agent for this session does not match the agent in the request.',
        });
      }
    }
    console.error('[watchlist-dialogue-abandon] Error:', err);
    return res.status(500).json({
      error: 'server_error',
      message: 'Something went wrong on the abandon path. Try again.',
    });
  }
}
