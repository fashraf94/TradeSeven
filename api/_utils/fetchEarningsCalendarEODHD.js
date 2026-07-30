// api/_utils/fetchEarningsCalendarEODHD.js
//
// EODHD-backed earnings calendar fetcher for the daily regime brief.
// Drop-in replacement for fetchEarningsCalendar.js (Sonar-backed).
//
// Why: The Sonar version produced fabricated and date-shifted earnings.
// Live verification on May 13 2026 found CSCO reported as May 20 when
// the actual date was May 13, plus an invented FOMC decision for May 14.
// EODHD's /calendar/earnings endpoint is already in production use by
// 8 other files in this codebase (FantasyTimes pipeline, EarningsGame,
// stocks/earnings-calendar.js, etc.) and returns structured fields that
// need no LLM extraction.
//
// Output contract matches fetchEarningsCalendar.js verbatim so the DRB
// cron and prompt builder consume the new fetcher without any change to
// their downstream code paths. See PR 1 discovery report for the
// per-field consumer mapping.
//
// All date handling is ET-anchored via marketSchedule.getETDate() /
// formatDateString(). UTC date shortcuts are avoided — the DRB cron's
// own forDate field still uses UTC (out-of-scope bug surfaced in
// discovery for a separate fix).

import { getETDate, formatDateString } from './marketSchedule.js';

const LOG_PREFIX = '[EarningsCalendarEODHD]';

// Mega-cap inclusion threshold. Items at or below this drop unless the
// PRIORITY_STOCKS backstop catches a null/undefined market_cap row.
// Strict > matches the Sonar prompt's intent ("over $25B").
const MARKET_CAP_THRESHOLD_USD = 25e9;

// Backstop when EODHD returns null/undefined market_cap. Lifted from
// api/earnings/queue-verification.js:16-38, the codebase's single
// curated list of large/mega-cap symbols. Phase 3 verification will
// confirm whether this backstop ever fires in practice — if it does,
// EODHD's market_cap field is unreliable for /calendar/earnings and
// we redesign in a follow-up.
const PRIORITY_STOCKS = new Set([
  // Mega Cap Tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC',
  'AVGO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'CSCO', 'IBM', 'QCOM', 'TXN', 'MU',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'PNC', 'TFC', 'COF', 'AXP',
  'BLK', 'SCHW', 'CME', 'ICE', 'SPGI', 'MCO', 'MMC', 'AON', 'CB',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'VRTX', 'REGN', 'ISRG', 'MDT', 'SYK', 'BDX', 'ZTS', 'CI',
  // Consumer
  'WMT', 'COST', 'HD', 'TGT', 'LOW', 'NKE', 'SBUX', 'MCD', 'YUM', 'CMG',
  'PG', 'KO', 'PEP', 'PM', 'MO', 'CL', 'KMB', 'GIS', 'K', 'CAG',
  // Industrial
  'CAT', 'DE', 'BA', 'HON', 'UPS', 'FDX', 'UNP', 'LMT', 'RTX', 'GD',
  'NOC', 'GE', 'MMM', 'EMR', 'ETN', 'ITW', 'PH', 'ROK', 'CMI', 'PCAR',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL',
  // Airlines
  'DAL', 'UAL', 'AAL', 'LUV', 'ALK', 'JBLU',
  // Homebuilders
  'DHI', 'LEN', 'PHM', 'NVR', 'TOL', 'KBH',
]);

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

// Compute Monday-of-week (ET) for a given ET Date object. Returns a
// YYYY-MM-DD anchor string. Calendar weeks are Mon-Sun.
function getMondayOfWeek(etDate) {
  const day = etDate.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(etDate);
  monday.setDate(etDate.getDate() + offset);
  return formatDateString(monday);
}

// Add `days` to a YYYY-MM-DD anchor, returning a new YYYY-MM-DD string.
// Uses local-time math (which is timezone-agnostic for pure date arithmetic
// since both ends use the same local clock).
function addDays(anchor, days) {
  const [y, m, d] = anchor.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatDateString(dt);
}

// EODHD before_after_market → BMO / AMC / '' (empty for Unknown/missing).
// Exported since the Recap Restoration arc: generate-recap.js surfaces the
// timing into Doug's prompt + story metadata (ruling R-B5) via this single
// translation, so the two consumers can never disagree on the vocabulary.
export function translateTiming(bam) {
  if (!bam || typeof bam !== 'string') return '';
  const lower = bam.toLowerCase();
  if (lower === 'bmo' || lower.includes('before')) return 'BMO';
  if (lower === 'amc' || lower.includes('after')) return 'AMC';
  return '';
}

// Weekday name (e.g., 'Wednesday') for a YYYY-MM-DD string using a UTC
// anchor — same convention validateEarningsEvent in the Sonar fetcher
// uses, so the consistency gate in validateItem stays trivially true.
function dayOfWeekName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAYS[dt.getUTCDay()];
}

