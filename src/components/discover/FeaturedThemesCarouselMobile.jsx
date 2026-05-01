// src/components/discover/FeaturedThemesCarouselMobile.jsx
//
// Mobile variant of the Featured Themes showcase. Horizontal scroll
// carousel of FeaturedThemeCard instances. Header lives in the
// parent (FeaturedThemesShowcase) so it's identical across viewports.

import React from 'react';
import FeaturedThemeCard from './FeaturedThemeCard';

export default function FeaturedThemesCarouselMobile({ featuredThemes, onTap }) {
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
