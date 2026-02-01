import React, { useState, useMemo } from 'react';
import { Users, ChevronRight, Flame, Clock, Calendar, CalendarDays } from 'lucide-react';

// Style override to neutralize App.css
const containerStyle = {
  maxWidth: '100vw',
  width: '100%',
  margin: 0,
  padding: 0,
  textAlign: 'left',
  minHeight: '100vh',
  background: '#0d1117',
  overflowX: 'hidden'
};

// Get approximate time until start (rounded increments for public display)
const getApproximateTimeUntilStart = (scheduledStart) => {
  if (!scheduledStart) return 'No time set';

  const now = new Date();
  const start = new Date(scheduledStart);
  const diffMs = start - now;

  if (diffMs <= 0) return 'Starting now!';

  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 10) {
    // Round UP to 5-minute increments
    const rounded = Math.ceil(diffMins / 5) * 5;
    return `~${rounded || 5}m`;
  } else if (diffMins < 30) {
    // Round UP to 10-minute increments
    const rounded = Math.ceil(diffMins / 10) * 10;
    return `~${rounded}m`;
  } else if (diffMins < 60) {
    // Round UP to 30-minute increments
    const rounded = Math.ceil(diffMins / 30) * 30;
    return `~${rounded}m`;
  } else {
    // Over 1 hour - round to 30-minute increments, show hours + mins
    const totalMins = Math.ceil(diffMins / 30) * 30;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
  }
};

// Get minutes until start for tier grouping
const getMinutesUntilStart = (scheduledStart) => {
  if (!scheduledStart) return 0; // No time set = treat as starting soon
  const now = new Date();
  const start = new Date(scheduledStart);
  return Math.floor((start - now) / 60000);
};

// Group lobbies by time-based tiers
const groupLobbiesByTime = (lobbies) => {
  const tiers = {
    soon: {
      key: 'soon',
      label: 'Starting Soon',
      sublabel: 'under 30 min',
      icon: Flame,
      iconColor: '#f59e0b',
      lobbies: []
    },
    medium: {
      key: 'medium',
      label: 'Starting in 30min - 1 hour',
      sublabel: null,
      icon: Clock,
      iconColor: '#8b949e',
      lobbies: []
    },
    later: {
      key: 'later',
      label: 'Starting in 1-2 hours',
      sublabel: null,
      icon: Calendar,
      iconColor: '#8b949e',
      lobbies: []
    },
    future: {
      key: 'future',
      label: 'Starting in 2+ hours',
      sublabel: null,
      icon: CalendarDays,
      iconColor: '#8b949e',
      lobbies: []
    },
  };

  lobbies.forEach(lobby => {
    const diffMins = getMinutesUntilStart(lobby.scheduledStart);

    if (diffMins < 30) {
      tiers.soon.lobbies.push(lobby);
    } else if (diffMins < 60) {
      tiers.medium.lobbies.push(lobby);
    } else if (diffMins < 120) {
      tiers.later.lobbies.push(lobby);
    } else {
      tiers.future.lobbies.push(lobby);
    }
  });

  // Sort each tier by soonest first
  Object.values(tiers).forEach(tier => {
    tier.lobbies.sort((a, b) => {
      const aTime = new Date(a.scheduledStart || 0);
      const bTime = new Date(b.scheduledStart || 0);
      return aTime - bTime;
    });
  });

  return tiers;
};

// Get host username from draft
const getHostUsername = (draft) => {
  const host = draft.players?.find(p => p.isHost);
  return host?.odUsername || host?.displayName || 'Player';
};

