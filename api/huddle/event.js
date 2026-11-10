// api/huddle/event.js
//
// POST /api/huddle/event — a measurement event (Huddle S1 spec V1.1 §6; concept V1.2 §6
// AR-11 "listens, completions, confirmations, per player per session"). Body
// `{ etDate, kind: 'listened' | 'completed' }`. An AWAITED write, never fire-and-forget
// (BUILD_RULES §5): the first `listened` sets `measurement.listenedAt`, the first
// `completed` sets `measurement.completedAt`; a repeat changes nothing. 404 while
// DRB_HUDDLE_ENABLED is off. Owner auth as api/agent/chat.js:421.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { admitHuddleRoute, etDateParam } from '../_utils/huddle/routeKit.js';
import { huddleDayRef } from '../_utils/huddle/records.js';

export const config = { maxDuration: 10 };

export const EVENT_FIELDS = Object.freeze({ listened: 'listenedAt', completed: 'completedAt' });

export default async function handler(req, res) {
  const admitted = await admitHuddleRoute(req, res, { method: 'POST', rateLimit: { limit: 30, windowMs: 60_000 } });
  if (!admitted) return;
  const etDate = etDateParam(req.body?.etDate);
  const field = Object.prototype.hasOwnProperty.call(EVENT_FIELDS, req.body?.kind) ? EVENT_FIELDS[req.body.kind] : null;
  if (!etDate || !field) return res.status(400).json({ error: "etDate and kind ('listened' | 'completed') are required" });
  const db = getFirebaseAdmin();
  const dayRef = huddleDayRef(db, admitted.uid, etDate);
  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(dayRef);
      if (!snap.exists) return 'not_found';
      if (snap.data()?.measurement?.[field]) return 'unchanged';
      tx.update(dayRef, { [`measurement.${field}`]: new Date().toISOString() });
      return 'recorded';
    });
    if (result === 'not_found') return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ result });
  } catch (err) {
    console.error('[huddle/event] failed', JSON.stringify({ message: err?.message }));
    return res.status(500).json({ error: 'event_failed' });
  }
}
