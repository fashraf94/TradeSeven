// api/_utils/marketHolidayCheck.js
// Server-side market holiday check for cron endpoints.
// Mirrors the holiday list from src/utils/marketHolidays.js.

const MARKET_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

export function isMarketHolidayToday() {
  const today = new Date().toISOString().split('T')[0];
  return MARKET_HOLIDAYS_2026.includes(today);
}
