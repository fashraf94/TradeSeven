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
import { BookmarkPlus } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import useAgent from '../../../hooks/useAgent';
import {
  listWatchlists,
  deleteWatchlist,
  createWatchlist,
} from '../../../services/forgeWatchlistService';
import { equipWatchlist, unequipWatchlist } from '../../../services/agentService';
import { getEquipErrorMessage } from '../../../utils/watchlistEquipUI';
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
  const { agent } = useAgent(user?.odUserId);

  const [watchlists, setWatchlists] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // loading | error | loaded
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [working, setWorking] = useState(false);
  const [equipError, setEquipError] = useState('');

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

  // Phase 5A — auto-dismiss the create-error banner after 5s.
  useEffect(() => {
    if (!createError) return undefined;
    const timer = setTimeout(() => setCreateError(''), 5000);
    return () => clearTimeout(timer);
  }, [createError]);

  // Phase 5B2 — auto-dismiss the equip/unequip error banner after 5s.
  useEffect(() => {
    if (!equipError) return undefined;
    const timer = setTimeout(() => setEquipError(''), 5000);
    return () => clearTimeout(timer);
  }, [equipError]);

  const sorted = sortByUpdatedDesc(watchlists);
  const counts = countByStatus(sorted);
  const visible = filterWatchlistsByStatus(sorted, statusFilter);

  // Phase 5A — manual create: POST an empty draft, then open it in the editor.
  // On success the panel unmounts via navigation, so `creating` resets only
  // on the error path.
  const handleNewWatchlist = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const result = await createWatchlist();
      onOpenWatchlist(result.watchlistId);
    } catch (err) {
      console.error('[WatchlistListPanel] create failed:', err?.message || err);
      setCreateError('Could not create a new watchlist. Try again.');
      setCreating(false);
    }
  };

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

  // Phase 5B2 — equip / unequip the user's agent. The useAgent subscription
  // auto-refreshes the equipped state across every card on success, so there
  // is no local list mutation here. `working` disables all card buttons while
  // a request is in flight (matches Phase 5A's single-flag pattern).
  const handleEquip = async (watchlistId) => {
    if (working || !agent?.id) return;
    setWorking(true);
    setEquipError('');
    try {
      await equipWatchlist(agent.id, watchlistId);
      console.log('[Phase5B2] WatchlistListPanel equip ok:', { agentId: agent.id, watchlistId });
    } catch (err) {
      console.error('[Phase5B2] WatchlistListPanel equip failed:', err);
      setEquipError(getEquipErrorMessage(err, 'equip'));
    } finally {
      setWorking(false);
    }
  };

  const handleUnequip = async () => {
    if (working || !agent?.id) return;
    setWorking(true);
    setEquipError('');
    try {
      await unequipWatchlist(agent.id);
      console.log('[Phase5B2] WatchlistListPanel unequip ok:', { agentId: agent.id });
    } catch (err) {
      console.error('[Phase5B2] WatchlistListPanel unequip failed:', err);
      setEquipError(getEquipErrorMessage(err, 'unequip'));
    } finally {
      setWorking(false);
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
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
            Every watchlist you&apos;ve built.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewWatchlist}
          disabled={creating}
          aria-label="Create a new watchlist"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            padding: '8px 14px',
            borderRadius: 8,
            border: `1px solid ${tokens.teal}`,
            background: 'transparent',
            color: tokens.teal,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.5 : 1,
          }}
        >
          <BookmarkPlus size={14} />
          New Watchlist
        </button>
      </div>

      {createError && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${tokens.red}`,
            color: tokens.red,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {createError}
        </div>
      )}

      {equipError && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${tokens.red}`,
            color: tokens.red,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {equipError}
        </div>
      )}

      {loadState === 'loading' && <div style={centerNote}>Loading your watchlists…</div>}

      {loadState === 'error' && <div style={{ ...centerNote, color: tokens.red }}>{errorMessage}</div>}

      {loadState === 'loaded' && watchlists.length === 0 && (
        <WatchlistListEmptyState
          tokens={tokens}
          onDropSignal={onDropSignal}
          onNewWatchlist={handleNewWatchlist}
          creating={creating}
        />
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
                  agent={agent}
                  onEquip={handleEquip}
                  onUnequip={handleUnequip}
                  working={working}
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
