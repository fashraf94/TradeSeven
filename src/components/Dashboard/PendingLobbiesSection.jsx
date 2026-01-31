// /src/components/Dashboard/PendingLobbiesSection.jsx
// Shows pending lobbies (BaggerBomb V3 + Snake Draft) created by the current user
// Displayed on dashboard between Live Clashes and other sections

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Share2, Bomb, Copy } from 'lucide-react';

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

// Single Pending Lobby Card
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

  const accentColor = '#f59e0b'; // Amber for pending state
  const gameEmoji = isBaggerBomb ? '💣' : '🐍';
  const gameLabel = isBaggerBomb ? 'BaggerBomb' : 'Snake Draft';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onPress}
      style={{
        background: '#161b22',
        borderRadius: '16px',
        border: `2px solid ${accentColor}60`,
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '12px',
      }}
    >
      {/* Header Row: Game type + Time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
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
          {/* Pending Badge */}
          <span style={{
            padding: '2px 8px',
            background: `${accentColor}20`,
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '700',
            color: accentColor,
            textTransform: 'uppercase',
          }}>
            PENDING
          </span>
        </div>

        {/* Time ago */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: '#8b949e',
          fontSize: '12px',
        }}>
          <Clock size={12} />
          {formatTimeAgo(createdAt)}
        </div>
      </div>

      {/* VS Zone: Your side + Waiting side */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        gap: '16px',
      }}>
        {/* Your Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b98130 0%, #00d9ff30 100%)',
            border: '3px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px',
            fontSize: creatorAvatar ? '24px' : '20px',
          }}>
            {creatorAvatar || '👤'}
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#e6edf3',
            textAlign: 'center',
          }}>
            {creatorName}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            color: '#10b981',
            background: '#10b98120',
            padding: '2px 6px',
            borderRadius: '4px',
            marginTop: '4px',
          }}>
            YOU
          </span>
        </div>

        {/* VS Divider */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#6e7681',
          }}>
            VS
          </span>
        </div>

        {/* Waiting Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#21262d',
            border: '3px dashed #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '24px', color: '#484f58' }}>?</span>
          </div>
          <span style={{
            fontSize: '12px',
            color: '#8b949e',
            fontStyle: 'italic',
            textAlign: 'center',
          }}>
            Waiting...
          </span>
          {isSnakeDraft && playerCount && (
            <span style={{
              fontSize: '10px',
              color: accentColor,
              marginTop: '4px',
            }}>
              {playerCount.current}/{playerCount.max} players
            </span>
          )}
        </div>
      </div>

      {/* Footer: Asset count + Share button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '12px',
        borderTop: '1px solid #21262d',
      }}>
        {/* Asset/Info count */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#8b949e',
          fontSize: '12px',
        }}>
          {isBaggerBomb && (
            <>
              <Users size={14} />
              <span><strong style={{ color: '#e6edf3' }}>{assetCount}</strong> assets ready</span>
            </>
          )}
          {isSnakeDraft && (
            <>
              <Users size={14} />
              <span>Waiting for players to join</span>
            </>
          )}
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
              padding: '6px 12px',
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '8px',
              color: '#8b949e',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#30363d';
              e.currentTarget.style.color = '#e6edf3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#21262d';
              e.currentTarget.style.color = '#8b949e';
            }}
          >
            <Copy size={12} />
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
