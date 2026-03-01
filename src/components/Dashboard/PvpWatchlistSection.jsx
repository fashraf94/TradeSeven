// /src/components/Dashboard/PvpWatchlistSection.jsx
// PVP tab — Watchlist + Lobbies behind a segmented control

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { WatchlistContainer } from './Watchlist';
import { HoloCard } from '../shared';
import { getUsername, isBaggerBombBattle } from '../../utils/battleHelpers';
import { useIsMobile } from '../../hooks';

// ============================================
// Lobby helpers (carried from PvpCommandCenter)
// ============================================
function getBattleTypeInfo(battle) {
  if (!battle) return { icon: '⚔️', label: 'Builder 1v1' };
  if (isBaggerBombBattle(battle)) return { icon: '💣', label: 'BaggerBomb' };
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') return { icon: '🐍', label: 'Snake Draft' };
  return { icon: '⚔️', label: 'Builder 1v1' };
}

function getPlayerCountDisplay(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const current = battle.players?.length || 1;
    return `${current}/4 players`;
  }
  if (battle._v === 3 || battle._v === 4) {
    return battle.state?.status === 'waiting' ? '1/2 players · Waiting' : '2/2 players';
  }
  const hasOpponent = battle.opponent && getUsername(battle.opponent);
  return hasOpponent ? '2/2 players' : '1/2 players';
}

function getCreatorName(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const host = battle.players?.find(p => p.isHost);
    return host?.odUsername || host?.displayName || 'Player';
  }
  if (battle._v === 3 || battle._v === 4) return battle.creator?.username || 'Player';
  return getUsername(battle.creator) || 'Player';
}

function getLobbyUserId(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const host = battle.players?.find(p => p.isHost);
    return host?.odUserId;
  }
  if (battle._v === 3 || battle._v === 4) return battle.creator?.odUserId;
  return battle.creator?.odUserId || battle.creator?.uid;
}

function getCreatedAt(battle) {
  if (battle.timing?.createdAt) return new Date(battle.timing.createdAt).getTime();
  if (battle.createdAt?.toDate) return battle.createdAt.toDate().getTime();
  if (battle.createdAt) return new Date(battle.createdAt).getTime();
  return Date.now();
}

