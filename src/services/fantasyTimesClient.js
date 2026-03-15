// src/services/fantasyTimesClient.js
// FantasyTimes feed client — fetch, cache, and rank stories.

/**
 * Fetch the full feed of active stories.
 * @returns {Promise<Array>} Array of story objects
 */
export async function fetchFeed() {
  const res = await fetch('/api/fantasytimes/feed');
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Feed fetch failed');
  return data.stories || [];
}

/**
 * Fetch a single story by ID.
 * @param {string} id - Firestore document ID
 * @returns {Promise<Object>} Story object
 */
export async function fetchStory(id) {
  const res = await fetch(`/api/fantasytimes/story/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Story fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Story fetch failed');
  return data.story;
}

/**
 * Rank stories for a specific user based on their context.
 *
 * @param {Array} stories - Raw stories from feed
 * @param {Object} userContext
 * @param {string[]} userContext.watchlist - Tickers in user's watchlist
 * @param {string[]} userContext.activeBattleTickers - Tickers in active battles
 * @param {string[]} userContext.sectorPreferences - Preferred sectors
 * @returns {Array} Stories sorted by personalized score (descending)
 */
export function rankForUser(stories, userContext = {}) {
  const {
    watchlist = [],
    activeBattleTickers = [],
    sectorPreferences = [],
  } = userContext;

  const watchlistSet = new Set(watchlist.map((t) => t.toUpperCase()));
  const battleSet = new Set(activeBattleTickers.map((t) => t.toUpperCase()));
  const sectorSet = new Set(sectorPreferences.map((s) => s.toLowerCase()));

  const now = Date.now();

  const scored = stories.map((story) => {
    // Recency decay: 1.0 at publish, decays to 0.1 over 48 hours
    const publishedMs = story.publishedAt
      ? new Date(story.publishedAt._seconds ? story.publishedAt._seconds * 1000 : story.publishedAt).getTime()
      : now;
    const hoursAgo = (now - publishedMs) / (1000 * 60 * 60);
    const recencyDecay = Math.max(0.1, 1 - hoursAgo / 48);

    let boost = 0;

    // Active battle ticker boost (+0.8)
    const storyTickers = (story.tickers || []).map((t) => t.toUpperCase());
    if (storyTickers.some((t) => battleSet.has(t))) {
      boost += 0.8;
    }

    // Watchlist ticker boost (+0.5)
    if (storyTickers.some((t) => watchlistSet.has(t))) {
      boost += 0.5;
    }

    // Sector preference boost (+0.3)
    const storySector = (story.sector || '').toLowerCase();
    const storyThemes = (story.themes || []).map((t) => t.toLowerCase());
    if (sectorSet.has(storySector) || storyThemes.some((t) => sectorSet.has(t))) {
      boost += 0.3;
    }

    // Urgency boosts
    if (story.urgency === 'breaking') {
      boost += 1.0;
    } else if (story.urgency === 'timely') {
      boost += 0.3;
    }

    const score = (1.0 + boost) * recencyDecay;

    return { ...story, _score: score };
  });

  return scored.sort((a, b) => b._score - a._score);
}
