// api/cron/setup-evidence-sweep.js
//
// The chart's evidence, PR B — THE DAILY SWEEP'S CRON (spec of record
// docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-1 – SW-9). Its own schedule, not a reflections tenant:
// a 20-second tenant slice at twelve names a run would take about five hours for 228 names.
//
// Schedule (vercel.json): `30 12,22,23 * * 1-5` UTC — 22:30 and 23:30 after each weekday's close
// (5:30 / 6:30 PM EST, 6:30 / 7:30 PM EDT), and 12:30 the next weekday before the open (7:30 AM
// EST, 8:30 AM EDT). A weekday holiday's runs find no session to work and make no request.
//
// With SETUP_EVIDENCE_SWEEP_ENABLED off it answers { skipped: true } before the Firestore handle is
// taken: no read, no write, no provider request. The run itself (api/_utils/setupEvidenceSweep/
// sweep.js) is every rule; this file is auth, the flag and the wiring. Auth: the vercel-cron header
// or `Bearer CRON_SECRET`, the house pattern (an unset secret never matches). Crons do not run on
// Vercel preview (BUILD_RULES §6): verification is the unit and emulator rows, then the first
// production run and the day-after census (scripts/census-setup-evidence-sweep.mjs).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { sweepFlagOn } from '../_utils/setupEvidenceSweep/gate.js';
import { runSetupEvidenceSweep } from '../_utils/setupEvidenceSweep/sweep.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const handlerStartMs = Date.now();
  const isVercelCron = req.headers?.['x-vercel-cron'] === '1';
  const secret = process.env.CRON_SECRET;
  const bearerOk = typeof secret === 'string' && secret.length > 0 && req.headers?.authorization === `Bearer ${secret}`;
  if (!isVercelCron && !bearerOk) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!sweepFlagOn()) return res.status(200).json({ skipped: true });
  try {
    const summary = await runSetupEvidenceSweep({ db: getFirebaseAdmin(), handlerStartMs, now: () => new Date() });
    return res.status(200).json(summary);
  } catch (err) {
    console.error('[setupEvidenceSweep] run failed', JSON.stringify({ name: String(err?.name ?? 'Error').slice(0, 40), reason: typeof err?.reason === 'string' ? err.reason.slice(0, 40) : null }));
    return res.status(500).json({ error: 'sweep_failed', name: String(err?.name ?? 'Error').slice(0, 40) });
  }
}
