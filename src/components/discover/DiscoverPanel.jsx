// src/components/discover/DiscoverPanel.jsx
//
// Discover panel — the inspiration surface of the Forge. Owns the
// single discoverThemes fetch for the page and routes themes into
// three surfaces:
//   1. FeaturedThemesShowcase — three editorial cards at the top
//      (filtered by isLiveThisWeek; cold-start fallback to first 3 by
//      displayOrder)
//   2. AllThemesShowcase — the full catalog (mobile carousel /
//      desktop grid)
//   3. SectorRail — the macro-lens rail at the bottom; needs themes
//      for the sector → linked-theme cross-modal handoff
//
// Modal handoffs:
//   - Tap any theme card → write 'tap_card' interaction + open
//     ThemeDetailModal
//   - ThemeDetailModal "Start in Workshop" → write 'tap_start_workshop'
//     + open Workshop with a theme seedContext (Sprint 5 Phase 1)
//   - SectorDetailModal "Start in Workshop" → write 'tap_start_workshop'
//     with source 'discoverSectors' + open Workshop with a sector
//     seedContext (Sprint 5 Phase 1)
//   - Sector → linked theme: handleOpenThemeById looks up by id and
//     routes through the same ThemeDetailModal

import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeDetailModal from './ThemeDetailModal';
import FeaturedThemesShowcase from './FeaturedThemesShowcase';
import AllThemesShowcase from './AllThemesShowcase';
import SectorRail from './SectorRail';
import WatchListRail from './WatchListRail';
import AssetResearchModal from '../draft/AssetResearchModal';
import { getSectorContent } from './sectorContent';
import { getThemeRichEntry } from './themesDkb';
import { SECTORS as SECTOR_HOLDINGS_MAP } from '../../constants/sectors';
import { WATCH_LIST_RAIL_ENABLED } from '../../config/featureFlags';

// Build the workshop seedContext for a Discover theme. Pulls rich content
// from the build-time DKB bundle when available; falls back to the thinner
// Firestore-registered fields (title + tagline) if the rich entry is
// missing (data drift between the registry and dkb/thematic/*.json).
function themeToSeed(theme) {
  if (!theme?.id || !theme?.title) return null;
  const rich = getThemeRichEntry(theme.id);
  const fe = rich?.fullEntry || null;
  const primaryTickers = Array.isArray(fe?.tickerEcosystem?.primary)
    ? fe.tickerEcosystem.primary.slice(0, 6)
    : [];
  const subAngles = Array.isArray(fe?.subAngles)
    ? fe.subAngles
        .map((sa) => (typeof sa?.angle === 'string' ? sa.angle : null))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  return {
    kind: 'theme',
    themeId: theme.id,
    title: theme.title,
    thesisSummary:
      (typeof fe?.narrative?.coreThesis === 'string' && fe.narrative.coreThesis) ||
      (typeof theme.narrative === 'string' && theme.narrative) ||
      '',
    anchorTickers: primaryTickers,
    subAngles,
  };
}

// Build the workshop seedContext for a Discover sector. Editorial body +
// regime tag come from sectorContent.js; anchor tickers come from the
// SECTORS holdings map (top 5 by ETF weight).
function sectorToSeed(ticker) {
  if (!ticker) return null;
  const content = getSectorContent(ticker);
  if (!content) return null;
  const holdings = SECTOR_HOLDINGS_MAP[ticker]?.topHoldings?.slice(0, 5) || [];
  return {
    kind: 'sector',
    ticker,
    name: content.name,
    regimeTag: content.regimeTag || '',
    body: content.body || '',
    anchorTickers: holdings,
    linkedThemeIds: Array.isArray(content.linkedThemes) ? content.linkedThemes : [],
  };
}

// Fire-and-forget analytics write. We never want the UX to wait on
// the round-trip and we never want a logging failure to surface to
// the user. The discoverInteractions rules block (manual deploy) is
// scoped to allow only authenticated user-owned creates.
//
// Source is parameterized: theme-tab interactions write
// 'discoverThemes' (the default, preserving the Sprint 1 schema),
// sector-tab interactions write 'discoverSectors' (matching the
// existing logSectorInteraction in SectorDetailModal).
async function logInteraction({ themeId, action, source = 'discoverThemes' }) {
  try {
    const uid = auth?.currentUser?.uid;
    if (!uid || !themeId || !action) return;
    await addDoc(collection(db, 'discoverInteractions'), {
      userId: uid,
      themeId,
      action,
      timestamp: serverTimestamp(),
      source,
    });
  } catch (err) {
    console.error('[DiscoverPanel] Failed to log interaction:', err);
  }
}

