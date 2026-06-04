// src/components/Forge/workshop/WatchlistsArea.jsx
//
// Watchlists area (01) — the new frame wraps the existing, wired leaves:
//   • DiscoverPanel    — the Discover lane + Signal-Drop (paste → chat →
//                        watchlist), reused verbatim. Its requestWorkshopOpen
//                        handoff is STUBBED so it can never open the (shelved)
//                        Workshop — "build from a theme / dive in" is a Phase-2
//                        net-new affordance.
//   • WatchlistListPanel — manual create + "My Watchlists" shelf, reused with
//                        its in-Forge equip control stripped (home owns equip).
//
// Create / edit / "make ready" (commit) all happen in the routed Watchlist
// Editor screen, reached via onViewWatchlist — unchanged from today.

import React from 'react';
import { useFK, AreaHeader } from './forgeKit';
import DiscoverPanel from '../../discover/DiscoverPanel';
import WatchlistListPanel from '../Watchlist/WatchlistListPanel';

export default function WatchlistsArea({ agentName, primary, user, agent, showToast, onViewWatchlist }) {
  const T = useFK();

  // Phase-2 net-new: theme → watchlist / theme → curation chat. Stubbed so the
  // shelved Workshop is never reachable from Discover.
  const stubbedWorkshopOpen = React.useCallback(() => {
    showToast?.('Building a watchlist from a theme is coming soon', primary);
  }, [showToast, primary]);

  return (
    <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 18px 30px' }}>
      <AreaHeader n="01" name="Watchlists" slotLine={`The universe ${agentName || 'your agent'} watches`} accent={primary || T.teal} />

      {/* Discover lane + Signal Drop — reused leaf, wiring intact */}
      <DiscoverPanel
        showToast={showToast}
        requestWorkshopOpen={stubbedWorkshopOpen}
        agent={agent}
        onViewWatchlist={onViewWatchlist}
      />

      {/* My Watchlists shelf — reused leaf (equip stripped); owns its own header */}
      <div style={{ marginTop: 8 }}>
        <WatchlistListPanel
          user={user}
          onOpenWatchlist={onViewWatchlist}
          onDropSignal={() => showToast?.('Use “Drop a Signal” above to paste a signal', primary)}
        />
      </div>
    </div>
  );
}
