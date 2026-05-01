// src/components/discover/FeaturedThemesShowcase.jsx
//
// Parent router for the Featured Themes editorial section. Sits at
// the top of DiscoverPanel above AllThemesShowcase. Replaces Phase
// 1's ThemesRail.jsx — the rail framing was redundant with All
// Themes; the editorial register is what earns this surface its
// vertical real estate now.
//
// Selection:
//   - Featured set = themes.filter(t => t.isLiveThisWeek === true)
//     capped at the first 3 (defensive — Phase 2 cron writes only 3
//     but we don't crash on bad state)
//   - Cold-start fallback: if zero themes are flagged live, show the
//     first 3 by displayOrder so the section is never empty (e.g.,
//     before the Phase 2 cron's first run, or after a manual reset)
//
// Data flow:
//   DiscoverPanel owns the discoverThemes fetch (single source of
//   truth across the page — themes also feed SectorRail's cross-modal
//   handoff and AllThemesShowcase below). This component is purely
//   prop-driven; loading and error states render based on the
//   { loading, error, themes } props passed in.
//
// Viewport routing:
//   Uses src/hooks/useIsMobile with mobileBreakpoint: 768 so tablets
//   and phones uniformly get the carousel treatment. Desktop (>768px)
//   gets a row layout that still scrolls if the viewport is narrow
//   enough that 3x240px doesn't fit.
//
// No medal/ranking visuals — selection is random (Phase 2 cron); all
// three featured cards are equal peers.

import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import FeaturedThemesCarouselMobile from './FeaturedThemesCarouselMobile';
import FeaturedThemesCarouselDesktop from './FeaturedThemesCarouselDesktop';

// Pure helper, exported (named) for unit tests. Returns up to 3 themes
// filtered by isLiveThisWeek === true, preserving the input order
// (Firestore returns themes already sorted by displayOrder asc, so
// "input order" is "displayOrder asc"). Cold-start fallback: if zero
// themes are flagged live, returns the first 3 from the input array.
export function computeFeaturedSet(themes) {
  if (!Array.isArray(themes) || themes.length === 0) return [];
  const live = themes.filter((t) => t?.isLiveThisWeek === true).slice(0, 3);
  if (live.length > 0) return live;
  return themes.slice(0, 3);
}

export default function FeaturedThemesShowcase({
  themes,
  loading,
  error,
  onCardTap,
}) {
  const { tokens } = useTheme();
  const { isMobile } = useIsMobile({ mobileBreakpoint: 768 });

  const featuredThemes = useMemo(() => computeFeaturedSet(themes), [themes]);

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
          Featured Themes
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: tokens.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Three themes worth your attention this week.
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

      {!loading && !error && featuredThemes.length > 0 && (
        isMobile ? (
          <FeaturedThemesCarouselMobile
            featuredThemes={featuredThemes}
            onTap={onCardTap}
          />
        ) : (
          <FeaturedThemesCarouselDesktop
            featuredThemes={featuredThemes}
            onTap={onCardTap}
          />
        )
      )}
    </div>
  );
}