// Lobby Card Component
const LobbyCard = ({ lobby, onJoin, currentUserId }) => {
  const hostName = getHostUsername(lobby);
  const playerCount = lobby.players?.length || 1;
  const maxPlayers = 4;
  const timeUntil = getApproximateTimeUntilStart(lobby.scheduledStart);
  const isUserInLobby = lobby.players?.some(p => p.odUserId === currentUserId);

  return (
    <div
      style={{
        background: '#161b22',
        border: '2px solid #0d9488',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <span style={{ fontSize: '28px' }}>🐍</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'white',
            fontWeight: '600',
            fontSize: '15px',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {hostName} created a draft
          </div>
          <div style={{
            color: '#8b949e',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Users size={13} />
            <span>{playerCount}/{maxPlayers} players</span>
            <span style={{ color: '#484f58' }}>•</span>
            <span style={{ color: '#14b8a6' }}>Starts {timeUntil}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onJoin(lobby)}
        disabled={isUserInLobby}
        style={{
          padding: '10px 20px',
          background: isUserInLobby ? 'rgba(20, 184, 166, 0.1)' : 'transparent',
          border: '2px solid #14b8a6',
          borderRadius: '8px',
          color: '#14b8a6',
          fontWeight: '700',
          fontSize: '13px',
          cursor: isUserInLobby ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
      >
        {isUserInLobby ? 'JOINED' : '[JOIN]'}
      </button>
    </div>
  );
};

// Empty State Component
const EmptyState = () => (
  <div style={{
    textAlign: 'center',
    padding: '40px 20px',
    background: '#161b22',
    borderRadius: '12px',
    border: '1px dashed #21262d',
  }}>
    <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🐍</div>
    <p style={{ color: '#8b949e', fontSize: '15px', marginBottom: '8px' }}>
      No open drafts available
    </p>
    <p style={{ color: '#6e7681', fontSize: '13px' }}>
      Be the first to create one!
    </p>
  </div>
);

// Tier Header Component
const TierHeader = ({ tier }) => {
  const IconComponent = tier.icon;
  const isSoon = tier.key === 'soon';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '12px',
      paddingBottom: '8px',
      borderBottom: `1px solid ${isSoon ? '#f59e0b33' : '#21262d'}`,
    }}>
      {isSoon ? (
        <span style={{
          background: '#f59e0b22',
          padding: '4px 10px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <IconComponent size={14} color={tier.iconColor} />
          <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '700' }}>
            {tier.label}
          </span>
        </span>
      ) : (
        <>
          <IconComponent size={14} color={tier.iconColor} />
          <span style={{ color: '#8b949e', fontSize: '13px', fontWeight: '600' }}>
            {tier.label}
          </span>
        </>
      )}
      {tier.sublabel && (
        <span style={{ color: '#6e7681', fontSize: '12px' }}>
          ({tier.sublabel})
        </span>
      )}
      <span style={{ color: '#484f58', fontSize: '12px', marginLeft: 'auto' }}>
        {tier.lobbies.length}
      </span>
    </div>
  );
};

const DraftJoinScreen = ({
  user,
  lobbyBattles = [],
  draftJoinCode,
  setDraftJoinCode,
  onBack,
  onJoinDraft,
  onCreateDraft,
}) => {
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const currentUserId = user?.odUserId || user?.username;

  // Filter Snake Draft lobbies
  const snakeDraftLobbies = useMemo(() => {
    return (lobbyBattles || [])
      .filter(lobby =>
        (lobby.isSnakeDraft || lobby.battleType === 'snake-draft') &&
        lobby.status === 'waiting' &&
        !lobby.isTraining
      );
  }, [lobbyBattles]);

  // Group lobbies by time-based tiers
  const tiers = useMemo(() => {
    return groupLobbiesByTime(snakeDraftLobbies);
  }, [snakeDraftLobbies]);

  // Check if any lobbies exist
  const hasLobbies = snakeDraftLobbies.length > 0;

  const handleJoinLobby = async (lobby) => {
    try {
      const draftService = await import('../services/draftService');
      const draft = await draftService.joinDraftByCode(
        lobby.code,
        user.odUserId || user.username,
        user.username
      );
      onJoinDraft(draft);
    } catch (error) {
      console.error('Failed to join draft:', error);
      alert(error.message || 'Failed to join draft');
    }
  };

  const handleJoinByCode = async () => {
    if (!draftJoinCode?.trim()) {
      alert('Please enter a draft code');
      return;
    }
    try {
      const draftService = await import('../services/draftService');
      const draft = await draftService.joinDraftByCode(
        draftJoinCode.trim(),
        user.odUserId || user.username,
        user.username
      );
      onJoinDraft(draft);
    } catch (error) {
      console.error('Failed to join draft:', error);
      alert(error.message || 'Failed to join draft');
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '2px solid #21262d',
          padding: '16px'
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#00d9ff',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
              🐍 Snake Draft Lobby
            </h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
          {/* Subtitle */}
          <p style={{
            color: '#8b949e',
            fontSize: '15px',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            Join an open draft or create your own
          </p>

          {/* Create New Draft Button */}
          <button
            onClick={onCreateDraft}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              border: '2px solid #14b8a6',
              borderRadius: '12px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            + Create New Draft
          </button>

          {/* Open Drafts Section Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <h3 style={{
              color: '#8b949e',
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: 0,
            }}>
              Open Drafts
            </h3>
            <span style={{
              color: '#6e7681',
              fontSize: '12px',
            }}>
              {snakeDraftLobbies.length} available
            </span>
          </div>

          {/* Lobby List by Tiers or Empty State */}
          {hasLobbies ? (
            <div style={{ marginBottom: '24px' }}>
              {Object.values(tiers).map(tier => {
                if (tier.lobbies.length === 0) return null;

                return (
                  <div key={tier.key} style={{ marginBottom: '20px' }}>
                    <TierHeader tier={tier} />
                    <div>
                      {tier.lobbies.map(lobby => (
                        <LobbyCard
                          key={lobby.id}
                          lobby={lobby}
                          onJoin={handleJoinLobby}
                          currentUserId={currentUserId}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginBottom: '24px' }}>
              <EmptyState />
            </div>
          )}

          {/* Code Entry Section (Collapsible) */}
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setShowCodeEntry(!showCodeEntry)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Have a code? Join private draft</span>
              <ChevronRight
                size={18}
                style={{
                  transform: showCodeEntry ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {showCodeEntry && (
              <div style={{ padding: '0 16px 16px' }}>
                <input
                  type="text"
                  value={draftJoinCode || ''}
                  onChange={(e) => setDraftJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g., BULL-1234"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    letterSpacing: '3px',
                    background: '#0d1117',
                    border: '2px solid #21262d',
                    borderRadius: '8px',
                    color: '#ffffff',
                    marginBottom: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  maxLength={10}
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={!draftJoinCode?.trim()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: draftJoinCode?.trim()
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : '#21262d',
                    color: draftJoinCode?.trim() ? '#ffffff' : '#8b949e',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: draftJoinCode?.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  JOIN WITH CODE
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftJoinScreen;
