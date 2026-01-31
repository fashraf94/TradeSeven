// /src/components/Dashboard/PendingLobbiesSection.jsx
// Shows pending lobbies (BaggerBomb V3 + Snake Draft) created by the current user
// Uses unified card design matching Snake Draft style

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Copy } from 'lucide-react';

// Format time elapsed since creation
function formatTimeAgo(createdAt) {
  if (!createdAt) return 'Just now';

  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// Get asset count from V3 tiered portfolio
function getAssetCount(portfolio) {
  if (!portfolio) return 0;
  const starCount = (portfolio.star || []).filter(Boolean).length;
  const coreCount = (portfolio.core || []).filter(Boolean).length;
  const supportCount = (portfolio.support || []).filter(Boolean).length;
  return starCount + coreCount + supportCount;
}

// Get player count for Snake Draft
function getSnakeDraftPlayerCount(draft) {
  const current = draft.players?.length || 1;
  const max = draft.maxPlayers || 4;
  return { current, max };
}

// Unified Pending Lobby Card - matches Snake Draft style
function PendingLobbyCard({ lobby, type, onPress, onCopyCode }) {
  const isBaggerBomb = type === 'baggerbomb';
  const isSnakeDraft = type === 'snakeDraft';

  // Get creator info
  const creatorName = isBaggerBomb
    ? (lobby.creator?.username || 'You')
    : (lobby.players?.find(p => p.isHost)?.odUsername || 'You');

  const creatorAvatar = isBaggerBomb
    ? (lobby.creator?.avatar || '')
    : (lobby.players?.find(p => p.isHost)?.avatar || '');

  // Get created time
  const createdAt = isBaggerBomb
    ? lobby.timing?.createdAt
    : (lobby.createdAt?.toDate ? lobby.createdAt.toDate() : lobby.createdAt);

  // Get asset/player count
  const assetCount = isBaggerBomb ? getAssetCount(lobby.creator?.portfolio) : 0;
  const playerCount = isSnakeDraft ? getSnakeDraftPlayerCount(lobby) : null;

  // Get lobby code
  const lobbyCode = isBaggerBomb ? lobby.challengeCode : lobby.code;

  const gameEmoji = isBaggerBomb ? '💣' : '🐍';
  const gameLabel = isBaggerBomb ? 'BAGGERBOMB' : 'SNAKE DRAFT';

  // Amber/orange accent for pending state
  const pendingColor = '#f59e0b';
  // Cyan border like Snake Draft cards
  const borderColor = '#00d9ff';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onPress}
      style={{
        background: '#161b22',
        borderRadius: '16px',
        border: `2px solid ${borderColor}60`,
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '12px',
        boxShadow: `0 0 8px ${borderColor}20`,
      }}
    >
      {/* Header Row: Game type + PENDING badge + Time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{gameEmoji}</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#e6edf3',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {gameLabel}
          </span>
          {/* PENDING Badge */}
          <span style={{
            padding: '2px 8px',
            background: `${pendingColor}20`,
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '700',
            color: pendingColor,
            textTransform: 'uppercase',
          }}>
            PENDING
          </span>
        </div>

        {/* Time ago badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          background: 'rgba(139, 148, 158, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 148, 158, 0.2)',
        }}>
          <Clock size={12} style={{ color: '#8b949e' }} />
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#8b949e',
          }}>
            {formatTimeAgo(createdAt)}
          </span>
        </div>
      </div>

      {/* Main content: Players Layout */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'stretch',
      }}>
        {/* Players List - Left side */}
        <div style={{ flex: 1 }}>
          {/* You row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            marginBottom: '4px',
            borderRadius: '6px',
            background: 'rgba(0, 217, 255, 0.1)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
          }}>
            {/* Position number */}
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#ffd700',
              minWidth: '18px',
              fontFamily: "'SF Mono', 'Monaco', monospace",
            }}>
              [1]
            </span>

            {/* Avatar circle */}
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgba(0, 217, 255, 0.2)',
              border: '1.5px solid #00d9ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: creatorAvatar ? '12px' : '10px',
              fontWeight: '600',
              color: '#00d9ff',
              flexShrink: 0,
            }}>
              {creatorAvatar || creatorName[0]?.toUpperCase() || 'Y'}
            </div>

            {/* Name */}
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#00d9ff',
              flex: 1,
            }}>
              YOU
            </span>

            {/* Status */}
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              color: '#10b981',
            }}>
              Ready
            </span>
          </div>

          {/* Waiting opponent row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            borderRadius: '6px',
            background: 'transparent',
            border: '1px solid transparent',
          }}>
            {/* Position number */}
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#6e7681',
              minWidth: '18px',
              fontFamily: "'SF Mono', 'Monaco', monospace",
            }}>
              {isBaggerBomb ? '[2]' : `[${playerCount?.current + 1}]`}
            </span>

            {/* Waiting avatar */}
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#21262d',
              border: '1.5px dashed #30363d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#484f58',
              flexShrink: 0,
            }}>
              ?
            </div>

            {/* Waiting text */}
            <span style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6e7681',
              fontStyle: 'italic',
              flex: 1,
            }}>
              Waiting...
            </span>

            {/* Player count for Snake Draft */}
            {isSnakeDraft && playerCount && (
              <span style={{
                fontSize: '10px',
                color: pendingColor,
              }}>
                {playerCount.current}/{playerCount.max}
              </span>
            )}
          </div>
        </div>

        {/* Stats - Right side */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          minWidth: '90px',
          paddingLeft: '8px',
          borderLeft: '1px solid #21262d',
        }}>
          {isBaggerBomb && (
            <>
              <span style={{
                fontSize: '18px',
                fontWeight: '800',
                color: '#00d9ff',
                fontFamily: "'SF Mono', 'Monaco', monospace",
                lineHeight: 1.1,
              }}>
                {assetCount} assets
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '600',
                color: '#8b949e',
                marginTop: '4px',
                textTransform: 'uppercase',
              }}>
                READY
              </span>
            </>
          )}
          {isSnakeDraft && (
            <>
              <span style={{
                fontSize: '14px',
                fontWeight: '700',
                color: pendingColor,
                lineHeight: 1.1,
              }}>
                {playerCount?.current}/{playerCount?.max}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '600',
                color: '#8b949e',
                marginTop: '4px',
                textTransform: 'uppercase',
              }}>
                PLAYERS
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Info Box */}
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        background: 'rgba(33, 38, 45, 0.8)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={14} style={{ color: '#8b949e' }} />
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {isBaggerBomb ? 'Waiting for opponent' : 'Waiting for players'}
          </span>
        </div>

        {/* Copy Code Button */}
        {lobbyCode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopyCode(lobbyCode);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: '#00d9ff15',
              border: '1px solid #00d9ff40',
              borderRadius: '6px',
              color: '#00d9ff',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'SF Mono', 'Monaco', monospace",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00d9ff25';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#00d9ff15';
            }}
          >
            <Copy size={11} />
            {lobbyCode}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Main Section Component
