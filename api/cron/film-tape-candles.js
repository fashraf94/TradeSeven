/**
 * Vercel cron: Film Room tape — THE CANDLE PASS (spec
 * docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md §6).
 *
 * Schedule: `0 11 * * 2-6` UTC → /api/cron/film-tape-candles (vercel.json) —
 * 07:00 EDT / 06:00 EST, the morning after each session, after the intraday
 * validator's first attempt (`*\/30 10-16 * * 2-6` UTC, answers doc §D1),
 * which is when the prior session's 1-minute bars are known to be retrievable.
 * Nothing here depends on an exact ET minute: it processes whatever tapes are
 * waiting, oldest first, and each tape carries its own retry count.
 *
 * Selection, retry, fetch, replay (BA-11), plan prices (BA-10), series
 * (BA-12) and the targeted update live in api/_utils/filmTape/candlePass.js;
 * this file is auth + flag + wiring. The fetcher is the generic one,
 * fetchIntradayCandles (marketDataCache.js), at interval '1m'.
 *
 * Dark: FILM_TAPE_WRITE_ENABLED false → 200 { skipped: true, reason: 'flag_off' }
 * before the Firestore handle is taken — zero reads, zero writes, zero fetches.
 *
 * Crons do not run on Vercel preview: verification is the unit tests on the
 * selection, the replay and the write, then the first production morning.
 */

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { FILM_TAPE_WRITE_ENABLED } from '../../src/config/featureFlags.js';
import { fetchIntradayCandles } from '../_utils/marketDataCache.js';
import { runCandlePass } from '../_utils/filmTape/candlePass.js';

export const config = { maxDuration: 300 };

const LOG_PREFIX = '[film-tape-candles]';

export default async function handler(req, res) {
  const startMs = Date.now();
  // The platform's cron guard, as every other cron.
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // The same writer flag as the close pass, read at CALL time.
  if (!FILM_TAPE_WRITE_ENABLED) {
    return res.status(200).json({ skipped: true, reason: 'flag_off' });
  }
  try {
    const summary = await runCandlePass({
      db: getFirebaseAdmin(),
      fetchCandles: (symbol, opts) => fetchIntradayCandles(symbol, opts),
      clock: Date.now,
      startMs,
      budgetMs: config.maxDuration * 1000,
    });
    console.log(LOG_PREFIX, JSON.stringify({
      runEtDate: summary.runEtDate, selected: summary.selected, written: summary.written.length, partial: summary.partial.length,
      failed: summary.failed.length, expired: summary.expired.length, notReached: summary.notReached.length, units: summary.units,
    }));
    return res.status(200).json({ ...summary, ms: Date.now() - startMs });
  } catch (err) {
    console.error(`${LOG_PREFIX} handler error:`, err?.message || err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
