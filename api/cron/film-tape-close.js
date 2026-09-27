/**
 * Vercel cron: Film Room tape — THE CLOSE PASS (spec
 * docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md §5).
 *
 * Schedule: `15 2 * * 2-6` UTC → /api/cron/film-tape-close (vercel.json) —
 * 22:15 EDT / 21:15 EST, the SAME ET date as the session it tapes, after
 * agent-daily-scores (`45 1 * * 2-6`) and long after the evaluator's last tick
 * (`*\/15 13-21 * * 1-5`, the market-hours guard closes it at 16:00 ET). One UTC
 * entry serves both DST states: 02:15 UTC is after every evaluator tick of the
 * ET day and before the next day's first, and the ET date it resolves to is
 * the session's own (BUILD_RULES §6). A non-session ET date answers
 * `not_a_trading_day`. Per-day idempotency is the writer's: "same inputs, same
 * document" — a second run with nothing new writes nothing.
 *
 * Writes ONLY agentBattles/{id}/tape/{etDate} (BA-1). Reads never touch
 * tickBodies (BA-2). The orchestration lives in api/_utils/filmTape/closePass.js;
 * this file is auth + flag + wiring.
 *
 * BACKFILL (BA-15): `?backfill=YYYY-MM-DD..YYYY-MM-DD` runs the same writer over
 * a session range. It needs BOTH guards: the cron guard every cron has
 * (`Authorization: Bearer $CRON_SECRET`), AND the admin secret in the
 * `x-admin-secret` header (adminSecretAuth.js). When ADMIN_SECRET differs from
 * CRON_SECRET, a Bearer ADMIN_SECRET alone fails the cron guard — send both
 * headers (review L3-F5):
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" -H "x-admin-secret: $ADMIN_SECRET" \
 *     "https://<host>/api/cron/film-tape-close?backfill=2026-09-21..2026-09-25"
 *
 * The Vercel cron header alone never runs a backfill, and the scheduled
 * invocation carries no query. Same flag, same budget, resumable (the tape's
 * own passes.close.status is the queue flag — except a completed battle's final
 * day written before the completion, which the backfill re-merges). A range
 * reaching a session that has not closed is refused (400 range_not_closed); a
 * date outside the maintained market calendar, 400 calendar_missing.
 *
 * Dark: FILM_TAPE_WRITE_ENABLED false → 200 { skipped: true, reason: 'flag_off' }
 * before the Firestore handle is even taken — zero reads, zero writes.
 *
 * Crons do not run on Vercel preview: verification is the unit tests on the
 * guard, the flag, the selection and the writer, then the first production run.
 */

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { FILM_TAPE_WRITE_ENABLED } from '../../src/config/featureFlags.js';
import { isAdminSecretValid } from '../_utils/adminSecretAuth.js';
import { runClosePass, runBackfill, parseBackfillRange } from '../_utils/filmTape/closePass.js';

export const config = { maxDuration: 300 };

const LOG_PREFIX = '[film-tape-close]';

export default async function handler(req, res) {
  const startMs = Date.now();
  // The platform's cron guard, as every other cron.
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // The writer flag, read at CALL time, before any Firestore access.
  if (!FILM_TAPE_WRITE_ENABLED) {
    return res.status(200).json({ skipped: true, reason: 'flag_off' });
  }

  const backfill = req.query?.backfill;
  if (backfill !== undefined) {
    if (!isAdminSecretValid(req)) return res.status(401).json({ error: 'Unauthorized' });
    const range = parseBackfillRange(backfill, { nowMs: startMs });
    if (range.error) return res.status(400).json({ error: range.error });
    try {
      const summary = await runBackfill({
        db: getFirebaseAdmin(), clock: Date.now, startMs, budgetMs: config.maxDuration * 1000, dates: range.dates,
      });
      console.log(`${LOG_PREFIX} backfill ${range.from}..${range.to}`, JSON.stringify({
        complete: summary.complete, resumeFrom: summary.resumeFrom, written: summary.written.length,
        alreadyDone: summary.alreadyDone.length, failed: summary.failed.length,
      }));
      return res.status(200).json({ mode: 'backfill', ...summary, ms: Date.now() - startMs });
    } catch (err) {
      console.error(`${LOG_PREFIX} backfill error:`, err?.message || err);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  }

  try {
    const summary = await runClosePass({ db: getFirebaseAdmin(), clock: Date.now, startMs, budgetMs: config.maxDuration * 1000 });
    console.log(`${LOG_PREFIX}`, JSON.stringify({
      etDate: summary.etDate, battles: summary.battles, written: summary.written?.length ?? 0,
      unchanged: summary.unchanged?.length ?? 0, skippedMode: summary.skippedMode?.length ?? 0,
      failed: summary.failed?.length ?? 0, notReached: summary.notReached?.length ?? 0, skipped: summary.skipped ?? false,
    }));
    return res.status(200).json({ mode: 'close', ...summary, ms: Date.now() - startMs });
  } catch (err) {
    console.error(`${LOG_PREFIX} handler error:`, err?.message || err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