export default function PendingLobbiesSection({
  lobbyBattles = [],
  user,
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  setBattleToJoin,
  copyToClipboard,
}) {
  const userId = user?.odUserId || user?.username;

  // Filter to only show lobbies created by current user
  const userPendingLobbies = useMemo(() => {
    const pending = [];

    (lobbyBattles || []).forEach(lobby => {
      // BaggerBomb V3
      if (lobby._v === 3) {
        const creatorId = lobby.creator?.odUserId || lobby.creator?.uid;
        if (creatorId === userId && lobby.state?.status === 'waiting') {
          pending.push({ lobby, type: 'baggerbomb' });
        }
      }
      // Snake Draft
      else if (lobby.isSnakeDraft || lobby.battleType === 'snake-draft') {
        const host = lobby.players?.find(p => p.isHost);
        if (host?.odUserId === userId && lobby.status === 'waiting') {
          pending.push({ lobby, type: 'snakeDraft' });
        }
      }
    });

    // Sort by creation time, most recent first
    pending.sort((a, b) => {
      const aTime = a.lobby.timing?.createdAt || a.lobby.createdAt || 0;
      const bTime = b.lobby.timing?.createdAt || b.lobby.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    return pending;
  }, [lobbyBattles, userId]);

  // Don't render if no pending lobbies
  if (userPendingLobbies.length === 0) return null;

  const handleLobbyPress = (lobby, type) => {
    if (type === 'baggerbomb') {
      // Navigate to battle view in pending mode
      setCurrentBattle(lobby);
      setScreen('battle');
    } else if (type === 'snakeDraft') {
      // Navigate to draft lobby
      setCurrentDraft(lobby);
      setScreen('draftLobby');
    }
  };

  const handleCopyCode = (code) => {
    if (copyToClipboard) {
      copyToClipboard(code);
    } else {
      navigator.clipboard.writeText(code).catch(() => {});
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ marginBottom: '20px' }}
    >
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
      }}>
        <Clock size={16} style={{ color: '#f59e0b' }} />
        <span style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#e6edf3',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Your Pending Lobbies
        </span>
        <span style={{
          background: '#f59e0b20',
          color: '#f59e0b',
          padding: '2px 10px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          {userPendingLobbies.length}
        </span>
      </div>

      {/* Pending Lobby Cards */}
      {userPendingLobbies.map(({ lobby, type }) => (
        <PendingLobbyCard
          key={lobby.id}
          lobby={lobby}
          type={type}
          onPress={() => handleLobbyPress(lobby, type)}
          onCopyCode={handleCopyCode}
        />
      ))}
    </motion.div>
  );
}
