// src/components/Agent/EquippedWatchlistCard.jsx
//
// Phase 5B2 — Watchlist Equip UI. The AgentDashboard surface for equipping a
// committed watchlist to the agent (Q6b) and the "Watchlist: <name>" indicator
// (Q7b). Self-contained for watchlist data — it loads the user's committed
// watchlists and probes the equipped one itself; `agent` arrives as a prop
// (AgentDashboard owns the single useAgent subscription). Renders in the
// AgentOverviewTab right column, a peer of DeployedStrategyCard.

import React, { useState, useEffect } from 'react';
import { Bookmark, ArrowRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import HoloCard from '../shared/HoloCard';
import { listWatchlists, getWatchlist } from '../../services/forgeWatchlistService';
import { equipWatchlist, unequipWatchlist } from '../../services/agentService';
import { filterWatchlistsByStatus } from '../Forge/Watchlist/filterWatchlistsByStatus';
import { resolveEquippedName, getEquipErrorMessage } from '../../utils/watchlistEquipUI';

const SectionHeader = ({ label, tokens }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
    <div style={{
      width: 3,
      height: 16,
      background: `linear-gradient(180deg, ${tokens.teal}, ${tokens.purple})`,
      borderRadius: 2,
    }} />
    <Bookmark size={14} color={tokens.textMuted} />
    <span style={{
      fontSize: 13,
      fontWeight: 700,
      color: tokens.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
    }}>
      {label}
    </span>
  </div>
);

const EquippedWatchlistCard = ({ agent, onNavigateToForge }) => {
  const { tokens } = useTheme();

  const [committed, setCommitted] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('pending'); // pending | ok | not_found | error
  const [freshWatchlist, setFreshWatchlist] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const equippedWatchlistId = agent?.equippedWatchlistId || null;
  const activeBattle = Boolean(agent?.activeBattleId);

  // Load the user's committed watchlists — the selector options.
  useEffect(() => {
    let cancelled = false;
    listWatchlists()
      .then((list) => {
        if (cancelled) return;
        setCommitted(filterWatchlistsByStatus(list, 'committed'));
        setListLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[Phase5B2] EquippedWatchlistCard list load failed:', err);
        setListLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Refresh-on-load (Q-B6): probe the equipped watchlist so a rename shows the
  // current name and a soft-deleted list reads as "(unavailable)". Re-runs when
  // the equip changes — the useAgent subscription updates `agent`.
  useEffect(() => {
    if (!equippedWatchlistId) {
      setFetchStatus('pending');
      setFreshWatchlist(null);
      return undefined;
    }
    let cancelled = false;
    setFetchStatus('pending');
    setFreshWatchlist(null);
    getWatchlist(equippedWatchlistId)
      .then((wl) => {
        if (cancelled) return;
        setFreshWatchlist(wl);
        setFetchStatus('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 404) {
          setFetchStatus('not_found');
        } else {
          console.error('[Phase5B2] EquippedWatchlistCard probe failed:', err);
          setFetchStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [equippedWatchlistId]);

  // Auto-dismiss the error banner after 5s (Phase 5A pattern).
  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const { name: equippedName, unavailable } = resolveEquippedName({
    equippedWatchlistId,
    cachedName: agent?.equippedWatchlistName || null,
    freshWatchlist,
    fetchStatus,
  });

  const handleSelectChange = async (e) => {
    const value = e.target.value;
    if (working || !agent?.id || value === (equippedWatchlistId || '')) return;
    setWorking(true);
    setError('');
    try {
      if (value === '') {
        await unequipWatchlist(agent.id);
        console.log('[Phase5B2] EquippedWatchlistCard unequip ok:', { agentId: agent.id });
      } else {
        await equipWatchlist(agent.id, value);
        console.log('[Phase5B2] EquippedWatchlistCard equip ok:', { agentId: agent.id, watchlistId: value });
      }
    } catch (err) {
      console.error('[Phase5B2] EquippedWatchlistCard equip/unequip failed:', err);
      setError(getEquipErrorMessage(err, value === '' ? 'unequip' : 'equip'));
    } finally {
      setWorking(false);
    }
  };

  const equippedInList = committed.some((w) => w.watchlistId === equippedWatchlistId);
  const showEmptyState = listLoaded && committed.length === 0 && !equippedWatchlistId;
  const selectDisabled = activeBattle || working;

  // The AgentOverviewTab wrapper (<motion.div variants={sectionVariants}>)
  // supplies the entrance animation, so this card needs no motion of its own.
  return (
    <>
      <SectionHeader label="Equipped Watchlist" tokens={tokens} />

      <HoloCard
        variant="default"
        size="lg"
        style={{
          borderLeft: `3px solid ${tokens.teal}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {!listLoaded && (
          <span style={{ fontSize: 13, color: tokens.textMuted }}>Loading watchlists…</span>
        )}

        {showEmptyState && (
          <>
            <span style={{ fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>
              Create a watchlist to give your agent priority opportunities.
            </span>
            <button
              type="button"
              onClick={onNavigateToForge}
              disabled={!onNavigateToForge}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${tokens.teal}`,
                background: `${tokens.teal}22`,
                color: tokens.teal,
                fontSize: 13,
                fontWeight: 700,
                cursor: onNavigateToForge ? 'pointer' : 'default',
                alignSelf: 'flex-start',
                fontFamily: 'inherit',
              }}
            >
              Create a watchlist in Forge <ArrowRight size={14} />
            </button>
          </>
        )}

        {listLoaded && !showEmptyState && (
          <>
            {/* Indicator chip (Q7b) — read-only */}
            {equippedWatchlistId ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  alignSelf: 'flex-start',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: tokens.teal,
                  background: `${tokens.teal}1f`,
                  border: `1px solid ${tokens.teal}3d`,
                }}
              >
                <Bookmark size={10} />
                Watchlist: {equippedName}{unavailable ? ' (unavailable)' : ''}
              </span>
            ) : (
              <span style={{ fontSize: 13, color: tokens.textMuted }}>
                No watchlist equipped.
              </span>
            )}

            {/* Selector */}
            <select
              aria-label="Equipped watchlist"
              value={equippedWatchlistId || ''}
              onChange={handleSelectChange}
              disabled={selectDisabled}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${tokens.borderInput}`,
                background: tokens.bgApp,
                color: tokens.textPrimary,
                fontSize: 13,
                fontFamily: 'inherit',
                cursor: selectDisabled ? 'not-allowed' : 'pointer',
                opacity: selectDisabled ? 0.5 : 1,
              }}
            >
              <option value="">None equipped</option>
              {equippedWatchlistId && !equippedInList && (
                <option value={equippedWatchlistId}>
                  {equippedName}{unavailable ? ' (unavailable)' : ''}
                </option>
              )}
              {committed.map((w) => (
                <option key={w.watchlistId} value={w.watchlistId}>
                  {(w.name || 'Untitled watchlist')} ({(w.tickers || []).length} tickers)
                </option>
              ))}
            </select>

            {activeBattle && (
              <span style={{ fontSize: 11, color: tokens.textFaint, lineHeight: 1.4 }}>
                Changes apply to your next battle.
              </span>
            )}
          </>
        )}

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${tokens.red}`,
              color: tokens.red,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </HoloCard>
    </>
  );
};

export default EquippedWatchlistCard;
