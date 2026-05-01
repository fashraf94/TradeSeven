// src/components/discover/AllThemesCarouselMobile.jsx
//
// Mobile variant of the All Themes catalog. Horizontal scroll
// carousel of the existing ThemeCard component (the larger card —
// title, narrative, chain pills with arrows, ticker chips, "X angles"
// footer). Same scroll mechanics as the Featured Themes carousel.
//
// ThemeCard.jsx is width: '100%' (sized to its grid cell on desktop).
// As a carousel item it would collapse or stretch unpredictably, so
// each card is wrapped in a fixed-width slot. 320px is narrower than
// the desktop 360px minimum so cards remain readable on a 414px iPhone
// while still showing a peek of the next card to signal scrollability.

import React from 'react';
import ThemeCard from './ThemeCard';

const CAROUSEL_CARD_WIDTH = 320;

export default function AllThemesCarouselMobile({ themes, onTap }) {
  if (!Array.isArray(themes) || themes.length === 0) return null;

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
      {themes.map((theme) => (
        <div
          key={theme.id}
          style={{
            width: CAROUSEL_CARD_WIDTH,
            flexShrink: 0,
            scrollSnapAlign: 'start',
          }}
        >
          <ThemeCard theme={theme} onTap={onTap} />
        </div>
      ))}
    </div>
  );
}
