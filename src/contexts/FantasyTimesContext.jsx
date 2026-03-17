// src/contexts/FantasyTimesContext.jsx
// Shared context provider for FantasyTimes feed — single polling instance for all consumers.

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchFeed } from '../services/fantasyTimesClient';
import { trackRead } from '../utils/firestoreReadCounter';

const FantasyTimesContext = createContext(null);

const POLL_INTERVAL_MS = 120000; // 2 minutes
const CACHE_TTL_MS = 90000; // 90 seconds

// Module-level cache — survives React re-renders and HMR re-mounts
let _cachedFeed = { stories: null, fetchedAt: 0 };
let _lastFetchTime = 0;
let _activeProviderCount = 0;

export function FantasyTimesProvider({ children }) {
  const [stories, setStories] = useState(() => _cachedFeed.stories || []);
  const [loading, setLoading] = useState(() => !_cachedFeed.stories);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const loadFeed = useCallback(async () => {
    const now = Date.now();

    // Skip if less than 90s since last successful fetch (prevents HMR refetch)
    if (_cachedFeed.stories && (now - _cachedFeed.fetchedAt) < CACHE_TTL_MS) {
      setStories(_cachedFeed.stories);
      setLoading(false);
      return;
    }

    // Skip if less than 90s since last fetch attempt
    if ((now - _lastFetchTime) < CACHE_TTL_MS) {
      return;
    }

    _lastFetchTime = now;

    try {
      const data = await fetchFeed();
      setStories(data);
      setError(null);
      _cachedFeed = { stories: data, fetchedAt: Date.now() };
      trackRead('fantasyTimesFeed', data.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    _activeProviderCount++;
    if (_activeProviderCount > 1) {
      console.warn('[FantasyTimes] Multiple FantasyTimesProviders detected');
    }

    // Load feed on mount (will use cache if fresh)
    loadFeed();

    // Start polling with visibility check
    console.log('[FantasyTimes] Polling interval started');
    intervalRef.current = setInterval(() => {
      if (document.hidden) return; // Skip when tab is hidden
      loadFeed();
    }, POLL_INTERVAL_MS);

    return () => {
      _activeProviderCount--;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadFeed]);

  const refetch = useCallback(() => {
    setLoading(true);
    // Force refetch by resetting cache timestamp
    _cachedFeed = { stories: _cachedFeed.stories, fetchedAt: 0 };
    _lastFetchTime = 0;
    return loadFeed();
  }, [loadFeed]);

  return (
    <FantasyTimesContext.Provider value={{ stories, loading, error, refetch }}>
      {children}
    </FantasyTimesContext.Provider>
  );
}

export function useFantasyTimesContext() {
  const ctx = useContext(FantasyTimesContext);
  if (!ctx) {
    throw new Error('useFantasyTimesContext must be used within a FantasyTimesProvider');
  }
  return ctx;
}
