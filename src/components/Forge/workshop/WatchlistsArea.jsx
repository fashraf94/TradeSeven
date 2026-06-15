// src/components/Forge/workshop/WatchlistsArea.jsx
//
// Watchlists area (01) — the new frame wraps the existing, wired leaves:
//   • DiscoverPanel    — the Discover lane + Signal-Drop (paste → chat →
//                        watchlist), reused verbatim. A theme's primary CTA
//                        now BUILDS a draft watchlist from the theme
//                        (onBuildWatchlistFromTheme) instead of opening the
//                        shelved Workshop. The sector handoff stays stubbed
//                        (sector → watchlist is a later affordance); "theme →
//                        Dive in (curation chat)" remains the Phase-2 net-new.
//   • WatchlistListPanel — manual create + "My Watchlists" shelf, reused with
//                        its in-Forge equip control stripped (home owns equip).
//
// Edit / "make ready" (commit) happen in the routed Watchlist Editor screen,
// reached via onViewWatchlist. Theme → watchlist seeds the draft (name +
// thesis + tickers) and lands the user in that same editor to review and
// commit — the Forge marks "ready"; equipping lives on the Home.

import React from 'react';
import { useFK, AreaHeader } from './forgeKit';
import DiscoverPanel from '../../discover/DiscoverPanel';
import WatchlistListPanel from '../Watchlist/WatchlistListPanel';
import { createWatchlist, patchWatchlist } from '../../../services/forgeWatchlistService';
import { Sparkles, Compass, Plus } from 'lucide-react';

// PATCH contract (api/forge/watchlists/[id].js): tickers cap at 40, symbols
// are uppercased/trimmed server-side; we dedupe + cap client-side too so the
// editor opens with exactly what we sent. name ≤100, thesis ≤1000.
const MAX_SEED_TICKERS = 40;