export default function DiscoverPanel({ showToast, requestWorkshopOpen }) {
  const { tokens } = useTheme();
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [viewChartTicker, setViewChartTicker] = useState(null);

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
        console.error('[DiscoverPanel] Failed to load themes:', err);
        setError(err);
        setLoading(false);
      }
    }
    loadThemes();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTap = (theme) => {
    if (!theme) return;
    logInteraction({ themeId: theme.id, action: 'tap_card' });
    setSelectedTheme(theme);
  };

  const handleCloseModal = () => {
    setSelectedTheme(null);
  };

  // Sprint 5 Phase 1: real Workshop handoff for theme cards. Logs the
  // tap_start_workshop analytics row, builds a theme seedContext, and
  // asks ForgeLanding to open Workshop. ForgeLanding owns the agent /
  // capacity gates — if any gate fires, requestWorkshopOpen returns
  // false and shows the appropriate toast itself; we close the source
  // modal regardless so the user isn't trapped behind a gated CTA.
  const handleStartWorkshop = (theme) => {
    if (!theme) return;
    logInteraction({ themeId: theme.id, action: 'tap_start_workshop' });
    const seed = themeToSeed(theme);
    setSelectedTheme(null);
    if (typeof requestWorkshopOpen === 'function') {
      requestWorkshopOpen(seed);
    }
  };

  // Sprint 5 Phase 1: real Workshop handoff for sector cards. Symmetric
  // with the theme path; the only differences are the analytics source
  // tag and the seed shape. Closing the sector modal is owned by
  // SectorRail, not us — it closes its own modal before invoking this
  // callback (close-source-first pattern).
  const handleStartSectorWorkshop = (ticker) => {
    if (!ticker) return;
    logInteraction({
      themeId: ticker,
      action: 'tap_start_workshop',
      source: 'discoverSectors',
    });
    const seed = sectorToSeed(ticker);
    if (typeof requestWorkshopOpen === 'function') {
      requestWorkshopOpen(seed);
    }
  };

  // Sprint 2.6 cross-modal handoff target for SectorDetailModal: open
  // the AssetResearchModal for a sector ETF ticker. SectorRail closes
  // its own modal before invoking this. Closing the research modal
  // afterwards returns the user to the bare Discover surface (NOT
  // auto-restored), matching the sector → theme handoff pattern.
  const handleViewChartTap = (ticker) => {
    if (!ticker) return;
    setViewChartTicker(ticker);
  };

  const handleCloseViewChart = () => {
    setViewChartTicker(null);
  };

  // Cross-modal handoff target for SectorDetailModal: open the theme
  // modal for a given themeId. SectorRail will have already closed its
  // own modal before invoking this. If the themeId no longer resolves
  // to an active theme (data drift), warn and no-op rather than render
  // an empty modal.
  const handleOpenThemeById = (themeId) => {
    if (!themeId) return;
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) {
      console.warn(
        `[DiscoverPanel] openThemeById: "${themeId}" not in active themes — ignoring.`
      );
      return;
    }
    setSelectedTheme(theme);
  };

  return (
    <div style={{ padding: '24px 4px' }}>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: tokens.textPrimary,
          lineHeight: 1.2,
        }}
      >
        Discover
      </h2>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 14,
          color: tokens.textMuted,
          lineHeight: 1.5,
        }}
      >
        Explore investable themes.
      </p>

      <div style={{ marginTop: 24 }}>
        {WATCH_LIST_RAIL_ENABLED && <WatchListRail onTickerTap={handleViewChartTap} />}

        <FeaturedThemesShowcase
          themes={themes}
          loading={loading}
          error={error}
          onCardTap={handleTap}
        />

        <AllThemesShowcase themes={themes} onCardTap={handleTap} />

        <SectorRail
          showToast={showToast}
          themes={themes}
          onLinkedThemeTap={handleOpenThemeById}
          onViewChartTap={handleViewChartTap}
          onHoldingChipTap={handleViewChartTap}
          onStartWorkshop={handleStartSectorWorkshop}
        />
      </div>

      <ThemeDetailModal
        isOpen={Boolean(selectedTheme)}
        theme={selectedTheme}
        onClose={handleCloseModal}
        onStartWorkshop={handleStartWorkshop}
      />

      {viewChartTicker && (
        <AssetResearchModal
          asset={{
            symbol: viewChartTicker,
            name: getSectorContent(viewChartTicker)?.name || viewChartTicker,
          }}
          onClose={handleCloseViewChart}
          showActionButton={false}
          version={2}
        />
      )}
    </div>
  );
}
