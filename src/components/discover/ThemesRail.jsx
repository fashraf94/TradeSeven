// src/components/discover/ThemesRail.jsx
//
// Horizontal-scrolling rail of Discover themes. Sits at the top of
// DiscoverPanel above the "All Themes" grid (which keeps the existing
// ThemeCard grid layout for full browse). Phase 1 of Sprint 3.
//
// Data sources:
//   - discoverThemes Firestore collection (status='active', ordered by
//     displayOrder asc). Same query the existing themes grid uses;
//     duplicated here intentionally rather than lifted into a shared
//     hook so each surface stays independently mountable. Both rail
//     and grid issue the same getDocs read; Firestore client de-dupes
//     in-flight equivalents at the SDK layer.
//
// Render order ("hot" signal — Sprint 3 decision 2):
//   1. Themes with isLiveThisWeek === true, sorted by displayOrder asc.
//      First three receive medalRank 1/2/3 (gold/silver/bronze).
//      A defensive 4th+ live theme appears in the live group with
//      medalRank: null — should not happen once the Phase 2 cron is
//      live (cron writes only top 3) but we don't crash on bad state.
//   2. Themes with isLiveThisWeek !== true, sorted by displayOrder asc,
//      no medals.
//
// Why no fresh-price overlay:
//   Sectors got a getMultipleStockPrices overlay in Sprint 2.5 to fix
//   a stale-1d bug — sector cards display a 1d % column. Theme cards
//   show ticker chips but no prices, so there's nothing to refresh.
//   Skipping the overlay keeps the Discover surface's EODHD load
//   smaller and matches Sprint 3 decision 5.
//
// Phase 1 tap behavior:
//   onCardTap(theme) is the single handler. DiscoverPanel reuses its
//   existing handleTap (which writes tap_card analytics with
//   source: 'discoverThemes' — unchanged from the grid) and opens
//   ThemeDetailModal. No new analytics action; the rail and grid both
//   write tap_card per Sprint 3 decision 8.

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeCardRail from './ThemeCardRail';

// Pure helper, exported (named) for unit tests. Splits themes into
// live and non-live buckets, sorts each by displayOrder asc, and
// annotates the first three live themes with medalRank 1/2/3. Live
// themes beyond the 3rd retain medalRank: null but still sit in the
// live group ahead of non-live (defensive — the Phase 2 cron only
// promotes 3 at a time).
export function computeThemeRenderOrder(themes) {
  if (!Array.isArray(themes) || themes.length === 0) return [];

  const byDisplayOrderAsc = (a, b) =>
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0);

  const live = themes
    .filter((t) => t?.isLiveThisWeek === true)
    .sort(byDisplayOrderAsc)
    .map((t, idx) => ({
      ...t,
      medalRank: idx < 3 ? idx + 1 : null,
    }));

  const nonLive = themes
    .filter((t) => t?.isLiveThisWeek !== true)
    .sort(byDisplayOrderAsc)
    .map((t) => ({ ...t, medalRank: null }));

  return [...live, ...nonLive];
}

export default function ThemesRail({ onCardTap }) {
  const { tokens } = useTheme();
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadThemes() {
      try {
        const themesQ = query(
          collection(db, 'discoverThemes'),
          where('status', '==', 'active'),
          orderBy('displayOrder', 'asc')
        );
        const snap = await getDocs(themesQ);
        if (cancelled) return;
        setThemes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[ThemesRail] Failed to load themes:', err);
        setError(err);
        setLoading(false);
      }
    }
    loadThemes();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderItems = useMemo(() => computeThemeRenderOrder(themes), [themes]);

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
          Themes
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.5,
          }}
        >
          Live this week — editorial picks ranked by engagement.
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
          Loading themes…
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
          Couldn&apos;t load themes. Refresh to try again.
        </div>
      )}

      {!loading && !error && renderItems.length > 0 && (
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
          {renderItems.map((item) => (
            <ThemeCardRail
              key={item.id}
              theme={item}
              medalRank={item.medalRank}
              onTap={onCardTap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
