// api/forge/watchlists.js
//
// Sprint 6 Phase 4A — POST /api/forge/watchlists (create).
// Sprint 6 Phase 4D — GET /api/forge/watchlists (list).
//
// POST replaces the Phase 3.6 fireAbandon('finalize_intent') call from
// WatchlistChat.handleFinalizeClose with a real save: creates a
// watchlists/{id} doc from the dialogue session's anatomy + candidateTickers,
// transitions the session to 'completed', and writes the new watchlist's id
// back to session.dropListId.
//
// GET lists the authenticated user's non-deleted watchlists for the Phase 4D
// "My Watchlists" tab. Soft-deleted docs are filtered in memory — a Firestore
// where('deletedAt','==',null) query would miss pre-Phase-4D docs that have no
// deletedAt field at all. Results are unordered; the client sorts by updatedAt.
//
// The POST transaction body holds the session-doc read + watchlist-doc write +
// session-doc update atomic. The pre-transaction read is a cheap idempotency
// shortcut for the common double-tap-save case (skips the whole transaction
// when the session is already 'completed' with a dropListId set). The
// in-transaction re-read closes the TOCTOU window between pre-tx and tx-body.
//
// Pattern reference: api/forge/watchlist-dialogue-abandon.js (sentinel error
// shape, transaction body, shadow-log fire-and-forget). The deltas:
//   * Multi-doc write inside the transaction (session.update + watchlists.set
//     against an auto-allocated ref).
//   * Two-layer idempotency (pre-tx + in-tx) per Phase 4A audit A-A-3.
//   * Server-trusted sourceDropId derived from session.dropId (not the request
//     body) per audit A-A-2 — the session's dropId was already verified at
//     session creation by watchlist-dialogue.js, so we trust the chain.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

// Sentinel-error catalog. Strings prefixed with '__watchlist_create:' so the
// catch can distinguish them from unexpected errors. Same pattern as
// watchlist-dialogue.js's __concurrency:* sentinels.
const SENTINEL_PREFIX = '__watchlist_create:';
const SENTINEL_TO_HTTP = Object.freeze({
  session_not_found:     [404, 'session_not_found'],
  forbidden:             [403, 'forbidden'],
  agent_mismatch:        [400, 'agent_session_mismatch'],
  drop_session_mismatch: [400, 'drop_session_mismatch'],
  invalid_status:        [409, 'invalid_status'],
  inconsistent_state:    [409, 'inconsistent_state'],
});

const SENTINEL_HUMAN_COPY = Object.freeze({
  session_not_found:     'Watchlist dialogue session not found.',
  forbidden:             'Not authorized for this session.',
  agent_mismatch:        'The agent for this session does not match the agent in the request.',
  drop_session_mismatch: 'The dropId for this session does not match the dropId in the request.',
  invalid_status:        'This dialogue is in an unsaveable state (already abandoned).',
  inconsistent_state:    'Session is marked completed but missing a watchlist reference. Contact support.',
});

// Status branching at the transaction body. Defined as constants so the
// test file can assert against the same enum.
const SESSION_STATUS_SAVEABLE = new Set(['active', 'finalize_intent']);

