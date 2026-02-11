// /src/components/Dashboard/PendingLobbiesSection.jsx
// Shows pending lobbies (BaggerBomb V3 + Snake Draft) where user is creator OR participant
// Shows all player slots with detailed status (matching reference design)

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Copy, AlertTriangle } from 'lucide-react';
import { getLobbyExpirationStatus, isLobbyFull, filterActiveLobbies } from '../../utils/lobbyUtils';
import { formatTimeAgo, getTimeUntilStart } from '../../utils/timerFormatters';

// Get asset count from V3 tiered portfolio
function getAssetCount(portfolio) {
  if (!portfolio) return 0;
  const starCount = (portfolio.star || []).filter(Boolean).length;
  const coreCount = (portfolio.core || []).filter(Boolean).length;
  const supportCount = (portfolio.support || []).filter(Boolean).length;
  return starCount + coreCount + supportCount;
}

// Individual Player Slot Component
function PlayerSlot({ rank, player, isCurrentUser, isHost, isEmpty }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 10px',
      marginBottom: '4px',
      borderRadius: '8px',
      background: isCurrentUser ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
      border: isCurrentUser ? '1px solid rgba(0, 217, 255, 0.3)' : '1px solid transparent',
    }}>
      {/* Rank number */}
      <span style={{
        fontSize: '12px',
        fontWeight: '700',
        color: '#ffd700',
        minWidth: '22px',
        fontFamily: "'SF Mono', 'Monaco', monospace",
      }}>
        [{rank}]
      </span>

      {/* Avatar */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: isEmpty ? '#21262d' : (isCurrentUser ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'),
        border: isEmpty ? '2px dashed #30363d' : `2px solid ${isCurrentUser ? '#00d9ff' : '#30363d'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isEmpty ? '12px' : '11px',
        fontWeight: '600',
        color: isEmpty ? '#484f58' : (isCurrentUser ? '#00d9ff' : '#8b949e'),
        flexShrink: 0,
      }}>
        {isEmpty ? '?' : (player?.avatar || (player?.odUsername || player?.username || 'P')[0].toUpperCase())}
      </div>

      {/* Username */}
      <span style={{
        flex: 1,
        fontSize: '13px',
        fontWeight: isCurrentUser ? '700' : '500',
        color: isEmpty ? '#484f58' : (isCurrentUser ? '#00d9ff' : '#e6edf3'),
        fontStyle: isEmpty ? 'italic' : 'normal',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {isEmpty ? 'Waiting...' : (isCurrentUser ? 'YOU' : (player?.odUsername || player?.username || 'Player'))}
      </span>

      {/* Role label */}
      {!isEmpty && (
        <span style={{
          fontSize: '10px',
          fontWeight: '600',
          color: isHost ? '#10b981' : '#6e7681',
        }}>
          {isHost ? 'Host' : 'Ready'}
        </span>
      )}
    </div>
  );
}

// Expiration Warning Badge
function ExpirationBadge({ expirationStatus }) {
  if (!expirationStatus || expirationStatus.status === 'active') return null;

  const isUrgent = expirationStatus.status === 'urgent';
  const isExpired = expirationStatus.status === 'expired';
  const bgColor = isUrgent || isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
  const textColor = isUrgent || isExpired ? '#ef4444' : '#f59e0b';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      background: bgColor,
      borderRadius: '4px',
      fontSize: '9px',
      fontWeight: '700',
      color: textColor,
    }}>
      <AlertTriangle size={9} />
      {isExpired ? 'EXPIRED' : expirationStatus.message}
    </span>
  );
}

// Pending Lobby Card with all player slots visible
function PendingLobbyCard({ lobby, type, isHost, currentUserId, onPress, onCopyCode }) {
  const isBaggerBomb = type === 'baggerbomb';
  const isSnakeDraft = type === 'snakeDraft';

  // Get created time
  const createdAt = isBaggerBomb
    ? lobby.timing?.createdAt
    : (lobby.createdAt?.toDate ? lobby.createdAt.toDate() : lobby.createdAt);

  // Get lobby code
  const lobbyCode = isBaggerBomb ? lobby.challengeCode : lobby.code;

  const gameEmoji = isBaggerBomb ? '💣' : '🐍';
  const gameLabel = isBaggerBomb ? 'BAGGERBOMB' : 'SNAKE DRAFT';

  // Get expiration status for warning badges (only for non-full lobbies)
  const isFull = isLobbyFull(lobby);
  const expirationStatus = !isFull ? getLobbyExpirationStatus(lobby) : null;

  // Colors
  const pendingColor = '#f59e0b';
  const borderColor = expirationStatus?.status === 'expired' ? '#ef4444' : '#00d9ff';
  const roleBadgeColor = isHost ? '#00d9ff' : '#10b981';

  // Build player slots for Snake Draft
  let slots = [];
  let currentPlayerCount = 0;
  let maxPlayers = 4;

  if (isSnakeDraft) {
    const players = lobby.players || [];
    maxPlayers = lobby.maxPlayers || 4;
    currentPlayerCount = players.length;

    // Create array of all slots (filled + empty)
    slots = Array.from({ length: maxPlayers }, (_, i) => {
      const player = players[i] || null;
      const isMe = player?.odUserId === currentUserId;
      const playerIsHost = player?.isHost || false;
      return { player, isMe, isHost: playerIsHost, isEmpty: !player };
    });
  } else if (isBaggerBomb) {
    // BaggerBomb: 2 slots (creator vs opponent)
    maxPlayers = 2;
    const creator = lobby.creator;
    const opponent = lobby.opponent?.uid ? lobby.opponent : null;
    currentPlayerCount = opponent ? 2 : 1;

    const creatorIsMe = (creator?.odUserId === currentUserId) || (creator?.uid === currentUserId);
    const opponentIsMe = opponent && ((opponent?.odUserId === currentUserId) || (opponent?.uid === currentUserId));

    slots = [
      { player: creator, isMe: creatorIsMe, isHost: true, isEmpty: false },
      { player: opponent, isMe: opponentIsMe, isHost: false, isEmpty: !opponent },
    ];
  }

  const waitingCount = maxPlayers - currentPlayerCount;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      onClick={onPress}
      style={{
        flex: '0 0 auto',
        width: 'calc(90vw - 32px)',
        maxWidth: '380px',
        minWidth: '320px',
        scrollSnapAlign: 'start',
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
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
            padding: '2px 6px',
            background: `${roleBadgeColor}20`,
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: '700',
            color: roleBadgeColor,
          }}>
            {isHost ? 'HOST' : 'JOINED'}
          </span>
          {/* PENDING Badge */}
          <span style={{
            padding: '2px 6px',
            background: `${pendingColor}20`,
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: '700',
            color: pendingColor,
          }}>
            PENDING
          </span>
          {/* Expiration Warning Badge */}
          <ExpirationBadge expirationStatus={expirationStatus} />
        </div>

        {/* Time badges: Countdown (for Snake Draft) + Time ago */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {/* Countdown badge for Snake Draft */}
          {isSnakeDraft && lobby.scheduledStart && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              border: '1px solid #14b8a6',
              borderRadius: '8px',
              boxShadow: '0 0 8px rgba(20, 184, 166, 0.3)',
            }}>
              <span style={{ fontSize: '11px' }}>⏱</span>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: 'white',
              }}>
                {getTimeUntilStart(lobby.scheduledStart)}
              </span>
            </div>
          )}

          {/* Time ago badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: 'rgba(139, 148, 158, 0.1)',
            borderRadius: '8px',
          }}>
            <Clock size={11} style={{ color: '#8b949e' }} />
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#8b949e',
            }}>
              {formatTimeAgo(createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content: Player slots + Stats */}
      <div style={{
        display: 'flex',
        gap: '12px',
      }}>
        {/* Left: Player slots list */}
        <div style={{ flex: 1 }}>
          {slots.map((slot, idx) => (
            <PlayerSlot
              key={idx}
              rank={idx + 1}
              player={slot.player}
              isCurrentUser={slot.isMe}
              isHost={slot.isHost}
              isEmpty={slot.isEmpty}
            />
          ))}
        </div>

        {/* Right: Player count stats */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '70px',
          paddingLeft: '12px',
          borderLeft: '1px solid #21262d',
        }}>
          <span style={{
            fontSize: '24px',
            fontWeight: '800',
            color: currentPlayerCount === maxPlayers ? '#10b981' : pendingColor,
            fontFamily: "'SF Mono', 'Monaco', monospace",
            lineHeight: 1,
          }}>
            {currentPlayerCount}/{maxPlayers}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#8b949e',
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            PLAYERS
          </span>
        </div>
      </div>

      {/* Bottom: Waiting message + Lobby code */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'rgba(33, 38, 45, 0.8)',
        borderRadius: '8px',
        marginTop: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={14} style={{ color: '#8b949e' }} />
          <span style={{ fontSize: '12px', color: '#8b949e' }}>
            {waitingCount > 0
              ? `Waiting for ${waitingCount} more`
              : 'Ready to start!'
            }
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
              padding: '5px 10px',
              background: '#00d9ff15',
              border: '1px solid #00d9ff40',
              borderRadius: '6px',
              color: '#00d9ff',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: "'SF Mono', 'Monaco', monospace",
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

  // Filter to show lobbies where user is CREATOR or has JOINED
  const userPendingLobbies = useMemo(() => {
    const pending = [];

    (lobbyBattles || []).forEach(lobby => {
      // BaggerBomb V3/V4
      if (lobby._v === 3 || lobby._v === 4) {
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
        const isHostUser = host?.odUserId === userId;
        const isPlayer = lobby.players?.some(p => p.odUserId === userId);
        const isPending = lobby.status === 'waiting';

        if ((isHostUser || isPlayer) && isPending) {
          pending.push({ lobby, type: 'snakeDraft', isHost: isHostUser });
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
