// src/hooks/useFantasyTimes.js
// React hook for FantasyTimes feed — fetches, ranks, tracks unread.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFeed, rankForUser } from '../services/fantasyTimesClient';

const POLL_INTERVAL_MS = 120000; // 2 minutes
const LAST_VISIT_KEY = 'fantasytimes_lastVisit';

function getLastVisit() {
  try {
    const saved = localStorage.getItem(LAST_VISIT_KEY);
    return saved ? Number(saved) : 0;
  } catch {
    return 0;
  }
}

function setLastVisit(timestamp) {
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(timestamp));
  } catch {
    // localStorage unavailable
  }
}

/**
 * @param {Object} userContext
 * @param {string[]} userContext.watchlist
 * @param {string[]} userContext.activeBattleTickers
 * @param {string[]} userContext.sectorPreferences
 */
export function useFantasyTimes(userContext = {}) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastVisitRef = useRef(getLastVisit());
  const intervalRef = useRef(null);

  const loadFeed = useCallback(async () => {
    try {
      const data = await fetchFeed();
      setStories(data);
      setError(null);
      // Update last visit timestamp
      const now = Date.now();
      setLastVisit(now);
      lastVisitRef.current = now;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    loadFeed();
    intervalRef.current = setInterval(loadFeed, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadFeed]);

  // Compute ranked stories
  const rankedStories = rankForUser(stories, userContext);

  // Count unread stories (published after last visit before this session)
  const initialLastVisit = useRef(getLastVisit()).current;
  const unreadCount = stories.filter((s) => {
    const publishedMs = s.publishedAt
      ? new Date(s.publishedAt._seconds ? s.publishedAt._seconds * 1000 : s.publishedAt).getTime()
      : 0;
    return publishedMs > initialLastVisit;
  }).length;

  const refresh = useCallback(() => {
    setLoading(true);
    return loadFeed();
  }, [loadFeed]);

  return {
    stories,
    rankedStories,
    loading,
    error,
    refresh,
    unreadCount,
  };
}
