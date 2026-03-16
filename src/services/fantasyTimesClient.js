// src/services/fantasyTimesClient.js
// FantasyTimes feed client — fetch, cache, rank, section, and cluster stories.

import { isMarketOpen as isTradingDay, formatDateString } from '../utils/marketHolidays';

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

// ============================================
// SECTION DEFINITIONS
// ============================================

const SECTIONS = [
  {
    id: 'market_overview',
    name: 'Market Overview',
    icon: '📊',
    storyTypes: ['market_pulse', 'macro_alert'],
  },
  {
    id: 'movers_spotlights',
    name: 'Movers & Spotlights',
    icon: '🔥',
    storyTypes: ['market_mover', 'stock_spotlight'],
  },
  {
    id: 'economics_desk',
    name: 'Economics Desk',
    icon: '🌐',
    storyTypes: ['econ_recap', 'econ_preview'],
  },
  {
    id: 'earnings_season',
    name: 'Earnings Season',
    icon: '📈',
    storyTypes: ['earnings_preview', 'earnings_recap'],
  },
  {
    id: 'sector_watch',
    name: 'Sector Watch',
    icon: '🧭',
    storyTypes: ['sector_column', 'rotation_alert'],
  },
];

// ============================================
// SECTION GROUPING
// ============================================

/**
 * Convert a story's publishedAt (Firestore timestamp or ISO string) to a JS Date.
 */
function toDate(publishedAt) {
  if (!publishedAt) return new Date(0);
  if (publishedAt._seconds) return new Date(publishedAt._seconds * 1000);
  return new Date(publishedAt);
}

/**
 * Convert a Date to an ET-equivalent Date for date-only comparisons.
 * Returns a Date whose year/month/day represent the ET calendar date.
 */
function toETDate(date) {
  const etStr = date.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etStr);
}

/**
 * Count complete trading days strictly between two timestamps.
 * Uses isMarketOpen from marketHolidays.js (checks weekday + holiday list).
 * Returns 0 if both fall within the same trading-session window.
 */
function countTradingDaysBetween(date1, date2) {
  const et1 = toETDate(date1 instanceof Date ? date1 : new Date(date1));
  const et2 = toETDate(date2 instanceof Date ? date2 : new Date(date2));

  // Ensure d1 is the earlier date
  const [earlier, later] = et1 <= et2 ? [et1, et2] : [et2, et1];

  // Start from the day after the earlier date
  const cursor = new Date(earlier);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  const laterDateOnly = new Date(later);
  laterDateOnly.setHours(0, 0, 0, 0);

  let count = 0;
  while (cursor < laterDateOnly) {
    // isTradingDay checks weekday + holiday list
    if (isTradingDay(cursor)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Cluster stories by shared primaryTicker within the same trading session.
 *
 * @param {Array} stories - Stories sorted by publishedAt desc, from one section
 * @returns {Array} Display items: { type: 'single', story } or { type: 'cluster', ticker, lead, thread, reporterCount }
 */
export function clusterByTicker(stories) {
  if (!stories || stories.length === 0) return [];

  // Separate stories with and without a primaryTicker
  const singles = [];
  const byTicker = new Map();

  for (const story of stories) {
    const ticker = story.primaryTicker;
    if (!ticker) {
      singles.push(story);
      continue;
    }
    const key = ticker.toUpperCase();
    if (!byTicker.has(key)) byTicker.set(key, []);
    byTicker.get(key).push(story);
  }

  const displayItems = [];

  // Process each ticker group
  for (const [ticker, tickerStories] of byTicker) {
    // Already sorted desc by publishedAt from the section grouper
    // Walk and split into clusters based on trading-day gaps
    const clusters = [];
    let currentCluster = [tickerStories[0]];

    for (let i = 1; i < tickerStories.length; i++) {
      const newer = toDate(currentCluster[currentCluster.length - 1].publishedAt);
      const older = toDate(tickerStories[i].publishedAt);
      const gap = countTradingDaysBetween(older, newer);

      if (gap >= 1) {
        // Gap found — finalize current cluster, start new one
        clusters.push(currentCluster);
        currentCluster = [tickerStories[i]];
      } else {
        currentCluster.push(tickerStories[i]);
      }
    }
    clusters.push(currentCluster);

    // Convert clusters to display items
    for (const group of clusters) {
      if (group.length === 1) {
        displayItems.push({ type: 'single', story: group[0] });
      } else {
        const reporters = new Set(group.map((s) => s.reporter));
        displayItems.push({
          type: 'cluster',
          ticker,
          lead: group[0],
          thread: group.slice(1),
          reporterCount: reporters.size,
        });
      }
    }
  }

  // Add null-ticker singles
  for (const story of singles) {
    displayItems.push({ type: 'single', story });
  }

  // Sort: clusters first (by thread.length desc), then singles (by publishedAt desc)
  displayItems.sort((a, b) => {
    if (a.type === 'cluster' && b.type !== 'cluster') return -1;
    if (a.type !== 'cluster' && b.type === 'cluster') return 1;
    if (a.type === 'cluster' && b.type === 'cluster') {
      return b.thread.length - a.thread.length;
    }
    // Both singles — sort by publishedAt desc
    const aTime = toDate(a.story.publishedAt).getTime();
    const bTime = toDate(b.story.publishedAt).getTime();
    return bTime - aTime;
  });

  return displayItems;
}

/**
 * Group stories into editorial sections with ticker clustering.
 *
 * @param {Array} stories - Flat array of story objects (may be pre-filtered by reporter)
 * @returns {Array} Non-empty section objects with clustered display items
 */
export function groupStoriesBySections(stories) {
  if (!stories || stories.length === 0) return [];

  // Build a type→section lookup
  const typeToSection = new Map();
  for (const section of SECTIONS) {
    for (const t of section.storyTypes) {
      typeToSection.set(t, section.id);
    }
  }

  // Bucket stories into sections
  const buckets = new Map();
  for (const section of SECTIONS) {
    buckets.set(section.id, []);
  }

  for (const story of stories) {
    const sectionId = typeToSection.get(story.type);
    if (sectionId && buckets.has(sectionId)) {
      buckets.get(sectionId).push(story);
    } else {
      console.warn(`[FantasyTimes] Uncategorized story type: "${story.type}" (id: ${story.id})`);
    }
  }

  // Build output sections — sort stories, cluster, filter empties
  const result = [];
  for (const section of SECTIONS) {
    const sectionStories = buckets.get(section.id);
    if (sectionStories.length === 0) continue;

    // Sort by publishedAt desc
    sectionStories.sort((a, b) => {
      return toDate(b.publishedAt).getTime() - toDate(a.publishedAt).getTime();
    });

    result.push({
      id: section.id,
      name: section.name,
      icon: section.icon,
      storyTypes: section.storyTypes,
      stories: sectionStories,
      clustered: clusterByTicker(sectionStories),
    });
  }

  return result;
}
