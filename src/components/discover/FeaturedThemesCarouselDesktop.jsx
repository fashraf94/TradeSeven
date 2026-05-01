// src/components/discover/FeaturedThemesCarouselDesktop.jsx
//
// Desktop variant of the Featured Themes showcase. Three featured
// cards rendered horizontally, left-aligned to match the All Themes
// grid alignment. Container still uses overflowX: auto so narrow
// desktop windows or zoomed viewports degrade gracefully into a
// scroll surface rather than overflowing the parent.

import React from 'react';
import FeaturedThemeCard from './FeaturedThemeCard';

export default function FeaturedThemesCarouselDesktop({ featuredThemes, onTap }) {
  if (!Array.isArray(featuredThemes) || featuredThemes.length === 0) return null;

  return (
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
      {featuredThemes.map((theme) => (
        <FeaturedThemeCard key={theme.id} theme={theme} onTap={onTap} />
      ))}
    </div>
  );
}
