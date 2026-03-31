/**
 * Convert a Firestore timestamp or date string to a JS Date.
 */
export function toDate(publishedAt) {
  if (!publishedAt) return new Date(0);
  if (publishedAt._seconds) return new Date(publishedAt._seconds * 1000);
  return new Date(publishedAt);
}

/**
 * Returns a human-readable relative time string (e.g. "5m ago", "2h ago").
 * Handles both Firestore timestamps ({_seconds}) and ISO date strings.
 */
export function timeAgo(publishedAt) {
  if (!publishedAt) return '';
  const ms = publishedAt._seconds
    ? publishedAt._seconds * 1000
    : new Date(publishedAt).getTime();
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
