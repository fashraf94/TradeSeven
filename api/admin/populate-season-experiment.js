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

const DEFAULT_SEASON_ID = 'experiment-2026-04-13';

const TRADING_CALENDAR = [
  { day: 1,  week: 1, date: '2026-04-13' },
  { day: 2,  week: 1, date: '2026-04-14' },
  { day: 3,  week: 1, date: '2026-04-15' },
  { day: 4,  week: 1, date: '2026-04-16' },
  { day: 5,  week: 1, date: '2026-04-17' },
  { day: 6,  week: 2, date: '2026-04-20' },
  { day: 7,  week: 2, date: '2026-04-21' },
  { day: 8,  week: 2, date: '2026-04-22' },
  { day: 9,  week: 2, date: '2026-04-23' },
  { day: 10, week: 2, date: '2026-04-24' },
  { day: 11, week: 3, date: '2026-04-27' },
  { day: 12, week: 3, date: '2026-04-28' },
  { day: 13, week: 3, date: '2026-04-29' },
  { day: 14, week: 3, date: '2026-04-30' },
  { day: 15, week: 3, date: '2026-05-01' },
  { day: 16, week: 4, date: '2026-05-04' },
  { day: 17, week: 4, date: '2026-05-05' },
  { day: 18, week: 4, date: '2026-05-06' },
  { day: 19, week: 4, date: '2026-05-07' },
  { day: 20, week: 4, date: '2026-05-08' },
];

// Weeks 1–3 have a pit stop window (Sat–Sun between that week's Friday and
// the next week's Monday). Week 4 is the final week — no pit stop, because
// there's no subsequent week to apply changes to (mirrors the guard in
// season-pit-stop-manage.js:115).
const WEEKS = [
  {
    weekNumber: 1,
    tradingDays: [1, 2, 3, 4, 5],
    startDate: '2026-04-13',
    endDate: '2026-04-17',
    pitStopWindow: { start: '2026-04-18', end: '2026-04-19' },
  },
  {
    weekNumber: 2,
    tradingDays: [6, 7, 8, 9, 10],
    startDate: '2026-04-20',
    endDate: '2026-04-24',
    pitStopWindow: { start: '2026-04-25', end: '2026-04-26' },
  },
  {
    weekNumber: 3,
    tradingDays: [11, 12, 13, 14, 15],
    startDate: '2026-04-27',
    endDate: '2026-05-01',
    pitStopWindow: { start: '2026-05-02', end: '2026-05-03' },
  },
  {
    weekNumber: 4,
    tradingDays: [16, 17, 18, 19, 20],
    startDate: '2026-05-04',
    endDate: '2026-05-08',
  },
];

const BENCHMARK = {
  spyStartPrice: 0,
  spyCurrentPrice: 0,
  spyReturn: 0,
  dailyReturns: [],
};

const UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'AMD', 'CRM',
  'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'AXP', 'UNH', 'LLY',
  'JNJ', 'ABBV', 'MRK', 'PFE', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'WMT',
  'PG', 'KO', 'PEP', 'COST', 'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'CAT',
  'RTX', 'UPS', 'HON', 'NEE', 'DUK', 'SO', 'D', 'AMT', 'PLD', 'CCI',
];

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
