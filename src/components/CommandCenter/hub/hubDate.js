// src/components/CommandCenter/hub/hubDate.js
//
// Command Center hub, slice S1 — the header eyebrow's date: weekday, month and
// day in US Eastern time, the market's clock (BUILD_RULES §6: Intl with
// America/New_York, never a hand-rolled offset). The design shows
// "Tuesday, October 7".

const ET_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** "Thursday, October 15" for an instant, read in ET. '' for an invalid date. */
export function formatHubDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return ET_DATE.format(date);
}

/** The name the header shows: the display name, else the username, else none. */
export function headerName(user) {
  const pick = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return pick(user?.displayName) || pick(user?.username);
}
