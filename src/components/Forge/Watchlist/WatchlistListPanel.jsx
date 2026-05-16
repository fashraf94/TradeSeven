// src/components/Forge/Watchlist/WatchlistListPanel.jsx
//
// Sprint 6 Phase 4D — content of the Forge "My Watchlists" tab. Loads the
// user's non-deleted watchlists on mount, sorts/filters them client-side,
// and wires card-click → editor and trash → delete confirmation.
//
// No real-time listener (D7): the list loads once on mount; a refresh picks
// up changes. Delete is optimistic — a successful soft-delete drops the row
// from local state without a refetch.

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { listWatchlists, deleteWatchlist } from '../../../services/forgeWatchlistService';
import {
  filterWatchlistsByStatus,
  countByStatus,
  sortByUpdatedDesc,
} from './filterWatchlistsByStatus';
import WatchlistListCard from './WatchlistListCard';
import WatchlistStatusFilter from './WatchlistStatusFilter';
import WatchlistListEmptyState from './WatchlistListEmptyState';
import DeleteWatchlistModal from './DeleteWatchlistModal';

export default function WatchlistListPanel({ user, onOpenWatchlist, onDropSignal }) {
  const { tokens } = useTheme();

  const [watchlists, setWatchlists] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // loading | error | loaded
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setWatchlists([]);
      setLoadState('loaded');
      return undefined;
    }
    setLoadState('loading');
    setErrorMessage('');
    listWatchlists()
      .then((list) => {
        if (cancelled) return;
        setWatchlists(Array.isArray(list) ? list : []);
        setLoadState('loaded');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[WatchlistListPanel] load failed:', err?.message || err);
        setErrorMessage('Could not load your watchlists. Refresh to try again.');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const sorted = sortByUpdatedDesc(watchlists);
  const counts = countByStatus(sorted);
  const visible = filterWatchlistsByStatus(sorted, statusFilter);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteBusy) return;
    const targetId = deleteTarget.watchlistId;
    setDeleteBusy(true);
    setErrorMessage('');
    try {
      await deleteWatchlist(targetId);
      setWatchlists((prev) => prev.filter((w) => w.watchlistId !== targetId));
    } catch (err) {
      console.error('[WatchlistListPanel] delete failed:', err?.message || err);
      setErrorMessage('Could not delete that watchlist. Try again.');
    } finally {
      setDeleteTarget(null);
      setDeleteBusy(false);
    }
  };

  const centerNote = {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 13,
    color: tokens.textMuted,
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
        My Watchlists
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: tokens.textMuted, lineHeight: 1.5 }}>
        Every watchlist you&apos;ve built from a signal.
      </p>

      {loadState === 'loading' && <div style={centerNote}>Loading your watchlists…</div>}

      {loadState === 'error' && <div style={{ ...centerNote, color: tokens.red }}>{errorMessage}</div>}

      {loadState === 'loaded' && watchlists.length === 0 && (
        <WatchlistListEmptyState tokens={tokens} onDropSignal={onDropSignal} />
      )}

      {loadState === 'loaded' && watchlists.length > 0 && (
        <>
          <div style={{ marginTop: 20 }}>
            <WatchlistStatusFilter
              tokens={tokens}
              active={statusFilter}
              counts={counts}
              onChange={setStatusFilter}
            />
          </div>

          {errorMessage && (
            <div style={{ marginTop: 12, fontSize: 12, color: tokens.red }}>{errorMessage}</div>
          )}

          {visible.length === 0 ? (
            <div style={centerNote}>
              No {statusFilter === 'draft' ? 'draft' : 'committed'} watchlists.
            </div>
          ) : (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {visible.map((wl) => (
                <WatchlistListCard
                  key={wl.watchlistId}
                  tokens={tokens}
                  watchlist={wl}
                  onOpen={onOpenWatchlist}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </>
      )}

      <DeleteWatchlistModal
        show={Boolean(deleteTarget)}
        watchlist={deleteTarget}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
