// src/hooks/useFantasyTimes.js
// Thin wrapper around FantasyTimesContext — preserves existing API for all consumers.

import { useRef } from 'react';
import { useFantasyTimesContext } from '../contexts/FantasyTimesContext';
import { rankForUser } from '../services/fantasyTimesClient';

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
  const { stories, loading, error, refetch } = useFantasyTimesContext();
  const initialLastVisit = useRef(getLastVisit()).current;

  // Compute ranked stories per-consumer (depends on userContext)
  const rankedStories = rankForUser(stories, userContext);

  // Count unread stories (published after last visit before this session)
  const unreadCount = stories.filter((s) => {
    const publishedMs = s.publishedAt
      ? new Date(s.publishedAt._seconds ? s.publishedAt._seconds * 1000 : s.publishedAt).getTime()
      : 0;
    return publishedMs > initialLastVisit;
  }).length;

  // Update last visit on each render with stories
  if (stories.length > 0) {
    setLastVisit(Date.now());
  }

  return {
    stories,
    rankedStories,
    loading,
    error,
    refresh: refetch,
    unreadCount,
  };
}
