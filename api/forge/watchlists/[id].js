// api/forge/watchlists/[id].js
//
// Sprint 6 Phase 4A — GET + PATCH /api/forge/watchlists/{id}.
//
// GET loads a single watchlist (Phase 4B's editor will consume this).
// PATCH updates editable fields on a draft watchlist (auto-save target for
// Phase 4B). Both require ownership; PATCH additionally rejects with 409
// when the target watchlist has already been committed.
//
// PATCH no-op success: a request body with no recognized fields (or only
// unknown fields) returns 200 with updatedAt bumped, no other writes. This
// is a forward-compat affordance for Phase 4B's auto-save loop — the FE can
// pulse PATCH without first computing a diff, and the updatedAt bump is
// useful for Phase 4D's list view sorting. Unknown fields are silently
// ignored so PATCH stays forward-compatible across schema evolution.
//
// Phase 4A ships these endpoints with no FE consumer. Phase 4B's editor wires
// them up. Tests cover them now so the contract is locked.
//
// Pattern reference: api/forge/watchlist-dialogue-abandon.js (auth, sentinel
// errors, shadow log fire-and-forget). Field caps for PATCH validation are
// locked in the Phase 4A audit Section 9 — string fields trim/cap silently,
// structural shape errors return 400.

import { getFirebaseAdmin } from '../../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../../_utils/security.js';
import { requireAuth } from '../../_utils/authMiddleware.js';
import { logSignalDrops } from '../../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

// Field caps locked in Phase 4A audit Section 9.
const NAME_MAX_LEN = 100;
const NOTES_MAX_LEN = 2000;
const THESIS_MAX_LEN = 1000;
const CONDITION_MAX_LEN = 200;
const CONDITIONS_MAX_COUNT = 3;

// Per-ticker caps mirror Phase 2.6 dialogue caps (so the shapes round-trip
// cleanly between the dialogue and the persisted watchlist).
const TICKER_SYMBOL_MAX_LEN = 12;
const TICKER_REASONING_MAX_LEN = 500;
const TICKER_CATEGORY_MAX_LEN = 30;
const TICKERS_MAX_COUNT = 40;

const VALID_ADDED_BY = new Set(['agent', 'user']);

// Capped string trimmer. Returns the trimmed string ≤cap, or null if input
// isn't a string. Empty strings are preserved (PATCH can clear a field).
function capString(value, cap) {
  if (typeof value !== 'string') return null;
  return value.slice(0, cap).trim();
}

function capConditionsArray(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.slice(0, CONDITION_MAX_LEN).trim();
    if (!trimmed) continue;
    out.push(trimmed);
    if (out.length >= CONDITIONS_MAX_COUNT) break;
  }
  return out;
}

function capTickersArray(value, nowIso) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const t of value) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
    const symbol =
      typeof t.symbol === 'string' ? t.symbol.trim().toUpperCase().slice(0, TICKER_SYMBOL_MAX_LEN) : '';
    if (!symbol) continue;
    out.push({
      symbol,
      reasoning:
        typeof t.reasoning === 'string'
          ? t.reasoning.slice(0, TICKER_REASONING_MAX_LEN).trim()
          : '',
      category:
        typeof t.category === 'string'
          ? t.category.slice(0, TICKER_CATEGORY_MAX_LEN).trim()
          : '',
      addedBy: VALID_ADDED_BY.has(t.addedBy) ? t.addedBy : 'user',
      addedAt: typeof t.addedAt === 'string' ? t.addedAt : nowIso,
    });
    if (out.length >= TICKERS_MAX_COUNT) break;
  }
  return out;
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60_000 } })) {
    return;
  }

  const method = req.method;
  if (method !== 'GET' && method !== 'PATCH') {
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

  if (method === 'GET') {
    return handleGet({ watchlistRef, watchlistId, user, res });
  }
  return handlePatch({ watchlistRef, watchlistId, user, req, res });
}

