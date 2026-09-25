// api/backing/event.js
//
// POST /api/backing/event — Backing Beta PR 5, THE TELEMETRY SINK (spec V1.3
// §10 "Telemetry and decision rule", D-p; §12 PR 5). Auth → dark 404 → a
// FIXED allowlist (window_viewed, team_card_opened with dwell ms,
// stake_control_opened, your_backing_viewed, results_viewed) → ONE awaited
// write to `backingEvents` → no body a client could learn anything from.
//
// THE ORDER, the same rungs every backing route climbs:
//   1  security middleware + rate limit (telemetry is chatty; the limit is
//      wider than the money routes', still a limit)
//   2  method — POST only
//   3  auth — the uid from the VERIFIED token, never the body
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth
//   5  body — the allowlist and the closed prop vocabulary
//      (api/_utils/backingEvents.js), each refusal a plain reason word
//   6  the write, AWAITED (BUILD_RULES §5), then `{ recorded: true }`
//
// `stake_confirmed` IS NOT ACCEPTED HERE (§10, Amendment B §B7.3): the stake
// endpoint writes it server-side inside the successful stake path, so the
// allowlist this route reads deliberately omits it — a client posting it is
// told `unknown_event` like any other name off the list.
//
// NO CLIENT READ: this route never returns an event, an id or a count. The
// client fires and forgets (src/services/backingTelemetry.js); the write here
// is what makes the funnel a record rather than a hope.
//
// DARK AT MERGE. `BACKING_BETA_ENABLED` is false and read at CALL time; the
// sibling darkness suite (api/backing/backing-routes.dark.test.js) proves the
// route answers 404 and touches nothing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { newBackingEventId, recordBackingEvent, validateBackingEventBody } from '../_utils/backingEvents.js';
import { backingLitFor, smokeOverrideFor } from '../_utils/backingSmoke.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 120, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  // 3. Auth.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth.
  // Backing activation: the code flag, OR the founder smoke override for THIS
  // uid on a Vercel preview (api/_utils/backingSmoke.js) — never the bare flag.
  if (!backingLitFor(user.uid)) return res.status(404).json({ error: 'Not found' });

  // 5. Body — the allowlist and the closed prop vocabulary.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'invalid_body', message: 'The body must be JSON.' }); }
  }
  const checked = validateBackingEventBody(body);
  if (!checked.ok) return res.status(400).json({ error: checked.error, message: checked.message });

  // 6. The write, awaited. A SMOKE SESSION's event (the founder on a preview,
  // allowlisted — api/_utils/backingSmoke.js) is written at a `dev:`-prefixed
  // id with the top-level dev marker, so the smoke's clicks never read as the
  // beta's funnel (§10) and the cleanup script can find them.
  const db = getFirebaseAdmin();
  const smoke = smokeOverrideFor(user.uid);
  try {
    await recordBackingEvent(db, {
      eventId: smoke ? `dev:${newBackingEventId(checked.event)}` : newBackingEventId(checked.event),
      userId: user.uid,
      groupId: checked.groupId,
      event: checked.event,
      props: checked.props,
      ...(smoke ? { isDev: true } : {}),
      now: new Date(),
    });
    return res.status(200).json({ recorded: true });
  } catch (err) {
    console.error('[backing-event] write failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not record the event.' });
  }
}
