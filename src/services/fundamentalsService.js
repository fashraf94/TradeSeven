// Client-side service for fetching company fundamentals
// Wraps the /api/stocks/fundamentals endpoint with 24-hour in-memory caching

const cache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch company profile and fundamentals data
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise<Object|null>} Profile data or null on failure
 */
export async function getCompanyProfile(symbol) {
  const key = symbol.toUpperCase();
  const cached = cache[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(`/api/stocks/fundamentals?symbol=${key}`);
    const json = await res.json();
    if (json.success && json.data) {
      cache[key] = { data: json.data, ts: Date.now() };
      return json.data;
    }
  } catch (err) {
    console.warn(`[FundamentalsService] Failed for ${key}:`, err.message);
  }
  return null;
}
