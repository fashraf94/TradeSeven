// 2026 US Stock Market Holidays (NYSE/NASDAQ)
export const US_MARKET_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed - Jul 4 is Saturday)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

export function isMarketHoliday(dateString) {
  // dateString format: 'YYYY-MM-DD'
  return US_MARKET_HOLIDAYS_2026.includes(dateString);
}

export function formatDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isMarketOpen(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Weekend
  return !isMarketHoliday(formatDateString(date));
}

export function getNextTradingDay(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (!isMarketOpen(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// Returns array of N trading days starting from (and including, if it's a trading day) startDate
export function getTradingDaysFromDate(startDate, count) {
  const days = [];
  let current = new Date(startDate);
  while (days.length < count) {
    if (isMarketOpen(current)) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}
