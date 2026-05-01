// src/components/discover/AllThemesShowcase.jsx
//
// Parent router for the All Themes catalog. Mirrors
// FeaturedThemesShowcase's pattern: header lives here, viewport
// decides which child surface renders. Receives themes from
// DiscoverPanel — does NOT fetch independently (avoids a duplicate
// Firestore read against the same query DiscoverPanel already issues).

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import AllThemesCarouselMobile from './AllThemesCarouselMobile';
import AllThemesGridDesktop from './AllThemesGridDesktop';

export default function AllThemesShowcase({ themes, onCardTap }) {
  const { tokens } = useTheme();
  const { isMobile } = useIsMobile({ mobileBreakpoint: 768 });

  if (!Array.isArray(themes) || themes.length === 0) return null;

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
          All Themes
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.5,
          }}
        >
          Full catalog — every active theme.
        </p>
      </div>

      {isMobile ? (
        <AllThemesCarouselMobile themes={themes} onTap={onCardTap} />
      ) : (
        <AllThemesGridDesktop themes={themes} onTap={onCardTap} />
      )}
    </div>
  );
}
