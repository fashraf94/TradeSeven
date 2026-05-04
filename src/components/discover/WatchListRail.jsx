// src/components/discover/WatchListRail.jsx
//
// Watch List section above Featured Themes on the Discover surface. Hits
// the Phase 2 endpoint /api/discover/current-events and renders the
// returned keyEvents array as a horizontal rail of WatchListEventCards.
//
// Status handling (locked Phase 3 decisions #8 and #9):
//   - 'fresh' → render rail, no footer
//   - 'stale' → render rail + footer "Updated <briefForDate readable>"
//   - 'empty' → render section header + "Updating shortly" message
//   - top-level response.stale === true (warm-container fallback path)
//     is treated as 'stale' regardless of nested status
//
// Auth: uses fetchWithAuth — auto-attaches the Firebase ID token, matching
// the rest of the app's authenticated API call pattern.

import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import WatchListEventCard from './WatchListEventCard';

function formatBriefDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function WatchListRail({ onTickerTap }) {
  const { tokens } = useTheme();
  const [data, setData] = useState(null);
  const [topLevelStale, setTopLevelStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      try {
        const res = await fetchWithAuth('/api/discover/current-events');
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const body = await res.json();
        if (cancelled) return;
        setData(body?.data || null);
        setTopLevelStale(Boolean(body?.stale));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[WatchListRail] Failed to load current events:', err);
        setError(err);
        setLoading(false);
      }
    }
    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const events = Array.isArray(data?.events) ? data.events : [];
  const status = data?.status || 'empty';
  const isEmpty = !loading && !error && (status === 'empty' || events.length === 0);
  const isStale = topLevelStale || status === 'stale';

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.2,
          }}
        >
          Watch List
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.5,
          }}
        >
          {data?.weekOf || 'This week'}
        </p>
      </div>

      {loading && (
        <div
          style={{
            color: tokens.textMuted,
            fontSize: 13,
            padding: '20px 0',
          }}
        >
          Loading…
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            color: tokens.red,
            fontSize: 13,
            padding: '20px 0',
          }}
        >
          Couldn&apos;t load this week&apos;s events. Refresh to try again.
        </div>
      )}

      {!loading && !error && isEmpty && (
        <div
          style={{
            color: tokens.textMuted,
            fontSize: 13,
            padding: '20px 0',
          }}
        >
          Updating shortly — check back this morning.
        </div>
      )}

      {!loading && !error && !isEmpty && events.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            paddingBottom: 8,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {events.map((event, idx) => (
            <WatchListEventCard
              key={`${event.eventDate || 'no-date'}-${event.label || idx}`}
              event={event}
              onTickerTap={onTickerTap}
            />
          ))}
        </div>
      )}

      {!loading && !error && !isEmpty && isStale && data?.briefForDate && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: tokens.textFaint,
            letterSpacing: '0.2px',
          }}
        >
          Updated {formatBriefDate(data.briefForDate)}
        </div>
      )}
    </div>
  );
}