export default function WatchlistsArea({ agentName, primary, user, agent, showToast, onViewWatchlist, twoCol = false }) {
  const T = useFK();
  const [buildingTheme, setBuildingTheme] = React.useState(false);
  // Set by the desktop-left DiscoverPanel; the right column's "Build with Atlas"
  // entry (Phase 4) calls it to open the Signal-Drop flow DiscoverPanel owns.
  const signalDropOpener = React.useRef(null);
  const [creatingManual, setCreatingManual] = React.useState(false);

  // Phase 2: theme → build a draft watchlist. Create an empty draft, seed it
  // with the theme's name/thesis/tickers via PATCH, then route into the editor
  // (draft) where the user reviews and commits. On success the component
  // unmounts via navigation, so the in-flight guard only resets on error
  // (mirrors WatchlistListPanel's manual-create pattern).
  const handleBuildFromTheme = React.useCallback(
    async ({ title, thesis, tickers } = {}) => {
      if (buildingTheme) return;
      setBuildingTheme(true);
      try {
        const seen = new Set();
        const shaped = (Array.isArray(tickers) ? tickers : [])
          .map((sym) => (typeof sym === 'string' ? sym.trim().toUpperCase() : ''))
          .filter((sym) => {
            if (!sym || seen.has(sym)) return false;
            seen.add(sym);
            return true;
          })
          .slice(0, MAX_SEED_TICKERS)
          .map((symbol) => ({ symbol, reasoning: '', category: '', addedBy: 'user' }));

        const { watchlistId } = await createWatchlist();
        await patchWatchlist(watchlistId, {
          name: (title || '').slice(0, 100),
          thesis: (thesis || '').slice(0, 1000),
          tickers: shaped,
        });
        onViewWatchlist?.(watchlistId, 'watchlists');
      } catch (err) {
        console.error('[WatchlistsArea] build from theme failed:', err?.message || err);
        showToast?.('Could not start that watchlist. Try again.', primary);
        setBuildingTheme(false);
      }
    },
    [buildingTheme, onViewWatchlist, showToast, primary],
  );

  // Sector handoff stays a no-op toast — sector → watchlist is a later
  // affordance, and the shelved Workshop must never be reachable from here.
  const stubbedSectorWorkshop = React.useCallback(() => {
    showToast?.('Building a watchlist from a sector is coming soon', primary);
  }, [showToast, primary]);

  // "Start a watchlist" entries (desktop right column). Build with Atlas opens
  // the Signal-Drop flow DiscoverPanel owns (via the registered opener). From a
  // theme is a hint — the real build runs from the theme modal's "Build a
  // watchlist" CTA on the left. Manual creates an empty draft and opens the editor.
  const handleBuildWithAtlas = React.useCallback(() => {
    if (typeof signalDropOpener.current === 'function') {
      signalDropOpener.current();
    } else {
      showToast?.('Open a theme or signal on the left to start', primary);
    }
  }, [showToast, primary]);

  const handleFromThemeHint = React.useCallback(() => {
    showToast?.('Open any theme on the left, then “Build a watchlist”', primary);
  }, [showToast, primary]);

  const handleCreateManual = React.useCallback(async () => {
    if (creatingManual) return;
    setCreatingManual(true);
    try {
      const { watchlistId } = await createWatchlist();
      onViewWatchlist?.(watchlistId, 'watchlists');
    } catch (err) {
      console.error('[WatchlistsArea] manual create failed:', err?.message || err);
      showToast?.('Could not create a watchlist. Try again.', primary);
      setCreatingManual(false);
    }
  }, [creatingManual, onViewWatchlist, showToast, primary]);

  if (twoCol) {
    return (
      <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 24px calc(84px + env(safe-area-inset-bottom))' }}>
        <AreaHeader n="01" name="Watchlists" slotLine={`The universe ${agentName || 'your agent'} watches`} accent={primary || T.teal} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 24, alignItems: 'start' }}>
          {/* LEFT — Discover (desktop variant): rails relocate here; the modals +
              Signal-Drop machine stay owned by DiscoverPanel and are exposed up. */}
          <div style={{ minWidth: 0 }}>
            <DiscoverPanel
              variant="desktopLeft"
              onRegisterSignalDropOpener={(fn) => { signalDropOpener.current = fn; }}
              showToast={showToast}
              requestWorkshopOpen={stubbedSectorWorkshop}
              onBuildWatchlistFromTheme={handleBuildFromTheme}
              agent={agent}
              onViewWatchlist={onViewWatchlist}
            />
          </div>
          {/* RIGHT — Create & manage: the three creation entries wired to the
              existing pipelines, then the reused "My Watchlists" list. */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.ink, lineHeight: 1.2 }}>
                Start a watchlist
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <StartWatchlistEntry
                  T={T}
                  accent={T.teal}
                  icon={<Sparkles size={18} />}
                  title="Build with Atlas"
                  subtitle="Paste a signal or talk it through"
                  onClick={handleBuildWithAtlas}
                />
                <StartWatchlistEntry
                  T={T}
                  accent={T.gold}
                  icon={<Compass size={18} />}
                  title="From a theme"
                  subtitle="Open any theme on the left"
                  onClick={handleFromThemeHint}
                />
                <StartWatchlistEntry
                  T={T}
                  accent={T.copper}
                  icon={<Plus size={18} />}
                  title="Manual"
                  subtitle="Pick the tickers yourself"
                  onClick={handleCreateManual}
                  disabled={creatingManual}
                />
              </div>
            </section>

            <WatchlistListPanel
              user={user}
              showProvenance
              hideCreate
              onOpenWatchlist={(id) => onViewWatchlist && onViewWatchlist(id, 'watchlists')}
              onDropSignal={handleBuildWithAtlas}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 18px calc(84px + env(safe-area-inset-bottom))' }}>
      <AreaHeader n="01" name="Watchlists" slotLine={`The universe ${agentName || 'your agent'} watches`} accent={primary || T.teal} />

      {/* Discover lane + Signal Drop — reused leaf. Theme CTA builds a draft
          watchlist; sector CTA stays stubbed. */}
      <DiscoverPanel
        showToast={showToast}
        requestWorkshopOpen={stubbedSectorWorkshop}
        onBuildWatchlistFromTheme={handleBuildFromTheme}
        agent={agent}
        onViewWatchlist={onViewWatchlist}
      />

      {/* My Watchlists shelf — reused leaf (equip stripped); owns its own header */}
      <div style={{ marginTop: 8 }}>
        <WatchlistListPanel
          user={user}
          onOpenWatchlist={(id) => onViewWatchlist && onViewWatchlist(id, 'watchlists')}
          onDropSignal={() => showToast?.('Use “Drop a Signal” above to paste a signal', primary)}
        />
      </div>
    </div>
  );
}

// One "Start a watchlist" entry card for the desktop right column. Icon chip +
// title + subtitle, styled with the forge `T` tokens.
function StartWatchlistEntry({ T, accent, icon, title, subtitle, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: 'none',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: T.surface,
        border: `1px solid ${T.hair}`,
        borderRadius: 12,
        color: 'inherit',
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.hair; }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9,
          color: accent,
          background: `${accent}1a`,
          border: `1px solid ${accent}40`,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>
          {title}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: T.ink2, lineHeight: 1.4 }}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}
