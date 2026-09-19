/**
 * Vercel cron: Intraday Data — Build 1 validator (contract §10.1).
 *
 * Schedule: every 30 minutes, 10–16 UTC, Tue–Sat → /api/cron/intraday-validate
 * (vercel.json). Grades the PREVIOUS regular session against real 1-minute
 * bars: bounded work every invocation (≤ 20 symbols, 60 s), state in
 * intradayValidationState/{etDate}, the report in intradayValidation/{etDate};
 * `window_closed` at 16:00 UTC with the unvalidated symbols listed. The
 * orchestration lives in api/_utils/intraday/validationRunner.js with every
 * dependency injected; this file is auth + flag + wiring.
 *
 * Dark: INTRADAY_COLLECT_ENABLED false → 200 { skipped: true, reason: 'flag_off' }.
 */

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { INTRADAY_COLLECT_ENABLED } from '../../src/config/featureFlags.js';
import { getSessionForDate, getPreviousSessionDate } from '../_utils/marketSchedule.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';
import { getPresetConfig } from '../_utils/agentPresetConfig.js';
import { runValidation } from '../_utils/intraday/validationRunner.js';
import { VIEWS_SUBCOLLECTION } from '../_utils/intraday/evaluatorHook.js';

export const config = { maxDuration: 120 };

/**
 * The stored views evaluated within the session, from the battles active now
 * plus the battles completed since the session opened (a single-field range
 * query — no composite index, no collection-group exemption: G9).
 */
export async function listViewsForSession(db, session) {
  const active = await findActiveAgentBattles(db);
  const completedSnap = await db.collection('agentBattles').where('completedAt', '>=', new Date(session.openMs).toISOString()).get();
  const seen = new Set();
  const battles = [];
  for (const b of [...active, ...(completedSnap.docs || []).map((d) => ({ id: d.id, ...d.data() }))]) {
    if (!b?.id || seen.has(b.id)) continue;
    seen.add(b.id); battles.push(b);
  }
  const views = [];
  for (const b of battles) {
    // Addendum A8(c) — the evidence set is what the BATTLE POINTS AT.
    //
    // The range query alone graded any view sitting in the subcollection for
    // the session, including one the evaluation entry explicitly disowns: the
    // §8.1 hook races its write against a 2 s timer without an AbortController
    // (review R-2), so a write that loses the race still lands afterwards
    // while the entry records `intradayViewStatus: 'write_failed'` and
    // `intradayViewRef: null`. §10.4's metrics must not be computed over a
    // receipt the check did not keep. Only an evalId an evaluation names in
    // `intradayViewRef` is admitted, which also bounds the set by the
    // session's own evaluations rather than by whatever is in the collection.
    const referenced = new Set(
      (Array.isArray(b.evaluations) ? b.evaluations : [])
        .filter((e) => e && typeof e.intradayViewRef === 'string' && e.intradayViewRef)
        .map((e) => e.intradayViewRef),
    );
    if (!referenced.size) continue;
    const snap = await db.collection('agentBattles').doc(b.id).collection(VIEWS_SUBCOLLECTION)
      .where('evaluatedAt', '>=', session.openMs).where('evaluatedAt', '<=', session.closeMs + 60 * 60_000).get();
    // The query filters server-side; the guard below restates the range so a
    // fake without range operators (the in-memory fixture) cannot widen it.
    for (const d of snap.docs || []) {
      const v = d.data();
      if (!referenced.has(d.id) || v?.evalId !== d.id) continue;
      if (Number.isFinite(v?.evaluatedAt) && v.evaluatedAt >= session.openMs && v.evaluatedAt <= session.closeMs + 60 * 60_000) views.push({ ...v, battleId: b.id });
    }
  }
  return views;
}

export const fireTicksOf = (presetId) => getPresetConfig(presetId || 'balanced')?.risk?.vwapFailureTicks ?? 2;

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
    const result = await runValidation({
      db,
      now: () => Date.now(),
      fetchImpl: globalThis.fetch,
      apiKey: process.env.EODHD_API_KEY,
      collectEnabled: true,
      calendar: { getSessionForDate, getPreviousSessionDate },
      listViewsForSession,
      fireTicksOf,
    });
    console.log('[intraday-validate]', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[intraday-validate] handler error:', err?.message || err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