export default async function handler(req, res) {
  const method = req.method;
  if (method !== 'GET' && method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // applySecurityMiddleware is not method-aware; reads tolerate a higher
  // cadence than the create transaction, so the limit is picked per method.
  const rateLimit =
    method === 'GET' ? { limit: 30, windowMs: 60_000 } : { limit: 10, windowMs: 60_000 };
  if (applySecurityMiddleware(req, res, { rateLimit })) {
    return;
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (method === 'GET') return handleList({ user, res });
  return handleCreate({ req, res, user });
}

// ── GET: list the user's non-deleted watchlists (Phase 4D) ────────────
async function handleList({ user, res }) {
  try {
    const db = getFirebaseAdmin();
    const snap = await db
      .collection('watchlists')
      .where('userId', '==', user.uid)
      .get();
    const watchlists = snap.docs
      .map((d) => ({ ...d.data(), watchlistId: d.id }))
      .filter((doc) => !doc.deletedAt);
    return res.status(200).json({ watchlists });
  } catch (err) {
    console.error('[watchlists:GET] Error:', err);
    return res
      .status(500)
      .json({ error: 'server_error', message: 'Could not load watchlists.' });
  }
}

// ── POST: create a watchlist from a finalized dialogue session ────────
async function handleCreate({ req, res, user }) {
  const { sessionId, agentId, dropId } = req.body || {};

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
  if (!isValidForgeId(dropId)) {
    return res.status(400).json({
      error: 'invalid_drop_id',
      message: `dropId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }

  const db = getFirebaseAdmin();
  const sessionRef = db.collection('watchlistSessions').doc(sessionId);
  const watchlistRef = db.collection('watchlists').doc(); // pre-allocate auto-id
  const nowIso = new Date().toISOString();

  // ── Pre-transaction idempotency shortcut ────────────────────────
  // Cheap path for the user double-tap-save case: read the session once
  // OUTSIDE the transaction. If it's already terminal-completed with a
  // dropListId set, return idempotent immediately. Skips the transaction
  // overhead entirely.
  //
  // Race-safe because the in-tx body re-reads and re-checks status. A user
  // who double-taps in flight either lands here on the second call (cheap)
  // or in the in-tx idempotent branch (correct).
  try {
    const preTxSnap = await sessionRef.get();
    if (!preTxSnap.exists) {
      return res.status(404).json({
        error: 'session_not_found',
        message: SENTINEL_HUMAN_COPY.session_not_found,
      });
    }
    const preTxSession = preTxSnap.data();
    if (preTxSession.userId !== user.uid) {
      return res.status(403).json({
        error: 'forbidden',
        message: SENTINEL_HUMAN_COPY.forbidden,
      });
    }
    if (preTxSession.status === 'completed' && preTxSession.dropListId) {
      waitUntil(
        logSignalDrops({
          stage: 'watchlist_create',
          userId: user.uid,
          agentId,
          sessionId,
          dropId,
          watchlistId: preTxSession.dropListId,
          idempotent: true,
          idempotentSource: 'pre_tx',
          loggedAt: nowIso,
        }).catch(() => {}),
      );
      return res.status(200).json({
        watchlistId: preTxSession.dropListId,
        status: 'draft',
        idempotent: true,
      });
    }
  } catch (err) {
    console.error('[watchlists:POST] pre-tx read failed:', err?.message || err);
    return res.status(500).json({ error: 'server_error', message: 'Could not load session.' });
  }

  // ── Transaction body ────────────────────────────────────────────
  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(sessionRef);
      if (!freshSnap.exists) throw new Error(SENTINEL_PREFIX + 'session_not_found');
      const session = freshSnap.data();

      if (session.userId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (session.agentId !== agentId) throw new Error(SENTINEL_PREFIX + 'agent_mismatch');
      // Per audit A-A-2: trust the session's verified dropId, cross-check the
      // request's dropId against it. Skips the drop-doc read entirely.
      if (session.dropId !== dropId) throw new Error(SENTINEL_PREFIX + 'drop_session_mismatch');

      // Per audit A-A-3: in-tx idempotency branches (TOCTOU re-check).
      if (session.status === 'completed') {
        if (session.dropListId) {
          return {
            idempotent: true,
            idempotentSource: 'in_tx',
            watchlistId: session.dropListId,
            tickerCount: null,
          };
        }
        throw new Error(SENTINEL_PREFIX + 'inconsistent_state');
      }
      if (!SESSION_STATUS_SAVEABLE.has(session.status)) {
        throw new Error(SENTINEL_PREFIX + 'invalid_status');
      }

      // Build watchlist content from session.
      // Ticker filter per D-9.2: keep proposed + kept, drop removed.
      // Ticker shape per D-9.9: strip slot/status/proposedAt/proposedAtPhase.
      const tickers = (Array.isArray(session.candidateTickers) ? session.candidateTickers : [])
        .filter((t) => t && t.status !== 'removed')
        .map((t) => ({
          symbol: typeof t.symbol === 'string' ? t.symbol : '',
          reasoning: typeof t.reasoning === 'string' ? t.reasoning : '',
          category: typeof t.category === 'string' ? t.category : '',
          addedBy: 'agent',
          addedAt: nowIso,
        }));

      const anatomy =
        session.anatomy && typeof session.anatomy === 'object' && !Array.isArray(session.anatomy)
          ? session.anatomy
          : {};

      const watchlistDoc = {
        watchlistId: watchlistRef.id,
        userId: user.uid,
        agentId,
        sourceSessionId: sessionId,
        sourceDropId: session.dropId, // server-trusted (per A-A-2)
        thesis: typeof anatomy.thesis === 'string' ? anatomy.thesis : '',
        activationConditions: Array.isArray(anatomy.activationConditions)
          ? anatomy.activationConditions.filter((c) => typeof c === 'string')
          : [],
        invalidationConditions: Array.isArray(anatomy.invalidationConditions)
          ? anatomy.invalidationConditions.filter((c) => typeof c === 'string')
          : [],
        tickers,
        name: '', // D-A-1: empty default; Phase 4B's editor surfaces the field.
        notes: '',
        status: 'draft',
        createdAt: nowIso,
        updatedAt: nowIso,
        committedAt: null,
      };

      // Per audit A-A-1: tx.set, not tx.create. Auto-id collisions are
      // mathematically negligible (~120 bits entropy from .doc()).
      tx.set(watchlistRef, watchlistDoc);
      tx.update(sessionRef, {
        status: 'completed',
        dropListId: watchlistRef.id,
        updatedAt: nowIso,
      });

      return {
        idempotent: false,
        idempotentSource: null,
        watchlistId: watchlistRef.id,
        tickerCount: tickers.length,
      };
    });
  } catch (txErr) {
    if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
      const code = txErr.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey] = mapped;
        return res.status(statusCode).json({
          error: errorKey,
          message: SENTINEL_HUMAN_COPY[code],
        });
      }
    }
    console.error('[watchlists:POST] Error:', txErr);
    return res.status(500).json({
      error: 'server_error',
      message: 'Something went wrong saving the watchlist. Try again.',
    });
  }

  waitUntil(
    logSignalDrops({
      stage: 'watchlist_create',
      userId: user.uid,
      agentId,
      sessionId,
      dropId,
      watchlistId: txResult.watchlistId,
      idempotent: txResult.idempotent,
      idempotentSource: txResult.idempotentSource,
      tickerCount: txResult.tickerCount,
      loggedAt: nowIso,
    }).catch(() => {}),
  );

  return res.status(200).json({
    watchlistId: txResult.watchlistId,
    status: 'draft',
    tickerCount: txResult.tickerCount,
    createdAt: nowIso,
    idempotent: txResult.idempotent,
  });
}
