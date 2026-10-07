// api/_utils/hypothesisRecords/http.js
//
// Pilot P1a — the request boundary shared by the two owner routes
// (api/forge/watchlists/[id]/hypothesis-versions.js and
// hypothesis-transition.js): the gate in its fixed order, body parsing into a
// typed payload, and the typed error answer.
//
// THE GATE ORDER: security middleware (headers, CORS, preflight, rate limit)
// → the FLAG (off → 404 { error: 'disabled' } before auth, before any read)
// → auth (no verified token → 401: the gate is per verified uid, the house
// order of every per-uid gated route — backing/event.js, cockpit-status.js)
// → the ALLOWLIST (off for this caller → the same 404, whatever the method)
// → the method → the id. What holds: an authenticated caller the gate
// resolves off for gets 404 { error: 'disabled' } for every request, before
// any read, and no answer anywhere depends on who else is admitted (review
// L3-1). The flag's own value is public (it ships in the client bundle).

import { applySecurityMiddleware } from '../security.js';
import { requireAuth } from '../authMiddleware.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../idValidation.js';
import { hypothesisRecordsFlagOn, isHypothesisOwnerAllowlisted, DISABLED_BODY } from './gate.js';
import {
  HORIZON_ENUMS, HypothesisInputError, isVersionNumber, normalizeStatement, normalizeConditions,
} from './model.js';

/**
 * Run the gate. Resolves the authenticated user, or null when the route has
 * already answered (middleware, disabled, method, auth or id).
 */
export async function gateHypothesisRoute(req, res, { methods, rateLimit }) {
  if (applySecurityMiddleware(req, res, { rateLimit })) return null;
  if (!hypothesisRecordsFlagOn()) {
    res.status(404).json({ ...DISABLED_BODY });
    return null;
  }
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!isHypothesisOwnerAllowlisted(user.uid)) {
    res.status(404).json({ ...DISABLED_BODY });
    return null;
  }
  if (!methods.includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }
  const watchlistId = req.query?.id;
  if (!isValidForgeId(watchlistId)) {
    res.status(400).json({
      error: 'invalid_watchlist_id',
      message: `watchlistId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
    return null;
  }
  return { user, watchlistId };
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

/** A caller-supplied opId (a client UUID): the forge-id character class. */
export function requireOpId(body) {
  if (!isValidForgeId(body?.opId)) throw new HypothesisInputError('invalid_op_id', 'opId must be a forge id (letters, digits, - and _).');
  return body.opId;
}

/** The pointer value the caller last saw: 0 (no version yet) or a version number. */
export function requireExpectedVersion(body) {
  const v = body?.expectedVersion;
  if (!(v === 0 || isVersionNumber(v))) throw new HypothesisInputError('invalid_expected_version', 'expectedVersion must be 0 or a positive integer.');
  return v;
}

/** A version number named by the caller. */
export function requireVersion(raw) {
  const v = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
  if (!isVersionNumber(v)) throw new HypothesisInputError('invalid_version', 'version must be a positive integer.');
  return v;
}

/**
 * The content part of a create / reaffirm request, normalized. Only the
 * fields the caller SENT appear in the payload (an absent horizon inherits —
 * a sent one is the player's pick, source 'player'). `statement` is required
 * for a create and optional for a reaffirmation ("same or edited content").
 * Evidence refs, publishedAt and origin are never caller-supplied.
 */
export function parseContentPayload(body, { requireStatement }) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const payload = {};
  if (has(b, 'statement') || requireStatement) payload.statement = normalizeStatement(b.statement);
  if (has(b, 'horizonEnum')) {
    if (!HORIZON_ENUMS.includes(b.horizonEnum)) throw new HypothesisInputError('invalid_horizon', `horizonEnum must be one of ${HORIZON_ENUMS.join(', ')}.`);
    payload.horizonEnum = b.horizonEnum;
  }
  if (has(b, 'activation')) payload.activation = normalizeConditions(b.activation);
  if (has(b, 'invalidation')) payload.invalidation = normalizeConditions(b.invalidation);
  return payload;
}

/** Answer a thrown error: a typed input error → 400, a typed route error → its status, anything else → 500. */
export function sendHypothesisError(res, err, label) {
  if (err?.hypothesisInput) return res.status(400).json({ error: err.code, message: err.message });
  if (err?.hypothesisRoute) return res.status(err.status).json({ error: err.code, message: err.message, ...err.extra });
  console.error(`[hypothesis:${label}] Error:`, err);
  return res.status(500).json({ error: 'server_error', message: 'Something went wrong with the idea record. Try again.' });
}
