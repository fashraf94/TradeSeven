// api/huddle/status.js
//
// GET /api/huddle/status?etDate=YYYY-MM-DD — the owner's huddle record for one day,
// reconciled on read (Huddle S1 spec V1.1 §6, §6.5): a confirmed plan's waiting receipts
// are retried, its written receipts gain heard / no-longer-current stamps, and past the
// close it is retired and the waiting receipts expire. Then the client view
// (routeKit.clientViewOf), with the per-battle status from receipts only (§6.4), and — for a
// confirmed plan in an open session — the archetypes in play and those still missing a
// confirmation (Amendment E §E1): the hub's Reconfirm door reads exactly that list.
//
// No poll calls this (Amendment C V1.2 §C7): the hub's reader asks on sheet open, on
// confirm or skip, and on visibilitychange. 404 while DRB_HUDDLE_ENABLED is off. Owner
// auth as api/agent/chat.js:421. 200 with `huddle: null` when there is no record yet.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { admitHuddleRoute, etDateParam, clientViewOf } from '../_utils/huddle/routeKit.js';
import { reconcileHuddle } from '../_utils/huddle/applyPlan.js';
import { huddleDayRef, etDateOfMs } from '../_utils/huddle/records.js';
import { reconfirmStateOf } from '../_utils/huddle/confirmPlan.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const admitted = await admitHuddleRoute(req, res, { method: 'GET', rateLimit: { limit: 30, windowMs: 60_000 } });
  if (!admitted) return;
  const etDate = req.query?.etDate === undefined ? etDateOfMs(Date.now()) : etDateParam(req.query.etDate);
  if (!etDate) return res.status(400).json({ error: 'etDate must be YYYY-MM-DD' });
  const db = getFirebaseAdmin();
  try {
    const reconcile = await reconcileHuddle(db, { uid: admitted.uid, etDate });
    const snap = await huddleDayRef(db, admitted.uid, etDate).get();
    const record = snap.exists ? snap.data() : null;
    // A read that fails leaves the door shut (null): never a door that would do nothing.
    let reconfirm = null;
    try { reconfirm = await reconfirmStateOf(db, { uid: admitted.uid, record }); } catch { reconfirm = null; }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ etDate, asOf: new Date().toISOString(), reconcile: reconcile.outcome, huddle: clientViewOf(record, { reconfirm }) });
  } catch (err) {
    console.error('[huddle/status] failed', JSON.stringify({ message: err?.message }));
    return res.status(500).json({ error: 'status_failed' });
  }
}