// ============================================
// Lobby Item Component
// ============================================
function LobbyItem({ lobby, onAction, isMobile }) {
  const typeInfo = getBattleTypeInfo(lobby);

  return (
    <div style={{
      background: '#161b22',
      borderLeft: '4px solid #00d9ff',
      borderRadius: '8px',
      padding: isMobile ? '10px 12px' : '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: isMobile ? '10px' : '12px',
      minHeight: isMobile ? '50px' : '60px',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <span style={{ fontSize: isMobile ? '16px' : '18px', flexShrink: 0, lineHeight: isMobile ? '20px' : '24px' }}>
        {typeInfo.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: isMobile ? '12px' : '13px', color: '#e6edf3', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {getCreatorName(lobby)} created a {typeInfo.label} lobby
        </div>
        <div style={{
          fontSize: isMobile ? '11px' : '12px', color: '#8b949e', marginTop: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {getPlayerCountDisplay(lobby)}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onAction(lobby); }}
        style={{
          padding: isMobile ? '6px 10px' : '5px 14px',
          minHeight: '32px',
          background: 'rgba(0,217,255,0.08)',
          border: '1px solid rgba(0,217,255,0.25)',
          borderRadius: '6px',
          color: '#00d9ff',
          fontSize: isMobile ? '10px' : '11px',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s',
          alignSelf: 'center',
          outline: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,217,255,0.18)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,217,255,0.08)'; }}
      >
        [JOIN]
      </button>
    </div>
  );
}

// ============================================
// Main PvpWatchlistSection
// ============================================
export default function PvpWatchlistSection({
  user,
  colors,
  stocksData = [],
  cryptoData = [],
  lobbyBattles = [],
  // Lobby join
  onJoinLobby,
  setJoinCode,
  setJoinBattleType,
  setScreen,
  setCurrentDraft,
  setDraftState,
  copyToClipboard,
}) {
  const { isMobile } = useIsMobile();
  const [activeView, setActiveView] = useState('watchlist');

  // --- Lobby items (filter out own lobbies, dedup, sort) ---
  const lobbyItems = useMemo(() => {
    const currentUserId = user?.odUserId || user?.uid || user?.username;
    const seenIds = new Set();
    const items = [];

    (lobbyBattles || []).forEach(battle => {
      const creatorId = getLobbyUserId(battle);
      if (creatorId === currentUserId) return;
      const id = `lobby-${battle.id}`;
      if (seenIds.has(id)) return;
      seenIds.add(id);
      items.push({ ...battle, _lobbyId: id });
    });

    items.sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
    return items;
  }, [lobbyBattles, user]);

  // --- Lobby join handler ---
  const handleJoinLobby = (lobby) => {
    // V3/V4 BaggerBomb or Snake Draft — use onJoinLobby from parent
    if (lobby._v === 3 || lobby._v === 4 || lobby.isSnakeDraft || lobby.battleType === 'snake-draft') {
      if (onJoinLobby) {
        onJoinLobby(lobby);
        return;
      }
      // Fallback for Snake Draft
      if (lobby.isSnakeDraft || lobby.battleType === 'snake-draft') {
        if (setCurrentDraft && setScreen) {
          setCurrentDraft(lobby);
          setScreen('draftLobby');
        }
        return;
      }
    }

    // BaggerBomb V1/V2
    if (isBaggerBombBattle(lobby)) {
      if (setJoinCode && setJoinBattleType && setScreen) {
        setJoinCode(lobby.challengeCode || '');
        setJoinBattleType('baggerbomb');
        setScreen('joinPortfolioBuilderTD');
      }
      return;
    }

    // Classic 1v1 fallback
    if (setJoinCode && setJoinBattleType && setScreen) {
      setJoinCode(lobby.challengeCode || '');
      setJoinBattleType('classic');
      setScreen('builder');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      style={{
        marginBottom: '24px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Section Header + Segmented Control */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '0 4px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '14px' }}>📊</span>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#8b949e',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Market Watch
          </span>
        </div>

        {/* Segmented Control */}
        <div style={{
          display: 'inline-flex',
          background: '#0d1117',
          border: '1px solid #21262d',
          borderRadius: '10px',
          padding: '3px',
        }}>
          {[
            { id: 'watchlist', label: '📊 Watchlist' },
            { id: 'lobbies', label: `🏟️ Lobbies${lobbyItems.length > 0 ? ` (${lobbyItems.length})` : ''}` },
          ].map(tab => {
            const isActive = activeView === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: isActive
                    ? '1px solid rgba(147, 51, 234, 0.4)'
                    : '1px solid transparent',
                  background: isActive
                    ? 'rgba(147, 51, 234, 0.15)'
                    : 'transparent',
                  color: isActive ? '#c084fc' : '#6e7681',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                }}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {activeView === 'watchlist' ? (
        <WatchlistContainer
          user={user}
          colors={colors}
          stocksData={stocksData}
          cryptoData={cryptoData}
        />
      ) : (
        /* ─── Lobbies View ─── */
        lobbyItems.length > 0 ? (
          <HoloCard accentColor="purple">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              background: '#21262d',
            }}>
              {lobbyItems.map(lobby => (
                <LobbyItem
                  key={lobby._lobbyId || lobby.id}
                  lobby={lobby}
                  onAction={handleJoinLobby}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </HoloCard>
        ) : (
          <HoloCard accentColor="purple">
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏟️</div>
              <div style={{ fontSize: '13px', color: '#8b949e' }}>
                No open lobbies right now
              </div>
              <div style={{ fontSize: '12px', color: '#6e7681', marginTop: '4px' }}>
                Create a game to get started!
              </div>
            </div>
          </HoloCard>
        )
      )}
    </motion.div>
  );
}
