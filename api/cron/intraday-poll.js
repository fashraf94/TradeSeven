/**
 * Vercel cron: Intraday Data — Build 1 poller (contract §5.1).
 *
 * Schedule: `* 13-21 * * 1-5` UTC → /api/cron/intraday-poll (vercel.json).
 * Every invocation: deadline processing (§6.2) before the session guard, then
 * quote collection only when now ∈ [open, close + 30 min) per the calendar
 * of record (api/_utils/marketSchedule.js getSessionForDate — never a vendor
 * calendar, never a guess). The orchestration lives in
 * api/_utils/intraday/pollRunner.js with every dependency injected; this file
 * is auth + flag + wiring.
 *
 * Dark: INTRADAY_COLLECT_ENABLED false → 200 { skipped: true, reason: 'flag_off' }
 * before any read, any vendor call or any write.
 *
 * Crons do not run on Vercel preview (BUILD_RULES §6): verification is the
 * unit suite on the runner plus the founder's day-1 production smoke (§13).
 */

import { randomUUID } from 'node:crypto';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { INTRADAY_COLLECT_ENABLED } from '../../src/config/featureFlags.js';
import { getSessionForDate, getPreviousSessionDate } from '../_utils/marketSchedule.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';
import { runPoll } from '../_utils/intraday/pollRunner.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!INTRADAY_COLLECT_ENABLED) {
    return res.status(200).json({ skipped: true, reason: 'flag_off' });
  }
  const db = getFirebaseAdmin();
  try {
    const result = await runPoll({
      db,
      now: () => Date.now(),
      fetchImpl: globalThis.fetch,
      apiKey: process.env.EODHD_API_KEY,
      collectEnabled: true,
      calendar: { getSessionForDate, getPreviousSessionDate },
      listActiveBattles: findActiveAgentBattles,
      owner: randomUUID(),
    });
    console.log('[intraday-poll]', JSON.stringify({ ...result, deadline: undefined }));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[intraday-poll] handler error:', err?.message || err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
