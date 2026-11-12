// api/cron/huddle-worker.js
//
// Huddle S1 — the queue worker (spec V1.1 §5.3; Amendments A §A3, §A6, B §B3).
// Schedule (vercel.json): */2 12-21 * * 1-5 — every 2 minutes 12:00–21:58 UTC on
// weekdays, which covers the 8:30 ET enqueue in both EDT and EST and the 4:00 PM ET close
// in both (B3), so a confirmed plan is retired within two minutes of the close.
//
// With DRB_HUDDLE_ENABLED off it EXITS AT ONCE: no read, no write (A §A10) — and so it does with the
// flag on while the Huddle's cohort, HUDDLE_PLAYER_UIDS, is unset or empty (Amendment E §E7: fail
// closed). Live, each invocation reconciles today's confirmed plans of the cohort, recovers an
// unfinished enqueue stage, and drains the cohort's queue rows (api/_utils/huddle/worker.js). Auth: the vercel-cron header or
// `Bearer CRON_SECRET`, the house pattern. Crons do not run on Vercel preview (BUILD_RULES
// §6): verification is the unit and emulator rows plus the first production run.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { isHuddleOn, isHuddleLive } from '../_utils/huddle/gate.js';
import { runWorkerInvocation } from '../_utils/huddle/worker.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const isVercelCron = req.headers?.['x-vercel-cron'] === '1';
  const authHeader = req.headers?.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!isHuddleOn()) return res.status(200).json({ skipped: true, reason: 'flag_off' });
  if (!isHuddleLive()) return res.status(200).json({ skipped: true, reason: 'no_cohort' });
  const started = Date.now();
  try {
    const summary = await runWorkerInvocation(getFirebaseAdmin());
    console.log('[HuddleWorker] done', JSON.stringify({ ...summary, results: (summary.results || []).map((r) => ({ outcome: r.outcome, reason: r.reason, ms: r.ms })), ms: Date.now() - started }));
    return res.status(200).json({ success: true, ...summary, results: (summary.results || []).length, ms: Date.now() - started });
  } catch (err) {
    console.error('[HuddleWorker] failed', JSON.stringify({ message: err?.message, ms: Date.now() - started }));
    return res.status(500).json({ success: false, error: 'worker_failed' });
  }
}
