// api/admin/populate-season-experiment.js
//
// One-time admin endpoint to populate the complex nested fields on the
// `seasons/experiment-2026-04-13` document. The document is assumed to
// already exist with its basic (top-level) fields; this handler attaches
// tradingCalendar, weeks, benchmark, universe, macroEvents, and missedDays.
//
// Usage: POST /api/admin/populate-season-experiment
// Auth:  X-Admin-Secret header, ?secret= query param, or Authorization: Bearer
// Body:  { dryRun?: boolean, seasonId?: string } — seasonId defaults to
//        "experiment-2026-04-13"
//
// Field shapes mirror reader expectations:
//   - tradingCalendar[]  : { day, week, date } — consumed by
//                          season-daily-evaluate.js:133
//   - weeks[]            : { weekNumber, tradingDays[], startDate, endDate,
//                            pitStopWindow? } — consumed by
//                          seasonLeaderboard.js:311, generate-debrief.js:118,
//                          resolveCurrentWeek in seasonEvalContext.js:335
//   - benchmark          : { spyStartPrice, spyCurrentPrice, spyReturn,
//                            dailyReturns[] } — consumed by
//                          season-daily-evaluate.js:183
//   - macroEvents[]      : { type, date, tradingDay } — consumed by
//                          seasonEvalContext.js:362 (buildMacro)
//   - missedDays         : {} — populated by cron on EODHD failure
//                          (season-daily-evaluate.js:152)

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { buildTradingCalendar, DEFAULT_SESSION_UNIVERSE } from '../_utils/seasonCalendar.js';

const DEFAULT_SEASON_ID = 'experiment-2026-04-13';
const EXPERIMENT_START_DATE = '2026-04-13';
const EXPERIMENT_DURATION_DAYS = 20;

// tradingCalendar + weeks are built from the shared helper so the solo-mode
// create-entry flow (api/season/create-entry.js) can produce variable-length
// calendars of the same shape. Tournament-style: no final-week pit stop.
const { tradingCalendar: TRADING_CALENDAR, weeks: WEEKS } = buildTradingCalendar({
  startDate: EXPERIMENT_START_DATE,
  durationDays: EXPERIMENT_DURATION_DAYS,
  includeFinalPitStop: false,
});

const BENCHMARK = {
  spyStartPrice: 0,
  spyCurrentPrice: 0,
  spyReturn: 0,
  dailyReturns: [],
};

const UNIVERSE = DEFAULT_SESSION_UNIVERSE;

const MACRO_EVENTS = [
  { type: 'FOMC', date: '2026-05-06', tradingDay: 18 },
];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Auth (mirrors api/admin/backfill-snake-draft-day.js:99-117)
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  const providedSecret =
    req.headers['x-admin-secret'] ||
    req.query.secret ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!adminSecret) {
    return res.status(500).json({ error: 'Server not configured for admin operations' });
  }
  if (providedSecret !== adminSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      hint: 'Provide X-Admin-Secret header, ?secret= query parameter, or Authorization: Bearer token',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const seasonId = typeof body.seasonId === 'string' && body.seasonId
      ? body.seasonId
      : DEFAULT_SEASON_ID;
    const dryRun = body.dryRun === true;

    const db = getFirebaseAdmin();
    const seasonRef = db.collection('seasons').doc(seasonId);
    const seasonSnap = await seasonRef.get();

    if (!seasonSnap.exists) {
      return res.status(404).json({
        error: `Season document not found: seasons/${seasonId}`,
      });
    }

    const payload = {
      tradingCalendar: TRADING_CALENDAR,
      weeks: WEEKS,
      benchmark: BENCHMARK,
      universe: UNIVERSE,
      macroEvents: MACRO_EVENTS,
      missedDays: {},
      updatedAt: new Date().toISOString(),
    };

    const summary = {
      seasonId,
      tradingCalendarDays: TRADING_CALENDAR.length,
      weeksCount: WEEKS.length,
      weeksWithPitStop: WEEKS.filter(w => w.pitStopWindow).length,
      universeSize: UNIVERSE.length,
      macroEventsCount: MACRO_EVENTS.length,
    };

    if (dryRun) {
      return res.status(200).json({ status: 'dry_run', summary, payload });
    }

    // Use set with merge so we only touch the listed fields; the existing
    // top-level fields on the doc remain untouched.
    await seasonRef.set(payload, { merge: true });

    return res.status(200).json({ status: 'success', summary });
  } catch (err) {
    console.error('[POPULATE_SEASON] failed:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
