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

// PATCH contract (api/forge/watchlists/[id].js): tickers cap at 40, symbols
// are uppercased/trimmed server-side; we dedupe + cap client-side too so the
// editor opens with exactly what we sent. name ≤100, thesis ≤1000.
const MAX_SEED_TICKERS = 40;

export default function WatchlistsArea({ agentName, primary, user, agent, showToast, onViewWatchlist }) {
  const T = useFK();
  const [buildingTheme, setBuildingTheme] = React.useState(false);

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
