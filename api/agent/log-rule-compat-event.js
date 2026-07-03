// api/agent/log-rule-compat-event.js
//
// WS1 Phase 2 — telemetry endpoint for the rule-vs-archetype observe stream
// (RULE_COMPAT_MODE 'observe' / 'enforce'). Rule-doc writes are client-direct
// to Firestore (no server write endpoint exists to ride), so the client guard
// (src/services/ruleCompatGuard.js) POSTs its events here — the
// log-watchlist-equip precedent: awaited emission, NEVER a silent
// fire-and-forget `.catch(() => {})` (the shadow logger's silent multi-week
// data loss is the cautionary tale).
//
// Defense-in-depth: 404s while RULE_COMPAT_MODE is 'off' (the scouting-board
// pattern) — with the flag off no client emits, and the surface stays dark.
//
// Import note (BUILD_RULES §4): the featureFlags + compatibility imports are
// api → src and Node-clean (both are zero-import data modules); the test
// file's imports are the dependency-surface guard.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { RULE_COMPAT_MODE } from '../../src/config/featureFlags.js';
import { ARCHETYPE_KEYS } from '../../src/data/archetypeRuleCompatibility.js';

export const config = { maxDuration: 10 };

// compat_archetype_change_rescan is deliberately ABSENT: rescan events are
// emitted server-side by change-archetype.js directly to the shadow logger,
// never posted through this client endpoint.
const VALID_EVENT_TYPES = new Set([
  'compat_conflict_equip',
  'compat_promote_blocked',
]);
const VALID_PATHS = new Set([
  'create_rule',
  'set_rule_hardness',
  'update_rule_category',
  'reforge_carry',
  'equip_bundle',
]);
const VALID_MODES = new Set(['observe', 'enforce']);
const MAX_EVENTS = 20;
const MAX_STR = 120;

function sanitizeEvent(e) {
  if (!e || typeof e !== 'object') return null;
  if (!VALID_EVENT_TYPES.has(e.type)) return null;
  if (!VALID_PATHS.has(e.path)) return null;
  if (typeof e.ruleId !== 'string' || e.ruleId.length === 0 || e.ruleId.length > MAX_STR) return null;
  return {
    type: e.type,
    ruleId: e.ruleId,
    ruleDocId: typeof e.ruleDocId === 'string' && e.ruleDocId.length <= MAX_STR ? e.ruleDocId : null,
    state: e.state === 'core_conflict' ? e.state : null,
    zone1Ref: typeof e.zone1Ref === 'string' && e.zone1Ref.length <= MAX_STR ? e.zone1Ref : null,
    hardnessRequested: e.hardnessRequested === 'hard' || e.hardnessRequested === 'soft' ? e.hardnessRequested : null,
    path: e.path,
    blocked: e.blocked === true,
    ts: typeof e.ts === 'string' && e.ts.length <= MAX_STR ? e.ts : null,
  };
}

export default async function handler(req, res) {
  // Dark while the feature is off (defense-in-depth; clients emit nothing).
  if (RULE_COMPAT_MODE !== 'observe' && RULE_COMPAT_MODE !== 'enforce') {
    return res.status(404).json({ error: 'not_found' });
  }
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, archetype, mode, events } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!VALID_MODES.has(mode)) {
    return res.status(400).json({ error: 'invalid_mode', message: "mode must be 'observe' or 'enforce'" });
  }
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS) {
    return res.status(400).json({
      error: 'invalid_events',
      message: `events must be a non-empty array of at most ${MAX_EVENTS}`,
    });
  }
  const sanitized = events.map(sanitizeEvent);
  if (sanitized.some((e) => e === null)) {
    return res.status(400).json({ error: 'invalid_event_shape', message: 'One or more events failed validation.' });
  }

  const nowIso = new Date().toISOString();
  try {
    // ONE stream record per POST, carrying the sanitized batch. Awaited and
    // never silently swallowed, so an emit failure surfaces to the client
    // (which console.errors loudly but does not fail the user's write).
    await logSignalDrops({
      stage: 'rule_compat',
      userId: user.uid,
      agentId,
      archetype: ARCHETYPE_KEYS.includes(archetype) ? archetype : null,
      mode,
      events: sanitized,
      eventCount: sanitized.length,
      loggedAt: nowIso,
    });
  } catch (err) {
    console.error('[log-rule-compat-event] shadow-log emit failed:', err?.message || err);
    return res.status(500).json({ error: 'log_failed', message: 'Could not emit compat telemetry.' });
  }

  return res.status(200).json({ ok: true, logged: sanitized.length });
}
