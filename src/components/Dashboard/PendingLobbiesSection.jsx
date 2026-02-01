// /src/components/Dashboard/PendingLobbiesSection.jsx
// Shows pending lobbies (BaggerBomb V3 + Snake Draft) where user is creator OR participant
// Uses horizontal carousel layout matching Active PVP section

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

// Compact Pending Lobby Card - matches ClashCard dimensions
function PendingLobbyCard({ lobby, type, isHost, currentUserId, onPress, onCopyCode }) {
  const isBaggerBomb = type === 'baggerbomb';
  const isSnakeDraft = type === 'snakeDraft';

  // Get host/creator info
  const hostName = isBaggerBomb
    ? (lobby.creator?.username || 'Host')
    : (lobby.players?.find(p => p.isHost)?.odUsername || 'Host');

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

  // Colors
  const pendingColor = '#f59e0b';
  const borderColor = '#00d9ff';
  const roleBadgeColor = isHost ? '#00d9ff' : '#10b981';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onPress}
      style={{
        // Match ClashCard dimensions exactly
        flex: '0 0 auto',
        width: 'calc(85vw - 32px)',
        maxWidth: '340px',
        minWidth: '280px',
        scrollSnapAlign: 'start',
        // Card styling
        background: '#161b22',
        borderRadius: '16px',
        border: `2px solid ${borderColor}60`,
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 0 8px ${borderColor}20`,
      }}
    >
      {/* Header Row: Game type + badges + Time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          {/* HOST/JOINED Badge */}
          <span style={{
            padding: '2px 5px',
            background: `${roleBadgeColor}20`,
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: '700',
            color: roleBadgeColor,
          }}>
            {isHost ? 'HOST' : 'JOINED'}
          </span>
        </div>

        {/* Time ago badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          background: `${pendingColor}15`,
          borderRadius: '8px',
          border: `1px solid ${pendingColor}40`,
        }}>
          <Clock size={11} style={{ color: pendingColor }} />
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: pendingColor,
          }}>
            {formatTimeAgo(createdAt)}
          </span>
        </div>
      </div>

      {/* Compact VS Layout */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        {/* Your side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(0, 217, 255, 0.15)',
            border: '2px solid #00d9ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#00d9ff' }}>
              YOU
            </div>
            <div style={{ fontSize: '11px', color: '#10b981' }}>
              {isBaggerBomb ? `${assetCount} assets` : 'Ready'}
            </div>
          </div>
        </div>

        {/* VS */}
        <div style={{
          fontSize: '12px',
          fontWeight: '700',
          color: '#6e7681',
          padding: '0 8px',
        }}>
          VS
        </div>

        {/* Opponent/Waiting side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: 'row-reverse' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#21262d',
            border: '2px dashed #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#484f58',
          }}>
            ?
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#6e7681', fontStyle: 'italic' }}>
              {isSnakeDraft ? `${playerCount?.current}/${playerCount?.max}` : 'Waiting'}
            </div>
            <div style={{ fontSize: '11px', color: '#484f58' }}>
              {isSnakeDraft ? 'players' : 'opponent'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Status bar with code */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'rgba(33, 38, 45, 0.8)',
        borderRadius: '8px',
        marginTop: '4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: pendingColor,
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '11px', color: '#8b949e' }}>
            Waiting...
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
              gap: '5px',
              padding: '4px 8px',
              background: '#00d9ff15',
              border: '1px solid #00d9ff40',
              borderRadius: '6px',
              color: '#00d9ff',
              fontSize: '10px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: "'SF Mono', 'Monaco', monospace",
            }}
          >
            <Copy size={10} />
            {lobbyCode}
          </button>
        )}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
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

  // Filter to show lobbies where user is CREATOR or has JOINED
  const userPendingLobbies = useMemo(() => {
    const pending = [];

    (lobbyBattles || []).forEach(lobby => {
      // BaggerBomb V3
      if (lobby._v === 3) {
        const creatorId = lobby.creator?.odUserId || lobby.creator?.uid;
        const isCreator = creatorId === userId;
        const isPending = lobby.state?.status === 'waiting';

        if (isCreator && isPending) {
          pending.push({ lobby, type: 'baggerbomb', isHost: true });
        }
      }
      // Snake Draft
      else if (lobby.isSnakeDraft || lobby.battleType === 'snake-draft') {
        const host = lobby.players?.find(p => p.isHost);
        const isHost = host?.odUserId === userId;
        const isPlayer = lobby.players?.some(p => p.odUserId === userId);
        const isPending = lobby.status === 'waiting';

        if ((isHost || isPlayer) && isPending) {
          pending.push({ lobby, type: 'snakeDraft', isHost });
        }
      }
    });

    pending.sort((a, b) => {
      const aTime = a.lobby.timing?.createdAt || a.lobby.createdAt || 0;
      const bTime = b.lobby.timing?.createdAt || b.lobby.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    return pending;
  }, [lobbyBattles, userId]);

  if (userPendingLobbies.length === 0) return null;

  const handleLobbyPress = (lobby, type) => {
    if (type === 'baggerbomb') {
      setCurrentBattle(lobby);
      setScreen('battle');
    } else if (type === 'snakeDraft') {
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

  const accentColor = '#f59e0b';

  // Single card - render directly without carousel
  if (userPendingLobbies.length === 1) {
    const { lobby, type, isHost } = userPendingLobbies[0];

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
          padding: '0 4px',
        }}>
          <Clock size={16} style={{ color: accentColor }} />
          <span style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#e6edf3',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
          }}>
            PENDING LOBBIES
          </span>
          <span style={{
            background: `${accentColor}20`,
            color: accentColor,
            padding: '2px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {userPendingLobbies.length} waiting
          </span>
        </div>

        {/* Single card */}
        <div style={{ padding: '0 4px' }}>
          <PendingLobbyCard
            lobby={lobby}
            type={type}
            isHost={isHost}
            currentUserId={userId}
            onPress={() => handleLobbyPress(lobby, type)}
            onCopyCode={handleCopyCode}
          />
        </div>
      </motion.div>
    );
  }

  // Multiple cards - use horizontal carousel
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
        padding: '0 16px',
      }}>
        <Clock size={16} style={{ color: accentColor }} />
        <span style={{
          fontSize: '13px',
          fontWeight: '700',
          color: '#e6edf3',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
        }}>
          PENDING LOBBIES
        </span>
        <span style={{
          background: `${accentColor}20`,
          color: accentColor,
          padding: '2px 8px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '600',
        }}>
          {userPendingLobbies.length} waiting
        </span>
      </div>

      {/* Horizontal Carousel */}
      <style>{`
        .pending-carousel::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        className="pending-carousel"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          gap: '12px',
          padding: '0 16px 8px 16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {userPendingLobbies.map(({ lobby, type, isHost }) => (
          <PendingLobbyCard
            key={lobby.id}
            lobby={lobby}
            type={type}
            isHost={isHost}
            currentUserId={userId}
            onPress={() => handleLobbyPress(lobby, type)}
            onCopyCode={handleCopyCode}
          />
        ))}
      </div>
    </motion.div>
  );
}
