// api/_utils/huddle/routeKit.js
//
// Huddle — what every /api/huddle/* route does first (spec V1.1 §6; Amendment A §A10; Amendment E §E7):
//   1. the flag AND a non-empty cohort, BEFORE anything else: either missing, the route is the flag-off 404 (no read,
//      no auth call, no middleware) — an empty HUDDLE_PLAYER_UIDS is the flag off (E7, fail closed);
//   2. the shared security middleware (headers, CORS, the per-client rate limit);
//   3. the method;
//   4. owner auth with the Firebase ID token, as api/agent/chat.js:421 (`requireAuth`) —
//      except the audio stream, the documented exception (native <audio> sends no header);
//   5. the cohort (E7): a signed-in uid outside it gets the flag-off answer exactly — 404 `{ error: 'not_found' }` —
//      before any read. The audio stream, which has no uid at admission, checks the token's owner the same way
//      (audio/[token].js).
// And the client's view of a huddle record: no playback hash, no storage path.

import { applySecurityMiddleware } from '../security.js';
import { requireAuth } from '../authMiddleware.js';
import { isHuddleLive, huddleAdmits } from './gate.js';
import { isEtDate } from './records.js';
import { statusOfBattles } from './applyPlan.js';

/** The flag-off answer, exactly (A §A10); also the answer for a player outside the cohort (E7). */
export function sendNotFound(res) {
  res.status(404).json({ error: 'not_found' });
}

/**
 * @returns {Promise<{ uid: string|null } | null>} null when the response has been sent
 */
export async function admitHuddleRoute(req, res, { method, auth = true, rateLimit = { limit: 30, windowMs: 60_000 }, env = process.env }) {
  if (!isHuddleLive(env)) {
    sendNotFound(res);
    return null;
  }
  if (applySecurityMiddleware(req, res, { rateLimit })) return null;
  if (req.method !== method) {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }
  if (!auth) return { uid: null };
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!huddleAdmits(user.uid, env)) {
    sendNotFound(res);
    return null;
  }
  return { uid: user.uid };
}

/** The body's (or query's) ET date, validated; null when absent or malformed. */
export function etDateParam(value) {
  return isEtDate(value) ? value : null;
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));

/** The client's view of a huddle record. Never the playback hash or a storage path. */
export function clientViewOf(record) {
  if (!record) return null;
  const plan = record.plan || null;
  return {
    etDate: record.etDate ?? record.session?.etDate ?? null,
    status: record.status ?? null,
    session: record.session ?? null,
    generatedAt: record.generation?.finishedAt ?? null,
    failReason: record.status === 'failed' ? (record.generation?.failReason ?? null) : null,
    script: { beats: (record.script?.beats || []).map((b) => pick(b, ['id', 'text', 'source', 'startMs', 'endMs', 'sentences'])) },
    transcript: record.transcript ?? null,
    audio: record.audio ? { durationMs: record.audio.durationMs ?? null, hasAudio: typeof record.audio.gcsPath === 'string' } : null,
    cards: record.cards || [],
    names: record.names || [],
    evidence: record.evidence || [],
    events: record.events || null,
    drops: record.generation?.drops || [],
    sourceFailures: record.generation?.sourceFailures || [],
    plan: plan ? {
      templateVersion: plan.templateVersion ?? null,
      status: plan.status,
      current: plan.current ?? null,
      revision: plan.revision ?? null,
      dissent: plan.dissent || [],
      editCount: plan.editCount ?? 0,
      archetypeAtGeneration: plan.archetypeAtGeneration ?? null,
      eventLabels: Object.fromEntries((plan.context?.eligibleEvents || []).map((e) => [e.eventId, e.label])),
      closes: plan.context?.closes || {},
      universe: plan.context?.universe || [],
      confirmed: plan.confirmed ? pick(plan.confirmed, ['revision', 'archetype', 'renderedText', 'confirmedAt']) : null,
      confirmations: (plan.confirmations || []).map((c) => pick(c, ['revision', 'archetype', 'confirmedAt'])),
      skippedAt: plan.skippedAt ?? null,
      expiredAt: plan.expiredAt ?? null,
      battles: statusOfBattles(plan),
    } : null,
    measurement: record.measurement || {},
  };
}
