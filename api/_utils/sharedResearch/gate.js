// api/_utils/sharedResearch/gate.js
//
// Shared Research — THE SERVER GATE (spec §6.2, D-4, K-2). SHARED_RESEARCH_MODE
// resolves per OWNER, at call time:
//   'off'        nobody — every request answers 404 { error: 'disabled' } before
//                auth and before any read;
//   'allowlist'  only a uid the cockpit's SERVER-SIDE allowlist admits
//                (api/_utils/callRecords/mode.js isCockpitOwnerAllowlisted, read
//                at call time) AND idea-record admission (hypothesisRecordsOnFor:
//                adoption writes idea records);
//   'on'         every verified uid idea-record admission admits.
// Unknown values resolve to 'off'. Pure apart from the environment reads; never
// throws.
//
// THE GATE ORDER (hypothesisRecords/http.js, filmRoom/cardsGate.js): security
// middleware (headers, CORS, preflight, the rate limiter — 10 POST / 30 GET a
// minute per caller) → Cache-Control: no-store → the MODE (off → 404 before
// auth) → auth (no verified token → 401) → the owner's admission (off for this
// caller → the same 404, whatever the method) → the method.

import { SHARED_RESEARCH_MODE, SHARED_RESEARCH_MODES } from '../../../src/config/sharedResearchFlags.js';
import { isCockpitOwnerAllowlisted } from '../callRecords/mode.js';
import { hypothesisRecordsOnFor } from '../hypothesisRecords/gate.js';
import { applySecurityMiddleware } from '../security.js';
import { requireAuth } from '../authMiddleware.js';
import { ResearchRecordError } from '../researchRecords/model.js';
import { copyFor } from './copy.js';

const OFF = 'off';
export const RATE_LIMITS = Object.freeze({
  POST: Object.freeze({ limit: 10, windowMs: 60_000 }),
  GET: Object.freeze({ limit: 30, windowMs: 60_000 }),
});
export const DISABLED_BODY = Object.freeze({ error: 'disabled' });

/** The mode as the server reads it NOW: one of the walked states, else 'off'. Never throws. */
export function sharedResearchMode() {
  try {
    const mode = SHARED_RESEARCH_MODE;
    return Array.isArray(SHARED_RESEARCH_MODES) && SHARED_RESEARCH_MODES.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/** The gate for one caller (D-4): the mode's admission AND idea-record admission. Never throws. */
export function sharedResearchOnFor(uid) {
  try {
    if (typeof uid !== 'string' || uid.length === 0) return false;
    const mode = sharedResearchMode();
    const admitted = mode === 'on' ? true : mode === 'allowlist' ? isCockpitOwnerAllowlisted(uid) === true : false;
    return admitted && hypothesisRecordsOnFor(uid) === true;
  } catch {
    return false;
  }
}

/**
 * Run the gate. Resolves `{ user }`, or null when the route has already
 * answered (middleware, disabled, auth or method).
 */
export async function gateSharedResearchRoute(req, res, { methods = ['GET', 'POST'] } = {}) {
  const rateLimit = req?.method === 'GET' ? RATE_LIMITS.GET : RATE_LIMITS.POST;
  if (applySecurityMiddleware(req, res, { rateLimit })) return null;
  res.setHeader('Cache-Control', 'no-store');
  if (sharedResearchMode() === OFF) {
    res.status(404).json({ ...DISABLED_BODY });
    return null;
  }
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!sharedResearchOnFor(user.uid)) {
    res.status(404).json({ ...DISABLED_BODY });
    return null;
  }
  if (!methods.includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }
  return { user };
}

export { SharedResearchError, refuse } from './session.js';

/** The record model's own codes that are the caller's fault (passed through as 400s); the rest are 500s. */
const RECORD_CLIENT_CODES = new Set(['invalid_question', 'record_closed', 'question_missing', 'findings_full', 'summary_revisions_full']);

/**
 * Answer a thrown error (the sendHypothesisError shape): a SharedResearchError →
 * its status; a HypothesisInputError (the adoption builder's refusal) → 400
 * `invalid_adoption` with the builder's code as `reason`; a ResearchRecordError
 * → 400 with its code when it is the caller's, else 500; anything else → 500.
 */
export function sendSharedResearchError(res, err, label) {
  if (err?.sharedResearch) return res.status(err.status).json({ error: err.code, message: copyFor(err.code), ...err.extra });
  if (err?.hypothesisInput) return res.status(400).json({ error: 'invalid_adoption', reason: err.code, message: copyFor('invalid_adoption') });
  if (err instanceof ResearchRecordError || err?.researchRecord) {
    if (RECORD_CLIENT_CODES.has(err.code)) return res.status(400).json({ error: err.code, message: copyFor(err.code) });
    console.error(`[shared-research] ${label} record refusal:`, err.code);
    return res.status(500).json({ error: 'server_error', reason: err.code, message: copyFor('server_error') });
  }
  console.error(`[shared-research] ${label} error:`, err?.message || err);
  return res.status(500).json({ error: 'server_error', message: copyFor('server_error') });
}