// Mirrors validateEarningsEvent in api/_utils/fetchEarningsCalendar.js —
// same five gates so behavior stays identical across the source swap.
function validateItem(item, todayET) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
  const parsed = new Date(`${item.date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const todayMs = new Date(`${todayET}T00:00:00Z`).getTime();
  if (Number.isNaN(todayMs)) return false;
  const diffDays = Math.abs(parsed.getTime() - todayMs) / 86_400_000;
  if (diffDays > 14) return false;
  if (typeof item.day === 'string' && item.day.trim() !== '') {
    const expected = WEEKDAYS[parsed.getUTCDay()].toLowerCase();
    if (expected !== item.day.trim().toLowerCase()) return false;
  }
  const dow = parsed.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return true;
}

// Decide whether an EODHD row passes the mega-cap filter.
// Logs observability lines per Phase 1 plan:
//   - `null_market_cap_backstop` whenever a null/undefined cap is
//     rescued by PRIORITY_STOCKS membership
//   - `below_threshold` whenever a numeric cap fails the > 25e9 gate
// Phase 3 verification reads these logs to decide whether EODHD's
// market_cap field on /calendar/earnings is trustworthy.
function passesCapFilter(row, symbol) {
  const cap = row.market_cap;
  if (cap == null) {
    const inBackstop = PRIORITY_STOCKS.has(symbol);
    if (inBackstop) {
      console.log(
        `${LOG_PREFIX} backstop_fired symbol=${symbol} report_date=${row.report_date} reason=null_market_cap_backstop`,
      );
    }
    return inBackstop;
  }
  if (typeof cap === 'number' && cap > MARKET_CAP_THRESHOLD_USD) {
    return true;
  }
  console.log(
    `${LOG_PREFIX} dropped symbol=${symbol} report_date=${row.report_date} market_cap=${cap} reason=below_threshold`,
  );
  return false;
}

// Normalize a single EODHD /calendar/earnings row to the per-item shape
// the DRB prompt builder reads: { date, day, timing, symbol, name,
// significance }. Returns null when the row should be dropped.
function normalizeRow(row, todayET) {
  const code = (row?.code || '').toUpperCase();
  if (!code.endsWith('.US') && code.includes('.')) return null;
  const symbol = code.replace('.US', '');
  if (!symbol) return null;

  const date = row.report_date;
  if (typeof date !== 'string') return null;

  if (!passesCapFilter(row, symbol)) return null;

  const item = {
    date,
    day: dayOfWeekName(date),
    timing: translateTiming(row.before_after_market),
    symbol,
    name: row.name || symbol,
    significance: 'high',
  };

  if (!validateItem(item, todayET)) return null;
  return item;
}

export async function fetchEarningsCalendarEODHD() {
  // Hard failures throw — the DRB cron wraps this call in
  // .then(ok→{ok:true}, err→{ok:false,err}) and uses the err branch to
  // populate sourceFailures with 'earnings-calendar-eodhd'. A legitimate
  // quiet week (zero items pass the filter) returns empty arrays normally
  // and is not flagged as a failure.
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error('EODHD_API_KEY not configured');
  }

  // ET-anchored today + calendar-week windows (Mon-Sun for both buckets).
  const todayDate = getETDate();
  const todayET = formatDateString(todayDate);
  const thisMondayET = getMondayOfWeek(todayDate);
  const thisSundayET = addDays(thisMondayET, 6);
  const nextMondayET = addDays(thisMondayET, 7);
  const nextSundayET = addDays(thisMondayET, 13);

  // Single EODHD call spans both weeks; partition client-side.
  const url = `https://eodhd.com/api/calendar/earnings?api_token=${apiKey}&fmt=json&from=${thisMondayET}&to=${nextSundayET}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EODHD responded with HTTP ${response.status}`);
  }
  const data = await response.json();
  const rows = data?.earnings;
  if (!Array.isArray(rows)) {
    throw new Error('EODHD response missing earnings array');
  }

  const thisWeek = [];
  const nextWeek = [];
  for (const row of rows) {
    const item = normalizeRow(row, todayET);
    if (!item) continue;
    const date = item.date;
    if (date >= thisMondayET && date <= thisSundayET) {
      // thisWeek must be forward-looking: drop past-week reports.
      if (date >= todayET) thisWeek.push(item);
    } else if (date >= nextMondayET && date <= nextSundayET) {
      nextWeek.push(item);
    }
    // Anything outside both windows is silently dropped; the EODHD
    // call's from/to bound already restricts the response, and the
    // ±14-day gate in validateItem would have caught anything stray.
  }

  thisWeek.sort((a, b) => a.date.localeCompare(b.date));
  nextWeek.sort((a, b) => a.date.localeCompare(b.date));

  return {
    thisWeek,
    nextWeek,
    spotlight: null,
    cachedAt: Date.now(),
    citations: [],
  };
}
