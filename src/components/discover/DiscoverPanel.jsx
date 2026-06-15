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

import React, { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { ArrowRight, Sparkles } from 'lucide-react';
import { auth, db } from '../../firebase/config';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeDetailModal from './ThemeDetailModal';
import FeaturedThemesShowcase from './FeaturedThemesShowcase';
import AllThemesShowcase from './AllThemesShowcase';
import SectorRail from './SectorRail';
import WatchListRail from './WatchListRail';
import AssetResearchModal from '../draft/AssetResearchModal';
import { SignalDropEntry, WatchlistChat } from '../SignalDrop';
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

// Client-generated dropId for a theme-seeded dialogue (Phase 2: theme → Dive
// in). Mirrors SignalDropEntry.generateDropId — an RFC4122 v4 UUID matches the
// forge-id character class. For a theme seed the dropId is just a session
// handle (no signalDrops record); it anchors the Phase 4 save the same way the
// paste path's verified dropId does.
function makeThemeDropId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function DiscoverPanel({ showToast, requestWorkshopOpen, onBuildWatchlistFromTheme, agent, onViewWatchlist, variant = 'stack', onRegisterSignalDropOpener }) {
  const { tokens } = useTheme();
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [viewChartTicker, setViewChartTicker] = useState(null);
  // Sprint 6 Phase 3B: Signal Drop modal flow. State machine across
  // entry (parse-signal) → chat (watchlist-dialogue). Mode is null when
  // no Signal Drop modal is open. Entry stays ungated (parsing works
  // without an agent); the entry → chat transition gates on agent?.id
  // and toasts if the user has no agent yet.
  const [signalDropState, setSignalDropState] = useState({
    mode: null, // null | 'entry' | 'chat'
    parseResult: null,
    dropId: null,
    agentId: null,
    seedTheme: null, // Phase 2: set when the chat is seeded from a theme
  });

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
    // Phase 2: theme → build a draft watchlist. Seed name/thesis/tickers
    // from the theme, then route into the Watchlist editor where the user
    // reviews and commits ("make ready"). anchorTickers come from the rich
    // DKB entry; fall back to the Firestore-registered `tickers` if the
    // rich entry is missing (registry/DKB drift). Falls back to the legacy
    // Workshop handoff when no build handler is wired (shelved ForgeLanding
    // path), so that surface is unchanged.
    if (typeof onBuildWatchlistFromTheme === 'function') {
      const anchorTickers =
        Array.isArray(seed?.anchorTickers) && seed.anchorTickers.length
          ? seed.anchorTickers
          : Array.isArray(theme.tickers)
            ? theme.tickers
            : [];
      onBuildWatchlistFromTheme({
        themeId: theme.id,
        title: theme.title,
        thesis: seed?.thesisSummary || theme.narrative || '',
        tickers: anchorTickers,
      });
      return;
    }
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

  // Sprint 6 Phase 3A: open the Signal Drop entry modal. Logged
  // through the same fire-and-forget interaction writer used by theme
  // and sector taps; we use a sentinel themeId of '__signal_drop__'
  // because the schema requires one and we don't have a theme here.
  const handleOpenSignalDrop = useCallback(() => {
    logInteraction({
      themeId: '__signal_drop__',
      action: 'tap_drop_signal',
      source: 'discoverSignalDrop',
    });
    setSignalDropState({ mode: 'entry', parseResult: null, dropId: null, agentId: null, seedTheme: null });
  }, []);

  // Expose the Signal-Drop opener so a desktop sibling (the right column's
  // "Build with Atlas" entry) can trigger the flow this panel owns. The
  // signalDropState machine + SignalDropEntry/WatchlistChat stay here because
  // the theme modal's "Dive in" CTA also drives them.
  useEffect(() => {
    if (typeof onRegisterSignalDropOpener !== 'function') return undefined;
    onRegisterSignalDropOpener(handleOpenSignalDrop);
    return () => onRegisterSignalDropOpener(null);
  }, [onRegisterSignalDropOpener, handleOpenSignalDrop]);

  const handleCloseSignalDropEntry = () => {
    setSignalDropState({ mode: null, parseResult: null, dropId: null, agentId: null, seedTheme: null });
  };

  const handleCloseSignalDropChat = () => {
    setSignalDropState({ mode: null, parseResult: null, dropId: null, agentId: null, seedTheme: null });
  };

  // Phase 2: theme → "Dive in" — open the curation chat seeded from a theme.
  // Symmetric with handleStartSignalDialogue (the paste path), but the chat is
  // seeded from a Discover theme instead of a parsed paste: no parseResult, a
  // freshly minted dropId handle, and a seedTheme the chat sends as a themeId
  // on the first turn. Gates on agent?.id like the paste path (a dialogue
  // needs an agent); closes the source theme modal regardless.
  const handleDiveIntoTheme = (theme) => {
    if (!theme) return;
    logInteraction({ themeId: theme.id, action: 'tap_dive_in' });
    setSelectedTheme(null);
    if (!agent?.id) {
      if (typeof showToast === 'function') {
        showToast('Create an agent first to dive into a theme');
      }
      return;
    }
    const seed = themeToSeed(theme);
    const tickers =
      Array.isArray(seed?.anchorTickers) && seed.anchorTickers.length
        ? seed.anchorTickers
        : Array.isArray(theme.tickers)
          ? theme.tickers
          : [];
    setSignalDropState({
      mode: 'chat',
      parseResult: null,
      dropId: makeThemeDropId(),
      agentId: agent.id,
      seedTheme: {
        themeId: theme.id,
        title: theme.title,
        thesis: seed?.thesisSummary || theme.narrative || '',
        tickers,
      },
    });
  };

  // Sprint 6 Phase 3B: transition from entry modal to WatchlistChat.
  // SignalDropEntry stays agent-agnostic — DiscoverPanel composes the
  // full chat-state object with agentId from its own props. Per locked
  // decision, the agent gate fires here (not at entry-open): no agent
  // → toast + close entry. The entry modal still produced a useful
  // parse, so the user isn't stranded on an error state.
  const handleStartSignalDialogue = ({ parseResult, dropId }) => {
    if (!agent?.id) {
      if (typeof showToast === 'function') {
        showToast('Create an agent first to start a Signal Drop dialogue');
      }
      setSignalDropState({ mode: null, parseResult: null, dropId: null, agentId: null, seedTheme: null });
      return;
    }
    setSignalDropState({
      mode: 'chat',
      parseResult,
      dropId,
      agentId: agent.id,
      seedTheme: null,
    });
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

  const isDesktopLeft = variant === 'desktopLeft';

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

        {!isDesktopLeft && <DropSignalCard tokens={tokens} onTap={handleOpenSignalDrop} />}

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
        onDiveIn={handleDiveIntoTheme}
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

      <SignalDropEntry
        open={signalDropState.mode === 'entry'}
        onClose={handleCloseSignalDropEntry}
        onStartDialogue={handleStartSignalDialogue}
      />

      <WatchlistChat
        isOpen={signalDropState.mode === 'chat'}
        onClose={handleCloseSignalDropChat}
        parseResult={signalDropState.parseResult}
        dropId={signalDropState.dropId}
        agentId={signalDropState.agentId}
        agentName={agent?.name}
        showToast={showToast}
        onViewWatchlist={onViewWatchlist}
        seedTheme={signalDropState.seedTheme}
      />
    </div>
  );
}

// "Drop a Signal" card — first-class entry point at the top of the
// Discover surface (Sprint 6 Phase 3A). Visually distinct from theme/
// sector cards via teal accent border + sparkles icon, mirroring the
// Discovery taxonomy framing.
function DropSignalCard({ tokens, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        appearance: 'none',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        marginBottom: 16,
        background: `linear-gradient(135deg, ${tokens.bgCard} 0%, ${tokens.bgAgent} 100%)`,
        border: `1px solid ${tokens.teal}55`,
        borderRadius: 14,
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: `0 0 0 1px ${tokens.teal}10 inset`,
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${tokens.teal}99`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${tokens.teal}55`;
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${tokens.teal}1a`,
          border: `1px solid ${tokens.teal}40`,
          borderRadius: 10,
          color: tokens.teal,
        }}
      >
        <Sparkles size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.25,
          }}
        >
          Drop a Signal
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: tokens.textMuted,
            lineHeight: 1.45,
          }}
        >
          Paste a tweet, article, or news clip — build a curated watchlist
          together.
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: tokens.teal,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.3px',
        }}
      >
        Start
        <ArrowRight size={14} />
      </div>
    </button>
  );
}
