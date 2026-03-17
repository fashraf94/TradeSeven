// /src/components/Dashboard/QuickPlayModal.jsx
// Centered overlay modal with open lobbies + instant AI start options
// Opened from "Quick Play" CTA button on the dashboard

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import TapGlint from '../shared/TapGlint';
import CenteredModal from '../shared/CenteredModal';
import { isLobbyExpired } from '../../utils/lobbyUtils';
import { isBaggerBombBattle, getUsername } from '../../utils/battleHelpers';

// ─── AI game options ─────────────────────────────────────────────────────────

const AI_GAMES = [
  {
    id: 'baggerbomb',
    name: 'BaggerBomb AI',
    tagline: 'Start instantly vs AI',
    Icon: Flame,
    iconColor: '#f59e0b',
  },
  {
    id: 'snakeDraft',
    name: 'Snake Draft AI',
    tagline: 'Draft against 3 AI players',
    Icon: TrendingUp,
    iconColor: '#34d399',
  },
];

// ─── Lobby helpers (from PvpWatchlistSection) ────────────────────────────────

function getBattleTypeLabel(battle) {
  if (!battle) return 'Builder 1v1';
  if (isBaggerBombBattle(battle)) return 'BaggerBomb';
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') return 'Snake Draft';
  return 'Builder 1v1';
}

function getPlayerCountDisplay(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const current = battle.players?.length || 1;
    return `${current}/4 players`;
  }
  if (battle._v === 3 || battle._v === 4) {
    return battle.state?.status === 'waiting' ? '1/2 players' : '2/2 players';
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuickPlayModal({
  isOpen,
  onClose,
  lobbyBattles,
  user,
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  setBattleToJoin,
  copyToClipboard,
  setShowBaggerBombTrainingConfirm,
  setShowTrainingConfirmModal,
  setTrainingConfirmType,
}) {
  const { tokens } = useTheme();
  const [tapCounts, setTapCounts] = useState({});

  const handleAiSelect = (gameId) => {
    onClose();
    if (gameId === 'baggerbomb') setShowBaggerBombTrainingConfirm(true);
    if (gameId === 'snakeDraft') {
      setTrainingConfirmType('stocks');
      setShowTrainingConfirmModal(true);
    }
  };

  // Filter lobbies: show OTHER users' joinable lobbies (not the current user's own)
  const joinableLobbies = useMemo(() => {
    const currentUserId = user?.odUserId || user?.uid || user?.username;
    const seenIds = new Set();
    const items = [];

    (lobbyBattles || []).forEach(lobby => {
      // Skip own lobbies
      if (getLobbyUserId(lobby) === currentUserId) return;
      // Skip expired
      if (isLobbyExpired(lobby)) return;
      // Dedup
      const id = lobby.id;
      if (seenIds.has(id)) return;
      seenIds.add(id);
      items.push(lobby);
    });

    items.sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
    return items;
  }, [lobbyBattles, user]);

  const handleJoinLobby = (lobby) => {
    onClose();
    // BaggerBomb V3/V4
    if (lobby._v === 3 || lobby._v === 4) {
      setBattleToJoin(lobby);
      setScreen('baggerBombJoinBuilder');
      return;
    }
    // Snake Draft
    if (lobby.isSnakeDraft || lobby.battleType === 'snake-draft') {
      setCurrentDraft(lobby);
      setScreen('draftLobby');
      return;
    }
    // Legacy BaggerBomb fallback
    if (isBaggerBombBattle(lobby)) {
      setBattleToJoin(lobby);
      setScreen('baggerBombJoinBuilder');
    }
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose} title="Quick Play">
            {/* Scrollable content */}
            <div style={{
              overflowY: 'auto',
              flex: 1,
              padding: '0 20px',
              paddingBottom: '24px',
            }}>
              {/* Section 1: Instant AI Play */}
              <div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: tokens.textFaint,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  marginBottom: '12px',
                  padding: '0 4px',
                }}>
                  Instant Play
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {AI_GAMES.map((game) => (
                    <motion.button
                      key={game.id}
                      onClick={() => {
                        setTapCounts(prev => ({ ...prev, [game.id]: (prev[game.id] || 0) + 1 }));
                        handleAiSelect(game.id);
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '16px',
                        background: tokens.bgCard,
                        border: `1px solid ${tokens.borderDefault}`,
                        borderRadius: '14px',
                        boxShadow: tokens.obsidianShadow,
                        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <TapGlint triggerKey={tapCounts[game.id] || 0} />
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: tokens.bgIcon,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <game.Icon size={24} color={game.iconColor} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: tokens.textPrimary }}>
                          {game.name}
                        </div>
                        <div style={{ fontSize: '13px', color: tokens.textMuted, marginTop: '2px' }}>
                          {game.tagline}
                        </div>
                      </div>
                      <ChevronRight size={16} color={tokens.textFaintest} style={{ flexShrink: 0 }} />
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Section 2: Open Lobbies */}
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: tokens.textFaint,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  marginBottom: '12px',
                  padding: '0 4px',
                }}>
                  Join a Game
                </div>
                {joinableLobbies.length > 0 ? (
                  <div style={{
                    maxHeight: '240px',
                    overflowY: 'auto',
                    scrollBehavior: 'smooth',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.15) rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {joinableLobbies.map(lobby => (
                        <div
                          key={lobby.id}
                          style={{
                            background: tokens.bgCard,
                            borderLeft: '4px solid #00d9ff',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              color: tokens.textPrimary,
                              lineHeight: 1.4,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {getCreatorName(lobby)} created a {getBattleTypeLabel(lobby)} lobby
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: tokens.textMuted,
                              marginTop: '2px',
                            }}>
                              {getPlayerCountDisplay(lobby)}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleJoinLobby(lobby); }}
                            style={{
                              padding: '6px 12px',
                              minHeight: '32px',
                              background: 'rgba(0,217,255,0.08)',
                              border: '1px solid rgba(0,217,255,0.25)',
                              borderRadius: '6px',
                              color: '#00d9ff',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              flexShrink: 0,
                              transition: 'all 0.2s',
                              outline: 'none',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,217,255,0.18)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,217,255,0.08)'; }}
                          >
                            [JOIN]
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: tokens.textFaint,
                    fontSize: '14px',
                  }}>
                    No open lobbies right now
                  </div>
                )}
              </div>
            </div>
    </CenteredModal>
  );
}