async function handleGet({ watchlistRef, watchlistId, user, res }) {
  try {
    const snap = await watchlistRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'not_found', message: 'Watchlist not found.' });
    }
    const data = snap.data();
    if (data.userId !== user.uid) {
      return res.status(403).json({ error: 'forbidden', message: 'Not authorized for this watchlist.' });
    }
    return res.status(200).json({ watchlist: { ...data, watchlistId } });
  } catch (err) {
    console.error('[watchlists:GET] Error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not load watchlist.' });
  }
}

async function handlePatch({ watchlistRef, watchlistId, user, req, res }) {
  const body = req.body || {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'invalid_body', message: 'Request body must be an object.' });
  }

  const nowIso = new Date().toISOString();
  const updates = { updatedAt: nowIso };

  // Per-field validation. Strings: trim/cap silently. Arrays: structural
  // shape error returns 400. Unknown fields are ignored (forward-compat).
  if ('name' in body) {
    const v = capString(body.name, NAME_MAX_LEN);
    if (v === null) {
      return res.status(400).json({ error: 'invalid_field', message: 'name must be a string.' });
    }
    updates.name = v;
  }
  if ('notes' in body) {
    const v = capString(body.notes, NOTES_MAX_LEN);
    if (v === null) {
      return res.status(400).json({ error: 'invalid_field', message: 'notes must be a string.' });
    }
    updates.notes = v;
  }
  if ('thesis' in body) {
    const v = capString(body.thesis, THESIS_MAX_LEN);
    if (v === null) {
      return res.status(400).json({ error: 'invalid_field', message: 'thesis must be a string.' });
    }
    updates.thesis = v;
  }
  if ('activationConditions' in body) {
    const v = capConditionsArray(body.activationConditions);
    if (v === null) {
      return res
        .status(400)
        .json({ error: 'invalid_field', message: 'activationConditions must be an array.' });
    }
    updates.activationConditions = v;
  }
  if ('invalidationConditions' in body) {
    const v = capConditionsArray(body.invalidationConditions);
    if (v === null) {
      return res
        .status(400)
        .json({ error: 'invalid_field', message: 'invalidationConditions must be an array.' });
    }
    updates.invalidationConditions = v;
  }
  if ('tickers' in body) {
    const v = capTickersArray(body.tickers, nowIso);
    if (v === null) {
      return res
        .status(400)
        .json({ error: 'invalid_field', message: 'tickers must be an array.' });
    }
    updates.tickers = v;
  }

  // No updatable fields aside from updatedAt? Treat as no-op success per the
  // file-header forward-compat note — Phase 4B's auto-save loop may pulse
  // PATCH with empty/no-change diffs. The updatedAt bump still happens
  // (useful for Phase 4D's list-view sorting); no other writes fire.
  const hasContent = Object.keys(updates).length > 1;

  try {
    const txResult = await db_runPatchTx({
      db: getFirebaseAdmin(),
      watchlistRef,
      user,
      updates,
      hasContent,
    });
    if (txResult.error) {
      return res.status(txResult.statusCode).json({
        error: txResult.error,
        message: txResult.message,
      });
    }

    waitUntil(
      logSignalDrops({
        stage: 'watchlist_patch',
        userId: user.uid,
        watchlistId,
        fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
        loggedAt: nowIso,
      }).catch(() => {}),
    );

    return res.status(200).json({ watchlistId, updatedAt: nowIso });
  } catch (err) {
    console.error('[watchlists:PATCH] Error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not update watchlist.' });
  }
}

// Extracted as a standalone helper so the test file can stub or call it
// directly if needed; also keeps handlePatch readable.
async function db_runPatchTx({ db, watchlistRef, user, updates, hasContent }) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(watchlistRef);
    if (!snap.exists) {
      return { error: 'not_found', statusCode: 404, message: 'Watchlist not found.' };
    }
    const data = snap.data();
    if (data.userId !== user.uid) {
      return { error: 'forbidden', statusCode: 403, message: 'Not authorized for this watchlist.' };
    }
    if (data.status === 'committed') {
      return {
        error: 'invalid_status',
        statusCode: 409,
        message: 'Cannot edit a committed watchlist directly.',
      };
    }
    if (hasContent) {
      tx.update(watchlistRef, updates);
    }
    return { ok: true };
  });
}
